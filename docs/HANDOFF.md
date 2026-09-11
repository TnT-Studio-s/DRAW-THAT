# Resume handoff

## Current state

Phase 1 implementation is complete for the web/server playable outcome. The authoritative room and protocol flow is implemented; native packaging/device validation is intentionally still pending.

## Update this section at each meaningful checkpoint

Active phase: Phase 6 distribution preparation in progress; code and test-build packaging are implemented, while production release configuration and packaged mixed-platform acceptance remain open.
Actual model/status: Spark implementation session exhausted usage; no stronger-model subagent or model switch was used. Callable runtime status was unavailable for independent confirmation.
Repository / branch / commit: `C:\Users\antho\Sync Develop Codex\Draw That`; branch/commit tracking is not configured.
Implemented and tested modules: `apps/server/src/rooms/DrawDuoRoom.ts`, friend-code routes/registry, React Canvas client, protocol validation, timers, choices, strokes, tiles, rewards/streaks, eight turns, results/rematch, unit/integration/security/e2e/build scripts.
Unfinished modules: native Windows/Android/iOS packaging and device sessions; persistence, auth, production identity, payments, ads, deployment and later phases.
Exact last commands and results: `npm run test:headless` passed; with `ANDROID_HOME=C:\Users\antho\AppData\Local\Android\Sdk`, `npm run test:headless:native` passed including Windows Squirrel packaging, Android sync, and Android debug APK generation. `npm run build:android:release`, `npm run build:windows:release`, and `npm run release:check` correctly blocked on missing production endpoint/signing/owner inputs.
Failing test and minimal error excerpt: none in the executed Phase 3 checks. PostgreSQL/Supabase checks were not run because the required external configuration is not present; `npm run db:migrate` correctly refuses to run without `DATABASE_URL`.
Relevant paths to read next: `docs/plans/phase-06.md`, `docs/RELEASE_CHECKLIST.md`, `docs/STORE_METADATA.md`, `docs/PRIVACY_DATA_FLOW.md`, and `docs/ROLLBACK_RUNBOOK.md`.
Next concrete action / command: provide owner-approved release inputs, then run `$env:DRAW_DUO_BACKEND_HTTP_URL = "https://..."; $env:DRAW_DUO_BACKEND_WS_URL = "wss://..."; $env:DRAW_DUO_ANDROID_KEYSTORE_PATH = "..."; npm run build:android:release; npm run build:steam; npm run release:manifest; npm run release:check`. Keep PostgreSQL/Supabase configuration and packaged Windows-to-Android gameplay as separate external gates.
External prerequisite or native-device gate: Android debug/release APKs build and `test:android` passes on authorized `SM_S938U`; do not report the packaged Windows-to-Android session or N01-N06 as fully passed.

## Portrait game UI continuation - 2026-09-10

The shared React client has the owner-approved first portrait game-screen design in `apps/web/src/App.tsx` and `apps/web/src/styles.css`; Android portrait locking is in `apps/mobile/android/app/src/main/AndroidManifest.xml`. The in-match structure is HUD, maximum-fit white canvas, shared word tray, then a role-specific keyboard/palette dock. Guesser input still selects server-issued opaque tile IDs from the finite bank, now exposed through QWERTY keys, so repeated-letter inventory and decoy behavior remain authoritative. Wrong guesses shake red for 650 ms before clearing. The drawer's private answer fills the same boxes without exposing it to the guesser.

This checkpoint was intentionally not validated. Before treating the redesign as accepted, run `npm run typecheck` and `npm run test:e2e`, then inspect one portrait phone-sized browser viewport and the Android build when the device is available. Preserve the existing Playwright selectors: invite controls, `choice-*`, `draw-canvas`, visible `Draw: ...`, exact `Ready`, `Pass`, `Session complete.`, and `Rematch` remain present.

The canvas now includes a glossy rounded countdown overlay driven by the same extrapolated server `remainingMs` value as the numeric HUD. The production drawing window is 60 seconds; at ten seconds or less, the bar and seconds bubble switch to fire-engine red and pulse. If drawing duration becomes remotely configurable later, add the authoritative phase duration to the public turn state rather than allowing the client constant to drift.

The reward-store implementation spans `packages/protocol/src/index.ts`, `apps/server/src/services/AccountStore.ts`, `apps/server/src/rooms/DrawDuoRoom.ts`, `apps/server/src/rooms/types.ts`, `apps/server/src/index.ts`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`, and `migrations/002_reward_store.sql`. Coins are the purchase currency; team score remains session-only. Colors are single purchases supporting independent `draw_color` and `name_color` loadout slots. The room accepts `refreshProfile` after equip/purchase and republishes display name plus known cosmetic IDs. Stroke style ownership is server-enforced.

This checkpoint is unvalidated. Before acceptance, run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:security`, and `npm run test:e2e`. Do not run `npm run db:migrate` until an approved disposable `DATABASE_URL` exists. The memory adapter is adequate for UI/gameplay development but is not persistence evidence.

