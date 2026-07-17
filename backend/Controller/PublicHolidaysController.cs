using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Models.PublicHolidays;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PublicHolidaysController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PublicHolidaysController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PublicHolidayResponse>>> GetAll([FromQuery] int? year)
        {
            if (year is < 1 or > 9999)
            {
                return BadRequest(new { message = "Gecersiz yil." });
            }

            var holidays = _context.PublicHolidays.AsQueryable();
            if (year is not null)
            {
                var start = new DateTime(year.Value, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var end = start.AddYears(1);
                holidays = holidays.Where(holiday => holiday.Date >= start && holiday.Date < end);
            }

            var response = await holidays
                .OrderBy(holiday => holiday.Date)
                .Select(holiday => ToResponse(holiday))
                .ToListAsync();

            return Ok(response);
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<PublicHolidayResponse>> Create(
            CreatePublicHolidayRequest request,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Tatil adi bos olamaz." });
            }

            var date = DateTime.SpecifyKind(request.Date.Date, DateTimeKind.Utc);
            var exists = await _context.PublicHolidays
                .AnyAsync(holiday => holiday.Date == date, cancellationToken);
            if (exists)
            {
                return Conflict(new { message = "Bu tarih icin zaten resmi tatil kaydi var." });
            }

            var holiday = new PublicHoliday
            {
                Date = date,
                Name = request.Name.Trim()
            };
            _context.PublicHolidays.Add(holiday);
            await _context.SaveChangesAsync(cancellationToken);

            return Created($"/api/public-holidays/{holiday.Id}", ToResponse(holiday));
        }

        [HttpDelete("{id:long}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
        {
            var holiday = await _context.PublicHolidays
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (holiday is null)
            {
                return NotFound(new { message = "Resmi tatil bulunamadi." });
            }

            _context.PublicHolidays.Remove(holiday);
            await _context.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        private static PublicHolidayResponse ToResponse(PublicHoliday holiday)
        {
            return new PublicHolidayResponse
            {
                Id = holiday.Id,
                Date = holiday.Date,
                Name = holiday.Name
            };
        }
    }
}
