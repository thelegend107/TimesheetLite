using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TimesheetLite.Clockify;

public sealed class ClockifyClient(HttpClient http, IClockifyCredentials credentials) : IClockifyClient
{
    private const int ProjectPageSize = 200;
    private const int ProjectPageLimit = 25;
    private const int EntryPageSize = 500;
    private const int EntryPageLimit = 40;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    public async Task<ClockifyUser> GetUserAsync(CancellationToken cancellationToken) => ToUser(await GetAsync<UserDto>("user", null, cancellationToken));

    public async Task<ClockifyUser> ValidateKeyAsync(string apiKey, CancellationToken cancellationToken) => ToUser(await GetAsync<UserDto>("user", apiKey, cancellationToken));

    public async Task<IReadOnlyList<ClockifyWorkspace>> GetWorkspacesAsync(CancellationToken cancellationToken)
    {
        var workspaces = await GetAsync<List<WorkspaceDto>>("workspaces", null, cancellationToken);

        return workspaces.Select(x => new ClockifyWorkspace(x.Id, x.Name ?? x.Id)).ToList();
    }

    public async Task<IReadOnlyList<ClockifyProject>> GetProjectsAsync(string workspaceId, CancellationToken cancellationToken)
    {
        var projects = new List<ClockifyProject>();

        for (var page = 1; page <= ProjectPageLimit; page++)
        {
            var batch = await GetAsync<List<ProjectDto>>($"workspaces/{Uri.EscapeDataString(workspaceId)}/projects?archived=false&page-size={ProjectPageSize}&page={page}", null, cancellationToken);

            projects.AddRange(batch.Select(x => new ClockifyProject(x.Id, x.Name ?? x.Id, x.Archived, x.ClientName ?? "")));

            if (batch.Count < ProjectPageSize)
            {
                break;
            }
        }

        return projects;
    }

    public async Task<IReadOnlyList<ClockifyRemoteEntry>> GetTimeEntriesAsync(string workspaceId, string userId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
    {
        var entries = new List<ClockifyRemoteEntry>();

        for (var page = 1; page <= EntryPageLimit; page++)
        {
            var batch = await GetAsync<List<TimeEntryDto>>($"workspaces/{Uri.EscapeDataString(workspaceId)}/user/{Uri.EscapeDataString(userId)}/time-entries?start={Format(fromUtc)}&end={Format(toUtc)}&hydrated=false&page-size={EntryPageSize}&page={page}", null, cancellationToken);

            entries.AddRange(batch.Where(x => x.TimeInterval is { Start: not null, End: not null }).Select(x => new ClockifyRemoteEntry(x.Id, x.TimeInterval!.Start!.Value.UtcDateTime, x.TimeInterval.End!.Value.UtcDateTime, x.Description ?? "", x.ProjectId)));

            if (batch.Count < EntryPageSize)
            {
                break;
            }
        }

        return entries;
    }

    public async Task<string> CreateTimeEntryAsync(string workspaceId, ClockifyEntryPayload payload, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Post, $"workspaces/{Uri.EscapeDataString(workspaceId)}/time-entries", ToBody(payload), false, null, cancellationToken);
        var created = await ReadAsync<IdDto>(response!, cancellationToken);

        return created.Id;
    }

    public async Task<bool> UpdateTimeEntryAsync(string workspaceId, string entryId, ClockifyEntryPayload payload, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Put, $"workspaces/{Uri.EscapeDataString(workspaceId)}/time-entries/{Uri.EscapeDataString(entryId)}", ToBody(payload), true, null, cancellationToken);

        return response is not null;
    }

    public async Task<bool> DeleteTimeEntryAsync(string workspaceId, string entryId, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Delete, $"workspaces/{Uri.EscapeDataString(workspaceId)}/time-entries/{Uri.EscapeDataString(entryId)}", null, true, null, cancellationToken);

        return response is not null;
    }

    private async Task<T> GetAsync<T>(string path, string? apiKey, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Get, path, null, false, apiKey, cancellationToken);

        return await ReadAsync<T>(response!, cancellationToken);
    }

    private static ClockifyUser ToUser(UserDto user) => new(user.Id, user.Name ?? "", user.Email ?? "", user.ActiveWorkspace ?? user.DefaultWorkspace ?? "", user.Settings?.TimeZone ?? "");

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(Json, cancellationToken) ?? throw new ClockifyApiException(null, "Clockify returned an empty response.");
        }
        catch (JsonException exception)
        {
            throw new ClockifyApiException(null, "Clockify returned a response this app could not read.", exception);
        }
    }

    private async Task<HttpResponseMessage?> SendAsync(HttpMethod method, string path, object? body, bool allowNotFound, string? apiKey, CancellationToken cancellationToken)
    {
        var key = apiKey ?? (await credentials.GetAsync(cancellationToken))?.Value ?? throw new ClockifySetupException("Clockify is not connected. Connect it from the Clockify dialog.");

        using var request = new HttpRequestMessage(method, path);

        request.Headers.Add("X-Api-Key", key);

        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: Json);
        }

        HttpResponseMessage response;

        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            throw new ClockifyApiException(null, "Clockify could not be reached.", exception);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ClockifyApiException(null, "Clockify did not respond in time.", exception);
        }

        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        if (allowNotFound && response.StatusCode == HttpStatusCode.NotFound)
        {
            response.Dispose();
            return null;
        }

        var message = await DescribeFailureAsync(response, key, cancellationToken);
        var status = response.StatusCode;
        response.Dispose();

        throw new ClockifyApiException(status, message);
    }

    private static async Task<string> DescribeFailureAsync(HttpResponseMessage response, string key, CancellationToken cancellationToken)
    {
        var detail = "";

        try
        {
            var error = await response.Content.ReadFromJsonAsync<ErrorDto>(Json, cancellationToken);
            detail = (error?.Message ?? "").Replace(key, "[key]", StringComparison.Ordinal);
        }
        catch (JsonException)
        {
        }
        catch (NotSupportedException)
        {
        }

        var suffix = detail.Length == 0 ? "." : $": {detail}";

        return response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => "Clockify rejected the API key.",
            HttpStatusCode.Forbidden => $"Clockify refused the request{suffix}",
            HttpStatusCode.TooManyRequests => "Clockify rate limit reached. Try again in a moment.",
            _ => $"Clockify returned {(int)response.StatusCode}{suffix}"
        };
    }

    private static object ToBody(ClockifyEntryPayload payload) => new { start = Format(payload.StartUtc), end = Format(payload.EndUtc), description = payload.Description, projectId = payload.ProjectId };

    private static string Format(DateTime utc) => utc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);

    private sealed record IdDto(string Id);

    private sealed record ErrorDto(string? Message);

    private sealed record UserSettingsDto(string? TimeZone);

    private sealed record UserDto(string Id, string? Name, string? Email, string? ActiveWorkspace, string? DefaultWorkspace, UserSettingsDto? Settings);

    private sealed record WorkspaceDto(string Id, string? Name);

    private sealed record TimeIntervalDto(DateTimeOffset? Start, DateTimeOffset? End);

    private sealed record TimeEntryDto(string Id, string? Description, string? ProjectId, TimeIntervalDto? TimeInterval);

    private sealed record ProjectDto(string Id, string? Name, bool Archived, string? ClientName);
}
