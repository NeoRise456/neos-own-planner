import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMock } from "@/mock/store";

/** /routines opens the first published, running routine (else a draft, else any). */
export const Route = createFileRoute("/routines/")({
  beforeLoad: () => {
    const rs = useMock.getState().routines;
    const first = rs.find((r) => !r.ended && !r.draft) ?? rs.find((r) => r.draft) ?? rs[0];
    if (first) throw redirect({ to: "/routines/$routineId", params: { routineId: first.id } });
  },
  component: () => <main className="px-12 pt-11 font-ui text-fg-label">No routines yet. Make one with “New routine” in the sidebar.</main>,
});
