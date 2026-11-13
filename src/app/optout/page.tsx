import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FieldError, FormError } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { site } from "@/config/site";
import { outreachConfig, outreachSender, requestFormHref } from "@/features/outreach/config";
import { confirmOptOutAction, optOutByAddressAction } from "@/features/outreach/optout-actions";
import { getOptOutView } from "@/features/outreach/server/optout";
import { OGL_URL } from "@/features/procurement/config";

export const metadata: Metadata = {
  title: "Stop emails",
  description: `Stop emails from ${site.name} to a business address.`,
  alternates: { canonical: "/optout" },
  robots: { index: false, follow: false },
};

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

const ERRORS: Record<string, string> = {
  rate: "Too many requests from your network just now, so nothing was changed. Try again in an hour — or reply “stop” to our email, which works just as well.",
  failed: "Something went wrong on our side and nothing was changed. Try again, or reply “stop” to our email.",
  link: "We could not match that link — a mail program may have cut it short. Enter the address we wrote to instead.",
};
const EMAIL_ERROR = "Enter the email address in full, for example info@yourcompany.co.uk.";

/** The tick of the artboard: brand green on a brand-tint disc. Decorative; the headline says it. */
function Tick() {
  return (
    <div aria-hidden className="grid size-10 place-items-center rounded-full bg-brand-tint sm:size-11">
      <svg viewBox="0 0 16 16" className="size-5 fill-none stroke-brand stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round] sm:size-5.5">
        <path d="M3 8.5l3.2 3.2L13 4.8" />
      </svg>
    </div>
  );
}

