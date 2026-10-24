# ALBot 0.44.0 candidate - EUII accessory fix certification

0.43.0 / signed sequence 43 was published concurrently before the validated gear-fix PR #451 was merged. This release advances to 0.44.0 / sequence 44 to include that main change without overwriting the signed sequence 43.

- Candidate IDs for empty cape, earring1, earring2 now come from class-compatible native G.items.
- Discovery is limited to verified current-session active farmer slots. NPC/shop/stock, approved recipes and finite non-speculative acquisition estimates remain required before goal selection.
- Existing physical transfer, equip guards and monetary budgets remain authoritative.
- Candidate tests: test/gear-automatic-accessory-coverage-043.test.mjs; final Linux/Windows PR verification required.
- ECDSA-P256 signing remains exclusive to the protected release branch; do not claim real-world game acceptance from offline tests.
