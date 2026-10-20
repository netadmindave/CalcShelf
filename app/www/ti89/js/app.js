/*
 * CalcShelf — app shell: emulation loop, touch keypad, typing, command palette,
 * files and persistence. GPL-3.0-or-later.
 */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const bridge = window.TiBridge || null;            // provided by the Android shell
  const K = Ti89.KEYS;
  // one calculator per slot: '89' (default, keeps the old keys), '92p', 'v200', '92'
  const SLOT = new URLSearchParams(location.search).get('slot') || '89';
  const SK = (k) => (SLOT === '89' ? k : SLOT + ':' + k);
  const SLOTNAME = { 89: 'TI-89 Titanium', '92p': 'TI-92 Plus', v200: 'Voyage 200', 92: 'TI-92' }[SLOT] || 'TI-89 Titanium';

  /* ------------------------------------------------------------------ storage */
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        let req;
        try { req = indexedDB.open('ti89touch', 1); } catch (e) { return res(null); }
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; res(this.db); };
        req.onerror = () => res(null);
      });
    },
    get(k) {
      return new Promise((res) => {
        if (!this.db) return res(undefined);
        try { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); }
        catch (e) { res(undefined); }
      });
    },
    set(k, v) {
      return new Promise((res) => {
        if (!this.db) return res(false);
        try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }
        catch (e) { res(false); }
      });
    },
    del(k) { return new Promise((res) => { if (!this.db) return res(); const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); }); },
  };

  const DEFAULTS = { lcd: 'stn', gray: true, grid: true, speed: 1, turbo: true, hist: [], lay92: 'skin' };
  let S = { ...DEFAULTS };
  const saveSettings = () => DB.set('settings', S);

  /* ------------------------------------------------------------------ helpers */
  let toastTimer = 0;
  function toast(msg, action, fn, ms = 2600) {
    const t = $('#toast'); t.textContent = msg;
    if (action) { const b = document.createElement('button'); b.textContent = action; b.onclick = () => { t.hidden = true; fn(); }; t.appendChild(b); }
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : ms);
  }
  function haptic() { /* key vibration was removed in 2.7 */ }
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function saveBytes(name, bytes, mime = 'application/octet-stream') {
    if (bridge && bridge.saveFile) { const r = bridge.saveFile(name, b64(bytes), mime); toast(r || ('Saved ' + name + ' to Downloads')); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = rej; r.readAsArrayBuffer(f); });

  /* ------------------------------------------------------------------ emulator */
  let core = null, running = false, lastT = 0, lastSave = 0, dirty = false;
  const queue = [];          // {t:'down'|'up'|'wait', k, ms}
  const typeQueue = [];

  function enqueueTap(keys) {
    for (const k of keys) { queue.push({ t: 'down', k }); queue.push({ t: 'wait', ms: 55 }); queue.push({ t: 'up', k }); queue.push({ t: 'wait', ms: 45 }); }
  }
  function keyDown(k) { queue.push({ t: 'down', k }); }
  function keyUp(k) { queue.push({ t: 'wait', ms: 40 }); queue.push({ t: 'up', k }); }

  function step(ms) {
    // process queued key events, emulating time in between
    let left = ms;
    while (left > 0) {
      const h = queue[0];
      if (!h) { core.run(left, S.speed); break; }
      if (h.t === 'down' || h.t === 'up') { core.key(h.k, h.t === 'down'); queue.shift(); dirty = true; continue; }
      const s = Math.min(h.ms, left, 10);
      core.run(s, h.ms > 0 ? 1 : S.speed);
      h.ms -= s; left -= s;
      if (h.ms <= 0) queue.shift();
    }
    // drain remaining zero-time events
    while (queue[0] && (queue[0].t !== 'wait')) { const h = queue.shift(); core.key(h.k, h.t === 'down'); }
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(50, now - (lastT || now)); lastT = now;
    if (typeQueue.length && !queue.length) { if (core.type(typeQueue[0])) typeQueue.shift(); }
    step(dt || 16);
    let scr = core.screen();
    if (scr.busy && S.turbo && !queue.length) {
      const t0 = performance.now();
      while (performance.now() - t0 < 9) { core.run(30, 1); }
      scr = core.screen();
    }
    if (scr.changed || forceDraw) draw(scr);
    if (now - lastSave > 45000 && dirty) { lastSave = now; dirty = false; saveState(true); }
  }

  /* ------------------------------------------------------------------ screen */
  const canvas = $('#screen'); const ctx = canvas.getContext('2d');
  let img = null, scale = 1, forceDraw = true, palette = null, W = 160, H = 100;
  function hexToRgb(h) { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function layoutScreen() {
    const lcd = $('#lcd'); const r = { width: lcd.clientWidth, height: lcd.clientHeight }; if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    const pad = 0.985;
    scale = Math.max(1, Math.floor(Math.min(r.width * pad * dpr / W, r.height * pad * dpr / H)));
    canvas.width = W * scale; canvas.height = H * scale;
    canvas.style.width = (canvas.width / dpr) + 'px'; canvas.style.height = (canvas.height / dpr) + 'px';
    if (skinOn) {   // Graph89 layout: fill the screen area (the canvas is drawn at the next integer scale and shown pixelated)
      const f = Math.min(r.width * 0.97 / W, r.height * 0.95 / H);
      scale = Math.max(1, Math.ceil(f * dpr)); canvas.width = W * scale; canvas.height = H * scale;
      canvas.style.width = W * f + 'px'; canvas.style.height = H * f + 'px';
    }
    img = ctx.createImageData(canvas.width, canvas.height);
    const cs = getComputedStyle(lcd);
    const bg = hexToRgb(cs.getPropertyValue('--lcd-bg')), ink = hexToRgb(cs.getPropertyValue('--lcd-ink'));
    palette = new Uint32Array(256);
    for (let v = 0; v < 256; v++) {
      const f = v / 255; const c = [0, 1, 2].map((i) => Math.round(bg[i] + (ink[i] - bg[i]) * f));
      palette[v] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
    }
    forceDraw = true;
  }
  function draw(scr) {
    forceDraw = false;
    $('#lcd-off').hidden = scr.on;
    if (!img) return;
    const px = scr.pixels, CW = canvas.width, out = new Uint32Array(img.data.buffer), s = scale;
    const grid = S.grid && s >= 4; const bgc = palette[0];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = scr.on ? palette[px[y * W + x]] : bgc;
        let o = (y * s) * CW + x * s;
        for (let j = 0; j < s; j++, o += CW) {
          if (grid && j === s - 1) { out.fill(blend(c, bgc), o, o + s); continue; }
          out.fill(c, o, o + s - (grid ? 1 : 0));
          if (grid) out[o + s - 1] = blend(c, bgc);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function blend(a, b) { // 55% toward background: soft pixel gaps
    const m = (x, y, sh) => ((((x >> sh) & 255) * 45 + ((y >> sh) & 255) * 55) / 100) | 0;
    return (255 << 24) | (m(a, b, 16) << 16) | (m(a, b, 8) << 8) | m(a, b, 0);
  }
  function screenshotPNG() {
    const c = document.createElement('canvas'); c.width = W * 4; c.height = H * 4; const x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(canvas, 0, 0, c.width, c.height);
    c.toBlob(async (b) => { const bytes = new Uint8Array(await b.arrayBuffer()); saveBytes(SLOTNAME.replace(/\W+/g, '').toLowerCase() + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png', bytes, 'image/png'); }, 'image/png');
  }

  /* ------------------------------------------------------------------ keypad */
  const pad = $('#pad');
  let mode = null;            // '2nd' | 'dia' | 'alpha' | 'shift' | null (mirrors the calculator's sticky modifiers)
  let alphaLock = false;
  const keyEls = [];
  const MODKEY = { '2nd': '2ND', dia: 'DIAMOND', alpha: 'ALPHA', shift: 'SHIFT' };

  function buildKey(def, extra = '') {
    const b = document.createElement('button');
    b.className = 'key ' + (def.t || '') + ' ' + extra;
    if (/^[a-z]{3,}|^sto|^on$/.test(def.p) && def.t !== 'var') b.classList.add('word');
    b.dataset.k = def.k;
    b.innerHTML = `<span class="lg"><span class="s"></span><span class="d"></span></span><span class="face"></span><span class="a"></span>`;
    b.querySelector('.s').textContent = def.s || '';
    b.querySelector('.d').textContent = def.d || '';
    b.querySelector('.a').textContent = def.a || '';
    b.querySelector('.face').textContent = def.p;
    b.setAttribute('aria-label', def.p);
    b._def = def; keyEls.push(b);
    if (def.t && def.t.startsWith('mod-')) b.classList.add('keep');
    attachKey(b);
    return b;
  }
  let PAD = KEYPAD, padPage = 'math', dkBound = false;
  function buildPad(layout) {
    if (layout) PAD = layout;
    keyEls.length = 0;
    const fr = $('#frow'), cg = $('#cgrid'), kg = $('#kgrid');
    fr.innerHTML = ''; cg.innerHTML = ''; kg.innerHTML = '';
    fr.style.gridTemplateColumns = 'repeat(' + PAD.fkeys.length + ', 1fr)';
    cg.style.gridTemplateColumns = 'repeat(' + PAD.cluster[0].length + ', 1fr)';
    PAD.fkeys.forEach((d) => fr.appendChild(buildKey(d, 'fk')));
    PAD.cluster.flat().forEach((d) => cg.appendChild(buildKey(d)));
    const pg = PAD.pages ? PAD.pages[padPage] : { cols: 5, rows: PAD.rows };
    kg.style.gridTemplateColumns = 'repeat(' + pg.cols + ', 1fr)';
    kg.style.gridTemplateRows = 'repeat(' + pg.rows.length + ', 1fr)';
    kg.dataset.page = PAD.pages ? padPage : '';
    pg.rows.flat().forEach((d) => { const b = buildKey(d); if (d.w) b.style.gridColumn = 'span ' + d.w; kg.appendChild(b); });
    if (!dkBound) { document.querySelectorAll('.dk').forEach(attachHold); dkBound = true; }
    setMode(mode);
  }
  /* ---- TI-92 Plus / TI-92 / Voyage 200 in Graph89's landscape layout ---- */
  const SKIN = SKIN92[SLOT === 'v200' ? 'v200' : '92p'];
  let skinOn = false;
  const skinWanted = () => is92();   // the TI-92 models are landscape only (the app turns the phone's screen)
  function buildSkin() {
    const LEG = SKINLEG92[SLOT === 'v200' ? 'v200' : SLOT === '92' ? '92' : '92p'];
    keyEls.length = 0; PAD = { fkeys: [], cluster: [[]] };
    let sk = $('#skin');
    if (!sk) {
      sk = document.createElement('div'); sk.id = 'skin'; $('#app').appendChild(sk);
      const tools = document.createElement('div'); tools.className = 'sk-tools ' + SKIN.tools[4]; tools.id = 'sk-tools'; sk.appendChild(tools);
    }
    sk.querySelectorAll('.key').forEach((k) => k.remove());
    const T = $('#sk-tools'), [tx, ty, tw, th] = SKIN.tools;
    Object.assign(T.style, { left: tx / SKIN.w * 100 + '%', top: ty / SKIN.h * 100 + '%', width: tw / SKIN.w * 100 + '%', height: th / SKIN.h * 100 + '%' });
    for (const id of ['btn-menu', 'btn-cmds', 'btn-type']) T.appendChild($('#' + id));
    const lcd = $('#lcd'), [x0, y0, x1, y1] = SKIN.screen; sk.appendChild(lcd); sk.appendChild($('#status'));
    Object.assign(lcd.style, { left: x0 / SKIN.w * 100 + '%', top: y0 / SKIN.h * 100 + '%', width: (x1 - x0) / SKIN.w * 100 + '%', height: (y1 - y0) / SKIN.h * 100 + '%' });
    for (const [k, x, y, w, h] of SKIN.keys) {
      const l = LEG[k]; if (!l) continue;
      const def = { k, p: l.p, s: l.s, d: l.d, a: l.a, t: l.t === 'letter' ? 'letter' : l.t, hold: l.t === 'arrow' || k === 'BACKSPACE' };
      const b = buildKey(def, 'sk sk-' + (l.t || 'plain'));
      if (!l.s && !l.d) b.classList.add('nolg');
      Object.assign(b.style, { left: x / SKIN.w * 100 + '%', top: y / SKIN.h * 100 + '%', width: w / SKIN.w * 100 + '%', height: h / SKIN.h * 100 + '%' });
      sk.appendChild(b);
    }
    skinOn = true; document.body.classList.add('skin');
    layoutSkin(); setMode(mode);
  }
  function unbuildSkin() {
    if (!skinOn) return;
    skinOn = false; document.body.classList.remove('skin', 'turned');
    $('.bar').append($('#btn-menu'), $('#status'), $('#btn-cmds'), $('#btn-type'));
    const lcd = $('#lcd'); lcd.removeAttribute('style'); lcd.style.setProperty('--ar', W / H); $('#lcd-wrap').appendChild(lcd);
    const sk = $('#skin'); if (sk) sk.querySelectorAll('.key').forEach((k) => k.remove());
  }
  function layoutSkin() {
    if (!skinOn) return;
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('turned', portrait);
    const cs = getComputedStyle($('#app'));
    const aw = (portrait ? window.innerHeight : window.innerWidth) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = (portrait ? window.innerWidth : window.innerHeight) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let sx = aw / SKIN.w, sy = ah / SKIN.h; const MAXR = 1.3;
    if (sx > sy * MAXR) sx = sy * MAXR; if (sy > sx * MAXR) sy = sx * MAXR;
    const sk = $('#skin'); sk.style.width = SKIN.w * sx + 'px'; sk.style.height = SKIN.h * sy + 'px';
    sk.style.setProperty('--u', Math.min(sx, sy) + 'px');
    layoutScreen();
  }
  function choosePad() {
    if (!core || !core.loaded) return;
    if (skinWanted()) { if (!skinOn) buildSkin(); else layoutSkin(); }
    else if (skinOn || !keyEls.length || PAD !== (is92() ? KEYPAD92 : KEYPAD)) { unbuildSkin(); padPage = 'math'; buildPad(is92() ? KEYPAD92 : KEYPAD); layoutScreen(); }
  }
  function altOf(def, m) {
    if (m === '2nd') return def.s; if (m === 'dia') return def.d;
    if (m === 'alpha') return def.a || (def.t === 'var' ? def.p : null);
    if (m === 'shift') return def.a ? def.a.toUpperCase() : (def.t === 'var' ? def.p.toUpperCase() : null);
    return null;
  }
  function setMode(m) {
    mode = m;
    const shown = m || (alphaLock ? 'alpha' : null);
    if (shown) pad.dataset.mode = shown === 'shift' ? 'alpha' : shown; else delete pad.dataset.mode;
    const skn = document.getElementById('skin'); if (skn) { if (shown) skn.dataset.mode = pad.dataset.mode; else delete skn.dataset.mode; }
    for (const b of keyEls) {
      const d = b._def, face = b.querySelector('.face');
      b.classList.remove('has-alt', 'no-alt', 'long-alt', 'latched');
      if (b.classList.contains('keep')) { if (MODKEY[m] === d.k || (alphaLock && d.k === 'ALPHA')) b.classList.add('latched'); face.textContent = d.p; continue; }
      const alt = shown ? altOf(d, shown) : null;
      if (shown) {
        b.classList.add(alt ? 'has-alt' : 'no-alt');
        face.textContent = alt || d.p;
        if (alt && alt.length > 5) b.classList.add('long-alt');
      } else face.textContent = d.p;
    }
    const st = $('#status');
    const label = { '2nd': ['m-2nd', '2nd'], dia: ['m-dia', '◆'], alpha: ['m-alpha', 'alpha'], shift: ['m-shift', 'shift'] }[m];
    st.innerHTML = label ? `<span class="m ${label[0]}">${label[1]}</span>` : alphaLock ? '<span class="m m-lock">alpha lock</span>' : '';
  }
  // Track how a key press changes the calculator's sticky modifier state.
  function afterPress(k) {
    if (k === '2ND') return setMode(mode === '2nd' ? null : '2nd');
    if (k === 'DIAMOND') return setMode(mode === 'dia' ? null : 'dia');
    if (k === 'SHIFT') return setMode(mode === 'shift' ? null : 'shift');
    if (k === 'ALPHA') {
      if (mode === '2nd') { alphaLock = true; return setMode(null); }
      if (alphaLock) { alphaLock = false; return setMode(null); }
      return setMode(mode === 'alpha' ? null : 'alpha');
    }
    if (['ENTER1', 'ESCAPE', 'HOME', 'APPS', 'MODE', 'CATALOG', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(k) && alphaLock) alphaLock = false;
    setMode(null);
  }
  // Send a key with a chosen modifier, cancelling whatever modifier is latched first.
  function sendWith(m, k) {
    const seq = [];
    if (m === mode) seq.push(k);
    else {
      if (mode) seq.push(MODKEY[mode]);
      if (m) seq.push(MODKEY[m]);
      seq.push(k);
    }
    enqueueTap(seq); haptic(); setMode(null);
    if (m === 'alpha' && alphaLock) alphaLock = true;
  }

  /* the Graph89 layout is landscape; in portrait the whole page is turned 90° (body.turned) */
  const turned = () => document.body.classList.contains('turned');
  const pt = (e) => (turned() ? { x: e.clientY, y: window.innerWidth - e.clientX } : { x: e.clientX, y: e.clientY });
  function crect(el) {
    const r = el.getBoundingClientRect();
    return turned() ? { left: r.top, top: window.innerWidth - r.right, width: r.height, height: r.width, right: r.bottom, bottom: window.innerWidth - r.left } : r;
  }
  const viewW = () => (turned() ? window.innerHeight : window.innerWidth);

  let longTimer = 0;
  function attachKey(b) {
    const d = b._def;
    let start = null, gesture = null, holding = false, pid = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); closePop();
      pid = e.pointerId; try { b.setPointerCapture(pid); } catch (_) {}
      start = pt(e); gesture = null; holding = false;
      b.classList.add('pressed'); haptic();
      clearTimeout(longTimer);
      longTimer = setTimeout(() => {
        if (gesture) return;
        if (d.hold) { holding = true; keyDown(d.k); }
        else if (d.page || d.seq) { /* acts on release */ }
        else { b.classList.remove('pressed'); start = null; openPop(b); }
      }, d.hold ? 280 : 430);
    });
    b.addEventListener('pointermove', (e) => {
      if (!start || !false || holding) return;
      const q = pt(e), dy = q.y - start.y, dx = q.x - start.x;
      let g = null;
      if (dy < -20 && Math.abs(dy) > Math.abs(dx) && d.s) g = '2nd';
      else if (dy > 20 && Math.abs(dy) > Math.abs(dx) && d.d) g = 'dia';
      if (g !== gesture) {
        gesture = g; clearTimeout(longTimer);
        b.classList.toggle('preview-2nd', g === '2nd'); b.classList.toggle('preview-dia', g === 'dia');
        b.querySelector('.face').textContent = g ? altOf(d, g) : (mode ? (altOf(d, mode) || d.p) : d.p);
        if (g) haptic();
      }
    });
    const end = (cancel) => {
      clearTimeout(longTimer);
      b.classList.remove('pressed', 'preview-2nd', 'preview-dia');
      if (holding) { keyUp(d.k); holding = false; afterPress(d.k); start = null; return; }
      if (!start) return;
      start = null;
      if (cancel) { setMode(mode); return; }
      if (d.page) { padPage = d.page; buildPad(); haptic(); return; }
      if (d.seq) { const pre = mode ? [MODKEY[mode]] : []; enqueueTap([...pre, ...d.seq]); setMode(null); return; }
      if (gesture) { sendWith(gesture, d.k); return; }
      enqueueTap([d.k]); afterPress(d.k);
    };
    b.addEventListener('pointerup', () => end(false));
    b.addEventListener('pointercancel', () => end(true));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function attachHold(b) {   // d-pad: real press and release so the calculator auto-repeats
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('pressed'); haptic(); keyDown(k); });
    const up = () => { if (!b.classList.contains('pressed')) return; b.classList.remove('pressed'); keyUp(k); if (mode) setMode(null); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* long-press picker: every function of a key in one place */
  function openPop(b) {
    const d = b._def, p = $('#pop'); p.innerHTML = '';
    const opts = [[null, d.p, '']];
    if (d.s) opts.push(['2nd', d.s, '2nd']);
    if (d.d) opts.push(['dia', d.d, '◆']);
    if (d.a && d.a !== '␣') { opts.push(['alpha', d.a, 'alpha']); opts.push(['shift', d.a.toUpperCase(), 'shift']); }
    else if (d.a === '␣') opts.push(['alpha', '␣', 'space']);
    if (opts.length < 2) return enqueueTap([d.k]);
    haptic();
    for (const [m, label, sub] of opts) {
      const o = document.createElement('button');
      o.className = m ? 'p-' + (m === 'shift' ? 'alpha' : m) : '';
      o.innerHTML = `<span></span>${sub ? '<small></small>' : ''}`;
      o.firstChild.textContent = label; if (sub) o.lastChild.textContent = sub;
      o.onclick = () => { closePop(); sendWith(m, d.k); };
      p.appendChild(o);
    }
    p.hidden = false;
    const r = crect(b), pr = crect(p);
    let left = r.left + r.width / 2 - pr.width / 2; left = Math.max(8, Math.min(viewW() - pr.width - 8, left));
    let top = r.top - pr.height - 10; if (top < 8) top = r.bottom + 10;
    p.style.left = left + 'px'; p.style.top = top + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outsidePop, { capture: true }), 0);
  }
  function outsidePop(e) { if (!$('#pop').contains(e.target)) { closePop(); } }
  function closePop() { $('#pop').hidden = true; document.removeEventListener('pointerdown', outsidePop, { capture: true }); }

  /* ------------------------------------------------------------------ typing */
  // Make phone-typed text read the way the TI-89 parses it.
  function toTI(s) {
    s = s.replace(/->/g, '→').replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/!=|<>/g, '≠').replace(/\bsqrt\(/g, '√(')
      .replace(/\binf\b/g, '∞').replace(/\*\*/g, '^');
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '-' || c === '−') {
        const prev = out.replace(/\s+$/, '').slice(-1);
        const unary = prev === '' || '(,=[{^*/+-<>≤≥≠→|­'.includes(prev) || (/[eE]/.test(prev) && /\d\.?$/.test(out.slice(0, -1)) && !/[a-zA-Z]/.test(out.slice(-3, -1)));
        out += unary ? '­' : '-';
      } else out += c;
    }
    return out;
  }
  // Unicode → TI-89 charset (built from libticonv's table)
  const UNI2TI = new Map();
  TI9X_CHARSET.forEach((u, i) => { if (u && !UNI2TI.has(u)) UNI2TI.set(u, i); });
  Object.entries({ 'ᴇ': 149, 'ⅈ': 151, 'π': 140, '√': 168, '−': 173, '­': 173, 'θ': 136, '∫': 189, '∞': 190, '→': 22, '▸': 18, '≤': 156, '≠': 157, '≥': 158, '∠': 159, 'ℯ': 150, '°': 176, 'Σ': 142, 'Δ': 132, '×': 42, '÷': 47, '⁻': 173 }).forEach(([u, i]) => UNI2TI.set(u, i));
  function encodeTI(s) {
    const out = []; for (const ch of s) { const c = UNI2TI.get(ch); out.push(c !== undefined ? c : (ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63)); }
    return new Uint8Array(out);
  }
  function typeText(text, enter) {
    if (!text) return;
    if (mode) { enqueueTap([MODKEY[mode]]); setMode(null); }
    if (alphaLock) { enqueueTap(['ALPHA']); alphaLock = false; setMode(null); }
    const bytes = encodeTI(toTI(text));
    // the core's typer takes a NUL-terminated TI string; queue in chunks it accepts
    let latin = ''; for (const b of bytes) latin += String.fromCharCode(b);
    typeQueue.push(latin);
    if (enter) typeQueue.push('\n');
  }
  const CHIPS = ['π', '√(', 'ℯ^(', 'ⅈ', '∞', 'θ', '→', '≠', '≤', '≥', '∫(', 'd(', '|', '°', 'ᴇ', 'Σ(', 'ans(1)'];
  function buildTypeSheet() {
    const chips = $('#type-chips');
    for (const c of CHIPS) {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = c;
      b.onclick = () => { const i = $('#type-input'); const p = i.selectionStart ?? i.value.length; i.value = i.value.slice(0, p) + c + i.value.slice(i.selectionEnd ?? p); i.focus(); i.setSelectionRange(p + c.length, p + c.length); };
      chips.appendChild(b);
    }
    const send = () => {
      const i = $('#type-input'); const v = i.value; if (!v) return;
      typeText(v, $('#type-autoenter').checked);
      S.hist = [v, ...S.hist.filter((h) => h !== v)].slice(0, 30); saveSettings(); renderHist();
      i.value = ''; haptic();
    };
    $('#type-send').onclick = send;
    $('#type-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } e.stopPropagation(); });
    $('#type-autoenter').onchange = (e) => { $('#type-send').textContent = e.target.checked ? 'Enter' : 'Type'; };
    renderHist();
  }
  function renderHist() {
    const h = $('#type-hist'); h.innerHTML = '';
    for (const v of S.hist) { const b = document.createElement('button'); b.textContent = v; b.onclick = () => { $('#type-input').value = v; $('#type-input').focus(); }; h.appendChild(b); }
  }

  /* ------------------------------------------------------------------ commands */
  let CMDS = [], cmdCat = 'All';
  async function loadCommands() {
    try { CMDS = await (await fetch('data/commands.json')).json(); } catch (e) { CMDS = []; }
    const cats = ['All', ...Array.from(new Set(CMDS.flatMap((c) => c.c || []))).sort()];
    const box = $('#cmd-cats');
    for (const c of cats) {
      const b = document.createElement('button'); b.className = 'chip' + (c === 'All' ? ' on' : ''); b.textContent = c;
      b.onclick = () => { cmdCat = c; box.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); renderCmds(); };
      box.appendChild(b);
    }
    $('#cmd-search').addEventListener('input', renderCmds);
    $('#cmd-search').addEventListener('keydown', (e) => e.stopPropagation());
  }
  function renderCmds() {
    const q = $('#cmd-search').value.trim().toLowerCase();
    const list = $('#cmd-list'); list.innerHTML = '';
    let rows = CMDS.filter((c) => cmdCat === 'All' || (c.c || []).includes(cmdCat));
    if (q) {
      rows = rows.map((c) => {
        const n = c.n.toLowerCase(); let sc = 0;
        if (n.startsWith(q)) sc = 3; else if (n.includes(q)) sc = 2; else if ((c.d || '').toLowerCase().includes(q) || c.syn.join(' ').toLowerCase().includes(q)) sc = 1;
        return [sc, c];
      }).filter((x) => x[0]).sort((a, b) => b[0] - a[0] || a[1].n.localeCompare(b[1].n)).map((x) => x[1]);
    }
    if (!rows.length) { list.innerHTML = '<li class="empty">No command matches that. Try part of a name, like “deriv” or “mat”.</li>'; return; }
    const frag = document.createDocumentFragment();
    for (const c of rows.slice(0, 200)) {
      const li = document.createElement('li'); li.className = 'cmd';
      const head = document.createElement('div'); head.className = 'cmd-head';
      head.innerHTML = '<span class="cmd-name"></span><span class="cmd-syn"></span>';
      head.children[0].textContent = c.n; head.children[1].textContent = c.syn[0] || '';
      if (c.i || c.k) {
        const ins = document.createElement('button'); ins.className = 'cmd-ins'; ins.textContent = 'Insert';
        ins.onclick = (e) => { e.stopPropagation(); insertCmd(c); };
        head.appendChild(ins);
      }
      head.onclick = () => {
        if (li.querySelector('.cmd-body')) { li.querySelector('.cmd-body').remove(); return; }
        const body = document.createElement('div'); body.className = 'cmd-body';
        const pre = document.createElement('pre'); pre.textContent = c.syn.join('\n'); if (c.syn.length) body.appendChild(pre);
        const p = document.createElement('div'); p.textContent = c.d; body.appendChild(p);
        const w = document.createElement('div'); w.className = 'where'; w.textContent = 'On the calculator: ' + c.loc + (c.c ? ' · ' + c.c.join(', ') : '');
        body.appendChild(w); li.appendChild(body);
      };
      li.appendChild(head); frag.appendChild(li);
    }
    list.appendChild(frag);
  }
  function insertCmd(c) {
    if (c.k && !(is92() && c.k.some((k) => ['HOME', 'CATALOG', 'EE', 'PIPE', 'ALPHA'].includes(k)))) { if (mode) { enqueueTap([MODKEY[mode]]); setMode(null); } enqueueTap(c.k); }
    else if (!c.i && c.k) { typeText(c.n + (/[a-z]/.test(c.n) ? '(' : ''), false); }
    else typeText(c.i, false);
    closeSheets(); haptic(); toast('Inserted ' + c.n);
  }

  /* ------------------------------------------------------------------ sheets */
  let openSheet = null;
  function showSheet(id) {
    closePop(); closeSheets();
    $('#scrim').hidden = false; $(id).hidden = false; openSheet = id;
    if (id === '#sheet-type') setTimeout(() => $('#type-input').focus(), 60);
    if (id === '#sheet-cmds') { renderCmds(); }
    if (id === '#sheet-menu') renderMenu();
  }
  function closeSheets() {
    document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
    $('#scrim').hidden = true; openSheet = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function swipeToClose(sheet) {
    const grab = sheet.querySelector('.grab'); let y0 = null;
    sheet.addEventListener('pointerdown', (e) => { if (e.target === grab || e.clientY - sheet.getBoundingClientRect().top < 28) y0 = e.clientY; });
    sheet.addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 60) closeSheets(); y0 = null; });
  }

  /* ------------------------------------------------------------------ menu */
  async function renderMenu() {
    const files = (await DB.get(SK('received'))) || [];
    const box = $('#m-received'); box.innerHTML = '';
    if (files.length) {
      const h = document.createElement('div'); h.className = 'row'; h.innerHTML = '<span>Received from calculator</span><small>Send variables from Var-Link to the computer to collect them here</small>'; box.appendChild(h);
      files.slice().reverse().forEach((f, ri) => {
        const idx = files.length - 1 - ri;
        const r = document.createElement('div'); r.className = 'rfile';
        r.innerHTML = '<span></span><button>Save</button><button>Remove</button>';
        r.firstChild.textContent = f.name;
        r.children[1].onclick = () => saveBytes(f.name, f.data);
        r.children[2].onclick = async () => { files.splice(idx, 1); await DB.set(SK('received'), files); renderMenu(); };
        box.appendChild(r);
      });
    }
    const snap = await DB.get(SK('snapshot-date'));
    $('#m-restore').disabled = !snap;
    $('#m-restore').querySelector('small')?.remove();
    const sm = document.createElement('small'); sm.textContent = snap ? 'Saved ' + new Date(snap).toLocaleString() : 'No snapshot yet'; $('#m-restore').appendChild(sm);
    document.querySelectorAll('#s-lcd button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.lcd));
    document.querySelectorAll('#s-speed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === S.speed));
    $('#s-gray').checked = S.gray; $('#s-grid').checked = S.grid; $('#s-turbo').checked = S.turbo;
    $('#about').textContent = `Running TI AMS ${core ? core.romVersion() : ''} on the TiEmu emulator core, built on Graph89 by Dritan Hashorva. Free software under the GNU GPL v3. The TI-89, TI-92 Plus and Voyage 200 and the AMS operating system are © Texas Instruments; this app contains no TI code.`;
  }
  function bindMenu() {
    $('#m-send').onclick = () => $('#file-send').click();
    $('#file-send').onchange = async (e) => {
      const fs = Array.from(e.target.files || []); e.target.value = ''; closeSheets();
      for (const f of fs) {
        try { const bytes = await readFile(f); core.sendFile(f.name, bytes); toast('Sent ' + f.name); }
        catch (err) { toast(f.name + ': ' + err.message + '. Go to the Home screen and try again.'); }
      }
      forceDraw = true; dirty = true;
    };
    $('#m-shot').onclick = () => { closeSheets(); screenshotPNG(); };
    $('#m-save').onclick = async () => { const st = core.saveState(); await DB.set(SK('snapshot'), st); await DB.set(SK('snapshot-date'), Date.now()); closeSheets(); toast('Snapshot saved'); };
    $('#m-restore').onclick = async () => { const st = await DB.get(SK('snapshot')); if (!st) return; try { core.loadState(st); toast('Snapshot restored'); } catch (e) { toast(e.message); } closeSheets(); forceDraw = true; };
    $('#m-clock').onclick = () => { closeSheets(); const r = core.syncClock(); toast(r ? 'The calculator was busy. Go to the Home screen and try again.' : 'Clock set to ' + new Date().toLocaleTimeString()); };
    $('#m-reset').onclick = () => { closeSheets(); core.reset(); toast('Calculator restarted'); };
    $('#m-os').onclick = () => { closeSheets(); if (EMBED) askReplace(); else $('#file-os').click(); };
    if (EMBED) { $('#m-os').firstElementChild.textContent = 'Replace OS or change calculator'; const o = $('#btn-other'); if (o) { o.hidden = false; o.onclick = askReplace; } }
    document.querySelectorAll('#s-lcd button').forEach((b) => b.onclick = () => { S.lcd = b.dataset.v; applyLcd(); saveSettings(); renderMenu(); });
    document.querySelectorAll('#s-speed button').forEach((b) => b.onclick = () => { S.speed = +b.dataset.v; saveSettings(); renderMenu(); });
    $('#s-gray').onchange = (e) => { S.gray = e.target.checked; saveSettings(); toast('Takes effect next time the app starts'); };
    $('#s-grid').onchange = (e) => { S.grid = e.target.checked; saveSettings(); forceDraw = true; };
    $('#s-turbo').onchange = (e) => { S.turbo = e.target.checked; saveSettings(); };
  }
  function applyLcd() { const l = $('#lcd'); l.classList.remove('paper', 'night'); if (S.lcd !== 'stn') l.classList.add(S.lcd); layoutScreen(); }

  /* ------------------------------------------------------------------ hardware keyboard */
  const HWK = { Enter: 'ENTER1', Backspace: 'BACKSPACE', Escape: 'ESCAPE', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', Home: 'HOME' };
  const HWHELD = new Set();
  function bindHardwareKeys() {
    window.addEventListener('keydown', (e) => {
      if (openSheet || !core || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = HWK[e.key];
      if (k) { e.preventDefault(); if (!HWHELD.has(k)) { HWHELD.add(k); keyDown(k); } return; }
      if (e.key === 'Delete') { e.preventDefault(); enqueueTap(['DIAMOND', 'BACKSPACE']); return; }
      if (/^F[678]$/.test(e.key)) { e.preventDefault(); enqueueTap(['2ND', 'F' + (+e.key[1] - 5)]); return; }
      if (e.key.length === 1) { e.preventDefault(); typeText(e.key, false); }
    });
    window.addEventListener('keyup', (e) => { const k = HWK[e.key]; if (k && HWHELD.has(k)) { HWHELD.delete(k); keyUp(k); } });
  }


  /* ---- embedded in CalcShelf: the main app chooses the model and hands over OS files ---- */
  const EMBED = window.parent !== window;
  const askReplace = () => { try { window.parent.postMessage({ type: 'emu-replace' }, '*'); } catch (e) {} };
  function emuBridge(saveFn, installFn) {
    if (!EMBED) return;
    window.addEventListener('message', async (e) => {
      const d = e.data; if (!d || e.source !== window.parent) return;
      if (d.type === 'emu-save') { try { await saveFn(); } catch (x) { /* ignore */ } window.parent.postMessage({ type: 'emu-saved', id: d.id }, '*'); }
      else if (d.type === 'emu-install' && installFn) installFn(new File([d.bytes], d.name));
    });
    window.parent.postMessage({ type: 'emu-ready' }, '*');
  }

  /* ------------------------------------------------------------------ lifecycle */
  async function saveState(quiet) {
    if (!core || !core.loaded) return;
    try { await DB.set(SK('state'), core.saveState()); } catch (e) { if (!quiet) toast('Could not save: ' + e.message); }
  }
  async function installOS(file) {
    const err = $('#setup-err'); err.hidden = true;
    try {
      const bytes = await readFile(file);
      const imgBytes = core.installOS(bytes, file.name);
      await DB.set(SK('img'), imgBytes); await DB.del(SK('state'));
      boot(imgBytes, null);
      $('#setup').hidden = true;
      toast('OS installed. Press home to start calculating.');
    } catch (e) {
      const msg = 'That file didn’t work: ' + e.message.replace(/^Could not convert OS: /, '') + ' Choose an OS upgrade file (.89u, .9xu or .v2u) or a ROM dump.';
      if (!$('#setup').hidden) { err.textContent = msg; err.hidden = false; } else toast(msg);
    }
  }
  const is92 = () => core && [1, 4, 8].includes(core.x.g89_calc_type());
  function boot(imgBytes, state) {
    core.load(imgBytes, S.gray);
    W = core.x.g89_lcd_w(); H = core.x.g89_lcd_h();
    $('#lcd').style.setProperty('--ar', W / H);
    document.body.classList.toggle('qwerty', is92());
    if (is92() && skinWanted()) buildSkin(); else { unbuildSkin(); padPage = 'math'; buildPad(is92() ? KEYPAD92 : KEYPAD); }
    document.body.dataset.slot = SLOT;
    $('#type-input').placeholder = is92() ? 'solve(x^2=4,x)' : 'factor(x^2-1)';
    layoutScreen();
    if (state) { try { core.loadState(state); } catch (e) { console.warn('state', e); } }
    core.turnOn();
    running = true; lastT = 0; forceDraw = true; requestAnimationFrame(frame);
  }
  window.onAndroidBack = () => {
    if (!$('#pop').hidden) { closePop(); return true; }
    if (openSheet) { closeSheets(); return true; }
    saveState(true).then(() => { if (bridge && bridge.exitApp) bridge.exitApp(); });
    return false;
  };
  window.__closeOverlay = () => { if (!$('#pop').hidden) { closePop(); return true; } if (openSheet) { closeSheets(); return true; } return false; };
  window.onAndroidPause = () => { saveState(true); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(true); else { lastT = 0; } });
  window.addEventListener('pagehide', () => saveState(true));

  function setupTexts() {
    const t = {
      89: ['TI-89 Titanium', 'the TI-89 Titanium or TI-89', 'Accepts a TI-89 Titanium or TI-89 OS upgrade (<b>.89u</b>, free from TI) or a ROM dump (<b>.rom</b>).'],
      '92p': ['TI-92 Plus', 'the TI-92 Plus', 'Accepts a TI-92 Plus OS upgrade (<b>.9xu</b>, free from TI) or a ROM dump (<b>.rom</b>) from a TI-92 Plus or a TI-92 with the Plus module.'],
      v200: ['Voyage 200', 'the Voyage 200', 'Accepts a Voyage 200 OS upgrade (<b>.v2u</b>, free from TI) or a ROM dump (<b>.rom</b>).'],
      92: ['TI-92', 'the original TI-92', 'Accepts a ROM dump (<b>.rom</b>) of a TI-92. The original TI-92 has no OS upgrade files.'],
    }[SLOT] || [];
    document.title = t[0];
    $('#setup-h').textContent = t[0];
    $('#setup-p').textContent = 'Runs the real ' + t[1].replace(/^the /, '') + ' operating system (TI AMS). Load the OS file or a ROM image once and it stays on this phone.';
    $('#setup-fine').innerHTML = t[2];
  }
  async function main() {
    // one rotatable root, so a turned (landscape-in-portrait) page keeps its sheets and pop-ups turned too
    const rot = document.createElement('div'); rot.id = 'rot';
    for (const n of [...document.body.children]) if (n.tagName !== 'SCRIPT') rot.appendChild(n);
    document.body.prepend(rot);
    setupTexts();
    buildPad(); setMode(null); buildTypeSheet(); bindMenu(); bindHardwareKeys();
    $('#btn-type').onclick = () => showSheet('#sheet-type');
    $('#btn-cmds').onclick = () => showSheet('#sheet-cmds');
    $('#btn-menu').onclick = () => showSheet('#sheet-menu');
    $('#scrim').onclick = closeSheets;
    document.querySelectorAll('.sheet').forEach(swipeToClose);
    $('#btn-load-os').onclick = () => $('#file-os').click();
    $('#file-os').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) installOS(f); };
    window.addEventListener('resize', () => { choosePad(); layoutScreen(); });

    await DB.open();
    const st = await DB.get('settings'); if (st) S = { ...DEFAULTS, ...st };
    applyLcd();
    const wasm = await (await fetch('core/g89.wasm')).arrayBuffer();
    core = await Ti89.Ti89Core.create(wasm, {
      onFileReceived: async (name, data) => {
        const files = (await DB.get(SK('received'))) || []; files.push({ name, data, date: Date.now() }); await DB.set(SK('received'), files);
        toast('Received ' + name, 'Save', () => saveBytes(name, data));
      },
    });
    loadCommands();
    const imgBytes = await DB.get(SK('img'));
    if (imgBytes) boot(imgBytes, await DB.get(SK('state')));
    else $('#setup').hidden = false;
    requestAnimationFrame(layoutScreen);
    window.__ti = { core: () => core, typeText, enqueueTap };
    emuBridge(() => saveState(true), installOS);
  }
  main().catch((e) => { console.error(e); toast('Could not start: ' + e.message, null, null, 10000); });
})();
