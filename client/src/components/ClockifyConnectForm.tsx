import { Button, FieldError, Form, Input, Label, Link, Spinner, TextField, toast } from "@heroui/react";
import { useState } from "react";
import { ApiError } from "../api/client";
import { useConnectClockify } from "../api/queries";

const CLOCKIFY_SETTINGS_URL = "https://app.clockify.me/user/settings";

type ClockifyConnectFormProps = { replacing: boolean };

export function ClockifyConnectForm({ replacing }: ClockifyConnectFormProps) {
  const connect = useConnectClockify();
  const [apiKey, setApiKey] = useState("");
  const error = connect.error instanceof ApiError ? (connect.error.fieldErrors.apiKey?.[0] ?? connect.error.message) : connect.error?.message;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await connect.mutateAsync(apiKey.trim());
      setApiKey("");
      toast.success("Clockify connected");
    } catch {
      return;
    }
  };

  return (
    <Form className="flex flex-col gap-4" validationBehavior="aria" validationErrors={error ? { "clockify-api-key": error } : undefined} onSubmit={submit}>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-foreground">{replacing ? "Connect a new API key" : "Connect Clockify"}</h3>
        <p className="text-sm text-muted">Clockify lets other apps connect with an API key only, however you sign in (Microsoft, Google or email). Create one once and paste it here. It is checked with Clockify and stored encrypted on the server.</p>
      </div>
      <ol className="list-decimal space-y-1 ps-5 text-sm text-muted">
        <li>
          <Link href={CLOCKIFY_SETTINGS_URL} rel="noreferrer" target="_blank">
            Open your Clockify profile settings
            <Link.Icon />
          </Link>
          , signing in the way you usually do.
        </li>
        <li>Scroll to API, press Generate and copy the key.</li>
      </ol>
      <TextField
        fullWidth
        isRequired
        name="clockify-api-key"
        type="password"
        value={apiKey}
        onChange={(value) => {
          connect.reset();
          setApiKey(value);
        }}
      >
        <Label>API key</Label>
        <Input autoComplete="off" placeholder="Paste your API key" variant="secondary" />
        <FieldError />
      </TextField>
      <div>
        <Button isDisabled={apiKey.trim() === ""} isPending={connect.isPending} type="submit" variant="primary">
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? "Checking…" : "Connect"}
            </>
          )}
        </Button>
      </div>
    </Form>
  );
}
