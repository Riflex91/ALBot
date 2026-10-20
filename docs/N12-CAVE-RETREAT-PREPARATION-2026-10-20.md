# W12/N12 – Zwei-Runden-Vorbereitung eines Cave-Gruppenrückzugs

Stand: 20. Oktober 2026. Inkrement nach PR #292.

## Warum eine zweite Bestätigung nötig ist

Die bestehende Rückzugsprüfung bestätigt einen identischen
24-Pixel-Direktweg für Ranger 1, Ranger 2 und Priest. Sie ist
**noch kein synchronisierter Bewegungsauftrag**. Die drei
Spielclients empfangen Heartbeats zeitversetzt. Ein einzelner
Client könnte sonst loslaufen, während ein anderer wegen
einer Positionsänderung seine Wegfreigabe verliert.

Deshalb implementiert dieses Paket eine zweite, **nur beobachtende**
Vorbereitungsrunde. Die kritische Mehrfachaggro- und Bewegungs-
sperre aus PR #289 bleibt ausdrücklich in Kraft.

## Ablauf und verifizierte Daten

1. Jede Figur bestätigt bei kritischer Zwei-/Dreifachaggro
   den eigenen maximal 24 Pixel langen Direktweg nativ über
   `can_move_to`. Der erste `retreatVote` enthält jetzt zusätzlich
   den **vollständigen identischen Quellbeleg** `key` aus Monster-
   IDs, Zielen, HP, Geometrie, offizieller `attack/frequency`-
   Definition sowie aktuellen beobachteten Teampositionen und HP.
   Alle drei Teilnehmer müssen denselben Beleg übermitteln.
2. Erst wenn der bestehende `caveRetreat.status()` ein
   einstimmiges, höchstens 2,5 Sekunden altes Erstvotum meldet,
   kann ein Charakter über den vorhandenen Heartbeat ein
   zweites `retreatPrepare`-Votum veröffentlichen.
3. Ein zweites Votum bindet die ursprüngliche `voteAt`-Zeit,
   den identischen Run/Floor, den Gegnerbeleg,
   den Acht-Richtungs-Vektor und die exakte Start-/Zielposition.
   `src/world/cave-retreat-preparation.mjs` nimmt es nur an,
   wenn das dazugehörige Erstvotum desselben Peers
   weiterhin gültig und inhaltlich identisch ist.
4. Der Zustand `prepared=true` entsteht erst nach dem
   **zweiten** einstimmigen Nachweis aller drei unabhängigen
   Teilnehmer. Er verfällt bei überschrittener Frist (2,5 s),
   verändertem Gegner, HP-/Position-/Peer-Beleg, unterbrochener
   Cave-Sitzung, Konto-/Wertaktion, fremder Bewegung oder
   ausstehender nativer Priest-Heilung.
5. Beide Empfangsbelege überleben die vorhandene
   Heartbeat-Größenkürzung; unwichtige Diagnosedaten können
   weiterhin entfallen. Statusabfragen erzeugen keine
   Spiel- oder Bewegungsaufrufe.

## Zwingende Nicht-Freigabe

`prepared=true` bedeutet **ausschließlich verifizierte Evidenz**.
Sowohl `canMove` als auch `executable` bleiben **false**.
Das ist kein atomarer Drei-Client-Commit, kein validierter
gleichzeitiger Start und keine bestätigte Gruppenankunft.

Es wurden **keine** `move`, `smart_move`, `town`, `blink`,
Kampf- oder Lootaufrufe hinzugefügt. Die Cave-Notfallsperre
und lebensrettende Priest-Einzelheilung bleiben unverändert.

## Weiterhin offen

Für einen echten Gruppenrückzug fehlen eine konsistente
Ausführungsbarriere (einschließlich Peer-Ausfall-/Reordering-
Behandlung), eine sichere Prioritätsregel gegenüber dem
Priest-Heal, serverseitige Bewegungs-/Ankunftsbelege für alle
drei Charaktere und ein nachgewiesener Abbruch, falls
ein Client seinen Direktweg nicht mehr erreicht.
Insbesondere kann eine verteilte Vorbereitung ohne
serverseitige atomare Freigabe **keine simultane Bewegung
garantieren**.

## Tests

`test/roadmap-n12-cave-retreat-consensus.test.mjs`
beweist die Erst-/Zweitrundenevidenz, Timeouts,
Gegner-/HP-/Positionsänderungen, unabhängige
Konsensbestätigung, Vorrang einer ausstehenden Priest-Heilung,
Heartbeat-Größenbudget und **null native Bewegung**.
Dazu vollständige Offline-Regressionssuite und Linux/Windows-CI.

Die persönliche `ALBotConfig`, Wirtschafts-/Goldjournale,
Cloudflare-Konfigurator und signierte Ingame-Runtime
werden nicht verändert.
