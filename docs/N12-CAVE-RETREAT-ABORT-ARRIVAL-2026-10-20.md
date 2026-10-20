# W12/N12 – Cave-Rückzug: Abbruchüberwachung und Ankunftsbeleg

Stand 20.10.2026, nach PR #296 (Zweirunden-Vorbereitung).

## Zweck und tatsächlicher Umfang

Die bisherigen drei Spieler können dieselbe native Direktroute
und anschließend denselben Vorbereitungsbeleg bestätigen. Das ist
**keine atomare, synchron ausgeführte Gruppenbewegung**.

Das neue Modul `src/world/cave-retreat-watchdog.mjs` ergänzt daher
die notwendige **Abbruchüberwachung und formale Ankunftsbedingung**,
ohne im produktiven Cave bereits Bewegung zu erlauben:

1. Nur bei `caveRetreatPrepare.status().prepared === true` und
   unverändertem Originaltrio kann der bestehende Heartbeat einen
   schreibgeschützten, **2,5 Sekunden** gültigen Rückzugs-Checkpoint
   `phase: staged` anlegen. Er ist an Run, Floor und vollständigen
   unveränderlichen Vorbereitungsbeleg gebunden.
2. Ändern sich Monsterpositionen, Aggro, HP, Peer-Heartbeats oder
   der vorbereitete Zielpunkt, läuft der Checkpoint ab oder erscheint
   eine nicht autorisierte Bewegung, wird er **abgebrochen**.
3. Jeder Abbruch bleibt bis zu **10 Sekunden** in einem kompakten,
   identitätsgebundenen `retreatAbort`-Heartbeat sichtbar. Empfängt
   ein anderer Teilnehmer einen gültigen Abbruch zum exakt gleichen
   Beleg, verweigert auch dieser seine vorherige Vorbereitung.
   Eine fremde oder widersprüchliche Abbruchnachricht hat keine
   globale Wirkung außerhalb dieses Run-/Floor-/Proof-Scope.
4. `caveRetreatArrivalEvidence` beschreibt die nötige spätere
   **Drei-Parteien-Ankunftsbestätigung**: Jede Person muss eine
   native Bewegungsquittung für exakt denselben Proof/Run/Floor
   und für ihre eigene 24-Pixel-Direktstrecke vorweisen. Die
   beobachtete Position muss innerhalb von drei Pixeln am
   bestätigten Ziel liegen; Peer-Beobachtungen dürfen höchstens
   drei Sekunden alt sein. Fehlende Quittungen, falscher Floor,
   falsche Position, ein fremder Movement-Owner oder eine
   überschrittene maximale Gesamtdauer von sechs Sekunden
   verhindern einen Abschluss.

## Nicht freigeschaltet

Das neue Modul ruft **niemals** `move`, `smart_move`,
`town`, `heal` oder `attack` auf. Es erstellt weder eine
echte native Bewegungsquittung noch den später nötigen
atomaren Drei-Client-Start. `canMove:false` und
`executable:false` gelten auch im Zustand `staged`
und für einen rein simulierten vollständigen Ankunftsbeleg.

Es existiert deshalb aktuell **kein produktiver Status
`arrived` aus diesem Watchdog**: Der reine
Ankunftsprüfer kann erst durch eine separate, noch nicht
freigegebene native Ausführung mit echten Quittungen benutzt
werden. Diese klare Trennung verhindert, dass ein
empfangener Peer-Status allein als sichere Bewegung gilt.

Die kritische Cave-Offensiv-/Bewegungssperre aus #289, die
Priorität lebensrettender Priest-Einzelheilung und sämtliche
Wirtschaftsjournale bleiben unverändert.

## Regression und offene Punkte

Das erweiterte
`test/roadmap-n12-cave-retreat-consensus.test.mjs`
testet Abbruchpropagation, manipulierte und fehlende
Belege, native Bewegungsdrift, 2,5-Sekunden-Deadline,
falsche/abgelaufene Ankunftsquittungen, sechs Sekunden
Ankunftslimit sowie **null produktive Bewegungsaufrufe**.
Zusätzlich vollständige Offline-Testsuite, Linux-/Windows-CI,
Bundle-/Editor-Synchronisierung und unveränderte
persönliche `ALBotConfig`.

**Weiter offen:** Ein zentral oder unabhängig verifizierbar
freigegebener Drei-Client-Ausführungsplan mit sicherer
Reihenfolge bei Nachrichtenverlust, die echten nativen
Dispatch-Quittungen und die reale Ingame-Abnahme.
Eine atomare Ausführung ist mit den aktuellen asynchronen
Team-Heartbeats nicht nachgewiesen.
