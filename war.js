/* =====================================================================
   🗺️ حرب المناطق — لعبة إضافية بين الأصحاب
   - مبتكتبش في بيانات حد: القوة بتتحسب من دقايق المذاكرة الموجودة أصلًا (state.daily)
   - كل بيانات اللعبة في collection جديدة اسمها war (مستند واحد لكل شهر)
   ===================================================================== */
(function(){
"use strict";
if(typeof WAR_MAPS==="undefined"||typeof PAGES==="undefined")return;

/* ---------- قواعد اللعبة ---------- */
const SOLDIERS_PER_30=100;      // كل 30 دقيقة = 100 جندي
const TANK_MINUTES=360;         // 6 ساعات في اليوم = دبابة (واحدة كحد أقصى يوميًا)
const TANK_POWER=1000;          // قوة الدبابة
const HOME_BONUS=1.2;           // أفضلية المدافع عن منطقة مملوكة
const START_GARRISON=300;       // جنود منطقة البداية
const VOTE_DAYS=3;              // التصويت في آخر 3 أيام من الشهر
const EPOCH=2026*12+11;         // نوفمبر 2026 = مصر (بعدها بالترتيب)

/* ---------- حالة الصفحة ---------- */
let unsub=null,unsubKey=null,DATA=null,DATA_ERR=null,sel=null,joining=false,resolving=false;
let form={s:"",k:0},PAST=null,pastLoading=false,wiredCss=false,starting=false,howOpen=false;

/* ---------- مساعدات ---------- */
const wid=mk=>"war_"+mk;
const monthIdx=mk=>{const [y,m]=mk.split("-").map(Number);return y*12+m};
const cycleMap=mk=>WAR_MAP_ORDER[(((monthIdx(mk)-EPOCH)%4)+4)%4];
const daysBetween=(a,b)=>Math.max(0,Math.round((pd(b)-pd(a))/86400000));
const ref=mk=>fs.collection("war").doc(wid(mk));
const _adj={};
function adjOf(mapId){
  if(_adj[mapId])return _adj[mapId];
  const M=WAR_MAPS[mapId],adj={},at={};
  M.regions.forEach(r=>{adj[r.id]=new Set();at[r.x+","+r.y]=r.id});
  M.regions.forEach(r=>[[1,0],[0,1]].forEach(([dx,dy])=>{const o=at[(r.x+dx)+","+(r.y+dy)];if(o){adj[r.id].add(o);adj[o].add(r.id)}}));
  M.links.forEach(([a,b])=>{adj[a].add(b);adj[b].add(a)});
  return _adj[mapId]=adj;
}
const regOf=(mapId,id)=>WAR_MAPS[mapId].regions.find(r=>r.id===id);
const baseGarrison=r=>r.cap?500:150*r.v;
const strength=t=>t.s+TANK_POWER*t.k;
function nameOf(uid,d){
  const u=(typeof DB!=="undefined"&&DB.users()[uid]);
  return (u&&u.name)||(d&&d.players&&d.players[uid]&&d.players[uid].name)||"؟";
}
const colorOf=uid=>`hsl(${hueOf(uid)} 62% 42%)`;

/* ---------- القوة اللي كسبتها من المذاكرة (قراءة بس) ---------- */
function earned(user,mk){
  const daily=(user&&user.state&&user.state.daily)||{},today=todayK();
  let s=0,k=0;
  monthDates(mk).forEach(d=>{
    if(d>today)return;
    const m=daily[d]||0;
    s+=Math.floor(m/30)*SOLDIERS_PER_30;
    if(m>=TANK_MINUTES)k++;
  });
  return{s,k};
}
function available(d){
  const e=earned(ME,d.month),P=d.players[ME.id]||{ss:0,sk:0};
  return{s:Math.max(0,e.s-(P.ss||0)),k:Math.max(0,e.k-(P.sk||0)),earnedS:e.s,earnedK:e.k};
}

/* ---------- اختيار خريطة الشهر (تصويت الشهر اللي فات، أو الترتيب) ---------- */
function pickNextMap(mk,prev){
  const cur=prev&&prev.map;
  if(prev&&prev.votes){
    const cnt={};
    Object.values(prev.votes).forEach(v=>{if(WAR_MAPS[v]&&v!==cur)cnt[v]=(cnt[v]||0)+1});
    const mx=Math.max(0,...Object.values(cnt));
    if(mx>0){
      const top=Object.keys(cnt).filter(k=>cnt[k]===mx).sort();
      return top[Math.floor(rnd("war"+mk)*top.length)%top.length];
    }
  }
  return cycleMap(mk);
}

/* ---------- حسم اليوم (دالة نقية: بتعدّل نسخة البيانات وترجع true لو اتغير حاجة) ---------- */
function resolveCore(d,today){
  if(!d||!d.map||d.lastResolved>=today)return false;
  const M=WAR_MAPS[d.map],reg={};M.regions.forEach(r=>reg[r.id]=r);
  const nm=u=>(d.players&&d.players[u]&&d.players[u].name)||"؟";
  const ords=Object.entries(d.orders||{}).map(([id,o])=>Object.assign({id},o))
    .filter(o=>o.d<today).sort((a,b)=>(a.t-b.t)||(a.id<b.id?-1:1));
  const lines=[];
  ords.forEach(o=>{
    const T=d.tiles[o.to],r=reg[o.to];
    delete d.orders[o.id];
    if(!T||!r)return;
    const A=o.s+TANK_POWER*o.k;
    if(T.o===o.u){T.s+=o.s;T.k+=o.k;return}            // المنطقة بقت بتاعته قبل كده: تعزيز
    const G=strength(T),D=T.o?G*HOME_BONUS:G,prev=T.o;
    if(A>D){
      const R=A-D,k2=Math.min(o.k,Math.floor(R/TANK_POWER));
      d.tiles[o.to]={o:o.u,s:Math.max(0,Math.round(R-k2*TANK_POWER)),k:k2};
      lines.push("⚔️ "+nm(o.u)+" احتل "+r.n+(prev?" من "+nm(prev):""));
    }else{
      const left=D-A,nG=Math.max(1,Math.round(G*(left/D))),k2=Math.min(T.k,Math.floor(nG/TANK_POWER));
      d.tiles[o.to]={o:prev,s:nG-k2*TANK_POWER,k:k2};
      lines.push("🛡️ "+r.n+" صدّت هجوم "+nm(o.u)+(prev?" ("+nm(prev)+")":""));
    }
  });
  // عملات اليوم: قيمة كل منطقة تملكها (بحد أقصى 3 أيام لو الموقع ما اتفتحش)
  const days=Math.min(3,Math.max(1,daysBetween(d.lastResolved,today)));
  M.regions.forEach(r=>{const o=d.tiles[r.id]&&d.tiles[r.id].o;if(o&&d.players[o])d.players[o].coins=(d.players[o].coins||0)+r.v*days});
  const now=Date.now();
  d.log=lines.reverse().map((x,i)=>({t:now+i,x})).concat(d.log||[]).slice(0,40);
  d.lastResolved=today;
  return true;
}
window.__WAR_CORE__={resolveCore,pickNextMap,cycleMap,earned,adjOf};

/* ---------- عمليات السيرفر (كلها Transactions) ---------- */
function newMonthDoc(mk,mapId){
  const tiles={};
  WAR_MAPS[mapId].regions.forEach(r=>tiles[r.id]={o:null,s:baseGarrison(r),k:0});
  return{month:mk,map:mapId,created:Date.now(),lastResolved:todayK(),tiles,players:{},orders:{},log:[],votes:{}};
}
async function ensureMonth(mk){
  await fs.runTransaction(async tx=>{
    const s=await tx.get(ref(mk));
    if(s.exists)return;
    const p=await tx.get(ref(prevMonth(mk)));
    tx.set(ref(mk),newMonthDoc(mk,pickNextMap(mk,p.exists?p.data():null)));
  });
}
async function mutate(fn){
  const mk=unsubKey;
  return fs.runTransaction(async tx=>{
    const s=await tx.get(ref(mk));
    if(!s.exists)throw new Error("no-doc");
    const d=s.data();
    d.players=d.players||{};d.orders=d.orders||{};d.log=d.log||[];d.tiles=d.tiles||{};
    const res=fn(d);
    tx.update(ref(mk),{tiles:d.tiles,players:d.players,orders:d.orders,log:d.log,lastResolved:d.lastResolved});
    return res;
  });
}
function addLog(d,x){d.log.unshift({t:Date.now(),x});d.log=d.log.slice(0,40)}

async function joinWar(){
  if(joining)return;joining=true;
  try{
    await mutate(d=>{
      if(d.players[ME.id])return;
      d.players[ME.id]={ss:0,sk:0,coins:0,name:ME.name};
      let free=WAR_MAPS[d.map].regions.filter(r=>!d.tiles[r.id].o&&!r.cap);
      if(!free.length)free=WAR_MAPS[d.map].regions.filter(r=>!d.tiles[r.id].o);
      if(free.length){
        const r=free[Math.floor(Math.random()*free.length)];
        d.tiles[r.id]={o:ME.id,s:START_GARRISON,k:0};
        addLog(d,"🚩 "+ME.name+" دخل الحرب من "+r.n);
      }
    });
  }catch(e){warnErr(e)}
  joining=false;
}
async function resolveDay(){
  if(resolving)return;resolving=true;
  try{
    const today=todayK();
    await mutate(d=>{resolveCore(d,today)});
  }catch(e){warnErr(e)}
  resolving=false;
}
function warnErr(e){
  console.warn("war:",e);
  if(e&&e.code==="permission-denied")toast("⚠️ لازم تنشر قواعد Firestore الجديدة (ملف firestore.rules)");
}

function myTiles(d){return Object.keys(d.tiles).filter(id=>d.tiles[id].o===ME.id)}
function canAttack(d,id){
  const T=d.tiles[id];if(!T||T.o===ME.id)return false;
  const mine=myTiles(d);if(!mine.length)return true;
  const adj=adjOf(d.map)[id];
  return mine.some(m=>adj.has(m));
}
function readForm(av){
  const s=Math.max(0,Math.floor(+form.s||0)),k=Math.max(0,Math.floor(+form.k||0));
  return{s:Math.min(s,av.s),k:Math.min(k,av.k)};
}
async function doReinforce(){
  const id=sel;if(!DATA||!id)return;
  try{
    const r=await mutate(d=>{
      if(d.tiles[id].o!==ME.id)throw new Error("not-mine");
      const e=earned(ME,d.month),P=d.players[ME.id];
      const s=Math.min(Math.max(0,Math.floor(+form.s||0)),e.s-P.ss),k=Math.min(Math.max(0,Math.floor(+form.k||0)),e.k-P.sk);
      if(s+k<=0)throw new Error("empty");
      d.tiles[id].s+=s;d.tiles[id].k+=k;P.ss+=s;P.sk+=k;
      return{s,k};
    });
    form={s:"",k:0};toast("🛡️ تم التعزيز: "+r.s+" جندي"+(r.k?" و"+r.k+" دبابة":""));
  }catch(e){toast(e.message==="empty"?"مفيش قوة كفاية للإرسال":"تعذر التعزيز، جرّب تاني");warnErr(e)}
  renderWar();
}
async function doAttack(){
  const id=sel;if(!DATA||!id)return;
  try{
    const r=await mutate(d=>{
      if(!canAttack(d,id))throw new Error("far");
      const e=earned(ME,d.month),P=d.players[ME.id];
      const s=Math.min(Math.max(0,Math.floor(+form.s||0)),e.s-P.ss),k=Math.min(Math.max(0,Math.floor(+form.k||0)),e.k-P.sk);
      if(s+k<=0)throw new Error("empty");
      P.ss+=s;P.sk+=k;
      d.orders[uid()]={u:ME.id,to:id,s,k,d:todayK(),t:Date.now()};
      return{s,k};
    });
    form={s:"",k:0};toast("⚔️ أمر الهجوم اتسجل ("+r.s+" جندي"+(r.k?" + "+r.k+" دبابة":"")+") — بيتحسم بعد منتصف الليل");
  }catch(e){toast(e.message==="empty"?"مفيش قوة كفاية للإرسال":e.message==="far"?"المنطقة دي مش مجاورة لمناطقك":"تعذر إرسال الهجوم، جرّب تاني");warnErr(e)}
  renderWar();
}
async function cancelOrder(id){
  try{
    await mutate(d=>{
      const o=d.orders[id];if(!o||o.u!==ME.id)return;
      const P=d.players[ME.id];P.ss=Math.max(0,P.ss-o.s);P.sk=Math.max(0,P.sk-o.k);
      delete d.orders[id];
    });
    toast("اتلغى الأمر ورجعت القوة لرصيدك");
  }catch(e){warnErr(e)}
  renderWar();
}
async function doVote(mapId){
  try{
    await ref(unsubKey).update({["votes."+ME.id]:mapId});
    toast("🗳️ صوتك اتسجل: "+WAR_MAPS[mapId].name);
  }catch(e){warnErr(e);toast("تعذر التصويت")}
}

/* ---------- الاشتراك في بيانات الشهر ---------- */
function stopWar(){
  if(unsub){try{unsub()}catch(e){}}
  unsub=null;unsubKey=null;DATA=null;DATA_ERR=null;sel=null;PAST=null;
}
async function startWar(){
  if(!fs||!ME||starting)return;
  const mk=curMonth();
  if(unsub&&unsubKey===mk)return;
  starting=true;
  stopWar();unsubKey=mk;
  try{await ensureMonth(mk)}catch(e){DATA_ERR=e;warnErr(e)}
  starting=false;
  if(unsubKey!==mk)return;
  unsub=ref(mk).onSnapshot(snap=>{
    DATA=snap.exists?snap.data():null;DATA_ERR=null;
    if(DATA){DATA.players=DATA.players||{};DATA.orders=DATA.orders||{};DATA.log=DATA.log||[];DATA.votes=DATA.votes||{}}
    if(DATA&&!DATA.players[ME.id])joinWar();
    else if(DATA&&DATA.lastResolved<todayK())resolveDay();
    if(curPage==="war")renderWar();
  },err=>{DATA_ERR=err;warnErr(err);if(curPage==="war")renderWar()});
  renderWar();
}
async function loadPast(){
  if(PAST||pastLoading||!fs)return;
  pastLoading=true;PAST=[];
  let mk=curMonth();
  const jobs=[];
  for(let i=0;i<6;i++){mk=prevMonth(mk);jobs.push(ref(mk).get().then(s=>s.exists?s.data():null).catch(()=>null))}
  const docs=await Promise.all(jobs);
  PAST=docs.filter(Boolean).map(d=>{
    const cnt={};Object.keys(d.tiles||{}).forEach(id=>{const o=d.tiles[id].o;if(o)cnt[o]=(cnt[o]||0)+1});
    const rank=Object.keys(cnt).sort((a,b)=>(cnt[b]-cnt[a])||(((d.players[b]||{}).coins||0)-((d.players[a]||{}).coins||0)));
    return rank.length?{month:d.month,map:d.map,uid:rank[0],n:cnt[rank[0]],name:(d.players[rank[0]]||{}).name||"؟"}:null;
  }).filter(Boolean);
  pastLoading=false;
  if(curPage==="war")renderWar();
}

/* ---------- الرسم ---------- */
function injectCss(){
  if(wiredCss)return;wiredCss=true;
  const st=document.createElement("style");
  st.textContent=`
  .war-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
  .war-head h1{margin:0;font-size:24px}
  .war-sub{color:var(--muted);font-size:13px;margin-top:3px}
  .war-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
  .war-res .box{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:12px;text-align:center}
  .war-res .box b{display:block;font-size:24px;margin-top:3px}
  .war-res .box small{color:var(--muted);font-size:12px}
  .war-bar{height:9px;border-radius:9px;background:#0d0b18;border:1px solid var(--line);overflow:hidden;margin-top:8px}
  .war-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--purple),var(--gold));border-radius:9px}
  .war-map{width:100%;max-width:560px;margin:0 auto;display:block;touch-action:manipulation}
  .war-map .t{cursor:pointer}
  .war-map .t .ti{transition:filter .15s}
  .war-map .t:hover .ti{filter:brightness(1.25)}
  .war-cd{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 10px;padding:8px 16px;width:fit-content;border-radius:999px;background:rgba(255,213,90,.1);border:1px solid rgba(255,213,90,.35);font-size:13px;color:var(--muted)}
  .war-cd b{color:var(--gold);font-size:18px;letter-spacing:1px;font-variant-numeric:tabular-nums}
  .war-map text{font-family:Cairo,system-ui,sans-serif;pointer-events:none}
  .war-legend{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;margin-top:12px;font-size:12px;color:var(--muted)}
  .war-legend span{display:inline-flex;align-items:center;gap:5px}
  .war-legend i{width:12px;height:12px;border-radius:4px;display:inline-block}
  .war-panel h3{margin:0 0 4px}
  .war-kv{display:flex;flex-wrap:wrap;gap:8px 16px;color:var(--muted);font-size:13px;margin:8px 0}
  .war-kv b{color:var(--text)}
  .war-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
  .war-form label{font-size:12px;color:var(--muted);display:block;margin-bottom:4px}
  .war-form input{width:100%;background:#0d0b18;border:1px solid var(--line);color:#fff;padding:10px;border-radius:11px;font:inherit}
  .war-actions{display:flex;gap:8px;flex-wrap:wrap}
  .war-note{background:rgba(255,213,90,.08);border:1px solid rgba(255,213,90,.25);border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.7;margin-top:10px}
  .war-err{background:rgba(255,85,125,.1);border:1px solid rgba(255,85,125,.35);border-radius:14px;padding:13px;line-height:1.8}
  .war-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
  .war-row:last-child{border-bottom:0}
  .war-row .who{display:flex;align-items:center;gap:9px;min-width:0}
  .war-dot{width:12px;height:12px;border-radius:50%;flex:none}
  .war-vote{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:10px}
  .war-vote button{padding:12px;border-radius:14px;border:1px solid var(--line);background:#0d0b18;color:#fff;font:inherit;cursor:pointer}
  .war-vote button.on{border-color:var(--gold);background:rgba(255,213,90,.12)}
  .war-log div{padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
  .war-log div:last-child{border-bottom:0}
  .war-how summary{cursor:pointer;font-weight:700}
  .war-how ul{margin:10px 0 0;padding-inline-start:20px;line-height:2;color:var(--muted)}
  `;
  document.head.appendChild(st);
}

function tileLines(n,lim){
  const w=n.split(" "),out=[];let cur="";
  w.forEach(x=>{if(cur&&(cur+" "+x).length>lim){out.push(cur);cur=x}else cur=cur?cur+" "+x:x});
  if(cur)out.push(cur);
  return out.slice(0,3);
}
/* ---------- خريطة أقرب للواقع + مجسّمات 3D ---------- */
const hash3=(a,b,c)=>{const x=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return x-Math.floor(x)};
const seedOf=t=>{let h=7;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))%9973;return h};
function hexHsl(h,sat,l){
  sat/=100;l/=100;const k=n=>(n+h/30)%12,a=sat*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  const x=v=>Math.round(255*v).toString(16).padStart(2,"0");return"#"+x(f(0))+x(f(8))+x(f(4));
}
const unitHex=uid=>uid?hexHsl(hueOf(uid),72,52):"#9aa3b2";
const TERR={1:"#8a7f58",2:"#6f7d4c",3:"#55804f",4:"#3f8a5f"};
const _geo={};
// حدود المناطق: شبكة نقاطها مهزوزة بثبات + حواف متعرجة (الحافة المشتركة بين منطقتين نفس الشكل بالظبط)
function geoOf(mapId,TW,TH,PAD){
  const key=mapId+"|"+TW.toFixed(1)+"|"+TH;if(_geo[key])return _geo[key];
  const M=WAR_MAPS[mapId],sd=seedOf(mapId),ax=TW*.17,ay=TH*.12,cor={},edge={};
  const C=(i,j)=>{const k=i+","+j;return cor[k]||(cor[k]=[PAD+i*TW+(hash3(i,j,sd)-.5)*2*ax,PAD+j*TH+(hash3(i,j,sd+1)-.5)*2*ay])};
  const edgeP=(i1,j1,i2,j2)=>{
    const fw=i1<i2||(i1===i2&&j1<j2),ai=fw?i1:i2,aj=fw?j1:j2,bi=fw?i2:i1,bj=fw?j2:j1,k=ai+","+aj+">"+bi+","+bj;
    let p=edge[k];
    if(!p){
      const A=C(ai,aj),B=C(bi,bj),dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
      const o1=(hash3(ai*7+bi,aj*5+bj,sd+2)-.5)*L*.26,o2=(hash3(ai*3+bi,aj*11+bj,sd+3)-.5)*L*.26;
      p=edge[k]=[A,[A[0]+dx*.34+nx*o1,A[1]+dy*.34+ny*o1],[A[0]+dx*.68+nx*o2,A[1]+dy*.68+ny*o2],B];
    }
    return fw?p:p.slice().reverse();
  };
  const tiles={};
  M.regions.forEach(r=>{
    const i=r.x,j=r.y;
    const pts=[].concat(edgeP(i,j,i+1,j).slice(0,-1),edgeP(i+1,j,i+1,j+1).slice(0,-1),edgeP(i+1,j+1,i,j+1).slice(0,-1),edgeP(i,j+1,i,j).slice(0,-1));
    const c0=C(i,j),c1=C(i+1,j),c2=C(i+1,j+1),c3=C(i,j+1);
    tiles[r.id]={d:"M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")+"Z",cx:(c0[0]+c1[0]+c2[0]+c3[0])/4,top:(c0[1]+c1[1])/2,bot:(c2[1]+c3[1])/2};
  });
  return _geo[key]={tiles};
}
// منطقة الانطلاق: أقرب منطقة مجاورة للهدف بتاعة المهاجم، وإلا أقرب منطقة ليه
function srcOf(d,o,adj,G){
  const T=G.tiles[o.to];if(!T)return null;
  const mineT=id=>id!==o.to&&d.tiles[id]&&d.tiles[id].o===o.u&&G.tiles[id];
  const dist=id=>{const a=G.tiles[id];return Math.hypot(a.cx-T.cx,(a.top+a.bot)/2-(T.top+T.bot)/2)};
  let best=null,bd=1e9;
  [...(adj[o.to]||[])].filter(mineT).forEach(id=>{const k=dist(id);if(k<bd){bd=k;best=id}});
  if(best)return best;
  WAR_MAPS[d.map].regions.forEach(r=>{if(mineT(r.id)){const k=dist(r.id);if(k<bd){bd=k;best=r.id}}});
  return best;
}
function cdText(){
  const n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1),s=Math.max(0,Math.floor((t-n)/1000)),p=x=>String(x).padStart(2,"0");
  return p(Math.floor(s/3600))+":"+p(Math.floor(s%3600/60))+":"+p(s%60);
}
function mapSvg(d){
  const M=WAR_MAPS[d.map],W=360,PAD=8,TW=(W-2*PAD)/M.cols,TH=Math.min(112,Math.max(84,TW*1.4)),H=M.rows*TH+2*PAD;
  const f=M.cols>=6?9.6:M.cols===5?10.5:12,lim=Math.floor((TW-8)/(f*.46)),lh=f+2.4;
  const adj=adjOf(d.map),mine=new Set(myTiles(d)),G=geoOf(d.map,TW,TH,PAD);
  const sp={};   // صور المجسّمات (بتتعرّف مرة واحدة وتتكرر بـ <use>)
  const addSp=(id,key,o)=>{if(sp[id]===undefined)sp[id]=(window.A3D&&A3D.sprite)?A3D.sprite(key,o):"";return!!sp[id]};
  let body="";
  M.regions.forEach(r=>{
    const T=d.tiles[r.id],g=G.tiles[r.id],owner=T.o,isSel=sel===r.id;
    const attackable=owner!==ME.id&&(mine.size===0||[...adj[r.id]].some(n=>mine.has(n)));
    let stroke="rgba(8,6,22,.6)",sw=1.2,dash="";
    if(owner===ME.id){stroke="rgba(255,255,255,.92)";sw=2.2}
    if(attackable&&!isSel){stroke="rgba(88,183,255,.98)";sw=1.8;dash=' stroke-dasharray="4 3"'}
    if(isSel){stroke="#ffd45a";sw=3}
    const terr=TERR[r.v]||TERR[1];
    body+=`<g class="t" data-r="${r.id}"><path class="ti" d="${g.d}" fill="${owner?colorOf(owner):terr}"/>`;
    if(owner)body+=`<path d="${g.d}" fill="${terr}" opacity=".24" pointer-events="none"/>`;
    body+=`<path d="${g.d}" fill="url(#wgrain)" pointer-events="none"/><path d="${g.d}" fill="url(#wshade)" pointer-events="none"/>`;
    const lines=tileLines(r.n,lim),y0=g.top+f+4,nameBot=y0+(lines.length-1)*lh+4,cntTop=g.bot-f-6;
    // الحصن (دفاع): 4 دبابات في الزوايا وبرج في النص فوقه 4 جنود
    const hx=unitHex(owner).slice(1),fid="f"+hx;
    if(addSp(fid,"war:fort@"+hx,{yaw:.45,pitch:.95,zoom:.8,size:160})){
      const size=Math.min(TW*1.08,Math.max(30,(cntTop-nameBot)*1.4)),cy=(nameBot+cntTop)/2;
      body+=`<use href="#${fid}" transform="translate(${g.cx.toFixed(1)} ${cy.toFixed(1)}) scale(${(size/64).toFixed(3)})" pointer-events="none"/>`;
    }
    lines.forEach((ln,i)=>{body+=`<text x="${g.cx.toFixed(1)}" y="${(y0+i*lh).toFixed(1)}" text-anchor="middle" font-size="${f}" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.6)" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">${escapeHtml(ln)}</text>`});
    body+=`<text x="${g.cx.toFixed(1)}" y="${(g.bot-6).toFixed(1)}" text-anchor="middle" font-size="${f+.6}" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.65)" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">⚔️${T.s}</text>`;
    if(r.cap)body+=`<text x="${(g.cx-TW/2+6).toFixed(1)}" y="${(g.bot-6).toFixed(1)}" font-size="${f+1}">👑</text>`;
    if(T.k)body+=`<text x="${(g.cx+TW/2-6).toFixed(1)}" y="${(g.bot-6).toFixed(1)}" text-anchor="end" font-size="${f}" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.65)" stroke-width="2.4" paint-order="stroke">🪖${T.k}</text>`;
    body+=`<path d="${g.d}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dash} stroke-linejoin="round" pointer-events="none"/></g>`;
  });
  // الهجمات الجارية: فرقة (3 دبابات + 3 جنود) بتتحرك من منطقة المهاجم للهدف
  let marching="";
  Object.entries(d.orders||{}).slice(0,36).forEach(([oid,o],idx)=>{
    const to=G.tiles[o.to];if(!to)return;
    const sId=srcOf(d,o,adj,G),from=sId?G.tiles[sId]:null;
    const tx=to.cx,ty=(to.top+to.bot)/2,sx=from?from.cx:tx,sy=from?(from.top+from.bot)/2:ty-TH;
    const dir=((Math.round(Math.atan2(tx-sx,ty-sy)/(Math.PI/4))%8)+8)%8,hx=unitHex(o.u).slice(1),qid="q"+hx+dir;
    if(!addSp(qid,"war:squad@"+hx,{yaw:dir*Math.PI/4,pitch:.7,zoom:.8,size:160}))return;
    const sd=seedOf(oid),dur=(4.2+(sd%12)/10).toFixed(1),bg=((idx%4)*.8+(sd%7)/10).toFixed(1),size=TW*1.3;
    marching+=`<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#${hx}" stroke-width="1.8" stroke-dasharray="4 4" opacity=".7" pointer-events="none"/>`;
    marching+=`<g pointer-events="none" opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.86;1" dur="${dur}s" begin="${bg}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="${sx.toFixed(1)} ${sy.toFixed(1)};${tx.toFixed(1)} ${ty.toFixed(1)}" dur="${dur}s" begin="${bg}s" repeatCount="indefinite"/><use href="#${qid}" transform="scale(${(size/64).toFixed(3)})"/></g>`;
  });
  const imgs=Object.keys(sp).filter(k=>sp[k]).map(k=>`<image id="${k}" width="64" height="64" x="-32" y="-32" href="${sp[k]}"/>`).join("");
  return `<svg class="war-map" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="خريطة ${escapeHtml(M.name)}">
  <defs>
    <linearGradient id="wsea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16365a"/><stop offset="1" stop-color="#0a1a36"/></linearGradient>
    <linearGradient id="wshade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
    <pattern id="wgrain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#fff" opacity=".1"/><circle cx="4" cy="4" r=".6" fill="#000" opacity=".15"/><circle cx="4.6" cy="1.2" r=".4" fill="#000" opacity=".1"/></pattern>
    <pattern id="wwave" width="26" height="14" patternUnits="userSpaceOnUse"><path d="M0 7q6.5-5 13 0t13 0" fill="none" stroke="#6db4f0" stroke-opacity=".13" stroke-width="1"/></pattern>
    <filter id="wshadow" x="-6%" y="-6%" width="112%" height="112%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
    ${imgs}
  </defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#wsea)"/><rect width="${W}" height="${H}" rx="16" fill="url(#wwave)"/>
  <g filter="url(#wshadow)">${body}</g>${marching}</svg>`;
}

