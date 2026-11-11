import { useState } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/app/sidebar";
import { SidePanelSlot } from "@/components/app/side-panel";
import { TitleBar } from "@/components/app/title-bar";
import { Toaster } from "@/components/ui/toast";

/**
 * App shell: the sidebar runs the full height of the window. Next to it:
 *  - the view, which scrolls below a 36px strip kept free for the title bar;
 *  - the side-panel slot (task panel), full height;
 *  - the title bar, transparent and laid over both, so an open panel's
 *    color reaches the top of the window instead of being cut by a black strip.
 * The window itself never scrolls — the sidebar, view and panel scroll on their own.
 */
function Root() {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <div className="relative flex h-full overflow-hidden bg-ink-bg text-fg">
      <Sidebar />
      <SidePanelSlot.Provider value={slot}>
        <div className="relative flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div aria-hidden className="h-9 shrink-0" />
            {/* relative: hidden labels (.sr-only) position against this, not the window */}
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </div>
          <div ref={setSlot} className="contents" />
          <TitleBar />
        </div>
      </SidePanelSlot.Provider>
      <Toaster />
    </div>
  );
}

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: () => <main className="p-12 font-ui text-fg-label">Nothing here.</main>,
});