Keep this compact. Refer to artifacts instead of pasting giant logs or the full prior conversation. If no command ran, state that rather than inventing a pass.

## Headless testing without the phone

Run `npm run test:headless` for the complete software regression suite. Use `npm run test:headless:native` when Windows and Android build tools are installed and fresh native artifacts are also needed. Neither command opens Electron, touches an Android device, or represents packaged mixed-platform/visual acceptance; the machine-readable result is `test-results/headless-summary.json`.

## Phase 2 handoff - 2026-09-10

Phase 2 implementation and native artifact generation are complete through the available headless, Windows, and Android gates. The phase remains `IN_PROGRESS` until the packaged Windows client and installed Android client complete the same session, including reconnect and both drawing roles. `CODE_COMPLETE_DEVICE_PENDING` is not applicable because an authorized Samsung S25 Ultra is available.

Run from the project root:

```powershell
npm install --legacy-peer-deps
npm run dev
npm run verify -- --phase=2
npm run build:android:debug
npm run build:android:release
npm run test:desktop
npm run test:android
```

The Android environment used for the current evidence is `C:\Users\antho\AppData\Local\Android\Sdk`, with an authorized `SM_S938U` device. The debug and release builds and `test:android` smoke gate pass. The remaining work is actual packaged cross-platform gameplay, reconnect/drop coverage, four-client queue race coverage, and the dedicated desktop runtime gate. Do not treat install/launch smoke as proof of the complete mixed-platform session.

## Phase 3 continuation - 2026-09-10

Phase 3 is active and `IN_PROGRESS`. The durable account/progression/safety foundation and staff-only moderation review boundary are in place without replacing the shared room client. Continue with real PostgreSQL transaction verification when `DATABASE_URL` is available, then add provider-backed account linking/recovery and the remaining visible safety/progression flows.

```powershell
$env:DATABASE_URL = "postgres://..."
npm run db:migrate
npm run test:integration
```

Without `DATABASE_URL`, `npm run db:migrate` must report a missing prerequisite and make no changes. Do not use the development memory adapter as evidence for durable restart/recovery behavior. Supabase JWT verification requires `SUPABASE_JWKS_URL`, `SUPABASE_ISSUER`, and `SUPABASE_AUDIENCE`; do not place those secrets in source or the client bundle.

The room persistence boundary is now wired through `AccountStore`: a second player starts a session, each resolved turn writes its `turns` row in the reward transaction, and results close the session. Production room admission requires a verified bearer token matching the requested subject; local/test identity headers remain development-only. The client also exposes validated profile editing and active/results report, block, and hide-and-leave controls.

This checkpoint adds the staff-only moderation API:

`GET /api/safety/admin/reports?status=open|reviewed`

`POST /api/safety/admin/reports/:reportId/review` with `{ "action": "...", "reason": "..." }`

The routes accept `x-moderation-key` matching `DRAW_DUO_MODERATION_KEY`, use `DRAW_DUO_TEST_ADMIN_KEY` only when `DRAW_DUO_TEST_MODE=1`, or accept a bearer identity whose subject is listed in `DRAW_DUO_MODERATOR_SUBJECTS` or `DRAW_DUO_STAFF_SUBJECTS`. Normal player requests receive 403. Review actions are allowlisted as `no_action`, `warn`, `suspend_account`, or `remove_content`; `suspend_account` updates the reported account status inside the Postgres review transaction.

The account recovery entry point is `POST /api/account/recover`. It rehydrates the account for the currently verified provider subject and returns the server-owned profile. A new device must authenticate to the same Supabase identity; anonymous development headers are not recovery evidence. Cosmetic ownership/equip uses `POST /api/progression/equip` with `{ "itemId": "..." }`; the server rejects unowned items and keeps one equipped item per cosmetic type.

Latest evidence: `npm run test:headless` passed, including 15 unit tests, 7 integration tests, security, builds, and the browser E2E gate. `npm run db:migrate` was also exercised and correctly refused to run because `DATABASE_URL` is not configured. Native device, packaged mixed-platform, live PostgreSQL, and live Supabase provider gates remain unrun.

The owner is deferring local PostgreSQL/Supabase setup and continuing with Phase 4. Phase 4 is explicitly Spark-led. There is one more full Spark-led phase before the plan introduces stronger-model work: Phase 5 requests stronger review/diagnosis only where warranted while Spark implements the bounded fixes and tests. Phase 6 is again Spark-led for predictable packaging, integration scaffolding, tests, and documentation, with narrow review for sensitive store/payment code.

The Phase 4 internal implementation slice is now complete for content operations, readiness/drain controls, product feedback/accessibility, restricted moderation dashboard/review, suspension actions, bounded evidence retention, access logging, and migration preparation. `scripts/content.js` validates candidate bundles and only publishes approved, enabled entries with reviewer metadata; development/test mode continues using the seed bundle, while non-development runtime requires a published bundle.

