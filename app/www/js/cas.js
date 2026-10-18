/*
 * cas.js — promise API over the Giac worker. Supports Break: the worker is terminated and
 * restarted, and every definition made so far is replayed so variables survive.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  class CAS {
    constructor(url = 'js/cas-worker.js') {
      this.url = url; this.seq = 1; this.pending = new Map(); this.defs = []; this.settings = [];
      this.busy = 0; this.onBusy = null; this.start();
    }
    async assets() {
      if (!this._assets) this._assets = Promise.all([
        fetch(this.url).then((r) => r.text()),
        fetch('vendor/giac/giac.glue.js').then((r) => r.text()),
        fetch('vendor/giac/giac.wasm').then((r) => r.arrayBuffer()),
      ]);
      return this._assets;
    }
    start() {
      this.ready = new Promise((res, rej) => { this._ready = res; this._fail = rej; });
      this.w = { postMessage: () => {}, terminate: () => {} };
      this.assets().then(([src, glue, wasm]) => {
        this.w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        this.w.onmessage = (e) => this._onmsg(e);
        this.w.onerror = (e) => { console.error('CAS worker', e.message); };
        this.w.postMessage({ op: 'init', glue, wasm: wasm.slice(0) });
      }).catch((e) => this._fail(e));
    }
    _onmsg(e) {
      {
        const m = e.data;
        if (m.id === 0) { if (m.ok) this._ready(); else this._fail(new Error(m.error)); return; }
        const p = this.pending.get(m.id); if (!p) return;
        this.pending.delete(m.id); this._setBusy(-1);
        this.lastPrinted = m.printed || [];
        if (m.ok) p.res(m.full ? m : m.out); else p.rej(new Error(m.error));
      }
    }
    _setBusy(d) { this.busy += d; if (this.onBusy) this.onBusy(this.busy > 0); }
    _send(msg) {
      return this.ready.then(() => new Promise((res, rej) => {
        const id = this.seq++;
        this.pending.set(id, { res, rej }); this._setBusy(1);
        this.w.postMessage({ ...msg, id });
      }));
    }
    eval(code) { return this._send({ op: 'eval', code }); }
    evalFull(code) { return this._send({ op: 'eval', code }).then((out) => ({ out, printed: this.lastPrinted || [] })); }
    batch(codes) { return this._send({ op: 'batch', codes }); }
    reset() { this.defs = []; return this._send({ op: 'reset' }); }
    /** Remember state-changing input so it can be replayed after Break. */
    remember(code, kind = 'def') {
      if (kind === 'setting') { this.settings = this.settings.filter((s) => s.split(':=')[0] !== code.split(':=')[0]); this.settings.push(code); }
      else { this.defs.push(code); if (this.defs.length > 500) this.defs.shift(); }
    }
    forget(name) { this.defs = this.defs.filter((d) => !new RegExp('^\\s*' + name + '\\s*(\\(|:=)').test(d) && !new RegExp('=>\\s*' + name + '\\s*$').test(d)); }
    clearDefs() { this.defs = []; }
    /** Abort a long computation. */
    async breakAndRestart() {
      this.w.terminate();
      for (const p of this.pending.values()) { this._setBusy(-1); p.rej(new Error('Stopped')); }
      this.pending.clear();
      this.start();
      await this.ready;
      await this.batch([...this.settings, ...this.defs]);
    }
  }
  root.CAS = CAS;
})(typeof self !== 'undefined' ? self : this);
