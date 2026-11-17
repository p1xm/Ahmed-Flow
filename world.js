/* =====================================================================
   🐾 عالمي — عملات + متجر + صناديق + حيوان أليف + وحش أسبوعي
              + جائزة التعويض + القاتل الصامت
   - كل لاعب بيكتب في محفظته هو بس (wallet/{id}). مفيش أي تعديل في بيانات الأصحاب.
   - دقايق المذاكرة بتتقري من state.daily (قراءة بس) وكل الحسابات بتتعمل على جهاز اللاعب.
   ===================================================================== */
(function(){
"use strict";
if(typeof fs==="undefined"||!fs||typeof auth==="undefined"||!auth||typeof PAGES==="undefined")return;

/* ---------- القواعد ---------- */
const ECON_START="2026-11-17";           // مفيش حاجة بتتحسب قبل اليوم ده
const COIN_PER_HOUR=10,DAILY_CAP=100;    // 10 عملات لكل ساعة (حد أقصى 100 في اليوم)
const STREAK_MIN=60,STREAK_STEP=5,STREAK_MAX=30;   // يوم الاستمرارية = ساعة مذاكرة، +5 لكل يوم متتالي (حد 30)
const BOX_EVERY=120,BOX_MAX_DAY=3;       // كل ساعتين في اليوم = صندوق (حد 3)
const PET_STAGES=[0,5,20,50,100,200];    // ساعات النمو لكل مرحلة
const STAGE_NAMES=["بيضة","صغير","ناشئ","قوي","بطل","أسطورة"];
const MISS_MIN=60;                       // أقل من ساعة في اليوم = غياب
const COMP_PAY=20,COMP_REMATCH=40,COMP_DAYS=7;
const KILL_REWARD=30,SURVIVE_REWARD=10,ASSASSIN_MIN_H=3,MONSTER_MIN_H=2;
const DAY=864e5;

/* ---------- الكتالوج ---------- */
const FRAMES={
  flame:{n:"إطار اللهب",e:"🔥",p:150},ice:{n:"إطار الجليد",e:"❄️",p:150},gold:{n:"إطار ذهبي",e:"🥇",p:150},
  neon:{n:"إطار نيون",e:"💜",p:150},leaf:{n:"إطار الطبيعة",e:"🍃",p:150},royal:{n:"إطار ملكي",e:"👑",p:150},
  galaxy:{n:"إطار المجرة",e:"🌌",p:0,box:1},rainbow:{n:"إطار قوس قزح",e:"🌈",p:0,box:1}
};
const TITLES={
  persist:{n:"🔥 المثابر",p:60},bookworm:{n:"📚 دودة الكتب",p:60},owl:{n:"🌙 صقر الليل",p:60},
  rocket:{n:"⚡ الصاروخ",p:60},genius:{n:"🧠 العبقري",p:60},sniper:{n:"🎯 القناص",p:60},
  lucky:{n:"🍀 محظوظ",p:0,box:1},rare:{n:"💎 نادر",p:0,box:1},star:{n:"🌟 نجم الشلة",p:0,box:1},
  slayer:{n:"🗡️ قاتل الوحش",p:0,sp:1}
};
const ACCS={
  hat:{n:"قبعة",e:"🎩",p:80,pos:"top"},glasses:{n:"نظارة",e:"🕶️",p:80,pos:"face"},crown:{n:"تاج",e:"👑",p:80,pos:"top"},
  ribbon:{n:"فيونكة",e:"🎀",p:80,pos:"top"},scarf:{n:"وشاح",e:"🧣",p:80,pos:"neck"},cap:{n:"كاب",e:"🧢",p:80,pos:"top"}
};
const PRICE_BOX=100,PRICE_SHIELD=120;
const BOX_TITLE_DAYS=3,SHOP_TITLE_DAYS=7;
const MONSTERS=[["تنين الكسل","🐲"],["غول السهر","👹"],["عفريت التأجيل","👺"],["وحش الملل","👾"],["شبح التشتت","👻"],["عملاق النوم","🦣"],["ثعبان الإلهاء","🐍"],["هيدرا المماطلة","🐉"]];
const SPECIES={
  m:[["أسد","🦁"],["نمر","🐅"],["ذئب","🐺"],["نسر","🦅"],["تمساح","🐊"],["دب","🐻"],["قرش","🦈"]],
  f:[["قطة","🐱"],["أرنب","🐰"],["باندا","🐼"],["بطريق","🐧"],["ثعلب","🦊"],["كتكوت","🐥"],["غزال","🦌"]]
};
const FEM=new Set(("مريم سارة نور هدى ليلى ياسمين اية آية ايمان إيمان رحمة رنا ريم دعاء شروق منى سلمى هبة أمل امل الاء آلاء ندى دينا جنى جنة ملك بسمة حبيبة زينب خديجة عائشة فاطمة أسماء اسماء إسراء اسراء رؤى رودينا روان رحاب ريماس سجى شهد شيماء صفاء علا عبير غادة فرح لمياء لينا لجين مروة منة ميار مي ميرنا نهى نادين نجلاء هاجر هالة هنا هند وفاء ولاء يارا يسرا يمنى سمر سمية سلوى نرمين نورهان رغد رزان تسنيم تقى جميلة جودي جومانا حنان حياة خلود دالية ريهام ريتاج زهرة سناء سهى شذى شهيرة عبلة غدير فريدة كارما كنزي لبنى لمى مها ميادة ناريمان نسمة نيللي هديل هيام").split(" ").map(normName));
const MALE_EX=new Set(["حمزة","أسامة","معاوية","طلحة","عبيدة","قتيبة","زكريا","حمدة","عكاشة","سلامة","جابر","أنس"].map(normName));

/* =====================================================================
   دوال نقية (من غير شبكة) — بتتختبر لوحدها
   ===================================================================== */
const minOf=(u,d)=>(u&&u.state&&u.state.daily&&u.state.daily[d])||0;
const hoursSum=(u,a,b)=>{let m=0;for(let d=a,i=0;d<=b&&i<400;d=addDays(d,1),i++)m+=minOf(u,d);return m/60};
const weekHours=(u,wk)=>hoursSum(u,wk,addDays(wk,6));
const h1=x=>Math.round(x*10)/10;
const daysBetween=(a,b)=>Math.round((pd(b)-pd(a))/DAY);

function streakLen(u,d){let n=0,x=d;while(n<7&&minOf(u,x)>=STREAK_MIN){n++;x=addDays(x,-1)}return n}
function incomeFor(u,d,x2){
  const m=minOf(u,d);let base=Math.min(DAILY_CAP,Math.floor(m*COIN_PER_HOUR/60));
  if(x2)base*=2;
  const bonus=m>=STREAK_MIN?Math.min(STREAK_MAX,STREAK_STEP*streakLen(u,d)):0;
  return base+bonus;
}
const boxesFor=m=>Math.min(BOX_MAX_DAY,Math.floor(m/BOX_EVERY));

function genderGuess(name){
  const first=normName(String(name||"").trim().split(/\s+/)[0]||"");
  if(FEM.has(first))return"f";
  if(MALE_EX.has(first))return"m";
  if(first.length>=4&&/ه$/.test(first))return"f";
  return"m";
}
function speciesFor(name,g){
  const first=normName(String(name||"").trim().split(/\s+/)[0]||"");
  const list=SPECIES[g==="f"?"f":"m"];
  return list[Math.floor(rnd("pet"+first)*list.length)%list.length];
}
const stageOf=xp=>{let s=0;PET_STAGES.forEach((t,i)=>{if(xp>=t-1e-9)s=i});return s};
const petInit=day=>({xp:0,day:addDays(day,-1),miss:0,g:"",deaths:0,died:"",dead:false,born:day});
/* بيعدّي على الأيام الكاملة (لحد إمبارح) ويطبّق: غياب 1 = تعب، 2 = يرجع مرحلة، 3 = يموت */
function petAdvance(p,u,today){
  const ev=[];let d=addDays(p.day,1),guard=0;
  while(d<today&&guard++<120){
    const m=minOf(u,d),h=m/60;
    if(p.dead){
      if(m>=MISS_MIN){p.dead=false;p.xp=h;p.miss=0}
    }else{
      p.xp+=h;
      if(m>=MISS_MIN)p.miss=0;
      else{
        p.miss++;
        if(p.miss===2){const s=stageOf(p.xp);if(s>0){p.xp=PET_STAGES[s-1];ev.push({t:"drop",d})}}
        else if(p.miss>=3){p.xp=0;p.miss=0;p.deaths++;p.died=d;p.dead=true;ev.push({t:"die",d})}
      }
    }
    p.day=d;d=addDays(d,1);
  }
  return ev;
}
function petView(p,u,today){
  const tm=minOf(u,today);
  const live=p.dead?(tm>=MISS_MIN?tm/60:0):p.xp+tm/60;
  const stage=stageOf(live);
  const tired=!p.dead&&p.miss>=1&&tm<MISS_MIN;
  return{xp:live,stage,tired,dead:p.dead&&tm<MISS_MIN};
}

function buildAssign(ranked){
  const n=ranked.length;if(n<3)return{};
  const ev=[],od=[];ranked.forEach((x,i)=>(i%2?od:ev).push(x));
  const cyc=ev.concat(od.reverse()),out={};
  cyc.forEach((x,i)=>out[x]=cyc[(i+1)%n]);
  return out;
}
const monsterIndex=wk=>Math.floor(pd(wk).getTime()/(7*DAY))%MONSTERS.length;
function monsterHp(nActive,lastTotal){
  const n=Math.max(1,nActive),lo=n*4,hi=n*14;
  const hp=lastTotal>0?Math.round(lastTotal*0.85):n*8;
  return Math.max(lo,Math.min(hi,hp));
}
function monsterStatus(doc,users,today){
  const wk=doc.wk,per={};let total=0;
  Object.keys(users).forEach(id=>{const h=weekHours(users[id],wk);per[id]=h;total+=h});
  return{total,per,hp:doc.monster.hp,dead:total>=doc.monster.hp,ended:today>addDays(wk,6)};
}
function compAmount(d,duels){
  const prev=duels.filter(x=>x.status==="done"&&x.winner&&x.id!==d.id&&x.end<d.end&&
    ((x.from===d.from&&x.to===d.to)||(x.from===d.to&&x.to===d.from))&&daysBetween(x.end,d.end)<=COMP_DAYS)
    .sort((a,b)=>a.end<b.end?1:-1)[0];
  return prev&&prev.winner!==d.winner?COMP_REMATCH:COMP_PAY;
}
const pick=(arr,rng)=>arr[Math.floor(rng()*arr.length)%arr.length];
function rollBox(rng,pity){
  const rareForced=pity>=9;
  let k;
  if(rareForced){const r=rng();k=r<.35?"frame":r<.65?"acc":r<.85?"shield":"x2"}
  else{const r=rng();k=r<.6?"coins":r<.7?"title":r<.78?"frame":r<.9?"acc":r<.95?"shield":"x2"}
  if(k==="coins")return{k,v:rng()<.05?60:10+Math.floor(rng()*31)};
  if(k==="title")return{k,v:pick(Object.keys(TITLES).filter(x=>TITLES[x].box),rng)};
  if(k==="frame")return{k,v:pick(Object.keys(FRAMES),rng)};
  if(k==="acc")return{k,v:pick(Object.keys(ACCS),rng)};
  return{k,v:1};
}
const isRare=k=>k==="frame"||k==="acc"||k==="shield"||k==="x2";

const defW=()=>({coins:0,inc:{},bx:{},boxes:0,pity:0,opened:0,inv:{frames:[],accs:[],shield:0,x2:0},
  eq:{frame:"",title:"",acc:""},tt:[],x2d:"",shW:{},pet:null,claimed:{},warPaid:{},log:[],name:""});
function normW(w){
  const d=defW();
  Object.keys(d).forEach(k=>{if(w[k]===undefined||w[k]===null)w[k]=d[k]});
  ["frames","accs"].forEach(k=>{if(!Array.isArray(w.inv[k]))w.inv[k]=[]});
  ["shield","x2"].forEach(k=>{w.inv[k]=w.inv[k]||0});
  ["frame","title","acc"].forEach(k=>{w.eq[k]=w.eq[k]||""});
  return w;
}
const logW=(w,x)=>{w.log.unshift({t:Date.now(),x});w.log=w.log.slice(0,30)};
const activeTT=(w,now)=>w.tt.filter(x=>x.until>now);
function addTitle(w,id,days,now){
  const ex=w.tt.find(x=>x.id===id&&x.until>now);
  if(ex)ex.until+=days*DAY;else w.tt.push({id,until:now+days*DAY});
}
const activeIn=(u,wk)=>hoursSum(u,addDays(wk,-14),addDays(wk,6))>=0.5;

/* =====================================================================
   الحسم والمزامنة (بتتنفذ جوه Transaction على محفظتي أنا بس)
   ctx = {me,users,today,duels,tr,week:{cur,prev,prev2},war:[{mk,data}],allW,now}
   ===================================================================== */
function applySync(w,extra,ctx){
  const {me,users,today,now}=ctx,u=users[me]||ctx.meUser,msgs=[];
  const say=x=>{logW(w,x);msgs.push(x)};
  const nm=id=>(users[id]&&users[id].name)||"؟";
  w.name=u?u.name:w.name;

  // 1) دخل المذاكرة + السلسلة + الصناديق (آخر 3 أيام)
  for(let i=2;i>=0;i--){
    const d=addDays(today,-i);if(d<ECON_START)continue;
    const tgt=incomeFor(u,d,w.x2d===d),cur=w.inc[d]||0;
    if(tgt>cur){w.coins+=tgt-cur;w.inc[d]=tgt;if(d===today&&tgt-cur>=5)msgs.push("🪙 +"+(tgt-cur)+" من المذاكرة")}
    const nb=boxesFor(minOf(u,d)),cb=w.bx[d]||0;
    if(nb>cb){w.boxes+=nb-cb;w.bx[d]=nb;say("🎁 كسبت "+(nb-cb===1?"صندوق":(nb-cb)+" صناديق")+" غنائم!")}
  }
  [w.inc,w.bx].forEach(o=>Object.keys(o).forEach(k=>{if(k<addDays(today,-10))delete o[k]}));

  // 2) الحيوان الأليف
  if(!w.pet)w.pet=petInit(today>ECON_START?today:ECON_START);
  petAdvance(w.pet,u,today).forEach(e=>{
    if(e.t==="drop")say("😿 حيوانك رجع مرحلة لورا عشان غبت يومين");
    if(e.t==="die")say("💀 حيوانك مات عشان غبت 3 أيام... هيبدأ من البيضة تاني");
  });

  // 3) عملات مناطق حرب المناطق
  (ctx.war||[]).forEach(({mk,data})=>{
    const c=(data&&data.players&&data.players[me]&&data.players[me].coins)||0,paid=w.warPaid[mk]||0;
    if(c>paid){w.coins+=c-paid;w.warPaid[mk]=c;say("🗺️ +"+(c-paid)+" 🪙 دخل مناطقك")}
  });

  // 4) جائزة التعويض (المبارزات)
  (ctx.duels||[]).forEach(d=>{
    if(d.status!=="done"||!d.winner||!d.end||d.end<ECON_START||(d.from!==me&&d.to!==me))return;
    const loser=d.winner===d.from?d.to:d.from;
    if(loser===me&&!w.claimed["pay_"+d.id]){
      const want=compAmount(d,ctx.duels),paid=Math.min(want,w.coins);
      w.coins-=paid;w.claimed["pay_"+d.id]=true;
      extra.push({coll:"transfers",id:d.id,data:{from:me,to:d.winner,amt:paid,want,duel:d.id,t:now}});
      say("⚖️ دفعت "+paid+" 🪙 تعويض لـ "+nm(d.winner)+(want===COMP_REMATCH?" (رد اعتبار ×2)":""));
    }
    if(d.winner===me&&!w.claimed["rc_"+d.id]&&ctx.tr&&ctx.tr[d.id]&&ctx.tr[d.id].to===me){
      const a=ctx.tr[d.id].amt||0;w.claimed["rc_"+d.id]=true;w.coins+=a;
      say("⚖️ استلمت "+a+" 🪙 تعويض من "+nm(ctx.tr[d.id].from)+(ctx.tr[d.id].want===COMP_REMATCH?" (رد اعتبار ×2 🔥)":""));
    }
  });

  // 5) الوحش الأسبوعي
  ["cur","prev","prev2"].forEach(key=>{
    const doc=ctx.week&&ctx.week[key];if(!doc||!doc.monster)return;
    const st=monsterStatus(doc,users,today),wk=doc.wk,mine=st.per[me]||0;
    if(st.dead&&mine>=MONSTER_MIN_H&&!w.claimed["mon_"+wk]){
      const r=40+Math.min(80,Math.round(mine*5));
      w.claimed["mon_"+wk]=true;w.coins+=r;w.boxes+=1;
      say("🐉 الوحش وقع! غنيمتك "+r+" 🪙 + صندوق");
    }
    if(st.dead&&st.ended&&!w.claimed["top_"+wk]){
      const top=Object.keys(st.per).filter(id=>st.per[id]>=MONSTER_MIN_H).sort((a,b)=>(st.per[b]-st.per[a])||(a<b?-1:1))[0];
      w.claimed["top_"+wk]=true;
      if(top===me){addTitle(w,"slayer",7,now);w.boxes+=1;say("🗡️ أنت الأكتر ضربًا في الوحش: لقب «قاتل الوحش» + صندوق")}
    }
  });

  // 6) القاتل الصامت (بعد نهاية الأسبوع)
  ["prev","prev2"].forEach(key=>{
    const doc=ctx.week&&ctx.week[key];if(!doc||!doc.assign)return;
    const wk=doc.wk,ended=today>addDays(wk,6);if(!ended)return;
    const sh=id=>!!(ctx.allW&&ctx.allW[id]&&ctx.allW[id].shW&&ctx.allW[id].shW[wk])||(id===me&&!!w.shW[wk]);
    const target=doc.assign[me];
    if(target&&!w.claimed["asn_"+wk]){
      w.claimed["asn_"+wk]=true;
      const hm=weekHours(u,wk),ht=users[target]?weekHours(users[target],wk):0;
      if(sh(target))say("🛡️ درع "+nm(target)+" صدّ اغتيالك");
      else if(hm>ht&&hm>=ASSASSIN_MIN_H){w.coins+=KILL_REWARD;say("🥷 اغتلت "+nm(target)+"! +"+KILL_REWARD+" 🪙")}
      else say("😅 "+nm(target)+" نجا منك الأسبوع ده");
    }
    const hunter=Object.keys(doc.assign).find(h=>doc.assign[h]===me);
    if(hunter&&!w.claimed["sur_"+wk]){
      w.claimed["sur_"+wk]=true;
      const hm=weekHours(u,wk),hh=users[hunter]?weekHours(users[hunter],wk):0;
      if(sh(me)||hm>=hh||hh<ASSASSIN_MIN_H){w.coins+=SURVIVE_REWARD;say("🛡️ نجوت من قاتلك ("+nm(hunter)+")! +"+SURVIVE_REWARD+" 🪙")}
      else say("💀 اتغتلت على إيد "+nm(hunter)+" الأسبوع ده");
    }
  });

  w.tt=activeTT(w,now);
  if(w.eq.title&&!w.tt.some(x=>x.id===w.eq.title))w.eq.title="";
  return msgs;
}
window.__WORLD__={incomeFor,boxesFor,genderGuess,speciesFor,stageOf,petInit,petAdvance,petView,buildAssign,monsterHp,monsterStatus,compAmount,rollBox,isRare,applySync,defW,normW,weekHours,streakLen,addTitle};

/* =====================================================================
   الاتصال بالسيرفر
   ===================================================================== */
let started=false,ALLW={},TR={},WK={cur:null,prev:null,prev2:null},unsubs=[],tab="pet",syncing=false,wcss=false,prevFetched={},warFetchedAt=0,warCache=[];
const wref=id=>fs.collection("wallet").doc(id||ME.id);
const wkNow=()=>weekStartOf(todayK());

async function wtx(fn){
  const ref=wref();
  return fs.runTransaction(async tx=>{
    const s=await tx.get(ref);
    const w=normW(s.exists?Object.assign(defW(),s.data()):defW());
    const before=JSON.stringify(w),extra=[];
    const res=fn(w,extra);
    if(!s.exists||JSON.stringify(w)!==before||extra.length)tx.set(ref,w);
    extra.forEach(e=>tx.set(fs.collection(e.coll).doc(e.id),e.data));
    return res;
  });
}
function wErr(e){
  console.warn("world:",e);
  if(e&&e.code==="permission-denied")toast("⚠️ لازم تنشر قواعد Firestore الجديدة (ملف firestore.rules)");
}
async function ensureWeek(wk){
  const users=DB.users(),ids=Object.keys(users);
  if(!ids.length)return;
  const ref=fs.collection("weekly").doc(wk);
  await fs.runTransaction(async tx=>{
    const s=await tx.get(ref);if(s.exists)return;
    const pw=addDays(wk,-7),hrs=id=>weekHours(users[id],pw);
    const active=ids.filter(id=>activeIn(users[id],wk));
    let total=0;ids.forEach(id=>total+=hrs(id));
    const m=MONSTERS[monsterIndex(wk)];
    const ranked=active.slice().sort((a,b)=>(hrs(b)-hrs(a))||(a<b?-1:1));
    tx.set(ref,{wk,monster:{n:m[0],e:m[1],hp:monsterHp(active.length,total)},assign:buildAssign(ranked),act:active,created:Date.now()});
  });
}
async function loadPrevWeeks(){
  const wk=wkNow();
  for(const [key,w] of [["prev",addDays(wk,-7)],["prev2",addDays(wk,-14)]]){
    if(WK[key]&&WK[key].wk===w)continue;
    if(prevFetched[w]&&Date.now()-prevFetched[w]<10*60*1000&&!WK[key])continue;
    prevFetched[w]=Date.now();
    try{const s=await fs.collection("weekly").doc(w).get();WK[key]=s.exists?s.data():null}catch(e){}
  }
}
async function loadWar(){
  if(Date.now()-warFetchedAt<110000)return warCache;
  warFetchedAt=Date.now();
  const out=[];
  for(const mk of [curMonth(),prevMonth(curMonth())]){
    try{const s=await fs.collection("war").doc("war_"+mk).get();if(s.exists)out.push({mk,data:s.data()})}catch(e){}
  }
  return warCache=out;
}
async function syncAll(force){
  if(!ME||syncing)return;
  if(!DB.users()[ME.id])return;
  syncing=true;
  try{
    const wk=wkNow();
    try{await ensureWeek(wk)}catch(e){wErr(e)}
    await loadPrevWeeks();
    const war=await loadWar();
    const ctx={me:ME.id,meUser:ME,users:DB.users(),today:todayK(),now:Date.now(),duels:D_DUELS.get(),tr:TR,week:WK,war,allW:ALLW};
    const msgs=await wtx((w,extra)=>applySync(w,extra,ctx));
    if(msgs&&msgs.length)toast(msgs[0]+(msgs.length>1?" (+"+(msgs.length-1)+")":""));
  }catch(e){wErr(e)}
  syncing=false;
  if(curPage==="world")renderWorld();
}
function startWorld(){
  if(started||!fs||!ME)return;started=true;
  const subCol=(name,fn)=>{try{unsubs.push(fs.collection(name).onSnapshot(qs=>{try{fn(qs)}catch(e){console.warn('world:',e)}if(typeof scheduleRender==="function")scheduleRender();if(curPage==="world")renderWorld()},e=>{wErr(e)}))}catch(e){}};
  subCol("wallet",qs=>{ALLW={};qs.docs.forEach(d=>{ALLW[d.id]=normW(Object.assign(defW(),d.data()))})});
  subCol("transfers",qs=>{TR={};qs.docs.forEach(d=>{TR[d.id]=d.data()})});
  try{
    unsubs.push(fs.collection("weekly").doc(wkNow()).onSnapshot(s=>{WK.cur=s.exists?s.data():null;if(curPage==="world")renderWorld()},e=>wErr(e)));
  }catch(e){}
  setTimeout(()=>syncAll(),1500);
}
function stopWorld(){
  unsubs.forEach(f=>{try{f()}catch(e){}});unsubs=[];
  started=false;ALLW={};TR={};WK={cur:null,prev:null,prev2:null};prevFetched={};warFetchedAt=0;warCache=[];
}
setInterval(()=>{
  if(ME&&!started)startWorld();
  else if(!ME&&started)stopWorld();
  else if(ME&&started&&WK.cur&&WK.cur.wk!==wkNow()){stopWorld();startWorld()}   // بداية أسبوع جديد
},2000);
setInterval(()=>{if(ME&&started&&!document.hidden)syncAll()},120000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&ME&&started)syncAll()});

