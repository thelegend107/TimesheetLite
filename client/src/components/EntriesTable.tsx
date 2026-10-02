import { Clock, Copy, EllipsisVertical, Pencil, TrashBin } from "@gravity-ui/icons";
import { Button, Dropdown, EmptyState, Label, Skeleton, Table } from "@heroui/react";
import type { Entry } from "../api/types";
import { endMinutesOf, startMinutesOf } from "../lib/entries";
import { hoursFixed, pluralize, sumHours } from "../lib/format";
import { formatRange } from "../lib/time";
import { ProjectLabel } from "./ProjectLabel";

type EntriesTableProps = {
  entries: Entry[];
  dayLabel: string;
  isLoading: boolean;
  highlightId?: number | null;
  onEdit: (entry: Entry) => void;
  onDuplicate: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
};

function timeRange(entry: Entry): string {
  const start = startMinutesOf(entry);
  const end = endMinutesOf(entry);

  return start === null || end === null ? "No times" : formatRange(start, end);
}

export function EntriesTable({ entries, dayLabel, isLoading, highlightId = null, onEdit, onDuplicate, onDelete }: EntriesTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    );
  }

  const byId = new Map(entries.map((entry) => [String(entry.id), entry]));

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label={`Entries for ${dayLabel}`}
          onRowAction={(key) => {
            const entry = byId.get(String(key));

            if (entry) {
              onEdit(entry);
            }
          }}
        >
          <Table.Header>
            <Table.Column isRowHeader className="xl:min-w-44" id="time">
              Time
            </Table.Column>
            <Table.Column className="hidden w-20 text-end xl:table-cell" id="hours">
              Hours
            </Table.Column>
            <Table.Column className="hidden min-w-32 xl:table-cell" id="project">
              Project
            </Table.Column>
            <Table.Column className="w-full max-md:rounded-e-2xl max-md:after:hidden" id="task">
              Task
            </Table.Column>
            <Table.Column className="hidden w-12 md:table-cell" id="actions">
              <span className="sr-only">Actions</span>
            </Table.Column>
          </Table.Header>
          <Table.Body dependencies={[highlightId]} items={entries} renderEmptyState={() => (
            <EmptyState className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Clock aria-hidden className="size-6 text-muted" />
              <p className="text-sm font-medium text-foreground">No time logged for this day yet.</p>
              <p className="text-sm text-muted">Type a task and a finish time such as 5p in the form, then press Enter.</p>
            </EmptyState>
          )}>
            {(entry) => (
              <Table.Row className={entry.id === highlightId ? "entry-added" : undefined} id={entry.id}>
                <Table.Cell className="whitespace-nowrap tabular-nums">
                  <div className="flex flex-col gap-0.5">
                    <span>{timeRange(entry)}</span>
                    <span className="text-sm text-muted xl:hidden">{hoursFixed(entry.hours)} h</span>
                  </div>
                </Table.Cell>
                <Table.Cell className="hidden text-end tabular-nums xl:table-cell">{hoursFixed(entry.hours)}</Table.Cell>
                <Table.Cell className="hidden xl:table-cell">
                  <ProjectLabel className="max-w-36" project={entry.project} />
                </Table.Cell>
                <Table.Cell className="w-full max-w-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">{entry.task}</span>
                    {entry.notes ? <span className="line-clamp-2 whitespace-pre-line text-sm text-muted [overflow-wrap:anywhere]">{entry.notes}</span> : null}
                    <span className="flex min-w-0 text-sm text-muted xl:hidden">
                      <ProjectLabel className="max-w-full" project={entry.project} />
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell className="hidden md:table-cell">
                  <Dropdown>
                    <Button isIconOnly aria-label={`Actions for ${entry.task}`} size="sm" variant="ghost">
                      <EllipsisVertical />
                    </Button>
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu
                        onAction={(key) => {
                          if (key === "edit") {
                            onEdit(entry);
                          } else if (key === "duplicate") {
                            onDuplicate(entry);
                          } else if (key === "delete") {
                            onDelete(entry);
                          }
                        }}
                      >
                        <Dropdown.Item id="edit" textValue="Edit">
                          <Pencil />
                          <Label>Edit</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="duplicate" textValue="Duplicate">
                          <Copy />
                          <Label>Duplicate</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="delete" textValue="Delete" variant="danger">
                          <TrashBin />
                          <Label>Delete</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      {entries.length > 0 ? (
        <Table.Footer className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted">{pluralize(entries.length, "entry", "entries")}</span>
          <span className="font-medium tabular-nums">{hoursFixed(sumHours(entries.map((entry) => entry.hours)))} h</span>
        </Table.Footer>
      ) : null}
    </Table>
  );
}
