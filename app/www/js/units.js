/*
 * units.js — dimensional unit engine: parses compound units (J/(mol·K), m³ kg⁻¹ s⁻², km/s/Mpc, MeV/c²),
 * converts between compatible units, and lists alternatives for a quantity.
 * Exact factors are SI definitions; others follow NIST SP 811 / CODATA 2018.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  // dimension vector: length, mass, time, current, temperature, amount, luminous intensity, angle, information
  const DN = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd', 'rad', 'bit'];
  const N = DN.length;
  const D = (o) => { const v = new Array(N).fill(0); for (const [k, e] of Object.entries(o)) v[DN.indexOf(k)] = e; return v; };
  const ONE = D({});
  const C0 = 299792458, H = 6.62607015e-34, E = 1.602176634e-19, KB = 1.380649e-23, NA = 6.02214076e23, G0 = 9.80665, PI = Math.PI;
  const LB = 0.45359237, IN = 0.0254, FT = 0.3048, GAL = 3.785411784e-3, CAL = 4.184, BTU = 1055.05585262, ATM = 101325;

  // symbol: [factor to SI, dims, prefixable, name]
  const U = {};
  const def = (sym, f, d, px, name, alias) => { U[sym] = { f, d, px: !!px, name: name || sym }; if (alias) for (const a of alias) U[a] = U[sym]; };
  const L = D({ m: 1 }), M = D({ kg: 1 }), T = D({ s: 1 }), I = D({ A: 1 }), K = D({ K: 1 }), MOL = D({ mol: 1 }), CD = D({ cd: 1 }), ANG = D({ rad: 1 }), BIT = D({ bit: 1 });
  const mul = (a, b, s = 1) => a.map((x, i) => x + s * b[i]);
  const pow = (a, p) => a.map((x) => x * p);
  const V = mul(L, T, -1), ACC = mul(L, pow(T, 2), -1), F = mul(M, ACC), EN = mul(F, L), P = mul(EN, T, -1), PR = mul(F, pow(L, 2), -1);
  const CH = mul(I, T), VOLT = mul(P, I, -1), OHM = mul(VOLT, I, -1);
  // SI base and derived
  def('m', 1, L, 1, 'metre'); def('g', 1e-3, M, 1, 'gram'); def('s', 1, T, 1, 'second', ['sec']); def('A', 1, I, 1, 'ampere');
  def('K', 1, K, 1, 'kelvin'); def('mol', 1, MOL, 1, 'mole'); def('cd', 1, CD, 1, 'candela');
  def('rad', 1, ANG, 1, 'radian'); def('sr', 1, pow(ANG, 2), 1, 'steradian');
  def('Hz', 1, pow(T, -1), 1, 'hertz'); def('N', 1, F, 1, 'newton'); def('Pa', 1, PR, 1, 'pascal'); def('J', 1, EN, 1, 'joule');
  def('W', 1, P, 1, 'watt'); def('C', 1, CH, 1, 'coulomb'); def('V', 1, VOLT, 1, 'volt'); def('Ω', 1, OHM, 1, 'ohm', ['ohm', 'Ohm']);
  def('S', 1, pow(OHM, -1), 1, 'siemens'); def('F', 1, mul(CH, VOLT, -1), 1, 'farad'); def('Wb', 1, mul(VOLT, T), 1, 'weber');
  def('T', 1, mul(mul(VOLT, T), pow(L, 2), -1), 1, 'tesla'); def('H', 1, mul(mul(VOLT, T), I, -1), 1, 'henry');
  def('lm', 1, mul(CD, pow(ANG, 2)), 1, 'lumen'); def('lx', 1, mul(mul(CD, pow(ANG, 2)), pow(L, 2), -1), 1, 'lux');
  def('Bq', 1, pow(T, -1), 1, 'becquerel'); def('Gy', 1, mul(EN, M, -1), 1, 'gray'); def('Sv', 1, mul(EN, M, -1), 1, 'sievert'); def('kat', 1, mul(MOL, T, -1), 1, 'katal');
  // accepted non-SI and others
  def('L', 1e-3, pow(L, 3), 1, 'litre', ['l']); def('t', 1000, M, 1, 'tonne'); def('Da', 1.66053906660e-27, M, 1, 'dalton', ['u']);
  def('eV', E, EN, 1, 'electronvolt'); def('min', 60, T, 0, 'minute'); def('h', 3600, T, 0, 'hour', ['hr']); def('d', 86400, T, 0, 'day', ['day']);
  def('wk', 604800, T, 0, 'week'); def('yr', 31557600, T, 1, 'Julian year', ['a', 'year']);
  def('°', PI / 180, ANG, 0, 'degree', ['deg']); def("'", PI / 10800, ANG, 0, 'arcminute', ['′', 'arcmin']); def('"', PI / 648000, ANG, 0, 'arcsecond', ['″', 'arcsec', 'as']);
  def('mas', PI / 648000e3, ANG, 0, 'milliarcsecond'); def('gon', PI / 200, ANG, 0, 'gradian', ['grad']); def('rev', 2 * PI, ANG, 0, 'revolution', ['turn']);
  def('rpm', 1 / 60, pow(T, -1), 0, 'revolutions per minute'); def('cyc', 1, ONE, 0, 'cycle');
  def('ha', 1e4, pow(L, 2), 0, 'hectare'); def('b', 1e-28, pow(L, 2), 1, 'barn'); def('Å', 1e-10, L, 0, 'ångström', ['angstrom', 'AA']);
  def('au', 149597870700, L, 0, 'astronomical unit', ['AU']); def('ly', 9460730472580800, L, 1, 'light-year'); def('pc', 3.0856775814913673e16, L, 1, 'parsec');
  def('bar', 1e5, PR, 1, 'bar'); def('atm', ATM, PR, 0, 'standard atmosphere'); def('Torr', ATM / 760, PR, 1, 'torr', ['torr']);
  def('mmHg', 133.322387415, PR, 0, 'millimetre of mercury'); def('inHg', 3386.389, PR, 0, 'inch of mercury'); def('inH2O', 249.08891, PR, 0, 'inch of water (4 °C)'); def('cmH2O', 98.0638, PR, 0, 'centimetre of water (4 °C)');
  def('psi', LB * G0 / (IN * IN), PR, 0, 'pound per square inch'); def('ksi', 1000 * LB * G0 / (IN * IN), PR, 0, 'kip per square inch');
  def('cal', CAL, EN, 1, 'calorie (thermochemical)'); def('Cal', 4184, EN, 0, 'food Calorie'); def('BTU', BTU, EN, 0, 'British thermal unit (IT)', ['Btu']);
  def('Wh', 3600, EN, 1, 'watt-hour'); def('erg', 1e-7, EN, 0, 'erg'); def('Eh', 4.3597447222071e-18, EN, 0, 'hartree'); def('Ry', 2.1798723611035e-18, EN, 0, 'rydberg');
  def('thm', 105505585.262, EN, 0, 'therm'); def('tTNT', 4.184e9, EN, 1, 'tonne of TNT');
  def('hp', 745.69987158227022, P, 0, 'horsepower (mechanical)'); def('PS', 735.49875, P, 0, 'metric horsepower');
  def('dyn', 1e-5, F, 0, 'dyne'); def('lbf', LB * G0, F, 0, 'pound-force'); def('kgf', G0, F, 0, 'kilogram-force'); def('ozf', LB * G0 / 16, F, 0, 'ounce-force'); def('kip', 1000 * LB * G0, F, 0, 'kip');
  def('gn', G0, ACC, 0, 'standard gravity', ['g0', 'g₀']); def('Gal', 0.01, ACC, 1, 'gal (acceleration)');
  def('in', IN, L, 0, 'inch'); def('ft', FT, L, 0, 'foot'); def('yd', 0.9144, L, 0, 'yard'); def('mi', 1609.344, L, 0, 'mile'); def('nmi', 1852, L, 0, 'nautical mile', ['NM']);
  def('mil', 2.54e-5, L, 0, 'mil (thou)', ['thou']); def('ftm', 1.8288, L, 0, 'fathom'); def('μin', 2.54e-8, L, 0, 'microinch', ['uin']);
  def('acre', 4046.8564224, pow(L, 2), 0, 'acre', ['ac']);
  def('gal', GAL, pow(L, 3), 0, 'US gallon'); def('qt', GAL / 4, pow(L, 3), 0, 'US quart'); def('pt', GAL / 8, pow(L, 3), 0, 'US pint'); def('cup', GAL / 16, pow(L, 3), 0, 'US cup');
  def('floz', GAL / 128, pow(L, 3), 0, 'US fluid ounce', ['fl_oz']); def('tbsp', GAL / 256, pow(L, 3), 0, 'tablespoon'); def('tsp', GAL / 768, pow(L, 3), 0, 'teaspoon');
  def('impgal', 4.54609e-3, pow(L, 3), 0, 'imperial gallon'); def('bbl', 0.158987294928, pow(L, 3), 0, 'oil barrel'); def('cc', 1e-6, pow(L, 3), 0, 'cubic centimetre');
  def('lb', LB, M, 0, 'pound', ['lbm']); def('oz', LB / 16, M, 0, 'ounce'); def('st', 6.35029318, M, 0, 'stone'); def('ton', 907.18474, M, 0, 'short ton'); def('LT', 1016.0469088, M, 0, 'long ton');
  def('slug', 14.593902937, M, 0, 'slug'); def('gr', 6.479891e-5, M, 0, 'grain'); def('ct', 2e-4, M, 0, 'carat'); def('ozt', 0.0311034768, M, 0, 'troy ounce');
  def('mph', 0.44704, V, 0, 'mile per hour'); def('kn', 1852 / 3600, V, 0, 'knot', ['kt', 'knot']); def('kph', 1 / 3.6, V, 0, 'kilometre per hour');
  def('c', C0, V, 0, 'speed of light'); def('G', 1e-4, D({ kg: 1, s: -2, A: -1 }), 1, 'gauss'); def('Mx', 1e-8, mul(VOLT, T), 0, 'maxwell');
  def('Oe', 1000 / (4 * PI), mul(I, L, -1), 0, 'oersted'); def('P', 0.1, mul(PR, T), 1, 'poise'); def('St', 1e-4, mul(pow(L, 2), T, -1), 1, 'stokes');
  def('Ci', 3.7e10, pow(T, -1), 1, 'curie'); def('rem', 0.01, mul(EN, M, -1), 1, 'rem'); def('fc', 10.763910417, mul(mul(CD, pow(ANG, 2)), pow(L, 2), -1), 0, 'foot-candle');
  def('nit', 1, mul(CD, pow(L, 2), -1), 0, 'nit (cd/m²)'); def('Ah', 3600, CH, 1, 'ampere-hour'); def('M', 1000, mul(MOL, pow(L, 3), -1), 1, 'molar (mol/L)');
  def('bit', 1, BIT, 1, 'bit'); def('B', 8, BIT, 1, 'byte', ['byte']);
  def('gpm', GAL / 60, mul(pow(L, 3), T, -1), 0, 'US gallon per minute'); def('cfm', FT * FT * FT / 60, mul(pow(L, 3), T, -1), 0, 'cubic foot per minute');
  def('°C', 1, K, 0, 'degree Celsius', ['degC', '℃']); def('°F', 5 / 9, K, 0, 'degree Fahrenheit', ['degF', '℉']); def('°R', 5 / 9, K, 0, 'degree Rankine', ['degR']);
  // ---- 2.8: more units (NIST SP 811 / BIPM / IAU values) ----
  const LBF = LB * G0, MI = 1609.344, YD = 0.9144;
  // length
  def('furlong', 201.168, L, 0, 'furlong'); def('ch', 20.1168, L, 0, 'chain (Gunter)', ['chain']); def('rd', 5.0292, L, 0, 'rod', ['rod']); def('lea', 3 * MI, L, 0, 'league');
  def('hand', 0.1016, L, 0, 'hand'); def('µ', 1e-6, L, 0, 'micron (µm)', ['micron']); def('fermi', 1e-15, L, 0, 'fermi (fm)'); def('a₀', 5.29177210903e-11, L, 0, 'Bohr radius', ['a0', 'bohr']);
  def('ls', C0, L, 0, 'light-second'); def('R⊕', 6.3781e6, L, 0, 'Earth radius (equatorial, IAU)', ['Rearth']); def('R☉', 6.957e8, L, 0, 'solar radius (IAU)', ['Rsun']);
  def('pica', IN / 6, L, 0, 'pica'); def('ptt', IN / 72, L, 0, 'typographic point (1/72 in)');
  // area
  def('cmil', PI / 4 * 2.54e-5 * 2.54e-5, pow(L, 2), 0, 'circular mil'); def('are', 100, pow(L, 2), 0, 'are'); def('sqmi', MI * MI, pow(L, 2), 0, 'square mile'); def('twp', 36 * MI * MI, pow(L, 2), 0, 'survey township');
  // volume
  def('impqt', 4.54609e-3 / 4, pow(L, 3), 0, 'imperial quart'); def('imppt', 4.54609e-3 / 8, pow(L, 3), 0, 'imperial pint'); def('impfloz', 4.54609e-3 / 160, pow(L, 3), 0, 'imperial fluid ounce');
  def('acft', 1233.48183754752, pow(L, 3), 0, 'acre-foot'); def('bu', 0.03523907016688, pow(L, 3), 0, 'US bushel'); def('cord', 3.624556363776, pow(L, 3), 0, 'cord'); def('stere', 1, pow(L, 3), 0, 'stère');
  def('gill', GAL / 32, pow(L, 3), 0, 'US gill'); def('drop', 5e-8, pow(L, 3), 0, 'drop (0.05 mL)');
  // mass
  def('M☉', 1.98847e30, M, 0, 'solar mass', ['Msun']); def('M⊕', 5.9722e24, M, 0, 'Earth mass', ['Mearth']); def('mₑ', 9.1093837015e-31, M, 0, 'electron mass', ['me']);
  def('mp', 1.67262192369e-27, M, 0, 'proton mass'); def('dwt', 1.55517384e-3, M, 0, 'pennyweight'); def('cwt', 45.359237, M, 0, 'US hundredweight'); def('lcwt', 50.80234544, M, 0, 'long hundredweight');
  def('quintal', 100, M, 0, 'quintal'); def('grain', 6.479891e-5, M, 0, 'grain');
  // time
  def('fortnight', 1209600, T, 0, 'fortnight'); def('mo', 31557600 / 12, T, 0, 'month (1/12 Julian year)', ['month']); def('shake', 1e-8, T, 0, 'shake');
  def('sday', 86164.0905, T, 0, 'sidereal day'); def('decade', 315576000, T, 0, 'decade (Julian)'); def('century', 3155760000, T, 0, 'century (Julian)'); def('tropyr', 31556925.19, T, 0, 'tropical year');
  // speed, acceleration
  def('fpm', FT / 60, V, 0, 'foot per minute'); def('fps', FT, V, 0, 'foot per second'); def('mach', 340.29, V, 0, 'Mach (sea level, 15 °C)'); def('ips', IN, V, 0, 'inch per second');
  // force, pressure
  def('pdl', 0.138254954376, F, 0, 'poundal'); def('sn', 1000, F, 0, 'sthène'); def('tf', 1000 * G0, F, 0, 'tonne-force'); def('gf', G0 / 1000, F, 0, 'gram-force');
  def('at', 98066.5, PR, 0, 'technical atmosphere (kgf/cm²)'); def('mmH2O', 9.80665, PR, 0, 'millimetre of water'); def('ftH2O', 2989.0669, PR, 0, 'foot of water (4 °C)'); def('Ba', 0.1, PR, 0, 'barye');
  def('pz', 1000, PR, 0, 'pièze'); def('msw', 10000, PR, 0, 'metre of sea water'); def('psf', LBF / (FT * FT), PR, 0, 'pound per square foot');
  // energy, power
  def('quad', 1.05505585262e18, EN, 0, 'quad (10¹⁵ BTU)'); def('toe', 4.1868e10, EN, 0, 'tonne of oil equivalent'); def('boe', 6.1178632e9, EN, 0, 'barrel of oil equivalent');
  def('Btu_th', 1054.3502645, EN, 0, 'British thermal unit (thermochemical)'); def('calIT', 4.1868, EN, 1, 'calorie (International Table)'); def('foe', 1e44, EN, 0, 'foe (10⁵¹ erg)');
  def('TR', 3516.8528420667, P, 0, 'ton of refrigeration'); def('hpe', 746, P, 0, 'horsepower (electric)'); def('hpb', 9809.5, P, 0, 'horsepower (boiler)'); def('L☉', 3.828e26, P, 0, 'solar luminosity (IAU)', ['Lsun']);
  // electromagnetic (CGS and others)
  def('statC', 3.33564095198e-10, CH, 0, 'statcoulomb (Fr)', ['Fr', 'esu']); def('abC', 10, CH, 0, 'abcoulomb'); def('abA', 10, I, 0, 'abampere (biot)', ['Bi']); def('statA', 3.33564095198e-10, I, 0, 'statampere');
  def('statV', 299.792458, VOLT, 0, 'statvolt'); def('abV', 1e-8, VOLT, 0, 'abvolt'); def('abΩ', 1e-9, OHM, 0, 'abohm'); def('statΩ', 8.987551787e11, OHM, 0, 'statohm');
  def('D', 3.33564095198e-30, mul(CH, L), 0, 'debye'); def('γ', 1e-9, U.T.d, 0, 'gamma (nT)', ['gamma']); def('Gb', 10 / (4 * PI), I, 0, 'gilbert'); def('emu', 1e-3, mul(I, pow(L, 2)), 0, 'emu (magnetic moment, erg/G)');
  // radiation
  def('R', 2.58e-4, mul(CH, M, -1), 1, 'röntgen'); def('rad_dose', 0.01, mul(EN, M, -1), 0, 'rad (absorbed dose)'); def('Rd', 1e6, pow(T, -1), 0, 'rutherford');
  // photometry, radiometry, optics
  def('dpt', 1, pow(L, -1), 0, 'dioptre', ['dioptre', 'diopter']); def('Jy', 1e-26, D({ kg: 1, s: -2 }), 1, 'jansky');
  def('ph', 1e4, U.lx.d, 0, 'phot'); def('sb', 1e4, mul(CD, pow(L, 2), -1), 0, 'stilb'); def('Lb', 1e4 / PI, mul(CD, pow(L, 2), -1), 0, 'lambert'); def('fL', 3.42625909963539, mul(CD, pow(L, 2), -1), 0, 'foot-lambert');
  def('asb', 1 / PI, mul(CD, pow(L, 2), -1), 0, 'apostilb'); def('talbot', 1, mul(mul(CD, pow(ANG, 2)), T), 0, 'talbot (lm·s)');
  def('kayser', 100, pow(L, -1), 0, 'kayser (1/cm)');
  // linear density, flow, catalysis, data
  def('tex', 1e-6, mul(M, L, -1), 1, 'tex (g/km)'); def('den', 1e-6 / 9, mul(M, L, -1), 0, 'denier (g/9 km)', ['denier']);
  def('sccm', 1e-6 / 60, mul(pow(L, 3), T, -1), 0, 'standard cubic centimetre per minute (as volume flow)'); def('slm', 1e-3 / 60, mul(pow(L, 3), T, -1), 0, 'standard litre per minute (as volume flow)');
  def('U', 1e-6 / 60, mul(MOL, T, -1), 0, 'enzyme unit (µmol/min)'); def('nibble', 4, BIT, 0, 'nibble'); def('Bd', 1, pow(T, -1), 1, 'baud');
  // angle
  def('mil_nato', 2 * PI / 6400, ANG, 0, 'angular mil (NATO, 1/6400 turn)'); def('quadrant', PI / 2, ANG, 0, 'right angle');
  def('deg2', (PI / 180) ** 2, pow(ANG, 2), 0, 'square degree'); def('sp', 4 * PI, pow(ANG, 2), 0, 'spat (4π sr)');
  // Planck units and constants usable as units
  def('l_P', 1.616255e-35, L, 0, 'Planck length'); def('t_P', 5.391247e-44, T, 0, 'Planck time'); def('m_P', 2.176434e-8, M, 0, 'Planck mass');
  const OFFSET = { '°C': 273.15, degC: 273.15, '℃': 273.15, '°F': 273.15 - 32 * 5 / 9, degF: 273.15 - 32 * 5 / 9, '℉': 273.15 - 32 * 5 / 9 };

  const PREFIX = { Q: 1e30, R: 1e27, Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 10, d: 0.1, c: 1e-2, m: 1e-3, 'µ': 1e-6, 'μ': 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24, r: 1e-27, q: 1e-30 };
  const PNAME = { Q: 'quetta', R: 'ronna', Y: 'yotta', Z: 'zetta', E: 'exa', P: 'peta', T: 'tera', G: 'giga', M: 'mega', k: 'kilo', h: 'hecto', da: 'deca', d: 'deci', c: 'centi', m: 'milli', 'µ': 'micro', 'μ': 'micro', u: 'micro', n: 'nano', p: 'pico', f: 'femto', a: 'atto', z: 'zepto', y: 'yocto', r: 'ronto', q: 'quecto' };
  const BINPREFIX = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5 };

  function lookup(sym) {
    if (U[sym]) return { ...U[sym], sym };
    if (/μ/.test(sym)) { const r = lookup(sym.replace(/μ/g, 'µ')); if (r) return { ...r, sym }; }
    if (/µ/.test(sym) && U[sym.replace(/µ/g, 'μ')]) return { ...U[sym.replace(/µ/g, 'μ')], sym };
    for (const [p, f] of Object.entries(BINPREFIX)) if (sym.startsWith(p) && U[sym.slice(p.length)] && U[sym.slice(p.length)].d[8]) return { ...U[sym.slice(p.length)], f: f * U[sym.slice(p.length)].f, sym, name: { Ki: 'kibi', Mi: 'mebi', Gi: 'gibi', Ti: 'tebi', Pi: 'pebi' }[p] + U[sym.slice(p.length)].name };
    for (const p of ['da', ...Object.keys(PREFIX).filter((x) => x !== 'da')]) {
      if (sym.length > p.length && sym.startsWith(p)) { const u = U[sym.slice(p.length)]; if (u && u.px) return { ...u, f: PREFIX[p] * u.f, sym, name: PNAME[p] + u.name }; }
    }
    return null;
  }

  /* ---------- parser: expression of units with ·, *, /, space, ^, superscripts, parentheses, numbers ---------- */
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  function tokenize(s) {
    const out = []; let i = 0;
    s = s.replace(/\\cdot|\\times|×|⋅|•/g, '·').replace(/\\mu\s*/g, 'µ').replace(/\\Omega/g, 'Ω').replace(/\\circ/g, '°').replace(/[{}]/g, '').replace(/\\,|\\ |~/g, ' ');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { out.push({ t: 'sp' }); i++; continue; }
      if (c === '·' || c === '*') { out.push({ t: '*' }); i++; continue; }
      if (c === '/') { out.push({ t: '/' }); i++; continue; }
      if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
      if (c === '^') { i++; const m = s.slice(i).match(/^\(\s*([-+]?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)/) || s.slice(i).match(/^\s*([-+]?\d+(?:\.\d+)?)/); if (!m) throw new Error('Exponent expected after ^'); out.push({ t: 'pow', v: evalFrac(m[1]) }); i += m[0].length; continue; }
      if (SUP[c]) { let e = ''; while (i < s.length && SUP[s[i]]) e += SUP[s[i++]]; out.push({ t: 'pow', v: +e }); continue; }
      const nm = s.slice(i).match(/^\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
      if (nm) {
        // a bare number right after a unit is an exponent (m2, s-1 style)
        const prev = out[out.length - 1];
        if (prev && prev.t === 'u') { out.push({ t: 'pow', v: +nm[0] }); i += nm[0].length; continue; }
        out.push({ t: 'n', v: +nm[0] }); i += nm[0].length; continue;
      }
      if (c === '-' && /\d/.test(s[i + 1] || '') && out.length && out[out.length - 1].t === 'u') { const m = s.slice(i).match(/^-\d+/); out.push({ t: 'pow', v: +m[0] }); i += m[0].length; continue; }
      const um = s.slice(i).match(/^(°[CFR]|inH2O|cmH2O|mmH2O|ftH2O|%|‰|[A-Za-zµμΩÅ°℃℉'′″"_₀ħγ⊕☉ₑ]+)/);
      if (um) { out.push({ t: 'u', v: um[1] }); i += um[1].length; continue; }
      throw new Error('Unexpected “' + c + '” in unit');
    }
    return out;
  }
  function evalFrac(x) { const [a, b] = x.split('/'); return b ? +a / +b : +a; }
  function parse(str) {
    const s = String(str || '').trim();
    if (!s || s === '1' || s === '—' || s === '-') return { f: 1, d: ONE.slice(), simple: null };
    const tk = tokenize(s).filter((t, i, a) => !(t.t === 'sp' && (i === 0 || i === a.length - 1 || ['*', '/', '(', 'sp'].includes(a[i - 1].t) || ['*', '/', ')', 'pow'].includes((a[i + 1] || {}).t))));
    let pos = 0;
    const peek = () => tk[pos];
    function atom() {
      const t = tk[pos++];
      if (!t) throw new Error('Incomplete unit');
      let r;
      if (t.t === '(') { r = expr(); if (!tk[pos] || tk[pos].t !== ')') throw new Error('Missing )'); pos++; }
      else if (t.t === 'n') r = { f: t.v, d: ONE.slice() };
      else if (t.t === 'u') { const u = lookup(t.v); if (!u) throw new Error('Unknown unit “' + t.v + '”'); r = { f: u.f, d: u.d.slice(), sym: t.v }; }
      else throw new Error('Unexpected symbol in unit');
      while (peek() && peek().t === 'pow') { const p = tk[pos++].v; r = { f: Math.pow(r.f, p), d: pow(r.d, p) }; }
      return r;
    }
    function term() {
      let r = atom();
      for (;;) {
        const t = peek();
        if (!t || t.t === ')') return r;
        if (t.t === '*' || t.t === 'sp') { pos++; const b = atom(); r = { f: r.f * b.f, d: mul(r.d, b.d) }; continue; }
        if (t.t === '/') { pos++; const b = atom(); r = { f: r.f / b.f, d: mul(r.d, b.d, -1) }; continue; }
        if (t.t === 'u' || t.t === '(' || t.t === 'n') { const b = atom(); r = { f: r.f * b.f, d: mul(r.d, b.d) }; continue; }
        throw new Error('Unexpected symbol in unit');
      }
    }
    function expr() { return term(); }
    const r = expr();
    if (pos < tk.length) throw new Error('Unexpected “)”');
    const single = tk.length === 1 && tk[0].t === 'u' ? tk[0].v : null;
    return { f: r.f, d: r.d.map((x) => Math.round(x * 1e9) / 1e9), simple: single };
  }
  const sameDim = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  function compatible(a, b) { try { return sameDim(parse(a).d, parse(b).d); } catch (e) { return false; } }
  /** Convert value from unit `a` to unit `b`. Temperatures with offsets convert absolutely when both are plain temperature units. */
  function convert(value, a, b) {
    const pa = parse(a), pb = parse(b);
    if (!sameDim(pa.d, pb.d)) throw new Error('Cannot convert ' + (a || '1') + ' (' + dimText(pa.d) + ') to ' + (b || '1') + ' (' + dimText(pb.d) + ')');
    const oa = pa.simple && OFFSET[pa.simple] !== undefined ? OFFSET[pa.simple] : 0, ob = pb.simple && OFFSET[pb.simple] !== undefined ? OFFSET[pb.simple] : 0;
    if ((oa || ob) && pa.simple && pb.simple && sameDim(pa.d, K)) return ((value * pa.f + oa) - ob) / pb.f;
    return value * pa.f / pb.f;
  }
  function dimText(d) {
    const p = [], n = [];
    d.forEach((e, i) => { if (!e) return; const s = DN[i] + (Math.abs(e) !== 1 ? supNum(Math.abs(e)) : ''); (e > 0 ? p : n).push(s); });
    if (!p.length && !n.length) return 'dimensionless';
    return (p.join('·') || '1') + (n.length ? '/' + (n.length > 1 ? '(' + n.join('·') + ')' : n[0]) : '');
  }
  function supNum(x) { const s = String(Math.round(x * 1000) / 1000); return s.split('').map((c) => ({ 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '.': '·', '/': 'ᐟ' }[c] || c)).join(''); }

  /* ---------- number formatting: engineering (powers of three), scientific or plain ---------- */
  function fmt(x, mode = 'eng', digits = 6) {
    if (!isFinite(x)) return { text: String(x), tex: String(x) };
    if (x === 0) return { text: '0', tex: '0' };
    const sgn = x < 0 ? '−' : '', ax = Math.abs(x);
    let e = Math.floor(Math.log10(ax));
    if (mode === 'plain' || (e >= -3 && e < 6 && mode !== 'sci-force')) {
      if (mode === 'plain' || mode === 'eng' || mode === 'sci') {
        const s = trim(ax.toPrecision(digits));
        if (!/e/.test(s)) return { text: sgn + s, tex: (x < 0 ? '-' : '') + s };
      }
    }
    if (mode === 'eng') e = Math.floor(e / 3) * 3;
    let m = ax / Math.pow(10, e);
    let ms = trim(m.toPrecision(digits));
    if (+ms >= (mode === 'eng' ? 1000 : 10)) { e += mode === 'eng' ? 3 : 1; m = ax / Math.pow(10, e); ms = trim(m.toPrecision(digits)); }
    const supE = supNum(e).replace('·', '.');
    return { text: sgn + ms + '×10' + supE, tex: (x < 0 ? '-' : '') + ms + '\\times10^{' + e + '}', mant: (x < 0 ? '-' : '') + ms, exp: e };
  }
  function trim(s) { if (/e/.test(s)) return s; return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
  /** Giac/JS-friendly number string */
  function num(x, digits = 12) { if (x === 0) return '0'; const s = x.toPrecision(digits); return trim(s.replace(/e\+?/, 'e')).replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e'); }

  /* ---------- unit text → LaTeX ---------- */
  function unitTex(u) {
    if (!u) return '';
    let s = u.replace(/µ|μ/g, '\\mu ').replace(/Ω/g, '\\Omega ').replace(/·/g, '\\cdot ').replace(/°/g, '^{\\circ}');
    s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m) => '^{' + m.split('').map((c) => SUP[c]).join('') + '}');
    return '\\mathrm{' + s + '}';
  }

  /* ---------- curated alternatives per quantity ---------- */
  const QUANTITIES = [
    ['Length', L, ['m', 'km', 'cm', 'mm', 'µm', 'nm', 'pm', 'fm', 'Å', 'a₀', 'in', 'ft', 'yd', 'mi', 'nmi', 'mil', 'µin', 'ftm', 'furlong', 'ch', 'rd', 'lea', 'hand', 'pica', 'ptt', 'ls', 'R⊕', 'R☉', 'au', 'ly', 'pc', 'kpc', 'Mpc', 'l_P']],
    ['Area', pow(L, 2), ['m²', 'cm²', 'mm²', 'µm²', 'nm²', 'km²', 'are', 'ha', 'acre', 'in²', 'ft²', 'yd²', 'mi²', 'twp', 'mil²', 'cmil', 'b', 'Mb']],
    ['Volume', pow(L, 3), ['m³', 'L', 'dL', 'cL', 'mL', 'µL', 'nL', 'pL', 'cm³', 'mm³', 'µm³', 'in³', 'ft³', 'yd³', 'gal', 'qt', 'pt', 'cup', 'gill', 'floz', 'tbsp', 'tsp', 'drop', 'impgal', 'impqt', 'imppt', 'impfloz', 'bbl', 'bu', 'acft', 'cord', 'stere']],
    ['Mass', M, ['kg', 'g', 'mg', 'µg', 'ng', 'pg', 't', 'Mt', 'quintal', 'Da', 'kDa', 'mₑ', 'mp', 'MeV/c²', 'GeV/c²', 'eV/c²', 'lb', 'oz', 'ton', 'LT', 'cwt', 'lcwt', 'slug', 'st', 'gr', 'ct', 'ozt', 'dwt', 'M⊕', 'M☉', 'm_P']],
    ['Time', T, ['s', 'ms', 'µs', 'ns', 'ps', 'fs', 'shake', 'min', 'h', 'd', 'sday', 'wk', 'fortnight', 'mo', 'yr', 'tropyr', 'decade', 'century', 'kyr', 'Myr', 'Gyr', 't_P']],
    ['Frequency', pow(T, -1), ['Hz', 'mHz', 'kHz', 'MHz', 'GHz', 'THz', 'PHz', 'EHz', 'rpm', '1/s', '1/min', '1/h', '1/d', 'Bd']],
    ['Angular frequency', mul(ANG, T, -1), ['rad/s', '°/s', 'rev/min', 'rev/s', 'mrad/s']],
    ['Speed', V, ['m/s', 'km/h', 'km/s', 'cm/s', 'mm/s', 'µm/s', 'nm/s', 'm/min', 'mph', 'kn', 'ft/s', 'ft/min', 'in/s', 'ft/ns', 'mm/µs', 'au/yr', 'pc/Myr', 'mach', 'c']],
    ['Acceleration', ACC, ['m/s²', 'gn', 'cm/s²', 'mm/s²', 'ft/s²', 'in/s²', 'Gal', 'mGal', 'km/h/s', 'mph/s', 'kn/s']],
    ['Force', F, ['N', 'kN', 'MN', 'mN', 'µN', 'nN', 'pN', 'fN', 'dyn', 'lbf', 'kgf', 'gf', 'tf', 'ozf', 'kip', 'pdl', 'sn', 'eV/nm', 'eV/Å']],
    ['Pressure / stress', PR, ['Pa', 'kPa', 'MPa', 'GPa', 'hPa', 'mPa', 'µPa', 'bar', 'mbar', 'µbar', 'atm', 'at', 'Torr', 'mTorr', 'µTorr', 'mmHg', 'inHg', 'mmH2O', 'cmH2O', 'inH2O', 'ftH2O', 'msw', 'psi', 'ksi', 'psf', 'N/mm²', 'kgf/cm²', 'Ba', 'pz']],
    ['Energy', EN, ['J', 'kJ', 'MJ', 'GJ', 'mJ', 'µJ', 'nJ', 'pJ', 'fJ', 'aJ', 'zJ', 'eV', 'meV', 'µeV', 'keV', 'MeV', 'GeV', 'TeV', 'cal', 'kcal', 'calIT', 'Cal', 'Wh', 'kWh', 'MWh', 'GWh', 'BTU', 'Btu_th', 'thm', 'quad', 'toe', 'boe', 'erg', 'Eh', 'Ry', 'ft·lbf', 'in·lbf', 'L·atm', 'tTNT', 'ktTNT', 'foe']],
    ['Power', P, ['W', 'kW', 'MW', 'GW', 'TW', 'mW', 'µW', 'nW', 'pW', 'fW', 'hp', 'hpe', 'hpb', 'PS', 'BTU/h', 'TR', 'erg/s', 'J/s', 'kcal/h', 'cal/s', 'ft·lbf/s', 'eV/s', 'L☉']],
    ['Temperature', K, ['K', '°C', '°F', '°R', 'mK', 'µK', 'nK']],
    ['Angle', ANG, ['rad', 'mrad', 'µrad', 'nrad', '°', "'", '"', 'mas', 'gon', 'mil_nato', 'quadrant', 'rev']],
    ['Solid angle', pow(ANG, 2), ['sr', 'msr', 'µsr', 'deg2', 'sp']],
    ['Density / mass concentration', mul(M, pow(L, 3), -1), ['kg/m³', 'g/cm³', 'g/mL', 'g/L', 'mg/L', 'µg/L', 'mg/mL', 'µg/mL', 'ng/mL', 'µg/m³', 'kg/L', 'lb/ft³', 'lb/in³', 'lb/gal', 'oz/in³', 'slug/ft³']],
    ['Torque / moment', mul(F, L), ['N·m', 'kN·m', 'N·mm', 'mN·m', 'N·cm', 'dyn·cm', 'lbf·ft', 'lbf·in', 'ozf·in', 'kgf·m', 'kgf·cm']],
    ['Dynamic viscosity', mul(PR, T), ['Pa·s', 'mPa·s', 'µPa·s', 'P', 'cP', 'lbf·s/ft²', 'lbf·s/in²', 'lb/(ft·s)']],
    ['Kinematic viscosity / diffusivity', mul(pow(L, 2), T, -1), ['m²/s', 'mm²/s', 'cm²/s', 'µm²/s', 'm²/h', 'St', 'cSt', 'ft²/s', 'ft²/h', 'in²/s']],
    ['Volumetric flow', mul(pow(L, 3), T, -1), ['m³/s', 'm³/h', 'm³/d', 'L/s', 'L/min', 'L/h', 'mL/min', 'mL/h', 'µL/min', 'sccm', 'slm', 'gpm', 'gal/h', 'cfm', 'ft³/s', 'ft³/h', 'bbl/d']],
    ['Mass flow', mul(M, T, -1), ['kg/s', 'kg/min', 'kg/h', 'g/s', 'g/min', 'mg/s', 't/h', 'lb/s', 'lb/min', 'lb/h']],
    ['Charge', CH, ['C', 'mC', 'µC', 'nC', 'pC', 'fC', 'Ah', 'mAh', 'e₀', 'statC', 'abC']],
    ['Current', I, ['A', 'mA', 'µA', 'nA', 'pA', 'fA', 'kA', 'abA', 'statA', 'e₀/s', 'Gb']],
    ['Voltage', VOLT, ['V', 'mV', 'µV', 'nV', 'kV', 'MV', 'statV', 'abV']],
    ['Resistance', OHM, ['Ω', 'µΩ', 'mΩ', 'kΩ', 'MΩ', 'GΩ', 'TΩ', 'abΩ', 'statΩ']],
    ['Conductance', pow(OHM, -1), ['S', 'mS', 'µS', 'nS', 'pS', '1/Ω']],
    ['Capacitance', mul(CH, VOLT, -1), ['F', 'mF', 'µF', 'nF', 'pF', 'fF', 'aF']],
    ['Inductance', mul(mul(VOLT, T), I, -1), ['H', 'mH', 'µH', 'nH', 'pH', 'Wb/A']],
    ['Magnetic flux density', U.T.d, ['T', 'mT', 'µT', 'nT', 'pT', 'fT', 'G', 'mG', 'kG', 'γ', 'Wb/m²']],
    ['Magnetic flux', mul(VOLT, T), ['Wb', 'mWb', 'µWb', 'Mx', 'V·s']],
    ['Magnetic field strength', mul(I, L, -1), ['A/m', 'kA/m', 'Oe']],
    ['Electric field', mul(VOLT, L, -1), ['V/m', 'mV/m', 'kV/m', 'MV/m', 'V/cm', 'kV/cm', 'MV/cm', 'V/µm', 'V/nm', 'V/mm', 'N/C', 'statV/cm']],
    ['Irradiance / intensity / heat flux', mul(P, pow(L, 2), -1), ['W/m²', 'mW/m²', 'µW/cm²', 'mW/cm²', 'W/cm²', 'kW/cm²', 'kW/m²', 'MW/cm²', 'GW/cm²', 'TW/cm²', 'µW/mm²', 'mW/mm²', 'W/mm²', 'BTU/(h·ft²)', 'erg/(s·cm²)']],
    ['Fluence / energy per area', mul(EN, pow(L, 2), -1), ['J/m²', 'kJ/m²', 'J/cm²', 'mJ/cm²', 'µJ/cm²', 'nJ/cm²', 'J/mm²', 'mJ/mm²', 'kWh/m²', 'erg/cm²']],
    ['Luminous intensity', CD, ['cd', 'mcd', 'kcd']],
    ['Luminous flux', U.lm.d, ['lm', 'mlm', 'klm', 'cd·sr']],
    ['Illuminance', U.lx.d, ['lx', 'mlx', 'klx', 'fc', 'ph', 'lm/m²', 'lm/cm²']],
    ['Luminance', U.nit.d, ['cd/m²', 'nit', 'cd/cm²', 'sb', 'Lb', 'fL', 'asb', 'cd/in²', 'cd/ft²']],
    ['Radioactivity', U.Bq.d, ['Bq', 'kBq', 'MBq', 'GBq', 'TBq', 'Ci', 'mCi', 'µCi', 'nCi', 'pCi', 'Rd']],
    ['Absorbed / equivalent dose', U.Gy.d, ['Gy', 'mGy', 'µGy', 'Sv', 'mSv', 'µSv', 'rad_dose', 'rem', 'mrem', 'J/kg']],
    ['Amount of substance', MOL, ['mol', 'mmol', 'µmol', 'nmol', 'pmol', 'fmol', 'kmol']],
    ['Molar concentration', U.M.d, ['mol/L', 'M', 'mM', 'µM', 'nM', 'pM', 'mol/m³', 'mmol/L', 'µmol/L']],
    ['Data', BIT, ['bit', 'nibble', 'B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'kbit', 'Mbit', 'Gbit', 'Tbit']],
    ['Data rate', mul(BIT, T, -1), ['bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s', 'Tbit/s', 'B/s', 'kB/s', 'MB/s', 'GB/s', 'MiB/s', 'GiB/s', 'TB/h']],
    ['Wavenumber / inverse length / lens power', pow(L, -1), ['1/m', '1/cm', '1/mm', '1/µm', '1/nm', '1/km', 'kayser', 'dpt']],
    ['Thermal conductivity', mul(P, mul(L, K), -1), ['W/(m·K)', 'W/(cm·K)', 'mW/(m·K)', 'BTU/(h·ft·°F)', 'cal/(s·cm·K)']],
    ['Heat transfer coefficient', mul(P, mul(pow(L, 2), K), -1), ['W/(m²·K)', 'W/(cm²·K)', 'BTU/(h·ft²·°F)']],
    ['Specific heat', mul(EN, mul(M, K), -1), ['J/(kg·K)', 'J/(g·K)', 'kJ/(kg·K)', 'cal/(g·K)', 'BTU/(lb·°F)']],
    ['Molar energy', mul(EN, MOL, -1), ['J/mol', 'kJ/mol', 'kcal/mol', 'eV·NA', 'kWh/mol']],
    ['Specific energy', mul(EN, M, -1), ['J/kg', 'kJ/kg', 'MJ/kg', 'kWh/kg', 'BTU/lb', 'Wh/kg']],
    ['Coefficient per kelvin', pow(K, -1), ['1/K', 'ppm/K', 'ppb/K', '1/°F']],
    ['Mobility', mul(pow(L, 2), mul(VOLT, T), -1), ['m²/(V·s)', 'cm²/(V·s)']],
    ['Number density', pow(L, -3), ['1/m³', '1/cm³', '1/mm³', '1/L']],
    ['Electric resistivity', mul(OHM, L), ['Ω·m', 'Ω·cm', 'µΩ·cm', 'nΩ·m', 'Ω·mm²/m']],
    ['Spectral dispersion (ps/(nm·km))', mul(T, pow(L, 2), -1), ['ps/(nm·km)', 's/m²', 'fs/(nm·mm)']],
    ['Action / angular momentum', mul(EN, T), ['J·s', 'eV·s', 'meV·ps', 'erg·s', 'J/Hz', 'eV/Hz', 'ħ']],
    ['Entropy / heat capacity', mul(EN, K, -1), ['J/K', 'eV/K', 'meV/K', 'µeV/K', 'erg/K', 'cal/K', 'k_B']],
    ['Molar heat capacity', mul(EN, mul(MOL, K), -1), ['J/(mol·K)', 'kJ/(mol·K)', 'cal/(mol·K)', 'L·atm/(mol·K)', 'L·bar/(mol·K)', 'm³·Pa/(mol·K)']],
    ['Gravitational constant', mul(pow(L, 3), mul(M, pow(T, 2)), -1), ['m³/(kg·s²)', 'N·m²/kg²', 'cm³/(g·s²)', 'km³/(kg·s²)']],
    ['Gravitational parameter', mul(pow(L, 3), pow(T, 2), -1), ['m³/s²', 'km³/s²']],
    ['Permittivity', mul(U.F.d, L, -1), ['F/m', 'pF/m', 'C²/(N·m²)', 'e₀²/(eV·µm)']],
    ['Permeability', mul(U.H.d, L, -1), ['H/m', 'µH/m', 'N/A²', 'T·m/A']],
    ['Magnetic moment', mul(EN, U.T.d, -1), ['J/T', 'eV/T', 'µeV/T', 'meV/T', 'A·m²', 'µA·mm²', 'erg/G', 'emu']],
    ['Frequency per volt', mul(pow(T, -1), VOLT, -1), ['Hz/V', 'GHz/µV', 'THz/mV', 'MHz/µV']],
    ['Charge per mass', mul(CH, M, -1), ['C/kg', 'C/g', 'mC/kg']],
    ['Length × temperature', mul(L, K), ['m·K', 'mm·K', 'µm·K', 'nm·K', 'cm·K']],
    ['Frequency per kelvin', mul(pow(T, -1), K, -1), ['Hz/K', 'GHz/K', 'THz/K']],
    ['Radiant power × area', mul(P, pow(L, 2)), ['W·m²', 'W·cm²', 'W·µm²']],
    ['Radiation constant σ', mul(P, mul(pow(L, 2), pow(K, 4)), -1), ['W/(m²·K⁴)', 'W/(cm²·K⁴)', 'erg/(s·cm²·K⁴)']],
    ['Molar volume', mul(pow(L, 3), MOL, -1), ['m³/mol', 'L/mol', 'cm³/mol', 'mL/mol']],
    ['Inverse amount', pow(MOL, -1), ['1/mol', '1/mmol', '1/kmol']],
    ['Charge per amount', mul(CH, MOL, -1), ['C/mol', 'kC/mol', 'mAh/mmol']],
    ['Momentum / impulse', mul(M, V), ['kg·m/s', 'N·s', 'g·cm/s', 'eV/c', 'keV/c', 'MeV/c', 'GeV/c', 'lb·ft/s', 'lbf·s', 'slug·ft/s']],
    ['Angular acceleration', mul(ANG, pow(T, 2), -1), ['rad/s²', '°/s²', 'rev/s²', 'rev/min²']],
    ['Jerk', mul(L, pow(T, 3), -1), ['m/s³', 'cm/s³', 'ft/s³', 'gn/s']],
    ['Moment of inertia', mul(M, pow(L, 2)), ['kg·m²', 'g·cm²', 'kg·cm²', 'g·mm²', 'lb·ft²', 'lb·in²', 'slug·ft²', 'oz·in²']],
    ['Second moment of area', pow(L, 4), ['m⁴', 'cm⁴', 'mm⁴', 'in⁴', 'ft⁴']],
    ['Linear density', mul(M, L, -1), ['kg/m', 'g/m', 'g/cm', 'g/km', 'tex', 'dtex', 'den', 'lb/ft', 'lb/in', 'oz/yd']],
    ['Areal density / grammage', mul(M, pow(L, 2), -1), ['kg/m²', 'g/m²', 'g/cm²', 'mg/cm²', 'µg/cm²', 'lb/ft²', 'oz/yd²']],
    ['Stiffness / surface tension', D({ kg: 1, s: -2 }), ['N/m', 'kN/m', 'N/mm', 'mN/m', 'dyn/cm', 'J/m²', 'lbf/in', 'lbf/ft']],
    ['Energy density', mul(EN, pow(L, 3), -1), ['J/m³', 'kJ/m³', 'MJ/m³', 'J/cm³', 'J/L', 'kWh/m³', 'Wh/L', 'erg/cm³', 'eV/cm³', 'BTU/ft³']],
    ['Power density', mul(P, pow(L, 3), -1), ['W/m³', 'kW/m³', 'W/cm³', 'mW/cm³', 'W/L', 'W/mm³', 'BTU/(h·ft³)']],
    ['Specific power', mul(P, M, -1), ['W/kg', 'kW/kg', 'mW/g', 'W/g', 'hp/lb']],
    ['Thermal resistance', mul(K, P, -1), ['K/W', 'K/mW', '°C/W', '°F·h/BTU']],
    ['Thermal insulance (R-value)', mul(mul(K, pow(L, 2)), P, -1), ['m²·K/W', 'cm²·K/W', 'ft²·°F·h/BTU']],
    ['Volumetric heat capacity', mul(EN, mul(pow(L, 3), K), -1), ['J/(m³·K)', 'J/(cm³·K)', 'MJ/(m³·K)', 'BTU/(ft³·°F)']],
    ['Molar mass', mul(M, MOL, -1), ['kg/mol', 'g/mol', 'Da·NA', 'kg/kmol']],
    ['Molality', mul(MOL, M, -1), ['mol/kg', 'mmol/kg', 'µmol/kg', 'mol/g']],
    ['Catalytic activity', mul(MOL, T, -1), ['kat', 'µkat', 'nkat', 'U', 'mol/s', 'µmol/min']],
    ['Electric dipole moment', mul(CH, L), ['C·m', 'D', 'e₀·Å', 'e₀·nm', 'e₀·a₀', 'statC·cm']],
    ['Charge density (volume)', mul(CH, pow(L, 3), -1), ['C/m³', 'C/cm³', 'µC/cm³', 'e₀/cm³', 'e₀/nm³']],
    ['Surface charge density', mul(CH, pow(L, 2), -1), ['C/m²', 'µC/cm²', 'nC/cm²', 'e₀/cm²', 'e₀/nm²']],
    ['Linear charge density', mul(CH, L, -1), ['C/m', 'µC/m', 'nC/m', 'e₀/nm']],
    ['Current density', mul(I, pow(L, 2), -1), ['A/m²', 'A/cm²', 'mA/cm²', 'µA/cm²', 'A/mm²', 'kA/cm²', 'A/in²']],
    ['Electric conductivity', mul(pow(OHM, -1), L, -1), ['S/m', 'mS/m', 'S/cm', 'mS/cm', 'µS/cm', '1/(Ω·m)']],
    ['Resistance per length', mul(OHM, L, -1), ['Ω/m', 'Ω/km', 'mΩ/m', 'Ω/cm', 'Ω/ft']],
    ['Exposure (X and γ rays)', mul(CH, M, -1), ['C/kg', 'mC/kg', 'R', 'mR', 'µR']],
    ['Dose rate', mul(U.Gy.d, T, -1), ['Gy/s', 'Gy/h', 'mGy/h', 'µGy/h', 'Sv/h', 'mSv/h', 'µSv/h', 'mSv/yr', 'rem/h', 'mrem/h', 'mrem/yr']],
    ['Radiant intensity', mul(P, pow(ANG, 2), -1), ['W/sr', 'mW/sr', 'µW/sr', 'kW/sr']],
    ['Radiance', mul(P, mul(pow(ANG, 2), pow(L, 2)), -1), ['W/(sr·m²)', 'W/(sr·cm²)', 'mW/(sr·cm²)', 'µW/(sr·cm²)', 'W/(sr·mm²)']],
    ['Spectral irradiance (per wavelength)', mul(P, pow(L, 3), -1), ['W/(m²·nm)', 'W/(m²·µm)', 'mW/(cm²·nm)', 'µW/(cm²·nm)', 'W/(cm²·µm)', 'W/m³']],
    ['Spectral radiance (per wavelength)', mul(P, mul(pow(ANG, 2), pow(L, 3)), -1), ['W/(sr·m²·nm)', 'W/(sr·m²·µm)', 'mW/(sr·cm²·nm)', 'µW/(sr·cm²·nm)']],
    ['Spectral power (per wavelength)', mul(P, L, -1), ['W/nm', 'mW/nm', 'µW/nm', 'nW/nm', 'W/µm', 'W/m', 'mW/pm']],
    ['Photon flux density', mul(pow(L, -2), T, -1), ['1/(m²·s)', '1/(cm²·s)', '1/(mm²·s)', '1/(µm²·s)']],
    ['Luminous efficacy', mul(U.lm.d, P, -1), ['lm/W', 'lm/mW']],
    ['Luminous energy', mul(U.lm.d, T), ['lm·s', 'lm·h', 'talbot']],
    ['Luminous exposure', mul(U.lx.d, T), ['lx·s', 'lx·h']],
    ['Frequency chirp / drift rate', pow(T, -2), ['Hz/s', 'kHz/s', 'MHz/s', 'GHz/s', 'THz/s', 'MHz/µs', 'GHz/ns', 'THz/ps', 'Hz/h', 'Hz/d']],
    ['Group-delay dispersion (GDD)', pow(T, 2), ['fs²', 'ps²', 's²']],
    ['Group-velocity dispersion (GVD, β₂)', mul(pow(T, 2), L, -1), ['fs²/mm', 'fs²/cm', 'fs²/m', 'ps²/km', 'ps²/m', 's²/m']],
    ['Third-order dispersion (β₃)', mul(pow(T, 3), L, -1), ['fs³/mm', 'ps³/km', 'ps³/m', 's³/m']],
    ['Dispersion slope', mul(T, pow(L, 3), -1), ['ps/(nm²·km)', 'fs/(nm²·mm)', 's/m³']],
    ['Nonlinear index n₂', mul(pow(L, 2), P, -1), ['m²/W', 'cm²/W', 'cm²/GW', 'cm²/TW', 'µm²/W']],
    ['Nonlinear coefficient γ (fibre)', mul(pow(P, -1), L, -1), ['1/(W·m)', '1/(W·km)', '1/(mW·km)']],
    ['Absorption cross-section', pow(L, 2), ['cm²', 'm²', 'nm²', 'Å²', 'b', 'Mb', 'pm²']],
    ['Fuel economy', pow(L, -2), ['km/L', 'mi/gal', 'mi/impgal', 'm/L', '1/m²']],
    ['Fuel consumption', pow(L, 2), ['L/(100 km)', 'gal/(100 mi)', 'mL/km', 'm²']],
    ['Strain rate / thermal drift', D({ s: -1 }), ['1/s', 'ppm/s', 'ppm/h', 'ppb/s', '1/h', 'ppm/d']],
    ['Velocity per voltage (piezo)', mul(L, VOLT, -1), ['m/V', 'nm/V', 'µm/V', 'pm/V', 'Å/V']],
    ['Frequency per length (tuning)', mul(pow(T, -1), L, -1), ['Hz/m', 'MHz/µm', 'GHz/nm', 'GHz/mm', 'THz/nm']],
    ['Wavelength per kelvin', mul(L, K, -1), ['m/K', 'nm/K', 'pm/K', 'µm/K', 'nm/°C']],
    ['Wavelength per current (laser tuning)', mul(L, I, -1), ['m/A', 'nm/mA', 'pm/mA', 'nm/A']],
    ['Frequency per current (laser tuning)', mul(pow(T, -1), I, -1), ['Hz/A', 'MHz/mA', 'GHz/mA', 'GHz/A']],
    ['Specific detectivity D*', mul(mul(L, pow(T, -0.5)), P, -1), ['cm·Hz^(1/2)/W', 'Jones', 'm·Hz^(1/2)/W']],
    ['Noise-equivalent power (NEP)', mul(P, pow(T, 0.5)), ['W/Hz^(1/2)', 'pW/Hz^(1/2)', 'fW/Hz^(1/2)', 'nW/Hz^(1/2)']],
    ['Noise spectral density (voltage)', mul(VOLT, pow(T, 0.5)), ['V/Hz^(1/2)', 'nV/Hz^(1/2)', 'µV/Hz^(1/2)']],
    ['Noise spectral density (current)', mul(I, pow(T, 0.5)), ['A/Hz^(1/2)', 'pA/Hz^(1/2)', 'fA/Hz^(1/2)']],
    ['Power spectral density', mul(P, T), ['W/Hz', 'mW/Hz', 'mW/MHz', 'nW/Hz', 'J']],
    ['Dimensionless', ONE, ['1', '%', '‰', 'ppm', 'ppb', 'ppt', 'rad/rad']],
  ];
  // dimensionless helpers usable in expressions
  def('%', 0.01, ONE, 0, 'percent'); def('‰', 1e-3, ONE, 0, 'per mille'); def('Jones', 0.01, mul(mul(L, pow(T, -0.5)), P, -1), 0, 'jones (cm·Hz^½/W)'); def('ppm', 1e-6, ONE, 0, 'parts per million'); def('ppb', 1e-9, ONE, 0, 'parts per billion'); def('ppt', 1e-12, ONE, 0, 'parts per trillion');
  def('e₀', E, CH, 0, 'elementary charge', ['qe']); def('hc', H * C0, mul(EN, L), 0, 'h·c'); def('NA', NA, pow(MOL, -1), 0, 'Avogadro constant'); def('k_B', KB, mul(EN, K, -1), 0, 'Boltzmann constant');
  def('ħ', H / (2 * PI), mul(EN, T), 0, 'reduced Planck constant', ['hbar']);

  /** The quantity for a dimension; several quantities can share one (torque and energy), so a preferred name wins. */
  function quantityOf(d, prefer) {
    if (prefer) { const q = QUANTITIES.find((x) => x[0] === prefer && sameDim(x[1], d)); if (q) return q; }
    return QUANTITIES.find((q) => sameDim(q[1], d)) || null;
  }
  function quantitiesOf(d) { return QUANTITIES.filter((q) => sameDim(q[1], d)); }

  /* ---------- the user's own units: [{ sym, def: '25.4 µm', name }] ---------- */
  let USER = [];
  /** Splits "25.4 µm", "1/3 ft", "2.5e-3 W/(m·K)" or "µm" into a factor and a unit. */
  function splitDef(t) {
    const m = String(t).trim().replace(/×\s*10\^?/g, 'e').replace(/−/g, '-').match(/^([-+]?[\d.]+(?:[eE][-+]?\d+)?(?:\s*\/\s*[\d.]+(?:[eE][-+]?\d+)?)?)?\s*(.*)$/);
    const parts = m[1] ? m[1].split('/') : ['1'];
    return { n: parts.length > 1 ? +parts[0] / +parts[1] : +parts[0], unit: m[2].trim() };
  }
  const USER_SYM = /^[A-Za-zµΩÅ][A-Za-zµΩÅ_]*$/;   // no digits: a digit after a unit is read as a power (m2 = m²)
  /** Checks one definition; returns { f, d } or throws with a readable message. */
  function checkUser(sym, defText) {
    if (!USER_SYM.test(sym || '')) throw new Error('Use letters (and _) only for a unit name: a digit after a unit means a power, as in m2 = m²');
    const own = USER.some((x) => x.sym === sym);
    if (U[sym] && !own) throw new Error('“' + sym + '” is already a unit (' + U[sym].name + ')');
    const { n, unit } = splitDef(defText);
    if (!isFinite(n) || n === 0) throw new Error('Start the definition with a number, for example 25.4 µm');
    const p = parse(unit || '1');
    return { f: n * p.f, d: p.d };
  }
  function defineUser(list) {
    for (const x of USER) { delete U[x.sym]; for (const q of QUANTITIES) { const i = q[2].indexOf(x.sym); if (i >= 0) q[2].splice(i, 1); } }
    USER = [];
    for (const x of list || []) {
      try {
        const { f, d } = checkUser(x.sym, x.def);
        def(x.sym, f, d, 0, x.name || x.sym + ' (your unit: ' + x.def + ')');
        U[x.sym].user = true; USER.push(x);
        for (const q of quantitiesOf(d)) if (!q[2].includes(x.sym)) q[2].push(x.sym);
      } catch (e) { /* skip a definition that no longer parses */ }
    }
    return USER.slice();
  }

  /* SI prefix variants of a unit, chosen around the value's magnitude (engineering steps) */
  function prefixed(unitStr, value) {
    const m = /^([A-Za-zΩ]+)(.*)$/.exec(unitStr); if (!m) return [];
    const base = U[m[1]]; if (!base || !base.px) return [];
    const out = [];
    for (const p of ['T', 'G', 'M', 'k', '', 'm', 'µ', 'n', 'p', 'f']) {
      const sym = (p + m[1]) + m[2];
      try { const v = convert(value, unitStr, sym); if (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e6) out.push(sym); } catch (e) { /* skip */ }
    }
    return out;
  }
  /** Alternative units for a quantity given in unit u (value used to keep prefixes sensible). */
  function alternatives(u, value = 1, prefer) {
    let p; try { p = parse(u); } catch (e) { return []; }
    const q = quantityOf(p.d, prefer);
    const set = new Set([u]);
    for (const s of prefixed(u, value)) set.add(s);
    if (q) for (const s of q[2]) { try { if (compatible(u, s)) set.add(s); } catch (e) {} }
    if (/pc\b/.test(u)) { set.add('1/s'); set.add('1/Gyr'); }
    // equivalent SI spelling
    set.add(siText(p.d));
    return [...set].filter((s) => { try { parse(s); return true; } catch (e) { return false; } });
  }
  function siText(d) {
    // Prefer named derived units when they match exactly
    for (const n of ['J', 'W', 'N', 'Pa', 'C', 'V', 'Ω', 'F', 'H', 'T', 'Wb', 'Hz', 'S']) if (sameDim(U[n].d, d)) return n;
    const p = [], q = [];
    d.forEach((e, i) => { if (!e) return; const s = DN[i] + (Math.abs(e) !== 1 ? supNum(Math.abs(e)) : ''); (e > 0 ? p : q).push(s); });
    if (!p.length && !q.length) return '1';
    return (p.join('·') || '1') + (q.length ? '/' + (q.length > 1 ? '(' + q.join('·') + ')' : q[0]) : '');
  }

  /* ---------- spectroscopic equivalents (photon energy ↔ frequency ↔ wavelength ↔ wavenumber ↔ temperature) ---------- */
  const SPEC = {
    energy: (x) => x, freq: (x) => x * H, wavelength: (x) => H * C0 / x, wavenumber: (x) => H * C0 * x, temp: (x) => KB * x, angfreq: (x) => x * H / (2 * PI),
  };
  const SPEC_INV = {
    energy: (E_) => E_, freq: (E_) => E_ / H, wavelength: (E_) => H * C0 / E_, wavenumber: (E_) => E_ / (H * C0), temp: (E_) => E_ / KB, angfreq: (E_) => E_ * 2 * PI / H,
  };
  const SPEC_UNITS = { energy: 'J', freq: 'Hz', wavelength: 'm', wavenumber: '1/m', temp: 'K', angfreq: 'rad/s' };
  function specKind(u) {
    let p; try { p = parse(u); } catch (e) { return null; }
    for (const [k, su] of Object.entries(SPEC_UNITS)) if (sameDim(parse(su).d, p.d)) return k;
    return null;
  }
  /** Photon equivalents of a value in unit u: [{kind, unit, value}] in convenient units. */
  function photonEquivalents(value, u) {
    const k = specKind(u); if (!k || k === 'temp' || !value) return [];
    const Ej = SPEC[k](convert(value, u, SPEC_UNITS[k]));
    if (!(Ej > 0)) return [];
    const pick = (kind, units) => { const si = SPEC_INV[kind](Ej); const conv = units.map((x) => [x, convert(si, SPEC_UNITS[kind], x)]); const best = conv.find(([, v]) => Math.abs(v) >= 1 && Math.abs(v) < 1000) || conv[0]; return { kind, unit: best[0], value: best[1] }; };
    return [
      (() => { const ev = convert(Ej, 'J', 'eV'); return ev >= 0.01 && ev < 1e4 ? { kind: 'energy', unit: 'eV', value: ev } : pick('energy', ['meV', 'keV', 'µeV', 'MeV', 'GeV', 'J']); })(),
      pick('wavelength', ['nm', 'µm', 'mm', 'pm', 'm', 'km']),
      pick('freq', ['THz', 'GHz', 'MHz', 'PHz', 'kHz', 'Hz', 'EHz']),
      pick('wavenumber', ['1/cm']),
      pick('temp', ['K']),
    ].filter((x) => x.kind !== k);
  }
  const SPEC_LABEL = { energy: 'photon energy', freq: 'frequency', wavelength: 'vacuum wavelength', wavenumber: 'wavenumber', temp: 'temperature equivalent E/k', angfreq: 'angular frequency' };

  /* ---------- talking to Giac (the CAS) ----------
     data/giacunits.js lists the names Giac reads exactly as this engine does (ok) and Giac's own spelling for others (alias).
     Every other unit is sent to Giac in SI form, so _Da, _furlong or one of the user's own units still computes correctly. */
  const GU = (root.GIAC_UNITS && { ok: new Set(root.GIAC_UNITS.ok), alias: root.GIAC_UNITS.alias }) || null;
  if (GU) for (const [ours, g] of Object.entries(GU.alias)) if (!lookup(g)) { const o = lookup(ours); if (o) U[g] = { f: o.f, d: o.d, px: false, name: o.name }; }
  const GIAC_BASE = ['m', 'kg', 's', 'A', 'K', 'mol', null, 'rad', null];
  function siGiac(f, d) {
    if (d[6] || d[8]) return null;                                            // candela and bit: Giac has no such base unit
    const parts = []; d.forEach((e, i) => { if (e && GIAC_BASE[i]) parts.push('_' + GIAC_BASE[i] + (e === 1 ? '' : '^' + (Number.isInteger(e) ? e : '(' + e + ')'))); });
    return '(' + num(f, 15) + (parts.length ? '*' + parts.join('*') : '') + ')';
  }
  const UNIT_TOK = /(^|[^\w.])_([A-Za-zµμΩÅ°℃℉⊕☉ₑγ][A-Za-z0-9µμΩÅ°℃℉⊕☉ₑγ₀_]*)/g;
  /** Giac's spelling of one unit name (without the underscore), or its SI form, or null if this engine doesn't know it either. */
  function giacUnit(tok) {
    if (GU && GU.ok.has(tok)) return '_' + tok;
    if (GU && GU.alias[tok]) return '_' + GU.alias[tok];
    const u = lookup(tok); if (!u) return null;
    if (!GU) return '_' + tok;
    return siGiac(u.f, u.d);
  }
  /** Rewrites the unit names in a line of Giac code (strings are left alone). */
  function toGiac(code) {
    return String(code).split(/("(?:[^"\\]|\\.)*")/).map((part, i) => (i % 2 ? part : part.replace(UNIT_TOK, (m, pre, tok) => { const g = giacUnit(tok); return pre + (g || '_' + tok); }))).join('');
  }
  /** true if every unit in the code is one Giac reads correctly as written */
  function giacNative(code) { let ok = true; String(code).replace(UNIT_TOK, (m, pre, tok) => { if (!(GU && GU.ok.has(tok))) ok = false; return m; }); return ok; }
  /** Giac's unit text "(kg*m^2.0*s^-2.0)" or "N*m" in this engine's notation */
  const fromGiacUnit = (u) => String(u).replace(/^\((.*)\)$/, '$1').replace(/\^\(?(-?\d+(?:\.\d+)?)\)?/g, (m, e) => '^' + (+e)).replace(/\*/g, '·').replace(/_/g, '');

  /** A unit in this engine's notation (W/(m·K), m², kg m s^-2) as Giac code (_W/(_m*_K)) or as entry-line LaTeX. */
  function unitTo(str, mode) {
    const tk = tokenize(String(str).trim()); let out = '';
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i], nx = tk[i + 1];
      if (t.t === 'u') out += mode === 'tex' ? '\\mathrm{\\_' + t.v.replace(/μ/g, 'µ').replace(/_/g, '\\_') + '}' : '_' + t.v;
      else if (t.t === 'n') out += String(t.v);
      else if (t.t === 'pow') out += mode === 'tex' ? '^{' + t.v + '}' : '^' + (t.v < 0 || !Number.isInteger(t.v) ? '(' + t.v + ')' : t.v);
      else if (t.t === '*' || t.t === 'sp') out += mode === 'tex' ? '\\cdot ' : '*';
      else if (t.t === '/') out += '/';
      else if (t.t === '(') out += mode === 'tex' ? '\\left(' : '(';
      else if (t.t === ')') out += mode === 'tex' ? '\\right)' : ')';
      // implicit product (kg m)
      if ((t.t === 'u' || t.t === ')' || t.t === 'pow' || t.t === 'n') && nx && (nx.t === 'u' || nx.t === '(' || nx.t === 'n')) out += mode === 'tex' ? '\\cdot ' : '*';
    }
    return out;
  }
  const unitToGiac = (str) => toGiac(unitTo(str, 'giac'));
  const entryTex = (str) => unitTo(str, 'tex');

  /** Tidies a product unit from Giac (W*m*K^-1*m^-1, ft*m, J*s^-1):
   *  · the same unit up and down cancels (W·m/(K·m) → W/K);
   *  · two units of one kind (ft and m, mm and km) → everything in SI base units (ft·m → m²);
   *  · more than one unit that makes a common named unit becomes it (J/s → W, kg·m/s² → N, V·A → W).
   *  N·m is left alone, since it is usually a torque. */
  const NAMED = ['W', 'J', 'N', 'Pa', 'V', 'Ω', 'C', 'F', 'H', 'T', 'Wb', 'S'];
  function simplifyUnit(u) {
    const exps = new Map();
    // factors joined by * and /, with (…) groups: kg*m/s^2, W/(K*m), J*s^-1
    const add = (t, sg) => {
      t = t.trim();
      if (/^\(.*\)$/.test(t)) return walk(t.slice(1, -1), sg);
      const m = t.match(/^([^\^()*\/]+)(?:\^\(?(-?[\d.]+)\)?)?$/); if (!m) return false;
      exps.set(m[1], (exps.get(m[1]) || 0) + sg * (m[2] ? +m[2] : 1)); return true;
    };
    const walk = (str, sg) => {
      let depth = 0, start = 0, cur = sg;
      for (let i = 0; i <= str.length; i++) {
        const c = str[i];
        if (c === '(') depth++; else if (c === ')') depth--;
        else if (i === str.length || (depth === 0 && (c === '*' || c === '/'))) {
          if (!add(str.slice(start, i), cur)) return false;
          cur = c === '/' ? -sg : sg; start = i + 1;
        }
      }
      return depth === 0;
    };
    if (!walk(String(u), 1)) return u;
    for (const [k, e] of exps) if (Math.abs(e) < 1e-9) exps.delete(k);
    if (!exps.size) return '';
    const fmtE = (e) => (Math.abs(e) === 1 ? '' : '^' + (+Math.abs(e).toFixed(6)));
    const build = (m) => { const pos = [], neg = []; for (const [k, e] of m) (e > 0 ? pos : neg).push(k + fmtE(e)); return (pos.join('*') || '1') + (neg.length ? '/' + (neg.length > 1 ? '(' + neg.join('*') + ')' : neg[0]) : ''); };
    const syms = [...exps.keys()], info = syms.map((k) => lookup(k));
    if (info.some((x) => !x)) return build(exps);
    let total; try { total = parse(syms.map((k) => k + '^(' + exps.get(k) + ')').join('*')).d; } catch (e) { return build(exps); }
    if (syms.length > 1) {
      const torque = syms.length === 2 && exps.get('N') === 1 && exps.get('m') === 1;
      if (!torque) for (const n of NAMED) if (sameDim(U[n].d, total)) return n;
      // two units of the same kind → SI base units
      for (let a = 0; a < syms.length; a++) for (let b = a + 1; b < syms.length; b++) if (sameDim(info[a].d, info[b].d)) return siText(total);
      if (syms.every((k) => ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'].includes(k))) return siText(total);
    }
    return build(exps);
  }

  const api = { simplifyUnit, unitToGiac, entryTex, unitTo, toGiac, giacUnit, giacNative, fromGiacUnit, siGiac, parse, convert, compatible, dimText, fmt, num, unitTex, alternatives, quantityOf, quantitiesOf, defineUser, checkUser, splitDef, userUnits: () => USER.slice(), QUANTITIES, U, lookup, photonEquivalents, specKind, SPEC, SPEC_INV, SPEC_UNITS, SPEC_LABEL, siText, sameDim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Units = api;
})(typeof self !== 'undefined' ? self : this);
