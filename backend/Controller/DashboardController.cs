using System.IdentityModel.Tokens.Jwt;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Enums;
using LeaveManagementAPI.Models.Dashboard;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/dashboard")]
    [Authorize(Roles = "ADMIN,HR")]
    public class DashboardController(
        AppDbContext context,
        IRealtimePresenceService presenceService) : ControllerBase
    {
        /// <summary>Kurum ici limit — kalan izni bu gun sayisi ve altinda olan personel kritik sayilir.</summary>
        private const int CriticalLeaveBalanceThreshold = 5;

        [HttpGet]
        public async Task<ActionResult<DashboardResponse>> Get(
            [FromQuery] long? workplaceId,
            CancellationToken cancellationToken)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            var currentUser = await context.Users.SingleOrDefaultAsync(
                user => user.Id == userId && user.IsActive, cancellationToken);
            if (currentUser is null)
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            if (currentUser.Role == UserRole.HR)
            {
                var hrDashboard = await BuildHrDashboardAsync(
                    currentUser.Id,
                    $"{currentUser.Name} {currentUser.Surname}".Trim(),
                    workplaceId,
                    cancellationToken);
                if (hrDashboard is null)
                {
                    return NotFound(new { message = "Erisilebilir aktif is yeri bulunamadi." });
                }

                return Ok(new DashboardResponse
                {
                    Role = UserRole.HR.ToString(),
                    Hr = hrDashboard
                });
            }

            if (currentUser.Role == UserRole.ADMIN)
            {
                return Ok(new DashboardResponse
                {
                    Role = UserRole.ADMIN.ToString(),
                    Admin = await BuildAdminDashboardAsync(cancellationToken)
                });
            }

            return Forbid();
        }

        private async Task<HrDashboardResponse?> BuildHrDashboardAsync(
            long hrUserId,
            string hrName,
            long? requestedWorkplaceId,
            CancellationToken cancellationToken)
        {
            var workplaceQuery = context.Workplaces.Where(workplace => workplace.IsActive
                && workplace.UserWorkplaces.Any(mapping => mapping.UserId == hrUserId));

            if (requestedWorkplaceId is not null)
            {
                workplaceQuery = workplaceQuery.Where(item => item.Id == requestedWorkplaceId);
            }

            var workplace = await workplaceQuery.OrderBy(item => item.Name).FirstOrDefaultAsync(cancellationToken);
            if (workplace is null)
            {
                return null;
            }

            var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            var yearStart = new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var yearEnd = new DateTime(today.Year, 12, 31, 0, 0, 0, DateTimeKind.Utc);
            // Panelde sayilarin ardindaki listeler de gosterildigi icin sube
            // kadrosu tek sorguda cekilip role gore ayrilir.
            var staff = await context.UserWorkplaces
                .Where(mapping => mapping.WorkplaceId == workplace.Id
                    && mapping.User.IsActive
                    && (mapping.User.Role == UserRole.EMPLOYEE || mapping.User.Role == UserRole.HR))
                .Select(mapping => new
                {
                    mapping.UserId,
                    mapping.AnnualLeaveCount,
                    mapping.User.Name,
                    mapping.User.Surname,
                    mapping.User.Role
                })
                .ToListAsync(cancellationToken);
            var employees = staff.Where(member => member.Role == UserRole.EMPLOYEE).ToList();

            // Yil sinirini asan izinler her iki yila da tam gunuyle girer: burada
            // izin hakki denetiminin (LeaveDayCalculator) yil bazli kirilimi
            // kullanilmaz, cunku o servis tatil verisi eksik yillarda hata firlatir
            // ve panelin tamamini dusurur. Ozet icin kayitli gun sayisi yeterlidir.
            var approvedRequests = await context.LeaveRequests
                .Where(request => request.WorkplaceId == workplace.Id
                    && request.Status == LeaveStatus.APPROVED
                    && request.StartDate <= yearEnd
                    && request.EndDate >= yearStart)
                .ToListAsync(cancellationToken);

            // Grafikte payi buyuk tur ustte olsun diye gune gore azalan sirali
            var typeDistribution = approvedRequests
                .GroupBy(request => request.LeaveType)
                .Select(group => new LeaveTypeDistributionItemResponse
                {
                    LeaveType = group.Key.ToString(),
                    RequestCount = group.Count(),
                    ChargedLeaveDays = group.Sum(request => request.ChargedLeaveDays)
                })
                .OrderByDescending(item => item.ChargedLeaveDays)
                .ThenByDescending(item => item.RequestCount)
                .ThenBy(item => item.LeaveType)
                .ToList();

            // Ada gore sirali: hem "subedeki personel" listesi hem de kritik
            // bakiye karti bu tek diziden turetilir.
            var employeeBalances = employees
                .Select(employee =>
                {
                    var usedDays = approvedRequests
                        .Where(request => request.UserId == employee.UserId)
                        .Sum(request => request.ChargedLeaveDays);
                    var remainingDays = Math.Max(0, employee.AnnualLeaveCount - usedDays);
                    return new EmployeeLeaveBalanceResponse
                    {
                        UserId = employee.UserId,
                        Name = $"{employee.Name} {employee.Surname}".Trim(),
                        AnnualLeaveEntitlement = employee.AnnualLeaveCount,
                        UsedLeaveDays = usedDays,
                        RemainingLeaveDays = remainingDays,
                        IsCritical = remainingDays <= CriticalLeaveBalanceThreshold
                    };
                })
                .OrderBy(item => item.Name)
                .ToList();

            var hrStaff = staff
                .Where(member => member.Role == UserRole.HR)
                .Select(member => new BranchStaffResponse
                {
                    UserId = member.UserId,
                    Name = $"{member.Name} {member.Surname}".Trim()
                })
                .OrderBy(item => item.Name)
                .ToList();

            // Ayni gune denk gelen birden fazla onayli kaydi olan personel bir
            // kez sayilsin diye kisi bazinda tekillestirilir.
            var onLeaveRows = await context.LeaveRequests
                .Where(request => request.WorkplaceId == workplace.Id
                    && request.Status == LeaveStatus.APPROVED
                    && request.StartDate <= today && request.EndDate >= today)
                .Select(request => new
                {
                    request.UserId,
                    request.User.Name,
                    request.User.Surname,
                    request.LeaveType,
                    request.StartDate,
                    request.EndDate
                })
                .ToListAsync(cancellationToken);
            var onLeaveToday = onLeaveRows
                .GroupBy(row => row.UserId)
                .Select(group => group.OrderBy(row => row.EndDate).First())
                .Select(row => new OnLeaveEmployeeResponse
                {
                    UserId = row.UserId,
                    Name = $"{row.Name} {row.Surname}".Trim(),
                    LeaveType = row.LeaveType.ToString(),
                    StartDate = row.StartDate,
                    EndDate = row.EndDate
                })
                .OrderBy(item => item.EndDate)
                .ThenBy(item => item.Name)
                .ToList();

            return new HrDashboardResponse
            {
                HrName = hrName,
                Workplace = new WorkplaceSummaryResponse { Id = workplace.Id, Name = workplace.Name },
                EmployeeCount = employeeBalances.Count,
                HrCount = hrStaff.Count,
                LeaveStatus = new LeaveStatusSummaryResponse
                {
                    Date = today,
                    OnLeaveTodayCount = onLeaveToday.Count,
                    OnLeaveToday = onLeaveToday,
                    // Kart Izin Onay ekranina goturuyor; sayi o ekranin
                    // kapsamiyla ayni olmali. HR kendi talebini ve diger
                    // HR'lerin taleplerini oradan goremez (LeaveRequests
                    // workplaces/{id} ayni filtreyi uygular).
                    PendingRequestCount = await context.LeaveRequests.CountAsync(request => request.WorkplaceId == workplace.Id
                        && request.Status == LeaveStatus.PENDING
                        && request.UserId != hrUserId
                        && request.User.Role == UserRole.EMPLOYEE, cancellationToken)
                },
                LeaveTypeDistribution = typeDistribution,
                CriticalBalanceThreshold = CriticalLeaveBalanceThreshold,
                Employees = employeeBalances,
                HrStaff = hrStaff
            };
        }

        private async Task<AdminDashboardResponse> BuildAdminDashboardAsync(CancellationToken cancellationToken)
        {
            var adminNames = await context.Users
                .Where(user => user.IsActive && user.Role == UserRole.ADMIN)
                .OrderBy(user => user.Name)
                .ThenBy(user => user.Surname)
                .Select(user => $"{user.Name} {user.Surname}".Trim())
                .ToListAsync(cancellationToken);

            var workplaceComparison = await context.Workplaces
                .Where(workplace => workplace.IsActive)
                .OrderBy(workplace => workplace.Name)
                .Select(workplace => new WorkplaceEmployeeCountResponse
                {
                    WorkplaceId = workplace.Id,
                    WorkplaceName = workplace.Name,
                    EmployeeCount = workplace.UserWorkplaces.Count(mapping => mapping.User.IsActive
                        && mapping.User.Role == UserRole.EMPLOYEE)
                })
                .ToListAsync(cancellationToken);

            var deletedUsers = context.Users.IgnoreQueryFilters().Where(user => user.DeletedAt != null);
            var deletedWorkplaces = context.Workplaces.IgnoreQueryFilters().Where(workplace => workplace.DeletedAt != null);
            var deletedLeaveRequests = context.LeaveRequests.IgnoreQueryFilters().Where(request => request.DeletedAt != null);
            var deletedAtValues = await deletedUsers.Select(user => user.DeletedAt!.Value)
                .Concat(deletedWorkplaces.Select(workplace => workplace.DeletedAt!.Value))
                .Concat(deletedLeaveRequests.Select(request => request.DeletedAt!.Value))
                .ToListAsync(cancellationToken);
            var deletedUserCount = await deletedUsers.CountAsync(cancellationToken);
            var deletedWorkplaceCount = await deletedWorkplaces.CountAsync(cancellationToken);
            var deletedLeaveRequestCount = await deletedLeaveRequests.CountAsync(cancellationToken);

            return new AdminDashboardResponse
            {
                AdminNames = adminNames,
                ActiveWorkplaceCount = workplaceComparison.Count,
                TotalEmployeeCount = await context.Users.CountAsync(user => user.IsActive
                    && user.Role == UserRole.EMPLOYEE, cancellationToken),
                WorkplaceComparison = workplaceComparison,
                SystemUsage = new SystemUsageResponse
                {
                    Status = "AVAILABLE",
                    ActiveConnectionCount = await presenceService.GetActiveConnectionCountAsync(cancellationToken),
                    ActiveUserCount = await presenceService.GetActiveUserCountAsync(cancellationToken)
                },
                SoftDeletedDataVolume = new SoftDeletedDataVolumeResponse
                {
                    Users = deletedUserCount,
                    Workplaces = deletedWorkplaceCount,
                    LeaveRequests = deletedLeaveRequestCount,
                    TotalCount = deletedUserCount + deletedWorkplaceCount + deletedLeaveRequestCount,
                    OldestDeletedAt = deletedAtValues.Count == 0 ? null : deletedAtValues.Min()
                }
            };
        }

        private bool TryGetCurrentUserId(out long userId)
        {
            return long.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out userId);
        }
    }
}
