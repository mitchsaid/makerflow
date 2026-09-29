import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in application:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetData = () => {
    try {
      const keysToRemove = [
        'maker_profile',
        'maker_groups',
        'maker_materials',
        'maker_products',
        'maker_services',
        'maker_customers',
        'maker_quotes',
        'maker_invoices',
        'maker_jobs',
        'maker_notifications',
        'maker_custom_templates',
        'maker_reusable_stages'
      ];
      keysToRemove.forEach(k => localStorage.removeItem(k));
      window.location.reload();
    } catch (e) {
      console.error('Error clearing data:', e);
      window.location.reload();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans antialiased text-stone-800">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-5 text-center">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-stone-900">Application Notice</h2>
              <p className="text-sm text-stone-600">
                An unexpected interface issue occurred. You can reload the workspace or restore default sample data to resume.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-left text-xs font-mono text-stone-600 max-h-32 overflow-y-auto break-words">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition cursor-pointer shadow-sm"
              >
                <RefreshCw size={16} />
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleResetData}
                className="w-full flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-4 rounded-xl text-sm transition cursor-pointer"
              >
                <RotateCcw size={16} />
                Restore Defaults & Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
