**Neuester signierter Ingame-Release: `0.54.0-candidate`, Sequence 54 (24.10.2026).** [PR #479](https://github.com/Riflex91/ALBot/pull/479) korrigiert Farmer-Transit/Notwehr-Priorität und validierte entfernte Zubehör-NPCs; [PR #481](https://github.com/Riflex91/ALBot/pull/481) stabilisiert die Signaturfälschungs-Regressionsprüfung. [Geschützter Signierworkflow #40117020642](https://github.com/Riflex91/ALBot/actions/runs/40117020642): 2634/2634 Offline-Tests, gültige ECDSA-P-256, 1005098 Runtime-Bytes, SHA-256 `69977528620eeb209edbbb0e25fee1bcaa5167e060469ee4352faed942a2a747`. Signierte Runtime entspricht exakt `main`; unveränderter Loader, Vertrauensanker und URLs. **Ingame-Liveabnahme offen.** [Nachweis](RELEASE-CERTIFICATION-0.54.0-2026-10-24.md); ältere Angaben darunter historisch.

**Neuester signierter und offline geprüfter Stand: `0.53.0-candidate`, Sequence 53 (24.10.2026).** Combat-/Risk-[PR #476](https://github.com/Riflex91/ALBot/pull/476) nach [Linux-/Windows-CI #40114166805](https://github.com/Riflex91/ALBot/actions/runs/40114166805) in Main, geschützter [Signierworkflow #40114473479](https://github.com/Riflex91/ALBot/actions/runs/40114473479) und [Artefaktprüfung #40114669367](https://github.com/Riflex91/ALBot/actions/runs/40114669367) grün: 2622 Tests, ECDSA-P-256 gültig, 1000476 Runtime-Bytes, SHA-256 `74cb919cf6b8b5ddf49240d27889c61df470c4d823acdf1c67dda49c8c58186f`. Der V2-Loader, sein Vertrauensanker und die Release-URLs bleiben unverändert; der persönliche Bootstrap verwendet `assertive` und höchstens 45 Sekunden. **Ingame-Liveabnahme weiterhin offen.** [Zertifizierungsbericht](RELEASE-CERTIFICATION-0.53.0-2026-10-24.md). Frühere Einträge sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.34.0-candidate`, Sequence 34 (22.10.2026).** [Release-PR #409](https://github.com/Riflex91/ALBot/pull/409) nach [vollständig grüner Linux-/Windows-CI 39807781321](https://github.com/Riflex91/ALBot/actions/runs/39807781321) gemergt. [Signierworkflow 39808164061](https://github.com/Riflex91/ALBot/actions/runs/39808164061) prüfte die Runtime (`942181` Bytes, SHA-256 `214d71fb5a06dbbeddad823bc8fed31354dc5c14f067f20f4c30975094078784`) und signierte Sequence 34 mit ECDSA-P-256; Release-Binärdatei identisch mit `main`. Enthält Tracktrix-UI-Schließung #404 und Marktkauf-/Green-Jr-Fixes #406. Bootstrap, Manifest-URLs, Public Key und persönliche Konfiguration unverändert; kein Live-Spielnachweis.

**Vorher signiert und kryptografisch verifiziert: `0.33.0-candidate`, Sequence 33 (21.10.2026).** [Merchant-/Gear-/Tracktrix-Fix PR #396](https://github.com/Riflex91/ALBot/pull/396) nach [grüner Linux-/Windows-CI 39672422581](https://github.com/Riflex91/ALBot/actions/runs/39672422581) in Main (`8987bbc57afbddf65c9d17bbe265aaf81a8e541d`). [Geschützter Signierworkflow 39672789116](https://github.com/Riflex91/ALBot/actions/runs/39672789116): ECDSA-P-256 gültig, vollständige Offline-Tests bestanden, 937137 Runtime-Bytes, SHA-256 `6d98c645633c5f23cac5390f571a7dff033a0b5e1d6897c5ee48738ef0e9ee75`. Die Release-Runtime ist byteidentisch mit der genehmigten Main-Runtime; persönliche ALBotConfig, V2-Loader, Schlüssel sowie Runtime-/Manifest-URLs unverändert. **Ingame-Liveabnahme** für Lieferweg, Gear-Übergabe und Tracktrix-Verteilung steht noch aus. Frühere Freigabeangaben unten sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.32.0-candidate`, Sequence 32 (21.10.2026).** [Loot-Backlog-Fix PR #391](https://github.com/Riflex91/ALBot/pull/391) nach [grüner Linux-/Windows-CI 39660456088](https://github.com/Riflex91/ALBot/actions/runs/39660456088) in Main (`fdbce853f4fc71c69c45240f5cda9ffe517a7032`). [Signierworkflow 39660752603](https://github.com/Riflex91/ALBot/actions/runs/39660752603): ECDSA-P-256 gültig, alle Offline-Tests bestanden, 933121 Runtime-Bytes, SHA-256 `36e1e4f702ce1059fad2b610d8faea811e29a066870a758134619764c11101bd`. Release-Runtime und genehmigte Main-Runtime byteidentisch. Persönliche ALBotConfig, V2-Loader, Schlüssel und URLs unverändert; Loot-Ingame-Liveabnahme offen. Frühere Freigabeangaben unten historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.31.0-candidate`, Sequence 31 (21.10.2026).** [Bank-Telemetrie-Fix PR #387](https://github.com/Riflex91/ALBot/pull/387) und [Release-Vorbereitung #388](https://github.com/Riflex91/ALBot/pull/388) nach grüner [Linux-/Windows-CI 39659471317](https://github.com/Riflex91/ALBot/actions/runs/39659471317) in Main. [Geschützter Signierworkflow 39659853012](https://github.com/Riflex91/ALBot/actions/runs/39659853012): ECDSA-P-256 signierte Runtime, 930741 Bytes, SHA-256 `08ca21206962ae2fe5298263e11ad5c6d62790318f2b3ee24d50e18a5ab0fe55`. Signed-Runtime byteidentisch mit Main. Merchant erfasst kurz sichtbare Bankfächer während normaler Spiel-Ticks, hält sie begrenzt im Speicher und sendet nach Cloudflare-120s-Drosselung. Erfolgreiche Uploads löschen alte Fehler. V2-Loader, Signierschlüssel, Release-URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme der Bank-Snapshots bleibt offen.** Ältere Release-Angaben unten sind historisch.

**Vorheriges signiertes Release: `0.30.0-candidate`, Sequence 30 (21.10.2026).** [Gear-/Town-Fix PR #385](https://github.com/Riflex91/ALBot/pull/385) nach [grüner Linux-/Windows-CI 39657860717](https://github.com/Riflex91/ALBot/actions/runs/39657860717) in Main (`2cf82d84dcfab70ea2e23f2fee24a658373af303`). [Signierworkflow 39658407136](https://github.com/Riflex91/ALBot/actions/runs/39658407136): 2.339/2.339 Offline-Tests, ECDSA-P-256 gültig, 930030 Runtime-Bytes, SHA-256 `cc1f81faa723d962f8718a30f030429044d1eed4156b3d3802d06f56e7d54be8`. Veröffentlichte Runtime byteidentisch mit Main; V2-Loader, Public Key, URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme der Gear-Übergabe und Town-Reise offen.** Frühere Freigabeangaben sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.28.0-candidate`, Sequence 28 (21.10.2026).** [Farmer-first-Gear-Fix PR #378](https://github.com/Riflex91/ALBot/pull/378) nach [grüner Linux-/Windows-CI 39649989650](https://github.com/Riflex91/ALBot/actions/runs/39649989650) in Main (`275094333880f74595c0007d847f1465a51bb720`). [Signierworkflow 39650511597](https://github.com/Riflex91/ALBot/actions/runs/39650511597): 2.325/2.325 Offline-Tests, ECDSA-P-256 gültig, 926463 Runtime-Bytes, SHA-256 `1367b966f64faefb8556567db32656b749e2d98adbc943e80f0579012f851261`. Veröffentlichte Runtime byteidentisch mit Main; V2-Loader, Public Key, URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme offen.** Ältere Freigabeangaben darunter sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.27.0-candidate`, Sequence 27 (21.10.2026).** [Release-PR #375](https://github.com/Riflex91/ALBot/pull/375) nach erfolgreich abgeschlossenem [Linux-/Windows-Preflight 39648365238](https://github.com/Riflex91/ALBot/actions/runs/39648365238) in den bestehenden Signierbranch übernommen. [Vertrauenswürdiger Signierworkflow 39649064561](https://github.com/Riflex91/ALBot/actions/runs/39649064561): 2.320/2.320 Tests, ECDSA-P-256-Signatur gültig, 924287 Bytes, SHA-256 `b55bea82b6c7de2f9edaeaeb5e28312cb21ea6dcb7088d4a882cbbcd923f0e50`. Enthält Telemetrie-Korrekturen [#372](https://github.com/Riflex91/ALBot/pull/372) und [#373](https://github.com/Riflex91/ALBot/pull/373). Live-Abnahme und einmalige Einrichtung von `INGEST_TOKEN` sind noch offen; persönliche Konfiguration, Bootstrap-Public-Key und Release-URLs bleiben unverändert.

**Vorheriges signiertes Release: `0.26.0-candidate`, Sequence 26 (21.10.2026).** [PR #367](https://github.com/Riflex91/ALBot/pull/367) nach grüner [Linux-/Windows-CI 39642937064](https://github.com/Riflex91/ALBot/actions/runs/39642937064) in Main (`aef9be83d1e04b62bb3c61548225ce0602b2e6e1`). [Signierworkflow 39643137036](https://github.com/Riflex91/ALBot/actions/runs/39643137036): 2.302/2.302 Offline-Tests, ECDSA-P-256 gültig, 922154 Runtime-Bytes, SHA-256 `b7f096e7fa7aab772f55968cbec44afde23070038cbc0933546bb8fc10d8862c`. Öffentlich geladene Runtime byteidentisch mit Main. Gearplanung schrittweise, Reentranz gesperrt, Diagnosen passiv; Einzelaufrufe können das kooperative Zeitbudget weiterhin überschreiten. Persönliche Konfiguration, V2-Loader, Key und URLs unverändert. Spiel-Liveabnahme 0.26 offen. Frühere Releaseangaben darunter sind historisch.

**Aktuell signiert und verifiziert: `0.24.0-candidate`, Sequence 24 (21.10.2026).** [PR #355](https://github.com/Riflex91/ALBot/pull/355) ist nach gruener Linux-/Windows-CI [39637823327](https://github.com/Riflex91/ALBot/actions/runs/39637823327) in Main. [Signierworkflow 39638036784](https://github.com/Riflex91/ALBot/actions/runs/39638036784): 2.274/2.274 Offline-Tests, ECDSA-P-256 gueltig, 916442 Runtime-Bytes, SHA-256 `56c2562496381ffdade50567fc33900cd15a9ad97453536cef5d98bb01f933f2`. Runtime byteidentisch zum freigegebenen Main-Commit `2ac84396ac482ebd12824f9d3338159528cd344d`. Rotationsfrist, verbindliche Materialarbeit, Markt-Fallback und Crafting-Gearziele sind enthalten. V2-Loader, Key, URLs und persoenliche Konfiguration bleiben unveraendert; Ingame-Liveabnahme offen. [Aenderungen und Grenzen](CHANGELOG-0.24.0.md). Fruehere Releaseangaben darunter sind historisch.

# Verbindlicher Bootstrap-/Ladevertrag – überprüfter Ingame-CODE

Stand: **20. Oktober 2026**. Grundlage: vom Benutzer übermittelter CODE und das für die Integration signierte Release-Manifest. Der tatsächliche Spielstart wurde nicht beobachtet.

## Tatsächlicher Ladeweg

1. Im Spiel definiert der CODE zuerst **`globalThis.ALBotConfig`**. Diese persönliche Konfiguration liegt *im Ingame-CODE*, nicht in der aus dem Release geladenen Runtime. Die überprüfte Bootstrap-Logik steht als separater, unveränderter Referenzausschnitt in [`bootstrap/ingame-loader-v2.js`](../bootstrap/ingame-loader-v2.js). **Dieses Referenzskript allein ist kein vollständiger Ersatz für den vorhandenen Ingame-CODE.**
2. Der Bootstrap lädt das Release-Manifest unter:
   `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json`
3. Das Manifest wird anhand von `format=albot-release-v1`, gültiger `sequence`, einer ECDSA-P-256-Signatur über `JSON.stringify([format,sequence,version,runtimeUrl,bytes,sha256])` und einer lokalen Downgrade-Grenze geprüft.
4. Aus dem **signierten Manifest-Feld `runtimeUrl`** wird die Runtime geladen; Downloadgröße, SHA-256 und Header `/* ALBot <version> ` werden kontrolliert, anschließend wird dieser Code mit indirektem `eval` ausgeführt.
5. Der Bootstrap verlangt eine vorhandene `ALBot.status()`-Antwort und bei `general.autostart=true` den Zustand `running=true`.

## Aktueller signierter Release-Kanal (Sequence 19, 20.10.2026)

| Feld | Kryptografisch verifizierter Wert |
| --- | --- |
| `sequence` | `19` |
| `version` | `0.19.0-candidate` |
| `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| `bytes` | `886804` |
| `sha256` | `d83f93525c6afc18b790ec820eb27074860cd617eec6acd7748a47c68e4d44c7` |

Der [GitHub-Actions-Signierworkflow 39480451001](https://github.com/Riflex91/ALBot/actions/runs/39480451001) hat nach Linux-/Windows-Prüfung die Runtime mit dem bestehenden ECDSA-P-256-Schlüssel signiert und anschließend mit identischem SHA-256 und exakt `886804` Bytes geprüft. Der freigegebene Gameplay-Quellstand `08d0322` enthält insbesondere die Farmer-One-Shots (#302), Merchant-/Produktionsplan-Stabilisierung (#307) und vollständige Executor-Endereignisse (#308). Die unabhängige Konfigurator-Anzeigeänderung #309 verbleibt zusätzlich in `main`. Persönlicher CODE, unveränderter V2-Loader, Public Key, URLs und Cloudflare-Free-Grenzen wurden nicht geändert. Eine echte Game-Liveabnahme ist weiterhin offen.

### Historischer Release: Sequence 18

## Frueherer signierter Release-Kanal (Sequence 18, 20.10.2026)

| Feld | Verifizierter Wert |
| --- | --- |
| `sequence` | `18` |
| `version` | `0.18.0-candidate` |
| `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| `bytes` | `878294` |
| `sha256` | `3d5c35cd98254b98e9b2c0f6b867f19d31df4c3aeb94cd5047c4fb27ab5f6f74` |

Nach Linux-/Windows-PR-Tests sowie Signierung im [Workflow 39476589158](https://github.com/Riflex91/ALBot/actions/runs/39476589158) veröffentlicht. Neue Funktion: ausdrücklich zustimmungspflichtiges Cloudflare-Access-Telemetrie-Relay im Browser, mindestens 120 Sekunden Takt und **ohne** öffentlichen Ingest-Schlüssel. Headless-Telemetrie bleibt deaktiviert. Die persönliche Ingame-Konfiguration, V2-Loader-URL und Signaturprüfung sind unverändert. **Eine echte Live-Browserabnahme fehlt noch.**

### Historischer Release: Sequence 17

## Frueherer signierter Release-Kanal (Sequence 17, 20.10.2026)

| Feld | Verifizierter Wert |
| --- | --- |
| `sequence` | `17` |
| `version` | `0.17.0-candidate` |
| `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| `bytes` | `828439` |
| `sha256` | `d93a7b43e36d9631fafe5fe26821e9d4f79b7e18682123597d9be40a5d49e396` |

Veröffentlicht aus dem CI-geprüften [PR #280](https://github.com/Riflex91/ALBot/pull/280) mit [Signierworkflow 39452100947](https://github.com/Riflex91/ALBot/actions/runs/39452100947). Linux- und Windows-CI sowie 1.982/1.982 Release-Offlinetests bestanden; ECDSA-P-256-Signatur und SHA-256/Bytezahl verifiziert. Freigabekorrekturen für kumulierte Multi-Pull-Gefahr, Heilerreichweite, Notfall-Gruppenkoordination und lokale Gefahrennavigation. Die persönliche Konfiguration, Loader-URL und Public-Key-Identität sind unverändert. **Eine Ingame-Liveabnahme wurde nicht durchgeführt.**

### Historischer Release-Stand: Sequence 16 (19.10.2026)

## Vorheriger signierter Release-Kanal (Sequence 16, 19.10.2026)

| Feld | Beobachteter Wert |
| --- | --- |
| `sequence` | `16` |
| `version` | `0.16.0-candidate` |
| `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| `bytes` | `772611` |
| `sha256` | `13473debb65a32253adccda4fbf967f5540b613a84fe57059747f7d7c5610950` |

Release aus [PR #251](https://github.com/Riflex91/ALBot/pull/251), signiert mit [Workflow 39331939239](https://github.com/Riflex91/ALBot/actions/runs/39331939239). Nach bestandener Linux-/Windows-CI wurden 1.806/1.806 Offline-Tests, ECDSA-P-256-Signatur, SHA-256 und Bytezahl verifiziert. Quelländerungen: sichere Team-Konvergenz trotz aktiver Aggro und Fortsetzung der gemeinsamen Farmplan-Auswahl ohne gültigen Plan. Persönlicher Ingame-CODE, Loader-URL und Key unverändert; Spiel-Liveabnahme offen.

### Vorheriger signierter Stand (Sequence 15)

## Historischer signierter Release-Kanal (Sequence 15, 19.10.2026)

| Feld | Beobachteter Wert |
| --- | --- |
| `sequence` | `15` |
| `version` | `0.15.0-candidate` |
| `runtimeUrl` | `https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js` |
| `bytes` | `768559` |
| `sha256` | `d64dffbe2646337343af2128c230d6e1a38458311807e18f4749633047fe695a` |

Die neue **Sequence 15** wurde mit [Signierworkflow 39326454243](https://github.com/Riflex91/ALBot/actions/runs/39326454243) kryptografisch freigegeben; PR [#244](https://github.com/Riflex91/ALBot/pull/244) bestand die vollständige Linux-/Windows-CI. Änderungen: ausschließlich lokal verfügbare Kampfunterstützung, keine fiktiven Heiler-/DPS-Beiträge, sichereres Team-Rendezvous und begrenztes Kiting. 1.793/1.793 Offline-Tests bestanden. Persönliche **Ingame-Konfiguration** bleibt separat und unverändert; ein alter CODE kann weiterhin `risk=assertive` verwenden. Live-Abnahme offen.

**Vorheriger Stand:** Sequence 14, `0.14.0-candidate`, 765913 Bytes, SHA-256 `3ed5c6a0277c14aefe0847b940f256fc2230566fa4ba53063bb4da499502f91a`.

Der bestehende Loader, sein Public Key und die Ingame-Konfiguration sind nicht
Bestandteil der G04-Änderung. Für die CI-Verifikation wird der aktuelle Release-Branch
einmal als Commit-SHA aufgelöst und Manifest sowie Runtime werden bytegenau aus
**demselben unveränderlichen Commit** geprüft. Die signierte URL und die strenge
ECDSA-P-256-/SHA-256-/Sequenzkontrolle bleiben bestehen. Es gibt keine bestätigte
Spiel-Liveabnahme. Die Signierung von Sequence 15 erfolgt ausschließlich über den separaten Releaseworkflow.

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

