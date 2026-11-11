import type { ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./icons";

/**
 * Dialog — not drawn in the design, so it follows the rules: surfaces lift by
 * grey fills (no shadows) → #0A0A0A card, 1px #2A2A2A, radius 12, black scrim.
 * Title uses the section-heading voice (Figtree 23 / 800). Round ✕ like the task panel.
 */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  width = 460,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  width?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[70] bg-black/75 animate-[fade-in_.15s_ease]" />
      <D.Content
        style={{ width }}
        className={cn(
          "fixed top-1/2 left-1/2 z-[70] max-h-[calc(100dvh-48px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto",
          "rounded-tile border border-ink-line bg-ink-raised p-6 text-fg outline-none animate-[dialog-in_.2s_var(--ease-snap)]",
          className,
        )}
      >
        <div className="mb-5 flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <D.Title className="read m-0 text-[23px] leading-[26px] font-extrabold tracking-[-.01em] text-fg-white">
              {title}
            </D.Title>
            <D.Description className={description ? "font-ui text-[12px] text-fg-label" : "sr-only"}>
              {description ?? (typeof title === "string" ? title : "Dialog")}
            </D.Description>
          </div>
          <D.Close
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-ink-line text-fg hover:bg-ink-fill"
          >
            <CloseIcon />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

/** Action row at the bottom of a dialog: a hairline, then buttons on the right. */
export function DialogActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-ink-line-soft pt-5", className)}>
      {children}
    </div>
  );
}
