// Builds the TI-Nspire CX II version of the Variable Solver: CalcShelf's optics, optoelectronics and semiconductor
// formulas, linked through the same quantities as the app's Variable Solver, rearranged by Giac for every variable
// they can be solved for, and written as Lua data into solver.lua. Then luna packs it into CalcShelf-Solver.tns.
//   node core-build/nspire-solver/build.js [out-dir]
// Needs core-build/nspire-solver/luna (or `luna` on the PATH) for the .tns; without it only solver.lua is written.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), WWW = ROOT + '/app/www';
const OUT = path.resolve(process.argv[2] || __dirname + '/out');
fs.mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- the app's own code, outside a browser */
global.self = global; global.window = global;
global.Units = require(WWW + '/js/units.js');
global.GiacFmt = require(WWW + '/js/giacfmt.js');
require(WWW + '/data/quantities.js');
require(WWW + '/data/formulas.js');
global.UI = { el: () => ({}), toast: () => {}, renderTex: () => {}, Sheet: {} };
const optics = JSON.parse(fs.readFileSync(WWW + '/modules/optics.json', 'utf8'));
global.Modules = { list: [{ m: optics }] };
const LIB_OPTICS = /^Optics:/;
global.FORMULAS = global.FORMULAS.filter((f) => LIB_OPTICS.test(f.cat));
require(WWW + '/js/varsolver.js');
const { VS } = global.VarSolver;
VS.build();

/* ---------------------------------------------------------------- topics */
const TOPIC = {
  'Light & photons': 1, Geometric: 1, Diffraction: 1, 'Gaussian beams': 1, 'Cavities & films': 1, Fibers: 1, 'Frequency combs': 1, Materials: 1,
  'Rays, waves & Fourier': 1, 'Beams & resonators': 1, 'EM, polarization & layers': 1, Waveguides: 1, 'Classical optics': 1,
  Detection: 2, 'Photons & atoms': 2, 'Lasers & amplifiers': 2, 'Semiconductor photonics': 2, 'Acousto-, electro- & nonlinear': 2,
  Communications: 2, 'Laser design': 2, 'Fiber links & receivers': 2, 'Nonlinear fiber optics': 2, 'Ultrafast pulses': 2,
  'Semiconductor physics': 3, 'Junctions & devices': 3,
  'Optics: geometric': 1, 'Optics: materials': 1, 'Optics: interfaces': 1, 'Optics: diffraction': 1, 'Optics: Gaussian beams': 1, 'Optics: cavities': 1,
  'Optics: light & photons': 1, 'Optics: fibers': 1, 'Optics: frequency combs': 1, 'Optics: detection': 2,
};

/* ---------------------------------------------------------------- Giac expressions → Lua and plain text */
class Unsupported extends Error {}
const FN = { sqrt: 'sqrt', exp: 'exp', ln: 'log', log: 'log', log10: 'log10', sin: 'sin', cos: 'cos', tan: 'tan', asin: 'asin', acos: 'acos', atan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh', abs: 'abs', sign: 'sgn', floor: 'floor', ceil: 'ceil', max: 'max', min: 'min',
  sec: 'sec', csc: 'csc', cot: 'cot', erf: 'erf', erfc: 'erfc' };
function toLua(n, idx) {
  const T = (x) => toLua(x, idx);
  switch (n.t) {
    case 'num': { const v = Number(n.v); if (!isFinite(v)) throw new Unsupported('num'); return /e/i.test(n.v) || /\./.test(n.v) ? String(v) : n.v + '.0'; }
    case 'id':
      if (n.v in idx) return 'a[' + idx[n.v] + ']';
      if (n.v === 'pi') return 'PI';
      if (n.v === 'e') return 'EU';
      throw new Unsupported('id ' + n.v);
    case 'paren': return '(' + T(n.a) + ')';
    case 'neg': return '(-' + T(n.a) + ')';
    case 'bin':
      if (n.op === '^') return 'pw(' + T(n.a) + ',' + T(n.b) + ')';
      if ('+-*/'.includes(n.op)) return '(' + T(n.a) + n.op + T(n.b) + ')';
      if (['<', '>', '<=', '>='].includes(n.op)) return '(' + T(n.a) + n.op + T(n.b) + ')';
      if (n.op === '!=') return '(' + T(n.a) + '~=' + T(n.b) + ')';
      if (n.op === '==' || n.op === '=') return '(' + T(n.a) + '==' + T(n.b) + ')';
      if (n.op === 'and' || n.op === 'or') return '(' + T(n.a) + ' ' + n.op + ' ' + T(n.b) + ')';
      throw new Unsupported('op ' + n.op);
    case 'call':
      if (FN[n.f]) return FN[n.f] + '(' + n.args.map(T).join(',') + ')';
      throw new Unsupported('fn ' + n.f);
    default: throw new Unsupported(n.t);
  }
}
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
function toText(n, names, up = 0) {
  const T = (x, p) => toText(x, names, p);
  switch (n.t) {
    case 'num': return n.v;
    case 'id': return names[n.v] || (n.v === 'pi' ? 'π' : n.v);
    case 'paren': return T(n.a, up);
    case 'neg': { const s = '-' + T(n.a, 3); return up > 1 ? '(' + s + ')' : s; }
    case 'bin': {
      const p = PREC[n.op] || 0;
      const s = n.op === '^' ? T(n.a, 5) + '^' + T(n.b, 5) : T(n.a, p) + (n.op === '*' ? '·' : n.op === '=' ? ' = ' : n.op) + T(n.b, n.op === '-' || n.op === '/' ? p + 1 : p);
      return p && p < up ? '(' + s + ')' : s;
    }
    case 'call': return (n.f === 'ln' ? 'ln' : n.f) + '(' + n.args.map((x) => T(x, 0)).join(', ') + ')';
    default: return '?';
  }
}

