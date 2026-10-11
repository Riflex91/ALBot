## Browser-Phase-1-Beobachtungen und Transportdiagnose (11.10.2026)

**Vom Nutzer gelieferte Browserreports:** My_Ranger1 und My_Merchant mit Profil `ALBot Phase 1 - Browser-Diagnose`, `0.8.4-full`, EUII, `transport:auto`, je ~44 Sekunden beobachtet und wieder pausiert. Ranger: 852 Scheduler-Ticks, Ø 1,57 ms, max. 17 ms. Merchant: 170 Ticks, Ø 0,82 ms, max. 8 ms. Nach manueller Bestandsprüfung und Freigabe älterer `shoes +4`-/`beewings`-Journale blieben beide bei `inventoryBlocked:false`, `journal:null`, `pending:0`. Im kumulierten Rangerlog standen drei `regen`-Aufrufe; der genaue Zeitpunkt ist nicht belegt. Kein neuer Wertauftrag im beobachteten Testbericht. Bundle-SHA256 nicht vom Nutzer geliefert, daher konkrete Dateigleichheit zum CI-Artefakt nicht belegt. **Der folgende, spätere Browser-Livetest bestätigt den gegenseitigen CM-Heartbeat-Empfang; live `smart_move` bleibt ungetestet.**

**Codeerweiterung in PR #9, nicht in main:** `ALBot.transportStatus()` sowie `transport` im Testreport zeigen Zähler für Heartbeat-Versuch, erfolgreiche Adapter-Rückgabe, validierten Empfang, Versandfehler, abgelehnte Pakete und Duplikate. Je Team-Peer werden Empfangsalter, Session, Realm, Laufstatus, Frische gemäß TTL und Zähler angezeigt. Rein lesende Diagnose ohne zusätzliche CM- oder Wertaktion; keine Gold-/Item-/Inventardaten in dieser Übersicht. Das Feld `heartbeatSent` bedeutet **nur**, dass der CM-/IPC-Adapter Erfolg gemeldet hat, nicht dass der Empfänger das Paket erhalten hat; auf der Gegenseite sind `heartbeatReceived > 0` und `fresh:true` erforderlich. Bestehende Session-/Sequenzprüfung und Sicherheitslimits gelten weiter.

**Nachgelieferter Browser-Livetest – Kommunikations-Gate bestanden (11.10.2026):** Nutzer führte bei `My_Ranger1` und `My_Merchant` im Spiel die erneute manuelle Phase-1-Ausführung mit der korrigierten Diagnoseruntime `0.8.4-full` durch. Die Startvorprüfung meldete je `running:false`, `inventoryBlocked:false`, `journal:null`, `pending:0`, gegenseitigen Roster-Eintrag sowie null Zähler. Während beide danach liefen (`running:true`, Realm `EUII`) wurden folgende reale CM-Ergebnisse gemeldet:
  
| Messgröße | My_Merchant | My_Ranger1 |
|---|---:|---:|
| `heartbeatAttempts` / `heartbeatSent` | 18 / 18 | 23 / 23 |
| `heartbeatReceived` | **19** | **22** |
| Partner `fresh` / `running` | true / true | true / true |
| Empfangsalter Partner | 995 ms | 983 ms |
| `sendFailed` / `rejected` / `duplicates` | 0 / 0 / 0 | 0 / 0 / 0 |
| `inventoryBlocked` / Journal / `pending` | false / null / 0 | false / null / 0 |

Die gemeldeten Peer-Sessions waren `My_Ranger1-mv3p46j3-h3626b` beim Merchant und `My_Merchant-mv3p49y7-ibad4w` beim Ranger. Beide sahen `realm:EUII`. Sende-/Empfangszähler sind Momentaufnahmen und müssen nicht übereinstimmen; **entscheidend ist der validierte Empfängerzähler auf beiden Seiten**. Die Diagnose enthält keinerlei Item-/Goldtransfers; aus den Statusausgaben allein folgt auch kein vollständiger Aktions-/Wertlog-Nachweis für das letzte Zeitfenster. Der Nutzer wurde angewiesen, beide Bots anschließend zu pausieren; separate Bestätigung der Pause steht noch aus. Eine erneute Hashmessung der real geladenen `bot.js` fehlt weiterhin. **Keine Livefreigabe von `smart_move`, Farming, Kampf, Merchant-Wirtschaft oder Wertaktionen**; als nächste Teilphase zuerst sichere Standortkoordinaten und eine kontrollierte Movement-Testfreigabe beschaffen.

---

## Freigabevorbereitung: Movement-Korrektur und Browser-Phase 1 (11.10.2026)

