import { Clock, LogOut, RefreshCw } from "lucide-react";

interface SessionTimeoutModalProps {
  open: boolean;
  secondsLeft: number;
  onContinue: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({
  open,
  secondsLeft,
  onContinue,
  onLogout,
}: SessionTimeoutModalProps) {
  if (!open) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 30;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[380px] bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Barra de progresso no topo */}
        <div className="h-1 bg-muted">
          <div
            className={`h-1 transition-all duration-1000 ${isUrgent ? "bg-rose-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(100, (secondsLeft / 120) * 100)}%` }}
          />
        </div>

        <div className="p-6 text-center">
          {/* Ícone */}
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${
              isUrgent ? "bg-rose-100 dark:bg-rose-950/60" : "bg-amber-100 dark:bg-amber-950/60"
            }`}
          >
            <Clock className={`w-7 h-7 ${isUrgent ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />
          </div>

          <h3 className="text-[17px] text-foreground mb-2" style={{ fontWeight: 700 }}>
            Sessão expirando
          </h3>
          <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">
            Por segurança, sua sessão será encerrada por inatividade em:
          </p>

          {/* Contador */}
          <div
            className={`text-[42px] tabular-nums mb-5 ${isUrgent ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}
            style={{ fontWeight: 700, letterSpacing: "-1px" }}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border text-muted-foreground hover:bg-muted rounded-xl text-[13px] transition-colors"
              style={{ fontWeight: 500 }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair agora
            </button>
            <button
              onClick={onContinue}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-[#075985] text-white rounded-xl text-[13px] shadow-lg shadow-sky-600/20 transition-all"
              style={{ fontWeight: 600 }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Continuar conectado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
