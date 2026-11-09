# Drogendealer-Reboot

Satirisches Echtzeit-Mehrspieler-Browsergame mit dauerhafter Welt: Handel, Reisen, Kampf und Clans. Für Erwachsene (ab 18).

**Status:** frühe Entwicklung (Meilenstein M0). Die Spieloberfläche ist mit simulierten Daten durchspielbar. Das echte Backend kann bisher Konten anlegen und Daten lesen; Spielaktionen wie Handeln oder Reisen fehlen dort noch.

---

## Was kann ich heute testen?

| Test | Was du siehst | Dauer | Voraussetzungen |
|------|---------------|-------|-----------------|
| **A – Spieloberfläche** (empfohlen) | Das komplette Spiel im Browser: Registrieren, Startstadt, Handel, Reisen, Inventar, Clans, Ranglisten. Alle Daten sind simuliert. | ca. 3 Minuten | Node.js |
| **B – Backend** | Der echte Server mit Datenbank: Konto anlegen, einloggen, Spielerprofil abrufen. Keine Oberfläche. | ca. 10 Minuten | Node.js, Docker |
| **C – Automatische Tests** | Alle Prüfungen, die auch GitHub bei jeder Änderung ausführt. | ca. 5 Minuten | Node.js, Docker, Python 3 |

Oberfläche und Backend laufen **noch getrennt**. Das Zusammenschalten folgt mit den Aufgaben T-107 und T-305 (siehe [TASKS.md](TASKS.md)).

---

## Einmalig: Voraussetzungen installieren

- **Node.js 20 oder neuer** (empfohlen: 22 LTS) von <https://nodejs.org>. Prüfen mit `node -v`.
- **Git** von <https://git-scm.com>.
- Nur für B und C: **Docker Desktop** von <https://www.docker.com/products/docker-desktop> (muss beim Testen laufen).
- Nur für C: **Python 3** von <https://www.python.org>.

Projekt herunterladen:

```bash
git clone https://github.com/Acephali92/Drogendealer-Reboot.git
```

```bash
cd Drogendealer-Reboot
```

Alle folgenden Befehle starten in diesem Ordner.

---

## A – Spieloberfläche testen (ohne Backend)

1. In den Frontend-Ordner wechseln:

   ```bash
   cd frontend
   ```

2. Abhängigkeiten installieren (nur beim ersten Mal, dauert etwa eine Minute):

   ```bash
   npm install
   ```

3. Spiel starten:

   ```bash
   npm run dev
   ```

4. Im Browser **<http://localhost:5173>** öffnen.

5. So spielst du einmal durch:
   1. Auf **„Jetzt einsteigen“** klicken und ein Konto anlegen. E-Mail und Name sind frei wählbar, das Passwort braucht mindestens 8 Zeichen.
   2. Eine **Startstadt** wählen.
   3. Über das Menü **Handel**, **Reisen**, **Inventar**, **Fahrzeuge**, **Waffen**, **Clans** und **Ranglisten** ausprobieren. Reisezeiten sind im Test stark verkürzt.

6. Beenden: im Terminal **Strg + C** drücken.

**Gut zu wissen:**
- Alle Daten werden nur im Browser simuliert. Nach dem Neuladen der Seite oder einem Neustart ist alles weg.
- Die Spielwerte sind Platzhalter der Oberfläche und **noch nicht** die Regeln aus [`docs/game-design/`](docs/game-design/README.md). Die Oberfläche zeigt noch echte Städtenamen statt der satirischen Namen. Beides wird angepasst (T-112).

---

## B – Backend testen (echter Server)

1. Docker Desktop starten und warten, bis es läuft.

2. Datenbank starten (im Projektordner):

   ```bash
   docker compose up -d db
   ```

3. In den Backend-Ordner wechseln:

   ```bash
   cd backend
   ```

4. Einstellungen aus der Vorlage übernehmen (unter Windows `copy` statt `cp`):

   ```bash
   cp .env.example .env
   ```

5. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

