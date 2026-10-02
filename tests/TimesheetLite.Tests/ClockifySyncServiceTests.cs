using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Clockify;
using TimesheetLite.Data;
using TimesheetLite.Tests.Support;

namespace TimesheetLite.Tests;

public sealed class ClockifySyncServiceTests : IDisposable
{
    private static readonly DateOnly Friday = new(2026, 10, 2);

    private readonly SqliteDatabase database = new();
    private readonly FakeClockifyClient client = new();
    private readonly ClockifyOptions settings = new() { ApiKey = "key" };
    private readonly TimesheetDbContext db;
    private readonly ClockifySyncService service;

    public ClockifySyncServiceTests()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 10, 2, 22, 0, 0, TimeSpan.Zero));

        db = database.CreateContext();
        service = new ClockifySyncService(db, client, new ClockifyCredentials(db, new EphemeralDataProtectionProvider(), Options.Create(settings), clock), Options.Create(settings), clock);
    }

    public void Dispose()
    {
        db.Dispose();
        database.Dispose();
    }

    private TimeEntry AddEntry(string project = "Contoso", string task = "Standup", string start = "08:00", string end = "10:45", string? notes = null, DateOnly? date = null)
    {
        var entry = new TimeEntry { WorkDate = date ?? Friday, Project = project, Task = task, StartTime = TimeOnly.Parse(start), EndTime = TimeOnly.Parse(end), Hours = 1, Notes = notes, CreatedDate = DateTimeOffset.UnixEpoch, UpdatedDate = DateTimeOffset.UnixEpoch };

        db.TimeEntries.Add(entry);
        db.SaveChanges();

        return entry;
    }

    private Task<ClockifySyncResponse> SyncAsync(bool apply, bool includeNotes = false, IReadOnlyDictionary<string, string>? mappings = null, DateOnly? from = null, DateOnly? to = null)
    {
        var request = new ClockifySyncRequest { From = from ?? new DateOnly(2026, 9, 28), To = to ?? new DateOnly(2026, 10, 4), Apply = apply, IncludeNotes = includeNotes, Mappings = mappings };

        return service.SyncAsync(request, CancellationToken.None);
    }

    [Fact]
    public async Task Preview_plans_creates_and_writes_nothing()
    {
        AddEntry();
        AddEntry(project: "Northwind", task: "Review", start: "11:00", end: "12:00");

        var response = await SyncAsync(apply: false);

        Assert.False(response.Applied);
        Assert.Equal(2, response.Summary.Create);
        Assert.All(response.Items, x => Assert.Equal(ClockifySyncOutcome.Planned, x.Outcome));
        Assert.Empty(client.Entries);
        Assert.Empty(db.ClockifyEntryLinks);
        Assert.Empty(db.ClockifyProjectMaps);
    }

    [Fact]
    public async Task Apply_creates_entries_in_the_account_time_zone_and_a_second_run_changes_nothing()
    {
        AddEntry(start: "08:00", end: "10:45");

        var first = await SyncAsync(apply: true);
        var payload = Assert.Single(client.Entries.Values);

        Assert.Equal(1, first.Summary.Create);
        Assert.Equal(new DateTime(2026, 10, 2, 13, 0, 0, DateTimeKind.Utc), payload.StartUtc);
        Assert.Equal(new DateTime(2026, 10, 2, 15, 45, 0, DateTimeKind.Utc), payload.EndUtc);
        Assert.Equal("p-contoso", payload.ProjectId);
        Assert.Equal("Standup", payload.Description);
        Assert.Single(db.ClockifyEntryLinks);

        var second = await SyncAsync(apply: true);

        Assert.Equal(1, second.Summary.Unchanged);
        Assert.Equal(0, second.Summary.Create);
        Assert.Single(client.Entries);
    }

    [Fact]
    public async Task The_configured_time_zone_overrides_the_account_time_zone()
    {
        settings.TimeZone = "UTC";
        AddEntry(start: "08:00", end: "09:00");

        await SyncAsync(apply: true);

        Assert.Equal(new DateTime(2026, 10, 2, 8, 0, 0, DateTimeKind.Utc), client.Entries.Values.Single().StartUtc);
    }

    [Fact]
    public async Task Editing_an_entry_plans_and_applies_an_update_in_place()
    {
        var entry = AddEntry(start: "08:00", end: "09:00");
        await SyncAsync(apply: true);
        var remoteId = client.Entries.Keys.Single();

        entry.EndTime = new TimeOnly(9, 30);
        db.SaveChanges();

        var preview = await SyncAsync(apply: false);
        var applied = await SyncAsync(apply: true);

        Assert.Equal(1, preview.Summary.Update);
        Assert.Equal(1, applied.Summary.Update);
        Assert.Equal(remoteId, client.Entries.Keys.Single());
        Assert.Equal(new DateTime(2026, 10, 2, 14, 30, 0, DateTimeKind.Utc), client.Entries[remoteId].EndUtc);
    }

    [Fact]
    public async Task Deleting_an_entry_locally_deletes_it_in_clockify_and_drops_the_link()
    {
        var entry = AddEntry();
        await SyncAsync(apply: true);

        db.TimeEntries.Remove(entry);
        db.SaveChanges();

        var preview = await SyncAsync(apply: false);

        Assert.Equal(1, preview.Summary.Delete);
        Assert.Single(client.Entries);

        var applied = await SyncAsync(apply: true);

        Assert.Equal(1, applied.Summary.Delete);
        Assert.Empty(client.Entries);
        Assert.Empty(db.ClockifyEntryLinks.AsNoTracking().ToList());
    }

    [Fact]
    public async Task An_entry_moved_outside_the_range_is_updated_in_place_instead_of_deleted_or_forgotten()
    {
        var entry = AddEntry();
        await SyncAsync(apply: true);
        var remoteId = client.Entries.Keys.Single();

        entry.WorkDate = new DateOnly(2026, 10, 12);
        db.SaveChanges();

        var preview = await SyncAsync(apply: false);
        var item = Assert.Single(preview.Items);

        Assert.Equal(0, preview.Summary.Delete);
        Assert.Equal(ClockifySyncAction.Update, item.Action);
        Assert.Equal(new DateOnly(2026, 10, 12), item.Date);
        Assert.Contains("Moved here from 2026-10-02", item.Message);

        await SyncAsync(apply: true);

        Assert.Equal(remoteId, client.Entries.Keys.Single());
        Assert.Equal(new DateTime(2026, 10, 12, 13, 0, 0, DateTimeKind.Utc), client.Entries[remoteId].StartUtc);
        Assert.Equal(new DateOnly(2026, 10, 12), db.ClockifyEntryLinks.Single().WorkDate);

        var after = await SyncAsync(apply: false, from: new DateOnly(2026, 10, 12), to: new DateOnly(2026, 10, 18));

        Assert.Equal(1, after.Summary.Unchanged);
    }

    [Fact]
    public async Task A_blocked_entry_that_was_pushed_before_says_the_old_version_is_still_in_clockify()
    {
        var entry = AddEntry();
        await SyncAsync(apply: true);

        entry.Project = "Internal";
        db.SaveChanges();

        var response = await SyncAsync(apply: false);

        Assert.Equal(1, response.Summary.Blocked);
        Assert.Contains("still in Clockify", response.Items.Single().Message);
    }

    [Fact]
    public async Task A_project_name_shared_by_two_clockify_projects_is_not_guessed()
    {
        client.Projects.Add(new ClockifyProject("p-contoso-two", "Contoso", false));
        AddEntry();

        var preview = await SyncAsync(apply: false);
        var status = await service.GetStatusAsync(CancellationToken.None);

        Assert.Equal(1, preview.Summary.Blocked);
        Assert.Equal(ClockifyMappingSource.None, status.Mappings.Single(x => x.Project == "Contoso").Source);
        Assert.Empty(db.ClockifyProjectMaps);

        var chosen = await SyncAsync(apply: true, mappings: new Dictionary<string, string> { ["Contoso"] = "p-contoso-two" });

        Assert.Equal(1, chosen.Summary.Create);
        Assert.Equal("p-contoso-two", client.Entries.Values.Single().ProjectId);
    }

    [Fact]
    public async Task A_local_time_that_happens_twice_uses_the_earlier_reading_so_the_duration_matches_the_hours()
    {
        AddEntry(start: "00:30", end: "01:30", date: new DateOnly(2026, 11, 1));

        await SyncAsync(apply: true, from: new DateOnly(2026, 11, 1), to: new DateOnly(2026, 11, 1));

        var payload = client.Entries.Values.Single();

        Assert.Equal(new DateTime(2026, 11, 1, 5, 30, 0, DateTimeKind.Utc), payload.StartUtc);
        Assert.Equal(new DateTime(2026, 11, 1, 6, 30, 0, DateTimeKind.Utc), payload.EndUtc);
    }

    [Fact]
    public async Task A_push_finishes_and_records_every_link_even_when_the_browser_disconnects_midway()
    {
        AddEntry(task: "First", start: "08:00", end: "09:00");
        AddEntry(task: "Second", start: "09:00", end: "10:00");
        AddEntry(task: "Third", start: "10:00", end: "11:00");

        using var disconnect = new CancellationTokenSource();
        client.AfterCreate = disconnect.Cancel;

        var request = new ClockifySyncRequest { From = new DateOnly(2026, 9, 28), To = new DateOnly(2026, 10, 4), Apply = true };
        var response = await service.SyncAsync(request, disconnect.Token);

        Assert.Equal(3, response.Summary.Create);
        Assert.Equal(3, client.Entries.Count);
        Assert.Equal(3, db.ClockifyEntryLinks.Count());
    }

    [Fact]
    public async Task A_server_error_after_the_request_was_sent_also_warns_about_a_possible_duplicate()
    {
        AddEntry();
        client.FailWhen = _ => true;
        client.FailStatus = System.Net.HttpStatusCode.BadGateway;

        var failed = (await SyncAsync(apply: true)).Items.Single();

        Assert.Contains("check there before pushing again", failed.Message);
    }

    [Fact]
    public async Task A_rejection_from_clockify_does_not_claim_the_entry_may_exist()
    {
        AddEntry();
        client.FailWhen = _ => true;

        var failed = (await SyncAsync(apply: true)).Items.Single();

        Assert.DoesNotContain("check there", failed.Message);
    }

    [Fact]
    public async Task A_label_that_has_to_be_cut_never_ends_in_half_of_a_character()
    {
        AddEntry(project: new string('p', 100), task: new string('t', 96) + "\U0001F600" + "z");

        var label = (await SyncAsync(apply: false)).Items.Single().Label;

        Assert.False(char.IsHighSurrogate(label[^1]));
        Assert.True(label.Length <= 200);
    }

    [Fact]
    public async Task A_timeout_while_creating_warns_that_the_entry_may_already_exist()
    {
        AddEntry();
        client.TimeoutWhen = _ => true;

        var response = await SyncAsync(apply: true);
        var failed = response.Items.Single();

        Assert.Equal(ClockifySyncOutcome.Failed, failed.Outcome);
        Assert.Contains("did not respond in time", failed.Message);
        Assert.Contains("check there before pushing again", failed.Message);
        Assert.Empty(db.ClockifyEntryLinks);
    }

    [Fact]
    public async Task An_unmapped_project_is_blocked_while_other_entries_still_sync()
    {
        AddEntry();
        AddEntry(project: "Internal", task: "Planning", start: "11:00", end: "12:00");

        var response = await SyncAsync(apply: true);
        var blocked = response.Items.Single(x => x.Action == ClockifySyncAction.Blocked);

        Assert.Equal(1, response.Summary.Create);
        Assert.Equal(1, response.Summary.Blocked);
        Assert.Contains("Internal", blocked.Message);
        Assert.Equal(ClockifySyncOutcome.Skipped, blocked.Outcome);
        Assert.Single(client.Entries);
    }

    [Fact]
    public async Task A_requested_mapping_is_used_and_remembered_for_next_time()
    {
        AddEntry(project: "Internal", task: "Planning");

        var response = await SyncAsync(apply: true, mappings: new Dictionary<string, string> { ["Internal"] = "p-northwind" });

        Assert.Equal(1, response.Summary.Create);
        Assert.Equal("p-northwind", client.Entries.Values.Single().ProjectId);
        Assert.Equal("p-northwind", db.ClockifyProjectMaps.Single(x => x.Project == "Internal").ClockifyProjectId);

        AddEntry(project: "Internal", task: "Planning 2", start: "13:00", end: "14:00");

        var next = await SyncAsync(apply: false);

        Assert.Equal(1, next.Summary.Create);
        Assert.Equal(0, next.Summary.Blocked);
    }

    [Fact]
    public async Task A_mapping_to_an_unknown_clockify_project_is_ignored()
    {
        AddEntry(project: "Internal");

        var response = await SyncAsync(apply: false, mappings: new Dictionary<string, string> { ["Internal"] = "does-not-exist" });

        Assert.Equal(1, response.Summary.Blocked);
    }

    [Fact]
    public async Task Project_names_match_case_insensitively_and_archived_projects_are_skipped()
    {
        client.Projects.Clear();
        client.Projects.Add(new ClockifyProject("p-old", "contoso", true));
        client.Projects.Add(new ClockifyProject("p-new", "CONTOSO", false));
        AddEntry();

        await SyncAsync(apply: true);

        Assert.Equal("p-new", client.Entries.Values.Single().ProjectId);
    }

    [Fact]
    public async Task Including_notes_changes_the_description_and_triggers_an_update()
    {
        AddEntry(task: "Review", notes: "- one\n- two");
        await SyncAsync(apply: true);

        Assert.Equal("Review", client.Entries.Values.Single().Description);

        var response = await SyncAsync(apply: true, includeNotes: true);

        Assert.Equal(1, response.Summary.Update);
        Assert.Equal("Review\n- one\n- two", client.Entries.Values.Single().Description);
    }

    [Fact]
    public async Task Descriptions_are_cut_to_the_clockify_limit()
    {
        AddEntry(task: "Review", notes: new string('n', 1000));

        var response = await SyncAsync(apply: false, includeNotes: true);

        Assert.True(response.Items.Single().Description.Length <= 3000);
    }

    [Fact]
    public async Task An_entry_that_ends_after_midnight_ends_the_next_day_in_utc()
    {
        AddEntry(start: "22:00", end: "01:00", date: new DateOnly(2026, 9, 29));

        await SyncAsync(apply: true);

        var payload = client.Entries.Values.Single();

        Assert.Equal(new DateTime(2026, 9, 30, 3, 0, 0, DateTimeKind.Utc), payload.StartUtc);
        Assert.Equal(new DateTime(2026, 9, 30, 6, 0, 0, DateTimeKind.Utc), payload.EndUtc);
    }

    [Fact]
    public async Task Winter_time_uses_the_standard_offset()
    {
        AddEntry(start: "08:00", end: "09:00", date: new DateOnly(2026, 12, 1));

        await SyncAsync(apply: true, from: new DateOnly(2026, 11, 30), to: new DateOnly(2026, 12, 6));

        Assert.Equal(new DateTime(2026, 12, 1, 14, 0, 0, DateTimeKind.Utc), client.Entries.Values.Single().StartUtc);
    }

    [Fact]
    public async Task A_time_that_falls_in_the_spring_forward_gap_is_blocked()
    {
        AddEntry(start: "02:30", end: "03:30", date: new DateOnly(2026, 3, 8));

        var response = await SyncAsync(apply: true, from: new DateOnly(2026, 3, 8), to: new DateOnly(2026, 3, 8));

        Assert.Equal(1, response.Summary.Blocked);
        Assert.Contains("daylight", response.Items.Single().Message);
        Assert.Empty(client.Entries);
    }

    [Fact]
    public async Task An_update_recreates_the_entry_when_it_was_deleted_in_clockify()
    {
        var entry = AddEntry(start: "08:00", end: "09:00");
        await SyncAsync(apply: true);
        client.Entries.Clear();

        entry.EndTime = new TimeOnly(9, 15);
        db.SaveChanges();

        var response = await SyncAsync(apply: true);

        Assert.Equal(1, response.Summary.Update);
        Assert.Single(client.Entries);
        Assert.Equal(client.Entries.Keys.Single(), db.ClockifyEntryLinks.Single().ClockifyEntryId);
    }

    [Fact]
    public async Task A_clockify_failure_is_reported_on_that_entry_and_the_rest_continue()
    {
        AddEntry(task: "Good one", start: "08:00", end: "09:00");
        AddEntry(task: "Please fail", start: "09:00", end: "10:00");
        AddEntry(task: "Good two", start: "10:00", end: "11:00");
        client.FailWhen = payload => payload.Description.Contains("fail");

        var response = await SyncAsync(apply: true);
        var failed = response.Items.Single(x => x.Outcome == ClockifySyncOutcome.Failed);

        Assert.Equal(2, response.Summary.Create);
        Assert.Equal(1, response.Summary.Failed);
        Assert.Equal("Please fail", failed.Description);
        Assert.Contains("rejected", failed.Message);
        Assert.Equal(2, client.Entries.Count);
        Assert.Equal(2, db.ClockifyEntryLinks.Count());

        client.FailWhen = null;
        var retry = await SyncAsync(apply: true);

        Assert.Equal(1, retry.Summary.Create);
        Assert.Equal(2, retry.Summary.Unchanged);
    }

    [Fact]
    public async Task A_chosen_project_that_no_longer_exists_blocks_instead_of_falling_back_to_another()
    {
        AddEntry();
        db.ClockifyProjectMaps.Add(new ClockifyProjectMap { Project = "Contoso", ClockifyProjectId = "p-northwind" });
        db.SaveChanges();

        var response = await SyncAsync(apply: true, mappings: new Dictionary<string, string> { ["Contoso"] = "p-archived" });

        Assert.Equal(1, response.Summary.Blocked);
        Assert.Equal(0, response.Summary.Create);
        Assert.Empty(client.Entries);
        Assert.Equal("p-northwind", db.ClockifyProjectMaps.Single().ClockifyProjectId);
    }

    [Fact]
    public async Task Entries_without_times_are_blocked()
    {
        var entry = AddEntry();
        entry.StartTime = null;
        db.SaveChanges();

        var response = await SyncAsync(apply: false);

        Assert.Equal(1, response.Summary.Blocked);
    }

    [Fact]
    public async Task Status_reports_the_account_projects_and_how_each_local_project_maps()
    {
        AddEntry(project: "Contoso");
        AddEntry(project: "Internal", start: "11:00", end: "12:00");
        AddEntry(project: "Northwind", start: "12:00", end: "13:00");
        db.ClockifyProjectMaps.Add(new ClockifyProjectMap { Project = "Northwind", ClockifyProjectId = "p-contoso" });
        db.SaveChanges();

        var status = await service.GetStatusAsync(CancellationToken.None);

        Assert.Equal(ClockifyIssue.None, status.Issue);
        Assert.Equal("Test Workspace", status.Account!.WorkspaceName);
        Assert.Equal("America/Chicago", status.Account.TimeZone);
        Assert.Equal(["p-contoso", "p-northwind"], status.Projects.Select(x => x.Id));
        Assert.Equal((ClockifyMappingSource.Name, "p-contoso"), (status.Mappings.Single(x => x.Project == "Contoso").Source, status.Mappings.Single(x => x.Project == "Contoso").ClockifyProjectId));
        Assert.Equal(ClockifyMappingSource.None, status.Mappings.Single(x => x.Project == "Internal").Source);
        Assert.Equal((ClockifyMappingSource.Saved, "p-contoso"), (status.Mappings.Single(x => x.Project == "Northwind").Source, status.Mappings.Single(x => x.Project == "Northwind").ClockifyProjectId));
    }

    [Fact]
    public async Task Status_reports_each_projects_client_so_duplicates_can_be_told_apart()
    {
        client.Projects.Clear();
        client.Projects.Add(new ClockifyProject("p-one", "Support", false, "Northwind"));
        client.Projects.Add(new ClockifyProject("p-two", "Support", false, "Adventure Works"));
        client.Projects.Add(new ClockifyProject("p-three", "Conference", false));

        var status = await service.GetStatusAsync(CancellationToken.None);

        Assert.Equal([("p-one", "Support", "Northwind"), ("p-two", "Support", "Adventure Works"), ("p-three", "Conference", "")], status.Projects.Select(x => (x.Id, x.Name, x.ClientName)));
    }

    [Fact]
    public async Task Status_without_an_api_key_is_not_configured()
    {
        settings.ApiKey = null;

        Assert.Equal(ClockifyIssue.NotConfigured, (await service.GetStatusAsync(CancellationToken.None)).Issue);
    }

    [Fact]
    public async Task Status_reports_missing_tables_so_the_core_app_keeps_working()
    {
        await db.Database.ExecuteSqlRawAsync("DROP TABLE ClockifyEntryLink");

        var status = await service.GetStatusAsync(CancellationToken.None);

        Assert.Equal(ClockifyIssue.SchemaMissing, status.Issue);
        Assert.Contains("002-clockify-sync.sql", status.Message);
    }

    [Fact]
    public async Task Status_maps_a_rejected_key_and_an_unreachable_service()
    {
        client.FailStatusWith = new ClockifyApiException(System.Net.HttpStatusCode.Unauthorized, "Clockify rejected the API key.");

        Assert.Equal(ClockifyIssue.Unauthorized, (await service.GetStatusAsync(CancellationToken.None)).Issue);

        client.FailStatusWith = new ClockifyApiException(null, "Clockify could not be reached.");

        Assert.Equal(ClockifyIssue.Unreachable, (await service.GetStatusAsync(CancellationToken.None)).Issue);
    }

    [Fact]
    public async Task An_unknown_time_zone_is_reported_as_a_setup_problem()
    {
        settings.TimeZone = "Mars/Olympus";

        var status = await service.GetStatusAsync(CancellationToken.None);

        Assert.Equal(ClockifyIssue.NotConfigured, status.Issue);
        Assert.Contains("Mars/Olympus", status.Message);
        await Assert.ThrowsAsync<ClockifySetupException>(() => SyncAsync(apply: false));
    }
}
