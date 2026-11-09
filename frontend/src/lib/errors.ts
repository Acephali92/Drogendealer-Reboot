import i18n from '@/i18n';
import { ApiError } from '@/api/client';

/** Übersetzt API-Fehlercodes in Klartext (i18n `errors.*`), sonst Servertext. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const key = `errors.${e.code}`;
    if (i18n.exists(key)) return i18n.t(key);
    // Vertrag: 404 *_NOT_FOUND, 409 *_TAKEN
    if (e.code.endsWith('_NOT_FOUND')) return i18n.t('errors.NOT_FOUND');
    if (e.code.endsWith('_TAKEN')) return i18n.t('errors.TAKEN');
    return e.message || i18n.t('errors.generic');
  }
  return i18n.t('errors.generic');
}
