// يبني نسخة ثابتة من الموقع (بدون خادم) في مجلد docs/ للرفع على GitHub Pages
// مصدر الدراسات (واحد من الاثنين):
//   1) Google Drive  — عند توفر إعدادات Drive (مفضّل): تُقرأ قائمة PDF من مجلد عام
//   2) مجلد studies/ محلياً — عندما لا يتوفر إعداد Drive (سلوك قديم، يُستخدم للاحتياط/التطوير)
// إعداد Drive يُقرأ من متغيرات البيئة GOOGLE_API_KEY + DRIVE_FOLDER_ID،
// أو من ملف data/drive.json: { "apiKey": "...", "folderId": "..." } (إضافة هذا الملف إلى .gitignore)
// المتطلبات: مجلد Google Drive مفتوح (Anyone with the link) + مفتاح Google API مفعّل عليه Drive API
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const STUDIES = path.join(ROOT, "studies");
const OUT = path.join(ROOT, "docs");
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_FOLDER_VIEW = "https://drive.google.com/embeddedfolderview";

const SPECIALTY_META = [
  { keys: ["الاقتصاد", "اقتصاد", "اقتصادية", "المالية", "التجارية", "النقد"], label: "الاقتصاد والتنمية", icon: "◆" },
  { keys: ["الموارد المائية", "موارد مائية", "المياه", "المائية", "زراعة", "الزراعة", "البيئة", "المناخ"], label: "الموارد المائية والزراعة", icon: "◈" },
  { keys: ["سياسات", "سياسة", "السياسة", "العامة", "حوكمة", "الإدارة", "الحوكمة"], label: "السياسات العامة", icon: "⬢" },
  { keys: ["قانون", "القانون", "تشريع", "حقوق"], label: "القانون والسياسات التشريعية", icon: "⚖" },
  { keys: ["اجتماع", "الاجتماع", "المجتمع", "ديموغرافي"], label: "الدراسات الاجتماعية", icon: "☺" },
  { keys: ["تاريخ", "التاريخ"], label: "التاريخ والذاكرة الوطنية", icon: "◆" },
  { keys: ["طاقة", "الطاقة", "كهرباء", "نفط"], label: "الطاقة والبنية التحتية", icon: "⚡" },
  { keys: ["صحة", "الصحة", "تعليم", "التعليم"], label: "الصحة والتنمية", icon: "✚" }
];

function specialtyInfo(raw) {
  if (!raw) return { label: "دراسات عامة", icon: "◆" };
  const clean = String(raw).replace(/\s+/g, " ").trim();
  for (const meta of SPECIALTY_META) {
    for (const k of meta.keys) {
      if (clean === k || clean.indexOf(k) !== -1 || k.indexOf(clean) !== -1) return { label: meta.label, icon: meta.icon };
    }
  }
  return { label: clean, icon: "◆" };
}

function parseStudyFile(file) {
  if (!/\.pdf$/i.test(file)) return null;
  const base = file.slice(0, -4);
  let specialty = null, title = base, year = null;
  const parts = base.split(" - ");
  if (parts.length >= 2 && /^\d{4}$/.test(parts[parts.length - 1].trim())) {
    year = parts.pop().trim(); specialty = parts.shift().trim(); title = parts.join(" - ").trim();
  }
  if (!year) {
    const parts2 = base.split("_");
    if (parts2.length >= 2 && /^\d{4}$/.test(parts2[parts2.length - 1].trim())) {
      year = parts2.pop().trim(); specialty = parts2.shift().trim(); title = parts2.join(" ").trim();
    }
  }
  if (!year) {
    const m = base.match(/(\d{4})/g);
    if (m) {
      year = m[m.length - 1];
      if (!specialty && base.indexOf("-") !== -1) {
        specialty = base.slice(0, base.indexOf("-")).trim();
        title = base.slice(base.indexOf("-") + 1).replace(/\s*\(?(\d{4})\)?\s*$/, "").trim();
      }
    }
  }
  if (!specialty && title === base && base.indexOf("-") !== -1) {
    specialty = base.slice(0, base.indexOf("-")).trim();
    title = base.slice(base.indexOf("-") + 1).trim();
  }
  const meta = specialtyInfo(specialty);
  return {
    file, title: (title || base).replace(/\.pdf$/i, ""),
    specialty: specialty || "دراسات عامة", specialty_label: meta.label, icon: meta.icon, year: year || ""
  };
}

