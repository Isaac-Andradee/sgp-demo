/**
 * Painel de acesso rápido exibido na tela de login da demonstração.
 *
 * Entra direto com cada perfil para o visitante comparar o que cada papel vê —
 * o controle de acesso é a parte do sistema que mais se perde em screenshot.
 */
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './seed';

export function DemoAccountPicker() {
  const { login } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  async function enter(username: string) {
    setBusy(username);
    try {
      await login(username, DEMO_PASSWORD);
      // Recarrega na raiz: evita depender do estado interno da tela de login.
      window.location.assign('/');
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900 dark:text-amber-200">
        <KeyRound className="size-3.5 shrink-0" aria-hidden />
        Acesso de demonstração
      </p>
      <p className="mt-1 text-[12px] text-amber-800/80 dark:text-amber-300/80">
        Entre com um dos perfis para ver como as permissões mudam a interface.
      </p>

      <div className="mt-3 grid gap-1.5">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.username}
            type="button"
            disabled={busy !== null}
            onClick={() => enter(acc.username)}
            className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left transition hover:border-amber-400 hover:bg-amber-100/60 disabled:opacity-60 dark:border-amber-900 dark:bg-gray-900 dark:hover:border-amber-700 dark:hover:bg-gray-800"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-gray-100">
                {acc.label}
                <span className="ml-1.5 text-[11px] font-normal opacity-60">{acc.role}</span>
              </span>
              <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{acc.hint}</span>
            </span>
            <span className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400">
              {busy === acc.username ? 'entrando…' : 'entrar'}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-amber-800/70 dark:text-amber-300/70">
        Ou use qualquer login acima com a senha <code className="font-mono">{DEMO_PASSWORD}</code>.
        Nesta demonstração a senha não é verificada.
      </p>
    </div>
  );
}
