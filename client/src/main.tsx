import { I18nProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Toasts } from "./components/Toasts";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider locale="en-US">
      <QueryClientProvider client={queryClient}>
        <App />
        <Toasts />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
