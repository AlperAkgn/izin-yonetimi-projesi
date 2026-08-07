using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Workplaces
{
    /// <summary>
    /// Kullanicinin duzeltilebilir kimlik bilgileri.
    /// Mail bilerek yok: hesabi tekil kilan alan o, degistirilemez.
    /// </summary>
    public class UpdateWorkplaceUserRequest
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Surname { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Phone { get; set; } = string.Empty;
    }
}
