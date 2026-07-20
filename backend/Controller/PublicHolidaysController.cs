using LeaveManagementAPI.Models.PublicHolidays;
using LeaveManagementAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PublicHolidaysController(IPublicHolidayService publicHolidayService) : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PublicHolidayResponse>>> GetAll(
            [FromQuery] int? year,
            CancellationToken cancellationToken)
        {
            if (year is < 1 or > 9999)
            {
                return BadRequest(new { message = "Gecersiz yil." });
            }

            var requestedYear = year ?? DateTime.UtcNow.Year;
            IReadOnlyList<PublicHoliday> holidays;
            try
            {
                holidays = await publicHolidayService.GetTurkishHolidaysAsync(requestedYear, cancellationToken);
            }
            catch (HttpRequestException)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "Resmi tatil servisine su anda ulasilamiyor." });
            }

            var response = holidays
                .Select(holiday => new PublicHolidayResponse
                {
                    Id = 0,
                    Date = DateTime.SpecifyKind(holiday.Date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                    Name = holiday.Name
                })
                .ToList();

            return Ok(response);
        }
    }
}
