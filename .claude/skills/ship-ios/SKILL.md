---
name: ship-ios
description: Commit and push the current poly_oracle changes, then sync the build into Xcode via Capacitor. Use when the user wants to ship/deploy/release, "commit and push", "sync to xcode", "push and sync", or otherwise wrap up a change for the iOS app.
---

# ship-ios

End-to-end ship for the **poly_oracle** iOS app: bump `BUILD_TS` → validate → build →
commit → push → Capacitor sync → open Xcode. One script does the mechanical steps; you
supply the commit message.

## Workflow

1. **Confirm there are changes.** Run `git status --short`. If the tree is clean, tell the
   user there's nothing to ship and stop. (To sync only, without committing, they can run
   `npm run cap:sync` directly.)

2. **Generate the commit message from the diff.** Run `git diff --stat HEAD` and skim
   `git diff HEAD` for the substance. Write a conventional-commit subject
   (`feat:` / `fix:` / `chore:` …) plus a short bullet body covering what changed. Do **not**
   add the co-author trailer — the script appends it. Briefly state the message you'll use.

3. **Run the ship script** from the project root:
   ```sh
   .claude/skills/ship-ios/scripts/ship.sh "feat: subject

   - bullet one
   - bullet two"
   ```
   The script, aborting on any failure:
   - bumps `BUILD_TS` to the current local time,
   - `node --check script.js`,
   - `npm run prepare:web`,
   - `git add -A` (errors out if nothing is staged),
   - commits with the `Co-Authored-By: Claude` trailer,
   - `git push` to the tracked upstream,
   - `npm run cap:sync` (Capacitor → iOS),
   - `npm run cap:open:ios` (opens the Xcode workspace).

4. **Report** the new `BUILD_TS`, the pushed short SHA, and that Xcode is opening. Remind the
   user to build & run from Xcode and to look for the new `BUILD_TS` stamp (bottom-left) to
   confirm the deploy.

## Notes

- **Branch:** commits to the **current** branch (the project's established workflow commits
  straight to `main`). If the user is on a branch they don't want to push, surface that first.
- **Pre-release flags:** this does not touch the `CLAUDE.md` PRE-RELEASE CHECKLIST. Debug
  flags are the user's call before an App Store build.
- **Message review:** the user opted for auto-from-diff messages. If they ask to review first,
  show the message and wait before running the script.
