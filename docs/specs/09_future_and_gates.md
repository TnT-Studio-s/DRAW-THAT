# Future scope and external gates

Extracted from [the authoritative master](../plans/MASTER_PLAN.md).

## 10. Future expansion, deliberately outside these six phases

**iOS:** Add the Capacitor iOS project, platform credential/lifecycle/billing adaptations, Apple signing/distribution setup, and real iPhone/iPad testing. Use the same shared client, protocol, accounts, and matchmaking population. Xcode/macOS access is required for the iOS build workflow; future Apple support is not a Windows-only export guarantee. Recheck the then-current environment and store requirements. [S21]

**Asynchronous partner play:** A later distinct feature, not the behavior of the live launch. Would require storing/replaying submitted strokes, turn notifications, expiration, and different timing rules. Do not turn this on as a fallback for an empty live queue without telling players what changed.

**Assisted private play:** Future optional longer timers, rerolls, or decoy removal need a declared assisted ruleset and separate comparable records. Do not sell an advantage inside the launch standard rules. No new public queue merely to add this setting.

**Two-versus-two:** Future real competition is between pairs, not between drawer and guesser. It adds population, fairness, synchronization and collusion problems; not part of the first release.

**More languages:** Localize UI and curate language-specific word banks before pairing those languages. One cross-platform population does not require pairing players who cannot share a game language.

---

## Appendix D. Release gate and external decisions

Keep the following checklist separate from coding completeness. Missing owner inputs do not block unrelated implementation, but cannot be filled in with invented credentials or approvals.

| Gate/input | When actually needed |
|---|---|
| Selected new repository/directory | Before implementation, not before writing this plan |
| Available Spark model and compatible local tooling | Phase 1 |
| Authorized Windows/Android build and device-test environments | Phase 2 |
| Development Supabase/Auth configuration and test PostgreSQL | Phase 3 |
| Final account linking/recovery and deletion behavior | Before public accounts |
| Intended audience, privacy/terms and evidence retention approval | Before public testing/access |
| Reviewed original content and authorized moderator/operator | Closed beta and public launch |
| Approved hosting provider, capacity/budget and secrets | Phase 4 staging/production work |
| Final title, app IDs, licensed assets and support contacts | Before store submission |
| Signing material, publisher access and any enabled billing/ad configuration | Phase 6 |
| Security/reward integrity, native cross-play and recovery evidence | Before public enablement |
| Store review and explicit owner upload/publish approval | Actual release |
| Mac/Xcode and Apple developer/distribution preparation | Future iOS phase only |

No game runtime depends on a Codex model or an AI API. Spark and any stronger review model are development tools, not a per-guess server cost. Do not add paid AI recognition or AI opponents to the game without a separate feature decision.

---
