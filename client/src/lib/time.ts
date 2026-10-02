export const MINUTES_PER_DAY = 1440;
export const DEFAULT_START_MINUTES = 8 * 60;

const QUARTER_HOUR = 15;

type ParsedParts = { hour: number; minute: number; meridiem: "am" | "pm" | null; ambiguous: boolean };

export type EndOption = { minutes: number; hours: number };

const wrap = (minutes: number) => ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

export function formatTime(minutes: number): string {
  const total = wrap(minutes);
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${hour24 < 12 ? "AM" : "PM"}`;
}

export function toWireTime(minutes: number): string {
  const total = wrap(minutes);

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function fromWireTime(value: string | null | undefined): number | null {
  const match = value ? /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value) : null;

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function hoursBetween(start: number, end: number): number {
  return Math.round((wrap(end - start) / 60) * 100) / 100;
}

export function endsNextDay(start: number, end: number): boolean {
  return end < start;
}

export function formatRange(start: number, end: number): string {
  const startText = formatTime(start);
  const endText = formatTime(end);
  const nextDay = endsNextDay(start, end);
  const shared = !nextDay && startText.slice(-2) === endText.slice(-2);

  return `${shared ? startText.slice(0, -3) : startText} – ${endText}${nextDay ? " +1" : ""}`;
}

function parseParts(input: string): ParsedParts | null {
  const raw = input.trim().toLowerCase().replace(/\./g, "");

  if (raw === "") {
    return null;
  }

  if (raw === "noon") {
    return { hour: 12, minute: 0, meridiem: "pm", ambiguous: false };
  }

  if (raw === "midnight") {
    return { hour: 12, minute: 0, meridiem: "am", ambiguous: false };
  }

  const suffix = /^(.*?)\s*(a|p)m?$/.exec(raw);
  const meridiem = suffix ? (suffix[2] === "a" ? "am" : "pm") : null;
  const body = (suffix ? (suffix[1] ?? "") : raw).trim();

  const clock = /^(\d{1,2})[:\s](\d{2})(?::\d{2})?$/.exec(body);

  if (clock) {
    const hourText = clock[1] ?? "";
    const hour = Number(hourText);

    return finish({ hour, minute: Number(clock[2]), meridiem, ambiguous: hour >= 1 && hour <= 12 && !(hourText.length === 2 && hourText.startsWith("0")) });
  }

  if (!/^\d{1,4}$/.test(body)) {
    return null;
  }

  if (body.length <= 2) {
    const value = Number(body);

    if (meridiem && body.length === 2 && value >= 13 && value <= 59) {
      return finish({ hour: Math.floor(value / 10), minute: value, meridiem, ambiguous: false });
    }

    return finish({ hour: value, minute: 0, meridiem, ambiguous: value >= 1 && value <= 12 && !(body.length === 2 && body.startsWith("0")) });
  }

  const hourText = body.length === 3 ? body.slice(0, 1) : body.slice(0, 2);
  const hour = Number(hourText);

  return finish({ hour, minute: Number(body.slice(-2)), meridiem, ambiguous: hour >= 1 && hour <= 12 && !hourText.startsWith("0") });
}

function finish(parts: ParsedParts): ParsedParts | null {
  if (parts.minute > 59) {
    return null;
  }

  if (parts.meridiem) {
    return parts.hour >= 1 && parts.hour <= 12 ? { ...parts, ambiguous: false } : null;
  }

  return parts.hour <= 23 ? parts : null;
}

function forwardDistance(from: number, to: number): number {
  return wrap(to - from) || MINUTES_PER_DAY;
}

export function parseTime(input: string, after?: number | null): number | null {
  const parts = parseParts(input);

  if (!parts) {
    return null;
  }

  if (parts.meridiem) {
    const base = parts.hour % 12;

    return (parts.meridiem === "pm" ? base + 12 : base) * 60 + parts.minute;
  }

  const asTyped = parts.hour * 60 + parts.minute;

  if (!parts.ambiguous || after === null || after === undefined) {
    return asTyped;
  }

  const morning = (parts.hour % 12) * 60 + parts.minute;
  const afternoon = morning + 12 * 60;

  return forwardDistance(after, morning) <= forwardDistance(after, afternoon) ? morning : afternoon;
}

export function normalizeTimeText(input: string, after?: number | null): string {
  const minutes = parseTime(input, after);

  return minutes === null ? input.trim() : formatTime(minutes);
}

export const ALL_TIME_OPTIONS: number[] = Array.from({ length: MINUTES_PER_DAY / QUARTER_HOUR }, (_, index) => index * QUARTER_HOUR);

export function endTimeOptions(start: number | null): EndOption[] {
  if (start === null) {
    return ALL_TIME_OPTIONS.map((minutes) => ({ minutes, hours: 0 }));
  }

  const first = (Math.floor(start / QUARTER_HOUR) + 1) * QUARTER_HOUR;

  return Array.from({ length: 48 }, (_, index) => {
    const minutes = wrap(first + index * QUARTER_HOUR);

    return { minutes, hours: hoursBetween(start, minutes) };
  });
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/m$/, "");

export function timeMatchesQuery(optionText: string, query: string): boolean {
  const needle = squash(query);

  return needle === "" || squash(optionText).startsWith(needle);
}
