/**
 * Faixa fixa de demonstração.
 *
 * Deixa explícito que os dados são fictícios, permite trocar de perfil sem
 * passar pela tela de login (para o visitante comparar o que cada papel enxerga)
 * e oferece o reset do estado.
 */
import { useState } from 'react';
import { FlaskConical, RotateCcw, ChevronDown, Github } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { resetDemo } from './store';
import { DEMO_ACCOUNTS } from './seed';

/** URL do repositório exibida na faixa. Vazio = botão oculto. */
const REPO_URL = import.meta.env.VITE_REPO_URL ?? '';

export function DemoBanner() {
  const { user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function switchTo(username: string) {
    setBusy(true);
    setOpen(false);
    try {
      await logout();
      await login(username, 'demo1234');
      window.location.assign('/');
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    const ok = window.confirm(
      'Isto apaga tudo o que você cadastrou ou alterou nesta demonstração e recarrega os dados de exemplo. Continuar?',
    );
    if (!ok) return;
    resetDemo();
    window.location.assign('/');
  }

  return (
    <div className="sticky top-0 z-100 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        MODO DEMONSTRAÇÃO
      </span>

      <span className="hidden opacity-80 sm:inline">
        Dados fictícios · sem backend · tudo roda no seu navegador
      </span>

      <div className="ml-auto flex items-center gap-2">
        {user && (
          <div className="relative">
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 rounded border border-amber-400 bg-amber-50 px-2 py-0.5 font-medium hover:bg-amber-200 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900 dark:hover:bg-amber-800"
            >
              Perfil: {user.role}
              <ChevronDown className="size-3" aria-hidden />
            </button>

            {open && (
              <div className="absolute right-0 mt-1 w-72 overflow-hidden rounded-md border border-amber-300 bg-white shadow-lg dark:border-amber-800 dark:bg-gray-900">
                <p className="border-b border-amber-200 px-3 py-2 text-[11px] text-gray-500 dark:border-amber-900 dark:text-gray-400">
                  Trocar de perfil para comparar permissões
                </p>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => switchTo(acc.username)}
                    className={`block w-full px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-gray-800 ${
                      user.role === acc.role ? 'bg-amber-50/60 dark:bg-gray-800/60' : ''
                    }`}
                  >
                    <span className="block font-medium text-gray-900 dark:text-gray-100">
                      {acc.label} <span className="opacity-60">({acc.role})</span>
                    </span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">{acc.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {REPO_URL && (
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded border border-amber-400 px-2 py-0.5 font-medium hover:bg-amber-200 dark:border-amber-700 dark:hover:bg-amber-800"
          >
            <Github className="size-3" aria-hidden />
            Código
          </a>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 rounded border border-amber-400 px-2 py-0.5 font-medium hover:bg-amber-200 dark:border-amber-700 dark:hover:bg-amber-800"
        >
          <RotateCcw className="size-3" aria-hidden />
          Resetar dados
        </button>
      </div>
    </div>
  );
}
