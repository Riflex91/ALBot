# ALBot 0.43 candidate: Earring/Cape vacancy discovery

**Source:** live 0.42 EUII four-character diagnostic reports, 24 October 2026.

- The optimizer always recognized cape/earring1/earring2 as legitimate equipment slots, but its default candidate list lacked inventory-independent accessory identities.
- For verified, current-session active farmer snapshots, the merchant now discovers earring and cape item IDs through live game definitions; it does not infer emptiness from a missing field.
- The newly discovered item is evaluated only with a physically verified owned copy, a real NPC shop mapping, a valid craft plan, or a non-speculative finite acquisition estimate. Static vendor resale price is never proof of a shop route.
- Explicit KEEP rules, class/level compatibility, configured budgets, minimum improvement, gear safety, allocation, and physical receipt/transfer authorization remain authoritative.
- A bounded vacant-slot scheduling bonus only orders eligible proposals; it never grants an alternative purchase or spend authority.
- Diagnostic intelligence reports accessoryVacancies (item count, unproven route count, selected candidate).
- Real bank stock is not inferred from old catalog rows; no automatic bank withdrawal or game equipment action is authorized by this change alone.
- Linux/Windows offline CI and protected ECDSA release-channel signing are separate from ingame four-character acceptance.
