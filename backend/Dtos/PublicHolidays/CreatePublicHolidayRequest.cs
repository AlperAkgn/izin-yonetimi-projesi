using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.PublicHolidays
{
    public class CreatePublicHolidayRequest
    {
        [Required]
        public DateTime Date { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
    }
}
