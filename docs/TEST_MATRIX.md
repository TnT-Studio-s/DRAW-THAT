# Test evidence matrix

## Mixed-platform evidence - 2026-09-12

| Check | Result | Evidence |
|---|---|---|
| Android creates private invite and Windows joins | PASS | Physically completed with the installed Samsung S25 Ultra and Windows client against the same local Colyseus server. |
| Remote live strokes across role swap | PASS HEADLESS | `npx playwright test tests/e2e/live-drawing.spec.ts` passed with nonwhite remote-canvas pixel assertions in both directions before and after Pass/role alternation. |
| Web TypeScript after live-stroke repair | PASS | `npm run -w apps/web typecheck`. |
| Corrected Android debug APK build/install/launch | PASS | `npm run build:android:debug` and `npm run test:android` completed on the authorized Samsung S25 Ultra. |
| Active-room Android Back/edge gesture containment | BLOCKED | Real Back returned to Samsung Launcher and discarded the room after two bounded native interception cycles. No `FATAL EXCEPTION` occurred. See `REVIEW_PACKET.md`. |
| Full eight-turn packaged Windows-to-Android session | NOT RUN TO COMPLETION | Physical pairing reached gameplay, but the Android edge-gesture activity exit prevented complete-session acceptance. |

Phase 1 evidence below reflects the final automated run. Rows without direct coverage remain NOT RUN; the matrix does not infer native/device or persistence evidence from web tests.

Headless automation: `npm run test:headless` covers the terminal-only lint, type, unit, integration, security, server/web build, and two-browser E2E layers. `npm run test:headless:native` adds artifact generation only. Its JSON report deliberately leaves Android device, Electron runtime, packaged Windows-to-Android, and visual acceptance as `not_run`.

