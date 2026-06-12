#!/usr/bin/env bash
# Ship the current poly_oracle changes: bump BUILD_TS -> validate -> build ->
# commit -> push -> Capacitor sync -> open Xcode. Each step aborts the rest on failure.
#
# Usage:  ship.sh "<commit message>"        (subject; may contain a blank line + body)
# Run from the poly_oracle project root.
set -euo pipefail

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "ERROR: commit message required as the first argument" >&2
  exit 1
fi

# Must be at the project root — guards against running in the wrong directory.
if [ ! -f script.js ] || [ ! -f package.json ]; then
  echo "ERROR: run from the poly_oracle project root (script.js / package.json not found)" >&2
  exit 1
fi

# 1. Bump BUILD_TS to the current local time (the in-game bottom-left stamp verifies deploys).
STAMP="$(date '+%Y-%m-%d %H:%M')"
node -e '
  const fs = require("fs");
  const re = /const BUILD_TS = "[^"]*";/;
  let s = fs.readFileSync("script.js", "utf8");
  if (!re.test(s)) { console.error("ERROR: BUILD_TS line not found in script.js"); process.exit(1); }
  fs.writeFileSync("script.js", s.replace(re, `const BUILD_TS = "${process.argv[1]}";`));
' "$STAMP"
echo "✓ BUILD_TS -> $STAMP"

# 2. Validate syntax (never ship a script.js that does not parse).
node --check script.js
echo "✓ node --check"

# 3. Generate the web bundle (root script.js -> www/).
npm run prepare:web >/dev/null
echo "✓ prepare:web"

# 4. Stage everything, then bail if there is nothing to commit.
git add -A
if git diff --cached --quiet; then
  echo "Nothing staged to commit — aborting before push/sync." >&2
  exit 1
fi

# 5. Commit with the Claude co-author trailer.
git commit -F - <<EOF
$MSG

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
echo "✓ committed $(git rev-parse --short HEAD)"

# 6. Push to the tracked upstream (current branch).
git push
echo "✓ pushed to $(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo upstream)"

# 7. Sync the build into the iOS project via Capacitor (re-runs prepare:web + cap sync ios).
npm run cap:sync
echo "✓ cap sync ios"

# 8. Open the Xcode workspace.
npm run cap:open:ios
echo "✓ opening Xcode — build & run from there"
