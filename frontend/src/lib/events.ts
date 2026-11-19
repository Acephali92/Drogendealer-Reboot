import { eventNames } from 'virtual:game-labels';
import i18n from '@/i18n';

/** Anzeigename eines Marktereignisses aus parameters.toml – nie der Schlüssel (T-112). */
export const eventLabel = (key: string | null | undefined): string | null =>
  key ? (eventNames[key] ?? i18n.t('market.eventUnknown')) : null;
