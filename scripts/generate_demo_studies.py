# -*- coding: utf-8 -*-
"""توليد دراسات PDF تجريبية لمركز حكيم للدراسات والبحوث — دمشق
يستند المحتوى إلى تقارير منشورة حقيقية (المركز السوري لبحوث السياسات، مؤسسة كارنيغي للسلام).
"""
import os
import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUDIES_DIR = os.path.join(BASE_DIR, "studies")
LOGO = os.path.join(BASE_DIR, "public", "assets", "logo-256.png")

FONT_REG = r"C:\Windows\Fonts\Amiri Regular.ttf"
FONT_BOLD = r"C:\Windows\Fonts\Amiri Bold.ttf"
pdfmetrics.registerFont(TTFont("Amiri", FONT_REG))
pdfmetrics.registerFont(TTFont("AmiriB", FONT_BOLD))
pdfmetrics.registerFont(TTFont("AmiriBI", r"C:\Windows\Fonts\Amiri Boldslanted.ttf"))

NAVY = HexColor("#151A25")
NAVY2 = HexColor("#1D2534")
GOLD = HexColor("#C9A96A")
GOLD_MUT = HexColor("#8F7B4C")
IVORY = HexColor("#F5F0E6")
SMOKE = HexColor("#4A4D57")
LINE = HexColor("#E2D5BB")


def shp(text, bold=False, italic=False):
    name = "AmiriBI" if (bold and italic) else ("AmiriB" if bold else "Amiri")
    return name, get_display(arabic_reshaper.reshape(text))


class StudyDoc(BaseDocTemplate):
    pass


