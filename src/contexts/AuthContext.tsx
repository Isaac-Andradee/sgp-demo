import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { UserResponse } from '../types';
import { authApi } from '../api/auth.api';
import { api, setDevBypassMaintenance, isDevBypassMaintenance } from '../api/client';

interface AuthContextValue {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    setIsLoading(true);
    let is503 = false;
    try {
      const response = await api.get<UserResponse>('/auth/me', {
        validateStatus: (s) => s < 500,
      });
      if (response.status === 200) {
        const me = response.data;
        if (me.enabled === false) {
          setDevBypassMaintenance(false);
          setUser(null);
          if (window.location.pathname !== '/login' && window.location.pathname !== '/maintenance') {
            window.location.replace('/login');
          }
          return;
        }
        setUser(me);
        setDevBypassMaintenance(me.role === 'DEV');
      } else {
        setDevBypassMaintenance(false);
        setUser(null);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const isMaintenance = status === 503 || (typeof status === 'number' && status >= 500 && status < 600);
      if (isMaintenance) {
        is503 = true;
        // Backend libera DEV em manutenção; não redirecionar nem limpar user se for DEV (ou se estiver em /dev).
        const path = window.location.pathname;
        if (path !== '/maintenance' && path !== '/dev' && !isDevBypassMaintenance()) {
          setDevBypassMaintenance(false);
          window.location.replace('/maintenance');
        } else {
          setIsLoading(false);
        }
        return;
      }
      setDevBypassMaintenance(false);
      setUser(null);
    } finally {
      if (!is503) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (username: string, password: string) => {
    await authApi.login({ username, password });
    await fetchMe();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignora erro
    } finally {
      setDevBypassMaintenance(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refetchUser: fetchMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  const isDev   = role === 'DEV';
  const isAdmin  = role === 'ADMIN' || isDev; // DEV herda tudo que ADMIN pode fazer
  return {
    isAdmin,
    isDev,
    isViewer: role === 'VIEWER',
    canManageUsers:     isAdmin,
    canCreateEquipment: role !== 'VIEWER',
    canEditEquipment:   isAdmin || role === 'USER',
    canDeleteEquipment: isAdmin,
    canManageSectors:   isAdmin, // somente ADMIN e DEV podem criar/editar/excluir setores
    canViewAudit:       isAdmin,
    canControlSystem:   isDev, // somente DEV pode gerenciar manutenção e configs do sistema
  };
}
