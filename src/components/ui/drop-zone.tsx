"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

/*
 * Drop zone: where files are handed over, as on the New bid check artboard. A paper panel
 * with a dashed line-strong edge, "Drop the files here", ONE outline button that opens the
 * file picker (the keyboard and touch way in), and a muted line saying what is accepted.
 *
 *   <DropZone accept=".pdf,.docx,.xlsx,.zip" multiple onFiles={add}
 *             hint="PDF, Word, Excel or ZIP. Send everything the buyer sent, including appendices." />
 *
 * Dragging files over it turns the edge brand green and the ground brand-tint. `onFiles`
 * gets what was dropped or chosen; checking type and size is the caller's job (say what was
 * refused in an Alert under the zone, never silently). The real <input type="file"> is out
 * of sight and out of the tab order: the button is the control. On phones the icon is left
 * out and the button takes the full width at 48 px.
 */
function DropZone({
  title = "Drop the files here",
  button = "Choose files",
  hint,
  accept,
  multiple = true,
  disabled = false,
  onFiles,
  id,
  name,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title" | "onDrop"> & {
  title?: string
  /** Label of the button. */
  button?: string
  /** What is accepted, in words. */
  hint?: React.ReactNode
  /** Accepted types for the picker, as for the input: ".pdf,.docx". */
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
  /** `id` and `name` of the file input (for a form or a test). */
  id?: string
  name?: string
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const depth = React.useRef(0)

  const take = (list: FileList | null) => {
    const files = [...(list ?? [])]
    if (files.length > 0 && !disabled) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      data-slot="drop-zone"
      data-over={over ? "" : undefined}
      className={cn(
        "flex flex-col gap-2.5 rounded-card border-[1.5px] border-dashed border-line-strong bg-paper px-4 py-5 text-center transition-colors duration-150 max-sm:controls-md sm:items-center sm:px-6 sm:py-7",
        "data-[over]:border-brand data-[over]:bg-brand-tint",
        disabled && "opacity-60",
        className,
      )}
      onDragEnter={(event) => {
        event.preventDefault()
        depth.current += 1
        if (!disabled) setOver(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        depth.current = 0
        setOver(false)
        take(event.dataTransfer.files)
      }}
      {...props}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-7 fill-none stroke-ink-2 stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round] max-sm:hidden">
        <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
      <p className="text-base leading-[1.5] font-semibold text-ink sm:text-17">{title}</p>
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          take(event.target.files)
          event.target.value = ""
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
        {button}
      </Button>
      {hint ? <p className="text-13 leading-[1.5] text-ink-2">{hint}</p> : null}
    </div>
  )
}

export { DropZone }
