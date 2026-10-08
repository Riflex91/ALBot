> Historischer Auditstand 0.6.2. Die anschließende Umsetzung und ihre Grenzen dokumentiert [AUTONOMIE-0.7.0](AUTONOMIE-0.7.0.md). Dieser Vergleich wird nicht rückwirkend als Livebestätigung geändert.

# Funktionsvergleich ALBot 0.6.2 mit v3/v4/v5

Stand: 8. Oktober 2026. ALBot geprüft auf Commit ab74e9a (0.6.2-full); Vorgänger auf 43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2. Es wurden die lokalen Originalquellen, Komposition/Einstiege und die aufgerufenen Fachmodule verglichen, nicht nur die alte Übernahmematrix. Kein Login, keine Shadow-Tests, keine Bot-Codeänderung bei diesem Audit. Keine Behauptung eines neuen Live-Nachweises. ALFinal ist nicht Gegenstand dieses Folgeauftrags.

## Ergebnis und Bewertungsmaßstab

ALBot vereint viele Grundaktionen, aber noch nicht die vollständige fachliche Tiefe und Integration der Vorgänger. Die bisherige Aussage zur vollständigen Vereinigung war zu weitgehend. Die alte INTEGRATIONSSTAND-Matrix nennt oft das Vorhandensein eines Moduls, ohne seine verbleibenden Verhaltensunterschiede ausreichend auszuweisen. Diese Datei präzisiert den Stand.

Teilweise bedeutet: die Grundaktion ist vorhanden, die beschriebene Vorgängerlogik aber nicht gleichwertig. Fehlt bedeutet: kein entsprechender integrierter Ablauf gefunden; allgemeine Regeln sind kein Ersatz für automatische Planung. Bei v5 wird ein vorhandenes Fachmodell nicht als aktivierter historischer Vollbetrieb gezählt: runtime/produktions-komposition.ts meldet ausdrücklich registrierte inaktive Mutationen und registriert nur Merchant-Basis, Bank, Equipment und Mluck. Shadow-, Evidence- und Freigabedateien gelten nicht als zusätzliche Spielfunktionen. Der Vergleich ist eine Fachprüfung der aufgeführten Bereiche, keine formale Vollständigkeitsgarantie für jede Hilfsfunktion aller historischen Dateien.

## 20 konkrete Lücken oder eingeschränkte Übernahmen

### 01. Automatische Farmziel- und Spawnwahl

**Stand: Teilweise.** v3 bildet Kandidaten aus Spawns mit Reisezeit, Gruppen-/AoE-Eignung und Leistungsdaten. ALBot rankt nur explizite Monsterlisten; farmLocation wählt einen nahen öffentlichen Spawn. Eine offene, sicherheitsgefilterte Kandidatensuche fehlt. Auch v3 LocalFarmPlanner ist zunächst kartenlokal; eine weltweit optimale v3-Auswahl wird damit nicht behauptet.

Original: v3: src/autonomy/local-farm-planner.js; src/planner/farm-planner.js. ALBot: src/world/strategy.mjs; src/core/movement.mjs; src/combat/farmer.mjs.

### 02. Durchgängiges EXP-/Gold-Ranking bis zum Angriff

**Stand: Teilweise.** ALBot berechnet einen groben Rang aus Gegner-HP, eigener Angriffsstärke und EXP/Gold. Die Kampfauswahl bevorzugt anschließend Fokusziel, bisheriges Ziel oder Nähe. Damit kann das Ranking weder den Spawnwechsel noch den tatsächlich angegriffenen Monstertyp durchgängig bestimmen. Reise-, Spawn- und Recoveryzeiten fehlen in dieser Farmrangfolge.

Original: v3: src/autonomy/local-farm-orchestrator.js; src/farmer/target-efficiency.js. ALBot: src/world/strategy.mjs; src/combat/farmer.mjs.

### 03. Spawnmangel, Konkurrenzdruck und empirische Standortwahl

