import { ArrowDownToLine } from "@gravity-ui/icons";
import { Alert, Button, DateField, DateRangePicker, FieldError, Label, ListBox, Modal, RangeCalendar, Select, Skeleton } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { useRef, useState } from "react";
import { exportUrl } from "../api/client";
import { useEntries } from "../api/queries";
import { parseIso, todayDate } from "../lib/dates";
import { DEFAULT_PRESET, type DateRangeValue, EXPORT_PRESETS, type ExportPresetId, MAX_RANGE_DAYS, customRangeProblem, describeSummary, formatExportRange, isExportPreset, presetRange, resolveExportRange, summarizeExport } from "../lib/exportRanges";
import { ProjectLabel } from "./ProjectLabel";

type ExportDialogProps = { isOpen: boolean; onOpenChange: (open: boolean) => void; selected: CalendarDate; projects: string[] };

type ExportFormProps = { selected: CalendarDate; projects: string[]; onClose: () => void };

const ALL_PROJECTS_ID = "all";

const PROJECT_ID_PREFIX = "project:";

const projectIdOf = (project: string | null) => (project === null ? ALL_PROJECTS_ID : `${PROJECT_ID_PREFIX}${project}`);

const projectOfId = (id: string) => (id.startsWith(PROJECT_ID_PREFIX) ? id.slice(PROJECT_ID_PREFIX.length) : null);

const BLANK_SEGMENT_SELECTOR = '[data-type][data-placeholder="true"]';

const RANGE_PROBLEMS = {
  reversed: "The end date is before the start date. Choose an end date on or after the start.",
  "too-long": `A range can span at most ${MAX_RANGE_DAYS.toLocaleString("en-US")} days. Shorten it.`,
};

export function ExportDialog({ isOpen, onOpenChange, selected, projects }: ExportDialogProps) {
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [session, setSession] = useState(0);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);

    if (isOpen) {
      setSession(session + 1);
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:w-md">
          <ExportForm key={session} selected={selected} projects={projects} onClose={() => onOpenChange(false)} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ExportForm({ selected, projects, onClose }: ExportFormProps) {
  const [today] = useState(todayDate);
  const [preset, setPreset] = useState<ExportPresetId>(DEFAULT_PRESET);
  const [custom, setCustom] = useState<DateRangeValue | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [hasBlankSegment, setHasBlankSegment] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const names = [...new Set(projects)];
  const activeProject = project !== null && names.includes(project) ? project : null;
  const isBlank = preset === "custom" && hasBlankSegment;
  const problem = preset === "custom" && !isBlank ? customRangeProblem(custom) : null;
  const range = isBlank ? null : resolveExportRange(preset, selected, today, custom);
  const loadedRange = range ?? presetRange("this-week", selected, today);
  const query = useEntries(loadedRange.from, loadedRange.to);
  const isLoading = range !== null && query.isPending;
  const failed = range !== null && query.isError;
  const summary = range !== null && !query.isError && query.data ? summarizeExport(query.data, activeProject) : null;
  const canDownload = range !== null && summary !== null && summary.count > 0;

  const choosePreset = (next: ExportPresetId) => {
    if (next === "custom" && custom === null && range !== null) {
      setCustom({ start: parseIso(range.from), end: parseIso(range.to) });
    }

    setHasBlankSegment(false);
    setPreset(next);
  };

  const syncBlankSegment = () => setHasBlankSegment(pickerRef.current?.querySelector(BLANK_SEGMENT_SELECTOR) != null);

  const changeCustom = (value: DateRangeValue | null) => {
    setCustom(value);
    setHasBlankSegment(false);
  };

  const download = () => {
    if (range === null) {
      return;
    }

    window.location.assign(exportUrl(range.from, range.to, activeProject ?? undefined));
    onClose();
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Export CSV</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <Select autoFocus fullWidth value={preset} variant="secondary" onChange={(key) => (isExportPreset(key) ? choosePreset(key) : undefined)}>
          <Label>Range</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {EXPORT_PRESETS.map((item) => (
                <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
                  {item.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {preset === "custom" ? (
          <DateRangePicker ref={pickerRef} className="w-full" isInvalid={problem === "reversed" || problem === "too-long"} value={custom} onBlur={syncBlankSegment} onChange={changeCustom} onKeyUp={syncBlankSegment}>
            <Label>Dates</Label>
            <DateField.Group fullWidth variant="secondary">
              <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              <DateRangePicker.RangeSeparator />
              <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              <DateField.Suffix>
                <DateRangePicker.Trigger>
                  <DateRangePicker.TriggerIndicator />
                </DateRangePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <FieldError>{problem === "reversed" || problem === "too-long" ? RANGE_PROBLEMS[problem] : ""}</FieldError>
            <DateRangePicker.Popover>
              <RangeCalendar aria-label="Dates to export" firstDayOfWeek="mon">
                <RangeCalendar.Header>
                  <RangeCalendar.YearPickerTrigger>
                    <RangeCalendar.YearPickerTriggerHeading />
                    <RangeCalendar.YearPickerTriggerIndicator />
                  </RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.NavButton slot="previous" />
                  <RangeCalendar.NavButton slot="next" />
                </RangeCalendar.Header>
                <RangeCalendar.Grid>
                  <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
                  <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
                </RangeCalendar.Grid>
                <RangeCalendar.YearPickerGrid>
                  <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
                </RangeCalendar.YearPickerGrid>
              </RangeCalendar>
            </DateRangePicker.Popover>
          </DateRangePicker>
        ) : null}

        <Select fullWidth value={projectIdOf(activeProject)} variant="secondary" onChange={(key) => setProject(projectOfId(String(key)))}>
          <Label>Project</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_PROJECTS_ID} textValue="All projects">
                All projects
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {names.map((name) => (
                <ListBox.Item key={name} id={projectIdOf(name)} textValue={name}>
                  <ProjectLabel project={name} />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {failed ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Entries could not be loaded</Alert.Title>
              <Alert.Description>{query.error?.message ?? "The request failed."}</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={() => query.refetch()}>
              Try again
            </Button>
          </Alert>
        ) : (
          <div aria-busy={isLoading} aria-live="polite" className="flex flex-col gap-1" role="status">
            {range === null ? <p className="text-sm text-muted">Choose a start and end date to see what will be exported.</p> : null}
            {isLoading ? <Skeleton className="h-5 w-44 rounded-md" /> : null}
            {summary !== null && summary.count > 0 ? <p className="text-sm font-medium tabular-nums text-foreground">{describeSummary(summary)}</p> : null}
            {summary !== null && summary.count === 0 ? <p className="text-sm text-foreground">{activeProject === null ? "No entries in this range. Choose a wider range." : `No entries for ${activeProject} in this range. Choose a wider range or another project.`}</p> : null}
            {range !== null ? <p className="text-xs tabular-nums text-muted">{formatExportRange(range)}</p> : null}
          </div>
        )}

        <p className="text-xs text-muted">
          The file opens in Excel and Numbers, and text that starts with <span className="whitespace-nowrap">=, +, - or @</span> gets an apostrophe in front so spreadsheets do not treat it as a formula.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="tertiary">
          Cancel
        </Button>
        <Button isDisabled={!canDownload} onPress={download}>
          <ArrowDownToLine />
          Download CSV
        </Button>
      </Modal.Footer>
    </>
  );
}
