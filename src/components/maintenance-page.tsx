import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { Network, Settings, RefreshCw, Clock } from "lucide-react";
import axios from "axios";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";

// Polling adaptativo: backoff exponencial com teto, mais curto perto da previsão de retorno.
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 30_000;
const NEAR_RETURN_WINDOW_MS = 2 * 60_000; // dentro de 2 min da previsão, verifica mais rápido
const NEAR_RETURN_DELAY_MS = 10_000;

function getApiBaseURL() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api";
}

/**
 * Verifica se a manutenção acabou.
 * Usa um endpoint que retorna 503 em manutenção (GET /api/auth/me).
 * Não usa GET /setup — ele é liberado durante manutenção e retorna 200, o que fazia a tela ir para /login.
 */
async function checkIfSystemIsBack(): Promise<boolean> {
  try {
    const response = await axios.get(`${getApiBaseURL()}/auth/me`, {
      validateStatus: () => true,
      timeout: 8000,
      withCredentials: true,
    });
    return response.status !== 503;
  } catch {
    return false;
  }
}

function useCountdown(targetDate: Date | null) {
  const [remaining, setRemaining] = useState<{
    days: number; hours: number; minutes: number; seconds: number; expired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setRemaining({ days, hours, minutes, seconds, expired: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return remaining;
}

export function MaintenancePage() {
  usePageTitle("Sistema em Manutenção");
  const navigate = useNavigate();

  // Configurações vindas do backend (runtime, editáveis no painel DEV) têm prioridade;
  // as variáveis VITE_MAINTENANCE_* ficam apenas como fallback.
  const [status, setStatus] = useState<{
    message: string | null;
    expectedReturn: string | null;
    windowStart: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${getApiBaseURL()}/system/status`, { validateStatus: () => true, timeout: 8000, withCredentials: true })
      .then((r) => {
        if (!cancelled && r.status === 200 && r.data) {
          setStatus({
            message: r.data.maintenanceMessage ?? null,
            expectedReturn: r.data.maintenanceExpectedReturn ?? null,
            windowStart: r.data.maintenanceWindowStart ?? null,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // VITE_MAINTENANCE_DATE = previsão de retorno (fim da manutenção). VITE_MAINTENANCE_DATE_START = opcional, início da janela (ex.: 21:30).
  const maintenanceDateEndStr = status?.expectedReturn ?? import.meta.env.VITE_MAINTENANCE_DATE ?? "";
  const maintenanceDateStartStr = status?.windowStart ?? import.meta.env.VITE_MAINTENANCE_DATE_START ?? "";
  const targetDate = useMemo(
    () => (maintenanceDateEndStr ? new Date(maintenanceDateEndStr) : null),
    [maintenanceDateEndStr]
  );
  const startDate = useMemo(
    () => (maintenanceDateStartStr ? new Date(maintenanceDateStartStr) : null),
    [maintenanceDateStartStr]
  );
  const countdown = useCountdown(targetDate);

  const formatDateTime = (d: Date) =>
    d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const attemptRef = useRef(0);

  // Um check único: retorna true se o sistema voltou (e redireciona para o login).
  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const back = await checkIfSystemIsBack();
      setLastCheck(new Date());
      if (back) navigateRef.current("/login", { replace: true });
      return back;
    } finally {
      setChecking(false);
    }
  }, []);

  // Próximo intervalo: backoff exponencial (5s→30s) com jitter de ±20%,
  // encurtado perto da previsão de retorno.
  const nextDelay = useCallback((): number => {
    const backoff = Math.min(BASE_DELAY_MS * 2 ** attemptRef.current, MAX_DELAY_MS);
    const near = targetDate ? targetDate.getTime() - Date.now() < NEAR_RETURN_WINDOW_MS : false;
    const base = near ? Math.min(backoff, NEAR_RETURN_DELAY_MS) : backoff;
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    return Math.max(3_000, Math.round(base + jitter));
  }, [targetDate]);

  // Verificação automática adaptativa + reação imediata ao focar a aba ou reconectar à rede.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (cancelled) return;
      const back = await runCheck();
      if (cancelled || back) return;
      timer = setTimeout(loop, nextDelay());
      attemptRef.current += 1;
    };

    const kick = () => {
      attemptRef.current = 0; // volta ao ritmo rápido
      if (timer) clearTimeout(timer);
      loop();
    };

    loop(); // primeiro check imediato

    const onVisible = () => {
      if (document.visibilityState === "visible") kick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", kick);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", kick);
    };
  }, [runCheck, nextDelay]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 dark:from-background dark:via-background dark:to-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>
      {/* Decoração de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10 dark:opacity-5"
          style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-10 dark:opacity-5"
          style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
      </div>

      <div className="w-full max-w-lg relative text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 dark:bg-card backdrop-blur-sm border border-white/20 dark:border-border flex items-center justify-center">
            <Network className="w-5 h-5 text-sky-300 dark:text-primary" />
          </div>
          <div className="text-left">
            <span className="text-white dark:text-foreground text-[22px] tracking-tight" style={{ fontWeight: 700 }}>
              SGP <span className="text-sky-300 dark:text-primary">Demo</span>
            </span>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-white/10 dark:bg-card backdrop-blur-md border border-white/20 dark:border-border rounded-3xl p-10 shadow-2xl">
          {/* Ícone animado */}
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-amber-400/20 dark:bg-amber-500/30 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-amber-500/20 dark:bg-amber-500/30 border-2 border-amber-400/50 dark:border-amber-400/60 flex items-center justify-center">
                <Settings
                  className="w-9 h-9 text-amber-300 dark:text-amber-400 animate-spin"
                  style={{ animationDuration: "6s" }}
                />
              </div>
            </div>
          </div>

          <h1 className="text-[26px] text-white dark:text-foreground mb-2" style={{ fontWeight: 700 }}>
            Sistema em Manutenção
          </h1>
          <p className="text-sky-200/80 dark:text-muted-foreground text-[14px] mb-8 leading-relaxed">
            {status?.message ? (
              status.message
            ) : (
              <>
                Estamos realizando melhorias para servir melhor a nossa unidade.
                <br />O sistema voltará em breve.
              </>
            )}
          </p>

          {/* Janela de manutenção (opcional): "Das 21:30 às 22:30" quando VITE_MAINTENANCE_DATE_START e VITE_MAINTENANCE_DATE estão definidas */}
          {startDate && targetDate && !isNaN(startDate.getTime()) && !isNaN(targetDate.getTime()) && (
            <div className="mb-4 p-3 bg-white/10 dark:bg-muted rounded-xl border border-white/20 dark:border-border">
              <p className="text-[11px] text-sky-300/70 dark:text-muted-foreground uppercase tracking-widest mb-1" style={{ fontWeight: 700 }}>
                Janela de manutenção
              </p>
              <p className="text-[14px] text-white dark:text-foreground" style={{ fontWeight: 500 }}>
                Das {formatDateTime(startDate)} às {formatDateTime(targetDate)}
              </p>
            </div>
          )}

          {/* Countdown até o fim da manutenção (VITE_MAINTENANCE_DATE = previsão de retorno / fim) */}
          {countdown && !countdown.expired && (
            <div className="mb-8">
              <p className="text-[11px] text-sky-300/70 dark:text-muted-foreground uppercase tracking-widest mb-3" style={{ fontWeight: 700 }}>
                Previsão de retorno (fim da manutenção)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: countdown.days, label: "Dias" },
                  { value: countdown.hours, label: "Horas" },
                  { value: countdown.minutes, label: "Min" },
                  { value: countdown.seconds, label: "Seg" },
                ].map(({ value, label }) => (
                  <div key={label} className="bg-white/10 dark:bg-muted rounded-xl py-3">
                    <p className="text-[26px] text-white dark:text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                      {String(value).padStart(2, "0")}
                    </p>
                    <p className="text-[10px] text-sky-300/60 dark:text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 600 }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {countdown?.expired && (
            <div className="mb-6 p-3 bg-emerald-500/20 dark:bg-emerald-950/50 border border-emerald-400/40 dark:border-emerald-700 rounded-xl">
              <p className="text-emerald-300 dark:text-emerald-400 text-[13px]" style={{ fontWeight: 500 }}>
                O horário previsto de retorno já passou. Verificando se o sistema voltou...
              </p>
            </div>
          )}

          {/* Botão de verificação manual */}
          <button
            onClick={() => { attemptRef.current = 0; runCheck(); }}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 bg-white/15 dark:bg-primary hover:bg-white/25 dark:hover:opacity-90 border border-white/30 dark:border-primary text-white dark:text-primary-foreground py-3 rounded-xl transition-all duration-200 text-[14px] disabled:opacity-60"
            style={{ fontWeight: 600 }}
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Verificar novamente"}
          </button>

          {/* Última verificação */}
          {lastCheck && (
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-sky-300/50 dark:text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Última verificação: {formatTime(lastCheck)}</span>
              <span className="text-sky-300/30 dark:opacity-50">·</span>
              <span>Reavaliação automática</span>
            </div>
          )}
        </div>

        {/* Rodapé da tela de manutenção */}
        <p className="mt-8 text-[12px] text-sky-300/40 dark:text-muted-foreground">
          SGP — Sistema de Gestão de Patrimônio · Demonstração
        </p>
      </div>
    </div>
  );
}
