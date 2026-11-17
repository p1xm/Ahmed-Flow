/* =====================================================================
   🐾 animals3d.js — حيوانات ووحوش ثلاثية الأبعاد
   - من غير أي مكتبة خارجية (بتشتغل أوفلاين) — محرك 3D صغير على canvas.
   - A3D.html(emoji,{tired,dead}) بيرجّع <canvas> متحرك، ولو الإيموجي مالوش مجسّم بيرجّعه زي ما هو.
   - اسحب بإصبعك على الحيوان يلف، واضغط عليه يقفز.
   ===================================================================== */
(function(){
"use strict";
if(window.A3D)return;
const PI=Math.PI,D2R=PI/180,sin=Math.sin,cos=Math.cos,sqrt=Math.sqrt,abs=Math.abs,min=Math.min,max=Math.max;

/* ---------- رياضيات 3x3 ---------- */
const mul=(a,b)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return r};
const rotX=a=>{const c=cos(a),s=sin(a);return[1,0,0,0,c,-s,0,s,c]};
const rotY=a=>{const c=cos(a),s=sin(a);return[c,0,s,0,1,0,-s,0,c]};
const rotZ=a=>{const c=cos(a),s=sin(a);return[c,-s,0,s,c,0,0,0,1]};
const eul=(x,y,z)=>mul(rotZ(z*D2R),mul(rotY(y*D2R),rotX(x*D2R)));
const axM=(ax,a)=>ax==="x"?rotX(a):ax==="y"?rotY(a):rotZ(a);
const mv=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];

/* ---------- شبكات أساسية (lathe على محور y) ---------- */
const MESH={};
function orient(v,f){
  for(let i=0;i<f.length;i+=3){
    const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3;
    const ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],wx=v[c]-v[a],wy=v[c+1]-v[a+1],wz=v[c+2]-v[a+2];
    const nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;
    const gx=v[a]+v[b]+v[c],gy=v[a+1]+v[b+1]+v[c+1],gz=v[a+2]+v[b+2]+v[c+2];
    if(nx*gx+ny*gy+nz*gz<0){const t=f[i+1];f[i+1]=f[i+2];f[i+2]=t}
  }
}
function boxMesh(){
  const v=[-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1];
  const f=[0,1,2,0,2,3, 4,6,5,4,7,6, 0,4,5,0,5,1, 3,2,6,3,6,7, 0,3,7,0,7,4, 1,5,6,1,6,2];
  orient(v,f);return{v:new Float32Array(v),f:new Uint16Array(f)};
}
function lathe(prof,seg){
  const v=[],f=[],rings=[];
  prof.forEach(([y,r])=>{
    if(r<1e-6){rings.push({s:v.length/3,n:1});v.push(0,y,0)}
    else{rings.push({s:v.length/3,n:seg});for(let j=0;j<seg;j++){const a=2*PI*j/seg;v.push(r*cos(a),y,r*sin(a))}}
  });
  const tri=(a,b,c)=>f.push(a,b,c);
  for(let i=0;i<rings.length-1;i++){
    const A=rings[i],B=rings[i+1];
    if(A.n===1&&B.n===1)continue;
    for(let j=0;j<seg;j++){
      const j2=(j+1)%seg;
      if(A.n===1)tri(A.s,B.s+j,B.s+j2);
      else if(B.n===1)tri(A.s+j,A.s+j2,B.s);
      else{tri(A.s+j,A.s+j2,B.s+j2);tri(A.s+j,B.s+j2,B.s+j)}
    }
  }
  orient(v,f);
  return{v:new Float32Array(v),f:new Uint16Array(f)};
}
function getMesh(t,q){
  const k=t+q;if(MESH[k])return MESH[k];
  let m;
  if(t==="e"){const seg=[12,9,7][q],R=[8,6,4][q],p=[];for(let i=0;i<=R;i++){const a=-PI/2+PI*i/R;p.push([sin(a),cos(a)])}m=lathe(p,seg)}
  else if(t==="b")m=boxMesh();
  else if(t==="c")m=lathe([[-1,0],[-1,1],[1,0]],[10,8,6][q]);
  else m=lathe([[-1,0],[-1,1],[1,1],[1,0]],[10,8,6][q]);
  return MESH[k]=m;
}

/* ---------- أدوات بناء المجسّمات ---------- */
const E=(c,p,s,o)=>Object.assign({t:"e",c,p,s},o);
const C=(c,p,s,o)=>Object.assign({t:"c",c,p,s},o);   // مخروط: s=[rx,نصف الطول,rz] والقمة لفوق
const K=(c,p,s,o)=>Object.assign({t:"k",c,p,s},o);   // أسطوانة
const B=(c,p,s,o)=>Object.assign({t:"b",c,p,s},o);   // صندوق
const mir=f=>[f(1),f(-1)];
const RT=(ax,amp,spd,ph,pv)=>({k:"rot",ax,amp,spd,ph:ph||0,pv:pv||[0,0,0]});
const MV=(ax,amp,spd,ph)=>({k:"mov",ax,amp,spd,ph:ph||0});
function withAn(parts,a){parts.flat(Infinity).forEach(p=>{if(p&&!p.an)p.an=a});return parts}
// عضو بين نقطتين (أسطوانة/مخروط/بيضاوي)
function lm(t,c,a,b,r,o){
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=sqrt(dx*dx+dy*dy+dz*dz)||1e-6;
  return Object.assign({t,c,p:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],s:[r,L/2,r],r:[Math.asin(dz/L)/D2R,0,Math.atan2(-dx,dy)/D2R]},o);
}
function chain(c,pts,rad,o){
  const out=[],R=i=>Array.isArray(rad)?rad[i]:rad;
  pts.forEach((p,i)=>{out.push(E(c,p,[R(i),R(i),R(i)],o));if(i)out.push(lm("k",c,pts[i-1],p,(R(i)+R(i-1))/2*.97,o))});
  return out;
}
// تحريك/تدوير/تصغير مجموعة أجزاء كوحدة واحدة
function place(parts,x,y,z,yaw,sc){
  sc=sc||1;const Ry=rotY((yaw||0)*D2R);
  parts.flat(Infinity).forEach(P=>{
    if(!P)return;const p=mv(Ry,[P.p[0]*sc,P.p[1]*sc,P.p[2]*sc]);
    P.p=[p[0]+x,p[1]+y,p[2]+z];P.s=[P.s[0]*sc,P.s[1]*sc,P.s[2]*sc];
    P.Rm=mul(Ry,P.Rm||eul.apply(null,P.r||[0,0,0]));
  });
  return parts;
}
function shade(h,f){const c=hexRgb(h);return"#"+c.map(v=>Math.min(255,Math.round(v*f)).toString(16).padStart(2,"0")).join("")}
function eyes(y,z,sp,r,o){
  o=o||{};const out=[];
  [1,-1].forEach(sx=>{
    out.push(E(o.w||"#ffffff",[sx*sp,y,z],[r,r*1.12,r*.8],{bl:1,bias:.05}));
    out.push(E(o.p||"#16121f",[sx*sp*1.03,y-r*.05,z+r*.42],[r*.62,r*.74,r*.5],{bl:1,bias:.08}));
    out.push(E("#ffffff",[sx*sp*1.03-sx*r*.12,y+r*.26,z+r*.8],[r*.2,r*.2,r*.14],{nl:1,bias:.1}));
  });
  return out;
}

