/*
 * varsolver.js — the Variable Solver tab. Every formula in CalcShelf (the library and every module) goes into one
 * master list, and every formula variable is matched to a quantity in data/quantities.js, so the same quantity is
 * one variable everywhere. Enter the values you know: any formula left with one unknown is solved, that result
 * feeds the other formulas, and so on. Each calculated value shows the formula it came from, rearranged for it,
 * and the same formula with your numbers in it.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, Sheet } = UI;

  /* ---------------------------------------------------------------- units of formula variables */
  const UNIT_FIX = { 'D (1/m)': '1/m' };
  const UI_CACHE = {};
  /** SI factor and dimension key of a unit string; units CalcShelf can't convert (dB…) only match themselves */
  function unitInfo(u0) {
    const u = UNIT_FIX[u0 || ''] || u0 || '';
    if (UI_CACHE[u]) return UI_CACHE[u];
    let r;
    if (/dB|\s/.test(u)) r = { f: 1, key: 'u:' + u, ok: false, unit: u };
    else try { const p = Units.parse(u.replace(/√\(?(\w+)\)?/g, '$1^0.5')); r = { f: p.f, key: p.d.join(','), ok: true, unit: u }; }
    catch (e) { r = { f: 1, key: 'u:' + u, ok: false, unit: u }; }
    return (UI_CACHE[u] = r);
  }
  const fkey = (f) => f.src + '|' + f.title;
  const slug = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const PH = (i) => 'zzq' + String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
  /** a formula's variable name as a symbol: lam0 → λ₀, dnu → Δν, Eg → E_g, NEP → NEP */
  const GREEK = { lam: 'lambda', Lam: 'Lambda', nu: 'nu', th: 'theta', theta: 'theta', tau: 'tau', eta: 'eta', mu: 'mu', rho: 'rho', sig: 'sigma', sigma: 'sigma', eps: 'varepsilon', al: 'alpha', alpha: 'alpha', be: 'beta', beta: 'beta', gam: 'gamma', ph: 'phi', phi: 'phi', Phi: 'Phi', om: 'omega', omega: 'omega', kap: 'kappa', zeta: 'zeta', chi: 'chi', psi: 'psi', delta: 'delta', de: 'delta', xi: 'xi', pi: 'pi' };
  const symTex = (name) => {
    if (/^[A-Z]{2,}\d*$/.test(name)) return '\\mathrm{' + name + '}';
    let pre = '';
    if (/^d[A-Za-z]/.test(name) && name.length > 2 && GREEK[name.slice(1).replace(/\d+$/, '')] !== undefined) { pre = '\\Delta '; name = name.slice(1); }
    else if (/^d(lam|nu|n|T|L|t|x|E|P|phi|f)\d*$/.test(name)) { pre = '\\Delta '; name = name.slice(1); }
    const g = Object.keys(GREEK).sort((a, b) => b.length - a.length).find((k) => name.startsWith(k));
    let base, rest;
    if (g) { base = '\\' + GREEK[g]; rest = name.slice(g.length); } else { base = name[0]; rest = name.slice(1); }
    return pre + base + (rest ? '_{' + (/^\d+$/.test(rest) ? rest : '\\mathrm{' + rest + '}') + '}' : '');
  };
  /** replace the placeholders zzq… in a TeX string by the variables' symbols */
  const unPH = (tex, map) => tex.replace(/\\(?:mathit|mathrm|operatorname|text)\{(zzq[a-z]{2})\}|(zzq[a-z]{2})/g, (m, a, b) => '{' + (map[a || b] || (a || b)) + '}');

  /* ---------------------------------------------------------------- the master formula list */
  const VS = {
    F: [], Q: {}, built: false, symCache: new Map(), fnCache: new Map(),
    build() {
      const QD = root.QUANTITIES || { Q: {}, RULES: [] };
      const Q = {};
      for (const q of Object.values(QD.Q)) Q[q.id] = { ...q, ui: unitInfo(q.unit), fs: [], hint: '' };
      const rules = QD.RULES.slice();
      const F = [], seen = new Set();
      const add = (src, srcName, cat, it) => {
        const ctx = src + '|' + cat + '|' + it.title;
        const used = new Set(), vars = [];
        it.vars.forEach((v, k) => {
          const [name, desc0, unit, def, qid] = v; const desc = String(desc0 || name);
          const ui = unitInfo(unit);
          let id = qid && Q[qid] && Q[qid].ui.key === ui.key ? qid : null;
          if (!id) for (const r of rules) {
            if (!r.n.has(name)) continue;
            if (r.d && !r.d.test(desc)) continue;
            if (r.x && r.x.test(desc)) continue;
            if (r.w && !r.w.test(ctx)) continue;
            if (r.xw && r.xw.test(ctx)) continue;
            const qq = Q[r.id]; if (!qq || qq.ui.key !== ui.key) continue;
            id = r.id; break;
          }
          if (!id) {
            id = 'x:' + name + '|' + ui.key + '|' + slug(desc);
            if (!Q[id]) Q[id] = { id, sym: symTex(name), name: cap(desc), desc: '', unit: ui.ok ? (UNIT_FIX[unit] || unit || '') : (unit || ''), ui, fs: [], hint: '', local: true };
          }
          if (used.has(id)) {   // the same quantity twice in one formula (n and n₀ …): keep the second apart
            id = id + '#' + F.length + name;
            Q[id] = { id, sym: symTex(name), name: cap(desc), desc: '', unit: unit || '', ui, fs: [], hint: '', local: true };
          }
          used.add(id);
          const q = Q[id];
          if (def !== '' && def != null && q.value == null && q.hintSI == null) { const x = Number(def); if (isFinite(x)) q.hintSI = x * ui.f; }
          vars.push({ name, id, desc, unit: unit || '', f: ui.f, ph: PH(k) });
        });
        const key = it.eq.replace(/\s/g, '') + '|' + vars.map((v) => v.id).sort().join(',');
        if (seen.has(key)) return; seen.add(key);
        const map = {}; vars.forEach((v) => { map[v.name] = v.ph; });
        const eqp = it.eq.replace(/\b[A-Za-z_]\w*\b/g, (w) => map[w] || w);
        const f = { i: F.length, src, srcName, cat, group: src + '|' + cat, title: it.title, tex: it.tex || it.eq, eq: it.eq, eqp, note: it.note || '', vars, solveFor: it.solveFor ? new Set(it.solveFor) : null };
        F.push(f);
        for (const v of vars) Q[v.id].fs.push(f.i);
      };
      // modules first: a library formula that a module repeats is listed once, under the module
      for (const e of (root.Modules && Modules.list) || []) {
        const m = e.m;
        for (const mv of m.variables || []) {
          if (!Q[mv.id]) Q[mv.id] = { id: mv.id, sym: mv.symbol || symTex(mv.id), name: mv.name || mv.id, desc: mv.description || '', unit: mv.unit || '', also: mv.also || '', value: mv.value, ui: unitInfo(mv.unit), fs: [], hint: '' };
          if (mv.names && mv.names.length) rules.unshift({ id: mv.id, n: new Set(mv.names), w: new RegExp('^' + m.id.replace(/[^\w-]/g, '') + '\\|') });
        }
        for (const s of m.sections) for (const it of s.items) if (it.type === 'formula') add(m.id, m.name, s.title, it);
      }
      for (const f of root.FORMULAS || []) add('lib', 'Library', f.cat, { title: f.n, tex: f.tex, eq: f.eq, vars: f.v, note: f.note });
      // quantities no formula uses are left out
      for (const id of Object.keys(Q)) if (!Q[id].fs.length) delete Q[id];
      this.F = F; this.Q = Q; this.built = true; this.symCache.clear(); this.fnCache.clear();
    },
    groups() {
      const g = new Map();
      for (const f of this.F) { if (!g.has(f.group)) g.set(f.group, { key: f.group, src: f.src, srcName: f.srcName, cat: f.cat, n: 0 }); g.get(f.group).n++; }
      return [...g.values()];
    },

    /* ---------------- solving */
    parseSols(res, ph) {
      if (!res || /GIAC_ERROR|Error/.test(res)) return [];
      let ast; try { ast = GiacFmt.parse(res); } catch (e) { return []; }
      const out = [];
      const walk = (n) => {
        if (!n) return;
        if (n.t === 'vec') n.items.forEach(walk);
        else if (n.t === 'paren') walk(n.a);
        else if (n.t === 'bin' && (n.op === 'or' || n.op === 'and')) { walk(n.a); walk(n.b); }
        else if (n.t === 'bin' && n.op === '=' && n.a.t === 'id' && n.a.v === ph) out.push(n.b);
      };
      walk(ast);
      return out.filter((a) => !JSON.stringify(a).includes('"' + ph + '"'));
    },
    /** evaluate the rearranged formulas for x; returns { v (SI), alts, ast, k } or null */
    async evalFor(app, f, x, known) {
      const others = f.vars.filter((v) => v !== x);
      const vals = others.map((v) => known.get(v.id).v / v.f);
      const key = f.i + ':' + x.name;
      const asts = this.symCache.get(key) || [];
      const cands = [];
      asts.forEach((ast, k) => {
        const ck = key + ':' + k;
        let fn = this.fnCache.get(ck);
        if (fn === undefined) { try { fn = GiacFmt.compile(ast, others.map((v) => v.ph)); } catch (e) { fn = null; } this.fnCache.set(ck, fn); }
        if (!fn) return;
        let y; try { y = fn(...vals); } catch (e) { y = NaN; }
        if (typeof y === 'number' && isFinite(y)) cands.push({ y, k, ast });
      });
      if (!cands.length && (!asts.length || asts.every((a, k) => this.fnCache.get(key + ':' + k) === null))) {
        // no closed form: search numerically with these values
        const valOf = {}; others.forEach((v, i) => { valOf[v.ph] = '(' + Units.num(vals[i], 15) + ')'; });
        const sub = f.eqp.replace(/\bzzq[a-z]{2}\b/g, (z) => valOf[z] || z);
        try {
          Library.app = Library.app || app;
          const sols = await Library.findSolutions(sub, x.ph, others.map((v, i) => Units.num(vals[i], 15)));
          for (const s of sols) { const y = Number(s); if (isFinite(y)) cands.push({ y, k: -1, ast: null }); }
        } catch (e) { /* none */ }
      }
      if (!cands.length) return null;
      // a positive answer first (lengths, densities, powers …), the smallest magnitude among equals
      cands.sort((a, b) => (b.y > 0) - (a.y > 0) || (b.y >= 0) - (a.y >= 0));
      const uniq = []; for (const c of cands) if (!uniq.some((u) => Math.abs(u.y - c.y) <= 1e-12 * Math.max(Math.abs(u.y), Math.abs(c.y)))) uniq.push(c);
      const best = uniq[0];
      return { v: best.y * x.f, local: best.y, ast: best.ast, k: best.k, alts: uniq.slice(1).map((c) => c.y * x.f) };
    },
  };

  /* ---------------------------------------------------------------- the page */
  class VarSolverPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'vsolve'; this.title = 'Variable Solver'; this.noKeypad = true;
      this.S = { user: state.user || {}, units: state.units || {}, ignored: state.ignored || [], off: state.off || [], offF: state.offF || [], q: '' };
      this.known = new Map(); this.conflicts = new Map(); this.open = new Set(); this.more = 40; this.run = 0;
      this.root = el('div', { class: 'page vs' });
      this.head = el('div', { class: 'vs-head' });
      this.body = el('div', { class: 'vs-body' });
      this.root.append(this.head, this.body);
      this.body.append(el('div', { class: 'desc gd-pad', text: 'Loading the formulas…' }));
      this.start();
    }
    get target() { return null; }
    serialize() { const { user, units, ignored, off, offF } = this.S; return { user, units, ignored, off, offF }; }
    menu() {
      return [
        ['Reset values', () => this.reset()],
        ['Master formula list', () => this.formulaList()],
        ['Which formulas to use', () => this.scope()],
        ['How it works', () => this.help()],
      ];
    }
    async start() {
      if (root.Modules) await Modules.load();
      VS.build();
      this.renderHead();
      await this.solve();
    }
    get ignored() { return new Set(this.S.ignored); }
    activeF() { const off = new Set(this.S.off), offF = new Set(this.S.offF), ig = this.ignored; return VS.F.filter((f) => !off.has(f.group) && !offF.has(fkey(f)) && f.vars.every((v) => !ig.has(v.id))); }
    renderHead() {
      const H = this.head; H.innerHTML = '';
      const search = el('input', { type: 'search', class: 'search vs-search', placeholder: 'Find a variable: wavelength, Nd, mobility…', value: this.S.q, autocomplete: 'off' });
      search.oninput = () => { this.S.q = search.value; this.more = 40; this.render(); };
      const nF = this.activeF().length;
      const chips = el('div', { class: 'vs-chips' },
        el('button', { class: 'chip', text: 'Reset values', onclick: () => this.reset() }),
        el('button', { class: 'chip', text: 'Formulas (' + nF + ')', onclick: () => this.formulaList() }),
        el('button', { class: 'chip', text: 'Which formulas', onclick: () => this.scope() }),
        el('button', { class: 'chip', text: '?', 'aria-label': 'How it works', onclick: () => this.help() }));
      H.append(search, chips);
    }
    reset() {
      if (!Object.keys(this.S.user).length) { toast('No values entered'); return; }
      this.S.user = {}; this.open.clear(); this.app.saveSoon(); this.solve();
    }

    /* ---------------- values */
    /** SI value of what was typed for quantity q, or NaN */
    parseInput(q, raw, unitSel) {
      const tv = root.splitValueUnit ? splitValueUnit(raw) : { text: raw, unit: null };
      const x = root.evalNum ? evalNum(tv.text) : Number(tv.text);
      if (!isFinite(x)) return { err: 'Type a number, like 1550, 1.5e16, 3/8 or 2pi' };
      const u = tv.unit || unitSel || q.unit;
      if (!q.ui.ok || !u || u === q.unit) return { v: x * q.ui.f, u: tv.unit || unitSel || '' };
      try { return { v: Units.convert(x, u, q.unit) * q.ui.f, u }; } catch (e) { return { err: e.message }; }
    }
    shown(q, si) {
      const u = this.S.units[q.id] || q.unit;
      if (!q.ui.ok) return { x: si, u: q.unit };
      let x = si / q.ui.f; try { x = Units.convert(x, q.unit, u); } catch (e) { return { x: si / q.ui.f, u: q.unit }; }
      if (!this.S.units[q.id] && Units.nicePrefix) { const p = Units.nicePrefix(x, u); return { x: p.v, u: p.u }; }
      return { x, u };
    }
    /** an SI value in the unit the row's menu shows */
    inUnit(q, si) { const u = this.S.units[q.id] || q.unit; let x = si / q.ui.f; if (q.ui.ok && u !== q.unit) { try { x = Units.convert(x, q.unit, u); } catch (e) { /* keep */ } } return x; }
    valTex(q, si) { const s = this.shown(q, si); return Units.fmt(s.x, 'sci', 6).tex + (s.u ? '\\,' + Units.unitTex(s.u) : ''); }
    setUser(q, raw, unitSel) {
      raw = String(raw || '').trim();
      if (!raw) { delete this.S.user[q.id]; this.app.saveSoon(); this.solve(); return; }
      const r = this.parseInput(q, raw, unitSel);
      if (r.err) { toast(r.err); return; }
      this.S.user[q.id] = { v: r.v, raw };
      if (unitSel) this.S.units[q.id] = unitSel;
      this.app.saveSoon(); this.solve();
    }

    /* ---------------- solving: one unknown at a time, until nothing changes */
    async solve() {
      const run = ++this.run, app = this.app;
      const ig = this.ignored, known = new Map(), Q = VS.Q;
      for (const [id, x] of Object.entries(this.S.user)) if (Q[id] && !ig.has(id) && isFinite(x.v)) known.set(id, { v: x.v, src: 'user' });
      const active = this.activeF();
      const used = new Set(); for (const f of active) for (const v of f.vars) used.add(v.id);
      for (const q of Object.values(Q)) if (q.value != null && !known.has(q.id) && !ig.has(q.id) && used.has(q.id)) known.set(q.id, { v: q.value, src: 'const' });
      const failed = new Set();
      for (let pass = 0; pass < 80; pass++) {
        const ready = [];
        for (const f of active) {
          let unk = null, n = 0, real = false;
          for (const v of f.vars) {
            const k = known.get(v.id);
            if (!k) { n++; unk = v; if (n > 1) break; } else if (k.src !== 'const' && !(Q[v.id] && Q[v.id].context)) real = true;
          }
          // one unknown, which may be calculated, and at least one value that isn't a constant or a condition (T)
          if (n === 1 && real && !Q[unk.id].input && !failed.has(f.i + ':' + unk.name) && (!f.solveFor || f.solveFor.has(unk.name))) ready.push([f, unk]);
        }
        if (!ready.length) break;
        ready.sort((a, b) => !!a[0].solveFor - !!b[0].solveFor);   // approximations last: an exact formula wins
        const need = ready.filter(([f, x]) => !VS.symCache.has(f.i + ':' + x.name));
        if (need.length) {
          const res = await app.cas.batch(need.map(([f, x]) => 'solve(' + f.eqp + ',' + x.ph + ')'));
          if (run !== this.run) return;
          need.forEach(([f, x], k) => VS.symCache.set(f.i + ':' + x.name, VS.parseSols(res[k], x.ph)));
        }
        let changed = false;
        for (const [f, x] of ready) {
          if (known.has(x.id)) continue;               // another formula found it in this pass
          if (f.vars.some((v) => v !== x && !known.has(v.id))) continue;
          const r = await VS.evalFor(app, f, x, known);
          if (run !== this.run) return;
          if (r) { known.set(x.id, { v: r.v, src: 'calc', f, x, r }); changed = true; }
          else failed.add(f.i + ':' + x.name);
        }
        if (!changed) break;
      }
      // formulas with every value known: do they agree?
      const conflicts = new Map();
      for (const f of active) {
        if (f.solveFor || f.vars.some((v) => !known.has(v.id))) continue;
        if (!f.vars.some((v) => known.get(v.id).src !== 'const')) continue;
        const via = f.vars.some((v) => { const k = known.get(v.id); return k.src === 'calc' && k.f === f; });
        if (via) continue;
        const x = f.vars.find((v) => known.get(v.id).src === 'calc') || f.vars.find((v) => known.get(v.id).src === 'user');
        if (!x) continue;
        if (!VS.symCache.has(f.i + ':' + x.name)) continue;  // only checked when this formula has been rearranged for it
        const k2 = new Map(known); k2.delete(x.id);
        const r = await VS.evalFor(app, f, x, k2);
        if (!r) continue;
        const a = known.get(x.id).v, b = r.v;
        if (Math.abs(a - b) > 1e-6 * Math.max(Math.abs(a), Math.abs(b)) + 1e-300) { if (!conflicts.has(x.id)) conflicts.set(x.id, []); conflicts.get(x.id).push({ f, v: b }); }
      }
      if (run !== this.run) return;
      this.known = known; this.conflicts = conflicts;
      this.renderHead(); this.render();
    }

    /* ---------------- drawing */
    render() {
      const B = this.body, Q = VS.Q, known = this.known, ig = this.ignored;
      const keep = B.scrollTop; B.innerHTML = '';
      const term = this.S.q.trim().toLowerCase();
      const match = (q) => !term || (q.name + ' ' + q.desc + ' ' + (q.also || '') + ' ' + q.id + ' ' + q.sym).toLowerCase().includes(term);
      const activeIds = new Set(); for (const f of this.activeF()) for (const v of f.vars) activeIds.add(v.id);
      const userQ = [], calcQ = [], constQ = [], rest = [];
      for (const q of Object.values(Q)) {
        if (ig.has(q.id) || !activeIds.has(q.id)) continue;
        const k = known.get(q.id);
        if (k && k.src === 'user') userQ.push(q); else if (k && k.src === 'calc') calcQ.push(q); else if (k && k.src === 'const') constQ.push(q); else rest.push(q);
      }
      const byName = (a, b) => a.name.localeCompare(b.name);
      const sec = (title, sub) => { const h = el('div', { class: 'vs-sec' }, el('span', { text: title })); if (sub) h.append(el('span', { class: 'sub', text: sub })); B.append(h); return h; };
      // what you entered, then what follows from it
      if (userQ.length) { sec('Your values', userQ.length + ''); for (const q of userQ.sort(byName)) B.append(this.row(q)); }
      if (calcQ.length) {
        sec('Calculated', calcQ.length + ' from ' + new Set(calcQ.map((q) => known.get(q.id).f.i)).size + ' formulas');
        for (const q of calcQ.sort(byName)) B.append(this.row(q));
      }
      if (!userQ.length) B.append(el('p', { class: 'desc gd-pad', text: 'Enter the values you know. Every formula that then has one unknown is solved, and those results feed the other formulas. ' + VS.F.length + ' formulas from the library and the modules are in the list.' }));
      // the variables that would unlock most formulas
      if (userQ.length) {
        const unlock = new Map();
        for (const f of this.activeF()) {
          const unk = f.vars.filter((v) => !known.has(v.id));
          if (unk.length === 2) for (const v of unk) unlock.set(v.id, (unlock.get(v.id) || 0) + 1);
        }
        const next = [...unlock.entries()].filter(([id]) => Q[id] && match(Q[id])).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (next.length) { sec('One more value calculates more', 'formulas it would solve'); for (const [id, n] of next) B.append(this.row(Q[id], n)); }
      }
      const rank = (q) => (!term ? 0 : (q.name + ' ' + (q.also || '')).toLowerCase().includes(term) ? 0 : q.id.toLowerCase() === term ? 0 : 1);
      const list = rest.filter(match).sort((a, b) => rank(a) - rank(b) || (!!a.local - !!b.local) || byName(a, b));
      sec(term ? 'Matching variables' : 'All variables', list.length + '');
      for (const q of list.slice(0, this.more)) B.append(this.row(q));
      if (list.length > this.more) B.append(el('button', { class: 'btn vs-more', text: 'Show more (' + (list.length - this.more) + ')', onclick: () => { this.more += 80; this.render(); } }));
      if (constQ.length) {
        const d = el('details', { class: 'vs-det' }, el('summary', { text: 'Constants used (' + constQ.length + ')' }));
        for (const q of constQ.sort(byName)) d.append(this.row(q));
        B.append(d);
      }
      if (this.S.offF.length) {
        const d = el('details', { class: 'vs-det' }, el('summary', { text: 'Ignored formulas (' + this.S.offF.length + ')' }));
        for (const key of this.S.offF) d.append(el('div', { class: 'vs-row' }, el('div', { class: 'vs-n', text: key.split('|').slice(1).join(' · ') }), el('button', { class: 'chip', text: 'Use again', onclick: () => { this.S.offF = this.S.offF.filter((x) => x !== key); this.app.saveSoon(); this.solve(); } })));
        B.append(d);
      }
      if (ig.size) {
        const d = el('details', { class: 'vs-det' }, el('summary', { text: 'Ignored variables (' + ig.size + ')' }));
        for (const id of ig) { const q = Q[id]; if (!q) continue; const t = el('span'); renderTex(t, q.sym); d.append(el('div', { class: 'vs-row' }, el('div', { class: 'vs-l' }, t, el('span', { class: 'vs-n', text: q.name })), el('button', { class: 'chip', text: 'Use again', onclick: () => { this.S.ignored = this.S.ignored.filter((x) => x !== id); this.app.saveSoon(); this.solve(); } }))); }
        B.append(d);
      }
      B.scrollTop = keep;
    }
    row(q, unlockN) {
      const k = this.known.get(q.id), conf = this.conflicts.get(q.id);
      const R = el('div', { class: 'vs-row' + (k ? ' ' + k.src : '') + (conf ? ' conflict' : '') });
      const sym = el('span', { class: 'vs-sym' }); renderTex(sym, q.sym);
      const info = el('div', { class: 'vs-info' }, el('div', { class: 'vs-n' }, el('span', { text: q.name }), unlockN ? el('span', { class: 'vs-badge', text: '+' + unlockN }) : null));
      const desc = [q.desc, q.also ? 'Also: ' + q.also : ''].filter(Boolean).join(' · ');
      if (desc) info.append(el('div', { class: 'vs-d', text: desc }));
      const top = el('div', { class: 'vs-top' }, sym, info);
      const more = el('button', { class: 'vs-x', text: '⋯', 'aria-label': 'More', onclick: () => this.varMenu(q) });
      R.append(top);
      if (k && k.src === 'calc') {
        const v = el('div', { class: 'vs-val' }); renderTex(v, '=' + this.valTex(q, k.v));
        const tog = el('button', { class: 'chip', text: this.open.has(q.id) ? 'Hide' : 'How' });
        tog.onclick = () => { if (this.open.has(q.id)) this.open.delete(q.id); else this.open.add(q.id); this.render(); };
        top.append(more);
        R.append(el('div', { class: 'vs-line' }, v, tog));
        if (conf) R.append(el('div', { class: 'vs-warn', text: '⚠ ' + conf.map((c) => '“' + c.f.title + '” gives ' + Units.fmt(this.shown(q, c.v).x, 'eng', 5).text + ' ' + this.shown(q, c.v).u).join('; ') }));
        if (this.open.has(q.id)) R.append(this.how(q, k));
        return R;
      }
      if (k && k.src === 'const') {
        const v = el('div', { class: 'vs-val' }); renderTex(v, '=' + this.valTex(q, k.v));
        top.append(more);
        R.append(el('div', { class: 'vs-line' }, v, el('button', { class: 'chip', text: 'Change', onclick: () => { this.S.user[q.id] = { v: k.v, raw: Units.num(k.v / q.ui.f, 12) }; this.solve(); } })));
        return R;
      }
      // a value to type: the CAS keypad, with a unit menu
      const u = this.S.user[q.id];
      const inp = el('input', { type: 'text', 'data-kp': '1', 'data-units': q.ui.ok && q.unit ? '1' : '', inputmode: 'decimal', autocomplete: 'off', value: u ? u.raw : '', placeholder: q.hintSI != null ? 'e.g. ' + Units.num(this.inUnit(q, q.hintSI), 4) : 'value' });
      const line = el('div', { class: 'vs-line' }, inp);
      let sel = null;
      if (q.ui.ok && q.unit) {
        const alts = (() => { try { return Units.alternatives(q.unit, 1).slice(0, 30); } catch (e) { return [q.unit]; } })();
        if (!alts.includes(q.unit)) alts.unshift(q.unit);
        sel = el('select', { class: 'vs-unit', 'aria-label': 'Unit' }, alts.map((a) => el('option', { value: a, text: a })));
        sel.value = this.S.units[q.id] && alts.includes(this.S.units[q.id]) ? this.S.units[q.id] : q.unit;
        sel.onchange = () => { this.S.units[q.id] = sel.value; if (inp.value.trim()) this.setUser(q, inp.value, sel.value); else this.app.saveSoon(); };
        line.append(sel);
      } else if (q.unit) line.append(el('span', { class: 'sub', text: q.unit }));
      const commit = () => { const cur = this.S.user[q.id]; if ((cur ? cur.raw : '') !== inp.value.trim()) this.setUser(q, inp.value, sel ? sel.value : ''); };
      inp.addEventListener('change', commit);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
      if (u) line.append(el('button', { class: 'vs-x', text: '✕', 'aria-label': 'Clear', onclick: () => { delete this.S.user[q.id]; this.app.saveSoon(); this.solve(); } }));
      top.append(more);
      R.append(line);
      if (conf) R.append(el('div', { class: 'vs-warn', text: '⚠ Doesn’t agree with ' + conf.map((c) => '“' + c.f.title + '” (' + Units.fmt(this.shown(q, c.v).x, 'eng', 5).text + ' ' + this.shown(q, c.v).u + ')').join(', ') }));
      return R;
    }
    /** the formula a value came from: as written, rearranged for it, with the numbers in */
    how(q, k) {
      const f = k.f, x = k.x, r = k.r, Q = VS.Q;
      const box = el('div', { class: 'vs-how' });
      box.append(el('div', { class: 'vs-from', text: f.title + ' · ' + f.srcName + (f.cat ? ' › ' + f.cat : '') }));
      const t0 = el('div', { class: 'vs-tex' }); renderTex(t0, f.tex.replace(/\\tfrac/g, '\\frac')); box.append(t0);
      const symMap = {}; for (const v of f.vars) symMap[v.ph] = Q[v.id] ? Q[v.id].sym : symTex(v.name);
      if (r.ast) {
        const t1 = el('div', { class: 'vs-tex' });
        renderTex(t1, symMap[x.ph] + '=' + unPH(GiacFmt.tex(r.ast), symMap));
        box.append(el('div', { class: 'vs-step', text: 'Rearranged for ' + (Q[x.id] ? Q[x.id].name.toLowerCase() : x.name) }), t1);
        // the same with the numbers (in the formula's own units)
        const numOf = {}; for (const v of f.vars) if (v !== x) numOf[v.ph] = this.known.get(v.id).v / v.f;
        const numTex = {}; let nn = 0;
        const fill = (n) => {
          if (!n || typeof n !== 'object') return n;
          if (n.t === 'id' && numOf[n.v] !== undefined) {
            const y = numOf[n.v], id = 'zzp' + String.fromCharCode(97 + Math.floor(nn / 26)) + String.fromCharCode(97 + (nn++ % 26));
            const a = Math.abs(y), t = Units.fmt(y, a !== 0 && (a < 1e-3 || a >= 1e6) ? 'sci' : 'plain', 6).tex;
            numTex[id] = y < 0 || /times/.test(t) ? '\\left(' + t + '\\right)' : t;
            return { t: 'id', v: id };
          }
          const o = Array.isArray(n) ? [] : {};
          for (const key of Object.keys(n)) o[key] = fill(n[key]);
          return o;
        };
        const filled = GiacFmt.tex(fill(r.ast)).replace(/\\(?:mathit|mathrm|operatorname|text)\{(zzp[a-z]{2})\}|(zzp[a-z]{2})/g, (m, a, b) => '{' + numTex[a || b] + '}');
        const t2 = el('div', { class: 'vs-tex' });
        renderTex(t2, symMap[x.ph] + '=' + filled + '=' + Units.fmt(r.local, 'sci', 6).tex + (x.unit ? '\\,' + Units.unitTex(UNIT_FIX[x.unit] || x.unit) : ''));
        box.append(el('div', { class: 'vs-step', text: 'With your values' }), t2);
      } else {
        box.append(el('div', { class: 'vs-step', text: 'No closed form: solved numerically with your values' }));
        const t2 = el('div', { class: 'vs-tex' }); renderTex(t2, symMap[x.ph] + '=' + Units.fmt(r.local, 'sci', 6).tex + (x.unit ? '\\,' + Units.unitTex(UNIT_FIX[x.unit] || x.unit) : '')); box.append(t2);
      }
      const units = f.vars.filter((v) => v.unit).map((v) => (Q[v.id] ? Q[v.id].name : v.name) + ' in ' + v.unit);
      if (units.length) box.append(el('div', { class: 'vs-d', text: 'In this formula: ' + units.join(', ') + '.' }));
      if (f.note) box.append(el('div', { class: 'vs-d', text: f.note }));
      if (r.alts && r.alts.length) {
        const a = el('div', { class: 'vs-alts' }, el('span', { class: 'vs-step', text: 'Other solutions:' }));
        for (const y of r.alts) a.append(el('button', { class: 'chip', text: Units.fmt(this.shown(q, y).x, 'eng', 5).text + ' ' + this.shown(q, y).u, onclick: () => { this.S.user[q.id] = { v: y, raw: Units.num(this.shown(q, y).x, 10) }; this.S.units[q.id] = this.shown(q, y).u; this.solve(); } }));
        box.append(a);
      }
      const acts = el('div', { class: 'vs-alts' },
        el('button', { class: 'chip', text: 'In terms of your values', onclick: () => this.derive(q, box, acts) }),
        el('button', { class: 'chip', text: 'Copy', onclick: () => { const s = this.shown(q, k.v); const t = Units.num(s.x, 10) + (s.u ? ' ' + s.u : ''); try { navigator.clipboard.writeText(t); toast('Copied ' + t); } catch (e) { toast(t); } } }),
        el('button', { class: 'chip', text: 'Ignore this formula', onclick: () => this.ignoreFormula(f) }));
      box.append(acts);
      return box;
    }
    /** follow the chain back to what you entered: one formula for this value */
    async derive(q, box, acts) {
      const Q = VS.Q, known = this.known;
      const leaf = {}; let n = 0;
      const expr = (id, depth) => {
        const k = known.get(id);
        if (!k || k.src !== 'calc' || depth > 12) { if (!leaf[id]) leaf[id] = 'zzr' + String.fromCharCode(97 + Math.floor(n / 26)) + String.fromCharCode(97 + (n++ % 26)); return leaf[id]; }
        if (!k.r.ast) return null;
        const sub = {};
        for (const v of k.f.vars) if (v !== k.x) { const e = expr(v.id, depth + 1); if (e == null) return null; sub[v.ph] = v.f === 1 ? '(' + e + ')' : '((' + e + ')/' + Units.num(v.f, 15) + ')'; }
        const body = this.astText(k.r.ast, sub);
        return k.x.f === 1 ? '(' + body + ')' : '(' + Units.num(k.x.f, 15) + '*(' + body + '))';
      };
      const e = expr(q.id, 0);
      if (!e) { toast('One step in the chain has no closed form'); return; }
      const out = await this.app.cas.eval('simplify(' + e + ')');
      if (/GIAC_ERROR|Error/.test(out)) { toast('Couldn’t simplify it'); return; }
      const map = {}; for (const [id, ph] of Object.entries(leaf)) map[ph] = Q[id] ? Q[id].sym : id;
      let tex = GiacFmt.giacToTex(out) || out;
      tex = tex.replace(/\\(?:mathit|mathrm|operatorname|text)\{(zzr[a-z]{2})\}|(zzr[a-z]{2})/g, (m, a, b) => '{' + (map[a || b] || (a || b)) + '}');
      const t = el('div', { class: 'vs-tex' }); renderTex(t, q.sym + '=' + tex);
      box.insertBefore(el('div', { class: 'vs-step', text: 'In terms of what you entered (SI units)' }), acts); box.insertBefore(t, acts);
    }
    /** Giac text of an AST with placeholders replaced */
    astText(ast, sub) {
      const T = (n) => {
        switch (n.t) {
          case 'num': return n.v;
          case 'id': return sub[n.v] || n.v;
          case 'paren': return '(' + T(n.a) + ')';
          case 'neg': return '(-' + T(n.a) + ')';
          case 'bin': return '(' + T(n.a) + n.op + T(n.b) + ')';
          case 'call': return n.f + '(' + n.args.map(T).join(',') + ')';
          case 'vec': return '[' + n.items.map(T).join(',') + ']';
          default: throw new Error('cannot write ' + n.t);
        }
      };
      return T(ast);
    }
    varMenu(q) {
      Sheet.open(q.name, (b) => {
        const t = el('div', { class: 'card', style: { fontSize: '20px' } }); renderTex(t, q.sym + (q.unit ? '\\;[' + Units.unitTex(q.unit) + ']' : '')); b.append(t);
        if (q.desc) b.append(el('p', { class: 'desc', text: q.desc }));
        if (q.also) b.append(el('p', { class: 'desc', text: 'Also called: ' + q.also }));
        const L = el('ul', { class: 'mlist' });
        const item = (label, sub, fn) => L.append(el('li', {}, el('button', { class: 'mi', onclick: () => { Sheet.close(); fn(); } }, el('span', { class: 'lbl', text: label }), sub ? el('span', { class: 'sub', text: sub }) : null)));
        item('Ignore this variable', 'Formulas that use it are left out until you use it again', () => { if (!this.S.ignored.includes(q.id)) this.S.ignored.push(q.id); delete this.S.user[q.id]; this.app.saveSoon(); this.solve(); });
        if (this.S.user[q.id]) item('Clear the value', '', () => { delete this.S.user[q.id]; this.app.saveSoon(); this.solve(); });
        b.append(L);
        b.append(el('div', { class: 'vs-sec' }, el('span', { text: 'Formulas that use it' }), el('span', { class: 'sub', text: String(q.fs.length) })));
        for (const i of q.fs) b.append(this.formulaCard(VS.F[i]));
      });
    }
    ignoreFormula(f) {
      if (!this.S.offF.includes(fkey(f))) this.S.offF.push(fkey(f));
      toast('“' + f.title + '” left out. It’s listed under Ignored.');
      this.app.saveSoon(); this.solve();
    }
    formulaCard(f) {
      const Q = VS.Q, known = this.known;
      const unk = f.vars.filter((v) => !known.has(v.id));
      const c = el('div', { class: 'card vs-fc' });
      c.append(el('div', { class: 'vs-from', text: f.title + ' · ' + f.srcName + (f.cat ? ' › ' + f.cat : '') }));
      const t = el('div', { class: 'vs-tex' }); renderTex(t, f.tex.replace(/\\tfrac/g, '\\frac')); c.append(t);
      const solvedHere = f.vars.find((v) => { const k = known.get(v.id); return k && k.src === 'calc' && k.f === f; });
      const st = solvedHere ? 'Solved for ' + Q[solvedHere.id].name.toLowerCase() : unk.length === 0 ? 'Every value known' : 'Needs ' + unk.map((v) => (Q[v.id] ? Q[v.id].name : v.name).toLowerCase()).join(', ');
      c.append(el('div', { class: 'vs-d', text: st }));
      const vl = el('div', { class: 'vs-d' }); vl.textContent = f.vars.map((v) => v.name + ' = ' + (Q[v.id] ? Q[v.id].name : v.desc) + (v.unit ? ' [' + v.unit + ']' : '')).join(' · ');
      c.append(vl);
      return c;
    }
    formulaList() {
      Sheet.open('Master formula list', (b) => {
        const off = new Set(this.S.off);
        b.append(el('p', { class: 'desc', text: VS.F.length + ' formulas: the library’s and every installed module’s. A module’s formulas join this list when you install it.' }));
        const s = el('input', { type: 'search', class: 'search', placeholder: 'Search formulas' });
        const list = el('div');
        const draw = () => {
          list.innerHTML = '';
          const term = s.value.trim().toLowerCase();
          let n = 0;
          for (const f of VS.F) {
            if (term && !(f.title + ' ' + f.cat + ' ' + f.srcName).toLowerCase().includes(term)) continue;
            if (++n > 120) { list.append(el('p', { class: 'desc', text: 'Search to see more.' })); break; }
            const c = this.formulaCard(f); if (off.has(f.group)) c.style.opacity = 0.5; list.append(c);
          }
        };
        s.oninput = draw; b.append(s, list); draw();
      });
    }
    scope() {
      Sheet.open('Which formulas to use', (b) => {
        b.append(el('p', { class: 'desc', text: 'Leave out the sections you don’t need, so their formulas don’t calculate values you don’t want. Your entered values are kept.' }));
        const off = new Set(this.S.off);
        const gs = VS.groups();
        const bySrc = new Map(); for (const g of gs) { if (!bySrc.has(g.src)) bySrc.set(g.src, []); bySrc.get(g.src).push(g); }
        for (const [src, list] of bySrc) {
          const head = el('div', { class: 'vs-sec' }, el('span', { text: list[0].srcName }));
          const all = el('button', { class: 'chip', text: 'All' }), none = el('button', { class: 'chip', text: 'None' });
          all.onclick = () => { list.forEach((g) => off.delete(g.key)); save(); }; none.onclick = () => { list.forEach((g) => off.add(g.key)); save(); };
          head.append(el('span', { class: 'vs-chips' }, all, none)); b.append(head);
          for (const g of list) {
            const cb = el('input', { type: 'checkbox', checked: !off.has(g.key) });
            cb.onchange = () => { if (cb.checked) off.delete(g.key); else off.add(g.key); save(true); };
            b.append(el('label', { class: 'vs-chk' }, cb, el('span', { text: g.cat }), el('span', { class: 'sub', text: String(g.n) })));
          }
        }
        const save = (quiet) => { this.S.off = [...off]; this.app.saveSoon(); this.solve(); if (!quiet) { Sheet.close(); this.scope(); } };
      });
    }
    help() {
      Sheet.open('Variable Solver', (b) => b.append(el('div', { class: 'md-doc', html: [
        '<p>Every formula in CalcShelf, from the library and from each module, is in one list, and each formula’s variables are matched to named quantities. So the wavelength you enter is the same λ₀ in every optics formula, and N_d is the same donor density in every semiconductor formula.</p>',
        '<p><b>Enter what you know</b> (any unit: pick it from the menu or type it, like <i>1550 nm</i>). Each formula left with one unknown is solved, and the result feeds other formulas, until nothing more follows. Values you entered move to the top, then what was calculated.</p>',
        '<p><b>How</b> on a calculated value shows the formula it came from, rearranged for that value, and the same with your numbers in it. <b>In terms of your values</b> follows the chain back to one formula in what you entered.</p>',
        '<p><b>One more value calculates more</b> lists the variables that would solve the most further formulas.</p>',
        '<p><b>⚠</b> marks a value two formulas disagree on: usually one input is off, or a formula doesn’t apply (an approximation, another material).</p>',
        '<p><b>⋯ → Ignore</b> leaves out a variable you don’t need, with the formulas that use it. <b>Which formulas</b> leaves out whole sections. <b>Reset values</b> clears what you entered.</p>',
        '<p>Physical constants (c, h, k_B, e …) are filled in; tap <b>Change</b> to use another value. Approximations such as n₀ ≈ N_d (n-type, full ionization) are formulas too; ignore them when they don’t apply.</p>',
      ].join('') })));
    }
  }

  root.VarSolver = { VS, VarSolverPage, unitInfo };
})(typeof self !== 'undefined' ? self : this);
