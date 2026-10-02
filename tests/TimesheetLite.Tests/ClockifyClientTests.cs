using System.Net;
using System.Text;
using TimesheetLite.Clockify;

namespace TimesheetLite.Tests;

public class ClockifyClientTests
{
    private sealed class FixedCredentials(string? key) : IClockifyCredentials
    {
        public Task<ClockifyKey?> GetAsync(CancellationToken cancellationToken) => Task.FromResult(key is null ? null : new ClockifyKey(key, TimesheetLite.Api.Contracts.ClockifyConnectionSource.App));

        public Task SaveAsync(string apiKey, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<bool> ClearAsync(CancellationToken cancellationToken) => Task.FromResult(true);
    }

    private sealed record Recorded(HttpMethod Method, string PathAndQuery, string? Body, string? ApiKey);

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<Recorded> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            var apiKey = request.Headers.TryGetValues("X-Api-Key", out var values) ? values.Single() : null;

            Requests.Add(new Recorded(request.Method, request.RequestUri!.PathAndQuery, body, apiKey));

            return respond(request);
        }
    }

    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) => new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static (ClockifyClient Client, StubHandler Handler) Create(Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        var handler = new StubHandler(respond);
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://clockify.test/api/v1/") };

        return (new ClockifyClient(http, new FixedCredentials("secret-key")), handler);
    }

    private static ClockifyEntryPayload Payload() => new(new DateTime(2026, 10, 2, 13, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 2, 15, 45, 0, DateTimeKind.Utc), "Standup \"daily\"", "p1");

    [Fact]
    public async Task An_upstream_message_that_echoes_the_key_is_redacted()
    {
        var (client, _) = Create(_ => Json("{\"message\":\"Invalid key secret-key supplied\"}", HttpStatusCode.BadRequest));

        var failure = await Assert.ThrowsAsync<ClockifyApiException>(() => client.GetUserAsync(CancellationToken.None));

        Assert.DoesNotContain("secret-key", failure.Message);
        Assert.Contains("[key]", failure.Message);
    }

    [Fact]
    public async Task GetUser_sends_the_api_key_and_reads_the_time_zone()
    {
        var (client, handler) = Create(_ => Json("{\"id\":\"u1\",\"name\":\"Ada\",\"email\":\"ada@example.com\",\"activeWorkspace\":\"w1\",\"defaultWorkspace\":\"w0\",\"settings\":{\"timeZone\":\"America/Chicago\",\"weekStart\":\"MONDAY\"}}"));

        var user = await client.GetUserAsync(CancellationToken.None);

        Assert.Equal(new ClockifyUser("u1", "Ada", "ada@example.com", "w1", "America/Chicago"), user);
        Assert.Equal(("/api/v1/user", "secret-key"), (handler.Requests.Single().PathAndQuery, handler.Requests.Single().ApiKey));
    }

    [Fact]
    public async Task GetUser_falls_back_to_the_default_workspace()
    {
        var (client, _) = Create(_ => Json("{\"id\":\"u1\",\"defaultWorkspace\":\"w0\"}"));

        Assert.Equal("w0", (await client.GetUserAsync(CancellationToken.None)).ActiveWorkspace);
    }

    [Fact]
    public async Task GetProjects_pages_until_a_short_page_and_returns_archived_flags()
    {
        var calls = 0;
        var (client, handler) = Create(_ =>
        {
            calls++;

            var count = calls == 1 ? 200 : 3;
            var items = string.Join(',', Enumerable.Range(0, count).Select(i => $"{{\"id\":\"p{calls}-{i}\",\"name\":\"Project {calls}-{i}\",\"archived\":{(i == 0 ? "true" : "false")}}}"));

            return Json($"[{items}]");
        });

        var projects = await client.GetProjectsAsync("w 1", CancellationToken.None);

        Assert.Equal(203, projects.Count);
        Assert.True(projects[0].Archived);
        Assert.Equal(["/api/v1/workspaces/w%201/projects?archived=false&page-size=200&page=1", "/api/v1/workspaces/w%201/projects?archived=false&page-size=200&page=2"], handler.Requests.Select(x => x.PathAndQuery));
    }

    [Fact]
    public async Task GetProjects_keeps_the_client_so_same_named_projects_stay_distinguishable()
    {
        var (client, _) = Create(_ => Json("[{\"id\":\"p1\",\"name\":\"Support\",\"archived\":false,\"clientName\":\"Northwind\"},{\"id\":\"p2\",\"name\":\"Support\",\"archived\":false,\"clientName\":null},{\"id\":\"p3\",\"name\":\"Support\",\"archived\":false}]"));

        var projects = await client.GetProjectsAsync("w1", CancellationToken.None);

        Assert.Equal(["Northwind", "", ""], projects.Select(x => x.ClientName));
    }

    [Fact]
    public async Task GetTimeEntries_reads_the_intervals_in_utc_and_skips_timers_still_running()
    {
        var (client, handler) = Create(_ => Json("[{\"id\":\"e1\",\"description\":\"Standup\",\"projectId\":\"p1\",\"timeInterval\":{\"start\":\"2026-10-02T13:00:00Z\",\"end\":\"2026-10-02T15:45:00Z\"}},{\"id\":\"e2\",\"description\":null,\"projectId\":null,\"timeInterval\":{\"start\":\"2026-10-02T16:00:00Z\",\"end\":null}},{\"id\":\"e3\",\"timeInterval\":{\"start\":\"2026-10-02T17:00:00Z\",\"end\":\"2026-10-02T18:00:00Z\"}}]"));

        var entries = await client.GetTimeEntriesAsync("w 1", "u1", new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Utc), CancellationToken.None);

        Assert.Equal([("e1", "Standup", "p1", 13), ("e3", "", null, 17)], entries.Select(x => (x.Id, x.Description, x.ProjectId, x.StartUtc.Hour)));
        Assert.All(entries, x => Assert.Equal(DateTimeKind.Utc, x.StartUtc.Kind));
        Assert.Equal("/api/v1/workspaces/w%201/user/u1/time-entries?start=2026-10-01T00:00:00Z&end=2026-10-04T00:00:00Z&hydrated=false&page-size=500&page=1", handler.Requests.Single().PathAndQuery);
    }

    [Fact]
    public async Task CreateTimeEntry_posts_utc_timestamps_with_the_z_suffix_and_returns_the_id()
    {
        var (client, handler) = Create(_ => Json("{\"id\":\"remote-9\"}", HttpStatusCode.Created));

        var id = await client.CreateTimeEntryAsync("w1", Payload(), CancellationToken.None);
        var request = handler.Requests.Single();

        Assert.Equal("remote-9", id);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("/api/v1/workspaces/w1/time-entries", request.PathAndQuery);
        Assert.Equal("{\"start\":\"2026-10-02T13:00:00Z\",\"end\":\"2026-10-02T15:45:00Z\",\"description\":\"Standup \\u0022daily\\u0022\",\"projectId\":\"p1\"}", request.Body);
    }

    [Fact]
    public async Task UpdateTimeEntry_puts_to_the_entry_and_reports_a_missing_entry_as_false()
    {
        var found = true;
        var (client, handler) = Create(_ => found ? Json("{\"id\":\"r1\"}") : new HttpResponseMessage(HttpStatusCode.NotFound));

        Assert.True(await client.UpdateTimeEntryAsync("w1", "r1", Payload(), CancellationToken.None));
        Assert.Equal(("/api/v1/workspaces/w1/time-entries/r1", HttpMethod.Put), (handler.Requests[0].PathAndQuery, handler.Requests[0].Method));

        found = false;

        Assert.False(await client.UpdateTimeEntryAsync("w1", "r1", Payload(), CancellationToken.None));
    }

    [Fact]
    public async Task DeleteTimeEntry_treats_an_already_deleted_entry_as_false_without_throwing()
    {
        var status = HttpStatusCode.NoContent;
        var (client, handler) = Create(_ => new HttpResponseMessage(status));

        Assert.True(await client.DeleteTimeEntryAsync("w1", "r1", CancellationToken.None));
        Assert.Equal(HttpMethod.Delete, handler.Requests.Single().Method);

        status = HttpStatusCode.NotFound;

        Assert.False(await client.DeleteTimeEntryAsync("w1", "r1", CancellationToken.None));
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "{\"message\":\"Full authentication is required\",\"code\":4001}", "Clockify rejected the API key.")]
    [InlineData(HttpStatusCode.Forbidden, "{\"message\":\"No access to workspace\"}", "Clockify refused the request: No access to workspace")]
    [InlineData(HttpStatusCode.TooManyRequests, "", "Clockify rate limit reached. Try again in a moment.")]
    [InlineData(HttpStatusCode.BadRequest, "{\"message\":\"Project not found\",\"code\":501}", "Clockify returned 400: Project not found")]
    [InlineData(HttpStatusCode.InternalServerError, "<html>oops</html>", "Clockify returned 500.")]
    public async Task Failures_become_a_clockify_exception_with_a_readable_message(HttpStatusCode status, string body, string expected)
    {
        var (client, _) = Create(_ => new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });

        var exception = await Assert.ThrowsAsync<ClockifyApiException>(() => client.GetUserAsync(CancellationToken.None));

        Assert.Equal(expected, exception.Message);
        Assert.Equal(status, exception.StatusCode);
    }

    [Fact]
    public async Task A_network_failure_becomes_a_clockify_exception()
    {
        var (client, _) = Create(_ => throw new HttpRequestException("no route"));

        var exception = await Assert.ThrowsAsync<ClockifyApiException>(() => client.GetUserAsync(CancellationToken.None));

        Assert.Equal("Clockify could not be reached.", exception.Message);
        Assert.Null(exception.StatusCode);
    }

    [Fact]
    public async Task An_unreadable_success_body_becomes_a_clockify_exception()
    {
        var (client, _) = Create(_ => Json("not json"));

        await Assert.ThrowsAsync<ClockifyApiException>(() => client.GetUserAsync(CancellationToken.None));
    }
}
