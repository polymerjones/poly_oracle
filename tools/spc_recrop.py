#!/usr/bin/env python3
"""
Re-crops all SPC portrait frames to natural aspect ratio (more body visible).
Run from anywhere — paths are hardcoded.
"""
from PIL import Image
import os, shutil

SRC_DIR = "/Users/paulfisher/poly_oracle/spc_mug/spc_greeneyes mug"
OUT_DIR = "/Users/paulfisher/poly_oracle/vo"

# Crop: remove top 8% (less headroom) and bottom 5% (cut off excess body)
# Keep full width — NO horizontal stretching, natural aspect ratio
TOP_PCT = 0.08
BOT_PCT = 0.95

processed = 0
for fname in sorted(os.listdir(SRC_DIR)):
    if not fname.endswith('.png'):
        continue
    src_path = os.path.join(SRC_DIR, fname)
    out_path = os.path.join(OUT_DIR, fname)
    
    img = Image.open(src_path).convert('RGB')
    w, h = img.size
    
    top = int(h * TOP_PCT)
    bot = int(h * BOT_PCT)
    
    crop = img.crop((0, top, w, bot))
    
    # Resize to a consistent output width (600px) maintaining aspect ratio
    out_w = 600
    out_h = int(crop.height * (out_w / crop.width))
    out = crop.resize((out_w, out_h), Image.LANCZOS)
    
    out.save(out_path, 'PNG', optimize=True)
    print(f"✓ {fname} → {out_w}x{out_h}")
    processed += 1

print(f"\n✅ Done — {processed} frames re-cropped and saved to {OUT_DIR}")
print("Run: npm run prepare:web to sync to www/")