| ID | Requirement | Phase | Status | Test path / evidence |
|---|---|---:|---|---|
| R01 | Easy success credits both players 1 and team 1 | 1 | NOT RUN | Not implemented |
| R02 | Medium success credits both players 2 and team 2 | 1 | NOT RUN | Not implemented |
| R03 | Hard success credits both players 3 and team 3 | 1 | NOT RUN | Not implemented |
| R04 | Eight hard successes yield team 24 and 24 earned coins each | 1 | NOT RUN | Not implemented |
| R05 | Eight turns allocate exactly four drawing opportunities per person | 1 | NOT RUN | Not implemented |
| R06 | Duplicate success resolves once | 1 | NOT RUN | Not implemented |
| R07 | Wrong guess preserves coins/streak and permits a corrected guess | 1 | NOT RUN | Not implemented |
| R08 | Pass and timeout award 0, reset current streak, retain best, and advance | 1 | NOT RUN | Not implemented |
| R09 | Normal session completion preserves streak for the same duo | 1 | NOT RUN | Not implemented |
| R10 | Failed turn does not remove earlier rewards | 1 | NOT RUN | Not implemented |
| R11 | Selection timeout selects only the actual offered easy choice | 1 | NOT RUN | Not implemented |
| R12 | Drawer cannot reroll by changing choice after lock | 1 | NOT RUN | Not implemented |
| R13 | Guess at the exact deadline is late; guess just before is eligible | 1 | NOT RUN | Not implemented |
| R14 | Guess/timeout callbacks cannot both finalize one turn | 1 | NOT RUN | Not implemented |
| R15 | Leave after prompt exposure cannot preserve a streak by avoiding failure | 2 | NOT RUN | Not implemented |
| R16 | Leave before exposure or at results does not invent a failed turn | 2 | NOT RUN | Not implemented |
| R17 | Server fault annuls only the unresolved turn, not prior committed progress | 3 | NOT RUN | Not implemented |
| I01 | Duplicate letters have distinct IDs and correct multiplicity | 1 | NOT RUN | Not implemented |
| I02 | A tile cannot occupy two slots simultaneously | 1 | NOT RUN | Not implemented |
| I03 | Keyboard and pointer/touch use the same tile inventory | 1 | NOT RUN | Not implemented |
| I04 | Case/space formatting normalizes without promising different-letter aliases | 1 | NOT RUN | Not implemented |
| I05 | Wrong guesses reveal no per-letter correctness and no free-text chat | 1 | NOT RUN | Not implemented |
| I06 | All slots/tiles fit the supported viewport and text scale | 1 | NOT RUN | Not implemented |
| D01 | A known pointer path reaches both real clients | 1 | NOT RUN | Not implemented |
| D02 | Local predicted stroke is not doubled by server acknowledgement | 1 | NOT RUN | Not implemented |
| D03 | Undo/clear preserve canonical ordering and generation | 1 | NOT RUN | Not implemented |
| D04 | Old-generation/stale-epoch packets cannot resurrect drawings | 2 | NOT RUN | Not implemented |
| D05 | Reconnect snapshot plus buffered deltas has no missing/duplicate events | 2 | NOT RUN | Not implemented |
| D06 | Pointer cancel, resize, display scaling, and pen-up outside canvas are safe | 2 | NOT RUN | Not implemented |
| D07 | Finite/range/size/rate limits reject malicious drawing commands | 1 | NOT RUN | Not implemented |
| D08 | Heavy valid drawing stays within bounded room/client memory | 5 | NOT RUN | Not implemented |
| Q01 | Friend-code creation/join produces one two-player room | 1 | PASS | `tests/e2e/phase-one.spec.ts`: two browser contexts create/join the same private code |
| Q02 | Code collision, expiry, invalid code, full room and retries fail usefully | 2 | NOT RUN | Not implemented |
| Q03 | A leaked room ID alone cannot bypass admission | 1 | NOT RUN | Not implemented |
| Q04 | Public matchmaking never filters by platform/store/payment tier | 2 | NOT RUN | Not implemented |
| Q05 | Concurrent joins/cancellations cannot double-book a player | 2 | NOT RUN | Not implemented |
| Q06 | Readiness timeout returns remaining player to a usable state | 2 | NOT RUN | Not implemented |
| Q07 | Empty queue shows no fabricated opponent/count | 2 | NOT RUN | Not implemented |
| Q08 | Blocked users cannot pair or join privately in either direction | 3 | NOT RUN | Not implemented |
| Q09 | Current and supported-older cross-platform clients pair successfully | 4 | NOT RUN | Not implemented |
| Q10 | Unsupported client is rejected before it consumes a room seat | 2 | NOT RUN | Not implemented |
| S01 | Guesser receives designed bank/length clues, not secret answer/options | 1 | PASS | `tests/security/roles.spec.ts`: private choices are delivered only to the drawer; both receive the letter bank |
| S02 | Server-only prompts/keys/test APIs are absent from all client bundles | 1 | NOT RUN | Not implemented |
| S03 | Wrong-role, wrong-turn and spoofed-actor requests are rejected | 1 | PASS | `tests/security/roles.spec.ts`: guesser stroke receives `wrong_role` |
| S04 | No private moderation/account data is readable by unrelated users | 3 | PARTIAL | `tests/integration/phase-three.spec.ts` covers a normal player receiving 403 from the staff report queue; live provider and browser evidence remain open. |
| S05 | JWT verification, expiry, issuer/audience and key-rotation paths work | 3 | NOT RUN | Not implemented |
| S06 | Private native bridge/IPC never exposes arbitrary shell/filesystem access | 2 | NOT RUN | Not implemented |
| S07 | Production cannot enable disposable development identity or test clock | 3 | NOT RUN | Not implemented |
| P01 | Two persistent wallet credits and one duo update commit atomically | 3 | NOT RUN | Not implemented |
| P02 | Lost response after commit/retry cannot duplicate rewards | 3 | NOT RUN | Not implemented |
| P03 | Unknown commit outcome is reconciled rather than blindly retried as new | 3 | NOT RUN | Not implemented |
| P04 | Concurrent purchases cannot overspend or duplicate ownership | 3 | NOT RUN | Not implemented |
| P05 | Same linked account on another platform recovers real progress | 3 | PARTIAL | Verified-subject recovery endpoint and profile state exist; real Neon Auth new-device/linking evidence remains open. Headless recovery assertion passes. |
| P06 | Separate installations without linking are not falsely merged | 3 | NOT RUN | Not implemented |
| P07 | Client balance tampering changes no authoritative data | 3 | NOT RUN | Not implemented |
| P08 | Backup restoration recovers committed persistent records | 4 | NOT RUN | Not implemented |
| N01 | Actual packaged Windows and installed Android complete one full session | 2 | NOT RUN | Not implemented |
| N02 | Both platforms can be drawer and guesser in that session | 2 | NOT RUN | Not implemented |
| N03 | Native background/restart returns to same turn or honest expired state | 2 | NOT RUN | Not implemented |
| N04 | Reconnect does not extend timer, change bank, reroll or double-credit | 2 | NOT RUN | Reconnect code exists; native transport-loss evidence remains open. |
| N05 | Packaged client works without Vite or a locally running game UI server | 2 | PARTIAL | Windows package and Android APK build; packaged runtime smoke remains open. |
| N06 | Result/rematch/leave remain reachable on small mobile and scaled Windows | 2 | NOT RUN | Dedicated mixed-platform/native UI evidence remains open. |
| M01 | Report/hide/block work during play and after a session | 3 | PARTIAL | Server report/block primitives and in-game hide/report/block actions pass through headless paths; dedicated browser safety interaction evidence remains. |
| M02 | Authorized moderator can review evidence; ordinary player cannot | 4 | PARTIAL | Restricted moderation dashboard, staff-only report/evidence/review API, allowlisted actions, suspension behavior, and memory-adapter coverage are present; live authorized workflow and Postgres audit evidence remain open. |
| M03 | Evidence retention/deletion job follows declared configuration | 4 | PARTIAL | Memory retention/expiry and the Postgres migration/access-log path are implemented; live scheduler/database deletion evidence remains open. |
| M04 | Reviewed content publishes only to future sessions | 4 | PARTIAL | Validator, bounded edit workflow, and explicit versioned publish command exist; approved review data and live future-session exercise remain open. |
| M05 | No false human-review claim for generated candidate prompts | 4 | PARTIAL | Candidates remain disabled and unapproved; publication requires reviewer metadata. Owner content review is still required. |
| O01 | Health/readiness and planned drain do not silently lose committed turns | 4 | PARTIAL | Health/readiness and protected admission drain controls plus runbook exist; live staging drain with active committed rooms remains open. |
| O02 | Soak tests clean up room memory, sockets, subscriptions, timers and PIDs | 5 | NOT RUN | Not implemented |
| O03 | Logs/traces redact tokens, private guesses and unnecessary personal data | 4 | NOT RUN | Not implemented |
| O04 | Maintenance/rollback produces honest client recovery, not phantom wins | 5 | NOT RUN | Not implemented |
| L01 | Steam build contains no ads or watch-ad reward UI/path | 6 | NOT RUN | Not implemented |
| L02 | Native SDK failure cannot permanently disable results or start a hidden live turn | 6 | NOT RUN | Not implemented |
| L03 | Duplicate/late reward callbacks grant at most one verified benefit if enabled | 6 | NOT RUN | Not implemented |
| L04 | Release bundles use intended signing/config and contain no test identities | 6 | NOT RUN | Not implemented |
| L05 | Cross-platform production-config smoke test passes before public enablement | 6 | NOT RUN | Not implemented |
| L06 | Store uploads/public enablement occur only after explicit owner approval | 6 | NOT RUN | Not implemented |
## Phase 2 evidence - 2026-09-10

