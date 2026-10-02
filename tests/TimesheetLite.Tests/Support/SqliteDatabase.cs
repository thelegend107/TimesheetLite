using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TimesheetLite.Data;

namespace TimesheetLite.Tests.Support;

public sealed class SqliteDatabase : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");

    public SqliteConnection Connection => connection;

    public SqliteDatabase()
    {
        connection.Open();

        using var db = CreateContext();
        db.Database.EnsureCreated();
    }

    public TimesheetDbContext CreateContext() => new(new DbContextOptionsBuilder<TimesheetDbContext>().UseSqlite(connection).Options);

    public void Dispose() => connection.Dispose();
}
