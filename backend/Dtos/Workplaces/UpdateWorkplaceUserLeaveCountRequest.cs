using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Workplaces
{
    public class UpdateWorkplaceUserLeaveCountRequest
    {
        [Range(0, int.MaxValue)]
        public int AnnualLeaveCount { get; set; }
    }
}
