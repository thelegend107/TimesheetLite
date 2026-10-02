import { Calendar } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";

type CalendarPanelProps = { "aria-label": string; value?: CalendarDate | null; onChange?: (value: CalendarDate) => void };

export function CalendarPanel({ "aria-label": label, value, onChange }: CalendarPanelProps) {
  const controlled = onChange ? { value: value ?? null, onChange } : {};

  return (
    <Calendar aria-label={label} firstDayOfWeek="mon" {...controlled}>
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  );
}