/* ذوات الأربع (قاعدة مشتركة) */
function quad(o){
  const d=Object.assign({bw:.5,bh:.46,bl:.78,leg:.42,lr:.12,hd:.4,sn:.45,c:"#c98a4b",b:"#f1d3a3",lc:null,pc:null,sc:null,ear:"round",ec:null,ein:null,es:.34,nose:"#2a1a1a",tail:"long",tc:null,esp:.42,ey:.2,eyeo:null,hy:null,hz:null,neck:false,neckR:.14,chest:false},o);
  const by=d.leg+d.bh*.8,hy=d.hy!=null?d.hy:by+d.bh*.8,hz=d.hz!=null?d.hz:d.bl*.8+d.hd*.35,hd=d.hd,tc=d.tc||d.c;
  const P=[],lc=d.lc||d.c;
  [1,-1].forEach(sx=>[1,-1].forEach(sz=>{
    P.push(K(lc,[sx*d.bw*.62,d.leg/2,sz*d.bl*.58],[d.lr,d.leg/2,d.lr]));
    P.push(E(d.pc||lc,[sx*d.bw*.62,d.lr*.45,sz*d.bl*.58+d.lr*.5],[d.lr*1.15,d.lr*.6,d.lr*1.5]));
  }));
  P.push(E(d.c,[0,by,0],[d.bw,d.bh,d.bl]));
  if(d.chest)P.push(E(d.b,[0,by-d.bh*.1,d.bl*.72],[d.bw*.72,d.bh*.78,d.bl*.34],{bias:.03}));
  if(d.neck)P.push(lm("k",d.c,[0,by+d.bh*.2,d.bl*.6],[0,hy-hd*.2,hz-hd*.3],d.neckR));
  P.push(E(d.c,[0,hy,hz],[hd*1.05,hd,hd]));
  if(d.sn){
    P.push(E(d.sc||d.b,[0,hy-hd*.28,hz+hd*.78],[hd*.48,hd*.36,hd*d.sn]));
    P.push(E(d.nose,[0,hy-hd*.14,hz+hd*(.78+d.sn*.92)],[hd*.17,hd*.12,hd*.12],{bias:.05}));
  }
  P.push(eyes(hy+hd*d.ey,hz+hd*.78,hd*d.esp,hd*.2,d.eyeo));
  if(d.ear){
    const es=hd*d.es,ec=d.ec||d.c;
    P.push(mir(sx=>{
      const x=sx*hd*.62,y=hy+hd*.8,z=hz-hd*.1;
      if(d.ear==="round")return E(ec,[x,y,z],[es,es,es*.55]);
      if(d.ear==="point")return[C(ec,[x,y+es*.4,z],[es*.9,es,es*.45],{r:[0,0,sx*-12]}),d.ein?C(d.ein,[x,y+es*.3,z+es*.22],[es*.55,es*.72,es*.25],{r:[0,0,sx*-12],bias:.03}):null];
      return E(ec,[x,y+es*1.0,z],[es*.5,es*1.7,es*.4],{r:[0,0,sx*-10]});
    }));
  }
  const pv=[0,by,-d.bl],wag=RT("y",.4,2.2,0,pv);
  if(d.tail==="long"||d.tail==="tuft")P.push(withAn(chain(tc,[[0,by+d.bh*.3,-d.bl*.95],[0,by+d.bh*.2,-d.bl-.22],[0,by+d.bh*.05,-d.bl-.46]],[.09,.075,.06]),wag));
  if(d.tail==="tuft")P.push(withAn([E("#6b3410",[0,by+d.bh*.05,-d.bl-.52],[.1,.1,.17])],wag));
  if(d.tail==="fluff")P.push(withAn([E(tc,[0,by+d.bh*.3,-d.bl-.3],[.2,.2,.42],{r:[25,0,0]})],wag));
  if(d.tail==="short")P.push(withAn([E(tc,[0,by+d.bh*.3,-d.bl-.05],[.1,.1,.1])],wag));
  if(d.tail==="curl")P.push(withAn(chain(tc,[[0,by+d.bh*.2,-d.bl],[0,by+.08,-d.bl-.25],[0,by+.4,-d.bl-.42],[0,by+.72,-d.bl-.36]],.07),wag));
  return{parts:P,m:Object.assign({},d,{by,hy,hz})};
}
const topY=(m,x,z)=>m.by+m.bh*sqrt(max(0,1-(x/m.bw)*(x/m.bw)-(z/m.bl)*(z/m.bl)));

