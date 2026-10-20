# W12/N12 – Risikotriage der Cave-Priest-Einzelheilung

Stand 20.10.2026 – Ergänzung nach der gemeinsamen Ranger-Zielauswahl
in PR #287. Noch keine vollständig autonome Cave-Expedition.

## Ausgangspunkt und Fortschritt

Bei gleichzeitig zwei oder drei auf das Original-Dreierteam
gerichteten Cave-Gegnern verwendete der Priest bisher allein
die niedrigste aktuelle HP-Quote, selbst wenn der nächstfolgende
Charakter einem deutlich höheren laufenden Schaden ausgesetzt war.

Die neue read-only Risikotriage
`src/world/cave-critical-heal-triage.mjs` berechnet aus **bestätigten**
Monsterdefinitionen den vorsichtig modellierten
`attack * frequency * 1.5`-Schaden je Opfer. Die Zeit bis zum
Schutzboden `max(25% maxHP, 1.5 × kumulierte Treffer-Spitze)`
liefert die Priorität für die **bereits zugelassenen** nativen
Einzel-Heilkandidaten. Bei 35% HP oder weniger hat die
eigene Priest-Notheilung besonderen Vorrang.

Der neue Beleg erfordert:
- Exakt den aktuellen Cave-Run/Floor, das bestätigte aktive Trio,
  PriestroIle und den bestehenden frischen Team-Heilstatus.
- Zwei oder drei bereits engagierte Monster in einer vollständigen
  lokalen Liste; eindeutige IDs, eigene Map, endliche HP und
  Positionen, vorhandene positive `G.monsters.attack/frequency`-
  Definitionen ohne unbegrenzte Schadenszahlen.
- Lebende, aktualisierte Team-Heartbeats und **direkt sichtbare**
  Patienten mit höchstens acht Pixel Positionsabweichung und
  höchstens acht Prozentpunkten HP-Quotenabweichung.
  Die Peer-Aggrozähler müssen den sichtbaren Angreifern genau
  entsprechen; die lokale native Zielanzahl darf ihnen nicht
  widersprechen.
- Nur sichtbare, im aktuellen Heal-Executor bereits zugelassene
  Patienten bis 80% HP und innerhalb der vorhandenen 140-Pixel-
  Heilreichweite sind nach der Risikotriage auswählbar.
- Ein gesamter nach Run, Monster-IDs, Opfern, HP, Geometrie,
  Schadenstabelle und Team-HP bestimmter Signatur-Beleg
  muss **vor Executor-Dispatch und unmittelbar vor dem
  wirklichen `heal`** unverändert sein; weitere
  Monsterkontakte oder Änderungen verhindern die alte Aktion.

## Sicherheitsgrenzen

Bei unvollständiger Mehrfachaggro-Evidenz erteilt die Triage
**keine neue Berechtigung**. Die bereits existierende sichere
Single-Heal-Funktion bleibt bewusst erhalten (niedrigster
HP-Anteil), weil selbst unbekannter Schadensdruck
eine lebensrettende Einzelheilung nicht pauschal sperren darf.
Dieses Legacy-Fallback ist im Status als
`legacy-single-heal` von einem bestätigten
`verified-multi-aggro`-Prioritätsbeleg unterscheidbar.

Keine Änderung von Gegnerpulls, AoE, mehrfachen Heilaktionen,
Wertjournals, Verschleiß-/Verlustbudgets, Movement, persönlicher
`ALBotConfig`, Signierung oder Freigabe eines Game-Releases.

## Rest-Roadmap

Offen bleiben eine sichere **Mehrfachaggro-Flucht über bestätigte
Instanz-Geometrie**, koordinierte Positionierung mehrerer
Charaktere, vollwertige Cave-/Crypt-Begegnungsplanung und
reale Mehrcharakter-Liveabnahme. Das Vier-Sekunden-Modell
ist ein konservativer Vergleichswert, keine
tatsächlich beobachtete Schadens-/Cast-Terminplanung.

Regression: `test/roadmap-n12-cave-critical-heal-triage.test.mjs`.
Zulassung außerdem über komplette Offline-Suite,
Linux- und Windows-CI mit synchronisierter Runtime
und Editor-Artefakten.
