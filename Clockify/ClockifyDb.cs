using System.Data.Common;
using Microsoft.Data.SqlClient;

namespace TimesheetLite.Clockify;

internal static class ClockifyDb
{
    public static bool IsMissingTable(DbException exception) => exception is SqlException { Number: 207 or 208 } || exception.Message.Contains("no such table", StringComparison.OrdinalIgnoreCase) || exception.Message.Contains("no such column", StringComparison.OrdinalIgnoreCase);
}
