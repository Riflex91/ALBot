# W12/N12 – Cave-Instanzisolation und beobachtete Trio-Koordination

Stand: 20. Oktober 2026.

## Befund und serverseitige Grenzen

Die Adventure-Land-Cave-Instanzen werden durch
`zone_<run>_<floor>` von gewöhnlichen Farmmaps getrennt.
Der quellengeprüfte Cave-Snapshot liefert Run, Floor, aktuelle
Serverzeit, Pause und ursprüngliches, maximal dreiköpfiges
Roster. Er enthält **keine** garantierte gemeinsam freigegebene
Monsterziel-ID oder Belege für gefahrloses Routing auf der
dynamisch generierten Map. Diese Informationen dürfen nicht durch
normale Overworld-Farmspawns, Kopfzahlen oder einen irgendwann
gesehenen Leader-Zielpointer ersetzt werden.

## Implementiert

- Neues `src/world/cave-team-coordination.mjs`: rein lesender
  Trio- und Priest-Tether-Nachweis. Erforderlich sind aktuelle,
  höchstens drei Sekunden alte Serverdaten mit identischer Run-,
  Floor-, Charakter- und Realm-Bindung und ein separat
  dauerhaft bestätigtes `observed-run`-Cave-Journal.
- Genau drei konfigurierte Originalmitglieder müssen lebendig,
  verbunden, auf demselben Instanz-Floor und durch höchstens
  drei Sekunden alte Teamheartbeats belegt sein. Paarabstand
  maximal 180, Priest-Abstand maximal 140 Einheiten; HP muss
  bei allen mindestens 70 Prozent betragen. Eine ungeklärte
  Rolle, ein anderer Floor, ein abwesender Priest oder ein
  pausierter Run wird nicht als Kampfbereitschaft bestätigt.
- Wenn Gegner bereits nachweislich einen dieser drei Charaktere
  auf **demselben Floor** angreifen, liefert die read-only
  Lagebewertung ein gemeinsames Diagnoseziel. Bestehende
  Angriffe auf den Priest haben höchste Priorität, gefolgt
  von relativer Verwundbarkeit und Gegner-HP.
  **Unangegriffene Gegner dürfen weder ausgewählt noch gepullt
  werden.**
- Neue `ALBot.status().caveTeam`-Diagnose: Zustand,
  Ablehnungsgrund, Run/Floor/Map und ggf. das bereits engagierte
  `focus`-Monster. Alle Resultate tragen weiterhin
  `executable:false`, `canPull:false`, `canAttack:false`,
  `canMove:false`. Eine grüne `ready`-Lageeinschätzung
  erteilt ausdrücklich **keine** neue Spielaktion.
- Gewöhnliche `farmer.tick()`-Farmrouten, Monster-Fokuswahl,
  neue neutrale Pulls und Zielnavigation werden innerhalb der
  Cave-Instanz unterdrückt. Bereits bestehende Farm-/Follow-/
  Cohesion-/Combat-/World-/Regroup-/Quest-Escort-Aufträge werden
  beendet. Selbst zur späteren Executor-Abnahme erneut
  geprüfte Overworld-`attack`-/`target`-Guards dürfen nicht
  in einer inzwischen betretenen Cave ausgeführt werden.
  Die bisherige dringende Recovery- und Überlebenshilfe liegt
  zeitlich **vor** diesem normalen Farming-Tick-Gate.
- Gewöhnliche Quest-/World-Scheduler-Aufgaben dürfen innerhalb
  einer erkannten Cave nicht starten. Außerhalb der Instanz
  bleibt bestehendes Farm-/Follow-/Quest-Verhalten unverändert.

## Nicht implementiert

Diese Zwischenstufe ist kein automatischer Cave-Kampf. Es gibt
weiterhin **keinen** unbegleiteten Monsterangriff, Cave-
Bewegungsroutenplaner, Heiler-Positionierungsbefehl oder
unbelegte Sessionübernahme. Bevor reale Instanzangriffe und
Bewegungsentscheidungen freigegeben werden, benötigt deren
Executor eine eigene instanzgebundene, erneut vor Ausführung
validierte Aktionszulassung sowie aussagekräftige Ingame-
Kampf-/Navigationstraces. Weitere Cave-/Crypt-Roadmappunkte
und Ingame-Liveabnahme bleiben offen.

Regressionen prüfen identische Instanzen, aktuelle
Teamheartbeats, vollständige ausgewählte Originalroster,
Floor-/Realm-Konflikte, Offline- und verletzte Charaktere,
Priest-Tether, echte engagierte Gegner vs. neutrale Spawns
und vor allem das Ausbleiben gewöhnlicher Farmaktionen
innerhalb der generierten Instanz. Der signierte
Releasekanal und persönliche Konfiguration werden nicht
bearbeitet.
