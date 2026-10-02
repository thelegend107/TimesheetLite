using TimesheetLite.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTimesheet(builder.Configuration);

var app = builder.Build();

app.UseTimesheet();

app.Run();

public partial class Program;