/* ---------- المجسّمات ---------- */
const REG={
"🦁":()=>{
  const q=quad({c:"#d9a441",b:"#f6dea6",bw:.5,bh:.46,bl:.8,leg:.4,lr:.12,hd:.34,sn:.4,ear:null,tail:"tuft",nose:"#4a2a1a",chest:true}),m=q.m,hd=m.hd;
  q.parts.push(E("#8a4b1f",[0,m.hy,m.hz-hd*.45],[hd*1.5,hd*1.5,hd*1.0]));
  q.parts.push(mir(sx=>E("#b9812c",[sx*hd*.8,m.hy+hd*1.2,m.hz-hd*.1],[hd*.3,hd*.3,hd*.17])));
  return q;
},
"🐅":()=>{
  const q=quad({c:"#f3902f",b:"#fff4e3",bw:.5,bh:.46,bl:.8,leg:.4,lr:.13,hd:.38,sn:.35,ear:"round",es:.3,tail:"long",chest:true,nose:"#e0707f"}),m=q.m,hd=m.hd,P=q.parts,dk="#1c1410";
  [-.55,-.2,.15,.5].forEach(zf=>{
    const z=zf*m.bl;
    mir(sx=>{const x=m.bw*sqrt(max(0,1-.04-zf*zf))*.97;P.push(E(dk,[sx*x,m.by+m.bh*.2,z],[.045,m.bh*.5,.07],{r:[0,0,sx*-8],bias:.04}))});
    P.push(E(dk,[0,topY(m,0,z)-.01,z],[m.bw*.55,.035,.065],{bias:.04}));
  });
  [-.12,0,.12].forEach(x=>P.push(E(dk,[x*hd/.38,m.hy+hd*.8,m.hz+hd*.4],[.025,.05,.05],{bias:.05})));
  P.push(E(dk,[0,m.by+m.bh*.05,-m.bl-.46],[.07,.07,.08]));
  return q;
},
"🐺":()=>{
  const q=quad({c:"#8f97a6",b:"#dfe3ea",sc:"#cfd4dd",bw:.42,bh:.42,bl:.8,leg:.5,lr:.1,hd:.34,sn:.85,ear:"point",es:.3,ec:"#6c7482",ein:"#d9b3b3",tail:"fluff",tc:"#7c8492",nose:"#111",chest:true,eyeo:{w:"#ffe6a3"}}),m=q.m;
  q.parts.push(E("#646c7b",[0,m.by+m.bh*.5,-m.bl*.05],[m.bw*.85,m.bh*.6,m.bl*.8],{bias:.03}));
  return q;
},
"🐻":()=>quad({c:"#7a4b2a",b:"#c89a6b",bw:.62,bh:.58,bl:.7,leg:.36,lr:.18,hd:.44,sn:.38,ear:"round",es:.3,ec:"#6a3f22",tail:"short",nose:"#111"}),
"🐱":()=>{
  const q=quad({c:"#f0a85a",b:"#fff3e0",bw:.4,bh:.38,bl:.6,leg:.38,lr:.09,hd:.38,sn:.2,ear:"point",es:.34,ein:"#ffb3c1",tail:"curl",nose:"#ff8fa3",chest:true,esp:.45}),m=q.m,hd=m.hd,P=q.parts;
  [1,-1].forEach(sx=>[.1,-.12].forEach(dy=>P.push(E("#ffffff",[sx*hd*.62,m.hy-hd*.2+dy*hd,m.hz+hd*.82],[hd*.42,.008,.008],{r:[0,0,sx*(dy>0?-8:8)],nl:1,bias:.06}))));
  [-.1,0,.1].forEach(x=>P.push(E("#d97a2a",[x*hd/.38,m.hy+hd*.82,m.hz+hd*.4],[.022,.05,.05],{bias:.05})));
  return q;
},
"🐼":()=>{
  const q=quad({c:"#fafafa",b:"#fafafa",lc:"#1b1b1f",bw:.58,bh:.55,bl:.65,leg:.34,lr:.18,hd:.45,sn:.3,ear:"round",es:.3,ec:"#1b1b1f",tail:"short",nose:"#111"}),m=q.m,hd=m.hd,P=q.parts;
  P.push(E("#1b1b1f",[0,m.by,m.bl*.45],[m.bw*1.03,m.bh*1.03,m.bl*.26],{bias:.04}));
  mir(sx=>P.push(E("#1b1b1f",[sx*hd*.44,m.hy+hd*.18,m.hz+hd*.66],[hd*.2,hd*.28,hd*.18],{r:[0,0,sx*-25],bias:.04})));
  return q;
},
"🦊":()=>{
  const q=quad({c:"#f07a2a",b:"#ffffff",bw:.4,bh:.38,bl:.65,leg:.4,lr:.09,lc:"#3a2418",hd:.38,sn:.7,ear:"point",es:.34,ein:"#3a2418",tail:"none",nose:"#111",chest:true}),m=q.m,P=q.parts,pv=[0,m.by,-m.bl];
  P.push(withAn([E("#f07a2a",[0,m.by+.25,-m.bl-.35],[.2,.2,.45],{r:[25,0,0]}),E("#ffffff",[0,m.by+.42,-m.bl-.71],[.17,.17,.17],{r:[25,0,0]})],RT("y",.4,2.2,0,pv)));
  return q;
},
"🦌":()=>{
  const q=quad({c:"#b9783f",b:"#f6e7cf",bw:.38,bh:.4,bl:.7,leg:.8,lr:.06,hd:.28,sn:.8,ear:"long",es:.3,tail:"short",nose:"#222",neck:true,neckR:.13,hy:1.78,hz:.86,tc:"#fff"}),m=q.m,P=q.parts;
  [[-.3,.1],[.2,-.2],[.35,.25],[-.05,.3],[0,-.4]].forEach(([x,z])=>{const zz=z*m.bl;P.push(E("#fff",[x*m.bw,topY(m,x*m.bw,zz)-.01,zz],[.04,.025,.04],{bias:.04}))});
  mir(sx=>{const t=m.hy+m.hd*.8;P.push(chain("#5a3a22",[[sx*.08,t,m.hz-.1],[sx*.14,t+.18,m.hz-.14],[sx*.1,t+.36,m.hz-.2],[sx*.04,t+.52,m.hz-.28]],.028))});
  return q;
},
"🦅":()=>{
  const P=[],pv=s=>[s*.3,.95,0];
  P.push(E("#6b4423",[0,.8,0],[.38,.55,.34],{r:[-15,0,0]}));
  P.push(E("#8b5a2b",[0,.72,.14],[.28,.4,.2],{r:[-15,0,0]}));
  P.push(E("#fafafa",[0,1.45,.1],[.27,.27,.28]));
  P.push(C("#f2b705",[0,1.38,.42],[.1,.17,.1],{r:[90,0,0]}));
  P.push(C("#e0a400",[0,1.3,.52],[.05,.09,.05],{r:[150,0,0]}));
  P.push(eyes(1.5,.32,.14,.07,{w:"#ffe066"}));
  mir(s=>{
    const a=RT("z",s*.32,3.2,0,pv(s));
    P.push(withAn([E("#4a2c14",[s*.62,.95,-.05],[.5,.08,.3],{r:[0,0,s*-18]}),E("#3a2210",[s*1.05,.85,-.08],[.34,.06,.24],{r:[0,0,s*-28]})],a));
    P.push(K("#f2b705",[s*.14,.17,.05],[.05,.18,.05]),E("#f2b705",[s*.14,.04,.14],[.09,.04,.14]));
  });
  P.push(E("#f5f5f5",[0,.38,-.46],[.2,.05,.4],{r:[25,0,0]}));
  return{parts:P};
},
"🐊":()=>{
  const P=[],g="#4f9a3a";
  P.push(E(g,[0,.3,0],[.5,.28,1.0]),E("#cfe08f",[0,.2,.05],[.4,.2,.9]));
  P.push(E(g,[0,.33,1.15],[.3,.16,.55]),E("#b8cf7a",[0,.23,1.1],[.27,.09,.53]));
  P.push(E("#22301a",[0,.38,1.68],[.1,.04,.05],{bias:.05}));
  mir(sx=>{
    P.push(E(g,[sx*.2,.56,.7],[.12,.1,.12]));
    P.push(K(g,[sx*.5,.14,sx>0?.55:.55],[.1,.14,.1]),K(g,[sx*.5,.14,-.55],[.1,.14,.1]));
    for(let i=0;i<4;i++)P.push(C("#ffffff",[sx*.2,.26,.85+i*.2],[.025,.06,.025],{r:[180,0,0],bias:.03}));
  });
  P.push(eyes(.62,.74,.2,.075));
  const tail=[[0,.3,-1.0],[0,.27,-1.4],[0,.22,-1.75],[0,.18,-2.05]];
  P.push(withAn(chain(g,tail,[.34,.26,.17,.08]),RT("y",.32,2,0,[0,.3,-1])));
  for(let i=0;i<7;i++){const z=.6-i*.22;P.push(C("#3b7a2b",[0,.55-i*.015,z],[.07,.12,.07]))}
  return{parts:P};
},
"🦈":()=>{
  const P=[],b="#6f8aa6",f="#5d7790";
  P.push(E(b,[0,.7,0],[.42,.42,1.05]),E("#f3f6fa",[0,.56,.06],[.36,.3,.98]));
  P.push(E("#2a2030",[0,.58,.98],[.2,.03,.14],{bias:.05}));
  P.push(eyes(.82,.78,.3,.075,{w:"#e8edf3"}));
  P.push(C(f,[0,1.25,-.05],[.16,.35,.35],{r:[-25,0,0]}));
  mir(s=>P.push(C(f,[s*.46,.5,.35],[.1,.3,.2],{r:[20,0,s*-110]})));
  const tp=[0,.7,-1];
  P.push(withAn([C(f,[0,1.0,-1.3],[.1,.38,.18],{r:[-55,0,0]}),C(f,[0,.45,-1.28],[.08,.26,.14],{r:[235,0,0]}),E(b,[0,.7,-1.05],[.2,.22,.4])],RT("y",.35,2.5,0,tp)));
  for(let i=0;i<3;i++)P.push(E("#2a2030",[.0,.64,.6-i*.0],[.001,.001,.001]));
  return{parts:P};
},
"🐰":()=>{
  const P=[],w="#f4f1ee";
  P.push(E(w,[0,.55,0],[.5,.5,.55]),E(w,[0,1.05,.4],[.4,.37,.4]));
  P.push(mir(s=>[withAn([E(w,[s*.16,1.62,.32],[.1,.42,.07],{r:[-10,0,s*-10]}),E("#ffb3c1",[s*.16,1.6,.37],[.05,.3,.03],{r:[-10,0,s*-10],bias:.03})],RT("z",s*.05,1.6,s*1.2,[s*.16,1.2,.32]))]));
  P.push(eyes(1.12,.7,.18,.085));
  P.push(E("#ff8fa3",[0,1.0,.78],[.05,.04,.04],{bias:.05}));
  mir(s=>{P.push(E("#fff",[s*.1,.96,.72],[.12,.1,.1]));P.push(E(w,[s*.3,.12,.2],[.16,.12,.34]));P.push(E(w,[s*.14,.1,.58],[.1,.09,.14]))});
  P.push(E("#ffffff",[0,.5,-.58],[.17,.17,.17]));
  return{parts:P};
},
"🐧":()=>{
  const P=[],bk="#20242e";
  P.push(E(bk,[0,.75,0],[.5,.72,.45]),E("#fafafa",[0,.7,.18],[.38,.6,.32],{bias:.04}),E(bk,[0,1.5,.05],[.34,.32,.33]));
  P.push(E("#fafafa",[0,1.42,.17],[.25,.2,.22],{bias:.04}));
  P.push(eyes(1.55,.3,.15,.07));
  P.push(C("#ff9f1c",[0,1.42,.42],[.1,.14,.08],{r:[90,0,0]}));
  mir(s=>{P.push(withAn([E(bk,[s*.52,.85,0],[.09,.36,.18],{r:[0,0,s*-20]})],RT("z",s*.2,3,0,[s*.45,1.15,0])));P.push(E("#ff9f1c",[s*.2,.04,.2],[.14,.05,.2]))});
  return{parts:P};
},
"🐥":()=>{
  const P=[],y="#ffd23f";
  P.push(E(y,[0,.55,0],[.5,.5,.48]),E(y,[0,1.18,.1],[.36,.34,.34]));
  P.push(eyes(1.22,.38,.16,.075));
  P.push(C("#ff9f1c",[0,1.12,.46],[.08,.12,.07],{r:[90,0,0]}));
  mir(s=>{P.push(withAn([E("#f5bf1a",[s*.5,.58,0],[.08,.3,.26],{r:[0,0,s*-15]})],RT("z",s*.25,4,0,[s*.45,.8,0])));P.push(E("#ff9fb1",[s*.26,1.1,.34],[.07,.05,.04],{bias:.04}));P.push(K("#ff9f1c",[s*.15,.08,.05],[.03,.1,.03]),E("#ff9f1c",[s*.15,.02,.12],[.09,.03,.12]))});
  [-.08,0,.08].forEach((x,i)=>P.push(C(y,[x,1.55+(i===1?.04:0),.08],[.03,.1,.03],{r:[0,0,x*-300]})));
  return{parts:P};
},
"🥚":()=>{
  const P=[E("#f7f0e1",[0,.65,0],[.5,.65,.5])];
  [[.5,.55,.65],[-.7,.2,.68],[.1,-.2,.97],[.85,-.3,.4],[-.5,-.55,.65],[.2,.85,.45],[-.9,.5,.1],[.6,-.7,.3]].forEach(([x,y,z],i)=>{
    const l=sqrt(x*x+y*y+z*z);P.push(E(i%2?"#cf7f4a":"#e4a65a",[x/l*.5*.985,.65+y/l*.65*.985,z/l*.5*.985],[.06,.06,.06],{bias:.03}));
  });
  return{parts:P,wob:1};
},
"🐲":()=>{
  const q=quad({c:"#3fae5a",b:"#e6e29a",bw:.55,bh:.5,bl:.8,leg:.35,lr:.14,hd:.36,sn:.5,ear:null,tail:"none",nose:"#1f5a2d",neck:true,neckR:.17,hy:1.48,hz:.9,eyeo:{w:"#ffe27a",p:"#7a0f0f"},chest:true}),m=q.m,P=q.parts;
  mir(s=>{
    P.push(C("#f2e2b3",[s*.2,m.hy+m.hd*.95,m.hz-.12],[.06,.22,.06],{r:[-30,0,s*-15]}));
    const a=RT("z",s*.3,2.2,0,[s*.3,m.by+.4,0]);
    P.push(withAn([E("#2f8f4a",[s*.95,m.by+.62,-.05],[.7,.04,.42],{r:[0,s*-12,s*-24]}),E("#8fe0a0",[s*1.05,m.by+.58,-.02],[.45,.03,.3],{r:[0,s*-12,s*-24]})],a));
  });
  for(let i=0;i<6;i++){const z=.55-i*.28;P.push(C("#f2e2b3",[0,topY(m,0,z)+.04,z],[.07,.16,.07]))}
  P.push(withAn(chain("#3fae5a",[[0,m.by,-.75],[0,m.by-.05,-1.2],[0,m.by-.12,-1.62],[0,m.by-.1,-2.0]],[.3,.22,.14,.07]),RT("y",.3,1.8,0,[0,m.by,-.75])));
  P.push(C("#f2e2b3",[0,m.by-.1,-2.12],[.1,.14,.1],{r:[-90,0,0]}));
  return q;
},
"👹":()=>{
  const P=[],r="#c0392b",dk="#3b0f0f";
  P.push(E(r,[0,1.1,0],[.62,.7,.45]),E("#d65a4a",[0,1.0,.2],[.46,.5,.3]),E(r,[0,2.0,.05],[.38,.36,.36]));
  mir(s=>{
    P.push(C("#f2e2b3",[s*.22,2.38,0],[.07,.24,.07],{r:[0,0,s*-18]}));
    P.push(E(dk,[s*.16,2.17,.33],[.15,.04,.06],{r:[0,0,s*20],bias:.06}));
    P.push(C("#fff",[s*.1,1.9,.38],[.03,.1,.03],{bias:.05}));
    P.push(lm("k",r,[s*.62,1.55,0],[s*.85,.85,.1],.17),E(r,[s*.85,.78,.12],[.2,.2,.2]));
    P.push(K("#8a2418",[s*.28,.3,0],[.2,.3,.2]),E("#8a2418",[s*.28,.06,.1],[.24,.1,.3]));
  });
  P.push(eyes(2.05,.32,.17,.09,{w:"#ffe27a",p:"#7a0f0f"}));
  P.push(E("#2a0a0a",[0,1.88,.37],[.16,.06,.05],{bias:.04}));
  P.push(K("#7a5230",[.95,1.2,.3],[.07,.7,.07],{r:[0,0,-12]}),E("#7a5230",[1.08,1.95,.3],[.2,.22,.2]));
  [[0,.12],[.14,0],[-.12,0]].forEach(([x,z])=>P.push(C("#cfcfcf",[1.08+x,2.15,.3+z],[.04,.08,.04])));
  return{parts:P};
},
"👺":()=>{
  const P=[],r="#e8542c";
  P.push(E(r,[0,.7,0],[.38,.45,.32]),E(r,[0,1.35,.04],[.38,.35,.35]));
  P.push(eyes(1.42,.34,.16,.085,{w:"#ffe27a",p:"#2b0a05"}));
  P.push(C(r,[0,1.3,.42],[.07,.2,.07],{r:[90,0,0]}));
  P.push(E("#2a0a0a",[0,1.14,.33],[.16,.05,.05],{bias:.05}),E("#fff",[0,1.17,.35],[.12,.025,.03],{bias:.06}));
  mir(s=>{
    P.push(C(r,[s*.42,1.45,0],[.08,.3,.05],{r:[0,0,s*-75]}));
    P.push(C("#3b0f0f",[s*.2,1.72,0],[.05,.14,.05],{r:[0,0,s*-12]}));
    P.push(E("#3b0f0f",[s*.17,1.58,.33],[.13,.035,.05],{r:[0,0,s*22],bias:.06}));
    P.push(lm("k",r,[s*.34,.9,0],[s*.55,.55,.2],.08),K("#b8381a",[s*.14,.15,0],[.09,.2,.09]),E("#b8381a",[s*.14,.02,.1],[.12,.05,.17]));
  });
  P.push(withAn(chain(r,[[0,.5,-.3],[0,.4,-.6],[0,.6,-.85]],.05),RT("y",.4,2.4,0,[0,.5,-.3])));
  P.push(C("#3b0f0f",[0,.68,-.93],[.1,.12,.03],{r:[-70,0,0]}));
  return{parts:P};
},
"👾":()=>{
  const P=[],b="#7c4dff";
  P.push(E(b,[0,.7,0],[.62,.55,.5]),E("#a98bff",[0,.55,.12],[.45,.38,.38]));
  [-.45,0,.45].forEach((x,i)=>{
    const r=i===1?.17:.13,y=i===1?.92:.82;
    P.push(E("#fff",[x,y,.38],[r,r*1.1,r*.8],{bias:.05}),E("#16121f",[x,y-.02,.38+r*.45],[r*.6,r*.7,r*.5],{bias:.08}),E("#fff",[x-r*.15,y+r*.25,.38+r*.8],[r*.2,r*.2,r*.14],{nl:1,bias:.1}));
    P.push(E(b,[x,y+r*.75,.4],[r*1.1,r*.55,r*.9],{bias:.1}));
  });
  P.push(E("#220a40",[0,.5,.46],[.22,.07,.05],{bias:.05}));
  [-.1,.1].forEach(x=>P.push(C("#fff",[x,.53,.47],[.03,.05,.03],{r:[180,0,0],bias:.06})));
  mir(s=>{
    const t=[s*.35,1.65,0];
    P.push(withAn([lm("k","#5a35c4",[s*.2,1.15,0],t,.04),E("#ffe27a",t,[.1,.1,.1])],RT("z",s*.18,2.4,s*1,[s*.2,1.15,0])));
    P.push(K(b,[s*.36,.1,.05],[.12,.14,.12]),E(b,[s*.36,.02,.12],[.16,.06,.2]));
    P.push(E(b,[s*.72,.55,.05],[.14,.18,.14]));
  });
  P.push(K(b,[0,.1,.0],[.12,.14,.12]));
  return{parts:P};
},
"👻":()=>{
  const P=[],g="#dfe7ff";
  P.push(E(g,[0,.95,0],[.55,.7,.5]),C(g,[0,.38,0],[.58,.42,.5]));
  for(let i=0;i<8;i++){const a=i/8*2*PI;P.push(withAn([E(g,[cos(a)*.55,-.02,sin(a)*.48],[.15,.13,.15])],MV("y",.05,3,i)))}
  mir(s=>{
    P.push(E("#111",[s*.22,1.08,.44],[.1,.17,.08],{bias:.06}),E("#ffb6c9",[s*.36,.9,.45],[.09,.06,.04],{bias:.05}));
    P.push(withAn([E(g,[s*.62,.82,.1],[.12,.3,.12],{r:[0,0,s*-30]})],RT("z",s*.25,2,s,[s*.5,1.05,.1])));
  });
  P.push(E("#111",[0,.76,.47],[.1,.13,.06],{bias:.06}));
  return{parts:P,fl:.1};
},
"🦣":()=>{
  const q=quad({c:"#6b4a35",b:"#8a6448",bw:.72,bh:.72,bl:.95,leg:.55,lr:.22,hd:.52,sn:0,ear:null,tail:"short",hz:1.0,hy:1.35,pc:"#4a301f"}),m=q.m,P=q.parts,hd=m.hd;
  P.push(E("#4a301f",[0,m.by+m.bh*.85,.15],[.62,.28,.75]),E("#4a301f",[0,m.hy+hd*.75,m.hz-.05],[.36,.2,.36]));
  mir(s=>{
    P.push(E("#7a573f",[s*.62,m.hy,m.hz-.15],[.07,.38,.32],{r:[0,s*-15,0]}));
    P.push(chain("#f2e6c8",[[s*.22,m.hy-.35,m.hz+.4],[s*.4,m.hy-.62,m.hz+.78],[s*.48,m.hy-.5,m.hz+1.18],[s*.38,m.hy-.15,m.hz+1.42]],[.07,.06,.045,.025]));
  });
  P.push(chain("#6b4a35",[[0,m.hy-.25,m.hz+.45],[0,m.hy-.62,m.hz+.62],[0,m.hy-1.0,m.hz+.62],[0,m.hy-1.25,m.hz+.45]],[.17,.15,.12,.09]));
  P.push(eyes(m.hy+.08,m.hz+.42,.22,.07));
  return q;
},
"🐍":()=>{
  const P=[],N=40,g="#5aa33a",pts=[],rad=[];
  for(let i=0;i<N;i++){
    const t=i/(N-1),a=PI/2-(1-t)*2.0*2*PI,rr=1.0*(1-t*.78)+.04;
    pts.push([rr*cos(a),.16+t*t*1.15,rr*sin(a)]);
    rad.push(.05+.1*sqrt(t)+.04*sin(t*PI));
  }
  P.push(chain(g,pts,rad));
  for(let i=2;i<N-3;i+=3){const p=pts[i],r=rad[i];P.push(E("#2f6b22",[p[0],p[1]+r*.85,p[2]],[r*.7,r*.35,r*.7],{bias:.03}))}
  const L=pts[N-1],hy=L[1]+.02,hz=L[2]+.04,h=[];
  h.push(E(g,[0,hy+.06,hz+.04],[.22,.18,.28]),E("#b7e08a",[0,hy-.03,hz+.1],[.19,.11,.24]));
  h.push(eyes(hy+.12,hz+.19,.13,.06,{w:"#ffe27a",p:"#16121f"}));
  h.push(lm("k","#e23b4e",[0,hy-.02,hz+.3],[0,hy-.02,hz+.52],.014),lm("k","#e23b4e",[0,hy-.02,hz+.52],[.05,hy-.02,hz+.62],.011),lm("k","#e23b4e",[0,hy-.02,hz+.52],[-.05,hy-.02,hz+.62],.011));
  P.push(withAn(h,RT("y",.22,1.6,0,[0,hy-.2,hz])));
  return{parts:P};
},
"🐉":()=>{
  const P=[],g="#2f8f6a";
  P.push(E(g,[0,.62,0],[.78,.5,.72]),E("#a5d9a0",[0,.5,.15],[.6,.38,.55]));
  mir(s=>[1,-1].forEach(z=>P.push(K("#237a58",[s*.5,.18,z*.4],[.15,.2,.15]))));
  for(let i=0;i<5;i++)P.push(C("#f2e2b3",[0,topY({by:.62,bh:.5,bw:.78,bl:.72},0,.5-i*.28)+.03,.5-i*.28],[.07,.15,.07]));
  P.push(withAn(chain(g,[[0,.55,-.7],[0,.5,-1.15],[0,.45,-1.55]],[.25,.16,.07]),RT("y",.3,1.8,0,[0,.55,-.7])));
  [[-.42,2.2,.55,"#ff4d4d",0],[0,2.45,.5,"#ffe27a",1.3],[.42,2.2,.55,"#ff4d4d",2.4]].forEach(([x,hy,hz,ec,ph],i)=>{
    const base=[x*.6,.9,.1],pts=[base,[x*.9,1.25,.2],[x*1.1,1.65,.3],[x,hy-.15,hz-.1]];
    const nk=chain(g,pts,[.17,.14,.12,.12]),hd=[E(g,[x,hy,hz],[.24,.2,.3]),E("#a5d9a0",[x,hy-.08,hz+.1],[.2,.12,.26]),eyes(hy+.07,hz+.2,.13,.06,{w:ec,p:"#16121f"}),
      E("#2a0a0a",[x,hy-.12,hz+.3],[.1,.03,.04],{bias:.05}),C("#f2e2b3",[x+.12,hy+.2,hz-.08],[.04,.14,.04],{r:[-20,0,-12]}),C("#f2e2b3",[x-.12,hy+.2,hz-.08],[.04,.14,.04],{r:[-20,0,12]})];
    P.push(withAn([nk,hd],RT("z",.1,1.5+i*.3,ph,[x*.6,.9,.1])));
  });
  return{parts:P};
}
};

