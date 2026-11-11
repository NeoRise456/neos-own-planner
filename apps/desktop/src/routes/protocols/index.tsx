import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMock } from "@/mock/store";

/** /protocols opens the first protocol. */
export const Route = createFileRoute("/protocols/")({
  beforeLoad: () => {
    const first = useMock.getState().protocols[0];
    if (first) throw redirect({ to: "/protocols/$protocolId", params: { protocolId: first.id } });
  },
  component: () => <main className="px-12 pt-11 font-ui text-fg-label">No protocols yet. Make one with “New protocol” in the sidebar.</main>,
});
