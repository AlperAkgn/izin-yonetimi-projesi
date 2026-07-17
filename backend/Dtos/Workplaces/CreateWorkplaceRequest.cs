using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Workplaces
{
    public class CreateWorkplaceRequest
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Address { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(256)]
        public string Mail { get; set; } = string.Empty;

        [Range(0, int.MaxValue)]
        public int? LeaveCount { get; set; }
    }
}
