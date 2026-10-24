// The Machinist module: speeds and feeds, threads (pitch, tap drills, thread data, wires), drills (number, letter,
// fractional, metric), clearance holes, shop calculators and a G-code and M-code reference.
// Drill and tap data: number and letter drills as in ASME B94.11M; tap drills from Starrett's decimal and tap chart;
// metric clearance holes from ISO 273. Every metric equivalent is computed (1 in = 25.4 mm exactly).
module.exports = function machinist() {
  const MM = 25.4;
  const f4 = (x) => x.toFixed(4).replace(/^0\./, '.');
  const mm = (inch, d = 3) => (inch * MM).toFixed(d);
  const inch = (m) => f4(m / MM);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (n, d) => { const w = Math.floor(n / d), r = n % d, g = gcd(r, d); return (w ? w + (r ? '-' : '') : '') + (r ? r / g + '/' + d / g : ''); };

  /* ---------------- drills */
  const NUMBER = [0.228, 0.221, 0.213, 0.209, 0.2055, 0.204, 0.201, 0.199, 0.196, 0.1935, 0.191, 0.189, 0.185, 0.182, 0.18, 0.177, 0.173, 0.1695, 0.166, 0.161,
    0.159, 0.157, 0.154, 0.152, 0.1495, 0.147, 0.144, 0.1405, 0.136, 0.1285, 0.12, 0.116, 0.113, 0.111, 0.11, 0.1065, 0.104, 0.1015, 0.0995, 0.098,
    0.096, 0.0935, 0.089, 0.086, 0.082, 0.081, 0.0785, 0.076, 0.073, 0.07, 0.067, 0.0635, 0.0595, 0.055, 0.052, 0.0465, 0.043, 0.042, 0.041, 0.04,
    0.039, 0.038, 0.037, 0.036, 0.035, 0.033, 0.032, 0.031, 0.0292, 0.028, 0.026, 0.025, 0.024, 0.0225, 0.021, 0.02, 0.018, 0.016, 0.0145, 0.0135];
  const LETTER = { A: 0.234, B: 0.238, C: 0.242, D: 0.246, E: 0.25, F: 0.257, G: 0.261, H: 0.266, I: 0.272, J: 0.277, K: 0.281, L: 0.29, M: 0.295, N: 0.302, O: 0.316, P: 0.323, Q: 0.332, R: 0.339, S: 0.348, T: 0.358, U: 0.368, V: 0.377, W: 0.386, X: 0.397, Y: 0.404, Z: 0.413 };
  const numberRows = NUMBER.map((d, i) => ['#' + (i + 1), f4(d), mm(d)]);
  const letterRows = Object.entries(LETTER).map(([k, d]) => [k, f4(d), mm(d)]);
  const fracRows = []; for (let n = 1; n <= 64; n++) fracRows.push([frac(n, 64) + '"', f4(n / 64), mm(n / 64)]);
  const metric = []; for (let x = 3; x <= 100; x++) metric.push(x / 10); for (let x = 10.5; x <= 20; x += 0.5) metric.push(x); for (let x = 21; x <= 32; x++) metric.push(x);
  const metricRows = metric.map((m) => [m.toFixed(m < 10 ? 1 : 1) + ' mm', inch(m), m.toFixed(2)]);
  const allDrills = [
    ...NUMBER.map((d, i) => ['Number', '#' + (i + 1), d]),
    ...Object.entries(LETTER).map(([k, d]) => ['Letter', k, d]),
    ...fracRows.map((r, i) => ['Fraction', r[0], (i + 1) / 64]),
    ...metric.map((m) => ['Metric', m.toFixed(1) + ' mm', m / MM]),
  ].sort((a, b) => a[2] - b[2]).map(([t, s, d]) => [s, t, f4(d), mm(d)]);

  /* ---------------- threads */
  const drillIn = (s) => { if (s[0] === '#') return NUMBER[+s.slice(1) - 1]; if (LETTER[s]) return LETTER[s]; const m = s.match(/^(?:(\d+)-)?(\d+)\/(\d+)$/); return m ? (+(m[1] || 0)) + m[2] / m[3] : NaN; };
  const MAJOR = { '#0': 0.06, '#1': 0.073, '#2': 0.086, '#3': 0.099, '#4': 0.112, '#5': 0.125, '#6': 0.138, '#8': 0.164, '#10': 0.19, '#12': 0.216 };
  const majorOf = (s) => MAJOR[s] || (() => { const m = s.match(/^(?:(\d+)-)?(\d+)(?:\/(\d+))?$/); return m[3] ? (+(m[1] || 0)) + m[2] / m[3] : +m[2]; })();
  // [size, TPI, series, tap drill (75 % nominal)]
  const UN = [['#0', 80, 'UNF', '3/64'], ['#1', 64, 'UNC', '#53'], ['#1', 72, 'UNF', '#53'], ['#2', 56, 'UNC', '#50'], ['#2', 64, 'UNF', '#50'], ['#3', 48, 'UNC', '#47'], ['#3', 56, 'UNF', '#45'],
    ['#4', 40, 'UNC', '#43'], ['#4', 48, 'UNF', '#42'], ['#5', 40, 'UNC', '#38'], ['#5', 44, 'UNF', '#37'], ['#6', 32, 'UNC', '#36'], ['#6', 40, 'UNF', '#33'], ['#8', 32, 'UNC', '#29'], ['#8', 36, 'UNF', '#29'],
    ['#10', 24, 'UNC', '#25'], ['#10', 32, 'UNF', '#21'], ['#12', 24, 'UNC', '#16'], ['#12', 28, 'UNF', '#14'], ['1/4', 20, 'UNC', '#7'], ['1/4', 28, 'UNF', '#3'], ['5/16', 18, 'UNC', 'F'], ['5/16', 24, 'UNF', 'I'],
    ['3/8', 16, 'UNC', '5/16'], ['3/8', 24, 'UNF', 'Q'], ['7/16', 14, 'UNC', 'U'], ['7/16', 20, 'UNF', '25/64'], ['1/2', 13, 'UNC', '27/64'], ['1/2', 20, 'UNF', '29/64'], ['9/16', 12, 'UNC', '31/64'], ['9/16', 18, 'UNF', '33/64'],
    ['5/8', 11, 'UNC', '17/32'], ['5/8', 18, 'UNF', '37/64'], ['3/4', 10, 'UNC', '21/32'], ['3/4', 16, 'UNF', '11/16'], ['7/8', 9, 'UNC', '49/64'], ['7/8', 14, 'UNF', '13/16'], ['1', 8, 'UNC', '7/8'], ['1', 12, 'UNF', '59/64'], ['1', 14, 'UNS', '15/16'],
    ['1-1/8', 7, 'UNC', '63/64'], ['1-1/8', 12, 'UNF', '1-3/64'], ['1-1/4', 7, 'UNC', '1-7/64'], ['1-1/4', 12, 'UNF', '1-11/64'], ['1-3/8', 6, 'UNC', '1-7/32'], ['1-3/8', 12, 'UNF', '1-19/64'], ['1-1/2', 6, 'UNC', '1-11/32'], ['1-1/2', 12, 'UNF', '1-27/64']];
  const unRows = UN.map(([s, tpi, ser, d]) => { const D = majorOf(s), t = drillIn(d), pct = (D - t) * tpi / 0.01299; return [s + '-' + tpi + ' ' + ser, f4(D), d, f4(t), mm(t, 2), Math.round(pct) + ' %']; });
  // [thread, pitch, tap drill mm]; coarse first, then fine
  const ISO = [['M1.6', 0.35, 1.25], ['M2', 0.4, 1.6], ['M2.5', 0.45, 2.05], ['M3', 0.5, 2.5], ['M3.5', 0.6, 2.9], ['M4', 0.7, 3.3], ['M5', 0.8, 4.2], ['M6', 1, 5], ['M7', 1, 6], ['M8', 1.25, 6.8], ['M10', 1.5, 8.5],
    ['M12', 1.75, 10.2], ['M14', 2, 12], ['M16', 2, 14], ['M18', 2.5, 15.5], ['M20', 2.5, 17.5], ['M22', 2.5, 19.5], ['M24', 3, 21], ['M27', 3, 24], ['M30', 3.5, 26.5], ['M33', 3.5, 29.5], ['M36', 4, 32], ['M39', 4, 35],
    ['M8', 1, 7], ['M10', 1.25, 8.8], ['M10', 1, 9], ['M12', 1.5, 10.5], ['M12', 1.25, 10.8], ['M14', 1.5, 12.5], ['M16', 1.5, 14.5], ['M18', 1.5, 16.5], ['M20', 1.5, 18.5], ['M22', 1.5, 20.5], ['M24', 2, 22], ['M27', 2, 25], ['M30', 2, 28], ['M33', 2, 31], ['M36', 3, 33], ['M39', 3, 36]];
  const COARSE = new Set(ISO.slice(0, 23).map((r) => r[0] + 'x' + r[1]));
  const isoRows = ISO.map(([s, p, d]) => { const D = +s.slice(1), pct = (D - d) / p * 76.98; return [s + ' × ' + p, COARSE.has(s + 'x' + p) ? 'coarse' : 'fine', d.toFixed(2), inch(d), (D - p).toFixed(2), Math.round(pct) + ' %', (MM / p).toFixed(2)]; });
  const NPT = [['1/16', 27, '1/4'], ['1/8', 27, '11/32'], ['1/4', 18, '7/16'], ['3/8', 18, '37/64'], ['1/2', 14, '23/32'], ['3/4', 14, '59/64'], ['1', 11.5, '1-5/32'], ['1-1/4', 11.5, '1-1/2'], ['1-1/2', 11.5, '1-3/4'], ['2', 11.5, '2-7/32'], ['2-1/2', 8, '2-21/32'], ['3', 8, '3-1/4'], ['3-1/2', 8, '3-3/4'], ['4', 8, '4-1/4']];
  const nptRows = NPT.map(([s, t, d]) => [s + '-' + t + ' NPT', d, f4(drillIn(d)), mm(drillIn(d), 2)]);
  const TPIS = [4, 4.5, 5, 6, 7, 8, 9, 10, 11, 11.5, 12, 13, 14, 16, 18, 19, 20, 24, 27, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80];
  const PITCHES = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  const pitchRows = [...TPIS.map((t) => [t + ' TPI', String(t), (MM / t).toFixed(4), f4(1 / t)]), ...PITCHES.map((p) => [p + ' mm', (MM / p).toFixed(3), p.toFixed(2), inch(p)])];

  /* ---------------- clearance holes */
  const CLR_IN = [['#0', 0.06, '#52', '#50'], ['#1', 0.073, '#48', '#46'], ['#2', 0.086, '#43', '#41'], ['#3', 0.099, '#37', '#35'], ['#4', 0.112, '#32', '#30'], ['#5', 0.125, '#30', '#29'], ['#6', 0.138, '#27', '#25'],
    ['#8', 0.164, '#18', '#16'], ['#10', 0.19, '#9', '#7'], ['#12', 0.216, '#2', '#1'], ['1/4', 0.25, 'F', 'H'], ['5/16', 0.3125, 'P', 'Q'], ['3/8', 0.375, 'W', 'X'], ['7/16', 0.4375, '29/64', '15/32'], ['1/2', 0.5, '33/64', '17/32'],
    ['5/8', 0.625, '41/64', '21/32'], ['3/4', 0.75, '49/64', '25/32'], ['7/8', 0.875, '57/64', '29/32'], ['1', 1, '1-1/64', '1-1/32']];
  const clrInRows = CLR_IN.map(([s, D, c, f]) => [s, f4(D), c, f4(drillIn(c)), f, f4(drillIn(f))]);
  const CLR_MM = [['M1.6', 1.7, 1.8, 2], ['M2', 2.2, 2.4, 2.6], ['M2.5', 2.7, 2.9, 3.1], ['M3', 3.2, 3.4, 3.6], ['M4', 4.3, 4.5, 4.8], ['M5', 5.3, 5.5, 5.8], ['M6', 6.4, 6.6, 7], ['M8', 8.4, 9, 10], ['M10', 10.5, 11, 12],
    ['M12', 13, 13.5, 14.5], ['M14', 15, 15.5, 16.5], ['M16', 17, 17.5, 18.5], ['M20', 21, 22, 24], ['M24', 25, 26, 28], ['M30', 31, 33, 35]];
  const clrMmRows = CLR_MM.map(([s, a, b, c]) => [s, a.toFixed(1), b.toFixed(1), c.toFixed(1)]);

  /* ---------------- speeds */
  const SPEEDS = [['Aluminum alloys', 250, 600, 600, 1500], ['Brass, bronze (free-cutting)', 150, 300, 400, 800], ['Copper', 100, 200, 300, 600], ['Gray cast iron', 50, 100, 250, 450], ['Low-carbon steel (1018, 12L14)', 80, 120, 350, 600],
    ['Medium-carbon steel (1045)', 60, 90, 300, 500], ['Alloy steel (4140, annealed)', 50, 80, 250, 450], ['Tool steel (annealed)', 30, 60, 150, 300], ['Stainless 303, 416', 60, 100, 300, 500], ['Stainless 304, 316', 40, 70, 200, 400],
    ['Titanium 6Al-4V', 20, 40, 100, 200], ['Inconel 718', 10, 20, 60, 120], ['Plastics (acetal, nylon, PEEK)', 300, 800, 500, 1500]];
  const ft2m = (x) => Math.round(x * 0.3048);
  const speedRows = SPEEDS.map(([m, a, b, c, d]) => [m, a + '–' + b, c + '–' + d, ft2m(a) + '–' + ft2m(b), ft2m(c) + '–' + ft2m(d)]);
  const speedOptions = SPEEDS.flatMap(([m, a, b, c, d]) => [{ label: m + ' — HSS', value: String(Math.round((a + b) / 2)) }, { label: m + ' — carbide', value: String(Math.round((c + d) / 2)) }]);

  /* ---------------- G and M codes */
  const G = [
    ['G00', 'Both', 'Rapid move', 'Fastest traverse; not for cutting'], ['G01', 'Both', 'Linear move at feed F', ''], ['G02', 'Both', 'Arc clockwise', 'With R (radius) or I J K (centre offsets)'], ['G03', 'Both', 'Arc counter-clockwise', 'With R or I J K'],
    ['G04', 'Both', 'Dwell', 'P in ms (P1000 = 1 s), or X/U in seconds, by control'], ['G09', 'Both', 'Exact stop (this block)', ''], ['G10', 'Both', 'Set offsets from the program', 'L2 work offsets, L1/L10–L13 tool offsets (Fanuc)'],
    ['G15 / G16', 'Mill', 'Polar coordinates off / on', ''], ['G17', 'Mill', 'XY plane', 'Default for arcs and cutter comp'], ['G18', 'Both', 'ZX plane', 'Default on lathes'], ['G19', 'Mill', 'YZ plane', ''],
    ['G20', 'Both', 'Inch units', ''], ['G21', 'Both', 'Metric units', ''], ['G28', 'Both', 'Return to machine home', 'Through the point given; G91 G28 Z0 goes straight up'], ['G30', 'Both', 'Return to second reference point', ''],
    ['G31', 'Both', 'Skip (probe) move', 'Stops when the probe trips'], ['G32', 'Lathe', 'Single threading pass', 'F = lead'], ['G40', 'Both', 'Cutter / nose-radius comp off', ''], ['G41', 'Both', 'Cutter comp left', 'D offset on a mill'],
    ['G42', 'Both', 'Cutter comp right', ''], ['G43', 'Mill', 'Tool length comp +', 'With H, usually H = tool number'], ['G44', 'Mill', 'Tool length comp −', 'Rarely used'], ['G49', 'Mill', 'Tool length comp off', ''],
    ['G50', 'Lathe', 'Spindle speed limit (with S) / coordinate set', 'Fanuc lathe group A'], ['G50 / G51', 'Mill', 'Scaling off / on', ''], ['G50.1 / G51.1', 'Mill', 'Mirror image off / on', ''],
    ['G52', 'Both', 'Local coordinate shift', 'G52 X0 Y0 cancels'], ['G53', 'Both', 'Machine coordinates (this block)', ''], ['G54–G59', 'Both', 'Work offsets 1–6', ''], ['G54.1 P1–P48', 'Mill', 'Extra work offsets', 'G110–G129 on Haas'],
    ['G61', 'Both', 'Exact stop mode', ''], ['G64', 'Both', 'Cutting (blending) mode', ''], ['G65', 'Both', 'Macro call', ''], ['G68 / G69', 'Mill', 'Rotation on / off', ''],
    ['G70', 'Lathe', 'Finishing cycle', 'G70 P(ns) Q(nf)'], ['G71', 'Lathe', 'Rough turning cycle', 'G71 U(depth) R(retract) / G71 P Q U(X allow.) W(Z allow.) F'], ['G72', 'Lathe', 'Rough facing cycle', ''], ['G73', 'Lathe', 'Pattern repeat cycle', ''],
    ['G73', 'Mill', 'High-speed peck drilling', 'Chip-break; small retract'], ['G74', 'Lathe', 'Face grooving / Z peck drilling', ''], ['G74', 'Mill', 'Left-hand tapping', ''], ['G75', 'Lathe', 'Grooving cycle (X)', ''],
    ['G76', 'Lathe', 'Multi-pass threading cycle', 'G76 P(mm rr aa) Q(min depth) R(finish) / G76 X Z R(taper) P(height) Q(1st depth) F(lead)'], ['G76', 'Mill', 'Fine boring', 'Spindle orients and shifts before retract'],
    ['G80', 'Both', 'Cancel canned cycle', ''], ['G81', 'Mill', 'Drill (spot)', 'G81 X Y Z R F'], ['G82', 'Mill', 'Drill with dwell (counterbore, spot face)', 'G82 X Y Z R P F'], ['G83', 'Mill', 'Peck drill, full retract', 'G83 X Y Z R Q(peck) F'],
    ['G84', 'Mill', 'Tapping (right hand)', 'F = S × pitch (mm/min or in/min); M29 for rigid tapping on Fanuc'], ['G85', 'Mill', 'Bore, feed out', ''], ['G86', 'Mill', 'Bore, spindle stop, rapid out', ''], ['G87', 'Mill', 'Back bore', ''],
    ['G88', 'Mill', 'Bore, dwell, manual out', ''], ['G89', 'Mill', 'Bore, dwell, feed out', ''], ['G90', 'Mill', 'Absolute positioning', ''], ['G90', 'Lathe', 'Turning cycle (OD/ID)', 'Fanuc lathe group A'],
    ['G91', 'Mill', 'Incremental positioning', 'Lathes use U and W for incremental'], ['G92', 'Lathe', 'Threading cycle', 'Group A'], ['G92', 'Mill', 'Set work coordinates (shift)', 'Prefer G54–G59'], ['G94', 'Mill', 'Feed per minute', ''],
    ['G94', 'Lathe', 'Facing cycle', 'Group A'], ['G95', 'Mill', 'Feed per revolution', ''], ['G96', 'Lathe', 'Constant surface speed', 'S in ft/min (G20) or m/min (G21); limit with G50'], ['G97', 'Lathe', 'Constant spindle speed (RPM)', ''],
    ['G98', 'Mill', 'Canned cycle: return to initial plane', ''], ['G98', 'Lathe', 'Feed per minute', 'Group A'], ['G99', 'Mill', 'Canned cycle: return to R plane', ''], ['G99', 'Lathe', 'Feed per revolution', 'Group A']];
  const M = [['M00', 'Program stop', 'Press cycle start to continue'], ['M01', 'Optional stop', 'Only with the optional-stop switch on'], ['M02', 'End of program', ''], ['M03', 'Spindle on, clockwise', 'With S'], ['M04', 'Spindle on, counter-clockwise', ''],
    ['M05', 'Spindle stop', ''], ['M06', 'Tool change', 'With T'], ['M07', 'Mist coolant on', 'Varies; through-spindle on some machines'], ['M08', 'Flood coolant on', ''], ['M09', 'Coolant off', ''],
    ['M10 / M11', '4th-axis or chuck clamp / unclamp', 'Varies by machine'], ['M19', 'Spindle orient', ''], ['M29', 'Rigid tapping mode', 'Fanuc, before G84'], ['M30', 'End of program, rewind', ''], ['M41 / M42', 'Low / high gear range', 'Lathes and some mills'],
    ['M48 / M49', 'Override switches enabled / locked', ''], ['M97', 'Local subprogram call', 'Haas: M97 P(line)'], ['M98', 'Subprogram call', 'M98 P(program) L(repeats)'], ['M99', 'Subprogram return, or loop the main program', '']];
  const ADDR = [['N', 'Line (sequence) number'], ['O', 'Program number'], ['G', 'Preparatory function (motion and modes)'], ['M', 'Machine function'], ['X Y Z', 'Linear axes'], ['U V W', 'Incremental X Y Z (lathes)'], ['A B C', 'Rotary axes'],
    ['I J K', 'Arc centre offsets from the start point'], ['R', 'Arc radius; R plane in canned cycles'], ['F', 'Feed rate'], ['S', 'Spindle speed (RPM, or surface speed with G96)'], ['T', 'Tool number (and offset on lathes: T0101)'],
    ['H', 'Tool length offset number'], ['D', 'Cutter radius (diameter) offset number'], ['P', 'Dwell time; subprogram number; parameter'], ['Q', 'Peck depth; parameter'], ['L', 'Repeat count'], ['E', 'Thread lead (some controls)'], ['%', 'Tape start and end'], ['( )', 'Comment']];

  const num = (o) => o;
  const IN = ['in', 'mm'], LEN = ['in', 'mm', 'thou'];

  return {
    format: 'calcshelf-module', formatVersion: 1,
    id: 'machinist', name: 'Machinist', tab: 'Machinist', version: '1.0.0', icon: 'machinist',
    author: 'CalcShelf', license: 'GPL-3.0-or-later', homepage: 'https://github.com/netadmindave/CalcShelf/tree/main/modules',
    description: 'Shop tools for machinists: speeds and feeds, thread pitch and tap drills, number, letter, fractional and metric drills with their metric and inch sizes, clearance holes, shop calculators, and a G-code and M-code reference.',
    sections: [
      { title: 'Speeds & feeds', items: [
        num({ type: 'calc', title: 'Spindle speed from surface speed', tex: 'N=\\frac{12\\,V_c}{\\pi D}',
          inputs: [{ id: 'Vc', label: 'Surface speed', unit: 'ft/min', default: '300', units: ['ft/min', 'm/min'] }, { id: 'D', label: 'Tool or work diameter', unit: 'in', default: '0.5', units: IN }],
          outputs: [{ label: 'Spindle speed', expr: '12*Vc/(pi*D)', unit: 'rpm', units: ['rpm'], digits: 4 }] }),
        num({ type: 'calc', title: 'Spindle speed for a material', tex: 'N=\\frac{12\\,V_c}{\\pi D}',
          note: 'The middle of the starting range in the cutting-speed table. Adjust for the tool maker’s data, rigidity and coolant.',
          inputs: [{ id: 'Vc', label: 'Material and tool', options: speedOptions, default: 9 }, { id: 'D', label: 'Tool or work diameter', unit: 'in', default: '0.5', units: IN }],
          outputs: [{ label: 'Surface speed', expr: 'Vc', unit: 'ft/min', units: ['ft/min', 'm/min'], digits: 4 }, { label: 'Spindle speed', expr: '12*Vc/(pi*D)', unit: 'rpm', units: ['rpm'], digits: 4 }] }),
        num({ type: 'calc', title: 'Surface speed from spindle speed', tex: 'V_c=\\frac{\\pi DN}{12}',
          inputs: [{ id: 'N', label: 'Spindle speed', unit: 'rpm', default: '2000', units: ['rpm'] }, { id: 'D', label: 'Diameter', unit: 'in', default: '0.5', units: IN }],
          outputs: [{ label: 'Surface speed', expr: 'pi*D*N/12', unit: 'ft/min', units: ['ft/min', 'm/min'], digits: 4 }] }),
        num({ type: 'calc', title: 'Milling feed rate', tex: 'F=N\\,f_z\\,z',
          inputs: [{ id: 'N', label: 'Spindle speed', unit: 'rpm', default: '3000', units: ['rpm'] }, { id: 'fz', label: 'Chip load per tooth', unit: 'in', default: '0.002', units: ['in', 'mm', 'thou'] }, { id: 'z', label: 'Number of teeth (flutes)', default: '4' }],
          outputs: [{ label: 'Feed rate', expr: 'N*fz*z', unit: 'in/min', units: ['in/min', 'mm/min'], digits: 4 }] }),
        num({ type: 'calc', title: 'Chip load from feed rate', tex: 'f_z=\\frac{F}{N\\,z}',
          inputs: [{ id: 'F', label: 'Feed rate', unit: 'in/min', default: '24', units: ['in/min', 'mm/min'] }, { id: 'N', label: 'Spindle speed', unit: 'rpm', default: '3000', units: ['rpm'] }, { id: 'z', label: 'Number of teeth', default: '4' }],
          outputs: [{ label: 'Chip load per tooth', expr: 'F/(N*z)', unit: 'in', units: ['in', 'mm', 'thou'], digits: 4 }] }),
        num({ type: 'calc', title: 'Drilling and turning feed', tex: 'F=N\\,f_r',
          inputs: [{ id: 'N', label: 'Spindle speed', unit: 'rpm', default: '1000', units: ['rpm'] }, { id: 'fr', label: 'Feed per revolution', unit: 'in', default: '0.004', units: ['in', 'mm', 'thou'] }],
          outputs: [{ label: 'Feed rate', expr: 'N*fr', unit: 'in/min', units: ['in/min', 'mm/min'], digits: 4 }] }),
        num({ type: 'calc', title: 'Material removal rate (milling)', tex: 'Q=a_e\\,a_p\\,F',
          inputs: [{ id: 'ae', label: 'Width of cut (WOC)', unit: 'in', default: '0.25', units: IN }, { id: 'ap', label: 'Depth of cut (DOC)', unit: 'in', default: '0.5', units: IN }, { id: 'F', label: 'Feed rate', unit: 'in/min', default: '30', units: ['in/min', 'mm/min'] }],
          outputs: [{ label: 'Removal rate', expr: 'ae*ap*F', unit: 'in³/min', units: ['in³/min', 'cm³/min', 'mm³/min'], digits: 4 }] }),
        num({ type: 'calc', title: 'Cutting time', tex: 't=\\frac{L}{f_r N}',
          inputs: [{ id: 'L', label: 'Length of cut', unit: 'in', default: '4', units: IN }, { id: 'fr', label: 'Feed per revolution', unit: 'in', default: '0.008', units: ['in', 'mm', 'thou'] }, { id: 'N', label: 'Spindle speed', unit: 'rpm', default: '800', units: ['rpm'] }],
          outputs: [{ label: 'Time', expr: 'L/(fr*N)', unit: 'min', units: ['min', 's'], digits: 4 }] }),
        { type: 'table', title: 'Cutting speeds (starting values)', columns: ['Material', 'HSS (ft/min)', 'Carbide (ft/min)', 'HSS (m/min)', 'Carbide (m/min)'], rows: speedRows,
          note: 'Typical starting ranges for turning and milling. Drilling usually runs at the low end and tapping lower still. Follow the tool maker’s figures where you have them.' },
      ] },
      { title: 'Threads', items: [
        { type: 'table', title: 'Unified (inch) tap drills', columns: ['Thread', 'Major dia (in)', 'Tap drill', 'Drill (in)', 'Drill (mm)', '≈ thread'], rows: unRows, near: [{ col: 3, label: 'in' }, { col: 4, label: 'mm' }],
          note: 'Tap drills for about 75 % thread (Starrett chart); the last column is the thread depth that drill gives, from % = (D − drill) · TPI / 0.01299.' },
        { type: 'table', title: 'Metric (ISO) tap drills', columns: ['Thread', 'Series', 'Tap drill (mm)', 'Drill (in)', 'D − P (mm)', '≈ thread', 'TPI equivalent'], rows: isoRows, near: [{ col: 2, label: 'mm' }, { col: 3, label: 'in' }],
          note: 'Tap drills from Starrett’s chart (M8 × 1.25 uses the common 6.8 mm). % thread = (D − drill) / P × 76.98.' },
        { type: 'table', title: 'Pipe tap drills (NPT)', columns: ['Thread', 'Tap drill', 'Drill (in)', 'Drill (mm)'], rows: nptRows,
          note: 'Drill sizes for tapping without reaming (Starrett chart). With a taper pipe reamer, drill one size smaller.' },
        { type: 'table', title: 'Thread pitch and TPI', columns: ['Thread', 'TPI', 'Pitch (mm)', 'Pitch (in)'], rows: pitchRows, near: [{ col: 2, label: 'mm pitch' }, { col: 1, label: 'TPI' }] },
        num({ type: 'calc', title: 'TPI to pitch', tex: 'P=\\frac{25.4}{TPI}\\ \\mathrm{mm}',
          inputs: [{ id: 't', label: 'Threads per inch', default: '13' }],
          outputs: [{ label: 'Pitch', expr: '1/t', unit: 'in', units: ['in', 'mm'], digits: 6 }, { label: 'Pitch in millimetres', expr: '25.4/t', unit: 'mm', digits: 5 }] }),
        num({ type: 'calc', title: 'Pitch to TPI', tex: 'TPI=\\frac{25.4}{P}',
          inputs: [{ id: 'p', label: 'Pitch', unit: 'mm', default: '1.5', units: ['mm', 'in'] }],
          outputs: [{ label: 'Threads per inch', expr: '25.4/p', digits: 6 }] }),
        num({ type: 'calc', title: 'Tap drill for a thread percentage (inch)', tex: 'd=D-\\frac{0.01299\\cdot\\%}{TPI}',
          inputs: [{ id: 'D', label: 'Major diameter', unit: 'in', default: '0.25', units: IN }, { id: 't', label: 'Threads per inch', default: '20' }, { id: 'pc', label: 'Thread percentage', unit: '%', default: '75' }],
          outputs: [{ label: 'Tap drill', expr: 'D-0.01299*pc/t', unit: 'in', units: IN, digits: 4 }],
          note: 'Then look up the nearest drill in the Drills table. 60–75 % is usual; tough materials take less.' }),
        num({ type: 'calc', title: 'Thread percentage from a drill (inch)', tex: '\\%=\\frac{(D-d)\\,TPI}{0.01299}',
          inputs: [{ id: 'D', label: 'Major diameter', unit: 'in', default: '0.25', units: IN }, { id: 't', label: 'Threads per inch', default: '20' }, { id: 'd', label: 'Drill diameter', unit: 'in', default: '0.201', units: IN }],
          outputs: [{ label: 'Thread percentage', expr: '(D-d)*t/0.01299', unit: '%', digits: 3 }] }),
        num({ type: 'calc', title: 'Tap drill for a thread percentage (metric)', tex: 'd=D-\\frac{\\%\\cdot P}{76.98}',
          inputs: [{ id: 'D', label: 'Major diameter', unit: 'mm', default: '10', units: ['mm', 'in'] }, { id: 'p', label: 'Pitch', unit: 'mm', default: '1.5', units: ['mm', 'in'] }, { id: 'pc', label: 'Thread percentage', unit: '%', default: '75' }],
          outputs: [{ label: 'Tap drill', expr: 'D-pc*p/76.98', unit: 'mm', units: ['mm', 'in'], digits: 4 }, { label: 'A D − P drill gives', expr: '76.98', unit: '%', digits: 4 }] }),
        num({ type: 'calc', title: 'Unified thread dimensions', tex: 'd_2=D-0.649519P,\\ H=0.866025P',
          note: 'Basic (nominal) dimensions for a 60° thread, P = 1/TPI. Tolerances by class are not included.',
          inputs: [{ id: 'D', label: 'Major diameter', unit: 'in', default: '0.5', units: IN }, { id: 't', label: 'Threads per inch', default: '13' }],
          outputs: [{ id: 'P', label: 'Pitch', expr: '1/t', unit: 'in', units: IN, digits: 5 },
            { label: 'Pitch diameter', expr: 'D-0.649519*P', unit: 'in', units: IN, digits: 5 },
            { label: 'Minor diameter, internal', expr: 'D-1.082532*P', unit: 'in', units: IN, digits: 5 },
            { label: 'Minor diameter, external (UNR root)', expr: 'D-1.190750*P', unit: 'in', units: IN, digits: 5 },
            { label: 'Thread height, external', expr: '0.613435*P', unit: 'in', units: IN, digits: 5 },
            { label: 'Thread height, internal', expr: '0.541266*P', unit: 'in', units: IN, digits: 5 },
            { label: 'Fundamental triangle height H', expr: '0.866025*P', unit: 'in', units: IN, digits: 5 },
            { label: 'Compound infeed at 29.5° for the full external depth', expr: '0.613435*P/cos(29.5*pi/180)', unit: 'in', units: IN, digits: 5 }] }),
        num({ type: 'calc', title: 'Metric thread dimensions', tex: 'd_2=d-0.649519P',
          note: 'Basic ISO dimensions (ISO 724). Tolerances by class are not included.',
          inputs: [{ id: 'D', label: 'Major diameter', unit: 'mm', default: '10', units: ['mm', 'in'] }, { id: 'p', label: 'Pitch', unit: 'mm', default: '1.5', units: ['mm', 'in'] }],
          outputs: [{ label: 'Pitch diameter', expr: 'D-0.649519*p', unit: 'mm', units: ['mm', 'in'], digits: 5 },
            { label: 'Minor diameter, internal D₁', expr: 'D-1.082532*p', unit: 'mm', units: ['mm', 'in'], digits: 5 },
            { label: 'Minor diameter, external d₃', expr: 'D-1.226869*p', unit: 'mm', units: ['mm', 'in'], digits: 5 },
            { label: 'Thread height, external', expr: '0.613435*p', unit: 'mm', units: ['mm', 'in'], digits: 5 },
            { label: 'Fundamental triangle height H', expr: '0.866025*p', unit: 'mm', units: ['mm', 'in'], digits: 5 }] }),
        num({ type: 'calc', title: 'Three-wire thread measurement', tex: 'M=E+3W-0.866025P',
          note: 'For 60° threads. E is the pitch diameter you want; the best wire touches at the pitch line.',
          inputs: [{ id: 'E', label: 'Pitch diameter E', unit: 'in', default: '0.4500', units: IN }, { id: 't', label: 'Threads per inch', default: '13' }, { id: 'W', label: 'Wire diameter used', unit: 'in', default: '0.0444', units: IN }],
          outputs: [{ label: 'Measurement over wires M', expr: 'E+3*W-0.866025/t', unit: 'in', units: IN, digits: 5 },
            { label: 'Best wire size', expr: '0.57735/t', unit: 'in', units: IN, digits: 5 },
            { label: 'Smallest and largest wire that work', expr: '[0.505182/t, 1.010363/t]', unit: 'in', format: 'list', digits: 5 }] }),
      ] },
      { title: 'Drills', items: [
        { type: 'table', title: 'All drills by size', columns: ['Drill', 'Type', 'Inch', 'mm'], rows: allDrills, near: [{ col: 2, label: 'inches' }, { col: 3, label: 'mm' }],
          note: 'Number, letter, fractional (to 1 in) and metric drills together, smallest first. Type a size to see the nearest drills.' },
        { type: 'table', title: 'Number drills', columns: ['Drill', 'Inch', 'mm'], rows: numberRows, near: [{ col: 1, label: 'inches' }, { col: 2, label: 'mm' }] },
        { type: 'table', title: 'Letter drills', columns: ['Drill', 'Inch', 'mm'], rows: letterRows, near: [{ col: 1, label: 'inches' }, { col: 2, label: 'mm' }] },
        { type: 'table', title: 'Fractional drills and decimal equivalents', columns: ['Fraction', 'Inch', 'mm'], rows: fracRows, near: [{ col: 1, label: 'inches' }, { col: 2, label: 'mm' }] },
        { type: 'table', title: 'Metric drills', columns: ['Drill', 'Inch', 'mm'], rows: metricRows, near: [{ col: 2, label: 'mm' }, { col: 1, label: 'inches' }],
          note: '0.3–10 mm in 0.1 mm steps, 10–20 mm in 0.5 mm steps, 20–32 mm in 1 mm steps.' },
        { type: 'table', title: 'Clearance holes, inch screws', columns: ['Screw', 'Major dia (in)', 'Close fit', 'Close (in)', 'Free fit', 'Free (in)'], rows: clrInRows },
        { type: 'table', title: 'Clearance holes, metric screws (ISO 273)', columns: ['Screw', 'Fine (mm)', 'Medium (mm)', 'Coarse (mm)'], rows: clrMmRows },
        num({ type: 'calc', title: 'Drill point length', tex: 'L=\\frac{D/2}{\\tan(\\theta/2)}', angles: 'deg',
          inputs: [{ id: 'D', label: 'Drill diameter', unit: 'in', default: '0.5', units: IN }, { id: 'a', label: 'Point angle', unit: '°', default: '118', units: ['°'] }],
          outputs: [{ label: 'Length of the point', expr: 'D/2/tan(a/2)', unit: 'in', units: IN, digits: 4 }] }),
        num({ type: 'calc', title: 'Countersink depth', tex: 'h=\\frac{(D_c-d)/2}{\\tan(\\theta/2)}', angles: 'deg',
          note: 'Depth from the surface to reach the countersink diameter D_c. Use d = 0 for a sharp point.',
          inputs: [{ id: 'Dc', label: 'Countersink diameter at the surface', unit: 'in', default: '0.5', units: IN }, { id: 'd', label: 'Diameter at the bottom (0 for a point)', unit: 'in', default: '0', units: IN },
            { id: 'a', label: 'Countersink angle', options: [{ label: '82° (inch flat-head screws)', value: '82' }, { label: '90° (metric screws, chamfers)', value: '90' }, { label: '100°', value: '100' }, { label: '120°', value: '120' }, { label: '60° (centre drills)', value: '60' }], default: 0 }],
          outputs: [{ label: 'Depth', expr: '(Dc-d)/2/tan(a/2)', unit: 'in', units: IN, digits: 4 }] }),
      ] },
      { title: 'Shop math', items: [
        num({ type: 'calc', title: 'Decimal to nearest fraction', tex: '\\frac{\\mathrm{round}(xn)}{n}',
          inputs: [{ id: 'x', label: 'Size', unit: 'in', default: '0.3125', units: IN }, { id: 'n', label: 'Nearest', options: [{ label: '1/64', value: '64' }, { label: '1/32', value: '32' }, { label: '1/16', value: '16' }, { label: '1/8', value: '8' }, { label: '1/128', value: '128' }], default: 0 }],
          outputs: [{ id: 'f', label: 'Nearest fraction', expr: 'round(x*n)/n', unit: 'in', format: 'exact' }, { label: 'Difference (size − fraction)', expr: 'x-f', unit: 'in', units: ['in', 'thou', 'mm'], digits: 4 }] }),
        num({ type: 'calc', title: 'Inch and metric', tex: '1\\,\\mathrm{in}=25.4\\,\\mathrm{mm}',
          inputs: [{ id: 'x', label: 'Length', unit: 'in', default: '1', units: ['in', 'mm', 'thou', 'ft', 'µm', 'cm'] }],
          outputs: [{ label: 'Inches', expr: 'x', unit: 'in', digits: 6 }, { label: 'Millimetres', expr: 'x*25.4', unit: 'mm', digits: 6 }, { label: 'Thousandths', expr: 'x*1000', unit: 'thou', digits: 6 }] }),
        num({ type: 'calc', title: 'Bolt circle', tex: 'x_k=x_0+\\frac D2\\cos\\left(\\theta_0+\\frac{360k}{N}\\right)', angles: 'deg',
          note: 'Hole centres, starting at angle θ₀ from the +X axis and going counter-clockwise.',
          inputs: [{ id: 'N', label: 'Number of holes', default: '6' }, { id: 'D', label: 'Bolt circle diameter', unit: 'in', default: '4', units: IN }, { id: 'a0', label: 'Angle of the first hole θ₀', unit: '°', default: '0', units: ['°'] },
            { id: 'X0', label: 'Centre X', unit: 'in', default: '0', units: IN }, { id: 'Y0', label: 'Centre Y', unit: 'in', default: '0', units: IN }],
          outputs: [{ label: 'Hole centres [hole, X, Y]', expr: 'seq([k, round(10000*(X0+D/2*cos(a0+360*(k-1)/N)))/10000, round(10000*(Y0+D/2*sin(a0+360*(k-1)/N)))/10000], k, 1, N)', format: 'list' },
            { label: 'Distance between neighbouring holes', expr: 'D*sin(180/N)', unit: 'in', units: IN, digits: 5 }] }),
        num({ type: 'calc', title: 'Sine bar height', tex: 'h=L\\sin\\theta', angles: 'deg',
          inputs: [{ id: 'L', label: 'Sine bar length', unit: 'in', default: '5', units: IN }, { id: 'a', label: 'Angle', unit: '°', default: '30', units: ['°'] }],
          outputs: [{ label: 'Gauge block stack', expr: 'L*sin(a)', unit: 'in', units: IN, digits: 5 }] }),
        num({ type: 'calc', title: 'Sine bar angle', tex: '\\theta=\\arcsin\\frac hL', angles: 'deg',
          inputs: [{ id: 'L', label: 'Sine bar length', unit: 'in', default: '5', units: IN }, { id: 'h', label: 'Gauge block stack', unit: 'in', default: '2.5', units: IN }],
          outputs: [{ label: 'Angle', expr: 'asin(h/L)', unit: '°', units: ['°'], digits: 6 }] }),
        num({ type: 'calc', title: 'Taper', tex: 'TPF=\\frac{12(D-d)}{L}', angles: 'deg',
          inputs: [{ id: 'D', label: 'Large diameter', unit: 'in', default: '1', units: IN }, { id: 'd', label: 'Small diameter', unit: 'in', default: '0.75', units: IN }, { id: 'L', label: 'Length of the taper', unit: 'in', default: '3', units: IN }],
          outputs: [{ label: 'Taper per foot', expr: '12*(D-d)/L', unit: 'in/ft', digits: 5 }, { label: 'Taper per inch', expr: '(D-d)/L', unit: 'in/in', digits: 5 },
            { label: 'Included angle', expr: '2*atan((D-d)/(2*L))', unit: '°', units: ['°'], digits: 5 }, { label: 'Compound (half) angle to set', expr: 'atan((D-d)/(2*L))', unit: '°', units: ['°'], digits: 5 }] }),
        num({ type: 'calc', title: 'Chord, radius and sagitta', tex: 's=R-\\sqrt{R^2-c^2/4}',
          inputs: [{ id: 'R', label: 'Radius', unit: 'in', default: '2', units: IN }, { id: 'c', label: 'Chord length', unit: 'in', default: '3', units: IN }],
          outputs: [{ label: 'Sagitta (arc height)', expr: 'R-sqrt(R^2-c^2/4)', unit: 'in', units: IN, digits: 5 }, { label: 'Arc length', expr: '2*R*asin(c/(2*R))', unit: 'in', units: IN, digits: 5 }] }),
        num({ type: 'calc', title: 'Bar stock weight', tex: 'W=kd^2L\\rho',
          inputs: [{ id: 'k', label: 'Shape', options: [{ label: 'Round (d = diameter)', value: 'pi/4' }, { label: 'Hexagon (d = across flats)', value: 'sqrt(3)/2' }, { label: 'Square (d = side)', value: '1' }], default: 0 },
            { id: 'd', label: 'Size d', unit: 'in', default: '1', units: IN }, { id: 'L', label: 'Length', unit: 'in', default: '12', units: ['in', 'mm', 'ft', 'm'] },
            { id: 'rho', label: 'Material', options: [{ label: 'Steel (0.2836 lb/in³)', value: '0.2836' }, { label: 'Stainless steel (0.289)', value: '0.289' }, { label: 'Aluminum (0.0975)', value: '0.0975' }, { label: 'Brass (0.307)', value: '0.307' }, { label: 'Copper (0.323)', value: '0.323' }, { label: 'Cast iron (0.260)', value: '0.26' }, { label: 'Titanium (0.160)', value: '0.16' }, { label: 'Acetal (0.051)', value: '0.051' }], default: 0 }],
          outputs: [{ label: 'Weight', expr: 'k*d^2*L*rho', unit: 'lb', units: ['lb', 'kg', 'oz', 'g'], digits: 4 }] }),
        num({ type: 'calc', title: 'Surface finish Ra', tex: 'R_a[\\mu\\mathrm m]=0.0254\\,R_a[\\mu\\mathrm{in}]',
          inputs: [{ id: 'r', label: 'Ra', unit: 'µin', default: '63', units: ['µin', 'µm'] }],
          outputs: [{ label: 'Ra', expr: 'r', unit: 'µin', digits: 4 }, { label: 'Ra', expr: 'r*0.0254', unit: 'µm', digits: 4 }, { label: 'RMS (Rq ≈ 1.11 Ra, typical)', expr: '1.11*r', unit: 'µin', units: ['µin', 'µm'], digits: 3 }] }),
      ] },
      { title: 'G & M codes', items: [
        { type: 'table', title: 'G codes', columns: ['Code', 'Machine', 'Function', 'Notes'], rows: G, note: 'Fanuc-style codes; lathes use group A unless noted. Codes vary by control and builder, so check your machine’s manual before running a program.' },
        { type: 'table', title: 'M codes', columns: ['Code', 'Function', 'Notes'], rows: M, note: 'Common M codes. Many builders add their own above M50.' },
        { type: 'table', title: 'Address letters', columns: ['Letter', 'Meaning'], rows: ADDR },
        { type: 'text', title: 'Canned cycle formats (mill)', md: [
          '```', 'G81 X Y Z R F         drill', 'G82 X Y Z R P F       drill, dwell P at the bottom', 'G83 X Y Z R Q F       peck drill, peck depth Q', 'G73 X Y Z R Q F       chip-break peck', 'G84 X Y Z R F         tap; F = S × pitch', 'G80                   cancel', '```',
          'G98 returns to the start height between holes and G99 to the R plane. Z is the bottom of the hole and R the height where feeding starts.'].join('\n') },
        { type: 'text', title: 'A typical program start', md: [
          '```', '%', 'O1001 (PART NAME)', 'G20 G17 G40 G49 G80 G90   (safe start: inch, XY, cancel comp and cycles, absolute)', 'T1 M06                    (tool 1)', 'G54 G00 X0 Y0             (work offset, rapid to start)', 'S2000 M03                 (spindle on)', 'G43 H01 Z1.0 M08          (length offset, coolant)', '...', 'M09', 'G91 G28 Z0                (home Z)', 'M30', '%', '```',
          'An example only: check the safe-start line and the homing moves for your control.'].join('\n') },
      ] },
    ],
  };
};
