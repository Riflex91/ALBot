# G04 – gruppenweiter Kostenschutz bei optionalem Serverwechsel

## Fehlende Integration

`requestHop()` prüfte den bestehenden `hopPenaltyDecision()` ausschließlich
gegen den lokalen Leader. Bei einem unter Level 60 liegenden Leader mit einem
höherstufigen Farmer konnte ein automatischer optionaler Hop als kostenfrei
eingeplant werden, obwohl für den mitreisenden Farmer der
Hopsickness-/Realmfatigue-Verlust relevant war.

## Eng begrenzte Änderung

Der vorhandene Travel-Port und `hopPenaltyDecision()` bleiben maßgeblich.

- Ein automatischer optionaler Gruppenwechsel prüft **alle** konfigurierten
  Teilnehmer der bereits bestehenden Hop-Folge, einschließlich Merchant.
- Fehlender Level-/Klassen-Nachweis, doppelte Teilnehmer und ungültige
  Gruppenbelege werden konservativ zurückgestellt. Als Quelle dienen nur
  lokale Charakterdaten beziehungsweise durch den bestehenden
  Transport als frisch eingestufte Heartbeats.
- Für jeden Teilnehmer bleiben Levelschwelle, Merchant-Sonderrolle,
  Heimserver und bestehende aktive Hop-Sanktionen maßgeblich.
- Der Leader gibt die Eigenschaft `automatic` in der vorhandenen
  `hopPlan`-Nachricht weiter. Ein Empfänger prüft seine **eigenen aktuellen**
  Kosten noch vor `hopAck` und vor dem tatsächlichen Commit.
- Manuelle Wechsel, ausdrücklich erlaubte Druckflucht und Heimkehr bleiben
  von dieser zusätzlichen *optionalen* Sperre ausgenommen.
- `world.respectHopPenalties=false` bleibt eine ausdrücklich bestehende
  Konfigurationsentscheidung; es wird nicht ungefragt aktiviert.
- Die Prüfung ist ausschließlich ein zusätzliches **Veto**. Sie erteilt
  niemals Ziel-, Kampf-, Reise- oder PvP-Berechtigungen und simuliert
  keinen Vorteil aus unbeobachteten Serverpopulationen.

## Abgrenzung

Die vollständige accountweite Nettorendite samt gemessener Verfügbarkeit,
Encouragement und Online-Zeitverlauf bleibt offen. Diese Änderung belegt
konservativ die Kostenseite eines Gruppenwechsels, nicht dessen Gewinn.
Die gemeinsame Runtime, bestehende Journale, Schutzregeln und Signierpipeline
werden beibehalten. Offline-Regressionen sind keine Ingame-Liveabnahme.
Ein separater signierter Release ist nicht Teil dieses PR.
