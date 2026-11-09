import {
  Bell,
  Building2,
  Car,
  Crosshair,
  Gauge,
  Handshake,
  LineChart,
  Package,
  Route,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  key: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: 'groupStreet',
    items: [
      { to: '/', key: 'dashboard', icon: Gauge },
      { to: '/stadt', key: 'city', icon: Building2 },
      { to: '/handel', key: 'trade', icon: Handshake },
      { to: '/reisen', key: 'travel', icon: Route },
    ],
  },
  {
    key: 'groupProperty',
    items: [
      { to: '/inventar', key: 'inventory', icon: Package },
      { to: '/fahrzeuge', key: 'vehicles', icon: Car },
      { to: '/waffen', key: 'weapons', icon: Crosshair },
    ],
  },
  {
    key: 'groupWorld',
    items: [
      { to: '/markt', key: 'market', icon: LineChart },
      { to: '/clans', key: 'clans', icon: Users },
      { to: '/ranglisten', key: 'rankings', icon: Trophy },
    ],
  },
  {
    key: 'groupMe',
    items: [
      { to: '/meldungen', key: 'notifications', icon: Bell },
      { to: '/konto', key: 'account', icon: UserRound },
    ],
  },
];

/** Hauptpunkte der mobilen Navigation; der Rest liegt im „Mehr“-Sheet. */
export const MOBILE_PRIMARY = ['/', '/handel', '/reisen', '/inventar'];
