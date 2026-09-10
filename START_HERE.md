# Draw Duo planning pack

This pack contains a game specification and Codex implementation handoffs. It does not contain a built game, an existing source repository, or tests already executed against an application.

## First use

Choose a new project folder. Keep existing project files intact. Read the existing `AGENTS.md` if one exists. For a genuinely new repository, Codex can create its root `AGENTS.md` from `AGENTS.template.md` after checking that this would not overwrite instructions.

The decisions are React + TypeScript + Canvas, Electron for Windows, Capacitor for Android, and one Colyseus-based cross-platform backend. iOS is later. Do not substitute React Native or Unity or split the player pool by platform.

The complete design is [docs/plans/MASTER_PLAN.md](docs/plans/MASTER_PLAN.md). The six [phase briefs](docs/plans/phase-01.md) are substantial executable phases; their internal work items do not require repeated permission prompts. Focused specification extracts are under `docs/specs/` to keep continuation contexts small. All implementation statuses initially mean NOT STARTED.

## Start with Spark

Select the actual `gpt-5.3-codex-spark` model in the available Codex client and confirm its session status. The prompt does not change the active model or guarantee current quota availability. Do not silently fall back to a stronger model.

Copy [KICKOFF_PHASE_1.txt](KICKOFF_PHASE_1.txt) into that session. It requests the complete playable Phase 1, including real two-client networking and headless tests. No paid hosting or store account is needed just to start.

After a phase, request the next large phase by number. If a session ends midway, start a fresh Spark session with `docs/HANDOFF.md` rather than restarting or pasting the entire chat. `docs/STATUS.md` and `docs/TEST_MATRIX.md` record actual progress and evidence.

## Files to maintain

`docs/plans/MASTER_PLAN.md` is authoritative. If requirements change, update that decision there and in `docs/DECISIONS.md`, then synchronize affected extracts. `AGENTS.template.md` is a safe template, not an automatically active repository instruction file. `docs/reference/seed-prompts.json` contains 90 unreviewed development candidates, all disabled for production publication until reviewed.

Default tests must not open windows, take over the mouse, or run fullscreen on the user's desktop. Native Windows/Android checks belong on authorized dedicated test environments. The same commands can run on a separate machine/CI, but no such runner has been provisioned by this pack.

Do not deploy publicly, create paid resources, upload store builds, or push to a remote repository without explicit approval. Development auth and test-clock controls must remain local/test-only. Public launch requires the documented auth, reward integrity, moderation, compatibility, and native-device gates.
