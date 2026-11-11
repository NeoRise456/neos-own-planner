import { createFileRoute, redirect } from "@tanstack/react-router";

/** Todo is the home view. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/todo" });
  },
});
