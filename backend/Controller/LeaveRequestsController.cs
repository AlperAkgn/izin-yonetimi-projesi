using System.IdentityModel.Tokens.Jwt;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Enums;
using LeaveManagementAPI.Models.LeaveRequests;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LeaveRequestsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILeaveDayCalculator _leaveDayCalculator;
        private readonly IMailService _mailService;
        private readonly ILogger<LeaveRequestsController> _logger;

        public LeaveRequestsController(
            AppDbContext context,
            ILeaveDayCalculator leaveDayCalculator,
            IMailService mailService,
            ILogger<LeaveRequestsController> logger)
        {
            _context = context;
            _leaveDayCalculator = leaveDayCalculator;
            _mailService = mailService;
            _logger = logger;
        }

        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<LeaveRequestResponse>>> GetMyRequests()
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var requests = await ProjectToResponse(_context.LeaveRequests
                .Where(request => request.UserId == userId)
                .OrderByDescending(request => request.StartDate))
                .ToListAsync();

            return Ok(requests);
        }

        [HttpGet("workplaces/{workplaceId:long}")]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<ActionResult<IEnumerable<LeaveRequestResponse>>> GetWorkplaceRequests(long workplaceId)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            if (!await CanAccessWorkplaceRequestsAsync(currentUser, workplaceId))
            {
                return Forbid();
            }

            var query = _context.LeaveRequests
                .Where(request => request.WorkplaceId == workplaceId);

            if (currentUser.Role == UserRole.HR)
            {
                query = query.Where(request => request.UserId != currentUser.Id
                    && request.User.Role == UserRole.EMPLOYEE);
            }

            var requests = await ProjectToResponse(query
                .OrderByDescending(request => request.StartDate))
                .ToListAsync();

            return Ok(requests);
        }

        [HttpPost]
        public async Task<ActionResult<LeaveRequestResponse>> Create(
            CreateLeaveRequest request,
            CancellationToken cancellationToken)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var startDate = NormalizeDate(request.StartDate);
            var endDate = NormalizeDate(request.EndDate);
            if (endDate < startDate)
            {
                return BadRequest(new { message = "Bitis tarihi baslangic tarihinden once olamaz." });
            }

            if (string.IsNullOrWhiteSpace(request.LeaveAddress))
            {
                return BadRequest(new { message = "Izinde bulunulacak adres zorunludur." });
            }

            var userWorkplace = await GetSingleWorkplaceAssignmentAsync(currentUser.Id, cancellationToken);
            if (userWorkplace is null)
            {
                return BadRequest(new { message = "Kullanici icin tek bir aktif is yeri bulunamadi." });
            }

            var overlapsExistingRequest = await _context.LeaveRequests
                .AnyAsync(existingRequest => existingRequest.UserId == currentUser.Id
                    && existingRequest.WorkplaceId == userWorkplace.WorkplaceId
                    && (existingRequest.Status == LeaveStatus.PENDING || existingRequest.Status == LeaveStatus.APPROVED)
                    && existingRequest.StartDate <= endDate
                    && existingRequest.EndDate >= startDate,
                    cancellationToken);
            if (overlapsExistingRequest)
            {
                return Conflict(new { message = "Bu tarih araliginda bekleyen veya onaylanmis bir izin talebiniz var." });
            }

            var chargeableDaysByYear = await _leaveDayCalculator.CalculateChargeableDaysByYearAsync(
                startDate,
                endDate,
                cancellationToken);
            if (chargeableDaysByYear.Count == 0)
            {
                return BadRequest(new { message = "Secilen tarih araliginda izin hakkindan dusecek is gunu yok." });
            }

            var isEmergencyLeave = request.LeaveType == LeaveType.EMERGENCY;
            var chargeableDays = chargeableDaysByYear.Values.Sum();
            var rejectionReason = isEmergencyLeave
                ? null
                : await GetAnnualLeaveLimitExceededReasonAsync(
                    currentUser.Id,
                    userWorkplace.WorkplaceId,
                    userWorkplace.AnnualLeaveCount,
                    startDate,
                    endDate,
                    null,
                    cancellationToken);

            var leaveRequest = new LeaveRequest
            {
                UserId = currentUser.Id,
                WorkplaceId = userWorkplace.WorkplaceId,
                LeaveType = request.LeaveType,
                StartDate = startDate,
                EndDate = endDate,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                EmergencyContact = string.IsNullOrWhiteSpace(request.EmergencyContact) ? null : request.EmergencyContact.Trim(),
                LeaveAddress = request.LeaveAddress.Trim(),
                Status = rejectionReason is not null
                    ? LeaveStatus.REJECTED
                    : isEmergencyLeave ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
                ChargedLeaveDays = isEmergencyLeave ? chargeableDays : 0,
                RejectionReason = rejectionReason
            };

            _context.LeaveRequests.Add(leaveRequest);
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequest = leaveRequest,
                ActionByUserId = currentUser.Id,
                ActionType = rejectionReason is not null
                    ? AuditActionType.REJECTED
                    : isEmergencyLeave ? AuditActionType.APPROVED : AuditActionType.CREATED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);

            if (isEmergencyLeave)
            {
                await NotifyEmergencyLeaveApprovedAsync(leaveRequest, currentUser, cancellationToken);
            }

            return Created(
                $"/api/leave-requests/{leaveRequest.Id}",
                await ToResponseAsync(leaveRequest.Id, cancellationToken));
        }

        // An administrator may create a leave record for an existing employee.
        // The employee is identified by the unique e-mail address rather than by
        // client-supplied personal details, so a request cannot be assigned to an
        // arbitrary identity.
        [HttpPost("on-behalf")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<LeaveRequestResponse>> CreateOnBehalf(
            CreateLeaveRequestOnBehalfRequest request,
            CancellationToken cancellationToken)
        {
            var admin = await GetCurrentUserAsync();
            if (admin is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            if (string.IsNullOrWhiteSpace(request.EmployeeMail))
            {
                return BadRequest(new { message = "Calisan e-posta adresi zorunludur." });
            }

            var normalizedMail = request.EmployeeMail.Trim().ToLowerInvariant();
            var employee = await _context.Users.SingleOrDefaultAsync(
                user => user.Mail.ToLower() == normalizedMail && user.IsActive,
                cancellationToken);
            if (employee is null || employee.Role != UserRole.EMPLOYEE)
            {
                return NotFound(new { message = "Bu e-posta adresiyle aktif bir calisan bulunamadi." });
            }

            var startDate = NormalizeDate(request.StartDate);
            var endDate = NormalizeDate(request.EndDate);
            if (endDate < startDate)
            {
                return BadRequest(new { message = "Bitis tarihi baslangic tarihinden once olamaz." });
            }

            if (string.IsNullOrWhiteSpace(request.LeaveAddress))
            {
                return BadRequest(new { message = "Izinde bulunulacak adres zorunludur." });
            }

            var userWorkplace = await GetSingleWorkplaceAssignmentAsync(employee.Id, cancellationToken);
            if (userWorkplace is null)
            {
                return BadRequest(new { message = "Calisan icin tek bir aktif is yeri bulunamadi." });
            }

            var overlapsExistingRequest = await _context.LeaveRequests.AnyAsync(existingRequest =>
                existingRequest.UserId == employee.Id
                && existingRequest.WorkplaceId == userWorkplace.WorkplaceId
                && (existingRequest.Status == LeaveStatus.PENDING || existingRequest.Status == LeaveStatus.APPROVED)
                && existingRequest.StartDate <= endDate
                && existingRequest.EndDate >= startDate,
                cancellationToken);
            if (overlapsExistingRequest)
            {
                return Conflict(new { message = "Calisanin bu tarih araliginda bekleyen veya onaylanmis bir izin talebi var." });
            }

            var chargeableDaysByYear = await _leaveDayCalculator.CalculateChargeableDaysByYearAsync(
                startDate, endDate, cancellationToken);
            if (chargeableDaysByYear.Count == 0)
            {
                return BadRequest(new { message = "Secilen tarih araliginda izin hakkindan dusecek is gunu yok." });
            }

            var chargeableDays = chargeableDaysByYear.Values.Sum();
            var isEmergencyLeave = request.LeaveType == LeaveType.EMERGENCY;
            var rejectionReason = isEmergencyLeave
                ? null
                : await GetAnnualLeaveLimitExceededReasonAsync(
                    employee.Id, userWorkplace.WorkplaceId, userWorkplace.AnnualLeaveCount,
                    startDate, endDate, null, cancellationToken);

            var leaveRequest = new LeaveRequest
            {
                UserId = employee.Id,
                WorkplaceId = userWorkplace.WorkplaceId,
                LeaveType = request.LeaveType,
                StartDate = startDate,
                EndDate = endDate,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                EmergencyContact = string.IsNullOrWhiteSpace(request.EmergencyContact) ? null : request.EmergencyContact.Trim(),
                LeaveAddress = request.LeaveAddress.Trim(),
                // Admin tarafindan kaydedilen izin, hak limiti uygunsa dogrudan onaylanir.
                Status = rejectionReason is null ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
                ChargedLeaveDays = rejectionReason is null ? chargeableDays : 0,
                RejectionReason = rejectionReason
            };

            _context.LeaveRequests.Add(leaveRequest);
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequest = leaveRequest,
                ActionByUserId = admin.Id,
                ActionType = rejectionReason is null ? AuditActionType.APPROVED : AuditActionType.REJECTED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);

            if (request.LeaveType == LeaveType.EMERGENCY && rejectionReason is null)
            {
                await NotifyEmergencyLeaveApprovedAsync(leaveRequest, employee, cancellationToken);
            }

            return Created(
                $"/api/leave-requests/{leaveRequest.Id}",
                await ToResponseAsync(leaveRequest.Id, cancellationToken));
        }

        [HttpPost("{id:long}/approve")]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<ActionResult<LeaveRequestResponse>> Approve(long id, CancellationToken cancellationToken)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            var leaveRequest = await _context.LeaveRequests
                .SingleOrDefaultAsync(request => request.Id == id, cancellationToken);
            if (leaveRequest is null)
            {
                return NotFound(new { message = "Izin talebi bulunamadi." });
            }

            if (currentUser.Role == UserRole.HR && leaveRequest.UserId == currentUser.Id)
            {
                return BadRequest(new { message = "HR kendi izin talebini onaylayamaz." });
            }

            if (!await CanDecideLeaveRequestAsync(currentUser, leaveRequest))
            {
                return Forbid();
            }

            if (leaveRequest.Status != LeaveStatus.PENDING)
            {
                return BadRequest(new { message = "Yalnizca bekleyen izin talepleri onaylanabilir." });
            }

            var chargeableDaysByYear = await _leaveDayCalculator.CalculateChargeableDaysByYearAsync(
                leaveRequest.StartDate,
                leaveRequest.EndDate,
                cancellationToken);
            var chargeableDays = chargeableDaysByYear.Values.Sum();
            if (chargeableDays == 0)
            {
                return BadRequest(new { message = "Izin talebinde izin hakkindan dusecek is gunu yok." });
            }

            var userWorkplace = await _context.UserWorkplaces
                .SingleOrDefaultAsync(mapping => mapping.UserId == leaveRequest.UserId
                    && mapping.WorkplaceId == leaveRequest.WorkplaceId, cancellationToken);
            if (userWorkplace is null)
            {
                return BadRequest(new { message = "Kullanicinin bu is yeri icin yillik izin hakki bulunamadi." });
            }

            var rejectionReason = await GetAnnualLeaveLimitExceededReasonAsync(
                leaveRequest.UserId,
                leaveRequest.WorkplaceId,
                userWorkplace.AnnualLeaveCount,
                leaveRequest.StartDate,
                leaveRequest.EndDate,
                leaveRequest.Id,
                cancellationToken);
            if (rejectionReason is not null)
            {
                var rejectedRequestUpdated = await _context.LeaveRequests
                    .Where(request => request.Id == leaveRequest.Id && request.Status == LeaveStatus.PENDING)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(request => request.Status, LeaveStatus.REJECTED)
                        .SetProperty(request => request.RejectionReason, rejectionReason), cancellationToken);
                if (rejectedRequestUpdated == 0)
                {
                    return Conflict(new { message = "Izin talebinin durumu degisti. Sayfayi yenileyip tekrar deneyin." });
                }

                leaveRequest.Status = LeaveStatus.REJECTED;
                leaveRequest.RejectionReason = rejectionReason;
                _context.Entry(leaveRequest).State = EntityState.Detached;
                _context.LeaveRequestAudits.Add(new LeaveRequestAudit
                {
                    LeaveRequestId = leaveRequest.Id,
                    ActionByUserId = currentUser.Id,
                    ActionType = AuditActionType.REJECTED,
                    ActionAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(await ToResponseAsync(leaveRequest.Id, cancellationToken));
            }

            var requestUpdated = await _context.LeaveRequests
                .Where(request => request.Id == leaveRequest.Id && request.Status == LeaveStatus.PENDING)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(request => request.Status, LeaveStatus.APPROVED)
                    .SetProperty(request => request.ChargedLeaveDays, chargeableDays)
                    .SetProperty(request => request.RejectionReason, (string?)null), cancellationToken);
            if (requestUpdated == 0)
            {
                return Conflict(new { message = "Izin talebinin durumu degisti. Sayfayi yenileyip tekrar deneyin." });
            }

            leaveRequest.Status = LeaveStatus.APPROVED;
            leaveRequest.ChargedLeaveDays = chargeableDays;
            leaveRequest.RejectionReason = null;
            _context.Entry(leaveRequest).State = EntityState.Detached;
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequestId = leaveRequest.Id,
                ActionByUserId = currentUser.Id,
                ActionType = AuditActionType.APPROVED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(await ToResponseAsync(leaveRequest.Id, cancellationToken));
        }

        [HttpPost("{id:long}/reject")]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<ActionResult<LeaveRequestResponse>> Reject(
            long id,
            RejectLeaveRequest request,
            CancellationToken cancellationToken)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var leaveRequest = await _context.LeaveRequests
                .SingleOrDefaultAsync(request => request.Id == id, cancellationToken);
            if (leaveRequest is null)
            {
                return NotFound(new { message = "Izin talebi bulunamadi." });
            }

            if (currentUser.Role == UserRole.HR && leaveRequest.UserId == currentUser.Id)
            {
                return BadRequest(new { message = "HR kendi izin talebini reddedemez." });
            }

            if (!await CanDecideLeaveRequestAsync(currentUser, leaveRequest))
            {
                return Forbid();
            }

            if (leaveRequest.Status != LeaveStatus.PENDING)
            {
                return BadRequest(new { message = "Yalnizca bekleyen izin talepleri reddedilebilir." });
            }

            var rejectionReason = string.IsNullOrWhiteSpace(request.RejectionReason)
                ? null
                : request.RejectionReason.Trim();

            var requestUpdated = await _context.LeaveRequests
                .Where(request => request.Id == leaveRequest.Id && request.Status == LeaveStatus.PENDING)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(request => request.Status, LeaveStatus.REJECTED)
                    .SetProperty(request => request.RejectionReason, rejectionReason), cancellationToken);
            if (requestUpdated == 0)
            {
                return Conflict(new { message = "Izin talebinin durumu degisti. Sayfayi yenileyip tekrar deneyin." });
            }

            leaveRequest.Status = LeaveStatus.REJECTED;
            leaveRequest.RejectionReason = rejectionReason;
            _context.Entry(leaveRequest).State = EntityState.Detached;
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequestId = leaveRequest.Id,
                ActionByUserId = currentUser.Id,
                ActionType = AuditActionType.REJECTED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(await ToResponseAsync(leaveRequest.Id, cancellationToken));
        }

        [HttpPost("{id:long}/cancel")]
        public async Task<ActionResult<LeaveRequestResponse>> Cancel(long id, CancellationToken cancellationToken)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            var leaveRequest = await _context.LeaveRequests
                .SingleOrDefaultAsync(request => request.Id == id && request.UserId == currentUser.Id, cancellationToken);
            if (leaveRequest is null)
            {
                return NotFound(new { message = "Izin talebi bulunamadi." });
            }

            if (leaveRequest.Status is not (LeaveStatus.PENDING or LeaveStatus.APPROVED))
            {
                return BadRequest(new { message = "Bu izin talebi iptal edilemez." });
            }

            var previousStatus = leaveRequest.Status;
            var requestUpdated = await _context.LeaveRequests
                .Where(request => request.Id == leaveRequest.Id && request.Status == previousStatus)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(request => request.Status, LeaveStatus.CANCELLED)
                    .SetProperty(request => request.RejectionReason, (string?)null), cancellationToken);
            if (requestUpdated == 0)
            {
                return Conflict(new { message = "Izin talebinin durumu degisti. Sayfayi yenileyip tekrar deneyin." });
            }

            leaveRequest.Status = LeaveStatus.CANCELLED;
            leaveRequest.RejectionReason = null;
            _context.Entry(leaveRequest).State = EntityState.Detached;
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequestId = leaveRequest.Id,
                ActionByUserId = currentUser.Id,
                ActionType = AuditActionType.CANCELLED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(await ToResponseAsync(leaveRequest.Id, cancellationToken));
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return null;
            }

            return await _context.Users.SingleOrDefaultAsync(user => user.Id == userId && user.IsActive);
        }

        private async Task<UserWorkplace?> GetSingleWorkplaceAssignmentAsync(
            long userId,
            CancellationToken cancellationToken)
        {
            var assignments = await _context.UserWorkplaces
                .Where(mapping => mapping.UserId == userId && mapping.Workplace.IsActive)
                .OrderBy(mapping => mapping.WorkplaceId)
                .Take(2)
                .ToListAsync(cancellationToken);

            return assignments.Count == 1 ? assignments[0] : null;
        }

        private async Task<bool> CanAccessWorkplaceRequestsAsync(User currentUser, long workplaceId)
        {
            if (currentUser.Role == UserRole.ADMIN)
            {
                return true;
            }

            if (currentUser.Role != UserRole.HR)
            {
                return false;
            }

            return await _context.UserWorkplaces
                .AnyAsync(mapping => mapping.UserId == currentUser.Id && mapping.WorkplaceId == workplaceId);
        }

        private async Task<bool> CanDecideLeaveRequestAsync(User currentUser, LeaveRequest leaveRequest)
        {
            if (currentUser.Role == UserRole.ADMIN)
            {
                return true;
            }

            if (currentUser.Role != UserRole.HR
                || leaveRequest.UserId == currentUser.Id
                || !await CanAccessWorkplaceRequestsAsync(currentUser, leaveRequest.WorkplaceId))
            {
                return false;
            }

            return await _context.Users
                .AnyAsync(user => user.Id == leaveRequest.UserId && user.Role == UserRole.EMPLOYEE);
        }

        private bool TryGetCurrentUserId(out long userId)
        {
            var userIdValue = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            return long.TryParse(userIdValue, out userId);
        }

        private static DateTime NormalizeDate(DateTime date)
        {
            return DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        }

        private async Task NotifyEmergencyLeaveApprovedAsync(
            LeaveRequest leaveRequest,
            User employee,
            CancellationToken cancellationToken)
        {
            var workplace = await _context.Workplaces
                .SingleAsync(item => item.Id == leaveRequest.WorkplaceId, cancellationToken);
            var recipients = await _context.Users
                .Where(user => user.IsActive
                    && (user.Role == UserRole.ADMIN
                        || (user.Role == UserRole.HR && user.UserWorkplaces
                            .Any(mapping => mapping.WorkplaceId == leaveRequest.WorkplaceId))))
                .Select(user => new { user.Mail, Name = user.Name + " " + user.Surname })
                .ToListAsync(cancellationToken);

            foreach (var recipient in recipients
                .Where(item => !string.IsNullOrWhiteSpace(item.Mail))
                .DistinctBy(item => item.Mail.Trim(), StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    await _mailService.SendEmergencyLeaveApprovedAsync(
                        recipient.Mail,
                        recipient.Name,
                        $"{employee.Name} {employee.Surname}",
                        workplace.Name,
                        leaveRequest.StartDate,
                        leaveRequest.EndDate,
                        leaveRequest.Description,
                        cancellationToken);
                }
                catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
                {
                    _logger.LogError(exception,
                        "Acil izin {LeaveRequestId} için {RecipientMail} adresine bildirim gönderilemedi.",
                        leaveRequest.Id,
                        recipient.Mail);
                }
            }
        }

        private async Task<string?> GetAnnualLeaveLimitExceededReasonAsync(
            long userId,
            long workplaceId,
            int annualLeaveCount,
            DateTime requestedStartDate,
            DateTime requestedEndDate,
            long? excludedLeaveRequestId,
            CancellationToken cancellationToken)
        {
            var requestedDaysByYear = await _leaveDayCalculator.CalculateChargeableDaysByYearAsync(
                requestedStartDate,
                requestedEndDate,
                cancellationToken);
            if (requestedDaysByYear.Count == 0)
            {
                return null;
            }

            var firstYear = requestedDaysByYear.Keys.Min();
            var lastYear = requestedDaysByYear.Keys.Max();
            var periodStart = new DateTime(firstYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var periodEnd = new DateTime(lastYear, 12, 31, 0, 0, 0, DateTimeKind.Utc);
            var approvedRequests = await _context.LeaveRequests
                .Where(request => request.UserId == userId
                    && request.WorkplaceId == workplaceId
                    && request.Status == LeaveStatus.APPROVED
                    && (excludedLeaveRequestId == null || request.Id != excludedLeaveRequestId)
                    && request.StartDate <= periodEnd
                    && request.EndDate >= periodStart)
                .Select(request => new { request.StartDate, request.EndDate })
                .ToListAsync(cancellationToken);

            foreach (var requestedDays in requestedDaysByYear)
            {
                var yearStart = new DateTime(requestedDays.Key, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var yearEnd = new DateTime(requestedDays.Key, 12, 31, 0, 0, 0, DateTimeKind.Utc);
                var usedDays = 0;

                foreach (var approvedRequest in approvedRequests)
                {
                    var requestStart = approvedRequest.StartDate > yearStart ? approvedRequest.StartDate : yearStart;
                    var requestEnd = approvedRequest.EndDate < yearEnd ? approvedRequest.EndDate : yearEnd;
                    var usedDaysByYear = await _leaveDayCalculator.CalculateChargeableDaysByYearAsync(
                        requestStart,
                        requestEnd,
                        cancellationToken);
                    usedDays += usedDaysByYear.GetValueOrDefault(requestedDays.Key);
                }

                var projectedUsedDays = usedDays + requestedDays.Value;
                if (projectedUsedDays > annualLeaveCount)
                {
                    return $"{requestedDays.Key} yili icin {usedDays} gun izin kullandiniz. " +
                           $"Bu taleple toplam {projectedUsedDays} gun olur; yillik izin hakkiniz {annualLeaveCount} gun.";
                }
            }

            return null;
        }

        /// <summary>
        /// Talep sahibinin adi, is yeri adi ve yillik izin hakki gibi ekranda
        /// gereken alanlari tek sorguda dolduran ortak projeksiyon.
        /// </summary>
        private static IQueryable<LeaveRequestResponse> ProjectToResponse(IQueryable<LeaveRequest> query)
        {
            return query.Select(request => new LeaveRequestResponse
            {
                Id = request.Id,
                UserId = request.UserId,
                WorkplaceId = request.WorkplaceId,
                UserName = request.User.Name,
                UserSurname = request.User.Surname,
                WorkplaceName = request.Workplace.Name,
                UserAnnualLeaveCount = request.User.UserWorkplaces
                    .Where(mapping => mapping.WorkplaceId == request.WorkplaceId)
                    .Select(mapping => (int?)mapping.AnnualLeaveCount)
                    .FirstOrDefault(),
                LeaveType = request.LeaveType.ToString(),
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                Description = request.Description,
                EmergencyContact = request.EmergencyContact,
                LeaveAddress = request.LeaveAddress,
                Status = request.Status.ToString(),
                ChargedLeaveDays = request.ChargedLeaveDays,
                RejectionReason = request.RejectionReason,
                CreatedByAdmin = (request.Audits
                    .OrderBy(audit => audit.ActionAt)
                    .ThenBy(audit => audit.Id)
                    .Select(audit => (long?)audit.ActionByUserId)
                    .FirstOrDefault() ?? request.UserId) != request.UserId,
                ProcessedAt = request.Audits
                    .Where(audit => audit.ActionType != AuditActionType.CREATED)
                    .OrderByDescending(audit => audit.ActionAt)
                    .Select(audit => (DateTime?)audit.ActionAt)
                    .FirstOrDefault()
            });
        }

        /// <summary>Tek bir talebi, listelerle ayni zengin bicimde dondurur.</summary>
        private Task<LeaveRequestResponse> ToResponseAsync(long leaveRequestId, CancellationToken cancellationToken)
        {
            return ProjectToResponse(_context.LeaveRequests.Where(request => request.Id == leaveRequestId))
                .SingleAsync(cancellationToken);
        }
    }
}
