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

            var content = request.Content?.Trim();
            if (string.IsNullOrWhiteSpace(content))
            {
                throw new ArgumentException("Mesaj icerigi bos olamaz.");
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

            context.Messages.Add(message);
            await context.SaveChangesAsync(cancellationToken);

            return ToResponse(message);
        }

        public async Task<IReadOnlyList<MessageResponse>> GetConversationAsync(
            long firstUserId,
            long secondUserId,
            CancellationToken cancellationToken = default)
        {
            return await context.Messages
                .Where(message =>
                    (message.SenderId == firstUserId && message.ReceiverId == secondUserId)
                    || (message.SenderId == secondUserId && message.ReceiverId == firstUserId))
                .OrderBy(message => message.Timestamp)
                .Select(message => new MessageResponse
                {
                    Id = message.Id,
                    SenderId = message.SenderId,
                    ReceiverId = message.ReceiverId,
                    Content = message.Content,
                    Timestamp = message.Timestamp
                })
                .ToListAsync(cancellationToken);
        }

        private static MessageResponse ToResponse(Message message) => new()
        {
            Id = message.Id,
            SenderId = message.SenderId,
            ReceiverId = message.ReceiverId,
            Content = message.Content,
            Timestamp = message.Timestamp
        };
    }
}
