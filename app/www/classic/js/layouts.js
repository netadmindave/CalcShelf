/*
 * layouts.js — touch keypads for the Z80 TI calculators, transcribed from the real keyboards.
 * k: TilEm scancode, p: key face, s: [2nd] legend, a: [alpha] legend, t: visual role,
 * hold: real press/release (auto-repeat). Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  // TilEm scancodes (emu/scancodes.h) — positions are the same matrix on every model
  const K = {
    DOWN: 0x01, LEFT: 0x02, RIGHT: 0x03, UP: 0x04,
    ENTER: 0x09, ADD: 0x0A, SUB: 0x0B, MUL: 0x0C, DIV: 0x0D, POWER: 0x0E, CLEAR: 0x0F,
    CHS: 0x11, N3: 0x12, N6: 0x13, N9: 0x14, RPAREN: 0x15, TAN: 0x16, VARS: 0x17,
    DEC: 0x19, N2: 0x1A, N5: 0x1B, N8: 0x1C, LPAREN: 0x1D, COS: 0x1E, PRGM: 0x1F, STAT: 0x20,
    N0: 0x21, N1: 0x22, N4: 0x23, N7: 0x24, COMMA: 0x25, SIN: 0x26, MATRIX: 0x27, XVAR: 0x28,
    ON: 0x29, STORE: 0x2A, LN: 0x2B, LOG: 0x2C, SQUARE: 0x2D, RECIP: 0x2E, MATH: 0x2F, ALPHA: 0x30,
    GRAPH: 0x31, TRACE: 0x32, ZOOM: 0x33, WINDOW: 0x34, YEQU: 0x35, SECOND: 0x36, MODE: 0x37, DEL: 0x38,
  };
  // TI-85/86 use the same matrix with different names (x5/x6 keynames)
  const K85 = {
    DOWN: 1, LEFT: 2, RIGHT: 3, UP: 4,
    ENTER: 9, ADD: 10, SUB: 11, MUL: 12, DIV: 13, POWER: 14, CLEAR: 15,
    CHS: 17, N3: 18, N6: 19, N9: 20, RPAREN: 21, TAN: 22, CUSTOM: 23,
    DEC: 25, N2: 26, N5: 27, N8: 28, LPAREN: 29, COS: 30, PRGM: 31, DEL: 32,
    N0: 33, N1: 34, N4: 35, N7: 36, EE: 37, SIN: 38, STAT: 39, XVAR: 40,
    ON: 41, STORE: 42, COMMA: 43, SQUARE: 44, LN: 45, LOG: 46, GRAPH: 47, ALPHA: 48,
    F5: 49, F4: 50, F3: 51, F2: 52, F1: 53, SECOND: 54, EXIT: 55, MORE: 56,
  };

  const num = (k, p, s, a) => ({ k, p, s, a, t: 'num' });

  /* TI-83 Plus / 84 Plus family (also 83 and 82 with small label changes) */
  function ti84(v) {
    const is83 = v === '83', is82 = v === '82', isPlus = !is83 && !is82;
    return {
      fkeys: [
        { k: K.YEQU, p: 'y=', s: is82 ? 'Y-Vars' : 'Stat Plot', a: isPlus ? 'F1' : '' },
        { k: K.WINDOW, p: 'window', s: 'TblSet', a: isPlus ? 'F2' : '' },
        { k: K.ZOOM, p: 'zoom', s: 'Format', a: isPlus ? 'F3' : '' },
        { k: K.TRACE, p: 'trace', s: 'Calc', a: isPlus ? 'F4' : '' },
        { k: K.GRAPH, p: 'graph', s: 'Table', a: isPlus ? 'F5' : '' },
      ].map((d) => (is82 && d.k === K.YEQU ? { ...d, s: 'Stat Plot' } : d)),
      cluster: [
        [{ k: K.SECOND, p: '2nd', t: 'mod-2nd' }, { k: K.MODE, p: 'mode', s: 'Quit' }, { k: K.DEL, p: 'del', s: 'Ins', hold: true }],
        [{ k: K.ALPHA, p: 'alpha', s: 'A-Lock', t: 'mod-alpha' }, { k: K.XVAR, p: is82 ? 'X,T,θ' : 'X,T,θ,n', s: 'Link', t: 'var' }, { k: K.STAT, p: 'stat', s: 'List' }],
      ],
      rows: [
        [{ k: K.MATH, p: 'math', s: 'Test', a: 'A' }, { k: K.MATRIX, p: isPlus ? 'apps' : 'matrx', s: 'Angle', a: 'B', t: isPlus ? 'apps' : '' }, { k: K.PRGM, p: 'prgm', s: 'Draw', a: 'C' }, { k: K.VARS, p: 'vars', s: is82 ? 'Y-Vars' : 'Distr' }, { k: K.CLEAR, p: 'clear' }],
        [{ k: K.RECIP, p: 'x⁻¹', s: isPlus ? 'Matrix' : is83 ? 'Finance' : 'Abs', a: 'D' }, { k: K.SIN, p: 'sin', s: 'sin⁻¹', a: 'E' }, { k: K.COS, p: 'cos', s: 'cos⁻¹', a: 'F' }, { k: K.TAN, p: 'tan', s: 'tan⁻¹', a: 'G' }, { k: K.POWER, p: '^', s: 'π', a: 'H', t: 'op' }],
        [{ k: K.SQUARE, p: 'x²', s: '√', a: 'I' }, { k: K.COMMA, p: ',', s: 'EE', a: 'J', t: 'op' }, { k: K.LPAREN, p: '(', s: '{', a: 'K', t: 'op' }, { k: K.RPAREN, p: ')', s: '}', a: 'L', t: 'op' }, { k: K.DIV, p: '÷', s: is82 ? '' : 'e', a: 'M', t: 'op' }],
        [{ k: K.LOG, p: 'log', s: '10ˣ', a: 'N' }, num(K.N7, '7', is82 ? 'Uₙ₋₁' : 'u', 'O'), num(K.N8, '8', is82 ? 'Vₙ₋₁' : 'v', 'P'), num(K.N9, '9', is82 ? 'n' : 'w', 'Q'), { k: K.MUL, p: '×', s: '[', a: 'R', t: 'op' }],
        [{ k: K.LN, p: 'ln', s: 'eˣ', a: 'S' }, num(K.N4, '4', 'L4', 'T'), num(K.N5, '5', 'L5', 'U'), num(K.N6, '6', 'L6', 'V'), { k: K.SUB, p: '−', s: ']', a: 'W', t: 'op' }],
        [{ k: K.STORE, p: 'sto→', s: 'Rcl', a: 'X' }, num(K.N1, '1', 'L1', 'Y'), num(K.N2, '2', 'L2', 'Z'), num(K.N3, '3', 'L3', 'θ'), { k: K.ADD, p: '+', s: 'Mem', a: '"', t: 'op' }],
        [{ k: K.ON, p: 'on', s: 'Off', t: 'on' }, num(K.N0, '0', is82 ? '' : 'Catalog', '␣'), num(K.DEC, '.', is82 ? '' : 'i', ':'), num(K.CHS, '(−)', 'Ans', '?'), { k: K.ENTER, p: 'enter', s: 'Entry', a: isPlus || is83 ? 'Solve' : '', t: 'enter' }],
      ],
    };
  }

  /* TI-85 / TI-86 */
  function ti86(v) {
    const is86 = v === '86';
    return {
      fkeys: [1, 2, 3, 4, 5].map((i) => ({ k: K85['F' + i], p: 'F' + i, s: 'M' + i })),
      cluster: [
        [{ k: K85.SECOND, p: '2nd', t: 'mod-2nd' }, { k: K85.EXIT, p: 'exit', s: 'Quit' }, { k: K85.MORE, p: 'more', s: 'Mode' }],
        [{ k: K85.ALPHA, p: 'alpha', s: 'alpha', t: 'mod-alpha' }, { k: K85.XVAR, p: 'x-var', s: 'Link', a: 'x', t: 'var' }, { k: K85.DEL, p: 'del', s: 'Ins', hold: true }],
      ],
      rows: [
        [{ k: K85.GRAPH, p: 'graph', s: 'Solver' }, { k: K85.STAT, p: is86 ? 'table' : 'stat', s: is86 ? 'Simult' : 'Simul' }, { k: K85.PRGM, p: 'prgm', s: 'Poly' }, { k: K85.CUSTOM, p: 'custom', s: is86 ? 'Catlg-Vars' : 'Catalog' }, { k: K85.CLEAR, p: 'clear', s: is86 ? '' : 'Toler' }],
        [{ k: K85.LOG, p: 'log', s: '10ˣ', a: 'A' }, { k: K85.SIN, p: 'sin', s: 'sin⁻¹', a: 'B' }, { k: K85.COS, p: 'cos', s: 'cos⁻¹', a: 'C' }, { k: K85.TAN, p: 'tan', s: 'tan⁻¹', a: 'D' }, { k: K85.POWER, p: '^', s: 'π', a: 'E', t: 'op' }],
        [{ k: K85.LN, p: 'ln', s: 'eˣ', a: 'F' }, { k: K85.EE, p: 'EE', s: 'x⁻¹', a: 'G' }, { k: K85.LPAREN, p: '(', s: '[', a: 'H', t: 'op' }, { k: K85.RPAREN, p: ')', s: ']', a: 'I', t: 'op' }, { k: K85.DIV, p: '÷', s: 'Calc', a: 'J', t: 'op' }],
        [{ k: K85.SQUARE, p: 'x²', s: '√', a: 'K' }, num(K85.N7, '7', 'Matrx', 'L'), num(K85.N8, '8', 'Vectr', 'M'), num(K85.N9, '9', 'Cplx', 'N'), { k: K85.MUL, p: '×', s: 'Math', a: 'O', t: 'op' }],
        [{ k: K85.COMMA, p: ',', s: '∠', a: 'P', t: 'op' }, num(K85.N4, '4', 'Cons', 'Q'), num(K85.N5, '5', 'Conv', 'R'), num(K85.N6, '6', 'Strng', 'S'), { k: K85.SUB, p: '−', s: 'List', a: 'T', t: 'op' }],
        [{ k: K85.STORE, p: 'sto▸', s: 'Rcl', a: '=' }, num(K85.N1, '1', 'Base', 'U'), num(K85.N2, '2', 'Test', 'V'), num(K85.N3, '3', is86 ? 'Mem' : 'Vars', 'W'), { k: K85.ADD, p: '+', s: is86 ? 'Stat' : 'Mem', a: 'X', t: 'op' }],
        [{ k: K85.ON, p: 'on', s: 'Off', t: 'on' }, num(K85.N0, '0', 'Char', 'Y'), num(K85.DEC, '.', ':', 'Z'), num(K85.CHS, '(−)', 'Ans', '␣'), { k: K85.ENTER, p: 'enter', s: 'Entry', t: 'enter' }],
      ],
    };
  }

  /* TI-81 (x1 keynames: RANGE at 0x34, INS at 0x37 and MODE at 0x20 where later models have MODE and STAT) */
  function ti81() {
    return {
      fkeys: [
        { k: K.YEQU, p: 'y=' }, { k: K.WINDOW, p: 'range' }, { k: K.ZOOM, p: 'zoom' }, { k: K.TRACE, p: 'trace' }, { k: K.GRAPH, p: 'graph' },
      ],
      cluster: [
        [{ k: K.SECOND, p: '2nd', t: 'mod-2nd' }, { k: K.MODE, p: 'ins' }, { k: K.DEL, p: 'del', hold: true }],
        [{ k: K.ALPHA, p: 'alpha', s: 'A-Lock', t: 'mod-alpha' }, { k: K.XVAR, p: 'X|T', t: 'var' }, { k: K.STAT, p: 'mode' }],
      ],
      rows: [
        [{ k: K.MATH, p: 'math', s: 'Test', a: 'A' }, { k: K.MATRIX, p: 'matrx', s: 'Stat', a: 'B' }, { k: K.PRGM, p: 'prgm', s: 'Draw', a: 'C' }, { k: K.VARS, p: 'vars', s: 'Y-Vars' }, { k: K.CLEAR, p: 'clear', s: 'Quit' }],
        [{ k: K.RECIP, p: 'x⁻¹', s: 'Abs', a: 'D' }, { k: K.SIN, p: 'sin', s: 'sin⁻¹', a: 'E' }, { k: K.COS, p: 'cos', s: 'cos⁻¹', a: 'F' }, { k: K.TAN, p: 'tan', s: 'tan⁻¹', a: 'G' }, { k: K.POWER, p: '^', s: 'π', a: 'H', t: 'op' }],
        [{ k: K.SQUARE, p: 'x²', s: '√', a: 'I' }, { k: K.COMMA, p: 'EE', a: 'J' }, { k: K.LPAREN, p: '(', a: 'K', t: 'op' }, { k: K.RPAREN, p: ')', a: 'L', t: 'op' }, { k: K.DIV, p: '÷', a: 'M', t: 'op' }],
        [{ k: K.LOG, p: 'log', s: '10ˣ', a: 'N' }, num(K.N7, '7', '', 'O'), num(K.N8, '8', '', 'P'), num(K.N9, '9', '', 'Q'), { k: K.MUL, p: '×', a: 'R', t: 'op' }],
        [{ k: K.LN, p: 'ln', s: 'eˣ', a: 'S' }, num(K.N4, '4', '', 'T'), num(K.N5, '5', '', 'U'), num(K.N6, '6', '', 'V'), { k: K.SUB, p: '−', a: 'W', t: 'op' }],
        [{ k: K.STORE, p: 'sto→', a: 'X' }, num(K.N1, '1', '[A]', 'Y'), num(K.N2, '2', '[B]', 'Z'), num(K.N3, '3', '[C]', 'θ'), { k: K.ADD, p: '+', s: 'Reset', a: '"', t: 'op' }],
        [{ k: K.ON, p: 'on', s: 'Off', t: 'on' }, num(K.N0, '0', '', '␣'), num(K.DEC, '.', '', ','), num(K.CHS, '(−)', 'Ans', '?'), { k: K.ENTER, p: 'enter', s: 'Entry', t: 'enter' }],
      ],
    };
  }

  /* TI-73 / TI-73 Explorer (x7 keynames; 2nd functions read from the OS itself). No ALPHA key: text is 2nd MATH. */
  function ti73() {
    return {
      alpha: null,
      fkeys: [
        { k: K.YEQU, p: 'y=', s: 'Plot' }, { k: K.WINDOW, p: 'window', s: 'TblSet' }, { k: K.ZOOM, p: 'zoom', s: 'Format' }, { k: K.TRACE, p: 'trace', s: 'Calc' }, { k: K.GRAPH, p: 'graph', s: 'Table' },
      ],
      cluster: [
        [{ k: K.SECOND, p: '2nd', t: 'mod-2nd' }, { k: K.MODE, p: 'mode', s: 'Quit' }, { k: K.DEL, p: 'del', s: 'Ins', hold: true }],
        [{ k: 0x30, p: 'math', s: 'Text' }, { k: 0x28, p: 'draw', s: 'Trig' }, { k: 0x20, p: 'list', s: 'Stat' }],
      ],
      rows: [
        [{ k: 0x2F, p: 'x²', s: '√' }, { k: 0x27, p: '^', s: 'e' }, { k: K.PRGM, p: 'prgm', s: 'Catalog' }, { k: 0x17, p: 'apps', s: 'Vars', t: 'apps' }, { k: K.CLEAR, p: 'clear' }],
        [{ k: 0x2E, p: 'unit', s: 'Conv' }, { k: 0x26, p: 'b/c', s: 'x⁻¹' }, { k: 0x1E, p: 'F◂▸D', s: 'π' }, { k: 0x16, p: 'Ab/c', s: 'Ab/c◂▸d/e' }, { k: 0x0E, p: 'const', s: 'Set' }],
        [{ k: 0x2D, p: 'simp' }, { k: 0x25, p: '%' }, { k: K.LPAREN, p: '(', t: 'op' }, { k: K.RPAREN, p: ')', t: 'op' }, { k: K.DIV, p: '÷', s: 'Int÷', t: 'op' }],
        [{ k: 0x2C, p: 'x', t: 'var' }, num(K.N7, '7'), num(K.N8, '8'), num(K.N9, '9'), { k: K.MUL, p: '×', t: 'op' }],
        [{ k: 0x2B, p: ',', t: 'op' }, num(K.N4, '4'), num(K.N5, '5'), num(K.N6, '6'), { k: K.SUB, p: '−', t: 'op' }],
        [{ k: K.STORE, p: 'sto→', s: 'Rcl' }, num(K.N1, '1'), num(K.N2, '2'), num(K.N3, '3'), { k: K.ADD, p: '+', t: 'op' }],
        [{ k: K.ON, p: 'on', s: 'Off', t: 'on' }, num(K.N0, '0', 'Mem'), num(K.DEC, '.'), num(K.CHS, '(−)', 'Ans'), { k: K.ENTER, p: 'enter', s: 'Entry', t: 'enter' }],
      ],
    };
  }

  /* Calculator models offered. os: can be built from a TI OS upgrade file (BootFree boot code). */
  const MODELS = [
    { id: 'z', name: 'TI-84 Plus Silver Edition', short: 'TI-84+ SE', pad: () => ti84('84'), os: '.8xu', theme: 'ti84', year: 2004 },
    { id: '4', name: 'TI-84 Plus', short: 'TI-84+', pad: () => ti84('84'), os: '.8xu', theme: 'ti84', year: 2004 },
    { id: 's', name: 'TI-83 Plus Silver Edition', short: 'TI-83+ SE', pad: () => ti84('84'), os: '.8xu', theme: 'ti83p', year: 2001 },
    { id: 'p', name: 'TI-83 Plus', short: 'TI-83+', pad: () => ti84('84'), os: '.8xu', theme: 'ti83p', year: 1999 },
    { id: '3', name: 'TI-83 / TI-82 STATS', short: 'TI-83', pad: () => ti84('83'), theme: 'ti83', year: 1996 },
    { id: '2', name: 'TI-82', short: 'TI-82', pad: () => ti84('82'), theme: 'ti82', year: 1993 },
    { id: '6', name: 'TI-86', short: 'TI-86', pad: () => ti86('86'), theme: 'ti86', year: 1997 },
    { id: '5', name: 'TI-85', short: 'TI-85', pad: () => ti86('85'), theme: 'ti85', year: 1992 },
    { id: '1', name: 'TI-81', short: 'TI-81', pad: () => ti81(), theme: 'ti81', year: 1990 },
    { id: '7', name: 'TI-73 Explorer', short: 'TI-73', pad: () => ti73(), theme: 'ti73', year: 1998 },
  ];

  root.CLASSIC = { K, K85, MODELS };
})(typeof self !== 'undefined' ? self : this);
