namespace LeaveManagementAPI.Models.LeaveRequests
{
    public class LeaveRequestResponse
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long WorkplaceId { get; set; }
        public string LeaveType { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Description { get; set; }
        public string? EmergencyContact { get; set; }
        public string Status { get; set; } = string.Empty;
        public int ChargedLeaveDays { get; set; }
        public string? RejectionReason { get; set; }
    }
}
