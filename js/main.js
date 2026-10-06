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

    const lbClose = document.getElementById("lightboxClose");
    const lbPrev = document.getElementById("lightboxPrev");
    const lbNext = document.getElementById("lightboxNext");
    if (lbClose && dict.lbClose) lbClose.setAttribute("aria-label", dict.lbClose);
    if (lbPrev && dict.lbPrev) lbPrev.setAttribute("aria-label", dict.lbPrev);
    if (lbNext && dict.lbNext) lbNext.setAttribute("aria-label", dict.lbNext);
    syncLightboxAlts();
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
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const lightboxCount = document.getElementById("lightboxCount");
  const viewport = document.getElementById("lightboxViewport");
  const track = document.getElementById("lightboxTrack");
  const slideImgs = track ? Array.from(track.querySelectorAll("img")) : [];
  let currentButtons = [];
  let currentIndex = 0;
  let opener = null;
  let animating = false;
  let suppressClick = false;
  let warmImages = [];

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function itemAt(index) {
    const n = currentButtons.length;
    if (!n) return null;
    const el = currentButtons[(index % n + n) % n];
    const img = el.querySelector("img");
    return {
      src: el.dataset.full || (img && (img.currentSrc || img.src)) || "",
      alt: (img && img.alt) || ""
    };
  }

  function preloadAround() {
    warmImages = [];
    if (currentButtons.length < 2) return;
    [-1, 1].forEach((offset) => {
      const item = itemAt(currentIndex + offset);
      if (!item || !item.src) return;
      const img = new Image();
      img.decoding = "async";
      img.src = item.src;
      warmImages.push(img);
    });
  }

  function setSlide(img, item) {
    if (!img) return;
    if (!item || !item.src) {
      img.removeAttribute("src");
      img.alt = "";
      img.style.visibility = "hidden";
      return;
    }
    img.style.visibility = "";
    if (img.getAttribute("src") !== item.src) img.src = item.src;
    img.alt = item.alt || "";
  }

  function trackX(px) {
    return "translate3d(" + px + "px,0,0)";
  }

  function placeTrack(px, animate) {
    if (!track) return;
    track.style.transition = animate && !reduceMotion()
      ? "transform .38s cubic-bezier(.22,.61,.36,1)"
      : "none";
    track.style.transform = trackX(px);
  }

  function viewWidth() {
    return (viewport && viewport.clientWidth) || 0;
  }

  function renderSlides() {
    const n = currentButtons.length;
    if (!n) return;
    if (n === 1) {
      setSlide(slideImgs[0], null);
      setSlide(slideImgs[1], itemAt(currentIndex));
      setSlide(slideImgs[2], null);
    } else {
      setSlide(slideImgs[0], itemAt(currentIndex - 1));
      setSlide(slideImgs[1], itemAt(currentIndex));
      setSlide(slideImgs[2], itemAt(currentIndex + 1));
    }
    placeTrack(-viewWidth(), false);
    if (track) void track.offsetWidth;
    if (lightboxCount) lightboxCount.textContent = (currentIndex + 1) + "/" + n;
    if (lightboxPrev) lightboxPrev.hidden = n < 2;
    if (lightboxNext) lightboxNext.hidden = n < 2;
    preloadAround();
  }

  function syncLightboxAlts() {
    if (!lightbox || lightbox.hidden || !currentButtons.length) return;
    const n = currentButtons.length;
    if (n === 1) setSlide(slideImgs[1], itemAt(currentIndex));
    else {
      setSlide(slideImgs[0], itemAt(currentIndex - 1));
      setSlide(slideImgs[1], itemAt(currentIndex));
      setSlide(slideImgs[2], itemAt(currentIndex + 1));
    }
  }

  function openLightbox(buttons, index) {
    if (!lightbox || !buttons.length) return;
    currentButtons = buttons;
    currentIndex = (index + buttons.length) % buttons.length;
    opener = document.activeElement;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    renderSlides();
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.style.overflow = "";
    animating = false;
    warmImages = [];
    slideImgs.forEach((img) => {
      img.removeAttribute("src");
      img.alt = "";
    });
    if (opener && typeof opener.focus === "function") opener.focus();
    opener = null;
  }

  function slideTo(delta) {
    const n = currentButtons.length;
    if (!n || !delta) return;
    if (n < 2) return;
    if (animating) return;
    if (reduceMotion()) {
      currentIndex = (currentIndex + delta + n) % n;
      renderSlides();
      return;
    }
    const width = viewWidth();
    if (!width) {
      currentIndex = (currentIndex + delta + n) % n;
      renderSlides();
      return;
    }
    animating = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      track.removeEventListener("transitionend", onEnd);
      currentIndex = (currentIndex + delta + n) % n;
      animating = false;
      renderSlides();
    };
    const onEnd = (ev) => {
      if (ev.propertyName && ev.propertyName !== "transform") return;
      finish();
    };
    track.addEventListener("transitionend", onEnd);
    placeTrack(-width + (delta > 0 ? -width : width), true);
    setTimeout(finish, 460);
  }

  function bindGallerySwipe(gallery) {
    let startX = 0;
    let tracking = false;
    gallery.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
      tracking = true;
      gallery._moved = false;
    }, { passive: true });
    gallery.addEventListener("pointermove", (e) => {
      if (!tracking) return;
      if (Math.abs(e.clientX - startX) > 12) gallery._moved = true;
    }, { passive: true });
    gallery.addEventListener("scroll", () => {
      if (tracking) gallery._moved = true;
    }, { passive: true });
    const stop = () => {
      tracking = false;
      setTimeout(() => { gallery._moved = false; }, 0);
    };
    gallery.addEventListener("pointerup", stop);
    gallery.addEventListener("pointercancel", stop);
  }

  document.querySelectorAll(".gallery").forEach(bindGallerySwipe);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-item");
    if (!btn) return;
    const root = btn.closest(".gallery");
    if (!root) return;
    if (root._moved) {
      root._moved = false;
      return;
    }
    const buttons = Array.from(root.querySelectorAll(".gallery-item"));
    const index = buttons.indexOf(btn);
    if (index < 0) return;
    openLightbox(buttons, index);
  });

  if (lightbox && viewport && track) {
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let axis = null;

    lightboxClose?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLightbox();
    });
    lightboxPrev?.addEventListener("click", (e) => {
      e.stopPropagation();
      slideTo(-1);
    });
    lightboxNext?.addEventListener("click", (e) => {
      e.stopPropagation();
      slideTo(1);
    });
    lightbox.addEventListener("click", (e) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (e.target.closest(".lightbox-close, .lightbox-nav, .lightbox-slide img")) return;
      closeLightbox();
    });

    viewport.addEventListener("pointerdown", (e) => {
      if (animating) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest(".lightbox-close, .lightbox-nav")) return;
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      axis = null;
      try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
      placeTrack(-viewWidth(), false);
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;
      if (!axis) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        axis = Math.abs(mx) >= Math.abs(my) ? "x" : "y";
      }
      if (axis !== "x") return;
      dx = currentButtons.length < 2 ? mx * 0.2 : mx;
      placeTrack(-viewWidth() + dx, false);
    });

    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== pointerId)) return;
      dragging = false;
      const moved = Math.abs(dx);
      const width = viewWidth() || 1;
      const threshold = Math.min(72, width * 0.18);
      if (moved > 10) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);
      }
      if (axis === "x" && currentButtons.length > 1 && dx <= -threshold) slideTo(1);
      else if (axis === "x" && currentButtons.length > 1 && dx >= threshold) slideTo(-1);
      else placeTrack(-width, true);
      dx = 0;
      axis = null;
    }

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("touchmove", (e) => {
      if (dragging && axis === "x") e.preventDefault();
    }, { passive: false });

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        slideTo(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        slideTo(1);
      }
    });
  }

  applyLang(getLang());
})();
