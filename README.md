# Timesheet Lite

Small personal Blazor/Radzen timesheet app backed by SQL Server.

It is intentionally plain:

- one SQL Server table
- one EF Core entity/context
- one `/timesheet` page
- manual date/project/task/hours/notes entry
- weekly navigation
- inline edit/delete
- weekly project totals

## 1. Create the table

Run this script against the SQL Server database you want to use:

```text
Scripts/001-create-time-entry.sql
```

By default the app expects a database named:

```text
TimesheetLite
```

You can change that in `appsettings.json` or through the Docker Compose environment variable.

## 2. Run locally with .NET

Edit `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=TimesheetLite;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True"
  }
}
```
dot
Then run:

```bash
dotnet restore
dotnet run
```

Open the URL shown by `dotnet run`, then go to:

```text
/timesheet
```

## 3. Run with Docker

Edit `docker-compose.yml` and replace:

```text
YOUR_SQL_USER
YOUR_SQL_PASSWORD
```

The included Compose file assumes SQL Server is running on the Docker host and maps the app to:

```text
http://10.10.0.107:1000
```

Run:

```bash
docker compose up -d --build
```

Open:

```text
http://10.10.0.107:1000/timesheet
```

## 4. SQL Server connection notes

Inside a Linux Docker container, `localhost` means the container itself, not the host machine.

The Compose file uses:

```text
host.docker.internal
```

and this Linux compatibility mapping:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

If SQL Server is on another machine, replace the connection string server with that machine/IP.

Example:

```text
Server=10.10.0.107,1433;Database=TimesheetLite;User Id=timesheet_user;Password=your_password;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=True
```

## 5. Project files

```text
TimesheetLite.csproj
Program.cs
Data/TimeEntry.cs
Data/TimesheetDbContext.cs
Components/Pages/Timesheet.razor
Scripts/001-create-time-entry.sql
Dockerfile
docker-compose.yml
```

## 6. Notes

This app does not create or migrate the database automatically. Run the SQL script first.

If you already have an existing app, you can copy only these pieces into it:

- `Data/TimeEntry.cs`
- `Data/TimesheetDbContext.cs`, or merge the entity config into your existing DbContext
- `Components/Pages/Timesheet.razor`
- `Scripts/001-create-time-entry.sql`
