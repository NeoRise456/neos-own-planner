import { useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { routineStatus, todayOf } from "@planner/core";
import { useData } from "@planner/data/react";
import { useClock } from "@/lib/clock";
import { useRoutineModel } from "@/lib/data-hooks";
import { Button } from "@/components/ui/button";
import { EmptyState, Loader } from "@/components/ui/bits";
import { PlusIcon } from "@/components/ui/icons";
import { NewRoutineDialog } from "@/components/app/dialogs";

export const Route = createFileRoute("/routines/")({ component: RoutinesIndex });

/** /routines opens the first running routine (else upcoming, a draft, or any). */
function RoutinesIndex() {
  const { repos, unavailable } = useData();
  const today = todayOf(useClock());
  const { routines, isLoading } = useRoutineModel();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  if (!repos) return <EmptyState className="flex-1 pt-24" glyph="Ro" title="Nothing can be saved here" body={unavailable} />;
  if (isLoading)
    return (
      <main className="flex flex-1 justify-center pt-24">
        <Loader label="Loading routines" />
      </main>
    );
  const order = ["active", "upcoming", "draft", "ended"] as const;
  const first = [...routines].sort((a, b) => order.indexOf(routineStatus(a, today)) - order.indexOf(routineStatus(b, today)))[0];
  if (first) return <Navigate to="/routines/$routineId" params={{ routineId: first.id }} replace />;

  return (
    <main className="min-w-0 flex-1 px-12 pt-11">
      <EmptyState
        className="pt-20"
        glyph="Ro"
        title="No routines yet"
        body="A routine is a group of things that repeat, with a purpose and an end date: an exercise plan, a uni term, a morning routine."
        actions={
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <PlusIcon />
            New routine
          </Button>
        }
      />
      <NewRoutineDialog open={creating} onOpenChange={setCreating} onCreated={(id) => navigate({ to: "/routines/$routineId", params: { routineId: id } })} />
    </main>
  );
}
