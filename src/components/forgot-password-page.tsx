import { useState } from "react";
import { Link } from "react-router";
import { Network, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "../api/auth.api";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";

function validateEmail(value: string): string | null {
  const t = value.trim();
  if (!t) return "Email é obrigatório.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Email inválido.";
  return null;
}

export function ForgotPasswordPage() {
  usePageTitle("Recuperar Senha");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setFieldError(err ?? null);
    if (err) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
    } catch {
      // always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 dark:opacity-5" style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
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
            {sent ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h3 className="text-[18px] text-foreground" style={{ fontWeight: 600 }}>Email enviado</h3>
                <p className="text-[13px] text-muted-foreground">
                  Se este email estiver cadastrado, você receberá um link para redefinir a senha.
                </p>
                <Link
                  to="/login"
                  className="mt-4 inline-flex items-center gap-2 text-[13px] text-primary hover:opacity-90 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <>
                <h3 className="text-[18px] text-foreground mb-1 text-center" style={{ fontWeight: 600 }}>
                  Esqueceu a senha?
                </h3>
                <p className="text-[13px] text-muted-foreground mb-6 text-center">
                  Informe seu email para receber o link de redefinicao.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 500 }}>Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEmail(v);
                          setFieldError(validateEmail(v));
                        }}
                        required
                        className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-[14px] text-foreground placeholder:text-muted-foreground ${fieldError ? "border-red-500 dark:border-red-500" : "border-border"}`}
                        placeholder="seu@email.com"
                      />
                    </div>
                    {fieldError && <p className="text-[11px] text-red-500 mt-1">{fieldError}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:opacity-90 text-primary-foreground py-3 rounded-xl shadow-lg shadow-sky-600/20 dark:shadow-none transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-[14px]"
                    style={{ fontWeight: 600 }}
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 dark:border-primary-foreground/30 border-t-white dark:border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      "Enviar link de redefinicao"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/login" className="inline-flex items-center gap-1 text-[13px] text-primary hover:opacity-90 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
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
