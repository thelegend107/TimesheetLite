import { Alert, Button, Card, toast } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { useEffect, useRef, useState } from "react";
import { useCreateEntry, useDeleteEntry, useUpdateEntry } from "../api/queries";
import { ApiError } from "../api/client";
import type { Catalog, Entry, EntryInput } from "../api/types";
import { formatDayLong, formatMonthDay, formatMonthDayYear, parseIso, todayDate } from "../lib/dates";
import { entriesOn, type WeekSummary as Summary } from "../lib/entries";
import { DeleteDialog } from "./DeleteDialog";
import { EntriesTable } from "./EntriesTable";
import { EntryDrawer } from "./EntryDrawer";
import { EntryForm, type EntrySeed } from "./EntryForm";
import { WeekSummary } from "./WeekSummary";

type DayWorkspaceProps = {
  date: string;
  days: CalendarDate[];
  weekEntries: Entry[] | undefined;
  isLoading: boolean;
  error: Error | null;
  catalog: Catalog | undefined;
  summary: Summary | null;
  onRetry: () => void;
  onUserChange: () => void;
};

type Seed = { nonce: number; value: EntrySeed };

export function DayWorkspace({ date, days, weekEntries, isLoading, error, catalog, summary, onRetry, onUserChange }: DayWorkspaceProps) {
  const create = useCreateEntry();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [seed, setSeed] = useState<Seed | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const currentDate = useRef(date);

  useEffect(() => {
    currentDate.current = date;
  }, [date]);

  useEffect(() => {
    if (justAdded === null) {
      return;
    }

    const timer = window.setTimeout(() => setJustAdded(null), 1600);

    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const entries = weekEntries ?? [];
  const loadFailed = error !== null && weekEntries === undefined;
  const unreachable = !(error instanceof ApiError) || error.status === 0;
  const dayEntries = entriesOn(entries, date);
  const dayLabel = formatDayLong(parseIso(date));

  const add = async (input: EntryInput) => {
    onUserChange();

    const created = await create.mutateAsync(input);

    setJustAdded(created.id);
  };

  const save = async (input: EntryInput) => {
    if (!editing) {
      return;
    }

    onUserChange();

    try {
      await update.mutateAsync({ id: editing.id, input });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        toast.warning("This entry no longer exists", { description: "It was deleted somewhere else. The list has been refreshed." });
        setEditOpen(false);
        onRetry();

        return;
      }

      throw failure;
    }

    const moved = parseIso(input.date);

    toast.success(input.date === editing.date ? "Entry updated" : `Entry moved to ${moved.year === todayDate().year ? formatMonthDay(moved) : formatMonthDayYear(moved)}`);
    setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }

    const deletedOn = date;

    try {
      await remove.mutateAsync(deleting.id);
      const removed = deleting;
      let undone = false;
      const toastId: string = toast.success("Entry deleted", removed.start === null || removed.end === null ? undefined : { timeout: 9000, actionProps: { children: "Undo", variant: "tertiary", onPress: () => {
        if (!undone) {
          undone = true;
          void restore(removed, toastId);
        }
      } } });

      setDeleteOpen(false);
      setEditOpen(false);

      if (dayEntries.length <= 1 && currentDate.current === deletedOn) {
        setFocusSignal((count) => count + 1);
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        toast.warning("That entry was already deleted", { description: "The list has been refreshed." });
        setDeleteOpen(false);
        setEditOpen(false);
        onRetry();

        if (dayEntries.length <= 1 && currentDate.current === deletedOn) {
          setFocusSignal((count) => count + 1);
        }

        return;
      }

      toast.danger("Could not delete the entry", { description: failure instanceof Error ? failure.message : "Try again in a moment." });
    }
  };

  const restore = async (entry: Entry, toastId: string) => {
    toast.close(toastId);

    onUserChange();

    try {
      const restored = await create.mutateAsync({ date: entry.date, project: entry.project, task: entry.task, start: entry.start ?? "", end: entry.end ?? "", notes: entry.notes });

      setJustAdded(restored.id);
      toast.success("Entry restored");
    } catch (failure) {
      toast.danger("Could not restore the entry", { description: failure instanceof Error ? failure.message : "Try again in a moment." });
    }
  };

  const openEdit = (entry: Entry) => {
    setEditing(entry);
    setEditOpen(true);
  };

  const openDelete = (entry: Entry) => {
    setDeleting(entry);
    setDeleteOpen(true);
  };

  const duplicate = (entry: Entry) => {
    setSeed((current) => ({ nonce: (current?.nonce ?? 0) + 1, value: { project: entry.project, task: entry.task, notes: entry.notes ?? "" } }));
    window.setTimeout(() => document.getElementById("add-entry-card")?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 300);
  };

  const duplicateEditing = () => {
    if (editing) {
      duplicate(editing);
      setEditOpen(false);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card className="lg:sticky lg:top-4 xl:row-span-2" id="add-entry-card">
        <Card.Header>
          <Card.Title>Add entry</Card.Title>
          <Card.Description>{dayLabel}</Card.Description>
        </Card.Header>
        <Card.Content>
          <EntryForm key={seed ? `seed-${seed.nonce}` : "add"} catalog={catalog} date={date} focusSignal={focusSignal} isSubmitting={create.isPending} mode="add" seed={seed?.value} weekEntries={entries} onSubmit={add} />
        </Card.Content>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {error ? (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Entries could not be loaded</Alert.Title>
              <Alert.Description>{error.message} {unreachable ? "Check that the server is running and that you are online, then try again." : "Check the database connection, then try again."}</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={onRetry}>
              Try again
            </Button>
          </Alert>
        ) : null}

        {loadFailed ? null : (
          <Card>
            <Card.Header>
              <Card.Title>{dayLabel}</Card.Title>
            </Card.Header>
            <Card.Content className="px-0">
              <EntriesTable dayLabel={dayLabel} entries={dayEntries} highlightId={justAdded} isLoading={isLoading} onDelete={openDelete} onDuplicate={duplicate} onEdit={openEdit} />
            </Card.Content>
          </Card>
        )}
      </div>

      {loadFailed ? null : (
        <Card className="min-w-0 lg:col-span-2 xl:col-span-1 xl:col-start-2">
          <Card.Header>
            <Card.Title>Week by project</Card.Title>
          </Card.Header>
          <Card.Content className="px-0">
            <WeekSummary days={days} selected={date} summary={summary} />
          </Card.Content>
        </Card>
      )}

      <EntryDrawer catalog={catalog} entry={editing} isOpen={editOpen} isSubmitting={update.isPending} weekEntries={entries} onDelete={() => editing && openDelete(editing)} onDuplicate={duplicateEditing} onOpenChange={setEditOpen} onSubmit={save} />
      <DeleteDialog entry={deleting} isOpen={deleteOpen} isPending={remove.isPending} onConfirm={confirmDelete} onOpenChange={setDeleteOpen} />
    </div>
  );
}
