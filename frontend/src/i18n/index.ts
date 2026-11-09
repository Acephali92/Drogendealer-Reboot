import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de.json';

/**
 * Alle UI-Texte liegen in Sprachdateien. Weitere Sprachen: `en.json` anlegen
 * und unter `resources` registrieren – Komponenten bleiben unverändert.
 */
void i18n.use(initReactI18next).init({
  resources: { de: { translation: de } },
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
