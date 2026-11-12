import { useMemo, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { protocolStatus, sortByProtocolStatus, todayOf } from "@planner/core";
import { useData, useLive } from "@planner/data/react";
import { useClock } from "@/lib/clock";
import { useRoutineModel } from "@/lib/data-hooks";
import { Button } from "@/components/ui/button";
import { EmptyState, Loader } from "@/components/ui/bits";
import { PlusIcon } from "@/components/ui/icons";
import { NewProtocolDialog } from "@/components/app/dialogs";

export const Route = createFileRoute("/protocols/")({ component: ProtocolsIndex });

/** /protocols opens the first protocol (active, then unused, then past). */
function ProtocolsIndex() {
  const { repos, unavailable } = useData();
  const today = todayOf(useClock());
  const { data: protocols, isLoading } = useLive(repos ? repos.protocols.all() : null);
  const { routines, entries } = useRoutineModel();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const first = useMemo(
    () => sortByProtocolStatus(protocols.map((p) => ({ protocol: p, status: protocolStatus(p.id, routines, entries, today) })))[0]?.protocol,
    [protocols, routines, entries, today],
  );

  if (!repos) return <EmptyState className="flex-1 pt-24" glyph="Pr" title="Nothing can be saved here" body={unavailable} />;
  if (isLoading)
    return (
      <main className="flex flex-1 justify-center pt-24">
        <Loader label="Loading protocols" />
      </main>
    );
  if (first) return <Navigate to="/protocols/$protocolId" params={{ protocolId: first.id }} replace />;

  return (
    <main className="min-w-0 flex-1 px-12 pt-11">
      <EmptyState
        className="pt-20"
        glyph="Pr"
        title="No protocols yet"
        body="A protocol is a list of steps for doing something, like a shower or a gym warm-up. Tasks and routine entries can use one."
        actions={
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <PlusIcon />
            New protocol
          </Button>
        }
      />
      <NewProtocolDialog open={creating} onOpenChange={setCreating} onCreated={(id) => navigate({ to: "/protocols/$protocolId", params: { protocolId: id } })} />
    </main>
  );
}
