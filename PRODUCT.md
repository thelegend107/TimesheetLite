# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed 2026-10-02: React + TypeScript client built on HeroUI v3 (Tailwind CSS v4), served from the existing ASP.NET Core 10 API over SQL Server (EF Core). The layout was delegated to the designer ("the best option given what I need to do").

## Users

One person logging their own working time. Marked inferred where it comes from the existing database rather than from a statement.

- Entries are mostly typed in one batch at the end of the workday (inferred: about half of 472 entries were created between 5 and 7 pm local time, a quarter on the following day, some late evening for overtime).
- Each entry usually starts where the previous one ended (inferred: 69% of entries), days usually start at 8:00 (inferred: 86% of days), weeks aim at about 40 hours (inferred: most weeks land between 38 and 44).
- A small share of entries are edited afterwards (inferred: 31%).

## Product Purpose

A personal timesheet: record what was worked on, when, and for how long; review the week; export it as CSV; and fill out the company's Clockify timesheet from it so the work is entered once. Confirmed by the user: CSV export is wanted, Clockify filling is "ideal".

## Positioning

The personal record is richer than the company's system: free-typed times, long bulleted notes, recurring tasks. Clockify is a destination, not the source of truth.

## Operating Context

- Self-hosted in Docker on a LAN server over HTTPS with a self-signed certificate; SQL Server runs in a container on the same network. No sign-in (trusted network).
- Desktop browser is the main client; the user's Mac has the Clockify desktop app installed.
- The previous Blazor/Radzen version still runs on the server and shares the same database.

## Capabilities and Constraints

- The existing `dbo.TimeEntry` table (472 rows, 2026-05-20 to 2026-09-29) is the system of record and keeps working unchanged; hours are derived from start and end, and an end at or before the start means the entry ends the next day.
- Times have arbitrary minutes (not a 15-minute grid) and are typed freely, for example `1725` or `5p`.
- Notes are up to 1000 characters and routinely dash-bulleted across several lines; the limit is nearly reached on real entries.
- Two projects exist today; task text recurs in many spelling variants.
- Clockify needs an API key and is optional; the core app works without it. The key is pasted once in the Clockify dialog (Clockify offers third-party apps no sign-in flow, whatever the account uses to sign in) or supplied through configuration. Clockify tables, including the stored connection, are created by `Scripts/002-clockify-sync.sql`.
- Undecided: whether notes should be sent to Clockify by default (currently opt-in per push).

## Brand Commitments

The app is named TimesheetLite and keeps the owner's name beside it, as the previous header did ("TimesheetLite - Moe Ayoub"). The old page heading "TimeTracker" is retired.

## Evidence on Hand

Real entries exist in the database. They are the user's private work log: never copy their text into fixtures, screenshots, or committed files. Mocks and demos use synthetic entries.

## Product Principles

1. Entry speed beats completeness: adding an entry stays on the keyboard, chains from the previous end time, and keeps the project.
2. The log is the user's own words: notes keep their line breaks and length and are never truncated or rewritten on save.
3. Hours are derived, never typed: start and end are the source, and overnight or odd-minute entries are made visible, not hidden.
4. Anything sent to Clockify is previewed first and shows exactly what will be created, changed, or removed.
5. Logging works on its own: exports and the Clockify push are additions, not requirements.
