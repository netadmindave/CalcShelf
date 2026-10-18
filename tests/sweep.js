const fs=require('fs');
global.self=global;
require('../app/www/js/menus.js');
const {tex2giac}=require('../app/www/js/tex2giac.js');
const F=require('../app/www/js/giacfmt.js');
const src=fs.readFileSync('../app/www/js/cas-worker.js','utf8');
const PRELUDE=eval(src.match(/const PRELUDE = (\[[\s\S]*?\]);/)[1]);
const SAMPLE={isPrime:['97'],ifactor:['360'],divisors:['12'],sign:['-3'],floor:['-2.5'],rectangular:['2\\exponentialE^{\\imaginaryI\\frac{\\pi}{4}}'],polar:['1+\\imaginaryI'],
 lcm:['12','18'],gcd:['12','18'],remain:['17','5'],round:['3.14159','2'],mod:['17','5'],solve:['x^2=4','x'],zeros:['x^2-4','x'],nSolve:['\\cos\\left(x\\right)=x','x'],
 polyRoots:['x^2-2','x'],cPolyRoots:['x^2+1','x'],polyRemainder:['x^3+2','x+1','x'],polyQuotient:['x^3+1','x+1','x'],polyGcd:['x^2-1','x-1'],polyCoeffs:['x^2+3x+2','x'],polyDegree:['x^3+1','x'],polyEval:['\\lbrace1,2,3\\rbrace','2'],
 cSolve:['x^2+1=0','x'],cZeros:['x^2+1','x'],completeSquare:['x^2+4x+1','x'],fMin:['x^2-2x','x'],fMax:['-x^2+2x','x'],tangentLine:['x^2','x','1'],normalLine:['x^2','x','1'],arcLen:['x^2','x','0','1'],
 taylor:['\\sin\\left(x\\right)','x','5','0'],series:['e^{x}','x','3'],deSolve:["y'=y",'x','y'],impDif:['x^2+y^2=1','x','y'],laplace:['\\sin\\left(t\\right)','t','s'],ilaplace:['\\frac{1}{s^2+1}','s','t'],
 fourier:['e^{-x^2}','x','w'],ifourier:['e^{-w^2}','w','x'],nDeriv:['x^3','x','1'],nInt:['e^{-x^2}','x','0','1'],nPr:['5','2'],nCr:['5','2'],randInt:['1','6'],randNorm:['0','1'],randBin:['10','0.5'],sample:['\\lbrace1,2,3\\rbrace','2'],
 RandSeed:['42'],normPdf:['0','0','1'],normCdf:['-1','1','0','1'],invNorm:['0.975','0','1'],tPdf:['1','10'],tCdf:['-1','1','10'],invt:['0.975','10'],chi2Pdf:['2','3'],chi2Cdf:['0','2','3'],invChi2:['0.95','3'],
 FPdf:['1','3','4'],FCdf:['0','1','3','4'],invF:['0.95','3','4'],binomPdf:['10','0.5','3'],binomCdf:['10','0.5','2','4'],invBinom:['0.5','10','0.5'],poissPdf:['3','2'],poissCdf:['3','1','2'],geomPdf:['0.3','2'],geomCdf:['0.3','1','2'],
 seq:['k^2','k','1','5'],augment:['\\lbrace1,2\\rbrace','\\lbrace3\\rbrace'],'list▸mat':['\\lbrace1,2,3,4\\rbrace','2'],left:['\\lbrace1,2,3\\rbrace','2'],right:['\\lbrace1,2,3\\rbrace','2'],mid:['\\lbrace1,2,3,4\\rbrace','2','2'],
 correlation:['\\lbrace1,2,3\\rbrace','\\lbrace2,4,7\\rbrace'],covariance:['\\lbrace1,2,3\\rbrace','\\lbrace2,4,7\\rbrace'],simult:['\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}','\\begin{pmatrix}5\\\\ 6\\end{pmatrix}'],
 newMat:['2','2'],randMat:['2','2'],rowSwap:['M','1','2'],rowAdd:['M','1','2'],mRow:['3','M','1'],mRowAdd:['3','M','1','2'],charpoly:['M','x'],crossP:['\\lbrace1,0,0\\rbrace','\\lbrace0,1,0\\rbrace'],dotP:['\\lbrace1,2\\rbrace','\\lbrace3,4\\rbrace'],
 npv:['10','-100','\\lbrace50,60\\rbrace'],irr:['-100','\\lbrace50,60\\rbrace'],when:['1>0','1','2'],assume:['x>0'],convert:['255'],
};
const LISTF=new Set(['min','max','mean','median','sum','product','stDevSamp','stDevPop','varSamp','varPop','quartiles','SortA','SortD','cumSum','mat▸list','deltalist','dim']);
const MATF=new Set(['identity','diag','det','ref','rref','norm','rowNorm','colNorm','rowDim','colDim','lu','qr','eigVl','eigVc','jordan','exp','unitV','transpose']);
require(process.env.GIAC_NODE || './giacnode.js')().then(ev0=>{
  const ev=ev0; PRELUDE.forEach(ev); ev('M:=[[1,2],[3,4]]');
  let n=0, bad=0;
  const walk=(items,path)=>{ for(const [label,v] of items){ if(Array.isArray(v)) { walk(v,path+' › '+label); continue; } if(typeof v!=='string') continue;
     const m=v.match(/operatorname\{([^}]+)\}/); const name=m?m[1]:null;
     let args = SAMPLE[name] || (LISTF.has(name)?['\\lbrace3,1,2,5\\rbrace']:MATF.has(name)?['\\begin{pmatrix}2 & 1\\\\ 1 & 2\\end{pmatrix}']:['x^2-1','x','1','2']);
     if (name==='identity') args=['3']; if(name==='exp') args=['\\begin{pmatrix}0 & 1\\\\ 0 & 0\\end{pmatrix}'];
     let k=0; const fill=()=>args[k++]||'2';
     let tex=v.replace(/#0|#\?/g, fill);
     if(/Define/.test(v)) tex=v.replace('#?','g').replace('#?','x^2+1');
     if(/^\\int_/.test(v)) tex='\\int_{0}^{1}x^2\\,\\mathrm{d}x'; if(/^\\int /.test(v)) tex='\\int x^2\\,\\mathrm{d}x'; if(/^\\lim/.test(v)) tex='\\lim_{x\\to0}\\frac{\\sin\\left(x\\right)}{x}';
     if(/cases/.test(v) && /solve/.test(v)) tex='\\operatorname{solve}\\left(\\begin{cases}x+y=3 \\\\ x-y=1\\end{cases},\\lbrace x,y\\rbrace\\right)';
     if(!name && !/Define|\\int|\\lim/.test(v)){ tex=v.replace(/#0/g,'x^2').replace(/#\?/g,()=>['x','0','1','3'][k++%4]); }
     let g,r; try{ g=tex2giac(tex); r=ev(g); }catch(e){ r='TRANSLATE: '+e.message; }
     n++; const isBad=/GIAC_ERROR|Error|TRANSLATE|undef/.test(r) || (name && new RegExp('^'+name.replace(/[▸]/g,'.')+'\\(').test(r));
     if(isBad){bad++; console.log('BAD', (path+' › '+label).padEnd(60).slice(-60),'|',g,'=>',String(r).slice(0,90).replace(/\n/g,' '));}
  }};
  walk(NspireMenus.CALC_MENU,'');
  console.log(n,'templates,',bad,'problems');
});
