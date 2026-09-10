# Test evidence matrix

Phase 1 evidence below reflects the final automated run. Rows without direct coverage remain NOT RUN; the matrix does not infer native/device or persistence evidence from web tests.

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
| S04 | No private moderation/account data is readable by unrelated users | 3 | NOT RUN | Not implemented |
| S05 | JWT verification, expiry, issuer/audience and key-rotation paths work | 3 | NOT RUN | Not implemented |
| S06 | Private native bridge/IPC never exposes arbitrary shell/filesystem access | 2 | NOT RUN | Not implemented |
| S07 | Production cannot enable disposable development identity or test clock | 3 | NOT RUN | Not implemented |
| P01 | Two persistent wallet credits and one duo update commit atomically | 3 | NOT RUN | Not implemented |
| P02 | Lost response after commit/retry cannot duplicate rewards | 3 | NOT RUN | Not implemented |
| P03 | Unknown commit outcome is reconciled rather than blindly retried as new | 3 | NOT RUN | Not implemented |
| P04 | Concurrent purchases cannot overspend or duplicate ownership | 3 | NOT RUN | Not implemented |
| P05 | Same linked account on another platform recovers real progress | 3 | NOT RUN | Not implemented |
| P06 | Separate installations without linking are not falsely merged | 3 | NOT RUN | Not implemented |
| P07 | Client balance tampering changes no authoritative data | 3 | NOT RUN | Not implemented |
| P08 | Backup restoration recovers committed persistent records | 4 | NOT RUN | Not implemented |
| N01 | Actual packaged Windows and installed Android complete one full session | 2 | NOT RUN | Not implemented |
| N02 | Both platforms can be drawer and guesser in that session | 2 | NOT RUN | Not implemented |
| N03 | Native background/restart returns to same turn or honest expired state | 2 | NOT RUN | Not implemented |
| N04 | Reconnect does not extend timer, change bank, reroll or double-credit | 2 | NOT RUN | Reconnect code exists; native transport-loss evidence remains open. |
| N05 | Packaged client works without Vite or a locally running game UI server | 2 | PARTIAL | Windows package and Android APK build; packaged runtime smoke remains open. |
| N06 | Result/rematch/leave remain reachable on small mobile and scaled Windows | 2 | NOT RUN | Dedicated mixed-platform/native UI evidence remains open. |
| M01 | Report/hide/block work during play and after a session | 3 | PARTIAL | Server report/block primitives pass; in-game hide/report UI remains. |
| M02 | Authorized moderator can review evidence; ordinary player cannot | 4 | NOT RUN | Not implemented |
| M03 | Evidence retention/deletion job follows declared configuration | 4 | NOT RUN | Not implemented |
| M04 | Reviewed content publishes only to future sessions | 4 | NOT RUN | Not implemented |
| M05 | No false human-review claim for generated candidate prompts | 4 | NOT RUN | Not implemented |
| O01 | Health/readiness and planned drain do not silently lose committed turns | 4 | NOT RUN | Not implemented |
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
| Account/progression/safety integration | `npm run test:integration` | PASS | Three real-server integration files and three tests passed, including profile, terms, catalog, insufficient-balance, report, block/unblock, deletion, queue, and room flows. |
| Client/server compile | `npm run typecheck` | PASS | Account store, JWT verifier, APIs, React account strip, and native wrappers compile. |
| Local disposable auth | `x-draw-duo-user` in test mode | PASS | Explicitly development/test-only; not provider identity evidence. |
| PostgreSQL migration | `npm run db:migrate` | PENDING | Requires `DATABASE_URL` and a disposable test database. |
| PostgreSQL reward/purchase races | Real PostgreSQL integration | NOT RUN | Requires database environment; memory adapter is not equivalent evidence. |
| Provider auth and account linking | Supabase-configured integration | NOT RUN | Requires approved development provider configuration and secrets. |
| Visible profile/shop | Headless e2e smoke | PARTIAL | Profile and catalog render; server-side earned purchase/idempotency is unit-covered, while client purchase confirmation/ownership and new-device refresh remain. |
| Report/block UI and moderation review | Dedicated safety flow | PARTIAL | Client hide/report/block actions and server primitives exist; dedicated browser interaction evidence and authorized staff workflow remain. |

## Phase 3 implementation checkpoint - 2026-09-10

| Check | Result | Evidence boundary |
|---|---|---|
| Room session persistence wiring | PASS in code/test mode | Second-player admission calls `startSession`; resolved turns pass session/turn metadata through `AccountStore`; Postgres SQL writes the turn row and both rewards in one transaction. Real PostgreSQL execution remains pending. |
| Production room identity boundary | PASS in code path | Configured persistence requires a verified bearer token and matching JWT subject; local/test header fallback remains gated. Live JWT issuer/audience/key-rotation evidence remains pending. |
| Current Windows artifact | PASS | `npm run build:windows` completed at `apps/desktop/out/make`. Dedicated packaged runtime test remains not run. |
| Current Android artifacts/device | PASS | Debug install/launch smoke passed on authorized `SM_S938U`; debug and release builds completed. This is not full mixed-platform gameplay evidence. |