**Stand: Fehlt als entsprechender Ablauf.** v3 erfasst Spawn-Uptime, Zeiten ohne Ziel, verlorene konkurrierende Kills, fremde Spieler, Wartezeit und Standortwerte nach Server/UTC-Stunde. ALBot besitzt begrenzte Kill-/Reisebeobachtung und kurze XP-Stichproben, aber keine solche Standortdruck-Auswertung mit dauerhafter Standortgeschichte.

Original: v3: src/autonomy/adaptive-farm-intelligence.js; src/farmer/farm-area-pressure-hotfix.js. ALBot: src/world/strategy.mjs; src/production/observations.mjs.

### 04. Wechsel nur bei ausreichend besserem Farmplan

**Stand: Fehlt in dieser Form.** v3 prüft eine Mindestverbesserung vor dem Wechsel. ALBot hat TTL, laufende Ziele und temporäre Fehlzielsperren, aber keine EXP-/Gold-bezogene Wechselhysterese gegen die Kosten des Umziehens. Diese vorhandenen Schutzmechanismen sind nicht gleichwertig.

Original: v3: src/autonomy/local-farm-planner.js (materiallyBetter). ALBot: src/world/strategy.mjs.

### 05. AoE-geeignete Farmgebiete und Pullplanung

**Stand: Teilweise.** ALBot kann 3shot/5shot/Cleave/Stomp/Fanofknives unter begrenzter Aggroprüfung verwenden. Gebietswahl nach Spawnclustern, erwarteter Packgröße und tatsächlicher AoE-Kapazität des Teams fehlt. AoE-Ausführung ist daher vorhanden, strategisches AoE-Farmen nur eingeschränkt.

Original: v3: src/autonomy/local-farm-planner.js; src/autonomy/party-skill-engine.js. ALBot: src/combat/skills.mjs; src/world/strategy.mjs.

### 06. Rückzug unter mehreren gleichzeitigen Bedrohungen

**Stand: Teilweise.** v3 berechnet einen gewichteten Fluchtvektor aus mehreren Gegnern und eine geschwindigkeitsabhängige Schrittlänge. ALBot weicht vom nächstgelegenen ausgewählten Gegner um 45 Pixel aus und versucht zwei Seitenschritte. Die neue 0.6.2-Risikoprüfung behebt die Prat-Freigabe, ersetzt aber keine gemeinsame Mehrgegner-Fluchtplanung.

Original: v3: src/farmer/safe-retreat.js; src/farmer/combat-risk.js. ALBot: src/combat/farmer.mjs; src/world/risk.mjs.

### 07. Klassen-Elixiere auswählen, erneuern und beschaffen

**Stand: Fehlt als Automatik.** v3 vergleicht Klassenstatistik, Buffdauer, Preis-/Farmnutzen, vorhandene und aktive Elixiere. Es gibt Lieferanforderungen, Erneuerung, beobachteten Equip-Erfolg und Elixier-Farmziele. ALBot verwendet automatisch HP-/MP-Potions und bietet allgemeine Item-/Equip-Regeln, aber keinen integrierten Klassen-Elixierzyklus. Der Kommentar in materials.mjs belegt nur die Übernahme des Drop-Parsers.

Original: v3: src/party/elixir-policy.js; src/party/controlled-party-logistics.js. ALBot: src/combat/farmer.mjs; src/items/logistics.mjs; src/production/gear.mjs.

### 08. Materialquellen einschließlich Quest-/Eventbedingungen

**Stand: Teilweise.** Direkte Monsterdrops, verschachtelte Droptabellen, Exchange-/Craftketten und Queststationen für Rezepte sind in ALBot vorhanden. Nicht gleichwertig übernommen ist die Auswahl kompletter Beschaffungsquellen mit Quest-/Eventbindung, Aktivitätsnachweis und Eventende als Teil der Materialquellenentscheidung. Allgemeine Events im Weltmodul sind kein Ersatz dafür.

Original: v3: src/party/production-material-acquisition.js; src/party/acquisition-source-evidence.js. ALBot: src/production/materials.mjs; src/production/planner.mjs; src/production/recipes.mjs.

### 09. Unsicherheit der Material-Farmzeit

