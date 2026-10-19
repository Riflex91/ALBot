# W10/W13 – disjunkte Itemvarianten in der Produktions-Bedarfsrechnung

Stand: 19.10.2026.

## Reproduzierter Fehler

Die bisherige gemeinsame `purposeReservations()`-Bestandsrechnung führte alle bereits bedienten Ziele in nur einem `used`-Zähler pro **Itemname und Upgradelevel**. Zwei voneinander verschiedene, physisch vorhandene Gearvarianten (zum Beispiel `sword +1 dex` und `sword +1 str`) konkurrierten dadurch irrtümlich um ein einziges gemeinsames Exemplar. Obwohl je eine physische Variante vorhanden war, konnte für die zweite Variante fälschlich ein zusätzlicher Upgrade-/Beschaffungsbedarf der Vorstufe entstehen.

## Implementierung

- Die Gesamtzahl einer Artikel-/Levelgruppe bleibt eine **gemeinsame physische Obergrenze**; auch generische und exakt gebundene Bedarfe zusammen können nicht mehr Exemplare verbuchen, als tatsächlich vorhanden sind.
- Konkrete, kanonisch identifizierte Varianten führen zusätzlich getrennte Bestandsverbrauchszähler. Zwei **verschiedene**, vollständig belegte Itemvarianten dürfen damit aus **ihrem jeweils eigenen** physischen Vorrat bedient werden, ohne unnötigen Folgebedarf auszulösen.
- Ein früheres **generisches** Ziel kann eine beliebige Variante derselben Itemgruppe verbraucht haben. Solange diese konkrete Zuordnung nicht belegbar ist, wird dessen Verbrauch vorsorglich von jeder später nachgefragten exakten Variante abgezogen. Dies kann eine Planung konservativ unterdecken, erzeugt aber keine Doppelzusage.
- Negative, nicht-ganzzahlige, überlaufende oder widersprüchliche `stock()`-Rückgaben führen zu `blocked:true` mit unendlicher Reserve für nachfolgende Entscheidungspfade. Ebenso gesperrt wird eine unsichere Summierung von Bruttobedarf.
- Die Ermittlung verändert **keine** Itemregel, Gear-Kompatibilitätsprüfung, Versandquittung, Bankfreigabe, Verkaufsberechtigung oder das eigentliche Wertjournal. Sie korrigiert nur die Erfassung **vorhandener** physischer Produktionsinputs und damit die Planung unabhängiger Accountziele.

## Abnahmegrenzen

Offline-Regressionstests prüfen disjunkte Varianten, konkurrierende Empfänger derselben Variante, die Überschneidung mit generischen Zielen, fehlende Variante und ungültige Bestandszahlen. Kein automatisch neues Item, keine fiktive zweite Kopie und kein autonomer Versand allein wegen des korrigierten Planungsresultats. Die umfassende accountweite Rewardverteilung und die Ingame-Liveabnahme W14 sind weiterhin offen. Der separat signierte Bootstrap-Release wird nicht verändert.
