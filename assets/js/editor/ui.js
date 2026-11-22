/* =========================================================
   SUL0557 — SHORT EDITOR (v5 interface)
   Shell: workspace, project + media, playback, stage, timeline.
   ui-insp.js adds the inspector + side panels, ui-io.js adds
   saving, exporting, accounts and the template builder.
   ========================================================= */
(function () {
  'use strict';
  var C = window.ShortCore, T = C.T;
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(tag, attrs, html) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round(v, d) { var k = Math.pow(10, d || 0); return Math.round(v * k) / k; }
  function fmt(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); }
  function download(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
  function safeName(s) { return String(s || 'short').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'short'; }
  var U = { E: E, h: h, clamp: clamp, clone: clone, round: round, fmt: fmt, download: download, safeName: safeName };

  /* ---------- IndexedDB: projects + media blobs (stay in this browser) ---------- */
  var DBP = null;
  function db() {
    if (DBP) return DBP;
    DBP = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('No storage'));
      var r = indexedDB.open('sul-short', 1);
      r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { DBP = null; rej(r.error); };
    });
    return DBP;
  }
  function idb(store, mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var tx = d.transaction(store, mode), req = fn(tx.objectStore(store)); tx.oncomplete = function () { res(req && 'result' in req ? req.result : undefined); }; tx.onerror = tx.onabort = function () { rej(tx.error || new Error('Storage error')); }; }); }); }
  var store = {
    putBlob: function (id, b) { return idb('blobs', 'readwrite', function (s) { return s.put(b, id); }); },
    getBlob: function (id) { return idb('blobs', 'readonly', function (s) { return s.get(id); }); },
    delBlob: function (id) { return idb('blobs', 'readwrite', function (s) { return s.delete(id); }); },
    putProject: function (rec) { return idb('projects', 'readwrite', function (s) { return s.put(rec, rec.id); }); },
    getProject: function (id) { return idb('projects', 'readonly', function (s) { return s.get(id); }); },
    allProjects: function () { return idb('projects', 'readonly', function (s) { return s.getAll(); }); },
    delProject: function (id) { return idb('projects', 'readwrite', function (s) { return s.delete(id); }); }
  };

  /* ---------- workspace (panel sizes / layout), remembered per browser ---------- */
  var WS_KEY = 'sul.short.ws', WS_DEF = { left: 300, right: 330, tl: 260, swap: false, ui: 100, leftOpen: true, rightOpen: true, tlOpen: true };
  function loadWS() { var w = clone(WS_DEF); try { var j = JSON.parse(localStorage.getItem(WS_KEY) || '{}'); Object.keys(WS_DEF).forEach(function (k) { if (j[k] != null && typeof j[k] === typeof WS_DEF[k]) w[k] = j[k]; }); } catch (e) { } return w; }

  var live = null;
  function mount(root, cfg, api, opts) { unmount(); var ed = new Editor(root, cfg, api, opts || {}); live = ed; ed.init(); return ed; }
  function unmount() { if (live) { try { live.destroy(); } catch (e) { console.error(e); } live = null; } }

  function Editor(root, cfg, api, opts) {
    this.root = root; this.cfg = cfg || {}; this.api = api || {}; this.opts = opts || {};
    this.P = null; this.sel = null; this.selKind = null; this.t = 0; this.playing = false; this.loopOn = false; this.click = false;
    this.media = {}; this.buffers = {}; this.midis = {}; this.vids = {}; this.an = null; this.hist = []; this.hi = -1;
    this.quality = 0.6; this.tlZoom = 0; this.snap = true; this.tab = 'media'; this.insTab = 'edit'; this.offs = []; this.dirty = false;
    this.stageZoom = 0; this.ws = loadWS(); this.nodes = [];
    var cc = ((this.cfg.editor || {}).cloud) || {};
    this.cloud = window.ShortCloud && cc.enabled !== false && !this.opts.builder ? new window.ShortCloud(cc) : null;
  }
  var EP = Editor.prototype;
  EP.on = function (tg, ev, fn, o) { tg.addEventListener(ev, fn, o); this.offs.push([tg, ev, fn, o]); };
  EP.destroy = function () {
    this.dead = true; if (this.box && this.box.classList.contains('se-fs')) this.fullScreen(false); this.stop(); cancelAnimationFrame(this.raf); clearInterval(this.autoT); if (this.ro) this.ro.disconnect();
    if (this.dirty && !this.opts.builder) this.saveLocal();
    this.offs.forEach(function (o) { o[0].removeEventListener(o[1], o[2], o[3]); });
    Object.keys(this.vids).forEach(function (k) { try { this.vids[k].pause(); this.vids[k].removeAttribute('src'); this.vids[k].load(); } catch (e) { } }, this);
    Object.keys(this.media).forEach(function (k) { var m = this.media[k]; if (m && m.url && m.own) URL.revokeObjectURL(m.url); }, this);
    if (this.ac) try { this.ac.close(); } catch (e) { }
    if (this.box && this.box.parentNode && this.box.parentNode !== this.root) this.box.remove();
    this.root.innerHTML = '';
  };
  EP.toast = function (msg, bad) { var t = this.$('.se-toast'); if (!t) return; t.textContent = msg; t.className = 'se-toast show' + (bad ? ' bad' : ''); clearTimeout(this.toastT); this.toastT = setTimeout(function () { t.className = 'se-toast'; }, bad ? 5000 : 3000); };
  EP.$ = function (s) { return (this.box || this.root).querySelector(s); };

  var RAIL = [['media', '📁', 'Media'], ['audio', '🎵', 'Audio & MIDI'], ['text', 'T', 'Text'], ['elements', '✦', 'Visuals'], ['effects', '✨', 'Effects'], ['anims', '🎬', 'Animations'], ['trans', '⚡', 'Transitions'], ['templates', '🧩', 'Templates'], ['replace', '⇄', 'Replace'], ['textures', '▦', 'Textures'], ['canvas', '▣', 'Canvas']];

  EP.init = function () {
    var self = this, B = this.opts.builder;
    this.root.innerHTML =
      '<div class="se' + (B ? ' se-builder' : '') + '">' +
      '<div class="se-top">' +
      '<div class="se-brand"><b>SHORT</b><span>EDITOR</span>' + (B ? '<em>' + (this.opts.skinMode ? 'MIDI SKIN MAKER' : 'TEMPLATE MAKER') + '</em>' : '') + '</div>' +
      '<input class="se-name" type="text" maxlength="60" aria-label="Project name" title="Project name">' +
      '<label class="se-ratio" title="Video shape"><select data-ratio>' + C.RATIOS.map(function (r) { return '<option value="' + r[0] + '">' + r[0] + ' · ' + r[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="se-bpm" title="Tempo — everything that moves on the beat follows this"><label>BPM <input type="number" min="40" max="300" step="0.1" data-bpm></label><button type="button" data-tap title="Tap along to the music">TAP</button><button type="button" data-detect title="Guess the BPM from your audio">AUTO</button></div>' +
      '<span class="se-flex"></span>' +
      '<div class="se-topbtns"><button type="button" data-undo title="Undo (Ctrl+Z)">↶</button><button type="button" data-redo title="Redo (Ctrl+Shift+Z)">↷</button>' +
      '<button type="button" data-layout title="Workspace: panel sizes, swap sides, reset">⚙ LAYOUT</button>' + (B ? '' : '<button type="button" data-fs title="Full screen (F)">⛶ FULL SCREEN</button>') +
      (B ? '' : '<button type="button" data-projects>📁 PROJECTS</button><button type="button" data-save>💾 SAVE</button><button type="button" data-login hidden>☁ LOG IN</button>') +
      (B ? (this.opts.skinMode ? '' : '<button type="button" class="se-export" data-savetpl>✓ SAVE TEMPLATE</button>') + '<button type="button" data-closeb>✕ CLOSE</button>' : '<button type="button" class="se-export" data-export>⬇ EXPORT</button>') +
      '</div></div>' +
      '<div class="se-body">' +
      '<nav class="se-rail" role="tablist">' + RAIL.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" title="' + t[2] + '"><i>' + t[1] + '</i><span>' + t[2] + '</span></button>'; }).join('') + '</nav>' +
      '<div class="se-left"><div class="se-panel"></div></div>' +
      '<div class="se-split v" data-split="left" title="Drag to resize · double-click to hide"></div>' +
      '<div class="se-center">' +
      '<div class="se-stagebox"><div class="se-stagewrap checker"><canvas class="se-stage"></canvas><div class="se-guides"><i class="gx"></i><i class="gy"></i></div><div class="se-sel" hidden><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i><b data-h="rot" title="Rotate"></b></div><div class="se-drop">DROP HERE ✦</div></div></div>' +
      '<div class="se-transport"><button type="button" data-home title="Back to start (Home)">⏮</button><button type="button" data-fb title="Back one frame (,)">◀▮</button><button type="button" class="se-play" data-play title="Play / pause (Space)">▶</button><button type="button" data-ff title="Forward one frame (.)">▮▶</button><span class="se-time">0:00.00 / 0:10.00</span><button type="button" data-loop title="Loop">🔁</button><button type="button" data-click title="Click track while previewing">🥁</button>' +
      '<span class="se-flex"></span><label class="se-q" title="Preview sharpness (export is always full quality)"><span>Preview</span> <select data-quality><option value="0.35">Fast</option><option value="0.6" selected>Good</option><option value="1">Full</option></select></label>' +
      '<span class="se-zoombox"><button type="button" data-sz="-" title="Zoom out">−</button><button type="button" data-sz="fit" class="se-zv" title="Fit">FIT</button><button type="button" data-sz="+" title="Zoom in">+</button></span></div>' +
      '</div>' +
      '<div class="se-split v" data-split="right" title="Drag to resize · double-click to hide"></div>' +
      '<aside class="se-right"><div class="se-insp"></div></aside>' +
      '</div>' +
      '<div class="se-split hz" data-split="tl" title="Drag to resize the timeline"></div>' +
      '<div class="se-tl">' +
      '<div class="se-tlbar">' +
      '<button type="button" data-act="split" title="Split at playhead (S)">✂ <span>Split</span></button><button type="button" data-act="del" title="Delete (Del)">🗑 <span>Delete</span></button><button type="button" data-act="dup" title="Duplicate (Ctrl+D)">⧉ <span>Duplicate</span></button><button type="button" data-act="kf" title="Add / remove keyframe at playhead (K)">◆ <span>Keyframe</span></button>' +
      '<i class="se-sep"></i><button type="button" data-act="text" title="Add text">T <span>Text</span></button><button type="button" data-act="adjust" title="Add an adjustment layer — its effects apply to everything under it">◐ <span>Adjustment layer</span></button><button type="button" data-act="trans" title="Add a transition at the playhead">⚡ <span>Transition</span></button>' +
      '<span class="se-flex"></span><label class="se-chk" title="Clips snap to beats, other clips and the playhead"><input type="checkbox" data-snap checked><span>Snap</span></label>' +
      '<span class="se-zoombox"><button type="button" data-tz="-" title="Zoom timeline out">−</button><input type="range" min="0" max="100" value="0" data-tlzoom aria-label="Timeline zoom"><button type="button" data-tz="+" title="Zoom timeline in">+</button><button type="button" data-tz="fit" title="Fit all">FIT</button></span>' +
      '</div>' +
      '<div class="se-tlscroll"><div class="se-tlinner"></div></div>' +
      '</div>' +
      '<div class="se-toast" aria-live="polite"></div><div class="se-modal" hidden></div><div class="se-ctx" hidden></div>' +
      '</div>';
    var R = this.root;
    this.box = R.querySelector('.se'); this.cv = R.querySelector('.se-stage'); this.wrap = R.querySelector('.se-stagewrap'); this.selBox = R.querySelector('.se-sel');
    this.panel = R.querySelector('.se-panel'); this.insp = R.querySelector('.se-insp'); this.tlInner = R.querySelector('.se-tlinner'); this.tlScroll = R.querySelector('.se-tlscroll');
    this.applyWS(); C.setTheme(this.cfg.theme); this.loadSkins();
    // top bar
    R.querySelector('.se-name').addEventListener('input', function (e) { self.P.name = e.target.value; self.changed({ quiet: true }); });
    R.querySelector('[data-ratio]').addEventListener('change', function (e) { self.setRatio(e.target.value); });
    var bpmIn = R.querySelector('[data-bpm]');
    bpmIn.addEventListener('change', function () { self.setBpm(+bpmIn.value); });
    var taps = [];
    R.querySelector('[data-tap]').addEventListener('click', function () {
      var now = performance.now(); taps = taps.filter(function (x) { return now - x < 2500; }); taps.push(now);
      if (taps.length >= 3) { var d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); self.setBpm(round(60000 / d, 1)); self.toast('Tapped: ' + self.P.bpm + ' BPM'); }
      else self.toast('Keep tapping on the beat…');
    });
    R.querySelector('[data-detect]').addEventListener('click', function () { self.detectBpm(); });
    R.querySelector('[data-undo]').addEventListener('click', function () { self.undo(); });
    R.querySelector('[data-redo]').addEventListener('click', function () { self.redo(); });
    R.querySelector('[data-layout]').addEventListener('click', function (e) { self.layoutMenu(e.currentTarget); });
    if (R.querySelector('[data-fs]')) R.querySelector('[data-fs]').addEventListener('click', function () { self.fullScreen(); });
    this.on(document, 'fullscreenchange', function () { if (!document.fullscreenElement && self.box.classList.contains('se-fs') && self._fsApi) self.fullScreen(false); });
    if (!B) {
      R.querySelector('[data-projects]').addEventListener('click', function () { self.projectsDialog(); });
      R.querySelector('[data-save]').addEventListener('click', function () { self.saveLocal(true); });
      R.querySelector('[data-export]').addEventListener('click', function () { self.exportDialog(); });
      var lg = R.querySelector('[data-login]');
      if (this.cloud && this.cloud.ok) { lg.hidden = false; lg.addEventListener('click', function () { self.cloudDialog(); }); this.updateLogin(); }
    } else {
      if (R.querySelector('[data-savetpl]')) R.querySelector('[data-savetpl]').addEventListener('click', function () { self.saveTemplate(); });
      R.querySelector('[data-closeb]').addEventListener('click', function () { if (self.opts.onClose) self.opts.onClose(); });
    }
    R.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { var tb = b.getAttribute('data-tab'); if (self.tab === tb && self.ws.leftOpen) { self.ws.leftOpen = false; } else { self.tab = tb; self.ws.leftOpen = true; } self.applyWS(true); self.renderPanel(); }); });
    // transport
    R.querySelector('[data-play]').addEventListener('click', function () { self.toggle(); });
    R.querySelector('[data-home]').addEventListener('click', function () { self.seek(0); });
    R.querySelector('[data-fb]').addEventListener('click', function () { self.step(-1); });
    R.querySelector('[data-ff]').addEventListener('click', function () { self.step(1); });
    R.querySelector('[data-loop]').addEventListener('click', function (e) { self.loopOn = !self.loopOn; e.currentTarget.classList.toggle('on', self.loopOn); });
    R.querySelector('[data-click]').addEventListener('click', function (e) { self.click = !self.click; e.currentTarget.classList.toggle('on', self.click); self.toast(self.click ? 'Click track on (only while previewing)' : 'Click track off'); if (self.playing) { self.stop(); self.play(); } });
    R.querySelector('[data-quality]').addEventListener('change', function (e) { self.quality = +e.target.value; self.sizeStage(); });
    R.querySelectorAll('[data-sz]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-sz'); self.setStageZoom(v === 'fit' ? 0 : v === '+' ? 1 : -1); }); });
    // timeline bar
    R.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { self.action(b.getAttribute('data-act')); }); });
    R.querySelector('[data-snap]').addEventListener('change', function (e) { self.snap = e.target.checked; });
    var tz = R.querySelector('[data-tlzoom]');
    tz.addEventListener('input', function () { self.setTlZoom(+tz.value); });
    R.querySelectorAll('[data-tz]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-tz'); self.setTlZoom(v === 'fit' ? 0 : self.tlZoom + (v === '+' ? 12 : -12)); }); });
    this.bindSplits(); this.bindStage(); this.bindTimeline(); this.bindKeys();
    this.on(document, 'pointerdown', function (e) { var c = self.$('.se-ctx'); if (c && !c.hidden && !c.contains(e.target)) c.hidden = true; }, true);
    this.on(window, 'resize', function () { self.sizeStage(); self.renderTimeline(); });
    if (window.ResizeObserver) { var rsT = 0; this.ro = new ResizeObserver(function () { clearTimeout(rsT); rsT = setTimeout(function () { if (!self.dead) { self.sizeStage(); self.renderTimeline(); } }, 50); }); this.ro.observe(R.querySelector('.se-stagebox')); this.ro.observe(this.tlScroll); }
    this.loadSiteFonts();
    // start: builder project, last project, or a blank one
    var go;
    if (B) go = Promise.resolve(this.load(this.opts.project ? C.upgrade(clone(this.opts.project)) : C.newProject({ name: 'New template' }), false)).then(function () { if (self.opts.project) self.dirty = false; });
    else {
      var last = null; try { last = localStorage.getItem('sul.short.last'); } catch (e) { }
      go = (last ? store.getProject(last).then(function (rec) { if (rec) return self.openRecord(rec); throw 0; }) : Promise.reject(0))
        .catch(function () { self.tab = 'templates'; return self.load(C.newProject({ name: 'My short' }), true); });
    }
    go.then(function () { self.renderPanel(); });
    if (!B) this.autoT = setInterval(function () { if (self.dirty && !self.exporting) self.saveLocal(); }, 6000);
    this.loop_();
  };

  /* =========================================================
     WORKSPACE
     ========================================================= */
  EP.applyWS = function (save) {
    var w = this.ws, b = this.box, vw = (this.box && this.box.clientWidth) || this.root.clientWidth || 1400;
    w.left = clamp(w.left, 200, Math.max(220, vw * 0.4)); w.right = clamp(w.right, 240, Math.max(260, vw * 0.42)); w.tl = clamp(w.tl, 120, 700); w.ui = clamp(w.ui, 75, 140);
    b.style.setProperty('--se-left', (w.leftOpen ? w.left : 0) + 'px'); b.style.setProperty('--se-right', (w.rightOpen ? w.right : 0) + 'px'); b.style.setProperty('--se-tlh', (w.tlOpen ? w.tl : 34) + 'px');
    b.style.fontSize = (13 * w.ui / 100) + 'px';
    b.classList.toggle('se-swap', !!w.swap); b.classList.toggle('no-left', !w.leftOpen); b.classList.toggle('no-right', !w.rightOpen); b.classList.toggle('no-tl', !w.tlOpen);
    var tab = this.tab; b.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', w.leftOpen && x.getAttribute('data-tab') === tab); });
    if (save) { try { localStorage.setItem(WS_KEY, JSON.stringify(w)); } catch (e) { } var self = this; setTimeout(function () { self.sizeStage(); self.renderTimeline(); }, 30); }
  };
  EP.bindSplits = function () {
    var self = this;
    this.root.querySelectorAll('[data-split]').forEach(function (sp) {
      var which = sp.getAttribute('data-split');
      sp.addEventListener('dblclick', function () {
        if (which === 'left') self.ws.leftOpen = !self.ws.leftOpen; else if (which === 'right') self.ws.rightOpen = !self.ws.rightOpen; else self.ws.tlOpen = !self.ws.tlOpen;
        self.applyWS(true);
      });
      sp.addEventListener('pointerdown', function (e) {
        e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add('on');
        var x0 = e.clientX, y0 = e.clientY, w = self.ws, l0 = w.leftOpen ? w.left : 0, r0 = w.rightOpen ? w.right : 0, t0 = w.tlOpen ? w.tl : 34, sw = w.swap ? -1 : 1;
        function mv(ev) {
          var dx = ev.clientX - x0, dy = ev.clientY - y0;
          if (which === 'left') { var nl = l0 + dx * sw; if (nl < 120) { w.leftOpen = false; } else { w.leftOpen = true; w.left = nl; } }
          else if (which === 'right') { var nr = r0 - dx * sw; if (nr < 150) { w.rightOpen = false; } else { w.rightOpen = true; w.right = nr; } }
          else { var nt = t0 - dy; if (nt < 70) { w.tlOpen = false; } else { w.tlOpen = true; w.tl = nt; } }
          self.applyWS(false);
        }
        function up() { sp.classList.remove('on'); sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); sp.removeEventListener('pointercancel', up); self.applyWS(true); }
        sp.addEventListener('pointermove', mv); sp.addEventListener('pointerup', up); sp.addEventListener('pointercancel', up);
      });
    });
  };
  // fills the whole screen (and hides the browser bars when the browser allows it)
  EP.fullScreen = function (on) {
    var b = this.box, self = this; if (on == null) on = !b.classList.contains('se-fs');
    b.classList.toggle('se-fs', on); document.documentElement.classList.toggle('se-fs-on', on);
    // move the editor to the top of the page while full screen, so nothing on the site can squeeze it
    if (on && b.parentNode !== document.body) document.body.appendChild(b);
    if (!on && b.parentNode !== this.root) this.root.appendChild(b);
    var btn = this.$('[data-fs]'); if (btn) btn.textContent = on ? '✕ EXIT FULL SCREEN' : '⛶ FULL SCREEN';
    if (on) { this._fsApi = false; if (b.requestFullscreen && !document.fullscreenElement) b.requestFullscreen().then(function () { self._fsApi = true; }).catch(function () { }); }
    else if (document.fullscreenElement) document.exitFullscreen().catch(function () { });
    setTimeout(function () { self.stageZoom = 0; self.sizeStage(); self.renderTimeline(); }, 120);
  };
  EP.layoutMenu = function (anchor) {
    var self = this, w = this.ws, r = anchor.getBoundingClientRect();
    this.ctxMenu(r.left, r.bottom + 4, [
      [(w.leftOpen ? '☑' : '☐') + ' Left panel (tools)', function () { w.leftOpen = !w.leftOpen; self.applyWS(true); }],
      [(w.rightOpen ? '☑' : '☐') + ' Right panel (settings)', function () { w.rightOpen = !w.rightOpen; self.applyWS(true); }],
      [(w.tlOpen ? '☑' : '☐') + ' Timeline', function () { w.tlOpen = !w.tlOpen; self.applyWS(true); }],
      ['⇄ Swap left and right panels', function () { w.swap = !w.swap; self.applyWS(true); }],
      '-',
      ['A+ Bigger buttons & text', function () { w.ui = Math.min(140, w.ui + 10); self.applyWS(true); }],
      ['A− Smaller buttons & text', function () { w.ui = Math.max(75, w.ui - 10); self.applyWS(true); }],
      ['▭ Bigger timeline', function () { w.tlOpen = true; w.tl = Math.min(700, w.tl + 80); self.applyWS(true); }],
      ['▭ Smaller timeline', function () { w.tlOpen = true; w.tl = Math.max(120, w.tl - 80); self.applyWS(true); }],
      '-',
      [(this.box.classList.contains('se-fs') ? '✕ Exit full screen' : '⛶ Full screen') + '  (F)', function () { self.fullScreen(); }],
      ['↺ Reset workspace', function () { self.ws = clone(WS_DEF); self.stageZoom = 0; self.applyWS(true); self.toast('Workspace reset ✓'); }]
    ]);
  };
  EP.ctxMenu = function (x, y, items) {
    var m = this.$('.se-ctx'); m.innerHTML = ''; m.hidden = false;
    items.forEach(function (it) {
      if (it === '-') { m.appendChild(h('hr')); return; }
      if (!it) return;
      var b = h('button', { type: 'button' }, E(it[0])); if (it[2] === false) b.disabled = true;
      b.addEventListener('click', function () { m.hidden = true; it[1](); });
      m.appendChild(b);
    });
    var br = this.box.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = clamp(x - br.left, 4, br.width - mw - 4) + 'px'; m.style.top = clamp(y - br.top, 4, Math.max(4, br.height - mh - 4)) + 'px';
  };

  /* =========================================================
     PROJECT + MEDIA
     ========================================================= */
  EP.load = function (P, fresh) {
    this.stop(); P = C.upgrade(P); this.P = P; this.sel = null; this.selKind = null; this.t = 0; this.an = null;
    Object.keys(this.vids).forEach(function (k) { try { this.vids[k].pause(); } catch (e) { } }, this); this.vids = {};
    this.hist = [JSON.stringify(P)]; this.hi = 0;
    this.$('.se-name').value = P.name || ''; this.$('[data-bpm]').value = P.bpm; this.$('[data-ratio]').value = P.ratio;
    var self = this;
    P.layers.forEach(function (l) { [l.font, l.accentFont].forEach(function (f) { if (f) { C.ensureFont(f, 400).then(function () { self.needs = true; }); C.ensureFont(f, 900).then(function () { self.needs = true; }); } }); });
    this.stageZoom = 0; this.sizeStage(); this.renderInspector(); this.renderTimeline(); this.renderPanel(); this.needs = true;
    if (!this.opts.builder) try { localStorage.setItem('sul.short.last', P.id); } catch (e) { }
    if (fresh) this.dirty = true;
    return this.loadMedia();
  };
  EP.loadMedia = function () {
    var self = this, P = this.P, jobs = [];
    Object.keys(P.media).forEach(function (id) {
      var m = P.media[id]; if (self.media[id] && self.media[id].ready) { if ((m.kind === 'audio' || m.kind === 'video') && !self.buffers[id] && self.media[id].blob) jobs.push(self.decodeBuf(id)); return; }
      jobs.push(self.fetchMedia(m, id).then(function (b) {
        if (!b) { console.warn('Missing media', id); self.media[id] = { kind: m.kind, missing: true }; return; }
        return self.registerBlob(id, m, b);
      }).catch(function (e) { console.warn('Media failed', id, e); }));
    });
    return Promise.all(jobs).then(function () { self.afterAudio(); self.renderTimeline(); self.renderPanel(); self.renderInspector(); self.needs = true; });
  };
  EP.fetchMedia = function (m, id) {
    var api = this.api;
    if (m.src) return fetch(api.asset ? api.asset(m.src) : m.src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); });
    if (this.opts.blobs && this.opts.blobs[id]) return Promise.resolve(this.opts.blobs[id]);
    return store.getBlob(id);
  };
  EP.registerBlob = function (id, m, blob) {
    var self = this, old = this.media[id]; if (old && old.url && old.own) URL.revokeObjectURL(old.url);
    var rec = this.media[id] = { kind: m.kind, url: URL.createObjectURL(blob), own: true, blob: blob };
    if (m.kind === 'image') return new Promise(function (res) { var im = new Image(); im.onload = function () { rec.el = im; rec.ready = true; rec.thumb = rec.url; if (!m.iw) { m.iw = im.naturalWidth; m.ih = im.naturalHeight; } self.needs = true; res(); }; im.onerror = function () { rec.bad = true; res(); }; im.src = rec.url; });
    if (m.kind === 'video') {
      return new Promise(function (res) {
        var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = rec.url;
        var done = false; function fin() { if (done) return; done = true; res(); }
        v.addEventListener('loadedmetadata', function () { m.dur = v.duration; m.iw = v.videoWidth; m.ih = v.videoHeight; try { v.currentTime = Math.min(0.2, v.duration / 2); } catch (e) { fin(); } });
        v.addEventListener('seeked', function () { if (!rec.thumb) { try { var c = C.mk(Math.round(64 * v.videoWidth / Math.max(1, v.videoHeight)), 64); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); rec.thumb = c.toDataURL('image/jpeg', 0.6); } catch (e) { } } rec.ready = true; self.renderTimelineSoon(); fin(); });
        v.addEventListener('error', function () { rec.bad = true; fin(); });
        setTimeout(fin, 8000);
        rec.probe = v;
      }).then(function () { return self.decodeBuf(id); });
    }
    if (m.kind === 'audio') return this.decodeBuf(id).then(function () { rec.ready = !!self.buffers[id]; });
    if (m.kind === 'midi') return blob.arrayBuffer().then(function (ab) { try { self.midis[id] = C.parseMidi(ab); rec.ready = true; } catch (e) { console.warn(e); rec.bad = e.message; } });
    if (m.kind === 'font') return blob.arrayBuffer().then(function (ab) { return C.addFontFace(m.family, ab).then(function () { rec.ready = true; self.needs = true; }).catch(function () { rec.bad = true; }); });
    rec.ready = true; return Promise.resolve();
  };
  EP.decodeBuf = function (id) {
    var self = this, rec = this.media[id], m = this.P.media[id]; if (!rec || !rec.blob) return Promise.resolve();
    return rec.blob.arrayBuffer().then(function (ab) {
      var ctx = self.ctx();
      return new Promise(function (res, rej) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    }).then(function (buf) { self.buffers[id] = buf; if (m && !m.dur) m.dur = buf.duration; if (m && m.kind === 'audio') m.dur = buf.duration; rec.peaks = peaksOf(buf); })
      .catch(function () { if (m && m.kind === 'audio') self.toast('Couldn\'t read “' + (m.name || 'audio') + '” — try MP3 or WAV', true); });
  };
  function peaksOf(buf) {
    var n = Math.min(20000, Math.max(200, Math.round(buf.duration * 100))), d = buf.getChannelData(0), per = Math.max(1, Math.floor(d.length / n)), out = new Float32Array(n), mx = 0;
    for (var i = 0; i < n; i++) { var m = 0, s0 = i * per; for (var k = 0; k < per; k += 8) { var a = Math.abs(d[s0 + k] || 0); if (a > m) m = a; } out[i] = m; if (m > mx) mx = m; }
    if (mx > 0) for (i = 0; i < n; i++) out[i] /= mx;
    return out;
  }
  // a layer's own <video> (each clip plays its own copy so trims/speeds never fight)
  EP.videoFor = function (el) {
    var v = this.vids[el.id], rec = this.media[el.media];
    if (!rec || !rec.url) return null;
    if (v && v._src !== rec.url) { try { v.pause(); } catch (e) { } v = null; }
    if (!v) {
      var self = this; v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v._src = rec.url; v.src = rec.url;
      v.addEventListener('loadeddata', function () { v._ok = true; self.needs = true; }); v.addEventListener('seeked', function () { self.needs = true; });
      this.vids[el.id] = v;
    }
    return v;
  };
  EP.mediaFn = function () {
    var self = this;
    return function (id, src, el) {
      if (el && el.type === 'video' && id) { var v = self.videoFor(el); return v && v._ok ? v : null; }
      if (id && self.media[id] && self.media[id].el) return self.media[id].el;
      if (src) {
        var k = 'url:' + src, r = self.media[k];
        if (!r) { r = self.media[k] = { kind: 'image' }; var im = new Image(); im.onload = function () { r.el = im; r.ready = true; self.needs = true; }; im.src = (self.api.asset && self.api.asset(src)) || src; }
        return r.el || null;
      }
      return null;
    };
  };
  function kindOf(file) {
    var type = file.type || '', name = file.name || '';
    if (/\.(midi?|kar)$/i.test(name) || /midi/.test(type)) return 'midi';
    if (/^image\//.test(type) || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(name)) return 'image';
    if (/^video\//.test(type) || /\.(mp4|mov|webm|m4v|mkv)$/i.test(name)) return 'video';
    if (/^audio\//.test(type) || /\.(mp3|wav|m4a|aac|ogg|oga|flac|aif|aiff|opus)$/i.test(name)) return 'audio';
    if (/\.(ttf|otf|woff2?)$/i.test(name) || /font/.test(type)) return 'font';
    return null;
  }
  U.kindOf = kindOf;
  // store a file in the project (doesn't place it)
  EP.importFile = function (file) {
    var self = this, P = this.P, name = file.name || 'file', kind = kindOf(file);
    if (!kind) { this.toast('Can\'t use that file type: ' + name, true); return Promise.resolve(null); }
    if (file.size > 400 * 1048576) { this.toast('That file is too big (max 400 MB)', true); return Promise.resolve(null); }
    var id = C.uid('m'), m = { id: id, name: name, kind: kind };
    if (kind === 'font') m.family = name.replace(/\.[^.]+$/, '').replace(/[^\w -]/g, '').slice(0, 30) || 'My font';
    P.media[id] = m;
    var keep = this.opts.builder ? (this.opts.blobs = this.opts.blobs || {}, this.opts.blobs[id] = file, Promise.resolve()) : store.putBlob(id, file).catch(function () { self.toast('Your browser storage is full — the file works now but won\'t be saved', true); });
    return keep.then(function () { return self.registerBlob(id, m, file); }).then(function () {
      if (kind === 'midi' && !self.midis[id]) { delete P.media[id]; self.toast('That MIDI file couldn\'t be read: ' + (self.media[id] && self.media[id].bad || ''), true); return null; }
      if ((kind === 'audio') && !self.buffers[id]) { delete P.media[id]; return null; }
      if (self.media[id] && self.media[id].bad && kind !== 'midi') { delete P.media[id]; self.toast('That file couldn\'t be opened: ' + name, true); return null; }
      return { id: id, kind: kind };
    });
  };
  // add files and put them where they belong
  EP.addFiles = function (files, at, target) {
    var self = this, list = [].slice.call(files || []), seq = Promise.resolve(), t = at && at.t != null ? at.t : this.t;
    list.forEach(function (f, i) { seq = seq.then(function () { return self.importFile(f).then(function (r) { if (r) return self.placeMedia(r.id, r.kind, { t: t, x: at && at.x, y: at && at.y }, i === 0 ? target : null); }); }); });
    return seq.then(function () { self.renderPanel(); });
  };
  EP.placeMedia = function (id, kind, at, target) {
    var P = this.P, m = P.media[id], t = at && at.t != null ? at.t : this.t, self = this;
    if (!m) return;
    if (kind === 'audio') {
      var first = !P.audio.length, st = first ? 0 : t, clip = { id: C.uid('au'), media: id, name: m.name, start: round(st, 3), in: 0, dur: round(m.dur || 10, 3), vol: 100, fadeIn: 0, fadeOut: 0, speed: 1 };
      if (!P.autoLength && P.layers.length && P.duration - st > 1) clip.dur = round(Math.min(clip.dur, P.duration - st), 3);
      P.audio.push(clip);
      if (first && P.autoLength === false && P.duration < m.dur && !P.layers.length) P.autoLength = true;
      this.select('audio', clip.id); this.changed({ audio: true, tl: true });
      this.toast(first ? 'Song added ✦ — press AUTO or TAP so the beat lines up' : 'Audio added ✦');
      if (first && P.midis.length === 0) this.detectBpm(true);
      return clip;
    }
    if (kind === 'midi') {
      var mm = this.midis[id]; if (!mm) return;
      P.midis.push({ id: id, name: m.name, mode: 'file', offset: 0, transpose: 0 });
      if (P.midis.length === 1 && !P.audio.length) this.setBpm(mm.bpm, true);
      var vis = P.layers.some(function (l) { return T[l.type] && T[l.type].midi; });
      if (!vis) { var pr = C.newElement('pianoroll', P, { start: 0, end: Math.max(P.duration, mm.duration) }); P.layers.push(pr); this.select('layer', pr.id); }
      this.changed({ tl: true, insp: true }); this.fitLength();
      this.toast('MIDI added: ' + mm.notes.length + ' notes · ' + mm.tracks.length + ' track(s) · ' + mm.bpm + ' BPM' + (vis ? '' : ' — added a piano roll for it'));
      return;
    }
    if (kind === 'font') { this.toast('Font added: “' + m.family + '” — pick it in any text'); this.changed(); if (this.selKind === 'layer' && this.cur() && this.cur().type === 'text') { this.cur().font = m.family; this.changed({ insp: true }); } return; }
    if (kind === 'image' || kind === 'video') {
      if (target && (target.type === 'image' || target.type === 'video')) return this.replaceInto(target, id, kind);
      var W = P.w, H = P.h, iw = m.iw || 1000, ih = m.ih || 1000, k = Math.min(W / iw, H / ih), full = kind === 'video';
      var w = full ? iw * k : Math.min(W * 0.7, iw * k), hh = w * ih / iw;
      var props = { media: id, name: m.name.replace(/\.[^.]+$/, '').slice(0, 30), start: round(t, 3), w: Math.round(w), h: Math.round(hh), fit: 'contain' };
      if (at && at.x != null) { props.x = at.x; props.y = at.y; }
      if (kind === 'video') { var dur = m.dur || 5; props.in = 0; props.srcDur = dur; props.end = round(t + dur, 3); props.vol = 100; props.fit = 'cover'; props.w = W; props.h = H; }
      else props.end = round(Math.max(t + 3, Math.min(P.duration, t + 5)), 3);
      var el = C.newElement(kind, P, props); P.layers.push(el);
      this.select('layer', el.id); this.changed({ tl: true, audio: kind === 'video' }); this.fitLength();
      return el;
    }
  };
  EP.replaceInto = function (el, id, kind) {
    var m = this.P.media[id];
    if (el.type !== kind) {
      // swap picture ↔ video keeping place, size, look and timing
      el.type = kind; Object.keys(T[kind].defaults).forEach(function (k) { if (el[k] == null) el[k] = clone(T[kind].defaults[k]); });
    }
    el.media = id; el.src = '';
    if (kind === 'video') { el.in = 0; el.srcDur = Math.min(m.dur || 5, (el.end - el.start) * C.avgSpeed(el)); if (el.vol == null) el.vol = 100; delete this.vids[el.id]; }
    this.select('layer', el.id); this.changed({ tl: true, insp: true, audio: kind === 'video' }); this.toast('Replaced ✓');
  };
  EP.useSiteAsset = function (a, at, target) {
    var self = this, kind = a.kind || (/\.(mp4|webm|mov|m4v)$/i.test(a.src) ? 'video' : /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.src) ? 'audio' : 'image');
    var found = null; Object.keys(this.P.media).forEach(function (id) { if (self.P.media[id].src === a.src) found = id; });
    var ready = found ? Promise.resolve(found) : (function () {
      var id = C.uid('m'), m = { id: id, name: a.name || a.src.split('/').pop(), kind: kind, src: a.src }; self.P.media[id] = m;
      self.toast('Loading ' + m.name + '…');
      return self.fetchMedia(m, id).then(function (b) { return self.registerBlob(id, m, b); }).then(function () { return id; }).catch(function (e) { delete self.P.media[id]; self.toast('Couldn\'t load that asset (' + (e.message || e) + ')', true); return null; });
    })();
    return ready.then(function (id) { if (id) return self.placeMedia(id, kind, at, target); });
  };
  EP.loadSiteFonts = function () {
    var self = this, list = ((this.cfg.editor || {}).fonts) || []; this.siteFonts = [];
    list.forEach(function (f) {
      if (!f || !f.src || f.enabled === false || !f.name) return;
      self.siteFonts.push(f.name);
      var url = (self.api.asset && self.api.asset(f.src)) || f.src;
      C.addFontFace(f.name, 'url("' + url.replace(/"/g, '%22') + '")').then(function () { self.needs = true; }).catch(function (e) { console.warn('font', f.name, e); });
    });
  };
  EP.fontList = function () {
    var P = this.P, mine = [];
    Object.keys(P.media || {}).forEach(function (id) { if (P.media[id].kind === 'font') mine.push(P.media[id].family); });
    return { mine: mine, site: this.siteFonts || [], free: C.FONTS };
  };

  /* ---------- MIDI notes for the visuals ---------- */
  EP.notes = function () {
    var P = this.P;
    var real = P.midis.filter(function (m) { return this.midis[m.id]; }, this);
    if (real.length) { if (this._nk !== this.noteKey()) { this._notes = C.midiNotes({ midis: real, bpm: P.bpm }, this.midis); this._nk = this.noteKey(); } return this._notes; }
    if (!this.demo || this.demo._bpm !== P.bpm) { this.demo = C.demoMidi(P.bpm); this.demo._bpm = P.bpm; this.midis.__demo = this.demo; }
    return C.midiNotes({ midis: [{ id: '__demo', mode: 'project', offset: P.beatOffset || 0 }], bpm: P.bpm }, this.midis);
  };
  EP.noteKey = function () { var P = this.P; return P.bpm + '|' + P.midis.map(function (m) { return [m.id, m.mode, m.offset, m.transpose, !!this.midis[m.id]].join(','); }, this).join(';'); };
  EP.usingDemo = function () { var self = this; return !this.P.midis.some(function (m) { return self.midis[m.id]; }); };

  /* ---------- bpm ---------- */
  EP.setBpm = function (v, quiet) { v = clamp(+v || 120, 40, 300); this.P.bpm = round(v, 2); this.$('[data-bpm]').value = this.P.bpm; this.changed({ tl: true }); if (!quiet && this.tab === 'audio') this.renderPanel(); };
  EP.detectBpm = function (quiet) {
    var self = this, c = this.P.audio[0];
    if (!c || !this.buffers[c.media]) { if (!quiet) this.toast('Add a song first (🎵 Audio & MIDI)', true); return; }
    if (!quiet) this.toast('Listening…');
    setTimeout(function () {
      var an = new C.Analysis(self.buffers[c.media]), r = an.detectBPM(), spb = 60 / r.bpm;
      var off = ((r.offset - (c.in || 0)) / (c.speed || 1) + c.start) % spb; if (off < 0) off += spb; self.P.bpm = r.bpm; self.P.beatOffset = round(off, 3);
      self.$('[data-bpm]').value = r.bpm; self.changed({ tl: true }); if (self.tab === 'audio' || self.tab === 'canvas') self.renderPanel();
      self.toast('Detected ' + r.bpm + ' BPM — if it feels off, use TAP or type it');
    }, 30);
  };

  /* ---------- length ---------- */
  EP.fitLength = function () {
    var P = this.P, e = C.contentEnd(P), old = P.duration;
    if (P.autoLength) {
      // things that lasted to the old end keep lasting to the end (e.g. visuals when a longer song is added)
      var n = round(Math.max(1, e || 5), 3);
      if (n > old + 0.01) { P.layers.forEach(function (l) { if (Math.abs(l.end - old) < 0.02 && l.type !== 'video') l.end = n; }); e = C.contentEnd(P); n = round(Math.max(1, e || 5), 3); }
      P.duration = n;
    }
    else if (e > P.duration + 0.001) P.duration = round(e, 3);
    if (this.t > P.duration) this.t = P.duration;
  };

  /* ---------- ratio (video shape) ---------- */
  EP.setRatio = function (r) {
    var P = this.P, d = C.ratioDims(r), ow = P.w, oh = P.h, kx = d[0] / ow, ky = d[1] / oh, k = Math.min(kx, ky);
    if (r === P.ratio && ow === d[0]) return;
    P.layers.forEach(function (l) {
      var full = Math.abs(l.w - ow) < 2 && Math.abs(l.h - oh) < 2;
      l.x = round(l.x * kx, 1); l.y = round(l.y * ky, 1);
      if (full || l.type === 'adjust') { l.w = d[0]; l.h = d[1]; } else { l.w = round(l.w * k, 1); l.h = round(l.h * k, 1); }
      if (l.kf) { (l.kf.x || []).forEach(function (q) { q.v = round(q.v * kx, 1); }); (l.kf.y || []).forEach(function (q) { q.v = round(q.v * ky, 1); }); }
    });
    P.ratio = r; P.w = d[0]; P.h = d[1]; this.$('[data-ratio]').value = r;
    this.stageZoom = 0; this.sizeStage(); this.changed({ insp: true }); if (this.tab === 'canvas') this.renderPanel();
    this.toast('Video shape: ' + r);
  };

  /* =========================================================
     HISTORY
     ========================================================= */
  // o: { quiet (no re-render of inspector), tl (re-render timeline), insp (re-render inspector), audio (remix + reschedule) }
  EP.changed = function (o) {
    o = o || {}; var self = this; this.dirty = true; this.needs = true; this._nk = null;
    clearTimeout(this.histT);
    if ((o.tl || o.audio) && !o.quiet) { this.commitNow(); }
    else
    this.histT = setTimeout(function () { if (self.P) self.commitNow(); }, 300);
    if (o.tl || o.audio) { this.fitLength(); this.renderTimeline(); }
    if (o.insp) this.renderInspector();
    if (o.audio) this.afterAudio();
    this.syncSel();
  };
  EP.afterAudio = function () {
    var self = this; clearTimeout(this.mixT);
    this.mixT = setTimeout(function () {
      if (!self.P || self.dead) return;
      var key = JSON.stringify([self.P.audio, self.P.layers.filter(function (l) { return l.type === 'video'; }).map(function (l) { return [l.media, l.start, l.end, l.in, l.srcDur, l.speed, l.vol, l.hidden, l.fadeIn, l.fadeOut, l.curve]; }), Object.keys(self.buffers).length, self.P.duration]);
      if (key === self.mixKey) return; self.mixKey = key;
      var srcs = C.audioSources(self.P, self.buffers);
      if (!srcs.length) { self.an = null; self.needs = true; return; }
      C.renderMix(self.P, self.buffers, 22050).then(function (buf) { if (buf && key === self.mixKey) { self.an = new C.Analysis(buf); self.needs = true; } }).catch(function (e) { console.warn('mix', e); });
    }, 350);
    if (this.playing) { this.stop(true); this.play(); }
  };
  EP.restore = function (j) {
    var keep = this.t; this.P = JSON.parse(j); this.t = clamp(keep, 0, this.P.duration); this._nk = null;
    if (this.selKind === 'layer' && !this.cur()) this.select(null);
    if (this.selKind === 'audio' && !this.curAudio()) this.select(null);
    this.$('.se-name').value = this.P.name || ''; this.$('[data-bpm]').value = this.P.bpm; this.$('[data-ratio]').value = this.P.ratio;
    this.sizeStage(); this.renderInspector(); this.renderTimeline(); this.syncSel(); this.afterAudio(); this.needs = true; this.dirty = true;
    if (this.tab === 'replace' || this.tab === 'audio' || this.tab === 'canvas') this.renderPanel();
  };
  EP.commitNow = function () { clearTimeout(this.histT); var j = JSON.stringify(this.P); if (j !== this.hist[this.hi]) { this.hist = this.hist.slice(0, this.hi + 1); this.hist.push(j); if (this.hist.length > 120) this.hist.shift(); this.hi = this.hist.length - 1; } };
  EP.undo = function () { this.commitNow(); if (this.hi > 0) { this.hi--; this.restore(this.hist[this.hi]); this.toast('Undo'); } };
  EP.redo = function () { if (this.hi < this.hist.length - 1) { this.hi++; this.restore(this.hist[this.hi]); this.toast('Redo'); } };

  /* ---------- selection ---------- */
  EP.find = function (id) { var L = this.P.layers; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; };
  EP.cur = function () { return this.selKind === 'layer' ? this.find(this.sel) : null; };
  EP.curAudio = function () { var id = this.sel; return this.selKind === 'audio' ? this.P.audio.filter(function (a) { return a.id === id; })[0] || null : null; };
  EP.curTr = function () { var id = this.sel; return this.selKind === 'tr' ? this.P.transitions.filter(function (a) { return a.id === id; })[0] || null : null; };
  EP.select = function (kind, id) {
    var changed = kind !== this.selKind || id !== this.sel;
    this.selKind = kind || null; this.sel = kind ? id : null;
    if (changed) {
      var el = this.cur();
      if (el && el.type === 'adjust') this.insTab = 'fx';
      else if (el && T[el.type] && T[el.type].midi && (this.insTab === 'edit' || this.insTab === 'speed' || !this._midiSeen)) { this.insTab = 'midi'; this._midiSeen = true; }
      else if (kind === 'audio') { if (this.insTab !== 'speed') this.insTab = 'edit'; }
      else if (this.insTab === 'speed' && !(el && el.type === 'video')) this.insTab = 'edit';
    }
    if (kind && !this.ws.rightOpen) { this.ws.rightOpen = true; this.applyWS(true); }
    this.renderInspector(); this.markTimelineSel(); this.syncSel(); this.needs = true;
  };

  /* =========================================================
     STAGE: size, render loop, playback
     ========================================================= */
  EP.fitK = function () { var box = this.$('.se-stagebox'), P = this.P; var k = Math.min((box.clientWidth - 24) / P.w, (box.clientHeight - 24) / P.h); return k > 0 ? k : 0.25; };
  EP.setStageZoom = function (d) {
    var fit = this.fitK(), cur = this.stageK || fit;
    this.stageZoom = d === 0 ? 0 : clamp(cur * (d > 0 ? 1.25 : 0.8), fit * 0.25, 4);
    if (this.stageZoom && Math.abs(this.stageZoom - fit) < fit * 0.05) this.stageZoom = 0;
    this.sizeStage();
  };
  EP.sizeStage = function () {
    if (!this.P) return;
    var P = this.P, k = this.stageZoom || this.fitK(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.stageK = k;
    var cw = Math.max(40, Math.round(P.w * k)), ch = Math.max(40, Math.round(P.h * k));
    this.wrap.style.width = cw + 'px'; this.wrap.style.height = ch + 'px';
    this.$('.se-stagebox').classList.toggle('zoomed', !!this.stageZoom);
    var q = Math.min(1, cw * dpr / P.w * (this.quality / 0.6)), W = Math.max(64, Math.round(P.w * Math.min(1, q))), H = Math.round(W * P.h / P.w);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    var zv = this.$('.se-zv'); if (zv) zv.textContent = this.stageZoom ? Math.round(k * 100) + '%' : 'FIT';
    this.needs = true; this.syncSel();
  };
  EP.frame = function (cv, t, edit) {
    C.renderFrame(cv, this.P, { t: t, P: this.P, notes: this.notes(), an: this.an, media: this.mediaFn(), edit: edit });
  };
  EP.loop_ = function () {
    var self = this;
    var tick = function () {
      if (self.dead) return;
      self.raf = requestAnimationFrame(tick);
      if (!self.P || self.exporting) return;
      if (self.playing) {
        var t = self.clock();
        if (t >= self.P.duration || (self.playUntil && t >= self.playUntil)) {
          if (self.loopOn && !self.playUntil) { self.stop(true); self.t = 0; self.play(); return; }
          var back = self.playUntil ? self.playFrom : null; self.stop(); self.t = back != null ? back : self.P.duration; self.playUntil = null; self.needs = true;
        } else self.t = t;
        self.syncVideos(self.t, self.playing); self.needs = true;
      }
      if (self.needs) {
        self.needs = false;
        try { self.frame(self.cv, Math.min(self.t, self.P.duration - 1e-4), true); } catch (e) { console.error(e); }
        self.updatePlayhead(); self.$('.se-time').textContent = fmt(self.t) + ' / ' + fmt(self.P.duration);
        if (self.selKind === 'layer') self.syncSel();
        if (self.liveInsp) self.liveInsp();
      }
    };
    tick();
  };
  EP.ctx = function () {
    if (!this.ac || this.ac.state === 'closed') { var AC = window.AudioContext || window.webkitAudioContext; this.ac = new AC({ latencyHint: 'interactive' }); this.master = this.ac.createGain(); this.master.connect(this.ac.destination); }
    return this.ac;
  };
  EP.clock = function () { return this.playing ? this.t0 + (this.ac.currentTime - this.t0ctx) : this.t; };
  EP.play = function () {
    if (this.playing || !this.P) return;
    var ac = this.ctx(); if (ac.state === 'suspended') ac.resume();
    if (this.t >= this.P.duration - 0.02) this.t = 0;
    this.t0 = this.t; this.t0ctx = ac.currentTime + 0.06; this.playing = true;
    this.nodes = C.scheduleAudio(ac, this.master, C.audioSources(this.P, this.buffers), this.t0, this.t0ctx);
    if (this.click) this.scheduleClicks();
    this.$('[data-play]').textContent = '❚❚'; this.$('[data-play]').classList.add('on');
  };
  EP.scheduleClicks = function () {
    var ac = this.ac, P = this.P, spb = 60 / P.bpm, self = this, next = Math.ceil((this.t0 - (P.beatOffset || 0)) / spb);
    clearInterval(this.clickT);
    var sched = function () {
      if (!self.playing) return clearInterval(self.clickT);
      var now = self.clock();
      while ((P.beatOffset || 0) + next * spb < now + 0.25) {
        var bt = (P.beatOffset || 0) + next * spb; if (bt >= now - 0.01 && bt < P.duration) {
          var o = ac.createOscillator(), g = ac.createGain(), at = self.t0ctx + bt - self.t0;
          o.frequency.value = next % 4 === 0 ? 1600 : 1000; g.gain.setValueAtTime(0.25, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
          o.connect(g); g.connect(self.master); o.start(at); o.stop(at + 0.06); self.nodes.push(o);
        }
        next++;
      }
    };
    sched(); this.clickT = setInterval(sched, 100);
  };
  EP.stop = function (keepTime) {
    if (!this.playing) return;
    var t = this.clock(); this.playing = false; clearInterval(this.clickT);
    this.nodes.forEach(function (n) { try { n.stop(); } catch (e) { } try { n.disconnect(); } catch (e) { } }); this.nodes = [];
    if (!keepTime) this.t = clamp(t, 0, this.P ? this.P.duration : 0);
    var self = this; Object.keys(this.vids).forEach(function (k) { try { self.vids[k].pause(); } catch (e) { } });
    var b = this.$('[data-play]'); if (b) { b.textContent = '▶'; b.classList.remove('on'); }
    this.syncVideos(this.t, false); this.needs = true;
  };
  EP.toggle = function () { if (this.playing) this.stop(); else { this.playUntil = null; this.play(); } };
  EP.seek = function (t) { var was = this.playing && !this.playUntil; if (this.playing) this.stop(true); this.playUntil = null; this.t = clamp(t, 0, this.P.duration); this.syncVideos(this.t, false); if (was) this.play(); this.needs = true; if (this.insp && this.selKind === 'layer') this.refreshKfMarks(); };
  EP.step = function (n) { this.stop(); this.seek(round((Math.round(this.t * this.P.fps) + n) / this.P.fps, 4)); };
  EP.preview = function (from, to) { this.stop(); this.t = clamp(from, 0, this.P.duration); this.playFrom = this.t; this.playUntil = Math.min(to, this.P.duration); this.play(); };
  EP.syncVideos = function (t, playing) {
    if (!this.P) return;
    var self = this;
    this.P.layers.forEach(function (el) {
      if (el.type !== 'video' || !el.media) return;
      var v = self.vids[el.id]; var on = !el.hidden && t >= el.start - 0.5 && t < el.end;
      if (!v) { if (on) v = self.videoFor(el); if (!v) return; }
      if (!v._ok && v.readyState < 1) return;
      var src = C.srcTime(el, clamp(t, el.start, el.end)), inside = t >= el.start && t < el.end;
      if (playing && inside) {
        var rate = clamp(C.speedAt(el, (t - el.start) / Math.max(1e-3, el.end - el.start)), 0.07, 16);
        if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate;
        if (Math.abs(v.currentTime - src) > 0.25 * Math.max(1, rate)) { try { v.currentTime = src; } catch (e) { } }
        if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () { }); }
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - src) > 0.02 && !v.seeking) { try { v.currentTime = src; } catch (e) { } }
      }
    });
  };

  /* =========================================================
     STAGE INTERACTION
     ========================================================= */
  EP.toProj = function (cx, cy) { var r = this.wrap.getBoundingClientRect(); return { x: (cx - r.left) / r.width * this.P.w, y: (cy - r.top) / r.height * this.P.h }; };
  EP.geo = function (el) { var t = this.t; return { x: C.prop(el, 'x', t), y: C.prop(el, 'y', t), s: C.prop(el, 'scale', t) / 100, r: C.prop(el, 'rot', t) * Math.PI / 180, w: el.w, h: el.h }; };
  EP.hit = function (px, py) {
    var L = this.P.layers, t = this.t;
    for (var i = L.length - 1; i >= 0; i--) {
      var el = L[i]; if (el.hidden || el.locked || el.type === 'adjust' || t < el.start || t >= el.end) continue;
      var g = this.geo(el), dx = px - g.x, dy = py - g.y, c = Math.cos(-g.r), s = Math.sin(-g.r), lx = (dx * c - dy * s) / (g.s || 1), ly = (dx * s + dy * c) / (g.s || 1);
      if (Math.abs(lx) <= el.w / 2 && Math.abs(ly) <= el.h / 2) return el;
    }
    return null;
  };
  EP.setProp = function (el, k, v, t) {
    t = t == null ? this.t : t;
    var list = el.kf && el.kf[k];
    if (list && list.length) {
      var lt = round(clamp(t - el.start, 0, el.end - el.start), 4), tol = 0.5 / (this.P.fps || 30);
      for (var i = 0; i < list.length; i++) if (Math.abs(list[i].t - lt) <= tol) { list[i].v = v; return; }
      list.push({ t: lt, v: v, e: 'smooth' }); list.sort(function (a, b) { return a.t - b.t; });
    } else el[k] = v;
  };
  EP.syncSel = function () {
    var el = this.cur(), b = this.selBox;
    if (!el || el.hidden || el.type === 'adjust' || this.t < el.start || this.t >= el.end || !this.P) { b.hidden = true; return; }
    var g = this.geo(el), k = this.stageK || 1, w = Math.abs(el.w * g.s * k), hh = Math.abs(el.h * g.s * k);
    b.hidden = false; b.classList.toggle('locked', !!el.locked);
    b.style.width = w + 'px'; b.style.height = hh + 'px'; b.style.left = (g.x * k - w / 2) + 'px'; b.style.top = (g.y * k - hh / 2) + 'px'; b.style.transform = 'rotate(' + g.r + 'rad)';
  };
  EP.bindStage = function () {
    var self = this, wrap = this.wrap, guides = this.$('.se-guides');
    wrap.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !self.P) return;
      var hd = e.target.getAttribute && e.target.getAttribute('data-h'), p = self.toProj(e.clientX, e.clientY);
      var el = hd ? self.cur() : self.hit(p.x, p.y);
      if (!el) { self.select(null); return; }
      if (!hd && (self.selKind !== 'layer' || self.sel !== el.id)) self.select('layer', el.id);
      if (el.locked) { self.toast('This layer is locked — unlock it in the timeline 🔒'); return; }
      e.preventDefault(); wrap.setPointerCapture(e.pointerId);
      var g0 = self.geo(el), w0 = el.w, h0 = el.h, a0 = Math.atan2(p.y - g0.y, p.x - g0.x), d0 = Math.hypot(p.x - g0.x, p.y - g0.y) || 1, moved = false;
      function mv(ev) {
        var q = self.toProj(ev.clientX, ev.clientY), dx = q.x - p.x, dy = q.y - p.y; if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return; moved = true;
        var snapD = 14 / (self.stageK || 1), gx = false, gy = false;
        if (!hd) {
          var nx = g0.x + dx, ny = g0.y + dy;
          if (!ev.altKey) { if (Math.abs(nx - self.P.w / 2) < snapD) { nx = self.P.w / 2; gx = true; } if (Math.abs(ny - self.P.h / 2) < snapD) { ny = self.P.h / 2; gy = true; } }
          self.setProp(el, 'x', round(nx, 1)); self.setProp(el, 'y', round(ny, 1));
        } else if (hd === 'rot') {
          var a = Math.atan2(q.y - g0.y, q.x - g0.x), deg = (g0.r + a - a0) * 180 / Math.PI;
          if (ev.shiftKey) deg = Math.round(deg / 15) * 15; else { var near = Math.round(deg / 90) * 90; if (Math.abs(deg - near) < 3) deg = near; }
          self.setProp(el, 'rot', round(deg, 1));
        } else if (hd.length === 2) {
          var d = Math.hypot(q.x - g0.x, q.y - g0.y); self.setProp(el, 'scale', round(clamp(g0.s * d / d0 * 100, 1, 2000), 1));
        } else {
          var c = Math.cos(-g0.r), s = Math.sin(-g0.r), lx = (dx * c - dy * s) / (g0.s || 1), ly = (dx * s + dy * c) / (g0.s || 1);
          if (hd === 'e') el.w = round(Math.max(4, w0 + lx * 2), 1); if (hd === 'w') el.w = round(Math.max(4, w0 - lx * 2), 1);
          if (hd === 's') el.h = round(Math.max(4, h0 + ly * 2), 1); if (hd === 'n') el.h = round(Math.max(4, h0 - ly * 2), 1);
        }
        guides.classList.toggle('x', gx); guides.classList.toggle('y', gy);
        self.needs = true; self.syncSel(); if (self.liveInsp) self.liveInsp();
      }
      function up() { wrap.removeEventListener('pointermove', mv); wrap.removeEventListener('pointerup', up); wrap.removeEventListener('pointercancel', up); guides.className = 'se-guides'; if (moved) { self.changed({ insp: true }); self.renderTimeline(); } }
      wrap.addEventListener('pointermove', mv); wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    });
    wrap.addEventListener('dblclick', function (e) { var p = self.toProj(e.clientX, e.clientY), el = self.hit(p.x, p.y); if (el && el.type === 'text') { self.select('layer', el.id); self.insTab = 'edit'; self.renderInspector(); var ta = self.insp.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } } });
    wrap.addEventListener('contextmenu', function (e) { var p = self.toProj(e.clientX, e.clientY), el = self.hit(p.x, p.y); if (!el) return; e.preventDefault(); self.select('layer', el.id); self.layerMenu(el, e.clientX, e.clientY); });
    // drops: files, assets, effects, animations
    var box = this.$('.se-stagebox'), dropT;
    box.addEventListener('dragover', function (e) { e.preventDefault(); wrap.classList.add('dragging'); clearTimeout(dropT); dropT = setTimeout(function () { wrap.classList.remove('dragging'); }, 200); });
    box.addEventListener('drop', function (e) {
      e.preventDefault(); wrap.classList.remove('dragging');
      var p = self.toProj(e.clientX, e.clientY), target = self.hit(p.x, p.y), inside = p.x >= 0 && p.y >= 0 && p.x <= self.P.w && p.y <= self.P.h, at = { t: self.t, x: inside ? round(p.x) : null, y: inside ? round(p.y) : null };
      self.handleDrop(e.dataTransfer, at, target);
    });
  };
  // shared by stage + timeline drops
  EP.handleDrop = function (dt, at, target) {
    var d;
    if (dt.files && dt.files.length) return this.addFiles(dt.files, at, target && (target.type === 'image' || target.type === 'video') && target.replaceable ? target : null);
    try { d = JSON.parse(dt.getData('application/x-sul') || dt.getData('text/plain') || 'null'); } catch (e) { d = null; }
    if (!d || !d.what) return;
    if (d.what === 'fx') return this.applyFx(d.type, target);
    if (d.what === 'anim') { if (!target) return this.toast('Drop the animation onto a clip or something in the video', true); return this.applyAnim(target, d.slot, d.type); }
    if (d.what === 'trans') return this.addTransition(d.type, at.t);
    if (d.what === 'asset') return this.useSiteAsset(d, at, target && target.replaceable ? target : null);
    if (d.what === 'media') return this.placeMedia(d.id, d.kind, at, target && target.replaceable ? target : null);
    if (d.what === 'el') return this.addElement(d.type, d.props, at);
    if (d.what === 'texture') return this.addTexture(d, at.t);
  };
  EP.addElement = function (type, props, at) {
    var P = this.P, t = at && at.t != null ? at.t : this.t, el = C.newElement(type, P, Object.assign({ start: round(t >= P.duration - 0.2 ? 0 : t, 3) }, clone(props || {})));
    el.end = round(Math.max(el.start + 1, type === 'adjust' ? Math.min(P.duration, el.start + Math.max(3, P.duration - el.start)) : (P.duration - el.start < 1 ? el.start + 5 : P.duration)), 3);
    if (at && at.x != null && type !== 'adjust' && !(props && props.x != null)) { el.x = at.x; el.y = at.y; }
    P.layers.push(el); (el.font ? C.ensureFont(el.font, el.weight || 400) : Promise.resolve()).then(this.redraw.bind(this));
    this.select('layer', el.id); this.changed({ tl: true }); this.showIn(el);
    return el;
  };
  EP.redraw = function () { this.needs = true; };
  EP.showIn = function (el) { // make sure the new thing is visible at the playhead
    if (this.t < el.start || this.t >= el.end) this.seek(el.start);
    var A = el.anim && el.anim.in; if (A && A.type !== 'none' && this.t - el.start < (A.dur || 0.5)) this.seek(Math.min(el.end - 0.01, el.start + (A.dur || 0.5) + 0.05));
  };
  EP.addTexture = function (d, t) {
    var P = this.P, el = C.newElement('image', P, { name: 'Texture: ' + (d.name || ''), src: d.builtin ? '' : d.src, fit: 'cover', w: P.w, h: P.h, opacity: 50, blend: 'overlay', start: 0, end: P.duration });
    if (d.builtin && window.PixFX) { var c = PixFX.builtinTexture(d.builtin, 1024, 1024), self = this; c.toBlob(function (b) { var f = new File([b], (d.name || 'texture') + '.png', { type: 'image/png' }); self.importFile(f).then(function (r) { if (r) { el.media = r.id; self.changed(); } }); }); }
    P.layers.push(el); this.select('layer', el.id); this.changed({ tl: true }); this.toast('Texture layer added — change its blend and opacity on the right');
  };
  EP.applyFx = function (type, target) {
    var fx = { id: C.uid('fx'), type: type, p: C.fxDefaults(type), mix: 100, on: true, beat: false, every: 1 };
    if (!target) { var a = this.addElement('adjust', { name: 'Adjust: ' + C.FX[type].name, fx: [fx] }, { t: this.t }); this.insTab = 'fx'; this.renderInspector(); this.toast('Adjustment layer added — it changes everything under it. Drag its ends to choose when'); return a; }
    target.fx = target.fx || []; target.fx.push(fx);
    this.select('layer', target.id); this.insTab = 'fx'; this.renderInspector(); this.changed({ tl: true });
    this.toast(C.FX[type].name + ' added to ' + (target.name || T[target.type].label));
  };
  EP.applyAnim = function (el, slot, type) {
    var A = el.anim; A[slot] = A[slot] || {}; A[slot].type = type;
    if (slot === 'loop') { if (A.loop.amt == null) A.loop.amt = 1; } else if (!A[slot].dur) A[slot].dur = slot === 'in' ? 0.5 : 0.4;
    this.select('layer', el.id); this.insTab = 'anim'; this.renderInspector(); this.changed({ tl: true });
    if (type !== 'none') { var len = slot === 'loop' ? 2 : (A[slot].dur || 0.5) + 0.4; this.preview(slot === 'out' ? Math.max(el.start, el.end - len) : el.start, slot === 'out' ? el.end : Math.min(el.end, el.start + len)); }
  };
  EP.addTransition = function (type, t) {
    var P = this.P; t = t == null ? this.t : t;
    var tr = { id: C.uid('tr'), t: round(clamp(t, 0, P.duration), 3), type: type || 'flash', dur: 0.4, color: '#ffffff' };
    P.transitions.push(tr); this.select('tr', tr.id); this.changed({ tl: true }); this.preview(Math.max(0, tr.t - 0.6), tr.t + 0.6);
  };

  /* =========================================================
     EDIT ACTIONS (split, delete, duplicate, keyframe, order)
     ========================================================= */
  EP.action = function (a) {
    var el = this.cur(), au = this.curAudio(), self = this;
    if (a === 'text') return this.addElement('text', { text: 'YOUR TEXT' }, { t: this.t });
    if (a === 'adjust') { var adj = this.addElement('adjust', { name: 'Adjustment layer' }, { t: this.t }); this.insTab = 'fx'; this.renderInspector(); this.toast('Adjustment layer: drag effects onto it — they change everything under it'); return adj; }
    if (a === 'trans') return this.addTransition('flash');
    if (a === 'split') {
      if (el) return this.splitLayer(el, this.t);
      if (au) return this.splitAudio(au, this.t);
      // nothing selected: split every clip under the playhead
      var any = false; this.P.layers.slice().forEach(function (l) { if (!l.locked && self.t > l.start + 0.02 && self.t < l.end - 0.02) { self.splitLayer(l, self.t, true); any = true; } });
      if (!any) this.toast('Move the playhead over a clip, select it, then split', true); else this.changed({ tl: true, audio: true });
      return;
    }
    if (a === 'del') return this.deleteSel();
    if (a === 'dup') return this.duplicateSel();
    if (a === 'kf') { if (!el) return this.toast('Select something first, then add a keyframe', true); return this.toggleKeyframe(el); }
  };
  EP.splitLayer = function (el, t, batch) {
    if (t <= el.start + 0.02 || t >= el.end - 0.02) { if (!batch) this.toast('Put the playhead inside the clip to split it', true); return; }
    var b = clone(el), cut = t - el.start; b.id = C.uid('el'); b.start = round(t, 4);
    if (el.type === 'video') {
      var s = C.srcTime(el, t), endSrc = (el.in || 0) + (el.srcDur || 0);
      if (el.curve && el.curve.length > 1) { el.curve = null; b.curve = null; if (!batch) this.toast('The speed curve became a steady speed on both parts'); }
      el.srcDur = round(s - (el.in || 0), 4); b.in = round(s, 4); b.srcDur = round(endSrc - s, 4);
      el.speed = round(el.srcDur / Math.max(0.01, cut), 4); b.speed = round(b.srcDur / Math.max(0.01, el.end - t), 4);
    }
    el.end = round(t, 4);
    Object.keys(b.kf || {}).forEach(function (k) { b.kf[k] = b.kf[k].map(function (q) { return { t: round(q.t - cut, 4), v: q.v, e: q.e }; }); });
    el.anim.out.type = 'none'; b.anim.in.type = 'none';
    var i = this.P.layers.indexOf(el); this.P.layers.splice(i + 1, 0, b);
    if (!batch) { this.select('layer', b.id); this.changed({ tl: true, audio: el.type === 'video' }); }
  };
  EP.splitAudio = function (c, t) {
    var len = c.dur / (c.speed || 1);
    if (t <= c.start + 0.02 || t >= c.start + len - 0.02) return this.toast('Put the playhead inside the audio clip to split it', true);
    var cut = (t - c.start) * (c.speed || 1), b = clone(c); b.id = C.uid('au'); b.start = round(t, 4); b.in = round((c.in || 0) + cut, 4); b.dur = round(c.dur - cut, 4); b.fadeIn = 0;
    c.dur = round(cut, 4); c.fadeOut = 0;
    this.P.audio.splice(this.P.audio.indexOf(c) + 1, 0, b); this.select('audio', b.id); this.changed({ tl: true, audio: true });
  };
  EP.deleteSel = function () {
    var P = this.P, id = this.sel;
    if (this.selKind === 'layer') { var el = this.cur(); if (!el) return; P.layers.splice(P.layers.indexOf(el), 1); delete this.vids[el.id]; this.select(null); this.changed({ tl: true, audio: el.type === 'video' }); this.toast('Deleted (Ctrl+Z to undo)'); return; }
    if (this.selKind === 'audio') { P.audio = P.audio.filter(function (a) { return a.id !== id; }); this.select(null); this.changed({ tl: true, audio: true }); return; }
    if (this.selKind === 'tr') { P.transitions = P.transitions.filter(function (a) { return a.id !== id; }); this.select(null); this.changed({ tl: true }); return; }
    if (this.selKind === 'midi') { P.midis = P.midis.filter(function (a) { return a.id !== id; }); this.select(null); this.changed({ tl: true }); this.renderPanel(); return; }
    this.toast('Select a clip first', true);
  };
  EP.duplicateSel = function () {
    var P = this.P;
    if (this.selKind === 'layer') {
      var el = this.cur(); if (!el) return; var b = clone(el), len = el.end - el.start; b.id = C.uid('el'); b.name = (el.name || '') + ' copy';
      b.start = round(el.end, 4); b.end = round(el.end + len, 4); P.layers.splice(P.layers.indexOf(el) + 1, 0, b);
      this.select('layer', b.id); this.changed({ tl: true, audio: el.type === 'video' }); this.seek(b.start); return;
    }
    if (this.selKind === 'audio') { var c = this.curAudio(); if (!c) return; var d = clone(c); d.id = C.uid('au'); d.start = round(c.start + c.dur / (c.speed || 1), 4); P.audio.push(d); this.select('audio', d.id); this.changed({ tl: true, audio: true }); return; }
    this.toast('Select a clip first', true);
  };
  EP.kfAt = function (el, k) { var lt = this.t - el.start, tol = 0.5 / (this.P.fps || 30), l = el.kf && el.kf[k] || []; for (var i = 0; i < l.length; i++) if (Math.abs(l[i].t - lt) <= tol) return i; return -1; };
  EP.toggleKeyframe = function (el, onlyKey) {
    if (this.t < el.start || this.t > el.end) { this.toast('Move the playhead over this clip first', true); return; }
    var keys = onlyKey ? [onlyKey] : C.KF_PROPS.map(function (p) { return p[0]; }), self = this, has = keys.some(function (k) { return self.kfAt(el, k) >= 0; });
    el.kf = el.kf || {};
    keys.forEach(function (k) {
      var i = self.kfAt(el, k), list = el.kf[k] = el.kf[k] || [];
      if (has) { if (i >= 0) { var v = list[i].v; list.splice(i, 1); if (!list.length) { el[k] = v; delete el.kf[k]; } } }
      else { var cur = C.prop(el, k, self.t); list.push({ t: round(self.t - el.start, 4), v: cur, e: 'smooth' }); list.sort(function (a, b) { return a.t - b.t; }); }
    });
    this.changed({ tl: true, insp: true }); this.toast(has ? 'Keyframe removed' : 'Keyframe added ◆ — move the playhead, then move/resize/rotate to animate');
  };
  EP.moveLayer = function (el, how) {
    var L = this.P.layers, i = L.indexOf(el); if (i < 0) return; L.splice(i, 1);
    var j = how === 'front' ? L.length : how === 'back' ? 0 : how === 'up' ? Math.min(L.length, i + 1) : Math.max(0, i - 1);
    L.splice(j, 0, el); this.changed({ tl: true });
  };
  EP.layerMenu = function (el, x, y) {
    var self = this, clip = this.copiedFx;
    this.ctxMenu(x, y, [
      ['✂ Split at playhead  (S)', function () { self.splitLayer(el, self.t); }],
      ['⧉ Duplicate  (Ctrl+D)', function () { self.select('layer', el.id); self.duplicateSel(); }],
      ['◆ Keyframe here  (K)', function () { self.toggleKeyframe(el); }],
      ['🗑 Delete  (Del)', function () { self.select('layer', el.id); self.deleteSel(); }],
      '-',
      ['⬆ Bring to front', function () { self.moveLayer(el, 'front'); }], ['↑ Bring forward', function () { self.moveLayer(el, 'up'); }], ['↓ Send backward', function () { self.moveLayer(el, 'down'); }], ['⬇ Send to back', function () { self.moveLayer(el, 'back'); }],
      '-',
      [(el.hidden ? '👁 Show' : '🙈 Hide'), function () { el.hidden = !el.hidden; self.changed({ tl: true, audio: el.type === 'video' }); }],
      [(el.locked ? '🔓 Unlock' : '🔒 Lock'), function () { el.locked = !el.locked; self.changed({ tl: true }); }],
      ['✨ Copy effects', function () { self.copiedFx = clone(el.fx || []); self.toast('Effects copied'); }, !!(el.fx && el.fx.length)],
      ['✨ Paste effects', function () { el.fx = (el.fx || []).concat(clip.map(function (f) { f = clone(f); f.id = C.uid('fx'); return f; })); self.changed({ tl: true, insp: true }); }, !!(clip && clip.length)],
      ['🎬 Remove animations', function () { el.anim = C.newAnim(); self.changed({ tl: true, insp: true }); }],
      [(el.replaceable ? '☑' : '☐') + ' Template slot (people can replace it)', function () { el.replaceable = !el.replaceable; self.changed({ tl: true, insp: true }); self.renderPanel(); }]
    ]);
  };

  /* =========================================================
     TIMELINE
     ========================================================= */
  var TH = 11.5; // header width in em
  EP.thPx = function () { return Math.round(TH * parseFloat(getComputedStyle(this.box).fontSize || 13)); };
  EP.fitPps = function () { var w = this.tlScroll.clientWidth - this.thPx() - 30; return Math.max(4, w / Math.max(1, this.P.duration)); };
  EP.setTlZoom = function (z) { this.tlZoom = clamp(Math.round(z), 0, 100); this.$('[data-tlzoom]').value = this.tlZoom; var ph = this.t; this.renderTimeline(); var x = this.thPx() + ph * this.pps; this.tlScroll.scrollLeft = Math.max(0, x - this.tlScroll.clientWidth / 2); };
  EP.renderTimelineSoon = function () { var self = this; clearTimeout(this.tlSoon); this.tlSoon = setTimeout(function () { self.renderTimeline(); }, 120); };
  function icon(type) { return (T[type] && T[type].icon) || '•'; }
  EP.renderTimeline = function () {
    if (!this.P || this.dragging) return;
    var self = this, P = this.P, th = this.thPx(), pps = this.pps = this.fitPps() * Math.pow(2, this.tlZoom / 20), D = P.duration, laneW = Math.max(this.tlScroll.clientWidth - th, D * pps + 160);
    var spb = 60 / P.bpm, bar = spb * 4 * pps, off = (P.beatOffset || 0) * pps;
    var inner = this.tlInner; inner.innerHTML = '';
    inner.style.width = (th + laneW) + 'px';
    inner.style.setProperty('--bar', Math.max(2, bar) + 'px'); inner.style.setProperty('--beat', Math.max(1, spb * pps) + 'px'); inner.style.setProperty('--boff', off + 'px'); inner.style.setProperty('--th', th + 'px');
    inner.classList.toggle('fine', spb * pps > 9);
    // ruler
    var ru = h('div', { class: 'se-row se-ruler' }, '<div class="se-th"><b>' + fmt(D) + '</b><small>' + Math.round(P.bpm) + ' BPM</small></div><div class="se-lane"><canvas></canvas></div>');
    inner.appendChild(ru); this.drawRuler(ru.querySelector('canvas'), laneW, pps);
    // transitions row
    var tr = h('div', { class: 'se-row se-trow' }, '<div class="se-th"><i>⚡</i><b>Transitions</b></div><div class="se-lane"></div>'), trl = tr.lastChild;
    P.transitions.forEach(function (x) { var d = h('div', { class: 'se-tmark', 'data-tr': x.id, title: (C.TRANSITIONS.filter(function (q) { return q[0] === x.type; })[0] || [0, x.type])[1] + ' — drag to move' }); d.style.left = (x.t * pps) + 'px'; trl.appendChild(d); });
    inner.appendChild(tr);
    // layers (top of the list = in front)
    for (var i = P.layers.length - 1; i >= 0; i--) inner.appendChild(this.layerRow(P.layers[i], pps));
    if (!P.layers.length) inner.appendChild(h('div', { class: 'se-row se-empty' }, '<div class="se-th"></div><div class="se-lane"><span>Drag pictures, videos, text, visuals or effects here ✦</span></div>'));
    // audio
    P.audio.forEach(function (c) { inner.appendChild(self.audioRow(c, pps)); });
    if (!P.audio.length) { var ar = h('div', { class: 'se-row se-addrow' }, '<div class="se-th"><i>🎵</i><b>Audio</b></div><div class="se-lane"><button type="button">✚ Add your song</button></div>'); ar.querySelector('button').addEventListener('click', function () { self.pick('audio/*,video/*'); }); inner.appendChild(ar); }
    // midi
    P.midis.forEach(function (m) { inner.appendChild(self.midiRow(m, pps)); });
    var ph = h('div', { class: 'se-ph' }); inner.appendChild(ph); this.phEl = ph;
    var endm = h('div', { class: 'se-endm', title: 'End of the video' }); endm.style.left = (th + D * pps) + 'px'; inner.appendChild(endm);
    this.updatePlayhead(); this.markTimelineSel();
  };
  EP.drawRuler = function (cv, w, pps) {
    var P = this.P, dpr = Math.min(2, window.devicePixelRatio || 1), H = 22; cv.width = Math.round(w * dpr); cv.height = H * dpr; cv.style.width = w + 'px'; cv.style.height = H + 'px';
    var g = cv.getContext('2d'); g.scale(dpr, dpr); g.font = '10px "Space Grotesk", sans-serif'; g.textBaseline = 'top';
    var step = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60].filter(function (s) { return s * pps >= 56; })[0] || 60;
    for (var s = 0; s * pps < w; s += step) { var x = Math.round(s * pps) + 0.5; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, 12, 1, 10); g.fillText(step < 1 ? s.toFixed(2).replace(/0$/, '') + 's' : C.fmtTime(s), x + 3, 2); }
    var spb = 60 / P.bpm; if (spb * pps > 5) for (var b = Math.ceil(-(P.beatOffset || 0) / spb); (P.beatOffset || 0) + b * spb < w / pps; b++) { var bx = Math.round(((P.beatOffset || 0) + b * spb) * pps) + 0.5; g.fillStyle = b % 4 === 0 ? 'rgba(255,63,200,.9)' : 'rgba(255,255,255,.25)'; g.fillRect(bx, b % 4 === 0 ? 16 : 19, 1, b % 4 === 0 ? 6 : 3); }
  };
  EP.layerRow = function (el, pps) {
    var self = this, row = h('div', { class: 'se-row se-lrow' + (el.hidden ? ' off' : '') + (el.locked ? ' lk' : ''), 'data-row': el.id });
    row.innerHTML = '<div class="se-th" draggable="false"><span class="se-grip" title="Drag up/down to change what\'s in front">⋮⋮</span><i>' + icon(el.type) + '</i><b title="' + E(el.name) + '">' + E(el.name || T[el.type].label) + '</b><button type="button" data-eye title="Show / hide">' + (el.hidden ? '🙈' : '👁') + '</button><button type="button" data-lk title="Lock">' + (el.locked ? '🔒' : '🔓') + '</button></div><div class="se-lane"></div>';
    var lane = row.lastChild, c = h('div', { class: 'se-clip k-' + el.type + (el.replaceable ? ' slot' : ''), 'data-clip': el.id });
    c.style.left = (el.start * pps) + 'px'; c.style.width = Math.max(4, (el.end - el.start) * pps) + 'px';
    var rec = el.media && this.media[el.media], thumb = rec && rec.thumb;
    if (thumb) c.style.backgroundImage = 'url("' + thumb + '")';
    var badges = (el.fx && el.fx.length ? '<em title="Effects">✨' + el.fx.length + '</em>' : '') + (el.anim && (el.anim.in.type !== 'none' || el.anim.out.type !== 'none' || el.anim.loop.type !== 'none') ? '<em title="Animations">🎬</em>' : '') + (el.type === 'video' && (el.curve || el.speed !== 1) ? '<em title="Speed">' + (el.curve ? '〰' : round(el.speed, 2) + 'x') + '</em>' : '') + (el.replaceable ? '<em title="Template slot">⇄</em>' : '');
    c.innerHTML = '<i class="se-trim l" data-trim="l"></i><span>' + E(el.type === 'text' ? String(el.text || '').replace(/\*/g, '').slice(0, 40) : el.name || T[el.type].label) + '</span>' + badges + '<i class="se-trim r" data-trim="r"></i>';
    var A = el.anim; if (A.in.type !== 'none') { var ai = h('b', { class: 'se-ain' }); ai.style.width = Math.min((el.end - el.start) * pps, (A.in.dur || 0.5) * pps) + 'px'; c.appendChild(ai); }
    if (A.out.type !== 'none') { var ao = h('b', { class: 'se-aout' }); ao.style.width = Math.min((el.end - el.start) * pps, (A.out.dur || 0.4) * pps) + 'px'; c.appendChild(ao); }
    var kts = {}; Object.keys(el.kf || {}).forEach(function (k) { (el.kf[k] || []).forEach(function (q) { kts[round(q.t, 3)] = 1; }); });
    Object.keys(kts).forEach(function (kt) { var d = h('i', { class: 'se-kfd', 'data-kft': kt, title: 'Keyframe — drag to move, click to jump' }); d.style.left = (kt * pps) + 'px'; c.appendChild(d); });
    lane.appendChild(c);
    row.querySelector('[data-eye]').addEventListener('click', function (e) { e.stopPropagation(); el.hidden = !el.hidden; self.changed({ tl: true, audio: el.type === 'video' }); });
    row.querySelector('[data-lk]').addEventListener('click', function (e) { e.stopPropagation(); el.locked = !el.locked; self.changed({ tl: true }); self.syncSel(); });
    return row;
  };
  EP.audioRow = function (c, pps) {
    var self = this, m = this.P.media[c.media] || {}, rec = this.media[c.media], row = h('div', { class: 'se-row se-arow' + (c.muted ? ' off' : ''), 'data-arow': c.id });
    row.innerHTML = '<div class="se-th"><i>🎵</i><b title="' + E(m.name) + '">' + E(c.name || m.name || 'Audio') + '</b><button type="button" data-mute title="Mute">' + (c.muted ? '🔇' : '🔊') + '</button></div><div class="se-lane"></div>';
    var len = c.dur / (c.speed || 1), cl = h('div', { class: 'se-clip k-audio', 'data-aclip': c.id }); cl.style.left = (c.start * pps) + 'px'; cl.style.width = Math.max(4, len * pps) + 'px';
    cl.innerHTML = '<canvas></canvas><i class="se-trim l" data-trim="l"></i><span>' + E(c.name || m.name || 'Audio') + (c.speed !== 1 ? ' · ' + c.speed + 'x' : '') + '</span><i class="se-trim r" data-trim="r"></i>';
    row.lastChild.appendChild(cl);
    if (rec && rec.peaks && m.dur) this.drawWave(cl.querySelector('canvas'), rec.peaks, m.dur, c.in || 0, c.dur, Math.max(4, len * pps));
    if (!rec || rec.missing) cl.classList.add('missing');
    row.querySelector('[data-mute]').addEventListener('click', function (e) { e.stopPropagation(); c.muted = !c.muted; self.changed({ tl: true, audio: true }); });
    return row;
  };
  EP.drawWave = function (cv, peaks, total, from, dur, w) {
    var H = 34, wpx = Math.min(8000, Math.round(w)); cv.width = wpx; cv.height = H; cv.style.width = w + 'px';
    var g = cv.getContext('2d'); g.fillStyle = 'rgba(255,255,255,.75)';
    for (var x = 0; x < wpx; x += 2) { var t = from + x / wpx * dur, i = Math.floor(t / total * peaks.length), v = peaks[clamp(i, 0, peaks.length - 1)] || 0, bh = Math.max(1, v * (H - 4)); g.fillRect(x, (H - bh) / 2, 1.5, bh); }
  };
  EP.midiRow = function (mr, pps) {
    var self = this, mm = this.midis[mr.id], row = h('div', { class: 'se-row se-mrow' + (this.selKind === 'midi' && this.sel === mr.id ? ' sel' : ''), 'data-mrow': mr.id });
    row.innerHTML = '<div class="se-th"><i>🎹</i><b title="' + E(mr.name) + '">' + E(mr.name || 'MIDI') + '</b></div><div class="se-lane"></div>';
    if (!mm) { row.lastChild.innerHTML = '<span class="se-miss">MIDI file missing — add it again in 🎵 Audio & MIDI</span>'; return row; }
    var notes = C.midiNotes({ midis: [mr], bpm: this.P.bpm }, this.midis), start = notes.length ? Math.min(0, notes[0].t) : 0, end = 0; notes.forEach(function (n) { if (n.e > end) end = n.e; });
    var first = notes.length ? notes[0].t : 0, cl = h('div', { class: 'se-clip k-midi', 'data-mclip': mr.id }); cl.style.left = ((mr.offset || 0) * pps) + 'px'; cl.style.width = Math.max(4, (end - (mr.offset || 0)) * pps) + 'px';
    cl.innerHTML = '<canvas></canvas><span>' + E(mr.name) + ' · ' + mm.notes.length + ' notes</span>'; row.lastChild.appendChild(cl);
    var cv = cl.firstChild, w = Math.min(8000, Math.max(4, (end - (mr.offset || 0)) * pps)), H = 34; cv.width = w; cv.height = H; cv.style.width = w + 'px';
    var g = cv.getContext('2d'), lo = mm.lo, hi = Math.max(mm.hi, lo + 1); g.fillStyle = '#ffd1f0';
    notes.forEach(function (n) { var x = (n.t - (mr.offset || 0)) * pps, y = H - 3 - (n.p - (mr.transpose || 0) - lo) / (hi - lo) * (H - 6); g.fillRect(x, y - 1, Math.max(1.5, (n.e - n.t) * pps), 2); });
    void start; void first;
    return row;
  };
  EP.markTimelineSel = function () {
    var self = this; if (!this.tlInner) return;
    this.tlInner.querySelectorAll('.sel').forEach(function (x) { x.classList.remove('sel'); });
    if (!this.sel) return;
    var q = this.selKind === 'layer' ? '[data-clip="' + this.sel + '"]' : this.selKind === 'audio' ? '[data-aclip="' + this.sel + '"]' : this.selKind === 'tr' ? '[data-tr="' + this.sel + '"]' : this.selKind === 'midi' ? '[data-mclip="' + this.sel + '"]' : null;
    var n = q && this.tlInner.querySelector(q); if (n) { n.classList.add('sel'); var r = n.closest('.se-row'); if (r) r.classList.add('sel'); }
    void self;
  };
  EP.updatePlayhead = function () {
    if (!this.phEl || !this.pps) return; var x = this.thPx() + this.t * this.pps; this.phEl.style.transform = 'translateX(' + x + 'px)';
    if (this.playing && !this.dragging) { var sc = this.tlScroll, vis = x - sc.scrollLeft; if (vis > sc.clientWidth - 40 || vis < this.thPx()) sc.scrollLeft = Math.max(0, x - this.thPx() - 60); }
  };
  EP.refreshKfMarks = function () { if (this.insp) this.insp.querySelectorAll('[data-kfbtn]').forEach(function (b) { b.dispatchEvent(new Event('se-refresh')); }); };
  EP.snapTime = function (t, ignore, ev) {
    if (!this.snap || (ev && ev.altKey)) return t;
    var P = this.P, tol = 8 / this.pps, best = t, bd = tol, cands = [0, P.duration, this.t];
    var spb = 60 / P.bpm, b = Math.round((t - (P.beatOffset || 0)) / spb); cands.push((P.beatOffset || 0) + b * spb);
    P.layers.forEach(function (l) { if (l.id !== ignore) cands.push(l.start, l.end); });
    P.audio.forEach(function (c) { if (c.id !== ignore) cands.push(c.start, c.start + c.dur / (c.speed || 1)); });
    P.transitions.forEach(function (x) { cands.push(x.t); });
    cands.forEach(function (c) { var d = Math.abs(c - t); if (d < bd) { bd = d; best = c; } });
    return best;
  };
  EP.bindTimeline = function () {
    var self = this, sc = this.tlScroll;
    sc.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !self.P) return;
      var tg = e.target, P = self.P, pps = self.pps, th = self.thPx(), r = self.tlInner.getBoundingClientRect();
      var tAt = function (ev) { return (ev.clientX - r.left - th) / pps; };
      if (tg.closest('button')) return;
      // header drag = reorder layers
      var grip = tg.closest('.se-lrow .se-th');
      if (grip) {
        var id = grip.parentNode.getAttribute('data-row'), el0 = self.find(id); if (!el0) return;
        self.select('layer', id); e.preventDefault(); sc.setPointerCapture(e.pointerId);
        var rowEl = grip.parentNode, y0 = e.clientY, rh = rowEl.offsetHeight, startIdx = P.layers.indexOf(el0), moved = false;
        var mvg = function (ev) { var dy = ev.clientY - y0; if (Math.abs(dy) > 3) moved = true; rowEl.style.transform = 'translateY(' + dy + 'px)'; rowEl.classList.add('lift'); };
        var upg = function (ev) {
          sc.removeEventListener('pointermove', mvg); sc.removeEventListener('pointerup', upg); sc.removeEventListener('pointercancel', upg);
          rowEl.style.transform = ''; rowEl.classList.remove('lift');
          if (!moved) return; var steps = Math.round((ev.clientY - y0) / rh), L = P.layers, ni = clamp(startIdx - steps, 0, L.length - 1);
          if (ni !== startIdx) { L.splice(startIdx, 1); L.splice(ni, 0, el0); self.changed({ tl: true }); }
        };
        sc.addEventListener('pointermove', mvg); sc.addEventListener('pointerup', upg); sc.addEventListener('pointercancel', upg); return;
      }
      if (tg.closest('.se-th')) return;
      var clip = tg.closest('.se-clip'), kfd = tg.closest('.se-kfd'), tmark = tg.closest('.se-tmark');
      // ruler / empty space = scrub
      if (!clip && !tmark) {
        if (!tg.closest('.se-ruler')) self.select(null);
        e.preventDefault(); sc.setPointerCapture(e.pointerId); self.stop(); self.dragging = true;
        var scrub = function (ev) { self.seek(self.snapTime(clamp(tAt(ev), 0, P.duration), null, ev)); };
        scrub(e);
        var ups = function () { self.dragging = false; sc.removeEventListener('pointermove', scrub); sc.removeEventListener('pointerup', ups); sc.removeEventListener('pointercancel', ups); };
        sc.addEventListener('pointermove', scrub); sc.addEventListener('pointerup', ups); sc.addEventListener('pointercancel', ups); return;
      }
      e.preventDefault(); sc.setPointerCapture(e.pointerId);
      var x0 = e.clientX, moved2 = false, t0 = tAt(e);
      var finish = function (fn) { var up = function (ev) { sc.removeEventListener('pointermove', fn); sc.removeEventListener('pointerup', up); sc.removeEventListener('pointercancel', up); self.dragging = false; if (moved2) self.changed({ tl: true, audio: true, insp: true }); else if (up.click) up.click(ev); }; return up; };
      var on = function (fn, click) { var up = finish(fn); up.click = click; sc.addEventListener('pointermove', fn); sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up); };
      if (tmark) {
        var tr = P.transitions.filter(function (x) { return x.id === tmark.getAttribute('data-tr'); })[0]; if (!tr) return;
        self.select('tr', tr.id); var tt0 = tr.t;
        on(function (ev) { if (Math.abs(ev.clientX - x0) < 3 && !moved2) return; moved2 = true; self.dragging = true; tr.t = round(clamp(self.snapTime(tt0 + (ev.clientX - x0) / pps, null, ev), 0, P.duration), 3); tmark.style.left = (tr.t * pps) + 'px'; self.needs = true; }, function () { self.seek(tr.t); });
        return;
      }
      var lid = clip.getAttribute('data-clip'), aid = clip.getAttribute('data-aclip'), mid = clip.getAttribute('data-mclip'), trim = tg.getAttribute('data-trim');
      if (lid) {
        var el = self.find(lid); if (!el) return;
        self.select('layer', lid);
        if (el.locked) return;
        var s0 = el.start, e0 = el.end, in0 = el.in || 0, sd0 = el.srcDur || 0, md = el.type === 'video' && P.media[el.media] && P.media[el.media].dur || 0, sp = C.avgSpeed(el);
        if (kfd) {
          var kt0 = +kfd.getAttribute('data-kft');
          on(function (ev) {
            if (Math.abs(ev.clientX - x0) < 3 && !moved2) return; moved2 = true; self.dragging = true;
            var nt = round(clamp(kt0 + (ev.clientX - x0) / pps, 0, el.end - el.start), 4);
            Object.keys(el.kf).forEach(function (k) { el.kf[k].forEach(function (q) { if (Math.abs(q.t - kfd._t) < 1e-3 || (kfd._t == null && Math.abs(q.t - kt0) < 1e-3)) q.t = nt; }); el.kf[k].sort(function (a, b) { return a.t - b.t; }); });
            kfd._t = nt; kfd.style.left = (nt * pps) + 'px'; self.needs = true;
          }, function () { self.seek(el.start + kt0); });
          return;
        }
        on(function (ev) {
          var dt = (ev.clientX - x0) / pps; if (Math.abs(ev.clientX - x0) < 3 && !moved2) return; moved2 = true; self.dragging = true;
          if (trim === 'l') {
            var ns = self.snapTime(s0 + dt, el.id, ev); ns = clamp(ns, 0, e0 - 0.05);
            if (el.type === 'video') { var dsrc = (ns - s0) * sp; if (in0 + dsrc < 0) { ns = s0 - in0 / sp; dsrc = -in0; } el.in = round(in0 + dsrc, 4); el.srcDur = round(sd0 - dsrc, 4); }
            el.start = round(ns, 4);
            Object.keys(el.kf || {}).forEach(function (k) { (el.kf[k] || []).forEach(function (q) { if (q._t0 == null) q._t0 = q.t; q.t = round(q._t0 - (ns - s0), 4); }); });
          } else if (trim === 'r') {
            var ne = clamp(self.snapTime(e0 + dt, el.id, ev), s0 + 0.05, 3600);
            if (el.type === 'video' && md) { var maxE = s0 + (md - (el.in || 0)) / sp; if (ne > maxE) ne = maxE; el.srcDur = round((ne - s0) * sp, 4); }
            el.end = round(ne, 4);
          } else {
            var len = e0 - s0, ns2 = Math.max(0, s0 + dt), sn = self.snapTime(ns2, el.id, ev); if (sn !== ns2) ns2 = sn; else { var se = self.snapTime(ns2 + len, el.id, ev); ns2 = se - len; }
            ns2 = Math.max(0, ns2); el.start = round(ns2, 4); el.end = round(ns2 + len, 4);
          }
          clip.style.left = (el.start * pps) + 'px'; clip.style.width = Math.max(4, (el.end - el.start) * pps) + 'px'; self.needs = true; self.syncSel();
          if (el.type === 'video') self.syncVideos(self.t, false);
        }, function (ev) { if (!trim) self.seek(self.snapTime(clamp(t0, el.start, el.end - 0.001), null, ev)); });
        var cleanKf = function () { Object.keys(el.kf || {}).forEach(function (k) { (el.kf[k] || []).forEach(function (q) { delete q._t0; }); }); };
        sc.addEventListener('pointerup', cleanKf, { once: true });
        return;
      }
      if (aid) {
        var c = P.audio.filter(function (a) { return a.id === aid; })[0]; if (!c) return; self.select('audio', aid);
        var cs0 = c.start, cin0 = c.in || 0, cd0 = c.dur, spd = c.speed || 1, total = (P.media[c.media] || {}).dur || (cin0 + cd0);
        on(function (ev) {
          var dt = (ev.clientX - x0) / pps; if (Math.abs(ev.clientX - x0) < 3 && !moved2) return; moved2 = true; self.dragging = true;
          if (trim === 'l') { var ns = clamp(self.snapTime(cs0 + dt, c.id, ev), cs0 - cin0 / spd, cs0 + cd0 / spd - 0.05); var d = (ns - cs0) * spd; c.start = round(Math.max(0, ns), 4); c.in = round(cin0 + d, 4); c.dur = round(cd0 - d, 4); }
          else if (trim === 'r') { var ne = clamp(self.snapTime(cs0 + cd0 / spd + dt, c.id, ev), cs0 + 0.05, cs0 + (total - cin0) / spd); c.dur = round((ne - cs0) * spd, 4); }
          else { var ns3 = Math.max(0, cs0 + dt), sn3 = self.snapTime(ns3, c.id, ev); c.start = round(Math.max(0, sn3), 4); }
          clip.style.left = (c.start * pps) + 'px'; clip.style.width = Math.max(4, c.dur / spd * pps) + 'px';
        }, function () { self.seek(clamp(t0, 0, P.duration)); });
        return;
      }
      if (mid) {
        var mr = P.midis.filter(function (m) { return m.id === mid; })[0]; if (!mr) return; self.select('midi', mid); var o0 = mr.offset || 0;
        on(function (ev) { if (Math.abs(ev.clientX - x0) < 3 && !moved2) return; moved2 = true; self.dragging = true; mr.offset = round(self.snapTime(o0 + (ev.clientX - x0) / pps, null, ev), 4); clip.style.left = (mr.offset * pps) + 'px'; self._nk = null; self.needs = true; }, function () { self.seek(clamp(t0, 0, P.duration)); });
      }
    });
    sc.addEventListener('contextmenu', function (e) {
      var clip = e.target.closest('.se-clip'); if (!clip) return; e.preventDefault();
      var lid = clip.getAttribute('data-clip'), aid = clip.getAttribute('data-aclip');
      if (lid) { var el = self.find(lid); if (el) { self.select('layer', lid); self.layerMenu(el, e.clientX, e.clientY); } }
      else if (aid) {
        var c = self.P.audio.filter(function (a) { return a.id === aid; })[0]; if (!c) return; self.select('audio', aid);
        self.ctxMenu(e.clientX, e.clientY, [['✂ Split at playhead', function () { self.splitAudio(c, self.t); }], ['⧉ Duplicate', function () { self.duplicateSel(); }], [(c.muted ? '🔊 Unmute' : '🔇 Mute'), function () { c.muted = !c.muted; self.changed({ tl: true, audio: true }); }], ['🥁 Find the BPM from this song', function () { var i = self.P.audio.indexOf(c); self.P.audio.splice(i, 1); self.P.audio.unshift(c); self.detectBpm(); }], ['🗑 Delete', function () { self.deleteSel(); }]]);
      }
    });
    sc.addEventListener('dblclick', function (e) { var clip = e.target.closest('[data-clip]'); if (clip) { var el = self.find(clip.getAttribute('data-clip')); if (el && el.type === 'text') { self.insTab = 'edit'; self.renderInspector(); var ta = self.insp.querySelector('textarea'); if (ta) ta.focus(); } } });
    sc.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); self.setTlZoom(self.tlZoom + (e.deltaY < 0 ? 6 : -6)); } }, { passive: false });
    sc.addEventListener('dragover', function (e) { e.preventDefault(); sc.classList.add('dragging'); });
    sc.addEventListener('dragleave', function () { sc.classList.remove('dragging'); });
    sc.addEventListener('drop', function (e) {
      e.preventDefault(); sc.classList.remove('dragging');
      var r = self.tlInner.getBoundingClientRect(), t = clamp((e.clientX - r.left - self.thPx()) / self.pps, 0, self.P.duration + 600), clip = e.target.closest('[data-clip]'), target = clip ? self.find(clip.getAttribute('data-clip')) : null;
      self.handleDrop(e.dataTransfer, { t: round(self.snapTime(t), 3) }, target);
    });
  };

  /* =========================================================
     KEYS
     ========================================================= */
  EP.bindKeys = function () {
    var self = this;
    this.on(document, 'keydown', function (e) {
      if (!self.P || self.exporting || !self.box.isConnected) return;
      var tg = e.target, tag = (tg.tagName || '').toLowerCase();
      if (tag === 'input' && !/range|checkbox|radio|color|button/.test(tg.type) || tag === 'textarea' || tag === 'select' || tg.isContentEditable) return;
      if (!self.$('.se-modal').hidden) { if (e.key === 'Escape') self.closeModal(); return; }
      var k = e.key, mod = e.ctrlKey || e.metaKey, el = self.cur();
      if (k === ' ') { e.preventDefault(); self.toggle(); return; }
      if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) self.redo(); else self.undo(); return; }
      if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); self.redo(); return; }
      if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); self.duplicateSel(); return; }
      if (mod && (k === 's' || k === 'S')) { e.preventDefault(); if (!self.opts.builder) self.saveLocal(true); return; }
      if (mod && (k === 'c' || k === 'C') && el) { self.clipboard = clone(el); self.toast('Copied'); return; }
      if (mod && (k === 'v' || k === 'V') && self.clipboard) { e.preventDefault(); var b = clone(self.clipboard), len = b.end - b.start; b.id = C.uid('el'); b.start = round(self.t, 4); b.end = round(self.t + len, 4); self.P.layers.push(b); self.select('layer', b.id); self.changed({ tl: true, audio: b.type === 'video' }); return; }
      if (mod) return;
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); self.deleteSel(); return; }
      if (k === 's' || k === 'S') { self.action('split'); return; }
      if (k === 'k' || k === 'K') { self.action('kf'); return; }
      if (k === 'Home') { self.seek(0); return; }
      if (k === 'End') { self.seek(self.P.duration); return; }
      if (k === ',' ) { self.step(-1); return; }
      if (k === '.') { self.step(1); return; }
      if (k === 'Escape') { if (self.box.classList.contains('se-fs')) { self.fullScreen(false); return; } self.select(null); return; }
      if ((k === 'f' || k === 'F') && !self.opts.builder) { self.fullScreen(); return; }
      if (/^Arrow/.test(k)) {
        e.preventDefault();
        if (el && !el.locked) { var d = e.shiftKey ? 10 : 1; if (k === 'ArrowLeft') self.setProp(el, 'x', round(C.prop(el, 'x', self.t) - d, 1)); if (k === 'ArrowRight') self.setProp(el, 'x', round(C.prop(el, 'x', self.t) + d, 1)); if (k === 'ArrowUp') self.setProp(el, 'y', round(C.prop(el, 'y', self.t) - d, 1)); if (k === 'ArrowDown') self.setProp(el, 'y', round(C.prop(el, 'y', self.t) + d, 1)); self.changed({ insp: true }); }
        else if (k === 'ArrowLeft' || k === 'ArrowRight') self.step(k === 'ArrowLeft' ? (e.shiftKey ? -10 : -1) : (e.shiftKey ? 10 : 1));
      }
    });
  };
  EP.pick = function (accept, cb, multiple) {
    var self = this, i = h('input', { type: 'file', accept: accept }); if (multiple !== false) i.multiple = true; i.style.display = 'none'; document.body.appendChild(i);
    i.addEventListener('change', function () { var f = [].slice.call(i.files); i.remove(); if (!f.length) return; if (cb) cb(f); else self.addFiles(f, { t: self.P.audio.length ? self.t : 0 }); });
    i.click();
  };

  window.ShortEditor = { mount: mount, unmount: unmount, _Editor: Editor, _EP: EP, _store: store, _U: U, _live: function () { return live; } };
})();
