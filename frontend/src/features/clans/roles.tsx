import { Crown, Feather, Shield, Sword, UserRound } from 'lucide-react';
import type { ClanRole } from '@/api/types';
import type { Tone } from '@/components/ui/Badge';

/** Rangfolge laut Vertrag (Pate → Mitläufer); Anzeigenamen stehen in i18n `clans.roles.*`. */
export const ROLE_ORDER: Record<ClanRole, number> = {
  GODFATHER: 0,
  CONSIGLIERE: 1,
  CAPO: 2,
  SOLDIER: 3,
  ASSOCIATE: 4,
};

export const ROLE_ICON: Record<ClanRole, JSX.Element> = {
  GODFATHER: <Crown className="h-3 w-3" />,
  CONSIGLIERE: <Feather className="h-3 w-3" />,
  CAPO: <Shield className="h-3 w-3" />,
  SOLDIER: <Sword className="h-3 w-3" />,
  ASSOCIATE: <UserRound className="h-3 w-3" />,
};

export const ROLE_TONE: Record<ClanRole, Tone> = {
  GODFATHER: 'brass',
  CONSIGLIERE: 'info',
  CAPO: 'info',
  SOLDIER: 'neutral',
  ASSOCIATE: 'neutral',
};

/** Vorläufig: Einladen dürfen Pate, Consigliere und Capo (Rechte-Matrix: docs/game-design/clans.md 3.1). */
export const canInvite = (role: ClanRole | undefined) =>
  role !== undefined && ROLE_ORDER[role] <= ROLE_ORDER.CAPO;
