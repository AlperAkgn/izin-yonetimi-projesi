using LeaveManagementAPI.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LeaveManagementAPI.Data.Configurations;

public class MessageAttachmentConfiguration : IEntityTypeConfiguration<MessageAttachment>
{
    public void Configure(EntityTypeBuilder<MessageAttachment> builder)
    {
        builder.Property(item => item.OriginalFileName).IsRequired().HasMaxLength(255);
        builder.Property(item => item.StoredFileName).IsRequired().HasMaxLength(255);
        builder.Property(item => item.ContentType).IsRequired().HasMaxLength(128);
        builder.HasIndex(item => item.MessageId);
        builder.HasIndex(item => new { item.UploadedByUserId, item.UploadedAt });
        builder.HasOne(item => item.Message).WithMany(message => message.Attachments)
            .HasForeignKey(item => item.MessageId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(item => item.UploadedByUser).WithMany()
            .HasForeignKey(item => item.UploadedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
