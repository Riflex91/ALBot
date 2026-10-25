# ALBot 0.62.0-candidate – Protected offline release certification (25.10.2026)

## Exact verified release chain

- W14 safety patch [PR #500](https://github.com/Riflex91/ALBot/pull/500): live aggressive enemies with unknown map or invalid same-map positions, health, reach or speed no longer disappear from hazard corridors; route-planner prefilter retains unknown-map enemies and rejects invalid dynamic rectangles/circles. This is **admission revocation**, not approval of any newly traversable route.
- Final tested PR Head `a56dec9d568d77c45a8c758f6a651f996ee8bfde`, full [Linux and Windows CI #40203298919](https://github.com/Riflex91/ALBot/actions/runs/40203298919) successful. `mergeable=true` and `mergeable_state=clean`; `main` equal verified base `87d75eeb94d8cee8b16083ea6885f67033d5c6f0` at merge.
- Verified merge commit `a527b68e5c42c26b848475bb2c22e4f289d7b248` with the other current 0.61 protections intact.
- Existing protected signer [GitHub Actions #40203538783](https://github.com/Riflex91/ALBot/actions/runs/40203538783) **successful** after complete offline regression. Protected release tip `b55e6c9bff1fceb5baaf9398a3be1aa0bc7ab069`.
- Protected ECDSA-P-256 manifest **0.62.0-candidate / Sequence 62**, 1,041,271 bytes, SHA-256 `560650897e63d4fbd80e046412ea85e4d6174c286da24139d0cd3099308ae7df`. Signed release and merged main runtime Git blob `edb33329596cdd4e0bba8f3954e211d4dea1cd72` identical.
- The current personal ALBotConfig, installed V2 bootstrap, public key, release URLs and protected signing secret have not been modified.

## Strict limitations

Official Adventure Land runtime/server arrival and collision evidence is not reproduced by offline unit tests. This change prevents one class of unsound optimistic hazard acceptance, but neither guarantees a safe prat transit nor completes W14 acceptance. The three-farmer `level1` deaths on 24.10.2026 are a documented active incident. Draft PRs #485/#487 remain unmerged and release-blocked. True game-native physical portal/monster safety requires controlled live testing and failure-free coordinated route monitoring.
