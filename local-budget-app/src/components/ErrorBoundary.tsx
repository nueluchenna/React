import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || String(error) || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Manni UI crash caught by ErrorBoundary:', error, info);
  }

  handleClearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-white text-[#0E0F0C] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-[#F2F5F2] p-7 space-y-4 text-center">
          <div className="w-11 h-11 rounded-full bg-[#9FE870] text-[#163300] font-bold flex items-center justify-center mx-auto">
            M
          </div>
          <h1 className="text-lg font-bold text-[#0E0F0C]">Something went wrong</h1>
          <p className="text-xs text-[#5D615C] leading-relaxed">
            Your local transactions in IndexedDB are safe. Refreshing the app cache usually resolves updates immediately.
          </p>
          <pre className="text-left text-[11px] font-mono bg-white rounded-xl p-3 text-[#A8200D] overflow-auto max-h-36 whitespace-pre-wrap">
            {this.state.errorMessage}
          </pre>
          <button
            type="button"
            onClick={() => void this.handleClearCacheAndReload()}
            className="w-full py-2.5 px-5 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] text-[#163300] font-semibold text-sm cursor-pointer"
          >
            Refresh app cache
          </button>
        </div>
      </div>
    );
  }
}
