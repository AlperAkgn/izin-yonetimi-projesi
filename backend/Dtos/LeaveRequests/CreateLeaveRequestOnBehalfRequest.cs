using System.ComponentModel.DataAnnotations;
using LeaveManagementAPI.Enums;

namespace LeaveManagementAPI.Models.LeaveRequests
{
    public class CreateLeaveRequestOnBehalfRequest
    {
        [Required]
        [EmailAddress]
        [MaxLength(256)]
        public string EmployeeMail { get; set; } = string.Empty;

        [Range(1, long.MaxValue)]
        public long WorkplaceId { get; set; }

        [Required]
        public LeaveType LeaveType { get; set; }

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(200)]
        public string? EmergencyContact { get; set; }

        [Required]
        [MaxLength(500)]
        public string LeaveAddress { get; set; } = string.Empty;
    }
}
