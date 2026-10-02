using System.Data.Common;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Data;

namespace TimesheetLite.Clockify;

public sealed class ClockifyCredentials(TimesheetDbContext db, IDataProtectionProvider protection, IOptions<ClockifyOptions> options, TimeProvider clock) : IClockifyCredentials
{
    private const int RowId = 1;
    private const string Purpose = "TimesheetLite.Clockify.ApiKey";

    private ClockifyKey? known;
    private bool loaded;

    private IDataProtector Protector => protection.CreateProtector(Purpose);

    public async Task<ClockifyKey?> GetAsync(CancellationToken cancellationToken)
    {
        if (loaded)
        {
            return known;
        }

        var stored = await ReadStoredAsync(cancellationToken);

        known = stored is not null ? new ClockifyKey(stored, ClockifyConnectionSource.App) : options.Value.IsConfigured ? new ClockifyKey(options.Value.ApiKey!.Trim(), ClockifyConnectionSource.Environment) : null;
        loaded = true;

        return known;
    }

    public async Task SaveAsync(string apiKey, CancellationToken cancellationToken)
    {
        loaded = false;

        var protectedKey = Protector.Protect(apiKey.Trim());

        for (var attempt = 0; ; attempt++)
        {
            try
            {
                var row = await db.ClockifyConnections.SingleOrDefaultAsync(x => x.Id == RowId, cancellationToken);

                if (row is null)
                {
                    db.ClockifyConnections.Add(new ClockifyConnection { Id = RowId, ProtectedApiKey = protectedKey, SavedAt = clock.GetUtcNow() });
                }
                else
                {
                    row.ProtectedApiKey = protectedKey;
                    row.SavedAt = clock.GetUtcNow();
                }

                await db.SaveChangesAsync(cancellationToken);

                return;
            }
            catch (DbUpdateException exception) when (exception.InnerException is DbException inner && ClockifyDb.IsMissingTable(inner))
            {
                throw new ClockifySetupException("Run Scripts/002-clockify-sync.sql on the database before connecting Clockify.");
            }
            catch (DbException exception) when (ClockifyDb.IsMissingTable(exception))
            {
                throw new ClockifySetupException("Run Scripts/002-clockify-sync.sql on the database before connecting Clockify.");
            }
            catch (DbUpdateException) when (attempt < 2)
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    public async Task<bool> ClearAsync(CancellationToken cancellationToken)
    {
        loaded = false;

        try
        {
            return await db.ClockifyConnections.Where(x => x.Id == RowId).ExecuteDeleteAsync(cancellationToken) > 0;
        }
        catch (DbException exception) when (ClockifyDb.IsMissingTable(exception))
        {
            return false;
        }
    }

    private async Task<string?> ReadStoredAsync(CancellationToken cancellationToken)
    {
        try
        {
            var protectedKey = await db.ClockifyConnections.AsNoTracking().Where(x => x.Id == RowId).Select(x => x.ProtectedApiKey).SingleOrDefaultAsync(cancellationToken);

            return protectedKey is null ? null : Protector.Unprotect(protectedKey);
        }
        catch (DbException exception) when (ClockifyDb.IsMissingTable(exception))
        {
            return null;
        }
        catch (CryptographicException)
        {
            throw new ClockifyKeyUnreadableException("The stored Clockify key cannot be read, usually because the encryption keys changed. Connect Clockify again.");
        }
    }
}
