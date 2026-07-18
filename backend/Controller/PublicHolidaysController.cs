using LeaveManagementAPI.Models.PublicHolidays;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nager.Date;
using Nager.Date.Models;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PublicHolidaysController : ControllerBase
    {
        [HttpGet]
        public ActionResult<IEnumerable<PublicHolidayResponse>> GetAll([FromQuery] int? year)
        {
            if (year is < 1 or > 9999)
            {
                return BadRequest(new { message = "Gecersiz yil." });
            }

            var requestedYear = year ?? DateTime.UtcNow.Year;
            var response = HolidaySystem.GetHolidays(requestedYear, CountryCode.TR)
                .OrderBy(holiday => holiday.Date)
                .Select(holiday => new PublicHolidayResponse
                {
                    Id = 0,
                    Date = DateTime.SpecifyKind(holiday.Date.Date, DateTimeKind.Utc),
                    Name = holiday.LocalName
                })
                .ToList();

            return Ok(response);
        }
    }
}