**Code-Gate auf dem Arbeitsbranch:** `smart_move`-Suche wird nicht mehr vom 12-s-Positions-Stall-Watchdog abgebrochen, `move` hingegen schon. Ein unabhängig in `parent.smart` aktiver Such-/Bewegungszustand wird beim Stoppen bzw. vor dem Merchant-`town` erkannt. Absolute 120-s-Grenze bleibt aktiv; `movement.failed` gibt `no_progress` oder `timeout` aus. 5 neue Regressionen, [CI 38129349846](https://github.com/Riflex91/ALBot/actions/runs/38129349846), **261/261 Tests auf Linux und Windows** plus Build/Editor/SHA256. Keine echte Spielbewegung dadurch nachgewiesen. **PR #8 ausdrücklich nicht gemergt.**

**Phase 1 – konkret und ohne Wirtschaft:** CI-geprüftes `dist/albot.js` ausschließlich aus dem neuen PR-#9-Review-Artefakt wählen; keine ältere persönliche Test-/Live-C-Datei ersetzen. In **separater Kopie** des gültigen `albot.full/v1`-Profils vor dem Laden `general.autostart=false`, `general.testLogging=true`, `farming.enabled=false`, `farming.autoTravel=false`, `farming.loot=false`, `merchant.enabled=false`, `merchant.collectGold=false`, `production.enabled=false` und die World-Aktivitäten `world.bosses/events/quests/anniversary/autoHop=false` prüfen. Bestehende Nutzerbudgets, Regeln, `keep`-Vorgaben und Charakterzuordnung unverändert lassen. Erst einen Charakter in Browser-CODE laden, `ALBot.status()` (running=false, pending=0, journal/inventoryBlocked) prüfen, Testlogging/Report sichern und nur nach kontrollierter Zustimmung `ALBot.start()` aufrufen. Danach zweiten Charakter, Heartbeats/Session/Realm/Timer, anschließend `pause`/erneutes `start` ohne Wertaktionen prüfen. **Keine automatische Kampf-/Produktions-/Market-/Gold-/Itemfreigabe in Phase 1.**

**Belege:** Pro Charakter Browser-Testreport/`.jsonl`, aktive Bundleversion und SHA256, UTC-Zeit/Session, `action.selection/start/end`, `movement.request/arrived/failed`, `scheduler.slow`, `runtime.warning`, frische Peer-Heartbeats. Vor jeder späteren Bewegungs-/Bee-Phase `smart_move`-Wegsuche und Abbruchursachen im Browser tatsächlich messen. Unter **keinen** Umständen `acknowledgeInventory` benutzen, um eine offene ungeklärte Wertaktion pauschal freizugeben. Unklarer Journal-/Inventarstatus oder unerwartete Spielaktion = sofortiger Abbruch. **Browser-Test ist nur vorbereitet, noch nicht durchgeführt.**

## Zusätzlicher Abnahmefall: Item-Storno ohne Versand (11.10.2026)

**Bereits offline getestet:** Ein Itemempfänger akzeptiert ein Angebot und speichert `receive`. Bei Sender-STOP/Pause **bevor** `send_item` ausgeführt wird, oder bei Inventardrift im noch nicht ausgeführten Angebot, erhält der Empfänger `itemCancel/notDispatched` und darf sein Journal nur bei identischer Absender-Session/ID, unverändertem Bestand und ohne `sent`/beobachtete Lieferung abschließen. Späte, doppelte, fremde sowie nach einem gestarteten Versand empfangene Stornierungen dürfen keine Inventarsperre aufheben. Das neue Ereignis `logistics.cancelled` zeigt ID, Peer, Abbruchzustand und Grund; die **fehlende** Nachricht (Transportausfall) ist ausdrücklich **kein** Bestätigungsnachweis. [CI 38128697671](https://github.com/Riflex91/ALBot/actions/runs/38128697671): je 256/256 Offline-Tests auf Linux und Windows, gemeinsames Bundle und Manifest erfolgreich.

**Noch erforderlicher Live-Nachweis in Phase 3/6:** Nur nach ausdrücklicher Erlaubnis die reale `offer/accept`-Kette mit kontrolliertem STOP **vor** dem Versand beobachten. UTC-Zeit, Sender/Empfänger-Session, Message-ID und `inventory.intent/result`, `logistics.cancelled/timeout`, `action.start/end` in beiden Logs abgleichen. Nach **bereits begonnenem** `send_item` nicht bewusst nachträglich ein Cancel zur Freigabe erzwingen. Bestands-/Goldabweichungen oder Storage-Ausfälle weiterhin manuell und fail-closed behandeln. Keine freigegebene Live-Aktion in dieser Offline-Runde, kein automatischer Login, Merge oder Deployment.

## Ergänzung – Empfänger-Session als Handoff-Gate (11.10.2026)

**Offline bestätigter und behobener Integrationsfehler:** Ein bereits akzeptiertes Itemangebot darf nicht über eine Empfänger-Runtime-Session hinweg ausgeführt werden. Zwei simulierte Charaktere prüfen `offer` → `accept` → Empfänger-Reload mit neuer Session → **kein** `send_item`, **kein** neues Senderjournal; auch wenn die neue Session erst zwischen Scheduler-Einplanung und `Executor.flush()` sichtbar wird. Die verworfene, noch nicht ausgeführte Zusage erzeugt `logistics.session-changed`. [CI 38128018952](https://github.com/Riflex91/ALBot/actions/runs/38128018952): **250/250 Tests je Linux/Windows**, Builds und Bundle-Hash erfolgreich. Das ist kein Beleg eines echten Itemtransfers im Spiel.

**Zusätzliche Live-Gates für Phase 3 und 6:** Bei kontrollierten, manuell freigegebenen Tests Session-ID des Senders und Empfängers für jede `offer/accept/sent/receipt/done`-Kette erfassen. Wird der Empfänger **vor** dem Versand neu gestartet, darf kein veralteter Versand erfolgen. Nach einem **bereits versandten** oder nicht eindeutig quittierten Item bleibt die Inventar-Journalsperre bis zur belegten Bestandsprüfung erhalten. Zu Diagnosezwecken `logistics.session-changed`, `logistics.timeout`, `inventory.intent`, `inventory.result` und `action.selection/start/end` mit UTC-Zeit korrelieren; bei Differenzen sofort abbrechen. Kein Auto-Retry, kein automatisches Quittieren.

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
