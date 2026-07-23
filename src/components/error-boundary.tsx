import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Network, RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SGP Demo] Erro não tratado:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          fontFamily: "'Inter', sans-serif",
          background: "linear-gradient(135deg, #0c4a6e 0%, #075985 35%, #0369a1 70%, #0284c7 100%)",
        }}
      >
        <div className="w-full max-w-md text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-sky-300" />
            </div>
            <span className="text-white text-[20px]" style={{ fontWeight: 700 }}>
              SGP <span className="text-sky-300">Demo</span>
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400/40 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-rose-300" />
              </div>
            </div>

            <h1 className="text-[22px] text-white mb-2" style={{ fontWeight: 700 }}>
              Algo deu errado
            </h1>
            <p className="text-sky-200/70 text-[13px] mb-2 leading-relaxed">
              Ocorreu um erro inesperado na interface. Isso não afeta os dados do sistema.
            </p>

            {this.state.error && (
              <p className="text-rose-300/60 text-[11px] font-mono bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2 mb-6 text-left break-words">
                {this.state.error.message}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 bg-card text-primary py-3 rounded-xl text-[14px] transition-all hover:bg-muted border border-border"
                style={{ fontWeight: 600 }}
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar a página
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-3 rounded-xl text-[13px] text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                Voltar ao início
              </button>
            </div>
          </div>

          <p className="mt-6 text-[11px] text-sky-300/40">
            Se o problema persistir, contate o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }
}
