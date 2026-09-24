/* ============ لوحة إدارة مركز حكيم ============ */
(function () {
  "use strict";

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var state = {
    content: null,
    logo: "/assets/logo.jpg",
    dirty: false
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, isErr) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("error", !!isErr);
    t.hidden = false;
    clearTimeout(toast._h);
    toast._h = setTimeout(function () { t.hidden = true; }, isErr ? 5000 : 2600);
  }
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d && d.error ? d.error : "HTTP " + r.status);
        return d;
      }).catch(function (e) {
        if (e instanceof SyntaxError) throw new Error("HTTP " + r.status);
        throw e;
      });
    });
  }

  /* ============ الدخول ============ */
  function bindLogin() {
    var form = $("#loginForm");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("#loginBtn");
      btn.disabled = true;
      $("#loginErr").textContent = "";
      api("POST", "/api/auth/login", { user: $("#lgUser").value.trim(), pass: $("#lgPass").value })
        .then(function () { enterApp(); })
        .catch(function (err) {
          $("#loginErr").textContent = err.message || "تعذر الدخول.";
          btn.disabled = false;
        });
    });
  }

  function enterApp() {
    $("#loginOverlay").hidden = true;
    $("#app").hidden = false;
    loadAll();
  }

  /* ============ تحميل الحالة العامة ============ */
  function loadAll() {
    Promise.all([
      api("GET", "/api/content"),
      fetch("/api/status", { cache: "no-store" }).then(function (r) { return r.json(); }),
      api("GET", "/api/auth/status").catch(function () { return { loggedIn: false }; })
    ]).then(function (d) {
      state.content = d[0].content;
      state.logo = d[0].logo || state.logo;
      renderOverview(d[1]);
      renderContent();
      applyThemeFields();
      $("#logoPreview").src = state.logo;
      loadLibrary();
      loadBackups();
    }).catch(function (err) {
      toast("تعذر تحميل بيانات الإدارة: " + err.message, true);
    });
  }

  function renderOverview(status) {
    if (status) {
      $("#ovUrl").textContent = window.location.origin;
      $("#ovCount").textContent = status.count;
      $("#ovBackups").textContent = status.backups;
      $("#ovScan").textContent = status.lastScan ? new Date(status.lastScan).toLocaleTimeString("ar-SY", { hour12: false }) : "…";
    }
  }

  /* ============ مخطط النماذج ============ */
  var OPT_DYNAMIC = [
    { v: "", l: "قيمة ثابتة (مكتوبة)" },
    { v: "studies", l: "عدد الدراسات تلقائياً" },
    { v: "fields", l: "عدد المجالات تلقائياً" }
  ];

  var SCHEMA = [
    {
      tab: "content", id: "brand", icon: "◆", title: "هوية المركز", desc: "الاسم والشعار النصي اللذين يظهران في الترويسة والفوتر.",
      fields: [
        { path: "brand.name_ar", label: "الاسم العربي", type: "text" },
        { path: "brand.name_en", label: "الاسم الإنكليزي", type: "text" },
        { path: "brand.sub", label: "السطر التعريفي (تحت الاسم)", type: "text" }
      ]
    },
    {
      tab: "content", id: "hero", icon: "★", title: "الواجهة الرئيسية (Hero)", desc: "الخطاب الأول فوق الطية.",
      fields: [
        { path: "hero.kicker", label: "الشريط العلوي", type: "text" },
        { path: "hero.title", label: "العنوان الرئيسي", type: "html", hint: "يسمح بوسوم تنسيق مثل <em>…</em> لإبراز كلمة بلون ذهبي." },
        { path: "hero.lead", label: "النص الترحيبي", type: "textarea" },
        { path: "hero.note", label: "سطر الإصدارات المميزة", type: "text" },
        { path: "hero.cta1", label: "زر الدعوة الأول", type: "text" },
        { path: "hero.cta2", label: "زر الدعوة الثاني", type: "text" }
      ]
    },
    {
      tab: "content", id: "stats", icon: "◆", title: "مؤشرات المركز", desc: "أشرطة الأرقام أسفل الواجهة. استخدم خياراً تلقائياً للدراسات أو المجالات ليرتبط بالعدد الفعلي.",
      fields: [
        { path: "stats", label: "فهرس المؤشرات", type: "list",
          fields: [
            { path: "icon", label: "الرمز", type: "text" },
            { path: "value", label: "الرقم (للقيم الثابتة)", type: "number" },
            { path: "dynamic", label: "المصدر", type: "select", options: OPT_DYNAMIC },
            { path: "suffix", label: "اللاحقة (مثال +)", type: "text" },
            { path: "label", label: "الوصف", type: "text" }
          ] }
      ]
    },
    {
      tab: "content", id: "about", icon: "◉", title: "عن المركز", desc: "الفقرة التعريفية والبطاقة الجانبية.",
      fields: [
        { path: "about.eyebrow", label: "التسمية العلوية", type: "text" },
        { path: "about.title", label: "العنوان", type: "html" },
        { path: "about.paragraphs", label: "الفقرة التعريفية (فقرات)", type: "list",
          fields: [{ path: "0", label: "فقرة", type: "textarea" }].map(function (f) { return f; }),
          inline: true },
        { path: "about.values", label: "القيم الأساسية", type: "list",
          fields: [
            { path: "icon", label: "الرمز", type: "text" },
            { path: "title", label: "العنوان", type: "text" },
            { path: "text", label: "النص", type: "text" }
          ] },
        { path: "about.card_title", label: "عنوان البطاقة", type: "text" },
        { path: "about.card_rows", label: "صفوف البطاقة", type: "list",
          fields: [
            { path: "k", label: "المفتاح", type: "text" },
            { path: "v", label: "القيمة", type: "text" }
          ] },
        { path: "about.card_cta", label: "زر البطاقة", type: "text" }
      ]
    },
    {
      tab: "content", id: "fields", icon: "◈", title: "مجالات البحث", desc: "شبكة المجالات البحثية الستة.",
      fields: [
        { path: "fields.eyebrow", label: "التسمية العلوية", type: "text" },
        { path: "fields.title", label: "العنوان", type: "text" },
        { path: "fields.lead", label: "النص التمهيدي", type: "textarea" },
        { path: "fields.items", label: "المجالات", type: "list",
          fields: [
            { path: "icon", label: "الرمز", type: "text" },
            { path: "title", label: "العنوان", type: "text" },
            { path: "text", label: "الوصف", type: "textarea" }
          ] }
      ]
    },
    {
      tab: "content", id: "studies", icon: "◆", title: "مقدمة مكتبة الدراسات", desc: "نصوص القسم؛ المعلومات الفعلية للدراسات تأتي من مجلد studies/ تلقائياً.",
      fields: [
        { path: "studies.eyebrow", label: "التسمية العلوية", type: "text" },
        { path: "studies.title", label: "العنوان", type: "text" },
        { path: "studies.lead", label: "النص التمهيدي", type: "textarea" },
        { path: "studies.foot", label: "ملاحظة قاعدة التسمية", type: "html" }
      ]
    },
    {
      tab: "content", id: "team", icon: "◆", title: "الفريق العلمي", desc: "بطاقات الأعضاء.",
      fields: [
        { path: "team.eyebrow", label: "التسمية العلوية", type: "text" },
        { path: "team.title", label: "العنوان", type: "text" },
        { path: "team.lead", label: "النص التمهيدي", type: "textarea" },
        { path: "team.members", label: "الأعضاء", type: "list",
          fields: [
            { path: "initial", label: "الحرف الأول (للدائرة)", type: "text" },
            { path: "name", label: "الاسم", type: "text" },
            { path: "role", label: "المنصب", type: "text" },
            { path: "bio", label: "السيرة المختصرة", type: "text" }
          ] }
      ]
    },
    {
      tab: "content", id: "cta", icon: "★", title: "شريط الدعوة (CTA)", desc: "الشريط الذهبي بين الفريق والتواصل.",
      fields: [
        { path: "cta.title", label: "العنوان", type: "text" },
        { path: "cta.text", label: "النص", type: "textarea" },
        { path: "cta.btn1", label: "الزر الأول", type: "text" },
        { path: "cta.btn2", label: "الزر الثاني", type: "text" }
      ]
    },
    {
      tab: "content", id: "contact", icon: "✉", title: "التواصل", desc: "بيانات وقنوات التواصل.",
      fields: [
        { path: "contact.eyebrow", label: "التسمية العلوية", type: "text" },
        { path: "contact.title", label: "العنوان", type: "text" },
        { path: "contact.lead", label: "النص التمهيدي", type: "textarea" },
        { path: "contact.form_title", label: "عنوان النموذج", type: "text" },
        { path: "contact.items", label: "قنوات التواصل", type: "list",
          fields: [
            { path: "icon", label: "الرمز", type: "text" },
            { path: "label", label: "العنوان", type: "text" },
            { path: "text", label: "التفاصيل", type: "text" }
          ] }
      ]
    },
    {
      tab: "content", id: "footer", icon: "⌄", title: "الفوتر", desc: "الأعمدة والنصوص السفلية.",
      fields: [
        { path: "footer.about", label: "نبذة الفوتر", type: "textarea" },
        { path: "footer.col1_title", label: "عنوان العمود الأول", type: "text" },
        { path: "footer.col1_links", label: "روابط العمود الأول", type: "list",
          fields: [
            { path: "label", label: "النص", type: "text" },
            { path: "href", label: "الرابط", type: "text" }
          ] },
        { path: "footer.col2_title", label: "عنوان العمود الثاني", type: "text" },
        { path: "footer.col2_links", label: "روابط العمود الثاني", type: "list",
          fields: [
            { path: "label", label: "النص", type: "text" },
            { path: "href", label: "الرابط", type: "text" }
          ] },
        { path: "footer.contact_items", label: "معلومات التواصل", type: "list",
          fields: [
            { path: "icon", label: "الرمز", type: "text" },
            { path: "text", label: "النص", type: "text" }
          ] },
        { path: "footer.bottom_left", label: "السطر السفلي (يسار)", type: "text" },
        { path: "footer.bottom_middle", label: "السطر السفلي (وسط)", type: "text" },
        { path: "footer.admin_label", label: "تسمية رابط الإدارة", type: "text" }
      ]
    }
  ];

  var THEME = {
    tab: "appearance", icon: "◈", title: "ألوان الهوية", desc: "الألوان الأساسية — يُكيّف الموقع بقية الدرجات تلقائياً.",
    fields: [
      { path: "theme.navy", label: "الكحلي الأساسي", type: "color" },
      { path: "theme.navy_dark", label: "الكحلي الداكن (الخلفية)", type: "color" },
      { path: "theme.gold", label: "الذهبي الأساسي", type: "color" },
      { path: "theme.gold_soft", label: "الذهبي الباهت", type: "color" },
      { path: "theme.ivory", label: "الأبيض العاجي", type: "color" }
    ]
  };

  function getPath(obj, p) { return p.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }

  /* ============ بناء النماذج ============ */
  function fieldControl(f, value, rel) {
    var key = rel ? "data-cms-k=\"" + esc(f.path) + "\"" : "data-cms-k=\"" + esc(f.path) + "\"";
    switch (f.type) {
      case "textarea":
        return "<textarea " + key + " rows=\"4\">" + esc(value) + "</textarea>";
      case "html":
        return "<textarea " + key + " rows=\"2\">" + esc(value) + "</textarea>" +
          (f.hint ? "<div class=\"field-tip\">" + esc(f.hint) + "</div>" : "");
      case "number":
        return '<input type="number" ' + key + ' value="' + esc(value == null ? 0 : value) + '">';
      case "select": {
        var opts = (f.options || []).map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (String(value) === String(o.v) ? " selected" : "") + ">" + esc(o.l) + "</option>";
        }).join("");
        return "<select " + key + ">" + opts + "</select>";
      }
      case "color":
        return '<input type="color" ' + key + ' value="' + esc(value || "#151A25") + '">';
      default:
        return '<input type="text" ' + key + ' value="' + esc(value) + '">';
    }
  }

  function renderList(f, list) {
    var arr = Array.isArray(list) ? list : [];
    var rel = f.inline ? "" : ""; // نسبي داخل العنصر دائماً
    var itemHtml = function (item, i) {
      var fieldsHtml = f.fields.map(function (g) {
        var v = g.path === "0" ? item : getPath(item, g.path);
        return '<div class="field"><label>' + esc(g.label) + "</label>" + fieldControl(g, v) + "</div>";
      }).join("");
      return '<div class="cms-list-item" data-cms-li>' +
        '<div class="li-top"><em>' + esc(f.label) + " &laquo;" + (i + 1) + "&raquo;</em>" +
        '<button type="button" class="li-remove" data-action="li-remove">حذف</button></div>' +
        fieldsHtml + "</div>";
    };
    var rows = arr.map(itemHtml).join("");
    return '<div class="cms-list" data-cms-l="' + esc(f.path) + '">' + rows +
      '<button type="button" class="li-add" data-action="li-add" data-path="' + esc(f.path) + '">+ إضافة عنصر</button></div>';
  }

  function renderGroup(group) {
    var fieldsHtml = group.fields.map(function (f) {
      var val = getPath(state.content, f.path);
      if (f.type === "list") return "<div>" + renderList(f, val) + "</div>";
      return '<div class="field"><label>' + esc(f.label) + "</label>" + fieldControl(f, val) + "</div>";
    }).join("");
    return '<div class="grp" data-grp="' + esc(group.id) + '">' +
      '<div class="grp-head"><span>' + esc(group.icon) + "</span><h3>" + esc(group.title) + "</h3>" +
      (group.desc ? "<p>" + esc(group.desc) + "</p>" : "") + "</div>" +
      '<div class="grp-body">' + fieldsHtml + "</div></div>";
  }

  function renderContent() {
    var host = $("#contentGroups");
    host.innerHTML = SCHEMA.filter(function (g) { return g.tab === "content"; }).map(renderGroup).join("");
  }

  function applyThemeFields() {
    var host = $("#appearanceGroups");
    var body = THEME.fields.map(function (f) {
      var val = getPath(state.content, f.path) || "";
      return '<div class="color-cell"><label>' + esc(f.label) + "</label>" +
        fieldControl(f, val) + '<input type="text" class="hex" data-cms-k="' + esc(f.path) + '.hex" value="' + esc(val) + '"></div>';
    }).join("");
    host.innerHTML = '<div class="grp" data-grp="theme">' +
      '<div class="grp-head"><span>' + esc(THEME.icon) + "</span><h3>" + esc(THEME.title) + "</h3>" +
      "<p>" + esc(THEME.desc) + "</p></div>" +
      '<div class="grp-body"><div class="color-grid">' + body + "</div></div></div>";
    // مزامنة الحقل النصي مع منتقي اللون
    $$("#appearanceGroups input[type=color]").forEach(function (c) {
      c.addEventListener("input", function () {
        var hexCell = c.parentNode.querySelector(".hex");
        if (hexCell) hexCell.value = c.value;
        markDirty();
      });
    });
  }

  /* ============ الجمع والحفظ ============ */
  function setDeep(obj, path, val) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  function collectFields(fields, out, rootEl) {
    fields.forEach(function (f) {
      if (f.type === "list") {
        var box = rootEl.querySelector('[data-cms-l="' + f.path + '"]');
        var arr = [];
        if (box) {
          $$("[data-cms-li]", box).forEach(function (item) {
            var o = {};
            $$("[data-cms-k]", item).forEach(function (inp) {
              o[inp.getAttribute("data-cms-k")] = inp.type === "number" ? (inp.value === "" ? 0 : Number(inp.value)) : inp.value;
            });
            arr.push(o);
          });
        }
        setDeep(out, f.path, arr);
      } else {
        var el = rootEl.querySelector('[data-cms-k="' + f.path + '"]');
        if (!el) return;
        var v = el.type === "number" ? (el.value === "" ? 0 : Number(el.value)) : el.value;
        setDeep(out, f.path, v);
      }
    });
  }

  function buildContent() {
    var out = {};
    SCHEMA.filter(function (g) { return g.tab === "content"; }).forEach(function (g) {
      collectFields(g.fields, out, $("#contentGroups"));
    });
    // الألوان
    collectFields(THEME.fields, out, $("#appearanceGroups"));
    // مزامنة hex مع color إن اختلفا
    $$("#appearanceGroups input[type=color]").forEach(function (c) {
      if (c.parentNode) {
        var hex = c.parentNode.querySelector(".hex");
        if (hex && hex.value) c.value = hex.value;
      }
    });
    out.theme = {};
    collectFields(THEME.fields, out.theme, $("#appearanceGroups"));
    return out;
  }

  function save() {
    var btn = $("#saveBtn");
    btn.disabled = true;
    var body = buildContent();
    api("PUT", "/api/content", body)
      .then(function (d) {
        state.content = d.content;
        state.dirty = false;
        updateSaveState();
        toast("تم حفظ المحتوى — أُنشئت نسخة احتياطية.");
        loadBackups();
        btn.disabled = false;
      })
      .catch(function (err) {
        toast("فشل الحفظ: " + err.message, true);
        btn.disabled = false;
      });
  }

  function markDirty() { state.dirty = true; updateSaveState(); }
  function updateSaveState() {
    var label = $("#saveState");
    var btn = $("#saveBtn");
    label.textContent = state.dirty ? "• توجد تغييرات غير محفوظة" : "كل التغييرات محفوظة";
    label.classList.toggle("dirty", state.dirty);
    btn.disabled = !state.dirty;
  }

  /* ============ المكتبة ============ */
  function loadLibrary() {
    return fetch("/api/studies", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        $("#libMeta").textContent = "الموجود: " + d.studies.length + " دراسة · آخر فحص: " + (d.lastScan ? new Date(d.lastScan).toLocaleString("ar-SY", { hour12: false }) : "…");
        var tbody = $("#libTable tbody");
        tbody.innerHTML = d.studies.map(function (s) {
          return "<tr><td><b>" + esc(s.title) + "</b><br><code>" + esc(s.file) + "</code></td>" +
            "<td>" + esc(s.specialty_label) + "</td>" +
            "<td>" + (s.size ? Math.round(s.size) + " ك.ب" : "—") + "</td>" +
            "<td><button class=\"lib-del\" data-del=\"" + esc(s.file) + "\">حذف</button></td></tr>";
        }).join("");
        // تحديث عدّاد الإحصائيات في النظرة العامة؟
      })
      .catch(function () {});
  }

  function uploadPdf(file, name) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast("يجب اختيار ملف PDF.", true); return;
    }
    if (!name) {
      toast("أدخل اسم الملف بالصيغة الصحيحة.", true); return;
    }
    $("#upStatus").textContent = "جارٍ الرفع… " + file.name;
    fetch("/api/upload?name=" + encodeURIComponent(name), {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.size)
      },
      body: file
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "HTTP " + r.status); return d; }); })
      .then(function () {
        $("#upStatus").textContent = "تم رفع " + name + " — ستظهر في المكتبة خلال لحظات.";
        $("#upName").value = ""; $("#upFile").value = "";
        setTimeout(function () { $("#upStatus").textContent = ""; }, 4000);
        loadLibrary();
        refreshOverviewCounts();
      })
      .catch(function (e) { $("#upStatus").textContent = "خطأ: " + e.message; });
  }

  function refreshOverviewCounts() {
    fetch("/api/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      if (s) { $("#ovCount").textContent = s.count; $("#ovBackups").textContent = s.backups; }
    }).catch(function () {});
  }

  /* ============ النسخ الاحتياطية ============ */
  function loadBackups() {
    return api("GET", "/api/content/backups").then(function (d) {
      var tbody = $("#backupsBody");
      tbody.innerHTML = (d.backups || []).map(function (b) {
        var dt = b.name.replace("cms-", "").replace(".json", "");
        var f = dt.slice(6, 8) + "/" + dt.slice(4, 6) + "/" + dt.slice(0, 4) + " " + dt.slice(8, 10) + ":" + dt.slice(10, 12);
        return "<tr><td><code>" + esc(b.name) + "</code></td><td>" + esc(f) + "</td><td>" + Math.round(b.size / 1024) + " ك.ب</td>" +
          "<td><button class=\"lib-del\" data-restore=\"" + esc(b.name) + "\">استعادة</button></td></tr>";
      }).join("");
      if (d.backups.length) $("#ovBackups").textContent = d.backups.length;
    }).catch(function () {});
  }

  function restoreBackup(name) {
    if (!confirm("استعادة " + name + "؟ سيُنشأ نسخة احتياطية من الحالة الحالية قبل الاستعادة.")) return;
    api("POST", "/api/content/restore", { name: name }).then(function (d) {
      state.content = d.content;
      toast("استُعيدت النسخة — أُعيد بناء النماذج.");
      renderContent();
      applyThemeFields();
      loadBackups();
    }).catch(function (e) { toast("فشلت الاستعادة: " + e.message, true); });
  }

  /* ============ الأحداث ============ */
  function bindTabs() {
    $$(".snav").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".snav").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var tab = btn.dataset.tab;
        $$(".panel").forEach(function (p) { p.classList.toggle("active", p.dataset.panel === tab); });
        $("#panelTitle").textContent = btn.textContent.replace(/^\S+\s+/g, "").trim() || "إدارة";
      });
    });
  }

  function bindDirty() {
    document.addEventListener("input", function (e) {
      if (e.target.closest("[data-cms-k]") ||
          e.target.closest("[data-cms-li]") ||
          ($("#appearanceGroups").contains(e.target) && e.target.matches("input[type=text]"))) {
        markDirty();
      }
    });
    document.addEventListener("change", function (e) {
      if (e.target.closest("[data-cms-k]")) markDirty();
    });
  }

  function bindContentActions() {
    document.addEventListener("click", function (e) {
      var add = e.target.closest("[data-action=li-add]");
      if (add) {
        e.preventDefault();
        var box = add.parentNode;
        var proto = box.querySelector(".cms-list-item");
        var fPath = add.dataset.path;
        var group = SCHEMA.concat([THEME]).filter(function (g) {
          return g.tab === "content" || g.tab === "appearance";
        });
        var f = null;
        group.forEach(function (g) { g.fields.forEach(function (x) { if (x.path === fPath) f = x; }); });
        if (!f || !box) return;
        var i = box.querySelectorAll("[data-cms-li]").length;
        var div = document.createElement("div");
        div.innerHTML = renderList(f, [0]) ? "" : "";
        // بناء عنصر فارغ عبر دالة مع كائن فارغ
        var tmp = document.createElement("div");
        tmp.innerHTML = '<div class="cms-list-item" data-cms-li>' +
          '<div class="li-top"><em>' + esc(f.label) + " &laquo;" + (i + 1) + "&raquo;</em>" +
          '<button type="button" class="li-remove" data-action="li-remove">حذف</button></div>' +
          f.fields.map(function (g) {
            var blank = g.path === "0" ? "" : "";
            var v = null;
            if (g.type === "number") v = 0;
            else if (g.type === "select") v = (g.options && g.options.length) ? g.options[0].v : "";
            return '<div class="field"><label>' + esc(g.label) + "</label>" + fieldControl(g, v) + "</div>";
          }).join("") + "</div>";
        box.insertBefore(tmp.firstChild, add);
        markDirty();
        return;
      }
      var rm = e.target.closest("[data-action=li-remove]");
      if (rm) {
        e.preventDefault();
        var item = rm.closest("[data-cms-li]");
        if (item) { item.remove(); markDirty(); }
        return;
      }
      var del = e.target.closest("[data-del]");
      if (del) {
        if (!confirm("حذف الملف: " + del.getAttribute("data-del") + "؟")) return;
        fetch("/api/upload?name=" + encodeURIComponent(del.getAttribute("data-del")), { method: "DELETE" })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "HTTP " + r.status); return d; }); })
          .then(function () { toast("حُذف الملف."); loadLibrary(); refreshOverviewCounts(); })
          .catch(function (er) { toast("فشل الحذف: " + er.message, true); });
        return;
      }
      var restore = e.target.closest("[data-restore]");
      if (restore) restoreBackup(restore.getAttribute("data-restore"));
    });
  }

  function bindSave() {
    $("#saveBtn").addEventListener("click", save);
    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("إعادة ضبط كل المحتوى إلى الافتراضي؟ سيُنشأ نسخة احتياطية من الحالة الحالية.")) return;
      api("POST", "/api/content/reset").then(function (d) {
        state.content = d.content; state.dirty = false;
        toast("أُعيد ضبط المحتوى.");
        renderContent(); applyThemeFields(); updateSaveState(); loadBackups();
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  function bindSettings() {
    $("#pwBtn").addEventListener("click", function () {
      var old = $("#pwOld").value, n1 = $("#pwNew").value, n2 = $("#pwNew2").value;
      if (n1.length < 8) { $("#pwHint").textContent = "كلمة المرور يجب ألا تقل عن 8 أحرف."; return; }
      if (n1 !== n2) { $("#pwHint").textContent = "كلمتا المرور غير متطابقتين."; return; }
      api("POST", "/api/admin/password", { old: old, new: n1 })
        .then(function () {
          $("#pwHint").textContent = "تم تغيير كلمة المرور — سجّل الدخول من جديد.";
          setTimeout(function () { location.reload(); }, 1200);
        })
        .catch(function (e) { $("#pwHint").textContent = e.message; });
    });
  }

  function bindLogo() {
    $("#logoFile").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f);
      $("#logoPreview").src = url;
      fetch("/api/logo", { method: "PUT", headers: { "Content-Type": f.type || "image/png" }, body: f })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "HTTP " + r.status); return d; }); })
        .then(function (d) { toast("تم استبدال الشعار بنجاح."); $("#logoPreview").src = d.logo; state.logo = d.logo; })
        .catch(function (e) { toast("فشل الرفع: " + e.message, true); $("#logoPreview").src = state.logo; });
    });
    $("#logoResetBtn").addEventListener("click", function () {
      if (!confirm("استعادة الشعار الأصلي؟ (سيعود الشعار المُعتمد سابقاً)")) return;
      api("POST", "/api/logo/reset").then(function (d) {
        toast("استُعيد الشعار الأصلي.");
        $("#logoPreview").src = d.logo; state.logo = d.logo;
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  /* ============ التشغيل ============ */
  api("GET", "/api/auth/status")
    .then(function (d) {
      if (d.loggedIn) enterApp();
      else { $("#loginOverlay").hidden = false; }
    })
    .catch(function () { $("#loginOverlay").hidden = false; });

  bindLogin();
  bindTabs();
  bindDirty();
  bindContentActions();
  bindSave();
  bindSettings();
  bindLogo();

  $("#logoutBtn").addEventListener("click", function () {
    api("POST", "/api/auth/logout", {}).then(function () { location.reload(); }).catch(function () { location.reload(); });
  });

  // ربط رفع PDF (bindLibrary يحتاج ملف)
  $("#uploadBox").addEventListener("click", function () { $("#upFile").click(); });
  $("#upFile").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    uploadPdf(f, $("#upName").value || f.name);
  });
  var dropBox = $("#uploadBox");
  ["dragover", "dragenter"].forEach(function (ev) { dropBox.addEventListener(ev, function (e) { e.preventDefault(); dropBox.classList.add("drag"); }); });
  ["dragleave", "drop"].forEach(function (ev) { dropBox.addEventListener(ev, function (e) { e.preventDefault(); dropBox.classList.remove("drag"); }); });
  dropBox.addEventListener("drop", function (e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    var f = files[0];
    uploadPdf(f, $("#upName").value || f.name);
  });

  // إعادة فحص دورية للمكتبة أثناء فتح التبويب
  setInterval(function () {
    var libPanel = $('[data-panel="library"]');
    if (libPanel && libPanel.classList.contains("active")) loadLibrary();
  }, 20000);
})();