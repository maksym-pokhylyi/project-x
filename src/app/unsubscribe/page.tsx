import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { HeaderSessionLink } from "@/components/marketing/header-session-link";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { site } from "@/config/site";
import { KIND_LABELS, type NotificationKind } from "@/features/notifications/config";
import { identityParts } from "@/features/notifications/emails/copy";
import { verifyUnsubscribeToken } from "@/features/notifications/tokens";
import { unsubscribeView, type UnsubscribeView } from "@/features/notifications/unsubscribe";

/**
 * The page behind "Unsubscribe" in a scheduled e-mail (docs/design/handoff/Unsubscribe-*).
 *
 * Opening it changes nothing — mail scanners follow links — so it first asks: one button
 * for "stop e-mails to this address" and a second choice for "only this kind". The buttons
 * are a plain form posted to /api/notifications/unsubscribe: no JavaScript, no session.
 * What is shown afterwards is read from what is stored, not from the address bar.
 *
 * The signed token in `t` is the whole credential. A token that is not ours gets one
 * answer whatever it contains, so the page cannot be used to find out who has an account.
 */
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false }, referrer: "no-referrer" };

const ENDPOINT = "/api/notifications/unsubscribe";
const SETTINGS = "/app/settings/notifications";
const navLink = "link-quiet inline-flex min-h-11 items-center rounded-sm text-sm font-medium whitespace-nowrap max-md:underline max-md:decoration-brand max-md:decoration-1 max-md:underline-offset-[3px] md:text-15";
const textButton = "link inline-flex min-h-11 cursor-pointer items-center rounded-sm text-left text-15 font-semibold";

