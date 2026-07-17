using BCrypt.Net;
using LeaveManagementAPI.Data;
using LeaveManagementAPI.Entities;
using LeaveManagementAPI.Enums;
using LeaveManagementAPI.Models.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeaveManagementAPI.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private const string DefaultInitialPassword = "123456";

        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public UsersController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("create")]
        [Authorize(Roles = "ADMIN")]
        public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Mail)
                || string.IsNullOrWhiteSpace(request.Name)
                || string.IsNullOrWhiteSpace(request.Surname))
            {
                return BadRequest(new { message = "Mail, name ve surname alanlari bos olamaz." });
            }

            if (!TryParseAllowedRole(request.Role, out var role))
            {
                return BadRequest(new { message = "Role yalnizca EMPLOYEE, HR veya ADMIN olabilir." });
            }

            var normalizedMail = request.Mail.Trim().ToLowerInvariant();
            var mailExists = await _context.Users
                .IgnoreQueryFilters()
                .AnyAsync(u => u.Mail.ToLower() == normalizedMail);

            if (mailExists)
            {
                return Conflict(new { message = "Bu e-posta adresiyle kayitli bir kullanici zaten var." });
            }

            var user = new User
            {
                Mail = normalizedMail,
                Name = request.Name.Trim(),
                Surname = request.Surname.Trim(),
                Role = role,
                Password = BCrypt.Net.BCrypt.HashPassword(GetInitialPassword()),
                IsActive = true,
                IsTempPassword = true,
                StartAt = request.StartAt?.ToUniversalTime() ?? DateTime.UtcNow,
                DeletedAt = null
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Created($"/api/users/{user.Id}", ToResponse(user));
        }

        private static bool TryParseAllowedRole(string roleValue, out UserRole role)
        {
            role = default;
            var normalizedRole = roleValue.Trim().ToUpperInvariant();

            if (!Enum.TryParse(normalizedRole, ignoreCase: false, out UserRole parsedRole))
            {
                return false;
            }

            if (parsedRole is not (UserRole.EMPLOYEE or UserRole.HR or UserRole.ADMIN))
            {
                return false;
            }

            role = parsedRole;
            return true;
        }

        private string GetInitialPassword()
        {
            var configuredPassword = _configuration["UserDefaults:InitialPassword"];
            return string.IsNullOrWhiteSpace(configuredPassword)
                ? DefaultInitialPassword
                : configuredPassword;
        }

        private static UserResponse ToResponse(User user)
        {
            return new UserResponse
            {
                Id = user.Id,
                Mail = user.Mail,
                Name = user.Name,
                Surname = user.Surname,
                Role = user.Role.ToString(),
                IsActive = user.IsActive,
                IsFirstLogin = user.IsTempPassword,
                StartAt = user.StartAt
            };
        }
    }
}
