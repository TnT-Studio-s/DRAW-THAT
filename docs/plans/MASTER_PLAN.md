# Draw Duo: Cross-Platform Game and Spark-First Build Plan

**Version:** 2.0, September 9, 2026  
**Status:** implementation specification, not implemented or tested software  
**Working title:** Draw Duo. Final name, trademarks, app identifiers, and store availability are not cleared.  
**Initial products:** Windows desktop application and Android application  
**Distribution:** Windows testing builds first, Steam later; Google Play for Android; iOS much later  
**Default implementation model:** `gpt-5.3-codex-spark`, subject to actual availability in the user's Codex client  
**Execution style:** six LARGE phases. One phase request authorizes all of that phase's internal work, testing, and normal fixes, not a succession of tiny permission requests.

## Navigation

[Locked decisions](#1-decisions-that-are-already-settled) | [Gameplay](#2-gameplay-specification) | [Architecture and cross-play](#3-architecture-and-one-shared-population) | [Networking and recovery](#4-authority-networking-and-recovery) | [Accounts and integrity](#5-accounts-data-and-reward-integrity) | [Repository and commands](#6-repository-structure-and-implementation-contracts) | [Headless testing](#7-headless-testing-and-evidence) | [Spark workflow](#8-spark-first-execution-policy) | [Six phases](#9-six-large-phases-at-a-glance)

[Phase 1](#phase-1-build-the-complete-playable-foundation) | [Phase 2](#phase-2-ship-windows-and-android-test-builds-with-real-cross-play) | [Phase 3](#phase-3-add-persistent-accounts-progression-and-player-safety) | [Phase 4](#phase-4-complete-the-closed-beta-product-and-its-operations) | [Phase 5](#phase-5-harden-the-game-and-produce-a-release-candidate) | [Phase 6](#phase-6-prepare-android-and-steam-distribution-then-release-under-approval)

## How to use this plan

For a new project, place this planning pack in the selected project folder. Read `START_HERE.md` and give Codex the Phase 1 kickoff prompt. No source repository, cloud account, store listing, or application has been created by preparing these files.

The master plan is the authoritative design. The files `phase-01.md` through `phase-06.md` are focused execution extracts, not six alternative designs. The files under `docs/specs/` are shorter reading units extracted from this master. Read only the active phase, its required specification sections, and the files being changed. Do not reread the entire planning pack after every edit.

This version supersedes the earlier Android-first plan where they disagree. In particular, use the agreed web-based React stack, add Electron, require cross-play, use equal personal coins and a persistent duo streak, and use a Draw Something-inspired letter bank. Do not follow the earlier full-keyboard-only answer rules or Android-only architecture by accident.

---

## 1. Decisions that are already settled

| Decision | Implementation requirement |
|---|---|
| Game type | Two people cooperate, alternating drawing and guessing. They are teammates, not individual opponents. |
| Live play | The guesser sees incoming strokes while the drawer is still drawing and can guess immediately. |
| Starting platforms | Windows and Android are supported together, not separate implementations or player populations. |
| Shared client | React + TypeScript + HTML Canvas. This is web React, not React Native. |
| Windows packaging | Electron. Bundle the client assets in an installed application. Prepare a Steam distribution later. |
| Android packaging | Capacitor. Use the same game client, adapted to touch and the mobile viewport. |
| Future Apple support | Preserve platform boundaries for Capacitor iOS, but do not make iOS implementation a launch dependency. |
| Cross-play | One logical public matchmaking population, shared accounts, shared protocol, shared gameplay rules, shared backend. |
| Backend | A Node.js/TypeScript Colyseus game service, PostgreSQL for persistent data, and Supabase Auth for production identity. |
| Scoring | A solved easy/medium/hard word gives EACH player 1/2/3 coins. The team's session score increases by 1/2/3 once. |
| Partnership progression | A persistent successful-turn streak for each duo, with explicit failure and interruption rules. |
| Entry | Hangman-style slots plus a scrambled bank of answer letters and decoys. Mouse, touch, and physical keyboard use the same bank. |
| Finding players | Quick Partner uses the shared pool. Create Room / Join Code works between Windows and Android. |
| Testing | Terminal-driven, headless by default. Never take over the user's desktop automatically. |
| Development | Spark does the bulk of implementation. Use a stronger model only for an identified blocker or a narrow high-risk review. |
| Scope discipline | No Unity, React Native rewrite, parallel alternate client, peer-hosted scoring, or platform-only matchmaking. |

**Cross-play is a product requirement, not a future feature.** Every platform must join the same kind of room and receive the same reward treatment. An Android player can match with Windows; a Steam-installed Windows player can use a friend code made on Android; a future iOS player joins that same population.

The platform technologies support these distribution approaches, but sharing a codebase does not remove platform testing. Electron packages the desktop app; Capacitor supplies native mobile projects and integration boundaries. [S1][S2]

### Deliberate scope choices

Borrow the cooperative reward structure, three difficulty choices, letter tiles, and partnership relationship from the earlier discussion. Keep the user's original live drawing and timer. Do not silently turn this into an asynchronous drawing-mail game.

Eight-turn sessions provide a clean playtest, result screen, and exit point. The partnership and its streak continue across sessions. Finishing a session does not mean the relationship ends.

Purchasable bombs, gameplay-changing color unlocks, asynchronous turns, public ranked leaderboards, 2v2, public galleries, voice chat, and free-text social chat are **deferred**, not accidentally forgotten. The core launch does not sell hints or give one platform better tools. A future assisted friend mode would need its own clearly labeled rules, not another public queue at launch.

---

## 2. Gameplay specification

### 2.1 A complete session

Home -> Quick Partner or Create/Join Code -> Partner found -> Both ready -> Select word -> Countdown -> Live drawing and guessing -> Reveal and rewards -> Swap roles -> Repeat -> Session results -> Mutual rematch or leave.

Use these configurable, initially fixed values:

| Setting | Initial value |
|---|---|
| Players per room | 2 |
| Turns per session | 8, four drawing turns per person |
| Initial drawer | Server-randomized; alternate first drawer on a mutual rematch |
| Word choices | One easy, one medium, one hard, all private to the drawer |
| Selection time | 10 seconds |
| No selection | Automatically choose that turn's offered easy option |
| Countdown | 3 seconds |
| Active drawing/guessing | 60 seconds, the same for all difficulties |
| Reveal/intermission | 5 seconds |
| Ready check | 20 seconds, then release unclaimed seats |
| Rematch vote window | 30 seconds, then return to usable results/home |
| Unused friend-code life | 10 minutes |
| Reconnect reservation | 30 seconds from a detected drop; never replenished by flapping during that unresolved turn |
| Accepted guess interval | At least 1 second, enforced by the server |
| Public launch ruleset | One English-language standard casual ruleset |

These are proposed tuning values. They are not measured balance or performance findings. Keep them in a versioned server rules configuration and mirror only public values to clients. Tests must cover the configured behavior.

Success ends the active turn early. Wrong guesses do not end it. Timeout and Pass reveal the answer and move the game forward with no new coins. Never require a correct answer indefinitely before allowing the next turn.

Only the guesser can confirm Pass. The drawer cannot force a word reroll after seeing the prompt by pressing Pass. Either player may leave, subject to the abandonment rules below. Pass uses a simple confirmation and leaves the live server clock running while the confirmation is open.

### 2.2 Three distinct numbers, without three competing players' scores

For a successful turn with difficulty `d` in `{1, 2, 3}`:

```text
A's earned coins for the turn = d
B's earned coins for the turn = d
Team session points gained   = d
Duo successful-turn streak   = previous streak + 1
```

| Word value | Drawer receives | Guesser receives | Team score gains |
|---|---:|---:|---:|
| Easy | 1 coin | 1 coin | 1 point |
| Medium | 2 coins | 2 coins | 2 points |
| Hard | 3 coins | 3 coins | 3 points |

Example: A begins with 20 coins and B with 7. They solve a hard word. Their balances become 23 and 10, their session score increases by 3, and their duo streak increases by one. The shared session score does not increase by 6.

Eight hard successes produce a 24-point session and 24 earned coins per person. Coins already in an account from earlier sessions are not part of that session's score. Failed turns do not subtract previously earned coins.

Show a personal wallet on profile/shop screens. During play emphasize the team score and duo streak. On reveal show `You earned 3 coins / Partner earned 3 coins / Team +3`. Never imply that partners are racing their personal wallets against each other.

No speed multipliers, streak multipliers, negative wallet penalties, paid score boosts, or click-count rewards in the first release. Cosmetic earnings are not a credible skill ranking because teammates can share answers outside the app.

### 2.3 Streak and interruption rules

Define a duo by the sorted pair of persistent player IDs plus the gameplay ruleset family. Room platform and store are not part of that identity. Save session source, exact rules version, and friend/public context separately for analysis. There is no public competitive leaderboard in this release.

| Event | Wallet behavior | Duo streak behavior |
|---|---|---|
| Valid correct guess | Both gain `d` once | Increase by 1 |
| Incorrect guess | No change | No change |
| Timer expires | No new reward | Reset current streak to 0; retain best |
| Guesser confirms Pass | No new reward | Reset current streak to 0 |
| Finish eight turns normally | Retain all rewards | Preserve current streak for the next session together |
| Leave at results or before a new prompt is exposed | Retain all rewards | Preserve streak |
| Reconnect within allowance | No special reward | Continue the same unresolved turn without extra time |
| Deliberate leave after a prompt was exposed, or failed reconnect for that turn | Retain committed rewards; unresolved turn earns 0 | Record abandoned failure and reset current streak |
| Confirmed server/infrastructure failure | Retain committed rewards; do not invent an uncommitted win | Annul the unresolved turn and preserve the last committed streak |

Do not classify an individual client disconnect as a server fault. Otherwise a player could repeatedly unplug the connection to protect a streak or fish for easier words. Equally, do not ban someone for a single normal mobile connection problem.

If a resolved turn is waiting at intermission when someone drops, hold there within the remaining reconnect window. Do not expose the next prompt until both players return. If no new prompt was exposed, do not manufacture an abandoned failure for a nonexistent next turn.

A best streak is a private partnership accomplishment, not proof that neither person cheated. One account may own only one active play session at a time. Separate devices must not let an account play both sides of a room.

### 2.4 Session result and progression

The result screen shows team points, solved turns out of eight, coins earned by each player during this session, current/best duo streak, and rematch/leave actions. Optional medal labels use 8/12/16/20/24 as thresholds. Below eight, show progress without removing earned rewards.

Use earned coins as a non-tradable cosmetic currency. Do not add another XP currency just to increase system count. A later profile level can derive from lifetime gameplay coins earned, not remaining wallet balance; initial formula: `1 + floor(lifetime_gameplay_coins / 50)`. Spending coins never lowers level.

Starter earn-only catalog in Phase 3: avatar frames, UI themes that preserve canvas contrast, profile titles, and restrained celebration effects. Example test prices are 20, 40, and 80 coins. These prices are configuration, not a committed commercial economy. All players receive the same drawing palette, brush widths, eraser, undo, and canvas dimensions.

### 2.5 Letter slots and letter bank

Use real DOM buttons for tiles and controls. For `TRAFFIC JAM`, show seven slots, a word gap, and three slots. Generate the bank server-side from every required answer letter, including repeated letters, plus four random decoy tiles. Shuffle once per turn with a server-owned random source; reconnect restores that same bank and tile IDs.

Each tile has an opaque ID and a displayed letter. Consuming one `F` tile does not consume another `F`. A selected tile moves into a slot; tapping the slot returns that exact tile. Provide Backspace, Clear Answer, and Submit. Preserve the current draft after a wrong answer so the guesser can edit it.

On desktop, physical keyboard letters consume matching unused tiles from the same bank. Enter submits; Backspace returns the last selected tile. Input handlers work only while the guess panel has focus and must not hijack browser/app shortcuts or account fields. Android uses the on-screen tiles by default, avoiding an unnecessary system keyboard over the canvas.

Only submit when all answer-letter positions are filled. A wrong guess returns neutral feedback, not a list of correctly positioned letters. The drawer sees a generic guessing indicator, not arbitrary submitted text.

**Alias rule:** the initial tile mode accepts the canonical normalized answer, with spaces, case, and approved punctuation formatting normalized. It does not promise acceptance of different-letter synonyms such as SOFA for COUCH, because their required tiles and slot counts differ. Do not import the earlier free-text alias behavior. Choose unambiguous prompts and use slot lengths as a clue; support a richer alias system only after a separate input design change.

Initial English content uses A-Z and spaces, 3-16 letters excluding spaces, at most four words. The 16-letter cap plus four decoys caps the bank at 20 tiles. Do not accept client-provided difficulty, answer text as an authoritative result, or a rewritten letter bank. Server validation checks tile IDs, multiplicities, current turn, role, and the resulting complete answer.

The bank intentionally leaks an anagram clue. Hidden-answer tests must allow that designed clue while forbidding direct canonical answers, future prompts, reusable word IDs, and secret seeds before reveal.

### 2.6 Drawing and interaction

Start with eight high-contrast colors, three brush widths, eraser, undo-last-stroke, and clear-with-confirmation. No text tool, pasted images, imported pictures, stamps, fill bucket, layers UI, or user-uploaded assets in the first release.

The rule is to draw the concept rather than write its name. Removing a text tool does not stop handwriting or voice-call collusion; do not claim automated cheat detection solves that.

Use a square logical canvas on every platform. Letterbox or resize its display box, but do not stretch its aspect ratio or change how much of the drawing a platform can see. The local drawer's pen appears immediately, without waiting for the server. The remote canvas receives accepted ordered strokes.

Handle pointer capture, pointer cancellation, pen-up outside the canvas, touch scrolling conflicts, resizing, display scaling, and a second accidental touch. No React component rerender for every recorded point: keep stroke data and the renderer in an imperative drawing module, and use React for surrounding UI state.

Windows supports a real desktop layout, mouse drawing, keyboard guessing, resize, windowed/fullscreen controls, and a readable results screen. Fullscreen is a player option, never a testing default. Android is portrait-first with safe-area insets and reachable thumb controls. Accessibility includes labeled buttons, focus states, scalable text, adequate contrast, reduced motion, and mute; do not claim that the drawing challenge itself has equal accessibility for every disability.

---

## 3. Architecture and one shared population

### 3.1 Chosen stack and its boundaries

| Layer | Choice | Owns |
|---|---|---|
| Shared UI | React, TypeScript, Vite | Screens, DOM tiles, local UI state |
| Drawing | HTML Canvas and shared TypeScript drawing module | Geometry, stroke replay, immediate local rendering |
| Desktop | Electron, initially Electron Forge packaging | Windows process, secure bridge, bundled assets, platform integration |
| Mobile | Capacitor | Android native project, lifecycle integration, later platform SDK bridges |
| Real-time authority | Node.js/TypeScript and Colyseus | Rooms, actions, answer checks, timers, score decisions, canvas event order |
| Persistence | PostgreSQL, reviewed SQL migrations and parameterized queries | Accounts, wallets, ledger, duo records, sessions, moderation records |
| Production identity | Supabase Auth | Anonymous/recoverable identities and verified login sessions |
| Unit/integration tests | Vitest and real server/client harnesses | Rules, protocol, services, database behavior |
| UI automation | Playwright | Two independent headless browser clients and responsive UI tests |
| Infrastructure | One always-on game-service deployment to start | Shared HTTPS/WSS endpoint and room hosting |

Colyseus is intended for authoritative multiplayer rooms and state synchronization. Supabase Auth supports anonymous accounts and upgrade paths. Use those existing mechanisms rather than inventing a production password system. [S3][S4]

Supabase is not the live drawing relay. Do not write every pen point into its database or replace the room server with database-row subscriptions. The room service handles the active game; PostgreSQL handles durable results and account operations.

The architecture is selected. The paid hosting vendor and instance size are not. Phase 4 selects an always-on host with supported persistent WebSocket connections, sensible deployment/draining behavior, and measured capacity. Managed PostgreSQL and Supabase Auth are the initial managed-service preference. No signup, charge, or production deployment is authorized by this plan alone.

Use a local game process and local/test PostgreSQL while building. Hosting price and supported concurrency remain unknown until measured. Do not invent a dollars-per-player or rooms-per-server guarantee.

### 3.2 The shared-pool contract

One Quick Partner service feeds all compatible released clients. Its logical key is the ruleset/language/protocol compatibility domain, **not** `android`, `windows`, `steam`, `ios`, input method, payment tier, or store.

At initial launch use one English casual mode in one service region. Matching checks real eligibility: authentication, ready status, compatible rules/protocol, block relationships, and required audience/safety restrictions. Region/latency can be a soft preference, but do not partition queues by platform. Never mix languages or override safety restrictions just to call it one pool.

One logical population does not mean one machine forever. When scaling is justified, room workers can multiply behind coordinated matchmaking. Do not add Redis, Kubernetes, global multi-region routing, or separate platform services before measurements show a need.

Test actual pairings, not just a `platform` string. Changing a test user's tag to `android` proves a queue filter ignores that tag; it does **not** prove the APK can connect. The release gate includes a packaged Windows client and an installed Android client completing the same session.

Private friend rooms reserve two people from that population. They are not a second public matchmaking queue. Cross-platform friend codes use exactly the same server admission path.

### 3.3 Protocol compatibility across staggered store updates

Android and Steam releases may become available at different times. Plan for a compatibility window, rather than creating an Android queue for one version and a Steam queue for another.

Handshake includes client build ID, protocol version/capabilities, chosen language, and public platform metadata. The server returns selected protocol capabilities, rules version, and minimum supported build information. Reject an unsupported client **before** pairing with a clear Update Required screen.

Begin with one protocol major version. Prefer additive optional capabilities within its supported window. Generate and test explicit schemas for supported versions; do not accept arbitrary unknown command fields in the name of forward compatibility. Feature activation waits until all supported platforms implement it. Freeze rules and content version for an active session.

Mandatory compatibility tests: current Windows + current Android; new Windows + supported older Android; supported older Windows + new Android; unsupported version rejected without consuming a seat. The exact supported window is a release policy set from available builds, not a guessed permanent duration.

### 3.4 Cross-play versus cross-progression versus store ownership

Cross-play works even when two different people use different stores. Cross-progression requires the **same person** to sign into a linked account on each device. Anonymous installation identities are not automatically the same person.

Use a recoverable login, initially email one-time code through Supabase Auth, to reuse an account on another device. Do not match accounts by display name or silently merge wallets when emails or Steam identities conflict. New-device login must offer signing into the existing identity, not mint duplicate rewards.

Steam ownership, Google Play purchase receipts, and future Apple entitlements are platform-specific evidence. Do not promise that buying an app on one store buys the other store's app. Shared gameplay-earned coins and owned earned cosmetics belong to the game account. Paid entitlement sharing must follow the store-specific integration and verified policy later.

Steam can be a distribution channel without becoming the only identity or networking service. Optional Steam sign-in/achievements later must not replace universal invitations or exclude Android players.

---

## 4. Authority, networking, and recovery

### 4.1 Never trust a client outcome

The server owns identities, room membership, actor roles, prompt choices, answers, active deadlines, accepted guess decisions, score, rewards, streaks, and inventory mutations. A client requests an action; it cannot announce that it won or change its wallet.

Shared packages may contain pure scoring functions and message definitions. The client must never import the server word bank, canonical selected answers, aliases, random selection seeds, database credentials, signing keys, admin secrets, or future choices.

Ordinary synchronized Colyseus state is shared unless filtered. Keep secrets outside that public schema and send the three choices and selected prompt only to the authenticated current drawer. Do not assume a hidden UI element, private-room flag, or minified bundle makes data secret. [S5][S6]

### 4.2 Explicit state machine

```text
WAITING -> READY_CHECK -> SELECTING -> COUNTDOWN -> DRAWING
DRAWING -> RESOLVING -> REVEAL -> SELECTING ... -> RESULTS -> CLOSED
Any nonterminal state -> ABORTED or SERVER_ERROR when its defined failure policy applies
```

Every transition checks the expected phase and current turn ID. Every timed phase has a server deadline and a bounded exit route. `RESOLVING` exists for authoritative persistence, not for indefinite waiting on a client.

Use a monotonic server clock for active deadlines; send a wall-clock projection/server-time sample for UI countdown display. The client clock cannot extend a turn. A guess is eligible only if its authoritative server ingress time is strictly earlier than the active deadline. Equality is late.

Route room commands and deadline events through a serialized event path, with well-defined ordering. Mark a turn as resolving before asynchronous database work. A correct guess and a timeout must not both award or both reset it. Do not let an `await` create two concurrent winning handlers.

### 4.3 Drawing transport

Send vector stroke commands, not a screenshot every frame. Each command is scoped by room/session, turn, canvas generation, authenticated connection epoch, stroke ID, and sequence. The server derives the actor from the verified connection.

Start with normalized integer coordinates `0..65535`, a palette index, one of the approved widths, and a tool enum. Widths are logical canvas units, not display pixels. Render the same canonical geometry everywhere.

Initial tunable limits: about 20 stroke batches per second, up to 64 points in a batch, 16 KiB maximum command payload, 12,000 accepted points and 512 strokes per turn, and a bounded canonical turn history of approximately 2 MiB. Validate numeric finiteness, ranges, IDs, enums, message size, and rate before allocating large arrays. Tune limits against actual finger/stylus traces and low-end device measurements; they are proposed safeguards, not benchmark results.

Local prediction uses stroke/action IDs so an echoed accepted stroke is not drawn twice. Coalesce or simplify over-dense pointer samples without erasing useful corners. Never silently drop the final stroke endpoint. Show a recoverable limit/rate warning rather than crashing or growing memory indefinitely.

Undo and Clear are ordered server commands. Clear increments `canvasGeneration`, making older delayed messages invalid. Undo targets only the drawer's most recent accepted complete stroke in that turn. Preserve sufficient ordering metadata that delayed batches cannot restore an undone or cleared stroke.

On reconnect, send a bounded canonical canvas snapshot at event sequence `S`, then accepted events after `S`. Include an acknowledgement or a safe snapshot retry path if the bounded delta buffer overflows. Custom drawing-message history is not automatically recovered by a normal shared-state snapshot. Compare canonical state between clients and server in tests, not only screenshots.

Disable or discard offline gameplay command buffering. A guessed word typed while disconnected must not be replayed into a later turn. On reconnect, reconcile server state, canvas generation, and turn before reenabling input. Reconnection support from the framework still requires these game policies and refreshed token handling. [S7]

### 4.4 Private prompts and predictable word selection

For each selection phase, the server issues three opaque single-turn choice tokens to the drawer. Tokens are bound to actor, session, turn, difficulty option, and expiry. The client cannot substitute another word ID or difficulty.

Send the selected word privately to the drawer and the public slot lengths/bank to the guesser. Do not put answers in room names, URLs, analytics names, source maps, message type names, or deterministic hashes clients can reverse by dictionary lookup. Reveal the canonical answer to both only after resolution.

Exclude used words within a session. Prefer not to reuse words recently exposed to either player, with a documented fallback when the eligible pool is small. Fix content and rule versions for the session. Use a seeded random source in isolated tests; production choice randomness must not use a client-controlled seed.

### 4.5 Reconnect, leaving, and infrastructure failure

Reserve the correct player's seat for 30 seconds after a drop. Continue the existing active timer. Refresh reconnect tokens according to the pinned SDK behavior and bind them to account/seat ownership. An invitation code is not a reconnect token.

Do not start new prompts with a missing player. Do not reroll or add time after reconnect. Explicit Leave ends the seat immediately and applies the exposed-prompt failure rule. Temporary connection problems should offer Reconnecting, remaining allowance, and a visible exit.

If the server process dies, the initial product does not promise to resume an in-flight drawing. Committed turns/rewards survive; the active session is finalized as incomplete or server-error after reconciliation. The client returns to home/results and can requeue. Do not recreate a previously exposed turn as a fresh scored attempt.

Handle planned deployments by stopping admissions and draining active rooms within a bounded maintenance window. Add distributed room recovery only when justified. A single always-on instance is an initial hosting strategy, not a high-availability claim.

---

## 5. Accounts, data, and reward integrity

### 5.1 Identity stages

Phase 1 may use loopback-only development identities and in-memory persistence. Clearly label that mode as disposable. Its API must refuse nondevelopment deployments. Phase 2 phone testing can use USB forwarding into that local backend; do not expose development login publicly just to make a device connect.

Phase 3 introduces Supabase Auth and real PostgreSQL. Anonymous login provides low-friction play, while account linking/recoverable login protects progress. Anonymous users need abuse limits and are not automatically recoverable after local credentials are lost. [S4]

The game server verifies JWT signatures and issuer, audience, expiry, and applicable session/account restrictions using supported provider/JWT libraries. Plan for key rotation and revoked/suspended accounts; do not decode without verification or write custom cryptography. Provider JWT documentation describes verification and trust boundaries. [S8]

Separate a stable internal `player_id` from display names and store IDs. Use secure platform storage boundaries for durable refresh credentials; never treat an unencrypted client preferences file as a tamper-proof wallet. UI caches may be modified locally without modifying server balances.

No shared device fingerprint or common IP is sufficient proof that two accounts are the same person or cheaters. A single active play-session rule is an account concurrency constraint, not household surveillance.

### 5.2 Minimum persistent model

| Entity | Important data and invariants |
|---|---|
| `players` | Stable ID, auth subject mapping, generated/moderated display name, account status, accepted terms version |
| `account_links` | Verified provider subject mappings; uniqueness per provider identity; no silent merge |
| `wallets` | Player ID, nonnegative integer earned coin balance, lifetime gameplay coins, revision |
| `wallet_ledger` | Delta, reason, turn/purchase reference, unique idempotency key; append-only normal accounting |
| `duos` | Sorted player pair, rules family, current/best streak, successful turns, completed sessions, revision |
| `sessions` | Two players, entry context, protocol/rules/content version, start/end/status, final team score |
| `turns` | Session + turn number unique, drawer, selected prompt server-only, outcome, points, resolution ID |
| `cosmetic_catalog` | Item ID, server price, type, enabled/version flags, gameplay-neutral properties |
| `player_cosmetics` | Unique player/item ownership and equipped values |
| `blocks` | Blocker/blocked IDs unique; matching checks both directions |
| `reports` | Reporter, subject, session/turn, category, evidence pointer, review status and audit dates |
| `moderation_actions` | Authorized staff action and audit trail; not client-editable |
| `store_transactions` | Later: provider, unique transaction ID, verification state, entitlement and reversal linkage |

Do not persist every live point through PostgreSQL. Keep the active canvas in bounded room memory. Save restricted evidence when reported or explicitly needed under the declared retention policy. Routine telemetry must not contain full answers, tokens, or raw guesses.

Use a private database schema/server role for wallets, prompts, and moderation. If a browser-accessible database API is enabled, row-level security and grants must deny unauthorized reads/writes; do not rely on hiding a service key in JavaScript. Clients call the game API for wallet/catalog operations, not direct balance updates.

### 5.3 Transactional turn resolution

Use one database transaction to record a finalized turn, both players' rewards, both ledger rows, and the duo streak update. Resolve locks in a consistent order. Define a unique turn-resolution/idempotency key before retries.

Conceptual algorithm:

```text
Serialize the room's resolution decision.
Begin transaction.
Insert the unique finalized turn outcome.
If that turn was already committed: return the recorded outcome, without new rewards.
Lock/update wallet rows in stable player-ID order.
On success: credit each player d, append unique ledger rows, increment duo streak.
On failure: credit neither player and reset current streak as specified.
Update best streak and session totals consistently.
Commit.
Publish the committed result and wallet revisions to clients.
```

The actual SQL must be tested against real PostgreSQL, including simultaneous duplicate requests, crash/disconnect after commit, retries after an unknown commit outcome, and insufficient-balance purchases. Never claim network delivery is exactly once. Achieve **effectively-once durable effects** with unique constraints, transactions, and idempotency.

If persistence fails, keep the UI usable and report syncing/failure honestly. Reconcile by resolution ID before deciding that an uncertain transaction failed. Never show spendable credited coins solely because an optimistic browser animation played. Client acknowledgements are not required to keep a committed reward.

Earn-only cosmetic purchases similarly validate server price and balance, debit and grant ownership transactionally, and deduplicate repeated purchase IDs. A client supplies item ID and request ID, not the price or resulting balance.

### 5.4 Recovery and deletion

Provide clear account recovery/linking guidance and a way to delete an account. Define treatment of report evidence, financial/provider records if any, and anonymized duo history in the policy; do not promise immediate erasure of every legally retained record. Google Play's account-deletion policy can require both an in-app path and a web resource for apps offering account creation. Verify applicability and implementation before launch. [S9]

Database migrations need version tracking, backup/restore instructions, and a tested restore exercise. Development data does not migrate into public real-money or production-reward accounts automatically. Document any disposable alpha reset before inviting testers.

---
## 6. Repository structure and implementation contracts

Use one separate repository. Do not modify Beat That, Echo Depths, HollyCast, or another project merely because prior code might be reusable. Inspect any proposed reusable module and its license/API behavior before copying it. No assumed access to those repositories is part of this plan.

Use npm workspaces and one committed lockfile to minimize unnecessary toolchain setup. Verify compatible current dependencies during Phase 1, record the tested versions, and pin the environment. Do not guess a latest Node, Electron, Capacitor, Colyseus, Java, or Android SDK version from this document.

```text
apps/
  web/                         Shared React client and Vite assets
    src/screens/               Home, lobby, game, results, profile, shop, settings
    src/components/            Accessible reusable controls and letter slots
    src/game/                  Client room controller and server-state projection
    src/platform/              Browser/default adapter implementation
  desktop/                     Electron main/preload, Forge config, Windows resources
  mobile/                      Capacitor config and generated Android project
  server/
    src/rooms/                 GameRoom and room-state projection
    src/matchmaking/           Shared queue, seat reservations, invitation admission
    src/auth/                  Dev-only and verified production adapters
    src/game/                  Server transition/turn-resolution coordinator
    src/content/               SERVER-ONLY prompt bank and content selection
    src/persistence/           SQL-backed repositories, ledger and transactions
    src/moderation/            Reports, blocks, evidence, authorized admin endpoints
    src/http/                  Health, account, catalog, version and admin routes
  admin/                       Restricted moderation/content dashboard, Phase 4
packages/
  protocol/                    Runtime message schemas and public wire types
  rules/                       Pure score, streak, normalization and transition rules
  drawing/                     Stroke geometry, canonical replay and Canvas renderer
  platform/                    Typed capability interfaces; no native imports in core
  testkit/                     Test fixtures and authorized local/test clients only
scripts/                       Portable Node launch/build/verify scripts
infra/                         Local PostgreSQL, container build, deployment templates
migrations/                    Ordered reviewed SQL migrations
content-review/                Authoring/review materials, not included in client builds
tests/                         Logical suite directories listed below
  integration/
  e2e/
  packaging/
  security/
  load/
docs/
  plans/                       Master plan and six phase briefs
  specs/                       Focused design reference extracts
  STATUS.md                    Exact progress and outstanding gates
  DECISIONS.md                 Decisions and justified changes
  HANDOFF.md                   Short continuation entry point
  TEST_MATRIX.md               Requirements mapped to real tests/evidence
  REVIEW_PACKET.md             One focused blocker/audit handoff
  ENVIRONMENT.md               Verified tools, versions, commands, output paths
  RELEASE_CHECKLIST.md          Public/store release gates
```

No directory is a requirement to create empty scaffolding for its own sake. Add modules when the active phase uses them.

### Module boundaries

`rules` must not import React, native wrappers, database clients, or the word bank. `protocol` must not contain private prompt content. `drawing` must not know about billing or authentication. The browser bundle must not import server source even through a convenient root barrel export.

Keep room orchestration separate from pure rule calculation and durable reward persistence. Avoid a giant `GameRoom.ts` that contains UI assumptions, SQL, drawing algorithms, auth, and all content. Split by responsibility when actually needed, not into hundreds of one-line abstractions.

Define a small platform adapter for `platformId`, capabilities, lifecycle notifications, safe external links, fullscreen on desktop, secure credential persistence, and later optional store/ads functions. The web default reports unsupported native features explicitly. Do not scatter `if android / if steam` throughout scoring or matchmaking.

### Message contract sketch

These are design contracts, not version-specific SDK code to paste without validation:

```ts
type Difficulty = 1 | 2 | 3;
type PlatformId = 'web-dev' | 'windows' | 'android' | 'ios';
type TurnOutcome = 'solved' | 'timeout' | 'passed' | 'abandoned' | 'annulled';

interface ActionScope {
  sessionId: string;
  turnId: string;
  actionId: string;
  connectionEpoch: number;
}

interface GuessRequest extends ActionScope {
  selectedTileIds: string[];
}

interface CommittedTurnResult {
  resolutionId: string;
  turnId: string;
  outcome: TurnOutcome;
  revealedAnswer: string;
  teamPointsAwarded: 0 | Difficulty;
  coinsAwardedPerPlayer: 0 | Difficulty;
  currentDuoStreak: number;
  bestDuoStreak: number;
}
```

Authenticate connections independently of message fields. Runtime schemas must validate all incoming data, not merely annotate it with TypeScript. Rejected actions return stable error codes and safe messages; never dump raw server errors, SQL, keys, or secret room objects to a player.

### Script contract

The following commands are **interfaces that implementation must create**, not commands this planning task has executed. A script must either do the stated work or report a clear unsupported/missing prerequisite condition. Never create a script that just prints a success message.

| Command | Required behavior |
|---|---|
| `npm run doctor` | Check project-local tooling and print versions/prerequisites without changing global config |
| `npm run dev:headless` | Start development web/server without opening browser or Electron windows |
| `npm run dev:desktop` | Explicit opt-in visible Electron development app |
| `npm run dev:mobile` | Development mobile asset build/sync; do not auto-open Android Studio |
| `npm run lint` | Static lint checks |
| `npm run typecheck` | All active workspaces compile their types |
| `npm run test:unit` | Noninteractive pure-rule/drawing/schema tests |
| `npm run test:integration` | Real Colyseus clients/server tests, later real PostgreSQL tests |
| `npm run test:e2e` | Headless two-browser user-flow tests, bounded workers |
| `npm run test:security` | Unauthorized actions, answer leakage, private admission, bundle boundary checks |
| `npm run build:web` | Shared production client assets |
| `npm run build:server` | Server build, not a client containing server source |
| `npm run build:windows` | Packaged Windows app with bundled assets, no running dev server required |
| `npm run android:sync` | Build shared assets then sync the Capacitor Android project |
| `npm run build:android:debug` | Command-line Gradle debug APK with an explicit output path |
| `npm run build:android:release` | Release bundle; fail honestly when signing/configuration is absent |
| `npm run test:desktop` | Dedicated-runner Electron smoke tests; not part of default local visible UI |
| `npm run test:android` | Dedicated device/emulator smoke tests; report exact device/API coverage |
| `npm run test:load` | Authorized development/staging load harness, with explicit target and limits |
| `npm run verify -- --phase N` | Check that phase's required suites/artifacts and report missing gates |

`verify` must not hide missing tests by using pass-with-no-tests options. Preserve exit codes. Separate `code_verified`, `artifact_built`, `device_tested`, and `release_approved` in structured output. A missing phone is not a passed Android test.

Use portable Node scripts for process orchestration and argument parsing. Avoid OS-specific shell chains in scripts intended for both Windows and CI. Resolve Java/Android SDK paths from the tested environment; never hard-code a user's home directory or device serial. Track child PIDs and terminate only this test run's processes. Do not kill every Node/Java process on the machine to free a port.

---

## 7. Headless testing and evidence

### 7.1 What “without using my computer” means operationally

Default automated work must not move the user's mouse, press global keys, open browser tabs, launch an editor GUI, bring a game fullscreen, or capture the entire desktop. Run logic, protocol, and web UI tests headlessly. Playwright's browser tests support that workflow. [S10]

Headless tests still consume the CPU/RAM of their host. To remove that load from the primary PC, run the same commands on the user's dedicated second machine, an approved VM, or a CI runner. This plan defines portable commands; it does not claim a remote runner is already provisioned or silently use another computer.

Native shell tests remain separate. Playwright's Electron automation is marked experimental and is not a promise of invisible, cross-platform native validation. Run it on a dedicated Windows test session/runner. Android emulator/device automation also needs an actual Android environment. [S11]

A mobile-sized Chromium browser is useful responsive coverage, not an Android WebView or native SDK test. Linux Chromium/Electron checks do not certify Windows packaging. A test screenshot is an artifact for review, not proof that Spark visually inspected it.

### 7.2 Test layers and first responsibilities

| Layer | Runs from terminal? | No visible main-desktop UI by default? | Proves |
|---|---|---|---|
| Pure TypeScript tests | Yes | Yes | Rules, scoring, tile consumption, canonical drawing behavior |
| Real room integration | Yes | Yes | Two authenticated/test clients, messages, roles, private data, timers |
| Real PostgreSQL integration | Yes | Yes, on approved local/CI service | Constraints, transactions, duplicate rewards, purchase races |
| Two-browser Playwright | Yes | Yes | Actual user flow and responsive shared client behavior |
| Electron shell automation | Yes | Dedicated test session | Bundled app/bridge/lifecycle behavior on tested OS |
| Android instrumentation/WebView smoke | Yes | Dedicated device or emulator | Android packaging, lifecycle and native integration |
| Human/visual review | Separate checkpoint | Only with user authorization | Drawing feel, readability, unusual native behavior |

The two-browser test creates two isolated browser contexts and identities against a real running room service. It must not call the scoring function directly and label that an online match. Test drawings can use known prerecorded pointer paths and guesses from a server-side test fixture. They are not AI opponents and do not prove the game can autonomously understand a human drawing.

### 7.3 Deterministic tests

Use injected clocks for fast deadline tests and repeatable server-only seeds in test mode. The tests should not sleep through eight actual one-minute turns. Advance test clocks only through a test harness that is unreachable in production.

Do not make the client calculate the answer to accelerate tests. The test runner can know the fixture; the guesser's delivered network state still must not contain the secret.

For canvas verification, compare ordered canonical commands and selected pixel checkpoints. Exact cross-platform full-image hashes are brittle because rendering/antialiasing can differ. Use an explicit visual tolerance only where justified and never update image snapshots automatically to make failures disappear.

### 7.4 Required artifacts

Each meaningful checkpoint writes concise terminal results, failed-test traces, screenshots of app content only when relevant, test result JSON/JUnit, actual build paths, and a test-matrix update. Redact tokens and personal data. Default traces/videos to failure-only and limit workers so tests do not saturate the main machine.

The final report for a phase distinguishes passed, failed, not run, and environment-blocked checks. “APK built” and “APK tested on a phone” are separate facts. “Browser cross-play passed” and “packaged Windows + Android pair passed” are not interchangeable.

Suggested initial performance goals, to measure rather than claim: smooth local pen feedback targeting 60 Hz on reference devices, no repeated long input stalls, bounded memory per room, and remote stroke visibility consistent with measured network delay. Record p50/p95 latency, frame stalls, bytes per turn, room memory, and reconnect outcomes. Do not use a headless software-rendered benchmark as the only device performance result.

---

## 8. Spark-first execution policy

### 8.1 Default model and cost control

Use `gpt-5.3-codex-spark` for implementation whenever it is available and the task is making measurable progress. Confirm the actual active model in the client/session status. A written prompt cannot override the runner's selected model or guarantee quota accounting.

OpenAI's Spark announcement describes targeted, low-latency work, separate rate limits during its preview, and a default style that does not automatically run tests unless requested. This plan therefore names tests explicitly. Check the user's current model availability/usage display rather than assuming an old preview allocation is a permanent entitlement. [S12]

Use the user's working standalone CLI/VS Code Spark setup rather than requiring a second Codex Desktop session. Preserve working global settings. If the user's earlier unsupported `reasoning.summary` issue recurs, verify the installed client's compatible configuration and the known `none` setting rather than repeatedly retrying or silently moving work to another model. Do not rewrite global model configuration as part of game development.

No automatic stronger-model subagents, broad auto-review, or model fallback that spends the regular pool without the owner's approval. Spark availability/rate-limit exhaustion is a checkpoint reason, not permission to substitute another model.

### 8.2 Large phases outside, bounded work inside

A request to “Do Phase 1” means finish Phase 1's complete playable outcome, not just the first checkbox. Internally Spark should work through cohesive modules: inspect relevant files, implement a coherent change, run the focused tests, fix normal failures, checkpoint, and continue into the next internal work item without asking for another prompt.

Internal work items are not separate user-visible phases. Do not stop after generating a project, adding a menu, writing a scoring function, or creating a TODO. Equally, do not make a single uncontrolled repository-wide edit because the user requested a large phase.

Use the active phase's dependency order, while allowing independent work to proceed when one external prerequisite is blocked. Start real networking and tests early; do not spend all the time producing empty interfaces or polishing screens backed by fake multiplayer.

Complete the requested phase, then stop with its outcome and next entry point. Do not automatically start all later phases or publish anything. If the phase cannot finish within the available session/context, save a precise continuation handoff instead of claiming completion.

### 8.3 Model allocation

| Work | Default executor | Boundary |
|---|---|---|
| Project setup, views, forms, tile controls, pure rules, tests, content tooling | Spark | Current specifications and focused tests |
| Defined room handlers, wrappers, simple SQL repositories, protocol DTOs | Spark | Fixed contracts, integration tests, measured changes |
| Account flows, wallets, reconnect, queue races | Spark can implement | Use the specified invariants; narrowly review security/race-sensitive seams before public deployment |
| Persistent race/duplication bug, uncertain authentication trust, platform-only canvas corruption | Stronger model for diagnosis/review if needed | Minimal reproduction and evidence first; return defined implementation to Spark |
| Final public-release security/economy/compatibility audit | Stronger review recommended | Review deltas and evidence, not a full rewrite |
| Store account setup, policy/audience decisions, publishing approval, drawing feel | Owner/human or appropriate reviewer | Do not pretend a coding model can grant credentials or store approval |

There is no defensible fixed percentage of this game guaranteed to fit Spark's capabilities. The goal is that Phases 1-4 are **Spark-led**, with a stronger model used for an actual obstacle or a narrow review, not simply because a phase number got larger.

### 8.4 Escalation rule

For the same failure, allow at most two unsuccessful evidence-based fix/test cycles before stopping speculative edits to that area. Record the exact failing test, reproduction, relevant files/lines, error excerpt, expected invariant, attempts, and the smallest unresolved question. Continue unrelated safe work within the current phase when possible.

Escalate earlier for an unclear auth trust boundary, reward duplication/loss, data exposure, destructive migration, or contradictory requirements. Do not weaken validation or delete a test to remain on Spark.

A stronger-model handoff should request **diagnosis and a constrained patch plan first**. It should not ask the stronger model to reimplement everything Spark already built. Once the issue is defined, Spark can perform the bounded patch and regression tests unless the owner requests otherwise.

### 8.5 Context and session control

Maintain `STATUS.md`, `HANDOFF.md`, and `TEST_MATRIX.md` after each meaningful completed work item. Keep handoffs short: current phase, branch/commit when present, completed modules, remaining modules, exact failing test, relevant paths, and next command.

Before a long context becomes unreliable, write a clean handoff and continue in a fresh Spark session using that file. Do not blindly copy the entire prior conversation into a new session. Do not claim a model can lock a context window, preserve an unlimited session, or switch the owner's active model from within an ordinary prompt.

Never sync a running database, native build cache, or live `.git` internals between test machines as a coordination mechanism. Transfer source through the chosen source-control workflow and fetch build/test artifacts separately. No remote push or PR creation is authorized by a phase request unless the owner explicitly includes it.

### 8.6 Phase completion report

Use this compact structure:

```text
Phase: N / status
Playable result:
Implemented modules:
Tests passed:
Tests failed or not run:
Build artifacts:
Native/device gates:
Known blockers and exact evidence:
Files/branch/commit:
Next entry point:
```

Allowed states: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `CODE_COMPLETE_DEVICE_PENDING`, `VERIFIED`, and `RELEASE_APPROVED`. Use the last state only after real owner approval. An environment blocker is not an excuse to hide completed work, but it is not a passed acceptance gate either.

---

## 9. Six large phases at a glance

| Phase | Substantial result | Default staffing |
|---|---|---|
| 1. Complete playable foundation | Full live two-player game in the shared web client, real local server, coins/streak rules, friend codes, headless full-session tests | Spark |
| 2. Windows + Android cross-play | Packaged Windows app and Android APK, one matchmaking pool, reconnect/canvas recovery, actual cross-device session | Spark, targeted review only for blockers |
| 3. Persistent player game | Recoverable identities, PostgreSQL wallets/ledger, duo history, earned-cosmetic shop, account safety and report/block flows | Spark implementation; narrow sensitive-boundary review |
| 4. Complete closed-beta product | Polished interfaces, expanded reviewed prompts, moderator workflow, staging operations, measured playtesting and compatibility | Spark-led plus content/device/ops review |
| 5. Hardening and release candidate | Adversarial, concurrency, recovery, performance, security and cross-version gates verified | Focused stronger review; Spark executes defined fixes |
| 6. Distribution and release | Android release artifacts and Steam-ready Windows depot/build, policy-compliant optional monetization, controlled shared-backend rollout | Spark for packaging/docs; owner for accounts and release approval |

A missing Android device need not prevent implementing Phase 3's independent database code, but Phase 2 remains device-pending. Do not reclassify it as verified or release a product that has never completed the mixed-platform test.

---

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
## Phase 3: Add persistent accounts, progression, and player safety

**Outcome:** Real players can recover an account, use it on Windows or Android, keep their earned coins and duo records, spend coins on cosmetic items, and report/block unwanted partners. This is a complete persistent game layer, not just a login screen.

**Executor:** Spark implements the specified flows. Authentication, reward transactions, and account-linking boundaries receive a narrow review before public deployment; request a stronger diagnosis only for a concrete blocker.  
**Required reading:** Sections 2-8 and verified prior-phase evidence.  
**External prerequisites:** An approved development Supabase project or supported local auth environment, test PostgreSQL, and configuration supplied through secrets rather than chat/source files. Missing credentials block live-provider verification, not unrelated UI/schema/test work.

### Complete internal work, without separate permission prompts

**A. Replace disposable identities with recoverable accounts.** Implement Supabase anonymous sign-in, terms acceptance, email-code account upgrade/login, account/profile screens, sign-out, and a documented new-device flow. Verify server JWTs and account status. Keep development auth behind strict local/test environment validation, and add a release check that fails if it is enabled. Use a canonical internal player ID across stores. Reject duplicate active game sessions or offer a clear explicit takeover flow that invalidates the old connection epoch.

**B. Introduce durable, transactional game data.** Add PostgreSQL migrations, SQL repositories, player mappings, sessions/turns, duo records, wallets and ledger. Replace the Phase 1 in-memory adapter through its interface, not by spreading SQL throughout client/room code. Commit both player rewards and the duo change together, then publish the result. Test duplicate submissions, two callbacks resolving concurrently, server disconnect after commit, retry with an unknown transaction outcome, and process restart. Never credit only one member of a successful pair.

**C. Finish visible progression.** Add persistent wallet, lifetime progress, duo current/best streak, previous sessions, recent partners, optional profile level, and the earn-only cosmetic catalog. Implement preview, purchase confirmation, insufficient-balance handling, duplicate-safe purchase, ownership/equip, and cross-device refresh. Recent-partner invitations are explicit and respect blocks; do not reveal private room codes or turn histories to unrelated accounts. Do not add a public “best player” leaderboard.

**D. Build actual safety interactions.** Implement report and block from active game and results, immediate hide-drawing/leave, enumerated report reasons, server authorization, restricted report storage, and block checks in both directions for public pairing and codes. Use preset avatars/generated names initially; any editable name is length-limited, validated, and reportable. An ordinary player cannot read the moderation queue. Start a minimal authorized staff review interface or CLI so reports are not a dead-end mailbox; the full workflow is Phase 4.

**E. Add account/data controls and honest states.** Account deletion request, recovery/linking help, offline cache presentation, wallet syncing indicator, unavailable backend state, expiry/re-login behavior, and end-to-end new-device tests. Declare alpha data reset rules. Do not merge unrelated account balances automatically when someone signs into an already-existing identity. Provide a safe, logged support path for genuine conflicts instead of inventing account ownership from a display name.

### Files/modules in scope

Server auth/persistence/account/moderation modules; migrations; profile, wallet, shop, account and safety screens; secure credential adapters; tests and operator documentation. No real-money shop or AdMob is required here.

### Required verification

All prior applicable tests plus real PostgreSQL integration, provider-auth integration where credentials are available, stale/forged token rejection, idempotent ledger/purchase tests, account linking/new-device access, bidirectional block checks, report permissions, and release rejection of dev auth.

| Check | Required result |
|---|---|
| Linked identity on Windows and Android | Same persistent wallet and duo history, not duplicate unrelated accounts |
| Duplicate or concurrent winning submissions | One committed result, two equal credits, one streak increment |
| Commit succeeded but reply was lost | Retrying retrieves the outcome without awarding again |
| Failed reward transaction | No partial credit to one partner; honest failure/reconciliation |
| Two concurrent cosmetic purchases | No negative wallet or double charge/grant |
| Client modifies displayed coins | Server balance unchanged |
| User guesses another account ID | No access to its wallet, inventory mutation, or private history |
| Block in either direction | No public pair or new private admission between those users |
| Report during a game | Drawing can be hidden immediately and report reaches restricted review |
| Auth upgrade/logout/expiry | No silent wallet loss or duplicate account merge |
| Production config with dev auth | Build/startup fails clearly rather than exposing test login |

### Definition of done

Progress survives client and server restarts. Both platforms can access a linked game identity, with documented and tested wallet/streak semantics. Cosmetic purchases are fully transactional. Reporting/blocking work end-to-end in the closed test environment. No claim of public readiness is made solely because login and database writes work.

### Explicitly out of scope

Paid currency, peer transfers, gifting, tradable items, cash prizes, automated account-merging heuristics, public rankings, Steam-only authentication, or adding platform-specific progression bonuses.

### Escalation signal

Any unexplained duplicate/missing reward, account-takeover possibility, insecure credential storage dependency, auth/provider mismatch, or migration that could destroy real data. Pause that area, preserve a minimal reproduction, and request the narrowest review needed.

---

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

## 10. Future expansion, deliberately outside these six phases

**iOS:** Add the Capacitor iOS project, platform credential/lifecycle/billing adaptations, Apple signing/distribution setup, and real iPhone/iPad testing. Use the same shared client, protocol, accounts, and matchmaking population. Xcode/macOS access is required for the iOS build workflow; future Apple support is not a Windows-only export guarantee. Recheck the then-current environment and store requirements. [S21]

**Asynchronous partner play:** A later distinct feature, not the behavior of the live launch. Would require storing/replaying submitted strokes, turn notifications, expiration, and different timing rules. Do not turn this on as a fallback for an empty live queue without telling players what changed.

**Assisted private play:** Future optional longer timers, rerolls, or decoy removal need a declared assisted ruleset and separate comparable records. Do not sell an advantage inside the launch standard rules. No new public queue merely to add this setting.

**Two-versus-two:** Future real competition is between pairs, not between drawer and guesser. It adds population, fairness, synchronization and collusion problems; not part of the first release.

**More languages:** Localize UI and curate language-specific word banks before pairing those languages. One cross-platform population does not require pairing players who cannot share a game language.

---
## Appendix A. Acceptance matrix to turn into real tests

The IDs below are stable requirements. Map each to an implemented test path and evidence in `TEST_MATRIX.md`. This is a starting test contract, not a claim that these tests already exist or passed.

| ID | Behavior to prove | First phase |
|---|---|---:|
| R01 | Easy success credits both players 1 and team 1 | 1 |
| R02 | Medium success credits both players 2 and team 2 | 1 |
| R03 | Hard success credits both players 3 and team 3 | 1 |
| R04 | Eight hard successes yield team 24 and 24 earned coins each | 1 |
| R05 | Eight turns allocate exactly four drawing opportunities per person | 1 |
| R06 | Duplicate success resolves once | 1 |
| R07 | Wrong guess preserves coins/streak and permits a corrected guess | 1 |
| R08 | Pass and timeout award 0, reset current streak, retain best, and advance | 1 |
| R09 | Normal session completion preserves streak for the same duo | 1 |
| R10 | Failed turn does not remove earlier rewards | 1 |
| R11 | Selection timeout selects only the actual offered easy choice | 1 |
| R12 | Drawer cannot reroll by changing choice after lock | 1 |
| R13 | Guess at the exact deadline is late; guess just before is eligible | 1 |
| R14 | Guess/timeout callbacks cannot both finalize one turn | 1 |
| R15 | Leave after prompt exposure cannot preserve a streak by avoiding failure | 2 |
| R16 | Leave before exposure or at results does not invent a failed turn | 2 |
| R17 | Server fault annuls only the unresolved turn, not prior committed progress | 3 |
| I01 | Duplicate letters have distinct IDs and correct multiplicity | 1 |
| I02 | A tile cannot occupy two slots simultaneously | 1 |
| I03 | Keyboard and pointer/touch use the same tile inventory | 1 |
| I04 | Case/space formatting normalizes without promising different-letter aliases | 1 |
| I05 | Wrong guesses reveal no per-letter correctness and no free-text chat | 1 |
| I06 | All slots/tiles fit the supported viewport and text scale | 1 |
| D01 | A known pointer path reaches both real clients | 1 |
| D02 | Local predicted stroke is not doubled by server acknowledgement | 1 |
| D03 | Undo/clear preserve canonical ordering and generation | 1 |
| D04 | Old-generation/stale-epoch packets cannot resurrect drawings | 2 |
| D05 | Reconnect snapshot plus buffered deltas has no missing/duplicate events | 2 |
| D06 | Pointer cancel, resize, display scaling, and pen-up outside canvas are safe | 2 |
| D07 | Finite/range/size/rate limits reject malicious drawing commands | 1 |
| D08 | Heavy valid drawing stays within bounded room/client memory | 5 |
| Q01 | Friend-code creation/join produces one two-player room | 1 |
| Q02 | Code collision, expiry, invalid code, full room and retries fail usefully | 2 |
| Q03 | A leaked room ID alone cannot bypass admission | 1 |
| Q04 | Public matchmaking never filters by platform/store/payment tier | 2 |
| Q05 | Concurrent joins/cancellations cannot double-book a player | 2 |
| Q06 | Readiness timeout returns remaining player to a usable state | 2 |
| Q07 | Empty queue shows no fabricated opponent/count | 2 |
| Q08 | Blocked users cannot pair or join privately in either direction | 3 |
| Q09 | Current and supported-older cross-platform clients pair successfully | 4 |
| Q10 | Unsupported client is rejected before it consumes a room seat | 2 |
| S01 | Guesser receives designed bank/length clues, not secret answer/options | 1 |
| S02 | Server-only prompts/keys/test APIs are absent from all client bundles | 1 |
| S03 | Wrong-role, wrong-turn and spoofed-actor requests are rejected | 1 |
| S04 | No private moderation/account data is readable by unrelated users | 3 |
| S05 | JWT verification, expiry, issuer/audience and key-rotation paths work | 3 |
| S06 | Private native bridge/IPC never exposes arbitrary shell/filesystem access | 2 |
| S07 | Production cannot enable disposable development identity or test clock | 3 |
| P01 | Two persistent wallet credits and one duo update commit atomically | 3 |
| P02 | Lost response after commit/retry cannot duplicate rewards | 3 |
| P03 | Unknown commit outcome is reconciled rather than blindly retried as new | 3 |
| P04 | Concurrent purchases cannot overspend or duplicate ownership | 3 |
| P05 | Same linked account on another platform recovers real progress | 3 |
| P06 | Separate installations without linking are not falsely merged | 3 |
| P07 | Client balance tampering changes no authoritative data | 3 |
| P08 | Backup restoration recovers committed persistent records | 4 |
| N01 | Actual packaged Windows and installed Android complete one full session | 2 |
| N02 | Both platforms can be drawer and guesser in that session | 2 |
| N03 | Native background/restart returns to same turn or honest expired state | 2 |
| N04 | Reconnect does not extend timer, change bank, reroll or double-credit | 2 |
| N05 | Packaged client works without Vite or a locally running game UI server | 2 |
| N06 | Result/rematch/leave remain reachable on small mobile and scaled Windows | 2 |
| M01 | Report/hide/block work during play and after a session | 3 |
| M02 | Authorized moderator can review evidence; ordinary player cannot | 4 |
| M03 | Evidence retention/deletion job follows declared configuration | 4 |
| M04 | Reviewed content publishes only to future sessions | 4 |
| M05 | No false human-review claim for generated candidate prompts | 4 |
| O01 | Health/readiness and planned drain do not silently lose committed turns | 4 |
| O02 | Soak tests clean up room memory, sockets, subscriptions, timers and PIDs | 5 |
| O03 | Logs/traces redact tokens, private guesses and unnecessary personal data | 4 |
| O04 | Maintenance/rollback produces honest client recovery, not phantom wins | 5 |
| L01 | Steam build contains no ads or watch-ad reward UI/path | 6 |
| L02 | Native SDK failure cannot permanently disable results or start a hidden live turn | 6 |
| L03 | Duplicate/late reward callbacks grant at most one verified benefit if enabled | 6 |
| L04 | Release bundles use intended signing/config and contain no test identities | 6 |
| L05 | Cross-platform production-config smoke test passes before public enablement | 6 |
| L06 | Store uploads/public enablement occur only after explicit owner approval | 6 |

Native/external checks can have human evidence instead of a unit test, but they cannot be silently marked passed by the same script that merely produced a build.

---

## Appendix B. Original development seed pool

These 90 entries are **candidates for development and review**, not a professionally balanced or human-approved production bank. They use the tile-mode length/character limits and should be validated by the importer. Common-word overlap with other games is not a license to copy another game's branded assets or proprietary curated dataset.

**Easy, 30:** apple; tree; house; sun; moon; star; fish; cat; dog; car; boat; flower; book; chair; cup; spoon; fork; key; bed; hat; shoe; ball; balloon; banana; pizza; cake; eye; hand; leaf; heart.

**Medium, 30:** umbrella; bicycle; lighthouse; telescope; backpack; helicopter; snowman; guitar; giraffe; octopus; cactus; volcano; windmill; submarine; treasure chest; fire truck; hot air balloon; roller skate; beehive; scarecrow; washing machine; frying pan; traffic light; roller coaster; parachute; microscope; waterfall; castle; crocodile; rocking chair.

**Hard, 30:** traffic jam; earthquake; tug of war; hide and seek; tightrope walker; walking the dog; building a house; birthday wish; moonwalk; banana slip; missed bus; butterfly chase; sleepwalking; catching a cold; lifting weights; maze escape; mirror image; flying a kite; sinking ship; broken elevator; winning a race; surprise party; food fight; hopscotch; river crossing; treasure hunt; melting ice cream; snowball fight; headwind; pizza delivery.

Some concepts can move between tiers after testing. Several hard candidates need drawability/ambiguity review. Enable candidate content only in development; production content publication requires an approved state. Keep canonical answer, difficulty, language, category, review state, enabled state, content version, and private internal ID on the server.

The planning pack includes these same candidates as `docs/reference/seed-prompts.json` for importing into development after validation. That reference file is not an application module and must not be copied into the public client bundle.

---

## Appendix C. Copyable Codex prompts

### Start Phase 1

```text
Use this planning pack to implement Phase 1 of Draw Duo in the selected new project.
Read START_HERE.md, the repository's existing AGENTS.md if present, and
docs/plans/phase-01.md with its required specs. Follow docs/plans/MASTER_PLAN.md
where details are needed. Inspect the actual working directory and preserve unrelated work.

I have selected GPT-5.3 Codex Spark. Confirm the active model from available session
status; do not silently switch models or launch stronger-model subagents.

Complete the ENTIRE Phase 1 playable outcome, not only the scaffold or first task:
React + TypeScript + Canvas client, real Colyseus two-player server, friend-code
joining, three private 1/2/3 choices, live strokes, letter tiles, server timers,
equal personal coins, shared streak, eight alternating turns, results and rematch.

Work in bounded internal changes but continue through the phase without asking me
to authorize each module. Run the specified real tests. Default to headless tools;
do not open browser/Electron windows, move my mouse, or start fullscreen testing.

Keep all platforms on the same future backend/protocol. No Unity, React Native,
ads, paid services, public deployment, unrelated repo edits, or remote pushes.

Maintain docs/STATUS.md, docs/HANDOFF.md and docs/TEST_MATRIX.md. If the same failure
survives two evidence-based fix/test cycles, isolate it and write a focused review
packet; complete other safe Phase 1 work rather than making speculative rewrites.
If session/context ends, leave exact progress and the next command. Never claim
that an unrun test or missing native-device gate passed.

Stop after Phase 1 with the playable result, real test evidence, remaining blockers,
and exact launch/verify commands. Do not stop merely because one internal task ended.
```

### Execute or resume a later phase

```text
Do Phase N from docs/plans/phase-0N.md. Read docs/HANDOFF.md, docs/STATUS.md,
existing AGENTS.md and only the relevant specifications/files. Continue all internal
work in that phase on Spark, including focused tests and normal fixes; do not stop
after each module or silently change the model. Preserve previously working cross-play.
Use headless defaults. Report real blockers, write evidence-based handoffs, and do not
push, deploy, publish, or spend money without my explicit authorization.
```

### Request a stronger-model diagnosis without paying for a rewrite

```text
Review the single problem described in docs/REVIEW_PACKET.md. Inspect the minimal
reproduction, relevant code and failing tests. Diagnose the root cause and give a
bounded patch plan plus regression tests for Spark to implement. Do not rewrite
unrelated modules, change the stack, or repeat work already verified. State any
uncertainty or missing evidence. For a release audit, enumerate specific findings
and their evidence rather than issuing a generic approval.
```

### Continue in a fresh Spark session

```text
Resume the active phase from docs/HANDOFF.md. Treat STATUS.md and actual source/tests
as the current state, not memory of a prior session. Read only the referenced files
and active phase/spec sections. Verify the last recorded failure/next command and
continue the remaining internal work. Do not restart the project, erase progress,
reread the whole chat, or upgrade models automatically.
```

---

## Appendix D. Release gate and external decisions

Keep the following checklist separate from coding completeness. Missing owner inputs do not block unrelated implementation, but cannot be filled in with invented credentials or approvals.

| Gate/input | When actually needed |
|---|---|
| Selected new repository/directory | Before implementation, not before writing this plan |
| Available Spark model and compatible local tooling | Phase 1 |
| Authorized Windows/Android build and device-test environments | Phase 2 |
| Development Supabase/Auth configuration and test PostgreSQL | Phase 3 |
| Final account linking/recovery and deletion behavior | Before public accounts |
| Intended audience, privacy/terms and evidence retention approval | Before public testing/access |
| Reviewed original content and authorized moderator/operator | Closed beta and public launch |
| Approved hosting provider, capacity/budget and secrets | Phase 4 staging/production work |
| Final title, app IDs, licensed assets and support contacts | Before store submission |
| Signing material, publisher access and any enabled billing/ad configuration | Phase 6 |
| Security/reward integrity, native cross-play and recovery evidence | Before public enablement |
| Store review and explicit owner upload/publish approval | Actual release |
| Mac/Xcode and Apple developer/distribution preparation | Future iOS phase only |

No game runtime depends on a Codex model or an AI API. Spark and any stronger review model are development tools, not a per-guess server cost. Do not add paid AI recognition or AI opponents to the game without a separate feature decision.

---

## Sources and verification notes

The product rules, phase sizes, module structure, tuning values, and recommended integration boundaries are design decisions. They are not vendor guarantees or empirical measurements. Platform/model/policy facts were checked against the following primary sources on September 9, 2026. Check current APIs, supported versions, SDK transitions and store requirements again when implementing or submitting.

[S1] Capacitor documentation, web-to-native architecture: https://capacitorjs.com/docs

[S2] Electron application packaging: https://www.electronjs.org/docs/latest/tutorial/application-distribution

[S3] Colyseus authoritative multiplayer framework: https://docs.colyseus.io/

[S4] Supabase anonymous sign-in and account upgrade considerations: https://supabase.com/docs/guides/auth/auth-anonymous

[S5] Colyseus shared state and per-client views: https://docs.colyseus.io/state/view

[S6] Colyseus room visibility versus access control: https://docs.colyseus.io/matchmaker/visibility

[S7] Colyseus reconnection, token refresh, and state restoration: https://docs.colyseus.io/room/reconnection

[S8] Supabase JWT verification guidance: https://supabase.com/docs/guides/auth/jwts

[S9] Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en

[S10] Playwright headless browser test workflow: https://playwright.dev/docs/running-tests

[S11] Playwright's experimental Electron automation: https://playwright.dev/docs/api/class-electron

[S12] OpenAI's GPT-5.3-Codex-Spark announcement and preview details: https://openai.com/index/introducing-gpt-5-3-codex-spark/

[S13] Electron security recommendations: https://www.electronjs.org/docs/latest/tutorial/security

[S14] Google Play user-generated content policy: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en

[S15] Google Play Families policies and intended audience considerations: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en

[S16] Steamworks SDK and upload tooling: https://partner.steamgames.com/doc/sdk

[S17] Steam advertising and rewarded-ad restrictions: https://partner.steamgames.com/doc/marketing/advertising

[S18] Google Mobile Ads interstitial placement and test ads: https://developers.google.com/admob/android/interstitial

[S19] Google UMP consent/privacy SDK setup: https://developers.google.com/admob/android/privacy

[S20] AdMob server-side reward verification: https://developers.google.com/admob/android/ssv

[S21] Capacitor development environments, including iOS/Xcode/macOS: https://capacitorjs.com/docs/getting-started/environment-setup

**Document boundary:** This deliverable is a plan and Codex handoff. The application commands, game tests, device checks, deployments and store releases above remain implementation work. Document structure/reference validation does not certify the future application.
