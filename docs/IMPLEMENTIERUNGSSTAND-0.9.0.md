# Implementierungsstand 0.9.0-candidate

Basis `d33c1a273f5c357b827f3b7ea8fa78f3e5026c1a`, Branch `codex/autonomous-merchant-20261012`. Dieser Stand implementiert konkrete Merchant-, Item-, Lern- und Cloud-Ergänzungen. **Der gesamte gewünschte autonome Bot ist noch nicht vollständig umgesetzt.** Historische Roadmap-Einträge gelten als Verlauf, nicht als Nachweis dieses Kandidaten. Einrichtung: [EINRICHTUNG-0.9.0.md](EINRICHTUNG-0.9.0.md).

## Implementiert

| Bereich | Verhalten und Code |
|---|---|
| Itemzwecke | `src/items/purposes.mjs`: aktuelle G-Daten für Rezepte mit exaktem Level, Skillverbrauch, Token, Schlüssel, Werkzeuge, Betriebsmittel und unbewertete Spezialeffekte. Unbekannte/funktionell geschützte Items werden automatisch nicht liquidiert. Mehrfach vorkommende Rezeptzutaten werden summiert. |
| Rezeptvorrat | `src/production/intelligence.mjs`: eine begrenzte Rezeptcharge statt pauschaler zehn Items, vorhandene Bankbestände berücksichtigen; genaue Varianten und bestehende Produktionsreserven erhalten. |
| Exchange | `src/production/materials.mjs`: gewichtete Exchange-Lose normieren, einschließlich leerer Lose; Monster-Dropraten bleiben unabhängige Wahrscheinlichkeiten. Planner, Kostenmodell und Ausführung benutzen dieselbe Berechnung. |
| Upgrade/Compound | `helpers.mjs` und `production.mjs`: optional bis zu 24 vorhandene Scroll-/Offering-Kombinationen per Servervorschau vergleichen, Gebühren und Helferkosten berücksichtigen. Keine Simulation als Ersatz für unmittelbar vor Ausführung benötigte Chance. Schutz-, Level-, Budget- und Reservenprüfung bleiben verbindlich. |
| Ultimate-Scroll | Grade 3.6: bestätigter Fehlschlag mit erhaltenem Input und verbrauchtem Scroll ist ein abgeschlossenes Zufallsergebnis. Kein fälschliches offenes Journal nur wegen erhaltenen Gegenstands. |
| Token/Dismantle | `conversions.mjs`: optionale Tokenkäufe für explizite lokale Level-0-Ziele; seltene Token mit eigener Kaufobergrenze. Deterministisches Zerlegen nur bei wirtschaftlichem Überschuss, freien Plätzen und gültigen aktuellen Regeln. Seltene Varianten und Zufalls-Dismantles werden ausgeschlossen. |
| Skillmaterial | `supplies.mjs`: konfigurierte Skills melden wiederkehrenden begrenzten Bedarf; vorhandene Produktionsplanung und quittierte Lieferung übernehmen Beschaffung/Transport. Realm, Klasse, Aktualität und Schutzregeln prüfen. |
| Bank | `bank.mjs`: freie Arbeitsplätze auch unmittelbar vor Ablage prüfen. Reclaim-Verkauf durch exakte Quittung und dauerhaften Abschlussmarker bestätigen; zusätzlicher Farmgold-Eingang blockiert den Abschluss nicht mehr. Gold ist kein Bankplatzverbrauch. |
| Bossprüfung | `risk.mjs`, `strategy.mjs`: explizite Gegnerlisten statt Annahme eines allgemeinen `boss`-Flags; 1-HP-Gegner nach wirksamen Treffern bewerten, Heilung abziehen. Unmodellierte Spezialfähigkeiten und Guard-Phasen verweigern Freigabe. |
| Lokales Lernen | `world/learning.mjs`: maximal 64 Aktionsstatistiken, Fehlerabkühlung 3–60 Sekunden, Speicherung und Kontextwechsel nach G-Version/Realm. Zufällige Upgrade-/Compound-Fehlschläge sind keine Programmfehler. Keine Selbständerung von Code oder Sicherheitsgrenzen. |
| Cloud | `world/cloud.mjs`, `cloud/worker.mjs`: optionales Backup der Lernaggregate, ein zentraler atomarer Budgetzähler, neue Ressourcen und Schlüssel, kein Altimport, keine kostenpflichtige KI-Anbindung. Default aus. |

