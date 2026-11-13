"use client"

import * as React from "react"
import { Button } from "./button"

/*
 * A button that opens the file picker ("Upload logo", "Replace file"). The real
 * <input type="file"> is kept out of sight and out of the tab order; the button is what
 * people see, focus and press, so it looks and sizes like every other Button.
 *
 *   <FileButton id="workspace-logo" accept="image/png,image/jpeg" variant="outline" size="sm"
 *               loading={uploading} onFiles={([file]) => upload(file)}>
 *     Upload logo
 *   </FileButton>
 *
 * `onFiles` gets the chosen files (never an empty list); the same file can be chosen twice
 * in a row. For dropping files onto an area use a drop zone, not this.
 */
function FileButton({
  id,
  name,
  accept,
  multiple = false,
  onFiles,
  disabled,
  loading,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "onClick" | "asChild" | "id" | "name"> & {
  /** `id` and `name` of the file input (for a label, a form or a test). */
  id?: string
  name?: string
  /** Accepted types, as for the input: "image/png,image/jpeg,image/webp". */
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || loading}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          // Clear the field so that choosing the same file again fires a change.
          event.target.value = ""
          if (files.length > 0) onFiles(files)
        }}
      />
      <Button type="button" disabled={disabled} loading={loading} onClick={() => input.current?.click()} {...props}>
        {children}
      </Button>
    </>
  )
}

export { FileButton }
