namespace TimesheetLite.Clockify;

public sealed class ClockifyOptions
{
    public string? ApiKey { get; set; }

    public string BaseUrl { get; set; } = "https://api.clockify.me/api/v1";

    public string? WorkspaceId { get; set; }

    public string? TimeZone { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