Neue Optionen sind optionale Ergänzungen zu `albot.full/v1`. Alte Profile werden über die bestehende Migration ergänzt. Die Werkstatt und das klassische gemeinsame Browser-/Headless-Bundle bleiben die einzige Laufzeitarchitektur.

## Upgrade-/Compound-Entscheidung

Ein Item muss gemäß `G.items` die konkrete Aktion unterstützen. Ausrüstungspotenzial, exakte Rezeptverwendung, Varianten, explizite Regeln und Produktionsreservierungen stehen vor Profitoptimierung. Ein Item ohne relevanten Teamnutzen kann als Überschuss wirtschaftlich erhöht werden; ein prinzipiell nicht upgradebares Item erhält kein erfundenes Plus.

Compound erfordert drei gleiche, zulässige Identitäten auf gleichem Level. Bei Helfervergleich gilt der sichere Stopwert aller drei Inputs. Upgrade verwendet einen Input. Erwarteter Nettoerlös ist Erfolgschance × Outputwert, zuzüglich nachgewiesenem Restwert im Fehlschlag, abzüglich Scroll, Offering und Gebühr. Das Ergebnis muss Stopwert plus Mindestmarge übersteigen. Gewöhnliche Fehlschläge zerstören den eingesetzten Wert; Ultimate-Upgrade-Scroll Grade 3.6 erhält den Input. Mindestchance und Verlustbudget gelten zusätzlich und werden niemals durch Lernen erhöht.

Die neue Helferauswahl bewertet konservativ den nächsten Schritt mit NPC-Werten und vorhandenen Helfern. Die bisherige endliche Mehrschrittökonomie bleibt im bisherigen Pfad bestehen. Ein global optimales Mehrstufenmodell mit Marktliquidität und automatischer Helferbeschaffung ist hier **nicht** fertig. Keine Angebote allein aufgrund beliebiger Standpreise als garantiert realisierbaren Gewinn werten.

## Alte Kostenlimits und neue Grenzen

Referenz v3 `src/control/cloud-free-tier-budget.js`: Worker 100.000/Tag kostenlos, internes Ziel 95.000 mit Infrastrukturreserve; `cloudflare-dashboard/src/free-tier-budget.js`: R2 950.000 Class-A, 9.500.000 Class-B pro Monat, 9,5 GB interner Speicherrahmen. `v3/docs/presence-supabase-budget.md`: interner Edge-Function-Rahmen 500.000/Monat, Mindestintervall 60 Sekunden, historisch sieben Tage Retention.

ALBot aktiviert diese alten Pipelines nicht. Es verwendet kein R2 und keine Edge Functions. Maximal 24 zugelassene Cloud-Snapshots/Tag ergeben höchstens 744 Supabase-REST-Upserts und 2.232 B2-Aufrufe in 31 Tagen; zusätzlich begrenzt der 1-MiB-Lebenszeitdeckel das Archiv. Gebührenfreiheit kann Code allein in einem anderweitig genutzten Anbieter-Konto nicht garantieren. Aktueller Free-Tarif, gemeinsame Quoten und Anbieter-Caps sind Voraussetzungen; ohne verifizierten Status bleiben Provider-Schreibvorgänge gesperrt. Alte URLs und Secrets werden nicht migriert.

## Offene Arbeit – für die nächste Implementierung

Diese Punkte sind echte Restarbeit, keine als erledigt markierten Zusagen:

