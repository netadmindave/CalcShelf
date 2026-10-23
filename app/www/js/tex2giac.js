/*
 * tex2giac.js — translate the LaTeX produced by the 2D math editor into Giac input,
 * following TI-Nspire CAS conventions:
 *   - multi-letter names are single variables (xy is a variable, not x·y)
 *   - a number followed by a name or bracket multiplies (2x, 3(x+1), (a)(b))
 *   - name( is a function call for multi-letter names and defined functions; x(…) multiplies
 *   - log is base 10, ln natural; {…} are lists; → stores; := defines
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';

  class TexError extends Error {}

  // ---------------------------------------------------------------- tokenizer
  function tokenize(s) {
    const t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        let j = i + 1;
        if (/[A-Za-z]/.test(s[j] || '')) { while (j < s.length && /[A-Za-z]/.test(s[j])) j++; t.push({ t: 'cmd', v: s.slice(i + 1, j) }); i = j; continue; }
        // \\ , \, \; \! \{ \} \| \  etc
        t.push({ t: 'cmd', v: s[j] || '' }); i = j + 1; continue;
      }
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; t.push({ t: 'num', v: s.slice(i, j) }); i = j; continue; }
      if (/[A-Za-z]/.test(c)) { t.push({ t: 'let', v: c }); i++; continue; }
      t.push({ t: 'ch', v: c }); i++;
    }
    return t;
  }

  const GREEK = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'varrho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'];
  const FUNCS = {
    sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
    arcsin: 'asin', arccos: 'acos', arctan: 'atan', arccot: 'acot', arcsec: 'asec', arccsc: 'acsc',
    sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', coth: 'coth', sech: 'sech', csch: 'csch',
    arsinh: 'asinh', arcosh: 'acosh', artanh: 'atanh', arcsinh: 'asinh', arccosh: 'acosh', arctanh: 'atanh',
    ln: 'ln', log: 'log10', lg: 'log10', exp: 'exp', det: 'det', gcd: 'gcd', max: 'max', min: 'min', deg: 'deg',
    Re: 're', Im: 'im', arg: 'arg', sgn: 'sign', dim: 'dim', ker: 'ker',
  };
  const INV = { sin: 'asin', cos: 'acos', tan: 'atan', cot: 'acot', sec: 'asec', csc: 'acsc', sinh: 'asinh', cosh: 'acosh', tanh: 'atanh' };
  // TI-89 / Nspire names that differ in Giac
  const ALIASES = {
    d: 'diff', deSolve: 'desolve', nInt: 'nInt', nDeriv: 'nDeriv', approx: 'evalf', exact: 'exact', expr: 'expr',
    abs: 'abs', sqrt: 'sqrt', root: 'surd', log: 'log10', ln: 'ln', mod: 'tiMod', remain: 'irem', intDiv: 'iquo',
    'P▸Rx': 'tiPRx', 'P▸Ry': 'tiPRy', 'R▸Pr': 'tiRPr', 'R▸Pθ': 'tiRPq', 'R▸Pq': 'tiRPq', tmpCnv: 'tiTmpCnv',
    'list▸mat': 'list2mat', 'mat▸list': 'flatten', 'exp▸list': 'tiExp2List', isPrime: 'isprime', iPart: 'trunc',
    fPart: 'frac', int: 'floor', DelVar: 'purge', getNum: 'numer', getDenom: 'denom', conj: 'conj', real: 're', imag: 'im',
    nCr: 'comb', nPr: 'perm', cZeros: 'cZeros', tExpand: 'texpand', tCollect: 'tcollect', comDenom: 'comDenom',
    variance: 'varSamp', stdDev: 'stdDevSamp', stDevSamp: 'stdDevSamp', stDevPop: 'stDevPop', rowAdd: 'rowAdd',
    mRow: 'mRow', mRowAdd: 'mRowAdd', rowSwap: 'rowSwap', rref: 'rref', ref: 'ref', colDim: 'coldim', rowDim: 'rowdim',
    identity: 'idn', unitV: 'unitV', crossP: 'crossP', dotP: 'dotP', eigVl: 'eigVl', eigVc: 'eigVc', simult: 'simult',
    normPdf: 'normalPdf', normCdf: 'normalCdf', invNorm: 'invNorm', binomPdf: 'binomPdf', binomCdf: 'binomCdf',
    poissPdf: 'poissonPdf', poissCdf: 'poissonCdf', tPdf: 'tPdf', tCdf: 'tCdf', invt: 'invt', chi2Pdf: 'chi2Pdf', chi2Cdf: 'chi2Cdf',
    fPdf: 'fPdf', fCdf: 'fCdf', geomPdf: 'geomPdf', geomCdf: 'geomCdf', randInt: 'randInt', randNorm: 'randNorm',
    impDif: 'impDif', arcLen: 'arcLen', tangentLine: 'tangentLine', normalLine: 'normalLine', fMin: 'fMin', fMax: 'fMax',
    polyRoots: 'tiPolyRoots', npv: 'tiNPV', irr: 'tiIRR', rectangular: 'evalc', polar: 'tiPolar', RandSeed: 'srand', cPolyRoots: 'tiCPolyRoots', polyEval: 'polyEval', polyDegree: 'degree', polyCoeffs: 'coeffs', polyQuotient: 'quo',
    polyRemainder: 'rem', polyGcd: 'gcd', completeSquare: 'canonical_form', expand: 'expand', factor: 'factor',
    rationalize: 'ratnormal', numerator: 'numer', denominator: 'denom', mean: 'mean', median: 'median', sum: 'sum',
    cumulativeSum: 'cumSum', cumSum: 'cumSum', product: 'product', sortA: 'sort', SortA: 'sort', SortD: 'tiSortD', sortD: 'tiSortD',
    augment: 'augment', left: 'left', right: 'right', mid: 'mid', dim: 'dim', seq: 'seq', countIf: 'tiCountIf',
    taylor: 'taylor', series: 'series', limit: 'limit', solve: 'solve', cSolve: 'cSolve', nSolve: 'nSolve', zeros: 'zeros',
    integral: 'integrate', derivative: 'diff', factorial: 'factorial', round: 'round', floor: 'floor', ceiling: 'ceil',
    gcd: 'gcd', lcm: 'lcm', sign: 'sign', max: 'max', min: 'min', string: 'string', char: 'char', ord: 'ord', when: 'piecewise', taylor: 'taylor',
  };

  // ---------------------------------------------------------------- parser
  class P {
    constructor(toks, ctx) { this.t = toks; this.i = 0; this.ctx = ctx || {}; }
    peek(o = 0) { return this.t[this.i + o]; }
    next() { return this.t[this.i++]; }
    isCmd(tok, ...names) { return tok && tok.t === 'cmd' && names.includes(tok.v); }
    isCh(tok, ...chs) { return tok && tok.t === 'ch' && chs.includes(tok.v); }
    eat(pred) { const k = this.peek(); if (k && pred(k)) { this.i++; return k; } return null; }
    skipSpace() { while (this.isCmd(this.peek(), ',', ';', '!', ':', ' ', 'quad', 'qquad', 'displaystyle', 'textstyle', 'limits', 'nolimits')) this.i++; }

    // a {...} argument or a single token
    arg() {
      this.skipSpace();
      const k = this.peek();
      if (!k) throw new TexError('Something is missing at the end');
      if (this.isCh(k, '{')) { this.i++; const s = this.seq(() => this.isCh(this.peek(), '}')); this.expectCh('}'); return s; }
      if (k.t === 'num') { this.i++; return [{ k: 'num', v: k.v[0] }].concat(k.v.length > 1 ? (this.t.splice(this.i, 0, { t: 'num', v: k.v.slice(1) }), []) : []); }
      return [this.atom()];
    }
    expectCh(c) { const k = this.next(); if (!k || !(k.t === 'ch' && k.v === c)) throw new TexError('Unbalanced ' + c); }
    expectCmd(c) { const k = this.next(); if (!k || !(k.t === 'cmd' && k.v === c)) throw new TexError('Expected \\' + c); }

    // sequence of nodes until stop()
    seq(stop) {
      const out = [];
      for (;;) {
        this.skipSpace();
        const k = this.peek();
        if (!k || (stop && stop())) break;
        if (this.isCh(k, '}')) break;
        const n = this.atom();
        if (n) out.push(n);
      }
      return out;
    }

    // postfix: ^ _ ' !
    postfix(n) {
      for (;;) {
        this.skipSpace();
        const k = this.peek();
        if (this.isCh(k, '^')) { this.i++; const e = this.arg(); n = { k: 'pow', b: n, e }; continue; }
        if (this.isCh(k, '_')) { this.i++; const s = this.arg(); n = { k: 'sub', b: n, s }; continue; }
        if (this.isCh(k, "'")) { this.i++; n = { k: 'prime', b: n }; continue; }
        if (this.isCmd(k, 'prime')) { this.i++; n = { k: 'prime', b: n }; continue; }
        if (this.isCh(k, '!')) { this.i++; n = { k: 'fact', b: n }; continue; }
        if (this.isCmd(k, 'degree')) { this.i++; n = { k: 'deg', b: n }; continue; }
        if (this.isCh(k, '°')) { this.i++; n = { k: 'deg', b: n }; continue; }
        return n;
      }
    }

    atom(noPost) {
      this.skipSpace();
      const k = this.next();
      if (!k) return null;
      let n;
      if (k.t === 'num') n = { k: 'num', v: k.v };
      else if (k.t === 'let') {
        let name = k.v;
        while (this.peek() && (this.peek().t === 'let' || (this.peek().t === 'num' && /^\d+$/.test(this.peek().v)))) name += this.next().v;
        n = { k: 'id', v: name };
      } else if (k.t === 'ch') {
        const c = k.v;
        if (c === '(') { const s = this.seq(() => this.isCh(this.peek(), ')')); this.expectCh(')'); n = { k: 'grp', o: '(', s }; }
        else if (c === '[') { const s = this.seq(() => this.isCh(this.peek(), ']')); this.expectCh(']'); n = { k: 'grp', o: '[', s }; }
        else if (c === '{') { const s = this.seq(() => this.isCh(this.peek(), '}')); this.expectCh('}'); n = { k: 'grp', o: '', s }; }
        else if ('+-*/=<>,;|&:'.includes(c)) {
          if (c === ':' && this.isCh(this.peek(), '=')) { this.i++; return { k: 'op', v: ':=' }; }
          if (c === '<' && this.isCh(this.peek(), '=')) { this.i++; return { k: 'op', v: '<=' }; }
          if (c === '>' && this.isCh(this.peek(), '=')) { this.i++; return { k: 'op', v: '>=' }; }
          if (c === '-' && this.isCh(this.peek(), '>')) { this.i++; return { k: 'op', v: '=>' }; }
          return { k: 'op', v: c === '|' ? '|' : c };
        }
        else if (c === '%') return { k: 'op', v: '%' };
        else if (c === '"') { let s = ''; while (this.peek() && !this.isCh(this.peek(), '"')) { const q = this.next(); s += q.t === 'cmd' ? '' : q.v; } this.next(); n = { k: 'raw', v: JSON.stringify(s) }; }
        else if (c === '!') return { k: 'op', v: '!' };
        else if (c === '?') return null;
        else if (c === '·' || c === '×') return { k: 'op', v: '*' };
        else if (c === '÷') return { k: 'op', v: '/' };
        else if (c === '−') return { k: 'op', v: '-' };
        else if (c === '≤') return { k: 'op', v: '<=' };
        else if (c === '≥') return { k: 'op', v: '>=' };
        else if (c === '≠') return { k: 'op', v: '!=' };
        else if (c === '→') return { k: 'op', v: '=>' };
        else if (c === 'π') n = { k: 'id', v: 'pi' };
        else if (c === '∞') n = { k: 'id', v: 'infinity' };
        else if (c === '°') return { k: 'op', v: '°' };
        else n = { k: 'raw', v: c };
      } else n = this.command(k.v);
      if (!n) return null;
      if (n.k === 'op') return n;
      return noPost ? n : this.postfix(n);
    }

    command(c) {
      switch (c) {
        case 'placeholder': this.arg(); return { k: 'hole' };
        case '_': return { k: 'raw', v: this.unitTail('_') };                                   // \_km → _km
        case 'frac': case 'dfrac': case 'tfrac': case 'cfrac': {
          const a = this.arg(), b = this.arg();
          const d = this.derivFrac(a, b);
          if (d) return d;
          return { k: 'frac', a, b };
        }
        case 'sqrt': {
          let idx = null;
          if (this.isCh(this.peek(), '[')) { this.i++; idx = this.seq(() => this.isCh(this.peek(), ']')); this.expectCh(']'); }
          return { k: 'sqrt', x: this.arg(), idx };
        }
        case 'left': return this.leftRight();
        case 'right': throw new TexError('Unbalanced brackets');
        case 'lbrace': case '{': { const s = this.seq(() => this.isCmd(this.peek(), 'rbrace', '}')); this.next(); return { k: 'grp', o: '{', s }; }
        case 'lbrack': { const s = this.seq(() => this.isCmd(this.peek(), 'rbrack')); this.next(); return { k: 'grp', o: '[', s }; }
        case 'vert': case 'mid': case '|': return { k: 'op', v: '|' };
        case 'lvert': { const s = this.seq(() => this.isCmd(this.peek(), 'rvert')); this.next(); return { k: 'abs', s }; }
        case 'lfloor': { const s = this.seq(() => this.isCmd(this.peek(), 'rfloor')); this.next(); return { k: 'call', f: 'floor', args: [s] }; }
        case 'lceil': { const s = this.seq(() => this.isCmd(this.peek(), 'rceil')); this.next(); return { k: 'call', f: 'ceil', args: [s] }; }
        case 'cdot': case 'times': case 'ast': return { k: 'op', v: '*' };
        case 'div': return { k: 'op', v: '/' };
        case 'pm': return { k: 'op', v: '+' };
        case 'le': case 'leq': case 'leqslant': return { k: 'op', v: '<=' };
        case 'ge': case 'geq': case 'geqslant': return { k: 'op', v: '>=' };
        case 'ne': case 'neq': return { k: 'op', v: '!=' };
        case 'lt': return { k: 'op', v: '<' };
        case 'gt': return { k: 'op', v: '>' };
        case 'coloneq': case 'coloneqq': case 'eqqcolon': return { k: 'op', v: ':=' };
        case 'to': case 'rightarrow': case 'longrightarrow': return { k: 'op', v: '=>' };
        case 'Rightarrow': case 'implies': return { k: 'op', v: ' implies ' };
        case 'Leftrightarrow': case 'iff': return { k: 'op', v: ' iff ' };
        case 'land': case 'wedge': return { k: 'op', v: ' and ' };
        case 'lor': case 'vee': return { k: 'op', v: ' or ' };
        case 'lnot': case 'neg': return { k: 'op', v: ' not ' };
        case 'oplus': return { k: 'op', v: ' xor ' };
        case 'approx': return { k: 'op', v: '=' };
        case '%': return { k: 'op', v: '%' };
        case 'pi': return { k: 'id', v: 'pi' };
        case 'infty': return { k: 'id', v: 'infinity' };
        case 'exponentialE': return { k: 'id', v: 'e' };
        case 'imaginaryI': case 'imath': return { k: 'id', v: 'i' };
        case 'degree': case 'circ': return { k: 'op', v: '°' };
        case 'partial': return { k: 'id', v: 'd' };
        case 'ell': return { k: 'id', v: 'l' };
        case 'hbar': return { k: 'id', v: 'hbar' };
        case 'text': case 'textrm': case 'mathrm': case 'operatorname': case 'mathit': case 'mathbf': case 'textit': case 'textbf': case 'mbox': {
          const s = this.rawArg();
          if (/^\s*_/.test(s)) return { k: 'raw', v: this.unitTail(s.replace(/\s+/g, '')) };   // unit like _m
          if (s === 'd') return { k: 'dmark' };
          if (/^[A-Za-zΑ-ω_][\w▸θ]*$/.test(s)) return { k: 'id', v: s, fn: c === 'operatorname' };
          return { k: 'raw', v: s };
        }
        case 'int': case 'intop': case 'smallint': return this.integral();
        case 'sum': case 'prod': return this.bigop(c);
        case 'lim': return this.limit();
        case 'begin': return this.environment();
        case 'overline': case 'bar': return { k: 'id', v: 'mean_' + this.rawArg() };
        case 'vec': { const a = this.arg(); return { k: 'grp', o: '(', s: a }; }
        case 'unicode': return { k: 'raw', v: this.rawArg() };
        case '{': return { k: 'grp', o: '{', s: [] };
        case '}': case 'rbrace': throw new TexError('Unbalanced braces');
        case ' ': case ',': case ';': case '!': case ':': case 'quad': case 'qquad': return null;
        case '\\': return { k: 'op', v: '\\\\' };
        default:
          if (GREEK.includes(c)) return { k: 'id', v: c.replace(/^var/, '') };
          if (FUNCS[c]) return this.func(c);
          return { k: 'id', v: c };
      }
    }

    /** a unit name after "_": letters typed after it, plain or in \mathrm{…} (MathLive splits them) */
    unitTail(s) {
      for (;;) {
        const k = this.peek(); if (!k) break;
        if (k.t === 'let' || (k.t === 'ch' && /[µΩÅ°]/.test(k.v))) { s += k.v; this.i++; continue; }
        if (k.t === 'cmd' && k.v === 'mu') { s += 'µ'; this.i++; continue; }
        if (k.t === 'cmd' && /^(mathrm|text|textrm|mathit)$/.test(k.v)) {
          const save = this.i; this.i++; const a = this.rawArg();
          if (/^[A-Za-zµΩÅ°]+$/.test(a)) { s += a; continue; }
          this.i = save;
        }
        break;
      }
      return s;
    }

    rawArg() {
      this.skipSpace();
      if (!this.isCh(this.peek(), '{')) { const k = this.next(); return k ? k.v : ''; }
      this.i++;
      let depth = 1, s = '';
      while (this.peek()) {
        const k = this.next();
        if (k.t === 'ch' && k.v === '{') depth++;
        if (k.t === 'ch' && k.v === '}') { if (--depth === 0) break; }
        s += k.t === 'cmd' ? (k.v === '_' ? '_' : k.v.length === 1 ? k.v : '\\' + k.v) : k.v;
      }
      return s;
    }

    // \sin x, \sin^{-1}(x), \sin^2 x, \log_{b}(x)
    func(c) {
      let name = FUNCS[c], pow = null, base = null;
      for (;;) {
        this.skipSpace();
        if (this.isCh(this.peek(), '^')) { this.i++; const e = this.arg(); const es = emitSeq(e, this.ctx); if (es === '-1' && INV[c]) name = INV[c]; else pow = es; continue; }
        if (this.isCh(this.peek(), '_')) { this.i++; base = this.arg(); continue; }
        break;
      }
      this.skipSpace();
      let argNode;
      const k = this.peek();
      // \sin(x)^2 is (sin x)², so a bracketed argument stops at its bracket and the power goes on the call
      if (this.isCmd(k, 'left') || this.isCh(k, '(')) argNode = this.atom(true);
      else argNode = this.atom();     // \sin x
      if (!argNode) throw new TexError('Missing argument for ' + c);
      const args = argNode.k === 'grp' && argNode.o === '(' ? splitCommas(argNode.s) : [[argNode]];
      let n;
      if (c === 'log' && base) n = { k: 'call', f: 'logb', args: [args[0], base] };
      else n = { k: 'call', f: name, args };
      if (pow) n = { k: 'pow', b: n, e: [{ k: 'raw', v: pow }] };
      return n;
    }

    leftRight() {
      const o = this.next();
      let open = o.t === 'cmd' ? o.v : o.v;
      const closeMap = { '(': ')', '[': ']', lbrack: 'rbrack', lbrace: 'rbrace', '{': '}', '|': '|', vert: 'vert', lvert: 'rvert', lfloor: 'rfloor', lceil: 'rceil', langle: 'rangle', '.': null };
      const s = this.seq(() => this.isCmd(this.peek(), 'right'));
      this.expectCmd('right');
      this.next();   // closing delimiter
      if (open === '(') return { k: 'grp', o: '(', s };
      if (open === '[' || open === 'lbrack') return { k: 'grp', o: '[', s };
      if (open === 'lbrace' || open === '{') return { k: 'grp', o: '{', s };
      if (open === '|' || open === 'vert' || open === 'lvert') return { k: 'abs', s };
      if (open === 'lfloor') return { k: 'call', f: 'floor', args: [s] };
      if (open === 'lceil') return { k: 'call', f: 'ceil', args: [s] };
      return { k: 'grp', o: '(', s };
    }

    // d/dx detection for \frac{d}{dx}, \frac{d^2}{dx^2}, \frac{\partial}{\partial x}
    derivFrac(a, b) {
      const isD = (n) => n && ((n.k === 'id' && n.v === 'd') || n.k === 'dmark');
      let order = '1';
      if (!(a.length === 1 && (isD(a[0]) || (a[0].k === 'pow' && isD(a[0].b))))) {
        // \frac{d y}{d x} (Leibniz with dependent var) or \frac{df}{dx}
        if (!(a.length >= 1 && (isD(a[0]) || (a[0].k === 'id' && /^d[a-z]$/.test(a[0].v))) && b.length >= 1)) return null;
        if (a.length === 1 && a[0].k === 'id' && a[0].v === 'd') return null;
      }
      if (a[0].k === 'pow') order = emitSeq(a[0].e, this.ctx);
      // denominator: d x  |  d x^2  |  dx (merged id "dx")
      let v = null;
      if (b.length === 2 && isD(b[0])) v = b[1];
      else if (b.length === 1 && b[0].k === 'id' && /^d[A-Za-z]\w*$/.test(b[0].v)) v = { k: 'id', v: b[0].v.slice(1) };
      else if (b.length === 1 && b[0].k === 'pow' && b[0].b.k === 'id' && /^d[A-Za-z]$/.test(b[0].b.v)) v = { k: 'pow', b: { k: 'id', v: b[0].b.v.slice(1) }, e: b[0].e };
      else if (b.length === 2 && b[0].k === 'id' && b[0].v === 'd') v = b[1];
      if (!v) return null;
      if (v.k === 'pow') { order = emitSeq(v.e, this.ctx); v = v.b; }
      if (v.k !== 'id') return null;
      // body: rest after d (\frac{d y}{dx}) or the following atom
      let body = null;
      if (a.length > 1) body = a.slice(1);
      return { k: 'deriv', v: v.v, order, body };
    }

    integral() {
      let lo = null, hi = null;
      for (;;) {
        this.skipSpace();
        if (this.isCh(this.peek(), '_')) { this.i++; lo = this.arg(); continue; }
        if (this.isCh(this.peek(), '^')) { this.i++; hi = this.arg(); continue; }
        break;
      }
      // body runs until the differential d<var>
      const body = [];
      let v = null;
      for (;;) {
        this.skipSpace();
        const k = this.peek();
        if (!k || this.isCh(k, '}') || this.isCmd(k, 'right')) break;
        if (this.isCmd(k, 'mathrm', 'operatorname', 'text') && this.t[this.i + 1] && this.isCh(this.t[this.i + 1], '{') && this.t[this.i + 2] && this.t[this.i + 2].v === 'd' && this.isCh(this.t[this.i + 3], '}')) {
          this.i += 4; const vn = this.atom(); v = vn; break;
        }
        if (this.isCmd(k, 'differentialD')) { this.i++; v = this.atom(); break; }
        if (k.t === 'let' && k.v === 'd' && this.t[this.i + 1] && this.t[this.i + 1].t === 'let' && !this.t[this.i + 2] ) { this.i++; v = this.atom(); break; }
        if (k.t === 'let' && k.v === 'd' && this.t[this.i + 1] && this.t[this.i + 1].t === 'let' && body.length && (this.t[this.i + 2] == null || this.t[this.i + 2].t !== 'let')) { this.i++; v = this.atom(); break; }
        const n = this.atom(); if (n) body.push(n);
      }
      if (!v) v = { k: 'id', v: 'x' };
      if (v.k === 'hole') throw new TexError('Fill in the integration variable');
      return { k: 'int', lo, hi, body, v: emitNode(v, this.ctx) };
    }

    bigop(c) {
      let lo = null, hi = null;
      for (;;) {
        this.skipSpace();
        if (this.isCh(this.peek(), '_')) { this.i++; lo = this.arg(); continue; }
        if (this.isCh(this.peek(), '^')) { this.i++; hi = this.arg(); continue; }
        break;
      }
      const body = this.term();
      return { k: c, lo, hi, body };
    }

    limit() {
      let sub = null;
      this.skipSpace();
      if (this.isCh(this.peek(), '_')) { this.i++; sub = this.arg(); }
      const body = this.term();
      return { k: 'lim', sub, body };
    }

    // a multiplicative term: atoms until + - = , or a closing token
    term() {
      const out = [];
      for (;;) {
        this.skipSpace();
        const k = this.peek();
        if (!k || this.isCh(k, '}', ')', ']') || this.isCmd(k, 'right', 'end', '\\')) break;
        if (this.isCh(k, '+', '-', '=', ',', '<', '>', ';', '&') || this.isCmd(k, 'le', 'ge', 'ne', 'to', 'pm', 'leq', 'geq', 'neq')) { if (out.length) break; }
        const n = this.atom(); if (n) out.push(n);
      }
      return out;
    }

    environment() {
      const name = this.rawArg();
      const rows = [[[]]];
      for (;;) {
        this.skipSpace();
        const k = this.peek();
        if (!k) throw new TexError('Unclosed ' + name);
        if (this.isCmd(k, 'end')) { this.i++; this.rawArg(); break; }
        if (this.isCh(k, '&')) { this.i++; rows[rows.length - 1].push([]); continue; }
        if (this.isCmd(k, '\\', 'cr')) { this.i++; rows.push([[]]); continue; }
        const n = this.atom(); if (n) { const r = rows[rows.length - 1]; r[r.length - 1].push(n); }
      }
      // drop a trailing empty row
      if (rows.length > 1 && rows[rows.length - 1].every((c) => !c.length)) rows.pop();
      if (name === 'cases' || name === 'dcases') return { k: 'cases', rows };
      const m = { k: 'mat', rows };
      if (name === 'vmatrix') return { k: 'call', f: 'det', args: [[m]] };
      return m;
    }
  }

  function splitCommas(seq) {
    const out = [[]];
    for (const n of seq) { if (n.k === 'op' && n.v === ',') out.push([]); else out[out.length - 1].push(n); }
    return out;
  }

  // ---------------------------------------------------------------- emitter
  const VALUE_END = new Set(['num', 'id', 'grp', 'frac', 'sqrt', 'pow', 'sub', 'call', 'fact', 'prime', 'mat', 'abs', 'raw', 'deriv', 'deg', 'int', 'sum', 'prod', 'lim', 'cases']);
  const VALUE_START = new Set(['num', 'id', 'grp', 'frac', 'sqrt', 'pow', 'sub', 'call', 'mat', 'abs', 'raw', 'deriv', 'int', 'sum', 'prod', 'lim', 'cases', 'fact', 'prime', 'deg']);

  function isFuncName(name, ctx) {
    if (ctx.userFuncs && ctx.userFuncs.has(name)) return true;
    if (name.length > 1) return true;
    return /^[fgh]$/.test(name) && !(ctx.vars && ctx.vars.has(name));
  }
  function mapName(v) {
    if (Object.prototype.hasOwnProperty.call(ALIASES, v)) return ALIASES[v];
    return v;
  }

  function emitSeq(seq, ctx) {
    let out = '';
    let prev = null;
    for (let i = 0; i < seq.length; i++) {
      let n = seq[i];
      if (n.k === 'hole') throw new TexError('Fill in the empty box first');
      // function call: name followed by ( … )
      if (n.k === 'id' && n.v === 'd' && seq[i + 1] && seq[i + 1].k === 'grp' && seq[i + 1].o === '(' && seq[i + 1].s.some((x) => x.k === 'op' && x.v === ',')) {
        n = { k: 'call', f: 'diff', args: splitCommas(seq[i + 1].s), user: true }; i++;
      } else if (n.k === 'id' && seq[i + 1] && seq[i + 1].k === 'grp' && seq[i + 1].o === '(' && (n.fn || isFuncName(n.v, ctx))) {
        const g = seq[i + 1];
        let call = { k: 'call', f: mapName(n.v), args: splitCommas(g.s), user: true };
        i++;
        // allow trailing postfix on the call: f(x)^2 already parsed onto grp; carry over
        n = call;
      } else if (n.k === 'pow' && n.b.k === 'id' && seq[i + 1] && seq[i + 1].k === 'grp' && seq[i + 1].o === '(' && n.b.v.length > 1 && !(ctx.vars && ctx.vars.has(n.b.v))) {
        // name^2(x) → (name(x))^2
        const g = seq[i + 1]; i++;
        n = { k: 'pow', b: { k: 'call', f: mapName(n.b.v), args: splitCommas(g.s) }, e: n.e };
      }
      // derivative operator applies to the next value
      if (n.k === 'deriv' && !n.body) {
        const nx = seq[i + 1];
        if (!nx || nx.k === 'op') throw new TexError('Put an expression after d/d' + n.v);
        i++;
        let body = [nx];
        if (nx.k === 'id' && seq[i + 1] && seq[i + 1].k === 'grp' && seq[i + 1].o === '(') { body.push(seq[i + 1]); i++; }
        n = { ...n, body };
      }
      if (n.k === 'op') {
        out += emitOp(n.v, ctx, prev);
        prev = n;
        continue;
      }
      if (prev && VALUE_END.has(prev.k) && VALUE_START.has(n.k)) out += '*';
      out += emitNode(n, ctx);
      prev = n;
    }
    return out;
  }

  function emitOp(v, ctx, prev) {
    if (v === '%') return '/100';
    if (v === '°') return ctx.degrees ? '' : '*pi/180';
    if (v === '!') return '!';
    if (v === '\\\\') return ',';
    return v;
  }

  const wrap = (s) => (/^[\w.]+$/.test(s) ? s : '(' + s + ')');

  function emitNode(n, ctx) {
    switch (n.k) {
      case 'num': return n.v.startsWith('.') ? '0' + n.v : n.v;
      case 'id': {
        if (n.v === 'e') return 'e';
        if (n.v === 'i') return '(sqrt(-1))';
        if (n.v === 'ans') { if (!ctx.ans) throw new TexError('There is no previous answer yet'); return '(' + ctx.ans + ')'; }
        if (/^mean_/.test(n.v)) return 'mean(' + n.v.slice(5) + ')';
        return mapName(n.v) === n.v ? n.v : n.v;   // plain variables are never renamed
      }
      case 'raw': return n.v;
      case 'grp': {
        const inner = emitSeq(n.s, ctx);
        if (n.o === '{') return '{' + inner + '}';
        if (n.o === '[') return '[' + inner + ']';
        return '(' + inner + ')';
      }
      case 'abs': return 'abs(' + emitSeq(n.s, ctx) + ')';
      case 'frac': return '(' + emitSeq(n.a, ctx) + ')/(' + emitSeq(n.b, ctx) + ')';
      case 'sqrt': {
        const x = emitSeq(n.x, ctx);
        if (n.idx && n.idx.length) return 'surd(' + x + ',' + emitSeq(n.idx, ctx) + ')';
        return 'sqrt(' + x + ')';
      }
      case 'pow': {
        if (n.b.k === 'id' && n.b.v === 'e') return 'exp(' + emitSeq(n.e, ctx) + ')';
        const b = emitNode(n.b, ctx);
        const e = emitSeq(n.e, ctx);
        if (e === '\\prime' || e === "'" || e === 'prime') return b + "'";
        if (e === "prime'" || e === 'primeprime' || e === "''") return b + "''";
        if (e === 'T' && n.b.k !== 'num') return 'transpose(' + b + ')';
        return wrap(b) + '^' + wrap(e);
      }
      case 'sub': {
        const b = emitNode(n.b, ctx), s = emitSeq(n.s, ctx);
        if (n.b.k === 'id' && /^[\w]+$/.test(s)) return b + '_' + s;     // x_1 → x_1 (a single name)
        return b + '[' + s + ']';
      }
      case 'prime': return emitNode(n.b, ctx) + "'";
      case 'fact': return wrap(emitNode(n.b, ctx)) + '!';
      case 'deg': return ctx.degrees ? emitNode(n.b, ctx) : '(' + emitNode(n.b, ctx) + '*pi/180)';
      case 'call': {
        const f = n.user ? n.f : mapName(n.f);
        const A = n.args.map((a) => emitSeq(a, ctx)).filter((a, i, arr) => !(arr.length === 1 && a === ''));
        const sp = special(f, A);
        if (sp) return sp;
        return f + '(' + A.join(',') + ')';
      }
      case 'mat': {
        const rows = n.rows.map((r) => '[' + r.map((c) => { if (!c.length) throw new TexError('Fill in every matrix entry'); return emitSeq(c, ctx); }).join(',') + ']');
        return '[' + rows.join(',') + ']';
      }
      case 'cases': {
        // a brace of equations with no conditions is a system: {eq1, eq2}
        if (n.rows.every((r) => r.length === 1 || r.slice(1).every((c) => !c.length))) return '{' + n.rows.map((r) => emitSeq(r[0], ctx)).join(',') + '}';
        const parts = [];
        for (const r of n.rows) {
          const val = emitSeq(r[0] || [], ctx);
          const condSeq = (r[1] || []).filter((x) => !(x.k === 'id' && /^(if|otherwise|else)$/.test(x.v)));
          const cond = condSeq.length ? emitSeq(condSeq, ctx) : '';
          if (cond) parts.push(cond, val); else parts.push(val);
        }
        return 'piecewise(' + parts.join(',') + ')';
      }
      case 'deriv': {
        const body = emitSeq(n.body, ctx);
        return 'diff(' + body + ',' + n.v + (n.order !== '1' ? ',' + n.order : '') + ')';
      }
      case 'int': {
        const body = emitSeq(n.body, ctx);
        if (!body) throw new TexError('Fill in what to integrate');
        if (n.lo && n.hi) return 'integrate(' + body + ',' + n.v + ',' + emitSeq(n.lo, ctx) + ',' + emitSeq(n.hi, ctx) + ')';
        return 'integrate(' + body + ',' + n.v + ')';
      }
      case 'sum': case 'prod': {
        const fn = n.k === 'sum' ? 'sum' : 'product';
        const body = emitSeq(n.body, ctx);
        if (!n.lo) return fn + '(' + body + ')';
        const lo = n.lo; const eq = lo.findIndex((x) => x.k === 'op' && x.v === '=');
        if (eq < 1) throw new TexError('Write the index like n=1 under the Σ');
        const v = emitSeq(lo.slice(0, eq), ctx), a = emitSeq(lo.slice(eq + 1), ctx), b = n.hi ? emitSeq(n.hi, ctx) : 'infinity';
        return fn + '(' + body + ',' + v + ',' + a + ',' + b + ')';
      }
      case 'lim': {
        const body = emitSeq(n.body, ctx);
        if (!n.sub) return 'limit(' + body + ')';
        const ix = n.sub.findIndex((x) => x.k === 'op' && x.v === '=>');
        if (ix < 1) throw new TexError('Write the limit like x→0');
        const v = emitSeq(n.sub.slice(0, ix), ctx);
        let rest = n.sub.slice(ix + 1), dir = '';
        const last = rest[rest.length - 1];
        if (last && last.k === 'pow') {
          const e = emitSeq(last.e, ctx);
          if (e === '+' || e === '-') { dir = e === '+' ? ',1' : ',-1'; rest = rest.slice(0, -1).concat([last.b]); }
        }
        return 'limit(' + body + ',' + v + ',' + emitSeq(rest, ctx) + dir + ')';
      }
      case 'dmark': return 'd';
      default: throw new TexError('Can’t read ' + n.k);
    }
  }

  // Nspire functions whose Giac equivalents take arguments in another order or need defaults
  function special(f, A) {
    const n = A.length, E = (s) => 'evalf(' + s + ')';
    switch (f) {
      case 'normPdf': case 'normalPdf': return E('normald(' + (n >= 3 ? A[1] + ',' + A[2] : '0,1') + ',' + A[0] + ')');
      case 'normCdf': case 'normalCdf': return E('normal_cdf(' + (n >= 4 ? A[2] + ',' + A[3] : '0,1') + ',' + A[0] + ',' + A[1] + ')');
      case 'invNorm': return E('normal_icdf(' + (n >= 3 ? A[1] + ',' + A[2] : '0,1') + ',' + A[0] + ')');
      case 'tPdf': return E('studentd(' + A[1] + ',' + A[0] + ')');
      case 'tCdf': return E('student_cdf(' + A[2] + ',' + A[0] + ',' + A[1] + ')');
      case 'invt': return E('student_icdf(' + A[1] + ',' + A[0] + ')');
      case 'chi2Pdf': return E('chisquare(' + A[1] + ',' + A[0] + ')');
      case 'chi2Cdf': return E('chisquare_cdf(' + A[2] + ',' + A[0] + ',' + A[1] + ')');
      case 'invChi2': return E('chisquare_icdf(' + A[1] + ',' + A[0] + ')');
      case 'fPdf': case 'FPdf': return E('fisher(' + A[1] + ',' + A[2] + ',' + A[0] + ')');
      case 'fCdf': case 'FCdf': return E('fisher_cdf(' + A[2] + ',' + A[3] + ',' + A[0] + ',' + A[1] + ')');
      case 'invF': return E('fisher_icdf(' + A[1] + ',' + A[2] + ',' + A[0] + ')');
      case 'binomPdf': return n >= 3 ? E('binomial(' + A[0] + ',' + A[2] + ',' + A[1] + ')') : E('seq(binomial(' + A[0] + ',k_,' + A[1] + '),k_,0,' + A[0] + ')');
      case 'binomCdf': return n >= 4 ? E('binomial_cdf(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + A[3] + ')') : n === 3 ? E('binomial_cdf(' + A[0] + ',' + A[1] + ',' + A[2] + ')') : null;
      case 'invBinom': return E('binomial_icdf(' + A[1] + ',' + A[2] + ',' + A[0] + ')');
      case 'poissPdf': case 'poissonPdf': return E('poisson(' + A[0] + ',' + A[1] + ')');
      case 'poissCdf': case 'poissonCdf': return n >= 3 ? E('poisson_cdf(' + A[0] + ',' + A[1] + ',' + A[2] + ')') : E('poisson_cdf(' + A[0] + ',' + A[1] + ')');
      case 'geomPdf': return E('geometric(' + A[0] + ',' + A[1] + ')');
      case 'geomCdf': return n >= 3 ? E('geometric_cdf(' + A[0] + ',' + A[1] + ',' + A[2] + ')') : E('geometric_cdf(' + A[0] + ',' + A[1] + ')');
      case 'taylor': return 'convert(series(' + A[0] + ',' + A[1] + '=' + (A[3] || '0') + ',' + (A[2] || '5') + '),polynom)';
      case 'randInt': return n >= 3 ? 'seq(' + A[0] + '+rand(' + A[1] + '-(' + A[0] + ')+1),k_,1,' + A[2] + ')' : '(' + A[0] + '+rand(' + A[1] + '-(' + A[0] + ')+1))';
      case 'randNorm': return n >= 3 ? 'seq(randnorm(' + A[0] + ',' + A[1] + '),k_,1,' + A[2] + ')' : 'randnorm(' + A[0] + ',' + A[1] + ')';
      case 'rand': return n === 0 ? 'evalf(rand(0,1))' : 'seq(evalf(rand(0,1)),k_,1,' + A[0] + ')';
      case 'eigVl': return '[eigenvals(' + A[0] + ')]';
      case 'stdDevSamp': case 'stDevSamp': case 'stdDev': return 'stddevp(' + A[0] + ')';
      case 'stDevPop': case 'stdDevPop': return 'stddev(' + A[0] + ')';
      case 'varSamp': return 'stddevp(' + A[0] + ')^2';
      case 'varPop': return 'variance(' + A[0] + ')';
      case 'nInt': return 'nInt(' + A.join(',') + ')';
      case 'piecewise': return 'piecewise(' + A.join(',') + ')';
      case 'randBin': return n >= 3 ? 'seq(randbinomial(' + A[0] + ',' + A[1] + '),k_,1,' + A[2] + ')' : 'randbinomial(' + A[0] + ',' + A[1] + ')';
    }
    return null;
  }

  /** TI-style EE: 6.02ᴇ23 or 1.5ᴇ−3 is one number, (6.02×10^23); a ᴇ with no digits before it is 10^n. */
  const EE = '(?:\\\\mathrm\\{ᴇ\\}|\\\\text\\{ᴇ\\}|ᴇ)';
  const EXP = '\\s*(?:\\\\left\\(\\s*)?\\{?([-−+]|\\\\minus\\s*)?\\}?\\s*(\\d+)(?:\\s*\\\\right\\))?';
  function eeToPow(tex) {
    if (!/ᴇ/.test(tex)) return tex;
    const sign = (sg) => (sg && sg.trim() !== '+' ? '-' : '');
    tex = tex.replace(new RegExp('(\\d+\\.?\\d*|\\.\\d+)\\s*' + EE + EXP, 'g'), (m, a, sg, e) => '\\left(' + a + '\\times10^{' + sign(sg) + e + '}\\right)');
    tex = tex.replace(new RegExp(EE + EXP, 'g'), (m, sg, e) => '10^{' + sign(sg) + e + '}');
    if (/ᴇ/.test(tex)) throw new TexError('EE needs an exponent after it, for example 6.02ᴇ23');
    return tex;
  }

  /** Translate LaTeX from the math editor to a Giac command string. */
  function tex2giac(tex, ctx = {}) {
    // MathLive re-serialises \operatorname{nCr} as \operatorname{\mathrm{nCr}}
    tex = String(tex).replace(/\\operatorname\{\\(?:mathrm|text|textrm)\{([^{}]*)\}\}/g, '\\operatorname{$1}');
    tex = eeToPow(tex);
    const p = new P(tokenize(tex), ctx);
    const seq = p.seq();
    if (p.i < p.t.length) throw new TexError('Unbalanced braces');
    let define = false;
    if (seq[0] && seq[0].k === 'id' && /^Define$/i.test(seq[0].v)) { define = true; seq.shift(); }
    let s = emitSeq(seq, ctx);
    if (define) s = s.replace(/(^|[^<>!:=])=(?!=)/, '$1:=');
    return s;
  }

  const api = { tex2giac, tokenize, TexError, ALIASES, eeToPow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tex2Giac = api;
})(typeof self !== 'undefined' ? self : this);
