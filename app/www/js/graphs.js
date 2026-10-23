/*
 * graphs.js — the Graphs page: function, parametric, polar and scatter plots with
 * pan/pinch zoom, trace, zoom presets, window settings, analysis (zero, min, max,
 * intersection, dy/dx, integral) and a table of values.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, mathField, Sheet } = UI;
  const COLORS = ['--g1', '--g2', '--g3', '--g4', '--g5', '--g6', '--g7', '--g8'];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // numeric helpers
  function bisect(f, a, b, it = 80) { let fa = f(a); for (let i = 0; i < it; i++) { const m = (a + b) / 2, fm = f(m); if (!isFinite(fm)) return NaN; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } } return (a + b) / 2; }
  function golden(f, a, b, it = 100) { const g = (Math.sqrt(5) - 1) / 2; let c = b - g * (b - a), d = a + g * (b - a); for (let i = 0; i < it; i++) { if (f(c) < f(d)) b = d; else a = c; c = b - g * (b - a); d = a + g * (b - a); } return (a + b) / 2; }
  function simpson(f, a, b, n = 2000) { if (n % 2) n++; const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; }
  function deriv(f, x) { const h = 1e-5 * Math.max(1, Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); }
  function niceStep(span, px) { const raw = span / Math.max(1, px / 80); const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function fmt(v) { if (!isFinite(v)) return String(v); const a = Math.abs(v); if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(4).replace(/\.?0+e/, 'e'); return String(+v.toPrecision(6)); }

  class GraphsPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'graph'; this.title = 'Graphs';
      this.fns = (state.fns || []).map((f) => ({ ...f, compiled: null }));
      this.view = state.view || { xmin: -10, xmax: 10, ymin: -6.67, ymax: 6.67 };
      this.grid = state.grid !== false; this.trace = null; this.marks = [];
      this.mode = state.mode || 'func';
      this.root = el('div', { class: 'page graph' });
      this.canvas = el('canvas', { style: { width: '100%', height: '100%', display: 'block', touchAction: 'none' } });
      this.wrap = el('div', { style: { flex: '1', minHeight: '0', position: 'relative' } }, this.canvas);
      this.info = el('div', { class: 'ginfo', style: { position: 'absolute', left: '8px', top: '8px', background: 'color-mix(in srgb, var(--doc) 88%, transparent)', borderRadius: '8px', padding: '4px 8px', fontSize: '14px', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }, hidden: true });
      this.wrap.append(this.info);
      // entry line: f1(x)= ...
      this.label = el('button', { class: 'chip', style: { flex: 'none' } });
      this.label.onclick = () => this.fnList();
      this.mf = mathField();
      this.mf.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.enter(); } });
      this.entry = el('div', { class: 'entry' }, this.label, this.mf);
      this.root.append(this.wrap, this.entry);
      this.editing = null;
      this.updateLabel();
      this.bindTouch();
      new ResizeObserver(() => this.draw()).observe(this.wrap);
      this.recompileAll();
    }
    get target() { return this.mf; }
    focus() { this.mf.focus(); }
    onShow() { this.draw(); }
    serialize() { return { fns: this.fns.map(({ compiled, xc, yc, ...f }) => f), view: this.view, grid: this.grid, mode: this.mode }; }
    nextName() { const p = { func: 'f', param: 'xy', polar: 'r', scatter: 's' }[this.mode]; let i = 1; while (this.fns.some((f) => f.name === p + i)) i++; return p + i; }
    updateLabel() {
      const n = this.editing ? this.editing.name : this.nextName();
      const lab = { func: n + '(x)=', param: n + '(t)=', polar: n + '(θ)=', scatter: n + ': lists' }[this.editing ? this.editing.type : this.mode];
      this.label.textContent = lab;
      this.mf.setAttribute('placeholder', this.mode === 'param' ? '\\text{x(t), y(t)}' : this.mode === 'scatter' ? '\\text{xlist, ylist}' : '');
    }
    color(i) { return css(COLORS[i % COLORS.length]); }

    /* ---------------- functions ---------------- */
    async enter() {
      const tex = this.mf.value.trim(); if (!tex) return;
      const type = this.editing ? this.editing.type : this.mode;
      const f = this.editing || { name: this.nextName(), type, color: this.fns.length, on: true };
      f.tex = tex;
      const ok = await this.compile(f);
      if (!ok) return;
      if (!this.editing) this.fns.push(f);
      this.editing = null; this.mf.value = ''; this.updateLabel(); this.draw(); this.app.saveSoon();
    }
    addFunction(giacExpr) {
      const f = { name: this.nextNameFor('func'), type: 'func', color: this.fns.length, on: true, giac: giacExpr, tex: GiacFmt.giacToTex(giacExpr, { editable: true }) };
      this.fns.push(f); this.compile(f).then(() => { this.draw(); this.app.saveSoon(); });
    }
    nextNameFor(t) { const m = this.mode; this.mode = t; const n = this.nextName(); this.mode = m; return n; }
    async recompileAll() { for (const f of this.fns) await this.compile(f, true); this.draw(); }
    async compile(f, quiet) {
      const ctx = { degrees: this.app.settings.angle === 'deg', userFuncs: this.app.userFuncs, vars: this.app.vars };
      try {
        if (f.type === 'scatter') {
          const parts = Tex2Giac.tex2giac(f.tex, ctx).split(',');
          if (parts.length !== 2) throw new Error('Enter two lists, like xs, ys');
          const [xs, ys] = await this.app.cas.batch(['evalf(' + parts[0] + ')', 'evalf(' + parts[1] + ')']);
          const px = GiacFmt.parse(xs), py = GiacFmt.parse(ys);
          const num = (n) => Number(GiacFmt.compile(n, [])());
          if (px.t !== 'vec' || py.t !== 'vec') throw new Error('Both must be lists (store them in Lists & Spreadsheet or with →)');
          f.pts = px.items.map((x, i) => [num(x), py.items[i] ? num(py.items[i]) : NaN]);
          return true;
        }
        const vars = f.type === 'param' ? ['t'] : f.type === 'polar' ? ['theta'] : ['x'];
        let code = f.giac || Tex2Giac.tex2giac(f.tex, ctx);
        if (f.type === 'param') {
          const p = splitTop(code); if (p.length !== 2) throw new Error('Enter x(t), y(t) separated by a comma');
          const [xe, ye] = await this.app.cas.batch(p.map((c) => 'evalf(' + c + ')'));
          f.xc = this.toFn(xe, vars); f.yc = this.toFn(ye, vars); f.compiled = true;
        } else {
          code = code.replace(/^\s*y\s*=/, '');
          // degree mode: the plot variable is in degrees for trig
          const out = await this.app.cas.eval('evalf(' + code + ')');
          if (/GIAC_ERROR|Error/.test(out)) throw new Error(out.replace(/.*Error:\s*/s, ''));
          f.compiled = this.toFn(out, vars);
        }
        f.err = null; return true;
      } catch (e) {
        f.err = e.message; if (!quiet) toast(e.message);
        return false;
      }
    }
    toFn(giacOut, vars) {
      const deg = this.app.settings.angle === 'deg';
      let src = giacOut;
      try {
        const fn = GiacFmt.compile(src, vars);
        if (deg && /\b(sin|cos|tan|sec|csc|cot)\(/.test(src)) return (v) => GiacFmt.compile(src.replace(/\b(sin|cos|tan|sec|csc|cot)\(/g, '$1(pi/180*'), vars)(v);
        return fn;
      } catch (e) {
        if (/free variable (\w+)/.test(e.message)) throw new Error('Give ' + e.message.match(/free variable (\w+)/)[1] + ' a value first (store it with →)');
        throw new Error('This can’t be graphed: ' + e.message);
      }
    }

    /* ---------------- drawing ---------------- */
    toPx(x, y) { const W = this.W, H = this.H, v = this.view; return [(x - v.xmin) / (v.xmax - v.xmin) * W, H - (y - v.ymin) / (v.ymax - v.ymin) * H]; }
    toXY(px, py) { const W = this.W, H = this.H, v = this.view; return [v.xmin + px / W * (v.xmax - v.xmin), v.ymin + (H - py) / H * (v.ymax - v.ymin)]; }
    draw() {
      const c = this.canvas, r = this.wrap.getBoundingClientRect(); if (!r.width || this.root.hidden) return;
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
      this.W = r.width; this.H = r.height;
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = css('--doc'); g.fillRect(0, 0, this.W, this.H);
      const v = this.view, ink = css('--ink'), ink3 = css('--ink3'), line = css('--line');
      const sx = niceStep(v.xmax - v.xmin, this.W), sy = niceStep(v.ymax - v.ymin, this.H);
      g.lineWidth = 1; g.font = '12px Plex, system-ui, sans-serif';
      if (this.grid) {
        g.strokeStyle = line; g.beginPath();
        for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { const [p] = this.toPx(x, 0); g.moveTo(Math.round(p) + .5, 0); g.lineTo(Math.round(p) + .5, this.H); }
        for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { const [, q] = this.toPx(0, y); g.moveTo(0, Math.round(q) + .5); g.lineTo(this.W, Math.round(q) + .5); }
        g.stroke();
      }
      // axes
      const [ox, oy] = this.toPx(0, 0);
      g.strokeStyle = ink3; g.lineWidth = 1.2; g.beginPath();
      if (oy >= 0 && oy <= this.H) { g.moveTo(0, oy); g.lineTo(this.W, oy); }
      if (ox >= 0 && ox <= this.W) { g.moveTo(ox, 0); g.lineTo(ox, this.H); }
      g.stroke();
      g.fillStyle = ink3; g.textAlign = 'center'; g.textBaseline = 'top';
      const ly = Math.min(Math.max(oy + 3, 2), this.H - 16);
      for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { if (Math.abs(x) < sx / 2) continue; const [p] = this.toPx(x, 0); g.fillText(fmt(+x.toPrecision(10)), p, ly); }
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const lx = Math.min(Math.max(ox + 4, 2), this.W - 40);
      for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { if (Math.abs(y) < sy / 2) continue; const [, q] = this.toPx(0, y); g.fillText(fmt(+y.toPrecision(10)), lx, q); }
      // curves
      this.fns.forEach((f, i) => { if (f.on && !f.err) this.plot(g, f, this.color(f.color)); });
      // labels of functions (top-right, Nspire style)
      g.textAlign = 'right'; g.textBaseline = 'top'; g.font = '600 13px Plex, system-ui';
      let yy = 8;
      for (const f of this.fns) { if (!f.on || f.err) continue; g.fillStyle = this.color(f.color); g.fillText(f.name, this.W - 10, yy); yy += 18; }
      // marks (analysis results) and trace
      for (const m of this.marks) this.dot(g, m.x, m.y, css('--ink'), m.label);
      if (this.trace) this.dot(g, this.trace.x, this.trace.y, this.color(this.trace.f.color));
    }
    dot(g, x, y, col, label) {
      const [p, q] = this.toPx(x, y); g.fillStyle = col; g.beginPath(); g.arc(p, q, 4.5, 0, 7); g.fill();
      if (label) { g.font = '600 13px Plex, system-ui'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillStyle = css('--ink'); g.fillText(label, p + 7, q - 5); }
    }
    plot(g, f, col) {
      g.strokeStyle = col; g.lineWidth = 2.2; g.lineJoin = 'round';
      const v = this.view;
      if (f.type === 'scatter') { g.fillStyle = col; for (const [x, y] of f.pts || []) { if (!isFinite(x) || !isFinite(y)) continue; const [p, q] = this.toPx(x, y); g.fillRect(p - 3, q - 3, 6, 6); } return; }
      g.beginPath();
      let pen = false, lastQ = 0;
      const H = this.H, span = v.ymax - v.ymin;
      const lineTo = (p, q, ok) => {
        if (!ok) { pen = false; return; }
        if (pen && Math.abs(q - lastQ) > H * 3) { pen = false; }
        if (!pen) { g.moveTo(p, q); pen = true; } else g.lineTo(p, q);
        lastQ = q;
      };
      const clampQ = (q) => Math.max(-H * 4, Math.min(H * 5, q));
      if (f.type === 'func') {
        const N = Math.ceil(this.W * 1.5); let prev = null;
        for (let i = 0; i <= N; i++) {
          const x = v.xmin + (v.xmax - v.xmin) * i / N;
          let y; try { y = f.compiled(x); } catch (e) { y = NaN; }
          const ok = typeof y === 'number' && isFinite(y);
          if (ok && prev !== null && Math.abs(y - prev) > span * 2) pen = false;  // asymptote
          const [p, q] = this.toPx(x, ok ? y : 0);
          lineTo(p, clampQ(q), ok); prev = ok ? y : null;
        }
      } else {
        const range = f.type === 'polar' ? [0, 2 * Math.PI] : [f.tmin ?? 0, f.tmax ?? 2 * Math.PI];
        const N = 1500;
        for (let i = 0; i <= N; i++) {
          const t = range[0] + (range[1] - range[0]) * i / N;
          let x, y;
          try { if (f.type === 'polar') { const r = f.compiled(t); x = r * Math.cos(t); y = r * Math.sin(t); } else { x = f.xc(t); y = f.yc(t); } } catch (e) { x = y = NaN; }
          const ok = isFinite(x) && isFinite(y);
          const [p, q] = this.toPx(ok ? x : 0, ok ? y : 0);
          lineTo(p, clampQ(q), ok);
        }
      }
      g.stroke();
    }

    /* ---------------- touch: pan, pinch, trace ---------------- */
    bindTouch() {
      const pts = new Map(); let start = null, longT = 0, moved = false;
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); moved = false;
        start = { view: { ...this.view }, pts: new Map(pts) };
        clearTimeout(longT);
        if (pts.size === 1) longT = setTimeout(() => { if (!moved) this.startTrace(e.offsetX); }, 380);
      });
      c.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.offsetX, e.offsetY]);
        if (this.tracing) { this.moveTrace(e.offsetX); return; }
        const s = start; if (!s) return;
        const a = [...s.pts.values()], b = [...pts.values()];
        if (pts.size === 1 && a.length === 1) {
          const dx = b[0][0] - a[0][0], dy = b[0][1] - a[0][1];
          if (Math.hypot(dx, dy) > 6) { moved = true; clearTimeout(longT); }
          const kx = (s.view.xmax - s.view.xmin) / this.W, ky = (s.view.ymax - s.view.ymin) / this.H;
          this.view = { xmin: s.view.xmin - dx * kx, xmax: s.view.xmax - dx * kx, ymin: s.view.ymin + dy * ky, ymax: s.view.ymax + dy * ky };
          this.draw();
        } else if (pts.size === 2 && a.length === 2) {
          moved = true; clearTimeout(longT);
          const d0x = Math.abs(a[0][0] - a[1][0]) + 20, d1x = Math.abs(b[0][0] - b[1][0]) + 20;
          const d0y = Math.abs(a[0][1] - a[1][1]) + 20, d1y = Math.abs(b[0][1] - b[1][1]) + 20;
          const d0 = Math.hypot(d0x, d0y), d1 = Math.hypot(d1x, d1y);
          const k = d0 / d1;
          const cx = (a[0][0] + a[1][0]) / 2, cy = (a[0][1] + a[1][1]) / 2;
          const [X, Y] = (() => { const sv = this.view; this.view = s.view; const r = this.toXY(cx, cy); this.view = sv; return r; })();
          const v = s.view;
          this.view = { xmin: X - (X - v.xmin) * k, xmax: X + (v.xmax - X) * k, ymin: Y - (Y - v.ymin) * k, ymax: Y + (v.ymax - Y) * k };
          this.draw();
        }
      });
      const up = (e) => {
        pts.delete(e.pointerId); clearTimeout(longT);
        start = { view: { ...this.view }, pts: new Map(pts) };
        if (!pts.size) { if (this.tracing) this.tracing = false; if (moved) this.app.saveSoon(); }
      };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('dblclick', (e) => this.zoomAt(e.offsetX, e.offsetY, 0.5));
      c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    }
    zoomAt(px, py, k) { const [X, Y] = this.toXY(px, py); const v = this.view; this.view = { xmin: X - (X - v.xmin) * k, xmax: X + (v.xmax - X) * k, ymin: Y - (Y - v.ymin) * k, ymax: Y + (v.ymax - Y) * k }; this.draw(); this.app.saveSoon(); }
    traceable() { return this.fns.filter((f) => f.on && !f.err && f.type === 'func'); }
    startTrace(px) {
      const fs = this.traceable(); if (!fs.length) return;
      this.tracing = true; UI.haptic();
      // nearest curve to the touch
      const [x] = this.toXY(px, 0);
      this.trace = { f: fs[0], x, y: fs[0].compiled(x) };
      this.moveTrace(px);
    }
    moveTrace(px) {
      const [x, ty] = this.toXY(px, 0);
      const fs = this.traceable(); if (!fs.length) return;
      let best = this.trace ? this.trace.f : fs[0];
      const y = best.compiled(x);
      this.trace = { f: best, x, y };
      this.info.hidden = false;
      this.info.innerHTML = ''; this.info.append(el('b', { text: best.name, style: { color: this.color(best.color) } }), '\u00a0 x = ' + fmt(x) + '\u00a0\u00a0 y = ' + fmt(y));
      this.draw();
    }

    /* ---------------- menu ---------------- */
    menu() {
      const zoom = (xmin, xmax, ymin, ymax) => () => { this.view = { xmin, xmax, ymin, ymax }; if (ymin == null) this.square(); this.draw(); this.app.saveSoon(); };
      const an = (kind) => () => this.analyze(kind);
      return [
        ['Graph type', [['Function', () => this.setMode('func')], ['Parametric', () => this.setMode('param')], ['Polar', () => this.setMode('polar')], ['Scatter plot', () => this.setMode('scatter')]]],
        ['Window / Zoom', [
          ['Window settings', () => this.windowDialog()],
          ['Zoom – Standard', zoom(-10, 10, -6.67, 6.67)], ['Zoom – Trig', zoom(-2 * Math.PI, 2 * Math.PI, -4, 4)],
          ['Zoom – Square', () => { this.square(); this.draw(); }], ['Zoom – Fit', () => this.zoomFit()],
          ['Zoom – In', () => this.zoomAt(this.W / 2, this.H / 2, 0.5)], ['Zoom – Out', () => this.zoomAt(this.W / 2, this.H / 2, 2)],
          ['Zoom – Decimal', zoom(-8.3, 8.3, -5.5, 5.5)], ['Zoom – Quadrant 1', zoom(0, 20, 0, 13.3)],
        ]],
        ['Trace', [['Graph trace (long-press the graph)', () => toast('Long-press the graph and slide along it')], ['Hide trace', () => { this.trace = null; this.info.hidden = true; this.draw(); }]]],
        ['Analyze graph', [['Zero', an('zero')], ['Minimum', an('min')], ['Maximum', an('max')], ['Intersection', an('intersect')], ['dy/dx at a point', an('deriv')], ['Integral', an('integral')], ['Inflection', an('inflect')], ['Clear marks', () => { this.marks = []; this.draw(); }]]],
        ['Table of values', () => this.tableSheet()],
        ['Functions', () => this.fnList()],
        ['Grid on/off', () => { this.grid = !this.grid; this.draw(); this.app.saveSoon(); }],
      ];
    }
    setMode(m) { this.mode = m; this.editing = null; this.updateLabel(); this.mf.focus(); }
    square() { const v = this.view, cx = (v.xmin + v.xmax) / 2, cy = (v.ymin + v.ymax) / 2, kx = (v.xmax - v.xmin) / this.W; const hy = kx * this.H / 2; this.view = { xmin: v.xmin, xmax: v.xmax, ymin: cy - hy, ymax: cy + hy }; }
    zoomFit() {
      let lo = Infinity, hi = -Infinity; const v = this.view;
      for (const f of this.traceable()) for (let i = 0; i <= 400; i++) { const y = f.compiled(v.xmin + (v.xmax - v.xmin) * i / 400); if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }
      if (!isFinite(lo)) return; if (hi - lo < 1e-9) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.08;
      this.view = { ...v, ymin: lo - pad, ymax: hi + pad }; this.draw(); this.app.saveSoon();
    }
    windowDialog() {
      Sheet.open('Window settings', (b) => {
        const fields = {};
        for (const k of ['xmin', 'xmax', 'ymin', 'ymax']) { const i = el('input', { type: 'text', inputmode: 'decimal', value: fmt(this.view[k]) }); fields[k] = i; b.append(el('label', { class: 'field' }, k, i)); }
        b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Apply', onclick: () => {
          const n = {}; for (const k in fields) n[k] = Number(fields[k].value);
          if (Object.values(n).some((x) => !isFinite(x)) || n.xmin >= n.xmax || n.ymin >= n.ymax) { toast('Check the numbers: min must be below max'); return; }
          this.view = n; Sheet.close(); this.draw(); this.app.saveSoon();
        } })));
      });
    }
    fnList() {
      Sheet.open('Functions', (b) => {
        if (!this.fns.length) b.append(el('p', { class: 'desc', text: 'No functions yet. Type one on the entry line and press enter.' }));
        const L = el('ul', { class: 'mlist' });
        this.fns.forEach((f, i) => {
          const sw = el('span', { style: { width: '14px', height: '14px', borderRadius: '4px', background: this.color(f.color), flex: 'none', opacity: f.on ? 1 : 0.3 } });
          const lab = el('span', { class: 'lbl' }); renderTex(lab, f.name + (f.type === 'func' ? '(x)=' : f.type === 'polar' ? '(\\theta)=' : f.type === 'param' ? '(t)=' : ':') + f.tex);
          const row = el('li', { style: { display: 'flex', alignItems: 'center' } },
            el('button', { class: 'mi', style: { flex: 1 }, onclick: () => { Sheet.close(); this.editing = f; this.mf.value = f.tex; this.updateLabel(); this.mf.focus(); } }, sw, lab, f.err ? el('span', { class: 'sub', style: { color: 'var(--err)' }, text: 'error' }) : null),
            el('button', { class: 'chip', text: f.on ? 'Hide' : 'Show', onclick: () => { f.on = !f.on; Sheet.close(); this.draw(); this.app.saveSoon(); } }),
            el('button', { class: 'ib', 'aria-label': 'Delete', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', onclick: () => { this.fns.splice(i, 1); Sheet.close(); this.draw(); this.app.saveSoon(); } }));
          L.append(row);
        });
        b.append(L);
      });
    }
    tableSheet() {
      const fs = this.traceable(); if (!fs.length) { toast('Graph a function first'); return; }
      Sheet.open('Table of values', (b) => {
        const start = el('input', { type: 'text', inputmode: 'decimal', value: '0' }), step = el('input', { type: 'text', inputmode: 'decimal', value: '1' });
        const tbl = el('table', { class: 'stattable', style: { width: '100%', marginTop: '8px' } });
        const render = () => {
          tbl.innerHTML = ''; const s = Number(start.value) || 0, d = Number(step.value) || 1;
          tbl.append(el('tr', {}, el('td', { text: 'x' }), ...fs.map((f) => el('td', { text: f.name + '(x)', style: { color: this.color(f.color), fontWeight: '600' } }))));
          for (let i = 0; i < 40; i++) { const x = +(s + i * d).toPrecision(12); tbl.append(el('tr', {}, el('td', { text: fmt(x) }), ...fs.map((f) => el('td', { text: fmt(f.compiled(x)) })))); }
        };
        start.oninput = step.oninput = render;
        b.append(el('div', { style: { display: 'flex', gap: '8px' } }, el('label', { class: 'field', style: { flex: 1 } }, 'Start', start), el('label', { class: 'field', style: { flex: 1 } }, 'Step', step)), tbl);
        render();
      });
    }
    analyze(kind) {
      const fs = this.traceable(); if (!fs.length) { toast('Graph a function first'); return; }
      const v = this.view;
      Sheet.open({ zero: 'Zero', min: 'Minimum', max: 'Maximum', intersect: 'Intersection', deriv: 'dy/dx at a point', integral: 'Integral', inflect: 'Inflection' }[kind], (b) => {
        const pick = (label) => { const s = el('select'); fs.forEach((f, i) => s.append(el('option', { value: i, text: f.name + '(x)' }))); b.append(el('label', { class: 'field' }, label, s)); return s; };
        const f1 = pick('Function'); const f2 = kind === 'intersect' ? pick('Second function') : null; if (f2 && fs.length > 1) f2.value = 1;
        const num = (label, val) => { const i = el('input', { type: 'text', inputmode: 'decimal', value: fmt(val) }); b.append(el('label', { class: 'field' }, label, i)); return i; };
        const mid = (v.xmin + v.xmax) / 2;
        const a = kind === 'deriv' ? num('x', mid) : num('Lower bound', v.xmin + (v.xmax - v.xmin) * 0.25);
        const c = kind === 'deriv' ? null : num('Upper bound', v.xmin + (v.xmax - v.xmin) * 0.75);
        const out = el('div', { class: 'card', style: { fontSize: '17px', marginTop: '10px' }, hidden: true });
        b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Calculate', onclick: () => {
          const F = fs[+f1.value].compiled, lo = Number(a.value), hi = c ? Number(c.value) : 0;
          let res = '', mk = null;
          if (kind === 'deriv') { const d = deriv(F, lo); res = 'dy/dx = ' + fmt(d) + ' at x = ' + fmt(lo); mk = { x: lo, y: F(lo), label: 'dy/dx=' + fmt(d) }; }
          else if (!(lo < hi)) { toast('Lower bound must be below the upper bound'); return; }
          else if (kind === 'zero' || kind === 'intersect') {
            const G = kind === 'intersect' ? ((x) => F(x) - fs[+f2.value].compiled(x)) : F;
            let x = NaN; const N = 400; let pa = lo, pv = G(lo);
            for (let i = 1; i <= N && isNaN(x); i++) { const q = lo + (hi - lo) * i / N, qv = G(q); if (isFinite(pv) && isFinite(qv) && pv * qv <= 0) x = bisect(G, pa, q); pa = q; pv = qv; }
            if (isNaN(x)) { const xm = golden((t) => Math.abs(G(t)), lo, hi); if (Math.abs(G(xm)) < 1e-7) x = xm; }
            if (isNaN(x)) res = 'No ' + (kind === 'zero' ? 'zero' : 'intersection') + ' between those bounds.';
            else { res = (kind === 'zero' ? 'Zero' : 'Intersection') + ': x = ' + fmt(x) + ', y = ' + fmt(F(x)); mk = { x, y: F(x), label: '(' + fmt(x) + ', ' + fmt(F(x)) + ')' }; }
          } else if (kind === 'min' || kind === 'max') {
            const s = kind === 'min' ? 1 : -1; const x = golden((t) => s * F(t), lo, hi);
            res = (kind === 'min' ? 'Minimum' : 'Maximum') + ': x = ' + fmt(x) + ', y = ' + fmt(F(x)); mk = { x, y: F(x), label: (kind === 'min' ? 'min ' : 'max ') + '(' + fmt(x) + ', ' + fmt(F(x)) + ')' };
          } else if (kind === 'integral') { const I = simpson(F, lo, hi); res = '∫ from ' + fmt(lo) + ' to ' + fmt(hi) + ' = ' + fmt(I); this.shade = { F, lo, hi }; }
          else if (kind === 'inflect') {
            const D2 = (x) => deriv((t) => deriv(F, t), x); let x = NaN, pa = lo, pv = D2(lo);
            for (let i = 1; i <= 300 && isNaN(x); i++) { const q = lo + (hi - lo) * i / 300, qv = D2(q); if (pv * qv < 0) x = bisect(D2, pa, q, 60); pa = q; pv = qv; }
            res = isNaN(x) ? 'No inflection point between those bounds.' : 'Inflection: x = ' + fmt(x) + ', y = ' + fmt(F(x)); if (!isNaN(x)) mk = { x, y: F(x), label: 'inflection' };
          }
          out.hidden = false; out.textContent = res;
          if (mk) { this.marks.push(mk); }
          this.draw();
        } })), out);
      });
    }
    clear() { this.fns = []; this.marks = []; this.trace = null; this.draw(); this.app.saveSoon(); }
    esc() { if (this.editing) { this.editing = null; this.mf.value = ''; this.updateLabel(); } else this.mf.value = ''; }
  }
  function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if ('([{'.includes(ch)) d++; if (')]}'.includes(ch)) d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

  root.Graphs = { GraphsPage, splitTop };
})(typeof self !== 'undefined' ? self : this);
