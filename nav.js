/* =====================================================================
   🧭 nav.js — القايمة الجانبية
   - "حرب المناطق" و"عالمي" فرع تحت "الرئيسية" (بيتقفل ويتفتح بالسهم).
   - زرار "⚙️ ترتيب القايمة": أي مستخدم يرتّب القايمة زي ما يحب (فوق/تحت)،
     ويدخّل أي عنصر تحت "الرئيسية" أو يطلّعه منها. الترتيب بيتحفظ لكل مستخدم على جهازه.
   ===================================================================== */
(function(){
"use strict";
const nav=document.querySelector(".nav");
if(!nav||window.NAV)return;

/* ---------- العناصر الأصلية من الـ HTML ---------- */
const ITEMS={},DEF_ALL=[];
nav.querySelectorAll("button[data-page]").forEach(b=>{
  const id=b.dataset.page,ico=b.querySelector(".ico");
  const label=Array.from(b.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim();
  ITEMS[id]={ico:ico?ico.textContent:"",label};DEF_ALL.push(id);
});
const DEF_KIDS=["war","world"].filter(id=>ITEMS[id]);
const defaults=()=>({order:DEF_ALL.filter(id=>!DEF_KIDS.includes(id)),kids:DEF_KIDS.slice(),open:true});

/* ---------- حالة + تخزين ---------- */
let L=defaults(),editing=false,uidNow=null;
const keyOf=u=>"elshilla_nav_"+(u||"guest");
function clean(x){
  x=x||{};const seen=new Set(["home"]);
  const kids=(Array.isArray(x.kids)?x.kids:[]).filter(id=>ITEMS[id]&&!seen.has(id)&&seen.add(id));
  const seen2=new Set(),order=(Array.isArray(x.order)?x.order:[]).filter(id=>ITEMS[id]&&!kids.includes(id)&&!seen2.has(id)&&seen2.add(id));
  if(!seen2.has("home")){order.unshift("home");seen2.add("home")}
  DEF_ALL.forEach(id=>{if(!seen2.has(id)&&!kids.includes(id)){order.push(id);seen2.add(id)}});   // أي عنصر جديد يتضاف في الآخر
  const uniq=order;
  return{order:uniq,kids,open:x.open!==false};
}
function load(){
  let raw=null;try{raw=JSON.parse(localStorage.getItem(keyOf(uidNow)))}catch(e){}
  L=raw?clean(raw):defaults();render();
}
function persist(){try{localStorage.setItem(keyOf(uidNow),JSON.stringify(L))}catch(e){}}

/* ---------- الرسم ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function ctl(id,kid){
  if(!editing)return"";
  let h='<span class="nv-ctl"><i data-a="up" title="فوق">▲</i><i data-a="dn" title="تحت">▼</i>';
  if(kid)h+='<i data-a="out" title="إخراج من الفرع">↰</i>';
  else if(id!=="home")h+='<i data-a="in" title="ضمّه تحت الرئيسية">↳</i>';
  return h+"</span>";
}
function row(id,kid){
  const it=ITEMS[id];
  const tg=(id==="home"&&L.kids.length&&!editing)?'<i class="nv-tg" data-a="tg" title="فتح/قفل الفرع">'+(L.open?"▾":"◂")+"</i>":"";
  return'<div class="nv-row'+(kid?" kid":"")+'" data-id="'+id+'"><button data-page="'+id+'"><span class="ico">'+it.ico+"</span>"+esc(it.label)+"</button>"+tg+ctl(id,kid)+"</div>";
}
function render(){
  let h="";
  L.order.forEach(id=>{
    h+=row(id,false);
    if(id==="home"&&L.kids.length)h+='<div class="nv-kids'+(L.open||editing?"":" shut")+'">'+L.kids.map(k=>row(k,true)).join("")+"</div>";
  });
  nav.innerHTML=h;nav.classList.toggle("editing",editing);
  const cur=typeof curPage!=="undefined"?curPage:"home";
  nav.querySelectorAll("button[data-page]").forEach(b=>{
    b.onclick=()=>{if(typeof go==="function")go(b.dataset.page)};
    b.classList.toggle("active",b.dataset.page===cur);
  });
  const eb=document.getElementById("navEdit"),rb=document.getElementById("navReset");
  if(eb)eb.textContent=editing?"✅ تم":"⚙️ ترتيب القايمة";
  if(rb)rb.hidden=!editing;
}

/* ---------- التحكم ---------- */
function act(a,id){
  const inKids=L.kids.includes(id),list=inKids?L.kids:L.order,i=list.indexOf(id);
  if(a==="tg")L.open=!L.open;
  else if(a==="up"&&i>0){const t=list[i-1];list[i-1]=list[i];list[i]=t}
  else if(a==="dn"&&i>-1&&i<list.length-1){const t=list[i+1];list[i+1]=list[i];list[i]=t}
  else if(a==="in"&&!inKids&&id!=="home"&&i>-1){L.order.splice(i,1);L.kids.push(id);L.open=true}
  else if(a==="out"&&inKids){L.kids.splice(i,1);L.order.splice(L.order.indexOf("home")+1,0,id)}
  persist();render();
}
nav.addEventListener("click",e=>{
  const a=e.target.closest("i[data-a]");
  if(a){e.preventDefault();e.stopPropagation();const r=a.closest(".nv-row");act(a.dataset.a,r?r.dataset.id:"home");return}
  if(editing&&e.target.closest("button[data-page]")){e.preventDefault();e.stopPropagation()}   // في وضع الترتيب الضغط مايفتحش الصفحة
},true);

/* ---------- زراير الترتيب تحت القايمة ---------- */
const bar=document.createElement("div");bar.className="nv-bar";
bar.innerHTML='<button type="button" id="navEdit">⚙️ ترتيب القايمة</button><button type="button" id="navReset" hidden>↺ الافتراضي</button>';
nav.parentNode.insertBefore(bar,nav.nextSibling);
document.getElementById("navEdit").onclick=()=>{editing=!editing;render()};
document.getElementById("navReset").onclick=()=>{L=defaults();persist();render()};

/* ---------- ستايل ---------- */
const css=document.createElement("style");
css.textContent=".nv-row{display:flex;align-items:center;gap:6px}.nv-row>button{flex:1;min-width:0}"
+".nv-kids{margin-inline-start:22px;padding-inline-start:10px;border-inline-start:2px solid rgba(139,61,255,.38);display:grid;gap:6px}.nv-kids.shut{display:none}"
+".nv-row.kid>button{padding:9px 11px;font-size:14px}"
+".nv-tg{font-style:normal;cursor:pointer;color:var(--muted);padding:8px 10px;border-radius:10px;user-select:none;-webkit-user-select:none}.nv-tg:hover{background:rgba(255,255,255,.07);color:#fff}"
+".nv-ctl{display:flex;gap:3px;flex:none}.nv-ctl i{font-style:normal;cursor:pointer;padding:8px 8px;border-radius:9px;background:rgba(255,255,255,.08);color:#d8d3ee;font-size:11px;line-height:1;user-select:none;-webkit-user-select:none}.nv-ctl i:hover{background:rgba(139,61,255,.35);color:#fff}"
+".nav.editing{overflow-x:hidden}.nav.editing .nv-row>button{outline:1px dashed rgba(255,213,90,.4);outline-offset:-1px;padding:10px 9px;font-size:14px;gap:8px}.nav.editing .nv-ctl{gap:2px}.nav.editing .nv-ctl i{padding:8px 6px;font-size:10px}"
+".nv-bar{display:flex;gap:8px;margin-top:10px}.nv-bar button{flex:1;padding:9px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#cfc9e8;cursor:pointer;font:inherit;font-size:13px}.nv-bar button:hover{background:rgba(139,61,255,.18);color:#fff}.nv-bar button[hidden]{display:none}";
document.head.appendChild(css);

/* ---------- الترتيب لكل مستخدم: نحمّله أول ما الحساب يتعرف ---------- */
setInterval(()=>{
  const u=(typeof ME!=="undefined"&&ME&&ME.id)?ME.id:null;
  if(u!==uidNow){uidNow=u;editing=false;load()}
},700);
load();
window.NAV={render,reset(){L=defaults();persist();render()}};
})();
