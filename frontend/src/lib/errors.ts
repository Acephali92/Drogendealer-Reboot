import i18n from '@/i18n';
import { ApiError } from '@/api/client';

/** Übersetzt API-Fehlercodes in Klartext (i18n `errors.*`), sonst Servertext. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const key = `errors.${e.code}`;
    return i18n.exists(key) ? i18n.t(key) : e.message || i18n.t('errors.generic');
  }
  return i18n.t('errors.generic');
}
