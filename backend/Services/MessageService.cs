using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Models.Messages;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Services
{
    public class MessageService(AppDbContext context) : IMessageService
    {
        public async Task<MessageResponse> SendAsync(SendMessageRequest request, CancellationToken cancellationToken = default)
        {
            if (request.SenderId == request.ReceiverId)
            {
                throw new ArgumentException("Gonderici ve alici ayni kullanici olamaz.");
            }

            var content = request.Content?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(content) && request.AttachmentId is null)
            {
                throw new ArgumentException("Mesaj icerigi veya dosya eki zorunludur.");
            }

            if (content.Length > 4000)
            {
                throw new ArgumentException("Mesaj icerigi en fazla 4000 karakter olabilir.");
            }

            var userIds = new[] { request.SenderId, request.ReceiverId };
            var activeUserCount = await context.Users
                .CountAsync(user => userIds.Contains(user.Id) && user.IsActive, cancellationToken);
            if (activeUserCount != 2)
            {
                throw new KeyNotFoundException("Gonderici veya alici aktif kullanici olarak bulunamadi.");
            }

            var message = new Message
            {
                SenderId = request.SenderId,
                ReceiverId = request.ReceiverId,
                Content = content,
                Timestamp = DateTime.UtcNow,
                IsRead = false
            };

            if (request.AttachmentId is not null)
            {
                var attachment = await context.MessageAttachments.SingleOrDefaultAsync(item =>
                    item.Id == request.AttachmentId && item.MessageId == null &&
                    item.UploadedByUserId == request.SenderId, cancellationToken);
                if (attachment is null)
                {
                    throw new KeyNotFoundException("Mesaj eki bulunamadi veya bu kullaniciya ait degil.");
                }

                message.Attachments.Add(attachment);
            }

            context.Messages.Add(message);
            await context.SaveChangesAsync(cancellationToken);

            return ToResponse(message);
        }

        public async Task<IReadOnlyList<MessageResponse>> GetConversationAsync(
            long firstUserId,
            long secondUserId,
            CancellationToken cancellationToken = default)
        {
            var messages = await context.Messages
                .AsNoTracking()
                .Include(message => message.Attachments)
                .Where(message =>
                    (message.SenderId == firstUserId && message.ReceiverId == secondUserId)
                    || (message.SenderId == secondUserId && message.ReceiverId == firstUserId))
                .OrderBy(message => message.Timestamp)
                .ToListAsync(cancellationToken);

            return messages.Select(ToResponse).ToList();
        }

        public async Task MarkConversationReadAsync(long readerId, long otherUserId, CancellationToken cancellationToken = default)
        {
            await context.Messages
                .Where(message => message.SenderId == otherUserId && message.ReceiverId == readerId && !message.IsRead)
                .ExecuteUpdateAsync(setters => setters.SetProperty(message => message.IsRead, true), cancellationToken);
        }

        private static MessageResponse ToResponse(Message message) => new()
        {
            Id = message.Id,
            SenderId = message.SenderId,
            ReceiverId = message.ReceiverId,
            Content = message.Content,
            Timestamp = message.Timestamp,
            IsRead = message.IsRead,
            Attachments = message.Attachments.Select(attachment => new AttachmentResponse
            {
                Id = attachment.Id,
                FileName = attachment.OriginalFileName,
                ContentType = attachment.ContentType,
                SizeBytes = attachment.SizeBytes,
                DownloadUrl = $"/api/messages/attachments/{attachment.Id}"
            }).ToList()
        };
    }
}
