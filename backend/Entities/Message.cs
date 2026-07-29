using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeaveManagementAPI.Entities
{
    [Table("Messages")]
    public class Message
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        public long SenderId { get; set; }

        [Required]
        public long ReceiverId { get; set; }

        [Required]
        [MaxLength(4000)]
        public string Content { get; set; } = string.Empty;

        [Required]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [Required]
        public bool IsRead { get; set; }

        [ForeignKey(nameof(SenderId))]
        public virtual User Sender { get; set; } = null!;

        [ForeignKey(nameof(ReceiverId))]
        public virtual User Receiver { get; set; } = null!;
    }
}
