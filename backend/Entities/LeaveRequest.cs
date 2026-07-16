using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using LeaveManagementAPI.Enums;

namespace LeaveManagementAPI.Entities
{
    [Table("LeaveRequest")]
    public class LeaveRequest
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        public long UserId { get; set; }

        [Required]
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
        public LeaveStatus Status { get; set; } = LeaveStatus.PENDING;
                
        public DateTime? DeletedAt { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;

        [ForeignKey(nameof(WorkplaceId))]
        public virtual Workplace Workplace { get; set; } = null!;

        public virtual ICollection<LeaveRequestAudit> Audits { get; set; } = new List<LeaveRequestAudit>();
    }
}
