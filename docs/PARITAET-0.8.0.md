# Gemeinsame Fachintegration 0.8.0-full

Der Folgeauftrag implementiert die drei Fehlerkorrekturen und die Entscheidungsbereiche D01–D15 aus dem [Quellaudit von 0.7.0](V3-V4-PARITAET-0.7.0.md) in der bestehenden Runtime. Ein Bundle, ein gemeinsames Profil, dieselbe lokale Werkstatt; kein Updater oder weiterer Headless-Host. Dies ist der neue Kandidat für den gemeinsamen Livetest. Alte Livebestätigungen gelten für ihre damals geprüften Abläufe.

## Reparierte Integrationsgrenzen

| Befund | Änderung |
|---|---|
| F01 | Neue Pulls am Materialziel prüfen individuelle Quote und gemeinsame Restmenge auch im tatsächlichen Angriffspfad. Bereits angegriffene Gegner können beendet werden; eine höher bewertete andere Aktivität wird nicht durch eine alte Materialquote gesperrt. |
| F02 | Craft-Schritte unterscheiden Batches und `outputQuantity`. Regeln begrenzen Outputeinheiten, einschließlich notwendiger Rundung auf ganze Batches. Exchange-Input wird bei P90 auch im tatsächlichen Beschaffungsplan konservativ bemessen. |
| F03 | Follower übernehmen neue Ablaufzeit und Rollen auch bei gleicher Plan-ID. Bewegung/Ziel werden nur bei einer tatsächlichen Planänderung zurückgesetzt. |

## Zusammenarbeit der Fachbereiche

