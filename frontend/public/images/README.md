# Spielbilder

Hier liegen die Bilder für Waren, Fahrzeuge, Waffen, Schutzausrüstung, Crew und Raumschiffe.
Welches Bild zu welchem Objekt gehört, steht **nicht** im Code, sondern in
[`docs/game-design/parameters.toml`](../../../docs/game-design/parameters.toml) (Feld `image`, ADR-020).
Fehlt ein Bild oder lässt es sich nicht laden, zeigt das Spiel automatisch ein Platzhalterbild.

## Ordner

| Ordner | Inhalt | Schlüssel in `parameters.toml` | Beispiel |
|--------|--------|--------------------------------|----------|
| `goods/` | Waren | `[goods.<schlüssel>]` | `goods/gras.webp` |
| `vehicles/` | Fahrzeuge | `[vehicles.<schlüssel>]` | `vehicles/sportwagen.webp` |
| `weapons/` | Waffen | `[weapons.<schlüssel>]` | `weapons/pistole.webp` |
| `armor/` | Schutzausrüstung | `[armor.<schlüssel>]` | `armor/weste.webp` |
| `crew/` | Crew | `[crew.<schlüssel>]` | `crew/profi.webp` |
| `ships/` | Raumschiffe | `[ships.<schlüssel>]` | `ships/shuttle.webp` |

**Dateiname = Schlüssel aus `parameters.toml`**, kleingeschrieben, ohne Leerzeichen und Umlaute. Für
`[vehicles.sportwagen]` heißt die Datei also `vehicles/sportwagen.webp`.
Dateien, deren Name mit `_` beginnt (z. B. `_fallback.svg`), sind Platzhalter des Frontends und werden nicht überschrieben.

## Platzhalter

Jeder Ordner enthält ein `_fallback.svg` im Comicstil (betreut von Agent 4). Das Spiel zeigt es, wenn ein
Objekt kein Bild hat oder das Bild nicht lädt. Welcher Platzhalter gilt, steht ebenfalls in `parameters.toml`
(`[images]` → `fallback.<kategorie>`). Lädt auch der Platzhalter nicht, erscheint ein eingebautes Symbol.
So sieht das Spiel auch ohne eigene Bilder vollständig aus.

## Anforderungen an Bilder

- **Format:** WebP (bevorzugt), PNG oder SVG.
- **Größe:** quadratisch, 512 × 512 Pixel, höchstens 300 KB pro Datei. Transparenter Hintergrund ist ideal.
- **Stil (ADR-013):** satirisch-überzeichnet, comicartig. Keine echten Markenlogos (auch nicht auf Autos oder Waffen), keine realen Personen, keine realistischen Drogen- oder Konsumdarstellungen.
- **Rechte:** Nur eigene Bilder oder Bilder mit passender Lizenz (z. B. CC0). Herkunft und Lizenz jedes fremden Bildes in [`QUELLEN.md`](QUELLEN.md) eintragen.

## Bilder hochladen (ohne Programmierkenntnisse)

1. Auf GitHub den passenden Ordner öffnen, z. B.
   <https://github.com/Acephali92/Drogendealer-Reboot/tree/main/frontend/public/images/goods>.
2. Oben rechts **Add file → Upload files** wählen und die Bilder hineinziehen.
3. Unten **„Create a new branch for this commit and start a pull request“** wählen und auf **Propose changes** klicken.
4. Den Pull Request anlegen. Agent 1 prüft Format, Größe, Stil und Rechte und merged ihn.
5. Ist der Pfad in `parameters.toml` noch nicht eingetragen, ergänzt ihn Agent 2. Solange zeigt das Spiel den Platzhalter.

Alternativ kannst du die Bilder auch direkt einem Agenten in seiner Sitzung geben.
