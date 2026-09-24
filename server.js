"use strict";
/* ============================================================
   مركز حكيم للدراسات والبحوث — خادم الموقع ونظام الإدارة
   - يخدم واجهة الموقع من public/
   - فحص متلقائي لمجلد studies/ كل 4 ساعات + فوري عند التغيير
   - نظام محتوى (CMS) قابلاً للتحرير من لوحة الإدارة
   - مصادقة الأدمن + نسخ احتياطية + استعادة + رفع شعار
   - بدون أي تبعيات خارجية (Node فقط)
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const STATIC_DIR = process.env.STATIC_DIR || "public";
const PUBLIC = path.join(ROOT, STATIC_DIR);
const DATA = path.join(ROOT, "data");
const STUDIES_DIR = path.join(ROOT, "studies");
const SCAN_INTERVAL = 4 * 60 * 60 * 1000; // 4 ساعات
const PORT = process.env.PORT || 3000;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const MAX_BACKUPS = 25;

let index = { updatedAt: null, lastScan: null, schedule: "كل 4 ساعات", studies: [] };
let scanTimer = null;
let watchTimer = null;

/* ============ الإعدادات ============ */
function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(DATA, "config.json"), "utf8"));
    return Object.assign({ admin: { user: "admin", pass: "", token_ttl_hours: 12 } }, c);
  } catch (_) { return { admin: { user: "admin", pass: "", token_ttl_hours: 12 } }; }
}
function saveConfig(cfg) {
  fs.writeFileSync(path.join(DATA, "config.json"), JSON.stringify(cfg, null, 2));
}
function readJson(file, empty) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return empty; }
}
/* الملف الحالي للوغو: الأولوية PNG ثم JPG ثم SVG */
function currentLogo() {
  const candidates = ["logo.png", "logo.jpg", "logo.svg"];
  for (const c of candidates) {
    if (fs.existsSync(path.join(PUBLIC, "assets", c))) return "/assets/" + c;
  }
  return "/assets/logo.jpg";
}

