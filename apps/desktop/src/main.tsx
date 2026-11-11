import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Fonts bundled locally (Tauri app, offline) — design/DESIGN.md §2 "Type".
import "@fontsource-variable/figtree";
import "@fontsource-variable/doto/full.css"; // wght + ROND axes; .glyph sets ROND 0 (square dots)
import "./styles/index.css";

const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
