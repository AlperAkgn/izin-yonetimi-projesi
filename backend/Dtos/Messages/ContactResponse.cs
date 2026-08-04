namespace LeaveManagementAPI.Models.Messages
{
    /// <summary>Yeni sohbet baslatilabilecek aktif kullanici.</summary>
    public class ContactResponse
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }
}
