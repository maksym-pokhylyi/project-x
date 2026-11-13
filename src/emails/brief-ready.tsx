import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

/**
 * "Your bid check is ready" (design handoff: EmailCheckReady). The verdict, what was found
 * and one link. Every number comes from the finished check; a line whose value is unknown
 * is left out rather than filled in.
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
const label = { fontSize: 12, fontWeight: 600, color: "#78716c", letterSpacing: "0.04em", textTransform: "uppercase" as const, margin: "20px 0 4px" };
const title = { fontSize: 18, fontWeight: 700, color: "#1c1917", lineHeight: "26px", margin: "0 0 4px" };
const line = { ...emailStyles.paragraph, margin: "0 0 4px" };

export function BriefReady({ name, bidTitle, buyerName, deadline, verdict, requirements, passFail, questions, citations, gates, gapNames = [], scoredQuestions, coverage, url }: BriefReadyProps) {
  const unverified = citations.total - citations.verified;
  return (
    <EmailLayout preview={`${verdict ? `${verdict}. ` : ""}${plural(gates?.total ?? passFail, "pass-or-fail requirement")} and ${plural(scoredQuestions ?? questions, "question")} found.`}>
      <Text style={emailStyles.paragraph}>{name ? `${name},` : "Hello,"}</Text>
      <Text style={emailStyles.paragraph}>The check on this tender pack is ready.</Text>
      <Text style={title}>{bidTitle}</Text>
      {buyerName ? <Text style={line}>{buyerName}</Text> : null}
      {deadline ? <Text style={line}>{deadline}</Text> : null}

      {verdict ? (
        <>
          <Text style={label}>Verdict</Text>
          <Text style={{ ...title, fontSize: 16 }}>{verdict}</Text>
        </>
      ) : null}

      <Text style={label}>What we found</Text>
      {gates ? (
        <Text style={line}>
          {plural(gates.total, "pass-or-fail requirement")}: {gates.met} met, {gates.confirm} for you to confirm, {plural(gates.gaps, "gap")}
        </Text>
      ) : (
        <Text style={line}>
          {plural(requirements, "requirement")}, {passFail} of them pass-or-fail
        </Text>
      )}
      {gapNames.length > 0 ? (
        <Text style={line}>
          {gapNames.length === 1 ? "The gap" : "The gaps"}: {gapNames.join("; ")}
        </Text>
      ) : null}
      <Text style={line}>{scoredQuestions !== undefined ? plural(scoredQuestions, "scored question") : plural(questions, "question")}</Text>
      {coverage ? <Text style={line}>{coverage}</Text> : null}
      {unverified > 0 ? (
        <Text style={line}>
          {plural(unverified, "quote")} could not be matched word for word and {unverified === 1 ? "is" : "are"} marked for you to check
        </Text>
      ) : null}

      <Button href={url} style={{ ...emailStyles.button, margin: "20px 0 0" }}>
        Open the check
      </Button>
      <Text style={{ ...emailStyles.paragraph, margin: "16px 0 0" }}>Every requirement is quoted from the pack with its file and page.{gates && gates.gaps > 0 ? " Read the gaps first." : ""}</Text>
      <Text style={emailStyles.muted}>
        AI-assisted analysis. Check against the tender documents — you remain responsible for your submission.
        <br />
        You get this because you started a bid check on Bidfolio. If the button does not work, copy this link into your browser: {url}
      </Text>
    </EmailLayout>
  );
}
