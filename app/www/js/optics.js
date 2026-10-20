/*
 * optics.js — optics calculators for the conversion tool's Optics tab: Gaussian beams through ABCD systems,
 * material dispersion from Sellmeier data, Fabry–Pérot etalons, and thin-film stacks (transfer matrices).
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast } = UI;
  const C0 = 299792458, PI = Math.PI;
  const fmt = (v, sig = 6) => { if (!isFinite(v)) return String(v); if (v === 0) return '0'; const a = Math.abs(v); return a >= 1e6 || a < 1e-4 ? v.toExponential(sig - 1).replace(/\.?0+e/, 'e') : String(+v.toPrecision(sig)); };
  const num = (s) => { const v = root.evalNum ? evalNum(s) : +s; return isFinite(v) ? v : NaN; };
  const lab = (t, n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), n);
  const inp = (v, label, wide) => el('input', { class: 'search cv-in', value: String(v), inputmode: 'decimal', autocomplete: 'off', 'aria-label': label, style: wide ? {} : {} });
  const kv = (card, k, v) => card.append(el('div', { class: 'dt-kv' }, el('span', { text: k }), el('span', { class: 'mono', text: v })));
  const sel = (opts, cur, label) => el('select', { class: 'search cv-in', 'aria-label': label }, opts.map(([v, t]) => el('option', { value: v, text: t, selected: v === cur })));

  /* ---------------------------------------------------------------- complex numbers (thin films) */
  const cx = (re, im = 0) => ({ re, im });
  const cadd = (a, b) => cx(a.re + b.re, a.im + b.im), csub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const cabs2 = (a) => a.re * a.re + a.im * a.im;
  const csqrt = (a) => { const r = Math.hypot(a.re, a.im), re = Math.sqrt((r + a.re) / 2), im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (r - a.re) / 2)); return cx(re, a.im === 0 && a.re < 0 ? Math.sqrt(-a.re) : im); };
  const ccos = (a) => cx(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
  const csin = (a) => cx(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
  /** "1.38", "2.0+0.01i", "1.5 - 0.002i" → complex refractive index n + ik (k ≥ 0 absorbs) */
  function parseN(s) { const m = String(s).replace(/\s+/g, '').replace(/j$/, 'i').match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)(?:([-+])([\d.]+(?:e[-+]?\d+)?)\*?i)?$/i); if (!m) return null; return cx(+m[1], m[2] ? Math.abs(+m[3]) : 0); }

  /* ---------------------------------------------------------------- Sellmeier materials */
  function materials() {
    const out = [];
    const C = root.CONSTANTS || (typeof CONSTANTS !== 'undefined' ? CONSTANTS : []);
    for (const g of C) for (const it of g.items) if (it.sell) out.push({ name: it.n, c: it.sell });
    return out;
  }
  const sellN = (c, l) => { const l2 = l * l; let s = 1; for (let k = 0; k < c.length; k += 2) s += c[k] * l2 / (l2 - c[k + 1]); return Math.sqrt(s); };
  /** n, derivatives and dispersion at λ (µm) */
  function disp(c, l) {
    const n = sellN(c, l), h1 = 1e-4, h2 = 1e-3, h3 = 4e-3;
    const d1 = (sellN(c, l + h1) - sellN(c, l - h1)) / (2 * h1);
    const d2 = (sellN(c, l + h2) - 2 * n + sellN(c, l - h2)) / (h2 * h2);
    const d3 = (sellN(c, l + 2 * h3) - 2 * sellN(c, l + h3) + 2 * sellN(c, l - h3) - sellN(c, l - 2 * h3)) / (2 * h3 ** 3);
    const L = l * 1e-6, D2 = d2 * 1e12, D3 = d3 * 1e18;            // per m², per m³
    const ng = n - l * d1, b2 = L ** 3 / (2 * PI * C0 * C0) * D2, b3 = -(L ** 4) / (4 * PI * PI * C0 ** 3) * (3 * D2 + L * D3);
    return { n, d1, d2, d3, ng, vg: C0 / ng, b2, b3, D: -(L / C0) * D2 };
  }

  const Optics = {
    tool: 'lw',
    /** lw(body) draws the linewidth & photon tool, which lives in converter.js */
    build(b, app, lw) {
      const T = this;
      const fn = { lw: () => lw(body), beam: () => T.beam(body, app), disp: () => T.dispersion(body, app), etalon: () => T.etalon(body, app), film: () => T.film(body, app) };
      const seg = el('div', { class: 'seg seg-wrap', style: { margin: '2px 0 8px' } });
      for (const [k, l] of [['lw', 'Δν ↔ Δλ'], ['beam', 'Beam'], ['disp', 'Dispersion'], ['etalon', 'Etalon'], ['film', 'Thin film']]) { const x = el('button', { text: l, class: T.tool === k ? 'on' : '' }); x.onclick = () => { T.tool = k; seg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); body.innerHTML = ''; fn[k](); }; seg.append(x); }
      const body = el('div'); b.append(seg, body); fn[T.tool]();
    },

    /* ---------------------------------------------------------------- Gaussian beam through ABCD elements */
    beam(b) {
      const S = this.bs = this.bs || { lam: '1550', w0: '5.2', m2: '1', target: '', els: [['space', '100'], ['lens', '50'], ['space', '60']] };
      const lamI = inp(S.lam, 'Wavelength nm'), w0I = inp(S.w0, 'Waist radius µm'), m2I = inp(S.m2, 'M squared'), tgI = inp(S.target, 'Target waist µm');
      tgI.placeholder = 'optional';
      const list = el('div'), out = el('div'), plot = new Plot({ height: 220, xlabel: 'z (mm)', ylabel: 'w (µm)' });
      const KINDS = [['space', 'Space d (mm)'], ['lens', 'Lens f (mm)'], ['mirror', 'Mirror R (mm, + concave)'], ['slab', 'Slab d (mm), n'], ['matrix', 'Matrix A, B, C, D (mm)']];
      const drawList = () => {
        list.innerHTML = '';
        S.els.forEach((e, i) => {
          const k = sel(KINDS, e[0], 'Element ' + (i + 1)); const v = el('input', { class: 'search cv-in', value: e[1], 'aria-label': 'Value of element ' + (i + 1), autocomplete: 'off' });
          k.onchange = () => { e[0] = k.value; if (k.value === 'slab' && !/,/.test(e[1])) e[1] = '10, 1.5'; if (k.value === 'matrix' && (e[1].match(/,/g) || []).length < 3) e[1] = '1, 0, 0, 1'; drawList(); calc(); };
          v.onchange = () => { e[1] = v.value; calc(); };
          list.append(el('div', { class: 'cv-units', style: { alignItems: 'center' } }, el('span', { class: 'sub', text: String(i + 1), style: { width: '14px' } }), k, v, el('button', { class: 'chip', text: '✕', 'aria-label': 'Remove element ' + (i + 1), onclick: () => { S.els.splice(i, 1); drawList(); calc(); } })));
        });
      };
      const calc = () => {
        Object.assign(S, { lam: lamI.value, w0: w0I.value, m2: m2I.value, target: tgI.value });
        out.innerHTML = '';
        const lam = num(S.lam) * 1e-6, w0 = num(S.w0) * 1e-3, M2 = num(S.m2) || 1;   // mm
        if (!(lam > 0 && w0 > 0)) { out.append(el('p', { class: 'desc', text: 'Enter the wavelength and the starting waist.' })); return; }
        const lm = lam * M2;
        let q = cx(0, PI * w0 * w0 / lm), z = 0;
        const W = (q) => { const iq = cdiv(cx(1), q); return Math.sqrt(-lm / (PI * iq.im)); };
        const Rc = (q) => { const iq = cdiv(cx(1), q); return iq.re ? 1 / iq.re : Infinity; };
        const zs = [0], ws = [w0 * 1e3], marks = [];
        let Mt = [1, 0, 0, 1];
        const mat = (A, B, C, D) => { q = cdiv(cadd(cmul(cx(A), q), cx(B)), cadd(cmul(cx(C), q), cx(D))); Mt = [A * Mt[0] + B * Mt[2], A * Mt[1] + B * Mt[3], C * Mt[0] + D * Mt[2], C * Mt[1] + D * Mt[3]]; };
        for (const [kind, val] of S.els) {
          const p = String(val).split(/[,;\s]+/).filter(Boolean).map(num);
          if (kind === 'space' || kind === 'slab') {
            const d = p[0], n = kind === 'slab' ? p[1] || 1.5 : 1; if (!isFinite(d)) continue;
            const steps = 80, dd = d / n / steps;                      // a slab acts like d/n of free space for the beam
            for (let s = 1; s <= steps; s++) { mat(1, dd, 0, 1); z += d / steps; zs.push(z); ws.push(W(q) * 1e3); }
          } else if (kind === 'lens' && isFinite(p[0]) && p[0]) { mat(1, 0, -1 / p[0], 1); marks.push({ x: z, label: 'f' }); }
          else if (kind === 'mirror' && isFinite(p[0]) && p[0]) { mat(1, 0, -2 / p[0], 1); marks.push({ x: z, label: 'M' }); }
          else if (kind === 'matrix' && p.length >= 4 && p.every(isFinite)) { mat(p[0], p[1], p[2], p[3]); marks.push({ x: z, label: 'ABCD' }); }
        }
        const wEnd = W(q), REnd = Rc(q), zw = -q.re, wNew = Math.sqrt(lm * q.im / PI), zR = PI * wNew * wNew / lm;
        const card = el('div', { class: 'card dt-card' });
        kv(card, 'Rayleigh range of the input', fmt(PI * w0 * w0 / lm, 5) + ' mm');
        kv(card, 'divergence of the input (half angle)', fmt(lm / (PI * w0) * 1e3, 5) + ' mrad');
        kv(card, 'beam radius at the end', fmt(wEnd * 1e3, 5) + ' µm');
        kv(card, 'wavefront radius at the end', isFinite(REnd) ? fmt(REnd, 5) + ' mm' : '∞ (flat)');
        kv(card, 'new waist radius', fmt(wNew * 1e3, 5) + ' µm');
        kv(card, 'new waist position', (zw >= 0 ? fmt(zw, 5) + ' mm after the end' : fmt(-zw, 5) + ' mm before the end'));
        kv(card, 'new Rayleigh range', fmt(zR, 5) + ' mm');
        kv(card, 'system matrix A B; C D', [Mt[0], Mt[1], Mt[2], Mt[3]].map((x) => fmt(x, 5)).join(', '));
        const tw = num(S.target) * 1e-3;
        if (tw > 0) {
          const atWaist = 4 / (wNew / tw + tw / wNew) ** 2, curv = isFinite(REnd) ? PI * wEnd * tw / (lm * REnd) : 0, atEnd = 4 / ((wEnd / tw + tw / wEnd) ** 2 + curv * curv);
          kv(card, 'coupling into a ' + S.target + ' µm waist', (100 * atWaist).toFixed(2) + ' % at the new waist · ' + (100 * atEnd).toFixed(2) + ' % at the end plane');
        }
        out.append(card, el('p', { class: 'desc', text: 'Lengths in mm. The input waist is at z = 0. Coupling is the overlap of two Gaussian modes (fibre coupling, mode matching), ignoring tilt and offset.' }));
        plot.marks = marks.map((m) => ({ ...m, color: getComputedStyle(document.documentElement).getPropertyValue('--g2').trim() }));
        plot.set([{ xs: Float64Array.from(zs), ys: Float64Array.from(ws), mode: 'line', color: '--g1', width: 2 }, { xs: Float64Array.from(zs), ys: Float64Array.from(ws, (w) => -w), mode: 'line', color: '--g1', width: 2 }]);
      };
      for (const i of [lamI, w0I, m2I, tgI]) i.addEventListener('input', calc);
      b.append(el('div', { class: 'cv-units' }, lab('Wavelength (nm)', lamI), lab('Waist radius w₀ (µm)', w0I)), el('div', { class: 'cv-units' }, lab('M²', m2I), lab('Target waist (µm)', tgI)),
        el('h4', { class: 'cv-h', text: 'Elements, in order from the waist' }), list,
        el('div', { class: 'chips' }, ...[['space', '100'], ['lens', '100'], ['mirror', '200'], ['slab', '10, 1.5']].map(([k, v]) => el('button', { class: 'chip', text: '+ ' + { space: 'Space', lens: 'Lens', mirror: 'Mirror', slab: 'Slab' }[k], onclick: () => { S.els.push([k, v]); drawList(); calc(); } }))),
        plot.el, out);
      drawList(); calc();
    },

    /* ---------------------------------------------------------------- dispersion from Sellmeier coefficients */
    dispersion(b) {
      const mats = materials();
      const S = this.ds = this.ds || { m: 0, lam: '1.55', L: '10', custom: '', plot: 'D' };
      const mSel = sel([...mats.map((m, i) => [String(i), m.name]), ['custom', 'Your own coefficients…']], String(S.m), 'Material');
      const cust = el('input', { class: 'search mono', value: S.custom, placeholder: 'B1, C1, B2, C2, B3, C3 (C in µm²)', autocomplete: 'off', 'aria-label': 'Sellmeier coefficients' });
      const lamI = inp(S.lam, 'Wavelength µm'), LI = inp(S.L, 'Thickness mm');
      const pSel = sel([['n', 'n(λ)'], ['ng', 'group index n_g'], ['D', 'D (ps/(nm·km))'], ['b2', 'GVD β₂ (fs²/mm)']], S.plot, 'Plot');
      const out = el('div'), plot = new Plot({ height: 210, xlabel: 'λ (µm)' });
      const range = (name) => { const m = String(name).match(/([\d.]+)\s*[–-]\s*([\d.]+)\s*µm/); return m ? [+m[1], +m[2]] : [0.4, 2.5]; };
      const calc = () => {
        Object.assign(S, { m: mSel.value === 'custom' ? 'custom' : +mSel.value, lam: lamI.value, L: LI.value, custom: cust.value, plot: pSel.value });
        cust.hidden = mSel.value !== 'custom'; out.innerHTML = '';
        let c, name;
        if (mSel.value === 'custom') { c = S.custom.split(/[,;\s]+/).filter(Boolean).map(num); name = 'your material'; if (c.length < 2 || c.length % 2 || !c.every(isFinite)) { out.append(el('p', { class: 'desc', text: 'Enter pairs B, C (C in µm², as in n² = 1 + Σ Bλ²/(λ² − C)).' })); return; } }
        else { c = mats[S.m].c; name = mats[S.m].name; }
        const l = num(S.lam), L = num(S.L) * 1e-3;
        if (!(l > 0)) return;
        const d = disp(c, l), [lo, hi] = mSel.value === 'custom' ? [Math.max(0.2, l * 0.4), l * 2.5] : range(name);
        const card = el('div', { class: 'card dt-card' });
        kv(card, 'refractive index n', d.n.toFixed(7));
        kv(card, 'dn/dλ', fmt(d.d1, 6) + ' /µm');
        kv(card, 'group index n_g = n − λ dn/dλ', d.ng.toFixed(7));
        kv(card, 'group velocity c/n_g', fmt(d.vg / 1e6, 7) + ' mm/ns');
        kv(card, 'GVD β₂', fmt(d.b2 * 1e27, 6) + ' fs²/mm  (' + fmt(d.b2 * 1e27, 6) + ' ps²/km)');
        kv(card, 'dispersion D', fmt(d.D * 1e6, 6) + ' ps/(nm·km)');
        kv(card, 'third-order β₃', fmt(d.b3 * 1e42, 5) + ' fs³/mm');
        if (L > 0) { kv(card, 'group delay of ' + S.L + ' mm', fmt(L * d.ng / C0 * 1e12, 7) + ' ps'); kv(card, 'GDD of ' + S.L + ' mm', fmt(d.b2 * L * 1e30, 6) + ' fs²'); kv(card, 'TOD of ' + S.L + ' mm', fmt(d.b3 * L * 1e45, 5) + ' fs³'); }
        // zero-dispersion wavelength
        let zd = null; const Dat = (x) => disp(c, x).D;
        for (let k = 0, x0 = lo, f0 = Dat(x0); k < 200; k++) { const x1 = lo + (hi - lo) * (k + 1) / 200, f1 = Dat(x1); if (f0 * f1 < 0) { let a = x0, bb = x1, fa = f0; for (let it = 0; it < 50; it++) { const m = (a + bb) / 2, fm = Dat(m); if (fa * fm <= 0) bb = m; else { a = m; fa = fm; } } zd = (a + bb) / 2; break; } x0 = x1; f0 = f1; }
        kv(card, 'zero-dispersion wavelength', zd ? fmt(zd, 6) + ' µm' : 'none in ' + lo + '–' + hi + ' µm');
        if (l < lo || l > hi) card.append(el('p', { class: 'desc err', text: 'λ is outside the range the coefficients were fitted for (' + lo + '–' + hi + ' µm).' }));
        out.append(card, el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Copy', onclick: () => { try { navigator.clipboard.writeText(card.innerText); toast('Copied'); } catch (e) { toast('Copy is not available'); } } })));
        const xs = new Float64Array(300), ys = new Float64Array(300);
        for (let k = 0; k < 300; k++) { const x = lo + (hi - lo) * k / 299; xs[k] = x; const q = disp(c, x); ys[k] = S.plot === 'n' ? q.n : S.plot === 'ng' ? q.ng : S.plot === 'D' ? q.D * 1e6 : q.b2 * 1e27; }
        plot.opts.ylabel = { n: 'n', ng: 'n_g', D: 'D (ps/(nm·km))', b2: 'β₂ (fs²/mm)' }[S.plot];
        plot.marks = [{ x: l, label: 'λ', color: getComputedStyle(document.documentElement).getPropertyValue('--g2').trim() }];
        plot.set([{ xs, ys, mode: 'line', color: '--g1', width: 2 }]);
      };
      for (const i of [mSel, lamI, LI, cust, pSel]) { i.addEventListener('input', calc); i.addEventListener('change', calc); }
      b.append(lab('Material', mSel), cust, el('div', { class: 'cv-units' }, lab('Wavelength λ (µm)', lamI), lab('Thickness (mm, for delay and GDD)', LI)), out, lab('Plot', pSel), plot.el,
        el('p', { class: 'desc', text: 'From n² = 1 + Σ Bᵢλ²/(λ² − Cᵢ). β₂ = λ³/(2πc²)·d²n/dλ², D = −(λ/c)·d²n/dλ² (normal dispersion is D < 0, β₂ > 0).' }));
      calc();
    },

    /* ---------------------------------------------------------------- Fabry–Pérot etalon */
    etalon(b) {
      const S = this.es = this.es || { L: '10', n: '1.444', R1: '0.95', R2: '0.95', lam: '1550', th: '0' };
      const I = { L: inp(S.L, 'Length mm'), n: inp(S.n, 'Index'), R1: inp(S.R1, 'R1'), R2: inp(S.R2, 'R2'), lam: inp(S.lam, 'Wavelength nm'), th: inp(S.th, 'Angle inside deg') };
      const out = el('div'), plot = new Plot({ height: 200, xlabel: 'detuning (GHz)', ylabel: 'T' });
      const calc = () => {
        for (const k in I) S[k] = I[k].value;
        out.innerHTML = '';
        const L = num(S.L) * 1e-3, n = num(S.n), R1 = num(S.R1), R2 = num(S.R2), lam = num(S.lam) * 1e-9, th = num(S.th) * PI / 180;
        if (!(L > 0 && n > 0 && R1 >= 0 && R1 < 1 && R2 >= 0 && R2 < 1 && lam > 0)) { out.append(el('p', { class: 'desc', text: 'Enter a length, an index, reflectances between 0 and 1, and a wavelength.' })); return; }
        const R = Math.sqrt(R1 * R2), fsr = C0 / (2 * n * L * Math.cos(th)), Fin = PI * Math.sqrt(R) / (1 - R), F = 4 * R / (1 - R) ** 2;
        const dnu = fsr / Fin, nu = C0 / lam, Tmax = (1 - R1) * (1 - R2) / (1 - R) ** 2, Tmin = (1 - R1) * (1 - R2) / (1 + R) ** 2;
        const card = el('div', { class: 'card dt-card' });
        kv(card, 'free spectral range', fmt(fsr / 1e9, 6) + ' GHz  ·  ' + fmt(lam * lam * fsr / C0 * 1e12, 6) + ' pm');
        kv(card, 'finesse 𝓕 (mirrors)', fmt(Fin, 5));
        kv(card, 'coefficient of finesse F', fmt(F, 5));
        kv(card, 'linewidth (FWHM)', fmt(dnu / 1e6, 5) + ' MHz  ·  ' + fmt(lam * lam * dnu / C0 * 1e12, 5) + ' pm');
        kv(card, 'quality factor Q', fmt(nu / dnu, 5));
        kv(card, 'photon lifetime 1/(2π δν)', fmt(1 / (2 * PI * dnu) * 1e9, 5) + ' ns');
        kv(card, 'peak transmission (no loss)', (100 * Tmax).toFixed(3) + ' %');
        kv(card, 'minimum transmission', (100 * Tmin).toPrecision(4) + ' %  (contrast ' + fmt(Tmax / Tmin, 5) + ')');
        kv(card, 'mode number at λ', fmt(2 * n * L * Math.cos(th) / lam, 9));
        out.append(card, el('p', { class: 'desc', text: 'For a solid etalon use its group index for the FSR near λ (Optics → Dispersion gives n_g). With unequal mirrors the peak transmission drops below 100 %.' }));
        const xs = new Float64Array(800), ys = new Float64Array(800);
        for (let k = 0; k < 800; k++) { const d = (k / 799 - 0.5) * 3 * fsr; xs[k] = d / 1e9; ys[k] = Tmax / (1 + F * Math.sin(PI * d / fsr) ** 2); }
        plot.set([{ xs, ys, mode: 'line', color: '--g1', width: 2 }]);
      };
      for (const k in I) I[k].addEventListener('input', calc);
      b.append(el('div', { class: 'cv-units' }, lab('Length L (mm)', I.L), lab('Index n (or n_g)', I.n)), el('div', { class: 'cv-units' }, lab('Mirror R₁', I.R1), lab('Mirror R₂', I.R2)), el('div', { class: 'cv-units' }, lab('Wavelength (nm)', I.lam), lab('Angle inside (°)', I.th)), out, plot.el);
      calc();
    },

    /* ---------------------------------------------------------------- thin-film stack */
    film(b) {
      const S = this.fs = this.fs || { n0: '1', ns: '1.5168', lam0: '550', aoi: '0', pol: 'avg', from: '400', to: '800', layers: [['1.38', 'QW']] };
      const I = { n0: inp(S.n0, 'Incident medium index'), ns: inp(S.ns, 'Substrate index'), lam0: inp(S.lam0, 'Design wavelength nm'), aoi: inp(S.aoi, 'Angle of incidence deg'), from: inp(S.from, 'From nm'), to: inp(S.to, 'To nm') };
      const pol = sel([['avg', 'Unpolarised'], ['s', 's (TE)'], ['p', 'p (TM)']], S.pol, 'Polarisation');
      const list = el('div'), out = el('div'), plot = new Plot({ height: 210, xlabel: 'λ (nm)', ylabel: 'R (%)' });
      const PRE = [
        ['Bare substrate', []],
        ['MgF₂ quarter wave (AR)', [['1.38', 'QW']]],
        ['Quarter-wave mirror (HL)⁵H, TiO₂/SiO₂', [].concat(...Array(5).fill([['2.35', 'QW'], ['1.45', 'QW']]), [['2.35', 'QW']])],
        ['Quarter-wave mirror (HL)¹⁰H, Ta₂O₅/SiO₂', [].concat(...Array(10).fill([['2.1', 'QW'], ['1.45', 'QW']]), [['2.1', 'QW']])],
      ];
      const preSel = sel([['', 'Start from…'], ...PRE.map((p, i) => [String(i), p[0]])], '', 'Preset');
      preSel.onchange = () => { if (preSel.value === '') return; S.layers = PRE[+preSel.value][1].map((x) => x.slice()); preSel.value = ''; drawList(); calc(); };
      const thick = (spec, n, lam0) => { const t = String(spec).trim(); let m; if (/^QW$/i.test(t)) return lam0 / (4 * n.re); if ((m = t.match(/^([\d.]+)\s*(?:wave|λ|waves)$/i))) return +m[1] * lam0 / n.re; if ((m = t.match(/^([\d.]+)\s*QW$/i))) return +m[1] * lam0 / (4 * n.re); return num(t); };
      const drawList = () => {
        list.innerHTML = '';
        S.layers.forEach((L, i) => {
          const nI = el('input', { class: 'search cv-in', value: L[0], 'aria-label': 'Index of layer ' + (i + 1), autocomplete: 'off' }), dI = el('input', { class: 'search cv-in', value: L[1], 'aria-label': 'Thickness of layer ' + (i + 1), autocomplete: 'off' });
          nI.onchange = () => { L[0] = nI.value; calc(); }; dI.onchange = () => { L[1] = dI.value; calc(); };
          list.append(el('div', { class: 'cv-units', style: { alignItems: 'center' } }, el('span', { class: 'sub', text: String(i + 1), style: { width: '18px' } }), nI, dI, el('button', { class: 'chip', text: '✕', 'aria-label': 'Remove layer ' + (i + 1), onclick: () => { S.layers.splice(i, 1); drawList(); calc(); } })));
        });
      };
      /** reflectance and transmittance at one wavelength (nm) for one polarisation */
      const rt = (lam, n0, ns, layers, th0, p) => {
        const s0 = cx(n0.re * Math.sin(th0), 0);
        const cosT = (n) => csqrt(csub(cx(1), cdiv(cmul(s0, s0), cmul(n, n))));
        const eta = (n) => { const c = cosT(n); return p ? cdiv(n, c) : cmul(n, c); };
        let M = [cx(1), cx(0), cx(0), cx(1)];
        for (const L of layers) {
          const c = cosT(L.n), d = cmul(cx(2 * PI * L.d / lam), cmul(L.n, c)), e = eta(L.n), cs = ccos(d), sn = csin(d);
          const m = [cs, cdiv(cmul(cx(0, 1), sn), e), cmul(cx(0, 1), cmul(e, sn)), cs];
          M = [cadd(cmul(M[0], m[0]), cmul(M[1], m[2])), cadd(cmul(M[0], m[1]), cmul(M[1], m[3])), cadd(cmul(M[2], m[0]), cmul(M[3], m[2])), cadd(cmul(M[2], m[1]), cmul(M[3], m[3]))];
        }
        const e0 = eta(n0), es = eta(ns), B = cadd(M[0], cmul(M[1], es)), C = cadd(M[2], cmul(M[3], es)), den = cadd(cmul(e0, B), C);
        const r = cdiv(csub(cmul(e0, B), C), den);
        return { R: cabs2(r), T: 4 * e0.re * es.re / cabs2(den), phase: Math.atan2(r.im, r.re) };
      };
      const calc = () => {
        for (const k in I) S[k] = I[k].value; S.pol = pol.value; out.innerHTML = '';
        const n0 = parseN(S.n0), ns = parseN(S.ns), lam0 = num(S.lam0), th = num(S.aoi) * PI / 180, a = num(S.from), z = num(S.to);
        if (!n0 || !ns || !(lam0 > 0) || !(z > a)) { out.append(el('p', { class: 'desc', text: 'Check the indices, the design wavelength and the range.' })); return; }
        const layers = []; for (const [nt, dt] of S.layers) { const n = parseN(nt); if (!n) { out.append(el('p', { class: 'desc err', text: 'Can’t read the index “' + nt + '”. Write 1.38 or 0.13+3.35i.' })); return; } const d = thick(dt, n, lam0); if (!(d >= 0)) { out.append(el('p', { class: 'desc err', text: 'Can’t read the thickness “' + dt + '”: nm, QW, or a fraction of a wave like 0.25 wave.' })); return; } layers.push({ n, d }); }
        const at = (lam) => { const s = rt(lam, n0, ns, layers, th, false), p = rt(lam, n0, ns, layers, th, true); return S.pol === 's' ? s : S.pol === 'p' ? p : { R: (s.R + p.R) / 2, T: (s.T + p.T) / 2 }; };
        const c0 = at(lam0);
        const xs = new Float64Array(600), ys = new Float64Array(600); let mn = Infinity, mnx = 0, mx = -Infinity, mxx = 0;
        for (let k = 0; k < 600; k++) { const l = a + (z - a) * k / 599; xs[k] = l; ys[k] = 100 * at(l).R; if (ys[k] < mn) { mn = ys[k]; mnx = l; } if (ys[k] > mx) { mx = ys[k]; mxx = l; } }
        const card = el('div', { class: 'card dt-card' });
        kv(card, 'R at ' + lam0 + ' nm', (100 * c0.R).toPrecision(5) + ' %');
        kv(card, 'T at ' + lam0 + ' nm', (100 * c0.T).toPrecision(5) + ' %' + (Math.abs(1 - c0.R - c0.T) > 1e-6 ? '  (absorbed ' + (100 * (1 - c0.R - c0.T)).toPrecision(3) + ' %)' : ''));
        kv(card, 'lowest R in range', mn.toPrecision(4) + ' % at ' + fmt(mnx, 5) + ' nm');
        kv(card, 'highest R in range', mx.toPrecision(5) + ' % at ' + fmt(mxx, 5) + ' nm');
        kv(card, 'bare substrate R (normal incidence)', (100 * cabs2(cdiv(csub(n0, ns), cadd(n0, ns)))).toPrecision(4) + ' %');
        kv(card, 'layers · total thickness', layers.length + ' · ' + fmt(layers.reduce((s, L) => s + L.d, 0), 5) + ' nm');
        out.append(card, el('p', { class: 'desc', text: 'Layers are listed from the incident side. Thickness in nm, QW (a quarter wave at the design wavelength), or a fraction of a wave such as 0.316 wave. Indices are fixed (no dispersion); write n+ki for an absorbing layer. Light reaching the substrate is counted as transmitted (its back surface is ignored).' }));
        plot.marks = [{ x: lam0, color: getComputedStyle(document.documentElement).getPropertyValue('--g2').trim() }];
        plot.set([{ xs, ys, mode: 'line', color: '--g1', width: 2 }]);
      };
      for (const k in I) I[k].addEventListener('input', calc); pol.addEventListener('change', calc);
      b.append(el('div', { class: 'cv-units' }, lab('Incident medium n₀', I.n0), lab('Substrate n_s', I.ns)), el('div', { class: 'cv-units' }, lab('Design λ₀ (nm)', I.lam0), lab('Angle of incidence (°)', I.aoi)),
        el('div', { class: 'cv-units' }, lab('Polarisation', pol), lab('Plot from (nm)', I.from), lab('to (nm)', I.to)),
        el('h4', { class: 'cv-h', text: 'Layers: index, thickness' }), preSel, list,
        el('div', { class: 'chips' }, el('button', { class: 'chip', text: '+ Layer', onclick: () => { S.layers.push(['1.45', 'QW']); drawList(); calc(); } })), plot.el, out);
      drawList(); calc();
    },
  };
  root.OpticsTools = Optics;
  root.OpticsMath = { disp, sellN, parseN };
})(typeof self !== 'undefined' ? self : this);
