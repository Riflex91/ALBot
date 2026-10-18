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

Der überprüfte Bootstrap-Vertrag steht in `bootstrap.contract.json` und `docs/BOOTSTRAP-VERTRAG.md`. Die persönliche Hauptdatei liegt unter https://raw.githubusercontent.com/Riflex91/ALBot/main/bot.js. Der beobachtete CODE-Quelltext verweist auf https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json. Das signierte Manifest benennt https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js. Der Ingame-Ladeerfolg ist noch **nicht** live beobachtet.
