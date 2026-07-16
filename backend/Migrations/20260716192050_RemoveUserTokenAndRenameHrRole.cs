using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUserTokenAndRenameHrRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"User\" SET role = 'HR' WHERE role = 'HK';");

            migrationBuilder.DropColumn(
                name: "token",
                table: "User");

            migrationBuilder.DropColumn(
                name: "expToken",
                table: "User");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "token",
                table: "User",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "expToken",
                table: "User",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
