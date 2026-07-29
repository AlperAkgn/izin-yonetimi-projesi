using System.Net.WebSockets;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using LeaveManagementAPI.Models.Messages;
using LeaveManagementAPI.Services;

namespace LeaveManagementAPI.WebSockets
{
    public class StompWebSocketMiddleware(RequestDelegate next, ILogger<StompWebSocketMiddleware> logger)
    {
        private const string WebSocketPath = "/ws";
        private const string SendDestination = "/app/chat.send";
        private const string UserQueuePrefix = "/user/";
        private const string UserQueueSuffix = "/queue/messages";
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        public async Task InvokeAsync(HttpContext context, IMessageService messageService, IStompMessageBroker messageBroker)
        {
            if (!context.Request.Path.Equals(WebSocketPath, StringComparison.OrdinalIgnoreCase))
            {
                await next(context);
                return;
            }

            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("Bu endpoint bir WebSocket baglantisi bekler.");
                return;
            }

            if (!long.TryParse(context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var currentUserId))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("WebSocket baglantisi icin gecerli bir access_token zorunludur.");
                return;
            }

            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            try
            {
                await ProcessFramesAsync(socket, currentUserId, messageService, messageBroker, context.RequestAborted);
            }
            catch (WebSocketException exception)
            {
                logger.LogDebug(exception, "STOMP WebSocket baglantisi kapatildi.");
            }
            finally
            {
                messageBroker.Unsubscribe(socket);
            }
        }

        private async Task ProcessFramesAsync(
            WebSocket socket,
            long currentUserId,
            IMessageService messageService,
            IStompMessageBroker messageBroker,
            CancellationToken cancellationToken)
        {
            while (socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                var frame = await ReceiveFrameAsync(socket, cancellationToken);
                if (frame is null)
                {
                    return;
                }

                var parsedFrame = ParseFrame(frame);
                switch (parsedFrame.Command)
                {
                    case "CONNECT":
                    case "STOMP":
                        await SendFrameAsync(socket, "CONNECTED\nversion:1.2\n\n\0", cancellationToken);
                        break;

                    case "SUBSCRIBE":
                        await SubscribeAsync(socket, currentUserId, parsedFrame.Headers, messageBroker, cancellationToken);
                        break;

                    case "SEND":
                        await SendMessageAsync(socket, currentUserId, parsedFrame, messageService, messageBroker, cancellationToken);
                        break;

                    case "DISCONNECT":
                        return;

                    default:
                        await SendErrorAsync(socket, "Desteklenmeyen STOMP komutu.", cancellationToken);
                        break;
                }
            }
        }

        private static async Task SubscribeAsync(
            WebSocket socket,
            long currentUserId,
            IReadOnlyDictionary<string, string> headers,
            IStompMessageBroker messageBroker,
            CancellationToken cancellationToken)
        {
            if (!headers.TryGetValue("destination", out var destination)
                || !TryGetUserId(destination, out var userId))
            {
                await SendErrorAsync(socket, "Gecersiz abonelik kanali.", cancellationToken);
                return;
            }

            if (userId != currentUserId)
            {
                await SendErrorAsync(socket, "Yalnizca kendi mesaj kanalina abone olabilirsiniz.", cancellationToken);
                return;
            }

            messageBroker.Subscribe(userId, socket);
        }

        private static async Task SendMessageAsync(
            WebSocket socket,
            long currentUserId,
            StompFrame frame,
            IMessageService messageService,
            IStompMessageBroker messageBroker,
            CancellationToken cancellationToken)
        {
            if (!frame.Headers.TryGetValue("destination", out var destination)
                || !string.Equals(destination, SendDestination, StringComparison.Ordinal))
            {
                await SendErrorAsync(socket, "Gecersiz mesaj hedefi.", cancellationToken);
                return;
            }

            SendMessageRequest? request;
            try
            {
                request = JsonSerializer.Deserialize<SendMessageRequest>(frame.Body, JsonOptions);
            }
            catch (JsonException)
            {
                await SendErrorAsync(socket, "Mesaj formati gecersiz.", cancellationToken);
                return;
            }

            if (request is null)
            {
                await SendErrorAsync(socket, "Mesaj govdesi zorunludur.", cancellationToken);
                return;
            }

            if (request.SenderId != currentUserId)
            {
                await SendErrorAsync(socket, "SenderId oturumdaki kullanici ile eslesmiyor.", cancellationToken);
                return;
            }

            try
            {
                var response = await messageService.SendAsync(request, cancellationToken);
                await messageBroker.PublishToUserAsync(response.ReceiverId, response, cancellationToken);
                await messageBroker.PublishToUserAsync(response.SenderId, response, cancellationToken);
                await SendFrameAsync(socket, $"RECEIPT\nreceipt-id:{response.Id}\n\n\0", cancellationToken);
            }
            catch (ArgumentException exception)
            {
                await SendErrorAsync(socket, exception.Message, cancellationToken);
            }
            catch (KeyNotFoundException exception)
            {
                await SendErrorAsync(socket, exception.Message, cancellationToken);
            }
            catch (Exception)
            {
                await SendErrorAsync(socket, "Mesaj kaydedilirken beklenmeyen bir hata olustu.", cancellationToken);
            }
        }

        private static bool TryGetUserId(string destination, out long userId)
        {
            userId = 0;
            if (!destination.StartsWith(UserQueuePrefix, StringComparison.Ordinal)
                || !destination.EndsWith(UserQueueSuffix, StringComparison.Ordinal))
            {
                return false;
            }

            var idText = destination[UserQueuePrefix.Length..^UserQueueSuffix.Length];
            return long.TryParse(idText, out userId) && userId > 0;
        }

        private static async Task<string?> ReceiveFrameAsync(WebSocket socket, CancellationToken cancellationToken)
        {
            var buffer = new byte[4096];
            await using var stream = new MemoryStream();
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(buffer, cancellationToken);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "Baglanti kapatildi.", cancellationToken);
                    return null;
                }

                stream.Write(buffer, 0, result.Count);
            }
            while (!result.EndOfMessage);

            return Encoding.UTF8.GetString(stream.ToArray()).TrimEnd('\0');
        }

        private static StompFrame ParseFrame(string frame)
        {
            var sections = frame.Replace("\r\n", "\n").Split("\n\n", 2, StringSplitOptions.None);
            var lines = sections[0].Split('\n', StringSplitOptions.None);
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var line in lines.Skip(1))
            {
                var separatorIndex = line.IndexOf(':');
                if (separatorIndex > 0)
                {
                    headers[line[..separatorIndex]] = line[(separatorIndex + 1)..];
                }
            }

            return new StompFrame(lines[0], headers, sections.Length > 1 ? sections[1] : string.Empty);
        }

        private static Task SendErrorAsync(WebSocket socket, string message, CancellationToken cancellationToken) =>
            SendFrameAsync(socket, $"ERROR\nmessage:{message}\n\n{message}\0", cancellationToken);

        private static Task SendFrameAsync(WebSocket socket, string frame, CancellationToken cancellationToken) =>
            socket.SendAsync(Encoding.UTF8.GetBytes(frame), WebSocketMessageType.Text, true, cancellationToken);

        private sealed record StompFrame(string Command, IReadOnlyDictionary<string, string> Headers, string Body);
    }
}
