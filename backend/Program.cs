using System.Reflection;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Services;
using LeaveManagementAPI.WebSockets;

var builder = WebApplication.CreateBuilder(args);

// --- Service Registration ---

// EF Core InMemory Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.Configure<MailSettings>(
    builder.Configuration.GetSection(MailSettings.SectionName));
builder.Services.AddScoped<IMailService, MailService>();
builder.Services.AddHttpClient<IPublicHolidayService, PublicHolidayService>(client =>
{
    client.BaseAddress = new Uri("https://date.nager.at/");
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<ILeaveDayCalculator, LeaveDayCalculator>();
builder.Services.AddScoped<IPublicHolidayCatalogService, PublicHolidayCatalogService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddSingleton<IStompMessageBroker, StompMessageBroker>();
builder.Services.AddScoped<IRealtimePresenceService, RealtimePresenceService>();
builder.Services.AddHostedService<SoftDeletedWorkplacePurgeService>();
builder.Services.AddHostedService<MessageRetentionService>();
builder.Services.AddHostedService<PublicHolidaySyncService>();

// Controllers with JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Enum'ları string olarak serialize et
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());

        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key configuration is required.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer configuration is required.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience configuration is required.");

if (builder.Environment.IsProduction()
    && jwtKey.StartsWith("development-only", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Jwt:Key must be overridden in production.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // WebSocket el sikismasi ve dosya eki indirme linklerinde
                // Authorization header'i tasinamiyor; token query'den okunur.
                var path = context.HttpContext.Request.Path;
                if ((path.StartsWithSegments("/ws")
                        || path.StartsWithSegments("/api/messages/attachments"))
                    && context.Request.Query.TryGetValue("access_token", out var token))
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            }
        };
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = "role",
            NameClaimType = "name"
        };
    });

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "İzin Yönetim Sistemi API",
        Description = "ASP.NET Core Web API ile İzin Yönetim Sistemi. " +
                      "Kullanıcı, iş yeri, izin talebi ve denetim kayıtlarını yönetir.",
        Contact = new OpenApiContact
        {
            Name = "Destek"
        }
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Bearer token girin."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    // XML dokümantasyon dosyasını dahil et
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFilename);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseExceptionHandler(errorApp => errorApp.Run(async httpContext =>
{
    var error = httpContext.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    if (error is HolidayDataUnavailableException)
    {
        httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await httpContext.Response.WriteAsJsonAsync(new { message = "Resmi tatil takvimi henuz hazir degil. Lutfen daha sonra tekrar deneyin." });
        return;
    }
    httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await httpContext.Response.WriteAsJsonAsync(new { message = "Beklenmeyen bir sunucu hatasi olustu." });
}));

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        dbContext.Database.Migrate();
        await scope.ServiceProvider.GetRequiredService<IRealtimePresenceService>()
            .CloseOrphanedConnectionsAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogWarning(ex, "Veritabanına bağlanılamadı. Migration uygulanamadı. PostgreSQL'in çalıştığından ve connection string'in doğru olduğundan emin olun.");
    }
}

// --- Middleware Pipeline ---

// Swagger her zaman aktif (geliştirme kolaylığı için)
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "İzin Yönetim Sistemi API v1");
    options.RoutePrefix = "swagger";
});

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseWebSockets();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<StompWebSocketMiddleware>();
app.MapControllers();

app.Run();
