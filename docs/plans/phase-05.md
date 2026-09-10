# Phase 5 execution brief

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

## Phase 5: Harden the game and produce a release candidate

**Outcome:** The important invariants survive hostile inputs, retries, disconnects, concurrency, real device variation, and rolling client releases. The code has focused independent review before strangers or money depend on it.

**Executor:** Request a stronger model for bounded review/diagnosis where warranted; keep Spark implementing clear fixes and tests. Do not hand over the entire project for a speculative rewrite.  
**Required reading:** Threat/authority boundaries, data transactions, test matrix, phase statuses, measured device/load results, and focused diffs.  
**External prerequisites:** A working staging environment and authorized test targets. Native gates must be satisfied or explicitly remain blocked.

### Complete internal work, without separate permission prompts

**A. Audit the four expensive-to-get-wrong seams.** Review private prompt delivery/client bundles; account/admission/permission checks; transactional wallets/streak/account linking; and cross-platform protocol/reconnect/order behavior. Review Electron preload/IPC/native privileges as a separate client trust boundary. Give reviewers architecture/invariants, exact files, actual tests, and unresolved evidence, not an invitation to redesign everything.

Record severity, reproduction, affected platforms, recommended patch, and missing tests. No generic “looks good” acceptance without inspecting the relevant code path. Avoid absolute “secure” or “cheat-proof” language.

**B. Add adversarial and race tests.** Invalid/oversized JSON, invalid numeric values, forged actor IDs, guessed room IDs, unauthorized private joins, reused choices, reused tiles, stale epochs/turn IDs, wrong roles, excessive guessing/strokes, server deadline boundary, two correct guesses, guess versus timeout, repeated pass, reconnect versus leave, queue cancel versus admission, and reward commit versus response loss. Keep tests bounded and only target owned development/staging systems.

**C. Exercise persistence and operations under failure.** Kill a room process during an unresolved turn, interrupt after commit, stop the database briefly, repeat a migration in a disposable environment, drain during active sessions, restore backups, and restart after a lost client acknowledgement. Confirm no fabricated session completion, unilateral coin credits, duplicate streak increments, or negative wallets. Do not test destructive migrations against production data.

**D. Profile real supported products.** Record input/render/network behavior on the reference Android phone plus a less powerful device/emulator where suitable, and the packaged Windows build at different scaling/window sizes. Identify any render-loop allocations, React update storms, unbounded stroke history, listener leaks, or database calls on every point. Optimize from measurements. Keep a soak test of repeatedly created/destroyed rooms and document actual sample sizes and limitations.

**E. Verify upgrade compatibility and release configuration.** Current Windows/current Android and staggered supported versions; unsupported clients before queue; account reuse across wrappers; no dev auth/test clock/test award API; production asset boundaries; TLS validation; private evidence; config drift; and clear maintenance/outage screens. Freeze release candidate versions and known issues.

### Required verification

`verify --phase 5` must incorporate the full applicable automated suite and require evidence references for actual native cross-play, account/ledger audit, safety operations, and restore tests. It must fail the public-release readiness gate when any critical requirement is only mocked or untested. Large load tests need an explicit target, concurrency cap, duration, and resource monitoring.

### Definition of done

No known unresolved critical account, reward-integrity, private-data, or public-safety defects. Important user flows have real cross-device evidence. Remaining noncritical issues have documented impact, workaround, and owner acceptance. The release candidate is not marked published; that is a different authorization.

### Explicitly out of scope

Rewriting stable modules to match reviewer taste, new feature requests, uncapped stress tests, claiming perfect detection of voice-call collusion, or accepting disabled security checks as a performance optimization.

### Escalation signal

This phase is already the appropriate place for deeper diagnosis. Still isolate each problem, use the least expensive capable model, and return bounded fixes to Spark instead of keeping the stronger model on every follow-up edit.

---
