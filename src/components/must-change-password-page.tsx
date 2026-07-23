import { useState } from "react";
import { useNavigate } from "react-router";
import { Network, Lock, ShieldAlert, Eye, EyeOff, LogOut } from "lucide-react";
import { authApi } from "../api/auth.api";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;

/**
 * Troca de senha obrigatória: exibida quando o usuário entrou com uma senha temporária
 * (reset por admin ou break-glass) e precisa definir uma senha própria antes de continuar.
 */
export function MustChangePasswordPage() {
  usePageTitle("Trocar Senha");
  const navigate = useNavigate();
  const { user, refetchUser, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) return;
    if (!currentPassword) {
      setError("Informe a senha temporária que você recebeu.");
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError("A nova senha deve ter mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password === currentPassword) {
      setError("A nova senha deve ser diferente da temporária.");
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(user.id, { currentPassword, newPassword: password });
      await refetchUser();
      toast.success("Senha alterada com sucesso!");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setError(axErr?.response?.data?.message ?? "Não foi possível alterar a senha. Verifique a senha temporária.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 dark:from-background dark:via-background dark:to-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-[420px] relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 dark:bg-card backdrop-blur-sm mb-4 border border-white/20 dark:border-border">
            <Network className="w-8 h-8 text-sky-300 dark:text-primary" />
          </div>
          <h1 className="text-white dark:text-foreground text-[28px] tracking-tight" style={{ fontWeight: 700 }}>
            SGP <span className="text-sky-300 dark:text-primary">Demo</span>
          </h1>
        </div>

        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
          <div className="p-8">
            <div className="flex items-start gap-2 p-3 mb-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-800 dark:text-amber-200">
                Sua senha foi definida como temporária. Defina uma nova senha para continuar.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-[13px] text-red-700 dark:text-red-300">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Senha temporária</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] text-foreground placeholder:text-muted-foreground"
                    placeholder="Senha temporária recebida"
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showCurrent ? "Ocultar" : "Mostrar"}>
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] text-foreground placeholder:text-muted-foreground"
                    placeholder="Nova senha"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showPassword ? "Ocultar" : "Mostrar"}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Confirmar nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] text-foreground placeholder:text-muted-foreground"
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:opacity-90 text-primary-foreground py-3 rounded-xl shadow-lg shadow-sky-600/20 dark:shadow-none transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-[14px]"
                style={{ fontWeight: 600 }}
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 dark:border-primary-foreground/30 border-t-white dark:border-t-primary-foreground rounded-full animate-spin" /> : "Salvar nova senha"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button onClick={handleLogout} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
