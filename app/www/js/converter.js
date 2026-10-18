/*
 * converter.js — Conversion tool: units of any quantity (including compound units typed freely),
 * photon/spectroscopy equivalents with linewidths, number bases, and decibels.
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
      for (const [k, l] of [['units', 'Units'], ['photon', 'Light & photons'], ['base', 'Number base'], ['db', 'Decibels']]) {
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
      const q = el('input', { class: 'search', type: 'search', placeholder: 'Find a quantity or unit (e.g. psi, viscosity, kWh)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const chips = el('div', { class: 'chips' });
      const drawChips = () => {
        chips.innerHTML = ''; const s = q.value.trim().toLowerCase();
        for (const [name, , list] of Units.QUANTITIES) {
          if (s && !(name.toLowerCase().includes(s) || list.some((u) => u.toLowerCase() === s || (Units.lookup(u) || {}).name?.toLowerCase().includes(s)))) continue;
          const c = el('button', { class: 'chip' + (name === this.qty ? ' on' : ''), text: name });
          c.onclick = () => { this.qty = name; const L = Units.QUANTITIES.find((x) => x[0] === name)[2]; this.from = L[0]; this.to = L[1] || L[0]; fromI.value = this.from; toI.value = this.to; drawChips(); calc(); };
          chips.append(c);
        }
      };
      const valI = el('input', { class: 'search cv-in', value: this.val, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Value' });
      const fromI = el('input', { class: 'search cv-in', value: this.from, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'From unit' });
      const toI = el('input', { class: 'search cv-in', value: this.to, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'To unit' });
      const swap = el('button', { class: 'ib', 'aria-label': 'Swap units', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/></svg>', onclick: () => { [fromI.value, toI.value] = [toI.value, fromI.value]; calc(); } });
      const out = el('div'); const all = el('div');
      const lab = (t, n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), n);
      const unitHelp = el('p', { class: 'desc', text: 'Type any unit, including compound ones: W/(m·K), km/s/Mpc, MeV/c², kg m s^-2, ps/(nm·km). Prefixes from q to Q work on SI units.' });
      const calc = () => {
        this.val = valI.value; this.from = fromI.value.trim(); this.to = toI.value.trim();
        out.innerHTML = ''; all.innerHTML = '';
        const v = evalNum(valI.value);
        if (!isFinite(v)) { out.append(el('p', { class: 'desc', text: 'Enter a number, e.g. 1550, 2.5e-3 or 3/4.' })); return; }
        let pf;
        try { pf = Units.parse(this.from); } catch (e) { out.append(el('p', { class: 'desc err', text: e.message })); return; }
        try {
          const r = Units.convert(v, this.from, this.to);
          out.append(resultRow(app, r, this.to, '', { main: true, sheet: this.sheet }));
        } catch (e) { out.append(el('p', { class: 'desc err', text: e.message })); }
        const qn = Units.quantityOf(pf.d);
        const list = Units.alternatives(this.from, v).filter((u) => u !== this.from);
        all.append(el('h4', { class: 'cv-h', text: (qn ? qn[0] : Units.dimText(pf.d)) + ' — ' + F(v).text + ' ' + this.from + ' is' }));
        for (const u of list) { try { const r = Units.convert(v, this.from, u); all.append(resultRow(app, r, u, (Units.lookup(u) || {}).name || '', { sheet: this.sheet, onPick: () => { toI.value = u; calc(); } })); } catch (e) { /* skip */ } }
        const ph = Units.photonEquivalents(v, this.from);
        if (ph.length) { all.append(el('h4', { class: 'cv-h', text: 'As light (photon equivalents)' })); for (const p of ph) all.append(resultRow(app, p.value, p.unit, Units.SPEC_LABEL[p.kind], { sheet: this.sheet })); }
      };
      for (const i of [valI, fromI, toI]) i.addEventListener('input', calc);
      q.oninput = drawChips;
      b.append(q, chips, fmtSeg(app, calc), lab('Value', valI), el('div', { class: 'cv-units' }, lab('From', fromI), swap, lab('To', toI)), unitHelp, out, all);
      drawChips(); calc();
    },

    /* ---------------- light & photons ---------------- */
    photon(b) {
      const app = this.app;
      const kinds = [['nm', 'Wavelength'], ['µm', 'Wavelength'], ['THz', 'Frequency'], ['1/cm', 'Wavenumber'], ['eV', 'Photon energy'], ['rad/s', 'Angular frequency'], ['J', 'Energy']];
      this.ph = this.ph || { v: '1550', u: 'nm', n: '1', dv: '0.1', du: 'nm' };
      const S = this.ph;
      const vI = el('input', { class: 'search cv-in', value: S.v, inputmode: 'decimal' });
      const uSel = el('select', { class: 'search cv-in' }, kinds.map(([u, k]) => el('option', { value: u, text: k + ' (' + u + ')', selected: u === S.u })));
      const nI = el('input', { class: 'search cv-in', value: S.n, inputmode: 'decimal' });
      const dvI = el('input', { class: 'search cv-in', value: S.dv, inputmode: 'decimal' });
      const duSel = el('select', { class: 'search cv-in' }, ['nm', 'pm', 'µm', 'GHz', 'MHz', 'THz', '1/cm'].map((u) => el('option', { value: u, text: u, selected: u === S.du })));
      const out = el('div');
      const lab = (t, n) => el('label', { class: 'cv-lab' }, el('span', { text: t }), n);
      const calc = () => {
        Object.assign(S, { v: vI.value, u: uSel.value, n: nI.value, dv: dvI.value, du: duSel.value });
        out.innerHTML = '';
        const v = evalNum(S.v), n = evalNum(S.n) || 1;
        if (!(v > 0)) { out.append(el('p', { class: 'desc', text: 'Enter a positive value.' })); return; }
        const k = Units.specKind(S.u); const si = Units.convert(v, S.u, Units.SPEC_UNITS[k]);
        const Ej = Units.SPEC[k](si);
        const lam = H * C0 / Ej, nu = Ej / H;
        const rows = [
          [lam * 1e9, 'nm', 'vacuum wavelength λ₀'], [lam * 1e6, 'µm', 'vacuum wavelength λ₀'],
          [lam / n * 1e9, 'nm', 'wavelength in the medium λ₀/n (n = ' + n + ')'],
          [nu / 1e12, 'THz', 'frequency ν'], [2 * Math.PI * nu, 'rad/s', 'angular frequency ω'],
          [1 / lam / 100, '1/cm', 'wavenumber ν̃ = 1/λ₀'], [2 * Math.PI * n / lam, '1/m', 'propagation constant k = 2πn/λ₀'],
          [Ej / E, 'eV', 'photon energy hν'], [Ej, 'J', 'photon energy hν'], [Ej / KB, 'K', 'temperature equivalent hν/k'],
          [1 / nu * 1e15, 'fs', 'optical period 1/ν'], [1e-3 / Ej, '1/s', 'photons per second in 1 mW'],
          [E / Ej, 'A/W', 'ideal responsivity qλ/hc (η = 1)'],
        ];
        out.append(el('h4', { class: 'cv-h', text: 'Equivalents' }));
        for (const [x, u, l] of rows) out.append(resultRow(app, x, u, l, { sheet: this.sheet }));
        // linewidth / bandwidth
        const dv = evalNum(S.dv);
        if (dv > 0) {
          let dnu;
          if (/m$/.test(S.du)) dnu = C0 * Units.convert(dv, S.du, 'm') / (lam * lam);
          else if (S.du === '1/cm') dnu = C0 * dv * 100;
          else dnu = Units.convert(dv, S.du, 'Hz');
          const dlam = dnu * lam * lam / C0;
          out.append(el('h4', { class: 'cv-h', text: 'Linewidth / bandwidth at this wavelength' }));
          for (const [x, u, l] of [[dlam * 1e9, 'nm', 'Δλ = λ²Δν/c'], [dlam * 1e12, 'pm', 'Δλ'], [dnu / 1e9, 'GHz', 'Δν'], [dnu / C0 / 100, '1/cm', 'Δν̃'], [C0 / (n * dnu), 'm', 'coherence length c/(nΔν) (Lorentzian ≈ ÷π)'], [0.441 / dnu * 1e15, 'fs', 'transform-limited Gaussian pulse 0.441/Δν']]) out.append(resultRow(app, x, u, l, { sheet: this.sheet }));
        }
      };
      for (const i of [vI, uSel, nI, dvI, duSel]) { i.addEventListener('input', calc); i.addEventListener('change', calc); }
      b.append(fmtSeg(app, calc), el('div', { class: 'cv-units' }, lab('Value', vI), lab('Quantity', uSel)), el('div', { class: 'cv-units' }, lab('Refractive index n', nI), lab('Linewidth Δ', dvI), lab('in', duSel)), out);
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
      Converter.build(this.root, app, { sheet: false });
    }
    get target() { return null; }
    serialize() { return { tab: Converter.tab, units: { qty: Converter.qty, from: Converter.from, to: Converter.to, val: Converter.val } }; }
  }

  root.Converter = Converter; root.ConverterPage = ConverterPage; root.evalNum = evalNum;
})(typeof self !== 'undefined' ? self : this);
