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

export class ErrorBoundary extends React.Component<Props, State> {
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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error in RAKEEZA system:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      // Clear offline mutations or temp caches if corrupt
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">حدث خطأ غير متوقع أثناء العرض</h2>
              <p className="text-sm text-slate-400 mt-1">
                تم حفظ بياناتك المحاسبية بأمان. يمكنك إعادة تحميل الصفحة للمتابعة دون أي فقدان للبيانات.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded-xl text-right text-xs text-red-300 font-mono overflow-auto max-h-24 border border-red-950">
                {this.state.error.message || 'Error occurred'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/30 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل الشاشة</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetCache}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-sm"
                title="تحديث الذاكرة المؤقتة"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تحديث الذاكرة</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500">
              منظومة RAKEEZA | ركيزة للمحاسبة السحابية
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