| Area | Command | Result | Evidence boundary |
|---|---|---|---|
| Workspace lint | `npm run lint` | PASS | All workspaces type/lint checked. |
| Workspace typecheck | `npm run typecheck` | PASS | React, server, protocol, platform, desktop, and mobile wrappers checked. |
| Unit rules/account invariants | `npm run test:unit` | PASS | 7 tests passed, including equal reward, duplicate resolution retry, cosmetic purchase, and duplicate-safe purchase retry. |
| Phase 1 and Phase 2 integration | `npm run test:integration` | PASS | 2 files and 2 tests passed; queue compatibility, pairing, stroke sequencing, and snapshots covered. |
| Browser gameplay | `npm run test:e2e` | PASS | Headless two-client eight-turn results/rematch flow passed. Existing local server emitted an EADDRINUSE message while the runner reused the port; the browser test itself passed. |
| Security | `npm run test:security` | PASS | Role and private-message boundary test passed; expected unregistered-listener warnings remain in the test harness. |
| Web/server artifacts | `npm run build:web`; `npm run build:server` | PASS | Production web bundle and server TypeScript build completed. |
| Windows artifact | `npm run build:windows` | PASS | Electron Forge Squirrel artifact completed under `apps/desktop/out/make`. |
| Android project sync | `npm run android:sync` | PASS | Capacitor Android project generated and synchronized. |
| Android artifacts | `npm run build:android:debug`; `npm run build:android:release` | PASS | Both Gradle tasks completed and produced APK artifacts. |
| Android device smoke | `npm run test:android` | PASS | Debug APK installed/launched on authorized Samsung S25 Ultra (`SM_S938U`) with ADB port reverse configured. |
| Native desktop runtime | `npm run test:desktop` | NOT RUN | Dedicated packaged Electron runtime gate remains required. |
| Packaged Windows-to-Android session | Dedicated mixed-platform run | NOT RUN | Install/launch smoke is not gameplay or cross-play proof; both packaged clients must complete the same session. |

