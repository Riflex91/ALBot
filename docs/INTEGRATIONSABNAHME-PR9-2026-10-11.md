# PR #9: Gemeinsame Integrationsprüfung und kontrollierte Live-Abnahme

Stand: **11. Oktober 2026**. Gilt für den **nicht gemergten** Arbeitsbranch `work/u01-u02-source-verification-20261010` in [PR #9](https://github.com/Riflex91/ALBot/pull/9). **Nicht** als vorhandene Livebestätigung interpretieren. Testphase erst nach bewusster manueller Auswahl des passenden Builds und der eigenen Konfiguration starten; **kein** automatischer Login, Deployment, Merge oder Game-API-Aufruf durch die Offline-CI.

## Bereits offline geprüft

- Derselbe Runtime-Build und das Werkstattpaket durchlaufen Node-Suite, Browser-/Headless-Harness, Syntax und Byte-/Manifestprüfung auf Linux und Windows.
- Teamstatus mit gleichzeitig großen Gear-, Farm-, Produktions-, Performance- und Account-Zusätzen bleibt unter der **5-KB-Grenze** für CM/IPC. Sicherheitsrelevante Felder (Gold, Transfersperre, Journal, Inventarsperre, Status, Realm und Peer-Bedarf) werden bevorzugt erhalten; rein optionale Angaben fallen zuerst weg.
- Ein zweiter simulierter Charakter empfängt den gekürzten Status und verarbeitet den anstehenden Goldtransfer in der Account-Risikoberechnung konservativ. Explizites `false` oder `{success:false}` der Transportadapter wird nicht als erfolgreich gemeldeter Versand behandelt.

## Vorbereitungen ohne Spielaktionen

1. [PR #9](https://github.com/Riflex91/ALBot/pull/9) und [Roadmap](../ROADMAP.md) abgleichen. Erst einen **erfolgreichen CI-Lauf auf exakt dem ausgewählten Commit** abwarten. Für einen lokalen Windows-Abgleich die vorhandenen Skripte nutzen: `npm ci`, `npm test`, `npm run build`, `npm run build:editor`, `scripts/VERIFY-U01-U07.ps1`. Keine persönlichen Profil- oder CODE-Dateien überschreiben.
2. Vollbetrieb-Konfiguration `albot.full/v1` beibehalten. Testlogging (`general.testLogging`) einschalten und kontrollieren, dass Namen, Charakterklassen, Realm, erlaubte Monster, Gruppenleiter und Merchant konsistent sind. Einstellungen für bewusst ausgeschaltete Funktionen nicht versehentlich einschalten. Eigene Goldreserve, `maxSpendPerHour`, `lossBudget`, Mindestchancen und `keep`-/`teamReserve`-Regeln beibehalten.
3. Headless: Ausgabe **Desktop/ALBot-Testlogs**, je Charakter eine eigene mit Startzeit benannte `.jsonl`-Datei. Browser: `chooseLogDirectory` nach ausdrücklicher Ordnerfreigabe oder `exportTestReport` / „Testlog speichern“. [Betriebsanleitung](VOLLBETRIEB.md) beschreibt Speicherort und Format.
4. Zu Beginn der Abnahme alten **offenen** `journal`-/`inventoryBlocked`-Status und bereits laufende Spiel-Standangebote feststellen. **Kein** `acknowledgeInventory` ohne manuellen Vergleich der wirklichen Bestände. Ein offener unbekannter Wertauftrag stoppt die Abnahme wirtschaftlicher Aktionen.

## Kontrollierter gemeinsamer Live-Test – Freigabereihenfolge

Die folgenden Zeitfenster sind **Prüfumfang und Orientierung**, keine behaupteten Messungen oder garantierte Zeit. Während aller Phasen dieselbe Runtime, dieselbe Party und dasselbe Profil verwenden; einzelne Risiken nur bewusst gezielt freigeben.

| Phase | Beobachten / zulassen | Bestehenskriterium / Nachweis |
|---|---|---|
| 1. Start / Teamstatus | Browser und Windows-Headless jeweils mit echtem Charakter, anschließend Merchant + Farmer; Heartbeats, Realm und Roster | Je Instanz genau ein Scheduler, gültige Peer-Statusmeldungen; keine ausbleibenden Heartbeats durch übergroße Daten, keine ungewollten Duplikate oder Charakterstops |
| 2. Kampf / Farming | Sicher freigegebene Monster, Leader, Aggro, AoE/Pull, Retreat, Aura und Nachschubbedarf | Keine unerlaubten PvP-/Fremdziele, keine ungewollte gefährliche Pull-Eskalation; Kampf/Erholung behalten Vorrang |
| 3. Item-/Goldlogistik | **Eine** kleine ausdrücklich freigegebene Item- und Goldübergabe zwischen realen Charakteren | Vollständige Offer/Accept/Sent/Receipt/Done-Kette, Menge stimmt auf beiden Seiten; Transfers werden nicht als Vermögenszuwachs doppelt gezählt |
| 4. Wirtschaft / Produktion | Einzelnes risikoarmes, explizit erlaubtes Crafting einschließlich vorbereitendem Merge; erst danach ein gesondert freigegebenes kleines Upgrade/Compound, falls Zutaten/Scrolls/Chancen vorhanden | Rezeptpositionen, Materialreserven, Produktionsziel, reale Vor-/Nachbestände und Wertjournal passen zusammen. Keine wiederholte Wertaktion bei unklarem Ausgang |
| 5. Markt / Bank / Service | Geringwertige zulässige Handels-/Wishlist-Aktion und Bedarf für Merchant, Bank-/Werkzeugabläufe | Live-Preis/Slot/Instanz eingehalten; kein geschütztes Item verkauft; freier Platz, Budget und Werkzeugrückwechsel korrekt |
| 6. Unterbrechung / Wiederanlauf | Pause/Resume während **wertfreier** Arbeit; Reload erst bei ruhendem Wertjournal; anschließend mehrere Charaktere gleichzeitig beobachten | Ein Timer und keine geleakten Listener; kein doppelter Transfer oder Replay; Risiken, Reserven und Scheduler bleiben konsistent |

**Sofort pausieren**, wenn ein unbekanntes Wertjournal, eine unerklärte Gold-/Itemdifferenz, wiederholte Transferaufträge, drohende unkontrollierte Goldverluste, falsch freigegebene Items, fremde Kampfziele, eine kritische Bewegungsschleife oder ein außer Kontrolle geratenes Tick-Zeitbudget erkennbar sind. Laufende unklare Aktionen niemals blind erneut senden oder Journale einfach löschen.

## Erforderliche Belege für die Auswertung

- Pro beteiligtem Charakter das **neueste Headless-JSONL**; bei längeren Aktionen zusätzlich die direkt vorherige Teildatei. Für Browser-Test die zugehörigen Dateien oder Testberichte.
- Zu jedem auffälligen Vorgang: UTC-Zeit, Charakter/Rolle, Realm/Map, Art des Auftrags, gewolltes Ergebnis, tatsächlich beobachtete Vor-/Nachbestände und ob bewusst pausiert/neugestartet wurde.
- Besondere Eventfamilien: `action.selection`, `action.start`, `action.end`, `inventory.intent`, `inventory.result`, `logistics.*`, `gold.*`, `production.*`, `scheduler.slow`, `runtime.warning`. Logs ohne Roh-Socketdaten/Zugangsdaten weitergeben.
- Fortschrittsmetriken getrennt ausweisen: XP/h, belegte Netto-Goldänderung **ohne interne Transfers**, Tode/Retreats, fehlgeschlagene Lieferungen, offene Journale, Zeit in Wartestellung, Produktoutput und Tick-Laufzeiten.
- Für jedes bestätigte Liveproblem: reproduzierbare Konfiguration (ohne Geheimnisse), betroffene Logzeilen, tatsächliche Spielwirkung, erwartete Wirkung, kleinste Korrektur und erneuter Regressionstest.

## Freigabe-Gates

- **Code/CI:** vollständig bestanden auf genau dem PR-HEAD (Linux + Windows, Paketparität).
- **Live-Integration:** wird **erst nach** den genannten realen Tests als bestanden markiert. Ein älterer bestandener Live-C-Teiltest bestätigt nicht automatisch neue U01–U07-Funktionen.
- **Merge:** PR #9 bleibt **Draft**, bis der Diff geprüft, überlappende ältere PRs (insbesondere [PR #8](https://github.com/Riflex91/ALBot/pull/8)) bewusst eingeordnet und Livefehler behoben oder dokumentiert sind. `main` nicht vorzeitig überschreiben.
- **Noch nicht belegt:** echtes `get_progression()` in Browser/Headless, alle Klassen-/Boss-/Eventfälle und Linux-Livebetrieb. Ohne passenden Testfall ausdrücklich **nicht getestet** notieren.
