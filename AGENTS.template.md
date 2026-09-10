# Draw Duo repository instructions template

Use this as the root AGENTS.md only after verifying it will not overwrite existing repository instructions. These are project-specific rules, not permission to change global Codex settings.

## Product boundaries

React + TypeScript + HTML Canvas; Electron Windows; Capacitor Android; future iOS. No Unity or React Native rewrite. One shared cross-platform public population and protocol. One real authoritative Colyseus game service. PostgreSQL persistent game data and verified Supabase production identity. No platform or store filter in normal pairing.

Each solved 1/2/3-value prompt credits both participants equally and adds that value once to the team score. Duo streak behavior follows the master specification. Clients never choose authoritative outcomes, balances, answers, or deadlines. Server-only content/secrets stay out of client bundles.

## Execution

The selected model should be gpt-5.3-codex-spark when available. Verify actual model status; do not silently fall back or create higher-cost subagents. User requests are macro-phases. Complete the requested phase's cohesive modules, focused tests, and ordinary fixes without stopping after each checkbox. Do not automatically start the next phase.

Read docs/HANDOFF.md, docs/STATUS.md, the active docs/plans/phase-0N.md, and only relevant specs/source. The master plan is authoritative. Inspect existing code before editing. Keep working changes narrow to the current module, preserve unrelated work, and avoid unnecessary dependency upgrades or broad refactors.

If two evidence-based fix/test cycles fail on the same symptom, stop speculative edits in that area and write docs/REVIEW_PACKET.md with reproduction and exact evidence. Continue independent safe work within the phase. Escalate auth/data-loss/reward-integrity uncertainty promptly. Stronger models diagnose/review a bounded issue, then Spark can implement defined changes.

## Verification and local resources

Run the tests explicitly required by the phase. Use headless defaults and bounded workers. Never open browser/editor/Electron windows, move the user's mouse, press global keys, or launch fullscreen as part of default testing. Native checks require authorized separate test sessions/devices; headless browser coverage is not native certification.

Do not stub out tests, remove assertions, weaken auth, or use pass-with-no-tests to report success. Distinguish build passed, test passed, test not run, native gate pending, and release approved. Test-harness secrets/actions must be absent from production.

Use project-local dependencies and portable scripts. Record environment versions and actual output paths. Manage only processes started by the current run. Do not kill every Node/Java process, reset global configuration, overwrite user changes, or automatically expose a dev server to the internet.

## Progress and permissions

Update docs/STATUS.md, docs/HANDOFF.md and docs/TEST_MATRIX.md at meaningful checkpoints. Save a fresh-session handoff before context becomes unreliable. Report uncertainty and remaining gates honestly. Never claim the game recognizes arbitrary drawings because a fixture-driven test succeeds.

No remote pushes, PR creation, paid resources, production deployments, store uploads or publishing without explicit owner authorization. No iOS implementation until requested. No public queue enablement before production identity, integrity and moderation gates pass.
