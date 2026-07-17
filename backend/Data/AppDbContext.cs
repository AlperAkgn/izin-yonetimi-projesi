using Microsoft.EntityFrameworkCore;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Enums;

namespace LeaveManagementAPI.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Workplace> Workplaces { get; set; }
        public DbSet<LeaveRequest> LeaveRequests { get; set; }
        public DbSet<LeaveRequestAudit> LeaveRequestAudits { get; set; }
        public DbSet<UserWorkplace> UserWorkplaces { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>()
                .Property(u => u.Role)
                .HasConversion<string>()
                .HasMaxLength(32);

            modelBuilder.Entity<LeaveRequest>()
                .Property(lr => lr.LeaveType)
                .HasConversion<string>()
                .HasMaxLength(32);

            modelBuilder.Entity<LeaveRequest>()
                .Property(lr => lr.Status)
                .HasConversion<string>()
                .HasMaxLength(32);

            modelBuilder.Entity<LeaveRequestAudit>()
                .Property(a => a.ActionType)
                .HasConversion<string>()
                .HasMaxLength(32);

            modelBuilder.Entity<Workplace>()
                .Property(w => w.LeaveCount)
                .HasDefaultValue(15);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (!string.IsNullOrEmpty(property.Name))
                    {
                        property.SetColumnName(char.ToLowerInvariant(property.Name[0]) + property.Name[1..]);
                    }
                }
            }

            // UserWorkplace composite primary key
            modelBuilder.Entity<UserWorkplace>()
                .HasKey(uw => new { uw.UserId, uw.WorkplaceId });

            // UserWorkplace -> User ilişkisi
            modelBuilder.Entity<UserWorkplace>()
                .HasOne(uw => uw.User)
                .WithMany(u => u.UserWorkplaces)
                .HasForeignKey(uw => uw.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // UserWorkplace -> Workplace ilişkisi
            modelBuilder.Entity<UserWorkplace>()
                .HasOne(uw => uw.Workplace)
                .WithMany(w => w.UserWorkplaces)
                .HasForeignKey(uw => uw.WorkplaceId)
                .OnDelete(DeleteBehavior.Restrict);

            // LeaveRequest -> User ilişkisi
            modelBuilder.Entity<LeaveRequest>()
                .HasOne(lr => lr.User)
                .WithMany(u => u.LeaveRequests)
                .HasForeignKey(lr => lr.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // LeaveRequest -> Workplace ilişkisi
            modelBuilder.Entity<LeaveRequest>()
                .HasOne(lr => lr.Workplace)
                .WithMany(w => w.LeaveRequests)
                .HasForeignKey(lr => lr.WorkplaceId)
                .OnDelete(DeleteBehavior.Restrict);

            // LeaveRequestAudit -> LeaveRequest ilişkisi
            modelBuilder.Entity<LeaveRequestAudit>()
                .HasOne(a => a.LeaveRequest)
                .WithMany(lr => lr.Audits)
                .HasForeignKey(a => a.LeaveRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            // LeaveRequestAudit -> User ilişkisi
            modelBuilder.Entity<LeaveRequestAudit>()
                .HasOne(a => a.ActionByUser)
                .WithMany(u => u.LeaveRequestAudits)
                .HasForeignKey(a => a.ActionByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Unique index: User.Mail
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Mail)
                .IsUnique();

            // Global query filters (soft delete)
            modelBuilder.Entity<User>().HasQueryFilter(u => u.DeletedAt == null);
            modelBuilder.Entity<Workplace>().HasQueryFilter(w => w.DeletedAt == null);
            modelBuilder.Entity<LeaveRequest>().HasQueryFilter(lr => lr.DeletedAt == null);
        }
    }
}
