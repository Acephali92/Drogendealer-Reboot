import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/stores/auth';
import { errorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.login(login.trim(), password);
      qc.clear();
      useAuth.getState().setSession(res);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label={t('auth.login')}
          autoComplete="username"
          icon={<User className="h-4 w-4" />}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/30">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!login || !password}>
          {t('auth.submitLogin')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/registrieren" className="text-brass hover:underline">
          {t('auth.toRegister')}
        </Link>
      </p>
    </AuthLayout>
  );
}
