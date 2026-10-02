using System.Text.Json;
using System.Text.Json.Serialization;
using TimesheetLite.Services;

namespace TimesheetLite.Tests.Support;

public static class TestJson
{
    public static readonly JsonSerializerOptions Options = Create();

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        options.Converters.Add(new JsonStringEnumConverter());
        options.Converters.Add(new HourMinuteJsonConverter());

        return options;
    }
}
