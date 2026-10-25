# Ads groundwork — October 25, 2026

Read-only inventory for IMPROVEMENT_PLAN §1 ("Free app, ads, and rewards"). Nothing was installed and
no native config, pricing, or AdMob account setting was changed. Re-verify every external fact below
against the official pages before implementation; they were checked once, on this date.

## What the project has today

| Area | Current state |
| --- | --- |
| Ad SDK | None. `package.json` has no AdMob/ads dependency. |
| Capacitor | 8.1 (`@capacitor/core`, `ios`, `android`, `app`, `haptics`, `status-bar`, community TTS) |
| iOS | Swift Package Manager (`ios/App/CapApp-SPM`), deployment target 15.0. `Info.plist` has no `GADApplicationIdentifier`, `SKAdNetworkItems`, or `NSUserTrackingUsageDescription`. |
| Android | minSdk 24, targetSdk 36. Manifest has no `com.google.android.gms.ads.APPLICATION_ID`. |
| Web (polyoracle.app) | Same bundle; native ad plugins don't serve ads in a browser, so the web needs its own decision (see plan). |
| Existing reward-like systems | POLYSLOTS tokens (gold bar = 1 token), slot payouts, combo bonuses, `STORAGE.rewardCelestial` on game win. These are the natural things for ad rewards and the reward box to grant. |

## Candidate plugin: `@capacitor-community/admob`

- Latest version **8.2.1** (npm, published 2026-10-23); its v8 line targets Capacitor 8. This is the
  plugin Capacitor's own ads guide points to.
- Ships Google Mobile Ads SDK itself (do not add a second Mobile Ads dependency). Reported pins for v8:
  Android SDK 25.4.x, iOS SDK 13.6.0.
- Has a `Package.swift` (SPM, `.iOS(.v15)`) — matches this project's SPM setup and 15.0 target.
  Android `minSdkVersion` follows the root project (24). No platform bump needed.
- Rewarded API present in the typings: `prepareRewardVideoAd`, `showRewardVideoAd`, plus
  `prepareRewardInterstitialAd`; server-side verification options (`ssv`).
- Consent and tracking API present: `requestConsentInfo`, `showConsentForm` (Google UMP),
  `trackingAuthorizationStatus`, `requestTrackingAuthorization` (iOS ATT).
- Rewarded events: `Loaded`, `FailedToLoad`, `Showed`, `FailedToShow`, `Dismissed`, `Rewarded`,
  `adClicked`, `AdImpression`. The typings state that `Dismissed` does not mean the reward was earned —
  grant only on `Rewarded`. This maps directly onto the plan's "grant only on confirmed completion".

### Native config the plugin will need (from its README)

- iOS `Info.plist`: `GADApplicationIdentifier` (iOS AdMob **app** ID), `SKAdNetworkItems` (Google's ID
  plus the list from Google's iOS quick-start), `NSUserTrackingUsageDescription` if ATT is requested.
- Android manifest: `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" …>` (Android
  AdMob app ID).
- Separate AdMob app registrations + rewarded ad units for iOS and Android (plan: new ad units).

## Policy points that shape the design

From AdMob's rewarded-ads policy (support.google.com/admob/answer/7313578) — re-read in full before building:

- The required action and the reward must be disclosed **before** each rewarded ad is shown.
- If a reward needs several ads in a row, the count must be disclosed (their example: "watch 3 ads now
  to receive 100 gold coins"). So the Cheat Codes "ad pod" is allowed in principle **as a disclosed
  sequence of separately shown rewarded ads** — consistent with the plan's caution not to assume a
  configurable pod exists.
- Standard rewarded ads must be opt-in (the user chooses to watch); the ad must be skippable/dismissable.

## Suggested state machine (for when implementation is greenlit)

`idle → loading → ready → showing → (rewarded?) → dismissed → idle`, with `failed` reachable from
`loading`/`showing`. Rules:

1. The offer button is enabled only in `ready`; otherwise it reads "Ad unavailable — try later".
2. Reward is granted once, keyed by an offer ID, on `Rewarded`; a second `Rewarded` for the same offer
   is ignored. `Dismissed` without `Rewarded` grants nothing.
3. Multi-ad cheats store progress (`n of N watched`) per cheat; partial progress and expiry rules are
   a product decision (plan §ADS-01).
4. On `Showed`: pause the game loop, duck/stop music, and pause VO. On `Dismissed`/`FailedToShow`:
   resume **without** an unconditional AudioContext rebuild (see the memory note on the retired
   per-level `audioEngine.teardown()` — rebuilding the ctx outside a gesture kills iOS audio).
5. Preload the next ad only after the current one is dismissed, never during gameplay frames
   (decoder contention lessons from the Android port).

## Decisions still needed from Paul before code

1. AdMob app IDs + rewarded unit IDs for iOS and Android (new units, per plan).
2. Whether to request iOS ATT (affects `NSUserTrackingUsageDescription` and the consent flow order).
3. Reward catalog and limits (Cheat Codes list, ads per cheat, unlock duration, leaderboard eligibility).
4. Web behavior (no ads / alternative earning path / separate experience).
5. Treatment of existing paying players.

## Sources

- npm: `@capacitor-community/admob` 8.2.1 package contents (typings, README, Package.swift) — inspected locally
- https://capacitorjs.com/docs/guides/ads
- https://capawesome.io/docs/blog/announcing-the-capacitor-admob-plugin/ (SDK version pins)
- https://capgo.app/blog/admob-gdpr-consent-capacitor/ (v8 ↔ Capacitor 8, UMP methods)
- https://support.google.com/admob/answer/7313578 (rewarded ads policy)
- https://support.google.com/admob/answer/7311747 (rewarded ad units, skip timing)
