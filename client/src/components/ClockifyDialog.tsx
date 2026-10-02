import { Alert, Button, Chip, Description, EmptyState, ListBox, Modal, Select, Skeleton, Spinner, Switch, Table, ToggleButton, ToggleButtonGroup, toast } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { useState } from "react";
import type { ReactNode } from "react";
import { useClockifyPlan, useClockifyPush, useClockifyStatus, useDisconnectClockify } from "../api/queries";
import type { ClockifyAccount, ClockifyMapping, ClockifyProject, ClockifyStatus, ClockifySyncItem, ClockifySyncResult } from "../api/types";
import { actionChip, buildPlanRequest, effectiveMappings, endsNextDay, entryDetail, itemDateLabel, mappingNote, mappingValue, orderItems, outcomeChip, planNote, planSummary, pushCount, pushLabel, pushToast, rangeLabel, readIncludeNotes, resultNote, resultSummary, timeRangeLabel, writeIncludeNotes } from "../lib/clockifyPlan";
import type { ChipSpec, ClockifyScope } from "../lib/clockifyPlan";
import { ClockifyConnectForm } from "./ClockifyConnectForm";
import { ProjectLabel } from "./ProjectLabel";

type ClockifyDialogProps = { isOpen: boolean; onOpenChange: (open: boolean) => void; selected: CalendarDate };

type PanelProps = { isOpen: boolean; selected: CalendarDate; onBusyChange: (busy: boolean) => void };

type ReadyProps = { status: ClockifyStatus; account: ClockifyAccount; selected: CalendarDate; onBusyChange: (busy: boolean) => void };

type ProblemAlertProps = { status: "default" | "danger"; title: string; actionLabel: string; isBusy: boolean; onAction: () => void; children?: ReactNode };

type IssueAlertProps = { status: ClockifyStatus; isBusy: boolean; onCheck: () => void };

type ProjectChoiceProps = { mapping: ClockifyMapping; projects: ClockifyProject[]; choices: Record<string, string>; isDisabled: boolean; onChoose: (project: string, projectId: string) => void };

type ChangesTableProps = { items: ClockifySyncItem[]; mode: "plan" | "result" };

const CODE = "font-mono text-xs text-foreground";
const PAD = "px-3";

export function ClockifyDialog({ isOpen, onOpenChange, selected }: ClockifyDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal.Backdrop isDismissable={!busy} isKeyboardDismissDisabled={busy} isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog className="sm:max-w-4xl">
          <Modal.Header>
            <Modal.Heading>Clockify</Modal.Heading>
          </Modal.Header>
          <ClockifyPanel isOpen={isOpen} selected={selected} onBusyChange={setBusy} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ClockifyPanel({ isOpen, selected, onBusyChange }: PanelProps) {
  const status = useClockifyStatus(isOpen);
  const refetch = () => void status.refetch();

  if (status.isPending) {
    return (
      <>
        <Modal.Body>
          <LoadingState />
        </Modal.Body>
        <CancelFooter />
      </>
    );
  }

  if (status.isError) {
    return (
      <>
        <Modal.Body>
          <ProblemAlert actionLabel="Retry" isBusy={status.isFetching} status="danger" title="Could not load Clockify" onAction={refetch}>
            <Alert.Description>{status.error.message}</Alert.Description>
          </ProblemAlert>
        </Modal.Body>
        <CancelFooter />
      </>
    );
  }

  const data = status.data;

  if (data.issue === "None" && data.account !== null) {
    return <ClockifyReady account={data.account} selected={selected} status={data} onBusyChange={onBusyChange} />;
  }

  return (
    <>
      <Modal.Body>
        <IssueAlert isBusy={status.isFetching} status={data} onCheck={refetch} />
      </Modal.Body>
      <CancelFooter />
    </>
  );
}

function CancelFooter() {
  return (
    <Modal.Footer>
      <Button slot="close" variant="secondary">
        Cancel
      </Button>
    </Modal.Footer>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-4 w-3/4 rounded-lg" />
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="h-5 w-64 rounded-lg" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

function PlanLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Skeleton className="h-5 w-56 rounded-lg" />
      <Skeleton className="h-36 w-full rounded-lg" />
    </div>
  );
}

function ProblemAlert({ status, title, actionLabel, isBusy, onAction, children }: ProblemAlertProps) {
  return (
    <Alert status={status}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {children}
        <Button className="mt-3" isPending={isBusy} size="sm" variant="secondary" onPress={onAction}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {actionLabel}
            </>
          )}
        </Button>
      </Alert.Content>
    </Alert>
  );
}

