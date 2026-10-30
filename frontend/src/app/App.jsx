import React from "react";
import { HashRouter } from "react-router-dom";
import { ToastProvider } from "../shared/feedback/ToastContext";
import { AuthProvider } from "./auth/AuthProvider";
import { SedeProvider } from "./providers/SedeProvider";
import { ErrorBoundary } from "./providers/ErrorBoundary";
import { AppRoutes } from "./router";

/** Hash routes work on static hosting without server-side route rewrites. */
export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SedeProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </SedeProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
