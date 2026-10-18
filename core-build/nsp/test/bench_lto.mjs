// Node benchmark: boot the installed flash in nspire.wasm and measure emulated vs real time.
import { WASI } from 'node:wasi';
import fs from 'node:fs';
const dir = process.argv[2], flashPath = process.argv[3], seconds = +process.argv[4] || 30, out = process.argv[5] || '.';
const wasi = new WASI({ version: 'preview1', preopens: { '/': dir }, args: [], env: {} });
let mem; const dec = new TextDecoder();
const env = { ns_log: (p, n) => process.stdout.write('[core] ' + dec.decode(new Uint8Array(mem.buffer, p, n))), ns_usb: (c) => console.log('[usb]', c) };
const mod = await WebAssembly.compile(fs.readFileSync(process.env.NS_WASM || new URL('../nspire_lto.wasm', import.meta.url).pathname));
const inst = await WebAssembly.instantiate(mod, { wasi_snapshot_preview1: wasi.wasiImport, env });
mem = inst.exports.memory; wasi.initialize(inst);
const X = inst.exports;

let t = Date.now();
if (flashPath === 'create') { const n = X.ns_flash_create(1); console.log('flash created', n, Date.now() - t, 'ms'); }
else { const sz = fs.statSync(flashPath).size; const p = X.ns_alloc(sz); const buf = fs.readFileSync(flashPath); new Uint8Array(mem.buffer, p, buf.length).set(buf); X.ns_flash_set(p, buf.length); console.log('flash loaded', buf.length, Date.now() - t, 'ms'); }
console.log('product', X.ns_start(0).toString(16), 'mem MB', mem.buffer.byteLength >> 20);
const shot = (name) => { const p = X.ns_lcd(); const px = new Uint16Array(mem.buffer, p, 320 * 240); const b = Buffer.alloc(15 + 320 * 240 * 3); b.write('P6 320 240 255\n'); let o = 15; for (const v of px) { b[o++] = (v >> 11) << 3; b[o++] = ((v >> 5) & 63) << 2; b[o++] = (v & 31) << 3; } fs.writeFileSync(out + '/' + name, b); };
const t0 = Date.now(); let busyReal = 0, last = t0;
for (let s = 1; s <= seconds; s++) {
  const a = Date.now(); X.ns_run(100); const dt = Date.now() - a;     // 1 emulated second
  console.log(`virt ${s}s: ${dt} ms real (${(1000 / dt).toFixed(2)}x)`);
  if (s % 5 === 0) shot(`w_${String(s).padStart(3, '0')}.ppm`);
}
console.log('total', ((Date.now() - t0) / 1000).toFixed(1), 's real for', seconds, 's virtual');
