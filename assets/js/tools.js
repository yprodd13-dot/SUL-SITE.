/* =========================================================
   SUL0557 — Tools pages
   Grid of tool icons (section type "tools") + one page per tool
   at #/tool/<id>. Everything runs in the visitor's browser.
   ========================================================= */
(function () {
  'use strict';

  var LIBS = {
    lame: 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js'
  };

  /* ---------- tool list ---------- */
  var TOOLS = [
    { id: 'dither', title: 'DITHER LAB', desc: 'Dither & halftone: 30+ patterns, dot shapes, sizes & colours.' },
    { id: 'y2k', title: 'Y2K COVER', desc: 'Turn any photo into a 2000s magazine cover.' },
    { id: 'glow', title: 'GLOW STUDIO', desc: 'Bloom, neon edges, dreamy haze, star glints.' },
    { id: 'texture', title: 'TEXTURE LAB', desc: 'Lay textures over your picture with blend modes.' },
    { id: 'fx', title: 'FX MIXER', desc: 'Stack 30 creative effects: glitch, VHS, halftone…' },
    { id: 'bgremove', title: 'BG REMOVER', desc: 'Drop a picture, click remove, background gone.' },
    { id: 'convert', title: 'FILE CONVERTER', desc: 'MP4 → MP3/WAV, images → PNG/JPG/WEBP/ICO/PDF.' },
    { id: 'rename', title: 'ZIP RENAMER', desc: 'Rename every file in a zip at once. Live preview.' },
    { id: 'rar2zip', title: 'RAR → ZIP', desc: 'Turn .rar files into .zip — passwords and big kits work too.' }
  ];
  // 12×12 pixel icons. k outline · p pink · v violet · c cyan · y yellow · w white · g gray · m mint
  var PAL = { k: '#2a1240', p: '#ff3fc8', v: '#8a3cff', c: '#38c8ff', y: '#ffe14d', w: '#ffffff', g: '#b9a9d6', m: '#5cffc1', d: '#5a2a8a' };
  var ART = {
    dither: ['kkkkkkkkkkkk', 'kpvpvpvpvpvk', 'kvpvpvpvpvpk', 'kpvpwpvpvpvk', 'kvpwpwpvpvpk', 'kpwpwpwpvpvk', 'kwpwpwpwpvpk', 'kpwcwcwpwpvk', 'kwcwcwcwpwpk', 'kcwcwcwcwpwk', 'kwcwcwcwcwck', 'kkkkkkkkkkkk'],
    y2k: ['.kkkkkkkkkk.', 'kppppppppppk', 'kpwwkwwkwwpk', 'kppppppppppk', 'kpccccccccpk', 'kpcwwcccyypk', 'kpcwwccyyypk', 'kpccccccyypk', 'kpwwwwccccpk', 'kpccccccckpk', 'kppppppppppk', '.kkkkkkkkkk.'],
    glow: ['.....y......', '.....y......', '..y..y..y...', '...ywwwy....', '....wwwy....', 'yyyywwwwyyyy', '....ywww....', '...ywwwy....', '..y..y..y...', '.....y......', '.....y......', '............'],
    texture: ['kkkkkkkkkkkk', 'kvgvgvgvgvgk', 'kgvgvgvgvgvk', 'kvgpppvgvgvk', 'kgpppppgvgvk', 'kvppwpppgvgk', 'kgpppppgvgvk', 'kvgpppgvccvk', 'kgvgvgvgccgk', 'kvgvgvgvgvgk', 'kgvgvgvgvgvk', 'kkkkkkkkkkkk'],
    fx: ['..kkkkkkkk..', '.kvvvvvvvvk.', 'kvvwwvvvvvvk', 'kvwvvvvpvvvk', 'kvvvvvpppvvk', 'kccccpppppck', 'kccccppppcck', 'kvvvvpppvvvk', 'kvvvvvpvvvvk', 'kvvvvvvvvwvk', '.kvvvvvvvvk.', '..kkkkkkkk..'],
    bgremove: ['wgwgwgwgwgwg', 'gwgwgkkgwgwg', 'wgwgkppkgwgw', 'gwgkppppkgwg', 'wgwkppppkwgw', 'gwgwkppkgwgw', 'wgwkkppkkgwg', 'gwkppppppkgw', 'wkppppppppkg', 'gkppppppppkw', 'wkkkkkkkkkkg', 'gwgwgwgwgwgw'],
    convert: ['kkkkk.......', 'kwwwkk......', 'kwcwwkk.....', 'kwcwwwk.....', 'kwwwwwk..y..', 'kkkkkkk..yy.', '...yyyyyyyyy', '.........yy.', '.....kkkky..', '.....kpppk..', '.....kpwpk..', '.....kkkkk..'],
    rar2zip: ['kkkkkk......', 'kvvvvk......', 'kkkkkk......', 'kppppk......', 'kkkkkk......', 'kcccck...y..', 'kkkkkkyyyyy.', '.........y..', '......kkkkkk', '......kwykwk', '......kwkywk', '......kkkkkk'],
    rename: ['kkkkk.......', 'kyyyykkkkkk.', 'kyyyyyyyyyk.', 'kyykkkkkkkkk', 'kyykwwwwwwwk', 'kyykwppppwwk', 'kyykwwwwwwwk', 'kyykwccccwwk', 'kyykwwwwwwwk', 'kyykwvvwwwwk', 'kkkkkkkkkkkk', '............']
  };
  function pixelIcon(id) {
    var rows = ART[id] || ART.fx, out = '';
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) { var c = PAL[r[x]]; if (c) out += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + c + '"/>'; } });
    return '<svg class="tool-pix" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">' + out + '</svg>';
  }
  function toolCfg(cfg, id) {
    var base = TOOLS.filter(function (t) { return t.id === id; })[0];
    if (!base) return null;
    var o = ((cfg.tools || {}).items || {})[id] || {};
    return { id: id, title: o.title || base.title, desc: o.desc != null && o.desc !== '' ? o.desc : base.desc, icon: o.icon || '', enabled: o.enabled !== false };
  }
  function orderedTools(cfg) {
    var order = ((cfg.tools || {}).order || []).filter(function (id) { return ART[id]; });
    TOOLS.forEach(function (t) { if (order.indexOf(t.id) < 0) order.push(t.id); });
    return order.map(function (id) { return toolCfg(cfg, id); }).filter(function (t) { return t && t.enabled; });
  }
  function iconHtml(t, api) {
    var img = api.asset(t.icon);
    return img ? '<img class="tool-pix tool-img" src="' + api.esc(img) + '" alt="">' : pixelIcon(t.id);
  }
  // section renderer used by app.js
  function sectionHtml(s, cfg, api) {
    var list = orderedTools(cfg);
    if (Array.isArray(s.only) && s.only.length) list = list.filter(function (t) { return s.only.indexOf(t.id) >= 0; });
    var style = s.style || 'tiles';
    return '<div class="tools-grid ts-' + api.esc(style) + '">' + list.map(function (t, i) {
      return '<a class="tool-tile reveal" href="#/tool/' + t.id + '" style="--i:' + i + '">' +
        '<span class="tool-ico">' + iconHtml(t, api) + '</span>' +
        '<span class="tool-txt"><strong>' + api.esc(t.title) + '</strong>' + (s.showDesc !== false ? '<small>' + api.esc(t.desc) + '</small>' : '') + '</span>' +
        '<span class="tool-go" aria-hidden="true">▶</span></a>';
    }).join('') + '</div>';
  }

  /* ---------- tiny DOM + control helpers ---------- */
  function h(tag, attrs, html) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); if (html != null) e.innerHTML = html; return e; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtBytes(n) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'; return (n / 1073741824).toFixed(2) + ' GB'; }
  function stem(n) { return String(n || 'file').replace(/\.[^.]+$/, ''); }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function canvasBlob(c, type, q) { return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('Export failed')); }, type, q); }); }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  // control schema → form. defs: {k,label,type,min,max,step,options,show(state),help}
  function buildControls(box, defs, state, onChange) {
    box.innerHTML = '';
    var rows = [];
    defs.forEach(function (d) {
      if (d.type === 'head') { var hh = h('div', { class: 'tc-head' }, E(d.label)); box.appendChild(hh); rows.push([d, hh]); return; }
      var row = h('label', { class: 'tc tct-' + d.type }), id = 'tc-' + d.k + '-' + Math.random().toString(36).slice(2, 6);
      var lab = '<span class="tc-l">' + E(d.label) + (d.type === 'range' ? ' <b data-v></b>' : '') + '</span>';
      var v = state[d.k];
      if (d.type === 'range') row.innerHTML = lab + '<input type="range" id="' + id + '" min="' + d.min + '" max="' + d.max + '" step="' + (d.step || 1) + '" value="' + v + '">';
      else if (d.type === 'select') row.innerHTML = lab + '<select id="' + id + '">' + d.options.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>';
      else if (d.type === 'color') row.innerHTML = lab + '<span class="tc-color"><input type="color" id="' + id + '" value="' + E(v) + '"><code>' + E(v) + '</code></span>';
      else if (d.type === 'text') row.innerHTML = lab + '<input type="text" id="' + id + '" value="' + E(v) + '" maxlength="' + (d.max || 80) + '" placeholder="' + E(d.placeholder || '') + '">';
      else if (d.type === 'toggle') { row.className += ' tc-inline'; row.innerHTML = '<input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '><span class="tc-sw" aria-hidden="true"></span><span class="tc-l">' + E(d.label) + '</span>'; }
      else if (d.type === 'chips') {
        row = h('div', { class: 'tc tc-chips-row' });
        row.innerHTML = '<span class="tc-l">' + E(d.label) + '</span><div class="tc-chips' + (d.scroll ? ' tc-scroll' : '') + '" role="radiogroup">' + d.options.map(function (o) { return '<button type="button" class="tchip' + (String(o[0]) === String(v) ? ' is-on' : '') + '" data-val="' + E(o[0]) + '" role="radio" aria-checked="' + (String(o[0]) === String(v)) + '">' + (o[2] ? '<i style="background:' + E(o[2]) + '"></i>' : '') + E(o[1]) + '</button>'; }).join('') + '</div>';
        row.querySelectorAll('.tchip').forEach(function (b) {
          b.addEventListener('click', function () {
            state[d.k] = d.num ? +b.getAttribute('data-val') : b.getAttribute('data-val');
            row.querySelectorAll('.tchip').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', String(x === b)); });
            vis(); onChange(d.k);
          });
        });
      }
      if (d.help) row.insertAdjacentHTML('beforeend', '<small class="tc-help">' + E(d.help) + '</small>');
      var inp = row.querySelector('input,select');
      if (inp && d.type !== 'chips') {
        var out = row.querySelector('[data-v]');
        var show = function () { if (out) out.textContent = inp.value + (d.unit || ''); };
        show();
        inp.addEventListener(d.type === 'select' || d.type === 'toggle' ? 'change' : 'input', function () {
          var val = d.type === 'toggle' ? inp.checked : d.type === 'range' ? +inp.value : inp.value;
          state[d.k] = val; show();
          if (d.type === 'color') row.querySelector('code').textContent = inp.value;
          vis(); onChange(d.k);
        });
      }
      box.appendChild(row); rows.push([d, row]);
      var sc = row.querySelector('.tc-scroll'), on = sc && sc.querySelector('.is-on'); if (on) requestAnimationFrame(function () { sc.scrollLeft = Math.max(0, on.offsetLeft - sc.offsetLeft - 30); });
    });
    function vis() { rows.forEach(function (r) { if (r[0].show) r[1].hidden = !r[0].show(state); }); }
    vis();
  }

  /* =========================================================
     SHARED IMAGE EDITOR (dither / y2k / glow / texture / fx)
     ========================================================= */
  var QUAL = [['900', 'Fast (900px)'], ['1400', 'Standard (1400px)'], ['2400', 'HD (2400px)'], ['4096', 'Max (up to 4096px)']];
  function imageTool(root, T, ctx) {
    var st = { q: 1400 }, img = null, fileName = 'image', src = null, base = null, result = null, busy = false, again = false, timer = 0;
    root.innerHTML =
      '<div class="tool-grid">' +
      '<div class="tool-stage panel">' +
      '<div class="drop" tabindex="0" role="button" aria-label="Choose a picture"><input type="file" accept="image/*" hidden>' +
      '<div class="drop-ico">' + pixelIcon(T.id) + '</div><strong>DROP A PICTURE HERE</strong><span>or click to choose · you can also paste (Ctrl+V)</span><small>JPG · PNG · WEBP · GIF · it never leaves your device</small></div>' +
      '<div class="stage-view" hidden><div class="stage-canvas checker"></div>' +
      '<div class="stage-bar"><button type="button" class="btn btn-sm btn-ghost" data-act="compare">◐ HOLD TO COMPARE</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-act="new">⇪ NEW PICTURE</button><span class="stage-status" aria-live="polite"></span></div></div>' +
      '</div>' +
      '<aside class="tool-side panel"><div class="tc-box"></div><div class="tool-extra"></div>' +
      '<div class="tc-head">Quality & save</div><div class="tc-q"></div>' +
      '<div class="dl-row"><button type="button" class="btn" data-dl="png" disabled>⬇ PNG</button><button type="button" class="btn btn-ghost" data-dl="jpg" disabled>JPG</button><button type="button" class="btn btn-ghost" data-dl="webp" disabled>WEBP</button></div>' +
      '<div class="dl-row"><button type="button" class="btn btn-sm btn-ghost" data-act="bake" disabled title="Keep this result and add another effect on top">✚ APPLY & STACK MORE</button><button type="button" class="btn btn-sm btn-ghost" data-act="reset" disabled>↺ START OVER</button></div>' +
      '</aside></div>';
    var drop = root.querySelector('.drop'), file = drop.querySelector('input'), view = root.querySelector('.stage-view'), holder = root.querySelector('.stage-canvas'), status = root.querySelector('.stage-status');
    var shown = null;
    function setStatus(t) { status.textContent = t || ''; }
    function show(c) { if (shown === c) return; holder.innerHTML = ''; c.classList.add('stage-img'); holder.appendChild(c); shown = c; }
    function enable(on) { root.querySelectorAll('[data-dl],[data-act=bake],[data-act=reset]').forEach(function (b) { b.disabled = !on; }); }
    function prepare() {
      if (!img) return;
      src = PixFX.toCanvas(img, st.q); base = src;
      schedule(0);
    }
    function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms == null ? 90 : ms); }
    async function run() {
      if (!base) return;
      if (busy) { again = true; return; }
      busy = true; setStatus('rendering…');
      await tick();
      try {
        var r = T.render(base, st, ctx);
        if (r && r.then) r = await r;
        result = r; show(result); setStatus(result.width + ' × ' + result.height + ' px'); enable(true);
      } catch (e) { console.error(e); setStatus('⚠ ' + (e.message || 'Something went wrong')); }
      busy = false;
      if (again) { again = false; run(); }
    }
    async function takeFile(f) {
      if (!f || !/^image\//.test(f.type || '') && !/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(f.name || '')) { setStatus('⚠ That isn\'t a picture file'); return; }
      try {
        img = await PixFX.loadImage(f); fileName = stem(f.name);
        drop.hidden = true; view.hidden = false; prepare();
        if (T.onImage) T.onImage(img, st);
      } catch (e) { drop.hidden = false; view.hidden = true; alert(e.message); }
    }
    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', function () { if (file.files[0]) takeFile(file.files[0]); file.value = ''; });
    dropTarget(root.querySelector('.tool-stage'), function (fs) { takeFile(fs[0]); });
    ctx.on(window, 'paste', function (e) { var it = [].slice.call((e.clipboardData || {}).items || []).filter(function (i) { return /^image\//.test(i.type); })[0]; if (it) takeFile(it.getAsFile()); });
    var cmp = root.querySelector('[data-act=compare]');
    function down(e) { e.preventDefault(); if (base) show(base === src ? src : base); }
    function up() { if (result) show(result); }
    cmp.addEventListener('pointerdown', down); cmp.addEventListener('pointerup', up); cmp.addEventListener('pointerleave', up);
    cmp.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') down(e); }); cmp.addEventListener('keyup', up);
    root.querySelector('[data-act=new]').addEventListener('click', function () { file.click(); });
    root.querySelector('[data-act=bake]').addEventListener('click', function () { if (result) { base = result; setStatus('Applied ✓ — change the settings to add more on top'); } });
    root.querySelector('[data-act=reset]').addEventListener('click', function () { base = src; schedule(0); });
    root.querySelectorAll('[data-dl]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!result) return;
        var t = b.getAttribute('data-dl'), mime = t === 'png' ? 'image/png' : t === 'jpg' ? 'image/jpeg' : 'image/webp', c = result;
        if (t === 'jpg') { c = PixFX.mk(result.width, result.height); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(result, 0, 0); }
        download(await canvasBlob(c, mime, 0.95), fileName + '-' + T.id + '.' + t);
        ctx.api.burst(innerWidth / 2, innerHeight / 2, 18);
      });
    });
    var qBox = root.querySelector('.tc-q');
    buildControls(qBox, [{ k: 'q', label: 'Resolution', type: 'select', options: QUAL, help: 'Bigger = sharper download, slower live preview.' }], st, function () { st.q = +st.q; prepare(); });
    Object.assign(st, T.defaults || {});
    buildControls(root.querySelector('.tc-box'), T.controls, st, function () { schedule(); });
    ctx.rebuild = function () { buildControls(root.querySelector('.tc-box'), T.controls, st, function () { schedule(); }); schedule(0); };
    if (T.extra) T.extra(root.querySelector('.tool-extra'), st, function () { schedule(); }, ctx);
    return { rerender: function () { schedule(); } };
  }
  function dropTarget(el, cb) {
    ['dragenter', 'dragover'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.add('is-drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); if (ev === 'dragleave' && el.contains(e.relatedTarget)) return; el.classList.remove('is-drag'); }); });
    el.addEventListener('drop', function (e) { var fs = e.dataTransfer && e.dataTransfer.files; if (fs && fs.length) cb([].slice.call(fs), e); });
  }

  /* ---------- per-tool definitions ---------- */
  function palOptions() { var o = Object.keys(PixFX.PALETTES).map(function (k) { return [k, PixFX.PALETTES[k].name, 'linear-gradient(90deg,' + PixFX.PALETTES[k].colors.join(',') + ')']; }); o.unshift(['inkpaper', 'Ink & paper', 'linear-gradient(90deg,#2a1240 50%,#fff 50%)']); o.push(['custom', 'My colours', 'conic-gradient(#ff3fc8,#38c8ff,#ffe14d,#ff3fc8)']); o.push(['levels', 'Full colour (levels)', 'linear-gradient(90deg,red,lime,blue)']); return o; }
  var DEF = {};
  var DITHER_PRESETS = [
    ['Gameboy', { mode: 'diffusion', algo: 'atkinson', palette: 'gameboy', scale: 3, contrast: 20 }],
    ['Newspaper', { mode: 'halftone', shape: 'dot', colorMode: 'mono', cell: 9, angle: 45, dotScale: 110, ink: '#141414', paper: '#f3eee2', contrast: 15 }],
    ['Comic print', { mode: 'halftone', shape: 'dot', colorMode: 'cmyk', cell: 12, angle: 45, dotScale: 105, paper: '#fff8e8', contrast: 20 }],
    ['Riso pink', { mode: 'ordered', pattern: 'dot', cell: 8, angle: 30, palette: 'inkpaper', ink: '#ff3fc8', paper: '#fff4fb', scale: 1 }],
    ['1-bit Mac', { mode: 'diffusion', algo: 'atkinson', palette: '1bit', scale: 2, contrast: 25 }],
    ['Heart print', { mode: 'halftone', shape: 'heart', colorMode: 'color', cell: 16, dotScale: 120, paper: '#ffffff', angle: 0 }],
    ['Engraving', { mode: 'ordered', pattern: 'lines', cell: 6, angle: 35, palette: 'inkpaper', ink: '#1b1033', paper: '#f5f0ff', scale: 1, contrast: 25 }],
    ['Vapor Bayer', { mode: 'ordered', pattern: 'bayer8', cell: 8, palette: 'vapor', scale: 3 }],
    ['Star dust', { mode: 'halftone', shape: 'star', colorMode: 'mono', ink: '#ffe14d', paper: '#1a0533', cell: 14, dotScale: 130, angle: 0 }],
    ['CMYK dots', { mode: 'halftone', shape: 'dot', colorMode: 'cmyk', cell: 7, dotScale: 100, angle: 45, paper: '#ffffff' }]
  ];
  DEF.dither = {
    defaults: { mode: 'diffusion', algo: 'atkinson', pattern: 'bayer8', shape: 'dot', cell: 8, angle: 45, dotScale: 100, colorMode: 'mono', palette: 'sul', ncol: 2, c1: '#120822', c2: '#ff3fc8', c3: '#38c8ff', c4: '#ffffff', c5: '#ffe14d', c6: '#8a3cff', c7: '#5cffc1', c8: '#ff7a3c', ink: '#2a1240', paper: '#ffffff', levels: 3, scale: 2, strength: 100, serpentine: true, brightness: 0, contrast: 10, gamma: 100, saturation: 0, invert: false, mix: 100 },
    controls: function () {
      var M = function (m) { return function (s) { return s.mode === m; }; }, notHT = function (s) { return s.mode !== 'halftone'; };
      var cdefs = [];
      for (var i = 1; i <= 8; i++) (function (i) { cdefs.push({ k: 'c' + i, label: 'Colour ' + i, type: 'color', show: function (s) { return notHT(s) && s.palette === 'custom' && s.ncol >= i; } }); })(i);
      return [
        { type: 'head', label: 'Type' },
        { k: 'mode', label: 'Dither type', type: 'chips', options: [['diffusion', '▦ Error diffusion'], ['ordered', '◫ Pattern'], ['halftone', '● Halftone']] },
        { k: 'algo', label: 'Algorithm', type: 'chips', scroll: true, options: PixFX.DIFFUSION_LIST, show: M('diffusion') },
        { k: 'pattern', label: 'Pattern shape', type: 'chips', scroll: true, options: PixFX.ORDERED_LIST, show: M('ordered') },
        { k: 'shape', label: 'Halftone shape', type: 'chips', scroll: true, options: PixFX.SHAPE_LIST, show: M('halftone') },
        { k: 'colorMode', label: 'Halftone colour', type: 'chips', options: [['mono', 'Ink on paper'], ['color', 'Original colours'], ['cmyk', 'CMYK print'], ['rgb', 'RGB screen']], show: M('halftone') },
        { type: 'head', label: 'Size' },
        { k: 'scale', label: 'Pixel size', type: 'range', min: 1, max: 32, unit: 'px', show: notHT, help: 'How chunky each pixel is.' },
        { k: 'cell', label: 'Pattern / dot size', type: 'range', min: 2, max: 60, unit: 'px', show: function (s) { return s.mode !== 'diffusion'; } },
        { k: 'dotScale', label: 'Dot fullness', type: 'range', min: 30, max: 170, unit: '%', show: M('halftone') },
        { k: 'angle', label: 'Angle', type: 'range', min: -90, max: 180, unit: '°', show: function (s) { return s.mode === 'halftone' || (s.mode === 'ordered' && !/^bayer/.test(s.pattern)); } },
        { k: 'strength', label: 'Dither strength', type: 'range', min: 0, max: 200, unit: '%', show: notHT },
        { k: 'serpentine', label: 'Serpentine scan (smoother)', type: 'toggle', show: M('diffusion') },
        { type: 'head', label: 'Colours' },
        { k: 'palette', label: 'Palette', type: 'chips', scroll: true, options: palOptions(), show: notHT },
        { k: 'ncol', label: 'How many colours', type: 'range', min: 2, max: 8, show: function (s) { return notHT(s) && s.palette === 'custom'; } }
      ].concat(cdefs, [
        { k: 'levels', label: 'Levels per channel', type: 'range', min: 2, max: 8, show: function (s) { return notHT(s) && s.palette === 'levels'; } },
        { k: 'ink', label: 'Ink colour', type: 'color', show: function (s) { return (s.mode === 'halftone' && s.colorMode === 'mono') || (notHT(s) && s.palette === 'inkpaper'); } },
        { k: 'paper', label: 'Paper colour', type: 'color', show: function (s) { return (s.mode === 'halftone' && s.colorMode !== 'rgb') || (notHT(s) && s.palette === 'inkpaper'); } },
        { type: 'head', label: 'Tone' },
        { k: 'brightness', label: 'Brightness', type: 'range', min: -100, max: 100 },
        { k: 'contrast', label: 'Contrast', type: 'range', min: -100, max: 100 },
        { k: 'gamma', label: 'Shadows ↔ highlights (gamma)', type: 'range', min: 30, max: 300, unit: '%' },
        { k: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100 },
        { k: 'invert', label: 'Invert', type: 'toggle' },
        { k: 'mix', label: 'Effect amount (mix with original)', type: 'range', min: 0, max: 100, unit: '%' }
      ]);
    },
    extra: function (box, st, change, ctx) {
      box.parentNode.insertBefore(box, box.parentNode.firstChild);
      box.innerHTML = '<div class="tc-head">Quick presets <small>then tweak</small></div><div class="tc-chips tc-scroll">' + DITHER_PRESETS.map(function (p, i) { return '<button type="button" class="tchip" data-pre="' + i + '">' + E(p[0]) + '</button>'; }).join('') + '</div>';
      box.querySelectorAll('[data-pre]').forEach(function (b) { b.addEventListener('click', function () { var p = DITHER_PRESETS[+b.getAttribute('data-pre')][1]; Object.assign(st, DEF.dither.defaults, p); if (ctx.rebuild) ctx.rebuild(); }); });
    },
    render: function (c, s) {
      return PixFX.dither2(c, { mode: s.mode, algo: s.algo, pattern: s.pattern, shape: s.shape, cell: s.cell, angle: s.angle, dotScale: s.dotScale, colorMode: s.colorMode, palette: s.palette, colors: [s.c1, s.c2, s.c3, s.c4, s.c5, s.c6, s.c7, s.c8].slice(0, s.ncol), ink: s.ink, paper: s.paper, levels: s.levels, scale: s.scale, strength: s.strength / 100, serpentine: s.serpentine, brightness: s.brightness, contrast: s.contrast, gamma: s.gamma / 100, saturation: s.saturation, invert: s.invert, mix: s.mix });
    }
  };
  DEF.y2k = {
    defaults: { grade: 'bubblegum', title: 'SUL', titleColor: 'white', customTitle: '#ffffff', issue: 'ISSUE #01 · 2026', l1: 'NEW KIT OUT NOW', l2: 'cover art secrets', l3: '808 season', l4: '', l5: '', sticker: 'NEW ISSUE', stickerColor: '#ffe14d', accent: '#ff3fc8', frame: 'accent', halftone: 25, aberration: 40, grain: 25, ratio: 'mag', barcode: true },
    controls: function () {
      return [
        { type: 'head', label: 'Look' },
        { k: 'grade', label: 'Colour grade', type: 'chips', options: Object.keys(PixFX.Y2K_GRADES).map(function (k) { return [k, PixFX.Y2K_GRADES[k].name]; }) },
        { k: 'ratio', label: 'Shape', type: 'chips', options: [['mag', 'Magazine'], ['square', 'Square'], ['original', 'Original']] },
        { k: 'halftone', label: 'Print dots', type: 'range', min: 0, max: 80, unit: '%' },
        { k: 'aberration', label: 'Colour fringe', type: 'range', min: 0, max: 100 },
        { k: 'grain', label: 'Film grain', type: 'range', min: 0, max: 100 },
        { type: 'head', label: 'Masthead' },
        { k: 'title', label: 'Magazine name', type: 'text', max: 14 },
        { k: 'titleColor', label: 'Title style', type: 'chips', options: [['white', 'White'], ['chrome', 'Chrome'], ['custom', 'Pick colour']] },
        { k: 'customTitle', label: 'Title colour', type: 'color', show: function (s) { return s.titleColor === 'custom'; } },
        { k: 'issue', label: 'Issue line', type: 'text', max: 40 },
        { k: 'accent', label: 'Accent colour', type: 'color' },
        { k: 'frame', label: 'Border', type: 'chips', options: [['accent', 'Accent'], ['white', 'White'], ['none', 'None']] },
        { type: 'head', label: 'Cover lines' },
        { k: 'l1', label: 'Big headline', type: 'text', max: 30 }, { k: 'l2', label: 'Line 2', type: 'text', max: 34 }, { k: 'l3', label: 'Line 3', type: 'text', max: 34 }, { k: 'l4', label: 'Line 4', type: 'text', max: 34 }, { k: 'l5', label: 'Line 5', type: 'text', max: 34 },
        { k: 'sticker', label: 'Sticker text (empty = none)', type: 'text', max: 20 },
        { k: 'stickerColor', label: 'Sticker colour', type: 'color' },
        { k: 'barcode', label: 'Barcode', type: 'toggle' }
      ];
    },
    render: function (c, s) { return PixFX.magazine(c, { grade: s.grade, title: s.title, titleColor: s.titleColor === 'custom' ? s.customTitle : s.titleColor === 'chrome' ? 'chrome' : '#ffffff', issue: s.issue, lines: [s.l1, s.l2, s.l3, s.l4, s.l5], sticker: s.sticker, stickerColor: s.stickerColor, accent: s.accent, frame: s.frame, halftone: s.halftone, aberration: s.aberration, grain: s.grain, ratio: s.ratio === 'mag' ? 'mag' : s.ratio, barcode: s.barcode }); }
  };
  DEF.glow = {
    defaults: { mode: 'bloom', intensity: 70, radius: 18, threshold: 160, color: '#ff3fc8', count: 18, second: 'none' },
    controls: function () {
      return [
        { k: 'mode', label: 'Glow type', type: 'chips', options: [['bloom', 'Bloom'], ['soft', 'Dreamy haze'], ['neon', 'Neon edges'], ['halation', 'Film halation'], ['outer', 'Outer glow (cut-outs)'], ['glints', 'Star glints']] },
        { k: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 200, unit: '%' },
        { k: 'radius', label: 'Glow size', type: 'range', min: 2, max: 80, unit: 'px' },
        { k: 'threshold', label: 'Only glow brighter than', type: 'range', min: 0, max: 250, show: function (s) { return /bloom|halation|glints/.test(s.mode); } },
        { k: 'color', label: 'Glow colour', type: 'color', show: function (s) { return /neon|outer|glints/.test(s.mode); } },
        { k: 'count', label: 'Number of glints', type: 'range', min: 1, max: 80, show: function (s) { return s.mode === 'glints'; } },
        { k: 'second', label: 'Add a second glow', type: 'chips', options: [['none', 'None'], ['bloom', 'Bloom'], ['soft', 'Haze'], ['glints', 'Glints'], ['halation', 'Halation']] }
      ];
    },
    render: function (c, s) {
      var r = PixFX.glow(c, { mode: s.mode, intensity: s.intensity, radius: s.radius, threshold: s.threshold, color: s.color, count: s.count });
      if (s.second !== 'none' && s.second !== s.mode) r = PixFX.glow(r, { mode: s.second, intensity: 45, radius: Math.max(6, s.radius / 1.5), threshold: 170, color: s.color, count: 12 });
      return r;
    }
  };
  DEF.texture = {
    defaults: { tex: '', mode: 'overlay', opacity: 70, scale: 100, rotate: 0, fit: 'cover', invert: false, flipX: false, flipY: false },
    controls: function () {
      return [
        { k: 'mode', label: 'Blend mode', type: 'chips', scroll: true, options: PixFX.BLENDS },
        { k: 'opacity', label: 'Strength', type: 'range', min: 0, max: 100, unit: '%' },
        { k: 'fit', label: 'Fit', type: 'chips', options: [['cover', 'Stretch to fit'], ['tile', 'Repeat (tile)']] },
        { k: 'scale', label: 'Texture size', type: 'range', min: 10, max: 400, unit: '%' },
        { k: 'rotate', label: 'Rotate', type: 'range', min: -180, max: 180, unit: '°' },
        { k: 'invert', label: 'Invert texture', type: 'toggle' },
        { k: 'flipX', label: 'Flip sideways', type: 'toggle' },
        { k: 'flipY', label: 'Flip upside down', type: 'toggle' }
      ];
    },
    extra: function (box, st, change, ctx) {
      var conf = ctx.cfg.tools || {}, list = [];
      (conf.textures || []).forEach(function (t, i) { if (t && t.src && t.enabled !== false) list.push({ id: 'u' + i, name: t.name || 'Texture ' + (i + 1), src: ctx.api.asset(t.src) }); });
      var hiddenTex = Array.isArray(conf.hiddenTextures) ? conf.hiddenTextures : [];
      if (conf.builtinTextures !== false) PixFX.BUILTIN_TEX.forEach(function (b) { if (hiddenTex.indexOf(b[0]) < 0) list.push({ id: 'b:' + b[0], name: b[1], builtin: b[0] }); });
      box.innerHTML = '<div class="tc-head">Pick a texture</div><div class="tex-strip" role="listbox" aria-label="Textures"></div>' +
        (conf.allowUpload !== false ? '<button type="button" class="btn btn-sm btn-ghost tex-up">＋ USE MY OWN TEXTURE</button><input type="file" accept="image/*" hidden>' : '');
      var strip = box.querySelector('.tex-strip'), cache = {};
      ctx.textureFor = function (id, w, h) {
        var it = list.filter(function (x) { return x.id === id; })[0] || list[0];
        if (!it) return null;
        if (it.builtin) { var k = it.builtin + w + 'x' + h; return cache[k] || (cache[k] = PixFX.builtinTexture(it.builtin, w, h)); }
        return cache[it.id] || null;
      };
      function select(id) { st.tex = id; strip.querySelectorAll('.tex').forEach(function (b) { var on = b.getAttribute('data-id') === id; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); }); change(); }
      function addTile(it) {
        var b = h('button', { type: 'button', class: 'tex', 'data-id': it.id, role: 'option', title: it.name });
        if (it.builtin) { var th = PixFX.builtinTexture(it.builtin, 120, 120); th.className = 'tex-th'; b.appendChild(th); }
        else { b.innerHTML = '<img class="tex-th" alt="" loading="lazy">'; b.firstChild.src = it.src; }
        b.insertAdjacentHTML('beforeend', '<span>' + E(it.name) + '</span>');
        b.addEventListener('click', function () { select(it.id); });
        strip.appendChild(b);
        if (!it.builtin && !cache[it.id]) PixFX.loadImage(it.src).then(function (im) { cache[it.id] = im; if (st.tex === it.id) change(); }).catch(function () { b.classList.add('is-bad'); b.title = 'This texture image could not load'; });
      }
      list.forEach(addTile);
      if (!list.length) strip.innerHTML = '<p class="muted">No textures yet — upload your own below.</p>';
      var up = box.querySelector('.tex-up');
      if (up) {
        var fi = up.nextElementSibling;
        up.addEventListener('click', function () { fi.click(); });
        fi.addEventListener('change', function () {
          var f = fi.files[0]; if (!f) return;
          PixFX.loadImage(f).then(function (im) { var it = { id: 'm' + Date.now(), name: stem(f.name).slice(0, 16), src: URL.createObjectURL(f) }; cache[it.id] = im; list.unshift(it); if (strip.querySelector('p')) strip.innerHTML = ''; addTile(it); strip.insertBefore(strip.lastChild, strip.firstChild); select(it.id); });
          fi.value = '';
        });
      }
      if (list.length) select(st.tex && list.some(function (x) { return x.id === st.tex; }) ? st.tex : list[0].id);
    },
    render: function (c, s, ctx) {
      var tex = ctx.textureFor && ctx.textureFor(s.tex, Math.min(1600, c.width), Math.min(1600, c.height));
      if (!tex) return PixFX.clone(c);
      return PixFX.applyTexture(c, tex, { mode: s.mode, opacity: s.opacity, scale: s.scale, rotate: s.rotate, fit: s.fit, invert: s.invert, flipX: s.flipX, flipY: s.flipY });
    }
  };
  DEF.fx = {
    defaults: {},
    controls: function () { return []; },
    extra: function (box, st, change) {
      st.stack = st.stack || [{ id: 'rgbsplit', on: true, p: defaultsOf('rgbsplit') }, { id: 'scanlines', on: true, p: defaultsOf('scanlines') }];
      var keys = Object.keys(PixFX.EFFECTS);
      box.innerHTML = '<div class="tc-head">Effect library <small>tap to add</small></div><div class="fx-lib">' + keys.map(function (k) { return '<button type="button" class="tchip" data-add="' + k + '">＋ ' + E(PixFX.EFFECTS[k].name) + '</button>'; }).join('') + '</div>' +
        '<div class="tc-head">Your stack <small>top runs first</small></div><div class="fx-stack"></div>' +
        '<div class="dl-row"><button type="button" class="btn btn-sm btn-ghost" data-rand>🎲 RANDOM MIX</button><button type="button" class="btn btn-sm btn-ghost" data-clear>✕ CLEAR</button></div>';
      var stackEl = box.querySelector('.fx-stack');
      function draw() {
        if (!st.stack.length) { stackEl.innerHTML = '<p class="muted">Nothing yet — add effects from the library above.</p>'; return; }
        stackEl.innerHTML = '';
        st.stack.forEach(function (it, i) {
          var E2 = PixFX.EFFECTS[it.id], card = h('div', { class: 'fx-card' + (it.on ? '' : ' is-off') });
          card.innerHTML = '<div class="fx-top"><label class="tc-inline"><input type="checkbox"' + (it.on ? ' checked' : '') + ' aria-label="Turn on/off"><span class="tc-sw"></span></label><strong>' + E(E2.name) + '</strong>' +
            '<button type="button" data-m="-1" aria-label="Move up">▲</button><button type="button" data-m="1" aria-label="Move down">▼</button><button type="button" data-x aria-label="Remove">✕</button></div><div class="fx-params"></div>';
          var defs = E2.params.map(function (q) { return q[6] === 'color' ? { k: q[0], label: q[1], type: 'color' } : { k: q[0], label: q[1].replace(/ \(0\/1\)| \(0\/1\/2\)/, ''), type: (q[3] - q[2] === 1 && /0\/1/.test(q[1])) ? 'toggle' : 'range', min: q[2], max: q[3], step: q[4] }; });
          defs.forEach(function (d) { if (d.type === 'toggle') it.p[d.k] = !!it.p[d.k]; });
          buildControls(card.querySelector('.fx-params'), defs, it.p, function (k) { var d = defs.filter(function (x) { return x.k === k; })[0]; if (d && d.type === 'toggle') it.p[k] = it.p[k] ? 1 : 0; change(); });
          defs.forEach(function (d) { if (d.type === 'toggle') it.p[d.k] = it.p[d.k] ? 1 : 0; });
          card.querySelector('input[type=checkbox]').addEventListener('change', function (e) { it.on = e.target.checked; card.classList.toggle('is-off', !it.on); change(); });
          card.querySelectorAll('[data-m]').forEach(function (b) { b.addEventListener('click', function () { var j = i + +b.getAttribute('data-m'); if (j < 0 || j >= st.stack.length) return; var t = st.stack[i]; st.stack[i] = st.stack[j]; st.stack[j] = t; draw(); change(); }); });
          card.querySelector('[data-x]').addEventListener('click', function () { st.stack.splice(i, 1); draw(); change(); });
          stackEl.appendChild(card);
        });
      }
      box.querySelectorAll('[data-add]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-add'); st.stack.push({ id: k, on: true, p: defaultsOf(k) }); draw(); change(); }); });
      box.querySelector('[data-rand]').addEventListener('click', function () {
        var pool = keys.filter(function (k) { return !/ascii|kaleido|threshold|invert|sketch/.test(k); }), n = 2 + Math.floor(Math.random() * 3); st.stack = [];
        while (st.stack.length < n) { var k = pool[Math.floor(Math.random() * pool.length)]; if (st.stack.some(function (x) { return x.id === k; })) continue; var p = defaultsOf(k); PixFX.EFFECTS[k].params.forEach(function (q) { if (typeof q[5] === 'number' && q[3] - q[2] > 1) p[q[0]] = Math.round(q[2] + (q[3] - q[2]) * (0.15 + Math.random() * 0.5)); }); st.stack.push({ id: k, on: true, p: p }); }
        draw(); change();
      });
      box.querySelector('[data-clear]').addEventListener('click', function () { st.stack = []; draw(); change(); });
      draw();
    },
    render: function (c, s) { var r = c; (s.stack || []).forEach(function (it) { if (it.on) r = PixFX.EFFECTS[it.id].apply(r, it.p); }); return r === c ? PixFX.clone(c) : r; }
  };
  function defaultsOf(k) { var p = {}; PixFX.EFFECTS[k].params.forEach(function (q) { p[q[0]] = q[5]; }); return p; }

  /* =========================================================
     BACKGROUND REMOVER
     ========================================================= */
  /* ---------- built-in AI (files live in this site: assets/ai/) ---------- */
  var AI = { base: 'assets/ai/', manifest: null, sessions: {} };
  function aiNotInstalled() { var e = new Error('The AI files aren\'t installed on this site yet.'); e.notInstalled = true; return e; }
  async function aiManifest() {
    if (AI.manifest) return AI.manifest;
    var r; try { r = await fetch(AI.base + 'manifest.json', { cache: 'no-cache' }); } catch (e) { throw aiNotInstalled(); }
    if (!r.ok) throw aiNotInstalled();
    return (AI.manifest = await r.json());
  }
  async function aiRuntime() {
    if (!window.ort) await loadScript(AI.base + 'ort/ort.webgpu.min.js');
    if (!window.ort) throw new Error('AI runtime failed to start');
    ort.env.wasm.wasmPaths = new URL(AI.base + 'ort/', location.href).href;
    ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    return window.ort;
  }
  async function aiModelBytes(key, onP) {
    var m = (await aiManifest()).models[key]; if (!m) throw new Error('AI file missing: ' + key);
    var cache = null; try { cache = window.caches ? await caches.open('sul-ai-' + AI.manifest.version) : null; } catch (e) { cache = null; }
    var all = new Uint8Array(m.size), off = 0;
    for (var i = 0; i < m.parts.length; i++) {
      var url = new URL(AI.base + m.parts[i], location.href).href, res = cache ? await cache.match(url) : null, fromCache = !!res;
      if (!res) { res = await fetch(url); if (!res.ok) throw new Error('Could not load AI file ' + m.parts[i] + ' (' + res.status + ')'); }
      var reader = res.body.getReader(), start = off;
      while (true) { var ch = await reader.read(); if (ch.done) break; all.set(ch.value, off); off += ch.value.length; if (onP) onP(off / m.size, fromCache); }
      if (cache && !fromCache) { try { await cache.put(url, new Response(all.slice(start, off))); } catch (e) { } }
    }
    return all;
  }
  async function aiSession(key, device, onP) {
    var id = key + '@' + device; if (AI.sessions[id]) return AI.sessions[id];
    var O = await aiRuntime(), bytes = await aiModelBytes(key, onP);
    var sess = await O.InferenceSession.create(bytes, { executionProviders: [device], graphOptimizationLevel: 'all' });
    return (AI.sessions[id] = sess);
  }
  function toHalf(f32) { var out = new Uint16Array(f32.length), fv = new Float32Array(1), iv = new Uint32Array(fv.buffer); for (var i = 0; i < f32.length; i++) { fv[0] = f32[i]; var x = iv[0], sign = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff; if (e <= 0) out[i] = sign; else if (e >= 31) out[i] = sign | 0x7c00; else out[i] = sign | (e << 10) | (m >>> 13); } return out; }
  function fromHalf(u16) { var out = new Float32Array(u16.length); for (var i = 0; i < u16.length; i++) { var h = u16[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; out[i] = e === 0 ? s * Math.pow(2, -14) * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024); } return out; }
  async function aiRun(sess, f32, dims) {
    var O = window.ort, feeds = {}, inName = sess.inputNames[0];
    feeds[inName] = new O.Tensor('float32', f32, dims);
    var res;
    try { res = await sess.run(feeds); }
    catch (e) { if (!/float16|type|Unexpected input data type/i.test(String(e && e.message || e))) throw e; feeds[inName] = new O.Tensor('float16', toHalf(f32), dims); res = await sess.run(feeds); }
    var out = res[sess.outputNames[0]], d = out.data;
    if (out.type === 'float16') d = d instanceof Uint16Array ? fromHalf(d) : Float32Array.from(d);
    return { data: d, dims: out.dims };
  }
  function imageTensor(src, size, mean, std) {
    var c = PixFX.mk(size, size), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, size, size);
    var d = g.getImageData(0, 0, size, size).data, n = size * size, f = new Float32Array(3 * n);
    for (var i = 0; i < n; i++) { f[i] = (d[i * 4] / 255 - mean[0]) / std[0]; f[n + i] = (d[i * 4 + 1] / 255 - mean[1]) / std[1]; f[2 * n + i] = (d[i * 4 + 2] / 255 - mean[2]) / std[2]; }
    return f;
  }
  function bgTool(root, ctx) {
    var S = { engine: 'pro', tol: 28, detail: 4, hardness: 15, grow: 0, feather: 0, specks: 25, holes: false, decon: true, view: 'result', bg: 'clear', bgColor: '#ffffff', brush: 'erase', smart: true, smartTol: 35, size: 40, zoom: 1 };
    var refT = 0, name = 'image', W = 0, H = 0, PW = 0, PH = 0, orig = null, proc = null, procData = null, raw = null, refined = null, fin = null, decon = null, strokes = [], redo = [], busy = false;
    root.innerHTML =
      '<div class="tool-grid"><div class="tool-stage panel">' +
      '<div class="drop" tabindex="0" role="button"><input type="file" accept="image/*" hidden><div class="drop-ico">' + pixelIcon('bgremove') + '</div><strong>DROP A PICTURE HERE</strong><span>or click to choose · paste works too</span><small>Runs on your device — your picture is never uploaded</small></div>' +
      '<div class="stage-view" hidden>' +
      '<div class="stage-bar bg-top"><button type="button" class="btn" data-go>✂ REMOVE BACKGROUND</button><span class="bg-views tc-chips"></span><span class="bg-zoom tc-chips"></span></div>' +
      '<div class="stage-canvas checker bg-stage"></div>' +
      '<div class="progress" hidden><i></i><span></span></div>' +
      '<div class="stage-bar"><button type="button" class="btn btn-sm btn-ghost" data-act="compare">◐ HOLD TO COMPARE</button><button type="button" class="btn btn-sm btn-ghost" data-undo disabled>↶ UNDO</button><button type="button" class="btn btn-sm btn-ghost" data-redo disabled>↷ REDO</button><button type="button" class="btn btn-sm btn-ghost" data-new>⇪ NEW PICTURE</button><span class="stage-status" aria-live="polite"></span></div></div>' +
      '</div><aside class="tool-side panel"><div class="tc-box"></div><div class="tc-head">Refine the cut-out <small>live</small></div><div class="tc-ref"></div><div class="tc-head">Touch up <small>paint on the picture</small></div><div class="tc-brush"></div><div class="tc-head">Background</div><div class="tc-bg"></div>' +
      '<div class="dl-row"><button type="button" class="btn" data-dl="png" disabled>⬇ PNG (transparent)</button><button type="button" class="btn btn-ghost" data-dl="jpg" disabled>JPG</button><button type="button" class="btn btn-sm btn-ghost" data-dl="mask" disabled>MASK</button></div></aside></div>';
    var drop = root.querySelector('.drop'), fi = drop.querySelector('input'), view = root.querySelector('.stage-view'), holder = root.querySelector('.stage-canvas'), status = root.querySelector('.stage-status'), prog = root.querySelector('.progress');
    var disp = PixFX.mk(10, 10); disp.className = 'stage-img'; holder.appendChild(disp);
    function setStatus(t) { status.textContent = t || ''; }
    function setProg(f, label) { prog.hidden = f == null; if (f == null) return; prog.querySelector('i').style.width = Math.round(f * 100) + '%'; prog.querySelector('span').textContent = label || ''; }
    buildControls(root.querySelector('.tc-box'), [
      { k: 'engine', label: 'Remover', type: 'chips', options: [['pro', '★ AI Pro (most accurate)'], ['lite', 'AI Lite (fast)'], ['quick', 'Plain backgrounds']] },
      { k: 'tol', label: 'Colour tolerance', type: 'range', min: 4, max: 90, show: function (s) { return s.engine === 'quick'; }, help: 'For a plain or studio background.' }
    ], S, function () { });
    root.querySelector('.tc-box').insertAdjacentHTML('beforeend', '<small class="tc-help">The AI is built into this site and runs on your device. AI Pro (BiRefNet) is great on hair, fur and fine detail — the first run loads it (≈115 MB with a graphics card, ≈225 MB without; saved after that) and takes a few seconds to ~2 minutes depending on your device. AI Lite is small (5 MB) and quick but less precise.</small>');
    buildControls(root.querySelector('.tc-ref'), [
      { k: 'detail', label: 'Edge detail (hair, fur)', type: 'range', min: 0, max: 10, help: 'Snaps the edge to the real edges in your photo.' },
      { k: 'hardness', label: 'Edge hardness', type: 'range', min: 0, max: 100, unit: '%' },
      { k: 'grow', label: 'Shrink ↔ grow edge', type: 'range', min: -15, max: 15, unit: 'px' },
      { k: 'feather', label: 'Soften edge', type: 'range', min: 0, max: 10, unit: 'px' },
      { k: 'specks', label: 'Remove leftover bits', type: 'range', min: 0, max: 100, unit: '%' },
      { k: 'holes', label: 'Fill holes inside the subject', type: 'toggle' },
      { k: 'decon', label: 'Clean edge colours (no halos)', type: 'toggle' }
    ], S, function () { if (!raw) return; clearTimeout(refT); setStatus('refining…'); refT = setTimeout(refineAll, 160); });
    buildControls(root.querySelector('.tc-brush'), [
      { k: 'brush', label: 'Brush', type: 'chips', options: [['erase', '✕ Erase'], ['restore', '✚ Bring back']] },
      { k: 'smart', label: 'Smart brush (only paints similar colours — follows edges)', type: 'toggle' },
      { k: 'smartTol', label: 'Smart brush tolerance', type: 'range', min: 5, max: 100, show: function (s) { return s.smart; } },
      { k: 'size', label: 'Brush size', type: 'range', min: 4, max: 300, unit: 'px' }
    ], S, function () { });
    buildControls(root.querySelector('.tc-bg'), [
      { k: 'bg', label: 'Fill behind', type: 'chips', options: [['clear', 'Transparent'], ['color', 'Colour'], ['blur', 'Blurred photo'], ['bw', 'B&W photo']] },
      { k: 'bgColor', label: 'Colour', type: 'color', show: function (s) { return s.bg === 'color'; } }
    ], S, function () { draw(); });
    var vb = root.querySelector('.bg-views'), zb = root.querySelector('.bg-zoom');
    vb.innerHTML = [['result', 'Result'], ['overlay', 'Red overlay'], ['mask', 'Mask']].map(function (v) { return '<button type="button" class="tchip' + (v[0] === S.view ? ' is-on' : '') + '" data-view="' + v[0] + '">' + v[1] + '</button>'; }).join('');
    zb.innerHTML = [1, 2, 3, 4].map(function (z) { return '<button type="button" class="tchip' + (z === 1 ? ' is-on' : '') + '" data-zoom="' + z + '">' + z + '×</button>'; }).join('');
    vb.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { S.view = b.getAttribute('data-view'); vb.querySelectorAll('.tchip').forEach(function (x) { x.classList.toggle('is-on', x === b); }); draw(); }); });
    zb.querySelectorAll('[data-zoom]').forEach(function (b) { b.addEventListener('click', function () { S.zoom = +b.getAttribute('data-zoom'); zb.querySelectorAll('.tchip').forEach(function (x) { x.classList.toggle('is-on', x === b); }); holder.classList.toggle('zoomed', S.zoom > 1); disp.style.width = S.zoom > 1 ? (S.zoom * 100) + '%' : ''; }); });
    function enable(on) { root.querySelectorAll('[data-dl]').forEach(function (b) { b.disabled = !on; }); }
    function undoBtns() { root.querySelector('[data-undo]').disabled = !strokes.length; root.querySelector('[data-redo]').disabled = !redo.length; }

    async function takeFile(f) {
      if (!f || !/^image\//.test(f.type || '') && !/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name || '')) { setStatus('⚠ That isn\'t a picture file'); return; }
      var img = await PixFX.loadImage(f).catch(function (e) { alert(e.message); return null; }); if (!img) return;
      name = stem(f.name); orig = PixFX.toCanvas(img, 4096); W = orig.width; H = orig.height;
      proc = PixFX.toCanvas(orig, 2048); PW = proc.width; PH = proc.height; procData = proc.getContext('2d').getImageData(0, 0, PW, PH).data;
      raw = refined = fin = decon = null; strokes = []; redo = []; undoBtns();
      disp.width = PW; disp.height = PH; disp.getContext('2d').drawImage(proc, 0, 0);
      drop.hidden = true; view.hidden = false; enable(false); setStatus(W + ' × ' + H + ' px — press REMOVE BACKGROUND');
    }
    drop.addEventListener('click', function () { fi.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    fi.addEventListener('change', function () { if (fi.files[0]) takeFile(fi.files[0]); fi.value = ''; });
    root.querySelector('[data-new]').addEventListener('click', function () { fi.click(); });
    dropTarget(root.querySelector('.tool-stage'), function (fs) { takeFile(fs[0]); });
    ctx.on(window, 'paste', function (e) { var it = [].slice.call((e.clipboardData || {}).items || []).filter(function (i) { return /^image\//.test(i.type); })[0]; if (it) takeFile(it.getAsFile()); });

    root.querySelector('[data-go]').addEventListener('click', async function () {
      if (!proc || busy) return;
      var btn = this; busy = true; btn.disabled = true; enable(false);
      var order = S.engine === 'pro' ? ['pro', 'lite', 'quick'] : S.engine === 'lite' ? ['lite', 'quick'] : ['quick'], used = null, errs = [], notInst = false;
      for (var i = 0; i < order.length && !used; i++) {
        try {
          if (order[i] === 'pro') raw = await runPro(); else if (order[i] === 'lite') raw = await runLite(); else raw = quickMask();
          used = order[i];
        } catch (e) { console.error(e); if (e && e.notInstalled) notInst = true; errs.push((order[i] === 'pro' ? 'AI Pro' : order[i] === 'lite' ? 'AI Lite' : 'Quick') + ': ' + (e && e.message || e)); if (e && e.notInstalled && order[i] === 'pro') i++; }
      }
      setProg(null);
      if (used) {
        strokes = []; redo = []; undoBtns(); refineAll(); enable(true);
        setStatus((used === S.engine ? 'Done ✓' : 'Done with ' + (used === 'lite' ? 'AI Lite' : 'Plain-background mode') + ' (the better AI couldn\'t run)') + ' — refine or paint to touch up');
        if (used !== S.engine) alert(notInst ? 'The AI isn\'t installed on this site yet, so plain-background mode was used.\n\n(Site owner: run “Install AI files” once in GitHub → Actions.)' : 'The ' + (S.engine === 'pro' ? 'AI Pro' : 'AI Lite') + ' remover couldn\'t run on this device, so a simpler one was used.\n\n' + errs.join('\n') + '\n\nThis usually means the device ran out of memory — try a smaller picture or AI Lite.');
        ctx.api.burst(innerWidth / 2, innerHeight / 2, 24);
      } else alert('Couldn\'t remove the background:\n' + errs.join('\n'));
      busy = false; btn.disabled = false;
    });
    async function runPro() {
      var tries = navigator.gpu ? [['biref16', 'webgpu'], ['biref32', 'wasm']] : [['biref32', 'wasm']], last = null;
      var f = imageTensor(proc, 1024, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]);
      for (var i = 0; i < tries.length; i++) {
        try {
          setProg(0.01, 'Loading AI Pro…');
          var sess = await aiSession(tries[i][0], tries[i][1], function (p, cached) { setProg(p * 0.9, (cached ? 'Opening AI Pro… ' : 'Loading AI Pro (first time only)… ') + Math.round(p * 100) + '%'); });
          setProg(0.93, 'AI is cutting it out… (' + (tries[i][1] === 'webgpu' ? 'graphics card' : 'processor — can take 1–2 minutes') + ')'); await tick();
          var out = await aiRun(sess, f, [1, 3, 1024, 1024]), dm = out.dims, h = dm[dm.length - 2], w = dm[dm.length - 1], g = new Uint8Array(w * h);
          for (var k = 0; k < w * h; k++) g[k] = 255 / (1 + Math.exp(-out.data[k]));
          return rawFromGray(g, w, h, 1);
        } catch (e) { console.warn('AI Pro attempt failed', tries[i], e); last = e; if (e && e.notInstalled) throw e; }
      }
      throw last || new Error('AI Pro failed');
    }
    async function runLite() {
      setProg(0.01, 'Loading AI Lite…');
      var sess = await aiSession('u2netp', 'wasm', function (p) { setProg(p * 0.8, 'Loading AI Lite… ' + Math.round(p * 100) + '%'); });
      setProg(0.85, 'AI Lite is cutting it out…'); await tick();
      var out = await aiRun(sess, imageTensor(proc, 320, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]), [1, 3, 320, 320]);
      var dm = out.dims, h = dm[dm.length - 2], w = dm[dm.length - 1], mn = Infinity, mx = -Infinity, k, g = new Uint8Array(w * h);
      for (k = 0; k < w * h; k++) { mn = Math.min(mn, out.data[k]); mx = Math.max(mx, out.data[k]); }
      for (k = 0; k < w * h; k++) g[k] = 255 * (out.data[k] - mn) / Math.max(1e-6, mx - mn);
      return rawFromGray(g, w, h, 1);
    }
    function rawFromGray(d, w, h, ch) {
      var c = PixFX.mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
      for (var i = 0; i < w * h; i++) { var v = d[i * ch]; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
      g.putImageData(id, 0, 0);
      var big = PixFX.mk(PW, PH), bg = big.getContext('2d'); bg.imageSmoothingQuality = 'high'; bg.drawImage(c, 0, 0, PW, PH);
      return PixFX.Mask.fromGray(big);
    }
    function quickMask() {
      var d = procData, w = PW, h = PH, N = w * h, seen = new Uint8Array(N), q = new Int32Array(N), qh = 0, qt = 0, x, y, i;
      var tol = S.tol * S.tol * 3, cols = [];
      for (x = 0; x < w; x += Math.max(1, w >> 6)) { cols.push(x); cols.push((h - 1) * w + x); }
      for (y = 0; y < h; y += Math.max(1, h >> 6)) { cols.push(y * w); cols.push(y * w + w - 1); }
      cols = cols.map(function (p) { return [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]; });
      function near(p) { if (d[p * 4 + 3] < 20) return true; var r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]; for (var k = 0; k < cols.length; k++) { var c = cols[k], dr = r - c[0], dg = g - c[1], db = b - c[2]; if (dr * dr + dg * dg + db * db < tol) return true; } return false; }
      function push(p) { if (!seen[p] && near(p)) { seen[p] = 1; q[qt++] = p; } }
      for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (qh < qt) { var p = q[qh++]; x = p % w; y = (p / w) | 0; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w); }
      var a = new Float32Array(N); for (i = 0; i < N; i++) a[i] = seen[i] ? 0 : 1;
      return PixFX.Mask.box(a, w, h, 1);
    }
    // ---- refine → strokes → draw ----
    function refineAll() {
      setStatus('refining…');
      refined = PixFX.Mask.refine(raw, proc, PW, PH, { detail: S.detail, hardness: S.hardness, grow: S.grow, feather: S.feather, specks: S.specks, holes: S.holes });
      replay(); setStatus('✓ ready');
    }
    function replay() { fin = refined.slice(); strokes.forEach(function (st) { applyStroke(st, 0); }); finish(); }
    function finish() { decon = S.decon ? PixFX.Mask.decontaminate(proc, fin, PW, PH) : null; draw(); }
    function applyStroke(st, from) { for (var i = from; i < st.pts.length; i++) { var p = st.pts[i], q = i ? st.pts[i - 1] : p, dist = Math.hypot(p[0] - q[0], p[1] - q[1]), n = Math.max(1, Math.ceil(dist / Math.max(1, st.r / 3))); for (var k = 1; k <= n; k++) dab(st, q[0] + (p[0] - q[0]) * k / n, q[1] + (p[1] - q[1]) * k / n); } }
    function dab(st, cx, cy) {
      var r = st.r, x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(PW - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(PH - 1, Math.ceil(cy + r)), t2 = st.tol * st.tol * 3;
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        var dd = Math.hypot(x - cx, y - cy); if (dd > r) continue;
        var w = Math.min(1, (r - dd) / Math.max(1, r * 0.3)), i = y * PW + x;
        if (st.smart) { var j = i * 4, dr = procData[j] - st.seed[0], dg = procData[j + 1] - st.seed[1], db = procData[j + 2] - st.seed[2], cd = dr * dr + dg * dg + db * db; if (cd > t2 * 2.25) continue; if (cd > t2) w *= 1 - (cd - t2) / (t2 * 1.25); }
        if (st.mode === 'restore') fin[i] = Math.max(fin[i], w); else fin[i] = Math.min(fin[i], 1 - w);
      }
    }
    function cutout(target, tw, th, srcImg) { // draws the cut-out subject onto target
      var g = target.getContext('2d'), c = PixFX.mk(tw, th), cg = c.getContext('2d');
      cg.imageSmoothingQuality = 'high'; cg.drawImage(srcImg, 0, 0, tw, th);
      if (decon) cg.drawImage(decon, 0, 0, tw, th);
      cg.globalCompositeOperation = 'destination-in'; cg.drawImage(PixFX.Mask.toCanvas(fin, PW, PH), 0, 0, tw, th);
      g.drawImage(c, 0, 0);
    }
    function fillBg(target, tw, th, srcImg) {
      var g = target.getContext('2d');
      if (S.bg === 'color') { g.fillStyle = S.bgColor; g.fillRect(0, 0, tw, th); }
      else if (S.bg === 'blur') g.drawImage(PixFX.blur(PixFX.adjust(PixFX.toCanvas(srcImg, 1400), { brightness: -8 }), 14), 0, 0, tw, th);
      else if (S.bg === 'bw') g.drawImage(PixFX.adjust(PixFX.toCanvas(srcImg, 2048), { saturation: -100, contrast: 10 }), 0, 0, tw, th);
    }
    function draw() {
      if (!fin) return;
      var g = disp.getContext('2d'); g.clearRect(0, 0, PW, PH);
      if (S.view === 'mask') { g.fillStyle = '#000'; g.fillRect(0, 0, PW, PH); g.drawImage(PixFX.Mask.toCanvas(fin, PW, PH), 0, 0); return; }
      if (S.view === 'overlay') {
        g.drawImage(proc, 0, 0);
        var red = PixFX.mk(PW, PH), rg = red.getContext('2d'); rg.fillStyle = 'rgba(255,30,90,.6)'; rg.fillRect(0, 0, PW, PH); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(PixFX.Mask.toCanvas(fin, PW, PH), 0, 0);
        g.drawImage(red, 0, 0); return;
      }
      fillBg(disp, PW, PH, proc); cutout(disp, PW, PH, proc);
    }
    // ---- brush ----
    var cur = null, rafP = 0;
    function pos(e) { var r = disp.getBoundingClientRect(); return [(e.clientX - r.left) * PW / r.width, (e.clientY - r.top) * PH / r.height, PW / r.width]; }
    disp.addEventListener('pointerdown', function (e) {
      if (!fin) return; e.preventDefault();
      var p = pos(e), j = (Math.min(PH - 1, Math.max(0, Math.round(p[1]))) * PW + Math.min(PW - 1, Math.max(0, Math.round(p[0])))) * 4;
      cur = { mode: S.brush, smart: S.smart, tol: S.smartTol, r: S.size / 2 * p[2], seed: [procData[j], procData[j + 1], procData[j + 2]], pts: [[p[0], p[1]]] };
      disp.setPointerCapture(e.pointerId); applyStroke(cur, 0); draw();
    });
    disp.addEventListener('pointermove', function (e) {
      if (!cur) return; var p = pos(e); cur.pts.push([p[0], p[1]]); applyStroke(cur, cur.pts.length - 1);
      if (!rafP) rafP = requestAnimationFrame(function () { rafP = 0; draw(); });
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) { disp.addEventListener(ev, function () { if (!cur) return; strokes.push(cur); redo = []; cur = null; undoBtns(); finish(); }); });
    root.querySelector('[data-undo]').addEventListener('click', function () { if (!strokes.length) return; redo.push(strokes.pop()); undoBtns(); replay(); });
    root.querySelector('[data-redo]').addEventListener('click', function () { if (!redo.length) return; strokes.push(redo.pop()); undoBtns(); replay(); });
    ctx.on(window, 'keydown', function (e) { if (!fin || !(e.ctrlKey || e.metaKey) || /input|select|textarea/i.test((e.target || {}).tagName || '')) return; var k = e.key.toLowerCase(); if (k === 'z' && !e.shiftKey) { e.preventDefault(); root.querySelector('[data-undo]').click(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); root.querySelector('[data-redo]').click(); } });
    var cmp = root.querySelector('[data-act=compare]');
    cmp.addEventListener('pointerdown', function () { if (proc) { var g = disp.getContext('2d'); g.clearRect(0, 0, PW, PH); g.drawImage(proc, 0, 0); } });
    ['pointerup', 'pointerleave'].forEach(function (ev) { cmp.addEventListener(ev, function () { draw(); }); });
    root.querySelectorAll('[data-dl]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!fin) return;
        var t = b.getAttribute('data-dl'), c = PixFX.mk(W, H), g = c.getContext('2d');
        if (t === 'mask') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high'; g.drawImage(PixFX.Mask.toCanvas(fin, PW, PH), 0, 0, W, H); return download(await canvasBlob(c, 'image/png'), name + '-mask.png'); }
        if (t === 'jpg' && S.bg === 'clear') { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
        fillBg(c, W, H, orig); cutout(c, W, H, orig);
        download(await canvasBlob(c, t === 'png' ? 'image/png' : 'image/jpeg', 0.95), name + '-nobg.' + t);
      });
    });
  }

  /* =========================================================
     FILE CONVERTER
     ========================================================= */
  var AUDIO_EXT = /\.(mp4|m4a|mov|webm|mkv|mp3|wav|wave|ogg|oga|opus|flac|aac|aif|aiff|caf|3gp|m4v|wma)$/i, IMG_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico|tiff?)$/i;
  function kindOf(f) { var t = f.type || ''; if (/^image\//.test(t) || IMG_EXT.test(f.name)) return 'image'; if (/^(audio|video)\//.test(t) || AUDIO_EXT.test(f.name)) return 'audio'; return 'other'; }
  function encodeWAV(buf, bits) {
    var ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length, bps = bits / 8, block = ch * bps, dataLen = len * block;
    var hd = new DataView(new ArrayBuffer(44)), w = function (o, s) { for (var i = 0; i < s.length; i++) hd.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); hd.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt '); hd.setUint32(16, 16, true);
    hd.setUint16(20, bits === 32 ? 3 : 1, true); hd.setUint16(22, ch, true); hd.setUint32(24, sr, true); hd.setUint32(28, sr * block, true); hd.setUint16(32, block, true); hd.setUint16(34, bits, true);
    w(36, 'data'); hd.setUint32(40, dataLen, true);
    var parts = [hd.buffer], chans = []; for (var c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    var CH = 262144;
    for (var s = 0; s < len; s += CH) {
      var n = Math.min(CH, len - s), dv = new DataView(new ArrayBuffer(n * block)), o = 0;
      for (var i = 0; i < n; i++) for (c = 0; c < ch; c++) {
        var v = chans[c][s + i]; v = v > 1 ? 1 : v < -1 ? -1 : v;
        if (bits === 16) { dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
        else if (bits === 24) { var x = Math.round(v < 0 ? v * 8388608 : v * 8388607); dv.setUint8(o, x & 255); dv.setUint8(o + 1, (x >> 8) & 255); dv.setUint8(o + 2, (x >> 16) & 255); o += 3; }
        else { dv.setFloat32(o, v, true); o += 4; }
      }
      parts.push(dv.buffer);
    }
    return new Blob(parts, { type: 'audio/wav' });
  }
  async function encodeMP3(buf, kbps, onP) {
    if (!window.lamejs) { try { await loadScript('assets/vendor/lame.min.js'); } catch (e0) { } }
    if (!window.lamejs) { try { await loadScript(LIBS.lame); } catch (e) { throw new Error('The MP3 encoder couldn\'t download (check your internet) — WAV still works.'); } }
    if (!window.lamejs || !window.lamejs.Mp3Encoder) throw new Error('MP3 encoder failed to load (check your connection) — WAV still works.');
    var ch = Math.min(2, buf.numberOfChannels), enc = new window.lamejs.Mp3Encoder(ch, buf.sampleRate, kbps), out = [];
    var L = buf.getChannelData(0), R = ch > 1 ? buf.getChannelData(1) : null, BL = 1152 * 20;
    function i16(a, s, n) { var o = new Int16Array(n); for (var i = 0; i < n; i++) { var v = a[s + i]; v = v > 1 ? 1 : v < -1 ? -1 : v; o[i] = v < 0 ? v * 32768 : v * 32767; } return o; }
    for (var s = 0; s < buf.length; s += BL) {
      var n = Math.min(BL, buf.length - s), mp = R ? enc.encodeBuffer(i16(L, s, n), i16(R, s, n)) : enc.encodeBuffer(i16(L, s, n));
      if (mp.length) out.push(new Uint8Array(mp));
      if ((s / BL) % 10 === 0) { onP(s / buf.length); await tick(); }
    }
    var f = enc.flush(); if (f.length) out.push(new Uint8Array(f));
    return new Blob(out, { type: 'audio/mpeg' });
  }
  async function decodeAudio(file, rate, chans) {
    var ab = await file.arrayBuffer();
    var ctxA = new OfflineAudioContext(2, 1, rate);
    var buf = await new Promise(function (res, rej) { var p = ctxA.decodeAudioData(ab, res, function (e) { rej(e || new Error('decode failed')); }); if (p && p.then) p.then(res, rej); });
    var want = chans === 'mono' ? 1 : chans === 'stereo' ? 2 : Math.min(2, buf.numberOfChannels);
    if (want !== buf.numberOfChannels) {
      var oc = new OfflineAudioContext(want, buf.length, rate), s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start(); buf = await oc.startRendering();
    }
    return buf;
  }
  function normalizeBuf(buf) { var peak = 0, c, i; for (c = 0; c < buf.numberOfChannels; c++) { var d = buf.getChannelData(c); for (i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; } } if (peak > 0 && peak < 0.999) { var k = 0.989 / peak; for (c = 0; c < buf.numberOfChannels; c++) { d = buf.getChannelData(c); for (i = 0; i < d.length; i++) d[i] *= k; } } }
  function bmpBlob(c) {
    var w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, row = w * 4, size = 54 + row * h, dv = new DataView(new ArrayBuffer(size));
    dv.setUint16(0, 0x4d42, true); dv.setUint32(2, size, true); dv.setUint32(10, 54, true); dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(26, 1, true); dv.setUint16(28, 32, true); dv.setUint32(34, row * h, true); dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var s = ((h - 1 - y) * w + x) * 4, o = 54 + y * row + x * 4; dv.setUint8(o, d[s + 2]); dv.setUint8(o + 1, d[s + 1]); dv.setUint8(o + 2, d[s]); dv.setUint8(o + 3, d[s + 3]); }
    return new Blob([dv.buffer], { type: 'image/bmp' });
  }
  async function icoBlob(c, sizes) {
    var pngs = [];
    for (var i = 0; i < sizes.length; i++) { var s = sizes[i], k = PixFX.mk(s, s), g = k.getContext('2d'), r = Math.min(s / c.width, s / c.height); g.imageSmoothingQuality = 'high'; g.drawImage(c, (s - c.width * r) / 2, (s - c.height * r) / 2, c.width * r, c.height * r); pngs.push(new Uint8Array(await (await canvasBlob(k, 'image/png')).arrayBuffer())); }
    var hd = new DataView(new ArrayBuffer(6 + 16 * sizes.length)), off = hd.byteLength;
    hd.setUint16(2, 1, true); hd.setUint16(4, sizes.length, true);
    sizes.forEach(function (s, i) { var o = 6 + i * 16; hd.setUint8(o, s >= 256 ? 0 : s); hd.setUint8(o + 1, s >= 256 ? 0 : s); hd.setUint16(o + 4, 1, true); hd.setUint16(o + 6, 32, true); hd.setUint32(o + 8, pngs[i].length, true); hd.setUint32(o + 12, off, true); off += pngs[i].length; });
    return new Blob([hd.buffer].concat(pngs), { type: 'image/x-icon' });
  }
  // minimal PDF: one page per picture (JPEG inside)
  async function pdfBlob(canvases) {
    var enc = new TextEncoder(), parts = [], offs = [], pos = 0, objs = [];
    function add(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; }
    var n = canvases.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    offs[1] = pos; add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offs[2] = pos; add('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n');
    for (i = 0; i < n; i++) {
      var c = canvases[i], flat = PixFX.mk(c.width, c.height), g = flat.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(c, 0, 0);
      var jpg = new Uint8Array(await (await canvasBlob(flat, 'image/jpeg', 0.92)).arrayBuffer());
      var pw = c.width * 0.75, ph = c.height * 0.75, pid = 3 + i * 3, iid = pid + 1, cid = pid + 2;
      var content = 'q ' + pw.toFixed(2) + ' 0 0 ' + ph.toFixed(2) + ' 0 0 cm /Im0 Do Q';
      offs[pid] = pos; add(pid + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw.toFixed(2) + ' ' + ph.toFixed(2) + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>\nendobj\n');
      offs[iid] = pos; add(iid + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + c.width + ' /Height ' + c.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); add(jpg); add('\nendstream\nendobj\n');
      offs[cid] = pos; add(cid + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
    }
    var total = 3 + n * 3, xref = pos, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    add(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function convertTool(root, ctx) {
    var S = { aFmt: 'mp3', kbps: 320, bits: 16, rate: 44100, chans: 'keep', norm: false, iFmt: 'png', quality: 92, maxW: 0, icoSize: 256, onePdf: false };
    var jobs = [];
    root.innerHTML =
      '<div class="tool-grid"><div class="tool-stage panel">' +
      '<div class="drop drop-sm" tabindex="0" role="button"><input type="file" multiple hidden><div class="drop-ico">' + pixelIcon('convert') + '</div><strong>DROP FILES HERE</strong><span>videos & audio → MP3 / WAV · pictures → PNG / JPG / WEBP / BMP / ICO / PDF</span><small>Drop as many as you like · nothing is uploaded</small></div>' +
      '<div class="conv-list"></div>' +
      '<div class="dl-row conv-actions" hidden><button type="button" class="btn" data-run>⚡ CONVERT ALL</button><button type="button" class="btn btn-ghost" data-zip disabled>⬇ DOWNLOAD ALL (.zip)</button><button type="button" class="btn btn-sm btn-ghost" data-clear>✕ CLEAR</button></div>' +
      '</div><aside class="tool-side panel"><div class="tc-head">🎧 Audio & video</div><div class="tc-a"></div><div class="tc-head">🖼 Pictures</div><div class="tc-i"></div></aside></div>';
    buildControls(root.querySelector('.tc-a'), [
      { k: 'aFmt', label: 'Convert to', type: 'chips', options: [['mp3', 'MP3'], ['wav', 'WAV']] },
      { k: 'kbps', label: 'MP3 quality', type: 'chips', num: true, options: [[128, '128 kbps'], [192, '192 kbps'], [256, '256 kbps'], [320, '320 kbps']], show: function (s) { return s.aFmt === 'mp3'; } },
      { k: 'bits', label: 'WAV bit depth', type: 'chips', num: true, options: [[16, '16-bit'], [24, '24-bit'], [32, '32-bit float']], show: function (s) { return s.aFmt === 'wav'; } },
      { k: 'rate', label: 'Sample rate', type: 'chips', num: true, options: [[44100, '44.1 kHz'], [48000, '48 kHz'], [22050, '22 kHz']].concat([[96000, '96 kHz']]) },
      { k: 'chans', label: 'Channels', type: 'chips', options: [['keep', 'Keep'], ['stereo', 'Stereo'], ['mono', 'Mono']] },
      { k: 'norm', label: 'Normalize volume (loudest peak to -0.1 dB)', type: 'toggle' }
    ], S, refreshLabels);
    buildControls(root.querySelector('.tc-i'), [
      { k: 'iFmt', label: 'Convert to', type: 'chips', options: [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WEBP'], ['bmp', 'BMP'], ['ico', 'ICO (icon)'], ['pdf', 'PDF']] },
      { k: 'quality', label: 'Quality', type: 'range', min: 40, max: 100, unit: '%', show: function (s) { return s.iFmt === 'jpg' || s.iFmt === 'webp'; } },
      { k: 'icoSize', label: 'Icon size', type: 'chips', num: true, options: [[16, '16'], [32, '32'], [48, '48'], [64, '64'], [128, '128'], [256, '256 (+all sizes)']], show: function (s) { return s.iFmt === 'ico'; } },
      { k: 'maxW', label: 'Resize longest side (0 = keep)', type: 'range', min: 0, max: 4000, step: 50, unit: 'px', show: function (s) { return s.iFmt !== 'ico'; } },
      { k: 'onePdf', label: 'Put all pictures in ONE PDF', type: 'toggle', show: function (s) { return s.iFmt === 'pdf'; } }
    ], S, refreshLabels);
    if (S.rate === 96000 && S.aFmt === 'mp3') S.rate = 48000;
    var drop = root.querySelector('.drop'), fi = drop.querySelector('input'), list = root.querySelector('.conv-list'), acts = root.querySelector('.conv-actions');
    drop.addEventListener('click', function () { fi.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    fi.addEventListener('change', function () { addFiles([].slice.call(fi.files)); fi.value = ''; });
    dropTarget(root.querySelector('.tool-stage'), addFiles);
    function target(j) { return j.kind === 'image' ? S.iFmt : j.kind === 'audio' ? S.aFmt : null; }
    function refreshLabels() { jobs.forEach(function (j) { if (j.state !== 'done') j.el.querySelector('.cj-to').textContent = j.kind === 'other' ? 'not supported' : '→ ' + target(j).toUpperCase(); }); }
    function addFiles(fs) {
      fs.forEach(function (f) {
        var j = { f: f, kind: kindOf(f), state: 'ready', out: null };
        j.el = h('div', { class: 'conv-job k-' + j.kind });
        j.el.innerHTML = '<span class="cj-ico">' + (j.kind === 'image' ? '🖼' : j.kind === 'audio' ? (/^video|\.(mp4|mov|webm|mkv|m4v)$/i.test(f.type + ' ' + f.name) ? '🎬' : '🎵') : '❔') + '</span><span class="cj-name"><strong></strong><small>' + fmtBytes(f.size) + '</small></span><span class="cj-to"></span><span class="cj-bar"><i></i></span><span class="cj-act"></span><button type="button" class="cj-x" aria-label="Remove">✕</button>';
        j.el.querySelector('strong').textContent = f.name;
        j.el.querySelector('.cj-x').addEventListener('click', function () { jobs.splice(jobs.indexOf(j), 1); j.el.remove(); acts.hidden = !jobs.length; });
        if (j.kind === 'audio' && f.size > 1.5e9) j.el.querySelector('.cj-act').textContent = '⚠ very big file — may run out of memory';
        list.appendChild(j.el); jobs.push(j);
      });
      refreshLabels(); acts.hidden = !jobs.length;
    }
    function setJob(j, f, label) { j.el.querySelector('.cj-bar i').style.width = Math.round(f * 100) + '%'; if (label != null) j.el.querySelector('.cj-act').textContent = label; }
    function finish(j, blob, nm) {
      j.state = 'done'; j.out = new File([blob], nm, { type: blob.type });
      setJob(j, 1, ''); var a = j.el.querySelector('.cj-act'); a.innerHTML = '';
      var b = h('button', { type: 'button', class: 'btn btn-sm' }, '⬇ ' + E(nm.split('.').pop().toUpperCase()) + ' · ' + fmtBytes(blob.size));
      b.addEventListener('click', function () { download(blob, nm); }); a.appendChild(b);
      j.el.classList.add('is-done');
    }
    async function imageCanvas(f) {
      var im = await PixFX.loadImage(f), c = PixFX.toCanvas(im, S.maxW > 0 ? S.maxW : 8192);
      return c;
    }
    root.querySelector('[data-run]').addEventListener('click', async function () {
      var btn = this; btn.disabled = true;
      var pdfPages = [], pdfJobs = [];
      for (var k = 0; k < jobs.length; k++) {
        var j = jobs[k];
        if (j.kind === 'other') { setJob(j, 0, 'Can\'t convert this type'); continue; }
        var fmt = target(j); j.el.classList.remove('is-done', 'is-err'); setJob(j, 0.05, 'Working…');
        try {
          if (j.kind === 'image') {
            var c = await imageCanvas(j.f);
            if (fmt === 'pdf' && S.onePdf) { pdfPages.push(c); pdfJobs.push(j); setJob(j, 0.6, 'Added to PDF'); continue; }
            var blob;
            if (fmt === 'png') blob = await canvasBlob(c, 'image/png');
            else if (fmt === 'jpg') { var fl = PixFX.mk(c.width, c.height), g = fl.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(c, 0, 0); blob = await canvasBlob(fl, 'image/jpeg', S.quality / 100); }
            else if (fmt === 'webp') { blob = await canvasBlob(c, 'image/webp', S.quality / 100); if (blob.type !== 'image/webp') throw new Error('Your browser can\'t make WEBP'); }
            else if (fmt === 'bmp') blob = bmpBlob(c);
            else if (fmt === 'ico') blob = await icoBlob(c, S.icoSize === 256 ? [16, 32, 48, 64, 128, 256] : [S.icoSize]);
            else blob = await pdfBlob([c]);
            finish(j, blob, stem(j.f.name) + '.' + fmt);
          } else {
            setJob(j, 0.1, 'Reading audio…');
            var rate = fmt === 'mp3' && S.rate > 48000 ? 48000 : S.rate;
            var buf = await decodeAudio(j.f, rate, S.chans).catch(function () { throw new Error('No audio found, or this format can\'t be read by your browser'); });
            if (S.norm) normalizeBuf(buf);
            setJob(j, 0.3, 'Encoding…'); await tick();
            var out = fmt === 'wav' ? encodeWAV(buf, S.bits) : await encodeMP3(buf, S.kbps, function (f) { setJob(j, 0.3 + f * 0.7); });
            finish(j, out, stem(j.f.name) + '.' + fmt);
          }
        } catch (e) { console.error(e); j.el.classList.add('is-err'); setJob(j, 0, '⚠ ' + (e.message || e)); }
      }
      if (pdfPages.length) { var pdf = await pdfBlob(pdfPages); pdfJobs.forEach(function (j2, i) { if (i === 0) finish(j2, pdf, 'pictures.pdf'); else { j2.state = 'done'; setJob(j2, 1, 'In pictures.pdf ↑'); } }); }
      btn.disabled = false; root.querySelector('[data-zip]').disabled = !jobs.some(function (j3) { return j3.out; });
      ctx.api.burst(innerWidth / 2, innerHeight / 2, 16);
    });
    root.querySelector('[data-zip]').addEventListener('click', async function () {
      var files = jobs.filter(function (j) { return j.out; }).map(function (j) { return j.out; });
      if (!files.length) return;
      var z = ZipFix.fromFiles(files), p = ZipFix.plan(z, {}), blob = await ZipFix.write(z, p.rows);
      download(blob, 'converted.zip');
    });
    root.querySelector('[data-clear]').addEventListener('click', function () { jobs = []; list.innerHTML = ''; acts.hidden = true; });
  }

  /* =========================================================
     ZIP RENAMER
     ========================================================= */
  var ICONS = ['@', '✦', '✧', '★', '☆', '♡', '❤', '♪', '♫', '⚡', '☁', '☾', '✿', '❀', '⛓', '†', '✝', '✞', '♛', '☠', '⚔', '∞', '·', '•', '|', '~', '#', '+', '×', '»', '«', '【', '】', '「', '」', '〔', '〕', '꒰', '꒱', '🔥', '💎', '💫', '⭐', '🌙', '☄️', '🦋', '🎹', '🥁', '🎧', '🎵', '🎤', '🎸', '🔊', '💿', '📀', '👑', '💀', '🖤', '💜', '💗', '🩷', '🩵', '🌸', '🍒', '🧸', '🎀', '⚠️', '✅', '🆕', '🔒'];
  var ZR_DEF = { prefix: '', prefixSep: ' ', suffix: '', suffixSep: ' ', skipIfHas: true, replace: [{ find: '', with: '', regex: false, caseSens: false }], stripNumbers: false, stripBrackets: false, stripTags: false, removeChars: '', trim: true, caseMode: 'keep', spaces: 'keep', numbering: 'off', numStart: 1, numStep: 1, numPad: 2, numSep: ' ', numBefore: '', numAfter: '', numOrder: 'zip', numPerFolder: false, extMode: 'keep', extCustom: '', onlyExt: '', onlyFolder: '', onlyContains: '', folders: false, dropJunk: true, outName: '' };
  function renameTool(root, ctx) {
    var R; try { R = Object.assign({}, ZR_DEF, JSON.parse(localStorage.getItem('sul.zr') || '{}')); } catch (e) { R = Object.assign({}, ZR_DEF); }
    if (!Array.isArray(R.replace) || !R.replace.length) R.replace = [{ find: '', with: '' }];
    R.outName = '';
    var Z = null, manual = {}, planRes = null, page = 0, PER = 200, filt = '', onlyChanged = false, iconTarget = 'prefix', srcName = 'renamed';
    root.innerHTML =
      '<div class="zr">' +
      '<div class="zr-rules panel"><div class="zr-r-main"></div></div>' +
      '<div class="zr-main panel">' +
      '<div class="drop drop-sm" tabindex="0" role="button"><input type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden><input type="file" multiple hidden data-loose><div class="drop-ico">' + pixelIcon('rename') + '</div><strong>DROP A .ZIP HERE</strong><span>any size — even multi-GB kits · or <button type="button" class="linkish" data-pick-loose>pick loose files</button></span><small>Files inside are copied exactly — nothing is re-compressed or uploaded</small></div>' +
      '<div class="zr-view" hidden>' +
      '<div class="zr-info"><strong class="zr-name"></strong><span class="zr-stats"></span><button type="button" class="btn btn-sm btn-ghost" data-newzip>⇪ OTHER ZIP</button></div>' +
      '<div class="zr-tools"><input type="search" placeholder="Search files…" aria-label="Search files"><label class="tc-inline"><input type="checkbox" data-changed><span class="tc-sw"></span><span class="tc-l">Only show changed</span></label></div>' +
      '<div class="zr-table" role="table" aria-label="Rename preview"></div><div class="zr-pager"></div>' +
      '<div class="zr-out"><label class="tc"><span class="tc-l">Download as</span><input type="text" data-outname maxlength="120"></label>' +
      '<button type="button" class="btn" data-export>⬇ DOWNLOAD RENAMED ZIP</button></div><div class="progress" hidden><i></i><span></span></div><p class="zr-warn" aria-live="polite"></p>' +
      '</div></div></div>';
    var rulesBox = root.querySelector('.zr-r-main'), drop = root.querySelector('.drop'), fiZip = drop.querySelector('input:not([data-loose])'), fiLoose = drop.querySelector('[data-loose]');
    var view = root.querySelector('.zr-view'), table = root.querySelector('.zr-table'), pager = root.querySelector('.zr-pager'), warn = root.querySelector('.zr-warn'), prog = root.querySelector('.progress');
    function save() { try { var c = Object.assign({}, R); delete c.outName; localStorage.setItem('sul.zr', JSON.stringify(c)); } catch (e) { } }
    var upd = 0; function changed() { save(); cancelAnimationFrame(upd); upd = requestAnimationFrame(refresh); }

    // ---- rules UI ----
    function buildRules() {
      rulesBox.innerHTML = '';
      var sep = [[' ', 'space'], ['', 'none'], [' - ', ' - '], ['_', '_'], ['-', '-'], ['.', '.'], [' | ', ' | '], [' ✦ ', ' ✦ ']];
      var sec = function (t, open) { var d = h('details', { class: 'zr-sec' }); if (open) d.open = true; d.innerHTML = '<summary>' + t + '</summary><div class="zr-body"></div>'; rulesBox.appendChild(d); return d.querySelector('.zr-body'); };
      var b1 = sec('✚ Add text', true);
      buildControls(b1, [
        { k: 'prefix', label: 'Add to the START of every name', type: 'text', max: 60, placeholder: 'e.g. @SUL' },
        { k: 'prefixSep', label: 'Gap after it', type: 'chips', options: sep, show: function (s) { return !!s.prefix; } },
        { k: 'suffix', label: 'Add to the END (before .wav)', type: 'text', max: 60, placeholder: 'e.g. (prod. SUL)' },
        { k: 'suffixSep', label: 'Gap before it', type: 'chips', options: sep, show: function (s) { return !!s.suffix; } },
        { k: 'skipIfHas', label: 'Don\'t add it twice if a name already has it', type: 'toggle' }
      ], R, function () { changed(); });
      var ic = h('div', { class: 'zr-icons' });
      ic.innerHTML = '<div class="tc-l">Icons & symbols <span class="zr-it">insert into: <button type="button" class="tchip is-on" data-it="prefix">start</button><button type="button" class="tchip" data-it="suffix">end</button></span></div><div class="zr-icon-grid">' + ICONS.map(function (x) { return '<button type="button" class="zr-ic" data-ic="' + E(x) + '" title="Add ' + E(x) + '">' + E(x) + '</button>'; }).join('') + '</div>';
      ic.querySelectorAll('[data-it]').forEach(function (b) { b.addEventListener('click', function () { iconTarget = b.getAttribute('data-it'); ic.querySelectorAll('[data-it]').forEach(function (x) { x.classList.toggle('is-on', x === b); }); }); });
      ic.querySelectorAll('[data-ic]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = iconTarget, inp = b1.querySelectorAll('input[type=text]')[k === 'prefix' ? 0 : 1], v = inp.value, at = inp.selectionStart == null || document.activeElement !== inp ? (k === 'prefix' ? v.length : 0) : inp.selectionStart;
          inp.value = v.slice(0, at) + b.getAttribute('data-ic') + v.slice(at); inp.dispatchEvent(new Event('input'));
        });
      });
      b1.appendChild(ic);
      var b2 = sec('⇄ Find & replace');
      function drawRep() {
        var box = b2.querySelector('.zr-reps') || b2.appendChild(h('div', { class: 'zr-reps' }));
        box.innerHTML = '';
        R.replace.forEach(function (rr, i) {
          var row = h('div', { class: 'zr-rep' });
          row.innerHTML = '<input type="text" placeholder="Find" aria-label="Find"><span>→</span><input type="text" placeholder="Replace with (empty = delete)" aria-label="Replace with"><button type="button" aria-label="Remove rule">✕</button>' +
            '<label class="tc-inline"><input type="checkbox" data-rx><span class="tc-sw"></span><span class="tc-l">Regex</span></label><label class="tc-inline"><input type="checkbox" data-cs><span class="tc-sw"></span><span class="tc-l">Match case</span></label>';
          var ins = row.querySelectorAll('input[type=text]'); ins[0].value = rr.find || ''; ins[1].value = rr.with || '';
          row.querySelector('[data-rx]').checked = !!rr.regex; row.querySelector('[data-cs]').checked = !!rr.caseSens;
          ins[0].addEventListener('input', function () { rr.find = ins[0].value; changed(); });
          ins[1].addEventListener('input', function () { rr.with = ins[1].value; changed(); });
          row.querySelector('[data-rx]').addEventListener('change', function (e) { rr.regex = e.target.checked; changed(); });
          row.querySelector('[data-cs]').addEventListener('change', function (e) { rr.caseSens = e.target.checked; changed(); });
          row.querySelector('button').addEventListener('click', function () { R.replace.splice(i, 1); if (!R.replace.length) R.replace.push({ find: '', with: '' }); drawRep(); changed(); });
          box.appendChild(row);
        });
        var add = h('button', { type: 'button', class: 'btn btn-sm btn-ghost' }, '＋ ANOTHER RULE'); add.addEventListener('click', function () { R.replace.push({ find: '', with: '' }); drawRep(); }); box.appendChild(add);
      }
      drawRep();
      var b3 = sec('✂ Clean up');
      buildControls(b3, [
        { k: 'caseMode', label: 'Letters', type: 'chips', options: [['keep', 'Keep'], ['upper', 'UPPER'], ['lower', 'lower'], ['title', 'Title Case'], ['sentence', 'Sentence']] },
        { k: 'spaces', label: 'Spaces', type: 'chips', options: [['keep', 'Keep'], ['underscore', '→ _'], ['dash', '→ -'], ['dot', '→ .'], ['none', 'Remove']] },
        { k: 'stripNumbers', label: 'Remove numbers at the start (01 -, [3], 12.)', type: 'toggle' },
        { k: 'stripBrackets', label: 'Remove anything in ( ) or [ ]', type: 'toggle' },
        { k: 'stripTags', label: 'Remove old @tags', type: 'toggle' },
        { k: 'removeChars', label: 'Remove these characters', type: 'text', max: 40, placeholder: 'e.g. #!~' },
        { k: 'trim', label: 'Tidy double spaces', type: 'toggle' }
      ], R, function () { changed(); });
      var b4 = sec('# Numbering');
      buildControls(b4, [
        { k: 'numbering', label: 'Add numbers', type: 'chips', options: [['off', 'Off'], ['start', 'At start'], ['end', 'At end']] },
        { k: 'numStart', label: 'Start at', type: 'range', min: 0, max: 100, show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numStep', label: 'Count by', type: 'range', min: 1, max: 10, show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numPad', label: 'Digits (01, 001…)', type: 'range', min: 1, max: 4, show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numBefore', label: 'Text before number', type: 'text', max: 10, placeholder: 'e.g. #', show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numAfter', label: 'Text after number', type: 'text', max: 10, placeholder: 'e.g. .', show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numSep', label: 'Gap', type: 'chips', options: [[' ', 'space'], ['', 'none'], [' - ', ' - '], ['_', '_'], ['. ', '. ']], show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numOrder', label: 'Order', type: 'chips', options: [['zip', 'As in zip'], ['az', 'A → Z']], show: function (s) { return s.numbering !== 'off'; } },
        { k: 'numPerFolder', label: 'Restart numbers in each folder', type: 'toggle', show: function (s) { return s.numbering !== 'off'; } }
      ], R, function () { changed(); });
      var b5 = sec('◎ Which files');
      buildControls(b5, [
        { k: 'onlyExt', label: 'Only these types (empty = all)', type: 'text', max: 60, placeholder: 'wav, mp3, mid' },
        { k: 'onlyFolder', label: 'Only inside folders containing', type: 'text', max: 60, placeholder: 'e.g. 808s' },
        { k: 'onlyContains', label: 'Only names containing', type: 'text', max: 60, placeholder: 'e.g. CLAP' },
        { k: 'folders', label: 'Also rename folder names', type: 'toggle' },
        { k: 'dropJunk', label: 'Remove junk files (__MACOSX, .DS_Store, Thumbs.db)', type: 'toggle' }
      ], R, function () { changed(); });
      var b6 = sec('.ext File extension');
      buildControls(b6, [
        { k: 'extMode', label: 'Extension', type: 'chips', options: [['keep', 'Keep'], ['lower', '.wav'], ['upper', '.WAV'], ['custom', 'Change to…']] },
        { k: 'extCustom', label: 'New extension', type: 'text', max: 10, placeholder: 'e.g. wav', show: function (s) { return s.extMode === 'custom'; }, help: 'Only renames — it does not convert the file. Use FILE CONVERTER for that.' }
      ], R, function () { changed(); });
      var rs = h('button', { type: 'button', class: 'btn btn-sm btn-ghost zr-reset' }, '↺ RESET ALL RULES');
      rs.addEventListener('click', function () { R = Object.assign({}, ZR_DEF, { replace: [{ find: '', with: '' }] }); manual = {}; buildRules(); changed(); });
      rulesBox.appendChild(rs);
    }
    buildRules();

    // ---- loading ----
    drop.addEventListener('click', function (e) { if (e.target.closest('[data-pick-loose]')) { fiLoose.click(); return; } fiZip.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fiZip.click(); } });
    fiZip.addEventListener('change', function () { if (fiZip.files[0]) load([fiZip.files[0]]); fiZip.value = ''; });
    fiLoose.addEventListener('change', function () { if (fiLoose.files.length) load([].slice.call(fiLoose.files)); fiLoose.value = ''; });
    root.querySelector('[data-newzip]').addEventListener('click', function () { fiZip.click(); });
    dropTarget(root.querySelector('.zr-main'), function (fs) { load(fs); });
    async function load(fs) {
      warn.textContent = '';
      try {
        if (fs.length === 1 && /\.zip$/i.test(fs[0].name)) { Z = await ZipFix.read(fs[0]); srcName = stem(fs[0].name); }
        else { Z = ZipFix.fromFiles(fs); srcName = 'renamed-files'; }
      } catch (e) { alert(e.message || e); return; }
      manual = {}; page = 0;
      var total = Z.entries.reduce(function (a, en) { return a + (en.usize || 0); }, 0);
      root.querySelector('.zr-name').textContent = Z.loose ? fs.length + ' loose files' : fs[0].name;
      root.querySelector('.zr-stats').textContent = Z.entries.filter(function (e) { return !e.isDir; }).length + ' files · ' + fmtBytes(Z.loose ? total : fs[0].size);
      root.querySelector('[data-outname]').value = R.outName = srcName + (Z.loose ? '' : ' (renamed)');
      drop.hidden = true; view.hidden = false; refresh();
    }
    root.querySelector('[data-outname]').addEventListener('input', function (e) { R.outName = e.target.value; });
    root.querySelector('input[type=search]').addEventListener('input', function (e) { filt = e.target.value.toLowerCase(); page = 0; draw(); });
    root.querySelector('[data-changed]').addEventListener('change', function (e) { onlyChanged = e.target.checked; page = 0; draw(); });

    // ---- live preview ----
    function refresh() { if (!Z) return; planRes = ZipFix.plan(Z, R, manual); draw(); }
    function draw() {
      if (!planRes) return;
      var rows = planRes.rows.filter(function (r) { return (!onlyChanged || r.changed) && (!filt || r.oldName.toLowerCase().indexOf(filt) >= 0 || r.newName.toLowerCase().indexOf(filt) >= 0); });
      var pages = Math.max(1, Math.ceil(rows.length / PER)); if (page >= pages) page = pages - 1;
      var slice = rows.slice(page * PER, page * PER + PER), ch = planRes.rows.filter(function (r) { return r.changed; }).length;
      table.innerHTML = '<div class="zr-tr zr-th" role="row"><span role="columnheader">Before</span><span role="columnheader">After <small>(click to edit one)</small></span></div>';
      var frag = document.createDocumentFragment();
      slice.forEach(function (r) {
        var en = r.entry, oldBase = r.oldName.replace(/\/$/, '').split('/').pop(), newBase = r.newName.replace(/\/$/, '').split('/').pop(), folder = r.newName.slice(0, r.newName.length - newBase.length - (en.isDir ? 1 : 0));
        var tr = h('div', { class: 'zr-tr' + (r.changed ? ' is-ch' : '') + (r.dup ? ' is-dup' : '') + (en.isDir ? ' is-dir' : '') + (r.filtered ? ' is-skip' : ''), role: 'row' });
        tr.innerHTML = '<span class="zr-old" role="cell" title="' + E(r.oldName) + '">' + (en.isDir ? '📁 ' : '') + E(oldBase) + '</span><span class="zr-new" role="cell"><small class="zr-dir">' + E(folder) + '</small><input type="text" value="' + E(newBase) + '" aria-label="New name for ' + E(oldBase) + '"' + (en.isDir && !R.folders && manual['d:' + en.name] == null ? ' title="Turn on “Also rename folder names” or type here"' : '') + '>' + (r.manual || manual['d:' + en.name] != null ? '<button type="button" class="zr-undo" title="Back to the rules">↺</button>' : '') + (r.dup ? '<em>same name!</em>' : '') + '</span>';
        var inp = tr.querySelector('input');
        inp.addEventListener('change', function () {
          var v = inp.value.trim();
          if (en.isDir) manual['d:' + en.name] = v || oldBase; else manual[en.index] = v || oldBase;
          refresh();
        });
        var u = tr.querySelector('.zr-undo'); if (u) u.addEventListener('click', function () { if (en.isDir) delete manual['d:' + en.name]; else delete manual[en.index]; refresh(); });
        frag.appendChild(tr);
      });
      table.appendChild(frag);
      if (!slice.length) table.insertAdjacentHTML('beforeend', '<p class="muted">No files match.</p>');
      pager.innerHTML = pages > 1 ? '<button type="button" class="btn btn-sm btn-ghost" data-p="-1"' + (page ? '' : ' disabled') + '>◀</button><span>Page ' + (page + 1) + ' / ' + pages + ' · ' + rows.length + ' rows</span><button type="button" class="btn btn-sm btn-ghost" data-p="1"' + (page < pages - 1 ? '' : ' disabled') + '>▶</button>' : '';
      pager.querySelectorAll('[data-p]').forEach(function (b) { b.addEventListener('click', function () { page += +b.getAttribute('data-p'); draw(); table.scrollTop = 0; }); });
      var w = [ch + ' of ' + planRes.rows.length + ' names change'];
      if (planRes.junk && R.dropJunk) w.push(planRes.junk + ' junk files removed');
      if (planRes.dups) w.push('⚠ ' + planRes.dups + ' names clash — they\'ll get (2), (3)… so nothing is lost');
      if (planRes.badRegex) w.push('⚠ a regex rule has a mistake');
      if (planRes.fixedChars) w.push('Characters Windows doesn\'t allow ( \\ / : * ? " < > | ) were swapped for _');
      warn.textContent = w.join(' · ');
    }
    root.querySelector('[data-export]').addEventListener('click', async function () {
      if (!Z || !planRes) return;
      var btn = this; btn.disabled = true; prog.hidden = false;
      try {
        var rows = ZipFix.plan(Z, R, manual).rows;
        var blob = await ZipFix.write(Z, rows, { onProgress: function (f, l) { prog.querySelector('i').style.width = Math.round(f * 100) + '%'; prog.querySelector('span').textContent = l || ''; } });
        var nm = (R.outName || srcName).replace(/[\\/:*?"<>|]/g, '_').replace(/\.zip$/i, '') + '.zip';
        download(blob, nm); ctx.api.burst(innerWidth / 2, innerHeight / 2, 26);
        prog.querySelector('span').textContent = 'Done ✓ ' + fmtBytes(blob.size);
      } catch (e) { console.error(e); alert('Could not build the zip: ' + (e.message || e)); prog.hidden = true; }
      btn.disabled = false;
    });
  }

  /* =========================================================
     RAR → ZIP  (unrar, the official RAR code compiled for browsers, self-hosted in assets/vendor/unrar)
     ========================================================= */
  var UNRAR = { base: 'assets/vendor/unrar/', mod: null, wasm: null };
  async function unrarLib() {
    if (UNRAR.mod && UNRAR.wasm) return UNRAR;
    var url = new URL(UNRAR.base + 'index.esm.js', location.href).href, r;
    try { r = await fetch(new URL(UNRAR.base + 'js/unrar.wasm', location.href).href); } catch (e) { r = null; }
    if (!r || !r.ok) { var er = new Error('notInstalled'); er.notInstalled = true; throw er; }
    UNRAR.wasm = await r.arrayBuffer();
    UNRAR.mod = await import(url);
    return UNRAR;
  }
  function rarDos(t) {
    var d = t ? new Date(t) : new Date(); if (isNaN(d.getTime()) || d.getFullYear() < 1980) d = new Date();
    return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }
  function rarWhy(e) {
    var r = e && e.reason;
    if (e && e.notInstalled) return 'The RAR reader isn\'t installed on this site yet.';
    if (r === 'ERAR_MISSING_PASSWORD') return 'This RAR has a password — type it in and try again.';
    if (r === 'ERAR_BAD_PASSWORD') return 'Wrong password — try again.';
    if (r === 'ERAR_BAD_ARCHIVE' || r === 'ERAR_UNKNOWN_FORMAT') return 'This doesn\'t look like a working RAR file.';
    if (r === 'ERAR_BAD_DATA') return 'The RAR is damaged (or the password is wrong).';
    if (r === 'ERAR_NO_MEMORY') return 'Not enough memory — try a smaller RAR or another browser.';
    if (r === 'ERAR_EOPEN' || r === 'ERAR_EREAD') return 'This RAR is part of a multi-part set (.part1.rar…) — those aren\'t supported. Join them on a computer first.';
    return (e && e.message) || String(e);
  }
  function rarTool(root, ctx) {
    var S = { pack: (typeof CompressionStream === 'function') ? 'deflate' : 'store', junk: true, folder: false };
    var jobs = [];
    root.innerHTML =
      '<div class="tool-grid"><div class="tool-stage panel">' +
      '<div class="drop drop-sm" tabindex="0" role="button"><input type="file" accept=".rar,application/vnd.rar,application/x-rar-compressed,application/x-rar" multiple hidden><div class="drop-ico">' + pixelIcon('rar2zip') + '</div><strong>DROP .RAR FILES HERE</strong><span>or click to choose · as many as you like</span><small>Converted on your device — nothing is uploaded</small></div>' +
      '<p class="rz-msg" aria-live="polite"></p>' +
      '<div class="conv-list"></div>' +
      '<div class="dl-row conv-actions" hidden><button type="button" class="btn" data-run>⚡ CONVERT ALL TO .ZIP</button><button type="button" class="btn btn-sm btn-ghost" data-clear>✕ CLEAR</button></div>' +
      '</div><aside class="tool-side panel"><div class="tc-head">📦 Zip settings</div><div class="tc-z"></div>' +
      '<p class="tc-note">Works with RAR 4 and RAR 5, solid archives and password-protected files. Split archives (<b>.part1.rar</b>, <b>.part2.rar</b>…) aren\'t supported.</p></aside></div>';
    buildControls(root.querySelector('.tc-z'), [
      { k: 'pack', label: 'Zip type', type: 'chips', options: [['deflate', 'Smaller (compressed)'], ['store', 'Fastest (no compression)']] },
      { k: 'junk', label: 'Leave out junk files (__MACOSX, .DS_Store, Thumbs.db)', type: 'toggle' },
      { k: 'folder', label: 'Put everything inside a folder named after the RAR', type: 'toggle' }
    ], S, function () { });
    var drop = root.querySelector('.drop'), fi = drop.querySelector('input'), list = root.querySelector('.conv-list'), acts = root.querySelector('.conv-actions'), msg = root.querySelector('.rz-msg');
    if (typeof CompressionStream !== 'function') S.pack = 'store';
    drop.addEventListener('click', function () { fi.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    fi.addEventListener('change', function () { addFiles([].slice.call(fi.files)); fi.value = ''; });
    ctx.on(drop, 'dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    ctx.on(drop, 'dragleave', function () { drop.classList.remove('is-over'); });
    ctx.on(drop, 'drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); addFiles([].slice.call(e.dataTransfer.files || [])); });
    unrarLib().catch(function (e) { if (e.notInstalled) msg.innerHTML = '⚠ The RAR reader isn\'t installed on this site yet. <b>Site owner:</b> on GitHub open <b>Actions → Install RAR reader → Run workflow</b>, wait for the green ✓, then give the site a couple of minutes.'; });
    function addFiles(fs) {
      fs.forEach(function (f) {
        var isRar = /\.rar$/i.test(f.name) || /rar/i.test(f.type);
        var j = { f: f, state: 'ready', pw: '' };
        j.el = h('div', { class: 'conv-job rz-job' + (isRar ? '' : ' k-other') });
        j.el.innerHTML = '<span class="cj-ico">📚</span><span class="cj-name"><strong></strong><small>' + fmtBytes(f.size) + '</small></span><span class="cj-to">→ .zip</span><span class="cj-bar"><i></i></span><span class="cj-act"></span><button type="button" class="cj-x" aria-label="Remove">✕</button>' +
          '<div class="rz-pw" hidden><input type="password" placeholder="Password" autocomplete="off" aria-label="RAR password"><button type="button" class="btn btn-sm">UNLOCK ⚡</button></div>';
        j.el.querySelector('strong').textContent = f.name;
        j.el.querySelector('.cj-x').addEventListener('click', function () { if (j.state === 'busy') return; jobs.splice(jobs.indexOf(j), 1); j.el.remove(); acts.hidden = !jobs.length; });
        var pwIn = j.el.querySelector('.rz-pw input');
        j.el.querySelector('.rz-pw button').addEventListener('click', function () { j.pw = pwIn.value; run(j); });
        pwIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { j.pw = pwIn.value; run(j); } });
        if (!isRar) { j.state = 'skip'; j.el.querySelector('.cj-act').textContent = 'Not a .rar file'; }
        else if (/\.part0*[2-9]\d*\.rar$/i.test(f.name)) { j.state = 'skip'; j.el.classList.add('is-err'); j.el.querySelector('.cj-act').textContent = 'Part of a split RAR — not supported'; }
        else if (f.size > 1.8e9) j.el.querySelector('.cj-act').textContent = '⚠ very big — may run out of memory';
        list.appendChild(j.el); jobs.push(j);
      });
      acts.hidden = !jobs.length;
    }
    function setJob(j, f, label) { j.el.querySelector('.cj-bar i').style.width = Math.round(f * 100) + '%'; if (label != null) j.el.querySelector('.cj-act').textContent = label; }
    async function run(j) {
      if (j.state === 'busy' || j.state === 'skip') return;
      j.state = 'busy'; j.el.classList.remove('is-err', 'is-done'); j.el.querySelector('.rz-pw').hidden = true;
      try {
        setJob(j, 0.02, 'Starting the RAR reader…');
        var L = await unrarLib();
        setJob(j, 0.05, 'Reading ' + fmtBytes(j.f.size) + '…');
        var data = await j.f.arrayBuffer();
        var ex = await L.mod.createExtractorFromData({ wasmBinary: L.wasm, data: data, password: j.pw || undefined });
        var heads = [], total = 0;
        for (var fh of ex.getFileList().fileHeaders) { heads.push(fh); if (!fh.flags.directory) total += fh.unpSize || 0; }
        var nFiles = heads.filter(function (x) { return !x.flags.directory; }).length;
        if (!nFiles) throw new Error('This RAR is empty.');
        var base = stem(j.f.name).replace(/\.part0*1$/i, ''), entries = [], done = 0, idx = 0, dirs = {};
        var extracted = ex.extract({ password: j.pw || undefined });
        for (var af of extracted.files) {
          var hd = af.fileHeader, nm = String(hd.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
          if (S.folder) nm = base + '/' + nm;
          if (hd.flags.directory) { dirs[nm.replace(/\/?$/, '/')] = hd; continue; }
          if (S.junk && ZipFix.isJunk(nm)) continue;
          var bytes = af.extraction || new Uint8Array(0), blob = new Blob([bytes]), dos = rarDos(hd.time), en;
          bytes = null; af.extraction = null;
          var crc = await ZipFix.crcOfBlob(blob);
          var packed = null;
          if (S.pack === 'deflate' && blob.size > 64) {
            try { packed = await new Response(blob.stream().pipeThrough(new CompressionStream('deflate-raw'))).blob(); } catch (e) { packed = null; }
            if (packed && packed.size >= blob.size) packed = null;
          }
          en = { index: idx++, name: nm, isDir: false, method: packed ? 8 : 0, flags: 0x800, time: dos.time, date: dos.date, crc: crc, csize: packed ? packed.size : blob.size, usize: blob.size, external: 0, internal: 0, madeBy: 20, needed: 20, loose: packed || blob };
          entries.push(en);
          done += hd.unpSize || blob.size;
          setJob(j, 0.08 + 0.8 * (total ? done / total : idx / nFiles), 'Unpacking ' + idx + ' / ' + nFiles + ' · ' + nm.split('/').pop());
          await new Promise(function (r) { setTimeout(r, 0); });
        }
        // keep empty folders
        Object.keys(dirs).forEach(function (d) {
          if (entries.some(function (e) { return e.name.indexOf(d) === 0; })) return;
          var dd = rarDos(dirs[d].time); entries.push({ index: idx++, name: d, isDir: true, method: 0, flags: 0x800, time: dd.time, date: dd.date, crc: 0, csize: 0, usize: 0, external: 0x10, internal: 0, madeBy: 20, needed: 20, loose: new Blob([]) });
        });
        if (!entries.length) throw new Error('Nothing left to zip (everything was junk files).');
        setJob(j, 0.9, 'Building the zip…');
        var z = { file: null, entries: entries, loose: true };
        var rows = entries.map(function (e) { return { entry: e, newName: e.name }; });
        var out = await ZipFix.write(z, rows, { onProgress: function (f) { setJob(j, 0.9 + 0.1 * f); } });
        var outName = base + '.zip';
        j.state = 'done'; setJob(j, 1, ''); j.el.classList.add('is-done');
        var a = j.el.querySelector('.cj-act'); a.innerHTML = '';
        var b = h('button', { type: 'button', class: 'btn btn-sm' }, '⬇ ZIP · ' + fmtBytes(out.size));
        b.addEventListener('click', function () { download(out, outName); }); a.appendChild(b);
        j.el.querySelector('small').textContent = fmtBytes(j.f.size) + ' · ' + (function (n) { return n + (n === 1 ? ' file' : ' files'); })(entries.filter(function (e) { return !e.isDir; }).length);
        download(out, outName);
        return true;
      } catch (e) {
        console.error(e);
        j.state = 'ready'; j.el.classList.add('is-err'); setJob(j, 0, '⚠ ' + rarWhy(e));
        if (e && (e.reason === 'ERAR_MISSING_PASSWORD' || e.reason === 'ERAR_BAD_PASSWORD' || (e.reason === 'ERAR_BAD_DATA' && j.pw))) { var pw = j.el.querySelector('.rz-pw'); pw.hidden = false; pw.querySelector('input').focus(); }
        return false;
      }
    }
    root.querySelector('[data-run]').addEventListener('click', async function () {
      var btn = this; btn.disabled = true;
      for (var i = 0; i < jobs.length; i++) if (jobs[i].state === 'ready') await run(jobs[i]);
      btn.disabled = false; ctx.api.burst(innerWidth / 2, innerHeight / 2, 20);
    });
    root.querySelector('[data-clear]').addEventListener('click', function () { jobs = jobs.filter(function (j) { if (j.state === 'busy') return true; j.el.remove(); return false; }); acts.hidden = !jobs.length; });
  }

  /* =========================================================
     MOUNT
     ========================================================= */
  var live = [];
  function mount(el, id, cfg, api) {
    var t = toolCfg(cfg, id);
    var ctx = { cfg: cfg, api: api, offs: [], on: function (tg, ev, fn) { tg.addEventListener(ev, fn); this.offs.push([tg, ev, fn]); } };
    live.push(ctx);
    var back = (function () { var f = cfg.pages[0].id; for (var i = cfg.pages.length - 1; i >= 0; i--) if ((cfg.pages[i].sections || []).some(function (s) { return s.type === 'tools' && s.visible !== false; })) { f = cfg.pages[i].id; if (i > 0) break; } return f; })();
    var backHref = back === cfg.pages[0].id ? '#/' : '#/' + encodeURIComponent(back);
    if (!t || !t.enabled) { el.innerHTML = '<section class="section"><div class="wrap panel a-center"><h2 class="sec-title">Tool not found</h2><p><a class="btn" href="' + backHref + '">◀ ALL TOOLS</a></p></div></section>'; return; }
    var others = orderedTools(cfg).filter(function (o) { return o.id !== id; });
    el.innerHTML = '<section class="section tool-page t-' + id + '"><div class="wrap">' +
      '<div class="tool-head reveal"><a class="tool-back" href="' + backHref + '">◀ ALL TOOLS</a><div class="tool-title"><span class="tool-ico tool-ico-lg">' + iconHtml(t, api) + '</span><div><h1 class="sec-title">' + api.esc(t.title) + '</h1><p class="sec-sub">' + api.esc(t.desc) + '</p></div></div>' +
      '<nav class="tool-switch" aria-label="Other tools">' + others.map(function (o) { return '<a href="#/tool/' + o.id + '" title="' + api.esc(o.title) + '">' + iconHtml(o, api) + '</a>'; }).join('') + '</nav></div>' +
      '<div class="tool-body reveal"></div></div></section>';
    var body = el.querySelector('.tool-body');
    if (!window.PixFX || !window.ZipFix) { body.innerHTML = '<p>Tools failed to load — refresh the page.</p>'; return; }
    if (DEF[id]) { var d = DEF[id]; imageTool(body, { id: id, defaults: d.defaults, controls: d.controls(), render: d.render, extra: d.extra }, ctx); }
    else if (id === 'bgremove') bgTool(body, ctx);
    else if (id === 'convert') convertTool(body, ctx);
    else if (id === 'rename') renameTool(body, ctx);
    else if (id === 'rar2zip') rarTool(body, ctx);
  }
  function unmountAll() { live.forEach(function (c) { c.offs.forEach(function (o) { o[0].removeEventListener(o[1], o[2]); }); }); live = []; }

  window.SulTools = { TOOLS: TOOLS, mount: mount, unmountAll: unmountAll, sectionHtml: sectionHtml, pixelIcon: pixelIcon, toolCfg: toolCfg, orderedTools: orderedTools };
})();
