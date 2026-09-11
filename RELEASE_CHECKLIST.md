# Draw Duo release and closed-beta checklist

This checklist records evidence boundaries. A checked internal code path is not a public-release approval.

## Current Phase 4 state

- [x] Content validator rejects malformed answers, normalized duplicates, missing difficulty tiers, and unreviewed enabled entries.
- [x] Content edit and publication commands preserve candidate status until a reviewer explicitly supplies approval metadata.
- [x] Server-only published content boundary is enforced outside development/test mode.
- [x] Health, readiness, and protected admission drain controls exist.
- [x] Restricted moderation dashboard, report review, suspension action, evidence access, and access logging exist.
- [x] Unreported evidence defaults to 24 hours; reported evidence can be retained for the draft 30-day review window; expiry cleanup is implemented.
- [x] Headless lint, typecheck, unit, integration, security, build, and browser E2E checks pass.

## Still required before a closed beta

- [ ] Owner and designated reviewers approve the intended audience, content policy, report reasons, and evidence retention limits.
- [ ] At least 300 prompts are actually reviewed and enabled for the beta content bundle; no automatic generation is treated as human approval.
- [ ] Disposable PostgreSQL is configured, migrations 001 and 002 run, reward/purchase/review/retention behavior is exercised, and backup/restore is recorded.
- [ ] Supabase provider configuration proves JWT issuer/audience/key rotation, account linking, and new-device recovery.
- [ ] Authorized staff completes a real moderation review, evidence read, suspension, and audit-log exercise.
- [ ] Staging HTTPS/WSS, secret injection, structured log redaction, metrics, budget/retention limits, drain, rollback, and restore are exercised.
- [ ] Packaged Windows and installed Android complete the same cross-platform sessions, including reconnect and background/restart cases.
- [ ] Closed-beta testers complete repeated rematches, invite codes, quick pairing, safety flows, account recovery, and structured feedback.

## Not approved

Public matchmaking, store publishing, paid services, ads, real-money commerce, and production deployment remain unapproved.