/* ============ مخزن المحتوى (CMS) ============ */
function deepMerge(base, over) {
  const out = Array.isArray(base) ? (Array.isArray(over) ? over : base.slice()) : Object.assign({}, base);
  if (over && typeof over === "object" && !Array.isArray(over) && !Array.isArray(base)) {
    for (const k of Object.keys(over)) {
      const bv = base[k];
      const ov = over[k];
      if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object" && !Array.isArray(bv)) {
        out[k] = deepMerge(bv, ov);
      } else {
        out[k] = ov;
      }
    }
    for (const k of Object.keys(base)) {
      if (!(k in out)) out[k] = base[k];
    }
  }
  return out;
}
function sanitizeContent(c) {
  // إزالة المفاتيح/القيم غير الآمنة وتقييد حجم النص
  const walk = (v, depth) => {
    if (depth > 8) return null;
    if (typeof v === "string") {
      if (v.length > 20000) return v.slice(0, 20000);
      return v.replace(/<\/?script[^>]*>/gi, "").replace(/src=["']javascript:/gi, 'src=""');
    }
    if (Array.isArray(v)) return v.slice(0, 200).map((x) => walk(x, depth + 1));
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v)) {
        if (k.length > 60) continue;
        const w = walk(v[k], depth + 1);
        if (w !== null) o[k] = w;
      }
      return o;
    }
    return v;
  };
  return walk(c, 0) || {};
}
function loadContent() {
  const def = readJson(path.join(DATA, "cms_default.json"), {});
  const cur = readJson(path.join(DATA, "cms.json"), {});
  return deepMerge(def, cur);
}
function saveContent(raw) {
  const sanitized = sanitizeContent(raw);
  backupCurrent();
  const file = path.join(DATA, "cms.json");
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(sanitized, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return sanitized;
}
function backupCurrent() {
  try {
    const src = path.join(DATA, "cms.json");
    if (!fs.existsSync(src)) return null;
    const bdir = path.join(DATA, "backups");
    if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
    const ts = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const name = "cms-" + ts + ".json";
    fs.copyFileSync(src, path.join(bdir, name));
    let backups = fs.readdirSync(bdir).filter((f) => /^cms-.*\.json$/.test(f)).sort();
    while (backups.length > MAX_BACKUPS) {
      fs.unlinkSync(path.join(bdir, backups.shift()));
    }
    return name;
  } catch (_) { return null; }
}
function listBackups() {
  try {
    const bdir = path.join(DATA, "backups");
    if (!fs.existsSync(bdir)) return [];
    return fs.readdirSync(bdir).filter((f) => /^cms-.*\.json$/.test(f)).sort().reverse().map((f) => {
      const st = fs.statSync(path.join(bdir, f));
      let size = 0;
      try { size = fs.readFileSync(path.join(bdir, f)).length; } catch (_) {}
      return { name: f, size, modified: st.mtime.toISOString() };
    });
  } catch (_) { return []; }
}
function restoreBackup(name) {
  const bdir = path.join(DATA, "backups");
  if (!name || !/^cms-.*\.json$/.test(name)) return { error: "اسم النسخة غير صالح." };
  const src = path.join(bdir, name);
  if (!fs.existsSync(src)) return { error: "النسخة غير موجودة." };
  backupCurrent();
  fs.copyFileSync(src, path.join(DATA, "cms.json"));
  return { ok: true };
}

/* ============ الاختصاصات ============ */
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

/* ============ الفحص ============ */
function scan() {
  return new Promise((resolve) => {
    fs.readdir(STUDIES_DIR, { withFileTypes: true }, (err, entries) => {
      const prev = new Set(index.studies.map((s) => s.file));
      const curr = new Set();
      const studies = [];
      if (!err) {
        for (const ent of entries) {
          if (!ent.isFile()) continue;
          const file = ent.name;
          if (!/\.pdf$/i.test(file)) continue;
          curr.add(file);
          const parsed = parseStudyFile(file);
          let size = 0, mtime = null;
          try { const st = fs.statSync(path.join(STUDIES_DIR, file)); size = Math.round(st.size / 1024); mtime = st.mtime; } catch (_) {}
          studies.push(Object.assign(parsed, { size, modified: mtime ? mtime.toISOString() : null }));
        }
      }
      studies.sort((a, b) => {
        if ((a.year || "0000") !== (b.year || "0000")) return (b.year || "0000").localeCompare(a.year || "0000");
        return a.file.localeCompare(b.file, "ar");
      });
      index.studies = studies;
      index.updatedAt = new Date().toISOString();
      index.lastScan = new Date().toISOString();
      index.count = studies.length;
      const added = [...curr].filter((f) => !prev.has(f));
      const removed = [...prev].filter((f) => !curr.has(f));
      if (added.length || removed.length) {
        log("تم تحديث المكتبة: " + added.length + " إضافة، " + removed.length + " حذف.");
        added.forEach((f) => log("  + إضافة: " + f));
        removed.forEach((f) => log("  - حذف: " + f));
      }
      resolve();
    });
  });
}
function rescanSoon() {
  clearTimeout(watchTimer);
  watchTimer = setTimeout(scan, 1500);
}
function startScheduler() {
  scan().then(() => log("الفحص الأول مكتمل — الموجود: " + index.count + " ملف."));
  scanTimer = setInterval(scan, SCAN_INTERVAL);
  try { fs.watch(STUDIES_DIR, { persistent: false }, () => rescanSoon()); } catch (_) {}
}

/* ============ المصادقة ============ */
const tokens = new Map(); // token -> expiry
const loginAttempts = new Map(); // ip -> {n, at}
function sha(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}
function issueToken() {
  const tok = crypto.randomBytes(32).toString("hex");
  const cfg = loadConfig();
  tokens.set(tok, { exp: Date.now() + (cfg.admin.token_ttl_hours || 12) * 3600000 });
  return tok;
}
function tokenFromReq(req) {
  let t = null;
  const ah = req.headers.authorization || "";
  if (/^Bearer /i.test(ah)) t = ah.slice(7).trim();
  else {
    const cookie = req.headers.cookie || "";
    const m = cookie.match(/(?:^|;\s*)hk_token=([^;\s]+)/);
    if (m) t = m[1];
  }
  if (!t || !tokens.has(t)) return null;
  const rec = tokens.get(t);
  if (Date.now() > rec.exp) { tokens.delete(t); return null; }
  return t;
}
function isAuthed(req) {
  return !!tokenFromReq(req);
}
function tryLogin(pass) {
  const cfg = loadConfig();
  return pass && pass === cfg.admin.pass;
}
function checkRate(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec) { loginAttempts.set(ip, { n: 1, at: Date.now() }); return { ok: true, left: 5 }; }
  if (Date.now() - rec.at > 60000) { loginAttempts.set(ip, { n: 1, at: Date.now() }); return { ok: true, left: 5 }; }
  if (rec.n >= 5) return { ok: false, left: 0 };
  rec.n += 1;
  return { ok: true, left: 5 - rec.n };
}
function readBody(req, limit, cb) {
  const chunks = [];
  let size = 0;
  req.on("data", (c) => {
    size += c.length;
    if (size <= limit) chunks.push(c);
  });
  req.on("end", () => cb(Buffer.concat(chunks).length > limit ? null : Buffer.concat(chunks)));
}

