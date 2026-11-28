/*
 * keypad.js — touch keypad pages. Each key: {l: label (may be LaTeX if starts with $), i: LaTeX to insert,
 *   c: editor command, a: app action, w: width units, t: style}
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const T = (l, i, t) => ({ l, i, t });
  const S = (l, i) => ({ l, i });                                   // a secondary legend that inserts LaTeX
  const A = (l, a, title) => ({ l, a, title });                      // a secondary legend that runs an action
  const K = (l, i, t, s, d) => ({ l, i, t, s, d });
  const OP = (name, n = 1) => '\\operatorname{' + name + '}\\left(' + ['#0'].concat(Array(Math.max(0, n - 1)).fill('#?')).join(',') + '\\right)';
  const PAGES = [
    /* tap = the key; long-press = choose its blue (s) or green (d) function. Nothing here repeats a key, the action strip
       (esc, tab, menu, catalog, const, ← → ⌫) or the bar below (≈, enter); and the other pages don't repeat this one. */
    { id: 'num', label: '123', cols: 5, keys: [
      // EE types a TI-style small capital ᴇ: 6.02ᴇ23 stays on one line and is read as one number
      K('√', '\\sqrt{#0}', 'fn', S('ⁿ√', '\\sqrt[#?]{#0}')), K('π', '\\pi ', 'fn', S('e', '\\exponentialE ')), K('x²', '^2', 'fn', S('x³', '^3')),
      K('eˣ', '\\exponentialE^{#?}', 'fn', S('10ˣ', '10^{#?}'), S('logₐ', '\\log_{#?}\\left(#0\\right)')),
      { l: 'units', a: 'units', t: 'fn', title: 'Units', s: S('|x|', '\\left|#0\\right|'), d: S('n!', '!') },
      K('x', 'x', 'var', S('ln', '\\ln\\left(#0\\right)'), S('log', '\\log\\left(#0\\right)')), K('y', 'y', 'var', S('sin', '\\sin\\left(#0\\right)'), S('sin⁻¹', '\\sin^{-1}\\left(#0\\right)')),
      K('z', 'z', 'var', S('cos', '\\cos\\left(#0\\right)'), S('cos⁻¹', '\\cos^{-1}\\left(#0\\right)')), K('t', 't', 'var', S('tan', '\\tan\\left(#0\\right)'), S('tan⁻¹', '\\tan^{-1}\\left(#0\\right)')),
      { ...K('^', '^{#?}', 'op', S('θ', '\\theta ')), aa: 1 },
      K('=', '=', 'op', S("'", "'"), S('≠', '\\ne ')), { l: '(', a: 'popen', t: 'op', s: S('{', '\\lbrace #0\\rbrace') }, { l: ')', a: 'pclose', t: 'op', s: { l: '}', c: 'moveAfterParent' } }, K(',', ',', 'op', S('[', '\\left[#0\\right]')),
      { l: '÷', ty: '/', t: 'op div', aa: 1, s: { l: ']', c: 'moveAfterParent' } },
      K('|', '\\mid ', 'op', S('°', '\\degree ')), K('7', '7', 'num', S('∫', '\\int_{#?}^{#?}#0\\,\\mathrm{d}#?')), K('8', '8', 'num', S('d', '\\frac{\\mathrm{d}}{\\mathrm{d}#?}\\left(#0\\right)')), K('9', '9', 'num', S(';', ';')),
      { ...K('×', '\\times ', 'op', S('Π', '\\prod_{#?=#?}^{#?}#0')), aa: 1 },
      K('EE', 'ᴇ', 'fn', S('∠', '\\angle ')), K('4', '4', 'num', S(':=', '\\coloneq ')), K('5', '5', 'num', S('nCr', OP('nCr', 2)), S('nPr', OP('nPr', 2))), K('6', '6', 'num', A('Mem', 'clearAZ', 'Clear a–z')),
      { ...K('−', '-', 'op', A('Var-Link', 'vars')), aa: 1 },
      { ...K('sto▸', '\\to ', 'fn', A('Rcl', 'recallDef')), aa: 1 }, K('1', '1', 'num', S('"', '\\text{"#?"}')), K('2', '2', 'num', { l: 'x⁻¹', i: '^{-1}', aa: 1 }), K('3', '3', 'num', S('mod', OP('mod', 2))),
      { ...K('+', '+', 'op', S('Σ', '\\sum_{#?=#?}^{#?}#0')), aa: 1 },
      { l: 'ans', a: 'ans', t: 'fn', s: S('i', '\\imaginaryI '), d: S('∞', '\\infty ') }, K('0', '0', 'num', S('<', '<'), S('≤', '\\le ')), K('.', '.', 'num', S('>', '>'), S('≥', '\\ge ')),
      K('(−)', '\\char"207B ', 'num', S('±', '\\pm ')),   // negation: a raised ⁻ as on a TI, unlike the minus key
      { l: 'entry', a: 'entry', t: 'fn', title: 'Last entry' },
    ] },
    { id: 'fn', label: 'f(x)', cols: 6, keys: [
      T('sinh', '\\sinh\\left(#0\\right)', 'fn'), T('cosh', '\\cosh\\left(#0\\right)', 'fn'), T('tanh', '\\tanh\\left(#0\\right)', 'fn'), T('sinh⁻¹', '\\sinh^{-1}\\left(#0\\right)', 'fn'), T('cosh⁻¹', '\\cosh^{-1}\\left(#0\\right)', 'fn'), T('tanh⁻¹', '\\tanh^{-1}\\left(#0\\right)', 'fn'),
      T('sec', '\\sec\\left(#0\\right)', 'fn'), T('csc', '\\csc\\left(#0\\right)', 'fn'), T('cot', '\\cot\\left(#0\\right)', 'fn'), T('floor', OP('floor'), 'cmd'), T('ceil', OP('ceil'), 'cmd'), T('round', OP('round', 2), 'cmd'),
      T('sign', OP('sign'), 'cmd'), T('iPart', OP('iPart'), 'cmd'), T('fPart', OP('fPart'), 'cmd'), T('gcd', OP('gcd', 2), 'cmd'), T('lcm', OP('lcm', 2), 'cmd'), T('isPrime', OP('isPrime'), 'cmd'),
      T('re', OP('real'), 'cmd'), T('im', OP('imag'), 'cmd'), T('conj', OP('conj'), 'cmd'), T('arg', OP('arg'), 'cmd'), T('max', OP('max', 2), 'cmd'), T('min', OP('min', 2), 'cmd'),
      T('mean', OP('mean'), 'cmd'), T('median', OP('median'), 'cmd'), T('stdDev', OP('stdDev'), 'cmd'), T('rand', '\\operatorname{rand}\\left(\\right)', 'cmd'), T('randInt', OP('randInt', 2), 'cmd'), T('n', 'n', 'var'),
    ] },
    { id: 'calc', label: '∫Σ', cols: 6, keys: [
      T('$\\frac{\\mathrm{d}^2}{\\mathrm{d}\\square^2}', '\\frac{\\mathrm{d}^{2}}{\\mathrm{d}#?^{2}}\\left(#0\\right)', 'tpl'), T('$\\int\\square', '\\int #0\\,\\mathrm{d}#?', 'tpl'), T('$\\lim', '\\lim_{#?\\to#?}#0', 'tpl'),
      T('solve', OP('solve', 2), 'cmd'), T('factor', OP('factor'), 'cmd'), T('expand', OP('expand'), 'cmd'),
      T('zeros', OP('zeros', 2), 'cmd'), T('nSolve', OP('nSolve', 2), 'cmd'), T('cSolve', OP('cSolve', 2), 'cmd'), T('deSolve', OP('deSolve', 3), 'cmd'), T('taylor', OP('taylor', 3), 'cmd'), T('simplify', OP('simplify'), 'cmd'),
      T('$\\begin{bmatrix}\\square&\\square\\\\\\square&\\square\\end{bmatrix}', '\\begin{pmatrix}#? & #?\\\\ #? & #?\\end{pmatrix}', 'tpl'), T('$\\begin{bmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{bmatrix}', '\\begin{pmatrix}#? & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{pmatrix}', 'tpl'),
      { l: '+row', c: 'addRowAfter', t: 'fn' }, { l: '+col', c: 'addColumnAfter', t: 'fn' }, T('det', OP('det'), 'cmd'), { ...T('$\\square^{T}', '^{T}', 'tpl'), aa: 1 },
      T('rref', OP('rref'), 'cmd'), T('eigVl', OP('eigVl'), 'cmd'), T('dotP', OP('dotP', 2), 'cmd'), T('crossP', OP('crossP', 2), 'cmd'), T('norm', OP('norm'), 'cmd'), T('$\\begin{cases}\\square\\\\\\square\\end{cases}', '\\begin{cases}#? & #?\\\\ #? & #?\\end{cases}', 'tpl'),
      T('$\\square_{\\square}', '_{#?}', 'tpl'), T('Define', '\\operatorname{Define}#?\\left(x\\right)=#?', 'cmd'), T('approx', OP('approx'), 'cmd'), T('exact', OP('exact'), 'cmd'), T('propFrac', OP('propFrac'), 'cmd'), T('comDenom', OP('comDenom'), 'cmd'),
    ] },
    { id: 'abc', label: 'abc', cols: 10, keys: 'qwertyuiop'.split('').map((c) => ({ l: c, ch: c, t: 'abc' }))
      .concat('asdfghjkl'.split('').map((c) => ({ l: c, ch: c, t: 'abc' })), [{ l: '_', i: '\\_', t: 'abc' }])
      .concat([{ l: '⇧', a: 'shift', t: 'abc mod' }], 'zxcvbnm'.split('').map((c) => ({ l: c, ch: c, t: 'abc' })), [{ l: 'ε', i: '\\varepsilon ', t: 'abc' }, { l: 'τ', i: '\\tau ', t: 'abc' }])
      .concat([{ l: 'α', i: '\\alpha ', t: 'abc' }, { l: 'β', i: '\\beta ', t: 'abc' }, { l: 'λ', i: '\\lambda ', t: 'abc' }, { l: 'μ', i: '\\mu ', t: 'abc' }, { l: 'space', i: '\\ ', t: 'abc', w: 2 }, { l: 'ω', i: '\\omega ', t: 'abc' }, { l: 'φ', i: '\\phi ', t: 'abc' }, { l: 'σ', i: '\\sigma ', t: 'abc' }, { l: 'Δ', i: '\\Delta ', t: 'abc' }]) },
  ];
  root.KEYPAGES = PAGES;
})(typeof self !== 'undefined' ? self : this);
