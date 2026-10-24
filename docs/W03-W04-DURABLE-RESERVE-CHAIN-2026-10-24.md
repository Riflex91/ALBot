# W03/W04 – wiederaufnehmbarer physischer Bankreserve-Zyklus (24.10.2026)

## Funktionsumfang
- Neuer persistenter `albot:bank-reserve-chain:<merchant>`-Cursor mit Owner, Realm, Itemvariante, Schutzboden, beobachtet getragenem Bestand, Schrittanzahl (maximal 16), physischer Bankquelle und expliziten `prepared`-/`dispatched`-/`ready`-Phasen.
- Vor jedem echten `bank_retrieve` werden sowohl dieser Ablaufcursor als auch das bestehende Einzel-/Teilentnahmejournal dauerhaft vorbereitet. Der Cursor wird erst nach dem ursprünglichen Bank-Dispatchjournal als `dispatched` markiert. Schlägt eines der Schreiben fehl, erfolgt **kein** neuer API-Aufruf.
- Wiederaufnahme nach Browser-/CODE-Neustart: Solange das ursprüngliche Einzel-/Teiljournal noch existiert, hat dessen Recovery Vorrang. Erst nach physisch bestätigtem Journalausgang darf der Cursor die Veränderung anhand der **aktuellen lokalen Bankquelle** und der **physisch gültigen getragenen Gesamtmenge** quittieren.
- Ein nur vorbereiteter Schritt ohne Dispatch kann lediglich gegen exakt unveränderten Vorzustand aufgeklärt werden. Nach belegter Entnahme wird eine neue sichere Stagingrunde zugelassen. Unbelegte oder veränderte Quellslots, unbekannte Dispatch-Ergebnisse, falscher Realm/Owner und unzulässige Mengen blockieren die weitere Wertaktion.
- Ein Verkaufs-Scan wird nicht aus dem Checkpoint heraus freigegeben: zunächst muss der gesamte Schutzboden wirklich getragen sein und der Cursor separat persistent gelöscht werden. Die vorhandenen Item-Locks, Nutzer- und Beschaffungsregeln, Sicherheitsbudgets sowie Bankbeweisverträge gelten unverändert.

## Regressionen
`test/roadmap-w04-bank-disposition.test.mjs` prüft die Wiederaufnahme über neue CODE-Sitzung, die belegte Entnahme vor einem getrennten späteren Bankverkauf, einen manipulierten physischen Rücksprung, verweigertes persistentes Schreiben und ungültige Realm-/Checkpointdaten. `test/roadmap-w04-bank-journal-collision.test.mjs` bestätigt die inert bleibende Diagnose ohne Journal.

Der **temporäre Generator** baute und testete diese Quellcodeänderungen mit Linux-Node 22 vollständig erfolgreich, danach wurden source-aligned Runtime, personalisierte `bot.js`, Auto-Bootstrap, Manifest, Runtime-Package und Editor synchronisiert. Parallele Änderungen für Priest-/Ranger-Zubehör und das signierte 0.44-Manifest sind integriert, nicht mit älteren Artefakten überschrieben. Exakte finale Linux-/Windows-PR-CI ist gesondert erforderlich.

## Noch ausstehend
Diese Erweiterung ist keine vollständige W02/W03/W04-Account-Bestandsreservierung über mehrere Charaktere: Gleichzeitige Partner-Reservierungen, echte serverseitige Mehrfachquittungen und ungeklärte Serverzustände außerhalb der vorhandenen lokalen Bankjournale bleiben offen. W14-Live-/Dauertest mit echten Adventure-Land-Logs ist weiterhin ausstehend. Die Kandidatenversion 0.45 ist ohne gesonderten Signierworkflow **nicht** signiert.
