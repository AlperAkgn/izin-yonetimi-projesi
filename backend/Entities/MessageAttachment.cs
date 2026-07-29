using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeaveManagementAPI.Entities;

[Table("MessageAttachments")]
public class MessageAttachment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    public long? MessageId { get; set; }

    [Required]
    public long UploadedByUserId { get; set; }

    [Required, MaxLength(255)]
    public string OriginalFileName { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string StoredFileName { get; set; } = string.Empty;

    [Required, MaxLength(128)]
    public string ContentType { get; set; } = "application/octet-stream";

    [Required]
    public long SizeBytes { get; set; }

    [Required]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(MessageId))]
    public Message? Message { get; set; }

    [ForeignKey(nameof(UploadedByUserId))]
    public User UploadedByUser { get; set; } = null!;
}
