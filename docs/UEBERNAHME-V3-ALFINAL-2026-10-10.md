# KI-Arbeitsübergabe: gezielte Übernahmen aus v3 und ALFinal

Stand 10. Oktober 2026. Nutzerauftrag: die geprüften Übernahmeempfehlungen im Repository so festhalten, dass eine andere KI daran weiterarbeiten kann. Diese Änderung dokumentiert Arbeit; sie implementiert keine Botfunktion und erteilt keinen neuen Auftrag zum Login oder Deployment. Einstieg für die nächste Implementierung: U01 und U02.

## Aufgaben und Status

**Arbeitsbranch (noch nicht in main):** U01 und U02 sind implementiert und gezielt offline geprüft; npm test, npm run build, npm run build:editor sowie Browser-/Headless-Livebestätigung sind noch nicht ausgeführt. U03–U07 sind offen. Die Nummern bezeichnen neue Restbefunde nach 0.8.4, nicht eine Wiedereröffnung sämtlicher alter Paritätsaufgaben. Vor Beginn aktuellen Branch/Commit und zwischenzeitliche Änderungen prüfen; Audit-Commitstände unten sind die Vergleichsbasis.

| ID | Reihenfolge | Aufgabe | Betroffene ALBot-Module | Stand im Arbeitsbranch |
|---|---|---|---|
| U01 | 1 | Gewählte Farmzeitmetrik durchgehend für Filter, Rangfolge, Routenkosten und Ziele verwenden | src/production/materials.mjs, production.mjs, planner.mjs; Aufrufer in src/world/team-plan.mjs prüfen | Implementiert; gezielter Offline-Nachweis, vollständiger Build und Live ausstehend |
| U02 | 1 | Quest-/Event-Exchange an verifizierte Quelle und NPC binden; bei fehlendem Ziel warten | src/production/production.mjs, planner.mjs, materials.mjs; src/merchant/economy.mjs | Implementiert; gezielter Offline-Nachweis, vollständiger Build und Live ausstehend |
| U03 | 2 | Merchant-Speed und Survival-/Rollenbedingungen vor Gear-Score berücksichtigen | src/production/gear.mjs, intelligence.mjs, allocation.mjs | Offen |
| U04 | 2 | Mengenbegrenzte, aktuelle und variantengenaue Kaufgebote in Produktionsökonomie integrieren | src/production/intelligence.mjs; src/merchant/market.mjs, economy.mjs | Offen |
| U05 | 3 | Accountweite konservative Risikoschicht ergänzen, bestehende harte Budgets erhalten | src/party/account.mjs; src/merchant/economy.mjs; src/production/production.mjs, intelligence.mjs | Offen |
| U06 | 3 | Paladin-Aura mit vorausschauender Gefahr-/Überlebensbewertung ergänzen | src/party/aura.mjs; geeignete Risikosignale aus src/combat anbinden | Offen |
| U07 | 2, nach U01/U02 | Offizielles get_progression() als zusätzliche Entscheidungsquelle integrieren | src/runtime/ports.mjs; src/world/strategy.mjs, team-plan.mjs; src/production/intelligence.mjs, production.mjs; src/party/account.mjs | Offen |

Bei neuen Optionen den bestehenden Konfigurations-/Werkstattvertrag erweitern: editor/lib/schema.mjs, editor/lib/contract.mjs und src/config/full.mjs auf die konkrete Änderung prüfen. Keine wirkungslosen Felder oder still geänderten Profilwerte ausliefern. Die Tabelle nennt Einstiegspunkte, keinen Auftrag, jede Datei zu verändern.

## Stand U01/U02 im Arbeitsbranch (10. Oktober 2026)

