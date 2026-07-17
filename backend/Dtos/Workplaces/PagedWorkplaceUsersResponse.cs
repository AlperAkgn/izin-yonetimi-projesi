namespace LeaveManagementAPI.Models.Workplaces
{
    public class PagedWorkplaceUsersResponse
    {
        public int Page { get; set; }

        public int PageSize { get; set; }

        public int TotalCount { get; set; }

        public int TotalPages { get; set; }

        public List<WorkplaceUserResponse> Items { get; set; } = new();
    }
}
