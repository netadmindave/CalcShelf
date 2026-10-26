/*
 * modules.js — CalcShelf modules: tabs built from a module file (JSON) that holds formulas, calculators,
 * tables, constants, reference text and links to the app's own tools. A module is data only: it has no code,
 * CalcShelf draws every screen, and the module's expressions run in the CAS (Giac, secure mode, in its worker)
 * after a check that they only compute. The format is described in docs/MODULES.md.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast, renderTex, Sheet, DB } = UI;

  const FORMAT = 'calcshelf-module', FORMAT_VERSION = 1;
  const REPO = 'https://github.com/netadmindave/CalcShelf/tree/main/modules';
  const LIMIT = { bytes: 4 * 1024 * 1024, sections: 60, items: 2000, rows: 10000, cols: 16, str: 40000, vars: 24, outputs: 24 };
  const TYPES = ['text', 'formula', 'calc', 'table', 'constants', 'tool', 'link'];

  /* ---------------------------------------------------------------- icons: modules pick one by name */
  const svg = (d) => '<svg class="ic" viewBox="0 0 24 24">' + d + '</svg>';
  const ICONS = {
    module: svg('<path d="M9 4h6v3a2 2 0 1 0 4 0V4h1v16H4V4h5z"/>'),
    optics: svg('<path d="M12 3c2.5 2.5 2.5 15.5 0 18-2.5-2.5-2.5-15.5 0-18z"/><path d="M2 12h20M2 8l6 4-6 4M22 8l-6 4 6 4"/>'),
    machinist: svg('<path d="M10 3h4v4l2 2v2H8V9l2-2z"/><path d="M11 11h2v4l-1 6-1-6z"/><path d="M7 21h10"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    electric: svg('<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>'),
    flask: svg('<path d="M9 3h6M10 3v6l-5 10a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.5 15h9"/>'),
    ruler: svg('<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
    book: svg('<path d="M5 4.5h5.5a2 2 0 0 1 2 2V20a1.6 1.6 0 0 0-1.6-1.6H5zM19 4.5h-5.5a2 2 0 0 0-1 .3"/><path d="M19 4.5v13.9h-5.9a1.6 1.6 0 0 0-1.6 1.6"/>'),
    wave: svg('<path d="M2 12c2.5-6 4.5-6 7 0s4.5 6 7 0 4.5-6 6 0"/>'),
  };

  /* ---------------------------------------------------------------- checking a module file */
  /** Giac words a module may not use: they change the CAS's state or settings, read or write files, prompt,
   *  loop, or build code from text. Everything else in Giac only computes. */
  const BLOCKED = new Set(('purge restart reset rm_all_vars assume additionally supposons about sto store read write fopen fclose fprint ' +
    'system cas_setup xcas_mode maple_mode python_compat angle_radian complex_mode approx_mode digits Digits DIGITS epsilon threads timeout ckevery ' +
    'set_language increasing_power all_trig_sol with_sqrt autosimplify local prog program function for while repeat until do od from step end ' +
    'goto label break continue return Input InputStr Prompt Request Pause Disp DispG ClrIO ClrGraph Exec Define DelVar Archive Unarchive Lock Unlock ' +
    'NewFold SetFold CopyVar MoveVar Rename Output PopUp Dialog Get Send GetCalc SendCalc SendChat Text Title unapply eval expr string parse ' +
    'export import insmod rmmod lsmod cd pwd ls load save archive unarchive printf print display widget_size xyztrange xyztrange_mode srand randseed RandSeed ' +
    'Store Unquote quote hold subsop ifte when switch case default try catch throw error').split(' '));
  /** an expression a module gives the CAS: characters of maths only, no assignment, no strings, no blocked words */
  function checkExpr(s, what, allowEq) {
    s = String(s == null ? '' : s);
    if (!s.trim()) throw new Error(what + ' is empty');
    if (s.length > 4000) throw new Error(what + ' is too long');
    if (!/^[A-Za-z0-9_\s.,+\-*/^()[\]=<>!|']*$/.test(s)) throw new Error(what + ' has a character modules can’t use: ' + (s.match(/[^A-Za-z0-9_\s.,+\-*/^()[\]=<>!|']/) || [''])[0]);
    if (/=>|:=|==/.test(s)) throw new Error(what + ' assigns or compares; modules only compute');
    if (!allowEq && /(^|[^<>!])=($|[^=])/.test(s)) throw new Error(what + ' has an =; only a formula’s equation may');
    const bad = (s.match(/[A-Za-z_]\w*/g) || []).find((w) => BLOCKED.has(w));
    if (bad) throw new Error(what + ' uses “' + bad + '”, which modules can’t use');
    let depth = 0; for (const c of s) { if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; if (depth < 0) break; }
    if (depth !== 0) throw new Error(what + ' has unbalanced brackets');
    return s;
  }
  const str = (v, max = 200) => (v == null ? '' : String(v)).slice(0, max);
  const https = (u) => { u = str(u, 600); return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; };
  const ident = (v, what) => { v = str(v, 24); if (!/^[A-Za-z][A-Za-z0-9]*$/.test(v)) throw new Error(what + ' “' + v + '” must be letters and digits, starting with a letter'); if (BLOCKED.has(v)) throw new Error(what + ' “' + v + '” is a reserved word'); return v; };
  const unitStr = (u) => str(u, 60);

  /** Checks a parsed module file and returns a clean copy that holds only the fields CalcShelf knows. Throws with a reason. */
  function validate(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('This isn’t a module file');
    if (m.format !== FORMAT) throw new Error('This isn’t a CalcShelf module (no "format": "' + FORMAT + '")');
    if (+m.formatVersion > FORMAT_VERSION) throw new Error('This module needs a newer CalcShelf (module format ' + m.formatVersion + ')');
    const id = str(m.id, 48); if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id)) throw new Error('The module id must be lower-case letters, digits and -');
    const out = {
      format: FORMAT, formatVersion: FORMAT_VERSION, id, name: str(m.name, 60) || id, tab: str(m.tab || m.name, 16) || id,
      version: str(m.version, 20) || '1', author: str(m.author, 100), description: str(m.description, 600), license: str(m.license, 60),
      homepage: https(m.homepage), icon: ICONS[m.icon] ? m.icon : 'module', sections: [],
    };
    if (!Array.isArray(m.sections) || !m.sections.length) throw new Error('A module needs at least one section');
    if (m.sections.length > LIMIT.sections) throw new Error('Too many sections (' + m.sections.length + ')');
    let nItems = 0;
    m.sections.forEach((s, si) => {
      if (!s || typeof s !== 'object') throw new Error('Section ' + (si + 1) + ' isn’t an object');
      const sec = { title: str(s.title, 40) || 'Section ' + (si + 1), items: [] };
      if (!Array.isArray(s.items)) throw new Error('Section “' + sec.title + '” has no items');
      s.items.forEach((it, ii) => {
        if (++nItems > LIMIT.items) throw new Error('Too many items');
        const where = '“' + sec.title + '” item ' + (ii + 1);
        try { sec.items.push(item(it)); } catch (e) { throw new Error(where + ': ' + e.message); }
      });
      out.sections.push(sec);
    });
    return out;
  }
  function item(it) {
    if (!it || typeof it !== 'object' || !TYPES.includes(it.type)) throw new Error('unknown item type “' + str(it && it.type, 20) + '”');
    const o = { type: it.type, title: str(it.title, 120), note: str(it.note, 2000), tags: str(it.tags, 300) };
    if (it.tex != null) o.tex = str(it.tex, 2000);
    switch (it.type) {
      case 'text': o.md = str(it.md, LIMIT.str); break;
      case 'link': o.url = https(it.url); if (!o.url) throw new Error('a link needs an https:// address'); break;
      case 'tool': o.tool = str(it.tool, 40); if (!TOOLS[o.tool]) throw new Error('there is no built-in tool “' + o.tool + '”'); if (!o.title) o.title = TOOLS[o.tool].title; break;
      case 'formula': {
        if (!o.title) throw new Error('a formula needs a title');
        o.eq = checkExpr(it.eq, 'The equation', true);
        if ((o.eq.match(/(^|[^<>!])=($|[^=])/g) || []).length !== 1) throw new Error('the equation needs exactly one =');
        const vars = Array.isArray(it.vars) ? it.vars : [];
        if (!vars.length || vars.length > LIMIT.vars) throw new Error('a formula needs 1 to ' + LIMIT.vars + ' variables');
        o.vars = vars.map((v) => { const a = Array.isArray(v) ? { name: v[0], desc: v[1], unit: v[2], default: v[3] } : v || {}; return [ident(a.name, 'Variable'), str(a.desc, 120) || a.name, unitStr(a.unit), a.default == null || a.default === '' ? '' : checkExpr(String(a.default), 'A default value')]; });
        const names = new Set(o.vars.map((v) => v[0]));
        for (const w of o.eq.match(/[A-Za-z_]\w*/g) || []) if (/^[a-z]$/i.test(w) && !names.has(w) && !['e', 'i'].includes(w)) throw new Error('the equation uses ' + w + ', which isn’t one of its variables');
        if (!o.tex) o.tex = o.eq;
        break;
      }
      case 'calc': {
        if (!o.title) throw new Error('a calculator needs a title');
        o.angles = it.angles === 'deg' ? 'deg' : 'rad';
        const ins = Array.isArray(it.inputs) ? it.inputs : [], outs = Array.isArray(it.outputs) ? it.outputs : [];
        if (ins.length > LIMIT.vars || !outs.length || outs.length > LIMIT.outputs) throw new Error('a calculator needs up to ' + LIMIT.vars + ' inputs and 1 to ' + LIMIT.outputs + ' outputs');
        const ids = new Set();
        o.inputs = ins.map((x) => {
          const r = { id: ident(x.id, 'Input id'), label: str(x.label, 120) || x.id, unit: unitStr(x.unit), units: Array.isArray(x.units) ? x.units.slice(0, 40).map(unitStr) : null };
          if (ids.has(r.id)) throw new Error('two inputs are called ' + r.id); ids.add(r.id);
          if (Array.isArray(x.options)) {
            if (!x.options.length || x.options.length > 300) throw new Error('input ' + r.id + ' needs 1 to 300 options');
            r.options = x.options.map((op) => { const a = Array.isArray(op) ? { label: op[0], value: op[1] } : op || {}; return { label: str(a.label, 120) || String(a.value), value: checkExpr(a.value, 'An option value') }; });
            r.default = Math.max(0, Math.min(r.options.length - 1, Number.isInteger(x.default) ? x.default : 0));
          } else r.default = x.default == null || x.default === '' ? '' : checkExpr(String(x.default), 'Input ' + r.id + '’s default');
          return r;
        });
        o.outputs = outs.map((x, k) => {
          const r = { id: x.id ? ident(x.id, 'Output id') : '', label: str(x.label, 120) || 'Result ' + (k + 1), expr: checkExpr(x.expr, 'Output “' + (x.label || k + 1) + '”'), unit: unitStr(x.unit), units: Array.isArray(x.units) ? x.units.slice(0, 40).map(unitStr) : null, digits: +x.digits ? Math.max(2, Math.min(15, Math.round(+x.digits))) : 0, format: ['number', 'exact', 'list'].includes(x.format) ? x.format : 'number' };
          if (r.id) { if (ids.has(r.id)) throw new Error('the name ' + r.id + ' is used twice'); ids.add(r.id); }
          return r;
        });
        if (it.plot) {
          const p = it.plot;
          o.plot = { expr: checkExpr(p.expr, 'The plot'), x: ident(p.x || 'x', 'The plot variable'), from: checkExpr(p.from, 'The plot start'), to: checkExpr(p.to, 'The plot end'), points: Math.max(20, Math.min(600, +p.points || 200)), xlabel: str(p.xlabel, 40), ylabel: str(p.ylabel, 40) };
          if (ids.has(o.plot.x)) throw new Error('the plot variable ' + o.plot.x + ' is also an input or output');
        }
        break;
      }
      case 'table': {
        if (!o.title) throw new Error('a table needs a title');
        const cols = Array.isArray(it.columns) ? it.columns : [];
        if (!cols.length || cols.length > LIMIT.cols) throw new Error('a table needs 1 to ' + LIMIT.cols + ' columns');
        o.columns = cols.map((c) => str(c, 60));
        const rows = Array.isArray(it.rows) ? it.rows : [];
        if (rows.length > LIMIT.rows) throw new Error('a table can have up to ' + LIMIT.rows + ' rows');
        o.rows = rows.map((r) => (Array.isArray(r) ? r : []).slice(0, o.columns.length).map((c) => str(c, 400)));
        o.near = (Array.isArray(it.near) ? it.near : []).slice(0, 4).map((n) => ({ col: Math.max(0, Math.min(o.columns.length - 1, +n.col || 0)), label: str(n.label, 20) || o.columns[+n.col || 0] }));
        break;
      }
      case 'constants': {
        if (!o.title) throw new Error('a constants list needs a title');
        const its = Array.isArray(it.items) ? it.items : [];
        if (!its.length || its.length > 2000) throw new Error('a constants list needs 1 to 2000 entries');
        o.items = its.map((c) => {
          const r = { n: str(c.name, 120), s: str(c.symbol, 200) || '?', v: str(c.value, 200), u: unitStr(c.unit), note: str(c.note, 600) };
          if (Array.isArray(c.sellmeier)) { if (c.sellmeier.length < 2 || c.sellmeier.length > 12 || c.sellmeier.length % 2 || !c.sellmeier.every((x) => isFinite(+x))) throw new Error('Sellmeier data is pairs B₁ C₁ B₂ C₂ …, up to 6 terms'); r.sell = c.sellmeier.map(Number); }
          else if (!/^\s*(\[[-+0-9.eE, ]+\]|[-+]?[0-9.]+([eE][-+]?\d+)?)\s*$/.test(r.v)) throw new Error('constant “' + r.n + '” needs a number as its value');
          return r;
        });
        break;
      }
    }
    return o;
  }

  /* ---------------------------------------------------------------- built-in tools a module can show */
  const TOOLS = {
    'optics.linewidth': { title: 'Δν ↔ Δλ and photon equivalents', run: (b, app) => { Converter.app = app; Converter.linewidth(b); } },
    'optics.beam': { title: 'Gaussian beam through lenses and space (ABCD)', run: (b, app) => OpticsTools.beam(b, app) },
    'optics.dispersion': { title: 'Material dispersion (Sellmeier)', run: (b, app) => OpticsTools.dispersion(b, app) },
    'optics.etalon': { title: 'Fabry–Pérot etalon', run: (b, app) => OpticsTools.etalon(b, app) },
    'optics.thinfilm': { title: 'Thin-film stack (transfer matrices)', run: (b, app) => OpticsTools.film(b, app) },
    'trig.triangle': { title: 'Triangle solver', run: (b, app) => { Trig.sub = 'solve'; Trig.build(b, app); } },
    'convert.units': { title: 'Unit conversion', run: (b, app) => { Converter.tab = 'units'; Converter.build(b, app, { sheet: true }); } },
  };

  /* ---------------------------------------------------------------- the installed modules */
  const Modules = {
    list: [],            // { m, source: 'built-in' | 'imported', file }
    ready: null,
    get(id) { const x = this.list.find((y) => y.m.id === id); return x ? x.m : null; },
    entry(id) { return this.list.find((y) => y.m.id === id) || null; },
    load() {
      if (!this.ready) this.ready = (async () => {
        const out = [];
        try {
          const idx = await (await fetch('modules/index.json')).json();
          for (const f of idx.modules || []) {
            try { const raw = await (await fetch('modules/' + String(f).replace(/[^\w.-]/g, ''))).json(); out.push({ m: validate(raw), raw, source: 'built-in', file: f }); }
            catch (e) { console.warn('module', f, e.message); }
          }
        } catch (e) { console.warn('modules', e.message); }
        // a module you imported with the same id replaces the built-in one
        for (const raw of (await DB.get('modules')) || []) {
          try { const m = validate(raw); const i = out.findIndex((x) => x.m.id === m.id); const e = { m, raw, source: 'imported' }; if (i >= 0) out[i] = e; else out.push(e); }
          catch (e) { console.warn('imported module', e.message); }
        }
        this.list = out;
      })();
      return this.ready;
    },
    /** imported modules are kept as their original file, and checked again each time CalcShelf starts */
    async saveImported() { await DB.set('modules', this.list.filter((x) => x.source === 'imported').map((x) => x.raw)); },
    async reload() { this.ready = null; await this.load(); },

    /* ---------------- import from a file (the phone's browser downloads it from a module repository) */
    importFile(app) {
      let f = document.getElementById('file-module');
      if (!f) { f = el('input', { type: 'file', id: 'file-module', accept: '.json,application/json,text/plain', hidden: true }); document.body.append(f); }
      f.value = '';
      f.onchange = async () => {
        const file = f.files[0]; f.value = ''; if (!file) return;
        if (file.size > LIMIT.bytes) { toast('That file is too large for a module (over 4 MB)', 5000); return; }
        let m, raw;
        try { raw = JSON.parse(await file.text()); m = validate(raw); }
        catch (e) { Sheet.open('Not a module', (b) => b.append(el('p', { class: 'desc', text: (e instanceof SyntaxError ? 'The file isn’t valid JSON: ' : '') + e.message }))); return; }
        this.preview(app, m, raw);
      };
      f.click();
    },
    /** what the module holds, before it is installed */
    preview(app, m, raw) {
      const cur = this.entry(m.id);
      Sheet.open('Install module', (b) => {
        const head = el('div', { class: 'card md-head' }, el('span', { class: 'md-ic', html: ICONS[m.icon] }), el('div', {}, el('div', { class: 'lbl', text: m.name, style: { fontWeight: '700', fontSize: '17px' } }), el('div', { class: 'sub', text: 'Version ' + m.version + (m.author ? ' · ' + m.author : '') })));
        b.append(head);
        if (m.description) b.append(el('p', { class: 'desc', text: m.description }));
        const n = {}; for (const s of m.sections) for (const it of s.items) n[it.type] = (n[it.type] || 0) + 1;
        const names = { formula: 'formulas', calc: 'calculators', table: 'tables', constants: 'constant lists', text: 'reference pages', tool: 'built-in tools', link: 'links' };
        b.append(el('p', { class: 'desc', text: m.sections.length + ' sections: ' + Object.entries(n).map(([k, v]) => v + ' ' + names[k]).join(', ') + '.' }));
        if (cur) b.append(el('p', { class: 'desc', text: 'This replaces the ' + (cur.source === 'built-in' ? 'built-in' : 'installed') + ' “' + cur.m.name + '” (version ' + cur.m.version + ')' + (cur.source === 'built-in' ? '; removing it later brings the built-in one back.' : '.') }));
        b.append(el('p', { class: 'desc', text: 'Modules are data only: CalcShelf checks the file and draws every screen itself. A module can’t run code, read your documents or reach the internet. Its formulas are checked before the CAS computes them. Its results are only as good as its author’s data, so install modules from people you trust.' }));
        b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: cur ? 'Replace' : 'Install', onclick: async () => {
          const i = this.list.findIndex((x) => x.m.id === m.id); const e = { m, raw, source: 'imported' };
          if (i >= 0) this.list[i] = e; else this.list.push(e);
          await this.saveImported(); Sheet.close(); toast('Installed ' + m.name);
          app.refreshModulePages(m.id); app.addPage('module', { id: m.id });
        } }), el('button', { class: 'btn', text: 'Cancel', onclick: () => Sheet.close() })));
      });
    },
    async remove(app, id) {
      const i = this.list.findIndex((x) => x.m.id === id && x.source === 'imported'); if (i < 0) return;
      const name = this.list[i].m.name; this.list.splice(i, 1); await this.saveImported(); await this.reload();
      app.refreshModulePages(id); toast('Removed ' + name + (this.get(id) ? '; the built-in version is back' : ''));
    },
    repoUrl(app) { return https(app.settings.moduleRepo) || REPO; },
    /** Modules → manage: installed modules, import, the repository */
    manage(app) {
      Sheet.open('Modules', (b) => {
        b.append(el('p', { class: 'desc', text: 'A module adds a tab of formulas, calculators, tables and reference for one subject. To add one, open a module repository in your browser, download the module’s .json file, then import it here.' }));
        const L = el('ul', { class: 'mlist' }); b.append(L);
        for (const x of this.list) {
          const m = x.m;
          const acts = el('span', { class: 'cv-act' },
            el('button', { class: 'chip', text: 'Open', onclick: () => { Sheet.close(); app.addPage('module', { id: m.id }); } }),
            el('button', { class: 'chip', text: 'Save file', onclick: () => UI.download(m.id + '.json', JSON.stringify(x.raw, null, 1)) }),
            x.source === 'imported' ? el('button', { class: 'chip', text: 'Remove', onclick: async () => { await this.remove(app, m.id); Sheet.render(); } }) : null);
          L.append(el('li', {}, el('div', { class: 'mi', style: { cursor: 'default', flexWrap: 'wrap' } },
            el('span', { class: 'md-ic', html: ICONS[m.icon] }),
            el('span', { style: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: '50%' } }, el('span', { class: 'lbl', text: m.name }), el('span', { class: 'sub', text: 'Version ' + m.version + ' · ' + (x.source === 'built-in' ? 'built in' : 'imported') + (m.author ? ' · ' + m.author : '') })),
            acts)));
        }
        if (!this.list.length) L.append(el('li', { class: 'desc', text: 'No modules installed.' }));
        const repo = this.repoUrl(app);
        b.append(el('div', { class: 'btnrow' },
          el('button', { class: 'btn pri', text: 'Import a module file…', onclick: () => { Sheet.close(); this.importFile(app); } }),
          el('button', { class: 'btn', text: 'Browse modules ↗', title: repo, onclick: () => Guide.openLink(repo) })));
        b.append(el('h4', { class: 'cv-h', text: 'Module repository' }));
        const inp = el('input', { class: 'search', value: repo, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'url', 'aria-label': 'Module repository address' });
        const msg = el('p', { class: 'desc', text: 'The page “Browse modules” opens in your browser. Any https:// address works, such as a folder in your own GitHub repository.' });
        inp.onchange = () => { const v = inp.value.trim(); if (!v || v === REPO) { delete app.settings.moduleRepo; } else if (https(v)) app.settings.moduleRepo = v; else { msg.textContent = 'Use an https:// address.'; msg.classList.add('err'); return; } msg.classList.remove('err'); msg.textContent = 'Saved.'; app.saveSettings(); };
        b.append(inp, msg, el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: 'Use the CalcShelf repository', onclick: () => { inp.value = REPO; inp.onchange(); } }), el('button', { class: 'btn', text: 'How to make a module ↗', onclick: () => Guide.openLink('https://github.com/netadmindave/CalcShelf/blob/main/docs/MODULES.md') })));
      });
    },
  };

  /* ---------------------------------------------------------------- units in calculators */
  const ANGLE = new Set(['rad', '°', 'mrad', 'µrad', "'", '"', 'gon', 'rev', 'turn']);
  /** the units offered for a calculator value: the module lists them; without a list the unit is just shown */
  function unitOptions(unit, extra) {
    if (!unit || !extra || !extra.length) return null;
    const list = extra.slice();
    if (!list.includes(unit)) list.unshift(unit);
    return list.filter((u) => { try { Units.convert(1, u, unit); return true; } catch (e) { return false; } });
  }
  /** Giac code for a value typed in unit c, in unit u (angles go to the calculator's own angle mode) */
  function toUnit(code, u, c, mode) {
    if (!u || !c || c === u) { if (u && ANGLE.has(u)) c = c || u; else return code; }
    if (ANGLE.has(u)) { const t = mode === 'deg' ? '°' : 'rad'; if (c === t) return code; return '(' + code + ')*' + Units.num(Units.convert(1, c, t), 15); }
    const b0 = Units.convert(0, c, u), a = Units.convert(1, c, u) - b0;
    return '((' + code + ')*' + Units.num(a, 15) + (b0 ? '+' + Units.num(b0, 15) : '') + ')';
  }
  function fromUnit(x, u, c, mode) {
    if (!u) return x;
    if (ANGLE.has(u)) { const t = mode === 'deg' ? '°' : 'rad'; return Units.convert(x, t, c || u); }
    return !c || c === u ? x : Units.convert(x, u, c);
  }
  /** a user's typed value as Giac code (they may type 1/4, 3e-3, pi/8, 1,5) */
  function userCode(raw) {
    raw = String(raw).trim().replace(/×10\^?/g, 'e').replace(/π/g, 'pi').replace(/−/g, '-').replace(/(\d),(\d)/g, '$1.$2');
    if (!raw) return null;
    checkExpr(raw, 'A value');
    return '(' + raw + ')';
  }
  /** the CAS, with the calculator's angle mode for this batch only, and a time limit */
  async function casRun(app, codes, mode) {
    const cur = app.settings.angle === 'deg' ? 0 : 1, want = mode === 'deg' ? 0 : 1;
    const all = want === cur ? codes : ['angle_radian:=' + want, ...codes, 'angle_radian:=' + cur];
    let timer;
    const limit = new Promise((res, rej) => { timer = setTimeout(() => rej(new Error('This took more than 10 s, so it was stopped')), 10000); });
    try {
      const r = await Promise.race([app.cas.batch(all), limit]);
      return want === cur ? r : r.slice(1, -1);
    } catch (e) {
      if (/10 s/.test(e.message)) { try { await app.cas.breakAndRestart(); } catch (x) { /* restarted anyway */ } }
      throw e;
    } finally { clearTimeout(timer); }
  }
  const isErr = (r) => !r || /GIAC_ERROR|Error|undef|^\?/.test(r);
  const sub = (expr, vals) => expr.replace(/\b[A-Za-z_]\w*\b/g, (w) => (Object.prototype.hasOwnProperty.call(vals, w) ? vals[w] : w));

  /* ---------------------------------------------------------------- drawing items */
  const R = {
    calc(b, it, app) {
      if (it.tex) { const t = el('div', { class: 'card', style: { fontSize: '19px', overflowX: 'auto' } }); renderTex(t, it.tex); b.append(t); }
      if (it.note) b.append(el('p', { class: 'desc', text: it.note }));
      const fields = {};
      for (const x of it.inputs) {
        let inp;
        if (x.options) inp = el('select', { class: 'search cv-in md-in', 'aria-label': x.label }, x.options.map((o, k) => el('option', { value: String(k), text: o.label, selected: k === x.default })));
        else inp = el('input', { class: 'search cv-in md-in', value: x.default, inputmode: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': x.label });
        const us = !x.options && unitOptions(x.unit, x.units);
        const sel = us && us.length > 1 ? el('select', { class: 'fs-unit', 'aria-label': 'Unit of ' + x.label }, us.map((u) => el('option', { value: u, text: u, selected: u === x.unit }))) : null;
        fields[x.id] = { inp, sel };
        b.append(el('label', { class: 'cv-lab md-row' }, el('span', { text: x.label + (!sel && x.unit ? ' (' + x.unit + ')' : '') }), el('div', { class: 'md-pair' }, inp, sel)));
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      }
      const res = el('div', { class: 'card md-res', hidden: true });
      const outSel = {};
      const plotBox = el('div');
      let plot = null;
      const go = async () => {
        const vals = {};
        try {
          for (const x of it.inputs) {
            const f = fields[x.id];
            if (x.options) { vals[x.id] = '(' + x.options[+f.inp.value].value + ')'; continue; }
            // a unit typed after the value ("3/8 in", '1-1/2"') is used instead of the menu's
            const tv = root.splitValueUnit ? root.splitValueUnit(f.inp.value) : { text: f.inp.value, unit: null };
            const c = userCode(tv.text); if (c == null) { toast('Enter ' + x.label); f.inp.focus(); return; }
            if (tv.unit) { if (!x.unit) throw new Error(x.label + ' has no unit; type just the number'); Units.convert(1, tv.unit, ANGLE.has(x.unit) ? 'rad' : x.unit); }
            vals[x.id] = toUnit(c, x.unit, tv.unit || (f.sel ? f.sel.value : x.unit), it.angles);
          }
        } catch (e) { toast(e.message); return; }
        const codes = [];
        for (const o of it.outputs) { const e = sub(o.expr, vals); if (o.id) vals[o.id] = '(' + e + ')'; codes.push(o.format === 'exact' ? 'simplify(' + e + ')' : o.format === 'list' ? 'evalf(' + e + ')' : 'evalf(' + e + ')'); }
        res.hidden = false; res.textContent = 'Working…';
        let r; try { r = await casRun(app, codes, it.angles); } catch (e) { res.textContent = e.message; return; }
        res.innerHTML = '';
        it.outputs.forEach((o, k) => {
          const raw = r[k];
          const row = el('div', { class: 'md-out' });
          row.append(el('span', { class: 'md-ol', text: o.label }));
          const val = el('span', { class: 'md-ov' }); row.append(val);
          if (isErr(raw)) { val.textContent = 'can’t be computed with these values'; val.classList.add('err'); res.append(row); return; }
          const show = () => {
            val.innerHTML = '';
            const n = Number(raw), d = o.digits || Math.max(app.settings.digits, 6);
            const m = el('span');
            if (o.format === 'number' && isFinite(n)) {
              const c = outSel[k] ? outSel[k].value : o.unit;
              let x = n; try { x = fromUnit(n, o.unit, c, it.angles); } catch (e) { /* keep */ }
              renderTex(m, GiacFmt.giacToTex(String(+x.toPrecision(d)), { digits: d }) || String(x)); val.append(m);
              val.dataset.copy = String(+x.toPrecision(d)) + (c ? ' ' + c : '');
            } else {
              renderTex(m, GiacFmt.giacToTex(raw, { digits: d }) || raw); val.append(m);
              val.dataset.copy = raw + (o.unit ? ' ' + o.unit : '');
              if (o.format === 'exact' && !isFinite(n)) { const dec = GiacFmt.compile ? (() => { try { return GiacFmt.compile(GiacFmt.parse(raw), [])(); } catch (e) { return NaN; } })() : NaN; if (typeof dec === 'number' && isFinite(dec)) { const s = el('span', { class: 'sub' }); renderTex(s, '\\approx ' + GiacFmt.giacToTex(String(+dec.toPrecision(d)))); val.append(' ', s); } }
            }
          };
          if (o.format === 'number' && isFinite(Number(raw))) {
            const us = unitOptions(o.unit, o.units);
            if (us && us.length > 1) { if (!outSel[k]) { outSel[k] = el('select', { class: 'fs-unit', 'aria-label': 'Unit of ' + o.label }, us.map((u) => el('option', { value: u, text: u, selected: u === o.unit }))); } outSel[k].onchange = show; row.append(outSel[k]); }
            else if (o.unit) row.append(el('span', { class: 'sub', text: o.unit }));
          } else if (o.unit && o.format !== 'list') row.append(el('span', { class: 'sub', text: o.unit }));
          row.append(el('button', { class: 'chip', text: 'Copy', onclick: () => { const t = val.dataset.copy || ''; try { navigator.clipboard.writeText(t); toast('Copied ' + t); } catch (e) { toast(t); } } }));
          show(); res.append(row);
        });
        if (it.plot) {
          const p = it.plot, n = p.points;
          const from = sub(p.from, vals), to = sub(p.to, vals), e = sub(p.expr, vals);
          const xs = 'seq((' + from + ')+((' + to + ')-(' + from + '))*' + p.x + '/' + n + ',' + p.x + ',0,' + n + ')';
          const ys = 'seq(subst(' + e + ',' + p.x + ',(' + from + ')+((' + to + ')-(' + from + '))*zk/' + n + '),zk,0,' + n + ')';
          let pr; try { pr = await casRun(app, ['evalf(' + xs + ')', 'evalf(' + ys + ')'], it.angles); } catch (er) { plotBox.textContent = er.message; return; }
          const nums = (t) => String(t).replace(/^[[{]|[\]}]$/g, '').split(',').map(Number);
          const X = nums(pr[0]), Y = nums(pr[1]);
          if (X.length > 1 && X.length === Y.length) {
            if (!plot) { plot = new Plot({ height: 220, xlabel: p.xlabel, ylabel: p.ylabel }); plotBox.append(plot.el); }
            plot.set([{ xs: X, ys: Y, mode: 'line', color: 'var(--acc)', width: 2 }]);
          }
        }
      };
      b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Calculate', onclick: go })), res, plotBox);
      if (it.inputs.every((x) => x.options || x.default !== '')) setTimeout(go, 0);
    },
    table(b, it) {
      if (it.note) b.append(el('p', { class: 'desc', text: it.note }));
      const q = el('input', { class: 'search', type: 'search', placeholder: it.near.length ? 'Search, or type a size to find the nearest' : 'Search this table', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      let nearCol = it.near.length ? it.near[0].col : -1;
      const seg = it.near.length > 1 ? el('div', { class: 'chips' }, it.near.map((n, k) => { const c = el('button', { class: 'chip' + (k ? '' : ' on'), text: 'Nearest in ' + n.label }); c.onclick = () => { nearCol = n.col; seg.querySelectorAll('.chip').forEach((y) => y.classList.toggle('on', y === c)); draw(); }; return c; })) : null;
      const wrap = el('div', { class: 'gd-tbl md-tbl' });
      const info = el('p', { class: 'desc' });
      const numOf = (s) => { const m = String(s).replace(/,/g, '').match(/-?\d*\.?\d+(e-?\d+)?/i); return m ? Number(m[0]) : NaN; };
      const draw = () => {
        const s = q.value.trim().toLowerCase(), x = Number(s.replace(/,/g, '.').replace(/^\./, '0.'));
        let rows = it.rows;
        if (s && nearCol >= 0 && /^[\d.,]+$/.test(s) && isFinite(x)) {
          rows = rows.map((r) => [r, Math.abs(numOf(r[nearCol]) - x)]).filter((p) => isFinite(p[1])).sort((p1, p2) => p1[1] - p2[1]).slice(0, 12).map((p) => p[0]);
          info.textContent = 'The ' + rows.length + ' nearest to ' + s + ' ' + (it.near.find((n) => n.col === nearCol) || {}).label + ', closest first.';
        } else if (s) { rows = rows.filter((r) => r.join(' ').toLowerCase().includes(s)); info.textContent = rows.length + ' of ' + it.rows.length + ' rows'; }
        else info.textContent = it.rows.length + ' rows';
        const shown = rows.slice(0, 600);
        const t = el('table', {}, el('thead', {}, el('tr', {}, it.columns.map((c) => el('th', { text: c })))), el('tbody', {}, shown.map((r) => el('tr', {}, it.columns.map((c, k) => el('td', { text: r[k] || '' }))))));
        wrap.innerHTML = ''; wrap.append(t);
        if (rows.length > shown.length) info.textContent += ' (first 600 shown; search to narrow)';
      };
      q.oninput = draw;
      b.append(q); if (seg) b.append(seg); b.append(info, wrap); draw();
    },
    text(b, it) { b.append(el('article', { class: 'gd-doc md-doc', html: Guide.markdown(it.md || '', { untrusted: true }) })); },
    formula(b, it, app) {
      Library.app = app;
      Library.solver(b, { n: it.title, tex: it.tex, eq: it.eq, v: it.vars, note: it.note }, { insert: false });
    },
    constants(b, it, app) {
      Library.app = app;
      if (it.note) b.append(el('p', { class: 'desc', text: it.note }));
      const q = el('input', { class: 'search', type: 'search', placeholder: 'Search', autocomplete: 'off', spellcheck: 'false' });
      const L = el('ul', { class: 'mlist' });
      const draw = () => { const s = q.value.trim().toLowerCase(); L.innerHTML = ''; for (const c of it.items) if (!s || (c.n + ' ' + c.note + ' ' + c.u).toLowerCase().includes(s)) L.append(Library.constRow(c)); };
      q.oninput = draw; if (it.items.length > 8) b.append(q); b.append(L); draw();
    },
    tool(b, it, app) { if (it.note) b.append(el('p', { class: 'desc', text: it.note })); TOOLS[it.tool].run(b, app); },
    link(b, it) {
      if (it.note) b.append(el('p', { class: 'desc', text: it.note }));
      b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Open in the browser ↗', onclick: () => Guide.openLink(it.url) })), el('p', { class: 'desc mono', text: it.url }));
    },
  };
  const KIND = { formula: 'Formula', calc: 'Calculator', table: 'Table', constants: 'Constants', tool: 'Tool', link: 'Link ↗', text: 'Reference' };

  /* ---------------------------------------------------------------- the module tab */
  class ModulePage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'module'; this.noKeypad = true;
      this.id = String(state.id || ''); this.sec = state.sec === 'all' ? 'all' : state.sec | 0; this.allSort = state.sort === 'az' ? 'az' : 'sec'; this.q = '';
      this.root = el('div', { class: 'page guide modpage' });
      this.secs = el('div', { class: 'chips md-secs', role: 'tablist' });
      this.search = el('input', { class: 'search md-search', type: 'search', placeholder: 'Search this module', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      this.search.oninput = () => { this.q = this.search.value; this.drawList(); };
      this.body = el('div', { class: 'gd-body' });
      this.body.addEventListener('click', (e) => { const a = e.target.closest('a[data-link]'); if (!a) return; e.preventDefault(); const u = a.getAttribute('data-link'); if (/^https:\/\//.test(u)) Guide.openLink(u); else if (u[0] === '#') { const t = this.body.querySelector('[id="' + u.slice(1) + '"]'); if (t) t.scrollIntoView({ block: 'start' }); } });
      this.root.append(el('div', { class: 'md-top' }, this.secs, this.search), this.body);
      this.m = null;
      Modules.load().then(() => this.render());
    }
    get target() { return null; }
    get defaultName() { const m = this.m || Modules.get(this.id); return m ? m.tab : 'Module'; }
    get icon() { const m = this.m || Modules.get(this.id); return ICONS[m ? m.icon : 'module']; }
    serialize() { return { id: this.id, sec: this.sec, sort: this.allSort }; }
    render() {
      this.m = Modules.get(this.id);
      this.secs.innerHTML = ''; this.body.innerHTML = '';
      if (!this.m) {
        this.search.hidden = true;
        this.body.append(el('p', { class: 'desc gd-pad', text: 'The module “' + this.id + '” isn’t installed on this phone. Import its file from Modules (in the + menu), or close this tab.' }), el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Modules…', onclick: () => Modules.manage(this.app) })));
        return;
      }
      this.search.hidden = false;
      if (this.sec !== 'all' && !(this.sec < this.m.sections.length)) this.sec = 0;
      // "All formulas": every formula and calculator of the module in one list
      const nForm = this.m.sections.reduce((t, x) => t + x.items.filter((i) => i.type === 'formula' || i.type === 'calc').length, 0);
      if (nForm > 1) { const c = el('button', { class: 'chip md-all' + (this.sec === 'all' ? ' on' : ''), text: 'All formulas', role: 'tab' }); c.onclick = () => { this.sec = 'all'; this.search.value = this.q = ''; this.secs.querySelectorAll('.chip').forEach((y) => y.classList.toggle('on', y === c)); this.drawList(); this.app.saveSoon(); }; this.secs.append(c); }
      else if (this.sec === 'all') this.sec = 0;
      this.m.sections.forEach((s, k) => { const c = el('button', { class: 'chip' + (k === this.sec ? ' on' : ''), text: s.title, role: 'tab' }); c.onclick = () => { this.sec = k; this.search.value = this.q = ''; this.secs.querySelectorAll('.chip').forEach((y) => y.classList.toggle('on', y === c)); this.drawList(); this.app.saveSoon(); }; this.secs.append(c); });
      this.drawList();
      this.app.renderTabs();
    }
    /** every formula and calculator of the module, by section or A–Z */
    drawAll() {
      const m = this.m, b = this.body;
      const all = m.sections.flatMap((sec) => sec.items.filter((it) => it.type === 'formula' || it.type === 'calc').map((it) => [it, sec]));
      const seg = el('div', { class: 'seg', style: { margin: '6px 0 4px' } });
      for (const [k, l] of [['sec', 'By section'], ['az', 'A–Z']]) { const x = el('button', { text: l, class: (this.allSort || 'sec') === k ? 'on' : '' }); x.onclick = () => { this.allSort = k; this.drawList(); this.app.saveSoon(); }; seg.append(x); }
      const nf = all.filter((x) => x[0].type === 'formula').length, nc = all.length - nf;
      b.append(el('p', { class: 'desc gd-pad', text: [nf ? nf + ' formula' + (nf > 1 ? 's' : '') : '', nc ? nc + ' calculator' + (nc > 1 ? 's' : '') : ''].filter(Boolean).join(' and ') + '.' + (nf ? ' Each formula solves for any of its variables.' : '') }), seg);
      const rows = this.allSort === 'az' ? all.slice().sort((p, q) => p[0].title.localeCompare(q[0].title)) : all;
      let L = null, cur = null;
      for (const [it, sec] of rows) {
        if (this.allSort !== 'az' && sec !== cur) { cur = sec; b.append(el('h4', { class: 'cv-h md-grp', text: sec.title })); L = null; }
        if (!L) { L = el('ul', { class: 'mlist' }); b.append(L); }
        const btn = el('button', { class: 'mi', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } }, el('span', { class: 'lbl', text: it.title, style: { fontWeight: '600' } }));
        if (it.tex) { const t = el('div', { style: { fontSize: '17px', maxWidth: '100%', overflowX: 'auto' } }); renderTex(t, it.tex); btn.append(t); }
        btn.append(el('span', { class: 'sub', text: KIND[it.type] + (this.allSort === 'az' ? ' · ' + sec.title : '') }));
        btn.onclick = () => this.openItem(it);
        L.append(el('li', {}, btn));
      }
    }
    drawList() {
      const m = this.m, b = this.body; b.innerHTML = ''; b.scrollTop = 0;
      const s = this.q.trim().toLowerCase();
      if (!s && this.sec === 'all') { this.drawAll(); return; }
      const pick = s ? m.sections.flatMap((sec) => sec.items.map((it) => [it, sec])) : m.sections[this.sec].items.map((it) => [it, m.sections[this.sec]]);
      if (!s && this.sec === 0 && m.description) b.append(el('p', { class: 'desc gd-pad', text: m.description }));
      let L = null, n = 0;
      const list = () => { if (!L) { L = el('ul', { class: 'mlist' }); b.append(L); } return L; };
      for (const [it, sec] of pick) {
        if (s && !(it.title + ' ' + (it.tags || '') + ' ' + (it.note || '') + ' ' + (it.type === 'text' ? it.md : '') + ' ' + sec.title).toLowerCase().includes(s)) continue;
        n++;
        // reference text sits in the list as a card, in its place among the other items
        if (it.type === 'text' && !s) { L = null; b.append(el('div', { class: 'card md-text' }, it.title ? el('h3', { text: it.title, style: { margin: '2px 0 4px', fontSize: '17px' } }) : null, el('article', { class: 'gd-doc md-doc', html: Guide.markdown(it.md || '', { untrusted: true }) }))); continue; }
        const btn = el('button', { class: 'mi', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } }, el('span', { class: 'lbl', text: it.title || KIND[it.type], style: { fontWeight: '600' } }));
        if (it.tex && (it.type === 'formula' || it.type === 'calc')) { const t = el('div', { style: { fontSize: '17px', maxWidth: '100%', overflowX: 'auto' } }); renderTex(t, it.tex); btn.append(t); }
        btn.append(el('span', { class: 'sub', text: KIND[it.type] + (it.type === 'table' ? ' · ' + it.rows.length + ' rows' : '') + (s ? ' · ' + sec.title : '') }));
        btn.onclick = () => this.openItem(it);
        list().append(el('li', {}, btn));
      }
      if (!n) b.append(el('p', { class: 'desc gd-pad', text: s ? 'Nothing matches “' + this.q + '”.' : 'This section is empty.' }));
    }
    openItem(it) {
      if (it.type === 'link') { Guide.openLink(it.url); return; }
      Sheet.open(it.title || KIND[it.type], (b) => { try { R[it.type](b, it, this.app); } catch (e) { b.append(el('p', { class: 'desc err', text: e.message })); } });
    }
  }

  Modules.ModulePage = ModulePage; Modules.validate = validate; Modules.checkExpr = checkExpr; Modules.ICONS = ICONS; Modules.TOOLS = TOOLS; Modules.REPO = REPO;
  root.Modules = Modules;
})(typeof self !== 'undefined' ? self : this);
