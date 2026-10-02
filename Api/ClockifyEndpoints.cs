using System.Net;
using Microsoft.AspNetCore.Http.HttpResults;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Clockify;

namespace TimesheetLite.Api;

public static class ClockifyEndpoints
{
    private const int MaxRangeDays = 92;
    private const int MaxApiKeyLength = 200;

    public static IEndpointRouteBuilder MapClockify(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/clockify").WithTags("Clockify");

        group.MapGet("/", GetStatus)
            .WithName("GetClockifyStatus")
            .WithSummary("Check the Clockify connection")
            .WithDescription("Reports whether Clockify is configured and reachable, the workspace, its projects and how local projects map to them. Makes read-only calls to Clockify.");

        group.MapPut("/connection", Connect)
            .WithName("ConnectClockify")
            .WithSummary("Connect Clockify with an API key")
            .WithDescription("Checks the key with Clockify, then stores it encrypted on the server so no environment variable or restart is needed. A stored key wins over Clockify__ApiKey.");

        group.MapDelete("/connection", Disconnect)
            .WithName("DisconnectClockify")
            .WithSummary("Forget the stored Clockify API key")
            .WithDescription("Removes the key stored by Connect. A key supplied through Clockify__ApiKey can only be removed from the server settings.");

        group.MapPost("/sync", Sync)
            .WithName("SyncClockify")
            .WithSummary("Preview or push entries to Clockify")
            .WithDescription("With apply false the response is a plan and nothing is written. With apply true new entries are created, changed ones are updated and entries deleted here are deleted in Clockify.");

        return app;
    }

    private static async Task<Ok<ClockifyStatusResponse>> GetStatus(IClockifySyncService service, CancellationToken cancellationToken)
    {
        return TypedResults.Ok(await service.GetStatusAsync(cancellationToken));
    }

    private static async Task<Results<Ok<ClockifyStatusResponse>, ValidationProblem>> Connect(ConnectClockifyRequest request, IClockifyCredentials credentials, IClockifyClient client, IClockifySyncService service, CancellationToken cancellationToken)
    {
        var key = request.ApiKey.Trim();

        if (key.Length is 0 or > MaxApiKeyLength || key.Any(character => character is < '!' or > '~'))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["apiKey"] = ["Paste the API key exactly as Clockify shows it, without spaces."] });
        }

        try
        {
            await client.ValidateKeyAsync(key, cancellationToken);
        }
        catch (ClockifyApiException exception) when (exception.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["apiKey"] = ["Clockify rejected this API key. Copy it again from Profile settings, API."] });
        }

        await credentials.SaveAsync(key, cancellationToken);

        return TypedResults.Ok(await service.GetStatusAsync(cancellationToken));
    }

    private static async Task<Results<Ok<ClockifyStatusResponse>, ProblemHttpResult>> Disconnect(IClockifyCredentials credentials, IClockifySyncService service, CancellationToken cancellationToken)
    {
        if (!await credentials.ClearAsync(cancellationToken) && (await credentials.GetAsync(cancellationToken))?.Source == ClockifyConnectionSource.Environment)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Clockify is connected through the server settings", detail: "Remove Clockify__ApiKey from the server settings to disconnect it.");
        }

        return TypedResults.Ok(await service.GetStatusAsync(cancellationToken));
    }

    private static async Task<Results<Ok<ClockifySyncResponse>, ValidationProblem>> Sync(ClockifySyncRequest request, IClockifySyncService service, CancellationToken cancellationToken)
    {
        if (request.To < request.From)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["to"] = ["to must be on or after from."] });
        }

        if (request.To.DayNumber - request.From.DayNumber > MaxRangeDays)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["to"] = [$"Sync at most {MaxRangeDays} days at a time."] });
        }

        return TypedResults.Ok(await service.SyncAsync(request, cancellationToken));
    }
}
