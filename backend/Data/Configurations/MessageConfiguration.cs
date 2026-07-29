using LeaveManagementAPI.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LeaveManagementAPI.Data.Configurations
{
    public class MessageConfiguration : IEntityTypeConfiguration<Message>
    {
        public void Configure(EntityTypeBuilder<Message> builder)
        {
            builder.ToTable("Messages");

            builder.HasKey(message => message.Id);

            builder.Property(message => message.Content)
                .IsRequired()
                .HasMaxLength(4000);

            builder.Property(message => message.Timestamp)
                .IsRequired()
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            builder.Property(message => message.IsRead)
                .IsRequired()
                .HasDefaultValue(false);

            builder.HasOne(message => message.Sender)
                .WithMany()
                .HasForeignKey(message => message.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(message => message.Receiver)
                .WithMany()
                .HasForeignKey(message => message.ReceiverId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(message => new { message.ReceiverId, message.Timestamp });
            builder.HasIndex(message => new { message.SenderId, message.Timestamp });
        }
    }
}
