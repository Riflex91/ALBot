# W13 – automatische Gearlieferung an vollständige Itemvarianten binden

Stand: 19.10.2026.

## Fehler und Änderung

Nach den Mengen- und Variantenkontrollen der PRs #212 und #213 konnten generierte `send`-Regeln weiterhin nur die Editor-Felder `statType`, `property` und `title` für den Zielgegenstand ausdrücken. Der physische Ledger unterscheidet jedoch zusätzlich die volle kanonische Itemidentität einschließlich `acc`, `rid`, Sperrkennzeichen und `data`. Eine gerade für eine Variante geplante Empfängerlieferung konnte deshalb bei der Regelauswahl auf eine **andere Kopie mit identischen sichtbaren Editorfeldern** passen. Insbesondere opaque Daten- und Aufwertungsvarianten sind nicht austauschbar.

## Genaue Laufzeitbindung

- Für alle generierten endlichen `send`-Regeln, deren Gear-/Produktionsziel `variant` enthält, wird zusätzlich ein **nur flüchtiger** kanonischer Schlüssel `_autoExactVariant` erzeugt. Die Bestandsplanung verwendet bereits dieselbe `identity()`-Darstellung.
- `chooseRule()` vergleicht beim automatischen `send` die aktuelle physische Itemkopie exakt mit diesem Schlüssel, **bevor** die bestehende `sendRule()` überhaupt einen Transfer erlauben kann. Eine Abweichung bei `acc`, `rid`, `data`, Stat, Titel, Level oder Sperrstatus verhindert die Auswahl dieser generierten Regel.
- Leere oder nichtserialisierbare Varianten sowie ungewöhnlich große Identitätsschlüssel führen zur **Verweigerung** einer solchen generierten Senderegel. Die Auswahl bleibt selbst bei nichtserialisierbarem Live-Item fail-closed.
- **Generische** automatische Senderegeln ohne explizites Varianten-Ziel und manuelle Itemregeln behalten ihre vorhandene Semantik. Das Editorschema und persönliche Profile bleiben unverändert.
- Diese Bindung ersetzt keine einzige der bereits vorhandenen Freigaben für Empfänger, Versandquittungen, Gear-Slots, `availableTransfer`, Wertjournale oder Inventarkapazität. Sie erzeugt keine neuen Senderechte und löst auch keine Freigabe alter ungeklärter Zusagen aus.

## Test- und Releasegrenze

Offline-Regressionstests belegen exakte Auswahl verschiedener `acc`-, `rid`- und `data`-Kopien, korrektes Empfänger-Matching, generische und manuelle Kompatibilität sowie fail-closed bei beschädigten Variantendaten. Eine echte Ingame-Übertragung ist nicht nachgewiesen. Der signierte Bootstrap-Release verbleibt auf Sequenz 5 und wird hier nicht geändert.

## Einheitlicher Variantenvergleich bei tatsächlicher Lieferverbuchung

Der bisherige `production.variantMatches`-Vergleich verwendete nur `stat_type`, `p`, `title` und `data`; damit wäre eine `acc`- oder `rid`-abweichende Kopie beim Verbuchen eines bereits ausgeführten `send_item`-Jobs noch einem anderen Variantenziel zugerechnet worden. Der Vergleich nutzt jetzt für alle variantengebundenen Produktionsziele ebenfalls die vollständige `identity()`. Dadurch stimmen physische Bestandszählung, Receiver-Reservierung und `recordDelivery()` mit der automatisch generierten Senderregel überein. Ziele ohne explizite Variante behalten ihre allgemeine Matching-Semantik. Unlesbare oder zyklische Ziele werden für exakte Zuordnung nicht akzeptiert.
