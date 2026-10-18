/*
 * notes.js — Notes page: text blocks and live math boxes (evaluated like the Nspire's).
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, renderTex, mathField } = UI;

  class NotesPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'notes'; this.title = 'Notes';
      this.blocks = state.blocks || [{ t: 'text', v: '' }];
      this.root = el('div', { class: 'page notes' });
      this.body = el('div', { style: { flex: '1', overflowY: 'auto', padding: '10px 14px 40px' } });
      this.root.append(this.body);
      this.focusMf = null;
      this.render();
    }
    get target() { return this.focusMf; }
    serialize() { return { blocks: this.blocks.map((b) => ({ t: b.t, v: b.v, out: b.out })) }; }
    menu() {
      return [
        ['Insert math box', () => this.add('math')],
        ['Insert text', () => this.add('text')],
        ['Evaluate all math boxes', () => this.evalAll()],
        ['Clear page', () => { this.blocks = [{ t: 'text', v: '' }]; this.render(); this.app.saveSoon(); }],
      ];
    }
    add(t) { this.blocks.push({ t, v: '' }); this.render(); const last = this.body.lastChild; const f = last && last.querySelector('math-field,textarea'); if (f) f.focus(); this.app.saveSoon(); }
    render() {
      this.body.innerHTML = '';
      this.blocks.forEach((b, i) => {
        if (b.t === 'text') {
          const ta = el('textarea', { placeholder: i === 0 ? 'Write notes here. Use menu → Insert math box for live math.' : 'Text', style: { width: '100%', border: '0', background: 'transparent', color: 'var(--ink)', font: '17px/1.5 var(--font)', resize: 'none', minHeight: '2.4em', outline: 'none' } });
          ta.value = b.v || '';
          const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
          ta.oninput = () => { b.v = ta.value; fit(); this.app.saveSoon(); };
          setTimeout(fit, 0);
          this.body.append(ta);
        } else {
          const mf = mathField({ value: b.v || '' });
          const out = el('div', { style: { marginLeft: 'auto', fontSize: '19px' } });
          if (b.out) renderTex(out, b.out);
          const box = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', border: '1.5px solid var(--line)', borderRadius: '10px', padding: '6px 10px', margin: '6px 0', background: 'var(--card)', flexWrap: 'wrap' } }, mf, el('span', { text: '▸', style: { color: 'var(--ink3)' } }), out);
          mf.style.flex = '1';
          mf.addEventListener('focusin', () => { this.focusMf = mf; this.app.setTarget(mf); this.cur = { b, mf, out }; });
          mf.addEventListener('input', () => { b.v = mf.value; this.app.saveSoon(); });
          mf.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.evalBox(b, mf, out); } });
          this.body.append(box);
        }
      });
    }
    async evalBox(b, mf, out, approx) {
      b.v = mf.value; if (!b.v.trim()) return;
      const r = await Calculator.evaluate(this.app, b.v, { approx });
      b.out = r.ok ? r.tex : '\\text{' + (r.error || 'Error').replace(/[{}\\]/g, '') + '}';
      renderTex(out, b.out); this.app.saveSoon();
    }
    async evalAll() { const boxes = this.body.querySelectorAll('math-field'); let k = 0; for (const b of this.blocks) if (b.t === 'math') { const mf = boxes[k++]; const out = mf.parentElement.lastChild; await this.evalBox(b, mf, out); } }
    enter(approx) { if (this.cur) this.evalBox(this.cur.b, this.cur.mf, this.cur.out, approx); else this.add('math'); }
  }
  root.Notes = { NotesPage };
})(typeof self !== 'undefined' ? self : this);
