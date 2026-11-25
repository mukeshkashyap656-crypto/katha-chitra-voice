// Jarvis: "Jarvis" bolne par jaagta hai, awaaz phone ke andar hi pehchani jaati hai.
// Ye taala nahi hai: milti-julti awaaz ya recording dhokha de sakti hai.
(function(root){
"use strict";
// ---------- awaaz ki pehchan (sirf hisaab, koi network nahi) ----------
const RATE=16000,WIN=400,HOP=160,NFFT=512,NMEL=26,NCEP=13;
function resample(x,from){
  if(from===RATE)return x;
  const r=from/RATE,n=Math.floor(x.length/r),y=new Float32Array(n);
  for(let i=0;i<n;i++){const a=Math.floor(i*r),b=Math.min(x.length,Math.max(a+1,Math.floor((i+1)*r)));let s=0;for(let j=a;j<b;j++)s+=x[j];y[i]=s/(b-a)}
  return y;
}
function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const p=i+k,q=p+len/2,vr=re[q]*cr-im[q]*ci,vi=re[q]*ci+im[q]*cr;re[q]=re[p]-vr;im[q]=im[p]-vi;re[p]+=vr;im[p]+=vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}
}
const mel=f=>2595*Math.log10(1+f/700),imel=m=>700*(Math.pow(10,m/2595)-1);
const BANK=(()=>{const lo=mel(80),hi=mel(7600),p=[];for(let i=0;i<NMEL+2;i++)p.push(Math.floor((NFFT+1)*imel(lo+(hi-lo)*i/(NMEL+1))/RATE));return p})();
const rms=f=>{let s=0;for(let i=0;i<f.length;i++)s+=f[i]*f[i];return Math.sqrt(s/(f.length||1))};
// shuru aur aakhir ki khamoshi kaato
function trim(x){
  const e=[];for(let i=0;i+HOP<=x.length;i+=HOP)e.push(rms(x.subarray(i,i+HOP)));
  const th=Math.max(...e,0)*0.08;let a=0,b=e.length-1;while(a<b&&e[a]<th)a++;while(b>a&&e[b]<th)b--;
  return x.subarray(a*HOP,Math.min(x.length,(b+1)*HOP));
}
function mfcc(x){
  const out=[];
  for(let s=0;s+WIN<=x.length;s+=HOP){
    const re=new Float64Array(NFFT),im=new Float64Array(NFFT);
    for(let i=0;i<WIN;i++){const v=x[s+i]-0.97*(s+i>0?x[s+i-1]:0);re[i]=v*(0.54-0.46*Math.cos(2*Math.PI*i/(WIN-1)))}
    fft(re,im);
    const m=new Float64Array(NMEL);
    for(let j=0;j<NMEL;j++){const l=BANK[j],c=BANK[j+1],h=BANK[j+2];let sum=0;for(let k=l;k<h;k++){const w=k<c?(k-l)/((c-l)||1):(h-k)/((h-c)||1);sum+=w*(re[k]*re[k]+im[k]*im[k])}m[j]=Math.log(sum+1e-8)}
    const cep=[];for(let n=1;n<NCEP;n++){let v=0;for(let j=0;j<NMEL;j++)v+=m[j]*Math.cos(Math.PI*n*(j+0.5)/NMEL);cep.push(v*Math.sqrt(2/NMEL))}
    out.push(cep);
  }
  for(let d=0;d<NCEP-1;d++){let a=0;for(const f of out)a+=f[d];a/=out.length||1;for(const f of out)f[d]-=a}
  return out.map(f=>f.map(v=>Math.round(v*1000)/1000));
}
// awaaz ki unchai (pitch) ka beech wala maan
function pitch(x){
  const L=640,lo=Math.floor(RATE/400),hi=Math.floor(RATE/70),th=rms(x)*0.5,got=[];
  for(let s=0;s+L+hi<=x.length;s+=320){
    if(rms(x.subarray(s,s+L))<th)continue;
    const c=[];let best=0;
    for(let l=lo;l<=hi;l++){let a=0,p=0,q=0;for(let i=0;i<L;i++){const u=x[s+i],v=x[s+i+l];a+=u*v;p+=u*u;q+=v*v}const r=a/Math.sqrt(p*q+1e-12);c.push(r);if(r>best)best=r}
    if(best<0.5)continue;
    for(let i=1;i<c.length-1;i++)if(c[i]>=0.9*best&&c[i]>=c[i-1]&&c[i]>=c[i+1]){got.push(RATE/(lo+i));break}
  }
  got.sort((a,b)=>a-b);return got.length?got[got.length>>1]:0;
}
function dtw(a,b){
  const n=a.length,m=b.length;if(!n||!m||n>m*2||m>n*2)return Infinity;
  const W=Math.max(Math.abs(n-m),Math.ceil(Math.max(n,m)*0.2));
  let prev=new Float64Array(m+1).fill(Infinity),cur=new Float64Array(m+1);prev[0]=0;
  for(let i=1;i<=n;i++){cur.fill(Infinity);const c=Math.round(i*m/n);
    for(let j=Math.max(1,c-W);j<=Math.min(m,c+W);j++){let d=0;for(let k=0;k<a[i-1].length;k++){const e=a[i-1][k]-b[j-1][k];d+=e*e}d=Math.sqrt(d);cur[j]=Math.min(prev[j-1]+2*d,prev[j]+d,cur[j-1]+d)}
    const t=prev;prev=cur;cur=t}
  return prev[m]/(n+m);
}
function sample(audio,from){const x=trim(resample(audio,from));return {f:mfcc(x),p:pitch(x),sec:x.length/RATE}}
const two=(t,list)=>{const d=list.map(o=>dtw(t.f,o.f)).sort((a,b)=>a-b);return (d[0]+d[1])/2};
function makeProfile(list){
  const own=list.map((s,i)=>two(s,list.filter((_,j)=>j!==i)));
  const ps=list.map(s=>s.p).filter(p=>p>0).sort((a,b)=>a-b);
  return {v:1,list,base:Math.max(...own),own,pitch:ps.length?ps[ps.length>>1]:0};
}
const LEVEL={dheela:1.3,beech:1.15,sakht:1.02};
function match(s,prof,level){
  const score=two(s,prof.list)/prof.base;
  const pr=(s.p&&prof.pitch)?s.p/prof.pitch:0;
  const pOk=!pr||(pr>0.75&&pr<1.33);
  return {ok:score<=(LEVEL[level]||LEVEL.beech)&&pOk,score,pitchOk:pOk};
}
const core={RATE,resample,trim,mfcc,pitch,dtw,sample,makeProfile,match};
if(typeof module!=="undefined"&&module.exports){module.exports=core;return}

