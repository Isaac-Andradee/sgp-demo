import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Network, Lock, KeyRound, User, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { authApi } from "../api/auth.api";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;

/**
 * Camada 2 — Recuperação de acesso via código de uso único.
 * Para contas ADMIN/DEV que ficaram sem acesso e não têm outro admin para redefinir a senha.
 */
export function RecoverWithCodePage() {
  usePageTitle("Recuperar Acesso");
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!usernameOrEmail.trim()) {
      setError("Informe seu usuário ou e-mail.");
      return;
    }
    if (!recoveryCode.trim()) {
      setError("Informe o código de recuperação.");
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

    setLoading(true);
    try {
      await authApi.recoverWithCode({ usernameOrEmail: usernameOrEmail.trim(), recoveryCode: recoveryCode.trim(), newPassword: password });
      setDone(true);
      toast.success("Acesso recuperado! Faça login com a nova senha.");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setError(axErr?.response?.data?.message ?? "Código de recuperação inválido.");
    } finally {
      setLoading(false);
    }
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
            {done ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h3 className="text-[18px] text-foreground" style={{ fontWeight: 600 }}>Acesso recuperado!</h3>
                <p className="text-[13px] text-muted-foreground">Você será redirecionado para o login em instantes...</p>
              </div>
            ) : (
              <>
                <h3 className="text-[18px] text-foreground mb-1 text-center" style={{ fontWeight: 600 }}>
                  Recuperar acesso
                </h3>
                <p className="text-[13px] text-muted-foreground mb-6 text-center">
                  Use o código de recuperação que você guardou para definir uma nova senha.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-[13px] text-red-700 dark:text-red-300">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Usuário ou e-mail</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={usernameOrEmail}
                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                        required
                        autoComplete="username"
                        className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] text-foreground placeholder:text-muted-foreground"
                        placeholder="seu.usuario ou seu@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Código de recuperação</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        required
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] text-foreground placeholder:text-muted-foreground font-mono tracking-wide uppercase"
                        placeholder="XXXXX-XXXXX-XXXXX"
                      />
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
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
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
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 dark:border-primary-foreground/30 border-t-white dark:border-t-primary-foreground rounded-full animate-spin" /> : "Recuperar acesso"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/login" className="text-[13px] text-primary hover:opacity-90 transition-colors">
                    Voltar ao login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
