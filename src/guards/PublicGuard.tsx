import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
}

/**
 * Envolve rotas públicas (login, forgot-password).
 * Se o usuário já está autenticado → redireciona para /.
 */
export function PublicGuard({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
