import axios from 'axios';
import { toast } from 'sonner';
import { demoAdapter } from '../demo/adapter';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

/**
 * MODO DEMONSTRAÇÃO
 *
 * Este repositório é a versão de portfólio do SGP: não há backend. Trocar o
 * adapter do axios faz com que toda chamada seja resolvida em memória, sem
 * tocar a rede. Nenhum módulo de API, componente ou hook precisou mudar —
 * a camada de API já concentrava todas as requisições em uma instância só.
 */
api.defaults.adapter = demoAdapter;

/** Backend libera DEV em manutenção; o front não redireciona para /maintenance quando o usuário é DEV. */
let devBypassMaintenance = false;
export function setDevBypassMaintenance(value: boolean) {
  devBypassMaintenance = value;
}
export function isDevBypassMaintenance(): boolean {
  return devBypassMaintenance;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const currentPath = window.location.pathname;

    // 503 Service Unavailable → sistema em manutenção. Não redireciona se: já está em /maintenance, está em /dev, ou usuário é DEV (backend dá acesso total em manutenção).
    if (status === 503 && currentPath !== '/maintenance' && currentPath !== '/dev' && !devBypassMaintenance) {
      window.location.replace('/maintenance');
      return Promise.reject(error);
    }

    // 401 Unauthorized → sessão expirada, conta desativada ou não autenticado.
    // O backend identifica o dono do token (JWT) em cada requisição; se esse usuário estiver
    // com enabled=false, responde 401 (ex.: "Conta desativada. Acesso não autorizado.").
    if (status === 401) {
      const message = error.response?.data?.message as string | undefined;
      if (message) toast.error(message);
      const isPublicPage = currentPath === '/login'
        || currentPath === '/setup'
        || currentPath === '/maintenance';
      const isContaDesativadaPage = currentPath === '/conta-desativada';
      if (!isPublicPage && !isContaDesativadaPage) {
        const isContaDesativada = typeof message === 'string' && message.toLowerCase().includes('desativad');
        window.location.replace(isContaDesativada ? '/conta-desativada' : '/login');
      }
    }

    return Promise.reject(error);
  }
);
