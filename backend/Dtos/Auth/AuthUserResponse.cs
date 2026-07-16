namespace LeaveManagementAPI.Models.Auth
{
    public class AuthUserResponse
    {
        public long Id { get; set; }

        public string Mail { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Surname { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public bool IsFirstLogin { get; set; }
    }
}
