using Microsoft.AspNetCore.Http.HttpResults;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Services;

namespace TimesheetLite.Api;

public static class EntryEndpoints
{
    private const int MaxRangeDays = 36600;

    public static IEndpointRouteBuilder MapEntries(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/entries").WithTags("Entries");

        group.MapGet("/", ListEntries)
            .WithName("ListEntries")
            .WithSummary("List time entries in a date range")
            .WithDescription("Returns entries whose work date falls between from and to (inclusive), ordered by date and start time. An optional project name narrows the list.");

        group.MapGet("/export.csv", ExportEntries)
            .WithName("ExportEntriesCsv")
            .WithSummary("Download time entries as CSV")
            .WithDescription("Returns a UTF-8 CSV with Date, Start, End, Hours, Project, Task and Notes columns. Text that starts with a formula character is prefixed with an apostrophe so spreadsheets do not evaluate it.");

        group.MapGet("/{id:int}", GetEntry)
            .WithName("GetEntry")
            .WithSummary("Get one time entry")
            .WithDescription("Returns a single entry by id.");

        group.MapPost("/", CreateEntry)
            .WithName("CreateEntry")
            .WithSummary("Create a time entry")
            .WithDescription("Hours are calculated from start and end, which must be whole minutes. An end time before the start means the entry ends the next day; equal times are rejected.");

        group.MapPut("/{id:int}", UpdateEntry)
            .WithName("UpdateEntry")
            .WithSummary("Replace a time entry")
            .WithDescription("Replaces every editable field of an entry and recalculates hours.");

        group.MapDelete("/{id:int}", DeleteEntry)
            .WithName("DeleteEntry")
            .WithSummary("Delete a time entry")
            .WithDescription("Removes an entry. Clockify copies are removed the next time that week is synced.");

        return app;
    }

    private static async Task<Results<Ok<IReadOnlyList<EntryResponse>>, ValidationProblem>> ListEntries(DateOnly from, DateOnly to, string? project, ITimesheetService service, CancellationToken cancellationToken)
    {
        if (RangeErrors(from, to) is { } errors)
        {
            return TypedResults.ValidationProblem(errors);
        }

        return TypedResults.Ok(await service.ListAsync(from, to, project, cancellationToken));
    }

    private static async Task<Results<FileContentHttpResult, ValidationProblem>> ExportEntries(DateOnly from, DateOnly to, string? project, ITimesheetService service, CancellationToken cancellationToken)
    {
        if (RangeErrors(from, to) is { } errors)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var entries = await service.ListAsync(from, to, project, cancellationToken);

        return TypedResults.File(CsvExporter.Build(entries), "text/csv; charset=utf-8", CsvExporter.FileName(from, to));
    }

    private static async Task<Results<Ok<EntryResponse>, NotFound>> GetEntry(int id, ITimesheetService service, CancellationToken cancellationToken)
    {
        var entry = await service.GetAsync(id, cancellationToken);

        return entry is null ? TypedResults.NotFound() : TypedResults.Ok(entry);
    }

    private static async Task<Results<Created<EntryResponse>, ValidationProblem>> CreateEntry(CreateEntryRequest request, ITimesheetService service, CancellationToken cancellationToken)
    {
        var outcome = EntryValidator.Validate(request);

        if (outcome.Entry is null)
        {
            return TypedResults.ValidationProblem(outcome.Errors);
        }

        var created = await service.CreateAsync(outcome.Entry, cancellationToken);

        return TypedResults.Created($"/api/entries/{created.Id}", created);
    }

    private static async Task<Results<Ok<EntryResponse>, NotFound, ValidationProblem>> UpdateEntry(int id, UpdateEntryRequest request, ITimesheetService service, CancellationToken cancellationToken)
    {
        var outcome = EntryValidator.Validate(request);

        if (outcome.Entry is null)
        {
            return TypedResults.ValidationProblem(outcome.Errors);
        }

        var updated = await service.UpdateAsync(id, outcome.Entry, cancellationToken);

        return updated is null ? TypedResults.NotFound() : TypedResults.Ok(updated);
    }

    private static async Task<Results<NoContent, NotFound>> DeleteEntry(int id, ITimesheetService service, CancellationToken cancellationToken)
    {
        return await service.DeleteAsync(id, cancellationToken) ? TypedResults.NoContent() : TypedResults.NotFound();
    }

    private static Dictionary<string, string[]>? RangeErrors(DateOnly from, DateOnly to)
    {
        if (to < from)
        {
            return new Dictionary<string, string[]> { ["to"] = ["to must be on or after from."] };
        }

        if (to.DayNumber - from.DayNumber > MaxRangeDays)
        {
            return new Dictionary<string, string[]> { ["to"] = [$"The range cannot be longer than {MaxRangeDays} days."] };
        }

        return null;
    }
}
