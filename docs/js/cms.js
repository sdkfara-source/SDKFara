/* مركز حكيم — محرك عرض المحتوى من نظام الإدارة (CMS)
   - يجلب /api/content ويحقن النصوص والأقسام الديناميكية
   - يحقن ألوان الثيم كمتغيرات CSS
   - يستدعي إعادة تهيئة العداد/الظهور بعد البناء */
(function () {
  "use strict";

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o == null ? o : o[k];
    }, obj);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function mix(base, other, p) {
    var b = hexToRgb(base), o = hexToRgb(other);
    if (!b || !o) return base;
    var r = Math.round(b.r + (o.r - b.r) * p);
    var g = Math.round(b.g + (o.g - b.g) * p);
    var bl = Math.round(b.b + (o.b - b.b) * p);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  function applyTheme(t) {
    if (!t || typeof t !== "object") return;
    var w = "#ffffff", k = "#000000";
    var navy = t.navy || "#151A25";
    var navyDark = t.navy_dark || "#0E1420";
    var gold = t.gold || "#C9A96A";
    var goldSoft = t.gold_soft || "#8F7B4C";
    var ivory = t.ivory || "#F7F3EA";
    var s = document.documentElement.style;
    s.setProperty("--navy-950", mix(navyDark, k, 0.35));
    s.setProperty("--navy-900", navyDark);
    s.setProperty("--navy-800", navy);
    s.setProperty("--navy-700", mix(navy, w, 0.07));
    s.setProperty("--navy-600", mix(navyDark, w, 0.1));
    s.setProperty("--gold-200", mix(gold, w, 0.38));
    s.setProperty("--gold-300", mix(gold, w, 0.2));
    s.setProperty("--gold-400", gold);
    s.setProperty("--gold-500", mix(gold, k, 0.12));
    s.setProperty("--gold-600", goldSoft);
    s.setProperty("--gold-700", mix(goldSoft, k, 0.15));
    s.setProperty("--ivory", ivory);
    s.setProperty("--ivory-2", mix(ivory, w, 0.55));
  }

  function setText(el, val) {
    if (el) el.textContent = val == null ? "" : String(val);
  }
  function setHtml(el, val) {
    if (el) el.innerHTML = val == null ? "" : String(val);
  }

  /* تعبئة العناصر ذات data-cms (نص) و data-cms-html (وسم) */
  function fillScoped(root, content) {
    root.querySelectorAll("[data-cms]").forEach(function (el) {
      var v = getPath(content, el.getAttribute("data-cms"));
      if (v != null) setText(el, v);
    });
    root.querySelectorAll("[data-cms-html]").forEach(function (el) {
      var v = getPath(content, el.getAttribute("data-cms-html"));
      if (v != null) setHtml(el, v);
    });
  }

  /* أقسام القوائم الديناميكية */
  function renderStats(c, el) {
    var items = (c.stats || []).slice(0, 6);
    el.innerHTML = items.map(function (it, i) {
      var dynId = it.dynamic === "studies" ? ' id="statStudies"' : (it.dynamic === "fields" ? ' id="statFields"' : "");
      var val = (it.dynamic === "studies" || it.dynamic === "fields") ? 0 : (it.value == null ? 0 : it.value);
      var suf = it.dynamic || it.suffix ? (it.dynamic ? "+" : "") : "";
      return '<div class="stat" data-reveal' + (i ? ' data-delay="' + i + '"' : "") + ">" +
        '<div class="ico">' + esc(it.icon) + "</div>" +
        '<div class="num"><span class="counter"' + dynId + ' data-count="' + val + '">' + val + "</span>" +
        (suf ? '<span class="k">' + esc(it.suffix || suf) + "</span>" : "") + "</div>" +
        '<div class="lbl">' + esc(it.label) + "</div></div>";
    }).join("");
  }

  function renderAbout(c) {
    var paras = (c.paragraphs || []);
    document.getElementById("aboutParagraphs").innerHTML =
      paras.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    var valsEl = document.getElementById("aboutValues");
    valsEl.innerHTML = (c.values || []).map(function (v, i) {
      return '<div class="value" data-reveal' + (i ? ' data-delay="' + i + '"' : "") + ">" +
        '<span class="vico">' + esc(v.icon) + "</span><div><b>" + esc(v.title) + "</b><span>" + esc(v.text) + "</span></div></div>";
    }).join("");
    var rowsEl = document.getElementById("aboutCardRows");
    rowsEl.innerHTML = (c.card_rows || []).map(function (r) {
      return "<li><b>" + esc(r.k) + "</b><span>" + esc(r.v) + "</span></li>";
    }).join("");
  }

  function renderFields(c) {
    var el = document.getElementById("fieldsGrid");
    el.innerHTML = (c.items || []).map(function (f, i) {
      return '<div class="field" data-reveal' + (i % 3 ? ' data-delay="' + (i % 3) + '"' : "") + ">" +
        '<div class="fico">' + esc(f.icon) + "</div><h3>" + esc(f.title) + "</h3><p>" + esc(f.text) + "</p>" +
        '<a class="more" href="#studies">إلى الدراسات <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg></a></div>';
    }).join("");
  }

  function renderTeam(c) {
    var el = document.getElementById("teamGrid");
    el.innerHTML = (c.members || []).map(function (m, i) {
      return '<div class="member" data-reveal' + (i ? ' data-delay="' + i + '"' : "") + ">" +
        '<div class="avatar">' + esc(m.initial) + "</div><h3>" + esc(m.name) + "</h3>" +
        '<div class="role">' + esc(m.role) + "</div><p>" + esc(m.bio) + "</p></div>";
    }).join("");
  }

  function renderFooter(c, brand) {
    var l = function (arr, base) {
      return (arr || []).map(function (x) { return '<li><a href="' + esc(x.href || base) + '">' + esc(x.label) + "</a></li>"; }).join("");
    };
    document.getElementById("footerCol1").innerHTML = l(c.col1_links, "#home");
    document.getElementById("footerCol2").innerHTML = l(c.col2_links, "#studies");
    document.getElementById("footerContact").innerHTML = (c.contact_items || []).map(function (it) {
      return '<li><span class="ic">' + esc(it.icon) + "</span><span>" + esc(it.text) + "</span></li>";
    }).join("");
  }

  function render(content) {
    if (!content) return;
    applyTheme(content.theme);
    fillScoped(document, content);

    renderStats(content, document.getElementById("statsGrid"));
    renderAbout(content.about || {});
    renderFields(content.fields || {});
    renderTeam(content.team || {});
    renderFooter(content.footer || {}, content.brand || {});

    var brand = content.brand || {};
    if (brand.name_ar) document.title = brand.name_ar + " | دمشق — مركز بحثي مستقل";

    if (window.HakeemUI && HakeemUI.refresh) HakeemUI.refresh();
  }

  /* تطبيق الشعار الحالي على جميع مواضع اللوغو */
  function applyLogo(src) {
    if (!src) return;
    var imgs = document.querySelectorAll(".brand-logo img, .hero-logo img, .ac-logo img, .loader-logo img, #footerLogo img");
    imgs.forEach(function (img) { img.src = src; });
  }

  function boot() {
    if (window.HAKEEM_CMS) {
      var d = window.HAKEEM_CMS;
      applyLogo(d.logo);
      render(d.content);
      return;
    }
    fetch("/api/content", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        applyLogo(d && d.logo);
        render(d && d.content);
      })
      .catch(function (err) { console.warn("تعذر جلب المحتوى:", err); });
  }

  boot();
})();