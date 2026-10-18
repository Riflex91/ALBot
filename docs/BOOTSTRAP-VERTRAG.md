# Verbindlicher Bootstrap-/Ladevertrag – überprüfter Ingame-CODE

Stand: **18. Oktober 2026**. Grundlage: vom Benutzer übermittelter CODE, zuletzt gekennzeichnet als `ALBot 0.10.9-candidate`, und zum Prüfzeitpunkt öffentlich abrufbares GitHub-Release-Manifest.

## Tatsächlicher Ladeweg

1. Im Spiel definiert der CODE zuerst **`globalThis.ALBotConfig`**. Diese persönliche Konfiguration liegt *im Ingame-CODE*, nicht in der aus dem Release geladenen Runtime. Die überprüfte Bootstrap-Logik steht als separater, unveränderter Referenzausschnitt in [`bootstrap/ingame-loader-v2.js`](../bootstrap/ingame-loader-v2.js). **Dieses Referenzskript allein ist kein vollständiger Ersatz für den vorhandenen Ingame-CODE.**
2. Der Bootstrap lädt das Release-Manifest unter:
   `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json`
3. Das Manifest wird anhand von `format=albot-release-v1`, gültiger `sequence`, einer ECDSA-P-256-Signatur über `JSON.stringify([format,sequence,version,runtimeUrl,bytes,sha256])` und einer lokalen Downgrade-Grenze geprüft.
4. Aus dem **signierten Manifest-Feld `runtimeUrl`** wird die Runtime geladen; Downloadgröße, SHA-256 und Header `/* ALBot <version> ` werden kontrolliert, anschließend wird dieser Code mit indirektem `eval` ausgeführt.
5. Der Bootstrap verlangt eine vorhandene `ALBot.status()`-Antwort und bei `general.autostart=true` den Zustand `running=true`.

## Tatsächlich adressiertes Release-Artefakt (Momentaufnahme 18.10.2026)

| Feld | Festgestellter Wert |
| --- | --- |
| Manifest-URL | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json` |
| Manifest-Branch | `codex/w00-w01-readonly-disposition-20261018` |
| Manifest `sequence` | `1` |
| Manifest `version` | `0.10.9-candidate` |
| Manifest `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| Manifest `bytes` | `686843` |
| Manifest `sha256` | `e18f1c66ddc216caf62d162207ad98817568e0af968276082a1bcd3db5797319` |
| Signaturprüfung | ECDSA-P-256 über die dokumentierten Manifestfelder **gültig** |
| Ingame-Erfolg | Aus CODE/Manifest allein **nicht nachgewiesen** |

**Konsequenz:** Die persönliche `main/bot.js` (`0.10.10-candidate`) ist **nicht der vom Bootstrap geladenen Datei gleichzusetzen**. Die `main/dist/albot.runtime.js` ist ebenfalls ein anderer, beim Build generierter Stand. Ob eine Änderung aus `main` im Spiel wirksam wird, hängt davon ab, ob das Release-Manifest auf einen neuen, korrekt signierten Runtime-Artefaktstand umgestellt wird. Änderungen des signierten Manifests erfordern einen gültigen Signierschlüssel; ein reiner Branch-Merge bewirkt das nicht.

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