- **U01 implementiert:** `materialSources` liefert `selectedHours` und sortiert nach der gewählten Mean-/P90-Metrik. `production.routeScore` nutzt denselben Wert für Beschaffungskosten, statt P90 nach dem Filter durch den Mittelwert zu ersetzen. Beobachtetes Testbeispiel: Mean bevorzugt `uncertain`, P90 bevorzugt `steady`.
- **U02 implementiert:** `exchangeSource` verlangt für questgebundene Tauschmaterialien belegbare `G.quests`-Koordinaten oder eine passende NPC-/Map-Zuordnung. Eventquellen brauchen einen eindeutigen Eventschlüssel und aktiven `S`-Status. Planner und Routenbewertung schließen unbestätigte Quellen aus; die Ausführung prüft dieselbe Quellenidentität, NPC-Koordinaten und Eventaktivität erneut vor dem Dispatch. Gewöhnliche Exchanges bleiben erlaubt.
- **Gezielt offline geprüft (ohne Spielkontakt):** 11 direkte Quellmodulprüfungen über den aktuellen Branchcode (Metrik, Route, Quest-/Event-Zuordnung und Ablauf) bestanden; zusätzlicher Aufruf der echten `createProduction.exchange`-Funktion mit kontrolliertem Runtime-Port bestätigte das Abweisen eines nachträglich inaktiven Events oder entfernten NPCs. Syntaxkompilierung der fünf geänderten Module/Tests über V8 bestanden. Vier Regressionstests wurden in `test/parity.test.mjs` ergänzt, aber **nicht** mit `node --test` ausgeführt.
- **Nicht ausgeführt:** `npm test`, `npm run build`, `npm run build:editor`, Größenprüfung des neu gebauten Artefakts, Windows-/Linux- und Browser-/Headless-Livetest. `main` und verteilte Dist-/Persönlich-Artefakte unverändert. Keine Nutzerprofile, Reservierungen, Journale oder Budgets gelöscht oder geändert.
- **Offen:** U03, U04, U05, U06, U07; vor Auslieferung vollständige vorgeschriebene Prüfungen auf dem Branch ausführen.

## Arbeitsregeln und Abschlusskriterien

- Zuerst AGENTS.md, aktuelle README/ROADMAP und die bestehenden Runtime-/Werkstattverträge lesen; für Quellübernahmen die verlinkten Originalfunktionen prüfen. Aktuelle Nutzervorgaben haben Vorrang vor historischen Dokumenten.
- Kleine Policies in bestehende Module integrieren. Ein gemeinsames klassisches Bundle für Browser und Headless, ein Executor, dieselben Reservierungen und Journale. Keine zweite Runtime, keine Host-/Bridge-Übernahme.
- Explizite Regeln, aktive persönliche Profile, Verkaufslimits, Mindestchancen, Reserven und Verlustbudgets erhalten. Unklare Wertaktionen nicht erneut senden; Journale nicht löschen. Neue Risikoschichten dürfen vorhandene Grenzen nicht lockern.
- Nach jeder Aufgabe Status und tatsächliche Nachweise in dieser Tabelle bzw. einer kurzen Ergebnisnotiz und ROADMAP aktualisieren. Implementierung, Offlineprüfung und Livebestätigung getrennt benennen.
- Die Abnahmeszenarien stehen im Audit unten. Gezielte Regressionstests für die geänderten Entscheidungsgrenzen erstellen; vorhandene relevante Tests ausführen. Für Runtime-Auslieferung die vorhandenen Befehle npm test, npm run build und bei Schema-/Paketänderungen npm run build:editor verwenden; npm ci nur wenn Abhängigkeiten benötigt werden. Kein Build nötig für diese reine Dokumentationsänderung.
- Bei Runtime-Auslieferung identisches Browser-/Headless-Artefakt und bestehendes Größenlimit prüfen. Keine automatischen Logins, Shadow-Verfahren oder neue Freigabephasen einführen. Einen nicht ausgeführten Live-/Linux-Lauf ausdrücklich offen lassen.
- Diese sieben Aufgaben ersetzen nicht das größere Autonomieziel. Die Progressionsanbindung ist als U07 konkretisiert. Weitere Accountboni, konkrete Bossmechaniken und saubere Nettofortschrittsmessung bleiben zusätzliche Entwicklungsfelder; nicht als durch den Audit bereits gelöst darstellen.

## U07: get_progression() konkret integrieren — offen

Ziel: Den offiziellen Progression Guide als zusätzliche Quelle für sinnvolle Farm-, Ausrüstungs- und Entwicklungsziele nutzen. Kein zweiter Scheduler und keine automatische Ausführung ungeprüfter Empfehlungen. U07 kann nach den beiden Fehlerkorrekturen U01/U02 zusammen mit der Gear-/Wirtschaftsarbeit erfolgen.

**Belegte API-Basis:** Die offizielle Funktion get_progression(options) liefert Empfehlungen, ohne selbst zu laufen, Geld auszugeben oder anzugreifen. Der Aufruf startet allerdings die Beobachtung nachfolgender Kämpfe; frühere Kämpfe sind unbekannt. Die dokumentierten Beispiele verwenden goal, spendLimit und allowPvp sowie die Rückgaben advice.rows und advice.plans. Zielarten umfassen stat, item, set, farm, encounter, gold, gather und trade. Die Dokumentation nennt reguläres CODE und Mainframe; das allein beweist noch nicht die Funktionsfähigkeit in unserem eigenen jsdom-Headless-Client.