| Auditbereich | Umsetzung und Einbindung |
|---|---|
| D01 Pull/AoE | `combat/encounter.mjs`: RECOVER, BUILD, HOLD, BURN, FINISH, ABORT. Tatsächlich bereite Mehrzielskills begrenzen Kapazität; neue Pulls nur vom Leader. Begrenzte persistente Profile nach Gruppe/Gear/Gegner und Packgröße vergleichen tatsächlichen EXP-Ertrag und Fehlschläge. Zunächst Einzelpulls, danach höchstens eine zusätzliche Größe nach gemessener sicherer Basis; keine Schattenkämpfe. Agitate nur bei passendem, vollständig überprüftem sichtbarem Pack. |
| D02 Bewegung | `combat/navigation.mjs` und Farmer: lokale sichere Umwege, zeitlich gesperrte nicht erreichbare Ziele, Flucht-/Orbit-Wegpunkte mit Farmanker, eigener Aggro und Gruppenabstand. Der Host übernimmt weiterhin Fernwege über `smart_move`. |
| D03 Reisezeit | Merchant-Bewegung vergleicht Town-Kanal plus Restweg mit Laufen auf derselben Karte. Eigene Aggro verhindert Town. Beobachtete Kanaldauer aktualisiert die Schätzung; unbekannte Spawns/API führen zur gewöhnlichen Reise. |
| D04 Mark | Gemeinsame Mark-Rolle und deterministische Wahl eines bereiten Ersatzes. Effektprüfung berücksichtigt `s`, `status`, `effects`, `conditions` und beobachtete Laufzeit/Ende. Explizite eigene Skillregeln bleiben vorrangig. |
| D05 Ressourcen | Auffüllen vor neuen Pulls nach HP/MP-Bereitschaft, Trankwahl nach Wiederherstellungswert und Defizit; Notfallversorgung hat Vorrang. Gemeinsame konfigurierbare HP-/MP-Trankobergrenze je Farmer bei Empfang. |
| D06 Ökonomie | Upgrade-/Compound-Erlösrechnung ab vorhandenem Level, Scrollkosten, Schrittchancen und Verkaufsalternative. Passende Compound-Sätze werden gesammelt, auch aus Bankbestand als Produktionsziel; automatische Verkaufsgrenze, vorhandene Reserven und Mutationsbudgets bleiben wirksam. |
| D07 Konto-Gear | Inventar-/Bankbestand und begrenzte bekannte Farmerbestände ergänzen Neukaufkandidaten. Bereits vorhandene Level zählen als bezahlter Fortschritt. Ziele nennen den vorhandenen Besitzer; Farmer liefern benötigten Bestand oder rüsten ihn lokal aus. Zukunfts-Gear wird vor automatischer Liquidation geschützt. |
| D08 Gear-Lieferung | Vorlieferungszusage enthält Ziel, Empfänger-Slot und dessen erwarteten Zustand. Empfänger prüft Kompatibilität, Verbesserung und explizite Regeln vor Accept; Sender bindet Zusage an Sitzung und physischen Itemzustand. Empfänger-Equip prüft denselben Slot erneut; anschließende Ausrüstung wird beobachtet. Transfer-Receipt und Equip sind getrennte Zustände. |
| D09 Ziele/Material | Produktionsziele gleicher Priorität werden nach geschätztem Nutzen je Beschaffungsstunde geordnet. Material-, normales Farm- und Weltziel konkurrieren um Nutzen; Nutzerskalierung für Material/Monsterhunt ist konfigurierbar. Beschaffung nutzt echte Bestände, rekursive Wege und P90-Input. |
| D10 Bankdruck | Bestehende Kapazitätsrettung nutzt zusätzlich automatisch wirtschaftlich verkäuflichen Bestand. Schutz, zukünftiges Gear, Reserven und Budgets gelten auch dabei; der bestehende persistente Rettungs-/Rücklagerungsweg bleibt erhalten. |
| D11 Aktionsauswahl | `core/executor.mjs` sammelt Befehle aller Tick-Produzenten, ordnet sie nach Wichtigkeit/Priorität und Alter und prüft Guards vor Dispatch erneut. Nur eine ausgewählte Aktion belegt ihre Ressourcen. Nicht gewählte Absichten werden nicht über Ticks mit alten Inventarslots aufbewahrt. Callback-Auswahl ist zusätzliche Planung, nicht mehr die einzige Priorisierung. |
| D12 Wissen/Drift | Standortwissen ist an Gruppen-/Gearkontext gebunden und altert. Stabile geänderte Definitionen werden vor Freigabe zusätzlich auf aktuelle Kampf- oder Itemsemantik geprüft; ein weiterhin unsicheres Farmziel bleibt gesperrt. Alte Pläne werden verworfen. |
| D13 Fähigkeiten | `party/capabilities.mjs`: strukturelle und aktuell bereite Skills, konfigurierte Freigabe/MP-Reserve, Ausrüstung/Material, Generation und Fingerprint. Heartbeat synchronisiert Bereitschaft; Rollen prüfen Ort, Reichweite, Frische und bereiten Ersatz. Lokale Guards bleiben direkt vor dem Skill verbindlich. |
| D14 Service | Positionsunsicherheit aus Geschwindigkeit und Meldungsalter begrenzt Serviceanreise. Starke/unsichere Ziele bleiben ausgeschlossen; normale sichere Farmkämpfe sind kein pauschales Serviceverbot. Veraltete oder veränderte Rendezvouswege werden abgebrochen und neu geplant. |
| D15 Werkstatt | Gemeinsames Schema ergänzt Skill-spezifische Mindestziele, verletzte Mitglieder, HP-Schwelle und Burst-MP-Budget. Die bestehende Oberfläche stellt diese Felder dar; Runtime verwendet sie bei den passenden Entscheidungen. |

Die Umsetzung übernimmt die Fachaufgaben in einer kompakten Architektur; sie kopiert nicht sämtliche historischen Hotfix-Schichten oder deren Freigabeverfahren. Schätzungen für Nutzen, Farmzeit, Risiko und Chancen bleiben Schätzungen. Neue Gearziele und Gewinnproduktion unterliegen weiterhin expliziten Nutzerregeln und vorhandenen Budgets.

## Neue Einstellungen in der bestehenden Werkstatt

