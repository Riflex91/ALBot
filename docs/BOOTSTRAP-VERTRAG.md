# Verbindlicher Bootstrap-/Ladevertrag – überprüfter Ingame-CODE

Stand: **19. Oktober 2026**. Grundlage: vom Benutzer übermittelter CODE und das für die Integration signierte Release-Manifest. Der tatsächliche Spielstart wurde nicht beobachtet.

## Tatsächlicher Ladeweg

1. Im Spiel definiert der CODE zuerst **`globalThis.ALBotConfig`**. Diese persönliche Konfiguration liegt *im Ingame-CODE*, nicht in der aus dem Release geladenen Runtime. Die überprüfte Bootstrap-Logik steht als separater, unveränderter Referenzausschnitt in [`bootstrap/ingame-loader-v2.js`](../bootstrap/ingame-loader-v2.js). **Dieses Referenzskript allein ist kein vollständiger Ersatz für den vorhandenen Ingame-CODE.**
2. Der Bootstrap lädt das Release-Manifest unter:
   `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json`
3. Das Manifest wird anhand von `format=albot-release-v1`, gültiger `sequence`, einer ECDSA-P-256-Signatur über `JSON.stringify([format,sequence,version,runtimeUrl,bytes,sha256])` und einer lokalen Downgrade-Grenze geprüft.
4. Aus dem **signierten Manifest-Feld `runtimeUrl`** wird die Runtime geladen; Downloadgröße, SHA-256 und Header `/* ALBot <version> ` werden kontrolliert, anschließend wird dieser Code mit indirektem `eval` ausgeführt.
5. Der Bootstrap verlangt eine vorhandene `ALBot.status()`-Antwort und bei `general.autostart=true` den Zustand `running=true`.

## Aktueller signierter Release-Kanal (Sequence 14, 19.10.2026)

