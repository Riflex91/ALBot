# W10/W13 – bestätigter Loot vs. aktuelle Gear- und Produktionsbedarfe

Stand: 19.10.2026; Weiterentwicklung von PR #185.

Der vorhandene `chest_opened`-Empfang des eigenen Charakters ist **nicht** automatisch ein freigegebenes Item. Nur in demselben Realm, derselben Session und innerhalb des bestehenden 3,5-Sekunden-Bestandsfensters bestätigte physische Eigenzugänge werden als bedarfsfähige **Beobachtung** gespeichert.

## Beleggebundene Bedarfshinweise

`ALBot.status().lootReceipts.purposeHints` verknüpft diese bestätigten Eingänge mit den **jetzt noch tatsächlich physisch getragenen** Varianten. Es werden nur vollständig identische Itemvarianten nach kanonischer `identity()` betrachtet. Die tatsächliche Menge wird nie aus einer bloßen Servernachricht erzeugt; pro Variante wird die beobachtete Eingangsmenge durch den aktuellen Bestand begrenzt. Ein wiederholtes `chest_opened` für dieselbe Truhen-ID kann nicht doppelt verbucht werden.

- `currentUnits`: jetzt tatsächlich vorhandene Anzahl genau dieser Variante.
- `observedUnits`: höchstens so viele Einheiten wie nachweislich aus bestätigten Truhen eingingen **und** jetzt noch vorhanden sind.
- `protectedUnits`: durch bestehende `protectedItem()`-Prüfung physisch geschützte Exemplare.
- `grossReservedUnits`: der Bruttobedarf des vorhandenen `production.reservedQuantity()`; wird nicht noch einmal um bereits vorhandene Itembestände reduziert.
- `uncommittedEstimate`: konservative Obergrenze `max(0, currentUnits - protectedUnits - grossReservedUnits)`. Bei unbekanntem/invalidem Reservierungsbeleg **null**, niemals `0` als vermeintlich bestätigter Überschuss.
- `candidateRecipients`: höchstens vier zurzeit passende **vorhandene** `gear.goals()`-Empfänger; weder alter, abgeschlossener Auftrag noch automatisch erteilte Versandfreigabe.
- `matchesCurrentProductionGoal`: reiner Vergleich des jetzt aktiven Planungsziels mit der beobachteten Variante.

Maximal 16 letzte bestätigte Belege und 16 Varianten, sechs Stunden Gültigkeit. Nach Realm- oder Sessionwechsel werden offene und bestätigte sitzungsgebundene Belege verworfen. Ergebnisse werden nicht zusätzlich in den knappen Heartbeat gepackt; der vorherige maximal zweiteilige physische Loot-Kurzbeleg bleibt unverändert.

**Keine selbstständige Warenzuteilung:** `dispatchAuthorized:false` ist für jeden Eintrag fest. Die bestehenden `sendRule`-, `availableTransfer`-, Gearzusage-, `economy.perform()`- und physischen Reserveprüfungen bleiben die **einzigen** Berechtigungsquellen für reale Transfers. Die neuen Hints dürfen nicht als Auslöser eigener Sendungen, Verkäufe oder Ausrüstungsvorgänge dienen. W10/W13 bleibt bis zur Live-Verifikation und durchgängigen rollengetrennten Allokation nur teilweise abgeschlossen. Der signierte Bootstrap-Release bleibt separat.

**Doppelte Baselines:** Mehrere nahe beieinander beobachtete Truhen können denselben physischen Ausgangssnapshot besitzen. Der erste gültige Bestandszuwachs verbraucht diese Ausgangsbasis; konkurrierende Ereignisse bleiben `server-attributed-unverified`, statt denselben Inventareingang erneut zu zählen. Auch eine wiederholt zugestellte `chest_opened`-ID wird nicht ein zweites Mal gutgeschrieben.
