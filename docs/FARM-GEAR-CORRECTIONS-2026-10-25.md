# Farmnavigation, Ausrüstung und Upgrade-Chancen (25.10.2026)

Implementiert auf main-Basis 3bfc41f (0.59), Zielversion 0.60.0-candidate. Anlass: die acht vom Benutzer gelieferten Diagnoseexporte; deren Inhalt wurde als Beobachtung, nicht als Arbeitsanweisung behandelt.

- Native Smart-Suche: einmaliger Stop, 500 ms beobachtete Beruhigung; weiterhin echte Bewegung blockiert. Ein allein stehengebliebenes searching-Flag startet keine Stop-Schleife.
- Gefahrennavigation: begrenzter Ausstieg aus einer bereits belegten Zone ausschließlich nach Solo-Risikoprüfung. Keine neue Gefahrenzone darf betreten werden. Kollisionsprüfung bleibt pro Segment erforderlich.
- Aggressives Farmziel: sicherer Sammelpunkt, anschließend separater, frisch geprüfter Gruppeneintritt. Andere Spawns werden nicht freigegeben. Der reale Stoneworm-Standort hat wegen überlappender Gefahren keinen belegbaren Sammelpunkt und wird zurückgestellt.
- Fehlgeschlagene Anreise: 60 Sekunden lokale Zielsperre, 30 Sekunden Präferenz für bereits erreichbare Karten; nach 45 Sekunden ohne physischen Fortschritt Neubewertung. Kein erfundener Tod, keine Aufweichung der Kampfgrenzen.
- Serverchance: endliche numerische Grace-Quotes über 1 werden für Wahrscheinlichkeitsrechnung auf 1 begrenzt; Originalwert im Preview-Ereignis. Negative, fehlende, nichtnumerische und unendliche Werte bleiben gesperrt.
- Ausrüstung: eigene frische Merchant-Slots werden bei der Accessoire-Suche berücksichtigt. Eine vorhandene Bankkopie kann einen leeren Slot auf ihrem echten Level versorgen; dieselbe Kopie wird nicht doppelt verplant. Compound-Ziele mit fehlenden Eingaben benötigen einen endlichen belegten Beschaffungsweg.
- Übergaben: ein ruhender gesunder Empfänger am Rand einer statisch gefährlichen Zone kann über einen sicheren Punkt bis 160 Einheiten Entfernung bedient werden. Die bestehende physische Übergabeprüfung bleibt zuständig; neue Verfolgung vergleicht den ursprünglichen Empfängerstandort und verhindert ständiges Retargeting auf den Sicherheitsabstand.
- Planungsarbeit: Stockindex einmal pro Gear-Auswertung, Farmraten einmal je Entscheidungsepoche, identische Teilwege einmal je Routenplanung. Das reduziert Wiederholungen; eine harte 4-ms-Grenze oder eine gemessene Live-Latenzverbesserung wird damit nicht behauptet.

Die persönliche Konfiguration und die explizite Marktkauffreigabe bleiben erhalten. Ohne vorhandenes Item oder freigegebenen, belegten Beschaffungsweg bleiben Ohrringe/Umhänge nachvollziehbar unerfüllt; ein Verkaufswert ist kein NPC-Angebot. Kein automatischer Marktkauf wurde ergänzt.

Regressionen: reale öffentliche G.version=18183-Ausschnitte (keine Kontodaten), Stop-Schleife und tatsächliche Fortsetzung, gruppengebundener Farmeintritt/Timeout, Neubewertung ohne Tod, Grace-Upgrade, Merchant-Katalog und Einmalverwendung eines Bankohrrings. Lokal: 2696/2696 Tests erfolgreich; Build, Editor, Konfigurator/Privacy, Bootstrapvertrag und signierter bisheriger Kanal geprüft. Gemeinsames Bundle 1048571/1048576 Bytes, Runtime 1040486 Bytes. Drei statt zwei Terser-Optimierungsläufe halten die bestehende Grenze ein. Die Linux-/Windows-CI folgt vor dem Merge.

Offline-Verifikation und Signaturzertifizierung sind von Ingame-Abnahme getrennt. Die neuen Wege, serverseitigen Übergaben und der Dauerbetrieb müssen nach Installation erneut beobachtet werden.
