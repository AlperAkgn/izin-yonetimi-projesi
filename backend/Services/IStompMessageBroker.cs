using System.Net.WebSockets;
using LeaveManagementAPI.Models.Messages;

namespace LeaveManagementAPI.Services
{
    public interface IStompMessageBroker
    {
        void Subscribe(long userId, WebSocket socket);
        void Unsubscribe(WebSocket socket);
        Task PublishToUserAsync(long userId, MessageResponse message, CancellationToken cancellationToken = default);
    }
}
