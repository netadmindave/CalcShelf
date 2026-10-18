const fs = require('fs');
const { Z80Core } = require(__dirname + '/../../../app/www/classic/js/z80core.js');
const T = __dirname + '/';
function ascii(s) { let o = ''; for (let y = 0; y < s.h; y += 4) { let l = ''; for (let x = 0; x < s.w; x += 2) l += s.pixels[y * s.w + x] > 128 ? '#' : '.'; o += l + '\n'; } return o; }
function stats(s) { let on = 0; for (const p of s.pixels) if (p > 128) on++; return on + '/' + s.pixels.length; }
(async () => {
  const wasm = fs.readFileSync(__dirname + '/../../../app/www/classic/core/tz80.wasm');
  for (const [m, f] of [['5', 't85.rom'], ['6', 't86.rom']]) {
    const c = await Z80Core.create(wasm);
    c.load(fs.readFileSync(T + f), m);
    c.run(200); let s = c.screen();
    console.log(m, c.modelName(), c.w + 'x' + c.h, 'on', s.on, 'dark', stats(s), 'row0', [...s.pixels.slice(0, 16)].join(','));
    c.key(1, true); c.run(200); s = c.screen(); console.log('  down held: row0', [...s.pixels.slice(0, 16)].join(','));
    c.key(1, false); c.key(9, true); c.run(200); s = c.screen(); console.log('  enter held: row0', [...s.pixels.slice(0, 16)].join(','));
  }
  const c = await Z80Core.create(wasm);
  const rom = c.romFromOS(fs.readFileSync(T + 'testos.8xu'), 'z');
  console.log('84+SE rom', rom.length, 'p0[56]', rom[0x56].toString(16), rom[0x57].toString(16), 'boot page head', [...rom.slice(rom.length - 0x4000, rom.length - 0x4000 + 8)].map(x => x.toString(16)));
  c.load(rom, 'z'); console.log(c.modelName(), c.w + 'x' + c.h);
  c.run(500); let s = c.screen(); console.log('on', s.on, 'dark', stats(s)); console.log(ascii(s));
  c.key(1, true); c.run(300); s = c.screen(); console.log('down: dark', stats(s), [...s.pixels.slice(0, 12)].join(','));
  const st = c.saveState(); console.log('state', st.rom.length, st.sav.length);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
