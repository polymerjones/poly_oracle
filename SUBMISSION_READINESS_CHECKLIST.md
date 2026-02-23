# Submission Readiness Checklist

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
- [x] Capacitor config file created (`capacitor.config.ts`).
- [ ] Install Capacitor dependencies.
- [ ] Generate iOS project (`npx cap add ios`).
- [ ] Open in Xcode and configure signing.

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
