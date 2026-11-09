import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/stores/auth';

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    const token = useAuth.getState().refreshToken;
    useAuth.getState().clear();
    qc.clear();
    navigate('/login', { replace: true });
    if (token) await authApi.logout(token).catch(() => undefined);
  };
}
