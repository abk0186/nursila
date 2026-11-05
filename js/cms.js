/* Applies content edited in /admin/ (data/site.json). If the file fails to load, the built-in content stays. */
(function () {
  var I = window.NURSILA_I18N;
  function fit(btn, img) {
    function f() { if (img.naturalWidth && img.naturalHeight) { btn.classList.remove("portrait","wide","tall"); btn.style.aspectRatio = img.naturalWidth + "/" + img.naturalHeight; img.style.objectFit = "contain"; } }
    if (img.complete) f(); else img.addEventListener("load", f);
  }
  function setGallery(id, items, keepCount) {
    var root = document.getElementById(id); if (!root || !Array.isArray(items)) return;
    var btns = root.querySelectorAll(".gallery-item");
    var cur = Array.prototype.map.call(btns, function (b) { return b.dataset.full; });
    var want = items.map(function (x) { return x && x.photo; }).filter(Boolean);
    if (JSON.stringify(cur) === JSON.stringify(want)) return;
    if (keepCount && btns.length === want.length) {
      want.forEach(function (src, i) { var b = btns[i], im = b.querySelector("img"); b.dataset.full = src; im.src = src; fit(b, im); });
      return;
    }
    root.innerHTML = "";
    want.forEach(function (src) {
      var b = document.createElement("button"); b.type = "button"; b.className = "gallery-item"; b.dataset.full = src;
      var im = document.createElement("img"); im.src = src; im.loading = "lazy"; im.alt = ""; b.appendChild(im); root.appendChild(b); fit(b, im);
    });
  }
  function phPhoto(key, src) {
    if (!src) return; var sp = document.querySelector('.photo-ph [data-i18n="' + key + '"]'); if (!sp) return;
    var fig = sp.parentNode, im = document.createElement("img"); im.src = src; im.alt = "";
    im.style.cssText = "width:100%;height:auto;object-fit:contain;display:block;border-radius:18px";
    fig.innerHTML = ""; fig.appendChild(im); fig.style.cssText = "border:0;aspect-ratio:auto;padding:0;background:none";
  }
  fetch("data/site.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !I) return;
    Object.keys(d.texts || {}).forEach(function (k) { var v = d.texts[k] || {}; if (v.kk) I.kk[k] = v.kk; if (v.ru) I.ru[k] = v.ru; });
    Object.keys(d.lists || {}).forEach(function (k) { var v = d.lists[k] || {};
      ["kk","ru"].forEach(function (l) { if (Array.isArray(v[l]) && v[l].length) I[l][k] = v[l].map(function (x) { return x.t; }); }); });
    if (d.hero) { var h = document.querySelector(".hero-photo img"); if (h && h.getAttribute("src") !== d.hero) { h.src = d.hero; h.removeAttribute("width"); h.removeAttribute("height"); } }
    if (d.nursila) { var n = document.querySelector(".nursila-photo img"); if (n && n.getAttribute("src") !== d.nursila) { n.src = d.nursila; n.removeAttribute("width"); n.removeAttribute("height"); } }
    setGallery("gallery-groups", d.groups, true);
    setGallery("gallery-interior", d.interior, false);
    setGallery("gallery-events", d.events, false);
    phPhoto("phTeam", d.teamPhoto); phPhoto("phSeminar", d.seminarPhoto);
    var docs = (d.docs || []).filter(function (x) { return x && x.file; });
    if (docs.length) {
      var lang = localStorage.getItem("nursila-lang") === "ru" ? "ru" : "kk", t = d.docsTitle || {};
      I.kk.docsTitle = t.kk || "Құжаттар"; I.ru.docsTitle = t.ru || "Документы";
      var sec = document.createElement("section"); sec.className = "section"; sec.id = "docs";
      var html = '<div class="container narrow"><h2 data-i18n="docsTitle"></h2><ul class="merits">';
      docs.forEach(function (x, i) { var k = "doc" + i; I.kk[k] = (x.name && x.name.kk) || x.file.split("/").pop(); I.ru[k] = (x.name && x.name.ru) || I.kk[k];
        html += '<li><a href="' + encodeURI(x.file) + '" target="_blank" rel="noopener" data-i18n="' + k + '"></a></li>'; });
      sec.innerHTML = html + "</ul></div>";
      var c = document.getElementById("contacts"); if (c) c.parentNode.insertBefore(sec, c);
    }
    var lang2 = localStorage.getItem("nursila-lang") === "ru" ? "ru" : "kk";
    var btn = document.querySelector('.lang-btn[data-lang="' + lang2 + '"]'); if (btn) btn.click();
  }).catch(function () {});
})();
