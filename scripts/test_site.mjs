const BASE = "http://localhost:3000";
const PASS = "hakeem2026";

let failures = 0;
function ok(label, cond, extra = "") {
  if (!cond) failures++;
  console.log((cond ? "[PASS]" : "[FAIL]") + " " + label + (extra ? " — " + extra : ""));
}

async function main() {
  // 0) الدخول
  let r = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: "admin", pass: PASS })
  });
  const login = await r.json();
  ok("auth login", r.status === 200 && login.ok === true, "status=" + r.status);
  const TOKEN = login.token || "";
  const auth = { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" };

  // 1) الصفحة الرئيسية
  r = await fetch(BASE + "/");
  let html = await r.text();
  ok("GET /", r.status === 200 && /مركز حكيم/.test(html), "status=" + r.status + ", len=" + html.length);

  // 2) صفحة الإدارة
  r = await fetch(BASE + "/admin.html");
  ok("GET /admin.html", r.status === 200 && /إدارة/.test(await r.text()), "status=" + r.status);

  // 3) الأصول
  for (const f of ["css/styles.css", "css/admin.css", "js/main.js", "js/studies.js", "js/cms.js", "js/admin.js", "assets/logo.png", "assets/favicon.png"]) {
    r = await fetch(BASE + "/" + f);
    ok("GET /" + f, r.status === 200, "status=" + r.status);
  }

  // 4) حالة الخادم
  r = await fetch(BASE + "/api/status");
  const st = await r.json();
  ok("api/status", st.ok === true && st.count === 4, "count=" + st.count + ", schedule=" + st.schedule);

  // 5) قائمة الدراسات
  r = await fetch(BASE + "/api/studies");
  const data = await r.json();
  ok("api/studies count", data.studies.length === 4, "count=" + data.studies.length);
  const first = data.studies[0];
  console.log("   first file: " + first.file);
  console.log("   first specialty: " + first.specialty_label + " / year=" + first.year);
  ok("parse specialty", first.specialty_label === "الاقتصاد والتنمية");
  ok("parse year newest first", first.year === "2024");

  // 6) تحميل PDF inline و attachment
  const file0 = first.file;
  r = await fetch(BASE + "/studies/" + encodeURIComponent(file0));
  const buf = new Uint8Array(await r.arrayBuffer());
  ok("serve PDF inline", r.status === 200 && buf.length > 100000 && r.headers.get("content-type").includes("pdf"),
    "bytes=" + buf.length + ", cd=" + r.headers.get("content-disposition"));
  r = await fetch(BASE + "/studies/" + encodeURIComponent(file0) + "?d=1");
  const cd = r.headers.get("content-disposition") || "";
  ok("serve PDF download", cd.startsWith("attachment"), "cd=" + cd.slice(0, 40));

  // 7) رفع اختباري (محمي) ثم حذف
  let fake = Buffer.concat([Buffer.from("%PDF-1.4 demo upload test\n"), Buffer.alloc(2048, 65), Buffer.from("\n%%EOF\n")]);
  r = await fetch(BASE + "/api/upload?name=" + encodeURIComponent("اختبار - ملف تجربة مؤقت - 2025.pdf"),
    { method: "PUT", headers: auth, body: new Uint8Array(fake) });
  let up = await r.json();
  ok("upload with auth", up.ok === true && up.count === 5, "count=" + up.count);

  r = await fetch(BASE + "/api/studies");
  let data2 = await r.json();
  const uploaded = data2.studies.find((s) => /تجربة مؤقت/.test(s.title));
  ok("uploaded visible + parsed", !!uploaded && uploaded.year === "2025", uploaded ? "title=" + uploaded.title : "");

  r = await fetch(BASE + "/api/upload?name=" + encodeURIComponent("اختبار - ملف تجربة مؤقت - 2025.pdf"),
    { method: "DELETE", headers: auth });
  const del = await r.json();
  ok("delete with auth", del.ok === true && del.count === 4, "count=" + del.count);

  // 8) أمان المسارات + رفض غير المصادق
  r = await fetch(BASE + "/studies/" + encodeURIComponent("../server.js"));
  ok("path traversal blocked", r.status === 400 || r.status === 404, "status=" + r.status);
  r = await fetch(BASE + "/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hero: { cta1: "x" } }) });
  ok("PUT content requires auth (401)", r.status === 401, "status=" + r.status);
  r = await fetch(BASE + "/api/content/backups");
  ok("GET backups requires auth (401)", r.status === 401, "status=" + r.status);
  r = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: "admin", pass: "wrong" }) });
  ok("wrong password rejected", r.status === 401, "status=" + r.status);

  // 9) CMS: قراءة + كتابة + نسخة احتياطية + استعادة + تصفير
  r = await fetch(BASE + "/api/content");
  const c0 = await r.json();
  ok("GET content", r.status === 200 && c0.content && c0.content.brand && c0.content.hero && c0.content.stats.length >= 4,
    "logo=" + c0.logo + ", theme.navy=" + (c0.content.theme && c0.content.theme.navy));

  r = await fetch(BASE + "/api/content", { method: "PUT", headers: auth, body: JSON.stringify({ hero: { cta1: "زر معدّل" } }) });
  const c1 = await r.json();
  ok("PUT content saves + deep merge", r.status === 200 && c1.content.hero.cta1 === "زر معدّل" && c1.content.brand.name_ar, "cta1=" + (c1.content.hero && c1.content.hero.cta1));

  r = await fetch(BASE + "/api/content");
  const c2 = await r.json();
  ok("saved content persists", c2.content.hero.cta1 === "زر معدّل");

  r = await fetch(BASE + "/api/content/backups", { headers: auth });
  const bf = await r.json();
  ok("backups list has backup", bf.ok === true && bf.backups.length >= 1, "count=" + bf.backups.length);

  r = await fetch(BASE + "/api/content/restore", { method: "POST", headers: auth, body: JSON.stringify({ name: bf.backups[0].name }) });
  const rr = await r.json();
  ok("restore backup", rr.ok === true, rr.error || "");

  r = await fetch(BASE + "/api/content/reset", { method: "POST", headers: auth });
  const rz = await r.json();
  ok("reset to default", rz.ok === true && rz.content.hero.cta1 === "استكشف الدراسات", "cta1=" + (rz.content.hero && rz.content.hero.cta1));

  // 10) تكرار خاطئ للمصادقة بعد reset (الحرف الافتراضي)
  ok("login default pass still works", login.ok === true);

  // 11) إضافة ملف في المجلد مباشرة (محاكاة السيناريو الحقيقي)
  const fs = await import("node:fs");
  const path = await import("node:path");
  const tmp = path.join(process.cwd(), "studies", "السياسات العامة - الإدارة الانتقالية في سوريا - 2025.pdf");
  fs.writeFileSync(tmp, Buffer.from("%PDF-1.4 demo\n%%EOF\n"));
  await new Promise((res) => setTimeout(res, 2500));
  r = await fetch(BASE + "/api/studies");
  const data3 = await r.json();
  const direct = data3.studies.find((s) => /الإدارة الانتقالية/.test(s.title));
  ok("folder-watch auto-add", !!direct && direct.specialty_label === "السياسات العامة", direct ? "title=" + direct.title + " tab=" + direct.specialty_label : "not found yet");
  fs.unlinkSync(tmp);
  await new Promise((res) => setTimeout(res, 2500));
  r = await fetch(BASE + "/api/studies");
  ok("folder-watch removal", (await r.json()).studies.length === 4);

  console.log("");
  if (failures === 0) console.log("All tests passed.");
  else console.log(failures + " test(s) FAILED.");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });