# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
