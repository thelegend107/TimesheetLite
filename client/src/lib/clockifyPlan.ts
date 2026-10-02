import type { CalendarDate } from "@internationalized/date";
import type { ClockifyMapping, ClockifyProject, ClockifyRule, ClockifySyncAction, ClockifySyncItem, ClockifySyncOutcome, ClockifySyncRequest, ClockifySyncResult, ClockifySyncSummary } from "../api/types";
import { formatMonthDay, formatMonthDayYear, formatWeekdayShort, formatWeekRange, isoOf, tryParseIso, weekEndOf, weekStartOf } from "./dates";
import { pluralize } from "./format";
import { formatTime, fromWireTime } from "./time";

export type ClockifyScope = "day" | "week";

export type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export type ChipSpec = { label: string; color: ChipColor };

export type PushToast = { kind: "success" | "danger"; title: string; description?: string };

export type DateRange = { from: string; to: string };

export type RuleDraft = { key: string; project: string; phrase: string; clockifyProjectId: string };

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

const NO_CLIENT_KEY = "__no-client__";

export function clientNames(projects: readonly ClockifyProject[]): string[] {
  return [...new Set(projects.map((x) => x.clientName))].sort((a, b) => Number(a === "") - Number(b === "") || a.localeCompare(b));
}

export function clientKey(client: string): string {
  return client === "" ? NO_CLIENT_KEY : client;
}

export function clientFromKey(key: string): string {
  return key === NO_CLIENT_KEY ? "" : key;
}

export function clientLabel(client: string): string {
  return client === "" ? "No client" : client;
}

export function projectsOfClient(projects: readonly ClockifyProject[], client: string | null): ClockifyProject[] {
  return client === null ? [...projects] : projects.filter((x) => x.clientName === client);
}

export function suggestClient(clients: readonly string[], localProject: string): string | null {
  const needle = localProject.trim().toLowerCase();

  if (needle === "") {
    return null;
  }

  const exact = clients.find((x) => x !== "" && x.toLowerCase() === needle);

  if (exact !== undefined) {
    return exact;
  }

  const starting = clients.filter((x) => x !== "" && x.toLowerCase().startsWith(needle));

  return starting.length === 1 ? (starting[0] ?? null) : null;
}

export function effectiveClient(mapping: ClockifyMapping, choices: Readonly<Record<string, string>>, clientChoices: Readonly<Record<string, string>>, projects: readonly ClockifyProject[], clients: readonly string[]): string | null {
  const chosen = clientChoices[mapping.project];

  if (chosen !== undefined) {
    return chosen;
  }

  const projectId = mappingValue(mapping, choices);

  return projects.find((x) => x.id === projectId)?.clientName ?? suggestClient(clients, mapping.project);
}

export function mappingValue(mapping: ClockifyMapping, choices: Readonly<Record<string, string>>): string | null {
  const chosen = choices[mapping.project];

  if (chosen === undefined) {
    return mapping.clockifyProjectId;
  }

  return chosen === "" ? null : chosen;
}

export function effectiveMappings(mappings: readonly ClockifyMapping[], choices: Readonly<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const mapping of mappings) {
    const projectId = mappingValue(mapping, choices);

    if (projectId !== null) {
      result[mapping.project] = projectId;
    } else if (choices[mapping.project] === "") {
      result[mapping.project] = "";
    }
  }

  return result;
}

export function mappingNote(mapping: ClockifyMapping, choices: Readonly<Record<string, string>>): string {
  const chosen = choices[mapping.project];

  if (chosen === "") {
    return "Choose a Clockify project. Until then its entries are blocked.";
  }

  if (chosen !== undefined && chosen !== mapping.clockifyProjectId) {
    return "Your choice, saved when you push";
  }

  if (mapping.clockifyProjectId === null) {
    return "Choose a Clockify project. Until then its entries are blocked.";
  }

  return mapping.source === "Name" ? "Matched by name" : "Saved from an earlier push";
}

export function buildPlanRequest(scope: ClockifyScope, selected: CalendarDate, includeNotes: boolean, mappings: Record<string, string>, rules: ClockifyRule[]): ClockifySyncRequest {
  const { from, to } = scopeRange(scope, selected);

  return { from, to, includeNotes, apply: false, mappings, rules };
}

export function draftsFromRules(rules: readonly ClockifyRule[]): RuleDraft[] {
  return rules.map((rule, index) => ({ key: `saved-${index}`, ...rule }));
}

