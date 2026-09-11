# Draw Duo staging operations runbook

This is a closed-beta runbook. It does not authorize public deployment, paid hosting, or store publishing.

## Readiness

Use `/api/health` for process liveness. It reports `acceptingAdmissions` but does not prove database readiness.

Use `/api/ready` for admission readiness. It checks the configured account store and returns HTTP 503 when persistence is unavailable or the instance is draining.

```powershell
Invoke-WebRequest http://127.0.0.1:2567/api/health
Invoke-WebRequest http://127.0.0.1:2567/api/ready
```

## Planned drain

Set the operations key only in the service environment. Never place it in the web client or a downloaded test report.

```powershell
$headers = @{ 'x-operations-key' = $env:DRAW_DUO_OPERATIONS_KEY }
Invoke-WebRequest http://127.0.0.1:2567/api/admin/admission -Method Post -Headers $headers -ContentType 'application/json' -Body '{"accepting":false}'
```

After the drain response, `/api/ready` returns 503 and new private/quick admissions return 503. Existing rooms remain owned by the running process until their normal lifecycle completes or the operator stops the service during the approved maintenance window.

Resume admissions only after the service, database, content bundle, and logs have been checked:

```powershell
Invoke-WebRequest http://127.0.0.1:2567/api/admin/admission -Method Post -Headers $headers -ContentType 'application/json' -Body '{"accepting":true}'
```

## Moderation dashboard

Open `/admin/moderation` on the staging service. Enter the moderation key in the tab, load the open queue, inspect bounded evidence, and record an allowlisted action with a reason. The page contains no embedded staff credential; access remains enforced by the server API.

## Migration and rollback

Set `DATABASE_URL` in the staging secret store, run `npm run db:migrate`, and record the migration result before admitting testers. Do not run a destructive rollback against an active database. Use the provider's approved backup restoration procedure, verify `/api/ready`, and replay the headless integration checks before resuming admissions.

## Evidence and logs

Do not log bearer tokens, moderation keys, private guesses, canonical prompts before reveal, or full drawing payloads. The Phase 4 evidence-retention policy remains draft until the owner and designated reviewers approve it.

The implementation keeps unreported turn evidence for 24 hours and extends evidence attached to a report for up to 30 days. Staff evidence reads go through the restricted report endpoint and write an access-log record. Expiry cleanup runs hourly; the database migration creates the evidence and access-log tables. These are implementation defaults pending owner and reviewer approval, not a legal retention policy.

## Content maintenance

Validate candidate content before review:

```powershell
npm run content:validate -- docs/reference/seed-prompts.json
```

Use the edit command to change review metadata, enabled state, difficulty, or category into a separate review file. Editing never auto-approves a candidate:

```powershell
node scripts/content.js edit input.json reviewed.json prompt-id --difficulty=2 --category=objects --review-status=approved --enabled=true --reviewed-by=staff-id --reviewed-at=2026-09-10T00:00:00Z
```

Publish only after the validator accepts every entry as approved, enabled, and reviewer-attributed:

```powershell
npm run content:publish -- reviewed.json content/published/prompts.json
```