export function IssueAlert({ status, isBusy, onCheck }: IssueAlertProps) {
  switch (status.issue) {
    case "NotConfigured":
      return status.connection === "None" ? (
        <ClockifyConnectForm replacing={false} />
      ) : (
        <ProblemAlert actionLabel="Check again" isBusy={isBusy} status="default" title="Clockify is not connected" onAction={onCheck}>
          <Alert.Description>{status.message}</Alert.Description>
          <span className="mt-2 text-sm text-muted">Fix that setting, then restart the app.</span>
        </ProblemAlert>
      );
    case "Unreadable":
      return (
        <div className="flex flex-col gap-5">
          <ProblemAlert actionLabel="Check again" isBusy={isBusy} status="danger" title="The saved Clockify key cannot be read" onAction={onCheck}>
            <Alert.Description>{status.message}</Alert.Description>
          </ProblemAlert>
          <ClockifyConnectForm replacing />
        </div>
      );
    case "SchemaMissing":
      return (
        <ProblemAlert actionLabel="Check again" isBusy={isBusy} status="default" title="The Clockify tables are not in the database" onAction={onCheck}>
          <Alert.Description>
            Run <code className={CODE}>Scripts/002-clockify-sync.sql</code> on the database, then check again.
          </Alert.Description>
        </ProblemAlert>
      );
    case "Unauthorized":
      return (
        <div className="flex flex-col gap-5">
          <ProblemAlert actionLabel="Check again" isBusy={isBusy} status="danger" title="Clockify rejected the API key" onAction={onCheck}>
            {status.message && status.message.replace(/\.$/, "") !== "Clockify rejected the API key" ? <Alert.Description>{status.message}</Alert.Description> : null}
            {status.connection === "Environment" ? <span className="mt-2 text-sm text-muted">This key comes from the server settings. A key you connect below takes priority over it.</span> : null}
          </ProblemAlert>
          <ClockifyConnectForm replacing />
        </div>
      );
    case "Unreachable":
      return (
        <ProblemAlert actionLabel="Retry" isBusy={isBusy} status="danger" title="Could not reach Clockify" onAction={onCheck}>
          <Alert.Description>{status.message ?? "Clockify did not answer."}</Alert.Description>
        </ProblemAlert>
      );
    default:
      return (
        <ProblemAlert actionLabel="Retry" isBusy={isBusy} status="danger" title="Clockify did not report an account" onAction={onCheck}>
          <Alert.Description>{status.message ?? "The connection check finished without an account."}</Alert.Description>
        </ProblemAlert>
      );
  }
}

