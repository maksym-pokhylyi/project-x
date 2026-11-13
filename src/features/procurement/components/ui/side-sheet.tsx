"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/*
 * Side sheet: a panel that slides in from the right edge over a dimmed page, for editing
 * the settings of the screen underneath without leaving it ("Trades and regions"). 500 px
 * wide on a desk, the full width on a small screen. A modal dialog in every other respect:
 * focus is trapped, and returned on close to `returnFocusTo` (the control that opened it) or,
 * failing that, to whatever had focus when it opened; Escape and the scrim close it (Radix).
 *
 * Layout: a serif title and one sentence at the top, the content scrolling in the middle,
 * and `footer` pinned at the bottom on a hairline (the summary and Save / Cancel).
 *
 *   <SideSheet open={open} onOpenChange={setOpen} title="Trades and regions" description="…" footer={…}>…</SideSheet>
 *
 * Reduced motion: the slide is an opacity fade only (tw-animate honours the preference).
 * Candidate for src/components/ui (beside dialog.tsx).
 */
export function SideSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  returnFocusTo,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** The control that opens the sheet: focus goes back to it when the sheet closes. */
  returnFocusTo?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="side-sheet"
          aria-describedby={description ? undefined : ""}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            // The sheet is opened by a control of the page, not by a Radix trigger, so say where focus returns.
            const target = returnFocusTo?.current ?? opener.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-[31.25rem] flex-col border-l border-line bg-surface shadow-overlay duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-safe:data-[state=closed]:slide-out-to-right-8 motion-safe:data-[state=open]:slide-in-from-right-8",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-6 md:px-7 md:pt-7">
            <div className="flex min-w-0 flex-col gap-2">
              <DialogTitle className="type-section">{title}</DialogTitle>
              {description ? <DialogDescription className="text-15 text-ink">{description}</DialogDescription> : null}
            </div>
            <DialogPrimitive.Close className="-mt-1 -mr-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-control text-ink-2 transition-colors hover:bg-paper-deep hover:text-ink">
              <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">{children}</div>
          {footer ? <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
