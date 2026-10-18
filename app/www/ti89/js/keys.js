/*
 * keys.js — TI-89 Titanium keypad definition.
 * k: TiEmu key id, p: primary label, s: [2nd] legend, d: [◆] legend, a: [alpha] letter,
 * t: visual role, hold: key auto-repeats while held (sent as a real press/release).
 * Part of CalcShelf, GPL-3.0-or-later.
 */
self.KEYPAD = {
  fkeys: [
    { k: 'F1', p: 'F1', s: 'F6', d: 'Y=' },
    { k: 'F2', p: 'F2', s: 'F7', d: 'Window' },
    { k: 'F3', p: 'F3', s: 'F8', d: 'Graph' },
    { k: 'F4', p: 'F4', d: 'TblSet' },
    { k: 'F5', p: 'F5', d: 'Table' },
  ],
  // modifier / navigation cluster (left 3 columns, 2 rows) + d-pad on the right
  cluster: [
    [
      { k: '2ND', p: '2nd', t: 'mod-2nd', d: 'Cut' },
      { k: 'SHIFT', p: '⇧', t: 'mod-shift', d: 'Copy' },
      { k: 'ESCAPE', p: 'esc', s: 'Quit', d: 'Paste' },
    ],
    [
      { k: 'DIAMOND', p: '◆', t: 'mod-dia' },
      { k: 'ALPHA', p: 'alpha', t: 'mod-alpha', s: 'a-lock' },
      { k: 'APPS', p: 'apps', s: 'Switch', t: 'apps' },
    ],
  ],
  rows: [
    [
      { k: 'HOME', p: 'home', s: 'Custom' },
      { k: 'MODE', p: 'mode', s: '▸', d: '_' },
      { k: 'CATALOG', p: 'catalog', s: 'i', d: '∞' },
      { k: 'BACKSPACE', p: '⌫', s: 'Ins', d: 'Del', hold: true },
      { k: 'CLEAR', p: 'clear' },
    ],
    [
      { k: 'X', p: 'x', s: 'ln', d: 'eˣ', t: 'var' },
      { k: 'Y', p: 'y', s: 'sin', d: 'sin⁻¹', t: 'var' },
      { k: 'Z', p: 'z', s: 'cos', d: 'cos⁻¹', t: 'var' },
      { k: 'T', p: 't', s: 'tan', d: 'tan⁻¹', t: 'var' },
      { k: 'POWER', p: '^', s: 'π', d: 'θ', t: 'op' },
    ],
    [
      { k: 'EQUALS', p: '=', s: "'", a: 'a', t: 'op' },
      { k: 'PALEFT', p: '(', s: '{', a: 'b', t: 'op' },
      { k: 'PARIGHT', p: ')', s: '}', a: 'c', t: 'op' },
      { k: 'COMMA', p: ',', s: '[', a: 'd', t: 'op' },
      { k: 'DIVIDE', p: '÷', s: ']', a: 'e', t: 'op' },
    ],
    [
      { k: 'PIPE', p: '|', s: '°', a: 'f', t: 'op' },
      { k: '7', p: '7', s: '∫', a: 'g', t: 'num' },
      { k: '8', p: '8', s: 'd', a: 'h', t: 'num' },
      { k: '9', p: '9', s: ';', a: 'i', t: 'num' },
      { k: 'MULTIPLY', p: '×', s: '√', a: 'j', t: 'op' },
    ],
    [
      { k: 'EE', p: 'EE', s: '∠', d: 'Key', a: 'k' },
      { k: '4', p: '4', s: ':', a: 'l', t: 'num' },
      { k: '5', p: '5', s: 'Math', a: 'm', t: 'num' },
      { k: '6', p: '6', s: 'Mem', a: 'n', t: 'num' },
      { k: 'MINUS', p: '−', s: 'Var-Link', a: 'o', t: 'op' },
    ],
    [
      { k: 'STORE', p: 'sto▸', s: 'Rcl', a: 'p' },
      { k: '1', p: '1', s: '"', a: 'q', t: 'num' },
      { k: '2', p: '2', s: '\\', a: 'r', t: 'num' },
      { k: '3', p: '3', s: 'Units', a: 's', t: 'num' },
      { k: 'PLUS', p: '+', s: 'Char', a: 'u', t: 'op' },
    ],
    [
      { k: 'ON', p: 'on', s: 'Off', t: 'on' },
      { k: '0', p: '0', s: '<', a: 'v', t: 'num' },
      { k: 'PERIOD', p: '.', s: '>', a: 'w', t: 'num' },
      { k: 'NEGATE', p: '(−)', s: 'Ans', a: '␣', t: 'num' },
      { k: 'ENTER1', p: 'enter', s: 'Entry', d: '≈', t: 'enter' },
    ],
  ],
};