**Stand: Fehlt; Erwartungswert vorhanden.** v3 modelliert P50/P90, Stichprobenvertrauen und probabilistische Anzahl von Farm-/Exchangeoperationen. ALBot nutzt Menge geteilt durch Killrate mal erwartete Dropmenge. Das ist ein Erwartungswert, kein gleichwertiges Unsicherheits- oder Quantilmodell.

Original: v3: src/party/probabilistic-farm-time.js; src/party/production-material-acquisition.js. ALBot: src/production/materials.mjs; src/production/costs.mjs.

### 10. Gemeinsamer verbindlicher Materialauftrag bis zur Erfüllung

**Stand: Teilweise.** ALBot sendet Materialwünsche im Heartbeat; jeder Farmer prüft seinen lokalen Bestand und nimmt den ersten passenden erlaubten Wunsch. Es fehlen eine auftragsbezogene Mengenverteilung und eine gemeinsame Fortschritts-/Abbruchgeneration über Farmer, Merchant und andere Aktivitäten. Transfers haben bereits ACK und Ergebnisabgleich; das ersetzt nicht den gesamten Produktionsauftrag. Die genannten v5-Dateien sind Vertrags-/Planungsmodelle, kein Nachweis aktiven Gesamtbetriebs.

Original: v3: src/party/production-material-acquisition.js; v5: koordination/production-material-team-coordination.ts, production-material-team-handoff.ts, production-material-team-settlement-recovery.ts. ALBot: src/production/production.mjs; src/party/transport.mjs; src/items/logistics.mjs.

### 11. Materialbedarf gegen Quests, Bosse, Events und EXP abwägen

**Stand: Teilweise / Integrationslücke.** ALBot gibt bestehende Aktivität vor manuellem Farmziel, vor Materialwunsch, vor normalem Ranking zurück. plan prüft erlaubte Events, dann Bosse, dann Monsterhunt. Eine gemeinsame Nutzen-/Dringlichkeitsentscheidung fehlt. Ein Crafting-Auftrag kann so dauerhaft hinter einer anderen Tätigkeit bleiben.

Original: v3: src/farmer/farmer-fsm.js; src/autonomy/local-farm-orchestrator.js. ALBot: src/world/strategy.mjs (plan, targets); src/production/production.mjs.

### 12. Wirtschaftlich sinnvolle Gear-Ziellevel und Itemalternativen

**Stand: Teilweise.** v3 untersucht künftige Levelkurven, kumulative Erfolgswahrscheinlichkeit, Stat-/Überlebensgewinn und risikoangepassten Nutzen. ALBot bewertet aktuelle bzw. ausdrücklich konfigurierte Items und verbessert vorhandene erlaubte Ausrüstung bis autoGearMaxLevel. Eine automatische Wahl zwischen alternativen Itemtypen und wirtschaftlich sinnvollstem Endlevel fehlt.

Original: v3: src/economy/gear-progression.js; src/economy/item-intelligence.js. ALBot: src/production/gear.mjs; src/production/costs.mjs.

### 13. Wirtschaftlichkeit von Upgrade-/Compoundketten

**Stand: Teilweise.** ALBot prüft vor der Mutation tatsächliche Chancen und Verlust-/Goldbudgets. In der Beschaffungs-Kostenschätzung verwendet routeScore dagegen konfigurierte Mindestchancen als chance-Eingabe. Eine vollständig konsistente Kurvenbewertung mit realen Schrittchancen, Wiederbeschaffung und Liquidations-/Alternativnutzen fehlt. Der konkrete Ausführungs-Schutz ist vorhanden.

Original: v3: src/economy/item-economic-evaluator.js; src/economy/gear-progression.js. ALBot: src/production/production.mjs; src/production/costs.mjs.

### 14. Eigenständige ökonomische Item-Disposition

**Stand: Teilweise.** ALBot bietet ausführliche explizite Item-Regeln, Schutz, Reserven und aus Produktionszielen abgeleitete Regeln. Es fehlt die entsprechende eigenständige wirtschaftliche Wahl zwischen behalten, künftig verwenden, verkaufen und verarbeiten auf Basis einer umfassenden Itembewertung. Explizite Nutzerregeln müssten auch bei einer Ergänzung Vorrang behalten.

