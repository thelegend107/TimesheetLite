using System.Net;
using Microsoft.AspNetCore.Hosting;
using TimesheetLite.Tests.Support;

namespace TimesheetLite.Tests;

public sealed class SpaFactory : TimesheetFactory
{
    public string WebRoot { get; } = Path.Combine(Path.GetTempPath(), $"timesheetlite-spa-{Guid.NewGuid():N}");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(Path.Combine(WebRoot, "assets"));
        File.WriteAllText(Path.Combine(WebRoot, "index.html"), "<!doctype html><title>TimesheetLite shell</title>");
        File.WriteAllText(Path.Combine(WebRoot, "assets", "app.abc123.js"), "console.log('app');");

        base.ConfigureWebHost(builder);

        builder.UseWebRoot(WebRoot);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing && Directory.Exists(WebRoot))
        {
            Directory.Delete(WebRoot, true);
        }
    }
}

public class SpaHostingTests(SpaFactory factory) : IClassFixture<SpaFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task The_root_serves_the_app_shell_and_is_never_cached()
    {
        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("TimesheetLite shell", await response.Content.ReadAsStringAsync());
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Theory]
    [InlineData("/timesheet")]
    [InlineData("/some/deep/link")]
    public async Task Unknown_app_paths_fall_back_to_the_shell_so_old_bookmarks_keep_working(string path)
    {
        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("TimesheetLite shell", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Hashed_assets_are_cached_for_a_year_as_immutable()
    {
        var response = await client.GetAsync("/assets/app.abc123.js");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("public, max-age=31536000, immutable", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Missing_files_and_unknown_api_routes_are_404_and_never_the_shell()
    {
        var file = await client.GetAsync("/assets/missing.js");
        var api = await client.GetAsync("/api/nope");
        var apiRoot = await client.GetAsync("/api");

        Assert.Equal(HttpStatusCode.NotFound, file.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, api.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, apiRoot.StatusCode);
        Assert.DoesNotContain("TimesheetLite shell", await api.Content.ReadAsStringAsync());
        Assert.DoesNotContain("TimesheetLite shell", await apiRoot.Content.ReadAsStringAsync());
    }
}
