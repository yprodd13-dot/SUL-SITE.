/* =========================================================
   SUL0557 — Zip renamer engine
   Reads a zip's table of contents WITHOUT loading the whole
   zip into memory, renames entries, and writes a new zip that
   re-uses the original compressed bytes (no recompression),
   so big kits (GBs) work and come out identical inside.
   Supports zip64, data descriptors, UTF-8 names, folders.
   ========================================================= */
(function () {
  'use strict';

  var CRC_T = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crcUpdate(crc, u8) { var c = crc ^ 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  async function crcOfBlob(blob, onProgress) {
    var crc = 0, CH = 8 * 1024 * 1024;
    for (var off = 0; off < blob.size; off += CH) {
      crc = crcUpdate(crc, new Uint8Array(await blob.slice(off, off + CH).arrayBuffer()));
      if (onProgress) onProgress(Math.min(1, (off + CH) / blob.size));
    }
    return crc;
  }

  var CP437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  var utf8 = new TextDecoder('utf-8', { fatal: true }), enc = new TextEncoder();
  function decodeName(bytes, isUtf8) {
    if (isUtf8) { try { return utf8.decode(bytes); } catch (e) { } }
    var ascii = true; for (var i = 0; i < bytes.length; i++) if (bytes[i] > 127) { ascii = false; break; }
    if (ascii) return String.fromCharCode.apply(null, bytes);
    try { return utf8.decode(bytes); } catch (e) { } // many tools write UTF-8 without the flag
    var s = ''; for (i = 0; i < bytes.length; i++) s += CP437[bytes[i]]; return s;
  }
  function u64(dv, o) { return dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296; }

  /* ---------- read ---------- */
  async function read(file) {
    var size = file.size;
    if (size < 22) throw new Error('This file is too small to be a zip.');
    var tailLen = Math.min(size, 65557 + 20), tailStart = size - tailLen;
    var tail = new Uint8Array(await file.slice(tailStart, size).arrayBuffer()), tdv = new DataView(tail.buffer);
    var e = -1;
    for (var i = tail.length - 22; i >= 0; i--) if (tdv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('This doesn\'t look like a zip file (no zip directory found). If it\'s a .rar or .7z, re-save it as .zip first.');
    var count = tdv.getUint16(e + 10, true), cdSize = tdv.getUint32(e + 12, true), cdOff = tdv.getUint32(e + 16, true);
    var commentLen = tdv.getUint16(e + 20, true);
    var zip64 = false;
    if (e >= 20 && tdv.getUint32(e - 20, true) === 0x07064b50) {
      var z64off = u64(tdv, e - 20 + 8);
      var zr = new DataView(await file.slice(z64off, z64off + 56).arrayBuffer());
      if (zr.getUint32(0, true) === 0x06064b50) { count = u64(zr, 32); cdSize = u64(zr, 40); cdOff = u64(zr, 48); zip64 = true; }
    }
    // zips with junk/self-extractor at the front: shift offsets
    var eocdAbs = tailStart + e, shift = 0;
    if (!zip64 && cdOff + cdSize !== eocdAbs) shift = eocdAbs - (cdOff + cdSize);
    if (cdOff + shift + cdSize > size) throw new Error('The zip\'s directory is damaged.');
    var cd = new Uint8Array(await file.slice(cdOff + shift, cdOff + shift + cdSize).arrayBuffer()), dv = new DataView(cd.buffer);
    var entries = [], p = 0;
    while (p + 46 <= cd.length && dv.getUint32(p, true) === 0x02014b50) {
      var en = {
        madeBy: dv.getUint16(p + 4, true), needed: dv.getUint16(p + 6, true), flags: dv.getUint16(p + 8, true), method: dv.getUint16(p + 10, true),
        time: dv.getUint16(p + 12, true), date: dv.getUint16(p + 14, true), crc: dv.getUint32(p + 16, true),
        csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true), internal: dv.getUint16(p + 36, true), external: dv.getUint32(p + 38, true),
        offset: dv.getUint32(p + 42, true)
      };
      var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      var nameBytes = cd.subarray(p + 46, p + 46 + nl);
      en.name = decodeName(nameBytes, !!(en.flags & 0x800));
      var x = p + 46 + nl, xe = x + xl;
      while (x + 4 <= xe) {
        var id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true), q = x + 4;
        if (id === 0x0001) {
          if (en.usize === 0xFFFFFFFF && q + 8 <= x + 4 + sz) { en.usize = u64(dv, q); q += 8; }
          if (en.csize === 0xFFFFFFFF && q + 8 <= x + 4 + sz) { en.csize = u64(dv, q); q += 8; }
          if (en.offset === 0xFFFFFFFF && q + 8 <= x + 4 + sz) { en.offset = u64(dv, q); q += 8; }
        } else if (id === 0x7075 && sz > 5) { // Info-ZIP unicode path
          try { en.name = utf8.decode(cd.subarray(x + 9, x + 4 + sz)); } catch (err) { }
        }
        x += 4 + sz;
      }
      en.offset += shift;
      en.comment = cl ? cd.slice(p + 46 + nl + xl, p + 46 + nl + xl + cl) : null;
      en.isDir = /\/$/.test(en.name) || (en.usize === 0 && (en.external & 0x10) !== 0);
      if (en.isDir && !/\/$/.test(en.name)) en.name += '/';
      en.name = en.name.replace(/\\/g, '/');
      en.index = entries.length;
      entries.push(en);
      p += 46 + nl + xl + cl;
    }
    if (!entries.length && count) throw new Error('Couldn\'t read the files inside this zip.');
    return { file: file, entries: entries, zip64: zip64, comment: commentLen };
  }

  // files dropped loose (not a zip): wrap them as "stored" entries
  function fromFiles(files) {
    var entries = [], now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    Array.prototype.forEach.call(files, function (f) {
      var nm = (f.webkitRelativePath || f.relPath || f.name).replace(/\\/g, '/');
      entries.push({ index: entries.length, name: nm, isDir: false, method: 0, flags: 0x800, time: dosTime, date: dosDate, crc: null, csize: f.size, usize: f.size, external: 0, internal: 0, madeBy: 20, needed: 20, loose: f });
    });
    return { file: null, entries: entries, loose: true };
  }

  /* ---------- naming ---------- */
  var BAD = /[\\/:*?"<>|\u0000-\u001f]/g;
  function splitExt(n) { var i = n.lastIndexOf('.'); if (i <= 0) return [n, '']; return [n.slice(0, i), n.slice(i)]; }
  function titleCase(s) { return s.toLowerCase().replace(/(^|[\s_\-(\[])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function isJunk(name) { return /(^|\/)__MACOSX\//.test(name) || /(^|\/)\.DS_Store$/.test(name) || /(^|\/)Thumbs\.db$/i.test(name) || /(^|\/)desktop\.ini$/i.test(name); }

  // R = rules object (see tools.js for the UI that fills it)
  function renameBase(base, R, ctx) {
    var parts = R.renameExt ? [base, ''] : splitExt(base), stem = parts[0], ext = parts[1];
    (R.replace || []).forEach(function (rr) {
      if (!rr || !rr.find) return;
      try {
        var re = rr.regex ? new RegExp(rr.find, rr.caseSens ? 'g' : 'gi') : new RegExp(escRe(rr.find), rr.caseSens ? 'g' : 'gi');
        stem = stem.replace(re, rr.with || '');
      } catch (e) { ctx.badRegex = true; }
    });
    if (R.stripNumbers) stem = stem.replace(/^\s*[\[(]?\d+[\])]?\s*[-_.)]*\s*/, '');
    if (R.stripBrackets) stem = stem.replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ');
    if (R.stripTags) stem = stem.replace(/@[\w.]+\s*/g, '');
    if (R.removeChars) { var rc = String(R.removeChars); for (var k = 0; k < rc.length; k++) stem = stem.split(rc[k]).join(''); }
    if (R.trim !== false) stem = stem.replace(/\s+/g, ' ').trim();
    switch (R.caseMode) {
      case 'upper': stem = stem.toUpperCase(); break;
      case 'lower': stem = stem.toLowerCase(); break;
      case 'title': stem = titleCase(stem); break;
      case 'sentence': stem = stem.charAt(0).toUpperCase() + stem.slice(1).toLowerCase(); break;
    }
    switch (R.spaces) {
      case 'underscore': stem = stem.replace(/ /g, '_'); break;
      case 'dash': stem = stem.replace(/ /g, '-'); break;
      case 'none': stem = stem.replace(/ /g, ''); break;
      case 'dot': stem = stem.replace(/ /g, '.'); break;
    }
    var pre = R.prefix || '', suf = R.suffix || '';
    if (pre && R.skipIfHas && stem.indexOf(pre) === 0) pre = '';
    if (suf && R.skipIfHas && stem.slice(-suf.length) === suf) suf = '';
    var sepP = pre ? (R.prefixSep == null ? ' ' : R.prefixSep) : '', sepS = suf ? (R.suffixSep == null ? ' ' : R.suffixSep) : '';
    stem = pre + sepP + stem + sepS + suf;
    if (R.numbering && R.numbering !== 'off' && ctx.num != null) {
      var n = String(ctx.num); while (n.length < (R.numPad || 1)) n = '0' + n;
      var ns = R.numSep == null ? ' ' : R.numSep, numTxt = (R.numBefore || '') + n + (R.numAfter || '');
      stem = R.numbering === 'start' ? numTxt + ns + stem : stem + ns + numTxt;
    }
    if (ext) {
      if (R.extMode === 'lower') ext = ext.toLowerCase();
      else if (R.extMode === 'upper') ext = ext.toUpperCase();
      else if (R.extMode === 'custom' && R.extCustom) ext = '.' + String(R.extCustom).replace(/^\.+/, '');
    }
    var out = stem + ext;
    if (/[\\/:*?"<>|\u0000-\u001f]/.test(out)) { ctx.fixedChars = true; out = out.replace(BAD, '_'); }
    out = out.replace(/[ .]+$/, ''); // Windows doesn't allow trailing dots/spaces
    return out || base;
  }
  function extOf(n) { var e = splitExt(n)[1]; return e ? e.slice(1).toLowerCase() : ''; }
  function matchesFilter(en, R) {
    var base = en.name.replace(/\/$/, '').split('/').pop();
    if (R.onlyExt) {
      var list = String(R.onlyExt).toLowerCase().split(/[\s,;]+/).map(function (s) { return s.replace(/^\./, ''); }).filter(Boolean);
      if (list.length && list.indexOf(extOf(base)) < 0) return false;
    }
    if (R.onlyFolder) { if (en.name.toLowerCase().indexOf(String(R.onlyFolder).toLowerCase()) < 0) return false; }
    if (R.onlyContains) { if (base.toLowerCase().indexOf(String(R.onlyContains).toLowerCase()) < 0) return false; }
    return true;
  }

  // returns [{entry, oldName, newName, changed, skipped, dup, manual}]
  function plan(z, R, manual) {
    R = R || {}; manual = manual || {};
    var ctx = {}, rows = [], dirMap = {};
    var list = z.entries.filter(function (en) { return !(R.dropJunk !== false && isJunk(en.name)); });
    // numbering order
    var order = list.filter(function (en) { return !en.isDir && matchesFilter(en, R); });
    if (R.numOrder === 'az') order = order.slice().sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }); });
    var numFor = {}, st = R.numStart == null ? 1 : +R.numStart, step = R.numStep || 1;
    if (R.numPerFolder) {
      var counters = {};
      order.forEach(function (en) { var d = en.name.slice(0, en.name.lastIndexOf('/') + 1); counters[d] = counters[d] == null ? st : counters[d] + step; numFor[en.index] = counters[d]; });
    } else order.forEach(function (en, i) { numFor[en.index] = st + i * step; });
    function mapDir(path) { // "a/b/" -> renamed
      if (!path) return '';
      if (dirMap[path] != null) return dirMap[path];
      var segs = path.replace(/\/$/, '').split('/'), last = segs.pop(), parent = segs.length ? segs.join('/') + '/' : '';
      var nn = last;
      if (manual['d:' + path] != null) nn = manual['d:' + path];
      else if (R.folders) nn = renameBase(last, Object.assign({}, R, { renameExt: true, extMode: 'keep', numbering: 'off' }), ctx);
      return (dirMap[path] = mapDir(parent) + nn + '/');
    }
    list.forEach(function (en) {
      var full = en.name, isDir = en.isDir, base = full.replace(/\/$/, '').split('/').pop();
      var dir = full.slice(0, full.length - (isDir ? base.length + 1 : base.length));
      var newDir = mapDir(dir), nb = base, hit = false;
      if (isDir) { var nd = mapDir(full); nb = nd.slice(newDir.length).replace(/\/$/, ''); }
      else if (manual[en.index] != null) { nb = String(manual[en.index]).replace(BAD, '_') || base; }
      else if (matchesFilter(en, R)) { hit = true; ctx.num = numFor[en.index]; nb = renameBase(base, R, ctx); ctx.num = null; }
      var nn = newDir + nb + (isDir ? '/' : '');
      rows.push({ entry: en, oldName: full, newName: nn, changed: nn !== full, filtered: !isDir && !hit && manual[en.index] == null, manual: manual[en.index] != null });
    });
    // duplicates (Windows ignores case, so compare lower-case)
    var seen = {};
    rows.forEach(function (r) { var k = r.newName.toLowerCase(); if (seen[k]) { r.dup = true; seen[k].dup = true; } else seen[k] = r; });
    return { rows: rows, badRegex: !!ctx.badRegex, fixedChars: !!ctx.fixedChars, junk: z.entries.length - list.length, dups: rows.filter(function (r) { return r.dup; }).length };
  }
  function resolveDups(rows) {
    var used = {};
    rows.forEach(function (r) {
      var n = r.newName, k = n.toLowerCase();
      if (used[k]) {
        var isDir = /\/$/.test(n), body = isDir ? n.slice(0, -1) : n, se = isDir ? [body, ''] : (function () { var sl = body.lastIndexOf('/'), b = body.slice(sl + 1), pe = splitExt(b); return [body.slice(0, sl + 1) + pe[0], pe[1]]; })();
        var i = 2; while (used[(se[0] + ' (' + i + ')' + se[1] + (isDir ? '/' : '')).toLowerCase()]) i++;
        n = se[0] + ' (' + i + ')' + se[1] + (isDir ? '/' : ''); k = n.toLowerCase();
      }
      used[k] = true; r.finalName = n;
    });
    return rows;
  }

  /* ---------- write ---------- */
  function le16(v) { return [v & 255, (v >>> 8) & 255]; }
  function le32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function le64(v) { var lo = v % 4294967296, hi = Math.floor(v / 4294967296); return le32(lo).concat(le32(hi)); }
  var M32 = 0xFFFFFFFF;

  // rows: from plan() (+finalName). opts.onProgress(fraction, label)
  async function write(z, rows, opts) {
    opts = opts || {};
    var parts = [], cdParts = [], offset = 0, n = rows.length, prog = opts.onProgress || function () { };
    resolveDups(rows);
    // read local headers in batches to find where each entry's data starts
    for (var i = 0; i < n; i++) {
      var r = rows[i], en = r.entry, dataBlob, dataStart;
      if (en.loose) {
        if (en.crc == null) en.crc = await crcOfBlob(en.loose, function (f) { prog((i + f) / n, 'Checking ' + en.name); });
        dataBlob = en.loose;
      } else {
        var lh = new DataView(await z.file.slice(en.offset, en.offset + 30).arrayBuffer());
        if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('Damaged entry in zip: ' + en.name);
        dataStart = en.offset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        dataBlob = z.file.slice(dataStart, dataStart + en.csize);
      }
      var nameB = enc.encode(r.finalName), big = en.csize >= M32 || en.usize >= M32, offBig = offset >= M32;
      var flags = (en.flags & ~0x0008) | 0x0800; // no data descriptor; names are UTF-8
      var needed = Math.max(en.needed || 20, (big || offBig) ? 45 : 20) & 0xFF;
      var lx = big ? [].concat(le16(1), le16(16), le64(en.usize), le64(en.csize)) : [];
      var local = [].concat(le32(0x04034b50), le16(needed), le16(flags), le16(en.method), le16(en.time), le16(en.date), le32(en.crc >>> 0),
        le32(big ? M32 : en.csize), le32(big ? M32 : en.usize), le16(nameB.length), le16(lx.length));
      var lhBytes = new Uint8Array(local.length + nameB.length + lx.length);
      lhBytes.set(local, 0); lhBytes.set(nameB, local.length); lhBytes.set(lx, local.length + nameB.length);
      parts.push(lhBytes, dataBlob);
      // central record
      var cx = [];
      if (big || offBig) {
        var body = [];
        if (big) body = body.concat(le64(en.usize), le64(en.csize));
        if (offBig) body = body.concat(le64(offset));
        cx = [].concat(le16(1), le16(body.length), body);
      }
      var cmt = en.comment || new Uint8Array(0);
      var madeBy = ((en.madeBy >> 8) === 3 ? 0x0300 : 0) | Math.max(needed, en.madeBy & 0xFF);
      var central = [].concat(le32(0x02014b50), le16(madeBy), le16(needed), le16(flags), le16(en.method), le16(en.time), le16(en.date), le32(en.crc >>> 0),
        le32(big ? M32 : en.csize), le32(big ? M32 : en.usize), le16(nameB.length), le16(cx.length), le16(cmt.length), le16(0), le16(en.internal || 0), le32(en.external >>> 0), le32(offBig ? M32 : offset));
      var cb = new Uint8Array(central.length + nameB.length + cx.length + cmt.length);
      cb.set(central, 0); cb.set(nameB, central.length); cb.set(cx, central.length + nameB.length); cb.set(cmt, central.length + nameB.length + cx.length);
      cdParts.push(cb);
      offset += lhBytes.length + en.csize;
      if (i % 200 === 0) { prog(i / n, 'Renaming ' + (i + 1) + ' / ' + n); await new Promise(function (res) { setTimeout(res, 0); }); }
    }
    var cdStart = offset, cdSize = 0;
    cdParts.forEach(function (b) { cdSize += b.length; });
    var needZ64 = n >= 0xFFFF || cdStart >= M32 || cdSize >= M32;
    var tail = [];
    if (needZ64) {
      var z64At = cdStart + cdSize;
      tail = tail.concat(le32(0x06064b50), le64(44), le16(45), le16(45), le32(0), le32(0), le64(n), le64(n), le64(cdSize), le64(cdStart));
      tail = tail.concat(le32(0x07064b50), le32(0), le64(z64At), le32(1));
    }
    tail = tail.concat(le32(0x06054b50), le16(0), le16(0), le16(needZ64 ? 0xFFFF : n), le16(needZ64 ? 0xFFFF : n), le32(cdSize >= M32 ? M32 : cdSize), le32(cdStart >= M32 ? M32 : cdStart), le16(0));
    prog(1, 'Packing');
    return new Blob(parts.concat(cdParts, [new Uint8Array(tail)]), { type: 'application/zip' });
  }

  window.ZipFix = { read: read, fromFiles: fromFiles, plan: plan, write: write, resolveDups: resolveDups, crcOfBlob: crcOfBlob, crcUpdate: crcUpdate, isJunk: isJunk, renameBase: renameBase };
})();
