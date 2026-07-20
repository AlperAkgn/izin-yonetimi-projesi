using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeaveManagementAPI.Entities
{
    [Table("UserWorkplace")]
    public class UserWorkplace
    {

        public long UserId { get; set; }

        public long WorkplaceId { get; set; }

        [Required]
        public int AnnualLeaveCount { get; set; } = 15;

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;

        [ForeignKey(nameof(WorkplaceId))]
        public virtual Workplace Workplace { get; set; } = null!;
    }
}
