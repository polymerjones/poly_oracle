# Poly Oracle iOS App Store Prep

## Current status
This project is a static web app. To submit on the iOS App Store, package it as a native shell (recommended: Capacitor) and ship through Xcode/TestFlight.

## What is already improved in this repo
- iOS-friendly viewport and Apple web-app meta tags.
- Reduced-motion support (important for accessibility review).
- More resilient speech/voice handling when voices are unavailable.
- Quit button hidden in standalone mode to align with iOS app behavior.

## Required steps to ship
1. Create the native wrapper
- `npm init -y`
- `npm install @capacitor/core @capacitor/cli @capacitor/ios`
- `npx cap init "Poly Oracle" com.polyoracle.app --web-dir .`
- `npx cap add ios`
- `npx cap open ios`

2. Configure iOS app settings in Xcode
- Bundle Identifier: must match your Apple Developer App ID.
- Deployment target: choose a current iOS baseline.
- Signing: select your Team and automatic signing.
- Icons/launch assets: provide all required sizes.

3. App Store compliance content
- Privacy Policy URL (required in App Store Connect).
- App Privacy questionnaire:
  - If no analytics, no tracking, no account system, you can usually report no data collection.
  - Re-check if you later add analytics, crash reporting, ads, or login.
- Age rating questionnaire.
- Export compliance: answer encryption questions (typically exempt for standard iOS networking only).

4. Build + TestFlight
- Product > Archive in Xcode.
- Upload via Organizer.
- Add build to TestFlight and run at least one install test on iPhone.

5. App Store listing assets
- App name, subtitle, description, keywords.
- 6.7" and 6.5" iPhone screenshots.
- Support URL and marketing URL (if available).

## Suggested pre-submission checks
- Test with iPhone hardware mute switch on and off.
- Verify speech synthesis behavior on iOS 17+ device.
- Verify audio starts only from explicit user interaction.
- Confirm no dead-end flows when speech is unavailable.
- Confirm no prompts for permissions not used by the app.

## Optional hardening before submit
- Add offline support (`manifest.json` + service worker).
- Add a small settings panel for speech on/off and effects intensity.
- Add local error logging (no external analytics) for debug builds only.
