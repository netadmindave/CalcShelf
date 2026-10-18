/*
 * library.js — Constants & Formulas library: searchable constants (insert or store) and
 * a formula solver that solves any formula for any one of its variables.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, Sheet } = UI;

  function numTex(v) {
    // Giac value string → editable LaTeX
    const s = String(v).trim();
    const m = s.match(/^(-?\d+(?:\.\d+)?)e([-+]?\d+)$/i);
    if (m) return m[1] + '\\times10^{' + Number(m[2]) + '}';
    if (/^-?\d+(\.\d+)?$/.test(s)) return s;
    if (s === 'pi') return '\\pi';
    if (s === 'e') return '\\exponentialE';
    return GiacFmt.giacToTex(s, { editable: true }) || s;
  }
  function sellmeierGiac(c, v = 'l') { const t = (B, C) => `${B}*${v}^2/(${v}^2-${C})`; return `sqrt(1+${t(c[0], c[1])}+${t(c[2], c[3])}+${t(c[4], c[5])})`; }

  const Library = {
    tab: 'const', cat: 'All', q: '',
    open(app, tab) {
      this.app = app; if (tab) this.tab = tab;
      Sheet.open('Constants, formulas & conversions', (b) => this.build(b));
    },
    trigSub(sub) { Trig.sub = sub; this.open(root.App, 'trig'); },
    build(b) {
      const seg = el('div', { class: 'seg', style: { marginBottom: '8px' } });
      for (const [k, l] of [['const', 'Constants'], ['form', 'Formulas'], ['trig', 'Trig'], ['conv', 'Convert']]) { const x = el('button', { text: l, class: this.tab === k ? 'on' : '' }); x.onclick = () => { this.tab = k; this.cat = 'All'; Sheet.render(); }; seg.append(x); }
      if (this.tab === 'conv') { b.append(seg); Converter.build(b, this.app, { sheet: true }); return; }
      if (this.tab === 'trig') { b.append(seg); Trig.build(b, this.app); return; }
      const q = el('input', { class: 'search', type: 'search', value: this.q, placeholder: this.tab === 'const' ? 'Search constants (e.g. Planck, BK7, dn/dT)' : 'Search formulas (e.g. Snell, Rayleigh, hoop)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const cats = this.tab === 'const' ? CONSTANTS.map((c) => c.cat) : [...new Set(FORMULAS.map((f) => f.cat))];
      const chips = el('div', { class: 'chips' });
      for (const c of ['All', ...cats]) { const x = el('button', { class: 'chip' + (c === this.cat ? ' on' : ''), text: c }); x.onclick = () => { this.cat = c; chips.querySelectorAll('.chip').forEach((y) => y.classList.toggle('on', y === x)); render(); }; chips.append(x); }
      const list = el('ul', { class: 'mlist' });
      const render = () => {
        this.q = q.value; const s = q.value.trim().toLowerCase(); list.innerHTML = '';
        let n = 0;
        if (this.tab === 'const') {
          for (const g of CONSTANTS) {
            if (this.cat !== 'All' && g.cat !== this.cat) continue;
            const items = g.items.filter((it) => !s || (it.n + ' ' + it.s + ' ' + g.cat + ' ' + (it.note || '')).toLowerCase().includes(s));
            if (!items.length) continue;
            list.append(el('li', { class: 'desc', style: { padding: '12px 4px 4px', fontWeight: '600' }, text: g.cat + (g.note ? ' — ' + g.note : '') }));
            for (const it of items) { list.append(this.constRow(it)); n++; }
          }
        } else {
          for (const f of FORMULAS) {
            if (this.cat !== 'All' && f.cat !== this.cat) continue;
            if (s && !(f.n + ' ' + f.cat + ' ' + f.v.map((v) => v[1]).join(' ')).toLowerCase().includes(s)) continue;
            const btn = el('button', { class: 'mi', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } }, el('span', { class: 'lbl', text: f.n, style: { fontWeight: '600' } }), el('span', { class: 'sub', text: f.cat }));
            const t = el('div', { style: { fontSize: '17px', maxWidth: '100%', overflowX: 'auto' } }); renderTex(t, f.tex); btn.insertBefore(t, btn.children[1]);
            btn.onclick = () => Sheet.push(f.n, (bb) => this.solver(bb, f));
            list.append(el('li', {}, btn)); n++;
          }
        }
        if (!n) list.append(el('li', { class: 'desc', style: { padding: '14px 4px' }, text: 'Nothing matches “' + q.value + '”.' }));
      };
      q.oninput = render;
      b.append(seg, q, chips, list); render();
    },
    constRow(it) {
      const sym = el('span', { style: { minWidth: '64px', fontSize: '17px' } }); renderTex(sym, it.s);
      const val = el('span', { class: 'sub', style: { fontSize: '14.5px', color: 'var(--ink)' } });
      if (it.sell) val.textContent = 'Sellmeier B₁…C₃: ' + it.sell.map((x) => +x.toPrecision(9)).join(', ');
      else { const vt = el('span'); renderTex(vt, numTex(it.v)); val.append(vt, it.u ? el('span', { text: ' ' + it.u, style: { color: 'var(--ink2)' } }) : ''); }
      const btn = el('button', { class: 'mi', style: { alignItems: 'flex-start' } }, sym, el('span', { style: { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 } }, el('span', { class: 'lbl', text: it.n }), val, it.note ? el('span', { class: 'sub', text: it.note }) : null));
      btn.onclick = () => this.constActions(it);
      return el('li', {}, btn);
    },
    /** numeric values of a constant ('1.6e-19' or a band '[a,b]'), or null for symbolic ones */
    constNums(it) {
      const v = String(it.v || '').trim();
      if (/^\[.*\]$/.test(v)) { const xs = v.slice(1, -1).split(',').map(Number); return xs.every(isFinite) ? xs : null; }
      const x = Number(v); return isFinite(x) && v !== '' ? [x] : null;
    },
    constActions(it) {
      const app = this.app;
      Sheet.push(it.n, (b) => {
        const nums = this.constNums(it);
        const canConvert = !it.sell && nums && it.u && (() => { try { Units.parse(it.u); return true; } catch (e) { return false; } })();
        let unit = it.u || '', insSub = null;
        const valuesIn = (u) => nums.map((x) => Units.convert(x, it.u, u));
        const valTex = (u) => {
          if (!canConvert) return numTex(it.v);
          const xs = valuesIn(u).map((x) => Units.fmt(x, (app.settings.convFmt || 'eng'), 10).tex);
          return xs.length > 1 ? '\\left[' + xs.join(',\\;') + '\\right]' : xs[0];
        };
        const head = el('div', { class: 'card', style: { fontSize: '19px', overflowX: 'auto' } });
        const drawHead = () => { renderTex(head, (it.sell ? it.s : it.s + '=' + valTex(unit)) + (unit && !it.sell ? '\\;' + Units.unitTex(unit) : '')); if (insSub) insSub.textContent = unit ? 'in ' + unit : ''; };
        drawHead();
        b.append(head);
        if (it.note) b.append(el('p', { class: 'desc', text: it.note }));
        const eqBox = el('div');
        if (canConvert) {
          const alts = Units.alternatives(it.u, nums[0]);
          b.append(el('h4', { class: 'cv-h', text: 'Show in units' }));
          const box = el('div', { class: 'ucs' });
          const custom = el('input', { class: 'search cv-in', placeholder: 'Other unit, e.g. ' + (alts[1] || 'SI'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', style: { margin: '0 0 4px' } });
          const msg = el('p', { class: 'desc', hidden: true });
          const pick = (u, chip) => { unit = u; box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip)); drawHead(); };
          for (const u of alts) { const c = el('button', { class: 'chip' + (u === unit ? ' on' : ''), text: u }); c.onclick = () => { custom.value = ''; msg.hidden = true; pick(u, c); }; box.append(c); }
          custom.oninput = () => {
            const u = custom.value.trim(); if (!u) { msg.hidden = true; return; }
            try { Units.convert(1, it.u, u); msg.hidden = true; pick(u, null); }
            catch (e) { msg.hidden = false; msg.textContent = e.message.replace(/^Cannot convert/, 'Not compatible:'); msg.classList.add('err'); }
          };
          b.append(box, custom, msg);
          // photon / spectroscopic equivalents for energies, frequencies, wavelengths and wavenumbers
          const ph = nums.length === 1 ? Units.photonEquivalents(nums[0], it.u) : [];
          if (ph.length) {
            eqBox.append(el('h4', { class: 'cv-h', text: 'Equivalent as light' }));
            for (const p of ph) {
              const m = el('span'); renderTex(m, Units.fmt(p.value, app.settings.convFmt || 'eng', 7).tex + '\\,' + Units.unitTex(p.unit));
              eqBox.append(el('div', { class: 'cv-row' }, el('div', { class: 'cv-val' }, m, el('span', { class: 'sub', text: Units.SPEC_LABEL[p.kind] })),
                el('div', { class: 'cv-act' }, el('button', { class: 'chip', text: 'Insert', onclick: () => { Sheet.close(); app.insert(Units.fmt(p.value, app.settings.convFmt || 'eng', 12).tex); } }))));
            }
          }
        }
        const L = el('ul', { class: 'mlist' });
        const act = (label, sub, fn) => L.append(el('li', {}, el('button', { class: 'mi', onclick: fn }, el('span', { class: 'lbl', text: label }), sub ? el('span', { class: 'sub', text: sub }) : null)));
        const giacVal = () => {
          if (!canConvert) return it.v;
          const xs = valuesIn(unit).map((x) => Units.num(x, 12));
          return xs.length > 1 ? '[' + xs.join(',') + ']' : xs[0];
        };
        if (it.sell) {
          const def = (it.s.match(/_\{?([^}(]+)/) || [, 'x'])[1].replace(/[^A-Za-z0-9]/g, '');
          act('Define as a function of λ (µm)', 'Creates n' + def + '(l), e.g. n' + def + '(1.55)', async () => {
            const name = 'n' + def; const code = name + '(l):=' + sellmeierGiac(it.sell);
            await app.cas.eval(code); app.cas.forget(name); app.cas.remember(code); app.userFuncs.add(name); app.saveSoon();
            Sheet.close(); toast('Defined ' + name + '(l). Try ' + name + '(1.55)');
            if (app.page && app.page.kind === 'calc') { app.page.mf.value = '\\operatorname{' + name + '}\\left(1.55\\right)'; app.page.mf.focus(); }
          });
          act('Graph n(λ)', '0.4–2.5 µm', () => { Sheet.close(); app.graphExpression(sellmeierGiac(it.sell, 'x')); const g = app.page; g.view = { xmin: 0.3, xmax: 2.6, ymin: 1.3, ymax: 2.0 }; g.zoomFit(); });
        } else {
          act('Insert value', ' ', () => { Sheet.close(); app.insert(canConvert ? valTex(unit) : numTex(it.v)); });
          insSub = L.lastChild.querySelector('.sub');
          act('Store in a variable', 'Use it by name in any page', () => {
            const sug = (it.s.replace(/\\([a-zA-Z]+)/g, '$1').replace(/[^A-Za-z0-9]/g, '') || 'k').slice(0, 10);
            const name = prompt('Variable name' + (unit ? ' (value in ' + unit + ')' : ''), sug); if (!name) return;
            if (!/^[A-Za-z]\w*$/.test(name)) { toast('Names start with a letter'); return; }
            const code = name + ':=' + giacVal();
            app.cas.eval(code).then(() => { app.cas.forget(name); app.cas.remember(code); app.vars.add(name); app.saveSoon(); toast('Stored ' + name + (unit ? ' in ' + unit : '')); });
            Sheet.close();
          });
          act('Copy value', '', () => { const t = giacVal() + (unit ? ' ' + unit : ''); try { navigator.clipboard.writeText(t); toast('Copied ' + t); } catch (e) { toast(t); } });
          if (canConvert) act('Open in the conversion tool', 'Every unit for this quantity', () => { Converter.tab = 'units'; Converter.val = Units.num(nums[0], 12); Converter.from = it.u; Converter.to = unit === it.u ? (Units.alternatives(it.u, nums[0])[1] || it.u) : unit; const q = Units.quantityOf(Units.parse(it.u).d); if (q) Converter.qty = q[0]; this.tab = 'conv'; Sheet.close(); this.open(app, 'conv'); });
        }
        b.append(L, eqBox); drawHead();
      });
    },
    solver(b, f) {
      const app = this.app;
      const t = el('div', { class: 'card', style: { fontSize: '20px', overflowX: 'auto' } }); renderTex(t, f.tex); b.append(t);
      if (f.note) b.append(el('p', { class: 'desc', text: f.note }));
      b.append(el('p', { class: 'desc', text: 'Fill in the known values (numbers or expressions like 1550e-9 or pi/4), pick the unknown, then Solve.' + (app.settings.angle === 'deg' ? ' Angles are in degrees (Degree mode).' : '') }));
      let unknown = f.v[0][0];
      const inputs = {};
      const rows = el('div');
      const radios = [];
      for (const [name, desc, unit, def] of f.v) {
        const inp = el('input', { type: 'text', value: def || '', inputmode: 'text', autocapitalize: 'off', spellcheck: 'false', placeholder: def ? '' : 'value' });
        inputs[name] = inp;
        const unitTxt = unit === 'rad' && app.settings.angle === 'deg' ? '°' : unit;
        const r = el('input', { type: 'radio', name: 'unk', checked: name === unknown, style: { width: '20px', height: '20px', accentColor: 'var(--acc)' } });
        r.onchange = () => { unknown = name; sync(); };
        radios.push([name, r, inp]);
        const lab = el('span', { style: { minWidth: '62px', fontSize: '17px' } }); renderTex(lab, GiacFmt.idTex(name.replace(/^g([A-C])$/, '$1')));
        rows.append(el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--line)' } },
          r, lab, el('label', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '13px', color: 'var(--ink2)' } }, desc + (unitTxt ? ' (' + unitTxt + ')' : ''), inp)));
      }
      const sync = () => { for (const [n, r, inp] of radios) { inp.disabled = n === unknown; inp.style.opacity = n === unknown ? 0.45 : 1; if (n === unknown) inp.value = ''; } };
      sync();
      const out = el('div', { class: 'card', hidden: true, style: { fontSize: '19px' } });
      b.append(rows, el('div', { class: 'btnrow' },
        el('button', { class: 'btn pri', text: 'Solve', onclick: () => this.solve(f, unknown, inputs, out) }),
        el('button', { class: 'btn', text: 'Insert equation', onclick: () => { Sheet.close(); app.insert(f.tex.replace(/\\tfrac/g, '\\frac')); } })), out);
    },
    async solve(f, unknown, inputs, out) {
      const app = this.app;
      // private names avoid clashes with Giac built-ins (phi, sigma, D, Re, …)
      const map = {}; f.v.forEach(([n], i) => { map[n] = 'zv' + i; });
      const eq = f.eq.replace(/\b[A-Za-z]\w*\b/g, (w) => map[w] || w);
      const knownVals = [], valOf = {};
      for (const [n] of f.v) {
        if (n === unknown) continue;
        const raw = inputs[n].value.trim();
        if (!raw) { toast('Enter a value for ' + n + ', or make it the unknown'); return; }
        const val = '(' + raw.replace(/×10\^?/g, 'e').replace(/,/g, '.').replace(/π/g, 'pi') + ')';
        valOf[map[n]] = val; knownVals.push(val);
      }
      const U = map[unknown];
      // put the known values straight into the equation text (subst() misbehaves in TI mode)
      const sub = eq.replace(/\bzv\d+\b/g, (z) => valOf[z] || z);
      out.hidden = false; out.textContent = 'Solving…';
      const sols = await this.findSolutions(sub, U, knownVals);
      if (!sols.length) { out.textContent = 'No real solution found for ' + unknown + ' with these values.'; return; }
      out.innerHTML = '';
      const name = GiacFmt.idTex(unknown.replace(/^g([A-C])$/, '$1'));
      for (const s of sols) {
        const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '4px 0' } });
        const m = el('span'); renderTex(m, name + '=' + (GiacFmt.giacToTex(s, { digits: Math.max(app.settings.digits, 8) }) || s));
        const u = f.v.find((v) => v[0] === unknown)[2];
        row.append(m, el('span', { class: 'sub', text: u === 'rad' && app.settings.angle === 'deg' ? '°' : u }), el('button', { class: 'chip', text: 'Use', onclick: () => { inputs[unknown].value = s; } }),
          el('button', { class: 'chip', text: 'Store', onclick: () => { const nm = /^[A-Za-z]\w*$/.test(unknown) ? unknown : 'r'; const code = nm + ':=' + s; app.cas.eval(code).then(() => { app.cas.forget(nm); app.cas.remember(code); app.vars.add(nm); app.saveSoon(); toast('Stored ' + nm); }); } }));
        out.append(row);
      }
    },
    /** exact solve, float solve, then numeric searches from several starting points */
    async findSolutions(sub, U, knownVals) {
      const app = this.app;
      const mags = new Set(['1', '0.1', '10', '-1']);
      const nums = await app.cas.batch(knownVals.map((v) => 'evalf(' + v + ')'));
      for (const v of nums) { const x = Math.abs(Number(v)); if (isFinite(x) && x > 0) { mags.add(String(x)); mags.add(String(1 / x)); } }
      const tries = ['solve(exact(' + sub + '),' + U + ')', 'solve(' + sub + ',' + U + ')', ...[...mags].slice(0, 10).map((g) => 'fsolve(' + sub + ',' + U + '=' + g + ')')];
      const res = await app.cas.batch(tries);
      const all = [];
      for (const r of res) for (const x of this.parseSolutions(r, U)) if (!all.some((y) => Math.abs(Number(y) - Number(x)) <= 1e-9 * Math.max(1, Math.abs(Number(x))))) all.push(x);
      // check each candidate really satisfies the equation (fsolve can stop at a non-root)
      const chk = await app.cas.batch(all.flatMap((x) => ['evalf(subst(left(' + sub + '),' + U + ',' + x + '))', 'evalf(subst(right(' + sub + '),' + U + ',' + x + '))']));
      const good = all.filter((x, i) => { const L = Number(chk[2 * i]), R = Number(chk[2 * i + 1]); if (!isFinite(L) || !isFinite(R)) return false; return Math.abs(L - R) <= 1e-7 * (Math.abs(L) + Math.abs(R)) + 1e-300; });
      return good.sort((p, q) => (Number(q) >= 0) - (Number(p) >= 0) || Math.abs(p) - Math.abs(q)).slice(0, 6);
    },
    parseSolutions(res, U) {
      if (!res || /GIAC_ERROR|Error/.test(res)) return [];
      let ast; try { ast = GiacFmt.parse(res); } catch (e) { return []; }
      const vals = [];
      const walk = (n) => {
        if (!n) return;
        if (n.t === 'vec') n.items.forEach(walk);
        else if (n.t === 'paren') walk(n.a);
        else if (n.t === 'bin' && (n.op === 'or' || n.op === 'and')) { walk(n.a); walk(n.b); }
        else if (n.t === 'bin' && n.op === '=' && n.a.t === 'id' && n.a.v === U) vals.push(n.b);
        else if (n.t === 'num' || n.t === 'neg' || (n.t === 'bin' && !/zv/.test(JSON.stringify(n)))) vals.push(n);
      };
      walk(ast);
      const out = [];
      for (const v of vals) {
        try { const x = GiacFmt.compile(v, [])(); if (typeof x === 'number' && isFinite(x)) out.push(String(+x.toPrecision(12))); } catch (e) { /* complex or symbolic: skip */ }
      }
      return [...new Set(out)];
    },
  };
  root.Library = Library;
})(typeof self !== 'undefined' ? self : this);
