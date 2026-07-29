namespace LeaveManagementAPI.Services;

/// <summary>Mevcut ve gelecek yilin tatil takvimini haftalik olarak yeniler.</summary>
public sealed class PublicHolidaySyncService(
    IServiceScopeFactory scopeFactory,
    ILogger<PublicHolidaySyncService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var catalog = scope.ServiceProvider.GetRequiredService<IPublicHolidayCatalogService>();
                var year = DateTime.UtcNow.Year;
                await catalog.SyncYearAsync(year, stoppingToken);
                await catalog.SyncYearAsync(year + 1, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Resmi tatil senkronizasyonu basarisiz oldu.");
            }
            await Task.Delay(TimeSpan.FromDays(7), stoppingToken);
        }
    }
}
