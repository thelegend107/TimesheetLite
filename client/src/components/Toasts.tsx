import { Toast } from "@heroui/react";
import { useNarrowScreen } from "../lib/useNarrowScreen";

export function Toasts() {
  const narrow = useNarrowScreen();

  return <Toast.Provider placement={narrow ? "top" : "bottom end"} />;
}
