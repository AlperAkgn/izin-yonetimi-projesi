using LeaveManagementAPI.Models.Messages;

namespace LeaveManagementAPI.Services
{
    public interface IMessageService
    {
        Task<MessageResponse> SendAsync(SendMessageRequest request, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<MessageResponse>> GetConversationAsync(
            long firstUserId,
            long secondUserId,
            CancellationToken cancellationToken = default);
        Task MarkConversationReadAsync(long readerId, long otherUserId, CancellationToken cancellationToken = default);
    }
}