## Phase 3 evidence - 2026-09-10

| Area | Command | Result | Evidence boundary |
|---|---|---|---|
| Account/progression/safety integration | `npm run test:integration` | PASS | Four real-server integration files and seven tests passed, including profile, terms, catalog, insufficient-balance, report, block/unblock, deletion, readiness, drain authorization, queue, room flows, dashboard delivery, and moderator authorization. |
| Client/server compile | `npm run typecheck` | PASS | Account store, JWT verifier, APIs, React account strip, and native wrappers compile. |
| Local disposable auth | `x-draw-duo-user` in test mode | PASS | Explicitly development/test-only; not provider identity evidence. |
| PostgreSQL migration | `npm run db:migrate` | PENDING | Requires `DATABASE_URL` and a disposable test database. |
| PostgreSQL reward/purchase races | Real PostgreSQL integration | NOT RUN | Requires database environment; memory adapter is not equivalent evidence. |
| Provider auth and account linking | Neon Auth-configured integration | NOT RUN | Requires approved development provider configuration and secrets. |
| Visible profile/shop | Headless e2e smoke | PARTIAL | Profile, catalog, ownership, equip, guide, sync, and accessibility states render; dedicated purchase/equip browser interaction and new-device refresh remain. |
| Report/block UI and moderation review | Dedicated safety flow | PARTIAL | Client hide/report/block actions and server primitives exist; dedicated browser interaction evidence and authorized staff workflow remain. |

## Phase 3 implementation checkpoint - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Room session persistence wiring | PASS in code/test mode | Second-player admission calls `startSession`; resolved turns pass session/turn metadata through `AccountStore`; Postgres SQL writes the turn row and both rewards in one transaction. Real PostgreSQL execution remains pending. |
| Production room identity boundary | PASS in code path | Configured persistence requires a verified bearer token and matching JWT subject; local/test header fallback remains gated. Live JWT issuer/audience/key-rotation evidence remains pending. |
| Current Windows artifact | PASS | `npm run build:windows` completed at `apps/desktop/out/make`. Dedicated packaged runtime test remains not run. |
| Current Android artifacts/device | PASS | Debug install/launch smoke passed on authorized `SM_S938U`; debug and release builds completed. This is not full mixed-platform gameplay evidence. |