Original: v3: src/economy/item-economic-evaluator.js; src/economy/item-intelligence.js. ALBot: src/core/policy.mjs; src/merchant/economy.mjs; src/production/gear.mjs.

### 15. Mluck-Service mit gezielter Anreise und Priorisierung

**Stand: Teilweise.** ALBot bufft erreichbare Charaktere, prüft fremde starke Buffs und eine verbleibende Minute. v3 unterscheidet fehlend/auslaufend/unbekannte Laufzeit, sortiert nach Bedarf und Antispam und kann fehlende Reichweite als Servicebedarf melden. Ein eigenständiger Mluck-Anreise-/Erneuerungsauftrag fehlt in ALBot.

Original: v3: src/merchant/merchant-mluck-policy.js; src/merchant/merchant-mluck-service.js. ALBot: src/merchant/controller.mjs (buff).

### 16. Marktgeschichte und belastbare Preisreferenzen

**Stand: Teilweise.** ALBot hält maximal 64 aktuelle Angebotszeilen, überschreibt je Anbieter/Variante Preis und Zeit und nutzt einen Median. Es fehlt die v5-Modellierung getrennter BUY-/SELL-Beobachtungen, Menge, Spread, Mindestbeobachtungen und referenzgebundener Preisgültigkeit. Ein verschwundenes Angebot wird auch in v5 nicht einfach als belegter Verkauf angenommen.

Original: v3: src/reliability/economy-v2-market-history.js; v5: merchant/markt-historie.ts. ALBot: src/merchant/market.mjs.

### 17. Fähigkeitsbasierte Aufgabenverteilung im Team

**Stand: Teilweise.** ALBot hat Klassen-/Gear-/Catch-up-basierte Teamwahl und lokale Skillguards. Es fehlt eine synchronisierte Fähigkeitenwahl für konkrete Heiler-, Aggro-, Schutz-, Schaden- und Unterstützungsaufträge mit ausgewähltem Träger und gemeinsamem Aktionsplan. Automatische Bestimmung eines geeigneten Leaders ist ebenfalls nicht gleichwertig: ALBot bevorzugt den vorgegebenen Leader bzw. Listenfallback.

Original: v4: laufzeit/quelle/spiellogik/capability-gruppenwahl.ts; gruppen-aktionsplanung.ts. ALBot: src/party/account.mjs; src/combat/skills.mjs; src/party/transport.mjs.

### 18. Globale Aktionspriorität über alle Module

**Stand: Teilweise.** v4 ordnet Anfragen nach Notfall, Sicherheit, Normal und Hintergrund, dann Priorität und Alter. ALBot hat Ressourcenlocks, feste Tickreihenfolge, Recovery-Vorrang und Merchant-Fairness. Es fehlt eine gemeinsame priorisierte Anfrageauswahl über Kampf, Welt, Produktion und Merchant. Locks verhindern Parallelkonflikte, garantieren allein aber keine globale Priorität.

Original: v4: laufzeit/quelle/kern/aktions-auswahl.ts. ALBot: src/main.mjs; src/core/executor.mjs; src/core/fair-tasks.mjs; src/merchant/controller.mjs.

### 19. Semantische Inhaltsänderungen und Quarantäne

**Stand: Teilweise.** ALBot prüft G-Austausch/TTL, Aktivitätsende, Kartenfilter und Fehlzielsperren. Es fehlt eine feinere Bindung von Plänen an Definitions-/Quest-/Eventfingerprints und semantische Änderungen einschließlich begründeter Quarantäne und erneuter Freigabe. Eine reine Zeitsperre nach Tod ist keine solche Inhaltsquarantäne.

Original: v3: src/world/content-drift.js; src/content/content-drift-semantic-recovery.js; v5: welt/event-quest-drift.ts, content-quarantaene.ts. ALBot: src/world/strategy.mjs; src/world/risk.mjs.

### 20. Produktionsabsicht über Reload mit gesamtem Auftragszustand

