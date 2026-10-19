# W13/G03 – Wiederanlauf von bereits abgeholter Systempost (19.10.2026)

## Identifizierter Vertragswiderspruch

Die vorhandene Mail-Recovery verlangte gleichzeitig `taken=true` und die
gewöhnliche, nur für **noch abholbare** Post geltende Attachment-Prüfung
`can_take=true`. Nach einer erfolgreichen Abholung kann eine
Server-Mailliste `taken=true, can_take=false` zurückliefern. Ein
entsprechender, eindeutig abgeglichener alter `mail.claim`-Checkpoint
konnte dann nicht automatisch als abgeschlossen bestätigt werden.

## Korrektur

`rewardMailAttachment(row, name, G, {recoverTaken:true})` validiert in
diesem **ausschließlich für Recovery** vorgesehenen Modus eine vom Server
als `taken=true` markierte Nachricht unabhängig von `can_take`.

Die normalen Claim-/Lesepfade verlangen weiter ausdrücklich `can_take=true`
und eine noch nicht als abgenommen markierte Nachricht. Der Recoverypfad
verlangt weiterhin unverändert alle übrigen Beweise:

- Gültige `ML_`-ID, exakter eigener Empfänger und
  vertrauenswürdiges systemmarkiertes Cave-/Tracktrix-Belohnungssubjekt.
- Dieselbe genaue Attachment-Variante/-Menge beziehungsweise Goldsumme
  wie im dauerhaft gespeicherten `mail.claim`-Journal.
- Bestehender `taken=true`-Beleg aus der authentifizierten
  `/api/pull_mail`-Antwort.
- Vollständiges lokales Inventar- und Golddelta ohne andere,
  ungeklärte Bestandsänderungen sowie passender Owner/Realm.

Fehlt einer dieser Belege, bleibt das Journal ungeklärt und die
Wertaktionssperre bestehen. Der Patch sendet **keinen zusätzlichen**
`take_mail_item`-Befehl und aktiviert keine weiteren Rewardquellen.
Regressionsfälle decken nicht mehr claimbare Taken-Mails, fehlende
Taken-Marker, falschen Empfänger, abweichende Variante und unzulässige
Nachrichtensubjekte ab.

Die Änderung wurde offline geprüft. Eine reale Serverantwort
mit `can_take=false` und ein echter erfolgreicher Ingame-Abschluss
sind **noch nicht live bestätigt**. Persönliche Einstellungen,
bestehende Checkpoints, signierter Bootstrap und Release-Kanal bleiben
unverändert.
