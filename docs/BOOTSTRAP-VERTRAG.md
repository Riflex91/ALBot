# ALBot: Bootstrap- und Laufzeitartefakt-Vertrag

Stand: 18. Oktober 2026. Geltungsbereich: Repository `Riflex91/ALBot`, Standardbranch `main`.

## 1. Gesicherter Repository-Befund

| Zweck | Datei |
| --- | --- |
| Persönlicher, vollständig ausführbarer CODE mit `globalThis.ALBotConfig` | [`bot.js`](../bot.js) |
| Rohdatei des persönlichen CODE | `https://raw.githubusercontent.com/Riflex91/ALBot/main/bot.js` |
| Generische, aus `src/` gebaute Bundle-Ausgabe | [`dist/albot.js`](../dist/albot.js) |
| Aus `src/` gebaute Runtime ohne persönliche Konfiguration | [`dist/albot.runtime.js`](../dist/albot.runtime.js) |
| Einzige Versionsquelle für Builds | [`src/version.mjs`](../src/version.mjs) |
| Automatischer persönlicher Bundle-Abgleich | [`scripts/sync-personal-code.mjs`](../scripts/sync-personal-code.mjs) |
| Maschinenlesbarer Dateivertrag | [`bootstrap.contract.json`](../bootstrap.contract.json) |

Die persönliche `bot.js` ist das **beabsichtigte, dokumentierte persönliche Laufzeitartefakt**. Beim Build wird `dist/albot.runtime.js` aus den modularen Quellen erzeugt. `scripts/sync-personal-code.mjs --write` setzt die neue Runtime hinter die bestehende persönliche Konfiguration in `bot.js`; `--check` prüft bytegenaue Übereinstimmung.

## 2. Noch nicht verifiziert: Tatsächlicher Ingame-Bootstrap

Der im Adventure-Land-Spiel verwendete externe Bootstrap wurde nicht als Quelltext im Repository identifiziert oder bereitgestellt. Deshalb ist **nicht belegt, welche Datei/URL dieser Bootstrap tatsächlich lädt**. Insbesondere sind ein Repo-Link und eine vorhandene `bot.js` kein Beleg für einen erfolgreichen HTTP-Abruf oder eine Code-Ausführung.

In `bootstrap.contract.json` muss `inGameLoader.status` bis zur konkreten Sichtung `unverified` bleiben, mit `trackedSourcePath: null` und `observedLoadedUrl: null`. Wenn der echte Bootstrap vorliegt, prüfen:

1. Vollständigen Ingame-Code und alle Weiterleitungen/Slot- oder Netzwerkauflösungen betrachten; effektive Adresse, Branch, Dateiname und Ausführungsweg feststellen.
2. Ladeziel mit der obigen Raw-Adresse vergleichen und Abweichungen dokumentieren. Bei dynamischen URLs die tatsächliche Auswahl belegen.
3. Wenn ein Bootstrap als Repository-Datei aufgenommen wurde, dessen exakten Pfad und die geprüfte URL im Vertrag vermerken; bei extern bleibendem Code keine CI-Sicherheit vortäuschen.
4. Erst nach Quellprüfung/echtem Spielnachweis `status` als `verified` dokumentieren und die Prüfroutine passend zu genau diesem Code erweitern.

## 3. Automatische GitHub-Prüfung

`npm ci && npm run build`

`node scripts/sync-personal-code.mjs --check`

`node scripts/verify-bootstrap-contract.mjs`

Der Prüfer kontrolliert:
- Maschinenlesbaren Repo-/Branch-/Dateipfad und dokumentierte Raw-URL;
- dieselbe `src/version.mjs`-Version im Header der persönlichen `bot.js`, in der eingebetteten Runtime, dem frisch gebauten `dist/albot.js` und dem Build-Manifest;
- byteidentische eingebettete Runtime der `bot.js` gegenüber `dist/albot.runtime.js`;
- korrektes SHA-256 und Byteanzahl im `dist/manifest.json`;
- ausdrückliche Dateireferenz in `README.md` und `AGENTS.md`.

Diese Prüfungen laufen in GitHub Actions auf Linux sowie über `scripts/VERIFY-U01-U07.ps1` unter Windows, **jeweils nach einem frischen Build**. Sie prüfen **nicht** die im Browser gespeicherte CODE-Zeile, Netzwerkabrufe im Live-Spiel oder einen außerhalb des Repositories gepflegten Loader.

## 4. Verpflichtung bei Änderungen

- Nach Quelländerungen persönliche `bot.js` nur über den kanonischen Synchronisierer aktualisieren, Konfiguration nicht neu generieren oder überschreiben.
- Neue Loader-/Bootstrap-Pfade, URLs und Branches niemals nur in Prosa ändern: zuerst reale Quelle prüfen, anschließend `bootstrap.contract.json`, `README.md`, `AGENTS.md`, diese Datei und CI gemeinsam aktualisieren.
- Eingcheckte `dist/`-Artefakte können älter als `bot.js` sein; CI prüft einen frischen Build. Für Releases muss gesondert entschieden werden, ob die generierten `dist/`-Dateien mit veröffentlicht werden.
