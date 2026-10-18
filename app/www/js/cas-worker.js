/*
 * cas-worker.js — runs the Giac computer algebra system (WebAssembly) off the UI thread.
 * Messages in:  {id, op:'eval', code}  |  {id, op:'batch', codes:[...]}
 * Messages out: {id, ok:true, out}      |  {id, ok:false, error}
 * Part of CalcShelf, GPL-3.0-or-later. Giac © Bernard Parisse, GPL-3.0.
 */
'use strict';
let caseval = null, casevalPtr = null;
let printed = [];
const queue = [];

// Helpers that give Giac the TI-Nspire / TI-89 names it doesn't have (TI syntax mode).
const PRELUDE = [
  'xcas_mode(3)',
  'Digits:=12',
  'impDif(ee,vv,ww):=normal(-diff(left(ee)-right(ee),vv)/diff(left(ee)-right(ee),ww))',
  'tangentLine(ff,vv,aa):=normal(subst(ff,vv,aa)+subst(diff(ff,vv),vv,aa)*(vv-aa))',
  'normalLine(ff,vv,aa):=normal(subst(ff,vv,aa)-(vv-aa)/subst(diff(ff,vv),vv,aa))',
  'tiPRx(rr,tt):=rr*cos(tt)', 'tiPRy(rr,tt):=rr*sin(tt)',
  'tiRPr(xx,yy):=sqrt(xx^2+yy^2)', 'tiRPq(xx,yy):=arg(xx+yy*sqrt(-1))',
  'tiSortD(ll):=revlist(sort(ll))',
  'tiTmpCnv(tt,uu):=tt',
  'stddevSamp(ll):=stddevp(ll)',
  'tiNPV(rr,c0,cl):=c0+sum(cl[kk]/(1+rr/100)^kk,kk,1,dim(cl))',
  'tiIRR(c0,cl):=fsolve(c0+sum(cl[kk]/(1+rr_/100)^kk,kk,1,dim(cl))=0,rr_=10)',
  'tiPolar(zz):=[abs(zz),arg(zz)]',
  'tiPolyRoots(pp,vv):=zeros(pp,vv)',
  'tiCPolyRoots(pp,vv):=cZeros(pp,vv)',
  'tiMod(aa,bb):=when(bb==0,aa,aa-bb*floor(aa/bb))',
  'tiCountIf(ll,cc):=size(select(cc,ll))',
  'tiExp2List(ee,vv):=map(when(type(ee)==DOM_LIST,ee,[ee]),uu->right(uu))',
];

let wasmMem = null;
// Giac's TI mode prints the imaginary unit as the lone byte 0xA1, which is not valid UTF-8,
// so read the raw C string and decode it ourselves.
function decode(ptr) {
  const m = new Uint8Array(wasmMem.buffer);
  let out = '', i = ptr;
  while (m[i]) {
    const b = m[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; continue; }
    const n = b >= 0xF0 && b < 0xF8 ? 3 : b >= 0xE0 && b < 0xF0 ? 2 : b >= 0xC0 && b < 0xE0 ? 1 : 0;
    let ok = n > 0;
    for (let k = 1; k <= n && ok; k++) ok = (m[i + k] & 0xC0) === 0x80;
    if (ok) {
      let cp = b & (0x3F >> n);
      for (let k = 1; k <= n; k++) cp = (cp << 6) | (m[i + k] & 0x3F);
      out += String.fromCodePoint(cp); i += n + 1;
    } else { out += b === 0xA1 ? 'i' : String.fromCharCode(b); i++; }
  }
  return out;
}
function evalOne(code) {
  return wasmMem ? decode(casevalPtr(code)) : caseval(code);
}

// The page hands us the Giac glue code and wasm bytes, so this worker makes no network requests
// (Android WebView does not route worker requests through the app's asset loader).
function boot(glue, wasmBytes) {
  self.__ggb__giac = {
    print: (t) => { if (!/^\/\/ /.test(t)) printed.push(t); }, printErr: () => {},
    instantiateWasm(imports, ok) {
      WebAssembly.instantiate(wasmBytes, imports).then((r) => { for (const v of Object.values(r.instance.exports)) if (v instanceof WebAssembly.Memory) wasmMem = v; ok(r.instance); })
        .catch((e) => self.postMessage({ id: 0, ok: false, error: 'Could not start the CAS: ' + e }));
      return {};
    },
    onRuntimeInitialized() {
      caseval = self.__ggb__giac.cwrap('caseval', 'string', ['string']);
      casevalPtr = self.__ggb__giac.cwrap('caseval', 'number', ['string']);
      for (const p of PRELUDE) { try { evalOne(p); } catch (e) { /* ignore */ } }
      self.postMessage({ id: 0, ok: true, ready: true });
      while (queue.length) handle(queue.shift());
    },
  };
  importScripts(URL.createObjectURL(new Blob([glue], { type: 'text/javascript' })));
}

function handle(m) {
  const t0 = performance.now();
  try {
    if (m.op === 'eval') { printed = []; const out = evalOne(m.code); self.postMessage({ id: m.id, ok: true, out, printed: printed.slice(0, 200), ms: performance.now() - t0 }); }
    else if (m.op === 'reset') { evalOne('restart'); for (const p of PRELUDE) { try { evalOne(p); } catch (e) {} } self.postMessage({ id: m.id, ok: true, out: 'ok' }); }
    else if (m.op === 'batch') self.postMessage({ id: m.id, ok: true, out: m.codes.map((c) => { try { return evalOne(c); } catch (e) { return 'GIAC_ERROR: ' + e; } }), ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) });
  }
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.op === 'init') { boot(m.glue, m.wasm); return; }
  if (!caseval) queue.push(m); else handle(m);
};
