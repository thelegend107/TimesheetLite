using TimesheetLite.Api.Contracts;

namespace TimesheetLite.Clockify;

public interface IClockifySyncService
{
    Task<ClockifyStatusResponse> GetStatusAsync(CancellationToken cancellationToken);

    Task<ClockifySyncResponse> SyncAsync(ClockifySyncRequest request, CancellationToken cancellationToken);
}
