/*
 * main.js — the application shell: documents with pages (like TI-Nspire problems/pages),
 * the touch keypad, menus, catalog, settings and persistence.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { $, el, DB, toast, Sheet, renderTex, haptic } = UI;

  const APPS = {
    calc: { name: 'Calculator', icon: '<svg class="ic" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7M9 13h.01M12 13h.01M15 13h.01M9 16.5h.01M12 16.5h.01M15 16.5h.01"/></svg>', make: (a, s) => new Calculator.CalculatorPage(a, s) },
    graph: { name: 'Graphs', icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20V4M4 20h16"/><path d="M6 16c3-9 6 3 8-4s3-4 5-6"/></svg>', make: (a, s) => new Graphs.GraphsPage(a, s) },
    lists: { name: 'Lists & Spreadsheet', icon: '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 15h16M10 4v16"/></svg>', make: (a, s) => new Lists.ListsPage(a, s) },
    notes: { name: 'Notes', icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 4h9l4 4v12H6z"/><path d="M9 11h7M9 15h5"/></svg>', make: (a, s) => new Notes.NotesPage(a, s) },
    prog: { name: 'Program Editor', icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/></svg>', make: (a, s) => new Programs.ProgramPage(a, s) },
    guide: { name: 'Guide & manuals', icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 4.5h5.5a2 2 0 0 1 2 2V20a1.6 1.6 0 0 0-1.6-1.6H5z"/><path d="M19 4.5h-5.5a1 1 0 0 0-1 1"/><path d="M19 4.5v13.9h-5.9a1.6 1.6 0 0 0-1.6 1.6"/></svg>', make: (a, s) => new Guide.GuidePage(a, s) },
    convert: { name: 'Unit Converter', icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>', make: (a, s) => new ConverterPage(a, s) },
    emu: { name: 'Emulated calculator', icon: '<svg class="ic" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2"/><rect x="8.5" y="5" width="7" height="4.5" rx=".8"/><path d="M9 13h.01M12 13h.01M15 13h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>', make: (a, s) => new EmuPage(a, s), menu: false },
  };

  /* Every emulated calculator: [family, model id, full name, tab name (model number), firmware note].
     ti68k → TiEmu (ti89/), z80 → TilEm (classic/), hp → Emu48 (hp/), nspire → Firebird (nspire/). */
  const EMU_MODELS = [
    ['ti36', '36xpro', 'TI-36X Pro', 'TI-36X Pro', 'Built in: a recreation on the CAS, no firmware needed'],
    ['ti68k', '89', 'TI-89 Titanium', 'TI-89', 'OS file (.89u) or ROM'], ['ti68k', '92p', 'TI-92 Plus', 'TI-92+', 'OS file (.9xu) or ROM'], ['ti68k', 'v200', 'Voyage 200', 'V200', 'OS file (.v2u) or ROM'], ['ti68k', '92', 'TI-92', 'TI-92', 'ROM dump'],
    ['z80', 'z', 'TI-84 Plus Silver Edition', 'TI-84+SE', 'OS file (.8xu) or ROM'], ['z80', '4', 'TI-84 Plus', 'TI-84+', 'OS file (.8xu) or ROM'], ['z80', 's', 'TI-83 Plus Silver Edition', 'TI-83+SE', 'OS file (.8xu) or ROM'], ['z80', 'p', 'TI-83 Plus', 'TI-83+', 'OS file (.8xu) or ROM'],
    ['z80', '3', 'TI-83 / TI-82 STATS', 'TI-83', 'ROM dump'], ['z80', '2', 'TI-82', 'TI-82', 'ROM dump'], ['z80', '6', 'TI-86', 'TI-86', 'ROM dump'], ['z80', '5', 'TI-85', 'TI-85', 'ROM dump'], ['z80', '7', 'TI-73 Explorer', 'TI-73', 'OS file (.73u) or ROM'], ['z80', '1', 'TI-81', 'TI-81', 'ROM dump'],
    ['nspire', 'cx2cas', 'TI-Nspire CX II CAS', 'CX II CAS', 'System files dumped from your calculator + OS (.tcc2)'],
    ['hp', '48gx', 'HP 48GX', 'HP 48GX', 'HP’s ROM included (Emu48)'], ['hp', '48sx', 'HP 48SX', 'HP 48SX', 'HP’s ROM included (Emu48)'], ['hp', '49gp', 'HP 49g+', 'HP 49g+', 'HP’s ROM 2.10 included (Emu48)'], ['hp', '49g', 'HP 49G', 'HP 49G', 'HP’s ROM 2.10 included (Emu48)'],
  ];
  /** HP models removed in 2.6 (HP-42S, 12C, 15C, 16C) open as the HP 48GX */
  const OLD_HP = new Set(['42s', '12c', '15c', '16c']);
  const EMU_FAMILY = { ti36: 'TI scientific (built in)', nspire: 'TI-Nspire (Firebird)', ti68k: 'TI 68k (TiEmu)', z80: 'TI Z80 (TilEm)', hp: 'HP' };
  const emuModel = (fam, id) => EMU_MODELS.find((m) => m[0] === fam && m[1] === id);
  /** OS file extension → the calculator it belongs to (null model: keep the chosen one if it accepts the file) */
  const OS_EXT = { '89u': ['ti68k', '89'], '9xu': ['ti68k', '92p'], 'v2u': ['ti68k', 'v200'], '8xu': ['z80', null], '73u': ['z80', '7'], tcc2: ['nspire', 'cx2cas'], tco2: ['nspire', 'cx2cas'], tct2: ['nspire', 'cx2cas'] };

  /** The single emulated-calculator tab. Its model can be changed; each model keeps its own firmware and memory. */
  class EmuPage {
    constructor(app, state = {}) {
      this.kind = 'emu'; this.app = app; this.fullscreen = true;
      this.fam = state.fam || 'ti68k'; this.model = state.model || '89';
      if (this.fam === 'hp' && OLD_HP.has(this.model)) this.model = '48gx';
      if (!emuModel(this.fam, this.model)) { this.fam = 'ti68k'; this.model = '89'; }
      this.t36State = state.t36 || null;      // the TI-36X Pro's memory, kept while another model is shown
      this.root = el('div', { class: 'page emu' });
      this.mount();
    }
    /** the TI-36X Pro is built in, not an emulator in a frame */
    get target() { return this.t36 ? this.t36.target : null; }
    focus() { if (this.t36) this.t36.focus(); }
    get info() { return emuModel(this.fam, this.model); }
    get defaultName() { return this.info[3]; }
    src() {
      if (this.fam === 'ti68k') return 'ti89/index.html' + (this.model === '89' ? '' : '?slot=' + this.model);
      if (this.fam === 'z80') return 'classic/index.html?model=' + encodeURIComponent(this.model);
      if (this.fam === 'nspire') return 'nspire/index.html';
      return 'hp/index.html?model=' + encodeURIComponent(this.model);
    }
    mount() {
      this.ready = new Promise((res) => { this._ready = res; });
      this.t36 = null; this.frame = null;
      if (this.fam === 'ti36') {
        this.t36 = new TI36.TI36Page(this.app, this.t36State || {});
        this.t36.root.style.position = 'absolute';
        this.root.innerHTML = ''; this.root.append(this.t36.root); this._ready();
        return;
      }
      this.frame = el('iframe', { src: this.src(), title: this.info[2], style: { border: '0', width: '100%', height: '100%', display: 'block', background: 'var(--doc)' } });
      this.root.innerHTML = ''; this.root.append(this.frame);
    }
    /** ask the calculator in the frame to save its memory, then wait (at most 2.5 s) */
    saveFrame() {
      if (this.t36) { this.t36State = this.t36.serialize(); return Promise.resolve(); }
      return new Promise((res) => {
        const id = Math.random().toString(36).slice(2); const t = setTimeout(done, 2500);
        function done() { clearTimeout(t); root.removeEventListener('message', on); res(); }
        const on = (e) => { if (e.origin === location.origin && e.data && e.data.type === 'emu-saved' && e.data.id === id) done(); };
        root.addEventListener('message', on);
        try { this.frame.contentWindow.postMessage({ type: 'emu-save', id }, location.origin); } catch (e) { done(); }
      });
    }
    async setModel(fam, model) {
      if (fam === this.fam && model === this.model) return;
      await this.saveFrame();
      this.fam = fam; this.model = model; this.mount();
      this.app.saveSoon(); this.app.renderTabs();
      if (this.app.page === this) { this.app.applyOrientation(this); if (this.target) { this.app.setTarget(this.target); setTimeout(() => this.focus(), 30); } }
    }
    async install(file) {
      if (this.t36) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.ready;
      this.frame.contentWindow.postMessage({ type: 'emu-install', name: file.name, bytes }, location.origin);
    }
    serialize() { const t = this.t36 ? this.t36.serialize() : this.t36State; return t ? { fam: this.fam, model: this.model, t36: t } : { fam: this.fam, model: this.model }; }
    /** -1 follow the phone, 1 portrait, 6 landscape */
    get orientation() { return this.fam === 'ti36' ? 1 : this.fam === 'ti68k' && this.model !== '89' ? 6 : -1; }
  }
  root.addEventListener('message', (e) => {
    const d = e.data, app = root.__app; if (!d || !app || e.origin !== location.origin) return;
    const p = app.pages.find((x) => x.frame && x.frame.contentWindow === e.source); if (!p) return;
    if (d.type === 'emu-ready') p._ready && p._ready();
    else if (d.type === 'emu-replace') { app.select(app.pages.indexOf(p)); app.emuChooser(); }
    else if (d.type === 'classic-model' && p.fam === 'z80' && p.model !== d.model && emuModel('z80', d.model)) { p.model = d.model; app.saveSoon(); app.renderTabs(); }
  });

  const UNIQUE = new Set(['calc', 'emu']);
  const DEFAULT_NAMES = { calc: 'CAS', guide: 'Guide', graph: 'Graphs', lists: 'Lists', notes: 'Notes', prog: 'Program', convert: 'Convert' };
  const DEFAULT_SETTINGS = { angle: 'rad', digits: 6, fmt: 'norm', showDec: true, group: true, autoAns: true, calc: 'auto', complex: 'rect', theme: 'system', haptic: true, keypage: 'num', multiEmu: false };

  const App = {
    settings: { ...DEFAULT_SETTINGS },
    userFuncs: new Set(), vars: new Set(), lastAns: null,
    pages: [], active: 0, doc: null, target: null, osKeyboard: false, shift: false,

    async init() {
      await DB.open();
      const s = await DB.get('settings'); if (s) Object.assign(this.settings, s);
      if (s && !s.fmt) this.settings.fmt = s.sci ? 'sci' : 'norm';
      Units.defineUser(this.settings.userUnits || []);
      this.applyTheme();
      this.cas = new CAS('js/cas-worker.js');
      this.cas.onBusy = (b) => document.body.classList.toggle('cas-busy', b);
      this.buildKeypad();
      this.bindStrip();
      $('#btn-doc').onclick = () => this.docMenu();
      $('#btn-addpage').onclick = () => this.addPageMenu();
      $('#scrim').onclick = () => Sheet.close();
      $('#sheet-close').onclick = () => Sheet.close();
      $('#sheet-back').onclick = () => Sheet.back();
      window.onAndroidBack = () => {
        if (Sheet.isOpen) { Sheet.back(); return true; }
        const f = this.page && this.page.root.querySelector('iframe');
        try { if (f && f.contentWindow.__closeOverlay && f.contentWindow.__closeOverlay()) return true; } catch (e) {}
        try { if (f && f.contentWindow.onAndroidPause) f.contentWindow.onAndroidPause(); } catch (e) {}
        this.saveNow(); if (root.TiBridge) root.TiBridge.exitApp(); return false;
      };
      window.onAndroidPause = () => { this.saveNow(); document.querySelectorAll('#pages iframe').forEach((f) => { try { f.contentWindow.onAndroidPause && f.contentWindow.onAndroidPause(); } catch (e) {} }); };
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
      let doc = null; const lastId = await DB.get('lastDoc');
      if (lastId) doc = await DB.get('doc:' + lastId);
      if (!doc) { const idx = ((await DB.get('docs')) || []).sort((x, y) => y.modified - x.modified); if (idx[0]) doc = await DB.get('doc:' + idx[0].id); }
      await this.openDoc(doc || this.newDocData());
      try { await this.cas.ready; } catch (e) { toast(e.message, 8000); }
      root.__app = this;
    },

    /* ---------------- the document (there is only one) ---------------- */
    newDocData() { return { id: 'd' + Date.now().toString(36), name: 'CalcShelf', pages: [{ kind: 'calc', state: {} }], defs: [], created: Date.now() }; },
    /** older versions had several documents and one page per emulator: keep CAS first, one TI-36X Pro, one emulator */
    /** several emulator tabs (each a different model, all running) when the setting is on */
    isUnique(kind) { return UNIQUE.has(kind) && !(kind === 'emu' && this.settings.multiEmu); },
    migrateDoc(d) {
      const out = [], seen = {}, models = new Set();
      let t36 = null, t36At = -1;   // before 2.8 the TI-36X Pro was its own kind of tab; now it is an emulated calculator
      for (const pg of d.pages || []) {
        let { kind, state = {}, name } = pg;
        if (kind === 'ti36') { if (!t36) { t36 = { state, name }; t36At = out.length; } continue; }
        if (kind === 'ti89') { state = { fam: 'ti68k', model: state.slot || '89' }; kind = 'emu'; }
        else if (kind === 'classic') { state = { fam: 'z80', model: state.model || 'z' }; kind = 'emu'; }
        else if (kind === 'hp') { state = { fam: 'hp', model: OLD_HP.has(state.model || '42s') ? '48gx' : state.model }; kind = 'emu'; }
        if (!APPS[kind] || (this.isUnique(kind) && seen[kind])) continue;
        if (kind === 'emu') { const id = (state.fam || 'ti68k') + ':' + (state.model || '89'); if (models.has(id)) continue; models.add(id); }
        seen[kind] = true; out.push({ kind, state, name });
      }
      if (t36) {
        const emu = out.find((x) => x.kind === 'emu');
        if (emu && !this.settings.multiEmu) { if (!emu.state.t36) emu.state = Object.assign({}, emu.state, { t36: t36.state }); }
        else if (!models.has('ti36:36xpro')) out.splice(Math.max(0, t36At), 0, { kind: 'emu', state: { fam: 'ti36', model: '36xpro', t36: t36.state }, name: t36.name });
      }
      const ci = out.findIndex((x) => x.kind === 'calc');
      if (ci < 0) out.unshift({ kind: 'calc', state: {} }); else if (ci > 0) out.unshift(out.splice(ci, 1)[0]);
      d.pages = out; d.active = Math.min(d.active || 0, out.length - 1);
      return d;
    },
    async openDoc(d) {
      if (this.doc) await this.saveNow();
      this.doc = this.migrateDoc(d);
      $('#pages').innerHTML = ''; this.pages = [];
      this.userFuncs = new Set(d.userFuncs || []); this.vars = new Set(d.vars || []); this.lastAns = d.lastAns || null;
      await this.cas.ready.catch(() => {});
      await this.cas.reset().catch(() => {});
      await this.applyCasSettings();
      await this.cas.batch(d.defs || []).catch(() => {});
      this.cas.defs = (d.defs || []).slice();
      for (const p of d.pages) { const pg = this.addPage(p.kind, p.state, true); if (pg && typeof p.name === 'string' && p.name) pg.name = p.name; }
      this.select(Math.min(d.active || 0, this.pages.length - 1));
      DB.set('lastDoc', d.id);
    },
    serializeDoc() {
      const d = this.doc;
      d.pages = this.pages.map((p) => ({ kind: p.kind, state: p.serialize(), name: typeof p.name === 'string' && p.name ? p.name : undefined }));
      d.active = this.active; d.defs = this.cas.defs.slice(); d.userFuncs = [...this.userFuncs]; d.vars = [...this.vars]; d.lastAns = this.lastAns; d.modified = Date.now();
      return d;
    },
    saveSoon() { clearTimeout(this._sv); this._sv = setTimeout(() => this.saveNow(), 800); },
    async saveNow() { clearTimeout(this._sv); if (!this.doc) return; await DB.set('doc:' + this.doc.id, this.serializeDoc()); },

    /* ---------------- tabs ---------------- */
    addPage(kind, state = {}, quiet) {
      const def = APPS[kind]; if (!def) return;
      if (this.isUnique(kind) || kind === 'guide') { const i = this.pages.findIndex((x) => x.kind === kind); if (i >= 0) { if (!quiet) this.select(i); return this.pages[i]; } }
      const p = def.make(this, state);
      p.kind = kind;
      this.pages.push(p); $('#pages').append(p.root); p.root.hidden = true;
      if (!quiet) { this.select(this.pages.length - 1); this.saveSoon(); }
      this.renderTabs();
      return p;
    },
    select(i) {
      this.active = i;
      // with several emulator tabs, the ones in the background stay laid out (invisible) so they keep running
      this.pages.forEach((p, k) => { const bg = k !== i && p.kind === 'emu' && this.settings.multiEmu; p.root.hidden = k !== i && !bg; p.root.classList.toggle('bgrun', bg); });
      const p = this.pages[i];
      document.body.classList.toggle('fullpage', !!(p && p.fullscreen));
      document.body.classList.toggle('nokeys', !!(p && p.noKeypad));
      $('#strip').hidden = $('#kp').hidden = !!(p && p.fullscreen);
      this.applyOrientation(p);
      if (p && p.onShow) p.onShow();
      if (p && p.target) { this.setTarget(p.target); setTimeout(() => p.focus && p.focus(), 30); }
      this.renderTabs();
    },
    /** the CAS and the TI-36X Pro stay upright; the TI-92, TI-92 Plus and Voyage 200 are landscape only */
    applyOrientation(p) {
      const o = !p ? -1 : p.kind === 'calc' ? 1 : p.kind === 'emu' ? p.orientation : -1;
      if (o === this._orient) return; this._orient = o;
      try { if (root.TiBridge && root.TiBridge.setOrientation) root.TiBridge.setOrientation(o); } catch (e) { /* older shell */ }
    },
    /** the tab's name: what the user typed, else CAS / the calculator's model number / the app's short name */
    tabName(p) {
      if (typeof p.name === 'string' && p.name) return p.name;   // (before 2.7.4 a Program tab saved its name field here by mistake)
      if (p.kind === 'emu') return p.defaultName;
      const same = this.pages.filter((x) => x.kind === p.kind);
      const n = same.indexOf(p);
      return DEFAULT_NAMES[p.kind] + (n > 0 ? ' ' + (n + 1) : '');
    },
    renderTabs() {
      const t = $('#tabs'); t.innerHTML = '';
      this.pages.forEach((p, i) => {
        const name = this.tabName(p);
        const b = el('button', { class: 'tab' + (i === this.active ? ' on' : ''), role: 'tab', html: APPS[p.kind].icon + '<span class="tn"></span>', 'aria-label': name, title: name + (i === this.active ? ' — tap for tab options' : '') });
        b.querySelector('.tn').textContent = name;
        let lp, fired = false;
        b.onclick = () => { if (fired) { fired = false; return; } if (i === this.active) this.pageMenu(i); else this.select(i); };
        b.addEventListener('pointerdown', () => { fired = false; lp = setTimeout(() => { lp = null; fired = true; this.renameTab(i); }, 600); });
        const cancel = () => { if (lp) clearTimeout(lp); }; b.addEventListener('pointerup', cancel); b.addEventListener('pointercancel', cancel); b.addEventListener('pointerleave', cancel);
        t.append(b);
      });
      const on = t.querySelector('.tab.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      $('#modebadge').textContent = this.settings.angle === 'deg' ? 'DEG' : 'RAD';
    },
    get page() { return this.pages[this.active]; },
    pageMenu(i) {
      const p = this.pages[i];
      Sheet.open(this.tabName(p), (b) => {
        const L = el('ul', { class: 'mlist' });
        const item = (label, sub, fn) => L.append(el('li', {}, el('button', { class: 'mi', onclick: () => { Sheet.close(); fn(); } }, el('span', { class: 'lbl', text: label }), sub ? el('span', { class: 'sub', text: sub }) : null)));
        item('Rename tab', 'Or long-press any tab', () => this.renameTab(i));
        if (p.kind === 'emu') item('Replace OS or change calculator', 'Now ' + p.info[2] + ' · each model keeps its own OS and memory', () => this.emuChooser());
        if (i > 1) item('Move left', '', () => { this.pages.splice(i - 1, 0, this.pages.splice(i, 1)[0]); this.select(i - 1); this.saveSoon(); });
        if (i > 0 && i < this.pages.length - 1) item('Move right', '', () => { this.pages.splice(i + 1, 0, this.pages.splice(i, 1)[0]); this.select(i + 1); this.saveSoon(); });
        const t36 = p.t36;
        if (t36) item(t36.S.night ? 'Day display' : 'Night display', t36.S.night ? 'Back to the grey-green screen' : 'Dark screen with light text', () => { Sheet.close(); t36.setNight(!t36.S.night); });
        const pp = p.t36 || p;
        if (pp.exportCSV) item('Export history (CSV)', 'Inputs, results, decimals, uncertainties and units', () => pp.exportCSV());
        if (pp.clear) item('Clear page', p.kind === 'calc' ? 'Pinned results stay' : '', () => pp.clear());
        if (p.kind !== 'calc') item('Close tab', p.kind === 'emu' ? 'The calculator’s OS and memory stay on this phone' : '', async () => { if (p.saveFrame) await p.saveFrame(); this.pages.splice(i, 1); p.root.remove(); this.select(Math.max(0, i - 1)); this.saveSoon(); });
        b.append(L);
      });
    },
    renameTab(i) {
      const p = this.pages[i]; if (!p) return;
      const dflt = (() => { const n = p.name; p.name = ''; const d = this.tabName(p); p.name = n; return d; })();
      Sheet.open('Rename tab', (b) => {
        const inp = el('input', { class: 'search', value: this.tabName(p), maxlength: '24', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Tab name' });
        const save = (v) => { v = (v || '').trim(); p.name = v && v !== dflt ? v : ''; Sheet.close(); this.renderTabs(); this.saveSoon(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(inp.value); });
        b.append(inp, el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Save', onclick: () => save(inp.value) }), el('button', { class: 'btn', text: 'Use “' + dflt + '”', onclick: () => save('') })));
        setTimeout(() => { inp.focus(); inp.select(); }, 60);
      });
    },
    addPageMenu() {
      Sheet.open('Add a tab', (b) => {
        const L = el('ul', { class: 'mlist' });
        const row = (icon, label, sub, fn) => { const x = el('button', { class: 'mi', html: icon.replace('class="ic"', 'class="ic" style="width:22px;height:22px"') + '<span class="lbl"></span>' + (sub ? '<span class="sub"></span>' : ''), onclick: fn }); x.querySelector('.lbl').textContent = label; if (sub) x.querySelector('.sub').textContent = sub; L.append(el('li', {}, x)); };
        const emu = this.pages.find((x) => x.kind === 'emu');
        if (this.settings.multiEmu) row(APPS.emu.icon, 'Emulated calculator', 'A new tab; the other calculators keep running', () => this.emuChooser(true, null));
        else row(APPS.emu.icon, 'Emulated calculator', emu ? 'Open as “' + this.tabName(emu) + '” — change the model with Replace OS' : 'TI-36X Pro, TI-Nspire CX II CAS, TI-89, TI-92, Voyage 200, TI-84 Plus … TI-81, HP 48GX/48SX, HP 49g+/49G', () => { if (emu) { Sheet.close(); this.select(this.pages.indexOf(emu)); this.emuChooser(); } else this.emuChooser(true); });
        b.append(L, el('h3', { text: 'More pages', style: { fontSize: '14px', color: 'var(--ink2)', margin: '16px 2px 4px' } }));
        const M = el('ul', { class: 'mlist' }); b.append(M);
        for (const [k, a] of Object.entries(APPS)) if (a.menu !== false && !UNIQUE.has(k)) M.append(el('li', {}, el('button', { class: 'mi', html: a.icon.replace('class="ic"', 'class="ic" style="width:22px;height:22px"') + '<span class="lbl">' + a.name + '</span>', onclick: () => { Sheet.close(); this.addPage(k); } })));
      });
    },
    /** pick the emulated calculator's model, optionally with a new OS file (Replace OS) */
    emuChooser(push, target) {
      const act = this.pages[this.active];
      const cur = target !== undefined ? target : act && act.kind === 'emu' ? act : this.settings.multiEmu ? null : this.pages.find((x) => x.kind === 'emu');
      this._emuTarget = cur;
      const build = (b) => {
        b.append(el('p', { class: 'desc', text: cur ? 'Pick a model to switch the ' + this.tabName(cur) + ' tab to it, or load a new OS for the current one. Each model keeps its own OS and memory, so you can switch back at any time.' : 'Pick the calculator for the emulator tab. TI models need their OS file or a ROM once; HP models are ready to use.' }));
        for (const fam of Object.keys(EMU_FAMILY)) {
          b.append(el('h3', { text: EMU_FAMILY[fam], style: { fontSize: '14px', color: 'var(--ink2)', margin: '14px 2px 4px' } }));
          const L = el('ul', { class: 'mlist' }); b.append(L);
          for (const m of EMU_MODELS.filter((x) => x[0] === fam)) {
            const isCur = cur && cur.fam === m[0] && cur.model === m[1];
            const x = el('button', { class: 'mi' + (isCur ? ' on' : ''), 'data-emu': m[0] + ':' + m[1] }, el('span', { class: 'lbl', text: m[2] + (isCur ? '  ✓' : '') }), el('span', { class: 'sub', text: (isCur ? 'Current · ' : '') + m[4] }));
            x.onclick = () => Sheet.push(m[2], (bb) => this.emuModelActions(bb, m));
            L.append(el('li', {}, x));
          }
        }
      };
      if (push === true) Sheet.push('Choose a calculator', build); else Sheet.open(cur ? 'Replace OS or change calculator' : 'Choose a calculator', build);
    },
    emuModelActions(b, m) {
      const cur = this._emuTarget;
      const isCur = cur && cur.fam === m[0] && cur.model === m[1];
      const builtIn = m[0] === 'hp' || m[0] === 'ti36';
      b.append(el('p', { class: 'desc', text: m[4] + '.' + (builtIn ? '' : ' Firmware stays on this phone; the app contains no TI code.') }));
      const L = el('ul', { class: 'mlist' }); b.append(L);
      const item = (label, sub, fn) => L.append(el('li', {}, el('button', { class: 'mi', 'data-act': label, onclick: fn }, el('span', { class: 'lbl', text: label }), sub ? el('span', { class: 'sub', text: sub }) : null)));
      const ns = m[0] === 'nspire';
      if (!builtIn) item(ns ? (isCur ? 'Load system files or a new OS…' : 'Choose system files and OS…') : isCur ? 'Replace OS or ROM…' : 'Choose OS file or ROM…',
        ns ? 'boot ROM with keys, manuf, btldr, instl, diags and the .tcc2 OS — select them all at once' : isCur ? 'Erases this calculator’s memory' : 'Switches to the ' + m[3] + ' and installs it', () => {
        const f = $('#file-emu'); f.value = ''; f.multiple = ns;
        f.onchange = () => { const files = [...f.files]; f.value = ''; if (!files.length) return; Sheet.close(); this.emuApply(m[0], m[1], files); };
        f.click();
      });
      if (!isCur) item((cur ? 'Switch to the ' : 'Open the ') + m[3], builtIn ? 'Ready to use' : 'Uses the OS already loaded for it, or asks for one', () => { Sheet.close(); this.emuApply(m[0], m[1], null); });
    },
    async emuApply(fam, model, files) {
      files = files ? (Array.isArray(files) ? files : [files]) : [];
      const file = files.length === 1 ? files[0] : null;
      if (file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase(), hit = OS_EXT[ext];
        const ok = hit && hit[0] === fam && (hit[1] ? hit[1] === model : ['z', '4', 's', 'p'].includes(model));
        if (hit && !ok) { fam = hit[0]; model = hit[1] || 'z'; toast('That is a ' + emuModel(fam, model)[2] + ' OS — switching to the ' + emuModel(fam, model)[3], 4500); }
      }
      let p;
      if (this.settings.multiEmu) {
        const target = this._emuTarget || null;
        const open = this.pages.find((x) => x.kind === 'emu' && x !== target && x.fam === fam && x.model === model);
        if (open) { p = open; this.select(this.pages.indexOf(p)); toast('The ' + emuModel(fam, model)[3] + ' is already open in its own tab'); }
        else if (target && this.pages.includes(target)) { p = target; this.select(this.pages.indexOf(p)); await p.setModel(fam, model); }
        else p = this.addPage('emu', { fam, model });
      } else {
        p = this.pages.find((x) => x.kind === 'emu');
        if (!p) p = this.addPage('emu', { fam, model });
        else { this.select(this.pages.indexOf(p)); await p.setModel(fam, model); }
      }
      this._emuTarget = undefined;
      for (const f of files) await p.install(f);
    },
    graphExpression(expr) {
      let gi = this.pages.findIndex((p) => p.kind === 'graph');
      if (gi < 0) { this.addPage('graph'); gi = this.pages.length - 1; } else this.select(gi);
      this.pages[gi].addFunction(expr);
    },

    /* ---------------- input routing ---------------- */
    setTarget(mf) { this.target = mf; },
    insert(latex) {
      const mf = this.target; if (!mf) return;
      mf.focus();
      latex = GiacFmt.fixUnitTex(latex);
      mf.executeCommand(['insert', latex, { format: 'latex', insertionMode: 'replaceSelection', selectionMode: 'placeholder', focus: true }]);
    },
    typed(ch) { const mf = this.target; if (!mf) return; mf.focus(); mf.executeCommand(['typedText', ch, { focus: true, feedback: false, simulateKeystroke: true }]); },
    cmd(c) { const mf = this.target; if (!mf) return; mf.executeCommand(c); },

    buildKeypad() {
      const host = $('#kpages'), seg = $('#kseg');
      KEYPAGES.forEach((pg) => {
        const g = el('div', { class: 'kpage', 'data-id': pg.id, style: { gridTemplateColumns: 'repeat(' + pg.cols + ', 1fr)' } });
        for (const k of pg.keys) {
          const b = el('button', { class: 'key ' + (k.t || '') + (k.s || k.d ? ' has2' : ''), style: k.w ? { gridColumn: 'span ' + k.w } : null });
          const face = el('span', { class: 'kf' });
          if (k.l[0] === '$') renderTex(face, k.l.slice(1)); else face.textContent = k.l;
          b.append(face);
          if (k.s) b.append(el('span', { class: 'ks', text: k.s.l }));
          if (k.d) b.append(el('span', { class: 'kd', text: k.d.l }));
          b.setAttribute('aria-label', (k.l.replace(/^\$/, '').replace(/\\[a-z]+/g, '').replace(/[{}^_]/g, '') || k.l) + (k.s ? ', 2nd ' + k.s.l : '') + (k.d ? ', diamond ' + k.d.l : ''));
          let y0 = 0, lp = null, done = false, rep = null;
          const fire = (spec) => { done = true; b.classList.remove('pressed'); this.keyPress(spec, b); };
          b.addEventListener('pointerdown', (e) => {
            b.classList.add('pressed'); if (this.settings.haptic) haptic();
            y0 = e.clientY; done = false; try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
            if (k.s || k.d) lp = setTimeout(() => { lp = null; done = true; b.classList.remove('pressed'); this.keyPop(b, k); }, 480);
            if (k.rep) lp = setTimeout(() => { lp = null; done = true; this.keyPress(k, b); rep = setInterval(() => this.keyPress(k, b), 70); }, 420);
          });
          b.addEventListener('pointermove', (e) => { if (lp && Math.abs(e.clientY - y0) > 14) { clearTimeout(lp); lp = null; } });
          b.addEventListener('pointerup', (e) => {
            if (lp) { clearTimeout(lp); lp = null; }
            if (rep) { clearInterval(rep); rep = null; b.classList.remove('pressed'); }
            if (done) return;
            fire(k);
          });
          b.addEventListener('pointercancel', () => { if (lp) clearTimeout(lp); lp = null; if (rep) clearInterval(rep); rep = null; b.classList.remove('pressed'); });
          b.addEventListener('click', (e) => { e.preventDefault(); if (e.detail === 0) this.keyPress(k, b); });   // keyboard activation only
          b.addEventListener('mousedown', (e) => e.preventDefault());
          b.addEventListener('contextmenu', (e) => e.preventDefault());
          g.append(b);
        }
        host.append(g);
        const s = el('button', { text: pg.label, role: 'tab', 'data-id': pg.id, onclick: () => this.showKeyPage(pg.id, true) });
        seg.append(s);
      });
      host.addEventListener('scroll', () => { clearTimeout(this._ks); this._ks = setTimeout(() => { const i = Math.round(host.scrollLeft / host.clientWidth); const id = KEYPAGES[i] && KEYPAGES[i].id; if (id) this.markKeyPage(id); }, 60); });
      document.querySelectorAll('.kbar [data-a]').forEach((b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); b.onclick = () => { if (this.settings.haptic) haptic(); this.action(b.dataset.a); }; });
      requestAnimationFrame(() => this.showKeyPage(this.settings.keypage || 'num', false));
    },
    showKeyPage(id, smooth) {
      const host = $('#kpages'); const i = KEYPAGES.findIndex((p) => p.id === id);
      host.scrollTo({ left: i * host.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      this.markKeyPage(id);
    },
    markKeyPage(id) { document.querySelectorAll('#kseg button').forEach((b) => b.classList.toggle('on', b.dataset.id === id)); this.settings.keypage = id; },
    /** long-press: choose the key's primary, 2nd or ◆ function */
    keyPop(b, k) {
      document.querySelectorAll('.kpop').forEach((x) => x.remove());
      const pop = el('div', { class: 'kpop', role: 'menu' });
      const opt = (spec, cls, tag) => { const o = el('button', { class: 'kpo ' + cls, role: 'menuitem' }, el('small', { text: tag }), el('span', { text: spec.title || spec.l })); if (spec.l[0] === '$') renderTex(o.lastChild, spec.l.slice(1)); o.onclick = () => { pop.remove(); this.keyPress(spec, b); }; pop.append(o); };
      opt(k, 'p', 'key'); if (k.s) opt(k.s, 's', '2nd'); if (k.d) opt(k.d, 'd', '◆');
      document.body.append(pop);
      const r = b.getBoundingClientRect(), w = pop.offsetWidth;
      pop.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px'; pop.style.top = Math.max(6, r.top - pop.offsetHeight - 6) + 'px';
      const close = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('pointerdown', close, true); } };
      setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
    },
    keyPress(k, b) {
      if (k.aa && this.page && this.page.autoAns && this.target === this.page.mf) this.page.autoAns();
      if (k.ty) return this.typed(k.ty);
      if (k.a) return this.action(k.a, b);
      if (k.c) return this.cmd(k.c);
      if (k.ch) { let c = k.ch; if (this.shift) { c = c.toUpperCase(); this.setShift(false); } return this.typed(c); }
      if (k.i) {
        const p = this.page;
        if (p && p.keyInsert && p.keyInsert(k.i)) return;
        this.insert(k.i);
      }
    },
    setShift(on) { this.shift = on; document.querySelectorAll('.key.abc.mod').forEach((b) => b.classList.toggle('on', on)); },
    bindStrip() {
      document.querySelectorAll('#strip [data-a]').forEach((b) => {
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.onclick = () => { if (b._held) { b._held = false; return; } if (this.settings.haptic) haptic(); this.action(b.dataset.a); };
        if (b.dataset.a !== 'del') return;
        // hold ⌫ to keep deleting
        let t = null, rep = null;
        const stop = () => { clearTimeout(t); clearInterval(rep); t = rep = null; };
        b.addEventListener('pointerdown', () => { stop(); t = setTimeout(() => { b._held = true; this.action('del'); rep = setInterval(() => this.action('del'), 70); }, 420); });
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
      });
    },
    action(a) {
      const p = this.page;
      switch (a) {
        case 'enter': if (p && p.enter) p.enter(false); break;
        case 'approx': if (p && p.enter) p.enter(true); break;
        case 'esc': if (Sheet.isOpen) Sheet.close(); else if (p && p.esc) p.esc(); else if (this.target) this.target.value = ''; break;
        case 'tab': this.cmd('moveToNextPlaceholder'); break;
        case 'left': this.cmd('moveToPreviousChar'); break;
        case 'right': this.cmd('moveToNextChar'); break;
        case 'del': this.cmd('deleteBackward'); break;
        case 'menu': this.openMenu(); break;
        case 'catalog': this.catalog(); break;
        case 'library': Library.open(this); break;
        case 'ans': this.insert('\\operatorname{ans}'); break;
        case 'shift': this.setShift(!this.shift); break;
        case 'popen': if (this.target) UI.Edit.open(this.target); break;
        case 'pclose': if (this.target) UI.Edit.close(this.target); break;
        case 'vars': this.varsSheet(); break;
        case 'recallDef': this.varsSheet(true); break;
        case 'clearAZ': this.menuAction('clearAZ'); break;
        case 'units': this.unitsSheet(); break;
        case 'abcpage': this.showKeyPage('abc', true); break;
        case 'entry': if (p && p.recall) { p.recall(); if (p.mf) p.mf.focus(); } break;
      }
    },

    /* ---------------- Nspire-style menus ---------------- */
    openMenu() {
      const p = this.page;
      const tree = (p && p.menu) ? p.menu() : NspireMenus.CALC_MENU;
      const show = (title, items, push) => {
        const build = (b) => {
          const L = el('ul', { class: 'mlist' });
          items.forEach((it, i) => {
            const [label, v] = it;
            const btn = el('button', { class: 'mi' }, el('span', { class: 'n', text: i + 1 < 10 ? String(i + 1) : String.fromCharCode(56 + i) }), el('span', { class: 'lbl', text: label }));
            if (Array.isArray(v)) btn.append(el('span', { class: 'chev', text: '›' }));
            btn.onclick = () => {
              if (Array.isArray(v)) return show(label, v, true);
              Sheet.close();
              if (typeof v === 'string') this.insert(v);
              else if (typeof v === 'function') v();
              else if (v.action) this.menuAction(v.action);
              else if (v.dialog) Dialogs.open(this, v);
            };
            L.append(el('li', {}, btn));
          });
          b.append(L);
        };
        if (push) Sheet.push(title, build); else Sheet.open(title, build);
      };
      show((p && p.title) || 'Menu', tree, false);
    },
    menuAction(a) {
      const calc = this.pages.find((p) => p.kind === 'calc');
      switch (a) {
        case 'clearHistory': if (this.page.clear) this.page.clear(); break;
        case 'clearAZ': { const names = [...this.vars].filter((n) => /^[a-z]$/.test(n)); if (names.length) this.page.runTex && this.page.runTex('\\operatorname{DelVar}' + names.join(','), false); toast('Cleared one-letter variables'); break; }
        case 'library': Library.open(this); break;
        case 'vars': this.varsSheet(); break;
        case 'recallDef': this.varsSheet(true); break;
        case 'approx': this.page.enter && this.page.enter(true); break;
        case 'units': this.unitsSheet(); break;
        case 'programs': { const i = this.pages.findIndex((p) => p.kind === 'prog'); if (i >= 0) this.select(i); else this.addPage('prog'); break; }
      }
    },
    varsSheet(recall) {
      Sheet.open(recall ? 'Recall definition' : 'Variables', async (b) => {
        const names = [...this.userFuncs, ...this.vars].sort();
        if (!names.length) { b.append(el('p', { class: 'desc', text: 'No variables yet. Store one with → (on the f(x) keys) or define a function with Define.' })); return; }
        const L = el('ul', { class: 'mlist' }); b.append(L);
        const vals = await this.cas.batch(names.map((n) => this.userFuncs.has(n) ? n : n));
        names.forEach((n, i) => {
          const isF = this.userFuncs.has(n);
          const btn = el('button', { class: 'mi' }, el('span', { class: 'lbl' }), el('span', { class: 'sub', text: isF ? 'function' : '' }));
          renderTex(btn.firstChild, GiacFmt.idTex(n) + (isF ? '' : '=' + (GiacFmt.giacToTex(vals[i], { digits: this.settings.digits }) || '')));
          btn.onclick = () => { Sheet.close(); this.insert(isF ? '\\operatorname{' + n + '}\\left(#?\\right)' : (n.length > 1 ? '\\operatorname{' + n + '}' : n)); };
          L.append(el('li', {}, btn));
        });
      });
    },
    unitsSheet() {
      Sheet.open('Units', (b) => {
        b.append(el('p', { class: 'desc', html: 'Units start with an underscore. Convert with <b>→</b>, for example <span class="mono">3_ft→_m</span>. Combine them freely: <span class="mono">W/(m·K)</span>, <span class="mono">ps/(nm·km)</span>, <span class="mono">kg·m²</span>.' }));
        const put = (u) => { Sheet.close(); this.insert(Units.entryTex(u)); };
        // any unit, typed
        const typed = el('input', { class: 'search', placeholder: 'Type any unit, e.g. W/(m·K) or mW/(cm²·nm)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Unit to insert' });
        const msg = el('p', { class: 'desc', hidden: true });
        const go = () => { const u = typed.value.trim(); if (!u) return; try { Units.parse(u); put(u); } catch (e) { msg.hidden = false; msg.textContent = e.message; } };
        typed.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        typed.addEventListener('input', () => { msg.hidden = true; filter(); });
        b.append(el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, typed, el('button', { class: 'btn pri', text: 'Insert', onclick: go })), msg);
        const mine = Units.userUnits();
        const sec = el('div');
        b.append(el('div', { class: 'btnrow' }, el('button', { class: 'btn', text: mine.length ? 'Your units (' + mine.length + ')…' : 'Add your own unit…', onclick: () => Library.open(this, 'mine') })), sec);
        const groups = [];
        if (mine.length) groups.push(['Your units', mine.map((x) => x.sym)]);
        for (const [cat, , list] of Units.QUANTITIES) groups.push([cat, list.filter((u) => u !== '1')]);
        const draw = (s) => {
          sec.innerHTML = '';
          for (const [cat, list] of groups) {
            const hit = !s || cat.toLowerCase().includes(s) ? list : list.filter((u) => u.toLowerCase().includes(s) || ((Units.lookup(u) || {}).name || '').toLowerCase().includes(s));
            if (!hit.length) continue;
            const d = el('details', { class: 'ugrp' }); if (s || cat === 'Your units' || ['Length', 'Mass', 'Time'].includes(cat)) d.open = true;
            d.append(el('summary', { text: cat }));
            const c = el('div', { class: 'chips', style: { flexWrap: 'wrap' } });
            for (const u of hit) c.append(el('button', { class: 'chip', text: u, title: (Units.lookup(u) || {}).name || u, onclick: () => put(u) }));
            d.append(c); sec.append(d);
          }
        };
        const filter = () => { const v = typed.value.trim().toLowerCase(); draw(v.length >= 2 ? v : ''); };
        draw('');
      });
    },

    /* ---------------- catalog ---------------- */
    async catalog() {
      if (!this._cat) { try { this._cat = await (await fetch('data/commands.json')).json(); } catch (e) { this._cat = []; } }
      const all = this._cat;
      Sheet.open('Catalog', (b) => {
        const q = el('input', { class: 'search', type: 'search', placeholder: 'Search ' + all.length + ' commands', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
        const L = el('ul', { class: 'mlist' });
        const render = () => {
          const s = q.value.trim().toLowerCase(); L.innerHTML = '';
          let rows = all;
          if (s) rows = all.filter((c) => c.n.toLowerCase().includes(s) || (c.d || '').toLowerCase().includes(s)).sort((a, b) => (b.n.toLowerCase().startsWith(s) - a.n.toLowerCase().startsWith(s)) || a.n.localeCompare(b.n));
          for (const c of rows.slice(0, 250)) {
            const btn = el('button', { class: 'mi', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '3px' } },
              el('span', { class: 'lbl mono', style: { fontSize: '15.5px' }, text: c.n }), el('span', { class: 'sub mono', text: (c.syn && c.syn[0]) || '' }), el('span', { class: 'sub', text: c.d || '' }));
            btn.onclick = () => { Sheet.close(); this.insert(c.t || (c.n.endsWith('()') ? '\\operatorname{' + c.n.slice(0, -2) + '}\\left(#0\\right)' : '\\operatorname{' + c.n + '}\\ ')); };
            L.append(el('li', {}, btn));
          }
          if (!rows.length) L.append(el('li', { class: 'desc', text: 'Nothing matches. Try part of a name like “deriv” or “mat”.' }));
        };
        q.oninput = render; b.append(q, L); render();
      });
    },

    /* ---------------- settings & documents ---------------- */
    async applyCasSettings() {
      const S = this.settings;
      const set = ['angle_radian:=' + (S.angle === 'deg' ? 0 : 1), 'complex_mode:=' + (S.complex === 'real' ? 0 : 1)];
      // the user's own constants are variables in every document
      const names = new Set();
      for (const c of S.userConsts || []) { const g = Library.constGiac(c.value); if (g && /^[A-Za-z]\w*$/.test(c.name)) { set.push(c.name + ':=' + g); this.vars.add(c.name); names.add(c.name); } }
      const gone = [...(this._constNames || [])].filter((x) => !names.has(x));
      if (gone.length) { this.cas.settings = this.cas.settings.filter((x) => !gone.includes(x.split(':=')[0])); gone.forEach((x) => this.vars.delete(x)); set.push('purge(' + gone.join(',') + ')'); }
      this._constNames = names;
      for (const c of set) if (!/^purge\(/.test(c)) this.cas.remember(c, 'setting');
      await this.cas.batch(set).catch(() => {});
    },
    applyTheme() { const t = this.settings.theme; if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); },
    saveSettings() { DB.set('settings', this.settings); },
    rerender() { this.pages.forEach((p) => p.renderAll && p.kind === 'calc' && p.renderAll()); },
    docMenu() {
      Sheet.open('CalcShelf', (b) => {
        const L = el('ul', { class: 'mlist' });
        const item = (label, sub, fn) => L.append(el('li', {}, el('button', { class: 'mi', onclick: fn }, el('span', { class: 'lbl', text: label }), sub ? el('span', { class: 'sub', text: sub }) : null)));
        item('Guide & manuals', 'The CalcShelf user guide, and the manuals of the real calculators', () => { Sheet.close(); this.addPage('guide'); });
        item('Settings', 'Angle, digits, number format (Normal / Sci / Eng), theme', () => Sheet.push('Settings', (bb) => this.settingsUI(bb)));
        item('Constants & formulas', 'CODATA constants and solvable formulas', () => { Sheet.close(); Library.open(this, 'const'); });
        item('Trigonometry & triangle solver', 'Identities, trig formulas, solve any triangle', () => { Sheet.close(); Library.open(this, 'trig'); });
        item('Conversion tool', 'Units, optics calculators, number bases, decibels', () => { Sheet.close(); Library.open(this, 'conv'); });
        const emu = this.pages.find((x) => x.kind === 'emu');
        if (this.settings.multiEmu) item('Add an emulated calculator', 'Opens in a new tab; change a tab’s model from its tab menu', () => this.emuChooser(true, null));
        else item(emu ? 'Replace OS or change calculator' : 'Add an emulated calculator', emu ? 'Now ' + emu.info[2] : 'TI-Nspire CX II CAS, TI-89, TI-92, V200, TI-84 Plus … TI-81, HP 48, HP 49', () => { if (emu) this.select(this.pages.indexOf(emu)); this.emuChooser(true); });
        item('Rename tabs', 'Long-press a tab, or tap the open tab', () => { Sheet.close(); this.renameTab(this.active); });
        item('Back up', 'Save all tabs, variables and history as a .tns.json file', () => { Sheet.close(); UI.download('CalcShelf-' + new Date().toISOString().slice(0, 10) + '.tns.json', JSON.stringify(this.serializeDoc())); });
        item('Restore from backup', 'Replaces the current tabs', () => { Sheet.close(); const f = $('#file-open'); f.onchange = async () => { const file = f.files[0]; f.value = ''; if (!file) return; try { const d = JSON.parse(await file.text()); if (!Array.isArray(d.pages)) throw new Error(); if (!confirm('Replace the current tabs with this backup?')) return; d.id = this.doc.id; await this.openDoc(d); await this.saveNow(); toast('Restored'); } catch (e) { toast('That file isn’t a backup from this app.'); } }; f.click(); });
        b.append(L);
      });
    },
    settingsUI(b) {
      const S = this.settings;
      const seg = (label, key, opts, after) => {
        const row = el('div', { class: 'setrow' }, el('span', { text: label }));
        const g = el('div', { class: 'seg' });
        for (const [v, l] of opts) {
          const btn = el('button', { text: l, class: String(S[key]) === String(v) ? 'on' : '' });
          btn.onclick = () => { S[key] = typeof S[key] === 'number' ? Number(v) : v === 'true' ? true : v === 'false' ? false : v; g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === btn)); this.saveSettings(); if (after) after(); };
          g.append(btn);
        }
        row.append(g); b.append(row);
      };
      seg('Angle', 'angle', [['rad', 'Radian'], ['deg', 'Degree']], () => { this.applyCasSettings(); this.renderTabs(); });
      seg('Calculation mode', 'calc', [['auto', 'Auto'], ['exact', 'Exact'], ['approx', 'Approximate']]);
      seg('Display digits', 'digits', [[6, 'Float 6'], [8, '8'], [10, '10'], [12, '12']]);
      seg('Number format', 'fmt', [['norm', 'Normal'], ['sci', 'Sci'], ['eng', 'Eng']]);
      seg('Decimal under exact answers', 'showDec', [['true', 'On'], ['false', 'Off']], () => this.rerender());
      seg('Digit grouping (1 234 567)', 'group', [['true', 'On'], ['false', 'Off']]);
      seg('New line starts from ans', 'autoAns', [['true', 'On'], ['false', 'Off']]);
      seg('Complex results', 'complex', [['rect', 'a+bi'], ['real', 'Real only']], () => this.applyCasSettings());
      seg('Emulated calculators', 'multiEmu', [['false', 'One tab'], ['true', 'Several, running at once']], () => this.select(this.active));
      b.append(el('p', { class: 'desc', style: { margin: '-2px 2px 10px' }, text: 'With several, each tab is a different model and they all keep running in the background. That uses more battery and memory (the TI-Nspire uses about 330 MB).' }));
      seg('Theme', 'theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], () => this.applyTheme());
      b.append(el('p', { class: 'desc', style: { marginTop: '18px' }, html: 'CAS engine: Giac/Xcas by Bernard Parisse (GPL). 2D math editor: MathLive (MIT). TI-89 Titanium emulation: TiEmu/Graph89 (GPL). This app is free software under the GNU GPL v3. TI-Nspire and TI-89 are trademarks of Texas Instruments; this app contains no TI code.' }));
    },
  };

  root.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init().catch((e) => { console.error(e); toast('Could not start: ' + e.message, 9000); }));
})(typeof self !== 'undefined' ? self : this);
