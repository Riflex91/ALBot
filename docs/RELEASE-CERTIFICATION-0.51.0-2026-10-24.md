# ALBot 0.51.0-candidate — signed offline certification (sequence 51)

**Date:** 24 October 2026. **Scope:** Cryptographically signed, offline-tested
release. **In-game acceptance is still pending.**

## Verified source and integration

- Source fix: [PR #470](https://github.com/Riflex91/ALBot/pull/470)
  (My_Ranger2/My_Priest verified leader focus assistance, admission diagnostics,
  and regression tests); merged main commit
  `d4689616791f53e2258451fc13747b278418e333`.
- Main Linux/Windows verification:
  [run 40102128676](https://github.com/Riflex91/ALBot/actions/runs/40102128676),
  **success**; checked generated browser/editor/Bootstrap contract and all
  offline regressions. Build/synchronization never changed the personalized
  configuration or V2 loader trust keys.
- Protected signing:
  [run 40102314268](https://github.com/Riflex91/ALBot/actions/runs/40102314268),
  **success**; performed another fresh build and all offline tests, compared
  the unchanged personal configuration, signed with the protected key and
  verified the result using the pinned public key.
- Protected release commit:
  `c09e129d2a6727dd1c5489554e4330b36334bcd5`.

## Signed release

| Property | Value |
| --- | --- |
| Manifest | `albot-release-v1` |
| Version | `0.51.0-candidate` |
| Monotonic sequence | **51** (previously 50) |
| Runtime bytes | **995835** |
| SHA-256 | `ba93cd9f5f0c4197c4ca7f9a53ac9380312938ec965f2240fcf2deb0d6a0491c` |
| Runtime Git blob | `17838bc9246fbd5b87e86a11aa0215e7f4628b96` |
| Signing method | ECDSA P-256 / SHA-256 |
| Trusted delivery | Existing `codex/w00-w01-readonly-disposition-20261018` raw GitHub runtime and manifest URLs |

The signed runtime blob has been compared with the generated and tested
`main` runtime blob: **identical**. The signed release manifest is pinned
unchanged to main in the follow-up release PR.

## Validation boundary

The uploaded 24 October EUII logs were collected with different client
runtimes (0.48.0 for both Rangers, 0.49.0 for My_Priest) and **do not**
validate 0.51. Follow-up live acceptance must run all selected Farmers on
0.51/sequence 51, on one realm and selected team, and demonstrate stable
repeated focus-fire actions against the leader's currently engaged monster,
without loss of Priest healing or non-target defensive safety. Attach full
per-character continuous JSONL logs and team checks.

Offline certification and a successful signing workflow must not be described
as an in-game live acceptance or a W14 endurance-test approval.
