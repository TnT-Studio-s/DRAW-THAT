# Implementation status

Plan version: 2.0, September 9, 2026.

Phase 1 implementation is complete for the headless web/server playable outcome. Native Windows/Android/iOS packaging and device gates remain outside this phase.

| Phase | Status | Evidence |
|---|---|---|
| 1: Complete playable foundation | CODE_COMPLETE_DEVICE_PENDING | `node scripts/verify.js --phase=1` passed with exit code 0; headless two-browser eight-turn e2e passed |
| 2: Windows + Android cross-play | IN_PROGRESS | Windows/Android artifacts and authorized Android smoke pass; packaged mixed-platform session remains open |
| 3: Persistent player game | IN_PROGRESS | Local account, progression, safety, idempotent reward tests, and session persistence wiring pass; live DB/provider gates remain open |
| 4: Closed-beta product and operations | NOT_STARTED | None |
| 5: Hardening/release candidate | NOT_STARTED | None |
| 6: Distribution/release | NOT_STARTED | None |

## Current work

Active phase: Phase 3 in progress; Phase 2 native artifacts and Android install smoke pass, while packaged mixed-platform acceptance remains open.
Actual implementation repository: `C:\Users\antho\Sync Develop Codex\Draw That`; branch/commit tracking is not configured in this workspace.
Actual model/status: Spark was the requested implementation model and exhausted its usage; no stronger-model subagent or model switch was used. A callable session-status source was not available to independently confirm the UI model label.
Implemented evidence: real Colyseus room, private friend-code flow, private 1/2/3 choices, server timers, live strokes, letter tiles, equal solved-turn coins, shared streak, eight alternating turns, results, rematch reset, headless two-browser e2e.
Next action: supply disposable PostgreSQL/Supabase configuration for durable/provider verification, then complete the remaining visible account/safety flows; retain the Phase 2 mixed-platform checks as an explicit parallel acceptance item.

## Required reporting states

NOT_STARTED / IN_PROGRESS / BLOCKED / CODE_COMPLETE_DEVICE_PENDING / VERIFIED / RELEASE_APPROVED.

Native cross-platform session evidence: Android APK install/launch smoke PASS; packaged Windows-to-Android gameplay is NOT RUN.
Production identity and transactional reward evidence: Phase 3 local development adapter PASS; live Supabase/PostgreSQL evidence NOT RUN.
Public deployment permission: NOT GRANTED.
Store publishing permission: NOT GRANTED.

Verified commands: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:security`, `npm run build:server`, `npm run build:web`, `npm run build:windows`, `npm run build:android:debug`, `npm run build:android:release`, `npm run test:android`, and `npm run test:e2e` all passed on 2026-09-10.
Unit evidence includes the Phase 3 account-store invariants: equal two-player reward, duplicate resolution retry, earned cosmetic purchase, and duplicate-safe purchase retry. E2E evidence includes two independent headless browser contexts joining by friend code, eight alternating turns, a live canvas stroke, results, and rematch.
Known non-blocking install note: npm required `--legacy-peer-deps` and local `file:` workspace links because the original dependency metadata used unsupported `workspace:*` links and an unpublished transport range.
Native/device gate: Android install/launch smoke passed on `SM_S938U`; packaged mixed-platform gameplay and desktop runtime smoke remain open. Public deployment, stores, ads, and payments remain intentionally out of scope.

## Phase 3 checkpoint - 2026-09-10

The current code slice is complete for local/test-mode account, progression, safety, and durable-session wiring. Production completion is not claimed: real PostgreSQL migration/transaction evidence, Supabase provider auth/linking/recovery, profile edit/equip UI, in-game hide/report controls, and authorized moderation review still require implementation or external configuration.

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

Phase 3 is `IN_PROGRESS`. The first durable account/progression/safety slice is implemented and covered by local development integration tests, but real PostgreSQL and Supabase provider evidence is still pending. This does not change the separate Phase 2 mixed-platform acceptance status.

Implemented:

- `migrations/001_phase3_accounts.sql` defines players, account links, wallets, append-only ledger, duos, sessions, turns, turn resolutions, cosmetic catalog/ownership, blocks, reports, and moderation audit records.
- `apps/server/src/services/AccountStore.ts` provides a development-only in-memory adapter and a parameterized PostgreSQL adapter with transactional purchase and turn-resolution idempotency primitives.
- `apps/server/src/services/AuthService.ts` accepts verified Supabase-compatible JWTs when configured and permits the disposable `x-draw-duo-user` identity only in development/test mode.
- Server APIs cover account profile/terms/deletion, cosmetic catalog/purchase, report, block, and unblock flows.
- Room joins hydrate account wallets and turn rewards commit through the account store instead of being awarded only in room memory.
- The shared client displays server-owned wallet/lifetime/streak state, terms acceptance, editable validated display name, and the earn-only cosmetic catalog.
- Active/results sessions expose report, block, and hide-and-leave actions; the server resolves room subject references to canonical player IDs before safety writes.

Phase 3 evidence:

- `npm run typecheck` passed.
- `npm run test:integration` passed: 3 files and 3 tests, including account, terms, catalog, safety, and deletion flows.
- `npm run test:security` passed.
- `npm run test:e2e` passed after the Phase 3 UI addition.

Remaining Phase 3 gates:

- `DATABASE_URL` and a disposable PostgreSQL instance are required for migration and real transaction tests.
- Supabase project/JWKS/issuer/audience configuration is required for live provider-auth and account-linking tests.
- New-device account recovery, provider-backed linking, cosmetic ownership/equip UI, and authorized moderator review remain to be completed. Safety controls are now wired in the client, but their dedicated browser interaction test is still pending.