/* ---------------------------------------------------------------- symbols: TeX → base + subscript (drawn small on the calculator) */
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ',
  kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ',
  omega: 'ω', Omega: 'Ω', hbar: 'ħ', ell: 'ℓ', infty: '∞', circ: '°', prime: '′' };
function plainTex(t) {
  return String(t || '')
    .replace(/\\(?:mathrm|text|mathit|operatorname|boldsymbol|mathbf)\{([^{}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)\s*/g, (m, w) => GREEK[w] || (w === 'cdot' ? '·' : w === 'times' ? '×' : w === 'perp' ? '⊥' : w === 'parallel' ? '∥' : ''))
    .replace(/\^\{?\\?prime\}?|'/g, '′').replace(/[{}]/g, '').replace(/\\,/g, ' ').trim();
}
function symParts(tex) {
  const t = String(tex || '');
  const m = /^(.*?)(?:_\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|_(\\?[A-Za-z0-9]+))(.*)$/.exec(t);
  if (!m) return [plainTex(t), ''];
  return [plainTex(m[1] + (m[4] || '')), plainTex(m[2] != null ? m[2] : m[3])];
}

/* ---------------------------------------------------------------- units: display unit, SI factor, alternatives */
function unitList(u) {
  if (!u) return [];
  let alts = [];
  try { alts = Units.alternatives(u, 1); } catch (e) { alts = []; }
  if (!alts.includes(u)) alts.unshift(u);
  // the units this field uses come first, in this order; the rest of the list follows
  const PREF = ['nm', 'µm', 'mm', 'cm', 'm', 'km', 'pm', 'eV', 'meV', 'J', 'mJ', 'µJ', 'nJ', 'pJ', 'fJ', 'THz', 'GHz', 'MHz', 'kHz', 'Hz',
    'W', 'mW', 'µW', 'nW', 'kW', 's', 'ms', 'µs', 'ns', 'ps', 'fs', '1/cm^3', '1/m^3', 'cm^2', 'm^2', 'mm^2', 'µm^2', 'V', 'mV', 'A', 'mA', 'µA', 'nA'];
  alts = PREF.filter((p) => p !== u && alts.includes(p)).concat(alts.filter((a) => !PREF.includes(a)));
  if (PREF.includes(u)) { alts = PREF.filter((p) => p === u || alts.includes(p)).concat(alts.filter((a) => !PREF.includes(a))); } else alts.unshift(u);
  const out = [];
  for (const a of alts) { try { const f = Units.parse(a).f; if (isFinite(f) && f > 0 && !out.some((o) => o[0] === a)) out.push([a, f]); } catch (e) { /* skip */ } }
  return out.slice(0, 8);
}

(async () => {
  // Giac runs in a worker thread so a solve that never ends can be stopped (15 s each); answers are cached between builds
  const { Worker } = require('worker_threads');
  const WSRC = `const { parentPort } = require('worker_threads'); const fs = require('fs');
    require(${JSON.stringify(ROOT + '/tests/giacnode.js')})().then((ev) => {
      const w = fs.readFileSync(${JSON.stringify(WWW + '/js/cas-worker.js')}, 'utf8');
      const m = w.match(/const PRELUDE = (\\[[\\s\\S]*?\\]);/); if (m) eval(m[1]).forEach(ev);
      parentPort.on('message', (c) => parentPort.postMessage(ev(c))); parentPort.postMessage('__ready');
    });`;
  let worker = null, ready = null;
  const start = () => { worker = new Worker(WSRC, { eval: true }); ready = new Promise((r) => worker.once('message', r)); };
  const CACHE = OUT + '/solve-cache.json';
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { /* first build */ }
  let timeouts = 0;
  const solveG = async (cmd) => {
    if (cmd in cache) return cache[cmd];
    if (!worker) start();
    await ready;
    const r = await new Promise((res) => {
      const t = setTimeout(() => { res(null); }, 15000);
      worker.once('message', (v) => { clearTimeout(t); res(v); });
      worker.postMessage(cmd);
    });
    if (r === null) { timeouts++; process.stderr.write('timed out: ' + cmd.slice(0, 120) + '\n'); await worker.terminate(); worker = null; }
    cache[cmd] = r === null ? '' : r;
    return cache[cmd];
  };

  const F = VS.F.filter((f) => TOPIC[f.cat]);
  const used = new Set(); F.forEach((f) => f.vars.forEach((v) => used.add(v.id)));
  const ids = [...used]; const qIndex = {}; ids.forEach((id, k) => { qIndex[id] = k + 1; });
  const stats = { formulas: F.length, quantities: ids.length, closed: 0, numeric: 0, skipped: 0 };

  const L = [];   // Lua source lines
  const str = (s) => JSON.stringify(String(s == null ? '' : s)).replace(/\\u([0-9a-f]{4})/g, (mm, h) => String.fromCharCode(parseInt(h, 16)));
  L.push('-- generated by core-build/nspire-solver/build.js from CalcShelf ' + JSON.parse(fs.readFileSync(WWW + '/modules/optics.json', 'utf8')).version + ' (optics module) — do not edit');
  L.push('Q={');
  for (const id of ids) {
    const q = VS.Q[id];
    let [b, s] = symParts(q.sym);
    if (/^l(max|min)?$/.test(b + s) && /wavelength/i.test(q.name)) { b = 'λ'; s = s || (b + s).slice(1); }
    const units = unitList(q.ui && q.ui.ok ? q.unit : '');
    const disp = units.length ? units[0] : [q.unit || '', 1];
    L.push('{' + [str(b || q.name), str(s), str(q.name), str(plainTex(q.desc || '').slice(0, 300)), str(q.also || ''), str(disp[0]),
      '{' + units.map((u) => '{' + str(u[0]) + ',' + u[1] + '}').join(',') + '}',
      q.value != null ? q.value : 'nil', q.input ? 'true' : 'false', q.context ? 'true' : 'false', q.hintSI != null ? q.hintSI : 'nil'].join(',') + '},');
  }
  L.push('}');

  L.push('F={');
  let done = 0;
  for (const f of F) {
    const names = {}; f.vars.forEach((v) => { const [b, s] = symParts(VS.Q[v.id].sym); names[v.ph] = b + (s ? '_' + s : ''); });
    const idx = {}; f.vars.forEach((v, k) => { idx[v.ph] = k + 1; });
    let eqAst; try { eqAst = GiacFmt.parse(f.eqp); } catch (e) { stats.skipped++; continue; }
    let resid; try { resid = '(' + toLua(eqAst.a, idx) + ')-(' + toLua(eqAst.b, idx) + ')'; } catch (e) { resid = null; }
    const sol = [];
    for (const x of f.vars) {
      const q = VS.Q[x.id];
      if (q.input || (f.solveFor && !f.solveFor.has(x.name))) { sol.push('false'); continue; }
      let asts = [];
      const ex = VS.explicit(f, x);
      if (ex) asts = [ex];
      else { const r = await solveG('solve(' + f.eqp + ',' + x.ph + ')'); asts = r ? VS.parseSols(r, x.ph) : []; }
      const outs = [];
      for (const a of asts) { try { outs.push([toLua(a, idx), toText(a, names)]); } catch (e) { /* not in closed form */ } }
      if (outs.length) { stats.closed++; sol.push('{' + outs.map((o) => '{' + str(o[0]) + ',' + str(o[1]) + '}').join(',') + '}'); }
      else if (resid) { stats.numeric++; sol.push('true'); }
      else sol.push('false');
    }
    let when = 'nil'; if (f.when) { try { when = str(toLua(GiacFmt.parse(f.when), idx)); } catch (e) { when = 'nil'; } }
    const unless = f.unlessKnown ? '{' + f.unlessKnown.filter((id) => qIndex[id]).map((id) => qIndex[id]).join(',') + '}' : 'nil';
    L.push('{' + [str(f.title), TOPIC[f.cat], str(f.cat), str(toText(eqAst, names)), '{' + f.vars.map((v) => qIndex[v.id]).join(',') + '}',
      '{' + f.vars.map((v) => v.f).join(',') + '}', '{' + sol.join(',') + '}', resid ? str(resid) : 'nil', f.solveFor ? 'true' : 'false', when, unless,
      str(plainTex(f.note || '').slice(0, 160))].join(',') + '},');
    if (++done % 100 === 0) process.stderr.write(done + ' formulas\n');
  }
  L.push('}');
  if (worker) await worker.terminate();
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  stats.timeouts = timeouts;
  const data = L.join('\n') + '\n';
  const app = fs.readFileSync(__dirname + '/solver.lua', 'utf8');
  const lua = app.replace('--[[DATA]]', () => data);
  fs.writeFileSync(OUT + '/CalcShelf-Solver.lua', lua);
  console.log(JSON.stringify(stats), (lua.length / 1024).toFixed(0) + ' KB of Lua');
  const luna = [__dirname + '/luna', 'luna'].find((p) => { try { execFileSync(p, [], { stdio: 'ignore' }); return true; } catch (e) { return e.status != null; } });
  if (luna) { execFileSync(luna, [OUT + '/CalcShelf-Solver.lua', OUT + '/CalcShelf-Solver.tns']); console.log('wrote', OUT + '/CalcShelf-Solver.tns'); }
  else console.log('luna not found: wrote', OUT + '/CalcShelf-Solver.lua only');
})();