| Feld | Beobachteter Wert |
| --- | --- |
| `sequence` | `14` |
| `version` | `0.14.0-candidate` |
| `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| `bytes` | `765913` |
| `sha256` | `3ed5c6a0277c14aefe0847b940f256fc2230566fa4ba53063bb4da499502f91a` |

Der bestehende Loader, sein Public Key und die Ingame-Konfiguration sind nicht
Bestandteil der G04-Änderung. Für die CI-Verifikation wird der aktuelle Release-Branch
einmal als Commit-SHA aufgelöst und Manifest sowie Runtime werden bytegenau aus
**demselben unveränderlichen Commit** geprüft. Die signierte URL und die strenge
ECDSA-P-256-/SHA-256-/Sequenzkontrolle bleiben bestehen. Es gibt keine bestätigte
Spiel-Liveabnahme und keine neue Signierung durch diesen PR.

## Vorheriges signiertes Release-Artefakt (sequence 11, Stand 19.10.2026)

| Feld | Festgestellter Wert |
| --- | --- |
| Manifest-URL | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json` |
| Manifest-Branch | `codex/w00-w01-readonly-disposition-20261018` |
| Manifest `sequence` | `11` |
| Manifest `version` | `0.11.0-candidate` |
| Manifest `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| Manifest `bytes` | `765836` |
| Manifest `sha256` | `75f331c2b9611d02fb954248f5fef9c90661ef6f569c5b5eb27dec171f793b31` |
| Signaturprüfung | ECDSA-P-256 über die dokumentierten Manifestfelder **gültig** |
| Ingame-Erfolg | Aus CODE/Manifest allein **nicht nachgewiesen** |

**Konsequenz:** Der Bootstrap folgt dem dokumentierten signierten Release-Branch und `manifest.runtimeUrl`, nicht automatisch `main/bot.js`. Integrierte Quelle und signierte Runtime wurden in CI gebaut und kryptografisch verifiziert; ein tatsächlicher Spielstart ist ohne Live-Nachweis unbekannt. Das persönliche Ingame-`ALBotConfig` bleibt unabhängig von der Repository-`bot.js`.

**Vorherige Freigabe: Sequence 11 (19.10.2026), `0.11.0-candidate`.** [PR #241](https://github.com/Riflex91/ALBot/pull/241) schafft bei fälligem Ausgleich nach unverändert 30 Minuten ein sicheres Rotationsfenster und erhält die bisherige Auswahl für Level-/Gear-Ausgleich. Enthalten sind die beauftragten AoE-/Merchant-Recovery-Korrekturen. Veröffentlichung aus [main-Commit 4f30819](https://github.com/Riflex91/ALBot/commit/4f30819e7a4ba8d794dc41111888665fdf265ab0). [Signierworkflow 39319057251](https://github.com/Riflex91/ALBot/actions/runs/39319057251): 1.781/1.781 Tests, ECDSA-P-256-Signatur gültig, 765836 Bytes und SHA-256 `75f331c2b9611d02fb954248f5fef9c90661ef6f569c5b5eb27dec171f793b31` verifiziert; Runtime bytegleich zu Main. Linux-/Windows-CI vor Merge grün. Bestehender Loader, Kanal und Schlüssel unverändert. Künftig erhöht jede neu signierte Runtime die Minor-Version um eins (+0.1), Patch 0; Signierung erzwingt dies. [Änderungen und Liveabnahme](CHANGELOG-0.11.0.md). Spiel-Liveabnahme von Sequence 11 offen.

**Vorherige Freigabe: Sequence 10 (19.10.2026), `0.10.13-candidate`.** Die nach [PR #238](https://github.com/Riflex91/ALBot/pull/238) (G09) und [PR #239](https://github.com/Riflex91/ALBot/pull/239) (W06) geprüfte [main-Runtime 2f55d8a](https://github.com/Riflex91/ALBot/commit/2f55d8a907f3ae90cab6d301188d481a1f815121) wurde über den unveränderten signierten V2-Kanal veröffentlicht. [Signierworkflow 39317203696](https://github.com/Riflex91/ALBot/actions/runs/39317203696): 1.769/1.769 Tests bestanden, persönliche ALBotConfig bytegleich, valide ECDSA-P-256-Signatur; SHA-256 `d73796591d7964a525ac3725bc91f6d11d07bcabd6c48acb76d766231d6f9def` und 762149 Runtime-Bytes geprüft. Signierte Runtime bytegleich zu `main/dist/albot.runtime.js`. Der vorhandene Ingame-Loader, Manifest-/Runtime-URLs und öffentliche Schlüssel bleiben unverändert; Sequence 10 wurde nicht im Spiel live beobachtet.

**Vorherige Freigabe: Sequence 9 (19.10.2026), `0.10.13-candidate`.** [PR #236](https://github.com/Riflex91/ALBot/pull/236) stabilisiert Standortbindung, Gruppenreise, Priest-Verhalten bei Weg-Aggro und Merchant-Arbeit. Veröffentlichung aus [main-Commit c7902b0](https://github.com/Riflex91/ALBot/commit/c7902b0c1c2693be807e09b56ab891b7508da18b) über den bestehenden V2-Kanal. [Signierworkflow 39313699242](https://github.com/Riflex91/ALBot/actions/runs/39313699242): 1.753/1.753 Tests, identische persönliche ALBotConfig, gültige ECDSA-P-256-Signatur und verifizierter SHA-256 der 760242 Runtime-Bytes. Linux-/Windows-CI vor Merge grün; Runtime bytegleich zu Main. Ingame-Loader, Downloadpfad und Schlüsselidentität unverändert. [Änderungen und offene Liveabnahme](CHANGELOG-0.10.13.md). **Sequence 9 wurde noch nicht im Spiel live beobachtet.**

**Vorherige Freigabe: Sequence 8 (19.10.2026), `0.10.12-candidate`.** Die Version wurde durch [PR #226](https://github.com/Riflex91/ALBot/pull/226) aktualisiert und aus dem CI-geprüften [main-Commit f17e683](https://github.com/Riflex91/ALBot/commit/f17e68307b043e44c51ecc943d8c361927ab84e9) über den bestehenden signierten V2-Kanal veröffentlicht. [Workflow 39303591244](https://github.com/Riflex91/ALBot/actions/runs/39303591244): 1.689/1.689 Tests, identische persönliche ALBotConfig, gültige ECDSA-P-256-Signatur und verifizierter SHA-256 der 749459 Runtime-Bytes. Ingame-Loader, Downloadpfad und öffentliche Schlüsselidentität unverändert. **Sequence 8 wurde noch nicht im Spiel live beobachtet.**

**Vorherige Freigabe: Sequence 7 (19.10.2026).** Die aus [main-Commit 8e535ded](https://github.com/Riflex91/ALBot/commit/8e535dedec400159be45f557e8ede7f80158b252) und [PR #221](https://github.com/Riflex91/ALBot/pull/221) übernommene Runtime wurde im bestehenden V2-Kanal veröffentlicht. Der [Signierworkflow 39301386927](https://github.com/Riflex91/ALBot/actions/runs/39301386927) hat den Quellstand gebaut, alle Offline-Tests ausgeführt, die personalisierte Konfiguration bytegleich erhalten, das Manifest mit dem vorhandenen GitHub-Schlüssel signiert und Signatur, SHA-256 und Runtime-Bytezahl geprüft. Die Runtime-Datei ist identisch mit dem Main-Build. Der installierte Ingame-Loader und seine öffentliche Schlüsselidentität bleiben unverändert; ein Spiel-Livetest mit Sequence 7 wurde noch nicht beobachtet.

**Vorherige Freigabe, sequence 6 (19.10.2026):** Der Nutzer hat ausdrücklich die Synchronisierung mit `main` beauftragt. Der [Signierworkflow 39287371764](https://github.com/Riflex91/ALBot/actions/runs/39287371764) hat die Runtime exakt aus `main`-Commit `58a52a6efac5bdce12493b1b85503e382b7545f8` übernommen, mit dem unveränderten persönlichen V2-Loader und der bestehenden Ingame-Konfiguration abgeglichen, 1.658/1.658 Offline-Tests erfolgreich ausgeführt und das neue Manifest mit dem bestehenden privaten GitHub-Signierschlüssel signiert. Die veröffentlichte Runtime wurde gegen die signierten Bytes geprüft. Das ist eine **Release-/Kryptografie-Abnahme, keine Spiel-Liveabnahme**. Die Sequenz 6 wurde im Spiel noch nicht beobachtet.

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

