# Release and rollback runbook

This runbook is for authorized staging or private release work. It does not authorize deployment, store upload, or public matchmaking.

## Before enabling a release

Confirm the production HTTP and WebSocket endpoints use HTTPS and WSS, the backend rules/protocol compatibility window is recorded, and the release artifacts have a checksum manifest from `npm run release:manifest`.

Confirm database migration status, backup freshness, provider-auth configuration, approved content version, moderation coverage, alert ownership, support contact, and rollback owner. Do not enable public matchmaking if any critical integrity or privacy gate is only mocked.

Record the Windows package version, Android version code/name, Steam App/depot IDs if applicable, backend build ID, content version, rules version, and checksum file.

## Planned drain

Use the protected admission control to stop new room admission while existing rooms finish or expire. Do not kill active room processes to force a fast rollout. Monitor health, readiness, room count, active sockets, unresolved turns, and persistence failures.

```powershell
Invoke-WebRequest https://BACKEND_HOST/api/health
Invoke-WebRequest https://BACKEND_HOST/api/ready
Invoke-WebRequest https://BACKEND_HOST/api/admin/admission -Method Post -Headers @{ 'x-operations-key' = 'OWNER_PROVIDED_KEY' } -ContentType 'application/json' -Body '{"accepting":false}'
```

The host, key, and deployment identity above are placeholders. Never commit real secrets.

## Rollback

1. Keep admission disabled and record the incident time, release version, backend build, content version, and affected clients.

2. Preserve committed turn and ledger records. Do not replay an uncertain reward as a new resolution ID.

3. Roll the backend to the last compatible build. Keep the protocol/rules compatibility window explicit and reject unsupported clients before they consume a room seat.

4. If a client package is defective, stop distributing that package and direct users to the last approved Windows/Android artifact. Do not silently replace a signed artifact with a locally rebuilt one.

5. Validate health, readiness, authentication, private admission, account recovery, one complete cross-platform session, moderation access, and result/rematch behavior before reopening admission.

6. Re-enable admission only after the incident owner and release owner approve the evidence. Record the new checksum and post-rollback monitoring window.

Database restore, provider recovery, store rollback, and public communication require the owner-approved operational environment and are not proven by local headless tests.
