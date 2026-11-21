/* =========================================================
   SUL0557 — SHORT EDITOR (interface)
   ========================================================= */
(function () {
  'use strict';
  var C = window.ShortCore, T = C.T;
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(tag, attrs, html) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round(v, d) { var k = Math.pow(10, d || 0); return Math.round(v * k) / k; }
  function fmt(s) { s = Math.max(0, s); var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); }
  function download(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
  function safeName(s) { return String(s || 'short').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'short'; }

  /* ---------- IndexedDB: projects + media blobs (stay in this browser) ---------- */
  var DBP = null;
  function db() {
    if (DBP) return DBP;
    DBP = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('No storage'));
      var r = indexedDB.open('sul-short', 1);
      r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
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

  /* ---------- inspector field schemas ---------- */
  var MIDI_F = [['head', 'MIDI'], ['midi', 'Which MIDI', 'midisrc'], ['track', 'Track', 'track'], ['channel', 'Channel', 'channel']];
  var PANEL_F = [['head', 'Panel look'], ['bg', 'Background', 'color'], ['shape', 'Corners', 'chips', [['notch', 'Cut'], ['rect', 'Round']]], ['radius', 'Corner size', 'range', 0, 80], ['frame', 'Border', 'range', 0, 12], ['frameColor', 'Border colour', 'color'], ['titleBar', 'Title bar', 'toggle'], ['barColor', 'Title bar colour', 'color'], ['barText', 'Title text colour', 'color'], ['offsetShadow', 'Offset shadow', 'range', 0, 40], ['shadowTint', 'Offset shadow colour', 'color']];
  var FIELDS = {
    text: [['text', 'Text', 'textarea', { help: 'Put a word between *stars* to give it the accent style. New line = Enter.' }], ['font', 'Font', 'font'], ['weight', 'Weight', 'chips', [[400, 'Regular'], [700, 'Bold'], [900, 'Black']], { num: 1 }], ['size', 'Size', 'range', 8, 420], ['color', 'Colour', 'color'], ['gradient', 'Gradient fill', 'toggle'], ['color2', 'Gradient colour', 'color', { show: function (e) { return e.gradient; } }], ['stroke', 'Outline', 'range', 0, 30], ['strokeColor', 'Outline colour', 'color'], ['align', 'Align', 'chips', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']]], ['caps', 'ALL CAPS', 'toggle'], ['italic', 'Italic', 'toggle'], ['letter', 'Letter spacing', 'range', -10, 40], ['lineH', 'Line height', 'range', 0.7, 2, 0.05], ['autoFit', 'Shrink to fit the box', 'toggle'],
      ['head', 'Accent words (*like this*)'], ['accentColor', 'Accent colour', 'color'], ['accentFont', 'Accent font', 'font'], ['accentGlow', 'Accent glow', 'range', 0, 60],
      ['head', 'Reveal'], ['reveal', 'How it appears', 'chips', [['none', 'All at once'], ['word', 'Word by word'], ['char', 'Typewriter'], ['beat', 'Word per beat']]], ['revealDur', 'Reveal time (s)', 'range', 0.1, 8, 0.1, { show: function (e) { return e.reveal === 'word' || e.reveal === 'char'; } }],
      ['head', 'Box behind text'], ['boxOpacity', 'Box opacity', 'range', 0, 1, 0.05], ['boxColor', 'Box colour', 'color'], ['boxPad', 'Padding', 'range', 0, 100], ['boxRadius', 'Roundness', 'range', 0, 100]],
    image: [['media', 'Picture', 'media', { kind: 'image' }], ['placeholder', 'Empty slot text', 'text'], ['fit', 'Fit', 'chips', [['cover', 'Fill'], ['contain', 'Fit inside'], ['stretch', 'Stretch']]], ['zoom', 'Zoom', 'range', 0.5, 4, 0.05], ['posX', 'Move picture ↔', 'range', 0, 1, 0.01], ['posY', 'Move picture ↕', 'range', 0, 1, 0.01], ['kenBurns', 'Slow zoom', 'range', 0, 4, 0.1], ['radius', 'Roundness', 'range', 0, 600], ['border', 'Border', 'range', 0, 30], ['borderColor', 'Border colour', 'color'], ['saturate', 'Saturation', 'range', 0, 250], ['brightness', 'Brightness', 'range', 20, 200], ['flipX', 'Mirror', 'toggle']],
    video: [['media', 'Video', 'media', { kind: 'video' }], ['trim', 'Start the clip at (s)', 'range', 0, 120, 0.1], ['speed', 'Speed', 'range', 0.25, 2, 0.05], ['loop', 'Loop', 'toggle'], ['fit', 'Fit', 'chips', [['cover', 'Fill'], ['contain', 'Fit inside'], ['stretch', 'Stretch']]], ['zoom', 'Zoom', 'range', 0.5, 4, 0.05], ['radius', 'Roundness', 'range', 0, 600], ['border', 'Border', 'range', 0, 30], ['borderColor', 'Border colour', 'color'], ['saturate', 'Saturation', 'range', 0, 250], ['brightness', 'Brightness', 'range', 20, 200]],
    shape: [['kind', 'Shape', 'chips', [['rect', '▭'], ['circle', '●'], ['triangle', '▲'], ['star', '★'], ['heart', '♥'], ['sparkle', '✦'], ['diamond', '◆'], ['arrow', '➜'], ['line', '—']]], ['fill', 'Colour', 'color'], ['gradient', 'Gradient', 'toggle'], ['fill2', 'Gradient colour', 'color', { show: function (e) { return e.gradient; } }], ['stroke', 'Outline', 'range', 0, 30], ['strokeColor', 'Outline colour', 'color'], ['radius', 'Roundness', 'range', 0, 300], ['reactLevel', 'Pump with the music', 'range', 0, 2, 0.05]],
    pianoroll: [['label', 'Title', 'text'], ['mode', 'Motion', 'chips', [['page', 'Page flips'], ['scroll', 'Scrolls']]], ['beats', 'Beats shown', 'range', 1, 32], ['colorBy', 'Note colours by', 'chips', [['velocity', 'Velocity'], ['pitch', 'Pitch'], ['track', 'Track']]], ['noteColor', 'Note colour', 'color'], ['noteColor2', 'Note colour 2', 'color'], ['activeColor', 'Playing note', 'color'], ['noteGlow', 'Note glow', 'range', 0, 40], ['noteRadius', 'Note roundness', 'range', 0, 12], ['playhead', 'Playhead', 'color'], ['gridColor', 'Grid', 'color'], ['barLineColor', 'Bar lines', 'color'], ['labelColor', 'Labels', 'color'], ['keys', 'Show keyboard', 'toggle'], ['keyWidth', 'Keyboard width', 'range', 3, 20], ['bpmLabel', 'Show BPM', 'toggle'], ['lowNote', 'Lowest note (0 = auto)', 'range', 0, 127], ['highNote', 'Highest note (0 = auto)', 'range', 0, 127]].concat(MIDI_F, PANEL_F),
    stepgrid: [['label', 'Title', 'text'], ['steps', 'Steps', 'range', 4, 32], ['stepLen', 'Step length', 'chips', [[0.25, '1/16'], [0.5, '1/8'], [1, '1/4']], { num: 1 }], ['maxRows', 'Rows (sounds)', 'range', 1, 12], ['onColor', 'Note colour', 'color'], ['onColor2', 'Note colour 2', 'color'], ['hitColor', 'Hit flash', 'color'], ['offColor', 'Empty cell', 'color'], ['gridGap', 'Gap', 'range', 0, 16], ['showLabels', 'Note names', 'toggle'], ['keys', 'Show keys', 'toggle'], ['playhead', 'Playhead', 'color'], ['labelColor', 'Labels', 'color']].concat(MIDI_F, PANEL_F),
    falling: [['look', 'Look-ahead (s)', 'range', 0.5, 8, 0.1], ['noteColor', 'Colour (high)', 'color'], ['noteColor2', 'Colour (low)', 'color'], ['glow', 'Glow', 'range', 0, 40], ['radius', 'Roundness', 'range', 0, 30], ['keyboard', 'Keyboard', 'toggle'], ['keyH', 'Keyboard height %', 'range', 4, 30], ['hitFlash', 'Flash on hit', 'toggle'], ['bg', 'Background', 'colorOrNone'], ['lowNote', 'Lowest note (0 = auto)', 'range', 0, 127], ['highNote', 'Highest note (0 = auto)', 'range', 0, 127]].concat(MIDI_F),
    noteburst: [['style', 'Style', 'chips', [['rings', 'Rings'], ['sparks', 'Sparks'], ['stars', 'Stars'], ['dots', 'Dots']]], ['layout', 'Where', 'chips', [['pitch', 'By pitch'], ['center', 'Center'], ['random', 'Random']]], ['color', 'Colour', 'color'], ['color2', 'Colour 2', 'color'], ['size', 'Size', 'range', 10, 400], ['life', 'Length (s)', 'range', 0.1, 3, 0.05], ['count', 'Sparks', 'range', 3, 40]].concat(MIDI_F),
    spectrum: [['style', 'Style', 'chips', [['bars', 'Bars'], ['dots', 'Dots'], ['line', 'Line'], ['circle', 'Circle']]], ['mirror', 'Mirror', 'toggle', { show: function (e) { return e.style === 'bars'; } }], ['bands', 'Bars', 'range', 8, 128], ['color', 'Colour', 'color'], ['color2', 'Colour 2', 'color'], ['gap', 'Gap %', 'range', 0, 90], ['radius', 'Roundness', 'range', 0, 30], ['sens', 'Sensitivity', 'range', 20, 300], ['glow', 'Glow', 'range', 0, 40], ['inner', 'Hole size', 'range', 0, 90, 1, { show: function (e) { return e.style === 'circle'; } }]],
    waveform: [['label', 'Label', 'text'], ['style', 'Style', 'chips', [['full', 'Whole song'], ['window', 'Moving window'], ['scope', 'Oscilloscope']]], ['span', 'Window (s)', 'range', 0.5, 20, 0.5, { show: function (e) { return e.style !== 'full'; } }], ['wave', 'Wave colour', 'color'], ['played', 'Played part', 'color'], ['playhead', 'Playhead', 'color'], ['textColor', 'Label colour', 'color'], ['showLabel', 'Show label', 'toggle']].concat(PANEL_F),
    player: [['title', 'Song title (scrolls)', 'text'], ['brand', 'Player name', 'text'], ['body', 'Body', 'color'], ['body2', 'Body top', 'color'], ['screen', 'Screen', 'color'], ['screenText', 'Screen text', 'color'], ['accent', 'Accent', 'color'], ['bars', 'Mini spectrum bars', 'range', 6, 48], ['radius', 'Roundness', 'range', 0, 80]],
    plugin: [['brand', 'Name', 'text'], ['preset', 'Preset line', 'text'], ['knobs', 'Knobs', 'range', 0, 10], ['panel', 'Panel', 'color'], ['panel2', 'Header', 'color'], ['accent', 'Accent', 'color'], ['text', 'Text', 'color'], ['offsetShadow', 'Offset shadow', 'range', 0, 40], ['shadowTint', 'Offset shadow colour', 'color'], ['radius', 'Corner cut', 'range', 0, 50]].concat(MIDI_F),
    progress: [['color', 'Colour', 'color'], ['track', 'Track colour', 'colorText'], ['radius', 'Roundness', 'range', 0, 60], ['knob', 'Knob', 'toggle']],
    timer: [['font', 'Font', 'font'], ['size', 'Size', 'range', 12, 300], ['color', 'Colour', 'color'], ['showTotal', 'Show total length', 'toggle']],
    sparkles: [['count', 'How many', 'range', 1, 120], ['color', 'Colour', 'color'], ['color2', 'Colour 2', 'color'], ['size', 'Size', 'range', 4, 160], ['speed', 'Twinkle speed', 'range', 0.1, 4, 0.1], ['onBeat', 'Flash on beat', 'toggle']]
  };
  var BLENDS = [['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['hard-light', 'Hard light'], ['color-dodge', 'Dodge'], ['color-burn', 'Burn'], ['lighter', 'Add'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'], ['darken', 'Darken'], ['lighten', 'Lighten']];
  var ADD_GROUPS = [
    ['Text', [['text', 'Title', { text: 'BIG TITLE', font: 'Anton', size: 200, color: '#ff3fa4' }], ['text', 'Caption', { text: 'WORD BY WORD\n*caption*', font: 'Luckiest Guy', size: 90, stroke: 8, strokeColor: '#ff2a7a', reveal: 'word', revealDur: 1.2 }], ['text', 'Beat lyrics', { text: 'ONE WORD EACH BEAT', font: 'Bowlby One SC', size: 130, reveal: 'beat', color: '#ffffff', stroke: 6, strokeColor: '#2a1240' }], ['text', 'Small label', { text: '@SUL0557', font: 'Space Grotesk', weight: 700, size: 50, caps: false, color: '#2a1240', anim: null }]]],
    ['Media', [['image', 'Picture slot', {}], ['video', 'Video slot', {}]]],
    ['MIDI visuals', [['pianoroll', 'Piano roll', {}], ['stepgrid', 'Drum grid', {}], ['falling', 'Falling notes', {}], ['noteburst', 'Note bursts', {}], ['plugin', 'Synth panel', {}]]],
    ['Music visuals', [['spectrum', 'Spectrum bars', {}], ['spectrum', 'Circle spectrum', { style: 'circle', bands: 72 }], ['waveform', 'Waveform', {}], ['player', 'Retro player', {}], ['progress', 'Progress bar', {}], ['timer', 'Time', {}]]],
    ['Shapes & decor', [['shape', 'Box', {}], ['shape', 'Circle', { kind: 'circle' }], ['shape', 'Star', { kind: 'star', fill: '#ffe14d' }], ['shape', 'Heart', { kind: 'heart' }], ['shape', 'Sparkle', { kind: 'sparkle', fill: '#ffffff' }], ['shape', 'Arrow', { kind: 'arrow' }], ['sparkles', 'Sparkles', {}]]]
  ];

  /* =========================================================
     MOUNT
     ========================================================= */
  var live = null;
  function mount(root, cfg, api) {
    unmount();
    var ed = new Editor(root, cfg, api); live = ed; ed.init();
  }
  function unmount() { if (live) { live.destroy(); live = null; } }

  function Editor(root, cfg, api) {
    this.root = root; this.cfg = cfg; this.api = api;
    this.P = null; this.sel = null; this.selTr = null; this.t = 0; this.playing = false; this.loop = false;
    this.media = {}; this.midis = {}; this.an = null; this.audioBuf = null; this.hist = []; this.hi = -1;
    this.quality = 0.5; this.zoom = 0; this.snap = true; this.tab = 'templates'; this.offs = []; this.dirty = false; this.click = false;
    this.texImg = null; this.cloud = window.ShortCloud ? new window.ShortCloud(((cfg.editor || {}).cloud) || {}) : null;
  }
  var EP = Editor.prototype;
  EP.on = function (tg, ev, fn, o) { tg.addEventListener(ev, fn, o); this.offs.push([tg, ev, fn, o]); };
  EP.destroy = function () {
    this.stop(); cancelAnimationFrame(this.raf); clearInterval(this.autoT); if (this.ro) this.ro.disconnect();
    if (this.dirty) this.saveLocal();
    this.offs.forEach(function (o) { o[0].removeEventListener(o[1], o[2], o[3]); });
    Object.keys(this.media).forEach(function (k) { var m = this.media[k]; if (m && m.url && m.own) URL.revokeObjectURL(m.url); if (m && m.el && m.el.pause) m.el.pause(); }, this);
    if (this.ac) try { this.ac.close(); } catch (e) { }
  };
  EP.toast = function (msg, bad) { this.api && this.api.toast ? this.api.toast(msg) : null; var t = this.root.querySelector('.se-toast'); t.textContent = msg; t.className = 'se-toast show' + (bad ? ' bad' : ''); clearTimeout(this.toastT); this.toastT = setTimeout(function () { t.className = 'se-toast'; }, 3200); };

  EP.init = function () {
    var self = this, ec = this.cfg.editor || {};
    this.root.innerHTML =
      '<div class="se">' +
      '<div class="se-top">' +
      '<div class="se-brand"><b>SHORT</b><span>EDITOR</span></div>' +
      '<input class="se-name" type="text" maxlength="60" aria-label="Project name">' +
      '<div class="se-bpm" title="Tempo — everything that moves on the beat follows this"><label>BPM <input type="number" min="40" max="300" step="0.1" data-bpm></label><button type="button" data-tap title="Tap along to the music">TAP</button><button type="button" data-detect title="Guess the BPM from your audio">AUTO</button></div>' +
      '<div class="se-topbtns"><button type="button" data-undo title="Undo (Ctrl+Z)">↶</button><button type="button" data-redo title="Redo (Ctrl+Y)">↷</button><button type="button" data-projects>📁 PROJECTS</button><button type="button" data-save>💾 SAVE</button><button type="button" data-login hidden>☁ LOG IN</button><button type="button" class="se-export" data-export>⬇ EXPORT VIDEO</button></div>' +
      '</div>' +
      '<div class="se-main">' +
      '<nav class="se-tabs" role="tablist">' + [['templates', '🧩', 'Templates'], ['add', '✚', 'Add'], ['music', '🎵', 'Music & MIDI'], ['assets', '🎨', 'Assets'], ['textures', '▦', 'Textures'], ['uploads', '⬆', 'My files']].map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '"><i>' + t[1] + '</i><span>' + t[2] + '</span></button>'; }).join('') + '</nav>' +
      '<div class="se-panel"></div>' +
      '<div class="se-center"><div class="se-stagebox"><div class="se-stagewrap checker"><canvas class="se-stage"></canvas><div class="se-guides"></div><div class="se-sel" hidden><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i><b data-h="rot" title="Rotate"></b></div><div class="se-drop">DROP TO ADD ✦</div></div></div>' +
      '<div class="se-transport"><button type="button" data-home title="Back to start">⏮</button><button type="button" class="se-play" data-play title="Play / pause (Space)">▶</button><span class="se-time">0:00.00 / 0:15</span><button type="button" data-loop title="Loop">🔁</button><button type="button" data-click title="Click track while previewing">🥁</button><label class="se-q">Preview <select data-quality><option value="0.34">Fast</option><option value="0.5" selected>Good</option><option value="1">Full</option></select></label></div></div>' +
      '<aside class="se-insp"></aside>' +
      '</div>' +
      '<div class="se-tl"><div class="se-tl-bar"><button type="button" data-addtr>✚ TRANSITION AT PLAYHEAD</button><label class="tc-inline"><input type="checkbox" data-snap checked><span class="tc-sw"></span><span class="tc-l">Snap to beat</span></label><label class="se-zoom">Zoom <input type="range" min="0" max="100" value="0" data-tlzoom></label><span class="se-hint">Drag bars to move · drag the ends to trim · click the ruler to jump</span></div><div class="se-tl-scroll"><div class="se-tl-inner"></div></div></div>' +
      '<div class="se-toast" aria-live="polite"></div><div class="se-modal" hidden></div>' +
      '</div>';
    var R = this.root;
    this.cv = R.querySelector('.se-stage'); this.wrap = R.querySelector('.se-stagewrap'); this.selBox = R.querySelector('.se-sel'); this.panel = R.querySelector('.se-panel'); this.insp = R.querySelector('.se-insp'); this.tlInner = R.querySelector('.se-tl-inner'); this.tlScroll = R.querySelector('.se-tl-scroll');
    // top bar
    R.querySelector('.se-name').addEventListener('input', function (e) { self.P.name = e.target.value; self.changed(true); });
    var bpmIn = R.querySelector('[data-bpm]');
    bpmIn.addEventListener('change', function () { var v = clamp(+bpmIn.value || 120, 40, 300); self.P.bpm = v; bpmIn.value = v; self.changed(); self.renderTimeline(); });
    var taps = [];
    R.querySelector('[data-tap]').addEventListener('click', function () {
      var now = performance.now(); taps = taps.filter(function (x) { return now - x < 2500; }); taps.push(now);
      if (taps.length >= 3) { var d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); self.P.bpm = round(60000 / d, 1); bpmIn.value = self.P.bpm; self.changed(); self.renderTimeline(); self.toast('Tapped: ' + self.P.bpm + ' BPM'); }
      else self.toast('Keep tapping on the beat…');
    });
    R.querySelector('[data-detect]').addEventListener('click', function () {
      if (!self.an) return self.toast('Add your audio first (🎵 Music & MIDI)', true);
      self.toast('Listening…'); setTimeout(function () { var r = self.an.detectBPM(); self.P.bpm = r.bpm; self.P.beatOffset = round((r.offset - self.P.audioStart % (60 / r.bpm) + 60 / r.bpm) % (60 / r.bpm), 3); bpmIn.value = r.bpm; self.changed(); self.renderTimeline(); self.renderPanel(); self.toast('Detected ' + r.bpm + ' BPM — tap TAP or type it if it feels off'); }, 30);
    });
    R.querySelector('[data-undo]').addEventListener('click', function () { self.undo(); });
    R.querySelector('[data-redo]').addEventListener('click', function () { self.redo(); });
    R.querySelector('[data-projects]').addEventListener('click', function () { self.projectsDialog(); });
    R.querySelector('[data-save]').addEventListener('click', function () { self.saveLocal(true); });
    R.querySelector('[data-export]').addEventListener('click', function () { self.exportDialog(); });
    var lg = R.querySelector('[data-login]');
    if (this.cloud && this.cloud.ok) { lg.hidden = false; lg.addEventListener('click', function () { self.cloudDialog(); }); this.updateLogin(); }
    // tabs
    R.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { self.tab = b.getAttribute('data-tab'); self.renderPanel(); }); });
    // transport
    R.querySelector('[data-play]').addEventListener('click', function () { self.toggle(); });
    R.querySelector('[data-home]').addEventListener('click', function () { self.seek(0); });
    R.querySelector('[data-loop]').addEventListener('click', function (e) { self.loop = !self.loop; e.currentTarget.classList.toggle('on', self.loop); });
    R.querySelector('[data-click]').addEventListener('click', function (e) { self.click = !self.click; e.currentTarget.classList.toggle('on', self.click); self.toast(self.click ? 'Click track on (only while previewing)' : 'Click track off'); });
    R.querySelector('[data-quality]').addEventListener('change', function (e) { self.quality = +e.target.value; self.sizeStage(); });
    // timeline bar
    R.querySelector('[data-addtr]').addEventListener('click', function () { self.addTransition(); });
    R.querySelector('[data-snap]').addEventListener('change', function (e) { self.snap = e.target.checked; });
    R.querySelector('[data-tlzoom]').addEventListener('input', function (e) { self.zoom = +e.target.value; self.renderTimeline(); });
    this.bindStage(); this.bindKeys();
    this.on(window, 'resize', function () { self.sizeStage(); self.renderTimeline(); });
    if (window.ResizeObserver) { var rsT = 0; this.ro = new ResizeObserver(function () { clearTimeout(rsT); rsT = setTimeout(function () { self.sizeStage(); self.renderTimeline(); }, 60); }); this.ro.observe(R.querySelector('.se-stagebox')); this.ro.observe(this.tlScroll); }
    // start: last project or template picker
    var last = null; try { last = localStorage.getItem('sul.short.last'); } catch (e) { }
    var go = last ? store.getProject(last).then(function (rec) { if (rec) return self.openRecord(rec); throw 0; }) : Promise.reject(0);
    go.catch(function () { self.load(C.TEMPLATES[0].build(), true); self.tab = 'templates'; self.renderPanel(); });
    this.autoT = setInterval(function () { if (self.dirty && !self.exporting) self.saveLocal(); }, 6000);
    this.loop_();
  };

  /* ---------- project load / media ---------- */
  EP.load = function (P, fresh) {
    this.stop(); this.P = P; this.sel = null; this.selTr = null; this.t = 0;
    if (!P.media) P.media = {}; if (!P.midis) P.midis = []; if (!P.transitions) P.transitions = []; if (!P.fx) P.fx = {}; if (!P.camera) P.camera = {};
    this.hist = [JSON.stringify(P)]; this.hi = 0;
    this.root.querySelector('.se-name').value = P.name || '';
    this.root.querySelector('[data-bpm]').value = P.bpm;
    var self = this, fonts = [];
    P.layers.forEach(function (l) { if (l.font) fonts.push(l.font); if (l.accentFont) fonts.push(l.accentFont); });
    fonts.forEach(function (f) { C.ensureFont(f, 400).then(function () { self.needs = true; }); C.ensureFont(f, 900).then(function () { self.needs = true; }); });
    this.texImg = null; this.loadTexture();
    this.sizeStage(); this.renderInspector(); this.renderTimeline(); this.renderPanel(); this.needs = true;
    try { localStorage.setItem('sul.short.last', P.id); } catch (e) { }
    if (fresh) this.dirty = true;
    return this.loadMedia();
  };
  EP.loadMedia = function () {
    var self = this, P = this.P, jobs = [];
    this.an = null; this.audioBuf = null;
    Object.keys(P.media).forEach(function (id) {
      var m = P.media[id]; if (self.media[id] && self.media[id].ready) return;
      jobs.push((m.src ? fetch(m.src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }) : store.getBlob(id)).then(function (b) {
        if (!b) { console.warn('Missing media', id); return; }
        return self.registerBlob(id, m, b);
      }).catch(function (e) { console.warn('Media failed', id, e); }));
    });
    return Promise.all(jobs).then(function () {
      if (P.audio && self.media[P.audio]) return self.decodeAudio(P.audio);
    }).then(function () { self.renderTimeline(); self.renderPanel(); self.needs = true; });
  };
  EP.registerBlob = function (id, m, blob) {
    var self = this, rec = this.media[id] = { kind: m.kind, url: URL.createObjectURL(blob), own: true, blob: blob };
    if (m.kind === 'image') return new Promise(function (res) { var im = new Image(); im.onload = function () { rec.el = im; rec.ready = true; self.needs = true; res(); }; im.onerror = function () { res(); }; im.src = rec.url; });
    if (m.kind === 'video') { var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = true; v.src = rec.url; v.addEventListener('loadeddata', function () { rec.ready = true; self.needs = true; }); v.addEventListener('seeked', function () { self.needs = true; }); rec.el = v; return Promise.resolve(); }
    if (m.kind === 'midi') return blob.arrayBuffer().then(function (ab) { try { self.midis[id] = C.parseMidi(ab); rec.ready = true; } catch (e) { console.warn(e); } });
    if (m.kind === 'font') return blob.arrayBuffer().then(function (ab) { try { var ff = new FontFace(m.family, ab); return ff.load().then(function (f) { document.fonts.add(f); rec.ready = true; self.needs = true; }); } catch (e) { } });
    rec.ready = true; return Promise.resolve();
  };
  EP.decodeAudio = function (id) {
    var self = this, rec = this.media[id]; if (!rec || !rec.blob) return Promise.resolve();
    return rec.blob.arrayBuffer().then(function (ab) {
      var ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100);
      return new Promise(function (res, rej) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    }).then(function (buf) { self.audioBuf = buf; self.an = new C.Analysis(buf); self.needs = true; self.renderTimeline(); })
      .catch(function (e) { console.warn(e); self.toast('Couldn\'t read that audio — try MP3 or WAV', true); });
  };
  EP.mediaFn = function () {
    var self = this;
    return function (id, src) {
      if (id && self.media[id] && self.media[id].el && self.media[id].ready !== false) return self.media[id].el;
      if (src) { // site asset by URL
        var k = 'url:' + src, r = self.media[k];
        if (!r) { r = self.media[k] = { kind: 'image' }; var im = new Image(); im.onload = function () { r.el = im; r.ready = true; self.needs = true; }; im.src = self.api.asset(src) || src; }
        return r.el || null;
      }
      return null;
    };
  };
  // add a file the person dropped/uploaded
  EP.addFile = function (file, opts) {
    opts = opts || {};
    var self = this, P = this.P, type = file.type || '', name = file.name || 'file', kind;
    if (/\.midi?$/i.test(name) || /midi/.test(type)) kind = 'midi';
    else if (/^image\//.test(type) || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(name)) kind = 'image';
    else if (/^video\//.test(type) || /\.(mp4|mov|webm|m4v|mkv)$/i.test(name)) kind = opts.asAudio ? 'audio' : 'video';
    else if (/^audio\//.test(type) || /\.(mp3|wav|m4a|aac|ogg|oga|flac|aif|aiff|opus)$/i.test(name)) kind = 'audio';
    else if (/\.(ttf|otf|woff2?)$/i.test(name)) kind = 'font';
    else { this.toast('Can\'t use that file type: ' + name, true); return Promise.resolve(null); }
    if (file.size > 300 * 1048576) { this.toast('That file is too big (max 300 MB)', true); return Promise.resolve(null); }
    var id = C.uid('m'), m = { id: id, name: name, kind: kind };
    if (kind === 'font') m.family = 'U-' + name.replace(/\.[^.]+$/, '').replace(/[^\w ]/g, '').slice(0, 30);
    P.media[id] = m;
    return store.putBlob(id, file).catch(function () { }).then(function () { return self.registerBlob(id, m, file); }).then(function () {
      if (kind === 'audio') {
        P.audio = id; P.audioStart = 0;
        return self.decodeAudio(id).then(function () {
          if (self.an) { var d = Math.min(self.an.duration, 60); if (P.duration < 5 || opts.fitDuration !== false) self.setDuration(round(d, 2)); self.toast('Audio added ✦ — set the BPM (TAP or AUTO) so beats line up'); }
          self.changed(); return id;
        });
      }
      if (kind === 'midi') {
        if (!self.midis[id]) { delete P.media[id]; self.toast('That MIDI file couldn\'t be read', true); return null; }
        var mm = self.midis[id];
        P.midis.push({ id: id, name: name, mode: 'file', offset: 0, transpose: 0 });
        if (P.midis.length === 1 && !P.audio) { P.bpm = mm.bpm; self.root.querySelector('[data-bpm]').value = P.bpm; }
        self.toast('MIDI added: ' + mm.notes.length + ' notes, ' + mm.bpm + ' BPM'); self.changed(); self.renderTimeline(); return id;
      }
      if (kind === 'font') { self.changed(); self.toast('Font added: ' + m.family); return id; }
      self.changed(); return id;
    });
  };
  EP.setDuration = function (d) {
    var P = this.P, old = P.duration; d = clamp(d, 1, 600); P.duration = d;
    P.layers.forEach(function (l) { if (Math.abs(l.end - old) < 0.05 || l.end > d) l.end = d; if (l.start >= d) l.start = Math.max(0, d - 1); });
    this.renderTimeline();
  };
  EP.loadTexture = function () {
    var self = this, fx = this.P.fx || {}; this.texImg = null;
    if (!fx.texture) return;
    if (/^b:/.test(fx.texture) && window.PixFX) { this.texImg = PixFX.builtinTexture(fx.texture.slice(2), 1024, 1024); this.needs = true; return; }
    var im = new Image(); im.onload = function () { self.texImg = im; self.needs = true; }; im.src = this.api.asset(fx.texture) || fx.texture;
  };

  /* ---------- notes ---------- */
  EP.notes = function () {
    if (this.P.midis.length) return C.midiNotes(this.P, this.midis);
    if (this.P.demoNotes === false) return [];
    if (!this.demo || this.demo._bpm !== this.P.bpm) { this.demo = C.demoMidi(this.P.bpm); this.demo._bpm = this.P.bpm; this.midis.__demo = this.demo; }
    return C.midiNotes({ midis: [{ id: '__demo', mode: 'project', offset: this.P.beatOffset || 0 }], bpm: this.P.bpm }, this.midis);
  };

  /* ---------- history ---------- */
  EP.changed = function (noRender) {
    var self = this; this.dirty = true; this.needs = true;
    clearTimeout(this.histT);
    this.histT = setTimeout(function () {
      var j = JSON.stringify(self.P); if (j === self.hist[self.hi]) return;
      self.hist = self.hist.slice(0, self.hi + 1); self.hist.push(j); if (self.hist.length > 80) self.hist.shift(); self.hi = self.hist.length - 1;
    }, 350);
    if (!noRender) this.syncSel();
  };
  EP.restore = function (j) {
    var keep = this.t; this.P = JSON.parse(j); this.t = clamp(keep, 0, this.P.duration);
    if (this.sel && !this.find(this.sel)) this.sel = null;
    this.root.querySelector('.se-name').value = this.P.name || ''; this.root.querySelector('[data-bpm]').value = this.P.bpm;
    this.loadTexture(); this.renderInspector(); this.renderTimeline(); this.syncSel(); this.needs = true; this.dirty = true;
  };
  EP.undo = function () { clearTimeout(this.histT); var j = JSON.stringify(this.P); if (j !== this.hist[this.hi]) { this.hist = this.hist.slice(0, this.hi + 1); this.hist.push(j); this.hi++; } if (this.hi > 0) { this.hi--; this.restore(this.hist[this.hi]); } };
  EP.redo = function () { if (this.hi < this.hist.length - 1) { this.hi++; this.restore(this.hist[this.hi]); } };
  EP.find = function (id) { return this.P.layers.filter(function (l) { return l.id === id; })[0] || null; };

  /* ---------- render loop + playback ---------- */
  EP.sizeStage = function () {
    if (!this.P) return;
    var box = this.root.querySelector('.se-stagebox'), aw = box.clientWidth - 16, ah = box.clientHeight - 16, P = this.P;
    var k = Math.min(aw / P.w, ah / P.h); if (!(k > 0)) k = 0.3;
    this.dispScale = k;
    this.wrap.style.width = Math.floor(P.w * k) + 'px'; this.wrap.style.height = Math.floor(P.h * k) + 'px';
    var q = this.quality, dpr = Math.min(2, window.devicePixelRatio || 1), pw = Math.round(Math.min(P.w * q, P.w * k * dpr * 1.2));
    this.cv.width = Math.max(64, pw); this.cv.height = Math.round(this.cv.width * P.h / P.w);
    this.syncSel(); this.needs = true;
  };
  EP.frame = function (cv, t, edit) {
    C.renderFrame(cv, this.P, { t: t, P: this.P, notes: this.notesCache || (this.notesCache = this.notes()), an: this.an, media: this.mediaFn(), texture: this.texImg, edit: edit });
  };
  EP.loop_ = function () {
    var self = this;
    this.raf = requestAnimationFrame(function () { self.loop_(); });
    if (!this.P || this.exporting) return;
    if (this.playing) {
      var now = this.clock();
      if (now >= this.P.duration) { if (this.loop) { this.seek(0); this.play(); return; } this.stop(); this.t = this.P.duration; }
      else this.t = now;
      this.needs = true;
      if (this.click) this.metronome();
    }
    if (this.needs) {
      this.needs = false; this.notesCache = null;
      this.syncVideos(this.t, this.playing);
      try { this.frame(this.cv, this.t, true); } catch (e) { console.error(e); }
      this.root.querySelector('.se-time').textContent = fmt(this.t) + ' / ' + C.fmtTime(this.P.duration);
      var ph = this.root.querySelector('.se-ph'); if (ph) ph.style.left = (this.tlLabelW + this.t * this.pps) + 'px';
    }
  };
  EP.ctx = function () { if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)(); if (this.ac.state === 'suspended') this.ac.resume(); return this.ac; };
  EP.clock = function () { return this.src ? this.ac.currentTime - this.t0 : (performance.now() - (this.t0p || performance.now())) / 1000; };
  EP.play = function () {
    if (this.playing) return;
    var P = this.P, t = this.t >= P.duration - 0.01 ? 0 : this.t; this.t = t;
    var ac = this.ctx();
    if (this.audioBuf) {
      var src = ac.createBufferSource(), g = ac.createGain(); src.buffer = this.audioBuf; g.gain.value = (P.audioVol == null ? 100 : P.audioVol) / 100; src.connect(g).connect(ac.destination);
      var off = (P.audioStart || 0) + t; if (off < this.audioBuf.duration) src.start(ac.currentTime + 0.03, off);
      this.src = src; this.t0 = ac.currentTime + 0.03 - t;
    } else { this.src = null; this.t0p = performance.now() - t * 1000; }
    this.lastBeat = Math.floor(C.beatPos(P, t));
    this.playing = true; this.root.querySelector('[data-play]').textContent = '❚❚'; this.root.querySelector('[data-play]').classList.add('on');
  };
  EP.stop = function () {
    if (this.playing) { var ct = this.clock(); if (isFinite(ct)) this.t = clamp(ct, 0, this.P ? this.P.duration : 0); }
    if (this.src) { try { this.src.stop(); } catch (e) { } this.src = null; }
    this.playing = false; var b = this.root.querySelector('[data-play]'); if (b) { b.textContent = '▶'; b.classList.remove('on'); }
    this.syncVideos(this.t, false); this.needs = true;
  };
  EP.toggle = function () { this.playing ? this.stop() : this.play(); };
  EP.seek = function (t) { var was = this.playing; if (was) this.stop(); this.t = clamp(t, 0, this.P.duration); this.needs = true; if (was) this.play(); };
  EP.metronome = function () {
    var b = Math.floor(C.beatPos(this.P, this.t)); if (b === this.lastBeat) return; this.lastBeat = b; if (b < 0) return;
    var ac = this.ctx(), o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = b % 4 === 0 ? 1600 : 1000; g.gain.setValueAtTime(0.25, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.07);
  };
  EP.syncVideos = function (t, playing) {
    var self = this, P = this.P, want = {}; if (!P) return;
    function sync(id, el, local, loop, speed) {
      var rec = self.media[id]; if (!rec || !rec.el || !rec.el.duration) return;
      var v = rec.el, d = v.duration, tt = loop ? ((local % d) + d) % d : clamp(local, 0, d - 0.05);
      want[id] = 1; v.playbackRate = speed || 1;
      if (playing) { if (v.paused) v.play().catch(function () { }); if (Math.abs(v.currentTime - tt) > 0.25) v.currentTime = tt; }
      else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - tt) > 0.03) v.currentTime = tt; }
    }
    P.layers.forEach(function (l) { if (l.type === 'video' && l.media && t >= l.start && t < l.end && !l.hidden) sync(l.media, null, (t - l.start) * (l.speed || 1) + (l.trim || 0), l.loop !== false, l.speed); });
    if (P.bg && P.bg.type === 'media' && P.bg.media && P.media[P.bg.media] && P.media[P.bg.media].kind === 'video') sync(P.bg.media, null, t, true, 1);
    Object.keys(this.media).forEach(function (id) { var r = self.media[id]; if (r.kind === 'video' && r.el && !want[id] && !r.el.paused) r.el.pause(); });
  };

  /* =========================================================
     STAGE: select, move, resize, rotate, drop
     ========================================================= */
  EP.toProj = function (e) { var r = this.wrap.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * this.P.w, (e.clientY - r.top) / r.height * this.P.h]; };
  EP.hit = function (p) {
    var L = this.P.layers;
    for (var i = L.length - 1; i >= 0; i--) {
      var l = L[i]; if (l.hidden || l.locked || this.t < l.start || this.t >= l.end) continue;
      var a = -(l.rot || 0) * Math.PI / 180, dx = p[0] - l.x, dy = p[1] - l.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= l.w / 2 && Math.abs(ly) <= l.h / 2) return l;
    }
    return null;
  };
  EP.select = function (id, keepTab) {
    this.sel = id; this.selTr = null; this.syncSel(); this.renderInspector(); this.markTimeline();
  };
  EP.syncSel = function () {
    var l = this.sel && this.find(this.sel), b = this.selBox;
    if (!l || !this.dispScale) { b.hidden = true; return; }
    var k = this.dispScale; b.hidden = false;
    b.style.width = l.w * k + 'px'; b.style.height = l.h * k + 'px'; b.style.left = (l.x - l.w / 2) * k + 'px'; b.style.top = (l.y - l.h / 2) * k + 'px';
    b.style.transform = 'rotate(' + (l.rot || 0) + 'deg)'; b.classList.toggle('locked', !!l.locked);
    b.classList.toggle('offtime', this.t < l.start || this.t >= l.end);
  };
  EP.bindStage = function () {
    var self = this, drag = null, wrap = this.wrap, guides = this.root.querySelector('.se-guides');
    function showGuides(gx, gy) { guides.innerHTML = (gx ? '<i class="gx"></i>' : '') + (gy ? '<i class="gy"></i>' : ''); }
    this.on(wrap, 'pointerdown', function (e) {
      if (e.button !== 0) return;
      var p = self.toProj(e), hd = e.target.getAttribute && e.target.getAttribute('data-h'), l = self.sel && self.find(self.sel);
      if (hd && l && !l.locked) { drag = { mode: hd, l: l, p0: p, b0: { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot || 0, size: l.size } }; }
      else {
        var hit = self.hit(p);
        if (!hit) { self.select(null); return; }
        if (hit.id !== self.sel) self.select(hit.id);
        drag = { mode: 'move', l: hit, p0: p, b0: { x: hit.x, y: hit.y } };
      }
      wrap.setPointerCapture(e.pointerId); e.preventDefault();
    });
    this.on(wrap, 'pointermove', function (e) {
      if (!drag) return;
      var p = self.toProj(e), l = drag.l, b = drag.b0, P = self.P, dx = p[0] - drag.p0[0], dy = p[1] - drag.p0[1];
      if (drag.mode === 'move') {
        var nx = b.x + dx, ny = b.y + dy, sn = P.w * 0.012, gx = false, gy = false;
        if (!e.altKey) { if (Math.abs(nx - P.w / 2) < sn) { nx = P.w / 2; gx = true; } if (Math.abs(ny - P.h / 2) < sn) { ny = P.h / 2; gy = true; } }
        l.x = round(nx, 1); l.y = round(ny, 1); showGuides(gx, gy);
      } else if (drag.mode === 'rot') {
        var ang = Math.atan2(p[1] - l.y, p[0] - l.x) * 180 / Math.PI + 90; if (e.shiftKey || Math.abs(((ang % 90) + 90) % 90) < 4 || Math.abs(((ang % 90) + 90) % 90) > 86) ang = Math.round(ang / (e.shiftKey ? 15 : 90)) * (e.shiftKey ? 15 : 90);
        l.rot = round(((ang + 540) % 360) - 180, 1);
      } else {
        var a = -b.rot * Math.PI / 180, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
        var sx = /e/.test(drag.mode) ? 1 : /w/.test(drag.mode) ? -1 : 0, sy = /s/.test(drag.mode) ? 1 : /n/.test(drag.mode) ? -1 : 0;
        var nw = Math.max(10, b.w + sx * lx), nh = Math.max(10, b.h + sy * ly);
        if (sx && sy && (e.shiftKey || l.type === 'text' || (l.type === 'image' && l.fit !== 'stretch'))) { var kk = Math.max(nw / b.w, nh / b.h); nw = b.w * kk; nh = b.h * kk; }
        var cdx = sx * (nw - b.w) / 2, cdy = sy * (nh - b.h) / 2, ra = b.rot * Math.PI / 180;
        l.w = round(nw, 1); l.h = round(nh, 1); l.x = round(b.x + cdx * Math.cos(ra) - cdy * Math.sin(ra), 1); l.y = round(b.y + cdx * Math.sin(ra) + cdy * Math.cos(ra), 1);
        if (l.type === 'text' && sx && sy && b.size) l.size = round(b.size * nh / b.h, 1);
      }
      self.syncSel(); self.needs = true; self.liveInspector();
    });
    function end() { if (drag) { drag = null; showGuides(false, false); self.changed(); self.renderInspector(); } }
    this.on(wrap, 'pointerup', end); this.on(wrap, 'pointercancel', end);
    this.on(wrap, 'dblclick', function (e) { var l = self.hit(self.toProj(e)); if (l && l.type === 'text') { self.select(l.id); var ta = self.insp.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } } else if (l && (l.type === 'image' || l.type === 'video')) { self.select(l.id); self.pickFile(l.type === 'video' ? 'video/*' : 'image/*', function (id) { l.media = id; l.src = ''; self.changed(); self.renderInspector(); }); } });
    // drag & drop: files from computer, assets from the side panel
    var dropHint = this.root.querySelector('.se-drop');
    this.on(wrap, 'dragover', function (e) { e.preventDefault(); dropHint.classList.add('on'); });
    this.on(wrap, 'dragleave', function () { dropHint.classList.remove('on'); });
    this.on(wrap, 'drop', function (e) {
      e.preventDefault(); dropHint.classList.remove('on');
      var p = self.toProj(e), target = self.hit(p), asset = e.dataTransfer.getData('application/x-sul-asset');
      if (asset) { try { self.useAsset(JSON.parse(asset), p, target); } catch (x) { } return; }
      var fs = [].slice.call(e.dataTransfer.files || []); if (!fs.length) return;
      fs.reduce(function (pr, f) { return pr.then(function () { return self.addFile(f).then(function (id) { if (!id) return; var m = self.P.media[id]; if (m.kind === 'image' || m.kind === 'video') self.placeMedia(id, m.kind, p, target); }); }); }, Promise.resolve()).then(function () { self.renderPanel(); });
    });
  };
  EP.placeMedia = function (id, kind, p, target) {
    if (target && (target.type === 'image' || target.type === 'video') && (kind === target.type || (kind === 'image' && target.type === 'image'))) { target.media = id; target.src = ''; this.select(target.id); this.changed(); this.toast('Placed into “' + target.name + '”'); return; }
    var P = this.P, el = C.newElement(kind, P, { media: id, start: 0, end: P.duration, x: p ? p[0] : P.w / 2, y: p ? p[1] : P.h / 2 });
    var rec = this.media[id] && this.media[id].el;
    if (rec) { var iw = rec.naturalWidth || rec.videoWidth, ih = rec.naturalHeight || rec.videoHeight; if (iw && ih) { el.w = P.w * 0.6; el.h = el.w * ih / iw; } }
    el.name = (P.media[id] && P.media[id].name || el.name).slice(0, 30);
    P.layers.push(el); this.showFully(el); this.select(el.id); this.changed(); this.renderTimeline();
  };
  EP.useAsset = function (a, p, target) {
    var P = this.P;
    if (a.kind === 'texture') { P.fx.texture = a.src; if (!(P.fx.texOpacity > 0)) P.fx.texOpacity = 40; this.loadTexture(); this.changed(); this.renderInspector(); this.toast('Texture on — change blend & strength in Project ▸ Effects'); return; }
    if (target && target.type === 'image') { target.src = a.src; target.media = ''; this.select(target.id); this.changed(); this.toast('Placed into “' + target.name + '”'); return; }
    var el = C.newElement('image', P, { src: a.src, media: '', radius: 0, name: (a.name || 'Asset').slice(0, 30), start: 0, end: P.duration, x: p ? p[0] : P.w / 2, y: p ? p[1] : P.h / 2, w: P.w * 0.4, h: P.w * 0.4 });
    var self = this, im = new Image(); im.onload = function () { el.h = el.w * im.naturalHeight / im.naturalWidth; self.syncSel(); self.needs = true; }; im.src = this.api.asset(a.src) || a.src;
    P.layers.push(el); this.showFully(el); this.select(el.id); this.changed(); this.renderTimeline();
  };
  EP.pickFile = function (accept, cb, multiple) {
    var self = this, i = h('input', { type: 'file', accept: accept }); if (multiple) i.multiple = true; i.style.display = 'none'; document.body.appendChild(i);
    i.addEventListener('change', function () { var fs = [].slice.call(i.files || []); i.remove(); fs.reduce(function (pr, f) { return pr.then(function () { return self.addFile(f).then(function (id) { if (id && cb) cb(id); }); }); }, Promise.resolve()).then(function () { self.renderPanel(); }); });
    i.click();
  };
  EP.bindKeys = function () {
    var self = this;
    this.on(document, 'keydown', function (e) {
      if (!self.root.isConnected || self.exporting) return;
      var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return; if (tag === 'button' && (e.key === ' ' || e.key === 'Enter')) return; if (!self.root.querySelector('.se-modal').hidden) return;
      var k = e.key, l = self.sel && self.find(self.sel), mod = e.ctrlKey || e.metaKey;
      if (k === ' ') { e.preventDefault(); self.toggle(); }
      else if (mod && k.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); self.undo(); }
      else if (mod && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); self.redo(); }
      else if (mod && k.toLowerCase() === 's') { e.preventDefault(); self.saveLocal(true); }
      else if (mod && k.toLowerCase() === 'd' && l) { e.preventDefault(); self.duplicate(l); }
      else if ((k === 'Delete' || k === 'Backspace') && (l || self.selTr)) { e.preventDefault(); if (l) self.remove(l); else self.removeTransition(self.selTr); }
      else if (l && /^Arrow/.test(k)) { e.preventDefault(); var st = e.shiftKey ? 10 : 1; if (k === 'ArrowLeft') l.x -= st; if (k === 'ArrowRight') l.x += st; if (k === 'ArrowUp') l.y -= st; if (k === 'ArrowDown') l.y += st; self.changed(); self.liveInspector(); }
      else if (k === 'Home') self.seek(0);
      else if (k === 'Escape') self.select(null);
    });
  };
  // after adding something while paused, move the playhead to where it's fully visible
  EP.showFully = function (el) { if (this.playing) return; var a = el.anim || {}; if (a.in && a.in !== 'none' && this.t < el.start + (a.inDur || 0.4)) { this.t = Math.min(el.end - 0.01, el.start + (a.inDur || 0.4) + 0.02); this.needs = true; } };
  EP.duplicate = function (l) { var c = clone(l); c.id = C.uid('el'); c.name = l.name + ' copy'; c.x += 30; c.y += 30; var i = this.P.layers.indexOf(l); this.P.layers.splice(i + 1, 0, c); this.select(c.id); this.changed(); this.renderTimeline(); };
  EP.remove = function (l) { var i = this.P.layers.indexOf(l); if (i >= 0) this.P.layers.splice(i, 1); this.select(null); this.changed(); this.renderTimeline(); };
  EP.addElement = function (type, props) {
    var P = this.P, el = C.newElement(type, P, Object.assign({ start: 0, end: P.duration }, clone(props || {})));
    if (props && props.anim === null) el.anim = { in: 'fade', inDur: 0.3, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1, loopSpeed: 1 };
    if (el.font) { var self = this; C.ensureFont(el.font, el.weight || 400).then(function () { self.needs = true; }); }
    if (el.accentFont) C.ensureFont(el.accentFont, 400);
    P.layers.push(el); this.showFully(el); this.select(el.id); this.changed(); this.renderTimeline();
    return el;
  };

  /* =========================================================
     FORM helpers (inspector + panels)
     ========================================================= */
  EP.fonts = function () { var P = this.P, own = Object.keys(P.media).map(function (k) { return P.media[k]; }).filter(function (m) { return m.kind === 'font'; }).map(function (m) { return m.family; }); return own.concat(C.FONTS); };
  EP.form = function (box, defs, obj, onChange) {
    var self = this, rows = [];
    defs.forEach(function (d) {
      var key = d[0], label = d[1], kind = d[2], opt = (kind === 'range' ? d[5] : d[3]) || {};
      if (key === 'head') { var hd = h('div', { class: 'tc-head' }, E(label)); box.appendChild(hd); rows.push([null, hd]); return; }
      if (kind === 'range') opt = d[6] || {};
      var row = h('label', { class: 'tc se-f' }), v = obj[key], id = 'f' + Math.random().toString(36).slice(2, 8);
      var lab = '<span class="tc-l">' + E(label) + (kind === 'range' ? ' <b data-v></b>' : '') + '</span>';
      if (kind === 'range') { var mn = d[3], mx = d[4], stp = d[5] && typeof d[5] === 'number' ? d[5] : (mx - mn > 20 ? 1 : 0.01); row.innerHTML = lab + '<span class="se-rng"><input type="range" min="' + mn + '" max="' + mx + '" step="' + stp + '" value="' + (v == null ? mn : v) + '"><input type="number" min="' + mn + '" max="' + mx + '" step="' + stp + '" value="' + (v == null ? mn : v) + '" aria-label="' + E(label) + '"></span>'; }
      else if (kind === 'text') row.innerHTML = lab + '<input type="text" value="' + E(v) + '" maxlength="200">';
      else if (kind === 'textarea') row.innerHTML = lab + '<textarea rows="3" maxlength="600">' + E(v) + '</textarea>';
      else if (kind === 'color' || kind === 'colorText' || kind === 'colorOrNone') {
        var isHex = /^#[0-9a-f]{6}$/i.test(v || '');
        row.innerHTML = lab + '<span class="tc-color"><input type="color" value="' + (isHex ? v : '#ffffff') + '"><input type="text" class="se-hex" value="' + E(v) + '" maxlength="40">' + (kind === 'colorOrNone' ? '<button type="button" class="se-mini" data-none>none</button>' : '') + '</span>';
      }
      else if (kind === 'toggle') { row.className += ' tc-inline'; row.innerHTML = '<input type="checkbox"' + (v ? ' checked' : '') + '><span class="tc-sw"></span><span class="tc-l">' + E(label) + '</span>'; }
      else if (kind === 'chips') { row = h('div', { class: 'tc se-f' }); row.innerHTML = lab + '<div class="tc-chips">' + d[3].map(function (o) { return '<button type="button" class="tchip' + (String(o[0]) === String(v) ? ' is-on' : '') + '" data-val="' + E(o[0]) + '">' + E(o[1]) + '</button>'; }).join('') + '</div>'; opt = d[4] || {}; }
      else if (kind === 'select' || kind === 'font' || kind === 'midisrc' || kind === 'track' || kind === 'channel' || kind === 'blend' || kind === 'anim' || kind === 'loopanim') {
        var opts = kind === 'font' ? self.fonts().map(function (f) { return [f, f]; }) : kind === 'midisrc' ? [['all', 'All MIDI']].concat(self.P.midis.map(function (m) { return [m.id, m.name]; })) : kind === 'track' ? [[-1, 'All tracks']].concat(self.trackOptions()) : kind === 'channel' ? [[-1, 'All channels']].concat(Array.apply(null, Array(16)).map(function (x, i) { return [i, 'Channel ' + (i + 1) + (i === 9 ? ' (drums)' : '')]; })) : kind === 'blend' ? BLENDS : kind === 'anim' ? C.IN_ANIMS : kind === 'loopanim' ? C.LOOP_ANIMS : d[3];
        row.innerHTML = lab + '<select>' + opts.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + (kind === 'font' ? ' style="font-family:\'' + E(o[0]) + '\'"' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>';
      }
      else if (kind === 'media') {
        var mm = self.P.media[v], nm = mm ? mm.name : obj.src ? String(obj.src).split('/').pop() : 'Empty';
        row = h('div', { class: 'tc se-f' }); row.innerHTML = lab + '<div class="se-mediapick"><span>' + E(nm) + '</span><button type="button" class="btn btn-sm btn-ghost" data-up>⬆ UPLOAD</button><button type="button" class="btn btn-sm btn-ghost" data-clear>✕</button></div>';
        row.querySelector('[data-up]').addEventListener('click', function () { self.pickFile(opt.kind === 'video' ? 'video/*' : 'image/*', function (mid) { obj.media = mid; obj.src = ''; onChange(key); self.renderInspector(); }); });
        row.querySelector('[data-clear]').addEventListener('click', function () { obj.media = ''; obj.src = ''; onChange(key); self.renderInspector(); });
      }
      if (opt.help) row.insertAdjacentHTML('beforeend', '<small class="tc-help">' + E(opt.help) + '</small>');
      // events
      var num = function (x) { return opt.num ? +x : x; };
      if (kind === 'range') {
        var r = row.querySelector('input[type=range]'), n = row.querySelector('input[type=number]');
        r.addEventListener('input', function () { obj[key] = +r.value; n.value = r.value; onChange(key, true); });
        n.addEventListener('change', function () { var x = +n.value; if (isNaN(x)) return; obj[key] = x; r.value = x; onChange(key); });
        r.addEventListener('change', function () { onChange(key); });
      } else if (kind === 'text' || kind === 'textarea') {
        var ti = row.querySelector('input,textarea'); ti.addEventListener('input', function () { obj[key] = ti.value; onChange(key, true); }); ti.addEventListener('change', function () { onChange(key); });
      } else if (kind === 'color' || kind === 'colorText' || kind === 'colorOrNone') {
        var ci = row.querySelector('input[type=color]'), hx = row.querySelector('.se-hex');
        ci.addEventListener('input', function () { obj[key] = ci.value; hx.value = ci.value; onChange(key, true); });
        ci.addEventListener('change', function () { onChange(key); });
        hx.addEventListener('change', function () { obj[key] = hx.value.trim(); if (/^#[0-9a-f]{6}$/i.test(hx.value.trim())) ci.value = hx.value.trim(); onChange(key); });
        var nb = row.querySelector('[data-none]'); if (nb) nb.addEventListener('click', function () { obj[key] = 'transparent'; hx.value = 'transparent'; onChange(key); });
      } else if (kind === 'toggle') { var cb = row.querySelector('input'); cb.addEventListener('change', function () { obj[key] = cb.checked; vis(); onChange(key); }); }
      else if (kind === 'chips') { row.querySelectorAll('.tchip').forEach(function (b) { b.addEventListener('click', function () { obj[key] = num(b.getAttribute('data-val')); row.querySelectorAll('.tchip').forEach(function (x) { x.classList.toggle('is-on', x === b); }); vis(); onChange(key); }); }); }
      else if (row.querySelector('select')) { var sl = row.querySelector('select'); sl.addEventListener('change', function () { var x = sl.value; obj[key] = (kind === 'track' || kind === 'channel' || opt.num) ? +x : x; if (kind === 'font') C.ensureFont(x, 400).then(function () { C.ensureFont(x, obj.weight || 400); self.needs = true; }); vis(); onChange(key); }); }
      if (kind === 'range') { var bv = row.querySelector('[data-v]'); if (bv) bv.remove(); }
      box.appendChild(row); rows.push([d, row, opt]);
    });
    function vis() { rows.forEach(function (r) { if (r[2] && r[2].show) r[1].hidden = !r[2].show(obj); }); }
    vis();
    return { refresh: function () { rows.forEach(function (r) { if (!r[0] || r[0][2] !== 'range') return; var v = obj[r[0][0]]; r[1].querySelectorAll('input').forEach(function (i) { if (document.activeElement !== i) i.value = v; }); }); } };
  };
  EP.trackOptions = function () {
    var out = [], self = this;
    this.P.midis.forEach(function (m) { var mm = self.midis[m.id]; if (!mm) return; mm.tracks.forEach(function (t) { if (!out.some(function (o) { return o[0] === t.index; })) out.push([t.index, (self.P.midis.length > 1 ? m.name.slice(0, 12) + ' · ' : '') + t.name + ' (' + t.notes + ')']); }); });
    return out;
  };

  /* =========================================================
     INSPECTOR (right side)
     ========================================================= */
  EP.renderInspector = function () {
    var self = this, box = this.insp, l = this.sel && this.find(this.sel);
    box.innerHTML = ''; this.liveForm = null;
    if (this.selTr) return this.renderTransitionInspector();
    if (!l) return this.renderProjectInspector();
    var on = function (k, light) { self.needs = true; if (k === 'x' || k === 'y' || k === 'w' || k === 'h' || k === 'rot') self.syncSel(); if (!light) self.changed(); else { self.dirty = true; } if (k === 'name') self.renderTimeline(); if (k === 'start' || k === 'end') self.renderTimeline(); };
    var head = h('div', { class: 'se-ihead' }, '<span class="se-ico">' + E(T[l.type].icon) + '</span><input type="text" value="' + E(l.name) + '" aria-label="Layer name" maxlength="40"><button type="button" title="Duplicate (Ctrl+D)" data-a="dup">⧉</button><button type="button" title="' + (l.hidden ? 'Show' : 'Hide') + '" data-a="hide">' + (l.hidden ? '◌' : '👁') + '</button><button type="button" title="' + (l.locked ? 'Unlock' : 'Lock') + '" data-a="lock">' + (l.locked ? '🔒' : '🔓') + '</button><button type="button" title="Delete" data-a="del">🗑</button>');
    head.querySelector('input').addEventListener('input', function (e) { l.name = e.target.value; on('name', true); });
    head.querySelector('input').addEventListener('change', function () { on('name'); });
    head.querySelectorAll('[data-a]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-a'); if (a === 'dup') self.duplicate(l); if (a === 'del') self.remove(l); if (a === 'hide') { l.hidden = !l.hidden; self.changed(); self.renderInspector(); self.renderTimeline(); } if (a === 'lock') { l.locked = !l.locked; self.changed(); self.renderInspector(); self.syncSel(); } }); });
    box.appendChild(head);
    var order = h('div', { class: 'se-order' }, '<button type="button" data-o="top">⤒ Front</button><button type="button" data-o="up">↑</button><button type="button" data-o="down">↓</button><button type="button" data-o="bottom">⤓ Back</button><button type="button" data-o="center">⊕ Center</button><button type="button" data-o="fill">⛶ Fill</button>');
    order.querySelectorAll('[data-o]').forEach(function (b) { b.addEventListener('click', function () { var L = self.P.layers, i = L.indexOf(l), o = b.getAttribute('data-o'); L.splice(i, 1); if (o === 'top') L.push(l); else if (o === 'bottom') L.unshift(l); else if (o === 'up') L.splice(Math.min(L.length, i + 1), 0, l); else if (o === 'down') L.splice(Math.max(0, i - 1), 0, l); else { L.splice(i, 0, l); if (o === 'center') { l.x = self.P.w / 2; l.y = self.P.h / 2; } if (o === 'fill') { l.x = self.P.w / 2; l.y = self.P.h / 2; l.w = self.P.w; l.h = self.P.h; l.rot = 0; } } self.changed(); self.renderTimeline(); self.renderInspector(); }); });
    box.appendChild(order);
    var sec = function (title, open) { var d = h('details', { class: 'se-sec' }); if (open) d.open = true; d.innerHTML = '<summary>' + E(title) + '</summary>'; var b = h('div', { class: 'se-secb' }); d.appendChild(b); box.appendChild(d); return b; };
    this.form(sec(T[l.type].label, true), FIELDS[l.type] || [], l, on);
    var tb = sec('Timing', true);
    this.form(tb, [['start', 'Starts at (s)', 'range', 0, this.P.duration, 0.01], ['end', 'Ends at (s)', 'range', 0, this.P.duration, 0.01]], l, function (k, light) { if (l.end <= l.start) l.end = Math.min(self.P.duration, l.start + 0.1); on(k, light); });
    var tbtn = h('div', { class: 'se-row' }, '<button type="button" class="se-mini" data-tt="s">Start at playhead</button><button type="button" class="se-mini" data-tt="e">End at playhead</button><button type="button" class="se-mini" data-tt="all">Whole video</button>');
    tbtn.querySelectorAll('[data-tt]').forEach(function (b) { b.addEventListener('click', function () { var w = b.getAttribute('data-tt'); if (w === 's') l.start = Math.min(round(self.t, 2), l.end - 0.1); if (w === 'e') l.end = Math.max(round(self.t, 2), l.start + 0.1); if (w === 'all') { l.start = 0; l.end = self.P.duration; } self.changed(); self.renderInspector(); self.renderTimeline(); }); });
    tb.appendChild(tbtn);
    if (!l.anim) l.anim = { in: 'none', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1, loopSpeed: 1 };
    this.form(sec('Animation', true), [['in', 'Comes in with', 'anim'], ['inDur', 'In time (s)', 'range', 0.05, 3, 0.05], ['out', 'Goes out with', 'anim'], ['outDur', 'Out time (s)', 'range', 0.05, 3, 0.05], ['loop', 'While on screen', 'loopanim'], ['loopAmt', 'Strength', 'range', 0, 3, 0.05], ['loopEvery', 'Every … beats', 'chips', [[0.5, '½'], [1, '1'], [2, '2'], [4, '4 (bar)']], { num: 1 }], ['loopSpeed', 'Speed', 'range', 0.1, 4, 0.1]], l.anim, on);
    this.liveForm = this.form(sec('Position & size'), [['x', 'X', 'range', -this.P.w * 0.5, this.P.w * 1.5, 1], ['y', 'Y', 'range', -this.P.h * 0.5, this.P.h * 1.5, 1], ['w', 'Width', 'range', 10, this.P.w * 2, 1], ['h', 'Height', 'range', 10, this.P.h * 2, 1], ['rot', 'Rotation', 'range', -180, 180, 1], ['opacity', 'Opacity', 'range', 0, 100, 1], ['blend', 'Blend mode', 'blend']], l, on);
    this.form(sec('Shadow & glow'), [['shadowOpacity', 'Shadow', 'range', 0, 100], ['shadowColor', 'Shadow colour', 'color'], ['shadowX', 'Shadow ↔', 'range', -60, 60], ['shadowY', 'Shadow ↕', 'range', -60, 60], ['shadowBlur', 'Shadow blur', 'range', 0, 80], ['glow', 'Glow', 'range', 0, 80], ['glowColor', 'Glow colour (uses element colours)', 'color']], l, on);
  };
  EP.liveInspector = function () { if (this.liveForm) this.liveForm.refresh(); };
  EP.renderProjectInspector = function () {
    var self = this, box = this.insp, P = this.P;
    box.innerHTML = '<div class="se-ihead"><span class="se-ico">🎬</span><b>PROJECT</b><small>Click something on the video to edit it</small></div>';
    var sec = function (title, open) { var d = h('details', { class: 'se-sec' }); if (open) d.open = true; d.innerHTML = '<summary>' + E(title) + '</summary>'; var b = h('div', { class: 'se-secb' }); d.appendChild(b); box.appendChild(d); return b; };
    var on = function (k, light) { self.needs = true; if (!light) self.changed(); else self.dirty = true; };
    var s1 = sec('Video', true);
    var rat = h('div', { class: 'tc se-f' }, '<span class="tc-l">Shape</span><div class="tc-chips">' + [['9:16', '9:16 Short'], ['4:5', '4:5'], ['1:1', '1:1'], ['16:9', '16:9']].map(function (o) { return '<button type="button" class="tchip' + (P.ratio === o[0] ? ' is-on' : '') + '" data-r="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>');
    rat.querySelectorAll('[data-r]').forEach(function (b) { b.addEventListener('click', function () { self.setRatio(b.getAttribute('data-r')); }); });
    s1.appendChild(rat);
    this.form(s1, [['duration', 'Length (s)', 'range', 1, Math.max(60, Math.ceil(this.an ? this.an.duration : 60)), 0.1]], P, function (k, light) { if (!light) { self.setDuration(P.duration); self.changed(); } else self.needs = true; });
    var bgS = sec('Background', true), bg = P.bg;
    this.form(bgS, [['type', 'Type', 'chips', [['color', 'Colour'], ['gradient', 'Gradient'], ['clouds', 'Soft clouds'], ['media', 'Picture/video']]], ['color', 'Colour', 'color'], ['color2', 'Colour 2', 'color', { show: function (b) { return b.type !== 'color' && b.type !== 'media'; } }], ['color3', 'Colour 3', 'color', { show: function (b) { return b.type === 'gradient' || b.type === 'clouds'; } }], ['color4', 'Colour 4', 'color', { show: function (b) { return b.type === 'clouds'; } }], ['angle', 'Angle', 'range', 0, 360, 1, { show: function (b) { return b.type === 'gradient'; } }], ['radial', 'Round gradient', 'toggle', { show: function (b) { return b.type === 'gradient'; } }], ['speed', 'Cloud speed', 'range', 0, 3, 0.05, { show: function (b) { return b.type === 'clouds'; } }], ['seed', 'Cloud shape', 'range', 1, 50, 1, { show: function (b) { return b.type === 'clouds'; } }], ['media', 'Picture or video', 'media', { kind: 'image', show: function (b) { return b.type === 'media'; } }], ['blur', 'Blur', 'range', 0, 80, 1, { show: function (b) { return b.type === 'media'; } }], ['zoom', 'Zoom %', 'range', 0, 100, 1, { show: function (b) { return b.type === 'media'; } }], ['pulse', 'Pump on beat', 'toggle', { show: function (b) { return b.type === 'media'; } }], ['dim', 'Darken / tint %', 'range', 0, 100], ['dimColor', 'Tint colour', 'color']], bg, function (k, light) { if (k === 'type') self.renderInspector(); on(k, light); });
    var vb = h('div', { class: 'se-row' }, '<button type="button" class="se-mini" data-bgv>⬆ Use a video as background</button>');
    vb.querySelector('[data-bgv]').addEventListener('click', function () { self.pickFile('video/*,image/*', function (id) { bg.type = 'media'; bg.media = id; self.changed(); self.renderInspector(); }); });
    bgS.appendChild(vb);
    this.form(sec('Camera & beat', true), [['bounce', 'Bounce on', 'chips', [['off', 'Off'], ['half', '½ beat'], ['beat', 'Every beat'], ['2beats', '2 beats'], ['bar', 'Every bar']]], ['amount', 'Bounce strength', 'range', 0, 20, 0.5], ['shake', 'Camera shake', 'range', 0, 30, 0.5], ['drift', 'Slow drift', 'range', 0, 10, 0.5]], P.camera, on);
    var bs = sec('Beat sync', true);
    this.form(bs, [['beatOffset', 'Beat offset (s) — move the beat grid', 'range', -2, 2, 0.005]], P, function (k, light) { on(k, light); if (!light) self.renderTimeline(); });
    var nb = h('div', { class: 'se-row' }, '<button type="button" class="se-mini" data-n="-0.01">−10ms</button><button type="button" class="se-mini" data-n="0.01">+10ms</button><button type="button" class="se-mini" data-n="beat">Beat 1 = playhead</button>');
    nb.querySelectorAll('[data-n]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-n'); if (v === 'beat') P.beatOffset = round(self.t % (60 / P.bpm), 3); else P.beatOffset = round((P.beatOffset || 0) + (+v), 3); self.changed(); self.renderInspector(); self.renderTimeline(); }); });
    bs.appendChild(nb);
    var fx = P.fx;
    var fxs = sec('Effects');
    this.form(fxs, [['grain', 'Film grain', 'range', 0, 100], ['vignette', 'Vignette', 'range', 0, 100], ['bloom', 'Glow (bloom)', 'range', 0, 100], ['rgb', 'RGB split', 'range', 0, 30], ['scanlines', 'Scanlines', 'range', 0, 100], ['glitch', 'Glitch', 'range', 0, 100], ['glitchOnBeat', 'Glitch only on beats', 'toggle'], ['tintAmt', 'Colour tint', 'range', 0, 100], ['tint', 'Tint colour', 'color'], ['head', 'Texture overlay'], ['texOpacity', 'Texture strength', 'range', 0, 100], ['texBlend', 'Texture blend', 'blend']], fx, on);
    var tx = h('div', { class: 'se-row' }, '<span class="tc-l">' + (fx.texture ? 'Texture: ' + E(String(fx.texture).replace(/^b:/, '').split('/').pop()) : 'No texture') + '</span><button type="button" class="se-mini" data-tx>Pick…</button>' + (fx.texture ? '<button type="button" class="se-mini" data-txx>✕</button>' : ''));
    tx.querySelector('[data-tx]').addEventListener('click', function () { self.tab = 'textures'; self.renderPanel(); });
    if (tx.querySelector('[data-txx]')) tx.querySelector('[data-txx]').addEventListener('click', function () { fx.texture = ''; self.loadTexture(); self.changed(); self.renderInspector(); });
    fxs.appendChild(tx);
    var trS = sec('Transitions (' + P.transitions.length + ')');
    trS.appendChild(h('p', { class: 'tc-help' }, 'Transitions hit the whole video at a moment (flash, bounce punch, glitch…). Add one at the playhead with the ✚ button above the timeline, then drag its ◆ marker.'));
    P.transitions.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (tr) {
      var r = h('div', { class: 'se-row se-trrow' }, '<button type="button" class="se-mini">◆ ' + E(C.fmtTime(tr.t)) + ' ' + E((C.TRANSITIONS.filter(function (x) { return x[0] === tr.type; })[0] || [0, tr.type])[1]) + '</button>');
      r.querySelector('button').addEventListener('click', function () { self.selTr = tr.id; self.sel = null; self.syncSel(); self.renderInspector(); self.markTimeline(); });
      trS.appendChild(r);
    });
  };
  EP.renderTransitionInspector = function () {
    var self = this, tr = this.P.transitions.filter(function (x) { return x.id === self.selTr; })[0];
    if (!tr) { this.selTr = null; return this.renderProjectInspector(); }
    this.insp.innerHTML = '<div class="se-ihead"><span class="se-ico">◆</span><b>TRANSITION</b><button type="button" data-del title="Delete">🗑</button><button type="button" data-back title="Back">✕</button></div>';
    this.insp.querySelector('[data-del]').addEventListener('click', function () { self.removeTransition(tr.id); });
    this.insp.querySelector('[data-back]').addEventListener('click', function () { self.selTr = null; self.renderInspector(); self.markTimeline(); });
    var b = h('div', { class: 'se-secb' }); this.insp.appendChild(b);
    this.form(b, [['type', 'Type', 'chips', C.TRANSITIONS], ['t', 'At (s)', 'range', 0, this.P.duration, 0.01], ['dur', 'Length (s)', 'range', 0.05, 2, 0.05], ['color', 'Flash colour', 'color', { show: function (x) { return x.type === 'flash'; } }]], tr, function (k, light) { self.needs = true; if (!light) { self.changed(); self.renderTimeline(); } });
    var pv = h('div', { class: 'se-row' }, '<button type="button" class="btn btn-sm" data-pv>▶ PREVIEW IT</button><button type="button" class="se-mini" data-snapb>Snap to nearest beat</button>');
    pv.querySelector('[data-pv]').addEventListener('click', function () { self.seek(Math.max(0, tr.t - 0.8)); self.play(); setTimeout(function () { if (self.playing && self.t > tr.t + 0.8) self.stop(); }, 1700); });
    pv.querySelector('[data-snapb]').addEventListener('click', function () { tr.t = self.snapT(tr.t, true); self.changed(); self.renderInspector(); self.renderTimeline(); });
    this.insp.appendChild(pv);
  };
  EP.addTransition = function () { var tr = { id: C.uid('tr'), t: this.snap ? this.snapT(this.t, true) : round(this.t, 2), type: 'bounce', dur: 0.4, color: '#ffffff' }; this.P.transitions.push(tr); this.selTr = tr.id; this.sel = null; this.syncSel(); this.changed(); this.renderInspector(); this.renderTimeline(); this.toast('Transition added — pick a type on the right'); };
  EP.removeTransition = function (id) { this.P.transitions = this.P.transitions.filter(function (x) { return x.id !== id; }); this.selTr = null; this.changed(); this.renderInspector(); this.renderTimeline(); };
  EP.setRatio = function (r) {
    var P = this.P, dims = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] }[r]; if (!dims) return;
    var kx = dims[0] / P.w, ky = dims[1] / P.h, k = Math.min(kx, ky);
    P.layers.forEach(function (l) { l.x *= kx; l.y *= ky; l.w *= k; l.h *= k; if (l.size) l.size *= k; });
    P.ratio = r; P.w = dims[0]; P.h = dims[1]; this.sizeStage(); this.changed(); this.renderInspector();
  };
  EP.snapT = function (t, force) {
    if (!this.snap && !force) return round(t, 2);
    var spb = 60 / this.P.bpm, off = this.P.beatOffset || 0, sub = spb / 2, s = off + Math.round((t - off) / sub) * sub;
    return round(clamp(s, 0, this.P.duration), 3);
  };

  /* =========================================================
     TIMELINE
     ========================================================= */
  EP.renderTimeline = function () {
    if (!this.P) return;
    var self = this, P = this.P, box = this.tlInner, W = this.tlScroll.clientWidth || 800, LW = this.tlLabelW = 150;
    var fit = (W - LW - 20) / P.duration, pps = this.pps = fit * Math.pow(12, this.zoom / 100);
    var total = LW + P.duration * pps + 20;
    box.style.width = total + 'px';
    var html = '<div class="se-tl-row se-ruler"><div class="se-tl-lab">TIME / BEATS</div><canvas class="se-tl-c" data-c="ruler" height="34"></canvas></div>' +
      '<div class="se-tl-row se-lane-audio"><div class="se-tl-lab">🎵 ' + E(P.audio && P.media[P.audio] ? P.media[P.audio].name : 'No audio') + '</div><canvas class="se-tl-c" data-c="audio" height="34"></canvas></div>' +
      '<div class="se-tl-row se-lane-midi"><div class="se-tl-lab">🎹 ' + E(P.midis.length ? P.midis.length + ' MIDI' : 'Demo notes') + '</div><canvas class="se-tl-c" data-c="midi" height="34"></canvas></div>' +
      '<div class="se-tl-row se-lane-tr"><div class="se-tl-lab">◆ Transitions</div><div class="se-tl-track" data-trlane>' + P.transitions.map(function (tr) { return '<button type="button" class="se-trm' + (tr.id === self.selTr ? ' on' : '') + '" data-tr="' + tr.id + '" style="left:' + (tr.t * pps) + 'px" title="' + E(tr.type) + '">◆</button>'; }).join('') + '</div></div>';
    for (var i = P.layers.length - 1; i >= 0; i--) {
      var l = P.layers[i];
      html += '<div class="se-tl-row se-layer' + (l.id === this.sel ? ' on' : '') + (l.hidden ? ' hid' : '') + '" data-id="' + l.id + '" draggable="false"><div class="se-tl-lab" data-lab><span class="se-grip" title="Drag to reorder">⠿</span><i>' + E(T[l.type] ? T[l.type].icon : '?') + '</i><span class="se-ln">' + E(l.name) + '</span><button type="button" data-eye title="Show/hide">' + (l.hidden ? '◌' : '👁') + '</button></div><div class="se-tl-track"><div class="se-bar t-' + l.type + '" style="left:' + (l.start * pps) + 'px;width:' + Math.max(6, (l.end - l.start) * pps) + 'px"><i data-edge="s"></i><span>' + E(l.name) + '</span><i data-edge="e"></i></div></div></div>';
    }
    html += '<div class="se-ph" style="left:' + (LW + this.t * pps) + 'px"><b></b></div>';
    box.innerHTML = html;
    // draw canvases
    box.querySelectorAll('canvas[data-c]').forEach(function (c) {
      var kind = c.getAttribute('data-c'), w = Math.ceil(P.duration * pps), dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = w * dpr; c.height = 34 * dpr; c.style.width = w + 'px'; c.style.height = '34px';
      var g = c.getContext('2d'); g.scale(dpr, dpr);
      var spb = 60 / P.bpm, off = P.beatOffset || 0;
      // beat lines
      for (var b = Math.ceil(-off / spb); off + b * spb <= P.duration; b++) {
        var x = (off + b * spb) * pps; if (x < 0) continue;
        var bar = b % 4 === 0; if (!bar && pps * spb < 8) continue;
        g.fillStyle = bar ? 'rgba(138,60,255,.45)' : 'rgba(138,60,255,.15)'; g.fillRect(x, kind === 'ruler' ? 18 : 0, 1, kind === 'ruler' ? 16 : 34);
        if (kind === 'ruler' && bar && pps * spb * 4 > 28) { g.fillStyle = '#8a3cff'; g.font = '10px "Silkscreen", monospace'; g.fillText(String(b / 4 + 1), x + 2, 30); }
      }
      if (kind === 'ruler') {
        g.fillStyle = '#2a1240'; g.font = '10px "Space Grotesk", sans-serif'; var step = pps > 80 ? 0.5 : pps > 30 ? 1 : pps > 12 ? 2 : 5;
        for (var s = 0; s <= P.duration; s += step) { var sx = s * pps; g.fillRect(sx, 0, 1, 8); if (s % (step * 2) === 0 || step >= 2) g.fillText(C.fmtTime(s), sx + 3, 11); }
      } else if (kind === 'audio' && self.an) {
        var pk = self.an.peaks, dur = self.an.duration; g.fillStyle = '#ff3fc8';
        for (var px = 0; px < w; px += 2) { var tt = px / pps + (P.audioStart || 0); if (tt > dur) break; var v = pk[Math.floor(tt / dur * pk.length)] || 0; g.fillRect(px, 17 - v * 15, 1.5, Math.max(1, v * 30)); }
      } else if (kind === 'midi') {
        var notes = self.notes(), lo = 127, hi = 0; notes.forEach(function (n) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); });
        g.fillStyle = P.midis.length ? '#8a3cff' : 'rgba(138,60,255,.35)';
        notes.forEach(function (n) { if (n.t > P.duration) return; var y = hi > lo ? 30 - (n.p - lo) / (hi - lo) * 26 : 16; g.fillRect(n.t * pps, y, Math.max(1.5, (n.e - n.t) * pps), 2.5); });
      }
    });
    this.bindTimeline();
  };
  EP.markTimeline = function () { var self = this; this.tlInner.querySelectorAll('.se-layer').forEach(function (r) { r.classList.toggle('on', r.getAttribute('data-id') === self.sel); }); this.tlInner.querySelectorAll('.se-trm').forEach(function (m) { m.classList.toggle('on', m.getAttribute('data-tr') === self.selTr); }); };
  EP.bindTimeline = function () {
    var self = this, box = this.tlInner, P = this.P, pps = this.pps, LW = this.tlLabelW;
    function tAt(e) { var r = box.getBoundingClientRect(); return clamp((e.clientX - r.left - LW) / pps, 0, P.duration); }
    // scrub
    box.querySelectorAll('.se-ruler, .se-lane-audio, .se-lane-midi').forEach(function (row) {
      row.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.se-tl-lab')) return;
        row.setPointerCapture(e.pointerId); var was = self.playing; if (was) self.stop(); self.t = tAt(e); self.needs = true;
        var mv = function (ev) { self.t = tAt(ev); self.needs = true; }, up = function () { row.removeEventListener('pointermove', mv); row.removeEventListener('pointerup', up); if (was) self.play(); };
        row.addEventListener('pointermove', mv); row.addEventListener('pointerup', up);
      });
    });
    // transitions
    box.querySelectorAll('[data-tr]').forEach(function (m) {
      m.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); var tr = P.transitions.filter(function (x) { return x.id === m.getAttribute('data-tr'); })[0]; if (!tr) return;
        self.selTr = tr.id; self.sel = null; self.syncSel(); self.renderInspector(); self.markTimeline();
        m.setPointerCapture(e.pointerId); var x0 = e.clientX, t0 = tr.t, moved = false;
        var mv = function (ev) { moved = true; var nt = clamp(t0 + (ev.clientX - x0) / pps, 0, P.duration); tr.t = self.snap ? self.snapT(nt) : round(nt, 2); m.style.left = tr.t * pps + 'px'; self.t = tr.t; self.needs = true; };
        var up = function () { m.removeEventListener('pointermove', mv); m.removeEventListener('pointerup', up); if (moved) { self.changed(); self.renderInspector(); } };
        m.addEventListener('pointermove', mv); m.addEventListener('pointerup', up);
      });
    });
    // layers
    box.querySelectorAll('.se-layer').forEach(function (row) {
      var id = row.getAttribute('data-id'), l = self.find(id); if (!l) return;
      row.querySelector('[data-eye]').addEventListener('click', function (e) { e.stopPropagation(); l.hidden = !l.hidden; self.changed(); self.renderTimeline(); if (self.sel === id) self.renderInspector(); });
      var lab = row.querySelector('[data-lab]');
      lab.addEventListener('pointerdown', function (e) {
        if (e.target.closest('[data-eye]')) return;
        self.select(id);
        if (!e.target.closest('.se-grip')) return;
        lab.setPointerCapture(e.pointerId); var rows = [].slice.call(box.querySelectorAll('.se-layer')), y0 = e.clientY, rh = row.offsetHeight, startIdx = rows.indexOf(row), target = startIdx;
        row.classList.add('dragging');
        var mv = function (ev) { var d = Math.round((ev.clientY - y0) / rh); target = clamp(startIdx + d, 0, rows.length - 1); row.style.transform = 'translateY(' + (ev.clientY - y0) + 'px)'; };
        var up = function () {
          lab.removeEventListener('pointermove', mv); lab.removeEventListener('pointerup', up); row.classList.remove('dragging'); row.style.transform = '';
          if (target !== startIdx) { var L = P.layers, li = L.indexOf(l); L.splice(li, 1); var newIdx = L.length - target; L.splice(clamp(newIdx, 0, L.length), 0, l); self.changed(); }
          self.renderTimeline();
        };
        lab.addEventListener('pointermove', mv); lab.addEventListener('pointerup', up);
      });
      var bar = row.querySelector('.se-bar');
      bar.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); if (self.sel !== id) self.select(id);
        var edge = e.target.getAttribute('data-edge'), x0 = e.clientX, s0 = l.start, e0 = l.end, len = e0 - s0, moved = false;
        bar.setPointerCapture(e.pointerId);
        var mv = function (ev) {
          moved = true; var d = (ev.clientX - x0) / pps;
          if (edge === 's') l.start = Math.min(e0 - 0.05, Math.max(0, self.snapT(s0 + d)));
          else if (edge === 'e') l.end = Math.max(s0 + 0.05, Math.min(P.duration, self.snapT(e0 + d)));
          else { var ns = clamp(self.snapT(s0 + d), 0, P.duration - len); l.start = ns; l.end = round(ns + len, 3); }
          bar.style.left = l.start * pps + 'px'; bar.style.width = Math.max(6, (l.end - l.start) * pps) + 'px'; self.needs = true; self.syncSel();
        };
        var up = function () { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); if (moved) { self.changed(); self.renderInspector(); } };
        bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up);
      });
      row.querySelector('.se-tl-track').addEventListener('pointerdown', function (e) { if (e.target.closest('.se-bar')) return; self.select(id); self.seek(tAt(e)); });
    });
  };

  /* =========================================================
     LEFT PANELS
     ========================================================= */
  EP.renderPanel = function () {
    var self = this, p = this.panel; if (!this.P) return;
    this.root.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === self.tab); b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === self.tab)); });
    p.innerHTML = ''; p.scrollTop = 0;
    this['panel_' + this.tab](p);
  };
  EP.panel_templates = function (p) {
    var self = this, ec = this.cfg.editor || {}, hidden = ec.hiddenTemplates || [];
    p.innerHTML = '<div class="tc-head">Templates <small>free — then change anything</small></div><div class="se-tpls"></div>';
    var grid = p.querySelector('.se-tpls'), list = C.TEMPLATES.filter(function (t) { return hidden.indexOf(t.id) < 0; }).map(function (t) { return { id: t.id, name: t.name, desc: t.desc, build: t.build }; });
    (ec.templates || []).forEach(function (t, i) { if (t && t.json) list.unshift({ id: 'custom' + i, name: t.name || 'Template', desc: t.desc || '', custom: t }); });
    list.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'se-tpl' }), cv = C.mk(108, 192);
      b.appendChild(cv); b.insertAdjacentHTML('beforeend', '<b>' + E(t.name) + '</b><small>' + E(t.desc) + '</small>');
      grid.appendChild(b);
      var P0 = null;
      var build = function () { if (t.custom) { try { var j = typeof t.custom.json === 'string' ? JSON.parse(t.custom.json) : t.custom.json; return (j.project || j); } catch (e) { return null; } } return t.build(); };
      setTimeout(function () { P0 = build(); if (!P0) return; try { C.renderFrame(cv, P0, { t: Math.min(3, P0.duration * 0.4), P: P0, notes: C.midiNotes({ midis: [{ id: '__demo', mode: 'project', offset: 0 }], bpm: P0.bpm }, { __demo: C.demoMidi(P0.bpm) }), an: null, media: self.mediaFn(), edit: false }); } catch (e) { } }, 30);
      b.addEventListener('click', function () {
        var P = build(); if (!P) return self.toast('That template is broken', true);
        P = clone(P); P.id = C.uid('p');
        // keep the person's music & MIDI
        var cur = self.P;
        if (cur && (cur.audio || cur.midis.length)) {
          if (cur.audio) { P.media[cur.audio] = cur.media[cur.audio]; P.audio = cur.audio; P.audioStart = cur.audioStart; P.audioVol = cur.audioVol; }
          cur.midis.forEach(function (m) { P.media[m.id] = cur.media[m.id]; P.midis.push(clone(m)); });
          P.bpm = cur.bpm; P.beatOffset = cur.beatOffset;
          if (self.an) { var keepD = P.duration; P.duration = Math.max(keepD, Math.min(60, round(self.an.duration - (P.audioStart || 0), 2))); P.layers.forEach(function (l) { if (Math.abs(l.end - keepD) < 0.05) l.end = P.duration; }); }
        }
        self.load(P, true); self.t = Math.min(2.5, P.duration * 0.4); self.needs = true; self.toast('Template “' + t.name + '” loaded ✦ — click things to change them');
      });
    });
  };
  EP.panel_add = function (p) {
    var self = this;
    ADD_GROUPS.forEach(function (g) {
      p.insertAdjacentHTML('beforeend', '<div class="tc-head">' + E(g[0]) + '</div>');
      var row = h('div', { class: 'se-addgrid' });
      g[1].forEach(function (it) {
        var b = h('button', { type: 'button', class: 'se-add' }, '<i>' + E(T[it[0]].icon) + '</i><span>' + E(it[1]) + '</span>');
        b.addEventListener('click', function () { var el = self.addElement(it[0], it[2]); if (it[0] === 'image' || it[0] === 'video') self.toast('Slot added — drop a ' + (it[0] === 'video' ? 'video' : 'picture') + ' on it, or upload in the panel on the right'); });
        row.appendChild(b);
      });
      p.appendChild(row);
    });
    p.insertAdjacentHTML('beforeend', '<p class="tc-help">Tip: drag pictures, videos, songs or MIDI files straight from your computer onto the video.</p>');
  };
  EP.panel_music = function (p) {
    var self = this, P = this.P;
    p.innerHTML = '<div class="tc-head">Your audio</div><div class="se-aud"></div><div class="tc-head">MIDI <small>drives the note visuals</small></div><div class="se-mids"></div><div class="tc-head">Tempo</div><div class="se-tempo"></div>';
    var a = p.querySelector('.se-aud');
    if (P.audio && P.media[P.audio]) {
      a.innerHTML = '<div class="se-file">🎵 <b>' + E(P.media[P.audio].name) + '</b>' + (this.an ? '<small>' + C.fmtTime(this.an.duration) + '</small>' : '<small>loading…</small>') + '<button type="button" class="se-mini" data-rm>✕</button></div>';
      a.querySelector('[data-rm]').addEventListener('click', function () { self.stop(); P.audio = null; self.an = null; self.audioBuf = null; self.changed(); self.renderPanel(); self.renderTimeline(); });
      this.form(a, [['audioStart', 'Start the song at (s)', 'range', 0, Math.max(1, this.an ? Math.floor(this.an.duration) : 60), 0.01], ['audioVol', 'Volume', 'range', 0, 150, 1]], P, function (k, light) { self.needs = true; if (!light) { self.changed(); self.renderTimeline(); if (self.playing) { self.stop(); self.play(); } } });
      var fit = h('div', { class: 'se-row' }, '<button type="button" class="se-mini" data-fit>Make video as long as the song</button><button type="button" class="se-mini" data-fit30>30 s</button><button type="button" class="se-mini" data-fit15>15 s</button>');
      fit.querySelector('[data-fit]').addEventListener('click', function () { if (self.an) { self.setDuration(round(self.an.duration - (P.audioStart || 0), 2)); self.changed(); self.renderInspector(); } });
      fit.querySelector('[data-fit30]').addEventListener('click', function () { self.setDuration(30); self.changed(); self.renderInspector(); });
      fit.querySelector('[data-fit15]').addEventListener('click', function () { self.setDuration(15); self.changed(); self.renderInspector(); });
      a.appendChild(fit);
    }
    var up = h('button', { type: 'button', class: 'btn btn-sm' }, '⬆ ' + (P.audio ? 'CHANGE' : 'ADD') + ' AUDIO');
    up.addEventListener('click', function () { self.pickFile('audio/*,video/*,.mp3,.wav,.m4a,.ogg,.flac', null); });
    a.appendChild(up); a.insertAdjacentHTML('beforeend', '<small class="tc-help">MP3, WAV, M4A… or a video (its sound is used).</small>');
    var m = p.querySelector('.se-mids');
    P.midis.forEach(function (mr, i) {
      var mm = self.midis[mr.id], card = h('div', { class: 'se-midi' });
      card.innerHTML = '<div class="se-file">🎹 <b>' + E(mr.name) + '</b><small>' + (mm ? mm.notes.length + ' notes · ' + mm.bpm + ' BPM in file' : 'loading…') + '</small><button type="button" class="se-mini" data-rm>✕</button></div>';
      card.querySelector('[data-rm]').addEventListener('click', function () { P.midis.splice(i, 1); self.changed(); self.renderPanel(); self.renderTimeline(); self.renderInspector(); });
      self.form(card, [['mode', 'Timing', 'chips', [['file', 'Use the file\'s tempo'], ['project', 'Stretch to project BPM']]], ['offset', 'Shift (s)', 'range', -10, 30, 0.005], ['transpose', 'Transpose', 'range', -24, 24, 1]], mr, function (k, light) { self.needs = true; if (!light) { self.changed(); self.renderTimeline(); } });
      var nb = h('div', { class: 'se-row' }, '<button type="button" class="se-mini" data-n="-0.05">−50ms</button><button type="button" class="se-mini" data-n="-0.01">−10ms</button><button type="button" class="se-mini" data-n="0.01">+10ms</button><button type="button" class="se-mini" data-n="0.05">+50ms</button><button type="button" class="se-mini" data-n="beat">+1 beat</button><button type="button" class="se-mini" data-n="ph">Start at playhead</button>');
      nb.querySelectorAll('[data-n]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-n'); if (v === 'beat') mr.offset = round((mr.offset || 0) + 60 / P.bpm, 3); else if (v === 'ph') mr.offset = round(self.t, 3); else mr.offset = round((mr.offset || 0) + (+v), 3); self.changed(); self.renderPanel(); self.renderTimeline(); }); });
      card.appendChild(nb);
      if (mm) { var bb = h('button', { type: 'button', class: 'se-mini' }, 'Use this file\'s BPM (' + mm.bpm + ')'); bb.addEventListener('click', function () { P.bpm = mm.bpm; self.root.querySelector('[data-bpm]').value = P.bpm; self.changed(); self.renderTimeline(); }); card.appendChild(bb); }
      m.appendChild(card);
    });
    var mu = h('button', { type: 'button', class: 'btn btn-sm' }, '⬆ ADD MIDI FILE'); mu.addEventListener('click', function () { self.pickFile('.mid,.midi,audio/midi,audio/x-midi', null, true); });
    m.appendChild(mu);
    if (!P.midis.length) { var dm = h('label', { class: 'tc tc-inline' }, '<input type="checkbox"' + (P.demoNotes !== false ? ' checked' : '') + '><span class="tc-sw"></span><span class="tc-l">Show demo notes until I add MIDI</span>'); dm.querySelector('input').addEventListener('change', function (e) { P.demoNotes = e.target.checked; self.changed(); self.renderTimeline(); }); m.appendChild(dm); }
    m.insertAdjacentHTML('beforeend', '<small class="tc-help">Export the MIDI of your melody/drums from FL Studio (right-click the pattern ▸ Export as MIDI) and drop it here. Use “Shift” or the buttons to line it up with the audio — turn on 🥁 click track to check.</small>');
    var tp = p.querySelector('.se-tempo');
    this.form(tp, [['bpm', 'BPM', 'range', 40, 300, 0.1], ['beatOffset', 'Beat offset (s)', 'range', -2, 2, 0.005]], P, function (k, light) { self.root.querySelector('[data-bpm]').value = P.bpm; self.needs = true; if (!light) { self.changed(); self.renderTimeline(); } });
    var hb = h('div', { class: 'se-row' }, '<button type="button" class="se-mini" data-h="0.5">×½</button><button type="button" class="se-mini" data-h="2">×2</button><button type="button" class="se-mini" data-h="auto">AUTO detect</button>');
    hb.querySelectorAll('[data-h]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-h'); if (v === 'auto') return self.root.querySelector('[data-detect]').click(); P.bpm = round(clamp(P.bpm * +v, 40, 300), 1); self.root.querySelector('[data-bpm]').value = P.bpm; self.changed(); self.renderPanel(); self.renderTimeline(); }); });
    tp.appendChild(hb);
  };
  function dragAsset(el, data) { el.draggable = true; el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('application/x-sul-asset', JSON.stringify(data)); e.dataTransfer.effectAllowed = 'copy'; }); }
  EP.panel_assets = function (p) {
    var self = this, list = ((this.cfg.editor || {}).assets || []).filter(function (a) { return a && a.src && a.enabled !== false; });
    p.innerHTML = '<div class="tc-head">Free assets <small>drag onto the video</small></div>';
    if (!list.length) { p.insertAdjacentHTML('beforeend', '<p class="tc-help">No assets yet. (Site owner: add them in the admin ▸ 🎬 Short Editor.)</p>'); return; }
    var cats = {}; list.forEach(function (a) { var c = a.category || 'Assets'; (cats[c] = cats[c] || []).push(a); });
    Object.keys(cats).forEach(function (c) {
      if (Object.keys(cats).length > 1) p.insertAdjacentHTML('beforeend', '<div class="se-cat">' + E(c) + '</div>');
      var grid = h('div', { class: 'se-assets' });
      cats[c].forEach(function (a) {
        var b = h('button', { type: 'button', class: 'se-asset', title: (a.name || '') + ' — click or drag' }, '<img alt="" loading="lazy"><span>' + E(a.name || '') + '</span>');
        b.querySelector('img').src = self.api.asset(a.src);
        b.addEventListener('click', function () { self.useAsset({ src: a.src, name: a.name, kind: 'image' }, null, self.sel && self.find(self.sel) && self.find(self.sel).type === 'image' && !self.find(self.sel).src && !self.find(self.sel).media ? self.find(self.sel) : null); });
        dragAsset(b, { src: a.src, name: a.name, kind: 'image' });
        grid.appendChild(b);
      });
      p.appendChild(grid);
    });
  };
  EP.panel_textures = function (p) {
    var self = this, ec = this.cfg.editor || {}, tc = this.cfg.tools || {}, list = [];
    (ec.textures || []).forEach(function (t) { if (t && t.src && t.enabled !== false) list.push({ src: t.src, name: t.name }); });
    if (ec.useToolTextures !== false) (tc.textures || []).forEach(function (t) { if (t && t.src && t.enabled !== false) list.push({ src: t.src, name: t.name }); });
    var hiddenB = Array.isArray(tc.hiddenTextures) ? tc.hiddenTextures : [];
    if (window.PixFX && ec.builtinTextures !== false) PixFX.BUILTIN_TEX.forEach(function (b) { if (hiddenB.indexOf(b[0]) < 0) list.push({ src: 'b:' + b[0], name: b[1], builtin: b[0] }); });
    p.innerHTML = '<div class="tc-head">Textures <small>click = overlay the whole video</small></div><div class="se-assets"></div>';
    var grid = p.querySelector('.se-assets'), fx = this.P.fx;
    list.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'se-asset' + (fx.texture === t.src ? ' on' : ''), title: t.name });
      if (t.builtin) { var c = PixFX.builtinTexture(t.builtin, 120, 120); b.appendChild(c); } else { b.innerHTML = '<img alt="" loading="lazy">'; b.firstChild.src = self.api.asset(t.src); }
      b.insertAdjacentHTML('beforeend', '<span>' + E(t.name || '') + '</span>');
      b.addEventListener('click', function () { self.useAsset({ src: t.src, kind: 'texture' }); self.renderPanel(); });
      dragAsset(b, { src: t.src, name: t.name, kind: 'texture' });
      grid.appendChild(b);
    });
    var f = h('div', { class: 'se-secb' }); p.appendChild(f);
    this.form(f, [['texOpacity', 'Strength', 'range', 0, 100], ['texBlend', 'Blend mode', 'blend']], fx, function (k, light) { self.needs = true; if (!light) self.changed(); });
    var off = h('button', { type: 'button', class: 'se-mini' }, '✕ No texture'); off.addEventListener('click', function () { fx.texture = ''; self.loadTexture(); self.changed(); self.renderPanel(); }); p.appendChild(off);
  };
  EP.panel_uploads = function (p) {
    var self = this, P = this.P, ids = Object.keys(P.media);
    p.innerHTML = '<div class="tc-head">My files <small>in this project</small></div>';
    var up = h('button', { type: 'button', class: 'btn btn-sm' }, '⬆ UPLOAD FILES'); up.addEventListener('click', function () { self.pickFile('image/*,video/*,audio/*,.mid,.midi,.ttf,.otf,.woff,.woff2', null, true); });
    p.appendChild(up); p.insertAdjacentHTML('beforeend', '<small class="tc-help">Pictures, GIFs, videos, audio, MIDI and fonts (.ttf/.otf). They stay on your device.</small>');
    var grid = h('div', { class: 'se-assets' }); p.appendChild(grid);
    ids.forEach(function (id) {
      var m = P.media[id], rec = self.media[id], b = h('button', { type: 'button', class: 'se-asset', title: m.name });
      if (m.kind === 'image' && rec && rec.url) b.innerHTML = '<img alt="">'; else b.innerHTML = '<em>' + ({ video: '🎞', audio: '🎵', midi: '🎹', font: 'Aa' }[m.kind] || '?') + '</em>';
      if (b.querySelector('img')) b.querySelector('img').src = rec.url;
      b.insertAdjacentHTML('beforeend', '<span>' + E(m.name) + '</span>');
      b.addEventListener('click', function () { if (m.kind === 'image' || m.kind === 'video') self.placeMedia(id, m.kind, null, self.sel && self.find(self.sel)); else if (m.kind === 'font') self.toast('Pick “' + m.family + '” in any text’s font list'); else self.toast('Already in use — see 🎵 Music & MIDI'); });
      if (m.kind === 'image' || m.kind === 'video') { b.draggable = true; b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('application/x-sul-asset', JSON.stringify({ media: id, kind: m.kind })); }); }
      grid.appendChild(b);
    });
  };
  // (assets dragged from "My files" carry a media id)
  var _useAsset = EP.useAsset;
  EP.useAsset = function (a, p, target) { if (a && a.media) return this.placeMedia(a.media, a.kind, p, target); return _useAsset.call(this, a, p, target); };

  /* =========================================================
     SAVE / LOAD (this browser + file)
     ========================================================= */
  EP.thumb = function () { var c = C.mk(180, Math.round(180 * this.P.h / this.P.w)); try { this.frame(c, Math.min(this.t || 2, this.P.duration), false); return c.toDataURL('image/jpeg', 0.6); } catch (e) { return ''; } };
  EP.saveLocal = function (loud) {
    var self = this, P = this.P; if (!P) return Promise.resolve();
    this.dirty = false;
    return store.putProject({ id: P.id, name: P.name, updated: Date.now(), thumb: this.thumb(), json: JSON.stringify(P) }).then(function () { try { localStorage.setItem('sul.short.last', P.id); } catch (e) { } if (loud) self.toast('Saved in this browser ✓'); })
      .catch(function (e) { self.dirty = true; if (loud) self.toast('Couldn\'t save (' + (e.message || e) + ')', true); });
  };
  EP.openRecord = function (rec) { var P = JSON.parse(rec.json); return this.load(P); };
  EP.modal = function (html) {
    var m = this.root.querySelector('.se-modal'), self = this; m.hidden = false; m.innerHTML = '<div class="se-mbox panel"><button type="button" class="se-mx" aria-label="Close">✕</button>' + html + '</div>';
    m.querySelector('.se-mx').addEventListener('click', function () { self.closeModal(); });
    m.onclick = function (e) { if (e.target === m && !self.exporting) self.closeModal(); };
    return m.querySelector('.se-mbox');
  };
  EP.closeModal = function () { var m = this.root.querySelector('.se-modal'); m.hidden = true; m.innerHTML = ''; };
  EP.projectsDialog = function () {
    var self = this;
    this.saveLocal().then(function () { return store.allProjects(); }).then(function (all) {
      all.sort(function (a, b) { return b.updated - a.updated; });
      var box = self.modal('<h2 class="sec-title">PROJECTS</h2><div class="se-row"><button type="button" class="btn btn-sm" data-new>✚ NEW (BLANK)</button><button type="button" class="btn btn-sm btn-ghost" data-tpl>🧩 FROM TEMPLATE</button><button type="button" class="btn btn-sm btn-ghost" data-file>⬇ DOWNLOAD THIS PROJECT</button><button type="button" class="btn btn-sm btn-ghost" data-open>⬆ OPEN A PROJECT FILE</button></div>' +
        (self.cloud && self.cloud.ok ? '<div class="se-cloudrow"></div>' : '') + '<div class="tc-head">Saved in this browser</div><div class="se-plist"></div><p class="tc-help">Projects (and your uploaded files) are saved automatically in this browser. To move a project to another device, download it as a file' + (self.cloud && self.cloud.ok ? ' or save it to your account' : '') + '.</p>');
      var list = box.querySelector('.se-plist');
      if (!all.length) list.innerHTML = '<p class="muted">Nothing saved yet.</p>';
      all.forEach(function (r) {
        var it = h('div', { class: 'se-pitem' + (r.id === self.P.id ? ' on' : '') }, (r.thumb ? '<img alt="">' : '<i></i>') + '<div><b>' + E(r.name || 'Untitled') + '</b><small>' + new Date(r.updated).toLocaleString() + '</small></div><button type="button" class="btn btn-sm" data-o>OPEN</button><button type="button" class="se-mini" data-d>⧉</button><button type="button" class="se-mini" data-x>🗑</button>');
        if (r.thumb) it.querySelector('img').src = r.thumb;
        it.querySelector('[data-o]').addEventListener('click', function () { self.closeModal(); self.openRecord(r); });
        it.querySelector('[data-d]').addEventListener('click', function () { var P = JSON.parse(r.json); P.id = C.uid('p'); P.name = (P.name || 'Project') + ' copy'; store.putProject({ id: P.id, name: P.name, updated: Date.now(), thumb: r.thumb, json: JSON.stringify(P) }).then(function () { self.projectsDialog(); }); });
        it.querySelector('[data-x]').addEventListener('click', function () { if (!confirm('Delete “' + (r.name || 'Untitled') + '” from this browser?')) return; store.delProject(r.id).then(function () { if (r.id === self.P.id) { self.load(C.TEMPLATES[C.TEMPLATES.length - 1].build(), true); } self.projectsDialog(); }); });
        list.appendChild(it);
      });
      box.querySelector('[data-new]').addEventListener('click', function () { self.closeModal(); self.load(C.newProject({ name: 'Untitled' }), true); });
      box.querySelector('[data-tpl]').addEventListener('click', function () { self.closeModal(); self.tab = 'templates'; self.renderPanel(); });
      box.querySelector('[data-file]').addEventListener('click', function () { self.exportProjectFile(); });
      box.querySelector('[data-open]').addEventListener('click', function () { self.importProjectFile(); });
      if (self.cloud && self.cloud.ok) self.cloudProjects(box.querySelector('.se-cloudrow'));
    }).catch(function (e) { self.toast('Couldn\'t open saved projects: ' + (e.message || e), true); });
  };
  function blobToDataURL(b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(b); }); }
  EP.exportProjectFile = function () {
    var self = this, P = this.P, out = { app: 'sul-short', v: 1, project: P, files: {} };
    this.toast('Packing project…');
    Promise.all(Object.keys(P.media).map(function (id) { var r = self.media[id]; if (!r || !r.blob || P.media[id].src) return null; return blobToDataURL(r.blob).then(function (d) { out.files[id] = d; }); }))
      .then(function () { download(new Blob([JSON.stringify(out)], { type: 'application/json' }), safeName(P.name) + '.sulshort'); self.toast('Project file downloaded ✓'); });
  };
  EP.importProjectFile = function () {
    var self = this, i = h('input', { type: 'file', accept: '.sulshort,application/json' }); i.style.display = 'none'; document.body.appendChild(i);
    i.addEventListener('change', function () {
      var f = i.files[0]; i.remove(); if (!f) return;
      f.text().then(function (txt) { var j = JSON.parse(txt); if (!j.project || !j.project.layers) throw new Error('Not a SHORT EDITOR project'); return self.openPacked(j); })
        .then(function () { self.closeModal(); self.toast('Project opened ✓'); })
        .catch(function (e) { self.toast('Couldn\'t open: ' + (e.message || e), true); });
    });
    i.click();
  };
  EP.openPacked = function (j) {
    var self = this, P = j.project; P.id = P.id || C.uid('p');
    return Promise.all(Object.keys(j.files || {}).map(function (id) { return fetch(j.files[id]).then(function (r) { return r.blob(); }).then(function (b) { return store.putBlob(id, b); }); }))
      .then(function () { Object.keys(self.media).forEach(function (k) { if (self.media[k].kind !== 'image' || !/^url:/.test(k)) delete self.media[k]; }); return self.load(P, true); }).then(function () { return self.saveLocal(); });
  };

  /* =========================================================
     EXPORT VIDEO
     ========================================================= */
  // MediaRecorder WebM files have no length written in them — add it so players can seek
  function fixWebmDuration(blob, ms) {
    return blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab), p = -1;
      for (var i = 0; i < u.length - 4; i++) if (u[i] === 0x15 && u[i + 1] === 0x49 && u[i + 2] === 0xa9 && u[i + 3] === 0x66) { p = i; break; }
      if (p < 0) return blob;
      var s = p + 4, first = u[s], len = 1; while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
      if (len > 8) return blob;
      var size = first & (0xff >> len); for (var k = 1; k < len; k++) size = size * 256 + u[s + k];
      var body = u.subarray(s + len, s + len + size);
      for (var j = 0; j < body.length - 1; j++) if (body[j] === 0x44 && body[j + 1] === 0x89) return blob; // already has one
      var ns = size + 11; if (ns >= Math.pow(2, 7 * len) - 1) return blob;
      var sizeBytes = []; for (k = len - 1; k >= 0; k--) { sizeBytes[k] = ns & 255; ns = Math.floor(ns / 256); } sizeBytes[0] |= 0x80 >> (len - 1);
      var dur = new DataView(new ArrayBuffer(8)); dur.setFloat64(0, ms);
      var el = new Uint8Array([0x44, 0x89, 0x88].concat(Array.from(new Uint8Array(dur.buffer))));
      return new Blob([blob.slice(0, s), new Uint8Array(sizeBytes), el, blob.slice(s + len)], { type: blob.type });
    }).catch(function () { return blob; });
  }
  function pickMime() {
    if (!window.MediaRecorder) return null;
    var c = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01F,mp4a.40.2"', 'video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return c[i];
    return null;
  }
  EP.exportDialog = function () {
    var self = this, mime = pickMime(), P = this.P;
    if (!mime || !HTMLCanvasElement.prototype.captureStream) { this.modal('<h2 class="sec-title">EXPORT</h2><p>This browser can\'t record video. Please use Chrome, Edge or Firefox on a computer.</p>'); return; }
    this.stop();
    var box = this.modal('<h2 class="sec-title">EXPORT VIDEO</h2><div class="se-exp"></div><div class="progress" hidden><i></i><span></span></div><div class="se-row"><button type="button" class="btn" data-go>⬇ EXPORT ' + (/mp4/.test(mime) ? 'MP4' : 'WEBM') + '</button><button type="button" class="btn btn-ghost" data-png>🖼 SAVE THIS FRAME (PNG)</button></div><p class="tc-help">The video is recorded in real time (' + C.fmtTime(P.duration) + '). Keep this tab open and in front until it finishes.' + (/mp4/.test(mime) ? '' : ' Your browser saves WebM — TikTok, Instagram and YouTube accept it; for MP4 use a recent Chrome or Safari.') + '</p>');
    var S = { res: P.w >= 1080 ? 1080 : 720, fps: 30, quality: 'high' };
    this.form(box.querySelector('.se-exp'), [['res', 'Resolution', 'chips', [[720, '720p'], [1080, '1080p (best)']], { num: 1 }], ['fps', 'Frame rate', 'chips', [[30, '30 fps'], [60, '60 fps']], { num: 1 }], ['quality', 'Quality', 'chips', [['normal', 'Normal'], ['high', 'High'], ['max', 'Max']]]], S, function () { });
    box.querySelector('[data-png]').addEventListener('click', function () { var c = C.mk(P.w, P.h); self.frame(c, self.t, false); c.toBlob(function (b) { download(b, safeName(P.name) + '-' + Math.round(self.t * 100) / 100 + 's.png'); }, 'image/png'); });
    box.querySelector('[data-go]').addEventListener('click', function () { this.disabled = true; self.exportVideo(S, mime, box); });
  };
  EP.exportVideo = function (S, mime, box) {
    var self = this, P = this.P, short = Math.min(P.w, P.h), k = S.res / short, W = Math.round(P.w * k / 2) * 2, H = Math.round(P.h * k / 2) * 2;
    var cv = C.mk(W, H), ac = this.ctx(), prog = box.querySelector('.progress');
    var stream = cv.captureStream(S.fps), dest = ac.createMediaStreamDestination(), src = null;
    if (this.audioBuf) { src = ac.createBufferSource(); src.buffer = this.audioBuf; var g = ac.createGain(); g.gain.value = (P.audioVol == null ? 100 : P.audioVol) / 100; src.connect(g); g.connect(dest); }
    // keep the sound track "alive" even when there's no audio (some recorders stall on a silent track)
    var hum = ac.createConstantSource ? ac.createConstantSource() : ac.createOscillator(), hg = ac.createGain(); hg.gain.value = 0.00001; if (hum.offset) hum.offset.value = 0.0001; hum.connect(hg); hg.connect(dest); hum.start();
    var tracks = stream.getVideoTracks().concat(dest.stream.getAudioTracks());
    var bits = { normal: 6e6, high: 12e6, max: 24e6 }[S.quality] * (S.res >= 1080 ? 1 : 0.55) * (S.fps === 60 ? 1.5 : 1);
    var rec; try { rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: Math.round(bits), audioBitsPerSecond: 256000 }); } catch (e) { rec = new MediaRecorder(new MediaStream(tracks)); }
    var chunks = [], fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    this.exporting = true; prog.hidden = false;
    var done = function (ok) {
      self.exporting = false; try { if (src) src.stop(); } catch (e) { } try { hum.stop(); hum.disconnect(); } catch (e) { }
      stream.getTracks().forEach(function (t) { t.stop(); });
      if (!ok) { prog.querySelector('span').textContent = 'Stopped'; return; }
    };
    rec.onstop = function () {
      done(true);
      var type = (rec.mimeType || mime).split(';')[0], blob0 = new Blob(chunks, { type: type });
      (/webm/.test(type) ? fixWebmDuration(blob0, P.duration * 1000) : Promise.resolve(blob0)).then(function (blob) {
        download(blob, safeName(P.name) + (/mp4/.test(type) ? '.mp4' : '.webm'));
        prog.querySelector('i').style.width = '100%'; prog.querySelector('span').textContent = 'Done ✓ ' + Math.round(blob.size / 1048576 * 10) / 10 + ' MB';
      });
      self.toast('Video exported ✦'); self.api.burst && self.api.burst(innerWidth / 2, innerHeight / 2, 30); self.needs = true;
      var b = box.querySelector('[data-go]'); if (b) b.disabled = false;
    };
    var cancel = h('button', { type: 'button', class: 'btn btn-sm btn-ghost' }, '✕ CANCEL'); box.appendChild(cancel);
    var stopped = false; cancel.addEventListener('click', function () { stopped = true; try { rec.ondataavailable = null; rec.onstop = null; rec.stop(); } catch (e) { } done(false); cancel.remove(); var b = box.querySelector('[data-go]'); if (b) b.disabled = false; });
    // pre-render fonts/media, then go
    fontsReady.then(function () {
      self.syncVideos(0, true);
      self.frame(cv, 0, false);
      var start = ac.currentTime + 0.25; if (src) src.start(start, P.audioStart || 0);
      rec.start(500);
      var t0p = performance.now() + 250;
      var tick = function () {
        if (stopped) return;
        var t = src ? ac.currentTime - start : (performance.now() - t0p) / 1000;
        if (t >= P.duration) { self.frame(cv, P.duration - 0.001, false); setTimeout(function () { try { rec.stop(); } catch (e) { } }, 120); self.syncVideos(0, false); cancel.remove(); return; }
        if (t >= 0) { self.syncVideos(t, true); self.frame(cv, t, false); }
        prog.querySelector('i').style.width = clamp(t / P.duration * 100, 0, 100) + '%'; prog.querySelector('span').textContent = 'Recording… ' + C.fmtTime(Math.max(0, t)) + ' / ' + C.fmtTime(P.duration) + (document.hidden ? ' — bring this tab back to the front!' : '');
        if (document.hidden) setTimeout(tick, 16); else requestAnimationFrame(tick);
      };
      tick();
    });
  };

  /* =========================================================
     CLOUD (optional — only if the site owner set it up)
     ========================================================= */
  EP.updateLogin = function () { var b = this.root.querySelector('[data-login]'); if (!b || !this.cloud) return; b.textContent = this.cloud.user ? '☁ ' + (this.cloud.user.email || 'ACCOUNT').split('@')[0].toUpperCase() : '☁ LOG IN'; };
  EP.cloudDialog = function () {
    var self = this, c = this.cloud;
    if (c.user) {
      var box = this.modal('<h2 class="sec-title">YOUR ACCOUNT</h2><p>Logged in as <b>' + E(c.user.email) + '</b></p><div class="se-row"><button type="button" class="btn" data-up>☁ SAVE THIS PROJECT TO MY ACCOUNT</button><button type="button" class="btn btn-ghost" data-list>📁 MY CLOUD PROJECTS</button><button type="button" class="btn btn-sm btn-ghost" data-out>LOG OUT</button></div><div class="progress" hidden><i></i><span></span></div>');
      box.querySelector('[data-up]').addEventListener('click', function () { self.cloudSave(box); });
      box.querySelector('[data-list]').addEventListener('click', function () { self.projectsDialog(); });
      box.querySelector('[data-out]').addEventListener('click', function () { c.logout().then(function () { self.updateLogin(); self.closeModal(); self.toast('Logged out'); }); });
      return;
    }
    var box2 = this.modal('<h2 class="sec-title">LOG IN</h2><p class="tc-help">Log in to save your edits online and open them on any device.</p><label class="tc"><span class="tc-l">Email</span><input type="email" data-em autocomplete="email"></label><label class="tc"><span class="tc-l">Password</span><input type="password" data-pw autocomplete="current-password" minlength="6"></label><div class="se-row"><button type="button" class="btn" data-in>LOG IN</button><button type="button" class="btn btn-ghost" data-sign>CREATE ACCOUNT</button><button type="button" class="se-mini" data-forgot>Forgot password?</button></div><p class="se-msg" aria-live="polite"></p>');
    var msg = box2.querySelector('.se-msg'), em = box2.querySelector('[data-em]'), pw = box2.querySelector('[data-pw]');
    function run(p, okText) { msg.textContent = '…'; p.then(function (r) { if (r && r.confirm) { msg.textContent = 'Check your email to confirm your account, then log in here.'; return; } self.updateLogin(); msg.textContent = okText; setTimeout(function () { self.cloudDialog(); }, 600); }).catch(function (e) { msg.textContent = '⚠ ' + (e.message || e); }); }
    box2.querySelector('[data-in]').addEventListener('click', function () { run(c.login(em.value.trim(), pw.value), 'Logged in ✓'); });
    box2.querySelector('[data-sign]').addEventListener('click', function () { if (pw.value.length < 6) { msg.textContent = 'Password needs at least 6 characters'; return; } run(c.signup(em.value.trim(), pw.value), 'Account created ✓'); });
    box2.querySelector('[data-forgot]').addEventListener('click', function () { if (!em.value.trim()) { msg.textContent = 'Type your email first'; return; } c.recover(em.value.trim()).then(function () { msg.textContent = 'Password reset email sent.'; }).catch(function (e) { msg.textContent = '⚠ ' + e.message; }); });
  };
  EP.cloudSave = function (box) {
    var self = this, c = this.cloud, P = this.P, prog = box && box.querySelector('.progress');
    if (prog) prog.hidden = false;
    var ids = Object.keys(P.media).filter(function (id) { return !P.media[id].src && self.media[id] && self.media[id].blob; }), n = 0;
    function step(label) { if (prog) { prog.querySelector('i').style.width = Math.round(n / (ids.length + 1) * 100) + '%'; prog.querySelector('span').textContent = label; } }
    return c.listMedia(P.id).then(function (have) {
      return ids.reduce(function (pr, id) { return pr.then(function () { n++; if (have[id]) return; step('Uploading ' + P.media[id].name + '…'); return c.putMedia(P.id, id, self.media[id].blob); }); }, Promise.resolve());
    }).then(function () { step('Saving project…'); return c.putProject(P, self.thumb()); })
      .then(function () { n = ids.length + 1; step('Saved to your account ✓'); self.toast('Saved to your account ☁'); })
      .catch(function (e) { step('⚠ ' + (e.message || e)); self.toast('Cloud save failed: ' + (e.message || e), true); });
  };
  EP.cloudProjects = function (row) {
    var self = this, c = this.cloud;
    if (!c.user) { row.innerHTML = '<div class="tc-head">☁ Your account</div><button type="button" class="btn btn-sm" data-li>LOG IN TO SEE ONLINE PROJECTS</button>'; row.querySelector('[data-li]').addEventListener('click', function () { self.cloudDialog(); }); return; }
    row.innerHTML = '<div class="tc-head">☁ Saved in your account</div><div class="se-plist">Loading…</div><button type="button" class="btn btn-sm" data-sv>☁ SAVE CURRENT PROJECT</button>';
    row.querySelector('[data-sv]').addEventListener('click', function () { self.cloudSave(null).then(function () { self.projectsDialog(); }); });
    c.listProjects().then(function (items) {
      var l = row.querySelector('.se-plist'); l.innerHTML = items.length ? '' : '<p class="muted">Nothing saved online yet.</p>';
      items.forEach(function (it) {
        var d = h('div', { class: 'se-pitem' }, '<i>☁</i><div><b>' + E(it.name) + '</b><small>' + (it.updated ? new Date(it.updated).toLocaleString() : '') + '</small></div><button type="button" class="btn btn-sm" data-o>OPEN</button><button type="button" class="se-mini" data-x>🗑</button>');
        d.querySelector('[data-o]').addEventListener('click', function () {
          self.toast('Downloading from your account…');
          c.getProject(it.id).then(function (P) {
            var ids = Object.keys(P.media || {}).filter(function (id) { return !P.media[id].src; });
            return Promise.all(ids.map(function (id) { return store.getBlob(id).then(function (b) { if (b) return; return c.getMedia(P.id, id).then(function (blob) { return store.putBlob(id, blob); }); }); })).then(function () { return P; });
          }).then(function (P) { self.closeModal(); return self.load(P, true); }).then(function () { self.toast('Opened from your account ✓'); }).catch(function (e) { self.toast('Couldn\'t open: ' + (e.message || e), true); });
        });
        d.querySelector('[data-x]').addEventListener('click', function () { if (!confirm('Delete “' + it.name + '” from your account?')) return; c.deleteProject(it.id).then(function () { self.projectsDialog(); }); });
        l.appendChild(d);
      });
    }).catch(function (e) { row.querySelector('.se-plist').textContent = '⚠ ' + (e.message || e); });
  };

  window.ShortEditor = { mount: mount, unmount: unmount, _Editor: Editor, _store: store, _live: function () { return live; } };
})();
