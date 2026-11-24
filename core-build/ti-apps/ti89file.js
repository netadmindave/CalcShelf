// TI-89 / TI-92 Plus variable files: an untokenized (text) program, tokenized by the calculator the first time it runs
global.self = global;
require(__dirname + '/../../app/www/ti89/js/ticharset.js');
const CH = self.TI9X_CHARSET;
const MAP = new Map(); CH.forEach((c, i) => { if (c && !MAP.has(c)) MAP.set(c, i); });
MAP.set('ᴇ', 0x95); MAP.set('ℯ', 0x96); MAP.set('\uE001', 0xb4);
function enc(text) {
  const out = [];
  for (const c of text.replace(/⁻¹/g, '\uE001')) {
    if (c === '\n') { out.push(0x0d); continue; }
    const b = MAP.get(c);
    if (b == null) throw new Error('no TI-89 character for ' + JSON.stringify(c) + ' in ' + text.slice(0, 60));
    out.push(b);
  }
  return out;
}
// source: lines after the "name()" line, e.g. ['Prgm', 'Disp 1', 'EndPrgm']; style: how lines are prefixed
function program(folder, name, args, lines, colon = true, lead = false) {
  const text = '(' + args + ')\n' + lines.map((l) => (colon ? ':' : '') + l).join('\n');
  const body = [...(lead ? [0, 0] : []), ...enc(text), 0, 0, 0, 0x19, 0xe4, 0xe5, 0, 0, 0x08, 0xdc];
  const n = body.length;
  const vdata = [0, 0, 0, 0, (n >> 8) & 255, n & 255, ...body];
  const hdr = Buffer.alloc(82);
  hdr.write('**TI89**', 0, 'latin1'); hdr[8] = 1; hdr[9] = 0;
  hdr.write(folder.slice(0, 8), 10, 'latin1');
  hdr.write('CalcShelf Solver', 18, 'latin1');
  Buffer.from([1, 0, 0x52, 0, 0, 0]).copy(hdr, 58);
  hdr.write(name.slice(0, 8), 64, 'latin1');
  hdr[72] = 0x12;
  const total = 82 + vdata.length + 2;
  hdr.writeUInt32LE(total, 76); hdr[80] = 0xa5; hdr[81] = 0x5a;
  let sum = 0; for (const b of vdata) sum += b;
  return Buffer.concat([hdr, Buffer.from(vdata), Buffer.from([sum & 255, (sum >> 8) & 255])]);
}
module.exports = { program, enc };
