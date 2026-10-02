namespace TimesheetLite.Api.Contracts;

public enum ClockifyIssue
{
    None,
    NotConfigured,
    SchemaMissing,
    Unreadable,
    Unauthorized,
    Unreachable
}

public enum ClockifyConnectionSource
{
    None,
    App,
    Environment
}

public enum ClockifyMappingSource
{
    None,
    Saved,
    Name
}

public enum ClockifySyncAction
{
    Create,
    Update,
    Delete,
    Unchanged,
    Blocked
}

public enum ClockifySyncOutcome
{
    Planned,
    Done,
    Failed,
    Skipped
}

public sealed record ClockifyAccountResponse(string UserName, string Email, string WorkspaceId, string WorkspaceName, string TimeZone);

public sealed record ClockifyProjectResponse(string Id, string Name, string ClientName);

public sealed record ClockifyMappingResponse(string Project, string? ClockifyProjectId, ClockifyMappingSource Source);

public sealed record ClockifyStatusResponse(ClockifyIssue Issue, string? Message, ClockifyAccountResponse? Account, IReadOnlyList<ClockifyProjectResponse> Projects, IReadOnlyList<ClockifyMappingResponse> Mappings, ClockifyConnectionSource Connection);

public sealed record ConnectClockifyRequest
{
    public required string ApiKey { get; init; }
}

public sealed record ClockifySyncRequest
{
    public required DateOnly From { get; init; }

    public required DateOnly To { get; init; }

    public bool IncludeNotes { get; init; }

    public bool Apply { get; init; }

    public IReadOnlyDictionary<string, string>? Mappings { get; init; }
}

public sealed record ClockifySyncItemResponse(int? EntryId, DateOnly Date, TimeOnly? Start, TimeOnly? End, string Label, string Description, ClockifySyncAction Action, ClockifySyncOutcome Outcome, string? Message);

public sealed record ClockifySyncSummaryResponse(int Create, int Update, int Delete, int Unchanged, int Blocked, int Failed);

public sealed record ClockifySyncResponse(bool Applied, ClockifySyncSummaryResponse Summary, IReadOnlyList<ClockifySyncItemResponse> Items);
