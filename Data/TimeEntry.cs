namespace TimesheetLite.Data;

public class TimeEntry
{
    public int Id { get; set; }

    public DateOnly WorkDate { get; set; }

    public string Project { get; set; } = "";

    public string Task { get; set; } = "";

    public TimeOnly? StartTime { get; set; }

    public TimeOnly? EndTime { get; set; }

    public decimal Hours { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedDate { get; set; }

    public DateTimeOffset UpdatedDate { get; set; }
}
