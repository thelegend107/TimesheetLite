---
name: TimesheetLite
description: A personal logging desk on HeroUI v3's default theme, played restrained, with one blue accent and tabular hours.
colors:
  accent: "oklch(0.56 0.205 257)"
  accent-foreground: "oklch(0.9911 0 0)"
  background-light: "oklch(0.9702 0 0)"
  surface-light: "oklch(100% 0 0)"
  surface-secondary-light: "oklch(0.9524 0.0013 286.37)"
  foreground-light: "oklch(0.2103 0.0059 285.89)"
  muted-light: "oklch(0.51 0.0138 285.94)"
  default-light: "oklch(94% 0.001 286.375)"
  border-light: "oklch(90% 0.004 286.32)"
  background-dark: "oklch(12% 0.005 285.823)"
  surface-dark: "oklch(0.2103 0.0059 285.89)"
  surface-secondary-dark: "oklch(0.257 0.0037 286.14)"
  foreground-dark: "oklch(0.9911 0 0)"
  muted-dark: "oklch(70.5% 0.015 286.067)"
  default-dark: "oklch(27.4% 0.006 286.033)"
  border-dark: "oklch(28% 0.006 286.033)"
  danger-light: "oklch(0.55 0.22 26)"
  danger-dark: "oklch(0.6532 0.2328 25.74)"
  warning: "oklch(0.7819 0.1585 72.33)"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    fontFeature: "'tnum'"
  brand:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    fontFeature: "'tnum'"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: "'tnum'"
rounded:
  base: "8px"
  field: "12px"
  dot: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  page-gutter: "24px"
  content-max: "1360px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.field}"
  button-tertiary:
    backgroundColor: "{colors.default-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.field}"
  app-header:
    backgroundColor: "{colors.surface-light}"
    height: "56px"
  field-secondary:
    backgroundColor: "{colors.surface-secondary-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.field}"
  project-dot:
    size: "8px"
    rounded: "{rounded.dot}"
  today-dot:
    backgroundColor: "{colors.accent}"
    size: "6px"
    rounded: "{rounded.dot}"
---

# Design System: TimesheetLite

## Overview

**Creative North Star: "The Logging Desk"**

HeroUI v3's default theme, pinned on purpose and played restrained. Surfaces are neutral in light and dark, both designed and following the operating system. Nothing is drawn by hand: every control is a HeroUI component, and the system is mostly the discipline of which variant sits where. It is an Operate surface for one person typing a batch of entries at the end of the day, so density and keyboard flow beat atmosphere.

Color is scarce. The single blue accent marks the primary action, focus, the caret and selection tint, and the today dot. Everything else (week navigation, the Meter fill, the header actions) is neutral. Numbers are the texture: hours, times and counters use tabular numerals so columns and live totals never shimmer.

**Key Characteristics:**
- Neutral surfaces, one accent, both color schemes first-class.
- Pure HeroUI components; custom CSS is limited to three token overrides (accent, light muted, light danger), selection and caret tint, thin themed scrollbars, one row highlight and a reduced-motion reset.
- Form fields on surfaces use the secondary variant.
- Tabular numerals on every hour, time and counter.
- System font stack, no webfonts.

## Colors

A neutral grey ramp with one saturated blue; red and amber appear only as status.

### Primary
- **Desk Blue** (`colors.accent`): the Add and Save primary button, focus ring, today dot, caret and selection tint (28% mix). Shared by light and dark. Darkened from HeroUI's default so white button text reads at 4.8:1.

### Neutral
- **Paper Grey** (`colors.background-light`) / **Ink Night** (`colors.background-dark`): page background.
- **Surface White** (`colors.surface-light`) / **Surface Charcoal** (`colors.surface-dark`): header, Cards, Drawer, Modal.
- **Field Wash** (`colors.surface-secondary-light` / `colors.surface-secondary-dark`): the secondary-variant field fill sitting on a surface; this is what keeps inputs visible in dark mode.
- **Eclipse Ink** (`colors.foreground-light`) / **Snow** (`colors.foreground-dark`): text.
- **Quiet Grey** (`colors.muted-light` / `colors.muted-dark`): weekday labels, per-day hours, notes, counters, placeholders. The light value is darker than HeroUI's default so it holds 4.5:1 on the grey strips, headers and field fills it sits on.
- **Hairline** (`colors.border-light` / `colors.border-dark`): header bottom border and component outlines.
- **Default Fill** (`colors.default-light` / `colors.default-dark`): tertiary buttons and the Meter fill.

### Status
- **Danger** (`colors.danger-light` / `colors.danger-dark`): delete actions, field errors and a notes counter over 1000. The light value is darkened so white button text and error text reach 5:1 on white.
- **Warning** (`colors.warning`): soft chips for overlap and similar cautions in the form and Clockify preview.

### Categorical
Project dots are the only other hues. They come from the hue table in `client/src/lib/projects.ts` (175, 200, 285, 305, 325, 345), deliberately excluding red, amber, green and the accent blue. Value: `light-dark(oklch(0.58 0.15 h), oklch(0.76 0.13 h))`, chosen per project by a hash of its name.

### Named Rules
**The One Voice Rule.** Accent blue marks only the primary action, focus and the today dot. If a second element wants it, it should be neutral.
**The Not-a-Status Rule.** Project hues never overlap red, amber, green or the accent blue, so a dot can never read as state.
**The Contrast Floor.** Body and placeholder text stay at 4.5:1 or better on the surface they sit on, UI parts at 3:1, in both schemes. Where HeroUI's default token misses that (muted on grey, white on the accent or danger fill), the token is overridden in `index.css`, not worked around per component.
**The Neutral Progress Rule.** The week Meter uses `color="default"` and week navigation uses `ButtonGroup variant="tertiary"`; progress is information, not an action.

