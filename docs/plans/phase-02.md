# Phase 2 execution brief

This is the full macro-phase, not a single internal task. Read the applicable specs below and finish its substantial outcome. The [master plan](MASTER_PLAN.md) controls any ambiguity. Source labels resolve in [source notes](../specs/10_sources.md).

## Focused reading map

- [Specification 0: product decisions](../specs/00_product_decisions.md)
- [Specification 1: gameplay](../specs/01_gameplay.md)
- [Specification 2: architecture crossplay](../specs/02_architecture_crossplay.md)
- [Specification 3: protocol security recovery](../specs/03_protocol_security_recovery.md)
- [Specification 5: repo commands](../specs/05_repo_commands.md)
- [Specification 6: headless testing](../specs/06_headless_testing.md)
- [Specification 7: spark workflow](../specs/07_spark_workflow.md)
- [Acceptance IDs](../specs/08_acceptance_matrix.md), plus current STATUS/HANDOFF/TEST_MATRIX.

After the first orientation, reread only relevant sections and changed modules. Do not consume context by reloading the whole master after every patch.

## Phase 2: Ship Windows and Android test builds with real cross-play

**Outcome:** The same game runs in a packaged Windows app and installed Android APK, and those two products complete a shared session. Quick Partner is one platform-neutral queue. Disconnects recover safely.

**Executor:** Spark for the implementation. A demonstrated platform/ordering blocker may need a narrow stronger-model diagnosis.  
**Required reading:** Sections 1-4, 6-8, and the Phase 1 status/test evidence.  
**External prerequisites:** Windows build environment and Android SDK/JDK tooling for native artifacts; an authorized test phone/emulator for actual APK verification.

### Complete internal work, without separate permission prompts

**A. Finish both native shells.** Create Electron main/preload and a packaged-asset loading path, desktop icon/resources, window resize/fullscreen controls, settings storage, and a restricted platform bridge. Create the Capacitor Android project using the same shared web build, appropriate app lifecycle handling, safe areas, portrait-first behavior, network configuration, and command-line Gradle build. Make packaging reproducible and document each artifact. Use provisional identifiers only in test builds and a final identifier gate before publishing.

Electron must have renderer Node integration disabled, context isolation and sandboxing enabled, restrictive navigation/external-link checks, validated narrow IPC, and a content security policy. These follow Electron's security guidance; do not turn security off to resolve packaging problems. [S13]

**B. Implement one real Quick Partner queue.** Authenticate/test-identify each entrant, enforce one reservation per user, pair two eligible users, issue scoped join reservations, require readiness, expire incomplete joins, and return the remaining user to a usable searching state. Never use platform/store as an eligibility filter. Keep this queue development/closed-test only until production identity/moderation gates exist. Test four clients concurrently so a race cannot put one person in two rooms. Preserve friend-code admission with collision checks, expiry, join limits, and host/partner readiness.

**C. Add reconnect and complete canvas recovery.** Implement the reservation, continuing timer, refreshable reconnect token handling, reconnect-after-page/app restart, connection epoch, canonical snapshot plus deltas, stale-action discard, missing-partner intermission hold, leave, and abandoned/server-error outcomes. Limit retries and clean listeners/timers on every exit. Handle a network drop during drawing, selection, reveal, results, and a pending rematch.

**D. Build cross-platform compatibility checks.** Centralize the backend URL; handle development/staging/release separately; never discover backend availability by guessing from `window.location`. Add protocol/build handshake, room rules/content version pinning, explicit unsupported-version rejection, and native-platform capability detection. Client wallet displays and session results must remain identical regardless of wrapper.

**E. Test the packaged products.** Validate packaged Windows assets without a Vite server. For early Android local testing, use authorized USB forwarding into a loopback test service; document the exact device/ports rather than exposing development auth on the internet. Run real Windows-to-Android code joining and Quick Partner pairing, swap both drawing roles, test duplicate-letter typing/tapping, resize/background/resume, complete eight turns, and rematch. Do not accidentally use two browser windows and label them Windows/Android certification.

### Files/modules in scope

`apps/desktop`, `apps/mobile`, shared platform adapters, queue/reservation/admission services, reconnect/canvas-state modules, protocol compatibility, build/diagnostic scripts, and native smoke tests. Preserve the shared web client and rules instead of forking platform implementations.

### Required verification

Everything required by Phase 1 plus `build:windows`, `android:sync`, `build:android:debug`, queue/reconnect integration tests, cross-version handshake tests, and `verify --phase 2`. Run `test:desktop` and `test:android` only on authorized dedicated test environments. Record exact artifact version and device/OS.

| Check | Required result |
|---|---|
| Actual Windows + Android session | Both drawing roles, success/failure, identical score, session end/rematch |
| Mixed-platform queue | Windows and Android can be paired; no OS/store filters |
| Multiple concurrent join/cancel requests | No duplicate seats, double rooms, or stale room admission |
| Guesser reconnect | Same bank/turn and complete accepted canvas restored |
| Drawer reconnect | Correct private prompt restored only to its owner; no extra time |
| Clear/undo followed by reconnect | Old strokes do not reappear |
| Drop past allowance | Incomplete session/defined streak outcome; remaining player can exit |
| Mobile background and process restart | Safe reconnection or honest expiry, no permanently disabled controls |
| Packaged asset loading | Windows and APK load their own bundled client assets |
| Version mismatch | Useful Update Required screen before pairing |

### Definition of done

Code/build gates pass and the actual mixed-platform session evidence exists. If tools can build the APK but no device is available, mark `CODE_COMPLETE_DEVICE_PENDING`, list the missing native checks, and complete the remaining independent work. Do not call cross-play verified from a changed platform label or mobile viewport emulation.

### Explicitly out of scope

Public anonymous access using dev auth, accounts with valuable persistent balances, store publishing, paid entitlements, ads, worldwide infrastructure, and iOS.

### Escalation signal

Native-only touch coordinate corruption, persistent snapshot/order divergence, unexplained queue reservation races, or an Electron security workaround that would relax the stated boundary. Provide a failing test/device trace before requesting a broad rewrite.

---
