using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TimesheetLite.Services;

public sealed class HourMinuteJsonConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] Formats = ["HH:mm", "HH:mm:ss"];

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String && TimeOnly.TryParseExact(reader.GetString(), Formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var value))
        {
            return value;
        }

        throw new JsonException("Expected a time formatted as HH:mm.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString("HH:mm", CultureInfo.InvariantCulture));
    }
}
