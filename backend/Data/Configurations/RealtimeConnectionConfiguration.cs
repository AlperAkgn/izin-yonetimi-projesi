using LeaveManagementAPI.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LeaveManagementAPI.Data.Configurations
{
    public class RealtimeConnectionConfiguration : IEntityTypeConfiguration<RealtimeConnection>
    {
        public void Configure(EntityTypeBuilder<RealtimeConnection> builder)
        {
            builder.ToTable("RealtimeConnections");
            builder.HasKey(connection => connection.Id);

            builder.Property(connection => connection.ConnectionId)
                .IsRequired()
                .HasMaxLength(64);

            builder.HasIndex(connection => connection.ConnectionId)
                .IsUnique();
            builder.HasIndex(connection => new { connection.DisconnectedAt, connection.UserId });

            builder.HasOne(connection => connection.User)
                .WithMany()
                .HasForeignKey(connection => connection.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
