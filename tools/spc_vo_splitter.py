#!/usr/bin/env python3
"""
SPC VO Splitter — Auto-splits, transcribes, and names SPC voiceover files.
Usage: python3 spc_vo_splitter.py
"""

import os
import re
import json
from pathlib import Path

# ── CONFIG ────────────────────────────────────────────────────────────────────
INPUT_DIR  = "/Users/paulfisher/poly_oracle/local/spc demo vo"
OUTPUT_DIR = "/Users/paulfisher/poly_oracle/vo"
REPORT_PATH = "/Users/paulfisher/poly_oracle/local/spc demo vo/split_report.json"

# Silence detection settings — tweak if splits are too aggressive or too few
SILENCE_THRESH_DB  = -40   # dBFS — lower = only split on very quiet gaps
MIN_SILENCE_MS     = 400   # minimum silence gap to split on (ms)
KEEP_SILENCE_MS    = 100   # padding to keep around each segment (ms)
MIN_SEGMENT_MS     = 800   # ignore segments shorter than this (ms)

# Whisper model — "base" is fast, "small" is more accurate, "medium" best quality
WHISPER_MODEL = "small"

# ── SPC SCRIPT (key → expected text) ─────────────────────────────────────────
SPC_SCRIPT = {
    "SPC_01":    "Hi there Cadet, welcome to the Polyverse simulator.",
    "SPC_02":    "Let me show you the ropes before the real battle.",
    "SPC_03":    "First — the perimeter timer.",
    "SPC_04a":   "That line around the screen edges",
    "SPC_04b":   "shows how long you have to clear the field.",
    "SPC_05":    "Every so often a timer power-up appears.",
    "SPC_06":    "Grab it to buy time. Tap it now.",
    "SPC_07":    "Great! From here the timer's paused while you train.",
    "SPC_08-09": "These are the stroids — our job is to clear them from the Polyverse.",
    "SPC_10-11": "Tap to fire your laser and blast the stroid and all its pieces.",
    "SPC_12":    "Fantastic, Cadet. You'll show these stroids who's boss.",
    "SPC_13-14": "Next up — the plasma net. Tap, drag and hold to set it.",
    "SPC_15-16": "When stroids glow they're targeted. Release to fire.",
    "SPC_17":    "NICE! Great work, Cadet.",
    "SPC_18":    "Now let the plasma recharge and do it again!",
    "SPC_19":    "Plasma is recharged.",
    "SPC_20":    "Make sure the stroids are targeted first.",
    "SPC_21":    "Try it again.",
    "SPC_22":    "Take your time — get them highlighted before you release.",
    "SPC_23":    "UFO spotted, Cadet!",
    "SPC_24":    "Shoot it twice to take it out!",
    "SPC_25":    "Direct hit! Do it again!",
    "SPC_26":    "Wow, there you go.",
    "SPC_27":    "Destroying a UFO instantly recharges your plasma.",
    "SPC_28-30": "So a good move is to net the stroids when a UFO shows up, pop the UFO, and instantly get another net shot. Let's try it.",
    "SPC_31":    "Use your plasma net on those stroids.",
    "SPC_32":    "Now destroy the UFO quickly!",
    "SPC_33":    "Plasma recharged — make another net!",
    "SPC_34":    "Nice work, Cadet. You learn fast.",
    "SPC_35":    "Next I need to show you the stroid toss attack.",
    "SPC_36":    "Tap and hold a stroid to grab it.",
    "SPC_37":    "Excellent, now swipe and release to toss it at other stroids!",
    "SPC_38":    "You have to swipe or flick the stroid to toss it.",
    "SPC_39":    "Give it a good flick, Cadet — put some effort in!",
    "SPC_40":    "Very good, Cadet.",
    "SPC_41":    "Things will get hectic out there.",
    "SPC_42-43": "When you see a bomb, tap it to arm it — you can also grab and toss bombs just like stroids.",
    "SPC_44-45": "The bomb will explode soon. To detonate it yourself, tap it again.",
    "SPC_46":    "Okay Cadet, let's detonate the bomb ourselves.",
    "SPC_47":    "Tap the armed bomb to detonate it.",
    "SPC_48":    "Boom. That was fantastic, Cadet.",
    "SPC_49":    "Bombs can save you from some hairy situations.",
    "SPC_50":    "Sometimes a bomb powerup will appear on the field.",
    "SPC_51":    "Tap it to add it to your HUD inventory.",
    "SPC_52":    "Tap the bomb icon in your HUD.",
    "SPC_53":    "Now tap the screen where you want to place it.",
    "SPC_54":    "Arm it and tap again to detonate.",
    "SPC_55-56": "Throughout the missions, powerups will appear. That is the quad shot — pick it up!",
    "SPC_57":    "Blast those Stroids with the quad shot, Cadet!",
    "SPC_58":    "Keep firing, Cadet!",
    "SPC_59":    "Pick up the freeze powerup.",
    "SPC_60":    "To activate the freeze powerup, tap the freeze button on your HUD.",
    "SPC_61":    "Objects are frozen for a short time. Blast em!",
    "SPC_62":    "Frozen Stroids can be tossed too. Grab one and toss it.",
    "SPC_63":    "Good shooting — but try grabbing and tossing a frozen Stroid.",
    "SPC_63b":   "Freeze expired — grab another one and try the toss.",
    "SPC_64":    "Very cool, Cadet.",
    "SPC_65":    "Pick up the missiles, Cadet.",
    "SPC_66":    "Tap the missile weapon in the HUD to arm a missile.",
    "SPC_67":    "Now tap to set a target and watch the destruction.",
    "SPC_68":    "Excellent work, Cadet.",
    "SPC_69":    "This concludes our training for today.",
    "SPC_70":    "Go practice if you like — the Polyverse awaits.",
    "SPC_grab_small":    "Smaller Stroids cannot be grabbed, Cadet.",
    "SPC_freeze_toggle": "Freeze can be enabled and disabled by tapping the freeze icon on your HUD.",
    "SPC_17b":           "NICE! Great work, Cadet.",
}

