namespace LeaveManagementAPI.Models.Users
{
    /// <summary>Soft-delete edilmiş kullanıcı — "Silinenler" ekranı için.</summary>
    public class DeletedUserResponse
    {
        public long Id { get; set; }

        public string Mail { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Surname { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public DateTime DeletedAt { get; set; }

        public long? WorkplaceId { get; set; }

        public string? WorkplaceName { get; set; }
    }
}
