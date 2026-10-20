/*
 * numeric.js — numerical tools for measured data: reading CSV/text tables, nonlinear least-squares fitting
 * (Levenberg–Marquardt) with parameter uncertainties, peaks and FWHM, areas, FFT, smoothing and baselines.
 * Pure functions (no DOM), shared by the Data & Fit page and the optics tools.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- linear algebra */
  /** Solves A·x = b (A is n×n, arrays of rows) by Gaussian elimination with partial pivoting. Returns null if singular. */
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (!(Math.abs(M[p][c]) > 1e-300)) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function invert(A) {
    const n = A.length, out = [];
    for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; const col = solve(A, e); if (!col) return null; out.push(col); }
    return A.map((_, i) => out.map((col) => col[i]));
  }

  /* ---------------------------------------------------------------- reading tables */
  const NUM = /^[-+]?(?:\d+[.,]?\d*|[.,]\d+)(?:[eE][-+]?\d+)?$/;
  /** Reads CSV, TSV, semicolon or whitespace-separated text, as exported by spectrum analysers, OSAs, scopes and spreadsheets.
   *  Finds the longest block of rows with the same number of numeric fields; the line before it, if it isn't numeric, names the columns.
   *  Returns { names, cols: [Float64Array], skipped, delim, note }. */
  function parseTable(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const sl = lines.filter((l) => l.trim() && !/^\s*[#%!]/.test(l)).slice(-400), sample = sl.join('\n');
    const share = (ch) => sl.filter((l) => l.includes(ch)).length / (sl.length || 1);   // in how many lines
    const delim = share('\t') >= 0.5 ? '\t' : share(';') >= 0.5 ? ';' : share(',') >= 0.5 ? ',' : 'ws';
    // a semicolon file usually writes decimal commas
    const decComma = delim === ';' || (delim !== ',' && /\d,\d/.test(sample) && !/\d\.\d/.test(sample));
    const split = (l) => {
      let parts = delim === 'ws' ? l.trim().split(/\s+/) : l.split(delim);
      return parts.map((p) => p.trim().replace(/^"(.*)"$/, '$1'));
    };
    const numOf = (s) => { if (!NUM.test(s)) return NaN; return +(decComma ? s.replace(',', '.') : s.replace(/,(?=\d{3}\b)/g, '')); };
    const rows = lines.map((l) => { if (!l.trim() || /^\s*[#%!]/.test(l)) return null; const p = split(l); const n = p.map(numOf); return { p, n, k: n.filter((x) => isFinite(x)).length, all: n.every((x) => isFinite(x)) }; });
    // longest run of all-numeric rows with the same field count (≥ 1 field)
    let best = { s: -1, e: -1, w: 0, len: 0 };
    for (let i = 0; i < rows.length;) {
      const r = rows[i]; if (!r || !r.all || !r.k) { i++; continue; }
      let j = i; while (j + 1 < rows.length && (rows[j + 1] === null || (rows[j + 1].all && rows[j + 1].k === r.k))) j++;
      const len = rows.slice(i, j + 1).filter(Boolean).length;
      if (len > best.len || (len === best.len && r.k > best.w)) best = { s: i, e: j, w: r.k, len };
      i = j + 1;
    }
    if (best.s < 0) throw new Error('No columns of numbers found');
    const data = rows.slice(best.s, best.e + 1).filter(Boolean);
    const cols = Array.from({ length: best.w }, (_, c) => Float64Array.from(data, (r) => r.n[c]));
    let names = null;
    for (let i = best.s - 1; i >= 0 && i >= best.s - 3; i--) { const r = rows[i]; if (!r) continue; if (r.p.length >= best.w && r.k < r.p.length) { names = r.p.slice(0, best.w).map((s, k) => s || 'col' + (k + 1)); } break; }
    if (!names) names = best.w === 1 ? ['y'] : best.w === 2 ? ['x', 'y'] : cols.map((_, k) => (k === 0 ? 'x' : 'y' + k));
    const skipped = rows.filter(Boolean).length - data.length;
    return { names: uniqueNames(names), cols, skipped, delim: delim === 'ws' ? 'spaces' : delim === '\t' ? 'tabs' : delim, decComma };
  }
  function uniqueNames(names) {
    const seen = {}; return names.map((n) => { let b = String(n).trim() || 'col'; if (!seen[b]) { seen[b] = 1; return b; } let k = 2; while (seen[b + k]) k++; seen[b + k] = 1; return b + k; });
  }
  /** "Wavelength (nm)" or "Power[dBm]" → unit text, or '' */
  function unitFromName(n) { const m = String(n).match(/[([]\s*([^()[\]]+?)\s*[)\]]\s*$/); return m ? m[1] : ''; }
  function toCSV(names, cols, digits = 10) {
    const n = Math.max(0, ...cols.map((c) => c.length));
    const out = [names.map((s) => (/[,"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s)).join(',')];
    for (let i = 0; i < n; i++) out.push(cols.map((c) => (i < c.length && isFinite(c[i]) ? +c[i].toPrecision(digits) : '')).join(','));
    return out.join('\n') + '\n';
  }

  /* ---------------------------------------------------------------- statistics */
  function range(xs, lo = -Infinity, hi = Infinity) { const idx = []; for (let i = 0; i < xs.length; i++) if (xs[i] >= lo && xs[i] <= hi && isFinite(xs[i])) idx.push(i); return idx; }
  function stats(ys) {
    const v = Array.from(ys).filter(isFinite), n = v.length; if (!n) return null;
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    const s = v.slice().sort((a, b) => a - b), q = (p) => { const h = (n - 1) * p, l = Math.floor(h); return s[l] + (s[Math.min(n - 1, l + 1)] - s[l]) * (h - l); };
    return { n, mean, sd, sem: sd / Math.sqrt(n), min: s[0], max: s[n - 1], median: q(0.5), q1: q(0.25), q3: q(0.75), rms: Math.sqrt(v.reduce((a, b) => a + b * b, 0) / n) };
  }

  /* ---------------------------------------------------------------- nonlinear least squares */
  /** Levenberg–Marquardt. f(x, p) → y; p0 initial parameters; fixed[i] true keeps p[i]; sig optional per-point σ.
   *  Returns { p, sd, cov, chi2, redchi2, dof, r2, rms, iter, converged, resid }. */
  function fit(f, xs, ys, p0, opts = {}) {
    const N = xs.length, P = p0.length, fixed = opts.fixed || [], sig = opts.sigma;
    const free = p0.map((_, i) => i).filter((i) => !fixed[i]);
    const w = (i) => (sig && sig[i] > 0 ? 1 / sig[i] : 1);
    const evalAt = (p, x) => { let v = f(x, p); if (!isFinite(v)) v = f(x + 1e-12 * (Math.abs(x) || 1), p); return v; };
    const resid = (p) => { const r = new Float64Array(N); for (let i = 0; i < N; i++) r[i] = (ys[i] - evalAt(p, xs[i])) * w(i); return r; };
    const chi = (r) => { let s = 0; for (let i = 0; i < r.length; i++) s += r[i] * r[i]; return s; };
    let p = p0.slice(), r = resid(p), c2 = chi(r);
    if (!isFinite(c2)) throw new Error('The model gives no value at the starting parameters: check the initial values');
    if (!free.length) throw new Error('Every parameter is fixed');
    if (N <= free.length) throw new Error('Need more points than free parameters (' + free.length + ')');
    let lam = 1e-3, iter = 0, converged = false, J = null;
    const jac = (p) => {
      const Jm = free.map(() => new Float64Array(N));
      free.forEach((j, k) => {
        const h = 1e-7 * Math.max(Math.abs(p[j]), 1e-7) || 1e-9;
        const a = p.slice(), b = p.slice(); a[j] += h; b[j] -= h;
        for (let i = 0; i < N; i++) Jm[k][i] = (evalAt(a, xs[i]) - evalAt(b, xs[i])) / (2 * h) * w(i);
      });
      return Jm;
    };
    const normal = (Jm, rr) => {
      const A = free.map(() => new Array(free.length).fill(0)), g = new Array(free.length).fill(0);
      for (let a = 0; a < free.length; a++) {
        for (let i = 0; i < N; i++) g[a] += Jm[a][i] * rr[i];
        for (let b = a; b < free.length; b++) { let s = 0; for (let i = 0; i < N; i++) s += Jm[a][i] * Jm[b][i]; A[a][b] = A[b][a] = s; }
      }
      return { A, g };
    };
    const maxIter = opts.maxIter || 400;
    while (iter < maxIter) {
      iter++;
      J = jac(p); const { A, g } = normal(J, r);
      let improved = false;
      for (let tries = 0; tries < 30; tries++) {
        const Ad = A.map((row, i) => row.map((v, k) => (i === k ? v * (1 + lam) + 1e-30 : v)));
        const d = solve(Ad, g);
        if (!d) { lam *= 10; continue; }
        const pn = p.slice(); free.forEach((j, k) => { pn[j] += d[k]; });
        const rn = resid(pn), cn = chi(rn);
        if (isFinite(cn) && cn <= c2) {
          const rel = (c2 - cn) / Math.max(c2, 1e-300), step = Math.max(...free.map((j, k) => Math.abs(d[k]) / (Math.abs(pn[j]) + 1e-12)));
          p = pn; r = rn; c2 = cn; lam = Math.max(lam / 10, 1e-12); improved = true;
          if (rel < 1e-12 || step < 1e-10) converged = true;
          break;
        }
        lam *= 10;
        if (lam > 1e16) break;
      }
      if (!improved || converged) { converged = converged || !improved; break; }
    }
    J = jac(p);
    const { A } = normal(J, r);
    const dof = N - free.length, red = dof > 0 ? c2 / dof : NaN;
    const inv = invert(A);
    const scale = sig ? 1 : red;                         // without σ, the scatter of the residuals sets the error bars
    const sd = new Array(P).fill(0), cov = p.map(() => new Array(P).fill(0));
    if (inv) free.forEach((j, a) => free.forEach((k, b) => { cov[j][k] = inv[a][b] * scale; if (j === k) sd[j] = Math.sqrt(Math.max(0, inv[a][a] * scale)); }));
    let ym = 0; for (let i = 0; i < N; i++) ym += ys[i]; ym /= N;
    let sst = 0, sse = 0; const raw = new Float64Array(N);
    for (let i = 0; i < N; i++) { raw[i] = ys[i] - evalAt(p, xs[i]); sse += raw[i] ** 2; sst += (ys[i] - ym) ** 2; }
    return { p, sd, cov, chi2: c2, redchi2: red, dof, r2: sst > 0 ? 1 - sse / sst : NaN, rms: Math.sqrt(sse / N), iter, converged, resid: raw, singular: !inv };
  }

  /* ---------------------------------------------------------------- shapes of peaks */
  /** Height, position, FWHM and offset estimated from data (for starting values). */
  function guessPeak(xs, ys) {
    const n = xs.length; let im = 0, iM = 0;
    for (let i = 0; i < n; i++) { if (ys[i] > ys[iM]) iM = i; if (ys[i] < ys[im]) im = i; }
    const edge = Math.min(...[ys[0], ys[n - 1]].filter(isFinite));
    const up = ys[iM] - edge, down = edge - ys[im];
    const dip = down > up;                                           // an absorption line or a notch
    const i0 = dip ? im : iM, base = dip ? Math.max(ys[0], ys[n - 1]) : Math.min(ys[0], ys[n - 1]);
    const h = ys[i0] - base, half = base + h / 2;
    let l = i0, r = i0;
    while (l > 0 && (dip ? ys[l] < half : ys[l] > half)) l--;
    while (r < n - 1 && (dip ? ys[r] < half : ys[r] > half)) r++;
    const w = Math.abs(xs[r] - xs[l]) || Math.abs(xs[n - 1] - xs[0]) / 10 || 1;
    return { A: h, x0: xs[i0], w, c: base };
  }
  const LN2 = Math.log(2);
  /** Ready-made models: [id, name, model (Giac syntax), parameter names, starting values from (xs, ys)] */
  const PRESETS = [
    ['line', 'Straight line', 'm*x+b', ['m', 'b'], (x, y) => { const n = x.length; const sx = x.reduce((a, b) => a + b, 0), sy = y.reduce((a, b) => a + b, 0); let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += x[i] * x[i]; sxy += x[i] * y[i]; } const m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); return [m, (sy - m * sx) / n]; }],
    ['poly2', 'Quadratic', 'p0+p1*x+p2*x^2', ['p0', 'p1', 'p2'], (x, y) => polyGuess(x, y, 2)],
    ['poly3', 'Cubic', 'p0+p1*x+p2*x^2+p3*x^3', ['p0', 'p1', 'p2', 'p3'], (x, y) => polyGuess(x, y, 3)],
    ['poly4', 'Polynomial, 4th order', 'p0+p1*x+p2*x^2+p3*x^3+p4*x^4', ['p0', 'p1', 'p2', 'p3', 'p4'], (x, y) => polyGuess(x, y, 4)],
    ['gauss', 'Gaussian (w = FWHM)', 'A*exp(-4*ln(2)*((x-x0)/w)^2)+c', ['A', 'x0', 'w', 'c'], (x, y) => { const g = guessPeak(x, y); return [g.A, g.x0, g.w, g.c]; }],
    ['lorentz', 'Lorentzian (w = FWHM)', 'A/(1+4*((x-x0)/w)^2)+c', ['A', 'x0', 'w', 'c'], (x, y) => { const g = guessPeak(x, y); return [g.A, g.x0, g.w, g.c]; }],
    ['voigt', 'Pseudo-Voigt (η = Lorentzian share)', 'A*(eta/(1+4*((x-x0)/w)^2)+(1-eta)*exp(-4*ln(2)*((x-x0)/w)^2))+c', ['A', 'x0', 'w', 'eta', 'c'], (x, y) => { const g = guessPeak(x, y); return [g.A, g.x0, g.w, 0.5, g.c]; }],
    ['sinc2', 'sinc² (w = first-zero half width)', 'A*(sin(pi*(x-x0)/w)/(pi*(x-x0)/w))^2+c', ['A', 'x0', 'w', 'c'], (x, y) => { const g = guessPeak(x, y); return [g.A, g.x0 + 1e-9 * (g.w || 1), g.w / 0.886, g.c]; }],
    ['sech2', 'sech² pulse (w = FWHM)', 'A/cosh(1.7627471740390860*(x-x0)/w)^2+c', ['A', 'x0', 'w', 'c'], (x, y) => { const g = guessPeak(x, y); return [g.A, g.x0, g.w, g.c]; }],
    ['exp', 'Exponential decay', 'A*exp(-(x-x0)/tau)+c', ['A', 'tau', 'c', 'x0'], (x, y) => { const n = x.length; return [y[0] - y[n - 1], (x[n - 1] - x[0]) / 3 || 1, y[n - 1], x[0]]; }],
    ['exp2', 'Double exponential decay', 'A1*exp(-(x-x0)/t1)+A2*exp(-(x-x0)/t2)+c', ['A1', 't1', 'A2', 't2', 'c', 'x0'], (x, y) => { const n = x.length, d = (x[n - 1] - x[0]) || 1; return [(y[0] - y[n - 1]) / 2, d / 10, (y[0] - y[n - 1]) / 2, d / 2, y[n - 1], x[0]]; }],
    ['dsin', 'Damped sine', 'A*exp(-(x-x0)/tau)*sin(2*pi*f*(x-x0)+phi)+c', ['A', 'tau', 'f', 'phi', 'c', 'x0'], (x, y) => { const s = stats(y), d = (x[x.length - 1] - x[0]) || 1; return [(s.max - s.min) / 2, d, dominantFreq(x, y) || 3 / d, 0, s.mean, x[0]]; }],
    ['sine', 'Sine', 'A*sin(2*pi*f*x+phi)+c', ['A', 'f', 'phi', 'c'], (x, y) => { const s = stats(y), d = (x[x.length - 1] - x[0]) || 1; return [(s.max - s.min) / 2, dominantFreq(x, y) || 3 / d, 0, s.mean]; }],
    ['power', 'Power law', 'A*x^k+c', ['A', 'k', 'c'], (x, y) => [y[y.length - 1] || 1, 1, 0]],
    ['logistic', 'Logistic step', 'L/(1+exp(-(x-x0)/s))+c', ['L', 'x0', 's', 'c'], (x, y) => { const n = x.length; return [y[n - 1] - y[0], (x[0] + x[n - 1]) / 2, (x[n - 1] - x[0]) / 10 || 1, y[0]]; }],
    ['erf', 'Knife edge (erf, w = 1/e² radius)', 'P/2*(1+erf(sqrt(2)*(x-x0)/w))+c', ['P', 'x0', 'w', 'c'], (x, y) => { const n = x.length; return [y[n - 1] - y[0], (x[0] + x[n - 1]) / 2, (x[n - 1] - x[0]) / 4 || 1, y[0]]; }],
    ['airy', 'Etalon / Fabry–Pérot (Airy)', 'T0/(1+F*sin(pi*(x-x0)/fsr)^2)+c', ['T0', 'F', 'x0', 'fsr', 'c'], (x, y) => { const s = stats(y); return [s.max - s.min, 10, x[y.indexOf(s.max)] || x[0], (x[x.length - 1] - x[0]) / 3 || 1, s.min]; }],
    ['sell2', 'Sellmeier, 2 terms (x = λ in µm)', 'sqrt(1+B1*x^2/(x^2-C1)+B2*x^2/(x^2-C2))', ['B1', 'C1', 'B2', 'C2'], () => [1.0, 0.006, 0.2, 0.02]],
    ['sell3', 'Sellmeier, 3 terms (x = λ in µm)', 'sqrt(1+B1*x^2/(x^2-C1)+B2*x^2/(x^2-C2)+B3*x^2/(x^2-C3))', ['B1', 'C1', 'B2', 'C2', 'B3', 'C3'], () => [0.696, 0.0047, 0.408, 0.0135, 0.897, 97.9]],
    ['cauchy', 'Cauchy (x = λ in µm)', 'A+B/x^2+C/x^4', ['A', 'B', 'C'], (x, y) => [stats(y).mean, 0.004, 0]],
    ['beam', 'Gaussian beam radius w(z)', 'w0*sqrt(1+((x-z0)/zR)^2)', ['w0', 'z0', 'zR'], (x, y) => { let i = 0; for (let k = 0; k < y.length; k++) if (y[k] < y[i]) i = k; return [y[i], x[i], (x[x.length - 1] - x[0]) / 4 || 1]; }],
  ];
  function polyGuess(x, y, k) {
    const A = [], b = [];
    for (let i = 0; i <= k; i++) { A.push([]); for (let j = 0; j <= k; j++) { let s = 0; for (let n = 0; n < x.length; n++) s += x[n] ** (i + j); A[i].push(s); } let s = 0; for (let n = 0; n < x.length; n++) s += y[n] * x[n] ** i; b.push(s); }
    return solve(A, b) || new Array(k + 1).fill(0);
  }
  /** Free parameter names in a model: identifiers that aren't x, functions or constants. */
  const KNOWN = new Set(['x', 'pi', 'e', 'i', 'exp', 'ln', 'log', 'log10', 'sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'abs', 'erf', 'erfc', 'sign', 'floor', 'ceil', 'round', 'min', 'max', 'sinc', 'gamma', 'Gamma', 'besselJ', 'when', 'piecewise', 'surd', 'arcsin', 'arccos', 'arctan']);
  function modelParams(src) { const out = []; String(src).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (w, off, s) => { if (s[off + w.length] === '(' || KNOWN.has(w)) return w; if (!out.includes(w)) out.push(w); return w; }); return out; }

  /* ---------------------------------------------------------------- peaks, widths, areas */
  /** Trapezoid integral of y dx over indices [a, b]. */
  function area(xs, ys, a = 0, b = xs.length - 1) { let s = 0; for (let i = a; i < b; i++) s += (xs[i + 1] - xs[i]) * (ys[i] + ys[i + 1]) / 2; return s; }
  /** Crossing of level between i and i+1 (linear interpolation). */
  const cross = (xs, ys, i, lev) => xs[i] + (lev - ys[i]) * (xs[i + 1] - xs[i]) / ((ys[i + 1] - ys[i]) || 1e-300);
  /** Peaks above a prominence (fraction of the full range), with width at half height, centroid and area above the local baseline. */
  function peaks(xs, ys, opts = {}) {
    const n = ys.length, s = stats(ys); if (!s || n < 3) return [];
    const minProm = (opts.prominence != null ? opts.prominence : 0.05) * (s.max - s.min);
    const sign = opts.dips ? -1 : 1, y = Float64Array.from(ys, (v) => sign * v);
    const out = [];
    for (let i = 1; i < n - 1; i++) {
      if (!(y[i] > y[i - 1] && y[i] >= y[i + 1])) continue;
      let l = i, lmin = y[i]; while (l > 0 && y[l - 1] <= y[i]) { l--; if (y[l] < lmin) lmin = y[l]; }
      let r = i, rmin = y[i]; while (r < n - 1 && y[r + 1] <= y[i]) { r++; if (y[r] < rmin) rmin = y[r]; }
      const base = Math.max(lmin, rmin), prom = y[i] - base;
      if (prom < minProm) continue;
      const half = y[i] - prom / 2;
      let a = i; while (a > 0 && y[a] > half) a--;
      let b = i; while (b < n - 1 && y[b] > half) b++;
      const xl = a < i ? cross(xs, y, a, half) : xs[i], xr = b > i ? cross(xs, y, b - 1, half) : xs[i];
      // the peak's own extent: down to the base on each side
      let la = i; while (la > 0 && y[la - 1] < y[la] && y[la] > base) la--;
      let rb = i; while (rb < n - 1 && y[rb + 1] < y[rb] && y[rb] > base) rb++;
      let ar = 0, m1 = 0;
      for (let k = la; k < rb; k++) { const dx = xs[k + 1] - xs[k], h = ((y[k] - base) + (y[k + 1] - base)) / 2; ar += dx * h; m1 += dx * h * (xs[k] + xs[k + 1]) / 2; }
      // three-point parabolic refinement of the top
      const d = y[i - 1] - 2 * y[i] + y[i + 1], off = d ? 0.5 * (y[i - 1] - y[i + 1]) / d : 0;
      const xp = xs[i] + off * ((xs[i + 1] - xs[i - 1]) / 2);
      out.push({ i, x: xp, y: sign * (y[i] - 0.25 * (y[i - 1] - y[i + 1]) * off), prominence: prom, fwhm: Math.abs(xr - xl), xl, xr, area: sign * ar, centroid: ar ? m1 / ar : xs[i] });
    }
    // keep the most prominent of peaks closer than the minimum separation
    out.sort((p, q) => q.prominence - p.prominence);
    const sep = opts.minSep || 0, kept = [];
    for (const p of out) if (!kept.some((k) => Math.abs(k.x - p.x) < sep)) kept.push(p);
    return kept.slice(0, opts.max || 50).sort((p, q) => p.x - q.x);
  }

  /* ---------------------------------------------------------------- FFT */
  function fftInPlace(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  const WINDOWS = { none: () => 1, hann: (k, n) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (n - 1)), hamming: (k, n) => 0.54 - 0.46 * Math.cos(2 * Math.PI * k / (n - 1)), blackman: (k, n) => 0.42 - 0.5 * Math.cos(2 * Math.PI * k / (n - 1)) + 0.08 * Math.cos(4 * Math.PI * k / (n - 1)), flattop: (k, n) => { const t = 2 * Math.PI * k / (n - 1); return 0.21557895 - 0.41663158 * Math.cos(t) + 0.277263158 * Math.cos(2 * t) - 0.083578947 * Math.cos(3 * t) + 0.006947368 * Math.cos(4 * t); } };
  /** Evenly spaced copy of (xs, ys) with n points (linear interpolation); xs must increase. */
  function resample(xs, ys, n) {
    const x0 = xs[0], x1 = xs[xs.length - 1], dx = (x1 - x0) / (n - 1), X = new Float64Array(n), Y = new Float64Array(n);
    let j = 0;
    for (let k = 0; k < n; k++) { const x = x0 + k * dx; while (j < xs.length - 2 && xs[j + 1] < x) j++; X[k] = x; Y[k] = ys[j] + (ys[j + 1] - ys[j]) * (x - xs[j]) / ((xs[j + 1] - xs[j]) || 1e-300); }
    return { xs: X, ys: Y };
  }
  function uniform(xs) { if (xs.length < 3) return true; const d = (xs[xs.length - 1] - xs[0]) / (xs.length - 1); for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - xs[i - 1] - d) > 0.01 * Math.abs(d)) return false; return true; }
  /** Single-sided amplitude spectrum of y(x). Returns { f, amp, psd, phase, df, resampled, n }. */
  function spectrum(xs, ys, opts = {}) {
    let X = xs, Y = ys, resampled = false;
    if (!uniform(xs)) { const r = resample(xs, ys, xs.length); X = r.xs; Y = r.ys; resampled = true; }
    const n0 = Y.length, dx = (X[n0 - 1] - X[0]) / (n0 - 1);
    let N = 1; while (N < n0) N <<= 1; if (opts.pad) N <<= 1;
    const win = WINDOWS[opts.window || 'hann'] || WINDOWS.none;
    const mean = opts.removeMean !== false ? Y.reduce((a, b) => a + b, 0) / n0 : 0;
    const re = new Float64Array(N), im = new Float64Array(N); let wsum = 0, w2 = 0;
    for (let k = 0; k < n0; k++) { const w = win(k, n0); wsum += w; w2 += w * w; re[k] = (Y[k] - mean) * w; }
    fftInPlace(re, im);
    const M = N / 2 + 1, f = new Float64Array(M), amp = new Float64Array(M), psd = new Float64Array(M), phase = new Float64Array(M), df = 1 / (N * dx);
    for (let k = 0; k < M; k++) {
      const mag = Math.hypot(re[k], im[k]);
      f[k] = k * df; amp[k] = (k === 0 || k === N / 2 ? 1 : 2) * mag / wsum; phase[k] = Math.atan2(im[k], re[k]);
      psd[k] = (k === 0 || k === N / 2 ? 1 : 2) * mag * mag * dx / w2;    // per unit of f, one-sided
    }
    return { f, amp, psd, phase, df, dx, resampled, n: n0, N };
  }
  function dominantFreq(xs, ys) { try { const s = spectrum(xs, ys, { window: 'hann' }); let k = 1; for (let i = 2; i < s.amp.length; i++) if (s.amp[i] > s.amp[k]) k = i; return s.f[k]; } catch (e) { return 0; } }

  /* ---------------------------------------------------------------- smoothing, baselines, derivatives */
  function movingAverage(ys, w) { const n = ys.length, h = Math.floor(w / 2), out = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = Math.max(0, i - h); k <= Math.min(n - 1, i + h); k++) { s += ys[k]; c++; } out[i] = s / c; } return out; }
  /** Savitzky–Golay smoothing (or derivative of order deriv) with an odd window and polynomial order; the ends are extended by point reflection. */
  function savgol(ys, w, order = 2, deriv = 0, dx = 1) {
    w = Math.max(order + 2 + ((order + 2) % 2 === 0 ? 1 : 0), w | 1); const h = (w - 1) / 2, n = ys.length;
    const A = []; for (let i = -h; i <= h; i++) { const row = []; for (let j = 0; j <= order; j++) row.push(i ** j); A.push(row); }
    const AtA = []; for (let a = 0; a <= order; a++) { AtA.push([]); for (let b = 0; b <= order; b++) { let s = 0; for (const r of A) s += r[a] * r[b]; AtA[a].push(s); } }
    const inv = invert(AtA); if (!inv) return Float64Array.from(ys);
    let fact = 1; for (let k = 2; k <= deriv; k++) fact *= k;
    const c = A.map((r) => r.reduce((s, v, j) => s + inv[deriv][j] * v, 0) * fact / dx ** deriv);
    const at = (i) => (i < 0 ? 2 * ys[0] - ys[Math.min(n - 1, -i)] : i >= n ? 2 * ys[n - 1] - ys[Math.max(0, 2 * n - 2 - i)] : ys[i]);   // point reflection keeps lines straight at the ends
    const out = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = -h; k <= h; k++) s += c[k + h] * at(i + k); out[i] = s; }
    return out;
  }
  function derivative(xs, ys) { const n = ys.length, out = new Float64Array(n); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); out[i] = (ys[b] - ys[a]) / ((xs[b] - xs[a]) || NaN); } return out; }
  function polyval(c, x) { let s = 0; for (let k = c.length - 1; k >= 0; k--) s = s * x + c[k]; return s; }
  /** Polynomial baseline that hugs the bottom of the data (modified polynomial fit: points above the fit are pulled down, 50 rounds). */
  function baseline(xs, ys, order = 1, opts = {}) {
    const n = xs.length, xm = (xs[0] + xs[n - 1]) / 2, xs2 = (xs[n - 1] - xs[0]) / 2 || 1, u = Float64Array.from(xs, (x) => (x - xm) / xs2);
    let y = Float64Array.from(ys), c = null;
    for (let it = 0; it < (opts.rounds || 50); it++) {
      c = polyGuess(u, y, order); let changed = false;
      for (let i = 0; i < n; i++) { const b = polyval(c, u[i]); if ((opts.top ? y[i] < b : y[i] > b)) { y[i] = b; changed = true; } }
      if (!changed) break;
    }
    return Float64Array.from(u, (v) => polyval(c, v));
  }

  const api = { solve, invert, parseTable, uniqueNames, unitFromName, toCSV, range, stats, fit, guessPeak, PRESETS, modelParams, area, peaks, spectrum, resample, uniform, WINDOWS, movingAverage, savgol, derivative, baseline, polyGuess, polyval, dominantFreq };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Numeric = api;
})(typeof self !== 'undefined' ? self : this);
