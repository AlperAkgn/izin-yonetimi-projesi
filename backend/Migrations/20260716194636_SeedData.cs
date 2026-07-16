using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    /// <inheritdoc />
    public partial class SeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "User" ("role", "mail", "password", "name", "surname", "isActive", "isTempPassword", "startAt", "deletedAt")
                SELECT 'ADMIN',
                       'admin@permitflow.com',
                       '$2a$11$1kAZn3prOFWY1mSlglLP2e5wmIZDg0aII/nVE7R84Asji6lhnIloi',
                       'System',
                       'Admin',
                       TRUE,
                       TRUE,
                       NOW(),
                       NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM "User" WHERE "mail" = 'admin@permitflow.com'
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM "User"
                WHERE "mail" = 'admin@permitflow.com'
                  AND "role" = 'ADMIN';
                """);
        }
    }
}
