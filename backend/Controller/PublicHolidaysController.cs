using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Models.PublicHolidays;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller;

[ApiController]
[Route("api/public-holidays")]
[Authorize]
public class PublicHolidaysController(AppDbContext context, IPublicHolidayCatalogService catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PublicHolidayResponse>>> GetAll([FromQuery] int? year, CancellationToken cancellationToken)
    {
        var requestedYear = year ?? DateTime.UtcNow.Year;
        if (requestedYear is < 1 or > 9999) return BadRequest(new { message = "Gecersiz yil." });
        var holidays = await context.PublicHolidays.AsNoTracking().Where(item => item.Date.Year == requestedYear)
            .OrderBy(item => item.Date).ToListAsync(cancellationToken);
        return Ok(holidays.Select(ToResponse));
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<PublicHolidayResponse>> Create(CreatePublicHolidayRequest request, CancellationToken cancellationToken)
    {
        var date = DateTime.SpecifyKind(request.Date.Date, DateTimeKind.Utc);
        if (await context.PublicHolidays.AnyAsync(item => item.Date == date, cancellationToken))
            return Conflict(new { message = "Bu tarih icin zaten bir tatil kaydi var." });
        var holiday = new LeaveManagementAPI.Entities.PublicHoliday { Date = date, Name = request.Name.Trim(), IsManual = true };
        context.PublicHolidays.Add(holiday);
        await context.SaveChangesAsync(cancellationToken);
        return Created($"/api/public-holidays/{holiday.Id}", ToResponse(holiday));
    }

    [HttpPut("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<PublicHolidayResponse>> Update(long id, UpdatePublicHolidayRequest request, CancellationToken cancellationToken)
    {
        var holiday = await context.PublicHolidays.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (holiday is null) return NotFound(new { message = "Tatil kaydi bulunamadi." });
        var date = DateTime.SpecifyKind(request.Date.Date, DateTimeKind.Utc);
        if (await context.PublicHolidays.AnyAsync(item => item.Id != id && item.Date == date, cancellationToken))
            return Conflict(new { message = "Bu tarih icin zaten bir tatil kaydi var." });
        holiday.Date = date;
        holiday.Name = request.Name.Trim();
        holiday.IsManual = true;
        await context.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(holiday));
    }

    [HttpDelete("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var holiday = await context.PublicHolidays.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (holiday is null) return NotFound(new { message = "Tatil kaydi bulunamadi." });
        context.PublicHolidays.Remove(holiday);
        await context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("sync")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<object>> Sync([FromQuery] int? year, CancellationToken cancellationToken)
    {
        var requestedYear = year ?? DateTime.UtcNow.Year;
        if (requestedYear is < 1 or > 9999) return BadRequest(new { message = "Gecersiz yil." });
        try
        {
            var changed = await catalog.SyncYearAsync(requestedYear, cancellationToken);
            return Ok(new { year = requestedYear, changed });
        }
        catch (HttpRequestException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Resmi tatil kaynagina su anda ulasilamiyor." });
        }
    }

    private static PublicHolidayResponse ToResponse(LeaveManagementAPI.Entities.PublicHoliday holiday) => new()
    {
        Id = holiday.Id, Date = holiday.Date, Name = holiday.Name,
        IsManual = holiday.IsManual, LastSyncedAt = holiday.LastSyncedAt
    };
}
