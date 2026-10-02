using System.Net;
using TimesheetLite.Clockify;

namespace TimesheetLite.Tests.Support;

public sealed class FakeClockifyClient : IClockifyClient
{
    private int counter;

    public ClockifyUser User { get; set; } = new("user-1", "Test User", "test@example.com", "ws-1", "America/Chicago");

    public List<ClockifyWorkspace> Workspaces { get; } = [new("ws-1", "Test Workspace")];

    public List<ClockifyProject> Projects { get; } = [new("p-contoso", "Contoso", false), new("p-northwind", "Northwind", false)];

    public Dictionary<string, ClockifyEntryPayload> Entries { get; } = [];

    public Func<ClockifyEntryPayload, bool>? FailWhen { get; set; }

    public HttpStatusCode FailStatus { get; set; } = HttpStatusCode.BadRequest;

    public Func<ClockifyEntryPayload, bool>? TimeoutWhen { get; set; }

    public Action? AfterCreate { get; set; }

    public Exception? FailStatusWith { get; set; }

    public Exception? FailEntriesWith { get; set; }

    public bool RejectKeys { get; set; }

    public List<string> ValidatedKeys { get; } = [];

    public Task<ClockifyUser> GetUserAsync(CancellationToken cancellationToken) => FailStatusWith is null ? Task.FromResult(User) : Task.FromException<ClockifyUser>(FailStatusWith);

    public Task<ClockifyUser> ValidateKeyAsync(string apiKey, CancellationToken cancellationToken)
    {
        ValidatedKeys.Add(apiKey);

        return RejectKeys ? Task.FromException<ClockifyUser>(new ClockifyApiException(HttpStatusCode.Unauthorized, "Clockify rejected the API key.")) : Task.FromResult(User);
    }

    public Task<IReadOnlyList<ClockifyWorkspace>> GetWorkspacesAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ClockifyWorkspace>>(Workspaces);

    public Task<IReadOnlyList<ClockifyProject>> GetProjectsAsync(string workspaceId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ClockifyProject>>(Projects);

    public Task<IReadOnlyList<ClockifyRemoteEntry>> GetTimeEntriesAsync(string workspaceId, string userId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
    {
        if (FailEntriesWith is not null)
        {
            return Task.FromException<IReadOnlyList<ClockifyRemoteEntry>>(FailEntriesWith);
        }

        return Task.FromResult<IReadOnlyList<ClockifyRemoteEntry>>(Entries.Where(x => x.Value.StartUtc >= fromUtc && x.Value.EndUtc <= toUtc).Select(x => new ClockifyRemoteEntry(x.Key, x.Value.StartUtc, x.Value.EndUtc, x.Value.Description, x.Value.ProjectId)).ToList());
    }

    public Task<string> CreateTimeEntryAsync(string workspaceId, ClockifyEntryPayload payload, CancellationToken cancellationToken)
    {
        if (FailWhen?.Invoke(payload) == true)
        {
            throw new ClockifyApiException(FailStatus, $"Clockify returned {(int)FailStatus}: rejected.");
        }

        if (TimeoutWhen?.Invoke(payload) == true)
        {
            throw new ClockifyApiException(null, "Clockify did not respond in time.");
        }

        var id = $"remote-{++counter}";
        Entries[id] = payload;
        AfterCreate?.Invoke();

        return Task.FromResult(id);
    }

    public Task<bool> UpdateTimeEntryAsync(string workspaceId, string entryId, ClockifyEntryPayload payload, CancellationToken cancellationToken)
    {
        if (!Entries.ContainsKey(entryId))
        {
            return Task.FromResult(false);
        }

        Entries[entryId] = payload;

        return Task.FromResult(true);
    }

    public Task<bool> DeleteTimeEntryAsync(string workspaceId, string entryId, CancellationToken cancellationToken) => Task.FromResult(Entries.Remove(entryId));
}
