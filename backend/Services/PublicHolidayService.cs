using System.Net.Http.Json;

namespace LeaveManagementAPI.Services;

public interface IPublicHolidayService
{
    Task<IReadOnlyList<PublicHoliday>> GetTurkishHolidaysAsync(
        int year,
        CancellationToken cancellationToken = default);
}

public sealed record PublicHoliday(DateOnly Date, string Name);

public sealed class PublicHolidayService(HttpClient httpClient) : IPublicHolidayService
{
    public async Task<IReadOnlyList<PublicHoliday>> GetTurkishHolidaysAsync(
        int year,
        CancellationToken cancellationToken = default)
    {
        var holidays = await httpClient.GetFromJsonAsync<List<NagerHoliday>>(
            $"api/v4/Holidays/TR/{year}", cancellationToken)
            ?? [];

        return holidays
            .Where(holiday => holiday.Date is not null
                && holiday.HolidayTypes?.Contains("Public", StringComparer.OrdinalIgnoreCase) == true)
            .Select(holiday => new PublicHoliday(
                DateOnly.Parse(holiday.Date!),
                holiday.LocalName ?? holiday.Name ?? string.Empty))
            .OrderBy(holiday => holiday.Date)
            .ToList();
    }

    private sealed class NagerHoliday
    {
        public string? Date { get; init; }
        public string? LocalName { get; init; }
        public string? Name { get; init; }
        public string[]? HolidayTypes { get; init; }
    }
}
