# W03/W04 – Gültige Teilmengen als Bank-Recovery-Beleg (20.10.2026)

## Befund

Die vorhandenen Einzelentnahme-, Teilentnahme- und Bank-Reclaim-Journale
besitzen persistierte Prepared-/Dispatch-Informationen und adressierte
Quell- und Zielslots. Beim Abgleich nach einem Neustart wurden die
Mengen gleichartiger Items bisher jedoch mit `variantCount` summiert.
`variantCount` ist ein allgemeiner Zähler und validiert **nicht**
jede einzelne physische Stackmenge. Beispiel: Ein Stack `q=-1`
und ein Stack `q=1` ergeben null, obwohl keiner dieser beiden
Stacks als verlässlicher Beleg für eine Banktransaktion verwendbar ist.
Ebenso können gebrochene Zahlen oder explizites `q=null` durch
algebraische Aufhebung eine scheinbar passende Gesamtmenge erzeugen.

## Änderung

- Neuer rein lesender `verifiedBankVariantCount` als **separater**
  Belegzähler für Bank-Recovery. Jeder zutreffende Stack muss eine
  positive, sichere Ganzzahl enthalten; ein implizites Einzelexemplar
  ist nur bei tatsächlich fehlendem `q` zulässig.
- Auch die Gesamtsumme muss eine sichere Ganzzahl bleiben.
- Diese Prüfung gilt bei der Rekonstruktion der Single- und Partial-
  Phasen sowie bei Reclaim- und **Offsite**-NPC-Fortsetzungen.
- Ein arithmetisch kompensierter Fehlbestand führt zum konservativen
  Status `ambiguous` bzw. einer verweigerten Offsite-Berechtigung.
  Eine nicht belegte Bankoperation wird nicht wiederholt, und ein
  verdächtiges Journal wird nicht automatisch gelöscht.
- Die allgemeine `variantCount`-Funktion bleibt unverändert. Die
  Policy-, Reservierungs-, Retry-, API- und Geldjournal-Verträge
  werden nicht ausgeweitet.

## Abnahmebereich

Neue Fälle prüfen die ursprüngliche Bankvorlage, die vollständige
Entnahme, die Teilentnahme-Zwischenphasen (Retrieve/Split/Return),
das Reclaim-Journal und den Offsite-NPC-Pfad. Eine unveränderte
legitime Belegfolge bleibt weiterhin automatisch rekonstruierbar.

Das ist eine eng begrenzte Recovery-Sicherheitskorrektur; die
vollständige Roadmap der Bankzwischenplatzfolgen und insbesondere
die Ingame-Liveabnahme bleiben offen. Kein neuer signierter Release.
