using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Users
{
    public class CreateUserRequest
    {
        [Required]
        [EmailAddress]
        public string Mail { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Surname { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        public DateTime? StartAt { get; set; }
    }
}
