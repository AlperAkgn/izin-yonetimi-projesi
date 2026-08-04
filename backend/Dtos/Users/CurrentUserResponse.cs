namespace LeaveManagementAPI.Models.Users
{
    /// <summary>
    /// Oturumdaki kullanicinin profili + aktif is yeri atamasi.
    /// Istemci, calisan/HR icin sube ve yillik izin hakkini buradan okur.
    /// </summary>
    public class CurrentUserResponse
    {
        public long Id { get; set; }

        public string Mail { get; set; } = string.Empty;

        public string Phone { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Surname { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public bool IsFirstLogin { get; set; }

        public long? WorkplaceId { get; set; }

        public string? WorkplaceName { get; set; }

        public int? AnnualLeaveCount { get; set; }
    }
}
