# Poly Oracle Store Submission Runbook (2026)

## Release target
- Marketing version: `3.2.0`
- iOS build number: `3`

## Important deadlines
- Starting **April 28, 2026**, App Store Connect requires iOS/iPadOS apps to be built with the **iOS 26 SDK or later**.

## 1. Prep web assets
Run in `/Users/paulfisher/poly_oracle`:

```bash
npm run cap:sync
```

## 2. Apple App Store (IPA)
1. Open Xcode project:

```bash
npm run cap:open:ios
```

2. In Xcode (`App` target):
- Signing & Capabilities: enable automatic signing and select your team.
- General:
  - Version = `3.2.0`
  - Build = `3` (or higher if re-uploading)

3. Archive and upload:
- `Product -> Destination -> Any iOS Device (arm64)`
- `Product -> Archive`
- In Organizer: `Distribute App -> App Store Connect -> Upload`

4. In App Store Connect:
- Select uploaded build for version `3.2.0`
- Complete privacy, age rating, export compliance, screenshots, support URL, and privacy policy URL
- Submit for review

## 3. Google Play (AAB)
This repo is currently missing `android/` and requires one online install step:

```bash
npm install @capacitor/android@^8.1.0
npx cap add android
npm run cap:sync
npx cap open android
```

Then in Android Studio:
1. Set app version in `android/app/build.gradle` (versionName/versionCode).
2. Create/upload release keystore.
3. Build signed bundle:
- `Build -> Generate Signed Bundle/APK -> Android App Bundle`
4. Upload `.aab` in Play Console release track.

## 4. Required upload formats
- Apple: upload an `IPA` (not zip)
- Google Play: upload an `AAB` (not zip)

## 5. Final pre-submit checks
- Test on physical iPhone and Android device.
- Verify audio, speech, reveal flow, and no dead-end UI paths.
- Confirm store metadata matches in-app behavior and permissions.
