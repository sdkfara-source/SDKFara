# -*- coding: utf-8 -*-
"""قصّ اللوغو من الخلفية المربعة: إنتاج عنصر دائري بخلفية شفافة."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.join(r"C:\Users\Victus\Downloads\Hakeem", "public", "assets")
SRC = os.path.join(BASE, "logo.jpg")
OUT_EMBLEM = os.path.join(BASE, "logo-emblem.png")
OUT_FAV = os.path.join(BASE, "favicon.png")

img = Image.open(SRC).convert("RGB")
W, H = img.size
cx, cy = W // 2, H // 2
px = img.load()

def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

# 1) فحص الكروية: وجود ذهب على r=300 في 8 اتجاهات
print("gold detection on r=300 circle, 8 directions:")
found = 0
for deg in range(0, 360, 45):
    a = math.radians(deg)
    x = int(cx + 300 * math.cos(a))
    y = int(cy + 300 * math.sin(a))
    hits = 0
    for k in range(-30, 31, 4):
        xx = int(x + k * math.cos(a + math.pi / 2))
        yy = int(y + k * math.sin(a + math.pi / 2))
        if 0 <= xx < W and 0 <= yy < H:
            r_, g_, b_ = px[xx, yy]
            if lum((r_, g_, b_)) > 110:
                hits += 1
    found += hits > 0
    print("  angle %3ddeg : %s" % (deg, "GOLD" if hits else "-"))
print("directions with gold: %d/8" % found)

# 2) حد العنصر: أقصى نصف قطر يوجد فيه ذهب ساطع
R_content = 0
for y in range(0, H, 2):
    for x in range(0, W, 2):
        r_, g_, b_ = px[x, y]
        if lum((r_, g_, b_)) > 110 and (max(r_, g_, b_) - min(r_, g_, b_)) < 70:
            d = int(math.hypot(x - cx, y - cy))
            if d > R_content:
                R_content = d
print("outermost bright-gold radius: %d" % R_content)

R0 = min(R_content + 12, 408)   # حدود القص (عنصر ذهبي التصميم داخل دائرة)
FEATHER = 26                    # التدرج على الحواف

# 3) قناع ألفا دائري بتدرج ناعم
alpha = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(alpha)
d.ellipse([cx - R0, cy - R0, cx + R0, cy + R0], fill=255)
alpha = alpha.filter(ImageFilter.GaussianBlur(FEATHER))

# 4) دمج ألفا مع الصورة (مطّ اللون قليلاً من الداخل لتقليل هالة لونية على الحواف)
rgba = img.convert("RGBA")
inner = img.crop((0, 0, W, H)).copy()
r2 = R0 - 6
mask_solid = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask_solid).ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=255)
mask_solid = mask_solid.filter(ImageFilter.GaussianBlur(FEATHER))
core = Image.composite(img, Image.new("RGB", (W, H), (13, 18, 28)), mask_solid)
core = core.convert("RGBA")
core.putalpha(alpha)

# تكبير الحواف عن طريق توسيط وضبط
side = int(R0 * 2)
out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
core_crop = core.crop((cx - R0, cy - R0, cx + R0, cy + R0))
out.paste(core_crop, (0, 0))
out = out.resize((1024, 1024), Image.LANCZOS)
out.save(OUT_EMBLEM)
print("saved emblem:", OUT_EMBLEM, os.path.getsize(OUT_EMBLEM), "bytes, size 1024x1024")

# 5) favicon جديد 256 بخلفية كحلية (ليكون واضحاً على أي تبويب)
side2 = int(R0 * 2)
fav = Image.new("RGBA", (side2, side2), (0, 0, 0, 0))
fav.paste(core_crop, (0, 0))
fav = fav.convert("RGBA").resize((256, 256), Image.LANCZOS)
bg = Image.new("RGBA", (256, 256), (21, 26, 37, 255))
bg.paste(fav, (0, 0), fav)
bg.convert("RGB").save(OUT_FAV)
print("saved favicon:", OUT_FAV, os.path.getsize(OUT_FAV), "bytes")