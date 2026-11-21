/* =========================================================
   SUL0557 — SHORT EDITOR engine
   MIDI parsing, audio analysis, beat clock, element renderers,
   animations, camera, transitions, effects and templates.
   Pure canvas 2D — renders any moment of the video at any size.
   ========================================================= */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(h, a) {
    h = String(h || '#000').trim();
    if (/^rgba?\(/.test(h)) return a == null ? h : h.replace(/rgba?\(([^)]+)\)/, function (m, x) { var p = x.split(','); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')'; });
    h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16) || 0;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
  }
  function mixColor(a, b, t) {
    function p(c) { c = String(c).replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; var n = parseInt(c, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    var A = p(a), B = p(b); return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  function fmtTime(s) { s = Math.max(0, s); var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteName(p) { return NOTE_NAMES[p % 12] + (Math.floor(p / 12) - 1); }
  function isBlack(p) { return [1, 3, 6, 8, 10].indexOf(p % 12) >= 0; }

  /* ---------- easing ---------- */
  var EASE = {
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    elastic: function (t) { if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; },
    bounce: function (t) { var n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; }
  };

  /* =========================================================
     MIDI (Standard MIDI File, format 0/1)
     ========================================================= */
  function parseMidi(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), p = 0;
    function str(n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u8[p + i]); return s; }
    // allow RIFF-wrapped MIDI (RMID)
    if (str(4) === 'RIFF') { var q = u8.indexOf(0x4d); while (q >= 0 && !(u8[q] === 0x4d && u8[q + 1] === 0x54 && u8[q + 2] === 0x68 && u8[q + 3] === 0x64)) q = u8.indexOf(0x4d, q + 1); if (q < 0) throw new Error('Not a MIDI file'); p = q; }
    if (str(4) !== 'MThd') throw new Error('This isn\'t a MIDI file (.mid)');
    var hl = dv.getUint32(p + 4); var format = dv.getUint16(p + 8), ntr = dv.getUint16(p + 10), div = dv.getUint16(p + 12);
    p += 8 + hl;
    var smpte = div & 0x8000, ppq = smpte ? 0 : div, ticksPerSec = 0;
    if (smpte) { var fps = 256 - (div >> 8); if (fps === 29) fps = 29.97; ticksPerSec = fps * (div & 255); }
    var notes = [], tempos = [], tracks = [], sigs = [];
    for (var tr = 0; tr < ntr && p + 8 <= u8.length; tr++) {
      if (str(4) !== 'MTrk') { p += 8 + dv.getUint32(p + 4); tr--; if (p >= u8.length) break; continue; }
      var len = dv.getUint32(p + 4), end = Math.min(u8.length, p + 8 + len); p += 8;
      var tick = 0, status = 0, open = {}, name = '', chans = {}, count = 0;
      while (p < end) {
        var delta = 0, b;
        do { b = u8[p++]; delta = (delta << 7) | (b & 127); } while (b & 128 && p < end);
        tick += delta;
        var st = u8[p];
        if (st & 128) { status = st; p++; } else if (!status) break;
        var type = status & 0xf0, ch = status & 15;
        if (status === 0xff) {
          var mt = u8[p++], ml = 0; do { b = u8[p++]; ml = (ml << 7) | (b & 127); } while (b & 128);
          if (mt === 0x51 && ml === 3) tempos.push({ tick: tick, us: (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2] });
          else if (mt === 0x03 && !name) { for (var i = 0; i < ml; i++) name += String.fromCharCode(u8[p + i]); }
          else if (mt === 0x58 && ml >= 2) sigs.push({ tick: tick, num: u8[p], den: Math.pow(2, u8[p + 1]) });
          p += ml; status = 0;
        } else if (status === 0xf0 || status === 0xf7) {
          var sl = 0; do { b = u8[p++]; sl = (sl << 7) | (b & 127); } while (b & 128); p += sl; status = 0;
        } else if (type === 0x90 || type === 0x80) {
          var pitch = u8[p++], vel = u8[p++], key = ch * 128 + pitch;
          if (type === 0x90 && vel > 0) { (open[key] = open[key] || []).push({ tick: tick, vel: vel }); chans[ch] = 1; }
          else if (open[key] && open[key].length) { var o = open[key].shift(); notes.push({ tr: tr, ch: ch, p: pitch, v: o.vel / 127, tick: o.tick, etick: Math.max(o.tick + 1, tick) }); count++; }
        } else if (type === 0xc0 || type === 0xd0) p += 1;
        else p += 2;
      }
      Object.keys(open).forEach(function (k) { open[k].forEach(function (o) { notes.push({ tr: tr, ch: +k >> 7, p: +k & 127, v: o.vel / 127, tick: o.tick, etick: tick }); count++; }); });
      tracks.push({ index: tr, name: name.trim() || 'Track ' + (tr + 1), notes: count, channels: Object.keys(chans).map(Number) });
      p = end;
    }
    tempos.sort(function (a, b) { return a.tick - b.tick; });
    if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
    notes.sort(function (a, b) { return a.tick - b.tick || a.p - b.p; });
    var m = { format: format, ppq: ppq || 480, smpte: !!smpte, ticksPerSec: ticksPerSec, tempos: tempos, sigs: sigs, tracks: tracks.filter(function (t) { return t.notes > 0; }), notes: notes };
    // seconds using the file's own tempo map
    notes.forEach(function (n) { n.t = tickToSec(m, n.tick); n.e = tickToSec(m, n.etick); });
    m.bpm = Math.round(60000000 / tempos[0].us * 100) / 100;
    m.duration = notes.length ? Math.max.apply(null, notes.map(function (n) { return n.e; })) : 0;
    m.lastTick = notes.length ? Math.max.apply(null, notes.map(function (n) { return n.etick; })) : 0;
    if (!notes.length) throw new Error('This MIDI file has no notes');
    return m;
  }
  function tickToSec(m, tick) {
    if (m.smpte) return tick / m.ticksPerSec;
    var s = 0, last = 0, us = m.tempos[0].us;
    for (var i = 0; i < m.tempos.length && m.tempos[i].tick <= tick; i++) { s += (m.tempos[i].tick - last) / m.ppq * us / 1e6; last = m.tempos[i].tick; us = m.tempos[i].us; }
    return s + (tick - last) / m.ppq * us / 1e6;
  }
  function toVlq(n) { var b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }
  // a little demo MIDI (so templates move before you add your own)
  function demoMidi(bpm) {
    bpm = bpm || 140;
    var ppq = 96, ev = [], melody = [72, 75, 79, 77, 75, 72, 70, 72, 75, 79, 82, 79, 77, 75, 74, 75], bass = [48, 48, 51, 46], i, bar;
    for (bar = 0; bar < 8; bar++) {
      for (i = 0; i < 8; i++) { var p = melody[(bar % 2) * 8 + i]; ev.push([bar * 4 * ppq + i * ppq / 2, 0x90, p, 90 + (i % 3) * 10], [bar * 4 * ppq + i * ppq / 2 + ppq / 2 - 6, 0x80, p, 0]); }
      var b = bass[bar % 4]; ev.push([bar * 4 * ppq, 0x91, b, 110], [bar * 4 * ppq + ppq * 3, 0x81, b, 0]);
      for (i = 0; i < 16; i++) {
        var t0 = bar * 4 * ppq + i * ppq / 4;
        if (i % 4 === 0 || i === 10) ev.push([t0, 0x99, 36, 120], [t0 + 20, 0x89, 36, 0]);
        if (i % 8 === 4) ev.push([t0, 0x99, 38, 115], [t0 + 20, 0x89, 38, 0]);
        if (i % 2 === 0) ev.push([t0, 0x99, 42, 70 + (i % 4) * 10], [t0 + 10, 0x89, 42, 0]);
        if (i === 14 && bar % 2) ev.push([t0, 0x99, 46, 90], [t0 + 20, 0x89, 46, 0]);
      }
    }
    ev.sort(function (a, b) { return a[0] - b[0] || (a[1] & 0xf0) - (b[1] & 0xf0); });
    var us = Math.round(60000000 / bpm), trk = [0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255], last = 0;
    ev.forEach(function (e) { trk = trk.concat(toVlq(e[0] - last), [e[1], e[2], e[3]]); last = e[0]; });
    trk = trk.concat([0, 0xff, 0x2f, 0]);
    var out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, ppq].concat([0x4d, 0x54, 0x72, 0x6b], [(trk.length >>> 24) & 255, (trk.length >>> 16) & 255, (trk.length >>> 8) & 255, trk.length & 255], trk);
    var m = parseMidi(new Uint8Array(out).buffer);
    m.tracks = [{ index: 0, name: 'Demo', notes: m.notes.length, channels: [0, 1, 9] }];
    return m;
  }

  /* =========================================================
     AUDIO analysis (deterministic — same picture on export)
     ========================================================= */
  var FFT_N = 2048, fftCos = new Float32Array(FFT_N / 2), fftSin = new Float32Array(FFT_N / 2), fftRev = new Uint32Array(FFT_N), hann = new Float32Array(FFT_N);
  (function () { var bits = Math.log2(FFT_N); for (var i = 0; i < FFT_N; i++) { var r = 0; for (var b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1); fftRev[i] = r; hann[i] = 0.5 - 0.5 * Math.cos(TAU * i / (FFT_N - 1)); } for (i = 0; i < FFT_N / 2; i++) { fftCos[i] = Math.cos(TAU * i / FFT_N); fftSin[i] = -Math.sin(TAU * i / FFT_N); } })();
  function fft(re, im) {
    var n = FFT_N, i, j, k;
    for (i = 0; i < n; i++) { j = fftRev[i]; if (j > i) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (var size = 2; size <= n; size <<= 1) {
      var half = size >> 1, step = n / size;
      for (i = 0; i < n; i += size) for (j = i, k = 0; j < i + half; j++, k += step) {
        var tr = re[j + half] * fftCos[k] - im[j + half] * fftSin[k], ti = re[j + half] * fftSin[k] + im[j + half] * fftCos[k];
        re[j + half] = re[j] - tr; im[j + half] = im[j] - ti; re[j] += tr; im[j] += ti;
      }
    }
  }
  function Analysis(buffer) {
    var sr = buffer.sampleRate, n = buffer.length, mono = new Float32Array(n), c, i;
    for (c = 0; c < buffer.numberOfChannels; c++) { var d = buffer.getChannelData(c); for (i = 0; i < n; i++) mono[i] += d[i] / buffer.numberOfChannels; }
    this.sr = sr; this.mono = mono; this.duration = n / sr; this.cache = {}; this.lvCache = {};
    // overview peaks for waveform drawing
    var P = 4000, per = Math.max(1, Math.floor(n / P)); this.peaks = new Float32Array(P);
    var mx = 0;
    for (i = 0; i < P; i++) { var m = 0, s0 = i * per; for (var k = 0; k < per && s0 + k < n; k += 4) { var a = Math.abs(mono[s0 + k]); if (a > m) m = a; } this.peaks[i] = m; if (m > mx) mx = m; }
    if (mx > 0) for (i = 0; i < P; i++) this.peaks[i] /= mx;
    this.re = new Float32Array(FFT_N); this.im = new Float32Array(FFT_N);
  }
  Analysis.prototype.spectrum = function (t, bands) {
    var fi = Math.round(t * 60), key = fi + ':' + bands;
    if (this.cache[key]) return this.cache[key];
    var out = new Float32Array(bands), acc = 0;
    for (var f = -1; f <= 1; f++) { // light smoothing over neighbour frames
      var w = f === 0 ? 0.5 : 0.25, spec = this.rawSpec(fi + f), nb = spec.length;
      for (var b = 0; b < bands; b++) {
        var lo = Math.floor(Math.pow(b / bands, 2.2) * (nb - 2)) + 1, hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / bands, 2.2) * (nb - 2)) + 1), m = 0;
        for (var k = lo; k < hi; k++) if (spec[k] > m) m = spec[k];
        out[b] += m * w;
      }
      acc += w;
    }
    var keys = Object.keys(this.cache); if (keys.length > 2400) this.cache = {};
    return (this.cache[key] = out);
  };
  Analysis.prototype.rawSpec = function (fi) {
    var k = 'r' + fi; if (this.cache[k]) return this.cache[k];
    var c = Math.round(fi / 60 * this.sr) - FFT_N / 2, re = this.re, im = this.im, i;
    for (i = 0; i < FFT_N; i++) { var s = c + i; re[i] = (s >= 0 && s < this.mono.length ? this.mono[s] : 0) * hann[i]; im[i] = 0; }
    fft(re, im);
    var out = new Float32Array(FFT_N / 2);
    for (i = 0; i < FFT_N / 2; i++) { var mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (FFT_N / 4); var db = 20 * Math.log10(mag + 1e-9); out[i] = clamp((db + 80) / 72, 0, 1); }
    return (this.cache[k] = out);
  };
  Analysis.prototype.level = function (t) {
    var fi = Math.round(t * 60); if (this.lvCache[fi] != null) return this.lvCache[fi];
    var c = Math.round(t * this.sr), s = 0, N = 1024;
    for (var i = -N / 2; i < N / 2; i++) { var v = this.mono[c + i] || 0; s += v * v; }
    return (this.lvCache[fi] = clamp(Math.sqrt(s / N) * 3.2, 0, 1));
  };
  Analysis.prototype.wave = function (t, n, span) {
    var c = Math.round(t * this.sr), half = Math.round(span * this.sr / 2), out = new Float32Array(n);
    for (var i = 0; i < n; i++) { var s = c - half + Math.round(i / n * half * 2); out[i] = this.mono[s] || 0; }
    return out;
  };
  // tempo guess from onsets (autocorrelation)
  Analysis.prototype.detectBPM = function () {
    var hop = Math.round(this.sr / 100), n = Math.floor(this.mono.length / hop), env = new Float32Array(n), prev = 0, i, j;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < hop; j += 2) { var v = this.mono[i * hop + j]; s += v * v; } s = Math.sqrt(s / (hop / 2)); env[i] = Math.max(0, s - prev); prev = s; }
    var best = 0, bestBpm = 120;
    for (var bpm = 70; bpm <= 180; bpm += 0.5) {
      var lag = 6000 / bpm, sc = 0, cnt = 0;
      for (i = 0; i + lag * 2 < n; i += 1) { var a = Math.round(i + lag), b = Math.round(i + lag * 2); sc += env[i] * (env[a] + 0.5 * env[b]); cnt++; }
      sc /= Math.max(1, cnt);
      if (sc > best) { best = sc; bestBpm = bpm; }
    }
    // prefer the double tempo for slow hip-hop style results
    if (bestBpm < 85) bestBpm *= 2;
    // phase: find offset of strongest beat grid
    var lagB = 6000 / bestBpm, bestOff = 0, bestS = -1;
    for (var off = 0; off < lagB; off += 1) { var ss = 0; for (var q = off; q < n; q += lagB) ss += env[Math.floor(q)] || 0; if (ss > bestS) { bestS = ss; bestOff = off; } }
    return { bpm: Math.round(bestBpm * 10) / 10, offset: bestOff / 100 };
  };

  /* =========================================================
     MIDI timing for a project (file tempo or your BPM)
     ========================================================= */
  function midiNotes(project, midis) {
    var out = [];
    (project.midis || []).forEach(function (mref) {
      var m = midis[mref.id]; if (!m) return;
      var key = [mref.id, mref.mode, project.bpm, mref.offset, mref.transpose].join('|');
      if (m._key !== key) {
        var spb = 60 / (project.bpm || 120);
        m._timed = m.notes.map(function (n) {
          var t = mref.mode === 'project' ? n.tick / m.ppq * spb : n.t, e = mref.mode === 'project' ? n.etick / m.ppq * spb : n.e;
          return { t: t + (mref.offset || 0), e: e + (mref.offset || 0), p: n.p + (mref.transpose || 0), v: n.v, tr: n.tr, ch: n.ch, src: mref.id };
        });
        m._key = key;
      }
      out = out.concat(m._timed);
    });
    return out;
  }
  function filterNotes(notes, el) {
    return notes.filter(function (n) {
      if (el.midi && el.midi !== 'all' && n.src !== el.midi) return false;
      if (el.track != null && el.track !== '' && +el.track >= 0 && n.tr !== +el.track) return false;
      if (el.channel != null && el.channel !== '' && +el.channel >= 0 && n.ch !== +el.channel) return false;
      return true;
    });
  }

  /* =========================================================
     BEAT CLOCK
     ========================================================= */
  function beatPos(P, t) { return (t - (P.beatOffset || 0)) * (P.bpm || 120) / 60; }
  function beatEnv(P, t, every, sharp) { // 1 right on the beat, decays until the next
    every = every || 1; var b = beatPos(P, t) / every; if (b < 0) return 0; var f = b - Math.floor(b);
    return Math.exp(-(sharp || 7) * f * every * 60 / (P.bpm || 120) * 4);
  }

  /* =========================================================
     FONTS
     ========================================================= */
  var FONTS = ['Anton', 'Bebas Neue', 'Archivo Black', 'Luckiest Guy', 'Bungee', 'Rubik Mono One', 'Pixelify Sans', 'Press Start 2P', 'Silkscreen', 'VT323', 'UnifrakturMaguntia', 'Pirata One', 'Monoton', 'Pacifico', 'Permanent Marker', 'Caveat', 'Orbitron', 'Chakra Petch', 'Righteous', 'Fredoka', 'Space Grotesk', 'Poppins', 'Inter', 'Syne', 'Unbounded', 'DM Serif Display', 'Playfair Display', 'Bowlby One SC', 'Rubik Glitch', 'Shrikhand'];
  var fontState = {};
  function ensureFont(family, weight) {
    if (!family || fontState[family + weight] === 'ok') return Promise.resolve();
    if (FONTS.indexOf(family) >= 0 && !fontState[family]) {
      fontState[family] = 'loading';
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@400;700;900&display=swap';
      if (/Anton|Bebas|Archivo Black|Luckiest|Bungee|Rubik|Press|VT323|Unifraktur|Pirata|Monoton|Pacifico|Permanent|Righteous|Bowlby|Shrikhand/.test(family)) l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + '&display=swap';
      document.head.appendChild(l);
    }
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return document.fonts.load((weight || 400) + ' 40px "' + family + '"').then(function () { fontState[family + weight] = 'ok'; }).catch(function () { });
  }

  /* =========================================================
     ANIMATIONS
     ========================================================= */
  var IN_ANIMS = [['none', 'None'], ['fade', 'Fade'], ['pop', 'Pop'], ['bounce', 'Bounce'], ['drop', 'Drop in'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide from right'], ['slide-right', 'Slide from left'], ['zoom', 'Zoom'], ['blur', 'Blur in'], ['spin', 'Spin'], ['glitch', 'Glitch'], ['wipe', 'Wipe'], ['flip', 'Flip']];
  var LOOP_ANIMS = [['none', 'None'], ['beat-bounce', 'Bounce on beat'], ['beat-shake', 'Shake on beat'], ['beat-flash', 'Flash on beat'], ['beat-tilt', 'Tilt on beat'], ['pulse', 'Pulse'], ['float', 'Float'], ['wiggle', 'Wiggle'], ['spin', 'Spin'], ['shake', 'Shake'], ['flicker', 'Flicker'], ['sway', 'Sway']];
  function animState(el, t, P, W) {
    var s = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, a: 1, blur: 0, wipe: 1, glitch: 0, reveal: 1 };
    var A = el.anim || {}, lt = t - el.start, rem = el.end - t;
    function apply(type, p, out) {
      var e = EASE.out(p), dist = W * 0.35;
      switch (type) {
        case 'fade': s.a *= p; break;
        case 'pop': var k = EASE.back(p); s.sx *= k; s.sy *= k; s.a *= Math.min(1, p * 3); break;
        case 'bounce': var kb = out ? EASE.out(p) : EASE.elastic(p); s.sx *= kb; s.sy *= kb; s.a *= Math.min(1, p * 4); break;
        case 'drop': s.dy -= (1 - EASE.bounce(p)) * dist * 1.4; s.a *= Math.min(1, p * 4); break;
        case 'slide-up': s.dy += (1 - e) * dist; s.a *= p; break;
        case 'slide-down': s.dy -= (1 - e) * dist; s.a *= p; break;
        case 'slide-left': s.dx += (1 - e) * dist; s.a *= p; break;
        case 'slide-right': s.dx -= (1 - e) * dist; s.a *= p; break;
        case 'zoom': var kz = lerp(out ? 1.6 : 0.2, 1, e); s.sx *= kz; s.sy *= kz; s.a *= p; break;
        case 'blur': s.blur += (1 - e) * 30; s.a *= p; break;
        case 'spin': s.rot += (1 - e) * (out ? 1 : -1) * Math.PI; var ks = lerp(0.3, 1, e); s.sx *= ks; s.sy *= ks; s.a *= p; break;
        case 'glitch': if (p < 1) { var r = rng(hash(el.id) + Math.floor(t * 30))(); s.dx += (r - 0.5) * 60 * (1 - p); s.a *= r > 0.25 ? 1 : 0.2; s.glitch = 1 - p; } break;
        case 'wipe': s.wipe = Math.min(s.wipe, e); break;
        case 'flip': s.sx *= Math.cos((1 - e) * Math.PI / 2); s.a *= p > 0.05 ? 1 : 0; break;
      }
    }
    if (A.in && A.in !== 'none' && lt < (A.inDur || 0.5)) apply(A.in, clamp(lt / (A.inDur || 0.5), 0, 1), false);
    if (A.out && A.out !== 'none' && rem < (A.outDur || 0.4)) apply(A.out, clamp(rem / (A.outDur || 0.4), 0, 1), true);
    var amt = A.loopAmt == null ? 1 : A.loopAmt, spd = A.loopSpeed || 1, ev = A.loopEvery || 1;
    switch (A.loop) {
      case 'beat-bounce': var be = beatEnv(P, t, ev); s.sx *= 1 + 0.12 * amt * be; s.sy *= 1 + 0.12 * amt * be; s.dy -= 18 * amt * be; break;
      case 'beat-shake': var bs = beatEnv(P, t, ev), rr = rng(hash(el.id) + Math.floor(beatPos(P, t)))(); s.dx += (rr - 0.5) * 40 * amt * bs; s.rot += (rr - 0.5) * 0.12 * amt * bs; break;
      case 'beat-flash': s.a *= 1 - 0.6 * amt * (1 - beatEnv(P, t, ev)); break;
      case 'beat-tilt': var bt = Math.floor(beatPos(P, t) / ev) % 2 ? 1 : -1; s.rot += bt * 0.06 * amt * (0.5 + 0.5 * beatEnv(P, t, ev)); break;
      case 'pulse': var pu = 1 + 0.06 * amt * Math.sin(t * TAU * spd); s.sx *= pu; s.sy *= pu; break;
      case 'float': s.dy += Math.sin(t * TAU * 0.4 * spd) * 16 * amt; break;
      case 'wiggle': s.rot += Math.sin(t * TAU * 1.5 * spd) * 0.07 * amt; break;
      case 'sway': s.rot += Math.sin(t * TAU * 0.35 * spd) * 0.12 * amt; s.dx += Math.sin(t * TAU * 0.35 * spd) * 10 * amt; break;
      case 'spin': s.rot += t * TAU * 0.25 * spd * amt; break;
      case 'shake': var rs = rng(hash(el.id) + Math.floor(t * 24)); s.dx += (rs() - 0.5) * 14 * amt; s.dy += (rs() - 0.5) * 14 * amt; break;
      case 'flicker': s.a *= rng(hash(el.id) + Math.floor(t * 20))() > 0.15 * amt ? 1 : 0.25; break;
    }
    return s;
  }

  /* =========================================================
     DRAW HELPERS
     ========================================================= */
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2)); g.beginPath();
    if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function notch(g, x, y, w, h, c) { // cut-corner panel (like a game window)
    c = Math.min(c, w / 4, h / 4); g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c * 2.2, y); g.lineTo(x + w - c * 1.2, y - 0); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }
  function panelPath(g, st, x, y, w, h) { if (st.shape === 'notch') notch(g, x, y, w, h, st.radius || 14); else rr(g, x, y, w, h, st.radius || 0); }
  function shapePath(g, kind, x, y, w, h, r) {
    g.beginPath();
    var cx = x + w / 2, cy = y + h / 2, i;
    switch (kind) {
      case 'circle': g.ellipse(cx, cy, w / 2, h / 2, 0, 0, TAU); break;
      case 'triangle': g.moveTo(cx, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); break;
      case 'star': for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.42 : 1; g.lineTo(cx + Math.cos(a) * w / 2 * rad, cy + Math.sin(a) * h / 2 * rad); } g.closePath(); break;
      case 'sparkle': for (i = 0; i < 8; i++) { var a2 = -Math.PI / 2 + i * Math.PI / 4, r2 = i % 2 ? 0.16 : 1; g.lineTo(cx + Math.cos(a2) * w / 2 * r2, cy + Math.sin(a2) * h / 2 * r2); } g.closePath(); break;
      case 'heart': g.moveTo(cx, y + h * 0.95); g.bezierCurveTo(x - w * 0.05, y + h * 0.55, x + w * 0.05, y - h * 0.05, cx, y + h * 0.28); g.bezierCurveTo(x + w * 0.95, y - h * 0.05, x + w * 1.05, y + h * 0.55, cx, y + h * 0.95); break;
      case 'diamond': g.moveTo(cx, y); g.lineTo(x + w, cy); g.lineTo(cx, y + h); g.lineTo(x, cy); g.closePath(); break;
      case 'line': g.rect(x, cy - Math.max(2, h / 2) / 2, w, Math.max(2, h / 2)); break;
      case 'arrow': g.moveTo(x, cy - h * 0.18); g.lineTo(x + w * 0.62, cy - h * 0.18); g.lineTo(x + w * 0.62, y); g.lineTo(x + w, cy); g.lineTo(x + w * 0.62, y + h); g.lineTo(x + w * 0.62, cy + h * 0.18); g.lineTo(x, cy + h * 0.18); g.closePath(); break;
      default: rr(g, x, y, w, h, r || 0);
    }
  }
  // soft blur that works in every browser (downscale → upscale)
  function softBlur(src, amount) {
    if (amount <= 0.5) return src;
    var k = Math.max(1, amount / 2), s = mk(src.width / k, src.height / k), g = s.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, s.width, s.height);
    var s2 = mk(s.width / 2, s.height / 2); s2.getContext('2d').drawImage(s, 0, 0, s2.width, s2.height);
    var out = mk(src.width, src.height), og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
    og.drawImage(s2, 0, 0, out.width, out.height); og.globalAlpha = 0.5; og.drawImage(s, 0, 0, out.width, out.height);
    return out;
  }
  function drawMediaFit(g, img, x, y, w, h, fit, zoom, px, py) {
    var iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var k = fit === 'contain' ? Math.min(w / iw, h / ih) : fit === 'stretch' ? 0 : Math.max(w / iw, h / ih);
    zoom = zoom || 1;
    if (fit === 'stretch') { g.drawImage(img, x, y, w, h); return; }
    var dw = iw * k * zoom, dh = ih * k * zoom;
    g.drawImage(img, x + (w - dw) * (px == null ? 0.5 : px), y + (h - dh) * (py == null ? 0.5 : py), dw, dh);
  }

  /* =========================================================
     ELEMENT TYPES (schema + renderer)
     Renderers draw inside the box (0,0)-(w,h) with ctx R:
     { t, P, notes, an (Analysis|null), media(id)→img/video, edit }
     ========================================================= */
  var T = {};
  var COMMON_STYLE = { shadowColor: '#000000', shadowX: 0, shadowY: 0, shadowBlur: 0, shadowOpacity: 0, glow: 0, glowColor: '#ff3fc8', blend: 'source-over' };

  T.text = {
    label: 'Text', icon: 'T',
    defaults: { text: 'YOUR TEXT', font: 'Anton', weight: 400, size: 120, color: '#ffffff', stroke: 0, strokeColor: '#ff3fc8', align: 'center', letter: 0, lineH: 1.05, caps: true, italic: false, accentColor: '#ff3fc8', accentFont: 'UnifrakturMaguntia', accentGlow: 18, boxColor: '#000000', boxOpacity: 0, boxPad: 20, boxRadius: 16, reveal: 'none', revealDur: 1.2, gradient: false, color2: '#38c8ff', autoFit: true },
    render: function (g, el, w, h, R, S) {
      var lines = String(el.text || '').split('\n');
      if (el.caps) lines = lines.map(function (l) { return l.toUpperCase(); });
      // words with *accent* markers
      var tokens = [], wi = 0;
      lines.forEach(function (ln, li) {
        var parts = ln.split(/(\*[^*]+\*)/).filter(function (x) { return x !== ''; });
        parts.forEach(function (pt) {
          var acc = /^\*[^*]+\*$/.test(pt), txt = acc ? pt.slice(1, -1) : pt;
          txt.split(/(\s+)/).forEach(function (wd) { if (wd === '') return; tokens.push({ s: wd, acc: acc, line: li, sp: /^\s+$/.test(wd), i: /^\s+$/.test(wd) ? -1 : wi++ }); });
        });
      });
      var total = wi, chars = 0; tokens.forEach(function (tk) { if (!tk.sp) chars += tk.s.length; });
      // reveal
      var lt = R.t - el.start, shownW = total, shownC = chars;
      if (el.reveal === 'word' || el.reveal === 'char' || el.reveal === 'beat') {
        if (el.reveal === 'beat') shownW = Math.floor(beatPos(R.P, R.t) - beatPos(R.P, el.start)) + 1;
        else { var f = clamp(lt / Math.max(0.05, el.revealDur || 1), 0, 1); shownW = Math.ceil(f * total); shownC = Math.floor(f * chars); }
      }
      var size = el.size || 100;
      function fontOf(acc) { return (el.italic ? 'italic ' : '') + (acc ? 400 : el.weight || 400) + ' ' + size + 'px "' + (acc ? el.accentFont : el.font) + '", Impact, sans-serif'; }
      g.textBaseline = 'alphabetic';
      if (g.letterSpacing !== undefined) g.letterSpacing = (el.letter || 0) + 'px';
      function measure() {
        var widths = lines.map(function () { return 0; });
        tokens.forEach(function (tk) { g.font = fontOf(tk.acc); tk.w = g.measureText(tk.s).width; widths[tk.line] += tk.w; });
        return widths;
      }
      var widths = measure(), maxW = Math.max.apply(null, widths.concat([1])), lh = size * (el.lineH || 1.05), totalH = lh * lines.length;
      if (el.autoFit !== false && (maxW > w || totalH > h * 1.02)) {
        var k = Math.min(w / maxW, h / totalH); size = Math.max(6, size * k * 0.98); widths = measure(); maxW = Math.max.apply(null, widths); lh = size * (el.lineH || 1.05); totalH = lh * lines.length;
      }
      var y0 = (h - totalH) / 2 + size * 0.86;
      if (el.boxOpacity > 0) {
        g.save(); g.globalAlpha *= el.boxOpacity; g.fillStyle = el.boxColor;
        var bw = maxW + el.boxPad * 2, bx = el.align === 'left' ? -el.boxPad : el.align === 'right' ? w - maxW - el.boxPad : (w - bw) / 2;
        rr(g, bx, (h - totalH) / 2 - el.boxPad * 0.6, bw, totalH + el.boxPad * 1.2, el.boxRadius); g.fill(); g.restore();
      }
      var cursor = lines.map(function (ln, li) { return el.align === 'left' ? 0 : el.align === 'right' ? w - widths[li] : (w - widths[li]) / 2; });
      var cCount = 0;
      tokens.forEach(function (tk) {
        var x = cursor[tk.line], y = y0 + tk.line * lh; cursor[tk.line] += tk.w;
        if (tk.sp) return;
        var vis = tk.s;
        if (el.reveal === 'char') { var left = shownC - cCount; cCount += tk.s.length; if (left <= 0) return; vis = tk.s.slice(0, left); }
        else if ((el.reveal === 'word' || el.reveal === 'beat') && tk.i >= shownW) return;
        g.font = fontOf(tk.acc);
        var pop = 1;
        if (el.reveal === 'word' || el.reveal === 'beat') { // little bounce on each new word
          var wt = el.reveal === 'beat' ? (beatPos(R.P, R.t) - beatPos(R.P, el.start)) - tk.i : (lt / Math.max(0.05, el.revealDur || 1)) * total - tk.i;
          if (wt < 1) pop = EASE.back(clamp(wt * 1.6, 0, 1));
        }
        g.save();
        if (pop !== 1) { g.translate(x + tk.w / 2, y - size * 0.35); g.scale(pop, pop); g.translate(-(x + tk.w / 2), -(y - size * 0.35)); }
        if (tk.acc && el.accentGlow > 0) { g.shadowColor = el.accentColor; g.shadowBlur = el.accentGlow * S; }
        if (el.stroke > 0) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = el.stroke * 2; g.strokeStyle = tk.acc ? '#ffffff' : el.strokeColor; g.strokeText(vis, x, y); g.shadowBlur = 0; }
        if (tk.acc) g.fillStyle = el.accentColor;
        else if (el.gradient) { var gr = g.createLinearGradient(0, y - size, 0, y); gr.addColorStop(0, el.color); gr.addColorStop(1, el.color2); g.fillStyle = gr; }
        else g.fillStyle = el.color;
        g.fillText(vis, x, y);
        g.restore();
      });
      if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
    }
  };
  T.image = {
    label: 'Picture', icon: '🖼',
    defaults: { media: '', src: '', fit: 'cover', zoom: 1, posX: 0.5, posY: 0.5, radius: 24, border: 0, borderColor: '#ffffff', flipX: false, kenBurns: 0, saturate: 100, brightness: 100 },
    render: function (g, el, w, h, R, S) {
      var img = R.media(el.media, el.src);
      g.save(); rr(g, 0, 0, w, h, el.radius); g.clip();
      if (img) {
        if (el.saturate !== 100 || el.brightness !== 100) g.filter = 'saturate(' + el.saturate + '%) brightness(' + el.brightness + '%)';
        if (el.flipX) { g.translate(w, 0); g.scale(-1, 1); }
        var z = (el.zoom || 1) * (1 + (el.kenBurns || 0) * 0.08 * ((R.t - el.start) / Math.max(1, el.end - el.start)));
        drawMediaFit(g, img, 0, 0, w, h, el.fit, z, el.posX, el.posY);
        g.filter = 'none';
      } else if (R.edit) {
        g.fillStyle = 'rgba(255,63,200,.12)'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,63,200,.8)'; g.setLineDash([16 * S, 10 * S]); g.lineWidth = 4 * S; g.strokeRect(2, 2, w - 4, h - 4); g.setLineDash([]);
        var ph = el.placeholder || 'DROP A PICTURE HERE', fs = Math.min(w, h) / 9;
        g.font = '700 ' + fs + 'px "Space Grotesk", sans-serif'; var mw = g.measureText(ph).width; if (mw > w * 0.9) fs *= w * 0.9 / mw;
        g.fillStyle = '#ff3fc8'; g.font = '700 ' + fs + 'px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ph, w / 2, h / 2); g.textAlign = 'left';
      }
      g.restore();
      if (el.border > 0) { g.lineWidth = el.border * 2; g.strokeStyle = el.borderColor; rr(g, 0, 0, w, h, el.radius); g.save(); g.clip(); g.stroke(); g.restore(); }
    }
  };
  T.video = {
    label: 'Video clip', icon: '🎞',
    defaults: { media: '', fit: 'cover', zoom: 1, posX: 0.5, posY: 0.5, radius: 24, border: 0, borderColor: '#ffffff', trim: 0, speed: 1, loop: true, saturate: 100, brightness: 100 },
    render: function (g, el, w, h, R, S) { T.image.render(g, el, w, h, R, S); }
  };
  T.shape = {
    label: 'Shape', icon: '◆',
    defaults: { kind: 'rect', fill: '#ff3fc8', fill2: '#8a3cff', gradient: false, stroke: 0, strokeColor: '#ffffff', radius: 20, reactLevel: 0 },
    render: function (g, el, w, h, R, S) {
      var k = 1 + (el.reactLevel || 0) * (R.an ? R.an.level(R.t) : beatEnv(R.P, R.t)) * 0.4;
      if (k !== 1) { g.translate(w / 2, h / 2); g.scale(k, k); g.translate(-w / 2, -h / 2); }
      shapePath(g, el.kind, 0, 0, w, h, el.radius);
      if (el.gradient) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, el.fill); gr.addColorStop(1, el.fill2); g.fillStyle = gr; } else g.fillStyle = el.fill;
      g.fill();
      if (el.stroke > 0) { g.lineWidth = el.stroke * 2; g.strokeStyle = el.strokeColor; g.lineJoin = 'round'; g.stroke(); }
    }
  };
  // window chrome shared by MIDI/audio panels
  function chrome(g, el, w, h, S, title) {
    var bar = el.titleBar ? Math.max(18, h * 0.08) : 0;
    if (el.offsetShadow) { g.save(); g.translate(el.offsetShadow * S, el.offsetShadow * S); panelPath(g, el, 0, 0, w, h); g.fillStyle = el.shadowTint || '#ff1f78'; g.fill(); g.restore(); }
    panelPath(g, el, 0, 0, w, h); g.fillStyle = el.bg; g.fill();
    if (el.frame > 0) { g.lineWidth = el.frame * S; g.strokeStyle = el.frameColor; g.stroke(); }
    if (bar) {
      g.save(); panelPath(g, el, 0, 0, w, h); g.clip(); g.fillStyle = el.barColor || el.frameColor; g.fillRect(0, 0, w, bar);
      g.fillStyle = el.barText || '#ffffff'; g.font = '700 ' + bar * 0.55 + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'middle'; g.fillText(String(title || el.label || '').toUpperCase(), bar * 0.5, bar / 2);
      g.restore();
    }
    return bar;
  }
  var PANEL_DEF = { bg: '#141018', frame: 3, frameColor: '#2a2230', shape: 'notch', radius: 16, titleBar: true, barColor: '#1d1724', barText: '#ffffff', label: 'PLUCKS', offsetShadow: 10, shadowTint: '#ff1f78' };
  T.pianoroll = {
    label: 'Piano roll', icon: '🎹', midi: true,
    defaults: Object.assign({}, PANEL_DEF, { midi: 'all', track: -1, channel: -1, mode: 'page', beats: 8, noteColor: '#ff2a7a', noteColor2: '#ffb3d1', colorBy: 'velocity', activeColor: '#ffffff', gridColor: '#2b2533', barLineColor: '#3d3446', playhead: '#ff7ab8', keys: true, keyWidth: 7, noteRadius: 2, noteGlow: 10, bpmLabel: true, lowNote: 0, highNote: 0, padNotes: 2, labelColor: '#c9bfd6' }),
    render: function (g, el, w, h, R, S) {
      var bar = chrome(g, el, w, h, S, el.label), pad = 8 * S, kx = el.keys ? w * el.keyWidth / 100 : 0;
      var x0 = pad + kx, y0 = bar + pad + h * 0.05, iw = w - x0 - pad, ih = h - y0 - pad;
      var notes = filterNotes(R.notes, el), lo = el.lowNote, hi = el.highNote;
      if (!lo || !hi) { lo = 127; hi = 0; notes.forEach(function (n) { if (n.p < lo) lo = n.p; if (n.p > hi) hi = n.p; }); if (lo > hi) { lo = 48; hi = 72; } lo -= el.padNotes; hi += el.padNotes; }
      var rows = hi - lo + 1, rh = ih / rows;
      var spb = 60 / (R.P.bpm || 120), win = (el.beats || 8) * spb, t = R.t, ws, playX;
      var bp = beatPos(R.P, t), off = R.P.beatOffset || 0;
      if (el.mode === 'scroll') { ws = t - win * 0.35; playX = x0 + iw * 0.35; }
      else { var page = Math.floor(bp / (el.beats || 8)); ws = off + page * win; playX = x0 + (t - ws) / win * iw; }
      // header beat numbers + bpm
      g.font = '600 ' + Math.max(9, h * 0.035) + 'px "Space Grotesk", sans-serif'; g.fillStyle = el.labelColor; g.textBaseline = 'alphabetic';
      var b0 = Math.ceil((ws - off) / spb);
      for (var b = b0; (off + b * spb) <= ws + win; b++) {
        var bx = x0 + ((off + b * spb) - ws) / win * iw;
        var isBar = b % 4 === 0;
        g.fillStyle = isBar ? el.barLineColor : el.gridColor; g.fillRect(bx, y0, Math.max(1, (isBar ? 2 : 1) * S), ih);
        if (isBar) { g.fillStyle = el.labelColor; g.fillText(String(b / 4 + 1), bx + 3 * S, y0 - 4 * S); }
      }
      if (el.bpmLabel) { g.textAlign = 'right'; g.fillStyle = el.labelColor; g.fillText(Math.round(R.P.bpm) + ' BPM', x0 + iw, y0 - 4 * S); g.textAlign = 'left'; }
      // keys
      if (el.keys) for (var p = lo; p <= hi; p++) {
        var ky = y0 + (hi - p) * rh, act = notes.some(function (n) { return n.p === p && n.t <= t && n.e > t; });
        g.fillStyle = act ? el.noteColor : isBlack(p) ? '#1b1b1f' : '#f2eef6'; g.fillRect(pad, ky + 0.5, kx - 2 * S, rh - 1);
      }
      // notes
      g.save(); g.beginPath(); g.rect(x0, y0, iw, ih); g.clip();
      notes.forEach(function (n) {
        if (n.e < ws || n.t > ws + win) return;
        var nx = x0 + (n.t - ws) / win * iw, nw = Math.max(3 * S, (n.e - n.t) / win * iw - 2 * S), ny = y0 + (hi - n.p) * rh;
        var on = n.t <= t && n.e > t, past = n.t <= t;
        var c = el.colorBy === 'track' ? (n.tr % 2 ? el.noteColor2 : el.noteColor) : el.colorBy === 'pitch' ? mixColor(el.noteColor2, el.noteColor, (n.p - lo) / Math.max(1, rows)) : mixColor(el.noteColor2, el.noteColor, n.v);
        if (on) { g.shadowColor = el.noteColor; g.shadowBlur = el.noteGlow * S; c = el.activeColor; }
        g.fillStyle = c; g.globalAlpha = el.mode === 'page' && !past ? 0.9 : 1;
        rr(g, nx, ny + rh * 0.08, nw, Math.max(2, rh * 0.84), el.noteRadius * S); g.fill();
        g.shadowBlur = 0; g.globalAlpha = 1;
      });
      g.restore();
      if (playX >= x0 && playX <= x0 + iw) { g.fillStyle = el.playhead; g.shadowColor = el.playhead; g.shadowBlur = 8 * S; g.fillRect(playX, y0, 2 * S, ih); g.shadowBlur = 0; }
    }
  };
  T.stepgrid = {
    label: 'Drum step grid', icon: '▦', midi: true,
    defaults: Object.assign({}, PANEL_DEF, { label: 'DRUMS', midi: 'all', track: -1, channel: -1, steps: 16, stepLen: 0.25, maxRows: 6, onColor: '#ff2a7a', onColor2: '#ffb3d1', hitColor: '#ffffff', offColor: '#1e1a24', gridGap: 4, showLabels: true, playhead: '#ff7ab8', labelColor: '#c9bfd6', keys: true }),
    render: function (g, el, w, h, R, S) {
      var bar = chrome(g, el, w, h, S, el.label), pad = 8 * S, kx = el.keys ? w * 0.07 : 0;
      var notes = filterNotes(R.notes, el), pitches = {};
      notes.forEach(function (n) { pitches[n.p] = (pitches[n.p] || 0) + 1; });
      var rowsP = Object.keys(pitches).map(Number).sort(function (a, b) { return pitches[b] - pitches[a]; }).slice(0, el.maxRows || 6).sort(function (a, b) { return b - a; });
      if (!rowsP.length) rowsP = [38, 36];
      var x0 = pad + kx, y0 = bar + pad + h * 0.05, iw = w - x0 - pad, ih = h - y0 - pad, steps = el.steps || 16, cw = iw / steps, ch = ih / rowsP.length, gap = el.gridGap * S;
      var spb = 60 / (R.P.bpm || 120), sl = (el.stepLen || 0.25) * spb, off = R.P.beatOffset || 0, page = Math.floor((R.t - off) / (sl * steps)), ps = off + page * sl * steps;
      var curStep = Math.floor((R.t - ps) / sl);
      g.font = '600 ' + Math.max(8, Math.min(ch, cw) * 0.28) + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'middle';
      rowsP.forEach(function (p, ri) {
        if (el.keys) { g.fillStyle = '#f2eef6'; g.fillRect(pad, y0 + ri * ch + 1, kx - 2 * S, ch - 2); g.fillStyle = '#555'; g.fillText(noteName(p), pad + 3 * S, y0 + ri * ch + ch / 2); }
        for (var s = 0; s < steps; s++) {
          var st0 = ps + s * sl, hit = null;
          for (var k = 0; k < notes.length; k++) { var n = notes[k]; if (n.p === p && n.t >= st0 - sl * 0.45 && n.t < st0 + sl * 0.55) { hit = n; break; } }
          var x = x0 + s * cw + gap / 2, y = y0 + ri * ch + gap / 2;
          g.fillStyle = el.offColor; g.fillRect(x, y, cw - gap, ch - gap);
          if (hit) {
            var played = hit.t <= R.t, fresh = played && R.t - hit.t < sl * 1.2;
            g.fillStyle = fresh ? el.hitColor : played ? (ri % 2 ? el.onColor2 : el.onColor) : hex(ri % 2 ? el.onColor2 : el.onColor, 0.35);
            if (fresh) { g.shadowColor = el.onColor; g.shadowBlur = 14 * S; }
            g.fillRect(x, y, cw - gap, ch - gap); g.shadowBlur = 0;
            if (el.showLabels) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(noteName(p), x + 3 * S, y + 8 * S); }
          }
        }
      });
      if (curStep >= 0 && curStep < steps) { g.fillStyle = hex(el.playhead, 0.18); g.fillRect(x0 + curStep * cw, y0, cw, ih); g.fillStyle = el.playhead; g.fillRect(x0 + (R.t - ps) / sl * cw, y0, 2 * S, ih); }
    }
  };
  T.falling = {
    label: 'Falling notes', icon: '⬇', midi: true,
    defaults: { midi: 'all', track: -1, channel: -1, look: 3, lowNote: 0, highNote: 0, noteColor: '#ff3fc8', noteColor2: '#38c8ff', keyboard: true, keyH: 12, glow: 16, radius: 6, bg: 'transparent', lineColor: 'rgba(255,255,255,0.08)', hitFlash: true },
    render: function (g, el, w, h, R, S) {
      var notes = filterNotes(R.notes, el), lo = el.lowNote, hi = el.highNote;
      if (!lo || !hi) { lo = 127; hi = 0; notes.forEach(function (n) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }); if (lo > hi) { lo = 48; hi = 72; } lo = Math.max(0, lo - 2); hi = Math.min(127, hi + 2); }
      if (el.bg && el.bg !== 'transparent') { g.fillStyle = el.bg; g.fillRect(0, 0, w, h); }
      var kh = el.keyboard ? h * el.keyH / 100 : 0, fh = h - kh, cols = hi - lo + 1, cw = w / cols, look = el.look || 3;
      g.fillStyle = el.lineColor; for (var c = 0; c <= cols; c++) if ((lo + c) % 12 === 0) g.fillRect(c * cw, 0, 1 * S, fh);
      notes.forEach(function (n) {
        if (n.e < R.t || n.t > R.t + look) return;
        var y1 = fh - (n.t - R.t) / look * fh, y0 = fh - (n.e - R.t) / look * fh, x = (n.p - lo) * cw;
        var col = mixColor(el.noteColor2, el.noteColor, (n.p - lo) / cols);
        g.fillStyle = col; g.shadowColor = col; g.shadowBlur = el.glow * S;
        rr(g, x + cw * 0.12, Math.max(-20, y0), cw * 0.76, Math.max(4, Math.min(fh, y1) - Math.max(-20, y0)), el.radius * S); g.fill();
      });
      g.shadowBlur = 0;
      if (el.keyboard) {
        for (var p = lo; p <= hi; p++) {
          var x = (p - lo) * cw, on = notes.some(function (n) { return n.p === p && n.t <= R.t && n.e > R.t; });
          g.fillStyle = on ? mixColor(el.noteColor2, el.noteColor, (p - lo) / cols) : isBlack(p) ? '#1a1520' : '#f4f0fa';
          g.fillRect(x + 1, fh + (isBlack(p) ? 0 : 0), cw - 2, isBlack(p) ? kh * 0.62 : kh);
          if (on && el.hitFlash) { var gr = g.createLinearGradient(0, fh, 0, fh - 60 * S); gr.addColorStop(0, hex('#ffffff', 0.6)); gr.addColorStop(1, hex('#ffffff', 0)); g.fillStyle = gr; g.fillRect(x, fh - 60 * S, cw, 60 * S); }
        }
      }
    }
  };
  T.noteburst = {
    label: 'Note bursts', icon: '✺', midi: true,
    defaults: { midi: 'all', track: -1, channel: -1, style: 'rings', color: '#ff3fc8', color2: '#ffe14d', life: 0.8, size: 90, layout: 'pitch', count: 10 },
    render: function (g, el, w, h, R, S) {
      var notes = filterNotes(R.notes, el), lo = 127, hi = 0;
      notes.forEach(function (n) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); });
      notes.forEach(function (n, idx) {
        var age = R.t - n.t; if (age < 0 || age > el.life) return;
        var r = rng(hash(n.src + n.t + ':' + n.p)), f = age / el.life, x, y;
        if (el.layout === 'center') { x = w / 2; y = h / 2; } else if (el.layout === 'random') { x = r() * w; y = r() * h; }
        else { x = hi > lo ? (n.p - lo) / (hi - lo) * w * 0.85 + w * 0.075 : w / 2; y = h * (0.3 + r() * 0.4); }
        var col = mixColor(el.color, el.color2, r()), sz = el.size * S * (0.5 + n.v);
        g.globalAlpha = 1 - f; g.strokeStyle = g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12 * S;
        if (el.style === 'rings') { g.lineWidth = 6 * S * (1 - f) + 1; g.beginPath(); g.arc(x, y, sz * EASE.out(f), 0, TAU); g.stroke(); }
        else if (el.style === 'sparks') { for (var i = 0; i < el.count; i++) { var a = r() * TAU, d = sz * EASE.out(f) * (0.6 + r() * 0.8); g.fillRect(x + Math.cos(a) * d - 3 * S, y + Math.sin(a) * d - 3 * S, 6 * S * (1 - f) + 1, 6 * S * (1 - f) + 1); } }
        else if (el.style === 'stars') { var s2 = sz * 0.6 * EASE.back(Math.min(1, f * 3)) * (1 - f * 0.5); shapePath(g, 'sparkle', x - s2 / 2, y - s2 / 2, s2, s2); g.fill(); }
        else { g.beginPath(); g.arc(x, y, sz * 0.5 * (1 - f * 0.6), 0, TAU); g.fill(); }
      });
      g.globalAlpha = 1; g.shadowBlur = 0;
    }
  };
  T.spectrum = {
    label: 'Spectrum', icon: '▮▮', audio: true,
    defaults: { style: 'bars', bands: 48, color: '#ff3fc8', color2: '#38c8ff', gap: 30, radius: 4, sens: 100, mirror: false, glow: 0, inner: 35 },
    render: function (g, el, w, h, R, S) {
      var n = el.bands | 0, spec = R.an ? R.an.spectrum(R.t, n) : fakeSpec(R, n), k = el.sens / 100;
      g.shadowBlur = el.glow * S;
      if (el.style === 'circle') {
        var cx = w / 2, cy = h / 2, r0 = Math.min(w, h) / 2 * el.inner / 100, r1 = Math.min(w, h) / 2;
        for (var i = 0; i < n; i++) {
          var v = clamp(spec[i] * k, 0, 1), a = i / n * TAU - Math.PI / 2, len = (r1 - r0) * v + 2 * S, col = mixColor(el.color, el.color2, i / n);
          g.strokeStyle = col; g.shadowColor = col; g.lineWidth = Math.max(1, TAU * r0 / n * (1 - el.gap / 100)); g.lineCap = 'round';
          g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
        }
      } else if (el.style === 'line') {
        var gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, el.color); gr.addColorStop(1, el.color2);
        g.strokeStyle = gr; g.shadowColor = el.color; g.lineWidth = 4 * S; g.lineJoin = 'round'; g.beginPath();
        for (i = 0; i < n; i++) { var x = i / (n - 1) * w, y = h - clamp(spec[i] * k, 0, 1) * h; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      } else {
        var bw = w / n, inner2 = bw * (1 - el.gap / 100);
        for (i = 0; i < n; i++) {
          var v2 = clamp(spec[i] * k, 0, 1), bh = Math.max(2 * S, v2 * h * (el.mirror ? 0.5 : 1)), col2 = mixColor(el.color, el.color2, i / n);
          g.fillStyle = col2; g.shadowColor = col2;
          if (el.style === 'dots') { var dots = Math.ceil(bh / (inner2 + 2 * S)); for (var d = 0; d < dots; d++) { g.beginPath(); g.arc(i * bw + bw / 2, h - inner2 / 2 - d * (inner2 + 2 * S), inner2 / 2, 0, TAU); g.fill(); } }
          else { rr(g, i * bw + (bw - inner2) / 2, el.mirror ? h / 2 - bh : h - bh, inner2, el.mirror ? bh * 2 : bh, el.radius * S); g.fill(); }
        }
      }
      g.shadowBlur = 0;
    }
  };
  function fakeSpec(R, n) { var out = new Float32Array(n), be = beatEnv(R.P, R.t); for (var i = 0; i < n; i++) out[i] = clamp((0.25 + 0.5 * be) * (1 - i / n * 0.7) + 0.15 * Math.sin(R.t * 3 + i * 0.7), 0, 1); return out; }
  T.waveform = {
    label: 'Waveform', icon: '〰', audio: true,
    defaults: Object.assign({}, PANEL_DEF, { label: 'LEAD', style: 'full', bg: '#ffc2e6', frame: 0, shape: 'rect', radius: 6, titleBar: false, offsetShadow: 0, wave: '#ff3fa4', played: '#ff8fcd', playhead: '#ffffff', textColor: '#ffffff', span: 2, showLabel: true }),
    render: function (g, el, w, h, R, S) {
      var bar = chrome(g, el, w, h, S, el.label), pad = 6 * S, y0 = bar + pad, ih = h - y0 - pad, mid = y0 + ih / 2;
      g.save(); panelPath(g, el, 0, 0, w, h); g.clip();
      if (el.style === 'scope') {
        var wv = R.an ? R.an.wave(R.t, 400, el.span / 100) : null;
        g.strokeStyle = el.wave; g.lineWidth = 3 * S; g.beginPath();
        for (var i = 0; i < 400; i++) { var v = wv ? wv[i] : Math.sin(i / 12 + R.t * 8) * 0.3 * beatEnv(R.P, R.t); var x = i / 399 * w, y = mid - v * ih * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      } else {
        var peaks = R.an ? R.an.peaks : null, N = Math.max(10, Math.floor(w / (3 * S))), dur = R.an ? R.an.duration : R.P.duration, prog = clamp((R.t + (R.P.audioStart || 0)) / Math.max(0.1, dur), 0, 1);
        var vs = el.style === 'window' ? Math.max(0, (R.t + (R.P.audioStart || 0)) - el.span) / dur : 0, ve = el.style === 'window' ? Math.min(1, (R.t + (R.P.audioStart || 0) + el.span) / dur) : 1;
        for (i = 0; i < N; i++) {
          var f = vs + (ve - vs) * i / N, pv = peaks ? peaks[Math.min(peaks.length - 1, Math.floor(f * peaks.length))] : 0.3 + 0.3 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.13));
          g.fillStyle = f <= prog ? el.played : el.wave;
          var bh = Math.max(1, pv * ih * 0.95); g.fillRect(i / N * w, mid - bh / 2, Math.max(1, w / N - 1 * S), bh);
        }
        var px = el.style === 'window' ? w / 2 : prog * w; g.fillStyle = el.playhead; g.fillRect(px - 1.5 * S, y0, 3 * S, ih);
      }
      if (el.showLabel && !el.titleBar) { g.fillStyle = el.textColor; g.font = '700 ' + Math.max(10, h * 0.09) + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'top'; g.fillText(String(el.label || ''), 8 * S, 6 * S); }
      g.restore();
    }
  };
  T.player = {
    label: 'Retro player', icon: '📻', audio: true,
    defaults: { title: 'SUL - KEEP YOUR BEATS SIMPLE', brand: 'PIXAMP', body: '#ff5fb0', body2: '#ff8fcd', screen: '#2a1f9e', screenText: '#7fd3ff', accent: '#ffe14d', bars: 20, radius: 18 },
    render: function (g, el, w, h, R, S) {
      var r = el.radius * S, bh = h * 0.13;
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, el.body2); gr.addColorStop(1, el.body);
      rr(g, 0, 0, w, h, r); g.fillStyle = gr; g.fill(); g.lineWidth = 3 * S; g.strokeStyle = hex('#000000', 0.25); g.stroke();
      // title bar
      g.fillStyle = hex('#ffffff', 0.35); rr(g, w * 0.03, h * 0.04, w * 0.94, bh, bh / 2); g.fill();
      g.fillStyle = '#fff'; g.font = '900 ' + bh * 0.7 + 'px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(el.brand, w / 2, h * 0.04 + bh / 2); g.textAlign = 'left';
      // screen
      var sx = w * 0.05, sy = h * 0.22, sw = w * 0.9, sh = h * 0.42;
      rr(g, sx, sy, sw, sh, 8 * S); g.fillStyle = el.screen; g.fill();
      g.fillStyle = el.screenText; g.font = '700 ' + sh * 0.38 + 'px "VT323", "Silkscreen", monospace'; g.textBaseline = 'top';
      g.fillText(fmtTime(R.t + (R.P.audioStart || 0)), sx + sw * 0.05, sy + sh * 0.1);
      // scrolling title
      g.save(); g.beginPath(); g.rect(sx + sw * 0.36, sy, sw * 0.6, sh); g.clip();
      g.font = '700 ' + sh * 0.2 + 'px "VT323", monospace'; var txt = el.title + '  ***  ', tw = g.measureText(txt).width, ox = (R.t * 60 * S) % tw;
      g.fillText(txt + txt, sx + sw * 0.37 - ox, sy + sh * 0.12); g.restore();
      g.font = '700 ' + sh * 0.16 + 'px "VT323", monospace'; g.fillText('320 KBPS   48 KHZ   STEREO', sx + sw * 0.37, sy + sh * 0.42);
      // mini spectrum
      var nb = el.bars | 0, spec = R.an ? R.an.spectrum(R.t, nb) : fakeSpec(R, nb), bw = sw * 0.3 / nb;
      for (var i = 0; i < nb; i++) { var bh2 = clamp(spec[i], 0.05, 1) * sh * 0.42; g.fillStyle = i % 3 ? el.screenText : el.accent; g.fillRect(sx + sw * 0.05 + i * bw, sy + sh * 0.92 - bh2, bw * 0.7, bh2); }
      // seek bar
      var dur = R.an ? R.an.duration : R.P.duration, prog = clamp((R.t + (R.P.audioStart || 0)) / Math.max(0.1, dur), 0, 1), ky = h * 0.7;
      g.fillStyle = hex('#000000', 0.2); rr(g, sx, ky, sw, h * 0.035, 6 * S); g.fill();
      g.fillStyle = '#fff'; rr(g, sx + (sw - w * 0.06) * prog, ky - h * 0.012, w * 0.06, h * 0.06, 5 * S); g.fill();
      // buttons
      var bs = h * 0.13, by = h * 0.8, gap = (sw - bs * 6) / 5;
      for (var b = 0; b < 6; b++) {
        var bx = sx + b * (bs + gap), on = b === 1 && beatEnv(R.P, R.t) > 0.5;
        rr(g, bx, by, bs, bs, bs / 2); g.fillStyle = on ? el.accent : hex('#ffffff', 0.55); g.fill(); g.strokeStyle = hex('#000', 0.2); g.lineWidth = 2 * S; g.stroke();
        g.fillStyle = el.body; var c = bx + bs / 2, cy = by + bs / 2, q = bs * 0.2; g.beginPath();
        if (b === 0) { g.moveTo(c + q, cy - q); g.lineTo(c - q, cy); g.lineTo(c + q, cy + q); } else if (b === 1) { g.moveTo(c - q * 0.7, cy - q); g.lineTo(c + q, cy); g.lineTo(c - q * 0.7, cy + q); }
        else if (b === 2) { g.rect(c - q, cy - q, q * 0.7, q * 2); g.rect(c + q * 0.3, cy - q, q * 0.7, q * 2); } else if (b === 3) g.rect(c - q, cy - q, q * 2, q * 2);
        else if (b === 4) { g.moveTo(c - q, cy - q); g.lineTo(c + q, cy); g.lineTo(c - q, cy + q); } else { g.moveTo(c - q, cy + q * 0.5); g.lineTo(c, cy - q); g.lineTo(c + q, cy + q * 0.5); }
        g.fill();
      }
    }
  };
  T.plugin = {
    label: 'Synth panel', icon: '🎛', midi: true,
    defaults: { midi: 'all', track: -1, channel: -1, brand: 'SYNTH ONE', preset: '001: PLUCK - DREAM', knobs: 6, panel: '#1a1d22', panel2: '#2a2f36', accent: '#3ff0c8', text: '#d9fbf3', offsetShadow: 10, shadowTint: '#ff1f78', radius: 10 },
    render: function (g, el, w, h, R, S) {
      if (el.offsetShadow) { g.fillStyle = el.shadowTint; notch(g, el.offsetShadow * S, el.offsetShadow * S, w, h, el.radius * S); g.fill(); }
      notch(g, 0, 0, w, h, el.radius * S); g.fillStyle = el.panel; g.fill(); g.lineWidth = 3 * S; g.strokeStyle = '#000'; g.stroke();
      var hb = h * 0.16; g.fillStyle = el.panel2; g.fillRect(w * 0.03, h * 0.05, w * 0.94, hb);
      g.fillStyle = el.text; g.font = '900 ' + hb * 0.6 + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'middle'; g.fillText(el.brand, w * 0.06, h * 0.05 + hb / 2);
      g.fillStyle = el.accent; g.font = '700 ' + hb * 0.55 + 'px "VT323", "Space Grotesk", monospace'; g.fillText(el.preset, w * 0.06, h * 0.33);
      // level from notes
      var notes = filterNotes(R.notes, el), lvl = 0;
      notes.forEach(function (n) { if (n.t <= R.t && R.t < n.e + 0.25) lvl = Math.max(lvl, n.v * (R.t < n.e ? 1 : 1 - (R.t - n.e) / 0.25)); });
      g.fillStyle = hex('#000000', 0.4); g.fillRect(w * 0.06, h * 0.43, w * 0.88, h * 0.05); g.fillStyle = el.accent; g.fillRect(w * 0.06, h * 0.43, w * 0.88 * lvl, h * 0.05);
      var n = el.knobs | 0, kr = Math.min(h * 0.17, w * 0.8 / n / 2.4);
      for (var i = 0; i < n; i++) {
        var cx = w * 0.1 + (w * 0.8) * (i + 0.5) / n, cy = h * 0.72, val = 0.3 + 0.5 * ((Math.sin(i * 1.7) + 1) / 2) + lvl * 0.3 * ((i % 3) / 2);
        g.beginPath(); g.arc(cx, cy, kr, 0, TAU); g.fillStyle = '#0d0f12'; g.fill(); g.lineWidth = 2 * S; g.strokeStyle = '#3a4048'; g.stroke();
        g.beginPath(); g.arc(cx, cy, kr * 1.18, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * clamp(val, 0, 1)); g.strokeStyle = el.accent; g.lineWidth = 3 * S; g.stroke();
        var a = Math.PI * 0.75 + Math.PI * 1.5 * clamp(val, 0, 1); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * kr * 0.8, cy + Math.sin(a) * kr * 0.8); g.strokeStyle = el.text; g.stroke();
      }
    }
  };
  T.progress = {
    label: 'Progress bar', icon: '▭', audio: true,
    defaults: { color: '#ff3fc8', track: 'rgba(255,255,255,0.3)', radius: 20, knob: true },
    render: function (g, el, w, h, R, S) {
      var dur = Math.max(0.1, R.P.duration), p = clamp(R.t / dur, 0, 1);
      rr(g, 0, 0, w, h, el.radius * S); g.fillStyle = el.track; g.fill();
      rr(g, 0, 0, Math.max(h, w * p), h, el.radius * S); g.fillStyle = el.color; g.fill();
      if (el.knob) { g.beginPath(); g.arc(Math.max(h / 2, w * p - h / 2), h / 2, h * 0.9, 0, TAU); g.fillStyle = '#fff'; g.fill(); }
    }
  };
  T.timer = {
    label: 'Time', icon: '⏱', audio: true,
    defaults: { font: 'VT323', color: '#ffffff', showTotal: true, size: 80 },
    render: function (g, el, w, h, R) {
      g.fillStyle = el.color; g.font = el.size + 'px "' + el.font + '", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(fmtTime(R.t) + (el.showTotal ? ' / ' + fmtTime(R.P.duration) : ''), w / 2, h / 2); g.textAlign = 'left';
    }
  };
  T.sparkles = {
    label: 'Sparkles', icon: '✦',
    defaults: { count: 24, color: '#ffffff', color2: '#ffe14d', size: 28, speed: 1, onBeat: true },
    render: function (g, el, w, h, R, S) {
      var r = rng(hash(el.id)), be = el.onBeat ? beatEnv(R.P, R.t) : 0;
      for (var i = 0; i < el.count; i++) {
        var x = r() * w, y = r() * h, ph = r() * TAU, sp = (0.5 + r()) * el.speed, sz = el.size * S * (0.4 + r() * 0.8);
        var tw = 0.5 + 0.5 * Math.sin(R.t * sp * 3 + ph), k = clamp(tw + be * 0.5, 0, 1.4);
        g.globalAlpha = clamp(k, 0, 1); g.fillStyle = r() > 0.5 ? el.color : el.color2;
        var s = sz * k; shapePath(g, 'sparkle', x - s / 2, y - s / 2 + Math.sin(R.t * sp + ph) * 6 * S, s, s); g.fill();
      }
      g.globalAlpha = 1;
    }
  };

  /* =========================================================
     BACKGROUND, CAMERA, TRANSITIONS, FX
     ========================================================= */
  function drawBackground(g, P, W, H, R, S) {
    var b = P.bg || {}, t = R.t;
    if (b.type === 'gradient') {
      var a = (b.angle || 0) * Math.PI / 180, cx = W / 2, cy = H / 2, L = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
      var gr = b.radial ? g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7) : g.createLinearGradient(cx - Math.sin(a) * L / 2, cy - Math.cos(a) * L / 2, cx + Math.sin(a) * L / 2, cy + Math.cos(a) * L / 2);
      gr.addColorStop(0, b.color || '#ffffff'); if (b.color3) gr.addColorStop(0.5, b.color3); gr.addColorStop(1, b.color2 || '#ffd6ef'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    } else if (b.type === 'clouds') {
      g.fillStyle = b.color || '#ececf2'; g.fillRect(0, 0, W, H);
      var r = rng(hash('clouds' + (b.seed || 1))), cols = [b.color2 || '#ffb8dc', b.color3 || '#ffffff', b.color4 || '#cfcbd8'];
      var layer = mk(W / 8, H / 8), lg = layer.getContext('2d');
      lg.fillStyle = b.color || '#ececf2'; lg.fillRect(0, 0, layer.width, layer.height);
      for (var i = 0; i < 14; i++) {
        var bx = r() * layer.width, by = r() * layer.height, rad = (0.25 + r() * 0.45) * layer.width, sp = (b.speed == null ? 1 : b.speed) * (0.2 + r() * 0.5);
        var x = bx + Math.sin(t * sp * 0.4 + i) * layer.width * 0.18, y = by + Math.cos(t * sp * 0.3 + i * 2) * layer.height * 0.1;
        var rg = lg.createRadialGradient(x, y, 0, x, y, rad); var c = cols[i % 3];
        rg.addColorStop(0, hex(c, 0.85)); rg.addColorStop(1, hex(c, 0)); lg.fillStyle = rg; lg.fillRect(0, 0, layer.width, layer.height);
      }
      g.imageSmoothingQuality = 'high'; g.drawImage(layer, 0, 0, W, H);
    } else if (b.type === 'media') {
      g.fillStyle = b.color || '#000'; g.fillRect(0, 0, W, H);
      var img = R.media(b.media, b.src);
      if (img) {
        var z = 1 + (b.zoom || 0) / 100 + (b.pulse ? beatEnv(P, t) * 0.03 : 0);
        if ((b.blur || 0) > 0) { var tmp = mk(W / 4, H / 4), tg = tmp.getContext('2d'); drawMediaFit(tg, img, 0, 0, tmp.width, tmp.height, 'cover', z); g.drawImage(softBlur(tmp, b.blur / 4), 0, 0, W, H); }
        else drawMediaFit(g, img, 0, 0, W, H, b.fit || 'cover', z);
      }
    } else { g.fillStyle = b.color || '#ffffff'; g.fillRect(0, 0, W, H); }
    if (b.dim) { g.fillStyle = hex(b.dimColor || '#000000', b.dim / 100); g.fillRect(0, 0, W, H); }
  }
  var TRANSITIONS = [['flash', 'Flash'], ['bounce', 'Bounce punch'], ['zoom', 'Zoom punch'], ['shake', 'Shake'], ['glitch', 'Glitch'], ['whip', 'Whip pan'], ['spin', 'Spin'], ['fade-black', 'Dip to black'], ['fade-white', 'Dip to white'], ['blur', 'Blur'], ['rgb', 'RGB split']];
  function cameraFor(P, t, W, H) {
    var c = { s: 1, x: 0, y: 0, r: 0, overlay: null, overlayA: 0, blur: 0, rgb: 0, glitch: 0 }, cam = P.camera || {};
    if (cam.bounce && cam.bounce !== 'off') {
      var every = cam.bounce === 'bar' ? 4 : cam.bounce === '2beats' ? 2 : cam.bounce === 'half' ? 0.5 : 1;
      c.s += (cam.amount == null ? 4 : cam.amount) / 100 * beatEnv(P, t, every, 8);
    }
    if (cam.drift) { c.s += cam.drift / 100 * (0.5 + 0.5 * Math.sin(t * 0.3)); c.r += Math.sin(t * 0.21) * cam.drift / 2000; }
    if (cam.shake) { var r = rng(Math.floor(t * 30)); c.x += (r() - 0.5) * cam.shake * 2; c.y += (r() - 0.5) * cam.shake * 2; }
    (P.transitions || []).forEach(function (tr) {
      var d = tr.dur || 0.4, f = (t - tr.t) / d; if (f < -1 || f > 1) return;
      var a = 1 - Math.abs(f), e = EASE.out(a), r2 = rng(Math.floor(t * 40) + 7);
      switch (tr.type) {
        case 'flash': if (f >= 0) { c.overlay = tr.color || '#ffffff'; c.overlayA = Math.max(c.overlayA, 1 - f); } break;
        case 'bounce': if (f >= 0) c.s *= 1 + 0.18 * EASE.elastic(1 - f) * (1 - f); break;
        case 'zoom': c.s *= 1 + 0.35 * e; break;
        case 'shake': c.x += (r2() - 0.5) * 80 * a; c.y += (r2() - 0.5) * 80 * a; break;
        case 'glitch': c.glitch = Math.max(c.glitch, a); c.x += (r2() - 0.5) * 50 * a; break;
        case 'whip': c.x += (f < 0 ? 1 : -1) * W * 0.5 * Math.pow(1 - Math.abs(f), 3); c.blur = Math.max(c.blur, a * 30); break;
        case 'spin': c.r += (f < 0 ? -1 : 1) * Math.pow(1 - Math.abs(f), 2) * 0.5; c.s *= 1 + 0.2 * e; break;
        case 'fade-black': c.overlay = '#000000'; c.overlayA = Math.max(c.overlayA, e); break;
        case 'fade-white': c.overlay = '#ffffff'; c.overlayA = Math.max(c.overlayA, e); break;
        case 'blur': c.blur = Math.max(c.blur, e * 30); break;
        case 'rgb': c.rgb = Math.max(c.rgb, e * 24); break;
      }
    });
    return c;
  }
  function applyFX(g, cv, P, t, S, R) {
    var fx = P.fx || {}, W = cv.width, H = cv.height;
    if (fx.rgb > 0 || R.cam.rgb > 0) {
      var off = (fx.rgb || 0) * S + R.cam.rgb * S, copy = mk(W, H); copy.getContext('2d').drawImage(cv, 0, 0);
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.6;
      var red = mk(W, H), rg = red.getContext('2d'); rg.drawImage(copy, 0, 0); rg.globalCompositeOperation = 'multiply'; rg.fillStyle = '#ff0000'; rg.fillRect(0, 0, W, H);
      g.drawImage(red, -off, 0);
      var blue = mk(W, H), bg = blue.getContext('2d'); bg.drawImage(copy, 0, 0); bg.globalCompositeOperation = 'multiply'; bg.fillStyle = '#0040ff'; bg.fillRect(0, 0, W, H);
      g.drawImage(blue, off, 0); g.restore();
    }
    if (R.cam.glitch > 0 || fx.glitch > 0) {
      var amt = Math.max(R.cam.glitch, (fx.glitch || 0) / 100 * (fx.glitchOnBeat ? beatEnv(P, t) : 1)), rr2 = rng(Math.floor(t * 24) + 99), snap = mk(W, H); snap.getContext('2d').drawImage(cv, 0, 0);
      for (var i = 0; i < Math.round(8 * amt); i++) { var y = rr2() * H, hh = rr2() * H * 0.06 + 4, dx = (rr2() - 0.5) * W * 0.12 * amt; g.drawImage(snap, 0, y, W, hh, dx, y, W, hh); }
    }
    if (fx.bloom > 0) { var bl = softBlur(cv, 18 * S); g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = fx.bloom / 100; g.drawImage(bl, 0, 0); g.restore(); }
    if (R.texture && fx.texOpacity > 0) {
      g.save(); g.globalCompositeOperation = fx.texBlend || 'overlay'; g.globalAlpha = fx.texOpacity / 100;
      var tw = R.texture.naturalWidth || R.texture.width, th = R.texture.naturalHeight || R.texture.height, k = Math.max(W / tw, H / th);
      g.drawImage(R.texture, (W - tw * k) / 2, (H - th * k) / 2, tw * k, th * k); g.restore();
    }
    if (fx.scanlines > 0) { g.fillStyle = 'rgba(0,0,0,' + fx.scanlines / 250 + ')'; for (var y2 = 0; y2 < H; y2 += 4 * S) g.fillRect(0, y2, W, 1.5 * S); }
    if (fx.grain > 0) {
      var gn = grainTile(Math.floor(t * 24) % 6); g.save(); g.globalAlpha = fx.grain / 140; g.globalCompositeOperation = 'overlay';
      var pat = g.createPattern(gn, 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, W, H); g.restore();
    }
    if (fx.vignette > 0) { var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + fx.vignette / 100 + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    if (fx.tint && fx.tintAmt > 0) { g.save(); g.globalCompositeOperation = 'color'; g.globalAlpha = fx.tintAmt / 100; g.fillStyle = fx.tint; g.fillRect(0, 0, W, H); g.restore(); }
    if (R.cam.overlay && R.cam.overlayA > 0) { g.fillStyle = hex(R.cam.overlay, clamp(R.cam.overlayA, 0, 1)); g.fillRect(0, 0, W, H); }
  }
  var grains = [];
  function grainTile(i) {
    if (grains[i]) return grains[i];
    var c = mk(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256), r = rng(i * 77 + 3);
    for (var k = 0; k < id.data.length; k += 4) { var v = r() * 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
    g.putImageData(id, 0, 0); return (grains[i] = c);
  }

  /* =========================================================
     FRAME RENDER
     ========================================================= */
  // R = { t, P, notes, an, media(id,src), texture, edit, scale }
  function renderFrame(cv, P, R) {
    var g = cv.getContext('2d'), W = cv.width, H = cv.height, S = W / P.w;
    R.cam = cameraFor(P, R.t, P.w, P.h);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.clearRect(0, 0, W, H);
    // camera
    var cam = R.cam;
    g.translate(W / 2 + cam.x * S, H / 2 + cam.y * S); g.rotate(cam.r); g.scale(cam.s, cam.s); g.translate(-W / 2, -H / 2);
    drawBackground(g, P, W, H, R, S);
    (P.layers || []).forEach(function (el) {
      if (el.hidden || R.t < el.start || R.t >= el.end) return;
      var def = T[el.type]; if (!def) return;
      var a = animState(el, R.t, P, P.w);
      if (a.a <= 0.002 || a.wipe <= 0) return;
      var w = el.w * S, h = el.h * S;
      g.save();
      g.translate((el.x + a.dx) * S, (el.y + a.dy) * S); g.rotate((el.rot || 0) * Math.PI / 180 + a.rot); g.scale(a.sx, a.sy);
      g.globalAlpha = clamp((el.opacity == null ? 100 : el.opacity) / 100 * a.a, 0, 1);
      g.globalCompositeOperation = el.blend || 'source-over';
      if (a.wipe < 1) { g.beginPath(); g.rect(-w / 2, -h / 2, w * a.wipe, h); g.clip(); }
      g.translate(-w / 2, -h / 2);
      var useBuf = a.blur > 0.5 || el.glow > 0 || el.shadowOpacity > 0;
      if (useBuf) {
        var pad = Math.ceil((Math.max(el.glow || 0, el.shadowBlur || 0, a.blur) + Math.abs(el.shadowX || 0) + Math.abs(el.shadowY || 0)) * S * 1.5 + 4);
        var buf = mk(w + pad * 2, h + pad * 2), bg2 = buf.getContext('2d'); bg2.translate(pad, pad);
        try { def.render(bg2, el, w, h, R, S); } catch (e) { console.error(e); }
        var src = a.blur > 0.5 ? softBlur(buf, a.blur * S) : buf;
        if (el.shadowOpacity > 0) { g.save(); g.shadowColor = hex(el.shadowColor || '#000', el.shadowOpacity / 100); g.shadowBlur = (el.shadowBlur || 0) * S; g.shadowOffsetX = (el.shadowX || 0) * S; g.shadowOffsetY = (el.shadowY || 0) * S; g.drawImage(src, -pad, -pad); g.restore(); }
        if (el.glow > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.8; g.drawImage(softBlur(src, el.glow * S), -pad, -pad); g.restore(); }
        if (!(el.shadowOpacity > 0)) g.drawImage(src, -pad, -pad);
      } else {
        try { def.render(g, el, w, h, R, S); } catch (e) { console.error(e); }
      }
      g.restore();
    });
    g.restore();
    g.save();
    if (cam.blur > 1) { var b = softBlur(cv, cam.blur * S); g.clearRect(0, 0, W, H); g.drawImage(b, 0, 0); }
    applyFX(g, cv, P, R.t, S, R);
    g.restore();
  }

  /* =========================================================
     PROJECT + ELEMENT FACTORY
     ========================================================= */
  var uidN = 0;
  function uid(p) { return (p || 'e') + Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function newElement(type, P, extra) {
    var def = T[type], W = P.w, H = P.h;
    var size = { text: [W * 0.85, H * 0.12], image: [W * 0.6, W * 0.6], video: [W * 0.8, W * 0.45], shape: [W * 0.3, W * 0.3], pianoroll: [W * 0.9, H * 0.3], stepgrid: [W * 0.9, H * 0.25], falling: [W, H * 0.5], noteburst: [W, H * 0.5], spectrum: [W * 0.85, H * 0.15], waveform: [W * 0.85, H * 0.12], player: [W * 0.85, W * 0.5], plugin: [W * 0.6, W * 0.33], progress: [W * 0.8, H * 0.012], timer: [W * 0.5, H * 0.06], sparkles: [W, H] }[type] || [W * 0.5, H * 0.2];
    var el = Object.assign({ id: uid('el'), type: type, name: def.label, x: W / 2, y: H / 2, w: size[0], h: size[1], rot: 0, opacity: 100, start: 0, end: Math.max(1, P.duration), hidden: false, locked: false, anim: { in: 'pop', inDur: 0.45, out: 'none', outDur: 0.35, loop: 'none', loopAmt: 1, loopEvery: 1, loopSpeed: 1 } }, COMMON_STYLE, JSON.parse(JSON.stringify(def.defaults)), extra || {});
    return el;
  }
  function newProject(opts) {
    opts = opts || {};
    var ratio = opts.ratio || '9:16', dims = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] }[ratio] || [1080, 1920];
    return { v: 1, id: uid('p'), name: opts.name || 'My short', ratio: ratio, w: dims[0], h: dims[1], fps: 30, duration: 15, bpm: 140, beatOffset: 0, audio: null, audioStart: 0, audioVol: 100, midis: [], bg: { type: 'color', color: '#ffffff' }, camera: { bounce: 'off', amount: 4, shake: 0, drift: 0 }, fx: { grain: 0, vignette: 0, rgb: 0, scanlines: 0, bloom: 0, glitch: 0, tint: '#ff3fc8', tintAmt: 0, texture: '', texBlend: 'overlay', texOpacity: 0 }, transitions: [], layers: [], media: {} };
  }

  /* =========================================================
     TEMPLATES  (P = project; layers use a helper)
     ========================================================= */
  function L(P, type, props) { return newElement(type, P, props); }
  var TEMPLATES = [
    { id: 'preset-breakdown', name: 'Preset breakdown', desc: 'Dark piano roll + synth panels on pink clouds, word-by-word captions', build: function () {
      var P = newProject({ name: 'Preset breakdown' }); P.bpm = 143; P.duration = 16;
      P.bg = { type: 'clouds', color: '#ecebf1', color2: '#ffb3d6', color3: '#ffffff', color4: '#d2cfdc', speed: 0.6 };
      P.camera = { bounce: 'beat', amount: 1.5, shake: 0, drift: 0 }; P.fx.grain = 10;
      P.layers = [
        L(P, 'plugin', { name: 'Synth panel 1', x: 760, y: 300, w: 560, h: 250, brand: 'SYNTH ONE', preset: '001: PLUCK - DREAM', anim: { in: 'slide-left', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } }),
        L(P, 'plugin', { name: 'Synth panel 2', x: 760, y: 590, w: 560, h: 250, start: 2, brand: 'SYNTH ONE', preset: '008: PLUCK - GLASS', anim: { in: 'slide-left', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } }),
        L(P, 'text', { name: 'Caption', x: 290, y: 330, w: 500, h: 360, text: 'TO MAKE IT\n*engaging*', font: 'Luckiest Guy', size: 92, color: '#ffffff', stroke: 9, strokeColor: '#ff2a7a', accentColor: '#ff2a7a', accentFont: 'UnifrakturMaguntia', accentGlow: 22, reveal: 'word', revealDur: 1.6, anim: { in: 'none', inDur: 0.3, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.4, loopEvery: 1 } }),
        L(P, 'image', { name: 'Your character', x: 330, y: 1000, w: 520, h: 440, radius: 0, placeholder: 'DROP YOUR CHARACTER', anim: { in: 'bounce', inDur: 0.6, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.5, loopEvery: 2 } }),
        L(P, 'sparkles', { name: 'Hearts & sparkles', x: 300, y: 960, w: 560, h: 420, count: 7, color: '#ff2a7a', color2: '#ffffff', size: 34 }),
        L(P, 'pianoroll', { name: 'Piano roll', x: 520, y: 1470, w: 960, h: 560, label: 'PLUCKS', anim: { in: 'pop', inDur: 0.5, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } })
      ];
      return P;
    } },
    { id: 'drum-grid', name: 'Drum grid', desc: 'Step-sequencer squares light up with your drums', build: function () {
      var P = newProject({ name: 'Drum grid' }); P.bpm = 143; P.duration = 12;
      P.bg = { type: 'clouds', color: '#f1eff4', color2: '#ffc4df', color3: '#ffffff', color4: '#d9d5e2', speed: 0.5 };
      P.camera = { bounce: 'beat', amount: 2, shake: 0, drift: 0 };
      P.layers = [
        L(P, 'text', { name: 'Caption', x: 290, y: 330, w: 520, h: 330, text: 'TO CREATE\nINTERESTING\n*syncopation*', font: 'Luckiest Guy', size: 80, stroke: 8, strokeColor: '#ff2a7a', accentColor: '#ff2a7a', accentFont: 'UnifrakturMaguntia', accentGlow: 20, reveal: 'word', revealDur: 1.4 }),
        L(P, 'plugin', { name: 'Oneshot panel', x: 760, y: 360, w: 520, h: 200, brand: 'ONESHOT', preset: '808 - SUB', knobs: 0, panel: '#0d0d10', panel2: '#0d0d10', accent: '#ffffff', text: '#ffffff' }),
        L(P, 'image', { name: 'Your character', x: 320, y: 930, w: 500, h: 420, radius: 0, placeholder: 'DROP YOUR CHARACTER', anim: { in: 'bounce', inDur: 0.6, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.5, loopEvery: 1 } }),
        L(P, 'stepgrid', { name: 'Step grid', x: 520, y: 1440, w: 960, h: 600, label: 'BASS', anim: { in: 'pop', inDur: 0.5, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } })
      ];
      return P;
    } },
    { id: 'pink-player', name: 'Pink player', desc: 'Huge condensed text, retro player and photo cards on white', build: function () {
      var P = newProject({ name: 'Pink player' }); P.bpm = 140; P.duration = 14;
      P.bg = { type: 'color', color: '#ffffff' };
      P.camera = { bounce: 'beat', amount: 1, shake: 0, drift: 0 };
      var a1 = { in: 'pop', inDur: 0.3, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 };
      P.layers = [
        L(P, 'text', { name: 'Big text top', x: 540, y: 300, w: 900, h: 300, text: 'KEEP YOUR', font: 'Anton', size: 250, color: '#ff3fa4', stroke: 0, reveal: 'word', revealDur: 0.6, end: 6, anim: a1 }),
        L(P, 'player', { name: 'Retro player', x: 540, y: 830, w: 900, h: 520, start: 1, anim: { in: 'bounce', inDur: 0.6, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } }),
        L(P, 'text', { name: 'Big text bottom', x: 540, y: 1360, w: 900, h: 300, text: 'BEATS SIMPLE', font: 'Anton', size: 240, color: '#ff3fa4', reveal: 'word', revealDur: 0.8, start: 0.6, end: 6, anim: a1 }),
        L(P, 'image', { name: 'Photo top', x: 540, y: 330, w: 880, h: 420, radius: 60, start: 6, placeholder: 'DROP A PHOTO', anim: { in: 'pop', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } }),
        L(P, 'image', { name: 'Photo bottom', x: 540, y: 1380, w: 880, h: 420, radius: 60, start: 6.3, placeholder: 'DROP A PHOTO', anim: { in: 'pop', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } }),
        L(P, 'text', { name: 'Tag', x: 540, y: 1720, w: 800, h: 160, text: '+ GRADE', font: 'Anton', size: 140, color: '#c76bff', start: 10, anim: { in: 'bounce', inDur: 0.5, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.5, loopEvery: 1 } })
      ];
      P.transitions = [{ id: uid('tr'), t: 6, type: 'bounce', dur: 0.5, color: '#ffffff' }, { id: uid('tr'), t: 10, type: 'flash', dur: 0.3, color: '#ffffff' }];
      return P;
    } },
    { id: 'waveform-stack', name: 'Waveform stack', desc: 'Pink waveform + MIDI lanes with LEAD / ARP labels', build: function () {
      var P = newProject({ name: 'Waveform stack' }); P.bpm = 140; P.duration = 12;
      P.bg = { type: 'color', color: '#ffffff' };
      var pink = { bg: '#ff7fc4', frame: 0, shape: 'rect', radius: 4, titleBar: false, offsetShadow: 0, noteColor: '#ffffff', noteColor2: '#ffe3f2', activeColor: '#ffffff', gridColor: 'rgba(255,255,255,0.15)', barLineColor: 'rgba(255,255,255,0.3)', playhead: '#ffffff', keys: false, bpmLabel: false, labelColor: '#ffffff', mode: 'scroll', beats: 8 };
      P.layers = [
        L(P, 'text', { name: 'LEAD', x: 300, y: 330, w: 460, h: 260, text: 'LEAD', font: 'Anton', size: 230, color: '#ff3fa4', align: 'left', anim: { in: 'slide-right', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'none', loopAmt: 1, loopEvery: 1 } }),
        L(P, 'waveform', { name: 'Waveform', x: 540, y: 640, w: 900, h: 260, label: 'STARTER', style: 'full' }),
        L(P, 'pianoroll', Object.assign({ name: 'MIDI lane 1', x: 540, y: 960, w: 900, h: 260, label: 'SYNTH 1', start: 0.5 }, pink)),
        L(P, 'pianoroll', Object.assign({ name: 'MIDI lane 2', x: 540, y: 1280, w: 900, h: 260, label: 'SYNTH 2', start: 1, channel: 9 }, pink)),
        L(P, 'text', { name: 'ARP', x: 800, y: 1620, w: 460, h: 260, text: 'ARP', font: 'Anton', size: 230, color: '#ff3fa4', align: 'right', start: 1.5, anim: { in: 'slide-left', inDur: 0.4, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.3, loopEvery: 1 } })
      ];
      return P;
    } },
    { id: 'neon-keys', name: 'Neon keys', desc: 'Falling notes onto a glowing keyboard', build: function () {
      var P = newProject({ name: 'Neon keys' }); P.bpm = 140; P.duration = 15;
      P.bg = { type: 'gradient', color: '#120625', color2: '#000000', color3: '#2b0b4a', angle: 180 };
      P.fx = Object.assign(P.fx, { bloom: 35, vignette: 45, grain: 8 }); P.camera = { bounce: 'beat', amount: 2, shake: 0, drift: 2 };
      P.layers = [
        L(P, 'falling', { name: 'Falling notes', x: 540, y: 1180, w: 1080, h: 1240 }),
        L(P, 'text', { name: 'Title', x: 540, y: 300, w: 900, h: 200, text: 'NIGHT *keys*', font: 'Bungee', size: 120, color: '#ffffff', accentColor: '#38c8ff', accentFont: 'Monoton', accentGlow: 30, glow: 20, glowColor: '#ff3fc8' }),
        L(P, 'spectrum', { name: 'Spectrum', x: 540, y: 470, w: 860, h: 120, style: 'line', color: '#ff3fc8', color2: '#38c8ff', glow: 12 }),
        L(P, 'noteburst', { name: 'Bursts', x: 540, y: 1100, w: 1080, h: 600, style: 'rings', color: '#ff3fc8', color2: '#38c8ff' })
      ];
      return P;
    } },
    { id: 'cover-pulse', name: 'Cover pulse', desc: 'Your cover art with a circle spectrum + progress', build: function () {
      var P = newProject({ name: 'Cover pulse' }); P.bpm = 140; P.duration = 15;
      P.bg = { type: 'gradient', color: '#ff7ac6', color2: '#6a2cff', angle: 160 }; P.camera = { bounce: 'beat', amount: 2.5, shake: 0, drift: 0 }; P.fx.grain = 12;
      P.layers = [
        L(P, 'spectrum', { name: 'Circle spectrum', x: 540, y: 820, w: 900, h: 900, style: 'circle', bands: 72, inner: 62, color: '#ffffff', color2: '#ffe14d', gap: 35 }),
        L(P, 'image', { name: 'Cover art', x: 540, y: 820, w: 540, h: 540, radius: 270, placeholder: 'DROP COVER ART', anim: { in: 'pop', inDur: 0.5, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.4, loopEvery: 1 } }),
        L(P, 'text', { name: 'Song title', x: 540, y: 1420, w: 900, h: 140, text: 'SONG TITLE', font: 'Archivo Black', size: 96, color: '#ffffff' }),
        L(P, 'text', { name: 'Artist', x: 540, y: 1530, w: 900, h: 80, text: 'prod. sul0557', font: 'Space Grotesk', weight: 700, size: 54, color: '#ffe3f6', caps: false }),
        L(P, 'progress', { name: 'Progress', x: 540, y: 1660, w: 820, h: 16, color: '#ffffff' }),
        L(P, 'timer', { name: 'Time', x: 540, y: 1730, w: 600, h: 70, size: 56 })
      ];
      return P;
    } },
    { id: 'chrome-lyrics', name: 'Y2K lyrics', desc: 'Chrome words pop on every beat with sparkles', build: function () {
      var P = newProject({ name: 'Y2K lyrics' }); P.bpm = 140; P.duration = 12;
      P.bg = { type: 'gradient', color: '#d8f0ff', color2: '#ffd1f1', color3: '#efe3ff', angle: 200 }; P.camera = { bounce: 'beat', amount: 3, shake: 0, drift: 0 };
      P.layers = [
        L(P, 'sparkles', { name: 'Sparkles', count: 30, color: '#ffffff', color2: '#ff9be6', size: 40 }),
        L(P, 'text', { name: 'Lyrics', x: 540, y: 900, w: 960, h: 700, text: 'SAY IT\nLOUD *forever*', font: 'Bowlby One SC', size: 150, color: '#ffffff', gradient: true, color2: '#7d8aa3', stroke: 6, strokeColor: '#3b2a63', accentColor: '#ff3fc8', accentFont: 'Pacifico', accentGlow: 24, reveal: 'beat', anim: { in: 'none', inDur: 0.3, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.6, loopEvery: 1 } }),
        L(P, 'noteburst', { name: 'Star bursts', style: 'stars', layout: 'random', color: '#ffffff', color2: '#ffe14d', size: 120 })
      ];
      return P;
    } },
    { id: 'pixel-arcade', name: 'Pixel arcade', desc: 'SUL pixel style — sky colours, pixel font, step grid', build: function () {
      var P = newProject({ name: 'Pixel arcade' }); P.bpm = 140; P.duration = 12;
      P.bg = { type: 'gradient', color: '#fbe3f6', color2: '#ffe9f7', color3: '#e9ecff', angle: 180 }; P.camera = { bounce: 'beat', amount: 2, shake: 0, drift: 0 }; P.fx.scanlines = 20;
      P.layers = [
        L(P, 'text', { name: 'Title', x: 540, y: 340, w: 940, h: 260, text: 'PRESS *start*', font: 'Pixelify Sans', weight: 700, size: 150, color: '#2a1240', accentColor: '#ff3fc8', accentFont: 'Press Start 2P', accentGlow: 0, anim: { in: 'drop', inDur: 0.8, out: 'none', outDur: 0.3, loop: 'beat-bounce', loopAmt: 0.4, loopEvery: 1 } }),
        L(P, 'stepgrid', { name: 'Step grid', x: 540, y: 960, w: 940, h: 640, label: 'SUL.EXE', bg: '#ffffff', barColor: '#2a1240', frameColor: '#2a1240', offColor: '#f1e8fb', onColor: '#ff3fc8', onColor2: '#38c8ff', hitColor: '#ffe14d', shape: 'rect', radius: 0, shadowTint: '#8a3cff', labelColor: '#2a1240' }),
        L(P, 'spectrum', { name: 'Spectrum', x: 540, y: 1480, w: 900, h: 220, style: 'dots', bands: 24, color: '#ff3fc8', color2: '#8a3cff', gap: 25 }),
        L(P, 'text', { name: 'Handle', x: 540, y: 1700, w: 700, h: 90, text: '@SUL0557', font: 'Silkscreen', size: 60, color: '#8a3cff' })
      ];
      return P;
    } },
    { id: 'blank', name: 'Blank', desc: 'Start from nothing', build: function () { var P = newProject({ name: 'Untitled' }); return P; } }
  ];

  window.ShortCore = {
    T: T, TEMPLATES: TEMPLATES, FONTS: FONTS, IN_ANIMS: IN_ANIMS, LOOP_ANIMS: LOOP_ANIMS, TRANSITIONS: TRANSITIONS, COMMON_STYLE: COMMON_STYLE,
    parseMidi: parseMidi, demoMidi: demoMidi, Analysis: Analysis, midiNotes: midiNotes, beatPos: beatPos, beatEnv: beatEnv,
    renderFrame: renderFrame, newProject: newProject, newElement: newElement, uid: uid, ensureFont: ensureFont, fmtTime: fmtTime, mk: mk, clamp: clamp, noteName: noteName
  };
})();
