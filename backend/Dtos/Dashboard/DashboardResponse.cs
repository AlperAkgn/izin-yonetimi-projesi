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
        public string HrName { get; set; } = string.Empty;
        public WorkplaceSummaryResponse Workplace { get; set; } = new();
        public int EmployeeCount { get; set; }
        public int HrCount { get; set; }
        public LeaveStatusSummaryResponse LeaveStatus { get; set; } = new();
        public List<LeaveTypeDistributionItemResponse> LeaveTypeDistribution { get; set; } = [];
        /// <summary>Kurum ici limit: bu gun sayisi ve altindaki bakiye kritik sayilir.</summary>
        public int CriticalBalanceThreshold { get; set; }
        /// <summary>Subenin personeli (ada gore sirali) — bakiye kartinin da kaynagi.</summary>
        public List<EmployeeLeaveBalanceResponse> Employees { get; set; } = [];
        /// <summary>Subeye atanmis Insan Kaynaklari kullanicilari.</summary>
        public List<BranchStaffResponse> HrStaff { get; set; } = [];
    }

    public class AdminDashboardResponse
    {
        public List<string> AdminNames { get; set; } = [];
        public int ActiveWorkplaceCount { get; set; }
        public int TotalEmployeeCount { get; set; }
        public List<WorkplaceEmployeeCountResponse> WorkplaceComparison { get; set; } = [];
        public SystemUsageResponse SystemUsage { get; set; } = new();
        public SoftDeletedDataVolumeResponse SoftDeletedDataVolume { get; set; } = new();
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
        /// <summary>Bugun izinde olan personel — sayinin ardindaki liste.</summary>
        public List<OnLeaveEmployeeResponse> OnLeaveToday { get; set; } = [];
    }

    public class OnLeaveEmployeeResponse
    {
        public long UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string LeaveType { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }

    public class BranchStaffResponse
    {
        public long UserId { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class LeaveTypeDistributionItemResponse
    {
        public string LeaveType { get; set; } = string.Empty;
        public int RequestCount { get; set; }
        public int ChargedLeaveDays { get; set; }
    }

    public class EmployeeLeaveBalanceResponse
    {
        public long UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int AnnualLeaveEntitlement { get; set; }
        public int UsedLeaveDays { get; set; }
        public int RemainingLeaveDays { get; set; }
        public bool IsCritical { get; set; }
    }

    public class WorkplaceEmployeeCountResponse
    {
        public long WorkplaceId { get; set; }
        public string WorkplaceName { get; set; } = string.Empty;
        public int EmployeeCount { get; set; }
    }

    public class SystemUsageResponse
    {
        public string Status { get; set; } = "NOT_AVAILABLE";
        public int? ActiveConnectionCount { get; set; }
        public int? ActiveUserCount { get; set; }
    }

    public class SoftDeletedDataVolumeResponse
    {
        public int TotalCount { get; set; }
        public int Users { get; set; }
        public int Workplaces { get; set; }
        public int LeaveRequests { get; set; }
        public DateTime? OldestDeletedAt { get; set; }
    }
}
