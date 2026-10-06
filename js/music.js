/* Background music: "Балабақша әні" (Pai-pai) streamed via the official
   YouTube embed, starting at 0:05, looped. Browsers block autoplay with
   sound, so playback starts on the first tap/click/key press; the round
   button toggles it and the choice is remembered in localStorage.
   The player iframe stays off-screen. A tap on an Instagram Reel pauses
   playback for this visit only and does not write the mute flag. */
(function () {
  var VIDEO_ID = "C24N84OGub8";
  var START = 5;
  var VOLUME = 50;
  var KEY = "nursila-music";

  var root = document.getElementById("music");
  var btn = document.getElementById("musicBtn");
  if (!root || !btn) return;

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

  function isInstagramFrame(el) {
    if (!el || String(el.tagName || "").toUpperCase() !== "IFRAME") return false;
    var src = "";
    try { src = String(el.getAttribute("src") || "") + " " + String(el.src || ""); } catch (err) {}
    return src.indexOf("instagram.com") !== -1;
  }

  function reelEventTarget(e) {
    if (!e) return false;
    var t = e.type;
    if (t !== "pointerdown" && t !== "touchstart" && t !== "touchend" && t !== "click") return false;
    var el = e.target;
    if (el && el.nodeType === 3) el = el.parentNode;
    if (!el) return false;
    if (el.closest && el.closest(".ig-reel")) return true;
    return isInstagramFrame(el);
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

  document.querySelectorAll(".ig-reel").forEach(function (wrap) {
    wrap.addEventListener("pointerdown", pauseForReel, true);
    wrap.addEventListener("touchstart", pauseForReel, { capture: true, passive: true });
  });

  window.addEventListener("blur", function () {
    blockAutoStart = true;
    setTimeout(function () {
      if (isInstagramFrame(document.activeElement)) pauseForReel();
      else if (!off) blockAutoStart = false;
    }, 0);
  });

  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"]
  });

  render();
})();
