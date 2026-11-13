/**
 * The words around the "Flag a mistake" form, as the FlagMistake artboards draw them: what
 * the page is for, and what happens after a request is sent. (The form itself needs the
 * browser: flag-mistake-form.tsx.)
 */
export function FlagMistakeIntro() {
  return (
    <header className="flex flex-col gap-3.5">
      <h1 className="type-h1 text-ink">Flag a mistake</h1>
      <p className="max-w-[45rem] text-15 text-ink md:type-reading">
        Pages are built from notices on Find a Tender, and notices can be wrong. Tell us what to correct or hide. A person reviews every request; nothing changes on the page until we have checked it.
      </p>
    </header>
  );
}

const STEPS = ["We check the notice on Find a Tender.", "We correct or hide what is wrong.", "We email you what we did."];

export function FlagMistakeAside() {
  return (
    <aside aria-labelledby="flag-next-h" className="flex min-w-0 flex-col lg:w-80 lg:shrink lg:pt-7">
      <h2 id="flag-next-h" className="type-h3 text-ink">
        What happens next
      </h2>
      <ol className="mt-3.5 flex flex-col text-15 text-ink">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-baseline gap-3.5 border-t border-line py-3.5">
            <span aria-hidden className="shrink-0 font-mono text-13 text-ink-2">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
