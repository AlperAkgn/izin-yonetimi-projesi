using System.Security.Cryptography;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Enums;
using LeaveManagementAPI.Models.Users;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMailService _mailService;
        private readonly ILogger<UsersController> _logger;

        public UsersController(
            AppDbContext context,
            IMailService mailService,
            ILogger<UsersController> logger)
        {
            _context = context;
            _mailService = mailService;
            _logger = logger;
        }

        [HttpPost("create")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Mail)
                || string.IsNullOrWhiteSpace(request.Name)
                || string.IsNullOrWhiteSpace(request.Surname))
            {
                return BadRequest(new { message = "Mail, name ve surname alanlari bos olamaz." });
            }

            if (!TryParseAllowedRole(request.Role, out var role))
            {
                return BadRequest(new { message = "Role yalnizca EMPLOYEE, HR veya ADMIN olabilir." });
            }

            var normalizedMail = request.Mail.Trim().ToLowerInvariant();
            var mailExists = await _context.Users
                .IgnoreQueryFilters()
                .AnyAsync(u => u.Mail.ToLower() == normalizedMail);

            if (mailExists)
            {
                return Conflict(new { message = "Bu e-posta adresiyle kayitli bir kullanici zaten var." });
            }

            var temporaryPassword = CreateTemporaryPassword();
            var user = new User
            {
                Mail = normalizedMail,
                Name = request.Name.Trim(),
                Surname = request.Surname.Trim(),
                Role = role,
                Password = BCrypt.Net.BCrypt.HashPassword(temporaryPassword),
                IsActive = true,
                IsTempPassword = true,
                TempPasswordUsedAt = null,
                StartAt = request.StartAt?.ToUniversalTime() ?? DateTime.UtcNow,
                DeletedAt = null
            };

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);

                await _mailService.SendTemporaryPasswordAsync(
                    user.Mail,
                    user.Name,
                    temporaryPassword,
                    cancellationToken);

                await transaction.CommitAsync(cancellationToken);
            }
            catch (Exception exception)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                _logger.LogError(exception, "Kullanici olusturulurken gecici sifre e-postasi gonderilemedi.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Gecici sifre e-postasi gonderilemedi. Kullanici olusturulmadi."
                });
            }

            return Created($"/api/users/{user.Id}", ToResponse(user));
        }

        private static bool TryParseAllowedRole(string roleValue, out UserRole role)
        {
            role = default;
            var normalizedRole = roleValue.Trim().ToUpperInvariant();

            if (!Enum.TryParse(normalizedRole, ignoreCase: false, out UserRole parsedRole))
            {
                return false;
            }

            if (parsedRole is not (UserRole.EMPLOYEE or UserRole.HR or UserRole.ADMIN))
            {
                return false;
            }

            role = parsedRole;
            return true;
        }

        private static string CreateTemporaryPassword()
        {
            const string uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string lowercase = "abcdefghijkmnopqrstuvwxyz";
            const string digits = "23456789";
            const string symbols = "!@#$%*-_";
            const string allCharacters = uppercase + lowercase + digits + symbols;

            var passwordCharacters = new[]
            {
                GetRandomCharacter(uppercase),
                GetRandomCharacter(lowercase),
                GetRandomCharacter(digits),
                GetRandomCharacter(symbols)
            };

            Array.Resize(ref passwordCharacters, 12);
            for (var index = 4; index < passwordCharacters.Length; index++)
            {
                passwordCharacters[index] = GetRandomCharacter(allCharacters);
            }

            for (var index = passwordCharacters.Length - 1; index > 0; index--)
            {
                var swapIndex = RandomNumberGenerator.GetInt32(index + 1);
                (passwordCharacters[index], passwordCharacters[swapIndex]) =
                    (passwordCharacters[swapIndex], passwordCharacters[index]);
            }

            return new string(passwordCharacters);
        }

        private static char GetRandomCharacter(string characters)
        {
            return characters[RandomNumberGenerator.GetInt32(characters.Length)];
        }

        private static UserResponse ToResponse(User user)
        {
            return new UserResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsActive = user.IsActive,
                IsFirstLogin = user.IsTempPassword,
                StartAt = user.StartAt
            };
        }
    }
}
