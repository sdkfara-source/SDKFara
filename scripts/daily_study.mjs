// تشغيل يومي: عند أول إقلاع للخادم في اليوم، يتحقق من الدراسة اليومية
// 1) إن وُجدت مسودة دراسة (HTML) في data/study_drafts/ => يحوّلها إلى PDF ويضعها في studies/
// 2) إن لم توجد => يختار موضوع اليوم من خطة التناوب ويُجهّز قالب المسودة الجديد
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const STUDIES = path.join(ROOT, "studies");
const DRAFTS = path.join(DATA, "study_drafts");
const PLAN = path.join(DATA, "study_plan.json");
const LOG = path.join(DATA, "study_log.json");

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// مولّد أرقام عشوائية بتوزيع موحّد (يكفي للتناوب العشوائي، لا أغراض أمنية)
function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function setupDrafts() {
  fs.mkdirSync(DRAFTS, { recursive: true });
}

// إن وجد مسار Edge/Chrome
function findBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function htmlToPdf(htmlPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const browser = findBrowser();
    const url = "file:///" + htmlPath.split("\\").join("/");
    const out = pdfPath;
    const args = [
      "--headless", "--disable-gpu", "--no-sandbox",
      "--print-to-pdf=" + out, "--no-pdf-header-footer", url,
    ];
    const child = spawn(browser, args, { stdio: "ignore", windowsHide: true });
    const timer = setTimeout(() => { child.kill(); reject(new Error("نفد وقت الطباعة")); }, 90000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(out)) resolve(out);
      else reject(new Error("فشل أمر الطباعة (code " + code + ")"));
    });
    child.on("error", reject);
  });
}

// اختيار موضوع اليوم من خطة التناوب (لا يُكرر حتى تستكمل الدورة)
function chooseTodayTopic(plan, rng) {
  const used = plan.last_used || [];
  let pool = plan.topics.filter((t) => !used.includes(t.key));
  if (pool.length === 0) {
    pool = plan.topics.slice();
    plan.last_used = [];
  }
  const topic = pickRandom(pool, rng);
  plan.last_used = (plan.last_used || []).concat(topic.key);
  plan.last_used = plan.last_used.slice(-plan.topics.length);
  return plan;
}

// إنشاء مسودة HTML جديدة من قالب محدد
function createDraftHTML(topic, dateStr) {
  const { title, focus_hint } = topic;
  const tpl = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"><title>${title}</title>
<style>
@page { size: A4; margin: 2.3cm 1.9cm; }
body { font-family: "Amiri", "Traditional Arabic", serif; font-size: 12.5pt; line-height: 1.95; color: #161616; text-align: justify; }
.hdr { text-align: center; border-bottom: 3px double #7a5c2e; padding-bottom: 16px; }
.hdr h1 { font-size: 21pt; color: #6b1f1f; }
.rule { height: 2px; background: linear-gradient(90deg, transparent, #7a5c2e, transparent); margin: 14px 0; }
h2 { color: #5a1e1e; border-right: 5px solid #7a5c2e; padding-right: 10px; }
</style>
</head>
<body>
<div class="hdr">
  <div class="org">مركز حكيم للدراسات والبحوث — سلسلة المطالعات اليومية</div>
  <h1>${title}</h1>
  <div class="meta">التاريخ: ${dateStr} | التصنيف: ${topic.category}</div>
</div>
<div class="rule"></div>
<p><b>إطار البحث:</b> ${focus_hint}</p>
<!-- اكتب مضمون المسودة هنا قبل موعد النشر -->
</body>
</html>`;
  return tpl;
}

async function main() {
  const force = process.argv.includes("--force");
  setupDrafts();
  const plan = readJSON(PLAN, { topics: [], last_used: [] });
  if (!plan.topics || plan.topics.length === 0) {
    console.log("daily_study: لا توجد خطة مواضيع. أنشئ data/study_plan.json أولاً.");
    process.exit(0);
  }

  const now = new Date();
  const dateStr = todayStr(now);
  const planDate = plan.last_date;
  const sameDay = planDate === dateStr;

  // 1) معالجة أي مسودة جاهزة تنتظر اليوم (إن طلب القوة أو كانت اليوم هو تاريخها)
  const drafts = fs.readdirSync(DRAFTS).filter((f) => f.endsWith(".html"));
  if (drafts.length > 0 && (force || !sameDay)) {
    const htmlPath = path.join(DRAFTS, drafts[0]);
    const fileName = path.basename(htmlPath, ".html");
    // التسمية: التصنيف - العنوان المختصر - السنة.pdf ثم يوضع في studies/
    const pdfName = fileName.includes("-") ? fileName + " - " + now.getFullYear() + ".pdf" : fileName + ".pdf";
    // نغلّف العنوان بجولة عربية إذا لم يكن التصنيف داخلاً في الاسم
    const targetPdf = path.join(STUDIES, pdfName);
    if (fs.existsSync(targetPdf) && !force) {
      console.log("daily_study: دراسة اليوم موجودة مسبقاً (" + pdfName + ") — تخطي.");
      process.exit(0);
    }
    if (!fs.existsSync(targetPdf) || force) {
      try {
        await htmlToPdf(htmlPath, targetPdf);
        console.log("daily_study: تم توليد " + pdfName);
        // نقل الملف خارج قائمة المسودات (نسجل في log)
        const log = readJSON(LOG, { entries: [] });
        log.entries.push({ date: dateStr, file: pdfName, source: htmlPath });
        writeJSON(LOG, log);
        fs.unlinkSync(htmlPath);
        plan.last_date = dateStr;
        writeJSON(PLAN, plan);
        console.log("daily_study: أُضيفت دراسة اليوم إلى مجلد studies/ مباشرة.");
        process.exit(0);
      } catch (e) {
        console.error("daily_study: فشل توليد PDF: " + e.message);
        process.exit(1);
      }
    }
  }

  // 2) إن وُجدت دراسة لليوم => لا حاجة لشيء
  if (sameDay) {
    console.log("daily_study: دراسة اليوم (" + dateStr + ") موجودة/معالَجة مسبقاً — انتهى.");
    process.exit(0);
  }

  // 3) يوم جديد => اختيار موضوع اليوم وتجهيز مسودة للمؤلف (الحلقة البحثية تُنهج خارج النطاق الآلي)
  chooseTodayTopic(plan, Math.random);
  plan.last_date = dateStr;
  writeJSON(PLAN, plan);
  const topic = plan.topics.find((t) => t.key === plan.last_used[plan.last_used.length - 1]);
  const draftFile = path.join(DRAFTS, topic.category + " - مسودة " + dateStr + ".html");
  if (!fs.existsSync(draftFile)) {
    fs.writeFileSync(draftFile, createDraftHTML(topic, dateStr), "utf8");
  }
  console.log("daily_study: يوم جديد (" + dateStr + ") — موضوع اليوم: " + topic.title + ". المسودة جاهزة في data/study_drafts/");
}

main().catch((e) => { console.error("daily_study: " + e.stack || e.message); process.exit(1); });