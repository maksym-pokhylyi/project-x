/**
 * "Flag a mistake": what somebody can ask us to correct or hide on a page built from
 * notices (PURE, shared by the form and the Server Action).
 *
 * The request is stored as a `data_requests` row: `kind` is "correction" or "removal", and
 * the answers are written into its message as labelled lines, so the table needs no column
 * per question and a person can read the request as it was made.
 */
export const DATA_ISSUES = [
  { key: "not_ours", label: "A contract here is not ours", kind: "correction" },
  { key: "missing", label: "A contract of ours is missing", kind: "correction" },
  { key: "details", label: "Company details are wrong", kind: "correction" },
  { key: "hide_detail", label: "Hide a detail on this page", kind: "removal" },
  { key: "hide_page", label: "Hide the whole page", kind: "removal" },
] as const;

export type DataIssueKey = (typeof DATA_ISSUES)[number]["key"];

export const DATA_ISSUE_KEYS = DATA_ISSUES.map((issue) => issue.key) as [DataIssueKey, ...DataIssueKey[]];

export function dataIssue(key: string): (typeof DATA_ISSUES)[number] | null {
  return DATA_ISSUES.find((issue) => issue.key === key) ?? null;
}

/**
 * The page a request is about, as a path on this site ("/suppliers/acme-ltd-01234567").
 * Accepts the path, or an address that contains it ("bidfolio.co.uk/suppliers/…", a pasted
 * link with a query string); anything else is dropped.
 */
export function cleanPagePath(value: string | null | undefined): string | null {
  const match = /\/(suppliers|buyers|tenders)\/[A-Za-z0-9._~-]{1,200}(?=$|[?#/\s])/.exec((value ?? "").trim());
  return match ? match[0] : null;
}

export type DataRequestAnswers = {
  issue: DataIssueKey;
  page: string | null;
  detail: string;
  correction: string;
  evidence: string;
  name: string;
  actsForCompany: boolean;
};

/** The stored message: one labelled line per answer, empty answers left out. */
export function composeDataRequest(answers: DataRequestAnswers): string {
  const lines: Array<[string, string]> = [
    ["What is wrong", dataIssue(answers.issue)?.label ?? answers.issue],
    ["Which contract or detail", answers.detail],
    ["What it should say", answers.correction],
    ["Link that shows it", answers.evidence],
    ["Asked by", answers.name],
    ["Works for or acts for the company", answers.actsForCompany ? "Yes (ticked)" : "No"],
  ];
  return lines
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value.trim()}`)
    .join("\n");
}
