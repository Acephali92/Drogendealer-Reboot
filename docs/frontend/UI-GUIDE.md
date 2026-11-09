# UI-Richtlinien (Frontend)

Owner: Agent 4. Gilt für alles unter `frontend/`. Entscheidungen: ADR-008 (Stack), ADR-013 (Ton, ab 18),
ADR-015 (Datenschutz, keine Tracker), ADR-019 (Geld in Cent).

## Charakter

- **Dunkel, urban, Neon-Akzente.** Schwarzbraune Flächen, Messing/Bernstein als Primärfarbe (Erbe des Originals),
  Neon-Grün für Geld und Gewinn, Rot für Gefahr und Verlust.
- **Satirisch-überzeichnet im Ton (ADR-013),** aufgeräumt in der Bedienung. Straßenjargon in Texten, nicht im Layout.
- **Erbe des Originals bewusst zitieren:** Live-Ticker oben („X erreicht die Stadt Y“), Stadtübersicht als
  Werte-Tabelle, gelbes Ortsschild, Handelskarte „Bestand Stadt | Bestand Spieler“.
- **Keine Fremdgrafiken.** Stadt- und Fahrzeugbilder werden als SVG erzeugt (`CityArt`, `VehicleArt`), Waren nutzen
  Symbole (`CommodityIcon`). Eigene Illustrationen im Comic-Stil können diese später 1:1 ersetzen.

## Design-Tokens

Alle Farben sind CSS-Variablen in `src/styles/index.css` und als Tailwind-Farben verfügbar. Keine Hex-Werte in
Komponenten (Ausnahme: Medaillen in Ranglisten, Ortsschild).

| Token | Verwendung |
|---|---|
| `bg`, `surface`, `surface-2/3` | Hintergrund, Panels, Hover/Eingaben |
| `ink`, `ink-muted`, `ink-faint` | Text: primär, sekundär, Labels |
| `brass` | Primäraktionen, aktive Navigation, Überschriften in Panels |
| `neon` | Geld, Gewinn, Verkaufen |
| `danger` | Fehler, Verlust, Fahndung hoch, Löschen |
| `info`, `warn` | Reisen/Status, Hinweise |

**Schriften** (selbst gehostet über `@fontsource`, ADR-015): Inter (Text), Space Grotesk (Überschriften),
JetBrains Mono mit Tabellenziffern (`.num`) für **alle** Zahlen, Preise und Zeiten.

## Bausteine (`src/components/ui`)

`Button` (primary · neon · outline · ghost · danger), `Panel`, `StatTile`, `Badge`, `Tabs`, `Modal` (am Handy
Bottom-Sheet), `NumberStepper` (mit „Max“), `ProgressBar`, `Countdown`, `Money`, `Field`, `Toaster`,
`Skeleton`/`EmptyState`/`ErrorState`. Neue Seiten setzen sich aus diesen Bausteinen zusammen.

## Regeln

1. **Texte nur aus `src/i18n/de.json`.** Keine deutschen Strings in Komponenten (Ausnahme: Rechtstexte unter
   `features/legal`). Weitere Sprachen: `en.json` anlegen und in `i18n/index.ts` registrieren.
2. **Interne Schlüssel nie anzeigen (T-112).** Immer `name` anzeigen, nie `slug`, `id`, `type` oder Enum-Werte.
   Enum-Übersetzungen immer mit `defaultValue`, damit nie ein Schlüssel wie `clans.roles.X` sichtbar wird.
3. **Geld** nur über `Money`/`formatMoney` anzeigen und nur mit `BigInt` rechnen (`lib/money.ts`). Werte sind Cent.
4. **Fehlende Werte** (`null`) zeigen „—“ oder blenden die Zeile aus, statt 0 vorzutäuschen.
5. **Jede Datenansicht** hat Lade- (`Skeleton`), Leer- (`EmptyState`) und Fehlerzustand (`ErrorState`).
6. **Server-Fehler** übersetzt `errorMessage()` anhand des Codes; Erfolg und Fehler von Aktionen melden Toasts.
7. **Server-State** nur über die Hooks in `api/queries.ts`; Antwortformate nur über `api/adapters.ts`.
8. **Responsive:** Mobile-first. Unter `lg` Bottom-Navigation (4 Hauptpunkte + „Mehr“-Sheet), ab `lg` Sidebar.
   Tabellen werden am Handy zu Karten. Keine horizontale Seiten-Scrollleiste ab 360 px.
9. **Barrierefreiheit:** sichtbarer Fokus-Ring, Tastaturbedienung (Tabs mit Pfeiltasten, Dialoge mit Esc und
   Fokusfalle), `aria-label` für Icon-Buttons, Kontrast mindestens WCAG AA, `prefers-reduced-motion` wird beachtet.
10. **Datenschutz (ADR-015):** keine externen Ressourcen (Fonts, CDNs, Bilder), keine Tracker, keine Cookies.
    Im Browser gespeichert werden nur Refresh-Token und Nutzer (`stores/auth.ts`).
11. **Ab 18 (ADR-013):** Registrierung nur mit Bestätigung; Hinweis „18+“ in Footer und Login.
12. **Mocks** laufen nur in der Entwicklung. Ein Production-Build enthält keinen Mock-Code (CI-Schritt
    `check:no-mocks`).