/* ---------- مجسّمات الحرب (دبابة / جندي / فرقة / حصن) ---------- */
function tank(col){
  const dk=shade(col,.7);
  return[
    mir(s=>[B("#2a2a2e",[s*.38,.12,0],[.1,.12,.5]),E("#3a3a40",[s*.38,.1,.47],[.1,.1,.1]),E("#3a3a40",[s*.38,.1,-.47],[.1,.1,.1])]),
    B(col,[0,.2,0],[.31,.1,.46]),B(col,[0,.19,.5],[.3,.06,.1],{r:[-28,0,0]}),
    B("#ffffff",[0,.305,.2],[.2,.012,.05],{bias:.02}),
    K(dk,[0,.38,-.06],[.2,.07,.2]),E(dk,[0,.44,-.06],[.14,.05,.14]),
    lm("k","#1c1c21",[0,.4,.08],[0,.4,.66],.035),E("#1c1c21",[0,.4,.67],[.05,.05,.05])
  ];
}
function soldier(col){
  const kh="#5b6b3b";
  return[
    mir(s=>[K("#46532c",[s*.07,.12,0],[.045,.12,.045]),E("#2b2b2b",[s*.07,.02,.03],[.055,.03,.08])]),
    E(kh,[0,.33,0],[.13,.15,.09]),B(col,[0,.34,-.1],[.09,.1,.03]),
    mir(s=>lm("k",kh,[s*.15,.42,0],[s*.1,.3,.12],.035)),
    E("#e6b98f",[0,.56,.01],[.075,.08,.075]),E("#3d4a2a",[0,.6,0],[.095,.065,.095]),E(col,[0,.64,.02],[.05,.02,.06],{bias:.02}),
    lm("k","#222",[.1,.3,.02],[.1,.34,.42],.017)
  ];
}
function squadModel(col){
  const P=[];
  [[-.82,.5],[0,.72],[.82,.5]].forEach(([x,z])=>P.push(place(tank(col),x,0,z,0,1)));
  [-.55,0,.55].forEach(x=>P.push(place(soldier(col),x,0,-.85,0,1.15)));
  return{parts:P};
}
function fortModel(col){
  const P=[],st="#b0a58b";
  P.push(B("#7f7456",[0,.02,0],[1.8,.03,1.8],{bias:-6}),B("#8c8062",[0,.05,0],[1.45,.02,1.45],{bias:-5}));
  [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx,sz])=>P.push(place(tank(col),sx*1.2,.04,sz*1.2,Math.atan2(sx,sz)/D2R,.82)));
  P.push(K("#9a8f78",[0,.55,0],[.52,.5,.52]),K(st,[0,1.07,0],[.62,.05,.62]),B("#4a3f2a",[0,.22,.52],[.14,.2,.04]));
  for(let i=0;i<8;i++){const a=i/8*2*PI;P.push(B(st,[cos(a)*.56,1.18,sin(a)*.56],[.1,.08,.1],{r:[0,-a/D2R,0]}))}
  P.push(lm("k","#ddd",[0,1.1,0],[0,2.0,0],.02),B(col,[.19,1.88,0],[.19,.11,.015]));
  [45,135,225,315].forEach(a=>{const r=a*D2R;P.push(place(soldier(col),sin(r)*.3,1.12,cos(r)*.3,a,.78))});
  return{parts:P};
}
REG["war:squad"]=squadModel;REG["war:fort"]=fortModel;

