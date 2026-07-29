using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LeaveManagementAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260729140000_AddRealtimeConnections")]
    public partial class AddRealtimeConnections : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RealtimeConnections",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userId = table.Column<long>(type: "bigint", nullable: false),
                    connectionId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    connectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    disconnectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RealtimeConnections", x => x.id);
                    table.ForeignKey(
                        name: "FK_RealtimeConnections_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RealtimeConnections_connectionId",
                table: "RealtimeConnections",
                column: "connectionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RealtimeConnections_disconnectedAt_userId",
                table: "RealtimeConnections",
                columns: new[] { "disconnectedAt", "userId" });

            migrationBuilder.CreateIndex(
                name: "IX_RealtimeConnections_userId",
                table: "RealtimeConnections",
                column: "userId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "RealtimeConnections");
        }
    }
}
