namespace LeaveManagementAPI.Models.Messages
{
    public class MessageResponse
    {
        public long Id { get; set; }
        public long SenderId { get; set; }
        public long ReceiverId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public bool IsRead { get; set; }
        public IReadOnlyList<AttachmentResponse> Attachments { get; set; } = [];
    }
}
