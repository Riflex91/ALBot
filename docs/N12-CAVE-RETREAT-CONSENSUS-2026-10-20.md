# W12/N12 – Dreifacher Cave-Rückzugsnachweis ohne Bewegungsfreigabe

Stand 20.10.2026. Nächstes vorsichtiges Inkrement nach PR #289.

## Implementiert

Die bisherige Cave-Notfallkoordination stoppt neue Ranger-Angriffe
und unsichere Direktschritte bei kritischer Mehrfachaggro.
Die Voraussetzung für einen echten gemeinsamen Rückzug fehlte
aber weiterhin: **Alle drei Charaktere müssen lokal denselben
Gegnerzustand sehen und jeweils ihren eigenen Direktweg mit dem
Spielserver bestätigen**, bevor eine spätere gemeinsame
Rückzugssequenz überhaupt diskutiert werden kann.

`src/world/cave-retreat-consensus.mjs` stellt dafür einen
**ausschließlich lesenden, drei Parteien umfassenden Beleg** bereit:

- Nur bei bereits ermitteltem `caveCriticalResponse`-Zustand
  `critical-hold`, genau zwei/drei bestätigten Angreifern,
  vollständigem Originaltrio sowie frischem `observed-run`-
  Journal auf identischem Run/Floor/Realm.
- Alle drei Character-Positionen/HP werden aus frischen Heartbeats
  und direkt sichtbaren Entities gegengeprüft. Ein Peer ohne
  Sichtbeleg, mit weniger als 35 % HP oder ungesichertem
  Standort erhält **keinen** Rückzugsbeleg.
- Die komplette lokale Monsterliste muss ausschließlich
  die zwei oder drei bereits auf das Team gebundenen Gegner
  enthalten. Ein zusätzlicher neutraler Cave-Gegner, nicht
  übereinstimmende Monster-IDs/Ziele, unbekannte Geometrie,
  widersprüchliche Peer-Aggro oder ein unerkennbarer
  Fluchtvektor führen zur Sperre.
- Der gemeinsame Acht-Richtungs-Vektor wird aus Gruppenmittelpunkt
  und Monster-Schwerpunkt abgeleitet. Für jedes Gruppenmitglied
  wird ein **rein hypothetischer Schritt von 24 Pixeln**
  geprüft: Abstand zu **jedem** Monster vergrößert sich um
  mindestens 12 Pixel, Ziel bleibt mindestens 35 Pixel von
  jedem Monster entfernt und die Gruppendistanzen bleiben
  unter den vorsichtigen Priest-/Teamgrenzen.
- Auf dem **eigenen** Charakter darf ein knapper
  `can_move_to(x,y)`-Check aufgerufen werden. Bei Erfolg
  sendet der Bot mit dem ohnehin vorhandenen
  Team-Statusheartbeat ein kurzes `retreatVote`:
  Run, Floor, Richtung, Gegner-IDs/HP/Ziele/Positionen,
  eigener Start/Zielpunkt und Zeitpunkt der nativen Freigabe.
- `caveRetreat.status()` liefert erst dann
  `consensus=true`, wenn alle drei **unabhängigen**
  nativen Wegbelege höchstens 2,5 Sekunden alt, vollständig
  identisch hinsichtlich Lauf/Floor/Richtung/Gegnerbild
  und mit aktuellen Peerdaten und Positionen konsistent
  sind. Ein Peer-Ausfall, verlorene Sicht, veralteter
  Heartbeat oder Gegnerdrift verwirft den Konsens.
- Die Teamstatus-Nachricht bewahrt diese knappe
  sicherheitsrelevante Evidenz auch dann, wenn das
  normale Heartbeat-Längenlimit weniger wichtige
  Telemetrie entfernt.

## Wichtige Grenze

**Selbst bei `consensus=true` gilt `canMove=false`.**
Der neue Beleg stellt **keinen** Bewegungsauftrag aus.
Es gibt weiterhin keine atomare Drei-Client-Transaktion,
keine mehrstufige Hindernis-Navigation und keine
garantierte gemeinsame Ankunft. Weder `move`,
`smart_move`, `town`, Blink noch eine Kampfaktion
wird aus diesem Modul aufgerufen. Die in #289
eingeführte kritische Offensiv- und Direktschritt-Sperre
bleibt erhalten; die bisherige Priest-Einzelheilung
wird nicht unterbrochen.

Für einen späteren echten gemeinsamen Rückzug sind
noch ein kurzlebiger, atomar gültiger Ausführungsplan,
ein serverseitig beobachteter Wegfortschritt jedes
Charakters, sichere Abbruch-/Wiederaufnahmebedingungen
und reale Cave-Livetests erforderlich.

## Regression

`test/roadmap-n12-cave-retreat-consensus.test.mjs` prüft
native lokale Einzelbelege, alle drei zustimmenden Peers,
fehlende/abweichende IDs/Richtung/Zeit/Position,
kritische und unkritische Cave-Lagen, zusätzliche
neutrale Gegner, gesperrte Geometrie, Heartbeat-
Größenbegrenzung und das ausdrückliche
**Verbot jeder Bewegung**.

Die persönliche `ALBotConfig`, Gold-/Itemjournale,
Verlustlimits, Release-Signaturen und der Ingame-
Bootstrap werden nicht geändert.
