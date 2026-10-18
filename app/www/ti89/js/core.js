/*
 * core.js — JavaScript façade over the TiEmu WebAssembly core.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const MW = (typeof module !== 'undefined' && module.exports) ? require('./memwasi.js') : root.MemWASI;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // TiEmu key codes (src/core/ti_hw/keydefs.h)
  const KEYS = {};
  ['DOWN', 'RIGHT', 'UP', 'LEFT', 'HAND', 'SHIFT', 'DIAMOND', '2ND',
    '3', '2', '1', 'F8', 'W', 'S', 'Z', '6', '5', '4', 'F3', 'E', 'D', 'X',
    '9', '8', '7', 'F7', 'R', 'F', 'C', 'STORE', 'COMMA', 'PARIGHT', 'PALEFT', 'F2', 'T', 'G', 'V', 'SPACE',
    'TAN', 'COS', 'SIN', 'F6', 'Y', 'H', 'B', 'DIVIDE', 'P', 'ENTER2', 'LN', 'F1', 'U', 'J', 'N', 'POWER',
    'MULTIPLY', 'APPS', 'CLEAR', 'F5', 'I', 'K', 'M', 'EQUALS', 'NU', 'ESCAPE', 'MODE', 'PLUS', 'O', 'L', 'THETA', 'BACKSPACE',
    'NEGATE', 'PERIOD', '0', 'F4', 'Q', 'A', 'ENTER1', 'MINUS', 'ON', 'ALPHA', 'EE', 'CATALOG', 'HOME', 'PIPE', 'VOID'
  ].forEach((k, i) => { KEYS[k] = i; });

  class Ti89Core {
    static async create(wasmSource, opts = {}) {
      const c = new Ti89Core(opts);
      await c._init(wasmSource);
      return c;
    }
    constructor(opts) {
      this.fs = new MW.MemFS();
      this.log = [];
      const keep = (s) => { this.log.push(s); if (this.log.length > 200) this.log.shift(); if (opts.verbose) console.log('[core]', s); };
      this.wasi = new MW.MemWASI(this.fs, { stdout: keep, stderr: keep });
      this.onFileReceived = opts.onFileReceived || null;
      this.loaded = false;
    }
    async _init(src) {
      const imports = {
        wasi_snapshot_preview1: this.wasi.imports,
        env: { on_file_received: (s, d) => this._fileReceived(this.cstr(s), this.cstr(d)) },
      };
      let inst;
      if (src instanceof WebAssembly.Module) inst = await WebAssembly.instantiate(src, imports);
      else { const r = await WebAssembly.instantiate(src, imports); inst = r.instance; }
      this.inst = inst; this.x = inst.exports;
      this.wasi.setMemory(this.x.memory);
      if (this.x._initialize) this.x._initialize();
      this.x.g89_set_log(1);
    }
    get mem() { return new Uint8Array(this.x.memory.buffer); }
    cstr(ptr) { const m = this.mem; let e = ptr; while (m[e]) e++; return dec.decode(m.subarray(ptr, e)); }
    withStr(s, fn) {
      const b = (s instanceof Uint8Array) ? s : enc.encode(s);
      const p = this.x.g89_alloc(b.length + 1);
      this.mem.set(b, p); this.mem[p + b.length] = 0;
      try { return fn(p); } finally { this.x.g89_free(p); }
    }
    errorText(code) { return this.cstr(this.x.g89_error_text(code)); }

    /** Convert an OS upgrade (.89u) or ROM dump to a TiEmu image. Returns Uint8Array. */
    installOS(bytes, name = 'os.89u') {
      const ext = (name.match(/\.([A-Za-z0-9]+)$/) || [, '89u'])[1].toLowerCase();
      const isRom = ext === 'rom';
      const src = '/data/source.' + ext;
      this.fs.write(src, bytes);
      const err = this.withStr(src, (s) => this.withStr('/data/calc.img', (d) => this.x.g89_install(s, d, isRom ? 1 : 0)));
      this.fs.remove(src);
      if (err) throw new Error('Could not convert OS: ' + this.errorText(err) + ' (' + err + ')');
      const img = this.fs.read('/data/calc.img').slice();
      return img;
    }
    load(imgBytes, grayscale = true) {
      this.fs.write('/data/calc.img', imgBytes);
      const err = this.withStr('/data/calc.img', (p) => this.x.g89_load(p, grayscale ? 1 : 0));
      if (err) throw new Error('Could not load image: ' + this.errorText(err) + ' (' + err + ')');
      this.loaded = true;
      this.cyclesPer30 = this.x.g89_cycles_per_30ms();
      this.x.g89_turn_on();
      this.w = this.x.g89_lcd_w ? this.x.g89_lcd_w() : 160; this.h = this.x.g89_lcd_h ? this.x.g89_lcd_h() : 100;
      this.frame = new Uint8Array(this.x.memory.buffer, this.x.g89_frame(), this.w * this.h);
    }
    reset() { this.x.g89_reset(); this.x.g89_turn_on(); }
    turnOn() { this.x.g89_turn_on(); }
    /** Emulate `ms` of calculator time. */
    run(ms, speed = 1) {
      const instr = Math.max(1, Math.round(this.cyclesPer30 / 4 * (ms / 30) * speed));
      return this.x.g89_run(instr);
    }
    /** Returns {on, busy, changed, contrast, pixels(Uint8Array w*h: 160×100 on the TI-89, 240×128 on the TI-92 / Voyage 200)} */
    screen() {
      const f = this.x.g89_screen();
      // memory may have grown; refresh view
      if (this.frame.buffer !== this.x.memory.buffer) this.w = this.x.g89_lcd_w ? this.x.g89_lcd_w() : 160; this.h = this.x.g89_lcd_h ? this.x.g89_lcd_h() : 100;
      this.frame = new Uint8Array(this.x.memory.buffer, this.x.g89_frame(), this.w * this.h);
      return { on: !!(f & 1), busy: !!(f & 2), changed: !!(f & 4), contrast: (f >> 8) & 0xff, pixels: this.frame };
    }
    key(code, pressed) { this.x.g89_key(typeof code === 'string' ? KEYS[code] : code, pressed ? 1 : 0); }
    /** Type text using the calculator's own char→key tables. Returns false if still typing previous text. */
    /** Type a string of TI-89 charset bytes (string with char codes 0-255, or Uint8Array).
     *  Returns false while the previous text is still being typed. */
    type(text) {
      let b = text;
      if (typeof text === 'string') { b = new Uint8Array(text.length); for (let i = 0; i < text.length; i++) b[i] = text.charCodeAt(i) & 255; }
      return !!this.withStr(b, (p) => this.x.g89_type(p));
    }
    saveState() {
      const err = this.withStr('/data/state.sav', (p) => this.x.g89_save_state(p));
      if (err) throw new Error('Save state failed (' + err + ')');
      return this.fs.read('/data/state.sav').slice();
    }
    loadState(bytes) {
      this.fs.write('/data/state.sav', bytes);
      const err = this.withStr('/data/state.sav', (p) => this.x.g89_load_state(p));
      if (err) throw new Error('Load state failed: ' + this.errorText(err));
    }
    /** Send a TI variable/app file (.89p .89e .89g .89k ...) through the virtual link cable. */
    sendFile(name, bytes) {
      const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
      const path = '/tmp/' + safe;
      this.fs.write(path, bytes);
      const err = this.withStr(path, (p) => this.x.g89_send_file(p));
      this.fs.remove(path);
      if (err) throw new Error('Send failed: ' + this.errorText(err));
    }
    syncClock() { return this.x.g89_sync_clock(); }
    romVersion() { return this.cstr(this.x.g89_rom_version()); }
    _fileReceived(src, dst) {
      const data = this.fs.read(src);
      if (data && this.onFileReceived) this.onFileReceived(dst, data.slice());
    }
  }

  const api = { Ti89Core, KEYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Ti89 = api;
})(typeof self !== 'undefined' ? self : this);
