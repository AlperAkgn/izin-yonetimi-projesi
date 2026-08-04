namespace LeaveManagementAPI.Models.Workplaces
{
    public class WorkplaceResponse
    {
        public long Id { get; set; }

        public string Name { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        public string City { get; set; } = string.Empty;

        public string PhoneNumber { get; set; } = string.Empty;

        public string Mail { get; set; } = string.Empty;

        public bool IsActive { get; set; }

        public int LeaveCount { get; set; } = 15;

        /// <summary>Yalnizca silinen is yerleri listesinde dolu doner.</summary>
        public DateTime? DeletedAt { get; set; }
    }
}
