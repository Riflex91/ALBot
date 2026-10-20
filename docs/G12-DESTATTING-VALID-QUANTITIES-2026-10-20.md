# G12 / W02 – De-Statting mit belegten physischen Variantenmengen (20.10.2026)

## Aktueller Befund

Die vorhandene G12-De-Statting-Implementierung hat bereits strenge
explizite Itemregeln, Grade-/Scroll-/Gold-/Verlustbudgets, ausreichende
Kapazität und ein beobachtetes NPC-Quittungsfenster. Die erneute
Bestandsprüfung verwendete aber `variantCount`, das positive,
ganze Mengen der einzelnen Stacks nicht erzwingt. Ein `q=0`-Stack
oder arithmetisch gegeneinander aufgehobene Bruch-/Negativmengen
konnte einen scheinbar zulässigen Ausgangs- oder Ergebnisbestand
liefern.

## Änderung

- G12 verwendet beim Planen und nach serverbestätigter Wirkung für
  die alte Itemvariante und die zurückgegebenen Scrolls den
  gemeinsamen physisch geprüften Variantenzähler `localVariantQuantity`.
- Der Zähler akzeptiert implizit **eine** Einheit ausschließlich
  bei ausgelassenem `q`. Explizites `q=null`, `0`, negative oder
  gebrochene Mengen und Überläufe sind kein Bestandsbeleg.
- Die tatsächliche G12-Geldausgabe, serverseitige Rückgabe, Slotbindung
  und Schutz-/Budgetprüfung bleiben unverändert; kein Item wird
  automatisch entsperrt und keine zusätzliche Mutation freigegeben.
- Nach Planungsbeginn auftretende Stackfehler verweigern den
  verzögerten Dispatch über den bestehenden G12-Guard.

## Einschränkungen

Dies schließt eine konkrete G12-Wert-/Bestandsbeweislücke, nicht alle
W07-/N01-/G12-Roadmap-Arbeiten. Kein nachgewiesener Adventure-Land-
Live-De-Statting-Vorgang, kein signierter Ingame-Release.
