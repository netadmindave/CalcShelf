// The same save/resume test, but through memwasi.js (the in-memory WASI the app uses).
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { MemFS, MemWASI } = createRequire(import.meta.url)('../../../app/www/hp/js/memwasi.js');
const phase = process.argv[2], W = (process.env.NS_FW || './fw') + '/wrun';
const mfs = new MemFS();
for (const f of ['boot1.img', 'manuf.img', 'btldr.img', 'diags.img', 'instl.img']) mfs.write('/' + f, fs.readFileSync(W + '/' + f));
if (phase === 'resume') mfs.write('/snap.bin', fs.readFileSync(W + '/snap_mem.bin'));
const wasi = new MemWASI(mfs, { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stdout.write(s) });
let mem; const dec = new TextDecoder();
const env = { ns_log: (p, n) => process.stdout.write('[core] ' + dec.decode(new Uint8Array(mem.buffer, p, n))), ns_usb: () => {} };
const inst = await WebAssembly.instantiate(await WebAssembly.compile(fs.readFileSync(process.env.NS_WASM || new URL('../nspire_lto.wasm', import.meta.url).pathname)), { wasi_snapshot_preview1: wasi.imports, env });
mem = inst.exports.memory; wasi.setMemory(mem); inst.exports._initialize(); const X = inst.exports;
const flashFile = phase === 'resume' ? W + '/flash_mem_after.img' : (process.env.NS_FW || './fw') + '/run2/flash.img';
const sz = fs.statSync(flashFile).size, p = X.ns_alloc(sz);
new Uint8Array(mem.buffer, p, sz).set(fs.readFileSync(flashFile)); X.ns_flash_set(p, sz);
const shot = (name) => { const q = X.ns_lcd(); const px = new Uint16Array(mem.buffer, q, 320 * 240); const b = Buffer.alloc(15 + 320 * 240 * 3); b.write('P6 320 240 255\n'); let o = 15; for (const v of px) { b[o++] = (v >> 11) << 3; b[o++] = ((v >> 5) & 63) << 2; b[o++] = (v & 31) << 3; } fs.writeFileSync(W + '/' + name, b); };
const press = (id, ms = 150) => { X.ns_key(Math.floor(id / 11), id % 11, 1); X.ns_run(Math.ceil(ms / 10)); X.ns_key(Math.floor(id / 11), id % 11, 0); X.ns_run(20); };
if (phase === 'save') {
  console.log('start', X.ns_start(0)); X.ns_run(1300); shot('m_lang.ppm');
  press(1); X.ns_run(200); shot('m_enter1.ppm'); press(1); X.ns_run(300); shot('m_enter2.ppm');
  for (let i = 0; i < X.ns_flash_blocks(); i++) X.ns_flash_clean(i);       // flash is persisted separately, as the app will
  let t = Date.now(); console.log('suspend', X.ns_suspend(), Date.now() - t, 'ms');
  const snap = mfs.read('/snap.bin'); console.log('snapshot', snap.length); fs.writeFileSync(W + '/snap_mem.bin', snap);
  fs.writeFileSync(W + '/flash_mem_after.img', new Uint8Array(mem.buffer, p, sz));
} else {
  let t = Date.now(); console.log('resume', X.ns_start(1), Date.now() - t, 'ms'); X.ns_run(50); shot('m_resumed.ppm');
  press(1); X.ns_run(200); shot('m_resumed_enter.ppm'); console.log('mem MB', mem.buffer.byteLength >> 20);
}
