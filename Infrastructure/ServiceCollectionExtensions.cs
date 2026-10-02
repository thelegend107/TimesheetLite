using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TimesheetLite.Clockify;
using TimesheetLite.Data;
using TimesheetLite.Middleware;
using TimesheetLite.Services;

namespace TimesheetLite.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTimesheet(this IServiceCollection services, IConfiguration configuration)
    {
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
            options.SerializerOptions.PropertyNameCaseInsensitive = false;
            options.SerializerOptions.AllowDuplicateProperties = false;
            options.SerializerOptions.RespectNullableAnnotations = true;
            options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.Converters.Add(new HourMinuteJsonConverter());
        });

        services.AddProblemDetails();
        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddOpenApi();
        services.AddSingleton(TimeProvider.System);

        services.AddDbContext<TimesheetDbContext>(options => options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        services.Configure<TimesheetOptions>(configuration.GetSection("Timesheet"));
        services.AddOptions<ClockifyOptions>().Bind(configuration.GetSection("Clockify")).Validate(IsClockifyUrl, "Clockify:BaseUrl must be an https address on clockify.me.").ValidateOnStart();

        services.AddScoped<ITimesheetService, TimesheetService>();
        services.AddScoped<IClockifyCredentials, ClockifyCredentials>();
        services.AddScoped<IClockifySyncService, ClockifySyncService>();

        var keyPath = configuration["DataProtection:KeyPath"];
        var protection = services.AddDataProtection().SetApplicationName("TimesheetLite");

        if (!string.IsNullOrWhiteSpace(keyPath))
        {
            protection.PersistKeysToFileSystem(new DirectoryInfo(keyPath));
        }

        services.AddHttpClient<IClockifyClient, ClockifyClient>((provider, client) =>
        {
            var settings = provider.GetRequiredService<IOptions<ClockifyOptions>>().Value;

            client.BaseAddress = new Uri(settings.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(30);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

        return services;
    }

    private static bool IsClockifyUrl(ClockifyOptions options) => Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo) && (uri.Host == "clockify.me" || uri.Host.EndsWith(".clockify.me", StringComparison.OrdinalIgnoreCase));
}
