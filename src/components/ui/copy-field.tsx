"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { ControlGroup } from "./control-group"
import { Input } from "./input"
import { Label } from "./label"

/*
 * A read-only value with a "Copy" button beside it: identifiers, links, reference codes.
 *
 * - The value sits in a read-only field (mono, selectable; focusing it selects everything),
 *   so it can always be copied by hand when the clipboard is not available.
 * - Field and button share one height through the control scale: the row is a form row
 *   (<ControlGroup size="form">: 48 px, 52 px on phones), neither is sized by hand.
 * - Feedback is announced politely and shown on the button for two seconds: "Copied".
 */

type CopyFieldProps = {
  label: string
  value: string
  /** One short line under the field: what the value is for. */
  hint?: string
  /** Accessible name of the button, e.g. "Copy user ID". Defaults to `Copy <label>`. */
  copyLabel?: string
  className?: string
  "data-testid"?: string
}

function CopyField({ label, value, hint, copyLabel, className, "data-testid": testId }: CopyFieldProps) {
  const id = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [state, setState] = React.useState<"idle" | "copied" | "manual">("idle")

  React.useEffect(() => {
    if (state === "idle") return
    const timer = window.setTimeout(() => setState("idle"), state === "copied" ? 2000 : 6000)
    return () => window.clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState("copied")
    } catch {
      // No clipboard permission (or an insecure context): select the value so Ctrl/Cmd+C works.
      inputRef.current?.focus()
      inputRef.current?.select()
      setState("manual")
    }
  }

  return (
    <div data-slot="copy-field" className={cn("flex flex-col gap-1.5", className)} data-testid={testId}>
      <Label htmlFor={id}>{label}</Label>
      <ControlGroup size="form" className="flex max-w-[32.5rem] gap-2">
        <Input
          ref={inputRef}
          id={id}
          readOnly
          value={value}
          spellCheck={false}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-sm sm:text-sm"
        />
        <Button type="button" variant="outline" onClick={() => void copy()} aria-label={copyLabel ?? `Copy ${label}`} className="min-w-[6.5rem]">
          {state === "copied" ? <Check aria-hidden className="size-4 text-brand" /> : <Copy aria-hidden className="size-4" />}
          {state === "copied" ? "Copied" : "Copy"}
        </Button>
      </ControlGroup>
      {hint ? (
        <p id={`${id}-hint`} className="text-13 leading-[1.5] text-ink-2">
          {hint}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className={state === "manual" ? "text-sm text-ink-2" : "sr-only"}>
        {state === "copied" ? `${label} copied` : state === "manual" ? "Copying is blocked in this browser. The value is selected: press Ctrl+C or ⌘C." : ""}
      </p>
    </div>
  )
}

export { CopyField }
export type { CopyFieldProps }
