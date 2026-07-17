namespace LeaveManagementAPI.Models.PublicHolidays
{
    public class PublicHolidayResponse
    {
        public long Id { get; set; }
        public DateTime Date { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
