using Nager.Date;
using Nager.Date.Models;

namespace LeaveManagementAPI.Services
{
    public sealed class LeaveDayCalculator : ILeaveDayCalculator
    {
        public async Task<int> CalculateChargeableDaysAsync(
            DateTime startDate,
            DateTime endDate,
            CancellationToken cancellationToken = default)
        {
            var daysByYear = await CalculateChargeableDaysByYearAsync(startDate, endDate, cancellationToken);
            return daysByYear.Values.Sum();
        }

        public Task<IReadOnlyDictionary<int, int>> CalculateChargeableDaysByYearAsync(
            DateTime startDate,
            DateTime endDate,
            CancellationToken cancellationToken = default)
        {
            var start = startDate.Date;
            var end = endDate.Date;
            if (end < start)
            {
                return Task.FromResult<IReadOnlyDictionary<int, int>>(new Dictionary<int, int>());
            }

            var holidayDates = HolidaySystem.GetHolidays(start, end, CountryCode.TR)
                .Select(holiday => holiday.Date.Date)
                .ToHashSet();

            var chargeableDaysByYear = new Dictionary<int, int>();
            for (var date = start; date <= end; date = date.AddDays(1))
            {
                if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                {
                    continue;
                }

                if (holidayDates.Contains(date))
                {
                    continue;
                }

                chargeableDaysByYear[date.Year] = chargeableDaysByYear.GetValueOrDefault(date.Year) + 1;
            }

            return Task.FromResult<IReadOnlyDictionary<int, int>>(chargeableDaysByYear);
        }
    }
}
