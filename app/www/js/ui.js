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
      // a keypad key opens a sheet on pointerup; the tap's own click then lands on whatever the new sheet shows
      // under the finger (the units key picked “fm”). So a sheet a keypad key opens ignores clicks for a moment.
      if (!opts.push) this.openedAt = Date.now() - (this.keyTap || 0) < 120 ? Date.now() : 0;
      if (!this._guard) { this._guard = true; $('#sheet').addEventListener('click', (e) => { if (Date.now() - (this.openedAt || 0) < 450) { e.stopPropagation(); e.preventDefault(); } }, true); }
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
     · ( at the end inserts a pair, elsewhere just a (; ) at the end closes the last open ( at its own level */
  const Edit = {
    empty(mf) { return !String(mf.value || '').replace(/\\placeholder\{\}/g, '').trim(); },
    put(mf, tex, sel) { mf.executeCommand(['insert', tex, { format: 'latex', insertionMode: 'replaceSelection', selectionMode: sel || 'placeholder', focus: true }]); },
    autoAns(mf, ansTex) { if (!ansTex || !Edit.empty(mf)) return false; mf.value = ''; Edit.put(mf, ansTex, 'after'); return true; },
    /** the cursor is at the end of the field (nothing after it on the line) */
    atEnd(mf) { return mf.position >= mf.lastOffset; },
    /** the cursor is at the end of the group it is in (a fraction part, an exponent, the inside of ( ) …) */
    atGroupEnd(mf) { const p = mf.position; mf.executeCommand('moveToGroupEnd'); const q = mf.position; mf.position = p; return q === p; },
    /** ( : on an empty line or at the end, a pair with the cursor inside; anywhere else, just the ( */
    open(mf) {
      if (Edit.empty(mf) || Edit.atEnd(mf)) { Edit.put(mf, '\\left(#0\\right)'); return; }
      Edit.plain(mf, '(');
    },
    /** a lone ( or ) as typed: MathLive's smart fence would otherwise pair it with a hidden ) to the end of the line */
    plain(mf, ch) { const sf = mf.smartFence; try { mf.smartFence = false; Edit.put(mf, ch, 'after'); } finally { mf.smartFence = sf; } },
    /** ) : at the end of a ( ) pair's contents, step out of it; otherwise close the last ( before the cursor that
     *  nothing closes, at that ('s own level, as one matching pair; with none open, just a ) */
    close(mf) {
      if (!Edit.empty(mf) && Edit.atGroupEnd(mf) && !Edit.atEnd(mf)) {
        const p = mf.position; mf.executeCommand('moveAfterParent');
        if (mf.position !== p && /\\right[).]$/.test(mf.getValue(0, mf.position, 'latex'))) {
          const before = mf.getValue(0, mf.position, 'latex');
          if (/\\right\.$/.test(before)) { const at = mf.position, after = mf.getValue(at, mf.lastOffset, 'latex'); mf.value = before.slice(0, -7) + '\\right)' + after; mf.position = at; }
          return;
        }
        mf.position = p;
      }
      if (Edit.empty(mf)) { Edit.plain(mf, ')'); return; }
      // find the cursor in the LaTeX with a marker, close the last open ( before it, and put the cursor after the )
      const MK = '\\mathrm{QQ}';
      Edit.plain(mf, MK);
      const withMk = mf.value, cur = withMk.indexOf(MK);
      const tex = withMk.slice(0, cur) + withMk.slice(cur + MK.length);
      const r = cur >= 0 ? Edit.closeLast(tex, cur) : null;
      if (!r) { mf.value = tex; Edit.caret(mf, withMk, MK); Edit.plain(mf, ')'); return; }
      mf.value = r.tex.slice(0, r.caret) + MK + r.tex.slice(r.caret);
      Edit.caret(mf, mf.value, MK, r.tex);
    },
    /** put the cursor where MK is in `marked`, then show `clean` (or `marked` without MK) */
    caret(mf, marked, MK, clean) {
      if (mf.value !== marked) mf.value = marked;
      let at = 0;
      for (let p = 0; p <= mf.lastOffset; p++) { if (mf.getValue(0, p, 'latex').includes('Q')) { at = p; break; } }
      mf.value = clean != null ? clean : marked.replace(MK, '');
      mf.position = Math.max(0, Math.min(mf.lastOffset, at - 1));
    },
    /** the last ( before `cur` (a LaTeX index) that nothing closes, closed as one \left( … \right) pair at that ('s own
     *  level: at the cursor when it is in the same group, after the structure that holds the cursor when it is deeper,
     *  or where the ('s group ends when that is before the cursor. Returns { tex, caret } or null. */
    closeLast(tex, cur) {
      if (cur == null) cur = tex.length;
      const tok = /\\left\s*\(|\\left\s*\\?[^\s\\]|\\right\s*\.|\\right\s*\\?[^\s\\]|\\[A-Za-z]+|\\.|[{}()]/g;
      const toks = []; let m;
      while ((m = tok.exec(tex))) toks.push({ t: m[0], at: m.index, end: m.index + m[0].length });
      const isOpen = (t) => t === '{' || /^\\left/.test(t), isClose = (t) => t === '}' || /^\\right/.test(t);
      const root = { opens: [], parent: null, end: tex.length };
      let fr = root, chainAtCur = null;
      const unmatched = [];
      for (const k of toks) {
        if (!chainAtCur && k.at >= cur) chainAtCur = fr;
        if (isOpen(k.t)) { const f = { opens: [], parent: fr, start: k.end, fence: /^\\left\s*\($/.test(k.t) ? k : null }; fr = f; }
        else if (isClose(k.t)) {
          fr.end = k.at;
          for (const o of fr.opens) unmatched.push(Object.assign(o, { frame: fr }));
          if (fr.fence && /^\\right\s*\.$/.test(k.t) && fr.fence.at < cur) unmatched.push({ at: fr.fence.at, len: fr.fence.t.length, frame: fr, repair: k });
          fr = fr.parent || root;
        }
        else if (k.t === '(') fr.opens.push({ at: k.at, len: 1 });
        else if (k.t === ')') fr.opens.pop();
      }
      if (!chainAtCur) chainAtCur = fr;
      for (let f = fr; f; f = f.parent) for (const o of f.opens) unmatched.push(Object.assign(o, { frame: f }));
      const cand = unmatched.filter((o) => o.at < cur).sort((a, b) => b.at - a.at)[0];
      if (!cand) return null;
      if (cand.repair) {                                                // a \left( whose ) was deleted: put it back
        const out = tex.slice(0, cand.repair.at) + '\\right)' + tex.slice(cand.repair.end);
        return { tex: out, caret: cur };
      }
      // where the ) goes
      let ins;
      const chain = []; for (let f = chainAtCur; f; f = f.parent) chain.push(f);
      const depth = chain.indexOf(cand.frame);
      if (depth < 0) ins = cand.frame.end;                              // its group ended before the cursor
      else if (depth === 0) ins = cur;                                  // same group as the cursor
      else {                                                            // the cursor is deeper: after the structure holding it
        let d = depth; ins = tex.length;
        for (const k of toks) {
          if (k.at < cur) continue;
          if (isOpen(k.t)) d++;
          else if (isClose(k.t)) {
            d--;
            if (d < 0) { ins = k.at; break; }
            if (d === 0) { const rest = tex.slice(k.end).replace(/^\s+/, ''); if (!/^[{[^_]/.test(rest)) { ins = k.end; break; } }
          }
        }
      }
      const a = cand.at, L = cand.len;
      const out = tex.slice(0, a) + '\\left(' + tex.slice(a + L, ins) + '\\right)' + tex.slice(ins);
      // the cursor goes after the new ), or stays where it was when the ) went into an earlier group
      return { tex: out, caret: ins <= cur && depth < 0 ? cur + (6 - L) + 7 : ins + (6 - L) + 7 };
    },
    /** the same rules for a hardware or phone keyboard; getAns() returns the answer's LaTeX or null */
    bind(mf, getAns) {
      // capture phase on the host runs before MathLive's own key handling (which turns * into \cdot)
      mf.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
        if (e.key === '(' || e.key === ')') { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === '(') Edit.open(mf); else Edit.close(mf); return; }
        if ('+*/^!'.includes(e.key)) Edit.autoAns(mf, getAns());
      }, true);
      mf.addEventListener('beforeinput', (e) => {
        if (e.inputType !== 'insertText' || !e.data) return;
        if (e.data === '(') { e.preventDefault(); Edit.open(mf); }
        else if (e.data === ')') { e.preventDefault(); Edit.close(mf); }
        else if ('+*/^!²×÷'.includes(e.data)) Edit.autoAns(mf, getAns());
      });
    },
  };
  root.UI = { $, el, DB, toast, Sheet, texHTML, renderTex, mathField, setOSKeyboard, download, haptic, Edit };
})(typeof self !== 'undefined' ? self : this);
