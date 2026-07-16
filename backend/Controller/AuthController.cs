using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Models.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
        {
            var normalizedMail = request.Mail.Trim().ToLowerInvariant();
            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Mail.ToLower() == normalizedMail && u.IsActive);

            if (user is null || !await VerifyPasswordAndMigrateIfNeeded(user, request.Password))
            {
                return Unauthorized(new { message = "E-posta veya sifre hatali." });
            }

            var expiresAt = DateTime.UtcNow.AddMinutes(GetTokenLifetimeMinutes());
            var token = CreateToken(user, expiresAt);
            user.IsTempPassword = false;
            await _context.SaveChangesAsync();

            return Ok(new LoginResponse
            {
                Token = token,
                ExpiresAt = expiresAt,
                User = new AuthUserResponse
                {
                    Id = user.Id,
                    Mail = user.Mail,
                    Name = user.Name,
                    Surname = user.Surname,
                    Role = user.Role.ToString(),
                    IsFirstLogin = user.IsTempPassword
                }
            });
        }


        private async Task<bool> VerifyPasswordAndMigrateIfNeeded(User user, string password)
        {
            if (IsBCryptHash(user.Password))
            {
                try
                {
                    return BCrypt.Net.BCrypt.Verify(password, user.Password);
                }
                catch (SaltParseException)
                {
                    return false;
                }
            }

            if (user.Password != password)
            {
                return false;
            }

            user.Password = BCrypt.Net.BCrypt.HashPassword(password);
            await _context.SaveChangesAsync();
            return true;
        }

        private string CreateToken(User user, DateTime expiresAt)
        {
            var jwtKey = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("Jwt:Key configuration is required.");
            var jwtIssuer = _configuration["Jwt:Issuer"]
                ?? throw new InvalidOperationException("Jwt:Issuer configuration is required.");
            var jwtAudience = _configuration["Jwt:Audience"]
                ?? throw new InvalidOperationException("Jwt:Audience configuration is required.");

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Mail),
                new Claim("name", $"{user.Name} {user.Surname}".Trim()),
                new Claim("role", user.Role.ToString())
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiresAt,
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private int GetTokenLifetimeMinutes()
        {
            var configuredMinutes = _configuration.GetValue<int?>("Jwt:ExpiresMinutes");
            return configuredMinutes is > 0 ? configuredMinutes.Value : 60;
        }

        private static bool IsBCryptHash(string password)
        {
            return password.StartsWith("$2a$", StringComparison.Ordinal)
                || password.StartsWith("$2b$", StringComparison.Ordinal)
                || password.StartsWith("$2x$", StringComparison.Ordinal)
                || password.StartsWith("$2y$", StringComparison.Ordinal);
        }
    }
}
