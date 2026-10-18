// Node harness for the CAS tests: runs the app's Giac WebAssembly build with the same output decoding as js/cas-worker.js
const fs=require('fs');
module.exports=function(){ return new Promise(res=>{
const G=__dirname+'/../app/www/vendor/giac/'; const code=fs.readFileSync(G+'giac.glue.js','utf8'); const wasm=fs.readFileSync(G+'giac.wasm');
const wsrc=fs.readFileSync(__dirname+'/../app/www/js/cas-worker.js','utf8');
const decSrc=wsrc.slice(wsrc.indexOf('function decode(ptr)'), wsrc.indexOf('function evalOne'));
let mem=null;
const decode=new Function('getMem', decSrc.replace('const m = new Uint8Array(wasmMem.buffer);','const m = new Uint8Array(getMem().buffer);')+'\n return decode;')(()=>mem);
const M={print:()=>{},printErr:()=>{}, instantiateWasm:(imp,ok)=>{WebAssembly.instantiate(wasm,imp).then(r=>{for(const v of Object.values(r.instance.exports)) if(v instanceof WebAssembly.Memory) mem=v; ok(r.instance)});return {};}};
M.onRuntimeInitialized=()=>{ const p=M.cwrap('caseval','number',['string']); res((c)=>decode(p(c))); };
new Function('__ggb__giac','require','module','exports','__dirname','__filename',code)(M,require,{exports:{}},{},__dirname,'x');
});};