## Typography

**Display Font:** none.
**Body Font:** the system stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif), inherited from Tailwind's default.

**Character:** native and unremarkable on purpose. Hierarchy comes from size and weight steps, with tabular numerals doing the precision work.

### Hierarchy
- **Title** (600, 1.125rem, tabular): the week range heading.
- **Brand** (600, 1rem): the TimesheetLite name in the header, with the owner's name beside it in muted 0.875rem.
- **Body** (400, 1rem): table task text (weight 500 for the task), form content.
- **Label** (500, 0.875rem, tabular): day numbers, hour totals, preview summaries, section headings in dialogs.
- **Caption** (400, 0.75rem, tabular, muted): per-day hours, counters, helper text.

### Named Rules
**The Tabular Hours Rule.** Any hour, time, date range or count is set with `tabular-nums`.

## Layout

A single page: header (56px, full width), then a centered main column capped at 1360px with 16px/24px gutters and 16px vertical rhythm. Below the header sit the week bar (navigation, week range, Meter at 256px wide), the seven-day tab strip, then a grid that is one column below `lg`; at `lg` it is 5fr for the sticky Add form Card and 7fr for the day's entries, with the week-by-project summary full width underneath; at `xl` the form spans two rows with the entries and the summary stacked in the right column. The entries table drops the hours and project columns below `xl`: hours fold under the time and the project folds under the task, truncated, so long names never widen the table. Below `md` the week summary shows only the project, the selected day and the total. The seven day tabs fit a 375px phone without scrolling. Gaps are 4 to 16px steps in Tailwind's 4px unit; forms use 16px between fields and 12px within time pairs.

## Elevation & Depth

Tonal layering from HeroUI: page background, surface, secondary field fill. The header is separated by a 1px border, not a shadow. Cards, the Drawer and the Modal use HeroUI's own surface and overlay shadows unmodified; no custom shadows exist.

### Named Rules
**The Surface Variant Rule.** A field on a Card, Drawer or Modal uses `variant="secondary"` (ComboBox root, TextArea, DateField.Group, Select). The default field fill matches the surface and disappears in dark mode.

## Shapes

HeroUI's rounding: 8px base radius, fields at 12px, Cards and dialogs larger, controls pill-free. Dots are full circles (project dot 8px, today dot 6px). Borders are 1px hairlines; fields have no border of their own and are defined by fill.

## Components

### Buttons
- **Primary:** accent fill, one per context (Add, Save entry).
- **Tertiary:** header actions (Export CSV, Clockify), the theme menu, Cancel, Duplicate, week navigation.
- **Secondary:** dialog Close and retry actions.
- **Danger:** Delete only, in the form and the confirmation.
- **Ghost:** icon-only row actions in the table.
- Header and week bar use size `sm`.

### Day Tabs
Seven tabs keyed by weekday index (not date), so the indicator does not jump when the week changes. Each stacks weekday (muted unless today, then semibold), day number with the accent today dot, and hours in caption.

### Inputs / Fields
Secondary variant on every surface. Time fields are ComboBoxes accepting free typing such as `1725`. Notes grow with content (min 96px, max 288px) and show a counter that turns danger past the limit. Live hours appear beside the times in medium tabular text.

### Entries Table
HeroUI Table, secondary variant, with a footer showing count on the left and the day total in tabular medium on the right. Project names carry the categorical dot.

### Week Meter
`Meter` size `sm`, color `default`, output in tabular medium, optional "+N h over" in caption muted.

### Dialogs
Modal for Export and Clockify, Drawer for editing, AlertDialog for deletion. The edit form's action row stays pinned at the bottom of the Drawer. The delete confirmation closes on Escape (Keep entry) and cannot be dismissed while the delete runs. The Clockify dialog first offers a Connect form (link to Clockify's profile settings, paste the API key once), then shows a preview table before any push; status uses soft Chips.

### Toasts
HeroUI Toast, bottom end from `sm` up and top on phones so they never cover a dialog's footer buttons.

### Motion
Only HeroUI's built-in transitions plus one authored moment: a just-added row fades from a soft accent wash over 1200ms with a strong ease-out. Nothing animates on keyboard actions. A global `prefers-reduced-motion` reset removes the rest.

## Do's and Don'ts

### Do:
- **Do** build every control from HeroUI components and use their variant props before any custom class.
- **Do** use `variant="secondary"` for fields placed on Card, Drawer or Modal.
- **Do** reserve the accent for the primary action, focus and the today dot.
- **Do** set hours, times and counters with tabular numerals.
- **Do** draw new project dots from the existing hue table or one that also avoids red, amber, green and the accent blue.
- **Do** design every new surface in light and dark together.
- **Do** wrap or truncate long unbroken text (`[overflow-wrap:anywhere]`, `max-w-*` on labels) wherever user text sits in a table, dialog or chip.
- **Do** use synthetic names (Internal, Client Alpha, Reviewing work) in mocks and tests; never the owner's real entries.

### Don't:
- **Don't** color the Meter, week navigation or header actions with the accent.
- **Don't** use red, amber or green for anything categorical.
- **Don't** add custom shadows, gradients or webfonts; the theme is HeroUI's default, pinned.
- **Don't** hand-draw controls that HeroUI provides.
- **Don't** key the day tabs by date.
