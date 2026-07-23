import { useEffect } from "react";
import { Link } from "react-router";
import { UserX, LogIn, Network } from "lucide-react";
import { authApi } from "../api/auth.api";
import { usePageTitle } from "../hooks/usePageTitle";
import { ThemeSwitcher } from "./theme-switcher";

/**
 * Página exibida quando o usuário está desativado (401 com mensagem de conta desativada).
 * Chama POST /logout para o backend enviar Set-Cookie com Max-Age=0 e limpar o cookie no navegador,
 * permitindo que, após reativação, o usuário faça login normalmente.
 */
export function ContaDesativadaPage() {
  usePageTitle("Conta desativada");

  useEffect(() => {
    authApi.logout().catch(() => {
      // Ignora erro (ex.: rede); a página segue exibida e o usuário pode ir ao login
    });
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 dark:from-background dark:via-background dark:to-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 dark:opacity-5"
          style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }}
        />
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
          <div className="p-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center border border-amber-200 dark:border-amber-700">
                <UserX className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-[20px] text-foreground" style={{ fontWeight: 600 }}>
              Sua conta foi desativada
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              O acesso à sua conta foi desativado por um administrador. Para voltar a usar o sistema,
              entre em contato com a administração para reativar sua conta. Depois, faça login
              novamente na tela de entrada.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-[14px] transition-colors shadow-lg shadow-sky-600/20 dark:shadow-none"
              style={{ fontWeight: 600 }}
            >
              <LogIn className="w-4 h-4" />
              Ir para login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
