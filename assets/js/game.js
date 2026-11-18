/* =========================================================
   PIXEL CONNECT — pixel-art jigsaw game
   Every game picks a random picture (max 20 in the pool, no repeats
   until you've seen them all), cuts it into 5–20 pieces, and you drag
   the pieces onto the board. Pieces snap when they're close.
   Settings: site.json -> game (edit in the admin, 🎮 PIXEL CONNECT).
   ========================================================= */
(function () {
  'use strict';

  var instances = [];
  var actx = null;
  var MAX_POOL = 20;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function fmtTime(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  /* ---- 8-bit sounds (made in the browser, no files needed) ---- */
  function beep(freqs, dur, type, vol) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime;
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(vol || 0.05, t + i * dur);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (i + 1) * dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t + i * dur); o.stop(t + (i + 1) * dur + 0.02);
      });
    } catch (e) {}
  }

  /* ---- which pictures can be used ---- */
  function pool(cfg, api) {
    var g = cfg.game || {};
    var list = (g.images || []).map(function (x) { return typeof x === 'string' ? x : x && x.src; }).filter(Boolean);
    if (!list.length) {
      // nothing uploaded yet: borrow from the gallery + kit covers
      (cfg.gallery || []).forEach(function (it) { if (it && it.visible !== false && it.src && !/youtu|vimeo|\.(mp4|webm|mov)/i.test(it.src)) list.push(it.thumb || it.src); });
      (cfg.kits || []).forEach(function (k) { if (k && k.visible !== false && k.image) list.push(k.image); });
    }
    var seen = {}, out = [];
    list.forEach(function (s) { var u = api.asset(s); if (u && !seen[u]) { seen[u] = 1; out.push(u); } });
    return out.slice(0, MAX_POOL);
  }
  function nextImage(list) {
    var key = 'sul.pc.deck', lastKey = 'sul.pc.last';
    var deck = []; try { deck = JSON.parse(ssGet(key) || '[]'); } catch (e) { deck = []; }
    deck = deck.filter(function (u) { return list.indexOf(u) >= 0; });
    if (!deck.length) {
      deck = shuffle(list.slice());
      var last = ssGet(lastKey);
      if (deck.length > 1 && deck[deck.length - 1] === last) { var x = deck[0]; deck[0] = deck[deck.length - 1]; deck[deck.length - 1] = x; }
    }
    var pick = deck.pop();
    ssSet(key, JSON.stringify(deck)); ssSet(lastKey, pick);
    return pick;
  }
  /* ---- how to cut it: a grid whose piece count is inside min..max ---- */
  function pickGrid(minP, maxP, aspect) {
    var opts = [];
    for (var c = 1; c <= 5; c++) for (var r = 1; r <= 5; r++) {
      var n = c * r;
      if (n >= minP && n <= maxP && n >= 2) opts.push({ c: c, r: r, n: n });
    }
    var nice = opts.filter(function (o) { return o.c > 1 && o.r > 1; });
    if (nice.length) opts = nice;
    if (!opts.length) opts = [{ c: 3, r: 2, n: 6 }];
    var counts = []; opts.forEach(function (o) { if (counts.indexOf(o.n) < 0) counts.push(o.n); });
    var n = counts[Math.floor(Math.random() * counts.length)];
    var same = opts.filter(function (o) { return o.n === n; });
    // landscape pictures get more columns, portrait more rows, square ~ square
    same.sort(function (a, b) { return Math.abs(Math.log((a.c / a.r) / aspect)) - Math.abs(Math.log((b.c / b.r) / aspect)); });
    return same[0];
  }
  /* ---- prepare the picture: centre-crop + optional pixelate ---- */
  function prepare(url, pixelate, block) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (/^https?:/i.test(url) && url.indexOf(location.origin) !== 0) img.crossOrigin = 'anonymous';
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return reject(new Error('empty image'));
        var aspect = clamp(w / h, 0.6, 1.8);
        var sw = w, sh = h;
        if (w / h > aspect) sw = h * aspect; else sh = w / aspect;
        var outW = 960, outH = Math.round(960 / aspect);
        try {
          var c = document.createElement('canvas'); c.width = outW; c.height = outH;
          var g = c.getContext('2d');
          if (pixelate) {
            var small = document.createElement('canvas');
            var sx = Math.max(16, Math.round(outW / clamp(block, 2, 24)));
            small.width = sx; small.height = Math.max(8, Math.round(sx / aspect));
            var sg = small.getContext('2d'); sg.imageSmoothingEnabled = true;
            sg.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, small.width, small.height);
            g.imageSmoothingEnabled = false;
            g.drawImage(small, 0, 0, small.width, small.height, 0, 0, outW, outH);
          } else {
            g.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, outW, outH);
          }
          resolve({ src: c.toDataURL('image/png'), aspect: aspect });
        } catch (e) {
          // picture from another website that doesn't allow editing: use it as-is
          resolve({ src: url, aspect: w / h });
        }
      };
      img.onerror = function () { reject(new Error('could not load ' + url)); };
      img.src = url;
    });
  }

  function Game(mount, cfg, api) {
    this.mount = mount; this.cfg = cfg; this.api = api;
    this.g = cfg.game || {};
    this.timer = 0; this.dead = false;
    this.sound = lsGet('sul.pc.sound') !== '0' && this.g.sound !== false;
    this.build();
    this.newGame();
  }
  Game.prototype.build = function () {
    var api = this.api, self = this;
    this.mount.innerHTML =
      '<div class="pc">' +
        '<div class="pc-hud">' +
          '<div class="pc-name">' + api.esc(this.g.title || 'PIXEL CONNECT') + '</div>' +
          '<div class="pc-stats"><span>PIECES <b data-pc="placed">0/0</b></span><span>TIME <b data-pc="time">0:00</b></span><span>MOVES <b data-pc="moves">0</b></span></div>' +
          '<div class="pc-btns">' +
            '<button type="button" class="btn btn-sm" data-pc-act="new">' + api.icon('restart') + ' NEW</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-pc-act="peek">' + api.icon('eye') + ' PEEK</button>' +
            '<button type="button" class="btn btn-sm btn-ghost pc-snd" data-pc-act="sound" aria-label="Sound on/off">' + api.icon(this.sound ? 'volume' : 'mute') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="pc-area" data-pc="area"><div class="pc-msg">LOADING…</div></div>' +
        '<p class="pc-help">Drag the pieces onto the board — they snap when they’re close. Every game is a new picture.</p>' +
      '</div>';
    this.area = this.mount.querySelector('[data-pc="area"]');
    this.mount.querySelector('.pc-btns').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pc-act]'); if (!b) return;
      var a = b.getAttribute('data-pc-act');
      if (a === 'new') self.newGame();
      else if (a === 'peek') self.peek();
      else if (a === 'sound') {
        self.sound = !self.sound; lsSet('sul.pc.sound', self.sound ? '1' : '0');
        b.innerHTML = api.icon(self.sound ? 'volume' : 'mute');
        if (self.sound) beep([660], 0.06);
      }
    });
  };
  Game.prototype.stat = function (k, v) { var e = this.mount.querySelector('[data-pc="' + k + '"]'); if (e) e.textContent = v; };
  Game.prototype.newGame = function (tries) {
    var self = this, api = this.api;
    tries = tries || 0;
    clearInterval(this.timer); this.timer = 0;
    var list = pool(this.cfg, api);
    if (!list.length) { this.area.innerHTML = '<div class="pc-msg">No pictures yet — add some in the admin (🎮 PIXEL CONNECT) ✦</div>'; this.area.style.aspectRatio = '16 / 7'; return; }
    var url = nextImage(list);
    this.area.innerHTML = '<div class="pc-msg">LOADING…</div>';
    prepare(url, this.g.pixelate !== false, Number(this.g.pixelBlock) || 6).then(function (pic) {
      if (self.dead) return;
      self.setup(pic);
    }).catch(function () {
      if (self.dead) return;
      if (tries < Math.min(5, list.length)) self.newGame(tries + 1);
      else self.area.innerHTML = '<div class="pc-msg">Couldn’t load the pictures. Check them in the admin.</div>';
    });
  };
  Game.prototype.setup = function (pic) {
    var self = this, api = this.api;
    var minP = clamp(Math.round(Number(this.g.minPieces) || 6), 2, 25), maxP = clamp(Math.round(Number(this.g.maxPieces) || 20), minP, 25);
    var grid = pickGrid(minP, maxP, pic.aspect);
    this.cols = grid.c; this.rows = grid.r; this.n = grid.n;
    this.placed = 0; this.moves = 0; this.start = 0; this.done = false;
    // layout in % of the play area: board + tray side by side (wide) or stacked (narrow)
    var W = this.mount.clientWidth || 800, wide = W >= 700;
    var boardW = wide ? 0.6 : 1, aspect = pic.aspect;
    var areaAspect, b, tray;
    if (wide) {
      areaAspect = (1 / boardW) * aspect;            // area width / height
      b = { x: 0, y: 0, w: boardW * 100, h: 100 };
      tray = { x: boardW * 100 + 3, y: 2, w: 100 - boardW * 100 - 3, h: 96 };
    } else {
      var boardHFrac = 1 / 1.75;                     // board takes ~57% of the height
      areaAspect = aspect * boardHFrac;
      b = { x: 0, y: 0, w: 100, h: boardHFrac * 100 };
      tray = { x: 0, y: b.h + 3, w: 100, h: 100 - b.h - 4 };
    }
    this.board = b;
    this.area.style.aspectRatio = String(areaAspect);
    // keep the whole play area on screen so you never have to scroll while dragging
    var zoomK = (this.mount.getBoundingClientRect().width / (this.mount.offsetWidth || 1)) || 1;
    var maxH = Math.max(300, (window.innerHeight - 170) / zoomK);
    this.area.style.maxWidth = Math.floor(maxH * areaAspect) + 'px';
    var pw = b.w / this.cols, ph = b.h / this.rows;
    var html = '<div class="pc-board" style="left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%;--cols:' + this.cols + ';--rows:' + this.rows + '">' +
      (this.g.showGhost !== false ? '<div class="pc-ghost" style="background-image:url(\'' + pic.src.replace(/'/g, '%27') + '\')"></div>' : '') +
      '<div class="pc-grid"></div></div><div class="pc-tray" style="left:' + tray.x + '%;top:' + tray.y + '%;width:' + tray.w + '%;height:' + tray.h + '%"></div>';
    var order = shuffle(Array.apply(null, Array(this.n)).map(function (_, i) { return i; }));
    order.forEach(function (i, k) {
      var c = i % self.cols, r = Math.floor(i / self.cols);
      var tx = b.x + c * pw, ty = b.y + r * ph;
      // scatter inside the tray
      var sx = tray.x + Math.random() * Math.max(0, tray.w - pw), sy = tray.y + Math.random() * Math.max(0, tray.h - ph);
      var bx = self.cols > 1 ? (c / (self.cols - 1)) * 100 : 0, by = self.rows > 1 ? (r / (self.rows - 1)) * 100 : 0;
      html += '<div class="pc-piece" data-i="' + i + '" data-tx="' + tx + '" data-ty="' + ty + '" role="img" aria-label="Puzzle piece ' + (k + 1) + '" style="left:' + sx + '%;top:' + sy + '%;width:' + pw + '%;height:' + ph + '%;z-index:' + (10 + k) + ';' +
        'background-image:url(\'' + pic.src.replace(/'/g, '%27') + '\');background-size:' + (self.cols * 100) + '% ' + (self.rows * 100) + '%;background-position:' + bx + '% ' + by + '%"></div>';
    });
    this.area.innerHTML = html;
    this.pic = pic;
    this.stat('placed', '0/' + this.n); this.stat('time', '0:00'); this.stat('moves', '0');
    this.bindDrag();
  };
  Game.prototype.bindDrag = function () {
    var self = this, area = this.area, z = 100, drag = null;
    function pt(e) {
      var r = area.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
    }
    area.onpointerdown = function (e) {
      var p = e.target.closest('.pc-piece');
      if (!p || p.classList.contains('is-locked') || self.done) return;
      e.preventDefault();
      if (!self.start) { self.start = Date.now(); self.timer = setInterval(function () { self.stat('time', fmtTime(Date.now() - self.start)); }, 500); }
      var q = pt(e);
      drag = { el: p, dx: q.x - parseFloat(p.style.left), dy: q.y - parseFloat(p.style.top), id: e.pointerId };
      p.style.zIndex = ++z; p.classList.add('is-drag');
      try { p.setPointerCapture(e.pointerId); } catch (x) {}
      if (self.sound) beep([330], 0.04, 'square', 0.03);
    };
    area.onpointermove = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var q = pt(e), el = drag.el;
      var w = parseFloat(el.style.width), h = parseFloat(el.style.height);
      el.style.left = clamp(q.x - drag.dx, -w * 0.3, 100 - w * 0.7) + '%';
      el.style.top = clamp(q.y - drag.dy, -h * 0.3, 100 - h * 0.7) + '%';
    };
    var end = function (e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var el = drag.el; drag = null;
      el.classList.remove('is-drag');
      self.moves++; self.stat('moves', String(self.moves));
      var x = parseFloat(el.style.left), y = parseFloat(el.style.top), tx = Number(el.getAttribute('data-tx')), ty = Number(el.getAttribute('data-ty'));
      var w = parseFloat(el.style.width), h = parseFloat(el.style.height);
      if (Math.abs(x - tx) < w * 0.32 && Math.abs(y - ty) < h * 0.32) {
        el.style.left = tx + '%'; el.style.top = ty + '%'; el.style.zIndex = 5;
        el.classList.add('is-locked');
        self.placed++; self.stat('placed', self.placed + '/' + self.n);
        if (self.sound) beep([523, 784], 0.07);
        var r = el.getBoundingClientRect(); self.api.burst(r.left + r.width / 2, r.top + r.height / 2, 10);
        if (self.placed === self.n) self.win();
      }
    };
    area.onpointerup = end; area.onpointercancel = end;
  };
  Game.prototype.peek = function () {
    if (!this.pic || this.done) return;
    var b = this.area.querySelector('.pc-board'); if (!b) return;
    b.classList.add('is-peek');
    clearTimeout(this.peekT);
    this.peekT = setTimeout(function () { b.classList.remove('is-peek'); }, 1600);
  };
  Game.prototype.win = function () {
    var self = this, api = this.api;
    this.done = true;
    clearInterval(this.timer); this.timer = 0;
    var ms = Date.now() - (this.start || Date.now());
    var bestKey = 'sul.pc.best.' + this.n, best = Number(lsGet(bestKey)) || 0, isBest = !best || ms < best;
    if (isBest) lsSet(bestKey, String(ms));
    if (this.sound) beep([523, 659, 784, 1047], 0.11, 'square', 0.06);
    var r = this.area.getBoundingClientRect();
    api.burst(r.left + r.width / 2, r.top + r.height / 2, 70);
    var ov = document.createElement('div');
    ov.className = 'pc-win';
    ov.innerHTML = '<div class="pc-win-box"><div class="pc-win-bar">' + api.esc(this.g.title || 'PIXEL CONNECT') + '</div>' +
      '<h3>' + api.headline(this.g.winTitle || 'YOU WIN!') + '</h3>' +
      (this.g.winText ? '<p>' + api.esc(this.g.winText) + '</p>' : '') +
      '<div class="pc-win-stats"><span>TIME <b>' + fmtTime(ms) + '</b></span><span>MOVES <b>' + this.moves + '</b></span><span>' + (isBest ? '★ NEW BEST' : 'BEST <b>' + fmtTime(best) + '</b>') + '</span></div>' +
      '<button type="button" class="btn" data-pc-next>▶ NEXT PUZZLE</button></div>';
    this.area.appendChild(ov);
    ov.querySelector('[data-pc-next]').addEventListener('click', function () { self.newGame(); });
  };
  Game.prototype.destroy = function () { this.dead = true; clearInterval(this.timer); clearTimeout(this.peekT); };

  window.SulGame = {
    mount: function (el, cfg, api) {
      if (el.__pc) return;
      var g = new Game(el, cfg, api);
      el.__pc = g; instances.push(g);
    },
    unmountAll: function () { instances.forEach(function (g) { g.destroy(); }); instances = []; },
    _pickGrid: pickGrid
  };
})();
