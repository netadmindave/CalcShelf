/*
 * hpcore.js — wrapper for core/hp48.wasm, the Emu48 core (Sébastien Carlier, Christoph Gießelink,
 * Cyrille de Brébisson, Eric Rechlin; GPL-2.0) with a single-threaded WebAssembly host.
 * Part of CalcShelf, GPL-2.0-or-later.
 */
(function (root) {
  'use strict';
  class HP48Core {
    static async create(wasmBytes) {
      const c = new HP48Core();
      const MW = root.MemWASI;
      const fs = new MW.MemFS();
      c.wasi = new MW.MemWASI(fs, { stdout: () => {}, stderr: () => {} });
      const { instance } = await WebAssembly.instantiate(wasmBytes, { wasi_snapshot_preview1: c.wasi.imports });
      c.x = instance.exports; c.mem = c.x.memory;
      if (c.wasi.setMemory) c.wasi.setMemory(c.mem); else c.wasi.memory = c.mem;
      if (c.x._initialize) c.x._initialize();
      c.x.hp_init();
      c.x.hp_set_clock(Date.now(), -new Date().getTimezoneOffset());
      return c;
    }
    u8(p, n) { return new Uint8Array(this.mem.buffer, p, n); }
    /** ROM file bytes (packed or nibble-per-byte); type 'S' 'G' 'X' 'Q' */
    loadRom(bytes, type, cls) {
      const p = this.x.hp_alloc(bytes.length * 2);
      this.u8(p, bytes.length).set(bytes);
      this.type = type;
      return this.x.hp_rom(p, bytes.length, type.charCodeAt(0), cls) > 0;
    }
    newCalc() { return !!this.x.hp_new(); }
    run(us) { return this.x.hp_run(Math.max(0, Math.min(200000, Math.round(us)))); }
    key(k, down) { this.x.hp_key(k[0], k[1], down ? 1 : 0); }
    get rows() { return this.x.hp_lcd_rows(); }
    lcd() { const p = this.x.hp_lcd(); return this.u8(p, 144 * 80); }
    get boffset() { return this.x.hp_boffset(); }
    get displayOn() { return !!this.x.hp_lcd_on(); }
    get contrast() { return this.x.hp_contrast(); }
    get annun() { return this.x.hp_annun(); }
    get sleeping() { return !!this.x.hp_sleeping(); }
    get serial() { return this.x.hp_serial(); }
    saveState() {
      const n = this.x.hp_state_size(), p = this.x.hp_alloc(n);
      const len = this.x.hp_state_save(p); const out = this.u8(p, len).slice(); this.x.hp_free(p); return out;
    }
    loadState(bytes) {
      const p = this.x.hp_alloc(bytes.length); this.u8(p, bytes.length).set(bytes);
      const ok = this.x.hp_state_load(p, bytes.length); this.x.hp_free(p); return !!ok;
    }
    /** HP 49G / 49g+: the flash ROM (one nibble per byte) changes when you store into port 2 */
    flashDirty(clear) { return this.x.hp_rom_dirty(clear ? 1 : 0); }
    flash() { return this.u8(this.x.hp_rom_ptr(), this.x.hp_rom_size()).slice(); }
    /** put an HP binary object (HPHP48-x / HPHP49-x) or plain text on stack level 1; 0 = ok */
    loadObject(bytes) {
      const p = this.x.hp_alloc(bytes.length * 3 + 32);
      this.u8(p + bytes.length * 2, bytes.length).set(bytes);
      const r = this.x.hp_load_object(p + bytes.length, bytes.length);
      this.x.hp_free(p); return r;
    }
    reset() { this.x.hp_reset(); }
  }
  root.HP48Core = HP48Core;
})(typeof self !== 'undefined' ? self : this);
