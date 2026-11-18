/* =========================================================
   SUL0557 — background music player
   A small pixel player in a corner: play / pause, previous / next,
   volume + mute, minimise. Browsers only allow sound after the
   visitor clicks something, so music starts on PRESS START
   (or on the first click/tap if the intro is turned off).
   Settings: site.json -> music (edit in the admin, 🎵 Music Player).
   ========================================================= */
(function () {
  'use strict';

  var cfg = null, api = null, preview = false;
  var audio = null, root = null, order = [], idx = 0, tracks = [];
  var started = false, armed = false, lastKey = '';
  var LS_VOL = 'sul.music.vol', LS_MUTE = 'sul.music.mute', SS_PAUSED = 'sul.music.paused', SS_MIN = 'sul.music.min', SS_POS = 'sul.music.pos';

  function store(k, v, session) { try { (session ? sessionStorage : localStorage).setItem(k, String(v)); } catch (e) {} }
  function read(k, session) { try { return (session ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function audioSrc(t) {
    var s = api.asset(t && t.src);
    if (!s) return '';
    // only real audio files / data urls; links to web pages can't play here
    if (/^data:audio\//i.test(s) || /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)(\?|#|$)/i.test(s) || /^uploads\//i.test(s)) return s;
    return /^https?:/i.test(s) ? s : '';
  }

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'music';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Music player');
    document.body.appendChild(root);
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('ended', function () { next(1, true); });
    audio.addEventListener('play', paint);
    audio.addEventListener('pause', paint);
    audio.addEventListener('error', function () {
      // skip broken tracks instead of getting stuck
      if (tracks.length > 1 && started) setTimeout(function () { next(1, true); }, 300);
      paint();
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]');
      if (!b) return;
      var a = b.getAttribute('data-m');
      if (a === 'toggle') toggle();
      else if (a === 'next') next(1, true);
      else if (a === 'prev') next(-1, true);
      else if (a === 'mute') { audio.muted = !audio.muted; store(LS_MUTE, audio.muted ? 1 : 0); paint(); }
      else if (a === 'min') { root.classList.add('is-min'); store(SS_MIN, 1, true); paint(); }
      else if (a === 'open') { root.classList.remove('is-min'); store(SS_MIN, 0, true); paint(); }
    });
    root.addEventListener('input', function (e) {
      if (!e.target.matches('[data-vol]')) return;
      var v = clamp(Number(e.target.value) / 100, 0, 1);
      audio.volume = v; store(LS_VOL, v);
      if (v > 0 && audio.muted) { audio.muted = false; store(LS_MUTE, 0); }
      paint();
    });
  }

  function current() { return tracks[order[idx]]; }
  function load(play) {
    var t = current();
    if (!t) return;
    var src = audioSrc(t);
    if (audio.getAttribute('data-src') !== src) { audio.src = src; audio.setAttribute('data-src', src); }
    try { store(SS_POS, order[idx], true); } catch (e) {}
    paint();
    if (play) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { paint(); });
    }
  }
  function toggle() {
    if (!tracks.length) return;
    started = true;
    if (audio.paused) { store(SS_PAUSED, 0, true); if (!audio.src) load(true); else { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } }
    else { audio.pause(); store(SS_PAUSED, 1, true); }
  }
  function next(d, play) {
    if (!tracks.length) return;
    idx = (idx + d + order.length) % order.length;
    load(play || !audio.paused);
  }
  function shuffleOrder() {
    order = tracks.map(function (_, i) { return i; });
    if (cfg.music.shuffle) for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = order[i]; order[i] = order[j]; order[j] = x; }
  }

  function paint() {
    if (!root) return;
    var m = cfg.music, t = current();
    var playing = audio && !audio.paused;
    var vol = Math.round((audio ? audio.volume : 0.5) * 100);
    var muted = audio && (audio.muted || audio.volume === 0);
    root.className = 'pos-' + (m.position || 'bottom-left') + (root.classList.contains('is-min') ? ' is-min' : '') + (playing ? ' is-playing' : '');
    if (root.classList.contains('is-min')) {
      root.innerHTML = '<button class="m-open" type="button" data-m="open" aria-label="Open music player">' + api.icon('music-open') +
        (playing ? '<span class="m-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : '') + '</button>';
      return;
    }
    var title = t ? (t.title || 'Untitled') : 'No tracks';
    root.innerHTML =
      '<div class="m-top"><span class="m-label">' + api.esc(m.label || 'NOW PLAYING') + '</span>' +
        '<button type="button" class="m-x" data-m="min" aria-label="Minimise player">' + api.icon('music-min') + '</button></div>' +
      '<div class="m-title" title="' + api.esc(title) + '"><span class="' + (title.length > 22 ? 'm-scroll' : '') + '">' + api.esc(title) + '</span></div>' +
      '<div class="m-ctrls">' +
        '<button type="button" data-m="prev" aria-label="Previous track"' + (tracks.length < 2 ? ' disabled' : '') + '>' + api.icon('music-prev') + '</button>' +
        '<button type="button" class="m-play" data-m="toggle" aria-label="' + (playing ? 'Pause' : 'Play') + '">' + api.icon(playing ? 'music-pause' : 'music-play') + '</button>' +
        '<button type="button" data-m="next" aria-label="Next track"' + (tracks.length < 2 ? ' disabled' : '') + '>' + api.icon('music-next') + '</button>' +
        '<button type="button" data-m="mute" aria-label="' + (muted ? 'Unmute' : 'Mute') + '">' + api.icon(muted ? 'music-mute' : 'music-volume') + '</button>' +
        '<input type="range" min="0" max="100" value="' + (audio && audio.muted ? 0 : vol) + '" data-vol aria-label="Volume">' +
      '</div>';
  }

  function startIfAllowed() {
    if (!tracks.length || !cfg.music.autoplay || started) return;
    if (read(SS_PAUSED, true) === '1') return; // visitor paused it earlier this visit
    started = true;
    load(true);
  }

  window.SulMusic = {
    configure: function (c, a, isPreview) {
      cfg = c; api = a; preview = !!isPreview;
      var m = cfg.music || {};
      tracks = (m.tracks || []).filter(function (t) { return t && audioSrc(t); });
      var on = m.enabled && tracks.length;
      if (!on) { if (root) { audio.pause(); root.remove(); root = null; } return; }
      build();
      var key = JSON.stringify([tracks.map(function (t) { return t.src; }), m.shuffle]);
      if (key !== lastKey) {
        lastKey = key; shuffleOrder();
        var saved = Number(read(SS_POS, true));
        idx = Math.max(0, order.indexOf(isFinite(saved) ? saved : order[0]));
        if (idx < 0) idx = 0;
        var t = current(); if (t) { audio.src = audioSrc(t); audio.setAttribute('data-src', audio.src ? audioSrc(t) : ''); }
      }
      var v = read(LS_VOL);
      audio.volume = clamp(v !== null ? Number(v) : Number(m.volume == null ? 0.5 : m.volume), 0, 1);
      audio.muted = read(LS_MUTE) === '1';
      var min = read(SS_MIN, true);
      root.classList.toggle('is-min', min === null ? (!!m.startMinimized || window.innerWidth < 560) : min === '1'); // phones start small so it doesn't cover the page
      paint();
    },
    userStart: function () { if (!preview && root) startIfAllowed(); },
    armFirstGesture: function () {
      if (armed || preview) return;
      armed = true;
      var go = function (e) {
        if (root && root.contains(e.target)) return; // clicks on the player itself handle themselves
        window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true);
        if (root) startIfAllowed();
      };
      window.addEventListener('pointerdown', go, true);
      window.addEventListener('keydown', go, true);
    },
    pause: function () { if (audio) audio.pause(); }
  };
})();
