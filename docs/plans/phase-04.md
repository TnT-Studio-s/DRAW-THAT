# Phase 4 execution brief

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

## Phase 4: Complete the closed-beta product and its operations

**Outcome:** The game is coherent and enjoyable to test, content can be maintained, reports can be reviewed, and an approved staging backend can be operated. This phase completes the product around the core rather than merely decorating it.

**Executor:** Spark-led implementation, with human content/playability review and approved hosting/account work.  
**Required reading:** All active specifications plus the prior-phase test matrix and unresolved review packets.  
**External prerequisites:** Approved staging hosting/auth/database configuration and designated content/moderation reviewers. Do not create paid resources or open public matchmaking without authorization.

### Complete internal work, without separate permission prompts

**A. Finish product-quality screens and feedback.** Consistent home/lobby/game/results/profile/shop/settings design; first-time explanation of equal coins and streaks; examples of tile use; readable timer/warnings; input focus and keyboard accessibility; sound/mute/reduced-motion; reachable Continue/Leave/Rematch; sensible loading/empty/error states; and responsive resizing. Add clear partner-connected/guessing indicators without exposing wrong guesses. Validate large system text, small Android screens, Windows display scaling, and fullscreen exit. No visible button may depend on a screen geometry assumption that hides it.

**B. Build content authoring and review.** Add a validator/importer, review status, word enable/disable, difficulty/category editing, versioned publication, and a server-only content bundle. Reject duplicate normalized answers, unsupported characters, invalid lengths, missing difficulty tiers, unsuitable terms, and known ambiguous entries. Generate original candidate words, then mark them for review rather than labeling automatic generation human-approved. Expand from 90 seeds toward at least 300 approved beta prompts and a target of 900 reviewed release prompts. A different release count needs a recorded owner decision; content-review availability is not something Spark can fabricate.

Review for recognizability, culture/language familiarity, visual drawability, ambiguity, and reasonable difficulty. Hard means a familiar concept that requires communication, not obscure trivia or a tedious phrase to type. Track selection rate, conditional solve rate, time, pass/abandonment and repetition. Those data are biased by prompt choice; do not auto-promote/demote difficulty from tiny samples.

**C. Complete moderation and privacy operations.** Add a restricted staff dashboard for report triage, bounded canvas replay/evidence, content removal, warnings/suspensions with audit, and appeal/support handling. Staff privileges come from server-verified roles, never a client `isAdmin` flag. Keep report evidence access logged and limited. Set explicit retention and deletion jobs, plus a test proving unreported/report evidence expires according to configuration.

A proposed starting evidence policy is restricted short-term storage of completed session drawing commands for up to 24 hours for post-session reports, and reported evidence for up to 30 days pending review. These are draft product limits, not legal advice or a requirement to keep all drawings. Approve the policy, explain it to testers, constrain storage, and revise before real public data. Do not retain token-bearing traces or publish canvases by default.

Google Play treats content visible to other users as UGC and imposes moderation/reporting/blocking responsibilities. Actual review operations are required, not just icons. Decide the intended audience before launch; including children creates additional policy/privacy work. Do not treat a simple “13+” label as a complete decision. [S14][S15]

**D. Build repeatable staging operations.** Containerize the server, configure HTTPS/WSS, secrets, health/readiness checks, migration execution, structured logs, application metrics, graceful room draining, backup/restore, and a deployment rollback runbook. Use one shared endpoint for Windows and Android staging. Keep development, staging, and production identities/data isolated without splitting the eventual production platform population.

Set budget alerts and retention limits for logs/evidence. Measure room CPU/memory and bytes per turn before selecting instance size or promising concurrent capacity. Avoid hosts/configurations that unexpectedly suspend active room processes. Do not run a multiplayer timer in a short-lived request handler.

**E. Run a closed cross-platform beta and improve the actual friction.** Exercise random pairing among authorized testers, invite codes, repeated rematches, account recovery, normal disconnects, long sessions, drawing on a modest Android device, and large Windows displays. Collect structured feedback on drawing feel, tile ambiguity, timer pressure, repetition, and whether both partners understand their rewards. Improve observed problems within the same phase. Preserve the one public-mode design rather than introducing extra queues to hide balance issues.

### Files/modules in scope

Shared UI/UX, content tools/data, admin app and authorized APIs, evidence storage adapter/retention, infrastructure/runbooks, diagnostics, integration/device tests, and configuration tuning supported by playtests.

### Required verification

Prior test suites; authorized report review and denial tests; retention deletion; content import/version pinning; backup/restore exercise; server health/drain/rollback checks; repeated cross-platform sessions; current and supported-older client pairing; measured performance logs. Store secrets and admin credentials must not appear in any client bundle or downloaded test report.

### Definition of done

A designated operator can maintain content, handle a report, suspend an abusive account, roll back the staging service, and restore persistent data using the runbooks. Testers can play on both platforms with no unexplained state-loss or inaccessible controls. Content counts and review status are real. All remaining public-release risks are visible in `RELEASE_CHECKLIST.md`.

### Explicitly out of scope

Unlimited regions, new public game modes, social feed, public gallery, live voice/text chat, blind trust in an AI content classifier, store publishing, or a claim of proven product-market fit.

### Escalation signal

Measured frame/input problems not fixed by a bounded drawing/UI change, unclear data retention/permissions, moderation bypass, infrastructure that cannot support long-lived rooms, or repeated platform compatibility failures.

---
