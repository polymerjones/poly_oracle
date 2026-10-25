#!/bin/bash
# Run from inside the vo/ directory.
# Usage:
#   ./normalize_vo_names.sh preview   -> shows what would change, renames nothing
#   ./normalize_vo_names.sh apply     -> actually renames files

MODE="${1:-preview}"

normalize() {
  local name="$1"
  # Replace " - " and "- " and " -" with a single underscore
  name="${name// - /_}"
  name="${name//- /_}"
  name="${name// -/_}"
  # Replace remaining spaces with underscores
  name="${name// /_}"
  # Collapse multiple underscores into one
  while [[ "$name" == *__* ]]; do name="${name//__/_}"; done
  echo "$name"
}

for f in *; do
  [ -f "$f" ] || continue
  new="$(normalize "$f")"
  if [ "$new" != "$f" ]; then
    if [ "$MODE" = "apply" ]; then
      mv -v -- "$f" "$new"
    else
      echo "$f  ->  $new"
    fi
  fi
done

if [ "$MODE" = "preview" ]; then
  echo ""
  echo "--- This was a PREVIEW. Run './normalize_vo_names.sh apply' to actually rename. ---"
fi
