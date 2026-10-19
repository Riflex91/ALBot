# W06 – endlich begrenzte Materialbeschaffung aus Live-Marktangeboten

Stand: 18.10.2026, auf Basis von G09 PR #183.

## Vorhandener Vertrag

Die existierende Produktionsplanung kann bereits einen `marketBuy`-Schritt erzeugen, wenn ein Material nicht aus aktuellem Bestand/Bank, einem freigegebenen NPC, einem Rezept oder einer erreichbaren anderen Quelle kommt und `market` in `production.acquireBy` zugelassen ist. Der Merchant kann an aktuell sichtbaren, erreichbaren Händlerständen mit `trade_buy` kaufen. **Das ist kein Beleg für ein irgendwann vorhandenes Angebot.** Der bisherige Marktcheck verifiziert ohnehin Preis, exakten Item-Level/Stat-/Eigenschafts-/Titelvergleich, Stand, Live-`rid`, Limit, Gold und Bestand.

Der Serverhandler `node/server.js` aus `kaansoral/adventureland_mongodb` (festgehaltener Vergleichsstand) zeigt für `trade_buy`: Goldabzug `listing.price*q`, Inventarzuwachs, aber nur `success_response({})` **ohne Empfangsslot**. Die Runtime darf keinen Slotbeleg erfinden.

## Dieses Inkrement

- Vorher fehlte dem Produktions-`marketBuy`-Dispatch die noch benötigte **endliche Menge des konkreten Schritts**. `market.buy` durfte die gesamte Batch-/Zielmenge der Itemregel verwenden und damit mehr Material kaufen als geplant.
- Der Produktionspfad übergibt nun `quantity: step.quantity`. Das live erlaubte Kaufquantum ist das Minimum von vorhandenem Angebot, `r.batch`, `r.targetCount - tatsächlicher Bestand`, `r.maxCount - tatsächlicher Bestand` und dem konkreten Produktionsbedarf.
- Eine eigene `admit()`-Prüfung bindet den Job an **denselben noch aktuellen Produktionsschritt und dasselbe Ziel**, aktive Produktion, erlaubtes `acquireBy:market`, nicht blockiertes Inventar, gültige Regel (einschließlich neu geprüfter Feldsignatur) und verbleibende Aktionsquote. Sie wird vor Planung und nochmals beim eigentlichen Dispatch angewendet; bei Änderung erfolgt kein Kauf.
- Bestehender `economy.perform('market.buy')` bleibt der einzige Wertpfad, mit allen aktuellen Kosten-/Verlust-/Gold-/Journalsperren. Für Produktionsmaterial wird eine bestätigte Kaufwirkung **nur** angenommen, wenn der offizielle Promise-Erfolg vorliegt, der Inventarbestand der spezifischen Variante um **genau die ausgewählte Menge** zunimmt **und** der Goldbestand um exakt `unitPrice * quantity` fällt. Fehlender Servererfolg oder ein abweichender Wertabgleich lässt das Journal offen, ohne Blind-Retry.
- Bereits ausdrücklich konfigurierte eigenständige `marketBuy`-Regeln behalten ihren bestehenden Modus. Das Inkrement autorisiert **keine zusätzlichen Materialien, Preisobergrenzen, Reiche, Charaktere oder Goldrisiken**, sondern begrenzt bereits genehmigte Produktionskäufe.
- Ein aktuell nicht sichtbarer Anbieter bleibt kein bestätigter Kauf: Der vorhandene endliche Reise-/Reprobe-/No-Offer-Mechanismus gilt weiter; das Ergebnis ist ein wartender oder gesperrter Materialbedarf und keine erfundene Ankunfts-/Kaufquittung.

## Noch offen

Volle Materialbeschaffung über direkte ungebundene Warenangebote, Warenlieferungen von anderen Spielern, gesicherte nicht-reproduzierbare Rezeptnebenwege, accountweite Rewardallokation und echte Live-Game-Quittungen bleiben getrennte W06-/W13-Restpunkte. Das Inkrement ist kein signierter Ingame-Release und wurde offline getestet.

## Folgeinkrement vom 19.10.2026 – physische Materialvariante

- Für **endlich gebundene Produktions-Marktaufträge** muss ein sichtbares Verkaufsangebot nun neben Name, Level, Stat, Eigenschaft und Titel auch die gewünschte Accountbindung (`acc`) und die vollständigen Item-Variantendaten (`data`) erfüllen. Als gesperrt markierte Angebote sind keine Belege für beschaffbare Produktionsmaterialien.
- Derselbe Variantenvertrag gilt sowohl bei der Suche nach einem aktuell verfügbaren Verkäufer, bei der Annahme des Marktangebots als auch erneut beim verzögerten Dispatch. Listing-`rid` bleibt eine separate unveränderliche Angebots-ID und wird wie bisher unmittelbar vor dem Serveraufruf geprüft; sie wird nicht mit der Identität der Materialvariante verwechselt.
- **Explizit konfigurierte freie Markt-Buy-Regeln bleiben unverändert**; es werden weder neue Materialarten oder Handelsrechte erteilt noch Preis- und Goldgrenzen gelockert.
- Nicht vorhandene Live-Angebote erzeugen weiterhin weder einen Kauf noch eine automatische Erfolgsquittung. Accountweite Belohnungen, Spieler-Barter und physischer Liveabnahmebedarf bleiben offen.

