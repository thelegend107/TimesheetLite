using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using TimesheetLite.Clockify;
using Microsoft.Extensions.DependencyInjection;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Data;
using TimesheetLite.Tests.Support;

namespace TimesheetLite.Tests;

public sealed class ClockifyConnectionTests(TimesheetFactory factory) : IClassFixture<TimesheetFactory>, IAsyncLifetime
{
    private readonly HttpClient client = factory.CreateClient();

    public async Task InitializeAsync()
    {
        await factory.ResetAsync();

        factory.Clockify.RejectKeys = false;
        factory.Clockify.ValidatedKeys.Clear();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private Task<HttpResponseMessage> ConnectAsync(string apiKey) => client.PutAsJsonAsync("/api/clockify/connection", new { apiKey });

    private async Task<ClockifyStatusResponse> StatusAsync() => (await client.GetFromJsonAsync<ClockifyStatusResponse>("/api/clockify", TestJson.Options))!;

    private async Task<string?> StoredKeyAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimesheetDbContext>();

        return db.ClockifyConnections.Select(x => x.ProtectedApiKey).SingleOrDefault();
    }

    [Fact]
    public async Task Connecting_checks_the_key_stores_it_encrypted_and_reports_the_account()
    {
        var response = await ConnectAsync("secret-key-123");
        var status = await response.Content.ReadFromJsonAsync<ClockifyStatusResponse>(TestJson.Options);
        var stored = await StoredKeyAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal((ClockifyIssue.None, ClockifyConnectionSource.App, "Test User"), (status!.Issue, status.Connection, status.Account!.UserName));
        Assert.Equal(["secret-key-123"], factory.Clockify.ValidatedKeys);
        Assert.NotNull(stored);
        Assert.DoesNotContain("secret-key-123", stored);
    }

    [Fact]
    public async Task A_key_Clockify_rejects_is_a_400_on_the_api_key_field_and_nothing_is_stored()
    {
        factory.Clockify.RejectKeys = true;

        var response = await ConnectAsync("wrong-key");
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemBody>(TestJson.Options);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("apiKey", problem!.Errors.Keys);
        Assert.Null(await StoredKeyAsync());
        Assert.Equal(ClockifyIssue.NotConfigured, (await StatusAsync()).Issue);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("has a space")]
    public async Task A_blank_or_spaced_key_is_a_400_without_asking_Clockify(string apiKey)
    {
        var response = await ConnectAsync(apiKey);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(factory.Clockify.ValidatedKeys);
    }

    [Fact]
    public async Task A_key_longer_than_any_Clockify_key_is_a_400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await ConnectAsync(new string('a', 201))).StatusCode);
    }

    [Fact]
    public async Task Disconnecting_forgets_the_stored_key()
    {
        await ConnectAsync("secret-key-123");

        var response = await client.DeleteAsync("/api/clockify/connection");
        var status = await response.Content.ReadFromJsonAsync<ClockifyStatusResponse>(TestJson.Options);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal((ClockifyIssue.NotConfigured, ClockifyConnectionSource.None), (status!.Issue, status.Connection));
        Assert.Null(await StoredKeyAsync());
    }

    [Fact]
    public async Task Config_reports_Clockify_as_available_once_connected()
    {
        Assert.False((await client.GetFromJsonAsync<ConfigResponse>("/api/config", TestJson.Options))!.ClockifyConfigured);

        await ConnectAsync("secret-key-123");

        Assert.True((await client.GetFromJsonAsync<ConfigResponse>("/api/config", TestJson.Options))!.ClockifyConfigured);
    }

    [Fact]
    public async Task Connecting_without_the_schema_is_a_409_and_the_rest_of_the_app_keeps_working()
    {
        using var bare = new TimesheetFactory();
        using var http = bare.CreateClient();

        using (var scope = bare.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimesheetDbContext>();

            await db.Database.ExecuteSqlRawAsync("DROP TABLE ClockifyConnection");
        }

        var response = await http.PutAsJsonAsync("/api/clockify/connection", new { apiKey = "secret-key-123" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync("/api/entries?from=2026-10-01&to=2026-10-04")).StatusCode);
    }

    private sealed record ValidationProblemBody(Dictionary<string, string[]> Errors);
}

