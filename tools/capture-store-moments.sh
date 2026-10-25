#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-phone}"
COUNT="${2:-8}"
DEVICE="${ANDROID_SERIAL:-}"
ADB="${ADB:-/Users/paulfisher/Library/Android/sdk/platform-tools/adb}"
PKG="${PKG:-com.polyoracle.app}"
OUT_DIR="store-assets/${PROFILE}"
RAW_DIR="${OUT_DIR}/raw"

mkdir -p "$OUT_DIR" "$RAW_DIR"

adb_cmd() {
  if [[ -n "$DEVICE" ]]; then
    "$ADB" -s "$DEVICE" "$@"
  else
    "$ADB" "$@"
  fi
}

stamp() {
  date +"%Y%m%d-%H%M%S"
}

screen_size() {
  adb_cmd shell wm size | sed -E 's/.*Physical size: ([0-9]+)x([0-9]+).*/\1 \2/'
}

capture_png() {
  local label="$1"
  local ts raw final width height crop_w crop_h
  ts="$(stamp)"
  raw="${RAW_DIR}/${ts}-${label}-raw.png"
  final="${OUT_DIR}/${ts}-${label}.png"

  adb_cmd exec-out screencap -p > "$raw"
  read -r width height < <(screen_size)

  cp "$raw" "$final"

  # Google Play wants 9:16 or 16:9. Common Android screenshots include
  # extra vertical pixels, so crop the center into a strict store ratio.
  if [[ "$PROFILE" == "phone" && "$width" -lt "$height" ]]; then
    crop_w="$width"
    crop_h=$(( width * 16 / 9 ))
    if [[ "$crop_h" -le "$height" ]]; then
      sips -c "$crop_h" "$crop_w" "$raw" --out "$final" >/dev/null
    fi
  elif [[ "$width" -gt "$height" ]]; then
    crop_h="$height"
    crop_w=$(( height * 16 / 9 ))
    if [[ "$crop_w" -le "$width" ]]; then
      sips -c "$crop_h" "$crop_w" "$raw" --out "$final" >/dev/null
    fi
  fi

  echo "$final"
}

random_play_step() {
  local width height x y gesture
  read -r width height < <(screen_size)
  gesture=$(( RANDOM % 6 ))

  case "$gesture" in
    0|1|2)
      x=$(( width / 5 + RANDOM % (width * 3 / 5) ))
      y=$(( height / 4 + RANDOM % (height / 2) ))
      adb_cmd shell input tap "$x" "$y" >/dev/null
      ;;
    3)
      adb_cmd shell input swipe $((width / 2)) $((height * 3 / 4)) $((width / 2)) $((height / 4)) 180 >/dev/null
      ;;
    4)
      adb_cmd shell input swipe $((width / 4)) $((height / 2)) $((width * 3 / 4)) $((height / 2)) 160 >/dev/null
      ;;
    *)
      adb_cmd shell input tap $((width / 2)) $((height / 2)) >/dev/null
      sleep 0.15
      adb_cmd shell input tap $((width * 3 / 4)) $((height / 2)) >/dev/null
      ;;
  esac
}

if [[ "$PROFILE" != "phone" && "$PROFILE" != "tablet-7" && "$PROFILE" != "tablet-10" ]]; then
  echo "Usage: $0 phone|tablet-7|tablet-10 [count]" >&2
  exit 2
fi

adb_cmd shell input keyevent KEYCODE_WAKEUP >/dev/null || true
adb_cmd shell monkey -p "$PKG" 1 >/dev/null 2>&1 || true
sleep 1

capture_png "start"

for i in $(seq 1 "$COUNT"); do
  random_play_step
  sleep 1
  capture_png "moment-${i}"
done

echo "Saved screenshots in ${OUT_DIR}"
