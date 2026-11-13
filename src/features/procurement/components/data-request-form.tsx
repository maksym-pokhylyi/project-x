"use client";

import { useActionState } from "react";
import { FormError, FormField } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDataRequestAction, type DataRequestState } from "../actions";

/** "Request a correction or removal". Labels above fields, errors as text next to the field. */
export function DataRequestForm({ defaultPage, supportEmail }: { defaultPage: string; supportEmail: string }) {
  const [state, formAction, pending] = useActionState<DataRequestState, FormData>(submitDataRequestAction, { status: "idle" });
  const fieldErrors = state.status === "error" ? ((state.error.details?.fieldErrors as Record<string, string[]> | undefined) ?? {}) : {};

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm" data-testid="data-request-sent">
        <p className="font-medium">Thank you — we have your request.</p>
        <p className="mt-1 text-muted-foreground">We reply within five working days. If it is urgent, write to {supportEmail}.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate data-testid="data-request-form">
      {state.status === "error" && Object.keys(fieldErrors).length === 0 ? <FormError message={state.error.message} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="data-request-kind">What do you need?</Label>
        <NativeSelect id="data-request-kind" name="kind" defaultValue="correction">
          <option value="correction">Correct something on a page</option>
          <option value="removal">Remove a page</option>
          <option value="other">Something else</option>
        </NativeSelect>
      </div>
      <FormField label="Your email address" name="email" type="email" autoComplete="email" required error={fieldErrors.email?.[0]} hint="Only used to reply to this request." />
      <FormField label="Company or organisation" name="organisationName" autoComplete="organization" error={fieldErrors.organisationName?.[0]} />
      <FormField label="Page address" name="pageUrl" defaultValue={defaultPage} hint="The page the request is about, if any." error={fieldErrors.pageUrl?.[0]} />
      <div className="space-y-1.5">
        <Label htmlFor="data-request-message">What should change?</Label>
        <Textarea id="data-request-message" name="message" rows={5} required aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? "data-request-message-error" : undefined} />
        {fieldErrors.message ? (
          <p id="data-request-message-error" className="text-sm text-destructive">
            {fieldErrors.message[0]}
          </p>
        ) : null}
      </div>
      {/* Honeypot: hidden from people and assistive technology. */}
      <div aria-hidden className="hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
