/*
 * programs.js — TI-Basic Program Editor (Func…EndFunc / Prgm…EndPrgm), stored through
 * Giac's TI compatibility mode and callable from the Calculator.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast } = UI;
  const SAMPLE = 'Local a,b,k\n0→a\n1→b\nFor k,1,n\n  a+b→b\n  b-a→a\nEndFor\nReturn a';

  class ProgramPage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'prog'; this.title = 'Program Editor'; this.noKeypad = true;
      this.root = el('div', { class: 'page prog', style: { padding: '10px 12px', gap: '8px', overflowY: 'auto' } });
      this.name = el('input', { class: 'search', value: state.name || 'fib', placeholder: 'name', autocapitalize: 'off', spellcheck: 'false', style: { margin: 0, flex: 1 } });
      this.args = el('input', { class: 'search', value: state.args ?? 'n', placeholder: 'arguments, e.g. x,y', autocapitalize: 'off', spellcheck: 'false', style: { margin: 0, flex: 1 } });
      this.type = state.type || 'Func';
      this.seg = el('div', { class: 'seg', style: { flex: 'none', width: '170px' } });
      for (const t of ['Func', 'Prgm']) { const b = el('button', { text: t === 'Func' ? 'Function' : 'Program', class: t === this.type ? 'on' : '' }); b.onclick = () => { this.type = t; this.seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }; this.seg.append(b); }
      this.code = el('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', style: { flex: '1', minHeight: '180px', font: '15px/1.5 var(--mono)', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', resize: 'none' } });
      this.code.value = state.code ?? SAMPLE;
      this.msg = el('div', { class: 'desc' });
      const ins = (t) => { const c = this.code; const p = c.selectionStart; c.value = c.value.slice(0, p) + t + c.value.slice(c.selectionEnd); c.focus(); c.selectionStart = c.selectionEnd = p + t.length; };
      const snippets = ['→', ':=', 'If  Then\n\nEndIf', 'Else', 'For i,1,10\n\nEndFor', 'While \n\nEndWhile', 'Return ', 'Local ', 'Disp ', '≤', '≥', '≠'];
      const chips = el('div', { class: 'chips' }, snippets.map((s) => el('button', { class: 'chip mono', text: s.split('\n')[0].trim() || s, onclick: () => ins(s) })));
      this.root.append(
        el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, this.seg),
        el('div', { style: { display: 'flex', gap: '8px' } }, this.name, el('span', { text: '(', style: { alignSelf: 'center', fontSize: '20px' } }), this.args, el('span', { text: ')', style: { alignSelf: 'center', fontSize: '20px' } })),
        chips, this.code,
        el('div', { class: 'btnrow' }, el('button', { class: 'btn pri', text: 'Check syntax & store', onclick: () => this.store() }), el('button', { class: 'btn', text: 'Run in Calculator', onclick: () => this.run() })),
        this.msg,
        el('p', { class: 'desc', html: 'TI-Basic as on the TI-Nspire and TI-89: <span class="mono">Local, If…Then…Else…EndIf, For…EndFor, While…EndWhile, Return, Disp</span>. Functions return a value; programs print with Disp.' }),
      );
    }
    get target() { return null; }
    serialize() { return { name: this.name.value, args: this.args.value, code: this.code.value, type: this.type }; }
    source() {
      const n = this.name.value.trim(), a = this.args.value.trim();
      const lines = this.code.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ':' + l.replace(/^:/, '').replace(/→/g, '→'));
      const end = this.type === 'Func' ? 'EndFunc' : 'EndPrgm';
      return 'Define ' + n + '(' + a + ')=' + this.type + '\n' + lines.join('\n') + '\n:' + end;
    }
    async store() {
      const n = this.name.value.trim();
      if (!/^[A-Za-z]\w*$/.test(n)) { this.msg.textContent = 'Give the program a name that starts with a letter.'; return false; }
      const src = this.source();
      const r = await this.app.cas.evalFull(src);
      const errs = r.printed.filter((t) => /syntax error|Error/.test(t));
      if (errs.length || /^"Define/.test(r.out)) {
        this.msg.innerHTML = ''; this.msg.style.color = 'var(--err)';
        this.msg.textContent = 'Syntax error: ' + (errs[0] || 'check the code').replace(/^:?(\d+):\s*/, 'line $1: ').replace(/\s+in\s*$/, '');
        return false;
      }
      this.msg.style.color = ''; this.msg.textContent = 'Stored ' + n + '(' + this.args.value + '). Use it in the Calculator.';
      this.app.cas.forget(n); this.app.cas.remember(src); this.app.userFuncs.add(n); this.app.saveSoon();
      return true;
    }
    async run() {
      if (!(await this.store())) return;
      let ci = this.app.pages.findIndex((p) => p.kind === 'calc');
      if (ci < 0) { this.app.addPage('calc'); ci = this.app.pages.length - 1; } else this.app.select(ci);
      const calc = this.app.pages[ci];
      calc.mf.value = '\\operatorname{' + this.name.value.trim() + '}\\left(' + this.args.value.split(',').map(() => '\\placeholder{}').join(',') + '\\right)';
      calc.mf.focus();
      toast('Fill in the arguments and press enter');
    }
  }
  root.Programs = { ProgramPage };
})(typeof self !== 'undefined' ? self : this);
