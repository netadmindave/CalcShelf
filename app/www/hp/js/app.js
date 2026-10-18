/*
 * HP 48SX, 48GX, 49G and 49g+ — the Emu48 core (GPL-2.0) running HP's own ROMs, which HP allows
 * to be freely distributed for use with emulators. Touch keypads laid out like the real calculators.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const bridge = window.TiBridge || (window.parent && window.parent !== window && window.parent.TiBridge) || null;
  const MODEL = (() => { const m = new URLSearchParams(location.search).get('model'); return HPLAYOUTS[m] ? m : '48gx'; })();
  const L = HPLAYOUTS[MODEL];
  const is49 = L.family === '49';

  /* ------------------------------------------------------------------ storage & helpers */
  const DB = {
    db: null,
    open() { return new Promise((res) => { let r; try { r = indexedDB.open('hp4849', 1); } catch (e) { return res(null); } r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => res(null); }); },
    get(k) { return new Promise((res) => { if (!this.db) return res(undefined); try { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
    setMany(pairs) { return new Promise((res) => { if (!this.db) return res(false); try { const t = this.db.transaction('kv', 'readwrite'); const s = t.objectStore('kv'); for (const [k, v] of pairs) { if (v == null) s.delete(k); else s.put(v, k); } t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); },
    set(k, v) { return this.setMany([[k, v]]); },
  };
  const DEFAULTS = { lcd: 'stn', speed: 1 };
  let S = { ...DEFAULTS };
  const saveSettings = () => DB.set('settings', S);
  let toastTimer = 0;
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }
  function haptic() { /* key vibration was removed in 2.7 */ }
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function saveBytes(name, bytes, mime) {
    if (bridge && bridge.saveFile) { toast(bridge.saveFile(name, b64(bytes), mime) || 'Saved ' + name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function gz(bytes) { const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
  async function gunz(bytes) { const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }

  /* ------------------------------------------------------------------ keys and the key queue */
  const allKeys = () => [...(L.fkeys || []), ...L.top.flat(), ...Object.values(L.arrows || {}), ...L.bottom.flat()];
  const KEY = {}; for (const k of allKeys()) KEY[k.id] = k.k;                     // id -> [out, in]
  const ID = {}; for (const k of allKeys()) ID[k.t === 'lshift' ? 'LS' : k.t === 'rshift' ? 'RS' : k.t === 'alpha' ? 'AL' : (k.t === 'nav' && is49 ? 'nav' + k.p : k.p)] = k.id;
  if (is49) { ID['◀'] = L.arrows.left.id; ID['▶'] = L.arrows.right.id; ID['▲'] = L.arrows.up.id; ID['▼'] = L.arrows.down.id; }
  const LETTER = {}; for (const k of allKeys()) if (k.a) LETTER[k.a] = k.id;

  let core = null, changed = true;
  const q = [];            // {down:id} {up:id} {wait:µs}
  let waitUs = 0;
  const GAP = is49 ? 130000 : 60000;     // the 49s need a longer pause to see a repeated key (α α) as two presses
  function tapSeq(ids, holdUs = 70000) { for (const id of ids) if (id !== undefined) q.push({ down: id }, { wait: holdUs }, { up: id }, { wait: GAP }); }
  function serviceQueue(budgetUs) {     // returns the emulated µs spent in waits
    let used = 0;
    while (q.length) {
      const h = q[0];
      if ('wait' in h) {
        const n = Math.min(h.wait - waitUs, budgetUs - used);
        if (n > 0) { core.run(n); used += n; waitUs += n; }
        if (waitUs >= h.wait) { q.shift(); waitUs = 0; continue; }
        break;
      }
      q.shift(); core.key(KEY['down' in h ? h.down : h.up], 'down' in h); changed = true;
    }
    return used;
  }

  async function start() {
    const [wasm, romFile] = await Promise.all([fetch('core/hp48.wasm').then((r) => r.arrayBuffer()), fetch('rom/' + L.rom).then((r) => r.arrayBuffer())]);
    core = await HP48Core.create(wasm);
    let rom = new Uint8Array(romFile), flashSaved = false;
    const fl = await DB.get('flash:' + MODEL);
    if (fl instanceof Uint8Array) { try { rom = await gunz(fl); flashSaved = true; } catch (e) { console.warn('flash', e); } }
    if (!core.loadRom(rom, L.type, L.cls)) throw new Error('the ROM could not be loaded');
    const st = await DB.get('state:' + MODEL);
    let resumed = false;
    if (st instanceof Uint8Array) { try { resumed = core.loadState(await gunz(st)); } catch (e) { console.warn('state', e); } }
    if (!resumed) {
      core.newCalc();
      // a new calculator asks "Try To Recover Memory?" — answer NO (the F key)
      for (let i = 0; i < 25; i++) core.run(100000);
      tapSeq([16]);
      if (is49) q.push({ wait: 1500000 }), tapSeq([ID.ON]);   // and dismiss the 49's "Memory Clear" box
      setTimeout(() => toast('A fresh ' + L.name + ' (Memory Clear). Everything you do is kept.', 3500), 600);
    }
    if (flashSaved) core.flashDirty(true);
  }

  /* ------------------------------------------------------------------ display */
  const canvas = $('#screen'), ctx = canvas.getContext('2d');
  let img = null, sc = 1, lastSerial = -1, lastAnn = -1, COL = null;
  function lcdColors() {
    const cs = getComputedStyle($('#lcd'));
    const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    return { bg: hex(cs.getPropertyValue('--lcd-bg')), ink: hex(cs.getPropertyValue('--lcd-ink')) };
  }
  function layout() {
    const rows = core ? core.rows : L.lcd, wrap = $('#lcd'), dpr = window.devicePixelRatio || 1;
    wrap.style.setProperty('--ar', (131 / (rows + 9)).toFixed(4));
    const r = wrap.getBoundingClientRect();
    const avail = Math.max(131, Math.min((r.width - 14) * dpr, (r.height - 20) * dpr * 131 / rows));
    sc = Math.max(1, Math.floor(avail / 131));
    canvas.width = 131 * sc; canvas.height = rows * sc;
    canvas.style.width = canvas.width / dpr + 'px'; canvas.style.height = canvas.height / dpr + 'px';
    img = ctx.createImageData(canvas.width, canvas.height); COL = lcdColors(); lastSerial = -1;
  }
  function draw() {
    if (!core || !img) return;
    const rows = core.rows, px = core.lcd(), off = core.boffset, on = core.displayOn;
    // contrast 0..31 → ink strength (Emu48's KML colour ramps reach full black around 11–14)
    const c = core.contrast, t = on ? Math.max(0.15, Math.min(1, (c - (L.type === 'S' ? 0 : 3)) / 11)) : 0;
    const bg = COL.bg, ink = COL.ink.map((v, i) => Math.round(bg[i] + (v - bg[i]) * t)), mid = ink.map((v, i) => (v + bg[i]) >> 1);
    const d = img.data, W = canvas.width, gap = sc >= 4;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < 131; x++) {
        const lit = px[y * 144 + x + off];
        for (let yy = 0; yy < sc; yy++) {
          let o = ((y * sc + yy) * W + x * sc) * 4;
          for (let xx = 0; xx < sc; xx++, o += 4) {
            const v = !lit ? bg : gap && (xx === sc - 1 || yy === sc - 1) ? mid : ink;
            d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!is49) drawSoftkeys(px, rows, off, on);
    $('#lcd-off').hidden = on;
  }
  /* the 48's A–F keys are blank on the real calculator; here each one shows its menu label from the screen's bottom row */
  let soft = null;
  function drawSoftkeys(px, rows, off, on) {
    if (!soft) {
      soft = [];
      for (const b of keyEls) if (b._def.t === 'menu') {
        const c = document.createElement('canvas'); c.width = 21 * 3; c.height = 7 * 3; c.className = 'soft';
        b.querySelector('.face').appendChild(c); soft.push(c);
      }
    }
    const y0 = rows - 8;
    soft.forEach((c, i) => {
      const x0 = i * 22, g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      if (!on) return;
      let lit = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 21; x++) lit += px[(y0 + y) * 144 + x0 + x + off] ? 1 : 0;
      if (lit < 40) return;                           // no label here (labels are white text in a black box)
      g.fillStyle = '#1F242B';
      for (let y = 1; y < 8; y++) for (let x = 0; x < 21; x++) if (!px[(y0 + y) * 144 + x0 + x + off]) g.fillRect(x * 3, (y - 1) * 3, 3, 3);   // row 0 is the box's top edge
    });
  }
  const ANN = ['◀', '▶', 'α', '🔋︎', '⌛︎', '⇄'];
  function drawAnn(a) {
    const el = $('#ann'); if (!el.children.length) for (const s of ANN) { const e = document.createElement('span'); e.textContent = s; el.appendChild(e); }
    [...el.children].forEach((e, i) => e.classList.toggle('on', !!(a & (1 << i))));
    relabel(a & 1 ? 'l' : a & 2 ? 'r' : null, !!(a & 4));
    $('#status').innerHTML = (a & 1 ? '<span class="m m-l">◀ shift</span> ' : a & 2 ? '<span class="m m-r">▶ shift</span> ' : '') + (a & 4 ? '<span class="m m-a">α</span>' : '');
  }

  /* ------------------------------------------------------------------ keypad */
  const keyEls = [];
  let shown = null;
  function buildKey(d) {
    const b = document.createElement('button');
    b.className = 'key ' + (d.t || '') + (d.p.length >= 3 && !/^[0-9]$/.test(d.p) ? ' word' : '') + (d.p.length >= 5 ? ' long' : '');
    b.innerHTML = '<span class="lg"><span class="s"></span><span class="d"></span></span><span class="face"></span><span class="a"></span>';
    b.querySelector('.s').textContent = d.l || ''; b.querySelector('.d').textContent = d.r || '';
    b.querySelector('.a').textContent = d.a || ''; b.querySelector('.face').textContent = d.p;
    if (!d.l && !d.r) b.classList.add('nolg');
    b.dataset.id = d.id;
    b.setAttribute('aria-label', (d.p || ('menu key ' + d.a)) + (d.l ? ', left shift ' + d.l : '') + (d.r ? ', right shift ' + d.r : ''));
    b._def = d; keyEls.push(b); attach(b);
    return b;
  }
  function relabel(m, alpha) {
    const tag = (m || '') + (alpha ? 'a' : '');
    if (tag === shown) return; shown = tag;
    const pad = $('#pad'); if (m || alpha) pad.dataset.mode = m || 'a'; else delete pad.dataset.mode;
    for (const b of keyEls) {
      const d = b._def, face = b.querySelector('.face');
      if (d.t === 'menu') continue;                   // keeps its softkey label
      if (['lshift', 'rshift', 'alpha'].includes(d.t)) { b.classList.toggle('latched', (m === 'l' && d.t === 'lshift') || (m === 'r' && d.t === 'rshift') || (alpha && d.t === 'alpha')); continue; }
      const alt = m === 'l' ? d.l : m === 'r' ? d.r : alpha ? (d.a ? d.a : null) : null;
      const keep = d.t === 'nav' || d.t === 'menu' || d.t === 'on' || d.t === 'enter' || (alpha && !m && (d.t === 'num' || d.p === '⌫' || d.p === 'SPC'));
      b.classList.toggle('has-alt', !!alt); b.classList.toggle('no-alt', !!((m || alpha) && !alt && !keep));
      face.textContent = alt || d.p;
      b.classList.toggle('long-alt', !!(alt && alt.length > 5));
    }
  }
  function grid(cls, cols, rows) { const g = document.createElement('div'); g.className = 'hpgrid ' + cls; g.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)'; if (rows) g.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)'; return g; }
  function buildPad() {
    const pad = $('#pad'); pad.innerHTML = ''; keyEls.length = 0;
    document.body.dataset.family = L.family;
    if (!is49) {
      const g1 = grid('g-top', 6, 5);
      for (const row of L.top) for (const d of row) { const b = buildKey(d); if (d.w > 1) b.style.gridColumn = 'span ' + d.w; g1.appendChild(b); }
      const g2 = grid('g-bot', 5, 4);
      for (const row of L.bottom) for (const d of row) g2.appendChild(buildKey(d));
      pad.append(g1, g2);
    } else {
      const f = grid('g-f', 6, 1); for (const d of L.fkeys) f.appendChild(buildKey(d));
      const mid = document.createElement('div'); mid.className = 'g-mid';
      const left = grid('g-apps', 3, 2); for (const row of L.top) for (const d of row) left.appendChild(buildKey(d));
      const ar = document.createElement('div'); ar.className = 'hparrows';
      for (const dir of ['up', 'left', 'right', 'down']) { const b = buildKey(L.arrows[dir]); b.classList.add('ar-' + dir); ar.appendChild(b); }
      mid.append(left, ar);
      const g2 = grid('g-bot', 5, 7); for (const row of L.bottom) for (const d of row) g2.appendChild(buildKey(d));
      pad.append(f, mid, g2);
    }
  }
  /** left/right shift (or alpha) and then the key; a shift that is already on is not pressed again */
  function shifted(m, d) {
    const a = core.annun, cur = a & 1 ? 'l' : a & 2 ? 'r' : null;
    if (m === 'a') tapSeq([ID.AL, d.id]);
    else tapSeq(cur === m ? [d.id] : [m === 'l' ? ID.LS : ID.RS, d.id]);
    haptic();
  }
  function attach(b) {
    const d = b._def;
    const repeat = d.t === 'nav' || d.p === '⌫';
    let start = null, gesture = null, timer = 0, down = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); closePop(); try { b.setPointerCapture(e.pointerId); } catch (_) {}
      start = { x: e.clientX, y: e.clientY }; gesture = null; down = false; b.classList.add('pressed'); haptic();
      clearTimeout(timer);
      // holding: arrows and ⌫ repeat, menu keys show their full name, ON combinations work; other keys open the picker
      timer = setTimeout(() => {
        if (gesture || !start) return;
        if (repeat || (!d.l && !d.r) || d.t === 'menu' || d.t === 'on' || d.t === 'fn') { down = true; core.key(KEY[d.id], true); changed = true; }
        else { b.classList.remove('pressed'); start = null; openPop(b); }
      }, repeat ? 260 : 430);
    });
    b.addEventListener('pointermove', (e) => {
      if (!start || !false || down) return;
      const dy = e.clientY - start.y, dx = e.clientX - start.x; let g = null;
      if (dy < -20 && Math.abs(dy) > Math.abs(dx) && d.l) g = 'l';
      else if (dy > 20 && Math.abs(dy) > Math.abs(dx) && d.r) g = 'r';
      if (g !== gesture) {
        gesture = g; clearTimeout(timer);
        b.classList.toggle('preview-l', g === 'l'); b.classList.toggle('preview-r', g === 'r');
        if (d.t !== 'menu') b.querySelector('.face').textContent = g === 'l' ? d.l : g === 'r' ? d.r : d.p;
        if (g) haptic();
      }
    });
    const end = (cancel) => {
      clearTimeout(timer); b.classList.remove('pressed', 'preview-l', 'preview-r');
      if (down) { down = false; q.push({ wait: 30000 }, { up: d.id }); start = null; return; }
      if (!start) return; start = null; shown = '?'; lastAnn = -1;
      if (cancel) return;
      if (gesture) { shifted(gesture, d); return; }
      tapSeq([d.id]);
    };
    b.addEventListener('pointerup', () => end(false));
    b.addEventListener('pointercancel', () => end(true));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function openPop(b) {
    const d = b._def, p = $('#pop'); p.innerHTML = '';
    for (const [m, label, sub] of [[null, d.p, ''], ['l', d.l, '◀'], ['r', d.r, '▶'], ['a', d.a, 'α']]) {
      if (!label) continue;
      const o = document.createElement('button'); o.className = m ? 'p-' + m : '';
      o.innerHTML = '<span></span>' + (sub ? '<small></small>' : ''); o.firstChild.textContent = label; if (sub) o.lastChild.textContent = sub;
      o.onclick = () => { closePop(); if (m) shifted(m, d); else { tapSeq([d.id]); haptic(); } };
      p.appendChild(o);
    }
    p.hidden = false;
    const r = b.getBoundingClientRect(), pr = p.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2; left = Math.max(8, Math.min(window.innerWidth - pr.width - 8, left));
    let top = r.top - pr.height - 10; if (top < 8) top = r.bottom + 10;
    p.style.left = left + 'px'; p.style.top = top + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outside, { capture: true }), 0);
  }
  function outside(e) { if (!$('#pop').contains(e.target)) closePop(); }
  function closePop() { $('#pop').hidden = true; document.removeEventListener('pointerdown', outside, { capture: true }); }

  /* ------------------------------------------------------------------ typing: characters become key presses */
  function keysForChar(c) {
    const D = (p) => ID[p], LS = ID.LS, RS = ID.RS;
    if (/[0-9]/.test(c)) return [D(c)];
    switch (c) {
      case '.': return [D('.')];
      case '+': return [D('+')];
      case '-': case '−': return [D('−')];
      case '*': case '×': return [D('×')];
      case '/': case '÷': return [D('÷')];
      case '^': return [D('yˣ')];
      case ' ': return [D('SPC')];
      case '\n': return [D('ENTER')];
      case "'": return MODEL === '49g' ? [RS, D('EQW')] : [D("'")];
      case '(': return is49 ? [LS, D('−')] : [LS, D('÷')];
      case '[': return [LS, D('×')];
      case '{': return [LS, D('+')];
      case ')': case ']': case '}': return [D('▶')];
      case '=': return is49 ? [RS, D('+/−')] : [LS, D('0')];
      case ',': return is49 ? [RS, D('SPC')] : [LS, D('.')];
      case '"': return is49 ? [RS, D('×')] : [RS, D('−')];
      case '_': return is49 ? [RS, D('−')] : [RS, D('×')];
      case '#': return is49 ? [LS, D('3')] : [RS, D('÷')];
      case 'π': return [LS, D('SPC')];
      case '<': return is49 ? [RS, D('X')] : null;
      case '>': return is49 ? [RS, D('1/x')] : null;
      case '«': return is49 ? [RS, D('+')] : [LS, D('−')];
      case '»': return [D('▶')];
      default: return null;
    }
  }
  function typeText(text) {
    let alpha = false; const out = [];
    for (const c of text) {
      const up = c.toUpperCase();
      if (/[A-Za-z]/.test(c) && LETTER[up]) {
        if (!alpha) { out.push(ID.AL, ID.AL); alpha = true; }   // α α = alpha lock
        if (c !== up) out.push(ID.LS);                          // ◀ letter = lower case
        out.push(LETTER[up]); continue;
      }
      if (alpha && !/[0-9 ]/.test(c)) { out.push(ID.AL); alpha = false; }
      if (alpha && /[0-9]/.test(c)) { out.push(ID.AL); alpha = false; }
      const ks = keysForChar(c); if (ks) out.push(...ks);
    }
    if (alpha) out.push(ID.AL);
    tapSeq(out, 50000);
  }

  /* ------------------------------------------------------------------ sheets & menu */
  let openSheet = null;
  function showSheet(id) { closePop(); closeSheets(); $('#scrim').hidden = false; $(id).hidden = false; openSheet = id; if (id === '#sheet-type') setTimeout(() => $('#type-input').focus(), 60); if (id === '#sheet-menu') renderMenu(); }
  function closeSheets() { document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; }); $('#scrim').hidden = true; openSheet = null; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  function renderMenu() {
    document.querySelectorAll('#s-lcd button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.lcd));
    document.querySelectorAll('#s-speed button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === S.speed));
   
    $('#about').textContent = L.name + ' running HP’s own ROM (' + (is49 ? 'version 2.10' : L.type === 'S' ? 'version E' : 'version R') + ') on the Emu48 core by Sébastien Carlier and Christoph Gießelink, with the Saturn+ (49g+) support by Cyrille de Brébisson and Eric Rechlin (GPL v2). HP allows its 48 and 49 ROMs to be distributed for use with emulators.';
  }
  async function loadObjects(files) {
    for (const f of files) {
      const r = core.loadObject(new Uint8Array(await f.arrayBuffer())); changed = true;
      toast(r === 0 ? 'Put ' + f.name + ' on the stack' : r === 1 ? f.name + ' isn’t a valid object' : 'Not enough memory for ' + f.name);
    }
  }
  function bind() {
    $('#btn-type').onclick = () => showSheet('#sheet-type');
    $('#btn-menu').onclick = () => showSheet('#sheet-menu');
    $('#scrim').onclick = closeSheets;
    const send = () => { const v = $('#type-input').value; if (!v) return; typeText(v + ($('#type-autoenter').checked ? '\n' : '')); $('#type-input').value = ''; haptic(); };
    $('#type-send').onclick = send;
    $('#type-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } e.stopPropagation(); });
    $('#type-string').onclick = () => { const v = $('#type-input').value; if (!v) return; const r = core.loadObject(new TextEncoder().encode(v)); changed = true; $('#type-input').value = ''; closeSheets(); toast(r === 0 ? 'Put the text on the stack as a string' : 'Not enough memory'); };
    $('#m-load').onclick = () => $('#file-obj').click();
    $('#file-obj').onchange = async (e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; closeSheets(); await loadObjects(fs); };
    $('#m-shot').onclick = () => { closeSheets(); canvas.toBlob(async (b) => saveBytes(MODEL + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png', new Uint8Array(await b.arrayBuffer()), 'image/png'), 'image/png'); };
    $('#m-save').onclick = async () => { closeSheets(); await save(); toast('Saved'); };
    $('#m-reset').onclick = () => { closeSheets(); core.reset(); changed = true; toast('Restarted — memory is kept'); };
    $('#m-clear').onclick = async () => { if (!confirm('Erase everything on this ' + L.name + '? This is a Memory Clear.')) return; cleared = true; await DB.setMany([['state:' + MODEL, null], ['flash:' + MODEL, null]]); location.reload(); };
    document.querySelectorAll('#s-lcd button').forEach((b) => b.onclick = () => { S.lcd = b.dataset.v; applyLcd(); saveSettings(); renderMenu(); });
    document.querySelectorAll('#s-speed button').forEach((b) => b.onclick = () => { S.speed = Number(b.dataset.v); saveSettings(); renderMenu(); });
    window.addEventListener('resize', layout);
    const HW = { Enter: 'ENTER', Backspace: '⌫', ArrowUp: '▲', ArrowDown: '▼', ArrowLeft: '◀', ArrowRight: '▶', Escape: 'ON' };
    window.addEventListener('keydown', (e) => {
      if (openSheet || !core || e.ctrlKey || e.metaKey || e.altKey) return;
      const p = HW[e.key];
      if (p) { e.preventDefault(); tapSeq([ID[p]]); return; }
      if (e.key.length === 1) { e.preventDefault(); typeText(e.key); }
    });
  }
  function applyLcd() { const l = $('#lcd'); l.classList.remove('paper', 'night'); if (S.lcd !== 'stn') l.classList.add(S.lcd); COL = lcdColors(); lastSerial = -1; }

  /* ------------------------------------------------------------------ loop & persistence */
  let lastT = 0, lastSave = 0, cleared = false, dirtySince = false, saving = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!core) return;
    const dt = Math.min(100, now - (lastT || now)); lastT = now;
    const t0 = performance.now();
    let us = (dt || 16) * 1000 * (S.speed || 1);
    us -= serviceQueue(us);
    if (S.speed === 0) { let n = 0; while (performance.now() - t0 < 22 && !q.length) { if (!core.run(20000) && ++n > 2) break; } }
    else while (us > 0 && performance.now() - t0 < 20) { const n = Math.min(us, 20000); core.run(n); us -= n; }
    const ser = core.serial, a = core.annun;
    if (ser !== lastSerial || changed) { lastSerial = ser; changed = false; draw(); dirtySince = true; }
    if (a !== lastAnn) { lastAnn = a; drawAnn(a); }
    if (dirtySince && now - lastSave > 20000) { lastSave = now; save(); }
  }
  async function save() {
    if (!core || cleared || saving) return;
    saving = true;
    try {
      const pairs = [['state:' + MODEL, await gz(core.saveState())]];
      if (core.flashDirty(true) > 0) pairs.push(['flash:' + MODEL, await gz(core.flash())]);
      await DB.setMany(pairs); dirtySince = false;
    } catch (e) { console.warn('save', e); }
    saving = false;
  }
  window.__closeOverlay = () => { if (!$('#pop').hidden) { closePop(); return true; } if (openSheet) { closeSheets(); return true; } return false; };
  window.onAndroidPause = () => { save(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else lastT = 0; });
  window.addEventListener('pagehide', () => save());

  /* ---- embedded in CalcShelf: the main app chooses the model ---- */
  const EMBED = window.parent !== window;
  function emuBridge() {
    if (!EMBED) return;
    window.addEventListener('message', async (e) => {
      const d = e.data; if (!d || e.source !== window.parent) return;
      if (d.type === 'emu-save') { try { await save(); } catch (x) { /* ignore */ } window.parent.postMessage({ type: 'emu-saved', id: d.id }, '*'); }
      else if (d.type === 'emu-install') loadObjects([new File([d.bytes], d.name)]);
    });
    window.parent.postMessage({ type: 'emu-ready' }, '*');
  }

  async function main() {
    document.title = L.name;
    document.body.dataset.themeModel = 'hp' + MODEL;
    const r = document.documentElement.style; r.setProperty('--cl', L.colors[0]); r.setProperty('--cr', L.colors[1]);
    await DB.open();
    const st = await DB.get('settings'); if (st) S = { ...DEFAULTS, ...st };
    buildPad(); bind(); applyLcd();
    await start();
    layout(); draw(); drawAnn(core.annun);
    $('#type-input').placeholder = is49 ? "'X^2-1'" : '1 2 +';
    requestAnimationFrame(frame);
    window.__hp = { core: () => core, typeText, tapSeq, ID, KEY, save, model: MODEL, queue: () => q.length };
    emuBridge();
  }
  main().catch((e) => { console.error(e); toast('Could not start: ' + e.message, 10000); });
})();
