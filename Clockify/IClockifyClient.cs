namespace TimesheetLite.Clockify;

public sealed record ClockifyUser(string Id, string Name, string Email, string ActiveWorkspace, string TimeZone);

public sealed record ClockifyWorkspace(string Id, string Name);

public sealed record ClockifyProject(string Id, string Name, bool Archived, string ClientName = "", bool Billable = false);

public sealed record ClockifyEntryPayload(DateTime StartUtc, DateTime EndUtc, string Description, string ProjectId, bool Billable = false);

public sealed record ClockifyRemoteEntry(string Id, DateTime StartUtc, DateTime EndUtc, string Description, string? ProjectId);

public interface IClockifyClient
{
    Task<ClockifyUser> GetUserAsync(CancellationToken cancellationToken);

    Task<ClockifyUser> ValidateKeyAsync(string apiKey, CancellationToken cancellationToken);

    Task<IReadOnlyList<ClockifyWorkspace>> GetWorkspacesAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<ClockifyProject>> GetProjectsAsync(string workspaceId, CancellationToken cancellationToken);

    Task<IReadOnlyList<ClockifyRemoteEntry>> GetTimeEntriesAsync(string workspaceId, string userId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken);

    Task<string> CreateTimeEntryAsync(string workspaceId, ClockifyEntryPayload payload, CancellationToken cancellationToken);

    Task<bool> UpdateTimeEntryAsync(string workspaceId, string entryId, ClockifyEntryPayload payload, CancellationToken cancellationToken);

    Task<bool> DeleteTimeEntryAsync(string workspaceId, string entryId, CancellationToken cancellationToken);
}
