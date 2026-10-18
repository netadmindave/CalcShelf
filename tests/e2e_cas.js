// translator → Giac (TI mode + prelude, same as the worker) → formatter
const fs=require('fs');
const {tex2giac}=require('../app/www/js/tex2giac.js');
const F=require('../app/www/js/giacfmt.js');
const src=fs.readFileSync('../app/www/js/cas-worker.js','utf8');
const PRELUDE=eval(src.match(/const PRELUDE = (\[[\s\S]*?\]);/)[1]);
require(process.env.GIAC_NODE || './giacnode.js')().then(ev0=>{
  const ev=ev0;
  PRELUDE.forEach(ev);
  const T=[
   ['\\frac{1}{2}+\\frac{1}{3}','5/6'],['factor\\left(x^2-1\\right)','(x-1)*(x+1)'],['solve\\left(x^2=4,x\\right)','x=-2'],
   ['\\int_{0}^{1}x^2\\,\\mathrm{d}x','1/3'],['\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(\\sin\\left(x\\right)x\\right)','cos'],['\\lim_{x\\to0}\\frac{\\sin\\left(x\\right)}{x}','1'],
   ['\\sum_{n=1}^{\\infty}\\frac{1}{n^2}','pi^2'],['\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}^{-1}','[[-2,1],[3/2,-1/2]]'],['\\lbrace1,2,3\\rbrace\\cdot2','list[2,4,6]'],
   ['\\lbrace1,2\\rbrace+1','list[2,3]'],['\\sqrt{-4}','2*i'],['\\left(2+3i\\right)\\left(1-i\\right)','5+i'],['e^{i\\pi}','-1'],['\\sqrt[3]{-8}','-2'],
   ['taylor\\left(\\sin\\left(x\\right),x,5\\right)','x-1/6*x^3+1/120*x^5'],['deSolve\\left(y\'\'+y=0,x,y\\right)','cos'],['normCdf\\left(-1,1\\right)','0.6826'],
   ['invNorm\\left(0.975\\right)','1.959'],['binomPdf\\left(10,0.5,3\\right)','0.1171'],['stDevSamp\\left(\\lbrace1,2,3,4\\rbrace\\right)','√15'],['mean\\left(\\lbrace1,2,3,4\\rbrace\\right)','5/2'],
   ['impDif\\left(x^2+y^2=1,x,y\\right)','-x/y'],['tangentLine\\left(x^2,x,1\\right)','2*x-1'],['nSolve\\left(\\cos\\left(x\\right)=x,x\\right)','0.739'],
   ['5\\to aa','5'],['aa^2','25'],['\\operatorname{Define}g\\left(x\\right)=x^2+1','Func'],['g\\left(3\\right)','10'],['x^2|x=3','9'],
   ['3\\text{_ft}\\to\\text{_m}','0.9144_m'],['zeros\\left(x^3-x,x\\right)','[0,1,-1]'],['propFrac\\left(\\frac{7}{3}\\right)','2+1/3'],['cSolve\\left(x^2+1=0,x\\right)','x=i'],
   ['\\log_{2}\\left(8\\right)','3'],['\\log\\left(1000\\right)','3'],['\\ln\\left(e^{2}\\right)','2'],['5!','120'],['nCr\\left(5,2\\right)','10'],['\\left|-3\\right|','3'],
   ['\\begin{vmatrix}1&2\\\\3&4\\end{vmatrix}','-2'],['eigVl\\left(\\begin{pmatrix}2 & 1\\\\ 1 & 2\\end{pmatrix}\\right)','[3,1]'],['randInt\\left(1,6\\right)',''],
   ['\\frac{\\mathrm{d}^{2}}{\\mathrm{d}x^{2}}\\left(x^4\\right)','12*x^2'],['\\prod_{k=1}^{5}k','120'],['\\lim_{x\\to0^{+}}\\frac{1}{x}','infinity'],['expand\\left(\\left(x+1\\right)^3\\right)','x^3+3*x^2+3*x+1'],
   ['\\begin{cases}x & x>0\\\\ -x & \\text{otherwise}\\end{cases}','piecewise'],['laplace\\left(\\sin\\left(t\\right),t,s\\right)','1/(s^2+1)'],['30\\degree','pi/6'],
  ];
  let ok=0;
  for(const [tex,want] of T){ let g,r,tx; try{ g=tex2giac(tex); r=ev(g); tx=F.giacToTex(r);}catch(e){r='EXC '+e.message}
    const pass=r && r.includes(want) && !/GIAC_ERROR/.test(r); if(pass) ok++; console.log(pass?'ok  ':'FAIL', tex.padEnd(52).slice(0,52),'|',g,'=>',String(r).slice(0,60).replace(/\n/g,' '),'|',String(tx).slice(0,60)); }
  console.log(ok+'/'+T.length);
});
