# W12/N12 – deterministische Cave-Mehrfachaggro-Koordination

20. Oktober 2026. Umsetzung nach PR #286 auf dem jeweils aktuellen `main`.

## Nächster implementierter Funktionsschritt

Bisher wählte der Cave-Teamevidenzpfad primär einen Priest-Aggressor,
anschließend verletzte Opfer und niedrige Monster-HP. Gleichzeitig prüfte
der Cave-Ranger-Angriffscontroller den kumulierten Schaden von bis zu drei
bereits engagierten Gegnern. Eine von *beiden Rangern identisch abgeleitete*
und bis an die Netzwerkgrenze gebundene Priorisierung für die
Mehrfachaggro fehlte.

`src/world/cave-multi-aggro-focus.mjs` ergänzt jetzt einen
**read-only**-Plan für genau zwei oder drei bereits auf Teammitglieder
gebundene Cave-Monster. Der Plan ist keine eigenständige
Angriffsberechtigung:

- `caveTeam.status().ready` und `caveCumulativeThreatBudget().ready`
  sind zwingend. Run, Floor, Trio, lokale lebende Ziele und der
  sortierte `id:target`-Aggrobeleg müssen übereinstimmen.
- Gegneridentitäten, Typ, Ziel, HP, Ort und offizielle
  `G.monsters.attack`-/`frequency`-Werte müssen bestätigt und
  endlich sein. Fehlende oder abweichende Belege verweigern eine
  neue Aktion; mehr als drei Angreifer bleiben generell gesperrt.
- Gemeinsame Sortierung: (1) Gegner auf dem Priest, (2) kleinste
  verbleibende Vier-Sekunden-Überlebensmarge relativ zur maximalen HP
  des angegriffenen Charakters, (3) höherer eingehender DPS,
  (4) geringere Monster-HP, (5) deterministische Monster-ID.
- Die Auswahl kann vom alten Einziel-`team.focus` abweichen,
  bleibt aber **ausnahmslos ein bereits engagierter Teamangreifer**.
  Der bestehende `combatAssessment.canDefend`-, Threat-/Boss-,
  Distanz-, Cooldown- und Native-`can_attack`-Guard bleibt bestehen.
- Sowohl vor dem Executor-Dispatch als auch unmittelbar beim nativen
  `attack` prüft die Runtime den erneut abgeleiteten Fokus,
  den vorherigen vollständigen Aggrobeleg und die sortierten
  HP-/Geometrie-/Monstertyp-/DPS-Signaturen.
  Drift oder ein neuer zweiter/dritter Gegner führt nicht zu einem
  Ersatzangriff.
- `bot.caveMultiAggro.status()` zeigt nur den strukturierten
  Plan, **keine veränderbaren Spiel-Entity-Referenzen**. Die
  Zielauswahl ist ein reiner Sicherheits-/Prioritätsbeleg; er
  verschiebt keine Charaktere, priorisiert nicht pauschal AoE
  und erzeugt keine neutralen Pulls.

## Sicherheitsgrenzen und noch offene Roadmap

Die neue Auswahl verbessert die bereits zulässige Ranger-
Grundverteidigung, aber garantiert weder einen Kill noch das
Überleben eines realen Boss-Encounters. Sie ist keine sichere
Fluchtbewegung bei Mehrfachaggro und koordiniert noch keine
mehrstufige Heil-/Kampfroutenfolge. Der Priest verwendet weiterhin
seinen bestehenden einzelzielorientierten nativen Heilpfad.
Unbekannte Geometrie, zusätzliche Bodenmechaniken, abweichende
Snapshots oder fehlende Schadenstabellen ergeben keine
Bewegungs-/Angriffsfreigabe. Eine *reale* Cave-Dreierteam-Abnahme
und der vollständige Cave-/Crypt-Expeditionscontroller fehlen.

Gezielte Regression: `test/roadmap-n12-cave-multi-aggro-focus.test.mjs`.
Außerdem vollständige Node-Regression, Linux und Windows,
synchronisierte Runtime-/Editor-Artefakte. Die persönliche
`ALBotConfig` und bestehende signierte Runtime bleiben unverändert;
Entwicklungsmerge und signierter Ingame-Release sind getrennt.
