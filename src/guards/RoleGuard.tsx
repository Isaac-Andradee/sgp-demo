import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface Props {
  children: React.ReactNode;
  /** Role exata ou lista de roles permitidas. DEV herda permissões de ADMIN automaticamente. */
  requiredRole: UserRole | UserRole[];
}

export function RoleGuard({ children, requiredRole }: Props) {
  const { user } = useAuth();
  const role = user?.role;

  const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // DEV é tratado como ADMIN para fins de autorização de telas administrativas
  const effectiveRoles = allowed.includes('ADMIN') && !allowed.includes('DEV')
    ? [...allowed, 'DEV']
    : allowed;

  if (!role || !effectiveRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
