import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toneHex } from "@/lib/tones";
import type { ProtocolStatus } from "@planner/core";
import { protocolStatusOf, useMock } from "@/mock/store";
import type { MockProtocol } from "@/mock/data";
import { Chip, Label } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { QuickAdd } from "@/components/ui/field";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { GlyphTile } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/app/dialogs";

export const Route = createFileRoute("/protocols/$protocolId")({ component: ProtocolPage });

/**
 * Protocol — screens/40-protocols. Steps are plain strings; hover a step to remove it.
 * Status active / unused / past comes from the routines (SYSTEMS.md "Protocol status").
 */
function ProtocolPage() {
  const { protocolId } = Route.useParams();
  const protocol = useMock((s) => s.protocols.find((p) => p.id === protocolId));
  const routines = useMock((s) => s.routines);
  const addStep = useMock((s) => s.addStep);
  const removeStep = useMock((s) => s.removeStep);
  const deleteProtocol = useMock((s) => s.deleteProtocol);
  // Real one-off tasks can't pick a protocol until protocols are real too (phase 5).
  const oneOffUses = 0;
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [delOpen, setDelOpen] = useState(false);

  if (!protocol) return <main className="px-12 pt-11 font-ui text-fg-label">This protocol doesn't exist anymore.</main>;

  const half = Math.ceil(protocol.steps.length / 2);
  const usage = protocolStatusOf(protocol, routines);

  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-20">
      {/* Wide windows (≥1280): the steps run down two columns, so a whole protocol fits on
          one screen and the right half isn't empty. Narrow windows: one column. */}
      <div className="mx-auto flex max-w-[680px] flex-col min-[1280px]:max-w-[1020px]">
        <div className="flex items-center gap-2">
          <Label>Protocol</Label>
          <Chip className={STATUS_CHIP[usage.status]}>{usage.status}</Chip>
        </div>
        <div className="mt-2.5 flex items-center gap-[18px]">
          <GlyphTile glyph={protocol.glyph} tone={protocol.tone} filled={usage.status === "active"} dim={usage.status === "past"} />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">{protocol.title}</h1>
            {usage.active.length > 0 && <Uses label="Used by" uses={usage.active} />}
            {usage.drafts.length > 0 && <Uses label="In drafts" uses={usage.drafts} dim />}
            {usage.past.length > 0 && <Uses label="Used before by" uses={usage.past} dim />}
            {protocol.used.length === 0 && <span className="font-ui text-[12px] text-fg-label">No routine uses it yet</span>}
          </div>
        </div>

        <div className="mt-[34px] flex items-center justify-between border-b border-ink-line-soft pb-1.5">
          <Label as="h2">Steps</Label>
          <span className="font-ui text-[11px] text-fg-label tabular-nums">{protocol.steps.length} steps</span>
        </div>
        <ol
          className="m-0 list-none p-0 min-[1280px]:grid min-[1280px]:grid-flow-col min-[1280px]:grid-cols-2 min-[1280px]:gap-x-10"
          style={{ gridTemplateRows: `repeat(${half}, auto)` }}
        >
          {protocol.steps.map((s, i) => (
            <li
              key={`${i}-${s}`}
              className="group grid min-h-11 grid-cols-[34px_1fr_28px] items-center gap-2.5 rounded-btn border-b border-ink-line-faint px-1 hover:bg-ink-raised"
            >
              <span className="font-ui text-[11px] text-fg-label tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="read py-2.5 text-[15px] leading-[21px] text-fg">{s}</span>
              <button
                type="button"
                aria-label={`Remove step ${i + 1}`}
                onClick={() => {
                  removeStep(protocol.id, i);
                  toast("Step removed.", { action: { label: "Undo", onClick: () => restoreStep(protocol.id, i, s) } });
                }}
                className="inline-flex size-7 items-center justify-center rounded-btn text-fg-placeholder opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:bg-ink-fill hover:text-danger focus-visible:opacity-100"
              >
                <CloseIcon size={10} />
              </button>
            </li>
          ))}
        </ol>

        <QuickAdd className="mt-4 min-[1280px]:max-w-[490px]" placeholder="Add a step" value={draft} onChange={setDraft} onSubmit={(v) => addStep(protocol.id, v)} />
        <p className="mt-3 mb-0 font-ui text-[12px] text-fg-label">
          A protocol is just a reminder. You follow it yourself, and editing it updates every task that uses it.
        </p>

        {/* Delete — only unused ones (SYSTEMS.md "Deleting a protocol"). */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-ink-line-soft pt-5">
          {usage.status === "unused" ? (
            <Button size="lg" variant="danger" className="ml-auto" onClick={() => setDelOpen(true)}>
              <TrashIcon />
              Delete protocol
            </Button>
          ) : (
            <p className="m-0 font-ui text-[12px] text-fg-label">
              {usage.status === "active"
                ? `A running routine uses it, so it can't be deleted. Remove it from ${usage.active.length === 1 ? "that entry" : "those entries"} first.`
                : "Past routines used it, so it's part of their history and can't be deleted. Pick it in an entry any time to use it again."}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title={`Delete “${protocol.title}”?`}
        body={deleteWarning(usage.drafts.length, oneOffUses)}
        confirmLabel="Delete protocol"
        onConfirm={() => {
          deleteProtocol(protocol.id);
          toast("Protocol deleted.");
          navigate({ to: "/protocols" });
        }}
      />
    </main>
  );
}

const STATUS_CHIP: Record<ProtocolStatus, string> = {
  active: "bg-fg-white text-black",
  unused: "border border-ink-line bg-transparent text-fg-secondary",
  past: "text-fg-label",
};

/** One line of "where it's used" chips; each opens its routine. */
function Uses({ label, uses, dim }: { label: string; uses: MockProtocol["used"]; dim?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-ui text-[12px] text-fg-label">{label}</span>
      {uses.map((u) => (
        <Link
          key={u.entryId}
          to="/routines/$routineId"
          params={{ routineId: u.routineId }}
          className="inline-flex h-7 items-center gap-1.5 rounded-btn bg-ink-fill px-2.5 font-ui text-[12px] text-fg no-underline transition-colors duration-[120ms] hover:bg-ink-fill-hover"
        >
          <span aria-hidden className="size-2 rounded-[2px]" style={{ background: dim ? "#3A3A3A" : toneHex(u.tone) }} />
          {u.label}
          <span className="text-fg-label">· {u.kind}</span>
        </Link>
      ))}
    </div>
  );
}

function deleteWarning(drafts: number, oneOffs: number): string {
  const parts = [
    drafts > 0 && `${drafts} draft ${drafts === 1 ? "entry" : "entries"}`,
    oneOffs > 0 && `${oneOffs} one-off ${oneOffs === 1 ? "task" : "tasks"}`,
  ].filter(Boolean);
  if (parts.length === 0) return "Nothing uses it, so nothing else changes.";
  return `No running or past routine uses it. ${parts.join(" and ")} will just lose it.`;
}

/** Undo for "remove step": put it back where it was (mock only). */
function restoreStep(protocolId: string, index: number, text: string) {
  useMock.setState((s) => ({
    protocols: s.protocols.map((p) => (p.id === protocolId ? { ...p, steps: [...p.steps.slice(0, index), text, ...p.steps.slice(index)] } : p)),
  }));
}
