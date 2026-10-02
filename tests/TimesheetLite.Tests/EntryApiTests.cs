using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Tests.Support;

namespace TimesheetLite.Tests;

public class EntryApiTests(TimesheetFactory factory) : IClassFixture<TimesheetFactory>, IAsyncLifetime
{
    private readonly HttpClient client = factory.CreateClient();

    public Task InitializeAsync() => factory.ResetAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static object Body(string date = "2026-10-02", string project = "Contoso", string task = "Standup", string start = "08:00", string end = "08:15", string? notes = null) => new { date, project, task, start, end, notes };

    private async Task<EntryResponse> CreateAsync(object body)
    {
        var response = await client.PostAsJsonAsync("/api/entries", body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return (await response.Content.ReadFromJsonAsync<EntryResponse>(TestJson.Options))!;
    }

    [Fact]
    public async Task Create_returns_201_with_location_and_calculated_hours()
    {
        var response = await client.PostAsJsonAsync("/api/entries", Body(start: "08:00", end: "10:45", notes: "- one\n- two"));
        var created = await response.Content.ReadFromJsonAsync<EntryResponse>(TestJson.Options);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal($"/api/entries/{created!.Id}", response.Headers.Location!.ToString());
        Assert.Equal(2.75m, created.Hours);
        Assert.Equal("- one\n- two", created.Notes);
        Assert.Equal(new TimeOnly(8, 0), created.Start);

        var fetched = await client.GetFromJsonAsync<EntryResponse>(response.Headers.Location, TestJson.Options);

        Assert.Equal(created.Id, fetched!.Id);
    }

    [Fact]
    public async Task Create_sends_times_as_hour_minute_strings()
    {
        var response = await client.PostAsJsonAsync("/api/entries", Body(start: "08:05", end: "09:00"));
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal("08:05", document.RootElement.GetProperty("start").GetString());
        Assert.Equal("2026-10-02", document.RootElement.GetProperty("date").GetString());
    }

    [Fact]
    public async Task Create_with_equal_times_returns_a_validation_problem_for_the_end_field()
    {
        var response = await client.PostAsJsonAsync("/api/entries", Body(start: "09:00", end: "09:00"));
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(document.RootElement.GetProperty("errors").TryGetProperty("end", out _));
    }

    [Theory]
    [InlineData("{\"date\":\"2026-10-02\",\"project\":\"Contoso\",\"task\":\"x\",\"start\":\"08:00\"}")]
    [InlineData("{\"date\":\"2026-10-02\",\"project\":\"Contoso\",\"task\":\"x\",\"start\":\"8am\",\"end\":\"09:00\"}")]
    [InlineData("{\"date\":\"2026-10-02\",\"project\":null,\"task\":\"x\",\"start\":\"08:00\",\"end\":\"09:00\"}")]
    [InlineData("{\"Date\":\"2026-10-02\",\"project\":\"Contoso\",\"task\":\"x\",\"start\":\"08:00\",\"end\":\"09:00\"}")]
    public async Task Malformed_bodies_are_rejected_with_400(string json)
    {
        var response = await client.PostAsync("/api/entries", new StringContent(json, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("{\"date\":\"2026-10-02\",\"project\":\"Contoso\",\"task\":\"x\",\"start\":\"08:00\",\"end\":\"09:00\",\"note\":\"misspelled\"}")]
    [InlineData("{\"date\":\"2026-10-02\",\"project\":\"Contoso\",\"task\":\"x\",\"start\":\"08:00\",\"end\":\"09:00\",\"hours\":5}")]
    public async Task Unknown_members_are_rejected_instead_of_silently_dropped(string json)
    {
        var response = await client.PostAsync("/api/entries", new StringContent(json, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<List<EntryResponse>>("/api/entries?from=2026-10-01&to=2026-10-04", TestJson.Options))!);
    }

    [Theory]
    [InlineData("/api/entries?from=garbage&to=2026-10-01")]
    [InlineData("/api/entries?from=2026-10-01")]
    [InlineData("/api/entries/export.csv?from=garbage&to=2026-10-01")]
    [InlineData("/api/entries/export.csv?from=2026-10-01")]
    public async Task Malformed_query_values_are_a_400_even_where_binding_failures_are_thrown(string url)
    {
        using var development = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        var response = await development.CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Times_with_seconds_are_a_validation_error_not_a_database_failure()
    {
        var response = await client.PostAsJsonAsync("/api/entries", Body(start: "08:00:00", end: "08:00:10"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task List_returns_the_range_in_chronological_order()
    {
        await CreateAsync(Body(date: "2026-10-02", start: "13:00", end: "14:00", task: "later"));
        await CreateAsync(Body(date: "2026-10-02", start: "08:00", end: "09:00", task: "earlier"));
        await CreateAsync(Body(date: "2026-10-01", start: "10:00", end: "11:00", task: "yesterday"));
        await CreateAsync(Body(date: "2026-10-05", start: "10:00", end: "11:00", task: "outside"));

        var entries = await client.GetFromJsonAsync<List<EntryResponse>>("/api/entries?from=2026-10-01&to=2026-10-04", TestJson.Options);

        Assert.Equal(["yesterday", "earlier", "later"], entries!.Select(x => x.Task));
    }

    [Fact]
    public async Task List_can_filter_by_project()
    {
        await CreateAsync(Body(project: "Contoso"));
        await CreateAsync(Body(project: "Northwind", start: "09:00", end: "10:00"));

        var entries = await client.GetFromJsonAsync<List<EntryResponse>>("/api/entries?from=2026-10-01&to=2026-10-04&project=Northwind", TestJson.Options);

        Assert.Equal(["Northwind"], entries!.Select(x => x.Project));
    }

    [Fact]
    public async Task List_rejects_an_inverted_range()
    {
        var response = await client.GetAsync("/api/entries?from=2026-10-04&to=2026-10-01");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_recalculates_hours_and_unknown_ids_return_404()
    {
        var created = await CreateAsync(Body(start: "08:00", end: "09:00"));

        var response = await client.PutAsJsonAsync($"/api/entries/{created.Id}", Body(date: "2026-10-03", project: "Northwind", task: "Edited", start: "08:00", end: "09:30", notes: "kept"));
        var updated = await response.Content.ReadFromJsonAsync<EntryResponse>(TestJson.Options);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1.5m, updated!.Hours);
        Assert.Equal(new DateOnly(2026, 10, 3), updated.Date);
        Assert.Equal("Northwind", updated.Project);
        Assert.True(updated.UpdatedAt >= created.UpdatedAt);

        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync("/api/entries/999999", Body())).StatusCode);
    }

    [Fact]
    public async Task Delete_returns_204_then_404()
    {
        var created = await CreateAsync(Body());

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/entries/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/entries/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/entries/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Catalog_lists_projects_and_tasks_most_used_first()
    {
        await CreateAsync(Body(project: "Contoso", task: "Standup"));
        await CreateAsync(Body(project: "Contoso", task: "Standup", start: "09:00", end: "09:15"));
        await CreateAsync(Body(project: "Northwind", task: "Review", start: "10:00", end: "11:00"));

        var catalog = await client.GetFromJsonAsync<CatalogResponse>("/api/catalog", TestJson.Options);

        Assert.Equal(["Contoso", "Northwind"], catalog!.Projects.Select(x => x.Name));
        Assert.Equal(2, catalog.Projects[0].Uses);
        Assert.Equal(("Contoso", "Standup", 2), (catalog.Tasks[0].Project, catalog.Tasks[0].Task, catalog.Tasks[0].Uses));
    }

    [Fact]
    public async Task Export_returns_a_csv_attachment_for_the_range()
    {
        await CreateAsync(Body(task: "Standup, daily", notes: "- bullet"));

        var response = await client.GetAsync("/api/entries/export.csv?from=2026-10-01&to=2026-10-04");
        var text = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("timesheet_2026-10-01_2026-10-04.csv", response.Content.Headers.ContentDisposition!.FileName);
        Assert.Contains("2026-10-02,08:00,08:15,0.25,Contoso,\"Standup, daily\",'- bullet", text);
    }

    [Fact]
    public async Task Config_reports_the_target_and_whether_clockify_has_a_key()
    {
        var config = await client.GetFromJsonAsync<ConfigResponse>("/api/config", TestJson.Options);

        Assert.Equal(37.5m, config!.WeeklyTargetHours);
        Assert.False(config.ClockifyConfigured);
    }

    [Fact]
    public async Task Unknown_api_routes_return_404_instead_of_the_app_shell()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/nope")).StatusCode);
    }

    [Fact]
    public async Task Clockify_status_without_a_key_is_not_configured_and_sync_is_refused()
    {
        var status = await client.GetFromJsonAsync<ClockifyStatusResponse>("/api/clockify", TestJson.Options);
        var sync = await client.PostAsJsonAsync("/api/clockify/sync", new { from = "2026-10-01", to = "2026-10-04", apply = false });

        Assert.Equal(ClockifyIssue.NotConfigured, status!.Issue);
        Assert.Equal(HttpStatusCode.Conflict, sync.StatusCode);
    }
}