function panelHtml(d,av){
  if(!sel)return `<div class="card war-panel"><h3>👆 دوس على أي منطقة</h3><div class="war-sub">هتشوف تفاصيلها وتقدر تعزّزها لو بتاعتك أو تهاجمها لو مجاورة لمناطقك (حدودها منقطة بالأزرق).</div></div>`;
  const r=regOf(d.map,sel),T=d.tiles[sel],adj=adjOf(d.map)[sel];
  const owner=T.o,isMine=owner===ME.id;
  const neigh=[...adj].map(id=>regOf(d.map,id).n).join("، ");
  let h=`<div class="card war-panel"><h3>${r.cap?"👑 ":""}${escapeHtml(r.n)}</h3>
  <div class="war-kv"><span>المالك: <b>${owner?escapeHtml(nameOf(owner,d)):"محايدة"}</b></span><span>الحامية: <b>${T.s} جندي${T.k?" + "+T.k+" دبابة":""}</b></span><span>قيمتها: <b>${r.v} 🪙/يوم</b></span></div>
  <div class="war-sub">تجاور: ${escapeHtml(neigh)}</div>`;
  const attack=!isMine&&canAttack(d,sel);
  if(isMine||attack){
    h+=`<div class="war-form"><div><label>⚔️ جنود (متاح ${av.s})</label><input id="wS" type="number" inputmode="numeric" min="0" max="${av.s}" value="${form.s}" placeholder="0"></div>
    <div><label>🪖 دبابات (متاح ${av.k})</label><input id="wK" type="number" inputmode="numeric" min="0" max="${av.k}" value="${form.k||""}" placeholder="0"></div></div>
    <div class="war-actions"><button class="btn" id="wAll">كل القوة</button>`;
    h+=isMine?`<button class="btn primary" id="wGo">🛡️ عزّز المنطقة</button></div><div class="war-sub" style="margin-top:8px">التعزيز فوري.</div>`
            :`<button class="btn primary" id="wGo">⚔️ أرسل الهجوم</button></div><div class="war-note">الهجوم بيتحسم تلقائي بعد منتصف الليل. لو قوتك أكبر من الحامية (والمدافع عنده +20%) بتاخد المنطقة.</div>`;
  }else{
    h+=`<div class="war-note">المنطقة دي مش مجاورة لأي منطقة بتاعتك، خد منطقة جنبها الأول.</div>`;
  }
  return h+"</div>";
}