## Folgeinkrement vom 19.10.2026 – Mengen- und Dispatch-Integrität

Endliche Produktions-Marktkäufe dürfen ungültige Verkäufermengen nicht mehr per `Math.floor` in eine scheinbar gültige Kaufmenge umdeuten. Angebotseinheiten und Goldstückpreis müssen positive sichere Ganzzahlen sein; auch der gesamte Goldbetrag muss eine positive sichere Ganzzahl ergeben. Ungültige Angebote zählen nicht als frische Produktionsangebote, die ein früheres No-Offer-Wartefenster aufheben könnten.

Der geplante **Ausgangsbestand der exakten Variante** muss beim verzögerten `trade_buy`-Dispatch weiterhin unverändert sein. So kann ein parallel eingetroffenes Materialstück nicht dazu führen, dass der ursprünglich eingefrorene Post-Buy-Bestandsbeleg später einem anderen Vorgang zugeschrieben wird. Angebotsmenge und Preis werden am Dispatch erneut auf Ganzzahlintegrität geprüft. Bei Drift: kein Kauf, kein künstlicher Erfolg, vorhandenes Wertjournal unverändert.

Die zusätzlichen Einschränkungen gelten nur für bereits autorisierte **endliche Produktions-Marktkäufe**. Eigenständig explizit konfigurierte Marktregeln werden durch dieses Paket nicht erweitert oder rückwirkend verschärft. Keine Freigabe neuer Materialarten, Quellen, Budgets oder Handelskategorien; signierter Release-Kanal bleibt separat.

## Folgeinkrement vom 19.10.2026 – beste zugelassene Live-Verkaufsofferte

Für **endliche Produktions-Marktkäufe** priorisiert der Merchant unter gleichzeitig sichtbaren und erreichbaren Live-Angeboten dieselbe zulässige Materialvariante nach dem niedrigsten Stückpreis, unabhängig von der Reihenfolge der Spieler-Entities und `trade1..trade16`-Slots. Fremde Varianten, ungültige Stapelmengen, unzulässige Stände, unpassende Realms/Instanzen und fehlende RID gelten nicht als Vergleichskandidaten. Nur ein wirklich zulässiger Kauf kann wie bisher über `economy.perform('market.buy')` laufen.

Die Preisrangfolge erteilt keine Transaktionsberechtigung: Zielmengen, `admit()`, aktuelle Regel-/Preisgrenzen, physische Kapazität, live `rid`, Goldrisiko und erneute Dispatch-Verifikation gelten unverändert. Bei gleicher Preisangabe bleibt die beobachtete stabile Reihenfolge. Eigenständig konfigurierte freie `marketBuy`-Regeln behalten ausdrücklich ihre bestehende Markt-Suchreihenfolge.

Der Schritt fügt weder neue Materialquellen noch eine globale Preissuche hinzu. Er arbeitet nur mit den aktuell tatsächlich sichtbaren lokalen Verkäuferständen. Liveabnahme und neue signierte Runtime-Veröffentlichung bleiben separat.

## Folgeinkrement 19.10.2026 – autorisierter Wiederanlauf statt bloßer Sichtbarkeit

Ein sichtbarer Stand mit korrekter Itemvariante allein darf eine bereits gedrosselte Produktions-Marktsuche nicht wieder und wieder starten. `hasVisibleBuyOffer(..., {strict:true, rule})` prüft für solche Wiederanläufe zusätzlich, ob die **aktuelle** Erwerbsregel weiterhin `marketBuy` erlaubt, aktiviert ist, eine positive endliche Menge innerhalb von `batch`, `targetCount` und `maxCount` offen hat und der beobachtete Angebotspreis die geltende aktuelle Preisobergrenze nicht übersteigt.

Die Produktionswarteschleife liest dafür die aktuelle, weiterhin zulässige Akquisitionsregel neu und respektiert ihre vorhandene Max-Aktionssperre. Überteuerte oder nicht mehr benötigte Sichtangebote bleiben unverbindliche Marktdiagnostik, nicht ein neuer Versuch mit Gold- oder Reiseausgaben. Sobald ein passendes gültiges Angebot erscheint, läuft die bisherige vollständige Wert- und Dispatch-Prüfung erneut. Dies betrifft nur den endlichen Produktions-Wakeup; freie, explizite Marktkäufe behalten ihren bisherigen Sichtbarkeitsmodus. Kein Release, keine neuen Kaufrechte.
