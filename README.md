# Drogendealer-Reboot

Satirisches Echtzeit-Mehrspieler-Browsergame mit dauerhafter Welt: Handel, Reisen, Geldwäsche, Kampf und Clans. Für Erwachsene (ab 18).

**Status (Meilenstein M1 – Wirtschaftskern):**
- Die **Spieloberfläche** ist komplett durchspielbar, vorerst mit simulierten Spieldaten.
- Das **Backend** legt echte Konten an, bucht 2.000 € Startkapital und kennt alle 12 Städte, Waren und Fahrzeuge aus den Spielregeln. Die Preis- und Handelsformeln sind fertig.
- **Noch nicht im Backend:** Spielaktionen (Kaufen, Verkaufen, Reisen, Waschen) und der Markt-Takt. Deshalb sind die Märkte im echten Backend noch leer.

---

## Was kann ich heute testen?

| Test | Was du siehst | Dauer | Voraussetzungen |
|------|---------------|-------|-----------------|
| **A – Spieloberfläche** (empfohlen) | Das ganze Spiel im Browser, alle Daten simuliert: Registrieren, Startstadt, Handel, Reisen (Bahn oder Fahrzeug), Inventar, Bargeld und Bankkonto getrennt, Clans, Ranglisten | ca. 3 Minuten | Node.js |
| **B – Spieloberfläche mit echtem Konto** | Wie A, aber Registrierung und Login laufen über den echten Server und die echte Datenbank | ca. 10 Minuten | Node.js, Docker |
| **C – Backend allein** | Der echte Server ohne Oberfläche: Konto anlegen, Startkapital, Städte und Waren abrufen | ca. 10 Minuten | Node.js, Docker |
| **D – Automatische Tests** | Alle Prüfungen, die GitHub bei jeder Änderung ausführt | ca. 5 Minuten | Node.js, Docker, Python 3 |

---

## Einmalig: Voraussetzungen installieren

- **Node.js 20 oder neuer** (empfohlen: 22 LTS) von <https://nodejs.org>. Prüfen mit `node -v`.
- **Git** von <https://git-scm.com>.
- Nur für B, C und D: **Docker Desktop** von <https://www.docker.com/products/docker-desktop> (muss beim Testen laufen).
- Nur für D: **Python 3** von <https://www.python.org>.

Projekt herunterladen:

```bash
git clone https://github.com/Acephali92/Drogendealer-Reboot.git
```

```bash
cd Drogendealer-Reboot
```

Schon einmal heruntergeladen? Dann stattdessen den neuesten Stand holen (im Projektordner):

```bash
git pull
```

Alle folgenden Befehle starten im Projektordner.

---

## A – Spieloberfläche testen (ohne Backend)

1. In den Frontend-Ordner wechseln:

   ```bash
   cd frontend
   ```

2. Abhängigkeiten installieren (beim ersten Mal und nach jedem `git pull`, dauert etwa eine Minute):

   ```bash
   npm install
   ```

3. Spiel starten:

   ```bash
   npm run dev
   ```

4. Im Browser **<http://localhost:5173>** öffnen.

5. So spielst du einmal durch:
   1. Auf **„Jetzt einsteigen“** klicken und ein Konto anlegen. E-Mail und Name sind frei wählbar, das Passwort braucht mindestens 8 Zeichen. Die Altersbestätigung (ab 18) muss angehakt sein.
   2. Eine **Startstadt** wählen.
   3. Über das Menü **Handel**, **Reisen**, **Inventar**, **Fahrzeuge**, **Waffen**, **Clans** und **Ranglisten** ausprobieren.

6. Beenden: im Terminal **Strg + C** drücken.

