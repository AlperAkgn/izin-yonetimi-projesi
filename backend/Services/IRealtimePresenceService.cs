namespace LeaveManagementAPI.Services
{
    public interface IRealtimePresenceService
    {
        Task<string> ConnectAsync(long userId, CancellationToken cancellationToken = default);
        Task DisconnectAsync(string connectionId, CancellationToken cancellationToken = default);
        Task<int> GetActiveConnectionCountAsync(CancellationToken cancellationToken = default);
        Task<int> GetActiveUserCountAsync(CancellationToken cancellationToken = default);
        Task CloseOrphanedConnectionsAsync(CancellationToken cancellationToken = default);
    }
}
