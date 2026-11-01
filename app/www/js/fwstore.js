/*
 * fwstore.js — a copy of every calculator firmware file you load (OS file, ROM dump, Nspire system files), kept in the
 * app's own storage. Choosing a new file for a model replaces its copy. Backups include these copies, and restoring a
 * backup installs them again in each calculator. The files never leave the phone except in a backup you save.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { DB } = UI;
  const IDX = 'fw:index', PEND = 'fw:pending';
  const fileKey = (k, slot) => 'fw:file:' + k + ':' + slot;

  function toB64(u8) {
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function fromB64(b64) { const s = atob(b64), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }

  // writes run one at a time: several files arrive together (the Nspire system files) and each rewrites the index
  let queue = Promise.resolve();
  const serial = (fn) => (queue = queue.then(fn, fn));

  const FwStore = {
    key: (fam, model) => fam + ':' + model,
    async index() { return (await DB.get(IDX)) || {}; },
    /** keep a copy of a firmware file; a file of the same kind (or, for one-file models, any file) is replaced */
    put(fam, model, f) { return serial(() => this._put(fam, model, f)); },
    async _put(fam, model, f) {
      if (!f || !f.bytes || !f.bytes.length) return;
      const k = this.key(fam, model), idx = await this.index();
      const e = idx[k] || { fam, model, files: [] };
      const slot = f.kind || 'main';
      if (!f.kind) { for (const x of e.files) await DB.del(fileKey(k, x.slot)); e.files = []; }
      e.files = e.files.filter((x) => x.slot !== slot);
      const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
      await DB.set(fileKey(k, slot), bytes);
      e.files.push({ slot, name: String(f.name || 'firmware'), kind: f.kind || '', size: bytes.length, date: Date.now() });
      idx[k] = e; await DB.set(IDX, idx);
    },
    async files(k) {
      const e = (await this.index())[k]; if (!e) return [];
      const out = [];
      for (const x of e.files) { const b = await DB.get(fileKey(k, x.slot)); if (b) out.push({ ...x, bytes: b }); }
      return out;
    },
    remove(k) { return serial(() => this._remove(k)); },
    async _remove(k) { const idx = await this.index(); const e = idx[k]; if (!e) return; for (const x of e.files) await DB.del(fileKey(k, x.slot)); delete idx[k]; await DB.set(IDX, idx); },
    async totalSize() { return Object.values(await this.index()).reduce((t, e) => t + e.files.reduce((a, x) => a + x.size, 0), 0); },
    /** for a backup: every stored file, base64 */
    async exportAll() {
      const out = [];
      for (const [k, e] of Object.entries(await this.index())) for (const f of await this.files(k)) out.push({ fam: e.fam, model: e.model, name: f.name, kind: f.kind, b64: toB64(f.bytes) });
      return out;
    },
    /** from a backup: replace the stored copies, and mark each model to have its firmware installed again */
    async importAll(list) {
      if (!Array.isArray(list) || !list.length) return 0;
      const keys = new Set(); let n = 0;
      for (const f of list) {
        if (!f || typeof f.fam !== 'string' || typeof f.model !== 'string' || typeof f.b64 !== 'string') continue;
        const k = this.key(f.fam, f.model);
        if (!keys.has(k)) { await this.remove(k); keys.add(k); }
        await this.put(f.fam, f.model, { name: f.name, kind: f.kind || '', bytes: fromB64(f.b64) }); n++;
      }
      const pend = new Set((await DB.get(PEND)) || []); keys.forEach((k) => pend.add(k)); await DB.set(PEND, [...pend]);
      return n;
    },
    /** install a restored model's firmware when its calculator page is ready */
    async installPending(page) {
      if (!page || !page.frame) return;
      const k = this.key(page.fam, page.model), pend = (await DB.get(PEND)) || [];
      if (!pend.includes(k)) return;
      await DB.set(PEND, pend.filter((x) => x !== k));
      const files = await this.files(k);
      for (const f of files) page.frame.contentWindow.postMessage({ type: 'emu-install', name: f.name, bytes: f.bytes }, location.origin);
      if (files.length) UI.toast('Installing the firmware from the backup in the ' + page.defaultName, 3500);
    },
    /** once: copy the firmware that calculators installed before 2.7.6 (kept only in each emulator's own storage) */
    async migrate(models) {
      if (await DB.get('fw:migrated')) return;
      let names = [];
      try { names = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []; } catch (e) { return; }
      const readAll = (db, keys) => new Promise((res) => {
        if (!names.includes(db)) return res({});
        const r = indexedDB.open(db);            // no version: opens the existing database without changing it
        r.onerror = () => res({});
        r.onsuccess = () => {
          const d = r.result, out = {};
          if (!d.objectStoreNames.contains('kv')) { d.close(); return res({}); }
          const t = d.transaction('kv'), s = t.objectStore('kv');
          for (const k of keys) { const q = s.get(k); q.onsuccess = () => { if (q.result) out[k] = q.result; }; }
          t.oncomplete = () => { d.close(); res(out); }; t.onerror = () => { d.close(); res(out); };
        };
      });
      const idx = await this.index(), has = (fam, model) => !!idx[this.key(fam, model)];
      const u8 = (v) => (v instanceof Uint8Array ? v : v && v.buffer ? new Uint8Array(v.buffer || v) : null);
      const t68 = models.filter((m) => m[0] === 'ti68k').map((m) => m[1]);
      const a = await readAll('ti89touch', t68.map((m) => (m === '89' ? 'img' : m + ':img')));
      for (const m of t68) { const b = u8(a[m === '89' ? 'img' : m + ':img']); if (b && !has('ti68k', m)) await this.put('ti68k', m, { name: m + '.img', bytes: b }); }
      const z = models.filter((m) => m[0] === 'z80').map((m) => m[1]);
      const c = await readAll('classictouch', z.map((m) => 'rom:' + m));
      for (const m of z) { const b = u8(c['rom:' + m]); if (b && !has('z80', m)) await this.put('z80', m, { name: m + '.rom', bytes: b }); }
      const kinds = ['boot1', 'manuf', 'btldr', 'instl', 'diags', 'os'];
      const n = await readAll('nspiretouch', kinds.map((k) => 'fw:' + k));
      if (!has('nspire', 'cx2cas')) for (const k of kinds) { const b = u8(n['fw:' + k]); if (b) await this.put('nspire', 'cx2cas', { name: k + (k === 'os' ? '.tcc2' : '.img'), kind: k, bytes: b }); }
      await DB.set('fw:migrated', true);
    },
    toB64, fromB64,
  };
  root.FwStore = FwStore;
})(typeof self !== 'undefined' ? self : this);
