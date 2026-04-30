import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { logger } from "../lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ componentStack: info.componentStack }, `render error: ${message}`);
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  private handleWindowError = (e: ErrorEvent) => {
    logger.error({ error: e.message }, "uncaught error");
  };

  private handleUnhandledRejection = (e: PromiseRejectionEvent) => {
    logger.error({ reason: String(e.reason) }, "unhandled rejection");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "2rem",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              borderRadius: "12px",
              border: "1px solid #c0392b",
              background: "#2f1f1b",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#e74c3c", fontWeight: 600, marginBottom: "0.5rem" }}>
              Something went wrong
            </p>
            <p style={{ color: "#e6a092", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "#c0392b",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.5rem 1.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
