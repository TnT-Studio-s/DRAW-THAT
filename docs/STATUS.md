# Implementation status

## Mixed-platform checkpoint - 2026-09-12

Private Android-to-Windows invite creation and joining are physically confirmed. A stale React session closure that discarded remote `drawEvent` messages was repaired, and `tests/e2e/live-drawing.spec.ts` now passes through first-direction drawing, a failed turn, role alternation, and reverse-direction drawing with remote canvas pixel assertions.

The installed Samsung S25 Ultra exposed a separate Android lifecycle blocker: an edge-swipe drawing gesture was handled as predictive Back and finished the single activity without a Java/WebView crash. Two bounded native interception attempts compiled but failed the same active-room ADB acceptance check, so they were removed. This item is isolated in `REVIEW_PACKET.md`; full packaged mixed-platform acceptance remains `IN_PROGRESS`, not verified.

Plan version: 2.0, September 9, 2026.

Phase 1 implementation is complete for the headless web/server playable outcome. Native Windows/Android/iOS packaging and device gates remain outside this phase.

| Phase | Status | Evidence |
|---|---|---|
| 1: Complete playable foundation | CODE_COMPLETE_DEVICE_PENDING | `node scripts/verify.js --phase=1` passed with exit code 0; headless two-browser eight-turn e2e passed |
| 2: Windows + Android cross-play | IN_PROGRESS | Windows/Android artifacts and authorized Android smoke pass; packaged mixed-platform session remains open |
| 3: Persistent player game | IN_PROGRESS | Local account, progression, safety, idempotent reward tests, and session persistence wiring pass; live DB/provider gates remain open |
| 4: Closed-beta product and operations | IN_PROGRESS | Internal code slice is complete; database, staging, approved content, staff exercise, and closed-beta gates remain |
| 5: Hardening/release candidate | IN_PROGRESS | Authoritative protocol and room hardening has targeted adversarial coverage; persistence, native, and release evidence remain open |
| 6: Distribution/release | IN_PROGRESS | Reproducible packaging and release gates are implemented; production identifiers, endpoints, signing, publisher action, and native release evidence remain blocked on owner inputs |

## Current work

Active phase: Phase 6 distribution preparation is in progress after the Phase 5 hardening and review-repair slices. Database/provider verification, packaged mixed-platform acceptance, and release approval remain explicitly deferred.
Actual implementation repository: `C:\Users\antho\Sync Develop Codex\Draw That`; branch/commit tracking is not configured in this workspace.
Actual model/status: Spark was the requested implementation model and exhausted its usage; no stronger-model subagent or model switch was used. A callable session-status source was not available to independently confirm the UI model label.
Implemented evidence: real Colyseus room, private friend-code flow, private 1/2/3 choices, server timers, live strokes, letter tiles, equal solved-turn coins, shared streak, eight alternating turns, results, rematch reset, headless two-browser e2e.
Next action: obtain owner/reviewer content and staging approvals, then exercise the Phase 4 operations and closed-beta gates. Return to the deferred PostgreSQL/Neon Auth verification when the deployment environment is available; retain the Phase 2 mixed-platform checks as an explicit parallel acceptance item.

## Required reporting states

NOT_STARTED / IN_PROGRESS / BLOCKED / CODE_COMPLETE_DEVICE_PENDING / VERIFIED / RELEASE_APPROVED.

Native cross-platform session evidence: Android APK install/launch smoke PASS; packaged Windows-to-Android gameplay is NOT RUN.
Production identity and transactional reward evidence: Phase 3 local development adapter PASS; live Neon Auth/PostgreSQL evidence NOT RUN.
Public deployment permission: NOT GRANTED.
Store publishing permission: NOT GRANTED.

