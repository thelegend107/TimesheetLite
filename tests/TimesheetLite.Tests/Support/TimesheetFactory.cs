using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using TimesheetLite.Clockify;
using TimesheetLite.Data;

namespace TimesheetLite.Tests.Support;

public class TimesheetFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly string keyRing = Path.Combine(Path.GetTempPath(), "timesheetlite-test-keys-" + Guid.NewGuid().ToString("N"));

    public FakeClockifyClient Clockify { get; } = new();

    protected virtual string? ClockifyApiKey => null;

    public async Task ResetAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimesheetDbContext>();

        await db.ClockifyEntryLinks.ExecuteDeleteAsync();
        await db.ClockifyProjectMaps.ExecuteDeleteAsync();
        await db.ClockifyConnections.ExecuteDeleteAsync();
        await db.TimeEntries.ExecuteDeleteAsync();

        Clockify.Entries.Clear();
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TimesheetDbContext>().Database.EnsureCreated();

        return host;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        connection.Open();

        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            var settings = new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = "unused", ["Clockify:ApiKey"] = ClockifyApiKey, ["Timesheet:WeeklyTargetHours"] = "37.5", ["DataProtection:KeyPath"] = keyRing };

            configuration.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<TimesheetDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<TimesheetDbContext>>();
            services.AddDbContext<TimesheetDbContext>(options => options.UseSqlite(connection));

            services.RemoveAll<IClockifyClient>();
            services.AddSingleton<IClockifyClient>(Clockify);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing)
        {
            connection.Dispose();

            if (Directory.Exists(keyRing))
            {
                Directory.Delete(keyRing, true);
            }
        }
    }
}

public sealed class ClockifyTimesheetFactory : TimesheetFactory
{
    protected override string? ClockifyApiKey => "test-key";
}
