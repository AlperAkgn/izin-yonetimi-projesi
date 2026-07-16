using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Auth
{
    public class LoginRequest
    {
        [Required]
        [EmailAddress]
        public string Mail { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}
