# Aktuell: fortlaufender Betrieb und Merchant-Planung 0.8.4-full

Auf Benutzerauftrag Runtimefehler/unklare Wertwirkung protokollieren und Scheduler weiterführen; Journale behalten und Wertaktionen sperren. Reentranten Itemtimeout korrigiert, ALFinal-artige Servicebindung/Rückwechselschutz, Auftragsabkühlung und lokale Bündelung integriert. [Befunde, Vergleich und Wiederanlauf](CHANGELOG-0.8.4.md). 173 Prüfungen bestanden; neue Livebestätigung steht aus. Verkaufsgrenze 1.000.000 und Mindestchance 65 % erhalten. Historische Aufforderungen zum automatischen Pausieren bei Runtimefehlern sind durch diesen Auftrag ersetzt; keine Journale blind löschen.

---

# Aktuelle Merchant-Korrekturen 0.8.3-full

Gold-/Item-Aufträge gegen gegenseitige Blockade getrennt; Goldabbruch ohne Dispatch sitzungsgebunden abgleichen. Bei Platzmangel freigegebene Bank-/Verkaufsaufträge vor gewöhnlicher Besorgung auswählen. Upgrade-Scrollvorrat schützen. [Befunde, Einstellungen und alte Empfangssperre](CHANGELOG-0.8.3.md). 168 Prüfungen bestanden; neue Livebestätigung steht aus. Keine Journale automatisch löschen, keine Verkaufslimits oder Mindestchancen verändern.

---

# Aktuelle Livekorrekturen 0.8.2-full

Bewegte Goldempfänger, Neuwahl bei ausschließlich zu starken sichtbaren Farmgegnern und nicht ausführbare Bank-Stapelplanung korrigiert. Wiederholte Berechnungen begrenzt, Ticklaufzeiten im Testbericht ergänzt. [Befunde und Grenzen](CHANGELOG-0.8.2.md). 162 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Persönliche Bank-Teilentnahme auf Benutzerwunsch aktiviert; allgemeine Vorgabe unverändert. Bestehende Journale und Budgets erhalten.

---

# Aktuelle Livekorrektur 0.8.1-full

Goldversand trotz laufender Farmbeute repariert, Town bei laufender Bewegung und geringerem Zeitgewinn, getrennten 250-ms-Übergabetakt eingebunden und Pickup-Pendel während Besorgung begrenzt. [Befunde, Änderungen und Umgang mit alter Goldsperre](CHANGELOG-0.8.1.md). 158 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Vorhandene Wertjournale werden nicht automatisch gelöscht.

---

# Aktueller Integrationsstand 0.8.0-full

Die abgegrenzten F01–F03 und D01–D15 des v3/v4-Audits sind in die bestehende Runtime eingebunden. Die genaue fachliche Umsetzung, Einstellungen und Grenzen stehen in [PARITAET-0.8.0](PARITAET-0.8.0.md). 154 gezielte Prüfungen bestanden unter Windows. Neuer gemeinsamer Live-Nachweis und Linux bleiben ausstehend. Folgende Audit-/Releaseabschnitte sind historische Stände.

---

# Aktueller Integrationsstand: v3/v4-Parität unvollständig

Der erneute Audit gegen die tatsächlichen v3-Installer bis Alpha33 und die v4-Modelle relativiert die bisherige Vollständigkeitsformulierung. Aktuell maßgeblich ist [V3-V4-PARITAET-0.7.0](V3-V4-PARITAET-0.7.0.md): Grundfunktionen vorhanden, 15 konkret abgegrenzte Restbereiche und drei Implementierungsbefunde. Kein neuer Live-Nachweis; Runtime und persönliche Konfiguration bleiben bei diesem Audit unverändert.

# Implementierte Ergänzungen 0.7.0-full

Die im Audit von 0.6.2 benannten Ergänzungen wurden umgesetzt. Die exakte fachliche Zuordnung mit Einschränkungen steht in [AUTONOMIE-0.7.0](AUTONOMIE-0.7.0.md). Die folgenden älteren Abschnitte dokumentieren historische Releases. Neuer gemeinsamer Livetest und Linux bleiben ausstehend; Implementierung ist kein Live-Nachweis.

# Korrektur des Integrationsstands · 8. Oktober 2026

Der erneute Quellvergleich mit v3/v4/v5 zeigt, dass die folgende ältere Matrix vorhandene Grundaktionen teilweise zu weitgehend als vollständige Übernahme einordnet. Maßgeblich für die noch fehlende fachliche Tiefe und Integration ist [FUNKTIONSVERGLEICH-0.6.2.md](FUNKTIONSVERGLEICH-0.6.2.md): 20 konkrete Lücken/eingeschränkte Übernahmen, zusätzlich fünf ausdrücklich getrennte v5-Fachmodellunterschiede. ALBot ist noch keine vollständige Funktionsvereinigung. Diese Prüfung ändert keine Runtime und liefert keinen neuen Live-Nachweis.

# Übernahmematrix · Vollbetrieb 0.6.0-full

