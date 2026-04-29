import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors in the wrapped subtree and shows a
 * minimal recoverable fallback instead of letting React unmount and
 * leave a blank page.
 *
 * Doesn't catch async errors (fetch failures, promise rejections),
 * event handler errors, or errors in the boundary itself. Those keep
 * surfacing through the existing per-feature error states. The
 * boundary's job is the "everything else" net under render bugs.
 *
 * Class component because componentDidCatch and
 * getDerivedStateFromError only exist on class components by React
 * design.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Plain console.error so the original message and stack land in
    // the browser console where a developer can find them. No upstream
    // logging service in this app.
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-slate-600">
            The page hit an unexpected error. Reloading usually fixes it.
            If it keeps happening, please report it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
