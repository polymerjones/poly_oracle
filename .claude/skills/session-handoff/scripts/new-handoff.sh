#!/usr/bin/env bash
# Scaffold a dated session-handoff file in handoffs/, pre-filled with this session's git
# context as raw material to curate. Usage: new-handoff.sh "<slug>"  (run from project root).
set -euo pipefail

# Project-root guard — keeps handoffs/ in the right place.
if [ ! -f script.js ] || [ ! -f package.json ]; then
  echo "ERROR: run from the poly_oracle project root (script.js / package.json not found)" >&2
  exit 1
fi

# Normalize the slug to kebab-case; fall back to "session".
RAW="${1:-session}"
SLUG="$(printf '%s' "$RAW" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' | sed -E 's/-+/-/g; s/^-|-$//g')"
[ -z "$SLUG" ] && SLUG="session"

DATE="$(date '+%Y-%m-%d')"
mkdir -p handoffs
FILE="handoffs/$DATE-$SLUG.md"

if [ -e "$FILE" ]; then
  echo "ERROR: $FILE already exists — edit it directly, or pick a different slug." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
BUILD_TS="$(grep -m1 -oE 'BUILD_TS = "[^"]*"' script.js 2>/dev/null || echo 'BUILD_TS = ?')"
COMMITS="$(git log --pretty='- %h %s' -15 2>/dev/null || echo '(no git log available)')"
STAT="$(git diff --stat 'HEAD~15' HEAD 2>/dev/null | tail -30 || echo '(stat unavailable — fewer than 15 commits?)')"

cat > "$FILE" <<EOF
# Session handoff — $DATE — <TITLE>

**$BUILD_TS**  ·  branch: $BRANCH

## Summary
<1-3 sentences: what this session set out to do and the outcome.>

## What was fixed
<!-- For EACH issue: Symptom -> Root cause -> Fix (file:line + commit SHA) -> Verified. Be concrete. -->

### <issue title>
- **Symptom:**
- **Root cause:**
- **Fix:** \`file.js:NN\` — … (commit \`<sha>\`)
- **Verified:**

## Still open / follow-ups
-

## Gotchas / learnings
<!-- The non-obvious stuff that cost time to figure out. Highest-value section. -->
-

## Pre-release reminders (carry forward)
-

---
<details><summary>Auto-collected git context (raw — curate into the sections above, then delete this block)</summary>

Recent commits:
$COMMITS

Changed files (last ~15 commits):
$STAT
</details>
EOF

echo "Created $FILE"
echo "Next: fill in the sections, then add a newest-first line to handoffs/README.md, then commit."
