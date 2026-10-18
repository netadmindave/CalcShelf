import fs from 'node:fs'; import { createRequire } from 'node:module';
const { MemFS, MemWASI } = createRequire(import.meta.url)('../../../app/www/hp/js/memwasi.js');
const C = (process.env.EMU48 || '../emu48android') + '/app/src/main/assets/calculators/';
async function mk(romfile, type) {
  const wasi = new MemWASI(new MemFS(), {});
  const inst = await WebAssembly.instantiate(await WebAssembly.compile(fs.readFileSync(new URL('../hp48.wasm', import.meta.url))), { wasi_snapshot_preview1: wasi.imports });
  const X = inst.exports; wasi.memory = X.memory; if (X._initialize) X._initialize(); X.hp_init(); X.hp_set_clock(Date.now(), 0);
  const rom = fs.readFileSync(romfile); const p = X.hp_alloc(rom.length * 2); new Uint8Array(X.memory.buffer, p, rom.length).set(rom); X.hp_rom(p, rom.length, type.charCodeAt(0), 49);
  return X;
}
const run = (X, ms) => { for (let i = 0; i < ms / 10; i++) X.hp_run(10000); };
const key = (X, o, i) => { X.hp_key(o, i, 1); run(X, 150); X.hp_key(o, i, 0); run(X, 400); };
const lcd = (X) => { const q = X.hp_lcd(); return Buffer.from(new Uint8Array(X.memory.buffer, q, 144 * 80)).toString('base64'); };
for (const [rom, t, keys] of [['rom.48g', 'G', [[8,1],[1,8],[4,16],[1,4]]], ['rom.49g', 'Q', [[5,32],[3,4],[0,1],[3,2]]]]) {
  const A = await mk(C + rom, t); A.hp_new(); run(A, 3000); for (const k of keys) { key(A, ...k); run(A, 1500); }
  const n = A.hp_state_size(), p = A.hp_alloc(n), len = A.hp_state_save(p); const st = new Uint8Array(A.memory.buffer, p, len).slice();
  const dirty = A.hp_rom_dirty(0); let flash = null; if (dirty) flash = new Uint8Array(A.memory.buffer, A.hp_rom_ptr(), A.hp_rom_size()).slice();
  run(A, 500); const l1 = lcd(A);
  // fresh instance: flash (if any) as ROM, then state
  const B = await mk(C + rom, t);
  if (flash) { const q = B.hp_alloc(flash.length * 2); new Uint8Array(B.memory.buffer, q, flash.length).set(flash); console.log('flash reload', B.hp_rom(q, flash.length, t.charCodeAt(0), 49)); }
  const q = B.hp_alloc(len); new Uint8Array(B.memory.buffer, q, len).set(st);
  console.log(t, 'state', len, 'dirty pages', dirty, 'load', B.hp_state_load(q, len)); run(B, 500); const l2 = lcd(B);
  console.log('same screen after resume:', l1 === l2);
  key(B, 4, 16); run(B, 800); console.log('responds after resume:', lcd(B) !== l2);
}
