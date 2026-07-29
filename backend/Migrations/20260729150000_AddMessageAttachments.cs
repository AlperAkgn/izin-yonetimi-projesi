using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LeaveManagementAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260729150000_AddMessageAttachments")]
public partial class AddMessageAttachments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "MessageAttachments",
            columns: table => new
            {
                id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                messageId = table.Column<long>(type: "bigint", nullable: true),
                uploadedByUserId = table.Column<long>(type: "bigint", nullable: false),
                originalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                storedFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                contentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                sizeBytes = table.Column<long>(type: "bigint", nullable: false),
                uploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_MessageAttachments", x => x.id);
                table.ForeignKey("FK_MessageAttachments_Messages_messageId", x => x.messageId,
                    "Messages", "id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_MessageAttachments_User_uploadedByUserId", x => x.uploadedByUserId,
                    "User", "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_MessageAttachments_messageId", "MessageAttachments", "messageId");
        migrationBuilder.CreateIndex("IX_MessageAttachments_uploadedByUserId_uploadedAt", "MessageAttachments", new[] { "uploadedByUserId", "uploadedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "MessageAttachments");
}
