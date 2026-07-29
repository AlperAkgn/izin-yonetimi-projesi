using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Services
{
    public class RealtimePresenceService(AppDbContext context) : IRealtimePresenceService
    {
        public async Task<string> ConnectAsync(long userId, CancellationToken cancellationToken = default)
        {
            var connectionId = Guid.NewGuid().ToString("N");
            context.Set<RealtimeConnection>().Add(new RealtimeConnection
            {
                UserId = userId,
                ConnectionId = connectionId,
                ConnectedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync(cancellationToken);
            return connectionId;
        }

        public async Task DisconnectAsync(string connectionId, CancellationToken cancellationToken = default)
        {
            await context.Set<RealtimeConnection>()
                .Where(connection => connection.ConnectionId == connectionId && connection.DisconnectedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(connection => connection.DisconnectedAt, DateTime.UtcNow), cancellationToken);
        }

        public Task<int> GetActiveConnectionCountAsync(CancellationToken cancellationToken = default) =>
            context.Set<RealtimeConnection>()
                .CountAsync(connection => connection.DisconnectedAt == null, cancellationToken);

        public Task<int> GetActiveUserCountAsync(CancellationToken cancellationToken = default) =>
            context.Set<RealtimeConnection>()
                .Where(connection => connection.DisconnectedAt == null)
                .Select(connection => connection.UserId)
                .Distinct()
                .CountAsync(cancellationToken);

        public Task CloseOrphanedConnectionsAsync(CancellationToken cancellationToken = default) =>
            context.Set<RealtimeConnection>()
                .Where(connection => connection.DisconnectedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(connection => connection.DisconnectedAt, DateTime.UtcNow), cancellationToken);
    }
}
