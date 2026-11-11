# 2026-11-11 — App Review 2.5.4 rejection fixed, iOS 4.1.1 (10) resubmitted

**Session date:** Wed 2026-11-11 (morning)
**Commits:** `b5cd210` (fix, build 10) · `abb36fa` (export-compliance key, ships with the next build)
**State at end:** iOS 4.1.1 (10) **Waiting for Review**, resubmitted at **9:39 AM**. Android 4.1.1 (39) has been **live** in Play production since Nov 3, 11:01 AM.

## Starting point
- Git: local `main` was the same as `origin/main` (`40cc854`). Untracked files that are NOT ours to commit: `App Store Connect 11-11-26.pdf`, `apple dev conference notes 10-29-26/`, `poly_oracle-stroids.patch`.
- Apple's rejection PDF (`App Store Connect 11-11-26.pdf`, repo root, untracked).
  - Rejected 4.1.1 (9) on Tue 11-10 at 9:40 PM; review device was an iPad Air 11" M3.
  - Submission ID `9e187260-1ec8-40c9-913f-ca5404e62ef1`.
  - Apple took about 9 days to review (submitted 11-01 12:46 PM).

## Issue: Guideline 2.5.4 — Software Requirements (background audio)
- **Symptom (Apple):** "The app declares support for audio in the UIBackgroundModes key in the Info.plist, but we are unable to play any audible content when the app is running in the background."
- **Root cause:** `UIBackgroundModes = [audio]` was added in `910ab39` (June, Now Playing media session). The game freezes on app switch (TAP TO RESUME), so it never actually played background audio.
- **Fix (`b5cd210`):**
  - Deleted the `UIBackgroundModes` key from `ios/App/App/Info.plist`.
  - `CURRENT_PROJECT_VERSION` 9 → 10 (both configs in `project.pbxproj`). `MARKETING_VERSION` stays 4.1.1.
  - `BUILD_TS` = `2026-11-11 09:40` (`script.js:569`).
  - Ran prepare:web + cap sync.
  - CLAUDE.md: the "orb leave-reality plays in background" nice-to-have is marked DROPPED.
  - Kept as-is: AVAudioSession `.playback + .mixWithOthers` (`ios/App/App/AppDelegate.swift:17`, `MainViewController.swift`) and the Now Playing JS (`script.js:8-60`).
- **Verified:**
  - CLI Debug build installed wirelessly on PolyiPhonePro. Paul confirmed **game audio plays with the Silent switch on**.
  - The archived app's Info.plist has no background key, and CFBundleVersion = 10.
  - Not explicitly re-tested: app-switch resume, orb audio and ad audio. Nothing in those paths depends on the background mode.
- **Release:**
  - Archived from the CLI to `~/Library/Developer/Xcode/Archives/2026-11-11/PolyOracle-4.1.1-10.xcarchive` and opened in Organizer.
  - Paul uploaded it ("Uploaded to Apple").
  - In ASC: removed build 9, saved, added build 10, and saved.
  - Paul replied to App Review (9:36 AM) and added a "Build 10: removed the audio UIBackgroundModes entry…" line at the top of App Review Notes.
  - Clicked **Update Review**, and the submission went to Waiting for Review.

## Export compliance key (`abb36fa`, NOT in build 10)
- Added `ITSAppUsesNonExemptEncryption = false` to `ios/App/App/Info.plist`, right after `CFBundleVersion`.
- The app only uses exempt OS HTTPS (AdMob, Game Center, fetch). A grep found no CryptoKit, CommonCrypto, crypto.subtle, OpenSSL or SQLCipher.
- Effect: from the next upload, builds skip ASC's "Missing Compliance" question. Revisit only if custom encryption is added (e.g. encrypted saves).
- No build bump; it rides with the next real build.

## Gotchas / learnings
- **The ASC "Resubmit to App Review" button stays grey** after you swap the build. You must open **Edit** (the version page) and click **Update Review** at the top right; that's what moves the submission to Waiting for Review.
- **A background mode needs a real background feature.** Don't re-add any `UIBackgroundModes` entry unless the feature actually plays or works in the background. If you do, Apple wants a physical-device screen recording, showing the Home Screen, in the review notes.
- `.playback` category alone is enough to override the Silent switch in the foreground; no background mode is needed for that.
- **Release flow that worked:**
  - `xcodebuild … -configuration Release -destination generic/platform=iOS -archivePath ~/Library/Developer/Xcode/Archives/<date>/X.xcarchive -allowProvisioningUpdates archive`
  - Then `open` the archive, and Paul clicks Distribute in Organizer. CLI upload still fails on ASC credentials.
- `devicectl --device PolyiPhonePro` works by name; no need for the UUID.

## Still open / follow-ups
- **Wait for the 4.1.1 (10) review.** Paul is holding off on an expedite request for a few days.
  - If it's still slow, use developer.apple.com/contact/app-store/ → "Request an expedited app review".
  - Strongest reason: 4.1.1 carries the iOS 27 UIScene crash fix.
  - Confirm on a real iOS 27 device that the live 4.1.0 actually crashes before claiming it. So far it has only been reproduced in the simulator.
- Old reminder (due 10-31): Paul to contact Apple about the **Monkey Trubble** review. Still unconfirmed whether that happened.
- Once approved: release 4.1.1 (check auto vs. manual release on the version page).
- Earlier open items carry over: audio audit (`handoffs/2026-11-01-audio-audit.md`), device app-switch matrix, plasma split verify.

## Pre-release reminders (CLAUDE.md, still unchecked)
- Device-verify the app-switch matrix (`docs/app-switch-audit.md`), orb rub audio across app switches, and the plasma split.
- iPad 13" App Store screenshots.
- L12–15: `gauntlet_intro.mp3`, the L14/L15 music tracks, `dualUfo`, `waves`.
- Stunt Mode: SPC VO recordings plus `now_swipe_to_toss_the_stroid`; verify the 10 tutorial phases and the Practice unlock.
