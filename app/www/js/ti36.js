/*
 * ti36.js — a TI-36X Pro style scientific calculator page: MultiView-like display, the 36X Pro's
 * keypad and menus (math, prb, data/stat-reg/distr, table, num-solv, poly-solv, sys-solv, base n,
 * logic, complex, matrix, vector, convert, constants), computed with the app's Giac engine.
 * This is a recreation; it contains no TI code. Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, mathField, Sheet, haptic } = UI;

  /* the 20 constants of the TI-36X Pro (CODATA 2018 / SI values) */
  const K36 = [
    ['c', 'speed of light', 299792458, 'm/s'], ['g', 'acceleration of gravity', 9.80665, 'm/s²'], ['h', 'Planck constant', 6.62607015e-34, 'J·s'],
    ['N_A', 'Avogadro constant', 6.02214076e23, '1/mol'], ['R', 'ideal gas constant', 8.314462618, 'J/(mol·K)'], ['m_e', 'electron mass', 9.1093837015e-31, 'kg'],
    ['m_p', 'proton mass', 1.67262192369e-27, 'kg'], ['m_n', 'neutron mass', 1.67492749804e-27, 'kg'], ['m_\\mu', 'muon mass', 1.883531627e-28, 'kg'],
    ['G', 'gravitational constant', 6.6743e-11, 'm³/(kg·s²)'], ['F', 'Faraday constant', 96485.33212, 'C/mol'], ['a_0', 'Bohr radius', 5.29177210903e-11, 'm'],
    ['r_e', 'classical electron radius', 2.8179403262e-15, 'm'], ['k', 'Boltzmann constant', 1.380649e-23, 'J/K'], ['e', 'elementary charge', 1.602176634e-19, 'C'],
    ['u', 'atomic mass unit', 1.6605390666e-27, 'kg'], ['atm', 'standard atmosphere', 101325, 'Pa'], ['\\varepsilon_0', 'permittivity of vacuum', 8.8541878128e-12, 'F/m'],
    ['\\mu_0', 'permeability of vacuum', 1.25663706212e-6, 'N/A²'], ['C_c', 'Coulomb constant', 8.9875517923e9, 'N·m²/C²'],
  ];
  /* the 36X Pro's conversion groups */
  const CONV36 = [
    ['English–Metric', [['in', 'cm'], ['cm', 'in'], ['ft', 'm'], ['m', 'ft'], ['yd', 'm'], ['m', 'yd'], ['mi', 'km'], ['km', 'mi'], ['acre', 'm²'], ['m²', 'acre'], ['gal', 'L'], ['L', 'gal'], ['impgal', 'L'], ['L', 'impgal'], ['oz', 'g'], ['g', 'oz'], ['lb', 'kg'], ['kg', 'lb']]],
    ['Temperature', [['°F', '°C'], ['°C', '°F'], ['°C', 'K'], ['K', '°C']]],
    ['Speed and length', [['km/h', 'm/s'], ['m/s', 'km/h'], ['ly', 'm'], ['m', 'ly'], ['pc', 'm'], ['m', 'pc'], ['Å', 'm'], ['m', 'Å'], ['nmi', 'm'], ['m', 'nmi']]],
    ['Pressure', [['atm', 'Pa'], ['Pa', 'atm'], ['mmHg', 'Pa'], ['Pa', 'mmHg'], ['psi', 'kPa'], ['kPa', 'psi'], ['inHg', 'kPa'], ['kPa', 'inHg']]],
    ['Power and energy', [['hp', 'kW'], ['kW', 'hp'], ['cal', 'J'], ['J', 'cal'], ['BTU', 'J'], ['J', 'BTU'], ['eV', 'J'], ['J', 'eV'], ['kWh', 'MJ'], ['MJ', 'kWh']]],
  ];

  const op = (name, args = 1) => '\\operatorname{' + name + '}\\left(' + Array(args).fill('\\placeholder{}').join(',') + '\\right)';
  const VARS = ['x', 'y', 'z', 't', 'a', 'b', 'c', 'd'];
  /* keys that need a left operand: on an empty line they start from ans (like the real TI-36X Pro) */
  const AUTO_ANS = new Set(['add', 'sub', 'mul', 'div', 'pow', 'sq', 'sto']);

  class TI36Page {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'ti36'; this.fullscreen = true;
      this.S = Object.assign({ angle: 'deg', notation: 'norm', fix: -1, cplx: 'real', base: 'dec', answers: 'auto', frac: 'nd' }, state.mode || {});
      this.history = state.history || [];
      this.lists = state.lists || { L1: [], L2: [], L3: [] };
      this.fx = state.fx || 'x^2';
      this.store = state.store || {};       // x..d -> giac value
      this.opTex = state.opTex || ''; this.exprTex = state.exprTex || ''; this.off = false;
      this.mats = state.mats || {}; this.vecs = state.vecs || {};
      this.second = false; this.hyp = false; this.lastAns = state.lastAns || null; this.lastTap = null;
      this.build();
    }
    get target() { return this.mf; }
    serialize() { return { mode: this.S, history: this.history.slice(-40), lists: this.lists, fx: this.fx, store: this.store, mats: this.mats, vecs: this.vecs, lastAns: this.lastAns, opTex: this.opTex, exprTex: this.exprTex }; }
    focus() { this.mf.focus(); }

    /* ---------------------------------------------------------------- UI */
    build() {
      this.root = el('div', { class: 'page t36' });
      this.ind = el('div', { class: 't36-ind' });
      this.hist = el('div', { class: 't36-hist' });
      this.mf = mathField({ placeholder: '' });
      this.mf.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.enter(); } });
      UI.Edit.bind(this.mf, () => this.ansTex());
      this.menuBox = el('div', { class: 't36-menu', hidden: true });
      this.lcd = el('div', { class: 't36-lcd' }, this.ind, this.hist, el('div', { class: 't36-entry' }, this.mf), this.menuBox);
      this.pad = el('div', { class: 't36-pad' });
      this.root.append(el('div', { class: 't36-brand', html: '<b>CalcShelf</b> · TI-36X Pro style' }), this.lcd, this.pad);
      this.buildPad();
      this.renderHist(); this.renderInd();
    }
    renderInd() {
      const S = this.S;
      const parts = [this.second ? '2ND' : '', this.hyp ? 'HYP' : '', S.angle.toUpperCase(), S.notation === 'norm' ? '' : S.notation.toUpperCase(), S.fix >= 0 ? 'FIX' + S.fix : '', S.cplx === 'real' ? '' : S.cplx === 'rect' ? 'a+bi' : 'r∠θ', S.base === 'dec' ? '' : S.base.toUpperCase()];
      this.ind.innerHTML = parts.filter(Boolean).map((p) => '<span>' + p + '</span>').join('');
      this.root.classList.toggle('sec', this.second);
    }
    renderHist() {
      this.hist.innerHTML = '';
      for (const h of this.history.slice(-12)) {
        const i = el('div', { class: 't36-in' }); renderTex(i, h.in);
        const o = el('div', { class: 't36-out' + (h.err ? ' err' : '') }); if (h.err) o.textContent = h.err; else renderTex(o, h.tex);
        const row = el('div', { class: 't36-row' }, i, o);
        row.onclick = () => { if (!h.err && h.out) { this.mf.executeCommand(['insert', h.tex, { format: 'latex' }]); } };
        this.hist.append(row);
      }
      this.hist.scrollTop = this.hist.scrollHeight;
    }
    buildPad() {
      const P = this.pad; P.innerHTML = '';
      // K(id, face html, 2nd label html, primary fn, 2nd fn, colour class)
      const K = (id, f, s, fn, sfn, t) => ({ id, f, s, fn, sfn, t });
      const ins = (tex) => () => this.insert(tex);
      const tap = (id, list) => () => this.tap(id, list);
      const lp = '\\left(\\placeholder{}\\right)';
      const hexd = (h) => ins(h);
      const HC = '<svg class="hc" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 1.4a4.6 4.6 0 0 1 0 9.2z" fill="currentColor"/></svg>';
      const contrast = (d) => () => { this.S.contrast = Math.max(-4, Math.min(4, (this.S.contrast || 0) + d)); this.applyContrast(); this.app.saveSoon(); };
      // the layout of the TI-36X Pro (current keypad, with multi-tap keys), row by row
      const cluster = [
        [K('2nd', '2nd', '', () => this.toggle2nd(), null, 'k2nd'), K('mode', 'mode', 'quit', () => this.modeMenu(), () => this.quit(), 'lt'), K('del', 'delete', 'insert', () => this.mf.executeCommand('deleteBackward'), () => toast('Insert mode is always on'), 'lt')],
        [K('lnlog', 'ln log', '<i>d</i>/<i>dx</i>□', tap('lnlog', ['\\ln' + lp, '\\log' + lp]), ins('\\left.\\frac{d}{dx}\\left(\\placeholder{}\\right)\\right|_{x=\\placeholder{}}'), 'lt'),
          K('math', 'math', 'matrix', () => this.menu('math'), () => this.menu('matrix'), 'lt'),
          K('data', 'data', 'stat-reg/distr', () => this.dataEditor(), () => this.menu('stat'), 'lt')],
      ];
      const rows = [
        [K('exp', 'e<sup>□</sup> 10<sup>□</sup>', '∫<sub>□</sub><sup>□</sup>□<i>dx</i>', tap('exp', ['e^{\\placeholder{}}', '10^{\\placeholder{}}']), ins('\\int_{\\placeholder{}}^{\\placeholder{}}\\placeholder{}\\,dx'), 'lt'),
          K('ee', 'EE', 'vector', ins('\\times10^{\\placeholder{}}'), () => this.menu('vector'), 'lt'),
          K('fact', '! <span class="stk">nCr<br>nPr</span>', 'random', tap('fact', [() => { this.autoAns(); this.insert('!'); }, '\\operatorname{nCr}\\left(\\placeholder{},\\placeholder{}\\right)', '\\operatorname{nPr}\\left(\\placeholder{},\\placeholder{}\\right)']), () => this.menu('random'), 'md'),
          K('table', 'table', 'expr-eval', () => this.table(), () => this.exprEval(), 'bk'),
          K('clear', 'clear', '', () => this.clear(), null, 'bk')],
        [K('pi', 'π<span class="stk sm"><i>e</i><br><i>i</i></span>', 'complex', tap('pi', ['\\pi', '\\exponentialE', '\\imaginaryI']), () => this.menu('complex'), 'lt'),
          K('sin', '<span class="stk">sin<br>sin<sup>-1</sup></span>', 'num-solv', tap('sin', [() => this.trig('sin'), () => this.trig('sin', true)]), () => this.numSolv(), 'md'),
          K('cos', '<span class="stk">cos<br>cos<sup>-1</sup></span>', 'poly-solv', tap('cos', [() => this.trig('cos'), () => this.trig('cos', true)]), () => this.polySolv(), 'dk'),
          K('tan', '<span class="stk">tan<br>tan<sup>-1</sup></span>', 'sys-solv', tap('tan', [() => this.trig('tan'), () => this.trig('tan', true)]), () => this.sysSolv(), 'bk'),
          K('div', '÷', '%', () => { this.mf.focus(); this.mf.executeCommand(['typedText', '/', { focus: true, simulateKeystroke: true }]); }, ins('\\%'), 'op')],
        [K('pow', '<i>x</i><sup>□</sup>', '<sup>□</sup>√', ins('^{\\placeholder{}}'), ins('\\sqrt[\\placeholder{}]{\\placeholder{}}'), 'lt'),
          K('frac', '<span class="fr">□<br>□</span>', '<span class="fr s">1<br>□</span>', ins('\\frac{\\placeholder{}}{\\placeholder{}}'), ins('\\frac{1}{\\placeholder{}}'), 'md'),
          K('lpar', '(', 'constants', () => UI.Edit.open(this.mf), () => this.menu('const'), 'bk'),
          K('rpar', ')', 'op', () => UI.Edit.close(this.mf), () => this.doOp(), 'bk'),
          K('mul', '×', 'set op', ins('\\times'), () => this.setOp(), 'op')],
        [K('sq', '<i>x</i>²', '√', ins('^2'), ins('\\sqrt{\\placeholder{}}'), 'md'),
          K('7', '7', '□<span class="fr s">□<br>□</span>', ins('7'), ins('\\placeholder{}\\frac{\\placeholder{}}{\\placeholder{}}'), 'num'),
          K('8', '8', 'convert', ins('8'), () => this.menu('convert'), 'num'),
          K('9', '9', 'base n', ins('9'), () => this.menu('base'), 'num'),
          K('sub', '−', '◂' + HC, ins('-'), contrast(-1), 'op')],
        [K('var', '<i>x</i><span class="stk sm"><i>yzt</i><br><i>abcd</i></span>', 'clear var', () => this.tap('var', VARS), () => { this.store = {}; this.app.saveSoon(); toast('Variables cleared'); }, 'dk'),
          K('4', '4', 'D', ins('4'), hexd('D'), 'num'), K('5', '5', 'E', ins('5'), hexd('E'), 'num'), K('6', '6', 'F', ins('6'), hexd('F'), 'num'),
          K('add', '+', HC + '▸', ins('+'), contrast(1), 'op')],
        [K('sto', 'sto→', 'recall', () => this.storeTo(), () => this.menu('recall'), 'dk'),
          K('1', '1', 'A', ins('1'), hexd('A'), 'num'), K('2', '2', 'B', ins('2'), hexd('B'), 'num'), K('3', '3', 'C', ins('3'), hexd('C'), 'num'),
          K('approx', '◂▸ ≈', 'f◂▸d', () => this.toggleFD('approx'), () => this.toggleFD('frac'), 'op')],
        [K('on', 'on', 'off', () => this.onKey(), () => this.offKey(), 'bk'),
          K('0', '0', 'reset', ins('0'), () => this.reset(), 'num'),
          K('dot', '.', ',', ins('.'), ins(','), 'num'),
          K('neg', '(−)', 'answer', ins('-'), ins('\\mathrm{ans}'), 'num'),
          K('enter', 'enter', '', () => this.enter(), null, 'op ent')],
      ];
      const mk = (d) => {
        const b = el('button', { class: 'key36 ' + (d.t || '') + (d.s ? '' : ' nos'), 'aria-label': d.id });
        b.append(el('span', { class: 's', html: d.s || '&nbsp;' }), el('span', { class: 'cap' }, el('span', { class: 'f', html: d.f })));
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('pressed'); haptic(); });
        const up = () => {
          if (!b.classList.contains('pressed')) return; b.classList.remove('pressed');
          if (this.off && d.id !== 'on') return;
          const sec = this.second && d.sfn; if (d.id !== '2nd') { this.second = false; }
          if (sec || !this.lastTap || this.lastTap.key !== d.id) this.lastTap = null;
          if ((!sec && AUTO_ANS.has(d.id)) || (sec && d.id === 'div')) this.autoAns();
          try { (sec ? d.sfn : d.fn)(); } catch (err) { toast(err.message); }
          this.renderInd();
          if (d.id !== '2nd' && this.menuBox.hidden && !this.off) this.mf.focus();
        };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', () => b.classList.remove('pressed'));
        return b;
      };
      const top = el('div', { class: 't36-top' });
      const cg = el('div', { class: 't36-cluster' }); cluster.flat().forEach((d) => cg.append(mk(d)));
      const dp = el('div', { class: 't36-dpad' }, el('div', { class: 'ring' }));
      for (const [cls, cmd, lab] of [['up', 'moveUp', '▴'], ['left', 'moveToPreviousChar', '◂'], ['right', 'moveToNextChar', '▸'], ['down', 'moveDown', '▾']]) {
        const b = el('button', { class: 'dk ' + cls, text: lab, 'aria-label': cls });
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); haptic(); if (!this.off) this.arrow(cls, cmd); });
        dp.append(b);
      }
      top.append(cg, dp);
      const grid = el('div', { class: 't36-grid' }); rows.flat().forEach((d) => grid.append(mk(d)));
      P.append(top, grid);
      this.applyContrast(); this.root.classList.toggle('night', !!this.S.night);
    }
    /* multi-tap keys: tapping the same key again within 1.6 s replaces what it inserted with the next legend */
    tap(key, list) {
      const now = Date.now(), L = this.lastTap;
      const put = (v) => (typeof v === 'function' ? v() : this.insert(v));
      if (L && L.key === key && now - L.t < 1600) {
        const i = (L.i + 1) % list.length;
        this.mf.value = L.before; try { this.mf.position = L.pos; } catch (e) { /* end */ }
        put(list[i]); this.lastTap = { key, i, t: now, before: L.before, pos: L.pos };
      } else {
        const before = this.mf.value; let pos = 0; try { pos = this.mf.position; } catch (e) { /* none */ }
        put(list[0]); this.lastTap = { key, i: 0, t: now, before, pos };
      }
    }
    /** night display: dark screen, light text (kept with the TI-36X Pro's settings) */
    setNight(on) { this.S.night = !!on; this.root.classList.toggle('night', this.S.night); this.app.saveSoon(); }
    applyContrast() { const c = this.S.contrast || 0; this.lcd.style.filter = c ? 'contrast(' + (1 + c * 0.12).toFixed(2) + ') brightness(' + (1 - c * 0.035).toFixed(3) + ')' : ''; }
    onKey() { if (this.off) { this.off = false; this.root.classList.remove('off'); return; } this.clear(); }
    offKey() { this.closeMenu(); this.off = true; this.root.classList.add('off'); }
    setOp() {
      Sheet.open('set op', (b) => {
        const fmf = mathField({ value: this.opTex || '' }); fmf.classList.add('t36-fmf');
        b.append(el('p', { class: 'desc', text: 'Enter an operation to repeat, such as ×2 or +3. Then press op (2nd ")") to apply it to the entry line or to the last answer.' }), fmf,
          el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Set', onclick: () => { this.opTex = fmf.value.trim(); this.app.saveSoon(); Sheet.close(); toast(this.opTex ? 'op set' : 'op cleared'); } })));
        setTimeout(() => fmf.focus(), 50);
      });
    }
    doOp() {
      if (!this.opTex) { toast('Set an operation first: 2nd set op'); return; }
      let base = this.mf.value.trim();
      if (!base) { if (!this.lastAns) { toast('Enter a value first'); return; } base = '\\mathrm{ans}'; }
      else if (/[-+×\\]/.test(base.replace(/^-/, ''))) base = '\\left(' + base + '\\right)';
      this.mf.value = base + this.opTex; this.enter();
    }
    exprEval() {
      Sheet.open('expr-eval', (b) => {
        const fmf = mathField({ value: this.mf.value || this.exprTex || '' }); fmf.classList.add('t36-fmf');
        const box = el('div', { class: 'cv-units' }); const out = el('div', { class: 't36-res' });
        let vars = [], inputs = {};
        const scan = () => {
          let code = ''; try { code = this.giacOf(fmf.value); } catch (e) { /* incomplete */ }
          const vs = VARS.filter((v) => new RegExp('\\bt36_' + v + '\\b').test(code));
          if (vs.join() === vars.join()) return; vars = vs; box.innerHTML = '';
          for (const v of vs) { const i = inputs[v] || el('input', { class: 'search', inputmode: 'decimal', value: this.store[v] ?? '0' }); inputs[v] = i; box.append(el('label', { class: 'cv-lab' }, el('span', { text: v + ' =' }), i)); }
        };
        fmf.addEventListener('input', scan);
        b.append(el('p', { class: 'desc', text: 'Enter an expression in x, y, z, t, a, b, c or d, then the values to evaluate it at.' }), fmf, box,
          el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Evaluate', onclick: async () => {
            this.exprTex = fmf.value; out.innerHTML = '';
            let code; try { code = this.giacOf(fmf.value); } catch (e) { out.textContent = e.message; return; }
            const subs = vars.map((v) => 't36_' + v + '=(' + (this.giacOf(inputs[v].value || '0')) + ')');
            const r = await this.run(subs.length ? 'subst(' + code + ',[' + subs.join(',') + '])' : code, true);
            const v = Number(r); const m = el('span'); renderTex(m, isFinite(v) ? this.numText(v) : (GiacFmt.giacToTex(r, { digits: 10 }) || r));
            out.append(el('div', {}, el('b', { text: '=' }), m));
          } })), out);
        scan();
      });
    }
    ansTex() { return this.lastAns != null ? '\\mathrm{ans}' : null; }
    autoAns() { return UI.Edit.autoAns(this.mf, this.ansTex()); }
    toggle2nd() { this.second = !this.second; this.renderInd(); }
    insert(tex) { this.mf.focus(); this.mf.executeCommand(['insert', tex, { format: 'latex', insertionMode: 'replaceSelection', selectionMode: 'placeholder', focus: true }]); }
    trig(f, inv) {
      const h = this.hyp; this.hyp = false;
      if (inv) this.insert(h ? '\\operatorname{a' + f + 'h}\\left(\\placeholder{}\\right)' : '\\arc' + f + '\\left(\\placeholder{}\\right)');
      else this.insert('\\' + f + (h ? 'h' : '') + '\\left(\\placeholder{}\\right)');
    }
    arrow(dir, cmd) {
      if (!this.menuBox.hidden) { this.menuNav(dir); return; }
      if ((dir === 'up') && !this.mf.value && this.history.length) { this.entry(); return; }
      this.mf.focus(); this.mf.executeCommand(cmd);
    }
    storeTo() { this.insert('\\to'); toast('Now tap the x yzt abcd key (tap again for the next letter), then enter'); }
    clear(all) { if (!this.menuBox.hidden) { this.closeMenu(); return; } if (all || !this.mf.value) { if (all) { this.history = []; this.renderHist(); } } this.mf.value = ''; }
    quit() { this.closeMenu(); this.mf.value = ''; }
    entry() { const h = [...this.history].reverse().find((x) => x.in); if (h) { this.mf.value = h.in; this.mf.focus(); } }
    reset() { if (!confirm('Reset the TI-36X Pro? This clears settings, variables, lists and history.')) return; Object.assign(this, { S: { angle: 'deg', notation: 'norm', fix: -1, cplx: 'real', base: 'dec', answers: 'auto', frac: 'nd', contrast: 0, night: this.S.night }, history: [], lists: { L1: [], L2: [], L3: [] }, store: {}, mats: {}, vecs: {}, lastAns: null, opTex: '', exprTex: '' }); this.renderHist(); this.renderInd(); this.applyContrast(); this.app.saveSoon(); toast('Reset'); }

    /* ---------------------------------------------------------------- evaluation */
    pre(tex) {
      const deg = this.S.angle === 'deg';
      return tex
        .replace(/(\d+(?:\.\d+)?)\^\{\\prime\\prime\}/g, '\\frac{$1}{3600}°').replace(/(\d+(?:\.\d+)?)\^\{\\prime\}/g, '\\frac{$1}{60}°')
        .replace(/\^\{r\}/g, deg ? '\\cdot\\frac{180}{\\pi}' : '').replace(/\^\{g\}/g, deg ? '\\cdot0.9' : '\\cdot\\frac{\\pi}{200}')
        .replace(/(\d+)\\frac\{(\d+)\}\{(\d+)\}/g, '\\left($1+\\frac{$2}{$3}\\right)')
        .replace(/([0-9.]+)\s*\\angle\s*\(?(-?[0-9.]+)\)?/g, (m, r, a) => '\\left(' + r + '\\cdot\\exponentialE^{\\imaginaryI\\cdot' + a + (deg ? '°' : '') + '}\\right)');
    }
    giacOf(tex) {
      let code = Tex2Giac.tex2giac(this.pre(tex), { degrees: this.S.angle === 'deg', userFuncs: new Set(['f']), vars: new Set(VARS), ans: this.lastAns || '0' });
      code = code.replace(/\b([xyztabcd])\b(?!\s*\()/g, 't36_$1');
      // d/dx(…)|x=v comes out as (diff(…))[x=v]; giac wants subst(diff(…),x=v)
      for (let k = code.indexOf(')[t36_'); k >= 0; k = code.indexOf(')[t36_')) {
        let d = 0, i = k; for (; i >= 0; i--) { if (code[i] === ')') d++; else if (code[i] === '(') { d--; if (!d) break; } }
        let j = k + 1, e = 0; for (; j < code.length; j++) { if (code[j] === '[') e++; else if (code[j] === ']') { e--; if (!e) break; } }
        if (i < 0 || j >= code.length) break;
        code = code.slice(0, i) + 'subst(' + code.slice(i, k + 1) + ',' + code.slice(k + 2, j) + ')' + code.slice(j + 1);
      }
      return code;
    }
    numText(x) {
      const S = this.S;
      if (!isFinite(x)) return String(x);
      const ax = Math.abs(x);
      if (S.notation === 'norm' && (ax === 0 || (ax >= 1e-9 && ax < 1e10))) {
        const s = S.fix >= 0 ? x.toFixed(S.fix) : String(+x.toPrecision(10));
        if (!/e/.test(s)) return s;
      }
      let e = ax === 0 ? 0 : Math.floor(Math.log10(ax)); if (S.notation === 'eng') e = Math.floor(e / 3) * 3;
      let m = x / Math.pow(10, e); let ms = S.fix >= 0 ? m.toFixed(S.fix) : String(+m.toPrecision(10));
      return ms + '\\times10^{' + e + '}';
    }
    async run(code, approx) {
      const S = this.S, prev = this.app.settings.angle === 'deg' ? 0 : 1;
      const want = S.angle === 'deg' ? 0 : 1;
      const cm = S.cplx === 'real' ? 0 : 1;
      let body = approx ? 'evalf(' + code + ')' : code;
      if (S.angle === 'grad') body = body.replace(/\b(sin|cos|tan)\(/g, '$1(pi/200*').replace(/\b(asin|acos|atan)\(/g, '200/pi*$1(');
      const r = await this.app.cas.batch(['angle_radian:=' + (S.angle === 'grad' ? 1 : want), 'complex_mode:=' + cm, body, 'angle_radian:=' + prev, 'complex_mode:=' + (this.app.settings.complex === 'real' ? 0 : 1)]);
      return String(r[2]);
    }
    formatOut(out, forceDec) {
      const S = this.S;
      if (S.base !== 'dec' && /^-?\d+$/.test(out)) {
        const n = BigInt(out), b = { hex: 16, bin: 2, oct: 8 }[S.base];
        return { tex: '\\mathrm{' + (n < 0n ? '-' : '') + (n < 0n ? -n : n).toString(b).toUpperCase() + '}' + { 16: '_h', 2: '_b', 8: '_o' }[b] };
      }
      const num = Number(out);
      if (/^-?[\d.]+(e[-+]?\d+)?$/i.test(out) && isFinite(num) && (forceDec || /[.e]/i.test(out))) return { tex: this.numText(num) };
      let tex = GiacFmt.giacToTex(out.replace(/t36_([xyztabcd])/g, '$1'), { digits: 10 }) || GiacFmt.textTex(out);
      if (S.frac === 'Und') tex = tex.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, (m, a, b) => { a = +a; b = +b; return a > b ? Math.floor(a / b) + (a % b ? '\\frac{' + (a % b) + '}{' + b + '}' : '') : m; });
      return { tex };
    }
    async enter() {
      if (!this.menuBox.hidden) { this.menuPick(); return; }
      const tex = this.mf.value.trim(); if (!tex) return;
      const S = this.S;
      let code;
      try {
        let t = tex;
        if (S.base !== 'dec') { const b = { hex: 16, bin: 2, oct: 8 }[S.base]; t = t.replace(/\b[0-9A-F]+\b/g, (w) => { try { return String(parseInt(w, b)); } catch (e) { return w; } }); }
        code = this.giacOf(t);
      } catch (e) { this.push({ in: tex, err: e.message || 'Syntax error' }); return; }
      // sto→ var
      let target = null; const sm = code.match(/^(.*)=>\s*t36_([xyztabcd])\s*$/s); if (sm) { code = sm[1]; target = sm[2]; }
      // stored variables
      const bound = new Set([...code.matchAll(/(?:diff|integrate)\(.*?,t36_([a-z])\b/g)].map((m) => m[1]));
      const defs = [...[...bound].map((k) => 'purge(t36_' + k + ')'), ...Object.entries(this.store).filter(([k]) => !bound.has(k)).map(([k, v]) => 't36_' + k + ':=' + v)];
      const fxdef = 'f(t36_x):=' + this.giacOf(this.fx);
      let out;
      try {
        await this.app.cas.batch([...defs, fxdef]);
        const approx = S.answers === 'dec' || /\d\.\d|\.\d/.test(code) && S.answers !== 'exact';
        out = await this.run(code, approx);
        if (/ERROR|Error/.test(out)) throw new Error(out.replace(/.*Error:\s*/s, '').split('\n')[0] || 'Error');
        if (S.answers === 'auto' && !approx && out.length > 60) out = await this.run(code, true);
      } catch (e) { this.push({ in: tex, err: 'Error: ' + (e.message || '').replace(/GIAC_ERROR:?/, '').trim() || 'Error' }); return; }
      if (target) this.store[target] = out;
      this.lastAns = out;
      let f = this.formatOut(out, S.answers === 'dec');
      if (S.cplx === 'polar' && /\bi\b|sqrt\(-1\)/.test(out)) {
        const r = await this.app.cas.batch(['angle_radian:=' + (S.angle === 'deg' ? 0 : 1), 'evalf(abs(' + out + '))', 'evalf(arg(' + out + '))', 'angle_radian:=' + (this.app.settings.angle === 'deg' ? 0 : 1)]);
        f = { tex: this.numText(Number(r[1])) + '\\angle ' + this.numText(Number(r[2])) + (S.angle === 'deg' ? '^{\\circ}' : '') };
      }
      this.push({ in: tex, out, tex: f.tex });
      this.mf.value = '';
    }
    exportCSV() {
      const q = (x) => { const v = x == null ? '' : String(x); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const rows = [['#', 'Input', 'Result']].concat(this.history.map((h, i) => [i + 1, h.in, h.err || h.out]));
      UI.download('TI-36X-history-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
    }
    push(h) { this.history.push(h); if (this.history.length > 60) this.history.shift(); this.renderHist(); this.app.saveSoon(); }
    toDMS() {
      const h = this.history[this.history.length - 1]; const v = Number(h && h.out);
      if (!h || !isFinite(v)) { toast('Calculate an angle first'); return; }
      const sg = v < 0 ? '-' : '', a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sec = +((mf - m) * 60).toFixed(4);
      h.tex = sg + d + '^{\\circ}' + m + '^{\\prime}' + sec + '^{\\prime\\prime}'; this.renderHist();
    }
    async toggleFD(mode) {
      const h = this.history[this.history.length - 1]; if (!h || !h.out) { toast(mode === 'frac' ? 'f◂▸d converts the last answer' : '◂▸≈ toggles the last answer: exact ↔ approximate'); return; }
      const dec = /\./.test(h.tex) || /times10/.test(h.tex);
      if (dec) { const ex = await this.run('exact(' + h.out + ')', false); h.tex = this.formatOut(ex).tex; h.out = ex; }
      else { const ap = await this.run(h.out, true); h.tex = this.formatOut(ap, true).tex; h.out = ap; }
      this.renderHist();
    }

    /* ---------------------------------------------------------------- menus (36X style: tabs + numbered items) */
    menus() {
      const I = (label, tex) => ({ label, tex });
      const A = (label, fn) => ({ label, fn });
      return {
        math: [['MATH', [I('▸n/d◂▸Un/d', null), I('lcm(', op('lcm', 2)), I('gcd(', op('gcd', 2)), I('▸Pfactor', op('ifactor')), I('sum(', '\\sum_{\\placeholder{}=\\placeholder{}}^{\\placeholder{}}\\placeholder{}'), I('prod(', '\\prod_{\\placeholder{}=\\placeholder{}}^{\\placeholder{}}\\placeholder{}'), I('d/dx', '\\frac{d}{dx}\\left(\\placeholder{}\\right)'), I('∫ dx', '\\int_{\\placeholder{}}^{\\placeholder{}}\\placeholder{}\\,dx'), I('logBASE(', '\\log_{\\placeholder{}}\\left(\\placeholder{}\\right)'), I('nDeriv d/dx', '\\left.\\frac{d}{dx}\\left(\\placeholder{}\\right)\\right|_{x=\\placeholder{}}')]],
          ['NUM', [I('abs(', '\\left|\\placeholder{}\\right|'), I('round(', op('round', 2)), I('iPart(', op('iPart')), I('fPart(', op('fPart')), I('int(', op('int')), I('min(', op('min', 2)), I('max(', op('max', 2)), I('mod(', op('mod', 2))]],
          ['DMS', [I('° degree', '°'), I('′ minute', '^{\\prime}'), I('″ second', '^{\\prime\\prime}'), I('r radian', '^{r}'), I('g gradian', '^{g}'), A('▸DMS', () => this.toDMS())]],
          ['R◂▸P', [I('P▸Rx(', '\\operatorname{tiPRx}\\left(\\placeholder{},\\placeholder{}\\right)'), I('P▸Ry(', '\\operatorname{tiPRy}\\left(\\placeholder{},\\placeholder{}\\right)'), I('R▸Pr(', '\\operatorname{tiRPr}\\left(\\placeholder{},\\placeholder{}\\right)'), I('R▸Pθ(', '\\operatorname{tiRPq}\\left(\\placeholder{},\\placeholder{}\\right)')]],
          ['HYP', [I('sinh(', '\\sinh\\left(\\placeholder{}\\right)'), I('cosh(', '\\cosh\\left(\\placeholder{}\\right)'), I('tanh(', '\\tanh\\left(\\placeholder{}\\right)'), I('sinh⁻¹(', op('asinh')), I('cosh⁻¹(', op('acosh')), I('tanh⁻¹(', op('atanh'))]]],
        random: [['RAND', [I('rand', '\\operatorname{rand}\\left(\\right)'), I('randint(', op('randInt', 2))]], ['PRB', [I('!', '!'), I('nCr', op('nCr', 2)), I('nPr', op('nPr', 2))]]],
        prb: [['PRB', [I('!', '!'), I('nCr', op('nCr', 2)), I('nPr', op('nPr', 2))]], ['RAND', [I('rand', '\\operatorname{rand}\\left(\\right)'), I('randint(', op('randInt', 2))]]],
        angle: [['DMS', [I('° degree', '°'), I('′ minute', '^{\\prime}'), I('″ second', '^{\\prime\\prime}'), I('r radian', '^{r}'), I('g gradian', '^{g}'), A('▸DMS', () => this.toDMS())]],
          ['R▸P', [I('P▸Rx(', '\\operatorname{tiPRx}\\left(\\placeholder{},\\placeholder{}\\right)'), I('P▸Ry(', '\\operatorname{tiPRy}\\left(\\placeholder{},\\placeholder{}\\right)'), I('R▸Pr(', '\\operatorname{tiRPr}\\left(\\placeholder{},\\placeholder{}\\right)'), I('R▸Pθ(', '\\operatorname{tiRPq}\\left(\\placeholder{},\\placeholder{}\\right)')]]],
        stat: [['STAT-REG', [A('1-Var Stats', () => this.stats(1)), A('2-Var Stats', () => this.stats(2)), A('LinReg ax+b', () => this.reg('lin')), A('QuadraticReg', () => this.reg('quad')), A('CubicReg', () => this.reg('cubic')), A('LnReg a+b ln x', () => this.reg('ln')), A('PwrReg a·xᵇ', () => this.reg('pwr')), A('ExpReg a·bˣ', () => this.reg('exp'))]],
          ['DISTR', [I('Normalpdf', '\\operatorname{normPdf}\\left(\\placeholder{},\\placeholder{},\\placeholder{}\\right)'), I('Normalcdf', '\\operatorname{normCdf}\\left(\\placeholder{},\\placeholder{},\\placeholder{},\\placeholder{}\\right)'), I('invNorm', '\\operatorname{invNorm}\\left(\\placeholder{},\\placeholder{},\\placeholder{}\\right)'), I('Binompdf', '\\operatorname{binomPdf}\\left(\\placeholder{},\\placeholder{},\\placeholder{}\\right)'), I('Binomcdf', '\\operatorname{binomCdf}\\left(\\placeholder{},\\placeholder{},0,\\placeholder{}\\right)'), I('Poissonpdf', '\\operatorname{poissPdf}\\left(\\placeholder{},\\placeholder{}\\right)'), I('Poissoncdf', '\\operatorname{poissCdf}\\left(\\placeholder{},0,\\placeholder{}\\right)')]]],
        const: [['NAMES', K36.map(([s, n, v]) => ({ label: s.replace(/\\/g, '').replace(/_/g, '') + '  ' + n, tex: Units.fmt(v, 'sci', 10).tex }))]],
        convert: CONV36.map(([g, list]) => [g.split(/[ –]/)[0].toUpperCase(), list.map(([a, b]) => A(a + '▸' + b, () => this.convert(a, b)))]),
        complex: [['CPLX', [I('∠', '\\angle'), I('angle(', '\\operatorname{arg}\\left(\\placeholder{}\\right)'), I('abs(', '\\left|\\placeholder{}\\right|'), A('▸r∠θ', () => { this.S.cplx = 'polar'; this.renderInd(); toast('Complex results as r∠θ'); }), A('▸a+bi', () => { this.S.cplx = 'rect'; this.renderInd(); toast('Complex results as a+bi'); }), I('conj(', op('conj')), I('real(', op('real')), I('imag(', op('imag'))]]],
        base: [['CONVR', [A('▸Hex', () => this.setBase('hex')), A('▸Bin', () => this.setBase('bin')), A('▸Dec', () => this.setBase('dec')), A('▸Oct', () => this.setBase('oct'))]],
          ['TYPE', [I('A', 'A'), I('B', 'B'), I('C', 'C'), I('D', 'D'), I('E', 'E'), I('F', 'F')]],
          ['LOGIC', [I('and', '\\operatorname{bitand}\\left(\\placeholder{},\\placeholder{}\\right)'), I('or', '\\operatorname{bitor}\\left(\\placeholder{},\\placeholder{}\\right)'), I('xor', '\\operatorname{bitxor}\\left(\\placeholder{},\\placeholder{}\\right)'), I('not(', '\\operatorname{bitnot}\\left(\\placeholder{}\\right)')]]],
        logic: [['LOGIC', [I('and', '\\operatorname{bitand}\\left(\\placeholder{},\\placeholder{}\\right)'), I('or', '\\operatorname{bitor}\\left(\\placeholder{},\\placeholder{}\\right)'), I('xor', '\\operatorname{bitxor}\\left(\\placeholder{},\\placeholder{}\\right)'), I('not(', '\\operatorname{bitnot}\\left(\\placeholder{}\\right)')]]],
        matrix: [['NAMES', ['A', 'B', 'C'].map((n) => I('[' + n + ']', this.matTex(n)))], ['MATH', [I('det(', '\\det\\left(\\placeholder{}\\right)'), I('Transpose', '^{T}'), I('Inverse', '^{-1}'), I('ref(', op('ref')), I('rref(', op('rref'))]], ['EDIT', ['A', 'B', 'C'].map((n) => A('Edit [' + n + ']', () => this.editMat(n, false)))]],
        vector: [['NAMES', ['u', 'v', 'w'].map((n) => I('[' + n + ']', this.vecTex(n)))], ['MATH', [I('DotProduct(', op('dotP', 2)), I('CrossProduct(', op('crossP', 2)), I('norm(', op('norm'))]], ['EDIT', ['u', 'v', 'w'].map((n) => A('Edit [' + n + ']', () => this.editMat(n, true)))]],
        recall: [['RECALL VAR', VARS.map((v) => ({ label: v + ' = ' + (this.store[v] ?? '0'), tex: this.store[v] ? (GiacFmt.giacToTex(this.store[v], { editable: true }) || v) : '0' }))]],
      };
    }
    menu(name) {
      const m = this.menus()[name]; if (!m) return;
      this.cur = { name, tabs: m, tab: 0, item: 0 };
      this.drawMenu();
    }
    drawMenu() {
      const { tabs, tab, item } = this.cur, box = this.menuBox; box.hidden = false; box.innerHTML = '';
      const tabRow = el('div', { class: 't36-tabs' });
      tabs.forEach(([t], i) => tabRow.append(el('button', { class: i === tab ? 'on' : '', text: t, onclick: () => { this.cur.tab = i; this.cur.item = 0; this.drawMenu(); } })));
      const list = el('div', { class: 't36-items' });
      tabs[tab][1].forEach((it, i) => list.append(el('button', { class: i === item ? 'on' : '', html: '<b>' + (i + 1) + ':</b> ', onclick: () => { this.cur.item = i; this.menuPick(); } }, it.label)));
      box.append(tabRow, list);
      const on = list.children[item]; if (on) on.scrollIntoView({ block: 'nearest' });
    }
    menuNav(dir) {
      const c = this.cur; const n = c.tabs[c.tab][1].length;
      if (dir === 'down') c.item = (c.item + 1) % n; else if (dir === 'up') c.item = (c.item + n - 1) % n;
      else if (dir === 'right') { c.tab = (c.tab + 1) % c.tabs.length; c.item = 0; } else { c.tab = (c.tab + c.tabs.length - 1) % c.tabs.length; c.item = 0; }
      this.drawMenu();
    }
    menuPick() {
      const it = this.cur.tabs[this.cur.tab][1][this.cur.item]; this.closeMenu();
      if (it.fn) { it.fn(); return; }
      if (it.tex === null) { this.toggleFD(); return; }
      if (it.tex) this.insert(it.tex);
    }
    closeMenu() { this.menuBox.hidden = true; this.cur = null; }
    setBase(b) { this.S.base = b; this.renderInd(); this.app.saveSoon(); toast(b === 'dec' ? 'Decimal' : b.toUpperCase() + ' mode: whole numbers'); }
    matTex(n) { const m = this.mats[n]; if (!m) return '\\begin{pmatrix}\\placeholder{}\\end{pmatrix}'; return '\\begin{pmatrix}' + m.map((r) => r.join('&')).join('\\\\') + '\\end{pmatrix}'; }
    vecTex(n) { const v = this.vecs[n]; if (!v) return '\\left[\\placeholder{},\\placeholder{}\\right]'; return '\\left[' + v[0].join(',') + '\\right]'; }
    async convert(a, b) {
      const tex = this.mf.value.trim();
      let v;
      if (tex) { const out = await this.run(this.giacOf(tex), true); v = Number(out); }
      else v = Number(this.lastAns);
      if (!isFinite(v)) { toast('Enter a value first'); return; }
      const r = Units.convert(v, a, b);
      this.lastAns = Units.num(r, 12);
      this.push({ in: (tex || this.numText(v)) + '\\,\\mathrm{' + a.replace('°', '^{\\circ}') + '}\\blacktriangleright\\mathrm{' + b.replace('°', '^{\\circ}') + '}', out: this.lastAns, tex: this.numText(r) });
      this.mf.value = '';
    }

    /* ---------------------------------------------------------------- mode */
    modeMenu() {
      const S = this.S;
      Sheet.open('mode', (b) => {
        const row = (label, key, opts) => {
          const seg = el('div', { class: 'seg', style: { margin: '4px 0 12px' } });
          for (const [v, t] of opts) { const x = el('button', { text: t, class: S[key] === v ? 'on' : '' }); x.onclick = () => { S[key] = v; seg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); this.renderInd(); this.app.saveSoon(); }; seg.append(x); }
          b.append(el('div', { class: 'desc', text: label }), seg);
        };
        row('Angle', 'angle', [['deg', 'DEG'], ['rad', 'RAD'], ['grad', 'GRAD']]);
        row('Display', 'notation', [['norm', 'NORM'], ['sci', 'SCI'], ['eng', 'ENG']]);
        row('Decimals', 'fix', [[-1, 'FLOAT'], [0, '0'], [2, '2'], [4, '4'], [6, '6'], [9, '9']]);
        row('Numbers', 'cplx', [['real', 'REAL'], ['rect', 'a+bi'], ['polar', 'r∠θ']]);
        row('Base', 'base', [['dec', 'DEC'], ['hex', 'HEX'], ['bin', 'BIN'], ['oct', 'OCT']]);
        row('Answers', 'answers', [['auto', 'AUTO'], ['exact', 'EXACT'], ['dec', 'DEC']]);
        row('Fractions', 'frac', [['nd', 'n/d'], ['Und', 'U n/d']]);
      });
    }

    /* ---------------------------------------------------------------- data, stats, regressions */
    dataEditor() {
      Sheet.open('data — lists L1, L2, L3', (b) => {
        const grid = el('div', { class: 't36-data' });
        const n = Math.max(8, ...Object.values(this.lists).map((l) => l.length + 1));
        grid.append(el('b', { text: '' }), ...['L1', 'L2', 'L3'].map((l) => el('b', { text: l })));
        for (let i = 0; i < n; i++) {
          grid.append(el('span', { class: 'desc', text: String(i + 1) }));
          for (const L of ['L1', 'L2', 'L3']) {
            const inp = el('input', { class: 'search', inputmode: 'decimal', value: this.lists[L][i] ?? '' });
            inp.onchange = () => { const v = inp.value.trim(); if (v === '') this.lists[L].splice(i, 1); else this.lists[L][i] = Number(evalNum(v)); this.lists[L] = this.lists[L].filter((x) => x !== undefined && isFinite(x)); this.app.saveSoon(); };
            grid.append(inp);
          }
        }
        b.append(grid, el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Clear all lists', onclick: () => { this.lists = { L1: [], L2: [], L3: [] }; this.app.saveSoon(); Sheet.close(); this.dataEditor(); } }), el('button', { class: 'btn pri', text: 'Stats', onclick: () => { Sheet.close(); this.menu('stat'); } })));
      });
    }
    pickLists(two, cb) {
      Sheet.open(two ? '2-Var Stats' : '1-Var Stats', (b) => {
        const mk = (lab, def) => { const s = el('select', { class: 'search' }, ['L1', 'L2', 'L3'].map((l) => el('option', { value: l, text: l, selected: l === def }))); b.append(el('div', { class: 'desc', text: lab }), s); return s; };
        const xs = mk('x data', 'L1'), ys = two ? mk('y data', 'L2') : null;
        b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Calculate', onclick: () => { Sheet.close(); cb(this.lists[xs.value], ys ? this.lists[ys.value] : null); } })));
      });
    }
    stats(k) {
      this.pickLists(k === 2, (X, Y) => {
        if (!X.length) { toast('Enter data first (data key)'); return; }
        const n = X.length, sum = (a) => a.reduce((p, q) => p + q, 0), mean = (a) => sum(a) / a.length;
        const sx = (a) => Math.sqrt(sum(a.map((v) => (v - mean(a)) ** 2)) / (a.length - 1)), px = (a) => Math.sqrt(sum(a.map((v) => (v - mean(a)) ** 2)) / a.length);
        const srt = [...X].sort((p, q) => p - q), med = (a) => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
        const rows = [['n', n], ['x̄', mean(X)], ['Sx', sx(X)], ['σx', px(X)], ['Σx', sum(X)], ['Σx²', sum(X.map((v) => v * v))]];
        if (k === 1) rows.push(['minX', srt[0]], ['Q1', med(srt.slice(0, Math.floor(n / 2)))], ['Med', med(srt)], ['Q3', med(srt.slice(Math.ceil(n / 2)))], ['maxX', srt[n - 1]]);
        else { const Yn = Y.slice(0, n); rows.push(['ȳ', mean(Yn)], ['Sy', sx(Yn)], ['σy', px(Yn)], ['Σy', sum(Yn)], ['Σy²', sum(Yn.map((v) => v * v))], ['Σxy', sum(X.map((v, i) => v * Yn[i]))], ['r', this.corr(X, Yn)]); }
        this.showTable(k === 1 ? '1-Var Stats' : '2-Var Stats', rows);
      });
    }
    corr(X, Y) { const n = X.length, mx = X.reduce((a, b) => a + b) / n, my = Y.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; syy += (Y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); }
    polyfit(X, Y, d) {
      const m = d + 1, A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
      for (let i = 0; i < X.length; i++) for (let r = 0; r < m; r++) { for (let c = 0; c < m; c++) A[r][c] += X[i] ** (r + c); A[r][m] += Y[i] * X[i] ** r; }
      for (let c = 0; c < m; c++) { let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < m; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k]; } }
      return A.map((r, i) => r[m] / r[i]);   // coefficients c0..cd
    }
    reg(kind) {
      this.pickLists(true, (X, Y) => {
        const n = Math.min(X.length, Y.length); X = X.slice(0, n); Y = Y.slice(0, n);
        if (n < 2) { toast('Need at least 2 points in the x and y lists'); return; }
        let rows, f;
        if (kind === 'lin') { const [b, a] = this.polyfit(X, Y, 1); rows = [['a', a], ['b', b], ['r²', this.corr(X, Y) ** 2], ['r', this.corr(X, Y)]]; f = a + '*x+' + b; }
        else if (kind === 'quad' || kind === 'cubic') { const d = kind === 'quad' ? 2 : 3; const c = this.polyfit(X, Y, d).reverse(); const names = 'abcd'; rows = c.map((v, i) => [names[i], v]); const yh = X.map((x) => c.reduce((p, q) => p * x + q, 0)); const my = Y.reduce((p, q) => p + q) / n; rows.push(['R²', 1 - Y.reduce((s, y, i) => s + (y - yh[i]) ** 2, 0) / Y.reduce((s, y) => s + (y - my) ** 2, 0)]); f = c.map((v, i) => '(' + v + ')*x^' + (d - i)).join('+'); }
        else if (kind === 'ln') { const L = X.map(Math.log); const [a, b] = this.polyfit(L, Y, 1); rows = [['a', a], ['b', b], ['r²', this.corr(L, Y) ** 2], ['r', this.corr(L, Y)]]; f = a + '+' + b + '*ln(x)'; }
        else if (kind === 'pwr') { const LX = X.map(Math.log), LY = Y.map(Math.log); const [la, b] = this.polyfit(LX, LY, 1); rows = [['a', Math.exp(la)], ['b', b], ['r²', this.corr(LX, LY) ** 2], ['r', this.corr(LX, LY)]]; f = Math.exp(la) + '*x^' + b; }
        else { const LY = Y.map(Math.log); const [la, lb] = this.polyfit(X, LY, 1); rows = [['a', Math.exp(la)], ['b', Math.exp(lb)], ['r²', this.corr(X, LY) ** 2], ['r', this.corr(X, LY)]]; f = Math.exp(la) + '*' + Math.exp(lb) + '^x'; }
        if (rows.some(([, v]) => !isFinite(v))) { toast('That regression needs positive data'); return; }
        this.fx = f.replace(/\*x/g, 'x').replace(/e[+]?(-?\d+)/g, '\\times10^{$1}');
        this.showTable({ lin: 'LinReg ax+b', quad: 'QuadraticReg', cubic: 'CubicReg', ln: 'LnReg', pwr: 'PwrReg', exp: 'ExpReg' }[kind], rows, 'Stored as f(x) — use table, or f( in calculations');
      });
    }
    showTable(title, rows, note) {
      Sheet.open(title, (b) => {
        const T = el('div', { class: 't36-res' });
        for (const [k, v] of rows) { const m = el('span'); renderTex(m, this.numText(v)); T.append(el('div', {}, el('b', { text: k + ' =' }), m, el('button', { class: 'chip', text: 'Use', onclick: () => { Sheet.close(); this.insert(Units.fmt(v, 'sci', 10).tex); } }))); }
        b.append(T); if (note) b.append(el('p', { class: 'desc', text: note }));
      });
    }

    /* ---------------------------------------------------------------- table */
    table() {
      Sheet.open('table — f(x)', (b) => {
        const fmf = mathField({ value: this.fx }); fmf.classList.add('t36-fmf');
        const st = el('input', { class: 'search', value: '0', inputmode: 'decimal' }), dx = el('input', { class: 'search', value: '1', inputmode: 'decimal' });
        const out = el('div', { class: 't36-res' });
        const go = async () => {
          this.fx = fmf.value; this.app.saveSoon();
          let code; try { code = this.giacOf(this.fx).replace(/t36_x/g, 'xx_'); } catch (e) { out.textContent = e.message; return; }
          const x0 = Number(evalNum(st.value)), h = Number(evalNum(dx.value)); const xs = Array.from({ length: 12 }, (_, i) => +(x0 + i * h).toPrecision(12));
          const r = await this.app.cas.batch(['angle_radian:=' + (this.S.angle === 'deg' ? 0 : 1), ...xs.map((x) => 'evalf(subst(' + code + ',xx_,' + x + '))'), 'angle_radian:=' + (this.app.settings.angle === 'deg' ? 0 : 1)]);
          out.innerHTML = ''; out.append(el('div', {}, el('b', { text: 'x' }), el('b', { text: 'f(x)' })));
          xs.forEach((x, i) => { const v = Number(r[i + 1]); const m = el('span'); renderTex(m, isFinite(v) ? this.numText(v) : '\\text{undef}'); out.append(el('div', {}, el('span', { text: String(x) }), m)); });
        };
        b.append(el('div', { class: 'desc', text: 'f(x) =' }), fmf, el('div', { class: 'cv-units' }, el('label', { class: 'cv-lab' }, el('span', { text: 'Start' }), st), el('label', { class: 'cv-lab' }, el('span', { text: 'Step' }), dx)), el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'OK', onclick: go })), out);
      });
    }

    /* ---------------------------------------------------------------- solvers */
    numSolv() {
      Sheet.open('num-solv', (b) => {
        const emf = mathField({ value: '' }); emf.classList.add('t36-fmf');
        const vsel = el('select', { class: 'search' }, VARS.map((v) => el('option', { value: v, text: v })));
        const guess = el('input', { class: 'search', value: '1', inputmode: 'decimal' });
        const out = el('div', { class: 't36-res' });
        b.append(el('p', { class: 'desc', text: 'Enter an equation such as x² − 2 = 0 or 3x + 7 = 2x. Other variables use their stored values.' }), emf,
          el('div', { class: 'cv-units' }, el('label', { class: 'cv-lab' }, el('span', { text: 'Solve for' }), vsel), el('label', { class: 'cv-lab' }, el('span', { text: 'Guess' }), guess)),
          el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Solve', onclick: async () => {
            let code; try { code = this.giacOf(emf.value); } catch (e) { out.textContent = e.message; return; }
            if (!/=/.test(code)) code += '=0';
            const v = 't36_' + vsel.value;
            const defs = Object.entries(this.store).filter(([k]) => k !== vsel.value).map(([k, x]) => 't36_' + k + ':=' + x);
            const r = await this.app.cas.batch(['purge(' + v + ')', ...defs, 'angle_radian:=' + (this.S.angle === 'deg' ? 0 : 1), 'fsolve(' + code + ',' + v + '=' + (Number(evalNum(guess.value)) || 1) + ')', 'angle_radian:=' + (this.app.settings.angle === 'deg' ? 0 : 1)]);
            const res = r[r.length - 2]; const x = Number(String(res).replace(/^\[|\]$/g, '').split(',')[0]);
            out.innerHTML = '';
            if (!isFinite(x)) { out.textContent = 'No solution found near the guess.'; return; }
            this.store[vsel.value] = String(x); this.app.saveSoon();
            const m = el('span'); renderTex(m, vsel.value + '=' + this.numText(x)); out.append(el('div', {}, m, el('span', { class: 'desc', text: 'stored in ' + vsel.value })));
          } })), out);
      });
    }
    polySolv() {
      Sheet.open('poly-solv', (b) => {
        let deg = 2; const box = el('div'); const out = el('div', { class: 't36-res' });
        const seg = el('div', { class: 'seg' }); for (const d of [2, 3]) { const x = el('button', { text: d === 2 ? 'ax²+bx+c' : 'ax³+bx²+cx+d', class: d === deg ? 'on' : '' }); x.onclick = () => { deg = d; seg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); draw(); }; seg.append(x); }
        let ins = [];
        const draw = () => { box.innerHTML = ''; ins = 'abcd'.slice(0, deg + 1).split('').map((l) => { const i = el('input', { class: 'search', inputmode: 'decimal', placeholder: l }); box.append(el('label', { class: 'cv-lab' }, el('span', { text: l + ' =' }), i)); return i; }); };
        draw();
        b.append(seg, box, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Solve', onclick: async () => {
          const c = ins.map((i) => i.value.trim() || '0');
          const poly = c.map((v, i) => '(' + v + ')*xx_^' + (deg - i)).join('+');
          const r = await this.app.cas.batch(['complex_mode:=1', 'proot([' + c.join(',') + '])', 'complex_mode:=' + (this.app.settings.complex === 'real' ? 0 : 1)]);
          const roots = String(r[1]).replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
          out.innerHTML = ''; void poly;
          roots.forEach((s, i) => { const m = el('span'); const v = Number(s); renderTex(m, 'x_' + (i + 1) + '=' + (isFinite(v) ? this.numText(v) : (GiacFmt.giacToTex(s, { digits: 10 }) || s))); out.append(el('div', {}, m)); });
        } })), out);
      });
    }
    sysSolv() {
      Sheet.open('sys-solv', (b) => {
        let n = 2; const box = el('div', { class: 't36-sys' }); const out = el('div', { class: 't36-res' });
        const seg = el('div', { class: 'seg' }); for (const d of [2, 3]) { const x = el('button', { text: d + '×' + d, class: d === n ? 'on' : '' }); x.onclick = () => { n = d; seg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); draw(); }; seg.append(x); }
        let cells = [];
        const draw = () => { box.innerHTML = ''; box.style.gridTemplateColumns = 'repeat(' + (n + 1) + ', 1fr)'; cells = []; const vars = ['x', 'y', 'z'].slice(0, n); for (const v of vars) box.append(el('b', { text: v })); box.append(el('b', { text: '= ' })); for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c <= n; c++) { const i = el('input', { class: 'search', inputmode: 'decimal' }); box.append(i); row.push(i); } cells.push(row); } };
        draw();
        b.append(seg, box, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Solve', onclick: async () => {
          const M = cells.map((r) => r.map((i) => i.value.trim() || '0'));
          const A = '[' + M.map((r) => '[' + r.slice(0, n).join(',') + ']').join(',') + ']', B = '[' + M.map((r) => r[n]).join(',') + ']';
          const r = await this.app.cas.batch(['simplify(linsolve(' + A + ',' + B + '))', 'det(' + A + ')']);
          out.innerHTML = '';
          if (Number(r[1]) === 0 || /\[\]/.test(r[0])) { out.textContent = 'No unique solution (the system is singular).'; return; }
          String(r[0]).replace(/^\[|\]$/g, '').split(',').forEach((s, i) => { const m = el('span'); renderTex(m, 'xyz'[i] + '=' + (GiacFmt.giacToTex(s.trim(), { digits: 10 }) || s)); out.append(el('div', {}, m)); });
        } })), out);
      });
    }
    editMat(name, vec) {
      const store = vec ? this.vecs : this.mats;
      Sheet.open('Edit [' + name + ']', (b) => {
        let R = vec ? 1 : (store[name] ? store[name].length : 2), C = store[name] ? store[name][0].length : (vec ? 3 : 2);
        const dims = el('div', { class: 'seg' });
        const opts = vec ? [[1, 2], [1, 3]] : [[1, 2], [2, 1], [2, 2], [2, 3], [3, 2], [3, 3], [1, 3], [3, 1]];
        const box = el('div', { class: 't36-sys' }); let cells = [];
        const draw = () => { box.innerHTML = ''; box.style.gridTemplateColumns = 'repeat(' + C + ', 1fr)'; cells = []; for (let r = 0; r < R; r++) { const row = []; for (let c = 0; c < C; c++) { const i = el('input', { class: 'search', inputmode: 'decimal', value: store[name] && store[name][r] ? (store[name][r][c] ?? '0') : '0' }); box.append(i); row.push(i); } cells.push(row); } };
        for (const [r, c] of opts) { const x = el('button', { text: r + '×' + c, class: r === R && c === C ? 'on' : '' }); x.onclick = () => { R = r; C = c; dims.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); draw(); }; dims.append(x); }
        draw();
        b.append(dims, box, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Save', onclick: () => { store[name] = cells.map((r) => r.map((i) => i.value.trim() || '0')); this.app.saveSoon(); Sheet.close(); toast('[' + name + '] saved'); } })));
      });
    }
  }

  root.TI36 = { TI36Page };
})(typeof self !== 'undefined' ? self : this);
