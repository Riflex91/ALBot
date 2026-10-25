**Neuester signierter Release: `0.61.0-candidate`, Sequenz 61 (25.10.2026).** [AoE-Überlebenden-Fix #498](https://github.com/Riflex91/ALBot/pull/498) mit grünem [Linux-/Windows-CI-Lauf #40182507912](https://github.com/Riflex91/ALBot/actions/runs/40182507912), Main-Merge `eeaa0a90` und erfolgreichem [geschützten Signing #40182692815](https://github.com/Riflex91/ALBot/actions/runs/40182692815). 2699 Offline-Tests; Runtime 1040534 Bytes, SHA-256 `64c7230067a175596484612321d54c373b5da3ca17374942710762165f51f4ff`, bytegleich mit Main. Der vorhandene V2-Bootstrap lädt die signierte Runtime beim nächsten CODE-Neustart; persönliche Konfiguration, Schlüssel und URLs unverändert. **Ingame-Test der Korrektur noch offen.** [Zertifizierungsbericht](docs/RELEASE-CERTIFICATION-0.61.0-2026-10-25.md). Ältere „neuester“ Angaben unten sind historisch.

**Neuester signierter Release: `0.60.0-candidate`, Sequenz 60 (25.10.2026).** Farmer-/Gear-Korrekturen [PR #495](https://github.com/Riflex91/ALBot/pull/495), grüne Linux-/Windows-CI und geschütztes ECDSA-P-256-Signing mit 2696 Offline-Tests. Runtime 1040486 Bytes, SHA-256 `83a86b6b68288ab8d7001f6fba894a50cf45e87542012b8c00d5c49438de0800`; Main-/Release-Runtime bytegleich. Der vorhandene V2-Bootstrap lädt diese Version beim nächsten CODE-Neustart; Einstellungen, Schlüssel und URLs bleiben erhalten. **Ingame-Abnahme offen.** [Zertifizierung](docs/RELEASE-CERTIFICATION-0.60.0-2026-10-25.md). Ältere Release-Angaben unten sind historisch.

**Neuester signierter ALBot-Release: `0.57.0-candidate`, Sequence 57 (24.10.2026).** Der bestehende V2-Bootstrap lädt das aktualisierte, ECDSA-P-256-signierte Manifest vom unveränderten Release-Branch. Der [geschützte Signierlauf #40126153596](https://github.com/Riflex91/ALBot/actions/runs/40126153596) bestand vollständig: 1032743 Runtime-Bytes, SHA-256 `2517d22acecf80ad27e43754df1ed125932824d6e56a30562836b0ef84ca75d9`; identisches geprüftes `main`-Runtime-Bundle. Linux-/Windows-CI [#40124486861](https://github.com/Riflex91/ALBot/actions/runs/40124486861) erfolgreich. Persönliche Einstellungen, Bootstrap-Vertrauensschlüssel und URL unverändert. **Ingame-Navigation weiterhin nicht live validiert**; neue Runtime erst kontrolliert im Spiel prüfen. [Vollständiger Nachweis](docs/RELEASE-CERTIFICATION-0.57.0-2026-10-24.md). Die früheren „aktuell“-Meldungen unten sind historisch.

**Aktuell signiert und offline zertifiziert: `0.51.0-candidate`, Sequence 51 (24.10.2026).** [Kampfkorrektur PR #470](https://github.com/Riflex91/ALBot/pull/470) wurde nach [grüner Linux-/Windows-CI 40102128676](https://github.com/Riflex91/ALBot/actions/runs/40102128676) in `main` (`d4689616791f53e2258451fc13747b278418e333`) gemergt. Der [geschützte Signierworkflow 40102314268](https://github.com/Riflex91/ALBot/actions/runs/40102314268) prüfte die vollständige Offline-Testsuite erneut, bewahrte die persönliche Konfiguration, signierte und verifizierte **995835 Runtime-Bytes** (SHA-256 `ba93cd9f5f0c4197c4ca7f9a53ac9380312938ec965f2240fcf2deb0d6a0491c`) mit unverändertem ECDSA-P-256-Schlüssel. Signierte Runtime und getestetes `main` sind byteidentisch. Der Fix priorisiert verifizierte Unterstützung des Leader-Ziels durch Priest/Ranger2 vor neuen Einzel-Pulls und diagnostiziert abgewiesene Fokusziele. Die bestehenden V2-URLs sind unverändert; **Ingame-Liveabnahme und W14-Dauerlauf sind offen.** [Zertifizierungsdetails](docs/RELEASE-CERTIFICATION-0.51.0-2026-10-24.md). Alle älteren untenstehenden Aussagen „aktuell“ sind historische Release-Einträge.

**Aktuell signiert und offline verifiziert: `0.37.0-candidate`, Sequence 37 (22.10.2026).** [Coat-Purchase-Loop-Fix PR #423](https://github.com/Riflex91/ALBot/pull/423), [grüne Linux-/Windows-CI 39823195943](https://github.com/Riflex91/ALBot/actions/runs/39823195943) und [Signierworkflow 39823639584](https://github.com/Riflex91/ALBot/actions/runs/39823639584). Wiederholte NPC-`coat +0`-Käufe bei vorhandenen Upgrade-Zwischenstufen sowie automatische Verkäufe derselben Produktionsinputs sind gesperrt. Sequenz 37, Runtime 948766 Bytes, SHA-256 `8c1f56ae2a3add62f17a54a8208cfa87f53e4dd88ab082236ea2d0df5f897f55`. Bootstrap-Adresse/Signierschlüssel und persönliche Konfiguration unverändert; Live-Ingame-Test noch offen.

**Aktuell signiert und offline zertifiziert: `0.36.0-candidate`, Sequence 36 (22.10.2026).** [Vorbereitungs-PR #421](https://github.com/Riflex91/ALBot/pull/421) mit vollständig grüner Linux-/Windows-CI und main `b9efdc6e100c3e3d9351369d99b220246e6c3f4c`. Der [geschützte Signierworkflow 39821966672](https://github.com/Riflex91/ALBot/actions/runs/39821966672) absolvierte **2440 Offline-Tests, 0 Fehler**, erhielt die persönliche ALBotConfig und prüfte die ECDSA-P-256-Signatur für 946860 Bytes Runtime, SHA-256 `68ab546e675c6fdb0d2e6878f7814c213517f81361d548dda646745d087aec31`. Release-Commit `3d244dc0dfa6334bf2377f1ca8e1cbbfe16657cd`; veröffentlichte Runtime, persönliche `bot.js`, Bundle, Auto-Bootstrap und Editor byteidentisch mit dem getesteten main. **Dies ist Offline-Zertifizierung, keine W14-Ingame-/Dauerlauf-Abnahme.** Alte Aussagen „aktuell 0.35/0.34“ unten sind nur historische Einträge. Signaturschlüssel, Loader-URLs und persönliche Konfiguration unverändert. Einzelheiten: [0.36-Zertifizierungsbericht](docs/RELEASE-CERTIFICATION-0.36.0-2026-10-22.md). 

**Aktuell signiert und kryptografisch verifiziert: `0.34.0-candidate`, Sequence 34 (22.10.2026).** [Release-PR #409](https://github.com/Riflex91/ALBot/pull/409) nach [vollständig grüner Linux-/Windows-CI 39807781321](https://github.com/Riflex91/ALBot/actions/runs/39807781321) gemergt. [Signierworkflow 39808164061](https://github.com/Riflex91/ALBot/actions/runs/39808164061) prüfte die Runtime (`942181` Bytes, SHA-256 `214d71fb5a06dbbeddad823bc8fed31354dc5c14f067f20f4c30975094078784`) und signierte Sequence 34 mit ECDSA-P-256; Release-Binärdatei identisch mit `main`. Enthält Tracktrix-UI-Schließung #404 und Marktkauf-/Green-Jr-Fixes #406. Bootstrap, Manifest-URLs, Public Key und persönliche Konfiguration unverändert; kein Live-Spielnachweis.

**Vorher signiert und kryptografisch verifiziert: `0.33.0-candidate`, Sequence 33 (21.10.2026).** [Merchant-/Gear-/Tracktrix-Fix PR #396](https://github.com/Riflex91/ALBot/pull/396) nach [grüner Linux-/Windows-CI 39672422581](https://github.com/Riflex91/ALBot/actions/runs/39672422581) in Main (`8987bbc57afbddf65c9d17bbe265aaf81a8e541d`). [Geschützter Signierworkflow 39672789116](https://github.com/Riflex91/ALBot/actions/runs/39672789116): ECDSA-P-256 gültig, vollständige Offline-Tests bestanden, 937137 Runtime-Bytes, SHA-256 `6d98c645633c5f23cac5390f571a7dff033a0b5e1d6897c5ee48738ef0e9ee75`. Die Release-Runtime ist byteidentisch mit der genehmigten Main-Runtime; persönliche ALBotConfig, V2-Loader, Schlüssel sowie Runtime-/Manifest-URLs unverändert. **Ingame-Liveabnahme** für Lieferweg, Gear-Übergabe und Tracktrix-Verteilung steht noch aus. Frühere Freigabeangaben unten sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.32.0-candidate`, Sequence 32 (21.10.2026).** [Loot-Backlog-Fix PR #391](https://github.com/Riflex91/ALBot/pull/391) nach [grüner Linux-/Windows-CI 39660456088](https://github.com/Riflex91/ALBot/actions/runs/39660456088) in Main (`fdbce853f4fc71c69c45240f5cda9ffe517a7032`). [Signierworkflow 39660752603](https://github.com/Riflex91/ALBot/actions/runs/39660752603): ECDSA-P-256 gültig, alle Offline-Tests bestanden, 933121 Runtime-Bytes, SHA-256 `36e1e4f702ce1059fad2b610d8faea811e29a066870a758134619764c11101bd`. Release-Runtime und genehmigte Main-Runtime byteidentisch. Persönliche ALBotConfig, V2-Loader, Schlüssel und URLs unverändert; Loot-Ingame-Liveabnahme offen. Frühere Freigabeangaben unten historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.31.0-candidate`, Sequence 31 (21.10.2026).** [Bank-Telemetrie-Fix PR #387](https://github.com/Riflex91/ALBot/pull/387) und [Release-Vorbereitung #388](https://github.com/Riflex91/ALBot/pull/388) nach grüner [Linux-/Windows-CI 39659471317](https://github.com/Riflex91/ALBot/actions/runs/39659471317) in Main. [Geschützter Signierworkflow 39659853012](https://github.com/Riflex91/ALBot/actions/runs/39659853012): ECDSA-P-256 signierte Runtime, 930741 Bytes, SHA-256 `08ca21206962ae2fe5298263e11ad5c6d62790318f2b3ee24d50e18a5ab0fe55`. Signed-Runtime byteidentisch mit Main. Merchant erfasst kurz sichtbare Bankfächer während normaler Spiel-Ticks, hält sie begrenzt im Speicher und sendet nach Cloudflare-120s-Drosselung. Erfolgreiche Uploads löschen alte Fehler. V2-Loader, Signierschlüssel, Release-URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme der Bank-Snapshots bleibt offen.** Ältere Release-Angaben unten sind historisch.

**Vorheriges signiertes Release: `0.30.0-candidate`, Sequence 30 (21.10.2026).** [Gear-/Town-Fix PR #385](https://github.com/Riflex91/ALBot/pull/385) nach [grüner Linux-/Windows-CI 39657860717](https://github.com/Riflex91/ALBot/actions/runs/39657860717) in Main (`2cf82d84dcfab70ea2e23f2fee24a658373af303`). [Signierworkflow 39658407136](https://github.com/Riflex91/ALBot/actions/runs/39658407136): 2.339/2.339 Offline-Tests, ECDSA-P-256 gültig, 930030 Runtime-Bytes, SHA-256 `cc1f81faa723d962f8718a30f030429044d1eed4156b3d3802d06f56e7d54be8`. Veröffentlichte Runtime byteidentisch mit Main; V2-Loader, Public Key, URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme der Gear-Übergabe und Town-Reise offen.** Frühere Freigabeangaben sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.28.0-candidate`, Sequence 28 (21.10.2026).** [Farmer-first-Gear-Fix PR #378](https://github.com/Riflex91/ALBot/pull/378) nach [grüner Linux-/Windows-CI 39649989650](https://github.com/Riflex91/ALBot/actions/runs/39649989650) in Main (`275094333880f74595c0007d847f1465a51bb720`). [Signierworkflow 39650511597](https://github.com/Riflex91/ALBot/actions/runs/39650511597): 2.325/2.325 Offline-Tests, ECDSA-P-256 gültig, 926463 Runtime-Bytes, SHA-256 `1367b966f64faefb8556567db32656b749e2d98adbc943e80f0579012f851261`. Veröffentlichte Runtime byteidentisch mit Main; V2-Loader, Public Key, URLs und persönliche ALBotConfig unverändert. **Ingame-Liveabnahme offen.** Ältere Freigabeangaben darunter sind historisch.

**Aktuell signiert und kryptografisch verifiziert: `0.27.0-candidate`, Sequence 27 (21.10.2026).** [Release-PR #375](https://github.com/Riflex91/ALBot/pull/375) nach erfolgreich abgeschlossenem [Linux-/Windows-Preflight 39648365238](https://github.com/Riflex91/ALBot/actions/runs/39648365238) in den bestehenden Signierbranch übernommen. [Vertrauenswürdiger Signierworkflow 39649064561](https://github.com/Riflex91/ALBot/actions/runs/39649064561): 2.320/2.320 Tests, ECDSA-P-256-Signatur gültig, 924287 Bytes, SHA-256 `b55bea82b6c7de2f9edaeaeb5e28312cb21ea6dcb7088d4a882cbbcd923f0e50`. Enthält Telemetrie-Korrekturen [#372](https://github.com/Riflex91/ALBot/pull/372) und [#373](https://github.com/Riflex91/ALBot/pull/373). Live-Abnahme und einmalige Einrichtung von `INGEST_TOKEN` sind noch offen; persönliche Konfiguration, Bootstrap-Public-Key und Release-URLs bleiben unverändert.

**Vorheriges signiertes Release: `0.26.0-candidate`, Sequence 26 (21.10.2026).** [PR #367](https://github.com/Riflex91/ALBot/pull/367) nach grüner [Linux-/Windows-CI 39642937064](https://github.com/Riflex91/ALBot/actions/runs/39642937064) in Main (`aef9be83d1e04b62bb3c61548225ce0602b2e6e1`). [Signierworkflow 39643137036](https://github.com/Riflex91/ALBot/actions/runs/39643137036): 2.302/2.302 Offline-Tests, ECDSA-P-256 gültig, 922154 Runtime-Bytes, SHA-256 `b7f096e7fa7aab772f55968cbec44afde23070038cbc0933546bb8fc10d8862c`. Öffentlich geladene Runtime byteidentisch mit Main. Gearplanung schrittweise, Reentranz gesperrt, Diagnosen passiv; Einzelaufrufe können das kooperative Zeitbudget weiterhin überschreiten. Persönliche Konfiguration, V2-Loader, Key und URLs unverändert. Spiel-Liveabnahme 0.26 offen. Frühere Releaseangaben darunter sind historisch.

**Aktuell signiert und verifiziert: `0.24.0-candidate`, Sequence 24 (21.10.2026).** [PR #355](https://github.com/Riflex91/ALBot/pull/355) ist nach gruener Linux-/Windows-CI [39637823327](https://github.com/Riflex91/ALBot/actions/runs/39637823327) in Main. [Signierworkflow 39638036784](https://github.com/Riflex91/ALBot/actions/runs/39638036784): 2.274/2.274 Offline-Tests, ECDSA-P-256 gueltig, 916442 Runtime-Bytes, SHA-256 `56c2562496381ffdade50567fc33900cd15a9ad97453536cef5d98bb01f933f2`. Runtime byteidentisch zum freigegebenen Main-Commit `2ac84396ac482ebd12824f9d3338159528cd344d`. Rotationsfrist, verbindliche Materialarbeit, Markt-Fallback und Crafting-Gearziele sind enthalten. V2-Loader, Key, URLs und persoenliche Konfiguration bleiben unveraendert; Ingame-Liveabnahme offen. [Aenderungen und Grenzen](docs/CHANGELOG-0.24.0.md). Fruehere Releaseangaben darunter sind historisch.

**0.24.0-candidate: Rotationsfrist, verbindliche Materialarbeit, Markt-Fallback und Crafting-Gearziele.** [Implementierung, Regressionen und Livegrenzen](docs/CHANGELOG-0.24.0.md). Die signierte Veröffentlichung erfolgt separat über den bestehenden V2-Kanal.

**Aktuell signiertes Release: Sequence 19, `0.19.0-candidate` (20.10.2026).** Über [Workflow 39480451001](https://github.com/Riflex91/ALBot/actions/runs/39480451001) signiert und gegen exakt `886804` Runtime-Bytes sowie SHA-256 `d83f93525c6afc18b790ec820eb27074860cd617eec6acd7748a47c68e4d44c7` geprüft. Der Bootstrap-V2-Loader lädt diese Version automatisch vom unveränderten signierten Release-Kanal. Linux-/Windows-Abnahme bestanden; Persönliche `ALBotConfig`, Schlüssel, Cloudflare-Free-Grenzen unverändert, Game-Liveabnahme weiterhin offen. Enthält Farmer-One-Shots (#302), Merchant-Stabilisierung (#307) und Executor-Abschlussereignisse (#308).

**Historisches signiertes Release: Sequence 16, `0.16.0-candidate` (19.10.2026).** [PR #251](https://github.com/Riflex91/ALBot/pull/251) korrigiert fehlende Team-Rendezvous-Schritte bei gefährlicher Aggro: verifizierte Heiler-/Leader-Anker, begrenzte kollisionsgeprüfte Konvergenz und gemeinsame Farmplanung auch ohne vorhandenen Plan. Linux/Windows CI grün. [Signierworkflow 39331939239](https://github.com/Riflex91/ALBot/actions/runs/39331939239): **1.806/1.806 Tests**, 772611 Runtime-Bytes, SHA-256 `13473debb65a32253adccda4fbf967f5540b613a84fe57059747f7d7c5610950`, ECDSA-P-256 verifiziert. Bereits installierter V2-Loader und persönliche Ingame-`ALBotConfig` bleiben unverändert; neue Spiel-Liveabnahme offen. [Korrektur und Prüfgrenzen](docs/COMBAT-EMERGENCY-SQUAD-CONVERGENCE-2026-10-19.md).

**Historischer Stand (Sequence 15):** **Aktuell signiertes Release: Sequence 15, `0.15.0-candidate` (19.10.2026).** [PR #244](https://github.com/Riflex91/ALBot/pull/244) korrigiert die Fehlklassifikation fehlender Gruppenreichweite als Rückzug, entfernt unbestätigte DPS-/Heilungsbeiträge und stabilisiert Kiting und Team-Rendezvous. [Signierter Releaseworkflow 39326454243](https://github.com/Riflex91/ALBot/actions/runs/39326454243): 1.793/1.793 Tests bestanden; 768559 Runtime-Bytes, SHA-256 `d64dffbe2646337343af2128c230d6e1a38458311807e18f4749633047fe695a`; Signatur bestätigt. Kein neuer Spiel-Livebeleg. Die bereits im Ingame-CODE enthaltene `ALBotConfig` wird dabei **nicht** überschrieben; ältere eingebaute Profile können weiterhin `risk=assertive` statt `aggressive` setzen.

## Dauerbetrieb 0.10.11-candidate (18.10.2026)

**Vorheriger signierter Ingame-Kanal (19.10.2026): Sequence 14, `0.14.0-candidate`.** Im unveränderten Release-Branch: 765913 Bytes, SHA-256 `3ed5c6a0277c14aefe0847b940f256fc2230566fa4ba53063bb4da499502f91a`. Der Bootstrap, sein ECDSA-P-256-Schlüssel und die persönliche Ingame-Konfiguration bleiben unverändert. Signatur und Bytes werden in CI anhand einer unveränderlichen Release-Commitansicht geprüft; eine Spiel-Liveabnahme liegt nicht vor. Dieser G04-PR veröffentlicht keine neue Runtime.

**Frühere Freigabe: Sequence 11 (19.10.2026), `0.11.0-candidate`.** [PR #241](https://github.com/Riflex91/ALBot/pull/241) schafft bei fälligem Ausgleich nach unverändert 30 Minuten ein sicheres Rotationsfenster und erhält die bisherige Auswahl für Level-/Gear-Ausgleich. Enthalten sind die beauftragten AoE-/Merchant-Recovery-Korrekturen. Veröffentlichung aus [main-Commit 4f30819](https://github.com/Riflex91/ALBot/commit/4f30819e7a4ba8d794dc41111888665fdf265ab0). [Signierworkflow 39319057251](https://github.com/Riflex91/ALBot/actions/runs/39319057251): 1.781/1.781 Tests, ECDSA-P-256-Signatur gültig, 765836 Bytes und SHA-256 `75f331c2b9611d02fb954248f5fef9c90661ef6f569c5b5eb27dec171f793b31` verifiziert; Runtime bytegleich zu Main. Linux-/Windows-CI vor Merge grün. Bestehender Loader, Kanal und Schlüssel unverändert. Künftig erhöht jede neu signierte Runtime die Minor-Version um eins (+0.1), Patch 0; Signierung erzwingt dies. [Änderungen und Liveabnahme](docs/CHANGELOG-0.11.0.md). Spiel-Liveabnahme von Sequence 11 offen.

[Umgesetzte Autonomiemodule, Einstellungen, Prüfungen und ausdrücklich offene Roadmap-Pakete](docs/AUTONOMIE-ABGLEICH-2026-10-18.md). Das persönliche Aggressivprofil wurde auf Benutzerwunsch aktualisiert; eingebettete Ingame-Einstellungen werden nicht von der Runtime überschrieben. **Vorherige Freigabe: Sequence 9 (19.10.2026), `0.10.13-candidate`.** [PR #236](https://github.com/Riflex91/ALBot/pull/236) stabilisiert Standortbindung, Gruppenreise, Priest-Verhalten bei Weg-Aggro und Merchant-Arbeit. Veröffentlichung aus [main-Commit c7902b0](https://github.com/Riflex91/ALBot/commit/c7902b0c1c2693be807e09b56ab891b7508da18b) über den bestehenden V2-Kanal. [Signierworkflow 39313699242](https://github.com/Riflex91/ALBot/actions/runs/39313699242): 1.753/1.753 Tests, identische persönliche ALBotConfig, gültige ECDSA-P-256-Signatur und verifizierter SHA-256 der 760242 Runtime-Bytes. Linux-/Windows-CI vor Merge grün; Runtime bytegleich zu Main. Ingame-Loader, Downloadpfad und Schlüsselidentität unverändert. [Änderungen und offene Liveabnahme](docs/CHANGELOG-0.10.13.md). **Sequence 9 wurde noch nicht im Spiel live beobachtet.** Der vorhandene Bootstrap lädt nach CODE-Neustart/Reload die neue signierte Runtime; die persönliche Ingame-Konfiguration bleibt erhalten.

**Vorherige Freigabe: Sequence 10 (19.10.2026), `0.10.13-candidate`.** Die nach [PR #238](https://github.com/Riflex91/ALBot/pull/238) (G09) und [PR #239](https://github.com/Riflex91/ALBot/pull/239) (W06) geprüfte [main-Runtime 2f55d8a](https://github.com/Riflex91/ALBot/commit/2f55d8a907f3ae90cab6d301188d481a1f815121) wurde über den unveränderten signierten V2-Kanal veröffentlicht. [Signierworkflow 39317203696](https://github.com/Riflex91/ALBot/actions/runs/39317203696): 1.769/1.769 Tests bestanden, persönliche ALBotConfig bytegleich, valide ECDSA-P-256-Signatur; SHA-256 `d73796591d7964a525ac3725bc91f6d11d07bcabd6c48acb76d766231d6f9def` und 762149 Runtime-Bytes geprüft. Signierte Runtime bytegleich zu `main/dist/albot.runtime.js`. Der vorhandene Ingame-Loader, Manifest-/Runtime-URLs und öffentliche Schlüssel bleiben unverändert; Sequence 10 wurde nicht im Spiel live beobachtet.

---

## Kampf-KI: verifizierte Priest-Heilung und Ranger-Rettung (18.10.2026)

[Implementierung, Schutzgrenzen, Tests und getrennte Release-Freigabe](docs/COMBAT-HEILUNG-2026-10-18.md). Die Änderungen auf `main` ersetzen das signierte Ingame-Release nicht automatisch.

---

# Neuer Auto-Bootstrap: Runtime-Updates ohne erneutes CODE-Einfügen (Draft, 18.10.2026)

Die neue **[dist/albot.bootstrap.auto.js](dist/albot.bootstrap.auto.js)** benutzt einen fest hinterlegten öffentlichen ECDSA-P-256-Schlüssel und das signierte Freigabemanifest **[dist/albot.release.json](dist/albot.release.json)**. Nach einmaliger Installation lädt sie bei jedem CODE-Start automatisch die jeweils **signierte und freigegebene** Runtime und prüft SHA-256 vor der Ausführung. `general.autostart=true` bleibt aktiviert. **Live bestätigt:** Am 18.10.2026 hat der Nutzer den Auto-Bootstrap V2 mit aktiviertem Autostart auf allen vier Charakteren erfolgreich getestet (My_Ranger1, My_Ranger2, My_Priest und My_Merchant). **V2 ist der bevorzugte Startweg** für neue CODE-Slots; Logs und Dauerbetrieb sind nicht unabhängig verifiziert. Die alte erfolgreiche Bootstrap-Datei `dist/albot.bootstrap.js` und `bot.js` bleiben erhalten. Der private Releaseschlüssel wird nicht in Git abgelegt; zur Freigabe späterer Updates braucht der GitHub-Workflow das Secret `ALBOT_RELEASE_SIGNING_KEY_PEM`. [Installation, Key-Setup und Releaseablauf](docs/BOOTSTRAP-AUTO-RELEASE.md).

---
# Optionaler SHA-256-Bootstrap (Draft, 18.10.2026)

Der neue `dist/albot.bootstrap.js` ist ein kleiner **optionaler** CODE-Loader. Er übernimmt die unveränderte persönliche Konfiguration und lädt die Runtime aus GitHub erst nach vollständigem SHA-256-Vergleich. `bot.js` bleibt die bisherige vollständige, sofortige Startvariante. **Noch kein CORS-/CSP-Livetest im Adventure-Land-Runner; nicht ungeprüft zur Standarddatei machen.** [Setup, Grenzen und sichere Abnahme](docs/BOOTSTRAP-2026-10-18.md).

---

# ALBot 0.10.8-candidate – aktuell (15.10.2026)

Upgrade-Scrollwahl: Die persönliche [bot.js](bot.js) verwendet 65 % globale Mindestchance. Bei unzureichender scroll0-Chance prüft die Gear-Produktion scroll1, verwendet vorhandene Exemplare oder fordert ein Exemplar beim NPC an. Der echte Upgrade-Aufruf benötigt weiterhin eine frische ausreichende Servervorschau mit scroll1. 806/806 Offlinetests bestanden; Runtime, persönliche Bundleparität und Werkstatt geprüft. Neue Liveabnahme offen. [Befund, Ablauf und Grenzen](docs/CHANGELOG-0.10.8.md).

# ALBot 0.10.7-candidate (14.10.2026)

**Direkt einsetzbare [bot.js](bot.js)** mit automatischer Account-Erkennung, vorbeugender Lagerplanung und auf ausdrücklichen Benutzerwunsch `maxAggro=12`. Compounds und geprüfte Verkäufe können Platz schaffen, bevor Inventar und Bank vollständig belegt sind. Zufällige Exchanges müssen ihren ungünstigsten Slotbedarf gegen den freien Arbeitsraum prüfen. 3-shot darf drei freigegebene Ziele einschließlich neutraler Farmmonster treffen; die aktuelle Encounter-/Sicherheitsfreigabe bleibt zuständig. Persönliche Finanzsteuerung: `account-loss`, 85 % belegter Accountgoldverlust in 15 Minuten; vier bestätigte Offlinegold-Startwerte sind enthalten.

Die modularen Quellcodes unter `src/` sind die Wartungsgrundlage; `npm ci && npm run build` erzeugt die allgemeine `dist/albot.js`, `npm run build:editor` die Werkstatt. Danach die persönliche `bot.js` mit `node scripts/sync-personal-code.mjs --write` aktualisieren. 801/801 Windows-Offlinetests bestanden; neue Liveabnahme offen. Basis ist der gemergte Stand `11a795d`. [Neue Logbefunde, Verhalten, Grenzen und Verwendung](docs/CHANGELOG-0.10.7.md).

---

# Automatischer Betrieb und Gruppenwahl 0.10.1 – 13.10.2026

Lokale Automatik aktiviert Produktions-/Merchant-/Lernfunktionen und unterstützte Bossprofile innerhalb bestehender Budgets und Schutzregeln. Eigene Online-Farmer werden automatisch erkannt und auf 3.000 HP-/300 MP-Tränke aufgefüllt. Die Farmwahl berücksichtigt individuellen AoE-Beitrag, Priest-Heilung, Tankkontrolle, Rüstung/Resistenz, aktive Paladin-Auren und begrenzte Schutzressourcen.

[Einrichtung, Codezuordnung, Grenzen und Liveabnahme](docs/EINRICHTUNG-0.10.1.md). **503/503 Offline-Tests bestanden**, Runtime/Werkstatt gebaut; neue Spiel-Liveabnahme steht aus. Cloud/KI bleiben aus, keine Anbieteränderungen. Die folgenden älteren Statusblöcke sind historisch.

---

# Aktueller Kandidat 0.10.0 – 12.10.2026

Restmodule für gemeinsame Itemreservierung, endliche Upgrade-/Compound-Planung, belegte Marktverkäufe, Bossbereitschaft, adaptives Lernen, optionale KI sowie begrenzte Cloud-Rotation und Restore sind eingebunden. **Die neue Liveabnahme steht noch aus.**

- [Einrichtung und Live-Testmatrix](docs/EINRICHTUNG-0.10.0.md)
- [Implementierung, Codezuordnung und tatsächliche Grenzen](docs/IMPLEMENTIERUNGSSTAND-0.10.0.md)
- [Quellbelegter Bosskatalog](docs/BOSS-KATALOG.md)
- [Draft PR #32](https://github.com/Riflex91/ALBot/pull/32), Branch `codex/autonomous-merchant-20261012`

Cloud und KI bleiben standardmäßig aus. Neue Projekte in bestehenden Konten, neue Secrets, kein Altimport. Eine automatische kontoweite Abrechnungsprüfung ist nicht implementiert; Free-Tarife, Anbieter-Caps und alle sieben Tage manuell bestätigte Kontingente sind Voraussetzung. Funktionen können lokal ohne Cloud laufen.

Offline-Abnahme: **481/481 Tests** auf Windows/Node 24, Runtime und Werkstatt gebaut, gemeinsames Bundle **410.613 Bytes**. Worker mit Wrangler 4.149.0 als Dry-run gebaut; kein Deployment, keine neue Spiel-/Provider-Liveabnahme.

Die folgenden Einträge sind historisch und gelten nicht als aktuelle Liste offener Implementierungsarbeiten.

---

# Aktueller Kandidat 0.9.0 – 12.10.2026

Merchant-/Item-Ergänzungen, lokale Fehlerabkühlung und optionale neue Cloud-Backups sind implementiert. **Der vollständige Autonomieauftrag ist noch nicht abgeschlossen.** Einrichtung: [EINRICHTUNG-0.9.0](docs/EINRICHTUNG-0.9.0.md). Funktionen, Grenzen und konkrete Restarbeit: [IMPLEMENTIERUNGSSTAND-0.9.0](docs/IMPLEMENTIERUNGSSTAND-0.9.0.md). Cloud standardmäßig aus; neue Projekte in bestehenden Konten, keine alten Daten oder Schlüssel. Keine neuen Live-Nachweise. Die folgenden älteren Einträge beschreiben ihren jeweiligen historischen Stand.

---
# Arbeitsübergabe vom 10. Oktober 2026: v3-/ALFinal-Übernahmen

[Konkreter Arbeitsplan mit Quellbelegen und Abnahmekriterien](docs/UEBERNAHME-V3-ALFINAL-2026-10-10.md). U01–U07 sind offen: zuerst P90-Rangfolge und verifizierte Quest-Exchange-Ziele, danach Gear-/Marktökonomie, Account-Risiko und Paladin-Auren. U07 beschreibt ausdrücklich die Integration von get_progression() samt Browser-/Headless-Abnahme. ALBot 0.8.4 bleibt die gemeinsame Browser-/Headless-Basis. Diese Ergänzung ist nur Dokumentation; keine neue Runtime oder Livebestätigung. Vor Implementierung den Arbeitsplan lesen und inzwischen erfolgte Änderungen abgleichen.

---

# Aktuell: fortlaufender Betrieb und Merchant-Planung 0.8.4-full

Auf Benutzerauftrag Runtimefehler/unklare Wertwirkung protokollieren und Scheduler weiterführen; Journale behalten und Wertaktionen sperren. Reentranten Itemtimeout korrigiert, ALFinal-artige Servicebindung/Rückwechselschutz, Auftragsabkühlung und lokale Bündelung integriert. [Befunde, Vergleich und Wiederanlauf](docs/CHANGELOG-0.8.4.md). 173 Prüfungen bestanden; neue Livebestätigung steht aus. Verkaufsgrenze 1.000.000 und Mindestchance 65 % erhalten. Historische Aufforderungen zum automatischen Pausieren bei Runtimefehlern sind durch diesen Auftrag ersetzt; keine Journale blind löschen.

---

# Aktuelle Merchant-Korrekturen 0.8.3-full

Gold-/Item-Aufträge gegen gegenseitige Blockade getrennt; Goldabbruch ohne Dispatch sitzungsgebunden abgleichen. Bei Platzmangel freigegebene Bank-/Verkaufsaufträge vor gewöhnlicher Besorgung auswählen. Upgrade-Scrollvorrat schützen. [Befunde, Einstellungen und alte Empfangssperre](docs/CHANGELOG-0.8.3.md). 168 Prüfungen bestanden; neue Livebestätigung steht aus. Keine Journale automatisch löschen, keine Verkaufslimits oder Mindestchancen verändern.

---

# Aktuelle Livekorrekturen 0.8.2-full

Bewegte Goldempfänger, Neuwahl bei ausschließlich zu starken sichtbaren Farmgegnern und nicht ausführbare Bank-Stapelplanung korrigiert. Wiederholte Berechnungen begrenzt, Ticklaufzeiten im Testbericht ergänzt. [Befunde und Grenzen](docs/CHANGELOG-0.8.2.md). 162 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Persönliche Bank-Teilentnahme auf Benutzerwunsch aktiviert; allgemeine Vorgabe unverändert. Bestehende Journale und Budgets erhalten.

---

# Aktuelle Livekorrektur 0.8.1-full

Goldversand trotz laufender Farmbeute repariert, Town bei laufender Bewegung und geringerem Zeitgewinn, getrennten 250-ms-Übergabetakt eingebunden und Pickup-Pendel während Besorgung begrenzt. [Befunde, Änderungen und Umgang mit alter Goldsperre](docs/CHANGELOG-0.8.1.md). 158 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Vorhandene Wertjournale werden nicht automatisch gelöscht.

---

# Aktueller Stand: gemeinsame Integration 0.8.0-full

Die im v3/v4-Quellaudit benannten Fehler F01–F03 und Fachbereiche D01–D15 sind in die bestehende Runtime und Werkstatt integriert. [Umsetzung, Einstellungen und Grenzen](docs/PARITAET-0.8.0.md). Ein gemeinsames Browser-/Headless-Bundle mit erhaltenen Profilwerten; Autostart true. 154 gezielte Prüfungen bestanden unter Windows. Der nächste Schritt ist der gemeinsame Livetest; neue Livebestätigung und Linux-Livebetrieb stehen aus. Die folgenden Audit-/Releaseabschnitte dokumentieren frühere Stände.

---

# Aktueller Audit: v3/v4-Parität noch unvollständig

Der erneute Quellvergleich von 0.7.0 findet verbleibende Unterschiede bei Pull-/AoE-Steuerung, Bewegung, Gear-Lieferung, wirtschaftlicher Disposition, Materialplanung und Fähigkeitenkoordination. Die vorhandenen Ergänzungen sind keine vollständige Funktionsgleichheit. Maßgeblich sind [V3-V4-PARITAET-0.7.0](docs/V3-V4-PARITAET-0.7.0.md) mit 15 abgegrenzten Restbereichen und drei eingegrenzten Implementierungsbefunden sowie das vollständige Modulinventar. Runtime und persönliche Botdateien wurden bei diesem Audit nicht geändert.

# Implementierte Ergänzungen: Autonomie · 0.7.0-full

Die im Vergleich zu 0.6.2 benannten fachlichen Ergänzungen sind jetzt integriert: gemeinsame automatische Spawn-/Materialplanung, Elixiere, wirtschaftliche Gear-/Beutedisposition, Markt-/Mluck-Entscheidungen, globale Priorität und gebundener Wiederanlauf. Vollständige Zuordnung, Konfiguration und Grenzen: [AUTONOMIE-0.7.0](docs/AUTONOMIE-0.7.0.md). Neues Bundle und Werkstatt sind offline geprüft; gemeinsamer Livebetrieb und Linux bleiben unbestätigt. Updater entfällt.

# Aktuell: gemeinsamer Vollbetrieb · 0.6.2-full

Dieser historische Abschnitt beschreibt den damaligen Vollbetriebs-Kandidaten. Die später festgestellten Einschränkungen sind im Vergleich zu 0.6.2 dokumentiert; für die aktuellen Ergänzungen gilt die Autonomiematrix oben. Kein optionaler Updater. Alle Module teilen Scheduler, Ressourcen, Reservierungen und Wertjournale. Die neuen Wege sind noch nicht gemeinsam live bestätigt; frühere A/B/C-Nachweise bleiben auf ihre Szenarien begrenzt. Einstieg: [VOLLBETRIEB.md](docs/VOLLBETRIEB.md). Schema: `albot.full/v1`.

# ALBot

Ein gemeinsamer Adventure-Land-Bot für Browser-CODE und den vorhandenen Node.js-Headless-Client. Ziel: die Spielfunktionen aus ALFinal sowie v3, v4 und v5 zusammenführen, einschließlich Farmer, Merchant, Item-Regeln, Gruppenplanung und Produktion.

**Stand 7. Oktober 2026:** Live B mit `0.2.2-live-b` ist in Browser und Windows-Headless vollständig bestätigt. **Live C mit `0.3.1-live-c` ist laut Nutzerbestätigung bestanden.** Das bestätigt den vereinbarten Testablauf, einschließlich Bee-Wechsel und Merchant-Nebenaufgabe. Ausgeschaltete Welt-/Account-/Teamreiseoptionen und offene Roadmapfunktionen bleiben getrennt zu beurteilen; die Umgebungen wurden für diese C-Bestätigung nicht einzeln benannt. [Live-C-Ergebnis](docs/LIVE-C-ERGEBNIS.md) · [Live-C-Anleitung](docs/LIVE-C.md) · [Funktionszuordnung und offene Lücken](docs/INTEGRATIONSSTAND.md).

Aktuelles [Werkstattpaket](dist/albot.package.json), [Vollbetrieb-Teambeispiel](profiles/full-team.json). Persönliches Gesamtpaket: `node scripts/export-full.mjs Profil.json NEUER-Ordner [Client-config.json]`. Die Standalone-Werkstatt enthält bereits das aktuelle Runtimepaket; persönliche Exporte enthalten zusätzlich das Profil. Neue Exporte starten automatisch. Bestätigte historische Pakete A/B/C bleiben separat; der Merchant-Exporter verwendet das archivierte 0.4.0-Paket.

Build: `npm ci`, `npm run build`, `npm run build:editor`; gezielte Prüfungen: `npm test`. Node ab 22.9; Terser ist ausschließlich Buildabhängigkeit. Build/Export sind Windows-/Linux-portabel; tatsächlich ausgeführte Prüfungen dieses Kandidaten erfolgten unter Windows. Linux ist weiterhin nicht live nachgewiesen. Kein eigener Host, Socket oder Node-Zugriff im Bot.

Die [Bot-Werkstatt](editor/Bot-Werkstatt.html) als Datei herunterladen und lokal im Browser öffnen. Sie konfiguriert den gemeinsamen Bot und kann zusätzliche Bot-Pakete samt Einstellungsschemata laden. [Anleitung](editor/README.md) · [verbindlicher Integrationsvertrag](docs/WORKSHOP-CONTRACT.md).

## Einstieg

1. [ROADMAP.md](ROADMAP.md): verbindlicher Umfang, Reihenfolge und drei gezielte Live-Testpunkte.
2. [BOT-ANALYSE.md](docs/BOT-ANALYSE.md): Arbeitsweise der vier Versionen, konkrete Quellpfade und Übernahmeentscheidungen.
3. [HOW-TO-USE.md](HOW-TO-USE.md): vollständiger Vertrag des Headless-Clients 1.2.1, API-Version 1.
4. [RUNTIME-VERTRAG.md](docs/RUNTIME-VERTRAG.md): Umsetzung dieses Vertrags im zukünftigen Bot.
5. [AGENTS.md](AGENTS.md): Arbeitsregeln für weitere KIs.

Keine eigene Headless-Laufzeit, Telemetrieplattform oder umfassende Log-Infrastruktur. Keine Shadow-Tests. Der vorhandene Client übernimmt Login, Prozesse, Reconnect und sein optionales Dashboard. Der Bot übernimmt Spielentscheidungen.

Das Headless-Handbuch ist eine Kopie der Client-Dokumentation. Seine Installationsdateien wie `src/cli.js`, `.env.example` und `config.example.json` gehören zum separaten Client und sind in diesem Planungsrepository nicht enthalten. Die ergänzende [Typdefinition](docs/headless-api.d.ts) liegt hier bei.

Vollbetriebs-Testprotokoll: Browser **Testordner wählen** → fortlaufendes JSONL; Headless mit tools/client-test-report.js automatisch Desktop/ALBot-Testlogs. Jede Datei enthält Charakter und UTC-Startzeit. Historische kompakte Berichte bleiben unter test-logs/CHARAKTER/. Details und Reparatur des gemeldeten vollen Browser-Speichers: [LIVE-A.md](docs/LIVE-A.md).

Aktuelle Risikokorrektur: [0.6.2](docs/CHANGELOG-0.6.2.md). Prat aus den letzten Logs wird nicht als sicheres Teamziel behandelt. Fehlgeschlagene Ziele erhalten eine zeitlich begrenzte Sperre; Rückzug/Erholung haben Vorrang vor Merchant-Aufträgen. Neue Livebestätigung ausstehend.


## Dokumentierter Ingame-Bootstrap-Kanal

Der überprüfte Bootstrap-Vertrag steht in `bootstrap.contract.json` und `docs/BOOTSTRAP-VERTRAG.md`. Die persönliche Hauptdatei liegt unter https://raw.githubusercontent.com/Riflex91/ALBot/main/bot.js. Der beobachtete CODE-Quelltext verweist auf https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json. Das signierte Manifest benennt https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js. Der ältere V2-Ladevorgang wurde am 18.10.2026 vom Nutzer auf vier Charakteren bestätigt; der **neue Runtime-Release sequence 9** wurde noch nicht im Spiel beobachtet.
