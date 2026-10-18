/*
 * units.js — dimensional unit engine: parses compound units (J/(mol·K), m³ kg⁻¹ s⁻², km/s/Mpc, MeV/c²),
 * converts between compatible units, and lists alternatives for a quantity.
 * Exact factors are SI definitions; others follow NIST SP 811 / CODATA 2018.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  // dimension vector: length, mass, time, current, temperature, amount, luminous intensity, angle, information
  const DN = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd', 'rad', 'bit'];
  const N = DN.length;
  const D = (o) => { const v = new Array(N).fill(0); for (const [k, e] of Object.entries(o)) v[DN.indexOf(k)] = e; return v; };
  const ONE = D({});
  const C0 = 299792458, H = 6.62607015e-34, E = 1.602176634e-19, KB = 1.380649e-23, NA = 6.02214076e23, G0 = 9.80665, PI = Math.PI;
  const LB = 0.45359237, IN = 0.0254, FT = 0.3048, GAL = 3.785411784e-3, CAL = 4.184, BTU = 1055.05585262, ATM = 101325;

  // symbol: [factor to SI, dims, prefixable, name]
  const U = {};
  const def = (sym, f, d, px, name, alias) => { U[sym] = { f, d, px: !!px, name: name || sym }; if (alias) for (const a of alias) U[a] = U[sym]; };
  const L = D({ m: 1 }), M = D({ kg: 1 }), T = D({ s: 1 }), I = D({ A: 1 }), K = D({ K: 1 }), MOL = D({ mol: 1 }), CD = D({ cd: 1 }), ANG = D({ rad: 1 }), BIT = D({ bit: 1 });
  const mul = (a, b, s = 1) => a.map((x, i) => x + s * b[i]);
  const pow = (a, p) => a.map((x) => x * p);
  const V = mul(L, T, -1), ACC = mul(L, pow(T, 2), -1), F = mul(M, ACC), EN = mul(F, L), P = mul(EN, T, -1), PR = mul(F, pow(L, 2), -1);
  const CH = mul(I, T), VOLT = mul(P, I, -1), OHM = mul(VOLT, I, -1);
  // SI base and derived
  def('m', 1, L, 1, 'metre'); def('g', 1e-3, M, 1, 'gram'); def('s', 1, T, 1, 'second', ['sec']); def('A', 1, I, 1, 'ampere');
  def('K', 1, K, 1, 'kelvin'); def('mol', 1, MOL, 1, 'mole'); def('cd', 1, CD, 1, 'candela');
  def('rad', 1, ANG, 1, 'radian'); def('sr', 1, pow(ANG, 2), 0, 'steradian');
  def('Hz', 1, pow(T, -1), 1, 'hertz'); def('N', 1, F, 1, 'newton'); def('Pa', 1, PR, 1, 'pascal'); def('J', 1, EN, 1, 'joule');
  def('W', 1, P, 1, 'watt'); def('C', 1, CH, 1, 'coulomb'); def('V', 1, VOLT, 1, 'volt'); def('Ω', 1, OHM, 1, 'ohm', ['ohm', 'Ohm']);
  def('S', 1, pow(OHM, -1), 1, 'siemens'); def('F', 1, mul(CH, VOLT, -1), 1, 'farad'); def('Wb', 1, mul(VOLT, T), 1, 'weber');
  def('T', 1, mul(mul(VOLT, T), pow(L, 2), -1), 1, 'tesla'); def('H', 1, mul(mul(VOLT, T), I, -1), 1, 'henry');
  def('lm', 1, mul(CD, pow(ANG, 2)), 1, 'lumen'); def('lx', 1, mul(mul(CD, pow(ANG, 2)), pow(L, 2), -1), 1, 'lux');
  def('Bq', 1, pow(T, -1), 1, 'becquerel'); def('Gy', 1, mul(EN, M, -1), 1, 'gray'); def('Sv', 1, mul(EN, M, -1), 1, 'sievert'); def('kat', 1, mul(MOL, T, -1), 1, 'katal');
  // accepted non-SI and others
  def('L', 1e-3, pow(L, 3), 1, 'litre', ['l']); def('t', 1000, M, 1, 'tonne'); def('Da', 1.66053906660e-27, M, 1, 'dalton', ['u']);
  def('eV', E, EN, 1, 'electronvolt'); def('min', 60, T, 0, 'minute'); def('h', 3600, T, 0, 'hour', ['hr']); def('d', 86400, T, 0, 'day', ['day']);
  def('wk', 604800, T, 0, 'week'); def('yr', 31557600, T, 1, 'Julian year', ['a', 'year']);
  def('°', PI / 180, ANG, 0, 'degree', ['deg']); def("'", PI / 10800, ANG, 0, 'arcminute', ['′', 'arcmin']); def('"', PI / 648000, ANG, 0, 'arcsecond', ['″', 'arcsec', 'as']);
  def('mas', PI / 648000e3, ANG, 0, 'milliarcsecond'); def('gon', PI / 200, ANG, 0, 'gradian', ['grad']); def('rev', 2 * PI, ANG, 0, 'revolution', ['turn']);
  def('rpm', 1 / 60, pow(T, -1), 0, 'revolutions per minute'); def('cyc', 1, ONE, 0, 'cycle');
  def('ha', 1e4, pow(L, 2), 0, 'hectare'); def('b', 1e-28, pow(L, 2), 1, 'barn'); def('Å', 1e-10, L, 0, 'ångström', ['angstrom', 'AA']);
  def('au', 149597870700, L, 0, 'astronomical unit', ['AU']); def('ly', 9460730472580800, L, 1, 'light-year'); def('pc', 3.0856775814913673e16, L, 1, 'parsec');
  def('bar', 1e5, PR, 1, 'bar'); def('atm', ATM, PR, 0, 'standard atmosphere'); def('Torr', ATM / 760, PR, 1, 'torr', ['torr']);
  def('mmHg', 133.322387415, PR, 0, 'millimetre of mercury'); def('inHg', 3386.389, PR, 0, 'inch of mercury'); def('inH2O', 249.08891, PR, 0, 'inch of water (4 °C)'); def('cmH2O', 98.0638, PR, 0, 'centimetre of water (4 °C)');
  def('psi', LB * G0 / (IN * IN), PR, 0, 'pound per square inch'); def('ksi', 1000 * LB * G0 / (IN * IN), PR, 0, 'kip per square inch');
  def('cal', CAL, EN, 1, 'calorie (thermochemical)'); def('Cal', 4184, EN, 0, 'food Calorie'); def('BTU', BTU, EN, 0, 'British thermal unit (IT)', ['Btu']);
  def('Wh', 3600, EN, 1, 'watt-hour'); def('erg', 1e-7, EN, 0, 'erg'); def('Eh', 4.3597447222071e-18, EN, 0, 'hartree'); def('Ry', 2.1798723611035e-18, EN, 0, 'rydberg');
  def('thm', 105505585.262, EN, 0, 'therm'); def('tTNT', 4.184e9, EN, 1, 'tonne of TNT');
  def('hp', 745.69987158227022, P, 0, 'horsepower (mechanical)'); def('PS', 735.49875, P, 0, 'metric horsepower');
  def('dyn', 1e-5, F, 0, 'dyne'); def('lbf', LB * G0, F, 0, 'pound-force'); def('kgf', G0, F, 0, 'kilogram-force'); def('ozf', LB * G0 / 16, F, 0, 'ounce-force'); def('kip', 1000 * LB * G0, F, 0, 'kip');
  def('gn', G0, ACC, 0, 'standard gravity', ['g0', 'g₀']); def('Gal', 0.01, ACC, 1, 'gal (acceleration)');
  def('in', IN, L, 0, 'inch'); def('ft', FT, L, 0, 'foot'); def('yd', 0.9144, L, 0, 'yard'); def('mi', 1609.344, L, 0, 'mile'); def('nmi', 1852, L, 0, 'nautical mile', ['NM']);
  def('mil', 2.54e-5, L, 0, 'mil (thou)', ['thou']); def('ftm', 1.8288, L, 0, 'fathom'); def('μin', 2.54e-8, L, 0, 'microinch', ['uin']);
  def('acre', 4046.8564224, pow(L, 2), 0, 'acre', ['ac']);
  def('gal', GAL, pow(L, 3), 0, 'US gallon'); def('qt', GAL / 4, pow(L, 3), 0, 'US quart'); def('pt', GAL / 8, pow(L, 3), 0, 'US pint'); def('cup', GAL / 16, pow(L, 3), 0, 'US cup');
  def('floz', GAL / 128, pow(L, 3), 0, 'US fluid ounce', ['fl_oz']); def('tbsp', GAL / 256, pow(L, 3), 0, 'tablespoon'); def('tsp', GAL / 768, pow(L, 3), 0, 'teaspoon');
  def('impgal', 4.54609e-3, pow(L, 3), 0, 'imperial gallon'); def('bbl', 0.158987294928, pow(L, 3), 0, 'oil barrel'); def('cc', 1e-6, pow(L, 3), 0, 'cubic centimetre');
  def('lb', LB, M, 0, 'pound', ['lbm']); def('oz', LB / 16, M, 0, 'ounce'); def('st', 6.35029318, M, 0, 'stone'); def('ton', 907.18474, M, 0, 'short ton'); def('LT', 1016.0469088, M, 0, 'long ton');
  def('slug', 14.593902937, M, 0, 'slug'); def('gr', 6.479891e-5, M, 0, 'grain'); def('ct', 2e-4, M, 0, 'carat'); def('ozt', 0.0311034768, M, 0, 'troy ounce');
  def('mph', 0.44704, V, 0, 'mile per hour'); def('kn', 1852 / 3600, V, 0, 'knot', ['kt', 'knot']); def('kph', 1 / 3.6, V, 0, 'kilometre per hour');
  def('c', C0, V, 0, 'speed of light'); def('G', 1e-4, D({ kg: 1, s: -2, A: -1 }), 1, 'gauss'); def('Mx', 1e-8, mul(VOLT, T), 0, 'maxwell');
  def('Oe', 1000 / (4 * PI), mul(I, L, -1), 0, 'oersted'); def('P', 0.1, mul(PR, T), 1, 'poise'); def('St', 1e-4, mul(pow(L, 2), T, -1), 1, 'stokes');
  def('Ci', 3.7e10, pow(T, -1), 1, 'curie'); def('rem', 0.01, mul(EN, M, -1), 1, 'rem'); def('fc', 10.763910417, mul(mul(CD, pow(ANG, 2)), pow(L, 2), -1), 0, 'foot-candle');
  def('nit', 1, mul(CD, pow(L, 2), -1), 0, 'nit (cd/m²)'); def('Ah', 3600, CH, 1, 'ampere-hour'); def('M', 1000, mul(MOL, pow(L, 3), -1), 1, 'molar (mol/L)');
  def('bit', 1, BIT, 1, 'bit'); def('B', 8, BIT, 1, 'byte', ['byte']);
  def('gpm', GAL / 60, mul(pow(L, 3), T, -1), 0, 'US gallon per minute'); def('cfm', FT * FT * FT / 60, mul(pow(L, 3), T, -1), 0, 'cubic foot per minute');
  def('°C', 1, K, 0, 'degree Celsius', ['degC', '℃']); def('°F', 5 / 9, K, 0, 'degree Fahrenheit', ['degF', '℉']); def('°R', 5 / 9, K, 0, 'degree Rankine', ['degR']);
  const OFFSET = { '°C': 273.15, degC: 273.15, '℃': 273.15, '°F': 273.15 - 32 * 5 / 9, degF: 273.15 - 32 * 5 / 9, '℉': 273.15 - 32 * 5 / 9 };

  const PREFIX = { Q: 1e30, R: 1e27, Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 10, d: 0.1, c: 1e-2, m: 1e-3, 'µ': 1e-6, 'μ': 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24, r: 1e-27, q: 1e-30 };
  const PNAME = { Q: 'quetta', R: 'ronna', Y: 'yotta', Z: 'zetta', E: 'exa', P: 'peta', T: 'tera', G: 'giga', M: 'mega', k: 'kilo', h: 'hecto', da: 'deca', d: 'deci', c: 'centi', m: 'milli', 'µ': 'micro', 'μ': 'micro', u: 'micro', n: 'nano', p: 'pico', f: 'femto', a: 'atto', z: 'zepto', y: 'yocto', r: 'ronto', q: 'quecto' };
  const BINPREFIX = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5 };

  function lookup(sym) {
    if (U[sym]) return { ...U[sym], sym };
    for (const [p, f] of Object.entries(BINPREFIX)) if (sym.startsWith(p) && U[sym.slice(p.length)] && U[sym.slice(p.length)].d[8]) return { ...U[sym.slice(p.length)], f: f * U[sym.slice(p.length)].f, sym, name: { Ki: 'kibi', Mi: 'mebi', Gi: 'gibi', Ti: 'tebi', Pi: 'pebi' }[p] + U[sym.slice(p.length)].name };
    for (const p of ['da', ...Object.keys(PREFIX).filter((x) => x !== 'da')]) {
      if (sym.length > p.length && sym.startsWith(p)) { const u = U[sym.slice(p.length)]; if (u && u.px) return { ...u, f: PREFIX[p] * u.f, sym, name: PNAME[p] + u.name }; }
    }
    return null;
  }

  /* ---------- parser: expression of units with ·, *, /, space, ^, superscripts, parentheses, numbers ---------- */
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  function tokenize(s) {
    const out = []; let i = 0;
    s = s.replace(/\\cdot|\\times|×|⋅|•/g, '·').replace(/\\mu\s*/g, 'µ').replace(/\\Omega/g, 'Ω').replace(/\\circ/g, '°').replace(/[{}]/g, '').replace(/\\,|\\ |~/g, ' ');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { out.push({ t: 'sp' }); i++; continue; }
      if (c === '·' || c === '*') { out.push({ t: '*' }); i++; continue; }
      if (c === '/') { out.push({ t: '/' }); i++; continue; }
      if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
      if (c === '^') { i++; const m = s.slice(i).match(/^\(\s*([-+]?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)/) || s.slice(i).match(/^\s*([-+]?\d+(?:\.\d+)?)/); if (!m) throw new Error('Exponent expected after ^'); out.push({ t: 'pow', v: evalFrac(m[1]) }); i += m[0].length; continue; }
      if (SUP[c]) { let e = ''; while (i < s.length && SUP[s[i]]) e += SUP[s[i++]]; out.push({ t: 'pow', v: +e }); continue; }
      const nm = s.slice(i).match(/^\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
      if (nm) {
        // a bare number right after a unit is an exponent (m2, s-1 style)
        const prev = out[out.length - 1];
        if (prev && prev.t === 'u') { out.push({ t: 'pow', v: +nm[0] }); i += nm[0].length; continue; }
        out.push({ t: 'n', v: +nm[0] }); i += nm[0].length; continue;
      }
      if (c === '-' && /\d/.test(s[i + 1] || '') && out.length && out[out.length - 1].t === 'u') { const m = s.slice(i).match(/^-\d+/); out.push({ t: 'pow', v: +m[0] }); i += m[0].length; continue; }
      const um = s.slice(i).match(/^(°[CFR]|inH2O|cmH2O|%|[A-Za-zµμΩÅ°℃℉'′″"_₀ħ]+)/);
      if (um) { out.push({ t: 'u', v: um[1] }); i += um[1].length; continue; }
      throw new Error('Unexpected “' + c + '” in unit');
    }
    return out;
  }
  function evalFrac(x) { const [a, b] = x.split('/'); return b ? +a / +b : +a; }
  function parse(str) {
    const s = String(str || '').trim();
    if (!s || s === '1' || s === '—' || s === '-') return { f: 1, d: ONE.slice(), simple: null };
    const tk = tokenize(s).filter((t, i, a) => !(t.t === 'sp' && (i === 0 || i === a.length - 1 || ['*', '/', '(', 'sp'].includes(a[i - 1].t) || ['*', '/', ')', 'pow'].includes((a[i + 1] || {}).t))));
    let pos = 0;
    const peek = () => tk[pos];
    function atom() {
      const t = tk[pos++];
      if (!t) throw new Error('Incomplete unit');
      let r;
      if (t.t === '(') { r = expr(); if (!tk[pos] || tk[pos].t !== ')') throw new Error('Missing )'); pos++; }
      else if (t.t === 'n') r = { f: t.v, d: ONE.slice() };
      else if (t.t === 'u') { const u = lookup(t.v); if (!u) throw new Error('Unknown unit “' + t.v + '”'); r = { f: u.f, d: u.d.slice(), sym: t.v }; }
      else throw new Error('Unexpected symbol in unit');
      while (peek() && peek().t === 'pow') { const p = tk[pos++].v; r = { f: Math.pow(r.f, p), d: pow(r.d, p) }; }
      return r;
    }
    function term() {
      let r = atom();
      for (;;) {
        const t = peek();
        if (!t || t.t === ')') return r;
        if (t.t === '*' || t.t === 'sp') { pos++; const b = atom(); r = { f: r.f * b.f, d: mul(r.d, b.d) }; continue; }
        if (t.t === '/') { pos++; const b = atom(); r = { f: r.f / b.f, d: mul(r.d, b.d, -1) }; continue; }
        if (t.t === 'u' || t.t === '(' || t.t === 'n') { const b = atom(); r = { f: r.f * b.f, d: mul(r.d, b.d) }; continue; }
        throw new Error('Unexpected symbol in unit');
      }
    }
    function expr() { return term(); }
    const r = expr();
    if (pos < tk.length) throw new Error('Unexpected “)”');
    const single = tk.length === 1 && tk[0].t === 'u' ? tk[0].v : null;
    return { f: r.f, d: r.d.map((x) => Math.round(x * 1e9) / 1e9), simple: single };
  }
  const sameDim = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  function compatible(a, b) { try { return sameDim(parse(a).d, parse(b).d); } catch (e) { return false; } }
  /** Convert value from unit `a` to unit `b`. Temperatures with offsets convert absolutely when both are plain temperature units. */
  function convert(value, a, b) {
    const pa = parse(a), pb = parse(b);
    if (!sameDim(pa.d, pb.d)) throw new Error('Cannot convert ' + (a || '1') + ' (' + dimText(pa.d) + ') to ' + (b || '1') + ' (' + dimText(pb.d) + ')');
    const oa = pa.simple && OFFSET[pa.simple] !== undefined ? OFFSET[pa.simple] : 0, ob = pb.simple && OFFSET[pb.simple] !== undefined ? OFFSET[pb.simple] : 0;
    if ((oa || ob) && pa.simple && pb.simple && sameDim(pa.d, K)) return ((value * pa.f + oa) - ob) / pb.f;
    return value * pa.f / pb.f;
  }
  function dimText(d) {
    const p = [], n = [];
    d.forEach((e, i) => { if (!e) return; const s = DN[i] + (Math.abs(e) !== 1 ? supNum(Math.abs(e)) : ''); (e > 0 ? p : n).push(s); });
    if (!p.length && !n.length) return 'dimensionless';
    return (p.join('·') || '1') + (n.length ? '/' + (n.length > 1 ? '(' + n.join('·') + ')' : n[0]) : '');
  }
  function supNum(x) { const s = String(Math.round(x * 1000) / 1000); return s.split('').map((c) => ({ 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '.': '·', '/': 'ᐟ' }[c] || c)).join(''); }

  /* ---------- number formatting: engineering (powers of three), scientific or plain ---------- */
  function fmt(x, mode = 'eng', digits = 6) {
    if (!isFinite(x)) return { text: String(x), tex: String(x) };
    if (x === 0) return { text: '0', tex: '0' };
    const sgn = x < 0 ? '−' : '', ax = Math.abs(x);
    let e = Math.floor(Math.log10(ax));
    if (mode === 'plain' || (e >= -3 && e < 6 && mode !== 'sci-force')) {
      if (mode === 'plain' || mode === 'eng' || mode === 'sci') {
        const s = trim(ax.toPrecision(digits));
        if (!/e/.test(s)) return { text: sgn + s, tex: (x < 0 ? '-' : '') + s };
      }
    }
    if (mode === 'eng') e = Math.floor(e / 3) * 3;
    let m = ax / Math.pow(10, e);
    let ms = trim(m.toPrecision(digits));
    if (+ms >= (mode === 'eng' ? 1000 : 10)) { e += mode === 'eng' ? 3 : 1; m = ax / Math.pow(10, e); ms = trim(m.toPrecision(digits)); }
    const supE = supNum(e).replace('·', '.');
    return { text: sgn + ms + '×10' + supE, tex: (x < 0 ? '-' : '') + ms + '\\times10^{' + e + '}', mant: (x < 0 ? '-' : '') + ms, exp: e };
  }
  function trim(s) { if (/e/.test(s)) return s; return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
  /** Giac/JS-friendly number string */
  function num(x, digits = 12) { if (x === 0) return '0'; const s = x.toPrecision(digits); return trim(s.replace(/e\+?/, 'e')).replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e'); }

  /* ---------- unit text → LaTeX ---------- */
  function unitTex(u) {
    if (!u) return '';
    let s = u.replace(/µ|μ/g, '\\mu ').replace(/Ω/g, '\\Omega ').replace(/·/g, '\\cdot ').replace(/°/g, '^{\\circ}');
    s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m) => '^{' + m.split('').map((c) => SUP[c]).join('') + '}');
    return '\\mathrm{' + s + '}';
  }

  /* ---------- curated alternatives per quantity ---------- */
  const QUANTITIES = [
    ['Length', L, ['m', 'km', 'cm', 'mm', 'µm', 'nm', 'pm', 'fm', 'Å', 'in', 'ft', 'yd', 'mi', 'nmi', 'mil', 'au', 'ly', 'pc', 'Mpc']],
    ['Area', pow(L, 2), ['m²', 'cm²', 'mm²', 'µm²', 'km²', 'ha', 'acre', 'in²', 'ft²', 'mi²', 'b']],
    ['Volume', pow(L, 3), ['m³', 'L', 'mL', 'µL', 'cm³', 'mm³', 'in³', 'ft³', 'gal', 'qt', 'pt', 'cup', 'floz', 'tbsp', 'tsp', 'impgal', 'bbl']],
    ['Mass', M, ['kg', 'g', 'mg', 'µg', 't', 'Da', 'MeV/c²', 'GeV/c²', 'lb', 'oz', 'ton', 'LT', 'slug', 'st', 'gr', 'ct', 'ozt']],
    ['Time', T, ['s', 'ms', 'µs', 'ns', 'ps', 'fs', 'min', 'h', 'd', 'wk', 'yr']],
    ['Frequency', pow(T, -1), ['Hz', 'kHz', 'MHz', 'GHz', 'THz', 'PHz', 'rpm', '1/min', '1/h']],
    ['Angular frequency', mul(ANG, T, -1), ['rad/s', '°/s', 'rev/min', 'rev/s', 'mrad/s']],
    ['Speed', V, ['m/s', 'km/h', 'km/s', 'cm/s', 'mm/s', 'µm/s', 'mph', 'kn', 'ft/s', 'in/s', 'ft/ns', 'c']],
    ['Acceleration', ACC, ['m/s²', 'gn', 'cm/s²', 'ft/s²', 'in/s²', 'Gal', 'km/h/s']],
    ['Force', F, ['N', 'kN', 'MN', 'mN', 'µN', 'dyn', 'lbf', 'kgf', 'ozf', 'kip']],
    ['Pressure / stress', PR, ['Pa', 'kPa', 'MPa', 'GPa', 'hPa', 'bar', 'mbar', 'atm', 'Torr', 'mTorr', 'mmHg', 'inHg', 'inH2O', 'psi', 'ksi', 'N/mm²']],
    ['Energy', EN, ['J', 'kJ', 'MJ', 'mJ', 'µJ', 'eV', 'meV', 'keV', 'MeV', 'GeV', 'cal', 'kcal', 'Wh', 'kWh', 'BTU', 'erg', 'Eh', 'Ry', 'ft·lbf', 'tTNT']],
    ['Power', P, ['W', 'kW', 'MW', 'GW', 'mW', 'µW', 'nW', 'hp', 'PS', 'BTU/h', 'erg/s', 'J/s', 'kcal/h']],
    ['Temperature', K, ['K', '°C', '°F', '°R', 'mK']],
    ['Angle', ANG, ['rad', 'mrad', 'µrad', '°', "'", '"', 'mas', 'gon', 'rev']],
    ['Solid angle', pow(ANG, 2), ['sr', '°²']],
    ['Density', mul(M, pow(L, 3), -1), ['kg/m³', 'g/cm³', 'g/mL', 'g/L', 'kg/L', 'lb/ft³', 'lb/in³', 'lb/gal']],
    ['Torque / moment', mul(F, L), ['N·m', 'kN·m', 'N·mm', 'lbf·ft', 'lbf·in', 'ozf·in', 'kgf·m']],
    ['Dynamic viscosity', mul(PR, T), ['Pa·s', 'mPa·s', 'P', 'cP', 'lbf·s/ft²']],
    ['Kinematic viscosity', mul(pow(L, 2), T, -1), ['m²/s', 'mm²/s', 'cm²/s', 'St', 'cSt', 'ft²/s']],
    ['Volumetric flow', mul(pow(L, 3), T, -1), ['m³/s', 'm³/h', 'L/s', 'L/min', 'mL/min', 'gpm', 'cfm', 'ft³/s']],
    ['Mass flow', mul(M, T, -1), ['kg/s', 'kg/h', 'g/s', 'lb/s', 'lb/h']],
    ['Charge', CH, ['C', 'mC', 'µC', 'nC', 'pC', 'Ah', 'mAh', 'e₀']],
    ['Current', I, ['A', 'mA', 'µA', 'nA', 'pA', 'kA']],
    ['Voltage', VOLT, ['V', 'mV', 'µV', 'nV', 'kV', 'MV']],
    ['Resistance', OHM, ['Ω', 'mΩ', 'kΩ', 'MΩ', 'GΩ']],
    ['Conductance', pow(OHM, -1), ['S', 'mS', 'µS', 'nS']],
    ['Capacitance', mul(CH, VOLT, -1), ['F', 'mF', 'µF', 'nF', 'pF', 'fF']],
    ['Inductance', mul(mul(VOLT, T), I, -1), ['H', 'mH', 'µH', 'nH', 'pH']],
    ['Magnetic flux density', U.T.d, ['T', 'mT', 'µT', 'nT', 'G', 'mG']],
    ['Magnetic flux', mul(VOLT, T), ['Wb', 'mWb', 'µWb', 'Mx', 'V·s']],
    ['Magnetic field strength', mul(I, L, -1), ['A/m', 'kA/m', 'Oe']],
    ['Electric field', mul(VOLT, L, -1), ['V/m', 'kV/m', 'MV/m', 'V/cm', 'kV/cm', 'V/µm', 'V/mm']],
    ['Irradiance / intensity', mul(P, pow(L, 2), -1), ['W/m²', 'mW/cm²', 'W/cm²', 'kW/m²', 'MW/cm²', 'GW/cm²', 'µW/mm²']],
    ['Fluence / energy density', mul(EN, pow(L, 2), -1), ['J/m²', 'J/cm²', 'mJ/cm²', 'µJ/cm²']],
    ['Luminous intensity', CD, ['cd', 'mcd']],
    ['Luminous flux', U.lm.d, ['lm', 'mlm']],
    ['Illuminance', U.lx.d, ['lx', 'fc', 'lm/m²']],
    ['Luminance', U.nit.d, ['cd/m²', 'nit', 'cd/cm²']],
    ['Radioactivity', U.Bq.d, ['Bq', 'kBq', 'MBq', 'GBq', 'Ci', 'mCi', 'µCi']],
    ['Absorbed / equivalent dose', U.Gy.d, ['Gy', 'mGy', 'Sv', 'mSv', 'µSv', 'rem', 'mrem']],
    ['Amount of substance', MOL, ['mol', 'mmol', 'µmol', 'nmol', 'kmol']],
    ['Concentration', U.M.d, ['mol/L', 'M', 'mM', 'µM', 'nM', 'mol/m³']],
    ['Data', BIT, ['bit', 'B', 'kB', 'MB', 'GB', 'TB', 'KiB', 'MiB', 'GiB', 'TiB', 'kbit', 'Mbit', 'Gbit']],
    ['Data rate', mul(BIT, T, -1), ['bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s', 'B/s', 'kB/s', 'MB/s', 'GB/s']],
    ['Wavenumber / inverse length', pow(L, -1), ['1/m', '1/cm', '1/mm', '1/µm', '1/nm']],
    ['Thermal conductivity', mul(P, mul(L, K), -1), ['W/(m·K)', 'W/(cm·K)', 'mW/(m·K)', 'BTU/(h·ft·°F)', 'cal/(s·cm·K)']],
    ['Heat transfer coefficient', mul(P, mul(pow(L, 2), K), -1), ['W/(m²·K)', 'W/(cm²·K)', 'BTU/(h·ft²·°F)']],
    ['Specific heat', mul(EN, mul(M, K), -1), ['J/(kg·K)', 'J/(g·K)', 'kJ/(kg·K)', 'cal/(g·K)', 'BTU/(lb·°F)']],
    ['Molar energy', mul(EN, MOL, -1), ['J/mol', 'kJ/mol', 'kcal/mol', 'eV·NA', 'kWh/mol']],
    ['Specific energy', mul(EN, M, -1), ['J/kg', 'kJ/kg', 'MJ/kg', 'kWh/kg', 'BTU/lb', 'Wh/kg']],
    ['Coefficient per kelvin', pow(K, -1), ['1/K', 'ppm/K', 'ppb/K', '1/°F']],
    ['Mobility', mul(pow(L, 2), mul(VOLT, T), -1), ['m²/(V·s)', 'cm²/(V·s)']],
    ['Number density', pow(L, -3), ['1/m³', '1/cm³', '1/mm³', '1/L']],
    ['Electric resistivity', mul(OHM, L), ['Ω·m', 'Ω·cm', 'µΩ·cm', 'nΩ·m', 'Ω·mm²/m']],
    ['Spectral dispersion (ps/(nm·km))', mul(T, pow(L, 2), -1), ['ps/(nm·km)', 's/m²', 'fs/(nm·mm)']],
    ['Action / angular momentum', mul(EN, T), ['J·s', 'eV·s', 'meV·ps', 'erg·s', 'J/Hz', 'eV/Hz', 'ħ']],
    ['Entropy / heat capacity', mul(EN, K, -1), ['J/K', 'eV/K', 'meV/K', 'µeV/K', 'erg/K', 'cal/K', 'k_B']],
    ['Molar heat capacity', mul(EN, mul(MOL, K), -1), ['J/(mol·K)', 'kJ/(mol·K)', 'cal/(mol·K)', 'L·atm/(mol·K)', 'L·bar/(mol·K)', 'm³·Pa/(mol·K)']],
    ['Gravitational constant', mul(pow(L, 3), mul(M, pow(T, 2)), -1), ['m³/(kg·s²)', 'N·m²/kg²', 'cm³/(g·s²)', 'km³/(kg·s²)']],
    ['Gravitational parameter', mul(pow(L, 3), pow(T, 2), -1), ['m³/s²', 'km³/s²']],
    ['Permittivity', mul(U.F.d, L, -1), ['F/m', 'pF/m', 'C²/(N·m²)', 'e₀²/(eV·µm)']],
    ['Permeability', mul(U.H.d, L, -1), ['H/m', 'µH/m', 'N/A²', 'T·m/A']],
    ['Magnetic moment', mul(EN, U.T.d, -1), ['J/T', 'eV/T', 'µeV/T', 'A·m²', 'erg/G']],
    ['Frequency per volt', mul(pow(T, -1), VOLT, -1), ['Hz/V', 'GHz/µV', 'THz/mV', 'MHz/µV']],
    ['Charge per mass', mul(CH, M, -1), ['C/kg', 'C/g', 'mC/kg']],
    ['Length × temperature', mul(L, K), ['m·K', 'mm·K', 'µm·K', 'nm·K', 'cm·K']],
    ['Frequency per kelvin', mul(pow(T, -1), K, -1), ['Hz/K', 'GHz/K', 'THz/K']],
    ['Radiant power × area', mul(P, pow(L, 2)), ['W·m²', 'W·cm²', 'W·µm²']],
    ['Radiation constant σ', mul(P, mul(pow(L, 2), pow(K, 4)), -1), ['W/(m²·K⁴)', 'W/(cm²·K⁴)', 'erg/(s·cm²·K⁴)']],
    ['Molar volume', mul(pow(L, 3), MOL, -1), ['m³/mol', 'L/mol', 'cm³/mol', 'mL/mol']],
    ['Inverse amount', pow(MOL, -1), ['1/mol', '1/mmol', '1/kmol']],
    ['Charge per amount', mul(CH, MOL, -1), ['C/mol', 'kC/mol', 'mAh/mmol']],
    ['Dimensionless', ONE, ['1', '%', 'ppm', 'ppb', 'ppt']],
  ];
  // dimensionless helpers usable in expressions
  def('%', 0.01, ONE, 0, 'percent'); def('ppm', 1e-6, ONE, 0, 'parts per million'); def('ppb', 1e-9, ONE, 0, 'parts per billion'); def('ppt', 1e-12, ONE, 0, 'parts per trillion');
  def('e₀', E, CH, 0, 'elementary charge', ['qe']); def('hc', H * C0, mul(EN, L), 0, 'h·c'); def('NA', NA, pow(MOL, -1), 0, 'Avogadro constant'); def('k_B', KB, mul(EN, K, -1), 0, 'Boltzmann constant');
  def('ħ', H / (2 * PI), mul(EN, T), 0, 'reduced Planck constant', ['hbar']);

  function quantityOf(d) { return QUANTITIES.find((q) => sameDim(q[1], d)) || null; }

  /* SI prefix variants of a unit, chosen around the value's magnitude (engineering steps) */
  function prefixed(unitStr, value) {
    const m = /^([A-Za-zΩ]+)(.*)$/.exec(unitStr); if (!m) return [];
    const base = U[m[1]]; if (!base || !base.px) return [];
    const out = [];
    for (const p of ['T', 'G', 'M', 'k', '', 'm', 'µ', 'n', 'p', 'f']) {
      const sym = (p + m[1]) + m[2];
      try { const v = convert(value, unitStr, sym); if (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e6) out.push(sym); } catch (e) { /* skip */ }
    }
    return out;
  }
  /** Alternative units for a quantity given in unit u (value used to keep prefixes sensible). */
  function alternatives(u, value = 1) {
    let p; try { p = parse(u); } catch (e) { return []; }
    const q = quantityOf(p.d);
    const set = new Set([u]);
    for (const s of prefixed(u, value)) set.add(s);
    if (q) for (const s of q[2]) { try { if (compatible(u, s)) set.add(s); } catch (e) {} }
    if (/pc\b/.test(u)) { set.add('1/s'); set.add('1/Gyr'); }
    // equivalent SI spelling
    set.add(siText(p.d));
    return [...set].filter((s) => { try { parse(s); return true; } catch (e) { return false; } });
  }
  function siText(d) {
    // Prefer named derived units when they match exactly
    for (const n of ['J', 'W', 'N', 'Pa', 'C', 'V', 'Ω', 'F', 'H', 'T', 'Wb', 'Hz', 'S']) if (sameDim(U[n].d, d)) return n;
    const p = [], q = [];
    d.forEach((e, i) => { if (!e) return; const s = DN[i] + (Math.abs(e) !== 1 ? supNum(Math.abs(e)) : ''); (e > 0 ? p : q).push(s); });
    if (!p.length && !q.length) return '1';
    return (p.join('·') || '1') + (q.length ? '/' + (q.length > 1 ? '(' + q.join('·') + ')' : q[0]) : '');
  }

  /* ---------- spectroscopic equivalents (photon energy ↔ frequency ↔ wavelength ↔ wavenumber ↔ temperature) ---------- */
  const SPEC = {
    energy: (x) => x, freq: (x) => x * H, wavelength: (x) => H * C0 / x, wavenumber: (x) => H * C0 * x, temp: (x) => KB * x, angfreq: (x) => x * H / (2 * PI),
  };
  const SPEC_INV = {
    energy: (E_) => E_, freq: (E_) => E_ / H, wavelength: (E_) => H * C0 / E_, wavenumber: (E_) => E_ / (H * C0), temp: (E_) => E_ / KB, angfreq: (E_) => E_ * 2 * PI / H,
  };
  const SPEC_UNITS = { energy: 'J', freq: 'Hz', wavelength: 'm', wavenumber: '1/m', temp: 'K', angfreq: 'rad/s' };
  function specKind(u) {
    let p; try { p = parse(u); } catch (e) { return null; }
    for (const [k, su] of Object.entries(SPEC_UNITS)) if (sameDim(parse(su).d, p.d)) return k;
    return null;
  }
  /** Photon equivalents of a value in unit u: [{kind, unit, value}] in convenient units. */
  function photonEquivalents(value, u) {
    const k = specKind(u); if (!k || k === 'temp' || !value) return [];
    const Ej = SPEC[k](convert(value, u, SPEC_UNITS[k]));
    if (!(Ej > 0)) return [];
    const pick = (kind, units) => { const si = SPEC_INV[kind](Ej); const conv = units.map((x) => [x, convert(si, SPEC_UNITS[kind], x)]); const best = conv.find(([, v]) => Math.abs(v) >= 1 && Math.abs(v) < 1000) || conv[0]; return { kind, unit: best[0], value: best[1] }; };
    return [
      (() => { const ev = convert(Ej, 'J', 'eV'); return ev >= 0.01 && ev < 1e4 ? { kind: 'energy', unit: 'eV', value: ev } : pick('energy', ['meV', 'keV', 'µeV', 'MeV', 'GeV', 'J']); })(),
      pick('wavelength', ['nm', 'µm', 'mm', 'pm', 'm', 'km']),
      pick('freq', ['THz', 'GHz', 'MHz', 'PHz', 'kHz', 'Hz', 'EHz']),
      pick('wavenumber', ['1/cm']),
      pick('temp', ['K']),
    ].filter((x) => x.kind !== k);
  }
  const SPEC_LABEL = { energy: 'photon energy', freq: 'frequency', wavelength: 'vacuum wavelength', wavenumber: 'wavenumber', temp: 'temperature equivalent E/k', angfreq: 'angular frequency' };

  const api = { parse, convert, compatible, dimText, fmt, num, unitTex, alternatives, quantityOf, QUANTITIES, U, lookup, photonEquivalents, specKind, SPEC, SPEC_INV, SPEC_UNITS, SPEC_LABEL, siText, sameDim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Units = api;
})(typeof self !== 'undefined' ? self : this);
