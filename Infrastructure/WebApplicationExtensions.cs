using Microsoft.AspNetCore.Builder;
using TimesheetLite.Api;

namespace TimesheetLite.Infrastructure;

public static class WebApplicationExtensions
{
    public static WebApplication UseTimesheet(this WebApplication app)
    {
        app.UseExceptionHandler();

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }

        app.UseStatusCodePages();
        app.UseHttpsRedirection();

        var staticFiles = new StaticFileOptions
        {
            OnPrepareResponse = context =>
            {
                var immutable = context.Context.Request.Path.StartsWithSegments("/assets");

                context.Context.Response.Headers.CacheControl = immutable ? "public,max-age=31536000,immutable" : "no-cache";
            }
        };

        app.UseDefaultFiles();
        app.UseStaticFiles(staticFiles);

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.MapCatalog();
        app.MapEntries();
        app.MapClockify();

        app.MapFallback("/api/{**path}", () => TypedResults.NotFound());
        app.MapFallbackToFile("index.html", staticFiles);

        return app;
    }
}
