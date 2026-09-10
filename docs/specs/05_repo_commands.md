# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