6. Datenbanktabellen anlegen:

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

   Die Antwort enthält einen `accessToken`. Damit kannst du z. B. `GET /api/v1/players/me` abrufen (Header `Authorization: Bearer <accessToken>`). Alle Endpunkte stehen in [`docs/api/API-CONTRACT.md`](docs/api/API-CONTRACT.md).

10. Beenden: im ersten Terminal **Strg + C**, danach die Datenbank stoppen (im Projektordner):

    ```bash
    docker compose down
    ```

**Gut zu wissen:** Städte, Waren und Fahrzeuge sind noch leer (`"cities": []`), weil die Spielwerte aus `parameters.toml` erst mit T-101 geladen werden. Geldbeträge kommen als ganzzahlige Cent (`"150000"` = 1.500,00 €).

---

## C – Automatische Tests

**Backend** (Datenbank aus Test B muss laufen, `.env` muss angelegt sein):

```bash
cd backend && npm test
```

**Frontend:**

```bash
cd frontend && npm test
```

**Spielregeln** (prüft alle Formeln, Beispielrechnungen und Invarianten des Game Designs; unter Windows `python` statt `python3`):

```bash
python3 docs/game-design/tools/verify.py
```

Alle drei müssen ohne Fehler durchlaufen. Erwartet werden zurzeit 113 Backend-Tests, 23 Frontend-Tests und die Meldung `ALLE PRÜFUNGEN BESTANDEN`.

---

## Wenn etwas nicht klappt

| Problem | Lösung |
|---------|--------|
| `npm` oder `node` wird nicht gefunden | Node.js installieren und das Terminal neu öffnen. |
| `Port 5173 is in use` / `EADDRINUSE :3000` | Läuft das Spiel schon in einem anderen Terminal? Dort mit Strg + C beenden. |
| `Can't reach database server at localhost:5432` | Docker Desktop starten und `docker compose up -d db` im Projektordner ausführen. |
| `docker compose` unbekannt | Docker Desktop installieren bzw. aktualisieren. |
| `Invalid environment configuration: DATABASE_URL …` | `backend/.env` fehlt: Schritt B4 ausführen. |
| Leere Seite im Browser | Seite neu laden (Strg + F5). Im Test A startet beim ersten Aufruf der Simulations-Dienst im Browser. |
| Port 5432 ist schon belegt (lokales PostgreSQL) | Lokales PostgreSQL beenden oder in `docker-compose.yml` und `backend/.env` einen anderen Port eintragen. |

---

## Projektstruktur

| Ordner | Inhalt | Verantwortlich |
|--------|--------|----------------|
| [`backend/`](backend/README.md) | API-Server: Node.js, TypeScript, Fastify, Prisma, PostgreSQL | Agent 3 |
| `frontend/` | Spieloberfläche: React, TypeScript, Vite | Agent 4 |
| [`docs/game-design/`](docs/game-design/README.md) | Spielregeln, Formeln, `parameters.toml`, Prüfskript `tools/verify.py` | Agent 2 |
| `docs/database/` | Datenmodell, Nachvollziehbarkeit | Agent 5 |
| [`docs/api/`](docs/api/API-CONTRACT.md) | API-Vertrag | Agent 3 |
| `docs/frontend/` | UI-Richtlinien | Agent 4 |
| [`docs/balancing/`](docs/balancing/README.md), `sim/` | Balancing-Konzept, Simulation | Agent 6 |

## Projektdokumente

| Dokument | Inhalt |
|----------|--------|
| [PROJECT.md](PROJECT.md) | Vision, Scope, Rollen, Arbeitsregeln, offene Fragen |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Systemaufbau, Ordner-Eigentum, Datenmodell- und API-Grundsätze |
| [DECISIONS.md](DECISIONS.md) | Architekturentscheidungen (ADRs) |
| [ROADMAP.md](ROADMAP.md) | Meilensteine und Exit-Kriterien |
| [TASKS.md](TASKS.md) | Aufgaben-Board, Integrationsplan, Review-Prozess |
