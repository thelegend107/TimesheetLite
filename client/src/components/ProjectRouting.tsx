import { Plus, TrashBin } from "@gravity-ui/icons";
import { Button, ComboBox, Input, ListBox, Select } from "@heroui/react";
import type { ClockifyMapping, ClockifyProject } from "../api/types";
import { BILLABLE_OPTIONS, billableFromKey, billableKey, clientFromKey, clientKey, clientLabel, draftsOf, effectiveClient, mappingNote, mappingValue, projectMatches, projectOptionLabel, projectsOfClient } from "../lib/clockifyPlan";
import type { RuleDraft } from "../lib/clockifyPlan";
import { ProjectLabel } from "./ProjectLabel";

export type RulePatch = Partial<Pick<RuleDraft, "phrase" | "clockifyProjectId" | "billable">>;

type ProjectRoutingProps = {
  mapping: ClockifyMapping;
  projects: ClockifyProject[];
  clients: string[];
  choices: Record<string, string>;
  clientChoices: Record<string, string>;
  rules: RuleDraft[];
  isDisabled: boolean;
  onChoose: (project: string, projectId: string) => void;
  onChooseClient: (mapping: ClockifyMapping, client: string) => void;
  onAddRule: (project: string) => void;
  onChangeRule: (key: string, patch: RulePatch) => void;
  onRemoveRule: (key: string) => void;
};

type ProjectPickerProps = { label: string; value: string | null; options: ClockifyProject[]; showClient: boolean; placeholder: string; isDisabled: boolean; onChange: (projectId: string) => void };

type BillablePickerProps = { label: string; value: boolean | null; isDisabled: boolean; onChange: (billable: boolean | null) => void };

type PhraseInputProps = { label: string; value: string; isDisabled: boolean; autoFocus: boolean; onCommit: (phrase: string) => void };

const HINT = "Entries whose task contains the wording go to that project. The longest wording wins, and everything else uses the project above. Billable follows the Clockify project unless a rule sets it.";

function ProjectPicker({ label, value, options, showClient, placeholder, isDisabled, onChange }: ProjectPickerProps) {
  return (
    <ComboBox
      aria-label={label}
      fullWidth
      defaultFilter={projectMatches}
      isDisabled={isDisabled}
      menuTrigger="focus"
      selectedKey={value}
      variant="secondary"
      onSelectionChange={(key) => {
        if (key !== null) {
          onChange(String(key));
        }
      }}
    >
      <ComboBox.InputGroup>
        <Input autoComplete="off" placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {options.map((project) => (
            <ListBox.Item key={project.id} id={project.id} textValue={showClient ? projectOptionLabel(project) : project.name}>
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {showClient && project.clientName !== "" ? <span className="shrink-0 pl-3 text-xs text-muted">{project.clientName}</span> : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

function BillablePicker({ label, value, isDisabled, onChange }: BillablePickerProps) {
  return (
    <Select
      aria-label={label}
      isDisabled={isDisabled}
      value={billableKey(value)}
      variant="secondary"
      onChange={(key) => {
        if (typeof key === "string") {
          onChange(billableFromKey(key));
        }
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {BILLABLE_OPTIONS.map((option) => (
            <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function PhraseInput({ label, value, isDisabled, autoFocus, onCommit }: PhraseInputProps) {
  return (
    <Input
      aria-label={label}
      autoComplete="off"
      autoFocus={autoFocus}
      defaultValue={value}
      disabled={isDisabled}
      fullWidth
      placeholder="Task contains…"
      variant="secondary"
      onBlur={(event) => onCommit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onCommit(event.currentTarget.value);
        }
      }}
    />
  );
}

export function ProjectRouting({ mapping, projects, clients, choices, clientChoices, rules, isDisabled, onChoose, onChooseClient, onAddRule, onChangeRule, onRemoveRule }: ProjectRoutingProps) {
  const client = effectiveClient(mapping, choices, clientChoices, projects, clients);
  const options = projectsOfClient(projects, client);
  const own = draftsOf(rules, mapping.project);

  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,2fr)] sm:items-center">
      <div className="min-w-0 text-sm font-medium text-foreground">
        <ProjectLabel className="max-w-full" project={mapping.project} />
      </div>
      <Select
        aria-label={`Clockify client for ${mapping.project}`}
        fullWidth
        isDisabled={isDisabled}
        placeholder="Choose a client"
        value={client === null ? null : clientKey(client)}
        variant="secondary"
        onChange={(key) => {
          if (typeof key === "string") {
            onChooseClient(mapping, clientFromKey(key));
          }
        }}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {clients.map((name) => (
              <ListBox.Item key={clientKey(name)} id={clientKey(name)} textValue={clientLabel(name)}>
                {clientLabel(name)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <ProjectPicker isDisabled={isDisabled} label={`Clockify project for ${mapping.project}`} options={options} placeholder={client === null ? "Search Clockify projects" : "Choose a project"} showClient={client === null} value={mappingValue(mapping, choices)} onChange={(projectId) => onChoose(mapping.project, projectId)} />
      <p className="text-xs text-muted sm:col-span-2 sm:col-start-2">{mappingNote(mapping, choices)}</p>

      <div className="flex flex-col gap-2 sm:col-span-2 sm:col-start-2">
        {own.map((rule) => (
          <div key={rule.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)] sm:items-center sm:gap-x-4">
            <PhraseInput autoFocus={rule.phrase === "" && rule.key.startsWith("new-")} isDisabled={isDisabled} label={`Task wording for ${mapping.project}`} value={rule.phrase} onCommit={(phrase) => onChangeRule(rule.key, { phrase })} />
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <ProjectPicker isDisabled={isDisabled} label={`Clockify project for tasks containing ${rule.phrase || "the wording"}`} options={options} placeholder="Choose a project" showClient={client === null} value={rule.clockifyProjectId === "" ? null : rule.clockifyProjectId} onChange={(projectId) => onChangeRule(rule.key, { clockifyProjectId: projectId })} />
              </div>
              <div className="w-36 shrink-0">
                <BillablePicker isDisabled={isDisabled} label={`Billable for tasks containing ${rule.phrase || "the wording"}`} value={rule.billable} onChange={(billable) => onChangeRule(rule.key, { billable })} />
              </div>
              <Button isDisabled={isDisabled} isIconOnly aria-label="Remove task rule" size="sm" variant="tertiary" onPress={() => onRemoveRule(rule.key)}>
                <TrashBin />
              </Button>
            </div>
          </div>
        ))}
        {own.length > 0 ? <p className="text-xs text-muted">{HINT}</p> : null}
        <Button className="self-start" isDisabled={isDisabled} size="sm" variant="tertiary" onPress={() => onAddRule(mapping.project)}>
          <Plus />
          Add task rule
        </Button>
      </div>
    </li>
  );
}
