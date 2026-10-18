/*
 * converter.js — Conversion tool: units of any quantity (including compound units typed freely),
 * optics (linewidth Δν ↔ Δλ at a centre wavelength or frequency, photon equivalents), number bases, and decibels.
 * Used as a page and inside the Constants & formulas sheet. Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex } = UI;
  const C0 = 299792458, H = 6.62607015e-34, E = 1.602176634e-19, KB = 1.380649e-23;

  /** Evaluate a typed number: 1550e-9, 3/4, 2^10, 1.2×10^-3, pi/4, sqrt(2). Returns NaN if invalid. */
  function evalNum(s) {
    s = String(s || '').trim().replace(/×\s*10\^?/g, 'e').replace(/·/g, '*').replace(/−/g, '-').replace(/,/g, '.').replace(/π|\bpi\b/gi, '(' + Math.PI + ')').replace(/\^/g, '**').replace(/√\(?/g, 'sqrt(');
    if (!s) return NaN;
    if (!/^[\d.eE+\-*/() sqrtlogn]*$/.test(s)) return NaN;
    try { const v = Function('"use strict";const sqrt=Math.sqrt,ln=Math.log,log=Math.log10;return (' + s + ')')(); return typeof v === 'number' ? v : NaN; } catch (e) { return NaN; }
  }
  const fmtMode = () => (root.__app && root.__app.settings.convFmt) || 'eng';
  const F = (x, d = 7) => Units.fmt(x, fmtMode(), d);
  const texOf = (x, u) => F(x, 7).tex + (u ? '\\,' + Units.unitTex(u) : '');

  function insertValue(app, x, closeSheet) {
    const t = Units.fmt(x, fmtMode(), 12).tex;
    if (closeSheet) UI.Sheet.close();
    let ci = app.pages.findIndex((p) => p.kind === 'calc');
    if (app.page && app.page.target) { app.insert(t); return; }
    if (ci < 0) { app.addPage('calc'); ci = app.pages.length - 1; } else app.select(ci);
    setTimeout(() => app.insert(t), 60);
  }
  function copy(text) { try { navigator.clipboard.writeText(text); toast('Copied ' + text); } catch (e) { toast(text); } }

  /** Row: math value + label + Insert/Copy actions */
  function resultRow(app, x, u, label, opts = {}) {
    const m = el('span', { style: { fontSize: '18px' } }); renderTex(m, texOf(x, u));
    const row = el('div', { class: 'cv-row' + (opts.main ? ' main' : '') },
      el('div', { class: 'cv-val' }, m, label ? el('span', { class: 'sub', text: label }) : null),
      el('div', { class: 'cv-act' },
        el('button', { class: 'chip', text: 'Insert', onclick: () => insertValue(app, x, opts.sheet) }),
        el('button', { class: 'chip', text: 'Copy', onclick: () => copy(Units.num(x, 10) + (u ? ' ' + u : '')) })));
    if (opts.onPick) row.querySelector('.cv-val').onclick = opts.onPick;
    return row;
  }

  function fmtSeg(app, rerender) {
    const seg = el('div', { class: 'seg', style: { marginBottom: '8px' } });
    for (const [k, l] of [['eng', 'Eng ×10³ⁿ'], ['sci', 'Sci'], ['plain', 'Plain']]) {
      const b = el('button', { text: l, class: fmtMode() === k ? 'on' : '' });
      b.onclick = () => { app.settings.convFmt = k; app.saveSettings(); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); rerender(); };
      seg.append(b);
    }
    return seg;
  }

  const Converter = {
    tab: 'units', qty: 'Length', from: 'nm', to: 'µm', val: '1550',
    build(b, app, opts = {}) {
      this.app = app; this.sheet = !!opts.sheet;
      const seg = el('div', { class: 'seg', style: { marginBottom: '10px' } });
      for (const [k, l] of [['units', 'Units'], ['photon', 'Optics'], ['base', 'Number base'], ['db', 'Decibels']]) {
        const x = el('button', { text: l, class: this.tab === k ? 'on' : '' });
        x.onclick = () => { this.tab = k; seg.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === x)); body.innerHTML = ''; this[k](body); };
        seg.append(x);
      }
      const body = el('div');
      b.append(seg, body);
      this[this.tab](body);
    },

    /* ---------------- units ---------------- */
    units(b) {
      const app = this.app;
      const OTHER = '…other';
      const q = el('input', { class: 'search', type: 'search', placeholder: 'Find a quantity or unit (e.g. psi, viscosity, kWh)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const chips = el('div', { class: 'chips' });
      const valI = el('input', { class: 'search cv-in', value: this.val, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Value' });
      const fromS = el('select', { class: 'search cv-in', 'aria-label': 'From unit' });
      const toS = el('select', { class: 'search cv-in', 'aria-label': 'To unit' });
      const mkOther = (lbl) => el('input', { class: 'search cv-in', hidden: true, placeholder: 'Type a unit, e.g. W/(m·K)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': lbl, style: { marginTop: '6px' } });
      const fromI = mkOther('Other from unit'), toI = mkOther('Other to unit');
      /** units offered for the current quantity (or for a typed unit with no named quantity) */
      const unitList = () => {
        let L = [];
        try { const d = Units.parse(this.from).d; const qq = Units.quantityOf(d); L = qq ? qq[2].slice() : Units.alternatives(this.from, 1); } catch (e) {
          const qq = Units.QUANTITIES.find((x) => x[0] === this.qty); L = qq ? qq[2].slice() : [];
        }
        for (const u of [this.from, this.to]) if (u && !L.includes(u)) { try { if (!L.length || Units.compatible(L[0], u)) L.push(u); } catch (e) { /* skip */ } }
        return L;
      };
      const optText = (u) => { const n = (Units.lookup(u) || {}).name; return n && n !== u ? u + '  —  ' + n : u; };
      const fill = () => {
        const L = unitList();
        if (L.length && !L.includes(this.to)) this.to = L.find((u) => u !== this.from) || L[0];
        for (const [S, I, cur] of [[fromS, fromI, this.from], [toS, toI, this.to]]) {
          S.innerHTML = '';
          for (const u of L) S.append(el('option', { value: u, text: optText(u) }));
          S.append(el('option', { value: OTHER, text: 'Other unit…' }));
          if (L.includes(cur)) { S.value = cur; I.hidden = true; } else { S.value = OTHER; I.hidden = false; I.value = cur || ''; }
        }
      };
      const drawChips = () => {
        chips.innerHTML = ''; const s = q.value.trim().toLowerCase();
        for (const [name, , list] of Units.QUANTITIES) {
          if (s && !(name.toLowerCase().includes(s) || list.some((u) => u.toLowerCase() === s || (Units.lookup(u) || {}).name?.toLowerCase().includes(s)))) continue;
          const c = el('button', { class: 'chip' + (name === this.qty ? ' on' : ''), text: name });
          c.onclick = () => { this.qty = name; const L = Units.QUANTITIES.find((x) => x[0] === name)[2]; this.from = L[0]; this.to = L[1] || L[0]; fill(); drawChips(); calc(); };
          chips.append(c);
        }
      };
      const read = (S, I) => (S.value === OTHER ? I.value.trim() : S.value);
      const swap = el('button', { class: 'ib', 'aria-label': 'Swap units', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/></svg>', onclick: () => { [this.from, this.to] = [this.to, this.from]; fill(); calc(); } });
      const out = el('div'); const all = el('div');
      const lab = (t, ...n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), ...n);
      const unitHelp = el('p', { class: 'desc', text: 'Pick units from the lists. For anything else choose Other unit… and type it, including compound units: W/(m·K), km/s/Mpc, MeV/c², ps/(nm·km). Prefixes from q to Q work on SI units.' });
      const calc = () => {
        this.val = valI.value; this.from = read(fromS, fromI); this.to = read(toS, toI);
        out.innerHTML = ''; all.innerHTML = '';
        const v = evalNum(valI.value);
        if (!isFinite(v)) { out.append(el('p', { class: 'desc', text: 'Enter a number, e.g. 1550, 2.5e-3 or 3/4.' })); return; }
        if (!this.from || !this.to) { out.append(el('p', { class: 'desc', text: 'Type the other unit.' })); return; }
        let pf;
        try { pf = Units.parse(this.from); } catch (e) { out.append(el('p', { class: 'desc err', text: e.message })); return; }
        try {
          const r = Units.convert(v, this.from, this.to);
          out.append(resultRow(app, r, this.to, '', { main: true, sheet: this.sheet }));
        } catch (e) { out.append(el('p', { class: 'desc err', text: e.message })); }
        const qn = Units.quantityOf(pf.d);
        const list = Units.alternatives(this.from, v).filter((u) => u !== this.from);
        all.append(el('h4', { class: 'cv-h', text: (qn ? qn[0] : Units.dimText(pf.d)) + ' — ' + F(v).text + ' ' + this.from + ' is' }));
        for (const u of list) { try { const r = Units.convert(v, this.from, u); all.append(resultRow(app, r, u, (Units.lookup(u) || {}).name || '', { sheet: this.sheet, onPick: () => { this.to = u; fill(); calc(); } })); } catch (e) { /* skip */ } }
        const ph = Units.photonEquivalents(v, this.from);
        if (ph.length) { all.append(el('h4', { class: 'cv-h', text: 'As light (photon equivalents)' })); for (const p of ph) all.append(resultRow(app, p.value, p.unit, Units.SPEC_LABEL[p.kind], { sheet: this.sheet })); }
      };
      valI.addEventListener('input', calc);
      for (const [S, I] of [[fromS, fromI], [toS, toI]]) {
        S.addEventListener('change', () => { I.hidden = S.value !== OTHER; if (!I.hidden) { I.value = ''; I.focus(); } calc(); if (S === fromS && S.value !== OTHER) { fill(); calc(); } });
        I.addEventListener('input', calc);
        I.addEventListener('change', () => { fill(); calc(); });
      }
      q.oninput = drawChips;
      b.append(q, chips, fmtSeg(app, calc), lab('Value', valI), el('div', { class: 'cv-stack' }, lab('From', fromS, fromI), el('div', { class: 'cv-swap' }, swap), lab('To', toS, toI)), unitHelp, out, all);
      fill(); drawChips(); calc();
    },

    /* ---------------- optics: linewidth Δν ↔ Δλ, photon equivalents ---------------- */
    photon(b) {
      const app = this.app;
      const CENTRE = [['Wavelength', ['nm', 'µm', 'pm', 'Å', 'm']], ['Frequency', ['THz', 'GHz', 'PHz', 'Hz']], ['Wavenumber', ['1/cm']], ['Photon energy', ['eV', 'J']], ['Angular frequency', ['rad/s']]];
      const WIDTH = [['Wavelength (Δλ)', ['pm', 'nm', 'µm', 'fm', 'Å']], ['Frequency (Δν)', ['Hz', 'kHz', 'MHz', 'GHz', 'THz']], ['Wavenumber (Δν̃)', ['1/cm', '1/m']], ['Energy (ΔE)', ['µeV', 'meV', 'eV']], ['Angular frequency (Δω)', ['rad/s']]];
      const OUT = [['Wavelength', ['fm', 'pm', 'nm', 'µm']], ['Frequency', ['Hz', 'kHz', 'MHz', 'GHz', 'THz']], ['Wavenumber', ['1/cm', '1/m']], ['Energy', ['µeV', 'meV', 'eV']], ['Angular frequency', ['rad/s']]];
      const grouped = (groups, cur) => el('select', { class: 'search cv-in' }, groups.map(([g, us]) => el('optgroup', { label: g }, us.map((u) => el('option', { value: u, text: u, selected: u === cur })))));
      this.ph = Object.assign({ v: '1550', u: 'nm', n: '1', dv: '0.02', du: 'nm', ou: 'MHz' }, this.ph || {});
      const S = this.ph;
      const vI = el('input', { class: 'search cv-in', value: S.v, inputmode: 'decimal', 'aria-label': 'Centre value' });
      const uSel = grouped(CENTRE, S.u); uSel.setAttribute('aria-label', 'Centre unit');
      const dvI = el('input', { class: 'search cv-in', value: S.dv, inputmode: 'decimal', 'aria-label': 'Width value' });
      const duSel = grouped(WIDTH, S.du); duSel.setAttribute('aria-label', 'Width unit');
      const ouSel = grouped(OUT, S.ou); ouSel.setAttribute('aria-label', 'Show the width in');
      const nI = el('input', { class: 'search cv-in', value: S.n, inputmode: 'decimal', 'aria-label': 'Refractive index' });
      const out = el('div');
      const lab = (t, n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), n);
      const widthKind = (u) => Units.specKind(u); // wavelength, freq, wavenumber, energy, angfreq
      const calc = () => {
        Object.assign(S, { v: vI.value, u: uSel.value, n: nI.value, dv: dvI.value, du: duSel.value, ou: ouSel.value });
        out.innerHTML = '';
        const v = evalNum(S.v), n = evalNum(S.n) || 1;
        if (!(v > 0)) { out.append(el('p', { class: 'desc', text: 'Enter a positive centre wavelength or frequency.' })); return; }
        const k = Units.specKind(S.u); const Ej = Units.SPEC[k](Units.convert(v, S.u, Units.SPEC_UNITS[k]));
        const lam = H * C0 / Ej, nu = Ej / H;
        // ---- linewidth / bandwidth
        const dv = evalNum(S.dv);
        if (dv > 0) {
          const wk = widthKind(S.du); const x = Units.convert(dv, S.du, Units.SPEC_UNITS[wk]);
          const dnu = wk === 'wavelength' ? C0 * x / (lam * lam) : wk === 'freq' ? x : wk === 'wavenumber' ? C0 * x : wk === 'energy' ? x / H : x / (2 * Math.PI);
          const dlam = dnu * lam * lam / C0;
          const ok = widthKind(S.ou);
          const inOut = ok === 'wavelength' ? Units.convert(dlam, 'm', S.ou) : ok === 'freq' ? Units.convert(dnu, 'Hz', S.ou) : ok === 'wavenumber' ? Units.convert(dnu / C0, '1/m', S.ou) : ok === 'energy' ? Units.convert(dnu * H, 'J', S.ou) : 2 * Math.PI * dnu;
          const sym = { wavelength: 'Δλ', freq: 'Δν', wavenumber: 'Δν̃', energy: 'ΔE', angfreq: 'Δω' }[ok];
          out.append(el('h4', { class: 'cv-h', text: 'Width ' + F(dv).text + ' ' + S.du + ' at ' + F(v).text + ' ' + S.u }));
          out.append(resultRow(app, inOut, S.ou, sym + (wk === 'wavelength' && ok !== 'wavelength' ? ' = cΔλ/λ²' : wk !== 'wavelength' && ok === 'wavelength' ? ' = λ²Δν/c' : ''), { main: true, sheet: this.sheet }));
          const best = (si, siU, units) => { const c = units.map((u) => [u, Units.convert(si, siU, u)]); return c.find(([, y]) => Math.abs(y) >= 1 && Math.abs(y) < 1000) || c[c.length - 1]; };
          const rows = [];
          const L = best(dlam, 'm', ['fm', 'pm', 'nm', 'µm']); rows.push([L[1], L[0], 'Δλ = λ²Δν/c']);
          const N = best(dnu, 'Hz', ['Hz', 'kHz', 'MHz', 'GHz', 'THz']); rows.push([N[1], N[0], 'Δν = cΔλ/λ²']);
          if (N[0] !== 'MHz') rows.push([dnu / 1e6, 'MHz', 'Δν']);
          if (N[0] !== 'GHz') rows.push([dnu / 1e9, 'GHz', 'Δν']);
          rows.push([dnu / C0 / 100, '1/cm', 'Δν̃ = Δν/c'], [2 * Math.PI * dnu, 'rad/s', 'Δω = 2πΔν'], [dnu * H / E * 1e6, 'µeV', 'ΔE = hΔν'],
            [dnu / nu, '', 'fractional width Δν/ν = Δλ/λ'], [nu / dnu, '', 'quality factor Q = ν/Δν'],
            [C0 / (n * dnu), 'm', 'coherence length c/(nΔν) (Lorentzian: ÷π)'], [1 / (Math.PI * dnu), 's', 'coherence time 1/(πΔν), Lorentzian'],
            [0.441 / dnu, 's', 'transform-limited Gaussian pulse 0.441/Δν'], [0.315 / dnu, 's', 'transform-limited sech² pulse 0.315/Δν']);
          for (const [x2, u, l] of rows) out.append(resultRow(app, x2, u, l, { sheet: this.sheet }));
          out.append(el('p', { class: 'desc', text: 'Δν = cΔλ/λ² is the first-order relation; it is exact to better than (Δλ/2λ)², which is negligible for narrow lines.' }));
        } else out.append(el('p', { class: 'desc', text: 'Enter a width Δλ or Δν (for example 0.02 nm, the resolution of an OSA) to convert it at this centre.' }));
        // ---- photon equivalents of the centre
        const rows = [
          [lam * 1e9, 'nm', 'vacuum wavelength λ₀'], [lam * 1e6, 'µm', 'vacuum wavelength λ₀'],
          [lam / n * 1e9, 'nm', 'wavelength in the medium λ₀/n (n = ' + n + ')'],
          [nu / 1e12, 'THz', 'frequency ν'], [2 * Math.PI * nu, 'rad/s', 'angular frequency ω'],
          [1 / lam / 100, '1/cm', 'wavenumber ν̃ = 1/λ₀'], [2 * Math.PI * n / lam, '1/m', 'propagation constant k = 2πn/λ₀'],
          [Ej / E, 'eV', 'photon energy hν'], [Ej, 'J', 'photon energy hν'], [Ej / KB, 'K', 'temperature equivalent hν/k'],
          [1 / nu * 1e15, 'fs', 'optical period 1/ν'], [1e-3 / Ej, '1/s', 'photons per second in 1 mW'],
          [E / Ej, 'A/W', 'ideal responsivity qλ/hc (η = 1)'],
        ];
        out.append(el('h4', { class: 'cv-h', text: 'The centre, ' + F(v).text + ' ' + S.u + ', is' }));
        for (const [x, u, l] of rows) out.append(resultRow(app, x, u, l, { sheet: this.sheet }));
      };
      for (const i of [vI, uSel, nI, dvI, duSel, ouSel]) { i.addEventListener('input', calc); i.addEventListener('change', calc); }
      b.append(fmtSeg(app, calc),
        el('div', { class: 'cv-units' }, lab('Centre λ or ν', vI), lab('Unit', uSel)),
        el('div', { class: 'cv-units' }, lab('Width Δλ or Δν', dvI), lab('Unit', duSel)),
        el('div', { class: 'cv-units' }, lab('Show the width in', ouSel), lab('Refractive index n', nI)), out);
      calc();
    },

    /* ---------------- number bases ---------------- */
    base(b) {
      const app = this.app;
      this.bs = this.bs || { v: '255', from: '10' };
      const S = this.bs;
      const vI = el('input', { class: 'search cv-in', value: S.v, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const fSel = el('select', { class: 'search cv-in' }, [['10', 'Decimal'], ['16', 'Hexadecimal'], ['2', 'Binary'], ['8', 'Octal']].map(([v, t]) => el('option', { value: v, text: t, selected: v === S.from })));
      const out = el('div');
      const lab = (t, n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), n);
      const calc = () => {
        S.v = vI.value; S.from = fSel.value; out.innerHTML = '';
        const base = +S.from; const raw = S.v.trim().replace(/^0[xbo]/i, '').replace(/[\s_]/g, '');
        const neg = raw.startsWith('-'); const digits = neg ? raw.slice(1) : raw;
        const valid = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i }[base];
        if (!valid.test(digits)) { out.append(el('p', { class: 'desc', text: 'Enter a whole number in base ' + base + '.' })); return; }
        let n = 0n; for (const c of digits.toLowerCase()) n = n * BigInt(base) + BigInt(parseInt(c, 16));
        if (neg) n = -n;
        const group = (s, k) => s.replace(new RegExp('\\B(?=([0-9a-f]{' + k + '})+(?![0-9a-f]))', 'gi'), ' ');
        const abs = n < 0n ? -n : n, sg = n < 0n ? '−' : '';
        const rows = [['Decimal', sg + group(abs.toString(10), 3)], ['Hexadecimal', sg + '0x' + group(abs.toString(16).toUpperCase(), 4)], ['Binary', sg + '0b' + group(abs.toString(2), 4)], ['Octal', sg + '0o' + abs.toString(8)]];
        if (n < 0n) for (const bits of [8, 16, 32, 64]) if (-n <= 2n ** BigInt(bits - 1)) { rows.push([bits + '-bit two’s complement', '0x' + ((2n ** BigInt(bits) + n).toString(16).toUpperCase())]); break; }
        if (abs < 2n ** 53n) rows.push(['Bits needed', String(abs.toString(2).length)]);
        for (const [l, t] of rows) out.append(el('div', { class: 'cv-row' }, el('div', { class: 'cv-val' }, el('span', { class: 'mono', text: t, style: { fontSize: '17px', wordBreak: 'break-all' } }), el('span', { class: 'sub', text: l })), el('div', { class: 'cv-act' }, el('button', { class: 'chip', text: 'Copy', onclick: () => copy(t.replace(/\s/g, '')) }))));
        if (abs < 2n ** 53n) out.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Insert decimal value', onclick: () => insertValue(app, Number(n), this.sheet) })));
      };
      vI.addEventListener('input', calc); fSel.addEventListener('change', calc);
      b.append(el('div', { class: 'cv-units' }, lab('Number', vI), lab('Base', fSel)), out);
      calc();
    },

    /* ---------------- decibels ---------------- */
    db(b) {
      const app = this.app;
      this.dbs = this.dbs || { v: '3', u: 'dB' };
      const S = this.dbs;
      const vI = el('input', { class: 'search cv-in', value: S.v, inputmode: 'decimal' });
      const uSel = el('select', { class: 'search cv-in' }, [['dB', 'dB (power ratio)'], ['ratio', 'Power ratio'], ['aratio', 'Amplitude ratio'], ['dBm', 'dBm'], ['mW', 'mW'], ['W', 'W'], ['dB/km', 'Loss dB/km'], ['Np', 'Neper']].map(([v, t]) => el('option', { value: v, text: t, selected: v === S.u })));
      const out = el('div');
      const lab = (t, n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), n);
      const calc = () => {
        S.v = vI.value; S.u = uSel.value; out.innerHTML = '';
        const v = evalNum(S.v); if (!isFinite(v)) return;
        const rows = [];
        if (['dB', 'ratio', 'aratio', 'Np'].includes(S.u)) {
          const dB = S.u === 'dB' ? v : S.u === 'ratio' ? 10 * Math.log10(v) : S.u === 'aratio' ? 20 * Math.log10(v) : v * 20 / Math.LN10;
          const r = Math.pow(10, dB / 10);
          rows.push([dB, 'dB', 'decibels'], [r, '', 'power ratio'], [Math.sqrt(r), '', 'amplitude ratio'], [dB * Math.LN10 / 20, 'Np', 'nepers (amplitude)'], [(1 - 1 / r) * 100, '%', 'power lost if dB is attenuation'], [100 / r, '%', 'power transmitted if dB is attenuation']);
        } else if (S.u === 'dB/km') {
          const a = v * Math.LN10 / 10 / 1000;
          rows.push([a, '1/m', 'power attenuation coefficient α'], [a * 100, '1/cm', 'α'], [1 / a, 'm', '1/e power length 1/α'], [10 * Math.log10(2) / v, 'km', 'length for 3 dB (half power)']);
        } else {
          const mW = S.u === 'dBm' ? Math.pow(10, v / 10) : S.u === 'mW' ? v : v * 1e3;
          rows.push([10 * Math.log10(mW), 'dBm', ''], [10 * Math.log10(mW / 1e3), 'dBW', ''], [mW, 'mW', ''], [mW / 1e3, 'W', ''], [Math.sqrt(mW / 1e3 * 50), 'V', 'RMS voltage into 50 Ω']);
        }
        for (const [x, u, l] of rows) out.append(resultRow(app, x, u, l, { sheet: this.sheet }));
      };
      vI.addEventListener('input', calc); uSel.addEventListener('change', calc);
      b.append(fmtSeg(app, calc), el('div', { class: 'cv-units' }, lab('Value', vI), lab('Unit', uSel)), out);
      calc();
    },
  };

  /** The converter as a document page. */
  class ConverterPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'convert'; this.noKeypad = true;
      this.root = el('div', { class: 'page conv', style: { padding: '10px 12px', overflowY: 'auto' } });
      if (state.tab) Converter.tab = state.tab;
      Object.assign(Converter, state.units || {});
      if (state.ph) Converter.ph = state.ph;
      Converter.build(this.root, app, { sheet: false });
    }
    get target() { return null; }
    serialize() { return { tab: Converter.tab, units: { qty: Converter.qty, from: Converter.from, to: Converter.to, val: Converter.val }, ph: Converter.ph }; }
  }

  root.Converter = Converter; root.ConverterPage = ConverterPage; root.evalNum = evalNum;
})(typeof self !== 'undefined' ? self : this);
