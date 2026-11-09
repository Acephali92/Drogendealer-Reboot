import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      className="min-h-[50vh]"
      icon={<SearchX className="h-6 w-6" />}
      title={t('errors.notFound')}
      hint={t('errors.notFoundHint')}
      action={
        <Link to="/">
          <Button variant="primary">{t('errors.home')}</Button>
        </Link>
      }
    />
  );
}