/* ---------- بناء + تطبيع المجسّم ---------- */
const NL=14,TOP=1.12,MODELS={};
function hexRgb(h){h=h.replace("#","");if(h.length===3)h=h.split("").map(x=>x+x).join("");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function build(key){
  if(MODELS[key]!==undefined)return MODELS[key];
  const kp=key.split("@"),fn=REG[kp[0]];if(!fn)return MODELS[key]=null;
  let spec;try{spec=fn(kp[1]?"#"+kp[1]:undefined)}catch(e){console.warn("A3D build",key,e);return MODELS[key]=null}
  const parts=(spec.parts||spec).flat(Infinity).filter(Boolean);
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],gy=1e9;
  parts.forEach(P=>{const rho=max(P.s[0],P.s[1],P.s[2]);for(let i=0;i<3;i++){mn[i]=min(mn[i],P.p[i]-rho);mx[i]=max(mx[i],P.p[i]+rho)}gy=min(gy,P.p[1]-((P.r||P.Rm)?rho:P.s[1]))});
  const ext=max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]),c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
  let Rh=0,Hy=0;
  parts.forEach(P=>{const rho=max(P.s[0],P.s[1],P.s[2]);Rh=max(Rh,Math.hypot(P.p[0]-c[0],P.p[2]-c[2])+rho);Hy=max(Hy,abs(P.p[1]-c[1])+rho)});
  const S=.97/max(Rh,Hy+.2*Rh);
  let VC=0,FC=0;
  parts.forEach(P=>{
    const th=P.t==="e"?max(P.s[0],P.s[1],P.s[2]):max(P.s[0],P.s[2]),rel=th/ext,q=rel>.14?0:rel>.05?1:2;
    P.mesh=getMesh(P.t,q);P.vo=VC;VC+=P.mesh.v.length/3;FC+=P.mesh.f.length/3;
    P.p=[(P.p[0]-c[0])*S,(P.p[1]-c[1])*S,(P.p[2]-c[2])*S];P.s=[P.s[0]*S,P.s[1]*S,P.s[2]*S];
    P.R=P.Rm||eul.apply(null,P.r||[0,0,0]);
    if(P.an){const a=Object.assign({},P.an);if(a.pv)a.pv=[(a.pv[0]-c[0])*S,(a.pv[1]-c[1])*S,(a.pv[2]-c[2])*S];if(a.k==="mov")a.amp*=S;P.an=a}
    const rgb=hexRgb(P.c);P.pal=[];for(let l=0;l<NL;l++){const f=l/(NL-1)*TOP;P.pal.push("rgb("+min(255,rgb[0]*f|0)+","+min(255,rgb[1]*f|0)+","+min(255,rgb[2]*f|0)+")")}
    P.bias=P.bias||0;
  });
  const m={parts,VC,FC,gy:(gy-c[1])*S,wob:spec.wob||0,fl:spec.fl||0};
  m.X=new Float32Array(VC);m.Y=new Float32Array(VC);m.Z=new Float32Array(VC);m.SX=new Float32Array(VC);m.SY=new Float32Array(VC);
  m.fa=new Int32Array(FC);m.fb=new Int32Array(FC);m.fc=new Int32Array(FC);m.fp=new Int16Array(FC);m.dep=new Float32Array(FC);m.lv=new Uint8Array(FC);
  let fi=0;parts.forEach((P,pi)=>{const f=P.mesh.f;for(let i=0;i<f.length;i+=3){m.fa[fi]=f[i]+P.vo;m.fb[fi]=f[i+1]+P.vo;m.fc[fi]=f[i+2]+P.vo;m.fp[fi]=pi;fi++}});
  m.vis=[];
  return MODELS[key]=m;
}

