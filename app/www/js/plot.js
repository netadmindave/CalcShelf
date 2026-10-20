/*
 * plot.js — a small canvas plot for measured data: points and lines, linear or log axes, pinch and drag to zoom
 * and pan, double-tap to fit, and a tap read-out. Used by Data & Fit and the optics tools.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

  function niceStep(span, n) { const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function fmtTick(v, step) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) { const e = Math.floor(Math.log10(a)), m = v / 10 ** e; return (+m.toPrecision(3)) + 'e' + e; }
    const d = Math.max(0, -Math.floor(Math.log10(step)) + (step / 10 ** Math.floor(Math.log10(step)) < 1.5 ? 0 : 0));
    return (+v.toFixed(Math.min(10, d))).toString();
  }

  class Plot {
    /** opts: { height, xlabel, ylabel, onTap(x, y) } */
    constructor(opts = {}) {
      this.opts = opts; this.series = []; this.logx = false; this.logy = false; this.view = null; this.marks = [];
      this.el = document.createElement('div'); this.el.className = 'plotbox';
      this.el.style.height = (opts.height || 280) + 'px';
      this.cv = document.createElement('canvas'); this.el.append(this.cv);
      this.readout = document.createElement('div'); this.readout.className = 'plot-read'; this.readout.hidden = true; this.el.append(this.readout);
      this.bind();
      this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(this.el);
    }
    /** series: [{ xs, ys, mode: 'points'|'line', color: CSS var or colour, width, label, dash }] */
    set(series, keepView) { this.series = series.filter((s) => s && s.xs && s.xs.length); if (!keepView || !this.view) this.fit(); else this.draw(); }
    setLog(lx, ly) { this.logx = !!lx; this.logy = !!ly; this.fit(); }
    tx(v) { return this.logx ? Math.log10(v) : v; } ty(v) { return this.logy ? Math.log10(v) : v; }
    ux(v) { return this.logx ? 10 ** v : v; } uy(v) { return this.logy ? 10 ** v : v; }
    fit() {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const s of this.series) {
        if (s.noFit) continue;
        for (let i = 0; i < s.xs.length; i++) {
          const x = this.tx(s.xs[i]), y = this.ty(s.ys[i]); if (!isFinite(x) || !isFinite(y)) continue;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (!isFinite(x0)) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
      if (x1 === x0) { x0 -= 0.5 || 1; x1 += 0.5 || 1; } if (y1 === y0) { const d = Math.abs(y0) * 0.1 || 1; y0 -= d; y1 += d; }
      const py = (y1 - y0) * 0.06;
      this.view = { x0, x1, y0: y0 - py, y1: y1 + py };
      this.draw();
    }
    /** visible x range in data units */
    xRange() { return this.view ? [this.ux(this.view.x0), this.ux(this.view.x1)] : [-Infinity, Infinity]; }
    layout() {
      const r = this.el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const W = Math.max(50, r.width), H = Math.max(50, r.height);
      if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px'; }
      const L = 52, R = 10, T = 10, B = 30 + (this.opts.xlabel ? 12 : 0);
      return { W, H, dpr, L, R, T, B, pw: W - L - R, ph: H - T - B };
    }
    px(x, g) { const v = this.view; return g.L + (this.tx(x) - v.x0) / (v.x1 - v.x0) * g.pw; }
    py(y, g) { const v = this.view; return g.T + (1 - (this.ty(y) - v.y0) / (v.y1 - v.y0)) * g.ph; }
    draw() {
      if (!this.view || !this.el.isConnected) return;
      const g = this.layout(), c = this.cv.getContext('2d'), v = this.view;
      c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0); c.clearRect(0, 0, g.W, g.H);
      c.fillStyle = css('--card'); c.fillRect(0, 0, g.W, g.H);
      c.font = '11px ' + (css('--font') || 'sans-serif'); c.fillStyle = css('--ink2'); c.strokeStyle = css('--line'); c.lineWidth = 1;
      // grid and ticks
      const ticks = (a0, a1, log, n) => {
        if (log) { const out = []; for (let e = Math.floor(a0); e <= Math.ceil(a1); e++) out.push(e); return out.length > n * 2 ? out.filter((e) => e % Math.ceil(out.length / n) === 0) : out; }
        const st = niceStep(a1 - a0, n), out = []; for (let t = Math.ceil(a0 / st) * st; t <= a1 + st * 1e-9; t += st) out.push(Math.abs(t) < st * 1e-9 ? 0 : t); return out;
      };
      const xt = ticks(v.x0, v.x1, this.logx, Math.max(2, Math.floor(g.pw / 70))), yt = ticks(v.y0, v.y1, this.logy, Math.max(2, Math.floor(g.ph / 40)));
      const xstep = this.logx ? 1 : niceStep(v.x1 - v.x0, Math.max(2, Math.floor(g.pw / 70))), ystep = this.logy ? 1 : niceStep(v.y1 - v.y0, Math.max(2, Math.floor(g.ph / 40)));
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (const t of xt) { const X = g.L + (t - v.x0) / (v.x1 - v.x0) * g.pw; if (X < g.L - 1 || X > g.L + g.pw + 1) continue; c.beginPath(); c.moveTo(X, g.T); c.lineTo(X, g.T + g.ph); c.stroke(); c.fillText(this.logx ? '1e' + t : fmtTick(t, xstep), X, g.T + g.ph + 4); }
      c.textAlign = 'right'; c.textBaseline = 'middle';
      for (const t of yt) { const Y = g.T + (1 - (t - v.y0) / (v.y1 - v.y0)) * g.ph; if (Y < g.T - 1 || Y > g.T + g.ph + 1) continue; c.beginPath(); c.moveTo(g.L, Y); c.lineTo(g.L + g.pw, Y); c.stroke(); c.fillText(this.logy ? '1e' + t : fmtTick(t, ystep), g.L - 4, Y); }
      if (this.opts.xlabel) { c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(this.opts.xlabel, g.L + g.pw / 2, g.H - 1); }
      if (this.opts.ylabel) { c.save(); c.translate(10, g.T + g.ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(this.opts.ylabel, 0, -8); c.restore(); }
      c.strokeStyle = css('--ink3'); c.strokeRect(g.L, g.T, g.pw, g.ph);
      // series
      c.save(); c.beginPath(); c.rect(g.L, g.T, g.pw, g.ph); c.clip();
      for (const s of this.series) {
        const col = s.color && s.color.startsWith('--') ? css(s.color) : s.color || css('--g1');
        c.strokeStyle = c.fillStyle = col; c.lineWidth = s.width || 1.6; c.setLineDash(s.dash || []);
        const n = s.xs.length;
        if (s.mode === 'points' || (s.mode !== 'line' && n < 300)) {
          const r = s.r || (n > 2000 ? 1.2 : 2.2);
          for (let i = 0; i < n; i++) { const X = this.px(s.xs[i], g), Y = this.py(s.ys[i], g); if (!isFinite(X) || !isFinite(Y)) continue; c.fillRect(X - r, Y - r, 2 * r, 2 * r); }
        } else {
          // min/max decimation per pixel column keeps large traces fast and faithful
          c.beginPath(); let pen = false;
          if (n > g.pw * 4) {
            let col0 = null, mn = 0, mx = 0, first = 0, last = 0;
            const flush = () => { if (col0 == null) return; if (!pen) { c.moveTo(col0, first); pen = true; } else c.lineTo(col0, first); c.lineTo(col0, mn); c.lineTo(col0, mx); c.lineTo(col0, last); };
            for (let i = 0; i < n; i++) {
              const X = Math.round(this.px(s.xs[i], g)), Y = this.py(s.ys[i], g);
              if (!isFinite(X) || !isFinite(Y)) { flush(); col0 = null; pen = false; continue; }
              if (X !== col0) { flush(); col0 = X; mn = mx = first = last = Y; } else { if (Y < mn) mn = Y; if (Y > mx) mx = Y; last = Y; }
            }
            flush();
          } else {
            for (let i = 0; i < n; i++) { const X = this.px(s.xs[i], g), Y = this.py(s.ys[i], g); if (!isFinite(X) || !isFinite(Y)) { pen = false; continue; } if (!pen) { c.moveTo(X, Y); pen = true; } else c.lineTo(X, Y); }
          }
          c.stroke();
        }
      }
      c.setLineDash([]);
      for (const m of this.marks) {   // vertical markers {x, color, label}
        const X = this.px(m.x, g); c.strokeStyle = m.color || css('--g2'); c.lineWidth = 1; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(X, g.T); c.lineTo(X, g.T + g.ph); c.stroke(); c.setLineDash([]);
        if (m.label) { c.fillStyle = m.color || css('--g2'); c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(m.label, X + 3, g.T + 3); }
      }
      c.restore();
      // legend
      const named = this.series.filter((s) => s.label); if (named.length > 1) {
        c.textAlign = 'left'; c.textBaseline = 'middle'; let y = g.T + 10;
        for (const s of named) { const col = s.color && s.color.startsWith('--') ? css(s.color) : s.color || css('--g1'); c.fillStyle = col; c.fillRect(g.L + g.pw - 92, y - 1.5, 14, 3); c.fillStyle = css('--ink'); c.fillText(s.label, g.L + g.pw - 74, y); y += 15; }
      }
    }
    bind() {
      const pts = new Map(); let start = null, moved = false, lastTap = 0;
      const toData = (cx, cy) => { const g = this.layout(), r = this.cv.getBoundingClientRect(), v = this.view; return { x: v.x0 + (cx - r.left - g.L) / g.pw * (v.x1 - v.x0), y: v.y0 + (1 - (cy - r.top - g.T) / g.ph) * (v.y1 - v.y0) }; };
      this.cv.style.touchAction = 'none';
      this.cv.addEventListener('pointerdown', (e) => { this.cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = { view: { ...this.view }, pts: new Map([...pts].map(([k, p]) => [k, { ...p }])) }; moved = false; });
      this.cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId) || !start) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = this.layout(), v0 = start.view;
        if (pts.size === 1) {
          const p = [...pts.values()][0], s = [...start.pts.values()][0]; if (!s) return;
          const dx = (p.x - s.x) / g.pw * (v0.x1 - v0.x0), dy = (p.y - s.y) / g.ph * (v0.y1 - v0.y0);
          if (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) > 4) moved = true;
          this.view = { x0: v0.x0 - dx, x1: v0.x1 - dx, y0: v0.y0 + dy, y1: v0.y1 + dy };
        } else if (pts.size >= 2) {
          moved = true;
          const [a, b] = [...pts.values()], [sa, sb] = [...start.pts.values()]; if (!sa || !sb) return;
          const fx = Math.max(1e-6, Math.abs(sb.x - sa.x)) / Math.max(1e-6, Math.abs(b.x - a.x)), fy = Math.max(1e-6, Math.abs(sb.y - sa.y)) / Math.max(1e-6, Math.abs(b.y - a.y));
          const kx = Math.abs(sb.x - sa.x) > 30 ? fx : 1, ky = Math.abs(sb.y - sa.y) > 30 ? fy : 1;
          const r = this.cv.getBoundingClientRect(), cx = ((sa.x + sb.x) / 2 - r.left - g.L) / g.pw, cy = 1 - ((sa.y + sb.y) / 2 - r.top - g.T) / g.ph;
          const mx = v0.x0 + cx * (v0.x1 - v0.x0), my = v0.y0 + cy * (v0.y1 - v0.y0);
          this.view = { x0: mx - (mx - v0.x0) * kx, x1: mx + (v0.x1 - mx) * kx, y0: my - (my - v0.y0) * ky, y1: my + (v0.y1 - my) * ky };
        }
        this.draw();
      });
      const end = (e) => {
        if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
        if (!pts.size) {
          if (!moved) {
            const now = Date.now();
            if (now - lastTap < 320) { this.fit(); this.readout.hidden = true; lastTap = 0; }
            else { lastTap = now; const d = toData(e.clientX, e.clientY); this.tapAt(this.ux(d.x), this.uy(d.y), e); }
          }
          start = null; if (this.opts.onView) this.opts.onView(this.xRange());
        } else start = { view: { ...this.view }, pts: new Map([...pts].map(([k, p]) => [k, { ...p }])) };
      };
      this.cv.addEventListener('pointerup', end); this.cv.addEventListener('pointercancel', end);
      this.cv.addEventListener('wheel', (e) => { e.preventDefault(); const k = e.deltaY > 0 ? 1.15 : 1 / 1.15, d = toData(e.clientX, e.clientY), v = this.view; this.view = { x0: d.x - (d.x - v.x0) * k, x1: d.x + (v.x1 - d.x) * k, y0: d.y - (d.y - v.y0) * k, y1: d.y + (v.y1 - d.y) * k }; this.draw(); }, { passive: false });
    }
    /** nearest point of the first series to a tap, shown as a read-out */
    tapAt(x, y, e) {
      const s = this.series[0]; if (!s) return;
      const g = this.layout(); let best = -1, bd = Infinity;
      const X = this.px(x, g), Y = this.py(y, g);
      for (let i = 0; i < s.xs.length; i++) { const d = Math.hypot(this.px(s.xs[i], g) - X, (this.py(s.ys[i], g) - Y) * 0.3); if (d < bd) { bd = d; best = i; } }
      if (best < 0) return;
      const fx = (v) => (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v) ? v.toExponential(5) : +v.toPrecision(8));
      this.readout.textContent = 'x = ' + fx(s.xs[best]) + '   y = ' + fx(s.ys[best]);
      this.readout.hidden = false;
      this.marks = this.marks.filter((m) => !m.tap); this.marks.push({ x: s.xs[best], tap: true, color: css('--ink3') }); this.draw();
      if (this.opts.onTap) this.opts.onTap(s.xs[best], s.ys[best], best);
    }
  }
  root.Plot = Plot;
})(typeof self !== 'undefined' ? self : this);
