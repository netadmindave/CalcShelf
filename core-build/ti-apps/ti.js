// Writes the TI-89 / TI-92 Plus / Voyage 200 and TI-84 Plus versions of the CalcShelf Solver from out/solver-data.json (made by build.js).
// Each formula was already rearranged for each of its variables; these programs only ask for the knowns and evaluate the rearranged form.
//   node core-build/ti-apps/ti.js [outdir]     → <outdir>/ti89/*.89p and <outdir>/ti84/*.txt (ti84pack.py tokenizes them to .8xp)
const fs = require('fs');
const path = require('path');
const T89 = require('./ti89file.js');

const OUT = path.resolve(process.argv[2] || __dirname + '/out');
const D = JSON.parse(fs.readFileSync(__dirname + '/out/solver-data.json', 'utf8'));
const Q = D.quantities;
const FOLDER89 = process.env.TI89_FOLDER || 'cshelf';   // the folder the TI-89 programs go in (tests put them in main)
const TOPICS = ['Optics', 'Optoelectronics', 'Semiconductors'];

class Unsupported extends Error {}

/* ---------------------------------------------------------------- sections and the programs they become */
const sections = [];
for (const [ti, tname] of TOPICS.entries()) {
  const cats = [...new Set(D.formulas.filter((f) => f.topic === ti + 1).map((f) => f.cat))].sort();
  for (const cat of cats) sections.push({ topic: ti + 1, tname, cat, formulas: D.formulas.filter((f) => f.topic === ti + 1 && f.cat === cat) });
}
// keep each program small enough for a TI-84 Plus (about 24 KB of free RAM): at most 12 formulas per program
const programs = [];
const LET = 'abcdefghijklmnopqrstuvwxyz';
sections.forEach((s, si) => {
  const parts = Math.ceil(s.formulas.length / 12);
  for (let p = 0; p < parts; p++) {
    const fs_ = s.formulas.slice(Math.floor(p * s.formulas.length / parts), Math.floor((p + 1) * s.formulas.length / parts));
    programs.push({ section: s, part: parts > 1 ? p + 1 : 0, parts, formulas: fs_, id: 'cs' + LET[s.topic - 1] + String(si + 1).padStart(2, '0') + (parts > 1 ? LET[p] : '') });
  }
});

/* ---------------------------------------------------------------- shared helpers */
const solvable = (f) => f.vars.map((v, k) => ({ v, k, sol: f.sols[k] })).filter((x) => x.sol && !Q[x.v.q].input && Q[x.v.q].value == null);
const symU = (q) => q.sym[0] + (q.sym[1] ? '_' + q.sym[1] : '');
const unitOf = (q) => (q.unit && q.unit[0]) || '';
// a known entered in its display unit u, used in the formula's own unit f: a = x·u/f ; a result r comes back as r·f/u
const toFormula = (q, v) => (q.unit ? q.unit[1] : 1) / v.f;
function numStr(x) {
  if (x === 1) return '1';
  let s = Number(x).toPrecision(12).replace(/\.?0+(e|$)/, '$1');
  if (/e/.test(s)) { const [m, e] = s.split('e'); s = m.replace(/\.?0+$/, '') + 'e' + e; }
  return s;
}

/* ---------------------------------------------------------------- TI-84 Plus (TI-Basic text for tivars) */
const GREEK84 = { α: 'alpha', β: 'beta', γ: 'gamma', Γ: 'Gamma', δ: 'delta', Δ: 'D', ε: 'eps', ζ: 'zeta', η: 'eta', θ: 'theta', Θ: 'Theta', κ: 'kappa', λ: 'lam',
  Λ: 'Lam', μ: 'mu', µ: 'u', ν: 'nu', ξ: 'xi', π: 'pi', ρ: 'rho', σ: 'sig', Σ: 'Sig', τ: 'tau', φ: 'phi', Φ: 'Phi', χ: 'chi', ψ: 'psi', ω: 'w', Ω: 'Ohm', ħ: 'hbar',
  ℓ: 'l', '∞': 'inf', '°': 'deg', '′': "'", '·': '*', '×': '*', '²': '^2', '³': '^3', '√': 'sqrt', '⊥': 'perp', '∥': 'par', '−': '-', '–': '-', '—': '-', '≈': '~',
  '≤': '<=', '≥': '>=', '→': ' to ', 'Å': 'A', 'ü': 'u', 'é': 'e', 'ö': 'o', '…': '...', '⁻': '-', '¹': '1', '₀': '0', '₁': '1', '₂': '2', 'ℏ': 'hbar', '∂': 'd', '∠': 'ang', '±': '+-' };
