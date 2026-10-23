/*
 * TI-Nspire CX II CAS — the real TI-Nspire OS on the Firebird core (WebAssembly), with a touch
 * keypad and clickpad laid out like the calculator. The user's own firmware dumps and OS file are
 * installed once; flash blocks and the machine state are kept in IndexedDB.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const bridge = window.TiBridge || (window.parent && window.parent !== window && window.parent.TiBridge) || null;
  const EMBED = window.parent !== window;

  /* ------------------------------------------------------------------ storage */
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        let req;
        try { req = indexedDB.open('nspiretouch', 1); } catch (e) { return res(null); }
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { this.db = req.result; res(this.db); };
        req.onerror = () => res(null);
      });
    },
    get(k) { return new Promise((res) => { if (!this.db) return res(undefined); try { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
    set(k, v) { return this.setMany([[k, v]]); },
    /** several writes in ONE transaction (null value = delete): flash blocks and the snapshot stay consistent */
    setMany(entries) {
      return new Promise((res) => {
        if (!this.db) return res(false);
        try {
          const t = this.db.transaction('kv', 'readwrite'), st = t.objectStore('kv');
          for (const [k, v] of entries) { if (v == null) st.delete(k); else st.put(v, k); }
          t.oncomplete = () => res(true); t.onerror = () => res(false); t.onabort = () => res(false);
        } catch (e) { res(false); }
      });
    },
    /** every [key, value] whose key starts with prefix */
    prefix(p) {
      return new Promise((res) => {
        if (!this.db) return res([]);
        const out = [];
        try {
          const r = this.db.transaction('kv').objectStore('kv').openCursor(IDBKeyRange.bound(p, p + '￿'));
          r.onsuccess = () => { const c = r.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
          r.onerror = () => res(out);
        } catch (e) { res(out); }
      });
    },
    async clear() { if (!this.db) return; const keys = (await this.prefix('')).map(([k]) => [k, null]); await this.setMany(keys); },
  };
  const DEFAULTS = { speed: 1 };
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
  const pipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
  const gz = (u8) => pipe(u8, new CompressionStream('gzip'));
  const gunz = (u8) => pipe(u8, new DecompressionStream('gzip'));
  const allFF = (b) => { for (let i = 0; i < b.length; i += 64) if (b[i] !== 0xff) return false; for (let i = 0; i < b.length; i++) if (b[i] !== 0xff) return false; return true; };

  /* ------------------------------------------------------------------ firmware files */
  const NEED = [
    ['boot1', 'Boot ROM', 'the injected_btrom from eMMUlate (has the keys)'],
    ['manuf', 'Manufacturing data', 'manuf.img'],
    ['btldr', 'Boot loader', 'btldr.img'],
    ['instl', 'Installer', 'instl.img'],
    ['diags', 'Diagnostics', 'diags.img (optional)'],
    ['os', 'Operating system', 'TI-Nspire CX II CAS OS (.tcc2), free from TI'],
  ];
  const fw = {};
  function classify(u8) {
    if (u8.length === 0x80000 && u8[0] === 0x18 && u8[1] === 0xf0 && u8[2] === 0x9f && u8[3] === 0xe5) {
      let keys = false; for (let i = 0x27800; i < 0x28000; i++) if (u8[i]) { keys = true; break; }
      return keys ? 'boot1' : 'boot1-nokeys';
    }
    if (u8[0] === 0x50 && u8[1] === 0x4b) {          // ZIP: an OS file
      const head = new TextDecoder('latin1').decode(u8.subarray(0, 4096));
      return /TI-Nspire\.t(c|n)/.test(head) ? (/\.t(cc|co|ct)2/.test(head) ? 'os' : 'os-old') : 'zip';
    }
    if (u8.length === 0x20000 && u8[0] === 0x50 && u8[1] === 0x0f) return 'manuf';
    const t = new TextDecoder('latin1').decode(u8.subarray(0, 64));
    if (/BOOT LOADE/.test(t)) return 'btldr';
    if (/INSTALLE/.test(t)) return 'instl';
    if (/DIAGS/.test(t)) return 'diags';
    if (/OS LOADE/.test(t)) return 'osldr';
    return 'unknown';
  }
  async function addFiles(files) {
    const err = $('#setup-err'); err.hidden = true; const notes = [];
    for (const f of files) {
      const u8 = await readFile(f); const kind = classify(u8);
      if (NEED.some((n) => n[0] === kind)) {
        fw[kind] = u8; await DB.set('fw:' + kind, u8);
        if (kind === 'os' && installed && core && mode === 'run') { updateOS(u8); }
      }
      else if (kind === 'boot1-nokeys') notes.push({ nokeys: 1, t: f.name + ' is a boot ROM without its keys: use the injected_btrom file from eMMUlate.' });
      else if (kind === 'osldr') { /* not needed */ }
      else if (kind === 'os-old') notes.push(f.name + ' is an OS for an older TI-Nspire, not the CX II.');
      else notes.push(f.name + ' isn’t a TI-Nspire CX II system file.');
    }
    renderFiles();
    const shown = notes.filter((n) => !(n.nokeys && fw.boot1)).map((n) => n.t || n);
    if (shown.length) { err.textContent = shown.join(' '); err.hidden = false; }
  }
  function renderFiles() {
    const ul = $('#ns-files'); ul.innerHTML = '';
    for (const [k, name, hint] of NEED) {
      const li = document.createElement('li'); li.className = fw[k] ? 'ok' : (k === 'diags' ? 'opt' : 'no');
      const b = document.createElement('b'); b.textContent = name; const s = document.createElement('span'); s.textContent = fw[k] ? 'loaded' : hint;
      li.append(b, s); ul.append(li);
    }
    const ready = NEED.every(([k]) => k === 'diags' || fw[k]);
    $('#btn-install').hidden = !ready; $('#btn-files').textContent = ready ? 'Choose other files' : 'Choose files';
  }

  /* ------------------------------------------------------------------ emulator state */
  let core = null, mode = 'off', installed = false, tick = 0, debt = 0, last = 0;
  let installStart = 0, osSent = false, doneTick = -1, saving = false, inputSinceSave = false, lastSave = 0;
  let vAcc = 0, rAcc = 0;
  const held = new Map();     // key id -> { t: tick pressed, rel: released by the finger }
  const seq = [];             // queued presses for typing and ctrl+key: { down|up: id } | { wait: ticks }
  let busyUntilFree = 0;

  async function makeCore() {
    const wasm = await (await fetch('core/nspire.wasm')).arrayBuffer();
    if (!WebAssembly.validate(wasm)) throw new Error('this phone’s WebView is too old for the emulator (it needs WebAssembly exception handling). Update “Android System WebView” or Chrome from the Play Store, then try again');
    return NspireCore.create(wasm, { onLog: (s) => { if (/error|abort|Incomplete/i.test(s)) console.warn('[nspire]', s.trim()); } });
  }
  function setBusy(text, pct) {
    $('#busy').hidden = text == null;
    if (text != null) { $('#busy-text').textContent = text; $('#busy-bar').style.width = (pct == null ? 0 : pct) + '%'; $('#busy-bar').parentNode.hidden = pct == null; }
  }

  async function install() {
    $('#setup').hidden = true; setBusy('Building the flash…', 2);
    await new Promise((r) => setTimeout(r, 30));
    try {
      core = await makeCore();
      for (const k of ['manuf', 'btldr', 'instl', 'diags']) if (fw[k]) core.file(k + '.img', fw[k]);
      core.file('boot1.img', fw.boot1);
      if (!core.createFlash(!!fw.diags)) throw new Error('the system files could not be combined into a flash image');
      const product = core.start(false);
      if (!product) throw new Error('the emulator could not start with this boot ROM');
      for (const k of ['manuf', 'btldr', 'instl', 'diags']) core.removeFile(k + '.img');
      mode = 'install'; installStart = tick = 0; osSent = false; doneTick = -1;
      setBusy('Starting the boot loader…', 5);
      run();
    } catch (e) {
      setBusy(null); $('#setup').hidden = false; const err = $('#setup-err'); err.textContent = 'Setup failed: ' + e.message; err.hidden = false;
    }
  }
  function installStep() {
    if (!osSent && tick >= 800) { core.sendOS(fw.os); osSent = true; }
    if (!osSent) { setBusy('Starting the boot loader…', 5 + tick / 800 * 5); return; }
    const p = core.progress();
    if (p >= 0 && p < 100) setBusy('Installing the OS… ' + p + '%', 10 + p * 0.8);
    if (p === 100 && doneTick < 0) { doneTick = tick; core.removeFile('os.tcc2'); }
    if (doneTick >= 0) {
      setBusy('Starting the TI-Nspire OS (first start takes a minute)…', 90 + Math.min(9, (tick - doneTick) / 600));
      if ((tick - doneTick > 500 && tick % 50 === 0 && osUp()) || tick - doneTick > 30000) finishInstall();
    }
  }
  /** the OS's own screens are light; the boot loader and boot logo are black */
  function osUp() {
    const fb = core.lcd(); let light = 0, n = 0;
    for (let y = 8; y < 240; y += 16) for (let x = 8; x < 320; x += 16) { const v = fb[y * 320 + x]; n++; if (((v >> 11) + ((v >> 6) & 31) + (v & 31)) > 66) light++; }
    return light / n > 0.5;
  }
  async function finishInstall() {
    if (mode !== 'install') return;
    mode = 'run'; installed = true; setBusy('Saving…', 100);
    await saveState(true, true);          // every used block: the boot loader and installer were never marked as changed
    await DB.set('fl:ok', true);
    setBusy(null); toast('Installed. Choose your language and press enter.', 5000);
  }
  async function updateOS(bytes) {
    core.sendOS(bytes); mode = 'osupdate'; toast('Sending the OS to the calculator…');
  }

  async function resume() {
    setBusy('Loading…', 10);
    core = await makeCore();
    core.file('boot1.img', fw.boot1);
    core.allocFlash();
    const groups = await DB.prefix('fg:'), gb = 16 * core.blockSize;
    let n = 0;
    for (const [k, v] of groups) {
      const g = Number(k.slice(3)); if (!(g >= 0 && g < 64) || !(v instanceof Uint8Array)) continue;
      new Uint8Array(core.mem.buffer, core.flashPtr + g * gb, gb).set(await gunz(v)); setBusy('Loading…', 10 + 75 * (++n) / groups.length);
    }
    const snap = await DB.get('snap');
    let product = 0;
    if (snap) { setBusy('Resuming…', 90); core.file('snap.bin', await gunz(snap)); product = core.start(true); core.removeFile('snap.bin'); }
    if (!product) { setBusy('Starting…', 92); product = core.start(false); }
    setBusy(null);
    if (!product) { toast('The calculator could not start. Try Erase this calculator and set it up again.', 8000); return; }
    mode = 'run'; installed = true; run();
  }

  /** flash blocks changed since the last save + the machine state, written in one transaction */
  async function saveState(force, full) {
    if (!core || saving || (mode !== 'run' && !force)) return;
    saving = true; const t0 = performance.now();
    try {
      const G = 16, gb = G * core.blockSize, copies = [];
      for (let g = 0; g < core.blockCount / G; g++) {
        let d = full; for (let i = g * G; i < g * G + G; i++) if (core.dirty(i)) { d = true; core.clean(i); }
        if (d) copies.push([g, new Uint8Array(core.mem.buffer, core.flashPtr + g * gb, gb).slice()]);
      }
      const snap = core.suspend();
      const entries = [];
      for (const [g, b] of copies) entries.push(['fg:' + g, allFF(b) ? null : await gz(b)]);
      if (snap) entries.push(['snap', await gz(snap)]);
      await DB.setMany(entries);
      console.info('[nspire] saved', copies.length, 'flash groups + state in', Math.round(performance.now() - t0), 'ms');
      lastSave = performance.now(); inputSinceSave = false;
    } catch (e) { console.warn(e); }
    saving = false;
  }

  /* ------------------------------------------------------------------ the run loop */
  let rafOn = false;
  function run() { if (!rafOn) { rafOn = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now) {
    if (!core || mode === 'off') { rafOn = false; return; }
    const dt = Math.min(250, now - last); last = now;
    const fast = mode !== 'run' || S.speed === 0;
    if (!fast) debt = Math.min(debt + dt, 250);
    const t0 = performance.now(), budget = fast ? 30 : 14;
    let n = 0;
    while ((fast || debt >= 10) && performance.now() - t0 < budget) {
      serviceKeys();
      core.run(1); tick++; n++; if (!fast) debt -= 10;
      if (mode === 'install') installStep();
      if (mode === 'osupdate') { const p = core.progress(); if (p === 100) { mode = 'run'; toast('OS sent. The calculator installs it and restarts.', 5000); } }
    }
    vAcc += n * 10; rAcc += dt;
    if (rAcc >= 1000) { showSpeed(vAcc / rAcc); vAcc = rAcc = 0; }
    draw();
    if (mode === 'run' && inputSinceSave && now - lastSave > 90000) saveState();
    requestAnimationFrame(frame);
  }
  function showSpeed(sp) {
    const st = $('#status');
    if (mode !== 'run') { st.textContent = ''; return; }
    st.textContent = S.speed === 0 ? '×' + sp.toFixed(1) : sp < 0.92 ? Math.round(sp * 100) + '% speed' : '';
  }
  const ctx = $('#screen').getContext('2d'), img = ctx.createImageData(320, 240), px32 = new Uint32Array(img.data.buffer);
  function draw() {
    const fb = core.lcd();
    for (let i = 0; i < 76800; i++) { const v = fb[i], r = v >> 11, g = (v >> 5) & 63, b = v & 31; px32[i] = 0xff000000 | (((b << 3) | (b >> 2)) << 16) | (((g << 2) | (g >> 4)) << 8) | ((r << 3) | (r >> 2)); }
    ctx.putImageData(img, 0, 0);
  }

  /* ------------------------------------------------------------------ keys */
  function serviceKeys() {
    for (const [id, h] of held) if (h.rel && tick - h.t >= 4) { core.key(id, false); held.delete(id); }
    if (seq.length && tick >= busyUntilFree) {
      const s = seq.shift();
      if ('down' in s) { core.key(s.down, true); } else if ('up' in s) { core.key(s.up, false); } else if ('wait' in s) busyUntilFree = tick + s.wait;
      else if ('touch' in s) core.touch(s.touch[0], s.touch[1], s.touch[2], s.touch[3]);
    }
  }
  function press(id) { if (!core) return; core.key(id, true); held.set(id, { t: tick, rel: false }); inputSinceSave = true; }
  function release(id) { const h = held.get(id); if (h) h.rel = true; }
  function tapSeq(ids) { for (const id of ids) seq.push({ down: id }, { wait: 4 }, { up: id }, { wait: 3 }); inputSinceSave = true; }
  const CTRL = 86, SHIFT = 85;

  const K = (id, f, s, t, span) => ({ id, f, s, t, span });
  const LEFT = [K(73, 'esc', 'undo', 'word'), K(65, '⊞', '', 'word'), K(75, 'tab', '', 'word'), K(86, 'ctrl', '', 'ctrl word'), K(85, 'shift', 'caps', 'shift word')];
  const RIGHT = [K(9, '⌂ on', 'off', 'home word'), K(69, 'doc', '+page', 'word'), K(71, 'menu', '', 'word'), null, K(56, 'var', 'sto→', 'word'), K(64, 'del', 'clear', 'word')];
  const MAIN = [
    K(51, '=', '≠≥>'), K(20, 'trig', '', 'word'), K(40, '7', '', 'num'), K(72, '8', '', 'num'), K(36, '9', '', 'num'), K(63, 'tmpl', ':=', 'word'), K(62, 'catalog', '∞β°', 'word'),
    K(53, '^', 'ⁿ√x'), K(31, 'x²', '√'), K(29, '4', '', 'num'), K(61, '5', '', 'num'), K(25, '6', '', 'num'), K(52, '×', '"□"'), K(41, '÷', ''),
    K(42, 'eˣ', 'ln'), K(21, '10ˣ', 'log'), K(18, '1', '', 'num'), K(70, '2', '', 'num'), K(14, '3', '', 'num'), K(68, '+', ''), K(57, '−', ''),
    K(60, '(', '[ ]'), K(58, ')', '{ }'), K(7, '0', '', 'num'), K(59, '.', '', 'num'), K(3, '(−)', 'ans', 'num'), K(1, 'enter', '≈', 'enter2 word', 2),
  ];
  const ALPHA = [
    K(30, 'EE', '', 'al word'), K(50, 'A', '', 'al'), K(49, 'B', '', 'al'), K(48, 'C', '', 'al'), K(46, 'D', '', 'al'), K(45, 'E', '', 'al'), K(44, 'F', '', 'al'), K(39, 'G', '', 'al'), K(8, '?!▸', '', 'al word'),
    K(19, 'π▸', '', 'al word'), K(38, 'H', '', 'al'), K(37, 'I', '', 'al'), K(35, 'J', '', 'al'), K(34, 'K', '', 'al'), K(33, 'L', '', 'al'), K(28, 'M', '', 'al'), K(27, 'N', '', 'al'), K(66, '⚑', '', 'al'),
    K(87, ',', '', 'al'), K(26, 'O', '', 'al'), K(24, 'P', '', 'al'), K(23, 'Q', '', 'al'), K(22, 'R', '', 'al'), K(17, 'S', '', 'al'), K(16, 'T', '', 'al'), K(15, 'U', '', 'al'), K(0, '↵', '', 'al'),
    K(13, 'V', '', 'al'), K(12, 'W', '', 'al'), K(11, 'X', '', 'al'), K(6, 'Y', '', 'al'), K(5, 'Z', '', 'al'), K(4, 'space', '', 'al word', 4),
  ];
  function keyEl(d) {
    if (!d) return document.createElement('span');
    const b = document.createElement('button'); b.className = 'key ' + (d.t || ''); b.dataset.k = d.id;
    b.setAttribute('aria-label', d.f + (d.s ? ', ctrl ' + d.s : ''));
    if (d.span) b.style.gridColumn = 'span ' + d.span;
    const lg = document.createElement('span'); lg.className = 'lg'; const s = document.createElement('span'); s.className = 's'; s.textContent = d.s || ''; lg.append(s);
    const f = document.createElement('span'); f.className = 'face'; f.textContent = d.f;
    b.append(lg, f);
    let y0 = 0, done = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); haptic(); b.classList.add('pressed'); y0 = e.clientY; done = false;
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      if (!(false && d.s)) press(d.id);
    });
    const end = (e) => {
      if (done) return; done = true; b.classList.remove('pressed');
      if (false && d.s) { if (e && e.clientY - y0 < -18) tapSeq([CTRL, d.id]); else tapSeq([d.id]); }
      else release(d.id);
      if (d.id === CTRL || d.id === SHIFT) b.classList.toggle('latched');
      else document.querySelectorAll('.key.latched').forEach((x) => x.classList.remove('latched'));
    };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', () => end(null));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }
  function buildPad() {
    const L = $('#ns-left'), R = $('#ns-right'), M = $('#ns-main'), A = $('#ns-alpha');
    L.innerHTML = R.innerHTML = M.innerHTML = A.innerHTML = '';
    LEFT.forEach((d) => L.append(keyEl(d))); RIGHT.forEach((d) => R.append(keyEl(d)));
    MAIN.forEach((d) => M.append(keyEl(d))); ALPHA.forEach((d) => A.append(keyEl(d)));
  }

  /* ------------------------------------------------------------------ the clickpad */
  function bindTouchpad() {
    const el = $('#touch'); let dot = null, x0 = 0, y0 = 0, holdT = 0, isDown = false, pos = [0.5, 0.5];
    const at = (e) => { const r = el.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    const showDot = (p) => { if (!dot) { dot = document.createElement('span'); dot.className = 'tp-dot'; el.append(dot); } dot.style.left = p[0] * 100 + '%'; dot.style.top = p[1] * 100 + '%'; };
    el.addEventListener('pointerdown', (e) => {
      if (!core) return; e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      pos = at(e); x0 = pos[0]; y0 = pos[1]; isDown = false; showDot(pos); inputSinceSave = true;
      core.touch(pos[0], pos[1], true, false);
      clearTimeout(holdT); holdT = setTimeout(() => { holdT = 0; isDown = true; el.classList.add('pressed'); haptic(); core.touch(pos[0], pos[1], true, true); }, 350);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dot || !core) return; pos = at(e); showDot(pos);
      if (holdT && Math.hypot(pos[0] - x0, pos[1] - y0) > 0.06) { clearTimeout(holdT); holdT = 0; }
      core.touch(pos[0], pos[1], true, isDown);
    });
    const end = () => {
      if (!dot || !core) return;
      if (holdT) {            // a quick tap: click where the finger was (the edge = an arrow, the centre = click)
        clearTimeout(holdT); holdT = 0; haptic();
        seq.push({ touch: [pos[0], pos[1], true, true] }, { wait: 5 }, { touch: [pos[0], pos[1], false, false] }, { wait: 2 });
      } else core.touch(pos[0], pos[1], false, false);
      isDown = false; el.classList.remove('pressed'); dot.remove(); dot = null;
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  const arrow = (dx, dy) => { const x = 0.5 + dx * 0.42, y = 0.5 + dy * 0.42; seq.push({ touch: [x, y, true, true] }, { wait: 5 }, { touch: [x, y, false, false] }, { wait: 2 }); };

  /* ------------------------------------------------------------------ typing and hardware keys */
  const LETTER = { a: 50, b: 49, c: 48, d: 46, e: 45, f: 44, g: 39, h: 38, i: 37, j: 35, k: 34, l: 33, m: 28, n: 27, o: 26, p: 24, q: 23, r: 22, s: 17, t: 16, u: 15, v: 13, w: 12, x: 11, y: 6, z: 5 };
  const CHAR = { 0: [7], 1: [18], 2: [70], 3: [14], 4: [29], 5: [61], 6: [25], 7: [40], 8: [72], 9: [36], '+': [68], '-': [57], '−': [57], '*': [52], '×': [52], '/': [41], '÷': [41], '^': [53], '(': [60], ')': [58], '=': [51], '.': [59], ',': [87], ' ': [4], '[': [CTRL, 60], '{': [CTRL, 58], ']': [], '}': [], '?': [8], 'π': [19] };
  function keysFor(ch) {
    if (LETTER[ch]) return [LETTER[ch]];
    const lo = ch.toLowerCase(); if (LETTER[lo]) return [SHIFT, LETTER[lo]];
    return CHAR[ch] || null;
  }
  function typeChar(ch) { const ks = keysFor(ch); if (!ks) return; if (ks.length === 2) seq.push({ down: ks[0] }, { wait: 3 }, { down: ks[1] }, { wait: 4 }, { up: ks[1] }, { up: ks[0] }, { wait: 3 }); else if (ks.length) tapSeq(ks); }
  /** type plain text; the OS puts what follows ^ in a raised box, so the exponent is typed and then left with → */
  function typeText(text, enter) {
    const t = [...text];
    for (let i = 0; i < t.length; i++) {
      typeChar(t[i]);
      if (t[i] !== '^' || i + 1 >= t.length) continue;
      let j = i + 1;
      if (t[j] === '(') { let d = 0; for (; j < t.length; j++) { if (t[j] === '(') d++; else if (t[j] === ')' && --d === 0) { j++; break; } } }
      else { if (t[j] === '-') j++; while (j < t.length && /[A-Za-z0-9.]/.test(t[j])) j++; }
      const ex = t.slice(i + 1, j); const inner = ex[0] === '(' && ex[ex.length - 1] === ')' ? ex.slice(1, -1) : ex;
      typeText(inner.join(''), false); arrow(1, 0); i = j - 1;
    }
    if (enter) tapSeq([1]);
  }
  function bindHardwareKeys() {
    const MAP = { Enter: 1, Backspace: 64, Delete: 64, Escape: 73, Tab: 75, Home: 9, Shift: SHIFT, Control: CTRL };
    const down = new Set();
    window.addEventListener('keydown', (e) => {
      if (!core || mode !== 'run' || e.target.closest('input, textarea') || !$('#sheet-menu').hidden) return;
      if (e.key.startsWith('Arrow')) { e.preventDefault(); const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; arrow(d[0], d[1]); return; }
      const id = MAP[e.key] ?? (e.key.length === 1 && !e.ctrlKey && !e.metaKey ? (LETTER[e.key.toLowerCase()] ?? (CHAR[e.key] && CHAR[e.key].length === 1 ? CHAR[e.key][0] : undefined)) : undefined);
      if (id === undefined) { if (e.key.length === 1) { const ks = keysFor(e.key); if (ks) { e.preventDefault(); typeText(e.key, false); } } return; }
      e.preventDefault(); if (down.has(e.key)) return; down.add(e.key);
      if (e.key.length === 1 && e.key !== e.key.toLowerCase() && LETTER[e.key.toLowerCase()]) { typeText(e.key, false); return; }
      press(id);
    });
    window.addEventListener('keyup', (e) => { const id = MAP[e.key] ?? LETTER[e.key.toLowerCase()] ?? (CHAR[e.key] && CHAR[e.key][0]); down.delete(e.key); if (id !== undefined) release(id); });
  }

  /* ------------------------------------------------------------------ sheets and menu */
  let openSheet = null;
  function showSheet(id) { closeSheets(); $('#scrim').hidden = false; $(id).hidden = false; openSheet = id; if (id === '#sheet-type') setTimeout(() => $('#type-input').focus(), 60); }
  function closeSheets() { document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; }); $('#scrim').hidden = true; openSheet = null; }
  const askReplace = () => { try { window.parent.postMessage({ type: 'emu-replace' }, location.origin); } catch (e) {} };
  function bindMenu() {
    $('#btn-menu').onclick = () => showSheet('#sheet-menu');
    $('#btn-type').onclick = () => showSheet('#sheet-type');
    $('#scrim').onclick = closeSheets;
    $('#type-send').onclick = () => { const t = $('#type-input').value; if (!t) return; typeText(t, $('#type-autoenter').checked); $('#type-input').value = ''; closeSheets(); };
    $('#type-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#type-send').click(); } });
    $('#m-send').onclick = () => { closeSheets(); $('#file-send').click(); };
    $('#file-send').onchange = async (e) => {
      const files = [...e.target.files]; e.target.value = ''; if (!core || mode !== 'run') return;
      for (const f of files) { core.sendFile(f.name.replace(/[^\w.\- ]+/g, '_'), await readFile(f), '/' + f.name.replace(/[^\w.\- ]+/g, '_')); }
      toast('Sending ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' to My Documents…');
    };
    $('#m-shot').onclick = () => { closeSheets(); $('#screen').toBlob(async (b) => saveBytes('nspire-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png', new Uint8Array(await b.arrayBuffer()), 'image/png'), 'image/png'); };
    $('#m-save').onclick = async () => { closeSheets(); await saveState(); toast('Saved'); };
    $('#m-reset').onclick = () => { closeSheets(); if (core) { core.reset(); toast('Restarting…'); } };
    $('#m-os').onclick = () => { closeSheets(); if (EMBED) askReplace(); else $('#file-os').click(); };
    $('#file-os').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await addFiles([f]); };
    $('#m-erase').onclick = async () => {
      if (!confirm('Erase this TI-Nspire? Its documents, state and firmware files are removed from this phone.')) return;
      mode = 'off'; await DB.clear(); location.reload();
    };
    document.querySelectorAll('#s-speed button').forEach((b) => { b.onclick = () => { S.speed = Number(b.dataset.v); saveSettings(); syncMenu(); }; });
    $('#btn-files').onclick = () => $('#file-fw').click();
    $('#file-fw').onchange = async (e) => { const files = [...e.target.files]; e.target.value = ''; await addFiles(files); };
    $('#btn-install').onclick = () => install();
    if (EMBED) { const o = $('#btn-other'); o.hidden = false; o.onclick = askReplace; }
  }
  function syncMenu() {
    document.querySelectorAll('#s-speed button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === S.speed));
   
  }

  /* ------------------------------------------------------------------ lifecycle + the CalcShelf bridge */
  window.__closeOverlay = () => { if (openSheet) { closeSheets(); return true; } return false; };
  window.onAndroidPause = () => { saveState(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); else last = performance.now(); });
  window.addEventListener('pagehide', () => saveState());
  if (EMBED) {
    window.addEventListener('message', async (e) => {
      const d = e.data; if (!d || e.source !== window.parent) return;
      if (d.type === 'emu-save') { try { await saveState(); } catch (x) { /* ignore */ } window.parent.postMessage({ type: 'emu-saved', id: d.id }, location.origin); }
      else if (d.type === 'emu-install') { await addFiles([new File([d.bytes], d.name)]); if (!installed && NEED.every(([k]) => k === 'diags' || fw[k])) toast('All files loaded. Press Install the OS.'); }
    });
  }

  async function main() {
    buildPad(); bindTouchpad(); bindMenu(); bindHardwareKeys();
    await DB.open();
    const st = await DB.get('settings'); if (st) S = { ...DEFAULTS, ...st };
    syncMenu();
    for (const [k] of NEED) { const v = await DB.get('fw:' + k); if (v) fw[k] = v; }
    renderFiles();
    if (EMBED) window.parent.postMessage({ type: 'emu-ready' }, location.origin);
    if (fw.boot1 && await DB.get('fl:ok')) await resume();
    else $('#setup').hidden = false;
    window.__ns = { core: () => core, mode: () => mode, tick: () => tick, typeText, press, release, arrow, saveState, classify };
  }
  main().catch((e) => { console.error(e); toast('Could not start: ' + e.message, 10000); });
})();
