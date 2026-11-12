import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { toneHex } from "@/lib/tones";
import { useNow } from "@/lib/use-now";
import { todayOf } from "@planner/core";
import { useClock } from "@/lib/clock";
import { useTodoDay } from "@/lib/data-hooks";
import { formatOffset, useUi } from "@/stores/ui";
import { protocolStatusOf, useMock } from "@/mock/store";
import type { MockProtocol } from "@/mock/data";
import { DotLogo } from "@/components/ui/bits";
import {
  CalendarIcon,
  PlusIcon,
  ProtocolsIcon,
  RoutinesIcon,
  SettingsIcon,
  TodoIcon,
} from "@/components/ui/icons";
import { NewProtocolDialog, NewRoutineDialog } from "./dialogs";

/**
 * Sidebar — screens/03-sidebar. 220 wide, black, right edge #1A1A1A.
 * Nav items 36 tall; the active one is a white pill with black text.
 * Routines / Protocols open a sub-list with a left rail when active.
 */
export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const clock = useClock();
  const { todo } = useTodoDay(todayOf(clock), clock);
  const routines = useMock((s) => s.routines);
  const protocols = useMock((s) => s.protocols);
  const navigate = useNavigate();
  const [newRoutine, setNewRoutine] = useState(false);
  const [newProtocol, setNewProtocol] = useState(false);

  const openCount = todo.missed.length + todo.scheduled.length + todo.during.length + todo.anytime.length;
  const active = routines.filter((r) => !r.ended && !r.draft);
  const drafts = routines.filter((r) => r.draft);
  const ended = routines.filter((r) => r.ended);
  // Protocols by status (SYSTEMS.md "Protocol status"): active, then unused, then past.
  const protocolGroups = { active: [] as MockProtocol[], unused: [] as MockProtocol[], past: [] as MockProtocol[] };
  for (const p of protocols) protocolGroups[protocolStatusOf(p, routines).status].push(p);

  const on = (p: string) => path === p || path.startsWith(`${p}/`);

  return (
    <nav
      aria-label="Main"
      className="relative flex h-full w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-ink-line-soft bg-black px-3 pt-[18px] pb-4 font-ui text-[13px] text-fg"
    >
      {/* Also drags the window (the title bar now starts right of the sidebar).
          Children ignore the mouse so the drag starts from anywhere in the row. */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 px-2 pt-0.5 pb-[22px] select-none">
        <DotLogo className="pointer-events-none" />
        <span className="pointer-events-none text-[14px] font-semibold text-fg-white">planner</span>
      </div>

      <NavItem to="/todo" icon={<TodoIcon />} label="Todo" badge={String(openCount)} active={on("/todo")} />
      <NavItem to="/calendar" icon={<CalendarIcon />} label="Calendar" active={on("/calendar")} />
      <NavItem to="/routines" icon={<RoutinesIcon />} label="Routines" badge={String(active.length)} active={on("/routines")} />
      {on("/routines") && (
        <SubList>
          {active.map((r) => (
            <SubItem key={r.id} to="/routines/$routineId" params={{ routineId: r.id }} tone={toneHex(r.tone)} current={path === `/routines/${r.id}`}>
              {r.name}
            </SubItem>
          ))}
          {drafts.length > 0 && <GroupHeading>Drafts</GroupHeading>}
          {drafts.map((r) => (
            <SubItem key={r.id} to="/routines/$routineId" params={{ routineId: r.id }} tone={toneHex(r.tone)} hollow current={path === `/routines/${r.id}`}>
              {r.name}
            </SubItem>
          ))}
          {ended.length > 0 && <GroupHeading>Ended</GroupHeading>}
          {ended.map((r) => (
            <SubItem key={r.id} to="/routines/$routineId" params={{ routineId: r.id }} tone="#3A3A3A" dim current={path === `/routines/${r.id}`}>
              {r.name}
            </SubItem>
          ))}
          <NewItem onClick={() => setNewRoutine(true)}>New routine</NewItem>
        </SubList>
      )}
      <NavItem to="/protocols" icon={<ProtocolsIcon />} label="Protocols" badge={String(protocolGroups.active.length)} active={on("/protocols")} />
      {on("/protocols") && (
        <SubList>
          {protocolGroups.active.map((p) => (
            <SubItem key={p.id} to="/protocols/$protocolId" params={{ protocolId: p.id }} tone={toneHex(p.tone)} current={path === `/protocols/${p.id}`}>
              {p.title}
            </SubItem>
          ))}
          {protocolGroups.unused.length > 0 && <GroupHeading>Unused</GroupHeading>}
          {protocolGroups.unused.map((p) => (
            <SubItem key={p.id} to="/protocols/$protocolId" params={{ protocolId: p.id }} tone={toneHex(p.tone)} hollow current={path === `/protocols/${p.id}`}>
              {p.title}
            </SubItem>
          ))}
          {protocolGroups.past.length > 0 && <GroupHeading>Past</GroupHeading>}
          {protocolGroups.past.map((p) => (
            <SubItem key={p.id} to="/protocols/$protocolId" params={{ protocolId: p.id }} tone="#3A3A3A" dim current={path === `/protocols/${p.id}`}>
              {p.title}
            </SubItem>
          ))}
          <NewItem onClick={() => setNewProtocol(true)}>New protocol</NewItem>
        </SubList>
      )}

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <SidebarClock />
        <div className="mt-3 border-t border-ink-line-soft" />
        <Link
          to="/settings"
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-card px-2.5 text-[13px] no-underline transition-colors",
            on("/settings") ? "bg-fg-white font-semibold text-black" : "text-fg-label hover:bg-ink-line-faint hover:text-fg",
          )}
        >
          <SettingsIcon />
          Settings
        </Link>
      </div>

      <NewRoutineDialog
        open={newRoutine}
        onOpenChange={setNewRoutine}
        onCreated={(id) => navigate({ to: "/routines/$routineId", params: { routineId: id } })}
      />
      <NewProtocolDialog
        open={newProtocol}
        onOpenChange={setNewProtocol}
        onCreated={(id) => navigate({ to: "/protocols/$protocolId", params: { protocolId: id } })}
      />
    </nav>
  );
}

