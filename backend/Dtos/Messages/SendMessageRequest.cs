using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Messages
{
    public class SendMessageRequest
    {
        [Range(1, long.MaxValue)]
        public long SenderId { get; set; }

        [Range(1, long.MaxValue)]
        public long ReceiverId { get; set; }

        [Required]
        [MaxLength(4000)]
        public string Content { get; set; } = string.Empty;
    }
}
