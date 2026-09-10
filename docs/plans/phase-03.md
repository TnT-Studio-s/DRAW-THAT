# Phase 3 execution brief

This is the full macro-phase, not a single internal task. Read the applicable specs below and finish its substantial outcome. The [master plan](MASTER_PLAN.md) controls any ambiguity. Source labels resolve in [source notes](../specs/10_sources.md).

## Focused reading map

- [Specification 0: product decisions](../specs/00_product_decisions.md)
- [Specification 1: gameplay](../specs/01_gameplay.md)
- [Specification 2: architecture crossplay](../specs/02_architecture_crossplay.md)
- [Specification 3: protocol security recovery](../specs/03_protocol_security_recovery.md)
- [Specification 4: accounts persistence](../specs/04_accounts_persistence.md)
- [Specification 5: repo commands](../specs/05_repo_commands.md)
- [Specification 6: headless testing](../specs/06_headless_testing.md)
- [Specification 7: spark workflow](../specs/07_spark_workflow.md)
- [Acceptance IDs](../specs/08_acceptance_matrix.md), plus current STATUS/HANDOFF/TEST_MATRIX.

After the first orientation, reread only relevant sections and changed modules. Do not consume context by reloading the whole master after every patch.

## Phase 3: Add persistent accounts, progression, and player safety

**Outcome:** Real players can recover an account, use it on Windows or Android, keep their earned coins and duo records, spend coins on cosmetic items, and report/block unwanted partners. This is a complete persistent game layer, not just a login screen.

**Executor:** Spark implements the specified flows. Authentication, reward transactions, and account-linking boundaries receive a narrow review before public deployment; request a stronger diagnosis only for a concrete blocker.  
**Required reading:** Sections 2-8 and verified prior-phase evidence.  
**External prerequisites:** An approved development Supabase project or supported local auth environment, test PostgreSQL, and configuration supplied through secrets rather than chat/source files. Missing credentials block live-provider verification, not unrelated UI/schema/test work.

### Complete internal work, without separate permission prompts

**A. Replace disposable identities with recoverable accounts.** Implement Supabase anonymous sign-in, terms acceptance, email-code account upgrade/login, account/profile screens, sign-out, and a documented new-device flow. Verify server JWTs and account status. Keep development auth behind strict local/test environment validation, and add a release check that fails if it is enabled. Use a canonical internal player ID across stores. Reject duplicate active game sessions or offer a clear explicit takeover flow that invalidates the old connection epoch.

**B. Introduce durable, transactional game data.** Add PostgreSQL migrations, SQL repositories, player mappings, sessions/turns, duo records, wallets and ledger. Replace the Phase 1 in-memory adapter through its interface, not by spreading SQL throughout client/room code. Commit both player rewards and the duo change together, then publish the result. Test duplicate submissions, two callbacks resolving concurrently, server disconnect after commit, retry with an unknown transaction outcome, and process restart. Never credit only one member of a successful pair.

**C. Finish visible progression.** Add persistent wallet, lifetime progress, duo current/best streak, previous sessions, recent partners, optional profile level, and the earn-only cosmetic catalog. Implement preview, purchase confirmation, insufficient-balance handling, duplicate-safe purchase, ownership/equip, and cross-device refresh. Recent-partner invitations are explicit and respect blocks; do not reveal private room codes or turn histories to unrelated accounts. Do not add a public “best player” leaderboard.

**D. Build actual safety interactions.** Implement report and block from active game and results, immediate hide-drawing/leave, enumerated report reasons, server authorization, restricted report storage, and block checks in both directions for public pairing and codes. Use preset avatars/generated names initially; any editable name is length-limited, validated, and reportable. An ordinary player cannot read the moderation queue. Start a minimal authorized staff review interface or CLI so reports are not a dead-end mailbox; the full workflow is Phase 4.

**E. Add account/data controls and honest states.** Account deletion request, recovery/linking help, offline cache presentation, wallet syncing indicator, unavailable backend state, expiry/re-login behavior, and end-to-end new-device tests. Declare alpha data reset rules. Do not merge unrelated account balances automatically when someone signs into an already-existing identity. Provide a safe, logged support path for genuine conflicts instead of inventing account ownership from a display name.

### Files/modules in scope

Server auth/persistence/account/moderation modules; migrations; profile, wallet, shop, account and safety screens; secure credential adapters; tests and operator documentation. No real-money shop or AdMob is required here.

### Required verification

All prior applicable tests plus real PostgreSQL integration, provider-auth integration where credentials are available, stale/forged token rejection, idempotent ledger/purchase tests, account linking/new-device access, bidirectional block checks, report permissions, and release rejection of dev auth.

| Check | Required result |
|---|---|
| Linked identity on Windows and Android | Same persistent wallet and duo history, not duplicate unrelated accounts |
| Duplicate or concurrent winning submissions | One committed result, two equal credits, one streak increment |
| Commit succeeded but reply was lost | Retrying retrieves the outcome without awarding again |
| Failed reward transaction | No partial credit to one partner; honest failure/reconciliation |
| Two concurrent cosmetic purchases | No negative wallet or double charge/grant |
| Client modifies displayed coins | Server balance unchanged |
| User guesses another account ID | No access to its wallet, inventory mutation, or private history |
| Block in either direction | No public pair or new private admission between those users |
| Report during a game | Drawing can be hidden immediately and report reaches restricted review |
| Auth upgrade/logout/expiry | No silent wallet loss or duplicate account merge |
| Production config with dev auth | Build/startup fails clearly rather than exposing test login |

### Definition of done

Progress survives client and server restarts. Both platforms can access a linked game identity, with documented and tested wallet/streak semantics. Cosmetic purchases are fully transactional. Reporting/blocking work end-to-end in the closed test environment. No claim of public readiness is made solely because login and database writes work.

### Explicitly out of scope

Paid currency, peer transfers, gifting, tradable items, cash prizes, automated account-merging heuristics, public rankings, Steam-only authentication, or adding platform-specific progression bonuses.

### Escalation signal

Any unexplained duplicate/missing reward, account-takeover possibility, insecure credential storage dependency, auth/provider mismatch, or migration that could destroy real data. Pause that area, preserve a minimal reproduction, and request the narrowest review needed.

---
