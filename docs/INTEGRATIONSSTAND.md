# Übernahmematrix · Stand Live C

Zuordnung der Funktionsmatrix aus BOT-ANALYSE.md zum tatsächlichen Code. „Implementiert“ bezeichnet Code mit gezielten Offlineprüfungen. Live A/B/C gelten nur für ihre dokumentierten Szenarien; C wurde nach 0.3.1 vom Nutzer bestätigt. Aktuelle Merchant-Ergänzungen 0.4.0 sind noch nicht live bestätigt. Die gesamte Vereinigung bleibt bei den genannten Lücken offen.

| Vorgängerfunktion | Modul / Konfiguration | Tatsächlicher Stand |
|---|---|---|
| Start, Pause, STOP, Reload | main, Executor / general | Eine Instanz pro Charakter, Generationen, Cleanup; A/B live |
| Aktionsbesitzer, Sperren, Budget | core/executor, merchant/economy | Wertjournale, Liveguards, persistente Ausgaben-/Verlustgrenzen; A/B live |
| Laufzeiterkennung | runtime/ports / general.environment | Headless-Fähigkeiten, kein DOM-Test; gleiche klassische Datei |
| Teamtransport, Roster, ACK | party/transport, items/logistics / general.transport | IPC/CM, Absender/TTL/Sitzung, Ergebnisabgleich; A/B live |
| Oberfläche, Einstellungen, Export | editor / geliefertes Paket | Dynamisches Schema, kompletter CODE-Export, keine Ausführung importierter Runtime im Editor |
| HP/MP, Potions, Respawn, Recovery | combat/farmer / farming | A/B-Kern; Todgrenzen und Reserveprüfung |
| Attack, Zielwahl, Kiting, Navigation | farmer, movement / farming | Ankunft nach Map/Instanz/Position, ein Bewegungsbesitzer |
| Skill-/Klassenpolitik | combat/skills / skills, party | 33 erlaubte Skill-IDs, Livefähigkeiten/Cooldowns/MP; keine pauschale Freigabe jeder G.skills-ID |
| Heilung, Buffs, Energize, Revive | skills / party | Klassenregeln und explizite Skillregeln; konkrete Klassen noch nicht alle live geprüft |
| AoE, Aggro, fremde Ziele, CC | skills, farmer / party.aoe, farming | Zielmenge/Ownership/Gefahr; keine beliebigen neuen Gegner durch AoE |
| Fokus und Zusammenhalt | farmer, transport / party | Leaderziel und aktuelle Peers, Folgeabstand/Wait |
| Loot, Slots und Reserven | farmer, policy / farming, items | Farmer-Loot; Merchant überspringt Farmer-Loot, Recovery bleibt aktiv |
| Jedes Item, Level, Variante, Rolle | policy, economy / items | Gemeinsame Regelpriorität und drei Aktionsphasen; Schutz vor Verarbeitung/Verkauf |
| Lieferung, Tränke, Materialbedarf | logistics, behavior / items, merchant | Beidseitiger Handshake, reservierter Versand; explizite Level-0-Nachschubanfrage neu in C |
| Goldlogistik | bank / merchant.bankGold | Goldausgleich bei Bankbesuchen; keine neue Farmer→Merchant-Goldtransfer-Automatik |
| Mluck und Produktionsbuffs | merchant/controller, services / merchant | Klassen-/Level-/Cooldownprüfung; faire Auswahl und Halte-/Wartezeiten neu C |
| Bank, Packwahl, Gold | merchant/bank / items.pack, merchant | Ganze passende Stapel; 0.4.0 ergänzt ausdrücklich aktivierbare Teilentnahme via temporärer Entnahme/Split/Rücklagerung, Mengen-/Slot-Checkpoint und Abgleich. Standard aus; noch nicht live bestätigt. |
| Konsolidierung und Erweiterung | bank / consolidate, expandBank, bankBudget | Explizite Budgets und beobachtete Änderung; noch kein vollständiger Bankkapazitätsoptimierer |
| NPC-Kauf/-Verkauf | economy / buy, sell | Gold-API, Livepreis, Menge/Reserve/Budget; B live |
| Stand, Spielerhandel, Listings, Wishlist | market / items | Explizite Angebote/Slots, Limits, passive Kaufexposition; kein impliziter Handel |
| Marktvergleich | market / priceSource | Median sichtbarer passender Angebote; **Langzeitpreishistorie offen** |
| Ponty und Giveaways | market / merchant | C: begrenzter Ponty-Scan, tatsächlicher Servermultiplikator, explizite marketBuy-Regel; Giveaways als Teilnahme |
| Gear/Offlineprofile | production/gear / production, characters.gearRole | Begrenzte Profilbewertung und Verbesserungsschwelle; **vollständige accountweite Ziel-/Beschaffungsoptimierung offen** |
| Upgrade/Compound, Scroll, Offering | production / items, production | Chanceabfrage, Identität, Verbrauch und Verlustexposition; B-Upgrade live |
| Exchange/Craft | production / items, production | Aktuelle gewöhnliche G-Rezepte, geschützte Zutaten, Zielmenge; freie Rezeptalias-Eingabe fehlt im C-Schema |
| Produktionsgraph | production/planner / goals, acquireBy | Bestand→Bank/NPC/Markt/Farm/Exchange/Craft/Mutation, Tiefen-/Knotenlimit; C merkt bestätigte Ziellieferungen über Reload |
| Materialien und Dropquellen | production/materials / items.farm | Erlaubte Monster und Zeitbudget; keine Erfolgsgarantie aus Dropwahrscheinlichkeiten |
| Fishing/Mining, Werkzeug-Rückwechsel | merchant/services / merchant | C: öffentliche G-Zonen, Ufer-/24px-Prüfung, Offhand vor Doublehand, persistenter Rückwechsel, Schutz/MP/Level/Cooldown |
| Merrit | services / merchant.merrit, stand | Freier öffentlicher Standplatz und Angebot; 0.4.0 ergänzt eigene Shell-Events/neue namensgebundene Receipts, persistierten Cooldown und Listener-Cleanup. Neue Bestätigungspfade noch nicht live nachgewiesen. |
| Saisonaktion | world/strategy / world.anniversary | C: aktive Anniversary, Besuchsberechtigung, Reise und beobachtete Status-/Giftänderung |
| Teamwahl, Catch-up, Rotation | party/account / selection, maxFarmers, characters | C: bekannte Profile, fester Leader, Klassenbedarf/Catch-up, Haltezeit, Stop vor Start, persistente Rückkehr bei Unterbrechung; **keine vollständige Gear-Synergieoptimierung** |
| Paladin-Auren | party/aura / party.aura, auraHoldMs | C: Level 60, physischer/magischer Druck, Ressourcen, Haltezeit |
| Boss/Event/Quest und Risiko | world/strategy / world | C: Allowlisten, aktuelle S/G-Daten, Kartenfilter, Schaden-/HP-Heuristik, Monsterhunt; Events ohne konkretes Monster/Reiseziel ausgenommen |
| Realmwechsel, Magiport | party/travel / world | C: expliziter Leaderwechsel mit Team-ACK, erlaubter Realm/Cooldown; Magiport mit auftragsgebundener Zustimmung |
| Dynamische Spawns/Karten/Items/Skills | movement, production, strategy, services / G | Keine gebündelte G-Kopie; kleine bedarfsabhängige Caches, Erneuerung bei G-Austausch/TTL |
| Adaptive Farm-/Markt-/Reisebewertung | strategy / farming.mode, world.learning | C: XP-/Gold-/Risikorang, begrenzte eigene XP-Stichproben; Materialbedarf vor Rang. **Empirische Markt-/Reise-/Teamoptimierung offen** |
| Versionierter Loader/Updater | geplant / general.autoUpdate | **Offen; aus C-Schema entfernt.** Manueller geprüfter Paketimport und Reload verfügbar |
| Telemetrie, Voll-Logs, FTPS/Archive | ausgeschlossen | Nur begrenztes Testprotokoll und bestehender Client |
| Eigener Headless-Host/Login/Watchdog | ausgeschlossen | Vorhandener Node.js-Client übernimmt diese Aufgaben |
| Shadow-/Ratifikationsharness | ausgeschlossen | Keine Shadow-Tests; wenige gemeinsame Live-Termine |

Die werkstattseitige vollständige Planung (`albot.config/v1`) bleibt größer als der aktuelle C-Vertrag. Eine spätere additive Schemaerweiterung lädt dieselbe Werkstatt; es ist kein zweiter Editor nötig.