**Stand: Teilweise.** ALBot speichert Wertjournale, Ziel-Liefermengen, Budgets sowie Spezialzustände für Bank/Tools/Rotation. Der Produktionsplan selbst wird aus aktuellem Bestand neu berechnet; Materialauftrag, Quelle, Teilnehmer und Phase bilden kein durchgehendes persistentes Produktionsintent. Allgemeine unbekannte Wertjournale blockieren nach Reload bis zum manuellen Bestandsabgleich; dies ist sicher, aber keine umfassende automatische Recovery.

Original: v3: src/merchant/persistent-production-intent.js; v5: koordination/production-material-lifecycle.ts. ALBot: src/production/production.mjs; src/core/checkpoint.mjs; src/main.mjs.

## Weitere fünf v5-Fachmodelle ohne gleichwertiges ALBot-Gegenstück

Diese Punkte belegen Modell-/Vertragsunterschiede, nicht fünf früher bereits autonome Livefunktionen.

### Accountweite Bankexklusivität

ALBot hat lokale Inventar-/Bankguards und normalerweise einen Merchant. Kein accountweites Lease mit Epoche und fremdem Konfliktnachweis. Relevant bei mehreren Bankakteuren; das alte Verfahren darf wegen asynchronem Clientstorage nicht ungeprüft kopiert werden.

[Originalquelle](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/koordination/account-bank-lease.ts).

### Physische Gear-Allokation

ALBot hat Zielcharakter, Mengenreservierung und bestätigte Lieferung. Kein entsprechendes separates Allokationsledger mit physischer Kandidatenkennung, Empfängersession und Settlement-Fingerprint über den gesamten Gearauftrag.

[Originalquelle](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/merchant/gear-allokation.ts).

### Threat-/CC- und Ownership-Modell

ALBot prüft target, Teamnamen, Aggrozahl, invincible und eigene Skillbedingungen. Kein gleichwertiges Ledger für Gegnerfingerprint, CC/Immunität, Frische und Ownership; aus target allein folgt dort ausdrücklich kein vollständiger Besitznachweis.

[Originalquelle](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/kampf/threat-cc.ts).

### Serverwechsel mit Registry-/Modus-/Fensterprüfung

ALBot hat Allowlist, Cooldown, sichere lokale Zustände und Team-ACK. Kein entsprechendes Zielserver-Online-/Frische-/Modellregister mit PVP/HARDCORE/TEST/DUNGEON und maximalen Hops je Zeitfenster. Automatische profitable Serverwahl wird durch diese v5-Policy selbst nicht implementiert.

[Originalquelle](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/welt/server-hop-policy.ts).

### Eigener Karten-/Türgraph für Strategie

ALBot delegiert den tatsächlichen Weg an smart_move und liest Spawns aus G. Der entsprechende eigene strategische Graph mit Definitionsfingerprint und gerichteten Transportkanten fehlt. Das bedeutet nicht, dass ALBot keine Wegfindung hätte.

[Originalquelle](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/welt/map-graph.ts).

## Bereits vorhanden und daher nicht pauschal fehlend

- Start/Pause/Reload, Browser-/Headless-Erkennung und Browser-performance_trick.
- Kampf, Potions/Recovery/Respawn, Fokusfeuer, Kiting und mehrere Klassen-/Gruppenskills einschließlich Paladin-Auren.
- Itemregeln nach Level/Eigenschaft/Rolle/Charakter, Schutz, Reserven und Regelvorschau.
- Loot-Abholung, Tranknachschub, Empfängerbindung, Goldabholung und ACK-/Effektabgleich.
- Bank ein-/auslagern, Packs, Zusammenlegen, Teilentnahme und budgetierte Kapazitätsarbeiten.
- NPC-Kauf/-Verkauf, Spielerangebote kaufen, eigene Listings/Wishlist, Ponty und Giveaways. Das ist keine vollständige automatische Handelsstrategie.
- Upgrade/Compound mit Scroll/Offering, Craft/Exchange, begrenzte Produktionsketten und bestätigte Ziellieferungen.
- Gear-Bewertung, Offlineprofile, ausdrücklich gesetzte Zielausrüstung und Verbesserung vorhandener erlaubter Ausrüstung.
- Fishing/Mining mit Werkzeugrückwechsel, Merrit, Mluck-Grundbuff und Merchant-Produktionsbuffs.
- Allowlisten-basierte Boss-/Eventplanung, Monsterhunt, Anniversary, Teamrotation/Catch-up, Magiport und angeforderter Realmwechsel.

