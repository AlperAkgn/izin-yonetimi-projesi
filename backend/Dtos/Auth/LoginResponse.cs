namespace LeaveManagementAPI.Models.Auth
{
    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;

        public DateTime ExpiresAt { get; set; }

        public AuthUserResponse User { get; set; } = new();
    }
}