function loadCms() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, "cms.json"), "utf8")); } catch (_) { }
  try { return JSON.parse(fs.readFileSync(path.join(DATA, "cms_default.json"), "utf8")); } catch (_) { }
  return {};
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, ent.name), d = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rm(p) { try { fs.rmSync(p, { force: true }); } catch (_) { } }

// يُرجع إعداد Google Drive إن وُجد، وإلا null (نُلجئ حينها إلى مجلد studies/ المحلي)
// يكفي وجود DRIVE_FOLDER_ID (مُشارَك عام) لتشغيل المزامنة بلا مفتاح API.
// GOOGLE_API_KEY اختياري ويُستخدم فقط للاستعلام الرسمي (أسماء/حجوم أدق).
function driveConfig() {
  if (process.env.DRIVE_FOLDER_ID) {
    return { folderId: process.env.DRIVE_FOLDER_ID, apiKey: process.env.GOOGLE_API_KEY || "" };
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(DATA, "drive.json"), "utf8"));
    if (cfg.folderId) return { folderId: cfg.folderId, apiKey: cfg.apiKey || "" };
  } catch (_) { }
  return null;
}

// يسحب قائمة ملفات PDF من مجلد Drive عام في خطوتين:
//   1) إن وُجد مفتاح API: استعلام رسمي (أسماء/معرّفات/أحجام/تواريخ).
//   2) بلا مفتاح (احتياط): يقرأ صفحة embedded public shared العامة ولا يحتاج أي تسجيل دخول أو مفتاح.
//      المرأة: نشاط الملفات واسمها الظاهر — موثوقة للفرز والتبويب، والحجم إرشادي من ترويسة السيرفر.
async function listDrivePdfs(cfg) {
  if (cfg.apiKey) {
    const params = new URLSearchParams();
    params.set("q", `'${cfg.folderId}' in parents and trashed=false and mimeType='application/pdf'`);
    params.set("fields", "files(id,name,size,modifiedTime,webViewLink)");
    params.set("key", cfg.apiKey);
    let res;
    try {
      res = await fetch(`${DRIVE_API}/files?${params}`, { headers: { accept: "application/json" } });
    } catch (err) {
      throw new Error("تعذّر الاتصال بـ Google Drive: " + (err && err.message ? err.message : String(err)));
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (body.error && body.error.message) || res.statusText || String(res.status);
      if (res.status === 403 || res.status === 400) {
        console.warn("API key لم يخرج القائمة — التحويل إلى الوضع العام: " + msg);
      } else {
        throw new Error("فشل Google Drive (" + res.status + "): " + msg +
          "\nتأكد أن المجلد مشارَك مع أي شخص يملك الرابط (Anyone with the link) وأن مفتاح API مفعّل عليه Google Drive API.");
      }
    } else {
      return Array.isArray(body.files) ? body.files : [];
    }
  }
  return listDrivePdfsPublic(cfg.folderId);
}