## Phase 4 implementation checkpoint - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Content validator/importer | PASS in code/test path | `node scripts/content.js validate docs/reference/seed-prompts.json` and `tests/unit/content-tool.spec.ts` enforce schema, normalized uniqueness, difficulty coverage, review status, and publication reviewer metadata. |
| Published content boundary | PASS in code path | Development/test mode uses candidates; non-development runtime requires an explicit published bundle with approved/enabled entries. No content is falsely marked approved. |
| Service readiness | PASS in test mode | `tests/integration/phase-four.spec.ts` confirms `/api/ready` reports the memory adapter in test mode; the same route returns 503 when configured persistence is unavailable. Live PostgreSQL readiness remains unrun because `DATABASE_URL` is deferred. |
| Admission drain authorization | PASS in test mode | `tests/integration/phase-four.spec.ts` confirms an unauthenticated request cannot toggle the drain; live staging drain and room-drain timing remain unrun. |
| Phase 4 headless regression | PASS | `npm run test:headless` passed with lint, workspace typechecks, 15 unit tests, 7 integration tests, security, builds, and browser E2E; native/device/packaged mixed-platform gates remain explicitly not run. |
| Evidence retention adapter | PASS in memory test path | `tests/unit/evidence-store.spec.ts` covers report extension and expiry deletion; live Postgres retention and authorized evidence replay remain open. |

## Phase 5 implementation checkpoint - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Protocol bounds | PASS | `packages/protocol/src/index.ts` bounds action/turn/choice IDs, finite numeric fields, epochs/generations, stroke batches, and selected tile IDs before room handling. |
| Authoritative stroke limits | PASS in test mode | `tests/security/phase-five.spec.ts` confirms malformed payload rejection, unsafe brush rejection, duplicate action suppression, and bounded server handling. Rate, payload, point, and stroke limits are implemented; device tuning is not claimed. |
| Deadline race handling | PASS in test mode | `tests/security/phase-five.spec.ts` confirms an elapsed drawing turn resolves as `timeout` rather than accepting a late pass. Full exact-deadline clock injection remains open. |
| Reconnect/order stale-action handling | PASS in code and test mode | Guess/pass connection-epoch mismatches return `stale_action`; stale canvas generations remain rejected; the web client ignores older recovery snapshots. The test covers stale epoch and post-clear generation rejection; real transport reconnect remains open. |
| Electron trust boundary | PASS in static headless test path | `tests/security/electron-boundary.spec.ts` covers renderer isolation, sandboxing, HTTPS-only external navigation, preload bridge presence, and CSP derivation from configured backend origins. Electron runtime execution remains not run. |
| Failed persistence outcome | PASS in code path | `DrawDuoRoom` publishes the effective outcome, including `annulled`, after the account-store commit path; real PostgreSQL failure/reconciliation evidence remains open. |
| Phase 5 targeted validation | PASS | `npx vitest run tests/security/phase-five.spec.ts` passed 2 tests and `npm run typecheck` passed after the hardening patch. |
| Phase 5 full headless regression | PASS | `npm run test:headless` passed after the Electron boundary change: lint, workspace typechecks, 15 unit tests, 7 integration tests, 5 security tests, server/web builds, and browser E2E. |
| Native, database, and release-candidate gates | NOT RUN | Requires the deferred PostgreSQL/provider setup, packaged clients, device sessions, measured load targets, and focused release audit. |

## Verified review repair evidence - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Drawer answer privacy and UI delivery | PASS in headless browser/security paths | The selected answer is sent only in `privatePrompt`; the browser E2E confirms the drawer sees `Draw: ...`. Live packaged-device privacy remains unrun. |
| Friend-code admission | PASS in real-server security path | A room-ID-only join receives `private_admission_required`; both issued-code joins succeed. |
| Ordered tile solving and decoys | PASS in real-server security path | The security suite reconstructs the private answer from shuffled tile IDs in selected order and receives `solved`; opaque IDs and four decoys are server-generated. |
| Account-store ownership/idempotency/duo streak | PASS in memory unit path | Repeat ownership with a fresh request does not debit again; the same request ID is valid for a different player; duo-specific streak reaches eight. Real PostgreSQL race evidence remains unrun. |
| Evidence removal | PASS in memory unit path | Removed retained evidence is no longer retrievable. Live PostgreSQL deletion/audit evidence remains unrun. |
| Full repaired headless regression | PASS | `npm run test:headless`: lint, workspace typechecks, 15 unit tests, 7 integration tests, 5 security tests, server/web builds, and one eight-turn browser E2E all passed. |
| Database/provider/content/native/load gates | NOT RUN | Requires PostgreSQL migration, live Neon Auth acceptance, approved production content, packaged clients/devices, and measured environments. |

