import { ArrowDownToLine, CloudArrowUpIn } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import type { ResolvedTheme, ThemePreference } from "../lib/theme";
import { ThemeMenu } from "./ThemeMenu";

type AppHeaderProps = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  onThemeChange: (preference: ThemePreference) => void;
  onExport: () => void;
  onClockify: () => void;
};

export function AppHeader({ preference, resolved, onThemeChange, onExport, onClockify }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-base font-semibold">TimesheetLite</h1>
          <span className="hidden truncate text-sm text-muted sm:inline">Moe Ayoub</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button className="max-md:min-h-11" size="sm" variant="tertiary" onPress={onExport}>
            <ArrowDownToLine />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button className="max-md:min-h-11" size="sm" variant="tertiary" onPress={onClockify}>
            <CloudArrowUpIn />
            Clockify
          </Button>
          <ThemeMenu preference={preference} resolved={resolved} onChange={onThemeChange} />
        </div>
      </div>
    </header>
  );
}
