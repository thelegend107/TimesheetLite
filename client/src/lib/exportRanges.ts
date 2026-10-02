import { type CalendarDate, type DateValue, endOfMonth, startOfMonth, toCalendarDate } from "@internationalized/date";
import type { Entry } from "../api/types";
import { formatMonthDay, formatMonthDayYear, isoOf, parseIso, weekEndOf, weekStartOf } from "./dates";
import { hoursShort, pluralize, sumHours } from "./format";

export const ALL_TIME_START = "2000-01-01";

export const MAX_RANGE_DAYS = 36600;

export const EXPORT_PRESETS = [
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "all-time", label: "All time" },
  { id: "custom", label: "Custom range" },
] as const;

export type ExportPresetId = (typeof EXPORT_PRESETS)[number]["id"];

export type FixedPresetId = Exclude<ExportPresetId, "custom">;

export type ExportRange = { from: string; to: string };

export type DateRangeValue = { start: DateValue; end: DateValue };

export type CustomRangeProblem = "incomplete" | "reversed" | "too-long";

export type ExportSummary = { count: number; hours: number };

export const DEFAULT_PRESET: ExportPresetId = "this-week";

export function isExportPreset(value: unknown): value is ExportPresetId {
  return EXPORT_PRESETS.some((preset) => preset.id === value);
}

function asRange(start: CalendarDate, end: CalendarDate): ExportRange {
  return { from: isoOf(start), to: isoOf(end) };
}

export function presetRange(preset: FixedPresetId, reference: CalendarDate, today: CalendarDate): ExportRange {
  switch (preset) {
    case "this-week":
      return asRange(weekStartOf(reference), weekEndOf(reference));
    case "last-week": {
      const previous = reference.subtract({ weeks: 1 });

      return asRange(weekStartOf(previous), weekEndOf(previous));
    }
    case "this-month":
      return asRange(startOfMonth(reference), endOfMonth(reference));
    case "last-month": {
      const previous = reference.subtract({ months: 1 });

      return asRange(startOfMonth(previous), endOfMonth(previous));
    }
    case "all-time": {
      const earliest = parseIso(ALL_TIME_START);
      const limit = today.subtract({ days: MAX_RANGE_DAYS });

      return asRange(earliest.compare(limit) > 0 ? earliest : limit, today);
    }
  }
}

export function customRangeProblem(custom: DateRangeValue | null): CustomRangeProblem | null {
  if (custom === null) {
    return "incomplete";
  }

  const span = toCalendarDate(custom.end).compare(toCalendarDate(custom.start));

  if (span < 0) {
    return "reversed";
  }

  return span > MAX_RANGE_DAYS ? "too-long" : null;
}

export function resolveExportRange(preset: ExportPresetId, reference: CalendarDate, today: CalendarDate, custom: DateRangeValue | null): ExportRange | null {
  if (preset !== "custom") {
    return presetRange(preset, reference, today);
  }

  if (custom === null || customRangeProblem(custom) !== null) {
    return null;
  }

  return asRange(toCalendarDate(custom.start), toCalendarDate(custom.end));
}

export function formatExportRange(range: ExportRange): string {
  const start = parseIso(range.from);
  const end = parseIso(range.to);

  if (start.compare(end) === 0) {
    return formatMonthDayYear(start);
  }

  const startText = start.year === end.year ? formatMonthDay(start) : formatMonthDayYear(start);

  return `${startText} – ${formatMonthDayYear(end)}`;
}

export function summarizeExport(entries: readonly Entry[], project: string | null): ExportSummary {
  const wanted = project?.trim().toLowerCase() ?? null;
  const matching = wanted === null ? entries : entries.filter((entry) => entry.project.trim().toLowerCase() === wanted);

  return { count: matching.length, hours: sumHours(matching.map((entry) => entry.hours)) };
}

export function describeSummary(summary: ExportSummary): string {
  return `${pluralize(summary.count, "entry", "entries")}, ${hoursShort(summary.hours)} ${summary.hours === 1 ? "hour" : "hours"}`;
}
