(function () {
  const I18N = window.NURSILA_I18N;
  const EVENT_FILES = Array.from({ length: 22 }, (_, i) =>
    String(i + 1).padStart(2, "0") + ".jpg"
  );
  const PORTRAIT = new Set(["01", "07", "08", "09", "11", "15", "16", "22"]);
  const WIDE = new Set(["02"]);

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function getLang() {
    const saved = localStorage.getItem("nursila-lang");
    if (saved === "kk" || saved === "ru") return saved;
    return "kk";
  }

  function currentDict() {
    return I18N[getLang()] || I18N.kk;
  }

  function applyLang(lang) {
    const dict = I18N[lang] || I18N.kk;
    document.documentElement.lang = lang === "ru" ? "ru" : "kk";
    localStorage.setItem("nursila-lang", lang);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-list]").forEach((ol) => {
      const key = ol.getAttribute("data-i18n-list");
      const items = dict[key];
      if (!Array.isArray(items)) return;
      ol.innerHTML = items.map((t) => "<li>" + t + "</li>").join("");
    });

    document.querySelectorAll("[data-i18n-alt]").forEach((img) => {
      const key = img.getAttribute("data-i18n-alt");
      if (dict[key]) img.alt = dict[key];
    });

    document.querySelectorAll(".gallery-dense img").forEach((img) => {
      img.alt = dict.eventAlt || "";
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const active = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const toggle = document.getElementById("navToggle");
    if (toggle) toggle.setAttribute("aria-label", dict.menu || "Menu");

    const msg = document.getElementById("applyMsg");
    if (msg && !msg.hidden && msg.dataset.kind) {
      msg.textContent = dict[msg.dataset.kind] || msg.textContent;
    }
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.getAttribute("data-lang")));
  });

  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("navToggle");
  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const eventsRoot = document.getElementById("gallery-events");
  if (eventsRoot) {
    const frag = document.createDocumentFragment();
    EVENT_FILES.forEach((file) => {
      const id = file.replace(".jpg", "");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gallery-item";
      if (PORTRAIT.has(id)) btn.classList.add("portrait");
      if (WIDE.has(id)) btn.classList.add("wide");
      btn.dataset.full = "assets/events/" + file;
      const img = document.createElement("img");
      img.src = "assets/events/" + file;
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = "";
      btn.appendChild(img);
      frag.appendChild(btn);
    });
    eventsRoot.appendChild(frag);
  }

  /* ---------- apply form (frontend only) ---------- */
  const applyForm = document.getElementById("applyForm");
  const applyMsg = document.getElementById("applyMsg");
  if (applyForm && applyMsg) {
    applyForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const dict = currentDict();
      const parent = applyForm.parentName.value.trim();
      const phone = applyForm.phone.value.trim();
      const child = applyForm.childName.value.trim();
      if (!parent || !phone || !child) {
        applyMsg.hidden = false;
        applyMsg.dataset.kind = "applyNeedFields";
        applyMsg.classList.add("is-error");
        applyMsg.textContent = dict.applyNeedFields;
        return;
      }
      applyMsg.hidden = false;
      applyMsg.dataset.kind = "applyThanks";
      applyMsg.classList.remove("is-error");
      applyMsg.textContent = dict.applyThanks;
      applyForm.reset();
    });
  }

  /* ---------- lightbox ---------- */
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  let currentItems = [];
  let currentIndex = 0;

  function openLightbox(items, index) {
    currentItems = items;
    currentIndex = index;
    showCurrent();
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    lightboxImg.src = "";
  }

  function showCurrent() {
    const src = currentItems[currentIndex];
    lightboxImg.src = src;
    lightboxImg.alt = "";
  }

  function step(delta) {
    if (!currentItems.length) return;
    currentIndex = (currentIndex + delta + currentItems.length) % currentItems.length;
    showCurrent();
  }

  function bindGallery(root) {
    if (!root) return;
    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".gallery-item");
      if (!btn || !root.contains(btn)) return;
      const items = Array.from(root.querySelectorAll(".gallery-item")).map(
        (el) => el.dataset.full || el.querySelector("img")?.src
      );
      const index = Array.from(root.querySelectorAll(".gallery-item")).indexOf(btn);
      openLightbox(items, index);
    });
  }

  bindGallery(document.getElementById("gallery-interior"));
  bindGallery(document.getElementById("gallery-events"));

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => step(-1));
  lightboxNext?.addEventListener("click", () => step(1));
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  applyLang(getLang());
})();
