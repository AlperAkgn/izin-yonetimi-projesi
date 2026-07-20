namespace LeaveManagementAPI.Services
{
    public interface ILeaveDayCalculator
    {
        Task<int> CalculateChargeableDaysAsync(
            DateTime startDate,
            DateTime endDate,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyDictionary<int, int>> CalculateChargeableDaysByYearAsync(
            DateTime startDate,
            DateTime endDate,
            CancellationToken cancellationToken = default);
    }
}