function ordersHtml(d){
  const mine=Object.entries(d.orders).filter(([id,o])=>o.u===ME.id);
  if(!mine.length)return "";
  return `<div class="card"><div class="section-head"><h2>📨 هجماتي المعلقة</h2></div>`+mine.map(([id,o])=>{
    const r=regOf(d.map,o.to);
    return `<div class="war-row"><span>⚔️ على <b>${escapeHtml(r?r.n:"؟")}</b> — ${o.s} جندي${o.k?" + "+o.k+" دبابة":""}</span><button class="btn" data-cancel="${id}">إلغاء</button></div>`;
  }).join("")+`</div>`;
}

function rankHtml(d){
  const cnt={},pw={};
  Object.keys(d.tiles).forEach(id=>{const T=d.tiles[id];if(T.o){cnt[T.o]=(cnt[T.o]||0)+1;pw[T.o]=(pw[T.o]||0)+strength(T)}});
  const ids=Object.keys(d.players);
  ids.sort((a,b)=>((cnt[b]||0)-(cnt[a]||0))||((d.players[b].coins||0)-(d.players[a].coins||0)));
  const rows=ids.map((u,i)=>`<div class="war-row"><div class="who"><span class="war-dot" style="background:${colorOf(u)}"></span><b>${i===0&&(cnt[u]||0)>0?"👑 ":(i+1)+". "}${escapeHtml(nameOf(u,d))}${u===ME.id?" (أنت)":""}</b></div><span class="war-sub" style="margin:0">${cnt[u]||0} منطقة • ${d.players[u].coins||0} 🪙</span></div>`).join("");
  return `<div class="card"><div class="section-head"><h2>🏆 الترتيب</h2><span>${ids.length} لاعب</span></div>${rows||'<div class="war-sub">لسه محدش دخل الحرب</div>'}<div class="war-sub" style="margin-top:8px">صاحب أكتر مناطق آخر الشهر بياخد لقب "الفاتح" 👑</div></div>`;
}