Zuordnung der Funktionsmatrix aus BOT-ANALYSE.md zum tatsächlichen Code. „Implementiert“ bezeichnet Code mit gezielten Offlineprüfungen. Live A/B/C gelten nur für ihre dokumentierten Szenarien; C wurde nach 0.3.1 vom Nutzer bestätigt. P3/P4 wurden mit 0.5.0 vervollständigt; neue Ergänzungen noch nicht live bestätigt. Vertrag und gemeinsamer Test: P3-P4.md / P3-P4-LIVE.md. 0.6.0 ergänzt Gesamtintegration, Welt-/Team-/Skillpolitik und Diagnosedateien. Updater entfällt. Neue gemeinsame Livebestätigung bleibt ausstehend.

| Vorgängerfunktion | Modul / Konfiguration | Tatsächlicher Stand |
|---|---|---|
| Start, Pause, STOP, Reload | main, Executor / general | Eine Instanz pro Charakter, Generationen, Cleanup; A/B live |
| Aktionsbesitzer, Sperren, Budget | core/executor, merchant/economy | Wertjournale, Liveguards, persistente Ausgaben-/Verlustgrenzen; A/B live |
| Laufzeiterkennung | runtime/ports / general.environment | Headless-Fähigkeiten, kein DOM-Test; gleiche klassische Datei |
| Teamtransport, Roster, ACK | party/transport, items/logistics / general.transport | IPC/CM, Absender/TTL/Sitzung, Ergebnisabgleich; A/B live |
| Oberfläche, Einstellungen, Export | editor / geliefertes Paket | Dynamisches Schema, kompletter CODE-Export, keine Ausführung importierter Runtime im Editor |
| HP/MP, Potions, Respawn, Recovery | combat/farmer / farming | A/B-Kern; Todgrenzen und Reserveprüfung |
| Attack, Zielwahl, Kiting, Navigation | farmer, movement / farming | Ankunft nach Map/Instanz/Position, ein Bewegungsbesitzer |
| Skill-/Klassenpolitik | combat/skills / skills, party | Kontextgebundene Skill-Allowliste einschließlich Paladin-Schutz, kontrolliertem Burst und Merchant-Produktionsbuffs, Livefähigkeiten/Cooldowns/MP; keine pauschale Freigabe jeder G.skills-ID |
| Heilung, Buffs, Energize, Revive | skills / party | Klassenregeln und explizite Skillregeln; konkrete Klassen noch nicht alle live geprüft |
| AoE, Aggro, fremde Ziele, CC | skills, farmer / party.aoe, farming | Zielmenge/Ownership/Gefahr; keine beliebigen neuen Gegner durch AoE |
| Fokus und Zusammenhalt | farmer, transport / party | Leaderziel und aktuelle Peers, Folgeabstand/Wait |
| Loot, Slots und Reserven | farmer, policy / farming, items | Farmer-Loot; Merchant überspringt Farmer-Loot, Recovery bleibt aktiv |
| Jedes Item, Level, Variante, Rolle | policy, economy / items | Gemeinsame Regelpriorität und drei Aktionsphasen; Schutz vor Verarbeitung/Verkauf |
| Lieferung, Tränke, Materialbedarf | logistics, behavior / items, merchant | Beidseitiger Handshake, reservierter Versand; explizite Level-0-Nachschubanfrage neu in C |
| Goldlogistik | bank, items/gold / merchant.bankGold, collectGold | Bankausgleich und Farmerabholung mit beidseitigem bestätigtem Balanceabgleich, Sitzungsbindung und keiner blinden Wiederholung |
| Mluck und Produktionsbuffs | merchant/controller, services / merchant | Klassen-/Level-/Cooldownprüfung; faire Auswahl/Halte-/Wartezeiten, Economy-tickweiser Logistikvorrang und Werkzeugrückgabe neu 0.5.0; keine erfundene Cancellation gestarteter Serverqueues |
| Bank, Packwahl, Gold | merchant/bank / items.pack, merchant | Ganze passende Stapel; 0.4.0 ergänzt ausdrücklich aktivierbare Teilentnahme via temporärer Entnahme/Split/Rücklagerung, Mengen-/Slot-Checkpoint und Abgleich. Standard aus; noch nicht live bestätigt. |
| Konsolidierung und Erweiterung | bank / consolidate, expandBank, bankBudget | Explizite Budgets und beobachtete Änderung; Kapazitätsprüfung, kompatibles Stapeln, Konsolidierung, explizit erlaubte unreservierte Verkäufe mit persistenter Recovery und budgetierte Erweiterung |
| NPC-Kauf/-Verkauf | economy / buy, sell | Gold-API, Livepreis, Menge/Reserve/Budget; B live |
| Stand, Spielerhandel, Listings, Wishlist | market / items | Explizite Angebote/Slots, Limits, passive Kaufexposition; kein impliziter Handel |
| Marktvergleich | market / priceSource | Median sichtbarer passender Angebote; begrenzte 6-Stunden-Angebotshistorie für Kostenplanung, keine unbegrenzte Archivdatenbank |
| Ponty und Giveaways | market / merchant | C: begrenzter Ponty-Scan, tatsächlicher Servermultiplikator, explizite marketBuy-Regel; Giveaways als Teilnahme |
| Gear/Offlineprofile | production/gear / production, characters.gearRole | Accountweite Gearziele, Rollen-/Klassen-/Slotbewertung, Verbesserungsschwelle, Offlineprofile, Reservierung, automatische Beschaffung und bestätigte Ziellieferung; 0.5.0 noch nicht live bestätigt |
| Upgrade/Compound, Scroll, Offering | production / items, production | Chance-/Kostenabfrage, Identität, Verbrauch, Verlustexposition und geplante Scroll-/Offeringabhängigkeiten; B-Upgrade live, automatische Kette neu 0.5.0 |
| Exchange/Craft | production / items, production | G-Rezepte einschließlich Alias/output.data/Queststation, geschützte Zutaten, Stapelzusammenlegung, Arbeitsplätze, Zielmenge und optionales Exchange-Ziel; neu 0.5.0 |
| Produktionsgraph | production/planner / goals, acquireBy | Bestand→Bankabgleich/NPC/Markt/Farm/Exchange/Craft/Mutation→Lieferung, Helferdependenzen, Preis-/Zeitwahl, Tiefen-/Knotenlimit und bestätigte mengenbezogene Ziellieferungen über Reload |
| Materialien und Dropquellen | production/materials / items.farm | Erlaubte Monster, konservative aktuelle Gruppenrate oder einstellbarer Rückfall, erwartete Ausbeute und Zeitbudget; keine Erfolgsgarantie |
| Fishing/Mining, Werkzeug-Rückwechsel | merchant/services / merchant | C: öffentliche G-Zonen, Ufer-/24px-Prüfung, Offhand vor Doublehand, persistenter Rückwechsel, Schutz/MP/Level/Cooldown |
| Merrit | services / merchant.merrit, stand | Freier öffentlicher Standplatz und Angebot; 0.4.0 ergänzt eigene Shell-Events/neue namensgebundene Receipts, persistierten Cooldown und Listener-Cleanup. Neue Bestätigungspfade noch nicht live nachgewiesen. |
| Saisonaktion | world/strategy / world.anniversary | C: aktive Anniversary, Besuchsberechtigung, Reise und beobachtete Status-/Giftänderung |
| Teamwahl, Catch-up, Rotation | party/account / selection, maxFarmers, characters | C: bekannte Profile, fester Leader, Klassenbedarf/Catch-up, Haltezeit, Stop vor Start, persistente Rückkehr bei Unterbrechung; effektive Gearwerte/Klassensynergie bei adaptiver Auswahl ergänzt; Heuristik, kein globales Optimalitätsversprechen |
| Paladin-Auren | party/aura / party.aura, auraHoldMs | C: Level 60, physischer/magischer Druck, Ressourcen, Haltezeit |
| Boss/Event/Quest und Risiko | world/strategy / world | C: Allowlisten, aktuelle S/G-Daten, Kartenfilter, Schaden-/HP-Heuristik, Monsterhunt; Events ohne konkretes Monster/Reiseziel ausgenommen |
| Realmwechsel, Magiport | party/travel / world | C: expliziter Leaderwechsel mit Team-ACK, erlaubter Realm/Cooldown; Magiport mit auftragsgebundener Zustimmung |
| Dynamische Spawns/Karten/Items/Skills | movement, production, strategy, services / G | Keine gebündelte G-Kopie; kleine bedarfsabhängige Caches, Erneuerung bei G-Austausch/TTL |
| Adaptive Farm-/Markt-/Reisebewertung | strategy / farming.mode, world.learning | C: XP-/Gold-/Risikorang, begrenzte eigene XP-Stichproben; Materialbedarf vor Rang. 0.5.0 ergänzt begrenzte Angebots-/Reise-/Teambeobachtung für Produktionsbeschaffung; Heuristik mit explizitem Rückfall, kein globales Optimalitätsversprechen |
| Versionierter Loader/Updater | geplant / general.autoUpdate | **Auf Nutzerwunsch ausgeschlossen; im Full-Schema nicht vorhanden.** Manueller geprüfter Paketimport und Reload verfügbar |
| Telemetrie, Voll-Logs, FTPS/Archive | ausgeschlossen | Fortlaufende benannte Diagnosedateien für den gemeinsamen Livetest, begrenzter RAM, bestehender Client; keine Telemetrieplattform |
| Eigener Headless-Host/Login/Watchdog | ausgeschlossen | Vorhandener Node.js-Client übernimmt diese Aufgaben |
| Shadow-/Ratifikationsharness | ausgeschlossen | Keine Shadow-Tests; wenige gemeinsame Live-Termine |

Das aktuelle Vollbetriebs-Paket (albot.full/v1) enthält den P3/P4-Vertrag ohne Updater. Dieselbe Werkstatt migriert A/B/C-Profile mit erhaltenen Werten und standardmäßig ausgeschalteter neuer Zielautonomie. Keine zweite Oberfläche.