- Farmer: `adaptivePull`, `pullHp`, `pullMp`, `potionUtilization`, `potionCarryMax`, `orbit`, `orbitRadius`, `knowledgeFreshMs`.
- Merchant: `townTravel`, `townMinSavingsMs`, `servicePositionError`.
- Produktion: `materialPreference`, `materialXpPerGold` sowie vorhandene `autoDisposition`, `autoGear`, `autoGearItems`, Ziel-/Verlustbudgets und `farmConfidence`.
- Welt: `questPreference`.
- Skillregel: `minTargets`, `minInjured`, `hpThreshold`, `manaBudget`; vorhandene MP-Reserve, Intervall, maximale Ziele und Bedingungen bleiben erhalten. Für neue Regeln beträgt die maximale Zielzahl standardmäßig fünf; gespeicherte Werte werden nicht ersetzt.

Alle Ergänzungen sind additive Einstellungen im Schema `albot.full/v1`. Vorhandene Profilwerte, Itemregeln, Charakteraktivierung und Budgets werden beim Aktualisieren erhalten. Autostart bleibt gemäß Nutzerauftrag true. Aggro- und AoE-Grenzen werden nicht eigenständig erhöht.

## Begrenzung und Nachweis

154 gezielte bestehende/neue Logik- und Vertragsprüfungen bestanden unter Windows: darunter erneuerte Followerpläne, individuelle Materialquote, Craft-Output/Batches, tatsächlicher P90-Input, Gearzusage im ersten Offer, bei verändertem Slot/Keep-Regel und Anforderung vorhandener Vorstufen, Compound-Sätze, globale Ressourcenpriorität, adaptive Einzelpull-Basis und weiterhin unsichere Inhaltsänderung. Klassisches Bundle wird in den vorhandenen Browser-/Headless-Vertragsprüfungen ausgeführt. Syntax und Bytegrenze werden beim Build geprüft. Neue gemeinsame Livebestätigung und Linux-Livebetrieb stehen aus.

Skillbereitschaft wird lokal höchstens 200 ms zwischengespeichert; die Ausführungsprüfung bleibt aktuell. Lernprofile, Inventarbeobachtungen, Zielanzahl und Suche sind begrenzt. Produktionsrouten und Gearbestände werden während einer Planung wiederverwendet. Keine zusätzlichen Prozesse, Sockets oder dauerhaften Dateizugriffe im Bot.

Der Livetest verwendet den gemeinsamen Vollbetrieb mit deinen tatsächlich eingeschalteten Funktionen, keine getrennten Testbot-Versionen. Diagnose enthält Encounter-Phase/Kapazität, Fähigkeiten, gesperrte Ziele, Aktionsauswahl und Gear-Settlement. Bestehende benannte, rotierende Charakter-Testlogs bleiben erhalten. Budgetbedingtes Warten ist von einem Fehler zu unterscheiden; für nicht verwendete Features kann der Lauf keinen Live-Nachweis liefern.

## Aktualisieren und testen

1. Client bzw. alte Browser-CODE-Instanzen beenden, bevor das neue Bundle geladen wird.
2. In der aktuellen Werkstatt dein bestehendes Profil öffnen; die neuen Felder prüfen und `bot.js` exportieren. Browser und Client verwenden dieselbe Datei.
3. Alternativ vorhandenes Profil unverändert aktualisieren: `node scripts/refresh-full.mjs Profil.json Ausgabeordner [Client-CODE-Ordner]`. Der Export erstellt eine datierte Sicherung und ersetzt keine Client-Konfiguration.
4. Im gemeinsamen Betrieb normales Farmen, Materialziel, Merchant-Nachschub, Gearübergabe und einen Neustart beobachten. Ein am Budget oder einer expliziten Keep-Regel wartender Auftrag darf nicht durch Löschen von Wertjournalen „repariert“ werden.
5. Bei einem Fehler die neuesten Logs der beteiligten Charaktere senden. Wichtig sind auch die Zeit vor der Entscheidung und der tatsächlich verwendete Profilstand.
