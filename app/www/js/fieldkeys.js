/*
 * fieldkeys.js — the CAS keypad for plain value fields (conversion tool, formula solver, module calculators,
 * triangle solver, tool settings …). While such a field is selected, the phone keyboard stays closed and the CAS
 * keypad and toolbar appear at the bottom of the screen, with a row of fraction and unit keys above them.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast } = UI;

  /** LaTeX that a keypad key inserts → the plain text a value field takes */
  const PLAIN = {
    '\\times ': '*', '\\cdot ': '*', '\\div ': '/', '\\pi ': 'pi', '\\exponentialE ': 'e', '\\exponentialE^{#?}': 'exp(', 'ᴇ': 'e',
    '^{#?}': '^', '^{-1}': '^(-1)', '\\sqrt{#0}': 'sqrt(', '\\sqrt[#?]{#0}': '^(1/', '\\frac{1}{#0}': '1/', '\\left|#0\\right|': 'abs(',
    '\\ln\\left(#0\\right)': 'ln(', '\\log\\left(#0\\right)': 'log10(', '10^{#?}': '10^', '\\degree ': '°', '\\ ': ' ', '\\_': '_', '\\imaginaryI ': 'i',
    '\\mu ': 'µ', '\\Delta ': 'Δ', '\\lambda ': 'λ', '\\alpha ': 'α', '\\beta ': 'β', '\\omega ': 'ω', '\\phi ': 'φ', '\\sigma ': 'σ', '\\theta ': 'θ',
  };
  function texToPlain(t) {
    if (Object.prototype.hasOwnProperty.call(PLAIN, t)) return PLAIN[t];
    const f = t.match(/^\\(sin|cos|tan|sinh|cosh|tanh)(\^\{-1\})?\\left\(#0\\right\)$/);
    if (f) return (f[2] ? 'a' : '') + f[1] + '(';
    return t.replace(/\\operatorname\{(\w+)\}/g, '$1').replace(/\\left\(|\\right\)/g, (m) => (m === '\\left(' ? '(' : ')'))
      .replace(/#[0?@]/g, '').replace(/\\[a-zA-Z]+\s?/g, '').replace(/[{}]/g, '');
  }

  /** a plain input with the small part of the math-field interface the keypad uses */
  class FieldTarget {
    constructor(input) { this.el = input; }
    focus() { try { this.el.focus({ preventScroll: true }); } catch (e) { this.el.focus(); } }
    get value() { return this.el.value; }
    set value(v) { this.el.value = v; this.changed(); }
    changed() { this.el.dispatchEvent(new Event('input', { bubbles: true })); }
    sel() { const i = this.el, n = i.value.length; let a = n, b = n; try { if (i.selectionStart != null) { a = i.selectionStart; b = i.selectionEnd; } } catch (e) { /* no selection */ } return [a, b]; }
    put(a) { try { this.el.setSelectionRange(a, a); } catch (e) { /* no selection */ } }
    ins(t) { const v = this.el.value, [a, b] = this.sel(); this.el.value = v.slice(0, a) + t + v.slice(b); this.put(a + t.length); this.changed(); }
    executeCommand(c) {
      const i = this.el, v = i.value, [a, b] = this.sel();
      if (Array.isArray(c)) { if (c[0] === 'insert') this.ins(texToPlain(c[1])); else if (c[0] === 'typedText') this.ins(c[1]); return; }
      if (c === 'deleteBackward') { if (a !== b) { i.value = v.slice(0, a) + v.slice(b); this.put(a); } else if (a > 0) { i.value = v.slice(0, a - 1) + v.slice(a); this.put(a - 1); } this.changed(); }
      else if (c === 'moveToPreviousChar') this.put(Math.max(0, a - 1));
      else if (c === 'moveToNextChar') this.put(Math.min(v.length, b + 1));
    }
  }

  /** fields that take the CAS keypad: number fields, and the value fields of solvers and module calculators */
  const isValueField = (x) => x && x.tagName === 'INPUT' && !x.disabled && !x.readOnly && x.type !== 'search' && x.type !== 'file' && x.type !== 'radio' && x.type !== 'checkbox' &&
    (x.dataset.kp === '1' || x.getAttribute('inputmode') === 'decimal' || (x.dataset.im && x.getAttribute('inputmode') === 'none'));
  const usesOSKeyboard = (x) => x.dataset.oskb === '1';

  const FieldKeys = {
    app: null, field: null, row: null, prevTarget: null,
    init(app) {
      this.app = app;
      // keep the phone keyboard closed: the field gets inputmode=none before it takes the focus
      const quiet = (x) => { if (!isValueField(x) || usesOSKeyboard(x)) return; if (!x.dataset.im) x.dataset.im = x.getAttribute('inputmode') || 'text'; x.setAttribute('inputmode', 'none'); };
      document.addEventListener('pointerdown', (e) => {
        const x = e.target;
        if (isValueField(x)) { quiet(x); return; }
        if (this.field && !x.closest('#kp, #strip, .fkrow, .kpop')) this.off();
      }, true);
      document.addEventListener('focusin', (e) => {
        const x = e.target;
        if (isValueField(x) && !usesOSKeyboard(x)) { quiet(x); this.on(x); }
        else if (this.field && x !== this.field.el && !x.closest('#kp, #strip, .fkrow')) this.off();
      });
      window.addEventListener('resize', () => { if (this.field) this.layout(); });
    },
    on(input) {
      if (this.field && this.field.el === input) return;
      const app = this.app;
      if (!this.field) this.prevTarget = app.target;
      this.field = new FieldTarget(input);
      app.target = this.field;
      document.body.classList.add('fieldkeys');
      for (const id of ['strip', 'kp']) { const n = document.getElementById(id); n.dataset.wasHidden = n.hidden ? '1' : ''; n.hidden = false; }
      this.buildRow(input.dataset.units === '1');
      this.layout();
      setTimeout(() => { try { input.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }, 60);
    },
    off() {
      if (!this.field) return;
      const app = this.app, input = this.field.el;
      this.field = null;
      document.body.classList.remove('fieldkeys');
      for (const id of ['strip', 'kp']) { const n = document.getElementById(id); n.hidden = n.dataset.wasHidden === '1'; }
      if (this.row) this.row.hidden = true;
      const p = app.page; app.target = (p && p.target) || (this.prevTarget instanceof FieldTarget ? null : this.prevTarget);
      try { input.blur(); } catch (e) { /* ignore */ }
    },
    /** keypad and toolbar heights, so sheets and pages end above them */
    layout() {
      const kp = document.getElementById('kp'), st = document.getElementById('strip');
      const h = (kp.offsetHeight || 0), s = (st.offsetHeight || 0), r = this.row && !this.row.hidden ? this.row.offsetHeight : 0;
      const b = document.body.style;
      b.setProperty('--kph', h + 'px'); b.setProperty('--sth', s + 'px'); b.setProperty('--fkh', (h + s + r) + 'px');
    },
    buildRow(units) {
      if (!this.row) { this.row = el('div', { class: 'fkrow' }); document.body.append(this.row); }
      const R = this.row; R.innerHTML = ''; R.hidden = false;
      const key = (label, fn, cls, title) => {
        const k = el('button', { class: 'fk' + (cls ? ' ' + cls : ''), text: label, type: 'button', tabindex: '-1', 'aria-label': title || label });
        k.addEventListener('mousedown', (e) => e.preventDefault());
        k.addEventListener('click', (e) => { e.preventDefault(); if (this.app.settings.haptic) UI.haptic(); fn(); });
        R.append(k);
      };
      const ins = (t) => { if (this.field) { this.field.focus(); this.field.ins(t); } };
      key('/', () => ins('/'), 'fk-op', 'fraction bar'); key('␣', () => ins(' '), 'fk-op', 'space');
      if (units) for (const u of ['in', '"', 'ft', 'mm']) key(u, () => { const v = this.field ? this.field.el.value : ''; ins(u === '"' ? '"' : (!v || /\s$/.test(v) ? '' : ' ') + u); }, 'fk-unit', u === '"' ? 'inches' : u);
      key('⌨', () => this.osKeyboard(), 'fk-os', 'Use the phone keyboard');
      key('done', () => this.done(false), 'fk-done', 'Done');
    },
    /** the phone keyboard for this field instead */
    osKeyboard() {
      const f = this.field; if (!f) return;
      const x = f.el; x.dataset.oskb = '1'; x.setAttribute('inputmode', x.dataset.im === 'decimal' ? 'decimal' : 'text');
      this.off(); setTimeout(() => x.focus(), 60);
    },
    /** enter: the field's own Enter action if it has one, else the next field, else the form's main button */
    done(next) {
      const f = this.field; if (!f) return;
      const x = f.el;
      const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      x.dispatchEvent(ev); x.dispatchEvent(new Event('change', { bubbles: true }));
      if (ev.defaultPrevented) { if (!next) this.off(); return; }
      const box = x.closest('#sheet-body, .page') || document.body;
      const all = [...box.querySelectorAll('input')].filter((y) => isValueField(y) && y.offsetParent !== null);
      const nx = all[all.indexOf(x) + 1];
      if (nx) { nx.focus(); return; }
      if (next) return;
      this.off();
      const btn = box.querySelector('.btn.pri'); if (btn) btn.click();
    },
    /** a keypad action while a value field is selected; returns true when handled here */
    action(a) {
      const f = this.field; if (!f) return false;
      switch (a) {
        case 'enter': case 'approx': this.done(false); return true;
        case 'tab': this.done(true); return true;
        case 'esc': this.off(); return true;
        case 'popen': f.focus(); f.ins('('); return true;
        case 'pclose': f.focus(); f.ins(')'); return true;
        case 'ans': { const v = this.app.lastAns; const n = v != null && isFinite(Number(v)) ? String(+Number(v).toPrecision(12)) : null; if (n) { f.focus(); f.ins(n); } else toast('The last answer isn’t a number'); return true; }
        case 'left': case 'right': case 'del': case 'shift': case 'abcpage': return false;
        default: toast('Not available while typing a value: tap done first'); return true;
      }
    },
  };
  root.FieldKeys = FieldKeys; root.texToPlain = texToPlain;
})(typeof self !== 'undefined' ? self : this);
