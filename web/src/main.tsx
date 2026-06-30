import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./theme/theme.css";
import "./theme/screens.css";
import { Landing } from "./pages/Landing";
import { HostPage } from "./pages/HostPage";
import { JoinPage } from "./pages/JoinPage";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/host", element: <HostPage /> },
  { path: "/join", element: <JoinPage /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
