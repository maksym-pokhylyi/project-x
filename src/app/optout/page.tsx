import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { site } from "@/config/site";
import { outreachConfig } from "@/features/outreach/config";
import { confirmOptOutAction, optOutByAddressAction, requestFollowUpAction } from "@/features/outreach/optout-actions";
import { getOptOutView, type FollowUpKind } from "@/features/outreach/server/optout";
import { OGL_URL } from "@/features/procurement/config";

export const metadata: Metadata = {
  title: "Stop e-mails",
  description: `Stop e-mails from ${site.name} to a business address.`,
  alternates: { canonical: "/optout" },
  robots: { index: false, follow: false },
};

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

const ERRORS: Record<string, string> = {
  rate: "Too many requests from your network just now, so nothing was changed. Please try again in an hour — or reply “stop” to our e-mail, which works just as well.",
  failed: "Something went wrong on our side and nothing was changed. Please try again, or reply “stop” to our e-mail.",
  email: "Enter the e-mail address in full, for example info@yourcompany.co.uk.",
  link: "We could not match that link — a mail program may have cut it short. Enter the address we wrote to instead.",
};

function ErrorNote({ code }: { code: string }) {
  const message = ERRORS[code];
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="optout-error">
      {message}
    </p>
  );
}

function Shell({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6">{children}</CardContent>
    </Card>
  );
}

/** The form for someone without a working link. The answer is the same for every address. */
function AddressForm({ error }: { error: string }) {
  return (
    <Shell title={`Stop e-mails from ${site.name}`} testId="optout-form">
      <ErrorNote code={error} />
      <p>Enter the address we wrote to and we will not e-mail it again.</p>
      <form action={optOutByAddressAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="optout-email">E-mail address</Label>
          <Input id="optout-email" name="email" type="email" required autoComplete="email" maxLength={254} aria-invalid={error === "email" ? true : undefined} />
        </div>
        <Button type="submit">Stop e-mails to this address</Button>
      </form>
      <p className="text-muted-foreground">
        We answer in the same way for every address, so this page cannot be used to find out who we have written to. You can also reply “stop” to any e-mail from us.
      </p>
    </Shell>
  );
}

const FOLLOW_UP_COPY: Record<FollowUpKind, { button: string; explain: (company: string) => string; requested: string }> = {
  hide_page: {
    button: "Also hide my company page",
    explain: (company) => `We take down the public page about ${company} within five working days.`,
    requested: "You have asked us to hide the company page. We will do it within five working days.",
  },
  delete_details: {
    button: "Delete the contact details you hold",
    explain: () => "We delete the address from our copy of the notices and keep it only on the do-not-contact list, which is what stops us writing to it again.",
    requested: "You have asked us to delete the contact details. We will do it within five working days.",
  },
};

/**
 * Public opt-out page. OPENING IT CHANGES NOTHING — mail scanners and link previews follow
 * the links in a letter. Only the button (a POST) stops the e-mails. The page names the
 * company the letter was about, never the address. No script is needed and no cookie is set.
 */
export default async function OptOutPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const code = one(params.c);
  const error = one(params.error);

  if (!code) {
    if (one(params.done) === "1") {
      return (
        <Shell title="Done. We will not e-mail that address again." testId="optout-form-done">
          <p>The address is on our do-not-contact list. You do not need to do anything else.</p>
          <p className="text-muted-foreground">
            If we wrote to more than one address at your company, do the same for each — or reply “stop” to our e-mail and we will remove the whole company.{" "}
            <Link href="/optout" className="underline underline-offset-4">
              Stop another address
            </Link>
          </p>
        </Shell>
      );
    }
    return <AddressForm error={error} />;
  }

  const view = await getOptOutView(code);
  if (view.state === "unknown") return <AddressForm error={error || "link"} />;

  if (view.state === "pending") {
    return (
      <Shell title={`Stop e-mails from ${site.name}`} testId="optout-confirm">
        <ErrorNote code={error} />
        <p>
          We wrote to an address that a public contract notice gives for <strong>{view.company}</strong>. Press the button and we will not e-mail that address again.
        </p>
        <form action={confirmOptOutAction}>
          <input type="hidden" name="c" value={code} />
          <Button type="submit" size="lg" data-testid="optout-button">
            Stop e-mails to this address
          </Button>
        </form>
        <p className="text-muted-foreground">Nothing changes until you press the button.</p>
      </Shell>
    );
  }

  const followUps = (Object.keys(FOLLOW_UP_COPY) as FollowUpKind[]).filter((kind) => kind !== "hide_page" || view.pagePublic);
  return (
    <div className="space-y-6">
      <Shell title="Done. We will not e-mail this address again." testId="optout-done">
        <ErrorNote code={error} />
        <p>
          The address is on our do-not-contact list, and we will not contact <strong>{view.company}</strong> again. You do not need to do anything else.
        </p>
      </Shell>

      <Card data-testid="optout-held">
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">What we hold about {view.company}, and why</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The public contract notices that name the company as a supplier — buyer, contract title, value and dates — as published on Find a Tender under the{" "}
              <a href={OGL_URL} className="underline underline-offset-4">
                Open Government Licence v3.0
              </a>
              . We built a page about the company from them
              {view.pagePublic ? (
                <>
                  :{" "}
                  <Link href={`/suppliers/${view.supplierSlug}`} className="underline underline-offset-4">
                    see the page
                  </Link>
                </>
              ) : null}
              .
            </li>
            <li>
              The contact address those notices give for the company. We used it to tell the company that the page exists, and for nothing else. It is now kept only so that we never write to it
              again.
            </li>
          </ul>
          <p className="text-muted-foreground">
            We do not hold a contact name or a telephone number. More in our{" "}
            <Link href={outreachConfig.privacyNoticePath} className="underline underline-offset-4">
              privacy notice
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card data-testid="optout-more">
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">If you want more than that</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          {view.addressErased ? (
            <p>
              The contact details we held have already been deleted. To have the company page corrected or taken down, use the{" "}
              <Link href={`/about-the-data?page=${encodeURIComponent(`/suppliers/${view.supplierSlug}`)}#request`} className="underline underline-offset-4">
                request form
              </Link>
              .
            </p>
          ) : (
            followUps.map((kind) => {
              const copy = FOLLOW_UP_COPY[kind];
              return view.requested[kind] ? (
                <p key={kind} role="status" data-testid={`optout-requested-${kind}`}>
                  {copy.requested}
                </p>
              ) : (
                <form key={kind} action={requestFollowUpAction} className="space-y-1.5">
                  <input type="hidden" name="c" value={code} />
                  <input type="hidden" name="kind" value={kind} />
                  <Button type="submit" variant="outline" data-testid={`optout-request-${kind}`}>
                    {copy.button}
                  </Button>
                  <p className="text-muted-foreground">{copy.explain(view.company)}</p>
                </form>
              );
            })
          )}
          <p className="text-muted-foreground">
            Both are optional. To complain about how we used your details, see the{" "}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              privacy notice
            </Link>{" "}
            or write to {site.supportEmail}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
