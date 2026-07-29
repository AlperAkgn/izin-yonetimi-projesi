namespace LeaveManagementAPI.Models.Messages;

public class AttachmentResponse
{
    public long Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string DownloadUrl { get; set; } = string.Empty;
}
