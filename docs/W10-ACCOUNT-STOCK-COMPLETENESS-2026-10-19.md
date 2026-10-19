# W10 – Vollständigkeit des accountweiten physischen Stock-Ledgers

Stand: 19.10.2026. Entwicklungsbasis `9e5395d1e2c3b4a352099d372c42504b2ca6f39a`.

## Tatsächliche Lücke

`accountPhysicalLedger` verwendet bereits strenge, zeit- und
sessiongebundene Peer-Bestandsbelege. Die anschließend zugefügte
Bankquelle wurde hingegen lediglich anhand eines `complete`-Flags,
Owner, Session, Realm und Alters eingelesen. Eine beschädigte,
überschriebene oder nicht zur **aktuellen Map** gehörige Bankzeile
konnte damit als vollständiger physischer Bestand angezeigt werden.

Auch die accountweite Zusammenfassung addierte Quellen ohne
gesicherte Überlaufkontrolle. Die sichtbare Ausgabe wird auf
120 Varianten begrenzt, konnte bei über 120 echten Varianten aber
trotz fehlender restlicher Zeilen noch `complete:true` ausweisen.

## Änderung

- Eine Bankquelle wird nur als aktueller physischer Shadow-Beleg
  akzeptiert, wenn Version, Owner, Session, Realm, aktuelle Map,
  Beobachtungszeit, `shadow-only`-Modus, `authority:none`,
  `executable:false`, mindestens ein lokaler Bankpack und alle
  einzelnen Mengen-/Varianteneinträge schlüssig sind.
- Dublette Bankvarianten, ungültige Counts, manipulierte Pack-
  Geometrie, opake nicht darstellbare Varianten, Fremdmap-/Realm-
  Belege und abgelaufene Beobachtungen gelten als **unverifiziert**.
  Diese Zeilen fließen nicht in den Gesamtbestand ein.
- Zusammengeführte Summen sind auf sichere, physisch
  begrenzte Mengen geprüft. Bei einer fehlerhaften Aggregation
  liefert der Ledger keine scheinbar frei verfügbare
  Variantenliste, sondern die Diagnose
  `account-variant-aggregation-unverified` und
  `complete:false`.
- Übersteigt die echte gemeinsame Variantenanzahl das
  Anzeige-Limit von 120, wird die Liste weiterhin kompakt
  dargestellt, aber `complete:false` und
  `account-variant-output-truncated` ausgewiesen.
- Bankbelege müssen explizit zur aktuell von der eigenen
  Figur beobachteten Map gehören. Das verbleibende
  unbekannte Bankinventar auf anderen Maps wird nicht
  als leer interpretiert.

Alle Snapshotwerte behalten ausdrücklich `authority:'none'`
und `executable:false`. Dies ist ein read-only-
Accounting-Fix, keine Freigabe für Marktkäufe, Versand,
Bankbewegungen, Upgrades oder eine autonome Gearallokation.

## Verifikation und Grenzen

Sieben neue Regressionstests prüfen legitime lokale,
Peer-, Bank- und Equipmentbestände sowie manipulierte
Bankzeilen, defekte Varianten, Mengenüberläufe,
abgeschnittene Aggregate und stale Peers.

Offen bleiben echte Ingame-Mehrcharakter-Abnahmen und
vollständige End-to-End-Empfängerallokation. Persönliche
Konfiguration, bestehende Recoveryjournale und der separat
signierte Releasekanal bleiben unverändert.
