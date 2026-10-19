# Verbindlicher Bootstrap-/Ladevertrag – überprüfter Ingame-CODE

Stand: **19. Oktober 2026**. Grundlage: vom Benutzer übermittelter CODE und das für die Integration signierte Release-Manifest. Der tatsächliche Spielstart wurde nicht beobachtet.

## Tatsächlicher Ladeweg

1. Im Spiel definiert der CODE zuerst **`globalThis.ALBotConfig`**. Diese persönliche Konfiguration liegt *im Ingame-CODE*, nicht in der aus dem Release geladenen Runtime. Die überprüfte Bootstrap-Logik steht als separater, unveränderter Referenzausschnitt in [`bootstrap/ingame-loader-v2.js`](../bootstrap/ingame-loader-v2.js). **Dieses Referenzskript allein ist kein vollständiger Ersatz für den vorhandenen Ingame-CODE.**
2. Der Bootstrap lädt das Release-Manifest unter:
   `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json`
3. Das Manifest wird anhand von `format=albot-release-v1`, gültiger `sequence`, einer ECDSA-P-256-Signatur über `JSON.stringify([format,sequence,version,runtimeUrl,bytes,sha256])` und einer lokalen Downgrade-Grenze geprüft.
4. Aus dem **signierten Manifest-Feld `runtimeUrl`** wird die Runtime geladen; Downloadgröße, SHA-256 und Header `/* ALBot <version> ` werden kontrolliert, anschließend wird dieser Code mit indirektem `eval` ausgeführt.
5. Der Bootstrap verlangt eine vorhandene `ALBot.status()`-Antwort und bei `general.autostart=true` den Zustand `running=true`.

## Signiertes Release-Artefakt (sequence 6, Stand 19.10.2026)

| Feld | Festgestellter Wert |
| --- | --- |
| Manifest-URL | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json` |
| Manifest-Branch | `codex/w00-w01-readonly-disposition-20261018` |
| Manifest `sequence` | `6` |
| Manifest `version` | `0.10.11-candidate` |
| Manifest `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| Manifest `bytes` | `743053` |
| Manifest `sha256` | `63bc95b3649744152abf1b4e2dfbcb2627a3e2a89d38a028d2686ded1e0ac5a2` |
| Signaturprüfung | ECDSA-P-256 über die dokumentierten Manifestfelder **gültig** |
| Ingame-Erfolg | Aus CODE/Manifest allein **nicht nachgewiesen** |

**Konsequenz:** Der Bootstrap folgt dem dokumentierten signierten Release-Branch und `manifest.runtimeUrl`, nicht automatisch `main/bot.js`. Integrierte Quelle und signierte Runtime wurden in CI gebaut und kryptografisch verifiziert; ein tatsächlicher Spielstart ist ohne Live-Nachweis unbekannt. Das persönliche Ingame-`ALBotConfig` bleibt unabhängig von der Repository-`bot.js`.

**Aktuelle Freigabe, sequence 6 (19.10.2026):** Der Nutzer hat ausdrücklich die Synchronisierung mit `main` beauftragt. Der [Signierworkflow 39287371764](https://github.com/Riflex91/ALBot/actions/runs/39287371764) hat die Runtime exakt aus `main`-Commit `58a52a6efac5bdce12493b1b85503e382b7545f8` übernommen, mit dem unveränderten persönlichen V2-Loader und der bestehenden Ingame-Konfiguration abgeglichen, 1.658/1.658 Offline-Tests erfolgreich ausgeführt und das neue Manifest mit dem bestehenden privaten GitHub-Signierschlüssel signiert. Die veröffentlichte Runtime wurde gegen die signierten Bytes geprüft. Das ist eine **Release-/Kryptografie-Abnahme, keine Spiel-Liveabnahme**. Die Sequenz 6 wurde im Spiel noch nicht beobachtet.

**Historie:** Sequence 5 war am 19.10.2026 mit [Signierworkflow 39231422549](https://github.com/Riflex91/ALBot/actions/runs/39231422549) nach [PR #191](https://github.com/Riflex91/ALBot/pull/191) veröffentlicht worden. Der neue Release verwendet weiterhin genau dieselbe Manifest-URL, Runtime-URL, öffentliche ECDSA-P-256-Prüfidentität und den unveränderten Downloader. Der Bootloader wählt automatisch das neue signierte Manifest erst bei einem erneuten Ingame-CODE-Start bzw. Reload.

## Getrennte Größenverträge (Bootstrap und alte CODE-Ausgabe)

- **Externe signierte Runtime:** Der vorhandene V2-Loader lädt höchstens 8.388.608 Bytes (8 MiB); Manifest `bytes`, gültige ECDSA-P-256-Signatur, SHA-256, Runtime-Header und Downgrade-Schutz bleiben Pflicht. Eine alte **900-KiB-Benchmark** des vollständigen Regelkatalogs ist **keine** Bootstrap-Grenze und darf Runtimeänderungen nicht sperren.
- **Legacy-Direkt-CODE/Werkstatt:** Das explizite Ausgabeziel `legacy-code` von `exportBundle` behält das separate 1-MiB-CODE-Limit. Der Repository-Build und die lokalen personalisierten Vergleichsartefakte benutzen dagegen `target:'bootstrap-artifact'`: Runtime bis 8 MiB plus höchstens 1 MiB Konfigurationswrapper. Diese kombinierte Datei ist **nicht** automatisch direkt in den CODE-Slot einfügbar. `checkPackage` akzeptiert externe Runtime-Pakete bis zur Bootstrap-Grenze.
- **Build-Artefakt:** `main/dist/albot.runtime.js` bleibt nur ein Build. `bot.js` und `dist/albot.js` sind kombinierte Vergleichsartefakte, aber bei mehr als 1 MiB **keine** gültigen Direkt-CODE-Exporte. Der aktive Loader führt weiterhin die separat signierte `manifest.runtimeUrl` aus; ein Main-Merge ist kein Release. Die Freigabe benötigt weiterhin Signatur-, SHA-256-, Byte- und Versionsprüfung.

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

