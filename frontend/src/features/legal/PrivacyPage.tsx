import { useTranslation } from 'react-i18next';
import { Address, LegalLayout, Section } from './LegalLayout';

/**
 * Datenschutzerklärung (Entwurf). Beschreibt, was dieses Frontend und das Backend laut
 * docs/api/API-CONTRACT.md tatsächlich verarbeiten. Vor dem Livegang rechtlich prüfen lassen.
 */
export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('legal.privacy')}>
      {(c) => (
        <>
          <Section title="1. Verantwortlicher">
            <Address c={c} />
            <p>
              E-Mail:{' '}
              <a className="text-brass hover:underline" href={`mailto:${c.email}`}>
                {c.email}
              </a>
            </p>
          </Section>
          <Section title="2. Grundsätze">
            <p>
              Dieses Spiel ist ein privates, nicht kommerzielles Projekt. Es gibt keine Werbung, keine
              Analyse- oder Tracking-Dienste und keine Cookies. Schriften und alle anderen Dateien werden vom
              eigenen Server ausgeliefert; beim Aufruf werden keine Daten an Dritte (etwa Google Fonts oder
              CDNs) übertragen.
            </p>
          </Section>
          <Section title="3. Welche Daten verarbeitet werden">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-ink">Kontodaten:</strong> E-Mail-Adresse, Benutzername, Passwort (nur
                als sicherer Hash) und der Zeitpunkt deiner Bestätigung, mindestens 18 Jahre alt zu sein.
              </li>
              <li>
                <strong className="text-ink">Spieldaten:</strong> Spielstand, Geld- und Handelsbuchungen,
                Inventar, Fahrzeuge, Reisen, Clan-Mitgliedschaft, Nachrichten und Benachrichtigungen.
              </li>
              <li>
                <strong className="text-ink">Sitzungsdaten:</strong> Anmelde-Sitzungen mit Zeitpunkt,
                IP-Adresse und Browserkennung (User-Agent), um dein Konto vor Missbrauch zu schützen.
              </li>
              <li>
                <strong className="text-ink">Server-Protokolle:</strong> Beim Aufruf der Seite verarbeitet der
                Webserver technisch notwendige Verbindungsdaten (z. B. IP-Adresse, Zeitpunkt, angefragte
                Adresse).
              </li>
            </ul>
          </Section>
          <Section title="4. Zwecke und Rechtsgrundlagen">
            <p>
              Konto-, Spiel- und Sitzungsdaten verarbeiten wir, um dir das Spiel bereitzustellen (Art. 6 Abs.
              1 lit. b DSGVO). Sitzungsdaten und Server-Protokolle dienen außerdem der Sicherheit und
              Missbrauchsabwehr (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO).
            </p>
          </Section>
          <Section title="5. Speicherung im Browser">
            <p>
              Damit du angemeldet bleibst, speichert das Spiel einen Anmeldeschlüssel (Refresh-Token) sowie
              Benutzername und E-Mail-Adresse im lokalen Speicher deines Browsers (localStorage). Das ist für
              den Dienst technisch unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Beim Abmelden wird der
              Eintrag gelöscht.
            </p>
          </Section>
          <Section title="6. Speicherdauer">
            <p>
              Deine Daten werden gespeichert, solange dein Konto besteht. Anmelde-Sitzungen laufen nach
              spätestens 30 Tagen ab. Wenn du dein Konto löschst, werden Konto- und Spieldaten gelöscht;
              Vermögen im Spiel verfällt dabei ersatzlos.
            </p>
          </Section>
          <Section title="7. Empfänger und Hosting">
            <p>
              Eine Weitergabe an Dritte findet nicht statt. Das Spiel läuft auf einem eigenen Server
              {c.hostingProvider ? ` bei ${c.hostingProvider}` : ''}; mit dem Anbieter besteht, soweit
              erforderlich, ein Vertrag zur Auftragsverarbeitung.
            </p>
          </Section>
          <Section title="8. Deine Rechte">
            <p>
              Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Einen vollständigen Export deiner Daten
              und die Löschung deines Kontos kannst du jederzeit selbst im Spiel unter <em>Konto</em>{' '}
              auslösen. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren
              {c.supervisoryAuthority ? `, z. B. bei: ${c.supervisoryAuthority}` : ''}.
            </p>
          </Section>
          {c.lastUpdated && <p className="text-xs text-ink-faint">Stand: {c.lastUpdated}</p>}
        </>
      )}
    </LegalLayout>
  );
}