function voteHtml(d){
  const mk=d.month,dim=monthDates(mk).length,day=+todayK().slice(8,10);
  const open=day>=dim-(VOTE_DAYS-1);
  const opts=WAR_MAP_ORDER.filter(m=>m!==d.map);
  const cnt={};Object.values(d.votes).forEach(v=>{cnt[v]=(cnt[v]||0)+1});
  const my=d.votes[ME.id];
  let h=`<div class="card"><div class="section-head"><h2>🗳️ تصويت الدولة الجاية</h2></div>`;
  if(!open){
    const left=(dim-(VOTE_DAYS-1))-day;
    return h+`<div class="war-sub">التصويت بيفتح في آخر ${VOTE_DAYS} أيام من الشهر (بعد ${left} ${left===1?"يوم":"أيام"}). لو محدش صوّت بنكمل بالترتيب.</div></div>`;
  }
  h+=`<div class="war-sub">اختار الدولة بتاعت الشهر الجاي. صوتك واحد وتقدر تغيّره.</div><div class="war-vote">`;
  h+=opts.map(m=>`<button data-vote="${m}" class="${my===m?"on":""}">${WAR_MAPS[m].flag}<br><b>${WAR_MAPS[m].name}</b><br><small>${cnt[m]||0} صوت</small></button>`).join("");
  return h+"</div></div>";
}

