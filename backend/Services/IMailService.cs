namespace LeaveManagementAPI.Services
{
    public interface IMailService
    {
        Task SendTemporaryPasswordAsync(string recipientEmail, string recipientName, string temporaryPassword, CancellationToken cancellationToken = default);

        Task SendEmergencyLeaveApprovedAsync(
            string recipientEmail,
            string recipientName,
            string employeeName,
            string workplaceName,
            DateTime startDate,
            DateTime endDate,
            string? description,
            CancellationToken cancellationToken = default);
    }
}
