import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router";
import { Network, User, Lock, Mail, ArrowRight } from "lucide-react";
import axios from "axios";
import { api } from "../api/client";
import { authApi } from "../api/auth.api";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;

/** Nome completo: 1–100 caracteres; apenas letras (Unicode), espaços, hífens e apóstrofos. */
const FULLNAME_REGEX = /^[\p{L}\s\-']+$/u;
const FULLNAME_MIN = 1;
const FULLNAME_MAX = 100;

/** Login preferido: um ponto (nome.sobrenome); sufixo opcional só com dígitos (ex.: maria.silva2). */
const USERNAME_REGEX = /^[a-z]+\.[a-z]+[0-9]*$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 50;

function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Nome completo é obrigatório.";
  if (trimmed.length < FULLNAME_MIN || trimmed.length > FULLNAME_MAX) return "Nome completo deve ter entre 1 e 100 caracteres.";
  if (!FULLNAME_REGEX.test(trimmed)) return "Nome completo deve conter apenas letras, espaços, hífens ou apóstrofos (ex.: Maria da Silva, Jean-Pierre).";
  return null;
}

function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) return "Login deve ter entre 3 e 50 caracteres.";
  if (!USERNAME_REGEX.test(trimmed)) return "Login deve ser no formato nome.sobrenome ou nome.sobrenome2 (apenas um ponto; sufixo opcional só com dígitos).";
  return null;
}

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Email é obrigatório.";
  if (!trimmed.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email inválido.";
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Senha é obrigatória.";
  if (!PASSWORD_REGEX.test(value)) return "Senha deve ter mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial.";
  return null;
}

function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "Confirme a senha.";
  if (password !== confirm) return "As senhas não coincidem.";
  return null;
}

