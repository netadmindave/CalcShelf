global.self=global;
require('../app/www/data/formulas.js');
const F=require('../app/www/js/giacfmt.js');
const fs=require('fs');
const src=fs.readFileSync('../app/www/js/cas-worker.js','utf8');
const PRELUDE=eval(src.match(/const PRELUDE = (\[[\s\S]*?\]);/)[1]);
function parseSolutions(res,U){ if(!res||/GIAC_ERROR|Error/.test(res)) return []; let ast; try{ast=F.parse(res)}catch(e){return []}
  const vals=[]; const walk=(n)=>{ if(!n)return; if(n.t==='vec')n.items.forEach(walk); else if(n.t==='paren')walk(n.a); else if(n.t==='bin'&&(n.op==='or'||n.op==='and')){walk(n.a);walk(n.b)} else if(n.t==='bin'&&n.op==='='&&n.a.t==='id'&&n.a.v===U) vals.push(n.b); else if(n.t==='num'||n.t==='neg'||(n.t==='bin'&&!/zv/.test(JSON.stringify(n)))) vals.push(n); };
  walk(ast); const out=[]; for(const v of vals){ try{ const x=F.compile(v,[])(); if(typeof x==='number'&&isFinite(x)) out.push(x);}catch(e){} } return out; }
require(process.env.GIAC_NODE || './giacnode.js')().then(ev=>{
  PRELUDE.forEach(ev);
  let total=0, fail=0, skipped=0;
  const solve=(f,unknown,vals)=>{ const map={}; f.v.forEach(([n],i)=>map[n]='zv'+i); const eq=f.eq.replace(/\b[A-Za-z]\w*\b/g,(w)=>map[w]||w);
    const kv=[],vo={}; for(const [n] of f.v){ if(n===unknown)continue; vo[map[n]]='('+vals[n]+')'; kv.push(vo[map[n]]); }
    const sub=eq.replace(/\bzv\d+\b/g,(z)=>vo[z]||z); const U=map[unknown];
    const mags=new Set(['1','0.1','10','-1']); for(const v of kv){ const x=Math.abs(Number(ev('evalf('+v+')'))); if(isFinite(x)&&x>0){mags.add(String(x));mags.add(String(1/x));} }
    const tries=['solve(exact('+sub+'),'+U+')','solve('+sub+','+U+')',...[...mags].slice(0,10).map(g=>'fsolve('+sub+','+U+'='+g+')')];
    const all=[]; for(const t of tries) for(const x of parseSolutions(ev(t),U)) if(!all.some(y=>Math.abs(y-x)<=1e-9*Math.max(1,Math.abs(x)))) all.push(x);
    return all.filter(x=>{const L=Number(ev('evalf(subst(left('+sub+'),'+U+','+x+'))')),R=Number(ev('evalf(subst(right('+sub+'),'+U+','+x+'))')); return isFinite(L)&&isFinite(R)&&Math.abs(L-R)<=1e-7*(Math.abs(L)+Math.abs(R))+1e-300;}); };
  for(const f of FORMULAS){
    // random but sensible values (angles 0.2–1.2 rad, others 0.5–3, integers where obviously discrete)
    const vals={}; for(const [n,d,u,def] of f.v){ vals[n]= def!==undefined && def!=='' && !/^0$/.test(def) ? def : (u==='rad'? (0.2+Math.random()).toFixed(4) : /order|number of|turns|mode number|bits|n1|n2|level/.test(d)||/^n[12]$|^N$|^m$/.test(n) && /order|level|turns|terms|fringes|grooves|mode/.test(d) ? String(1+Math.floor(Math.random()*3)) : (0.5+2.5*Math.random()).toFixed(4)); }
    // physically constrained cases
    if (/Critical angle/.test(f.n)) { vals.n1='1.5'; vals.n2='1'; }
    if (/Rydberg/.test(f.n)) { vals.n1='2'; vals.n2='3'; }
    if (/Fresnel reflectance/.test(f.n)) { vals.n1='1'; vals.n2='1.5'; }
    if (/Carnot/.test(f.n)) { vals.Th='400'; vals.Tc='300'; }
    if (/Lorentz factor/.test(f.n)) { vals.v='1e8'; }
    if (/Fiber numerical/.test(f.n)) { vals.n1='1.47'; vals.n2='1.46'; }
    if (/Compton|Photon lifetime|threshold/.test(f.n)) { vals.R1='0.9'; vals.R2='0.95'; }
    if (/Finesse|Airy transmission/.test(f.n)) { vals.R='0.9'; }
    if (/Sagitta/.test(f.n)) { vals.R='5'; vals.y='1'; }
    if (/Heron/.test(f.n)) { vals.a='3'; vals.b='4'; vals.c='5'; }
    if (/Law of sines|Law of cosines/.test(f.n)) { }
    const first=f.v[0][0];
    const s0=solve(f,first,vals); if(!s0.length){ console.log('NO SOLUTION', f.n, 'for', first, JSON.stringify(vals)); fail++; total++; continue; }
    vals[first]=String(s0[0]);
    for(const [n] of f.v.slice(1)){
      total++;
      const orig=Number(F.compile(F.parse(ev('evalf('+vals[n]+')')),[])());
      const s=solve(f,n,vals);
      const ok=s.some((x)=>Math.abs(x-orig)<=1e-6*Math.max(1,Math.abs(orig)));
      if(!ok){ fail++; console.log('MISMATCH', f.n.padEnd(42), 'var', n, 'want', orig, 'got', JSON.stringify(s)); }
    }
    total++;
  }
  console.log(FORMULAS.length,'formulas,',total,'solves,',fail,'problems');
});
