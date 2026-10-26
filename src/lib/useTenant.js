import { useAuth } from '@/lib/AuthContext';

export function useTenant() {
  const { user } = useAuth();

  // Use user ID as tenant identifier so each user has isolated data
  const tenant_id = user?.id || null;

  return { tenant_id, user, isReady: !!tenant_id };
}
