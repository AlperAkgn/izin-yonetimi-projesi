using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260727120000_AddLeaveAddressToLeaveRequest")]
    public partial class AddLeaveAddressToLeaveRequest : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "leaveAddress",
                table: "LeaveRequest",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "leaveAddress",
                table: "LeaveRequest");
        }
    }
}