# ── HELPERS ───────────────────────────────────────────────────────────────────
def normalize(text):
    """Lowercase, strip punctuation for fuzzy comparison."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return " ".join(text.split())

def similarity(a, b):
    """Simple word-overlap similarity 0→1."""
    wa = set(normalize(a).split())
    wb = set(normalize(b).split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / max(len(wa), len(wb))

def best_match(transcript, used_keys, min_score=0.35):
    """Find best unused SPC key for a transcript segment."""
    best_key, best_score = None, 0.0
    for key, text in SPC_SCRIPT.items():
        if key in used_keys:
            continue
        score = similarity(transcript, text)
        if score > best_score:
            best_score = score
            best_key = key
    if best_score >= min_score:
        return best_key, best_score
    return None, best_score

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    try:
        from pydub import AudioSegment
        from pydub.silence import split_on_silence
    except ImportError:
        print("❌ pydub not installed. Run: pip3 install pydub")
        return

    try:
        import whisper
    except ImportError:
        print("❌ whisper not installed. Run: pip3 install openai-whisper")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"🎙  Loading Whisper model '{WHISPER_MODEL}'...")
    model = whisper.load_model(WHISPER_MODEL)

    # Collect WAV files in order
    input_path = Path(INPUT_DIR)
    wav_files = sorted(input_path.glob("*.wav"))
    if not wav_files:
        print(f"❌ No WAV files found in {INPUT_DIR}")
        return
    print(f"📁 Found {len(wav_files)} WAV files: {[f.name for f in wav_files]}")

    used_keys = set()
    report = []
    bonus_segments = []
    segment_index = 0

    for wav_path in wav_files:
        print(f"\n━━━ Processing: {wav_path.name} ━━━")
        audio = AudioSegment.from_wav(str(wav_path))

        # Split on silence
        segments = split_on_silence(
            audio,
            min_silence_len=MIN_SILENCE_MS,
            silence_thresh=SILENCE_THRESH_DB,
            keep_silence=KEEP_SILENCE_MS,
        )
        segments = [s for s in segments if len(s) >= MIN_SEGMENT_MS]
        print(f"   ✂️  Split into {len(segments)} segments")

        for i, seg in enumerate(segments):
            segment_index += 1
            # Export segment to temp WAV for Whisper
            tmp_path = f"/tmp/spc_seg_{segment_index}.wav"
            seg.export(tmp_path, format="wav")

            # Transcribe
            result = model.transcribe(tmp_path, language="en", fp16=False)
            transcript = result["text"].strip()
            print(f"   [{segment_index:03d}] \"{transcript[:70]}\"")

            # Match to script
            key, score = best_match(transcript, used_keys)

            if key:
                used_keys.add(key)
                out_path = os.path.join(OUTPUT_DIR, f"{key}.mp3")
                seg.export(out_path, format="mp3", bitrate="128k")
                print(f"         ✅ → {key}.mp3  (score: {score:.2f})")
                report.append({
                    "segment": segment_index,
                    "file": wav_path.name,
                    "transcript": transcript,
                    "matched_key": key,
                    "score": round(score, 3),
                    "output": f"{key}.mp3",
                })
            else:
                # Save as bonus/unmatched
                bonus_name = f"SPC_BONUS_{segment_index:03d}.mp3"
                out_path = os.path.join(OUTPUT_DIR, bonus_name)
                seg.export(out_path, format="mp3", bitrate="128k")
                print(f"         ⭐ BONUS → {bonus_name}  (best score: {score:.2f})")
                bonus_segments.append({
                    "segment": segment_index,
                    "file": wav_path.name,
                    "transcript": transcript,
                    "output": bonus_name,
                    "score": round(score, 3),
                })
                report.append({
                    "segment": segment_index,
                    "file": wav_path.name,
                    "transcript": transcript,
                    "matched_key": None,
                    "score": round(score, 3),
                    "output": bonus_name,
                })

    # Save report
    with open(REPORT_PATH, "w") as f:
        json.dump({"matched": report, "bonus": bonus_segments}, f, indent=2)

    # Summary
    matched = [r for r in report if r["matched_key"]]
    unmatched_keys = [k for k in SPC_SCRIPT if k not in used_keys]

    print(f"\n{'━'*50}")
    print(f"✅ Matched:   {len(matched)}/{len(SPC_SCRIPT)} script lines")
    print(f"⭐ Bonus:     {len(bonus_segments)} extra segments saved")
    print(f"❓ Unmatched: {len(unmatched_keys)} script lines not found:")
    for k in unmatched_keys:
        print(f"   - {k}: \"{SPC_SCRIPT[k][:60]}\"")
    print(f"\n📄 Full report saved to: {REPORT_PATH}")
    print(f"📂 MP3 files saved to:   {OUTPUT_DIR}")
    print(f"\n🎉 Done! Check the report to review any low-confidence matches.")

if __name__ == "__main__":
    main()
