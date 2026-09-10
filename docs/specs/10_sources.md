# Focused specification reference

Extracted from plan v2.0. [The master plan](../plans/MASTER_PLAN.md) is authoritative. Do not edit this extract independently of its master section. Source labels refer to [the source notes](10_sources.md).

## Sources and verification notes

The product rules, phase sizes, module structure, tuning values, and recommended integration boundaries are design decisions. They are not vendor guarantees or empirical measurements. Platform/model/policy facts were checked against the following primary sources on September 9, 2026. Check current APIs, supported versions, SDK transitions and store requirements again when implementing or submitting.

[S1] Capacitor documentation, web-to-native architecture: https://capacitorjs.com/docs

[S2] Electron application packaging: https://www.electronjs.org/docs/latest/tutorial/application-distribution

[S3] Colyseus authoritative multiplayer framework: https://docs.colyseus.io/

[S4] Supabase anonymous sign-in and account upgrade considerations: https://supabase.com/docs/guides/auth/auth-anonymous

[S5] Colyseus shared state and per-client views: https://docs.colyseus.io/state/view

[S6] Colyseus room visibility versus access control: https://docs.colyseus.io/matchmaker/visibility

[S7] Colyseus reconnection, token refresh, and state restoration: https://docs.colyseus.io/room/reconnection

[S8] Supabase JWT verification guidance: https://supabase.com/docs/guides/auth/jwts

[S9] Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en

[S10] Playwright headless browser test workflow: https://playwright.dev/docs/running-tests

[S11] Playwright's experimental Electron automation: https://playwright.dev/docs/api/class-electron

[S12] OpenAI's GPT-5.3-Codex-Spark announcement and preview details: https://openai.com/index/introducing-gpt-5-3-codex-spark/

[S13] Electron security recommendations: https://www.electronjs.org/docs/latest/tutorial/security

[S14] Google Play user-generated content policy: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en

[S15] Google Play Families policies and intended audience considerations: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en

[S16] Steamworks SDK and upload tooling: https://partner.steamgames.com/doc/sdk

[S17] Steam advertising and rewarded-ad restrictions: https://partner.steamgames.com/doc/marketing/advertising

[S18] Google Mobile Ads interstitial placement and test ads: https://developers.google.com/admob/android/interstitial

[S19] Google UMP consent/privacy SDK setup: https://developers.google.com/admob/android/privacy

[S20] AdMob server-side reward verification: https://developers.google.com/admob/android/ssv

[S21] Capacitor development environments, including iOS/Xcode/macOS: https://capacitorjs.com/docs/getting-started/environment-setup

**Document boundary:** This deliverable is a plan and Codex handoff. The application commands, game tests, device checks, deployments and store releases above remain implementation work. Document structure/reference validation does not certify the future application.
