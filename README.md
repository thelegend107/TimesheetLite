# TimesheetLite

## What it is

- A personal timesheet for one person: log what was worked on, when and for how long, review the week, export it as CSV, and optionally push it to Clockify so the work is entered once.
- Replaces the old Blazor/Radzen app (still in git history, commit `feb1bf4`). It uses the same SQL Server table, `dbo.TimeEntry`, unchanged.
- Self-hosted on a LAN in Docker over HTTPS. No sign-in, see [Auth](#auth).
- Logging works on its own. CSV export and the Clockify push are additions, not requirements.

## Features

- Week and day navigation: week bar, a tab per day with its hours, jump to today, calendar picker. Weeks run Monday to Sunday.
- Add form with free-typed times and live hours. Hours are derived from start and end, never typed. An end at or before the start means the entry ends the next day.
- Edit drawer for an existing entry.
- Duplicate an entry.
- Delete with a confirmation dialog.
- Week summary by project and by day against the weekly target (40 hours by default).
- CSV export of a date range, optionally for one project.
- Clockify push with a preview of exactly what will be created, changed or removed.
- A local project maps to a Clockify client, and the Clockify project under it can be chosen per project or by task wording (for example "standup" goes to Meetings).
- Entries already in Clockify with the same start and end are linked instead of duplicated.
- Light and dark themes.

## Architecture

- Backend: ASP.NET Core 10 Minimal API, EF Core, SQL Server. Endpoints are grouped by resource, return `TypedResults`, and report errors as RFC 7807 problem details.
- Frontend: Vite, React 19, TypeScript (strict), Tailwind CSS v4, HeroUI v3, TanStack Query. It lives in `client/`.
- In production the API serves the built UI as static files from `wwwroot` and falls back to `index.html` for any non-API path. Unknown `/api/*` routes answer 404.
- Static caching: `/assets/*` is cacheable for a year (hashed file names), everything else is `no-cache`.
- Clockify is reached from the server only. The API key never goes to the browser after it is pasted; `GET /api/config` only reports whether a key is available.
- OpenAPI document: `/openapi/v1.json`, served only when `ASPNETCORE_ENVIRONMENT` is `Development` (so not in Docker).

Project layout:

```text
Program.cs                    entry point
Infrastructure/               service registration and the request pipeline
Api/                          endpoint groups: entries, catalog and config, clockify
Api/Contracts/                request and response records
Services/                     entry service, validation, hours, CSV export, time JSON converter
Clockify/                     Clockify HTTP client, sync planner and applier, options
Data/                         EF Core entities and DbContext
Middleware/                   exception handler for Clockify failures
Scripts/                      SQL scripts (001 required, 002 optional)
client/                       Vite + React app (src/api, src/components, src/lib)
tests/TimesheetLite.Tests/    xUnit tests for the API
wwwroot/                      built UI (git-ignored; filled by the Docker build)
Dockerfile, docker-compose.yml, TimesheetLite.http
```

## Run locally

Database first: see [Database](#database).

API:

- Set the connection string. The default in `appsettings.json` points at a SQL Server on `localhost,11433` with a database named `Timesheet`. Override it with the `ConnectionStrings__DefaultConnection` environment variable or with user secrets (the project has a user secrets id) instead of editing the file.
- `dotnet run` from the repo root. The launch profile uses the `Development` environment and listens on `https://localhost:51064` and `http://localhost:51065`.
- `TimesheetLite.http` has a request for every endpoint (base URL `https://localhost:51064`).

UI:

- `npm --prefix client ci`, once. Node 24 is what the Docker build uses.
- `npm --prefix client run dev` serves the UI on `http://localhost:5173`.
- The Vite dev server proxies `/api` to the API. The target defaults to `https://localhost:51064` and can be changed with `API_PROXY_TARGET`, for example `API_PROXY_TARGET=https://10.10.1.107:1000 npm --prefix client run dev` to develop the UI against the deployed API. Point it at an HTTPS address: the API redirects plain HTTP (such as port 51065) to HTTPS, and a proxy does not follow that redirect. Certificate errors from self-signed certificates are ignored by the proxy.

Production build without Docker:

- `npm --prefix client run build` writes `client/dist`. Copy its contents into `wwwroot` and run the API to serve the UI from one origin.

## Tests

- API: `dotnet test tests/TimesheetLite.Tests`. It runs the real endpoints against an in-memory SQLite database and a fake Clockify client, so it needs no SQL Server and never calls Clockify.
- UI unit tests: `npm --prefix client test` (Vitest, jsdom).
- Types: `npm --prefix client run typecheck`.
- Lint: `npm --prefix client run lint`.
- `npm --prefix client run build` runs the type check and then the production build.

## Database

- The app never creates or migrates the database. Run the scripts yourself against SQL Server.
- `Scripts/001-create-time-entry.sql` is required. It creates the `Timesheet` database if it is missing, `dbo.TimeEntry`, its indexes and the `dbo.vTimeEntryWeeklySummary` view. It is safe to run again. The app does not read the view; it exists for ad hoc queries.
- `Scripts/002-clockify-sync.sql` is optional and only needed for the Clockify push. It creates `dbo.ClockifyEntryLink` (which local entry became which Clockify entry), `dbo.ClockifyProjectMap` (remembered project mappings) and `dbo.ClockifyTaskRule` (remembered task wording rules). It is safe to run again, so run it again after updating to create any table that is missing. Without it, Clockify reports that the schema is missing and refuses to sync; everything else works.
- Entry limits: project and task up to 100 characters, notes up to 1000 characters, dates between the years 2000 and 2100, start and end must differ.

## Docker deployment

- `docker compose up -d --build` from the repo root, then open `https://10.10.1.107:1000`.
- The compose file publishes container port 8443 on `10.10.1.107:1000`. The container also listens on HTTP 8080, which is not published.
- HTTPS uses a self-signed certificate mounted read-only from `certs/timesheetlite.pfx`. The `certs/` folder is git-ignored and docker-ignored, so create the file yourself. Its password is set in `docker-compose.yml` (`Kestrel__Certificates__Default__Password`). Include the host IP in the certificate's subject alternative names; browsers still warn about a self-signed certificate until it is trusted.
- The SQL Server connection string is set in `docker-compose.yml` (`ConnectionStrings__DefaultConnection`). Edit it there if the server, port or login changes. `host.docker.internal` is also mapped to the Docker host.
- Clockify settings are optional and read from a `.env` file next to `docker-compose.yml` (git-ignored and docker-ignored):

```text
CLOCKIFY_API_KEY=
CLOCKIFY_WORKSPACE_ID=
CLOCKIFY_TIME_ZONE=
```

- The Dockerfile has three stages: `node:24-alpine` runs `npm ci` and `npm run build` in `client/`; the .NET 10 SDK stage restores, copies `client/dist` into `wwwroot` and publishes; the final stage is `aspnet:10.0`. Dependency installs and restores are cached until `client/package.json`, `client/package-lock.json` or `TimesheetLite.csproj` changes.
- The `aspnet:10.0` image is Ubuntu based and ships tzdata, so IANA time zone ids such as `Europe/Berlin` resolve for the Clockify push.
- The container runs in the `Production` environment: HSTS is on and the OpenAPI document is not served.

## Clockify

Setup:

- Connect from the app: open the Clockify dialog, follow the link to your Clockify profile settings (sign in the way you normally do, including Microsoft or Google), generate an API key under API and paste it. The key is checked with Clockify and stored encrypted in `dbo.ClockifyConnection`; no restart is needed. Clockify offers apps no sign-in flow, only API keys, so this is the closest to signing in. `PUT /api/clockify/connection` stores a key and `DELETE /api/clockify/connection` forgets it. The app has no sign-in, so anyone who can reach it on the network can connect, disconnect or push to Clockify: keep it on a trusted network.
- The encryption keys for the stored API key live in the folder named by `DataProtection__KeyPath`. The compose file points it at a named volume (`/keys`); keep that volume, or the stored key becomes unreadable and you reconnect. Without that setting, ASP.NET Core uses its default per-user location. The key files are not encrypted at rest, so treat that volume like a database password. If the key files are lost, Clockify shows that the saved key cannot be read and offers the Connect form again; the server `Clockify__ApiKey` is deliberately not used as a silent fallback.
- Alternatively set `Clockify__ApiKey` and restart the app; the compose file maps `CLOCKIFY_API_KEY` to it. A key connected in the dialog takes priority over this setting, and Disconnect then falls back to it.
- `Clockify__WorkspaceId` is optional and defaults to your active workspace.
- `Clockify__TimeZone` is optional (an IANA id, for example `Europe/Berlin`) and defaults to the time zone in your Clockify profile. If neither is set, UTC is used. An id this server does not know stops the sync with an explanatory message.
- `Clockify__BaseUrl` defaults to `https://api.clockify.me/api/v1`. The app refuses to start unless it is an https address on `clockify.me`, and it never follows redirects, so a pasted key can only go to Clockify.
- Run `Scripts/002-clockify-sync.sql` once.
- Outside Docker, use the same keys in user secrets, environment variables or `appsettings.json`. Do not commit a key.

Behaviour:

- Nothing is pushed without confirmation. The Clockify dialog shows the preview first and pushes only after you confirm. At the API level, `POST /api/clockify/sync` with `apply: false` writes nothing and with `apply: true` changes Clockify.
- The push covers a date range (at most 92 days). Entries are matched to Clockify by a stored link, not by guessing:
  - no link yet: created in Clockify;
  - link exists and the entry changed: updated, or created again if it no longer exists in Clockify;
  - link exists and nothing changed: left alone;
  - entry deleted here while its link falls in the range: deleted in Clockify.
- Projects are matched to Clockify projects by name (case-insensitive, archived projects ignored) or mapped by hand in the dialog. Mappings used by an applied push are saved in `dbo.ClockifyProjectMap` and win over name matching from then on, as long as the Clockify project still exists.
- Notes are opt-in per push. The Clockify description is the task; with notes enabled the notes follow on a new line. Descriptions are cut at 3000 characters.
- Start and end are converted from the chosen time zone to UTC. Entries that end the next day are handled.
- Blocked entries are listed in the preview and are never pushed: no mapped Clockify project, no start or end time, or a local time that does not exist because of a daylight saving change.
- Entries that fail during a push are reported one by one with the reason; the rest of the push continues. Only one push runs at a time.
- A push with no key, missing tables, no workspace or an unknown time zone answers HTTP 409. Connecting before `Scripts/002-clockify-sync.sql` has been run also answers 409. Clockify being unreachable or rejecting the request answers HTTP 502. `GET /api/clockify` reports the same conditions as an `issue` field instead of an error status.
- Only start, end, description and project are sent. Tags, tasks and billable flags are not.

## CSV format

- `GET /api/entries/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`, with an optional `project` name. The range is at most 3660 days. The file is named `timesheet_<from>_<to>.csv`.
- Columns, in order: `Date`, `Start`, `End`, `Hours`, `Project`, `Task`, `Notes`.
- Dates are `yyyy-MM-dd`, times are `HH:mm`, hours have two decimals with a dot.
- UTF-8 with a byte order mark, `CRLF` line endings, a header row.
- Fields containing a comma, a quote, a line break, or leading or trailing spaces are quoted, with quotes doubled.
- Text starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe so spreadsheets do not evaluate it as a formula.

## Auth

- There is none. Anyone who can reach the port can read and change every entry and trigger a Clockify push with your key.
- Run it on a trusted network only, and do not expose the port beyond it.
- Keep the SQL credentials, the certificate password and the Clockify key out of version control. `.env` and `certs/` are ignored by git.
