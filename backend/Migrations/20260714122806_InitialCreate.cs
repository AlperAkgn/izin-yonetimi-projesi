using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    mail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    password = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    token = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    expToken = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    surname = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    isActive = table.Column<bool>(type: "boolean", nullable: false),
                    isTempPassword = table.Column<bool>(type: "boolean", nullable: false),
                    startAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "Workplaces",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    surname = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    phoneNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    mail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    isActive = table.Column<bool>(type: "boolean", nullable: false),
                    leaveCount = table.Column<int>(type: "integer", nullable: false),
                    deletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workplaces", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "LeaveRequest",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userId = table.Column<long>(type: "bigint", nullable: false),
                    workplaceId = table.Column<long>(type: "bigint", nullable: false),
                    leaveType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    startDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    endDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    emergencyContact = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    deletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaveRequest", x => x.id);
                    table.ForeignKey(
                        name: "FK_LeaveRequest_User_UserId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaveRequest_Workplaces_WorkplaceId",
                        column: x => x.workplaceId,
                        principalTable: "Workplaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserWorkplace",
                columns: table => new
                {
                    userId = table.Column<long>(type: "bigint", nullable: false),
                    workplaceId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserWorkplace", x => new { x.userId, x.workplaceId });
                    table.ForeignKey(
                        name: "FK_UserWorkplace_User_UserId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserWorkplace_Workplaces_WorkplaceId",
                        column: x => x.workplaceId,
                        principalTable: "Workplaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeaveRequestAudit",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    leaveRequestId = table.Column<long>(type: "bigint", nullable: false),
                    actionByUserId = table.Column<long>(type: "bigint", nullable: false),
                    actionType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    actionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaveRequestAudit", x => x.id);
                    table.ForeignKey(
                        name: "FK_LeaveRequestAudit_LeaveRequest_LeaveRequestId",
                        column: x => x.leaveRequestId,
                        principalTable: "LeaveRequest",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeaveRequestAudit_User_ActionByUserId",
                        column: x => x.actionByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequest_UserId",
                table: "LeaveRequest",
                column: "userId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequest_WorkplaceId",
                table: "LeaveRequest",
                column: "workplaceId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequestAudit_ActionByUserId",
                table: "LeaveRequestAudit",
                column: "actionByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequestAudit_LeaveRequestId",
                table: "LeaveRequestAudit",
                column: "leaveRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_User_Mail",
                table: "User",
                column: "mail",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserWorkplace_WorkplaceId",
                table: "UserWorkplace",
                column: "workplaceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaveRequestAudit");

            migrationBuilder.DropTable(
                name: "UserWorkplace");

            migrationBuilder.DropTable(
                name: "LeaveRequest");

            migrationBuilder.DropTable(
                name: "User");

            migrationBuilder.DropTable(
                name: "Workplaces");
        }
    }
}
