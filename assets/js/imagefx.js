/* =========================================================
   SUL0557 — Image FX engine (used by the Tools pages)
   Everything runs in the visitor's browser on a <canvas>:
   dithering, Y2K magazine covers, glow, textures + blend modes,
   and a big stack of creative effects. No uploads to any server.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- basics ---------- */
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function ctx(c) { return c.getContext('2d', { willReadFrequently: true }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clone(c) { var o = mk(c.width, c.height); o.getContext('2d').drawImage(c, 0, 0); return o; }
  function data(c) { return ctx(c).getImageData(0, 0, c.width, c.height); }
  function put(c, id) { ctx(c).putImageData(id, 0, 0); return c; }
  function hex(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var url = src, revoke = false;
      if (src instanceof Blob) { url = URL.createObjectURL(src); revoke = true; }
      var im = new Image();
      im.onload = function () { if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 1000); res(im); };
      im.onerror = function () { if (revoke) URL.revokeObjectURL(url); rej(new Error('Could not read that image')); };
      im.src = url;
    });
  }
  function toCanvas(img, maxSide) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var k = maxSide ? Math.min(1, maxSide / Math.max(w, h)) : 1;
    var c = mk(w * k, h * k), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /* ---------- blur (3-pass box ≈ gaussian, works in every browser) ---------- */
  function boxBlurH(src, dst, w, h, r) {
    var iarr = 1 / (r + r + 1);
    for (var i = 0; i < h; i++) {
      for (var ch = 0; ch < 4; ch++) {
        var ti = i * w, li = ti, ri = ti + r, fv = src[ti * 4 + ch], lv = src[(ti + w - 1) * 4 + ch], val = (r + 1) * fv;
        for (var j = 0; j < r; j++) val += src[(ti + Math.min(j, w - 1)) * 4 + ch];
        for (j = 0; j <= r; j++) { val += src[Math.min(ri, ti + w - 1) * 4 + ch] - fv; dst[ti * 4 + ch] = val * iarr; ri++; ti++; }
        for (j = r + 1; j < w - r; j++) { val += src[ri * 4 + ch] - src[li * 4 + ch]; dst[ti * 4 + ch] = val * iarr; ri++; li++; ti++; }
        for (j = w - r; j < w; j++) { val += lv - src[Math.max(li, i * w) * 4 + ch]; dst[ti * 4 + ch] = val * iarr; li++; ti++; }
      }
    }
  }
  function boxBlurV(src, dst, w, h, r) {
    var iarr = 1 / (r + r + 1);
    for (var i = 0; i < w; i++) {
      for (var ch = 0; ch < 4; ch++) {
        var ti = i, li = ti, ri = ti + r * w, fv = src[ti * 4 + ch], lv = src[(ti + w * (h - 1)) * 4 + ch], val = (r + 1) * fv;
        for (var j = 0; j < r; j++) val += src[(ti + Math.min(j, h - 1) * w) * 4 + ch];
        for (j = 0; j <= r; j++) { val += src[Math.min(ri, i + w * (h - 1)) * 4 + ch] - fv; dst[ti * 4 + ch] = val * iarr; ri += w; ti += w; }
        for (j = r + 1; j < h - r; j++) { val += src[ri * 4 + ch] - src[li * 4 + ch]; dst[ti * 4 + ch] = val * iarr; li += w; ri += w; ti += w; }
        for (j = h - r; j < h; j++) { val += lv - src[Math.max(li, i) * 4 + ch]; dst[ti * 4 + ch] = val * iarr; li += w; ti += w; }
      }
    }
  }
  function blurCanvas(c, radius) {
    radius = Math.round(radius);
    if (radius < 1) return clone(c);
    var w = c.width, h = c.height;
    radius = Math.min(radius, Math.floor(Math.min(w, h) / 2) - 1);
    if (radius < 1) return clone(c);
    var id = data(c), a = new Float32Array(id.data), b = new Float32Array(a.length);
    var rr = Math.max(1, Math.round(radius / 1.8));
    for (var p = 0; p < 3; p++) { boxBlurH(a, b, w, h, rr); boxBlurV(b, a, w, h, rr); }
    var out = mk(w, h), od = new ImageData(w, h);
    for (var i = 0; i < a.length; i++) od.data[i] = a[i];
    return put(out, od);
  }

  /* ---------- tone adjust ---------- */
  function adjustData(d, o) {
    var br = (o.brightness || 0) * 2.55, ct = o.contrast || 0, sat = o.saturation == null ? 0 : o.saturation;
    var cf = (259 * (ct + 255)) / (255 * (259 - ct)), sf = 1 + sat / 100;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      if (sat) { var l = lum(r, g, b); r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf; }
      if (ct) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128; }
      d[i] = r + br; d[i + 1] = g + br; d[i + 2] = b + br;
    }
  }
  function adjust(c, o) { var out = clone(c), id = data(out); adjustData(id.data, o || {}); return put(out, id); }

  /* =========================================================
     DITHERING
     ========================================================= */
  var PALETTES = {
    '1bit': { name: 'Black & white', colors: ['#000000', '#ffffff'] },
    'gameboy': { name: 'Gameboy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
    'sul': { name: 'SUL candy', colors: ['#2a1240', '#8a3cff', '#ff3fc8', '#38c8ff', '#ffe14d', '#ffffff'] },
    'pico8': { name: 'PICO-8', colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'] },
    'cga': { name: 'CGA', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
    'gray4': { name: 'Grayscale (4)', colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },
    'mac': { name: 'Old Mac', colors: ['#000000', '#ffffff'] },
    'vapor': { name: 'Vaporwave', colors: ['#1a0533', '#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'] },
    'sepia': { name: 'Sepia print', colors: ['#2b1d0e', '#704214', '#c49a6c', '#f4e4c1'] },
    'cmyk': { name: 'CMYK', colors: ['#ffffff', '#00ffff', '#ff00ff', '#ffff00', '#000000'] }
  };
  var KERNELS = {
    floyd: { div: 16, k: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
    atkinson: { div: 8, k: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
    jarvis: { div: 48, k: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
    stucki: { div: 42, k: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]] },
    burkes: { div: 32, k: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
    sierra: { div: 32, k: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]] },
    sierralite: { div: 4, k: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] }
  };
  var DITHER_ALGOS = [['floyd', 'Floyd–Steinberg'], ['atkinson', 'Atkinson (Mac)'], ['jarvis', 'Jarvis-Judice-Ninke'], ['stucki', 'Stucki'], ['burkes', 'Burkes'], ['sierra', 'Sierra'], ['sierralite', 'Sierra Lite'], ['bayer2', 'Bayer 2×2'], ['bayer4', 'Bayer 4×4'], ['bayer8', 'Bayer 8×8'], ['noise', 'Random noise'], ['threshold', 'Threshold (no dither)']];
  function bayer(n) {
    var m = [[0, 2], [3, 1]];
    while (m.length < n) {
      var s = m.length, nm = [];
      for (var y = 0; y < s * 2; y++) { nm.push([]); for (var x = 0; x < s * 2; x++) { var q = (y < s ? 0 : 2) + (x < s ? 0 : 1); q = [0, 2, 3, 1][q]; nm[y].push(4 * m[y % s][x % s] + q); } }
      m = nm;
    }
    return m;
  }
  function nearest(pal, r, g, b) {
    var best = 0, bd = 1e12;
    for (var i = 0; i < pal.length; i++) {
      var p = pal[i], dr = r - p[0], dg = g - p[1], db = b - p[2];
      var d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bd) { bd = d; best = i; }
    }
    return pal[best];
  }
  // opts: { algo, palette: key|'levels'|'custom', colors:[hex], levels, scale, strength, serpentine, brightness, contrast }
  function dither(src, o) {
    o = o || {};
    var scale = clamp(Math.round(o.scale || 1), 1, 16);
    var w = Math.max(1, Math.round(src.width / scale)), h = Math.max(1, Math.round(src.height / scale));
    var small = mk(w, h), sg = small.getContext('2d');
    sg.imageSmoothingQuality = 'high'; sg.drawImage(src, 0, 0, w, h);
    var id = data(small), d = id.data;
    adjustData(d, { brightness: o.brightness || 0, contrast: o.contrast || 0 });
    var pal;
    if (o.palette === 'levels') pal = null;
    else if (o.palette === 'custom') pal = (o.colors && o.colors.length ? o.colors : ['#000', '#fff']).map(hex);
    else pal = (PALETTES[o.palette] || PALETTES['1bit']).colors.map(hex);
    var lv = clamp(Math.round(o.levels || 2), 2, 16), step = 255 / (lv - 1);
    var q = pal ? function (r, g, b) { return nearest(pal, r, g, b); } : function (r, g, b) { return [Math.round(clamp(r, 0, 255) / step) * step, Math.round(clamp(g, 0, 255) / step) * step, Math.round(clamp(b, 0, 255) / step) * step]; };
    var strength = o.strength == null ? 1 : clamp(o.strength, 0, 1.5);
    var algo = o.algo || 'floyd';
    var f = new Float32Array(w * h * 3), i, x, y, p;
    for (i = 0, p = 0; i < d.length; i += 4, p += 3) { f[p] = d[i]; f[p + 1] = d[i + 1]; f[p + 2] = d[i + 2]; }
    if (KERNELS[algo]) {
      var K = KERNELS[algo], serp = o.serpentine !== false;
      for (y = 0; y < h; y++) {
        var rev = serp && (y & 1), xs = rev ? w - 1 : 0, xe = rev ? -1 : w, dx = rev ? -1 : 1;
        for (x = xs; x !== xe; x += dx) {
          p = (y * w + x) * 3;
          var or = f[p], og = f[p + 1], ob = f[p + 2], c = q(or, og, ob);
          var er = (or - c[0]) * strength, eg = (og - c[1]) * strength, eb = (ob - c[2]) * strength;
          f[p] = c[0]; f[p + 1] = c[1]; f[p + 2] = c[2];
          for (var k = 0; k < K.k.length; k++) {
            var kx = x + (rev ? -K.k[k][0] : K.k[k][0]), ky = y + K.k[k][1];
            if (kx < 0 || kx >= w || ky >= h) continue;
            var pp = (ky * w + kx) * 3, wgt = K.k[k][2] / K.div;
            f[pp] += er * wgt; f[pp + 1] += eg * wgt; f[pp + 2] += eb * wgt;
          }
        }
      }
    } else {
      var M = null, mn = 0, rand = rng(1234);
      if (algo === 'bayer2') M = bayer(2); else if (algo === 'bayer4') M = bayer(4); else if (algo === 'bayer8') M = bayer(8);
      if (M) mn = M.length;
      var spread = pal ? 255 / Math.max(1, Math.cbrt(pal.length) * 1.2) : step;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        p = (y * w + x) * 3;
        var t = 0;
        if (M) t = ((M[y % mn][x % mn] + 0.5) / (mn * mn) - 0.5) * spread * strength;
        else if (algo === 'noise') t = (rand() - 0.5) * spread * strength;
        var cc = q(f[p] + t, f[p + 1] + t, f[p + 2] + t);
        f[p] = cc[0]; f[p + 1] = cc[1]; f[p + 2] = cc[2];
      }
    }
    for (i = 0, p = 0; i < d.length; i += 4, p += 3) { d[i] = f[p]; d[i + 1] = f[p + 1]; d[i + 2] = f[p + 2]; }
    put(small, id);
    var out = mk(src.width, src.height), og2 = out.getContext('2d');
    og2.imageSmoothingEnabled = false;
    og2.drawImage(small, 0, 0, out.width, out.height);
    return out;
  }

  /* =========================================================
     GLOW
     ========================================================= */
  // mode: bloom | soft | neon | halation | outer | glints
  function glow(src, o) {
    o = o || {};
    var mode = o.mode || 'bloom', amt = (o.intensity == null ? 60 : o.intensity) / 100, rad = Math.max(1, o.radius || 18), thr = o.threshold == null ? 170 : o.threshold;
    var col = hex(o.color || '#ff3fc8');
    var w = src.width, h = src.height, out = clone(src), g = out.getContext('2d');
    var layer = mk(w, h), ld, lid, i;
    if (mode === 'bloom' || mode === 'halation' || mode === 'glints') {
      lid = data(src); ld = lid.data;
      for (i = 0; i < ld.length; i += 4) {
        var L = lum(ld[i], ld[i + 1], ld[i + 2]), k = clamp((L - thr) / Math.max(1, 255 - thr), 0, 1);
        if (mode === 'halation') { ld[i] = 255 * k; ld[i + 1] = 60 * k; ld[i + 2] = 30 * k; }
        else { ld[i] *= k; ld[i + 1] *= k; ld[i + 2] *= k; }
      }
      put(layer, lid);
    } else if (mode === 'soft') {
      layer = clone(src);
    } else if (mode === 'neon') {
      lid = data(src); ld = lid.data;
      var e = edges(lid.data, w, h);
      for (i = 0; i < ld.length; i += 4) { var v = clamp(e[i >> 2] * 2.2, 0, 255) / 255; ld[i] = col[0] * v; ld[i + 1] = col[1] * v; ld[i + 2] = col[2] * v; ld[i + 3] = 255; }
      put(layer, lid);
    } else if (mode === 'outer') {
      lid = data(src); ld = lid.data;
      for (i = 0; i < ld.length; i += 4) { var a = ld[i + 3]; ld[i] = col[0]; ld[i + 1] = col[1]; ld[i + 2] = col[2]; ld[i + 3] = a; }
      put(layer, lid);
      var bl = blurCanvas(layer, rad), res = mk(w, h), rg = res.getContext('2d');
      for (var t = 0; t < Math.ceil(amt * 3); t++) rg.drawImage(bl, 0, 0);
      rg.globalAlpha = 1; rg.drawImage(src, 0, 0);
      return res;
    }
    if (mode === 'glints') {
      // cross-shaped star flares on the brightest spots
      var gl = mk(w, h), gg = gl.getContext('2d'), pts = [], d2 = data(src).data, stepPx = Math.max(6, Math.round(Math.min(w, h) / 60));
      for (var y = 0; y < h; y += stepPx) for (var x = 0; x < w; x += stepPx) { var q = (y * w + x) * 4, LL = lum(d2[q], d2[q + 1], d2[q + 2]); if (LL > thr + 40) pts.push([x, y, LL]); }
      pts.sort(function (A, B) { return B[2] - A[2]; });
      pts = pts.slice(0, clamp(Math.round(o.count || 18), 1, 80));
      gg.globalCompositeOperation = 'lighter';
      pts.forEach(function (pt) {
        var len = rad * 4 * (0.6 + (pt[2] - thr) / 255);
        [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]].forEach(function (dir, di) {
          var L2 = di < 2 ? len : len * 0.45;
          var grd = gg.createLinearGradient(pt[0] - dir[0] * L2, pt[1] - dir[1] * L2, pt[0] + dir[0] * L2, pt[1] + dir[1] * L2);
          grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(' + col.join(',') + ',0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
          gg.strokeStyle = grd; gg.lineWidth = Math.max(1, rad / 8);
          gg.beginPath(); gg.moveTo(pt[0] - dir[0] * L2, pt[1] - dir[1] * L2); gg.lineTo(pt[0] + dir[0] * L2, pt[1] + dir[1] * L2); gg.stroke();
        });
        var rgd = gg.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], rad);
        rgd.addColorStop(0, 'rgba(255,255,255,0.9)'); rgd.addColorStop(1, 'rgba(255,255,255,0)');
        gg.fillStyle = rgd; gg.beginPath(); gg.arc(pt[0], pt[1], rad, 0, 6.3); gg.fill();
      });
      g.globalCompositeOperation = 'screen'; g.globalAlpha = clamp(amt * 1.3, 0, 1);
      g.drawImage(blurCanvas(layer, rad), 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'lighter'; g.drawImage(gl, 0, 0);
      g.globalCompositeOperation = 'source-over';
      return out;
    }
    var blurred = blurCanvas(layer, rad);
    g.globalCompositeOperation = mode === 'soft' ? 'screen' : 'lighter';
    g.globalAlpha = clamp(amt, 0, 1);
    g.drawImage(blurred, 0, 0);
    if (amt > 1) { g.globalAlpha = clamp(amt - 1, 0, 1); g.drawImage(blurred, 0, 0); }
    if (mode === 'neon') { g.globalAlpha = 1; g.drawImage(layer, 0, 0); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return out;
  }
  function edges(d, w, h) {
    var gray = new Float32Array(w * h), e = new Float32Array(w * h), i, x, y;
    for (i = 0; i < w * h; i++) gray[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      var p = y * w + x;
      var gx = -gray[p - w - 1] - 2 * gray[p - 1] - gray[p + w - 1] + gray[p - w + 1] + 2 * gray[p + 1] + gray[p + w + 1];
      var gy = -gray[p - w - 1] - 2 * gray[p - w] - gray[p - w + 1] + gray[p + w - 1] + 2 * gray[p + w] + gray[p + w + 1];
      e[p] = Math.sqrt(gx * gx + gy * gy) / 4;
    }
    return e;
  }

  /* =========================================================
     TEXTURES + BLEND MODES
     ========================================================= */
  var BLENDS = [['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['hard-light', 'Hard light'], ['color-dodge', 'Color dodge'], ['color-burn', 'Color burn'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'], ['source-over', 'Normal'], ['lighter', 'Add (glow)']];
  // built-in textures, drawn by code so they always work
  var BUILTIN_TEX = [
    ['paper', 'Paper grain'], ['grain', 'Film grain'], ['halftone', 'Halftone dots'], ['scratches', 'Scratches'], ['dust', 'Dust'],
    ['vhs', 'VHS lines'], ['grid', 'Pixel grid'], ['glitter', 'Glitter'], ['holo', 'Holo foil'], ['crumple', 'Crumpled'], ['canvas', 'Canvas weave'], ['stars', 'Sparkles']
  ];
  function builtinTexture(name, w, h) {
    var c = mk(w, h), g = c.getContext('2d'), r = rng(name.length * 977 + w), i, x, y;
    var id, d;
    switch (name) {
      case 'paper': case 'grain': case 'dust':
        id = g.createImageData(w, h); d = id.data;
        for (i = 0; i < d.length; i += 4) { var v = name === 'paper' ? 200 + r() * 55 : 128 + (r() - 0.5) * (name === 'grain' ? 160 : 30); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        g.putImageData(id, 0, 0);
        if (name === 'paper') { var b = blurCanvas(c, 2); g.drawImage(b, 0, 0); g.globalAlpha = 0.35; for (i = 0; i < w * h / 900; i++) { g.fillStyle = 'rgba(120,100,80,' + r() * 0.3 + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } g.globalAlpha = 1; }
        if (name === 'dust') { for (i = 0; i < w * h / 700; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.8)'; var s = r() * 3 + 0.5; g.beginPath(); g.arc(r() * w, r() * h, s, 0, 6.3); g.fill(); } for (i = 0; i < 25; i++) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); var sx = r() * w, sy = r() * h; g.moveTo(sx, sy); g.quadraticCurveTo(sx + r() * 30, sy + r() * 30, sx + r() * 40 - 20, sy + r() * 40); g.stroke(); } }
        break;
      case 'halftone':
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000';
        var cs = Math.max(6, Math.round(Math.min(w, h) / 70));
        for (y = 0; y < h + cs; y += cs) for (x = 0; x < w + cs; x += cs) { var rr = cs * 0.45 * (0.4 + 0.6 * ((x / w + y / h) / 2)); g.beginPath(); g.arc(x + ((y / cs) & 1 ? cs / 2 : 0), y, rr, 0, 6.3); g.fill(); }
        break;
      case 'scratches':
        g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
        for (i = 0; i < 160; i++) { g.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,' + (0.3 + r() * 0.6) + ')' : 'rgba(0,0,0,' + (0.3 + r() * 0.5) + ')'; g.lineWidth = r() * 1.6 + 0.3; g.beginPath(); x = r() * w; y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * w * 0.3, y + (r() - 0.5) * h * 0.6); g.stroke(); }
        break;
      case 'vhs':
        g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
        for (y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 1); }
        for (i = 0; i < 8; i++) { var yy = r() * h, hh = 2 + r() * 10; g.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.4) + ')'; g.fillRect(0, yy, w, hh); }
        break;
      case 'grid':
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.55)';
        var gs = Math.max(4, Math.round(Math.min(w, h) / 90));
        for (x = 0; x < w; x += gs) g.fillRect(x, 0, 1, h);
        for (y = 0; y < h; y += gs) g.fillRect(0, y, w, 1);
        break;
      case 'glitter':
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        for (i = 0; i < w * h / 120; i++) { var hue = r() * 360; g.fillStyle = 'hsla(' + hue + ',90%,' + (50 + r() * 50) + '%,' + r() + ')'; var sz = r() * 3 + 1; g.fillRect(r() * w, r() * h, sz, sz); }
        break;
      case 'holo':
        var gr = g.createLinearGradient(0, 0, w, h);
        ['#ff9be6', '#b99bff', '#8fe3ff', '#fff6a8', '#ffb3ec', '#9bffd9', '#b99bff'].forEach(function (cc, k, arr) { gr.addColorStop(k / (arr.length - 1), cc); });
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.4;
        for (i = 0; i < 30; i++) { g.strokeStyle = i % 2 ? '#fff' : '#c9a8ff'; g.lineWidth = 10 + r() * 30; g.beginPath(); g.moveTo(-w * 0.2 + i * w / 15, 0); g.bezierCurveTo(w * 0.3, h * 0.3, w * 0.6, h * 0.7, -w * 0.2 + i * w / 15 + w * 0.4, h); g.stroke(); }
        g.globalAlpha = 1;
        break;
      case 'crumple':
        g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
        for (i = 0; i < 70; i++) { var ax = r() * w, ay = r() * h, ang = r() * 6.3, len = Math.max(w, h) * (0.2 + r() * 0.6); var lg = g.createLinearGradient(ax, ay, ax + Math.cos(ang + 1.57) * 30, ay + Math.sin(ang + 1.57) * 30); lg.addColorStop(0, 'rgba(255,255,255,.35)'); lg.addColorStop(1, 'rgba(0,0,0,.25)'); g.strokeStyle = lg; g.lineWidth = 2 + r() * 10; g.beginPath(); g.moveTo(ax - Math.cos(ang) * len / 2, ay - Math.sin(ang) * len / 2); g.lineTo(ax + Math.cos(ang) * len / 2, ay + Math.sin(ang) * len / 2); g.stroke(); }
        g.drawImage(blurCanvas(c, 3), 0, 0);
        break;
      case 'canvas':
        g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
        for (y = 0; y < h; y += 4) for (x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)'; g.fillRect(x, y, 4, 2); }
        break;
      case 'stars':
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        for (i = 0; i < Math.max(12, w * h / 9000); i++) {
          var cx = r() * w, cy = r() * h, s2 = 3 + r() * Math.min(w, h) / 30;
          g.fillStyle = '#fff'; g.beginPath();
          for (var k = 0; k < 8; k++) { var a2 = k * Math.PI / 4, rad2 = k % 2 ? s2 * 0.25 : s2; g.lineTo(cx + Math.cos(a2) * rad2, cy + Math.sin(a2) * rad2); }
          g.fill();
        }
        break;
    }
    return c;
  }
  // tex: canvas/image. o: { mode, opacity, scale, rotate, flipX, flipY, invert, fit:'cover'|'tile' }
  function applyTexture(src, tex, o) {
    o = o || {};
    var w = src.width, h = src.height, out = clone(src), g = out.getContext('2d');
    var layer = mk(w, h), lg = layer.getContext('2d');
    var tw = tex.naturalWidth || tex.width, th = tex.naturalHeight || tex.height;
    var sc = (o.scale || 100) / 100;
    lg.save();
    lg.translate(w / 2, h / 2);
    lg.rotate((o.rotate || 0) * Math.PI / 180);
    lg.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
    if (o.fit === 'tile') {
      var pat = lg.createPattern(tex, 'repeat'), diag = Math.sqrt(w * w + h * h);
      lg.scale(sc, sc);
      lg.fillStyle = pat; lg.fillRect(-diag / sc, -diag / sc, diag * 2 / sc, diag * 2 / sc);
    } else {
      var k = Math.max(w / tw, h / th) * sc * (o.rotate ? 1.45 : 1);
      lg.drawImage(tex, -tw * k / 2, -th * k / 2, tw * k, th * k);
    }
    lg.restore();
    if (o.invert) { var id = data(layer), d = id.data; for (var i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } put(layer, id); }
    g.globalAlpha = clamp((o.opacity == null ? 70 : o.opacity) / 100, 0, 1);
    g.globalCompositeOperation = o.mode || 'overlay';
    g.drawImage(layer, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    if (o.keepAlpha !== false) g.drawImage(src, 0, 0); // keep transparent areas transparent
    g.globalCompositeOperation = 'source-over';
    return out;
  }

  /* =========================================================
     CREATIVE EFFECTS (stackable)
     ========================================================= */
  function px(c, fn) { var out = clone(c), id = data(out); fn(id.data, c.width, c.height, id); return put(out, id); }
  var EFFECTS = {
    pixelate: { name: 'Pixelate', params: [['size', 'Pixel size', 2, 64, 1, 10]], apply: function (c, p) { var s = Math.max(1, p.size), sm = mk(c.width / s, c.height / s); sm.getContext('2d').drawImage(c, 0, 0, sm.width, sm.height); var o = mk(c.width, c.height), g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(sm, 0, 0, o.width, o.height); return o; } },
    rgbsplit: { name: 'RGB split', params: [['amount', 'Distance', 0, 60, 1, 8], ['angle', 'Angle', 0, 360, 1, 0]], apply: function (c, p) { var a = p.angle * Math.PI / 180, dx = Math.round(Math.cos(a) * p.amount), dy = Math.round(Math.sin(a) * p.amount); var src = data(c).data, w = c.width, h = c.height; return px(c, function (d) { for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4, xr = clamp(x + dx, 0, w - 1), yr = clamp(y + dy, 0, h - 1), xb = clamp(x - dx, 0, w - 1), yb = clamp(y - dy, 0, h - 1); d[i] = src[(yr * w + xr) * 4]; d[i + 2] = src[(yb * w + xb) * 4 + 2]; } }); } },
    glitch: { name: 'Glitch slices', params: [['amount', 'Amount', 0, 100, 1, 40], ['seed', 'Randomness', 1, 999, 1, 7]], apply: function (c, p) { var o = clone(c), g = o.getContext('2d'), r = rng(p.seed), n = Math.round(p.amount / 4) + 2; for (var i = 0; i < n; i++) { var y = r() * c.height, hh = 2 + r() * c.height / 12, off = (r() - 0.5) * c.width * p.amount / 250; g.drawImage(c, 0, y, c.width, hh, off, y, c.width, hh); } if (p.amount > 30) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25; g.drawImage(EFFECTS.rgbsplit.apply(c, { amount: p.amount / 8, angle: 0 }), 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; } return o; } },
    vhs: { name: 'VHS', params: [['amount', 'Amount', 0, 100, 1, 60]], apply: function (c, p) { var a = p.amount / 100; var o = EFFECTS.rgbsplit.apply(c, { amount: Math.round(3 + 6 * a), angle: 0 }); o = px(o, function (d, w, h) { var r = rng(3); for (var y = 0; y < h; y++) { var line = (y % 3 === 0) ? 0.82 : 1, wob = Math.sin(y / 9) * 6 * a; for (var x = 0; x < w; x++) { var i = (y * w + x) * 4, n = (r() - 0.5) * 50 * a; d[i] = d[i] * line + n + wob; d[i + 1] = d[i + 1] * line + n; d[i + 2] = d[i + 2] * line + n + 8 * a; } } }); return EFFECTS.glitch.apply(o, { amount: 20 * a, seed: 11 }); } },
    scanlines: { name: 'Scanlines', params: [['gap', 'Line gap', 2, 12, 1, 3], ['dark', 'Darkness', 0, 100, 1, 40]], apply: function (c, p) { return px(c, function (d, w, h) { for (var y = 0; y < h; y++) if (y % p.gap === 0) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4, k = 1 - p.dark / 100; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } }); } },
    halftone: { name: 'Halftone', params: [['size', 'Dot size', 3, 40, 1, 8], ['color', 'Colour dots (0/1)', 0, 1, 1, 0]], apply: function (c, p) { var s = p.size, o = mk(c.width, c.height), g = o.getContext('2d'), d = data(c).data, w = c.width; g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); for (var y = 0; y < c.height; y += s) for (var x = 0; x < c.width; x += s) { var i = (Math.min(c.height - 1, Math.round(y + s / 2)) * w + Math.min(w - 1, Math.round(x + s / 2))) * 4; var L = lum(d[i], d[i + 1], d[i + 2]); var r = (1 - L / 255) * s * 0.72; if (r < 0.3) continue; g.fillStyle = p.color ? 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')' : '#111'; g.beginPath(); g.arc(x + s / 2, y + s / 2, r, 0, 6.3); g.fill(); } return o; } },
    duotone: { name: 'Duotone', params: [['c1', 'Shadows', 0, 0, 0, '#2a1240', 'color'], ['c2', 'Highlights', 0, 0, 0, '#ff3fc8', 'color']], apply: function (c, p) { var a = hex(p.c1), b = hex(p.c2); return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var t = lum(d[i], d[i + 1], d[i + 2]) / 255; d[i] = a[0] + (b[0] - a[0]) * t; d[i + 1] = a[1] + (b[1] - a[1]) * t; d[i + 2] = a[2] + (b[2] - a[2]) * t; } }); } },
    holomap: { name: 'Holo gradient map', params: [['mix', 'Strength', 0, 100, 1, 80]], apply: function (c, p) { var stops = ['#1a0533', '#8a3cff', '#ff3fc8', '#ffb3ec', '#8fe3ff', '#fff6a8'].map(hex), m = p.mix / 100; return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var t = lum(d[i], d[i + 1], d[i + 2]) / 255 * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)), f = t - k, A = stops[k], B = stops[k + 1]; for (var ch = 0; ch < 3; ch++) d[i + ch] = d[i + ch] * (1 - m) + (A[ch] + (B[ch] - A[ch]) * f) * m; } }); } },
    posterize: { name: 'Posterize', params: [['levels', 'Levels', 2, 12, 1, 4]], apply: function (c, p) { var st = 255 / (p.levels - 1); return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / st) * st; d[i + 1] = Math.round(d[i + 1] / st) * st; d[i + 2] = Math.round(d[i + 2] / st) * st; } }); } },
    threshold: { name: 'Threshold', params: [['level', 'Cut-off', 0, 255, 1, 128]], apply: function (c, p) { return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var v = lum(d[i], d[i + 1], d[i + 2]) >= p.level ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; } }); } },
    invert: { name: 'Invert', params: [], apply: function (c) { return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } }); } },
    mirror: { name: 'Mirror', params: [['mode', 'Left→right / Top→bottom / 4-way (0/1/2)', 0, 2, 1, 0]], apply: function (c, p) { var o = clone(c), g = o.getContext('2d'), w = c.width, h = c.height; g.save(); if (p.mode == 0 || p.mode == 2) { g.translate(w, 0); g.scale(-1, 1); g.drawImage(c, 0, 0, w / 2, h, 0, 0, w / 2, h); g.restore(); g.save(); } if (p.mode == 1 || p.mode == 2) { var src2 = clone(o); g.setTransform(1, 0, 0, -1, 0, h); g.drawImage(src2, 0, 0, w, h / 2, 0, 0, w, h / 2); } g.restore(); return o; } },
    kaleido: { name: 'Kaleidoscope', params: [['slices', 'Slices', 3, 16, 1, 6], ['turn', 'Rotate', 0, 360, 1, 0]], apply: function (c, p) { var w = c.width, h = c.height, o = mk(w, h), g = o.getContext('2d'), n = Math.round(p.slices) * 2, ang = 2 * Math.PI / n, R = Math.sqrt(w * w + h * h) / 2; for (var i = 0; i < n; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate((i % 2 ? i + 1 : i) * ang + p.turn * Math.PI / 180); if (i % 2) g.scale(1, -1); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -0.01, ang + 0.01); g.closePath(); g.clip(); var sc = 2 * R / Math.min(w, h); g.drawImage(c, -w * sc / 2, -h * sc / 2, w * sc, h * sc); g.restore(); } return o; } },
    noise: { name: 'Grain / noise', params: [['amount', 'Amount', 0, 100, 1, 30], ['mono', 'Black & white grain (0/1)', 0, 1, 1, 1]], apply: function (c, p) { var r = rng(5); return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * p.amount * 2.4; if (p.mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; } else { d[i] += (r() - 0.5) * p.amount * 2.4; d[i + 1] += (r() - 0.5) * p.amount * 2.4; d[i + 2] += (r() - 0.5) * p.amount * 2.4; } } }); } },
    vignette: { name: 'Vignette', params: [['amount', 'Darkness', 0, 100, 1, 50], ['size', 'Size', 10, 100, 1, 60]], apply: function (c, p) { var o = clone(c), g = o.getContext('2d'), w = c.width, h = c.height, R = Math.sqrt(w * w + h * h) / 2; var gr = g.createRadialGradient(w / 2, h / 2, R * p.size / 100 * 0.5, w / 2, h / 2, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + p.amount / 100 + ')'); g.fillStyle = gr; g.fillRect(0, 0, w, h); return o; } },
    sepia: { name: 'Sepia', params: [['amount', 'Strength', 0, 100, 1, 80]], apply: function (c, p) { var m = p.amount / 100; return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var r = d[i], g = d[i + 1], b = d[i + 2]; d[i] = r * (1 - m) + (r * 0.393 + g * 0.769 + b * 0.189) * m; d[i + 1] = g * (1 - m) + (r * 0.349 + g * 0.686 + b * 0.168) * m; d[i + 2] = b * (1 - m) + (r * 0.272 + g * 0.534 + b * 0.131) * m; } }); } },
    hue: { name: 'Hue shift', params: [['deg', 'Shift', -180, 180, 1, 60]], apply: function (c, p) { var a = p.deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a); var m = [0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928, 0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.140, 0.072 - co * 0.072 - si * 0.283, 0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072]; return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var r = d[i], g = d[i + 1], b = d[i + 2]; d[i] = r * m[0] + g * m[1] + b * m[2]; d[i + 1] = r * m[3] + g * m[4] + b * m[5]; d[i + 2] = r * m[6] + g * m[7] + b * m[8]; } }); } },
    tone: { name: 'Brightness / contrast / saturation', params: [['brightness', 'Brightness', -100, 100, 1, 0], ['contrast', 'Contrast', -100, 100, 1, 20], ['saturation', 'Saturation', -100, 100, 1, 20]], apply: function (c, p) { return adjust(c, p); } },
    blur: { name: 'Blur', params: [['radius', 'Radius', 1, 40, 1, 6]], apply: function (c, p) { return blurCanvas(c, p.radius); } },
    sharpen: { name: 'Sharpen', params: [['amount', 'Amount', 0, 200, 1, 80]], apply: function (c, p) { var b = data(blurCanvas(c, 2)).data, k = p.amount / 100; return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { d[i] += (d[i] - b[i]) * k; d[i + 1] += (d[i + 1] - b[i + 1]) * k; d[i + 2] += (d[i + 2] - b[i + 2]) * k; } }); } },
    emboss: { name: 'Emboss', params: [['amount', 'Strength', 0, 100, 1, 70]], apply: function (c, p) { var s = data(c).data, w = c.width, h = c.height, m = p.amount / 100; return px(c, function (d) { for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var i = (y * w + x) * 4, a = ((y - 1) * w + x - 1) * 4, b = ((y + 1) * w + x + 1) * 4; for (var ch = 0; ch < 3; ch++) { var v = 128 + (s[b + ch] - s[a + ch]) * 2; d[i + ch] = s[i + ch] * (1 - m) + v * m; } } }); } },
    sketch: { name: 'Pencil sketch', params: [['strength', 'Line strength', 10, 300, 1, 120]], apply: function (c, p) { var w = c.width, h = c.height, e = edges(data(c).data, w, h), k = p.strength / 100; return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var v = 255 - clamp(e[i >> 2] * k, 0, 255); d[i] = d[i + 1] = d[i + 2] = v; } }); } },
    pixelsort: { name: 'Pixel sort', params: [['low', 'From brightness', 0, 255, 1, 80], ['high', 'To brightness', 0, 255, 1, 220], ['dir', 'Rows / columns (0/1)', 0, 1, 1, 0]], apply: function (c, p) { return px(c, function (d, w, h) { var lines = p.dir ? w : h, len = p.dir ? h : w; for (var L = 0; L < lines; L++) { var run = []; var flush = function (endIdx) { if (run.length > 1) { var px2 = run.map(function (q) { return [d[q], d[q + 1], d[q + 2], d[q + 3]]; }); px2.sort(function (A, B) { return lum(A[0], A[1], A[2]) - lum(B[0], B[1], B[2]); }); run.forEach(function (q, k) { d[q] = px2[k][0]; d[q + 1] = px2[k][1]; d[q + 2] = px2[k][2]; d[q + 3] = px2[k][3]; }); } run = []; }; for (var k = 0; k < len; k++) { var q = p.dir ? (k * w + L) * 4 : (L * w + k) * 4, lv = lum(d[q], d[q + 1], d[q + 2]); if (lv >= p.low && lv <= p.high) run.push(q); else flush(); } flush(); } }); } },
    wave: { name: 'Wave distort', params: [['amp', 'Wave size', 0, 60, 1, 12], ['freq', 'Waves', 1, 40, 1, 8]], apply: function (c, p) { var w = c.width, h = c.height, o = mk(w, h), g = o.getContext('2d'); for (var y = 0; y < h; y++) { var off = Math.sin(y / h * p.freq * Math.PI * 2) * p.amp; g.drawImage(c, 0, y, w, 1, off, y, w, 1); } return o; } },
    crt: { name: 'CRT screen', params: [['amount', 'Amount', 0, 100, 1, 60]], apply: function (c, p) { var a = p.amount / 100; var o = EFFECTS.rgbsplit.apply(c, { amount: Math.round(2 + 3 * a), angle: 0 }); o = px(o, function (d, w, h) { for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4, col = x % 3; var mask = 1 - 0.35 * a; d[i] *= col === 0 ? 1 : mask; d[i + 1] *= col === 1 ? 1 : mask; d[i + 2] *= col === 2 ? 1 : mask; if (y % 3 === 0) { d[i] *= 1 - 0.3 * a; d[i + 1] *= 1 - 0.3 * a; d[i + 2] *= 1 - 0.3 * a; } } }); o = EFFECTS.vignette.apply(o, { amount: 50 * a, size: 55 }); return glow(o, { mode: 'bloom', intensity: 35 * a, radius: 10, threshold: 140 }); } },
    ascii: { name: 'ASCII art', params: [['size', 'Letter size', 5, 30, 1, 10], ['color', 'Colour letters (0/1)', 0, 1, 1, 1]], apply: function (c, p) { var chars = ' .:-=+*#%@', s = Math.round(p.size), o = mk(c.width, c.height), g = o.getContext('2d'), d = data(c).data, w = c.width; g.fillStyle = '#0b0614'; g.fillRect(0, 0, o.width, o.height); g.font = 'bold ' + s + 'px monospace'; g.textBaseline = 'top'; for (var y = 0; y < c.height; y += s) for (var x = 0; x < c.width; x += s * 0.62) { var i = (Math.min(c.height - 1, Math.round(y + s / 2)) * w + Math.min(w - 1, Math.round(x))) * 4, L = lum(d[i], d[i + 1], d[i + 2]); g.fillStyle = p.color ? 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')' : '#fff'; g.fillText(chars[Math.min(chars.length - 1, Math.floor(L / 256 * chars.length))], x, y); } return o; } },
    chrome: { name: 'Chrome / liquid metal', params: [['amount', 'Strength', 0, 100, 1, 80]], apply: function (c, p) { var m = p.amount / 100; return px(c, function (d) { for (var i = 0; i < d.length; i += 4) { var t = lum(d[i], d[i + 1], d[i + 2]) / 255, v = 128 + 127 * Math.sin(t * Math.PI * 3.2 - 1.2); var cr = v * 0.92 + 20, cg = v * 0.95 + 14, cb = v + 10; d[i] = d[i] * (1 - m) + cr * m; d[i + 1] = d[i + 1] * (1 - m) + cg * m; d[i + 2] = d[i + 2] * (1 - m) + cb * m; } }); } },
    bloom: { name: 'Glow (bloom)', params: [['intensity', 'Intensity', 0, 200, 1, 60], ['radius', 'Radius', 2, 60, 1, 16]], apply: function (c, p) { return glow(c, { mode: 'bloom', intensity: p.intensity, radius: p.radius, threshold: 150 }); } },
    dither: { name: 'Dither', params: [['scale', 'Pixel size', 1, 8, 1, 2]], apply: function (c, p) { return dither(c, { algo: 'atkinson', palette: 'sul', scale: p.scale }); } }
  };

  /* =========================================================
     Y2K MAGAZINE COVER
     ========================================================= */
  var Y2K_GRADES = {
    chrome: { name: 'Chrome blue', fx: [['tone', { brightness: 5, contrast: 25, saturation: -10 }], ['duotone', { c1: '#0a1a4a', c2: '#d8f0ff' }]], mix: 0.55 },
    bubblegum: { name: 'Bubblegum', fx: [['tone', { brightness: 8, contrast: 15, saturation: 35 }], ['duotone', { c1: '#5b0e5c', c2: '#ffd1f1' }]], mix: 0.45 },
    cyber: { name: 'Cyber green', fx: [['tone', { brightness: 0, contrast: 30, saturation: 10 }], ['duotone', { c1: '#00140a', c2: '#b8ff3c' }]], mix: 0.5 },
    holo: { name: 'Holo', fx: [['holomap', { mix: 70 }]], mix: 0.6 },
    flash: { name: 'Flash photo', fx: [['tone', { brightness: 12, contrast: 35, saturation: 15 }]], mix: 1 },
    none: { name: 'Original colours', fx: [], mix: 0 }
  };
  // o: { grade, title, titleColor, titleFont, issue, lines:[...], sticker, stickerColor, accent, frame, halftone, aberration, grain, ratio }
  function magazine(src, o) {
    o = o || {};
    var W = src.width, ratio = o.ratio === 'square' ? 1 : (o.ratio === 'original' ? src.height / src.width : 1.3);
    var H = Math.round(W * ratio), out = mk(W, H), g = out.getContext('2d');
    // cover-fit the picture
    var k = Math.max(W / src.width, H / src.height), dw = src.width * k, dh = src.height * k;
    var base = mk(W, H); base.getContext('2d').drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    var gr = Y2K_GRADES[o.grade] || Y2K_GRADES.bubblegum, graded = base;
    gr.fx.forEach(function (f) { graded = EFFECTS[f[0]].apply(graded, f[1]); });
    g.drawImage(base, 0, 0);
    if (gr.mix) { g.globalAlpha = gr.mix; g.drawImage(graded, 0, 0); g.globalAlpha = 1; }
    if (o.aberration) g.drawImage(EFFECTS.rgbsplit.apply(out, { amount: Math.round(W / 220 * o.aberration / 50), angle: 0 }), 0, 0);
    if (o.halftone) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = o.halftone / 100; g.drawImage(EFFECTS.halftone.apply(out, { size: Math.max(4, Math.round(W / 140)), color: 0 }), 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.drawImage(glow(out, { mode: 'soft', intensity: 25, radius: Math.round(W / 60) }), 0, 0);
    if (o.grain) g.drawImage(EFFECTS.noise.apply(out, { amount: o.grain / 3, mono: 1 }), 0, 0);
    var accent = o.accent || '#ff3fc8', tcol = o.titleColor || '#ffffff', font = o.titleFont || '"Pixelify Sans", Impact, sans-serif';
    var U = W / 100;
    // frame
    if (o.frame !== 'none') {
      g.strokeStyle = o.frame === 'white' ? '#fff' : accent; g.lineWidth = U * 1.6;
      g.strokeRect(U * 2.2, U * 2.2, W - U * 4.4, H - U * 4.4);
    }
    // masthead
    var title = String(o.title == null ? 'SUL' : o.title).toUpperCase();
    var fs = U * (title.length <= 4 ? 30 : title.length <= 7 ? 22 : 15);
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.font = '900 ' + fs + 'px ' + font;
    var ty = U * 4;
    g.lineJoin = 'round';
    g.lineWidth = U * 1.4; g.strokeStyle = accent; g.strokeText(title, W / 2 + U * 0.8, ty + U * 0.8);
    var tg = g.createLinearGradient(0, ty, 0, ty + fs);
    if (tcol === 'chrome') { ['#ffffff', '#b9c3d6', '#5d6b85', '#e9f1ff', '#9aa6bd'].forEach(function (cc, i, a) { tg.addColorStop(i / (a.length - 1), cc); }); g.fillStyle = tg; }
    else g.fillStyle = tcol;
    g.fillText(title, W / 2, ty);
    // issue line under masthead
    g.font = '700 ' + U * 2.6 + 'px "Silkscreen", "Space Grotesk", monospace';
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = U * 0.5;
    var issue = o.issue || 'ISSUE #01 · 2026';
    g.strokeText(issue, W / 2, ty + fs + U * 0.5); g.fillText(issue, W / 2, ty + fs + U * 0.5);
    // cover lines (left side)
    g.textAlign = 'left';
    var lines = (o.lines || []).filter(Boolean).slice(0, 5), ly = H * 0.42;
    lines.forEach(function (ln, i) {
      var big = i === 0, sz = U * (big ? 5.6 : 3.4);
      g.font = (big ? '900 ' : '700 ') + sz + 'px ' + (big ? font : '"Space Grotesk", Arial, sans-serif');
      var txt = String(ln).toUpperCase(), tw = g.measureText(txt).width;
      if (big || i % 2 === 0) { g.fillStyle = i === 0 ? accent : 'rgba(0,0,0,.55)'; g.fillRect(U * 4, ly - U * 0.6, Math.min(tw + U * 2.4, W * 0.62), sz + U * 1.2); }
      g.fillStyle = '#fff'; g.fillText(txt, U * 5.2, ly, W * 0.6);
      ly += sz + U * 2.4;
    });
    // sticker burst
    if (o.sticker) {
      var sx = W * 0.78, sy = H * 0.6, R = U * 11;
      g.save(); g.translate(sx, sy); g.rotate(-0.25);
      g.beginPath(); for (var s = 0; s < 32; s++) { var a = s * Math.PI / 16, rr = s % 2 ? R * 0.8 : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath();
      g.fillStyle = o.stickerColor || '#ffe14d'; g.fill(); g.lineWidth = U * 0.6; g.strokeStyle = '#2a1240'; g.stroke();
      g.fillStyle = '#2a1240'; g.textAlign = 'center'; g.textBaseline = 'middle';
      var st = String(o.sticker).toUpperCase().split(/\s+/).slice(0, 3);
      g.font = '900 ' + U * (st.length > 1 ? 3.8 : 5) + 'px ' + font;
      st.forEach(function (wd, i) { g.fillText(wd, 0, (i - (st.length - 1) / 2) * U * 4.2); });
      g.restore();
    }
    // sparkles + barcode
    g.fillStyle = '#fff';
    [[0.88, 0.2, 3.2], [0.12, 0.3, 2.2], [0.7, 0.9, 2.6], [0.93, 0.42, 1.6]].forEach(function (sp) {
      var cx = W * sp[0], cy = H * sp[1], s2 = U * sp[2]; g.beginPath();
      for (var k2 = 0; k2 < 8; k2++) { var a2 = k2 * Math.PI / 4, r2 = k2 % 2 ? s2 * 0.22 : s2; g.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2); }
      g.fill();
    });
    if (o.barcode !== false) {
      var bx = W - U * 16, by = H - U * 12, r3 = rng(9);
      g.fillStyle = '#fff'; g.fillRect(bx, by, U * 12, U * 8);
      g.fillStyle = '#000'; var xx = bx + U; while (xx < bx + U * 11) { var bw = Math.max(1, r3() * U * 0.7); g.fillRect(xx, by + U, bw, U * 5); xx += bw + Math.max(1, r3() * U * 0.6); }
      g.font = '700 ' + U * 1.4 + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('0 55777 0557 1', bx + U * 6, by + U * 7.6);
    }
    return out;
  }

  window.PixFX = {
    mk: mk, clone: clone, loadImage: loadImage, toCanvas: toCanvas, blur: blurCanvas, adjust: adjust,
    dither: dither, PALETTES: PALETTES, DITHER_ALGOS: DITHER_ALGOS,
    glow: glow, applyTexture: applyTexture, BLENDS: BLENDS, BUILTIN_TEX: BUILTIN_TEX, builtinTexture: builtinTexture,
    EFFECTS: EFFECTS, magazine: magazine, Y2K_GRADES: Y2K_GRADES, hex: hex
  };
})();
