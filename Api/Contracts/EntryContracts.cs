namespace TimesheetLite.Api.Contracts;

public interface IEntryRequest
{
    DateOnly Date { get; }

    string Project { get; }

    string Task { get; }

    TimeOnly Start { get; }

    TimeOnly End { get; }

    string? Notes { get; }
}

public sealed record CreateEntryRequest : IEntryRequest
{
    public required DateOnly Date { get; init; }

    public required string Project { get; init; }

    public required string Task { get; init; }

    public required TimeOnly Start { get; init; }

    public required TimeOnly End { get; init; }

    public string? Notes { get; init; }
}

public sealed record UpdateEntryRequest : IEntryRequest
{
    public required DateOnly Date { get; init; }

    public required string Project { get; init; }

    public required string Task { get; init; }

    public required TimeOnly Start { get; init; }

    public required TimeOnly End { get; init; }

    public string? Notes { get; init; }
}

public sealed record EntryResponse(int Id, DateOnly Date, string Project, string Task, TimeOnly? Start, TimeOnly? End, decimal Hours, string? Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record ProjectUsage(string Name, int Uses, DateOnly LastUsed);

public sealed record TaskUsage(string Project, string Task, int Uses, DateOnly LastUsed);

public sealed record CatalogResponse(IReadOnlyList<ProjectUsage> Projects, IReadOnlyList<TaskUsage> Tasks);

public sealed record ConfigResponse(decimal WeeklyTargetHours, bool ClockifyConfigured);
