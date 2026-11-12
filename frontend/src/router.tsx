import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Fullscreen, RedirectIfAuthed, RequireAuth } from '@/features/auth/guards';
import { Skeleton } from '@/components/ui/Feedback';
import { NotFoundPage } from '@/features/NotFoundPage';

type PageComponent = () => JSX.Element | null;

/** Seiten werden bei Bedarf nachgeladen (kleineres Start-Bundle). */
function page(loader: () => Promise<unknown>, name: string) {
  const C = lazy(async () => ({ default: ((await loader()) as Record<string, PageComponent>)[name]! }));
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <C />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  /* Öffentlich: Impressum und Datenschutz (T-307) */
  {
    element: <Fullscreen />,
    children: [
      { path: '/impressum', element: page(() => import('@/features/legal/ImprintPage'), 'ImprintPage') },
      { path: '/datenschutz', element: page(() => import('@/features/legal/PrivacyPage'), 'PrivacyPage') },
    ],
  },
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/login', element: page(() => import('@/features/auth/LoginPage'), 'LoginPage') },
      { path: '/registrieren', element: page(() => import('@/features/auth/RegisterPage'), 'RegisterPage') },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Fullscreen />,
        children: [
          { path: '/start', element: page(() => import('@/features/city/StartCityPage'), 'StartCityPage') },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { index: true, element: page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage') },
          { path: 'stadt', element: page(() => import('@/features/city/CityPage'), 'CityPage') },
          { path: 'reisen', element: page(() => import('@/features/city/TravelPage'), 'TravelPage') },
          { path: 'handel', element: page(() => import('@/features/trade/TradePage'), 'TradePage') },
          {
            path: 'inventar',
            element: page(() => import('@/features/inventory/InventoryPage'), 'InventoryPage'),
          },
          {
            path: 'fahrzeuge',
            element: page(() => import('@/features/vehicles/VehiclesPage'), 'VehiclesPage'),
          },
          { path: 'waffen', element: page(() => import('@/features/weapons/WeaponsPage'), 'WeaponsPage') },
          { path: 'markt', element: page(() => import('@/features/market/MarketPage'), 'MarketPage') },
          { path: 'clans', element: page(() => import('@/features/clans/ClansPage'), 'ClansPage') },
          {
            path: 'clans/:id',
            element: page(() => import('@/features/clans/ClanDetailPage'), 'ClanDetailPage'),
          },
          {
            path: 'ranglisten',
            element: page(() => import('@/features/rankings/RankingsPage'), 'RankingsPage'),
          },
          {
            path: 'meldungen',
            element: page(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage'),
          },
          { path: 'konto', element: page(() => import('@/features/account/AccountPage'), 'AccountPage') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
