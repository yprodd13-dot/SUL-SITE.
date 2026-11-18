/* =========================================================
   SUL0557 — popups & update notices
   Shown after the intro (or straight away if there is no intro).
   Each popup can show every visit, once per visit, or only once
   (editing a popup's text makes it show again, so updates get seen).
   Settings: site.json -> popups (edit in the admin, 🔔 Popups & Updates).
   ========================================================= */
(function () {
  'use strict';

  var cfg = null, api = null, preview = false;
  var queue = [], open = null, shownThisLoad = {}, timers = [], lastFocus = null;

  function hash(str) { var h = 0; str = String(str); for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); }
  function keyFor(p) { return 'sul.pop.' + p.id + '.' + hash([p.tag, p.title, p.text, p.image, p.embed].join('|')); }
  function seen(p) {
    try {
      if (p.frequency === 'once') return localStorage.getItem(keyFor(p)) === '1';
      if (p.frequency === 'session') return sessionStorage.getItem(keyFor(p)) === '1';
    } catch (e) {}
    return false;
  }
  function markSeen(p) {
    try {
      if (p.frequency === 'once') localStorage.setItem(keyFor(p), '1');
      else if (p.frequency === 'session') sessionStorage.setItem(keyFor(p), '1');
    } catch (e) {}
  }
  function inDates(p) {
    var now = Date.now();
    var s = p.start ? new Date(p.start).getTime() : NaN, e = p.end ? new Date(p.end).getTime() : NaN;
    if (isFinite(s) && now < s) return false;
    if (isFinite(e) && now > e) return false;
    return true;
  }
  function eligible(p, pageId) {
    if (!p || p.enabled === false) return false;
    if (!(p.title || p.text || p.image || p.embed)) return false;
    var where = p.page || 'all';
    if (where !== 'all' && where !== pageId) return false;
    return inDates(p) && !seen(p) && !shownThisLoad[p.id];
  }

  function close(skipNext) {
    if (!open) return;
    var o = open; open = null;
    markSeen(o.p);
    o.el.classList.add('pop-out');
    setTimeout(function () { o.el.remove(); }, 220);
    if (o.p.position !== 'corner') document.body.classList.remove('pop-lock');
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus && o.p.position !== 'corner') try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    if (!skipNext) setTimeout(nextInQueue, 350);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function render(p) {
    var corner = p.position === 'corner';
    var el = document.createElement('div');
    el.className = 'pop ' + (corner ? 'pop-corner' : 'pop-center');
    el.setAttribute('role', corner ? 'status' : 'dialog');
    if (!corner) el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', p.title || 'Notice');
    var img = api.asset(p.image);
    el.innerHTML = '<div class="pop-box">' +
      '<div class="pop-bar"><span>' + api.esc(p.tag || 'NOTICE') + '</span><button type="button" class="pop-x" aria-label="Close">' + api.icon('popup-close') + '</button></div>' +
      (img ? '<div class="pop-img"><img src="' + api.esc(img) + '" alt=""></div>' : '') +
      '<div class="pop-body">' +
        (p.title ? '<h2 class="pop-title">' + api.headline(p.title) + '</h2>' : '') +
        (p.text ? '<div class="pop-text rich">' + api.rich(p.text) + '</div>' : '') +
        (p.embed ? '<div class="pop-embed">' + api.embedHtml({ code: p.embed, height: p.embedHeight, cardTitle: p.title }) + '</div>' : '') +
        api.buttonsHtml(p.buttons) +
      '</div></div>';
    el.addEventListener('click', function (e) {
      if (e.target === el && !corner) close();
      else if (e.target.closest('.pop-x')) close();
      else if (e.target.closest('.btn, .btn-img')) { var a = e.target.closest('a'); if (a && (a.getAttribute('href') || '').charAt(0) === '#') close(); }
    });
    el.querySelectorAll('.reveal').forEach(function (r) { r.classList.add('is-in'); });
    return el;
  }

  function show(p) {
    if (open) close(true);
    lastFocus = document.activeElement;
    var el = render(p);
    document.body.appendChild(el);
    open = { p: p, el: el };
    shownThisLoad[p.id] = true;
    if (p.position !== 'corner') {
      document.body.classList.add('pop-lock');
      var x = el.querySelector('.pop-x'); if (x) setTimeout(function () { try { x.focus({ preventScroll: true }); } catch (e) {} }, 50);
    }
    document.addEventListener('keydown', onKey);
  }
  function nextInQueue() {
    if (open || !queue.length) return;
    var p = queue.shift();
    var d = Math.max(0, Number(p.delay) || 0) * 1000;
    timers.push(setTimeout(function () { if (!open) show(p); else queue.unshift(p); }, d));
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  window.SulPopups = {
    configure: function (c, a, isPreview) {
      cfg = c; api = a; preview = !!isPreview;
      if (open && preview) { // live-update an open popup while editing in the admin
        var same = (cfg.popups || []).filter(function (x) { return x.id === open.p.id; })[0];
        if (same) { var old = open.el; var nu = render(same); old.replaceWith(nu); open = { p: same, el: nu }; }
        else close(true);
      }
    },
    start: function (pageId) {
      if (preview || !cfg) return;
      clearTimers();
      queue = (cfg.popups || []).filter(function (p) { return eligible(p, pageId); });
      nextInQueue();
    },
    pageChanged: function (pageId) {
      if (preview || !cfg || open) return;
      var more = (cfg.popups || []).filter(function (p) { return p.page && p.page !== 'all' && eligible(p, pageId); });
      if (more.length) { queue = queue.concat(more); nextInQueue(); }
    },
    show: function (id, force) {
      var p = (cfg && cfg.popups || []).filter(function (x) { return x.id === id; })[0];
      if (p && (force || eligible(p, ''))) show(p);
    },
    close: close
  };
})();
