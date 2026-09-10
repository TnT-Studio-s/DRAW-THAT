# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