/* ---------- الرسم ---------- */
const CD=5,LX=-.42,LY=.72,LZ=.55,LL=sqrt(LX*LX+LY*LY+LZ*LZ),lx=LX/LL,ly=LY/LL,lz=LZ/LL;
function frame(st,o){
  const m=st.m,cv=st.cv,ctx=st.ctx,W=cv.width,H=cv.height,R=min(W,H)/2*(o.zoom||1),cx=W/2,cy=H/2;
  const t=o.t,yaw=o.yaw,pitch=o.pitch,roll=o.roll||0;
  const G=mul(rotX(pitch),mul(rotZ(roll),rotY(yaw)));
  const gt=mv(G,[0,o.dy||0,0]);
  ctx.clearRect(0,0,W,H);
  // ظل أرضي
  const gyS=cy-m.gy*cos(pitch)*R*.97,hopK=1-min(.5,(o.dy||0)*1.4);
  if(!o.noshadow){ctx.save();ctx.translate(cx,gyS);ctx.scale(1,.2);
  const gr=ctx.createRadialGradient(0,0,0,0,0,R*.62*hopK);gr.addColorStop(0,"rgba(0,0,0,.38)");gr.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,R*.62*hopK,0,2*PI);ctx.fill();ctx.restore()}
  const blink=!o.noblink&&(t%4.3)<.13;
  const X=m.X,Y=m.Y,Z=m.Z,SX=m.SX,SY=m.SY;
  for(let pi=0;pi<m.parts.length;pi++){
    const P=m.parts[pi];let Rm=P.R,tx=P.p[0],ty=P.p[1],tz=P.p[2],s0=P.s[0],s1=P.s[1],s2=P.s[2];
    const an=P.an;
    if(an&&!o.still){
      const ang=an.amp*sin(t*an.spd+an.ph);
      if(an.k==="rot"){const Ra=axM(an.ax,ang);Rm=mul(Ra,Rm);const q=mv(Ra,[tx-an.pv[0],ty-an.pv[1],tz-an.pv[2]]);tx=q[0]+an.pv[0];ty=q[1]+an.pv[1];tz=q[2]+an.pv[2]}
      else{if(an.ax==="x")tx+=ang;else if(an.ax==="y")ty+=ang;else tz+=ang}
    }
    if(P.bl&&blink)s1*=.12;
    const GR=mul(G,Rm),T=mv(G,[tx,ty,tz]),Tx=T[0]+gt[0],Ty=T[1]+gt[1],Tz=T[2]+gt[2];
    const a00=GR[0]*s0,a01=GR[1]*s1,a02=GR[2]*s2,a10=GR[3]*s0,a11=GR[4]*s1,a12=GR[5]*s2,a20=GR[6]*s0,a21=GR[7]*s1,a22=GR[8]*s2;
    const v=P.mesh.v,n=v.length/3;let o3=0,vi=P.vo;
    for(let i=0;i<n;i++,o3+=3,vi++){
      const vx=v[o3],vy=v[o3+1],vz=v[o3+2];
      const x=a00*vx+a01*vy+a02*vz+Tx,y=a10*vx+a11*vy+a12*vz+Ty,z=a20*vx+a21*vy+a22*vz+Tz;
      X[vi]=x;Y[vi]=y;Z[vi]=z;const k=CD/(CD-z);SX[vi]=cx+x*k*R;SY[vi]=cy-y*k*R;
    }
  }
  const vis=m.vis;vis.length=0;const fa=m.fa,fb=m.fb,fc=m.fc,fp=m.fp,dep=m.dep,lv=m.lv,parts=m.parts;
  for(let f=0;f<m.FC;f++){
    const a=fa[f],b=fb[f],c=fc[f];
    const ux=X[b]-X[a],uy=Y[b]-Y[a],uz=Z[b]-Z[a],wx=X[c]-X[a],wy=Y[c]-Y[a],wz=Z[c]-Z[a];
    const nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;
    if(-X[a]*nx-Y[a]*ny+(CD-Z[a])*nz<=0)continue;
    const P=parts[fp[f]];
    if(P.nl)lv[f]=NL-1;else{
      const nl=sqrt(nx*nx+ny*ny+nz*nz)||1,d=(nx*lx+ny*ly+nz*lz)/nl,I=.36+.76*(d>0?d:0)+.1*(nz/nl);
      lv[f]=min(NL-1,max(0,Math.round(I/TOP*(NL-1))));
    }
    dep[f]=(Z[a]+Z[b]+Z[c])/3+P.bias;vis.push(f);
  }
  vis.sort((p,q)=>dep[p]-dep[q]);
  ctx.lineJoin="round";ctx.lineWidth=Math.max(.7,W/260);
  for(let i=0;i<vis.length;i++){
    const f=vis[i],col=parts[fp[f]].pal[lv[f]];
    ctx.beginPath();ctx.moveTo(SX[fa[f]],SY[fa[f]]);ctx.lineTo(SX[fb[f]],SY[fb[f]]);ctx.lineTo(SX[fc[f]],SY[fc[f]]);ctx.closePath();
    ctx.fillStyle=col;ctx.strokeStyle=col;ctx.fill();ctx.stroke();
  }
}

