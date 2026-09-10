# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
