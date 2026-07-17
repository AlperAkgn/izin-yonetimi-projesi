namespace LeaveManagementAPI.Models.Workplaces
{
    public class WorkplaceUserResponse
    {
        public long Id { get; set; }

        public string Mail { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Surname { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public bool IsActive { get; set; }

        public int AnnualLeaveCount { get; set; }
    }
}
