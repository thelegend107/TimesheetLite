namespace TimesheetLite.Data;

public class ClockifyTaskRule
{
    public string Project { get; set; } = "";

    public string Phrase { get; set; } = "";

    public string ClockifyProjectId { get; set; } = "";

    public bool? Billable { get; set; }
}
