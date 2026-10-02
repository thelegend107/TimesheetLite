namespace TimesheetLite.Data;

public class ClockifyEntryLink
{
    public int TimeEntryId { get; set; }

    public DateOnly WorkDate { get; set; }

    public string WorkspaceId { get; set; } = "";

    public string ClockifyEntryId { get; set; } = "";

    public string Fingerprint { get; set; } = "";

    public string Label { get; set; } = "";

    public DateTimeOffset SyncedAt { get; set; }
}
