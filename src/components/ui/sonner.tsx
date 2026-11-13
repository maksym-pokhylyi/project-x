"use client"

import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/*
 * Toasts (sonner), restyled to the system: white surface, hairline, 8 px radius, overlay
 * shadow, status carried by an icon in the role colour plus the words. Announced politely to
 * screen readers by sonner. Use for confirmations of an action the person just took;
 * anything they must read or act on belongs in the page (Alert), not in a toast.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 text-brand" />,
        info: <Info className="size-4 text-info" />,
        warning: <TriangleAlert className="size-4 text-accent-ink" />,
        error: <CircleAlert className="size-4 text-danger" />,
        loading: <Loader2 className="size-4 animate-spin text-ink-2" />,
      }}
      toastOptions={{
        classNames: {
          toast: "rounded-card! border-line! bg-surface! text-ink! shadow-overlay! font-sans! text-sm! gap-3! p-4!",
          title: "font-medium! text-ink!",
          description: "text-ink-2!",
          actionButton: "rounded-control! bg-brand! text-white! font-medium!",
          cancelButton: "rounded-control! bg-paper-deep! text-ink! font-medium!",
          closeButton: "border-line! bg-surface! text-ink-2! hover:text-ink!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-line)",
          "--border-radius": "var(--radius-card)",
          "--width": "380px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
