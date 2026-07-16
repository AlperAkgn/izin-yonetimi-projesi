using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using LeaveManagementAPI.Enums;

namespace LeaveManagementAPI.Entities
{
    [Table("User")]
    public class User
    {
        
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        public UserRole Role { get; set; }

        [Required]
        [MaxLength(256)]
        public string Mail { get; set; } = string.Empty;

        [Required]
        [MaxLength(512)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Surname { get; set; } = string.Empty;

        [Required]
        public bool IsActive { get; set; } = true;

        [Required]
        public bool IsTempPassword { get; set; } = false;

        [Required]
        public DateTime StartAt { get; set; }
        public DateTime? DeletedAt { get; set; }

    

        public virtual ICollection<UserWorkplace> UserWorkplaces { get; set; } = new List<UserWorkplace>();

        public virtual ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
        public virtual ICollection<LeaveRequestAudit> LeaveRequestAudits { get; set; } = new List<LeaveRequestAudit>();
    }
}
