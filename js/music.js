/* Background music: "Балабақша әні" (Pai-pai) streamed via the official
   YouTube embed, starting at 0:05, looped. Browsers block autoplay with
   sound, so playback starts on the first tap/click/key press; the round
   button toggles it and the choice is remembered in localStorage.
   The player iframe stays off-screen. A tap on an Instagram Reel pauses
   playback for this visit only and does not write the mute flag.
   Only one Reel plays at a time: focusing another Reel reloads any
   Reel iframe that was already activated. */
(function () {
  var VIDEO_ID = "C24N84OGub8";
  var START = 5;
  var VOLUME = 50;
  var KEY = "nursila-music";
  var EMBED_ALLOW = "autoplay; encrypted-media; picture-in-picture; clipboard-write";
  var REEL_URL = /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/;

  function isInstagramFrame(el) {
    if (!el || String(el.tagName || "").toUpperCase() !== "IFRAME") return false;
    var src = "";
    try { src = String(el.getAttribute("src") || "") + " " + String(el.src || ""); } catch (err) {}
    return src.indexOf("instagram.com") !== -1;
  }

  function canonicalEmbed(src) {
    var m = String(src || "").match(REEL_URL);
    if (!m) return "";
    return "https://www.instagram.com/reel/" + m[1] + "/embed/";
  }

  function framesInside(node) {
    var out = [];
    if (!node || !node.querySelectorAll) return out;
    var frames = node.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (isInstagramFrame(frames[i])) out.push(frames[i]);
    }
    return out;
  }

  function isPageShell(node) {
    var tag = String(node && node.tagName || "").toUpperCase();
    return tag === "BODY" || tag === "MAIN" || tag === "SECTION" || tag === "HEADER" || tag === "FOOTER" || tag === "HTML";
  }

  /* The iframe itself, its .ig-reel card, or the nearest small wrapper
     that holds exactly one Instagram iframe. */
  function frameFromEvent(e) {
    if (!e) return null;
    var el = e.target;
    if (el && el.nodeType === 3) el = el.parentNode;
    if (!el) return null;
    if (isInstagramFrame(el)) return el;
    if (el.closest) {
      var card = el.closest(".ig-reel");
      if (card) {
        var inCard = framesInside(card);
        if (inCard.length === 1) return inCard[0];
      }
    }
    var node = el;
    var guard = 0;
    while (node && node.parentElement && guard < 6) {
      if (isPageShell(node)) break;
      var frames = framesInside(node);
      if (frames.length === 1) return frames[0];
      node = node.parentElement;
      guard++;
    }
    return null;
  }

  function wrapperOf(frame) {
    if (frame.closest) {
      var card = frame.closest(".ig-reel");
      if (card) return card;
    }
    var node = frame.parentElement;
    var found = node;
    var guard = 0;
    while (node && guard < 6 && !isPageShell(node)) {
      if (framesInside(node).length === 1) found = node;
      else break;
      node = node.parentElement;
      guard++;
    }
    return found;
  }

  function unwrapAnchor(frame) {
    var node = frame.parentElement;
    while (node && node !== document.body) {
      if (String(node.tagName || "").toUpperCase() === "A") {
        if (framesInside(node).length !== 1) return;
        var parent = node.parentNode;
        if (!parent) return;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        return;
      }
      node = node.parentElement;
    }
  }

  function coversFrame(link, frame) {
    var cs;
    try { cs = window.getComputedStyle(link); } catch (err) { return false; }
    if (!cs || (cs.position !== "absolute" && cs.position !== "fixed")) return false;
    var lr = link.getBoundingClientRect();
    var fr = frame.getBoundingClientRect();
    var w = Math.max(0, Math.min(lr.right, fr.right) - Math.max(lr.left, fr.left));
    var h = Math.max(0, Math.min(lr.bottom, fr.bottom) - Math.max(lr.top, fr.top));
    return w > 16 && h > 16;
  }

  function dropCoveringLinks(frame) {
    var wrap = wrapperOf(frame);
    if (!wrap || !wrap.querySelectorAll) return;
    var links = wrap.querySelectorAll("a");
    for (var i = links.length - 1; i >= 0; i--) {
      var link = links[i];
      if (link.contains(frame)) continue;
      if (coversFrame(link, frame) && link.parentNode) link.parentNode.removeChild(link);
    }
  }

  var srcMemo = [];
  function rememberSrc(frame, src) {
    for (var i = 0; i < srcMemo.length; i++) {
      if (srcMemo[i].frame === frame) {
        if (src) srcMemo[i].src = src;
        return srcMemo[i].src;
      }
    }
    if (!src) return "";
    srcMemo.push({ frame: frame, src: src });
    return src;
  }

  var preparing = false;
  function prepareFrame(frame) {
    var raw = "";
    try { raw = frame.getAttribute("src") || ""; } catch (err) { return; }
    if (!raw || raw === "about:blank") return;
    var next = canonicalEmbed(raw);
    if (!next && !isInstagramFrame(frame)) return;
    if (next && raw !== next) {
      frame.setAttribute("src", next);
      raw = next;
    }
    rememberSrc(frame, next || raw);
    if (frame.getAttribute("allow") !== EMBED_ALLOW) frame.setAttribute("allow", EMBED_ALLOW);
    if (!frame.hasAttribute("allowfullscreen")) frame.setAttribute("allowfullscreen", "");
    unwrapAnchor(frame);
    dropCoveringLinks(frame);
  }

  function prepareAll() {
    if (preparing) return;
    preparing = true;
    try {
      var frames = document.querySelectorAll("iframe");
      for (var i = 0; i < frames.length; i++) prepareFrame(frames[i]);
    } finally {
      preparing = false;
    }
  }

  var activeFrame = null;
  var activated = [];
  var resets = [];

  function markReset(frame) {
    resets.push({ frame: frame, at: Date.now() });
  }
  function wasJustReset(frame) {
    var now = Date.now();
    for (var i = resets.length - 1; i >= 0; i--) {
      if (now - resets[i].at > 1000) resets.splice(i, 1);
      else if (resets[i].frame === frame) return true;
    }
    return false;
  }
  function clearReset(frame) {
    for (var i = resets.length - 1; i >= 0; i--) {
      if (resets[i].frame === frame) resets.splice(i, 1);
    }
  }

  function reloadFrame(frame) {
    var src = rememberSrc(frame, "") || canonicalEmbed(frame.getAttribute("src") || "");
    if (!src || src === "about:blank") return;
    markReset(frame);
    var idx = activated.indexOf(frame);
    if (idx !== -1) activated.splice(idx, 1);
    if (activeFrame === frame) activeFrame = null;
    frame.src = "about:blank";
    setTimeout(function () {
      if (activeFrame === frame) return;
      var current = "";
      try { current = frame.getAttribute("src") || frame.src || ""; } catch (err) { return; }
      if (current === "about:blank" || current.indexOf("about:blank") !== -1) frame.src = src;
    }, 0);
  }

  function activateReel(frame) {
    if (!frame || frame === activeFrame || wasJustReset(frame)) return;
    var prev = activated.slice();
    for (var i = 0; i < prev.length; i++) {
      if (prev[i] !== frame) reloadFrame(prev[i]);
    }
    if (activated.indexOf(frame) === -1) activated.push(frame);
    activeFrame = frame;
  }

  function bindReels(hooks) {
    hooks = hooks || {};
    function onPointer(e) {
      var frame = frameFromEvent(e);
      if (!frame) return;
      clearReset(frame);
      if (hooks.onReel) hooks.onReel();
      activateReel(frame);
    }
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("touchstart", onPointer, { capture: true, passive: true });
    window.addEventListener("blur", function () {
      if (hooks.onBlurStart) hooks.onBlurStart();
      setTimeout(function () {
        var el = document.activeElement;
        if (isInstagramFrame(el)) {
          if (wasJustReset(el)) return;
          if (hooks.onReel) hooks.onReel();
          activateReel(el);
        } else if (hooks.onBlurMiss) hooks.onBlurMiss();
      }, 0);
    });
    prepareAll();
    if (window.MutationObserver) {
      new MutationObserver(function () { prepareAll(); }).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  var root = document.getElementById("music");
  var btn = document.getElementById("musicBtn");
  if (!root || !btn) {
    bindReels({});
    return;
  }

  var off = false;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) {}

  var player = null;
  var ready = false;
  var playing = false;
  var wantPlay = !off;
  /* Set while a window blur might be an Instagram iframe focus, so the
     first-gesture autostart cannot start music in that same turn. */
  var blockAutoStart = false;

  function dict() {
    var all = window.NURSILA_I18N || {};
    var lang = document.documentElement.lang === "ru" ? "ru" : "kk";
    return all[lang] || all.kk || {};
  }

  function render() {
    var d = dict();
    var label = playing ? (d.musicOff || "Музыканы өшіру") : (d.musicOn || "Музыканы қосу");
    btn.classList.toggle("is-playing", playing);
    btn.classList.toggle("is-waiting", !playing && !off);
    btn.setAttribute("aria-pressed", playing ? "true" : "false");
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function play() {
    wantPlay = true;
    if (!ready) return;
    try {
      player.setVolume(VOLUME);
      player.unMute();
      var t = player.getCurrentTime ? player.getCurrentTime() : 0;
      if (!t || t < START) player.seekTo(START, true);
      player.playVideo();
    } catch (e) {}
  }

  function pause() {
    wantPlay = false;
    if (ready) { try { player.pauseVideo(); } catch (e) {} }
  }

  function onState(e) {
    var S = window.YT && YT.PlayerState;
    if (!S) return;
    if (e.data === S.PLAYING) {
      if (player.isMuted && player.isMuted()) { try { player.unMute(); } catch (err) {} }
      playing = !(player.isMuted && player.isMuted());
      if (!wantPlay) { pause(); playing = false; }
      if (playing) {
        off = false;
        save("on");
        unbindFirst();
      }
    } else if (e.data === S.ENDED) {
      if (wantPlay) { player.seekTo(START, true); player.playVideo(); }
      playing = false;
    } else if (e.data === S.PAUSED) {
      playing = false;
    }
    render();
  }

  function onReady() {
    ready = true;
    try { player.setVolume(VOLUME); } catch (e) {}
    if (wantPlay) play(); /* autoplay attempt; silently ignored if blocked */
  }

  window.onYouTubeIframeAPIReady = (function (prev) {
    return function () {
      if (typeof prev === "function") prev();
      player = new YT.Player("musicYt", {
        width: "220",
        height: "124",
        videoId: VIDEO_ID,
        playerVars: {
          start: START,
          autoplay: wantPlay ? 1 : 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3
        },
        events: { onReady: onReady, onStateChange: onState }
      });
      try {
        var f = player.getIframe && player.getIframe();
        if (f) {
          f.setAttribute("allow", "autoplay; encrypted-media");
          f.setAttribute("title", "Music");
        }
      } catch (e) {}
    };
  })(window.onYouTubeIframeAPIReady);

  var s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  s.async = true;
  document.head.appendChild(s);

  function reelEventTarget(e) {
    if (!e) return false;
    var t = e.type;
    if (t !== "pointerdown" && t !== "touchstart" && t !== "touchend" && t !== "click") return false;
    return !!frameFromEvent(e);
  }

  /* Pause for this visit only. Button shows the off/paused icon, but the
     stored mute flag is left untouched so the next visit still plays. */
  function pauseForReel() {
    blockAutoStart = true;
    off = true;
    pause();
    playing = false;
    unbindFirst();
    render();
  }

  /* start on first user interaction (unless muted earlier, or the gesture is a Reel) */
  var FIRST = ["pointerdown", "touchend", "click", "keydown", "scroll", "wheel"];
  function onFirst(e) {
    if (blockAutoStart || off || playing) return;
    if (e && e.target && btn.contains(e.target)) return;
    if (reelEventTarget(e)) return;
    if (isInstagramFrame(document.activeElement)) return;
    play();
  }
  function bindFirst() {
    FIRST.forEach(function (ev) {
      window.addEventListener(ev, onFirst, { passive: true, capture: true });
    });
  }
  function unbindFirst() {
    FIRST.forEach(function (ev) {
      window.removeEventListener(ev, onFirst, { capture: true });
    });
  }
  if (!off) bindFirst();

  btn.addEventListener("click", function () {
    if (playing) {
      off = true;
      save("off");
      pause();
      playing = false;
      unbindFirst();
    } else {
      /* Playback blocked, or paused by a Reel: this tap is the resume. */
      blockAutoStart = false;
      off = false;
      save("on");
      play();
    }
    render();
  });

  bindReels({
    onBlurStart: function () { blockAutoStart = true; },
    onReel: pauseForReel,
    onBlurMiss: function () { if (!off) blockAutoStart = false; }
  });

  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"]
  });

  render();
})();
