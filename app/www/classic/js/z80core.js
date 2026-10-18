/*
 * z80core.js — JavaScript façade over the TilEm WebAssembly core (TI-81/82/83/83+/84+/85/86).
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const MW = (typeof module !== 'undefined' && module.exports) ? require('./memwasi.js') : root.MemWASI;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  /* TilEm model letters */
  const MODEL = { TI73: '7', TI81: '1', TI82: '2', TI83: '3', TI83P: 'p', TI83PSE: 's', TI84P: '4', TI84PSE: 'z', TI85: '5', TI86: '6' };

  class Z80Core {
    static async create(wasmSource, opts = {}) {
      const c = new Z80Core(opts);
      await c._init(wasmSource);
      return c;
    }
    constructor(opts) {
      this.fs = new MW.MemFS();
      this.log = [];
      const keep = (s) => { this.log.push(s); if (this.log.length > 200) this.log.shift(); if (opts.verbose) console.log('[z80]', s); };
      this.wasi = new MW.MemWASI(this.fs, { stdout: keep, stderr: keep });
      this.loaded = false;
    }
    async _init(src) {
      const imports = { wasi_snapshot_preview1: this.wasi.imports, env: {} };
      let inst;
      if (src instanceof WebAssembly.Module) inst = await WebAssembly.instantiate(src, imports);
      else { const r = await WebAssembly.instantiate(src, imports); inst = r.instance; }
      this.x = inst.exports;
      this.wasi.setMemory(this.x.memory);
      if (this.x._initialize) this.x._initialize();
    }
    get mem() { return new Uint8Array(this.x.memory.buffer); }
    cstr(ptr) { const m = this.mem; let e = ptr; while (m[e]) e++; return dec.decode(m.subarray(ptr, e)); }
    withStr(s, fn) {
      const b = enc.encode(s);
      const p = this.x.tz_alloc(b.length + 1);
      this.mem.set(b, p); this.mem[p + b.length] = 0;
      try { return fn(p); } finally { this.x.tz_free(p); }
    }
    /** Guess the model of a ROM dump (returns a model letter or ''). */
    guessModel(romBytes) {
      this.fs.write('/tmp/guess.rom', romBytes);
      const c = this.withStr('/tmp/guess.rom', (p) => this.x.tz_guess_model(p));
      this.fs.remove('/tmp/guess.rom');
      return c ? String.fromCharCode(c) : '';
    }
    /** Build a ROM image from a TI OS upgrade (.8xu) with the free BootFree boot code. */
    romFromOS(osBytes, model) {
      this.fs.write('/tmp/os.8xu', osBytes);
      const err = this.withStr('/tmp/os.8xu', (s) => this.withStr('/data/calc.rom', (d) => this.x.tz_rom_from_os(s, d, model.charCodeAt(0))));
      this.fs.remove('/tmp/os.8xu');
      if (err) throw new Error(['', 'This model cannot be built from an OS file', 'Not a TI-83 Plus / TI-84 Plus OS upgrade file', 'Could not install the OS', 'Write failed'][-err] || 'OS install failed (' + err + ')');
      const rom = this.fs.read('/data/calc.rom').slice();
      this.loaded = false;
      return rom;
    }
    /** Load a ROM image for `model` (letter). */
    load(romBytes, model) {
      this.fs.write('/data/calc.rom', romBytes);
      const err = this.withStr('/data/calc.rom', (p) => this.x.tz_load(p, model.charCodeAt(0)));
      if (err) throw new Error(err === 1 ? 'The ROM image is too small for this model' : 'Could not load the ROM image (' + err + ')');
      this.model = model; this.loaded = true;
      this.w = this.x.tz_lcd_w(); this.h = this.x.tz_lcd_h();
      this.frame = new Uint8Array(this.x.memory.buffer, this.x.tz_frame(), this.w * this.h);
    }
    modelName() { return this.cstr(this.x.tz_model_name()); }
    keyName(sc) { return this.cstr(this.x.tz_key_name(sc)); }
    reset() { this.x.tz_reset(); }
    turnOn() { this.x.tz_turn_on(); }
    run(ms, speed = 1) { this.x.tz_run(Math.max(1, Math.round(ms * 1000 * speed))); }
    asleep() { return !!this.x.tz_asleep(); }
    key(sc, down) { this.x.tz_key(sc, down ? 1 : 0); }
    /** {on, changed, pixels (Uint8Array w*h, 0..255 darkness), w, h} */
    screen() {
      const f = this.x.tz_screen();
      if (this.frame.buffer !== this.x.memory.buffer) this.frame = new Uint8Array(this.x.memory.buffer, this.x.tz_frame(), this.w * this.h);
      return { on: !!(f & 1), changed: !!(f & 4), pixels: this.frame, w: this.w, h: this.h, contrast: (f >> 8) & 0xff };
    }
    /** Returns {rom, sav} — the ROM holds the Flash archive on Flash models. */
    saveState() {
      const err = this.withStr('/data/calc.rom', (r) => this.withStr('/data/calc.sav', (s) => this.x.tz_save_state(r, s)));
      if (err) throw new Error('Save state failed (' + err + ')');
      return { rom: this.fs.read('/data/calc.rom').slice(), sav: this.fs.read('/data/calc.sav').slice() };
    }
    loadState(sav) {
      this.fs.write('/data/calc.sav', sav);
      const err = this.withStr('/data/calc.sav', (p) => this.x.tz_load_state(p));
      if (err) throw new Error('Load state failed (' + err + ')');
    }
    /** Send a variable/program/app file (.8xp .8xk .85p .86p …) through the virtual link cable. */
    sendFile(name, bytes) {
      const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
      const path = '/tmp/' + safe;
      this.fs.write(path, bytes);
      const err = this.withStr(path, (p) => this.x.tz_send_file(p));
      this.fs.remove(path);
      if (err) throw new Error('The calculator did not accept ' + name + ' (' + err + '). Make sure it is on the home screen.');
    }
  }

  const api = { Z80Core, MODEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TiZ80 = api;
})(typeof self !== 'undefined' ? self : this);
