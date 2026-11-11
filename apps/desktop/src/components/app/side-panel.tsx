import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Right-hand panels (e.g. the task panel) render into a slot in the app shell,
 * not inside the scrolling view. That lets them run the full height of the window,
 * under the transparent title bar, so the panel's color reaches the top edge
 * and the window buttons sit on it.
 */
export const SidePanelSlot = createContext<HTMLElement | null>(null);

export function SidePanel({ children }: { children: ReactNode }) {
  const slot = useContext(SidePanelSlot);
  // No slot (e.g. a stale shell after a hot reload): render in place rather than
  // vanishing. The panel just loses its full-height look until a reload.
  return slot ? createPortal(children, slot) : <>{children}</>;
}
