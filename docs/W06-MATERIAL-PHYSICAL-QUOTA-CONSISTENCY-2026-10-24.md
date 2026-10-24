# W06/G09 – Endliche Materialquoten mit physischer Belegkonsistenz (24.10.2026)

Ein in derselben Transportnachricht gemeldeter Materialfortschritt wurde bislang als Einzelbeleg verwendet. Obwohl ALBot bereits ein zweites, sessiongebundenes Inventarevidenzprotokoll überträgt, konnte dessen Widerspruch zu neuen Farmaufträgen führen.

Die neue gemeinsame Materialquotenfunktion validiert einen tatsächlich vorhandenen vollständigen physischen Inventarbeleg gegen das unabhängige Bestandsschema (Mengen, Identität, eindeutige Variante, Zeit, Session, Owner, Realm und TTL), bevor sie aus dem gemeldeten Progress neue endliche Quoten veröffentlicht. Pro Item der Materialanfrage wird die beobachtete physische Bruttomenge mit den geschützten Stückzahlen verglichen. Nur ein Fortschritt zwischen dem durch Flags geschützten unteren Wert und der gesamten physischen Menge ist möglich. Die nötige Toleranz berücksichtigt, dass die bestehenden Farmer-Progress-Summen Itemlocks ausschließen, andere geschützte Verwendungen aber separat kennzeichnen können.

Ein fehlender optionaler Inventarbeleg darf die schon bestehende Materialfortschrittsbewertung nicht in einen Nullbestand verwandeln; ein vorhandener, aber unvollständiger/inkonsistenter Beleg ist dagegen ein Stoppsignal für den gesamten Auftrag. Die gewählte TTL folgt nun der tatsächlichen Transportkonfiguration. Die Marker berechtigen weder zu Verkäufen noch zu Übergaben, und es werden keine Adventure-Land-Spiel-APIs erfunden.

Tests: test/w06-material-inventory-consistency.test.mjs. Realer beidseitiger Materialtausch mit physischen Post-Aktion-Quittungen, Wiederanlauf ungeklärter Sendungen und W14-Live-Dauertest bleiben ausdrücklich offen. Der neue Stand 0.49 ist erst nach geschützter Release-Signierung ein veröffentlichter Release.
