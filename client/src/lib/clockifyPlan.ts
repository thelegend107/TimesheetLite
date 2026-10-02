import type { CalendarDate } from "@internationalized/date";
import type { ClockifyMapping, ClockifyProject, ClockifySyncAction, ClockifySyncItem, ClockifySyncOutcome, ClockifySyncRequest, ClockifySyncResult, ClockifySyncSummary } from "../api/types";
import { formatMonthDay, formatMonthDayYear, formatWeekdayShort, formatWeekRange, isoOf, tryParseIso, weekEndOf, weekStartOf } from "./dates";
import { pluralize } from "./format";
import { formatTime, fromWireTime } from "./time";

export type ClockifyScope = "day" | "week";

export type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export type ChipSpec = { label: string; color: ChipColor };

export type PushToast = { kind: "success" | "danger"; title: string; description?: string };

export type DateRange = { from: string; to: string };

export const INCLUDE_NOTES_KEY = "timesheetlite.clockify.includeNotes";

const NO_TIME = "–";
const LAST_MINUTE = 1440;

export function readIncludeNotes(): boolean {
  try {
    return localStorage.getItem(INCLUDE_NOTES_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeIncludeNotes(value: boolean): void {
  try {
    localStorage.setItem(INCLUDE_NOTES_KEY, String(value));
  } catch {
    return;
  }
}

export function scopeRange(scope: ClockifyScope, selected: CalendarDate): DateRange {
  return scope === "day" ? { from: isoOf(selected), to: isoOf(selected) } : { from: isoOf(weekStartOf(selected)), to: isoOf(weekEndOf(selected)) };
}

export function rangeLabel(scope: ClockifyScope, selected: CalendarDate): string {
  return scope === "day" ? `${formatWeekdayShort(selected)}, ${formatMonthDayYear(selected)}` : formatWeekRange(weekStartOf(selected));
}

export function projectOptionLabel(project: ClockifyProject): string {
  return project.clientName === "" ? project.name : `${project.name} · ${project.clientName}`;
}

export function orderProjects(projects: readonly ClockifyProject[]): ClockifyProject[] {
  return [...projects].sort((a, b) => a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name));
}

export function projectMatches(optionText: string, query: string): boolean {
  const haystack = optionText.toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function mappingValue(mapping: ClockifyMapping, choices: Readonly<Record<string, string>>): string | null {
  return choices[mapping.project] ?? mapping.clockifyProjectId;
}

export function effectiveMappings(mappings: readonly ClockifyMapping[], choices: Readonly<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const mapping of mappings) {
    const projectId = mappingValue(mapping, choices);

    if (projectId !== null) {
      result[mapping.project] = projectId;
    }
  }

  return result;
}

export function mappingNote(mapping: ClockifyMapping, choices: Readonly<Record<string, string>>): string {
  const chosen = choices[mapping.project];

  if (chosen !== undefined && chosen !== mapping.clockifyProjectId) {
    return "Your choice, saved when you push";
  }

  if (mapping.clockifyProjectId === null) {
    return "Choose a Clockify project. Until then its entries are blocked.";
  }

  return mapping.source === "Name" ? "Matched by name" : "Saved from an earlier push";
}

export function buildPlanRequest(scope: ClockifyScope, selected: CalendarDate, includeNotes: boolean, mappings: Record<string, string>): ClockifySyncRequest {
  const { from, to } = scopeRange(scope, selected);

  return { from, to, includeNotes, apply: false, mappings };
}

export function pushCount(summary: ClockifySyncSummary): number {
  return summary.create + summary.update + summary.delete;
}

export function pushLabel(count: number): string {
  return count > 0 ? `Push ${pluralize(count, "change")}` : "Push changes";
}

export function planSummary(summary: ClockifySyncSummary): string {
  const parts = [
    summary.create > 0 ? `${summary.create} to create` : "",
    summary.update > 0 ? `${summary.update} to update` : "",
    summary.delete > 0 ? `${summary.delete} to delete` : "",
    summary.unchanged > 0 ? `${summary.unchanged} unchanged` : "",
    summary.blocked > 0 ? `${summary.blocked} blocked` : "",
  ].filter((part) => part !== "");

  if (pushCount(summary) === 0) {
    return ["Nothing to push", ...parts].join(", ");
  }

  return parts.join(", ");
}

export function resultSummary(summary: ClockifySyncSummary): string {
  const pushed = pushCount(summary);

  const parts = [
    pushed > 0 ? `${pushed} pushed` : "",
    summary.failed > 0 ? `${summary.failed} failed` : "",
    summary.unchanged > 0 ? `${summary.unchanged} unchanged` : "",
    summary.blocked > 0 ? `${summary.blocked} blocked` : "",
  ].filter((part) => part !== "");

  return parts.length === 0 ? "Nothing was pushed" : parts.join(", ");
}

export function pushToast(result: ClockifySyncResult): PushToast {
  const pushed = pushCount(result.summary);
  const failed = result.summary.failed;

  if (failed === 0) {
    return { kind: "success", title: pushed === 0 ? "Nothing to push to Clockify" : `Pushed ${pluralize(pushed, "entry", "entries")} to Clockify` };
  }

  const description = result.items.find((item) => item.outcome === "Failed")?.message ?? undefined;

  return { kind: "danger", title: `${pushed} pushed, ${failed} failed`, description };
}

export function actionChip(action: ClockifySyncAction): ChipSpec {
  switch (action) {
    case "Create":
      return { label: "Create", color: "accent" };
    case "Update":
      return { label: "Update", color: "default" };
    case "Delete":
      return { label: "Delete", color: "danger" };
    case "Unchanged":
      return { label: "Unchanged", color: "default" };
    case "Blocked":
      return { label: "Blocked", color: "warning" };
  }
}

export function outcomeChip(outcome: ClockifySyncOutcome): ChipSpec {
  switch (outcome) {
    case "Done":
      return { label: "Done", color: "success" };
    case "Failed":
      return { label: "Failed", color: "danger" };
    case "Skipped":
      return { label: "Skipped", color: "default" };
    case "Planned":
      return { label: "Planned", color: "default" };
  }
}

export function planNote(item: ClockifySyncItem): string {
  if (item.action === "Delete") {
    return item.message ?? "Deleted here, will be removed from Clockify";
  }

  return item.message ?? "";
}

export function resultNote(item: ClockifySyncItem): string {
  switch (item.outcome) {
    case "Failed":
      return item.message ?? "Clockify did not accept this entry";
    case "Done":
      return item.action === "Create" ? "Created in Clockify" : item.action === "Update" ? "Updated in Clockify" : "Removed from Clockify";
    case "Skipped":
      return item.action === "Unchanged" ? "Unchanged since the last push" : (item.message ?? "");
    case "Planned":
      return planNote(item);
  }
}

export function entryDetail(item: ClockifySyncItem): string | null {
  const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
  const description = collapse(item.description);
  const label = collapse(item.label);

  if (description === "" || description === label || label.endsWith(` · ${description}`)) {
    return null;
  }

  return description;
}

export function itemDateLabel(date: string): string {
  const day = tryParseIso(date);

  return day ? `${formatWeekdayShort(day)}, ${formatMonthDay(day)}` : date;
}

export function timeRangeLabel(start: string | null, end: string | null): string {
  const from = fromWireTime(start);
  const to = fromWireTime(end);

  if (from === null || to === null) {
    return NO_TIME;
  }

  return `${formatTime(from)} – ${formatTime(to)}`;
}

export function endsNextDay(start: string | null, end: string | null): boolean {
  const from = fromWireTime(start);
  const to = fromWireTime(end);

  return from !== null && to !== null && to <= from;
}

export function orderItems(items: readonly ClockifySyncItem[]): ClockifySyncItem[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date) || (fromWireTime(a.start) ?? LAST_MINUTE) - (fromWireTime(b.start) ?? LAST_MINUTE));
}