/* ============ خادم HTTP ============ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon",
  ".svg": "image/svg+xml", ".ttf": "font/ttf", ".pdf": "application/pdf"
};
function send(res, code, ct, body, extra) {
  res.writeHead(code, Object.assign({ "Content-Type": ct, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN" }, extra || {}));
  res.end(body);
}
function sendJson(res, code, obj) {
  send(res, code, "application/json; charset=utf-8", JSON.stringify(obj));
}
function secureName(name) {
  if (!name) return null;
  const base = path.basename(String(name));
  if (base !== String(name) || /\.\./.test(base)) return null;
  return base;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);
  const cfg = loadConfig();
  const authed = isAuthed(req);

  /* حالة الخادم */
  if (p === "/api/status") {
    return sendJson(res, 200, {
      ok: true, port: PORT, studiesDir: STUDIES_DIR, schedule: index.schedule,
      lastScan: index.lastScan, updatedAt: index.updatedAt, count: index.count,
      cmsLoaded: !!readJson(path.join(DATA, "cms.json"), null), backups: listBackups().length
    });
  }

  /* حالة الجلسة */
  if (p === "/api/auth/status") return sendJson(res, 200, { loggedIn: authed, user: authed ? cfg.admin.user : null });

  /* الدخول */
  if (p === "/api/auth/login" && req.method === "POST") {
    return readBody(req, 20000, (buf) => {
      if (!buf) return sendJson(res, 413, { error: "حجم الطلب كبير." });
      let body = {};
      try { body = JSON.parse(buf.toString("utf8")); } catch (_) { return sendJson(res, 400, { error: "بيانات غير صالحة." }); }
      const ip = req.socket.remoteAddress || "local";
      const rate = checkRate(ip);
      if (!rate.ok) return sendJson(res, 429, { error: "محاولات كثيرة — انتظر دقيقة." });
      if (!tryLogin(body.pass)) return sendJson(res, 401, { error: "كلمة المرور غير صحيحة." });
      const tok = issueToken();
      const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      return sendJson(res, 200, { ok: true, token: tok }, { "Set-Cookie": "hk_token=" + tok + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200" + secure });
    });
  }

  /* الخروج */
  if (p === "/api/auth/logout" && req.method === "POST") {
    const t = tokenFromReq(req);
    if (t) tokens.delete(t);
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": "hk_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
  }

  /* مسارات تتطلب مصادقة */
  if (p.indexOf("/api/") === 0 && (req.method === "PUT" || req.method === "POST" || req.method === "DELETE")) {
    if (p === "/api/auth/login" || p === "/api/auth/logout") { /* لا تحقق */ }
    else if (!authed) return sendJson(res, 401, { error: "غير مسموح — سجّل الدخول أولاً." });
  }

  /* المحتوى: قراءة (عام) */
  if (p === "/api/content" && req.method === "GET") {
    const content = loadContent();
    return sendJson(res, 200, { ok: true, logo: currentLogo(), cmsUpdatedAt: readJson(path.join(DATA, "cms.json"), {}) ? fs.statSync(path.join(DATA, "cms.json")).mtime.toISOString() : null, content });
  }

  /* المحتوى: كتابة (محمي) */
  if (p === "/api/content" && req.method === "PUT") {
    return readBody(req, 400000, (buf) => {
      if (!buf) return sendJson(res, 413, { error: "حجم المحتوى كبير جداً." });
      let body = {};
      try { body = JSON.parse(buf.toString("utf8")); } catch (_) { return sendJson(res, 400, { error: "محتوى غير صالح." }); }
      if (!body || typeof body !== "object") return sendJson(res, 400, { error: "المحتوى يجب أن يكون كائناً." });
      const merged = deepMerge(loadContent(), body);
      const saved = saveContent(merged);
      log("حُدّث محتوى الموقع من لوحة الإدارة.");
      return sendJson(res, 200, { ok: true, content: saved, backedUp: true });
    });
  }

  /* إعادة الضبط (محمي) */
  if (p === "/api/content/reset" && req.method === "POST") {
    backupCurrent();
    fs.copyFileSync(path.join(DATA, "cms_default.json"), path.join(DATA, "cms.json"));
    log("أُعيد ضبط المحتوى إلى الافتراضي.");
    return sendJson(res, 200, { ok: true, content: loadContent() });
  }

  /* قائمة النسخ الاحتياطية (محمي) */
  if (p === "/api/content/backups" && req.method === "GET") {
    if (!authed) return sendJson(res, 401, { error: "غير مسموح — سجّل الدخول أولاً." });
    return sendJson(res, 200, { ok: true, backups: listBackups() });
  }

  /* استعادة نسخة (محمي) */
  if (p === "/api/content/restore" && req.method === "POST") {
    return readBody(req, 20000, (buf) => {
      if (!buf) return sendJson(res, 400, { error: "بيانات غير صالحة." });
      let body = {};
      try { body = JSON.parse(buf.toString("utf8")); } catch (_) { return sendJson(res, 400, { error: "بيانات غير صالحة." }); }
      const r = restoreBackup(body.name);
      if (r.error) return sendJson(res, 400, { error: r.error });
      log("جُلبت نسخة احتياطية: " + body.name);
      return sendJson(res, 200, { ok: true, content: loadContent() });
    });
  }

  /* تغيير كلمة المرور (محمي) */
  if (p === "/api/admin/password" && req.method === "POST") {
    return readBody(req, 20000, (buf) => {
      if (!buf) return sendJson(res, 400, { error: "بيانات غير صالحة." });
      let body = {};
      try { body = JSON.parse(buf.toString("utf8")); } catch (_) { return sendJson(res, 400, { error: "بيانات غير صالحة." }); }
      const cfg2 = loadConfig();
      if (body.old !== cfg2.admin.pass) return sendJson(res, 403, { error: "كلمة المرور الحالية غير صحيحة." });
      if (!body.new || String(body.new).length < 8) return sendJson(res, 400, { error: "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف." });
      cfg2.admin.pass = String(body.new);
      saveConfig(cfg2);
      tokens.clear(); // إنهاء كل الجلسات
      log("تغيّرت كلمة مرور الأدمن — أُغلقت كل الجلسات.");
      return sendJson(res, 200, { ok: true });
    });
  }

  /* رفع شعار (محمي) */
  if (p === "/api/logo" && req.method === "PUT") {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    if (ct.indexOf("image/") !== 0) return sendJson(res, 415, { error: "ارفع ملف صورة فقط." });
    return readBody(req, MAX_LOGO_BYTES, (buf) => {
      if (!buf) return sendJson(res, 413, { error: "حجم الصورة كبير جداً (الحد 4MB)." });
      const ext = ct.indexOf("png") !== -1 ? ".png" : (ct.indexOf("svg") !== -1 ? ".svg" : ".jpg");
      fs.writeFileSync(path.join(PUBLIC, "assets", "logo" + ext), buf);
      log("استُبدل شعار الموقع (" + ext + ").");
      return sendJson(res, 200, { ok: true, logo: currentLogo() });
    });
  }

  /* استعادة الشعار الأصلي (محمي) */
  if (p === "/api/logo/reset" && req.method === "POST") {
    if (!fs.existsSync(path.join(PUBLIC, "assets", "logo-original.jpg"))) return sendJson(res, 404, { error: "لا يوجد شعار أصلي محفوظ." });
    ["logo.png", "logo.svg"].forEach((e) => {
      const f = path.join(PUBLIC, "assets", e);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    fs.writeFileSync(path.join(PUBLIC, "assets", "logo.jpg"), fs.readFileSync(path.join(PUBLIC, "assets", "logo-original.jpg")));
    log("استُعيد الشعار الأصلي.");
    return sendJson(res, 200, { ok: true, logo: "/assets/logo.jpg" });
  }

  /* قائمة الدراسات */
  if (p === "/api/studies") return sendJson(res, 200, index);

  /* فحص المجلد الآن */
  if (p === "/api/scan" && req.method === "POST") {
    return scan().then(() => sendJson(res, 200, { ok: true, count: index.count, lastScan: index.lastScan }));
  }

  /* رفع ملف دراسة */
  if (p === "/api/upload" && (req.method === "PUT" || req.method === "POST")) {
    const name = secureName(url.searchParams.get("name"));
    if (!name || !/\.pdf$/i.test(name)) return sendJson(res, 400, { error: "اسم الملف غير صالح — يجب أن يكون ملف PDF." });
    return readBody(req, 60 * 1024 * 1024, (buf) => {
      if (!buf) return sendJson(res, 413, { error: "الملف كبير جداً (الحد 60MB)." });
      if (buf.length < 100) return sendJson(res, 400, { error: "ملف فارغ أو صغير جداً." });
      fs.writeFile(path.join(STUDIES_DIR, name), buf, (err) => {
        if (err) return sendJson(res, 500, { error: "تعذر حفظ الملف." });
        log("استُلم ملف مرفوع: " + name + " (" + buf.length + " بايت).");
        scan().then(() => sendJson(res, 200, { ok: true, name, count: index.count }));
      });
    });
  }

  /* حذف ملف دراسة */
  if (p === "/api/upload" && req.method === "DELETE") {
    const name = secureName(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { error: "اسم الملف غير صالح." });
    fs.unlink(path.join(STUDIES_DIR, name), (err) => {
      if (err) return sendJson(res, 404, { error: "الملف غير موجود." });
      log("حُذف ملف: " + name);
      scan().then(() => sendJson(res, 200, { ok: true, name, count: index.count }));
    });
    return;
  }

  /* خدمة ملفات الدراسات */
  if (p.startsWith("/studies/")) {
    const name = secureName(p.slice("/studies/".length));
    if (!name || !/\.pdf$/i.test(name)) return sendJson(res, 400, { error: "اسم ملف غير صالح." });
    const full = path.join(STUDIES_DIR, name);
    return fs.stat(full, (err, st) => {
      if (err || !st.isFile()) return sendJson(res, 404, { error: "الملف غير موجود." });
      const inline = url.searchParams.get("d") !== "1";
      res.writeHead(200, {
        "Content-Type": "application/pdf", "Content-Length": st.size,
        "Content-Disposition": inline ? "inline" : "attachment; filename*=UTF-8''" + encodeURIComponent(name),
        "Accept-Ranges": "bytes", "Cache-Control": "no-cache"
      });
      fs.createReadStream(full).pipe(res);
    });
  }

  /* دليل الإدارة */
  if (p === "/admin" || p === "/admin/") {
    return send(res, 302, "text/plain", "", { Location: "/admin.html" });
  }

  /* ملفات ثابتة */
  let rel = p === "/" ? "/index.html" : p;
  let filePath = path.normalize(path.join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) return sendJson(res, 403, { error: "مسار مرفوض." });
  const ext = path.extname(filePath).toLowerCase();
  if (!MIME[ext]) return sendJson(res, 404, { error: "غير موجود." });
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return sendJson(res, 404, { error: "الملف غير موجود: " + rel });
    send(res, 200, MIME[ext], fs.readFileSync(filePath), { "Last-Modified": st.mtime.toUTCString() });
  });
});

/* ============ السجلات ============ */
function log(...args) {
  const t = new Date().toLocaleString("ar-SY", { hour12: false });
  console.log("[" + t + "]", ...args);
}

server.listen(PORT, () => {
  const cfg = loadConfig();
  console.log("");
  console.log("  ════════════════════════════════════════════════════════════");
  console.log("    مركز حكيم للدراسات والبحوث — خادم الموقع والإدارة يعمل");
  console.log("  ════════════════════════════════════════════════════════════");
  console.log("    الرابط:   http://localhost:" + PORT);
  console.log("    الصفحة:   public/      |   الدراسات: studies/");
  console.log("    الإدارة:  http://localhost:" + PORT + "/admin.html");
  console.log("    الفحص التلقائي: كل 4 ساعات (+ فوري عند التغيير)");
  console.log("    نسخ احتياطية تلقائية للمحتوى عند كل حفظ.");
  console.log("");
  startScheduler();
});

process.on("SIGINT", () => { clearInterval(scanTimer); process.exit(0); });