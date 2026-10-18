/*
 * trig.js — Trigonometry: a triangle solver (SSS, SAS, ASA, AAS and the ambiguous SSA case),
 * a reference of trig identities (insert or verify with the CAS) and the solvable trig formulas.
 * Shown as the Trig tab of the constants & formulas sheet. Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, Sheet } = UI;
  const PI = Math.PI;

  /* ---------------------------------------------------------------- identities: [name, tex, giac lhs, giac rhs] */
  const IDS = [
    ['Pythagorean', [
      ['', '\\sin^2\\theta+\\cos^2\\theta=1', 'sin(t)^2+cos(t)^2', '1'],
      ['', '1+\\tan^2\\theta=\\sec^2\\theta', '1+tan(t)^2', '1/cos(t)^2'],
      ['', '1+\\cot^2\\theta=\\csc^2\\theta', '1+cot(t)^2', '1/sin(t)^2'],
    ]],
    ['Reciprocal & quotient', [
      ['', '\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}', 'tan(t)', 'sin(t)/cos(t)'],
      ['', '\\cot\\theta=\\frac{\\cos\\theta}{\\sin\\theta}', 'cot(t)', 'cos(t)/sin(t)'],
      ['', '\\sec\\theta=\\frac{1}{\\cos\\theta}', '', ''], ['', '\\csc\\theta=\\frac{1}{\\sin\\theta}', '', ''],
    ]],
    ['Symmetry & cofunction', [
      ['', '\\sin(-\\theta)=-\\sin\\theta', 'sin(-t)', '-sin(t)'], ['', '\\cos(-\\theta)=\\cos\\theta', 'cos(-t)', 'cos(t)'], ['', '\\tan(-\\theta)=-\\tan\\theta', 'tan(-t)', '-tan(t)'],
      ['', '\\sin\\left(\\frac{\\pi}{2}-\\theta\\right)=\\cos\\theta', 'sin(pi/2-t)', 'cos(t)'], ['', '\\cos\\left(\\frac{\\pi}{2}-\\theta\\right)=\\sin\\theta', 'cos(pi/2-t)', 'sin(t)'],
      ['', '\\sin(\\pi-\\theta)=\\sin\\theta', 'sin(pi-t)', 'sin(t)'], ['', '\\cos(\\pi-\\theta)=-\\cos\\theta', 'cos(pi-t)', '-cos(t)'],
    ]],
    ['Sum & difference', [
      ['', '\\sin(\\alpha\\pm\\beta)=\\sin\\alpha\\cos\\beta\\pm\\cos\\alpha\\sin\\beta', 'sin(u+v)', 'sin(u)*cos(v)+cos(u)*sin(v)'],
      ['', '\\cos(\\alpha\\pm\\beta)=\\cos\\alpha\\cos\\beta\\mp\\sin\\alpha\\sin\\beta', 'cos(u+v)', 'cos(u)*cos(v)-sin(u)*sin(v)'],
      ['', '\\tan(\\alpha\\pm\\beta)=\\frac{\\tan\\alpha\\pm\\tan\\beta}{1\\mp\\tan\\alpha\\tan\\beta}', 'tan(u+v)', '(tan(u)+tan(v))/(1-tan(u)*tan(v))'],
    ]],
    ['Double angle', [
      ['', '\\sin2\\theta=2\\sin\\theta\\cos\\theta', 'sin(2*t)', '2*sin(t)*cos(t)'],
      ['', '\\cos2\\theta=\\cos^2\\theta-\\sin^2\\theta', 'cos(2*t)', 'cos(t)^2-sin(t)^2'],
      ['', '\\cos2\\theta=2\\cos^2\\theta-1=1-2\\sin^2\\theta', 'cos(2*t)', '2*cos(t)^2-1'],
      ['', '\\tan2\\theta=\\frac{2\\tan\\theta}{1-\\tan^2\\theta}', 'tan(2*t)', '2*tan(t)/(1-tan(t)^2)'],
    ]],
    ['Triple angle', [
      ['', '\\sin3\\theta=3\\sin\\theta-4\\sin^3\\theta', 'sin(3*t)', '3*sin(t)-4*sin(t)^3'],
      ['', '\\cos3\\theta=4\\cos^3\\theta-3\\cos\\theta', 'cos(3*t)', '4*cos(t)^3-3*cos(t)'],
    ]],
    ['Half angle', [
      ['', '\\sin\\frac{\\theta}{2}=\\pm\\sqrt{\\frac{1-\\cos\\theta}{2}}', '', ''],
      ['', '\\cos\\frac{\\theta}{2}=\\pm\\sqrt{\\frac{1+\\cos\\theta}{2}}', '', ''],
      ['', '\\tan\\frac{\\theta}{2}=\\frac{\\sin\\theta}{1+\\cos\\theta}=\\frac{1-\\cos\\theta}{\\sin\\theta}', 'tan(t/2)', 'sin(t)/(1+cos(t))'],
    ]],
    ['Power reduction', [
      ['', '\\sin^2\\theta=\\frac{1-\\cos2\\theta}{2}', 'sin(t)^2', '(1-cos(2*t))/2'],
      ['', '\\cos^2\\theta=\\frac{1+\\cos2\\theta}{2}', 'cos(t)^2', '(1+cos(2*t))/2'],
      ['', '\\tan^2\\theta=\\frac{1-\\cos2\\theta}{1+\\cos2\\theta}', 'tan(t)^2', '(1-cos(2*t))/(1+cos(2*t))'],
    ]],
    ['Product to sum', [
      ['', '\\sin\\alpha\\sin\\beta=\\tfrac12[\\cos(\\alpha-\\beta)-\\cos(\\alpha+\\beta)]', 'sin(u)*sin(v)', '(cos(u-v)-cos(u+v))/2'],
      ['', '\\cos\\alpha\\cos\\beta=\\tfrac12[\\cos(\\alpha-\\beta)+\\cos(\\alpha+\\beta)]', 'cos(u)*cos(v)', '(cos(u-v)+cos(u+v))/2'],
      ['', '\\sin\\alpha\\cos\\beta=\\tfrac12[\\sin(\\alpha+\\beta)+\\sin(\\alpha-\\beta)]', 'sin(u)*cos(v)', '(sin(u+v)+sin(u-v))/2'],
    ]],
    ['Sum to product', [
      ['', '\\sin\\alpha+\\sin\\beta=2\\sin\\frac{\\alpha+\\beta}{2}\\cos\\frac{\\alpha-\\beta}{2}', 'sin(u)+sin(v)', '2*sin((u+v)/2)*cos((u-v)/2)'],
      ['', '\\sin\\alpha-\\sin\\beta=2\\cos\\frac{\\alpha+\\beta}{2}\\sin\\frac{\\alpha-\\beta}{2}', 'sin(u)-sin(v)', '2*cos((u+v)/2)*sin((u-v)/2)'],
      ['', '\\cos\\alpha+\\cos\\beta=2\\cos\\frac{\\alpha+\\beta}{2}\\cos\\frac{\\alpha-\\beta}{2}', 'cos(u)+cos(v)', '2*cos((u+v)/2)*cos((u-v)/2)'],
      ['', '\\cos\\alpha-\\cos\\beta=-2\\sin\\frac{\\alpha+\\beta}{2}\\sin\\frac{\\alpha-\\beta}{2}', 'cos(u)-cos(v)', '-2*sin((u+v)/2)*sin((u-v)/2)'],
    ]],
    ['Euler & hyperbolic', [
      ['', 'e^{i\\theta}=\\cos\\theta+i\\sin\\theta', 'exp(i*t)', 'cos(t)+i*sin(t)'],
      ['', '\\sin\\theta=\\frac{e^{i\\theta}-e^{-i\\theta}}{2i}', 'sin(t)', '(exp(i*t)-exp(-i*t))/(2*i)'],
      ['', '\\cos\\theta=\\frac{e^{i\\theta}+e^{-i\\theta}}{2}', 'cos(t)', '(exp(i*t)+exp(-i*t))/2'],
      ['', '\\cosh^2x-\\sinh^2x=1', 'cosh(t)^2-sinh(t)^2', '1'],
    ]],
    ['Triangles (a, b, c opposite A, B, C)', [
      ['Law of sines', '\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}=2R', '', ''],
      ['Law of cosines', 'c^2=a^2+b^2-2ab\\cos C', '', ''],
      ['Law of tangents', '\\frac{a-b}{a+b}=\\frac{\\tan\\frac{A-B}{2}}{\\tan\\frac{A+B}{2}}', '', ''],
      ['Area', 'K=\\tfrac12ab\\sin C=\\sqrt{s(s-a)(s-b)(s-c)}', '', ''],
      ['Inradius', 'r=\\frac{K}{s},\\quad s=\\frac{a+b+c}{2}', '', ''],
      ['Mollweide', '\\frac{a+b}{c}=\\frac{\\cos\\frac{A-B}{2}}{\\sin\\frac{C}{2}}', '', ''],
    ]],
  ];
  /* exact values on the unit circle */
  const UNIT = [['0', '0', '0', '1', '0'], ['30', '\\frac{\\pi}{6}', '\\frac12', '\\frac{\\sqrt3}{2}', '\\frac{\\sqrt3}{3}'], ['45', '\\frac{\\pi}{4}', '\\frac{\\sqrt2}{2}', '\\frac{\\sqrt2}{2}', '1'], ['60', '\\frac{\\pi}{3}', '\\frac{\\sqrt3}{2}', '\\frac12', '\\sqrt3'], ['90', '\\frac{\\pi}{2}', '1', '0', '\\text{undef}'], ['120', '\\frac{2\\pi}{3}', '\\frac{\\sqrt3}{2}', '-\\frac12', '-\\sqrt3'], ['135', '\\frac{3\\pi}{4}', '\\frac{\\sqrt2}{2}', '-\\frac{\\sqrt2}{2}', '-1'], ['150', '\\frac{5\\pi}{6}', '\\frac12', '-\\frac{\\sqrt3}{2}', '-\\frac{\\sqrt3}{3}'], ['180', '\\pi', '0', '-1', '0']];

  /* ---------------------------------------------------------------- triangle solving (pure math, radians) */
  /** s: [a,b,c] (null when unknown), A: [A,B,C] radians. Returns { sols: [{s,A}], note } or { err } */
  function solveTriangle(s, A) {
    const ks = [0, 1, 2].filter((i) => s[i] != null), ka = [0, 1, 2].filter((i) => A[i] != null);
    if (ks.some((i) => !(s[i] > 0))) return { err: 'Sides must be positive.' };
    if (ka.some((i) => !(A[i] > 0 && A[i] < PI))) return { err: 'Angles must be between 0 and 180° (0 and π).' };
    if (ks.length + ka.length < 3) return { err: 'Enter three values, at least one of them a side.' };
    if (!ks.length) return { err: 'Three angles fix the shape but not the size — enter at least one side.' };
    if (ka.reduce((t, i) => t + A[i], 0) >= PI - 1e-12) return { err: 'The angles add up to 180° or more.' };
    const sinesFrom = (S, AA, k) => { const r = S[k] / Math.sin(AA[k]); return [0, 1, 2].map((i) => (S[i] != null ? S[i] : r * Math.sin(AA[i]))); };
    const anglesSSS = (S) => { const [a, b, c] = S; const cl = (x) => Math.max(-1, Math.min(1, x)); const Aa = Math.acos(cl((b * b + c * c - a * a) / (2 * b * c))), Bb = Math.acos(cl((a * a + c * c - b * b) / (2 * a * c))); return [Aa, Bb, PI - Aa - Bb]; };
    let sols = [], note = '';
    if (ka.length >= 2) {                                      // ASA / AAS
      const AA = A.slice(); const miss = [0, 1, 2].find((i) => AA[i] == null); if (miss != null) AA[miss] = PI - AA.reduce((t, x) => t + (x || 0), 0);
      const S = sinesFrom(s.slice(), AA, ks[0]); sols = [{ s: S, A: AA }]; note = ka.length === 2 ? (ks.length === 1 && ka.includes(ks[0]) ? 'AAS' : 'ASA') : '';
    } else if (ks.length === 3) {                              // SSS
      const [a, b, c] = s; if (a + b <= c || a + c <= b || b + c <= a) return { err: 'No triangle: each side must be shorter than the other two together.' };
      sols = [{ s: s.slice(), A: anglesSSS(s) }]; note = 'SSS';
    } else if (ks.length === 2 && ka.length === 1) {
      const i = ka[0];
      if (s[i] == null) {                                      // SAS: the angle is between the two known sides
        const [j, k] = ks; const si = Math.sqrt(s[j] * s[j] + s[k] * s[k] - 2 * s[j] * s[k] * Math.cos(A[i]));
        const S = s.slice(); S[i] = si; const AA = anglesSSS(S); AA[i] = A[i]; const o = [0, 1, 2].filter((x) => x !== i);
        AA[o[1]] = PI - A[i] - AA[o[0]]; sols = [{ s: S, A: AA }]; note = 'SAS';
      } else {                                                 // SSA: the ambiguous case
        const j = i, k = ks.find((x) => x !== j), m = 3 - j - k;
        const sk = s[k] * Math.sin(A[j]) / s[j];
        if (sk > 1 + 1e-12) return { err: 'No triangle: side ' + 'abc'[j] + ' is too short to reach (SSA).' };
        const base = Math.asin(Math.min(1, sk));
        for (const Ak of Math.abs(sk - 1) < 1e-12 ? [PI / 2] : [base, PI - base]) {
          if (A[j] + Ak >= PI - 1e-12) continue;
          const AA = [0, 0, 0]; AA[j] = A[j]; AA[k] = Ak; AA[m] = PI - A[j] - Ak;
          const S = s.slice(); S[m] = s[j] / Math.sin(A[j]) * Math.sin(AA[m]); sols.push({ s: S, A: AA });
        }
        if (!sols.length) return { err: 'No triangle fits these values (SSA).' };
        note = sols.length === 2 ? 'SSA — the ambiguous case: two triangles fit' : 'SSA';
      }
    }
    // over-determined input: check the extra values agree
    for (const t of sols) {
      for (const i of ks) if (Math.abs(t.s[i] - s[i]) > 1e-6 * s[i]) return { err: 'These values are inconsistent (side ' + 'abc'[i] + ' does not fit). Clear one of them.' };
      for (const i of ka) if (Math.abs(t.A[i] - A[i]) > 1e-6) return { err: 'These values are inconsistent (angle ' + 'ABC'[i] + ' does not fit). Clear one of them.' };
    }
    return { sols, note };
  }
  function extras(t) {
    const [a, b, c] = t.s, P = a + b + c, sp = P / 2, K = 0.5 * a * b * Math.sin(t.A[2]);
    return { K, P, ha: 2 * K / a, hb: 2 * K / b, hc: 2 * K / c, R: a / (2 * Math.sin(t.A[0])), r: K / sp };
  }

  const Trig = {
    sub: 'tri', unit: null, vals: { a: '', b: '', c: '', A: '', B: '', C: '' },
    build(b, app) {
      this.app = app; if (!this.unit) this.unit = 'deg';
      const seg = el('div', { class: 'seg', style: { marginBottom: '10px' } });
      for (const [k, l] of [['tri', 'Triangle solver'], ['id', 'Identities'], ['form', 'Trig formulas']]) { const x = el('button', { text: l, class: this.sub === k ? 'on' : '' }); x.onclick = () => { this.sub = k; Sheet.render(); }; seg.append(x); }
      b.append(seg);
      if (this.sub === 'tri') this.triangle(b); else if (this.sub === 'id') this.identities(b); else this.formulas(b);
    },
    /* ---------------- triangle solver */
    triangle(b) {
      const app = this.app, deg = () => this.unit === 'deg';
      const fig = el('div', { class: 'tri-fig' }); b.append(fig);
      const us = el('div', { class: 'seg' }); for (const [k, l] of [['deg', 'Degrees'], ['rad', 'Radians']]) { const x = el('button', { text: l, class: this.unit === k ? 'on' : '' }); x.onclick = () => { this.unit = k; us.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); }; us.append(x); }
      b.append(el('div', { class: 'tri-top' }, el('span', { class: 'desc', text: 'Enter any three values (at least one side), then Solve.' }), us));
      const grid = el('div', { class: 'tri-in' }); const inp = {};
      for (const k of ['a', 'b', 'c', 'A', 'B', 'C']) {
        const i = el('input', { class: 'search', value: this.vals[k], inputmode: 'decimal', autocomplete: 'off', 'aria-label': (k === k.toLowerCase() ? 'side ' : 'angle ') + k, placeholder: k === k.toLowerCase() ? 'side' : 'angle' });
        i.oninput = () => { this.vals[k] = i.value; }; inp[k] = i;
        grid.append(el('label', { class: 'cv-lab' }, el('span', { text: (k === k.toLowerCase() ? 'side ' : 'angle ') + k }), i));
      }
      const out = el('div', { class: 'tri-out' });
      const parse = (v, ang) => {
        v = v.trim(); if (!v) return null;
        let n = Number(v.replace(',', '.'));
        if (!isFinite(n)) {
          const js = v.replace(/,/g, '.').replace(/π|pi/gi, '(PI)').replace(/√/g, 'sqrt').replace(/\^/g, '**').replace(/×/g, '*').replace(/÷/g, '/');
          if (/[^0-9.+\-*/()eE ]/.test(js.replace(/PI|sqrt/g, ''))) n = NaN;
          else { try { n = Function('PI', 'sqrt', '"use strict";return (' + js + ')')(PI, Math.sqrt); } catch (e) { n = NaN; } }
        }
        if (!isFinite(n)) throw new Error('“' + v + '” is not a number');
        return ang && deg() ? n * PI / 180 : n;
      };
      const draw = (t) => { fig.innerHTML = this.svg(t); };
      draw(null);
      const solve = () => {
        out.innerHTML = '';
        let S, A; try { S = ['a', 'b', 'c'].map((k) => parse(inp[k].value, false)); A = ['A', 'B', 'C'].map((k) => parse(inp[k].value, true)); } catch (e) { out.append(el('p', { class: 'desc err', text: e.message })); return; }
        const r = solveTriangle(S, A);
        if (r.err) { out.append(el('p', { class: 'desc err', text: r.err })); draw(null); return; }
        const show = (t, n) => {
          const box = el('div', { class: 'card tri-res' });
          if (r.sols.length > 1) box.append(el('b', { text: 'Triangle ' + (n + 1) }));
          const x = extras(t); const angTxt = (v) => deg() ? +(v * 180 / PI).toPrecision(10) + '°' : +v.toPrecision(10) + ' rad';
          const rows = [['a', t.s[0]], ['b', t.s[1]], ['c', t.s[2]], ['A', t.A[0], 1], ['B', t.A[1], 1], ['C', t.A[2], 1], ['Area', x.K], ['Perimeter', x.P], ['h_a', x.ha], ['h_b', x.hb], ['h_c', x.hc], ['R (circumradius)', x.R], ['r (inradius)', x.r]];
          const tbl = el('div', { class: 'tri-tbl' });
          for (const [k, v, ang] of rows) {
            const val = ang ? (deg() ? v * 180 / PI : v) : v; const txt = ang ? angTxt(v) : String(+v.toPrecision(10));
            const given = (k.length === 1) && this.vals[k].trim() !== '';
            tbl.append(el('span', { class: 'k' + (given ? ' given' : ''), text: k }), el('span', { class: 'v mono', text: txt }),
              el('button', { class: 'chip', text: 'Insert', onclick: () => { Sheet.close(); app.insert(String(+val.toPrecision(12)).replace(/e([-+]?\d+)/, '\\times10^{$1}')); } }));
          }
          box.append(tbl);
          box.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Draw', onclick: () => draw(t) }), el('button', { class: 'btn', text: 'Store a, b, c, A, B, C', onclick: async () => {
            const defs = ['a', 'b', 'c'].map((k, i) => 'tri_' + k + ':=' + +t.s[i].toPrecision(14)).concat(['A', 'B', 'C'].map((k, i) => 'tri_' + k + ':=' + +(deg() ? t.A[i] * 180 / PI : t.A[i]).toPrecision(14)));
            await app.cas.batch(defs); for (const d of defs) { const n2 = d.split(':=')[0]; app.cas.forget(n2); app.cas.remember(d); app.vars.add(n2); }
            app.saveSoon(); toast('Stored tri_a, tri_b, tri_c, tri_A, tri_B, tri_C');
          } })));
          out.append(box);
        };
        if (r.note) out.append(el('p', { class: 'desc', text: r.note }));
        r.sols.forEach(show); draw(r.sols[0]);
      };
      b.append(grid, el('div', { class: 'btnrow' },
        el('button', { class: 'btn pri', text: 'Solve', onclick: solve }),
        el('button', { class: 'btn', text: 'Right angle C', onclick: () => { inp.C.value = this.vals.C = deg() ? '90' : String(PI / 2); } }),
        el('button', { class: 'btn', text: 'Clear', onclick: () => { for (const k in inp) inp[k].value = this.vals[k] = ''; out.innerHTML = ''; draw(null); } })), out);
    },
    svg(t) {
      let s = t ? t.s : [5, 4.2, 6], A = t ? t.A : [0.95, 0.73, 1.46];
      const [a, b, c] = s; const P = [[0, 0], [c, 0], [b * Math.cos(A[0]), b * Math.sin(A[0])]];
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); const minx = Math.min(...xs), maxx = Math.max(...xs), maxy = Math.max(...ys);
      const W = 300, H = 150, pad = 26, k = Math.min((W - 2 * pad) / (maxx - minx || 1), (H - 2 * pad) / (maxy || 1));
      const Q = P.map(([x, y]) => [pad + (x - minx) * k + ((W - 2 * pad) - (maxx - minx) * k) / 2, H - pad - y * k]);
      const cx = (Q[0][0] + Q[1][0] + Q[2][0]) / 3, cy = (Q[0][1] + Q[1][1] + Q[2][1]) / 3;
      const lab = (p, txt, d, cls) => { const dx = p[0] - cx, dy = p[1] - cy, n = Math.hypot(dx, dy) || 1; return '<text class="' + cls + '" x="' + (p[0] + dx / n * d).toFixed(1) + '" y="' + (p[1] + dy / n * d + 5).toFixed(1) + '">' + txt + '</text>'; };
      const mid = (i, j) => [(Q[i][0] + Q[j][0]) / 2, (Q[i][1] + Q[j][1]) / 2];
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Triangle with sides a, b, c opposite angles A, B, C"><polygon points="' + Q.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ') + '"/>' +
        lab(Q[0], 'A', 14, 'v') + lab(Q[1], 'B', 14, 'v') + lab(Q[2], 'C', 14, 'v') + lab(mid(1, 2), 'a', 12, 's') + lab(mid(0, 2), 'b', 12, 's') + lab(mid(0, 1), 'c', 12, 's') + '</svg>';
    },
    /* ---------------- identities */
    identities(b) {
      const app = this.app;
      b.append(el('p', { class: 'desc', text: 'Tap Insert to put an identity into the CAS line, or Verify to have the CAS check it symbolically.' }));
      // unit circle table
      const uc = el('div', { class: 'card tri-uc' });
      const head = ['θ°', 'θ', '\\sin', '\\cos', '\\tan'];
      const tb = el('div', { class: 'uc-grid' }); head.forEach((h, i) => { const c = el('b'); if (i) renderTex(c, h); else c.textContent = h; tb.append(c); });
      for (const r of UNIT) r.forEach((v, i) => { const c = el('span'); if (i) renderTex(c, v); else c.textContent = v + '°'; tb.append(c); });
      uc.append(el('b', { text: 'Exact values' }), tb); b.append(uc);
      for (const [grp, list] of IDS) {
        b.append(el('h4', { class: 'cv-h', text: grp }));
        const L = el('div', { class: 'tri-ids' });
        for (const [name, tex, lhs, rhs] of list) {
          const m = el('div', { class: 'tex' }); renderTex(m, tex);
          const res = el('span', { class: 'sub' });
          const acts = el('div', { class: 'acts' }, el('button', { class: 'chip', text: 'Insert', onclick: () => { Sheet.close(); app.insert(tex.replace(/\\tfrac/g, '\\frac').replace(/\\pm/g, '+').replace(/\\mp/g, '-').replace(/=2R$/, '')); } }));
          if (lhs) acts.append(el('button', { class: 'chip', text: 'Verify', onclick: async () => {
            res.textContent = 'checking…';
            const D = ('(' + lhs + ')-(' + rhs + ')').replace(/\bi\b/g, '(sqrt(-1))'), at = (p) => 'evalf(abs(subst(' + D + ',[t,u,v],[' + p + '])))';
            const r = await app.cas.batch(['angle_radian:=1', 'complex_mode:=1', 'simplify(texpand(tlin(' + D + ')))', 'simplify(exp2trig(texpand(' + D + ')))', at('0.37,0.61,1.13'), at('1.9,-0.8,2.4'), 'angle_radian:=' + (app.settings.angle === 'deg' ? 0 : 1), 'complex_mode:=' + (app.settings.complex === 'real' ? 0 : 1)]);
            const z = (x) => String(x).trim() === '0', small = (x) => Math.abs(Number(x)) < 1e-9;
            res.textContent = z(r[2]) || z(r[3]) ? '✓ the CAS confirms it' : small(r[4]) && small(r[5]) ? '✓ holds (the CAS checked it numerically)' : 'The CAS gives a difference of ' + r[2];
          } }));
          L.append(el('div', { class: 'row' }, name ? el('b', { text: name }) : '', m, acts, res));
        }
        b.append(L);
      }
    },
    /* ---------------- trig formulas (solved with the library's solver) */
    formulas(b) {
      const list = el('ul', { class: 'mlist' });
      for (const f of FORMULAS.filter((x) => x.cat === 'Trigonometry')) {
        const btn = el('button', { class: 'mi', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } }, el('span', { class: 'lbl', text: f.n, style: { fontWeight: '600' } }));
        const t = el('div', { style: { fontSize: '17px', maxWidth: '100%', overflowX: 'auto' } }); renderTex(t, f.tex); btn.append(t);
        btn.onclick = () => Sheet.push(f.n, (bb) => Library.solver(bb, f));
        list.append(el('li', {}, btn));
      }
      b.append(el('p', { class: 'desc', text: 'Pick a formula, fill in what you know and solve for the rest. Angles follow the calculator’s angle mode (' + (this.app.settings.angle === 'deg' ? 'degrees' : 'radians') + ').' }), list);
    },
  };
  root.Trig = Trig; root.solveTriangle = solveTriangle;
})(typeof self !== 'undefined' ? self : this);
