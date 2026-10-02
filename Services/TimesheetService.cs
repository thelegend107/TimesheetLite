using Microsoft.EntityFrameworkCore;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Data;

namespace TimesheetLite.Services;

public sealed class TimesheetService(TimesheetDbContext db, TimeProvider clock) : ITimesheetService
{
    private const int CatalogTaskLimit = 500;

    public async Task<IReadOnlyList<EntryResponse>> ListAsync(DateOnly from, DateOnly to, string? project, CancellationToken cancellationToken)
    {
        var query = db.TimeEntries.AsNoTracking().Where(x => x.WorkDate >= from && x.WorkDate <= to);

        if (!string.IsNullOrWhiteSpace(project))
        {
            var name = project.Trim();
            query = query.Where(x => x.Project == name);
        }

        var rows = await query
            .OrderBy(x => x.WorkDate)
            .ThenBy(x => x.StartTime)
            .ThenBy(x => x.EndTime)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return rows.Select(ToResponse).ToList();
    }

    public async Task<EntryResponse?> GetAsync(int id, CancellationToken cancellationToken)
    {
        var row = await db.TimeEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return row is null ? null : ToResponse(row);
    }

    public async Task<EntryResponse> CreateAsync(ValidEntry entry, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();

        var row = new TimeEntry
        {
            WorkDate = entry.Date,
            Project = entry.Project,
            Task = entry.Task,
            StartTime = entry.Start,
            EndTime = entry.End,
            Hours = entry.Hours,
            Notes = entry.Notes,
            CreatedDate = now,
            UpdatedDate = now
        };

        db.TimeEntries.Add(row);
        await db.SaveChangesAsync(cancellationToken);

        return ToResponse(row);
    }

    public async Task<EntryResponse?> UpdateAsync(int id, ValidEntry entry, CancellationToken cancellationToken)
    {
        var row = await db.TimeEntries.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (row is null)
        {
            return null;
        }

        row.WorkDate = entry.Date;
        row.Project = entry.Project;
        row.Task = entry.Task;
        row.StartTime = entry.Start;
        row.EndTime = entry.End;
        row.Hours = entry.Hours;
        row.Notes = entry.Notes;
        row.UpdatedDate = clock.GetUtcNow();

        await db.SaveChangesAsync(cancellationToken);

        return ToResponse(row);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var deleted = await db.TimeEntries.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);

        return deleted > 0;
    }

    public async Task<CatalogResponse> GetCatalogAsync(CancellationToken cancellationToken)
    {
        var projects = await db.TimeEntries
            .AsNoTracking()
            .GroupBy(x => x.Project)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Select(g => new ProjectUsage(g.Key, g.Count(), g.Max(x => x.WorkDate)))
            .ToListAsync(cancellationToken);

        var tasks = await db.TimeEntries
            .AsNoTracking()
            .GroupBy(x => new { x.Project, x.Task })
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Max(x => x.WorkDate))
            .Take(CatalogTaskLimit)
            .Select(g => new TaskUsage(g.Key.Project, g.Key.Task, g.Count(), g.Max(x => x.WorkDate)))
            .ToListAsync(cancellationToken);

        return new CatalogResponse(projects, tasks);
    }

    private static EntryResponse ToResponse(TimeEntry row) => new(row.Id, row.WorkDate, row.Project, row.Task, row.StartTime, row.EndTime, row.Hours, row.Notes, row.CreatedDate, row.UpdatedDate);
}
