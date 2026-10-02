import { ComboBox, FieldError, Input, Label, ListBox } from "@heroui/react";
import type { Ref } from "react";

type TaskFieldProps = { value: string; suggestions: string[]; error?: string; inputRef?: Ref<HTMLInputElement>; onChange: (value: string) => void };

export function TaskField({ value, suggestions, error, inputRef, onChange }: TaskFieldProps) {
  return (
    <ComboBox
      allowsCustomValue
      fullWidth
      defaultFilter={() => true}
      inputValue={value}
      isInvalid={Boolean(error)}
      menuTrigger="input"
      selectedKey={null}
      variant="secondary"
      onInputChange={onChange}
      onSelectionChange={(key) => {
        if (key !== null) {
          onChange(String(key));
        }
      }}
    >
      <Label>Task</Label>
      <ComboBox.InputGroup>
        <Input ref={inputRef} autoComplete="off" placeholder="What did you work on?" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {suggestions.map((suggestion) => (
            <ListBox.Item key={suggestion} id={suggestion} textValue={suggestion}>
              {suggestion}
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
      <FieldError>{error}</FieldError>
    </ComboBox>
  );
}
