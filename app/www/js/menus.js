/*
 * menus.js — the TI-Nspire CX CAS Calculator menu tree, mapped to 2D templates.
 * Leaf: [label, template]  where template is LaTeX for the math editor (#0 = selection, #? = box)
 *    or [label, {dialog:'name'}] / [label, {action:'name'}]
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const op = (name, args = 1) => '\\operatorname{' + name + '}\\left(' + ['#0'].concat(Array(Math.max(0, args - 1)).fill('#?')).join(',') + '\\right)';
  const opv = (name, n) => '\\operatorname{' + name + '}\\left(' + Array(n).fill('#?').join(',') + '\\right)';
  const DIST = [
    ['Normal Pdf', opv('normPdf', 3)], ['Normal Cdf', opv('normCdf', 4)], ['Inverse Normal', opv('invNorm', 3)],
    ['t Pdf', opv('tPdf', 2)], ['t Cdf', opv('tCdf', 3)], ['Inverse t', opv('invt', 2)],
    ['χ² Pdf', opv('chi2Pdf', 2)], ['χ² Cdf', opv('chi2Cdf', 3)], ['Inverse χ²', opv('invChi2', 2)],
    ['F Pdf', opv('FPdf', 3)], ['F Cdf', opv('FCdf', 4)], ['Inverse F', opv('invF', 3)],
    ['Binomial Pdf', opv('binomPdf', 3)], ['Binomial Cdf', opv('binomCdf', 4)], ['Inverse Binomial', opv('invBinom', 3)],
    ['Poisson Pdf', opv('poissPdf', 2)], ['Poisson Cdf', opv('poissCdf', 3)],
    ['Geometric Pdf', opv('geomPdf', 2)], ['Geometric Cdf', opv('geomCdf', 3)],
  ];
  const CALC_MENU = [
    ['Actions', [
      ['Define', '\\operatorname{Define}#?\\left(x\\right)=#?'],
      ['Recall definition', { action: 'recallDef' }],
      ['Delete variable', '\\operatorname{DelVar}#?'],
      ['Clear a–z', { action: 'clearAZ' }],
      ['Clear history', { action: 'clearHistory' }],
      ['Constants & formulas library', { action: 'library' }],
      ['Variables', { action: 'vars' }],
    ]],
    ['Number', [
      ['Convert to decimal', { action: 'approx' }],
      ['Approximate to fraction', op('exact')],
      ['Factor', op('factor')],
      ['Least common multiple', op('lcm', 2)],
      ['Greatest common divisor', op('gcd', 2)],
      ['Remainder', op('remain', 2)],
      ['Fraction tools', [['Proper fraction', op('propFrac')], ['Get numerator', op('getNum')], ['Get denominator', op('getDenom')]]],
      ['Number tools', [['Round', op('round', 2)], ['Integer part', op('iPart')], ['Fractional part', op('fPart')], ['Sign', op('sign')], ['Modulo', op('mod', 2)], ['Floor', op('floor')], ['Ceiling', op('ceiling')]]],
      ['Complex number tools', [['Complex conjugate', op('conj')], ['Real part', op('real')], ['Imaginary part', op('imag')], ['Polar angle', op('arg')], ['Magnitude', '\\left|#0\\right|'], ['Convert to polar', op('polar')], ['Convert to rectangular', op('rectangular')]]],
      ['Primality test', op('isPrime')],
      ['Prime factors', op('ifactor')],
      ['Divisors', op('divisors')],
      ['Base conversion', [['Integer to base', op('convert', 1).replace('\\right)', ',base,#?\\right)')]]],
    ]],
    ['Algebra', [
      ['Solve', op('solve', 2)],
      ['Factor', op('factor')],
      ['Expand', op('expand')],
      ['Zeros', op('zeros', 2)],
      ['Approximate to fraction', op('exact')],
      ['Numerical solve', op('nSolve', 2)],
      ['Solve system of equations', [['System of equations', '\\operatorname{solve}\\left(\\begin{cases}#? \\\\ #?\\end{cases},\\lbrace x,y\\rbrace\\right)'], ['Linear system (matrix)', op('simult', 2)]]],
      ['Polynomial tools', [['Find real roots', op('polyRoots', 2)], ['Find complex roots', op('cPolyRoots', 2)], ['Remainder', op('polyRemainder', 3)], ['Quotient', op('polyQuotient', 3)], ['GCD', op('polyGcd', 2)], ['Coefficients', op('polyCoeffs', 2)], ['Degree', op('polyDegree', 2)], ['Evaluate polynomial', op('polyEval', 2)]]],
      ['Fraction tools', [['Proper fraction', op('propFrac')], ['Common denominator', op('comDenom')], ['Partial fractions', op('partfrac')], ['Get numerator', op('getNum')], ['Get denominator', op('getDenom')]]],
      ['Convert expression', [['to ln', op('lncollect')], ['to exp', op('lin')], ['to sin', op('trigsin')], ['to cos', op('trigcos')], ['to tan', op('trigtan')], ['Simplify', op('simplify')], ['Rationalize', op('ratnormal')]]],
      ['Trigonometry', [['Expand', op('tExpand')], ['Collect', op('tCollect')], ['Linearize', op('tlin')], ['Triangle solver…', () => { Library.trigSub('tri'); }], ['Trig identities…', () => { Library.trigSub('id'); }], ['Trig formulas…', () => { Library.trigSub('form'); }]]],
      ['Complex', [['Solve', op('cSolve', 2)], ['Factor', op('cFactor')], ['Zeros', op('cZeros', 2)]]],
      ['Extract', [['Left side', op('left')], ['Right side', op('right')]]],
      ['Complete the square', op('completeSquare', 2)],
      ['Assume', op('assume')],
    ]],
    ['Calculus', [
      ['Derivative', '\\frac{\\mathrm{d}}{\\mathrm{d}#?}\\left(#0\\right)'],
      ['Second derivative', '\\frac{\\mathrm{d}^{2}}{\\mathrm{d}#?^{2}}\\left(#0\\right)'],
      ['Derivative at a point', '\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(#0\\right)|x=#?'],
      ['Integral', '\\int_{#?}^{#?}#0\\,\\mathrm{d}#?'],
      ['Indefinite integral', '\\int #0\\,\\mathrm{d}#?'],
      ['Limit', '\\lim_{#?\\to#?}#0'],
      ['Sum', '\\sum_{#?=#?}^{#?}#0'],
      ['Product', '\\prod_{#?=#?}^{#?}#0'],
      ['Function minimum', op('fMin', 2)],
      ['Function maximum', op('fMax', 2)],
      ['Tangent line', op('tangentLine', 3)],
      ['Normal line', op('normalLine', 3)],
      ['Arc length', op('arcLen', 4)],
      ['Series', [['Taylor polynomial', op('taylor', 4)], ['Series expansion', op('series', 3)]]],
      ['Differential equation solver', op('deSolve', 3)],
      ['Implicit differentiation', op('impDif', 3)],
      ['Laplace transforms', [['Laplace', op('laplace', 3)], ['Inverse Laplace', op('ilaplace', 3)]]],
      ['Fourier transforms', [['Fourier', op('fourier', 3)], ['Inverse Fourier', op('ifourier', 3)]]],
      ['Numerical calculations', [['Numerical derivative at a point', op('nDeriv', 3)], ['Numerical integral', op('nInt', 4)], ['Numerical function minimum', op('fMin', 2)]]],
    ]],
    ['Probability', [
      ['Factorial (!)', '#0!'],
      ['Permutations', op('nPr', 2)],
      ['Combinations', op('nCr', 2)],
      ['Random', [['Number', '\\operatorname{rand}\\left(\\right)'], ['Integer', op('randInt', 2)], ['Normal', op('randNorm', 2)], ['Binomial', op('randBin', 2)], ['Sample from list', op('sample', 2)], ['Seed', op('RandSeed')]]],
      ['Distributions', DIST],
    ]],
    ['Statistics', [
      ['Stat calculations', [
        ['One-variable statistics', { dialog: 'onevar' }], ['Two-variable statistics', { dialog: 'twovar' }],
        ['Linear regression (mx+b)', { dialog: 'reg', reg: 'linear' }], ['Quadratic regression', { dialog: 'reg', reg: 'quad' }],
        ['Cubic regression', { dialog: 'reg', reg: 'cubic' }], ['Quartic regression', { dialog: 'reg', reg: 'quartic' }],
        ['Power regression', { dialog: 'reg', reg: 'power' }], ['Exponential regression', { dialog: 'reg', reg: 'exp' }],
        ['Logarithmic regression', { dialog: 'reg', reg: 'log' }], ['Sinusoidal regression', { dialog: 'reg', reg: 'sin' }],
        ['Logistic regression', { dialog: 'reg', reg: 'logistic' }],
      ]],
      ['List math', [['Minimum', op('min')], ['Maximum', op('max')], ['Mean', op('mean')], ['Median', op('median')], ['Sum of elements', op('sum')], ['Product of elements', op('product')], ['Standard deviation (sample)', op('stDevSamp')], ['Standard deviation (population)', op('stDevPop')], ['Variance (sample)', op('varSamp')], ['Variance (population)', op('varPop')], ['Quartiles', op('quartiles')]]],
      ['List operations', [['Sort ascending', op('SortA')], ['Sort descending', op('SortD')], ['Cumulative sum', op('cumSum')], ['Sequence', op('seq', 4)], ['Augment', op('augment', 2)], ['List to matrix', op('list▸mat', 2)], ['Matrix to list', op('mat▸list')], ['Difference list', op('deltalist')], ['Dimension', op('dim')], ['Left', op('left', 2)], ['Right', op('right', 2)], ['Mid', op('mid', 3)]]],
      ['Distributions', DIST],
      ['Correlation & covariance', [['Correlation', op('correlation', 2)], ['Covariance', op('covariance', 2)]]],
    ]],
    ['Matrix & Vector', [
      ['Create', [['Matrix 2×2', '\\begin{pmatrix}#? & #?\\\\ #? & #?\\end{pmatrix}'], ['Matrix 3×3', '\\begin{pmatrix}#? & #? & #?\\\\ #? & #? & #?\\\\ #? & #? & #?\\end{pmatrix}'], ['Column vector 3', '\\begin{pmatrix}#?\\\\ #?\\\\ #?\\end{pmatrix}'], ['Row vector 3', '\\begin{pmatrix}#? & #? & #?\\end{pmatrix}'], ['Identity', op('identity')], ['Zero matrix', op('newMat', 2)], ['Random matrix', op('randMat', 2)], ['Diagonal', op('diag')]]],
      ['Transpose', '#0^{T}'],
      ['Determinant', op('det')],
      ['Inverse', '#0^{-1}'],
      ['Row-echelon form', op('ref')],
      ['Reduced row-echelon form', op('rref')],
      ['Simultaneous', op('simult', 2)],
      ['Norms', [['Norm', op('norm')], ['Row norm', op('rowNorm')], ['Column norm', op('colNorm')]]],
      ['Dimensions', [['Dimension', op('dim')], ['Row dimension', op('rowDim')], ['Column dimension', op('colDim')]]],
      ['Row operations', [['Swap rows', op('rowSwap', 3)], ['Add rows', op('rowAdd', 3)], ['Multiply row', op('mRow', 3)], ['Multiply and add row', op('mRowAdd', 4)]]],
      ['Advanced', [['Characteristic polynomial', op('charpoly', 2)], ['LU decomposition', op('lu')], ['QR decomposition', op('qr')], ['Eigenvalues', op('eigVl')], ['Eigenvectors', op('eigVc')], ['Jordan form', op('jordan')], ['Matrix exponential', op('exp')]]],
      ['Vector', [['Unit vector', op('unitV')], ['Cross product', op('crossP', 2)], ['Dot product', op('dotP', 2)]]],
    ]],
    ['Finance', [
      ['Finance solver', { dialog: 'tvm' }],
      ['Interest conversion', [['Nominal → effective', { dialog: 'eff' }], ['Effective → nominal', { dialog: 'nom' }]]],
      ['Net present value', op('npv', 3)],
      ['Internal rate of return', op('irr', 2)],
    ]],
    ['Functions & Programs', [
      ['Program editor', { action: 'programs' }],
      ['Define function', '\\operatorname{Define}#?\\left(x\\right)=#?'],
      ['Piecewise', '\\begin{cases}#? & #?\\\\ #? & #?\\end{cases}'],
      ['If-then-else (when)', op('when', 3)],
    ]],
    ['Units', { action: 'units' }],
  ];

  // Common units grouped for the Units picker (Giac/Nspire _unit names)
  const UNITS = [
    ['Length', ['_m', '_cm', '_mm', '_µm', '_nm', '_Å', '_km', '_in', '_ft', '_yd', '_mi', '_nmi', '_au', '_ly', '_pc']],
    ['Mass', ['_kg', '_g', '_mg', '_t', '_lb', '_oz', '_u']],
    ['Time', ['_s', '_ms', '_µs', '_ns', '_ps', '_fs', '_min', '_hr', '_d', '_yr']],
    ['Force & pressure', ['_N', '_kN', '_dyn', '_lbf', '_Pa', '_kPa', '_MPa', '_bar', '_atm', '_mmHg', '_psi', '_Torr']],
    ['Energy & power', ['_J', '_kJ', '_eV', '_keV', '_MeV', '_cal', '_kcal', '_Wh', '_kWh', '_Btu', '_W', '_kW', '_mW', '_hp']],
    ['Electrical', ['_A', '_mA', '_V', '_mV', '_kV', '_Ω', '_kΩ', '_F', '_µF', '_nF', '_pF', '_H', '_mH', '_C', '_T', '_Wb', '_S']],
    ['Frequency & angle', ['_Hz', '_kHz', '_MHz', '_GHz', '_THz', '_rad', '_deg', '_sr']],
    ['Temperature & amount', ['_K', '_mol', '_cd']],
    ['Volume & area', ['_l', '_ml', '_gal', '_qt', '_acre', '_ha']],
    ['Speed', ['_mph', '_knot', '_kph']],
  ];

  root.NspireMenus = { CALC_MENU, UNITS, op };
})(typeof self !== 'undefined' ? self : this);
