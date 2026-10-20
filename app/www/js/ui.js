/*
 * ui.js — shared helpers: DOM, storage, bottom sheets, toasts, math rendering, math fields.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  function el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }

  /* ---------------- storage (IndexedDB key-value) ---------------- */
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        let r; try { r = indexedDB.open('castouch', 1); } catch (e) { return res(null); }
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => res(null);
      });
    },
    get(k) { return new Promise((res) => { if (!this.db) return res(undefined); try { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
    set(k, v) { return new Promise((res) => { if (!this.db) return res(false); try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); },
    del(k) { return new Promise((res) => { if (!this.db) return res(); try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); } catch (e) { res(); } }); },
  };

  /* ---------------- toast ---------------- */
  let tt = 0;
  function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, ms); }

  /* ---------------- bottom sheet with a navigation stack ---------------- */
  const Sheet = {
    stack: [], onClose: null,
    open(title, build, opts = {}) {
      if (!opts.push) this.stack = [];
      this.stack.push({ title, build });
      this.render();
      $('#scrim').hidden = false; $('#sheet').hidden = false;
      if (opts.onClose) this.onClose = opts.onClose;
    },
    push(title, build) { this.open(title, build, { push: true }); },
    back() { if (this.stack.length > 1) { this.stack.pop(); this.render(); } else this.close(); },
    render() {
      const top = this.stack[this.stack.length - 1];
      $('#sheet-title').textContent = top.title;
      $('#sheet-back').hidden = this.stack.length < 2;
      const body = $('#sheet-body'); body.innerHTML = ''; body.scrollTop = 0;
      top.build(body);
    },
    close() {
      $('#scrim').hidden = true; $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; this.stack = [];
      const f = this.onClose; this.onClose = null; if (f) f();
    },
    get isOpen() { return !$('#sheet').hidden; },
  };

  /* ---------------- math rendering ---------------- */
  function texHTML(tex) {
    try { return MathLive.convertLatexToMarkup(tex, { defaultMode: 'math' }); } catch (e) { return el('span', { text: tex }).outerHTML; }
  }
  function renderTex(node, tex) { node.innerHTML = texHTML(tex); return node; }

  /* A math field that takes input from our keypad, not the phone keyboard (unless asked). */
  try { MathfieldElement.soundsDirectory = null; MathfieldElement.plonkSound = null; MathfieldElement.keypressSound = null; } catch (e) { /* older MathLive */ }
  function mathField(opts = {}) {
    const mf = new MathfieldElement();
    mf.setAttribute('math-virtual-keyboard-policy', 'manual');
    mf.setAttribute('smart-fence', 'on');
    if (opts.placeholder) mf.setAttribute('placeholder', opts.placeholder);
    if (opts.value) mf.textContent = opts.value;      // initial value, read when mounted
    const setup = () => {
      try {
        mf.mathVirtualKeyboardPolicy = 'manual';
        mf.smartFence = true; mf.smartSuperscript = true;
        mf.popoverPolicy = 'off';
        mf.menuItems = [];
        mf.inlineShortcutTimeout = 0;
      } catch (e) { /* older/newer MathLive */ }
      setOSKeyboard(mf, false);
    };
    mf.addEventListener('mount', setup, { once: true });
    mf.addEventListener('focusin', () => { if (root.App) root.App.setTarget(mf); setOSKeyboard(mf, !!root.App && root.App.osKeyboard); });
    return mf;
  }
  function setOSKeyboard(mf, on) {
    try {
      const sink = mf.shadowRoot && (mf.shadowRoot.querySelector('[part=keyboard-sink]') || mf.shadowRoot.querySelector('.ML__keyboard-sink') || mf.shadowRoot.querySelector('textarea'));
      if (sink) sink.setAttribute('inputmode', on ? 'text' : 'none');
    } catch (e) { /* ignore */ }
  }

  function download(name, text, mime = 'application/json') {
    const bridge = root.TiBridge;
    if (bridge && bridge.saveFile) { const b64 = btoa(unescape(encodeURIComponent(text))); toast(bridge.saveFile(name, b64, mime) || 'Saved'); return; }
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  /** save binary data given as base64 (an image, say) */
  function downloadB64(name, b64, mime) {
    const bridge = root.TiBridge;
    if (bridge && bridge.saveFile) { toast(bridge.saveFile(name, b64, mime) || 'Saved'); return; }
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const a = el('a', { href: URL.createObjectURL(new Blob([u8], { type: mime })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  /** a short message with an Undo button (5 s) */
  function undoBar(msg, undo) {
    document.querySelectorAll('.undo-bar').forEach((x) => x.remove());
    const b = el('div', { class: 'undo-bar', role: 'status' }, el('span', { text: msg }), el('button', { text: 'Undo', onclick: () => { b.remove(); undo(); } }));
    document.body.append(b); setTimeout(() => b.remove(), 5000);
  }
  function haptic() { /* key vibration was removed in 2.7 */ }


  /* TI-style editing shared by the CAS and TI-36X pages:
     · an operator pressed on an empty line starts from the previous answer (ans+, ans², ans→ …)
     · ( always inserts a pair; ) leaves the enclosing ( ), or, with none open, wraps what is before the cursor */
  const Edit = {
    empty(mf) { return !String(mf.value || '').replace(/\\placeholder\{\}/g, '').trim(); },
    put(mf, tex, sel) { mf.executeCommand(['insert', tex, { format: 'latex', insertionMode: 'replaceSelection', selectionMode: sel || 'placeholder', focus: true }]); },
    autoAns(mf, ansTex) { if (!ansTex || !Edit.empty(mf)) return false; mf.value = ''; Edit.put(mf, ansTex, 'after'); return true; },
    open(mf) { Edit.put(mf, '\\left(#0\\right)'); },
    close(mf) {
      const pos0 = mf.position;
      for (let k = 0; k < 16; k++) {
        const p = mf.position; mf.executeCommand('moveAfterParent');
        if (mf.position === p) break;
        if (/\\right\)$/.test(mf.getValue(0, mf.position, 'latex'))) return;      // stepped out of a ( … )
      }
      mf.position = pos0;
      if (Edit.empty(mf)) { Edit.open(mf); return; }
      mf.executeCommand('extendToGroupStart');                                      // no ( open: wrap from the start
      Edit.put(mf, '\\left(#0\\right)', 'after');
    },
    /** the same rules for a hardware or phone keyboard; getAns() returns the answer's LaTeX or null */
    bind(mf, getAns) {
      // capture phase on the host runs before MathLive's own key handling (which turns * into \cdot)
      mf.addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey && '+*/^!'.includes(e.key) && e.key.length === 1) Edit.autoAns(mf, getAns()); }, true);
      mf.addEventListener('beforeinput', (e) => {
        if (e.inputType !== 'insertText' || !e.data) return;
        if (e.data === '(') { e.preventDefault(); Edit.open(mf); }
        else if (e.data === ')') { e.preventDefault(); Edit.close(mf); }
        else if ('+*/^!²×÷'.includes(e.data)) Edit.autoAns(mf, getAns());
      });
    },
  };
  root.UI = { $, el, DB, toast, Sheet, texHTML, renderTex, mathField, setOSKeyboard, download, downloadB64, undoBar, haptic, Edit };
})(typeof self !== 'undefined' ? self : this);