Das Vorhandensein dieser Aktionen ist kein Nachweis, dass jede Kombination im gemeinsamen Vollbetrieb live bestanden ist.

## Profilbeschränkung zusätzlich zu den Codelücken

Das zuletzt ausgelieferte Profil nutzt farming.mode=balanced und farming.targets=[goo,bee,spider]. Individuelle Farmerlisten sind leer; sie erben diese Liste. production.autonomy ist eingeschaltet, die Beschaffungswege enthalten bank/npc/market/farm/craft/exchange. world.risk=conservative und quests/events/bosses sind aktiv. Das Profil ist daher weder ein reiner EXP-Modus noch eine offene Suche über alle Monster. Mehr Monster manuell einzutragen behebt die fehlende Auswahl-/Koordinationslogik nicht.

## Bewusst ausgeschlossen, keine Integrationslücken

Updater auf ausdrücklichen Nutzerwunsch. Eigener Host/Login/Watchdog und Headless-Infrastruktur liegen beim vorhandenen Client. Telemetrieplattform, vollständiges Archiv-/Logsystem und FTPS werden nicht übernommen; die autorisierten Testdiagnosedateien bleiben. Shadow-/One-shot-/Ratifikationsharness und v5-Champion/Challenger-SHADOW-Promotion werden nicht als Entwicklungsvoraussetzung eingeführt.

## Sinnvolle Reihenfolge zum Schließen der Lücken

1. Ein verbindlicher gemeinsamer Arbeitsauftrag für EXP, Materialien, Quests und Events; Leaderentscheidungen bestimmen Spawn und Kampfziel.
2. Kandidaten-/Spawnplanung mit realer Teamleistung, Reise-/Wartezeit, Konkurrenzdruck, AoE-Eignung und Wechselhysterese.
3. Materialquellen einschließlich Event-/Questbindung, Unsicherheitsmodell und gemeinsamer Mengenfortschritt bis zur Lieferung.
4. Elixierzyklus sowie wirtschaftliche Gear-/Item-/Marktentscheidung; vorhandene Nutzerregeln und Budgets haben Vorrang.
5. Fähigkeitenzuordnung, gemeinsamer Prioritätsentscheid und Wiederanlauf; v5-Frische-/Identitätsprüfungen bedarfsgerecht integrieren.

Die neue 0.6.2-Kampfsicherheit bleibt dabei eine Zulässigkeitsprüfung. Sie ersetzt keinen Nutzenplaner und soll auch keine ungeprüften Ziele freigeben, um eine Implementierungslücke zu verdecken.

## Reproduzierbare Originalfundstellen

- [v3 Farmplanung](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/autonomy/local-farm-planner.js)
- [v3 Standortlernen](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/autonomy/adaptive-farm-intelligence.js)
- [v3 Elixiere](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/party/elixir-policy.js)
- [v3 Elixierlogistik](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/party/controlled-party-logistics.js)
- [v3 Materialquellen](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/party/production-material-acquisition.js)
- [v3 Farmzeitmodell](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/party/probabilistic-farm-time.js)
- [v3 Gearkurven](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/economy/gear-progression.js)
- [v3 Produktionsintent](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v3/src/merchant/persistent-production-intent.js)
- [v4 Fähigkeitenwahl](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v4/laufzeit/quelle/spiellogik/capability-gruppenwahl.ts)
- [v4 Gruppenplan](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v4/laufzeit/quelle/spiellogik/gruppen-aktionsplanung.ts)
- [v4 Aktionspriorität](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v4/laufzeit/quelle/kern/aktions-auswahl.ts)
- [v5 Komposition und inaktive Fähigkeiten](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/runtime/produktions-komposition.ts)
- [v5 Marktmodell](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/merchant/markt-historie.ts)
- [v5 Materialteammodell](https://github.com/Riflex91/Riflex91-Repo/blob/43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2/v5/grundlage/quelle/koordination/production-material-team-coordination.ts)
