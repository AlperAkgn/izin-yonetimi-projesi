namespace LeaveManagementAPI.Services
{
    public sealed class MailSettings
    {
        public const string SectionName = "MailSettings";

        public string SmtpServer { get; set; } = string.Empty;
        public int Port { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string From { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
