import { ComboBox, Description, FieldError, Input, Label, ListBox } from "@heroui/react";
import { ProjectLabel } from "./ProjectLabel";

type ProjectFieldProps = { value: string; projects: string[]; error?: string; onChange: (value: string) => void };

export function ProjectField({ value, projects, error, onChange }: ProjectFieldProps) {
  const known = projects.find((project) => project.toLowerCase() === value.trim().toLowerCase());
  const isNew = value.trim() !== "" && !known;

  return (
    <ComboBox
      allowsCustomValue
      fullWidth
      inputValue={value}
      isInvalid={Boolean(error)}
      menuTrigger="input"
      selectedKey={known ?? null}
      variant="secondary"
      onInputChange={onChange}
      onSelectionChange={(key) => {
        if (key !== null) {
          onChange(String(key));
        }
      }}
    >
      <Label>Project</Label>
      <ComboBox.InputGroup>
        <Input autoComplete="off" placeholder="Choose or type a project" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {projects.map((project) => (
            <ListBox.Item key={project} id={project} textValue={project}>
              <ProjectLabel project={project} />
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
      {isNew && !error ? <Description>New project, created with this entry.</Description> : null}
      <FieldError>{error}</FieldError>
    </ComboBox>
  );
}
