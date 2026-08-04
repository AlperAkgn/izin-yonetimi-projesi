using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using Microsoft.EntityFrameworkCore;
using EntityHoliday = LeaveManagementAPI.Entities.PublicHoliday;

namespace LeaveManagementAPI.Services;

public sealed class HolidayDataUnavailableException(int year) : Exception($"{year} yili icin resmi tatil verisi hazir degil.");

public interface IPublicHolidayCatalogService
{
    Task<IReadOnlyList<EntityHoliday>> GetForYearAsync(int year, CancellationToken cancellationToken = default);
    Task<int> SyncYearAsync(int year, CancellationToken cancellationToken = default);
}

/// <summary>Izinde kullanilan tatil verisinin tek kaynagi veritabanidir.</summary>
public sealed class PublicHolidayCatalogService(
    AppDbContext context,
    IPublicHolidayService remoteService) : IPublicHolidayCatalogService
{
    public async Task<IReadOnlyList<EntityHoliday>> GetForYearAsync(int year, CancellationToken cancellationToken = default)
    {
        var holidays = await context.PublicHolidays.AsNoTracking()
            .Where(holiday => holiday.Date.Year == year)
            .OrderBy(holiday => holiday.Date)
            .ToListAsync(cancellationToken);
        if (holidays.Count == 0) throw new HolidayDataUnavailableException(year);
        return holidays;
    }

    public async Task<int> SyncYearAsync(int year, CancellationToken cancellationToken = default)
    {
        // Dis kaynak ayni tarihe birden fazla kayit dondurebilir (orn. 19.05.2027:
        // Genclik ve Spor Bayrami ile Kurban Bayrami cakisiyor). Tarih kolonunda
        // benzersiz indeks oldugundan tek kayda indirgenir, isimler birlestirilir;
        // aksi halde SaveChanges tum yilin senkronunu geri aliyordu ve o yil icin
        // tatil verisi hic olusmuyordu.
        var remoteHolidays = (await remoteService.GetTurkishHolidaysAsync(year, cancellationToken))
            .GroupBy(item => item.Date)
            .Select(group => group.Count() == 1
                ? group.First()
                : new PublicHoliday(
                    group.Key,
                    string.Join(" / ", group
                        .Select(item => item.Name)
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Distinct())))
            .OrderBy(item => item.Date)
            .ToList();
        var remoteDates = remoteHolidays.Select(item => item.Date).ToHashSet();
        var existing = await context.PublicHolidays
            .Where(item => item.Date.Year == year).ToListAsync(cancellationToken);
        var existingByDate = existing.ToDictionary(item => DateOnly.FromDateTime(item.Date));
        var now = DateTime.UtcNow;
        var changed = 0;

        foreach (var remote in remoteHolidays)
        {
            var date = DateTime.SpecifyKind(remote.Date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            if (existingByDate.TryGetValue(remote.Date, out var item))
            {
                if (!item.IsManual)
                {
                    item.Name = remote.Name;
                    item.LastSyncedAt = now;
                    changed++;
                }
                continue;
            }
            context.PublicHolidays.Add(new EntityHoliday { Date = date, Name = remote.Name, IsManual = false, LastSyncedAt = now });
            changed++;
        }

        // Yalnizca daha once dis kaynaktan gelmis ve artik listede olmayan tarihleri kaldir.
        var stale = existing.Where(item => !item.IsManual && !remoteDates.Contains(DateOnly.FromDateTime(item.Date))).ToList();
        if (stale.Count > 0) { context.PublicHolidays.RemoveRange(stale); changed += stale.Count; }
        await context.SaveChangesAsync(cancellationToken);
        return changed;
    }
}
