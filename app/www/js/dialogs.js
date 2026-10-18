/*
 * dialogs.js — Nspire-style wizards: one/two-variable statistics, regressions
 * (linear … logistic, sinusoidal) and the finance (TVM) solver.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, Sheet } = UI;

  /* ---------------- numerics ---------------- */
  function solveLinear(A, b) { // Gaussian elimination with partial pivoting
    const n = b.length; A = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      if (Math.abs(A[c][c]) < 1e-300) throw new Error('The data can’t determine this model');
      for (let r = 0; r < n; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j]; }
    }
    return A.map((r, i) => r[n] / r[i]);
  }
  function polyfit(x, y, d) {
    const M = Array.from({ length: d + 1 }, (_, i) => Array.from({ length: d + 1 }, (_, j) => x.reduce((s, xi) => s + xi ** (2 * d - i - j), 0)));
    const v = Array.from({ length: d + 1 }, (_, i) => x.reduce((s, xi, k) => s + y[k] * xi ** (d - i), 0));
    return solveLinear(M, v); // highest power first
  }
  function lm(f, p0, x, y, iters = 200) { // Levenberg–Marquardt
    let p = p0.slice(), lam = 1e-3;
    const res = (q) => x.map((xi, i) => y[i] - f(xi, q));
    const sse = (r) => r.reduce((s, v) => s + v * v, 0);
    let r = res(p), e = sse(r);
    for (let it = 0; it < iters; it++) {
      const J = x.map((xi) => p.map((_, j) => { const h = 1e-6 * Math.max(1, Math.abs(p[j])); const q = p.slice(); q[j] += h; return (f(xi, q) - f(xi, p)) / h; }));
      const JT = p.map((_, j) => J.map((row) => row[j]));
      const A = JT.map((rj) => JT.map((rk) => rj.reduce((s, v, i) => s + v * rk[i], 0)));
      const g = JT.map((rj) => rj.reduce((s, v, i) => s + v * r[i], 0));
      let improved = false;
      for (let t = 0; t < 10; t++) {
        const Ad = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (v || 1) : 0)));
        let d; try { d = solveLinear(Ad, g); } catch (err) { lam *= 10; continue; }
        const q = p.map((v, j) => v + d[j]); const rq = res(q), eq = sse(rq);
        if (eq < e) { p = q; r = rq; const de = e - eq; e = eq; lam = Math.max(lam / 10, 1e-12); improved = true; if (de < 1e-15 * (1 + e)) it = iters; break; }
        lam *= 10;
      }
      if (!improved) break;
    }
    return p;
  }
  function r2(x, y, f) { const my = y.reduce((a, b) => a + b, 0) / y.length; let ss = 0, st = 0; x.forEach((xi, i) => { ss += (y[i] - f(xi)) ** 2; st += (y[i] - my) ** 2; }); return 1 - ss / st; }
  const num = (v, d = 10) => (isFinite(v) ? +v.toPrecision(d) : v);

  const MODELS = {
    linear: { name: 'Linear regression (mx+b)', eq: 'm·x+b', fit(x, y) { const [m, b] = polyfit(x, y, 1); return { p: { m, b }, f: (t) => m * t + b, giac: `${m}*x+${b}` }; } },
    quad: { name: 'Quadratic regression', eq: 'a·x²+b·x+c', fit(x, y) { const [a, b, c] = polyfit(x, y, 2); return { p: { a, b, c }, f: (t) => a * t * t + b * t + c, giac: `${a}*x^2+${b}*x+${c}` }; } },
    cubic: { name: 'Cubic regression', eq: 'a·x³+b·x²+c·x+d', fit(x, y) { const [a, b, c, d] = polyfit(x, y, 3); return { p: { a, b, c, d }, f: (t) => ((a * t + b) * t + c) * t + d, giac: `${a}*x^3+${b}*x^2+${c}*x+${d}` }; } },
    quartic: { name: 'Quartic regression', eq: 'a·x⁴+b·x³+c·x²+d·x+e', fit(x, y) { const [a, b, c, d, e] = polyfit(x, y, 4); return { p: { a, b, c, d, e }, f: (t) => (((a * t + b) * t + c) * t + d) * t + e, giac: `${a}*x^4+${b}*x^3+${c}*x^2+${d}*x+${e}` }; } },
    power: { name: 'Power regression', eq: 'a·x^b', fit(x, y) { if (x.some((v) => v <= 0) || y.some((v) => v <= 0)) throw new Error('Power regression needs positive x and y'); const [b, la] = polyfit(x.map(Math.log), y.map(Math.log), 1); const a = Math.exp(la); return { p: { a, b }, f: (t) => a * t ** b, giac: `${a}*x^${b}`, lin: true }; } },
    exp: { name: 'Exponential regression', eq: 'a·b^x', fit(x, y) { if (y.some((v) => v <= 0)) throw new Error('Exponential regression needs positive y'); const [lb, la] = polyfit(x, y.map(Math.log), 1); const a = Math.exp(la), b = Math.exp(lb); return { p: { a, b }, f: (t) => a * b ** t, giac: `${a}*${b}^x`, lin: true }; } },
    log: { name: 'Logarithmic regression', eq: 'a+b·ln(x)', fit(x, y) { if (x.some((v) => v <= 0)) throw new Error('Logarithmic regression needs positive x'); const [b, a] = polyfit(x.map(Math.log), y, 1); return { p: { a, b }, f: (t) => a + b * Math.log(t), giac: `${a}+${b}*ln(x)` }; } },
    sin: { name: 'Sinusoidal regression', eq: 'a·sin(b·x+c)+d', fit(x, y) {
      const n = x.length, my = y.reduce((s, v) => s + v, 0) / n, amp = (Math.max(...y) - Math.min(...y)) / 2;
      // period guess from mean crossings
      let cr = []; for (let i = 1; i < n; i++) if ((y[i - 1] - my) * (y[i] - my) < 0) cr.push(x[i]);
      const per = cr.length > 1 ? 2 * (cr[cr.length - 1] - cr[0]) / (cr.length - 1) : (x[n - 1] - x[0]);
      let best = null;
      for (const c0 of [0, 1.5, 3, 4.5]) { const p = lm((t, q) => q[0] * Math.sin(q[1] * t + q[2]) + q[3], [amp, 2 * Math.PI / per, c0, my], x, y); const e = x.reduce((s, t, i) => s + (y[i] - (p[0] * Math.sin(p[1] * t + p[2]) + p[3])) ** 2, 0); if (!best || e < best.e) best = { p, e }; }
      const [a, b, c, d] = best.p; return { p: { a, b, c, d }, f: (t) => a * Math.sin(b * t + c) + d, giac: `${a}*sin(${b}*x+${c})+${d}` };
    } },
    logistic: { name: 'Logistic regression', eq: 'c/(1+a·e^(−b·x))', fit(x, y) {
      const c0 = Math.max(...y) * 1.05, mx = x.reduce((s, v) => s + v, 0) / x.length;
      const p = lm((t, q) => q[2] / (1 + q[0] * Math.exp(-q[1] * t)), [Math.exp(mx), 1, c0], x, y, 400);
      const [a, b, c] = p; return { p: { a, b, c }, f: (t) => c / (1 + a * Math.exp(-b * t)), giac: `${c}/(1+${a}*exp(-${b}*x))` };
    } },
  };

  /* ---------------- shared form helpers ---------------- */
  async function listNames(app) { return [...app.vars].sort(); }
  async function getList(app, src) {
    const ctx = { userFuncs: app.userFuncs, vars: app.vars };
    let code = src.trim();
    if (!/^[A-Za-z]\w*$/.test(code)) code = Tex2Giac.tex2giac(code.replace(/^\{/, '\\lbrace ').replace(/\}$/, '\\rbrace'), ctx);
    const out = await app.cas.eval('evalf(' + code + ')');
    const ast = GiacFmt.parse(out);
    if (ast.t !== 'vec') throw new Error(src + ' is not a list');
    return ast.items.map((n) => Number(GiacFmt.compile(n, [])()));
  }
  function listField(label, names, val) {
    const inp = el('input', { list: 'dl-' + label.replace(/\W/g, ''), value: val || '', placeholder: 'list name or {1,2,3}', autocapitalize: 'off', spellcheck: 'false' });
    const dl = el('datalist', { id: 'dl-' + label.replace(/\W/g, '') }, names.map((n) => el('option', { value: n })));
    return [el('label', { class: 'field' }, label, inp, dl), inp];
  }
  function calcPage(app) { let i = app.pages.findIndex((p) => p.kind === 'calc'); if (i < 0) { app.addPage('calc'); i = app.pages.length - 1; } else app.select(i); return app.pages[i]; }
  async function storeStats(app, rows) {
    const codes = rows.filter(([k, v]) => isFinite(v)).map(([k, v]) => 'stat_' + k.replace(/[^\w]/g, '') + ':=' + v);
    for (const c of codes) { app.cas.remember(c); app.vars.add(c.split(':=')[0]); }
    await app.cas.batch(codes);
  }

  /* ---------------- dialogs ---------------- */
  const Dialogs = {
    async open(app, spec) {
      const names = await listNames(app);
      if (spec.dialog === 'onevar') return this.onevar(app, names);
      if (spec.dialog === 'twovar') return this.twovar(app, names);
      if (spec.dialog === 'reg') return this.reg(app, names, spec.reg);
      if (spec.dialog === 'tvm') return this.tvm(app);
      if (spec.dialog === 'eff' || spec.dialog === 'nom') return this.interest(app, spec.dialog);
    },
    onevar(app, names) {
      Sheet.open('One-variable statistics', (b) => {
        const [f1, xl] = listField('X list', names, names[0]); const [f2, fl] = listField('Frequency list (optional)', names, '');
        b.append(f1, f2, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Calculate', onclick: async () => {
          try {
            let x = await getList(app, xl.value); const fr = fl.value.trim() ? await getList(app, fl.value) : x.map(() => 1);
            const xs = []; x.forEach((v, i) => { for (let k = 0; k < Math.round(fr[i]); k++) xs.push(v); });
            const n = xs.length, s = xs.reduce((a, v) => a + v, 0), s2 = xs.reduce((a, v) => a + v * v, 0), m = s / n;
            const ss = xs.reduce((a, v) => a + (v - m) ** 2, 0), srt = xs.slice().sort((a, c) => a - c);
            const med = (arr) => { const k = arr.length; return k % 2 ? arr[(k - 1) / 2] : (arr[k / 2 - 1] + arr[k / 2]) / 2; };
            const lo = srt.slice(0, Math.floor(n / 2)), hi = srt.slice(Math.ceil(n / 2));
            const rows = [['x̄', m], ['Σx', s], ['Σx²', s2], ['sx := sn-1x', Math.sqrt(ss / (n - 1))], ['σx := σnx', Math.sqrt(ss / n)], ['n', n], ['MinX', srt[0]], ['Q₁X', med(lo)], ['MedianX', med(srt)], ['Q₃X', med(hi)], ['MaxX', srt[n - 1]], ['SSX := Σ(x-x̄)²', ss]];
            Sheet.close(); calcPage(app).pushTable('One-variable statistics', '\\operatorname{OneVar}\\ ' + xl.value, rows.map(([k, v]) => [k, num(v)]));
            storeStats(app, [['mean', m], ['sx', Math.sqrt(ss / (n - 1))], ['sigmax', Math.sqrt(ss / n)], ['n', n], ['median', med(srt)]]);
          } catch (e) { toast(e.message); }
        } })), el('p', { class: 'desc', text: 'Results are also stored as stat_mean, stat_sx, stat_sigmax, stat_n and stat_median.' }));
      });
    },
    twovar(app, names) {
      Sheet.open('Two-variable statistics', (b) => {
        const [f1, xl] = listField('X list', names, names[0]); const [f2, yl] = listField('Y list', names, names[1]);
        b.append(f1, f2, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Calculate', onclick: async () => {
          try {
            const x = await getList(app, xl.value), y = await getList(app, yl.value); if (x.length !== y.length) throw new Error('The lists must be the same length');
            const n = x.length, S = (a) => a.reduce((s, v) => s + v, 0), mx = S(x) / n, my = S(y) / n;
            const sxx = S(x.map((v) => (v - mx) ** 2)), syy = S(y.map((v) => (v - my) ** 2)), sxy = S(x.map((v, i) => (v - mx) * (y[i] - my)));
            const rows = [['x̄', mx], ['Σx', S(x)], ['Σx²', S(x.map((v) => v * v))], ['sx', Math.sqrt(sxx / (n - 1))], ['σx', Math.sqrt(sxx / n)], ['n', n], ['ȳ', my], ['Σy', S(y)], ['Σy²', S(y.map((v) => v * v))], ['sy', Math.sqrt(syy / (n - 1))], ['σy', Math.sqrt(syy / n)], ['Σxy', S(x.map((v, i) => v * y[i]))], ['r', sxy / Math.sqrt(sxx * syy)], ['MinX', Math.min(...x)], ['MaxX', Math.max(...x)], ['MinY', Math.min(...y)], ['MaxY', Math.max(...y)]];
            Sheet.close(); calcPage(app).pushTable('Two-variable statistics', '\\operatorname{TwoVar}\\ ' + xl.value + ',' + yl.value, rows.map(([k, v]) => [k, num(v)]));
          } catch (e) { toast(e.message); }
        } })));
      });
    },
    reg(app, names, model) {
      const M = MODELS[model];
      Sheet.open(M.name, (b) => {
        const [f1, xl] = listField('X list', names, names[0]); const [f2, yl] = listField('Y list', names, names[1]);
        const fn = el('input', { value: 'f' + (1 + [...app.userFuncs].filter((n) => /^f\d+$/.test(n)).length), autocapitalize: 'off' });
        const graph = el('input', { type: 'checkbox', checked: true });
        b.append(el('p', { class: 'desc', text: 'Model: y = ' + M.eq }), f1, f2, el('label', { class: 'field' }, 'Save equation to', fn), el('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '15px', marginBottom: '8px' } }, graph, 'Graph the data and the fit'),
          el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Calculate', onclick: async () => {
            try {
              const x = await getList(app, xl.value), y = await getList(app, yl.value);
              if (x.length !== y.length) throw new Error('The lists must be the same length');
              if (x.length < Object.keys({ linear: 2, quad: 3, cubic: 4, quartic: 5 }).length && 0) {}
              const R = M.fit(x, y);
              const rr = r2(R.lin ? x : x, y, R.f);
              const rows = [['RegEqn', M.eq]].concat(Object.entries(R.p).map(([k, v]) => [k, num(v)]), [['R²', num(rr)]]);
              if (model === 'linear') { const sx = x.reduce((s, v) => s + v, 0) / x.length; rows.push(['r', num(Math.sign(R.p.m) * Math.sqrt(Math.max(0, rr)))]); }
              const name = fn.value.trim();
              if (/^[A-Za-z]\w*$/.test(name)) { const code = name + '(x):=' + R.giac.replace(/\+-/g, '-'); await app.cas.eval(code); app.cas.forget(name); app.cas.remember(code); app.userFuncs.add(name); }
              Sheet.close();
              calcPage(app).pushTable(M.name, '\\operatorname{' + model + 'Reg}\\ ' + xl.value + ',' + yl.value, rows.map(([k, v]) => [k, typeof v === 'string' ? '"' + v + '"' : v]));
              if (graph.checked) {
                let gi = app.pages.findIndex((p) => p.kind === 'graph'); if (gi < 0) { app.addPage('graph'); gi = app.pages.length - 1; } else app.select(gi);
                const g = app.pages[gi];
                const sf = { name: g.nextNameFor('scatter'), type: 'scatter', color: g.fns.length, on: true, tex: (/^\w+$/.test(xl.value) ? '\\operatorname{' + xl.value + '}' : xl.value) + ',' + (/^\w+$/.test(yl.value) ? '\\operatorname{' + yl.value + '}' : yl.value) };
                g.fns.push(sf); await g.compile(sf);
                g.addFunction(R.giac.replace(/\+-/g, '-'));
                const xs = x, ys = y, padx = (Math.max(...xs) - Math.min(...xs)) * 0.1 || 1, pady = (Math.max(...ys) - Math.min(...ys)) * 0.15 || 1;
                g.view = { xmin: Math.min(...xs) - padx, xmax: Math.max(...xs) + padx, ymin: Math.min(...ys) - pady, ymax: Math.max(...ys) + pady };
                setTimeout(() => g.draw(), 50);
              }
            } catch (e) { toast(e.message); }
          } })));
      });
    },
    tvm(app) {
      Sheet.open('Finance solver', (b) => {
        const F = {}; const S = app.tvm || (app.tvm = { N: '', I: '', PV: '', PMT: '', FV: '0', PpY: '12', CpY: '12', begin: false });
        const labels = { N: 'N — number of payments', I: 'I% — annual interest rate', PV: 'PV — present value', PMT: 'Pmt — payment', FV: 'FV — future value', PpY: 'PpY — payments per year', CpY: 'CpY — compounding periods per year' };
        b.append(el('p', { class: 'desc', text: 'Fill in all but one of N, I%, PV, Pmt, FV, then tap Solve next to the one you want. Money paid out is negative.' }));
        for (const k of Object.keys(labels)) {
          const inp = el('input', { value: S[k], inputmode: 'decimal' }); F[k] = inp; inp.oninput = () => { S[k] = inp.value; };
          const row = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end' } }, el('label', { class: 'field', style: { flex: 1 } }, labels[k], inp));
          if (!/PpY|CpY/.test(k)) row.append(el('button', { class: 'btn', style: { marginBottom: '10px' }, text: 'Solve', onclick: () => solve(k) }));
          b.append(row);
        }
        const beg = el('div', { class: 'seg' }); for (const [v, l] of [[false, 'Payment at end'], [true, 'Payment at beginning']]) { const x = el('button', { text: l, class: S.begin === v ? 'on' : '' }); x.onclick = () => { S.begin = v; beg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); }; beg.append(x); }
        b.append(beg);
        const solve = (k) => {
          const v = {}; for (const key of Object.keys(labels)) v[key] = Number(F[key].value);
          const C = v.CpY || v.PpY, P = v.PpY || 1, G = (i) => 1 + (S.begin ? i : 0);
          const per = (I) => (1 + I / 100 / C) ** (C / P) - 1;
          const resid = (I, N, PV, PMT, FV) => { const i = per(I); if (Math.abs(i) < 1e-14) return PV + PMT * N + FV; return PV * (1 + i) ** N + PMT * G(i) * ((1 + i) ** N - 1) / i + FV; };
          let r;
          try {
            const i = per(v.I);
            if (k === 'PV') r = Math.abs(i) < 1e-14 ? -(v.FV + v.PMT * v.N) : -(v.FV + v.PMT * G(i) * ((1 + i) ** v.N - 1) / i) / (1 + i) ** v.N;
            else if (k === 'FV') r = Math.abs(i) < 1e-14 ? -(v.PV + v.PMT * v.N) : -(v.PV * (1 + i) ** v.N + v.PMT * G(i) * ((1 + i) ** v.N - 1) / i);
            else if (k === 'PMT') r = Math.abs(i) < 1e-14 ? -(v.PV + v.FV) / v.N : -(v.FV + v.PV * (1 + i) ** v.N) * i / (G(i) * ((1 + i) ** v.N - 1));
            else if (k === 'N') r = Math.abs(i) < 1e-14 ? -(v.PV + v.FV) / v.PMT : Math.log((v.PMT * G(i) - v.FV * i) / (v.PMT * G(i) + v.PV * i)) / Math.log(1 + i);
            else if (k === 'I') { let lo = -99.999, hi = 1000, flo = resid(lo, v.N, v.PV, v.PMT, v.FV); for (let t = 0; t < 200; t++) { const m = (lo + hi) / 2, fm = resid(m, v.N, v.PV, v.PMT, v.FV); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } } r = (lo + hi) / 2; if (Math.abs(resid(r, v.N, v.PV, v.PMT, v.FV)) > 1e-6 * (1 + Math.abs(v.PV) + Math.abs(v.FV))) throw new Error('No interest rate fits these values'); }
            if (!isFinite(r)) throw new Error('These values have no solution');
            F[k].value = S[k] = String(+r.toPrecision(10)); toast(k + ' = ' + (+r.toPrecision(10)));
          } catch (e) { toast(e.message); }
        };
      });
    },
    interest(app, which) {
      Sheet.open(which === 'eff' ? 'Nominal → effective rate' : 'Effective → nominal rate', (b) => {
        const r = el('input', { inputmode: 'decimal', value: '5' }), c = el('input', { inputmode: 'decimal', value: '12' }), out = el('div', { class: 'card', hidden: true });
        b.append(el('label', { class: 'field' }, (which === 'eff' ? 'Nominal' : 'Effective') + ' rate (%)', r), el('label', { class: 'field' }, 'Compounding periods per year', c),
          el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Convert', onclick: () => { const R = Number(r.value), C = Number(c.value); const v = which === 'eff' ? 100 * ((1 + R / 100 / C) ** C - 1) : 100 * C * ((1 + R / 100) ** (1 / C) - 1); out.hidden = false; out.textContent = (which === 'eff' ? 'Effective' : 'Nominal') + ' rate = ' + (+v.toPrecision(10)) + ' %'; } })), out);
      });
    },
  };
  root.Dialogs = Dialogs; root.Regression = { MODELS, polyfit, lm };
})(typeof self !== 'undefined' ? self : this);
