using System;
using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260717120000_AddTemporaryPasswordUsage")]
    public partial class AddTemporaryPasswordUsage : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "tempPasswordUsedAt",
                table: "User",
                type: "timestamp with time zone",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tempPasswordUsedAt",
                table: "User");
        }
    }
}
