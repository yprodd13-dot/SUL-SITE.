/* =========================================================
   SHORT EDITOR — save / open / export / accounts / template maker
   ========================================================= */
(function () {
  'use strict';
  var SE = window.ShortEditor, EP = SE._EP, U = SE._U, C = window.ShortCore, store = SE._store;
  var E = U.E, h = U.h, clamp = U.clamp, round = U.round, download = U.download, safeName = U.safeName;

  /* ---------- modal ---------- */
  EP.modal = function (html, cls) {
    var m = this.$('.se-modal'), self = this; m.hidden = false; m.innerHTML = '<div class="se-mbox ' + (cls || '') + '"><button type="button" class="se-mx" aria-label="Close">✕</button>' + html + '</div>';
    m.querySelector('.se-mx').addEventListener('click', function () { if (!self.exporting) self.closeModal(); });
    m.onclick = function (e) { if (e.target === m && !self.exporting) self.closeModal(); };
    return m.querySelector('.se-mbox');
  };
  EP.closeModal = function () { var m = this.$('.se-modal'); if (!m) return; m.hidden = true; m.innerHTML = ''; };

  /* ---------- save in this browser ---------- */
  EP.thumb = function () { var c = C.mk(180, Math.round(180 * this.P.h / this.P.w)); try { this.frame(c, Math.min(Math.max(this.t, 1.5), this.P.duration - 0.01), false); return c.toDataURL('image/jpeg', 0.6); } catch (e) { return ''; } };
  EP.saveLocal = function (loud) {
    var self = this, P = this.P; if (!P || this.opts.builder) return Promise.resolve();
    this.dirty = false;
    return store.putProject({ id: P.id, name: P.name, updated: Date.now(), thumb: this.thumb(), json: JSON.stringify(P) }).then(function () { try { localStorage.setItem('sul.short.last', P.id); } catch (e) { } if (loud) self.toast('Saved in this browser ✓'); })
      .catch(function (e) { self.dirty = true; if (loud) self.toast('Couldn\'t save (' + (e.message || e) + ')', true); });
  };
  EP.openRecord = function (rec) { var P = JSON.parse(rec.json); return this.load(P); };
  EP.projectsDialog = function () {
    var self = this;
    this.saveLocal().then(function () { return store.allProjects(); }).then(function (all) {
      all.sort(function (a, b) { return b.updated - a.updated; });
      var cloudOn = self.cloud && self.cloud.ok;
      var box = self.modal('<h2>📁 PROJECTS</h2><div class="se-btnrow"><button type="button" class="se-btn hot" data-new>✚ NEW BLANK</button><button type="button" class="se-btn" data-tpl>🧩 FROM A TEMPLATE</button><button type="button" class="se-btn" data-file>⬇ DOWNLOAD THIS PROJECT</button><button type="button" class="se-btn" data-open>⬆ OPEN A PROJECT FILE</button></div>' +
        (cloudOn ? '<div class="se-cloudrow"></div>' : '') + '<div class="se-fh">Saved in this browser</div><div class="se-plist"></div><p class="se-help">Projects and your files save automatically in this browser. To move a project to another device, download it as a file' + (cloudOn ? ' or save it to your account' : '') + '.</p>');
      var list = box.querySelector('.se-plist');
      if (!all.length) list.innerHTML = '<p class="se-help">Nothing saved yet.</p>';
      all.forEach(function (r) {
        var it = h('div', { class: 'se-pitem' + (r.id === self.P.id ? ' on' : '') }, (r.thumb ? '<img alt="">' : '<i></i>') + '<div><b>' + E(r.name || 'Untitled') + '</b><small>' + new Date(r.updated).toLocaleString() + '</small></div><button type="button" class="se-btn hot" data-o>OPEN</button><button type="button" class="se-btn sm" data-d title="Make a copy">⧉</button><button type="button" class="se-btn sm" data-x title="Delete">🗑</button>');
        if (r.thumb) it.querySelector('img').src = r.thumb;
        it.querySelector('[data-o]').addEventListener('click', function () { self.closeModal(); self.openRecord(r); });
        it.querySelector('[data-d]').addEventListener('click', function () { var P = JSON.parse(r.json); P.id = C.uid('p'); P.name = (P.name || 'Project') + ' copy'; store.putProject({ id: P.id, name: P.name, updated: Date.now(), thumb: r.thumb, json: JSON.stringify(P) }).then(function () { self.projectsDialog(); }); });
        it.querySelector('[data-x]').addEventListener('click', function () { if (!confirm('Delete “' + (r.name || 'Untitled') + '” from this browser?')) return; store.delProject(r.id).then(function () { if (r.id === self.P.id) self.load(C.newProject({ name: 'My short' }), true); self.projectsDialog(); }); });
        list.appendChild(it);
      });
      box.querySelector('[data-new]').addEventListener('click', function () { self.closeModal(); self.saveLocal().then(function () { self.load(C.newProject({ name: 'My short' }), true); }); });
      box.querySelector('[data-tpl]').addEventListener('click', function () { self.closeModal(); self.tab = 'templates'; self.ws.leftOpen = true; self.applyWS(true); self.renderPanel(); });
      box.querySelector('[data-file]').addEventListener('click', function () { self.exportProjectFile(); });
      box.querySelector('[data-open]').addEventListener('click', function () { self.importProjectFile(); });
      if (cloudOn) self.cloudProjects(box.querySelector('.se-cloudrow'));
    }).catch(function (e) { self.toast('Couldn\'t open saved projects: ' + (e.message || e), true); });
  };
  function blobToDataURL(b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(b); }); }
  EP.exportProjectFile = function () {
    var self = this, P = this.P, out = { app: 'sul-short', v: 2, project: P, files: {} };
    this.toast('Packing project…');
    Promise.all(Object.keys(P.media).map(function (id) { var r = self.media[id]; if (!r || !r.blob || P.media[id].src) return null; return blobToDataURL(r.blob).then(function (d) { out.files[id] = d; }); }))
      .then(function () { download(new Blob([JSON.stringify(out)], { type: 'application/json' }), safeName(P.name) + '.sulshort'); self.toast('Project file downloaded ✓'); })
      .catch(function (e) { self.toast('Couldn\'t pack the project: ' + (e.message || e), true); });
  };
  EP.importProjectFile = function () {
    var self = this;
    this.pick('.sulshort,application/json', function (f) {
      f[0].text().then(function (txt) { var j = JSON.parse(txt); if (!j.project || !j.project.layers) throw new Error('Not a SHORT EDITOR project'); return self.openPacked(j); })
        .then(function () { self.closeModal(); self.toast('Project opened ✓'); })
        .catch(function (e) { self.toast('Couldn\'t open: ' + (e.message || e), true); });
    }, false);
  };
  EP.openPacked = function (j) {
    var self = this, P = j.project; P.id = P.id || C.uid('p');
    return Promise.all(Object.keys(j.files || {}).map(function (id) { return fetch(j.files[id]).then(function (r) { return r.blob(); }).then(function (b) { return store.putBlob(id, b); }); }))
      .then(function () { Object.keys(j.files || {}).forEach(function (id) { delete self.media[id]; delete self.buffers[id]; }); return self.load(P, true); }).then(function () { return self.saveLocal(); });
  };

  /* =========================================================
     EXPORT
     ========================================================= */
  function sleep0() { return new Promise(function (r) { var ch = new MessageChannel(); ch.port1.onmessage = function () { r(); }; ch.port2.postMessage(0); }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var AVC = ['avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640028', 'avc1.4D0033', 'avc1.4D0028', 'avc1.42E033', 'avc1.42E028', 'avc1.42001F'];
  function pickVideoCodec(W, H, fps, bitrate) {
    if (typeof VideoEncoder !== 'function' || !VideoEncoder.isConfigSupported) return Promise.resolve(null);
    var i = 0;
    function next() {
      if (i >= AVC.length) return Promise.resolve(null);
      var cfg = { codec: AVC[i++], width: W, height: H, bitrate: bitrate, framerate: fps, avc: { format: 'avc' } };
      return VideoEncoder.isConfigSupported(cfg).then(function (r) { return r && r.supported ? cfg : next(); }).catch(next);
    }
    return next();
  }
  function pickAudioCodec() {
    if (typeof AudioEncoder !== 'function' || !AudioEncoder.isConfigSupported) return Promise.resolve(null);
    var opts = [{ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 256000, kind: 'aac' }, { codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000, kind: 'opus' }], i = 0;
    function next() { if (i >= opts.length) return Promise.resolve(null); var o = opts[i++], cfg = { codec: o.codec, sampleRate: o.sampleRate, numberOfChannels: o.numberOfChannels, bitrate: o.bitrate }; return AudioEncoder.isConfigSupported(cfg).then(function (r) { return r && r.supported ? { cfg: cfg, kind: o.kind } : next(); }).catch(next); }
    return next();
  }
  EP.exportDialog = function () {
    var self = this, P = this.P; this.stop();
    if (!P.layers.length && !P.audio.length) return this.toast('Add something to your video first ✦', true);
    var S = { res: Math.min(P.w, P.h) >= 1080 ? 1080 : 720, fps: P.fps || 30, quality: 'high' };
    var box = this.modal('<h2>⬇ EXPORT VIDEO</h2><div class="se-exp"></div><div class="se-expinfo se-help"></div><div class="se-prog" hidden><i></i><span></span></div><div class="se-btnrow"><button type="button" class="se-btn hot big" data-go>⬇ EXPORT MP4</button><button type="button" class="se-btn" data-png>🖼 Save this frame (PNG)</button><button type="button" class="se-btn" data-cancel hidden>✕ Cancel</button></div>', 'exp');
    this.form(box.querySelector('.se-exp'), [['res', 'Resolution', 'chips', [[720, '720p'], [1080, '1080p (best for TikTok / Reels)'], [1440, '1440p'], [2160, '4K']], { num: 1, rerender: false }], ['fps', 'Frame rate', 'chips', [[24, '24'], [25, '25'], [30, '30'], [60, '60']], { num: 1, rerender: false }], ['quality', 'Quality', 'chips', [['normal', 'Normal'], ['high', 'High'], ['max', 'Max']], { rerender: false }]], S, function () { info(); });
    var inf = box.querySelector('.se-expinfo');
    function dims() { var k = S.res / Math.min(P.w, P.h); return [Math.round(P.w * k / 2) * 2, Math.round(P.h * k / 2) * 2]; }
    function info() { var d = dims(); inf.textContent = d[0] + ' × ' + d[1] + ' · ' + U.fmt(P.duration) + ' long · frame-perfect: every frame is drawn, so the video comes out smooth even on a slow computer.'; }
    info();
    box.querySelector('[data-png]').addEventListener('click', function () { var c = C.mk(P.w, P.h); self.frame(c, Math.min(self.t, P.duration - 0.001), false); c.toBlob(function (b) { download(b, safeName(P.name) + '-' + round(self.t, 2) + 's.png'); }, 'image/png'); });
    box.querySelector('[data-go]').addEventListener('click', function () { this.disabled = true; self.runExport(S, dims(), box); });
  };
  EP.runExport = function (S, d, box) {
    var self = this, P = this.P, W = d[0], H = d[1], fps = S.fps, bits = Math.round({ normal: 0.09, high: 0.16, max: 0.3 }[S.quality] * W * H * fps * (fps > 30 ? 0.75 : 1));
    bits = clamp(bits, 1.5e6, 80e6);
    var prog = box.querySelector('.se-prog'), bar = prog.querySelector('i'), lab = prog.querySelector('span'), cancelB = box.querySelector('[data-cancel]'), goB = box.querySelector('[data-go]');
    prog.hidden = false; cancelB.hidden = false; this.exporting = true; var cancelled = false;
    cancelB.onclick = function () { cancelled = true; };
    function show(p, txt) { bar.style.width = clamp(p * 100, 0, 100) + '%'; lab.textContent = txt; }
    function end(msg, bad) { self.exporting = false; cancelB.hidden = true; goB.disabled = false; show(bad ? 0 : 1, msg); self.needs = true; self.syncVideos(self.t, false); }
    show(0, 'Getting ready…');
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([pickVideoCodec(W, H, fps, bits), pickAudioCodec(), fontsReady]).then(function (r) {
      var vcfg = r[0], acodec = r[1];
      if (!vcfg) { show(0, 'Using the real-time recorder (this browser can\'t do frame-perfect export)…'); return self.exportRealtime(S, W, H, box).then(function () { self.exporting = false; cancelB.hidden = true; goB.disabled = false; }); }
      var hasAudio = C.audioSources(P, self.buffers).length > 0;
      if (hasAudio && !acodec) self.toast('This browser can\'t encode sound in MP4 — the video will be silent. Try Chrome or Edge.', true);
      var mp4 = new C.MP4({ width: W, height: H, fps: fps, sampleRate: 48000, channels: 2, audioCodec: acodec ? acodec.kind : 'aac', audioBitrate: acodec ? acodec.cfg.bitrate : 0 }), err = null;
      var venc = new VideoEncoder({ output: function (c, m) { mp4.addVideo(c, m); }, error: function (e) { err = e; } });
      vcfg.latencyMode = 'quality'; vcfg.bitrateMode = 'variable';
      try { venc.configure(vcfg); } catch (e) { delete vcfg.bitrateMode; delete vcfg.latencyMode; venc.configure(vcfg); }
      var cv = C.mk(W, H), N = Math.max(1, Math.round(P.duration * fps)), i = 0, t0 = performance.now();
      self.syncVideos(0, false);
      var step = function () {
        if (err) throw err;
        if (cancelled) throw new Error('cancelled');
        if (i >= N) return null;
        var t = i / fps;
        return self.seekAllVideos(t).then(function () {
          self.frame(cv, Math.min(t, P.duration - 1e-4), false);
          var vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
          venc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close(); i++;
          if (i % 3 === 0) { var el = (performance.now() - t0) / 1000, left = el / i * (N - i); show(i / N * 0.92, 'Drawing frame ' + i + ' / ' + N + (i > 10 ? ' · about ' + Math.ceil(left) + 's left' : '') + (document.hidden ? ' — keep this tab open!' : '')); }
          var q = venc.encodeQueueSize > 6 ? (function w2() { return venc.encodeQueueSize > 2 ? wait(4).then(w2) : Promise.resolve(); })() : sleep0();
          return q.then(step);
        });
      };
      return Promise.resolve().then(step).then(function () { show(0.93, 'Finishing video…'); return venc.flush(); }).then(function () {
        try { venc.close(); } catch (e) { }
        if (!hasAudio || !acodec) return;
        show(0.95, 'Mixing sound…');
        return C.renderMix(P, self.buffers, 48000).then(function (buf) {
          if (!buf || cancelled) return;
          var aenc = new AudioEncoder({ output: function (c, m) { mp4.addAudio(c, m); }, error: function (e) { err = e; } });
          aenc.configure(acodec.cfg);
          var L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = buf.length, CH = 4800;
          for (var s = 0; s < n; s += CH) {
            var k = Math.min(CH, n - s), data = new Float32Array(k * 2); data.set(L.subarray(s, s + k), 0); data.set(R.subarray(s, s + k), k);
            var ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(s / 48000 * 1e6), data: data }); aenc.encode(ad); ad.close();
          }
          return aenc.flush().then(function () { try { aenc.close(); } catch (e) { } if (err) throw err; });
        });
      }).then(function () {
        if (cancelled) throw new Error('cancelled');
        show(0.99, 'Saving…'); var blob = mp4.finish();
        download(blob, safeName(P.name) + '.mp4');
        end('Done ✓ ' + round(blob.size / 1048576, 1) + ' MB — check your downloads');
        self.toast('Video exported ✦'); if (self.api.burst) self.api.burst(innerWidth / 2, innerHeight / 2, 30);
      }).catch(function (e) {
        try { venc.close(); } catch (x) { }
        if (e && e.message === 'cancelled') return end('Stopped', true);
        console.error(e); end('⚠ Export failed: ' + (e && e.message || e) + ' — trying the real-time recorder…', true);
        self.exporting = true; return self.exportRealtime(S, W, H, box).then(function () { self.exporting = false; });
      });
    }).catch(function (e) { console.error(e); end('⚠ ' + (e.message || e), true); });
  };
  // put every video at the right frame and wait for it
  EP.seekAllVideos = function (t) {
    var self = this, jobs = [];
    this.P.layers.forEach(function (el) {
      if (el.type !== 'video' || el.hidden || !el.media || t < el.start || t >= el.end) return;
      var v = self.videoFor(el); if (!v) return;
      var target = C.srcTime(el, t);
      jobs.push(new Promise(function (res) {
        var ready = function () { if (v.readyState >= 2) return true; return false; };
        if (Math.abs(v.currentTime - target) < 0.0005 && ready()) return res();
        var done = false, fin = function () { if (done) return; done = true; v.removeEventListener('seeked', on); clearTimeout(to); res(); };
        var on = function () { if (ready()) fin(); else setTimeout(fin, 50); };
        var to = setTimeout(fin, 3000);
        v.addEventListener('seeked', on);
        if (!v.paused) v.pause();
        try { v.currentTime = target; } catch (e) { fin(); }
      }));
    });
    return Promise.all(jobs);
  };
  // fallback: record in real time (older browsers)
  function pickMime() {
    if (!window.MediaRecorder) return null;
    var c = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01F,mp4a.40.2"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return c[i];
    return null;
  }
  function fixWebmDuration(blob, ms) {
    return blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab), p = -1;
      for (var i = 0; i < u.length - 4; i++) if (u[i] === 0x15 && u[i + 1] === 0x49 && u[i + 2] === 0xa9 && u[i + 3] === 0x66) { p = i; break; }
      if (p < 0) return blob;
      var s = p + 4, first = u[s], len = 1; while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
      if (len > 8) return blob;
      var size = first & (0xff >> len); for (var k = 1; k < len; k++) size = size * 256 + u[s + k];
      var body = u.subarray(s + len, s + len + size);
      for (var j = 0; j < body.length - 1; j++) if (body[j] === 0x44 && body[j + 1] === 0x89) return blob;
      var ns = size + 11; if (ns >= Math.pow(2, 7 * len) - 1) return blob;
      var sizeBytes = []; for (k = len - 1; k >= 0; k--) { sizeBytes[k] = ns & 255; ns = Math.floor(ns / 256); } sizeBytes[0] |= 0x80 >> (len - 1);
      var dur = new DataView(new ArrayBuffer(8)); dur.setFloat64(0, ms);
      var el = new Uint8Array([0x44, 0x89, 0x88].concat(Array.from(new Uint8Array(dur.buffer))));
      return new Blob([blob.slice(0, s), new Uint8Array(sizeBytes), el, blob.slice(s + len)], { type: blob.type });
    }).catch(function () { return blob; });
  }
  EP.exportRealtime = function (S, W, H, box) {
    var self = this, P = this.P, mime = pickMime(), prog = box.querySelector('.se-prog'), bar = prog.querySelector('i'), lab = prog.querySelector('span');
    if (!mime || !HTMLCanvasElement.prototype.captureStream) { lab.textContent = 'This browser can\'t export video. Please use Chrome or Edge on a computer.'; return Promise.resolve(); }
    return C.renderMix(P, this.buffers, 48000).then(function (mix) {
      return new Promise(function (resolve) {
        var cv = C.mk(W, H), ac = self.ctx(), stream = cv.captureStream(S.fps), dest = ac.createMediaStreamDestination(), src = null;
        if (mix) { src = ac.createBufferSource(); src.buffer = mix; src.connect(dest); }
        var hum = ac.createConstantSource ? ac.createConstantSource() : ac.createOscillator(), hg = ac.createGain(); hg.gain.value = 0.00001; hum.connect(hg); hg.connect(dest); hum.start();
        var rec; try { rec = new MediaRecorder(new MediaStream(stream.getVideoTracks().concat(dest.stream.getAudioTracks())), { mimeType: mime, videoBitsPerSecond: 12e6, audioBitsPerSecond: 256000 }); } catch (e) { rec = new MediaRecorder(new MediaStream(stream.getVideoTracks().concat(dest.stream.getAudioTracks()))); }
        var chunks = [], stopped = false;
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          try { if (src) src.stop(); } catch (e) { } try { hum.stop(); } catch (e) { } stream.getTracks().forEach(function (t) { t.stop(); });
          var type = (rec.mimeType || mime).split(';')[0], b0 = new Blob(chunks, { type: type });
          (/webm/.test(type) ? fixWebmDuration(b0, P.duration * 1000) : Promise.resolve(b0)).then(function (b) { download(b, safeName(P.name) + (/mp4/.test(type) ? '.mp4' : '.webm')); bar.style.width = '100%'; lab.textContent = 'Done ✓ ' + round(b.size / 1048576, 1) + ' MB'; resolve(); });
        };
        var cb = box.querySelector('[data-cancel]'); cb.onclick = function () { stopped = true; rec.onstop = null; try { rec.stop(); } catch (e) { } try { if (src) src.stop(); hum.stop(); } catch (e) { } lab.textContent = 'Stopped'; resolve(); };
        self.frame(cv, 0, false); self.syncVideos(0, true);
        var start = ac.currentTime + 0.25; if (src) src.start(start); rec.start(500);
        var tick = function () {
          if (stopped) return;
          var t = ac.currentTime - start;
          if (t >= P.duration) { self.frame(cv, P.duration - 0.001, false); setTimeout(function () { try { rec.stop(); } catch (e) { } }, 150); self.syncVideos(0, false); return; }
          if (t >= 0) { self.syncVideos(t, true); self.frame(cv, t, false); }
          bar.style.width = clamp(t / P.duration * 100, 0, 100) + '%'; lab.textContent = 'Recording in real time… ' + C.fmtTime(Math.max(0, t)) + ' / ' + C.fmtTime(P.duration) + ' — keep this tab in front';
          if (document.hidden) setTimeout(tick, 16); else requestAnimationFrame(tick);
        };
        tick();
      });
    });
  };

  /* =========================================================
     TEMPLATE MAKER (admin)
     ========================================================= */
  EP.saveTemplate = function () {
    var self = this, P = this.P;
    if (!P.layers.length) return this.toast('Add something first ✦', true);
    if (!P.name || P.name === 'New template') { var n = prompt('Template name?', P.name || ''); if (n == null) return; P.name = n.trim() || 'Template'; this.$('.se-name').value = P.name; }
    var blobs = {}; Object.keys(P.media).forEach(function (id) { if (!P.media[id].src && self.media[id] && self.media[id].blob) blobs[id] = self.media[id].blob; });
    var tc = C.mk(270, Math.round(270 * P.h / P.w)); try { this.frame(tc, Math.min(Math.max(this.t, 0.5), P.duration - 0.01), false); } catch (e) { }
    var out = { project: JSON.parse(JSON.stringify(P)), blobs: blobs, thumb: tc };
    this.dirty = false;
    if (this.opts.onSave) this.opts.onSave(out);
  };

  /* =========================================================
     ACCOUNTS (optional — only if the site owner set it up)
     ========================================================= */
  EP.updateLogin = function () { var b = this.$('[data-login]'); if (!b || !this.cloud) return; b.textContent = this.cloud.user ? '☁ ' + (this.cloud.user.email || 'ACCOUNT').split('@')[0].toUpperCase() : '☁ LOG IN'; };
  EP.cloudDialog = function () {
    var self = this, c = this.cloud;
    if (c.user) {
      var box = this.modal('<h2>☁ YOUR ACCOUNT</h2><p>Logged in as <b>' + E(c.user.email) + '</b></p><div class="se-btnrow"><button type="button" class="se-btn hot" data-up>☁ SAVE THIS PROJECT TO MY ACCOUNT</button><button type="button" class="se-btn" data-list>📁 MY PROJECTS</button><button type="button" class="se-btn" data-out>LOG OUT</button></div><div class="se-prog" hidden><i></i><span></span></div>');
      box.querySelector('[data-up]').addEventListener('click', function () { self.cloudSave(box); });
      box.querySelector('[data-list]').addEventListener('click', function () { self.projectsDialog(); });
      box.querySelector('[data-out]').addEventListener('click', function () { c.logout().then(function () { self.updateLogin(); self.closeModal(); self.toast('Logged out'); }); });
      return;
    }
    var box2 = this.modal('<h2>☁ LOG IN</h2><p class="se-help">Log in to save your edits online and open them on any device.</p><label class="se-f"><span class="se-fl">Email</span><input type="email" data-em autocomplete="email"></label><label class="se-f"><span class="se-fl">Password</span><input type="password" data-pw autocomplete="current-password" minlength="6"></label><div class="se-btnrow"><button type="button" class="se-btn hot" data-in>LOG IN</button><button type="button" class="se-btn" data-sign>CREATE ACCOUNT</button><button type="button" class="se-btn sm" data-forgot>Forgot password?</button></div><p class="se-msg" aria-live="polite"></p>');
    var msg = box2.querySelector('.se-msg'), em = box2.querySelector('[data-em]'), pw = box2.querySelector('[data-pw]');
    function run(p, okText) { msg.textContent = '…'; p.then(function (r) { if (r && r.confirm) { msg.textContent = 'Check your email to confirm your account, then log in here.'; return; } self.updateLogin(); msg.textContent = okText; setTimeout(function () { self.cloudDialog(); }, 600); }).catch(function (e) { msg.textContent = '⚠ ' + (e.message || e); }); }
    box2.querySelector('[data-in]').addEventListener('click', function () { run(c.login(em.value.trim(), pw.value), 'Logged in ✓'); });
    box2.querySelector('[data-sign]').addEventListener('click', function () { if (pw.value.length < 6) { msg.textContent = 'Password needs at least 6 characters'; return; } run(c.signup(em.value.trim(), pw.value), 'Account created ✓'); });
    box2.querySelector('[data-forgot]').addEventListener('click', function () { if (!em.value.trim()) { msg.textContent = 'Type your email first'; return; } c.recover(em.value.trim()).then(function () { msg.textContent = 'Password reset email sent.'; }).catch(function (e) { msg.textContent = '⚠ ' + e.message; }); });
  };
  EP.cloudSave = function (box) {
    var self = this, c = this.cloud, P = this.P, prog = box && box.querySelector('.se-prog');
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
    if (!c.user) { row.innerHTML = '<div class="se-fh">☁ Your account</div><button type="button" class="se-btn" data-li>LOG IN TO SEE ONLINE PROJECTS</button>'; row.querySelector('[data-li]').addEventListener('click', function () { self.cloudDialog(); }); return; }
    row.innerHTML = '<div class="se-fh">☁ Saved in your account</div><div class="se-plist">Loading…</div><button type="button" class="se-btn" data-sv>☁ SAVE CURRENT PROJECT</button>';
    row.querySelector('[data-sv]').addEventListener('click', function () { self.cloudSave(null).then(function () { self.projectsDialog(); }); });
    c.listProjects().then(function (items) {
      var l = row.querySelector('.se-plist'); l.innerHTML = items.length ? '' : '<p class="se-help">Nothing saved online yet.</p>';
      items.forEach(function (it) {
        var d = h('div', { class: 'se-pitem' }, '<i>☁</i><div><b>' + E(it.name) + '</b><small>' + (it.updated ? new Date(it.updated).toLocaleString() : '') + '</small></div><button type="button" class="se-btn hot" data-o>OPEN</button><button type="button" class="se-btn sm" data-x>🗑</button>');
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
})();
