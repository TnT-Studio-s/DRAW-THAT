# Privacy and data-flow inventory

This inventory describes the current architecture and identifies owner/provider work that is still required. It is not a legal privacy policy.

## Data categories

Account identity: a verified provider subject and the internal player ID are used to associate profile, wallet, cosmetic ownership, duo progress, safety actions, and account recovery. Development/test identities are local-only and must not be enabled in a release build.

Gameplay state: room membership, platform capability, readiness, roles, turn identifiers, selected tile identifiers, outcomes, team points, and timers are sent to the game service to operate a live match.

Drawing evidence: bounded canonical stroke batches and turn metadata may be retained for authorized moderation review. The current service has a draft 30-day evidence policy and deletion path; database-backed retention execution remains an open gate.

Profile and progression: display name, wallet balance, earned cosmetic ownership/equipment, lifetime progress, and duo streak are stored for the authenticated account. Coins are not transferable.

Safety records: reports, blocks, moderation review actions, suspension state, evidence-access logs, and account deletion requests are restricted to their intended account or staff boundary.

Device and connection data: platform identifier, connection epoch, device label supplied by the client, transport state, and operational logs support reconnect and abuse controls. Logs must not contain bearer tokens, secret prompts, private guesses, or unnecessary personal data.

## Destinations and boundaries

The React client communicates with the Colyseus game service over the configured HTTP/WebSocket backend. The browser bundle contains protocol and public rules only; server prompts, answer keys, database credentials, signing material, and moderation secrets stay server-side.

Neon Auth and PostgreSQL are the selected production destinations for identity and persistent records. Neon Auth is provisioned for the linked production branch; application migrations and live provider/database evidence still require the deployment environment and are not claimed here.

Windows Electron and Android Capacitor wrappers expose only the typed platform bridge needed by the client. No arbitrary shell, filesystem, account secret, ad SDK, or billing SDK is exposed.

## Owner/provider review required

Confirm the legal data controller, regions, retention periods, deletion SLA, support process, subprocessors, provider settings, logging retention, and user-facing policy URLs before any public release. Do not copy this engineering inventory directly into legal text without that review.
