# W06/G09 – Sitzungsübergreifende Itemtransfer-Diagnostik, 24.10.2026

## Problem

Eine alte lokale SEND-/RECEIVE-Bestandsbeobachtung konnte bislang zusammen mit einem aktuellen Partner-Heartbeat als gepaarte physische Mengenänderung angezeigt werden. Die Berechnung benutzte nur die Frische des Partners, nicht das Alter der lokalen physischen Momentaufnahme. Außerdem meldete die Recovery bislang nur die Sessionrotation des Senders bei offenem RECEIVE, nicht die spiegelbildliche Empfängerrotation bei offenem SEND.

## Erweiterung

Der vorhandene `inspectPairedItemTransfer`-Beweisvertrag validiert nun auch die aktuelle lokale Beobachtung vollständig gegen eine endliche Transport-TTL und eine kausal zulässige Journalzeit. Derselbe kausale Check gilt für die Partnerbeobachtung. Ungültige und nicht endliche Zeitwerte können kein `eligible` erzeugen.

`inspectSendReceiverSession` prüft vor einer Empfänger-Restart-Diagnose: ursprüngliches SEND-Journal und Empfänger-Session, verifizierte aktuelle eigene Sender-Session aus der Journal-ID, aktuelle bekannte Peer-Identität, identischer Realm, laufender nicht toter Partner und frische empfangene Session. Der Recoverystatus zeigt `originalReceiverSession`, `receiverSessionChanged` und `receiverSessionReason`. Unbekannter, fremder oder veralteter Peer ist **kein** Neustartbeweis.

Ein Empfänger kann eine Sendung vor dem Neustart angenommen haben. Der Restartstatus ist daher ausschließlich ein Diagnosebeleg, keine erfolgreiche serverseitige Übergabe, kein No-Send-Nachweis und insbesondere keine Befugnis, eine eventuell bereits erfolgte `send_item`-Operation zu wiederholen. Alle bestehenden manuellen Quarantänegrenzen bleiben aktiv.

## Offline-Regressionen

`test/w06-transfer-counterparty-session.test.mjs` prüft echte Sender- und Empfänger-Snapshotpaare, stale/future/inkonsistente Journalzeiten, Realm-/Session-/TTL-Abweichungen, Receiverrestart und dass die blockierte Recovery weder das Journal löscht noch neue Wertaktionen freigibt.

Weitere beidseitig serverautorisierte Warenhandelsquittungen und eine W14-Live-Dauerabnahme sind offen. Eine Testsignierung der Laufzeit ist noch kein echter Adventure-Land-Livebeleg.

## Geschützte Veröffentlichung

Die Runtime 0.52.0-candidate / Sequence 52 wurde mit [Signierworkflow #40104446046](https://github.com/Riflex91/ALBot/actions/runs/40104446046) ECDSA-P-256-signiert und byteidentisch zur getesteten main-Runtime bestätigt (997417 Bytes, SHA-256 `8ac4297e7c39da65beccb31b1fb978be0a8dbc2e6418e87a8ac03696230e6fc1`). Dies ist keine W14-Ingame- oder serverseitige Transferabnahme.