Verified commands: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:security`, `npm run build:server`, `npm run build:web`, `npm run build:windows`, `npm run build:android:debug`, `npm run build:android:release`, `npm run test:android`, and `npm run test:e2e` all passed on 2026-09-10.
Unit evidence includes the Phase 3 account-store invariants: equal two-player reward, duplicate resolution retry, earned cosmetic purchase, and duplicate-safe purchase retry. E2E evidence includes two independent headless browser contexts joining by friend code, eight alternating turns, a live canvas stroke, results, and rematch.
Known non-blocking install note: npm required `--legacy-peer-deps` and local `file:` workspace links because the original dependency metadata used unsupported `workspace:*` links and an unpublished transport range.
Native/device gate: Android install/launch smoke passed on `SM_S938U`; packaged mixed-platform gameplay and desktop runtime smoke remain open. Public deployment, stores, ads, and payments remain intentionally out of scope.

Headless regression command: `npm run test:headless` runs lint, type checking, unit, integration, security, server/web builds, and the real two-browser Playwright flow without a phone or visible app. `npm run test:headless:native` additionally builds the Windows package and Android debug APK without claiming runtime/device acceptance. Both write `test-results/headless-summary.json` with native gates explicitly marked `not_run`.

## Phase 3 checkpoint - 2026-09-10

The current code slice is complete for local/test-mode account, progression, safety, and durable-session wiring. Production completion is not claimed: real PostgreSQL migration/transaction evidence, Neon Auth provider auth/linking/recovery, profile edit/equip UI, in-game hide/report controls, and authorized moderation review still require implementation or external configuration.

The room now creates a persistent session when the second player joins, records each turn in the same Postgres transaction as both wallet credits and the duo streak update, and closes the session at results/disposal. Configured production persistence also requires a verified bearer token for room admission; development/test identity remains explicitly gated.
## Phase 2 status - 2026-09-10

Phase 2 implementation is complete for the available code paths, and the Android native environment is now working. The phase is `IN_PROGRESS` pending actual packaged Windows-to-Android gameplay, reconnect, and native acceptance evidence. The plan's `CODE_COMPLETE_DEVICE_PENDING` state is no longer applicable because an authorized S25 Ultra is connected and both APK variants build.

Implemented:

- Shared React/TypeScript web client, Electron Windows shell, and Capacitor Android shell use the same runtime configuration and protocol contracts.
- Phase 2 client handshake carries build ID, protocol major, language, platform metadata, and capabilities; unsupported quick-queue clients are rejected before pairing.
- Quick Partner uses one platform-neutral reservation queue with a 30-second reservation window.
- Reconnect handling preserves the authoritative room seat, advances the connection epoch, and sends the current draw bank plus canonical canvas snapshot.
- Windows Squirrel packaging completes at `apps/desktop/out/make`.
- Capacitor Android project is generated and `android:sync` passes.

Evidence:

- The earlier `npm run verify -- --phase=2` correctly reported `blocked` when the SDK was unavailable; direct reruns after connecting the phone passed the Android builds and smoke gate.
- `npm run build:windows` passed.
- `npm run android:sync` passed.
- `npm run build:android:debug` passed and produced the debug APK.
- `npm run build:android:release` passed and produced the release APK.
- `npm run test:android` passed on the authorized Samsung S25 Ultra after ADB install, launch, and active-package checks.
- The full packaged Windows-to-Android session, reconnect matrix, and dedicated desktop runtime gate remain unrun.

## Phase 3 status - 2026-09-10

Phase 3 is `IN_PROGRESS`. The first durable account/progression/safety slice, including the staff-only moderation review boundary, is implemented and covered by local development tests, but real PostgreSQL and Neon Auth provider evidence is still pending. This does not change the separate Phase 2 mixed-platform acceptance status.

Implemented:

- `migrations/001_phase3_accounts.sql` defines players, account links, wallets, append-only ledger, duos, sessions, turns, turn resolutions, cosmetic catalog/ownership, blocks, reports, and moderation audit records.
- `apps/server/src/services/AccountStore.ts` provides a development-only in-memory adapter and a parameterized PostgreSQL adapter with transactional purchase and turn-resolution idempotency primitives.
- `apps/server/src/services/AuthService.ts` accepts verified Neon Auth JWTs when configured and permits the disposable `x-draw-duo-user` identity only in development/test mode.
- Server APIs cover account profile/terms/deletion, cosmetic catalog/purchase, report, block, and unblock flows.
- Room joins hydrate account wallets and turn rewards commit through the account store instead of being awarded only in room memory.
- The shared client displays server-owned wallet/lifetime/streak state, terms acceptance, editable validated display name, and the earn-only cosmetic catalog.
- Active/results sessions expose report, block, and hide-and-leave actions; the server resolves room subject references to canonical player IDs before safety writes.
- Staff-only moderation routes list open/reviewed reports and record a review action plus reason; the Postgres adapter writes the audit action and reviewed status in one transaction.
- Cosmetic ownership is returned as sanitized profile state, with server-validated equip-by-owned-item for both memory and Postgres adapters.
- `/api/account/recover` provides the documented verified-subject recovery entry point; provider upgrade/linking still requires configured Neon Auth and has not been claimed as live evidence.
- Phase 4 adds `/api/ready`, a protected admission drain control, and the staging operations runbook in `docs/OPERATIONS_RUNBOOK.md`; active room logic is not changed by the drain control.
- Phase 4 now records bounded drawing evidence for staff review, extends reported evidence to the draft 30-day window, logs staff evidence access, and purges expired evidence hourly. The SQL migration is prepared but not executed without `DATABASE_URL`.
- Phase 4 product UI now includes first-use gameplay guidance, honest account-sync/offline states, live partner/reconnecting indicators, focus-visible controls, and a Phase 4 beta label without a stale model claim.

Phase 3 evidence:

- `npm run typecheck` passed.
- `npm run test:integration` passed: 4 files and 7 tests, including account, terms, catalog, safety, deletion, readiness, dashboard delivery, drain authorization, moderator authorization, queue, and room flows.
- `npm run test:headless` passed: lint, workspace typechecks, 15 unit tests, 7 integration tests, security, server build, web build, and the browser E2E gate.
- `npm run test:security` passed.
- `npm run test:e2e` passed after the Phase 3 UI addition.
- `npm run db:migrate` correctly stopped without changing the database because `DATABASE_URL` is not configured.

Remaining Phase 3 gates:

- `DATABASE_URL` and a disposable PostgreSQL instance are required for migration and real transaction tests; this is the current Phase 3 blocker.
- Neon Auth project/JWKS/issuer/audience configuration is required for live provider-auth and account-linking tests.
- Provider-backed account linking/upgrade, real new-device recovery, and live operator review evidence remain to be completed. Cosmetic ownership/equip is now wired through the client and server. Safety controls are now wired in the client, and ordinary-player denial of the staff report queue has narrow integration coverage; the dedicated browser interaction test is still pending.

## Model schedule and deferred infrastructure - 2026-09-10

Phase 4 internal implementation is complete aside from the deferred database/provider and human beta gates. Phase 5 is active under the current Luna Max session for bounded review and hardening; changes remain surgical and are covered by targeted tests. Phase 6 remains a later Spark-led packaging and distribution phase, with narrow review for sensitive store/payment code.

The owner chose to defer PostgreSQL migration and live Neon Auth acceptance temporarily. `DATABASE_URL`, PostgreSQL migration/transaction evidence, and live Neon Auth provider-auth/linking/recovery evidence remain open gates and must not be reported as passed. This does not prevent Phase 5 code hardening from continuing in the disposable development/test adapter.

## Phase 5 status - 2026-09-10

Phase 5 hardening is `IN_PROGRESS`. The first internal slice covers the authoritative protocol and room boundary without claiming database, native, or packaged release evidence.

Implemented:

- Protocol message IDs, turn IDs, choice IDs, epochs, generations, timestamps, coordinates, pressures, colors, and tile selections now have explicit bounds and finite/integer validation where required.
- Production room admission requires verified identity outside development/test mode even when the deferred database adapter is not configured; disposable identities remain local/test-only.
- Server stroke handling enforces approved brush styles, board bounds, payload size, 20-batch-per-second rate limiting, 12,000 points per turn, and 512 accepted strokes per turn.
- Undo and clear reduce or reset the accepted point budget, while duplicate action IDs are bounded and deduplicated.
- Selection and drawing deadline races now resolve through the server timeout policy; a pass or guess arriving at or after the deadline cannot win the turn.
- Stale guess/pass connection epochs now return `stale_action`, and stale canvas generations remain rejected after clear/reconnect boundaries.
- The web client ignores recovery snapshots older than its current canvas generation, preventing delayed snapshots from resurrecting cleared strokes.
- Electron now derives its CSP `connect-src` allowlist from the configured backend HTTP/WS origins instead of hard-coding localhost; invalid backend protocols fail closed, and the bridge/isolation boundary has headless security coverage.
- Persistence failure broadcasts the effective `annulled` outcome rather than the original requested success outcome.

Evidence:

- `npx vitest run tests/security/phase-five.spec.ts` passed: 2 real two-client adversarial tests.
- `npm run typecheck` passed across all workspaces after the hardening patch.
- `npm run test:headless` passed after the hardening patch: lint, workspace typechecks, 15 unit tests, 7 integration tests, 5 security tests, server/web builds, and browser E2E. Device, Electron runtime, mixed-platform, and visual gates remain not run.

Remaining Phase 5 gates:

- Real PostgreSQL duplicate-resolution, crash-after-commit, retry, migration-repeat, and backup/restore tests require the deferred database.
- Native reconnect, packaged Windows-to-Android gameplay, Electron runtime, and measured device/load evidence remain not run.
- The full release-candidate audit, supported-version compatibility pass, and owner-approved closed-beta evidence remain open.

## Review repair pass - 2026-09-10

The verified review findings have been repaired without replacing the existing architecture. The drawer now receives the selected answer privately; guesses preserve the player's selected tile order; prompt IDs do not repeat until the available pool is exhausted; production randomness is cryptographic; and the board includes opaque tile IDs plus decoys. Canvas traffic now uses a canonical 0..65535 coordinate space, timers advance from server timestamps, Android/desktop builds have runtime backend endpoint seams, and the client no longer embeds a static production access token.

Private rooms now require the issued friend code at socket admission, release the code only after both players are seated, and enforce private-owner/block checks. Waiting, readiness, disconnect, results expiry, rematch, and session-finalization paths now terminate or restart honestly. Every rematch receives a new durable session ID; abandoned and server-error sessions are not counted as completed; the initial drawer is randomized; and session results expose the equal per-player coin total.

Persistence code now scopes idempotency to each player, prevents repeat-owned purchases from debiting the wallet, commits equip transactions before returning profile state, protects turn history from overwrite, and derives duo streak from the specific player pair and rules version. Public room state no longer exposes the partner wallet or provider subject. Reviewed `remove_content` moderation deletes retained evidence; the previously offered but unimplemented `warn` action was removed.

Verification evidence: `npm run typecheck` passed. `npm run test:security` passed 5 tests. The final `npm run test:headless` passed lint, all workspace typechecks, 15 unit tests, 7 integration tests, 5 security tests, server/web builds, and the eight-turn browser E2E. Expected Colyseus warnings are generated when tests intentionally reject unauthorized admission or do not register irrelevant message listeners.

Deferred external gates remain unchanged: live PostgreSQL migrations/concurrency/recovery and a database-backed one-active-session constraint; Neon Auth JWT/account-linking; owner-approved production content; Electron/native mixed-platform gameplay; measured load; staging; and closed beta. The review item claiming guess/pass action IDs were not recorded was re-checked and withdrawn because the existing `wasSeen` path already records accepted action IDs.

## Phase 6 status - 2026-09-10

Phase 6 internal implementation is `IN_PROGRESS`. The repository now has release-aware Windows packaging, protected Android release configuration, Steam depot-folder packaging, checksum/manifest generation, release artifact checks, disabled monetization checks, store/privacy/data-flow templates, and rollback documentation. No store upload or public enablement was performed.

Implemented:

- `npm run build:windows` produces the Windows test Squirrel artifact with generated runtime backend configuration and bundled web assets.
- `npm run build:windows:release` requires HTTPS/WSS production endpoints and packages runtime configuration instead of silently embedding localhost.
- `npm run build:steam` uses Electron Forge's unpacked `package` path for a Steam depot-ready Windows folder and does not add an independent Electron updater.
- `npm run build:android:debug` produces an explicit debug APK path.
- `npm run build:android:release` uses `bundleRelease` and requires protected keystore variables, production HTTPS/WSS endpoints, and a real keystore. It does not fall back to an unsigned or local release.
- The production web bundle no longer includes the development `x-draw-duo-user` identity header; that header is development-only and bearer access tokens are used for configured accounts.
- Monetization remains absent and disabled. There is no AdMob, billing, rewarded-ad, watch-an-ad, or paid gameplay path in the current client/native dependencies.
- `npm run release:manifest` creates SHA-256 checksums and exact artifact metadata only from built release-shaped artifacts.
- `npm run release:check` blocks until production endpoints, a signed Android AAB, final application identity, and required release artifacts exist.
- `docs/STORE_METADATA.md`, `docs/PRIVACY_DATA_FLOW.md`, `docs/ROLLBACK_RUNBOOK.md`, and `release/steam/app_build.vdf.template` provide owner-ready release material without inventing branding, policies, IDs, credentials, or publisher data.

Phase 6 evidence:

- `npm run test:packaging` passed 3 packaging contract tests.
- `npm run test:headless` passed lint, all workspace typechecks, 15 unit tests, 7 integration tests, 5 security tests, 3 packaging tests, server/web builds, and the eight-turn browser E2E.
- With `ANDROID_HOME=C:\Users\antho\AppData\Local\Android\Sdk`, `npm run test:headless:native` passed the same suite plus Windows Squirrel packaging, Capacitor Android sync, and Android debug APK generation.
- `npm run build:android:release` correctly blocked because production endpoint and signing variables are absent.
- `npm run build:windows:release` correctly blocked because the configured endpoint is not a production HTTPS endpoint.
- `npm run release:check` correctly reported the missing production endpoints, signed AAB, and final Android application ID.

Remaining Phase 6 gates:

- Owner must provide final Android application ID, branding/assets/licensing approvals, production backend endpoints, signing material, privacy/support/account-deletion URLs, and publisher/store access.
- A signed Android AAB, production-config Windows/Steam package, upgrade/reinstall/account-recovery run, and checksum manifest remain to be produced after those inputs exist.
- Electron runtime, installed Android lifecycle/reconnect, packaged Windows-to-Android gameplay, production-config compatibility, staging rollback, monitoring, and store review remain not run.
- No monetization is enabled. If ads or real-money purchases are later requested, they require a separate provider-specific implementation and review; they must not be inferred from the current disabled state.

## Portrait game UI redesign - 2026-09-10

The first owner-directed visual pass is implemented in the shared React client. Connected play now uses a portrait-only bright-blue game shell with a compact points/timer/settings HUD, a dominant white drawing canvas, shared hangman-style word boxes, and role-specific bottom controls. The guesser types through a compact QWERTY keyboard with Backspace, Enter, and Pass; wrong submissions remain visible for a red shake and `Try again` response before clearing. The drawer sees the private answer in the same word tray and receives an arrow-cycled color palette with brush, eraser, size, undo, and clear controls. Solved turns display green bouncing letters and a centered points/total/streak celebration.

Android now declares portrait orientation. Coarse-pointer web clients receive a rotate-to-portrait guard in short landscape viewports. The existing server protocol, private prompt boundary, finite letter inventory, friend codes, timers, scoring, turns, results, rematch, account, and safety actions were preserved. No visual/native/browser test was run for this checkpoint; responsive layout, touch comfort, animation timing, and packaged-device appearance remain unverified until the owner requests the validation pass.

The drawing canvas now carries a glossy, rounded countdown bar across its upper edge. It drains smoothly from the server-authoritative 60-second drawing countdown, retains a numeric seconds bubble, and changes to a pulsing fire-engine-red treatment for the final ten seconds. The timer is overlaid so it does not reduce the drawable area's layout allocation. This addition remains visually and behaviorally unverified at this checkpoint.

## Earned reward store - 2026-09-10

The earn-only cosmetic store now uses persistent personal coins rather than the per-session team score. New accounts own Red, Green, Blue, Medium brush, plain name font, and plain nameplate by default. The catalog adds purchasable drawing/name colors, Very Small/Small/Large/Extra Large brushes, three playful name fonts, and three decorative nameplate borders. One purchased color can be equipped independently for drawing or name text. The server validates that stroke colors and brush widths are owned, and room state publishes only known equipped catalog IDs plus the display name for partner nameplates.

Store buttons are present on the lobby and in-match HUD. A shared overlay supports unlock and equip actions, balance display, previews, and live room profile refresh. An additive `002_reward_store.sql` migration prepares catalog values, starter ownership, and slot-based loadouts without pretending the deferred PostgreSQL database was run. Memory-adapter purchases still reset when the server restarts. No typecheck, tests, browser inspection, database migration, or device build was run for this checkpoint.