public sealed class ClockifyServerKeyTests(ClockifyTimesheetFactory factory) : IClassFixture<ClockifyTimesheetFactory>, IAsyncLifetime
{
    private readonly HttpClient client = factory.CreateClient();

    public Task InitializeAsync() => factory.ResetAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<ClockifyStatusResponse> StatusAsync() => (await client.GetFromJsonAsync<ClockifyStatusResponse>("/api/clockify", TestJson.Options))!;

    [Fact]
    public async Task A_key_from_the_server_settings_is_used_and_cannot_be_disconnected_from_the_app()
    {
        var response = await client.DeleteAsync("/api/clockify/connection");

        Assert.Equal(ClockifyConnectionSource.Environment, (await StatusAsync()).Connection);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_stored_key_wins_over_the_server_setting_until_it_is_disconnected()
    {
        await client.PutAsJsonAsync("/api/clockify/connection", new { apiKey = "app-key" });

        Assert.Equal(ClockifyConnectionSource.App, (await StatusAsync()).Connection);

        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/api/clockify/connection")).StatusCode);
        Assert.Equal(ClockifyConnectionSource.Environment, (await StatusAsync()).Connection);
    }
}

public sealed class ClockifyHardeningTests
{
    [Fact]
    public void A_base_url_outside_clockify_stops_the_app_from_starting()
    {
        using var factory = new TimesheetFactory().WithWebHostBuilder(builder => builder.UseSetting("Clockify:BaseUrl", "https://evil.example/api/v1"));

        Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
    }

    [Fact]
    public void A_plain_http_base_url_is_refused()
    {
        using var factory = new TimesheetFactory().WithWebHostBuilder(builder => builder.UseSetting("Clockify:BaseUrl", "http://api.clockify.me/api/v1"));

        Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
    }

    [Fact]
    public async Task An_unreadable_stored_key_is_reported_and_never_replaced_by_the_server_key()
    {
        using var database = new SqliteDatabase();
        using var db = database.CreateContext();
        var clock = new FixedClock(new DateTimeOffset(2026, 10, 2, 22, 0, 0, TimeSpan.Zero));
        var settings = Options.Create(new ClockifyOptions { ApiKey = "server-key" });

        await new ClockifyCredentials(db, new EphemeralDataProtectionProvider(), settings, clock).SaveAsync("stored-key", CancellationToken.None);

        var other = new ClockifyCredentials(db, new EphemeralDataProtectionProvider(), settings, clock);

        await Assert.ThrowsAsync<ClockifyKeyUnreadableException>(() => other.GetAsync(CancellationToken.None));

        await other.SaveAsync("fresh-key", CancellationToken.None);

        Assert.Equal("fresh-key", (await other.GetAsync(CancellationToken.None))!.Value);
    }

    [Fact]
    public async Task Saving_retries_once_when_the_row_changed_underneath()
    {
        using var database = new SqliteDatabase();
        var failures = new FailOnce();
        using var db = new TimesheetDbContext(new DbContextOptionsBuilder<TimesheetDbContext>().UseSqlite(database.Connection).AddInterceptors(failures).Options);
        var credentials = new ClockifyCredentials(db, new EphemeralDataProtectionProvider(), Options.Create(new ClockifyOptions()), new FixedClock(DateTimeOffset.UnixEpoch));

        await credentials.SaveAsync("secret-key", CancellationToken.None);

        Assert.Equal((2, "secret-key"), (failures.Calls, (await credentials.GetAsync(CancellationToken.None))!.Value));
    }

    private sealed class FailOnce : SaveChangesInterceptor
    {
        public int Calls { get; private set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            return ++Calls == 1 ? throw new DbUpdateException("conflict") : base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}

public sealed class ClockifyConnectionKeyTests(TimesheetFactory factory) : IClassFixture<TimesheetFactory>, IAsyncLifetime
{
    private readonly HttpClient client = factory.CreateClient();

    public Task InitializeAsync() => factory.ResetAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Theory]
    [InlineData("abc\u0000def")]
    [InlineData("abc\ndef")]
    [InlineData("clé")]
    public async Task Keys_with_control_or_non_ascii_characters_are_a_400(string apiKey)
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/clockify/connection", new { apiKey })).StatusCode);
    }
}
