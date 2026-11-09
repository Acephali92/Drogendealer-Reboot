# Frontend

React 18 · TypeScript · Vite · Tailwind · TanStack Query · Zustand · i18next · MSW (ADR-008).

## Schnellstart

```bash
npm ci
npm run dev        # http://localhost:5173 – komplett mit simulierter API, kein Backend nötig
```

Gegen das echte Backend (`backend/`, Port 3000; der Vite-Proxy leitet `/api` weiter):

```bash
VITE_USE_MOCKS=off npm run dev      # alles echt
VITE_USE_MOCKS=hybrid npm run dev   # Login echt, Spiel-Endpunkte simuliert
```

| Variable           | Standard                 | Bedeutung                |
| ------------------ | ------------------------ | ------------------------ |
| `VITE_USE_MOCKS`   | Dev: `all`, Build: `off` | `all` / `hybrid` / `off` |
| `VITE_API_URL`     | `/api/v1`                | Basis-URL der API        |
| `VITE_BACKEND_URL` | `http://localhost:3000`  | Ziel des Dev-Proxys      |

## Prüfen

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
npm run build && npm run check:no-mocks
```

## Struktur

| Pfad                  | Inhalt                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| `src/api/contract.ts` | Rohformate aus `docs/api/API-CONTRACT.md`                                   |
| `src/api/adapters.ts` | Übersetzung in UI-Modelle (`src/api/types.ts`)                              |
| `src/api/queries.ts`  | TanStack-Query-Hooks, Polling, Invalidierung                                |
| `src/mocks/`          | Mock-Server im Vertragsformat, Daten aus `docs/game-design/parameters.toml` |
| `vite/gameParams.ts`  | liest `parameters.toml` beim Build (Bild-Platzhalter, Mock-Daten)           |
| `public/images/`      | Spielbilder und Platzhalter, Anleitung in `public/images/README.md`         |
| `src/components/`     | UI-Bausteine und Layout                                                     |
| `src/features/`       | Seiten je Bereich                                                           |
| `src/i18n/de.json`    | alle Texte                                                                  |

## Betrieb (ADR-014)

`npm run build` erzeugt `dist/`, das Caddy statisch ausliefert (SPA-Fallback auf `index.html`).
Der Build liest `../docs/game-design/parameters.toml`; ein Docker-Build braucht daher das Repo-Root als Kontext.
Auf dem Server zusätzlich ablegen, **nicht ins Repo**:

- `/legal.json`: echte Betreiberangaben für Impressum und Datenschutz, Vorlage `public/legal.example.json` (T-307).
- `/age-de.xml` liegt als **Vorlage** bei. Vor dem Livegang mit dem offiziellen Generator (age-label.de) prüfen und
  ersetzen (T-305).

Richtlinien: [`docs/frontend/UI-GUIDE.md`](../docs/frontend/UI-GUIDE.md) · API-Anforderungen:
[`docs/frontend/API-CONTRACT.md`](../docs/frontend/API-CONTRACT.md).
