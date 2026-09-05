import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Loader2, Home } from "lucide-react";
import { logAnalyticsEvent } from "../firebase";

interface Props {
  children?: ReactNode;
  language?: "bn" | "en";
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught exception caught by React ErrorBoundary:", error, errorInfo);
    try {
      logAnalyticsEvent("app_crash_detected", {
        message: error?.message || "Unknown error",
        stack: error?.stack || "",
        componentStack: errorInfo?.componentStack || ""
      });
    } catch (e) {}
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isBangla = this.props.language !== "en";
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-slate-100">
          <div className="max-w-md w-full text-center space-y-6 bg-slate-800/50 p-8 rounded-3xl border border-slate-700">
            <div className="inline-flex p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                {isBangla ? "দুঃখিত, কোনো একটি সমস্যা হয়েছে!" : "Something went wrong!"}
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed font-semibold">
                {isBangla
                  ? "অ্যাপের কোনো ফাইল লোড হতে সমস্যা হচ্ছে। দয়া করে রিলোড করে আবার চেষ্টা করুন।"
                  : "An unexpected client crash occurred. Please reload the app to resume your session."}
              </p>
            </div>

            {(this.state.error && import.meta.env.DEV && (
              <div className="text-left bg-slate-950/80 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400">
                <span className="font-bold text-red-500">Error (dev only):</span> {this.state.error.message}
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black py-3 px-6 rounded-2xl"
              >
                <Loader2 className="w-4 h-4" />
                {isBangla ? "রিলোড করুন" : "Reload App"}
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-black py-3 px-6 rounded-2xl"
              >
                <Home className="w-4 h-4" />
                {isBangla ? "হোমে যান" : "Go Home"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
                }
