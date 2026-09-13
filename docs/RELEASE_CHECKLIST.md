# Release readiness

Phase 6 internal release preparation is implemented. The rows below distinguish code/artifact evidence from owner-controlled release gates. No store upload or public enablement has been performed.

| Gate | Status | Evidence / owner |
|---|---|---|
| Packaged Windows + installed Android full session | NOT VERIFIED | Requires production-config packaged clients and an actual cross-platform session. |
| Same public population and supported cross-version behavior | NOT VERIFIED | |
| Production auth, account linking and private admission | NOT VERIFIED | |
| Atomic/idempotent equal rewards and duo streaks | NOT VERIFIED | |
| Server-only secrets/content excluded from client bundles | NOT VERIFIED | |
| Native lifecycle, reconnect and canvas convergence | NOT VERIFIED | |
| Report/block and staffed restricted moderation | NOT VERIFIED | |
| Reviewed content / no false review claims | NOT VERIFIED | |
| Audience, privacy, terms, retention and account deletion | OWNER INPUT REQUIRED | |
| Backup/restore, monitoring, staging rollout/rollback | NOT VERIFIED | |
| Steam build has no ad/rewarded-ad path | PASS IN CODE | Current client and native dependencies contain no ads, billing, rewarded-ad, or watch-an-ad path; release checker enforces this boundary. |
| Enabled native monetization safely verified, or disabled/absent | PASS: DISABLED | No monetization is enabled. Any future enablement requires a separate provider-specific review. |
| Final branding/app IDs/licenses/signing/store forms | OWNER INPUT REQUIRED | |
| Public enablement and any actual store upload/publish | NOT AUTHORIZED | |

## Phase 6 implementation checkpoint

| Internal check | Result | Evidence |
|---|---|---|
| Windows test package | PASS | `npm run build:windows`; Forge Squirrel artifact under `apps/desktop/out/make`. |
| Steam depot-folder build path | IMPLEMENTED, OWNER BLOCKED | `npm run build:steam` uses Forge `package`; production endpoint and final publisher inputs are required before a store-shaped run. |
| Android debug artifact | PASS | `npm run build:android:debug` with the documented Android SDK; explicit `app-debug.apk` path printed. |
| Android release artifact | BLOCKED CORRECTLY | `npm run build:android:release` requires production HTTPS/WSS, protected keystore variables, and emits `app-release.aab` only after signing. |
| Runtime endpoint safety | PASS IN CODE | Packaged Windows runtime reads generated config; release builds reject localhost and non-TLS endpoints. |
| Production web identity boundary | PASS | Release bundle scan found no development identity header, test-mode marker, or static provider/API access token. |
| Checksums and release manifest | IMPLEMENTED | `npm run release:manifest` writes `release-artifacts/manifest.json` and `release-artifacts/checksums.sha256` for release-shaped artifacts. |
| Store/privacy/rollback material | READY FOR OWNER INPUT | See `docs/STORE_METADATA.md`, `docs/PRIVACY_DATA_FLOW.md`, and `docs/ROLLBACK_RUNBOOK.md`. |

Code completion does not imply publishing approval. Android and Steam may release on different dates but must keep the same compatible backend/player population. Future iOS remains outside initial release scope.
