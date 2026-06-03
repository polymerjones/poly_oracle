# Submission Readiness Checklist

## 2026 platform requirements
- [x] Apple toolchain installed: Xcode 26.2 detected.
- [ ] Final archive built with iOS 26 SDK or later (required for uploads after April 28, 2026).

## App code
- [x] Mobile viewport and iOS web app meta tags added.
- [x] Reduced motion accessibility support added.
- [x] Voice fallback handling added for unsupported devices.
- [x] Standalone iOS behavior adjusted (hide quit action).

## Store assets and compliance docs
- [x] Metadata draft created (`APP_STORE_CONNECT_METADATA.md`).
- [x] Privacy questionnaire draft created (`APP_PRIVACY_QUESTIONNAIRE.md`).
- [x] Review notes template created (`APP_REVIEW_NOTES.md`).
- [x] Privacy policy text created (`PRIVACY_POLICY.md`).

## Native iOS shell
- [x] Capacitor config file created (`capacitor.config.json`).
- [x] Install Capacitor dependencies.
- [x] Generate iOS project (`npx cap add ios`).
- [ ] Open in Xcode and configure signing.
- [x] Version aligned to `3.2.0` / build `3`.

## Native Android shell (Google Play)
- [ ] Install Android dependency (`npm install @capacitor/android@^8.1.0`).
- [ ] Generate Android project (`npx cap add android`).
- [ ] Open in Android Studio (`npx cap open android`).
- [ ] Build signed Android App Bundle (`.aab`) for Play upload.

## App Store Connect
- [ ] Create app record.
- [ ] Add privacy policy URL + support URL.
- [ ] Add screenshots.
- [ ] Add uploaded build.
- [ ] Submit for review.

## Device testing
- [ ] Internal TestFlight install.
- [ ] Verify speech, audio, animations, and reveal flow.
- [ ] Verify behavior with silent mode and reduced motion.
