using System.Buffers;
using System.Globalization;
using System.Text;
using TimesheetLite.Api.Contracts;

namespace TimesheetLite.Services;

public static class CsvExporter
{
    private static readonly string[] Header = ["Date", "Start", "End", "Hours", "Project", "Task", "Notes"];
    private static readonly UTF8Encoding Utf8WithBom = new(true);
    private static readonly SearchValues<char> QuotedCharacters = SearchValues.Create("\",\r\n");

    public static byte[] Build(IReadOnlyList<EntryResponse> entries)
    {
        var builder = new StringBuilder();

        builder.Append(string.Join(',', Header)).Append("\r\n");

        foreach (var entry in entries)
        {
            builder
                .Append(entry.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append(',')
                .Append(Time(entry.Start)).Append(',')
                .Append(Time(entry.End)).Append(',')
                .Append(entry.Hours.ToString("0.00", CultureInfo.InvariantCulture)).Append(',')
                .Append(Escape(entry.Project)).Append(',')
                .Append(Escape(entry.Task)).Append(',')
                .Append(Escape(entry.Notes))
                .Append("\r\n");
        }

        return [.. Utf8WithBom.GetPreamble(), .. Utf8WithBom.GetBytes(builder.ToString())];
    }

    public static string FileName(DateOnly from, DateOnly to) => $"timesheet_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.csv";

    internal static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "";
        }

        var text = value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' ? "'" + value : value;
        var needsQuotes = text.AsSpan().IndexOfAny(QuotedCharacters) >= 0 || text[0] == ' ' || text[^1] == ' ';

        return needsQuotes ? "\"" + text.Replace("\"", "\"\"") + "\"" : text;
    }

    private static string Time(TimeOnly? value) => value?.ToString("HH:mm", CultureInfo.InvariantCulture) ?? "";
}