/* ---------- التشغيل على صفحة ---------- */
const live=new Set(),SPR={};let raf=0,last=0;
function size(st){
  const cv=st.cv,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return false;
  const dpr=min(2,window.devicePixelRatio||1),W=Math.round(w*dpr),H=Math.round(h*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  return true;
}
function tick(now){
  raf=requestAnimationFrame(tick);
  if(document.hidden||now-last<32)return;last=now;
  if(!live.size){cancelAnimationFrame(raf);raf=0;return}
  live.forEach(st=>{
    const cv=st.cv;if(!cv.isConnected){live.delete(st);return}
    const r=cv.getBoundingClientRect();if(r.width===0||r.bottom<0||r.top>innerHeight)return;
    if(!size(st))return;
    const dt=st.last?min(.1,(now-st.last)/1000):.033;st.last=now;
    st.tt+=dt*(st.tired?.4:1);
    if(!st.drag){st.yo+=st.vy;st.vy*=.92;st.yo=((st.yo+PI)%(2*PI)+2*PI)%(2*PI)-PI;st.yo*=.985}
    if(st.jump>0)st.jump=max(0,st.jump-dt/.6);
    const t=st.tt,m=st.m;
    let dy=0,yaw,roll=0,pitch=.22;
    if(st.dead){yaw=.35+st.yo;roll=1.45;dy=-.02}
    else{
      yaw=.45+sin(t*.6)*.75+st.yo;
      dy=sin(t*2)*(m.fl||.018)+(m.fl?.06:0)+sin(st.jump*PI)*.28;
      if(m.wob)roll=sin(t*2.4)*.12*(sin(t*.7)>.2?1:.25);
      if(st.tired)pitch=.3;
    }
    frame(st,{t,yaw,pitch,roll,dy,still:st.dead});
  });
}
function init(cv){
  cv.setAttribute("data-m","1");
  const m=build(cv.getAttribute("data-k"));if(!m)return;
  const st={cv,ctx:cv.getContext("2d"),m,tt:Math.random()*5,yo:0,vy:0,drag:false,jump:0,last:0,tired:cv.getAttribute("data-t")==="1",dead:cv.getAttribute("data-d")==="1",lx:0,moved:0};
  if(!st.ctx)return;
  cv.addEventListener("pointerdown",e=>{st.drag=true;st.lx=e.clientX;st.moved=0;st.vy=0;try{cv.setPointerCapture(e.pointerId)}catch(_){}});
  cv.addEventListener("pointermove",e=>{if(!st.drag)return;const dx=e.clientX-st.lx;st.lx=e.clientX;st.moved+=abs(dx);st.yo+=dx*.012;st.vy=dx*.012});
  const up=()=>{if(!st.drag)return;st.drag=false;if(st.moved<6&&!st.dead)st.jump=1};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",()=>{st.drag=false});
  live.add(st);if(!raf)raf=requestAnimationFrame(tick);
}
let scanT=0;
function scan(){scanT=0;document.querySelectorAll("canvas.a3d:not([data-m])").forEach(init)}
function schedule(){if(!scanT)scanT=setTimeout(scan,30)}
const css=document.createElement("style");
css.textContent="canvas.a3d{width:1.2em;height:1.2em;display:block;touch-action:pan-y;cursor:grab;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}.wd-mon canvas.a3d{width:1.55em;height:1.55em;margin:0 auto}";
document.head.appendChild(css);
if(window.MutationObserver)new MutationObserver(ms=>{for(const x of ms)if(x.addedNodes.length){schedule();break}}).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule);else schedule();

