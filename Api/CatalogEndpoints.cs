using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Clockify;
using TimesheetLite.Services;

namespace TimesheetLite.Api;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalog(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Catalog");

        group.MapGet("/catalog", GetCatalog)
            .WithName("GetCatalog")
            .WithSummary("List known projects and tasks")
            .WithDescription("Projects and tasks already used in entries, most used first, for suggestions in the entry form.");

        group.MapGet("/config", GetConfig)
            .WithName("GetConfig")
            .WithSummary("Get client settings")
            .WithDescription("Weekly target hours and whether a Clockify API key is available. Never returns the key.");

        return app;
    }

    private static async Task<Ok<CatalogResponse>> GetCatalog(ITimesheetService service, CancellationToken cancellationToken)
    {
        return TypedResults.Ok(await service.GetCatalogAsync(cancellationToken));
    }

    private static async Task<Ok<ConfigResponse>> GetConfig(IOptions<TimesheetOptions> timesheet, IClockifyCredentials credentials, CancellationToken cancellationToken)
    {
        try
        {
            return TypedResults.Ok(new ConfigResponse(timesheet.Value.WeeklyTargetHours, await credentials.GetAsync(cancellationToken) is not null));
        }
        catch (ClockifyKeyUnreadableException)
        {
            return TypedResults.Ok(new ConfigResponse(timesheet.Value.WeeklyTargetHours, true));
        }
    }
}
