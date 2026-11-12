import { useId, useMemo, useState } from "react";
import { type Protocol, type ProtocolStatus, findProtocols, protocolStatus, sortByProtocolStatus, todayOf } from "@planner/core";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { useProtocolMap, useRoutineModel } from "@/lib/data-hooks";
import { Input } from "@/components/ui/field";

const STATUS_LABEL: Record<ProtocolStatus, string> = { active: "Active", unused: "Unused", past: "Past" };

/**
 * Pick one protocol (or none) — SYSTEMS.md "Finding and reusing". Searches titles and
 * steps, past protocols included, listed active → unused → past. Picking a past one for a
 * running routine makes it active again.
 */
export function ProtocolPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const protocolMap = useProtocolMap();
  const protocols = useMemo(() => [...protocolMap.values()], [protocolMap]);
  const { routines, entries } = useRoutineModel();
  const today = todayOf(useClock());
  const [query, setQuery] = useState("");
  const listId = useId();
  const statusOf = (id: string) => protocolStatus(id, routines, entries, today);

  const rows = useMemo(() => {
    const withStatus = protocols.map((p) => ({ protocol: p, status: protocolStatus(p.id, routines, entries, today) }));
    const sorted = sortByProtocolStatus(withStatus);
    if (!query.trim()) return sorted;
    // While searching: findProtocols' order (title matches first, then steps).
    const rank = new Map(findProtocols(protocols, query).map((p, i) => [p.id, i]));
    return sorted.filter((r) => rank.has(r.protocol.id)).sort((a, b) => rank.get(a.protocol.id)! - rank.get(b.protocol.id)!);
  }, [protocols, routines, entries, today, query]);

  const selected = protocolMap.get(value);
  const selectedPast = selected && statusOf(selected.id) === "past";

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        aria-label="Search protocols"
        aria-controls={listId}
        placeholder="Search protocols, past ones too"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div
        id={listId}
        role="listbox"
        aria-label="Protocols"
        className="flex max-h-[188px] flex-col gap-px overflow-y-auto rounded-card border border-ink-line-soft p-1"
      >
        {!query.trim() && <Row label="None" selected={value === ""} onPick={() => onChange("")} />}
        {rows.map(({ protocol, status }) => (
          <Row key={protocol.id} protocol={protocol} status={status} selected={value === protocol.id} onPick={() => onChange(protocol.id)} />
        ))}
        {rows.length === 0 && (
          <span className="px-2.5 py-2 font-ui text-[12px] text-fg-label">No protocol matches “{query.trim()}”.</span>
        )}
      </div>
      {selectedPast && (
        <span className="font-ui text-[12px] text-fg-label">
          “{selected.title}” is a past protocol. Using it in a running routine makes it active again.
        </span>
      )}
    </div>
  );
}

function Row({
  protocol,
  status,
  label,
  selected,
  onPick,
}: {
  protocol?: Protocol;
  status?: ProtocolStatus;
  label?: string;
  selected: boolean;
  onPick: () => void;
}) {
  const past = status === "past";
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        "flex min-h-9 items-center gap-2.5 rounded-btn px-2.5 text-left font-ui text-[13px] transition-colors duration-[120ms]",
        selected ? "bg-fg-white font-semibold text-black" : "text-fg hover:bg-ink-fill",
      )}
    >
      {protocol ? (
        <>
          <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", past && !selected ? "bg-ink-line-dash" : "bg-fg-label")} />
          <span className={cn("min-w-0 flex-1 truncate", past && !selected && "text-fg-secondary")}>{protocol.title}</span>
          <span className={cn("shrink-0 text-[11px] tabular-nums", selected ? "text-[#555555]" : "text-fg-label")}>
            {protocol.steps.length} steps · {STATUS_LABEL[status!]}
          </span>
        </>
      ) : (
        <span className={cn("flex-1", !selected && "text-fg-secondary")}>{label}</span>
      )}
    </button>
  );
}
