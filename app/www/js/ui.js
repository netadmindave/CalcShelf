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
    // LaTeX can come from a backup or a file someone else made: drop the commands that style or tag HTML
    tex = String(tex).replace(/\\(?:htmlData|htmlStyle|style|class|cssId|htmlId)\s*\{[^{}]*\}/g, '').replace(/\\(?:href|url)\s*\{[^{}]*\}/g, '');
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
        const before = mf.getValue(0, mf.position, 'latex');
        if (/\\right\)$/.test(before)) return;                                    // stepped out of a ( … )
        if (/\\left\(/.test(before) && /\\right\.$/.test(before)) {                 // a ( whose ) was deleted: close it again
          const at = mf.position, after = mf.getValue(at, mf.lastOffset, 'latex');
          mf.value = before.slice(0, -7) + '\\right)' + after; mf.position = at; return;
        }
      }
      mf.position = pos0;
      if (Edit.empty(mf)) { Edit.open(mf); return; }
      // a plain ( still open before the cursor (typed or pasted): just add its )
      const bare = mf.getValue(0, pos0, 'latex').replace(/\\(left|right|big|Big|bigg|Bigg)[lr]?\s*[()]/g, '');
      if ((bare.match(/\(/g) || []).length > (bare.match(/\)/g) || []).length) { Edit.put(mf, ')', 'after'); return; }
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
  /* A key bar above the phone's number keyboard, which has no / key: it appears while a number field
     (inputmode="decimal") has focus, for fractions (3/8, 1 3/8) and, in the conversion tool, units (3/8 in). */
  const FracBar = (() => {
    let bar = null, target = null, hideT = null;
    const insert = (t) => {
      const i = target; if (!i) return;
      const v = i.value, a = i.selectionStart ?? v.length, b = i.selectionEnd ?? v.length;
      i.value = v.slice(0, a) + t + v.slice(b);
      try { i.setSelectionRange(a + t.length, a + t.length); } catch (e) { /* some inputs have no selection */ }
      i.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const key = (label, fn, cls) => {
      const k = el('button', { class: 'fb-key' + (cls ? ' ' + cls : ''), text: label, type: 'button', tabindex: '-1' });
      // keep the focus (and the keyboard) on the field
      k.addEventListener('mousedown', (e) => e.preventDefault());
      k.addEventListener('touchend', (e) => { e.preventDefault(); fn(); });
      k.addEventListener('click', fn);
      return k;
    };
    const place = () => {
      if (!bar || bar.hidden) return;
      const vv = window.visualViewport;
      const off = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      bar.style.bottom = off + 'px';
    };
    const build = (withUnits) => {
      bar.innerHTML = '';
      bar.append(key('/', () => insert('/')), key('␣', () => insert(' ')), key('−', () => insert('-')));
      if (withUnits) for (const u of ['in', '"', 'ft', 'mm']) bar.append(key(u, () => insert(u === '"' ? '"' : (/\s$/.test(target.value) || !target.value ? '' : ' ') + u), 'fb-unit'));
      bar.append(key('abc', () => { const i = target; i.setAttribute('inputmode', 'text'); i.blur(); setTimeout(() => i.focus(), 50); }, 'fb-abc'));
    };
    function show(i) {
      if (!bar) { bar = el('div', { class: 'frac-bar', hidden: true }); document.body.append(bar); if (window.visualViewport) { visualViewport.addEventListener('resize', place); visualViewport.addEventListener('scroll', place); } }
      clearTimeout(hideT); target = i; build(i.dataset.units === '1'); bar.hidden = false; place();
    }
    function hide() { hideT = setTimeout(() => { if (bar && !(document.activeElement && document.activeElement.getAttribute('inputmode') === 'decimal')) { bar.hidden = true; target = null; } }, 120); }
    document.addEventListener('focusin', (e) => { const i = e.target; if (i && i.tagName === 'INPUT' && i.getAttribute('inputmode') === 'decimal') show(i); else if (bar) { bar.hidden = true; target = null; } });
    document.addEventListener('focusout', (e) => { if (e.target === target) hide(); });
    return { show, insert };
  })();
  root.UI = { $, el, DB, toast, Sheet, texHTML, renderTex, mathField, setOSKeyboard, download, haptic, Edit, FracBar };
})(typeof self !== 'undefined' ? self : this);