/*
 * TI-92 / TI-92 Plus / Voyage 200 keypad (QWERTY machines, no alpha key).
 * Two switchable pages: math and letters. seq: several keys sent in order (◆ shortcuts).
 * 2nd/◆ legends follow TiEmu's character table (tichars.c) and the 92 Plus keyboard.
 */
self.KEYPAD92 = {
  fkeys: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'].map((k) => ({ k, p: k })),
  cluster: [
    [
      { k: '2ND', p: '2nd', t: 'mod-2nd' },
      { k: 'DIAMOND', p: '◆', t: 'mod-dia' },
      { k: 'SHIFT', p: '⇧', t: 'mod-shift' },
      { k: 'HAND', p: '✋', s: '', d: '' },
    ],
    [
      { k: 'ESCAPE', p: 'esc', s: 'Quit' },
      { k: 'APPS', p: 'apps', s: 'Switch', t: 'apps' },
      { k: 'MODE', p: 'mode' },
      { k: 'ON', p: 'on', s: 'Off', t: 'on' },
    ],
  ],
  pages: {
    math: { cols: 5, rows: [
      [
        { seq: ['DIAMOND', 'Q'], p: 'home' }, { seq: ['DIAMOND', 'W'], p: 'y=' }, { seq: ['DIAMOND', 'E'], p: 'window' },
        { seq: ['DIAMOND', 'R'], p: 'graph' }, { seq: ['DIAMOND', 'Y'], p: 'table' },
      ],
      [
        { k: 'CLEAR', p: 'clear' }, { k: 'BACKSPACE', p: '⌫', s: 'Ins', hold: true }, { k: 'THETA', p: 'θ', s: ':', t: 'var' },
        { k: 'EQUALS', p: '=', s: '\\', d: '≠', t: 'op' }, { page: 'abc', p: 'abc', t: 'pagekey' },
      ],
      [
        { k: 'SIN', p: 'sin', s: 'sin⁻¹' }, { k: 'COS', p: 'cos', s: 'cos⁻¹' }, { k: 'TAN', p: 'tan', s: 'tan⁻¹' },
        { k: 'LN', p: 'ln', s: 'eˣ' }, { k: 'POWER', p: '^', s: 'π', t: 'op' },
      ],
      [
        { k: 'PALEFT', p: '(', s: '{', t: 'op' }, { k: 'PARIGHT', p: ')', s: '}', t: 'op' }, { k: 'COMMA', p: ',', s: '[', t: 'op' },
        { k: 'DIVIDE', p: '÷', s: ']', t: 'op' }, { k: 'STORE', p: 'sto▸', s: 'Rcl' },
      ],
      [
        { k: '7', p: '7', s: '∫', t: 'num' }, { k: '8', p: '8', s: 'd', t: 'num' }, { k: '9', p: '9', t: 'num' },
        { k: 'MULTIPLY', p: '×', s: '√', t: 'op' }, { k: 'X', p: 'x', t: 'var' },
      ],
      [
        { k: '4', p: '4', t: 'num' }, { k: '5', p: '5', s: 'Math', t: 'num' }, { k: '6', p: '6', s: 'Mem', t: 'num' },
        { k: 'MINUS', p: '−', s: 'Var-Link', t: 'op' }, { k: 'Y', p: 'y', t: 'var' },
      ],
      [
        { k: '1', p: '1', s: 'EE', t: 'num' }, { k: '2', p: '2', t: 'num' }, { k: '3', p: '3', t: 'num' },
        { k: 'PLUS', p: '+', s: 'Char', t: 'op' }, { k: 'Z', p: 'z', t: 'var' },
      ],
      [
        { k: '0', p: '0', s: '<', d: '≤', t: 'num' }, { k: 'PERIOD', p: '.', s: '>', d: '≥', t: 'num' }, { k: 'NEGATE', p: '(−)', s: 'Ans', t: 'num' },
        { k: 'SPACE', p: '␣' }, { k: 'ENTER1', p: 'enter', s: 'Entry', d: '≈', t: 'enter' },
      ],
    ] },
    abc: { cols: 10, rows: [
      'QWERTYUIOP'.split('').map((c) => ({ k: c, p: c.toLowerCase(), a: c, d: { Q: 'Home', W: 'Y=', E: 'Wind', R: 'Graph', T: 'TblSet', Y: 'Table' }[c] || '', s: { I: 'i' }[c] || '' })),
      [...'ASDFGHJKL'.split('').map((c) => ({ k: c, p: c.toLowerCase(), a: c, s: { J: '∞' }[c] || '' })), { k: 'THETA', p: 'θ', s: ':' }],
      [...'ZXCVBNM'.split('').map((c) => ({ k: c, p: c.toLowerCase(), a: c, s: { M: ';' }[c] || '' })), { k: 'COMMA', p: ',', s: '[' }, { k: 'EQUALS', p: '=', s: '\\', d: '≠' }, { k: 'BACKSPACE', p: '⌫', s: 'Ins', hold: true }],
      [{ page: 'math', p: '123', t: 'pagekey', w: 2 }, { k: 'SHIFT', p: '⇧', t: 'mod-shift', w: 1 }, { k: 'SPACE', p: 'space', w: 4 }, { k: 'PERIOD', p: '.', w: 1 }, { k: 'ENTER2', p: 'enter', s: 'Entry', t: 'enter', w: 2 }],
    ] },
  },
};

