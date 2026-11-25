// salaam wali awaaz phone ke andar banana (text bahar nahi jaata)
importScripts("ort.wasm.min.js","piper_phonemize.js");
const BASE=new URL("./",self.location.href).href,STORE="kc-awaaz-v1";
const FILES={"pratham.onnx":63145178,"pratham.json":4970,"ort-wasm-simd-threaded.wasm":11246032,"piper_phonemize.wasm":635212,"piper_phonemize.data":18077249};
let ready=null,cfg,session,urls={},wasmBin,dataBin;
async function grab(name,tick){
  let c=null;try{c=await caches.open(STORE)}catch(e){}
  const hit=c&&await c.match(BASE+name);
  if(hit){const b=await hit.arrayBuffer();if(b.byteLength===FILES[name]){tick(b.byteLength);return b}}
  const r=await fetch(BASE+name);if(!r.ok)throw new Error(name+" "+r.status);
  const rd=r.body.getReader(),out=new Uint8Array(FILES[name]);let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;if(n+value.length>out.length)throw new Error(name+" size");out.set(value,n);n+=value.length;tick(value.length)}
  if(n!==out.length)throw new Error(name+" adhoora");
  if(c)try{await c.put(BASE+name,new Response(out))}catch(e){}
  return out.buffer;
}
async function load(){
  const total=Object.values(FILES).reduce((a,b)=>a+b,0);let got=0,last=-1;
  const tick=n=>{got+=n;const p=Math.floor(got*100/total);if(p!==last){last=p;postMessage({progress:p})}};
  const b={};for(const n in FILES)b[n]=await grab(n,tick);
  cfg=JSON.parse(new TextDecoder().decode(b["pratham.json"]));
  wasmBin=b["piper_phonemize.wasm"];dataBin=b["piper_phonemize.data"];
  ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=BASE;ort.env.wasm.wasmBinary=b["ort-wasm-simd-threaded.wasm"];
  session=await ort.InferenceSession.create(new Uint8Array(b["pratham.onnx"]),{executionProviders:["wasm"]});
}
async function ids(text){
  let line="",err="";
  const m=await createPiperPhonemize({print:s=>{line+=s},printErr:s=>{err+=s},wasmBinary:wasmBin,getPreloadedPackage:()=>dataBin,locateFile:f=>BASE+f});
  m.callMain(["-l",cfg.espeak.voice,"--input",JSON.stringify([{text}]),"--espeak_data","/espeak-ng-data"]);
  if(!line)throw new Error("phonemize "+err);
  return JSON.parse(line).phoneme_ids;
}
function wav(x,rate){
  const b=new ArrayBuffer(44+x.length*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,"RIFF");v.setUint32(4,36+x.length*2,true);w(8,"WAVEfmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,x.length*2,true);
  let peak=0;for(const s of x)peak=Math.max(peak,Math.abs(s));const g=peak>0.01?0.9/peak:1;
  for(let i=0;i<x.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,x[i]*g))*32767,true);
  return b;
}
let chain=Promise.resolve();
onmessage=e=>{
  const {id,text}=e.data;
  chain=chain.then(async()=>{
    try{
      if(!ready)ready=load().catch(x=>{ready=null;throw x});
      await ready;
      if(text===undefined){postMessage({id,ok:true});return}
      const p=await ids(text),f=cfg.inference;
      const out=await session.run({input:new ort.Tensor("int64",BigInt64Array.from(p,BigInt),[1,p.length]),input_lengths:new ort.Tensor("int64",BigInt64Array.from([BigInt(p.length)]),[1]),scales:new ort.Tensor("float32",Float32Array.from([f.noise_scale,1.05,f.noise_w]),[3])});
      const buf=wav(out.output.data,cfg.audio.sample_rate);postMessage({id,ok:true,wav:buf},[buf]);
    }catch(x){postMessage({id,ok:false,error:String(x&&x.message||x)})}
  });
};
