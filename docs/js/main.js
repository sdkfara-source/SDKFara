/* مركز حكيم — تفاعلات الواجهة العامة */
(function () {
  "use strict";

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* Preloader */
  var loader = $("#loader");
  window.addEventListener("load", function () {
    setTimeout(function () { loader && loader.classList.add("hide"); }, 350);
  });
  setTimeout(function () { loader && loader.classList.add("hide"); }, 3200);

  /* Header on scroll */
  var header = $("#siteHeader");
  var backTop = $("#backTop");
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    header.classList.toggle("scrolled", y > 40);
    backTop.classList.toggle("show", y > 620);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  backTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* Mobile menu */
  var mm = $("#mobileMenu");
  var toggle = $("#navToggle");
  toggle.addEventListener("click", function () {
    mm.classList.toggle("open");
    toggle.setAttribute("aria-expanded", mm.classList.contains("open"));
  });
  $("#mmClose").addEventListener("click", function () { closeMenu(); });
  $$(".mm-links a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  function closeMenu() { mm.classList.remove("open"); }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  /* Active nav highlight */
  var sections = $$("main section[id], section.hero, section#home");
  var navLinks = $$(".nav-links a, .mm-links a");
  var seen = {};
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      seen[id] = true;
      navLinks.forEach(function (a) {
        var href = a.getAttribute("href").slice(1);
        a.classList.toggle("active", href === id && seen[id]);
      });
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach(function (s) { spy.observe(s); });

  /* Reveal on scroll */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); revealIO.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$("[data-reveal]").forEach(function (el) { revealIO.observe(el); });

  /* Animated counters */
  var done = {};
  var counterKey = 0;
  function bindCounter(el) {
    if (el.dataset.counterKey) return;
    el.dataset.counterKey = "ck" + (counterKey++);
    counterIO.observe(el);
  }
  var counterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var el = en.target;
      if (!en.isIntersecting || done[el.dataset.counterKey]) return;
      done[el.dataset.counterKey] = true;
      var target = parseInt(el.dataset.count, 10) || 0;
      var start = performance.now(), dur = 1400;
      (function tick(now) {
        var p = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(tick);
      })(start);
    });
  }, { threshold: 0.4 });
  $$(".counter").forEach(bindCounter);

  /* إعادة تهيئة بعد بناء المحتوى ديناميكياً (تستدعيها cms.js) */
  window.HakeemUI = {
    refresh: function () {
      $$("[data-reveal]:not(.in)").forEach(function (el) { revealIO.observe(el); });
      $$(".counter").forEach(bindCounter);
    }
  };

  /* Contact form */
  $("#contactForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = this.querySelector('button[type="submit"]');
    var old = btn.innerHTML;
    btn.innerHTML = "تم إرسال الرسالة &#10003;";
    btn.classList.remove("btn--gold");
    btn.classList.add("btn--navy");
    this.reset();
    setTimeout(function () {
      btn.innerHTML = old;
      btn.classList.add("btn--gold");
      btn.classList.remove("btn--navy");
    }, 3500);
  });
})();