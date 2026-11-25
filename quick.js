// Tez AI: baat-cheet ka jawab seedha phone se, kuch second mein. Video/GitHub ka asli kaam GitHub AI ko hi jaata hai.
(function(){
"use strict";
const K="kc_quick_keys",H="kc_quick_chat";
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}};
const put=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}};
const keys=()=>get(K,"").split(/\s+/).filter(x=>x.length>15);
let hist=[];try{const a=JSON.parse(get(H,"[]"));if(Array.isArray(a))hist=a}catch(e){}
const saveHist=()=>put(H,JSON.stringify(hist.slice(-40)));
const kind=k=>k.startsWith("gsk_")?"groq":k.startsWith("sk-or-")?"openrouter":"gemini";

async function call(url,opt,ms){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms||6500);
  try{const r=await fetch(url,{...opt,signal:c.signal,cache:"no-store"});if(!r.ok){const e=new Error("HTTP "+r.status);e.status=r.status;throw e}return await r.json()}
  finally{clearTimeout(t)}
}
// model ke naam badalte rehte hain: abhi ki list mangwao, pakke naam sirf aakhri sahara
const found={};
async function models(type,key){
  if(found[type])return found[type];
  let list=[];
  try{
    if(type==="gemini"){
      const j=await call("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",{headers:{"x-goog-api-key":key}},6000);
      const ver=n=>parseFloat((n.match(/gemini-(\d+(\.\d+)?)/)||[])[1]||0);
      list=j.models.filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")).map(m=>m.name.replace("models/",""))
        .filter(n=>/^gemini-[\d.]+-flash(-lite)?$/.test(n)).sort((a,b)=>(/lite/.test(b)?1:0)-(/lite/.test(a)?1:0)||ver(b)-ver(a));
    }else if(type==="groq"){
      const j=await call("https://api.groq.com/openai/v1/models",{headers:{Authorization:"Bearer "+key}},6000);
      list=j.data.map(m=>m.id).filter(n=>/llama|qwen|gpt-oss|gemma/i.test(n)&&!/guard|whisper|tts/i.test(n)).sort((a,b)=>(/instant/.test(b)?1:0)-(/instant/.test(a)?1:0));
    }else{
      const j=await call("https://openrouter.ai/api/v1/models",{},6000);
      list=j.data.map(m=>m.id).filter(n=>n.endsWith(":free"));
    }
  }catch(e){if(e.status===400||e.status===401||e.status===403)throw e}
  if(list.length)return found[type]=list.slice(0,3);
  return type==="gemini"?["gemini-3.5-flash-lite","gemini-3.6-flash"]:type==="groq"?["llama-3.1-8b-instant"]:["openrouter/free"];
}
const G="kc_quick_good";
const goodAll=()=>{try{return JSON.parse(get(G,"{}"))||{}}catch(e){return {}}};
const setGood=(type,model)=>{const a=goodAll();if(model)a[type]=model;else delete a[type];put(G,JSON.stringify(a))};
async function one(type,key,model,sys,msgs){
  if(type==="gemini"){
    const j=await call("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
      body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:msgs.map(m=>({role:m.who==="me"?"user":"model",parts:[{text:m.text}]}))})});
    return ((((j.candidates||[])[0]||{}).content||{}).parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("").trim();
  }
  const url=type==="groq"?"https://api.groq.com/openai/v1/chat/completions":"https://openrouter.ai/api/v1/chat/completions";
  const j=await call(url,{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({model,messages:[{role:"system",content:sys},...msgs.map(m=>({role:m.who==="me"?"user":"assistant",content:m.text}))]})});
  return (((j.choices||[])[0]||{}).message||{}).content?.trim()||"";
}
let yaad=null,yaadJob=null;
function loadYaad(){
  return yaadJob||(yaadJob=fetch("https://raw.githubusercontent.com/"+OWNER+"/"+REPO+"/auto-video/YAAD.md",{cache:"no-store"})
    .then(async r=>{if(r.ok)yaad=(await r.text()).slice(-4000)}).catch(()=>{}).finally(()=>{yaadJob=null}));
}
async function system(){
  if(yaad===null){const got=loadYaad();await Promise.race([got,new Promise(r=>setTimeout(r,1500))])}
  let mem=[];try{mem=JSON.parse(get("kc_jarvis_mem","[]"))}catch(e){}
  const gh=(typeof chatMsgs!=="undefined"?chatMsgs:[]).filter(m=>m.who==="ai").slice(-3).map(m=>m.text.replace(/\s+/g," ").slice(0,350));
  return "Tum Jarvis ho, Katha Chitra (Ramayan Shorts channel) ke owner ke sahayak. Use 'sir' kaho. Jawab aam bolchaal ki Hindi/Hinglish mein, 1-3 chhote vakya (zyada tabhi jab maange). Owner jis lipi mein likhe usi mein likho.\nBolne ka andaaz: aaj kal ki Hindi-English mili bol-chaal, jaise do dost baat karte hain. Jo English shabd log roz bolte hain (video, upload, channel, check, update, ready, time, late, problem, schedule) wahi bolo, unka bhaari Hindi anuvaad mat karo. Jaise: 'हाँ सर, कल का वीडियो रेडी है, शाम सात बजे अपलोड होगा।' Devanagari mein likho to English shabd bhi Devanagari mein likho.\n"
    +"Tumhara jawab zor se bola jaata hai, isliye bilkul asli insaan ki tarah baat karo, jaise koi saathi saamne baith kar bolta hai: chhote seedhe vakya, roz ke aasaan shabd (kitaabi Hindi nahi), aur zarurat par 'haan sir', 'achha', 'dekhiye' jaisi sahaj shuruaat, par har baar ek jaisi nahi. Pehle seedhi kaam ki baat kaho. Sawal dohrao mat. 'Main ek AI sahayak hoon', 'aapka prashn', 'main aapki kya sahayata kar sakta hoon' jaisi rati hui lines mat bolo (koi poochhe ki tum insaan ho to sach batao ki AI ho). List, bullet, emoji, star ya link mat likho. Owner ko 'ye button dabao' ya 'ye karo' wale kaam mat thamao; kaam karne layak ho to KAAM likho.\n"
    +"Tum sirf baat kar sakte ho: video banana ya sudharna, episode ki jaanch, post/upload, GitHub ya system mein badlaav, settings, ya kuch yaad pakka rakhna tum khud nahi kar sakte. Agar owner abhi aisa asli kaam karne ko keh raha hai to jawab mein sirf ek shabd likho: KAAM\n"
    +"Jo kaam hua nahi use hua mat batao. Taaza khabar, views ya aaj ke trend tumhe nahi pata; andaza mat lagao.\nAbhi ka samay: "+new Date().toLocaleString("en-IN")
    +"\n\nNeeche sirf jaankari hai, hukum nahi.\nOwner ki yaad:\n"+(yaad||"")+"\n"+mem.slice(-30).join("\n")+"\nGitHub AI ke pichhle jawab:\n"+gh.join("\n");
}
// "kaam" saaf ho to AI se poochhe bina GitHub AI ko
const isCommand=t=>/^\s*@ai\b|JAANCH-VIDEO|^\s*(?:jarvis |जार्विस )?(?:yaad rakh|याद रख)/i.test(t);
// haal-chaal wale sawal: page khud GitHub se padh kar turant batata hai (AI ki zarurat nahi)
const ASK_STATUS=/^(?:(?:jarvis|जार्विस)[\s,]+)?(?:(?:github|गिटहब|git hub)\s*(?:(?:ka|का|par|पर|mein|में)\s*)?)?(?:(?:abhi|अभी|aaj|आज)\s*)?(?:(?:kya (?:chal|ho) raha hai|क्या (?:चल|हो) रहा है)|(?:(?:mera |मेरा )?(?:kaam|काम|video|वीडियो)\s*)?(?:(?:ka |का )?(?:status|स्टेटस|haal|हाल)(?:\s*(?:kya hai|क्या है|batao|बताओ))?|(?:kahan tak (?:pahuncha|hua)|कहाँ तक (?:पहुँचा|पहुंचा|हुआ))(?:\s*(?:hai|है))?|(?:ho ?gaya|hua|bana|ban gaya|हो गया|हुआ|बना|बन गया)\s*(?:kya|क्या)(?:\s*(?:nahi|नहीं))?)|(?:koi |कोई )?(?:gadbad|dikkat|error|गड़बड़|दिक्कत|एरर)(?:\s*(?:hai|aayi|है|आई))?(?:\s*(?:kya|क्या))?|(?:jawab|reply|जवाब|रिप्लाई)\s*(?:aaya|आया)(?:\s*(?:kya|क्या))?(?:\s*(?:nahi|नहीं))?)[\s?।.!]*$/i;
// "video kab / kitne baje upload hogi" - jawab bhaagon ki asli list se
function isWhen(t){
  const c=String(t).toLowerCase();
  return /upload|post|publish|youtube|अपलोड|पोस्ट|पब्लिश|यूट्यूब/.test(c)
    &&/kitne baje|kis time|kis samay|kab\b|कितने बजे|किस टाइम|किस समय|कब(?![\u0900-\u097F])/.test(c)
    &&/hogi|hoga|hoge|jayegi|jaayegi|jayega|jaayega|aayegi|aayega|aaegi|होगी|होगा|जाएगी|जायेगी|जाएगा|जायेगा|आएगी|आयेगी|आएगा|आयेगा/.test(c)
    &&!/blog|ब्लॉग|instagram ke views|views|व्यूज/.test(c)&&!/^\s*@ai/.test(c);
}
const isStatus=t=>ASK_STATUS.test(String(t).trim())||isWhen(t);
const istDay=n=>new Date(Date.now()+19800000+n*86400000).toISOString().slice(0,10);
async function whenUpload(text,L){
  const eps=JSON.parse(await rawText("episodes.json","main"));
  const list=Object.keys(eps).map(k=>({k,...eps[k]})).filter(e=>e.status==="ready"&&e.auto!==false&&!e.youtube_id&&e.date>=istDay(0))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.k-b.k);
  const want=/aaj|आज/i.test(text)?0:(/(^|\s)(kal|कल)(\s|$)/i.test(text)?1:null);
  const day=d=>d===istDay(0)?L("आज","aaj"):d===istDay(1)?L("कल","kal"):new Date(d+"T12:00:00Z").toLocaleDateString(L("hi-IN","en-IN"),{day:"numeric",month:"long",timeZone:"UTC"});
  const hit=want===null?list.slice(0,1):list.filter(e=>e.date===istDay(want));
  const late=L(" वैसे कभी-कभी गिटहब एक घंटा लेट भी कर देता है।"," Waise kabhi-kabhi GitHub ek ghanta late bhi kar deta hai.");
  const show=list.slice(0,4).map(e=>"📅 "+e.date+" · Bhag "+e.k+" · "+String(e.title||e.file||"").replace(/ #shorts$/,"")).join("\n");
  if(hit.length){const d=day(hit[0].date),n=hit.map(e=>e.k).join(L(" और "," aur "));
    return {text:L("सर, "+d+" भाग "+n+" शाम 7 बजे यूट्यूब पर अपलोड के लिए शेड्यूल है।","Sir, "+d+" Bhag "+n+" shaam 7 baje YouTube par upload ke liye schedule hai.")+late,show}}
  const next=list[0];
  const no=want===null?L("सर, अभी कोई वीडियो अपलोड के लिए लाइन में नहीं है।","Sir, abhi koi video upload ke liye line mein nahi hai.")
    :L("सर, "+(want?"कल":"आज")+" के लिए कोई वीडियो लाइन में नहीं दिख रहा।","Sir, "+(want?"kal":"aaj")+" ke liye koi video line mein nahi dikh raha.");
  return {text:no+(next?L(" अगला भाग "+next.k+", "+day(next.date)+" शाम 7 बजे तय है।"," Agla Bhag "+next.k+", "+day(next.date)+" shaam 7 baje tay hai."):""),show};
}
let cache=null,job=null;
// taaza haal (25 second tak purana) turant; warna GitHub se naya
function runsNow(){
  const tok=gt();
  if(cache&&cache.tok===tok&&Date.now()-cache.at<25000)return Promise.resolve(cache.runs);
  return job||(job=(async()=>{
    const r=await api("/actions/runs?per_page=30");
    if(!r.ok){const e=new Error("HTTP "+r.status);e.status=r.status;throw e}
    const runs=(await r.json()).workflow_runs||[];cache={tok,at:Date.now(),runs};return runs;
  })().finally(()=>{job=null}));
}
// page saamne ho to haal pehle se laakar rakho, taaki poochhte hi jawab mile
const warm=()=>{if(gt()&&!document.hidden)runsNow().catch(()=>{})};
warm();setInterval(warm,20000);document.addEventListener("visibilitychange",warm);
// har kaam ki sirf sabse nayi haalat
function summary(runs){
  const seen=new Set(),running=[],failed=[];let last=null;
  for(const x of runs){
    if(x.status!=="completed"){running.push(x);continue}
    if(x.conclusion!=="success"&&x.conclusion!=="failure"&&x.conclusion!=="timed_out")continue;
    if(!last)last=x;
    if(seen.has(x.workflow_id))continue;seen.add(x.workflow_id);
    if(x.conclusion!=="success")failed.push(x);
  }
  return {running,failed,last};
}
const mins=d=>Math.max(0,Math.round((Date.now()-new Date(d))/60000));
async function status(text){
  const hi=/[\u0900-\u097F]/.test(text),L=(a,b)=>hi?a:b;
  if(!gt())return {text:L("सर, पहले सेटिंग में टोकन डालना पड़ेगा।","Sir, pehle setup mein token daalna padega.")};
  try{
    if(isWhen(text))return await whenUpload(text,L);
    if(/jawab|reply|जवाब|रिप्लाई/i.test(text)){
      await origLoad();
      const m=chatMsgs[chatMsgs.length-1];
      if(m&&m.who==="ai")return {text:L("जी सर, जवाब आ गया है। ","Haan sir, jawab aa gaya hai. ")+m.text.replace(/\s+/g," ").slice(0,300)};
      return {text:L("सर, आख़िरी बात का जवाब अभी नहीं आया है।","Sir, aakhri baat ka jawab abhi nahi aaya hai.")};
    }
    const s=summary(await runsNow()),out=[],show=[];
    if(s.running.length){out.push(L("सर, अभी "+s.running.length+" काम चल रहे हैं या लाइन में हैं।","Sir, abhi "+s.running.length+" kaam chal rahe hain ya line mein hain."));s.running.slice(0,4).forEach(x=>show.push("⏳ "+x.name+" ("+mins(x.created_at)+" min)"))}
    else out.push(L("सर, अभी कोई काम नहीं चल रहा।","Sir, abhi koi kaam nahi chal raha."));
    if(s.last){const ok=s.last.conclusion==="success",m=mins(s.last.updated_at),ago=m<60?L(m+" मिनट",m+" minute"):L(Math.round(m/60)+" घंटे",Math.round(m/60)+" ghante");
      out.push(L("आख़िरी काम "+ago+" पहले "+(ok?"ठीक से पूरा हुआ।":"अटक गया था।"),"Aakhri kaam "+ago+" pehle "+(ok?"theek se poora hua.":"atak gaya tha.")));show.push((ok?"✅ ":"❌ ")+s.last.name)}
    if(s.failed.length){out.push(L(s.failed.length+" काम में गड़बड़ दिख रही है, नाम चैट में लिख दिए हैं।",s.failed.length+" kaam mein gadbad dikh rahi hai, naam neeche likhe hain."));s.failed.slice(0,4).forEach(x=>show.push("❌ "+x.name))}
    else out.push(L("हाल के कामों में कोई गड़बड़ नहीं दिखी।","Haal ke kaamon mein koi gadbad nahi dikhi."));
    return {text:out.join(" "),show:[...new Set(show)].join("\n")};
  }catch(e){
    return {text:e.status===401||e.status===403||e.status===404?L("सर, टोकन को ये जानकारी पढ़ने की इजाज़त नहीं है।","Sir, token ko ye jaankari padhne ki ijazat nahi hai. (Actions: Read)"):L("सर, अभी गिटहब से जानकारी नहीं आ पाई।","Sir, abhi GitHub se jaankari nahi aa payi.")};
  }
}
const full=r=>r.text+(r.show?"\n"+r.show:"");
// tez AI ko bhi GitHub ka abhi ka haal pata ho
async function ghNow(){
  if(!gt())return "";
  try{const runs=await Promise.race([runsNow(),new Promise(r=>setTimeout(()=>r([]),1500))]);
    return runs.slice(0,8).map(x=>x.name+" | "+(x.status==="completed"?x.conclusion:x.status)+" | "+mins(x.updated_at)+" min pehle").join("\n")}catch(e){return ""}
}
async function ask(text){
  if(isCommand(text))return {work:true};
  const [base,now]=await Promise.all([system(),ghNow()]);
  const sys=base+(now?"\nGitHub par kaamon ka abhi ka haal (naam | haalat | kab):\n"+now:""),msgs=hist.slice(-10).map(m=>({who:m.who,text:m.text})).concat({who:"me",text});
  while(msgs.length&&msgs[0].who!=="me")msgs.shift();
  let why="";
  for(const key of keys()){
    const type=kind(key);
    try{
      // pehle pichli baar wala; wo na chale tabhi list mangwao
      const good=goodAll()[type],tried=new Set();
      let list=good?[good]:await models(type,key);
      for(let i=0;i<list.length;i++){
        const model=list[i];if(tried.has(model))continue;tried.add(model);
        try{
          const out=await one(type,key,model,sys,msgs);
          if(!out){if(model===good){setGood(type);list=list.concat(await models(type,key))}continue}
          setGood(type,model);
          if(/^\W*KAAM\W*$/i.test(out))return {work:true};
          return {text:out};
        }catch(e){why=e.name==="AbortError"?"der ho gayi":e.message;if(e.status===401||e.status===403)break;
          if(model===good){setGood(type);list=list.concat(await models(type,key))}}
      }
    }catch(e){why=e.message}
  }
  return {fail:why||"chaabi kaam nahi kar rahi"};
}
function show(who,text){hist.push({who,text,at:new Date().toISOString(),id:"q"+Date.now()+Math.random()});hist=hist.slice(-40);saveHist();renderChat()}

// chat mein tez jawab bhi dikhao
const origRender=renderChat;
renderChat=function(){
  const keep=chatMsgs;
  chatMsgs=keep.concat(hist).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
  try{origRender()}finally{chatMsgs=keep}
};
const origLoad=loadChat;
loadChat=async function(){await origLoad();if(!gt()&&hist.length)renderChat()};

const github=$("send").onclick;
// mic se poochha ho to jawab bolkar bhi sunao
let spoke=false;
$("mic").addEventListener("click",()=>{spoke=true;if(window.kcVoice)window.kcVoice.hush();try{window.speechSynthesis.cancel()}catch(e){}},true);
$("txt").addEventListener("input",()=>{spoke=false});
function sayOut(t){if(window.kcVoice){window.kcVoice.speak(t.replace(/[#*_`]/g," ").slice(0,350));return}try{const S=window.speechSynthesis,u=new SpeechSynthesisUtterance(t.replace(/[#*_`]/g," ").slice(0,350));u.lang="hi-IN";u.pitch=0.8;S.cancel();S.speak(u)}catch(e){}}
let busy=false;
$("send").onclick=async function(){
  const box=$("txt"),t=box.value.trim();
  if(t&&isStatus(t)&&gt()){
    if(busy)return;busy=true;killMic();st("⚡ GitHub se dekh raha hoon…");
    let r;try{r=await status(t)}finally{busy=false}
    if(box.value.trim()===t){box.value="";box.style.height=""}show("me",t);show("ai","⚡ "+full(r));st("Jawab aa gaya ✅");if(spoke){spoke=false;sayOut(r.text)}return}
  if(!t||!keys().length||isCommand(t))return github.apply(this,arguments);
  if(busy)return;
  busy=true;$("send").disabled=true;killMic();st("⚡ Soch raha hoon…");
  let r;try{r=await ask(t)}catch(e){r={fail:e.message}}
  busy=false;$("send").disabled=false;
  if(r.text){if(box.value.trim()===t){box.value="";box.style.height=""}show("me",t);show("ai","⚡ "+r.text);st("Jawab aa gaya ✅");if(spoke){spoke=false;sayOut(r.text)}return}
  if(r.fail)toast("⚡ Tez AI nahi chala ("+r.fail+"). GitHub AI ko bhej raha hoon",true);
  if(box.value.trim()===t)return github.apply(this,arguments);
};

// chaabi daalne ka dabba (sirf isi phone mein rehti hai)
$("composer").insertAdjacentHTML("beforebegin",'<details id="qkbox" style="margin:4px 8px;border:1px solid #38e1ff;border-radius:12px;padding:8px 10px;font-size:14px"><summary id="qksum"></summary><div style="margin:8px 0;line-height:1.5">Free chaabi yahan se banao: <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> → copy karke neeche chipkao. Ye sirf isi phone mein rehti hai. Kisi ko ya chat mein mat bhejna. Free chaabi par likhi baat Google apne sudhaar mein istemaal kar sakta hai, isliye niji baat mat likhna.</div><input id="qkin" type="password" placeholder="Chaabi yahan (do-teen ho to beech mein khaali jagah)" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px"><button id="qksave" class="b" style="margin-top:8px">Save aur jaanch</button> <button id="qkdel" class="b" style="margin-top:8px">Chaabi mitao</button><div id="qkmsg" style="margin-top:6px"></div></details>');
const label=()=>{$("qksum").textContent=keys().length?"⚡ Turant jawab: chalu ✅":"⚡ Turant jawab chalu karo (ek baar)"};
$("qksave").onclick=async()=>{
  const v=$("qkin").value.trim();
  if(v.length<16){$("qkmsg").textContent="Poori chaabi chipkao.";return}
  const old=get(K,"");put(K,v);$("qkmsg").textContent="Jaanch raha hoon…";Object.keys(found).forEach(k=>delete found[k]);
  const r=await ask("बस इतना कहो: तैयार हूँ सर");
  if(r.fail){put(K,old);$("qkmsg").textContent="❌ Chaabi nahi chali: "+r.fail}
  else{$("qkin").value="";$("qkmsg").textContent="✅ Chalu ho gaya. "+(r.text||"")}
  label();
};
$("qkdel").onclick=()=>{put(K,"");$("qkin").value="";$("qkmsg").textContent="Chaabi mita di.";label()};
label();renderChat();
// page khulte hi taiyari, taaki pehla jawab bhi jaldi aaye
if(keys().length){loadYaad();const k=keys()[0];if(!goodAll()[kind(k)])models(kind(k),k).catch(()=>{})}
window.kcQuick={ready:()=>keys().length>0,ask,show,isStatus,status,full,github:()=>github.call($("send"))};
})();
