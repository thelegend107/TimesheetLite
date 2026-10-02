import { ComboBox, Description, FieldError, Input, Label, ListBox } from "@heroui/react";
import type { Ref } from "react";
import { formatTime, timeMatchesQuery } from "../lib/time";

export type TimeOption = { minutes: number; hint?: string };

type TimeComboBoxProps = {
  label: string;
  value: string;
  options: TimeOption[];
  placeholder: string;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (text: string) => void;
  onCommit: (text: string) => void;
};

export function TimeComboBox({ label, value, options, placeholder, error, hint, autoFocus, inputRef, onChange, onCommit }: TimeComboBoxProps) {
  const selected = options.find((option) => formatTime(option.minutes) === value);

  return (
    <ComboBox
      allowsCustomValue
      fullWidth
      autoFocus={autoFocus}
      defaultFilter={timeMatchesQuery}
      inputValue={value}
      isInvalid={Boolean(error)}
      menuTrigger="manual"
      selectedKey={selected ? String(selected.minutes) : null}
      variant="secondary"
      onBlur={() => onCommit(value)}
      onInputChange={onChange}
      onSelectionChange={(key) => {
        const picked = options.find((option) => String(option.minutes) === String(key));

        if (picked) {
          onChange(formatTime(picked.minutes));
        }
      }}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <Input ref={inputRef} autoComplete="off" placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.minutes} id={String(option.minutes)} textValue={formatTime(option.minutes)}>
              <Label>{formatTime(option.minutes)}</Label>
              {option.hint ? <Description>{option.hint}</Description> : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
      {hint && !error ? <Description>{hint}</Description> : null}
      <FieldError>{error}</FieldError>
    </ComboBox>
  );
}
