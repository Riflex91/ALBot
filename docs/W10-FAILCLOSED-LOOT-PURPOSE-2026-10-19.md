# W10/W13 – Beute- und Gear-Purpose-Evidenz fail-closed auswerten

Stand: 19.10.2026; Entwicklungsruntime `0.10.12-candidate`.

## Befund

`createOwnLootReceipts` verarbeitet offizielle `chest_opened`-Ereignisse,
physische Inventarvorher-/nachher-Bilder und ausschließlich passive
Empfänger-/Purpose-Hinweise. Für Inventaritems und Chest-Drops wurde
`identity(item)` ungeprüft aufgerufen. Eine zyklische oder nicht
serialisierbare `data`-Eigenschaft konnte dadurch den
Serverereignis- oder Loot-Statuspfad mit einer Exception abbrechen.
Ebenso konnte ein zyklisches `gearGoals[].variant` den
regelmäßig abgefragten Status-Heartbeat unterbrechen; ein fremdes
`variant.name`-/`variant.level`-Feld konnte zudem einen als
exakt bezeichneten Empfängerhinweis verfälschen.

## Korrektur

- Jede physische Itemidentität muss sicher serialisierbar und auf
  512 Zeichen begrenzt sein; ansonsten entsteht keine bestätigte
  Own-Loot-Baseline und kein falscher Chest-Receipt.
- Ein beschädigtes Inventar-Snapshot wird bei der passiven Purpose-
  Planung insgesamt als ungeklärt behandelt, nicht als frei
  verwendbarer Bestand.
- Empfängerhinweise verlangen ein tatsächlich gültiges Ziel:
  korrekten Namen/Level, ausdrücklichen Empfänger sowie bei exakten
  Zielen die richtige, vollständige Variante. Fehlerhafte
  `data`-Zyklen, BigInts, Namens-/Levelsubstitutionen werden ohne
  Ausnahme unterdrückt; nachweislich gültige und generische
  Hinweise bleiben erhalten.
- Der Zweck-Status bleibt strikt `dispatchAuthorized:false`.
  Er ist **kein** Auslöser für neue Lieferungen, automatische
  Empfängerzuweisung oder Wiederholungen ungeklärter Transfers.

## Abnahmegrenze

Fünf zusätzliche Regressionen prüfen zyklische Chests,
nicht belegbare physische Bestände, sichere Purpose-Hinweise
und regelmäßige Statusabfragen. Der Patch ändert keine
persönlichen Profile, Senderegeln, Wertjournale, Bankbestände
oder bestehende signierte Releases. Accountweite W10/W13-
Rewardallokation und Live-Abnahme sind weiterhin offen.