function ClockifyReady({ status, account, selected, onBusyChange }: ReadyProps) {
  const [scope, setScope] = useState<ClockifyScope>("week");
  const [includeNotes, setIncludeNotes] = useState(readIncludeNotes);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ClockifySyncResult | null>(null);
  const push = useClockifyPush();
  const disconnect = useDisconnectClockify();
  const request = buildPlanRequest(scope, selected, includeNotes, effectiveMappings(status.mappings, choices));
  const plan = useClockifyPlan(result === null ? request : null);
  const count = plan.data ? pushCount(plan.data.summary) : 0;

  const changeScope = (keys: Set<string | number>) => {
    const [key] = [...keys];

    if (key === "day" || key === "week") {
      push.reset();
      setScope(key);
    }
  };

  const changeNotes = (value: boolean) => {
    push.reset();
    writeIncludeNotes(value);
    setIncludeNotes(value);
  };

  const choose = (project: string, projectId: string) => {
    push.reset();
    setChoices((current) => ({ ...current, [project]: projectId }));
  };

  const previewAgain = () => {
    push.reset();
    setResult(null);
  };

  const send = async () => {
    onBusyChange(true);

    try {
      const response = await push.mutateAsync({ ...request, apply: true });
      const note = pushToast(response);

      setResult(response);

      if (note.kind === "success") {
        toast.success(note.title);
      } else {
        toast.danger(note.title, { description: note.description });
      }
    } catch {
      return;
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Pushing as {account.userName} to {account.workspaceName}, times in {account.timeZone}
            {status.connection === "Environment" ? ". Connected through the server settings." : ""}
          </p>

          {result === null ? (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <ToggleButtonGroup aria-label="Range to push" disallowEmptySelection isDisabled={push.isPending} selectedKeys={new Set([scope])} selectionMode="single" size="sm" onSelectionChange={changeScope}>
                    <ToggleButton id="day">This day</ToggleButton>
                    <ToggleButton id="week">
                      <ToggleButtonGroup.Separator />
                      This week
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <span className="text-sm text-foreground tabular-nums">{rangeLabel(scope, selected)}</span>
                </div>
                <Switch isDisabled={push.isPending} isSelected={includeNotes} onChange={changeNotes}>
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Include notes in the description
                  </Switch.Content>
                  <Description>Off sends the task as the description. On adds the notes under it.</Description>
                </Switch>
              </div>

              {status.mappings.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-medium text-foreground">Projects</h3>
                    <p className="text-xs text-muted">{status.projects.length === 0 ? "This workspace has no active projects in Clockify, so every entry is blocked. Create one there, then reopen this dialog." : "Entries whose project has no Clockify project are blocked."}</p>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {status.mappings.map((mapping) => (
                      <ProjectChoice key={mapping.project} choices={choices} isDisabled={push.isPending} mapping={mapping} projects={status.projects} onChoose={choose} />
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="flex flex-col gap-3">
                {push.isError ? (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Could not push to Clockify</Alert.Title>
                      <Alert.Description>{push.error.message}</Alert.Description>
                      <span className="mt-1 text-sm text-muted">Check the preview below, then push again.</span>
                    </Alert.Content>
                  </Alert>
                ) : null}
                {plan.isPending ? (
                  <PlanLoading />
                ) : plan.isError ? (
                  <ProblemAlert actionLabel="Retry" isBusy={plan.isFetching} status="danger" title="Could not preview the push" onAction={() => void plan.refetch()}>
                    <Alert.Description>{plan.error.message}</Alert.Description>
                  </ProblemAlert>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground" role="status">
                      {planSummary(plan.data.summary)}
                    </p>
                    <ChangesTable items={plan.data.items} mode="plan" />
                  </>
                )}
              </section>
            </>
          ) : (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground" role="status">
                  {resultSummary(result.summary)}
                </p>
                <span className="text-sm text-muted tabular-nums">{rangeLabel(scope, selected)}</span>
              </div>
              <ChangesTable items={result.items} mode="result" />
            </section>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="flex-wrap">
        {result === null ? (
          <>
            {status.connection === "App" ? (
              <Button className="mr-auto max-sm:w-full" isDisabled={push.isPending} isPending={disconnect.isPending} variant="tertiary" onPress={() => void disconnect.mutateAsync().then(() => toast.success("Clockify disconnected"))}>
                Disconnect
              </Button>
            ) : null}
            <Button isDisabled={push.isPending} slot="close" variant="secondary">
              Cancel
            </Button>
            <Button isDisabled={count === 0 || plan.isPending || plan.isError} isPending={push.isPending} onPress={send}>
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  {isPending ? "Pushing…" : pushLabel(count)}
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Button variant="tertiary" onPress={previewAgain}>
              Preview again
            </Button>
            <Button slot="close">Done</Button>
          </>
        )}
      </Modal.Footer>
    </>
  );
}

function ProjectChoice({ mapping, projects, choices, isDisabled, onChoose }: ProjectChoiceProps) {
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] sm:items-center">
      <div className="min-w-0 text-sm font-medium text-foreground">
        <ProjectLabel className="max-w-full" project={mapping.project} />
      </div>
      <Select
        aria-label={`Clockify project for ${mapping.project}`}
        fullWidth
        isDisabled={isDisabled}
        placeholder="Choose a project"
        value={mappingValue(mapping, choices)}
        variant="secondary"
        onChange={(key) => {
          if (typeof key === "string") {
            onChoose(mapping.project, key);
          }
        }}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {projects.map((project) => (
              <ListBox.Item key={project.id} id={project.id} textValue={project.name}>
                {project.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <p className="text-xs text-muted">{mappingNote(mapping, choices)}</p>
    </li>
  );
}

function StatusChip({ chip }: { chip: ChipSpec }) {
  return (
    <Chip color={chip.color} size="sm" variant="soft">
      {chip.label}
    </Chip>
  );
}

function ChangesTable({ items, mode }: ChangesTableProps) {
  const rows = orderItems(items).map((item, index) => ({ id: String(index), item }));

  return (
    <Table variant="secondary">
      <Table.ScrollContainer className="max-h-72 overflow-y-auto">
        <Table.Content aria-label={mode === "plan" ? "Changes to push" : "Push results"}>
          <Table.Header className="sticky top-0 z-10">
            <Table.Column className={PAD}>{mode === "plan" ? "Action" : "Result"}</Table.Column>
            <Table.Column className={PAD}>Date</Table.Column>
            <Table.Column className={PAD}>Time</Table.Column>
            <Table.Column className={PAD} isRowHeader>
              Entry
            </Table.Column>
            <Table.Column className={PAD}>Note</Table.Column>
          </Table.Header>
          <Table.Body items={rows} renderEmptyState={() => <EmptyState className="p-4 text-sm text-muted">No entries in this range.</EmptyState>}>
            {({ id, item }) => {
              const detail = entryDetail(item);

              return (
                <Table.Row id={id}>
                  <Table.Cell className={PAD}>
                    <StatusChip chip={mode === "plan" ? actionChip(item.action) : outcomeChip(item.outcome)} />
                  </Table.Cell>
                  <Table.Cell className={`${PAD} whitespace-nowrap`}>{itemDateLabel(item.date)}</Table.Cell>
                  <Table.Cell className={`${PAD} whitespace-nowrap tabular-nums`}>
                    {timeRangeLabel(item.start, item.end)}
                    {endsNextDay(item.start, item.end) ? <span className="block text-xs text-muted">Ends the next day</span> : null}
                  </Table.Cell>
                  <Table.Cell className={PAD}>
                    <div className="flex max-w-52 flex-col">
                      <span className="truncate font-medium" title={item.label}>
                        {item.label}
                      </span>
                      {detail ? (
                        <span className="truncate text-xs text-muted" title={detail}>
                          {detail}
                        </span>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell className={`${PAD} min-w-44 text-muted`}>{mode === "plan" ? planNote(item) : resultNote(item)}</Table.Cell>
                </Table.Row>
              );
            }}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
