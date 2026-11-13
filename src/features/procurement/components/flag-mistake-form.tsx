"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { FieldError, FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitDataRequestAction, type DataRequestState } from "../actions";
import { DATA_ISSUES } from "../domain/data-requests";
import { RadioChoices, RadioRow, TickRow } from "./ui/choice";
import { controlSize } from "./ui/control-size";

/**
 * "Flag a mistake", as the FlagMistake artboards draw it: which page, what is wrong, what it
 * should say, and who is asking. Public; the Server Action behind "Send request" is
 * rate-limited and stores a request for a person to review — nothing on any page changes
 * by sending it.
 *
 * After it is sent the form gives way to "Thanks — we have your request". A form that comes
 * back with an error keeps every answer.
 */
const INITIAL: DataRequestState = { status: "idle" };

export function FlagMistakeForm({
  page,
  pageAddress,
  backHref,
}: {
  /** Path of the page the request is about, when the visitor came from one. */
  page: string | null;
  /** The same page as people know it: "bidfolio.co.uk/suppliers/acme-ltd-01234567". */
  pageAddress: string | null;
  /** Where "Cancel" and "Back to the page" lead. */
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(submitDataRequestAction, INITIAL);
  const textId = useId();
  const linkId = useId();
  const pageId = useId();
  const height = controlSize.form;

  if (state.status === "sent") {
    return (
      <section aria-labelledby="flag-sent-h" className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-5 md:p-7" role="status" data-testid="flag-sent">
        <h2 id="flag-sent-h" className="type-h3 text-ink">
          Thanks — we have your request
        </h2>
        <p className="max-w-[35rem] text-base text-ink">We will reply to your work email within five working days. Nothing changes on the page until a person has checked it.</p>
        <ButtonLink variant="outline" href={state.page ?? backHref} className={cn(height, "mt-2")}>
          Back to the page
        </ButtonLink>
      </section>
    );
  }

  const values = state.status === "error" ? state.values : {};
  const fieldErrors = state.status === "error" ? ((state.error.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors ?? {}) : {};
  const formError = state.status === "error" && Object.keys(fieldErrors).length === 0 ? state.error.message : null;

  return (
    <form
      key={state.status === "error" ? state.attempt : 0}
      action={formAction}
      aria-label="Your request"
      className="flex flex-col gap-6 rounded-card border border-line bg-surface p-5 max-md:pb-2 md:p-7"
      noValidate
      data-testid="flag-form"
    >
      <FormError message={formError} />
      <div className="max-w-[30rem]">
        {page ? (
          // The page is known (the visitor came from it): shown as text that wraps, not as a field that would cut a long address.
          <div className="flex flex-col gap-2">
            <input type="hidden" name="page" value={page} />
            <p id={pageId} className="text-sm leading-5 font-semibold text-ink">
              Page
            </p>
            <p aria-labelledby={pageId} className="rounded-control border border-line bg-paper-deep px-3.5 py-3 font-mono text-sm leading-6 text-ink [overflow-wrap:anywhere]" data-testid="flag-page">
              {pageAddress ?? page}
            </p>
          </div>
        ) : (
          <FormField label="Page" name="page" defaultValue={values.page} placeholder="bidfolio.co.uk/suppliers/your-company" hint="Paste the address of the page your request is about." className={cn(height, "font-mono text-15")} />
        )}
      </div>

      <RadioChoices legend="What is wrong?" name="issue" defaultValue={values.issue || undefined} error={fieldErrors.issue?.[0]} aria-label="What is wrong?">
        {DATA_ISSUES.map((issue) => (
          <RadioRow key={issue.key} value={issue.key} className="self-start">
            {issue.label}
          </RadioRow>
        ))}
      </RadioChoices>

      <div className="max-w-[35rem]">
        <FormField label="Which contract or detail?" name="detail" defaultValue={values.detail} maxLength={500} error={fieldErrors.detail?.[0]} className={height} />
      </div>

      <div className="flex max-w-[35rem] flex-col gap-2">
        <Label htmlFor={textId}>What should it say?</Label>
        <Textarea
          id={textId}
          name="correction"
          rows={4}
          defaultValue={values.correction}
          maxLength={4000}
          aria-invalid={fieldErrors.correction ? true : undefined}
          aria-describedby={fieldErrors.correction ? `${textId}-error` : undefined}
          className="py-3 leading-6"
        />
        {fieldErrors.correction?.[0] ? <FieldError id={`${textId}-error`}>{fieldErrors.correction[0]}</FieldError> : null}
      </div>

      <div className="flex max-w-[35rem] flex-col gap-2">
        <Label htmlFor={linkId}>
          <span>
            A link that shows it, if you have one <span className="font-normal text-ink-2">· optional</span>
          </span>
        </Label>
        <Input
          id={linkId}
          name="evidence"
          type="url"
          inputMode="url"
          defaultValue={values.evidence}
          aria-invalid={fieldErrors.evidence ? true : undefined}
          aria-describedby={fieldErrors.evidence ? `${linkId}-error` : undefined}
          className={height}
        />
        {fieldErrors.evidence?.[0] ? <FieldError id={`${linkId}-error`}>{fieldErrors.evidence[0]}</FieldError> : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        <div className="grid max-w-[45rem] grid-cols-[repeat(auto-fit,minmax(min(16.25rem,100%),1fr))] gap-x-6 gap-y-4">
          <FormField label="Your name" name="name" autoComplete="name" defaultValue={values.name} required error={fieldErrors.name?.[0]} className={height} />
          <FormField label="Work email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={values.email} required error={fieldErrors.email?.[0]} className={height} />
        </div>
        <div className="flex flex-col">
          <TickRow name="authorised" defaultChecked={values.authorised === "on"} aria-invalid={fieldErrors.authorised ? true : undefined} className="self-start">
            I work for this company or act for it
          </TickRow>
          {fieldErrors.authorised?.[0] ? <FieldError>{fieldErrors.authorised[0]}</FieldError> : null}
        </div>
      </div>

      {/* Honeypot: hidden from people, tempting to scripts. */}
      <div aria-hidden className="hidden">
        <FormField label="Website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* A phone reads: the button, what happens to the request, then the way out; a desk keeps Cancel beside the button. */}
      <div className="flex flex-col gap-x-6 gap-y-2 md:flex-row md:flex-wrap md:items-center">
        <Button type="submit" loading={pending} className={cn(height, "px-[1.375rem] text-base")} data-testid="flag-submit">
          Send request
        </Button>
        <p className="text-13 text-ink-2 max-md:pt-1 max-md:text-center md:order-last md:basis-full md:text-sm">We reply to your work email. We do not publish who asked.</p>
        <Link href={backHref} className="link inline-flex min-h-11 items-center rounded-sm text-sm max-md:self-center">
          Cancel
        </Link>
      </div>
    </form>
  );
}
