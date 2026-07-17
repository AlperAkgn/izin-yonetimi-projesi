using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace LeaveManagementAPI.Services
{
    public sealed class MailService : IMailService
    {
        private readonly MailSettings _settings;
        private readonly IWebHostEnvironment _environment;

        public MailService(IOptions<MailSettings> options, IWebHostEnvironment environment)
        {
            _settings = options.Value;
            _environment = environment;
        }

        public async Task SendTemporaryPasswordAsync(
            string recipientEmail,
            string recipientName,
            string temporaryPassword,
            CancellationToken cancellationToken = default)
        {
            ValidateSettings();

            using var smtpClient = new SmtpClient(_settings.SmtpServer, _settings.Port)
            {
                EnableSsl = true,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_settings.From, GetAppPassword())
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_settings.From, _settings.SenderName),
                Subject = "İzin Yönetim Sistemi | Geçici Şifreniz",
                Body = await CreateTemporaryPasswordEmailBodyAsync(recipientName, temporaryPassword, cancellationToken),
                SubjectEncoding = System.Text.Encoding.UTF8,
                BodyEncoding = System.Text.Encoding.UTF8,
                IsBodyHtml = true
            };

            message.To.Add(recipientEmail);
            cancellationToken.ThrowIfCancellationRequested();
            await smtpClient.SendMailAsync(message);
        }

        private void ValidateSettings()
        {
            if (string.IsNullOrWhiteSpace(_settings.SmtpServer)
                || _settings.Port <= 0
                || string.IsNullOrWhiteSpace(_settings.SenderName)
                || string.IsNullOrWhiteSpace(_settings.From)
                || string.IsNullOrWhiteSpace(GetAppPassword()))
            {
                throw new InvalidOperationException(
                    "Mail ayarlari eksik. MailSettings:From ve MailSettings:Password degerlerini yapilandirin.");
            }
        }

        private string GetAppPassword()
        {
            return string.Concat(_settings.Password.Where(character => !char.IsWhiteSpace(character)));
        }

        private async Task<string> CreateTemporaryPasswordEmailBodyAsync(
            string recipientName,
            string temporaryPassword,
            CancellationToken cancellationToken)
        {
            var templatePath = Path.Combine(
                _environment.ContentRootPath,
                "EmailTemplates",
                "TemporaryPassword.html");

            if (!File.Exists(templatePath))
            {
                throw new FileNotFoundException("Gecici sifre e-posta sablonu bulunamadi.", templatePath);
            }

            var template = await File.ReadAllTextAsync(templatePath, cancellationToken);
            var safeRecipientName = WebUtility.HtmlEncode(recipientName);
            var safeTemporaryPassword = WebUtility.HtmlEncode(temporaryPassword);

            return template
                .Replace("{{RecipientName}}", safeRecipientName, StringComparison.Ordinal)
                .Replace("{{TemporaryPassword}}", safeTemporaryPassword, StringComparison.Ordinal);
        }
    }
}
