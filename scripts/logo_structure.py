# -*- coding: utf-8 -*-
"""فهم بنية اللوغو: هل العنصر دائري؟ أين الذهب؟ ما لون الخلفية؟"""
from PIL import Image

img = Image.open(r"C:\Users\Victus\Downloads\Hakeem\public\assets\logo.jpg").convert("RGB")
W, H = img.size
px = img.load()
cx, cy = W // 2, H // 2

def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

# 1) خلفية: متوسط سطوع 20*20 في كل زاوية
for label, (x0, y0) in {"أعلى-يسار": (5, 5), "أعلى-يمين": (W - 15, 5), "أسفل-يسار": (5, H - 15), "أسفل-يمين": (W - 15, H - 15)}.items():
    s = [0, 0, 0]
    n = 0
    for y in range(y0, y0 + 10):
        for x in range(x0, x0 + 10):
            for i in range(3):
                s[i] += px[x, y][i]
            n += 1
    avg = tuple(v // n for v in s)
    print("corner", label, avg, "lum=%.0f" % lum(avg))

# 2) عينة على نصف قطر من المركز إلى الحافة العليا
print("\nfrom center to top edge (every 32px):")
for r in range(0, H // 2, 32):
    p = px[cx, cy - r]
    print("r=%4d -> RGB%s lum=%3.0f%s" % (r, p, lum(p), "  <-- GOLD?" if lum(p) > 120 else ""))

# 3) توزيع الذهب (hue) بالمسافة من المركز — هل تشكّل حلقة دائرية؟
import collections
gold_by_r = collections.Counter()
n_sampled = 0
for y in range(0, H, 3):
    for x in range(0, W, 3):
        r_, g_, b_ = px[x, y]
        mx, mn = max(r_, g_, b_), min(r_, g_, b_)
        if mx > 110 and (mx - mn) < 60 and r_ > g_ > b_:  # ذهبي دافئ
            d = int(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / 16) * 16
            gold_by_r[d] += 1
        n_sampled += 1
print("\ngold pixel count by distance-from-center (radius bins):")
for d in sorted(gold_by_r):
    print("  r=%4d : %4d px" % (d, gold_by_r[d]))
print("sampled", n_sampled, "pixels total")

# 4) أقصى نصف قطر يوجد فيه محتوى (يختلف عن الزاوية)
import math
maxr = 0
for y in range(0, H, 2):
    for x in range(0, W, 2):
        d2 = (x - cx) ** 2 + (y - cy) ** 2
        r = math.isqrt(d2)
        if r > maxr and abs(lum(px[x, y]) - lum(px[5, 5])) > 6:
            maxr = r
print("\nmax content radius from center: %d of %d" % (maxr, H // 2))