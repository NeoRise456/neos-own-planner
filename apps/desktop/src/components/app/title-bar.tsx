import { useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/cn";

/**
 * Title bar — replaces the Windows frame (tauri.conf.json: "decorations": false).
 * Laid over the view and any open side panel (absolute, transparent), so the
 * panel's color runs up to the top of the window. The shell keeps a 36px strip
 * free under it, so scrolling content never slides under the clock.
 * Right side: the window buttons — thin 1.2-stroke icons in #9A9A9A that turn white
 * on hover; close uses the design's danger colors. (The clock lives in the sidebar.)
 * The empty area drags the window; double-click it to maximize.
 * In the browser (pnpm dev:desktop:browser) it's empty — there's no window to control.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const inTauri = isTauri();

  useEffect(() => {
    if (!inTauri) return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    win.isMaximized().then(setMaximized);
    win
      .onResized(async () => setMaximized(await win.isMaximized()))
      .then((u) => {
        unlisten = u;
      });
    return () => unlisten?.();
  }, [inTauri]);

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-9 items-stretch select-none">
      <div data-tauri-drag-region className="flex-1" />
      {inTauri && (
        <>
          <WinButton label="Minimize" onClick={() => getCurrentWindow().minimize()}>
            <path d="M2 6.5h8" />
          </WinButton>
          <WinButton label={maximized ? "Restore" : "Maximize"} onClick={() => getCurrentWindow().toggleMaximize()}>
            {/* Same square whether maximized or not — the icons never change; only the label does. */}
            <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" />
          </WinButton>
          <WinButton label="Close" danger onClick={() => getCurrentWindow().close()}>
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </WinButton>
        </>
      )}
    </header>
  );
}

function WinButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex w-[46px] items-center justify-center text-fg-label transition-colors duration-[120ms] focus-visible:-outline-offset-2",
        danger ? "hover:bg-danger-fill hover:text-danger" : "hover:bg-ink-line-faint hover:text-fg",
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden>
        {children}
      </svg>
    </button>
  );
}
