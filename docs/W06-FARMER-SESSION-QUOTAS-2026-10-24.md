# W06/G09 – Sessiongebundene Materialquoten (24.10.2026)

## Funktionaler Ablauf

Der bereits vorhandene Materialquotenplaner teilt die exakt verbleibenden Materialeinheiten auf frisch beobachtete, nicht inventargeblockte Farmer auf. Bisher war der Empfänger nur über seinen Charakternamen gebunden. Ein Browser-/CODE-Neustart konnte trotz neuem Session-Token die alte individuelle Quote aus einer noch sichtbaren Merchant-Nachricht erben.

Der Merchant fordert mit `bindSessions:true` eine beobachtete Session und aktuelle `received`-Zeit innerhalb des konfigurierten Transport-TTL für alle aktiven Kandidaten. Fehlende oder veraltete Teilnehmerbelege frieren den gesamten Auftrag statt unbewiesene Teilmengen auf andere Farmer zu verteilen. Jede zugewiesene Zeile enthält neben `name` und `quantity` die tatsächliche `session`, die Nachricht trägt `quotaSessions:true`. Beim Neustart oder nach einer Sessionrotation verliert die alte Zeile ihre Ausführbarkeit. Erst die neu berechnete Merchant-Quote mit passender Sitzung erlaubt weitere Materialkämpfe. Geplante Reisen und Farmzielauswahl prüfen denselben Vertrag; eine leere Quotenliste löst kein Material-Squad-Reiseziel aus.

Für bereits empfangene ältere `quotas` ohne explizite Sessionbindung gilt weiterhin die bisherige endliche Kompatibilitätsprüfung. Die neue Veröffentlichung bindet jedoch jede echte Quote an eine laufende Sitzung. Defekte, doppelte oder inkonsistente Quoten werden verworfen. Die Summe beobachteter physischer Mengen bleibt weiterhin getrennt vom Session-Token gegen die vorhandenen W06-Bestandsbelege geprüft.

## Regression

`test/w06-material-session-quotas.test.mjs`: korrekte endliche Arbeitsteilung, Restart/Sessionrotation, ungültige/future/stale Heartbeats, blockierte Farmer, Duplikate, ungültige Markierung, Legacy-Kompatibilität und No-work-Fallback.

Keine neue Adventure-Land-API. Kein Versand, Handel, Bankzugriff oder irreversible Mutation ohne bestehende Beweis-/Journalgrenzen. Die vorliegende Offline-CI ist weder echte Zwei-Parteien-Serverquittung noch W14-Ingame-Abnahme. Release 0.50.0-candidate / Sequence 50 wurde durch den geschützten Workflow #40100996547 P-256-signiert (995231 Bytes, SHA-256 09d84d9c1d8f7f3a580869593b9e3574e3dac473129aa5abd22d401dabbe8872). Das ist Offline-Zertifizierung, keine W14-Ingame-Abnahme.
