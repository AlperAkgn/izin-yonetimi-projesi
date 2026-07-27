using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Services
{
    /// <summary>
    /// Permanently removes workplaces that have remained soft-deleted for 30 days.
    /// Related leave records and workplace memberships are removed in the same
    /// transaction so database foreign-key restrictions cannot leave a partial purge.
    /// </summary>
    public class SoftDeletedWorkplacePurgeService(
        IServiceScopeFactory scopeFactory,
        ILogger<SoftDeletedWorkplacePurgeService> logger) : BackgroundService
    {
        private static readonly TimeSpan RetentionPeriod = TimeSpan.FromDays(30);
        private static readonly TimeSpan RunInterval = TimeSpan.FromHours(1);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await PurgeExpiredWorkplacesAsync(stoppingToken);

            using var timer = new PeriodicTimer(RunInterval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await PurgeExpiredWorkplacesAsync(stoppingToken);
            }
        }

        private async Task PurgeExpiredWorkplacesAsync(CancellationToken cancellationToken)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var expiresBefore = DateTime.UtcNow.Subtract(RetentionPeriod);
                var workplaceIds = await context.Workplaces
                    .IgnoreQueryFilters()
                    .Where(workplace => workplace.DeletedAt != null && workplace.DeletedAt <= expiresBefore)
                    .Select(workplace => workplace.Id)
                    .ToListAsync(cancellationToken);

                if (workplaceIds.Count == 0)
                {
                    return;
                }

                await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

                // LeaveRequestAudit has a cascade relationship with LeaveRequest.
                await context.LeaveRequests
                    .Where(request => workplaceIds.Contains(request.WorkplaceId))
                    .ExecuteDeleteAsync(cancellationToken);
                await context.UserWorkplaces
                    .Where(mapping => workplaceIds.Contains(mapping.WorkplaceId))
                    .ExecuteDeleteAsync(cancellationToken);
                await context.Workplaces
                    .IgnoreQueryFilters()
                    .Where(workplace => workplaceIds.Contains(workplace.Id))
                    .ExecuteDeleteAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);
                logger.LogInformation(
                    "{Count} soft-silinmis is yeri ve bagli kayitlari 30 gunluk saklama suresi sonunda kalici olarak temizlendi.",
                    workplaceIds.Count);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // Host shutdown is expected; no error needs to be logged.
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Soft-silinmis is yerleri kalici olarak temizlenirken hata olustu.");
            }
        }
    }
}