function pastHtml(){
  if(!PAST||!PAST.length)return "";
  return `<div class="card"><div class="section-head"><h2>🏛️ قاعة الفاتحين</h2></div>`+PAST.map(p=>`<div class="war-row"><span>${WAR_MAPS[p.map]?WAR_MAPS[p.map].flag:""} ${escapeHtml(monthLabel(p.month))}</span><b>👑 ${escapeHtml(nameOf(p.uid,{players:{}})!=="؟"?nameOf(p.uid):p.name)} — ${p.n} منطقة</b></div>`).join("")+`</div>`;
}

function renderWar(){
  const root=$("page-war");if(!root||!ME)return;
  injectCss();
  if(!unsub||unsubKey!==curMonth()){startWar();}
  if(DATA_ERR&&!DATA){
    root.innerHTML=`<div class="hero"><h1>🗺️ حرب المناطق</h1></div><div class="war-err">⚠️ مش قادر أوصل لبيانات اللعبة.<br>لو دي أول مرة: افتح <b>Firebase Console ← Firestore ← Rules</b> وانسخ محتوى ملف <b>firestore.rules</b> الجديد واضغط Publish، وبعدين حدّث الصفحة.</div>`;
    return;
  }
  if(!DATA){root.innerHTML=`<div class="hero"><h1>🗺️ حرب المناطق</h1><p>جاري تحميل الخريطة…</p></div>`;return}
  const d=DATA,M=WAR_MAPS[d.map];
  if(!d.players[ME.id]){root.innerHTML=`<div class="hero"><h1>🗺️ حرب المناطق</h1><p>بنجهّز لك منطقة البداية…</p></div>`;return}
  if(!PAST)loadPast();
  const av=available(d),minToday=(state.daily&&state.daily[todayK()])||0;
  const hoursToday=Math.min(6,minToday/60);
  const tankToday=minToday>=TANK_MINUTES;
  const owners=new Set(Object.values(d.tiles).filter(t=>t.o).map(t=>t.o));
  const legend=[...owners].map(u=>`<span><i style="background:${colorOf(u)}"></i>${escapeHtml(nameOf(u,d))}</span>`).join("")+`<span><i style="background:#6f7d4c"></i>محايدة</span>`;
  root.innerHTML=`
  <div class="card war-head"><div><h1>🗺️ حرب المناطق ${M.flag}</h1><div class="war-sub">خريطة ${escapeHtml(M.name)} • ${escapeHtml(monthLabel(d.month))} • ذاكر عشان تقوى وتاخد مناطق أصحابك</div></div></div>
  <div class="war-res">
    <div class="box"><small>⚔️ جنودك المتاحين</small><b>${av.s}</b><small>كل 30 دقيقة = 100</small></div>
    <div class="box"><small>🪖 دباباتك المتاحة</small><b>${av.k}</b><small>الدبابة = ${TANK_POWER} قوة</small></div>
    <div class="box"><small>🪖 دبابة اليوم</small><b>${tankToday?"✅ خدتها":Math.floor(hoursToday*10)/10+" / 6 س"}</b><div class="war-bar"><i style="width:${Math.round(hoursToday/6*100)}%"></i></div></div>
  </div>
  <div class="card"><div class="war-cd" id="warCd">⏳ الحسم بعد <b dir="ltr">${cdText()}</b></div>${mapSvg(d)}<div class="war-legend">${legend}</div></div>
  <div id="warPanel">${panelHtml(d,av)}</div>
  ${ordersHtml(d)}
  ${rankHtml(d)}
  ${voteHtml(d)}
  ${pastHtml()}
  <div class="card war-log"><div class="section-head"><h2>📜 آخر الأحداث</h2></div>${d.log.slice(0,12).map(l=>`<div>${escapeHtml(l.x)}</div>`).join("")||'<div class="war-sub">لسه مفيش أحداث</div>'}</div>
  <div class="card war-how"><details${howOpen?" open":""}><summary>❓ إزاي ألعب؟</summary><ul>
    <li>كل <b>30 دقيقة</b> مذاكرة = <b>100 جندي</b>.</li>
    <li>لو ذاكرت <b>6 ساعات</b> في اليوم (حتى لو متفرقة) بتاخد <b>دبابة</b> قوتها ${TANK_POWER}. دبابة واحدة في اليوم كحد أقصى.</li>
    <li>دوس على منطقة بتاعتك وعزّزها بجنود ودبابات.</li>
    <li>دوس على منطقة مجاورة (حدودها منقطة بالأزرق) وابعت هجوم. بيتحسم بعد منتصف الليل.</li>
    <li>كل منطقة بتملكها بتدّيك 🪙 كل يوم، وصاحب أكتر مناطق آخر الشهر هو "الفاتح" 👑.</li>
    <li>في آخر ${VOTE_DAYS} أيام من الشهر بنصوّت على الدولة الجاية.</li>
  </ul></details></div>`;
  wire(root,d,av);
  const dt=root.querySelector(".war-how details");if(dt)dt.ontoggle=()=>{howOpen=dt.open};
}

