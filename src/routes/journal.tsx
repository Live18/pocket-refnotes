import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/journal")({
  beforeLoad: ({ location }) => { // <-- CHANGE: was unconditional redirect — now only fires for the bare /journal path
    if (location.pathname === "/journal") {
      throw redirect({ to: "/" });
    }
  },
});