window.A3D={
  has:k=>!!REG[String(k||"").replace(/\uFE0F/g,"")],
  html(k,o){
    k=String(k||"").replace(/\uFE0F/g,"");o=o||{};
    if(!REG[k])return k;
    return'<canvas class="a3d" data-k="'+k+'" data-t="'+(o.tired?1:0)+'" data-d="'+(o.dead?1:0)+'" role="img" aria-label="'+k+'">'+k+'</canvas>';
  },
  keys:()=>Object.keys(REG),
  // بيرجّع الـ canvas القديم مكان الجديد بعد إعادة رسم الصفحة (من غير وميض)
  reuse(old,root){
    root.querySelectorAll("canvas.a3d:not([data-m])").forEach(n=>{
      const i=old.findIndex(o=>o.getAttribute("data-k")===n.getAttribute("data-k")&&o.getAttribute("data-t")===n.getAttribute("data-t")&&o.getAttribute("data-d")===n.getAttribute("data-d"));
      if(i>-1){n.replaceWith(old[i]);old.splice(i,1)}
    });
  },
  // صورة PNG شفافة لمجسّم (للخرائط): A3D.sprite("war:fort@ff8800",{yaw,pitch,zoom,size})
  sprite(key,o){
    o=o||{};const size=o.size||160,ck=key+"|"+(o.yaw||0).toFixed(3)+"|"+(o.pitch!=null?o.pitch:.8)+"|"+(o.zoom||1)+"|"+size;
    if(SPR[ck]!==undefined)return SPR[ck];
    const m=build(key);if(!m)return SPR[ck]="";
    try{
      const cv=document.createElement("canvas");cv.width=cv.height=size;
      frame({cv,ctx:cv.getContext("2d"),m},{t:0,yaw:o.yaw||0,pitch:o.pitch!=null?o.pitch:.8,roll:0,dy:0,noblink:true,still:true,zoom:o.zoom||1,noshadow:!!o.noshadow});
      return SPR[ck]=cv.toDataURL("image/png");
    }catch(e){return SPR[ck]=""}
  },
  // للاختبار: رسم لقطة ثابتة
  snap(cv,k,o){o=o||{};const m=build(k);if(!m)return false;const st={cv,ctx:cv.getContext("2d"),m};
    frame(st,{t:o.t||0,yaw:o.yaw!=null?o.yaw:.5,pitch:o.pitch!=null?o.pitch:.22,roll:o.roll||0,dy:0,noblink:true,zoom:o.zoom});return true}
};
})();
