import { Display, Moon, Sun } from "@gravity-ui/icons";
import { Button, Dropdown, Label, type Selection } from "@heroui/react";
import type { ResolvedTheme, ThemePreference } from "../lib/theme";

const OPTIONS: { id: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { id: "system", label: "System", Icon: Display },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

type ThemeMenuProps = { preference: ThemePreference; resolved: ResolvedTheme; onChange: (preference: ThemePreference) => void };

export function ThemeMenu({ preference, resolved, onChange }: ThemeMenuProps) {
  const TriggerIcon = resolved === "dark" ? Moon : Sun;

  const select = (keys: Selection) => {
    const [key] = keys === "all" ? [] : [...keys];

    if (key === "system" || key === "light" || key === "dark") {
      onChange(key);
    }
  };

  return (
    <Dropdown>
      <Button isIconOnly aria-label="Theme" className="max-md:min-h-11 max-md:min-w-11" size="sm" variant="tertiary">
        <TriggerIcon />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label="Theme" selectedKeys={new Set([preference])} selectionMode="single" onSelectionChange={select}>
          {OPTIONS.map(({ id, label, Icon }) => (
            <Dropdown.Item key={id} id={id} textValue={label}>
              <Icon />
              <Label>{label}</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