function NavItem({
  to,
  icon,
  label,
  badge,
  active,
}: {
  to: "/todo" | "/calendar" | "/routines" | "/protocols";
  icon: ReactNode;
  label: string;
  badge?: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-card px-2.5 text-[13px] no-underline transition-colors duration-[120ms]",
        active ? "bg-fg-white font-semibold text-black" : "text-fg-label hover:bg-ink-line-faint hover:text-fg",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && badge !== "0" && (
        <span className={cn("text-[11px] tabular-nums", active ? "text-[#555555]" : "text-fg-label")}>{badge}</span>
      )}
    </Link>
  );
}

function SubList({ children }: { children: ReactNode }) {
  return <div className="ml-[15px] flex flex-col gap-px border-l border-ink-line-mid pt-1.5 pb-3 pl-[14px]">{children}</div>;
}

function GroupHeading({ children }: { children: ReactNode }) {
  return <span className="px-2 pt-3 pb-1 text-[11px] tracking-[.08em] text-fg-label uppercase">{children}</span>;
}

function SubItem({
  to,
  params,
  tone,
  current,
  dim,
  hollow,
  children,
}: {
  to: "/routines/$routineId" | "/protocols/$protocolId";
  params: { routineId: string } | { protocolId: string };
  tone: string;
  current: boolean;
  dim?: boolean;
  /** Drafts / unused protocols: an outlined square — not live. */
  hollow?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params as never}
      aria-current={current ? "true" : undefined}
      className={cn(
        "box-border flex min-h-8 w-full items-center gap-[9px] rounded-btn px-2 text-[12px] no-underline transition-colors duration-[120ms]",
        current ? "bg-ink-fill font-semibold text-fg-white" : dim ? "text-fg-label hover:text-fg-secondary" : "text-fg-secondary hover:bg-ink-line-faint hover:text-fg-white",
      )}
    >
      <span
        aria-hidden
        className="box-border size-2 shrink-0 rounded-[2px]"
        style={hollow ? { border: `1.5px solid ${tone}` } : { background: tone }}
      />
      <span className="truncate">{children}</span>
    </Link>
  );
}

function NewItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 flex min-h-8 items-center gap-[9px] rounded-btn px-2 text-left text-[12px] text-fg-secondary transition-colors hover:bg-ink-line-faint hover:text-fg-white"
    >
      <PlusIcon size={9} />
      {children}
    </button>
  );
}

/**
 * The app's one clock: time big in the dot-matrix glyph font (same family as the
 * logo and task glyphs), then date and zone, stacked big → small so they read as
 * one unit. Click → Settings to change the time zone.
 */
function SidebarClock() {
  const now = useNow();
  const offset = useUi((s) => s.utcOffsetMinutes);
  return (
    <Link
      to="/settings"
      title="Time zone — click to change"
      aria-label={`${now.label}, ${now.dateLabel}, ${formatOffset(offset)}. Change time zone`}
      className="group flex flex-col gap-1.5 rounded-card px-2.5 py-2 no-underline transition-colors duration-[120ms] hover:bg-ink-line-faint"
    >
      <span className="glyph text-[34px] leading-none tracking-[.04em] text-fg-white tabular-nums">{now.label}</span>
      <span className="font-ui text-[12px] leading-4 text-fg-secondary uppercase">{now.dateLabel}</span>
      <span className="font-ui text-[11px] leading-[14px] text-fg-label tabular-nums group-hover:text-fg-secondary">
        {formatOffset(offset)}
      </span>
    </Link>
  );
}
