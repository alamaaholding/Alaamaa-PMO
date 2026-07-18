// تقويم العمل: الجمعة/السبت + العطلات الرسمية (تُحمَّل من القاعدة)
let HOLIDAYS=new Set();
function setHolidays(list){HOLIDAYS=new Set((list||[]).map(h=>typeof h==='string'?h:h.hdate));}
function isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isWorkday(d){const g=d.getDay();return g!==5&&g!==6&&!HOLIDAYS.has(isoLocal(d));}
// عدّاد أيام العمل بين تاريخين (شامل الطرفين)
function wdBetween(a,b){let c=0,d=new Date(a);const e=new Date(b);
  while(d<=e){if(isWorkday(d))c++;d=new Date(d.getTime()+86400000);}return c;}
// ===== محرك CPM (مختبَر) =====
function scheduleTasks(tasks,projectStartStr){
  const isWD=isWorkday;const clone=d=>new Date(d.getTime());
  const ensureWD=d=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const nextWD=d=>{d=clone(d);d.setDate(d.getDate()+1);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const addWD=(d,n)=>{d=ensureWD(d);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const subWD=(d,n)=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()-1);let c=0;while(c<n){d.setDate(d.getDate()-1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=clone(a),e=clone(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=clone(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const _pkgSet=new Set(tasks.filter(t=>t.type==='package').map(t=>t.id));
  const _leafs=tasks.filter(t=>t.type!=='package');
  const map={};_leafs.forEach(t=>map[t.id]=t);
  const indeg={},adj={};_leafs.forEach(t=>{indeg[t.id]=0;adj[t.id]=[];});
  _leafs.forEach(t=>(t.deps||[]).forEach(d=>{if(map[d]){adj[d].push(t.id);indeg[t.id]++;}}));
  const q=_leafs.filter(t=>indeg[t.id]===0).map(t=>t.id),order=[];
  while(q.length){const id=q.shift();order.push(id);adj[id].forEach(n=>{if(--indeg[n]===0)q.push(n);});}
  const hasCycle=order.length!==_leafs.length;const seq=hasCycle?_leafs.map(t=>t.id):order;
  const start=new Date(projectStartStr+'T00:00:00');const R={},warnings=[];
  seq.forEach(id=>{const t=map[id];const deps=(t.deps||[]).filter(d=>map[d]);let ES;
    if(t.type==='fixed'&&t.fixedDate){ES=ensureWD(new Date(t.fixedDate+'T00:00:00'));}
    else if(t.type==='milestone'){let mx=null;deps.forEach(d=>{const ef=R[d]?R[d].EF:start;if(mx===null||ef>mx)mx=ef;});ES=ensureWD(mx||start);}
    else if(deps.length===0)ES=addWD(start,t.lag||0);
    else{
      const zero=(t.duration||0)<=0;
      const durW=t.type==='milestone'?0:Math.max(zero?0:1,t.duration||1);
      const lagAdd=(base,L)=>L>=0?addWD(base,L):subWD(base,-L);
      const dx=(t.depsX&&t.depsX.length)?t.depsX:deps.map(d=>({ref:d,type:'FS',lag:0}));
      let cand=null;
      dx.forEach(x=>{if(!R[x.ref])return;const rp=R[x.ref];let c;
        if(x.type==='SS')c=lagAdd(ensureWD(rp.ES),x.lag||0);
        else if(x.type==='FF'){const fe=lagAdd(ensureWD(rp.EF),x.lag||0);c=durW>0?subWD(fe,durW-1):ensureWD(fe);}
        else c=zero?lagAdd(ensureWD(rp.EF),x.lag||0):lagAdd(nextWD(rp.EF),x.lag||0); // FS
        if(cand===null||c>cand)cand=c;});
      ES=ensureWD(cand||start);
      if(t.lag)ES=addWD(ES,t.lag); // إزاحة البند العامة (توافق قديم)
    }
    const dur=t.type==='milestone'?0:(t.type==='cont'?null:((t.duration||0)<=0?0:Math.max(1,t.duration)));let EF;
    if(t.type==='milestone'||t.type==='cont'||dur===0)EF=clone(ES);else EF=addWD(ES,dur-1);
    R[id]={ES,EF,dur};});
  let pEnd=start;_leafs.forEach(t=>{if(t.type!=='cont'&&R[t.id].EF>pEnd)pEnd=R[t.id].EF;});
  _leafs.forEach(t=>{if(t.type==='cont')R[t.id].EF=clone(pEnd);});
  seq.slice().reverse().forEach(id=>{const t=map[id];const succ=_leafs.filter(s=>(s.deps||[]).includes(id));let LF;
    if(succ.length===0)LF=clone(pEnd);else{let mn=null;succ.forEach(s=>{const ls=R[s.id].LS;if(mn===null||ls<mn)mn=ls;});LF=clone(mn);}
    const dur=R[id].dur;let LS;if(t.type==='milestone')LS=clone(LF);else if(t.type==='cont')LS=clone(R[id].ES);else LS=subWD(LF,Math.max(1,dur)-1);
    R[id].LF=LF;R[id].LS=LS;let slack=wdB(R[id].ES,LS);if(t.type==='fixed')slack=0;R[id].slack=slack;R[id].critical=(t.type!=='cont')&&slack<=0;});
  // اشتقاق حزم العمل: البداية=أبكر ابن، النهاية=أقصى ابن، حرجة إن كان ابن حرجًا
  const _kids={};tasks.forEach(t=>{if(t.parent)( _kids[t.parent]=_kids[t.parent]||[] ).push(t.id);});
  let _pending=tasks.filter(t=>t.type==='package');let _g=0;
  while(_pending.length&&_g++<8){
    const _rest=[];
    _pending.forEach(p=>{
      const all=_kids[p.id]||[];
      const ready=all.filter(id=>R[id]);
      if(all.length&&ready.length===all.length){
        let es=null,ef=null,crit=false,slk=null;
        ready.forEach(id=>{const r=R[id];
          if(es===null||r.ES<es)es=r.ES;if(ef===null||r.EF>ef)ef=r.EF;
          if(r.critical)crit=true;if(slk===null||r.slack<slk)slk=r.slack;});
        R[p.id]={ES:clone(es),EF:clone(ef),dur:wdB(es,ef)+1,LS:clone(es),LF:clone(ef),
          slack:slk==null?0:slk,critical:crit,pkg:true};
      }else if(all.length){_rest.push(p);}
      else{R[p.id]={ES:clone(start),EF:clone(start),dur:0,LS:clone(start),LF:clone(start),slack:0,critical:false,pkg:true,empty:true};}
    });
    _pending=_rest;
  }
  if(hasCycle)warnings.push('تحذير: توجد تبعية دائرية — الجدولة غير دقيقة.');
  return {R,pStart:start,pEnd,hasCycle,warnings,totalWD:wdB(start,pEnd)+1};
}
// ===== المتابعة =====
function computeTracking(tasks,S,ddStr){
  const isWD=isWorkday;
  const addWD=(d,n)=>{d=new Date(d.getTime());while(!isWD(d))d.setDate(d.getDate()+1);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=new Date(a),e=new Date(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=new Date(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const dd=D(ddStr),T={};
  const _leafs=tasks.filter(t=>t.type!=='package');
  _leafs.forEach(t=>{const r=S.R[t.id];let blocked=false,co=false,ao=false;
    (t.requirements||[]).forEach(req=>{let st;
      if(req.received){st='received';if(req.requested){const due=addWD(D(req.requested),req.sla||0);if(D(req.received)>due)st='latejust';}}
      else if(req.requested){const due=addWD(D(req.requested),req.sla||0);if(dd>due){st='overdue';req._late=wdB(due,dd);}else st='pending';}
      else st='notrequested';req._state=st;
      const unmet=(st!=='received'&&st!=='latejust');if(req.blocking&&unmet)blocked=true;
      if(st==='overdue'&&req.blocking){if(req.owner==='client')co=true;else ao=true;}});
    let delay=null;if(t.status!=='done'){if(co)delay='client';else if(ao)delay='alamah';
      else if(!blocked&&r){if(t.status==='notstarted'&&dd>r.ES)delay='alamah';else if(t.status==='inprogress'&&dd>r.EF)delay='alamah';}}
    let eff=t.status;if(blocked&&t.status!=='done')eff='blocked';
    else if(t.status==='notstarted'&&r&&dd>=r.ES)eff='inprogress'; // بدء تلقائي عند حلول الموعد
    // التقدّم التلقائي: أيام العمل المنقضية من مدة البند (سقف 90% حتى الإنجاز اليدوي)
    let auto=0;
    if(t.status==='done')auto=100;
    else if(t.type!=='milestone'&&t.type!=='cont'&&r&&dd>r.ES){
      const tot=Math.max(1,wdB(r.ES,r.EF));
      auto=Math.min(90,Math.round(wdB(r.ES,(dd<r.EF?dd:r.EF))/tot*100));
      if(auto<0)auto=0;
    }
    const disp=t.status==='done'?100:Math.max(auto,t.progress||0);
    T[t.id]={blocked,delay,effStatus:eff,autoPct:auto,dispPct:disp};});
  // اشتقاق حالة/تقدّم الحزم من أبنائها (موزونًا بالمدد)
  const _kids={};tasks.forEach(t=>{if(t.parent)(_kids[t.parent]=_kids[t.parent]||[]).push(t);});
  let _pend=tasks.filter(t=>t.type==='package');let _g=0;
  while(_pend.length&&_g++<8){
    const _rest=[];
    _pend.forEach(p=>{
      const ch=_kids[p.id]||[];
      if(ch.length&&ch.every(c=>T[c.id])){
        let ws=0,acc=0,blocked=false,anyStart=false,allDone=true,dl=null;
        ch.forEach(c=>{const k=T[c.id];const w=Math.max(1,(S.R[c.id]&&S.R[c.id].dur)||c.duration||1);
          ws+=w;acc+=(k.dispPct||0)*w;
          if(k.blocked)blocked=true;
          if(k.effStatus==='inprogress'||k.effStatus==='done')anyStart=true;
          if(k.effStatus!=='done')allDone=false;
          if(k.delay==='client')dl='client';else if(k.delay&&dl!=='client')dl=k.delay;});
        const pct=ws?Math.round(acc/ws):0;
        const eff=allDone?'done':(blocked?'blocked':(anyStart?'inprogress':'notstarted'));
        T[p.id]={blocked,delay:dl,effStatus:eff,autoPct:pct,dispPct:pct,pkg:true};
      }else if(ch.length){_rest.push(p);}
      else{T[p.id]={blocked:false,delay:null,effStatus:'notstarted',autoPct:0,dispPct:0,pkg:true};}
    });
    _pend=_rest;
  }
  return T;
}
