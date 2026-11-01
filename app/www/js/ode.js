/*
 * ode.js — the Differential Equations tab. Ordinary differential equations of any order, one equation or a system:
 *   - exact solutions from Giac (desolve), with initial or boundary conditions, or the general solution with
 *     constants; linear constant-coefficient systems by the Laplace transform
 *   - numeric solutions (adaptive Runge–Kutta, Dormand–Prince 5(4)) for anything with initial values, linear or not:
 *     a plot against the variable or a phase plane, a slope field for one first-order equation, a table, and values
 *     at any point
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, mathField, Sheet } = UI;

  /* ---------------- reading the equations ---------------- */

  /** Leibniz and dot notation → primes, so dy/dt, d²y/dt², ẏ all become y′, y″ */
  function primesTex(tex) {
    const D = '(?:\\\\mathrm\\{d\\}|\\\\operatorname\\{d\\}|d)';
    const P = (n) => "'".repeat(n);
    let ind = null;
    tex = tex.replace(new RegExp('\\\\frac\\{' + D + '(?:\\^\\{?(\\d)\\}?)?\\s*\\\\?([A-Za-z]+)\\s*\\}\\{' + D + '\\s*\\\\?([A-Za-z]+)\\s*(?:\\^\\{?\\d\\}?)?\\}', 'g'),
      (m, n, u, v) => { ind = ind || v; return (u.length > 1 ? '\\' + u : u) + P(+(n || 1)); });
    tex = tex.replace(/\\dddot\{([^{}]+)\}/g, (m, u) => u + P(3)).replace(/\\ddot\{([^{}]+)\}/g, (m, u) => u + P(2)).replace(/\\dot\{([^{}]+)\}/g, (m, u) => u + P(1));
    // y^{\prime\prime} and y^{\doubleprime} → y''
    tex = tex.replace(/\^\{((?:\\prime|\\doubleprime|')+)\}/g, (m, p) => P((p.match(/\\prime|'/g) || []).length + 2 * (p.match(/\\doubleprime/g) || []).length));
    tex = tex.replace(/\^\{\\prime\}|\^\\prime|\\prime/g, "'");
    return { tex, ind };
  }

  const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega', 'pi', 'inf', 'infinity', 'undef']);
  /** in an equation, xy means x·y (the Calculator reads it as one name): split letter runs that aren't a known name */
  function splitNames(app, g) {
    const known = (n) => GREEK.has(n) || (app.vars && app.vars.has && app.vars.has(n)) || (app.userFuncs && app.userFuncs.has && app.userFuncs.has(n));
    return g.replace(/(?<![A-Za-z0-9_.])([A-Za-z]{2,})(?![A-Za-z0-9_(])/g, (m) => (known(m) ? m : m.split('').join('*')));
  }
  function toGiac(app, tex) {
    const ctx = { degrees: false, userFuncs: app.userFuncs, vars: app.vars };
    return splitNames(app, Tex2Giac.tex2giac(tex, ctx));
  }

  const ID = '[A-Za-z_][A-Za-z0-9_]*';
  const RESERVED = new Set(['e', 'i', 'pi', 'sin', 'cos', 'tan', 'exp', 'ln', 'log', 'sqrt', 'abs', 'diff', 'Heaviside', 'Dirac']);

  /** Parse the equations and conditions into a problem: unknowns, their orders, the variable, Giac code */
  function readProblem(app, eqTex, icTex, indChoice) {
    const eqs = [], ics = [];
    let ind = null;
    for (const t of eqTex) {
      if (!t || !t.trim()) continue;
      const p = primesTex(t); if (p.ind) ind = ind || p.ind;
      let g = toGiac(app, p.tex);
      // diff(y,t) and diff(y,t,2) → primes
      g = g.replace(new RegExp('diff\\((' + ID + '),(' + ID + ')(?:,(\\d))?\\)', 'g'), (m, u, v, n) => { ind = ind || v; return u + "'".repeat(+(n || 1)); });
      eqs.push(g);
    }
    if (!eqs.length) throw new Error('Enter an equation, like y′ = −2y');
    // the unknowns: names with a prime
    const order = {};
    for (const g of eqs) for (const m of g.matchAll(new RegExp('(?<![A-Za-z0-9_])(' + ID + ")('+)", 'g'))) order[m[1]] = Math.max(order[m[1]] || 0, m[2].length);
    const unknowns = Object.keys(order);
    if (!unknowns.length) throw new Error('No derivative found: write y′ (the ′ key), dy/dt or d/dt(y)');
    if (indChoice && indChoice !== 'auto') ind = indChoice;
    if (!ind) {
      const used = new Set(); for (const g of eqs) for (const m of g.matchAll(new RegExp('(?<![A-Za-z0-9_])(' + ID + ')(?![A-Za-z0-9_(])', 'g'))) used.add(m[1]);
      ind = ['t', 'x'].find((v) => used.has(v) && !order[v]) || (order.x ? 't' : unknowns.includes('t') ? 'x' : 't');
    }
    if (order[ind]) throw new Error(ind + ' is both the variable and an unknown: choose the variable in Options');
    // y(t), y*(t) → y; a product y*(…) stays a product
    const tidy = (g) => {
      for (const u of unknowns) g = g.replace(new RegExp('(?<![A-Za-z0-9_])' + u + "('*)\\*?\\(\\s*" + ind + '\\s*\\)', 'g'), (m, p) => u + p);
      return g;
    };
    for (let i = 0; i < eqs.length; i++) { eqs[i] = tidy(eqs[i]); if (!/=/.test(eqs[i])) eqs[i] += '=0'; }
    for (const t of icTex) {
      if (!t || !t.trim()) continue;
      const g = toGiac(app, primesTex(t).tex);
      const k = g.indexOf('='); if (k < 0) throw new Error('Write a condition like y(0) = 1');
      const lhs = g.slice(0, k).trim(), val = g.slice(k + 1).trim();
      const m = lhs.match(new RegExp('^(' + ID + ")('*)\\*?\\((.+)\\)$"));
      if (!m || !order[m[1]]) throw new Error('Write a condition like ' + unknowns[0] + '(0) = 1 or ' + unknowns[0] + '′(0) = 0');
      if (m[2].length >= order[m[1]]) throw new Error(m[1] + "'".repeat(m[2].length) + ' can’t be given: the equation sets it');
      ics.push({ u: m[1], k: m[2].length, at: m[3], val });
    }
    return { eqs, ics, ind, order, unknowns, system: unknowns.length > 1 };
  }

  const isErr = (s) => !s || /GIAC_ERROR|Error/.test(s);
  const unwrapList = (s) => { s = s.trim(); return s.startsWith('[') && s.endsWith(']') ? splitTop(s.slice(1, -1)) : [s]; };
  function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }

  /* ---------------- exact solutions ---------------- */

  /** decimals → fractions, so the exact solution reads 10/(19e^(−4t/5)+1) rather than 10./(19.e^(−0.8t)+1.) */
  const rational = (g) => g.replace(/(?<![A-Za-z0-9_.])(\d*)\.(\d+)(?![0-9.])/g, (m, a, b) => '(' + (a + b).replace(/^0+(?=\d)/, '') + '/1' + '0'.repeat(b.length) + ')');
  async function exact(app, P0) {
    const cas = app.cas;
    const P = { ...P0, eqs: P0.eqs.map(rational), ics: P0.ics.map((c) => ({ ...c, at: rational(c.at), val: rational(c.val) })) };
    if (!P.system) {
      const u = P.unknowns[0];
      const conds = P.ics.filter((c) => c.u === u).map((c) => u + "'".repeat(c.k) + '(' + c.at + ')=' + c.val);
      const code = 'desolve([' + [P.eqs[0], ...conds].join(',') + '],' + P.ind + ',' + u + ')';
      if (P.eqs.length > 1) return { fail: 'One unknown needs one equation' };
      const out = await cas.eval(code);
      if (!isErr(out)) {
        const sols = unwrapList(out).filter((x) => x && x !== '[]');
        if (sols.length) return { sols: sols.map((s) => ({ u, expr: s })), how: 'desolve' };
      }
      const L = await laplace(app, P); if (L && !L.fail) return L;
      return { fail: 'No closed form found' };
    }
    const L = await laplace(app, P);
    return L && L.fail ? { fail: 'No closed form: exact solutions of systems need linear equations with constant coefficients' + (/conditions at/.test(L.fail) ? ' and conditions at ' + P.ind + ' = 0' : '') } : L;
  }

  /** linear, constant-coefficient equations (one or a system) with conditions at 0: the Laplace transform */
  async function laplace(app, P) {
    const cas = app.cas, s = 'ode_s', T = P.ind;
    if (P.ics.some((c) => isErr(c.at) || !/^\s*0(\.0*)?\s*$/.test(c.at))) return { fail: 'The Laplace method needs conditions at ' + T + ' = 0' };
    // the derivatives become symbols D_u_k; the known initial values y(0), y′(0)… or constants when not given
    const sym = (u, k) => 'ode_' + u + '_' + k, Ls = (u) => 'ode_L' + u;
    const init = (u, k) => { const c = P.ics.find((x) => x.u === u && x.k === k); return c ? '(' + c.val + ')' : u + '_' + k; };
    const toSym = (g) => { for (const u of P.unknowns) g = g.replace(new RegExp('(?<![A-Za-z0-9_])' + u + "('*)(?![A-Za-z0-9_])", 'g'), (m, p) => sym(u, p.length)); return g; };
    const allSyms = []; for (const u of P.unknowns) for (let k = 0; k <= P.order[u]; k++) allSyms.push(sym(u, k));
    const exprs = P.eqs.map((g) => { const [a, b] = [g.slice(0, g.indexOf('=')), g.slice(g.indexOf('=') + 1)]; return '(' + toSym(a) + ')-(' + toSym(b) + ')'; });
    if (exprs.length !== P.unknowns.length) return { fail: 'A system needs one equation per unknown' };
    // coefficients must be constants: check with diff
    const coefCodes = []; for (const e of exprs) for (const v of allSyms) coefCodes.push('normal(diff(' + e + ',' + v + '))');
    const coefs = await cas.batch(coefCodes);
    if (coefs.some(isErr)) return { fail: 'Not linear' };
    const varsRe = new RegExp('(?<![A-Za-z0-9_])(' + [T, ...allSyms].join('|') + ')(?![A-Za-z0-9_])');
    if (coefs.some((c) => varsRe.test(c))) return { fail: 'Not linear with constant coefficients' };
    const forc = await cas.batch(exprs.map((e) => 'normal(subst(' + e + ',[' + allSyms.join(',') + '],[' + allSyms.map(() => 0).join(',') + ']))'));
    if (forc.some(isErr)) return { fail: 'Not linear' };
    const lf = await cas.batch(forc.map((f) => 'laplace(' + f + ',' + T + ',' + s + ')'));
    if (lf.some(isErr) || lf.some((x) => /laplace/.test(x))) return { fail: 'No Laplace transform for the forcing' };
    // L{u^(k)} = s^k U − Σ s^(k−1−j) u^(j)(0)
    const Lder = (u, k) => { let t = s + '^' + k + '*' + Ls(u); for (let j = 0; j < k; j++) t += '-' + s + '^' + (k - 1 - j) + '*' + init(u, j); return '(' + t + ')'; };
    let ci = 0; const leqs = exprs.map((e, i) => { let t = '(' + lf[i] + ')'; for (const u of P.unknowns) for (let k = 0; k <= P.order[u]; k++) { const c = coefs[ci++]; if (c !== '0') t += '+(' + c + ')*' + Lder(u, k); } return t + '=0'; });
    const solved = await cas.eval('linsolve([' + leqs.join(',') + '],[' + P.unknowns.map(Ls).join(',') + '])');
    if (isErr(solved) || solved.trim() === '[]') return { fail: 'The transformed equations have no single solution' };
    const Us = unwrapList(solved);
    const inv = await cas.batch(Us.map((U) => 'normal(exp2trig(ilaplace(' + U + ',' + s + ',' + T + ')))'));
    if (inv.some(isErr) || inv.some((x) => /ilaplace|ode_s/.test(x))) return { fail: 'No inverse transform' };
    const simp = await cas.batch(inv.map((x) => 'simplify(' + x + ')'));
    const best = inv.map((x, i) => (!isErr(simp[i]) && simp[i].length < x.length ? simp[i] : x));
    return { sols: P.unknowns.map((u, i) => ({ u, expr: best[i] })), how: 'Laplace transform' };
  }

  /* ---------------- numeric solutions ---------------- */

  /** the first-order system Y′ = F(t, Y): state names, initial values, compiled right-hand sides */
  async function firstOrder(app, P) {
    const cas = app.cas, T = P.ind;
    const st = (u, k) => 'ode_' + u + '_' + k;
    const state = []; for (const u of P.unknowns) for (let k = 0; k < P.order[u]; k++) state.push({ u, k, name: st(u, k) });
    const toSym = (g) => { for (const u of P.unknowns) g = g.replace(new RegExp('(?<![A-Za-z0-9_])' + u + "('*)(?![A-Za-z0-9_])", 'g'), (m, p) => st(u, p.length)); return g; };
    const top = P.unknowns.map((u) => st(u, P.order[u]));
    const eqs = P.eqs.map(toSym);
    if (eqs.length < P.unknowns.length) throw new Error('Enter one equation for each unknown (' + P.unknowns.join(', ') + ')');
    let out = await cas.eval('linsolve([' + eqs.join(',') + '],[' + top.join(',') + '])');
    let rhs = !isErr(out) && out.trim() !== '[]' ? unwrapList(out) : null;
    if (!rhs && P.unknowns.length === 1) {
      out = await cas.eval('solve(' + eqs[0] + ',' + top[0] + ')');
      const m = !isErr(out) && out.match(new RegExp(top[0] + '\\s*=\\s*\\(?(.+?)\\)?\\s*\\)?(?:\\s+or\\b|$)'));
      if (m) rhs = [m[1]];
    }
    if (!rhs || rhs.length !== top.length) throw new Error('Can’t solve the equations for ' + P.unknowns.map((u) => u + "'".repeat(P.order[u])).join(', '));
    const vars = [T, ...state.map((x) => x.name)];
    const fns = [];
    for (const r of rhs) {
      let f = null;
      try { f = GiacFmt.compile(r, vars); } catch (e) {
        const ev = await cas.eval('evalf(' + r + ')');
        try { f = GiacFmt.compile(ev, vars); } catch (e2) {
          const fv = e2.message.match(/free variable (\w+)/);
          throw new Error(fv ? 'Give ' + fv[1] + ' a value (store it in the Calculator with →) or make it a number' : 'This equation can’t be solved numerically: ' + e2.message);
        }
      }
      fns.push(f);
    }
    // the right-hand side: Y′ = F(t, Y)
    const idx = {}; state.forEach((x, i) => { idx[x.name] = i; });
    const F = (t, Y, dY) => {
      for (let i = 0; i < state.length; i++) {
        const x = state[i];
        dY[i] = x.k < P.order[x.u] - 1 ? Y[idx[st(x.u, x.k + 1)]] : fns[P.unknowns.indexOf(x.u)](t, ...Y);
      }
      return dY;
    };
    return { state, F, rhs, vars };
  }

  /** initial values at one point for every state component */
  async function initialValues(app, P, state) {
    if (!P.ics.length) return null;
    const pts = await app.cas.batch(P.ics.map((c) => 'evalf(' + c.at + ')'));
    const vals = await app.cas.batch(P.ics.map((c) => 'evalf(' + c.val + ')'));
    const num = (s) => { try { return Number(GiacFmt.compile(s, [])()); } catch (e) { return NaN; } };
    const at = pts.map(num), v = vals.map(num);
    if (at.some((x) => !isFinite(x))) return { err: 'Each condition needs a number for ' + P.ind };
    if (v.some((x) => !isFinite(x))) return { err: 'Each condition needs a number value (store constants first)' };
    const t0 = at[0];
    if (at.some((x) => Math.abs(x - t0) > 1e-12 * (1 + Math.abs(t0)))) return { err: 'boundary' };
    const Y0 = new Float64Array(state.length).fill(NaN);
    P.ics.forEach((c, i) => { const j = state.findIndex((x) => x.u === c.u && x.k === c.k); Y0[j] = v[i]; });
    const missing = state.filter((x, i) => !isFinite(Y0[i]));
    if (missing.length) return { err: 'missing', missing, t0 };
    return { t0, Y0 };
  }

  /** Dormand–Prince 5(4) with step control; returns every accepted step with its derivative, for dense output */
  function rk45(F, t0, Y0, t1, opt = {}) {
    const n = Y0.length, dir = Math.sign(t1 - t0) || 1, rtol = opt.rtol || 1e-8, atol = opt.atol || 1e-10, maxSteps = opt.maxSteps || 100000;
    const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
    const A = [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
      [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]];
    const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40];
    const K = Array.from({ length: 7 }, () => new Float64Array(n)), Yt = new Float64Array(n);
    let t = t0, Y = Float64Array.from(Y0);
    F(t, Y, K[0]);
    const ts = [t], Ys = [Float64Array.from(Y)], Fs = [Float64Array.from(K[0])];
    let h = opt.h0 || Math.abs(t1 - t0) / 200 || 1e-3, steps = 0, stop = null;
    const span = Math.abs(t1 - t0);
    while (dir * (t1 - t) > 1e-14 * (1 + span)) {
      if (++steps > maxSteps) { stop = 'too many steps (the equation may be stiff)'; break; }
      if (h > Math.abs(t1 - t)) h = Math.abs(t1 - t);
      const hs = dir * h;
      for (let s = 1; s < 7; s++) {
        for (let i = 0; i < n; i++) { let a = Y[i]; for (let j = 0; j < s; j++) a += hs * A[s][j] * K[j][i]; Yt[i] = a; }
        F(t + C[s] * hs, Yt, K[s]);
      }
      // Yt now holds the 5th-order result (row 7 = b); K[6] = F(t+h, Yt) (FSAL)
      let err = 0;
      for (let i = 0; i < n; i++) {
        let e = 0; for (let j = 0; j < 7; j++) e += E[j] * K[j][i];
        const sc = atol + rtol * Math.max(Math.abs(Y[i]), Math.abs(Yt[i]));
        err = Math.max(err, Math.abs(hs * e) / sc);
      }
      if (!isFinite(err)) { h /= 4; if (h < 1e-14 * (1 + Math.abs(t))) { stop = 'the solution is undefined or blows up'; break; } continue; }
      if (err <= 1) {
        t += hs; Y = Float64Array.from(Yt);
        ts.push(t); Ys.push(Y); Fs.push(Float64Array.from(K[6])); K[0].set(K[6]);
        if (Y.some((v) => Math.abs(v) > 1e15)) { stop = 'the solution blows up'; break; }
      }
      const fac = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(err, -0.2)));
      h *= fac;
      if (h < 1e-13 * (1 + Math.abs(t))) { stop = 'the solution blows up or is singular'; break; }
    }
    return { ts, Ys, Fs, stop, tEnd: t };
  }

  /** a numeric solution over [a, b], integrating both ways from t0 */
  function solveRange(F, t0, Y0, a, b) {
    const fw = b > t0 ? rk45(F, t0, Y0, b) : null, bw = a < t0 ? rk45(F, t0, Y0, a) : null;
    const ts = [], Ys = [], Fs = [];
    if (bw) for (let i = bw.ts.length - 1; i > 0; i--) { ts.push(bw.ts[i]); Ys.push(bw.Ys[i]); Fs.push(bw.Fs[i]); }
    const base = fw || bw || { ts: [t0], Ys: [Float64Array.from(Y0)], Fs: [(() => { const d = new Float64Array(Y0.length); F(t0, Y0, d); return d; })()] };
    for (let i = 0; i < base.ts.length; i++) { ts.push(base.ts[i]); Ys.push(base.Ys[i]); Fs.push(base.Fs[i]); }
    const notes = [];
    if (fw && fw.stop) notes.push('Stopped at ' + fmt(fw.tEnd) + ': ' + fw.stop + '.');
    if (bw && bw.stop) notes.push('Stopped at ' + fmt(bw.tEnd) + ' (going back): ' + bw.stop + '.');
    const sol = { ts, Ys, Fs, notes, lo: ts[0], hi: ts[ts.length - 1] };
    sol.at = (t) => interp(sol, t);
    return sol;
  }

  /** cubic Hermite between steps */
  function interp(S, t) {
    const ts = S.ts, n = ts.length;
    if (t < S.lo - 1e-12 || t > S.hi + 1e-12 || n === 0) return null;
    if (n === 1) return Float64Array.from(S.Ys[0]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
    const h = ts[hi] - ts[lo], s = h ? (t - ts[lo]) / h : 0;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
    const y0 = S.Ys[lo], y1 = S.Ys[hi], f0 = S.Fs[lo], f1 = S.Fs[hi], out = new Float64Array(y0.length);
    for (let i = 0; i < y0.length; i++) out[i] = h00 * y0[i] + h10 * h * f0[i] + h01 * y1[i] + h11 * h * f1[i];
    return out;
  }

  function fmt(x, p = 6) {
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e6 || a < 1e-4) { const [m, e] = x.toExponential(p - 1).split('e'); return (+m).toString() + 'ᴇ' + (+e); }
    return (+x.toPrecision(p)).toString();
  }
  const numTex = (x, p) => fmt(x, p).replace(/ᴇ(-?\d+)$/, '\\cdot 10^{$1}');
  const nameTex = (x) => x.u.length > 1 && /^(alpha|beta|gamma|delta|theta|phi|psi|omega|sigma|lambda|mu|rho|tau|chi|xi|eta|zeta|kappa|nu)$/i.test(x.u) ? '\\' + x.u : x.u;
  const compLabel = (x) => x.u + '′'.repeat(x.k);
  const compTex = (x, T) => nameTex(x) + "'".repeat(x.k) + '(' + T + ')';

  /* ---------------- examples ---------------- */
  const EXAMPLES = [
    ['Exponential decay', 'First order, linear', ["y'=-2y"], ['y\\left(0\\right)=3'], { to: '3' }],
    ['Logistic growth', 'First order, nonlinear', ["y'=0.8y\\left(1-\\frac{y}{10}\\right)"], ['y\\left(0\\right)=0.5'], { to: '12' }],
    ['Newton’s cooling', 'T′ = −k(T − 20)', ["T'=-0.1\\left(T-20\\right)"], ['T\\left(0\\right)=90'], { ind: 't', to: '40' }],
    ['Damped oscillator', 'Second order, linear', ["y''+0.4y'+4y=0"], ['y\\left(0\\right)=1', "y'\\left(0\\right)=0"], { to: '15' }],
    ['Forced, resonant', 'General solution with constants', ["y''+y=\\sin\\left(t\\right)"], [], { to: '20' }],
    ['RLC circuit', 'L q″ + R q′ + q/C = V', ["0.5q''+2q'+\\frac{q}{0.01}=12"], ['q\\left(0\\right)=0', "q'\\left(0\\right)=0"], { ind: 't', to: '2' }],
    ['Boundary value problem', 'Exact only: conditions at two points', ["y''+y=0"], ['y\\left(0\\right)=1', 'y\\left(\\frac{\\pi}{2}\\right)=2'], { ind: 'x', to: '6' }],
    ['Cauchy–Euler', 'x²y″ + xy′ − y = 0', ["x^2y''+xy'-y=0"], ['y\\left(1\\right)=1', "y'\\left(1\\right)=0"], { ind: 'x', from: '0.2', to: '5' }],
    ['Coupled springs', 'Linear system, Laplace transform', ["x''=-2x+y", "y''=x-2y"], ['x\\left(0\\right)=1', "x'\\left(0\\right)=0", 'y\\left(0\\right)=0', "y'\\left(0\\right)=0"], { ind: 't', to: '20' }],
    ['Predator–prey', 'Lotka–Volterra, nonlinear system', ["x'=1.1x-0.4xy", "y'=0.1xy-0.4y"], ['x\\left(0\\right)=10', 'y\\left(0\\right)=10'], { ind: 't', to: '50', view: 'phase' }],
    ['Pendulum', 'θ″ + (g/L) sin θ = 0, nonlinear', ["\\theta''+9.81\\sin\\left(\\theta\\right)=0"], ['\\theta\\left(0\\right)=2.5', "\\theta'\\left(0\\right)=0"], { ind: 't', to: '6' }],
    ['Van der Pol', 'y″ − μ(1 − y²)y′ + y = 0', ["y''-2\\left(1-y^2\\right)y'+y=0"], ['y\\left(0\\right)=0.5', "y'\\left(0\\right)=0"], { ind: 't', to: '30', view: 'phase' }],
    ['Riccati', 'y′ = y² + t: no closed form', ["y'=y^2+t"], ['y\\left(0\\right)=0'], { ind: 't', from: '-3', to: '2' }],
    ['Lorenz', 'Chaotic system of three', ["x'=10\\left(y-x\\right)", "y'=x\\left(28-z\\right)-y", "z'=xy-\\frac{8}{3}z"], ['x\\left(0\\right)=1', 'y\\left(0\\right)=1', 'z\\left(0\\right)=1'], { ind: 't', to: '30', view: 'phase' }],
  ];

  /* ---------------- the page ---------------- */
  class OdePage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'ode'; this.title = 'Differential Equations'; this.noKeypad = true;
      this.s = Object.assign({ eqs: ["y'=-2y"], ics: ['y\\left(0\\right)=3'], ind: 'auto', from: '', to: '', step: '', at: '', view: 't', px: '', py: '' }, state);
      if (!this.s.eqs.length) this.s.eqs = [''];
      this.focusMf = null;
      this.root = el('div', { class: 'page ode' });
      this.body = el('div', { class: 'ode-body' });
      this.root.append(this.body);
      // the keypad shows while an equation is being typed, and hides again for reading the results
      this.root.addEventListener('pointerdown', (e) => { if (!e.target.closest('math-field, .ode-quick')) this.keys(false); }, true);
      this.render();
    }
    keys(on) { if (this.app.page === this) document.body.classList.toggle('nokeys', !on); }
    esc() { this.keys(false); try { document.activeElement.blur(); } catch (e) { /* ignore */ } }
    get target() { return this.focusMf; }
    serialize() { const { eqs, ics, ind, from, to, step, at, view, px, py } = this.s; return { eqs, ics, ind, from, to, step, at, view, px, py }; }
    menu() {
      return [
        ['Examples', () => this.examples()],
        ['New equation', () => { this.s.eqs = ['']; this.s.ics = []; this.render(); this.out.innerHTML = ''; this.app.saveSoon(); }],
        ['How to enter equations', () => this.help()],
      ];
    }
    mfRow(list, i, ph, onEnter) {
      const mf = mathField({ value: list[i] || '', placeholder: ph });
      mf.addEventListener('focusin', () => { this.focusMf = mf; this.app.setTarget(mf); this.keys(true); setTimeout(() => { try { mf.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }, 80); });
      mf.addEventListener('input', () => { list[i] = mf.value; this.app.saveSoon(); });
      mf.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } });
      const x = el('button', { class: 'ode-x', text: '✕', 'aria-label': 'Remove', onclick: () => { list.splice(i, 1); this.render(); this.app.saveSoon(); } });
      return el('div', { class: 'ode-row' }, mf, x);
    }
    render() {
      const s = this.s, B = this.body; B.innerHTML = '';
      const head = el('div', { class: 'ode-head' },
        el('div', { class: 'ode-title', text: 'Differential equations' }),
        el('button', { class: 'chip', text: 'Examples', onclick: () => this.examples() }),
        el('button', { class: 'chip', text: '?', 'aria-label': 'How to enter equations', onclick: () => this.help() }));
      // quick keys: what the keypad doesn't have on its first page
      const quick = el('div', { class: 'ode-quick' });
      for (const [l, t] of [['′', "'"], ['y', 'y'], ['x', 'x'], ['t', 't'], ['=', '='], ['y(0)=', 'y\\left(0\\right)='], ['d/dt', '\\frac{d}{dt}']]) {
        const b = el('button', { class: 'chip', text: l, type: 'button' });
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('pointerdown', (e) => e.preventDefault());
        b.onclick = () => { if (!this.focusMf) { const f = this.body.querySelector('math-field'); if (f) f.focus(); } this.app.insert(t); };
        quick.append(b);
      }
      const eqBox = el('div', { class: 'card' }, el('div', { class: 'ode-lab', text: 'Equations' }));
      s.eqs.forEach((v, i) => eqBox.append(this.mfRow(s.eqs, i, i ? 'another equation for a system' : 'y′′ + 0.4y′ + 4y = 0', () => this.solve())));
      eqBox.append(el('button', { class: 'chip ode-add', text: '+ equation (system)', onclick: () => { s.eqs.push(''); this.render(); this.focusLast(eqBox); } }));
      const icBox = el('div', { class: 'card' }, el('div', { class: 'ode-lab', text: 'Initial or boundary conditions (optional)' }));
      s.ics.forEach((v, i) => icBox.append(this.mfRow(s.ics, i, 'y(0) = 1', () => this.solve())));
      icBox.append(el('button', { class: 'chip ode-add', text: '+ condition', onclick: () => { s.ics.push(''); this.render(); this.focusLast(icBox); } }));
      // options
      const inp = (key, ph, lab) => {
        const i = el('input', { type: 'text', value: s[key] || '', placeholder: ph, 'data-kp': '1', inputmode: 'decimal', autocomplete: 'off' });
        i.addEventListener('input', () => { s[key] = i.value; this.app.saveSoon(); });
        i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.solve(); } });
        return el('label', { class: 'field' }, el('span', { text: lab }), i);
      };
      const ind = el('select', {}); for (const [v, l] of [['auto', 'auto'], ['t', 't'], ['x', 'x'], ['s', 's'], ['z', 'z']]) ind.append(el('option', { value: v, text: l }));
      ind.value = s.ind || 'auto'; ind.onchange = () => { s.ind = ind.value; this.app.saveSoon(); };
      const opts = el('div', { class: 'ode-opts' },
        el('label', { class: 'field' }, el('span', { text: 'Variable' }), ind),
        inp('from', 'start', 'From'), inp('to', 'start + 10', 'To'), inp('step', 'auto', 'Table step'));
      const go = el('button', { class: 'btn pri ode-go', text: 'Solve', onclick: () => this.solve() });
      this.out = el('div', { class: 'ode-out' });
      B.append(head, eqBox, quick, icBox, opts, go, this.out);
    }
    focusLast(box) { setTimeout(() => { const f = [...box.querySelectorAll('math-field')].pop(); if (f) f.focus(); }, 50); }
    enter() { this.solve(); }
    examples() {
      Sheet.open('Differential equation examples', (b) => {
        const ul = el('ul', { class: 'menu' });
        for (const [name, sub, eqs, ics, o] of EXAMPLES) {
          ul.append(el('li', {}, el('button', { class: 'mi', onclick: () => {
            Sheet.close();
            Object.assign(this.s, { eqs: eqs.slice(), ics: ics.slice(), ind: o.ind || 'auto', from: o.from || '', to: o.to || '', step: '', at: '', view: o.view || 't', px: '', py: '' });
            this.render(); this.app.saveSoon(); this.solve();
          } }, el('span', { class: 'lbl', text: name }), el('span', { class: 'sub', text: sub }))));
        }
        b.append(ul);
      });
    }
    help() {
      Sheet.open('Entering differential equations', (b) => {
        b.append(el('div', { class: 'md-doc', html: [
          '<p>Write derivatives with primes: <b>y′</b>, <b>y′′</b> (the <b>′</b> key above the options), or as <b>dy/dt</b> (a fraction), <b>d/dt</b>, or <b>diff(y,t)</b>. Any order works.</p>',
          '<p>For a <b>system</b>, add one equation per unknown, like x′ = y and y′ = −x.</p>',
          '<p><b>Conditions</b> are written y(0) = 1, y′(0) = 0. All at one point: an initial value problem, solved exactly when Giac can and always numerically. At two points (y(0) = 1, y(π/2) = 2): a boundary value problem, solved exactly.</p>',
          '<p>Without conditions you get the <b>general solution</b> with constants c₀, c₁ …; for one first-order equation the slope field and a few solution curves are drawn.</p>',
          '<p><b>Variable</b>: “auto” uses the one in dy/dt, else t if it appears, else x (t when x is an unknown).</p>',
          '<p><b>Exact</b> solutions come from Giac’s desolve (linear equations of any order with constant coefficients, Cauchy–Euler, separable, exact, Bernoulli, homogeneous …), and the Laplace transform for linear constant-coefficient systems with conditions at 0.</p>',
          '<p><b>Numeric</b> solutions use an adaptive Runge–Kutta method (Dormand–Prince 5(4), relative error 10⁻⁸), so nonlinear equations and systems work too. Plot against the variable or as a phase plane, read a table, or get the values at any point.</p>',
          '<p>Angles are in radians here. Constants (g, k, m …) must be numbers or stored values for the numeric solution.</p>',
        ].join('') }));
      });
    }

    async solve() {
      const app = this.app, s = this.s, O = this.out;
      FieldKeys.off(); this.keys(false);
      O.innerHTML = ''; O.append(el('div', { class: 'card sub', text: 'Solving…' }));
      let P;
      try { P = readProblem(app, s.eqs, s.ics, s.ind); } catch (e) { O.innerHTML = ''; O.append(el('div', { class: 'card ode-err', text: e.message })); return; }
      const T = P.ind;
      const sum = P.unknowns.map((u) => u + '(' + T + '), order ' + P.order[u]).join(' · ');
      const cards = [];
      // exact
      const ex = el('div', { class: 'card' }, el('div', { class: 'ode-lab', text: 'Exact solution' }));
      const exBody = el('div', { class: 'sub', text: 'Working…' }); ex.append(exBody);
      // numeric
      const nu = el('div', { class: 'card' }, el('div', { class: 'ode-lab', text: 'Numeric solution' }));
      O.innerHTML = ''; O.append(el('div', { class: 'ode-sum sub', text: (P.system ? 'System: ' : '') + sum }), ex, nu);
      cards.push(ex, nu);
      const exP = this.showExact(P, exBody);
      try { await this.showNumeric(P, nu); } catch (e) { nu.append(el('div', { class: 'ode-err', text: e.message })); }
      await exP;
      app.saveSoon();
    }

    async showExact(P, box) {
      const app = this.app, T = P.ind;
      let r;
      try { r = await Promise.race([exact(app, P), new Promise((res) => setTimeout(() => res({ fail: 'Giac took too long' }), 20000))]); } catch (e) { r = { fail: e.message }; }
      box.innerHTML = '';
      if (r.fail) { box.className = 'sub'; box.textContent = r.fail + (P.ics.length || !P.system ? '. The numeric solution is below.' : '.'); return; }
      box.className = '';
      for (const { u, expr } of r.sols) {
        const lhs = nameTex({ u }) + '\\left(' + T + '\\right)';
        const tx = GiacFmt.giacToTex(expr) || '\\text{' + expr.replace(/[{}\\]/g, '') + '}';
        const m = el('div', { class: 'ode-sol' }); renderTex(m, lhs + '=' + tx);
        const free = /(?<![A-Za-z0-9_])(c_\d+|[A-Za-z]\w*_\d+)(?![A-Za-z0-9_])/.test(expr);
        const acts = el('div', { class: 'cv-act' },
          el('button', { class: 'chip', text: 'Insert', onclick: () => this.toCalc(tx) }),
          el('button', { class: 'chip', text: 'Copy', onclick: () => { try { navigator.clipboard.writeText(u + '(' + T + ')=' + expr); toast('Copied'); } catch (e) { toast(expr); } } }),
          el('button', { class: 'chip', text: 'Define ' + u + '(' + T + ')', onclick: () => this.define(u, T, expr) }),
          free ? null : el('button', { class: 'chip', text: 'Graph', onclick: () => this.graph(expr, T) }));
        box.append(m, acts);
      }
      box.append(el('div', { class: 'sub ode-how', text: 'By ' + r.how + (/c_\d/.test(r.sols.map((x) => x.expr).join()) ? ' · c₀, c₁ … are arbitrary constants' : '') }));
    }

    toCalc(tex) {
      const app = this.app; let ci = app.pages.findIndex((p) => p.kind === 'calc');
      if (ci < 0) { app.addPage('calc'); ci = app.pages.length - 1; } else app.select(ci);
      setTimeout(() => app.insert(tex), 80);
    }
    async define(u, T, expr) {
      const code = u + '(' + T + '):=' + expr;
      const r = await this.app.cas.eval(code);
      if (isErr(r)) { toast('Couldn’t define ' + u); return; }
      this.app.cas.remember(code);
      toast(u + '(' + T + ') is defined in the Calculator');
    }
    async graph(expr, T) {
      const g = T === 'x' ? expr : await this.app.cas.eval('subst(' + expr + ',' + T + ',x)');
      if (isErr(g)) { toast('Can’t graph this'); return; }
      this.app.graphExpression(g);
    }

    async showNumeric(P, box) {
      const app = this.app, s = this.s, T = P.ind;
      const sys = await firstOrder(app, P);
      const iv = await initialValues(app, P, sys.state);
      const num = async (v, d) => { if (!v || !String(v).trim()) return d; const r = await app.cas.eval('evalf(' + toGiac(app, String(v)) + ')'); const x = Number(r); return isFinite(x) ? x : d; };
      if (iv && iv.err === 'boundary') { box.append(el('div', { class: 'sub', text: 'Conditions at two or more points: a boundary value problem, solved exactly above.' })); return; }
      if (iv && iv.err && iv.err !== 'missing') { box.append(el('div', { class: 'ode-err', text: iv.err })); return; }
      const one1 = sys.state.length === 1;
      if (!iv || iv.err === 'missing') {
        if (!one1) {
          const need = (iv ? iv.missing : sys.state).map((x) => x.u + "'".repeat(x.k) + '(' + (iv ? fmt(iv.t0) : '0') + ')');
          box.append(el('div', { class: 'sub', text: 'Give ' + need.join(', ') + ' to see the numeric solution.' })); return;
        }
      }
      // the range
      const t0 = iv && !iv.err ? iv.t0 : 0;
      let a = await num(s.from, t0), b = await num(s.to, NaN);
      if (!isFinite(b)) b = a < t0 ? t0 + (t0 - a) : t0 + 10;
      if (b < a) [a, b] = [b, a];
      if (a > t0 && iv && !iv.err) a = t0;
      if (b < t0 && iv && !iv.err) b = t0;
      const comp = sys.state;
      // one first-order equation without a condition: slope field + curves
      if (!iv || iv.err) return this.fieldOnly(P, sys, box, a, b);
      const t1 = performance.now();
      const S = solveRange(sys.F, t0, iv.Y0, a, b);
      const ms = performance.now() - t1;
      for (const n of S.notes) box.append(el('div', { class: 'ode-err', text: n }));
      const N = 600, xs = new Float64Array(N + 1), cols = comp.map(() => new Float64Array(N + 1));
      for (let i = 0; i <= N; i++) { const t = S.lo + (S.hi - S.lo) * i / N; xs[i] = t; const y = S.at(t) || []; comp.forEach((c, j) => { cols[j][i] = y[j]; }); }
      // view: against the variable, or a phase plane
      const axes = [{ l: T, v: xs }, ...comp.map((c, j) => ({ l: compLabel(c), v: cols[j] }))];
      const ctl = el('div', { class: 'ode-ctl' });
      const plot = new Plot({ height: 260, xlabel: T });
      const pick = (val, d) => { const k = axes.findIndex((x) => x.l === val); return k >= 0 ? k : d; };
      const draw = () => {
        if (s.view === 'phase' && comp.length >= 2) {
          const ix = pick(s.px, 1), iy = pick(s.py, comp[1] && comp[1].u !== comp[0].u ? 1 + comp.findIndex((c) => c.u !== comp[0].u) : 2);
          plot.opts.xlabel = axes[ix].l; plot.opts.ylabel = axes[iy].l;
          plot.set([{ xs: axes[ix].v, ys: axes[iy].v, mode: 'line', color: '--g1', width: 2 }, { xs: [axes[ix].v[0]], ys: [axes[iy].v[0]], mode: 'points', color: '--g2', r: 4 }]);
        } else {
          plot.opts.xlabel = T; plot.opts.ylabel = '';
          const series = [];
          // the unknowns themselves; derivatives only for a single unknown
          comp.forEach((c, j) => { if (c.k === 0 || P.unknowns.length === 1) series.push({ xs, ys: cols[j], mode: 'line', color: '--g' + (1 + (j % 8)), width: c.k ? 1.4 : 2.2, dash: c.k ? [5, 4] : null, label: compLabel(c) }); });
          if (one1) series.unshift(...slopeField(sys.F, a, b, cols[0]));
          plot.set(series);
        }
      };
      if (comp.length >= 2) {
        const seg = el('div', { class: 'seg' });
        for (const [k, l] of [['t', 'Against ' + T], ['phase', 'Phase plane']]) { const bt = el('button', { text: l, class: s.view === k ? 'on' : '' }); bt.onclick = () => { s.view = k; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === bt)); axSel.hidden = k !== 'phase'; draw(); app.saveSoon(); }; seg.append(bt); }
        const mk = (key, d) => { const sel = el('select', {}); axes.forEach((x) => sel.append(el('option', { value: x.l, text: x.l }))); sel.value = axes[pick(s[key], d)].l; sel.onchange = () => { s[key] = sel.value; draw(); app.saveSoon(); }; return sel; };
        const axSel = el('div', { class: 'ode-ax' }, el('span', { text: 'x-axis' }), mk('px', 1), el('span', { text: 'y-axis' }), mk('py', comp.findIndex((c) => c.u !== comp[0].u) + 1 || 2));
        axSel.hidden = s.view !== 'phase';
        ctl.append(seg, axSel);
      }
      box.append(ctl, plot.el);
      setTimeout(draw, 0);
      // values at a point
      const atI = el('input', { type: 'text', value: s.at || '', placeholder: fmt(S.hi), 'data-kp': '1', inputmode: 'decimal', autocomplete: 'off' });
      const atOut = el('div', { class: 'ode-vals' });
      const showAt = async () => {
        s.at = atI.value; const t = await num(atI.value, S.hi); atOut.innerHTML = '';
        const y = S.at(t);
        if (!y) { atOut.append(el('div', { class: 'sub', text: T + ' = ' + fmt(t) + ' is outside ' + fmt(S.lo) + ' … ' + fmt(S.hi) })); return; }
        comp.forEach((c, j) => {
          const r = el('div', { class: 'md-out' }); const m = el('span', { class: 'md-ov' }); renderTex(m, compTex(c, fmt(t)) + '\\approx ' + numTex(y[j], 8));
          r.append(m, el('button', { class: 'chip', text: 'Insert', onclick: () => this.toCalc(numTex(y[j], 10)) }));
          atOut.append(r);
        });
        app.saveSoon();
      };
      atI.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); showAt(); } });
      atI.addEventListener('change', showAt);
      box.append(el('div', { class: 'ode-atrow' }, el('label', { class: 'field' }, el('span', { text: 'Values at ' + T + ' =' }), atI), el('button', { class: 'chip', text: 'Go', onclick: showAt })), atOut);
      showAt();
      // the table
      let step = await num(s.step, NaN);
      if (!isFinite(step) || step <= 0) step = niceStep((S.hi - S.lo) / 20);
      let rows = Math.floor((S.hi - S.lo) / step + 1e-9) + 1; let capped = false;
      if (rows > 1000) { rows = 1000; capped = true; }
      const tbl = el('table', { class: 'ode-tbl' });
      const hr = el('tr', {}, el('th', { text: T })); comp.forEach((c) => hr.append(el('th', { text: compLabel(c) }))); tbl.append(hr);
      const csv = [[T, ...comp.map(compLabel)].join(',')];
      const start = Math.ceil(S.lo / step - 1e-9) * step;
      for (let i = 0; i < rows; i++) {
        const t = +(start + i * step).toPrecision(12); if (t > S.hi + 1e-9 * Math.abs(step)) break;
        const y = S.at(Math.min(t, S.hi)); if (!y) continue;
        const tr = el('tr', {}, el('td', { text: fmt(t, 6) })); comp.forEach((c, j) => tr.append(el('td', { text: fmt(y[j], 6) }))); tbl.append(tr);
        csv.push([t, ...comp.map((c, j) => +y[j].toPrecision(10))].join(','));
      }
      const det = el('details', { class: 'ode-det' }, el('summary', { text: 'Table (step ' + fmt(step) + ')' + (capped ? ', first 1000 rows' : '') }), el('div', { class: 'ode-tw' }, tbl),
        el('div', { class: 'cv-act' }, el('button', { class: 'chip', text: 'Copy as CSV', onclick: () => { try { navigator.clipboard.writeText(csv.join('\n')); toast('Copied ' + (csv.length - 1) + ' rows'); } catch (e) { toast('Couldn’t copy'); } } })));
      box.append(det);
      box.append(el('div', { class: 'sub ode-how', text: 'Dormand–Prince 5(4), ' + S.ts.length + ' steps, ' + Math.max(1, Math.round(ms)) + ' ms' }));
      this.last = { S, comp };
    }

    /** one first-order equation and no condition: the slope field with solution curves through several starting values */
    fieldOnly(P, sys, box, a, b) {
      const plot = new Plot({ height: 280, xlabel: P.ind });
      box.append(el('div', { class: 'sub', text: 'No condition: the slope field and a few solutions. Add one, like ' + P.unknowns[0] + '(0) = 1, for a single curve and a table.' }), plot.el);
      const curves = [], all = [];
      const y0s = [-4, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 4];
      const tm = a;
      for (const [k, y0] of y0s.entries()) {
        const S = solveRange(sys.F, tm, Float64Array.of(y0), a, b);
        const N = 300, xs = new Float64Array(N + 1), ys = new Float64Array(N + 1);
        for (let i = 0; i <= N; i++) { const t = S.lo + (S.hi - S.lo) * i / N; xs[i] = t; const y = S.at(t); ys[i] = y ? y[0] : NaN; }
        curves.push({ xs, ys, mode: 'line', color: '--g' + (1 + (k % 8)), width: 1.6 }); all.push(...ys);
      }
      const fin = all.filter((v) => isFinite(v) && Math.abs(v) < 50);
      const lo = Math.max(-6, Math.min(...fin, -1)), hi = Math.min(6, Math.max(...fin, 1));
      setTimeout(() => {
        plot.set([...slopeField(sys.F, a, b, [lo, hi]), ...curves]);
        plot.view = { x0: a, x1: b, y0: lo, y1: hi }; plot.draw();
      }, 0);
    }
  }

  function niceStep(raw) { if (!(raw > 0)) return 1; const p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

  /** short segments with slope F(t, y): one line series with breaks */
  function slopeField(F, a, b, ys) {
    let lo = Infinity, hi = -Infinity; for (const v of ys) if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) { lo = -5; hi = 5; }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const nx = 22, ny = 14, dx = (b - a) / nx, dy = (hi - lo) / ny;
    const xs = [], yv = [], d = new Float64Array(1), Y = new Float64Array(1);
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const t = a + i * dx, y = lo + j * dy; Y[0] = y; F(t, Y, d); const m = d[0];
      if (!isFinite(m)) continue;
      // equal length on screen: scale by the cell size
      const u = 1 / dx, v = m / dy, L = Math.hypot(u, v), hx = 0.35 * u / L * dx, hy = 0.35 * v / L * dy;
      xs.push(t - hx, t + hx, NaN); yv.push(y - hy * 1, y + hy, NaN);
    }
    return [{ xs: Float64Array.from(xs), ys: Float64Array.from(yv), mode: 'line', color: '--ink3', width: 1, noFit: true }];
  }

  root.Ode = { OdePage, readProblem, exact, firstOrder, rk45, solveRange, primesTex, EXAMPLES };
})(typeof self !== 'undefined' ? self : this);
