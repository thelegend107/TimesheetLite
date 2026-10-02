import type { Entry } from "../api/types";
import { sumHours } from "./format";
import { DEFAULT_START_MINUTES, fromWireTime } from "./time";

export type SummaryRow = { project: string; byDay: Map<string, number>; total: number };

export type WeekSummary = { rows: SummaryRow[]; dayTotals: Map<string, number>; total: number };

export const startMinutesOf = (entry: Entry) => fromWireTime(entry.start);

export const endMinutesOf = (entry: Entry) => fromWireTime(entry.end);

function compareEntries(a: Entry, b: Entry): number {
  return a.date.localeCompare(b.date) || (startMinutesOf(a) ?? -1) - (startMinutesOf(b) ?? -1) || (endMinutesOf(a) ?? -1) - (endMinutesOf(b) ?? -1) || a.id - b.id;
}

export function entriesOn(entries: readonly Entry[], date: string): Entry[] {
  return entries.filter((entry) => entry.date === date).sort(compareEntries);
}

export function suggestStart(dayEntries: readonly Entry[]): number {
  let latest: number | null = null;

  for (const entry of dayEntries) {
    const start = startMinutesOf(entry);
    const end = endMinutesOf(entry);

    if (start !== null && end !== null && end > start && (latest === null || end > latest)) {
      latest = end;
    }
  }

  return latest ?? DEFAULT_START_MINUTES;
}

export function hoursByDay(entries: readonly Entry[]): Map<string, number> {
  const grouped = new Map<string, number[]>();

  for (const entry of entries) {
    grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry.hours]);
  }

  return new Map([...grouped].map(([date, hours]) => [date, sumHours(hours)]));
}

export function summarizeWeek(entries: readonly Entry[], days: readonly string[]): WeekSummary {
  const inWeek = entries.filter((entry) => days.includes(entry.date));
  const projects = [...new Set(inWeek.map((entry) => entry.project))].sort((a, b) => a.localeCompare(b));

  const rows = projects.map((project) => {
    const own = inWeek.filter((entry) => entry.project === project);
    const byDay = hoursByDay(own);

    return { project, byDay, total: sumHours(own.map((entry) => entry.hours)) };
  });

  return { rows, dayTotals: hoursByDay(inWeek), total: sumHours(inWeek.map((entry) => entry.hours)) };
}

const dayNumber = (iso: string) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);

function absoluteSpan(date: string, start: number, end: number) {
  const from = dayNumber(date) * 1440 + start;

  return { from, to: from + (end > start ? end - start : end + 1440 - start) };
}

export function findOverlap(entries: readonly Entry[], date: string, start: number, end: number, ignoreId?: number): Entry | null {
  const wanted = absoluteSpan(date, start, end);

  for (const entry of entries) {
    const entryStart = startMinutesOf(entry);
    const entryEnd = endMinutesOf(entry);

    if (entry.id === ignoreId || entryStart === null || entryEnd === null) {
      continue;
    }

    const existing = absoluteSpan(entry.date, entryStart, entryEnd);

    if (wanted.from < existing.to && existing.from < wanted.to) {
      return entry;
    }
  }

  return null;
}