// text inside a TI-84 string: no quote, no store arrow, ASCII only
function str84(s, max) {
  let t = '';
  for (const c of String(s)) t += c.charCodeAt(0) < 128 ? c : (GREEK84[c] != null ? GREEK84[c] : '');
  t = t.replace(/"/g, "'").replace(/->/g, ' to ').replace(/[\[\]{}]/g, (c) => ({ '[': '(', ']': ')', '{': '(', '}': ')' })[c]).replace(/\s+/g, ' ').trim();
  return max ? t.slice(0, max) : t;
}
const FN84 = { sqrt: '√(', exp: '𝑒^(', ln: 'ln(', log: 'ln(', log10: 'log(', sin: 'sin(', cos: 'cos(', tan: 'tan(', asin: 'sin⁻¹(', acos: 'cos⁻¹(', atan: 'tan⁻¹(',
  sinh: 'sinh(', cosh: 'cosh(', tanh: 'tanh(', asinh: 'sinh⁻¹(', acosh: 'cosh⁻¹(', atanh: 'tanh⁻¹(', abs: 'abs(', floor: 'int(', max: 'max(', min: 'min(' };
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };
function num84(v) {
  const x = Number(v); if (!isFinite(x)) throw new Unsupported('num');
  let s = String(v).replace(/^\+/, '');
  const m = /^(\d*\.?\d*)e([+-]?)(\d+)$/i.exec(s);
  if (m) s = (m[1] || '1') + 'ᴇ' + (m[2] === '-' ? '⁻' : '') + m[3].replace(/^0+(?=\d)/, '');
  return s;
}
function to84(n, L, up = 0) {
  const T = (x, p) => to84(x, L, p);
  const wrap = (s, p) => (p < up ? '(' + s + ')' : s);
  switch (n.t) {
    case 'num': return num84(n.v);
    case 'id': if (n.v in L) return L[n.v]; if (n.v === 'pi') return 'pi'; if (n.v === 'e') return '𝑒'; throw new Unsupported('id ' + n.v);
    case 'paren': return T(n.a, up);
    case 'neg': return wrap('⁻' + T(n.a, 3), 2);
    case 'bin':
      if (n.op === '^') return wrap(T(n.a, 5) + '^' + (/^[\w.ᴇ⁻]+$|^pi$/.test(T(n.b, 9)) && !/⁻/.test(T(n.b, 9)) ? T(n.b, 9) : '(' + T(n.b, 0) + ')'), 4);
      if (PREC[n.op]) { const p = PREC[n.op]; return wrap(T(n.a, p) + n.op + T(n.b, n.op === '-' || n.op === '/' ? p + 1 : p), p); }
      throw new Unsupported('op ' + n.op);
    case 'call':
      if (n.f === 'sec' || n.f === 'csc' || n.f === 'cot') return wrap('1/' + { sec: 'cos(', csc: 'sin(', cot: 'tan(' }[n.f] + T(n.args[0], 0) + ')', 2);
      if (n.f === 'sign') { const a = T(n.args[0], 0); return '((' + a + ')>0-(' + a + ')<0)'; }
      if (n.f === 'ceil') return '⁻int(⁻(' + T(n.args[0], 0) + '))';
      if (FN84[n.f]) return FN84[n.f] + n.args.map((x) => T(x, 0)).join(',') + ')';
      throw new Unsupported('fn ' + n.f);
    default: throw new Unsupported(n.t);
  }
}
function wrapPx(s, px) {
  const out = []; let cur = '';
  for (const word of s.split(' ')) {
    let wd = word;
    while (px89(wd) > px) { if (cur) { out.push(cur); cur = ''; } const head = fit89(wd, px); out.push(head); wd = wd.slice(head.length); }
    const t = cur ? cur + ' ' + wd : wd;
    if (px89(t) > px) { out.push(cur); cur = wd; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
function wrapLines(s, w) {
  const out = []; let cur = '';
  for (const word of s.split(' ')) {
    let wd = word;
    while (wd.length > w) { if (cur) { out.push(cur); cur = ''; } out.push(wd.slice(0, w)); wd = wd.slice(w); }
    const t = cur ? cur + ' ' + wd : wd;
    if (t.length > w) { out.push(cur); cur = wd; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
function labels84() {
  const C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let i = 37;   // two-character labels from "10"
  return () => { const l = C[Math.floor(i / 36)] + C[i % 36]; i++; return l; };
}
// a Menu( of any length: pages of up to 5 items with "More" and "Back"
function menu84(lines, nextLabel, title, items, back) {
  const pages = []; for (let i = 0; i < items.length; i += 5) pages.push(items.slice(i, i + 5));
  if (!pages.length) pages.push([]);
  const pl = pages.map(() => nextLabel());
  pages.forEach((pg, i) => {
    lines.push('Lbl ' + pl[i]);
    const opts = pg.map((it) => '"' + str84(it[0], 16) + '",' + it[1]);
    if (pages.length > 1) opts.push('"More...",' + (i + 1 < pages.length ? pl[i + 1] : pl[0]));
    opts.push('"Back",' + back);
    lines.push('Menu("' + str84(title, pages.length > 1 ? 12 : 16) + (pages.length > 1 ? ' ' + (i + 1) + '/' + pages.length : '') + '",' + opts.join(','));
  });
  return pl[0];
}
const LETTERS = 'ABCDEFGHIJ';
function program84(pr) {
  const lines = ['Radian:a+bi:Float', 'Lbl ZZ'];
  const next = labels84();
  const fl = pr.formulas.map(() => next());
  const title = pr.part ? str84(pr.section.cat, 9) + ' ' + pr.part : str84(pr.section.cat, 11);
  // first page of a multi-page menu must be reachable from "More" on the last page: it is Lbl ZZ
  menu84(lines, next, title, pr.formulas.map((f, i) => [f.title, fl[i]]), 'QQ');
  let skipped = 0;
  pr.formulas.forEach((f, i) => {
    const L = {}; f.vars.forEach((v, k) => { L[v.ph] = LETTERS[k]; });
    lines.push('Lbl ' + fl[i], 'ClrHome');
    for (const l of wrapLines(str84(f.title), 16).slice(0, 2)) lines.push('Disp "' + l + '"');
    for (const l of wrapLines(str84(f.eq), 16).slice(0, 5)) lines.push('Disp "' + l + '"');
    lines.push('Pause ');
    const opts = [];
    const blocks = [];
    for (const { v, k, sol } of solvable(f)) {
      const q = Q[v.q];
      let exprs;
      try {
        if (sol === 'numeric') {
          const ea = f.eqAst; const guess = q.hintSI != null ? q.hintSI / v.f : 1;
          exprs = [{ solve: to84(ea.a, L) + '-(' + to84(ea.b, L) + ')', guess: num84(numStr(guess)) }];
        } else {
          exprs = sol.map((a) => to84(a, L));
          if (exprs.some((e) => e.length > 700)) exprs = [{ solve: to84(f.eqAst.a, L) + '-(' + to84(f.eqAst.b, L) + ')', guess: num84(numStr(q.hintSI != null ? q.hintSI / v.f : 1)) }];
        }
      } catch (e) { if (e instanceof Unsupported) { skipped++; continue; } throw e; }
      const lab = next();
      opts.push([symU(q) + (unitOf(q) ? ' (' + unitOf(q) + ')' : ''), lab]);
      const b = ['Lbl ' + lab, 'ClrHome'];
      f.vars.forEach((w, j) => {
        if (j === k) return;
        const qw = Q[w.q]; const c = LETTERS[j];
        if (qw.value != null) { b.push(num84(numStr(qw.value / w.f)) + '→' + c); return; }
        b.push('Input "' + str84(symU(qw) + (unitOf(qw) ? ' ' + unitOf(qw) : ''), 22) + '=",' + c);
        const k2 = toFormula(qw, w); if (Math.abs(k2 - 1) > 1e-15) b.push(c + '*' + num84(numStr(k2)) + '→' + c);
      });
      const back = numStr(v.f / (q.unit ? q.unit[1] : 1));
      const show = (x) => 'Disp "' + str84(symU(q) + (unitOf(q) ? ' (' + unitOf(q) + ')' : ''), 22) + ' =",' + x + (back === '1' ? '' : '*' + num84(back));
      b.push('0→N');
      for (const e of exprs) {
        if (e.solve) b.push('Real', 'solve(' + e.solve + ',' + LETTERS[k] + ',' + e.guess + ')→X', 'a+bi', show('X'), '1→N');
        else b.push(e + '→X', 'If imag(X)=0:Then', show('real(X)'), '1→N', 'End');
      }
      b.push('If not(N):Disp "No real answer"', 'Pause ', 'Goto ?');
      blocks.push(b);
    }
    const sm = menu84(lines, next, 'Solve for', opts, 'ZZ');
    blocks.forEach((b) => { b[b.length - 1] = 'Goto ' + sm; });
    blocks.forEach((b) => lines.push(...b));
  });
  lines.push('Lbl QQ', 'Real');
  return { text: lines.join('\n'), skipped };
}
function main84() {
  const lines = ['Lbl ZZ', 'ClrHome', 'Menu("CALCSHELF SOLVER","Optics",T1,"Optoelectronics",T2,"Semiconductors",T3,"About",AB,"Quit",QQ)'];
  const next = labels84();
  TOPICS.forEach((t, ti) => {
    lines.push('Lbl T' + (ti + 1));
    const items = []; const calls = [];
    for (const pr of programs.filter((p) => p.section.topic === ti + 1)) {
      const lab = next();
      items.push([pr.part ? str84(pr.section.cat, 13) + ' ' + pr.part : pr.section.cat, lab]);
      calls.push('Lbl ' + lab, 'prgm' + pr.id.toUpperCase(), 'Goto T' + (ti + 1));
    }
    menu84(lines, next, t, items, 'ZZ');
    lines.push(...calls);
  });
  lines.push('Lbl AB', 'ClrHome', 'Disp "CalcShelf Solver"', 'Disp "' + D.formulas.length + ' formulas from"', 'Disp "the CalcShelf app"', 'Disp "Pick a formula,"', 'Disp "the variable to"', 'Disp "solve for, then"', 'Disp "enter the others"', 'Pause ', 'Disp "Units are shown", "in each prompt."', 'Disp "GPL-3.0"', 'Pause ', 'Goto ZZ');
  lines.push('Lbl QQ', 'ClrHome', 'Real');
  return lines.join('\n');
}

/* ---------------------------------------------------------------- TI-89 / TI-92 Plus / Voyage 200 (68k TI-Basic text) */
const CHARS89 = (() => { global.self = global; require(__dirname + '/../../app/www/ti89/js/ticharset.js'); return new Set(self.TI9X_CHARSET); })();
const SUB89 = { μ: 'µ', η: 'n', κ: 'k', ν: 'v', χ: 'X', ħ: 'h', ℏ: 'h', Λ: 'L', Θ: 'θ', Φ: 'φ', ϕ: 'φ', ℓ: 'l', '′': "'", '−': '-', '–': '-', '—': '-', '≈': '~', '∥': '||', '⊥': 'perp', '₀': '0', '₁': '1', '₂': '2', '⁻': '-' };
// width of text in the dialog font (proportional), in average characters: M W m w count 1.5, i l . , : ; ' | ! and space 0.6
function px89(t) { let w = 0; for (const c of t) w += /[MWmw@%#&]/.test(c) ? 1.5 : /[il.,:;'|! ]/.test(c) ? 0.6 : 1; return w; }
function fit89(t, px) { while (t.length > 1 && px89(t) > px) t = t.slice(0, -1); return t.trim(); }
function str89(s, max) {
  let t = '';
  for (const c of String(s)) t += CHARS89.has(c) && c.charCodeAt(0) >= 32 ? c : (SUB89[c] != null ? SUB89[c] : (c.charCodeAt(0) < 128 ? '' : ''));
  t = t.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  return max ? t.slice(0, max) : t;
}
const FN89 = { sqrt: '√(', exp: 'ℯ^(', ln: 'ln(', log: 'ln(', log10: 'log(', sin: 'sin(', cos: 'cos(', tan: 'tan(', asin: 'sin⁻¹(', acos: 'cos⁻¹(', atan: 'tan⁻¹(',
  sinh: 'sinh(', cosh: 'cosh(', tanh: 'tanh(', asinh: 'sinh⁻¹(', acosh: 'cosh⁻¹(', atanh: 'tanh⁻¹(', abs: 'abs(', sign: 'sign(', floor: 'floor(', ceil: 'ceiling(',
  max: 'max(', min: 'min(', sec: 'sec(', csc: 'csc(', cot: 'cot(' };
function num89(v) {
  const x = Number(v); if (!isFinite(x)) throw new Unsupported('num');
  let s = String(v).replace(/^\+/, '');
  const m = /^(\d*\.?\d*)e([+-]?)(\d+)$/i.exec(s);
  if (m) s = (m[1] || '1') + 'ᴇ' + (m[2] === '-' ? '−' : '') + m[3].replace(/^0+(?=\d)/, '');
  else if (!/\./.test(s)) s += '.';
  return s;
}
function to89(n, L, up = 0) {
  const T = (x, p) => to89(x, L, p);
  const wrap = (s, p) => (p < up ? '(' + s + ')' : s);
  switch (n.t) {
    case 'num': return num89(n.v);
    case 'id': if (n.v in L) return L[n.v]; if (n.v === 'pi') return 'π'; if (n.v === 'e') return 'ℯ'; throw new Unsupported('id ' + n.v);
    case 'paren': return T(n.a, up);
    case 'neg': return wrap('−' + T(n.a, 3), 2);
    case 'bin':
      if (n.op === '^') return wrap(T(n.a, 5) + '^(' + T(n.b, 0) + ')', 4);
      if (PREC[n.op]) { const p = PREC[n.op]; return wrap(T(n.a, p) + n.op + T(n.b, n.op === '-' || n.op === '/' ? p + 1 : p), p); }
      throw new Unsupported('op ' + n.op);
    case 'call':
      if (FN89[n.f]) return FN89[n.f] + n.args.map((x) => T(x, 0)).join(',') + ')';
      throw new Unsupported('fn ' + n.f);
    default: throw new Unsupported(n.t);
  }
}
// the solver's values are globals csv1…csv10 (entered as strings cse1…cse10) so the shared helpers csout and csnum can see them
const VARS89 = ['csv1', 'csv2', 'csv3', 'csv4', 'csv5', 'csv6', 'csv7', 'csv8', 'csv9', 'csv10'];
const list89 = (a) => '{' + a.map((s) => '"' + s + '"').join(',') + '}';
function program89(pr) {
  const L = ['Prgm', 'Local f,k', '1→f', 'Loop',
    'Dialog', 'Title "' + fit89(str89(pr.section.cat), 18) + (pr.part ? ' ' + pr.part + '/' + pr.parts : '') + '"',
    'DropDown " ",' + list89(pr.formulas.map((f) => fit89(str89(f.title), 16))) + ',f', 'EndDlog', 'If ok=0', 'Exit'];
  let skipped = 0;
  pr.formulas.forEach((f, i) => {
    const V = {}; f.vars.forEach((v, k) => { V[v.ph] = VARS89[k]; });
    L.push((i === 0 ? 'If' : 'ElseIf') + ' f=' + (i + 1) + ' Then', '"' + fit89(str89(f.title), 22) + '"→cstit');
    const items = []; const blocks = [];
    for (const { v, k, sol } of solvable(f)) {
      const q = Q[v.q];
      let call;
      const back = num89(numStr(v.f / (q.unit ? q.unit[1] : 1)));
      const name = '"' + str89(symU(q), 14) + '","' + str89(unitOf(q), 10) + '",' + back;
      try {
        if (sol === 'numeric') {
          const V2 = Object.assign({}, V, { [v.ph]: 'csx' });
          call = 'csnum(' + name + ',"' + to89(f.eqAst.a, V2) + '=' + to89(f.eqAst.b, V2) + '",' + num89(numStr(q.hintSI != null ? q.hintSI / v.f : 1)) + ')';
        } else {
          const ex = sol.map((a) => to89(a, V));
          if (ex.some((e) => e.length > 700)) {   // a huge closed form: solve numerically instead
            const V2 = Object.assign({}, V, { [v.ph]: 'csx' });
            call = 'csnum(' + name + ',"' + to89(f.eqAst.a, V2) + '=' + to89(f.eqAst.b, V2) + '",' + num89(numStr(q.hintSI != null ? q.hintSI / v.f : 1)) + ')';
          } else call = 'csout(' + name + ',' + list89(ex) + ')';
        }
      } catch (e) { if (e instanceof Unsupported) { skipped++; continue; } throw e; }
      items.push(fit89(str89(symU(q) + (unitOf(q) ? ' (' + unitOf(q) + ')' : '')), 14));
      const b = [];
      const knowns = f.vars.map((w, j) => ({ w, j })).filter(({ j }) => j !== k);
      const asked = knowns.filter(({ w }) => Q[w.q].value == null);
      knowns.filter(({ w }) => Q[w.q].value != null).forEach(({ w, j }) => b.push(num89(numStr(Q[w.q].value / w.f)) + '→' + VARS89[j]));
      // up to 5 entries per dialog box
      for (let g = 0; g < asked.length; g += 5) {
        b.push('Dialog', 'Title cstit');
        if (g === 0) b.push('Text "' + fit89('Find ' + str89(symU(q)) + (unitOf(q) ? ' in ' + str89(unitOf(q)) : ''), 24) + '"');
        asked.slice(g, g + 5).forEach(({ w, j }) => b.push('Request "' + fit89(str89(symU(Q[w.q]) + (unitOf(Q[w.q]) ? ' ' + unitOf(Q[w.q]) : '')), 13) + '",cse' + (j + 1) + ',0'));
        b.push('EndDlog', 'If ok=0', 'Cycle');
      }
      asked.forEach(({ w, j }) => {
        const c = numStr(toFormula(Q[w.q], w));
        b.push('expr(cse' + (j + 1) + ')' + (c === '1' ? '' : '*' + num89(c)) + '→' + VARS89[j]);
      });
      b.push(call);
      blocks.push(b);
    }
    if (!items.length) return;
    L.push('1→k', 'Dialog', 'Title cstit');
    for (const l of wrapPx(str89(f.eq), 24).slice(0, 4)) L.push('Text "' + l + '"');
    L.push('DropDown "Find",' + list89(items) + ',k', 'EndDlog', 'If ok≠0 Then');
    blocks.forEach((b, bi) => { L.push((bi === 0 ? 'If' : 'ElseIf') + ' k=' + (bi + 1) + ' Then', ...b); });
    L.push('EndIf', 'EndIf');
  });
  L.push('EndIf', 'EndLoop', 'EndPrgm');
  return { lines: L, skipped };
}
// csout(name, unit, factor, {"expr",…}): evaluates each rearranged form, keeps the real ones and shows them
const CSOUT = ['Prgm', 'Local i,r,o,t1,t2,t3', '{}→o', 'For i,1,dim(x)', 'Try', 'expr(x[i])→r', 'If getType(r)="NUM" Then', 'augment(o,{n&" = "&string(r*b)&" "&u})→o', 'EndIf',
  'Else', 'ClrErr', 'EndTry', 'EndFor', 'csshow(o)', 'EndPrgm'];
// csnum(name, unit, factor, "equation in csx", guess): solves numerically
const CSNUM = ['Prgm', 'Local r,o', '{}→o', 'Try', 'DelVar csx', 'expr("nSolve("&q&",csx="&string(g)&")")→r', 'If getType(r)="NUM" Then', '{n&" = "&string(r*b)&" "&u}→o', 'EndIf',
  'Else', 'ClrErr', 'EndTry', 'DelVar csx', 'csshow(o)', 'EndPrgm'];
const CSSHOW = ['Prgm', 'Local t1,t2,t3', '""→t1:""→t2:""→t3', 'If dim(o)=0 Then', '"No real answer"→t1', 'Else', 'o[1]→t1', 'If dim(o)>1', 'o[2]→t2', 'If dim(o)>2', 'o[3]→t3', 'EndIf',
  'Dialog', 'Title cstit', 'Text mid(t1,1,22)', 'Text mid(t2,1,22)', 'Text mid(t3,1,22)', 'EndDlog', 'EndPrgm'];
// the TI-89 tokenizes a whole program the first time it runs and runs out of memory above about 18 KB of text: split each section to stay under 11 KB
const programs89 = [];
sections.forEach((sec, si) => {
  const size = (fl) => program89({ section: sec, part: 1, parts: 2, formulas: fl }).lines.join('\n').length;
  const groups = []; let cur = [];
  for (const f of sec.formulas) {
    if (cur.length && size(cur.concat([f])) > 10000) { groups.push(cur); cur = []; }
    cur.push(f);
  }
  if (cur.length) groups.push(cur);
  groups.forEach((g, p) => programs89.push({ section: sec, part: groups.length > 1 ? p + 1 : 0, parts: groups.length, formulas: g,
    id: 'cs' + LET[sec.topic - 1] + String(si + 1).padStart(2, '0') + (groups.length > 1 ? LET[p] : '') }));
});
function main89() {
  const L = ['Prgm', 'Local t,c,m1,m2,m3,fo', 'setFold(' + FOLDER89 + ')→fo', '""→cse1:""→cse2:""→cse3:""→cse4:""→cse5:""→cse6:""→cse7:""→cse8:""→cse9:""→cse10', 'getMode("Exact/Approx")→m1', 'getMode("Angle")→m2', 'getMode("Complex Format")→m3',
    'setMode("Exact/Approx","APPROXIMATE")', 'setMode("Angle","RADIAN")', 'setMode("Complex Format","REAL")', '1→t', 'Loop', 'Dialog', 'Title "CalcShelf Solver"',
    'DropDown " ",' + list89(TOPICS) + ',t', 'Text "' + D.formulas.length + ' formulas. Pick"', 'Text "one, what to find,"', 'Text "then the others."', 'EndDlog', 'If ok=0', 'Exit', '1→c'];
  TOPICS.forEach((t, ti) => {
    const prs = programs89.filter((p) => p.section.topic === ti + 1);
    L.push((ti === 0 ? 'If' : 'ElseIf') + ' t=' + (ti + 1) + ' Then', 'Dialog', 'Title "' + t + '"',
      'DropDown " ",' + list89(prs.map((p) => fit89(str89(p.section.cat), p.part ? 14 : 16) + (p.part ? ' ' + p.part : ''))) + ',c', 'EndDlog', 'If ok≠0 Then');
    prs.forEach((p, pi) => L.push((pi === 0 ? 'If' : 'ElseIf') + ' c=' + (pi + 1) + ' Then', p.id + '()'));
    L.push('EndIf', 'EndIf');
  });
  L.push('EndIf', 'EndLoop', 'DelVar ' + VARS89.join(',') + ',cse1,cse2,cse3,cse4,cse5,cse6,cse7,cse8,cse9,cse10,cstit', 'setMode("Exact/Approx",m1)', 'setMode("Angle",m2)', 'setMode("Complex Format",m3)', 'setFold(#fo)', 'EndPrgm');
  return L;
}

/* ---------------------------------------------------------------- write */
fs.mkdirSync(OUT + '/ti84', { recursive: true }); fs.mkdirSync(OUT + '/ti89', { recursive: true });
let s84 = 0, s89 = 0;
const index84 = [{ name: 'CSHELF', file: 'CSHELF.txt' }];
fs.writeFileSync(OUT + '/ti84/CSHELF.txt', main84());
for (const pr of programs) {
  const r = program84(pr); s84 += r.skipped;
  fs.writeFileSync(OUT + '/ti84/' + pr.id.toUpperCase() + '.txt', r.text); index84.push({ name: pr.id.toUpperCase(), file: pr.id.toUpperCase() + '.txt' });
}
fs.writeFileSync(OUT + '/ti84/index.json', JSON.stringify(index84));
fs.writeFileSync(OUT + '/ti89/solver.89p', T89.program(FOLDER89, 'solver', '', main89(), false));
fs.writeFileSync(OUT + '/ti89/csout.89p', T89.program(FOLDER89, 'csout', 'n,u,b,x', CSOUT, false));
fs.writeFileSync(OUT + '/ti89/csnum.89p', T89.program(FOLDER89, 'csnum', 'n,u,b,q,g', CSNUM, false));
fs.writeFileSync(OUT + '/ti89/csshow.89p', T89.program(FOLDER89, 'csshow', 'o', CSSHOW, false));
for (const pr of programs89) {
  const r = program89(pr); s89 += r.skipped;
  fs.writeFileSync(OUT + '/ti89/' + pr.id + '.89p', T89.program(FOLDER89, pr.id, '', r.lines, false));
}
console.log(JSON.stringify({ programs84: programs.length + 1, programs89: programs89.length + 4, skipped84: s84, skipped89: s89 }));