**Implementierungsschritte:**

1. Vorhandensein und tatsächliche Rückgabe über den bestehenden Runtime-Port prüfen. Offizieller Wrapper: zuerst parent.progression_read, sonst ProgressionRuntime.create und runtime.read(options). Im eigenen Headless-Client die benötigten offiziellen Progressionsskripte und deren Initialisierungsreihenfolge prüfen; keinen neuen Host oder nachgebauten Progression-Algorithmus einführen.
2. Früh genug im laufenden Bot initialisieren, damit Kämpfe beobachtet werden. Danach begrenzt und zwischengespeichert auf der langsamen Planungsspur lesen, nicht bei jedem Kampftick. Leere Historie als unbekannt kennzeichnen, nicht als gemessene Leistung. Bei Reload oder Wechsel der Spieldaten keine zusätzlichen unbereinigten Beobachter erzeugen; vorhandenen offiziellen Lifecycle prüfen.
3. Optionen aus expliziten Nutzerzielen und verfügbaren Budgets ableiten. spendLimit ersetzt keine bestehenden Ausgaben-/Verlustgrenzen. Empfehlungen für PvP oder nicht freigegebene Ziele dürfen keine bestehenden Freigaben umgehen; keine neuen PvP-Aktivitäten aktivieren.
4. advice.rows/plans anhand der tatsächlich geladenen Version validieren und nur unterstützte Empfehlungen in bestehende Farm-, Gear- und Produktionsziele übersetzen. Priorität, Quelle und Ablehnungsgrund nachvollziehbar halten. Keine Texte als Code oder beliebige Aktionsbefehle ausführen. Unbekannte Felder/Zielarten nicht erraten.
5. Explizite Itemregeln, Reservierungen, Fähigkeiten, aktuelle Event-/NPC-Daten und Budgets bleiben verbindlich. Vor jeder Aktion gelten weiterhin die bestehenden Live-Guards und der zentrale Executor. U01s gewählte Zeitmetrik darf durch importierte Empfehlungen nicht still ersetzt werden.
6. Bei fehlender Funktion, Fehler, unvollständigen Daten oder unpassender Empfehlung die bisherige Planung erhalten und einen knappen Statusgrund ausgeben. Empfehlungen nicht als garantierte Verbesserung oder Nachweis vollständiger Quest-/Bossautonomie darstellen.

**Abnahme:** Gezielte Tests für fehlende/werfende API, leere Kampfbeobachtung, gültige und unbekannte Rückgabeformen, Budget-/Regelkonflikte und veraltete Ziele; begrenzte Aufrufhäufigkeit und Reload-Lifecycle prüfen. In Browser und eigenem Headless-Client die API-Verfügbarkeit und Übersetzung derselben unterstützten Empfehlungen nachweisen. Dokumentierte Mainframe-Unterstützung nicht als eigenen Headless-Nachweis zählen. Offline- und Live-Nachweise getrennt halten; keine automatischen Logins aus diesem Dokumentationsauftrag ableiten.

