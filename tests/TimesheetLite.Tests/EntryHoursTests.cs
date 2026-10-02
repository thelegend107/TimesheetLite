using TimesheetLite.Services;

namespace TimesheetLite.Tests;

public class EntryHoursTests
{
    [Theory]
    [InlineData("08:00", "10:45", 2.75)]
    [InlineData("16:45", "17:00", 0.25)]
    [InlineData("08:00", "08:35", 0.58)]
    [InlineData("08:00", "08:01", 0.02)]
    [InlineData("20:00", "00:00", 4.00)]
    [InlineData("22:00", "01:00", 3.00)]
    [InlineData("23:30", "00:15", 0.75)]
    [InlineData("16:45", "05:00", 12.25)]
    [InlineData("08:00", "08:00", 24.00)]
    public void Between_wraps_past_midnight_and_rounds_to_two_places(string start, string end, double expected)
    {
        Assert.Equal((decimal)expected, EntryHours.Between(TimeOnly.Parse(start), TimeOnly.Parse(end)));
    }
}
