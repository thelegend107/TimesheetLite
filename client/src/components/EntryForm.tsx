import { Button, Chip, DateField, DatePicker, Description, FieldError, Form, Kbd, Label, TextArea, TextField, toast } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { Catalog, Entry, EntryInput } from "../api/types";
import { formatDayLong, isoOf, parseIso, todayDate } from "../lib/dates";
import { entriesOn, findOverlap, suggestStart } from "../lib/entries";
import { splitServerErrors } from "../lib/formErrors";
import { hoursFixed } from "../lib/format";
import { defaultProject, taskSuggestions } from "../lib/projects";
import { ALL_TIME_OPTIONS, endTimeOptions, endsNextDay, formatTime, fromWireTime, hoursBetween, normalizeTimeText, parseTime, toWireTime } from "../lib/time";
import { CalendarPanel } from "./CalendarPanel";
import { ProjectField } from "./ProjectField";
import { TaskField } from "./TaskField";
import { TimeComboBox } from "./TimeComboBox";

export type EntrySeed = { project: string; task: string; notes: string };

type EntryFormProps = {
  mode: "add" | "edit";
  date: string;
  entry?: Entry;
  weekEntries: Entry[];
  catalog: Catalog | undefined;
  seed?: EntrySeed;
  focusSignal?: number;
  isSubmitting: boolean;
  onSubmit: (input: EntryInput) => Promise<void>;
  onCancel?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

type Draft = { project?: string; task?: string; notes?: string; start?: string; end?: string };

type Field = "project" | "task" | "start" | "end" | "notes" | "date";

type Errors = Partial<Record<Field, string>>;

const MAX_NOTES = 1000;
const MAX_TASK = 100;
const MAX_PROJECT = 100;
const START_OPTIONS = ALL_TIME_OPTIONS.map((minutes) => ({ minutes }));

const EDIT_KEY = "edit";

const wireText = (wire: string | null): string | undefined => {
  const minutes = fromWireTime(wire);

  return minutes === null ? undefined : formatTime(minutes);
};

export function EntryForm({ mode, date, entry, weekEntries, catalog, seed, focusSignal = 0, isSubmitting, onSubmit, onCancel, onDuplicate, onDelete }: EntryFormProps) {
  const editing = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);
  const edits = useRef<Record<string, number>>({});
  const viewedDate = useRef(date);
  const handledFocusSignal = useRef(focusSignal);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    if (entry) {
      return { [EDIT_KEY]: { project: entry.project, task: entry.task, notes: entry.notes ?? "", start: wireText(entry.start), end: wireText(entry.end) } };
    }

    return seed ? { [date]: { project: seed.project, task: seed.task, notes: seed.notes } } : {};
  });
  const [editDate, setEditDate] = useState(entry?.date ?? date);
  const [errors, setErrors] = useState<Errors>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const [invalidFocusRequest, setInvalidFocusRequest] = useState(0);
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" });

  useEffect(() => {
    if (focusRequest > 0) {
      taskInputRef.current?.focus();
    }
  }, [focusRequest]);

  useEffect(() => {
    viewedDate.current = date;
  }, [date]);

  useEffect(() => {
    if (focusSignal === handledFocusSignal.current) {
      return;
    }

    handledFocusSignal.current = focusSignal;

    const timer = window.setTimeout(() => taskInputRef.current?.focus(), 250);

    return () => window.clearTimeout(timer);
  }, [focusSignal]);

  useEffect(() => {
    if (invalidFocusRequest > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [invalidFocusRequest]);

  const draftKey = editing ? EDIT_KEY : date;
  const draft = drafts[draftKey];
  const activeDate = editing ? editDate : date;
  const dayEntries = useMemo(() => entriesOn(weekEntries, activeDate), [weekEntries, activeDate]);
  const suggestedStart = useMemo(() => formatTime(suggestStart(dayEntries)), [dayEntries]);
  const project = draft?.project ?? defaultProject(dayEntries, catalog);
  const task = draft?.task ?? "";
  const notes = draft?.notes ?? "";
  const startText = draft?.start ?? suggestedStart;
  const endText = draft?.end ?? "";

  const startAnchor = !editing && dayEntries.some((item) => item.end !== null) ? suggestStart(dayEntries) - 1 : null;
  const startMinutes = parseTime(startText, startAnchor);
  const endMinutes = parseTime(endText, startMinutes);
  const hours = startMinutes !== null && endMinutes !== null && startMinutes !== endMinutes ? hoursBetween(startMinutes, endMinutes) : null;
  const nextDay = hours !== null && startMinutes !== null && endMinutes !== null && endsNextDay(startMinutes, endMinutes);
  const overlap = hours !== null && startMinutes !== null && endMinutes !== null ? findOverlap(weekEntries, activeDate, startMinutes, endMinutes, entry?.id) : null;

  const projects = useMemo(() => (catalog?.projects ?? []).map((item) => item.name), [catalog]);
  const suggestions = useMemo(() => taskSuggestions(catalog, project, task), [catalog, project, task]);
  const endOptions = endTimeOptions(startMinutes).map((option) => ({ minutes: option.minutes, hint: startMinutes === null ? undefined : `${hoursFixed(option.hours)} h` }));

  const taskLength = task.trim().length;
  const notesLength = notes.trim().length;
  const taskError = errors.task ?? (taskLength > MAX_TASK ? `The task is ${taskLength} characters; the limit is ${MAX_TASK}.` : undefined);
  const notesError = errors.notes ?? (notesLength > MAX_NOTES ? `The notes are ${notesLength} characters; the limit is ${MAX_NOTES.toLocaleString("en-US")}.` : undefined);

  const patch = (changes: Draft) => setDrafts((current) => ({ ...current, [draftKey]: { ...current[draftKey], ...changes } }));

  const clear = (field: Field) => {
    edits.current[draftKey] = (edits.current[draftKey] ?? 0) + 1;
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const commitStart = (text: string) => patch({ start: normalizeTimeText(text, startAnchor) });

  const commitEnd = (text: string) => patch({ end: normalizeTimeText(text, startMinutes) });

  const reset = (keptProject: string, chainedStart: number | null) => {
    setDrafts((current) => ({ ...current, [draftKey]: { project: keptProject, start: chainedStart === null ? undefined : formatTime(chainedStart) } }));
    setErrors({});
    setFocusRequest((count) => count + 1);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editing && isSubmitting) {
      return;
    }

    const found: Errors = {};
    const typedProject = project.trim();
    const cleanProject = projects.find((name) => name.toLowerCase() === typedProject.toLowerCase()) ?? typedProject;
    const cleanTask = task.trim();

    if (cleanProject === "") {
      found.project = "Choose or type a project.";
    } else if (cleanProject.length > MAX_PROJECT) {
      found.project = `The project name is ${cleanProject.length} characters; the limit is ${MAX_PROJECT}.`;
    }

    if (cleanTask === "") {
      found.task = "Describe the task.";
    } else if (cleanTask.length > MAX_TASK) {
      found.task = taskError;
    }

    if (notesLength > MAX_NOTES) {
      found.notes = notesError;
    }

    if (editing && formRef.current?.querySelector('[role="spinbutton"][data-placeholder="true"]')) {
      found.date = "Enter a complete date.";
    }

    if (startMinutes === null) {
      found.start = "Enter a start time such as 8:00 AM or 0800.";
    }

    if (endMinutes === null) {
      found.end = "Enter an end time such as 5:00 PM or 1700.";
    } else if (endMinutes === startMinutes) {
      found.end = "The end time must differ from the start time.";
    }

    setErrors(found);

    if (Object.keys(found).length > 0 || startMinutes === null || endMinutes === null) {
      setInvalidFocusRequest((count) => count + 1);
      return;
    }

    const input: EntryInput = { date: activeDate, project: cleanProject, task: cleanTask, start: toWireTime(startMinutes), end: toWireTime(endMinutes), notes: notes.trim() === "" ? null : notes.trim() };
    const submittedKey = draftKey;
    const snapshot = draft;

    if (!editing) {
      reset(cleanProject, endMinutes > startMinutes ? endMinutes : null);
    }

    const editsAfterReset = edits.current[submittedKey] ?? 0;

    try {
      await onSubmit(input);

      if (!editing) {
        setAnnouncement((current) => ({ id: current.id + 1, text: `Added ${input.task}, ${hoursFixed(hoursBetween(startMinutes, endMinutes))} hours.` }));
      }
    } catch (error) {
      const restorable = !editing && (edits.current[submittedKey] ?? 0) === editsAfterReset;
      const stillViewing = editing || viewedDate.current === input.date;

      if (restorable) {
        setDrafts((current) => ({ ...current, [submittedKey]: snapshot ?? {} }));
      }

      const visible: Field[] = editing ? ["project", "task", "start", "end", "notes", "date"] : ["project", "task", "start", "end", "notes"];
      const server = error instanceof ApiError ? splitServerErrors(error.fieldErrors, visible) : { mapped: {}, leftover: [] };
      const showOnFields = stillViewing && (editing || restorable) && Object.keys(server.mapped).length > 0;

      if (showOnFields) {
        setErrors(server.mapped as Errors);
        setInvalidFocusRequest((count) => count + 1);
      }

      if (!showOnFields || server.leftover.length > 0) {
        const reason = server.leftover[0] ?? (error instanceof Error ? error.message : "Try again in a moment.");
        const kept = restorable && !stillViewing ? ` It is back in the draft for ${input.date}.` : "";

        toast.danger(editing ? "Could not save the entry" : "Could not add the entry", { description: restorable || editing ? `${reason}${kept}` : `${reason} "${input.task}" was not saved.` });
      }
    }
  };

  return (
    <Form ref={formRef} className="flex flex-col gap-4" validationBehavior="aria" onSubmit={submit}>
      <div
        className="contents"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault();

            if (!event.repeat && !(editing && isSubmitting)) {
              formRef.current?.requestSubmit();
            }
          }
        }}
      >
        {editing ? (
          <DatePicker
            className="w-full"
            firstDayOfWeek="mon"
            isInvalid={Boolean(errors.date)}
            value={parseIso(editDate)}
            onChange={(value) => {
              if (value) {
                setEditDate(isoOf(value as CalendarDate));
                clear("date");
              }
            }}
          >
            <Label>Date</Label>
            <DateField.Group fullWidth variant="secondary">
              <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              <DateField.Suffix>
                <DatePicker.Trigger>
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <FieldError>{errors.date}</FieldError>
            {entry && editDate !== entry.date && !errors.date ? <Description>Moves this entry to {formatDayLong(parseIso(editDate))}{parseIso(editDate).year === todayDate().year ? "" : `, ${parseIso(editDate).year}`}.</Description> : null}
            <DatePicker.Popover>
              <CalendarPanel aria-label="Entry date" />
            </DatePicker.Popover>
          </DatePicker>
        ) : null}

        <ProjectField
          error={errors.project}
          projects={projects}
          value={project}
          onChange={(value) => {
            patch({ project: value });
            clear("project");
          }}
        />

        <TaskField
          error={taskError}
          inputRef={taskInputRef}
          suggestions={suggestions}
          value={task}
          onChange={(value) => {
            patch({ task: value });
            clear("task");
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <TimeComboBox
            error={errors.start}
            label="From"
            options={START_OPTIONS}
            placeholder="8:00 AM"
            value={startText}
            onChange={(text) => {
              patch({ start: text });
              clear("start");
            }}
            onCommit={commitStart}
          />
          <TimeComboBox
            autoFocus={Boolean(seed)}
            error={errors.end}
            label="To"
            options={endOptions}
            placeholder="5p or 1700"
            value={endText}
            onChange={(text) => {
              patch({ end: text });
              clear("end");
            }}
            onCommit={commitEnd}
          />
        </div>

        <span key={announcement.id} className="sr-only" role="status">
          {announcement.text}
        </span>

        <div aria-live="polite" className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {hours === null ? (
            <span className="text-muted">Hours appear once both times are valid.</span>
          ) : (
            <>
              <span className="font-medium tabular-nums">{hoursFixed(hours)} h</span>
              {nextDay ? (
                <Chip color="warning" size="sm" variant="soft">
                  Ends the next day
                </Chip>
              ) : null}
              {overlap ? (
                <Chip className="max-w-full min-w-0" color="warning" size="sm" variant="soft">
                  <Chip.Label className="min-w-0 truncate">Overlaps {overlap.task}</Chip.Label>
                </Chip>
              ) : null}
            </>
          )}
        </div>

        <TextField
          fullWidth
          isInvalid={Boolean(notesError)}
          value={notes}
          onChange={(value) => {
            patch({ notes: value });
            clear("notes");
          }}
        >
          <Label>Notes</Label>
          <TextArea
            className="max-h-72 min-h-24 [field-sizing:content]"
            variant="secondary"
            rows={4}
          />
          <div className="flex items-start justify-between gap-3">
            <Description>One note per entry. Line breaks are kept.</Description>
            <span className={notesLength > MAX_NOTES ? "shrink-0 text-xs font-medium tabular-nums text-danger" : "shrink-0 text-xs tabular-nums text-muted"}>
              {notesLength} / {MAX_NOTES}
            </span>
          </div>
          <FieldError>{notesError}</FieldError>
        </TextField>

        <div className={editing ? "sticky bottom-0 z-10 flex flex-wrap items-center gap-2 bg-overlay pt-3 pb-1" : "flex flex-wrap items-center gap-2"}>
          <Button isPending={editing && isSubmitting} type="submit" variant="primary">
            {editing ? "Save changes" : "Add entry"}
          </Button>
          {editing ? (
            <Button isDisabled={isSubmitting} type="button" variant="tertiary" onPress={onCancel}>
              Cancel
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Kbd>
                <Kbd.Abbr keyValue="enter" />
              </Kbd>
              in To or
              <Kbd>
                <Kbd.Abbr keyValue="command" />
                <Kbd.Abbr keyValue="enter" />
              </Kbd>
              adds
            </span>
          )}
          {editing && onDuplicate ? (
            <Button isDisabled={isSubmitting} type="button" variant="tertiary" onPress={onDuplicate}>
              Duplicate
            </Button>
          ) : null}
          {editing && onDelete ? (
            <Button className="ml-auto" isDisabled={isSubmitting} type="button" variant="danger" onPress={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    </Form>
  );
}
