# iOS App Submission Guide (First Time)

This guide is written for your first App Store submission.

## 1. Prerequisites
- Apple Developer Program membership: active.
- Mac with Xcode installed.
- Logged in to Xcode with your Apple ID (`Xcode -> Settings -> Accounts`).
- Unique bundle ID reserved in your Apple Developer account (for example: `com.polyoracle.app`).

## 2. In This Folder (One-Time Setup)
Run these commands in `/Users/paulfisher/poly_oracle`:

```bash
npm run install:cap
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

If `npm run install:cap` fails, check your internet connection and run again.

## 3. Configure App in Xcode
After `npm run cap:open:ios`, Xcode opens the `ios/App` project.

In Xcode:
1. Select the `App` project in left sidebar.
2. Select `App` target.
3. On `Signing & Capabilities`:
- Check `Automatically manage signing`.
- Team: select your Apple Developer team.
- Bundle Identifier: `com.polyoracle.app` (or your final choice).
4. On `General`:
- Version: `1.0.0`
- Build: `1`
- Deployment target: choose iOS version you support.
5. Add app icons in `Assets.xcassets`.

## 4. Create App Record in App Store Connect
Go to App Store Connect (`https://appstoreconnect.apple.com`):
1. Apps -> `+` -> New App
2. Platform: iOS
3. Name: `Poly Oracle`
4. Primary language: English
5. Bundle ID: choose the one used in Xcode
6. SKU: any unique internal ID (example: `poly-oracle-ios-001`)

## 5. Fill Store Listing Fields
Use these files as templates:
- Metadata: `APP_STORE_CONNECT_METADATA.md`
- Review notes: `APP_REVIEW_NOTES.md`
- Privacy answers: `APP_PRIVACY_QUESTIONNAIRE.md`
- Policy text: `PRIVACY_POLICY.md`

Required items before submission:
- Privacy Policy URL (must be hosted online).
- Support URL.
- App screenshots (required sizes for iPhone).

## 6. Upload Build from Xcode
In Xcode:
1. Product -> Scheme -> `App`
2. Product -> Destination -> `Any iOS Device (arm64)`
3. Product -> Archive
4. When Organizer opens, choose latest archive -> Distribute App
5. Select `App Store Connect` -> `Upload`
6. Keep default signing options unless you have a custom signing setup

Wait for processing in App Store Connect (usually 5-30 minutes).

## 7. TestFlight (Strongly Recommended Before Review)
In App Store Connect:
1. Go to TestFlight tab.
2. Add internal testers (you can add yourself).
3. Install and test on a real iPhone.
4. Validate: audio, speech, reveal flow, and orientation.

## 8. Submit for App Review
In App Store Connect:
1. App Store tab -> your version (example `1.0.0`).
2. Select uploaded build.
3. Complete App Privacy section.
4. Complete Age Rating questionnaire.
5. Complete Export Compliance questions.
6. Add App Review contact and notes.
7. Click `Submit for Review`.

## 9. Common First-Submission Rejection Risks
1. Minimal app value (Guideline 4.2)
- Risk: app seen as too simple.
- Mitigation: emphasize unique UX, voice options, accessibility, polished visuals/audio, and stable offline behavior.

2. Missing privacy policy URL
- Risk: metadata rejection before review starts.
- Mitigation: host `PRIVACY_POLICY.md` as a public page before submission.

3. Broken flows on reviewer device
- Risk: runtime rejection.
- Mitigation: test all core flows in TestFlight on physical iPhone.

4. Misstated App Privacy answers
- Risk: compliance rejection.
- Mitigation: keep questionnaire aligned with actual SDKs and permissions.

## 10. Updating the App After First Release
For each update:
1. Update version/build in Xcode.
2. Run `npm run cap:sync` after web changes.
3. Archive again.
4. Upload new build.
5. Submit updated version in App Store Connect.
