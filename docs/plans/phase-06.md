# Phase 6 execution brief

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

## Phase 6: Prepare Android and Steam distribution, then release under approval

**Outcome:** Reproducible store-appropriate builds and operational checklists are ready. Android and Windows remain attached to one production backend. The Android release and eventual Steam release may occur at different times without splitting the player pool.

**Executor:** Spark for predictable packaging, integration scaffolding, tests, and documentation. Owner controls identifiers, credentials, policies, commercial choices, hosting costs, uploads, and publishing. Sensitive store/payment code gets a narrow review.  
**Required reading:** All release gates and measured results; current store/SDK documentation for features actually enabled.  
**External prerequisites:** Final branding/app IDs, publisher accounts, signing materials, approved policies, production endpoint and monitoring. Missing credentials must be reported, never invented.

### Complete internal work, without separate permission prompts

**A. Finalize platform-specific distributions without forking the game.** Android: release signing through protected environment/CI secrets, version codes, application bundle, icons/splash, network/lifecycle settings, runtime permissions actually needed, and a tested upgrade path preserving the linked account. Recheck current Google Play target API, testing and declaration requirements at submission instead of hard-coding today's values in this long-lived plan.

Windows: a clean packaged runtime, correct launch executable, bundled assets, version/resources, writable user-data location, logs, uninstall/update behavior as applicable, and a Steam depot-ready folder/build configuration. Avoid requiring the player to install Node or start a development web server. For Steam distribution, let Steam own the game-file update route rather than running an independent Electron updater on those files.

Steamworks upload tooling is required for its content-upload workflow, while broader SDK features are optional. Optional achievements/Steam identity integration must sit behind the platform adapter and not become required for Android participation. No Steam-only public lobby replaces the universal queue. [S16]

**B. Prepare the store and privacy material.** Final store descriptions, screenshots from actual builds, supported inputs, online requirement, cross-play statement, audience/content declarations, privacy/account deletion/support links, and documented data flows/SDK inventory. Claim only tested platforms; do not advertise Steam Deck/controller support or iOS just because Windows/Android work. Verify originality and licensing of names, fonts, artwork, sounds, and third-party code. Store acceptance remains a review outcome, not a promise made by the build script.

**C. Keep monetization fair and platform-appropriate.** The safe initial product already has gameplay-earned coins and cosmetics. Commercial pricing and whether to enable optional Android ads are owner decisions; the game must remain testable without them.

Steam does not support advertising-based gameplay monetization or rewards for watching ads. The Steam build therefore contains no AdMob/banner/interstitial/rewarded-ad flow, no “watch an ad” menu, and no dependency on an Android ad reward to progress. Use an approved upfront purchase or optional store-compliant cosmetics instead. [S17]

If Android ads are explicitly enabled, use Google's current test units and privacy setup during development. Prefer outside-session placement at completed-match breaks; never between live turns, during a countdown, or while one partner is waiting in an active game. Google recommends interstitials at natural transitions, and its UMP documentation supplies the consent/privacy integration path. [S18][S19]

Do not grant extra game time, score multipliers, revealed letters, easier prompts, or erased failures for payments or ad views. Do not sell earned gameplay streaks. An Android-only ad-free entitlement does not change matchmaking or scoring. Keep gameplay coins separate from any future promotional reward source and audit store compatibility before sharing paid/promotional entitlements across platforms.

For any account-stored rewarded-ad benefit, use supported server-side verification and unique provider transaction IDs as an additional anti-forgery measure. Do not credit a durable reward merely because client JavaScript said an ad completed. [S20]

If real-money purchases are enabled, implement provider-specific verification, idempotent grants, refund/reversal handling, and restore behavior. Verify current billing and cross-platform entitlement policy for each store. Do not put a generic external checkout in all builds or assume Steam receipts buy Android app access. A paid currency market is not needed for this launch.

**D. Prevent native SDK callbacks from controlling the game indefinitely.** Ad/purchase bridges have explicit unavailable, loading, presenting, completed, cancelled, and failed states. A result is saved before offering optional advertising. Fullscreen ad activity must finish before the user is marked ready for a new live session. Test late callbacks after a watchdog, duplicate callbacks, app background/restart, no network, and consent changes. A timeout alone does not cancel an already requested native ad. If state is uncertain, recover to a usable nonplaying screen and disable further attempts until safely reconciled; do not secretly start the shared timer behind an ad.

**E. Rehearse release and rollback.** Produce build checksums and exact versions, upload to authorized internal/private testing tracks only when requested, complete a mixed-platform production-config smoke test, confirm support/moderation staffing, monitor initial load, and document rollback/maintenance. Enable public matchmaking only after required safety and integrity gates pass. Release Android and Steam independently when approved, using the same compatible backend and account namespace.

### Required verification

Store-target build checks; no test credentials; no debug auth; no local test server URLs; Steam ad-path absence; Android test-versus-production ad separation when used; permission/data-flow inventory; signed release configuration; upgrade/reinstall/account recovery; actual cross-platform production-config session; version compatibility; and operational rollback.

If ads/purchases are not enabled, tests must confirm that their UI and code paths are unavailable, rather than marking nonexistent SDK integrations tested. Feature-disabled is different from feature-implemented.

### Definition of done

Release artifacts and supporting material exist, all relevant gates are satisfied or explicitly blocked on publisher action, and the owner has a precise checklist for the requested distribution. A Steam-ready Windows build may be finished well before the Steam store page is public. Publishing occurs only after explicit owner authorization and store review.

### Explicitly out of scope

Automatic paid-resource creation, unrequested uploads/PRs/publishing, iOS launch, new game modes, platform-exclusive gameplay boosts, intrusive live-match advertising, or guaranteed store approval.

### Escalation signal

Signing/provider integration problems that remain after reproducible checks, receipt validation/entitlement ambiguity, or a policy conflict. Request the relevant focused technical or policy review rather than guessing a bypass.

---
