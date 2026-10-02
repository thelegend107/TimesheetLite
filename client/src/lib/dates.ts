import { type CalendarDate, getLocalTimeZone, parseDate, startOfWeek, today } from "@internationalized/date";

const LOCALE = "en-US";

type Style = Intl.DateTimeFormatOptions;

const format = (date: CalendarDate, style: Style) => new Intl.DateTimeFormat(LOCALE, { ...style, timeZone: "UTC" }).format(date.toDate("UTC"));

export function todayDate(): CalendarDate {
  return today(getLocalTimeZone());
}

export function parseIso(value: string): CalendarDate {
  return parseDate(value);
}

export function tryParseIso(value: string | null | undefined): CalendarDate | null {
  if (!value) {
    return null;
  }

  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export function isoOf(date: CalendarDate): string {
  return date.toString();
}

export function weekStartOf(date: CalendarDate): CalendarDate {
  return startOfWeek(date, LOCALE, "mon");
}

export function weekEndOf(date: CalendarDate): CalendarDate {
  return weekStartOf(date).add({ days: 6 });
}

export function weekDays(start: CalendarDate): CalendarDate[] {
  return Array.from({ length: 7 }, (_, index) => start.add({ days: index }));
}

export function formatDayLong(date: CalendarDate): string {
  return format(date, { weekday: "long", month: "long", day: "numeric" });
}

export function formatWeekdayShort(date: CalendarDate): string {
  return format(date, { weekday: "short" });
}

export function formatMonthDay(date: CalendarDate): string {
  return format(date, { month: "short", day: "numeric" });
}

export function formatMonthDayYear(date: CalendarDate): string {
  return format(date, { month: "short", day: "numeric", year: "numeric" });
}

export function formatWeekRange(start: CalendarDate): string {
  const end = start.add({ days: 6 });
  const startText = start.year === end.year ? formatMonthDay(start) : formatMonthDayYear(start);

  return `${startText} – ${formatMonthDayYear(end)}`;
}