export function ruleRequests(drafts: readonly RuleDraft[]): ClockifyRule[] {
  return drafts
    .map((draft) => ({ project: draft.project, phrase: draft.phrase.trim(), clockifyProjectId: draft.clockifyProjectId }))
    .filter((rule) => rule.phrase !== "" && rule.clockifyProjectId !== "");
}

export function draftsOf(drafts: readonly RuleDraft[], project: string): RuleDraft[] {
  return drafts.filter((draft) => draft.project === project);
}

export function dropRulesOutsideClient(drafts: readonly RuleDraft[], project: string, client: string, projects: readonly ClockifyProject[]): RuleDraft[] {
  return drafts.map((draft) => (draft.project === project && draft.clockifyProjectId !== "" && projects.find((x) => x.id === draft.clockifyProjectId)?.clientName !== client ? { ...draft, clockifyProjectId: "" } : draft));
}

export function destinationLabel(item: ClockifySyncItem): string {
  return item.destination ?? NO_TIME;
}

export function pushCount(summary: ClockifySyncSummary): number {
  return summary.create + summary.update + summary.delete;
}

export function applyCount(summary: ClockifySyncSummary): number {
  return pushCount(summary) + summary.link;
}

export function pushLabel(count: number): string {
  return count > 0 ? `Push ${pluralize(count, "change")}` : "Push changes";
}

export function applyLabel(summary: ClockifySyncSummary | undefined): string {
  if (summary === undefined) {
    return pushLabel(0);
  }

  return pushCount(summary) === 0 && summary.link > 0 ? `Link ${pluralize(summary.link, "entry", "entries")}` : pushLabel(pushCount(summary));
}

export function planSummary(summary: ClockifySyncSummary): string {
  const parts = [
    summary.create > 0 ? `${summary.create} to create` : "",
    summary.update > 0 ? `${summary.update} to update` : "",
    summary.delete > 0 ? `${summary.delete} to delete` : "",
    summary.link > 0 ? `${summary.link} already in Clockify` : "",
    summary.unchanged > 0 ? `${summary.unchanged} unchanged` : "",
    summary.blocked > 0 ? `${summary.blocked} blocked` : "",
  ].filter((part) => part !== "");

  if (applyCount(summary) === 0) {
    return ["Nothing to push", ...parts].join(", ");
  }

  return parts.join(", ");
}

export function resultSummary(summary: ClockifySyncSummary): string {
  const pushed = pushCount(summary);

  const parts = [
    pushed > 0 ? `${pushed} pushed` : "",
    summary.link > 0 ? `${summary.link} linked` : "",
    summary.failed > 0 ? `${summary.failed} failed` : "",
    summary.unchanged > 0 ? `${summary.unchanged} unchanged` : "",
    summary.blocked > 0 ? `${summary.blocked} blocked` : "",
  ].filter((part) => part !== "");

  return parts.length === 0 ? "Nothing was pushed" : parts.join(", ");
}

export function pushToast(result: ClockifySyncResult): PushToast {
  const pushed = pushCount(result.summary);
  const failed = result.summary.failed;

  const linked = result.summary.link;

  if (failed === 0) {
    return { kind: "success", title: pushToastTitle(pushed, linked) };
  }

  const description = result.items.find((item) => item.outcome === "Failed")?.message ?? undefined;

  return { kind: "danger", title: `${pushed} pushed, ${failed} failed`, description };
}

function pushToastTitle(pushed: number, linked: number): string {
  if (pushed === 0 && linked === 0) {
    return "Nothing to push to Clockify";
  }

  if (linked === 0) {
    return `Pushed ${pluralize(pushed, "entry", "entries")} to Clockify`;
  }

  return pushed === 0 ? `Linked ${pluralize(linked, "entry", "entries")} already in Clockify` : `Pushed ${pluralize(pushed, "entry", "entries")} and linked ${linked} already in Clockify`;
}

export function actionChip(action: ClockifySyncAction): ChipSpec {
  switch (action) {
    case "Create":
      return { label: "Create", color: "accent" };
    case "Update":
      return { label: "Update", color: "default" };
    case "Delete":
      return { label: "Delete", color: "danger" };
    case "Link":
      return { label: "In Clockify", color: "success" };
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
      return item.action === "Create" ? "Created in Clockify" : item.action === "Update" ? "Updated in Clockify" : item.action === "Link" ? "Linked to the entry already in Clockify" : "Removed from Clockify";
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
