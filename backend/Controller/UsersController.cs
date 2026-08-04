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

        /// <summary>Oturumdaki kullanicinin profili ve aktif is yeri atamasi.</summary>
        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<CurrentUserResponse>> Me(CancellationToken cancellationToken)
        {
            var userIdValue = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            if (!long.TryParse(userIdValue, out var userId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Id == userId && u.IsActive, cancellationToken);
            if (user is null)
            {
                return Unauthorized(new { message = "Gecersiz token veya pasif kullanici." });
            }

            var assignment = await _context.UserWorkplaces
                .Where(mapping => mapping.UserId == userId && mapping.Workplace.IsActive)
                .OrderBy(mapping => mapping.WorkplaceId)
                .Select(mapping => new
                {
                    mapping.WorkplaceId,
                    WorkplaceName = mapping.Workplace.Name,
                    mapping.AnnualLeaveCount
                })
                .FirstOrDefaultAsync(cancellationToken);

            return Ok(new CurrentUserResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Phone = user.Phone,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsFirstLogin = user.IsTempPassword,
                WorkplaceId = assignment?.WorkplaceId,
                WorkplaceName = assignment?.WorkplaceName,
                AnnualLeaveCount = assignment?.AnnualLeaveCount
            });
        }

        [HttpPost("create")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Mail)
                || string.IsNullOrWhiteSpace(request.Phone)
                || string.IsNullOrWhiteSpace(request.Name)
                || string.IsNullOrWhiteSpace(request.Surname))
            {
                return BadRequest(new { message = "Mail, phone, name ve surname alanlari bos olamaz." });
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
                Phone = request.Phone.Trim(),
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

        /// <summary>Soft-delete edilmiş kullanıcılar (Silinenler ekranı).</summary>
        [HttpGet("deleted")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<IEnumerable<DeletedUserResponse>>> GetDeleted(
            CancellationToken cancellationToken)
        {
            var users = await _context.Users
                .IgnoreQueryFilters()
                .Where(user => user.DeletedAt != null && user.Role != UserRole.ADMIN)
                .OrderByDescending(user => user.DeletedAt)
                .Select(user => new DeletedUserResponse
                {
                    Id = user.Id,
                    Mail = user.Mail,
                    Name = user.Name,
                    Surname = user.Surname,
                    Role = user.Role.ToString(),
                    DeletedAt = user.DeletedAt!.Value,
                    WorkplaceId = user.UserWorkplaces
                        .Select(mapping => (long?)mapping.WorkplaceId)
                        .FirstOrDefault(),
                    WorkplaceName = user.UserWorkplaces
                        .Select(mapping => mapping.Workplace.Name)
                        .FirstOrDefault()
                })
                .ToListAsync(cancellationToken);

            return Ok(users);
        }

        /// <summary>
        /// Kullanıcıyı soft-delete eder (fiziksel DELETE yasak — şartname 4.1).
        /// Şube ataması korunur; geri alındığında aynı şubesine döner.
        /// </summary>
        [HttpDelete("{id:long}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
        {
            var currentUserId = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            if (!long.TryParse(currentUserId, out var adminId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            if (id == adminId)
            {
                return BadRequest(new { message = "Kendi hesabinizi silemezsiniz." });
            }

            var user = await _context.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
            if (user is null)
            {
                return NotFound(new { message = "Kullanici bulunamadi." });
            }

            if (user.Role == UserRole.ADMIN)
            {
                return BadRequest(new { message = "Yonetici hesabi bu endpoint ile silinemez." });
            }

            user.DeletedAt = DateTime.UtcNow;
            user.IsActive = false;
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        /// <summary>Soft-delete edilmiş kullanıcıyı geri alır.</summary>
        [HttpPost("{id:long}/restore")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<UserResponse>> Restore(long id, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
            if (user is null)
            {
                return NotFound(new { message = "Kullanici bulunamadi." });
            }

            if (user.DeletedAt is null)
            {
                return BadRequest(new { message = "Kullanici silinmis durumda degil." });
            }

            user.DeletedAt = null;
            user.IsActive = true;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(ToResponse(user));
        }

        [HttpPatch("{id:long}/status")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<UserResponse>> UpdateStatus(
            long id,
            UpdateUserStatusRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            if (!long.TryParse(currentUserId, out var adminId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            if (id == adminId && !request.IsActive)
            {
                return BadRequest(new { message = "Kendi hesabinizi pasife alamazsiniz." });
            }

            var user = await _context.Users.SingleOrDefaultAsync(user => user.Id == id, cancellationToken);
            if (user is null)
            {
                return NotFound(new { message = "Kullanici bulunamadi." });
            }

            user.IsActive = request.IsActive;
            await _context.SaveChangesAsync(cancellationToken);
            return Ok(ToResponse(user));
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
                Phone = user.Phone,
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
