namespace TimesheetLite.Services;

public static class EntryHours
{
    public static decimal Between(TimeOnly start, TimeOnly end)
    {
        var duration = end - start;

        if (duration <= TimeSpan.Zero)
        {
            duration += TimeSpan.FromDays(1);
        }

        return decimal.Round((decimal)duration.TotalHours, 2);
    }
}