// الوضع العام (بلا API key): يقرأ صفحة "تعريف أي شخص برابط" pubish الشائعة
// ويكرر inline HTML بحثاً عن إدخالات .flip-entry (المعرّف + العنوان الظاهر).
async function listDrivePdfsPublic(folderId) {
  const url = `${DRIVE_FOLDER_VIEW}?id=${encodeURIComponent(folderId)}`;
  let html;
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", accept: "text/html,*/*" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    html = await res.text();
  } catch (err) {
    throw new Error("تعذّر قراءة مجلد Drive العام (folderview): " + (err && err.message ? err.message : String(err)));
  }
  const files = [];
  const re = /<div class="flip-entry" id="entry-([^"]+)".*?flip-entry-title">([^<]+)<\/div>/gs;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1].trim();
    const name = m[2].replace(/&amp;/g, "&").replace(/<\/?[^>]+>/g, "").trim();
    if (!id || !/\.pdf$/i.test(name)) continue;
    // حجم إرشادي عبر ترويسة Content-Length (متابعة إعادة التوجيه ثم قراءة الترويسة النهائية)
    let size = 0;
    try {
      let head = await fetch("https://drive.google.com/uc?export=download&id=" + id, { method: "HEAD", redirect: "follow" });
      const len = head.headers.get("content-length");
      if (len) size = Number(len);
    } catch (_) { }
    files.push({ id, name, size, modifiedTime: null });
  }
  if (files.length === 0) {
    throw new Error("لم يُعثر على ملفات PDF في المجلد العام — تأكد من صلاحية FOLDER_ID وأن مشاركته Anyone with the link.");
  }
  return files;
}

async function main() {
  const drive = driveConfig();

  if (!drive && !fs.existsSync(STUDIES)) {
    console.log("لا يوجد مصدر دراسات (لا إعداد Google Drive ولا مجلد studies/ محلي) — تخطي البناء دون تغيير docs/.");
    return;
  }

  copyDir(SRC, OUT);
  rm(path.join(OUT, "admin.html"));
  rm(path.join(OUT, "js", "admin.js"));
  rm(path.join(OUT, "css", "admin.css"));
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

  const studies = [];

  if (drive) {
    console.log("مصدر الدراسات: Google Drive (folderId=" + drive.folderId + ")");
    const files = await listDrivePdfs(drive);
    for (const f of files) {
      const parsed = parseStudyFile(f.name);
      studies.push(Object.assign(parsed, {
        source: "drive",
        driveId: f.id,
        driveViewUrl: "https://drive.google.com/file/d/" + f.id + "/preview",
        driveDownloadUrl: "https://drive.google.com/uc?export=download&id=" + f.id,
        size: Math.round(Number(f.size || 0) / 1024),
        modified: f.modifiedTime || new Date().toISOString()
      }));
    }
    rm(path.join(OUT, "studies"));
  } else {
    console.log("مصدر الدراسات: مجلد studies/ المحلي (بدون ربط Drive)");
    fs.mkdirSync(path.join(OUT, "studies"), { recursive: true });
    for (const file of fs.readdirSync(STUDIES)) {
      if (!/\.pdf$/i.test(file)) continue;
      try {
        const st = fs.statSync(path.join(STUDIES, file));
        const parsed = parseStudyFile(file);
        studies.push(Object.assign(parsed, { size: Math.round(st.size / 1024), modified: st.mtime.toISOString() }));
        fs.copyFileSync(path.join(STUDIES, file), path.join(OUT, "studies", file));
      } catch (_) { }
    }
  }

  studies.sort((a, b) =>
    (a.year || "0000") !== (b.year || "0000")
      ? (b.year || "0000").localeCompare(a.year || "0000")
      : a.file.localeCompare(b.file, "ar")
  );

  const now = new Date().toISOString();
  const studiesData = { studies, updatedAt: now, lastScan: now, count: studies.length, static: true };
  fs.writeFileSync(path.join(OUT, "studies.json"), JSON.stringify(studiesData, null, 2));

  let html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  html = html.replace(/<a\s+class="admin-link"[^>]*>[\s\S]*?<\/a>/, "");
  const cms = loadCms();
  const safe = (o) => JSON.stringify(o).replace(/<\//g, "<\\/");
  const inline = "\n  <script>window.HAKEEM_CMS=" + safe({ logo: "assets/logo.png", content: cms }) +
    ";window.HAKEEM_STUDIES=" + safe(studiesData) + ";<\/script>\n  <script src=\"js/cms.js\"></script>";
  html = html.replace('<script src="js/cms.js"></script>', inline);
  fs.writeFileSync(path.join(OUT, "index.html"), html);

  console.log("اكتمل ✓  دراسات: " + studies.length);
  console.log("الموقع: docs/  (مفاتيح خاصية Pages: Source = main /docs)");
}

main().catch((err) => {
  console.error("خطأ في البناء:", err && err.message ? err.message : err);
  process.exitCode = 1;
});