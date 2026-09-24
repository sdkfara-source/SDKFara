# -*- coding: utf-8 -*-
"""تحليل اللوغو وإزالة الإطار/الخلفية المحيطة به وقصّه إلى حدود العنصر الفعلي."""
import os
from PIL import Image

BASE = r"C:\Users\Victus\Downloads\Hakeem\public\assets"
SRC = os.path.join(BASE, "logo.jpg")
OUT = os.path.join(BASE, "logo-clean.png")

img = Image.open(SRC).convert("RGB")
W, H = img.size
px = img.load()

# متوسط ألوان الزوايا = لون الخلفية
corners = [px[0, 0], px[W - 1, 0], px[0, H - 1], px[W - 1, H - 1]]
bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
print("bg corner color:", bg)

def dist(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5

THRESH = 22  # فرق لوني يعتبر محتوى
minx, miny, maxx, maxy = W, H, 0, 0
for y in range(0, H, 4):
    for x in range(0, W, 4):
        if dist(px[x, y], bg) > THRESH:
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y

print("content bbox (sampled step 4):", minx, miny, maxx, maxy)
print("relative: %.3f..%.3f x, %.3f..%.3f y" % (minx / W, maxx / W, miny / H, maxy / H))

# فحص دقيق على حدود أعلى دقة حول التقريب
MARG = 8
def refine(edge_mm, axis):
    lo, hi = (minx, maxx) if axis == "x" else (miny, maxy)
    step = 1
    for y in range(max(0, miny - 8), min(H, maxy + 8), 2):
        for x in range(max(0, minx - 8), min(W, maxx + 8), 2):
            if dist(px[x, y], bg) <= THRESH:
                continue
            if axis == "x":
                if x - MARG < lo: lo = x - MARG
                if x + MARG > hi: hi = x + MARG
            else:
                if y - MARG < lo: lo = y - MARG
                if y + MARG > hi: hi = y + MARG
    return max(0, lo), min(W if axis == "x" else H, hi)

minx2, maxx2 = refine(0, "x")
miny2, maxy2 = refine(0, "y")
print("refined bbox:", minx2, miny2, maxx2, maxy2)

# فحص مركز الصورة: هل العنصر في المنتصف؟
cx, cy = (minx2 + maxx2) / 2, (miny2 + maxy2) / 2
print("content center: (%.0f, %.0f) vs image center (%.0f, %.0f)" % (cx, cy, W / 2, H / 2))

# القص: بادينغ متناسق حول المحتوى
PAD = 14
box = (minx2 - PAD, miny2 - PAD, maxx2 + PAD, maxy2 + PAD)
box = (max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]))
crop = img.crop(box)
print("crop size:", crop.size, "of", (W, H))

# إنشاء نسخة مربعة 1024 مع بادينغ متساوٍ
side = max(crop.size)
sq = Image.new("RGB", (side, side), crop.getpixel((0, 0)))
sq.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2))
sq = sq.resize((1024, 1024), Image.LANCZOS)
sq.save(OUT)
print("saved:", OUT, os.path.getsize(OUT), "bytes")

# تحقق بسيط: التغيير في نسبة المحتوى
print("ratio content-to-full: %.0f%% before, %.0f%% after (content now uses most of frame)" % (
    100 * ((maxx2 - minx2) * (maxy2 - miny2)) / (W * H), 100 * (crop.size[0] * crop.size[1]) / (side * side)))