The operations slice now also exposes protected `POST /api/admin/admission` with `{ "accepting": false }` or `{ "accepting": true }`, authenticated by `DRAW_DUO_OPERATIONS_KEY` or the test admin key in test mode. See `docs/OPERATIONS_RUNBOOK.md`. No live staging or drain exercise has been claimed.

## Phase 5 continuation - 2026-09-10

Phase 4's internal implementation is complete for the current disposable adapter path. PostgreSQL, Supabase provider setup, staging operations, approved production content, and the closed-beta exercise are intentionally deferred rather than treated as passed. Phase 5 hardening has started with bounded changes at the protocol and authoritative room boundary.

The server now bounds client IDs and numeric message fields, rejects unsafe stroke styles and oversized payloads, limits accepted drawing to 20 batches per second, 12,000 points, and 512 strokes per turn, and keeps duplicate-action memory bounded. Selection/drawing deadline races use the server timeout policy, stale guess/pass epochs return `stale_action`, and a failed persistence commit is reported to clients as `annulled` instead of the originally requested result. The web client ignores recovery snapshots older than its current canvas generation.

Latest Phase 5 evidence: `npx vitest run tests/security/phase-five.spec.ts` passed with 2 real two-client adversarial tests, `npm run test:security` passed all 5 security tests, `npm run typecheck` passed across all workspaces, `npm run build:web` passed, and `npm run test:headless` passed after the Electron boundary change with 15 unit tests, 7 integration tests, 5 security tests, builds, and browser E2E. The test output includes normal Colyseus listener warnings from the existing test harness; they did not fail the run. Device, Electron runtime, packaged mixed-platform, and visual gates remain not run.

Do not run `npm run db:migrate` until `DATABASE_URL` points to an approved disposable PostgreSQL instance. Do not claim Phase 5 release-candidate readiness until the database, native, packaged cross-platform, and measured load/device gates have evidence.

## Verified review repairs - 2026-09-10

The review repair pass is complete for the non-external path. Primary changes are in `apps/server/src/rooms/DrawDuoRoom.ts`, `apps/server/src/services/AccountStore.ts`, `apps/server/src/services/PromptProvider.ts`, `apps/web/src/App.tsx`, the shared protocol/platform packages, and the base Phase 3 migration that has not yet been executed. The fixes cover private prompt delivery, friend-code socket enforcement, canonical drawing coordinates, selected-order guesses, decoy tiles, non-repeating prompts, randomized first drawer, lifecycle/disconnect/rematch finalization, durable session IDs, duo-specific streaks, equal session coin display, private public-state fields, scoped purchase idempotency, no duplicate ownership charge, transaction ordering, immutable turn resolution, and real retained-evidence deletion.

Final evidence: `npm run typecheck` passed; `npm run test:security` passed 5/5; `npm run test:headless` passed with 15 unit tests, 7 integration tests, 5 security tests, both production builds, and the eight-turn two-browser E2E. One initial security run exposed a fixture-order issue because Colyseus disposes a never-used room after a rejected first admission; moving the deliberate bypass probe after the first valid seat fixed the test, and the next targeted and full runs passed. This was not a production-code failure.

The next implementation session must not recreate these repairs. Resume with the external gates when their inputs exist: configure disposable PostgreSQL and Supabase, supply owner-approved production content, then run database race/recovery, native mixed-platform, Electron runtime, load, staging, and closed-beta gates. A globally correct one-active-account-session guarantee belongs with the database-backed session registry; do not substitute a process-local flag and call it production-safe.

## Phase 6 continuation - 2026-09-10

Phase 6 release-preparation code is in place. `build-windows.js` writes a temporary runtime configuration into the packaged app and removes it after Forge completes; release mode rejects localhost and requires HTTPS/WSS. `build:steam` packages the Windows folder for Steam depot upload without adding a second updater. `android.js` builds a signed AAB through `bundleRelease` only when the protected keystore and production endpoint variables exist. The current `com.drawduo.playtest` identifier is intentionally not treated as a store-ready ID.

The web production bundle was rebuilt and checked for `x-draw-duo-user`, `DRAW_DUO_TEST_MODE`, and `SUPABASE_ACCESS_TOKEN`; none are present. Development identity headers remain available only under Vite development mode so local test fixtures continue to work without shipping test identity behavior.

Release material lives in `docs/STORE_METADATA.md`, `docs/PRIVACY_DATA_FLOW.md`, `docs/ROLLBACK_RUNBOOK.md`, and `release/steam/app_build.vdf.template`. `release:manifest` is the checksum generator. `release:check` is intentionally blocking until owner inputs and real release artifacts exist. Do not claim a signed release, store acceptance, production session, or public enablement from the current debug/test evidence.
