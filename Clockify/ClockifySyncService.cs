using System.Data.Common;
using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Data;

namespace TimesheetLite.Clockify;

public sealed class ClockifySyncService(TimesheetDbContext db, IClockifyClient client, IClockifyCredentials credentials, IOptions<ClockifyOptions> options, TimeProvider clock) : IClockifySyncService
{
    private const int MaxDescriptionLength = 3000;
    private const int MaxLabelLength = 200;
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<ClockifyStatusResponse> GetStatusAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        ClockifyKey? key;

        try
        {
            key = await credentials.GetAsync(cancellationToken);
        }
        catch (ClockifyKeyUnreadableException exception)
        {
            return Unavailable(ClockifyIssue.Unreadable, exception.Message, ClockifyConnectionSource.App);
        }

        var source = key?.Source ?? ClockifyConnectionSource.None;

        if (key is null)
        {
            return Unavailable(ClockifyIssue.NotConfigured, "Clockify is not connected.", source);
        }

        if (!await IsSchemaReadyAsync(cancellationToken))
        {
            return Unavailable(ClockifyIssue.SchemaMissing, "Run Scripts/002-clockify-sync.sql on the database to enable Clockify.", source);
        }

        try
        {
            var user = await client.GetUserAsync(cancellationToken);
            var workspaceId = ResolveWorkspaceId(settings, user);
            var zone = ResolveZone(settings, user);
            var workspaces = await client.GetWorkspacesAsync(cancellationToken);
            var projects = await client.GetProjectsAsync(workspaceId, cancellationToken);
            var localProjects = await db.TimeEntries.AsNoTracking().Select(x => x.Project).Distinct().OrderBy(x => x).ToListAsync(cancellationToken);
            var saved = await db.ClockifyProjectMaps.AsNoTracking().ToListAsync(cancellationToken);
            var resolved = ResolveMapping(localProjects, saved, null, projects);
            var workspaceName = workspaces.FirstOrDefault(x => x.Id == workspaceId)?.Name ?? workspaceId;
            var account = new ClockifyAccountResponse(user.Name, user.Email, workspaceId, workspaceName, zone.Id);
            var mappings = localProjects.Select(x => resolved.TryGetValue(x, out var map) ? new ClockifyMappingResponse(x, map.Id, map.Source) : new ClockifyMappingResponse(x, null, ClockifyMappingSource.None)).ToList();

            return new ClockifyStatusResponse(ClockifyIssue.None, null, account, projects.Where(x => !x.Archived).Select(x => new ClockifyProjectResponse(x.Id, x.Name, x.ClientName)).ToList(), mappings, source);
        }
        catch (ClockifySetupException exception)
        {
            return Unavailable(ClockifyIssue.NotConfigured, exception.Message, source);
        }
        catch (ClockifyApiException exception) when (exception.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return Unavailable(ClockifyIssue.Unauthorized, exception.Message, source);
        }
        catch (ClockifyApiException exception)
        {
            return Unavailable(ClockifyIssue.Unreachable, exception.Message, source);
        }
    }

    public async Task<ClockifySyncResponse> SyncAsync(ClockifySyncRequest request, CancellationToken cancellationToken)
    {
        await Gate.WaitAsync(cancellationToken);

        try
        {
            return await RunAsync(request, cancellationToken);
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task<ClockifySyncResponse> RunAsync(ClockifySyncRequest request, CancellationToken cancellationToken)
    {
        var settings = options.Value;

        if (await credentials.GetAsync(cancellationToken) is null)
        {
            throw new ClockifySetupException("Clockify is not connected. Connect it from the Clockify dialog.");
        }

        if (!await IsSchemaReadyAsync(cancellationToken))
        {
            throw new ClockifySetupException("Run Scripts/002-clockify-sync.sql on the database before syncing.");
        }

        var user = await client.GetUserAsync(cancellationToken);
        var workspaceId = ResolveWorkspaceId(settings, user);
        var zone = ResolveZone(settings, user);
        var projects = await client.GetProjectsAsync(workspaceId, cancellationToken);

        var entries = await db.TimeEntries
            .AsNoTracking()
            .Where(x => x.WorkDate >= request.From && x.WorkDate <= request.To)
            .OrderBy(x => x.WorkDate)
            .ThenBy(x => x.StartTime)
            .ThenBy(x => x.EndTime)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var entryIds = entries.Select(x => x.Id).ToList();
        var links = await db.ClockifyEntryLinks.Where(x => (x.WorkDate >= request.From && x.WorkDate <= request.To) || entryIds.Contains(x.TimeEntryId)).ToListAsync(cancellationToken);
        var saved = await db.ClockifyProjectMaps.ToListAsync(cancellationToken);
        var resolved = ResolveMapping(entries.Select(x => x.Project), saved, request.Mappings, projects);
        var mapping = resolved.ToDictionary(x => x.Key, x => x.Value.Id, StringComparer.OrdinalIgnoreCase);

        var items = entries.Select(x => PlanEntry(x, links.FirstOrDefault(link => link.TimeEntryId == x.Id), mapping, zone, workspaceId, request.IncludeNotes)).ToList();
        items.AddRange(await PlanLinkedElsewhereAsync(links, entryIds, mapping, zone, workspaceId, request.IncludeNotes, cancellationToken));

        if (request.Apply)
        {
            await ApplyAsync(items, workspaceId, CancellationToken.None);
            await SaveMappingsAsync(entries.Select(x => x.Project), mapping, saved, CancellationToken.None);
        }

        return new ClockifySyncResponse(request.Apply, Summarize(items), items.Select(ToResponse).ToList());
    }

    private async Task<List<PlanItem>> PlanLinkedElsewhereAsync(List<ClockifyEntryLink> links, List<int> entryIds, Dictionary<string, string> mapping, TimeZoneInfo zone, string workspaceId, bool includeNotes, CancellationToken cancellationToken)
    {
        var candidates = links.Where(x => !entryIds.Contains(x.TimeEntryId)).ToList();

        if (candidates.Count == 0)
        {
            return [];
        }

        var candidateIds = candidates.Select(x => x.TimeEntryId).ToList();
        var moved = await db.TimeEntries.AsNoTracking().Where(x => candidateIds.Contains(x.Id)).ToListAsync(cancellationToken);
        var items = new List<PlanItem>();

        foreach (var entry in moved)
        {
            var link = candidates.First(x => x.TimeEntryId == entry.Id);
            var item = PlanEntry(entry, link, mapping, zone, workspaceId, includeNotes);

            item.Message ??= $"Moved here from {link.WorkDate:yyyy-MM-dd}.";
            items.Add(item);
        }

        var movedIds = moved.Select(x => x.Id).ToHashSet();

        items.AddRange(candidates
            .Where(x => !movedIds.Contains(x.TimeEntryId))
            .Select(x => new PlanItem { EntryId = x.TimeEntryId, Date = x.WorkDate, Label = x.Label, Description = "", Action = ClockifySyncAction.Delete, Link = x }));

        return items;
    }

    private async Task ApplyAsync(List<PlanItem> items, string workspaceId, CancellationToken cancellationToken)
    {
        foreach (var item in items)
        {
            if (item.Action is ClockifySyncAction.Unchanged or ClockifySyncAction.Blocked)
            {
                item.Outcome = ClockifySyncOutcome.Skipped;
                continue;
            }

            try
            {
                switch (item.Action)
                {
                    case ClockifySyncAction.Create:
                        await CreateRemoteAsync(item, workspaceId, cancellationToken);
                        break;
                    case ClockifySyncAction.Update:
                        await UpdateRemoteAsync(item, workspaceId, cancellationToken);
                        break;
                    case ClockifySyncAction.Delete:
                        await DeleteRemoteAsync(item, cancellationToken);
                        break;
                }

                item.Outcome = ClockifySyncOutcome.Done;
            }
            catch (ClockifyApiException exception)
            {
                var uncertain = exception.StatusCode is null || (int)exception.StatusCode >= 500;
                var ambiguous = uncertain && item.Action is ClockifySyncAction.Create or ClockifySyncAction.Update;

                item.Outcome = ClockifySyncOutcome.Failed;
                item.Message = ambiguous ? $"{exception.Message} It may still have been saved in Clockify, so check there before pushing again." : exception.Message;
            }
        }
    }

    private async Task CreateRemoteAsync(PlanItem item, string workspaceId, CancellationToken cancellationToken)
    {
        var remoteId = await client.CreateTimeEntryAsync(workspaceId, item.Payload!, cancellationToken);

        db.ClockifyEntryLinks.Add(new ClockifyEntryLink { TimeEntryId = item.EntryId!.Value, WorkDate = item.Date, WorkspaceId = workspaceId, ClockifyEntryId = remoteId, Fingerprint = item.Fingerprint, Label = item.Label, SyncedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task UpdateRemoteAsync(PlanItem item, string workspaceId, CancellationToken cancellationToken)
    {
        var link = item.Link!;
        var found = link.WorkspaceId == workspaceId && await client.UpdateTimeEntryAsync(workspaceId, link.ClockifyEntryId, item.Payload!, cancellationToken);

        if (!found)
        {
            link.ClockifyEntryId = await client.CreateTimeEntryAsync(workspaceId, item.Payload!, cancellationToken);
        }

        link.WorkspaceId = workspaceId;
        link.WorkDate = item.Date;
        link.Fingerprint = item.Fingerprint;
        link.Label = item.Label;
        link.SyncedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task DeleteRemoteAsync(PlanItem item, CancellationToken cancellationToken)
    {
        var link = item.Link!;

        await client.DeleteTimeEntryAsync(link.WorkspaceId, link.ClockifyEntryId, cancellationToken);
        db.ClockifyEntryLinks.Remove(link);
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task SaveMappingsAsync(IEnumerable<string> usedProjects, Dictionary<string, string> mapping, List<ClockifyProjectMap> saved, CancellationToken cancellationToken)
    {
        foreach (var project in usedProjects.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!mapping.TryGetValue(project, out var projectId))
            {
                continue;
            }

            var existing = saved.FirstOrDefault(x => string.Equals(x.Project, project, StringComparison.OrdinalIgnoreCase));

            if (existing is null)
            {
                db.ClockifyProjectMaps.Add(new ClockifyProjectMap { Project = project, ClockifyProjectId = projectId });
            }
            else if (existing.ClockifyProjectId != projectId)
            {
                existing.ClockifyProjectId = projectId;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> IsSchemaReadyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.ClockifyEntryLinks.AsNoTracking().AnyAsync(cancellationToken);
            await db.ClockifyProjectMaps.AsNoTracking().AnyAsync(cancellationToken);

            return true;
        }
        catch (DbException exception) when (ClockifyDb.IsMissingTable(exception))
        {
            return false;
        }
    }

    private static ClockifyStatusResponse Unavailable(ClockifyIssue issue, string message, ClockifyConnectionSource source) => new(issue, message, null, [], [], source);

    private static string ResolveWorkspaceId(ClockifyOptions settings, ClockifyUser user)
    {
        var workspaceId = string.IsNullOrWhiteSpace(settings.WorkspaceId) ? user.ActiveWorkspace : settings.WorkspaceId.Trim();

        return string.IsNullOrWhiteSpace(workspaceId) ? throw new ClockifySetupException("Clockify did not report an active workspace. Set Clockify__WorkspaceId.") : workspaceId;
    }

    private static TimeZoneInfo ResolveZone(ClockifyOptions settings, ClockifyUser user)
    {
        var id = string.IsNullOrWhiteSpace(settings.TimeZone) ? user.TimeZone : settings.TimeZone.Trim();

        if (string.IsNullOrWhiteSpace(id))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            throw new ClockifySetupException($"The time zone \"{id}\" is not available on this server. Set Clockify__TimeZone to a valid IANA id.");
        }
    }

    private static Dictionary<string, (string Id, ClockifyMappingSource Source)> ResolveMapping(IEnumerable<string> localProjects, IReadOnlyList<ClockifyProjectMap> saved, IReadOnlyDictionary<string, string>? requested, IReadOnlyList<ClockifyProject> projects)
    {
        var known = projects.Where(x => !x.Archived).ToDictionary(x => x.Id);
        var mapping = new Dictionary<string, (string Id, ClockifyMappingSource Source)>(StringComparer.OrdinalIgnoreCase);
        var rejected = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var map in saved)
        {
            if (known.ContainsKey(map.ClockifyProjectId))
            {
                mapping[map.Project] = (map.ClockifyProjectId, ClockifyMappingSource.Saved);
            }
        }

        if (requested is not null)
        {
            foreach (var (project, id) in requested)
            {
                var name = project.Trim();

                if (known.ContainsKey(id))
                {
                    mapping[name] = (id, ClockifyMappingSource.Saved);
                }
                else
                {
                    mapping.Remove(name);
                    rejected.Add(name);
                }
            }
        }

        foreach (var project in localProjects.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (mapping.ContainsKey(project) || rejected.Contains(project))
            {
                continue;
            }

            var matches = projects.Where(x => !x.Archived && string.Equals(x.Name, project, StringComparison.OrdinalIgnoreCase)).Take(2).ToList();

            if (matches.Count == 1)
            {
                mapping[project] = (matches[0].Id, ClockifyMappingSource.Name);
            }
        }

        return mapping;
    }

    private static PlanItem PlanEntry(TimeEntry entry, ClockifyEntryLink? link, Dictionary<string, string> mapping, TimeZoneInfo zone, string workspaceId, bool includeNotes)
    {
        var label = Truncate($"{entry.Project} · {entry.Task}", MaxLabelLength);
        var description = Describe(entry, includeNotes);

        PlanItem Blocked(string message) => new() { EntryId = entry.Id, Date = entry.WorkDate, Start = entry.StartTime, End = entry.EndTime, Label = label, Description = description, Action = ClockifySyncAction.Blocked, Message = link is null ? message : $"{message} The version pushed earlier is still in Clockify.", Link = link };

        if (entry.StartTime is null || entry.EndTime is null)
        {
            return Blocked("Start and end times are required.");
        }

        if (!mapping.TryGetValue(entry.Project, out var projectId))
        {
            return Blocked($"No Clockify project is mapped to \"{entry.Project}\".");
        }

        if (!TryToUtc(entry.WorkDate, entry.StartTime.Value, entry.EndTime.Value, zone, out var startUtc, out var endUtc))
        {
            return Blocked($"That time does not exist in {zone.Id} because of a daylight saving change.");
        }

        var fingerprint = Fingerprint(projectId, startUtc, endUtc, description);
        var unchanged = link is not null && link.Fingerprint == fingerprint && link.WorkspaceId == workspaceId;
        var action = link is null ? ClockifySyncAction.Create : unchanged ? ClockifySyncAction.Unchanged : ClockifySyncAction.Update;

        return new PlanItem { EntryId = entry.Id, Date = entry.WorkDate, Start = entry.StartTime, End = entry.EndTime, Label = label, Description = description, Action = action, Payload = new ClockifyEntryPayload(startUtc, endUtc, description, projectId), Fingerprint = fingerprint, Link = link };
    }

    private static string Describe(TimeEntry entry, bool includeNotes)
    {
        var text = includeNotes && !string.IsNullOrWhiteSpace(entry.Notes) ? $"{entry.Task}\n{entry.Notes}" : entry.Task;

        return Truncate(text, MaxDescriptionLength);
    }

    private static string Truncate(string text, int length)
    {
        if (text.Length <= length)
        {
            return text;
        }

        var cut = char.IsHighSurrogate(text[length - 1]) ? length - 1 : length;

        return text[..cut];
    }

    private static bool TryToUtc(DateOnly date, TimeOnly start, TimeOnly end, TimeZoneInfo zone, out DateTime startUtc, out DateTime endUtc)
    {
        var startLocal = date.ToDateTime(start);
        var endLocal = (end > start ? date : date.AddDays(1)).ToDateTime(end);

        startUtc = default;
        endUtc = default;

        if (zone.IsInvalidTime(startLocal) || zone.IsInvalidTime(endLocal))
        {
            return false;
        }

        startUtc = ToUtc(startLocal, zone);
        endUtc = ToUtc(endLocal, zone);

        return true;
    }

    private static DateTime ToUtc(DateTime local, TimeZoneInfo zone)
    {
        if (!zone.IsAmbiguousTime(local))
        {
            return TimeZoneInfo.ConvertTimeToUtc(local, zone);
        }

        return new DateTimeOffset(local, zone.GetAmbiguousTimeOffsets(local).Max()).UtcDateTime;
    }

    private static string Fingerprint(string projectId, DateTime startUtc, DateTime endUtc, string description)
    {
        var text = string.Create(CultureInfo.InvariantCulture, $"{projectId}|{startUtc:O}|{endUtc:O}|{description}");

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..32];
    }

    private static ClockifySyncSummaryResponse Summarize(IReadOnlyList<PlanItem> items)
    {
        int Count(ClockifySyncAction action) => items.Count(x => x.Action == action && x.Outcome != ClockifySyncOutcome.Failed);

        return new ClockifySyncSummaryResponse(Count(ClockifySyncAction.Create), Count(ClockifySyncAction.Update), Count(ClockifySyncAction.Delete), Count(ClockifySyncAction.Unchanged), Count(ClockifySyncAction.Blocked), items.Count(x => x.Outcome == ClockifySyncOutcome.Failed));
    }

    private static ClockifySyncItemResponse ToResponse(PlanItem item) => new(item.EntryId, item.Date, item.Start, item.End, item.Label, item.Description, item.Action, item.Outcome, item.Message);

    private sealed class PlanItem
    {
        public int? EntryId { get; init; }

        public DateOnly Date { get; init; }

        public TimeOnly? Start { get; init; }

        public TimeOnly? End { get; init; }

        public string Label { get; init; } = "";

        public string Description { get; init; } = "";

        public ClockifySyncAction Action { get; init; }

        public ClockifySyncOutcome Outcome { get; set; } = ClockifySyncOutcome.Planned;

        public string? Message { get; set; }

        public ClockifyEntryPayload? Payload { get; init; }

        public string Fingerprint { get; init; } = "";

        public ClockifyEntryLink? Link { get; init; }
    }
}