/* ---------- الإطارات والألقاب لباقي الموقع (صفحة الأصدقاء) ---------- */
window.WAR_COSM={
  frame(id){
    const w=ALLW[id];if(!w||!w.eq||!w.eq.frame)return"";
    return w.inv.frames.includes(w.eq.frame)?"wf-"+w.eq.frame:"";
  },
  title(id){
    const w=ALLW[id];if(!w||!w.eq||!w.eq.title)return"";
    const t=w.tt.find(x=>x.id===w.eq.title&&x.until>Date.now());
    return t&&TITLES[t.id]?`<span class="wtitle">${escapeHtml(TITLES[t.id].n)}</span>`:"";
  }
};

/* =====================================================================
   العمليات (شراء / تجهيز / فتح صندوق ...)
   ===================================================================== */
const COINS_ERR="العملات مش كفاية 🪙";
function spend(w,p){if(w.coins<p)throw new Error("coins");w.coins-=p}
async function act(name,fn,okMsg){
  try{
    const r=await wtx(fn);
    if(okMsg)toast(typeof okMsg==="function"?okMsg(r):okMsg);
  }catch(e){
    if(e&&e.message==="coins")toast(COINS_ERR);
    else if(e&&e.message&&e.message.startsWith("x:"))toast(e.message.slice(2));
    else{toast("حصل خطأ، جرّب تاني");wErr(e)}
  }
  renderWorld();
}
const X=m=>new Error("x:"+m);
function doBuy(kind,id){
  act("buy",w=>{
    const now=Date.now();
    if(kind==="frame"){const it=FRAMES[id];if(!it||it.box)throw X("مش متاح للشراء");if(w.inv.frames.includes(id))throw X("عندك الإطار ده");spend(w,it.p);w.inv.frames.push(id);w.eq.frame=id}
    else if(kind==="title"){const it=TITLES[id];if(!it||!it.p)throw X("مش متاح للشراء");spend(w,it.p);addTitle(w,id,SHOP_TITLE_DAYS,now);w.eq.title=id}
    else if(kind==="acc"){const it=ACCS[id];if(!it)throw X("مش متاح");if(w.inv.accs.includes(id))throw X("عندك الإكسسوار ده");spend(w,it.p);w.inv.accs.push(id);w.eq.acc=id}
    else if(kind==="box"){spend(w,PRICE_BOX);w.boxes++}
    else if(kind==="shield"){spend(w,PRICE_SHIELD);w.inv.shield++}
    else throw X("غير معروف");
    return 1;
  },"تم الشراء ✅");
}
function doEquip(kind,id){
  act("eq",w=>{
    if(kind==="frame"){if(id&&!w.inv.frames.includes(id))throw X("مش معاك");w.eq.frame=id}
    else if(kind==="title"){if(id&&!activeTT(w,Date.now()).some(x=>x.id===id))throw X("اللقب خلص");w.eq.title=id}
    else if(kind==="acc"){if(id&&!w.inv.accs.includes(id))throw X("مش معاك");w.eq.acc=id}
  },"تم ✅");
}
function doOpenBox(){
  act("box",w=>{
    if(w.boxes<=0)throw X("مفيش صناديق");
    w.boxes--;w.opened++;
    const r=rollBox(Math.random,w.pity),now=Date.now();
    w.pity=isRare(r.k)?0:w.pity+1;
    let txt;
    if(r.k==="coins"){w.coins+=r.v;txt="🪙 "+r.v+" عملة"}
    else if(r.k==="title"){addTitle(w,r.v,BOX_TITLE_DAYS,now);txt="لقب مؤقت "+TITLES[r.v].n+" (3 أيام)"}
    else if(r.k==="frame"){if(w.inv.frames.includes(r.v)){w.coins+=25;txt=FRAMES[r.v].e+" "+FRAMES[r.v].n+" (مكرر) ← 25 🪙"}else{w.inv.frames.push(r.v);txt=FRAMES[r.v].e+" "+FRAMES[r.v].n+" ✨ جديد!"}}
    else if(r.k==="acc"){if(w.inv.accs.includes(r.v)){w.coins+=25;txt=ACCS[r.v].e+" "+ACCS[r.v].n+" (مكرر) ← 25 🪙"}else{w.inv.accs.push(r.v);txt=ACCS[r.v].e+" "+ACCS[r.v].n+" ✨ جديد!"}}
    else if(r.k==="shield"){w.inv.shield++;txt="🛡️ درع ضد الاغتيال"}
    else{w.inv.x2++;txt="⚡ تذكرة عملات ×2 لليوم"}
    logW(w,"🎁 صندوق: "+txt);
    return txt;
  },t=>"🎁 طلع لك: "+t);
}
function doShield(){
  act("sh",w=>{
    const wk=wkNow();
    if(w.shW[wk])throw X("الدرع شغال الأسبوع ده");
    if(w.inv.shield<=0)throw X("معكش درع");
    w.inv.shield--;w.shW[wk]=true;logW(w,"🛡️ فعّلت الدرع للأسبوع ده");
  },"🛡️ الدرع اشتغل لحد آخر الأسبوع");
}
function doX2(){
  act("x2",w=>{
    const d=todayK();
    if(w.x2d===d)throw X("التذكرة شغالة النهارده");
    if(w.inv.x2<=0)throw X("معكش تذكرة");
    w.inv.x2--;w.x2d=d;logW(w,"⚡ فعّلت ×2 عملات النهارده");
  },"⚡ عملات المذاكرة ×2 النهارده");
  setTimeout(()=>syncAll(),400);
}
function doGender(g){
  act("g",w=>{if(!w.pet)throw X("استنى لحظة...");w.pet.g=g},"تم تغيير النوع ✅");
}

