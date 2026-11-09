import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, CheckCheck, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications, useReadNotification } from '@/api/queries';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatDateTime, formatRelative } from '@/lib/time';
import { cn } from '@/lib/cn';
import { NotificationIcon } from './NotificationIcon';

export function NotificationsPage() {
  const { t } = useTranslation();
  const list = useNotifications();
  const read = useReadNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const unread = list.data?.filter((n) => !n.readAt).length ?? 0;
  const rows = (list.data ?? []).filter((n) => filter === 'all' || !n.readAt);

  return (
    <div>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={
          <Button size="sm" disabled={!unread} loading={read.isPending && read.variables === 'all'} onClick={() => read.mutate('all')}>
            <CheckCheck className="h-4 w-4" />
            {t('notifications.markAll')}
          </Button>
        }
      />
      <Tabs
        className="mb-5"
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: t('notifications.all') },
          { value: 'unread', label: t('notifications.unread'), count: unread },
        ]}
      />
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.isPending && <Skeleton className="h-64" />}
      {list.data && (
        <div className="panel overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={<BellOff className="h-6 w-6" />} title={t('notifications.empty')} />
          ) : (
            <ul className="divide-y divide-line/5">
              {rows.map((n) => {
                const body = (
                  <>
                    <NotificationIcon kind={n.kind} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', n.readAt ? 'text-ink-muted' : 'font-semibold text-ink')}>{n.title}</p>
                      {n.body && <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p>}
                      <p className="mt-1 text-xs text-ink-faint" title={formatDateTime(n.createdAt)}>
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass shadow-glow" aria-label={t('notifications.unread')} />}
                    {n.link && <ChevronRight className="h-4 w-4 shrink-0 self-center text-ink-faint" aria-hidden />}
                  </>
                );
                const cls = cn('flex gap-3 px-4 py-4 transition hover:bg-surface-2/60', !n.readAt && 'bg-brass/[0.03]');
                const markRead = () => !n.readAt && read.mutate(n.id);
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} className={cls} onClick={markRead}>
                        {body}
                      </Link>
                    ) : (
                      <button className={cn(cls, 'w-full text-left')} onClick={markRead}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
