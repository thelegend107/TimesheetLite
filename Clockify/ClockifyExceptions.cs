using System.Net;

namespace TimesheetLite.Clockify;

public sealed class ClockifyApiException(HttpStatusCode? statusCode, string message, Exception? inner = null) : Exception(message, inner)
{
    public HttpStatusCode? StatusCode { get; } = statusCode;
}

public class ClockifySetupException(string message) : Exception(message);

public sealed class ClockifyKeyUnreadableException(string message) : ClockifySetupException(message);