function wire(root,d,av){
  root.querySelectorAll("[data-r]").forEach(g=>g.onclick=()=>{sel=g.dataset.r;form={s:"",k:0};renderWar()});
  root.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>cancelOrder(b.dataset.cancel));
  root.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>doVote(b.dataset.vote));
  const s=$("wS"),k=$("wK"),go=$("wGo"),all=$("wAll");
  if(s)s.oninput=()=>{form.s=s.value};
  if(k)k.oninput=()=>{form.k=k.value};
  if(all)all.onclick=()=>{form={s:String(av.s),k:av.k};renderWar()};
  if(go)go.onclick=()=>{
    if(av.s+av.k<=0)return toast("مفيش قوة متاحة دلوقتي، ذاكر الأول عشان تكسب جنود 💪");
    const r=readForm(av);
    if(r.s+r.k<=0)return toast("اكتب عدد الجنود أو الدبابات");
    form={s:String(r.s),k:r.k};
    d.tiles[sel].o===ME.id?doReinforce():doAttack();
  };
}

/* ---------- ربط بالموقع ---------- */
PAGES.war=renderWar;
setInterval(()=>{
  if(!ME||curPage!=="war")return;
  const a=document.activeElement;
  if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
  if(unsubKey&&unsubKey!==curMonth()){startWar();return}
  if(DATA&&DATA.lastResolved<todayK())resolveDay();
  renderWar();
},15000);
let lastResTry=0;
setInterval(()=>{
  if(!ME||curPage!=="war")return;
  const b=document.querySelector("#warCd b");if(b)b.textContent=cdText();
  if(DATA&&DATA.lastResolved<todayK()&&!resolving&&!document.hidden&&Date.now()-lastResTry>20000){
    const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
    lastResTry=Date.now();resolveDay().then(()=>renderWar());
  }
},1000);
if(typeof auth!=="undefined"&&auth)auth.onAuthStateChanged(u=>{if(!u)stopWar()});
})();
