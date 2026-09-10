# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
