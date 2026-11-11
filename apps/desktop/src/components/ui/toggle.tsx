import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Switch } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * Toggle — 32×20. On: white track, black knob. Off: #1A1A1A track, #333 knob.
 * Knob slides 12px with the snap ease, no bounce.
 */
export const Toggle = forwardRef<ElementRef<typeof Switch.Root>, ComponentPropsWithoutRef<typeof Switch.Root>>(
  ({ className, ...props }, ref) => (
    <Switch.Root
      ref={ref}
      className={cn(
        "relative h-5 w-8 shrink-0 rounded-full bg-ink-fill transition-colors duration-150 data-[state=checked]:bg-fg-white",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Switch.Thumb
        className={cn(
          "absolute top-[3px] left-[3px] block size-[14px] rounded-full bg-[#333333]",
          "transition-[transform,background-color] duration-[180ms] ease-snap",
          "data-[state=checked]:translate-x-3 data-[state=checked]:bg-black",
        )}
      />
    </Switch.Root>
  ),
);
Toggle.displayName = "Toggle";
