using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeaveManagementAPI.Entities
{
    [Table("PublicHoliday")]
    public class PublicHoliday
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        public DateTime Date { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        /// <summary>Yonetici tarafindan girilen kayitlar dis senkronizasyonda ezilmez.</summary>
        [Required]
        public bool IsManual { get; set; }

        public DateTime? LastSyncedAt { get; set; }
    }
}
