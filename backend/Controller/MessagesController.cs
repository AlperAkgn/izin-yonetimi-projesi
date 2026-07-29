using System.IdentityModel.Tokens.Jwt;
using LeaveManagementAPI.Models.Messages;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/messages")]
    [Authorize]
    public class MessagesController(IMessageService messageService) : ControllerBase
    {
        [HttpGet("{senderId:long}/{receiverId:long}")]
        public async Task<ActionResult<IReadOnlyList<MessageResponse>>> GetConversation(
            long senderId,
            long receiverId,
            CancellationToken cancellationToken)
        {
            if (!long.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var currentUserId))
            {
                return Unauthorized(new { message = "Gecersiz token." });
            }

            if (currentUserId != senderId && currentUserId != receiverId && !User.IsInRole("ADMIN"))
            {
                return Forbid();
            }

            try
            {
                var messages = await messageService.GetConversationAsync(senderId, receiverId, cancellationToken);
                return Ok(messages);
            }
            catch (Exception)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "Mesaj gecmisi yuklenirken bir hata olustu." });
            }
        }
    }
}