/* =====================================================================
   الواجهة
   ===================================================================== */
function injectCss(){
  if(wcss)return;wcss=true;
  const st=document.createElement("style");
  st.textContent=`
  .wf-flame{padding:4px;background:conic-gradient(#ff6a00,#ffd45a,#ff3d00,#ff6a00);box-shadow:0 0 14px rgba(255,106,0,.6)}
  .wf-ice{padding:4px;background:conic-gradient(#e8fbff,#58b7ff,#a8e6ff,#e8fbff);box-shadow:0 0 14px rgba(88,183,255,.6)}
  .wf-gold{padding:4px;background:conic-gradient(#fff1a8,#d4a017,#fff1a8,#b8860b,#fff1a8);box-shadow:0 0 14px rgba(255,212,90,.6)}
  .wf-neon{padding:4px;background:conic-gradient(#ff2bd6,#3d70ff,#2bffd9,#ff2bd6);box-shadow:0 0 16px rgba(255,43,214,.6)}
  .wf-leaf{padding:4px;background:conic-gradient(#55e6a5,#1f8a4c,#a8ff7a,#55e6a5);box-shadow:0 0 14px rgba(85,230,165,.5)}
  .wf-royal{padding:4px;background:conic-gradient(#8b3dff,#ffd45a,#8b3dff,#ffd45a);box-shadow:0 0 16px rgba(139,61,255,.65)}
  .wf-galaxy{padding:5px;background:conic-gradient(#1b0a3c,#6d28d9,#0ea5e9,#f0abfc,#1b0a3c);box-shadow:0 0 20px rgba(109,40,217,.75);animation:wfpulse 2.4s ease-in-out infinite}
  .wf-rainbow{padding:5px;background:conic-gradient(#ff5f6d,#ffc371,#fff56d,#55e6a5,#58b7ff,#b85cff,#ff5f6d);box-shadow:0 0 18px rgba(255,255,255,.35);animation:wfpulse 2.4s ease-in-out infinite}
  @keyframes wfpulse{50%{filter:brightness(1.35) saturate(1.2)}}
  .wtitle{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700;background:rgba(255,212,90,.14);border:1px solid rgba(255,212,90,.4);color:#ffd45a;white-space:nowrap}
  .wd-bal{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .wd-bal .big{font-size:34px;font-weight:900;color:var(--gold)}
  .wd-bal small{color:var(--muted)}
  #page-world{min-width:0;max-width:100%}
  .wd-tabs{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;margin:6px 0;width:0;min-width:100%;-webkit-overflow-scrolling:touch}
  .wd-tabs button{flex:none;padding:10px 14px;border-radius:13px;border:1px solid var(--line);background:#0d0b18;color:#aaa5bd;font:inherit;font-weight:700;cursor:pointer}
  .wd-tabs button.on{color:#fff;background:linear-gradient(100deg,rgba(139,61,255,.35),rgba(61,112,255,.18));border-color:rgba(184,92,255,.5)}
  .wd-stage{text-align:center;padding:10px 0 4px}
  .wd-pet{position:relative;display:inline-block;line-height:1;margin:34px 0 14px;font-size:var(--sz,80px);transition:.3s}
  .wd-pet .pe{display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
  .wd-pet.s3 .pe{filter:drop-shadow(0 0 14px rgba(139,61,255,.6))}
  .wd-pet.s4 .pe{filter:drop-shadow(0 0 18px rgba(88,183,255,.8))}
  .wd-pet.s5 .pe{filter:drop-shadow(0 0 24px rgba(255,212,90,.95));animation:wfpulse 2s ease-in-out infinite}
  .wd-pet.tired .pe{filter:grayscale(.9) brightness(.65);opacity:.8}
  .wd-pet .acc{position:absolute;left:50%;transform:translateX(-50%);font-size:.42em;line-height:1}
  .wd-pet .acc.top{top:-.34em}.wd-pet .acc.face{top:.22em;font-size:.4em}.wd-pet .acc.neck{bottom:-.08em;font-size:.4em}
  .wd-pet .aura{position:absolute;inset:-.15em;border-radius:50%;pointer-events:none}
  .wd-bar{height:11px;border-radius:9px;background:#0d0b18;border:1px solid var(--line);overflow:hidden;margin:8px auto;max-width:360px}
  .wd-bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,var(--purple),var(--gold))}
  .wd-bar.hp i{background:linear-gradient(90deg,#ff557d,#ffd45a)}
  .wd-note{background:rgba(255,213,90,.08);border:1px solid rgba(255,213,90,.25);border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.8;margin-top:10px}
  .wd-bad{background:rgba(255,85,125,.1);border:1px solid rgba(255,85,125,.35)}
  .wd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px}
  .wd-item{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:12px;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}
  .wd-item .em{font-size:34px}
  .wd-item.on{border-color:var(--gold);box-shadow:0 0 14px rgba(255,212,90,.2)}
  .wd-item small{color:var(--muted)}
  .wd-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
  .wd-row:last-child{border-bottom:0}
  .wd-row .who{display:flex;align-items:center;gap:9px;min-width:0}
  .wd-mon{font-size:96px;line-height:1;text-align:center;margin:8px 0;filter:drop-shadow(0 0 22px rgba(255,85,125,.55))}
  .wd-mon.dead{filter:grayscale(1) opacity(.45)}
  .wd-box{font-size:84px;text-align:center;margin:8px 0}
  .wd-box.has{animation:wfpulse 1.6s ease-in-out infinite}
  .wd-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
  .wd-kv{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;color:var(--muted);font-size:13px;margin:6px 0}
  .wd-kv b{color:var(--text)}
  .wd-log div{padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
  .wd-log div:last-child{border-bottom:0}
  .wd-sec{margin:14px 0 4px;font-weight:800}
  `;
  document.head.appendChild(st);
}
injectCss();

