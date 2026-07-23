import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { Network, User, Lock, ArrowRight, Eye, EyeOff, Timer } from "lucide-react";
import axios from "axios";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";
import { toast } from "sonner";
import { DemoAccountPicker } from "../demo/DemoAccountPicker";

/**
 * Verifica se o sistema precisa de configuração inicial.
 * Usa GET /setup (endpoint público) que retorna { needsSetup: boolean }.
 */
async function probeNeedsSetup(): Promise<boolean> {
  try {
    const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api";
    const response = await axios.get<{ needsSetup: boolean }>(
      `${baseURL}/setup`,
      { validateStatus: () => true, withCredentials: true, timeout: 5000 }
    );
    if (response.status === 200 && typeof response.data?.needsSetup === "boolean") {
      return response.data.needsSetup;
    }
    return false;
  } catch {
    return false;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  usePageTitle("Login");

  const setFieldError = (key: string, msg: string | null) => {
    setFieldErrors((prev) => { const n = { ...prev }; if (msg) n[key] = msg; else delete n[key]; return n; });
  };

  // Pré-preenche usuário quando redirecionado do setup (backend retorna username gerado)
  useEffect(() => {
    const stateUsername = (location.state as { username?: string } | null)?.username;
    if (stateUsername && typeof stateUsername === "string") {
      setUsername(stateUsername);
    }
  }, [location.state]);

  // Countdown visual de rate limit
  useEffect(() => {
    if (!rateLimitUntil) return;
    const update = () => {
      const remaining = Math.ceil((rateLimitUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setRateLimitUntil(null);
        setRateLimitCountdown(0);
        setError("");
      } else {
        setRateLimitCountdown(remaining);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [rateLimitUntil]);

  // Ao montar: 1) verifica manutenção via api (interceptor redireciona em 503),
  // 2) verifica se é primeiro acesso (banco vazio → vai para /setup)
  useEffect(() => {
    const init = async () => {
      let skipSetChecking = false;
      try {
        try {
          await api.get("/auth/me", { validateStatus: (s) => s < 500 });
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 503) {
            skipSetChecking = true;
            if (window.location.pathname !== '/maintenance') {
              window.location.replace('/maintenance');
            }
            return;
          }
        }
        const needs = await probeNeedsSetup();
        if (needs) navigate("/setup", { replace: true });
      } catch {
        // falha na probe (rede, etc.)
      } finally {
        if (!skipSetChecking) setChecking(false);
      }
    };
    init();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const userErr = !username.trim() ? "Preencha o usuário." : null;
    const passErr = !password ? "Preencha a senha." : null;
    setFieldErrors({ ...(userErr ? { username: userErr } : {}), ...(passErr ? { password: passErr } : {}) });
    if (userErr || passErr) return;
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string }; headers?: Record<string, string> };
      };
      const status = axiosErr?.response?.status;
      const message = axiosErr?.response?.data?.message ?? "";

      if (status === 429) {
        const retryAfter =
          parseInt(String(axiosErr?.response?.headers?.["retry-after"] ?? "30"), 10) || 30;
        setRateLimitUntil(Date.now() + retryAfter * 1000);
        setError("");
      } else if (
        message.toLowerCase().includes("bloqueada") ||
        message.toLowerCase().includes("bloqueado")
      ) {
        setError("Conta bloqueada por tentativas excessivas. Tente novamente em 15 minutos.");
      } else if (status === 401) {
        setError("Credenciais inválidas. Verifique usuário e senha.");
      } else {
        setError("Erro ao conectar ao servidor. Tente novamente.");
      }
      toast.error(error || "Erro no login");
    } finally {
      setLoading(false);
    }
  };

  // Spinner enquanto verifica se precisa de setup
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 dark:from-background dark:via-background dark:to-background">
        <div className="absolute top-4 right-4 z-10">
          <ThemeSwitcher />
        </div>
        <div className="w-8 h-8 border-2 border-white/30 dark:border-primary/30 border-t-white dark:border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 dark:from-background dark:via-background dark:to-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 dark:opacity-5" style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10 dark:opacity-5" style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
      </div>

      <div className="w-full max-w-[420px] relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 dark:bg-card backdrop-blur-sm mb-4 border border-white/20 dark:border-border">
            <Network className="w-8 h-8 text-sky-300 dark:text-primary" />
          </div>
          <h1 className="text-white dark:text-foreground text-[28px] tracking-tight" style={{ fontWeight: 700 }}>
            SGP <span className="text-sky-300 dark:text-primary">Demo</span>
          </h1>
          <p className="text-sky-200/60 dark:text-muted-foreground text-[13px] mt-1">
            Sistema de Gestao Patrimonial
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
          <div className="p-8">
            <h3 className="text-[18px] text-foreground mb-1 text-center" style={{ fontWeight: 600 }}>
              Bem-vindo
            </h3>
            <p className="text-[13px] text-muted-foreground mb-6 text-center">
              Entre com suas credenciais para acessar
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-[13px] text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>
                  Usuario
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUsername(v);
                      setFieldError("username", v.trim() ? null : "Preencha o usuário.");
                    }}
                    required
                    className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.username ? "border-red-500 dark:border-red-500" : "border-border"}`}
                    placeholder="Digite seu usuario"
                  />
                </div>
                {fieldErrors.username && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.username}</p>}
              </div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPassword(v);
                      setFieldError("password", v ? null : "Preencha a senha.");
                    }}
                    required
                    className={`w-full pl-10 pr-11 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.password ? "border-red-500 dark:border-red-500" : "border-border"}`}
                    placeholder="Digite sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.password}</p>}
              </div>

              <div className="text-right">
                <Link
                  to="/recuperar-acesso"
                  className="text-[12px] text-primary hover:opacity-90 transition-colors"
                >
                  Não consegue acessar? Recuperar com código
                </Link>
              </div>

              {rateLimitUntil && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <p className="text-[13px] text-amber-800 dark:text-amber-200" style={{ fontWeight: 600 }}>
                      Muitas tentativas — aguarde para continuar
                    </p>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-amber-600 dark:text-amber-400">Tempo restante</span>
                    <span
                      className="text-[20px] text-amber-700 dark:text-amber-300 tabular-nums"
                      style={{ fontWeight: 700 }}
                    >
                      {String(Math.floor(rateLimitCountdown / 60)).padStart(2, "0")}:
                      {String(rateLimitCountdown % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                      style={{ width: `${(rateLimitCountdown / 30) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!rateLimitUntil}
                className="w-full bg-primary hover:opacity-90 text-primary-foreground py-3 rounded-xl shadow-lg shadow-sky-600/20 dark:shadow-none transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-[14px]"
                style={{ fontWeight: 600 }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Exclusivo do modo demonstração — não existe no sistema real. */}
            <DemoAccountPicker />
          </div>
        </div>
      </div>
    </div>
  );
}
