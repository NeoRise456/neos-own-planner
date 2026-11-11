import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toneHex } from "@/lib/tones";
import { useMock } from "@/mock/store";
import { Label } from "@/components/ui/bits";
import { QuickAdd } from "@/components/ui/field";
import { CloseIcon } from "@/components/ui/icons";
import { GlyphTile } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";

export const Route = createFileRoute("/protocols/$protocolId")({ component: ProtocolPage });

/** Protocol — screens/40-protocols. Steps are plain strings; hover a step to remove it. */
function ProtocolPage() {
  const { protocolId } = Route.useParams();
  const protocol = useMock((s) => s.protocols.find((p) => p.id === protocolId));
  const addStep = useMock((s) => s.addStep);
  const removeStep = useMock((s) => s.removeStep);
  const [draft, setDraft] = useState("");

  if (!protocol) return <main className="px-12 pt-11 font-ui text-fg-label">This protocol doesn't exist anymore.</main>;

  const half = Math.ceil(protocol.steps.length / 2);

  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-20">
      {/* Wide windows (≥1280): the steps run down two columns, so a whole protocol fits on
          one screen and the right half isn't empty. Narrow windows: one column. */}
      <div className="mx-auto flex max-w-[680px] flex-col min-[1280px]:max-w-[1020px]">
        <Label>Protocol</Label>
        <div className="mt-2.5 flex items-center gap-[18px]">
          <GlyphTile glyph={protocol.glyph} tone={protocol.tone} />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">{protocol.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-ui text-[12px] text-fg-label">{protocol.used.length ? "Used by" : "Not used by anything yet"}</span>
              {protocol.used.map((u) => (
                <Link
                  key={u.label}
                  to="/routines/$routineId"
                  params={{ routineId: u.routineId }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-btn bg-ink-fill px-2.5 font-ui text-[12px] text-fg no-underline transition-colors duration-[120ms] hover:bg-ink-fill-hover"
                >
                  <span aria-hidden className="size-2 rounded-[2px]" style={{ background: toneHex(u.tone) }} />
                  {u.label}
                  <span className="text-fg-label">· {u.kind}</span>
                </Link>
              ))}
            </div>
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
      </div>
    </main>
  );
}

/** Undo for "remove step": put it back where it was (mock only). */
function restoreStep(protocolId: string, index: number, text: string) {
  useMock.setState((s) => ({
    protocols: s.protocols.map((p) => (p.id === protocolId ? { ...p, steps: [...p.steps.slice(0, index), text, ...p.steps.slice(index)] } : p)),
  }));
}
