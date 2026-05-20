namespace TimesheetLite.Data;

public class TimeEntry
{
    public int Id { get; set; }

    public DateTime WorkDate { get; set; } = DateTime.Today;

    public string Project { get; set; } = "";

    public string? Task { get; set; }

    public decimal Hours { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedDate { get; set; } = DateTimeOffset.Now;

    public DateTimeOffset UpdatedDate { get; set; } = DateTimeOffset.Now;
}