// ---------- page wala hissa ----------
const KEY="kc_jarvis_voice",LKEY="kc_jarvis_level";
const load=()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||"null");return p&&p.v===1&&isFinite(p.base)?p:null}catch(e){return null}};
const level=()=>{try{return localStorage.getItem(LKEY)||"beech"}catch(e){return "beech"}};
let profile=load(),active=false,gen=0,stream=null,ctx=null,node=null,lock=null,cmdRec=null,enrolling=null,speaking=false,watchT=null;

const css=document.createElement("style");
css.textContent=`#jvbtn{position:fixed;left:18px;bottom:18px;z-index:40;width:64px;height:64px;border:0;border-radius:50%;padding:0;margin:0;background:radial-gradient(circle,#0a4a68 0,#03202f 55%,#010a10 100%);box-shadow:0 0 16px rgba(56,225,255,.75)}
#jvbtn svg{display:block;width:100%;height:100%;fill:none;stroke:#52e6ff}#jvbtn .r{transform-origin:32px 32px;animation:jvr 14s linear infinite}#jvbtn .b{animation-duration:8s;animation-direction:reverse}
#jvbtn.live{box-shadow:0 0 26px #38e1ff,0 0 6px #fff inset}#jvbtn.live .r{animation-duration:3s}
@media (prefers-reduced-motion:reduce){#jvbtn .r{animation:none}}
#jvbox{position:fixed;inset:0;z-index:60;background:radial-gradient(circle at 50% 28%,#06304a 0,#020b14 55%,#000 100%);color:#dff8ff;display:none;flex-direction:column;align-items:center;gap:11px;padding:16px 16px 24px;overflow:auto}
#jvbox:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(rgba(56,225,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(56,225,255,.06) 1px,transparent 1px);background-size:28px 28px}
#jvbox>*{position:relative;max-width:420px;flex:none}
#jvname{font:600 15px monospace;letter-spacing:.55em;color:#7fe9ff;text-shadow:0 0 12px #38e1ff;padding-left:.55em}
#jvorb{width:min(68vw,250px);aspect-ratio:1;filter:drop-shadow(0 0 10px #38e1ff);opacity:.55;transition:opacity .4s}
#jvorb svg{width:100%;height:100%}#jvorb .r{transform-origin:100px 100px;fill:none;stroke:#38e1ff;animation:jvr 18s linear infinite}
#jvorb .b{animation-duration:11s;animation-direction:reverse}#jvorb .c{animation-duration:6s}#jvorb .k{transform-origin:100px 100px;animation:jvk 2.6s ease-in-out infinite}
@keyframes jvr{to{transform:rotate(360deg)}}@keyframes jvk{50%{transform:scale(1.12)}}
#jvbox.live #jvorb{opacity:1}#jvbox.talk #jvorb{opacity:1;filter:drop-shadow(0 0 22px #9af1ff)}#jvbox.talk #jvorb .r{animation-duration:3s}#jvbox.talk #jvorb .k{animation-duration:.45s}
#jvbars{display:flex;gap:4px;height:26px;align-items:center}#jvbars i{width:4px;height:4px;border-radius:2px;background:#38e1ff;box-shadow:0 0 6px #38e1ff}
#jvbox.talk #jvbars i{animation:jvb .5s ease-in-out infinite alternate}#jvbars i:nth-child(3n){animation-delay:.12s!important}#jvbars i:nth-child(3n+1){animation-delay:.27s!important}
@keyframes jvb{to{height:24px}}@media (prefers-reduced-motion:reduce){#jvorb .r,#jvorb .k,#jvbars i{animation:none!important}}
#jvbox button,#jvbox select{width:100%;border:1px solid rgba(56,225,255,.7);border-radius:10px;padding:12px;background:rgba(6,48,68,.75);color:#e8fbff;font-size:16px}
#jvset{width:100%}#jvset summary{text-align:center;padding:8px;color:#7fe9ff}#jvset>*:not(summary){margin-top:9px}
#jvsay,#jvnote{text-align:center;line-height:1.5}#jvsay{min-height:24px;font-size:17px}#jvnote{font-size:12.5px;opacity:.7}#jvheard{font-size:14px;color:#ffe082;min-height:20px;text-align:center}`;
document.head.appendChild(css);
document.body.insertAdjacentHTML("beforeend",'<button id="jvbtn" type="button" aria-label="Jarvis kholo" title="Jarvis"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="r" cx="32" cy="32" r="28" stroke-width="2.5" stroke-dasharray="30 8 14 8 44 8 24 8"/><circle class="r b" cx="32" cy="32" r="21" stroke-width="5" stroke-dasharray="2 3.5" opacity=".75"/><circle cx="32" cy="32" r="13" stroke-width="1.5"/><circle cx="32" cy="32" r="7" fill="#d9fbff" stroke="none"/></svg></button><div id="jvbox"><div id="jvname">JARVIS</div><div id="jvorb"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="r" cx="100" cy="100" r="94" stroke-width="1.5" stroke-dasharray="2 6"/><circle class="r b" cx="100" cy="100" r="82" stroke-width="5" stroke-dasharray="90 28 40 28 150 28 60 92" opacity=".85"/><circle class="r c" cx="100" cy="100" r="66" stroke-width="2" stroke-dasharray="120 60 30 60"/><circle class="r" cx="100" cy="100" r="52" stroke-width="9" stroke-dasharray="3 7.9" opacity=".6"/><circle class="r b" cx="100" cy="100" r="38" stroke-width="1.5" stroke-dasharray="50 14"/><g class="k"><circle cx="100" cy="100" r="24" fill="#38e1ff" opacity=".3"/><circle cx="100" cy="100" r="13" fill="#d8fbff"/></g></svg></div><div id="jvbars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div id="jvsay"></div><div id="jvheard"></div><button id="jvgo"></button><button id="jvteach"></button><details id="jvset"><summary>⚙ Setting</summary><button id="jvvoice">🔈 Jarvis ki awaaz badlo</button><select id="jvlvl"><option value="dheela">Pehchan: dheeli (aasani se sune)</option><option value="beech">Pehchan: beech ki</option><option value="sakht">Pehchan: sakht (sirf saaf meri awaaz)</option></select><button id="jvmem">🧠 Yaad ki baatein mitao (do baar dabao)</button><button id="jvdel">🗑 Meri awaaz mitao</button></details><button id="jvclose">◀ Wapas</button><div id="jvnote">Jarvis tabhi sunta hai jab ye page khula ho aur screen chalu ho. Ek baar awaaz sikhane aur mic ko hamesha ki ijazat dene ke baad, app khulte hi ye apne aap chalu hota hai. “Yaad rakho” wali baat GitHub AI ko bhi jaati hai, jo sabko dikh sakti hai, isliye niji baat mat bolna. Awaaz ka namoona sirf isi phone mein rehta hai. Uske baad ki baat ko likhne ke liye Chrome awaaz Google ko bhejta hai. Ye pehchan taala nahi hai: milti-julti awaaz ya recording dhokha de sakti hai.</div></div>');
const J=id=>document.getElementById(id);
const say=t=>{J("jvsay").textContent=t};
function ui(){
  J("jvgo").textContent=active?"⏹ Jarvis band karo":"▶ Jarvis chalu karo";
  J("jvteach").textContent=profile?"🎙 Meri awaaz dobara sikhao":"🎙 Pehle meri awaaz sikhao";
  J("jvbox").classList.toggle("live",active||!!enrolling);
  J("jvbtn").classList.toggle("live",active);
}
const VKEY="kc_jarvis_tts";
const hiVoices=()=>{try{return window.speechSynthesis.getVoices().filter(v=>/^hi/i.test(v.lang))}catch(e){return []}};
function pickVoice(){const l=hiVoices();let w="";try{w=localStorage.getItem(VKEY)||""}catch(e){}return l.find(v=>v.voiceURI===w)||l.find(v=>/(^|[^e])male|madhur|hemant|hid|hie/i.test(v.name+" "+v.voiceURI))||l[0]}
// jawab: true = bola gaya, false = browser ne bina chhuye bolne nahi diya
function speak(text){
  return new Promise(res=>{
    const S=window.speechSynthesis;if(!S||!text){res(false);return}
    speaking=true;J("jvbox").classList.add("talk");let done=false,started=false,tm=null;
    const end=ok=>{if(done)return;done=true;clearTimeout(tm);speaking=false;J("jvbox").classList.remove("talk");res(ok)};
    const touched=()=>!navigator.userActivation||navigator.userActivation.hasBeenActive;
    try{S.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="hi-IN";const v=pickVoice();if(v)u.voice=v;u.pitch=0.8;u.rate=0.98;u.onstart=()=>{started=true};u.onend=()=>end(true);u.onerror=()=>end(false);S.speak(u)}catch(e){end(false)}
    tm=setTimeout(()=>end(started||touched()),3000+text.length*130);
  });
}
function greetText(){
  const h=new Date().getHours();
  return (h<12?"गुड मॉर्निंग सर।":h<17?"गुड आफ्टरनून सर।":"गुड ईवनिंग सर।")+" जार्विस हाज़िर है। आज क्या करना है?";
}
// app khulte hi salaam; browser roke to pehli chhuan par bolo
async function greet(){
  const t=greetText();open();J("jvheard").textContent=t;
  const ok=await speak(t);
  if(!ok)document.addEventListener("pointerdown",e=>{if(!speaking&&!enrolling&&!cmdRec&&!(e.target.closest&&e.target.closest("button,select,summary")))speak(t)},{once:true,capture:true});
}
// ---- mic: ek-ek bola hua tukda pakdo ----
function micOff(){
  if(node){node.onaudioprocess=null;try{node.disconnect()}catch(e){}node=null}
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  if(ctx){try{ctx.close()}catch(e){}ctx=null}
}
async function micOn(onPiece){
  micOff();const my=++gen;
  const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  if(my!==gen){s.getTracks().forEach(t=>t.stop());return}
  stream=s;ctx=new (window.AudioContext||window.webkitAudioContext)();try{await Promise.race([ctx.resume(),new Promise(r=>setTimeout(r,700))])}catch(e){}
  if(my!==gen)return;
  if(ctx.state==="suspended"){const c=ctx;open();say("Screen ko ek baar chhu do, phir main sununga.");document.addEventListener("pointerdown",()=>{c.resume().then(()=>say("Sun raha hoon… bolo “Jarvis”")).catch(()=>{})},{once:true,capture:true})}
  const src=ctx.createMediaStreamSource(stream);node=ctx.createScriptProcessor(2048,1,1);
  const rate=ctx.sampleRate,dur=2048/rate;let floor=0.004,pre=[],seg=null,quiet=0,len=0;
  node.onaudioprocess=e=>{
    if(my!==gen||speaking)return;
    const x=new Float32Array(e.inputBuffer.getChannelData(0)),lv=rms(x),th=Math.max(floor*3,0.012);
    if(!seg){
      pre.push(x);if(pre.length>5)pre.shift();
      if(lv>th){seg=pre.slice();pre=[];quiet=0;len=seg.length*dur}else floor=floor*0.95+lv*0.05;
      return;
    }
    seg.push(x);len+=dur;quiet=lv>th*0.6?0:quiet+dur;
    if(quiet>0.45||len>4){
      const all=new Float32Array(seg.reduce((n,a)=>n+a.length,0));let o=0;for(const a of seg){all.set(a,o);o+=a.length}
      seg=null;if(len>4){floor=Math.min(0.05,Math.max(floor,lv*0.6));return}
      onPiece(all,rate);
    }
  };
  src.connect(node);node.connect(ctx.destination);
}
const micErr=e=>say(e&&e.name==="NotAllowedError"?"Mic ki ijazat do: Chrome mein 🔒 → Permissions → Microphone → Allow":"Mic nahi chala: "+((e&&e.message)||e));
// ---- awaaz sikhana ----
async function teach(){
  stop();const list=[];enrolling=list;ui();
  say("Shaant jagah mein, normal awaaz mein sirf “Jarvis” bolo. 0/6");J("jvheard").textContent="";
  try{
    await micOn((a,r)=>{
      if(enrolling!==list)return;
      const s=sample(a,r);
      if(s.sec<0.3||s.sec>1.5||s.f.length<25){J("jvheard").textContent="Sirf “Jarvis” bolo, saaf aur ek baar.";return}
      if(list.length>=2){const d=Math.min(...list.map(o=>dtw(s.f,o.f)));const ref=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const v=dtw(list[i].f,list[j].f);if(isFinite(v))ref.push(v)}ref.sort((a,b)=>a-b);
        if(ref.length&&d>ref[ref.length>>1]*1.5){J("jvheard").textContent="Ye baaki se alag laga. Phir se “Jarvis” bolo.";return}}
      list.push(s);J("jvheard").textContent="✅ Sun liya";say("Phir se “Jarvis” bolo. "+list.length+"/6");
      if(list.length===6){
        const p=makeProfile(list);enrolling=null;gen++;micOff();
        if(!isFinite(p.base)){say("Namoone aapas mein mile nahi. Phir se sikhao.");ui();return}
        try{localStorage.setItem(KEY,JSON.stringify(p));profile=p}catch(e){say("Phone mein save nahi hua.");ui();return}
        setAuto(true);start();
      }
    });
  }catch(e){enrolling=null;ui();micErr(e)}
}
// ---- sunna ----
async function listen(){
  if(!active||document.hidden)return;
  say("Sun raha hoon… bolo “Jarvis”");ui();
  try{
    await micOn((a,r)=>{
      const s=sample(a,r);if(s.sec<0.3||s.sec>1.5||s.f.length<25)return;
      const m=match(s,profile,level());
      if(m.ok)woke();else J("jvheard").textContent="(pehchana nahi)";
    });
  }catch(e){stop();micErr(e)}
}
async function woke(){
  gen++;micOff();const my=gen;J("jvbox").style.display="flex";J("jvheard").textContent="";say("Ji, boliye…");
  await speak("जी, बोलिए");
  if(!active||my!==gen)return;
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R){say("Is browser mein bolkar likhna nahi chalta. Chrome use karo.");stop();return}
  let got="";cmdRec=new R();const rec=cmdRec;rec.lang="hi-IN";rec.interimResults=true;rec.continuous=false;
  rec.onresult=e=>{let s="";for(let i=0;i<e.results.length;i++)s+=e.results[i][0].transcript;got=s;J("jvheard").textContent=s};
  rec.onerror=()=>{};
  const timer=setTimeout(()=>{try{rec.stop()}catch(e){}},12000);
  rec.onend=()=>{clearTimeout(timer);if(cmdRec!==rec)return;cmdRec=null;if(active)handle(got.trim())};
  try{rec.start()}catch(e){clearTimeout(timer);cmdRec=null;listen()}
}
// "yaad rakho ..." wali baatein, sirf isi phone mein
const MKEY="kc_jarvis_mem";
const mems=()=>{try{const a=JSON.parse(localStorage.getItem(MKEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return []}};
const SECRET=/token|password|otp|github_pat|ghp_|टोकन|पासवर्ड|ओटीपी|\d{6,}|\d[\d \-]{8,}\d|[\w.+-]+@[\w-]+\.\w+/i;
let toAI="";
function memory(cmd){
  const m=cmd.match(/^(?:jarvis |जार्विस )?(?:yaad rakh(?:o|na)|याद रख(?:ो|ना))(?: ki| कि)?\s+(.+)$/i);
  if(m){
    if(SECRET.test(m[1]))return "टोकन, पासवर्ड या लंबे नंबर मैं याद नहीं रखता";
    const v=m[1].slice(0,200),a=mems().filter(x=>x!==v);a.push(v);
    try{localStorage.setItem(MKEY,JSON.stringify(a.slice(-100)))}catch(e){return "याद सेव नहीं हुई"}
    toAI=v;return "ठीक है सर, याद रख लिया";
  }
  if(/kya yaad hai|kya kya yaad|क्या याद है|क्या क्या याद|क्या-क्या याद/i.test(cmd)){
    const a=mems();return a.length?"मुझे यह याद है: "+a.slice(-8).join("। "):"अभी कुछ याद नहीं है";
  }
  return null;
}
// zaroori kaam awaaz se apne aap nahi jaate
const RISKY=/delete|remove|publish|upload|post|public|private|token|password|payment|paisa|paise|stop|cancel|hata|mita|band kar|rok|डिलीट|हटा|मिटा|पोस्ट|पब्लिश|अपलोड|पब्लिक|प्राइवेट|टोकन|पासवर्ड|पेमेंट|पैस|रोक|बंद कर|कैंसल/i;
async function handle(cmd){
  cmd=cmd.replace(/^\s*(?:(?:jarvis|जार्विस|जारविस)(?:[\s,।]+|$))+/i,"");
  if(!cmd){listen();return}
  const c=cmd.toLowerCase();
  const mem=memory(cmd);
  if(mem){
    say(mem);
    const v=toAI;toAI="";const tb=document.getElementById("txt");
    if(v&&gt()&&!tb.value.trim()){location.hash="s1";tb.value="याद रखो "+v;try{await sendGH()}catch(e){}if(tb.value.trim())tb.value=""}
    await speak(mem);listen();return}
  if(/^(jarvis |जार्विस )?(ruko|chup|so jao|band ho jao|रुको|चुप|सो जाओ|बंद हो जाओ)\s*(jarvis|जार्विस)?$/.test(c)){await speak("ठीक है, मैं रुक रहा हूँ");stop();return}
  if(/kitne baje|time kya|कितने बजे|टाइम क्या|समय क्या/.test(c)){await speak("अभी "+new Date().toLocaleTimeString("hi-IN",{hour:"numeric",minute:"2-digit"})+" हुए हैं");listen();return}
  const pages=[[/video|वीडियो/,"s3","वीडियो"],[/youtube|यूट्यूब/,"s4","यूट्यूब"],[/blog|ब्लॉग/,"s7","ब्लॉग"]];
  for(const [re,h,n] of pages)if(re.test(c)&&/dikhao|kholo|दिखाओ|खोलो/.test(c)&&c.split(/\s+/).length<=4){location.hash=h;close();await speak(n+" खोल दिया");listen();return}
  if(window.kcQuick&&window.kcQuick.ready()){
    say("⚡ Soch raha hoon…");
    let r;try{r=await window.kcQuick.ask(cmd)}catch(e){r={fail:e.message}}
    if(!active)return;
    if(r.text){location.hash="s1";window.kcQuick.show("me",cmd);window.kcQuick.show("ai","⚡ "+r.text);say(r.text);let t=plain(r.text);if(t.length>350)t=t.slice(0,350)+"… पूरा जवाब चैट में है";await speak(t);if(active)listen();return}
  }
  location.hash="s1";
  const box=document.getElementById("txt");
  if(box.value.trim()){close();await speak("टेक्स्ट बॉक्स में पहले से कुछ लिखा है। पहले उसे भेजिए या मिटाइए");listen();return}
  box.value=cmd;
  if(RISKY.test(c)){close();await speak("यह ज़रूरी काम है। पढ़कर भेजो बटन दबाइए");listen();return}
  if(!gt()){await speak("पहले सेटअप में टोकन डालिए");listen();return}
  say("AI ko bhej raha hoon…");
  const before=chatN;
  const old=new Set(chatN?chatMsgs.filter(m=>m.who==="ai").map(m=>m.id):[]);
  await sendGH();
  if(box.value.trim()){await speak("बात भेजी नहीं जा सकी");listen();return}
  watch(chatN,old,Date.now());
  await speak("भेज दिया। जवाब आते ही सुनाऊँगा");listen();
}
const sendGH=()=>window.kcQuick?window.kcQuick.github():document.getElementById("send").onclick();
function plain(t){return t.replace(/```[\s\S]*?```/g," ").replace(/https?:\/\/\S+/g," लिंक ").replace(/[#*_`>|]/g," ").replace(/\s+/g," ").trim()}
function watch(n,old,t0){
  clearTimeout(watchT);
  watchT=setTimeout(async()=>{
    if(!active||chatN!==n)return;
    if(Date.now()-t0>15*60000){speak("जवाब अभी तक नहीं आया। चैट में देख लीजिए");return}
    try{await loadChat()}catch(e){}
    const m=chatMsgs.filter(m=>m.who==="ai"&&!old.has(m.id)).pop();
    if(!m||speaking||cmdRec){watch(n,old,t0);return}
    let t=plain(m.text);if(t.length>350)t=t.slice(0,350)+"… पूरा जवाब चैट में है";
    await speak(t);
  },8000);
}
async function start(quiet){
  if(!profile){say("Pehle apni awaaz sikhao.");return}
  enrolling=null;active=true;ui();
  try{lock=await navigator.wakeLock.request("screen")}catch(e){}
  if(quiet!==true)await speak("जार्विस चालू है");
  if(active&&!cmdRec)listen();
}
function stop(){
  active=false;enrolling=null;gen++;micOff();clearTimeout(watchT);
  if(cmdRec){const r=cmdRec;cmdRec=null;try{r.abort()}catch(e){}}
  try{window.speechSynthesis&&window.speechSynthesis.cancel()}catch(e){}speaking=false;
  if(lock){try{lock.release()}catch(e){}lock=null}
  ui();say(profile?"Jarvis band hai.":"Pehle apni awaaz sikhao, phir chalu karo.");
}
const open=()=>{J("jvbox").style.display="flex";if(!active&&!enrolling)say(profile?"Jarvis band hai.":"Pehle apni awaaz sikhao, phir chalu karo.");ui()};
const close=()=>{J("jvbox").style.display="none";if(enrolling)stop()};
J("jvbtn").onclick=open;J("jvclose").onclick=close;
const AKEY="kc_jarvis_auto";
const setAuto=v=>{try{localStorage.setItem(AKEY,v?"1":"0")}catch(e){}};
J("jvgo").onclick=()=>{if(active){setAuto(false);stop()}else{if(profile)setAuto(true);start()}};
// app khulte hi apne aap chalu (jab tak aapne khud button se band na kiya ho)
const wantAuto=()=>{try{return localStorage.getItem(AKEY)!=="0"}catch(x){return false}};
const canAuto=()=>wantAuto()&&profile&&!active&&!enrolling&&!on&&!document.hidden;
async function autoStart(){
  if(!canAuto())return false;
  let st8="";try{st8=(await navigator.permissions.query({name:"microphone"})).state}catch(e){}
  if(st8==="granted"&&canAuto()){await start(true);return true}
  return false;
}
async function boot(){
  if(!wantAuto())return;
  await greet();
  if(!(await autoStart())&&!active&&!enrolling)say(profile?"Screen ko ek baar chhu do, phir main sununga.":"Pehli baar: neeche se apni awaaz sikhao.");
}
// agar browser ne apne aap nahi chalne diya to pehle tap par chalu
const firstTap=e=>{
  if(e.target.closest&&e.target.closest("#jvbtn,#jvgo,#jvteach,#jvset,#jvclose,#mic,#hmic,#fab,.fb"))return;
  document.removeEventListener("click",firstTap,true);
  if(canAuto())start();
};
document.addEventListener("click",firstTap,true);
J("jvteach").onclick=teach;
J("jvlvl").value=level();J("jvlvl").onchange=()=>{try{localStorage.setItem(LKEY,J("jvlvl").value)}catch(e){}};
let armed=0;J("jvmem").onclick=()=>{if(Date.now()-armed>4000){armed=Date.now();say("Pakka? Ek baar aur dabao. Yaad ki "+mems().length+" baatein mit jayengi.");return}armed=0;try{localStorage.removeItem(MKEY)}catch(e){}say("Yaad ki baatein mita di.")};
J("jvdel").onclick=()=>{stop();try{localStorage.removeItem(KEY)}catch(e){}profile=null;ui();say("Awaaz mita di.")};
// purana mic dabe to Jarvis mic chhod de
["mic","hmic","fab"].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener("click",()=>{if(active||enrolling)stop()},true)});
const micBtn=document.getElementById("mic");
if(micBtn&&micBtn.onclick){
  const orig=micBtn.onclick;let greeting=false;
  micBtn.onclick=async function(e){
    if(on||!SR)return orig.call(micBtn,e);
    if(greeting)return;
    greeting=true;st("Jarvis: Hello sir, aaj kya karna hai?");
    await speak("हेलो सर, आज क्या करना है?");
    greeting=false;
    if(location.hash==="#s1"&&!document.hidden&&!on&&!active)orig.call(micBtn,e);
  };
}
document.addEventListener("visibilitychange",async()=>{
  if(document.hidden){if(enrolling){stop();return}if(active){gen++;micOff();if(cmdRec){const r=cmdRec;cmdRec=null;try{r.abort()}catch(e){}}}}
  else if(!active)autoStart();
  else if(active){try{lock=await navigator.wakeLock.request("screen")}catch(e){}listen()}
});
J("jvvoice").onclick=()=>{
  const l=hiVoices();if(!l.length){say("Is phone mein Hindi ki doosri awaaz nahi mili.");return}
  const cur=pickVoice(),n=l[(l.findIndex(v=>v.voiceURI===(cur&&cur.voiceURI))+1)%l.length];
  try{localStorage.setItem(VKEY,n.voiceURI)}catch(e){}
  say("Awaaz "+(l.indexOf(n)+1)+"/"+l.length);speak("हेलो सर, क्या यह आवाज़ ठीक है?");
};
try{window.speechSynthesis.getVoices()}catch(e){}
ui();
boot();
})(this);
