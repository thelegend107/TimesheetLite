---
version: 1
slug: "client-src-app-tsx"
primary_target: "client/src/App.tsx"
related_targets: []
---

# Surface brief: the day workspace

Mode: Operate. Scope: the app's single page and its dialogs (edit drawer, delete confirmation, CSV export, Clockify push).

Audience and job: one person logging and reviewing their own working time. Frequent, keyboard-heavy, mostly one batch of four or five entries at the end of the workday, sometimes late evening or the next morning.

Constraints: HeroUI v3 components only, no hand-drawn controls; the existing ASP.NET API and `dbo.TimeEntry` data stay as they are; mocks and demos use synthetic entries, never the user's real text.

Memorable moment: the next start time is already filled in, Enter adds the entry, and the form refills for the one after it.

Unresolved: whether notes should go to Clockify by default (opt-in for now).

## Direction contract

THESIS: A logging desk, not a dashboard. The day's entries and the add form sit side by side so the end-of-day batch is one continuous keyboard motion. It refuses the single-column stack of hero, navigation, form and table.

OWN-WORLD: HeroUI v3's default theme, played restrained. Neutral surfaces, with the one blue accent reserved for the primary action, the selected day and focus. Two categorical project dots, never status colors. Light and dark are both designed and follow the operating system, because the app is opened at an evening desk as often as in daylight. Tabular numerals for every hour. The system font stack. Every control is a HeroUI component.

STORY: The user finishes work and opens the app. Today is selected and the next start time is already in the form. They add four or five entries without leaving the keyboard, glance at the week against 40 hours, then export a CSV or push the week to Clockify after a preview that shows exactly what will change.

FIRST VIEWPORT: At 1440 by 900. A top bar with the name, week navigation, theme switch, Export and Clockify actions. Under it the seven-day tab strip with per-day hours and today marked, and the week total against the 40-hour target. Then two columns: on the left the Add time form (project, task, from, to with live hours, notes with a counter, primary Add at its foot); on the right the selected day's entries table with a total footer, and the week-by-project summary beneath it.

FORM: Day workspace, structure 1 of 3 weighed against the user's real logging data (Day workspace, Quick-entry table, Faithful port). No concept-seed roll ran, because the world is pinned to HeroUI and the user delegated the layout choice. Seed key: none.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
