# -*- coding: utf-8 -*-
"""وضع اللوغو المرفق كاملاً بدون اقتصاص."""
import os
import shutil
from PIL import Image

BS = r"C:\Users\Victus\Downloads\Hakeem\public\assets"
SRC = r"C:\Users\Victus\Downloads\CnTr\Gemini_Generated_Image_ai7hmiai7hmiai7h_1.png"

im = Image.open(SRC).convert("RGBA")
print("source:", im.size, im.mode)

# 1) الشعار الأساسي كاملاً بدون قص
im.save(os.path.join(BS, "logo.png"))
print("logo.png (full, no crop) saved:", os.path.getsize(os.path.join(BS, "logo.png")))

# 2) صورة og بنسبة كاملة
w = 640
h = round(im.size[1] * w / im.size[0])
og = im.resize((w, h), Image.LANCZOS)
og.save(os.path.join(BS, "logo-256.png"))
print("logo-256.png (ratio preserved,", og.size, ") saved")

# 3) favicon مربع عبر توسيط الشعار كاملاً على خلفية شفافة (بدون قص)
fav_canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
fw = 128
fh = round(im.size[1] * fw / im.size[0])
fav_img = im.resize((fw, fh), Image.LANCZOS)
fav_canvas.paste(fav_img, (0, (128 - fh) // 2), fav_img)
fav_canvas.save(os.path.join(BS, "favicon.png"))
print("favicon.png (contained, no crop) saved")

print("done.")