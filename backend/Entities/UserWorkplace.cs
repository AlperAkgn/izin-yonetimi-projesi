using System.ComponentModel.DataAnnotations.Schema;

namespace LeaveManagementAPI.Entities
{
    [Table("UserWorkplace")]
    public class UserWorkplace
    {

        public long UserId { get; set; }

        public long WorkplaceId { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;

        [ForeignKey(nameof(WorkplaceId))]
        public virtual Workplace Workplace { get; set; } = null!;
    }
}
