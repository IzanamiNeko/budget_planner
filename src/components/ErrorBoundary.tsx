import { AlertTriangle, RotateCcw } from 'lucide-react';
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      let friendlyDetail = this.state.message;
      if (this.state.message.includes('Quota exceeded')) {
        friendlyDetail =
          'Das tägliche Firestore-Kontingent wurde erreicht. Es wird am nächsten Tag zurückgesetzt.';
      } else if (
        this.state.message.includes('Missing or insufficient permissions')
      ) {
        friendlyDetail =
          'Zugriff verweigert: Bitte melde dich erneut mit einem verifizierten Google-Konto an.';
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-[#C62828] dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold">
              Verbindung oder Berechtigung fehlgeschlagen
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">
              {friendlyDetail}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-sm font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Seite neu laden</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
