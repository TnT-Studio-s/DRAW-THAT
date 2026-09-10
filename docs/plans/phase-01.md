# Phase 1 execution brief

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

## Phase 1: Build the complete playable foundation

**Outcome:** Two independent clients can create/join a room and finish an entire live drawing-and-guessing session against a real authoritative local server. This phase is much more than a scaffold.

**Executor:** Spark. No stronger model is required solely to start this phase.  
**Required reading:** Sections 1, 2, 3, 4, 6, 7, and 8; use their focused spec files after initial orientation.  
**External prerequisites:** An authorized empty/new project directory and compatible Node/npm tooling. No Steam, AdMob, production database, or store credentials are needed.

### Complete internal work, without separate permission prompts

**A. Establish the working project and test loop.** Inspect the selected directory and preserve existing work. Set up the minimal npm workspaces, React/TypeScript/Vite client, Node/TypeScript Colyseus server, protocol/rules/drawing packages, lint/typecheck, and headless tests. Record actual versions and commands. Create the phase status and test matrix. Add environment validation with loopback development auth and in-memory persistence clearly separated from future production adapters.

**B. Implement the whole cooperative rules engine.** Add the versioned turn settings, ready/selection/countdown/active/reveal/results state transitions, strict role alternation, 1/2/3 equal personal coin rewards, once-counted team points, current/best duo streak, wrong-guess/pass/timeout behavior, eight-turn completion, and mutual rematch. Use an injected clock and RNG in tests. Implement an in-memory ledger abstraction with the same idempotency semantics expected later, labeled disposable, not a fake claim of durable accounts.

**C. Build the actual player interface.** Implement home, create/join code, waiting/ready, private word choices, drawer screen, guesser screen, result screen, rematch, settings/mute/reduced-motion, connection/error presentation, and local practice canvas. Use responsive desktop and phone layouts from the start. Include the letter bank, duplicate tile behavior, physical keyboard equivalence, drawing palette, three widths, eraser, undo, and clear. No attractive dead buttons or hidden “Continue” actions below a fixed card.

**D. Wire real two-client networking.** Real room admission, private drawer prompt messages, server-generated tiles, server timer decisions, real stroke relay, canonical sequence/generation handling, guess submission, turn resolution and role swap. Use the 90 original seed prompts in the appendix as server-only content. Add basic message size/rate checks, wrong-role rejection, private-room admission, and a clean abort if a client leaves. Full reconnect/recovery belongs in Phase 2, but Phase 1 must fail gracefully instead of hanging.

**E. Prove a full session headlessly.** Start the actual backend and two isolated Playwright contexts, create/join the same code, draw a known path, solve a selected word, fail another by clock advance, swap roles, finish eight turns, show correct rewards, and rematch. Check delivered public/private messages. Record app screenshots and traces without opening them on the user's desktop. Finish dependency boundaries and the Windows/mobile adapter interfaces needed next; do not implement a second client for future platforms.

### Files/modules in scope

`apps/web`, `apps/server` without production services, `packages/protocol`, `packages/rules`, `packages/drawing`, `packages/platform`, `packages/testkit`, initial scripts/tests, server seed content, and phase documentation. Desktop/mobile directories need only configuration/interface groundwork when useful; their real packaging is Phase 2.

### Required verification

`lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, initial `test:security`, `build:web`, `build:server`, and `verify --phase 1` must execute actual checks. Create initial security tests here rather than waiting for final hardening.

Required named behaviors include:

| Check | Required result |
|---|---|
| Each of the three reward values | Both balances gain the same value; team score gains it once |
| Eight all-hard turns | Team 24; both session earnings 24; four drawing turns each |
| Wrong guess then success | No lost streak on wrong guess; one increment on success |
| Pass/timeout | No new coins; current streak reset; next turn starts |
| Duplicate correct guesses | One result and one credit per player |
| Private prompt leakage | Guesser sees designed tiles/lengths, not plaintext answer or future prompt choices |
| Wrong-role actions | Guesser cannot draw; drawer cannot submit a scoring guess |
| Drawing synchronization | Accepted paths, undo, and clear converge between the two real clients |
| Entire session | Ends at a reachable result screen with working rematch and leave |
| Empty waiting room | Visible exit, never a fabricated human opponent |
| Client bundle boundary | No server-only bank, credentials, or test-clock override included |

### Definition of done

A fresh checkout can run the documented development and verify commands. Two real browser clients complete the eight-turn game without manually editing state or invoking a hidden “award points” endpoint. The visible game is genuinely playable, not a UI demo with simulated online behavior. The report correctly states that persistence is development-only and native devices are not yet certified.

### Do not stop early at

A Vite starter screen, a blank canvas, a mocked opponent, a login mockup, one successful turn with no role swap, tests that call only a pure scoring helper, or a checklist with no runnable game.

### Explicitly out of scope

Public internet access, durable production accounts, real-money commerce, ads, Steamworks, public moderation operations, iOS, async mode, competitive rankings, and unrequested repository pushes.

### Escalation signal

After two failed attempts at a deterministic score/phase race or an unclear private-data boundary, isolate that failing test and request diagnosis. Routine UI, schema, and build failures stay on Spark while progress is measurable.

---
