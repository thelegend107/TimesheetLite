import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClockifyStatus } from "../api/types";
import { IssueAlert } from "./ClockifyDialog";

const status = (issue: ClockifyStatus["issue"], message: string | null, connection: ClockifyStatus["connection"] = "None"): ClockifyStatus => ({ issue, message, account: null, projects: [], mappings: [], connection });

const show = (value: ClockifyStatus) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <IssueAlert isBusy={false} status={value} onCheck={vi.fn()} />
    </QueryClientProvider>,
  );

const reply = (body: unknown, code = 200) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } }));

afterEach(() => vi.restoreAllMocks());

describe("Clockify setup problems", () => {
  it("offers to connect with an API key when nothing is connected", () => {
    show(status("NotConfigured", "Clockify is not connected."));

    expect(screen.getByRole("heading", { name: "Connect Clockify" })).toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(screen.queryByText(/Clockify__ApiKey/)).not.toBeInTheDocument();
  });

  it("shows the real cause and no key form when the key is fine but a setting is wrong", () => {
    show(status("NotConfigured", 'The time zone "Mars/Olympus" is not available on this server. Set Clockify__TimeZone to a valid IANA id.', "App"));

    expect(screen.getByText(/Mars\/Olympus/)).toBeInTheDocument();
    expect(screen.getByText("Fix that setting, then restart the app.")).toBeInTheDocument();
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
  });

  it("offers a new key when Clockify rejects the current one, without repeating the title", () => {
    show(status("Unauthorized", "Clockify rejected the API key.", "App"));

    expect(screen.getAllByText(/Clockify rejected the API key/)).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Connect a new API key" })).toBeInTheDocument();
  });

  it("offers to reconnect when the saved key can no longer be decrypted", () => {
    show(status("Unreadable", "The stored Clockify key cannot be read, usually because the encryption keys changed. Connect Clockify again.", "App"));

    expect(screen.getByText("The saved Clockify key cannot be read")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect a new API key" })).toBeInTheDocument();
  });

  it("keeps the pasted key out of the mutation cache once connected", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const user = userEvent.setup();

    reply(status("None", null, "App"));
    const view = render(
      <QueryClientProvider client={client}>
        <IssueAlert isBusy={false} status={status("NotConfigured", "Clockify is not connected.")} onCheck={vi.fn()} />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText("API key"), "secret-key");
    await user.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(JSON.stringify(client.getMutationCache().getAll().map((m) => m.state.variables))).not.toContain("secret-key");
  });

  it("explains that a key connected here takes priority over the server setting", () => {
    show(status("Unauthorized", "Clockify rejected the API key.", "Environment"));

    expect(screen.getByText(/takes priority/)).toBeInTheDocument();
  });

  it("sends the pasted key trimmed to the server", async () => {
    const fetchSpy = reply(status("None", null, "App"));
    const user = userEvent.setup();

    show(status("NotConfigured", "Clockify is not connected."));
    await user.type(screen.getByLabelText("API key"), "  secret-key  ");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const [url, init] = fetchSpy.mock.calls[0] ?? [];

    expect(url).toBe("/api/clockify/connection");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ apiKey: "secret-key" });
  });

  it("shows Clockify's rejection on the key field and clears it when the key changes", async () => {
    reply({ title: "One or more validation errors occurred.", errors: { apiKey: ["Clockify rejected this API key. Copy it again from Profile settings, API."] } }, 400);
    const user = userEvent.setup();

    show(status("NotConfigured", "Clockify is not connected."));
    await user.type(screen.getByLabelText("API key"), "wrong");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText(/Clockify rejected this API key/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("API key"), "x");

    expect(screen.queryByText(/Clockify rejected this API key/)).not.toBeInTheDocument();
  });
});