const myW=()=>ALLW[ME.id]||null;
const nameOfU=id=>{const u=DB.users()[id];return u?u.name:"؟"};
const userOf=id=>DB.users()[id]||{name:"؟"};
const avOf=(id,s)=>avatar(userOf(id),s,window.WAR_COSM.frame(id));
const PET_SIZES=[58,66,82,100,120,142];

function petHtml(w){
  const p=w.pet;
  if(!p)return`<div class="war-sub">بنجهّز حيوانك...</div>`;
  const g=p.g||genderGuess(ME.name),sp=speciesFor(ME.name,g),v=petView(p,ME,todayK());
  const st=v.stage,next=PET_STAGES[st+1],cur=PET_STAGES[st];
  const pct=next?Math.min(100,Math.round((v.xp-cur)/(next-cur)*100)):100;
  const acc=w.eq.acc&&ACCS[w.eq.acc]&&w.inv.accs.includes(w.eq.acc)?ACCS[w.eq.acc]:null;
  const emoji=st===0?"🥚":sp[1];
  let status;
  if(v.dead)status=`<div class="wd-note wd-bad">💀 حيوانك مات وبدأ من البيضة. ذاكر ساعة النهارده عشان يفقس من جديد 🐣</div>`;
  else if(v.tired)status=`<div class="wd-note wd-bad">😴 حيوانك تعبان ومبهت لأنك ما ذاكرتش ساعة إمبارح. ذاكر ساعة النهارده يرجع نشيط. (لو غبت يومين رجع مرحلة، وتلاتة بيموت)</div>`;
  else status=`<div class="war-sub">😄 حيوانك نشيط! ${p.miss?"":"كمّل كده."}</div>`;
  const sev=p.deaths?`<div class="war-sub">🪦 مات ${p.deaths} ${p.deaths===1?"مرة":"مرات"} قبل كده</div>`:"";
  return `<div class="wd-stage">
    <div class="wd-pet s${st} ${v.tired?"tired":""}" style="--sz:${PET_SIZES[st]}px">${acc?`<span class="acc ${acc.pos}">${acc.e}</span>`:""}<span class="pe">${emoji}</span></div>
    <h2 style="margin:0">${st===0?"بيضة "+sp[0]:sp[0]} • ${STAGE_NAMES[st]}</h2>
    <div class="war-sub">مرحلة ${st+1} من 6 • نمو ${h1(v.xp)} ساعة${next?" / "+next:""}</div>
    <div class="wd-bar"><i style="width:${pct}%"></i></div>
    ${status}${sev}
  </div>
  <div class="wd-actions"><button class="btn small ${g==="m"?"primary":""}" data-a="gender" data-g="m">🦁 مفترس (شاب)</button><button class="btn small ${g==="f"?"primary":""}" data-a="gender" data-g="f">🐱 كيوت (بنت)</button></div>
  <div class="war-sub" style="text-align:center;margin-top:6px">اخترنا حيوانك حسب اسمك "${escapeHtml(ME.name)}". لو التخمين غلط غيّره من فوق.</div>
  <div class="wd-sec">🎩 الإكسسوارات</div>
  <div class="wd-actions" style="justify-content:flex-start">${w.inv.accs.length?w.inv.accs.map(a=>`<button class="btn small ${w.eq.acc===a?"primary":""}" data-a="equip" data-k="acc" data-i="${a}">${ACCS[a].e} ${ACCS[a].n}</button>`).join("")+(w.eq.acc?`<button class="btn small" data-a="equip" data-k="acc" data-i="">إزالة</button>`:""):'<span class="war-sub">اشتري إكسسوار من المتجر أو اكسبه من الصناديق</span>'}</div>
  <div class="war-note wd-note">📈 كل ساعة مذاكرة = نقطة نمو. غياب = أقل من ساعة في اليوم: يوم = تعب، يومين = يرجع مرحلة، 3 أيام = يموت ويبدأ من البيضة.</div>`;
}
function monsterHtml(){
  const doc=WK.cur,users=DB.users(),today=todayK();
  if(!doc||!doc.monster)return`<div class="war-sub">بنجهّز وحش الأسبوع...</div>`;
  const st=monsterStatus(doc,users,today),hp=doc.monster.hp,left=Math.max(0,hp-st.total),pct=Math.min(100,Math.round(st.total/hp*100));
  const daysLeft=Math.max(0,daysBetween(today,addDays(doc.wk,6))+1);
  const rows=Object.keys(st.per).filter(id=>st.per[id]>0).sort((a,b)=>st.per[b]-st.per[a]).slice(0,10)
    .map(id=>`<div class="wd-row"><div class="who">${avOf(id,34)}<b>${escapeHtml(nameOfU(id))}${id===ME.id?" (أنت)":""}</b></div><span class="war-sub" style="margin:0">⚔️ ${h1(st.per[id])} ساعة</span></div>`).join("");
  const w=myW(),claimed=w&&w.claimed["mon_"+doc.wk],mine=st.per[ME.id]||0;
  return `<div class="wd-mon ${st.dead?"dead":""}">${doc.monster.e}</div>
  <h2 style="text-align:center;margin:0">${escapeHtml(doc.monster.n)}</h2>
  <div class="wd-bar hp"><i style="width:${100-pct}%"></i></div>
  <div class="wd-kv"><span>❤️ الصحة: <b>${h1(left)}</b> / ${hp} ساعة</span><span>⏳ فاضل <b>${daysLeft}</b> ${daysLeft===1?"يوم":"أيام"} (لحد الجمعة)</span></div>
  ${st.dead?`<div class="wd-note">🎉 الوحش وقع! كل واحد ذاكر ${MONSTER_MIN_H} ساعات على الأقل ياخد غنيمته (${claimed?"استلمتها ✅":mine>=MONSTER_MIN_H?"هتتضاف تلقائي":"ذاكر "+h1(MONSTER_MIN_H-mine)+" ساعة كمان"}).</div>`:`<div class="wd-note">كل ساعة مذاكرة من أي حد في الشلة = ضربة. لو الشلة خلّصته قبل نهاية الجمعة، كل مشارك (${MONSTER_MIN_H} ساعات على الأقل) ياخد <b>40–120 🪙 + صندوق</b>، والأكتر ضربًا ياخد لقب 🗡️ قاتل الوحش + صندوق.</div>`}
  <div class="wd-sec">🗡️ ضربات الأسبوع</div>${rows||'<div class="war-sub">لسه محدش ضرب</div>'}`;
}
function boxesHtml(w){
  return `<div class="wd-box ${w.boxes>0?"has":""}">🎁</div>
  <div class="wd-kv"><span>صناديقك: <b>${w.boxes}</b></span><span>اتفتح: <b>${w.opened}</b></span><span>ضمان نادر: <b>${Math.max(0,10-w.pity)}</b> صناديق</span></div>
  <div class="wd-actions"><button class="btn primary" data-a="open" ${w.boxes>0?"":"disabled"}>🎁 افتح صندوق</button>${w.inv.x2?`<button class="btn" data-a="x2">⚡ فعّل ×2 (${w.inv.x2})</button>`:""}</div>
  <div class="wd-note">كل <b>ساعتين</b> مذاكرة في اليوم = صندوق (لحد 3 في اليوم). جواه: عملات، لقب مؤقت، إطار، إكسسوار حيوان، درع ضد الاغتيال، أو تذكرة ×2 عملات. وكل 10 صناديق لازم تيجي حاجة نادرة 💎.</div>`;
}
function assassinHtml(w){
  const doc=WK.cur,users=DB.users(),today=todayK(),wk=wkNow(),shielded=!!w.shW[wk];
  let h="";
  if(!doc||!doc.assign)h=`<div class="war-sub">بنجهّز اللعبة...</div>`;
  else{
    const target=doc.assign[ME.id];
    if(!target)h=`<div class="wd-note">🥷 اللعبة محتاجة <b>3 لاعبين نشيطين</b> على الأقل (أو إنك تبقى نشيط الأسبوعين اللي فاتوا). ذاكر وهتدخل الأسبوع الجاي.</div>`;
    else{
      const hm=weekHours(ME,wk),ht=users[target]?weekHours(users[target],wk):0;
      h=`<div class="wd-stage"><div style="font-size:64px">🎯</div><h2 style="margin:0">هدفك السري</h2>
      <div style="display:flex;justify-content:center;margin:12px 0">${avOf(target,84)}</div><h2 style="margin:0">${escapeHtml(nameOfU(target))}</h2>
      <div class="wd-kv"><span>ساعاتك: <b>${h1(hm)}</b></span><span>ساعاته: <b>${h1(ht)}</b></span></div>
      <div class="war-sub">${hm>ht?(hm>=ASSASSIN_MIN_H?"✅ أنت متقدم عليه دلوقتي":"متقدم عليه، بس محتاج "+ASSASSIN_MIN_H+" ساعات على الأقل"):"⚠️ هو متقدم عليك. ذاكر أكتر!"}</div></div>
      <div class="wd-note">لو ساعاتك آخر الجمعة أكتر من هدفك (و${ASSASSIN_MIN_H} ساعات على الأقل) = اغتيال ناجح <b>+${KILL_REWARD} 🪙</b>. وحد تاني بيطاردك أنت كمان وإنت متعرفوش 😈. لو نجوت منه ياخد منك ${SURVIVE_REWARD} 🪙 مكافأة نجاة.</div>`;
    }
    h+=`<div class="wd-actions">${shielded?`<span class="war-sub">🛡️ الدرع شغال الأسبوع ده</span>`:w.inv.shield?`<button class="btn" data-a="shield">🛡️ فعّل الدرع (${w.inv.shield})</button>`:`<span class="war-sub">معكش درع. اشتريه من المتجر (${PRICE_SHIELD} 🪙).</span>`}</div>`;
    const pv=WK.prev;
    if(pv&&pv.assign&&today>addDays(pv.wk,6)){
      const rows=Object.keys(pv.assign).map(hu=>{
        const t=pv.assign[hu],uh=users[hu],ut=users[t];if(!uh||!ut)return"";
        const a=weekHours(uh,pv.wk),b=weekHours(ut,pv.wk),sh=ALLW[t]&&ALLW[t].shW&&ALLW[t].shW[pv.wk];
        const ok=!sh&&a>b&&a>=ASSASSIN_MIN_H;
        return `<div class="wd-row"><span>${ok?"🥷":"🛡️"} <b>${escapeHtml(uh.name)}</b> ← ${escapeHtml(ut.name)}</span><span class="war-sub" style="margin:0">${ok?"💀 اتغتل":sh?"🛡️ درع":"نجا"} (${h1(a)} / ${h1(b)})</span></div>`;
      }).join("");
      h+=`<div class="wd-sec">🎭 كشف الأسبوع اللي فات</div>${rows}`;
    }
  }
  return h;
}
function shopHtml(w){
  const now=Date.now(),tt=activeTT(w,now);
  const card=(em,name,sub,btn,on)=>`<div class="wd-item ${on?"on":""}"><div class="em">${em}</div><b>${name}</b><small>${sub}</small>${btn}</div>`;
  let h=`<div class="wd-sec">🖼️ إطارات الصورة <small class="war-sub">(بتظهر في صفحة الأصدقاء)</small></div><div class="wd-grid">`;
  Object.keys(FRAMES).forEach(id=>{
    const f=FRAMES[id],own=w.inv.frames.includes(id),eq=w.eq.frame===id;
    const prev=`<div style="display:flex;justify-content:center">${avatar(ME,56,"wf-"+id)}</div>`;
    h+=card(prev,f.n,own?(eq?"مجهّز ✅":"عندك"):(f.box?"من الصناديق بس 🎁":f.p+" 🪙"),
      own?`<button class="btn small ${eq?"":"primary"}" data-a="equip" data-k="frame" data-i="${eq?"":id}">${eq?"إزالة":"جهّز"}</button>`:f.box?"":`<button class="btn small primary" data-a="buy" data-k="frame" data-i="${id}">اشتري</button>`,eq);
  });
  h+=`</div><div class="wd-sec">🏷️ ألقاب (جنب الاسم في الأصدقاء)</div><div class="wd-grid">`;
  Object.keys(TITLES).filter(id=>TITLES[id].p).forEach(id=>{
    const t=TITLES[id],act_=tt.find(x=>x.id===id),eq=w.eq.title===id;
    h+=card(`<span class="wtitle" style="margin:0">${t.n}</span>`,"",act_?`باقي ${Math.max(1,Math.ceil((act_.until-now)/DAY))} يوم`:t.p+" 🪙 / "+SHOP_TITLE_DAYS+" أيام",
      act_?`<button class="btn small ${eq?"":"primary"}" data-a="equip" data-k="title" data-i="${eq?"":id}">${eq?"إزالة":"جهّز"}</button>`:`<button class="btn small primary" data-a="buy" data-k="title" data-i="${id}">اشتري</button>`,eq);
  });
  tt.filter(x=>TITLES[x.id]&&!TITLES[x.id].p).forEach(x=>{
    const eq=w.eq.title===x.id;
    h+=card(`<span class="wtitle" style="margin:0">${TITLES[x.id].n}</span>`,"",`باقي ${Math.max(1,Math.ceil((x.until-now)/DAY))} يوم`,`<button class="btn small ${eq?"":"primary"}" data-a="equip" data-k="title" data-i="${eq?"":x.id}">${eq?"إزالة":"جهّز"}</button>`,eq);
  });
  h+=`</div><div class="wd-sec">🎩 إكسسوارات الحيوان</div><div class="wd-grid">`;
  Object.keys(ACCS).forEach(id=>{
    const a=ACCS[id],own=w.inv.accs.includes(id);
    h+=card(a.e,a.n,own?"عندك ✅":a.p+" 🪙",own?"":`<button class="btn small primary" data-a="buy" data-k="acc" data-i="${id}">اشتري</button>`,w.eq.acc===id);
  });
  h+=`</div><div class="wd-sec">🎁 حاجات تانية</div><div class="wd-grid">`;
  h+=card("🎁","صندوق إضافي",PRICE_BOX+" 🪙",`<button class="btn small primary" data-a="buy" data-k="box" data-i="1">اشتري</button>`);
  h+=card("🛡️","درع ضد الاغتيال",PRICE_SHIELD+" 🪙 (معاك "+w.inv.shield+")",`<button class="btn small primary" data-a="buy" data-k="shield" data-i="1">اشتري</button>`);
  return h+"</div>";
}

