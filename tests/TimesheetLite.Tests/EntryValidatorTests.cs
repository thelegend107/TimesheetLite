using TimesheetLite.Api.Contracts;
using TimesheetLite.Services;

namespace TimesheetLite.Tests;

public class EntryValidatorTests
{
    private static CreateEntryRequest Request(string project = "Contoso", string task = "Standup", string start = "08:00", string end = "08:15", string? notes = null, string date = "2026-10-02") => new()
    {
        Date = DateOnly.Parse(date),
        Project = project,
        Task = task,
        Start = TimeOnly.Parse(start),
        End = TimeOnly.Parse(end),
        Notes = notes
    };

    [Fact]
    public void Valid_request_is_trimmed_and_gets_calculated_hours()
    {
        var outcome = EntryValidator.Validate(Request(project: "  Contoso ", task: " Standup + wrapping up  ", start: "16:45", end: "17:30"));

        Assert.NotNull(outcome.Entry);
        Assert.Empty(outcome.Errors);
        Assert.Equal("Contoso", outcome.Entry.Project);
        Assert.Equal("Standup + wrapping up", outcome.Entry.Task);
        Assert.Equal(0.75m, outcome.Entry.Hours);
    }

    [Theory]
    [InlineData("", "project")]
    [InlineData("   ", "project")]
    public void Blank_project_is_rejected(string project, string field)
    {
        var outcome = EntryValidator.Validate(Request(project: project));

        Assert.Null(outcome.Entry);
        Assert.Contains(field, outcome.Errors.Keys);
    }

    [Fact]
    public void Blank_task_is_rejected()
    {
        var outcome = EntryValidator.Validate(Request(task: " "));

        Assert.Contains("task", outcome.Errors.Keys);
    }

    [Fact]
    public void Project_and_task_over_100_characters_are_rejected_after_trimming()
    {
        var exact = new string('a', 100);

        Assert.Null(EntryValidator.Validate(Request(project: $"  {exact}  ", task: exact)).Errors.GetValueOrDefault("project"));

        var outcome = EntryValidator.Validate(Request(project: exact + "b", task: exact + "b"));

        Assert.Contains("project", outcome.Errors.Keys);
        Assert.Contains("task", outcome.Errors.Keys);
    }

    [Fact]
    public void Equal_start_and_end_are_rejected()
    {
        var outcome = EntryValidator.Validate(Request(start: "09:00", end: "09:00"));

        Assert.Contains("end", outcome.Errors.Keys);
    }

    [Fact]
    public void End_before_start_means_the_entry_ends_the_next_day()
    {
        var outcome = EntryValidator.Validate(Request(start: "22:00", end: "01:00"));

        Assert.Equal(3m, outcome.Entry!.Hours);
    }

    [Fact]
    public void Times_with_seconds_are_rejected_because_they_can_round_to_zero_hours()
    {
        var request = new CreateEntryRequest { Date = new DateOnly(2026, 10, 2), Project = "Contoso", Task = "Standup", Start = new TimeOnly(8, 0, 0), End = new TimeOnly(8, 0, 10), Notes = null };
        var outcome = EntryValidator.Validate(request);

        Assert.Null(outcome.Entry);
        Assert.Contains("end", outcome.Errors.Keys);
    }

    [Fact]
    public void Blank_notes_become_null_and_line_endings_are_normalised()
    {
        Assert.Null(EntryValidator.Validate(Request(notes: " \n ")).Entry!.Notes);
        Assert.Equal("- a\n- b", EntryValidator.Validate(Request(notes: "  - a\r\n- b\r ")).Entry!.Notes);
    }

    [Fact]
    public void Notes_over_1000_characters_are_rejected()
    {
        Assert.Null(EntryValidator.Validate(Request(notes: new string('n', 1000))).Errors.GetValueOrDefault("notes"));
        Assert.Contains("notes", EntryValidator.Validate(Request(notes: new string('n', 1001))).Errors.Keys);
    }

    [Theory]
    [InlineData("1999-12-31")]
    [InlineData("2101-01-01")]
    public void Dates_outside_2000_to_2100_are_rejected(string date)
    {
        Assert.Contains("date", EntryValidator.Validate(Request(date: date)).Errors.Keys);
    }
}
