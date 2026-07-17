namespace LeaveManagementAPI.Services
{
    public interface IMailService
    {
        Task SendTemporaryPasswordAsync(string recipientEmail, string recipientName, string temporaryPassword, CancellationToken cancellationToken = default);
    }
}