## Phase 6 distribution evidence - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Release packaging contracts | PASS | `npm run test:packaging` passed 3 tests covering runtime config, signed Android release requirements, checksum generation, and disabled monetization. |
| Windows test package | PASS | `npm run test:headless:native` completed `npm run build:windows`; Forge produced the Squirrel artifact under `apps/desktop/out/make`. This is not a Steam upload or production-config runtime session. |
| Steam depot-folder workflow | IMPLEMENTED | `npm run build:steam` selects Forge `package` for an unpacked Windows folder; production endpoint and owner publisher inputs remain required. |
| Android debug artifact | PASS | `npm run test:headless:native` completed Android sync and `build:android:debug` using `C:\Users\antho\AppData\Local\Android\Sdk`; the explicit APK path was produced. |
| Android release signing guard | PASS IN CODE, BLOCKED IN ENVIRONMENT | `build:android:release` requires protected keystore variables and production HTTPS/WSS, uses `bundleRelease`, and correctly stopped before building when absent. |
| Production endpoint/runtime guard | PASS IN CODE, BLOCKED IN ENVIRONMENT | Windows release rejected the local endpoint; packaged runtime configuration is generated only during the build and removed from the source tree afterward. |
| Development identity exclusion | PASS | The rebuilt web bundle contains none of `x-draw-duo-user`, `DRAW_DUO_TEST_MODE`, `SUPABASE_ACCESS_TOKEN`, `NEON_API_KEY`, or `NEON_AUTH_COOKIE_SECRET`. |
| Ads and billing boundary | PASS: ABSENT/DISABLED | No AdMob, billing, rewarded-ad, or watch-an-ad path is present in current web, Android, or Windows dependencies; no monetization evidence is being claimed beyond that absence. |
| Store, privacy, and rollback material | READY FOR OWNER INPUT | Templates and runbooks exist; final legal links, IDs, branding, licenses, publisher credentials, and policy declarations are not invented. |
| Release approval and actual publishing | NOT AUTHORIZED | No store upload, Steam upload, public matchmaking enablement, or release approval was performed. |

## Portrait game UI checkpoint - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Portrait responsive game shell | NOT RUN | Implemented for the shared React client; phone-sized browser and packaged Android visual inspection remain required. |
| QWERTY finite-bank guessing | NOT RUN | QWERTY keys select the existing server-issued tile IDs; repeated letters, decoys, Backspace, Enter, Pass, wrong-shake, and clearing require headless interaction evidence. |
| Drawer private answer and palette | NOT RUN | The private prompt fills the drawer's word boxes and palette controls retain approved color/width values; two-client privacy and touch drawing were not rerun. |
| Correct-answer celebration | NOT RUN | Green slot bounce and the points/current-total/streak overlay are implemented from authoritative reveal state; animation and reduced-motion behavior remain visually unverified. |
| Android portrait lock | NOT RUN | `MainActivity` declares portrait orientation; no Android rebuild or device rotation test was run for this checkpoint. |
| Canvas countdown bar | NOT RUN | Glossy 60-second drain and final-ten-second red pulse are implemented from extrapolated authoritative `remainingMs`; timing, reconnect appearance, reduced motion, and portrait visual placement remain unverified. |
| Starter reward ownership | NOT RUN | Red/Green/Blue, Medium brush, plain font, and plain border are assigned by memory/Postgres code; migration and fresh-account tests were not run. |
| Cosmetic purchase and independent color equip | NOT RUN | Idempotent coin purchase is reused; a color can target drawing or name slots. Unit, API, and concurrency evidence remain unrun. |
| Server-owned drawing styles | NOT RUN | Room stroke handling checks owned color and brush catalog values. Adversarial locked-style and live refresh tests remain unrun. |
| Partner nameplate cosmetics | NOT RUN | Display name and known equipped catalog IDs are published; two-client font/color/border rendering and compatibility fallback remain visually unverified. |