export function SetupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, refetchUser } = useAuth();
  const [form, setForm] = useState({ password: "", passwordConfirm: "", email: "", fullName: "" });
  const [preferredUsername, setPreferredUsername] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  usePageTitle("Configuração Inicial");

  // Buscar sugestões de login quando o nome completo mudar (debounce)
  useEffect(() => {
    const fullName = form.fullName.trim();
    if (!fullName || validateFullName(form.fullName) !== null) {
      setSuggestions([]);
      setPreferredUsername("");
      return;
    }
    if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    suggestionsTimerRef.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const data = await authApi.suggestedUsernames(fullName);
        setSuggestions(data.suggestions ?? []);
        setPreferredUsername((prev) => (prev && (data.suggestions ?? []).includes(prev) ? prev : ""));
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 400);
    return () => {
      if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    };
  }, [form.fullName]);

  // Verifica se o setup ainda é necessário ao montar a página
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) return; // já autenticado → guard irá redirecionar

    const check = async () => {
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
          navigate("/login", { replace: true });
          return;
        }
        const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api";
        const response = await axios.get<{ needsSetup: boolean }>(
          `${baseURL}/setup`,
          { validateStatus: () => true, withCredentials: true, timeout: 5000 }
        );
        if (response.status === 200 && response.data?.needsSetup === false) {
          navigate("/login", { replace: true });
        } else if (response.status === 200 && response.data?.needsSetup === true) {
          setNeedsSetup(true);
        } else {
          navigate("/login", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      } finally {
        if (!skipSetChecking) setChecking(false);
      }
    };

    check();
  }, [authLoading, isAuthenticated, navigate]);

  // Usuário já autenticado → vai para o dashboard
  if (!authLoading && isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const fullNameErr = validateFullName(form.fullName);
    const usernameErr = validateUsername(preferredUsername);
    const emailErr = validateEmail(form.email);
    const passwordErr = validatePassword(form.password);
    const confirmErr = validatePasswordConfirm(form.password, form.passwordConfirm);
    setFieldErrors({
      ...(fullNameErr ? { fullName: fullNameErr } : {}),
      ...(usernameErr ? { username: usernameErr } : {}),
      ...(emailErr ? { email: emailErr } : {}),
      ...(passwordErr ? { password: passwordErr } : {}),
      ...(confirmErr ? { passwordConfirm: confirmErr } : {}),
    });
    if (fullNameErr || usernameErr || emailErr || passwordErr || confirmErr) return;

    setLoading(true);
    try {
      const data = await authApi.setup({
        password: form.password,
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        ...(preferredUsername.trim() ? { username: preferredUsername.trim() } : {}),
      });
      toast.success(`Conta criada. Use o login ${data.username} para acessar o sistema.`);
      await refetchUser();
      navigate("/login", { state: { username: data.username }, replace: true });
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number; data?: { message?: string; validationErrors?: Record<string, string> } } };
      if (axErr?.response?.status === 404) {
        setError("O sistema já foi configurado. Faça login normalmente.");
        navigate("/login", { replace: true });
      } else {
        const msg = axErr?.response?.data?.message as string | undefined;
        const validation = axErr?.response?.data?.validationErrors;
        const fullNameMsg = validation?.fullName;
        if (msg?.includes("already taken") || msg?.toLowerCase().includes("username already taken")) {
          setError("Este login já está em uso. Escolha outra sugestão ou deixe o sistema escolher.");
        } else {
          setError(fullNameMsg ?? msg ?? "Erro ao criar administrador.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 dark:from-background dark:via-background dark:to-background">
        <div className="absolute top-4 right-4 z-10">
          <ThemeSwitcher />
        </div>
        <div className="w-8 h-8 border-2 border-white/30 dark:border-primary/30 border-t-white dark:border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!needsSetup) return null;

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

      <div className="w-full max-w-[440px] relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 dark:bg-card backdrop-blur-sm mb-4 border border-white/20 dark:border-border">
            <Network className="w-8 h-8 text-sky-300 dark:text-primary" />
          </div>
          <h1 className="text-white dark:text-foreground text-[28px] tracking-tight" style={{ fontWeight: 700 }}>
            SGP <span className="text-sky-300 dark:text-primary">Demo</span>
          </h1>
          <p className="text-sky-200/60 dark:text-muted-foreground text-[13px] mt-1">Configuracao Inicial do Sistema</p>
        </div>

        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
          <div className="p-8">
            <h3 className="text-[18px] text-foreground mb-1 text-center" style={{ fontWeight: 600 }}>
              Criar Administrador
            </h3>
            <p className="text-[13px] text-muted-foreground mb-6 text-center">
              Configure o primeiro acesso ao sistema
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-[13px] text-red-700 dark:text-red-300">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, fullName: v }));
                      setFieldErrors((prev) => { const n = { ...prev }; const err = validateFullName(v); if (err) n.fullName = err; else delete n.fullName; return n; });
                    }}
                    required
                    maxLength={FULLNAME_MAX}
                    className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.fullName ? "border-red-500 dark:border-red-500" : "border-border"}`}
                    placeholder="Ex.: Maria da Silva"
                  />
                </div>
                {fieldErrors.fullName && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.fullName}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">Apenas letras, espaços, hífens ou apóstrofos (1–100 caracteres).</p>
              </div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Login preferido (opcional)</label>
                <input
                  type="text"
                  value={preferredUsername}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase();
                    setPreferredUsername(v);
                    setError("");
                    setFieldErrors((prev) => { const n = { ...prev }; const err = validateUsername(v); if (err) n.username = err; else delete n.username; return n; });
                  }}
                  list="setup-username-suggestions"
                  placeholder={suggestionsLoading ? "Carregando sugestões..." : "Deixe vazio para o sistema gerar ou digite ex.: maria.silva"}
                  maxLength={USERNAME_MAX}
                  className={`w-full px-3 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.username ? "border-red-500 dark:border-red-500" : "border-border"}`}
                />
                <datalist id="setup-username-suggestions">
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                {fieldErrors.username && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.username}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">Digite seu login (ex.: maria.silva) ou escolha uma sugestão. Se já estiver em uso, escolha outra ou tente um diferente.</p>
              </div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, email: v }));
                      setFieldErrors((prev) => { const n = { ...prev }; const err = validateEmail(v); if (err) n.email = err; else delete n.email; return n; });
                    }}
                    required
                    className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.email ? "border-red-500 dark:border-red-500" : "border-border"}`}
                    placeholder="admin@exemplo.gov.br"
                  />
                </div>
                {fieldErrors.email && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, password: v }));
                      setFieldErrors((prev) => {
                        const n = { ...prev };
                        const err = validatePassword(v); if (err) n.password = err; else delete n.password;
                        const errConfirm = validatePasswordConfirm(v, form.passwordConfirm); if (errConfirm) n.passwordConfirm = errConfirm; else delete n.passwordConfirm;
                        return n;
                      });
                    }}
                    required
                    className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.password ? "border-red-500 dark:border-red-500" : "border-border"}`}
                    placeholder="Mín. 8 chars, maiúscula, número e especial"
                  />
                </div>
                {fieldErrors.password && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.password}</p>}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.
                </p>
              </div>
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={form.passwordConfirm}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, passwordConfirm: v }));
                      setFieldErrors((prev) => { const n = { ...prev }; const err = validatePasswordConfirm(form.password, v); if (err) n.passwordConfirm = err; else delete n.passwordConfirm; return n; });
                    }}
                    required
                    className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] ${fieldErrors.passwordConfirm ? "border-red-500 dark:border-red-500" : "border-border"}`}
                    placeholder="Repita a senha"
                  />
                </div>
                {fieldErrors.passwordConfirm && <p className="text-[11px] text-red-500 mt-1">{fieldErrors.passwordConfirm}</p>}
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:opacity-90 text-primary-foreground py-3 rounded-xl shadow-lg shadow-sky-600/20 dark:shadow-none transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-[14px]"
                style={{ fontWeight: 600 }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Criar Administrador <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
