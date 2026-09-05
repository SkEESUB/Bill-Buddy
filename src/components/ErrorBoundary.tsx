import { Component, type ErrorInfo, type ReactNode } from "react";
import { log } from "@/lib/logger";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render-time React errors anywhere in the tree and shows a recovery screen. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    log.error("React error boundary caught an error", { error, info });
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FCEAED] text-3xl">
            ⚠️
          </div>
          <h1 className="mt-4 text-xl font-bold text-text-primary">Something went wrong</h1>
          <p className="mt-2 text-sm text-text-secondary">
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-muted p-3 text-left text-xs text-text-secondary">
            {error.message}
          </pre>
          <button
            type="button"
            className="btn btn-primary mt-5 w-full"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
