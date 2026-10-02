using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TimesheetLite.Clockify;

namespace TimesheetLite.Middleware;

internal sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            ClockifySetupException => (StatusCodes.Status409Conflict, "Clockify is not ready"),
            ClockifyApiException => (StatusCodes.Status502BadGateway, "Clockify request failed"),
            BadHttpRequestException bad => (bad.StatusCode, "The request is not valid"),
            _ => (0, (string?)null)
        };

        if (status == 0)
        {
            return false;
        }

        logger.LogWarning(exception, "Handled request failure: {Title}", title);

        httpContext.Response.StatusCode = status;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails { Status = status, Title = title, Detail = exception is BadHttpRequestException ? "A value in the request could not be read. Check the query string and the body." : exception.Message }
        });
    }
}
