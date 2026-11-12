import { useTranslation } from 'react-i18next';
import { Address, LegalLayout, Section } from './LegalLayout';

export function ImprintPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('legal.imprint')}>
      {(c) => (
        <>
          <Section title="Angaben gemäß § 5 DDG">
            <Address c={c} />
          </Section>
          <Section title="Kontakt">
            <p>
              E-Mail:{' '}
              <a className="text-brass hover:underline" href={`mailto:${c.email}`}>
                {c.email}
              </a>
              {c.phone && (
                <>
                  <br />
                  Telefon: {c.phone}
                </>
              )}
            </p>
          </Section>
          {c.contentResponsible && (
            <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
              <p>{c.contentResponsible}</p>
            </Section>
          )}
          <Section title="Hinweis zum Angebot">
            <p>
              Drogendealer ist ein privat betriebenes, nicht kommerzielles und satirisches Browserspiel für
              Erwachsene (ab 18). Alle Orte, Waren, Personen und Ereignisse im Spiel sind fiktiv und
              überzeichnet. Das Spiel ruft weder zum Konsum noch zum Handel mit Drogen auf. Es gibt keine
              Werbung und keine Tracker.
            </p>
          </Section>
          <Section title="Haftung für Links">
            <p>
              Für Inhalte externer Seiten, auf die verlinkt wird, sind ausschließlich deren Betreiber
              verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden entsprechende Links umgehend
              entfernt.
            </p>
          </Section>
        </>
      )}
    </LegalLayout>
  );
}
