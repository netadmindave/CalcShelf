import { WASI } from 'node:wasi'; import fs from 'node:fs';
const dir = (process.env.NS_FW || './fw') + '/wrun', phase = process.argv[2];
const wasi = new WASI({ version: 'preview1', preopens: { '/': dir } });
let mem; const dec = new TextDecoder();
const env = { ns_log: (p, n) => process.stdout.write('[core] ' + dec.decode(new Uint8Array(mem.buffer, p, n))), ns_usb: () => {} };
const inst = await WebAssembly.instantiate(await WebAssembly.compile(fs.readFileSync(process.env.NS_WASM || new URL('../nspire_lto.wasm', import.meta.url).pathname)), { wasi_snapshot_preview1: wasi.wasiImport, env });
mem = inst.exports.memory; wasi.initialize(inst); const X = inst.exports;
const sz = fs.statSync((process.env.NS_FW || './fw') + '/run2/flash.img').size, p = X.ns_alloc(sz);
new Uint8Array(mem.buffer, p, sz).set(fs.readFileSync((process.env.NS_FW || './fw') + '/run2/flash.img')); X.ns_flash_set(p, sz);
const shot = (name) => { const q = X.ns_lcd(); const px = new Uint16Array(mem.buffer, q, 320 * 240); const b = Buffer.alloc(15 + 320 * 240 * 3); b.write('P6 320 240 255\n'); let o = 15; for (const v of px) { b[o++] = (v >> 11) << 3; b[o++] = ((v >> 5) & 63) << 2; b[o++] = (v & 31) << 3; } fs.writeFileSync((process.env.NS_FW || './fw') + '/wrun/' + name, b); };
const press = (id, ms = 150) => { X.ns_key(Math.floor(id / 11), id % 11, 1); X.ns_run(Math.ceil(ms / 10)); X.ns_key(Math.floor(id / 11), id % 11, 0); X.ns_run(20); };
if (phase === 'save') {
  console.log('start', X.ns_start(0)); X.ns_run(1300); shot('s_lang.ppm');
  press(1); X.ns_run(200); shot('s_after_enter.ppm');
  press(1); X.ns_run(300); shot('s_after_enter2.ppm');
  let t = Date.now(); console.log('suspend', X.ns_suspend(), Date.now() - t, 'ms', fs.statSync(dir + '/snap.bin').size, 'bytes');
  let dirty = 0; for (let i = 0; i < X.ns_flash_blocks(); i++) dirty += X.ns_flash_dirty(i); console.log('dirty flash blocks', dirty, 'of', X.ns_flash_blocks(), 'block size', X.ns_flash_block_size());
  fs.writeFileSync((process.env.NS_FW || './fw') + '/wrun/flash_after.img', new Uint8Array(mem.buffer, p, sz));
} else {
  let t = Date.now(); console.log('resume', X.ns_start(1), Date.now() - t, 'ms'); X.ns_run(50); shot('s_resumed.ppm');
  press(1); X.ns_run(200); shot('s_resumed_enter.ppm');
}
