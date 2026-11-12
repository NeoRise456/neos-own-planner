import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { DropdownMenu, Popover as P } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * Menu (the tile "…" menu: Move, Cancel, Edit, Delete) and Popover.
 * Not drawn in the design: #111 well, 1px #2A2A2A, radius 8, 32px items.
 */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export const MenuContent = forwardRef<
  ElementRef<typeof DropdownMenu.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(({ className, sideOffset = 6, align = "end", ...props }, ref) => (
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "z-[60] min-w-[168px] rounded-card border border-ink-line bg-ink-well p-1 text-fg outline-none animate-[pop-in_.14s_var(--ease-snap)]",
        className,
      )}
      {...props}
    />
  </DropdownMenu.Portal>
));
MenuContent.displayName = "MenuContent";

export const MenuItem = forwardRef<
  ElementRef<typeof DropdownMenu.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { icon?: ReactNode; danger?: boolean }
>(({ className, icon, danger, children, ...props }, ref) => (
  <DropdownMenu.Item
    ref={ref}
    className={cn(
      "flex h-8 cursor-default items-center gap-2.5 rounded-btn px-2.5 font-ui text-[13px] outline-none select-none",
      "data-highlighted:bg-ink-fill data-disabled:opacity-40",
      danger ? "text-danger" : "text-fg",
      className,
    )}
    {...props}
  >
    {icon}
    {children}
  </DropdownMenu.Item>
));
MenuItem.displayName = "MenuItem";

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-ink-line-soft" />;
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export const PopoverContent = forwardRef<ElementRef<typeof P.Content>, ComponentPropsWithoutRef<typeof P.Content>>(
  ({ className, sideOffset = 6, align = "start", ...props }, ref) => (
    <P.Portal>
      <P.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          // Above dialogs (z 70): pickers open from inside them.
          "z-[80] rounded-card border border-ink-line bg-ink-well p-1 text-fg outline-none animate-[pop-in_.14s_var(--ease-snap)]",
          className,
        )}
        {...props}
      />
    </P.Portal>
  ),
);
PopoverContent.displayName = "PopoverContent";
