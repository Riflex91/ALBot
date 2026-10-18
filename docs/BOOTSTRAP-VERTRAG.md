# Verbindlicher Bootstrap-/Ladevertrag – überprüfter Ingame-CODE

Stand: **18. Oktober 2026**. Grundlage: vom Benutzer übermittelter CODE und das für die Integration signierte Release-Manifest. Der tatsächliche Spielstart wurde nicht beobachtet.

## Tatsächlicher Ladeweg

1. Im Spiel definiert der CODE zuerst **`globalThis.ALBotConfig`**. Diese persönliche Konfiguration liegt *im Ingame-CODE*, nicht in der aus dem Release geladenen Runtime. Die überprüfte Bootstrap-Logik steht als separater, unveränderter Referenzausschnitt in [`bootstrap/ingame-loader-v2.js`](../bootstrap/ingame-loader-v2.js). **Dieses Referenzskript allein ist kein vollständiger Ersatz für den vorhandenen Ingame-CODE.**
2. Der Bootstrap lädt das Release-Manifest unter:
   `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json`
3. Das Manifest wird anhand von `format=albot-release-v1`, gültiger `sequence`, einer ECDSA-P-256-Signatur über `JSON.stringify([format,sequence,version,runtimeUrl,bytes,sha256])` und einer lokalen Downgrade-Grenze geprüft.
4. Aus dem **signierten Manifest-Feld `runtimeUrl`** wird die Runtime geladen; Downloadgröße, SHA-256 und Header `/* ALBot <version> ` werden kontrolliert, anschließend wird dieser Code mit indirektem `eval` ausgeführt.
5. Der Bootstrap verlangt eine vorhandene `ALBot.status()`-Antwort und bei `general.autostart=true` den Zustand `running=true`.

## Signiertes Release-Artefakt (Integrationsstand 18.10.2026)

| Feld | Festgestellter Wert |
| --- | --- |
| Manifest-URL | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json` |
| Manifest-Branch | `codex/w00-w01-readonly-disposition-20261018` |
| Manifest `sequence` | `4` |
| Manifest `version` | `0.10.11-candidate` |
| Manifest `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| Manifest `bytes` | `687439` |
| Manifest `sha256` | `92c0e27aa8020f5a658601d9e050f876e8e0ed43901dc3b11cf541086093a559` |
| Signaturprüfung | ECDSA-P-256 über die dokumentierten Manifestfelder **gültig** |
| Ingame-Erfolg | Aus CODE/Manifest allein **nicht nachgewiesen** |

**Konsequenz:** Der Bootstrap folgt dem dokumentierten signierten Release-Branch und `manifest.runtimeUrl`, nicht automatisch `main/bot.js`. Integrierte Quelle und signierte Runtime wurden in CI gebaut und kryptografisch verifiziert; ein tatsächlicher Spielstart ist ohne Live-Nachweis unbekannt. Das persönliche Ingame-`ALBotConfig` bleibt unabhängig von der Repository-`bot.js`.

