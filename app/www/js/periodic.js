/*
 * periodic.js — the periodic table: the main view of the Periodic Table module (chem.periodic). The element data is
 * the module's own "Elements" and "Isotopes" tables; this file only draws it. Colour by category, block, state or a
 * property; tap an element for everything about it, its isotopes, and its molar mass; work out a formula's molar mass.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, Sheet } = UI;

  const CAT_COLORS = {
    'alkali metal': '#E8835E', 'alkaline earth metal': '#EFB45E', 'transition metal': '#D6B4E6', 'post-transition metal': '#9FC9E3',
    metalloid: '#9ED9B5', 'polyatomic nonmetal': '#B8E07A', 'diatomic nonmetal': '#B8E07A', nonmetal: '#B8E07A', 'reactive nonmetal': '#B8E07A',
    'noble gas': '#8FD3D9', lanthanide: '#F2A7C2', actinide: '#E7A3A3', unknown: '#CFD4DA',
  };
  const BLOCK_COLORS = { s: '#E8835E', p: '#9FC9E3', d: '#D6B4E6', f: '#F2A7C2' };
  const STATE_COLORS = { solid: '#CFD4DA', liquid: '#8FC2E8', gas: '#F2D07A', 'expected to be a solid': '#E3E6EA', 'expected to be a gas': '#F6E6B8' };
  const VIEWS = [
    ['cat', 'Category'], ['block', 'Block'], ['state', 'State'],
    ['Electronegativity (Pauling)', 'Electronegativity'], ['Atomic radius (pm)', 'Atomic radius'], ['First ionization energy (eV)', 'Ionization energy'],
    ['Electron affinity (eV)', 'Electron affinity'], ['Melting point (K)', 'Melting point'], ['Boiling point (K)', 'Boiling point'],
    ['Density (g/cm³)', 'Density'], ['Atomic mass (u)', 'Atomic mass'], ['Molar heat capacity (J/(mol·K))', 'Heat capacity'],
  ];
  const UNITS = { 'Electronegativity (Pauling)': '', 'Atomic radius (pm)': 'pm', 'First ionization energy (eV)': 'eV', 'Electron affinity (eV)': 'eV', 'Melting point (K)': 'K', 'Boiling point (K)': 'K', 'Density (g/cm³)': 'g/cm³', 'Atomic mass (u)': 'u', 'Molar heat capacity (J/(mol·K))': 'J/(mol·K)' };

  /** the module's tables as element objects (cached per module object) */
  const cache = new WeakMap();
  function data(m) {
    if (cache.has(m)) return cache.get(m);
    const tbl = (title) => { for (const s of m.sections) for (const it of s.items) if (it.type === 'table' && it.title === title) return it; return null; };
    const t = tbl('Elements'), ti = tbl('Isotopes');
    const els = t ? t.rows.map((r) => { const o = {}; t.columns.forEach((c, i) => { o[c] = r[i] || ''; }); o.z = +o.Z; o.x = +o.x; o.y = +o.y; o.iso = []; return o; }) : [];
    const byZ = new Map(els.map((e) => [e.z, e]));
    if (ti) for (const r of ti.rows) { const e = byZ.get(+r[0]); if (e) e.iso.push({ A: +r[2], m: r[3], ab: r[4] }); }
    const bySym = new Map(els.map((e) => [e.Symbol, e]));
    const d = { els, byZ, bySym };
    cache.set(m, d);
    return d;
  }

  /** molar mass of a formula: H2O, Ca(OH)2, CuSO4·5H2O, [Fe(CN)6]3- … */
  function molarMass(formula, bySym) {
    const s = String(formula).replace(/\s+/g, '').replace(/[⁺⁻+−-]\d*$|\d*[⁺⁻+−-]$/, '');
    const parts = s.split(/[·*.]/);
    const total = new Map();
    for (const part0 of parts) {
      let mult = 1, part = part0;
      const lead = part.match(/^(\d+)(.*)$/); if (lead) { mult = +lead[1]; part = lead[2]; }
      let i = 0;
      const group = () => {
        const counts = new Map();
        while (i < part.length) {
          const c = part[i];
          if (c === '(' || c === '[') { i++; const g = group(); if (part[i] !== ')' && part[i] !== ']') throw new Error('A bracket isn’t closed'); i++; const n = num(); for (const [k, v] of g) counts.set(k, (counts.get(k) || 0) + v * n); continue; }
          if (c === ')' || c === ']') return counts;
          const m = part.slice(i).match(/^[A-Z][a-z]?/); if (!m) throw new Error('“' + part.slice(i, i + 3) + '” isn’t an element symbol');
          if (!bySym.has(m[0])) throw new Error(m[0] + ' isn’t an element');
          i += m[0].length; const n = num(); counts.set(m[0], (counts.get(m[0]) || 0) + n);
        }
        return counts;
      };
      const num = () => { const m = part.slice(i).match(/^\d+(\.\d+)?/); if (!m) return 1; i += m[0].length; return +m[0]; };
      const g = group(); if (i < part.length) throw new Error('Unexpected “' + part[i] + '”');
      for (const [k, v] of g) total.set(k, (total.get(k) || 0) + v * mult);
    }
    if (!total.size) throw new Error('Type a formula, like H2SO4');
    let M = 0; const rows = [];
    for (const [sym, n] of total) { const a = parseFloat(bySym.get(sym)['Atomic mass (u)']); M += a * n; rows.push({ sym, n, a }); }
    return { M, rows: rows.map((r) => ({ ...r, w: (r.a * r.n) / M })) };
  }

  function colorFor(e, view, range) {
    if (view === 'cat') return CAT_COLORS[(e.Category || '').toLowerCase()] || CAT_COLORS.unknown;
    if (view === 'block') return BLOCK_COLORS[e.Block] || CAT_COLORS.unknown;
    if (view === 'state') return STATE_COLORS[(e['State at 25 °C'] || '').toLowerCase()] || CAT_COLORS.unknown;
    const v = parseFloat(e[view]); if (!isFinite(v) || !range) return CAT_COLORS.unknown;
    let t = (v - range[0]) / (range[1] - range[0] || 1);
    if (range[2]) t = (Math.log(Math.max(v, range[0] * 1.0001)) - Math.log(range[0])) / (Math.log(range[1]) - Math.log(range[0]) || 1);
    t = Math.max(0, Math.min(1, t));
    // light blue → yellow → red
    const stops = [[198, 222, 245], [246, 226, 140], [232, 120, 96]];
    const k = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const c = stops[k].map((x, i) => Math.round(x + (stops[k + 1][i] - x) * u));
    return 'rgb(' + c.join(',') + ')';
  }

  function view(b, app, m, page) {
    const D = data(m);
    if (!D.els.length) { b.append(el('p', { class: 'desc gd-pad', text: 'This module has no element table.' })); return; }
    const st = page.ptState || (page.ptState = { view: 'cat', q: '' });
    const wrap = el('div', { class: 'pt-wrap' });
    const bar = el('div', { class: 'pt-bar' });
    const sel = el('select', { class: 'pt-sel', 'aria-label': 'Colour by' }, VIEWS.map(([v, l]) => el('option', { value: v, text: l })));
    sel.value = st.view;
    const q = el('input', { type: 'search', class: 'pt-q', placeholder: 'Find: Fe, iron, 26', value: st.q, autocomplete: 'off' });
    bar.append(sel, q, el('button', { class: 'chip', text: 'Molar mass', onclick: () => molarSheet(app, D) }));
    const grid = el('div', { class: 'pt-grid' });
    const legend = el('div', { class: 'pt-legend' });
    wrap.append(bar, grid, legend);
    b.append(wrap);
    const draw = () => {
      grid.innerHTML = ''; legend.innerHTML = '';
      const v = st.view, term = st.q.trim().toLowerCase();
      let range = null;
      if (UNITS[v] !== undefined) {
        const vals = D.els.map((e) => parseFloat(e[v])).filter(isFinite);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        range = [lo, hi, lo > 0 && hi / lo > 200];
        legend.append(el('span', { text: (range[2] ? 'log scale · ' : '') + Units.num(lo, 4) + ' ' + UNITS[v] }), el('i', { class: 'pt-ramp' }), el('span', { text: Units.num(hi, 4) + ' ' + UNITS[v] }), el('span', { class: 'sub', text: 'grey: no data' }));
      } else {
        const map = v === 'cat' ? CAT_COLORS : v === 'block' ? BLOCK_COLORS : STATE_COLORS;
        const shown = new Set(D.els.map((e) => (v === 'cat' ? (e.Category || '').toLowerCase() : v === 'block' ? e.Block : (e['State at 25 °C'] || '').toLowerCase())));
        const done = new Set(); for (const [k, c] of Object.entries(map)) { const lab = k.replace(/^(diatomic|polyatomic|reactive) nonmetal$/, 'nonmetal'); if (!shown.has(k) || done.has(lab)) continue; done.add(lab); legend.append(el('span', { class: 'pt-key' }, el('i', { style: { background: c } }), el('span', { text: lab }))); }
      }
      for (const e of D.els) {
        const c = el('button', { class: 'pt-el', 'aria-label': e.Name, style: { gridColumn: String(e.x), gridRow: String(e.y >= 9 ? e.y + 0 : e.y), background: colorFor(e, v, range) } });
        if (term && !(e.Symbol.toLowerCase() === term || e.Name.toLowerCase().includes(term) || String(e.z) === term)) c.classList.add('dim');
        const val = UNITS[v] !== undefined && e[v] ? Units.num(parseFloat(e[v]), 4) : '';
        c.append(el('span', { class: 'pt-z', text: String(e.z) }), el('span', { class: 'pt-s', text: e.Symbol }), el('span', { class: 'pt-n', text: val || e.Name }));
        c.onclick = () => detail(app, D, e);
        grid.append(c);
      }
      // the gap between the main table and the f-block, and the markers for where it belongs
      grid.append(el('div', { class: 'pt-gap', style: { gridColumn: '1 / 19', gridRow: '8' } }));
      grid.append(el('div', { class: 'pt-mark', text: '57–71', style: { gridColumn: '3', gridRow: '6' } }), el('div', { class: 'pt-mark', text: '89–103', style: { gridColumn: '3', gridRow: '7' } }));
    };
    sel.onchange = () => { st.view = sel.value; draw(); };
    q.oninput = () => { st.q = q.value; draw(); };
    q.onkeydown = (ev) => { if (ev.key === 'Enter') { const t = q.value.trim().toLowerCase(); const e = D.els.find((x) => x.Symbol.toLowerCase() === t || x.Name.toLowerCase() === t || String(x.z) === t) || D.els.find((x) => x.Name.toLowerCase().startsWith(t)); if (e) detail(app, D, e); } };
    draw();
  }

  function detail(app, D, e) {
    Sheet.open(e.Name, (b) => {
      const head = el('div', { class: 'pt-head' },
        el('div', { class: 'pt-big', style: { background: CAT_COLORS[(e.Category || '').toLowerCase()] || CAT_COLORS.unknown } }, el('span', { class: 'pt-z', text: String(e.z) }), el('span', { class: 'pt-s', text: e.Symbol }), el('span', { class: 'pt-n', text: e['Atomic mass (u)'] })),
        el('div', {}, el('div', { class: 'pt-title', text: e.Name }), el('div', { class: 'sub', text: [e.Category, e.Block ? e.Block + '-block' : '', e.Group ? 'group ' + e.Group : '', e.Period ? 'period ' + e.Period : ''].filter(Boolean).join(' · ') })));
      b.append(head);
      const M = parseFloat(e['Atomic mass (u)']);
      b.append(el('div', { class: 'btnrow' },
        el('button', { class: 'btn', text: 'Insert molar mass', onclick: () => { Sheet.close(); toCalc(app, Units.num(M, 10) + '\\,\\mathrm{g}/\\mathrm{mol}'); } }),
        el('button', { class: 'btn', text: 'Copy', onclick: () => { const t = e.Name + ' (' + e.Symbol + ', Z = ' + e.z + '): ' + M + ' g/mol'; try { navigator.clipboard.writeText(t); toast('Copied'); } catch (x) { toast(t); } } })));
      const rows = [
        ['Atomic number', e.z], ['Atomic mass', e['Atomic mass (u)'] && e['Atomic mass (u)'] + ' u (g/mol)'], ['Monoisotopic mass', e['Monoisotopic mass (u)'] && e['Monoisotopic mass (u)'] + ' u'],
        ['Electron configuration', e['Electron configuration']], ['Electrons per shell', e['Electrons per shell']], ['Oxidation states', e['Oxidation states']],
        ['Electronegativity (Pauling)', e['Electronegativity (Pauling)']], ['Atomic radius', e['Atomic radius (pm)'] && e['Atomic radius (pm)'] + ' pm'], ['Van der Waals radius', e['Van der Waals radius (pm)'] && e['Van der Waals radius (pm)'] + ' pm'],
        ['First ionization energy', e['First ionization energy (eV)'] && e['First ionization energy (eV)'] + ' eV'], ['Electron affinity', e['Electron affinity (eV)'] && e['Electron affinity (eV)'] + ' eV'],
        ['State at 25 °C', e['State at 25 °C']], ['Bonding', e.Bonding], ['Melting point', tempText(e['Melting point (K)'])], ['Boiling point', tempText(e['Boiling point (K)'])],
        ['Density', e['Density (g/cm³)'] && e['Density (g/cm³)'] + ' g/cm³'], ['Molar heat capacity', e['Molar heat capacity (J/(mol·K))'] && e['Molar heat capacity (J/(mol·K))'] + ' J/(mol·K)'],
        ['Discovered', [e.Discovered, e['Discovered by'] && e['Discovered by'] !== e.Discovered ? 'by ' + e['Discovered by'] : ''].filter(Boolean).join(' ')], ['Named by', e['Named by']],
      ];
      const T = el('table', { class: 'pt-tbl' });
      for (const [k, v] of rows) if (v !== '' && v != null) T.append(el('tr', {}, el('th', { text: k }), el('td', { text: String(v) })));
      b.append(T);
      const ies = (e['Ionization energies (kJ/mol)'] || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (ies.length) {
        const d = el('details', { class: 'pt-det' }, el('summary', { text: 'Ionization energies (' + ies.length + ')' }));
        const t = el('table', { class: 'pt-tbl' }); ies.forEach((x, i) => t.append(el('tr', {}, el('th', { text: ordinal(i + 1) }), el('td', { text: x + ' kJ/mol = ' + Units.num(+x / 96.485332, 5) + ' eV' }))));
        d.append(t); b.append(d);
      }
      if (e.iso.length) {
        const nat = e.iso.filter((i) => i.ab !== '');
        const d = el('details', { class: 'pt-det', open: nat.length > 0 }, el('summary', { text: 'Isotopes (' + (nat.length ? nat.length + ' natural, ' : '') + e.iso.length + ' listed)' }));
        const t = el('table', { class: 'pt-tbl' }, el('tr', {}, el('th', { text: 'Isotope' }), el('th', { text: 'Mass (u)' }), el('th', { text: 'Abundance' })));
        for (const i of nat.length ? nat.concat(e.iso.filter((x) => x.ab === '')) : e.iso) t.append(el('tr', { class: i.ab === '' ? 'sub' : '' }, el('td', { text: i.A + e.Symbol }), el('td', { text: i.m }), el('td', { text: i.ab === '' ? '—' : i.ab + ' %' })));
        d.append(t); b.append(d);
      }
      b.append(el('p', { class: 'desc', text: 'Sources in the module’s About section. Values for the heaviest elements are predictions.' }));
    });
  }
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  function tempText(k) { const v = parseFloat(k); if (!isFinite(v)) return ''; return v + ' K (' + Units.num(v - 273.15, 5) + ' °C)'; }
  function toCalc(app, tex) { let ci = app.pages.findIndex((p) => p.kind === 'calc'); if (ci < 0) { app.addPage('calc'); ci = app.pages.length - 1; } else app.select(ci); setTimeout(() => app.insert(tex), 80); }

  function molarSheet(app, D) {
    Sheet.open('Molar mass', (b) => {
      b.append(el('p', { class: 'desc', text: 'Type a chemical formula: H2O, Ca(OH)2, C6H12O6, CuSO4·5H2O (· or . for a hydrate).' }));
      const inp = el('input', { type: 'text', class: 'search', placeholder: 'H2SO4', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'data-oskb': '1' });
      const out = el('div');
      const go = () => {
        out.innerHTML = '';
        if (!inp.value.trim()) return;
        let r; try { r = molarMass(inp.value, D.bySym); } catch (e) { out.append(el('p', { class: 'desc', text: e.message })); return; }
        const t = el('div', { class: 'card', style: { fontSize: '20px' } }); renderTex(t, 'M=' + Units.num(r.M, 8) + '\\,\\mathrm{g/mol}'); out.append(t);
        const T = el('table', { class: 'pt-tbl' }, el('tr', {}, el('th', { text: 'Element' }), el('th', { text: 'Atoms' }), el('th', { text: 'Mass' }), el('th', { text: 'By mass' })));
        for (const x of r.rows) T.append(el('tr', {}, el('td', { text: x.sym }), el('td', { text: String(x.n) }), el('td', { text: Units.num(x.a * x.n, 7) }), el('td', { text: (x.w * 100).toFixed(2) + ' %' })));
        out.append(T, el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Insert', onclick: () => { Sheet.close(); toCalc(app, Units.num(r.M, 10) + '\\,\\mathrm{g}/\\mathrm{mol}'); } })));
      };
      inp.oninput = go;
      b.append(inp, out);
      setTimeout(() => inp.focus(), 60);
    });
  }

  const tool = { title: 'Periodic table', chip: 'Periodic table', main: true, landscape: true, run: (b, app, m, page) => view(b, app, m, page || {}) };
  if (root.Modules && Modules.TOOLS) Modules.TOOLS['chem.periodic'] = tool;
  root.Periodic = { molarMass, data };
})(typeof self !== 'undefined' ? self : this);
