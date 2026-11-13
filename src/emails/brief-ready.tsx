import { Button, Heading, Text } from "@react-email/components";
import { site } from "@/config/site";
import { EmailLayout, emailStyles } from "./layout";

export type BriefReadyProps = {
  name: string;
  bidTitle: string;
  buyerName: string | null;
  /** e.g. "Closes 22 Nov 2026, 12:00" — only when the pack states a deadline. */
  deadline: string | null;
  verdict: string | null;
  requirements: number;
  passFail: number;
  questions: number;
  /** Cited items whose quote was found in the documents, out of all cited items. */
  citations: { verified: number; total: number };
  url: string;
};

export function briefReadySubject(props: Pick<BriefReadyProps, "bidTitle">) {
  return `Your cited bid check is ready: ${props.bidTitle}`;
}

export function BriefReady({ name, bidTitle, buyerName, deadline, verdict, requirements, passFail, questions, citations, url }: BriefReadyProps) {
  const toCheck = citations.total - citations.verified;
  return (
    <EmailLayout preview={`${requirements} requirements and ${questions} questions found in ${bidTitle}.`}>
      <Heading style={emailStyles.heading}>Your cited bid check is ready</Heading>
      <Text style={emailStyles.paragraph}>
        Hi {name || "there"}, we have read the tender pack for <strong>{bidTitle}</strong>
        {buyerName ? ` (${buyerName})` : ""}.
      </Text>
      <Text style={emailStyles.paragraph}>
        {deadline ? (
          <>
            {deadline}
            <br />
          </>
        ) : null}
        {requirements} requirement{requirements === 1 ? "" : "s"} found, {passFail} of them pass/fail
        <br />
        {questions} question{questions === 1 ? "" : "s"} to answer
        <br />
        {citations.verified} of {citations.total} quotes found in your documents
        {toCheck > 0 ? ` — ${toCheck} marked “Verify in documents”` : ""}
        {verdict ? (
          <>
            <br />
            Our cautious read: {verdict}
          </>
        ) : null}
      </Text>
      <Button href={url} style={emailStyles.button}>
        Open the check
      </Button>
      <Text style={emailStyles.muted}>
        AI-assisted analysis. Check against the tender documents — you remain responsible for your submission.
        <br />
        If the button does not work, copy this link into your browser: {url}
        <br />
        {site.name} is independent of the buyer and of government.
      </Text>
    </EmailLayout>
  );
}
