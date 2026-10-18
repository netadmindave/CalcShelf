// One-time setup in wasm: build flash from dumps, boot the bootloader, send the OS, wait for the OS to come up.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { MemFS, MemWASI } = createRequire(import.meta.url)('../../../app/www/hp/js/memwasi.js');
const W = (process.env.NS_FW || './fw') + '/wrun', mfs = new MemFS();
for (const f of ['boot1.img', 'manuf.img', 'btldr.img', 'diags.img', 'instl.img', 'os.tcc2']) mfs.write('/' + f, fs.readFileSync(W + '/' + f));
const wasi = new MemWASI(mfs, { stdout: () => {}, stderr: () => {} });
let mem; const dec = new TextDecoder(); let usb = 0;
const env = { ns_log: (p, n) => { const s = dec.decode(new Uint8Array(mem.buffer, p, n)); if (!/Sending file/.test(s)) process.stdout.write('[core] ' + s); }, ns_usb: (c) => { usb = c; } };
const inst = await WebAssembly.instantiate(await WebAssembly.compile(fs.readFileSync(process.env.NS_WASM || new URL('../nspire_lto.wasm', import.meta.url).pathname)), { wasi_snapshot_preview1: wasi.imports, env });
mem = inst.exports.memory; wasi.setMemory(mem); inst.exports._initialize(); const X = inst.exports;
const T0 = Date.now(); console.log('flash', X.ns_flash_create(1), Date.now() - T0, 'ms'); console.log('start', X.ns_start(0));
let v = 0, sent = false, done = -1, lastP = -1;
while (v < 2400) {               // up to 400 virtual s, in 1 s steps
  X.ns_run(100); v += 100;
  if (!sent && v >= 800) { X.ns_send_os(); sent = true; console.log('send OS at', v / 100, 's virt,', ((Date.now() - T0) / 1000).toFixed(1), 's real'); }
  const p = X.ns_progress(); if (sent && p !== lastP && (p % 20 === 0 || p === 100)) { console.log('progress', p, '%', ((Date.now() - T0) / 1000).toFixed(1), 's real', v / 100, 's virt'); lastP = p; }
  if (p === 100 && done < 0) done = v;
  if (done > 0 && v >= done + 3000) break;   // 30 virtual s after the transfer: the OS should be up
}
const q = X.ns_lcd(); const px = new Uint16Array(mem.buffer, q, 320 * 240); const b = Buffer.alloc(15 + 320 * 240 * 3); b.write('P6 320 240 255\n'); let o = 15; for (const x of px) { b[o++] = (x >> 11) << 3; b[o++] = ((x >> 5) & 63) << 2; b[o++] = (x & 31) << 3; } fs.writeFileSync(W + '/i_end.ppm', b);
let used = 0; const bs = X.ns_flash_block_size(), fp = X.ns_flash_ptr(); for (let i = 0; i < X.ns_flash_blocks(); i++) { const blk = new Uint8Array(mem.buffer, fp + i * bs, bs); if (blk.some((x) => x !== 0xff)) used++; }
console.log('total real', ((Date.now() - T0) / 1000).toFixed(1), 's; non-empty flash blocks', used, 'x', bs);
