using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeaveManagementAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260729160000_AddPublicHolidaySyncMetadata")]
public partial class AddPublicHolidaySyncMetadata : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(name: "isManual", table: "PublicHoliday", type: "boolean", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<DateTime>(name: "lastSyncedAt", table: "PublicHoliday", type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "isManual", table: "PublicHoliday");
        migrationBuilder.DropColumn(name: "lastSyncedAt", table: "PublicHoliday");
    }
}