1. **Vollständige Account-Allokation:** `purposes`, `allocation`, `bank`, `intelligence` zusammenführen. Gleichzeitige Gear-, Skill-, Rezept-, Schlüssel- und Marktbedarfe nach Variante/Level und frischer Accountabdeckung begrenzen. Der aktuelle Rezeptfallback deckt eine Charge je Rezeptmaximum ab, keine gleichzeitige Summe aller Ziele. Tests: dieselbe Zutat in zwei aktiven Rezepten, zwei Empfänger mit derselben Gearvariante, veraltete Bankdaten, knappe Plätze. Kein doppeltes Reservieren oder Wegverkaufen benötigter Mengen.
2. **Marktverkaufsplanung:** bestehendes `merchant/market.mjs` um nachgewiesene Absatzraten, Gebühren, Standplatzkosten und Verfallszeiten ergänzen. Explizite List-/Preisregeln erhalten. Preisangebote sind keine abgeschlossenen Verkäufe. Fallback zum NPC erst bei belegtem Überschuss und nach Material-/Gearprüfung.
3. **Mutation über mehrere Schritte:** Servervorschauen nach Input-/Helferdefinition, G-Version, Regeln und Ablaufzeit binden. Dynamische endliche Optimierung über verfügbare Dreiergruppen, bewahrte Inputs und erschöpfbare Ressourcen; nicht die Ein-Schritt-Helferbewertung als globale Optimalität bezeichnen. Gegenbeispiele mit besserem späterem Level und begrenzten Offerings testen.
4. **Bosskatalog und Taktiken:** explizite quellbelegte Profile je Boss, erlaubte Klassen/Rollen, benötigte Skill-Items, Phasen, Positionierung, Adds, Unterbrechungen, HP-/MP-/Heilungsreserve, Kampfzeit und Rückzugsgrund. Über bestehende Encounter-/TeamPlan-/Skill-/Movement-Module ausführen. Erst einfache Profile live bestätigen; unbekannte Mechaniken bleiben gesperrt. Gemessene effektive DPS/HPS statt bloßer Klassenetiketten verwenden. Ein vollständiger Boss-Taktikguide ist noch kein ausführbarer Katalog.
5. **Breiteres Lernen:** Beobachtung → klarer Ergebnisnachweis → kontextgebundene Statistik → begrenzter Vorschlag → deterministische Policyprüfung → kontrollierte Übernahme → Rücknahme bei Verschlechterung. Gegenfaktische Gewinne nicht als Messdaten speichern. Rezepte/G-Version, Team, Ort, Gear und Ressourcenstand als Kontext. Todesfälle, Wegfehler und fehlende Reagenzien getrennt von Zufallsausgängen behandeln. Der aktuelle Adapter lernt ausschließlich Wiederholungsabstände.
6. **KI-Anbindung:** noch kein LLM aktiviert. Falls später gewünscht, nur deklarative Vorschläge mit festem Schema; kein übertragener JavaScript-Code, kein `eval`, keine Cloud-Autorisierung von Wertaktionen. Ohne nachweislich kostenlose Inferenz und zentralen harten Kontingentnachweis ausgeschaltet lassen. Providerbudget erschöpft: lokale Policies weiterführen.
7. **Progression:** bestehendes `get_progression()` unter `world/progression.mjs` bleibt Beratungsquelle mit Validierung und Fallback. Für neue Ziele Itemzwecke, Accountallokation und reale Stärke erneut lokal prüfen. Browser- und Headless-Verfügbarkeit tatsächlich testen; Antworten sind kein Freibrief für Kauf, Bosszugang oder Ausrüstungswechsel.
8. **Cloud-Langzeitbetrieb:** aktuelle Implementierung ist Backup ohne Restore. Automatische accountweite Restquotenprüfung, sichere Retention, kontrollierte Wiederherstellung und eine mit Metadaten vollständige Speicherbilanz fehlen. Keinen 1-MiB-Zähler zurücksetzen, um den Schutz zu umgehen. Neue Ressourcen in bestehenden Konten, keine Altbestände importieren.
9. **Liveabnahme:** Browser und vorhandener Headless-Client mit demselben Export; reale NPC-Quittungen, gewöhnlicher/Ultimate-Fehlschlag, Compound, Token-Shop, Reagenzienbedarf, Bankdruck, Neustart mit Journal und ausgefallene Cloud prüfen. Nicht behobene unbekannte Wertwirkungen weiterhin sperren, keine Journale pauschal löschen.

## Prüfungen

Gezielte Regressionen liegen in `test/autonomous-merchant.test.mjs` und `test/economy.test.mjs`; vorhandene Exchange-Fixtures wurden auf tatsächliche Leerlose korrigiert. Geprüft werden unter anderem realer Executor-Pfad für Helfervergleich, verspätete Token-Guards, Reagenzien-Neustart, exakte Verkaufsquittung, Bankarbeitsplätze und zentrale Budgetzulassung. Providerzugriffe wurden nicht live ausgeführt. Maßgebliche abschließende Testzahl und Bundlegröße stehen am Anfang von `ROADMAP.md`.