def build_pdf(meta):
    path = os.path.join(STUDIES_DIR, meta["file"])
    doc = StudyDoc(
        path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title=meta["title"], author="مركز حكيم للدراسات والبحوث",
    )

    def cover_decor(c, d):
        c.saveState()
        c.setFillColor(NAVY)
        c.rect(0, 0, d.width, d.height, stroke=0, fill=1)
        c.setStrokeColor(HexColor("#2A3550"))
        c.setLineWidth(0.75)
        c.rect(8 * mm, 8 * mm, d.width - 16 * mm, d.height - 16 * mm, stroke=1, fill=0)
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.5)
        c.rect(10 * mm, 10 * mm, d.width - 20 * mm, d.height - 20 * mm, stroke=1, fill=0)
        c.setFillColor(GOLD)
        c.rect(8 * mm, d.height - 8 * mm - 2.5, d.width - 16 * mm, 2.5, stroke=0, fill=1)
        c.rect(8 * mm, 8 * mm, d.width - 16 * mm, 2.5, stroke=0, fill=1)
        # logo
        lw = 44 * mm
        try:
            lh = 44 * mm
            c.drawImage(LOGO, (d.width - lw) / 2, d.height - 8 * mm - 44 * mm - 22 * mm,
                        width=lw, height=lh, mask='auto', preserveAspectRatio=True,
                        anchor='c')
        except Exception:
            pass
        c.restoreState()

    def content_header(c, d):
        c.saveState()
        c.setFillColor(IVORY)
        c.rect(0, 0, d.width, d.height, stroke=0, fill=1)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.7)
        c.line(20 * mm, d.height - 16 * mm, d.width - 20 * mm, d.height - 16 * mm)
        c.setFont(*shp("مركز حكيم للدراسات والبحوث", bold=True))
        c.setFillColor(NAVY)
        c.setFontSize(9)
        c.drawCentredString(d.width / 2, d.height - 14 * mm,
                            shp("مركز حكيم للدراسات والبحوث — دمشق", bold=True)[1])
        c.setFont(*shp("دراسات وأبحاث"))
        c.setFillColor(GOLD_MUT)
        c.setFontSize(20)
        c.drawString(20 * mm, d.height - 46 * mm, "◆")
        c.restoreState()

    def content_footer(c, d):
        c.saveState()
        c.setStrokeColor(LINE)
        c.setLineWidth(0.7)
        c.line(20 * mm, 14 * mm, d.width - 20 * mm, 14 * mm)
        c.setFillColor(GOLD_MUT)
        c.setFont(*shp("مركز حكيم للدراسات والبحوث"))
        c.setFontSize(8)
        c.drawCentredString(d.width / 2, 9 * mm, shp("مركز حكيم للدراسات والبحوث — جميع الحقوق محفوظة")[1])
        c.setFont("Amiri", 9)
        c.drawRightString(d.width - 20 * mm, 17 * mm, f"{doc.page:02d}")
        c.restoreState()

    pw, ph = A4
    frame_cover = Frame(0, 0, pw, ph, id="cover")
    frame_body = Frame(20 * mm, 20 * mm, pw - 40 * mm, ph - 42 * mm, id="body",
                       leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[frame_cover], onPage=cover_decor),
        PageTemplate(id="Body", frames=[frame_body], onPageEnd=content_footer, onPage=content_header),
    ])

    S = {}
    S["cover_h"] = ParagraphStyle("cvh", fontName="AmiriB", fontSize=30, leading=40,
                                  alignment=TA_CENTER, textColor=HexColor("#F7F1E3"))
    S["cover_s"] = ParagraphStyle("cvs", fontName="Amiri", fontSize=15, leading=24,
                                  alignment=TA_CENTER, textColor=GOLD)
    S["cover_org"] = ParagraphStyle("cvo", fontName="Amiri", fontSize=10.5, leading=18,
                                    alignment=TA_CENTER, textColor=HexColor("#8E97A8"))
    S["title"] = ParagraphStyle("t", fontName="AmiriB", fontSize=16, leading=24,
                                alignment=TA_RIGHT, textColor=NAVY, spaceAfter=6)
    S["subtitle"] = ParagraphStyle("st", fontName="Amiri", fontSize=11.5, leading=18,
                                   alignment=TA_RIGHT, textColor=GOLD_MUT, spaceAfter=10)
    S["h2"] = ParagraphStyle("h2", fontName="AmiriB", fontSize=13.5, leading=20,
                             alignment=TA_RIGHT, textColor=NAVY, spaceBefore=14, spaceAfter=8)
    S["body"] = ParagraphStyle("b", fontName="Amiri", fontSize=12, leading=23,
                               alignment=TA_JUSTIFY, textColor=SMOKE)
    S["bullet"] = ParagraphStyle("bl", fontName="Amiri", fontSize=12, leading=22,
                                 alignment=TA_RIGHT, textColor=SMOKE,
                                 leftIndent=4, spaceAfter=4)
    S["meta_label"] = ParagraphStyle("ml", fontName="AmiriB", fontSize=11, textColor=IVORY, alignment=TA_CENTER)
    S["meta_val"] = ParagraphStyle("mv", fontName="Amiri", fontSize=11, textColor=NAVY, alignment=TA_CENTER)
    S["kw"] = ParagraphStyle("kw", fontName="Amiri", fontSize=11, leading=20, alignment=TA_RIGHT, textColor=GOLD_MUT)

    story = []
    story.append(Spacer(1, 255 * mm))
    story.append(Paragraph(shp(meta["title"])[1], S["cover_h"]))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(shp(meta["cover_rule_text"])[1], S["cover_s"]))
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph(shp("مركز حكيم للدراسات والبحوث")[1], S["cover_org"]))
    story.append(Paragraph(shp("دمشق — الجمهورية العربية السورية")[1], S["cover_org"]))
    story.append(PageBreak())

    story.append(Paragraph(shp(meta["title"])[1], S["title"]))
    story.append(Paragraph(shp(meta["subtitle"])[1], S["subtitle"]))

    rows = [
        [Paragraph(shp("عنوان الدراسة", bold=True)[1], S["meta_label"]),
         Paragraph(shp(meta["title_short"])[1], S["meta_val"]),
         Paragraph(shp("الاختصاص", bold=True)[1], S["meta_label"]),
         Paragraph(shp(meta["specialty"])[1], S["meta_val"])],
        [Paragraph(shp("سنة الإصدار", bold=True)[1], S["meta_label"]),
         Paragraph(shp(str(meta["year"]))[1], S["meta_val"]),
         Paragraph(shp("المصدر العلمي", bold=True)[1], S["meta_label"]),
         Paragraph(shp(meta["source"])[1], S["meta_val"])],
    ]
    tbl = Table(rows, colWidths=[30 * mm, 78 * mm, 30 * mm, 80 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), NAVY2),
        ("BACKGROUND", (2, 0), (2, -1), NAVY2),
        ("BACKGROUND", (1, 0), (1, -1), HexColor("#FBF7ED")),
        ("BACKGROUND", (3, 0), (3, -1), HexColor("#FBF7ED")),
        ("GRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8))

    story.append(Paragraph(shp("الملخص التنفيذي", bold=True)[1], S["h2"]))
    story.append(Paragraph(shp(meta["abstract"])[1], S["body"]))

    story.append(Paragraph(shp(meta["highlights_title"])[1], S["h2"]))
    for h in meta["highlights"]:
        para = f"<font name='Amiri' size=13 color='#8F7B4C'>◆</font>  {shp(h)[1]}"
        story.append(Paragraph(para, S["bullet"]))
    story.append(Spacer(1, 8))

    if meta.get("method"):
        story.append(Paragraph(shp("المنهجية المعتمدة", bold=True)[1], S["h2"]))
        story.append(Paragraph(shp(meta["method"])[1], S["body"]))

    kws = [shp(f"#{k}")[1] for k in meta["kws"]]
    label = f"<font name='AmiriB' color='#1D2534'>{shp('الكلمات المفتاحية:')[1]}</font>  "
    story.append(KeepTogether([Spacer(1, 10), Paragraph(label + "  ".join(kws), S["kw"])]))

    doc.build(story)
    return path


def main():
    os.makedirs(STUDIES_DIR, exist_ok=True)
    studies = [
        {
            "file": "الاقتصاد - النشرة الشهرية لأسعار المستهلك والتضخم في سوريا - 2024.pdf",
            "title": "النشرة الشهرية لأسعار المستهلك والتضخم في سوريا",
            "title_short": "أسعار المستهلك والتضخم في سوريا",
            "subtitle": "تقييم مستقل لأسعار المستهلك ومعدلات التضخم في كافة المحافظات — كانون الأول 2024",
            "specialty": "الاقتصاد",
            "year": 2024,
            "source": "المركز السوري لبحوث السياسات (SCPR) — النشرة الشهرية العدد 10",
            "cover_rule_text": "سلسلة مؤشرات اقتصادية — العدد العاشر",
            "abstract": (
                "تقدّم هذه الدراسة تقييماً مستقلاً لأسعار المستهلك ومعدلات التضخم في كافة المناطق السورية "
                "بالاستناد إلى مسح شهري للأسعار ينفذه فريق بحث ميداني منذ عام 2020، وفق منهجية مؤشر باش "
                "لسنة الأساس 2021. سجّل الرقم القياسي العام للأسعار خلال كانون الأول 2024 تضخماً شهرياً قياسياً "
                "بلغ 15.1 في المئة، وتضخماً سنوياً بلغ 49.7 في المئة، في أعقاب انتقالات حادة في سوق الصرف "
                "ترافقت مع إعلان بدء المرحلة الانتقالية في الثامن من كانون الأول 2024. وتقدر النشرة تكاليف "
                "المعيشة وخطوط الفقر على المستوى المحلي لكل المحافظات، إذ ارتفع خط الفقر المدقع للأسر نهاية "
                "العام إلى 3.08 ملايين ليرة سورية شهرياً، ووصل خط الفقر الأعلى إلى 6.68 ملايين ليرة، مع "
                "تباينات مرتفعة بين المحافظات ومجموعات الاستهلاك."
            ),
            "highlights_title": "أبرز النتائج",
            "highlights": [
                "بلغت نسبة التضخم الشهري (Month-on-Month) في سوريا خلال كانون الأول 2024 نحو 15.1 في المئة، مقابل 2.0 في المئة في أيلول والأشهر السابقة.",
                "وصلت نسبة التضخم السنوي (Year-on-Year) إلى 49.7 في المئة، ويُعد قطاع السكن والمياه والكهرباء والوقود أكثر المساهمين في الارتفاع.",
                "سجّلت الليرة السورية أدنى قيمها التاريخية في الخامس والسادس والسابع من كانون الأول، حيث بلغ سعر الصرف في السوق الموازية 26,787 ليرة للدولار الواحد.",
                "استقر سعر الصرف الرسمي نهاية الشهر عند 13,567 ليرة للدولار بعد خمسة تعديلات أصدرها مصرف سورية المركزي خلال كانون الأول.",
                "ارتفع خط الفقر المدقع للأسر إلى 3.08 ملايين ليرة شهرياً، والخط الأدنى إلى 4.84 ملايين، والخط الأعلى إلى 6.68 ملايين ليرة.",
                "سجّلت محافظة حمص أعلى معدل تضخم شهري (6.6 في المئة)، تليها ريف دمشق (5.0 في المئة)، فيما سجّلت درعا الأدنى (0.1 في المئة).",
            ],
            "method": (
                "اعتمد التقرير مسحاً شهرياً للأسعار على مستوى جميع المحافظات ومناطق السيطرة، مع بناء مؤشر "
                "رقم قياسي وفق منهجية منظمة العمل الدولية (ILO) لسنة الأساس 2021، وتقدير خطوط الفقر وفق "
                "منهجية محلية معدّلة للبيئة السورية."
            ),
            "kws": ["تضخم", "أسعار المستهلك", "سعر الصرف", "خطوط الفقر", "تكلفة المعيشة"],
        },
        {
            "file": "الاقتصاد - دليل أسعار المستهلك في سوريا وفق مؤشر باش - 2022.pdf",
            "title": "دليل أسعار المستهلك في سوريا",
            "title_short": "دليل أرقام أسعار المستهلك 2021 وفق مؤشر باش",
            "subtitle": "منهجية بناء الرقم القياسي لأسعار المستهلك وتحليل التضخم في سوريا خلال الفترة 2019 — 2022",
            "specialty": "الاقتصاد",
            "year": 2022,
            "source": "المركز السوري لبحوث السياسات — سلسلة أدلة إحصائية 2022",
            "cover_rule_text": "سلسلة أدلة إحصائية",
            "abstract": (
                "تعرض هذه الدراسة المنهجية المتكاملة التي طوّرها فريق البحث لبناء دليل أسعار المستهلك في سوريا، "
                "بتسعير سلة سلعية وخدمية تمثّل أنماط الاستهلاك وفق مسح دخل ونفقات الأسر لعام 2009 ومعادلتها "
                "بمسوحات متعددة الأغراض لعام 2020، واعتماد سنة الأساس 2021. تشير النتائج إلى أن الرقم القياسي "
                "العام للأسعار ارتفع بمقدار ستة أضعاف خلال الفترة بين 2019 ومنتصف 2022، وارتفعت الأسعار "
                "الغذائية بمقدار 6.7 أضعاف، مع تسجيل تضخم سنوي بلغ 113.46 في المئة عام 2020، و110.90 في المئة "
                "عام 2021، و55.71 في المئة في النصف الأول من عام 2022. ويحلل الدليل تضخم سوريا على مستوى "
                "المحافظات ومناطق السيطرة الثلاث، ودور سعر الصرف وتكلفة الطاقة في دفع موجات التضخم."
            ),
            "highlights_title": "أبرز النتائج",
            "highlights": [
                "تشهد سوريا حالة من التضخم المرتفع منذ مطلع العقد، إذ ارتفع الرقم القياسي العام للأسعار بمقدار 6 أضعاف خلال الفترة 2019 — منتصف 2022.",
                "بلغ التضخم السنوي 113.46 في المئة عام 2020، ثم 110.90 في المئة عام 2021، قبل أن يتراجع إلى 55.71 في المئة في النصف الأول من عام 2022.",
                "ارتفعت الأسعار الغذائية بمقدار 6.7 أضعاف، ما جعلها أكبر المساهمين في تضخم سلة المستهلك على مستوى جميع مناطق السيطرة.",
                "عامل سعر صرف الليرة السورية أمام الدولار أميركي والأسعار المضبوطة للطاقة أهم محرّكين لتضخم مجموعة السكن والمياه والكهرباء والوقود.",
                "سجّلت مناطق الحكومة أعلى مستويات التضخم العام والغذائي خلال فترة المسح، تلتها مناطق الإدارة الذاتية ومناطق الحكومة المؤقتة والإغاثة.",
                "يقدّم الدليل معتملاً على مسح ميداني شهري تنفذه فرق بحثية متخصصة في كافة المحافظات بما فيها الريف.",
            ],
            "method": (
                "تسعير شهري لسلة تمثيلية من السلع والخدمات وفق منهجية دليل أسعار المستهلك لمنظمة العمل الدولية، "
                "بسنة أساس 2021، وتقدير التضخم العام والغذائي على المستوى الوطني ومستوى مناطق السيطرة والمحافظات."
            ),
            "kws": ["الرقم القياسي", "مؤشر باش", "التضخم", "سلة المستهلك", "فقر"],
        },
        {
            "file": "الموارد المائية - أزمة المياه والأمن الغذائي في سوريا - 2024.pdf",
            "title": "أزمة المياه والأمن الغذائي في سوريا",
            "title_short": "الجفاف، نهر الفرات، وإنتاج القمح",
            "subtitle": "التبعات المركّبة للتغيّر المناخي والنزاع على الموارد المائية والزراعة في سوريا",
            "specialty": "الموارد المائية",
            "year": 2024,
            "source": "مركز حكيم للدراسات والبحوث — أعمال محكّمة، اعتماداً على بيانات كارنيغي للشرق الأوسط والمنظمة العالمية للأرصاد الجوية",
            "cover_rule_text": "سلسلة دراسات الموارد والتنمية",
            "abstract": (
                "تبحث هذه الدراسة في الأزمة المتشعّبة التي تلتقي عندها عوامل التغيّر المناخي، وسياسات إدارة "
                "المياه المشتركة، وتبعات النزاع الممتد، لتنحصر أثرها في ملف واحد: تراجع قدرة سوريا على إنتاج "
                "غذائها وتأمين مياه الشرب لسكانها. فقد تراجع تدفق نهر الفرات إلى سوريا بنحو 40 في المئة مقارنة "
                "بعام 1972، وبلغ التدفق المسجل عام 2020 حدود 244 متراً مكعباً في الثانية، أي أقل من نصف ما "
                "تُقرّه الاتفاقات الدولية. وعلى صعيد الزراعة انخفض إنتاج القمح عام 2021 إلى 1.05 مليون طن، وهو "
                "الانخفاض الأعمق منذ نحو نصف قرن، بينما يُقدَّر أن نحو 12 مليون شخص واجهوا انعدام الأمن الغذائي. "
                "وخلصت الدراسة إلى أن احتمال حدوث الجفاف في المنطقة ارتفع من مرة واحدة كل 250 عاماً إلى مرة "
                "كل عشر سنوات عند ارتفاع الحرارة 1.2 درجة مئوية، وهو ما يقترب أكثر بالنظر إلى السيناريوهات "
                "المناخية لنهاية العقد."
            ),
            "highlights_title": "أبرز النتائج",
            "highlights": [
                "انخفض تدفق مياه نهر الفرات إلى سوريا بنحو 40 في المئة عام 2015 مقارنة بمستويات عام 1972، وبلغ متوسط التدفق عام 2020 نحو 244 متراً مكعباً في الثانية.",
                "فقدت الأحواض المائية والمسطحات السطحية في سوريا نحو 2.2 مليار متر مكعب من المياه حتى عام 2022.",
                "بلغ إنتاج القمح عام 2021 نحو 1.05 مليون طن فقط، أي 25 في المئة من متوسط الإنتاج خلال 2002 — 2011 البالغ 4.1 ملايين طن.",
                "أدى الجفاف المتتالي منذ 2006 إلى تراجع مستويات المياه الجوفية في الشمال الشرقي بنحو 60 في المئة، وتوسّع رقعة التصحر لتطال نحو 73 في المئة من مساحة البلاد.",
                "تقدّر التحاليل المناخية أن تكرار الجفاف سيصبح كل عشر سنوات بدلاً من كل 250 عاماً عند ارتفاع الحرارة عتبة 1.2 درجة مئوية.",
                "يواجه نحو 12 مليون شخص في سوريا انعدام الأمن الغذائي، وفق تقديرات اللجنة الدولية للصليب الأحمر عام 2023.",
            ],
            "method": (
                "منهجية تحليلية وصفية اعتمدت على مجمع بيانات مناخية وزراعية دولية (WMO، FAO، WWA)، "
                "وتقارير منظمة غير حكومية متخصصة، ومقابلات مع باحثين ميدانيين في الأحواض المائية الرئيسية، "
                "مع اختبار فرضيات السببية بين التغيّر المناخي وأنماط الجفاف."
            ),
            "kws": ["أزمة المياه", "الجفاف", "نهر الفرات", "الأمن الغذائي", "التغيّر المناخي"],
        },
    ]
    for s in studies:
        p = build_pdf(s)
        print("OK ", os.path.basename(p), os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()