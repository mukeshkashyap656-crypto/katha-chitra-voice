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
css.textContent="#jvbtn{position:fixed;left:14px;bottom:86px;z-index:40;border:1px solid #38e1ff;border-radius:24px;padding:10px 14px;background:#041a24;color:#bff4ff;font-size:15px;box-shadow:0 0 14px rgba(56,225,255,.6)}#jvbox{position:fixed;inset:0;z-index:60;background:rgba(2,10,18,.97);color:#dff8ff;display:none;flex-direction:column;align-items:center;gap:12px;padding:20px 16px;overflow:auto}#jvorb{width:130px;height:130px;flex:none;border-radius:50%;background:radial-gradient(circle,#bff4ff 0,#38e1ff 30%,#063a52 70%);box-shadow:0 0 30px #38e1ff;opacity:.45}#jvbox.live #jvorb{opacity:1;animation:jvp 1.6s ease-in-out infinite}@keyframes jvp{50%{transform:scale(1.07)}}#jvbox button,#jvbox select{width:100%;max-width:420px;border:1px solid #38e1ff;border-radius:12px;padding:13px;background:#063044;color:#fff;font-size:16px}#jvsay,#jvnote{max-width:420px;text-align:center;line-height:1.5}#jvnote{font-size:12.5px;opacity:.75}#jvheard{font-size:14px;color:#ffe082;min-height:20px;text-align:center}";
document.head.appendChild(css);
document.body.insertAdjacentHTML("beforeend",'<button id="jvbtn">🤖 Jarvis</button><div id="jvbox"><div id="jvorb"></div><div id="jvsay"></div><div id="jvheard"></div><button id="jvgo"></button><button id="jvteach"></button><select id="jvlvl"><option value="dheela">Pehchan: dheeli (aasani se sune)</option><option value="beech">Pehchan: beech ki</option><option value="sakht">Pehchan: sakht (sirf saaf meri awaaz)</option></select><button id="jvmem">🧠 Yaad ki baatein mitao (do baar dabao)</button><button id="jvdel">🗑 Meri awaaz mitao</button><button id="jvclose">◀ Wapas</button><div id="jvnote">Jarvis tabhi sunta hai jab ye page khula ho aur screen chalu ho. Awaaz ka namoona sirf isi phone mein rehta hai. Uske baad ki baat ko likhne ke liye Chrome awaaz Google ko bhejta hai. Ye pehchan taala nahi hai: milti-julti awaaz ya recording dhokha de sakti hai.</div></div>');
const J=id=>document.getElementById(id);
const say=t=>{J("jvsay").textContent=t};
function ui(){
  J("jvgo").textContent=active?"⏹ Jarvis band karo":"▶ Jarvis chalu karo";
  J("jvteach").textContent=profile?"🎙 Meri awaaz dobara sikhao":"🎙 Pehle meri awaaz sikhao";
  J("jvbox").classList.toggle("live",active||!!enrolling);
  J("jvbtn").textContent=active?"🟢 Jarvis":"🤖 Jarvis";
}
function speak(text){
  return new Promise(res=>{
    const S=window.speechSynthesis;if(!S||!text){res();return}
    speaking=true;let done=false;const end=()=>{if(done)return;done=true;speaking=false;res()};
    try{S.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="hi-IN";const v=S.getVoices().find(v=>/^hi/i.test(v.lang));if(v)u.voice=v;u.onend=end;u.onerror=end;S.speak(u)}catch(e){end()}
    setTimeout(end,3000+text.length*130);
  });
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
  stream=s;ctx=new (window.AudioContext||window.webkitAudioContext)();try{await ctx.resume()}catch(e){}
  if(my!==gen)return;
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
        try{localStorage.setItem(KEY,JSON.stringify(p));profile=p;say("Awaaz yaad ho gayi ✅ Ab “Jarvis chalu karo” dabao.")}catch(e){say("Phone mein save nahi hua.")}
        ui();
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
  gen++;micOff();const my=gen;J("jvheard").textContent="";say("Ji, boliye…");
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
const SECRET=/token|password|otp|github_pat|ghp_|टोकन|पासवर्ड|ओटीपी|\d{6,}/i;
function memory(cmd){
  const m=cmd.match(/^(?:jarvis |जार्विस )?(?:yaad rakh(?:o|na)|याद रख(?:ो|ना))(?: ki| कि)?\s+(.+)$/i);
  if(m){
    if(SECRET.test(m[1]))return "टोकन, पासवर्ड या लंबे नंबर मैं याद नहीं रखता";
    const v=m[1].slice(0,200),a=mems().filter(x=>x!==v);a.push(v);
    try{localStorage.setItem(MKEY,JSON.stringify(a.slice(-100)))}catch(e){return "याद सेव नहीं हुई"}
    return "ठीक है सर, याद रख लिया";
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
  if(mem){say(mem);await speak(mem);listen();return}
  if(/^(jarvis |जार्विस )?(ruko|chup|so jao|band ho jao|रुको|चुप|सो जाओ|बंद हो जाओ)\s*(jarvis|जार्विस)?$/.test(c)){await speak("ठीक है, मैं रुक रहा हूँ");stop();return}
  if(/kitne baje|time kya|कितने बजे|टाइम क्या|समय क्या/.test(c)){await speak("अभी "+new Date().toLocaleTimeString("hi-IN",{hour:"numeric",minute:"2-digit"})+" हुए हैं");listen();return}
  const pages=[[/video|वीडियो/,"s3","वीडियो"],[/youtube|यूट्यूब/,"s4","यूट्यूब"],[/blog|ब्लॉग/,"s7","ब्लॉग"]];
  for(const [re,h,n] of pages)if(re.test(c)&&/dikhao|kholo|दिखाओ|खोलो/.test(c)&&c.split(/\s+/).length<=4){location.hash=h;close();await speak(n+" खोल दिया");listen();return}
  location.hash="s1";
  const box=document.getElementById("txt");
  if(box.value.trim()){close();await speak("टेक्स्ट बॉक्स में पहले से कुछ लिखा है। पहले उसे भेजिए या मिटाइए");listen();return}
  box.value=cmd;
  if(RISKY.test(c)){close();await speak("यह ज़रूरी काम है। पढ़कर भेजो बटन दबाइए");listen();return}
  if(!gt()){await speak("पहले सेटअप में टोकन डालिए");listen();return}
  say("AI ko bhej raha hoon…");
  const before=chatN;
  const old=new Set(chatN?chatMsgs.filter(m=>m.who==="ai").map(m=>m.id):[]);
  await document.getElementById("send").onclick();
  if(box.value.trim()){await speak("बात भेजी नहीं जा सकी");listen();return}
  watch(chatN,old,Date.now());
  await speak("भेज दिया। जवाब आते ही सुनाऊँगा");listen();
}
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
async function start(){
  if(!profile){say("Pehle apni awaaz sikhao.");return}
  enrolling=null;active=true;ui();
  try{lock=await navigator.wakeLock.request("screen")}catch(e){}
  await speak("जार्विस चालू है");listen();
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
// pehle chalu kiya tha to page par pehle tap se apne aap chalu (browser bina tap ke awaaz nahi chalne deta)
const firstTap=e=>{
  let want=false;try{want=localStorage.getItem(AKEY)==="1"}catch(x){}
  if(e.target.closest&&e.target.closest("#jvbtn,#jvbox,#mic,#hmic,#fab,.fb"))return;
  document.removeEventListener("click",firstTap,true);
  if(want&&profile&&!active&&!enrolling&&!on)start();
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
  else if(active){try{lock=await navigator.wakeLock.request("screen")}catch(e){}listen()}
});
ui();
})(this);
