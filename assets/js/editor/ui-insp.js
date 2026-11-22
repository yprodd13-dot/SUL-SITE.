/* =========================================================
   SHORT EDITOR — inspector (right) + tool panels (left)
   Every number has a slider. Every colour can be a gradient.
   ========================================================= */
(function () {
  'use strict';
  var SE = window.ShortEditor, EP = SE._EP, U = SE._U, C = window.ShortCore, T = C.T;
  var E = U.E, h = U.h, clamp = U.clamp, clone = U.clone, round = U.round;

  /* ---------- colour helpers ---------- */
  var cctx = document.createElement('canvas').getContext('2d');
  function toHex(v) { if (/^#[0-9a-f]{6}$/i.test(v || '')) return v; try { cctx.fillStyle = '#000'; cctx.fillStyle = v || '#000'; var s = cctx.fillStyle; if (/^#/.test(s)) return s; var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s); if (m) return '#' + [m[1], m[2], m[3]].map(function (x) { return (+x).toString(16).padStart(2, '0'); }).join(''); } catch (e) { } return '#000000'; }
  function fillCss(f) { if (!f || typeof f === 'string') return f || '#fff'; var st = []; for (var i = 0; i <= 6; i++) st.push(C.colorAt(f, i / 6, 0)); return f.mode === 'solid' ? f.c1 : 'linear-gradient(90deg,' + st.join(',') + ')'; }

  var BLENDS = [['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['hard-light', 'Hard light'], ['color-dodge', 'Dodge'], ['color-burn', 'Burn'], ['lighter', 'Add (glow)'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Colour'], ['luminosity', 'Luminosity'], ['darken', 'Darken'], ['lighten', 'Lighten']];
  var NOTE_BY = [['pitch', 'Note height'], ['velocity', 'How hard it\'s hit'], ['time', 'Left → right'], ['track', 'Track']];
  var X_BY = [['x', 'Left → right'], ['value', 'Loudness']];
  var RANDOM_BY = [['random', 'Random'], ['pitch', 'Note height'], ['velocity', 'How hard it\'s hit']];
  var ROW_BY = [['row', 'Row'], ['velocity', 'How hard it\'s hit'], ['time', 'Left → right']];
  var MIDI_F = [['head', '🎹 MIDI'], ['midi', 'Which MIDI', 'midisrc'], ['track', 'Track', 'track'], ['channel', 'Channel', 'channel']];
  var PANEL_F = [['head', 'Panel look'], ['panel', 'Show panel', 'toggle'], ['bg', 'Background', 'color'], ['shape', 'Corners', 'chips', [['notch', 'Cut'], ['rect', 'Round']]], ['radius', 'Corner size', 'range', 0, 80, 1], ['frame', 'Border', 'range', 0, 12, 0.5], ['frameColor', 'Border colour', 'color'], ['titleBar', 'Title bar', 'toggle'], ['label', 'Title', 'text'], ['barColor', 'Title bar colour', 'color'], ['barText', 'Title colour', 'color'], ['offsetShadow', 'Offset shadow', 'range', 0, 40, 1], ['shadowTint', 'Offset shadow colour', 'color']];
  var NOTE_RANGE = [['lowNote', 'Lowest note (0 = auto)', 'note'], ['highNote', 'Highest note (0 = auto)', 'note'], ['padNotes', 'Space above/below', 'range', 0, 12, 1]];
  var FIELDS = {
    text: [['text', 'Text — put *stars* around words to make them accent words', 'textarea'], ['font', 'Font', 'font'], ['weight', 'Thickness', 'chips', [[400, 'Normal'], [700, 'Bold'], [900, 'Black']], { num: 1 }], ['size', 'Text size', 'range', 8, 500, 1], ['fillc', 'Colour', 'fill', { angle: 1 }], ['align', 'Align', 'chips', [['left', '⇤ Left'], ['center', '↔ Center'], ['right', 'Right ⇥']]], ['caps', 'ALL CAPS', 'toggle'], ['italic', 'Italic', 'toggle'], ['autoFit', 'Shrink to fit the box', 'toggle'], ['letter', 'Letter spacing', 'range', -10, 60, 0.5], ['lineH', 'Line spacing', 'range', 0.6, 2.5, 0.01],
      ['head', 'Outline & shadow'], ['stroke', 'Outline', 'range', 0, 40, 0.5], ['strokeColor', 'Outline colour', 'color'], ['textShadow', 'Text shadow', 'range', 0, 60, 1], ['textShadowColor', 'Shadow colour', 'color'],
      ['head', 'Accent words (*like this*)'], ['accentColor', 'Accent colour', 'color'], ['accentFont', 'Accent font', 'font'], ['accentGlow', 'Accent glow', 'range', 0, 80, 1],
      ['head', 'Box behind the text'], ['boxOpacity', 'Box', 'range', 0, 1, 0.01], ['boxColor', 'Box colour', 'color'], ['boxPad', 'Box padding', 'range', 0, 120, 1], ['boxRadius', 'Box corners', 'range', 0, 100, 1],
      ['head', 'Typing / word reveal'], ['reveal', 'Reveal', 'chips', [['none', 'Off'], ['word', 'Word by word'], ['char', 'Typewriter'], ['beat', 'A word each beat']]], ['revealDur', 'Reveal time', 'range', 0.1, 10, 0.05, { suffix: 's' }]],
    image: [['media', 'Picture', 'media', { kind: 'image' }], ['fit', 'Fit', 'chips', [['cover', 'Fill box'], ['contain', 'Whole picture'], ['stretch', 'Stretch']]], ['zoom', 'Zoom inside the box', 'range', 0.2, 5, 0.01], ['posX', 'Crop ↔', 'range', 0, 1, 0.01], ['posY', 'Crop ↕', 'range', 0, 1, 0.01], ['radius', 'Round corners', 'range', 0, 600, 1], ['border', 'Border', 'range', 0, 60, 0.5], ['borderColor', 'Border colour', 'color'], ['kenBurns', 'Slow zoom', 'range', 0, 5, 0.05]],
    video: [['media', 'Video', 'media', { kind: 'video' }], ['vol', 'Video sound', 'range', 0, 200, 1, { suffix: '%' }], ['fadeIn', 'Sound fade in', 'range', 0, 10, 0.05, { suffix: 's' }], ['fadeOut', 'Sound fade out', 'range', 0, 10, 0.05, { suffix: 's' }], ['fit', 'Fit', 'chips', [['cover', 'Fill box'], ['contain', 'Whole video'], ['stretch', 'Stretch']]], ['zoom', 'Zoom inside the box', 'range', 0.2, 5, 0.01], ['posX', 'Crop ↔', 'range', 0, 1, 0.01], ['posY', 'Crop ↕', 'range', 0, 1, 0.01], ['radius', 'Round corners', 'range', 0, 600, 1], ['border', 'Border', 'range', 0, 60, 0.5], ['borderColor', 'Border colour', 'color']],
    shape: [['kind', 'Shape', 'chips', [['rect', '■'], ['circle', '●'], ['triangle', '▲'], ['star', '★'], ['sparkle', '✦'], ['heart', '♥'], ['diamond', '◆'], ['ring', '◯'], ['arrow', '➜'], ['line', '—']]], ['fillc', 'Colour', 'fill', { angle: 1 }], ['radius', 'Round corners', 'range', 0, 400, 1], ['stroke', 'Outline', 'range', 0, 40, 0.5], ['strokeColor', 'Outline colour', 'color'], ['reactLevel', 'Pump with the music', 'range', 0, 3, 0.05]],
    adjust: [],
    pianoroll: MIDI_F.concat([['head', 'Notes'], ['mode', 'Movement', 'chips', [['page', 'Page by page'], ['scroll', 'Scrolling']]], ['beats', 'Beats on screen', 'range', 1, 64, 1], ['playheadPos', 'Playhead position', 'range', 0, 100, 1, { suffix: '%', if: function (e) { return e.mode === 'scroll'; } }], ['noteFill', 'Note colours', 'fill', { by: NOTE_BY }], ['activeColor', 'Playing note colour', 'color'], ['noteGlow', 'Glow', 'range', 0, 60, 1], ['noteRadius', 'Note corners', 'range', 0, 30, 0.5], ['noteHeight', 'Note thickness', 'range', 10, 100, 1, { suffix: '%' }], ['keys', 'Piano keys', 'toggle'], ['keyWidth', 'Key width', 'range', 2, 25, 0.5], ['gridColor', 'Beat lines', 'color'], ['barLineColor', 'Bar lines', 'color'], ['playhead', 'Playhead', 'color'], ['bpmLabel', 'Show BPM', 'toggle'], ['labelColor', 'Numbers colour', 'color']]).concat(NOTE_RANGE, PANEL_F),
    stepgrid: MIDI_F.concat([['head', 'Grid'], ['steps', 'Steps', 'range', 4, 64, 1], ['stepLen', 'Step length', 'chips', [[0.125, '1/32'], [0.25, '1/16'], [0.5, '1/8'], [1, '1/4']], { num: 1 }], ['maxRows', 'Rows', 'range', 1, 16, 1], ['cellFill', 'Hit colours', 'fill', { by: ROW_BY }], ['hitColor', 'Flash colour', 'color'], ['offColor', 'Empty cell colour', 'color'], ['gridGap', 'Gap', 'range', 0, 20, 0.5], ['cellRadius', 'Cell corners', 'range', 0, 30, 0.5], ['showLabels', 'Note names', 'toggle'], ['keys', 'Key column', 'toggle'], ['playhead', 'Playhead', 'color']]).concat(PANEL_F),
    falling: MIDI_F.concat([['head', 'Notes'], ['direction', 'Direction', 'chips', [['down', '⬇ Fall down'], ['up', '⬆ Rise up']]], ['look', 'How far ahead', 'range', 0.5, 12, 0.1, { suffix: 's' }], ['noteFill', 'Note colours', 'fill', { by: NOTE_BY }], ['glow', 'Glow', 'range', 0, 60, 1], ['radius', 'Note corners', 'range', 0, 30, 0.5], ['keyboard', 'Keyboard', 'toggle'], ['keyH', 'Keyboard height', 'range', 2, 40, 0.5, { suffix: '%' }], ['hitFlash', 'Flash on hit', 'toggle'], ['bg', 'Background', 'color'], ['lineColor', 'Octave lines', 'color']]).concat(NOTE_RANGE),
    noteburst: MIDI_F.concat([['head', 'Bursts'], ['style', 'Style', 'chips', [['rings', 'Rings'], ['sparks', 'Sparks'], ['stars', 'Stars'], ['hearts', 'Hearts'], ['dots', 'Dots']]], ['burstFill', 'Colours', 'fill', { by: RANDOM_BY }], ['life', 'How long', 'range', 0.1, 4, 0.05, { suffix: 's' }], ['size', 'Size', 'range', 10, 600, 1], ['layout', 'Where', 'chips', [['pitch', 'By note'], ['center', 'Middle'], ['random', 'Random']]], ['count', 'Sparks per hit', 'range', 1, 60, 1]]).concat(NOTE_RANGE),
    spectrum: [['style', 'Style', 'chips', [['bars', 'Bars'], ['dots', 'Dots'], ['line', 'Line'], ['area', 'Area'], ['circle', 'Circle']]], ['bands', 'Bars', 'range', 8, 160, 1], ['barFill', 'Colours', 'fill', { by: X_BY }], ['sens', 'Sensitivity', 'range', 20, 400, 1, { suffix: '%' }], ['gap', 'Gap', 'range', 0, 90, 1, { suffix: '%' }], ['radius', 'Corners', 'range', 0, 40, 0.5], ['mirror', 'Mirror (up & down)', 'toggle'], ['glow', 'Glow', 'range', 0, 60, 1], ['inner', 'Circle hole', 'range', 0, 90, 1, { suffix: '%' }], ['minH', 'Minimum height', 'range', 0, 40, 0.5]],
    waveform: [['style', 'Style', 'chips', [['full', 'Whole song'], ['window', 'Moving window'], ['scope', 'Oscilloscope']]], ['waveFill', 'Wave colours', 'fill', { by: [['x', 'Left → right']] }], ['played', 'Played part', 'color'], ['playhead', 'Playhead', 'color'], ['span', 'Window size', 'range', 0.5, 20, 0.1, { suffix: 's' }], ['barW', 'Bar width', 'range', 1, 20, 0.5], ['showLabel', 'Show label', 'toggle'], ['textColor', 'Label colour', 'color']].concat(PANEL_F),
    player: [['title', 'Song title', 'text'], ['brand', 'Brand text', 'text'], ['body', 'Body colour', 'color'], ['body2', 'Body top colour', 'color'], ['screen', 'Screen', 'color'], ['screenText', 'Screen text', 'color'], ['accent', 'Accent', 'color'], ['bars', 'Bars', 'range', 4, 60, 1], ['radius', 'Corners', 'range', 0, 80, 1]],
    plugin: MIDI_F.concat([['head', 'Look'], ['brand', 'Plugin name', 'text'], ['preset', 'Preset text', 'text'], ['knobs', 'Knobs', 'range', 1, 12, 1], ['panel', 'Panel', 'color'], ['panel2', 'Header', 'color'], ['accent', 'Accent', 'color'], ['text', 'Text colour', 'color'], ['offsetShadow', 'Offset shadow', 'range', 0, 40, 1], ['shadowTint', 'Shadow colour', 'color'], ['radius', 'Corner cut', 'range', 0, 60, 1]]),
    progress: [['barFill', 'Bar colour', 'fill', { angle: 1 }], ['track', 'Track colour', 'color'], ['radius', 'Corners', 'range', 0, 100, 1], ['knob', 'Knob', 'toggle']],
    timer: [['font', 'Font', 'font'], ['color', 'Colour', 'color'], ['size', 'Size', 'range', 10, 300, 1], ['showTotal', 'Show total', 'toggle']],
    sparkles: [['kind', 'Shape', 'chips', [['sparkle', '✦'], ['star', '★'], ['heart', '♥'], ['circle', '●'], ['diamond', '◆']]], ['count', 'How many', 'range', 1, 200, 1], ['sparkFill', 'Colours', 'fill', { by: [['random', 'Random']] }], ['size', 'Size', 'range', 4, 200, 1], ['speed', 'Twinkle speed', 'range', 0, 5, 0.05], ['onBeat', 'Pop on the beat', 'toggle']]
  };
  var BG_F = [['head', 'Background'], ['bg', 'Background colour', 'fill', { angle: 1, if: function (e) { return e.panel !== false; } }], ['bgOpacity', 'Background opacity', 'range', 0, 100, 1, { suffix: '%', if: function (e) { return e.panel !== false; } }],
    ['frame', 'Border', 'range', 0, 16, 0.5, { if: function (e) { return e.panel !== false; } }], ['frameColor', 'Border colour', 'color', { if: function (e) { return e.panel !== false && e.frame > 0; } }],
    ['shape', 'Corners', 'chips', [['rect', 'Round'], ['notch', 'Cut']], { if: function (e) { return e.panel !== false; } }], ['radius', 'Corner size', 'range', 0, 80, 1, { if: function (e) { return e.panel !== false; } }],
    ['offsetShadow', 'Offset shadow', 'range', 0, 40, 1, { if: function (e) { return e.panel !== false; } }], ['shadowTint', 'Offset shadow colour', 'color', { if: function (e) { return e.panel !== false && e.offsetShadow > 0; } }],
    ['label', 'Title', 'text', { if: function (e) { return e.panel !== false && e.titleBar; } }], ['barColor', 'Title bar colour', 'color', { if: function (e) { return e.panel !== false && e.titleBar; } }], ['barText', 'Title colour', 'color', { if: function (e) { return e.panel !== false && e.titleBar; } }]];
  var MIDI_LOOK = {
    pianoroll: [['togs', [['panel', 'Background'], ['titleBar', 'Title bar'], ['keys', 'Piano keys'], ['showGrid', 'Grid lines'], ['showRows', 'Black-key rows'], ['showNums', 'Bar numbers'], ['bpmLabel', 'BPM'], ['showPlayhead', 'Playhead']]],
      ['head', 'Notes'], ['noteFill', 'Note colours', 'fill', { by: NOTE_BY }], ['activeColor', 'Playing note colour', 'color'], ['noteStroke', 'Note outline', 'range', 0, 12, 0.5], ['noteStrokeColor', 'Outline colour', 'color', { if: function (e) { return e.noteStroke > 0; } }], ['activeStroke', 'Playing note outline (empty = same)', 'color', { if: function (e) { return e.noteStroke > 0; } }],
      ['noteRadius', 'Note corners', 'range', 0, 30, 0.5], ['noteHeight', 'Note thickness', 'range', 10, 100, 1, { suffix: '%' }], ['noteGlow', 'Glow', 'range', 0, 60, 1], ['futureAlpha', 'Upcoming notes', 'range', 0, 100, 1, { suffix: '%' }]]
      .concat(BG_F, [['head', 'Grid, keys & playhead'], ['gridColor', 'Beat lines / rows', 'color'], ['barLineColor', 'Bar lines', 'color'], ['labelColor', 'Numbers colour', 'color'], ['playhead', 'Playhead colour', 'color'], ['keyWidth', 'Key width', 'range', 2, 25, 0.5, { if: function (e) { return e.keys; } }],
        ['head', 'Movement'], ['mode', 'Movement', 'chips', [['page', 'Page by page'], ['scroll', 'Scrolling']]], ['beats', 'Beats on screen', 'range', 1, 64, 1], ['playheadPos', 'Playhead position', 'range', 0, 100, 1, { suffix: '%', if: function (e) { return e.mode === 'scroll'; } }],
        ['head', 'Note range'], ['lowNote', 'Lowest note (0 = auto)', 'note'], ['highNote', 'Highest note (0 = auto)', 'note'], ['padNotes', 'Space above/below', 'range', 0, 12, 1]]),
    stepgrid: [['togs', [['panel', 'Background'], ['titleBar', 'Title bar'], ['keys', 'Key column'], ['showOff', 'Empty cells'], ['showLabels', 'Note names'], ['showPlayhead', 'Playhead']]],
      ['head', 'Hits'], ['cellFill', 'Hit colours', 'fill', { by: ROW_BY }], ['hitColor', 'Flash colour', 'color'], ['cellStroke', 'Cell outline', 'range', 0, 12, 0.5], ['cellStrokeColor', 'Outline colour', 'color', { if: function (e) { return e.cellStroke > 0; } }], ['strokeEmpty', 'Outline empty cells too', 'toggle', { if: function (e) { return e.cellStroke > 0; } }],
      ['offColor', 'Empty cell colour', 'color', { if: function (e) { return e.showOff !== false; } }], ['cellRadius', 'Cell corners', 'range', 0, 30, 0.5], ['gridGap', 'Gap', 'range', 0, 20, 0.5], ['playhead', 'Playhead colour', 'color']]
      .concat(BG_F, [['head', 'Grid'], ['steps', 'Steps', 'range', 4, 64, 1], ['stepLen', 'Step length', 'chips', [[0.125, '1/32'], [0.25, '1/16'], [0.5, '1/8'], [1, '1/4']], { num: 1 }], ['maxRows', 'Rows', 'range', 1, 16, 1]]),
    falling: [['togs', [['keyboard', 'Keyboard'], ['showLines', 'Octave lines'], ['hitFlash', 'Flash on hit']]],
      ['head', 'Notes'], ['noteFill', 'Note colours', 'fill', { by: NOTE_BY }], ['noteStroke', 'Note outline', 'range', 0, 12, 0.5], ['noteStrokeColor', 'Outline colour', 'color', { if: function (e) { return e.noteStroke > 0; } }], ['radius', 'Note corners', 'range', 0, 30, 0.5], ['glow', 'Glow', 'range', 0, 60, 1],
      ['head', 'Background'], ['bg', 'Background colour', 'fill', { angle: 1 }], ['bgOpacity', 'Background opacity', 'range', 0, 100, 1, { suffix: '%' }], ['lineColor', 'Octave lines', 'color', { if: function (e) { return e.showLines !== false; } }], ['keyH', 'Keyboard height', 'range', 2, 40, 0.5, { suffix: '%', if: function (e) { return e.keyboard; } }],
      ['head', 'Movement'], ['direction', 'Direction', 'chips', [['down', '⬇ Fall down'], ['up', '⬆ Rise up']]], ['look', 'How far ahead', 'range', 0.5, 12, 0.1, { suffix: 's' }],
      ['head', 'Note range'], ['lowNote', 'Lowest note (0 = auto)', 'note'], ['highNote', 'Highest note (0 = auto)', 'note'], ['padNotes', 'Space left/right', 'range', 0, 12, 1]],
    noteburst: [['head', 'Bursts'], ['style', 'Style', 'chips', [['rings', 'Rings'], ['sparks', 'Sparks'], ['stars', 'Stars'], ['hearts', 'Hearts'], ['dots', 'Dots']]], ['burstFill', 'Colours', 'fill', { by: RANDOM_BY }], ['noteStroke', 'Outline (stars, hearts, dots)', 'range', 0, 12, 0.5], ['noteStrokeColor', 'Outline colour', 'color', { if: function (e) { return e.noteStroke > 0; } }],
      ['life', 'How long', 'range', 0.1, 4, 0.05, { suffix: 's' }], ['size', 'Size', 'range', 10, 600, 1], ['layout', 'Where', 'chips', [['pitch', 'By note'], ['center', 'Middle'], ['random', 'Random']]], ['count', 'Sparks per hit', 'range', 1, 60, 1],
      ['head', 'Note range'], ['lowNote', 'Lowest note (0 = auto)', 'note'], ['highNote', 'Highest note (0 = auto)', 'note']],
    plugin: FIELDS.plugin.slice(MIDI_F.length)
  };
  SE._FIELDS = FIELDS;

  /* =========================================================
     FORM BUILDER
     ========================================================= */
  // onCh(key, light) — light = still dragging a slider
  EP.form = function (box, fields, obj, onCh, defs) {
    var self = this;
    fields.forEach(function (f) {
      if (!f) return;
      var k = f[0], label = f[1], type = f[2], opt = f.slice(3).filter(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })[0] || {};
      if (opt.if && !opt.if(obj)) return;
      if (k === 'head') { box.appendChild(h('div', { class: 'se-fh' }, E(label))); return; }
      if (k === 'togs') {
        var tw = h('div', { class: 'se-togs' });
        f[1].forEach(function (q) {
          var on = obj[q[0]] !== false && !!obj[q[0]], b = h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': on ? 'true' : 'false' }, '<i></i>' + E(q[1]));
          b.addEventListener('click', function () { obj[q[0]] = !(obj[q[0]] !== false && !!obj[q[0]]); onCh(q[0], false); self.renderInspector(); });
          tw.appendChild(b);
        });
        box.appendChild(h('div', { class: 'se-fh' }, 'Show / hide')); box.appendChild(tw); return;
      }
      var row = h('div', { class: 'se-f se-f-' + type }), lab = h('label', { class: 'se-fl' }, '<span>' + E(label) + '</span>');
      row.appendChild(lab);
      var set = function (v, light) { obj[k] = v; onCh(k, light); };
      if (defs && defs[k] !== undefined && typeof defs[k] !== 'object') { lab.title = 'Double-click to reset'; lab.addEventListener('dblclick', function () { obj[k] = clone(defs[k]); onCh(k, false); self.renderInspector(); }); }
      switch (type) {
        case 'range': case 'note': {
          var min = type === 'note' ? 0 : f[3], max = type === 'note' ? 127 : f[4], step = type === 'note' ? 1 : f[5] || 1;
          row.appendChild(slider(obj[k], min, max, step, function (v, light) { set(v, light); if (type === 'note') out.textContent = v ? C.noteName(v) : 'auto'; }, opt.suffix));
          var out = h('b'); lab.appendChild(out); if (type === 'note') out.textContent = obj[k] ? C.noteName(obj[k]) : 'auto';
          break;
        }
        case 'color': row.appendChild(colorBox(obj[k], function (v, light) { set(v, light); })); break;
        case 'toggle': {
          var tg = h('button', { type: 'button', class: 'se-tog' + (obj[k] ? ' on' : ''), role: 'switch', 'aria-checked': obj[k] ? 'true' : 'false' }, '<i></i>');
          tg.addEventListener('click', function () { var v = !obj[k]; tg.classList.toggle('on', v); tg.setAttribute('aria-checked', v); set(v); if (opt.rerender) self.renderInspector(); });
          lab.appendChild(tg); row.classList.add('inline'); break;
        }
        case 'chips': row.appendChild(chips(f[3], obj[k], function (v) { set(opt.num ? +v : v); if (opt.rerender !== false) self.renderInspector(); })); break;
        case 'select': row.appendChild(select(f[3], obj[k], function (v) { set(opt.num ? +v : v); if (opt.rerender) self.renderInspector(); })); break;
        case 'blend': row.appendChild(select(BLENDS, obj[k] || 'source-over', function (v) { set(v); })); break;
        case 'text': { var ti = h('input', { type: 'text', value: obj[k] == null ? '' : obj[k], maxlength: '200' }); ti.addEventListener('input', function () { set(ti.value, true); }); ti.addEventListener('change', function () { set(ti.value); self.renderTimelineSoon(); }); row.appendChild(ti); break; }
        case 'textarea': { var ta = h('textarea', { rows: '3', maxlength: '2000' }); ta.value = obj[k] == null ? '' : obj[k]; ta.addEventListener('input', function () { set(ta.value, true); }); ta.addEventListener('change', function () { set(ta.value); self.renderTimelineSoon(); }); row.appendChild(ta); break; }
        case 'fill': row.appendChild(self.fillBox(obj, k, opt, onCh)); break;
        case 'font': row.appendChild(self.fontSelect(obj[k], function (v) { set(v); C.ensureFont(v, 400).then(self.redraw.bind(self)); C.ensureFont(v, 900).then(self.redraw.bind(self)); })); break;
        case 'midisrc': row.appendChild(select([['all', 'All MIDI files']].concat(self.P.midis.map(function (m) { return [m.id, m.name]; })), obj[k] || 'all', function (v) { set(v); self.renderInspector(); })); break;
        case 'track': case 'channel': {
          var opts = [[-1, type === 'track' ? 'All tracks' : 'All channels']], seen = {};
          self.P.midis.forEach(function (m) { var mm = self.midis[m.id]; if (!mm || (obj.midi && obj.midi !== 'all' && obj.midi !== m.id)) return; if (type === 'track') mm.tracks.forEach(function (t) { if (!seen[t.index]) { seen[t.index] = 1; opts.push([t.index, (t.index + 1) + ': ' + t.name + ' (' + t.notes + ' notes)']); } }); else mm.tracks.forEach(function (t) { t.channels.forEach(function (c) { if (!seen[c]) { seen[c] = 1; opts.push([c, 'Channel ' + (c + 1) + (c === 9 ? ' (drums)' : '')]); } }); }); });
          row.appendChild(select(opts, obj[k] == null ? -1 : obj[k], function (v) { set(+v); self.renderInspector(); })); break;
        }
        case 'media': {
          var mb = h('div', { class: 'se-mediarow' }), m = obj.media && self.P.media[obj.media], rec = obj.media && self.media[obj.media];
          mb.innerHTML = (rec && rec.thumb ? '<img alt="">' : obj.src ? '<img alt="">' : '<i>' + (opt.kind === 'video' ? '🎞' : '🖼') + '</i>') + '<span>' + E(m ? m.name : obj.src ? obj.src.split('/').pop() : 'Empty') + '</span>';
          if (mb.querySelector('img')) mb.querySelector('img').src = rec && rec.thumb ? rec.thumb : (self.api.asset ? self.api.asset(obj.src) : obj.src);
          var rb = h('button', { type: 'button', class: 'se-btn' }, '⇄ Replace');
          rb.addEventListener('click', function () { self.pick('image/*,video/*', function (files) { self.importFile(files[0]).then(function (r) { if (r && (r.kind === 'image' || r.kind === 'video')) self.replaceInto(obj, r.id, r.kind); else if (r) self.toast('Pick a picture or a video', true); }); }, false); });
          mb.appendChild(rb); row.appendChild(mb); break;
        }
        case 'button': { var bb = h('button', { type: 'button', class: 'se-btn' }, E(f[3])); bb.addEventListener('click', f[4]); row.appendChild(bb); break; }
      }
      box.appendChild(row);
    });
  };
  function fmtNum(v, step) { var d = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0; return round(+v || 0, d); }
  function slider(v, min, max, step, on, suffix) {
    var w = h('div', { class: 'se-rng' }), r = h('input', { type: 'range', min: min, max: max, step: step }), n = h('input', { type: 'number', step: step });
    r.value = clamp(+v || 0, min, max); n.value = fmtNum(v, step);
    var fillBar = function () { r.style.setProperty('--p', ((clamp(+r.value, min, max) - min) / (max - min || 1) * 100) + '%'); };
    fillBar();
    r.addEventListener('input', function () { n.value = fmtNum(r.value, step); fillBar(); on(+r.value, true); });
    r.addEventListener('change', function () { on(+r.value, false); });
    n.addEventListener('change', function () { var x = +n.value; if (!isFinite(x)) return; r.value = clamp(x, min, max); fillBar(); on(x, false); });
    w.appendChild(r); w.appendChild(n); if (suffix) w.appendChild(h('small', null, E(suffix)));
    w._set = function (x) { if (document.activeElement === r || document.activeElement === n) return; r.value = clamp(+x || 0, min, max); n.value = fmtNum(x, step); fillBar(); };
    return w;
  }
  function colorBox(v, on) {
    var w = h('div', { class: 'se-col' }), c = h('input', { type: 'color' }), t = h('input', { type: 'text', maxlength: '40', spellcheck: 'false' });
    c.value = toHex(v); t.value = v || '';
    c.addEventListener('input', function () { t.value = c.value; on(c.value, true); });
    c.addEventListener('change', function () { on(c.value, false); });
    t.addEventListener('change', function () { var x = t.value.trim(); if (x) c.value = toHex(x); on(x, false); });
    w.appendChild(c); w.appendChild(t); return w;
  }
  function chips(list, v, on) {
    var w = h('div', { class: 'se-chips' });
    list.forEach(function (o) { var b = h('button', { type: 'button', class: String(o[0]) === String(v) ? 'on' : '' }, E(o[1])); b.addEventListener('click', function () { w.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); on(o[0]); }); w.appendChild(b); });
    return w;
  }
  function select(list, v, on) {
    var s = h('select'); list.forEach(function (o) { if (o[2]) { var g = h('optgroup', { label: o[1] }); o[2].forEach(function (q) { var op = h('option', { value: q[0] }, E(q[1])); if (String(q[0]) === String(v)) op.selected = true; g.appendChild(op); }); s.appendChild(g); return; } var op = h('option', { value: o[0] }, E(o[1])); if (String(o[0]) === String(v)) op.selected = true; s.appendChild(op); });
    s.addEventListener('change', function () { on(s.value); }); return s;
  }
  SE._W = { slider: slider, colorBox: colorBox, chips: chips, select: select, toHex: toHex, fillCss: fillCss, BLENDS: BLENDS };
  EP.fontSelect = function (v, on) {
    var fl = this.fontList(), list = [];
    if (fl.mine.length) list.push([0, 'My fonts', fl.mine.map(function (f) { return [f, f]; })]);
    if (fl.site.length) list.push([0, 'Site fonts', fl.site.map(function (f) { return [f, f]; })]);
    list.push([0, 'Free fonts', fl.free.map(function (f) { return [f, f]; })]);
    var all = fl.mine.concat(fl.site, fl.free); if (v && all.indexOf(v) < 0) list.unshift([v, v]);
    var s = select(list, v, on); s.style.fontFamily = '"' + v + '", sans-serif'; s.addEventListener('change', function () { s.style.fontFamily = '"' + s.value + '", sans-serif'; }); return s;
  };
  /* ---------- colour fill: solid / gradient / rainbow, animated ---------- */
  EP.fillBox = function (obj, k, opt, onCh) {
    var self = this, f = obj[k];
    if (!f || typeof f === 'string') f = obj[k] = C.fill(f || '#ffffff');
    var w = h('div', { class: 'se-fill' }), sw = h('div', { class: 'se-swatch' }), body = h('div');
    var paintSw = function () { sw.style.background = fillCss(f); };
    var ch = function (key, light) { paintSw(); onCh(k, light); if (!light && (key === 'mode' || key === 'n' || key === 'anim')) build(); };
    function build() {
      body.innerHTML = '';
      body.appendChild(chips([['solid', 'Solid'], ['gradient', 'Gradient'], ['rainbow', 'Rainbow']], f.mode, function (v) { f.mode = v; ch('mode'); }));
      var flds = [];
      if (f.mode !== 'rainbow') flds.push(['c1', f.mode === 'solid' ? 'Colour' : 'Colour 1', 'color']);
      if (f.mode === 'gradient') { flds.push(['c2', 'Colour 2', 'color']); flds.push(['n', 'Colours', 'chips', [[2, '2'], [3, '3']], { num: 1, rerender: false }]); if ((f.n || 2) >= 3) flds.push(['c3', 'Colour 3', 'color']); }
      if (f.mode !== 'solid' && opt.by) flds.push(['by', 'Colour goes by', 'select', opt.by]);
      if (f.mode !== 'solid' && opt.angle) flds.push(['angle', 'Angle', 'range', 0, 360, 1, { suffix: '°' }]);
      flds.push(['anim', 'Animate colours', 'chips', [['none', 'Still'], ['flow', 'Flow'], ['hue', 'Colour cycle'], ['pulse', 'Pulse on beat']].concat(opt.angle ? [['spin', 'Spin']] : []), { rerender: false }]);
      if (f.anim && f.anim !== 'none' && f.anim !== 'pulse') flds.push(['speed', 'Animation speed', 'range', 0, 5, 0.05]);
      self.form(body, flds, f, ch);
    }
    build(); paintSw(); w.appendChild(sw); w.appendChild(body); return w;
  };

  /* ---------- easing graph editor ---------- */
  EP.easeBox = function (val, on) {
    var w = h('div', { class: 'se-ease' }), cv = h('canvas', { width: 220, height: 150 }), g = cv.getContext('2d'), v = val || 'out';
    var PR = C.EASE_PRESETS, pad = 18, W = 220, H = 150, ymin = -0.6, ymax = 1.6;
    function X(x) { return pad + x * (W - pad * 2); } function Y(y) { return H - pad - (y - ymin) / (ymax - ymin) * (H - pad * 2) * 1; }
    function arr() { if (Array.isArray(v)) return v; for (var i = 0; i < PR.length; i++) if (PR[i][0] === v && Array.isArray(PR[i][2])) return PR[i][2].slice(); return null; }
    function draw() {
      g.clearRect(0, 0, W, H); g.fillStyle = '#120d18'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.strokeRect(X(0), Y(1), X(1) - X(0), Y(0) - Y(1));
      var fn = C.easeFn(v); g.strokeStyle = '#ff3fc8'; g.lineWidth = 2.5; g.beginPath();
      for (var i = 0; i <= 80; i++) { var x = i / 80, y = fn(x); i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); } g.stroke();
      var a = arr(); if (a) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(a[0]), Y(a[1])); g.moveTo(X(1), Y(1)); g.lineTo(X(a[2]), Y(a[3])); g.stroke(); g.fillStyle = '#38c8ff'; [[a[0], a[1]], [a[2], a[3]]].forEach(function (p) { g.beginPath(); g.arc(X(p[0]), Y(p[1]), 6, 0, Math.PI * 2); g.fill(); }); }
    }
    var ch = chips(PR.map(function (p) { return [p[0], p[1]]; }), Array.isArray(v) ? '' : v, function (x) { v = x; draw(); on(v); });
    var drag = -1;
    cv.addEventListener('pointerdown', function (e) {
      var a = arr(); if (!a) { a = [0.42, 0, 0.58, 1]; }
      var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
      var d1 = Math.hypot(mx - X(a[0]), my - Y(a[1])), d2 = Math.hypot(mx - X(a[2]), my - Y(a[3]));
      drag = d1 < d2 ? 0 : 1; v = a; cv.setPointerCapture(e.pointerId); move(e);
    });
    function move(e) {
      if (drag < 0) return; var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
      var x = clamp((mx - pad) / (W - pad * 2), 0, 1), y = clamp(ymin + (H - pad - my) / (H - pad * 2) * (ymax - ymin), ymin, ymax);
      v = v.slice(); v[drag * 2] = round(x, 3); v[drag * 2 + 1] = round(y, 3); draw(); on(v, true);
    }
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', function () { if (drag >= 0) { drag = -1; ch.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); }); on(v); } });
    w.appendChild(ch); w.appendChild(cv); w.appendChild(h('small', { class: 'se-help' }, 'Pick a preset or drag the blue dots to shape the motion.')); draw();
    return w;
  };

  /* ---------- speed curve editor (video clips) ---------- */
  EP.speedBox = function (el, on) {
    var self = this, w = h('div', { class: 'se-speed' }), W = 260, H = 160, pad = 16, cv = h('canvas', { width: W, height: H }), g = cv.getContext('2d');
    function X(u) { return pad + u * (W - pad * 2); } function Y(s) { return H - pad - (Math.log(s) / Math.LN10 + 1) / 2 * (H - pad * 2); }
    function S(y) { return Math.pow(10, ((H - pad - y) / (H - pad * 2)) * 2 - 1); }
    function pts() { return el.curve || [[0, el.speed || 1], [1, el.speed || 1]]; }
    function draw() {
      g.clearRect(0, 0, W, H); g.fillStyle = '#120d18'; g.fillRect(0, 0, W, H);
      g.font = '10px sans-serif'; [[0.1, '0.1x'], [1, '1x'], [10, '10x']].forEach(function (q) { g.fillStyle = q[0] === 1 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'; g.fillRect(pad, Y(q[0]), W - pad * 2, 1); g.fillText(q[1], 2, Y(q[0]) - 2); });
      var c = pts(); g.strokeStyle = '#ffe14d'; g.lineWidth = 2.5; g.beginPath();
      for (var i = 0; i <= 100; i++) { var u = i / 100, s = el.curve ? C.speedAt(el, u) : el.speed || 1; i ? g.lineTo(X(u), Y(s)) : g.moveTo(X(u), Y(s)); } g.stroke();
      if (el.curve) c.forEach(function (p) { g.fillStyle = '#ff3fc8'; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 6, 0, Math.PI * 2); g.fill(); });
    }
    var info = h('small', { class: 'se-help' });
    function upd(light) { C.setLengthFromSpeed(el); info.textContent = 'Clip length: ' + U.fmt(el.end - el.start) + (el.curve ? ' · the clip\'s own sound is muted while a curve is on' : ''); draw(); on(light); }
    var pre = chips(C.SPEED_PRESETS.map(function (p) { return [p[0], p[1]]; }), el.curve ? (el._preset || '') : 'normal', function (id) {
      var p = C.SPEED_PRESETS.filter(function (q) { return q[0] === id; })[0]; el._preset = id;
      if (!p[2]) { el.curve = null; el.speed = el.speed || 1; } else el.curve = clone(p[2]);
      upd();
    });
    var drag = -1;
    cv.addEventListener('pointerdown', function (e) {
      var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
      if (!el.curve) el.curve = [[0, el.speed || 1], [0.5, el.speed || 1], [1, el.speed || 1]];
      var c = el.curve, best = -1, bd = 14; c.forEach(function (p, i) { var d = Math.hypot(mx - X(p[0]), my - Y(p[1])); if (d < bd) { bd = d; best = i; } });
      if (best < 0) { var u = clamp((mx - pad) / (W - pad * 2), 0.01, 0.99); c.push([round(u, 3), round(clamp(S(my), 0.1, 10), 2)]); c.sort(function (a, b) { return a[0] - b[0]; }); best = c.findIndex(function (p) { return p[0] === round(u, 3); }); }
      drag = best; el._preset = ''; cv.setPointerCapture(e.pointerId); pre.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); }); upd(true);
    });
    cv.addEventListener('pointermove', function (e) {
      if (drag < 0) return; var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, c = el.curve, p = c[drag];
      if (drag > 0 && drag < c.length - 1) p[0] = round(clamp((mx - pad) / (W - pad * 2), c[drag - 1][0] + 0.01, c[drag + 1][0] - 0.01), 3);
      p[1] = round(clamp(S(my), 0.1, 10), 2); upd(true);
    });
    cv.addEventListener('pointerup', function () { if (drag >= 0) { drag = -1; upd(); } });
    cv.addEventListener('dblclick', function (e) {
      if (!el.curve) return; var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, c = el.curve;
      for (var i = 1; i < c.length - 1; i++) if (Math.hypot(mx - X(c[i][0]), my - Y(c[i][1])) < 10) { c.splice(i, 1); upd(); return; }
    });
    w.appendChild(h('div', { class: 'se-fh' }, 'Speed curve')); w.appendChild(pre); w.appendChild(cv);
    w.appendChild(h('small', { class: 'se-help' }, 'Click to add a point · drag points · double-click a point to remove it. Up = faster.'));
    w.appendChild(info); upd(true);
    return w;
  };

  /* =========================================================
     INSPECTOR
     ========================================================= */
  EP.renderInspector = function () {
    if (!this.P || !this.insp) return;
    var box = this.insp, keep = box.scrollTop; this.liveInsp = null; this.live = [];
    box.innerHTML = '';
    var el = this.cur(), au = this.curAudio(), tr = this.curTr();
    if (el) this.inspLayer(box, el);
    else if (au) this.inspAudio(box, au);
    else if (tr) this.inspTr(box, tr);
    else if (this.selKind === 'midi' && this.P.midis.some(function (m) { return m.id === this.sel; }, this)) this.inspMidi(box, this.P.midis.filter(function (m) { return m.id === this.sel; }, this)[0]);
    else this.inspProject(box);
    var self = this; if (this.live.length) this.liveInsp = function () { self.live.forEach(function (f) { f(); }); };
    box.scrollTop = keep;
  };
  function onEl(self, el, opts) { opts = opts || {}; return function (k, light) { self.needs = true; if (/^(start|end|in|srcDur|speed|vol|fadeIn|fadeOut|hidden)$/.test(k)) self.syncVideos(self.t, false); if (!light) self.changed({ tl: opts.tl !== false, audio: el.type === 'video' && /^(vol|fadeIn|fadeOut|start|end|speed|hidden)$/.test(k) }); else self.syncSel(); }; }
  EP.inspHead = function (box, iconTxt, title, sub) { box.appendChild(h('div', { class: 'se-ihead' }, '<i>' + iconTxt + '</i><div><b>' + E(title) + '</b>' + (sub ? '<small>' + E(sub) + '</small>' : '') + '</div>')); };
  EP.inspLayer = function (box, el) {
    var self = this, def = T[el.type], ch = onEl(this, el);
    var head = h('div', { class: 'se-ihead' }, '<i>' + def.icon + '</i><input type="text" maxlength="60" aria-label="Layer name"><button type="button" data-a="hide" title="Show / hide">' + (el.hidden ? '🙈' : '👁') + '</button><button type="button" data-a="lock" title="Lock">' + (el.locked ? '🔒' : '🔓') + '</button><button type="button" data-a="dup" title="Duplicate">⧉</button><button type="button" data-a="del" title="Delete">🗑</button>');
    var ni = head.querySelector('input'); ni.value = el.name || def.label; ni.addEventListener('change', function () { el.name = ni.value; self.changed({ tl: true }); });
    head.querySelectorAll('[data-a]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-a'); if (a === 'hide') { el.hidden = !el.hidden; self.changed({ tl: true, insp: true, audio: el.type === 'video' }); } else if (a === 'lock') { el.locked = !el.locked; self.changed({ tl: true, insp: true }); } else if (a === 'dup') self.duplicateSel(); else self.deleteSel(); }); });
    box.appendChild(head);
    var nk = 0; Object.keys(el.kf || {}).forEach(function (k) { nk += (el.kf[k] || []).length; });
    var tabs = (MIDI_LOOK[el.type] ? [['midi', '🎹 MIDI look']] : []).concat([['edit', 'Edit'], ['anim', 'Animate'], ['fx', 'Effects' + (el.fx && el.fx.length ? ' ' + el.fx.length : '')]].concat(el.type === 'video' ? [['speed', 'Speed']] : []).concat([['kf', 'Keyframes' + (nk ? ' ' + nk : '')]]));
    if (!tabs.some(function (t) { return t[0] === self.insTab; })) this.insTab = 'edit';
    var tb = h('div', { class: 'se-itabs' }); tabs.forEach(function (t) { var b = h('button', { type: 'button', class: self.insTab === t[0] ? 'on' : '' }, E(t[1])); b.addEventListener('click', function () { self.insTab = t[0]; self.renderInspector(); }); tb.appendChild(b); }); box.appendChild(tb);
    var body = h('div', { class: 'se-ibody' }); box.appendChild(body);
    if (this.insTab === 'anim') return this.tabAnim(body, el);
    if (this.insTab === 'fx') return this.tabFx(body, el);
    if (this.insTab === 'speed') return this.tabSpeed(body, el);
    if (this.insTab === 'kf') return this.tabKf(body, el);
    if (this.insTab === 'midi') return this.tabMidi(body, el);
    // ---- edit
    if (el.type === 'adjust') body.appendChild(h('p', { class: 'se-note' }, '◐ <b>Adjustment layer</b> — its effects change everything <i>under</i> it in the timeline, while it\'s on. Add effects in the <b>Effects</b> tab or drag them here from ✨ Effects.'));
    if (def.midi) this.midiDiag(body, el);
    if (def.audio && !this.an) body.appendChild(h('p', { class: 'se-note' }, '🎵 This moves with your song. Add a song in <b>Audio & MIDI</b> — until then it shows a demo.'));
    var typeF = MIDI_LOOK[el.type] ? [] : FIELDS[el.type] || [], defs = def.defaults;
    if (MIDI_LOOK[el.type]) { var go = h('button', { type: 'button', class: 'se-big' }, '🎹 Change how it looks (colours, outline, background…)'); go.addEventListener('click', function () { self.insTab = 'midi'; self.renderInspector(); }); body.appendChild(go); }
    if (el.type === 'text') { this.form(body, typeF.slice(0, 1), el, ch, defs); }
    if (el.type !== 'adjust') this.transformBox(body, el);
    else this.form(body, [['opacity', 'Strength', 'range', 0, 100, 1, { suffix: '%' }], ['blend', 'Blend', 'blend']], el, ch);
    if (typeF.length) { var tf = h('div', { class: 'se-sec' }); tf.appendChild(h('div', { class: 'se-fh big' }, E(def.label) + ' settings')); this.form(tf, el.type === 'text' ? typeF.slice(1) : typeF, el, function (k, l) { ch(k, l); if (!l && (k === 'midi' || k === 'track' || k === 'channel')) self.renderInspector(); }, defs); body.appendChild(tf); }
    if (el.type !== 'adjust') { var sg = h('div', { class: 'se-sec' }); this.form(sg, [['head', 'Shadow & glow'], ['shadowOpacity', 'Drop shadow', 'range', 0, 100, 1, { suffix: '%' }], ['shadowX', 'Shadow ↔', 'range', -100, 100, 1, { if: function (e) { return e.shadowOpacity > 0; } }], ['shadowY', 'Shadow ↕', 'range', -100, 100, 1, { if: function (e) { return e.shadowOpacity > 0; } }], ['shadowBlur', 'Shadow blur', 'range', 0, 100, 1, { if: function (e) { return e.shadowOpacity > 0; } }], ['shadowColor', 'Shadow colour', 'color', { if: function (e) { return e.shadowOpacity > 0; } }], ['glow', 'Glow', 'range', 0, 80, 1], ['glowColor', 'Glow colour', 'color', { if: function (e) { return e.glow > 0; } }]], el, function (k, l) { ch(k, l); if (!l && (k === 'shadowOpacity' || k === 'glow')) self.renderInspector(); }, BASEDEF); body.appendChild(sg); }
    var tm = h('div', { class: 'se-sec' }), D = Math.max(this.P.duration, el.end) + 10;
    this.form(tm, [['head', 'Timing'], ['start', 'Starts at', 'range', 0, D, 0.01, { suffix: 's' }], ['end', 'Ends at', 'range', 0, D, 0.01, { suffix: 's' }]], el, function (k, l) {
      if (el.end <= el.start + 0.05) { if (k === 'start') el.start = round(el.end - 0.05, 3); else el.end = round(el.start + 0.05, 3); }
      if (el.type === 'video') el.srcDur = round((el.end - el.start) * C.avgSpeed(el), 4);
      ch(k, l);
    });
    body.appendChild(tm);
    var sl = h('div', { class: 'se-sec' });
    this.form(sl, [['head', 'Template'], ['replaceable', 'Template slot — people can replace this', 'toggle', { rerender: true }], ['slotName', 'Slot name (what to put here)', 'text', { if: function (e) { return e.replaceable; } }]], el, function (k, l) { ch(k, l); if (!l) self.renderTimelineSoon(); if (self.tab === 'replace') self.renderPanel(); });
    body.appendChild(sl);
  };
  var BASEDEF = { shadowOpacity: 0, shadowX: 0, shadowY: 0, shadowBlur: 0, glow: 0 };
  EP.midiDiag = function (box, el) {
    var self = this, n = this.notes(), f = C.filterNotes(n, el), d = h('div', { class: 'se-note' + (f.length ? '' : ' warn') });
    if (this.usingDemo()) { d.innerHTML = '🎹 Showing <b>demo notes</b>. Add your MIDI file to see your own melody. '; var b = h('button', { type: 'button', class: 'se-btn' }, '✚ Add MIDI'); b.addEventListener('click', function () { self.pick('.mid,.midi,audio/midi,audio/x-midi'); }); d.appendChild(b); }
    else if (!f.length) { d.innerHTML = '⚠ No notes match this track/channel choice. '; var b2 = h('button', { type: 'button', class: 'se-btn' }, 'Use all notes'); b2.addEventListener('click', function () { el.midi = 'all'; el.track = -1; el.channel = -1; self.changed({ insp: true }); }); d.appendChild(b2); }
    else { var vis = f.filter(function (q) { return q.e > el.start && q.t < el.end; }).length; d.innerHTML = '🎹 Showing <b>' + f.length + '</b> notes' + (vis < f.length ? ' (' + vis + ' while this clip is on)' : '') + '.' + (vis === 0 ? ' <b>None play while this clip is on</b> — move the MIDI or the clip in the timeline.' : ''); if (!vis) d.classList.add('warn'); }
    box.appendChild(d);
  };
  EP.transformBox = function (box, el) {
    var self = this, P = this.P, sec = h('div', { class: 'se-sec' }), ch = onEl(this, el);
    sec.appendChild(h('div', { class: 'se-fh big' }, 'Position & size'));
    var rows = [['x', 'Left ↔ right', -P.w * 0.5, P.w * 1.5, 1], ['y', 'Up ↕ down', -P.h * 0.5, P.h * 1.5, 1], ['scale', 'Scale', 1, 500, 0.5, '%'], ['rot', 'Rotation', -360, 360, 0.5, '°'], ['opacity', 'Opacity', 0, 100, 1, '%']];
    rows.forEach(function (r) {
      var k = r[0], row = h('div', { class: 'se-f se-f-range' }), lab = h('label', { class: 'se-fl' }, '<span>' + r[1] + '</span>');
      var kb = h('button', { type: 'button', class: 'se-kfb', 'data-kfbtn': k, title: 'Keyframe — animate ' + r[1].toLowerCase() + ' over time' }, '◆');
      var nav = h('span', { class: 'se-kfnav' }, '<button type="button" data-d="-1" title="Previous keyframe">◀</button><button type="button" data-d="1" title="Next keyframe">▶</button>');
      lab.appendChild(nav); lab.appendChild(kb); row.appendChild(lab);
      var sl = slider(C.prop(el, k, self.t), r[2], r[3], r[4], function (v, light) { self.setProp(el, k, v); ch(k, light); refresh(); }, r[5]);
      lab.addEventListener('dblclick', function (e) { if (e.target.closest('button')) return; self.setProp(el, k, { x: P.w / 2, y: P.h / 2, scale: 100, rot: 0, opacity: 100 }[k]); self.changed({ insp: true }); });
      lab.title = 'Double-click to reset';
      row.appendChild(sl);
      var refresh = function () { var has = el.kf && el.kf[k] && el.kf[k].length, at = self.kfAt(el, k) >= 0; kb.className = 'se-kfb' + (at ? ' at' : has ? ' has' : ''); nav.hidden = !has; };
      kb.addEventListener('click', function () { self.toggleKeyframe(el, k); });
      kb.addEventListener('se-refresh', refresh);
      nav.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { var d = +b.getAttribute('data-d'), lt = self.t - el.start, l = (el.kf[k] || []).map(function (q) { return q.t; }), tgt = d > 0 ? l.filter(function (x) { return x > lt + 1e-3; })[0] : l.filter(function (x) { return x < lt - 1e-3; }).pop(); if (tgt != null) self.seek(el.start + tgt); }); });
      refresh();
      self.live.push(function () { sl._set(C.prop(el, k, self.t)); refresh(); });
      sec.appendChild(row);
    });
    this.form(sec, [['w', 'Box width', 'range', 4, P.w * 2, 1], ['h', 'Box height', 'range', 4, P.h * 2, 1]], el, ch);
    var bt = h('div', { class: 'se-btnrow' });
    [['⊡ Fit', 'Fit inside the video'], ['⛶ Fill', 'Fill the whole video'], ['✛ Center', 'Center it'], ['↔ Flip', 'Mirror left/right'], ['↕ Flip', 'Upside down']].forEach(function (b, i) {
      var x = h('button', { type: 'button', class: 'se-btn', title: b[1] }, b[0]);
      x.addEventListener('click', function () {
        var m = el.media && P.media[el.media], ar = m && m.iw ? m.iw / m.ih : el.w / el.h;
        if (i === 0 || i === 1) { var k = i === 0 ? Math.min(P.w / ar, P.h) : Math.max(P.w / ar, P.h); el.h = round(k, 1); el.w = round(k * ar, 1); self.setProp(el, 'scale', 100); self.setProp(el, 'x', P.w / 2); self.setProp(el, 'y', P.h / 2); self.setProp(el, 'rot', 0); }
        if (i === 2) { self.setProp(el, 'x', P.w / 2); self.setProp(el, 'y', P.h / 2); }
        if (i === 3) el.flipX = !el.flipX; if (i === 4) el.flipY = !el.flipY;
        self.changed({ insp: true });
      });
      bt.appendChild(x);
    });
    sec.appendChild(bt);
    this.form(sec, [['blend', 'Blend mode', 'blend']], el, ch);
    box.appendChild(sec);
  };
  EP.refreshKfMarks = function () { if (this.liveInsp) this.liveInsp(); };

  /* ---------- 🎹 MIDI look tab: skins + every setting of a MIDI visual ---------- */
  EP.tabMidi = function (body, el) {
    var self = this, def = T[el.type], ch = onEl(this, el);
    this.midiDiag(body, el);
    var src = h('div', { class: 'se-sec' }); this.form(src, MIDI_F, el, function (k, l) { ch(k, l); if (!l) self.renderInspector(); }); body.appendChild(src);
    if (el.type !== 'plugin' || true) {
      var sk = h('div', { class: 'se-sec' }); sk.appendChild(h('div', { class: 'se-fh big' }, 'Skins <small>one click — then change anything below</small>'));
      var g = h('div', { class: 'se-skins' });
      C.SKINS.forEach(function (sd) {
        var b = h('button', { type: 'button', class: 'se-skin' + (el.skin === sd[0] ? ' on' : ''), title: sd[1] }, '<canvas></canvas><b>' + E(sd[1]) + '</b>');
        b.addEventListener('click', function () { C.applySkin(el, sd[0]); self.changed({ tl: true, insp: true }); self.toast(sd[0] === 'notes' ? 'Notes only — the background, keys and lines are hidden' : 'Skin: ' + sd[1]); });
        g.appendChild(b);
        setTimeout(function () { self.skinPreview(b.querySelector('canvas'), el, sd[0]); }, 20);
      });
      sk.appendChild(g); body.appendChild(sk);
    }
    var look = h('div', { class: 'se-sec' });
    this.form(look, MIDI_LOOK[el.type], el, function (k, l) { if (!l && k !== 'skin') el.skin = ''; ch(k, l); if (!l && /^(panel|titleBar|frame|offsetShadow|noteStroke|cellStroke|keys|keyboard|showLines|showOff|mode)$/.test(k)) self.renderInspector(); }, def.defaults);
    body.appendChild(look);
  };
  EP.skinPreview = function (cv, el, id) {
    try {
      var k = Math.min(150 / el.w, 84 / el.h), P0 = C.newProject(); P0.w = Math.max(40, Math.round(el.w)); P0.h = Math.max(30, Math.round(el.h)); P0.bpm = this.P.bpm; P0.beatOffset = this.P.beatOffset; P0.duration = 600; P0.bg = { type: 'color', color: '#cfc6dc' };
      var e = JSON.parse(JSON.stringify(el)); C.applySkin(e, id); e.x = P0.w / 2; e.y = P0.h / 2; e.scale = 100; e.rot = 0; e.opacity = 100; e.kf = {}; e.fx = []; e.start = 0; e.end = 600; e.anim = C.newAnim(); e.hidden = false; e.flipX = e.flipY = false;
      P0.layers = [e]; cv.width = Math.max(40, Math.round(P0.w * k)); cv.height = Math.max(30, Math.round(P0.h * k));
      var t = clamp(this.t, 0.01, 599); if (this.t < el.start || this.t >= el.end) t = Math.max(el.start + 1.5, 1.5);
      C.renderFrame(cv, P0, { t: t, P: P0, notes: this.notes(), an: this.an, media: this.mediaFn(), edit: false });
    } catch (x) { console.warn(x); }
  };

  /* ---------- Animate tab ---------- */
  EP.tabAnim = function (body, el) {
    var self = this, A = el.anim, ch = function (k, l) { self.needs = true; if (!l) self.changed({ tl: true }); };
    body.appendChild(h('p', { class: 'se-help' }, 'Tip: drag animations from 🎬 Animations onto anything. Press ▶ to preview.'));
    [['in', 'In — how it appears', C.IN_ANIMS], ['out', 'Out — how it leaves', C.IN_ANIMS], ['loop', 'Loop — while it\'s on', C.LOOP_ANIMS]].forEach(function (s) {
      var slot = s[0], a = A[slot], sec = h('div', { class: 'se-sec' }), hd = h('div', { class: 'se-fh big' }, E(s[1])), pv = h('button', { type: 'button', class: 'se-btn sm' }, '▶ Preview');
      pv.addEventListener('click', function () { var len = slot === 'loop' ? 2.5 : (a.dur || 0.5) + 0.5; self.preview(slot === 'out' ? Math.max(el.start, el.end - len) : el.start, slot === 'out' ? el.end : Math.min(el.end, el.start + len)); });
      hd.appendChild(pv); sec.appendChild(hd);
      sec.appendChild(select(s[2], a.type, function (v) { a.type = v; if (slot !== 'loop' && !a.dur) a.dur = 0.5; self.changed({ tl: true }); self.renderInspector(); if (v !== 'none') pv.click(); }));
      if (a.type !== 'none') {
        if (slot === 'loop') {
          var isBeat = /^beat-/.test(a.type);
          self.form(sec, [['amt', 'Strength', 'range', 0, 4, 0.05]].concat(isBeat ? [['every', 'Every … beats', 'chips', [[0.25, '¼'], [0.5, '½'], [1, '1'], [2, '2'], [4, '4 (bar)']], { num: 1, rerender: false }]] : [['speed', 'Speed', 'range', 0.05, 6, 0.05]]), a, ch);
        } else {
          self.form(sec, [['dur', 'Time', 'range', 0.05, Math.max(0.1, Math.min(5, el.end - el.start)), 0.01, { suffix: 's' }], ['amt', 'Strength', 'range', 0, 4, 0.05]], a, ch);
          var eh = h('details', { class: 'se-det' }, '<summary>Easing curve (how the speed feels)</summary>');
          eh.appendChild(self.easeBox(a.ease || 'out', function (v, l) { a.ease = v; self.needs = true; if (!l) self.changed(); })); sec.appendChild(eh);
        }
      }
      body.appendChild(sec);
    });
  };

  /* ---------- Effects tab ---------- */
  EP.tabFx = function (body, el) {
    var self = this; el.fx = el.fx || [];
    var add = h('div', { class: 'se-addfx' }), opts = [['', '✚ Add an effect…']].concat(C.FX_CATS.map(function (c) { return [0, c, Object.keys(C.FX).filter(function (k) { return C.FX[k].cat === c; }).map(function (k) { return [k, C.FX[k].name]; })]; }));
    add.appendChild(select(opts, '', function (v) { if (!v) return; self.applyFx(v, el); }));
    body.appendChild(add);
    if (!el.fx.length) body.appendChild(h('p', { class: 'se-help' }, el.type === 'adjust' ? 'Add effects — they change everything under this adjustment layer.' : 'No effects yet. Pick one above, or drag one from ✨ Effects onto this clip.'));
    el.fx.forEach(function (f, i) {
      var d = C.FX[f.type]; if (!d) return;
      var card = h('div', { class: 'se-fxc' + (f.on === false ? ' off' : '') }), hd = h('div', { class: 'se-fxh' }, '<b>' + E(d.name) + '</b><button type="button" data-a="on" title="On / off">' + (f.on === false ? '○' : '●') + '</button><button type="button" data-a="up" title="Move up">↑</button><button type="button" data-a="down" title="Move down">↓</button><button type="button" data-a="x" title="Remove">✕</button>');
      hd.querySelectorAll('[data-a]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-a'); if (a === 'on') f.on = f.on === false; else if (a === 'x') el.fx.splice(i, 1); else { var j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= el.fx.length) return; el.fx.splice(i, 1); el.fx.splice(j, 0, f); } self.changed({ tl: true, insp: true }); }); });
      card.appendChild(hd);
      f.p = Object.assign(C.fxDefaults(f.type), f.p || {});
      var flds = d.params.map(function (q) { if (q[2] === 'color') return [q[0], q[1], 'color']; if (q[2] === 'toggle') return [q[0], q[1], 'toggle']; if (q[2] === 'select') return [q[0], q[1], 'select', q[4]]; return [q[0], q[1], 'range', q[2], q[3], q[4]]; });
      var fb = h('div'); self.form(fb, flds, f.p, function (k, l) { self.needs = true; if (!l) self.changed(); }, C.fxDefaults(f.type)); card.appendChild(fb);
      var mb = h('div'); self.form(mb, [['mix', 'Amount (mix)', 'range', 0, 100, 1, { suffix: '%' }], ['beat', 'Hit on the beat', 'toggle', { rerender: true }], ['every', 'Every … beats', 'chips', [[0.25, '¼'], [0.5, '½'], [1, '1'], [2, '2'], [4, '4']], { num: 1, rerender: false, if: function (x) { return x.beat; } }]], f, function (k, l) { self.needs = true; if (!l) self.changed(); }, { mix: 100 }); card.appendChild(mb);
      body.appendChild(card);
    });
    if (el.fx.length) { var rb = h('div', { class: 'se-btnrow' }), cp = h('button', { type: 'button', class: 'se-btn' }, '⧉ Copy effects'); cp.addEventListener('click', function () { self.copiedFx = clone(el.fx); self.toast('Effects copied — right-click another clip → Paste effects'); }); rb.appendChild(cp); body.appendChild(rb); }
  };

  /* ---------- Speed tab (video clips) ---------- */
  EP.tabSpeed = function (body, el) {
    var self = this, ch = function (light) { self.needs = true; self.syncVideos(self.t, false); if (!light) self.changed({ tl: true, audio: true }); };
    var sec = h('div', { class: 'se-sec' }); sec.appendChild(h('div', { class: 'se-fh big' }, 'Steady speed'));
    var sl = slider(el.speed || 1, 0.1, 10, 0.05, function (v, l) { el.curve = null; el.speed = v; C.setLengthFromSpeed(el); ch(l); if (!l) self.renderInspector(); }, 'x');
    sec.appendChild(sl);
    var q = h('div', { class: 'se-chips' }); [0.25, 0.5, 1, 1.5, 2, 3, 5].forEach(function (v) { var b = h('button', { type: 'button', class: !el.curve && el.speed === v ? 'on' : '' }, v + 'x'); b.addEventListener('click', function () { el.curve = null; el.speed = v; C.setLengthFromSpeed(el); ch(); self.renderInspector(); }); q.appendChild(b); }); sec.appendChild(q);
    body.appendChild(sec);
    var s2 = h('div', { class: 'se-sec' }); s2.appendChild(this.speedBox(el, ch)); body.appendChild(s2);
  };

  /* ---------- Keyframes tab ---------- */
  EP.tabKf = function (body, el) {
    var self = this; el.kf = el.kf || {};
    body.appendChild(h('p', { class: 'se-help' }, 'Keyframes animate a setting over time: move the playhead, then change position, scale, rotation or opacity — or press ◆.'));
    var bt = h('div', { class: 'se-btnrow' }), a = h('button', { type: 'button', class: 'se-btn' }, '◆ Keyframe everything here'), clr = h('button', { type: 'button', class: 'se-btn' }, '✕ Remove all keyframes');
    a.addEventListener('click', function () { if (self.kfAt(el, 'x') < 0) self.toggleKeyframe(el); else self.toast('There\'s already a keyframe here'); });
    clr.addEventListener('click', function () { Object.keys(el.kf).forEach(function (k) { var l = el.kf[k]; if (l && l.length) el[k] = C.prop(el, k, self.t); }); el.kf = {}; self.changed({ tl: true, insp: true }); });
    bt.appendChild(a); bt.appendChild(clr); body.appendChild(bt);
    C.KF_PROPS.forEach(function (p) {
      var k = p[0], list = el.kf[k]; if (!list || !list.length) return;
      var sec = h('div', { class: 'se-sec' }); sec.appendChild(h('div', { class: 'se-fh big' }, E(p[1]) + ' · ' + list.length));
      list.forEach(function (q, i) {
        var r = h('div', { class: 'se-kfrow' }), tt = h('input', { type: 'number', step: '0.01', min: '0', title: 'Time (seconds from the clip start)' }), vv = h('input', { type: 'number', step: '0.1', title: 'Value' });
        tt.value = round(q.t, 3); vv.value = round(q.v, 2);
        tt.addEventListener('change', function () { q.t = round(clamp(+tt.value || 0, 0, el.end - el.start), 4); list.sort(function (x, y) { return x.t - y.t; }); self.changed({ tl: true, insp: true }); });
        vv.addEventListener('change', function () { q.v = +vv.value || 0; self.changed(); });
        var go = h('button', { type: 'button', class: 'se-btn sm', title: 'Jump here' }, '⏵'), x = h('button', { type: 'button', class: 'se-btn sm', title: 'Delete' }, '✕');
        go.addEventListener('click', function () { self.seek(el.start + q.t); });
        x.addEventListener('click', function () { list.splice(i, 1); if (!list.length) { el[k] = q.v; delete el.kf[k]; } self.changed({ tl: true, insp: true }); });
        r.appendChild(h('span', null, '◆')); r.appendChild(tt); r.appendChild(h('small', null, 's')); r.appendChild(vv); r.appendChild(go); r.appendChild(x);
        sec.appendChild(r);
        if (i < list.length - 1) { var d = h('details', { class: 'se-det' }, '<summary>Motion to the next keyframe: ' + E(Array.isArray(q.e) ? 'custom' : (C.EASE_PRESETS.filter(function (z) { return z[0] === (q.e || 'smooth'); })[0] || [0, q.e])[1]) + '</summary>'); d.appendChild(self.easeBox(q.e || 'smooth', function (v, l) { q.e = v; self.needs = true; if (!l) self.changed(); })); sec.appendChild(d); }
      });
      body.appendChild(sec);
    });
    if (!Object.keys(el.kf).some(function (k) { return el.kf[k] && el.kf[k].length; })) body.appendChild(h('p', { class: 'se-help' }, 'No keyframes yet.'));
  };

  /* ---------- audio clip ---------- */
  EP.inspAudio = function (box, c) {
    var self = this, m = this.P.media[c.media] || {}, ch = function (k, l) { if (!l) self.changed({ tl: true, audio: true }); };
    var head = h('div', { class: 'se-ihead' }, '<i>🎵</i><input type="text" maxlength="60"><button type="button" data-a="dup" title="Duplicate">⧉</button><button type="button" data-a="del" title="Delete">🗑</button>');
    var ni = head.querySelector('input'); ni.value = c.name || m.name || 'Audio'; ni.addEventListener('change', function () { c.name = ni.value; self.changed({ tl: true }); });
    head.querySelector('[data-a=dup]').addEventListener('click', function () { self.duplicateSel(); }); head.querySelector('[data-a=del]').addEventListener('click', function () { self.deleteSel(); });
    box.appendChild(head);
    var body = h('div', { class: 'se-ibody' }); box.appendChild(body);
    var total = m.dur || c.in + c.dur;
    this.form(body, [['vol', 'Volume', 'range', 0, 200, 1, { suffix: '%' }], ['fadeIn', 'Fade in', 'range', 0, 10, 0.05, { suffix: 's' }], ['fadeOut', 'Fade out', 'range', 0, 10, 0.05, { suffix: 's' }], ['muted', 'Mute', 'toggle'],
      ['head', 'Timing'], ['start', 'Starts at', 'range', 0, Math.max(this.P.duration, 30), 0.01, { suffix: 's' }], ['in', 'Song starts from', 'range', 0, Math.max(0.01, total - 0.05), 0.01, { suffix: 's' }], ['dur', 'How much of the song', 'range', 0.05, Math.max(0.1, total), 0.01, { suffix: 's' }], ['speed', 'Speed', 'range', 0.25, 4, 0.01, { suffix: 'x' }]], c, function (k, l) {
      if (k === 'in' || k === 'dur') { c.in = clamp(c.in, 0, total - 0.05); c.dur = clamp(c.dur, 0.05, total - c.in); }
      ch(k, l);
    }, { vol: 100, fadeIn: 0, fadeOut: 0, speed: 1, in: 0 });
    var br = h('div', { class: 'se-btnrow' });
    [['✂ Split at playhead', function () { self.splitAudio(c, self.t); }], ['🥁 Find BPM', function () { var i = self.P.audio.indexOf(c); self.P.audio.splice(i, 1); self.P.audio.unshift(c); self.detectBpm(); }], ['▶ Play from here', function () { self.seek(c.start); self.play(); }]].forEach(function (b) { var x = h('button', { type: 'button', class: 'se-btn' }, b[0]); x.addEventListener('click', b[1]); br.appendChild(x); });
    body.appendChild(br);
  };
  /* ---------- transition ---------- */
  EP.inspTr = function (box, tr) {
    var self = this; this.inspHead(box, '⚡', 'Transition', 'A hit that plays at a moment in the video');
    var body = h('div', { class: 'se-ibody' }); box.appendChild(body);
    this.form(body, [['type', 'Type', 'chips', C.TRANSITIONS], ['t', 'At', 'range', 0, this.P.duration, 0.01, { suffix: 's' }], ['dur', 'Length', 'range', 0.05, 3, 0.01, { suffix: 's' }], ['color', 'Colour (flash / dip)', 'color']], tr, function (k, l) { self.needs = true; if (!l) { self.changed({ tl: true }); if (k === 'type') self.preview(Math.max(0, tr.t - 0.6), tr.t + 0.6); } });
    var br = h('div', { class: 'se-btnrow' }), pv = h('button', { type: 'button', class: 'se-btn' }, '▶ Preview'), dl = h('button', { type: 'button', class: 'se-btn' }, '🗑 Delete');
    pv.addEventListener('click', function () { self.preview(Math.max(0, tr.t - 0.6), tr.t + 0.6); }); dl.addEventListener('click', function () { self.deleteSel(); });
    br.appendChild(pv); br.appendChild(dl); body.appendChild(br);
  };
  /* ---------- MIDI file ---------- */
  EP.inspMidi = function (box, mr) {
    this.inspHead(box, '🎹', mr.name || 'MIDI', 'MIDI file');
    var body = h('div', { class: 'se-ibody' }); box.appendChild(body); this.midiCard(body, mr);
  };
  EP.midiCard = function (box, mr) {
    var self = this, mm = this.midis[mr.id], card = h('div', { class: 'se-sec' });
    if (!mm) { card.innerHTML = '<p class="se-note warn">This MIDI file is missing — please add it again.</p>'; box.appendChild(card); return; }
    card.appendChild(h('div', { class: 'se-fh big' }, '🎹 ' + E(mr.name)));
    card.appendChild(h('p', { class: 'se-help' }, mm.notes.length + ' notes · ' + U.fmt(mm.duration) + ' long · its tempo: ' + mm.bpm + ' BPM'));
    var tl = h('div', { class: 'se-tracks' }); mm.tracks.forEach(function (t) { tl.appendChild(h('span', null, (t.index + 1) + ': ' + E(t.name) + ' <b>' + t.notes + '</b>')); }); card.appendChild(tl);
    this.form(card, [['mode', 'Timing', 'chips', [['file', 'Use the MIDI\'s own tempo'], ['project', 'Follow the project BPM']]], ['offset', 'Start offset (drag it in the timeline too)', 'range', -30, 60, 0.01, { suffix: 's' }], ['transpose', 'Transpose', 'range', -36, 36, 1]], mr, function (k, l) { self._nk = null; self.needs = true; if (!l) self.changed({ tl: true }); }, { offset: 0, transpose: 0 });
    var br = h('div', { class: 'se-btnrow' }), b1 = h('button', { type: 'button', class: 'se-btn' }, '♩ Set project BPM to ' + mm.bpm), b2 = h('button', { type: 'button', class: 'se-btn' }, '🗑 Remove');
    b1.addEventListener('click', function () { self.setBpm(mm.bpm); self.toast('Project BPM: ' + mm.bpm); });
    b2.addEventListener('click', function () { self.P.midis = self.P.midis.filter(function (x) { return x !== mr; }); if (self.sel === mr.id) self.select(null); self.changed({ tl: true, insp: true }); self.renderPanel(); });
    br.appendChild(b1); br.appendChild(b2); card.appendChild(br); box.appendChild(card);
  };
  /* ---------- project (nothing selected) ---------- */
  EP.inspProject = function (box) {
    this.inspHead(box, '▣', 'Video settings', 'Click anything in the video or timeline to edit it');
    var body = h('div', { class: 'se-ibody' }); box.appendChild(body); this.projectForm(body);
  };
  EP.projectForm = function (body) {
    var self = this, P = this.P;
    var s1 = h('div', { class: 'se-sec' }); s1.appendChild(h('div', { class: 'se-fh big' }, 'Shape'));
    var rc = h('div', { class: 'se-ratios' });
    C.RATIOS.forEach(function (r) { var b = h('button', { type: 'button', class: P.ratio === r[0] ? 'on' : '', title: r[1] }, '<i style="aspect-ratio:' + r[2] + '/' + r[3] + '"></i><b>' + r[0] + '</b><small>' + E(r[1]) + '</small>'); b.addEventListener('click', function () { self.setRatio(r[0]); self.renderInspector(); if (self.tab === 'canvas') self.renderPanel(); }); rc.appendChild(b); });
    s1.appendChild(rc); body.appendChild(s1);
    var s2 = h('div', { class: 'se-sec' });
    this.form(s2, [['head', 'Length & tempo'], ['autoLength', 'Length follows the clips', 'toggle', { rerender: true }], ['duration', 'Video length', 'range', 1, Math.max(120, P.duration * 1.5), 0.01, { suffix: 's', if: function (p) { return !p.autoLength; } }], ['fps', 'Frames per second', 'chips', [[24, '24'], [25, '25'], [30, '30'], [60, '60']], { num: 1 }], ['bpm', 'BPM', 'range', 40, 300, 0.1], ['beatOffset', 'Beat offset (line the beat up)', 'range', -2, 2, 0.001, { suffix: 's' }]], P, function (k, l) {
      if (k === 'bpm') self.$('[data-bpm]').value = P.bpm;
      if (k === 'duration') { var e = C.contentEnd(P); if (P.duration < 1) P.duration = 1; void e; }
      self.needs = true; if (!l) { self.changed({ tl: true }); if (k === 'autoLength') self.renderInspector(); } else if (k === 'bpm' || k === 'beatOffset' || k === 'duration') self.renderTimelineSoon();
    }, { beatOffset: 0 });
    body.appendChild(s2);
    var bg = P.bg, s3 = h('div', { class: 'se-sec' });
    s3.appendChild(h('div', { class: 'se-fh big' }, 'Background'));
    s3.appendChild(chips([['color', 'Colour'], ['gradient', 'Gradient'], ['clouds', 'Clouds'], ['media', 'Picture / video']], bg.type || 'color', function (v) { bg.type = v; if (v === 'gradient' && !bg.fillc) bg.fillc = C.fill(bg.color || '#ff3fc8', bg.color2 || '#38c8ff', { angle: 180 }); self.changed(); self.renderInspector(); if (self.tab === 'canvas') self.renderPanel(); }));
    var bgF = { color: [['color', 'Colour', 'color']], gradient: [['fillc', 'Gradient', 'fill', { angle: 1 }]], clouds: [['color', 'Base', 'color'], ['color2', 'Cloud colour 1', 'color'], ['color3', 'Cloud colour 2', 'color'], ['color4', 'Cloud colour 3', 'color'], ['speed', 'Drift speed', 'range', 0, 5, 0.05]], media: [['color', 'Colour behind', 'color'], ['fit', 'Fit', 'chips', [['cover', 'Fill'], ['contain', 'Whole']]], ['zoom', 'Zoom', 'range', 0, 100, 1, { suffix: '%' }], ['blur', 'Blur', 'range', 0, 60, 1], ['pulse', 'Pump on the beat', 'toggle']] }[bg.type || 'color'];
    this.form(s3, bgF.concat([['dim', 'Darken', 'range', 0, 100, 1, { suffix: '%' }]]), bg, function (k, l) { self.needs = true; if (!l) self.changed(); });
    if (bg.type === 'media') {
      var mr = h('div', { class: 'se-btnrow' }), pk = h('button', { type: 'button', class: 'se-btn' }, bg.media || bg.src ? '⇄ Replace background' : '⬆ Choose background');
      pk.addEventListener('click', function () { self.pick('image/*', function (f) { self.importFile(f[0]).then(function (r) { if (r && r.kind === 'image') { bg.media = r.id; bg.src = ''; self.changed({ insp: true }); } }); }, false); });
      mr.appendChild(pk); s3.appendChild(mr);
    }
    body.appendChild(s3);
    var cam = P.camera, s4 = h('div', { class: 'se-sec' });
    this.form(s4, [['head', 'Camera (moves the whole video)'], ['bounce', 'Bounce', 'chips', [['off', 'Off'], ['half', '½ beat'], ['beat', 'Every beat'], ['2beats', '2 beats'], ['bar', 'Every bar']]], ['amount', 'Bounce strength', 'range', 0, 30, 0.1, { if: function (c) { return c.bounce && c.bounce !== 'off'; } }], ['shake', 'Camera shake', 'range', 0, 40, 0.5], ['drift', 'Slow drift', 'range', 0, 20, 0.1]], cam, function (k, l) { self.needs = true; if (!l) self.changed(); }, { amount: 4, shake: 0, drift: 0 });
    body.appendChild(s4);
  };

  /* =========================================================
     LEFT PANELS
     ========================================================= */
  function drag(el, data) { el.draggable = true; el.addEventListener('dragstart', function (e) { var s = JSON.stringify(data); e.dataTransfer.setData('application/x-sul', s); e.dataTransfer.setData('text/plain', s); e.dataTransfer.effectAllowed = 'copy'; }); }
  function tile(icon, label, cls) { return h('button', { type: 'button', class: 'se-tile ' + (cls || '') }, '<i>' + icon + '</i><span>' + E(label) + '</span>'); }
  EP.renderPanel = function () {
    if (!this.P || !this.panel) return;
    var p = this.panel, keep = this.tab === this._lastTab ? p.scrollTop : 0;
    var has = this.P.layers.some(function (l) { return l.replaceable; }), rp = this.root.querySelector('[data-tab=replace]'); if (rp) rp.hidden = !has && this.tab !== 'replace';
    p.innerHTML = ''; var fn = this['panel_' + this.tab]; if (fn) fn.call(this, p);
    this.applyWS(); this._lastTab = this.tab; p.scrollTop = keep;
  };
  function head(p, t, sub) { p.appendChild(h('div', { class: 'se-ph2' }, '<b>' + E(t) + '</b>' + (sub ? '<small>' + E(sub) + '</small>' : ''))); }
  EP.panel_media = function (p) {
    var self = this, P = this.P, ec = this.cfg.editor || {};
    head(p, 'Media', 'click or drag into the video');
    var up = h('button', { type: 'button', class: 'se-big' }, '⬆ Upload pictures, videos, songs, MIDI, fonts'); up.addEventListener('click', function () { self.pick('image/*,video/*,audio/*,.mid,.midi,.ttf,.otf,.woff,.woff2'); }); p.appendChild(up);
    p.appendChild(h('small', { class: 'se-help' }, 'Your files stay on this device. You can also drop files straight onto the video or the timeline.'));
    var ids = Object.keys(P.media).filter(function (id) { return !P.media[id].src || !self.isSiteAsset(P.media[id].src); });
    if (ids.length) {
      p.appendChild(h('div', { class: 'se-fh' }, 'In this project'));
      var g = h('div', { class: 'se-grid' });
      ids.forEach(function (id) {
        var m = P.media[id], rec = self.media[id], b = tile({ video: '🎞', audio: '🎵', midi: '🎹', font: 'Aa', image: '🖼' }[m.kind] || '?', m.kind === 'font' ? m.family : m.name, 'k-' + m.kind);
        if (rec && rec.thumb) { b.style.backgroundImage = 'url("' + rec.thumb + '")'; b.classList.add('img'); }
        if (m.kind === 'font') b.querySelector('i').style.fontFamily = '"' + m.family + '"';
        if (rec && (rec.bad || rec.missing)) b.classList.add('bad');
        b.addEventListener('click', function () { var tgt = self.cur(); self.placeMedia(id, m.kind, { t: self.t }, tgt && tgt.replaceable && (m.kind === 'image' || m.kind === 'video') ? tgt : null); });
        drag(b, { what: 'media', id: id, kind: m.kind });
        var x = h('em', { title: 'Remove from project' }, '✕'); x.addEventListener('click', function (e) { e.stopPropagation(); self.removeMedia(id); }); b.appendChild(x);
        g.appendChild(b);
      });
      p.appendChild(g);
    }
    var assets = (ec.assets || []).filter(function (a) { return a && a.src && a.enabled !== false; });
    if (assets.length) {
      var groups = {}; assets.forEach(function (a) { var k = a.category || 'Free assets'; (groups[k] = groups[k] || []).push(a); });
      Object.keys(groups).forEach(function (gk) {
        p.appendChild(h('div', { class: 'se-fh' }, '✦ ' + E(gk)));
        var g2 = h('div', { class: 'se-grid' });
        groups[gk].forEach(function (a) {
          var kind = a.kind || (/\.(mp4|webm|mov|m4v)$/i.test(a.src) ? 'video' : /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.src) ? 'audio' : 'image'), b = tile(kind === 'video' ? '🎞' : kind === 'audio' ? '🎵' : '', a.name || '', 'k-' + kind);
          if (kind === 'image') { b.classList.add('img'); b.style.backgroundImage = 'url("' + ((self.api.asset && self.api.asset(a.src)) || a.src) + '")'; }
          b.addEventListener('click', function () { var tgt = self.cur(); self.useSiteAsset({ src: a.src, name: a.name, kind: kind }, { t: self.t }, tgt && tgt.replaceable ? tgt : null); });
          drag(b, { what: 'asset', src: a.src, name: a.name, kind: kind });
          g2.appendChild(b);
        });
        p.appendChild(g2);
      });
    }
  };
  EP.isSiteAsset = function (src) { return ((this.cfg.editor || {}).assets || []).some(function (a) { return a && a.src === src; }); };
  EP.removeMedia = function (id) {
    var P = this.P, used = P.layers.some(function (l) { return l.media === id; }) || P.audio.some(function (a) { return a.media === id; }) || P.midis.some(function (m) { return m.id === id; }) || (P.bg && P.bg.media === id);
    if (used && !confirm('This file is used in your video. Remove it and everything that uses it?')) return;
    P.layers = P.layers.filter(function (l) { return l.media !== id; }); P.audio = P.audio.filter(function (a) { return a.media !== id; }); P.midis = P.midis.filter(function (m) { return m.id !== id; }); if (P.bg && P.bg.media === id) P.bg.media = '';
    delete P.media[id]; if (!this.opts.builder) SE._store.delBlob(id).catch(function () { });
    this.select(null); this.changed({ tl: true, audio: true }); this.renderPanel();
  };
  EP.panel_audio = function (p) {
    var self = this, P = this.P;
    head(p, 'Audio & MIDI');
    var b1 = h('button', { type: 'button', class: 'se-big' }, '🎵 Add a song / sound'); b1.addEventListener('click', function () { self.pick('audio/*,video/*', function (f) { var seq = Promise.resolve(); f.forEach(function (x) { seq = seq.then(function () { return self.importFile(x).then(function (r) { if (r) self.placeMedia(r.id, 'audio', { t: P.audio.length ? self.t : 0 }); }); }); }); seq.then(function () { self.renderPanel(); }); }); });
    p.appendChild(b1);
    if (P.audio.length) { var l = h('div', { class: 'se-list' }); P.audio.forEach(function (c) { var it = h('button', { type: 'button', class: 'se-li' + (self.sel === c.id ? ' on' : '') }, '🎵 <b>' + E(c.name || (P.media[c.media] || {}).name || 'Audio') + '</b><small>' + U.fmt(c.start) + ' · ' + U.fmt(c.dur / (c.speed || 1)) + '</small>'); it.addEventListener('click', function () { self.select('audio', c.id); self.seek(c.start); }); l.appendChild(it); }); p.appendChild(l); }
    p.appendChild(h('small', { class: 'se-help' }, 'Trim songs by dragging the ends of the blue clip in the timeline. A video\'s own sound plays too — change it in the video\'s settings.'));
    var bs = h('div', { class: 'se-sec' }); bs.appendChild(h('div', { class: 'se-fh big' }, '♩ Beat'));
    this.form(bs, [['bpm', 'BPM', 'range', 40, 300, 0.1], ['beatOffset', 'Beat offset', 'range', -2, 2, 0.001, { suffix: 's' }]], P, function (k, l) { self.$('[data-bpm]').value = P.bpm; self.needs = true; if (!l) self.changed({ tl: true }); else self.renderTimelineSoon(); }, { beatOffset: 0 });
    var br = h('div', { class: 'se-btnrow' }), a1 = h('button', { type: 'button', class: 'se-btn' }, '🥁 Find BPM from the song'), a2 = h('button', { type: 'button', class: 'se-btn' }, '🔈 Click track: ' + (this.click ? 'on' : 'off'));
    a1.addEventListener('click', function () { self.detectBpm(); }); a2.addEventListener('click', function () { self.$('[data-click]').click(); self.renderPanel(); });
    br.appendChild(a1); br.appendChild(a2); bs.appendChild(br); p.appendChild(bs);
    var ms = h('div', { class: 'se-sec' }); ms.appendChild(h('div', { class: 'se-fh big' }, '🎹 MIDI'));
    var b2 = h('button', { type: 'button', class: 'se-big' }, '🎹 Add a MIDI file (.mid)'); b2.addEventListener('click', function () { self.pick('.mid,.midi,audio/midi,audio/x-midi'); }); ms.appendChild(b2);
    ms.appendChild(h('small', { class: 'se-help' }, 'Export the MIDI from FL Studio (File → Export → MIDI file) or drag the pattern out. All piano rolls, drum grids and note visuals play it.'));
    p.appendChild(ms);
    P.midis.forEach(function (mr) { self.midiCard(p, mr); });
  };
  var TEXT_PRESETS = [
    ['Title', { text: 'BIG TITLE', font: 'Anton', size: 160, stroke: 0 }],
    ['Subtitle', { text: 'small subtitle', font: 'Space Grotesk', size: 70, caps: false, weight: 700 }],
    ['Caption box', { text: 'caption with a box', font: 'Poppins', weight: 700, size: 64, caps: false, boxOpacity: 0.85, boxColor: '#000000', boxPad: 24 }],
    ['Outline pop', { text: 'OUTLINE', font: 'Luckiest Guy', size: 150, stroke: 12, strokeColor: '#ff2a7a', anim: { in: { type: 'pop', dur: 0.45 }, loop: { type: 'beat-bounce', amt: 0.5 } } }],
    ['Accent word', { text: 'HOW I MADE\n*this beat*', font: 'Bebas Neue', size: 140, accentFont: 'UnifrakturMaguntia', accentColor: '#ff3fc8', accentGlow: 24 }],
    ['Word by word', { text: 'one word at a time', font: 'Archivo Black', size: 110, reveal: 'word', revealDur: 1.6 }],
    ['Beat lyrics', { text: 'A WORD ON EVERY BEAT', font: 'Bungee', size: 110, reveal: 'beat' }],
    ['Typewriter', { text: 'typing...', font: 'VT323', size: 120, caps: false, reveal: 'char', revealDur: 1.5 }],
    ['Gradient', { text: 'GRADIENT', font: 'Rubik Mono One', size: 130, fillc: C.fill('#ff3fc8', '#38c8ff', { angle: 90, anim: 'flow', speed: 0.6 }) }],
    ['Neon', { text: 'NEON', font: 'Monoton', size: 160, fillc: C.fill('#ffffff'), glow: 30, glowColor: '#ff3fc8' }]
  ];
  EP.panel_text = function (p) {
    var self = this;
    head(p, 'Text', 'click to add · drag onto the video');
    var g = h('div', { class: 'se-grid wide' });
    TEXT_PRESETS.forEach(function (tp) {
      var b = tile('', tp[0], 'k-text'); b.querySelector('i').textContent = 'Aa'; b.querySelector('i').style.fontFamily = '"' + tp[1].font + '"'; C.ensureFont(tp[1].font);
      if (tp[1].fillc) b.querySelector('i').style.cssText += ';background:' + fillCss(tp[1].fillc) + ';-webkit-background-clip:text;background-clip:text;color:transparent';
      b.addEventListener('click', function () { self.addElement('text', clone(tp[1]), { t: self.t }); });
      drag(b, { what: 'el', type: 'text', props: tp[1] }); g.appendChild(b);
    });
    p.appendChild(g);
    var fl = this.fontList(), cur = this.cur(), isText = cur && cur.type === 'text';
    var fh = h('div', { class: 'se-fh' }, 'Fonts <small>' + (isText ? 'click = change the selected text' : 'click = new text in that font') + '</small>'); p.appendChild(fh);
    var uf = h('button', { type: 'button', class: 'se-btn' }, '⬆ Upload your own font (.ttf .otf .woff)'); uf.addEventListener('click', function () { self.pick('.ttf,.otf,.woff,.woff2'); }); p.appendChild(uf);
    [['My fonts', fl.mine], ['Site fonts', fl.site], ['Free fonts', fl.free]].forEach(function (grp) {
      if (!grp[1].length) return; p.appendChild(h('div', { class: 'se-fh' }, E(grp[0])));
      var fg = h('div', { class: 'se-fonts' });
      grp[1].forEach(function (f) {
        if (grp[0] === 'Free fonts') C.ensureFont(f);
        var b = h('button', { type: 'button', class: isText && cur.font === f ? 'on' : '', title: f }, '<b style="font-family:\'' + E(f).replace(/'/g, '') + '\', sans-serif">Aa Bb 123</b><small>' + E(f) + '</small>');
        b.addEventListener('click', function () { var c = self.cur(); if (c && c.type === 'text') { c.font = f; C.ensureFont(f, c.weight || 400).then(self.redraw.bind(self)); self.changed({ insp: true }); self.renderPanel(); } else self.addElement('text', { text: 'YOUR TEXT', font: f }, { t: self.t }); });
        drag(b, { what: 'el', type: 'text', props: { text: 'YOUR TEXT', font: f } }); fg.appendChild(b);
      });
      p.appendChild(fg);
    });
  };
  var ELEMENTS = [
    ['MIDI visuals (your melody & drums)', [['pianoroll', 'Piano roll', {}], ['pianoroll', 'Scrolling roll', { mode: 'scroll', noteFill: C.fill('#38c8ff', '#ff3fc8', { by: 'pitch', anim: 'flow' }), panel: false, label: '' }], ['stepgrid', 'Drum grid', {}], ['falling', 'Falling notes', {}], ['falling', 'Rising notes', { direction: 'up' }], ['noteburst', 'Note bursts', {}], ['noteburst', 'Sparks', { style: 'sparks' }], ['noteburst', 'Hearts', { style: 'hearts', layout: 'random' }], ['plugin', 'Synth panel', {}]]],
    ['Audio visuals (move with the song)', [['spectrum', 'Bars', {}], ['spectrum', 'Circle', { style: 'circle', bands: 64, w: 700, h: 700 }], ['spectrum', 'Line', { style: 'line' }], ['spectrum', 'Mirror', { mirror: true }], ['waveform', 'Waveform', {}], ['waveform', 'Oscilloscope', { style: 'scope', bg: '#120d18' }], ['player', 'Retro player', {}], ['progress', 'Progress bar', {}], ['timer', 'Time', {}]]],
    ['Shapes & extras', [['shape', 'Rectangle', {}], ['shape', 'Circle', { kind: 'circle' }], ['shape', 'Star', { kind: 'star', fillc: C.fill('#ffe14d') }], ['shape', 'Heart', { kind: 'heart' }], ['shape', 'Sparkle', { kind: 'sparkle', fillc: C.fill('#ffffff') }], ['shape', 'Arrow', { kind: 'arrow', w: 300, h: 160 }], ['sparkles', 'Sparkles', {}], ['adjust', 'Adjustment layer', {}]]]
  ];
  EP.panel_elements = function (p) {
    var self = this; head(p, 'Visuals', 'click to add · drag onto the video');
    ELEMENTS.forEach(function (grp) {
      p.appendChild(h('div', { class: 'se-fh' }, E(grp[0])));
      var g = h('div', { class: 'se-grid' });
      grp[1].forEach(function (it) { var b = tile(T[it[0]].icon, it[1], 'k-' + it[0]); b.addEventListener('click', function () { var el = self.addElement(it[0], clone(it[2]), { t: self.t }); if (it[0] === 'adjust') { self.insTab = 'fx'; self.renderInspector(); } void el; }); drag(b, { what: 'el', type: it[0], props: it[2] }); g.appendChild(b); });
      p.appendChild(g);
    });
  };
  var FX_ICON = { blur: '◌', glow: '✺', rgb: '▤', glitch: '▚', shake: '≋', zoomblur: '◎', dirblur: '➠', pixelate: '▦', mirror: '◧', kaleido: '✳', wave: '∿', bw: '◑', sepia: '☕', invert: '◐', hue: '🌈', adjust: '☀', tint: '🎨', gradmap: '▨', vignette: '◉', grain: '░', scanlines: '☰', vhs: '📼', lightleak: '☼', strobe: '⚡', outline: '▢', shadow: '▣', letterbox: '▭', zoompulse: '⊕' };
  EP.panel_effects = function (p) {
    var self = this, cur = this.cur();
    head(p, 'Effects', cur ? 'click = add to “' + (cur.name || T[cur.type].label) + '”' : 'click = new adjustment layer');
    p.appendChild(h('p', { class: 'se-help' }, 'Drag an effect onto a clip (in the video or the timeline). Drop it on empty space — or click with nothing selected — to make an adjustment layer that changes everything under it.'));
    C.FX_CATS.forEach(function (cat) {
      p.appendChild(h('div', { class: 'se-fh' }, E(cat)));
      var g = h('div', { class: 'se-grid' });
      Object.keys(C.FX).filter(function (k) { return C.FX[k].cat === cat; }).forEach(function (k) { var b = tile(FX_ICON[k] || '✨', C.FX[k].name, 'k-fx'); b.addEventListener('click', function () { self.applyFx(k, self.cur()); }); drag(b, { what: 'fx', type: k }); g.appendChild(b); });
      p.appendChild(g);
    });
  };
  var AN_ICON = { fade: '◌', 'zoom-in': '⊕', 'zoom-out': '⊖', pop: '✸', elastic: '〰', drop: '⤓', rise: '⤒', 'slide-up': '↑', 'slide-down': '↓', 'slide-left': '←', 'slide-right': '→', spin: '↻', 'spin-zoom': '🌀', 'flip-x': '⇋', 'flip-y': '⇵', swing: '⌒', stretch: '⟷', squash: '⇕', blur: '◍', glitch: '▚', pixel: '▦', flash: '⚡', shake: '≋', 'wipe-left': '◧', 'wipe-right': '◨', 'wipe-up': '⬒', 'wipe-down': '⬓', tilt: '⟋', whip: '💨', 'beat-bounce': '⤊', 'beat-zoom': '⊕', 'beat-jump': '⇡', 'beat-shake': '≋', 'beat-tilt': '⟋', 'beat-flash': '⚡', pulse: '❤', heartbeat: '💓', breathe: '◌', float: '☁', orbit: '◎', sway: '〜', wiggle: '∿', jelly: '◍', blink: '◐', flicker: '✧' };
  EP.panel_anims = function (p) {
    var self = this, cur = this.cur(), slot = this.animSlot || 'in';
    head(p, 'Animations', cur ? 'click = put on “' + (cur.name || T[cur.type].label) + '”' : 'select something, or drag onto it');
    p.appendChild(chips([['in', 'In'], ['out', 'Out'], ['loop', 'Loop']], slot, function (v) { self.animSlot = v; self.renderPanel(); }));
    var g = h('div', { class: 'se-grid' }), list = slot === 'loop' ? C.LOOP_ANIMS : C.IN_ANIMS;
    list.forEach(function (a) {
      var on = cur && cur.anim && cur.anim[slot] && cur.anim[slot].type === a[0];
      var b = tile(a[0] === 'none' ? '⊘' : (AN_ICON[a[0]] || AN_ICON[a[0].replace(/^beat-/, '')] || '✦'), a[1], 'k-anim an-' + a[0] + (on ? ' on' : ''));
      b.addEventListener('click', function () { var c = self.cur(); if (!c) return self.toast('Select something in the video first (or drag the animation onto it)', true); self.applyAnim(c, slot, a[0]); self.renderPanel(); });
      drag(b, { what: 'anim', slot: slot, type: a[0] }); g.appendChild(b);
    });
    p.appendChild(g);
    p.appendChild(h('p', { class: 'se-help' }, 'Change the time, strength and easing curve in the Animate tab on the right.'));
  };
  var TR_ICON = { flash: '⚡', bounce: '⤊', zoom: '⊕', shake: '≋', glitch: '▚', whip: '💨', spin: '↻', 'fade-black': '◼', 'fade-white': '◻', blur: '◌', rgb: '▤' };
  EP.panel_trans = function (p) {
    var self = this; head(p, 'Transitions', 'click = add at the playhead');
    p.appendChild(h('p', { class: 'se-help' }, 'Transitions are quick hits on the whole video (great on a beat drop). Drag them onto the timeline, then drag the ⚡ markers to move them.'));
    var g = h('div', { class: 'se-grid' });
    C.TRANSITIONS.forEach(function (t) { var b = tile(TR_ICON[t[0]] || '⚡', t[1], 'k-trans'); b.addEventListener('click', function () { self.addTransition(t[0]); }); drag(b, { what: 'trans', type: t[0] }); g.appendChild(b); });
    p.appendChild(g);
  };
  EP.templateList = function () {
    var ec = this.cfg.editor || {}, hidden = ec.hiddenTemplates || [], list = [];
    (ec.templates || []).forEach(function (t, i) { if (t && t.json && t.enabled !== false) list.push({ id: t.id || 'c' + i, name: t.name || 'Template', desc: t.desc || '', thumb: t.thumb, json: t.json }); });
    C.TEMPLATES.forEach(function (t) { if (hidden.indexOf(t.id) < 0) list.push({ id: t.id, name: t.name, desc: t.desc, build: t.build }); });
    return list;
  };
  EP.panel_templates = function (p) {
    var self = this; head(p, 'Templates', 'start from one, then change anything');
    var g = h('div', { class: 'se-tpls' });
    this.templateList().forEach(function (t) {
      var b = h('button', { type: 'button', class: 'se-tpl' }, '<div class="se-tplpic"></div><b>' + E(t.name) + '</b><small>' + E(t.desc || '') + '</small>');
      var pic = b.querySelector('.se-tplpic');
      if (t.thumb) { var im = h('img', { alt: '', loading: 'lazy' }); im.src = (self.api.asset && self.api.asset(t.thumb)) || t.thumb; pic.appendChild(im); }
      else { try { var P0 = t.build ? t.build() : C.upgrade(clone(t.json)), cv = C.mk(108, Math.round(108 * P0.h / P0.w)); pic.appendChild(cv); setTimeout(function () { try { C.renderFrame(cv, P0, { t: Math.min(2.5, P0.duration * 0.4), P: P0, notes: C.midiNotes({ midis: [{ id: 'd', mode: 'project', offset: P0.beatOffset || 0 }], bpm: P0.bpm }, { d: C.demoMidi(P0.bpm) }), an: null, media: self.mediaFn(), edit: false }); } catch (e) { } }, 30); } catch (e) { } }
      b.addEventListener('click', function () { self.useTemplate(t); });
      g.appendChild(b);
    });
    p.appendChild(g);
    p.appendChild(h('p', { class: 'se-help' }, 'Using a template starts a new project — your current one stays saved in 📁 Projects.'));
  };
  EP.useTemplate = function (t) {
    var self = this, P0 = t.build ? t.build() : C.upgrade(clone(t.json));
    P0.id = C.uid('p'); P0.name = t.name;
    var go = function () {
      var keep = self.P && (self.P.layers.length || self.P.audio.length) && !self.opts.builder ? self.saveLocal() : Promise.resolve();
      keep.then(function () { return self.load(P0, true); }).then(function () {
        var slots = P0.layers.some(function (l) { return l.replaceable; });
        self.tab = slots ? 'replace' : 'media'; self.renderPanel(); self.seek(Math.min(2.5, P0.duration * 0.4));
        self.toast(slots ? 'Template ready ✦ — replace the slots on the left' : 'Template ready ✦ — click anything to change it');
      });
    };
    if (this.opts.builder && this.P.layers.length && !confirm('Replace what\'s in the template maker with “' + t.name + '”?')) return;
    go();
  };
  EP.panel_replace = function (p) {
    var self = this, P = this.P; head(p, 'Replace', 'make this template yours');
    var slots = P.layers.filter(function (l) { return l.replaceable; });
    if (!slots.length) { p.appendChild(h('p', { class: 'se-help' }, 'This project has no template slots. Select something and switch on “Template slot” to make one.')); }
    slots.forEach(function (el) {
      var card = h('div', { class: 'se-slot' + (self.sel === el.id ? ' on' : '') }), rec = el.media && self.media[el.media];
      card.innerHTML = '<div class="se-slotpic">' + (rec && rec.thumb ? '<img alt="">' : '<i>' + T[el.type].icon + '</i>') + '</div><div><b>' + E(el.slotName || el.name || T[el.type].label) + '</b><small>' + U.fmt(el.start) + ' → ' + U.fmt(el.end) + '</small></div>';
      if (rec && rec.thumb) card.querySelector('img').src = rec.thumb;
      card.addEventListener('click', function (e) { if (e.target.closest('button,textarea')) return; self.select('layer', el.id); self.seek(Math.min(el.end - 0.01, el.start + 0.6)); self.renderPanel(); });
      if (el.type === 'image' || el.type === 'video') {
        var b = h('button', { type: 'button', class: 'se-btn' }, '⇄ Replace'); b.addEventListener('click', function () { self.pick('image/*,video/*', function (f) { self.importFile(f[0]).then(function (r) { if (r && (r.kind === 'image' || r.kind === 'video')) { self.replaceInto(el, r.id, r.kind); self.renderPanel(); } }); }, false); });
        card.appendChild(b);
        card.addEventListener('dragover', function (e) { e.preventDefault(); card.classList.add('drop'); }); card.addEventListener('dragleave', function () { card.classList.remove('drop'); });
        card.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); card.classList.remove('drop'); self.handleDrop(e.dataTransfer, { t: self.t }, el); });
      } else if (el.type === 'text') {
        var ta = h('textarea', { rows: '2' }); ta.value = el.text || ''; ta.addEventListener('input', function () { el.text = ta.value; self.needs = true; }); ta.addEventListener('change', function () { self.changed({ tl: true, insp: true }); }); card.appendChild(ta);
      } else { var eb = h('button', { type: 'button', class: 'se-btn' }, '✎ Edit'); eb.addEventListener('click', function () { self.select('layer', el.id); }); card.appendChild(eb); }
      p.appendChild(card);
    });
    var texts = P.layers.filter(function (l) { return l.type === 'text' && !l.replaceable; });
    if (texts.length) {
      p.appendChild(h('div', { class: 'se-fh' }, 'All text'));
      texts.forEach(function (el) { var ta = h('textarea', { rows: '2', class: 'se-qtext' }); ta.value = el.text || ''; ta.addEventListener('focus', function () { self.select('layer', el.id); if (self.t < el.start || self.t >= el.end) self.seek(el.start + 0.6); }); ta.addEventListener('input', function () { el.text = ta.value; self.needs = true; }); ta.addEventListener('change', function () { self.changed({ tl: true, insp: true }); }); p.appendChild(ta); });
    }
    var sb = h('button', { type: 'button', class: 'se-big' }, P.audio.length ? '🎵 Replace the song' : '🎵 Add your song');
    sb.addEventListener('click', function () { self.pick('audio/*,video/*', function (f) { self.importFile(f[0]).then(function (r) { if (!r) return; var old = P.audio[0]; if (old) { old.media = r.id; old.name = P.media[r.id].name; old.in = 0; old.dur = round(Math.min(P.media[r.id].dur || old.dur, P.autoLength ? 1e9 : Math.max(1, P.duration - old.start)), 3); self.changed({ tl: true, audio: true }); self.detectBpm(true); self.toast('Song replaced ✓'); } else self.placeMedia(r.id, 'audio', { t: 0 }); self.renderPanel(); }); }, false); });
    p.appendChild(sb);
    var mb = h('button', { type: 'button', class: 'se-big' }, '🎹 ' + (P.midis.length ? 'Add / replace MIDI' : 'Add your MIDI'));
    mb.addEventListener('click', function () { self.pick('.mid,.midi', function (f) { self.importFile(f[0]).then(function (r) { if (!r) return; if (P.midis.length && confirm('Replace the MIDI that\'s there now?')) P.midis = []; self.placeMedia(r.id, 'midi', { t: 0 }); self.renderPanel(); }); }, false); });
    p.appendChild(mb);
  };
  EP.panel_textures = function (p) {
    var self = this, ec = this.cfg.editor || {}, tc = this.cfg.tools || {}, list = [];
    (ec.textures || []).forEach(function (t) { if (t && t.src && t.enabled !== false) list.push({ src: t.src, name: t.name }); });
    if (ec.useToolTextures !== false) (tc.textures || []).forEach(function (t) { if (t && t.src && t.enabled !== false) list.push({ src: t.src, name: t.name }); });
    var hiddenB = Array.isArray(tc.hiddenTextures) ? tc.hiddenTextures : [];
    if (window.PixFX && ec.builtinTextures !== false) PixFX.BUILTIN_TEX.forEach(function (b) { if (hiddenB.indexOf(b[0]) < 0) list.push({ name: b[1], builtin: b[0] }); });
    head(p, 'Textures', 'click = add as a layer over everything');
    if (!list.length) p.appendChild(h('p', { class: 'se-help' }, 'No textures yet.'));
    var g = h('div', { class: 'se-grid' });
    list.forEach(function (t) {
      var b = tile('', t.name || '', 'img k-tex');
      if (t.builtin) { try { b.style.backgroundImage = 'url("' + PixFX.builtinTexture(t.builtin, 96, 96).toDataURL() + '")'; } catch (e) { } } else b.style.backgroundImage = 'url("' + ((self.api.asset && self.api.asset(t.src)) || t.src) + '")';
      b.addEventListener('click', function () { self.addTexture(t, self.t); });
      drag(b, { what: 'texture', src: t.src, name: t.name, builtin: t.builtin }); g.appendChild(b);
    });
    p.appendChild(g);
    p.appendChild(h('p', { class: 'se-help' }, 'A texture becomes a normal layer: change its blend mode, opacity, timing and effects like anything else.'));
  };
  EP.panel_canvas = function (p) { head(p, 'Canvas', 'shape, length, background, camera'); this.projectForm(p); };
  EP.panel_replace_hidden = null;
})();
