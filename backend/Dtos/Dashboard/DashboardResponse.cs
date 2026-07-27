namespace LeaveManagementAPI.Models.Dashboard
{
    public class DashboardResponse
    {
        public string Role { get; set; } = string.Empty;
        public HrDashboardResponse? Hr { get; set; }
        public AdminDashboardResponse? Admin { get; set; }
    }

    public class HrDashboardResponse
    {
        public WorkplaceSummaryResponse Workplace { get; set; } = new();
        public int EmployeeCount { get; set; }
        public int HrCount { get; set; }
        public LeaveStatusSummaryResponse LeaveStatus { get; set; } = new();
        public List<LeaveTypeDistributionItemResponse> LeaveTypeDistribution { get; set; } = [];
        public List<CriticalLeaveBalanceResponse> CriticalLeaveBalances { get; set; } = [];
    }

    public class AdminDashboardResponse
    {
        public int ActiveWorkplaceCount { get; set; }
        public int TotalEmployeeCount { get; set; }
        public List<WorkplaceEmployeeCountResponse> WorkplaceComparison { get; set; } = [];
        public SoftDeletedDataSummaryResponse SoftDeletedData { get; set; } = new();
        public SystemUsageResponse SystemUsage { get; set; } = new();
    }

    public class WorkplaceSummaryResponse
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class LeaveStatusSummaryResponse
    {
        public DateTime Date { get; set; }
        public int OnLeaveTodayCount { get; set; }
        public int PendingRequestCount { get; set; }
    }

    public class LeaveTypeDistributionItemResponse
    {
        public string LeaveType { get; set; } = string.Empty;
        public int RequestCount { get; set; }
        public int ChargedLeaveDays { get; set; }
    }

    public class CriticalLeaveBalanceResponse
    {
        public long UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int AnnualLeaveEntitlement { get; set; }
        public int UsedLeaveDays { get; set; }
        public int RemainingLeaveDays { get; set; }
    }

    public class WorkplaceEmployeeCountResponse
    {
        public long WorkplaceId { get; set; }
        public string WorkplaceName { get; set; } = string.Empty;
        public int EmployeeCount { get; set; }
    }

    public class SoftDeletedDataSummaryResponse
    {
        public int WorkplaceCount { get; set; }
        public int UserCount { get; set; }
        public int TotalCount => WorkplaceCount + UserCount;
    }

    public class SystemUsageResponse
    {
        public string Status { get; set; } = "NOT_AVAILABLE";
        public int? ActiveConnectionCount { get; set; }
    }
}
