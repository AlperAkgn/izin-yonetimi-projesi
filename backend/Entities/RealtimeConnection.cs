using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeaveManagementAPI.Entities
{
    [Table("RealtimeConnections")]
    public class RealtimeConnection
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        public long UserId { get; set; }

        [Required]
        [MaxLength(64)]
        public string ConnectionId { get; set; } = string.Empty;

        [Required]
        public DateTime ConnectedAt { get; set; }

        public DateTime? DisconnectedAt { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;
    }
}
