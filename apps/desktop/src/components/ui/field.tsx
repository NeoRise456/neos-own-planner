import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon, PlusIcon } from "./icons";

/**
 * Inputs — DESIGN.md §3. Black, 1px #2A2A2A, radius 6; focus border #8C8C8C.
 * kind: text (UI 13) · title (Figtree 18) · code (Doto, square dots)
 */
export const inputBase =
  "w-full rounded-btn border border-ink-line bg-black px-2.5 text-fg outline-none transition-colors duration-[120ms] placeholder:text-fg-placeholder focus:border-fg-muted aria-invalid:border-error-line";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { kind?: "text" | "title" | "code" }
>(({ kind = "text", className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      inputBase,
      kind === "text" && "h-9 font-ui text-[13px]",
      kind === "title" && "read h-[38px] text-[18px] font-medium",
      kind === "code" && "glyph h-9 text-[15px] font-bold tracking-[.06em]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputBase, "read min-h-24 resize-y py-2 text-[15px] leading-[21px] font-medium", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

/** Native select styled like the "Routine" picker in the component sheet. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <span className="relative block">
      <select
        ref={ref}
        className={cn(inputBase, "h-9 cursor-pointer appearance-none pr-8 font-ui text-[13px] font-semibold", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-label" />
    </span>
  ),
);
Select.displayName = "Select";

/**
 * Field — label (12, #BDBDBD) · control · help (11, #9A9A9A) or error (11, #FF3B3B).
 * Wires id / aria-describedby / aria-invalid for you via the render prop.
 */
export function Field({
  label,
  help,
  error,
  children,
  className,
}: {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  children: (a: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="font-ui text-[12px] text-fg-secondary">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": help || error ? noteId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <span id={noteId} className="font-ui text-[11px] text-error">
          {error}
        </span>
      ) : help ? (
        <span id={noteId} className="font-ui text-[11px] text-fg-label">
          {help}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Quick-add — 48 tall, radius 8, "+" icon, Figtree 16, an "Enter" key hint.
 * Calls onSubmit with the trimmed text and clears itself.
 */
export const QuickAdd = forwardRef<
  HTMLInputElement,
  {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
    className?: string;
  }
>(({ placeholder, value, onChange, onSubmit, className }, ref) => {
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    onChange("");
  }
  return (
    <label
      className={cn(
        "flex h-12 items-center gap-3 rounded-card border border-ink-line bg-black px-[14px] transition-colors duration-[120ms] focus-within:border-fg-muted",
        className,
      )}
    >
      <PlusIcon className="text-fg-placeholder" />
      <span className="sr-only">{placeholder}</span>
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="read min-w-0 flex-1 bg-transparent text-[16px] font-medium text-fg outline-none placeholder:text-fg-placeholder focus-visible:outline-none"
      />
      <Kbd>Enter</Kbd>
    </label>
  );
});
QuickAdd.displayName = "QuickAdd";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-chip border border-ink-line px-1.5 py-px font-ui text-[11px] text-fg-label">{children}</span>
  );
}
