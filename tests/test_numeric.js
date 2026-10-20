// Node tests for js/numeric.js: table reading, fitting with uncertainties, peaks/FWHM, FFT, smoothing, baseline.
const N = require('../app/www/js/numeric.js'), G = require('../app/www/js/giacfmt.js');
let ok = 0, bad = 0; const check = (name, cond, info = '') => { if (cond) ok++; else bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const near = (a, b, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
// --- tables
const osa = `"[Header]"\n"Model","AQ6370D"\n"Center Wavelength",1550.000\n"Resolution",0.020\n\n"Wavelength(nm)","Level(dBm)"\n1549.00,-60.1\n1549.01,-59.9\n1549.02,-40.0\n1549.03,-59.8\n`;
let t = N.parseTable(osa);
check('OSA csv: header row and block', t.names.join('|') === 'Wavelength(nm)|Level(dBm)' && t.cols[0].length === 4 && t.cols[1][2] === -40, t.names.join('|'));
check('unit from column name', N.unitFromName(t.names[0]) === 'nm');
t = N.parseTable('# scope export\nt\tch1\tch2\n0\t1.5\t2\n1e-6\t1.6\t2.1\n2e-6\t1.7\t2.2\n');
check('tab separated with comment', t.cols.length === 3 && t.cols[0][1] === 1e-6 && t.names[1] === 'ch1');
t = N.parseTable('x;y\n1,5;2,25\n2,5;6,25\n3,5;12,25\n');
check('semicolon with decimal commas', t.cols[0][0] === 1.5 && t.cols[1][2] === 12.25);
t = N.parseTable('1 2\n3 4\n5 6\n');
check('whitespace, no header', t.names.join() === 'x,y' && t.cols[1][2] === 6);
// --- fitting a Gaussian with noise, known σ
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const xs = [], ys = [];
for (let i = 0; i < 400; i++) { const x = 1549 + i * 0.005; xs.push(x); ys.push(3 * Math.exp(-4 * Math.LN2 * ((x - 1550) / 0.08) ** 2) + 0.2 + 0.01 * gauss()); }
const pre = N.PRESETS.find((p) => p[0] === 'gauss');
const f0 = G.compile(pre[2], ['x', ...pre[3]]);
const p0 = pre[4](xs, ys);
const r = N.fit((x, p) => f0(x, ...p), xs, ys, p0, { sigma: xs.map(() => 0.01) });
check('Gaussian fit converges', r.converged && near(r.p[1], 1550, 1e-6) && near(r.p[2], 0.08, 0.02), r.p.map((v) => v.toPrecision(7)).join(', '));
check('reduced chi² ≈ 1 with true σ', r.redchi2 > 0.8 && r.redchi2 < 1.2, r.redchi2.toFixed(3));
check('uncertainty of x0 reasonable', r.sd[1] > 1e-5 && r.sd[1] < 1e-3 && Math.abs(r.p[1] - 1550) < 4 * r.sd[1], 'σ(x0)=' + r.sd[1].toExponential(2));
// without σ the scale comes from the residuals
const r2 = N.fit((x, p) => f0(x, ...p), xs, ys, p0);
check('fit without σ scales errors', near(r2.sd[1], r.sd[1], 0.15), r2.sd[1].toExponential(2));
// fixed parameter
const r3 = N.fit((x, p) => f0(x, ...p), xs, ys, [p0[0], p0[1], 0.08, 0.2], { fixed: [false, false, true, true] });
check('fixed parameters stay', r3.p[2] === 0.08 && r3.p[3] === 0.2 && r3.sd[2] === 0);
// straight line exact
const lx = [0, 1, 2, 3, 4], ly = lx.map((x) => 2 * x + 1);
const lr = N.fit((x, p) => p[0] * x + p[1], lx, ly, [0, 0]);
check('line fit exact', near(lr.p[0], 2) && near(lr.p[1], 1) && lr.r2 > 0.999999);
check('model parameters found', N.modelParams('A*exp(-4*ln(2)*((x-x0)/w)^2)+c').join() === 'A,x0,w,c');
// --- peaks and FWHM
const pk = N.peaks(xs, ys, { prominence: 0.2 });
check('one peak found', pk.length === 1 && near(pk[0].x, 1550, 1e-5), JSON.stringify(pk.map((p) => [p.x.toFixed(4), p.fwhm.toFixed(4)])));
check('FWHM from data', near(pk[0].fwhm, 0.08, 0.05), pk[0].fwhm.toFixed(4));
check('area ≈ A·w·√(π/4ln2)', near(pk[0].area, 3 * 0.08 * Math.sqrt(Math.PI / (4 * Math.LN2)), 0.05), pk[0].area.toFixed(4));
const dips = N.peaks([0, 1, 2, 3, 4], [5, 5, 1, 5, 5], { dips: true });
check('dips', dips.length === 1 && dips[0].x === 2 && dips[0].y === 1);
// --- FFT of a 50 Hz sine sampled at 1 kHz
const tx = [], ty = []; for (let i = 0; i < 1000; i++) { tx.push(i / 1000); ty.push(2 * Math.sin(2 * Math.PI * 50 * i / 1000) + 0.5); }
const sp = N.spectrum(tx, ty, { window: 'hann' });
let km = 1; for (let k = 2; k < sp.amp.length; k++) if (sp.amp[k] > sp.amp[km]) km = k;
check('FFT peak at 50 Hz', Math.abs(sp.f[km] - 50) < sp.df, sp.f[km].toFixed(2) + ' Hz, df ' + sp.df.toFixed(3));
check('FFT amplitude ≈ 2 (Hann, coherent gain corrected)', Math.abs(sp.amp[km] - 2) < 0.3, sp.amp[km].toFixed(3));
// --- smoothing / baseline / derivative
const sg = N.savgol(ly, 5, 2);
check('Savitzky–Golay keeps a line', sg.every((v, i) => near(v, ly[i], 1e-9)));
const dsg = N.savgol(xs.map((x) => x * x), 7, 2, 1, 0.005);
check('Savitzky–Golay derivative of x²', near(dsg[200], 2 * xs[200], 1e-6), dsg[200] + ' vs ' + 2 * xs[200]);
const by = xs.map((x, i) => ys[i] + 0.5 * (x - 1549));
const bl = N.baseline(xs, by, 1);
check('baseline under a peak', Math.abs(bl[0] - 0.2) < 0.05 && Math.abs(bl[399] - (0.2 + 0.5 * 1.995)) < 0.05, bl[0].toFixed(3) + ' ' + bl[399].toFixed(3));
check('stats', N.stats([1, 2, 3, 4]).mean === 2.5 && near(N.stats([1, 2, 3, 4]).sd, 1.2909944, 1e-6));
console.log(ok + '/' + (ok + bad));
process.exit(bad ? 1 : 0);
