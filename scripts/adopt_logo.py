# -*- coding: utf-8 -*-
"""اعتماد صورة جديدة للوغو: قصّ مربع مركزي + PNG بشفافية + تجديد الأيقونات + نسخ احتياطي."""
import os
import shutil
from PIL import Image

BS = r"C:\Users\Victus\Downloads\Hakeem\public\assets"
SRC = r"C:\Users\Victus\Downloads\CnTr\Gemini_Generated_Image_ai7hmiai7hmiai7h_1.png"

def cjk(s):  # CJK-encoded filename cleanup not needed here
    return s

im = Image.open(SRC).convert("RGBA")
w, h = im.size
side = min(w, h)
x0 = (w - side) // 2
y0 = (h - side) // 2
sq = im.crop((x0, y0, x0 + side, y0 + side))
print("cropped square:", sq.size)

# 1) نسخة احتياطية للشعار القديم قبل التبديل
old_jpg = os.path.join(BS, "logo.jpg")
if os.path.exists(old_jpg) and not os.path.exists(os.path.join(BS, "logo-original.jpg")):
    shutil.copyfile(old_jpg, os.path.join(BS, "logo-original.jpg"))
    print("backed up old logo -> logo-original.jpg")
if not os.path.exists(os.path.join(BS, "logo-adopted-src.png")):
    shutil.copyfile(SRC, os.path.join(BS, "logo-adopted-src.png"))
    print("adopted source saved -> logo-adopted-src.png")

# 2) الشعار الأساسي PNG بشفافية
sq.save(os.path.join(BS, "logo.png"))
print("logo.png saved", os.path.getsize(os.path.join(BS, "logo.png")))

# 3) صورة og 256
sq256 = sq.resize((256, 256), Image.LANCZOS)
sq256.save(os.path.join(BS, "logo-256.png"))
print("logo-256.png saved")

# 4) favicon 128 (مربع خالص بشفافية؛ المتصفح يقص الزوايا تلقائياً)
fav = sq.resize((128, 128), Image.LANCZOS)
fav.save(os.path.join(BS, "favicon.png"))
print("favicon.png saved")

# 5) تنظيف الملفات المؤقتة القديمة الغير المستخدمة
for stale in ["logo-clean.png", "logo-emblem.png"]:
    p = os.path.join(BS, stale)
    if os.path.exists(p):
        os.remove(p)
        print("removed stale:", stale)

print("done.")