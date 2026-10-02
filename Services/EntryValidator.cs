using TimesheetLite.Api.Contracts;

namespace TimesheetLite.Services;

public sealed record ValidEntry(DateOnly Date, string Project, string Task, TimeOnly Start, TimeOnly End, decimal Hours, string? Notes);

public sealed record ValidationOutcome(ValidEntry? Entry, Dictionary<string, string[]> Errors);

public static class EntryValidator
{
    public const int MaxProjectLength = 100;
    public const int MaxTaskLength = 100;
    public const int MaxNotesLength = 1000;

    public static ValidationOutcome Validate(IEntryRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var project = request.Project.Trim();
        var task = request.Task.Trim();
        var notes = NormalizeNotes(request.Notes);

        if (request.Date.Year is < 2000 or > 2100)
        {
            errors["date"] = ["Date must be between 2000 and 2100."];
        }

        if (project.Length == 0)
        {
            errors["project"] = ["Project is required."];
        }
        else if (project.Length > MaxProjectLength)
        {
            errors["project"] = [$"Project must be {MaxProjectLength} characters or fewer."];
        }

        if (task.Length == 0)
        {
            errors["task"] = ["Task is required."];
        }
        else if (task.Length > MaxTaskLength)
        {
            errors["task"] = [$"Task must be {MaxTaskLength} characters or fewer."];
        }

        if (request.Start.Ticks % TimeSpan.TicksPerMinute != 0)
        {
            errors["start"] = ["Times must be whole minutes."];
        }

        if (request.End.Ticks % TimeSpan.TicksPerMinute != 0)
        {
            errors["end"] = ["Times must be whole minutes."];
        }
        else if (request.Start == request.End)
        {
            errors["end"] = ["End time must differ from the start time."];
        }

        if (notes is not null && notes.Length > MaxNotesLength)
        {
            errors["notes"] = [$"Notes must be {MaxNotesLength} characters or fewer."];
        }

        if (errors.Count > 0)
        {
            return new ValidationOutcome(null, errors);
        }

        var hours = EntryHours.Between(request.Start, request.End);

        return new ValidationOutcome(new ValidEntry(request.Date, project, task, request.Start, request.End, hours, notes), errors);
    }

    private static string? NormalizeNotes(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
        {
            return null;
        }

        return notes.Replace("\r\n", "\n").Replace('\r', '\n').Trim();
    }
}