Freigabe über den vorhandenen [Signierworkflow](https://github.com/Riflex91/ALBot/actions/runs/39155452952), aus Main `c684764e9c526e877c7c8d16130b376a787b2bd2`: 1.430/1.430 Offlinetests, persönliche Einstellungen unverändert, Manifest und Runtime gemeinsam veröffentlicht. Der vorhandene V2-Loader kann diese Version ohne Neuinstallation beim nächsten CODE-Start laden. Kein neuer Ingame-Ladevorgang beobachtet.

## Getrennte Größenverträge (Bootstrap und alte CODE-Ausgabe)

- **Externe signierte Runtime:** Der vorhandene V2-Loader lädt höchstens 8.388.608 Bytes (8 MiB); Manifest `bytes`, gültige ECDSA-P-256-Signatur, SHA-256, Runtime-Header und Downgrade-Schutz bleiben Pflicht. Eine alte **900-KiB-Benchmark** des vollständigen Regelkatalogs ist **keine** Bootstrap-Grenze und darf Runtimeänderungen nicht sperren.
- **Legacy-Direkt-CODE/Werkstatt:** Der bisherige direkte `exportBundle`-Pfad besitzt weiterhin das separate 1-MiB-CODE-Limit. Dieses wird **nicht** stillschweigend zu 8 MiB erhöht: ein so großes Direkt-CODE-Paket wäre nicht automatisch im Spiel einfügbar. Die Prüfung `checkPackage` akzeptiert dagegen externe Runtime-Pakete bis zur tatsächlichen Bootstrap-Grenze.
- **Build-Artefakt:** `main/dist/albot.runtime.js` bleibt nur ein Build. Der aktive Loader führt weiterhin das separat signierte `manifest.runtimeUrl` aus; ein Main-Merge ist kein Release. Künftige Builds oberhalb 1 MiB für den legacy Direkt-CODE-Export benötigen eine eigene, ausdrücklich bootstrap-orientierte Werkstattausgabe, nicht das Verschweigen des Exportlimits.

## Maschinenlesbarer Vertrag und CI

- [`bootstrap.contract.json`](../bootstrap.contract.json): Quelle der Zuordnung von `main`-Artefakt und externem Ingame-Release-Kanal. `inGameLoader.status=source-reviewed` bedeutet nur, dass die übermittelte Quelle und ihr Manifest geprüft wurden; `observedLoadedUrl=null` bleibt bestehen, bis ein tatsächlicher Ladevorgang belegt ist.
- [`scripts/verify-bootstrap-contract.mjs`](../scripts/verify-bootstrap-contract.mjs): Prüft lokal die Dokumentation, die referenzierte Loader-Kopie und die **separaten** aktuellen Build-/Personal-Artefakte von `main`. Es wäre **falsch**, hier die Runtime-Version aus dem Release-Branch zwingend mit `src/version.mjs` in `main` gleichzusetzen.
- [`scripts/verify-bootstrap-channel.mjs`](../scripts/verify-bootstrap-channel.mjs): Lädt das **aktuelle öffentliche Manifest** und seine referenzierte Runtime, prüft die gültige Signatur mit dem Public Key aus dem Loader, Pfad, Manifest-Version, SHA-256, Länge und Runtime-Header gegen diesen dokumentierten Snapshot. Änderungen am signierten Release-Kanal lassen den CI-Test absichtlich scheitern, bis sie geprüft und mit der Dokumentation abgestimmt wurden.
- Der Prüfworkflow [`.github/workflows/verify-albot.yml`](../.github/workflows/verify-albot.yml) startet beide Kontrollen; das Windows-Skript `scripts/VERIFY-U01-U07.ps1` prüft sie ebenfalls. Damit ist der Remote-Release-Kanal ausdrücklich neben dem lokalen `main`-Build abgesichert.

## Pflichten für weitere KIs

1. Nicht aus `bot.js` oder dem `main`-Build auf den im Spiel ausgeführten Bot schließen. Zuerst den Release-Kanal und `manifest.runtimeUrl` prüfen.
2. Den Branch `codex/w00-w01-readonly-disposition-20261018` **nicht löschen**, solange der veröffentlichte Ingame-Bootstrap noch darauf verweist.
3. Bei jeder beabsichtigten Runtime-Aktualisierung sicherstellen, dass die persönliche Ingame-Konfiguration unverändert oder explizit migriert bleibt. Die persönliche `main/bot.js` und die eingebettete Ingame-Konfiguration sind eigenständige Quellen.
4. Änderungen an `releaseManifest` oder am Loader nur mit gültiger Signatur und konsistenter URL/Version/Hash durchführen. Ohne passenden Signierschlüssel **keine** neuen gültigen Releases behaupten.
5. `bootstrap.contract.json`, `README.md`, `AGENTS.md`, diesen Vertrag, den Loader-Referenzcode und die CI gemeinsam aktualisieren. CI-Green ist **kein** Spiel-Live-Beleg.

