# W04 – Bankreserve: Cross-Pack-Dispatchnachweis (19.10.2026)

## Konkrete Lücke

Die vorhandenen persistenten Bank-Einzelentnahme- und Teilentnahmejournale
bleiben die einzige Autorität für einen physischen Wertabschluss. Sie belegen
vor dem Dispatch den Ausgangsbestand des konkret adressierten **Quellpacks**.
Der automatische W04-Reservestaging-Planer wählte jedoch aus der Summe mehrerer
lokal sichtbarer Packs einen Reserve-Stapel aus. Nach der Planung konnte ein
anderer, ebenfalls lokaler Bankstapel verschwinden, ohne die Quellpack-Quittung
zu ändern. Die ursprüngliche geplante Reserveentnahme blieb dann ausführbar,
obwohl nicht mehr belegt war, dass nach dem Auffüllen ein Verkaufsüberschuss
vorhanden sein würde.

## Implementierte Korrektur

`src/merchant/bank.mjs` prüft den identischen Itemvariantentyp jetzt
ausschließlich anhand aktuell sichtbarer Bankpacks derselben Map. Sowohl die
Scan-Auswahl als auch die abschließende Wahl und **der reale,
verzögerte Dispatch-Guard** verlangen strikt
`carried + observed-local-bank > protected-floor`.
Ein fehlendes Pack oder eine zum selben Variantentyp gehörende ungültige
Menge (z. B. `q=10000` über dem offiziellen `s=9999`-Stacklimit)
darf diese Freigabe nicht stützen. Die Mengenarithmetik muss als nichtnegative
sichere Ganzzahl belegbar sein.

### Sicherheitsgrenzen

- Die Prüfung erzeugt keinen neuen Verkauf, keine neue Reservierung und keinen
  zusätzlichen Retry; sie **verweigert** nur eine inzwischen unbelegte
  Reserveentnahme.
- Ein signierter, unveränderter Quellpackbeleg ersetzt **nicht** den frischen
  Beleg aus den anderen lokalen Packs.
- Die bestehenden persistierten `single`-/`partial`-Journale, die
  Recoverystufen, Schutzregeln, Benutzerbudgets, persönlichen Einstellungen
  und der Executor bleiben unverändert.
- Ein nach Planungsbeginn erkannter physischer Drift wird nicht zu einem
  bereits abgeschlossenen Kauf oder Verkauf umgedeutet.
- Es werden keine gespeicherten Offsite-Bank-Kataloge als Mutationsrecht
  verwendet.

### Regressionen

Zwei zusätzliche Tests in `test/roadmap-w04-bank-disposition.test.mjs`:
(1) eine zweite lokale Bankpack-Kopie verschwindet nach der Reservierungsplanung,
während der vollständige Quellpackbeleg unverändert bleibt;
(2) ein ungültiger gleichartiger Stack darf bei der Vorratsrechnung nicht
als Backing gelten.

**Abnahme:** Nur Offline-Build/Tests/CI nach jeweiligem Commit. Kein
Adventure-Land-Liveserver- oder Bank-Transaktionsnachweis. Die
separat signierte Ingame-Runtime bleibt unverändert.
