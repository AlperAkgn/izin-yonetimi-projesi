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

        /// <summary>Yoneticinin erisebildigi, soft-delete edilmis is yerleri.</summary>
        [HttpGet("deleted")]
        public async Task<ActionResult<IEnumerable<WorkplaceResponse>>> GetDeleted()
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            var workplaces = await _context.Workplaces
                .IgnoreQueryFilters()
                .Where(w => w.DeletedAt != null && w.UserWorkplaces.Any(uw => uw.UserId == auth.AdminId))
                .OrderByDescending(w => w.DeletedAt)
                .ToListAsync();

            return Ok(workplaces.Select(workplace =>
            {
                var response = ToResponse(workplace);
                response.DeletedAt = workplace.DeletedAt;
                return response;
            }));
        }

        /// <summary>Is yerine atanmis (yonetici olmayan) kullanicilar; pasifler de doner.</summary>
        [HttpGet("{id:long}/users")]
        public async Task<ActionResult<IEnumerable<WorkplaceUserResponse>>> GetUsers(long id)
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

            var users = await _context.UserWorkplaces
                .Where(mapping => mapping.WorkplaceId == id && mapping.User.Role != UserRole.ADMIN)
                .OrderBy(mapping => mapping.User.Role)
                .ThenBy(mapping => mapping.User.Name)
                .ThenBy(mapping => mapping.User.Surname)
                .Select(mapping => new WorkplaceUserResponse
                {
                    Id = mapping.User.Id,
                    Mail = mapping.User.Mail,
                    Phone = mapping.User.Phone,
                    Name = mapping.User.Name,
                    Surname = mapping.User.Surname,
                    Role = mapping.User.Role.ToString(),
                    IsActive = mapping.User.IsActive,
                    AnnualLeaveCount = mapping.AnnualLeaveCount
                })
                .ToListAsync();

            return Ok(users);
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

            var workplace = await GetAccessibleWorkplace(id, auth.AdminId);
            if (workplace is null)
            {
                return NotFound(new { message = "Is yeri bulunamadi." });
            }

            if (string.IsNullOrWhiteSpace(request.Mail)
                || string.IsNullOrWhiteSpace(request.Phone)
                || string.IsNullOrWhiteSpace(request.Name)
                || string.IsNullOrWhiteSpace(request.Surname))
            {
                return BadRequest(new { message = "Mail, phone, name ve surname alanlari bos olamaz." });
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

            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);

                _context.UserWorkplaces.Add(new UserWorkplace
                {
                    UserId = user.Id,
                    WorkplaceId = id,
                    AnnualLeaveCount = request.AnnualLeaveCount ?? workplace.LeaveCount
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

            return Created(
                $"/api/workplaces/{id}/users/{user.Id}",
                ToUserResponse(user, request.AnnualLeaveCount ?? workplace.LeaveCount));
        }

        [HttpPut("{id:long}/users/{userId:long}/annual-leave-count")]
        public async Task<ActionResult<WorkplaceUserResponse>> UpdateUserAnnualLeaveCount(
            long id,
            long userId,
            UpdateWorkplaceUserLeaveCountRequest request,
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

            var userWorkplace = await _context.UserWorkplaces
                .Include(mapping => mapping.User)
                .SingleOrDefaultAsync(mapping => mapping.UserId == userId && mapping.WorkplaceId == id, cancellationToken);
            if (userWorkplace is null || !userWorkplace.User.IsActive)
            {
                return NotFound(new { message = "Kullanici bu is yerinde bulunamadi." });
            }

            userWorkplace.AnnualLeaveCount = request.AnnualLeaveCount;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(ToUserResponse(userWorkplace.User, userWorkplace.AnnualLeaveCount));
        }

        [HttpPut("{id:long}/users/{userId:long}/move")]
        public async Task<ActionResult<WorkplaceUserResponse>> MoveUser(
            long id,
            long userId,
            MoveWorkplaceUserRequest request,
            CancellationToken cancellationToken)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            if (id == request.TargetWorkplaceId)
            {
                return BadRequest(new { message = "Hedef is yeri kaynak is yeriyle ayni olamaz." });
            }

            if (!await HasWorkplaceAccess(id, auth.AdminId)
                || !await HasWorkplaceAccess(request.TargetWorkplaceId, auth.AdminId))
            {
                return NotFound(new { message = "Kaynak veya hedef is yerine erisiminiz yok." });
            }

            var sourceAssignment = await _context.UserWorkplaces
                .Include(mapping => mapping.User)
                .SingleOrDefaultAsync(mapping => mapping.UserId == userId && mapping.WorkplaceId == id, cancellationToken);
            if (sourceAssignment is null || !sourceAssignment.User.IsActive)
            {
                return NotFound(new { message = "Kullanici kaynak is yerinde bulunamadi." });
            }

            if (sourceAssignment.User.Role == UserRole.ADMIN)
            {
                return BadRequest(new { message = "Yonetici is yeri atamasi bu endpoint ile tasinamaz." });
            }

            var targetWorkplaceIsActive = await _context.Workplaces
                .AnyAsync(workplace => workplace.Id == request.TargetWorkplaceId && workplace.IsActive, cancellationToken);
            if (!targetWorkplaceIsActive)
            {
                return NotFound(new { message = "Hedef is yeri aktif degil veya bulunamadi." });
            }

            var alreadyAssigned = await _context.UserWorkplaces.AnyAsync(
                mapping => mapping.UserId == userId && mapping.WorkplaceId == request.TargetWorkplaceId,
                cancellationToken);
            if (alreadyAssigned)
            {
                return Conflict(new { message = "Kullanici zaten hedef is yerine atanmis." });
            }

            var annualLeaveCount = sourceAssignment.AnnualLeaveCount;
            var user = sourceAssignment.User;
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            _context.UserWorkplaces.Remove(sourceAssignment);
            _context.UserWorkplaces.Add(new UserWorkplace
            {
                UserId = userId,
                WorkplaceId = request.TargetWorkplaceId,
                AnnualLeaveCount = annualLeaveCount
            });
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(ToUserResponse(user, annualLeaveCount));
        }

        [HttpDelete("{id:long}/users/{userId:long}")]
        public async Task<IActionResult> RemoveUser(long id, long userId, CancellationToken cancellationToken)
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

            var userWorkplace = await _context.UserWorkplaces
                .Include(mapping => mapping.User)
                .SingleOrDefaultAsync(mapping => mapping.WorkplaceId == id && mapping.UserId == userId, cancellationToken);
            if (userWorkplace is null)
            {
                return NotFound(new { message = "Kullanici bu is yerinde bulunamadi." });
            }

            if (userWorkplace.User.Role == UserRole.ADMIN)
            {
                return BadRequest(new { message = "Yonetici is yeri atamasi bu endpoint ile kaldirilamaz." });
            }

            _context.UserWorkplaces.Remove(userWorkplace);
            await _context.SaveChangesAsync(cancellationToken);
            return NoContent();
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
                request.City,
                request.PhoneNumber,
                request.Mail))
            {
                return BadRequest(new { message = "Name, address, city, phoneNumber ve mail alanlari bos olamaz." });
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
                City = request.City.Trim(),
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
                WorkplaceId = workplace.Id,
                AnnualLeaveCount = workplace.LeaveCount
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
                request.City,
                request.PhoneNumber,
                request.Mail))
            {
                return BadRequest(new { message = "Name, address, city, phoneNumber ve mail alanlari bos olamaz." });
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
            workplace.City = request.City.Trim();
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

        [HttpPost("{id:long}/restore")]
        public async Task<ActionResult<WorkplaceResponse>> Restore(long id, CancellationToken cancellationToken)
        {
            var auth = await GetActiveAdminOrError();
            if (auth.ErrorResult is not null)
            {
                return auth.ErrorResult;
            }

            var workplace = await _context.Workplaces
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(workplace => workplace.Id == id
                    && workplace.UserWorkplaces.Any(mapping => mapping.UserId == auth.AdminId), cancellationToken);
            if (workplace is null)
            {
                return NotFound(new { message = "Silinmis is yeri bulunamadi." });
            }

            if (workplace.DeletedAt is null)
            {
                return BadRequest(new { message = "Is yeri silinmis durumda degil." });
            }

            workplace.DeletedAt = null;
            workplace.IsActive = true;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(ToResponse(workplace));
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
                City = workplace.City,
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
                Phone = user.Phone,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsActive = user.IsActive
            };
        }

        private static WorkplaceUserResponse ToUserResponse(User user, int annualLeaveCount)
        {
            return new WorkplaceUserResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Phone = user.Phone,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsActive = user.IsActive,
                AnnualLeaveCount = annualLeaveCount
            };
        }
    }
}
