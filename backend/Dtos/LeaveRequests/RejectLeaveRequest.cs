using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.LeaveRequests
{
    public class RejectLeaveRequest
    {
        [MaxLength(500)]
        public string? RejectionReason { get; set; }
    }
}