function todayEarn(w){return w.inc[todayK()]||0}
function renderWorld(){
  const root=$("page-world");if(!root||!ME)return;
  if(!started)startWorld();
  const w=myW();
  if(!w){root.innerHTML=`<div class="hero"><h1>🐾 عالمي</h1><p>جاري التحميل... (لو دي أول مرة، تأكد إنك نشرت قواعد Firestore الجديدة)</p></div>`;if(!syncing)syncAll();return}
  const tabs=[["pet","🐾 حيواني"],["monster","🐉 الوحش"],["boxes","🎁 الصناديق"+(w.boxes?" ("+w.boxes+")":"")],["assassin","🥷 القاتل"],["shop","🛒 المتجر"]];
  const body=tab==="pet"?petHtml(w):tab==="monster"?monsterHtml():tab==="boxes"?boxesHtml(w):tab==="assassin"?assassinHtml(w):shopHtml(w);
  const ttl=window.WAR_COSM.title(ME.id);
  root.innerHTML=`
  <div class="card wd-bal"><div><h1 style="margin:0">🐾 عالمي</h1><small>${avOf(ME.id,28)} ${escapeHtml(ME.name)} ${ttl}</small></div>
    <div style="text-align:center"><div class="big">🪙 ${w.coins}</div><small>النهارده: +${todayEarn(w)} من المذاكرة</small></div></div>
  <div class="wd-tabs">${tabs.map(([k,l])=>`<button data-wt="${k}" class="${tab===k?"on":""}">${l}</button>`).join("")}</div>
  <div class="card" id="wdBody">${body}</div>
  <div class="card"><details><summary style="cursor:pointer;font-weight:700">💰 إزاي أكسب عملات؟</summary><ul style="line-height:2;color:var(--muted);margin:10px 0 0;padding-inline-start:20px">
    <li>المذاكرة: <b>${COIN_PER_HOUR} 🪙</b> لكل ساعة (لحد ${DAILY_CAP} في اليوم).</li>
    <li>الاستمرارية: ذاكر ساعة كل يوم = <b>+${STREAK_STEP}</b> وبتزيد كل يوم متتالي (لحد +${STREAK_MAX}).</li>
    <li>مناطق حرب المناطق، قتل الوحش، الاغتيال، فوز المبارزات، والصناديق.</li>
    <li>خسرت مبارزة؟ بتدفع ${COMP_PAY} 🪙 للفايز. لو كسبته المبارزة اللي بعدها (خلال ${COMP_DAYS} أيام) بتاخد <b>${COMP_REMATCH} 🪙</b>.</li></ul></details></div>
  <div class="card wd-log"><div class="section-head"><h2>📜 آخر الأحداث</h2></div>${w.log.slice(0,12).map(l=>`<div>${escapeHtml(l.x)}</div>`).join("")||'<div class="war-sub">لسه مفيش أحداث</div>'}</div>`;
  root.querySelectorAll("[data-wt]").forEach(b=>b.onclick=()=>{tab=b.dataset.wt;renderWorld()});
  root.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.a;
    if(a==="open")doOpenBox();
    else if(a==="buy")doBuy(b.dataset.k,b.dataset.i);
    else if(a==="equip")doEquip(b.dataset.k,b.dataset.i);
    else if(a==="shield")doShield();
    else if(a==="x2")doX2();
    else if(a==="gender")doGender(b.dataset.g);
  });
}
PAGES.world=renderWorld;
setInterval(()=>{
  if(!ME||curPage!=="world")return;
  const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
  renderWorld();
},20000);
})();
