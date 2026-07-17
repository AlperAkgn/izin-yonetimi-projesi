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

        public LeaveRequestsController(AppDbContext context, ILeaveDayCalculator leaveDayCalculator)
        {
            _context = context;
            _leaveDayCalculator = leaveDayCalculator;
        }

        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<LeaveRequestResponse>>> GetMyRequests()
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var requests = await _context.LeaveRequests
                .Where(request => request.UserId == userId)
                .OrderByDescending(request => request.StartDate)
                .Select(request => ToResponse(request))
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

            var requests = await query
                .OrderByDescending(request => request.StartDate)
                .Select(request => ToResponse(request))
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

            var userWorkplace = await _context.UserWorkplaces
                .SingleOrDefaultAsync(mapping => mapping.UserId == currentUser.Id && mapping.WorkplaceId == request.WorkplaceId, cancellationToken);
            if (userWorkplace is null)
            {
                return NotFound(new { message = "Is yeri bulunamadi veya bu is yerine erisiminiz yok." });
            }

            var overlapsExistingRequest = await _context.LeaveRequests
                .AnyAsync(existingRequest => existingRequest.UserId == currentUser.Id
                    && existingRequest.WorkplaceId == request.WorkplaceId
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

            var rejectionReason = await GetAnnualLeaveLimitExceededReasonAsync(
                currentUser.Id,
                request.WorkplaceId,
                userWorkplace.AnnualLeaveCount,
                startDate,
                endDate,
                null,
                cancellationToken);

            var leaveRequest = new LeaveRequest
            {
                UserId = currentUser.Id,
                WorkplaceId = request.WorkplaceId,
                LeaveType = request.LeaveType,
                StartDate = startDate,
                EndDate = endDate,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                EmergencyContact = string.IsNullOrWhiteSpace(request.EmergencyContact) ? null : request.EmergencyContact.Trim(),
                Status = rejectionReason is null ? LeaveStatus.PENDING : LeaveStatus.REJECTED,
                ChargedLeaveDays = 0,
                RejectionReason = rejectionReason
            };

            _context.LeaveRequests.Add(leaveRequest);
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequest = leaveRequest,
                ActionByUserId = currentUser.Id,
                ActionType = rejectionReason is null ? AuditActionType.CREATED : AuditActionType.REJECTED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);

            return Created($"/api/leave-requests/{leaveRequest.Id}", ToResponse(leaveRequest));
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

                return Ok(ToResponse(leaveRequest));
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

            return Ok(ToResponse(leaveRequest));
        }

        [HttpPost("{id:long}/reject")]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<ActionResult<LeaveRequestResponse>> Reject(long id, CancellationToken cancellationToken)
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

            var requestUpdated = await _context.LeaveRequests
                .Where(request => request.Id == leaveRequest.Id && request.Status == LeaveStatus.PENDING)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(request => request.Status, LeaveStatus.REJECTED), cancellationToken);
            if (requestUpdated == 0)
            {
                return Conflict(new { message = "Izin talebinin durumu degisti. Sayfayi yenileyip tekrar deneyin." });
            }

            leaveRequest.Status = LeaveStatus.REJECTED;
            _context.Entry(leaveRequest).State = EntityState.Detached;
            _context.LeaveRequestAudits.Add(new LeaveRequestAudit
            {
                LeaveRequestId = leaveRequest.Id,
                ActionByUserId = currentUser.Id,
                ActionType = AuditActionType.REJECTED,
                ActionAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(ToResponse(leaveRequest));
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
                    .SetProperty(request => request.Status, LeaveStatus.CANCELLED), cancellationToken);
            if (requestUpdated == 0)
            {
                return Conflict(new { message = "Izin talebinin durumu degisti. Sayfayi yenileyip tekrar deneyin." });
            }

            leaveRequest.Status = LeaveStatus.CANCELLED;
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

            return Ok(ToResponse(leaveRequest));
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return null;
            }

            return await _context.Users.SingleOrDefaultAsync(user => user.Id == userId && user.IsActive);
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

        private static LeaveRequestResponse ToResponse(LeaveRequest leaveRequest)
        {
            return new LeaveRequestResponse
            {
                Id = leaveRequest.Id,
                UserId = leaveRequest.UserId,
                WorkplaceId = leaveRequest.WorkplaceId,
                LeaveType = leaveRequest.LeaveType.ToString(),
                StartDate = leaveRequest.StartDate,
                EndDate = leaveRequest.EndDate,
                Description = leaveRequest.Description,
                EmergencyContact = leaveRequest.EmergencyContact,
                Status = leaveRequest.Status.ToString(),
                ChargedLeaveDays = leaveRequest.ChargedLeaveDays,
                RejectionReason = leaveRequest.RejectionReason
            };
        }
    }
}