/** One of the two cards of the artboard: a serif heading over its content. */
function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>
            <h2 id={id}>{title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

/**
 * "What we hold" and "Have it removed", as in the artboard. `company` and `pagePath` are
 * known only after a personal link; the version after the address form says the same to
 * everyone, whatever was typed.
 */
function WhatWeHold({ company, pagePath }: { company?: string; pagePath?: string }) {
  const contact = outreachSender().contactEmail;
  const row = "border-t border-line py-3 sm:py-3.5";
  return (
    <>
      <div className="mt-5 sm:mt-7" data-testid="optout-held">
        <Panel id="hold" title="What we hold">
          <ul className="flex flex-col text-15 text-ink">
            <li className={row}>
              {company ? `The page about ${company} is` : "A company’s page here is"} built from contract notices published on Find a Tender under the{" "}
              <a href={OGL_URL} rel="license noopener">
                Open Government Licence v3.0
              </a>
              . Those notices stay public whether or not you use {site.name}.
              {pagePath ? (
                <>
                  {" "}
                  <Link href={pagePath}>See the page</Link>.
                </>
              ) : null}
            </li>
            <li className={row}>
              {company
                ? "The contact address one of those notices gives for the company. We used it to say that the page exists. It is now on a do-not-contact list, so that we do not write to it again."
                : "The address you entered, on a do-not-contact list, so that we do not write to it. If a public notice gives it as a company’s contact address, we hold it for that reason too."}
            </li>
            <li className="border-t border-line pt-3 sm:pt-3.5">Nothing else, unless you have an account: no contact name and no telephone number.</li>
          </ul>
        </Panel>
      </div>

      <div className="mt-3 sm:mt-4" data-testid="optout-remove">
        <Panel id="remove" title="Have it removed">
          <p className="text-15 text-ink">
            Ask us to hide {company ? `the page about ${company}` : "your company’s page"} or to delete the contact address. We review every request and reply by email within five working days.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
            <ButtonLink href={requestFormHref(pagePath)} variant="outline" size="lg" className="max-sm:w-full" data-testid="optout-request">
              Send a request
            </ButtonLink>
            {contact ? (
              <p className="flex min-h-11 flex-wrap items-center text-sm text-ink-2 max-sm:w-full max-sm:justify-center">
                <span className="mr-1">Or write to</span>
                <a href={`mailto:${contact}`}>{contact}</a>
                <span>.</span>
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </>
  );
}

/** For someone without a working link: type the address. The answer is the same for every address. */
function AddressForm({ error }: { error: string }) {
  const message = ERRORS[error];
  return (
    <div data-testid="optout-form">
      <h1 className="type-h1 text-ink">Stop emails from {site.name}</h1>
      <p className="type-lead mt-2.5 text-ink sm:mt-3.5">Enter the address we wrote to and we will not email it again.</p>
      {message ? (
        <div className="mt-5" data-testid="optout-error">
          <FormError message={message} />
        </div>
      ) : null}
      <form action={optOutByAddressAction} className="mt-6 flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="optout-email">Email address</Label>
          <Input
            id="optout-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            aria-invalid={error === "email" ? true : undefined}
            aria-describedby={error === "email" ? "optout-email-error" : undefined}
          />
          {error === "email" ? <FieldError id="optout-email-error">{EMAIL_ERROR}</FieldError> : null}
        </div>
        <div>
          <Button type="submit" className="max-sm:w-full" data-testid="optout-button">
            Unsubscribe
          </Button>
        </div>
      </form>
      <p className="mt-5 text-15 text-ink-2">
        We answer in the same way for every address, so this page cannot be used to find out who we have written to. You can also reply “stop” to any email from us.
      </p>
    </div>
  );
}

/**
 * Public opt-out page ("Unsubscribed" artboard, docs/design/handoff/Unsubscribe-*, and the
 * state before it asked for in REPLY-3-to-designer §15).
 *
 * OPENING IT CHANGES NOTHING — mail scanners and link previews follow the links in a letter.
 * Only the button (a POST) stops the emails. The page names the company the letter was
 * about, never the address. It needs no script and sets no cookie.
 */
export default async function OptOutPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const code = one(params.c);
  const error = one(params.error);

  if (!code) {
    if (one(params.done) === "1") {
      return (
        <div data-testid="optout-form-done">
          <Tick />
          <h1 className="type-h1 mt-4 text-ink sm:mt-5">You are unsubscribed</h1>
          <p className="type-lead mt-2.5 text-ink sm:mt-3.5">We will not email that address again, unless you ask us to.</p>
          <p className="mt-2 text-15 text-ink-2">
            If we wrote to more than one address at your company, do the same for each — or reply “stop” to our email and we will stop writing to the whole company. <Link href="/optout">Stop another address</Link>
          </p>
          <WhatWeHold />
        </div>
      );
    }
    return <AddressForm error={error} />;
  }

  const view = await getOptOutView(code);
  if (view.state === "unknown") return <AddressForm error={error || "link"} />;

  if (view.state === "pending") {
    const message = ERRORS[error];
    return (
      <div data-testid="optout-confirm">
        <h1 className="type-h1 text-ink">Stop emails to this address?</h1>
        <p className="type-lead mt-2.5 text-ink sm:mt-3.5">
          We wrote to the address that a public contract notice gives for <strong className="font-semibold [overflow-wrap:anywhere]">{view.company}</strong>. Press the button and we will not email
          it again.
        </p>
        {message ? (
          <div className="mt-5" data-testid="optout-error">
            <FormError message={message} />
          </div>
        ) : null}
        <form action={confirmOptOutAction} className="mt-6">
          <input type="hidden" name="c" value={code} />
          <Button type="submit" size="lg" className="max-sm:w-full" data-testid="optout-button">
            Unsubscribe
          </Button>
        </form>
        <p className="mt-4 text-15 text-ink-2">Nothing changes until you press the button.</p>
      </div>
    );
  }

  return (
    <div data-testid="optout-done">
      <Tick />
      <h1 className="type-h1 mt-4 text-ink sm:mt-5">You are unsubscribed</h1>
      <p className="type-lead mt-2.5 text-ink sm:mt-3.5">
        We will not email <strong className="font-semibold [overflow-wrap:anywhere]">{view.company}</strong> again, unless you ask us to.
      </p>
      <p className="mt-2 text-15 text-ink-2">
        That covers the address we wrote to and anyone else at the company. More in our <Link href={outreachConfig.privacyNoticePath}>privacy notice</Link>.
      </p>
      <WhatWeHold company={view.company} pagePath={view.pagePublic ? `/suppliers/${view.supplierSlug}` : undefined} />
    </div>
  );
}
