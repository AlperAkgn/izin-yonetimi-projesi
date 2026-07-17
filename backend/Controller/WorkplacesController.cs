using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Enums;
using LeaveManagementAPI.Models.Workplaces;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMIN")]
    public class WorkplacesController : ControllerBase
    {
        private const int DefaultLeaveCount = 15;

        private readonly AppDbContext _context;
        private readonly IMailService _mailService;
        private readonly ILogger<WorkplacesController> _logger;

        public WorkplacesController(
            AppDbContext context,
            IMailService mailService,
            ILogger<WorkplacesController> logger)
        {
            _context = context;
            _mailService = mailService;
            _logger = logger;
        }


        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkplaceResponse>>> GetAll()
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            var workplaces = await _context.Workplaces
                .Where(w => w.IsActive && w.UserWorkplaces.Any(uw => uw.UserId == auth.AdminId))
                .OrderBy(w => w.Name)
                .Select(w => ToResponse(w))
                .ToListAsync();

            return Ok(workplaces);
        }

        [HttpGet("{id:long}")]
        public async Task<ActionResult<WorkplaceResponse>> GetById(long id)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            var workplace = await GetAccessibleWorkplace(id, auth.AdminId);

            if (workplace is null)
            {
                return NotFound(new { message = "Is yeri bulunamadi." });
            }

            return Ok(ToResponse(workplace));
        }

        [HttpPost("{id:long}/users")]
        public async Task<ActionResult<WorkplaceUserResponse>> CreateUser(
            long id,
            CreateWorkplaceUserRequest request,
            CancellationToken cancellationToken)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            if (!await HasWorkplaceAccess(id, auth.AdminId))
            {
                return NotFound(new { message = "Is yeri bulunamadi." });
            }

            if (string.IsNullOrWhiteSpace(request.Mail)
                || string.IsNullOrWhiteSpace(request.Name)
                || string.IsNullOrWhiteSpace(request.Surname))
            {
                return BadRequest(new { message = "Mail, name ve surname alanlari bos olamaz." });
            }

            if (!TryParseWorkplaceUserRole(request.Role, out var role))
            {
                return BadRequest(new { message = "Role yalnizca EMPLOYEE veya HR olabilir." });
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
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
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

            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);

                _context.UserWorkplaces.Add(new UserWorkplace
                {
                    UserId = user.Id,
                    WorkplaceId = id
                });
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
                _logger.LogError(exception, "Kullanici is yerine eklenirken gecici sifre e-postasi gonderilemedi.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Gecici sifre e-postasi gonderilemedi. Kullanici is yerine eklenmedi."
                });
            }

            return Created($"/api/workplaces/{id}/users/{user.Id}", ToUserResponse(user));
        }


        [HttpPost]
        public async Task<ActionResult<WorkplaceResponse>> Create(CreateWorkplaceRequest request)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            if (!HasRequiredTextFields(
                request.Name,
                request.Address,
                request.PhoneNumber,
                request.Mail))
            {
                return BadRequest(new { message = "Name, address, phoneNumber ve mail alanlari bos olamaz." });
            }

            var normalizedMail = request.Mail.Trim().ToLowerInvariant();
            var mailExists = await _context.Workplaces
                .IgnoreQueryFilters()
                .AnyAsync(w => w.Mail.ToLower() == normalizedMail);

            if (mailExists)
            {
                return Conflict(new { message = "Bu e-posta adresiyle kayitli bir is yeri zaten var." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            var workplace = new Workplace
            {
                Name = request.Name.Trim(),
                Address = request.Address.Trim(),
                PhoneNumber = request.PhoneNumber.Trim(),
                Mail = normalizedMail,
                LeaveCount = request.LeaveCount ?? DefaultLeaveCount,
                IsActive = true,
                DeletedAt = null
            };

            _context.Workplaces.Add(workplace);
            await _context.SaveChangesAsync();

            _context.UserWorkplaces.Add(new UserWorkplace
            {
                UserId = auth.AdminId,
                WorkplaceId = workplace.Id
            });
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Created($"/api/workplaces/{workplace.Id}", ToResponse(workplace));
        }

        [HttpPut("{id:long}")]
        public async Task<ActionResult<WorkplaceResponse>> Update(long id, UpdateWorkplaceRequest request)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            if (!HasRequiredTextFields(
                request.Name,
                request.Address,
                request.PhoneNumber,
                request.Mail))
            {
                return BadRequest(new { message = "Name, address, phoneNumber ve mail alanlari bos olamaz." });
            }

            var workplace = await GetAccessibleWorkplace(id, auth.AdminId);

            if (workplace is null)
            {
                return NotFound(new { message = "Is yeri bulunamadi." });
            }

            var normalizedMail = request.Mail.Trim().ToLowerInvariant();
            var mailExists = await _context.Workplaces
                .IgnoreQueryFilters()
                .AnyAsync(w => w.Id != id && w.Mail.ToLower() == normalizedMail);

            if (mailExists)
            {
                return Conflict(new { message = "Bu e-posta adresiyle kayitli baska bir is yeri zaten var." });
            }

            workplace.Name = request.Name.Trim();
            workplace.Address = request.Address.Trim();
            workplace.PhoneNumber = request.PhoneNumber.Trim();
            workplace.Mail = normalizedMail;
            workplace.LeaveCount = request.LeaveCount ?? DefaultLeaveCount;
            workplace.IsActive = request.IsActive;

            await _context.SaveChangesAsync();

            return Ok(ToResponse(workplace));
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            var workplace = await GetAccessibleWorkplace(id, auth.AdminId);

            if (workplace is null)
            {
                return NotFound(new { message = "Is yeri bulunamadi." });
            }

            workplace.IsActive = false;
            workplace.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private static bool HasRequiredTextFields(params string[] values)
        {
            return values.All(value => !string.IsNullOrWhiteSpace(value));
        }

        private static bool TryParseWorkplaceUserRole(string roleValue, out UserRole role)
        {
            role = default;
            var normalizedRole = roleValue.Trim().ToUpperInvariant();

            if (!Enum.TryParse(normalizedRole, ignoreCase: false, out UserRole parsedRole))
            {
                return false;
            }

            if (parsedRole is not (UserRole.EMPLOYEE or UserRole.HR))
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

        private async Task<(long AdminId, ActionResult? ErrorResult)> GetActiveAdminOrError()
        {
            if (!TryGetCurrentAdminIdFromToken(out var adminId))
            {
                return (0, Unauthorized(new { message = "Gecersiz token." }));
            }

            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Id == adminId && u.IsActive);

            if (user is null)
            {
                return (0, Unauthorized(new { message = "Gecersiz token veya pasif kullanici." }));
            }

            if (user.Role != UserRole.ADMIN)
            {
                return (0, Forbid());
            }

            return (adminId, null);
        }

        private bool TryGetCurrentAdminIdFromToken(out long adminId)
        {
            var userIdValue = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            return long.TryParse(userIdValue, out adminId);
        }

        private Task<Workplace?> GetAccessibleWorkplace(long id, long currentAdminId)
        {
            return _context.Workplaces
                .SingleOrDefaultAsync(w => w.Id == id
                    && w.UserWorkplaces.Any(uw => uw.UserId == currentAdminId));
        }

        private Task<bool> HasWorkplaceAccess(long id, long currentAdminId)
        {
            return _context.Workplaces
                .AnyAsync(w => w.Id == id && w.UserWorkplaces.Any(uw => uw.UserId == currentAdminId));
        }

        private Task<List<WorkplaceAdminResponse>> GetMappedAdmins(long workplaceId)
        {
            return _context.Users
                .Where(u => u.Role == UserRole.ADMIN
                    && u.IsActive
                    && u.UserWorkplaces.Any(uw => uw.WorkplaceId == workplaceId))
                .OrderBy(u => u.Name)
                .ThenBy(u => u.Surname)
                .Select(u => ToAdminResponse(u))
                .ToListAsync();
        }

        private static WorkplaceResponse ToResponse(Workplace workplace)
        {
            return new WorkplaceResponse
            {
                Id = workplace.Id,
                Name = workplace.Name,
                Address = workplace.Address,
                PhoneNumber = workplace.PhoneNumber,
                Mail = workplace.Mail,
                IsActive = workplace.IsActive,
                LeaveCount = workplace.LeaveCount
            };
        }

        private static WorkplaceAdminResponse ToAdminResponse(User user)
        {
            return new WorkplaceAdminResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsActive = user.IsActive
            };
        }

        private static WorkplaceUserResponse ToUserResponse(User user)
        {
            return new WorkplaceUserResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsActive = user.IsActive
            };
        }
    }
}
