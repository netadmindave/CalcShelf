/*
 * giacfmt.js — parse Giac's printed results into a tree, then
 *   - render TI-Nspire-style LaTeX (fractions, roots, ·, {lists}, [matrices], E-notation, units)
 *   - compile to a fast JavaScript function for graphing
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- tokenizer
  /** The exponent of a shown answer: the same small capital ᴇ the EE key types (2.5ᴇ24, 1.5ᴇ−3). */
  const eeTex = (e) => { e = String(e).replace(/^\+/, ''); return 'ᴇ' + (e[0] === '-' ? '{-}' + e.slice(1) : e); };
  function lex(s) {
    const t = []; let i = 0;
    const two = [':=', '==', '!=', '<=', '>=', '->', '&&', '||', '=>'];
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\n' || c === '\t') { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1]))) {
        let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if ((s[j] === 'e' || s[j] === 'E') && /[-+0-9]/.test(s[j + 1] || '') && (/[0-9]/.test(s[j + 1]) || /[0-9]/.test(s[j + 2] || ''))) { j++; if (s[j] === '+' || s[j] === '-') j++; while (/[0-9]/.test(s[j] || '')) j++; }
        t.push({ t: 'num', v: s.slice(i, j) }); i = j; continue;
      }
      if (/[A-Za-z_Ͱ-Ͽ]/.test(c)) {
        let j = i; while (j < s.length && /[\wͰ-Ͽ▸]/.test(s[j])) j++;
        const w = s.slice(i, j);
        if (['and', 'or', 'xor', 'not', 'mod'].includes(w)) t.push({ t: 'op', v: w }); else t.push({ t: 'id', v: w });
        i = j; continue;
      }
      if (c === '"') { let j = i + 1, v = ''; while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; } v += s[j++]; } t.push({ t: 'str', v }); i = j + 1; continue; }
      const p2 = s.slice(i, i + 2);
      if (two.includes(p2)) { t.push({ t: 'op', v: p2 }); i += 2; continue; }
      t.push({ t: 'op', v: c }); i++;
    }
    return t;
  }

  // ---------------------------------------------------------------- parser (precedence climbing)
  function parse(s) {
    const t = lex(s); let i = 0;
    const peek = () => t[i], next = () => t[i++];
    const isOp = (v) => t[i] && t[i].t === 'op' && t[i].v === v;
    const expect = (v) => { if (!isOp(v)) throw new Error('expected ' + v + ' at ' + i + ' in ' + s); i++; };
    const BIN = [
      [['=>'], 'r'], [[':='], 'r'], [['or', '||'], 'l'], [['xor'], 'l'], [['and', '&&'], 'l'],
      [['==', '!=', '<', '>', '<=', '>=', '='], 'l'], [['+', '-'], 'l'], [['*', '/', 'mod'], 'l'],
    ];
    function expr(level = 0) {
      if (level === 0 && isOp('->')) {}
      if (level >= BIN.length) return unary();
      let a = expr(level + 1);
      for (;;) {
        const k = peek();
        if (!k || k.t !== 'op' || !BIN[level][0].includes(k.v)) break;
        i++;
        const b = BIN[level][1] === 'r' ? expr(level) : expr(level + 1);
        a = { t: 'bin', op: k.v === '&&' ? 'and' : k.v === '||' ? 'or' : k.v, a, b };
      }
      // ternary  c ? a : b  (lowest)
      if (level === 0 && isOp('?')) { i++; const x = expr(0); expect(':'); const y = expr(0); a = { t: 'tern', c: a, a: x, b: y }; }
      return a;
    }
    function unary() {
      if (isOp('-')) { i++; return { t: 'neg', a: unary() }; }
      if (isOp('+')) { i++; return unary(); }
      if (isOp('not')) { i++; return { t: 'not', a: unary() }; }
      return power();
    }
    function power() {
      let b = postfix();
      if (isOp('^')) { i++; const e = unary(); return { t: 'bin', op: '^', a: b, b: e }; }
      return b;
    }
    function postfix() {
      let a = primary();
      for (;;) {
        if (isOp('!')) { i++; a = { t: 'fact', a }; continue; }
        if (isOp("'")) { i++; a = { t: 'prime', a }; continue; }
        if (isOp('[')) { i++; const ix = list(']'); a = { t: 'idx', a, i: ix }; continue; }
        const k = peek();
        if (k && k.t === 'id' && k.v[0] === '_' && (a.t === 'num' || a.t === 'neg' || a.t === 'bin' || a.t === 'call')) {
          i++;
          if (k.v === '_' && isOp('(')) { i++; const u = expr(); expect(')'); a = { t: 'unit', a, u }; }
          else a = { t: 'unit', a, u: { t: 'id', v: k.v } };
          continue;
        }
        return a;
      }
    }
    function list(close) {
      const items = [];
      if (isOp(close)) { i++; return items; }
      for (;;) { items.push(expr()); if (isOp(',')) { i++; continue; } expect(close); return items; }
    }
    function primary() {
      const k = next();
      if (!k) throw new Error('unexpected end');
      if (k.t === 'num') return { t: 'num', v: k.v };
      if (k.t === 'str') return { t: 'str', v: k.v };
      if (k.t === 'op') {
        if (k.v === '(') {
          // lambda  (x,y)->body
          const save = i;
          const items = list(')');
          if (isOp('->')) { i++; const body = expr(); return { t: 'lambda', params: items, body }; }
          if (items.length === 1) return { t: 'paren', a: items[0] };
          return { t: 'seq', items };
        }
        if (k.v === '[') { const items = list(']'); return { t: 'vec', items, kind: 'vec' }; }
        if (k.v === '{') { const items = list('}'); return { t: 'vec', items, kind: 'set' }; }
        if (k.v === '√') { const a = postfix(); return { t: 'call', f: 'sqrt', args: [a] }; }
        if (k.v === '∞') return { t: 'id', v: 'infinity' };
        throw new Error('unexpected ' + k.v);
      }
      // identifiers
      const v = k.v;
      if ((v === 'list' || v === 'set' || v === 'poly1' || v === 'seq') && isOp('[')) { i++; const items = list(']'); return { t: 'vec', items, kind: v === 'set' ? 'set' : v === 'seq' ? 'seq' : 'list' }; }
      if (v === 'line' && isOp('[')) { i++; const items = list(']'); return { t: 'vec', items, kind: 'vec' }; }
      if (isOp('(')) { i++; const args = list(')'); return { t: 'call', f: v, args }; }
      if (k.t === 'id' && v === 'x' && 0) return null;
      // x->body
      if (isOp('->')) { i++; const body = expr(); return { t: 'lambda', params: [{ t: 'id', v }], body }; }
      return { t: 'id', v };
    }
    const r = expr();
    if (i < t.length) throw new Error('trailing input in ' + s);
    return r;
  }

  // ---------------------------------------------------------------- LaTeX (Nspire look)
  const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega']);
  const TRIG = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch']);
  const INVT = { asin: 'sin', acos: 'cos', atan: 'tan', acot: 'cot', asec: 'sec', acsc: 'csc', asinh: 'sinh', acosh: 'cosh', atanh: 'tanh' };
  const PREC = { or: 1, xor: 2, and: 3, '==': 4, '!=': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '=': 4, '+': 5, '-': 5, '*': 6, '/': 6, mod: 6, neg: 6.5, '^': 7 };

  /** thin-space digit groups: 1 234 567.891 2 (display only, never in editable LaTeX) */
  function groupDigits(s) {
    const m = String(s).match(/^(-?)(\d+)(?:\.(\d*))?$/); if (!m) return s;
    let ip = m[2], fp = m[3];
    if (ip.length > 4) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
    if (fp && fp.length > 4) fp = fp.replace(/(\d{3})(?=\d)/g, '$1\\,');
    return m[1] + ip + (fp != null ? '.' + fp : '');
  }
  function fmtNum(v, opts) {
    const g = opts.group && !opts.editable ? groupDigits : (x) => x;
    if (!/[.eE]/.test(v)) {   // integer: exact, digits kept
      return g(v);
    }
    let x = Number(v);
    if (!isFinite(x)) return v;
    const digits = opts.digits || 12;
    let s;
    const ax = Math.abs(x);
    if (opts.eng && ax !== 0) {
      // engineering notation: exponent a multiple of 3, mantissa 1 ≤ |m| < 1000
      let e = Math.floor(Math.log10(ax) / 3) * 3, m = +(x / Math.pow(10, e)).toPrecision(digits);
      if (Math.abs(m) >= 1000) { e += 3; m = +(x / Math.pow(10, e)).toPrecision(digits); }
      const ms = g(String(m).includes('e') ? m.toFixed(Math.max(0, digits - 1)) : String(m));
      if (e === 0) return ms;
      if (opts.editable) return ms + 'ᴇ' + e;   // TI-style, read back by tex2giac
      return ms + eeTex(e);
    }
    if (opts.sci || (ax !== 0 && (ax >= 1e12 || ax < 1e-4))) {
      s = x.toExponential(Math.max(0, digits - 1));
      let [m, e] = s.split('e');
      if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '.');
      if (opts.editable) return m + 'ᴇ' + (e[0] === '+' ? e.slice(1) : e);
      return m + eeTex(e);
    }
    s = x.toPrecision(digits);
    if (s.includes('e')) return fmtNum(x.toExponential(), { ...opts, sci: true });
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '.');
    return g(s);
  }

  function idTex(v) {
    if (v === 'pi') return '\\pi';
    if (v === 'infinity' || v === '+infinity') return '\\infty';
    if (v === 'i') return '\\mathrm{i}';
    if (v === 'e') return '\\mathrm{e}';
    if (v === 'undef') return '\\mathrm{undef}';
    if (v === 'true' || v === 'false') return '\\mathrm{' + v + '}';
    if (v[0] === '_') return '\\mathrm{\\_' + v.slice(1).replace(/_/g, '\\_') + '}';
    if (GREEK.has(v)) return '\\' + v;
    const m = v.match(/^([A-Za-z]+)_(\w+)$/);
    if (m) return idTex(m[1]) + '_{' + m[2].replace(/_/g, '\\_') + '}';
    const m2 = v.match(/^([A-Za-z]+?)(\d+)$/);
    if (v.length === 1) return v;
    if (m2 && m2[1].length === 1) return m2[1] + m2[2];
    return '\\mathit{' + v.replace(/_/g, '\\_') + '}';
  }

  function isAtomic(n) { return n.t === 'num' && !/^-/.test(n.v) || n.t === 'id' || n.t === 'call' || n.t === 'vec' || n.t === 'paren' || n.t === 'fact'; }

  function tex(n, opts = {}, parentPrec = 0) {
    const T = (x, p = 0) => tex(x, opts, p);
    const wrapIf = (s, cond) => (cond ? '\\left(' + s + '\\right)' : s);
    switch (n.t) {
      case 'num': return fmtNum(n.v, opts);
      case 'id': return idTex(n.v);
      case 'str': return '\\text{"' + n.v.replace(/[\\{}]/g, '') + '"}';
      case 'paren': return T(n.a, parentPrec);
      case 'seq': return n.items.map((x) => T(x)).join(',');
      case 'neg': {
        const inner = T(n.a, PREC.neg);
        return wrapIf('-' + inner, parentPrec > PREC.neg);
      }
      case 'not': return '\\operatorname{not}\\ ' + T(n.a, 7);
      case 'fact': return T(n.a, 8) + '!';
      case 'prime': return T(n.a, 8) + "'";
      case 'idx': return T(n.a, 8) + '\\left[' + n.i.map((x) => T(x)).join(',') + '\\right]';
      case 'unit': return T(n.a, PREC['*']) + '\\,' + unitTex(n.u);
      case 'lambda': return '\\left(' + n.params.map((x) => T(x)).join(',') + '\\right)\\mapsto ' + T(n.body);
      case 'tern': return '\\begin{cases}' + T(n.a) + ', & ' + T(n.c) + '\\\\ ' + T(n.b) + ', & \\text{else}\\end{cases}';
      case 'vec': {
        const its = n.items;
        const isMat = its.length > 0 && its.every((r) => r.t === 'vec' && r.kind === 'vec') && its.every((r) => r.items.length === its[0].items.length) && n.kind !== 'set';
        if (isMat) return '\\begin{bmatrix}' + its.map((r) => r.items.map((x) => T(x)).join(' & ')).join('\\\\ ') + '\\end{bmatrix}';
        if (n.kind === 'set') return '\\left\\lbrace ' + its.map((x) => T(x)).join(',') + '\\right\\rbrace';
        return '\\left\\lbrace ' + its.map((x) => T(x)).join(',') + '\\right\\rbrace';
      }
      case 'call': return callTex(n, opts);
      case 'bin': {
        const op = n.op, p = PREC[op] || 4;
        if (op === '/') {
          // (a/b)/c with numeric a,b → a/(b·c)
          if (n.a.t === 'bin' && n.a.op === '/' && n.a.a.t === 'num' && n.a.b.t === 'num') return '\\frac{' + T(n.a.a) + '}{' + T(n.a.b, 6) + '\\cdot ' + T(n.b, 6) + '}';
          // negative numerator: -a/b → -\frac{a}{b}
          if (n.a.t === 'neg') return wrapIf('-\\frac{' + T(n.a.a) + '}{' + T(n.b) + '}', parentPrec > PREC.neg);
          return '\\frac{' + T(n.a) + '}{' + T(n.b) + '}';
        }
        if (op === '^') {
          // x^(1/2) → √x
          if (n.b.t === 'bin' && n.b.op === '/' && n.b.a.t === 'num' && n.b.a.v === '1' && n.b.b.t === 'num' && n.b.b.v === '2') return '\\sqrt{' + T(n.a) + '}';
          let base = T(n.a, 8);
          if (n.a.t === 'call' && TRIG.has(n.a.f) && n.b.t === 'num') base = '\\' + n.a.f + '^{' + T(n.b) + '}\\left(' + n.a.args.map((x) => T(x)).join(',') + '\\right)';
          else if (n.a.t === 'call' && TRIG.has(n.a.f)) base = '\\left(' + T(n.a) + '\\right)';
          if (n.a.t === 'call' && TRIG.has(n.a.f) && n.b.t === 'num') return wrapIf(base, parentPrec > p);
          const needs = !(n.a.t === 'id' || (n.a.t === 'num' && !/^-/.test(n.a.v) && !/[eE]/.test(n.a.v)) || n.a.t === 'call' || n.a.t === 'vec' || n.a.t === 'unit' && 0);
          return wrapIf((needs && !(n.a.t === 'call') ? '\\left(' + T(n.a) + '\\right)' : base) + '^{' + T(n.b) + '}', parentPrec > p);
        }
        if (op === '*' && n.a.t === 'bin' && n.a.op === '/' && n.a.a.t === 'num' && n.a.b.t === 'num' && !/[.eE]/.test(n.a.a.v + n.a.b.v)) {
          // 5/6*pi → 5π/6 (Nspire puts the symbol in the numerator)
          const num = n.a.a.v === '1' ? T(n.b) : T(n.a.a) + '\\cdot ' + T(n.b, 6);
          return wrapIf('\\frac{' + num + '}{' + T(n.a.b) + '}', parentPrec > p);
        }
        if (op === '*' && n.a.t === 'bin' && n.a.op === '/' && n.a.a.t === 'neg' && n.a.a.a.t === 'num' && n.a.b.t === 'num' && !/[.eE]/.test(n.a.a.a.v + n.a.b.v)) {
          const num = n.a.a.a.v === '1' ? T(n.b) : T(n.a.a.a) + '\\cdot ' + T(n.b, 6);
          return wrapIf('-\\frac{' + num + '}{' + T(n.a.b) + '}', parentPrec > PREC.neg);
        }
        if (op === '*' && n.a.t === 'neg' && n.a.a.t === 'bin' && n.a.a.op === '/' && n.a.a.a.t === 'num' && n.a.a.b.t === 'num' && !/[.eE]/.test(n.a.a.a.v + n.a.a.b.v)) {
          const num = n.a.a.a.v === '1' ? T(n.b) : T(n.a.a.a) + '\\cdot ' + T(n.b, 6);
          return wrapIf('-\\frac{' + num + '}{' + T(n.a.a.b) + '}', parentPrec > PREC.neg);
        }
        if (op === '*') {
          const a = T(n.a, p), b = T(n.b, p + 0.01);
          // number times unit-free symbol: Nspire writes 2·x
          let sep = '\\cdot ';
          if (n.b.t === 'unit') sep = '\\cdot ';
          return wrapIf(a + sep + b, parentPrec > p);
        }
        if ((op === '+' || op === '-') && !opts._noReorder) {
          // a+b·i form: real terms first, like the Nspire
          const terms = []; const flat = (x, sg) => { if (x.t === 'bin' && (x.op === '+' || x.op === '-')) { flat(x.a, sg); flat(x.b, x.op === '-' ? -sg : sg); } else if (x.t === 'neg') flat(x.a, -sg); else terms.push([sg, x]); };
          flat(n, 1);
          const hasI = (x) => JSON.stringify(x).includes('"v":"i"');
          const im = terms.filter(([, x]) => hasI(x)), re = terms.filter(([, x]) => !hasI(x));
          if (im.length && re.length && terms.indexOf(re[0]) > 0) {
            const ord = re.concat(im);
            let out = '';
            ord.forEach(([sg, x], k) => { const t = tex(x, { ...opts, _noReorder: true }, 5.01); out += (k === 0 ? (sg < 0 ? '-' : '') : (sg < 0 ? '-' : '+')) + t; });
            return wrapIf(out, parentPrec > p);
          }
        }
        if (op === '+' || op === '-') {
          const a = T(n.a, p);
          let b;
          if (op === '+' && n.b.t === 'neg') { b = T(n.b.a, p + 0.01); return wrapIf(a + '-' + b, parentPrec > p); }
          b = T(n.b, op === '-' ? p + 0.01 : p);
          return wrapIf(a + op + b, parentPrec > p);
        }
        const OPS = { '=': '=', '==': '=', '!=': '\\ne ', '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ', and: '\\ \\mathrm{and}\\ ', or: '\\ \\mathrm{or}\\ ', xor: '\\ \\mathrm{xor}\\ ', mod: '\\bmod ', ':=': ':=', '=>': '\\to ' };
        // Giac prints  3>x  for x<3; flip so the variable reads first, like the Nspire
        if (['<', '>', '<=', '>='].includes(op) && n.a.t === 'num' && n.b.t !== 'num') {
          const flip = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[op];
          return wrapIf(T(n.b, p + 0.01) + OPS[flip] + T(n.a, p + 0.01), parentPrec > p);
        }
        const assoc = op === 'and' || op === 'or';
        return wrapIf(T(n.a, assoc ? p : p + 0.01) + (OPS[op] || op) + T(n.b, assoc ? p : p + 0.01), parentPrec > p);
      }
      default: return '?';
    }
  }

  function unitTex(u) {
    const U = (n) => {
      if (n.t === 'id') return '\\mathrm{\\_' + n.v.replace(/^_/, '') + '}';
      if (n.t === 'num') return fmtNum(n.v.replace(/\.0$/, ''), {});
      if (n.t === 'neg') return '-' + U(n.a);
      if (n.t === 'paren') return U(n.a);
      if (n.t === 'bin' && n.op === '*') return U(n.a) + '\\cdot ' + U(n.b);
      if (n.t === 'bin' && n.op === '/') return '\\frac{' + U(n.a) + '}{' + U(n.b) + '}';
      if (n.t === 'bin' && n.op === '^') return U(n.a) + '^{' + U(n.b) + '}';
      return tex(n);
    };
    return U(u);
  }

  function callTex(n, opts) {
    const T = (x, p = 0) => tex(x, opts, p);
    const A = n.args, f = n.f;
    const argl = () => '\\left(' + A.map((x) => T(x)).join(',') + '\\right)';
    switch (f) {
      case 'sqrt': return '\\sqrt{' + T(A[0]) + '}';
      case 'surd': return '\\sqrt[' + T(A[1]) + ']{' + T(A[0]) + '}';
      case 'exp': if (A[0].t === 'num' && A[0].v === '1') return '\\mathrm{e}'; return '\\mathrm{e}^{' + T(A[0]) + '}';
      case 'abs': return '\\left|' + T(A[0]) + '\\right|';
      case 'ln': return '\\ln' + argl();
      case 'log10': return '\\log_{10}' + argl();
      case 'logb': return '\\log_{' + T(A[1]) + '}\\left(' + T(A[0]) + '\\right)';
      case 'floor': return '\\left\\lfloor ' + T(A[0]) + '\\right\\rfloor ';
      case 'ceil': return '\\left\\lceil ' + T(A[0]) + '\\right\\rceil ';
      case 'conj': return '\\overline{' + T(A[0]) + '}';
      case 'factorial': return T(A[0], 8) + '!';
      case 'diff': return '\\frac{\\mathrm{d}' + (A[2] ? '^{' + T(A[2]) + '}' : '') + '}{\\mathrm{d}' + T(A[1] || { t: 'id', v: 'x' }) + (A[2] ? '^{' + T(A[2]) + '}' : '') + '}\\left(' + T(A[0]) + '\\right)';
      case 'integrate': case 'int':
        if (A.length >= 4) return '\\int_{' + T(A[2]) + '}^{' + T(A[3]) + '}' + T(A[0]) + '\\,\\mathrm{d}' + T(A[1]);
        return '\\int ' + T(A[0]) + '\\,\\mathrm{d}' + T(A[1] || { t: 'id', v: 'x' });
      case 'sum': if (A.length >= 4) return '\\sum_{' + T(A[1]) + '=' + T(A[2]) + '}^{' + T(A[3]) + '}' + T(A[0], 6); break;
      case 'product': if (A.length >= 4) return '\\prod_{' + T(A[1]) + '=' + T(A[2]) + '}^{' + T(A[3]) + '}' + T(A[0], 6); break;
      case 'limit': if (A.length >= 3) return '\\lim_{' + T(A[1]) + '\\to ' + T(A[2]) + (A[3] ? '^{' + (T(A[3]) === '1' ? '+' : '-') + '}' : '') + '}' + T(A[0], 6); break;
      case 'piecewise': {
        const rows = [];
        for (let k = 0; k + 1 < A.length; k += 2) rows.push(T(A[k + 1]) + ', & ' + T(A[k]));
        if (A.length % 2) rows.push(T(A[A.length - 1]) + ', & \\text{else}');
        return '\\begin{cases}' + rows.join('\\\\ ') + '\\end{cases}';
      }
      case 'order_size': return '\\cdots ';
      case 'erf': case 'erfc': case 'Gamma': case 'Beta': case 'Zeta':
        return (f === 'Gamma' ? '\\Gamma' : f === 'Zeta' ? '\\zeta' : '\\mathrm{' + f + '}') + argl();
    }
    if (TRIG.has(f)) return '\\' + f + argl();
    if (INVT[f]) return '\\' + INVT[f] + '^{-1}' + argl();
    return (f.length === 1 ? f : '\\mathrm{' + f.replace(/_/g, '\\_') + '}') + argl();
  }

  // ---------------------------------------------------------------- JS compilation (graphing)
  const JSF = {
    sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', asin: 'Math.asin', acos: 'Math.acos', atan: 'Math.atan',
    sinh: 'Math.sinh', cosh: 'Math.cosh', tanh: 'Math.tanh', asinh: 'Math.asinh', acosh: 'Math.acosh', atanh: 'Math.atanh',
    exp: 'Math.exp', ln: 'Math.log', log10: 'Math.log10', sqrt: 'Math.sqrt', abs: 'Math.abs', floor: 'Math.floor',
    ceil: 'Math.ceil', round: 'Math.round', sign: 'Math.sign', max: 'Math.max', min: 'Math.min', trunc: 'Math.trunc',
    cot: '$.cot', sec: '$.sec', csc: '$.csc', acot: '$.acot', asec: '$.asec', acsc: '$.acsc', coth: '$.coth', sech: '$.sech', csch: '$.csch',
    surd: '$.surd', logb: '$.logb', frac: '$.frac', factorial: '$.fact', Gamma: '$.gamma', erf: '$.erf', erfc: '$.erfc', re: '$.re', im: '$.im',
  };
  const RT = {
    cot: (x) => 1 / Math.tan(x), sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), acot: (x) => Math.atan(1 / x),
    asec: (x) => Math.acos(1 / x), acsc: (x) => Math.asin(1 / x), coth: (x) => 1 / Math.tanh(x), sech: (x) => 1 / Math.cosh(x), csch: (x) => 1 / Math.sinh(x),
    surd: (x, n) => (x < 0 && Math.round(n) % 2 === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n)),
    logb: (x, b) => Math.log(x) / Math.log(b), frac: (x) => x - Math.trunc(x), re: (x) => x, im: () => 0,
    pow: (a, b) => {
      const r = Math.pow(a, b);
      if (isNaN(r) && a < 0) { // real odd roots like x^(1/3)
        for (const q of [3, 5, 7, 9]) { const p = b * q; if (Math.abs(p - Math.round(p)) < 1e-12) { const v = Math.pow(-a, b); return Math.round(p) % 2 ? -v : v; } }
      }
      return r;
    },
    fact: (n) => RT.gamma(n + 1),
    gamma: (z) => {
      if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * RT.gamma(1 - z));
      z -= 1; const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
      let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
      const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
    },
    erf: (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; },
    erfc: (x) => 1 - RT.erf(x),
  };

  function toJS(n, vars) {
    const J = (x) => toJS(x, vars);
    switch (n.t) {
      case 'num': return '(' + Number(n.v) + ')';
      case 'id':
        if (vars.includes(n.v)) return 'v_' + n.v;
        if (n.v === 'pi') return 'Math.PI';
        if (n.v === 'e') return 'Math.E';
        if (n.v === 'infinity') return 'Infinity';
        throw new Error('free variable ' + n.v);
      case 'paren': return J(n.a);
      case 'neg': return '(-' + J(n.a) + ')';
      case 'fact': return '$.fact(' + J(n.a) + ')';
      case 'call': {
        if (n.f === 'exp' && n.args.length === 1) return 'Math.exp(' + J(n.args[0]) + ')';
        if (n.f === 'piecewise') {
          const A = n.args; let s = '';
          for (let k = 0; k + 1 < A.length; k += 2) s += '(' + J(A[k]) + ')?(' + J(A[k + 1]) + '):';
          return '(' + s + (A.length % 2 ? J(A[A.length - 1]) : 'NaN') + ')';
        }
        if (n.f === 'when' || n.f === 'ifte') return '((' + J(n.args[0]) + ')?(' + J(n.args[1]) + '):(' + (n.args[2] ? J(n.args[2]) : 'NaN') + '))';
        const f = Object.prototype.hasOwnProperty.call(JSF, n.f) ? JSF[n.f] : null;
        if (!f) throw new Error('no JS for ' + n.f);
        return f + '(' + n.args.map(J).join(',') + ')';
      }
      case 'tern': return '((' + J(n.c) + ')?(' + J(n.a) + '):(' + J(n.b) + '))';
      case 'not': return '(!' + J(n.a) + ')';
      case 'bin': {
        const a = J(n.a), b = J(n.b);
        switch (n.op) {
          case '^': return '$.pow(' + a + ',' + b + ')';
          case '+': case '-': case '*': case '/': case '<': case '>': case '<=': case '>=': return '(' + a + n.op + b + ')';
          case '==': case '=': return '(' + a + '===' + b + ')';
          case '!=': return '(' + a + '!==' + b + ')';
          case 'and': return '(' + a + '&&' + b + ')';
          case 'or': return '(' + a + '||' + b + ')';
          case 'mod': return '(' + a + '%' + b + ')';
        }
        throw new Error('no JS for op ' + n.op);
      }
      default: throw new Error('no JS for ' + n.t);
    }
  }
  /** Compile a Giac expression string to f(v1, v2, …). Throws if it can't. */
  function compile(src, vars = ['x']) {
    if (!vars.every((v) => /^[A-Za-z_]\w*$/.test(v))) throw new Error('bad variable name');
    const ast = typeof src === 'string' ? parse(src) : src;
    const body = toJS(ast, vars);
    // eslint-disable-next-line no-new-func
    const fn = new Function('$', ...vars.map((v) => 'v_' + v), '"use strict";return ' + body + ';');
    return (...a) => { const r = fn(RT, ...a); return typeof r === 'boolean' ? (r ? 1 : NaN) : r; };
  }

  /** Render a Giac result string as Nspire-style LaTeX. Falls back to verbatim text. */
  function giacToTex(s, opts = {}) {
    s = String(s).trim();
    if (/^GIAC_ERROR|Error:/.test(s)) return null;
    let ast;
    try { ast = parse(s); } catch (e) { return '\\text{' + s.replace(/[\\{}$&#^_%~]/g, (c) => '\\' + c) + '}'; }
    // solve-style results: {a,b} for variable v → v=a or v=b
    if (opts.solveVar && ast.t === 'vec') {
      if (!ast.items.length) return '\\mathrm{false}';
      if (ast.items.every((x) => x.t !== 'vec')) return ast.items.map((x) => idTex(opts.solveVar) + '=' + tex(x, opts)).join('\\ \\mathrm{or}\\ ');
      if (opts.solveVars && ast.items.every((x) => x.t === 'vec' && x.items.length === opts.solveVars.length))
        return ast.items.map((r) => r.items.map((x, k) => idTex(opts.solveVars[k]) + '=' + tex(x, opts)).join('\\ \\mathrm{and}\\ ')).join('\\ \\mathrm{or}\\ ');
    }
    return tex(ast, opts);
  }

  /** LaTeX for plain text (escapes the characters that LaTeX treats specially). */
  function textTex(s) { return '\\text{' + String(s).replace(/[\\{}$&#^_%~]/g, (c) => '\\' + c) + '}'; }
  /** Entry-line LaTeX for a unit such as _km: math mode, so the next key is maths again. */
  function unitEntryTex(u) { return '\\mathrm{\\_' + String(u).replace(/^_/, '').replace(/_/g, '\\_') + '}'; }
  /** Rewrites units saved by older versions as text (\text{\_km}, \text{_#?}km) into math mode. */
  function fixUnitTex(t) {
    return String(t)
      .replace(/\\text\{_#\?\}([A-Za-zµΩÅ°]*)/g, (m, n) => (n ? unitEntryTex(n) : '\\_'))
      .replace(/\\text\{_\}([A-Za-zµΩÅ°]*)/g, (m, n) => (n ? unitEntryTex(n) : '\\_'))
      .replace(/\\(?:text|textrm)\{\\_([^{}\\]*)\}/g, (m, n) => unitEntryTex(n));
  }

  /** History display of an entry: units typed as _m or \mathrm{\_km} show upright, as m and km, a thin space after a number. */
  function showUnitTex(t) {
    return fixUnitTex(t)
      .replace(/\\mathrm\{\\_([^{}\\]*)\}/g, '\\_$1')
      .replace(/(\d\s*)?\\_([A-Za-zµΩÅ°]+)/g, (m, d, n) => (d ? d.trim() + '\\,' : '') + '\\mathrm{' + n + '}');
  }
  const api = { parse, lex, giacToTex, tex, compile, fmtNum, idTex, textTex, unitEntryTex, fixUnitTex, showUnitTex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GiacFmt = api;
})(typeof self !== 'undefined' ? self : this);
