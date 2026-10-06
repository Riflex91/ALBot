# Analyse und Zusammenführung der bisherigen Bots

Stand: 6. Oktober 2026. Untersucht wurden die aktuellen geklonten Default-Branches, ausführbare Einstiegspunkte, Build-Zusammensetzung, zentrale Fachcontroller, ausgewählte Tests und vorhandene Live-Nachweise. Die Bots wurden dabei nicht auf einem Spielaccount ausgeführt. Aussagen über vorhandenen Code sind von Aussagen über nachgewiesenen Livebetrieb getrennt.

## 1. Unveränderliche Quellen

| Quelle | Analysierter Stand | Einstieg |
|---|---|---|
| ALFinal | `cc788f8b3b555013ddcbed3f8adb224ab9b5a3fe` | [src/runtime.js](https://github.com/Riflex91/ALFinal/blob/cc788f8b3b555013ddcbed3f8adb224ab9b5a3fe/src/runtime.js), [src/entry.js](https://github.com/Riflex91/ALFinal/blob/cc788f8b3b555013ddcbed3f8adb224ab9b5a3fe/src/entry.js), [Build](https://github.com/Riflex91/ALFinal/blob/cc788f8b3b555013ddcbed3f8adb224ab9b5a3fe/scripts/build.mjs) |
| v3 | `43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2`, Verzeichnis `v3` | [Runtime-Komposition](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/composition/runtime-composition.js) |
| v4 | derselbe Repo-Commit, Verzeichnis `v4` | [Produktiver Einstieg](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v4/laufzeit/quelle/ausfuehrung/adventure-land-produktions-einstieg.ts), [Build](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v4/werkzeuge/produktions-runtime-bauen.mjs) |
| v5 | derselbe Repo-Commit, Verzeichnis `v5` | [Runtime](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/runtime/produktions-runtime.ts), [Kompositionskatalog](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/runtime/produktions-komposition.ts) |

Offene PRs wurden zusätzlich abgefragt. Sie zählen nicht automatisch zum analysierten Default-Branch. Relevant sind beispielsweise ALFinal #100 (Runtime-Besitz), #73 (Update-Erkennung) und Riflex91-Repo #941/#936 (v5-Live-Checkpoint), #429 (v4-Nachweis), #348 (v3-Leaderwahl), #211 (Nachrichtenbestätigung). Ihr Status allein beweist weder eine fehlende Funktion noch einen bereits integrierten Fix. Die Quellstände oben bleiben die reproduzierbare Grundlage dieser Roadmap.

## 2. ALFinal: integrierte Controller und Account-Autonomie

### Start und Ablauf

`scripts/build.mjs` verkettet 40 Quelldateien in definierter Reihenfolge zu einem klassischen Browserbundle. `entry.js` ersetzt eine bereits vorhandene Runtime desselben Runners und verwendet eine WeakMap für die Zuordnung auf einem gemeinsamen Parent-Fenster. Dadurch soll der Start eines weiteren Charakters nicht die erste Instanz zerstören. Dieser Mechanismus ist wesentlich und muss beim neuen Hot-Reload erhalten bleiben.

`runtime.js` verdrahtet EventBus, Storage, Logger, STOP-Zustand, Scheduler, Modulregister, GameAdapter und GameActionBoundary. Danach entstehen Bewegung, Klassen-Skills, Ressourcenauffüllung, Kampf, Party, Farming, Inventar, Merchant, Bank, Handel, Gear, Produktion und weitere Controller. Die Verbindung ist realer ausführbarer Code, keine reine Roadmap.

`action-boundary.js` bildet Spielaktionen auf offizielle Funktionen und Aktionsfamilien ab. Controller planen Arbeit, prüfen Zustände und übergeben Aktionen an diese Grenze. Der Full-Autonomy-Controller koordiniert, wer gerade Bewegung, Economy oder Lifecycle besitzen darf. Module besitzen eigene Status- und Pending-Zustände; unbekannte Ergebnisse können die betroffene Autonomie suspendieren.

### Farmer, Klassen und Gruppe

`class-skills.js` trennt direkte Klassenrotationen, Gruppenfähigkeiten und AoE. Beispiele: Warrior Hardshell/Taunt/Warcry; Ranger Huntersmark/Poisonarrow/Supershot; Mage Burst; Priest Curse/Darkblessing; Rogue Pcoat/Mentalburst; Paladin Selfheal/Purify/Smash. Andere Module übernehmen z.B. Heal/Partyheal/Revive, Energize/Reflection, Rspeed, 3shot/5shot, Cleave/Stomp und Cburst.

Wichtig: Die Datei benennt auch ausdrücklich ausgeschlossene Fähigkeiten. Paladin-Auren, situative Bewegungsfähigkeiten und riskante Aggro-/PvP-Fähigkeiten sind nicht gleichbedeutend mit automatisch integrierter Standardrotation. „Alle Klassen unterstützt“ bedeutet nicht „jeder Skill darf jederzeit ausgelöst werden“.

Farming wird durch `farming.js` und `farm-intelligence.js` bewertet, ergänzt durch Kampf-, Bewegungs- und Gruppenwissen. Die H31-Tests behandeln Gruppen-DPS, Tank-Sicherheit, Ein-Schaden-Verhalten und den Ausschluss von Snowman als normales Farmziel. Das sind konkrete Erfahrungen für den neuen Farmplaner.

`account-strategy.js` bewertet Rollen und Aufgaben FARM, QUEST, BOSS, EVENT, SPECIAL, ECONOMY; es berücksichtigt aktive und offline bekannte Profile. `full-autonomy.js` erzwingt im bestehenden Full-Live-Modus drei Farmer plus einen Merchant. Es kennt Haltezeiten und Rotationscooldowns. Im neuen Bot wird dieses Quartett ein Standardprofil; Solo-/kleine Teamprofile werden nicht unnötig an diese feste Struktur gebunden.

### Merchant, Items und Produktion

`inventory.js` kennt explizite Mengen freier Slots und Itemnamensmengen für Keep, Reserve, Sell, Bank und Exchange. Das ist eine brauchbare Basis, aber noch nicht unser gewünschter universeller Editor für Itemvarianten, Level und unterschiedliche Rollenregeln.

`gear-progression.js` geht weiter: Bewertung aktueller und zukünftiger Ausrüstung, Scrollkosten, Marktliquidation, Upgrade-/mehrstufige Compound-Wirtschaftlichkeit, accountweiter Risikomodus und Zielcharakterreservierungen. Die Tests H28 prüfen unter anderem 150M/170M-Hysterese, Mindestchance, besonders wertvolle Items und exakte Lieferempfänger. Diese Werte sind konfigurierbare Ausgangsprofile, keine allgemeine Spielregel.

`merchant-autonomy.js` priorisiert zuerst ausstehende/untergeordnete Arbeit, dann Schutzskills, Merrit, Economy-Buffs und bei erteilter Hintergrundzuständigkeit Giveaways, Ponty, Wishlist und Gathering. Merrit arbeitet mit stationärer Wartephase, geeignetem Standplatz, beobachtetem Empfang und Cooldown. Fishing/Mining berücksichtigen Werkzeuge und Zonen; Ponty verwendet Budget- und Preisvergleich. Eine unbestätigte Aktion wird nicht einfach als Erfolg behandelt.

Bank, Trade, Gear, Upgrade/Compound, Exchange/Craft und Party-Logistik sind eigene Controller. `economy.js` und Full Autonomy führen diese zusammen. `encounters.js` behandelt Boss-/Eventwissen, ausgeschlossene Events, Annäherung, aktuelle Risikowerte und Anniversary-Besuche.

### Grenzen und Übernahme

ALFinal ist der beste integrierte Ausgangspunkt für Spielfunktionen, aber keine unveränderte Drop-in-Basis. `entry.js` montiert UI bereits bei vorhandenem `document.body`; das würde auch in jsdom passieren. Windows-Bridge, Hostzustand, Telemetrie und Live-Test-Orchestrierung sind eng eingebunden und werden durch unsere kleinen Runtime-Ports ersetzt.

Das aktuelle eingecheckte Bundle hat 1.948.865 Byte. Das Release-Manifest verweist dagegen auf den älteren unveränderlichen Commit `b9d33eb86f3137d037af79eb8075a0340929019e` mit 1.907.770 Byte. Branchzustand und veröffentlichter Stand sind also verschieden. Der kleine Bootstrap lädt das große Bundle extern; damit ist keine vollständige Datei unter unserem Slotlimit erreicht.

Quellen für diese Detailbewertung: `src/class-skills.js`, `src/account-strategy.js`, `src/full-autonomy.js`, `src/inventory.js`, `src/gear-progression.js`, `src/merchant-autonomy.js`, `src/encounters.js`; `tests/h28-account-gear-risk-economy.test.mjs`, `tests/h31-ssd-group-farm.test.mjs`, `tests/h33-merchant-autonomy.test.mjs`. Die dortigen Tests wurden gelesen, hier nicht als neuer Live-Nachweis ausgeführt.

## 3. v3: breite Fachlogik mit gewachsenen Runtime-Schichten

### Wie die Version arbeitet

Paketversion `3.0.0-alpha.20.149`. `src/composition/runtime-composition.js` setzt Runtime, Stability und Alpha9 bis Alpha20 einschließlich gehärteter Zwischenstände und Merchant/Farm-Readiness-Erweiterungen zusammen. Methoden der Layer werden auf den zusammengesetzten Prototyp gebunden; spätere gleichnamige Methoden können frühere ersetzen. Die Konstruktion baut Servicegruppen für Spielstabilität, Merchant/Economy/Reise und Farmer/Party auf.

Das erklärt einen wesentlichen Unterschied zu ALFinal: Fachfunktionen sind vorhanden, aber ihr tatsächlich wirksames Verhalten hängt stärker von Kompositionsreihenfolge und Hotfix-Schichten ab. Einzelne alte Basisklassen ungeprüft zu kopieren könnte bereits korrigierte Fehler zurückbringen. Das aktuelle Runtimebundle ist 3.340.785 Byte groß.

### Stärken für die Zusammenführung

- **Produktionsplanung:** `merchant-production-planner.js` arbeitet mit Schritten BANK_RETRIEVE, BANK_STORE, BUY, CRAFT, EXCHANGE, UPGRADE_REQUIRED, COMPOUND_REQUIRED, FARM_REQUIRED. Item+Level, Rezepte, Mengen, Scrollgrade und Inputs werden explizit behandelt. Diese Ketten ergänzen die stärker controllerorientierte ALFinal-Struktur.
- **Materialbeschaffung:** `production-material-acquisition.js` bezieht Drop-/Exchange-/Quest-/Eventquellen und probabilistische Farmzeit ein. Gemessene Killrate muss zum aktuellen Teamfingerprint passen; fremde Teamwerte werden nicht als eigene Leistung ausgegeben. Ohne passenden Nachweis folgt eine konservative Schätzung.
- **Merchant-Besitz:** `merchant-task-coordinator.js` lässt nur einen aktiven Task zu, mit Owner, Schlüssel und Ablaufzeit. Gleicher Owner/Schlüssel verlängert; andere Arbeit wird blockiert. Das verhindert konkurrierende Reisen, braucht im neuen Scheduler aber faire Priorität und Schutz vor Verhungern wichtiger Aufträge.
- **Inventar und Bank:** Inventarledger, wirtschaftliche Itembewertung, Sell-Safety, Gear-Progression, Bankkapazität, Erweiterung, Konsolidierung und Platz-Recovery einschließlich begrenztem Transaktionszustand.
- **Gruppenentwicklung:** Registry, Fähigkeiten, Orchestrator, Übergänge und Lifecycle; Fokusfeuer, Teamzusammenhalt, Ressourcenauffüllung, sichere Reisen und Farmdruck wurden durch zahlreiche spätere Fixes ergänzt.
- **Paladin:** `paladin-aura-policy.js` wählt Bulwark, Sanctuary, Zeal oder Warding nach Schadenstyp/Risiko/Ressourcendruck und hält Änderungen mit Hysterese zurück. Level/Unlock werden vorher geprüft. Das ist eine konkrete Ergänzung zu ALFinals ausgeschlossener Aura-Automatik.
- **Transport:** `account-character-transport.js` kennt aktive Charakterzustände, vertrauenswürdige Namen, direkte Übermittlung und CM-Fallback. Sender-/Empfänger- und ACK-Erfahrungen sind wertvoll; Browserfensterzugriff wird im neuen Headless-Pfad durch IPC ersetzt.

### Was nicht mitkommt

Keine komplette Alpha-Komposition, keine parallelen Hotfix-Basisklassen und keine separaten Browser-/CDP-/Windows-Hostdienste. Telemetrie, Diagnosearchive, FTPS und Hostzertifizierung gehören zum ausgeschlossenen Betriebsumfang. Fachlicher Wiederanlauf, STOP, Limitierung und offener Auftragszustand bleiben erhalten.

Konkrete Quellen: `v3/src/merchant/merchant-production-planner.js`, `merchant-task-coordinator.js`, `merchant-service-planner.js`; `v3/src/party/production-material-acquisition.js`, `paladin-aura-policy.js`, `account-character-transport.js`; `v3/src/economy/inventory-ledger.js`, `gear-progression.js`, `transaction-engine.js`, `controlled-bank-consolidation-executor.js`. Alle Pfade beziehen sich auf den oben fixierten Repo-Commit.

## 4. v4: explizite Planung, Prioritäten und kleine Ausführungsgrenzen

### Ablauf und Modelle

TypeScript-Quellen unter `laufzeit/quelle`. Der Build kompiliert temporär zu CommonJS, löst lokale Abhängigkeiten und baut eine Browserruntime. Externe Runtime-Imports sind nicht erlaubt. Der produktive Einstieg veröffentlicht `V4ProduktionsLaufzeit`, Version 1.1.5, mit kontrolliertem Start/Pause/Fortsetzen und Lebensnachweis-Timer von zwei Sekunden. Der bestehende Start versucht `performance_trick`; das darf nicht in unseren Headless-Pfad übernommen werden.

Der Spielzustand unterscheidet bekannte und unbekannte Werte. Planer produzieren Anfragen; Ausführungsadapter führen konkrete Spielaktionen aus. `kern/aktions-auswahl.ts` sortiert zunächst Notfall > Sicherheit > Normal > Hintergrund, dann explizite Priorität, Anfragezeit und stabile Kennung. Abgelaufene Anfragen fallen heraus. `laufzeit-steuerung.ts` erhöht eine Generation bei Pause/Fortsetzen.

`grundlegendes-farmen.ts` verlangt erlaubte Monsterarten und verwendet HP-/MP-Schwellen, Reichweitenpuffer, freie Slots und Fortschrittsprüfung. Der sichere Farmplaner ergänzt frische Angriffsbereitschaft und unterscheidet normalen Cooldown von fehlendem/ungültigem Wissen. Gruppenmodule behandeln Lebensnachweise, Capability-Sync, gemeinsame Ziele und passende Rollen.

### Reife richtig einordnen

v4 ist mehr als Dokumentation: konkrete Spieladapter und ein produktiver Einstieg existieren. Gleichzeitig ist z.B. die öffentliche API des Block8.6-Candidates ausdrücklich ohne eigene Spiel-/Neustartautorität; eine Komponentenregistrierung ist keine pauschale Gesamtfreigabe.

`dokumentation/BLOCK-8-6-9-LIVE-FREIGABE-NACHWEIS.json` dokumentiert einen bestandenen begrenzten Gruppen-/Capability-Lauf zweier Ranger gegen einen bestimmten älteren Releasecommit. Das ist nützliche Erfahrung für diesen Pfad, kein Beleg für vollständige Merchant- oder Produktionsparität und kein Test des neuen Bots.

Übernehmen: kleine reine Zustands-/Priorisierungsfunktionen, Cooldown-/Frischeunterscheidung, Generationen, Gruppenfähigkeiten. Nicht übernehmen: komplette Shadow-Ausführung, vielschichtige Freigabe-/Nachweisstrukturen und jede einzelne Typumhüllung in jedem schnellen Tick. Große vollständige Zustandskopien im neuen ressourcenarmen Bot vermeiden.

Quellen: `v4/laufzeit/quelle/kern/aktions-auswahl.ts`, `laufzeit-steuerung.ts`; `spiellogik/grundlegendes-farmen.ts`, `sicheres-farmen.ts`, `gruppen-koordination.ts`, `skill-policy.ts`; `ausfuehrung/adventure-land-produktions-einstieg.ts`, `adventure-land-block8-6-candidate-einstieg.ts`.

## 5. v5: präzise fachliche Verträge, aber kein einfacher fertiger Komplettbot

### Dokumentationsdrift

Die README beginnt mit „Noch kein V5-Gameplay-Runtime-Code“. Das beschreibt den aktuellen Codebestand nicht mehr vollständig: Unter `grundlage/quelle` liegen Runtime, Ausführungskernel, Merchant, Banktransaktionen, Equipment, Farmer-FSM, Gruppe, Kampf, Navigation, Produktion, Welt und Lernen. Die ursprüngliche Planungsbeschreibung darf daher nicht als Istzustand verwendet werden.

Umgekehrt bedeutet die große Zahl von Dateien nicht, dass ein autonomer Komplettbot ohne weitere Aktivierung läuft. Der kanonische Kompositionskatalog registriert Merchant-Basis, Bank, Equipment und Mluck. Er benennt registrierte inaktive Mutationsfähigkeiten. Weitere Planer, Einzelaktionen und Stufengates sind getrennt. `pr21-28-feature-gates.ts` meldet selbst bei Bewertung ausdrücklich `authorityIssued: false` und `normalRuntimeAllowed: false`. Hier muss man Planung, Ausführungsfähigkeit und aktivierten Gesamtbetrieb unterscheiden.

### Arbeitsweise und wertvolle Bestandteile

1. **Identität vor Aktion:** physische Itemidentität enthält Charakter, Inventarindex, Name, Level, Menge, Beobachtungsfingerprint und Zeitpunkt. Ein Slot allein ist keine sichere Itemidentität.
2. **Disposition und Reservierung:** das Dispositionsledger weist Behalten, Bank, NPC-/Marktverkauf, Upgrade, Compound, Lieferung, Verbrauch oder Quarantäne zu. Reservierung prüft Zweck und Menge; begrenzte Eintragszahlen vermeiden unbegrenztes Wachstum.
3. **Merchant-Aufträge:** Demand-Inbox → Workflowanbieter → Scheduler. Wechsel haben Mindesthaltedauer, Cooldown und begrenzte Historie; Starvation wird berücksichtigt. Der Koordinator selbst führt keine Gameplaymutation aus.
4. **Ausführung und Ergebnis:** spezifische Bank-/Equipment-/Markt-/Transfer-Verträge prüfen aktuellen Zustand, Budget und Ergebnis. Ein gesendeter Auftrag und ein bestätigter Effekt sind unterschiedliche Zustände.
5. **Bankbesitz:** Account-Bank-Lease enthält Owner, Workflow, Epoche, Region/Server und Zustand, ergänzt durch extern beobachteten Konflikt. Die fachliche Exklusivität ist nützlich; unser asynchroner Storage kann dieses Verfahren nicht unverändert als atomare Sperre realisieren.
6. **Reise:** `reise-arrival.ts` trennt Rückgabe der Bewegungsfunktion von echter Ankunft. Karte, Instanz, Region/Server, Position, Bewegung und Frische müssen passen. Eine gelöste Promise genügt nicht.
7. **Farmer/Kampf:** FSM mit IDLE, Zielsuche, Reise, Kampf, Loot, Recovery, Tot und Blocked; daneben Target-Ownership, Threat/CC, AoE-Safety, Skillfähigkeiten und Lifecycle. Das sind wiederverwendbare Modelle, nicht automatisch ein eingeschalteter Farmer.
8. **Upgrade/Compound:** Kandidaten binden physische Inputs, Scroll/Offering, Gold-/Wertgrenzen, Arbeitsplatz, Queue und erlaubten Verlust. Preview ist Planung, kein Beweis einer erfolgten Mutation.
9. **Welt und Lernen:** Karten-/Spawnwissen, Event-/Questdrift, Serverhop und Inhaltsquarantäne; Ranking lässt nur begrenzte Scoreänderungen zu und behält einen deterministischen Fallback. Ein Lernvorschlag erhält keine zusätzliche Aktionsbefugnis.

### Was davon in ALBot gehört

Die fachlichen Prüfungen werden zu kompakten gemeinsamen Diensten. Die vielen Shadow-, One-shot-, Ratifikations-, Evidence- und Gate-Apply-Dateien bilden keinen neuen Entwicklungsfahrplan. Ihre nützlichen Vorbedingungen werden direkt vor der Aktion geprüft; anschließend wird der tatsächliche Effekt abgeglichen.

Vorhandene Live-Evidence bleibt schmal: `roadmap/pr20-2-bank-deposit-production-evidence.json` dokumentiert z.B. genau eine bestätigte Einlagerung von einem Gold auf einem älteren Stand. Daraus folgt nicht, dass der gesamte aktuelle Bank-/Produktionsgraph live abgeschlossen ist.

Quellen: `v5/grundlage/quelle/merchant/gegenstands-identitaet.ts`, `disposition.ts`, `task-koordinator.ts`, `item-mutations-planer.ts`; `koordination/account-bank-lease.ts`; `navigation/reise-arrival.ts`; `farmer/farmer-fsm.ts`; `lernen/deterministischer-fallback.ts`; `runtime/produktions-komposition.ts`, `pr21-28-feature-gates.ts`.

## 6. Funktionsunion und konkrete Zielzuordnung

„Übernehmen“ bedeutet Verhalten/Algorithmus übernehmen und an den gemeinsamen Vertrag anpassen. Ein vorhandenes Modell oder eine historische Liveprobe wird nicht mit aktivem Vollbetrieb gleichgesetzt. F = ALFinal; 3/4/5 = jeweilige Vorgängerversion.

| Funktion | Führende Quelle / Ergänzung | Ziel und Etappe |
|---|---|---|
| Start, Pause, STOP, Hot-Reload | F entry/runtime/scheduler; 4 Generationen | Ein instanzlokaler Kern, P1 |
| Aktionspriorität, Besitzer, Budgets | F ActionBoundary; 4 AktionsAuswahl; 5 Ressourcen/Socketbudget | Gemeinsame Ausführung, P1 |
| Browser-/Headless-Auswahl | Neuer Clientvertrag, alte Adapter nur als Erfahrung | Runtime-Ports, P1 |
| Teamnachrichten, Roster, Heartbeats, ACK | 3 AccountCharacterTransport; F CrossWindow; 5 Nachrichten | Ein Protokoll über IPC/CM, P1–P2 |
| Lokale Einstellungen/Import/Export | F UI; 4 Bedien-/Auftragsmodelle | Editor und ein Regelschema, P1/P3 |
| HP/MP, Potions, Recovery, Respawn | F ResourceTopoff/Lifecycle; 3 Farmer-Recovery | Farmer-Kern, P2 |
| Attack, Zielwahl, Kiting, Wegfindung | F Combat/Movement/Farming; 3 Navigationfixes | Bewegung mit einem Owner, P2 |
| Ankunft und Bewegungsfrische | 5 ReiseLedger/MotionFreshness | Tatsächliche Position prüfen, P2 |
| Klassen-Skills und Cooldowns | F ClassSkills; 4 SkillPolicy; 3 Skillwissen | Datengetriebene Skillpolitik, P2 |
| Heilen, Energize, Buffs, Wiederbeleben | F Party/ClassSkills | Gruppenunterstützung, P2 |
| AoE, Aggro, Target-Ownership, CC | F AoE/FarmIntelligence; 5 Kampfmodelle | Aktuelle Umgebung berücksichtigen, P2 |
| Fokusfeuer, Teamzusammenhalt | 3 Party-Fixes; F Party | Gemeinsamer Leader und Zielgeneration, P2 |
| Loot, freie Slots, Farmer-Reserve | F Inventory; 3 ControlledFarmerLoot | Gemeinsame Item-Regeln, P2/P3 |
| Regeln pro Item/Level/Eigenschaft/Rolle | F Regeln + 5 Disposition/Identität | Vollständiger neuer Regelkern, P3 |
| Lieferungen, Potions, Gold, Materialbedarf | F PartyLogistics; 3 ServicePlanner; 5 Demand/Supply | Aufträge mit Annahme und Ergebnis, P3 |
| Mluck, Merchant-Buffs | F Merchant/ClassSkills; 3 Mluck; 5 MluckService | Priorisierte Services, P3 |
| Banklager, Gold, Packs | F Bank; 5 Bankverträge | Ein Bankbesitzer, P3 |
| Konsolidierung, Platz-Recovery, Erweiterung | 3 Economy-Bankmodule | Budgetierte Kapazität, P3 |
| NPC-Kauf und -Verkauf | F Trade/Economy; 3 SellSafety | Regeln, Mengen und Preise, P3 |
| Spielerhandel, Stand, Listings, Wishlist | F Trade/MerchantAutonomy; 5 Marktsettlement | Reservierter Bestand und Gold, P3 |
| Marktvergleich/Preisentwicklung | F MarketIntelligence; 5 Markthistorie | Begrenzter fachlicher Cache, P3/P5 |
| Ponty, Giveaways | F MerchantAutonomy | Preislimits / Teilnahme einmalig, P3/P4 |
| Accountweite Gearbewertung/Offlineprofile | F GearProgression/AccountStrategy; 3 Gear | Zielcharakter und Reservierung, P4 |
| Upgrade/Compound/Scrolls/Offerings | F Upgrade/GearEconomics; 5 MutationPlanner | Verlust- und Ressourcenbudget, P4 |
| Exchange/Craft | F ExchangeCraft; 3 Produktionsplaner; 5 Produktionsgraph | Konsistente Zutaten und Aufträge, P4 |
| Mehrstufige Produktionsketten | 3 MerchantProductionPlanner | Begrenzter gerichteter Bedarfsgraph, P4 |
| Materialien farmen, Drop-/Questquellen | 3 ProductionMaterialAcquisition | Bedarf beeinflusst Farmplan, P4 |
| Fishing/Mining/Werkzeugwechsel | F MerchantAutonomy | Sicherer Nebenauftrag, P4 |
| Merrit/Saisonbelohnungen | F MerchantAutonomy/Encounters | Konfigurierbare bestehende Abläufe, P4/P5 |
| Dynamische Gruppenwahl und Catch-up | F AccountStrategy; 3 Orchestrator | Aktivitätsprofile, P5 |
| Charakterrotation/Lifecycle | F FullAutonomy/CrossWindow; 3 Lifecycle | Clientstart nur über verfügbare APIs, P5 |
| Paladin-Auren | 3 PaladinAuraPolicy | Situationswahl und Hysterese, P5 |
| Bosse, Events, Quests, gefährliche Inhalte | F Encounters; 3 Content; 5 Welt | Gemeinsamer Aktivitätsplaner, P5 |
| Realmwechsel und Gruppentransport | 5 ServerHop; F/3 Bewegung/Lifecycle | Einmaliger geplanter Wechsel, P5 |
| Dynamische Spiel-/Karten-/Spawnkenntnis | F Knowledge; 3 World; 5 Welt | Aus `G`/Livezustand, ohne Bridgepflicht, P5 |
| Adaptive Farm-/Markt-/Reisebewertung | 3 Performance/Brain; F FarmIntelligence; 5 Lernen | Kleine interne Kennzahlen, Fallback, P5 |
| Versionierter Loader/Updater | F SafeAutoUpdater; 3 Build/Bootstrap | Optionaler sauberer Bundlewechsel, P5/P6 |
| Telemetrie, Voll-Logs, Archive, FTPS | F/3/4/5 Betriebsinfrastruktur | Ausgeschlossen |
| Eigener Host, Socket, Login, Watchdog | 3/5 Host; F Bridge | Ausgeschlossen, vorhandener Client |
| Shadow-/Freigabe-/Ratifikationsharness | Besonders 4/5 | Ausgeschlossen als Entwicklungsprozess |

## 7. Wichtigste Konflikte, die beim Portieren aufzulösen sind

**Mehrere Eigentümer:** ALFinal besitzt FullAutonomy/Economy-Untercontroller, v3 zusätzliche Koordinatoren und v5 Workflowbesitz. Nur eine gemeinsame Zuständigkeitsentscheidung darf am Ende Bewegung, Bank und Inventar steuern.

**Itemnamen gegen Varianten:** einfache Keep/Sell-Listen reichen nicht für verschiedene Level, gebundene/gesperrte Items und Zielcharaktere. Vorhandene Listen werden in das neue Schema migriert, die Verarbeitung nutzt aktuelle physische Identität.

**Senden gegen Wirkung:** IPC ersetzt CM-Transport, nicht Ergebnisabgleich. `queued`, ACK und Spielwirkung sind drei verschiedene Dinge. Unklarheit darf keine doppelte wertverändernde Aktion auslösen.

**Storage gegen Transaktion:** der Client repliziert `set/get`, ohne atomare Sperren und ohne garantierten Disk-Flush vor einer Aktion. V5-Leases/Journalannahmen sind deshalb nicht unverändert übertragbar. Ein zentraler Merchant, Generationsprüfung und Abgleich nach Neustart reduzieren den Konflikt; unklare Wertaktionen bleiben angehalten.

**Browserstruktur gegen sichtbaren Browser:** jsdom stellt `document` bereit. UI, Performance-Audio und Browserfensterbeziehungen müssen anhand tatsächlicher Fähigkeiten aktiviert werden. Alte direkte Fensterkommunikation ist keine IPC.

**Große Bundles gegen Ein-Datei-Limit:** weder v3 noch ALFinal ungekürzt kopieren. Fachcode extrahieren, doppelte Rahmen entfernen, Editor/Tests/Hostcode auslagern, `G` verwenden und früh UTF-8-Größe messen. Minifizierung allein darf nicht als ungemessene Lösung versprochen werden.

**Frühere Erfahrung gegen neue Integration:** historische Nachweise helfen, API-Fehler nicht erneut zu erforschen. Sie decken die neuen Runtime-Ports und die gemeinsame Auftragskette nicht automatisch ab. Genau deshalb liegen die drei Livepunkte an Runtime/Farm, Merchant/Produktion und Gesamtintegration.

## 8. Ergebnis der Client-Logprüfung

Die gelieferte Ausgabe enthält erfolgreiche Verbindungen und CODE-Starts für alle vier Charaktere. Danach wurden 60 Fehler aus `handle_information` und sieben Texturfehler aus `set_texture` gezählt. Die wiederkehrenden ungefähr 15 Sekunden langen Merchant-Frames passen zur nach einem Zeichenfehler abgebrochenen Draw-Schleife und dem langsamen Ersatzaufruf im Spiel-Heartbeat; sie belegen keine 15 Sekunden lang blockierte Node-Ausführung.

Client 1.2.1 normalisiert den Account-Code-Katalog, unterbindet automatische Cloud-Ersetzung des lokalen CODE, setzt den Runnerstatus vollständig und überspringt kosmetische Sprite-Texturwechsel. Die eigentliche Spielsimulation und Minimap bleiben aktiv. Geprüft: 29 bestehende Clienttests und gezielter Integrationstest mit offiziellen Quellen aus Spielcache 17478 einschließlich Account-Refresh und unbekanntem Skin. Kein Shadow-Test und kein echter Accountlogin durchgeführt.

Die Desktopinstallation wurde mit Backup aktualisiert; persönliche `.env`, `config.json` und CODE-Dateien bleiben erhalten. Der laufende Client muss vom Nutzer neu gestartet werden, um die Änderungen zu laden.
