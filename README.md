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
