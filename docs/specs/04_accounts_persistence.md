# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

## 5. Accounts, data, and reward integrity

### 5.1 Identity stages

Phase 1 may use loopback-only development identities and in-memory persistence. Clearly label that mode as disposable. Its API must refuse nondevelopment deployments. Phase 2 phone testing can use USB forwarding into that local backend; do not expose development login publicly just to make a device connect.

Phase 3 introduces Supabase Auth and real PostgreSQL. Anonymous login provides low-friction play, while account linking/recoverable login protects progress. Anonymous users need abuse limits and are not automatically recoverable after local credentials are lost. [S4]

The game server verifies JWT signatures and issuer, audience, expiry, and applicable session/account restrictions using supported provider/JWT libraries. Plan for key rotation and revoked/suspended accounts; do not decode without verification or write custom cryptography. Provider JWT documentation describes verification and trust boundaries. [S8]

Separate a stable internal `player_id` from display names and store IDs. Use secure platform storage boundaries for durable refresh credentials; never treat an unencrypted client preferences file as a tamper-proof wallet. UI caches may be modified locally without modifying server balances.

No shared device fingerprint or common IP is sufficient proof that two accounts are the same person or cheaters. A single active play-session rule is an account concurrency constraint, not household surveillance.

### 5.2 Minimum persistent model

| Entity | Important data and invariants |
|---|---|
| `players` | Stable ID, auth subject mapping, generated/moderated display name, account status, accepted terms version |
| `account_links` | Verified provider subject mappings; uniqueness per provider identity; no silent merge |
| `wallets` | Player ID, nonnegative integer earned coin balance, lifetime gameplay coins, revision |
| `wallet_ledger` | Delta, reason, turn/purchase reference, unique idempotency key; append-only normal accounting |
| `duos` | Sorted player pair, rules family, current/best streak, successful turns, completed sessions, revision |
| `sessions` | Two players, entry context, protocol/rules/content version, start/end/status, final team score |
| `turns` | Session + turn number unique, drawer, selected prompt server-only, outcome, points, resolution ID |
| `cosmetic_catalog` | Item ID, server price, type, enabled/version flags, gameplay-neutral properties |
| `player_cosmetics` | Unique player/item ownership and equipped values |
| `blocks` | Blocker/blocked IDs unique; matching checks both directions |
| `reports` | Reporter, subject, session/turn, category, evidence pointer, review status and audit dates |
| `moderation_actions` | Authorized staff action and audit trail; not client-editable |
| `store_transactions` | Later: provider, unique transaction ID, verification state, entitlement and reversal linkage |

Do not persist every live point through PostgreSQL. Keep the active canvas in bounded room memory. Save restricted evidence when reported or explicitly needed under the declared retention policy. Routine telemetry must not contain full answers, tokens, or raw guesses.

Use a private database schema/server role for wallets, prompts, and moderation. If a browser-accessible database API is enabled, row-level security and grants must deny unauthorized reads/writes; do not rely on hiding a service key in JavaScript. Clients call the game API for wallet/catalog operations, not direct balance updates.

### 5.3 Transactional turn resolution

Use one database transaction to record a finalized turn, both players' rewards, both ledger rows, and the duo streak update. Resolve locks in a consistent order. Define a unique turn-resolution/idempotency key before retries.

Conceptual algorithm:

```text
Serialize the room's resolution decision.
Begin transaction.
Insert the unique finalized turn outcome.
If that turn was already committed: return the recorded outcome, without new rewards.
Lock/update wallet rows in stable player-ID order.
On success: credit each player d, append unique ledger rows, increment duo streak.
On failure: credit neither player and reset current streak as specified.
Update best streak and session totals consistently.
Commit.
Publish the committed result and wallet revisions to clients.
```

The actual SQL must be tested against real PostgreSQL, including simultaneous duplicate requests, crash/disconnect after commit, retries after an unknown commit outcome, and insufficient-balance purchases. Never claim network delivery is exactly once. Achieve **effectively-once durable effects** with unique constraints, transactions, and idempotency.

If persistence fails, keep the UI usable and report syncing/failure honestly. Reconcile by resolution ID before deciding that an uncertain transaction failed. Never show spendable credited coins solely because an optimistic browser animation played. Client acknowledgements are not required to keep a committed reward.

Earn-only cosmetic purchases similarly validate server price and balance, debit and grant ownership transactionally, and deduplicate repeated purchase IDs. A client supplies item ID and request ID, not the price or resulting balance.

### 5.4 Recovery and deletion

Provide clear account recovery/linking guidance and a way to delete an account. Define treatment of report evidence, financial/provider records if any, and anonymized duo history in the policy; do not promise immediate erasure of every legally retained record. Google Play's account-deletion policy can require both an in-app path and a web resource for apps offering account creation. Verify applicability and implementation before launch. [S9]

Database migrations need version tracking, backup/restore instructions, and a tested restore exercise. Development data does not migrate into public real-money or production-reward accounts automatically. Document any disposable alpha reset before inviting testers.

---
