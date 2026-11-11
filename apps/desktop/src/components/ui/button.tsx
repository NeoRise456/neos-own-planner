import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Button — DESIGN.md §3 "Buttons". Radius 6, UI font, 600.
 * primary: white / black · quiet: #1A1A1A · ghost: #A3A3A3 text · danger: #3A1111 / #FF4D4D.
 * Disabled always looks the same: #3A3A3A / #7A7A7A.
 * size: sm 28 · md 32 · lg 36 · xl 40 (radius 8)
 */
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-btn font-ui font-semibold select-none",
    "transition-colors duration-[120ms] ease-snap",
    "disabled:bg-ink-line-dash disabled:text-fg-disabled",
  ],
  {
    variants: {
      variant: {
        primary: "bg-fg-white font-medium text-black enabled:hover:bg-primary-hover",
        quiet: "bg-ink-fill text-fg enabled:hover:bg-ink-fill-hover",
        ghost: "font-medium text-fg-ghost enabled:hover:bg-ink-line-faint enabled:hover:text-fg-white",
        danger: "bg-danger-fill text-danger enabled:hover:bg-danger-fill-hover",
      },
      size: {
        sm: "h-7 px-3 text-[12px]",
        md: "h-8 px-[14px] text-[13px]",
        lg: "h-9 px-[14px] text-[13px]",
        xl: "h-10 rounded-card px-7 text-[14px] font-medium",
      },
    },
    defaultVariants: { variant: "quiet", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

/**
 * IconButton — 32 square, radius 6.
 * plain: hover #141414 · filled: #1A1A1A · muted: grey icon.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "plain" | "filled" | "muted" }
>(({ label, tone = "plain", className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={label}
    title={label}
    className={cn(
      "inline-flex size-8 shrink-0 items-center justify-center rounded-btn transition-colors duration-[120ms]",
      tone === "plain" && "text-[#E5E5E5] hover:bg-ink-line-faint",
      tone === "filled" && "bg-ink-fill text-[#E5E5E5] hover:bg-ink-fill-hover",
      tone === "muted" && "text-fg-disabled hover:bg-ink-line-faint",
      className,
    )}
    {...props}
  />
));
IconButton.displayName = "IconButton";

/** Round arrow button with a 1px #2A2A2A ring (‹ ›, close). size 32 or 24. */
export const RoundButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; small?: boolean }
>(({ label, small, className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={label}
    title={label}
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-full border border-ink-line text-fg transition-colors duration-[120ms]",
      "enabled:hover:bg-ink-fill disabled:cursor-default disabled:text-[#555555]",
      small ? "size-6" : "size-8",
      className,
    )}
    {...props}
  />
));
RoundButton.displayName = "RoundButton";
