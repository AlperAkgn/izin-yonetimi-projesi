using System.IdentityModel.Tokens.Jwt;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Enums;
using LeaveManagementAPI.Models.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/dashboard")]
    [Authorize(Roles = "ADMIN,HR")]
    public class DashboardController(AppDbContext context) : ControllerBase
    {
        private const int CriticalLeaveBalanceThreshold = 3;

        [HttpGet]
        public async Task<ActionResult<DashboardResponse>> Get(CancellationToken cancellationToken)
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
                var hrDashboard = await BuildHrDashboardAsync(currentUser.Id, cancellationToken);
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
            CancellationToken cancellationToken)
        {
            var workplaceQuery = context.Workplaces.Where(workplace => workplace.IsActive
                && workplace.UserWorkplaces.Any(mapping => mapping.UserId == hrUserId));

            var workplace = await workplaceQuery.OrderBy(item => item.Name).FirstOrDefaultAsync(cancellationToken);
            if (workplace is null)
            {
                return null;
            }

            var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            var yearStart = new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var yearEnd = new DateTime(today.Year, 12, 31, 0, 0, 0, DateTimeKind.Utc);
            var employees = await context.UserWorkplaces
                .Where(mapping => mapping.WorkplaceId == workplace.Id
                    && mapping.User.IsActive
                    && mapping.User.Role == UserRole.EMPLOYEE)
                .Select(mapping => new { mapping.UserId, mapping.AnnualLeaveCount, mapping.User.Name, mapping.User.Surname })
                .ToListAsync(cancellationToken);

            var approvedRequests = await context.LeaveRequests
                .Where(request => request.WorkplaceId == workplace.Id
                    && request.Status == LeaveStatus.APPROVED
                    && request.StartDate <= yearEnd
                    && request.EndDate >= yearStart)
                .ToListAsync(cancellationToken);

            var typeDistribution = approvedRequests
                .GroupBy(request => request.LeaveType)
                .OrderBy(group => group.Key)
                .Select(group => new LeaveTypeDistributionItemResponse
                {
                    LeaveType = group.Key.ToString(),
                    RequestCount = group.Count(),
                    ChargedLeaveDays = group.Sum(request => request.ChargedLeaveDays)
                })
                .ToList();

            var criticalBalances = employees
                .Select(employee =>
                {
                    var usedDays = approvedRequests
                        .Where(request => request.UserId == employee.UserId)
                        .Sum(request => request.ChargedLeaveDays);
                    return new CriticalLeaveBalanceResponse
                    {
                        UserId = employee.UserId,
                        Name = $"{employee.Name} {employee.Surname}".Trim(),
                        AnnualLeaveEntitlement = employee.AnnualLeaveCount,
                        UsedLeaveDays = usedDays,
                        RemainingLeaveDays = Math.Max(0, employee.AnnualLeaveCount - usedDays)
                    };
                })
                .Where(item => item.RemainingLeaveDays <= CriticalLeaveBalanceThreshold)
                .OrderBy(item => item.RemainingLeaveDays)
                .ThenBy(item => item.Name)
                .ToList();

            return new HrDashboardResponse
            {
                Workplace = new WorkplaceSummaryResponse { Id = workplace.Id, Name = workplace.Name },
                EmployeeCount = employees.Count,
                HrCount = await context.UserWorkplaces.CountAsync(mapping => mapping.WorkplaceId == workplace.Id
                    && mapping.User.IsActive && mapping.User.Role == UserRole.HR, cancellationToken),
                LeaveStatus = new LeaveStatusSummaryResponse
                {
                    Date = today,
                    OnLeaveTodayCount = await context.LeaveRequests.CountAsync(request => request.WorkplaceId == workplace.Id
                        && request.Status == LeaveStatus.APPROVED
                        && request.StartDate <= today && request.EndDate >= today, cancellationToken),
                    PendingRequestCount = await context.LeaveRequests.CountAsync(request => request.WorkplaceId == workplace.Id
                        && request.Status == LeaveStatus.PENDING, cancellationToken)
                },
                LeaveTypeDistribution = typeDistribution,
                CriticalLeaveBalances = criticalBalances
            };
        }

        private async Task<AdminDashboardResponse> BuildAdminDashboardAsync(CancellationToken cancellationToken)
        {
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

            return new AdminDashboardResponse
            {
                ActiveWorkplaceCount = workplaceComparison.Count,
                TotalEmployeeCount = await context.Users.CountAsync(user => user.IsActive
                    && user.Role == UserRole.EMPLOYEE, cancellationToken),
                WorkplaceComparison = workplaceComparison,
                SoftDeletedData = new SoftDeletedDataSummaryResponse
                {
                    WorkplaceCount = await context.Workplaces.IgnoreQueryFilters()
                        .CountAsync(workplace => workplace.DeletedAt != null, cancellationToken),
                    UserCount = await context.Users.IgnoreQueryFilters()
                        .CountAsync(user => user.DeletedAt != null, cancellationToken)
                },
                // Aktif baglanti takibi icin SignalR/oturum tablosu henuz bulunmuyor.
                SystemUsage = new SystemUsageResponse()
            };
        }

        private bool TryGetCurrentUserId(out long userId)
        {
            return long.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out userId);
        }
    }
}
