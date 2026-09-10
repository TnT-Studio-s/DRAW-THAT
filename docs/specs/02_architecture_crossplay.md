# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
