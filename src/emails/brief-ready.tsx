import { EmailAction, EmailDeadline, EmailHeading, EmailLayout, EmailList, EmailSummary, EmailSummaryLine, EmailText, emailStyles } from "./layout";
import { Text } from "@react-email/components";

/**
 * "Your bid check is ready" (design handoff: EmailCheckReady). The verdict, what was found
 * and one link. Every number comes from the finished check; a line whose value is unknown
 * is left out rather than filled in. Drawn with the parts of the e-mail frame (layout.tsx):
 * the tender between two hairlines, serif headings, findings divided by hairlines, the
 * action as a link.
 */
export type BriefReadyProps = {
  /** First name, or "" when unknown. */
  name: string;
  bidTitle: string;
  buyerName: string | null;
  /** e.g. "Closes 27 Nov 2026, 12:00 · 14 days left" — only when the pack states one deadline. */
  deadline: string | null;
  /** The cautious verdict headline, e.g. "Gaps to close". */
  verdict: string | null;
  requirements: number;
  passFail: number;
  questions: number;
  /** Cited items whose quote was found in the documents, out of all cited items. */
  citations: { verified: number; total: number };
  /** The pass-or-fail requirements by outcome of the company check. */
  gates?: { total: number; met: number; confirm: number; gaps: number };
  /** The buyer's wording of the first few gaps, shortened. */
  gapNames?: string[];
  /** Scored questions (written answers that are marked). */
  scoredQuestions?: number;
  /** e.g. "6 files, 214 pages read · 1 file not read" */
  coverage?: string | null;
  url: string;
};

export function briefReadySubject(props: Pick<BriefReadyProps, "bidTitle">) {
  return `Your bid check is ready: ${props.bidTitle}`;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function BriefReady({ name, bidTitle, buyerName, deadline, verdict, requirements, passFail, questions, citations, gates, gapNames = [], scoredQuestions, coverage, url }: BriefReadyProps) {
  const unverified = citations.total - citations.verified;
  const found: string[] = [
    gates
      ? `${plural(gates.total, "pass-or-fail requirement")}: ${gates.met} met, ${gates.confirm} for you to confirm, ${plural(gates.gaps, "gap")}`
      : `${plural(requirements, "requirement")}, ${passFail} of them pass-or-fail`,
  ];
  if (gapNames.length > 0) found.push(`${gapNames.length === 1 ? "The gap" : "The gaps"}: ${gapNames.join("; ")}`);
  found.push(scoredQuestions !== undefined ? plural(scoredQuestions, "scored question") : plural(questions, "question"));
  if (coverage) found.push(coverage);
  if (unverified > 0) found.push(`${plural(unverified, "quote")} could not be matched word for word and ${unverified === 1 ? "is" : "are"} marked for you to check`);

  return (
    <EmailLayout
      preview={`${verdict ? `${verdict}. ` : ""}${plural(gates?.total ?? passFail, "pass-or-fail requirement")} and ${plural(scoredQuestions ?? questions, "question")} found.`}
      reason="You get this because you started a bid check on Bidfolio."
    >
      <EmailText first>{name ? `${name},` : "Hello,"}</EmailText>
      <EmailText>The check on this tender pack is ready.</EmailText>

      <EmailSummary title={bidTitle}>
        {buyerName ? <EmailSummaryLine>{buyerName}</EmailSummaryLine> : null}
        {deadline ? <EmailDeadline>{deadline}</EmailDeadline> : null}
      </EmailSummary>

      {verdict ? (
        <>
          <EmailHeading>Verdict</EmailHeading>
          <EmailText style={{ margin: "6px 0 0" }}>{verdict}</EmailText>
        </>
      ) : null}

      <EmailHeading>What we found</EmailHeading>
      <EmailList items={found} />

      <EmailAction href={url}>Open the check</EmailAction>
      <EmailText style={{ margin: "6px 0 0" }}>Every requirement is quoted from the pack with its file and page.{gates && gates.gaps > 0 ? " Read the gaps first." : ""}</EmailText>
      <Text className="bf-muted" style={{ ...emailStyles.muted, margin: "16px 0 0" }}>
        AI-assisted analysis. Check against the tender documents — you remain responsible for your submission.
      </Text>
    </EmailLayout>
  );
}
