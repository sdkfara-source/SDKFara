import sys
import arabic_reshaper
from bidi.algorithm import get_display
from fontTools.ttLib import TTFont

def probe(font_path, label):
    f = TTFont(font_path)
    cmap = f.getBestCmap()
    missing = []
    total = set()
    samples = [
        "الاقتصاد والتخطيط",
        "النشرة الشهرية لأسعار المستهلك والتضخم في سوريا كانون الأول 2024",
        "أزمة المياه والأمن الغذائي في سوريا",
        "السياسات العامة في المرحلة الانتقالية",
        "مركز حكيم للدراسات والبحوث",
        "الملخص التنفيذي",
        "الكلمات المفتاحية: تضخم، فقر، سعر الصرف، حوكمة",
    ]
    for s in samples:
        shaped = get_display(arabic_reshaper.reshape(s))
        total.update(ord(c) for c in shaped)
        for c in shaped:
            if ord(c) not in cmap:
                missing.append((s, c, hex(ord(c))))
    print(f"== {label} ==")
    print("  unique codepoints:", len(total), "| missing:", len(missing))
    for m in missing[:25]:
        print("   MISSING", m)
    f.close()

if __name__ == "__main__":
    probe(r"C:\Windows\Fonts\Amiri Regular.ttf", "Amiri")
    probe(r"C:\Windows\Fonts\Amiri Bold.ttf", "AmiriBold")
    probe(r"C:\Windows\Fonts\tahoma.ttf", "Tahoma")