/*
 * TI-92 Plus / TI-92 / Voyage 200 in the Graph89 layout (positions in skin92.js): faces and legends as printed
 * on each calculator. p: face, s: 2nd legend, d: ◆ legend, a: letter (shift = capital), t: role.
 */
self.SKINLEG92 = (() => {
  const L = (p, s = '', d = '', t = '', a = '') => ({ p, s, d, t, a });
  const common = {
    '2ND': L('2nd', '', '', 'mod-2nd'), DIAMOND: L('◆', '', '', 'mod-dia'), SHIFT: L('⇧', '', '', 'mod-shift'), HAND: L('✋', '', '', 'hand'),
    ESCAPE: L('ESC', 'QUIT'), APPS: L('APPS', '⇄', '', 'apps'), MODE: L('MODE'), CLEAR: L('CLEAR'), LN: L('LN', 'eˣ'),
    UP: L('▲', '', '', 'arrow'), DOWN: L('▼', '', '', 'arrow'), LEFT: L('◀', '', '', 'arrow'), RIGHT: L('▶', '', '', 'arrow'),
    SIN: L('SIN', 'sin⁻¹'), COS: L('COS', 'cos⁻¹'), TAN: L('TAN', 'tan⁻¹'), POWER: L('^', 'π', '', 'op'),
    PALEFT: L('(', '{', '', 'op'), PARIGHT: L(')', '}', '', 'op'), COMMA: L(',', '[', '', 'op'), DIVIDE: L('÷', ']', '', 'op'),
    7: L('7', '∫', '', 'num'), 8: L('8', 'd', '', 'num'), 9: L('9', 'x⁻¹', '', 'num'), MULTIPLY: L('×', '√', '', 'op'),
    4: L('4', 'Σ', '', 'num'), 5: L('5', 'MATH', '', 'num'), 6: L('6', 'MEM', '', 'num'), MINUS: L('−', 'VAR-LINK', '', 'op'),
    1: L('1', 'EE', '', 'num'), 2: L('2', 'CATALOG', '', 'num'), 3: L('3', 'CUSTOM', '', 'num'), PLUS: L('+', 'CHAR', '', 'op'),
    0: L('0', '<', '', 'num'), PERIOD: L('.', '>', '', 'num'), NEGATE: L('(−)', 'ANS', '', 'num'), ENTER1: L('ENTER', 'ENTRY', '', 'enter'),
    ON: L('ON', 'OFF', '', 'on'), STORE: L('STO▸', 'RCL'), SPACE: L('', '', '', 'space'), EQUALS: L('=', '\\'), BACKSPACE: L('←', 'INS', 'DEL'),
    THETA: L('θ', ':', '', 'letter', 'θ'), ENTER2: L('ENTER', '', '≈', 'enter'),
  };
  for (let i = 1; i <= 8; i++) common['F' + i] = L('F' + i, '', '', 'fk');
  const letters = (extra) => { const o = {}; for (const c of 'QWERTYUIOPASDFGHJKLZXCVBNM') o[c] = L(c, (extra[c] || [])[0] || '', (extra[c] || [])[1] || '', 'letter', c); return o; };
  const v200 = { ...common, ...letters({ Q: ['?', 'HOME'], W: ['!', 'Y='], E: ['', 'WINDOW'], R: ['@', 'GRAPH'], T: ['#', 'TBLSET'], Y: ['▸', 'TABLE'], I: ['i'], P: ['_', 'UNITS'], D: ['°'], F: ['∠'], H: ['&'], J: ['∞'], K: ['|', 'KEY'], L: ['"'], Z: ['CAPS'], B: ["'"], M: [';'] }) };
  v200.ENTER2 = L('ENTER', '', 'APPROX ≈', 'enter');
  const p92 = { ...common, ...letters({ Q: ['', 'HOME'], W: ['', 'Y='], E: ['', 'WINDOW'], R: ['', 'GRAPH'], T: ['', 'TblSet'], Y: ['▸', 'TABLE'], I: ['i'], P: ['_', 'UNITS'], D: ['°'], F: ['∠'], J: ['∞'], K: ['|', 'KEY'], L: ['"'], Z: ['CAPS'], B: ["'"], M: [';'] }) };
  p92.ENTER2 = L('ENTER', 'ENTRY', '≈', 'enter');
  return { v200, '92p': p92, 92: p92 };
})();