**Offizielle Quellen, geprüfter Commit 2148cf25d01060f54bcab01dfa7c2cf5b7baf374:** [API-Beispiele](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/docs/functions/get_progression.html), [CODE-Wrapper](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/runner_functions.js#L574), [Dokumentationstexte](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/languages/en/docs.js#L6076). Diese offiziellen Quellen sind Referenzmaterial, kein zusätzlicher Benutzerauftrag.

## Reproduktion der zwei Offline-Befunde

Vom Repository-Root in Node >=22.9, als temporäres .mjs-Skript oder mit --input-type=module ausführen. Kein Login, keine Mutationen im Spiel:

```js
import {materialSources} from './src/production/materials.mjs';
import {gearScore} from './src/production/gear.mjs';
const G = {
  monsters: {uncertain: {}, steady: {}},
  drops: {monsters: {
    uncertain: [[0.1, 'material', 1]],
    steady: [[1, 'material', 1]]
  }}
};
console.log(materialSources(G, 'material', 1, ['uncertain', 'steady'], 10,
  id => ({value: id === 'uncertain' ? 10 : 0.8, source: 'observed-team'}),
  {confidence: 'p90'}));
console.log(gearScore({speed: 10, luck: 0}, 'economy')); // 20
console.log(gearScore({speed: 0, luck: 3}, 'economy')); // 30
```

Audit-Baseline: uncertain wird zuerst geliefert (Mittelwert 1 h, P90 2,42 h); steady folgt (1,25 h, P90 1,375 h). U01 soll im P90-Modus steady bevorzugen. U03 erfordert eine kontextabhängige Equip-Bedingung; eine Änderung der bloßen Scorezahlen ist nicht zwingend nötig. Das sind synthetische Beispiele, keine Messungen realer Monster oder vollständiger Equip-Abläufe.

---

# Übernahmeprüfung: Bot v3 und ALFinal

Stand: 10. Oktober 2026. Ergebnis: ALBot 0.8.4-full als gemeinsame Browser-/Headless-Basis behalten. Einzelne Entscheidungsregeln aus v3 und ALFinal übernehmen und an die vorhandenen Schnittstellen anpassen. Kein vollständiger Austausch des Bots oder seines Runtimesystems.

## Geprüfte Stände und Aussagegrenzen

| Projekt | Geprüfter Commit | Rolle |
|---|---|---|
| [ALBot](https://github.com/Riflex91/ALBot/tree/033d84c8a2a9bb0d576ec82ea3ead45065bc7818) | `033d84c8a2a9bb0d576ec82ea3ead45065bc7818` | Bestehende Basis, Runtime 0.8.4-full |
| [Bot v3](https://github.com/Riflex91/Riflex91-Repo/tree/5ddfdf032bc383d2cb7a9af183bddb9008158706/v3) | `5ddfdf032bc383d2cb7a9af183bddb9008158706` | Materialbeschaffung und risikobasierte Partylogik |
| [ALFinal](https://github.com/Riflex91/ALFinal/tree/8742d05b4501ef6a3720d6ba33041b70699712a3) | `8742d05b4501ef6a3720d6ba33041b70699712a3` | Runtime/Manifest 0.26.94-h26; Gear- und Wirtschaftslogik |

Der installierte Headless-Bot enthält die geprüfte ALBot-Runtime. Vergleich von Quellcode, vorhandenen Tests, Build-/Versionsangaben und bisherigen Paritätsunterlagen. Offene Pull Requests sind keine nachgewiesen integrierten Funktionen. Zwei isolierte Offline-Beispiele wurden gegen unveränderte ALBot-Funktionen ausgeführt. Keine Live-Spielaktionen, keine vollständigen Testsuiten und keine Produktionsänderungen. Die Prüfung belegt konkrete Verhaltensunterschiede; sie beweist noch keine höhere Langzeit-Farmleistung.

## Was wir übernehmen sollten

### 1. v3: P90 für die tatsächliche Quellenauswahl — zuerst

ALBot berechnet Mittelwert, P50 und P90. Die Einstellung `farmConfidence: p90` beeinflusst die Zulässigkeit einer Quelle, die abschließende Sortierung verwendet aber weiterhin `estimatedHours`. Auch der Farmzeit-Callback der Produktionsplanung reicht den Mittelwert weiter. Die ausgewählte Quelle muss deshalb nicht die nach P90 günstigste sein.

Offline-Beispiel: Ein Material, zwei synthetische Quellen, beide innerhalb des Zeitbudgets. ALBot sortiert Quelle A mit Mittelwert 1 h / P90 2,42 h vor Quelle B mit Mittelwert 1,25 h / P90 1,375 h, obwohl P90 gewählt wurde. Das sind Modellwerte, keine im Spiel gemessenen Farmzeiten.

Übernahme: v3s konsequente P90-Rangfolge als Vorlage verwenden. Eine gemeinsame Funktion für die gewählte Zeitmetrik muss Zulässigkeit, Sortierung, Routenkosten und Zielpriorisierung steuern. Mittelwertmodus bleibt explizit möglich. P90 bleibt eine Schätzung, keine Erfolgsgarantie.

Quellen: [ALBot materialSources](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/materials.mjs), [ALBot Produktionsplanung](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/production.mjs), [v3 Materialbeschaffung](https://github.com/Riflex91/Riflex91-Repo/blob/5ddfdf032bc383d2cb7a9af183bddb9008158706/v3/src/party/production-material-acquisition.js).

### 2. v3: Quest-/Event-Tausch mit nachgewiesenem Ziel — zuerst

ALBots Exchange-Ausführung sucht bei Quest-Material nach einem NPC. Findet sie keinen, verwendet sie trotzdem `destination(npc || 'exchange')`. Das kann einen ungeeigneten Arbeitsort auswählen. Der Craft-Pfad lehnt dagegen bereits ein fehlendes Quest-Arbeitsziel ab.

v3 hat ausdrücklich aufgelöste Quest-Ziele, unterscheidet Quest-/Event-Exchange und meldet unter anderem `QUEST_SOURCE_DESTINATION_UNVERIFIED`. Ohne geklärtes Ziel wird keine allgemeine Tauschstelle geraten.

Übernahme: Quellenherkunft und konkretes NPC-Ziel bis zur Ausführung erhalten; fehlendes Quest-Ziel als Wartezustand behandeln. Event-Aktivität und Ablauf unmittelbar vor der Aktion erneut prüfen. Normale Exchange-Materialien dürfen weiterhin den allgemeinen Exchange nutzen. Bereits vorhandene Reservierungen und Transaktionsjournale bleiben maßgeblich.

Quellen: dieselben Produktions- und v3-Materialmodule wie oben.

### 3. ALFinal: Merchant-Geschwindigkeit und Ausrüstungsprofile — danach

ALBots Economy-Gear-Score gewichtet Luck mit 10 und Speed mit 2. Im isolierten Beispiel erreicht +10 Speed einen Score von 20, +3 Luck ohne Speed einen Score von 30. Der reine Score erlaubt somit einen Geschwindigkeitsverlust zugunsten von Luck. Das Beispiel überprüft die Bewertungsfunktion, nicht einen vollständigen Equip-Vorgang.

ALFinal lehnt in `scoreImprovement` Merchant-Speed-Verlust ausdrücklich ab. Außerdem trennt es Gesamtwert und Überlebensbeitrag und berücksichtigt Rollenprofile stärker.

Übernahme: Geschwindigkeitsuntergrenze für den mobilen Versorgungs-Merchant; konfigurierbare Ausnahmen für bewusst stationäre Handels-/Luck-Profile. Klassen-, Rollen- und Überlebensbedingungen vor dem Gesamt-Score prüfen. Werte aus der aktuellen Spiel-API nutzen, keine fremden statischen Stat-Formeln blind übernehmen. ALFinals pauschales Speed-Verbot ist eine gute Vorlage, aber nicht automatisch für jeden Merchant-Modus optimal.

Quellen: [ALBot Gear](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/gear.mjs), [ALFinal Gear-Planung](https://github.com/Riflex91/ALFinal/blob/8742d05b4501ef6a3720d6ba33041b70699712a3/src/gear-progression.js).

### 4. ALFinal: Marktgebote in die Produktionsökonomie einbeziehen

ALBot kann bereits an Käufer verkaufen und Gebote vor dem Handel prüfen. Seine automatische Upgrade-/Compound-Wirtschaftlichkeitsbewertung verwendet jedoch `economy.value`, das `item_value` aufruft; Marktnachfrage fließt dort nicht ein. Verkaufspreisangebote werden andernorts als Beschaffungsschätzung verwendet. Das ist kein Nachweis, dass ALBot bereits Angebote als garantierten Verkaufserlös missbraucht.

ALFinals `_saleValue` bewertet nur die durch ein Kaufgebot abgedeckte Stückzahl zum Gebotspreis und den Rest zum NPC-Wert. Dieses Mengenprinzip lohnt sich.

Übernahme mit Nachbesserungen: exakte Item-Variante, Aktualität, tatsächlich erreichbarer Käufer, Menge, Wege-/Zeitkosten und erneute Prüfung beim Verkauf. Die betrachtete ALFinal-Funktion fragt Gebote nach Name und Level ab; deshalb keine ungeprüfte Kopie für Varianten. Ein heute sichtbares Gebot garantiert keinen Käufer nach Abschluss einer Produktionskette. Für längere Ketten konservative Preisabschläge oder NPC-Basisszenario vorsehen.

Quellen: [ALBot Intelligence](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/intelligence.mjs), [ALBot Economy](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/merchant/economy.mjs), ALFinal Gear-Planung oben.

### 5. ALFinal: Vermögensabhängige Risikosteuerung — gezielt ergänzen

ALFinal kennt konservativen/normalen Modus mit getrennten Eintritts-/Austrittsschwellen. Unbekanntes Vermögen führt zum konservativen Modus. Seltene oder besonders wertvolle Items erhalten zusätzlichen Mutationsschutz.

ALBot besitzt bereits Goldreserven, Verlustbudgets, Zielbudgets, Mindestchancen und dauerhaft verbuchte Risiken. Diese Schutzmechanismen dürfen nicht durch die Übernahme ersetzt oder aufgeweicht werden. Sinnvoll ist eine zusätzliche accountweite Risikoschicht mit frischen Bestandsdaten, ohne Gold bei Transfers doppelt zu zählen. Fremde feste Gold- oder Chancen-Schwellen nicht übernehmen. Seltenheit anhand aktueller Spieldaten und ausdrücklicher Schutzregeln bestimmen; generische Seltenheitslabels allein reichen nicht.

### 6. v3: Vorausschauende Paladin-Aura — bei entsprechendem Team

ALBot berücksichtigt bereits HP, MP, Schadensart und einige Statuseffekte. v3 berücksichtigt zusätzlich unbekannte Begegnungen, hohe Gefahr und geringe Überlebensreserve. Das erlaubt defensive Entscheidungen, bevor HP stark fallen.

Übernahme: zusätzliche Risikosignale in die bestehende Auraentscheidung. Aktuelle Skilldefinitionen und Executor behalten. Eine Haltezeit darf einen dringenden defensiven Wechsel nicht unnötig verhindern; unbekannte Gefahr darf den Paladin nicht dauerhaft ohne Neubewertung festhalten.

Quellen: [v3 Aura-Policy](https://github.com/Riflex91/Riflex91-Repo/blob/5ddfdf032bc383d2cb7a9af183bddb9008158706/v3/src/party/paladin-aura-policy.js), [ALBot Aura](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/party/aura.mjs).

## Was wir nicht erneut importieren sollten

Im bestehenden ALBot sind bereits wesentliche frühere Übernahmen vorhanden: mehrstufige Produktion, Materialplanung und Reservierung, zukünftiger Ausrüstungsbedarf, Empfängerbestätigung, adaptive Kampfsteuerung, lokale Navigation, Merchant-Auftragsbindung, Bankdruckbehandlung, zentraler Executor und Wiederanlaufmechanismen. Einzelne Detailunterschiede rechtfertigen keinen zweiten parallelen Controller.

Die v3-Runtime besteht aus mehreren aufeinander aufbauenden Erweiterungsschichten. ALFinal bringt einen eigenen Host, Scheduler, Storage, ActionBoundary und Bridge-Infrastruktur mit. Vollständiges Importieren würde konkurrierende Zuständigkeiten und Integrationsaufwand erzeugen. Gemeinsame Entscheidungsfunktionen gehören in ALBots bestehende Module; Browser und Headless behalten ihre jeweiligen Adapter. Importiert werden nach Möglichkeit kleine, nachvollziehbare Policies samt passenden Testfällen, keine kompletten Runtimes.

Keines der untersuchten Teilmodule belegt allein, dass sämtliche aktuellen Boss-, Quest- und Eventmechaniken autonom beherrscht werden. Neue Encounter-Module, Fortschrittsauswertung und belastbare Betriebsmetriken bleiben eigene Entwicklungsarbeit.

## Umsetzung und Abnahme

1. P90-Metrik vereinheitlichen und Quest-Exchange ohne verifiziertes Ziel blockieren. Prüfen: widersprüchliche Mittelwert-/P90-Rangfolge, unbekannter Quest-NPC, normales Exchange-Material, zwischen Planung und Aktion ablaufendes Event.
2. Ausrüstungsbedingungen und Marktwertmodell ergänzen. Prüfen: mobiler/stationärer Merchant, Survival-Untergrenze, unterschiedliche Item-Varianten, Teilmengen, veraltetes/verschwundenes Gebot, NPC-Rückfall.
3. Account-Risiko und Aura erweitern. Prüfen: unbekannter Kontostand, Transfer ohne Doppelzählung, Schwellenwechsel ohne Flattern, bestehende harte Budgets, dringender defensiver Aurawechsel.
4. Dieselben Entscheidungsszenarien in Browser- und Headless-Adapter ausführen. Danach begrenzter Live-Lauf mit Messung von Nettovermögenszuwachs, XP, Todesfällen, Versorgungsausfällen, blockierten Aufgaben und Wiederanlauf. Interne Goldtransfers sind kein Gewinn.

Erst Live-Messungen können zeigen, ob die Änderungen den Fortschritt verbessern. Die Quellcodeprüfung reicht dagegen bereits aus, um die beiden ersten konkreten Korrekturen und die gezielten weiteren Übernahmen zu begründen.
