/* مركز حكيم — مكتبة الدراسات: تبويبات تلقائية حسب الاختصاص */
(function () {
  "use strict";

  var ENDPOINT = "/api/studies";
  var POLL_MS = 45000;

  var $ = function (s, el) { return (el || document).querySelector(s); };

  var grid = $("#studiesGrid");
  var tabsBox = $("#studiesTabs");
  var empty = $("#studiesEmpty");
  var search = $("#studySearch");
  var lastScanEl = $("#lastScan");
  var statStudies = $("#statStudies");
  var statFields = $("#statFields");

  var DATA = { studies: [], updatedAt: null, lastScan: null };
  var activeTab = "all";
  var query = "";

  var SPEC_ICONS = {
    "الاقتصاد والتنمية": "◆",
    "الاقتصاد": "◆",
    "الاقتصاد والمالية": "◆",
    "الموارد المائية والزراعة": "◈",
    "الموارد المائية": "◈",
    "السياسات العامة": "⬢",
    "القانون والسياسات التشريعية": "⚖",
    "الدراسات الاجتماعية": "☺",
    "التاريخ والذاكرة الوطنية": "◆",
    "الطاقة والبنية التحتية": "⚡",
    "الصحة والتنمية": "✚"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtKb(kb) {
    if (!kb && kb !== 0) return "";
    return kb >= 1024 ? (kb / 1024).toFixed(2) + " م.ب" : Math.round(kb) + " ك.ب";
  }

  function fmtDate(iso) {
    if (!iso) return "…";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    var months = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
      "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
    return days[d.getDay()] + "، " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear() +
      " — " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function specIcon(spec) { return SPEC_ICONS[spec] || "◆"; }

  function load() {
    if (window.HAKEEM_STUDIES) {
      DATA = window.HAKEEM_STUDIES;
      lastScanEl = $("#lastScan");
      render();
      return Promise.resolve();
    }
    return fetch(ENDPOINT, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) { DATA = data; render(); })
      .catch(function (err) {
        console.warn("تعذر تحديث المكتبة:", err);
        if (!grid.dataset.ready) {
          grid.innerHTML = '<div class="studies-empty" style="grid-column:1/-1"><span class="big">&#9638;</span><p>تعذّر الاتصال بخادم الموقع. شغّله بالأمر: <code style="direction:ltr">node server.js</code></p></div>';
          grid.dataset.ready = "1";
        }
      });
  }

  function currentStudies() {
    var list = DATA.studies || [];
    if (activeTab !== "all") {
      list = list.filter(function (s) { return s.specialty_label === activeTab; });
    }
    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (s) {
        return (s.title + " " + s.specialty_label + " " + s.specialty + " " + s.year).toLowerCase().indexOf(q) !== -1;
      });
    }
    return list;
  }

  function specialties() {
    var map = {};
    (DATA.studies || []).forEach(function (s) {
      var key = s.specialty_label || s.specialty || "أخرى";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.keys(map).sort(function (a, b) {
      return (SPEC_ICONS[a] ? "" : a).localeCompare(SPEC_ICONS[b] ? "" : b, "ar");
    });
  }

  function renderTabs() {
    var specs = specialties();
    var html = '<button class="tab' + (activeTab === "all" ? " active" : "") + '" data-tab="all" role="tab">الكل <span class="cnt">' +
      (DATA.studies.length) + "</span></button>";
    specs.forEach(function (sp, i) {
      html += '<button class="tab' + (activeTab === sp ? " active" : "") + '" data-tab="' + esc(sp) +
        '" role="tab">' + esc(specIcon(sp)) + " " + esc(sp) + ' <span class="cnt">' +
        (DATA.studies || []).filter(function (s) { return s.specialty_label === sp || (s.specialty_label == null && s.specialty === sp); }).length +
        "</span></button>";
    });
    tabsBox.innerHTML = html;
    tabsBox.querySelectorAll(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTab = btn.dataset.tab;
        render();
      });
    });
  }

  function renderCards() {
    var items = currentStudies();
    empty.hidden = items.length > 0;
    if (DATA.studies.length === 0) {
      $("#studiesEmpty .big").innerHTML = "&#9632;";
      $("#studiesEmpty h3").textContent = "المكتبة فارغة حالياً";
      $("#studiesEmpty p").textContent =
        "أضِف ملفات PDF بصيغة: اختصاص - العنوان - السنة.pdf، وستظهر هنا تلقائياً.";
    } else {
      $("#studiesEmpty .big").innerHTML = "&#9638;";
      $("#studiesEmpty h3").textContent = "لا توجد نتائج مطابقة";
      $("#studiesEmpty p").textContent = "جرّب كلمة بحث مختلفة أو اختر تبويباً آخر.";
    }

    if (!items.length) {
      grid.innerHTML = "";
      grid.dataset.ready = "1";
      return;
    }

    grid.innerHTML = items.map(function (s) {
      // إن كانت الدراسة مستضافة على Google Drive نستخدم روابط Drive، وإلا الملف المحلي
      var view = s.driveId
        ? "https://drive.google.com/file/d/" + s.driveId + "/preview"
        : "studies/" + encodeURIComponent(s.file);
      var dl = s.driveId
        ? "https://drive.google.com/uc?export=download&id=" + s.driveId
        : view + "?d=1";
      return (
        '<article class="study-card" data-reveal>' +
        '<div class="sc-top">' +
        '<span class="chip">' + esc(specIcon(s.specialty_label || s.specialty)) + " " + esc(s.specialty_label || s.specialty) + "</span>" +
        '<span class="year">' + esc(s.year) + "</span>" +
        "</div>" +
        '<h3>' + esc(s.title) + "</h3>" +
        '<div class="sc-file"><span class="pdf">PDF</span> <span>' + esc(s.file) + "</span> <span>&nbsp;&middot;&nbsp; " + fmtKb(s.size) + "</span></div>" +
        '<div class="sc-actions">' +
        '<a class="btn btn--view" href="' + view + '" target="_blank" rel="noopener">معاينة &#8599;</a>' +
        '<a class="btn btn--gold" href="' + dl + '" download>تحميل PDF <span class="arr">&#8595;</span></a>' +
        "</div>" +
        "</article>"
      );
    }).join("");

    grid.dataset.ready = "1";
    grid.querySelectorAll("[data-reveal]").forEach(function (el) {
      requestAnimationFrame(function () { el.classList.add("in"); });
    });
  }

  function renderMisc() {
    statStudies = $("#statStudies");
    statFields = $("#statFields");
    if (lastScanEl) lastScanEl.textContent = fmtDate(DATA.lastScan);
    if (statStudies) {
      statStudies.textContent = String((DATA.studies || []).length);
      statStudies.dataset.count = String((DATA.studies || []).length);
    }
    if (statFields) {
      var n = String(specialties().length);
      statFields.textContent = n;
      statFields.dataset.count = n;
    }
  }

  function render() {
    renderTabs();
    renderCards();
    renderMisc();
  }

  search.addEventListener("input", function () {
    query = search.value.trim();
    renderCards();
  });

  load();
  if (!window.HAKEEM_STUDIES) setInterval(load, POLL_MS);
})();