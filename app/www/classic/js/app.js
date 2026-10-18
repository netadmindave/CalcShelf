/*
 * Classic calculators — TI-81, 82, 83, 83 Plus (SE), 84 Plus (SE), 85 and 86 on the TilEm core,
 * with a touch keypad laid out like each real calculator. Part of CalcShelf, GPL-3.0-or-later.
 */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const bridge = window.TiBridge || (window.parent && window.parent !== window && window.parent.TiBridge) || null;
  const { MODELS } = CLASSIC;
  const params = new URLSearchParams(location.search);

  /* ------------------------------------------------------------------ storage */
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        let req;
        try { req = indexedDB.open('classictouch', 1); } catch (e) { return res(null); }
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; res(this.db); };
        req.onerror = () => res(null);
      });
    },
    get(k) { return new Promise((res) => { if (!this.db) return res(undefined); try { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
    set(k, v) { return new Promise((res) => { if (!this.db) return res(false); try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); },
    del(k) { return new Promise((res) => { if (!this.db) return res(); try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); } catch (e) { res(); } }); },
  };
  const DEFAULTS = { lcd: 'stn', grid: true, speed: 1, hist: [], autoContrast: true };
  let S = { ...DEFAULTS };
  const saveSettings = () => DB.set('settings', S);

  /* ------------------------------------------------------------------ helpers */
  let toastTimer = 0;
  function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }
  function haptic() { /* key vibration was removed in 2.7 */ }
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function saveBytes(name, bytes, mime = 'application/octet-stream') {
    if (bridge && bridge.saveFile) { const r = bridge.saveFile(name, b64(bytes), mime); toast(r || ('Saved ' + name + ' to Downloads')); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = rej; r.readAsArrayBuffer(f); });

  /* ------------------------------------------------------------------ model */
  let model = MODELS.find((m) => m.id === params.get('model')) || MODELS[0];
  let PAD = model.pad();
  let SECOND = PAD.cluster[0][0].k, ALPHA = 'alpha' in PAD ? PAD.alpha : PAD.cluster[1][0].k;
  const ON = 0x29;

  /* ------------------------------------------------------------------ emulator */
  let core = null, running = false, lastT = 0, lastSave = 0, dirty = false;
  const queue = [];
  function enqueueTap(keys) { for (const k of keys) { queue.push({ t: 'down', k }); queue.push({ t: 'wait', ms: 60 }); queue.push({ t: 'up', k }); queue.push({ t: 'wait', ms: 60 }); } dirty = true; }
  function keyDown(k) { queue.push({ t: 'down', k }); dirty = true; }
  function keyUp(k) { queue.push({ t: 'wait', ms: 40 }); queue.push({ t: 'up', k }); }
  function step(ms) {
    let left = ms;
    while (left > 0) {
      const h = queue[0];
      if (!h) { core.run(left, S.speed); break; }
      if (h.t !== 'wait') { core.key(h.k, h.t === 'down'); queue.shift(); continue; }
      const s = Math.min(h.ms, left, 10);
      core.run(s, 1); h.ms -= s; left -= s;
      if (h.ms <= 0) queue.shift();
    }
    while (queue[0] && queue[0].t !== 'wait') { const h = queue.shift(); core.key(h.k, h.t === 'down'); }
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(50, now - (lastT || now)); lastT = now;
    step(dt || 16);
    const scr = core.screen();
    if (scr.changed || forceDraw) draw(scr);
    if (now - lastSave > 45000 && dirty) { lastSave = now; dirty = false; saveState(true); }
  }

  /* ------------------------------------------------------------------ screen */
  const canvas = $('#screen'); const ctx = canvas.getContext('2d');
  let img = null, scale = 1, forceDraw = true, palette = null, W = 96, H = 64;
  function hexToRgb(h) { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function layoutScreen() {
    const lcd = $('#lcd'); lcd.style.setProperty('--ar', W / H);
    const r = lcd.getBoundingClientRect(); if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    scale = Math.max(1, Math.floor(Math.min(r.width * 0.985 * dpr / W, r.height * 0.985 * dpr / H)));
    canvas.width = W * scale; canvas.height = H * scale;
    canvas.style.width = (canvas.width / dpr) + 'px'; canvas.style.height = (canvas.height / dpr) + 'px';
    img = ctx.createImageData(canvas.width, canvas.height);
    const cs = getComputedStyle(lcd);
    const bg = hexToRgb(cs.getPropertyValue('--lcd-bg')), ink = hexToRgb(cs.getPropertyValue('--lcd-ink'));
    palette = new Uint32Array(256);
    for (let v = 0; v < 256; v++) { const f = v / 255; const c = [0, 1, 2].map((i) => Math.round(bg[i] + (ink[i] - bg[i]) * f)); palette[v] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; }
    forceDraw = true;
  }
  function blend(a, b) { const m = (x, y, sh) => ((((x >> sh) & 255) * 45 + ((y >> sh) & 255) * 55) / 100) | 0; return (255 << 24) | (m(a, b, 16) << 16) | (m(a, b, 8) << 8) | m(a, b, 0); }
  function draw(scr) {
    forceDraw = false;
    $('#lcd-off').hidden = scr.on;
    if (!img) return;
    const px = scr.pixels, CW = canvas.width, out = new Uint32Array(img.data.buffer), s = scale;
    const grid = S.grid && s >= 4, bgc = palette[0];
    // Auto contrast: undo the calculator's contrast offset so the background stays light (TilEm: base = (c-32)*8)
    const cb = S.autoContrast && scr.contrast > 32 ? (scr.contrast - 32) * 8 : 0, k = 255 / (255 - cb);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = cb ? Math.max(0, Math.min(255, ((px[y * W + x] - cb) * k) | 0)) : px[y * W + x];
      const c = scr.on ? palette[v] : bgc;
      let o = (y * s) * CW + x * s;
      for (let j = 0; j < s; j++, o += CW) {
        if (grid && j === s - 1) { out.fill(blend(c, bgc), o, o + s); continue; }
        out.fill(c, o, o + s - (grid ? 1 : 0)); if (grid) out[o + s - 1] = blend(c, bgc);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function screenshotPNG() {
    const c = document.createElement('canvas'); c.width = W * 6; c.height = H * 6; const x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(canvas, 0, 0, c.width, c.height);
    c.toBlob(async (b) => { const bytes = new Uint8Array(await b.arrayBuffer()); saveBytes(model.short.replace(/\W+/g, '') + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png', bytes, 'image/png'); }, 'image/png');
  }

  /* ------------------------------------------------------------------ keypad */
  const pad = $('#pad');
  let mode = null, alphaLock = false;
  const keyEls = [];
  function buildKey(def, extra = '') {
    const b = document.createElement('button');
    b.className = 'key ' + (def.t || '') + ' ' + extra;
    if (/^[a-z]{3,}|^sto|^on$|^x-var/.test(def.p) && def.t !== 'var') b.classList.add('word');
    b.innerHTML = '<span class="lg"><span class="s"></span><span class="d"></span></span><span class="face"></span><span class="a"></span>';
    b.querySelector('.s').textContent = def.s || '';
    if (extra === 'fk') b.querySelector('.d').textContent = '';
    b.querySelector('.a').textContent = def.a || '';
    b.querySelector('.face').textContent = def.p;
    b.setAttribute('aria-label', def.p);
    b._def = def; keyEls.push(b);
    if (def.t && def.t.startsWith('mod-')) b.classList.add('keep');
    attachKey(b);
    return b;
  }
  function buildPad() {
    for (const id of ['#frow', '#cgrid', '#kgrid']) $(id).innerHTML = '';
    keyEls.length = 0;
    PAD.fkeys.forEach((d) => $('#frow').appendChild(buildKey(d, 'fk')));
    PAD.cluster.flat().forEach((d) => $('#cgrid').appendChild(buildKey(d)));
    PAD.rows.flat().forEach((d) => $('#kgrid').appendChild(buildKey(d)));
  }
  function altOf(def, m) { if (m === '2nd') return def.s || null; if (m === 'alpha') return def.a || null; return null; }
  function setMode(m) {
    mode = m;
    const shown = m || (alphaLock ? 'alpha' : null);
    if (shown) pad.dataset.mode = shown === 'alpha' ? 'alpha' : '2nd'; else delete pad.dataset.mode;
    for (const b of keyEls) {
      const d = b._def, face = b.querySelector('.face');
      b.classList.remove('has-alt', 'no-alt', 'long-alt', 'latched');
      if (b.classList.contains('keep')) { if ((m === '2nd' && d.k === SECOND) || ((m === 'alpha' || alphaLock) && d.k === ALPHA)) b.classList.add('latched'); face.textContent = d.p; continue; }
      const alt = shown ? altOf(d, shown) : null;
      if (shown) { b.classList.add(alt ? 'has-alt' : 'no-alt'); face.textContent = alt || d.p; if (alt && alt.length > 5) b.classList.add('long-alt'); }
      else face.textContent = d.p;
    }
    const st = $('#status');
    st.innerHTML = m === '2nd' ? '<span class="m m-2nd">2nd</span>' : m === 'alpha' ? '<span class="m m-alpha">alpha</span>' : alphaLock ? '<span class="m m-lock">alpha lock</span>' : '';
  }
  function afterPress(k) {
    if (k === SECOND) return setMode(mode === '2nd' ? null : '2nd');
    if (k === ALPHA) {
      if (mode === '2nd') { alphaLock = true; return setMode(null); }
      if (alphaLock) { alphaLock = false; return setMode(null); }
      return setMode(mode === 'alpha' ? null : 'alpha');
    }
    if (k === 0x09 || k === ON) alphaLock = false;
    setMode(null);
  }
  function sendWith(m, k) {
    const seq = [];
    if (m === mode) seq.push(k);
    else { if (mode === '2nd') seq.push(SECOND); else if (mode === 'alpha') seq.push(ALPHA); if (m === '2nd') seq.push(SECOND); if (m === 'alpha') seq.push(ALPHA); seq.push(k); }
    enqueueTap(seq); haptic(); setMode(null);
  }
  let longTimer = 0;
  function attachKey(b) {
    const d = b._def;
    let start = null, gesture = null, holding = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); closePop();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      start = { x: e.clientX, y: e.clientY }; gesture = null; holding = false;
      b.classList.add('pressed'); haptic();
      clearTimeout(longTimer);
      longTimer = setTimeout(() => {
        if (gesture) return;
        if (d.hold || d.k === ON) { holding = true; keyDown(d.k); }
        else { b.classList.remove('pressed'); start = null; openPop(b); }
      }, d.hold ? 280 : 430);
    });
    b.addEventListener('pointermove', (e) => {
      if (!start || !false || holding) return;
      const dy = e.clientY - start.y, dx = e.clientX - start.x;
      let g = null;
      if (dy < -20 && Math.abs(dy) > Math.abs(dx) && d.s) g = '2nd';
      else if (dy > 20 && Math.abs(dy) > Math.abs(dx) && d.a) g = 'alpha';
      if (g !== gesture) {
        gesture = g; clearTimeout(longTimer);
        b.classList.toggle('preview-2nd', g === '2nd'); b.classList.toggle('preview-dia', g === 'alpha');
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
      if (gesture) { sendWith(gesture, d.k); return; }
      enqueueTap([d.k]); afterPress(d.k);
    };
    b.addEventListener('pointerup', () => end(false));
    b.addEventListener('pointercancel', () => end(true));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function attachHold(b) {
    const k = +b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('pressed'); haptic(); keyDown(k); });
    const up = () => { if (!b.classList.contains('pressed')) return; b.classList.remove('pressed'); keyUp(k); if (mode) setMode(null); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function openPop(b) {
    const d = b._def, p = $('#pop'); p.innerHTML = '';
    const opts = [[null, d.p, '']];
    if (d.s) opts.push(['2nd', d.s, '2nd']);
    if (d.a) opts.push(['alpha', d.a, 'alpha']);
    if (opts.length < 2) { enqueueTap([d.k]); afterPress(d.k); return; }
    haptic();
    for (const [m, label, sub] of opts) {
      const o = document.createElement('button');
      o.className = m === '2nd' ? 'p-2nd' : m === 'alpha' ? 'p-alpha' : '';
      o.innerHTML = '<span></span>' + (sub ? '<small></small>' : '');
      o.firstChild.textContent = label; if (sub) o.lastChild.textContent = sub;
      o.onclick = () => { closePop(); sendWith(m, d.k); };
      p.appendChild(o);
    }
    p.hidden = false;
    const r = b.getBoundingClientRect(), pr = p.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2; left = Math.max(8, Math.min(window.innerWidth - pr.width - 8, left));
    let top = r.top - pr.height - 10; if (top < 8) top = r.bottom + 10;
    p.style.left = left + 'px'; p.style.top = top + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outsidePop, { capture: true }), 0);
  }
  function outsidePop(e) { if (!$('#pop').contains(e.target)) closePop(); }
  function closePop() { $('#pop').hidden = true; document.removeEventListener('pointerdown', outsidePop, { capture: true }); }

  /* ------------------------------------------------------------------ typing → key presses */
  let TYPEMAP = null;
  function buildTypeMap() {
    const m = new Map(), all = [...PAD.fkeys, ...PAD.cluster.flat(), ...PAD.rows.flat()];
    const face = { '×': '*', '÷': '/', '−': '-', '(−)': '~', 'sto→': '→', 'sto▸': '→', 'EE': 'ᴇ', 'x²': '²', 'x⁻¹': '⁻¹' };
    for (const d of all) {
      const f = face[d.p] || d.p;
      if (f.length === 1 || f === '⁻¹') { if (!m.has(f)) m.set(f, [d.k]); }
      if (['sin', 'cos', 'tan', 'log', 'ln'].includes(d.p)) m.set(d.p.toUpperCase() + '(', [d.k]);
      if (ALPHA && d.a && d.a.length === 1 && d.a !== '␣') { if (!m.has(d.a)) m.set(d.a, [ALPHA, d.k]); }
      if (ALPHA && d.a === '␣') m.set(' ', [ALPHA, d.k]);
      if (d.s) {
        const s2 = { '√': '√(', 'π': 'π', '{': '{', '}': '}', '[': '[', ']': ']', 'i': 'i', 'e': 'e', 'EE': 'ᴇ', 'Ans': 'ANS', 'eˣ': 'e^(', '10ˣ': '10^(', 'sin⁻¹': 'SIN⁻¹(', 'cos⁻¹': 'COS⁻¹(', 'tan⁻¹': 'TAN⁻¹(', '∠': '∠', ':': ':', 'x⁻¹': '⁻¹' }[d.s];
        if (s2 && !m.has(s2)) m.set(s2, [SECOND, d.k]);
      }
    }
    if (model.id === '5' || model.id === '6') { const x = all.find((d) => d.p === 'x-var'); if (x) m.set('x', [x.k]); }
    else { const x = all.find((d) => d.t === 'var'); if (x) m.set('X', [x.k]); }
    TYPEMAP = m;
  }
  function textToKeys(text) {
    if (!TYPEMAP) buildTypeMap();
    let s = text.replace(/->|=>/g, '→').replace(/\*\*/g, '^').replace(/\bsqrt\(/gi, '√(').replace(/\bpi\b/gi, 'π').replace(/\bans\b/gi, 'ANS');
    s = s.replace(/([\d.])[eE](?=[-+]?\d)/g, '$1ᴇ');
    s = s.replace(/\b(sin|cos|tan|log|ln)\(/gi, (w) => w.toUpperCase()).replace(/\b(sin|cos|tan)⁻¹\(/gi, (w) => w.toUpperCase());
    const keys = []; let i = 0, prev = '';
    const keysFor = [...TYPEMAP.keys()].sort((a, b) => b.length - a.length);
    while (i < s.length) {
      let c = s[i];
      if (c === '-' || c === '−') { const unary = prev === '' || '(,=+-*/^→{['.includes(prev); const k = TYPEMAP.get(unary ? '~' : '-'); if (k) keys.push(...k); prev = '-'; i++; continue; }
      let hit = keysFor.find((t) => s.startsWith(t, i));
      if (!hit && /[a-z]/.test(c) && TYPEMAP.has(c.toUpperCase())) { hit = c.toUpperCase(); s = s.slice(0, i) + hit + s.slice(i + 1); }
      if (!hit) { i++; continue; }
      keys.push(...TYPEMAP.get(hit)); prev = hit.slice(-1); i += hit.length;
    }
    return keys;
  }
  function typeText(text, enter) {
    const pre = []; if (mode === '2nd') pre.push(SECOND); if (mode === 'alpha') pre.push(ALPHA);
    if (alphaLock) { pre.push(ALPHA); alphaLock = false; }
    setMode(null);
    const keys = [...pre, ...textToKeys(text)];
    if (enter) keys.push(0x09);
    enqueueTap(keys);
  }
  function buildTypeSheet() {
    const send = () => {
      const v = $('#type-input').value.trim(); if (!v) return;
      typeText(v, $('#type-autoenter').checked);
      S.hist = [v, ...S.hist.filter((h) => h !== v)].slice(0, 30); saveSettings(); renderHist();
      $('#type-input').value = '';
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

  /* ------------------------------------------------------------------ sheets & menu */
  let openSheet = null;
  function showSheet(id) {
    closePop(); closeSheets();
    $('#scrim').hidden = false; $(id).hidden = false; openSheet = id;
    if (id === '#sheet-type') setTimeout(() => $('#type-input').focus(), 60);
    if (id === '#sheet-menu') renderMenu();
  }
  function closeSheets() {
    document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
    $('#scrim').hidden = true; openSheet = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  const SENDEXT = { 7: '.73p .73k .73l .73g', z: '.8xp .8xk .8xg .8xl .8xv', 4: '.8xp .8xk .8xg .8xl .8xv', s: '.8xp .8xk .8xg .8xl .8xv', p: '.8xp .8xk .8xg .8xl .8xv', 3: '.83p .83g .83l', 2: '.82p .82g .82l', 5: '.85p .85g .85l .85s', 6: '.86p .86g .86l .86s', 1: '(TI-81 has no link port)' };
  async function renderMenu() {
    $('#m-send-info').textContent = SENDEXT[model.id];
    $('#m-send').disabled = model.id === '1';
    const snap = await DB.get('snapdate:' + model.id);
    $('#m-restore').disabled = !snap;
    $('#m-restore').querySelector('small')?.remove();
    const sm = document.createElement('small'); sm.textContent = snap ? 'Saved ' + new Date(snap).toLocaleString() : 'No snapshot yet'; $('#m-restore').appendChild(sm);
    document.querySelectorAll('#s-lcd button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.lcd));
    document.querySelectorAll('#s-speed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === S.speed));
    $('#s-grid').checked = S.grid; $('#s-auto').checked = S.autoContrast;
    $('#about').textContent = `${model.name} on the TilEm 2 emulator core (Benjamin Moody et al.), with the free BootFree boot code from Wabbitemu for OS installs, as packaged by Graph89. Free software under the GNU GPL v3. ${model.short} and its operating system are © Texas Instruments; this app contains no TI code.`;
  }
  function bindMenu() {
    $('#m-send').onclick = () => $('#file-send').click();
    $('#file-send').onchange = async (e) => {
      const fs = Array.from(e.target.files || []); e.target.value = ''; closeSheets();
      for (const f of fs) {
        try { const bytes = await readFile(f); core.sendFile(f.name, bytes); toast('Sent ' + f.name); }
        catch (err) { toast(f.name + ': ' + err.message); }
      }
      forceDraw = true; dirty = true;
    };
    $('#m-shot').onclick = () => { closeSheets(); screenshotPNG(); };
    $('#m-save').onclick = async () => { const st = core.saveState(); await DB.set('snap:' + model.id, st); await DB.set('snapdate:' + model.id, Date.now()); closeSheets(); toast('Snapshot saved'); };
    $('#m-restore').onclick = async () => { const st = await DB.get('snap:' + model.id); if (!st) return; try { core.load(st.rom, model.id); core.loadState(st.sav); toast('Snapshot restored'); } catch (e) { toast(e.message); } closeSheets(); forceDraw = true; };
    $('#m-reset').onclick = () => { closeSheets(); core.reset(); core.turnOn(); toast('Calculator restarted'); };
    $('#m-os').onclick = () => { closeSheets(); if (EMBED) askReplace(); else $('#file-os').click(); };
    if (EMBED) { $('#m-os').firstElementChild.textContent = 'Replace OS or change calculator'; const o = $('#btn-other'); if (o) { o.hidden = false; o.onclick = askReplace; } }
    document.querySelectorAll('#s-lcd button').forEach((b) => b.onclick = () => { S.lcd = b.dataset.v; applyLcd(); saveSettings(); renderMenu(); });
    document.querySelectorAll('#s-speed button').forEach((b) => b.onclick = () => { S.speed = +b.dataset.v; saveSettings(); renderMenu(); });
    $('#s-grid').onchange = (e) => { S.grid = e.target.checked; saveSettings(); forceDraw = true; };
    $('#s-auto').onchange = (e) => { S.autoContrast = e.target.checked; saveSettings(); forceDraw = true; };
  }
  function applyLcd() { const l = $('#lcd'); l.classList.remove('paper', 'night'); if (S.lcd !== 'stn') l.classList.add(S.lcd); layoutScreen(); }

  /* ------------------------------------------------------------------ hardware keyboard */
  const HWK = { Enter: 0x09, ArrowUp: 4, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 };
  const HWHELD = new Set();
  function bindHardwareKeys() {
    window.addEventListener('keydown', (e) => {
      if (openSheet || !core || !running || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = HWK[e.key];
      if (k) { e.preventDefault(); if (!HWHELD.has(k)) { HWHELD.add(k); keyDown(k); } return; }
      if (e.key === 'Backspace') { e.preventDefault(); const del = [...PAD.cluster.flat()].find((d) => d.p === 'del'); if (del) enqueueTap([del.k]); return; }
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

  /* ------------------------------------------------------------------ firmware & lifecycle */
  async function saveState(quiet) {
    if (!core || !core.loaded || !running) return;
    try { await DB.set('state:' + model.id, core.saveState()); } catch (e) { if (!quiet) toast('Could not save: ' + e.message); }
  }
  function setupText() {
    $('#setup-title').textContent = model.name;
    $('#setup-text').textContent = model.os
      ? 'Runs the real ' + model.short + ' operating system. Load an OS upgrade file from Texas Instruments or a ROM image dumped from your own calculator; it stays on this phone.'
      : 'Runs the real ' + model.short + ' operating system. Load a ROM image dumped from your own calculator; it stays on this phone.';
    $('#setup-fine').innerHTML = model.os
      ? 'Accepts a TI OS upgrade (<b>' + model.os + '</b>, free from education.ti.com) or a ROM dump (<b>.rom</b>, <b>.bin</b>). A free replacement boot code is used, so no TI boot code is needed.'
      : 'Accepts a ROM dump (<b>.rom</b>, <b>.bin</b>) of a ' + model.short + '. TI never published downloadable firmware for this model; tools such as TiLP’s ROM dumper read it from the calculator over a link cable.';
    const box = $('#models'); box.innerHTML = '';
    for (const m of MODELS) {
      const b = document.createElement('button'); b.className = m.id === model.id ? 'on' : '';
      b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = m.short; b.lastChild.textContent = m.os ? 'OS file or ROM' : 'ROM dump';
      b.onclick = () => switchModel(m.id);
      box.appendChild(b);
    }
  }
  async function switchModel(id) {
    if (running) await saveState(true);
    running = false;
    model = MODELS.find((m) => m.id === id) || MODELS[0];
    PAD = model.pad(); TYPEMAP = null;
    SECOND = PAD.cluster[0][0].k; ALPHA = 'alpha' in PAD ? PAD.alpha : PAD.cluster[1][0].k;
    document.body.dataset.themeModel = model.theme;
    document.title = model.name;
    buildPad(); setMode(null);
    try { if (window.parent !== window) window.parent.postMessage({ type: 'classic-model', model: model.id }, '*'); } catch (e) {}
    const rom = await DB.get('rom:' + model.id);
    if (rom) { $('#setup').hidden = true; boot(rom, await DB.get('state:' + model.id)); }
    else { setupText(); $('#setup').hidden = false; }
  }
  async function installFirmware(file) {
    const err = $('#setup-err'); err.hidden = true;
    try {
      const bytes = await readFile(file);
      const isOS = bytes.length > 8 && String.fromCharCode(...bytes.subarray(0, 8)) === '**TIFL**';
      let rom, target = model;
      if (isOS) {
        if (!model.os) throw new Error(model.short + ' has no OS upgrade files. Load a ROM dump instead, or pick a TI-83 Plus / TI-84 Plus model.');
        rom = core.romFromOS(bytes, model.id);
      } else {
        // Keep the model the user picked when the dump fits it; otherwise use TilEm's guess.
        const ROMSIZE = { 7: 0x80000, 1: 0x8000, 2: 0x20000, 3: 0x40000, p: 0x80000, s: 0x200000, 4: 0x100000, z: 0x200000, 5: 0x20000, 6: 0x40000 };
        if (bytes.length < ROMSIZE[model.id] || bytes.length > ROMSIZE[model.id] * 1.01 + 4096) {
          const g = core.guessModel(bytes);
          const gm = MODELS.find((m) => m.id === g);
          if (!gm) throw new Error('This file is ' + Math.round(bytes.length / 1024) + ' KB; a ' + model.short + ' ROM is ' + ROMSIZE[model.id] / 1024 + ' KB.');
          target = gm; toast('This is a ' + gm.name + ' ROM; switching to it.', 4000);
        }
        rom = bytes;
      }
      core.load(rom, target.id);              // validates size
      await DB.set('rom:' + target.id, rom); await DB.del('state:' + target.id);
      if (target.id !== model.id) { await switchModel(target.id); return; }
      $('#setup').hidden = true;
      boot(rom, null);
      toast(isOS ? 'OS installed. It may say “RAM cleared” on first start.' : 'ROM loaded');
    } catch (e) {
      const msg = 'That file didn’t work: ' + e.message;
      if (!$('#setup').hidden) { err.textContent = msg; err.hidden = false; } else toast(msg, 6000);
    }
  }
  function boot(rom, state) {
    core.load(rom, model.id);
    W = core.w; H = core.h; layoutScreen();
    let resumed = false;
    if (state && state.sav) { try { core.load(state.rom, model.id); core.loadState(state.sav); resumed = true; } catch (e) { console.warn('state', e); core.load(rom, model.id); } }
    if (!resumed) core.turnOn();
    running = true; lastT = 0; forceDraw = true; requestAnimationFrame(frame);
  }
  window.__closeOverlay = () => { if (!$('#pop').hidden) { closePop(); return true; } if (openSheet) { closeSheets(); return true; } return false; };
  window.onAndroidPause = () => { saveState(true); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(true); else lastT = 0; });
  window.addEventListener('pagehide', () => saveState(true));

  async function main() {
    document.body.dataset.themeModel = model.theme;
    document.querySelectorAll('.dk').forEach(attachHold);
    buildPad(); setMode(null); buildTypeSheet(); bindMenu(); bindHardwareKeys();
    $('#type-help').textContent = 'Typed text is entered as key presses: digits, operators, letters (via alpha), sin( cos( tan( log( ln( sqrt( pi -> and Ans.';
    $('#btn-type').onclick = () => showSheet('#sheet-type');
    $('#btn-menu').onclick = () => showSheet('#sheet-menu');
    $('#scrim').onclick = closeSheets;
    $('#btn-load-os').onclick = () => $('#file-os').click();
    $('#file-os').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) installFirmware(f); };
    window.addEventListener('resize', layoutScreen);
    await DB.open();
    const st = await DB.get('settings'); if (st) S = { ...DEFAULTS, ...st };
    applyLcd();
    const wasm = await (await fetch('core/tz80.wasm')).arrayBuffer();
    core = await TiZ80.Z80Core.create(wasm);
    await switchModel(model.id);
    requestAnimationFrame(layoutScreen);
    window.__classic = { core: () => core, typeText, enqueueTap, model: () => model, switchModel };
    emuBridge(() => saveState(true), installFirmware);
  }
  main().catch((e) => { console.error(e); toast('Could not start: ' + e.message, 10000); });
})();
