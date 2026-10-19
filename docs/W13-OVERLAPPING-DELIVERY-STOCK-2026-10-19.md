# W13 – Generische und variantengebundene Lieferziele teilen physischen Bestand

Stand: 19.10.2026.

## Reproduzierter Fehler

Die automatisch erzeugten `send`-Regeln in `pendingDeliveryRuleNeeds()` begrenzten zwar die Menge pro identischem Ziel-/Item-/Varianten-Schlüssel. Eine generische Anforderung für `sword +1` und eine variantengebundene Anforderung für `sword +1 dex` hatten aber unterschiedliche Schlüssel. Beide konnten daher **dieselbe einzelne physisch vorhandene Dex-Kopie** als verfügbaren Bestand einplanen. Die spätere Versandroutine verfügte zwar weiterhin über eigene Sicherheitskontrollen, doch bereits die automatische Lieferplanung war nicht disjunkt.

## Korrigierte Lieferplan-Bestandszuordnung

- Alle Anforderungen derselben Item-/Upgradelevelgruppe teilen eine übergreifende **physische Kapazitätsobergrenze**. Exakte Varianten besitzen weiterhin eigene Verbrauchszähler, damit nachweislich getrennte Varianten verschiedene Empfänger unabhängig versorgen können.
- Wird zuerst eine **generische** Kopie eingeplant, kann sie jede Variante verbraucht haben. Für einen nachfolgenden Variantenzweck wird diese unklare Entnahme konservativ gegen dessen Bestand gerechnet. Bei vorangestelltem genauen Variantenbeleg kann eine danach noch vorhandene generische Kopie dagegen den verbleibenden Bedarf decken.
- Mehrere passende Gearziele für denselben Empfänger und dieselbe Variante werden nur bis zur gemeinsamen physischen Menge summiert. Bereits durch `delivered()` bestätigte Empfängerlieferungen werden vorher abgezogen.
- Nicht verifizierbare Mengen, widersprüchliche generische/exakte Kapazitäten, Überläufe oder ungültige Lieferzähler erzeugen **keine zusätzlichen automatischen Senderegeln**.
- Dies ist **nur die Planungsphase**: Alle eigentlichen `send_item`-Aufrufe unterliegen unverändert den bestehenden expliziten/physischen Regeln, Transfer-, Empfänger-, Reserve- und Wertjournalnachweisen. Kein neuer Empfänger, kein zusätzlicher Spend-Automatismus und kein automatisches Recovery ungeklärter Transfers.

## Abnahmegrenzen

Offline-Regressionstests decken dieselbe physische Kopie bei generischem/exaktem Ziel, getrennte Variantenziele, prioritätsabhängige konservative Deckung, zwei Gearslots und bereits gelieferte Mengen ab. Vollständige W10/W13-Accountallokation und die Ingame-Liveabnahme stehen weiterhin aus. Der signierte Bootstrap-Release wird nicht verändert.
