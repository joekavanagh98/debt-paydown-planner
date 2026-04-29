import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ErrorBoundary } from "./features/ErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

// ErrorBoundary outside AuthProvider so a render bug inside auth
// itself still gets caught instead of unmounting silently.
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
