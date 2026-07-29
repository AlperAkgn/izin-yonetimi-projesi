using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Services;

/// <summary>Kalici mesaj ve dosya temizligini her gun calistirir.</summary>
public sealed class MessageRetentionService(
    IServiceScopeFactory scopeFactory,
    IWebHostEnvironment environment,
    ILogger<MessageRetentionService> logger) : BackgroundService
{
    private static readonly TimeSpan RunInterval = TimeSpan.FromDays(1);
    private static readonly TimeSpan MessageRetention = TimeSpan.FromDays(30);
    private static readonly TimeSpan OrphanUploadRetention = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await PurgeAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Mesaj saklama politikasi temizligi basarisiz oldu.");
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task PurgeAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var messageCutoff = now - MessageRetention;
        var orphanCutoff = now - OrphanUploadRetention;

        var attachments = await db.MessageAttachments
            .Where(item => (item.Message != null && item.Message.Timestamp < messageCutoff)
                || (item.MessageId == null && item.UploadedAt < orphanCutoff))
            .Select(item => new { item.Id, item.StoredFileName })
            .ToListAsync(cancellationToken);
        var expiredMessageIds = await db.Messages.Where(message => message.Timestamp < messageCutoff)
            .Select(message => message.Id).ToListAsync(cancellationToken);

        if (expiredMessageIds.Count > 0)
            await db.Messages.Where(message => expiredMessageIds.Contains(message.Id)).ExecuteDeleteAsync(cancellationToken);
        if (attachments.Count > 0)
            await db.MessageAttachments.Where(item => attachments.Select(file => file.Id).Contains(item.Id))
                .ExecuteDeleteAsync(cancellationToken);

        var directory = Path.Combine(environment.ContentRootPath, "App_Data", "message-uploads");
        foreach (var attachment in attachments)
        {
            var path = Path.Combine(directory, attachment.StoredFileName);
            if (File.Exists(path)) File.Delete(path);
        }
        if (expiredMessageIds.Count > 0 || attachments.Count > 0)
            logger.LogInformation("Saklama politikasi {MessageCount} mesaj ve {AttachmentCount} dosya temizledi.", expiredMessageIds.Count, attachments.Count);
    }
}
