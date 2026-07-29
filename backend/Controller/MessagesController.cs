using System.IdentityModel.Tokens.Jwt;
using LeaveManagementAPI.Models.Messages;
using LeaveManagementAPI.Services;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/messages")]
    [Authorize]
    public class MessagesController(
        IMessageService messageService,
        AppDbContext context,
        IWebHostEnvironment environment) : ControllerBase
    {
        private const long MaxAttachmentBytes = 5 * 1024 * 1024;
        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "video/mp4", "audio/mpeg", "audio/wav"
        };
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
                await messageService.MarkConversationReadAsync(currentUserId,
                    currentUserId == senderId ? receiverId : senderId, cancellationToken);
                return Ok(messages);
            }
            catch (Exception)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "Mesaj gecmisi yuklenirken bir hata olustu." });
            }
        }

        [HttpPost("attachments")]
        [RequestSizeLimit(MaxAttachmentBytes)]
        public async Task<ActionResult<AttachmentResponse>> UploadAttachment(
            IFormFile file,
            CancellationToken cancellationToken)
        {
            if (!TryGetCurrentUserId(out var userId)) return Unauthorized(new { message = "Gecersiz token." });
            if (file is null || file.Length == 0) return BadRequest(new { message = "Dosya zorunludur." });
            if (file.Length > MaxAttachmentBytes) return BadRequest(new { message = "Dosya boyutu en fazla 5 MB olabilir." });
            if (!AllowedContentTypes.Contains(file.ContentType)) return BadRequest(new { message = "Bu dosya turune izin verilmiyor." });

            var uploadsDirectory = Path.Combine(environment.ContentRootPath, "App_Data", "message-uploads");
            Directory.CreateDirectory(uploadsDirectory);
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var storedFileName = $"{Guid.NewGuid():N}{extension}";
            var filePath = Path.Combine(uploadsDirectory, storedFileName);
            await using (var output = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(output, cancellationToken);
            }

            var attachment = new MessageAttachment
            {
                UploadedByUserId = userId,
                OriginalFileName = Path.GetFileName(file.FileName),
                StoredFileName = storedFileName,
                ContentType = file.ContentType,
                SizeBytes = file.Length,
                UploadedAt = DateTime.UtcNow
            };
            context.MessageAttachments.Add(attachment);
            await context.SaveChangesAsync(cancellationToken);
            return Created($"/api/messages/attachments/{attachment.Id}", ToAttachmentResponse(attachment));
        }

        [HttpGet("attachments/{id:long}")]
        public async Task<IActionResult> DownloadAttachment(long id, CancellationToken cancellationToken)
        {
            if (!TryGetCurrentUserId(out var userId)) return Unauthorized(new { message = "Gecersiz token." });
            var attachment = await context.MessageAttachments
                .Include(item => item.Message)
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (attachment is null) return NotFound(new { message = "Dosya bulunamadi." });
            if (attachment.MessageId is null)
            {
                if (attachment.UploadedByUserId != userId) return Forbid();
            }
            else if (attachment.Message!.SenderId != userId && attachment.Message.ReceiverId != userId && !User.IsInRole("ADMIN"))
            {
                return Forbid();
            }

            var path = Path.Combine(environment.ContentRootPath, "App_Data", "message-uploads", attachment.StoredFileName);
            if (!System.IO.File.Exists(path)) return NotFound(new { message = "Dosya depoda bulunamadi." });
            return PhysicalFile(path, attachment.ContentType, attachment.OriginalFileName);
        }

        private bool TryGetCurrentUserId(out long userId) =>
            long.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out userId);

        private static AttachmentResponse ToAttachmentResponse(MessageAttachment attachment) => new()
        {
            Id = attachment.Id, FileName = attachment.OriginalFileName, ContentType = attachment.ContentType,
            SizeBytes = attachment.SizeBytes, DownloadUrl = $"/api/messages/attachments/{attachment.Id}"
        };
    }
}
