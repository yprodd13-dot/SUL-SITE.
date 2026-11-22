/* =========================================================
   SUL0557 — SHORT EDITOR engine (v2)
   MIDI, audio mixing + analysis, beat clock, colour fills,
   keyframes + easing curves, animations, effects, adjustment
   layers, clip timing (trim / speed / speed curves), rendering
   and a small MP4 writer for frame-perfect exports.
   ========================================================= */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function hash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function frac(x) { return x - Math.floor(x); }
  function parseC(c) {
    c = String(c || '#000').trim();
    var m = /^rgba?\(([^)]+)\)/.exec(c); if (m) { var p = m[1].split(',').map(Number); return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] == null ? 1 : p[3]]; }
    c = c.replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c.slice(0, 6), 16); if (isNaN(n)) n = 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, c.length === 8 ? parseInt(c.slice(6), 16) / 255 : 1];
  }
  function rgba(c, a) { var p = parseC(c); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (a == null ? p[3] : a) + ')'; }
  function mixColor(a, b, t) { var A = parseC(a), B = parseC(b); return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')'; }
  function hueShift(c, deg) {
    var p = parseC(c), r = p[0] / 255, g = p[1] / 255, b = p[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return 'hsl(' + ((h + deg) % 360 + 360) % 360 + ',' + Math.round(s * 100) + '%,' + Math.round(l * 100) + '%)';
  }
  function fmtTime(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteName(p) { return NOTE_NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1); }
  function isBlack(p) { return [1, 3, 6, 8, 10].indexOf(((p % 12) + 12) % 12) >= 0; }

  /* =========================================================
     EASING (named presets + custom cubic-bezier graphs)
     ========================================================= */
  function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1; } function b(p1, p2) { return 3 * p2 - 6 * p1; } function c(p1) { return 3 * p1; }
    function calc(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t; }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x; for (var i = 0; i < 8; i++) { var s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (calc(t, x1, x2) - x) / s; }
      if (t < 0 || t > 1 || Math.abs(calc(t, x1, x2) - x) > 1e-3) { var lo = 0, hi = 1; t = x; for (i = 0; i < 30; i++) { var v = calc(t, x1, x2); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return calc(t, y1, y2);
    };
  }
  var EASE_PRESETS = [
    ['linear', 'Linear', [0, 0, 1, 1]], ['smooth', 'Smooth', [0.42, 0, 0.58, 1]], ['out', 'Ease out', [0, 0, 0.3, 1]], ['in', 'Ease in', [0.6, 0, 1, 1]],
    ['snap', 'Snap', [0.8, 0, 0.1, 1]], ['soft', 'Soft', [0.25, 0.1, 0.25, 1]], ['overshoot', 'Overshoot', [0.3, 1.6, 0.5, 1]], ['anticipate', 'Anticipate', [0.5, -0.6, 0.6, 1]],
    ['back', 'Back', 'back'], ['elastic', 'Elastic', 'elastic'], ['bounce', 'Bounce', 'bounce'], ['hold', 'Hold (jump)', 'hold']
  ];
  var EASE_FN = {
    back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    elastic: function (t) { if (t <= 0 || t >= 1) return clamp(t, 0, 1); return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; },
    bounce: function (t) { var n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; },
    hold: function (t) { return t >= 1 ? 1 : 0; }
  };
  var bzCache = {};
  function easeFn(e) {
    if (Array.isArray(e) && e.length === 4) { var k = e.join(','); return bzCache[k] || (bzCache[k] = bezier(+e[0], +e[1], +e[2], +e[3])); }
    if (EASE_FN[e]) return EASE_FN[e];
    for (var i = 0; i < EASE_PRESETS.length; i++) if (EASE_PRESETS[i][0] === e) return easeFn(EASE_PRESETS[i][2]);
    return easeFn([0.42, 0, 0.58, 1]);
  }

  /* =========================================================
     MIDI (Standard MIDI File, format 0/1, any DAW incl. FL Studio)
     ========================================================= */
  function parseMidi(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), p = 0;
    function str(at, n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u8[at + i]); return s; }
    // find the header even if wrapped (RIFF/RMID) or preceded by junk
    var hp = -1; for (var q = 0; q < Math.min(u8.length - 4, 4096); q++) if (u8[q] === 0x4d && u8[q + 1] === 0x54 && u8[q + 2] === 0x68 && u8[q + 3] === 0x64) { hp = q; break; }
    if (hp < 0) throw new Error('This isn\'t a MIDI file (.mid)');
    p = hp;
    var hl = dv.getUint32(p + 4), format = dv.getUint16(p + 8), ntr = dv.getUint16(p + 10), div = dv.getUint16(p + 12);
    p += 8 + hl;
    var smpte = div & 0x8000, ppq = smpte ? 0 : div, ticksPerSec = 0;
    if (smpte) { var fps = 256 - (div >> 8); if (fps === 29) fps = 29.97; ticksPerSec = fps * (div & 255); }
    var notes = [], tempos = [], tracks = [], sigs = [], tr = 0;
    function vlq() { var v = 0, b, n = 0; do { b = u8[p++]; v = (v * 128) + (b & 127); n++; } while (b & 128 && p < u8.length && n < 5); return v; }
    while (p + 8 <= u8.length && tr < ntr + 64) {
      var id = str(p, 4), len = dv.getUint32(p + 4);
      if (id !== 'MTrk') { p += 8 + len; continue; }
      var end = Math.min(u8.length, p + 8 + len); p += 8;
      var tick = 0, status = 0, open = {}, name = '', chans = {}, count = 0, ended = false;
      while (p < end && !ended) {
        tick += vlq();
        if (p >= end) break;
        var b0 = u8[p];
        if (b0 === 0xff) { // meta — does not change running status
          p++; var mt = u8[p++], ml = vlq();
          if (mt === 0x51 && ml === 3) tempos.push({ tick: tick, us: (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2] });
          else if ((mt === 0x03 || (mt === 0x04 && !name)) && ml > 0 && !name) name = str(p, Math.min(ml, 60));
          else if (mt === 0x58 && ml >= 2) sigs.push({ tick: tick, num: u8[p], den: Math.pow(2, u8[p + 1]) });
          else if (mt === 0x2f) ended = true;
          p += ml; continue;
        }
        if (b0 === 0xf0 || b0 === 0xf7) { p++; var sl = vlq(); p += sl; continue; } // sysex — keep running status
        if (b0 & 0x80) { status = b0; p++; }
        else if (!status) { p++; continue; } // stray data byte: skip it
        var type = status & 0xf0, ch = status & 15;
        if (type === 0x90 || type === 0x80) {
          var pitch = u8[p++] & 127, vel = u8[p++] & 127, key = ch * 128 + pitch;
          if (type === 0x90 && vel > 0) { (open[key] = open[key] || []).push({ tick: tick, vel: vel }); chans[ch] = 1; }
          else if (open[key] && open[key].length) { var o = open[key].shift(); notes.push({ tr: tr, ch: ch, p: pitch, v: o.vel / 127, tick: o.tick, etick: Math.max(o.tick + 1, tick) }); count++; }
        } else if (type === 0xc0 || type === 0xd0) p += 1;
        else if (type >= 0x80 && type < 0xf0) p += 2;
        else p += 1;
      }
      Object.keys(open).forEach(function (k) { open[k].forEach(function (o) { notes.push({ tr: tr, ch: +k >> 7, p: +k & 127, v: o.vel / 127, tick: o.tick, etick: Math.max(o.tick + (ppq || 96) / 4, tick) }); count++; }); });
      name = name.replace(/[^\x20-\x7e]/g, '').trim();
      tracks.push({ index: tr, name: name || 'Track ' + (tr + 1), notes: count, channels: Object.keys(chans).map(Number) });
      p = end; tr++;
    }
    tempos.sort(function (a, b) { return a.tick - b.tick; });
    if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: tempos.length ? tempos[0].us : 500000 });
    notes.sort(function (a, b) { return a.tick - b.tick || a.p - b.p; });
    if (!notes.length) throw new Error('This MIDI file has no notes in it');
    var m = { format: format, ppq: ppq || 480, smpte: !!smpte, ticksPerSec: ticksPerSec, tempos: tempos, sigs: sigs, tracks: tracks.filter(function (t) { return t.notes > 0; }), notes: notes };
    notes.forEach(function (n) { n.t = tickToSec(m, n.tick); n.e = tickToSec(m, n.etick); });
    m.bpm = Math.round(60000000 / tempos[0].us * 100) / 100;
    m.duration = 0; notes.forEach(function (n) { if (n.e > m.duration) m.duration = n.e; });
    m.lo = 127; m.hi = 0; notes.forEach(function (n) { if (n.p < m.lo) m.lo = n.p; if (n.p > m.hi) m.hi = n.p; });
    return m;
  }
  function tickToSec(m, tick) {
    if (m.smpte) return tick / m.ticksPerSec;
    var s = 0, last = 0, us = m.tempos[0].us;
    for (var i = 0; i < m.tempos.length && m.tempos[i].tick <= tick; i++) { s += (m.tempos[i].tick - last) / m.ppq * us / 1e6; last = m.tempos[i].tick; us = m.tempos[i].us; }
    return s + (tick - last) / m.ppq * us / 1e6;
  }
  function toVlq(n) { var b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }
  function demoMidi(bpm) {
    bpm = bpm || 140;
    var ppq = 96, ev = [], melody = [72, 75, 79, 77, 75, 72, 70, 72, 75, 79, 82, 79, 77, 75, 74, 75], bass = [48, 48, 51, 46], i, bar;
    for (bar = 0; bar < 16; bar++) {
      for (i = 0; i < 8; i++) { var pp = melody[(bar % 2) * 8 + i]; ev.push([bar * 4 * ppq + i * ppq / 2, 0x90, pp, 90 + (i % 3) * 10], [bar * 4 * ppq + i * ppq / 2 + ppq / 2 - 6, 0x80, pp, 0]); }
      var bb = bass[bar % 4]; ev.push([bar * 4 * ppq, 0x91, bb, 110], [bar * 4 * ppq + ppq * 3, 0x81, bb, 0]);
      for (i = 0; i < 16; i++) {
        var t0 = bar * 4 * ppq + i * ppq / 4;
        if (i % 4 === 0 || i === 10) ev.push([t0, 0x99, 36, 120], [t0 + 20, 0x89, 36, 0]);
        if (i % 8 === 4) ev.push([t0, 0x99, 38, 115], [t0 + 20, 0x89, 38, 0]);
        if (i % 2 === 0) ev.push([t0, 0x99, 42, 70 + (i % 4) * 10], [t0 + 10, 0x89, 42, 0]);
      }
    }
    ev.sort(function (a, b) { return a[0] - b[0] || (a[1] & 0xf0) - (b[1] & 0xf0); });
    var us = Math.round(60000000 / bpm), trk = [0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255], last = 0;
    ev.forEach(function (e) { trk = trk.concat(toVlq(e[0] - last), [e[1], e[2], e[3]]); last = e[0]; });
    trk = trk.concat([0, 0xff, 0x2f, 0]);
    var out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, ppq].concat([0x4d, 0x54, 0x72, 0x6b], [(trk.length >>> 24) & 255, (trk.length >>> 16) & 255, (trk.length >>> 8) & 255, trk.length & 255], trk);
    return parseMidi(new Uint8Array(out).buffer);
  }

  /* =========================================================
     AUDIO analysis (of the final mix, lined up with the timeline)
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
    this.sr = sr; this.mono = mono; this.duration = n / sr; this.cache = {}; this.lv = {};
    var P = 4000, per = Math.max(1, Math.floor(n / P)), mx = 0; this.peaks = new Float32Array(P);
    for (i = 0; i < P; i++) { var m = 0, s0 = i * per; for (var k = 0; k < per && s0 + k < n; k += 4) { var a = Math.abs(mono[s0 + k]); if (a > m) m = a; } this.peaks[i] = m; if (m > mx) mx = m; }
    if (mx > 0) for (i = 0; i < P; i++) this.peaks[i] /= mx;
    this.re = new Float32Array(FFT_N); this.im = new Float32Array(FFT_N);
  }
  Analysis.prototype.rawSpec = function (fi) {
    var k = 'r' + fi; if (this.cache[k]) return this.cache[k];
    var c = Math.round(fi / 60 * this.sr) - FFT_N / 2, re = this.re, im = this.im, i;
    for (i = 0; i < FFT_N; i++) { var s = c + i; re[i] = (s >= 0 && s < this.mono.length ? this.mono[s] : 0) * hann[i]; im[i] = 0; }
    fft(re, im);
    var out = new Float32Array(FFT_N / 2);
    for (i = 0; i < FFT_N / 2; i++) { var mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (FFT_N / 4); out[i] = clamp((20 * Math.log10(mag + 1e-9) + 80) / 72, 0, 1); }
    return (this.cache[k] = out);
  };
  Analysis.prototype.spectrum = function (t, bands) {
    var fi = Math.round(t * 60), key = fi + ':' + bands;
    if (this.cache[key]) return this.cache[key];
    if (Object.keys(this.cache).length > 3000) this.cache = {};
    var out = new Float32Array(bands);
    for (var f = -1; f <= 1; f++) {
      var w = f === 0 ? 0.5 : 0.25, spec = this.rawSpec(fi + f), nb = spec.length;
      for (var b = 0; b < bands; b++) {
        var lo = Math.floor(Math.pow(b / bands, 2.2) * (nb - 2)) + 1, hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / bands, 2.2) * (nb - 2)) + 1), m = 0;
        for (var k = lo; k < hi; k++) if (spec[k] > m) m = spec[k];
        out[b] += m * w;
      }
    }
    return (this.cache[key] = out);
  };
  Analysis.prototype.level = function (t) {
    var fi = Math.round(t * 60); if (this.lv[fi] != null) return this.lv[fi];
    var c = Math.round(t * this.sr), s = 0, N = 1024;
    for (var i = -N / 2; i < N / 2; i++) { var v = this.mono[c + i] || 0; s += v * v; }
    return (this.lv[fi] = clamp(Math.sqrt(s / N) * 3.2, 0, 1));
  };
  Analysis.prototype.wave = function (t, n, span) {
    var c = Math.round(t * this.sr), half = Math.round(span * this.sr / 2), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = this.mono[c - half + Math.round(i / n * half * 2)] || 0;
    return out;
  };
  Analysis.prototype.detectBPM = function () {
    var hop = Math.round(this.sr / 100), n = Math.floor(this.mono.length / hop), env = new Float32Array(n), prev = 0, i, j;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < hop; j += 2) { var v = this.mono[i * hop + j]; s += v * v; } s = Math.sqrt(s / (hop / 2)); env[i] = Math.max(0, s - prev); prev = s; }
    var best = 0, bestBpm = 120;
    for (var bpm = 70; bpm <= 180; bpm += 0.5) {
      var lag = 6000 / bpm, sc = 0, cnt = 0;
      for (i = 0; i + lag * 2 < n; i++) { sc += env[i] * (env[Math.round(i + lag)] + 0.5 * env[Math.round(i + lag * 2)]); cnt++; }
      sc /= Math.max(1, cnt); if (sc > best) { best = sc; bestBpm = bpm; }
    }
    if (bestBpm < 85) bestBpm *= 2;
    var lagB = 6000 / bestBpm, bestOff = 0, bestS = -1;
    for (var off = 0; off < lagB; off++) { var ss = 0; for (var q = off; q < n; q += lagB) ss += env[Math.floor(q)] || 0; if (ss > bestS) { bestS = ss; bestOff = off; } }
    return { bpm: Math.round(bestBpm * 10) / 10, offset: bestOff / 100 };
  };

  /* =========================================================
     MIDI timing for a project
     ========================================================= */
  function midiNotes(P, midis) {
    var out = [];
    (P.midis || []).forEach(function (mref) {
      var m = midis[mref.id]; if (!m) return;
      var key = [mref.id, mref.mode, P.bpm, mref.offset, mref.transpose].join('|');
      if (m._key !== key) {
        var spb = 60 / (P.bpm || 120);
        m._timed = m.notes.map(function (n) {
          var t = mref.mode === 'project' ? n.tick / m.ppq * spb : n.t, e = mref.mode === 'project' ? n.etick / m.ppq * spb : n.e;
          return { t: t + (mref.offset || 0), e: e + (mref.offset || 0), p: n.p + (mref.transpose || 0), v: n.v, tr: n.tr, ch: n.ch, src: mref.id };
        });
        m._key = key;
      }
      out = out.concat(m._timed);
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  function filterNotes(notes, el) {
    if ((!el.midi || el.midi === 'all') && !(+el.track >= 0) && !(+el.channel >= 0)) return notes;
    return notes.filter(function (n) {
      if (el.midi && el.midi !== 'all' && n.src !== el.midi) return false;
      if (+el.track >= 0 && n.tr !== +el.track) return false;
      if (+el.channel >= 0 && n.ch !== +el.channel) return false;
      return true;
    });
  }

  /* ---------- beat clock ---------- */
  function beatPos(P, t) { return (t - (P.beatOffset || 0)) * (P.bpm || 120) / 60; }
  function beatEnv(P, t, every, sharp) {
    every = every || 1; var b = beatPos(P, t) / every; if (b < 0) return 0; var f = b - Math.floor(b);
    return Math.exp(-(sharp || 7) * f * every * 60 / (P.bpm || 120) * 4);
  }

  /* ---------- fonts ---------- */
  var FONTS = ['Anton', 'Bebas Neue', 'Archivo Black', 'Luckiest Guy', 'Bungee', 'Rubik Mono One', 'Pixelify Sans', 'Press Start 2P', 'Silkscreen', 'VT323', 'UnifrakturMaguntia', 'Pirata One', 'Monoton', 'Pacifico', 'Permanent Marker', 'Caveat', 'Orbitron', 'Chakra Petch', 'Righteous', 'Fredoka', 'Space Grotesk', 'Poppins', 'Inter', 'Montserrat', 'Syne', 'Unbounded', 'DM Serif Display', 'Playfair Display', 'Bowlby One SC', 'Rubik Glitch', 'Shrikhand', 'Oswald', 'Bangers', 'Lobster', 'Dancing Script', 'Teko', 'Black Ops One', 'Audiowide', 'Russo One', 'Archivo'];
  var fontState = {}, customFonts = {};
  function ensureFont(family, weight) {
    if (!family || customFonts[family]) return Promise.resolve();
    if (FONTS.indexOf(family) >= 0 && !fontState[family]) {
      fontState[family] = 'loading';
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@400;700;900&display=swap';
      l.onerror = function () { var l2 = document.createElement('link'); l2.rel = 'stylesheet'; l2.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + '&display=swap'; document.head.appendChild(l2); };
      document.head.appendChild(l);
      var l3 = document.createElement('link'); l3.rel = 'stylesheet'; l3.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + '&display=swap'; document.head.appendChild(l3);
    }
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return document.fonts.load((weight || 400) + ' 40px "' + family + '"').catch(function () { });
  }
  function addFontFace(family, data) {
    try { var ff = new FontFace(family, data); return ff.load().then(function (f) { document.fonts.add(f); customFonts[family] = 1; return family; }); }
    catch (e) { return Promise.reject(e); }
  }

  /* =========================================================
     COLOUR FILLS (solid / gradient / rainbow, optionally animated)
     f = { mode, c1, c2, c3, n, by, angle, anim:'none'|'flow'|'hue'|'pulse'|'spin', speed }
     ========================================================= */
  function fill(c1, c2, extra) { return Object.assign({ mode: c2 ? 'gradient' : 'solid', c1: c1, c2: c2 || c1, c3: '#ffffff', n: 2, by: 'pitch', angle: 90, anim: 'none', speed: 1 }, extra || {}); }
  function colorAt(f, u, t) {
    if (!f || typeof f === 'string') return f || '#ffffff';
    var sp = f.speed == null ? 1 : f.speed, c;
    if (f.mode === 'rainbow') { c = 'hsl(' + ((u * 300 + (f.anim === 'flow' || f.anim === 'hue' ? t * sp * 120 : 0)) % 360 + 360) % 360 + ',95%,62%)'; return c; }
    if (f.mode !== 'gradient') c = f.c1 || '#ffffff';
    else {
      var x = u; if (f.anim === 'flow') { x = frac(u + t * sp * 0.35); x = x < 0.5 ? x * 2 : 2 - x * 2; }
      var stops = (f.n || 2) >= 3 ? [f.c1, f.c2, f.c3] : [f.c1, f.c2], seg = (stops.length - 1) * clamp(x, 0, 1), i = Math.min(stops.length - 2, Math.floor(seg));
      c = mixColor(stops[i], stops[i + 1], seg - i);
    }
    if (f.anim === 'hue') c = hueShift(c, t * sp * 90);
    return c;
  }
  function paint(g, f, x, y, w, h, t) { // a canvas fill style for a whole box
    if (!f || typeof f === 'string') return f || '#ffffff';
    if (f.mode === 'solid' && f.anim !== 'hue' && f.anim !== 'pulse') return f.c1;
    var a = ((f.angle == null ? 90 : f.angle) + (f.anim === 'spin' ? t * (f.speed || 1) * 90 : 0)) * Math.PI / 180;
    var cx = x + w / 2, cy = y + h / 2, L = Math.abs(w * Math.sin(a)) / 2 + Math.abs(h * Math.cos(a)) / 2 + 1;
    var gr = g.createLinearGradient(cx - Math.sin(a) * L, cy + Math.cos(a) * L, cx + Math.sin(a) * L, cy - Math.cos(a) * L);
    for (var i = 0; i <= 8; i++) gr.addColorStop(i / 8, colorAt(f, i / 8, t));
    return gr;
  }
  function fillAlpha(f, t, P) { return f && f.anim === 'pulse' ? 0.55 + 0.45 * beatEnv(P, t) : 1; }

  /* =========================================================
     KEYFRAMES
     el.kf = { x:[{t,v,e}], y:[], scale:[], rot:[], opacity:[] }  (t = seconds from clip start)
     ========================================================= */
  var KF_PROPS = [['x', 'Position X'], ['y', 'Position Y'], ['scale', 'Scale'], ['rot', 'Rotation'], ['opacity', 'Opacity']];
  function kfValue(list, lt, base) {
    if (!list || !list.length) return base;
    if (list.length === 1 || lt <= list[0].t) return list[0].v;
    var last = list[list.length - 1]; if (lt >= last.t) return last.v;
    for (var i = 0; i < list.length - 1; i++) {
      var a = list[i], b = list[i + 1];
      if (lt >= a.t && lt < b.t) { var f = (lt - a.t) / Math.max(1e-6, b.t - a.t); return a.v + (b.v - a.v) * easeFn(a.e || 'smooth')(f); }
    }
    return last.v;
  }
  function prop(el, k, t) { var v = kfValue(el.kf && el.kf[k], t - el.start, el[k]); return v == null ? (k === 'scale' || k === 'opacity' ? 100 : 0) : v; }

  /* =========================================================
     ANIMATIONS  (in / out / loop — each with time, strength, easing)
     state: dx dy sx sy rot a blur wipe{d,v} glitch pix flash skew
     ========================================================= */
  var IN_ANIMS = [['none', 'None'], ['fade', 'Fade'], ['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'], ['pop', 'Pop'], ['elastic', 'Elastic'], ['drop', 'Drop bounce'], ['rise', 'Rise'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide left'], ['slide-right', 'Slide right'], ['spin', 'Spin'], ['spin-zoom', 'Spin zoom'], ['flip-x', 'Flip ↔'], ['flip-y', 'Flip ↕'], ['swing', 'Swing'], ['stretch', 'Stretch'], ['squash', 'Squash'], ['blur', 'Blur'], ['glitch', 'Glitch'], ['pixel', 'Pixelate'], ['flash', 'Flash'], ['shake', 'Shake'], ['wipe-left', 'Wipe ←'], ['wipe-right', 'Wipe →'], ['wipe-up', 'Wipe ↑'], ['wipe-down', 'Wipe ↓'], ['tilt', 'Tilt'], ['whip', 'Whip']];
  var LOOP_ANIMS = [['none', 'None'], ['beat-bounce', 'Bounce on beat'], ['beat-zoom', 'Zoom on beat'], ['beat-jump', 'Jump on beat'], ['beat-shake', 'Shake on beat'], ['beat-tilt', 'Tilt on beat'], ['beat-flash', 'Flash on beat'], ['pulse', 'Pulse'], ['heartbeat', 'Heartbeat'], ['breathe', 'Breathe'], ['float', 'Float'], ['orbit', 'Orbit'], ['sway', 'Sway'], ['swing', 'Swing'], ['wiggle', 'Wiggle'], ['jelly', 'Jelly'], ['spin', 'Spin'], ['shake', 'Shake'], ['flicker', 'Flicker'], ['blink', 'Blink']];
  function newState() { return { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, a: 1, blur: 0, wipe: null, glitch: 0, pix: 0, flash: 0, skew: 0 }; }
  function applyAnim(s, type, p, amt, W, id, t, out) {
    // p: 0 = fully hidden, 1 = fully shown (already eased)
    var q = 1 - p, D = W * 0.35 * amt;
    switch (type) {
      case 'fade': s.a *= p; break;
      case 'zoom-in': var z = lerp(1 - 0.7 * Math.min(1, amt), 1, p); s.sx *= z; s.sy *= z; s.a *= Math.min(1, p * 2); break;
      case 'zoom-out': var z2 = lerp(1 + 0.8 * amt, 1, p); s.sx *= z2; s.sy *= z2; s.a *= p; break;
      case 'pop': var k = EASE_FN.back(clamp(p, 0, 1)); k = lerp(1, k, Math.min(1, amt)); s.sx *= k; s.sy *= k; s.a *= Math.min(1, p * 3); break;
      case 'elastic': var ke = out ? p : EASE_FN.elastic(clamp(p, 0, 1)); s.sx *= ke; s.sy *= ke; s.a *= Math.min(1, p * 4); break;
      case 'drop': s.dy -= (1 - (out ? p : EASE_FN.bounce(clamp(p, 0, 1)))) * D * 1.6; s.a *= Math.min(1, p * 4); break;
      case 'rise': s.dy += q * D * 0.35; s.a *= p; break;
      case 'slide-up': s.dy += q * D; s.a *= Math.min(1, p * 1.5); break;
      case 'slide-down': s.dy -= q * D; s.a *= Math.min(1, p * 1.5); break;
      case 'slide-left': s.dx += q * D; s.a *= Math.min(1, p * 1.5); break;
      case 'slide-right': s.dx -= q * D; s.a *= Math.min(1, p * 1.5); break;
      case 'spin': s.rot += q * Math.PI * amt * (out ? 1 : -1); s.a *= p; break;
      case 'spin-zoom': s.rot += q * Math.PI * 2 * amt * (out ? 1 : -1); var ks = lerp(0.1, 1, p); s.sx *= ks; s.sy *= ks; s.a *= Math.min(1, p * 2); break;
      case 'flip-x': s.sx *= Math.cos(q * Math.PI / 2); s.a *= p > 0.02 ? 1 : 0; break;
      case 'flip-y': s.sy *= Math.cos(q * Math.PI / 2); s.a *= p > 0.02 ? 1 : 0; break;
      case 'swing': s.rot += Math.sin(p * Math.PI * 3) * q * 0.5 * amt; s.a *= Math.min(1, p * 3); break;
      case 'stretch': s.sx *= 1 + q * 0.8 * amt; s.sy *= 1 - q * 0.6 * Math.min(1, amt); s.a *= Math.min(1, p * 2); break;
      case 'squash': s.sy *= 1 + q * 0.8 * amt; s.sx *= 1 - q * 0.6 * Math.min(1, amt); s.a *= Math.min(1, p * 2); break;
      case 'blur': s.blur += q * 30 * amt; s.a *= p; break;
      case 'glitch': if (p < 1) { var r = rng(hash(id) + Math.floor(t * 30))(); s.dx += (r - 0.5) * 80 * amt * q; s.a *= r > 0.2 ? 1 : 0.3; s.glitch = Math.max(s.glitch, q * amt); } break;
      case 'pixel': s.pix = Math.max(s.pix, q * 60 * amt); s.a *= Math.min(1, p * 2); break;
      case 'flash': s.flash = Math.max(s.flash, q * amt); s.a *= Math.min(1, p * 3); break;
      case 'shake': var rs = rng(hash(id) + Math.floor(t * 30)); s.dx += (rs() - 0.5) * 70 * amt * q; s.dy += (rs() - 0.5) * 70 * amt * q; s.a *= Math.min(1, p * 3); break;
      case 'wipe-left': case 'wipe-right': case 'wipe-up': case 'wipe-down': s.wipe = { d: type.slice(5), v: Math.min(s.wipe ? s.wipe.v : 1, p) }; break;
      case 'tilt': s.rot += q * 0.6 * amt * (out ? 1 : -1); s.dy += q * D * 0.3; s.a *= p; break;
      case 'whip': s.dx += (out ? -1 : 1) * q * W * 1.2 * amt; s.blur += q * 25; s.sx *= 1 + q * 0.4; break;
    }
  }
  function applyLoop(s, L, el, P, t, W) {
    if (!L || !L.type || L.type === 'none') return;
    var amt = L.amt == null ? 1 : L.amt, spd = L.speed || 1, ev = L.every || 1, lt = t - el.start, be;
    switch (L.type) {
      case 'beat-bounce': be = beatEnv(P, t, ev); s.sx *= 1 + 0.12 * amt * be; s.sy *= 1 + 0.12 * amt * be; s.dy -= 18 * amt * be; break;
      case 'beat-zoom': be = beatEnv(P, t, ev, 5); s.sx *= 1 + 0.2 * amt * be; s.sy *= 1 + 0.2 * amt * be; break;
      case 'beat-jump': be = beatEnv(P, t, ev, 5); s.dy -= 60 * amt * Math.sin(be * Math.PI / 2); break;
      case 'beat-shake': be = beatEnv(P, t, ev); var rr2 = rng(hash(el.id) + Math.floor(beatPos(P, t)))(); s.dx += (rr2 - 0.5) * 50 * amt * be; s.rot += (rr2 - 0.5) * 0.14 * amt * be; break;
      case 'beat-tilt': s.rot += (Math.floor(beatPos(P, t) / ev) % 2 ? 1 : -1) * 0.07 * amt * (0.5 + 0.5 * beatEnv(P, t, ev)); break;
      case 'beat-flash': s.a *= 1 - 0.7 * Math.min(1, amt) * (1 - beatEnv(P, t, ev)); break;
      case 'pulse': var pu = 1 + 0.06 * amt * Math.sin(lt * TAU * spd); s.sx *= pu; s.sy *= pu; break;
      case 'heartbeat': var hb = frac(lt * spd * 0.9), hk = 1 + 0.1 * amt * (Math.exp(-40 * Math.pow(hb - 0.1, 2)) + 0.7 * Math.exp(-40 * Math.pow(hb - 0.3, 2))); s.sx *= hk; s.sy *= hk; break;
      case 'breathe': s.a *= 1 - 0.4 * Math.min(1, amt) * (0.5 + 0.5 * Math.sin(lt * TAU * 0.4 * spd)); break;
      case 'float': s.dy += Math.sin(lt * TAU * 0.4 * spd) * 18 * amt; break;
      case 'orbit': s.dx += Math.cos(lt * TAU * 0.4 * spd) * 20 * amt; s.dy += Math.sin(lt * TAU * 0.4 * spd) * 20 * amt; break;
      case 'sway': s.rot += Math.sin(lt * TAU * 0.35 * spd) * 0.12 * amt; s.dx += Math.sin(lt * TAU * 0.35 * spd) * 10 * amt; break;
      case 'swing': s.rot += Math.sin(lt * TAU * 0.8 * spd) * 0.25 * amt; break;
      case 'wiggle': s.rot += Math.sin(lt * TAU * 1.6 * spd) * 0.07 * amt; break;
      case 'jelly': var jj = Math.sin(lt * TAU * 1.2 * spd) * 0.07 * amt; s.sx *= 1 + jj; s.sy *= 1 - jj; break;
      case 'spin': s.rot += lt * TAU * 0.25 * spd * amt; break;
      case 'shake': var rs = rng(hash(el.id) + Math.floor(t * 24 * spd)); s.dx += (rs() - 0.5) * 16 * amt; s.dy += (rs() - 0.5) * 16 * amt; break;
      case 'flicker': s.a *= rng(hash(el.id) + Math.floor(t * 20 * spd))() > 0.15 * amt ? 1 : 0.25; break;
      case 'blink': s.a *= frac(lt * spd) < 0.5 ? 1 : Math.max(0, 1 - amt); break;
    }
  }
  function animState(el, t, P, W) {
    var s = newState(), A = el.anim || {}, lt = t - el.start, rem = el.end - t;
    var I = A.in || {}, O = A.out || {};
    if (I.type && I.type !== 'none' && lt < (I.dur || 0.5)) applyAnim(s, I.type, easeFn(I.ease || 'out')(clamp(lt / (I.dur || 0.5), 0, 1)), I.amt == null ? 1 : I.amt, W, el.id, t, false);
    if (O.type && O.type !== 'none' && rem < (O.dur || 0.4)) applyAnim(s, O.type, easeFn(O.ease || 'out')(clamp(rem / (O.dur || 0.4), 0, 1)), O.amt == null ? 1 : O.amt, W, el.id, t, true);
    applyLoop(s, A.loop, el, P, t, W);
    return s;
  }

  /* =========================================================
     DRAW HELPERS
     ========================================================= */
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2)); g.beginPath();
    if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function notch(g, x, y, w, h, c) { c = Math.min(c, w / 4, h / 4); g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath(); }
  function panelPath(g, st, x, y, w, h) { if (st.shape === 'notch') notch(g, x, y, w, h, st.radius || 14); else rr(g, x, y, w, h, st.radius || 0); }
  function shapePath(g, kind, x, y, w, h, r) {
    g.beginPath(); var cx = x + w / 2, cy = y + h / 2, i;
    switch (kind) {
      case 'circle': g.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, TAU); break;
      case 'triangle': g.moveTo(cx, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); break;
      case 'star': for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.42 : 1; g.lineTo(cx + Math.cos(a) * w / 2 * rad, cy + Math.sin(a) * h / 2 * rad); } g.closePath(); break;
      case 'sparkle': for (i = 0; i < 8; i++) { var a2 = -Math.PI / 2 + i * Math.PI / 4, r2 = i % 2 ? 0.16 : 1; g.lineTo(cx + Math.cos(a2) * w / 2 * r2, cy + Math.sin(a2) * h / 2 * r2); } g.closePath(); break;
      case 'heart': g.moveTo(cx, y + h * 0.95); g.bezierCurveTo(x - w * 0.05, y + h * 0.55, x + w * 0.05, y - h * 0.05, cx, y + h * 0.28); g.bezierCurveTo(x + w * 0.95, y - h * 0.05, x + w * 1.05, y + h * 0.55, cx, y + h * 0.95); break;
      case 'diamond': g.moveTo(cx, y); g.lineTo(x + w, cy); g.lineTo(cx, y + h); g.lineTo(x, cy); g.closePath(); break;
      case 'line': g.rect(x, cy - Math.max(2, h / 2) / 2, w, Math.max(2, h / 2)); break;
      case 'ring': g.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, TAU); g.ellipse(cx, cy, Math.abs(w) / 2 * 0.72, Math.abs(h) / 2 * 0.72, 0, TAU, 0, true); break;
      case 'arrow': g.moveTo(x, cy - h * 0.18); g.lineTo(x + w * 0.62, cy - h * 0.18); g.lineTo(x + w * 0.62, y); g.lineTo(x + w, cy); g.lineTo(x + w * 0.62, y + h); g.lineTo(x + w * 0.62, cy + h * 0.18); g.lineTo(x, cy + h * 0.18); g.closePath(); break;
      default: rr(g, x, y, w, h, r || 0);
    }
  }
  var HAS_FILTER = (function () { try { var c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch (e) { return false; } })();
  function softBlur(src, amount) {
    if (amount <= 0.5) return src;
    var out = mk(src.width, src.height), og = out.getContext('2d');
    if (HAS_FILTER) { og.filter = 'blur(' + amount + 'px)'; og.drawImage(src, 0, 0); og.filter = 'none'; return out; }
    var k = Math.max(1, amount / 2), s = mk(src.width / k, src.height / k), g = s.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, s.width, s.height);
    var s2 = mk(s.width / 2, s.height / 2); s2.getContext('2d').drawImage(s, 0, 0, s2.width, s2.height);
    og.imageSmoothingQuality = 'high'; og.drawImage(s2, 0, 0, out.width, out.height); og.globalAlpha = 0.5; og.drawImage(s, 0, 0, out.width, out.height);
    return out;
  }
  function drawMediaFit(g, img, x, y, w, h, fit, zoom, px, py) {
    var iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
    if (!iw || !ih) return;
    if (fit === 'stretch') { g.drawImage(img, x, y, w, h); return; }
    var k = fit === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih); zoom = zoom || 1;
    var dw = iw * k * zoom, dh = ih * k * zoom;
    try { g.drawImage(img, x + (w - dw) * (px == null ? 0.5 : px), y + (h - dh) * (py == null ? 0.5 : py), dw, dh); } catch (e) { }
  }
  // canvas pool for effect work
  var pool = [];
  function tmp(i, w, h) { var c = pool[i]; if (!c) c = pool[i] = mk(w, h); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } var g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.clearRect(0, 0, w, h); return c; }
  function copyTo(i, src) { var c = tmp(i, src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; }

  /* =========================================================
     EFFECTS  (drag onto a layer, or onto an adjustment layer)
     params: [key, label, min, max, step, default]  or [key,label,'color',def] / [key,label,'toggle',def] / [key,label,'select',def,options]
     apply(cv, p, env) changes canvas cv in place. env = { t, P, S, k (strength 0..1) }
     ========================================================= */
  function ctxOf(c) { return c.getContext('2d'); }
  function viaFilter(cv, f) { if (!HAS_FILTER) return; var s = copyTo(20, cv), g = ctxOf(cv); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.filter = f; g.drawImage(s, 0, 0); g.restore(); }
  function overlay(cv, style, blend, alpha) { var g = ctxOf(cv); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = blend || 'source-over'; g.globalAlpha = alpha; g.fillStyle = style; g.fillRect(0, 0, cv.width, cv.height); g.restore(); }
  function keepAlpha(cv, src) { var g = ctxOf(cv); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); g.restore(); }
  var grains = [];
  function grainTile(i) {
    if (grains[i]) return grains[i];
    var c = mk(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256), r = rng(i * 77 + 3);
    for (var k = 0; k < id.data.length; k += 4) { var v = r() * 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
    g.putImageData(id, 0, 0); return (grains[i] = c);
  }
  function rgbSplit(cv, off, ang) {
    if (off < 0.5) return;
    var W = cv.width, H = cv.height, src = copyTo(21, cv), dx = Math.cos(ang) * off, dy = Math.sin(ang) * off;
    var r = tmp(22, W, H), rg = ctxOf(r); rg.drawImage(src, 0, 0); rg.globalCompositeOperation = 'multiply'; rg.fillStyle = '#ff0000'; rg.fillRect(0, 0, W, H); rg.globalCompositeOperation = 'destination-in'; rg.drawImage(src, 0, 0);
    var gb = tmp(23, W, H), gg = ctxOf(gb); gg.drawImage(src, 0, 0); gg.globalCompositeOperation = 'multiply'; gg.fillStyle = '#00ffff'; gg.fillRect(0, 0, W, H); gg.globalCompositeOperation = 'destination-in'; gg.drawImage(src, 0, 0);
    var g = ctxOf(cv); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; g.drawImage(r, dx, dy); g.drawImage(gb, -dx, -dy); g.restore();
  }
  var FX = {
    blur: { name: 'Blur', cat: 'Basic', params: [['amount', 'Amount', 0, 60, 0.5, 8]], apply: function (cv, p, e) { var b = softBlur(copyTo(24, cv), p.amount * e.S * e.k); var g = ctxOf(cv); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(b, 0, 0); } },
    glow: { name: 'Glow', cat: 'Light', params: [['radius', 'Size', 1, 80, 1, 20], ['strength', 'Strength', 0, 200, 1, 80], ['tint', 'Tint', 'color', '#ffffff'], ['tintAmt', 'Tint amount', 0, 100, 1, 0]], apply: function (cv, p, e) {
      var b = softBlur(copyTo(24, cv), p.radius * e.S); if (p.tintAmt > 0) { var bg = ctxOf(b); bg.save(); bg.globalCompositeOperation = 'source-atop'; bg.globalAlpha = p.tintAmt / 100; bg.fillStyle = p.tint; bg.fillRect(0, 0, b.width, b.height); bg.restore(); }
      var g = ctxOf(cv); g.save(); g.globalCompositeOperation = 'lighter'; var s = p.strength / 100 * e.k; while (s > 0) { g.globalAlpha = Math.min(1, s); g.drawImage(b, 0, 0); s -= 1; } g.restore(); } },
    rgb: { name: 'RGB split', cat: 'Glitch', params: [['amount', 'Distance', 0, 60, 0.5, 10], ['angle', 'Angle', 0, 360, 1, 0]], apply: function (cv, p, e) { rgbSplit(cv, p.amount * e.S * e.k, p.angle * Math.PI / 180); } },
    glitch: { name: 'Glitch', cat: 'Glitch', params: [['amount', 'Amount', 0, 100, 1, 50], ['slices', 'Slices', 1, 30, 1, 8], ['speed', 'Speed', 1, 60, 1, 24], ['rgb', 'Colour split', 0, 40, 0.5, 6]], apply: function (cv, p, e) {
      var W = cv.width, H = cv.height, amt = p.amount / 100 * e.k; if (amt <= 0) return; var r = rng(Math.floor(e.t * p.speed) * 7 + 13), snap = copyTo(25, cv), g = ctxOf(cv);
      for (var i = 0; i < p.slices; i++) { if (r() > 0.4 + 0.6 * amt) continue; var y = r() * H, hh = (r() * 0.08 + 0.01) * H, dx = (r() - 0.5) * W * 0.2 * amt; g.clearRect(0, y, W, hh); g.drawImage(snap, 0, y, W, hh, dx, y, W, hh); }
      rgbSplit(cv, p.rgb * e.S * amt, 0); } },
    shake: { name: 'Shake', cat: 'Motion', params: [['amount', 'Amount', 0, 100, 1, 25], ['speed', 'Speed', 1, 60, 1, 20]], apply: function (cv, p, e) { var r = rng(Math.floor(e.t * p.speed) + 5), s = copyTo(25, cv), g = ctxOf(cv), a = p.amount * e.S * e.k; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(s, (r() - 0.5) * a * 2, (r() - 0.5) * a * 2); } },
    zoomblur: { name: 'Zoom blur', cat: 'Motion', params: [['amount', 'Amount', 0, 100, 1, 30]], apply: function (cv, p, e) { var s = copyTo(25, cv), g = ctxOf(cv), W = cv.width, H = cv.height, a = p.amount / 100 * 0.25 * e.k; if (a <= 0) return; g.save(); for (var i = 1; i <= 6; i++) { var k = 1 + a * i / 6; g.globalAlpha = 0.22; g.drawImage(s, W / 2 - W * k / 2, H / 2 - H * k / 2, W * k, H * k); } g.restore(); } },
    dirblur: { name: 'Motion blur', cat: 'Motion', params: [['length', 'Length', 0, 120, 1, 30], ['angle', 'Angle', 0, 360, 1, 0]], apply: function (cv, p, e) { var s = copyTo(25, cv), g = ctxOf(cv), L = p.length * e.S * e.k, a = p.angle * Math.PI / 180; if (L < 1) return; g.save(); g.clearRect(0, 0, cv.width, cv.height); for (var i = 0; i < 8; i++) { var f = i / 7 - 0.5; g.globalAlpha = 1 / (i + 1) + 0.05; g.drawImage(s, Math.cos(a) * L * f, Math.sin(a) * L * f); } g.restore(); } },
    pixelate: { name: 'Pixelate', cat: 'Stylize', params: [['size', 'Pixel size', 2, 80, 1, 12]], apply: function (cv, p, e) { var sz = Math.max(1, p.size * e.S * e.k); if (sz < 1.5) return; var W = cv.width, H = cv.height, sm = tmp(26, Math.max(1, W / sz), Math.max(1, H / sz)), sg = ctxOf(sm); sg.drawImage(cv, 0, 0, sm.width, sm.height); var g = ctxOf(cv); g.save(); g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false; g.drawImage(sm, 0, 0, W, H); g.restore(); } },
    mirror: { name: 'Mirror', cat: 'Stylize', params: [['mode', 'Mode', 'select', 'lr', [['lr', 'Left → right'], ['rl', 'Right → left'], ['tb', 'Top → bottom'], ['quad', '4 ways']]]], apply: function (cv, p) { var s = copyTo(25, cv), g = ctxOf(cv), W = cv.width, H = cv.height; g.save(); if (p.mode === 'lr' || p.mode === 'quad') { g.clearRect(W / 2, 0, W / 2, H); g.translate(W, 0); g.scale(-1, 1); g.drawImage(s, 0, 0, W / 2, H, 0, 0, W / 2, H); } else if (p.mode === 'rl') { g.clearRect(0, 0, W / 2, H); g.translate(W, 0); g.scale(-1, 1); g.drawImage(s, W / 2, 0, W / 2, H, W / 2, 0, W / 2, H); } g.restore(); if (p.mode === 'tb' || p.mode === 'quad') { var s2 = copyTo(25, cv); g.save(); g.clearRect(0, H / 2, W, H / 2); g.translate(0, H); g.scale(1, -1); g.drawImage(s2, 0, 0, W, H / 2, 0, 0, W, H / 2); g.restore(); } } },
    kaleido: { name: 'Kaleidoscope', cat: 'Stylize', params: [['slices', 'Slices', 3, 16, 1, 6], ['spin', 'Spin speed', -2, 2, 0.05, 0.2]], apply: function (cv, p, e) { var s = copyTo(25, cv), g = ctxOf(cv), W = cv.width, H = cv.height, n = Math.round(p.slices) * 2, ang = TAU / n, R = Math.sqrt(W * W + H * H) / 2; g.save(); g.clearRect(0, 0, W, H); for (var i = 0; i < n; i++) { g.save(); g.translate(W / 2, H / 2); g.rotate((i % 2 ? i + 1 : i) * ang + e.t * p.spin); if (i % 2) g.scale(1, -1); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -0.01, ang + 0.01); g.closePath(); g.clip(); g.drawImage(s, -W / 2, -H / 2); g.restore(); } g.restore(); } },
    wave: { name: 'Wave', cat: 'Motion', params: [['amp', 'Wave size', 0, 80, 1, 16], ['freq', 'Waves', 1, 30, 0.5, 6], ['speed', 'Speed', 0, 5, 0.05, 1]], apply: function (cv, p, e) { var s = copyTo(25, cv), g = ctxOf(cv), W = cv.width, H = cv.height, st = Math.max(2, Math.round(H / 240)); g.clearRect(0, 0, W, H); for (var y = 0; y < H; y += st) g.drawImage(s, 0, y, W, st, Math.sin(y / H * p.freq * TAU + e.t * p.speed * TAU) * p.amp * e.S * e.k, y, W, st); } },
    bw: { name: 'Black & white', cat: 'Colour', params: [['amount', 'Amount', 0, 100, 1, 100]], apply: function (cv, p, e) { viaFilter(cv, 'grayscale(' + p.amount * e.k + '%)'); } },
    sepia: { name: 'Sepia', cat: 'Colour', params: [['amount', 'Amount', 0, 100, 1, 80]], apply: function (cv, p, e) { viaFilter(cv, 'sepia(' + p.amount * e.k + '%)'); } },
    invert: { name: 'Invert', cat: 'Colour', params: [['amount', 'Amount', 0, 100, 1, 100]], apply: function (cv, p, e) { viaFilter(cv, 'invert(' + p.amount * e.k + '%)'); } },
    hue: { name: 'Hue shift', cat: 'Colour', params: [['deg', 'Shift', -180, 180, 1, 90], ['speed', 'Cycle speed', 0, 360, 1, 0]], apply: function (cv, p, e) { viaFilter(cv, 'hue-rotate(' + ((p.deg + e.t * p.speed) * e.k) + 'deg)'); } },
    adjust: { name: 'Colour adjust', cat: 'Colour', params: [['brightness', 'Brightness', 0, 200, 1, 100], ['contrast', 'Contrast', 0, 200, 1, 110], ['saturation', 'Saturation', 0, 300, 1, 120]], apply: function (cv, p, e) { var k = e.k; viaFilter(cv, 'brightness(' + lerp(100, p.brightness, k) + '%) contrast(' + lerp(100, p.contrast, k) + '%) saturate(' + lerp(100, p.saturation, k) + '%)'); } },
    tint: { name: 'Colour overlay', cat: 'Colour', params: [['color', 'Colour', 'color', '#ff3fc8'], ['amount', 'Amount', 0, 100, 1, 40], ['blend', 'Blend', 'select', 'color', [['color', 'Colour'], ['overlay', 'Overlay'], ['screen', 'Screen'], ['multiply', 'Multiply'], ['soft-light', 'Soft light'], ['hue', 'Hue']]]], apply: function (cv, p, e) { var s = copyTo(25, cv); overlay(cv, p.color, p.blend, p.amount / 100 * e.k); keepAlpha(cv, s); } },
    gradmap: { name: 'Gradient overlay', cat: 'Colour', params: [['c1', 'Colour 1', 'color', '#ff3fc8'], ['c2', 'Colour 2', 'color', '#38c8ff'], ['angle', 'Angle', 0, 360, 1, 45], ['speed', 'Move speed', 0, 3, 0.05, 0.5], ['amount', 'Amount', 0, 100, 1, 45], ['blend', 'Blend', 'select', 'overlay', [['overlay', 'Overlay'], ['color', 'Colour'], ['screen', 'Screen'], ['soft-light', 'Soft light'], ['multiply', 'Multiply']]]], apply: function (cv, p, e) { var s = copyTo(25, cv), g = ctxOf(cv); overlay(cv, paint(g, fill(p.c1, p.c2, { anim: p.speed > 0 ? 'flow' : 'none', speed: p.speed, angle: p.angle }), 0, 0, cv.width, cv.height, e.t), p.blend, p.amount / 100 * e.k); keepAlpha(cv, s); } },
    vignette: { name: 'Vignette', cat: 'Film', params: [['amount', 'Darkness', 0, 100, 1, 50], ['size', 'Size', 10, 100, 1, 55]], apply: function (cv, p, e) { var g = ctxOf(cv), W = cv.width, H = cv.height, vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * p.size / 200, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + p.amount / 100 * e.k + ')'); g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.restore(); } },
    grain: { name: 'Film grain', cat: 'Film', params: [['amount', 'Amount', 0, 100, 1, 35]], apply: function (cv, p, e) { var g = ctxOf(cv); g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = p.amount / 130 * e.k; g.fillStyle = g.createPattern(grainTile(Math.floor(e.t * 24) % 6), 'repeat'); g.fillRect(0, 0, cv.width, cv.height); g.restore(); } },
    scanlines: { name: 'Scanlines', cat: 'Film', params: [['amount', 'Darkness', 0, 100, 1, 35], ['gap', 'Gap', 2, 16, 1, 4]], apply: function (cv, p, e) { var g = ctxOf(cv); g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(0,0,0,' + p.amount / 100 * e.k + ')'; for (var y = 0; y < cv.height; y += p.gap * e.S) g.fillRect(0, y, cv.width, Math.max(1, p.gap * e.S / 2.5)); g.restore(); } },
    vhs: { name: 'VHS', cat: 'Film', params: [['amount', 'Amount', 0, 100, 1, 60]], apply: function (cv, p, e) { var a = p.amount / 100 * e.k; FX.wave.apply(cv, { amp: 4, freq: 3, speed: 2 }, { t: e.t, S: e.S, k: a }); rgbSplit(cv, 5 * e.S * a, 0); FX.scanlines.apply(cv, { amount: 30, gap: 4 }, { t: e.t, S: e.S, k: a }); FX.grain.apply(cv, { amount: 40 }, { t: e.t, S: e.S, k: a }); FX.adjust.apply(cv, { brightness: 105, contrast: 90, saturation: 140 }, { t: e.t, S: e.S, k: a }); } },
    lightleak: { name: 'Light leak', cat: 'Light', params: [['color', 'Colour', 'color', '#ff7a3c'], ['color2', 'Colour 2', 'color', '#ff3fc8'], ['amount', 'Amount', 0, 100, 1, 60], ['speed', 'Speed', 0, 3, 0.05, 0.6]], apply: function (cv, p, e) { var g = ctxOf(cv), W = cv.width, H = cv.height, a = p.amount / 100 * e.k; g.save(); g.globalCompositeOperation = 'screen'; [[p.color, 0], [p.color2, 2.1]].forEach(function (c) { var x = W * (0.5 + 0.55 * Math.sin(e.t * p.speed + c[1])), y = H * (0.5 + 0.5 * Math.cos(e.t * p.speed * 0.7 + c[1])), r = Math.max(W, H) * 0.6, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c[0], a)); gr.addColorStop(1, rgba(c[0], 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }); g.restore(); } },
    strobe: { name: 'Strobe', cat: 'Light', params: [['color', 'Colour', 'color', '#ffffff'], ['amount', 'Amount', 0, 100, 1, 70], ['every', 'Every … beats', 0.25, 4, 0.25, 1]], apply: function (cv, p, e) { overlay(cv, p.color, 'source-atop', p.amount / 100 * beatEnv(e.P, e.t, p.every, 12) * e.k); } },
    outline: { name: 'Outline', cat: 'Stylize', params: [['width', 'Width', 1, 40, 0.5, 6], ['color', 'Colour', 'color', '#ffffff']], apply: function (cv, p, e) { var s = copyTo(25, cv), W = cv.width, H = cv.height, sil = tmp(26, W, H), sg = ctxOf(sil), w = p.width * e.S * e.k; sg.drawImage(s, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = p.color; sg.fillRect(0, 0, W, H); var g = ctxOf(cv); g.save(); g.clearRect(0, 0, W, H); for (var i = 0; i < 16; i++) { var a = i / 16 * TAU; g.drawImage(sil, Math.cos(a) * w, Math.sin(a) * w); } g.drawImage(s, 0, 0); g.restore(); } },
    shadow: { name: 'Drop shadow', cat: 'Stylize', params: [['x', 'Shadow ↔', -80, 80, 1, 12], ['y', 'Shadow ↕', -80, 80, 1, 12], ['blur', 'Blur', 0, 80, 1, 10], ['color', 'Colour', 'color', '#000000'], ['opacity', 'Opacity', 0, 100, 1, 60]], apply: function (cv, p, e) { var s = copyTo(25, cv), g = ctxOf(cv); g.save(); g.clearRect(0, 0, cv.width, cv.height); g.shadowColor = rgba(p.color, p.opacity / 100 * e.k); g.shadowBlur = p.blur * e.S; g.shadowOffsetX = p.x * e.S; g.shadowOffsetY = p.y * e.S; g.drawImage(s, 0, 0); g.restore(); } },
    letterbox: { name: 'Letterbox bars', cat: 'Film', params: [['size', 'Bar size %', 0, 40, 0.5, 10], ['color', 'Colour', 'color', '#000000']], apply: function (cv, p, e) { var g = ctxOf(cv), h = cv.height * p.size / 100 * e.k; g.save(); g.fillStyle = p.color; g.fillRect(0, 0, cv.width, h); g.fillRect(0, cv.height - h, cv.width, h); g.restore(); } },
    zoompulse: { name: 'Zoom pulse (beat)', cat: 'Motion', params: [['amount', 'Amount', 0, 50, 0.5, 8], ['every', 'Every … beats', 0.25, 4, 0.25, 1]], apply: function (cv, p, e) { var k = 1 + p.amount / 100 * beatEnv(e.P, e.t, p.every, 6) * e.k; if (k === 1) return; var s = copyTo(25, cv), g = ctxOf(cv), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H); g.drawImage(s, W / 2 - W * k / 2, H / 2 - H * k / 2, W * k, H * k); } }
  };
  var FX_CATS = ['Basic', 'Colour', 'Light', 'Glitch', 'Motion', 'Stylize', 'Film'];
  function fxDefaults(type) { var p = {}; (FX[type] ? FX[type].params : []).forEach(function (q) { p[q[0]] = q[2] === 'color' || q[2] === 'toggle' || q[2] === 'select' ? q[3] : q[5]; }); return p; }
  function runFx(cv, list, env) {
    (list || []).forEach(function (f) {
      var d = FX[f.type]; if (!d || f.on === false) return;
      var k = (f.mix == null ? 100 : f.mix) / 100; if (f.beat) k *= beatEnv(env.P, env.t, f.every || 1, 6);
      if (k <= 0.001) return;
      try { d.apply(cv, Object.assign(fxDefaults(f.type), f.p || {}), { t: env.t, P: env.P, S: env.S, k: k }); } catch (e) { console.warn('effect failed', f.type, e); }
    });
  }

  /* =========================================================
     CLIP TIMING: trim, speed and speed curves (video + audio)
     ========================================================= */
  var SPEED_PRESETS = [
    ['normal', 'Normal', null], ['montage', 'Montage', [[0, 1], [0.2, 1], [0.32, 4], [0.45, 4], [0.55, 0.35], [0.8, 0.35], [1, 1]]],
    ['hero', 'Hero', [[0, 1.6], [0.3, 1.6], [0.45, 0.2], [0.6, 0.2], [0.75, 1.6], [1, 1.6]]], ['bullet', 'Bullet', [[0, 3], [0.35, 3], [0.5, 0.15], [0.65, 3], [1, 3]]],
    ['jump', 'Jump cut', [[0, 1], [0.25, 1], [0.3, 6], [0.4, 6], [0.45, 1], [0.7, 1], [0.75, 6], [0.85, 6], [0.9, 1], [1, 1]]], ['flashin', 'Flash in', [[0, 6], [0.3, 6], [0.5, 1], [1, 1]]],
    ['flashout', 'Flash out', [[0, 1], [0.5, 1], [0.7, 6], [1, 6]]], ['slowin', 'Slow → fast', [[0, 0.3], [1, 3]]], ['fastin', 'Fast → slow', [[0, 3], [1, 0.3]]], ['smooth', 'Smooth slow-mo', [[0, 1], [0.35, 0.4], [0.65, 0.4], [1, 1]]]
  ];
  function speedAt(el, u) {
    var c = el.curve; if (!c || c.length < 2) return el.speed || 1;
    if (u <= c[0][0]) return c[0][1]; if (u >= c[c.length - 1][0]) return c[c.length - 1][1];
    for (var i = 0; i < c.length - 1; i++) if (u >= c[i][0] && u <= c[i + 1][0]) { var f = (u - c[i][0]) / Math.max(1e-6, c[i + 1][0] - c[i][0]); f = f * f * (3 - 2 * f); return c[i][1] + (c[i + 1][1] - c[i][1]) * f; }
    return 1;
  }
  var integCache = {};
  function integ(el) { // ∫0..1 speed(u) du as a table (64 steps)
    var key = JSON.stringify(el.curve || el.speed || 1); if (integCache[key]) return integCache[key];
    var N = 64, tab = new Float32Array(N + 1); for (var i = 1; i <= N; i++) tab[i] = tab[i - 1] + (speedAt(el, (i - 0.5) / N)) / N;
    if (Object.keys(integCache).length > 300) integCache = {};
    return (integCache[key] = tab);
  }
  function avgSpeed(el) { return el.curve && el.curve.length > 1 ? integ(el)[64] : (el.speed || 1); }
  function srcTime(el, t) { // source seconds for timeline time t
    var L = Math.max(1e-6, el.end - el.start), u = clamp((t - el.start) / L, 0, 1), src = el.srcDur || L * avgSpeed(el);
    if (!(el.curve && el.curve.length > 1)) return (el.in || 0) + u * src;
    var tab = integ(el), x = u * 64, i = Math.min(63, Math.floor(x)), v = tab[i] + (tab[i + 1] - tab[i]) * (x - i);
    return (el.in || 0) + src * v / Math.max(1e-6, tab[64]);
  }
  function setLengthFromSpeed(el) { if (el.srcDur) el.end = el.start + el.srcDur / Math.max(0.01, avgSpeed(el)); }

  /* ---------- audio mixing (song clips + video clip sound) ---------- */
  // sources: [{buffer, start (timeline s), in (src s), dur (src s), rate, vol (0..2), fadeIn, fadeOut}]
  function audioSources(P, buffers) {
    var out = [];
    (P.audio || []).forEach(function (c) { if (c.muted) return; var b = buffers[c.media]; if (!b) return; out.push({ buffer: b, start: c.start, in: c.in || 0, dur: c.dur, rate: c.speed || 1, vol: (c.vol == null ? 100 : c.vol) / 100, fadeIn: c.fadeIn || 0, fadeOut: c.fadeOut || 0 }); });
    (P.layers || []).forEach(function (l) {
      if (l.type !== 'video' || l.hidden || !l.media || !(l.vol > 0) || (l.curve && l.curve.length > 1)) return;
      var b = buffers[l.media]; if (!b) return;
      var src = l.srcDur || (l.end - l.start) * (l.speed || 1);
      out.push({ buffer: b, start: l.start, in: l.in || 0, dur: src, rate: l.speed || 1, vol: l.vol / 100, fadeIn: l.fadeIn || 0, fadeOut: l.fadeOut || 0, loop: false });
    });
    return out;
  }
  // schedule into any AudioContext. from = timeline time to start at; at = context time that equals `from`
  function scheduleAudio(ctx, dest, sources, from, at, until) {
    var nodes = [];
    sources.forEach(function (s) {
      var len = s.dur / s.rate, a = s.start, b = s.start + len;
      if (b <= from || (until != null && a >= until)) return;
      var off = Math.max(0, from - a), when = at + Math.max(0, a - from);
      var srcOff = s.in + off * s.rate, srcLeft = s.dur - off * s.rate; if (srcLeft <= 0.001 || srcOff >= s.buffer.duration) return;
      var n = ctx.createBufferSource(), g = ctx.createGain(); n.buffer = s.buffer; n.playbackRate.value = s.rate;
      n.connect(g); g.connect(dest);
      // volume + fades, written as automation in context time
      var t0 = at - from; // context time of timeline 0
      g.gain.setValueAtTime(s.vol, ctx.currentTime);
      if (s.fadeIn > 0) { var fi0 = t0 + a, fi1 = t0 + a + s.fadeIn; if (fi1 > at) { g.gain.setValueAtTime(s.vol * clamp((from - a) / s.fadeIn, 0, 1), Math.max(ctx.currentTime, when)); g.gain.linearRampToValueAtTime(s.vol, fi1); } }
      if (s.fadeOut > 0) { var fo0 = t0 + b - s.fadeOut, fo1 = t0 + b; if (fo1 > at) { var startV = from > b - s.fadeOut ? s.vol * clamp((b - from) / s.fadeOut, 0, 1) : s.vol; g.gain.setValueAtTime(startV, Math.max(when, fo0, ctx.currentTime)); g.gain.linearRampToValueAtTime(0, fo1); } }
      try { n.start(Math.max(when, ctx.currentTime), srcOff, srcLeft); } catch (e) { n.start(Math.max(when, ctx.currentTime), srcOff); }
      nodes.push(n);
    });
    return nodes;
  }
  function renderMix(P, buffers, sr) {
    sr = sr || 48000;
    var len = Math.max(1, Math.ceil(P.duration * sr)), OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var ctx = new OAC(2, len, sr), src = audioSources(P, buffers);
    if (!src.length) return Promise.resolve(null);
    scheduleAudio(ctx, ctx.destination, src, 0, 0);
    return ctx.startRendering();
  }

  /* =========================================================
     ELEMENT TYPES
     ========================================================= */
  var T = {};
  var F = fill; // shorthand for defaults
  T.text = {
    label: 'Text', icon: 'T',
    defaults: { text: 'YOUR TEXT', font: 'Anton', weight: 400, size: 120, fillc: F('#ffffff'), stroke: 0, strokeColor: '#ff3fc8', align: 'center', letter: 0, lineH: 1.05, caps: true, italic: false, accentColor: '#ff3fc8', accentFont: 'UnifrakturMaguntia', accentGlow: 18, boxColor: '#000000', boxOpacity: 0, boxPad: 20, boxRadius: 16, reveal: 'none', revealDur: 1.2, autoFit: true, textShadow: 0, textShadowColor: '#000000' },
    render: function (g, el, w, h, R, S) {
      var lines = String(el.text == null ? '' : el.text).split('\n');
      if (el.caps) lines = lines.map(function (l) { return l.toUpperCase(); });
      var tokens = [], wi = 0;
      lines.forEach(function (ln, li) {
        ln.split(/(\*[^*]+\*)/).filter(function (x) { return x !== ''; }).forEach(function (pt) {
          var acc = /^\*[^*]+\*$/.test(pt), txt = acc ? pt.slice(1, -1) : pt;
          txt.split(/(\s+)/).forEach(function (wd) { if (wd === '') return; var sp = /^\s+$/.test(wd); tokens.push({ s: wd, acc: acc, line: li, sp: sp, i: sp ? -1 : wi++ }); });
        });
      });
      var total = wi, chars = 0; tokens.forEach(function (tk) { if (!tk.sp) chars += tk.s.length; });
      var lt = R.t - el.start, shownW = total, shownC = chars;
      if (el.reveal === 'beat') shownW = Math.floor(beatPos(R.P, R.t) - beatPos(R.P, el.start)) + 1;
      else if (el.reveal === 'word' || el.reveal === 'char') { var fr = clamp(lt / Math.max(0.05, el.revealDur || 1), 0, 1); shownW = Math.ceil(fr * total); shownC = Math.floor(fr * chars); }
      var size = el.size || 100;
      function fontOf(acc) { return (el.italic ? 'italic ' : '') + (acc ? 400 : el.weight || 400) + ' ' + size + 'px "' + (acc ? el.accentFont : el.font) + '", Impact, sans-serif'; }
      g.textBaseline = 'alphabetic';
      if (g.letterSpacing !== undefined) g.letterSpacing = (el.letter || 0) * S + 'px';
      function measure() { var ws = lines.map(function () { return 0; }); tokens.forEach(function (tk) { g.font = fontOf(tk.acc); tk.w = g.measureText(tk.s).width; ws[tk.line] += tk.w; }); return ws; }
      var widths = measure(), maxW = Math.max.apply(null, widths.concat([1])), lh = size * (el.lineH || 1.05), totalH = lh * lines.length;
      if (el.autoFit !== false && (maxW > w || totalH > h * 1.02)) { var k = Math.min(w / maxW, h / totalH); size = Math.max(4, size * k * 0.98); widths = measure(); maxW = Math.max.apply(null, widths); lh = size * (el.lineH || 1.05); totalH = lh * lines.length; }
      var y0 = (h - totalH) / 2 + size * 0.86;
      if (el.boxOpacity > 0) {
        g.save(); g.globalAlpha *= el.boxOpacity; g.fillStyle = el.boxColor; var pad = el.boxPad * S;
        var bw = maxW + pad * 2, bx = el.align === 'left' ? -pad : el.align === 'right' ? w - maxW - pad : (w - bw) / 2;
        rr(g, bx, (h - totalH) / 2 - pad * 0.6, bw, totalH + pad * 1.2, el.boxRadius * S); g.fill(); g.restore();
      }
      var fillStyle = paint(g, el.fillc || el.color || '#fff', 0, (h - totalH) / 2, w, totalH, R.t);
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
        if (el.reveal === 'word' || el.reveal === 'beat') { var wt = el.reveal === 'beat' ? (beatPos(R.P, R.t) - beatPos(R.P, el.start)) - tk.i : (lt / Math.max(0.05, el.revealDur || 1)) * total - tk.i; if (wt < 1) pop = EASE_FN.back(clamp(wt * 1.6, 0, 1)); }
        g.save();
        if (pop !== 1) { g.translate(x + tk.w / 2, y - size * 0.35); g.scale(pop, pop); g.translate(-(x + tk.w / 2), -(y - size * 0.35)); }
        if (el.textShadow > 0) { g.shadowColor = el.textShadowColor; g.shadowBlur = el.textShadow * S; g.shadowOffsetY = el.textShadow * S * 0.3; }
        if (tk.acc && el.accentGlow > 0) { g.shadowColor = el.accentColor; g.shadowBlur = el.accentGlow * S; }
        if (el.stroke > 0) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = el.stroke * 2 * S; g.strokeStyle = tk.acc ? '#ffffff' : el.strokeColor; g.strokeText(vis, x, y); g.shadowBlur = 0; g.shadowOffsetY = 0; }
        g.fillStyle = tk.acc ? el.accentColor : fillStyle;
        g.fillText(vis, x, y);
        g.restore();
      });
      if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
    }
  };
  function drawPlaceholder(g, el, w, h, S, label) {
    g.fillStyle = 'rgba(255,63,200,.10)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,63,200,.85)'; g.setLineDash([16 * S, 10 * S]); g.lineWidth = 4 * S; g.strokeRect(2, 2, w - 4, h - 4); g.setLineDash([]);
    var ph = label, fs = Math.min(w, h) / 9; g.font = '700 ' + fs + 'px "Space Grotesk", sans-serif'; var mw = g.measureText(ph).width; if (mw > w * 0.9) fs *= w * 0.9 / mw;
    g.fillStyle = '#ff3fc8'; g.font = '700 ' + fs + 'px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ph, w / 2, h / 2); g.textAlign = 'left';
  }
  T.image = {
    label: 'Picture', icon: '🖼',
    defaults: { media: '', src: '', fit: 'cover', zoom: 1, posX: 0.5, posY: 0.5, radius: 0, border: 0, borderColor: '#ffffff', kenBurns: 0, placeholder: 'DROP A PICTURE HERE' },
    render: function (g, el, w, h, R, S) {
      var img = R.media(el.media, el.src, el);
      g.save(); rr(g, 0, 0, w, h, el.radius * S); g.clip();
      if (img) { var z = (el.zoom || 1) * (1 + (el.kenBurns || 0) * 0.08 * ((R.t - el.start) / Math.max(1, el.end - el.start))); drawMediaFit(g, img, 0, 0, w, h, el.fit, z, el.posX, el.posY); }
      else if (R.edit) drawPlaceholder(g, el, w, h, S, el.placeholder || (el.type === 'video' ? 'DROP A VIDEO HERE' : 'DROP A PICTURE HERE'));
      g.restore();
      if (el.border > 0) { g.save(); rr(g, 0, 0, w, h, el.radius * S); g.clip(); g.lineWidth = el.border * 2 * S; g.strokeStyle = el.borderColor; g.stroke(); g.restore(); }
    }
  };
  T.video = {
    label: 'Video', icon: '🎞',
    defaults: { media: '', fit: 'cover', zoom: 1, posX: 0.5, posY: 0.5, radius: 0, border: 0, borderColor: '#ffffff', in: 0, srcDur: 0, speed: 1, curve: null, vol: 100, fadeIn: 0, fadeOut: 0, kenBurns: 0, placeholder: 'DROP A VIDEO HERE' },
    render: function (g, el, w, h, R, S) { T.image.render(g, el, w, h, R, S); }
  };
  T.shape = {
    label: 'Shape', icon: '◆',
    defaults: { kind: 'rect', fillc: F('#ff3fc8'), stroke: 0, strokeColor: '#ffffff', radius: 20, reactLevel: 0 },
    render: function (g, el, w, h, R, S) {
      var k = 1 + (el.reactLevel || 0) * (R.an ? R.an.level(R.t) : beatEnv(R.P, R.t)) * 0.4;
      if (k !== 1) { g.translate(w / 2, h / 2); g.scale(k, k); g.translate(-w / 2, -h / 2); }
      shapePath(g, el.kind, 0, 0, w, h, el.radius * S);
      g.globalAlpha *= fillAlpha(el.fillc, R.t, R.P); g.fillStyle = paint(g, el.fillc || el.fill || '#ff3fc8', 0, 0, w, h, R.t); g.fill('evenodd');
      if (el.stroke > 0) { g.lineWidth = el.stroke * 2 * S; g.strokeStyle = el.strokeColor; g.lineJoin = 'round'; g.stroke(); }
    }
  };
  T.adjust = {
    label: 'Adjustment layer', icon: '◐',
    defaults: {},
    render: function () { }
  };
  function chrome(g, el, w, h, S, title, t) {
    if (el.panel === false) return 0;
    var bar = el.titleBar ? Math.max(18 * S, h * 0.08) : 0, ba = el.bgOpacity == null ? 1 : el.bgOpacity / 100;
    if (el.offsetShadow && ba > 0) { g.save(); g.globalAlpha *= ba; g.translate(el.offsetShadow * S, el.offsetShadow * S); panelPath(g, scaled(el, S), 0, 0, w, h); g.fillStyle = el.shadowTint || '#ff1f78'; g.fill(); g.restore(); }
    panelPath(g, scaled(el, S), 0, 0, w, h);
    if (ba > 0) { g.save(); g.globalAlpha *= ba; g.fillStyle = paint(g, el.bg, 0, 0, w, h, t || 0); g.fill(); g.restore(); }
    if (el.frame > 0) { g.lineWidth = el.frame * S; g.strokeStyle = el.frameColor; g.stroke(); }
    if (bar) { g.save(); panelPath(g, scaled(el, S), 0, 0, w, h); g.clip(); g.fillStyle = el.barColor || el.frameColor; g.fillRect(0, 0, w, bar); g.fillStyle = el.barText || '#ffffff'; g.font = '700 ' + bar * 0.55 + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'middle'; g.fillText(String(title || el.label || '').toUpperCase(), bar * 0.5, bar / 2); g.restore(); }
    return bar;
  }
  function scaled(el, S) { return { shape: el.shape, radius: (el.radius || 0) * S }; }
  var PANEL_DEF = { panel: true, bgOpacity: 100, bg: '#141018', frame: 3, frameColor: '#2a2230', shape: 'notch', radius: 16, titleBar: true, barColor: '#1d1724', barText: '#ffffff', label: 'MELODY', offsetShadow: 10, shadowTint: '#ff1f78' };
  function noteU(f, n, lo, hi, x01) { var by = f && f.by; return by === 'velocity' ? n.v : by === 'time' || by === 'x' ? x01 : by === 'track' ? (n.tr % 4) / 3 : hi > lo ? (n.p - lo) / (hi - lo) : 0.5; }
  function autoRange(notes, el) {
    var lo = el.lowNote, hi = el.highNote;
    if (lo && hi && hi > lo) return [lo, hi];
    lo = 127; hi = 0; notes.forEach(function (n) { if (n.p < lo) lo = n.p; if (n.p > hi) hi = n.p; });
    if (lo > hi) { lo = 48; hi = 72; }
    var pad = el.padNotes == null ? 2 : el.padNotes; return [Math.max(0, lo - pad), Math.min(127, hi + pad)];
  }
  // where the music is (pitch), smoothed over time — the same answer for the same moment, so exports match the preview
  function pitchCenter(notes, t, sig, ahead) {
    var c = t + (ahead || 0), sw = 0, sp = 0, lo3 = c - sig * 4, hi3 = c + sig * 4;
    for (var i = 0; i < notes.length; i++) { var n = notes[i]; if (n.t > hi3) break; if (n.e < lo3) continue; var m = (Math.max(n.t, lo3) + Math.min(n.e, hi3)) / 2, d = (m - c) / sig, wgt = Math.exp(-0.5 * d * d) * (0.3 + n.v); sw += wgt; sp += wgt * n.p; }
    if (sw > 1e-4) return sp / sw;
    // nothing near: use the nearest note before/after
    var best = null, bd = 1e9; for (i = 0; i < notes.length; i++) { var dd = Math.min(Math.abs(notes[i].t - c), Math.abs(notes[i].e - c)); if (dd < bd) { bd = dd; best = notes[i]; } }
    return best ? best.p : 60;
  }
  T.pianoroll = {
    label: 'Piano roll', icon: '🎹', midi: true,
    defaults: Object.assign({}, PANEL_DEF, { midi: 'all', track: -1, channel: -1, mode: 'page', beats: 8, noteFill: F('#ffb3d1', '#ff2a7a', { by: 'velocity' }), activeColor: '#ffffff', gridColor: '#2b2533', barLineColor: '#3d3446', playhead: '#ff7ab8', keys: true, keyWidth: 7, noteRadius: 2, noteGlow: 10, noteHeight: 84, bpmLabel: true, lowNote: 0, highNote: 0, padNotes: 2, labelColor: '#c9bfd6', playheadPos: 35, noteStroke: 0, noteStrokeColor: '#000000', activeStroke: '', showGrid: true, showRows: false, showNums: true, showPlayhead: true, futureAlpha: 90, followPitch: true, followRows: 18, followSmooth: 0.8 }),
    render: function (g, el, w, h, R, S) {
      var bar = chrome(g, el, w, h, S, el.label, R.t), pad = el.panel === false ? 0 : 8 * S, kx = el.keys ? w * el.keyWidth / 100 : 0, top = el.panel !== false && (el.showNums !== false || el.bpmLabel) ? h * 0.05 : 0;
      var x0 = pad + kx, y0 = bar + pad + top, iw = w - x0 - pad, ih = h - y0 - pad;
      var notes = filterNotes(R.notes, el), rg = autoRange(notes, el), lo = rg[0], hi = rg[1], rows = hi - lo + 1, rh;
      var spb = 60 / (R.P.bpm || 120), win = (el.beats || 8) * spb, t = R.t, ws, playX, off = R.P.beatOffset || 0;
      if (el.mode === 'follow' && el.followPitch !== false && notes.length) {
        // the view glides up/down to follow the melody
        rows = clamp(el.followRows || 18, 4, 88);
        var cp = pitchCenter(notes, t, Math.max(0.1, el.followSmooth || 0.8), win * 0.15);
        cp = clamp(cp, rg[0] + rows / 2 - 0.5, Math.max(rg[0] + rows / 2 - 0.5, rg[1] - rows / 2 + 0.5));
        lo = cp - rows / 2 + 0.5; hi = lo + rows - 1;
      }
      rh = ih / rows;
      if (el.mode === 'scroll') { ws = t - win * el.playheadPos / 100; playX = x0 + iw * el.playheadPos / 100; }
      else if (el.mode === 'follow') {
        // the playhead walks in, then the notes slide along with it
        var lead = win * el.playheadPos / 100, st = Math.min(off, 0);
        ws = Math.max(st, t - lead); playX = x0 + (t - ws) / win * iw;
      }
      else { var page = Math.floor(beatPos(R.P, t) / (el.beats || 8)); ws = off + page * win; playX = x0 + (t - ws) / win * iw; }
      g.font = '600 ' + Math.max(9 * S, h * 0.035) + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'alphabetic';
      for (var b = Math.ceil((ws - off) / spb); (off + b * spb) <= ws + win; b++) {
        var bx = x0 + ((off + b * spb) - ws) / win * iw, isBar = b % 4 === 0;
        if (el.showGrid !== false) { g.fillStyle = isBar ? el.barLineColor : el.gridColor; g.fillRect(bx, y0, Math.max(1, (isBar ? 2 : 1) * S), ih); }
        if (isBar && el.panel !== false && el.showNums !== false) { g.fillStyle = el.labelColor; g.fillText(String(b / 4 + 1), bx + 3 * S, y0 - 4 * S); }
      }
      var pLo = Math.floor(lo), pHi = Math.ceil(hi);
      g.save(); g.beginPath(); g.rect(0, y0, w, ih); g.clip();
      if (el.showRows && el.showGrid !== false) { g.fillStyle = el.gridColor; for (var rw = pLo; rw <= pHi; rw++) if (isBlack(rw)) g.fillRect(x0, y0 + (hi - rw) * rh, iw, rh); }
      if (el.keys) for (var p = pLo; p <= pHi; p++) {
        var ky = y0 + (hi - p) * rh, act = false; for (var q = 0; q < notes.length; q++) { var nn = notes[q]; if (nn.t > t) break; if (nn.p === p && nn.e > t) { act = true; break; } }
        g.fillStyle = act ? colorAt(el.noteFill, (p - lo) / Math.max(1, rows), t) : isBlack(p) ? '#1b1b1f' : '#f2eef6'; g.fillRect(pad, ky + 0.5, kx - 2 * S, Math.max(1, rh - 1));
      }
      g.restore();
      if (el.bpmLabel && el.panel !== false) { g.textAlign = 'right'; g.fillStyle = el.labelColor; g.fillText(Math.round(R.P.bpm) + ' BPM', x0 + iw, y0 - 4 * S); g.textAlign = 'left'; }
      g.save(); g.beginPath(); g.rect(x0, y0, iw, ih); g.clip();
      var nh = clamp((el.noteHeight == null ? 84 : el.noteHeight) / 100, 0.1, 1);
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i]; if (n.t > ws + win) break; if (n.e < ws) continue;
        var nx = x0 + (n.t - ws) / win * iw, nw = Math.max(3 * S, (n.e - n.t) / win * iw - 2 * S), ny = y0 + (hi - n.p) * rh;
        var on = n.t <= t && n.e > t, c = colorAt(el.noteFill, noteU(el.noteFill, n, lo, hi, (nx - x0) / iw), t);
        if (on) { g.shadowColor = c; g.shadowBlur = el.noteGlow * S; c = el.activeColor || c; }
        g.fillStyle = c; var ga = g.globalAlpha; g.globalAlpha = ga * (el.mode !== 'scroll' && n.t > t ? (el.futureAlpha == null ? 90 : el.futureAlpha) / 100 : 1);
        rr(g, nx, ny + rh * (1 - nh) / 2, nw, Math.max(2, rh * nh), el.noteRadius * S); g.fill();
        g.shadowBlur = 0; if (el.noteStroke > 0) { g.lineWidth = el.noteStroke * S; g.strokeStyle = on && el.activeStroke ? el.activeStroke : el.noteStrokeColor; g.stroke(); }
        g.globalAlpha = ga;
      }
      g.restore();
      if (el.showPlayhead !== false && playX >= x0 && playX <= x0 + iw) { g.fillStyle = el.playhead; g.shadowColor = el.playhead; g.shadowBlur = 8 * S; g.fillRect(playX, y0, 2 * S, ih); g.shadowBlur = 0; }
    }
  };
  T.stepgrid = {
    label: 'Drum grid', icon: '▦', midi: true,
    defaults: Object.assign({}, PANEL_DEF, { label: 'DRUMS', midi: 'all', track: -1, channel: -1, steps: 16, stepLen: 0.25, maxRows: 6, cellFill: F('#ff2a7a', '#ffb3d1', { by: 'row' }), hitColor: '#ffffff', offColor: '#1e1a24', gridGap: 4, cellRadius: 2, showLabels: true, playhead: '#ff7ab8', labelColor: '#c9bfd6', keys: true, showOff: true, cellStroke: 0, cellStrokeColor: '#000000', strokeEmpty: false, showPlayhead: true }),
    render: function (g, el, w, h, R, S) {
      var bar = chrome(g, el, w, h, S, el.label, R.t), pad = el.panel === false ? 0 : 8 * S, kx = el.keys ? w * 0.07 : 0, notes = filterNotes(R.notes, el), pitches = {};
      notes.forEach(function (n) { pitches[n.p] = (pitches[n.p] || 0) + 1; });
      var rowsP = Object.keys(pitches).map(Number).sort(function (a, b) { return pitches[b] - pitches[a]; }).slice(0, el.maxRows || 6).sort(function (a, b) { return b - a; });
      if (!rowsP.length) rowsP = [38, 36];
      var x0 = pad + kx, y0 = bar + pad + (el.panel === false ? 0 : h * 0.05), iw = w - x0 - pad, ih = h - y0 - pad, steps = el.steps || 16, cw = iw / steps, ch = ih / rowsP.length, gap = el.gridGap * S;
      var spb = 60 / (R.P.bpm || 120), sl = (el.stepLen || 0.25) * spb, off = R.P.beatOffset || 0, page = Math.floor((R.t - off) / (sl * steps)), ps = off + page * sl * steps, curStep = Math.floor((R.t - ps) / sl);
      g.font = '600 ' + Math.max(8 * S, Math.min(ch, cw) * 0.28) + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'middle';
      rowsP.forEach(function (p, ri) {
        var rowU = rowsP.length > 1 ? ri / (rowsP.length - 1) : 0;
        if (el.keys) { g.fillStyle = '#f2eef6'; g.fillRect(pad, y0 + ri * ch + 1, kx - 2 * S, ch - 2); g.fillStyle = '#555'; g.fillText(noteName(p), pad + 3 * S, y0 + ri * ch + ch / 2); }
        for (var s = 0; s < steps; s++) {
          var st0 = ps + s * sl, hit = null;
          for (var k = 0; k < notes.length; k++) { var n = notes[k]; if (n.t >= st0 + sl * 0.55) break; if (n.p === p && n.t >= st0 - sl * 0.45) { hit = n; break; } }
          var x = x0 + s * cw + gap / 2, y = y0 + ri * ch + gap / 2;
          rr(g, x, y, cw - gap, ch - gap, el.cellRadius * S);
          if (el.showOff !== false) { g.fillStyle = el.offColor; g.fill(); if (el.cellStroke > 0 && el.strokeEmpty) { g.lineWidth = el.cellStroke * S; g.strokeStyle = el.cellStrokeColor; g.stroke(); } }
          if (hit) {
            var played = hit.t <= R.t, fresh = played && R.t - hit.t < sl * 1.2, by = el.cellFill && el.cellFill.by, u = by === 'velocity' ? hit.v : by === 'time' || by === 'x' ? s / steps : rowU, c = colorAt(el.cellFill, u, R.t);
            g.fillStyle = fresh ? el.hitColor : played ? c : rgba(c, 0.35);
            if (fresh) { g.shadowColor = c; g.shadowBlur = 14 * S; }
            rr(g, x, y, cw - gap, ch - gap, el.cellRadius * S); g.fill(); g.shadowBlur = 0;
            if (el.cellStroke > 0) { g.lineWidth = el.cellStroke * S; g.strokeStyle = el.cellStrokeColor; g.stroke(); }
            if (el.showLabels && ch > 16 * S) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(noteName(p), x + 3 * S, y + 8 * S); }
          }
        }
      });
      if (el.showPlayhead !== false && curStep >= 0 && curStep < steps) { g.fillStyle = rgba(el.playhead, 0.18); g.fillRect(x0 + curStep * cw, y0, cw, ih); g.fillStyle = el.playhead; g.fillRect(x0 + (R.t - ps) / sl * cw, y0, 2 * S, ih); }
    }
  };
  T.falling = {
    label: 'Falling notes', icon: '⬇', midi: true,
    defaults: { midi: 'all', track: -1, channel: -1, look: 3, lowNote: 0, highNote: 0, noteFill: F('#38c8ff', '#ff3fc8', { by: 'pitch' }), keyboard: true, keyH: 12, glow: 16, radius: 6, bg: 'transparent', lineColor: 'rgba(255,255,255,0.08)', hitFlash: true, direction: 'down', followKeys: false, followWidth: 24, followSmooth: 0.8, noteStroke: 0, noteStrokeColor: '#000000', showLines: true, bgOpacity: 100 },
    render: function (g, el, w, h, R, S) {
      var notes = filterNotes(R.notes, el), rg = autoRange(notes, el), lo = rg[0], hi = rg[1];
      if (el.bg && el.bg !== 'transparent' && (el.bgOpacity == null || el.bgOpacity > 0)) { g.save(); g.globalAlpha *= el.bgOpacity == null ? 1 : el.bgOpacity / 100; g.fillStyle = paint(g, el.bg, 0, 0, w, h, R.t); g.fillRect(0, 0, w, h); g.restore(); }
      var up = el.direction === 'up', kh = el.keyboard ? h * el.keyH / 100 : 0, fh = h - kh, cols = hi - lo + 1, look = el.look || 3, ky = up ? 0 : fh, fy = up ? kh : 0;
      if (el.followKeys && notes.length) {
        // the keyboard slides left/right to follow the melody
        cols = clamp(el.followWidth || 24, 6, 88);
        var cp = clamp(pitchCenter(notes, R.t, Math.max(0.1, el.followSmooth || 0.8), look * 0.3), rg[0] + cols / 2 - 0.5, Math.max(rg[0] + cols / 2 - 0.5, rg[1] - cols / 2 + 0.5));
        lo = cp - cols / 2 + 0.5; hi = lo + cols - 1;
      }
      var cw = w / cols, pLo = Math.floor(lo), pHi = Math.ceil(hi);
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
      g.fillStyle = el.lineColor; if (el.showLines !== false) for (var c = pLo; c <= pHi + 1; c++) if (((c % 12) + 12) % 12 === 0) g.fillRect((c - lo) * cw, fy, 1 * S, fh);
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i]; if (n.t > R.t + look) break; if (n.e < R.t) continue;
        var a = (n.t - R.t) / look * fh, b = (n.e - R.t) / look * fh, x = (n.p - lo) * cw, col = colorAt(el.noteFill, noteU(el.noteFill, n, lo, hi, (n.p - lo) / cols), R.t);
        var top = up ? kh + Math.max(0, a) : fh - Math.min(fh + 20, b), bot = up ? kh + Math.min(fh + 20, b) : fh - Math.max(0, a);
        g.fillStyle = col; g.shadowColor = col; g.shadowBlur = el.glow * S;
        rr(g, x + cw * 0.12, top, cw * 0.76, Math.max(4 * S, bot - top), el.radius * S); g.fill();
        if (el.noteStroke > 0) { g.shadowBlur = 0; g.lineWidth = el.noteStroke * S; g.strokeStyle = el.noteStrokeColor; g.stroke(); }
      }
      g.shadowBlur = 0;
      if (el.keyboard) for (var p = pLo; p <= pHi; p++) {
        var xx = (p - lo) * cw, on = false; for (var q = 0; q < notes.length; q++) { var nn = notes[q]; if (nn.t > R.t) break; if (nn.p === p && nn.e > R.t) { on = true; break; } }
        g.fillStyle = on ? colorAt(el.noteFill, (p - lo) / cols, R.t) : isBlack(p) ? '#1a1520' : '#f4f0fa';
        g.fillRect(xx + 1, ky, cw - 2, isBlack(p) ? kh * 0.62 : kh);
        if (on && el.hitFlash) { var gr = g.createLinearGradient(0, up ? kh : fh, 0, up ? kh + 60 * S : fh - 60 * S); gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(xx, up ? kh : fh - 60 * S, cw, 60 * S); }
      }
      g.restore();
    }
  };
  T.noteburst = {
    label: 'Note bursts', icon: '✺', midi: true,
    defaults: { midi: 'all', track: -1, channel: -1, style: 'rings', burstFill: F('#ff3fc8', '#ffe14d', { by: 'random' }), life: 0.8, size: 90, layout: 'pitch', count: 10, noteStroke: 0, noteStrokeColor: '#000000' },
    render: function (g, el, w, h, R, S) {
      var notes = filterNotes(R.notes, el), rg = autoRange(notes, el), lo = rg[0], hi = rg[1];
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i]; if (n.t > R.t) break; var age = R.t - n.t; if (age > el.life) continue;
        var r = rng(hash(n.src + n.t + ':' + n.p)), f = age / el.life, x, y;
        if (el.layout === 'center') { x = w / 2; y = h / 2; } else if (el.layout === 'random') { x = r() * w; y = r() * h; } else { x = hi > lo ? (n.p - lo) / (hi - lo) * w * 0.85 + w * 0.075 : w / 2; y = h * (0.3 + r() * 0.4); }
        var u = el.burstFill && el.burstFill.by === 'random' ? r() : noteU(el.burstFill, n, lo, hi, x / w), col = colorAt(el.burstFill, u, R.t), sz = el.size * S * (0.5 + n.v);
        g.globalAlpha = 1 - f; g.strokeStyle = g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12 * S;
        if (el.style === 'rings') { g.lineWidth = 6 * S * (1 - f) + 1; g.beginPath(); g.arc(x, y, sz * EASE_FN.back(Math.min(1, f * 1.5)) * 0.9 + 1, 0, TAU); g.stroke(); }
        else if (el.style === 'sparks') { for (var k = 0; k < el.count; k++) { var a = r() * TAU, d = sz * (1 - Math.pow(1 - f, 3)) * (0.6 + r() * 0.8), s2 = 6 * S * (1 - f) + 1; g.fillRect(x + Math.cos(a) * d - s2 / 2, y + Math.sin(a) * d - s2 / 2, s2, s2); } }
        else if (el.style === 'stars') { var s3 = sz * 0.6 * EASE_FN.back(Math.min(1, f * 3)) * (1 - f * 0.5); shapePath(g, 'sparkle', x - s3 / 2, y - s3 / 2, s3, s3); g.fill(); }
        else if (el.style === 'hearts') { var s4 = sz * 0.5 * EASE_FN.back(Math.min(1, f * 3)); shapePath(g, 'heart', x - s4 / 2, y - s4 / 2 - f * 40 * S, s4, s4); g.fill(); }
        else { g.beginPath(); g.arc(x, y, sz * 0.5 * (1 - f * 0.6), 0, TAU); g.fill(); }
        if (el.noteStroke > 0 && el.style !== 'rings' && el.style !== 'sparks') { g.shadowBlur = 0; g.lineWidth = el.noteStroke * S; g.strokeStyle = el.noteStrokeColor; g.stroke(); }
      }
      g.globalAlpha = 1; g.shadowBlur = 0;
    }
  };
  function fakeSpec(R, n) { var out = new Float32Array(n), be = beatEnv(R.P, R.t); for (var i = 0; i < n; i++) out[i] = clamp((0.25 + 0.5 * be) * (1 - i / n * 0.7) + 0.15 * Math.sin(R.t * 3 + i * 0.7), 0, 1); return out; }
  T.spectrum = {
    label: 'Spectrum', icon: '▮▮', audio: true,
    defaults: { style: 'bars', bands: 48, barFill: F('#ff3fc8', '#38c8ff', { by: 'x' }), gap: 30, radius: 4, sens: 100, mirror: false, glow: 0, inner: 35, minH: 2 },
    render: function (g, el, w, h, R, S) {
      var n = el.bands | 0, spec = R.an ? R.an.spectrum(R.t, n) : fakeSpec(R, n), k = el.sens / 100, i, f = el.barFill;
      function col(i, v) { return colorAt(f, f && f.by === 'value' ? v : i / Math.max(1, n - 1), R.t); }
      g.shadowBlur = el.glow * S;
      if (el.style === 'circle') {
        var cx = w / 2, cy = h / 2, r0 = Math.min(w, h) / 2 * el.inner / 100, r1 = Math.min(w, h) / 2;
        for (i = 0; i < n; i++) { var v = clamp(spec[i] * k, 0, 1), a = i / n * TAU - Math.PI / 2, len = (r1 - r0) * v + el.minH * S, c = col(i, v); g.strokeStyle = c; g.shadowColor = c; g.lineWidth = Math.max(1, TAU * r0 / n * (1 - el.gap / 100)); g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke(); }
      } else if (el.style === 'line' || el.style === 'area') {
        g.strokeStyle = g.fillStyle = paint(g, f, 0, 0, w, h, R.t); g.shadowColor = colorAt(f, 0.5, R.t); g.lineWidth = 4 * S; g.lineJoin = 'round'; g.beginPath();
        for (i = 0; i < n; i++) { var x = i / (n - 1) * w, y = h - clamp(spec[i] * k, 0, 1) * h; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        if (el.style === 'area') { g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill(); } else g.stroke();
      } else {
        var bw = w / n, inner = bw * (1 - el.gap / 100);
        for (i = 0; i < n; i++) {
          var v2 = clamp(spec[i] * k, 0, 1), bh = Math.max(el.minH * S, v2 * h * (el.mirror ? 0.5 : 1)), c2 = col(i, v2); g.fillStyle = c2; g.shadowColor = c2;
          if (el.style === 'dots') { var dots = Math.ceil(bh / (inner + 2 * S)); for (var d = 0; d < dots; d++) { g.beginPath(); g.arc(i * bw + bw / 2, h - inner / 2 - d * (inner + 2 * S), inner / 2, 0, TAU); g.fill(); } }
          else { rr(g, i * bw + (bw - inner) / 2, el.mirror ? h / 2 - bh : h - bh, inner, el.mirror ? bh * 2 : bh, el.radius * S); g.fill(); }
        }
      }
      g.shadowBlur = 0;
    }
  };
  T.waveform = {
    label: 'Waveform', icon: '〰', audio: true,
    defaults: Object.assign({}, PANEL_DEF, { label: 'LEAD', style: 'full', bg: '#ffc2e6', frame: 0, shape: 'rect', radius: 6, titleBar: false, offsetShadow: 0, waveFill: F('#ff3fa4'), played: '#ff8fcd', playhead: '#ffffff', textColor: '#ffffff', span: 2, showLabel: true, barW: 3 }),
    render: function (g, el, w, h, R, S) {
      var bar = chrome(g, el, w, h, S, el.label, R.t), pad = 6 * S, y0 = bar + pad, ih = h - y0 - pad, mid = y0 + ih / 2, dur = Math.max(0.1, R.P.duration), i;
      g.save(); panelPath(g, scaled(el, S), 0, 0, w, h); g.clip();
      if (el.style === 'scope') {
        var wv = R.an ? R.an.wave(R.t, 400, el.span / 100) : null; g.strokeStyle = paint(g, el.waveFill, 0, 0, w, h, R.t); g.lineWidth = 3 * S; g.beginPath();
        for (i = 0; i < 400; i++) { var v = wv ? wv[i] : Math.sin(i / 12 + R.t * 8) * 0.3 * beatEnv(R.P, R.t), x = i / 399 * w, y = mid - v * ih * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      } else {
        var peaks = R.an ? R.an.peaks : null, N = Math.max(10, Math.floor(w / ((el.barW || 3) * S))), prog = clamp(R.t / dur, 0, 1);
        var vs = el.style === 'window' ? Math.max(0, R.t - el.span) / dur : 0, ve = el.style === 'window' ? Math.min(1, (R.t + el.span) / dur) : 1;
        for (i = 0; i < N; i++) {
          var fx = vs + (ve - vs) * i / N, pv = peaks ? peaks[Math.min(peaks.length - 1, Math.floor(fx * peaks.length))] : 0.3 + 0.3 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.13));
          g.fillStyle = fx <= prog ? el.played : colorAt(el.waveFill, i / N, R.t); var bh = Math.max(1, pv * ih * 0.95); g.fillRect(i / N * w, mid - bh / 2, Math.max(1, w / N - 1 * S), bh);
        }
        var px = el.style === 'window' ? w / 2 : prog * w; g.fillStyle = el.playhead; g.fillRect(px - 1.5 * S, y0, 3 * S, ih);
      }
      if (el.showLabel && !el.titleBar && el.label) { g.fillStyle = el.textColor; g.font = '700 ' + Math.max(10 * S, h * 0.09) + 'px "Space Grotesk", sans-serif'; g.textBaseline = 'top'; g.fillText(String(el.label), 8 * S, 6 * S); }
      g.restore();
    }
  };
  T.player = {
    label: 'Retro player', icon: '📻', audio: true,
    defaults: { title: 'SUL - MY SONG', brand: 'PIXAMP', body: '#ff5fb0', body2: '#ff8fcd', screen: '#2a1f9e', screenText: '#7fd3ff', accent: '#ffe14d', bars: 20, radius: 18 },
    render: function (g, el, w, h, R, S) {
      var r = el.radius * S, bh = h * 0.13, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, el.body2); gr.addColorStop(1, el.body);
      rr(g, 0, 0, w, h, r); g.fillStyle = gr; g.fill(); g.lineWidth = 3 * S; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, w * 0.03, h * 0.04, w * 0.94, bh, bh / 2); g.fill();
      g.fillStyle = '#fff'; g.font = '900 ' + bh * 0.7 + 'px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(el.brand, w / 2, h * 0.04 + bh / 2); g.textAlign = 'left';
      var sx = w * 0.05, sy = h * 0.22, sw = w * 0.9, sh = h * 0.42; rr(g, sx, sy, sw, sh, 8 * S); g.fillStyle = el.screen; g.fill();
      g.fillStyle = el.screenText; g.font = '700 ' + sh * 0.38 + 'px "VT323", "Silkscreen", monospace'; g.textBaseline = 'top'; g.fillText(fmtTime(R.t), sx + sw * 0.05, sy + sh * 0.1);
      g.save(); g.beginPath(); g.rect(sx + sw * 0.36, sy, sw * 0.6, sh); g.clip(); g.font = '700 ' + sh * 0.2 + 'px "VT323", monospace'; var txt = el.title + '  ***  ', tw = Math.max(1, g.measureText(txt).width), ox = (R.t * 60 * S) % tw; g.fillText(txt + txt, sx + sw * 0.37 - ox, sy + sh * 0.12); g.restore();
      g.font = '700 ' + sh * 0.16 + 'px "VT323", monospace'; g.fillText('320 KBPS   48 KHZ   STEREO', sx + sw * 0.37, sy + sh * 0.42);
      var nb = el.bars | 0, spec = R.an ? R.an.spectrum(R.t, nb) : fakeSpec(R, nb), bw = sw * 0.3 / nb;
      for (var i = 0; i < nb; i++) { var bh2 = clamp(spec[i], 0.05, 1) * sh * 0.42; g.fillStyle = i % 3 ? el.screenText : el.accent; g.fillRect(sx + sw * 0.05 + i * bw, sy + sh * 0.92 - bh2, bw * 0.7, bh2); }
      var prog = clamp(R.t / Math.max(0.1, R.P.duration), 0, 1), ky = h * 0.7;
      g.fillStyle = 'rgba(0,0,0,.2)'; rr(g, sx, ky, sw, h * 0.035, 6 * S); g.fill(); g.fillStyle = '#fff'; rr(g, sx + (sw - w * 0.06) * prog, ky - h * 0.012, w * 0.06, h * 0.06, 5 * S); g.fill();
      var bs = h * 0.13, by = h * 0.8, gap = (sw - bs * 6) / 5;
      for (var b = 0; b < 6; b++) {
        var bx = sx + b * (bs + gap), on = b === 1 && beatEnv(R.P, R.t) > 0.5; rr(g, bx, by, bs, bs, bs / 2); g.fillStyle = on ? el.accent : 'rgba(255,255,255,.55)'; g.fill();
        g.fillStyle = el.body; var c = bx + bs / 2, cy = by + bs / 2, q = bs * 0.2; g.beginPath();
        if (b === 0) { g.moveTo(c + q, cy - q); g.lineTo(c - q, cy); g.lineTo(c + q, cy + q); } else if (b === 1) { g.moveTo(c - q * 0.7, cy - q); g.lineTo(c + q, cy); g.lineTo(c - q * 0.7, cy + q); } else if (b === 2) { g.rect(c - q, cy - q, q * 0.7, q * 2); g.rect(c + q * 0.3, cy - q, q * 0.7, q * 2); } else if (b === 3) g.rect(c - q, cy - q, q * 2, q * 2); else if (b === 4) { g.moveTo(c - q, cy - q); g.lineTo(c + q, cy); g.lineTo(c - q, cy + q); } else { g.moveTo(c - q, cy + q * 0.5); g.lineTo(c, cy - q); g.lineTo(c + q, cy + q * 0.5); }
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
      var notes = filterNotes(R.notes, el), lvl = 0;
      for (var i0 = 0; i0 < notes.length; i0++) { var n0 = notes[i0]; if (n0.t > R.t) break; if (R.t < n0.e + 0.25) lvl = Math.max(lvl, n0.v * (R.t < n0.e ? 1 : 1 - (R.t - n0.e) / 0.25)); }
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(w * 0.06, h * 0.43, w * 0.88, h * 0.05); g.fillStyle = el.accent; g.fillRect(w * 0.06, h * 0.43, w * 0.88 * lvl, h * 0.05);
      var n = el.knobs | 0, kr = Math.min(h * 0.17, w * 0.8 / Math.max(1, n) / 2.4);
      for (var i = 0; i < n; i++) {
        var cx = w * 0.1 + (w * 0.8) * (i + 0.5) / n, cy = h * 0.72, val = clamp(0.3 + 0.5 * ((Math.sin(i * 1.7) + 1) / 2) + lvl * 0.3 * ((i % 3) / 2), 0, 1);
        g.beginPath(); g.arc(cx, cy, kr, 0, TAU); g.fillStyle = '#0d0f12'; g.fill(); g.lineWidth = 2 * S; g.strokeStyle = '#3a4048'; g.stroke();
        g.beginPath(); g.arc(cx, cy, kr * 1.18, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * val); g.strokeStyle = el.accent; g.lineWidth = 3 * S; g.stroke();
        var a = Math.PI * 0.75 + Math.PI * 1.5 * val; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * kr * 0.8, cy + Math.sin(a) * kr * 0.8); g.strokeStyle = el.text; g.stroke();
      }
    }
  };
  T.progress = {
    label: 'Progress bar', icon: '▭', audio: true,
    defaults: { barFill: F('#ff3fc8'), track: 'rgba(255,255,255,0.3)', radius: 20, knob: true },
    render: function (g, el, w, h, R, S) {
      var p = clamp(R.t / Math.max(0.1, R.P.duration), 0, 1);
      rr(g, 0, 0, w, h, el.radius * S); g.fillStyle = el.track; g.fill();
      rr(g, 0, 0, Math.max(h, w * p), h, el.radius * S); g.fillStyle = paint(g, el.barFill, 0, 0, w, h, R.t); g.fill();
      if (el.knob) { g.beginPath(); g.arc(Math.max(h / 2, w * p - h / 2), h / 2, h * 0.9, 0, TAU); g.fillStyle = '#fff'; g.fill(); }
    }
  };
  T.timer = {
    label: 'Time', icon: '⏱', audio: true,
    defaults: { font: 'VT323', color: '#ffffff', showTotal: true, size: 80 },
    render: function (g, el, w, h, R, S) { g.fillStyle = el.color; g.font = el.size * S + 'px "' + el.font + '", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(fmtTime(R.t) + (el.showTotal ? ' / ' + fmtTime(R.P.duration) : ''), w / 2, h / 2); g.textAlign = 'left'; }
  };
  T.sparkles = {
    label: 'Sparkles', icon: '✦',
    defaults: { count: 24, sparkFill: F('#ffffff', '#ffe14d', { by: 'random' }), size: 28, speed: 1, onBeat: true, kind: 'sparkle' },
    render: function (g, el, w, h, R, S) {
      var r = rng(hash(el.id)), be = el.onBeat ? beatEnv(R.P, R.t) : 0;
      for (var i = 0; i < el.count; i++) {
        var x = r() * w, y = r() * h, ph = r() * TAU, sp = (0.5 + r()) * el.speed, sz = el.size * S * (0.4 + r() * 0.8), u = r();
        var k = clamp(0.5 + 0.5 * Math.sin(R.t * sp * 3 + ph) + be * 0.5, 0, 1.4); g.globalAlpha = clamp(k, 0, 1); g.fillStyle = colorAt(el.sparkFill, u, R.t);
        var s = sz * k; shapePath(g, el.kind || 'sparkle', x - s / 2, y - s / 2 + Math.sin(R.t * sp + ph) * 6 * S, s, s); g.fill();
      }
      g.globalAlpha = 1;
    }
  };


  /* =========================================================
     MIDI VISUAL SKINS — one click looks. "site" uses the website's own colours.
     ========================================================= */
  var THEME = { primary: '#ff2bc2', secondary: '#8a3cff', accent: '#38c8ff', highlight: '#fff27a', text: '#1c0b33', surface: '#ffffff' };
  function setTheme(t) { if (!t) return; Object.keys(THEME).forEach(function (k) { if (typeof t[k] === 'string' && /^#|^rgb/i.test(t[k])) THEME[k] = t[k]; }); }
  var SKIN_LIST = [['site', 'Site theme'], ['notes', 'Notes only'], ['studio', 'Dark studio'], ['neon', 'Neon'], ['clean', 'Clean white'], ['pixel', 'Pixel arcade'], ['glass', 'Glass']];
  function skinProps(id, type) {
    var p = THEME.primary, sc = THEME.secondary, a = THEME.accent, hl = THEME.highlight, ink = THEME.text, sf = THEME.surface, o = {};
    function panel(x) { Object.assign(o, x); }
    switch (id) {
      case 'site':
        panel({ panel: true, bg: F(sf), bgOpacity: 100, frame: 3, frameColor: ink, shape: 'rect', radius: 0, titleBar: true, barColor: p, barText: '#ffffff', offsetShadow: 8, shadowTint: sc,
          noteFill: F(p, sc, { by: 'pitch' }), activeColor: hl, activeStroke: '', noteGlow: 0, noteRadius: 0, noteHeight: 80, noteStroke: 2, noteStrokeColor: ink, gridColor: rgba(ink, 0.08), barLineColor: rgba(ink, 0.25), playhead: a, labelColor: ink,
          keys: true, showGrid: true, showRows: true, showNums: true, showPlayhead: true, bpmLabel: true,
          cellFill: F(p, sc, { by: 'row' }), hitColor: hl, offColor: rgba(ink, 0.07), cellRadius: 0, cellStroke: 2, cellStrokeColor: ink, strokeEmpty: false, showOff: true, gridGap: 4, showLabels: true,
          glow: 0, keyboard: true, showLines: true, lineColor: rgba(ink, 0.12), hitFlash: true, burstFill: F(p, hl, { by: 'random' }) });
        if (type === 'falling') Object.assign(o, { noteFill: F(p, a, { by: 'pitch' }), radius: 0, bg: F(sf), bgOpacity: 0 });
        if (type === 'plugin') o = { panel: sf, panel2: p, accent: sc, text: ink, offsetShadow: 8, shadowTint: sc, radius: 0 };
        break;
      case 'notes':
        o = { panel: false, keys: false, showGrid: false, showRows: false, showNums: false, showPlayhead: false, bpmLabel: false, titleBar: false, showOff: false, showLabels: false, keyboard: false, showLines: false, bgOpacity: 0, offsetShadow: 0 };
        if (type === 'plugin') o = {};
        break;
      case 'studio':
        panel({ panel: true, bg: F('#141018'), bgOpacity: 100, frame: 3, frameColor: '#2a2230', shape: 'notch', radius: 16, titleBar: true, barColor: '#1d1724', barText: '#ffffff', offsetShadow: 10, shadowTint: '#ff1f78',
          noteFill: F('#ffb3d1', '#ff2a7a', { by: 'velocity' }), activeColor: '#ffffff', noteGlow: 10, noteRadius: 2, noteStroke: 0, gridColor: '#2b2533', barLineColor: '#3d3446', playhead: '#ff7ab8', labelColor: '#c9bfd6',
          keys: true, showGrid: true, showRows: false, showNums: true, showPlayhead: true, cellFill: F('#ff2a7a', '#ffb3d1', { by: 'row' }), hitColor: '#ffffff', offColor: '#1e1a24', cellRadius: 2, cellStroke: 0, showOff: true,
          glow: 16, keyboard: true, showLines: true, lineColor: 'rgba(255,255,255,0.08)', burstFill: F('#ff3fc8', '#ffe14d', { by: 'random' }) });
        if (type === 'falling') Object.assign(o, { noteFill: F('#38c8ff', '#ff3fc8', { by: 'pitch' }), radius: 6, bgOpacity: 0 });
        if (type === 'plugin') o = { panel: '#1a1d22', panel2: '#2a2f36', accent: '#3ff0c8', text: '#d9fbf3', offsetShadow: 10, shadowTint: '#ff1f78', radius: 10 };
        break;
      case 'neon':
        panel({ panel: true, bg: F('#0b0614'), bgOpacity: 70, frame: 2, frameColor: a, shape: 'rect', radius: 18, titleBar: false, offsetShadow: 0,
          noteFill: F(a, p, { by: 'pitch', anim: 'flow', speed: 0.5 }), activeColor: '#ffffff', noteGlow: 24, noteRadius: 6, noteStroke: 0, gridColor: rgba(a, 0.1), barLineColor: rgba(a, 0.3), playhead: '#ffffff', labelColor: a,
          showRows: false, cellFill: F(a, p, { by: 'time', anim: 'flow' }), hitColor: '#ffffff', offColor: 'rgba(255,255,255,0.05)', cellRadius: 6, cellStroke: 0, glow: 24, radius: 6, lineColor: rgba(a, 0.12), burstFill: F(a, p, { by: 'random', anim: 'hue' }) });
        if (type === 'falling') Object.assign(o, { bgOpacity: 0, radius: 8 });
        if (type === 'plugin') o = { panel: '#0b0614', panel2: '#1a0f2a', accent: a, text: '#ffffff', offsetShadow: 0, radius: 18 };
        break;
      case 'clean':
        panel({ panel: true, bg: F('#ffffff'), bgOpacity: 100, frame: 0, shape: 'rect', radius: 24, titleBar: false, offsetShadow: 0,
          noteFill: F('#111111'), activeColor: p, noteGlow: 0, noteRadius: 8, noteStroke: 0, gridColor: 'rgba(0,0,0,0.05)', barLineColor: 'rgba(0,0,0,0.14)', playhead: p, labelColor: '#666666',
          showRows: false, cellFill: F('#111111'), hitColor: p, offColor: '#f1f1f1', cellRadius: 8, cellStroke: 0, glow: 0, radius: 10, lineColor: 'rgba(0,0,0,0.06)', burstFill: F('#111111') });
        if (type === 'falling') Object.assign(o, { bg: F('#ffffff'), bgOpacity: 100 });
        if (type === 'plugin') o = { panel: '#ffffff', panel2: '#f1f1f1', accent: p, text: '#111111', offsetShadow: 0, radius: 20 };
        break;
      case 'pixel':
        panel({ panel: true, bg: F(hl), bgOpacity: 100, frame: 4, frameColor: ink, shape: 'notch', radius: 10, titleBar: true, barColor: sc, barText: '#ffffff', offsetShadow: 8, shadowTint: p,
          noteFill: F(sc, p, { by: 'pitch' }), activeColor: '#ffffff', noteGlow: 0, noteRadius: 0, noteStroke: 3, noteStrokeColor: ink, gridColor: rgba(ink, 0.12), barLineColor: rgba(ink, 0.35), playhead: p, labelColor: ink,
          showRows: true, cellFill: F(sc, p, { by: 'row' }), hitColor: '#ffffff', offColor: rgba(ink, 0.1), cellRadius: 0, cellStroke: 3, cellStrokeColor: ink, glow: 0, radius: 0, lineColor: rgba(ink, 0.15), burstFill: F(sc, p, { by: 'random' }) });
        if (type === 'falling') Object.assign(o, { bg: F(hl), bgOpacity: 0 });
        if (type === 'plugin') o = { panel: hl, panel2: sc, accent: p, text: ink, offsetShadow: 8, shadowTint: p, radius: 10 };
        break;
      case 'glass':
        panel({ panel: true, bg: F('#ffffff'), bgOpacity: 22, frame: 2, frameColor: 'rgba(255,255,255,0.75)', shape: 'rect', radius: 22, titleBar: false, offsetShadow: 0,
          noteFill: F('#ffffff', p, { by: 'velocity' }), activeColor: hl, noteGlow: 12, noteRadius: 4, noteStroke: 0, gridColor: 'rgba(255,255,255,0.14)', barLineColor: 'rgba(255,255,255,0.35)', playhead: '#ffffff', labelColor: '#ffffff',
          showRows: false, cellFill: F('#ffffff', p, { by: 'row' }), hitColor: hl, offColor: 'rgba(255,255,255,0.12)', cellRadius: 6, cellStroke: 0, glow: 12, radius: 6, lineColor: 'rgba(255,255,255,0.15)', burstFill: F('#ffffff', p, { by: 'random' }) });
        if (type === 'falling') Object.assign(o, { bg: F('#ffffff'), bgOpacity: 12 });
        if (type === 'plugin') o = { panel: 'rgba(255,255,255,0.2)', panel2: 'rgba(255,255,255,0.3)', accent: hl, text: '#ffffff', offsetShadow: 0, radius: 22 };
        break;
    }
    return o;
  }
  /* custom skins (made by the site owner, or saved by people in their own browser) */
  var CUSTOM = [], HIDDEN = [], DEF_SKIN = 'site';
  function setSkins(custom, hidden, def) {
    CUSTOM = (custom || []).filter(function (k) { return k && k.id && k.props; });
    HIDDEN = Array.isArray(hidden) ? hidden.slice() : [];
    var all = skinList(); DEF_SKIN = def && all.some(function (k) { return k[0] === def; }) ? def : all.some(function (k) { return k[0] === 'site'; }) ? 'site' : all.length ? all[0][0] : 'site';
  }
  function skinList() {
    return SKIN_LIST.filter(function (k) { return HIDDEN.indexOf(k[0]) < 0; }).concat(CUSTOM.map(function (k) { return [k.id, k.name || 'Skin', k]; }));
  }
  var SKIN_SKIP = ['followPitch', 'followRows', 'followSmooth', 'followKeys', 'followWidth', 'midi', 'track', 'channel', 'lowNote', 'highNote', 'padNotes', 'label', 'mode', 'beats', 'steps', 'stepLen', 'maxRows', 'direction', 'look', 'playheadPos', 'layout', 'count', 'life', 'size', 'brand', 'preset', 'knobs'];
  // the look of a MIDI visual, as a skin that also works on the other MIDI visuals
  function skinFromEl(el) {
    var def = T[el.type], o = {}; if (!def) return o;
    Object.keys(def.defaults).forEach(function (k) { if (SKIN_SKIP.indexOf(k) < 0) o[k] = JSON.parse(JSON.stringify(el[k])); });
    function cp(a, b) { if (o[a] !== undefined && o[b] === undefined) o[b] = JSON.parse(JSON.stringify(o[a])); }
    if (el.type === 'pianoroll' || el.type === 'falling') { cp('noteFill', 'cellFill'); cp('noteFill', 'burstFill'); cp('activeColor', 'hitColor'); cp('noteStroke', 'cellStroke'); cp('noteStrokeColor', 'cellStrokeColor'); cp('noteRadius', 'cellRadius'); cp('noteGlow', 'glow'); cp('noteRadius', 'radius'); cp('glow', 'noteGlow'); cp('radius', 'noteRadius'); cp('keyboard', 'keys'); cp('keys', 'keyboard'); cp('showGrid', 'showLines'); }
    if (el.type === 'stepgrid') { cp('cellFill', 'noteFill'); cp('cellFill', 'burstFill'); cp('hitColor', 'activeColor'); cp('cellStroke', 'noteStroke'); cp('cellStrokeColor', 'noteStrokeColor'); cp('cellRadius', 'noteRadius'); cp('cellRadius', 'radius'); }
    if (el.type === 'noteburst') { cp('burstFill', 'noteFill'); cp('burstFill', 'cellFill'); }
    o._from = el.type;
    return o;
  }
  function applySkin(el, id) {
    var def = T[el.type]; if (!def) return el;
    var cu = null; for (var i = 0; i < CUSTOM.length; i++) if (CUSTOM[i].id === id) cu = CUSTOM[i];
    var o = cu ? (el.type === 'plugin' && cu.props._from !== 'plugin' ? {} : cu.props) : skinProps(id, el.type);
    Object.keys(o).forEach(function (k) { if (k in def.defaults) el[k] = JSON.parse(JSON.stringify(o[k])); });
    el.skin = id; return el;
  }

  /* =========================================================
     BACKGROUND, CAMERA + TRANSITIONS
     ========================================================= */
  function drawBackground(g, P, W, H, R, S) {
    var b = P.bg || {}, t = R.t;
    if (b.type === 'gradient') { g.fillStyle = paint(g, b.fillc || F(b.color || '#fff', b.color2 || '#ffd6ef', { angle: b.angle || 180 }), 0, 0, W, H, t); g.fillRect(0, 0, W, H); }
    else if (b.type === 'clouds') {
      g.fillStyle = b.color || '#ececf2'; g.fillRect(0, 0, W, H);
      var r = rng(hash('clouds' + (b.seed || 1))), cols = [b.color2 || '#ffb8dc', b.color3 || '#ffffff', b.color4 || '#cfcbd8'], layer = tmp(30, Math.max(8, W / 8), Math.max(8, H / 8)), lg = layer.getContext('2d');
      lg.fillStyle = b.color || '#ececf2'; lg.fillRect(0, 0, layer.width, layer.height);
      for (var i = 0; i < 14; i++) {
        var bx = r() * layer.width, by = r() * layer.height, rad = (0.25 + r() * 0.45) * layer.width, sp = (b.speed == null ? 1 : b.speed) * (0.2 + r() * 0.5);
        var x = bx + Math.sin(t * sp * 0.4 + i) * layer.width * 0.18, y = by + Math.cos(t * sp * 0.3 + i * 2) * layer.height * 0.1, rg = lg.createRadialGradient(x, y, 0, x, y, Math.max(1, rad));
        rg.addColorStop(0, rgba(cols[i % 3], 0.85)); rg.addColorStop(1, rgba(cols[i % 3], 0)); lg.fillStyle = rg; lg.fillRect(0, 0, layer.width, layer.height);
      }
      g.imageSmoothingQuality = 'high'; g.drawImage(layer, 0, 0, W, H);
    } else if (b.type === 'media') {
      g.fillStyle = b.color || '#000'; g.fillRect(0, 0, W, H);
      var img = R.media(b.media, b.src);
      if (img) { var z = 1 + (b.zoom || 0) / 100 + (b.pulse ? beatEnv(P, t) * 0.03 : 0); if ((b.blur || 0) > 0) { var tc = tmp(31, W / 4, H / 4); drawMediaFit(tc.getContext('2d'), img, 0, 0, tc.width, tc.height, 'cover', z); g.drawImage(softBlur(tc, b.blur / 4), 0, 0, W, H); } else drawMediaFit(g, img, 0, 0, W, H, b.fit || 'cover', z); }
    } else { g.fillStyle = b.color || '#ffffff'; g.fillRect(0, 0, W, H); }
    if (b.dim) { g.fillStyle = rgba(b.dimColor || '#000000', b.dim / 100); g.fillRect(0, 0, W, H); }
  }
  var TRANSITIONS = [['flash', 'Flash'], ['bounce', 'Bounce punch'], ['zoom', 'Zoom punch'], ['shake', 'Shake'], ['glitch', 'Glitch'], ['whip', 'Whip pan'], ['spin', 'Spin'], ['fade-black', 'Dip to black'], ['fade-white', 'Dip to white'], ['blur', 'Blur'], ['rgb', 'RGB split']];
  function cameraFor(P, t, W) {
    var c = { s: 1, x: 0, y: 0, r: 0, overlay: null, overlayA: 0, blur: 0, rgb: 0, glitch: 0 }, cam = P.camera || {};
    if (cam.bounce && cam.bounce !== 'off') c.s += (cam.amount == null ? 4 : cam.amount) / 100 * beatEnv(P, t, cam.bounce === 'bar' ? 4 : cam.bounce === '2beats' ? 2 : cam.bounce === 'half' ? 0.5 : 1, 8);
    if (cam.drift) { c.s += cam.drift / 100 * (0.5 + 0.5 * Math.sin(t * 0.3)); c.r += Math.sin(t * 0.21) * cam.drift / 2000; }
    if (cam.shake) { var r = rng(Math.floor(t * 30)); c.x += (r() - 0.5) * cam.shake * 2; c.y += (r() - 0.5) * cam.shake * 2; }
    (P.transitions || []).forEach(function (tr) {
      var d = tr.dur || 0.4, f = (t - tr.t) / d; if (f < -1 || f > 1) return;
      var a = 1 - Math.abs(f), e = 1 - Math.pow(1 - a, 3), r2 = rng(Math.floor(t * 40) + 7);
      switch (tr.type) {
        case 'flash': if (f >= 0) { c.overlay = tr.color || '#ffffff'; c.overlayA = Math.max(c.overlayA, 1 - f); } break;
        case 'bounce': if (f >= 0) c.s *= 1 + 0.18 * EASE_FN.elastic(1 - f) * (1 - f); break;
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

  /* =========================================================
     FRAME RENDER
     R = { t, P, notes, an, media(id,src), edit }
     ========================================================= */
  var comp = null, layerBuf = null;
  function renderFrame(cv, P, R) {
    var W = cv.width, H = cv.height, S = W / P.w, t = R.t;
    if (!comp) { comp = mk(W, H); layerBuf = mk(W, H); }
    if (comp.width !== W || comp.height !== H) { comp.width = W; comp.height = H; layerBuf.width = W; layerBuf.height = H; }
    var cg = comp.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalAlpha = 1; cg.globalCompositeOperation = 'source-over'; cg.filter = 'none'; cg.clearRect(0, 0, W, H);
    drawBackground(cg, P, W, H, R, S);
    var env = { t: t, P: P, S: S };
    (P.layers || []).forEach(function (el) {
      if (el.hidden || t < el.start || t >= el.end) return;
      var def = T[el.type]; if (!def) return;
      var a = animState(el, t, P, P.w), op = clamp(prop(el, 'opacity', t) / 100 * a.a, 0, 1);
      if (op <= 0.002) return;
      if (el.type === 'adjust') {
        if (!(el.fx && el.fx.length)) return;
        var cp = copyTo(32, comp); runFx(cp, el.fx, env);
        cg.save(); cg.globalAlpha = op; cg.globalCompositeOperation = el.blend || 'source-over';
        if (a.wipe) clipWipe(cg, a.wipe, 0, 0, W, H);
        cg.drawImage(cp, 0, 0); cg.restore(); return;
      }
      var x = prop(el, 'x', t), y = prop(el, 'y', t), sc = prop(el, 'scale', t) / 100, rot = prop(el, 'rot', t);
      var w = el.w * S, h = el.h * S;
      var needBuf = (el.fx && el.fx.some(function (f) { return f.on !== false; })) || a.blur > 0.5 || a.pix > 1 || a.glitch > 0.01 || a.flash > 0.01 || el.glow > 0 || el.shadowOpacity > 0;
      var tg = needBuf ? layerBuf.getContext('2d') : cg;
      tg.save();
      if (needBuf) { tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over'; tg.filter = 'none'; tg.clearRect(0, 0, W, H); }
      else { tg.globalAlpha = op; tg.globalCompositeOperation = el.blend || 'source-over'; }
      tg.translate((x + a.dx) * S, (y + a.dy) * S); tg.rotate(rot * Math.PI / 180 + a.rot); tg.scale(a.sx * sc * (el.flipX ? -1 : 1), a.sy * sc * (el.flipY ? -1 : 1));
      if (a.wipe) clipWipe(tg, a.wipe, -w / 2, -h / 2, w, h);
      tg.translate(-w / 2, -h / 2);
      try { def.render(tg, el, w, h, R, S); } catch (e) { console.error(e); }
      tg.restore();
      if (needBuf) {
        var buf = layerBuf;
        if (a.pix > 1) FX.pixelate.apply(buf, { size: a.pix }, { t: t, P: P, S: S, k: 1 });
        if (a.glitch > 0.01) FX.glitch.apply(buf, { amount: 100, slices: 10, speed: 30, rgb: 8 }, { t: t, P: P, S: S, k: a.glitch });
        if (el.shadowOpacity > 0) FX.shadow.apply(buf, { x: el.shadowX || 0, y: el.shadowY || 0, blur: el.shadowBlur || 0, color: el.shadowColor || '#000', opacity: el.shadowOpacity }, { t: t, P: P, S: S, k: 1 });
        runFx(buf, el.fx, env);
        if (el.glow > 0) FX.glow.apply(buf, { radius: el.glow, strength: 80, tint: el.glowColor || '#fff', tintAmt: 0 }, { t: t, P: P, S: S, k: 1 });
        if (a.flash > 0.01) { var bgx = buf.getContext('2d'); bgx.save(); bgx.globalCompositeOperation = 'source-atop'; bgx.globalAlpha = a.flash; bgx.fillStyle = '#fff'; bgx.fillRect(0, 0, W, H); bgx.restore(); }
        var src = a.blur > 0.5 ? softBlur(buf, a.blur * S) : buf;
        cg.save(); cg.globalAlpha = op; cg.globalCompositeOperation = el.blend || 'source-over'; cg.drawImage(src, 0, 0); cg.restore();
      }
    });
    // camera + global hits
    var cam = cameraFor(P, t, P.w), g = cv.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.fillStyle = (P.bg && P.bg.color) || '#000'; g.fillRect(0, 0, W, H);
    g.translate(W / 2 + cam.x * S, H / 2 + cam.y * S); g.rotate(cam.r); g.scale(cam.s, cam.s); g.translate(-W / 2, -H / 2);
    g.drawImage(cam.blur > 1 ? softBlur(comp, cam.blur * S) : comp, 0, 0);
    g.restore();
    if (cam.rgb > 0) rgbSplit(cv, cam.rgb * S, 0);
    if (cam.glitch > 0) FX.glitch.apply(cv, { amount: 100, slices: 10, speed: 30, rgb: 6 }, { t: t, P: P, S: S, k: cam.glitch });
    if (cam.overlay && cam.overlayA > 0) { g.save(); g.fillStyle = rgba(cam.overlay, clamp(cam.overlayA, 0, 1)); g.fillRect(0, 0, W, H); g.restore(); }
  }
  function clipWipe(g, w, x, y, W, H) {
    g.beginPath();
    if (w.d === 'left') g.rect(x + W * (1 - w.v), y, W * w.v, H); else if (w.d === 'right') g.rect(x, y, W * w.v, H);
    else if (w.d === 'up') g.rect(x, y + H * (1 - w.v), W, H * w.v); else g.rect(x, y, W, H * w.v);
    g.clip();
  }

  /* =========================================================
     MP4 WRITER (H.264 video + AAC or Opus audio, from WebCodecs)
     ========================================================= */
  function MP4(opts) { this.o = opts; this.v = []; this.a = []; this.data = []; this.size = 0; }
  MP4.prototype.addVideo = function (chunk, meta) {
    if (meta && meta.decoderConfig && meta.decoderConfig.description && !this.avcC) this.avcC = new Uint8Array(meta.decoderConfig.description.buffer ? meta.decoderConfig.description.buffer.slice(meta.decoderConfig.description.byteOffset || 0, (meta.decoderConfig.description.byteOffset || 0) + meta.decoderConfig.description.byteLength) : meta.decoderConfig.description);
    var b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); this.v.push({ data: b, ts: chunk.timestamp, key: chunk.type === 'key' }); };
  MP4.prototype.addAudio = function (chunk, meta) {
    if (meta && meta.decoderConfig && meta.decoderConfig.description && !this.asc) { var d = meta.decoderConfig.description; this.asc = new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset || 0, (d.byteOffset || 0) + d.byteLength) : d); }
    var b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); this.a.push({ data: b, ts: chunk.timestamp, dur: chunk.duration || 0 }); };
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function u16(n) { return [(n >>> 8) & 255, n & 255]; }
  function s4(s) { return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]; }
  function cat(parts) { var len = 0, i; for (i = 0; i < parts.length; i++) len += parts[i].length; var out = new Uint8Array(len), o = 0; for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; } return out; }
  function box(type) { var parts = [], len = 8; for (var i = 1; i < arguments.length; i++) { var p = arguments[i]; if (p == null) continue; if (!(p instanceof Uint8Array)) p = new Uint8Array(p); parts.push(p); len += p.length; } return cat([new Uint8Array(u32(len).concat(s4(type)))].concat(parts)); }
  function full(type, ver, flags) { var rest = [].slice.call(arguments, 3); return box.apply(null, [type, [ver].concat([(flags >> 16) & 255, (flags >> 8) & 255, flags & 255])].concat(rest)); }
  var MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));
  function descLen(n) { return [0x80 | ((n >> 21) & 127), 0x80 | ((n >> 14) & 127), 0x80 | ((n >> 7) & 127), n & 127]; }
  MP4.prototype.finish = function () {
    var o = this.o, vts = 90000, fps = o.fps, vdelta = Math.round(vts / fps), self = this;
    var ftyp = box('ftyp', s4('isom'), u32(512), s4('isom'), s4('iso2'), s4('avc1'), s4('mp41'));
    var vSizes = this.v.map(function (s) { return s.data.length; }), aSizes = this.a.map(function (s) { return s.data.length; });
    var mdatLen = 8; vSizes.forEach(function (s) { mdatLen += s; }); aSizes.forEach(function (s) { mdatLen += s; });
    var base = ftyp.length + 8, off = base, vOff = [], aOff = [];
    // interleave roughly by time so players stream nicely
    var order = [], vi = 0, ai = 0;
    while (vi < this.v.length || ai < this.a.length) { if (ai >= this.a.length || (vi < this.v.length && this.v[vi].ts <= this.a[ai].ts)) order.push(['v', vi++]); else order.push(['a', ai++]); }
    order.forEach(function (it) { var s = it[0] === 'v' ? self.v[it[1]] : self.a[it[1]]; (it[0] === 'v' ? vOff : aOff)[it[1]] = off; off += s.data.length; });
    var durV = this.v.length * vdelta, movieMs = Math.round(this.v.length / fps * 1000);
    // ctts if needed (B-frames)
    var ctts = null, pts = this.v.map(function (s) { return Math.round(s.ts / 1e6 * vts); }), need = false;
    for (var i = 1; i < pts.length; i++) if (pts[i] < pts[i - 1]) { need = true; break; }
    if (need) { var minPts = Math.min.apply(null, pts), ent = []; pts.forEach(function (p, i) { ent = ent.concat(u32(1), u32(Math.max(0, p - minPts - i * vdelta + vdelta))); }); ctts = full('ctts', 0, 0, u32(pts.length), ent); }
    var stss = [], keys = 0; this.v.forEach(function (s, i) { if (s.key) { stss = stss.concat(u32(i + 1)); keys++; } });
    var avc1 = box('avc1', [0, 0, 0, 0, 0, 0], u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(o.width), u16(o.height), u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff), box('avcC', this.avcC || []));
    var vstbl = box('stbl', full('stsd', 0, 0, u32(1), avc1), full('stts', 0, 0, u32(1), u32(this.v.length), u32(vdelta)), ctts, keys ? full('stss', 0, 0, u32(keys), stss) : null,
      full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)), full('stsz', 0, 0, u32(0), u32(vSizes.length), [].concat.apply([], vSizes.map(u32))), full('stco', 0, 0, u32(vOff.length), [].concat.apply([], vOff.map(u32))));
    var vtrak = box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movieMs), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(o.width * 65536), u32(o.height * 65536)),
      box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(vts), u32(durV), u16(0x55c4), u16(0)), full('hdlr', 0, 0, u32(0), s4('vide'), u32(0), u32(0), u32(0), [86, 105, 100, 101, 111, 0]),
        box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), vstbl)));
    var traks = [vtrak];
    if (this.a.length) {
      var sr = o.sampleRate, ch = o.channels, astts = [], cur = null, adur = 0;
      this.a.forEach(function (s) { var d = Math.round((s.dur || (o.audioCodec === 'opus' ? 20000 : 1024 / sr * 1e6)) / 1e6 * sr); adur += d; if (cur && cur[1] === d) cur[0]++; else { cur = [1, d]; astts.push(cur); } });
      var entry;
      if (o.audioCodec === 'opus') {
        var preSkip = 312; if (this.asc && this.asc.length >= 12) preSkip = this.asc[10] | (this.asc[11] << 8);
        entry = box('Opus', [0, 0, 0, 0, 0, 0], u16(1), u32(0), u32(0), u16(ch), u16(16), u16(0), u16(0), u32(48000 * 65536), box('dOps', [0, ch], u16(preSkip), u32(sr), u16(0), [0]));
      } else {
        var asc = this.asc || [], dsi = [0x05].concat(descLen(asc.length), [].slice.call(asc));
        var dcd = [0x04].concat(descLen(13 + dsi.length), [0x40, 0x15, 0, 0, 0], u32(o.audioBitrate || 192000), u32(o.audioBitrate || 192000), dsi);
        var esd = [0x03].concat(descLen(3 + dcd.length + 6), u16(2), [0], dcd, [0x06, 0x80, 0x80, 0x80, 1, 2]);
        entry = box('mp4a', [0, 0, 0, 0, 0, 0], u16(1), u32(0), u32(0), u16(ch), u16(16), u16(0), u16(0), u32(sr * 65536), full('esds', 0, 0, esd));
      }
      var astbl = box('stbl', full('stsd', 0, 0, u32(1), entry), full('stts', 0, 0, u32(astts.length), [].concat.apply([], astts.map(function (e) { return u32(e[0]).concat(u32(e[1])); }))),
        full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)), full('stsz', 0, 0, u32(0), u32(aSizes.length), [].concat.apply([], aSizes.map(u32))), full('stco', 0, 0, u32(aOff.length), [].concat.apply([], aOff.map(u32))));
      traks.push(box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(Math.round(adur / sr * 1000)), u32(0), u32(0), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)),
        box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(sr), u32(adur), u16(0x55c4), u16(0)), full('hdlr', 0, 0, u32(0), s4('soun'), u32(0), u32(0), u32(0), [83, 111, 117, 110, 100, 0]),
          box('minf', full('smhd', 0, 0, u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), astbl))));
    }
    var mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieMs), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), MATRIX, new Array(24).fill(0), u32(traks.length + 1));
    var moov = box.apply(null, ['moov', mvhd].concat(traks));
    var parts = [ftyp, new Uint8Array(u32(mdatLen).concat(s4('mdat')))];
    order.forEach(function (it) { parts.push((it[0] === 'v' ? self.v : self.a)[it[1]].data); });
    parts.push(moov);
    return new Blob(parts, { type: 'video/mp4' });
  };

  /* =========================================================
     PROJECT + ELEMENT FACTORY + upgrade of old projects
     ========================================================= */
  var uidN = 0;
  function uid(p) { return (p || 'e') + Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  var RATIOS = [['9:16', 'TikTok / Reels', 1080, 1920], ['16:9', 'YouTube', 1920, 1080], ['1:1', 'Square', 1080, 1080], ['4:5', 'Instagram post', 1080, 1350], ['3:4', 'Portrait', 1080, 1440], ['4:3', 'Classic', 1440, 1080], ['21:9', 'Cinema', 2520, 1080], ['2:3', 'Poster', 1080, 1620]];
  function ratioDims(r) { for (var i = 0; i < RATIOS.length; i++) if (RATIOS[i][0] === r) return [RATIOS[i][2], RATIOS[i][3]]; return [1080, 1920]; }
  var BASE = { x: 0, y: 0, w: 100, h: 100, rot: 0, scale: 100, opacity: 100, flipX: false, flipY: false, blend: 'source-over', hidden: false, locked: false, replaceable: false, kf: {}, fx: [], shadowOpacity: 0, shadowColor: '#000000', shadowX: 0, shadowY: 0, shadowBlur: 0, glow: 0, glowColor: '#ffffff' };
  function newAnim() { return { in: { type: 'none', dur: 0.5, amt: 1, ease: 'out' }, out: { type: 'none', dur: 0.4, amt: 1, ease: 'out' }, loop: { type: 'none', amt: 1, speed: 1, every: 1 } }; }
  function newElement(type, P, extra) {
    var def = T[type], W = P.w, H = P.h;
    var size = { text: [W * 0.85, H * 0.12], image: [W * 0.6, W * 0.6], video: [W, H], shape: [W * 0.3, W * 0.3], pianoroll: [W * 0.9, H * 0.3], stepgrid: [W * 0.9, H * 0.25], falling: [W, H * 0.5], noteburst: [W, H * 0.5], spectrum: [W * 0.85, H * 0.15], waveform: [W * 0.85, H * 0.12], player: [W * 0.85, W * 0.5], plugin: [W * 0.6, W * 0.33], progress: [W * 0.8, Math.max(12, H * 0.012)], timer: [W * 0.5, H * 0.06], sparkles: [W, H], adjust: [W, H] }[type] || [W * 0.5, H * 0.2];
    var el = Object.assign({ id: uid('el'), type: type, name: def.label, start: 0, end: Math.max(1, P.duration || 10), anim: newAnim() }, JSON.parse(JSON.stringify(BASE)), { x: W / 2, y: H / 2, w: size[0], h: size[1] }, JSON.parse(JSON.stringify(def.defaults)));
    if (def.midi) applySkin(el, (extra && extra.skin) || DEF_SKIN);
    Object.assign(el, extra || {});
    if (extra && extra.anim) el.anim = upgradeAnim(extra.anim);
    return el;
  }
  function newProject(opts) {
    opts = opts || {};
    var d = ratioDims(opts.ratio || '9:16');
    return { v: 2, id: uid('p'), name: opts.name || 'My short', ratio: opts.ratio || '9:16', w: d[0], h: d[1], fps: 30, duration: 10, autoLength: true, bpm: 140, beatOffset: 0, audio: [], midis: [], bg: { type: 'color', color: '#000000' }, camera: { bounce: 'off', amount: 4, shake: 0, drift: 0 }, transitions: [], layers: [], media: {} };
  }
  function upgradeAnim(A) {
    if (!A) return newAnim();
    if (A.in && typeof A.in === 'object') { var n = newAnim(); ['in', 'out', 'loop'].forEach(function (k) { Object.assign(n[k], A[k] || {}); }); return n; }
    var m = { bounce: 'elastic', zoom: 'zoom-in', wipe: 'wipe-right', flip: 'flip-x' }, o = newAnim();
    o.in.type = m[A.in] || A.in || 'none'; o.in.dur = A.inDur || 0.5; o.out.type = m[A.out] || A.out || 'none'; o.out.dur = A.outDur || 0.4;
    o.loop.type = A.loop || 'none'; o.loop.amt = A.loopAmt == null ? 1 : A.loopAmt; o.loop.every = A.loopEvery || 1; o.loop.speed = A.loopSpeed || 1;
    return o;
  }
  // bring any older project up to v2 so it keeps working
  function upgrade(P) {
    if (!P) return P;
    var d = ratioDims(P.ratio || '9:16'); if (!P.w || !P.h) { P.w = d[0]; P.h = d[1]; }
    if (!Array.isArray(P.audio)) {
      var old = P.audio; P.audio = [];
      if (old && P.media && P.media[old]) P.audio.push({ id: uid('au'), media: old, name: P.media[old].name, start: 0, in: P.audioStart || 0, dur: P.duration || 10, vol: P.audioVol == null ? 100 : P.audioVol, fadeIn: 0, fadeOut: 0, speed: 1 });
    }
    delete P.audioStart; delete P.audioVol;
    P.midis = P.midis || []; P.transitions = P.transitions || []; P.layers = P.layers || []; P.media = P.media || {}; P.camera = P.camera || { bounce: 'off', amount: 4 }; P.bg = P.bg || { type: 'color', color: '#000' };
    if (P.autoLength == null) P.autoLength = false;
    P.layers.forEach(function (el) {
      el.anim = upgradeAnim(el.anim);
      // old colour props → fills (before defaults are filled in)
      if (el.type === 'text' && el.color && !el.fillc) el.fillc = el.gradient ? F(el.color, el.color2) : F(el.color);
      if (el.type === 'shape' && el.fill && typeof el.fill === 'string') el.fillc = el.gradient ? F(el.fill, el.fill2) : F(el.fill);
      if (el.type === 'pianoroll' && el.noteColor) el.noteFill = F(el.noteColor2 || el.noteColor, el.noteColor, { by: el.colorBy || 'velocity' });
      if (el.type === 'stepgrid' && el.onColor) el.cellFill = F(el.onColor, el.onColor2 || el.onColor, { by: 'row' });
      if (el.type === 'falling' && el.noteColor) el.noteFill = F(el.noteColor2 || el.noteColor, el.noteColor, { by: 'pitch' });
      if (el.type === 'noteburst' && el.color) el.burstFill = F(el.color, el.color2 || el.color, { by: 'random' });
      if (el.type === 'spectrum' && el.color) el.barFill = F(el.color, el.color2 || el.color, { by: 'x' });
      if (el.type === 'waveform' && el.wave) el.waveFill = F(el.wave);
      if (el.type === 'sparkles' && el.color) el.sparkFill = F(el.color, el.color2 || el.color, { by: 'random' });
      if (el.type === 'progress' && el.color) el.barFill = F(el.color);
      ['color', 'color2', 'gradient', 'fill', 'fill2', 'noteColor', 'noteColor2', 'colorBy', 'onColor', 'onColor2', 'wave'].forEach(function (k) { if (el.type !== 'timer') delete el[k]; });
      Object.keys(BASE).forEach(function (k) { if (el[k] == null) el[k] = JSON.parse(JSON.stringify(BASE[k])); });
      var def = T[el.type]; if (def) Object.keys(def.defaults).forEach(function (k) { if (el[k] == null) el[k] = JSON.parse(JSON.stringify(def.defaults[k])); });
      if (el.type === 'video') { if (el.trim != null && el.in == null) el.in = el.trim; delete el.trim; if (el.in == null) el.in = 0; if (!el.srcDur) el.srcDur = (el.end - el.start) * (el.speed || 1); if (el.vol == null) el.vol = 0; }
      if (!el.kf) el.kf = {}; if (!el.fx) el.fx = [];
    });
    if (P.fx) { // old project-wide effects → an adjustment layer
      var f = P.fx, list = [];
      if (f.grain > 0) list.push({ id: uid('fx'), type: 'grain', p: { amount: f.grain } }); if (f.vignette > 0) list.push({ id: uid('fx'), type: 'vignette', p: { amount: f.vignette, size: 55 } });
      if (f.bloom > 0) list.push({ id: uid('fx'), type: 'glow', p: { radius: 18, strength: f.bloom } }); if (f.rgb > 0) list.push({ id: uid('fx'), type: 'rgb', p: { amount: f.rgb, angle: 0 } });
      if (f.scanlines > 0) list.push({ id: uid('fx'), type: 'scanlines', p: { amount: f.scanlines, gap: 4 } }); if (f.glitch > 0) list.push({ id: uid('fx'), type: 'glitch', p: { amount: f.glitch }, beat: !!f.glitchOnBeat });
      if (f.tintAmt > 0) list.push({ id: uid('fx'), type: 'tint', p: { color: f.tint, amount: f.tintAmt, blend: 'color' } });
      if (list.length) P.layers.push(newElement('adjust', P, { name: 'Effects', fx: list, start: 0, end: P.duration }));
      if (f.texture && f.texOpacity > 0) P.overlay = { src: f.texture, blend: f.texBlend || 'overlay', opacity: f.texOpacity };
      delete P.fx;
    }
    P.v = 2;
    return P;
  }
  function contentEnd(P) { var e = 0; (P.layers || []).forEach(function (l) { if (l.end > e) e = l.end; }); (P.audio || []).forEach(function (c) { var x = c.start + c.dur / (c.speed || 1); if (x > e) e = x; }); return e; }

  /* =========================================================
     STARTER TEMPLATES (used as starting points in the admin template builder)
     ========================================================= */
  function L(P, type, props) { return newElement(type, P, props); }
  var TEMPLATES = [
    { id: 'blank', name: 'Blank', desc: 'Start from nothing', build: function () { return newProject({ name: 'Untitled' }); } },
    { id: 'midi-pink', name: 'MIDI roll (pink)', desc: 'Piano roll + caption on soft clouds', build: function () {
      var P = newProject({ name: 'MIDI roll' }); P.bpm = 143; P.duration = 12; P.autoLength = false;
      P.bg = { type: 'clouds', color: '#ecebf1', color2: '#ffb3d6', color3: '#ffffff', color4: '#d2cfdc', speed: 0.6 };
      P.camera = { bounce: 'beat', amount: 1.5 };
      P.layers = [
        L(P, 'pianoroll', { name: 'Piano roll', x: 540, y: 1300, w: 960, h: 620, label: 'MELODY', anim: { in: { type: 'pop', dur: 0.5 } } }),
        L(P, 'text', { name: 'Caption', x: 540, y: 420, w: 940, h: 420, text: 'HOW I MADE\n*this melody*', font: 'Luckiest Guy', size: 120, fillc: F('#ffffff'), stroke: 10, strokeColor: '#ff2a7a', accentColor: '#ff2a7a', accentFont: 'UnifrakturMaguntia', accentGlow: 22, reveal: 'word', revealDur: 1.4, anim: { loop: { type: 'beat-bounce', amt: 0.4 } } })
      ];
      return P;
    } },
    { id: 'neon-keys', name: 'Neon keys', desc: 'Falling notes onto a glowing keyboard', build: function () {
      var P = newProject({ name: 'Neon keys' }); P.bpm = 140; P.duration = 12; P.autoLength = false;
      P.bg = { type: 'gradient', fillc: F('#120625', '#2b0b4a', { angle: 180 }) }; P.camera = { bounce: 'beat', amount: 2 };
      P.layers = [L(P, 'falling', { name: 'Falling notes', x: 540, y: 1180, w: 1080, h: 1240, noteFill: F('#38c8ff', '#ff3fc8', { by: 'pitch', anim: 'flow', speed: 0.5 }) }),
        L(P, 'text', { name: 'Title', x: 540, y: 300, w: 900, h: 200, text: 'NIGHT *keys*', font: 'Bungee', size: 120, accentColor: '#38c8ff', accentFont: 'Monoton', accentGlow: 30 }),
        L(P, 'adjust', { name: 'Glow + grain', fx: [{ id: uid('fx'), type: 'glow', p: { radius: 20, strength: 60 } }, { id: uid('fx'), type: 'vignette', p: { amount: 45, size: 55 } }, { id: uid('fx'), type: 'grain', p: { amount: 15 } }] })];
      return P;
    } }
  ];

  window.ShortCore = {
    T: T, TEMPLATES: TEMPLATES, FONTS: FONTS, IN_ANIMS: IN_ANIMS, LOOP_ANIMS: LOOP_ANIMS, TRANSITIONS: TRANSITIONS, FX: FX, FX_CATS: FX_CATS, EASE_PRESETS: EASE_PRESETS, SPEED_PRESETS: SPEED_PRESETS, KF_PROPS: KF_PROPS, RATIOS: RATIOS,
    parseMidi: parseMidi, demoMidi: demoMidi, Analysis: Analysis, midiNotes: midiNotes, filterNotes: filterNotes, beatPos: beatPos, beatEnv: beatEnv,
    SKINS: SKIN_LIST, skinList: skinList, setSkins: setSkins, skinFromEl: skinFromEl, applySkin: applySkin, setTheme: setTheme, THEME: THEME,
    renderFrame: renderFrame, newProject: newProject, newElement: newElement, newAnim: newAnim, upgrade: upgrade, contentEnd: contentEnd, uid: uid, ensureFont: ensureFont, addFontFace: addFontFace, fmtTime: fmtTime, mk: mk, clamp: clamp, noteName: noteName,
    fill: fill, colorAt: colorAt, paint: paint, easeFn: easeFn, kfValue: kfValue, prop: prop, fxDefaults: fxDefaults, runFx: runFx,
    speedAt: speedAt, avgSpeed: avgSpeed, srcTime: srcTime, setLengthFromSpeed: setLengthFromSpeed, audioSources: audioSources, scheduleAudio: scheduleAudio, renderMix: renderMix, ratioDims: ratioDims, MP4: MP4
  };
})();
