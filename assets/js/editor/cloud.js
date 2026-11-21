/* =========================================================
   SUL0557 — SHORT EDITOR accounts (optional)
   Uses a free Supabase project (email + password login and
   file storage). Only active when the site owner adds the
   Supabase URL + public "anon" key in the admin.
   ========================================================= */
(function () {
  'use strict';
  var LS = 'sul.short.sb';
  function Cloud(conf) {
    conf = conf || {};
    this.url = String(conf.url || '').trim().replace(/\/+$/, '');
    this.key = String(conf.anonKey || '').trim();
    this.bucket = String(conf.bucket || 'projects').trim() || 'projects';
    this.ok = !!(this.url && this.key && /^https:\/\//.test(this.url) && conf.enabled !== false);
    this.session = null; this.user = null;
    try { var s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.url === this.url) { this.session = s; this.user = s.user; } } catch (e) { }
  }
  var C = Cloud.prototype;
  C.save = function (s) { this.session = s; this.user = s ? s.user : null; try { if (s) { s.url = this.url; localStorage.setItem(LS, JSON.stringify(s)); } else localStorage.removeItem(LS); } catch (e) { } };
  function errText(j, status) {
    var m = j && (j.error_description || j.msg || j.message || j.error) || ('Error ' + status);
    if (/Invalid login/i.test(m)) return 'Wrong email or password';
    if (/Email not confirmed/i.test(m)) return 'Please confirm your email first (check your inbox)';
    if (/already registered/i.test(m)) return 'That email already has an account — log in instead';
    return m;
  }
  C.auth = function (path, body) {
    var self = this;
    return fetch(this.url + '/auth/v1/' + path, { method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(errText(j, r.status)); return j; }); });
  };
  C.withSession = function (j) { if (j.access_token) { this.save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email } }); return { ok: true }; } return { confirm: true }; };
  C.login = function (email, pw) { var self = this; if (!email || !pw) return Promise.reject(new Error('Type your email and password')); return this.auth('token?grant_type=password', { email: email, password: pw }).then(function (j) { return self.withSession(j); }); };
  C.signup = function (email, pw) { var self = this; if (!email || !pw) return Promise.reject(new Error('Type your email and password')); return this.auth('signup', { email: email, password: pw }).then(function (j) { return self.withSession(j.session || j); }); };
  C.recover = function (email) { return this.auth('recover', { email: email }); };
  C.logout = function () { var self = this, s = this.session; this.save(null); if (!s) return Promise.resolve(); return fetch(this.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: this.key, Authorization: 'Bearer ' + s.access_token } }).catch(function () { }).then(function () { }); };
  C.token = function () {
    var self = this, s = this.session;
    if (!s) return Promise.reject(new Error('Please log in first'));
    if (s.expires_at - Date.now() > 60000) return Promise.resolve(s.access_token);
    return this.auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(function (j) { self.withSession(j); return j.access_token; })
      .catch(function (e) { self.save(null); throw new Error('Your login expired — please log in again'); });
  };
  function enc(path) { return path.split('/').map(encodeURIComponent).join('/'); }
  C.req = function (method, path, body, headers, raw) {
    var self = this;
    return this.token().then(function (tok) {
      var h = Object.assign({ apikey: self.key, Authorization: 'Bearer ' + tok }, headers || {});
      return fetch(self.url + '/storage/v1/' + path, { method: method, headers: h, body: body });
    }).then(function (r) {
      if (raw && r.ok) return r;
      return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { } if (!r.ok) { var m = errText(j, r.status); if (/bucket not found/i.test(m)) m = 'Storage isn\'t set up yet (site owner: create the “' + self.bucket + '” bucket)'; if (/row-level security|policy/i.test(m)) m = 'Storage permissions aren\'t set up yet (site owner: run the setup SQL)'; throw new Error(m); } return j; });
    });
  };
  C.base = function () { if (!this.user) throw new Error('Please log in first'); return this.user.id; };
  C.upload = function (path, blob, type) { return this.req('POST', 'object/' + enc(this.bucket + '/' + path), blob, { 'Content-Type': type || blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '0' }); };
  C.downloadBlob = function (path) { return this.req('GET', 'object/authenticated/' + enc(this.bucket + '/' + path), null, null, true).then(function (r) { return r.blob(); }); };
  C.list = function (prefix) { return this.req('POST', 'object/list/' + encodeURIComponent(this.bucket), JSON.stringify({ prefix: prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }), { 'Content-Type': 'application/json' }); };
  C.index = function () { var self = this; return this.downloadBlob(this.base() + '/index.json').then(function (b) { return b.text(); }).then(function (t) { return JSON.parse(t); }).catch(function () { return []; }); };
  C.writeIndex = function (list) { return this.upload(this.base() + '/index.json', new Blob([JSON.stringify(list)], { type: 'application/json' })); };
  C.listProjects = function () { return this.index().then(function (l) { return (l || []).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }); }); };
  C.listMedia = function (pid) { return this.list(this.base() + '/' + pid + '/media/').then(function (items) { var have = {}; (items || []).forEach(function (it) { if (it && it.name) have[it.name] = 1; }); return have; }).catch(function () { return {}; }); };
  C.putMedia = function (pid, id, blob) { if (blob.size > 50 * 1048576) return Promise.reject(new Error('A file is over 50 MB, too big for the free online storage')); return this.upload(this.base() + '/' + pid + '/media/' + id, blob); };
  C.getMedia = function (pid, id) { return this.downloadBlob(this.base() + '/' + pid + '/media/' + id); };
  C.putProject = function (P, thumb) {
    var self = this, uid = this.base();
    return this.upload(uid + '/' + P.id + '/project.json', new Blob([JSON.stringify(P)], { type: 'application/json' }))
      .then(function () { return self.index(); })
      .then(function (l) { l = (l || []).filter(function (x) { return x.id !== P.id; }); l.push({ id: P.id, name: P.name || 'Untitled', updated: Date.now() }); return self.writeIndex(l); });
  };
  C.getProject = function (pid) { return this.downloadBlob(this.base() + '/' + pid + '/project.json').then(function (b) { return b.text(); }).then(function (t) { return JSON.parse(t); }); };
  C.deleteProject = function (pid) {
    var self = this, uid = this.base();
    return this.list(uid + '/' + pid + '/media/').catch(function () { return []; }).then(function (items) {
      var paths = (items || []).map(function (it) { return uid + '/' + pid + '/media/' + it.name; }); paths.push(uid + '/' + pid + '/project.json');
      return self.req('DELETE', 'object/' + encodeURIComponent(self.bucket), JSON.stringify({ prefixes: paths }), { 'Content-Type': 'application/json' });
    }).then(function () { return self.index(); }).then(function (l) { return self.writeIndex((l || []).filter(function (x) { return x.id !== pid; })); });
  };
  window.ShortCloud = Cloud;
})();
