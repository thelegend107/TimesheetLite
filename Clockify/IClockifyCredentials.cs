using TimesheetLite.Api.Contracts;

namespace TimesheetLite.Clockify;

public sealed record ClockifyKey(string Value, ClockifyConnectionSource Source);

public interface IClockifyCredentials
{
    Task<ClockifyKey?> GetAsync(CancellationToken cancellationToken);

    Task SaveAsync(string apiKey, CancellationToken cancellationToken);

    Task<bool> ClearAsync(CancellationToken cancellationToken);
}
