using System.ComponentModel.DataAnnotations;

namespace LeaveManagementAPI.Models.Workplaces
{
    public class MoveWorkplaceUserRequest
    {
        [Range(1, long.MaxValue)]
        public long TargetWorkplaceId { get; set; }
    }
}
