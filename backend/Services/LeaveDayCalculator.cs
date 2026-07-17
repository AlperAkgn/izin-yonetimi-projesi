using LeaveManagementAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Services
{
    public sealed class LeaveDayCalculator : ILeaveDayCalculator
    {
        private readonly AppDbContext _context;

        public LeaveDayCalculator(AppDbContext context)
        {
            _context = context;
        }

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

            var publicHolidays = await _context.PublicHolidays
                .Where(holiday => holiday.Date >= start && holiday.Date <= end)
                .Select(holiday => holiday.Date)
                .ToListAsync(cancellationToken);

            var holidayDates = publicHolidays
                .Select(holiday => holiday.Date)
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
