// ===== محرك CPM (مختبَر) =====
function scheduleTasks(tasks,projectStartStr){
  const WE=new Set([5,6]);const isWD=d=>!WE.has(d.getDay());const clone=d=>new Date(d.getTime());
  const ensureWD=d=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const nextWD=d=>{d=clone(d);d.setDate(d.getDate()+1);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const addWD=(d,n)=>{d=ensureWD(d);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const subWD=(d,n)=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()-1);let c=0;while(c<n){d.setDate(d.getDate()-1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=clone(a),e=clone(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=clone(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const map={};tasks.forEach(t=>map[t.id]=t);
  const indeg={},adj={};tasks.forEach(t=>{indeg[t.id]=0;adj[t.id]=[];});
  tasks.forEach(t=>(t.deps||[]).forEach(d=>{if(map[d]){adj[d].push(t.id);indeg[t.id]++;}}));
  const q=tasks.filter(t=>indeg[t.id]===0).map(t=>t.id),order=[];
  while(q.length){const id=q.shift();order.push(id);adj[id].forEach(n=>{if(--indeg[n]===0)q.push(n);});}
  const hasCycle=order.length!==tasks.length;const seq=hasCycle?tasks.map(t=>t.id):order;
  const start=new Date(projectStartStr+'T00:00:00');const R={},warnings=[];
  seq.forEach(id=>{const t=map[id];const deps=(t.deps||[]).filter(d=>map[d]);let ES;
    if(t.type==='fixed'&&t.fixedDate){ES=ensureWD(new Date(t.fixedDate+'T00:00:00'));}
    else if(t.type==='milestone'){let mx=null;deps.forEach(d=>{const ef=R[d]?R[d].EF:start;if(mx===null||ef>mx)mx=ef;});ES=ensureWD(mx||start);}
    else if(deps.length===0)ES=addWD(start,t.lag||0);
    else{let mx=null;deps.forEach(d=>{const ef=R[d]?R[d].EF:start;if(mx===null||ef>mx)mx=ef;});
      const zero=(t.duration||0)<=0; // مهمة بمدة 0: تلتصق بنهاية سابقتها ولا تستهلك يومًا
      ES=zero?ensureWD(mx||start):addWD(nextWD(mx),t.lag||0);}
    const dur=t.type==='milestone'?0:(t.type==='cont'?null:((t.duration||0)<=0?0:Math.max(1,t.duration)));let EF;
    if(t.type==='milestone'||t.type==='cont'||dur===0)EF=clone(ES);else EF=addWD(ES,dur-1);
    R[id]={ES,EF,dur};});
  let pEnd=start;tasks.forEach(t=>{if(t.type!=='cont'&&R[t.id].EF>pEnd)pEnd=R[t.id].EF;});
  tasks.forEach(t=>{if(t.type==='cont')R[t.id].EF=clone(pEnd);});
  seq.slice().reverse().forEach(id=>{const t=map[id];const succ=tasks.filter(s=>(s.deps||[]).includes(id));let LF;
    if(succ.length===0)LF=clone(pEnd);else{let mn=null;succ.forEach(s=>{const ls=R[s.id].LS;if(mn===null||ls<mn)mn=ls;});LF=clone(mn);}
    const dur=R[id].dur;let LS;if(t.type==='milestone')LS=clone(LF);else if(t.type==='cont')LS=clone(R[id].ES);else LS=subWD(LF,Math.max(1,dur)-1);
    R[id].LF=LF;R[id].LS=LS;let slack=wdB(R[id].ES,LS);if(t.type==='fixed')slack=0;R[id].slack=slack;R[id].critical=(t.type!=='cont')&&slack<=0;});
  if(hasCycle)warnings.push('تحذير: توجد تبعية دائرية — الجدولة غير دقيقة.');
  return {R,pStart:start,pEnd,hasCycle,warnings,totalWD:wdB(start,pEnd)+1};
}
// ===== المتابعة =====
function computeTracking(tasks,S,ddStr){
  const WE=new Set([5,6]),isWD=d=>!WE.has(d.getDay());
  const addWD=(d,n)=>{d=new Date(d.getTime());while(!isWD(d))d.setDate(d.getDate()+1);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=new Date(a),e=new Date(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=new Date(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const dd=D(ddStr),T={};
  tasks.forEach(t=>{const r=S.R[t.id];let blocked=false,co=false,ao=false;
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
  return T;
}
