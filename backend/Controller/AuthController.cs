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

            if (user.IsTempPassword)
            {
                var affectedRows = await _context.Users
                    .Where(u => u.Id == user.Id && u.TempPasswordUsedAt == null)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(u => u.TempPasswordUsedAt, DateTime.UtcNow));

                if (affectedRows == 0)
                {
                    return Unauthorized(new { message = "Gecici sifre daha once kullanildi. Yoneticiyle iletisime gecin." });
                }
            }

            var expiresAt = DateTime.UtcNow.AddMinutes(GetTokenLifetimeMinutes());
            var token = CreateToken(user, expiresAt);

            return Ok(new LoginResponse
            {
                Token = token,
                ExpiresAt = expiresAt,
                User = ToAuthUserResponse(user)
            });
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<ActionResult<AuthUserResponse>> ChangePassword(ChangePasswordRequest request)
        {
            var userIdValue = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!long.TryParse(userIdValue, out var userId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user is null)
            {
                return NotFound(new { message = "Kullanici bulunamadi." });
            }

            if (!user.IsTempPassword)
            {
                return BadRequest(new { message = "Sifre daha once degistirilmis." });
            }

            if (user.TempPasswordUsedAt is null)
            {
                return BadRequest(new { message = "Yeni sifre belirlemek icin once gecici sifre ile giris yapmalisiniz." });
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            {
                return BadRequest(new { message = "Yeni sifre en az 6 karakter olmali." });
            }

            if (request.NewPassword != request.ConfirmPassword)
            {
                return BadRequest(new { message = "Sifreler eslesmiyor." });
            }

            user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.IsTempPassword = false;
            user.TempPasswordUsedAt = null;
            await _context.SaveChangesAsync();

            return Ok(ToAuthUserResponse(user));
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

        private static AuthUserResponse ToAuthUserResponse(User user)
        {
            return new AuthUserResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsFirstLogin = user.IsTempPassword
            };
        }
    }
}
