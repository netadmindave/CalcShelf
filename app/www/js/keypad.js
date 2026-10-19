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
    /* TI-89 layout: tap = primary, long-press = choose the 2nd legend s (blue) or ◆ legend d (green) */
    { id: 'num', label: '123', cols: 5, keys: [
      K('x', 'x', 'var', S('ln', '\\ln\\left(#0\\right)'), S('eˣ', '\\exponentialE^{#?}')), K('y', 'y', 'var', S('sin', '\\sin\\left(#0\\right)'), S('sin⁻¹', '\\sin^{-1}\\left(#0\\right)')),
      K('z', 'z', 'var', S('cos', '\\cos\\left(#0\\right)'), S('cos⁻¹', '\\cos^{-1}\\left(#0\\right)')), K('t', 't', 'var', S('tan', '\\tan\\left(#0\\right)'), S('tan⁻¹', '\\tan^{-1}\\left(#0\\right)')),
      { ...K('^', '^{#?}', 'op', S('π', '\\pi '), S('θ', '\\theta ')), aa: 1 },
      K('=', '=', 'op', S("'", "'"), S('≠', '\\ne ')), { l: '(', a: 'popen', t: 'op', s: S('{', '\\lbrace #0\\rbrace') }, { l: ')', a: 'pclose', t: 'op', s: { l: '}', c: 'moveAfterParent' } }, K(',', ',', 'op', S('[', '\\left[#0\\right]')),
      { l: '÷', ty: '/', t: 'op div', aa: 1, s: { l: ']', c: 'moveAfterParent' } },
      K('|', '\\mid ', 'op', S('°', '\\degree '), S('≥', '\\ge ')), K('7', '7', 'num', S('∫', '\\int_{#?}^{#?}#0\\,\\mathrm{d}#?')), K('8', '8', 'num', S('d', '\\frac{\\mathrm{d}}{\\mathrm{d}#?}\\left(#0\\right)')), K('9', '9', 'num', S(';', ';')),
      { ...K('×', '\\times ', 'op', S('√', '\\sqrt{#0}'), S('ⁿ√', '\\sqrt[#?]{#0}')), aa: 1 },
      K('EE', '\\times10^{#?}', 'fn', S('∠', '\\angle ')), K('4', '4', 'num', S(':=', '\\coloneq ')), K('5', '5', 'num', A('Math', 'menu')), K('6', '6', 'num', A('Mem', 'clearAZ', 'Clear a–z')),
      { ...K('−', '-', 'op', A('Var-Link', 'vars')), aa: 1 },
      { ...K('sto▸', '\\to ', 'fn', A('Rcl', 'recallDef')), aa: 1 }, K('1', '1', 'num', S('"', '\\text{"#?"}')), K('2', '2', 'num', { l: 'x²', i: '^2', aa: 1 }), K('3', '3', 'num', A('Units', 'units')),
      { ...K('+', '+', 'op', A('Char', 'abcpage')), aa: 1 },
      { l: 'ans', a: 'ans', t: 'fn', s: S('i', '\\imaginaryI '), d: S('∞', '\\infty ') }, K('0', '0', 'num', S('<', '<'), S('≤', '\\le ')), K('.', '.', 'num', S('>', '>'), S('≥', '\\ge ')),
      K('(−)', '-', 'num', A('Ans', 'ans'), S('±', '\\pm ')), { l: 'enter', a: 'enter', t: 'enter', s: A('Entry', 'entry'), d: A('≈', 'approx') },
    ] },
    { id: 'fn', label: 'f(x)', cols: 6, keys: [
      T('sin', '\\sin\\left(#0\\right)', 'fn'), T('cos', '\\cos\\left(#0\\right)', 'fn'), T('tan', '\\tan\\left(#0\\right)', 'fn'), T('ln', '\\ln\\left(#0\\right)', 'fn'), T('log', '\\log\\left(#0\\right)', 'fn'), T('$\\log_{\\square}', '\\log_{#?}\\left(#0\\right)', 'tpl'),
      T('sin⁻¹', '\\sin^{-1}\\left(#0\\right)', 'fn'), T('cos⁻¹', '\\cos^{-1}\\left(#0\\right)', 'fn'), T('tan⁻¹', '\\tan^{-1}\\left(#0\\right)', 'fn'), T('$\\mathrm{e}^{\\square}', '\\exponentialE^{#?}', 'tpl'), T('$10^{\\square}', '10^{#?}', 'tpl'), T('$\\sqrt[\\square]{\\square}', '\\sqrt[#?]{#0}', 'tpl'),
      T('sinh', '\\sinh\\left(#0\\right)', 'fn'), T('cosh', '\\cosh\\left(#0\\right)', 'fn'), T('tanh', '\\tanh\\left(#0\\right)', 'fn'), T('$\\left|\\square\\right|', '\\left|#0\\right|', 'tpl'), { ...T('n!', '!', 'fn'), aa: 1 }, { ...T('$\\square^2', '^2', 'tpl'), aa: 1 },
      T('i', '\\imaginaryI ', 'fn'), T('∞', '\\infty ', 'fn'), T('θ', '\\theta ', 'var'), T('±', '\\pm ', 'op'), T('z', 'z', 'var'), T('n', 'n', 'var'),
      T('→', '\\to ', 'op'), T(':=', '\\coloneq ', 'op'), T('|', '\\mid ', 'op'), T('<', '<', 'op'), T('≤', '\\le ', 'op'), T('≠', '\\ne ', 'op'),
    ] },
    { id: 'calc', label: '∫Σ', cols: 6, keys: [
      T('$\\frac{\\mathrm{d}}{\\mathrm{d}\\square}', '\\frac{\\mathrm{d}}{\\mathrm{d}#?}\\left(#0\\right)', 'tpl'), T('$\\frac{\\mathrm{d}^2}{\\mathrm{d}\\square^2}', '\\frac{\\mathrm{d}^{2}}{\\mathrm{d}#?^{2}}\\left(#0\\right)', 'tpl'),
      T('$\\int\\square', '\\int #0\\,\\mathrm{d}#?', 'tpl'), T('$\\int_\\square^\\square', '\\int_{#?}^{#?}#0\\,\\mathrm{d}#?', 'tpl'), T('$\\lim', '\\lim_{#?\\to#?}#0', 'tpl'), T('$\\Sigma', '\\sum_{#?=#?}^{#?}#0', 'tpl'),
      T('$\\Pi', '\\prod_{#?=#?}^{#?}#0', 'tpl'), T('solve', OP('solve', 2), 'cmd'), T('factor', OP('factor'), 'cmd'), T('expand', OP('expand'), 'cmd'), T('zeros', OP('zeros', 2), 'cmd'), T('nSolve', OP('nSolve', 2), 'cmd'),
      T('$\\begin{bmatrix}\\square&\\square\\\\\\square&\\square\\end{bmatrix}', '\\begin{pmatrix}#? & #?\\\\ #? & #?\\end{pmatrix}', 'tpl'), T('$\\begin{bmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{bmatrix}', '\\begin{pmatrix}#? & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{pmatrix}', 'tpl'),
      { l: '+row', c: 'addRowAfter', t: 'fn' }, { l: '+col', c: 'addColumnAfter', t: 'fn' }, T('$\\lbrace\\square\\rbrace', '\\lbrace #0\\rbrace', 'tpl'), T('$\\begin{cases}\\square\\\\\\square\\end{cases}', '\\begin{cases}#? & #?\\\\ #? & #?\\end{cases}', 'tpl'),
      T('deSolve', OP('deSolve', 3), 'cmd'), T('taylor', OP('taylor', 3), 'cmd'), T('cSolve', OP('cSolve', 2), 'cmd'), T('det', OP('det'), 'cmd'), { ...T('$\\square^{-1}', '^{-1}', 'tpl'), aa: 1 }, { ...T('$\\square^{T}', '^{T}', 'tpl'), aa: 1 },
      T('$\\square_{\\square}', '_{#?}', 'tpl'), T("y'", "'", 'fn'), T('Define', '\\operatorname{Define}#?\\left(x\\right)=#?', 'cmd'), T('approx', OP('approx'), 'cmd'), T('exact', OP('exact'), 'cmd'), T('"…"', '\\text{"#?"}', 'fn'),
    ] },
    { id: 'abc', label: 'abc', cols: 10, keys: 'qwertyuiop'.split('').map((c) => ({ l: c, ch: c, t: 'abc' }))
      .concat('asdfghjkl'.split('').map((c) => ({ l: c, ch: c, t: 'abc' })), [{ l: '_', i: '\\_', t: 'abc' }])
      .concat([{ l: '⇧', a: 'shift', t: 'abc mod' }], 'zxcvbnm'.split('').map((c) => ({ l: c, ch: c, t: 'abc' })), [{ l: "'", i: "'", t: 'abc' }, { l: '"', i: '\\text{"#?"}', t: 'abc' }])
      .concat([{ l: 'α', i: '\\alpha ', t: 'abc' }, { l: 'β', i: '\\beta ', t: 'abc' }, { l: 'λ', i: '\\lambda ', t: 'abc' }, { l: 'μ', i: '\\mu ', t: 'abc' }, { l: 'space', i: '\\ ', t: 'abc', w: 2 }, { l: 'ω', i: '\\omega ', t: 'abc' }, { l: 'φ', i: '\\phi ', t: 'abc' }, { l: 'σ', i: '\\sigma ', t: 'abc' }, { l: 'Δ', i: '\\Delta ', t: 'abc' }]) },
  ];
  root.KEYPAGES = PAGES;
})(typeof self !== 'undefined' ? self : this);
