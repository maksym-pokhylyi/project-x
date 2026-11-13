import { identity } from "@/config/site";
import { cn } from "@/lib/utils";

/** A link inside the muted identity line: it keeps the line's grey and takes a quiet underline. */
const quietLink = "underline decoration-line-strong decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-ink hover:decoration-brand";

/**
 * The identity line under every public page: who operates the service, how to reach them,
 * the UK representative, payments, the data licence and the independence statement.
 * Every word comes from src/config/site.ts (`identity`); e-mails print the same line.
 */
export function IdentityLine({ className }: { className?: string }) {
  const { contact, licence } = identity;
  return (
    <p data-testid="site-identity" className={cn("max-w-[61.25rem] text-13 leading-[1.6] text-ink-2", className)}>
      {identity.operator} {contact.label}{" "}
      <a href={`mailto:${contact.email}`} className={quietLink}>
        {contact.email}
      </a>{" "}
      · {identity.ukRepresentative} · {identity.payments} · {licence.before}
      <a href={licence.url} rel="license noopener" className={quietLink}>
        {licence.name}
      </a>
      {licence.after} · {identity.independence}
    </p>
  );
}
