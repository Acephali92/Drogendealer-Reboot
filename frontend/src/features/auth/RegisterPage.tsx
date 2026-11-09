import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Check, Lock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/stores/auth';
import { errorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { AuthLayout } from './AuthLayout';
import { validateRegistration } from './validation';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', username: '', password: '', ageConfirmed: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errs = validateRegistration(form);
  const valid = !errs.email && !errs.username && !errs.password && !errs.ageConfirmed;
  const show = (k: keyof typeof errs) => (touched[k] && errs[k] ? t(errs[k]!) : null);
  const set = (k: 'email' | 'username' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const blur = (k: string) => () => setTouched((x) => ({ ...x, [k]: true }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ email: true, username: true, password: true, ageConfirmed: true });
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.register(form.email.trim(), form.username.trim(), form.password, form.ageConfirmed);
      qc.clear();
      useAuth.getState().setSession(res);
      navigate('/start', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label={t('auth.username')}
          autoComplete="username"
          icon={<User className="h-4 w-4" />}
          value={form.username}
          onChange={set('username')}
          onBlur={blur('username')}
          hint={t('auth.usernameHint')}
          error={show('username')}
          maxLength={20}
        />
        <Field
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          icon={<AtSign className="h-4 w-4" />}
          value={form.email}
          onChange={set('email')}
          onBlur={blur('email')}
          error={show('email')}
        />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          value={form.password}
          onChange={set('password')}
          onBlur={blur('password')}
          hint={t('auth.passwordHint')}
          error={show('password')}
        />
        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.ageConfirmed}
              onChange={(e) => {
                setForm((f) => ({ ...f, ageConfirmed: e.target.checked }));
                setTouched((x) => ({ ...x, ageConfirmed: true }));
              }}
              aria-invalid={!!show('ageConfirmed')}
              aria-describedby="age-msg"
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-bg ring-1 ring-line/30 transition peer-checked:bg-brass peer-checked:ring-brass peer-focus-visible:ring-2 peer-focus-visible:ring-brass/70 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
            >
              <Check className="h-3.5 w-3.5 text-bg" strokeWidth={3} />
            </span>
            <span>
              {t('auth.ageConfirm')} <span className="text-danger">*</span>
            </span>
          </label>
          <p id="age-msg" className={show('ageConfirmed') ? 'mt-1 text-xs text-danger' : 'mt-1 text-xs text-ink-faint'}>
            {show('ageConfirmed') ?? t('auth.ageHint')}
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/30">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          {t('auth.submitRegister')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-brass hover:underline">
          {t('auth.toLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
