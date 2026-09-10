# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
