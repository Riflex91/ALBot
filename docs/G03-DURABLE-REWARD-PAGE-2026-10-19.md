# G03 – Reward-Pagination vor Wertfreigabe dauerhaft übernehmen (19.10.2026)

## Ausgangsfehler

`createRewardMail.read()` übernahm einzelne, noch abholbare
Systemnachrichten bereits in die lokale `queue`, bevor die
angeforderte `/api/pull_mail`-Seite vollständig geprüft und ihr
Folgecursor erfolgreich gespeichert worden war. Eine ungültige
Pagination-Antwort oder `p.write`-Fehler konnte deshalb eine
**nicht bestätigte Seite** für den nächsten `mail.claim`-Tick
anbietbar lassen. Der bestehende Value-Executor führte weiterhin
seine Wertguards aus; der Seitennachweis selbst war jedoch unzureichend.

## Korrektur

Die bestehende Reader-Folge bleibt erhalten, aber die Reihenfolge
innerhalb derselben authentifizierten Seite ist geändert:

1. Antwortformat und höchstens 40 Einträge prüfen.
2. Pagination-Cursor vollständig validieren.
3. Cursorzustand erfolgreich persistent schreiben.
4. Erst danach eigene Mail-Recovery bearbeiten und
   **claimbare** Systemreward-Einträge in die lokale Warteschlange
   übernehmen.

Bei fehlerhafter Pagination oder fehlgeschlagener Persistenz
wird die neue Seite **nicht** freigegeben. Es gibt keinen neuen
Serveraufruf, keine Änderung des Journalformats, keine
Vorratsmanipulation und keinen automatischen Retry unbekannter
`take_mail_item`-Aufrufe.

### Regressionen

- Ein persistenter Cursor-Schreibfehler darf auch im nächsten Tick
  keinen Claim der bereits gelesenen Seite erlauben.
- Ein ungültiger rückwärts- beziehungsweise gleichbleibender
  Cursor darf keinen Reward-Queueeintrag hinterlassen.

**Nachweise:** Nur Offline-/CI-Abnahme; noch kein nachgewiesener
Browser-/Headless-Liveserver-Test. Die derzeit bestehende
Headless-Reader-Grenze bleibt unverändert. Kein neuer
signierter Ingame-Release, keine persönliche Konfigurationsänderung.
