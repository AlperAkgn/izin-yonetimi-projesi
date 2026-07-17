using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260717140000_AddUserAnnualLeaveEntitlement")]
    public partial class AddUserAnnualLeaveEntitlement : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "annualLeaveCount",
                table: "UserWorkplace",
                type: "integer",
                nullable: false,
                defaultValue: 15);

            migrationBuilder.AddColumn<string>(
                name: "rejectionReason",
                table: "LeaveRequest",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE \"UserWorkplace\" AS uw " +
                "SET \"annualLeaveCount\" = w.\"leaveCount\" " +
                "FROM \"Workplaces\" AS w " +
                "WHERE uw.\"workplaceId\" = w.\"id\";");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "annualLeaveCount",
                table: "UserWorkplace");

            migrationBuilder.DropColumn(
                name: "rejectionReason",
                table: "LeaveRequest");
        }
    }
}
