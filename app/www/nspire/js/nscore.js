/*
 * nscore.js — JavaScript facade for the Firebird TI-Nspire core (core/nspire.wasm).
 * Firmware files and snapshots go through an in-memory WASI file system (memwasi.js);
 * the 132 MiB NAND flash lives in WebAssembly memory and is read/written block by block.
 * Part of CalcShelf, GPL-3.0-or-later. Firebird © the Firebird developers, GPL-3.0.
 */
(function (root) {
  'use strict';
  const FLASH_SIZE = 132 * 1024 * 1024;

  class NspireCore {
    static async create(wasmBytes, opts = {}) {
      const c = new NspireCore();
      c.fs = new MemWASI.MemFS();
      c.wasi = new MemWASI.MemWASI(c.fs, { stdout: () => {}, stderr: () => {} });
      const dec = new TextDecoder();
      c.onLog = opts.onLog || (() => {}); c.onUsb = opts.onUsb || (() => {});
      const env = {
        ns_log: (p, n) => { try { c.onLog(dec.decode(new Uint8Array(c.mem.buffer, p, n))); } catch (e) { /* ignore */ } },
        ns_usb: (on) => c.onUsb(!!on),
      };
      const { instance } = await WebAssembly.instantiate(wasmBytes, { wasi_snapshot_preview1: c.wasi.imports, env });
      c.x = instance.exports; c.mem = c.x.memory; c.wasi.setMemory(c.mem);
      c.x._initialize();
      return c;
    }
    file(name, bytes) { this.fs.write('/' + name, bytes); }
    removeFile(name) { this.fs.remove('/' + name); }
    /** a new flash from manuf.img, btldr.img, instl.img (+ diags.img) in the file system */
    createFlash(withDiags) { const n = this.x.ns_flash_create(withDiags ? 1 : 0); if (!n) return false; this.flashPtr = this.x.ns_flash_ptr(); return true; }
    /** an empty (erased) flash in memory, to be filled with stored blocks */
    allocFlash() { this.flashPtr = this.x.ns_alloc(FLASH_SIZE); new Uint8Array(this.mem.buffer, this.flashPtr, FLASH_SIZE).fill(0xff); this.x.ns_flash_set(this.flashPtr, FLASH_SIZE); }
    get blockSize() { return 135168; }                // 64 pages × 2112 bytes
    get blockCount() { return 1024; }
    block(i) { return new Uint8Array(this.mem.buffer, this.flashPtr + i * this.blockSize, this.blockSize); }
    dirty(i) { return this.x.ns_flash_dirty(i) === 1; }
    clean(i) { this.x.ns_flash_clean(i); }
    start(fromSnapshot) { return this.x.ns_start(fromSnapshot ? 1 : 0); }
    run(ticks) { this.x.ns_run(ticks); }            // ticks of 10 ms emulated time
    lcd() { return new Uint16Array(this.mem.buffer, this.x.ns_lcd(), 320 * 240); }
    key(id, down) { this.x.ns_key(Math.floor(id / 11), id % 11, down ? 1 : 0); }
    touch(x, y, contact, down) { this.x.ns_touch(x, y, contact ? 1 : 0, down ? 1 : 0); }
    reset() { this.x.ns_reset(); }
    /** the machine state as bytes (RAM, CPU, peripherals; flash blocks changed since the last clean()) */
    suspend() { if (!this.x.ns_suspend()) return null; const b = this.fs.read('/snap.bin'); this.fs.remove('/snap.bin'); return b; }
    sendOS(bytes) { this.file('os.tcc2', bytes); this.x.ns_send_os(); }
    sendFile(name, bytes, remote) {
      const p = this.x.ns_alloc(256), q = this.x.ns_alloc(512), enc = new TextEncoder(), u = new Uint8Array(this.mem.buffer);
      this.file('send_' + name, bytes);
      const a = enc.encode('send_' + name + '\0'), b = enc.encode(remote + '\0'); u.set(a, p); u.set(b, q);
      this.x.ns_send_file(p, q);
    }
    progress() { return this.x.ns_progress(); }
    queued() { return this.x.ns_queue(); }
  }
  NspireCore.FLASH_SIZE = FLASH_SIZE;
  root.NspireCore = NspireCore;
})(typeof self !== 'undefined' ? self : this);
