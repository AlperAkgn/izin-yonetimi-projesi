namespace LeaveManagementAPI.Services
{
    public sealed class LeaveDayCalculator(IPublicHolidayService publicHolidayService) : ILeaveDayCalculator
    {
        public async Task<int> CalculateChargeableDaysAsync(
            DateTime startDate,
            DateTime endDate,
            CancellationToken cancellationToken = default)
        {
            var daysByYear = await CalculateChargeableDaysByYearAsync(startDate, endDate, cancellationToken);
            return daysByYear.Values.Sum();
        }

        public async Task<IReadOnlyDictionary<int, int>> CalculateChargeableDaysByYearAsync(
            DateTime startDate,
            DateTime endDate,
            CancellationToken cancellationToken = default)
        {
            var start = startDate.Date;
            var end = endDate.Date;
            if (end < start)
            {
                return new Dictionary<int, int>();
            }

            var holidaysByYear = await Task.WhenAll(
                Enumerable.Range(start.Year, end.Year - start.Year + 1)
                    .Select(year => publicHolidayService.GetTurkishHolidaysAsync(year, cancellationToken)));
            var holidayDates = holidaysByYear
                .SelectMany(holidays => holidays)
                .Select(holiday => holiday.Date.ToDateTime(TimeOnly.MinValue))
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

            return chargeableDaysByYear;
        }
    }
}
