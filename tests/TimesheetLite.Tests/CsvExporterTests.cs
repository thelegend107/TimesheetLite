using System.Text;
using TimesheetLite.Api.Contracts;
using TimesheetLite.Services;

namespace TimesheetLite.Tests;

public class CsvExporterTests
{
    private static EntryResponse Entry(string project = "Contoso", string task = "Standup", string? notes = null) => new(1, new DateOnly(2026, 10, 2), project, task, new TimeOnly(8, 0), new TimeOnly(10, 45), 2.75m, notes, DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch);

    [Fact]
    public void Build_writes_a_byte_order_mark_header_and_crlf_rows()
    {
        var bytes = CsvExporter.Build([Entry()]);

        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, bytes[..3]);
        Assert.Equal("Date,Start,End,Hours,Project,Task,Notes\r\n2026-10-02,08:00,10:45,2.75,Contoso,Standup,\r\n", Encoding.UTF8.GetString(bytes[3..]));
    }

    [Fact]
    public void Build_with_no_entries_writes_only_the_header()
    {
        Assert.Equal("Date,Start,End,Hours,Project,Task,Notes\r\n", Encoding.UTF8.GetString(CsvExporter.Build([])[3..]));
    }

    [Fact]
    public void Missing_times_are_written_as_empty_cells()
    {
        var entry = Entry() with { Start = null, End = null };

        Assert.Contains("2026-10-02,,,2.75,", Encoding.UTF8.GetString(CsvExporter.Build([entry])));
    }

    [Theory]
    [InlineData("plain", "plain")]
    [InlineData("a,b", "\"a,b\"")]
    [InlineData("say \"hi\"", "\"say \"\"hi\"\"\"")]
    [InlineData("line one\nline two", "\"line one\nline two\"")]
    [InlineData(" padded", "\" padded\"")]
    [InlineData("- item\n- two", "\"'- item\n- two\"")]
    [InlineData("=SUM(A1)", "'=SUM(A1)")]
    [InlineData("+1", "'+1")]
    [InlineData("@cmd", "'@cmd")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void Escape_quotes_special_characters_and_neutralises_formulas(string? input, string expected)
    {
        Assert.Equal(expected, CsvExporter.Escape(input));
    }

    [Fact]
    public void File_name_contains_the_range()
    {
        Assert.Equal("timesheet_2026-09-28_2026-10-04.csv", CsvExporter.FileName(new DateOnly(2026, 9, 28), new DateOnly(2026, 10, 4)));
    }
}
