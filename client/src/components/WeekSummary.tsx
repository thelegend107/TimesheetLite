import { Calendar } from "@gravity-ui/icons";
import { EmptyState, Skeleton, Table } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { formatWeekdayShort, isoOf } from "../lib/dates";
import type { WeekSummary as Summary } from "../lib/entries";
import { hoursFixed } from "../lib/format";
import { ProjectLabel } from "./ProjectLabel";

type WeekSummaryProps = { days: CalendarDate[]; selected: string; summary: Summary | null };

const cell = (hours: number | undefined) => (hours ? hoursFixed(hours) : "–");

export function WeekSummary({ days, selected, summary }: WeekSummaryProps) {
  if (summary === null) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer className="max-md:overflow-x-clip">
        <Table.Content aria-label="Hours by project and day this week">
          <Table.Header>
            <Table.Column isRowHeader className="min-w-28" id="project">
              Project
            </Table.Column>
            {days.map((day) => (
              <Table.Column key={isoOf(day)} className={isoOf(day) === selected ? "w-16 text-end font-semibold text-foreground" : "hidden w-16 text-end md:table-cell"} id={isoOf(day)}>
                {formatWeekdayShort(day)}
              </Table.Column>
            ))}
            <Table.Column className="w-20 text-end" id="total">
              Total
            </Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => (
            <EmptyState className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <Calendar aria-hidden className="size-6 text-muted" />
              <p className="text-sm text-muted">Nothing logged this week yet.</p>
            </EmptyState>
          )}>
            {summary.rows.map((row) => (
              <Table.Row key={row.project} id={row.project}>
                <Table.Cell>
                  <ProjectLabel className="max-w-36" project={row.project} />
                </Table.Cell>
                {days.map((day) => (
                  <Table.Cell key={isoOf(day)} className={isoOf(day) === selected ? "text-end tabular-nums text-muted" : "hidden text-end tabular-nums text-muted md:table-cell"}>
                    {cell(row.byDay.get(isoOf(day)))}
                  </Table.Cell>
                ))}
                <Table.Cell className="text-end font-medium tabular-nums">{hoursFixed(row.total)}</Table.Cell>
              </Table.Row>
            ))}
            {summary.rows.length > 0 ? (
              <Table.Row id="total-row">
                <Table.Cell className="font-medium">All projects</Table.Cell>
                {days.map((day) => (
                  <Table.Cell key={isoOf(day)} className={isoOf(day) === selected ? "text-end font-medium tabular-nums" : "hidden text-end font-medium tabular-nums md:table-cell"}>
                    {cell(summary.dayTotals.get(isoOf(day)))}
                  </Table.Cell>
                ))}
                <Table.Cell className="text-end font-semibold tabular-nums">{hoursFixed(summary.total)}</Table.Cell>
              </Table.Row>
            ) : null}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
