using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using LeaveManagementAPI.Enums;

namespace LeaveManagementAPI.Entities
{
    [Table("LeaveRequestAudit")]
    public class LeaveRequestAudit
    {
        
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        public long LeaveRequestId { get; set; }

        [Required]
        public long ActionByUserId { get; set; }

        [Required]
        public AuditActionType ActionType { get; set; }

        [Required]
        public DateTime ActionAt { get; set; }

        [ForeignKey(nameof(LeaveRequestId))]
        public virtual LeaveRequest LeaveRequest { get; set; } = null!;

        [ForeignKey(nameof(ActionByUserId))]
        public virtual User ActionByUser { get; set; } = null!;
    }
}
