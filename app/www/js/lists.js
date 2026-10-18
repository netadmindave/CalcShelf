/*
 * lists.js — Lists & Spreadsheet: named columns become list variables shared with the
 * Calculator and Graphs; cells hold numbers or =formulas (with a1-style references);
 * a column formula fills a whole column.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, mathField, Sheet } = UI;
  const COLS = 26, ROWS = 99;
  const L = (i) => String.fromCharCode(97 + i);

  class ListsPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'lists'; this.title = 'Lists & Spreadsheet';
      this.names = state.names || Array(COLS).fill('');
      this.colf = state.colf || Array(COLS).fill('');       // column formulas (tex)
      this.cells = state.cells || {};                       // 'a1' -> {tex, v, f}
      this.sel = { c: 0, r: 0, head: false, cf: false };
      this.root = el('div', { class: 'page lists' });
      this.grid = el('div', { style: { flex: '1', minHeight: '0', overflow: 'auto', position: 'relative', fontVariantNumeric: 'tabular-nums' } });
      this.where = el('span', { class: 'chip', style: { flex: 'none', minWidth: '52px', textAlign: 'center' } });
      this.mf = mathField();
      this.mf.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.enter(); } });
      this.root.append(this.grid, el('div', { class: 'entry' }, this.where, this.mf));
      this.render();
      this.selectCell(0, 0);
    }
    get target() { return this.mf; }
    focus() { this.mf.focus(); }
    serialize() { return { names: this.names, colf: this.colf, cells: this.cells }; }
    menu() {
      return [
        ['Data', [['Generate sequence', () => this.seqDialog()], ['Fill down', () => this.fillDown()], ['Sort ascending', () => this.sort(1)], ['Sort descending', () => this.sort(-1)], ['Clear column', () => this.clearCol(this.sel.c)], ['Clear all', () => this.clear()]]],
        ['Statistics', [['One-variable statistics', { dialog: 'onevar' }], ['Two-variable statistics', { dialog: 'twovar' }], ['Linear regression', { dialog: 'reg', reg: 'linear' }], ['Quadratic regression', { dialog: 'reg', reg: 'quad' }], ['Exponential regression', { dialog: 'reg', reg: 'exp' }], ['Power regression', { dialog: 'reg', reg: 'power' }]]],
        ['Insert', [['Row above', () => this.insertRow(this.sel.r)], ['Column left', () => this.insertCol(this.sel.c)]]],
        ['Delete', [['Row', () => this.deleteRow(this.sel.r)], ['Column', () => this.deleteCol(this.sel.c)]]],
        ['Name this column', () => this.selectHead(this.sel.c)],
        ['Plot these columns', () => this.plot()],
      ].map(([l, v]) => [l, Array.isArray(v) ? v.map(([a, b]) => [a, typeof b === 'function' ? b : b]) : v]);
    }
    colValues(c) { const out = []; for (let r = 1; r <= ROWS; r++) { const x = this.cells[L(c) + r]; if (!x || x.v == null || x.v === '') { if (out.length) break; else continue; } out.push(x.v); } return out; }
    lastRow(c) { let m = 0; for (let r = 1; r <= ROWS; r++) if (this.cells[L(c) + r] && this.cells[L(c) + r].tex) m = r; return m; }

    render() {
      const t = el('table', { style: { borderCollapse: 'collapse', fontSize: '15px', minWidth: '100%' } });
      const used = Math.max(5, ...Object.keys(this.cells).map((k) => k.charCodeAt(0) - 96), ...this.names.map((n, i) => (n ? i + 1 : 0)), this.sel.c + 2);
      const nc = Math.min(COLS, used + 1);
      const lastR = Math.max(12, ...Object.keys(this.cells).map((k) => +k.slice(1)), this.sel.r + 3);
      const th = (txt, cls) => el('th', { class: cls, style: { position: 'sticky', top: '0', background: 'var(--bar)', fontWeight: '600', fontSize: '13px', padding: '4px 6px', borderRight: '1px solid var(--line)', color: 'var(--ink2)', zIndex: 1 } }, txt);
      const hr = el('tr', {}, th(''));
      for (let c = 0; c < nc; c++) {
        const h = th(''); h.append(el('div', { text: L(c).toUpperCase(), style: { fontSize: '11px', color: 'var(--ink3)' } }), el('div', { text: this.names[c] || ' ', style: { color: 'var(--ink)', fontSize: '14px' } }));
        h.onclick = () => this.selectHead(c); h.style.minWidth = '96px'; hr.append(h);
      }
      t.append(hr);
      const fr = el('tr', {}, th('◆'));
      for (let c = 0; c < nc; c++) { const td = el('td', { style: { padding: '3px 6px', borderRight: '1px solid var(--line)', borderBottom: '2px solid var(--line)', background: 'var(--card)', fontSize: '13px', color: 'var(--ink2)', height: '30px' } }); if (this.colf[c]) renderTex(td, '=' + this.colf[c]); td.onclick = () => this.selectColFormula(c); fr.append(td); }
      t.append(fr);
      for (let r = 1; r <= lastR; r++) {
        const tr = el('tr', {}, el('th', { text: String(r), style: { background: 'var(--bar)', color: 'var(--ink3)', fontSize: '12px', padding: '0 6px', position: 'sticky', left: '0' } }));
        for (let c = 0; c < nc; c++) {
          const k = L(c) + r, x = this.cells[k];
          const td = el('td', { 'data-k': k, style: { padding: '4px 8px', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', textAlign: 'right', height: '34px', whiteSpace: 'nowrap', background: this.sel.c === c && this.sel.r === r && !this.sel.head && !this.sel.cf ? 'var(--sel)' : '' } });
          if (x && x.v != null && x.v !== '') renderTex(td, GiacFmt.giacToTex(String(x.v), { digits: this.app.settings.digits }) || String(x.v));
          if (x && x.err) { td.textContent = 'Error'; td.style.color = 'var(--err)'; }
          td.onclick = () => this.selectCell(c, r);
          tr.append(td);
        }
        t.append(tr);
      }
      const sl = this.grid.scrollLeft, st = this.grid.scrollTop;
      this.grid.innerHTML = ''; this.grid.append(t); this.grid.scrollLeft = sl; this.grid.scrollTop = st;
    }
    selectCell(c, r) { if (this.sel && this.sel.head) this.app.showKeyPage('num', true); this.sel = { c, r, head: false, cf: false }; const x = this.cells[L(c) + r]; this.where.textContent = L(c).toUpperCase() + r; this.mf.value = x ? x.tex : ''; this.render(); this.mf.focus(); }
    selectHead(c) { this.sel = { c, r: this.sel.r, head: true, cf: false }; this.where.textContent = L(c).toUpperCase() + ' name'; this.mf.value = this.names[c] ? '\\operatorname{' + this.names[c] + '}' : ''; this.mf.focus(); this.app.showKeyPage('abc', true); }
    selectColFormula(c) { this.sel = { c, r: this.sel.r, head: false, cf: true }; this.where.textContent = L(c).toUpperCase() + ' ='; this.mf.value = this.colf[c] || ''; this.mf.focus(); }

    async enter() {
      const tex = this.mf.value.trim(); const { c, r } = this.sel;
      if (this.sel.head) {
        const name = tex.replace(/\\operatorname\{([^}]*)\}/g, '$1').replace(/\\mathrm\{([^}]*)\}/g, '$1').replace(/[^A-Za-z0-9_]/g, '');
        if (name && !/^[A-Za-z]\w*$/.test(name)) { toast('Names start with a letter, like xs or time'); return; }
        if (name && /^[a-z]\d+$/.test(name)) { toast('That looks like a cell reference; pick another name'); return; }
        this.names[c] = name; await this.syncColumn(c); this.render(); this.selectCell(c, 1); this.app.saveSoon(); return;
      }
      if (this.sel.cf) { this.colf[c] = tex; await this.computeColFormula(c); this.render(); this.app.saveSoon(); return; }
      const k = L(c) + r;
      if (!tex) delete this.cells[k]; else this.cells[k] = { tex };
      await this.recalc();
      this.render(); this.app.saveSoon();
      this.selectCell(c, Math.min(ROWS, r + 1));
    }
    // a1 references → values
    async evalCellTex(tex) {
      let src = tex.replace(/^=/, '');
      const ctx = { degrees: this.app.settings.angle === 'deg', userFuncs: this.app.userFuncs, vars: this.app.vars };
      let code = Tex2Giac.tex2giac(src, ctx);
      code = code.replace(/\b([a-z])(\d{1,2})\b/g, (m, col, row) => { const x = this.cells[col + row]; return x && x.v != null && x.v !== '' ? '(' + x.v + ')' : '0'; });
      const out = await this.app.cas.eval(code);
      if (/GIAC_ERROR|Error/.test(out)) throw new Error(out);
      return out;
    }
    async recalc() {
      // two passes so formulas that depend on later formulas settle
      for (let pass = 0; pass < 2; pass++) {
        for (const [k, x] of Object.entries(this.cells)) {
          if (!x.tex || x.fromCol) continue;
          try { x.v = await this.evalCellTex(x.tex); x.err = null; } catch (e) { x.v = null; x.err = true; }
        }
      }
      for (let c = 0; c < COLS; c++) if (this.names[c]) await this.syncColumn(c);
    }
    async computeColFormula(c) {
      for (let r = 1; r <= ROWS; r++) { const x = this.cells[L(c) + r]; if (x && x.fromCol) delete this.cells[L(c) + r]; }
      if (!this.colf[c]) return;
      try {
        const out = await this.evalCellTex(this.colf[c]);
        const ast = GiacFmt.parse(out);
        const items = ast.t === 'vec' ? ast.items : [ast];
        const outs = await this.app.cas.batch(items.map((_, i) => '(' + out + ')[' + (i + 1) + ']'));
        outs.forEach((v, i) => { this.cells[L(c) + (i + 1)] = { tex: v, v, fromCol: true }; });
        await this.syncColumn(c);
      } catch (e) { toast('Column formula: ' + String(e.message).replace(/.*Error:\s*/s, '')); }
    }
    async syncColumn(c) {
      const name = this.names[c]; if (!name) return;
      const vals = this.colValues(c);
      const code = name + ':={' + vals.join(',') + '}';
      await this.app.cas.eval(code); this.app.cas.forget(name); this.app.cas.remember(code); this.app.vars.add(name);
    }
    seqDialog() {
      const c = this.sel.c;
      Sheet.open('Generate sequence in column ' + L(c).toUpperCase(), (b) => {
        const f = mathField({ value: 'n' }), a = el('input', { value: '1', inputmode: 'decimal' }), z = el('input', { value: '10', inputmode: 'decimal' }), st = el('input', { value: '1', inputmode: 'decimal' });
        b.append(el('label', { class: 'field' }, 'Formula in n', f), el('div', { style: { display: 'flex', gap: '8px' } }, el('label', { class: 'field' }, 'Start n', a), el('label', { class: 'field' }, 'End n', z), el('label', { class: 'field' }, 'Step', st)));
        b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Fill column', onclick: async () => {
          this.colf[c] = '\\operatorname{seq}\\left(' + f.value + ',n,' + a.value + ',' + z.value + ',' + st.value + '\\right)';
          Sheet.close(); await this.computeColFormula(c); this.render(); this.app.saveSoon();
        } })));
      });
    }
    fillDown() { const { c, r } = this.sel; const x = this.cells[L(c) + r]; if (!x) return; for (let k = r + 1; k <= this.lastRow(c === 0 ? 1 : 0) && k <= ROWS; k++) this.cells[L(c) + k] = { tex: x.tex.replace(/\b([a-z])(\d+)\b/g, (m, cl, rw) => cl + (Number(rw) + k - r)) }; this.recalc().then(() => this.render()); }
    async sort(dir) { const c = this.sel.c; const vals = this.colValues(c); const out = await this.app.cas.eval((dir > 0 ? 'sort' : 'tiSortD') + '({' + vals.join(',') + '})'); const ast = GiacFmt.parse(out); const parts = await this.app.cas.batch(ast.items.map((_, i) => '(' + out + ')[' + (i + 1) + ']')); parts.forEach((v, i) => { this.cells[L(c) + (i + 1)] = { tex: v, v }; }); await this.syncColumn(c); this.render(); this.app.saveSoon(); }
    clearCol(c) { for (let r = 1; r <= ROWS; r++) delete this.cells[L(c) + r]; this.colf[c] = ''; this.syncColumn(c); this.render(); this.app.saveSoon(); }
    clear() { this.cells = {}; this.colf = Array(COLS).fill(''); this.render(); this.app.saveSoon(); }
    shiftCells(fn) { const n = {}; for (const [k, v] of Object.entries(this.cells)) { const nk = fn(k.charCodeAt(0) - 97, +k.slice(1)); if (nk) n[nk] = v; } this.cells = n; }
    insertRow(r0) { this.shiftCells((c, r) => L(c) + (r >= r0 ? r + 1 : r)); this.recalc().then(() => this.render()); }
    deleteRow(r0) { this.shiftCells((c, r) => (r === r0 ? null : L(c) + (r > r0 ? r - 1 : r))); this.recalc().then(() => this.render()); }
    insertCol(c0) { this.shiftCells((c, r) => L(c >= c0 ? c + 1 : c) + r); this.names.splice(c0, 0, ''); this.names.length = COLS; this.colf.splice(c0, 0, ''); this.colf.length = COLS; this.render(); }
    deleteCol(c0) { this.shiftCells((c, r) => (c === c0 ? null : L(c > c0 ? c - 1 : c) + r)); this.names.splice(c0, 1); this.names.push(''); this.colf.splice(c0, 1); this.colf.push(''); this.render(); this.app.saveSoon(); }
    plot() {
      const named = this.names.map((n, i) => [n, i]).filter(([n]) => n);
      if (named.length < 2) { toast('Name two columns first (tap a column header)'); return; }
      let gi = this.app.pages.findIndex((p) => p.kind === 'graph');
      if (gi < 0) { this.app.addPage('graph'); gi = this.app.pages.length - 1; } else this.app.select(gi);
      const g = this.app.pages[gi];
      const f = { name: g.nextNameFor('scatter'), type: 'scatter', color: g.fns.length, on: true, tex: '\\operatorname{' + named[0][0] + '},\\operatorname{' + named[1][0] + '}' };
      g.fns.push(f); g.compile(f).then(() => { g.zoomFitScatter && g.zoomFitScatter(); g.draw(); });
    }
  }
  root.Lists = { ListsPage };
})(typeof self !== 'undefined' ? self : this);
