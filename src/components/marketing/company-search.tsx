import { ArrowRight } from "lucide-react";
import { landing } from "@/config/landing";
import { cn } from "@/lib/utils";

/**
 * "Find your company's page" — the one call to action of the public site. A plain GET form:
 * it works before any script has loaded and sends the visitor to /find?q=…
 * The field and the button are 52 px tall; on phones the button takes the full width.
 * Pass a distinct `id` for each instance on a page (it links the label to the field).
 */
export function CompanySearch({ id, className, children }: { id: string; className?: string; children?: React.ReactNode }) {
  const { search } = landing;
  return (
    <form action={search.action} method="get" role="search" aria-label="Find your company" className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm leading-5 font-semibold text-ink">
        {search.label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="q"
          type="search"
          required
          autoComplete="organization"
          enterKeyHint="search"
          spellCheck={false}
          placeholder={search.placeholder}
          className="h-[3.25rem] min-w-0 shrink-0 rounded-control border border-line-strong bg-surface px-3.5 text-base text-ink transition-colors duration-150 ease-out placeholder:text-sm placeholder:text-ink-2 hover:border-ink focus-visible:border-brand sm:flex-1 sm:basis-64 sm:placeholder:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          className="inline-flex h-[3.25rem] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-[1.375rem] text-base font-semibold whitespace-nowrap text-white transition-colors duration-150 ease-out hover:bg-brand-hover active:bg-brand-hover"
        >
          {search.submit}
          <ArrowRight aria-hidden className="size-4" strokeWidth={2.2} />
        </button>
      </div>
      {children}
    </form>
  );
}