**Worauf du achten kannst:**
- Oben siehst du **Bargeld** (Schwarzgeld, wird bei Polizeikontrollen beschlagnahmt) und **Bankkonto** (gewaschen, sicher) getrennt.
- Der Laderaum wird in **Volumeneinheiten** angezeigt, bei Reisen wählst du zwischen **Bahn** und **eigenem Fahrzeug**.
- Städte, Waren, Waffen und Fahrzeuge tragen die **satirischen Namen** aus den Spielregeln. Bilder zeigt das Spiel, sobald welche hochgeladen sind (siehe [Bilder einstellen](#bilder-einstellen)), sonst Platzhalter.

**Gut zu wissen:** Alle Daten werden nur im Browser simuliert. Nach dem Neuladen der Seite ist alles weg. Preise im Handel sind vorerst Richtpreise; die echten Kauf- und Verkaufspreise kommen mit dem Handel im Backend.

---

## B – Spieloberfläche mit echtem Konto testen

Hier laufen Registrierung und Login über den echten Server. Die Spielaktionen sind weiterhin simuliert, weil das Backend sie noch nicht kann.

1. Den **Server starten**: Schritte 1 bis 7 aus [Test C](#c--backend-allein-testen) ausführen und das Terminal offen lassen.

2. Ein **zweites Terminal** öffnen und in den Frontend-Ordner wechseln (vom Projektordner aus):

   ```bash
   cd frontend
   ```

3. Abhängigkeiten installieren (beim ersten Mal und nach jedem `git pull`):

   ```bash
   npm install
   ```

4. Die Oberfläche im kombinierten Modus starten. Unter macOS und Linux:

   ```bash
   VITE_USE_MOCKS=hybrid npm run dev
   ```

   Unter Windows (PowerShell) stattdessen:

   ```bash
   $env:VITE_USE_MOCKS="hybrid"; npm run dev
   ```

5. Im Browser **<http://localhost:5173>** öffnen, ein Konto anlegen und eine Startstadt wählen wie in Test A.

6. Prüfen, dass das Konto wirklich auf dem Server liegt: Browser schließen, wieder öffnen und dich mit Name und Passwort **anmelden**. Das klappt nur, weil das Konto in der Datenbank gespeichert ist.

7. Beenden: in beiden Terminals **Strg + C**, danach im Projektordner die Datenbank stoppen:

   ```bash
   docker compose down
   ```

---

## C – Backend allein testen

1. Docker Desktop starten und warten, bis es läuft.

2. Datenbank starten (im Projektordner):

   ```bash
   docker compose up -d db
   ```

3. In den Backend-Ordner wechseln:

   ```bash
   cd backend
   ```

4. Einstellungen aus der Vorlage übernehmen (nur beim ersten Mal; unter Windows `copy` statt `cp`):

   ```bash
   cp .env.example .env
   ```

5. Abhängigkeiten installieren (beim ersten Mal und nach jedem `git pull`):

   ```bash
   npm install
   ```

6. Datenbanktabellen anlegen bzw. auf den neuesten Stand bringen:

   ```bash
   npm run db:deploy
   ```

7. Server starten:

   ```bash
   npm run dev
   ```

8. In einem **zweiten** Terminal prüfen, ob der Server läuft:

   ```bash
   curl http://localhost:3000/api/v1/health
   ```

   Erwartete Antwort: `{"status":"ok","database":"ok"}`

9. Ein Testkonto anlegen:

   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"test@example.org\",\"username\":\"Testspieler\",\"password\":\"geheim12345\",\"ageConfirmed\":true}"
   ```

   Die Antwort enthält einen `accessToken`. Mit ihm (Header `Authorization: Bearer <accessToken>`) kannst du z. B. abrufen:
   - `GET /api/v1/players/me`: dein Spieler mit `"cash": "200000"`, also 2.000,00 € Startkapital (Geld immer in Cent), und `"bank": "0"`
   - `GET /api/v1/cities`: die 12 Städte mit ihren satirischen Namen (z. B. „Pleitenberg“, „Bankfurt“)
   - `GET /api/v1/vehicle-types` und `GET /api/v1/equipment-types`: Fahrzeuge und Ausrüstung samt Bildpfad

   Alle Endpunkte stehen in [`docs/api/API-CONTRACT.md`](docs/api/API-CONTRACT.md).

10. Beenden: im ersten Terminal **Strg + C**, danach im Projektordner die Datenbank stoppen:

    ```bash
    docker compose down
    ```

**Gut zu wissen:** `GET /api/v1/cities/<stadt>/market` liefert noch leere Märkte, weil der Markt-Takt (T-104) noch fehlt. Kaufen, Verkaufen und Reisen gibt es im Backend noch nicht.

---

## D – Automatische Tests

**Backend** (Datenbank aus Test C muss laufen, `backend/.env` muss angelegt sein):

```bash
cd backend && npm test
```

**Frontend:**

```bash
cd frontend && npm test
```

**Balancing-Simulation** (beim ersten Mal vorher `npm install` im Ordner `sim`):

```bash
cd sim && npm test
```

**Spielregeln** (prüft alle Formeln, Beispielrechnungen und Invarianten; unter Windows `python` statt `python3`):

```bash
python3 docs/game-design/tools/verify.py
```

Erwartet werden zurzeit **548** Backend-Tests, **50** Frontend-Tests, **24** Simulationstests und die Meldung `ALLE PRÜFUNGEN BESTANDEN`.

---

## Bilder einstellen

Bilder für Waren, Fahrzeuge, Waffen und mehr gehören nach [`frontend/public/images/`](frontend/public/images/README.md), je Kategorie ein Unterordner. Die Anleitung dort erklärt Dateinamen, Format (512 × 512, WebP/PNG/SVG, max. 300 KB), Stilregeln und das Hochladen direkt über GitHub. Welches Bild wohin gehört, steht in `docs/game-design/parameters.toml` (Feld `image`). Fehlt ein Bild, zeigt das Spiel einen Platzhalter.

---

## Wenn etwas nicht klappt

| Problem | Lösung |
|---------|--------|
| `npm` oder `node` wird nicht gefunden | Node.js installieren und das Terminal neu öffnen. |
| `Port 5173 is in use` / `EADDRINUSE :3000` | Läuft das Spiel schon in einem anderen Terminal? Dort mit Strg + C beenden. |
| `Can't reach database server at localhost:5432` | Docker Desktop starten und `docker compose up -d db` im Projektordner ausführen. |
| `docker compose` unbekannt | Docker Desktop installieren bzw. aktualisieren. |
| `Invalid environment configuration: DATABASE_URL …` | `backend/.env` fehlt: Schritt C4 ausführen. |
| Test B: „Login fehlgeschlagen“ oder Fehler beim Registrieren | Läuft der Server aus Test C noch? Im ersten Terminal muss `npm run dev` im Ordner `backend` laufen. |
| Registrieren-Knopf reagiert nicht | Die Altersbestätigung (ab 18) anhaken und ein Passwort mit mindestens 8 Zeichen wählen. |
| Fehler nach `git pull` | Im betroffenen Ordner erneut `npm install` ausführen, im Backend zusätzlich `npm run db:deploy`. |
| Leere Seite im Browser | Seite neu laden (Strg + F5). In den Tests A und B startet beim ersten Aufruf der Simulations-Dienst im Browser. |
| Port 5432 ist schon belegt (lokales PostgreSQL) | Lokales PostgreSQL beenden oder in `docker-compose.yml` und `backend/.env` einen anderen Port eintragen. |

---

## Projektstruktur

| Ordner | Inhalt | Verantwortlich |
|--------|--------|----------------|
| [`backend/`](backend/README.md) | API-Server: Node.js, TypeScript, Fastify, Prisma, PostgreSQL | Agent 3 |
| `frontend/` | Spieloberfläche: React, TypeScript, Vite | Agent 4 |
| [`docs/game-design/`](docs/game-design/README.md) | Spielregeln, Formeln, `parameters.toml`, Prüfskript `tools/verify.py` | Agent 2 |
| `docs/database/` | Datenmodell, Nachvollziehbarkeit | Agent 3 |
| [`docs/api/`](docs/api/API-CONTRACT.md) | API-Vertrag | Agent 3 |
| `docs/frontend/` | UI-Richtlinien | Agent 4 |
| [`docs/balancing/`](docs/balancing/README.md), `sim/` | Balancing, Simulation | Agent 5 |

## Projektdokumente

| Dokument | Inhalt |
|----------|--------|
| [PROJECT.md](PROJECT.md) | Vision, Scope, Rollen, Arbeitsregeln, offene Fragen |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Systemaufbau, Ordner-Eigentum, Datenmodell- und API-Grundsätze |
| [DECISIONS.md](DECISIONS.md) | Architekturentscheidungen (ADRs) |
| [ROADMAP.md](ROADMAP.md) | Meilensteine und Exit-Kriterien |
| [TASKS.md](TASKS.md) | Aufgaben-Board, Integrationsplan, Review-Prozess |
