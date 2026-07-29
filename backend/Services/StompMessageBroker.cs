using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using LeaveManagementAPI.Models.Messages;

namespace LeaveManagementAPI.Services
{
    public class StompMessageBroker : IStompMessageBroker
    {
        private readonly ConcurrentDictionary<long, ConcurrentDictionary<WebSocket, byte>> _subscriptions = new();
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        public void Subscribe(long userId, WebSocket socket)
        {
            var userSockets = _subscriptions.GetOrAdd(userId, _ => new ConcurrentDictionary<WebSocket, byte>());
            userSockets.TryAdd(socket, 0);
        }

        public void Unsubscribe(WebSocket socket)
        {
            foreach (var subscription in _subscriptions)
            {
                subscription.Value.TryRemove(socket, out _);
                if (subscription.Value.IsEmpty)
                {
                    _subscriptions.TryRemove(subscription.Key, out _);
                }
            }
        }

        public async Task PublishToUserAsync(long userId, MessageResponse message, CancellationToken cancellationToken = default)
        {
            if (!_subscriptions.TryGetValue(userId, out var sockets))
            {
                return;
            }

            var body = JsonSerializer.Serialize(message, JsonOptions);
            var frame = $"MESSAGE\ndestination:/user/{userId}/queue/messages\ncontent-type:application/json\n\n{body}\0";
            var payload = Encoding.UTF8.GetBytes(frame);

            foreach (var socket in sockets.Keys)
            {
                if (socket.State != WebSocketState.Open)
                {
                    sockets.TryRemove(socket, out _);
                    continue;
                }

                try
                {
                    await socket.SendAsync(payload, WebSocketMessageType.Text, true, cancellationToken);
                }
                catch (WebSocketException)
                {
                    sockets.TryRemove(socket, out _);
                }
            }
        }
    }
}
