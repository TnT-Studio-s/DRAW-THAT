# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

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
