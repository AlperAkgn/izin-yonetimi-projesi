namespace LeaveManagementAPI.Models.Messages
{
    /// <summary>Oturumdaki kullanicinin bir kisiyle olan sohbet ozeti.</summary>
    public class ConversationResponse
    {
        public long PartnerId { get; set; }
        public string PartnerName { get; set; } = string.Empty;
        public string PartnerRole { get; set; } = string.Empty;
        public string LastContent { get; set; } = string.Empty;
        public DateTime LastTimestamp { get; set; }
        public long LastSenderId { get; set; }
        public bool LastHasAttachment { get; set; }
        public int UnreadCount { get; set; }
    }
}
