using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Auth
{
    public class ChangePasswordRequest
    {
        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}
