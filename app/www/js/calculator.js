/*
 * calculator.js — the Calculator page: 2D entry, history with pretty-printed results,
 * exact/approximate evaluation, definitions, and reuse of earlier work.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, mathField, Sheet } = UI;

  // commands whose output form is the point, so the result isn't re-simplified
  const STRUCTURAL = /^(factor|cFactor|cfactor|expand|propFrac|comDenom|partfrac|texpand|tcollect|tlin|lncollect|lin|trigsin|trigcos|trigtan|simplify|ratnormal|normal|canonical_form|convert|string|exact|evalf|approx|taylor|series|regroup|ifactor|quartiles|seq|solve|cSolve|zeros|cZeros|nSolve|desolve)\(/;

  /** Shared evaluation used by every app. Returns {ok, code, out, tex, kind, error}. */
  async function evaluate(app, tex, opts = {}) {
    const S = app.settings;
    const ctx = { degrees: S.angle === 'deg', userFuncs: app.userFuncs, vars: app.vars, ans: app.lastAns };
    let code;
    try { code = Tex2Giac.tex2giac(tex, ctx); } catch (e) { return { ok: false, error: e.message || 'Syntax error' }; }
    if (!code.trim()) return { ok: false, error: '' };
    let kind = 'expr', name = null;
    let m;
    if ((m = code.match(/^\s*([A-Za-z][\w]*)\(([^()]*)\)\s*:=/))) { kind = 'func'; name = m[1]; }
    else if ((m = code.match(/^\s*([A-Za-z][\w]*)\s*:=/))) { kind = 'assign'; name = m[1]; }
    else if ((m = code.match(/=>\s*([A-Za-z][\w]*)\s*$/))) { kind = 'assign'; name = m[1]; }
    else if ((m = code.match(/^purge\(([^)]*)\)$/))) { kind = 'purge'; name = m[1]; }
    else if (/^\s*Define\b/.test(code)) kind = 'func';
    let run = code;
    const approx = opts.approx || S.calc === 'approx';
    if (kind === 'expr') {
      const sm = code.match(/^(solve|cSolve|zeros|cZeros|nSolve|fMin|fMax|desolve|deSolve)\((.*)\)$/s);
      if (approx && sm) {
        // evalf() of an equation result collapses it to true/false in TI mode: approximate the input instead
        const args = Graphs.splitTop(sm[2]);
        args[0] = 'evalf(' + args[0] + ')';
        run = sm[1] + '(' + args.join(',') + ')';
      } else if (approx) run = 'evalf(' + code + ')';
      else if (S.calc === 'exact') run = 'exact(' + code + ')';
    } else if (kind === 'assign' && approx && !/=>\s*_/.test(code)) {
      run = code.replace(/^(\s*[A-Za-z]\w*\s*:=)(.*)$/, '$1evalf($2)').replace(/^(.*)=>(\s*[A-Za-z]\w*\s*)$/, 'evalf($1)=>$2');
    }
    // unit conversions Giac can't do as written (its _Da, _yr, °C… differ from ours, or the user's own units): convert here
    if (kind === 'expr') { const cv = await convertUnits(app, code); if (cv) return cv; }
    run = Units.toGiac(run);
    let out;
    let printed = [];
    try { const r = await app.cas.evalFull(run); out = r.out; printed = r.printed.filter((t) => t.trim() !== '');
      // only programs print; drop Giac's own progress notes
      const callsUser = [...app.userFuncs].some((f) => new RegExp('\\b' + f + '\\(').test(code)) || /\bDisp\b/.test(code);
      if (!callsUser) printed = []; } catch (e) { return { ok: false, code, error: e.message === 'Stopped' ? 'Stopped' : 'Error: ' + e.message }; }
    out = String(out);
    const err = out.match(/GIAC_ERROR:?([\s\S]*)/) || out.match(/^\s*"?Error:\s*([\s\S]*)/);
    if (err) {
      let msg = (out.match(/Error:\s*([^\n]*)/) || [, err[1]])[1].trim();
      msg = msg.replace(/^Bad Argument Value$/i, 'Argument error').replace(/syntax error.*/i, 'Syntax error');
      return { ok: false, code, error: 'Error: ' + (msg || 'invalid input') };
    }
    // remember state changes so they survive a restart
    if (kind === 'func' || kind === 'assign') {
      app.cas.forget(name); app.cas.remember(run);   // run already has the units in Giac's form
      if (kind === 'func') { app.userFuncs.add(name); app.vars.delete(name); } else { app.vars.add(name); app.userFuncs.delete(name); }
      app.saveSoon();
    } else if (kind === 'purge') {
      name.split(',').forEach((n) => { n = n.trim(); app.cas.forget(n); app.vars.delete(n); app.userFuncs.delete(n); });
      app.saveSoon();
    }
    if (kind === 'func' || kind === 'purge' || /^\s*:?lastprog|:Func|:Prgm/.test(out)) return { ok: true, code, out: 'Done', tex: '\\mathrm{Done}', kind, done: true };
    if (printed.length) return { ok: true, code, out, tex: GiacFmt.giacToTex(out, { digits: S.digits }) || '', kind, printed };
    // automatic simplification, Nspire style
    if (!approx && kind === 'expr' && !STRUCTURAL.test(code) && !/[=<>:"]|\bor\b|\band\b|list\[|_\(|\b_\w/.test(out) && out.length < 4000) {
      try { const r = await app.cas.eval('regroup(' + out + ')'); if (!/ERROR|Error/.test(r)) out = r; } catch (e) { /* keep */ }
    }
    const texOut = GiacFmt.giacToTex(out, fmtOpts(S)) || GiacFmt.textTex(out);
    if (kind === 'expr' || kind === 'assign') app.lastAns = out;
    return { ok: true, code, out, tex: texOut, kind };
  }


  /** "expr => _unit" (or convert(expr,_unit)) when a unit on either side isn't one Giac reads exactly as we do. */
  const TEMP_ABS = /^\s*\(?\s*(-?\d+(?:\.\d*)?(?:e-?\d+)?)\s*\)?\s*\*?\s*_(°C|°F|°R|K|degC|degF|degR|℃|℉)\s*$/;
  async function convertUnits(app, code) {
    let m = code.match(/^(.*)=>\s*(_[^=]*?)\s*$/s) || code.match(/^convert\((.*),\s*(_[^,()]*(?:\([^()]*\))?[^,()]*)\)$/s);
    if (!m) return null;
    const lhs = m[1], target = m[2];
    if (!/^[\s_\wµμΩÅ°℃℉⊕☉ₑγ₀*\/^().\-]+$/.test(target)) return null;
    if (Units.giacNative(code) && !/_(°|deg[CFR]|℃|℉)/.test(code)) return null;
    const to = Units.fromGiacUnit(target.replace(/\s+/g, ''));
    let val;
    try {
      const t = lhs.match(TEMP_ABS);
      if (t && Units.sameDim(Units.parse(to).d, Units.parse('K').d) && Units.parse(to).simple) val = Units.convert(+t[1], t[2], to);   // 20 °C → 68 °F (absolute)
      else {
        const r = String(await app.cas.eval('evalf(mksa(' + Units.toGiac(lhs) + '))'));
        if (/ERROR|Error/.test(r)) return null;
        const mm = r.match(/^\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*(?:\*?\s*_(.*))?$/);
        if (!mm) return { ok: false, code, error: 'Error: the value to convert has to be a number with units' };
        val = Units.convert(+mm[1], mm[2] ? Units.fromGiacUnit(mm[2]) : '1', to);
      }
    } catch (e) { return { ok: false, code, error: 'Error: ' + e.message }; }
    const u = to.replace(/·/g, '*');
    const out = Units.num(val, 12) + '_' + (/^[\wµμΩÅ°℃℉⊕☉ₑγ₀]+$/.test(u) ? u : '(' + u + ')');
    app.lastAns = out;
    return { ok: true, code, out, tex: GiacFmt.giacToTex(out, fmtOpts(app.settings)) || out, kind: 'expr' };
  }

  /** readable plain text from simple LaTeX (for CSV) */
  function plainTex(t) {
    let s = String(t);
    for (let k = 0; k < 6; k++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    return s.replace(/\\pm/g, '±').replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)').replace(/\\left|\\right/g, '').replace(/\\(sin|cos|tan|ln|log|pi)/g, '$1').replace(/[{}]/g, '').replace(/\\,?/g, '');
  }
  function copy(t) { try { navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { toast(t); } }
  function undoBar(msg, undo) {
    document.querySelectorAll('.undo-bar').forEach((x) => x.remove());
    const b = el('div', { class: 'undo-bar', role: 'status' }, el('span', { text: msg }), el('button', { text: 'Undo', onclick: () => { b.remove(); undo(); } }));
    document.body.append(b); setTimeout(() => b.remove(), 5000);
  }
  const fmtOpts = (S, extra) => Object.assign({ digits: S.digits, sci: S.fmt === 'sci', eng: S.fmt === 'eng', group: S.group !== false }, extra || {});

  /* ---------------------------------------------------------------- uncertainty propagation
     value ± σ terms are treated as independent inputs; σ_f² = Σ (∂f/∂xᵢ · σᵢ)² (first order, GUM),
     with the partial derivatives taken numerically by the CAS so every function and angle mode works. */
  const NUMRE = '(-?\\d+(?:\\.\\d*)?(?:\\\\times\\s*10\\^\\{-?\\d+\\}|\\\\times\\s*10\\^-?\\d|e-?\\d+)?)';
  const toNum = (t) => Number(String(t).replace(/\\times\s*10\^\{?(-?\d+)\}?/, 'e$1'));
  function fmtUnc(v, s) {
    if (!(s > 0)) return String(+v.toPrecision(10)) + '\\pm0';
    const e = Math.floor(Math.log10(s)) - 1;                                  // σ to 2 significant figures
    const sr = Math.round(s / 10 ** e) * 10 ** e, vr = Math.round(v / 10 ** e) * 10 ** e;
    const av = Math.abs(v);
    if (av >= 1e5 || (av < 1e-3 && av > 0) || s >= 1e5) {
      const p = Math.floor(Math.log10(Math.max(av, s))), k = 10 ** p, d = Math.max(0, p - e);
      return '\\left(' + (vr / k).toFixed(d) + '\\pm' + (sr / k).toFixed(d) + '\\right)\\times10^{' + p + '}';
    }
    const d = Math.max(0, -e);
    return vr.toFixed(d) + '\\pm' + sr.toFixed(d);
  }
  async function evaluateUnc(app, tex) {
    const S = app.settings, terms = []; let k = 0;
    const re = new RegExp(NUMRE + '\\s*\\\\pm\\s*' + NUMRE, 'g');
    const rep = tex.replace(re, (m, a, b) => { const name = 'uq' + 'abcdefghijklmnopqrstuvwxyz'[k++]; terms.push({ name, tex: m, v: toNum(a), s: Math.abs(toNum(b)) }); return ' ' + name + ' '; });
    if (!terms.length || /\\pm/.test(rep)) return { ok: false, error: 'Write each uncertain value as value ± uncertainty between two numbers, e.g. (5.03 ± 0.02)·(2.1 ± 0.1)' };
    const ctx = { degrees: S.angle === 'deg', userFuncs: app.userFuncs, vars: new Set([...app.vars, ...terms.map((t) => t.name)]), ans: app.lastAns };
    let code; try { code = Tex2Giac.tex2giac(rep, ctx); } catch (e) { return { ok: false, error: e.message || 'Syntax error' }; }
    if (/:=|=>|\bsolve\(/.test(code)) return { ok: false, code, error: 'Uncertainty propagation works on an expression, not an assignment or equation.' };
    const names = '[' + terms.map((t) => t.name).join(',') + ']';
    const at = (vals) => 'evalf(subst(' + code + ',' + names + ',[' + vals.join(',') + ']))';
    const base = terms.map((t) => t.v), pts = [at(base)];
    terms.forEach((t, i) => { t.h = t.s > 0 ? t.s * 1e-3 : Math.max(1e-12, Math.abs(t.v) * 1e-8); const up = base.slice(), dn = base.slice(); up[i] += t.h; dn[i] -= t.h; pts.push(at(up), at(dn)); });
    let r; try { r = await app.cas.batch(pts); } catch (e) { return { ok: false, code, error: 'Error: ' + e.message }; }
    const nums = r.map(Number);
    if (!nums.every(isFinite)) return { ok: false, code, error: 'Error: the expression has to give a real number (got ' + String(r[0]).slice(0, 60) + ')' };
    const v = nums[0]; let s2 = 0;
    terms.forEach((t, i) => { t.d = (nums[1 + 2 * i] - nums[2 + 2 * i]) / (2 * t.h); t.c = (t.d * t.s) ** 2; s2 += t.c; });
    const sg = Math.sqrt(s2);
    app.lastAns = String(v);
    return { ok: true, code, out: String(v), tex: fmtUnc(v, sg), kind: 'expr', unc: { v, s: sg, code, names: terms.map((t) => t.name), terms: terms.map((t) => ({ tex: t.tex, v: t.v, s: t.s, d: t.d, pct: s2 ? 100 * t.c / s2 : 0 })) } };
  }

  /* ---------------------------------------------------------------- results with units (Giac prints 6.28_ft, 19.62_(kg*m/s^2)) */
  const unitTexOf = (u) => String(u).replace(/([A-Za-zµΩ°Å]+)/g, '\\mathrm{$1}').replace(/\*/g, '\\cdot ').replace(/\^\(?(-?\d+)\)?/g, '^{$1}');
  function unitOf(out) {
    const s = String(out), i = s.indexOf('_');
    if (i <= 0 || s.indexOf('_', i + 1) >= 0) return null;
    const vp = s.slice(0, i).trim(), up = s.slice(i + 1).trim().replace(/^\((.*)\)$/, '$1').replace(/\^\(?(-?\d+)(?:\.0+)?\)?/g, '^$1');
    if (!/^[-+\d.eE*\/() ]+$/.test(vp) || /[^\w*\/^.\-()µμΩ°Å℃℉⊕☉ₑγ₀]/.test(up)) return null;
    let v; try { v = Function('"use strict";return (' + vp.replace(/\^/g, '**') + ')')(); } catch (e) { return null; }
    if (!isFinite(v)) return null;
    try { Units.parse(up); } catch (e) { return null; }
    return { v, u: up };
  }

  class CalculatorPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'calc'; this.title = 'Calculator';
      this.history = (state.history || []).map((h) => (h.tex ? Object.assign(h, { tex: GiacFmt.fixUnitTex(h.tex) }) : h));
      this.root = el('div', { class: 'page calc' });
      this.hist = el('div', { class: 'hist' });
      this.picks = el('div', { class: 'picks', hidden: true });
      this.mf = mathField({ placeholder: '' });
      this.busy = el('span', { class: 'busy', hidden: true });
      this.stopBtn = el('button', { class: 'stop', hidden: true, text: 'Stop', onclick: () => app.cas.breakAndRestart().then(() => toast('Stopped')) });
      this.entry = el('div', { class: 'entry' }, this.mf, this.busy, this.stopBtn);
      this.pins = el('div', { class: 'pins', hidden: true });
      this.root.append(this.pins, this.hist, this.picks, this.entry);
      this.mf.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.enter(e.ctrlKey || e.metaKey); }
        if (e.key === 'ArrowUp' && !this.mf.value) { e.preventDefault(); this.recall(); }
      });
      this.mf.addEventListener('beforeinput', (e) => { if (e.inputType === 'insertLineBreak') { e.preventDefault(); this.enter(); } });
      UI.Edit.bind(this.mf, () => this.ansTex());
      this.renderAll();
    }
    get target() { return this.mf; }
    focus() { this.mf.focus(); }
    serialize() { return { history: this.history.slice(-300) }; }

    renderAll() {
      this.hist.innerHTML = '';
      if (!this.history.length) this.hist.append(el('div', { class: 'empty-hint', html: 'Type with the keypad and press <b>enter</b>. Press <b>≈</b> for a decimal answer. Open <b>menu</b> for algebra, calculus, statistics, matrices and more. Swipe a result left to delete it; tap it to pin, copy or convert.' }));
      for (const h of this.history) this.hist.append(this.rowFor(h));
      this.renderPins();
      this.scrollEnd();
    }
    renderPins() {
      const P = this.history.filter((h) => h.pinned);
      this.pins.innerHTML = ''; this.pins.hidden = !P.length;
      if (P.length) this.pins.append(el('div', { class: 'pins-h', text: '📌 Pinned' }));
      for (const h of P) this.pins.append(this.rowFor(h, true));
    }
    rowFor(h, pinned) {
      const S = this.app.settings;
      const r = el('div', { class: 'row' + (h.pinned ? ' pinned' : '') });
      const a = el('div', { class: 'in' }); renderTex(a, h.tex || '');
      const b = el('div', { class: 'out' + (h.error ? ' err' : '') + (h.done ? ' done' : '') });
      if (h.error) b.textContent = h.error;
      else if (h.table) b.append(this.table(h.table));
      else if (h.printed) { const pre = el('div', { style: { textAlign: 'left', fontFamily: 'var(--mono)', fontSize: '15px', whiteSpace: 'pre-wrap' } }, h.printed.join('\n')); b.append(pre); if (h.out && h.out !== '0') { const s2 = el('div'); renderTex(s2, h.outTex); b.append(s2); } }
      else renderTex(b, h.outTex);
      a.onclick = () => this.select(r, a, h, 'in');
      b.onclick = () => this.select(r, b, h, 'out');
      r.append(a, b);
      // second line: decimal value of an exact answer, relative uncertainty
      if (!h.error && h.dec && S.showDec !== false) { const d = el('div', { class: 'dec' }); renderTex(d, '\\approx ' + (GiacFmt.giacToTex(h.dec, fmtOpts(S)) || h.dec)); r.append(d); }
      if (!h.error && h.unc) { const d = el('div', { class: 'dec' }); renderTex(d, '\\text{relative } \\pm' + (h.unc.v ? +(100 * h.unc.s / Math.abs(h.unc.v)).toPrecision(2) : 0) + '\\%'); r.append(d); }
      if (!h.error && h.unit && !pinned && h === this.history[this.history.length - 1]) {
        const c = el('div', { class: 'uchips' });
        for (const u of Units.alternatives(h.unit.u, h.unit.v).filter((x) => x !== h.unit.u).slice(0, 5)) c.append(el('button', { class: 'chip', text: '→ ' + u, onclick: (e) => { e.stopPropagation(); this.convertTo(h, u); } }));
        c.append(el('button', { class: 'chip', text: 'More…', onclick: (e) => { e.stopPropagation(); this.unitSheet(h); } }));
        r.append(c);
      }
      if (!pinned) this.swipeToDelete(r, h);
      return r;
    }
    /** swipe a history row left to delete it (with Undo) */
    swipeToDelete(r, h) {
      let x0 = null, y0 = 0, dx = 0, on = false;
      r.addEventListener('pointerdown', (e) => {
        const sc = e.target.closest('.in,.out'); if (sc && sc.scrollWidth > sc.clientWidth + 2) return;      // let long formulas scroll
        x0 = e.clientX; y0 = e.clientY; dx = 0; on = false;
      });
      r.addEventListener('pointermove', (e) => {
        if (x0 == null) return; dx = e.clientX - x0;
        if (!on && Math.abs(dx) > 14 && Math.abs(dx) > 2 * Math.abs(e.clientY - y0)) { on = true; try { r.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
        if (on) { r.style.transform = 'translateX(' + Math.min(0, dx) + 'px)'; r.style.opacity = String(Math.max(0.3, 1 + dx / 300)); }
      });
      const end = () => {
        if (x0 == null) return; x0 = null;
        if (on && dx < -100) { r.classList.add('gone'); setTimeout(() => this.remove(h), 160); }
        else { r.style.transform = ''; r.style.opacity = ''; }
        if (on) { r.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true }); }
        on = false;
      };
      r.addEventListener('pointerup', end); r.addEventListener('pointercancel', end);
    }
    remove(h) {
      const i = this.history.indexOf(h); if (i < 0) return;
      this.history.splice(i, 1); this.renderAll(); this.app.saveSoon();
      undoBar('Deleted', () => { this.history.splice(i, 0, h); this.renderAll(); this.app.saveSoon(); });
    }
    async convertTo(h, u) {
      const val = Units.convert(h.unit.v, h.unit.u, u);
      let out = Units.num(val, 12);
      if (/^[A-Za-z]+$/.test(u)) { try { const t = await this.app.cas.eval('evalf(1_' + u + ')'); if (!/ERROR|Error/.test(t)) out = out + '_' + u; } catch (e) { /* plain number */ } }
      const S = this.app.settings;
      const outTex = Units.fmt(val, S.fmt === 'eng' ? 'eng' : S.fmt === 'sci' ? 'sci' : 'plain', Math.max(S.digits, 6)).tex + '\\,' + Units.unitTex(u);
      this.app.lastAns = out;
      this.push({ tex: '\\mathrm{ans}\\blacktriangleright' + Units.unitTex(u), out, outTex, unit: { v: val, u } });
    }
    unitSheet(h) {
      Sheet.open('Convert ' + h.unit.u, (b) => {
        const c = el('div', { class: 'chips', style: { flexWrap: 'wrap' } });
        for (const u of Units.alternatives(h.unit.u, h.unit.v).filter((x) => x !== h.unit.u)) c.append(el('button', { class: 'chip', text: u, onclick: () => { Sheet.close(); this.convertTo(h, u); } }));
        const inp = el('input', { class: 'search', placeholder: 'Any compatible unit, e.g. ' + (Units.alternatives(h.unit.u, h.unit.v)[1] || 'SI'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
        const msg = el('p', { class: 'desc', hidden: true });
        b.append(c, inp, msg, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Convert', onclick: () => { const u = inp.value.trim(); try { Units.convert(1, h.unit.u, u); Sheet.close(); this.convertTo(h, u); } catch (e) { msg.hidden = false; msg.textContent = e.message; } } })));
      });
    }
    uncSheet(h) {
      const U = h.unc;
      Sheet.open('Uncertainty budget', (b) => {
        const head = el('div', { class: 'card', style: { fontSize: '20px' } }); renderTex(head, h.outTex); b.append(head);
        b.append(el('p', { class: 'desc', text: 'First-order propagation of independent uncertainties: σ² = Σ (∂f/∂xᵢ · σᵢ)². Value ' + +U.v.toPrecision(12) + ', σ = ' + +U.s.toPrecision(6) + ' (' + (U.v ? +(100 * U.s / Math.abs(U.v)).toPrecision(3) : 0) + ' % relative).' }));
        const t = el('div', { class: 'unc-tbl' });
        for (const x of ['Input', '∂f/∂x', 'Contribution', 'Share']) t.append(el('b', { text: x }));
        for (const x of U.terms) {
          const c = el('span'); renderTex(c, x.tex);
          const bar = el('span', { class: 'unc-bar' }, el('i', { style: { width: Math.max(1, x.pct).toFixed(1) + '%' } }), el('em', { text: x.pct.toFixed(1) + ' %' }));
          t.append(c, el('span', { class: 'mono', text: String(+x.d.toPrecision(5)) }), el('span', { class: 'mono', text: '±' + +(Math.abs(x.d) * x.s).toPrecision(3) }), bar);
        }
        b.append(t, el('div', { class: 'btnrow' },
          el('button', { class: 'btn', text: 'Use value', onclick: () => { Sheet.close(); this.mf.insert(String(+U.v.toPrecision(12)), { format: 'latex' }); this.mf.focus(); } }),
          el('button', { class: 'btn', text: 'Use value ± σ', onclick: () => { Sheet.close(); this.mf.insert(String(+U.v.toPrecision(12)) + '\\pm' + +U.s.toPrecision(6), { format: 'latex' }); this.mf.focus(); } })));
      });
    }
    exportCSV() {
      const q = (x) => { const s = x == null ? '' : String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const rows = [['#', 'Input', 'Result', 'Decimal', 'Uncertainty', 'Unit', 'Time']];
      this.history.forEach((h, i) => rows.push([i + 1, h.unc ? plainTex(h.tex) : (h.code || h.tex), h.error || (h.table ? h.table.map((r) => r.join('=')).join('; ') : h.out), h.dec || '', h.unc ? h.unc.s : '', h.unit ? h.unit.u : '', h.t ? new Date(h.t).toISOString() : '']));
      UI.download('CAS-history-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
    }
    table(rows) {
      const t = el('table', { class: 'stattable' });
      for (const [k, v] of rows) { const tr = el('tr', {}, el('td', { text: k }), el('td')); renderTex(tr.lastChild, GiacFmt.giacToTex(String(v), { digits: this.app.settings.digits }) || String(v)); t.append(tr); }
      return t;
    }
    scrollEnd() { requestAnimationFrame(() => { this.hist.scrollTop = this.hist.scrollHeight; }); }
    select(row, part, h, which) {
      this.hist.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
      this.hist.querySelectorAll('.pick').forEach((x) => x.classList.remove('pick'));
      row.classList.add('sel'); part.classList.add('pick');
      const p = this.picks; p.innerHTML = ''; p.hidden = false;
      const chip = (label, fn) => p.append(el('button', { class: 'chip', text: label, onclick: () => { fn(); this.unselect(); } }));
      if (which === 'in') chip('Use entry', () => { this.mf.insert(GiacFmt.fixUnitTex(h.tex), { format: 'latex', insertionMode: 'replaceSelection' }); this.mf.focus(); });
      if (which === 'out' && !h.error && !h.table) {
        chip('Use answer', () => { this.mf.insert(h.unc ? String(+h.unc.v.toPrecision(12)) : (GiacFmt.giacToTex(h.out, { digits: 15, editable: true }) || h.out), { format: 'latex' }); this.mf.focus(); });
        if (h.unc) chip('Uncertainty budget', () => this.uncSheet(h));
        if (h.unit) chip('Convert units…', () => this.unitSheet(h));
        if (/x/.test(h.out) && !/[=<>]/.test(h.out) && !h.unit) chip('Graph it', () => this.app.graphExpression(h.out));
        if (!h.unc) chip('Decimal', () => this.runTex(h.tex, true));
      }
      chip(h.pinned ? 'Unpin' : 'Pin', () => { h.pinned = !h.pinned; this.renderAll(); this.app.saveSoon(); toast(h.pinned ? 'Pinned to the top' : 'Unpinned'); });
      chip('Copy text', () => { const t = which === 'in' ? (h.code || h.tex) : (h.unc ? h.unc.v + ' ± ' + h.unc.s : h.out); copy(t); });
      chip('Copy LaTeX', () => copy(which === 'in' ? h.tex : h.outTex));
      chip('Delete', () => this.remove(h));
      chip('Cancel', () => {});
    }
    unselect() { this.picks.hidden = true; this.hist.querySelectorAll('.sel,.pick').forEach((x) => x.classList.remove('sel', 'pick')); }
    ansTex() { return this.app.lastAns != null && this.app.settings.autoAns !== false ? '\\operatorname{ans}' : null; }
    autoAns() { return UI.Edit.autoAns(this.mf, this.ansTex()); }
    recall() { const last = [...this.history].reverse().find((h) => h.tex); if (last) this.mf.value = GiacFmt.fixUnitTex(last.tex); }
    clear() { this.history = this.history.filter((h) => h.pinned); this.renderAll(); this.app.saveSoon(); }

    async enter(approx = false) {
      const tex = this.mf.value.trim();
      if (!tex) return;
      this.unselect();
      await this.runTex(tex, approx);
      this.mf.value = '';
      this.mf.focus();
    }
    async runTex(tex, approx) {
      this.setBusy(true);
      const r = /\\pm/.test(tex) ? await evaluateUnc(this.app, tex) : await evaluate(this.app, tex, { approx });
      if (r.ok && !r.unc && !r.done && !r.printed && r.kind === 'expr') {
        const out = String(r.out);
        r.unit = unitOf(out);
        if (r.unit) { const su = Units.simplifyUnit(r.unit.u); if (su !== r.unit.u) { try { r.unit = { v: Units.convert(r.unit.v, r.unit.u, su || '1'), u: su }; } catch (e) { /* keep Giac's */ } } if (!r.unit.u) { r.unit = null; r.tex = GiacFmt.giacToTex(String(Units.convert(+unitOf(out).v, unitOf(out).u, '1')), fmtOpts(this.app.settings)); } }
        if (r.unit) r.tex = (GiacFmt.giacToTex(String(+r.unit.v.toPrecision(12)), fmtOpts(this.app.settings)) || String(r.unit.v)) + '\\,' + unitTexOf(r.unit.u);
        // an exact numeric answer also gets its decimal value
        if (!r.unit && !approx && !/[.\[_]|e-?\d/.test(out) && !/^-?\d+$/.test(out) && out.length < 400) {
          try { const d = await this.app.cas.eval('evalf(' + out + ')'); if (/^[-+]?\d*\.\d+(e[-+]?\d+)?$/i.test(d) || /^[-+]?[\d.e]+[-+][\d.e]+\*i$/i.test(d)) r.dec = d; } catch (e) { /* none */ }
        }
      }
      this.setBusy(false);
      if (!r.ok && !r.error) return;
      const h = { tex, code: r.code, out: r.out, outTex: r.tex, error: r.ok ? null : r.error, done: r.done, approx, printed: r.printed, dec: r.dec, unc: r.unc, unit: r.unit || undefined, t: Date.now() };
      this.push(h);
    }
    push(h) {
      if (!this.history.length) this.hist.innerHTML = '';
      if (!h.t) h.t = Date.now();
      this.hist.querySelectorAll('.uchips').forEach((x) => x.remove());     // convert chips only on the newest answer
      this.history.push(h);
      this.hist.append(this.rowFor(h));
      this.scrollEnd();
      this.app.saveSoon();
    }
    pushTable(title, tex, rows) { this.push({ tex, table: rows, out: '', outTex: '' }); }
    setBusy(b) { this.busy.hidden = !b; clearTimeout(this._st); if (b) this._st = setTimeout(() => { this.stopBtn.hidden = false; }, 1500); else this.stopBtn.hidden = true; }
  }

  root.Calculator = { CalculatorPage, evaluate };
})(typeof self !== 'undefined' ? self : this);
