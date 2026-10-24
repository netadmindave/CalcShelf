// Builds the CalcShelf modules: writes app/www/modules/*.json (built into the app) and modules/*.json (the repository
// folder on GitHub that the app's "Browse modules" opens), and checks each one with the app's own module validator.
// Run: node core-build/modules/build.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), WWW = path.join(ROOT, 'app', 'www');

// the app's data files and validator, loaded the way the browser loads them
const ctx = { self: {}, console, Math, JSON };
ctx.self = ctx; ctx.UI = { el: () => ({}), toast() {}, renderTex() {}, Sheet: {}, DB: {} };
vm.createContext(ctx);
for (const f of ['data/formulas.js', 'data/constants.js', 'js/modules.js']) vm.runInContext(fs.readFileSync(path.join(WWW, f), 'utf8'), ctx, { filename: f });
const { FORMULAS, CONSTANTS, Modules } = ctx;

const mods = { optics: require('./optics')({ FORMULAS, CONSTANTS }), machinist: require('./machinist')(), template: require('./template')() };
const builtIn = ['optics', 'machinist'];
fs.mkdirSync(path.join(WWW, 'modules'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'modules'), { recursive: true });
let bad = 0;
for (const [id, m] of Object.entries(mods)) {
  let clean;
  try { clean = Modules.validate(JSON.parse(JSON.stringify(m))); } catch (e) { console.error('✗', id, e.message); bad++; continue; }
  const json = JSON.stringify(m, null, 1) + '\n';
  if (builtIn.includes(id)) fs.writeFileSync(path.join(WWW, 'modules', id + '.json'), json);
  fs.writeFileSync(path.join(ROOT, 'modules', m.id + '.json'), json);
  const n = {}; for (const s of clean.sections) for (const it of s.items) n[it.type] = (n[it.type] || 0) + 1;
  console.log('✓', id, (json.length / 1024).toFixed(0) + ' KB', JSON.stringify(n));
}
fs.writeFileSync(path.join(WWW, 'modules', 'index.json'), JSON.stringify({ modules: builtIn.map((x) => x + '.json') }) + '\n');
fs.writeFileSync(path.join(ROOT, 'modules', 'index.json'), JSON.stringify({ format: 'calcshelf-module-index', modules: Object.values(mods).map((m) => ({ id: m.id, name: m.name, version: m.version, file: m.id + '.json', description: m.description })) }, null, 1) + '\n');
if (bad) process.exit(1);
