namespace TimesheetLite.Data;

public class ClockifyConnection
{
    public int Id { get; set; } = 1;

    public string ProtectedApiKey { get; set; } = "";

    public DateTimeOffset SavedAt { get; set; }
}
