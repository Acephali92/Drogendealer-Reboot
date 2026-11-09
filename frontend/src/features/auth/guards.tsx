import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { useMe } from '@/api/queries';
import { Spinner } from '@/components/ui/Feedback';
import { Logo } from '@/components/layout/Logo';

export function FullscreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <Spinner />
      </div>
    </div>
  );
}

/** Nur für angemeldete Spieler. Ohne Startstadt geht es zuerst zur Auswahl. */
export function RequireAuth() {
  const hasSession = useAuth((s) => !!s.refreshToken);
  const location = useLocation();
  const me = useMe();
  if (!hasSession) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me.isPending) return <FullscreenLoader />;
  const p = me.data;
  if (p && !p.currentCityId && p.status !== 'TRAVELING' && location.pathname !== '/start') {
    return <Navigate to="/start" replace />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const hasSession = useAuth((s) => !!s.refreshToken);
  return hasSession ? <Navigate to="/" replace /> : <Outlet />;
}

export function Fullscreen() {
  return (
    <Suspense fallback={<FullscreenLoader />}>
      <Outlet />
    </Suspense>
  );
}
