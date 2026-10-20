/*
 * data.js — Data & Fit: import measured data (CSV, TSV, OSA, scope and spectrometer exports), plot it with
 * linear or log axes, fit any model with parameter uncertainties, find peaks with FWHM and area, measure
 * statistics in a range, transform columns (smoothing, baselines, dB, unit and spectral conversions) and take FFTs.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, Sheet } = UI;
  const N = () => root.Numeric;

  /** value ± σ with σ to two significant figures and the value to match */
  function fmtPM(v, s) {
    if (!isFinite(v)) return String(v);
    if (!(s > 0) || !isFinite(s)) return fmtNum(v);
    const e = Math.floor(Math.log10(s)) - 1, av = Math.abs(v);
    if (av >= 1e5 || (av < 1e-3 && av > 0) || s >= 1e5) {
      const p = Math.floor(Math.log10(Math.max(av, s))), k = 10 ** p, d = Math.max(0, p - e);
      return '(' + (v / k).toFixed(d) + ' ± ' + (s / k).toFixed(d) + ')e' + p;
    }
    const d = Math.max(0, -e); return v.toFixed(d) + ' ± ' + s.toFixed(d);
  }
  function fmtNum(v, sig = 7) { if (!isFinite(v)) return String(v); if (v === 0) return '0'; const a = Math.abs(v); return a >= 1e6 || a < 1e-4 ? v.toExponential(sig - 1).replace(/\.?0+e/, 'e') : String(+v.toPrecision(sig)); }
  const safeName = (s) => { const t = String(s).replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'c$1'); return t || 'col'; };

  class DataPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'data'; this.noKeypad = true;
      this.cols = (state.cols || []).map((c) => ({ name: c.name, unit: c.unit || '', v: Float64Array.from(c.v || []) }));
      this.x = state.x != null ? state.x : 0; this.y = state.y != null ? state.y : 1; this.s = state.s != null ? state.s : -1;
      this.tab = state.tab || 'fit';
      this.fitS = Object.assign({ preset: 'gauss', model: '', params: [], useView: false, range: null }, state.fit || {});
      this.peakS = Object.assign({ prom: 5, dips: false, sep: '' }, state.peaks || {});
      this.plotS = Object.assign({ logx: false, logy: false, lines: true }, state.plot || {});
      this.result = null;
      this.build();
    }
    get target() { return null; }
    serialize() {
      return { cols: this.cols.map((c) => ({ name: c.name, unit: c.unit, v: Array.from(c.v, (x) => (isFinite(x) ? +x.toPrecision(10) : null)) })), x: this.x, y: this.y, s: this.s, tab: this.tab, fit: { preset: this.fitS.preset, model: this.fitS.model, params: this.fitS.params, useView: this.fitS.useView }, peaks: this.peakS, plot: this.plotS };
    }
    onShow() { setTimeout(() => this.plot && this.plot.draw(), 30); }

    /* ---------------------------------------------------------------- layout */
    build() {
      this.root = el('div', { class: 'page data' });
      const bar = el('div', { class: 'dt-bar' });
      this.fileIn = el('input', { type: 'file', accept: '.csv,.txt,.tsv,.dat,.prn,.asc,.xy,.CSV,.TXT,text/*', hidden: true });
      this.fileIn.onchange = async () => { const f = this.fileIn.files[0]; this.fileIn.value = ''; if (f) this.loadText(await f.text(), f.name); };
      const btn = (t, fn, cls = 'chip') => el('button', { class: cls, text: t, onclick: fn });
      bar.append(btn('Import file…', () => this.fileIn.click()), btn('Paste…', () => this.pasteSheet()), btn('Example', () => this.example()), btn('Columns…', () => this.columnsSheet()), btn('Export CSV', () => this.exportCSV()), this.fileIn);
      this.selRow = el('div', { class: 'dt-sel' });
      this.plot = new Plot({ height: 270, onView: () => { if (this.tab === 'measure') this.renderTab(); } });
      this.rplot = new Plot({ height: 90 }); this.rplot.el.hidden = true;
      const opt = el('div', { class: 'chips dt-opts' });
      const toggle = (label, key) => { const c = el('button', { class: 'chip' + (this.plotS[key] ? ' on' : ''), text: label }); c.onclick = () => { this.plotS[key] = !this.plotS[key]; c.classList.toggle('on', this.plotS[key]); this.redraw(false); this.app.saveSoon(); }; return c; };
      opt.append(btn('Fit view', () => this.plot.fit()), toggle('Log x', 'logx'), toggle('Log y', 'logy'), toggle('Lines', 'lines'));
      this.seg = el('div', { class: 'seg', style: { margin: '8px 0' } });
      for (const [k, l] of [['fit', 'Fit'], ['peaks', 'Peaks'], ['measure', 'Measure'], ['transform', 'Transform'], ['fft', 'FFT'], ['table', 'Table']]) {
        const b = el('button', { text: l, class: this.tab === k ? 'on' : '' }); b.onclick = () => { this.tab = k; this.seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); this.renderTab(); this.app.saveSoon(); }; this.seg.append(b);
      }
      this.body = el('div', { class: 'dt-body' });
      this.empty = el('div', { class: 'desc dt-empty' });
      this.wrap = el('div', { class: 'dt-wrap' }, bar, this.empty, this.selRow, this.plot.el, this.rplot.el, opt, this.seg, this.body);
      this.root.append(this.wrap);
      this.refresh();
    }
    has() { return this.cols.length > 0; }
    refresh() {
      const has = this.has();
      this.empty.hidden = has;
      this.empty.innerHTML = has ? '' : 'Import a CSV or text file (an OSA or spectrometer trace, a scope or power-meter export, a spreadsheet saved as CSV), paste numbers, or try the example. Comma, tab, semicolon and space-separated files work, with or without a header.';
      for (const n of [this.selRow, this.plot.el, this.seg, this.body, this.wrap.querySelector('.dt-opts')]) n.hidden = !has;
      if (!has) { this.rplot.el.hidden = true; return; }
      this.x = Math.min(this.x, this.cols.length - 1); this.y = Math.min(this.y, this.cols.length - 1); if (this.s >= this.cols.length) this.s = -1;
      this.renderSel(); this.redraw(true); this.renderTab();
    }
    renderSel() {
      this.selRow.innerHTML = '';
      const sel = (label, key, none) => {
        const s = el('select', { class: 'search cv-in', 'aria-label': label });
        if (none) s.append(el('option', { value: '-1', text: 'none' }));
        this.cols.forEach((c, i) => s.append(el('option', { value: String(i), text: c.name + (c.unit && !c.name.includes(c.unit) ? ' (' + c.unit + ')' : ''), selected: this[key] === i })));
        if (none && this[key] < 0) s.value = '-1';
        s.onchange = () => { this[key] = +s.value; this.result = null; this.redraw(true); this.renderTab(); this.app.saveSoon(); };
        return el('label', { class: 'cv-lab' }, el('span', { text: label }), s);
      };
      this.selRow.append(sel('x', 'x'), sel('y', 'y'), sel('σ of y', 's', true));
    }
    /** x, y (and σ) for rows where all are numbers, sorted by x */
    xy(rangeOnly) {
      const X = this.cols[this.x].v, Y = this.cols[this.y].v, S = this.s >= 0 ? this.cols[this.s].v : null;
      const [lo, hi] = rangeOnly ? this.plot.xRange() : [-Infinity, Infinity];
      const idx = []; for (let i = 0; i < Math.min(X.length, Y.length); i++) if (isFinite(X[i]) && isFinite(Y[i]) && X[i] >= Math.min(lo, hi) && X[i] <= Math.max(lo, hi) && (!S || S[i] > 0)) idx.push(i);
      idx.sort((a, b) => X[a] - X[b]);
      return { xs: Float64Array.from(idx, (i) => X[i]), ys: Float64Array.from(idx, (i) => Y[i]), sig: S ? Float64Array.from(idx, (i) => S[i]) : null, idx };
    }
    label(i) { const c = this.cols[i]; return c ? c.name + (c.unit && !c.name.includes(c.unit) ? ' (' + c.unit + ')' : '') : ''; }
    redraw(refit) {
      if (!this.has()) return;
      const d = this.xy(false);
      this.plot.opts.xlabel = this.label(this.x); this.plot.opts.ylabel = this.label(this.y);
      this.plot.logx = this.plotS.logx; this.plot.logy = this.plotS.logy;
      const series = [{ xs: d.xs, ys: d.ys, mode: this.plotS.lines && d.xs.length > 1 ? 'line' : 'points', color: '--g1', label: this.cols[this.y].name }];
      const R = this.result;
      if (R && R.curve) series.push({ xs: R.curve.xs, ys: R.curve.ys, mode: 'line', color: '--g2', width: 2, label: 'fit', noFit: true });
      this.plot.marks = (this.peakList || []).map((p, k) => ({ x: p.x, color: 'var(--g3)', label: String(k + 1) })).map((m) => ({ ...m, color: getComputedStyle(document.documentElement).getPropertyValue('--g3').trim() }));
      if (refit) { this.plot.series = series.filter((s) => s.xs.length); this.plot.fit(); } else this.plot.set(series, true);
      if (refit && this.fitS.useView && this.fitS.range) { /* keep the whole view on a new dataset */ }
      if (R && R.resid) { this.rplot.el.hidden = false; this.rplot.opts.ylabel = 'residual'; this.rplot.logx = this.plotS.logx; this.rplot.set([{ xs: R.rx, ys: R.resid, mode: 'points', color: '--g2', r: 1.6 }, { xs: [R.rx[0], R.rx[R.rx.length - 1]], ys: [0, 0], mode: 'line', color: '--ink3', width: 1 }]); }
      else this.rplot.el.hidden = true;
    }

    /* ---------------------------------------------------------------- loading data */
    loadText(text, name) {
      let t; try { t = N().parseTable(text); } catch (e) { toast(e.message, 4000); return; }
      this.cols = t.names.map((n, i) => ({ name: n, unit: N().unitFromName(n), v: t.cols[i] }));
      this.x = 0; this.y = Math.min(1, this.cols.length - 1); this.s = -1; this.result = null; this.peakList = null;
      if (this.cols.length === 1) { this.cols.unshift({ name: 'index', unit: '', v: Float64Array.from(this.cols[0].v, (_, i) => i) }); this.y = 1; }
      this.refresh(); this.app.saveSoon();
      toast((name ? name + ': ' : '') + t.cols[0].length + ' rows × ' + t.cols.length + ' columns' + (t.skipped ? ' · ' + t.skipped + ' header lines skipped' : '') + (t.decComma ? ' · decimal commas' : ''), 4500);
    }
    pasteSheet() {
      Sheet.open('Paste data', (b) => {
        const ta = el('textarea', { class: 'search mono', rows: 10, placeholder: 'x, y\n1549.00, -60.1\n1549.01, -59.9\n…', style: { width: '100%', minHeight: '180px', fontSize: '14px' } });
        b.append(el('p', { class: 'desc', text: 'Paste columns of numbers copied from a spreadsheet, a file or an instrument. A first line with names is used for the column names.' }), ta,
          el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Use these numbers', onclick: () => { Sheet.close(); this.loadText(ta.value, ''); } })));
        setTimeout(() => ta.focus(), 60);
      });
    }
    example() {
      // a DFB laser line on an OSA: Lorentzian with a noise floor, in dBm
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
      const xs = [], ys = [];
      for (let i = 0; i <= 600; i++) { const x = 1549.4 + i * 0.002; const mw = 0.8 / (1 + 4 * ((x - 1550.0) / 0.02) ** 2) + 2e-6 * (1 + 0.3 * rnd()); xs.push(+x.toFixed(4)); ys.push(+(10 * Math.log10(mw)).toFixed(3)); }
      this.cols = [{ name: 'Wavelength(nm)', unit: 'nm', v: Float64Array.from(xs) }, { name: 'Level(dBm)', unit: 'dBm', v: Float64Array.from(ys) }];
      this.x = 0; this.y = 1; this.s = -1; this.result = null; this.peakList = null; this.refresh(); this.app.saveSoon();
      toast('Example: a laser line on an OSA, 601 points in dBm. Try Transform → dBm to mW, then Fit → Lorentzian.', 6000);
    }
    exportCSV() { if (!this.has()) return; UI.download ? UI.download('CalcShelf-data.csv', N().toCSV(this.cols.map((c) => c.name), this.cols.map((c) => c.v)), 'text/csv') : toast('Export is not available here'); }
    addCol(name, unit, v, asWhat = 'y') {
      const names = this.cols.map((c) => c.name); let nm = name, k = 2; while (names.includes(nm)) nm = name + ' ' + k++;
      this.cols.push({ name: nm, unit: unit || '', v: v instanceof Float64Array ? v : Float64Array.from(v) });
      if (asWhat === 'y') this.y = this.cols.length - 1; else if (asWhat === 'x') this.x = this.cols.length - 1;
      this.result = null; this.peakList = null; this.renderSel(); this.redraw(true); this.renderTab(); this.app.saveSoon();
      return this.cols.length - 1;
    }
    /** a new column built from the current x/y rows (values placed back in their original rows) */
    colFrom(d, vals) { const out = new Float64Array(this.cols[this.x].v.length).fill(NaN); d.idx.forEach((i, k) => { out[i] = vals[k]; }); return out; }
    columnsSheet() {
      Sheet.open('Columns', (b) => {
        b.append(el('p', { class: 'desc', text: 'Rename a column, give it a unit (used for unit conversions and labels), or delete it.' }));
        const L = el('div'); b.append(L);
        const draw = () => {
          L.innerHTML = '';
          this.cols.forEach((c, i) => {
            const n = el('input', { class: 'search', value: c.name, 'aria-label': 'Name of column ' + (i + 1) }), u = el('input', { class: 'search', value: c.unit, placeholder: 'unit', 'aria-label': 'Unit of column ' + (i + 1), style: { maxWidth: '110px' } });
            n.onchange = () => { c.name = n.value.trim() || c.name; this.renderSel(); this.redraw(false); this.app.saveSoon(); };
            u.onchange = () => { c.unit = u.value.trim(); this.renderSel(); this.redraw(false); this.app.saveSoon(); };
            L.append(el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '6px 0' } }, el('span', { class: 'sub', text: String(i + 1), style: { width: '18px' } }), n, u, el('span', { class: 'sub', text: c.v.length + ' rows', style: { minWidth: '62px' } }), el('button', { class: 'chip', text: 'Delete', onclick: () => { this.cols.splice(i, 1); if (this.x >= this.cols.length) this.x = 0; if (this.y >= this.cols.length) this.y = Math.min(1, this.cols.length - 1); if (this.s >= this.cols.length) this.s = -1; this.result = null; this.refresh(); this.app.saveSoon(); draw(); } })));
          });
        };
        draw();
        b.append(el('div', { class: 'btnrow' },
          el('button', { class: 'btn', text: 'Store x and y as CAS lists', onclick: () => this.toCAS() }),
          el('button', { class: 'btn', text: 'Send x and y to Lists', onclick: () => this.toLists() })));
      });
    }
    async toCAS() {
      const d = this.xy(false), nx = safeName(this.cols[this.x].name), ny = safeName(this.cols[this.y].name) === nx ? nx + '2' : safeName(this.cols[this.y].name);
      for (const [n, v] of [[nx, d.xs], [ny, d.ys]]) { const code = n + ':=[' + Array.from(v, (x) => +x.toPrecision(12)).join(',') + ']'; await this.app.cas.eval(code); this.app.cas.forget(n); this.app.cas.remember(code); this.app.vars.add(n); }
      this.app.saveSoon(); toast('Stored ' + nx + ' and ' + ny + ' (' + d.xs.length + ' values each)');
    }
    toLists() {
      const d = this.xy(false); const max = 999; let li = this.app.pages.findIndex((p) => p.kind === 'lists');
      if (li < 0) { this.app.addPage('lists'); li = this.app.pages.length - 1; }
      const L = this.app.pages[li]; L.importColumns([[safeName(this.cols[this.x].name), Array.from(d.xs.slice(0, max))], [safeName(this.cols[this.y].name), Array.from(d.ys.slice(0, max))]]);
      this.app.select(li); if (d.xs.length > max) toast('Lists hold 999 rows: sent the first 999 of ' + d.xs.length);
    }

    /* ---------------------------------------------------------------- tabs */
    renderTab() { if (!this.has()) return; this.body.innerHTML = ''; this['tab_' + this.tab](this.body); }

    tab_fit(b) {
      const S = this.fitS, P = N().PRESETS;
      const pre = el('select', { class: 'search cv-in', 'aria-label': 'Model' }, [...P.map((p) => el('option', { value: p[0], text: p[1], selected: S.preset === p[0] })), el('option', { value: 'custom', text: 'Your own model…', selected: S.preset === 'custom' })]);
      const model = el('input', { class: 'search mono', value: S.model || (P.find((p) => p[0] === S.preset) || P[4])[2], autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Model y =' });
      const ptab = el('div', { class: 'dt-params' });
      const out = el('div');
      const syncParams = (guess) => {
        let names; try { names = N().modelParams(model.value); } catch (e) { names = []; }
        const old = Object.fromEntries((S.params || []).map((p) => [p.n, p]));
        let g = null;
        if (guess) { const p = P.find((q) => q[0] === S.preset); const d = this.xy(S.useView); if (p && d.xs.length > 2 && p[3].join() === names.join()) { try { g = p[4](d.xs, d.ys); } catch (e) { g = null; } } }
        S.params = names.map((n, k) => ({ n, v: g ? +(+g[k]).toPrecision(8) : old[n] ? old[n].v : 1, fixed: old[n] ? !!old[n].fixed : false }));
        drawParams();
      };
      const drawParams = () => {
        ptab.innerHTML = '';
        ptab.append(el('b', { text: 'Parameter' }), el('b', { text: 'Start' }), el('b', { text: 'Fixed' }), el('b', { text: 'Result' }));
        const R = this.result;
        S.params.forEach((p, k) => {
          const v = el('input', { class: 'search mono', value: String(p.v), inputmode: 'decimal', 'aria-label': 'Start value of ' + p.n });
          v.onchange = () => { const x = root.evalNum ? root.evalNum(v.value) : +v.value; if (isFinite(x)) p.v = x; this.app.saveSoon(); };
          const fx = el('input', { type: 'checkbox', checked: p.fixed, 'aria-label': 'Fix ' + p.n }); fx.onchange = () => { p.fixed = fx.checked; this.app.saveSoon(); };
          const res = R && R.names && R.names[k] === p.n ? fmtPM(R.p[k], R.sd[k]) + (R.sd[k] && R.p[k] ? '  (' + +(100 * R.sd[k] / Math.abs(R.p[k])).toPrecision(2) + ' %)' : '') : '';
          ptab.append(el('span', { class: 'mono', text: p.n }), v, fx, el('span', { class: 'mono dt-res', text: res }));
        });
      };
      pre.onchange = () => { S.preset = pre.value; if (pre.value !== 'custom') { model.value = P.find((p) => p[0] === pre.value)[2]; } S.model = model.value; this.result = null; syncParams(true); this.redraw(false); this.app.saveSoon(); };
      model.onchange = () => { S.model = model.value; S.preset = (P.find((p) => p[2] === model.value) || ['custom'])[0]; pre.value = S.preset; syncParams(false); this.app.saveSoon(); };
      const range = el('div', { class: 'chips' });
      const rAll = el('button', { class: 'chip' + (!S.useView ? ' on' : ''), text: 'Fit all points' }), rView = el('button', { class: 'chip' + (S.useView ? ' on' : ''), text: 'Fit the points in view' });
      rAll.onclick = () => { S.useView = false; rAll.classList.add('on'); rView.classList.remove('on'); this.app.saveSoon(); };
      rView.onclick = () => { S.useView = true; rView.classList.add('on'); rAll.classList.remove('on'); this.app.saveSoon(); };
      range.append(rAll, rView);
      b.append(el('label', { class: 'cv-lab' }, el('span', { text: 'Model' }), pre), el('label', { class: 'cv-lab', style: { marginTop: '6px' } }, el('span', { text: 'y = (in terms of x; every other name is a parameter)' }), model), range, ptab,
        el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Starting values from the data', onclick: () => syncParams(true) }), el('button', { class: 'btn pri', text: 'Fit', onclick: () => this.runFit(model.value, out, drawParams) })), out);
      if (!S.model) S.model = model.value;
      if (!S.params || !S.params.length) syncParams(true); else drawParams();
      if (this.result) this.showFit(out);
    }
    runFit(src, out, drawParams) {
      const S = this.fitS; S.model = src;
      const names = S.params.map((p) => p.n);
      let f;
      try { const code = Units.toGiac ? src : src; const fn = GiacFmt.compile(code, ['x', ...names]); f = (x, p) => fn(x, ...p); f(1, S.params.map((p) => p.v)); }
      catch (e) { out.innerHTML = ''; out.append(el('p', { class: 'desc err', text: 'The model can’t be read: ' + e.message + '. Write it with x, numbers and parameter names, for example A*exp(-x/tau)+c.' })); return; }
      const d = this.xy(S.useView);
      try {
        const t0 = performance.now();
        const r = N().fit(f, d.xs, d.ys, S.params.map((p) => p.v), { fixed: S.params.map((p) => p.fixed), sigma: d.sig });
        r.ms = performance.now() - t0; r.names = names; r.n = d.xs.length; r.withSigma = !!d.sig;
        // smooth curve over the fitted range, and residuals
        const lo = d.xs[0], hi = d.xs[d.xs.length - 1], M = Math.min(2000, Math.max(400, d.xs.length * 2)), cx = new Float64Array(M), cy = new Float64Array(M);
        for (let k = 0; k < M; k++) { cx[k] = lo + (hi - lo) * k / (M - 1); cy[k] = f(cx[k], r.p); }
        r.curve = { xs: cx, ys: cy }; r.rx = d.xs;
        this.result = r;
      } catch (e) { this.result = null; out.innerHTML = ''; out.append(el('p', { class: 'desc err', text: e.message })); this.redraw(false); return; }
      drawParams(); this.showFit(out); this.redraw(false);
    }
    showFit(out) {
      const R = this.result; out.innerHTML = ''; if (!R) return;
      const card = el('div', { class: 'card dt-card' });
      const line = (k, v) => card.append(el('div', { class: 'dt-kv' }, el('span', { text: k }), el('span', { class: 'mono', text: v })));
      R.names.forEach((n, k) => line(n, fmtPM(R.p[k], R.sd[k])));
      line('points / free parameters', R.n + ' / ' + (R.n - R.dof));
      line(R.withSigma ? 'χ² / reduced χ²' : 'Σ residual² / per degree of freedom', fmtNum(R.chi2, 5) + ' / ' + fmtNum(R.redchi2, 5));
      line('R²', R.r2 > 0.9999 ? (1 - R.r2).toExponential(2).replace(/^/, '1 − ') : fmtNum(R.r2, 6));
      line('RMS residual', fmtNum(R.rms, 4));
      line('iterations', R.iter + (R.converged ? '' : ' (not converged: try other starting values)') + ' · ' + R.ms.toFixed(0) + ' ms');
      // strongly correlated parameters make the individual errors meaningless
      const warn = []; for (let a = 0; a < R.p.length; a++) for (let c = a + 1; c < R.p.length; c++) { const s = R.sd[a] * R.sd[c]; if (s > 0 && Math.abs(R.cov[a][c] / s) > 0.98) warn.push(R.names[a] + '–' + R.names[c] + ' ' + (R.cov[a][c] / s).toFixed(3)); }
      out.append(card, el('p', { class: 'desc', text: (R.withSigma ? 'Uncertainties from the σ column (1 σ).' : 'Uncertainties are 1 σ, scaled by the scatter of the residuals (no σ column chosen).') + (warn.length ? ' Strongly correlated: ' + warn.join(', ') + '.' : '') + (R.singular ? ' The fit is degenerate: some parameters are not determined by the data.' : '') }));
      out.append(el('div', { class: 'btnrow' },
        el('button', { class: 'btn', text: 'Store in the CAS', onclick: () => this.storeFit() }),
        el('button', { class: 'btn', text: 'Copy', onclick: () => { const t = R.names.map((n, k) => n + ' = ' + fmtPM(R.p[k], R.sd[k])).join('\n') + '\nreduced chi2 = ' + fmtNum(R.redchi2, 5) + '\nR2 = ' + fmtNum(R.r2, 8); try { navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { toast(t); } } }),
        el('button', { class: 'btn', text: 'Add fit and residual columns', onclick: () => { const d = this.xy(this.fitS.useView); const fn = GiacFmt.compile(this.fitS.model, ['x', ...R.names]); const fy = Array.from(d.xs, (x) => fn(x, ...R.p)); this.addCol('fit', this.cols[this.y].unit, this.colFrom(d, fy), null); this.addCol('residual', this.cols[this.y].unit, this.colFrom(d, Array.from(d.ys, (y, k) => y - fy[k])), null); toast('Added the columns fit and residual'); } })));
    }
    async storeFit() {
      const R = this.result; if (!R) return; const set = [];
      R.names.forEach((n, k) => { if (/^[A-Za-z]\w*$/.test(n)) { set.push(n + ':=' + +R.p[k].toPrecision(15), n + '_sd:=' + +R.sd[k].toPrecision(6)); } });
      for (const c of set) { await this.app.cas.eval(c); const nm = c.split(':=')[0]; this.app.cas.forget(nm); this.app.cas.remember(c); this.app.vars.add(nm); }
      this.app.saveSoon(); toast('Stored ' + R.names.join(', ') + ' and their σ as …_sd');
    }

    tab_peaks(b) {
      const S = this.peakS;
      const prom = el('input', { class: 'search cv-in', value: String(S.prom), inputmode: 'decimal', 'aria-label': 'Minimum prominence %' });
      const sep = el('input', { class: 'search cv-in', value: String(S.sep || ''), inputmode: 'decimal', placeholder: 'none', 'aria-label': 'Minimum separation' });
      const dips = el('button', { class: 'chip' + (S.dips ? ' on' : ''), text: 'Find dips instead' });
      const out = el('div');
      const run = () => {
        S.prom = +prom.value || 5; S.sep = sep.value; this.app.saveSoon();
        const d = this.xy(false);
        this.peakList = N().peaks(d.xs, d.ys, { prominence: S.prom / 100, dips: S.dips, minSep: +S.sep || 0 });
        this.redraw(false);
        out.innerHTML = '';
        if (!this.peakList.length) { out.append(el('p', { class: 'desc', text: 'No peaks above ' + S.prom + ' % of the full range. Lower the prominence.' })); return; }
        const xu = this.cols[this.x].unit, t = el('div', { class: 'dt-tbl', style: { gridTemplateColumns: 'auto repeat(4, minmax(0,1fr)) auto' } });
        for (const h of ['#', 'x', 'y', 'FWHM', 'area', '']) t.append(el('b', { text: h }));
        this.peakList.forEach((p, k) => t.append(el('span', { text: String(k + 1) }), el('span', { class: 'mono', text: fmtNum(p.x, 8) }), el('span', { class: 'mono', text: fmtNum(p.y, 5) }), el('span', { class: 'mono', text: fmtNum(p.fwhm, 4) }), el('span', { class: 'mono', text: fmtNum(p.area, 4) }),
          el('button', { class: 'chip', text: 'Fit', onclick: () => this.fitPeak(p) })));
        out.append(t, el('p', { class: 'desc', text: 'x is refined between samples. FWHM is the full width at half the peak’s height above its base' + (xu ? ' (in ' + xu + ')' : '') + '; area is above that base. For a peak in dB, convert to linear first (Transform).' }));
      };
      dips.onclick = () => { S.dips = !S.dips; dips.classList.toggle('on', S.dips); run(); };
      b.append(el('div', { class: 'cv-units' }, el('label', { class: 'cv-lab' }, el('span', { text: 'Minimum prominence (% of range)' }), prom), el('label', { class: 'cv-lab' }, el('span', { text: 'Minimum separation (in x)' }), sep)), el('div', { class: 'chips' }, dips), el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Find peaks', onclick: run })), out);
      run();
    }
    fitPeak(p) {
      const w = p.fwhm || (p.xr - p.xl) || 1;
      this.plot.view.x0 = this.plot.tx(p.x - 4 * w); this.plot.view.x1 = this.plot.tx(p.x + 4 * w); this.plot.draw();
      this.fitS.useView = true; if (!['gauss', 'lorentz', 'voigt', 'sinc2', 'sech2'].includes(this.fitS.preset)) { this.fitS.preset = 'gauss'; this.fitS.model = N().PRESETS.find((q) => q[0] === 'gauss')[2]; }
      this.fitS.params = [];
      this.tab = 'fit'; this.seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.textContent === 'Fit')); this.renderTab();
    }

    tab_measure(b) {
      const d = this.xy(true); const [lo, hi] = this.plot.xRange();
      if (d.xs.length < 2) { b.append(el('p', { class: 'desc', text: 'Fewer than two points in view. Zoom out or tap Fit view.' })); return; }
      const st = N().stats(d.ys), Ar = N().area(d.xs, d.ys);
      let m1 = 0, m2 = 0; for (let i = 0; i < d.xs.length - 1; i++) { const dx = d.xs[i + 1] - d.xs[i], h = (d.ys[i] + d.ys[i + 1]) / 2, xm = (d.xs[i] + d.xs[i + 1]) / 2; m1 += dx * h * xm; m2 += dx * h * xm * xm; }
      const cen = m1 / Ar, rmsw = Math.sqrt(Math.max(0, m2 / Ar - cen * cen));
      let iM = 0, im = 0; d.ys.forEach((v, i) => { if (v > d.ys[iM]) iM = i; if (v < d.ys[im]) im = i; });
      const card = el('div', { class: 'card dt-card' }); const line = (k, v) => card.append(el('div', { class: 'dt-kv' }, el('span', { text: k }), el('span', { class: 'mono', text: v })));
      line('x range in view', fmtNum(Math.min(lo, hi), 8) + ' … ' + fmtNum(Math.max(lo, hi), 8));
      line('points', String(st.n));
      line('maximum (at x)', fmtNum(st.max, 6) + '  (' + fmtNum(d.xs[iM], 8) + ')');
      line('minimum (at x)', fmtNum(st.min, 6) + '  (' + fmtNum(d.xs[im], 8) + ')');
      line('mean ± SD', fmtNum(st.mean, 6) + ' ± ' + fmtNum(st.sd, 4));
      line('SEM · median', fmtNum(st.sem, 4) + ' · ' + fmtNum(st.median, 6));
      line('∫ y dx (trapezoid)', fmtNum(Ar, 7));
      line('centroid ∫xy/∫y · RMS width', fmtNum(cen, 8) + ' · ' + fmtNum(rmsw, 5));
      const pk = N().peaks(d.xs, d.ys, { prominence: 0.3, max: 1 })[0];
      if (pk) line('main peak: FWHM', fmtNum(pk.fwhm, 6));
      b.append(el('p', { class: 'desc', text: 'For the points in view. Pan or pinch the plot to choose the range; these update when you let go.' }), card);
    }

    tab_transform(b) {
      const yc = this.cols[this.y], xc = this.cols[this.x];
      const L = el('ul', { class: 'mlist' }); b.append(L);
      const item = (label, sub, fn) => L.append(el('li', {}, el('button', { class: 'mi', onclick: fn }, el('span', { class: 'lbl', text: label }), sub ? el('span', { class: 'sub', text: sub }) : null)));
      const ask = (title, fields, go) => Sheet.open(title, (bb) => {
        const ins = fields.map(([label, val, opts]) => { const i = opts ? el('select', { class: 'search cv-in' }, opts.map(([v, t]) => el('option', { value: v, text: t, selected: v === val }))) : el('input', { class: 'search cv-in', value: val, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }); bb.append(el('label', { class: 'cv-lab', style: { margin: '6px 0' } }, el('span', { text: label }), i)); return i; });
        const msg = el('p', { class: 'desc err', hidden: true });
        bb.append(msg, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Make the new column', onclick: () => { try { go(ins.map((i) => i.value)); Sheet.close(); } catch (e) { msg.hidden = false; msg.textContent = e.message; } } })));
      });
      const d = () => this.xy(false);
      item('Smooth (Savitzky–Golay)', 'Keeps peak heights better than a moving average', () => ask('Smooth ' + yc.name, [['Window (odd number of points)', '11'], ['Polynomial order', '2']], ([w, o]) => { const D = d(); this.addCol(yc.name + ' smoothed', yc.unit, this.colFrom(D, N().savgol(D.ys, +w || 11, +o || 2))); }));
      item('Moving average', '', () => ask('Moving average of ' + yc.name, [['Window (points)', '5']], ([w]) => { const D = d(); this.addCol(yc.name + ' averaged', yc.unit, this.colFrom(D, N().movingAverage(D.ys, +w || 5))); }));
      item('Derivative dy/dx', 'Savitzky–Golay, so noise isn’t amplified as much', () => ask('Derivative of ' + yc.name, [['Window (odd number of points)', '7']], ([w]) => { const D = d(); const dx = (D.xs[D.xs.length - 1] - D.xs[0]) / (D.xs.length - 1); const v = N().uniform(D.xs) ? N().savgol(D.ys, +w || 7, 2, 1, dx) : N().derivative(D.xs, D.ys); this.addCol('d(' + yc.name + ')/dx', '', this.colFrom(D, v)); }));
      item('Subtract a baseline', 'Polynomial that follows the bottom of the data', () => ask('Baseline under ' + yc.name, [['Polynomial order', '1', [['0', '0 (constant)'], ['1', '1 (straight line)'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]], ['Data', 'peaks', [['peaks', 'has peaks (baseline below)'], ['dips', 'has dips (baseline above)']]]], ([o, kind]) => { const D = d(); const bl = N().baseline(D.xs, D.ys, +o, { top: kind === 'dips' }); this.addCol('baseline', yc.unit, this.colFrom(D, bl), null); this.addCol(yc.name + ' − baseline', yc.unit, this.colFrom(D, Array.from(D.ys, (y, k) => y - bl[k]))); }));
      item('Normalise', 'Peak to 1, area to 1, or range to 0…1', () => ask('Normalise ' + yc.name, [['How', 'max', [['max', 'Maximum = 1'], ['area', 'Area = 1'], ['range', 'Minimum 0, maximum 1']]]], ([h]) => { const D = d(); const st = N().stats(D.ys); const A = N().area(D.xs, D.ys); const v = Array.from(D.ys, (y) => (h === 'max' ? y / st.max : h === 'area' ? y / A : (y - st.min) / (st.max - st.min))); this.addCol(yc.name + ' normalised', '', this.colFrom(D, v)); }));
      item('dB ↔ linear', 'dBm → mW, mW → dBm, dB → ratio, ratio → dB', () => ask('Convert ' + yc.name, [['Conversion', /dB/i.test(yc.name + yc.unit) ? 'dbm2mw' : 'mw2dbm', [['dbm2mw', 'dBm → mW'], ['dbm2w', 'dBm → W'], ['mw2dbm', 'mW → dBm'], ['w2dbm', 'W → dBm'], ['db2r', 'dB → power ratio'], ['r2db', 'power ratio → dB'], ['db2a', 'dB → amplitude ratio']]]], ([h]) => {
        const D = d(); const f = { dbm2mw: (y) => 10 ** (y / 10), dbm2w: (y) => 10 ** (y / 10 - 3), mw2dbm: (y) => 10 * Math.log10(y), w2dbm: (y) => 10 * Math.log10(y) + 30, db2r: (y) => 10 ** (y / 10), r2db: (y) => 10 * Math.log10(y), db2a: (y) => 10 ** (y / 20) }[h];
        const unit = { dbm2mw: 'mW', dbm2w: 'W', mw2dbm: 'dBm', w2dbm: 'dBm', db2r: '', r2db: 'dB', db2a: '' }[h];
        this.addCol(yc.name.replace(/\s*[([].*?[)\]]\s*$/, '') + (unit ? ' (' + unit + ')' : ' ratio'), unit, this.colFrom(D, Array.from(D.ys, f)));
      }));
      item('Convert the x unit', 'Including wavelength ↔ frequency ↔ wavenumber ↔ photon energy', () => ask('Convert ' + xc.name, [['From unit', xc.unit || 'nm'], ['To unit', /m$/.test(xc.unit) ? 'THz' : 'nm']], ([fu, tu]) => {
        const X = xc.v; const kf = Units.specKind(fu), kt = Units.specKind(tu);
        let fn;
        if (Units.compatible(fu, tu)) fn = (x) => Units.convert(x, fu, tu);
        else if (kf && kt) fn = (x) => { const Ej = Units.SPEC[kf](Units.convert(x, fu, Units.SPEC_UNITS[kf])); return Units.convert(Units.SPEC_INV[kt](Ej), Units.SPEC_UNITS[kt], tu); };
        else throw new Error('Can’t convert ' + fu + ' to ' + tu);
        this.addCol(tu === 'THz' || kt === 'freq' ? 'Frequency (' + tu + ')' : kt === 'wavelength' ? 'Wavelength (' + tu + ')' : kt === 'wavenumber' ? 'Wavenumber (' + tu + ')' : kt === 'energy' ? 'Photon energy (' + tu + ')' : xc.name + ' (' + tu + ')', tu, Float64Array.from(X, fn), 'x');
      }));
      item('Column from an expression', 'In terms of x, y and the other column names', () => {
        const names = this.cols.map((c) => safeName(c.name));
        ask('New column', [['Expression (Giac syntax)', 'y*1000'], ['Name', 'new']], ([ex, nm]) => {
          const vars = ['x', 'y', ...names.filter((n) => n !== 'x' && n !== 'y')];
          const fn = GiacFmt.compile(ex, vars);
          const n = this.cols[this.x].v.length, out = new Float64Array(n);
          for (let i = 0; i < n; i++) out[i] = fn(this.cols[this.x].v[i], this.cols[this.y].v[i], ...vars.slice(2).map((v) => this.cols[names.indexOf(v)].v[i]));
          this.addCol(nm || 'new', '', out);
        });
      });
      item('Keep only the rows in view', 'Crops every column to the x range on the plot', () => {
        const [lo, hi] = this.plot.xRange(), X = this.cols[this.x].v, keep = []; for (let i = 0; i < X.length; i++) if (X[i] >= Math.min(lo, hi) && X[i] <= Math.max(lo, hi)) keep.push(i);
        if (!keep.length) { toast('No rows in view'); return; }
        const before = this.cols.map((c) => c.v); this.cols.forEach((c) => { c.v = Float64Array.from(keep, (i) => c.v[i]); });
        this.result = null; this.refresh(); this.app.saveSoon();
        UI.undoBar ? UI.undoBar('Kept ' + keep.length + ' rows', () => { this.cols.forEach((c, k) => { c.v = before[k]; }); this.refresh(); }) : toast('Kept ' + keep.length + ' rows');
      });
      item('Sort by x', '', () => { const X = this.cols[this.x].v, ord = Array.from(X, (_, i) => i).sort((a, b) => X[a] - X[b]); this.cols.forEach((c) => { c.v = Float64Array.from(ord, (i) => c.v[i]); }); this.refresh(); this.app.saveSoon(); });
    }

    tab_fft(b) {
      this.fftS = this.fftS || { window: 'hann', pad: false, out: 'amp' };
      const S = this.fftS;
      const w = el('select', { class: 'search cv-in' }, [['hann', 'Hann'], ['hamming', 'Hamming'], ['blackman', 'Blackman'], ['flattop', 'Flat top (amplitudes)'], ['none', 'None (rectangular)']].map(([v, t]) => el('option', { value: v, text: t, selected: S.window === v })));
      const o = el('select', { class: 'search cv-in' }, [['amp', 'Amplitude'], ['psd', 'Power spectral density'], ['db', 'Amplitude in dB'], ['phase', 'Phase']].map(([v, t]) => el('option', { value: v, text: t, selected: S.out === v })));
      const pad = el('button', { class: 'chip' + (S.pad ? ' on' : ''), text: 'Zero-pad ×2' }); pad.onclick = () => { S.pad = !S.pad; pad.classList.toggle('on', S.pad); };
      const out = el('div');
      const run = () => {
        S.window = w.value; S.out = o.value;
        const D = this.xy(false); if (D.xs.length < 8) { toast('Need at least 8 points'); return; }
        const sp = N().spectrum(D.xs, D.ys, { window: S.window, pad: S.pad });
        const xu = this.cols[this.x].unit, fu = xu ? (xu === 's' ? 'Hz' : xu === 'ms' ? 'kHz' : xu === 'µs' || xu === 'us' ? 'MHz' : xu === 'ns' ? 'GHz' : xu === 'ps' ? 'THz' : '1/' + xu) : '';
        const val = S.out === 'amp' ? sp.amp : S.out === 'psd' ? sp.psd : S.out === 'db' ? Float64Array.from(sp.amp, (a) => 20 * Math.log10(a)) : sp.phase;
        let k = 1; for (let i = 2; i < sp.amp.length; i++) if (sp.amp[i] > sp.amp[k]) k = i;
        this.cols.push({ name: 'frequency' + (fu ? ' (' + fu + ')' : ''), unit: fu, v: sp.f });
        this.cols.push({ name: { amp: '|Y|', psd: 'PSD', db: '|Y| (dB)', phase: 'phase (rad)' }[S.out] + ' of ' + this.cols[this.y].name, unit: '', v: val });
        this.x = this.cols.length - 2; this.y = this.cols.length - 1; this.result = null; this.peakList = null;
        this.renderSel(); this.redraw(true); this.app.saveSoon();
        out.innerHTML = '';
        out.append(el('div', { class: 'card dt-card' }, ...[['strongest component', fmtNum(sp.f[k], 7) + (fu ? ' ' + fu : '') + ',  amplitude ' + fmtNum(sp.amp[k], 5)], ['frequency step Δf', fmtNum(sp.df, 6) + (fu ? ' ' + fu : '')], ['samples → FFT length', sp.n + ' → ' + sp.N], ['Nyquist frequency', fmtNum(sp.f[sp.f.length - 1], 6) + (fu ? ' ' + fu : '')]].map(([k2, v]) => el('div', { class: 'dt-kv' }, el('span', { text: k2 }), el('span', { class: 'mono', text: v })))),
          el('p', { class: 'desc', text: (sp.resampled ? 'The x values weren’t evenly spaced, so the data were resampled to even steps first. ' : '') + 'The mean is removed first. Amplitudes are corrected for the window, so a sine of amplitude A shows as A. The new columns are selected as x and y; pick the original columns above to go back.' }));
      };
      b.append(el('div', { class: 'cv-units' }, el('label', { class: 'cv-lab' }, el('span', { text: 'Window' }), w), el('label', { class: 'cv-lab' }, el('span', { text: 'Show' }), o)), el('div', { class: 'chips' }, pad),
        el('p', { class: 'desc', text: 'Spectrum of y against x. If x is time in s, frequencies are in Hz; in µs, MHz.' }),
        el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Compute the spectrum', onclick: run })), out);
    }

    tab_table(b) {
      const n = Math.max(...this.cols.map((c) => c.v.length)); this.tPage = this.tPage || 0;
      const per = 100, pages = Math.ceil(n / per), pg = Math.min(this.tPage, pages - 1);
      const t = el('div', { class: 'dt-tbl', style: { gridTemplateColumns: 'auto ' + this.cols.map(() => 'minmax(0,1fr)').join(' ') } });
      t.append(el('b', { text: '#' }), ...this.cols.map((c) => el('b', { text: c.name })));
      for (let i = pg * per; i < Math.min(n, (pg + 1) * per); i++) { t.append(el('span', { class: 'sub', text: String(i + 1) })); for (const c of this.cols) t.append(el('span', { class: 'mono', text: i < c.v.length ? fmtNum(c.v[i], 8) : '' })); }
      const nav = el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: '‹ Previous', disabled: pg <= 0, onclick: () => { this.tPage = pg - 1; this.renderTab(); } }), el('span', { class: 'sub', text: 'Rows ' + (pg * per + 1) + '–' + Math.min(n, (pg + 1) * per) + ' of ' + n }), el('button', { class: 'btn', text: 'Next ›', disabled: pg >= pages - 1, onclick: () => { this.tPage = pg + 1; this.renderTab(); } }));
      b.append(nav, t);
    }
  }
  root.DataTools = { DataPage, fmtPM, fmtNum };
})(typeof self !== 'undefined' ? self : this);
