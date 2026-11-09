import { Bell, Crosshair, Handshake, Mail, Megaphone, Route, Users } from 'lucide-react';
import type { NotificationKind } from '@/api/types';
import { cn } from '@/lib/cn';

const MAP: Record<NotificationKind, { icon: typeof Bell; cls: string }> = {
  TRAVEL_ARRIVED: { icon: Route, cls: 'bg-info/10 text-info' },
  TRADE: { icon: Handshake, cls: 'bg-neon/10 text-neon' },
  CLAN_INVITE: { icon: Users, cls: 'bg-brass/10 text-brass' },
  MESSAGE: { icon: Mail, cls: 'bg-info/10 text-info' },
  COMBAT: { icon: Crosshair, cls: 'bg-danger/10 text-danger' },
  EVENT: { icon: Megaphone, cls: 'bg-warn/10 text-warn' },
  SYSTEM: { icon: Bell, cls: 'bg-surface-3 text-ink-muted' },
};

export function NotificationIcon({ kind, className }: { kind: NotificationKind; className?: string }) {
  const { icon: Icon, cls } = MAP[kind] ?? MAP.SYSTEM;
  return (
    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', cls, className)} aria-hidden>
      <Icon className="h-4 w-4" />
    </span>
  );
}