type PageProps = { searchParams: Promise<{ t?: string | string[]; done?: string | string[] }> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = first(params.t).slice(0, 600);
  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return (
      <Frame>
        <h1 className="type-h1 text-ink">This link does not work</h1>
        <p className="type-lead mt-2.5 md:mt-3.5">
          It may be incomplete, or older than a change on our side. To stop emails, sign in and open Settings, then Notifications. Or write to{" "}
          <a href={`mailto:${site.supportEmail}`} className="link">
            {site.supportEmail}
          </a>{" "}
          and we will do it for you.
        </p>
        <div className="mt-6 flex">
          <ButtonLink href={`/sign-in?redirect=${encodeURIComponent(SETTINGS)}`} variant="outline" className="h-12 px-[1.375rem] text-base max-md:w-full">
            Sign in
          </ButtonLink>
        </div>
      </Frame>
    );
  }

  const view = await unsubscribeView(verified);
  const kind = KIND_LABELS[verified.kind].withArticle;
  const address = view.member && view.email ? <strong className="font-semibold [overflow-wrap:anywhere]">{view.email}</strong> : "this address";

  if (view.member && view.subscribed && first(params.done) === "back") {
    return (
      <Frame>
        <Tick />
        <h1 className="type-h1 mt-4 text-ink md:mt-5">You are subscribed again</h1>
        <p className="type-lead mt-2.5 md:mt-3.5">
          We will send {kind} to {address} as before.
        </p>
        <p className="mt-1.5 flex min-h-11 items-center text-15 md:mt-2">
          <Link href={SETTINGS} className="link inline-flex min-h-11 items-center font-semibold">
            Change what you get
          </Link>
        </p>
      </Frame>
    );
  }

  if (view.member && view.subscribed) {
    return (
      <Frame>
        <h1 className="type-h1 text-ink">Stop emails to this address?</h1>
        {view.email ? <p className="type-lead mt-2.5 font-semibold [overflow-wrap:anywhere] md:mt-3.5">{view.email}</p> : null}
        <form method="post" action={ENDPOINT} className="mt-6 flex flex-col items-start gap-1">
          <input type="hidden" name="t" value={token} />
          <Button type="submit" name="scope" value="all" className="h-12 px-[1.375rem] text-base max-md:w-full">
            Unsubscribe
          </Button>
          <button type="submit" name="scope" value="kind" className={`${textButton} max-md:self-center`}>
            Only stop {kind}
          </button>
        </form>
        <p className="mt-3 max-w-[35rem] text-sm text-ink-2">{whatStops(verified.kind)}</p>
      </Frame>
    );
  }

  // Unsubscribed — or no longer on the workspace, in which case nothing is sent either way.
  const everything = !view.member || view.all;
  return (
    <Frame>
      <Tick />
      <h1 className="type-h1 mt-4 text-ink md:mt-5">You are unsubscribed</h1>
      <p className="type-lead mt-2.5 md:mt-3.5">
        {everything ? <>We will not email {address} again, unless you ask us to.</> : <>We will not send {kind} to {address} again, unless you ask us to.</>}
      </p>
      {view.member ? <Mistake token={token} view={view} /> : null}
      {view.member && !view.all ? (
        <form method="post" action={ENDPOINT} className="flex min-h-11 flex-wrap items-center gap-x-1.5 text-15">
          <input type="hidden" name="t" value={token} />
          <span className="text-ink-2">Want to stop the rest as well?</span>
          <button type="submit" name="scope" value="all" className={textButton}>
            Stop all emails
          </button>
        </form>
      ) : null}

      {view.member ? (
        <section aria-labelledby="hold-title" className="mt-5 flex flex-col rounded-card border border-line bg-surface p-5 md:mt-7 md:p-7">
          <h2 id="hold-title" className={cardTitle}>
            What we hold
          </h2>
          <ul className="mt-3 flex flex-col text-15 leading-[1.55] md:mt-3.5">
            {HELD.map((line, index) => (
              <li key={line} className={`border-t border-line pt-3 md:pt-3.5 ${index === HELD.length - 1 ? "" : "pb-3 md:pb-3.5"}`}>
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="remove-title" className={`flex flex-col rounded-card border border-line bg-surface p-5 pb-2 md:p-7 ${view.member ? "mt-3 md:mt-4" : "mt-5 md:mt-7"}`}>
        <h2 id="remove-title" className={cardTitle}>
          Have it removed
        </h2>
        <p className="mt-2 text-15 leading-[1.55]">
          {view.member ? "You can delete your account, and everything in it, from Settings. " : null}
          Ask us to hide your company’s page or remove your details. We review every request and reply by email.
        </p>
        <div className="mt-4 flex flex-col gap-x-6 gap-y-1 md:flex-row md:flex-wrap md:items-center">
          <ButtonLink href="/about-the-data#request" variant="outline" className="h-12 px-[1.375rem] text-base">
            Send a request
          </ButtonLink>
          <p className="flex min-h-11 flex-wrap items-center text-sm text-ink-2 max-md:justify-center">
            <span className="mr-1">Or write to</span>
            <a href={`mailto:${site.supportEmail}`} className="link inline-flex min-h-11 items-center">
              {site.supportEmail}
            </a>
            <span>.</span>
          </p>
        </div>
      </section>
    </Frame>
  );
}

const cardTitle = "font-display text-[1.3125rem] leading-tight font-semibold text-ink md:text-[1.375rem]";

/** For an account holder. (The artboard's lines describe a contact without an account.) */
const HELD = [
  "Your account, your workspace and anything you saved stay as they are. Only the emails stop.",
  "Your email address stays on your account, with a note of this choice so that we do not write to you again.",
  "A record of the emails we sent you: which kind, when, and which tenders they listed. It is deleted after 13 months.",
];

/** The small print under the two choices: what the button stops, and what it leaves alone. */
function whatStops(kind: NotificationKind): string {
  const optional = "the weekly digest, daily alerts, deadline reminders and product emails";
  if (kind === "renewal") {
    return `Unsubscribe stops the reminder before an annual plan renews, and with it ${optional}. Sign-in links and receipts still reach you.`;
  }
  return `Unsubscribe stops ${optional}. Emails about your account still reach you: sign-in links, receipts and the reminder before an annual plan renews.`;
}

/** "Unsubscribed by mistake?" — by the link itself when it was sent to this address, otherwise through Settings. */
function Mistake({ token, view }: { token: string; view: Extract<UnsubscribeView, { member: true }> }) {
  if (!view.email) {
    return (
      <p className="mt-1.5 flex min-h-11 flex-wrap items-center gap-x-1.5 text-15 md:mt-2">
        <span className="text-ink-2">Unsubscribed by mistake?</span>
        <Link href={SETTINGS} className="link inline-flex min-h-11 items-center font-semibold">
          Sign in to turn emails back on
        </Link>
      </p>
    );
  }
  return (
    <form method="post" action={ENDPOINT} className="mt-1.5 flex min-h-11 flex-wrap items-center gap-x-1.5 text-15 md:mt-2">
      <input type="hidden" name="t" value={token} />
      <span className="text-ink-2">Unsubscribed by mistake?</span>
      <button type="submit" name="action" value="resubscribe" className={textButton}>
        Subscribe again
      </button>
    </form>
  );
}

function Tick() {
  return (
    <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-brand-tint md:size-11">
      <svg viewBox="0 0 16 16" className="size-5 md:size-[1.375rem]">
        <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand" />
      </svg>
    </div>
  );
}

/** The small-page frame of the artboard: header bar, one 640 px column, the identity line on paper-deep. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="container-content flex min-h-14 items-center justify-between gap-x-8 md:min-h-[4.5rem]">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-[1.125rem] md:gap-8">
            <Link href="/" className={navLink}>
              What is {site.name}?
            </Link>
            <HeaderSessionLink className={navLink} />
          </nav>
        </div>
      </header>
      <main id="main" className="px-5 pt-7 pb-10 md:px-6 md:pt-16 md:pb-[4.5rem]">
        <div className="mx-auto flex w-full max-w-[40rem] flex-col">{children}</div>
      </main>
      <footer className="flex-1 bg-paper-deep pt-7 pb-8 md:pt-8 md:pb-9">
        <div className="container-content">
          <p className="max-w-[61.25rem] text-13 leading-[1.6] text-ink-2">
            {identityParts().map((part, index) =>
              part.placeholder ? (
                <span key={index} className="font-mono text-xs [overflow-wrap:anywhere]">
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
