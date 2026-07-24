import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Role } from '../types';
import { Spinner } from '../components/Spinner';

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return <Spinner label="Checking session…" />;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <>{children}</>;
}
