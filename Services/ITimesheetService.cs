using TimesheetLite.Api.Contracts;

namespace TimesheetLite.Services;

public interface ITimesheetService
{
    Task<IReadOnlyList<EntryResponse>> ListAsync(DateOnly from, DateOnly to, string? project, CancellationToken cancellationToken);

    Task<EntryResponse?> GetAsync(int id, CancellationToken cancellationToken);

    Task<EntryResponse> CreateAsync(ValidEntry entry, CancellationToken cancellationToken);

    Task<EntryResponse?> UpdateAsync(int id, ValidEntry entry, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);

    Task<CatalogResponse> GetCatalogAsync(CancellationToken cancellationToken);
}
