// pgantt.js — جانت المحفظة التكاملي التفاعلي (المرحلة 4)
// يعرض كل المشاريع النشطة في خط زمني واحد. نقرة على مشروع تدخله.
// يعتمد: $, esc, TRACKS, scheduleTasks, fetchPortfolioTimeline, fetchAllProjectsTasks, loadProject, render

const PHASE_NAMES={'0':'التأسيس','A':'التنفيذ','B':'الذكاء','C':'الاستراتيجية'};
const PG_PALETTE=['#8A8071','#4A6B8A','#A67F4E','#6B8E6B','#8A5E7A','#5E8A8A','#8A6B4A','#4B3F72'];
// مرحلة كل بند تُشتق من هرمية WBS الفعلية (parent الحقيقي)، لا من عمود track الخام —
// نفس الإصلاح الذاتي المطبَّق في loadProject، لتفادي انحراف مطابق (راجع taskTopAncestor).
function pgDerivePhases(T,registryMap){
  const byRef={};T.forEach(t=>{byRef[t.id]=t;});
  T.forEach(t=>{t.track=taskTopAncestor(t,byRef);});
  const out={};let pi=0;
  T.forEach(t=>{
    if(out[t.track])return;
    const reg=registryMap&&registryMap[t.track];
    const top=byRef[t.track];
    out[t.track]={name:(reg&&reg.name)||(top&&top.name)||t.track,color:(reg&&reg.color)||PG_PALETTE[pi++%PG_PALETTE.length]};
  });
  return out;
}

// clientId (اختياري): نفس الدالة ونفس مصدر البيانات لعرض المحفظة كاملة أو عميل واحد فقط —
// لا استعلام أو منطق تجميع منفصل مكرّر بين الحالتين.
async function pganttOpen(clientId,mount){
  const embedded=!!mount;
  if(!embedded){
    SCREEN='pgantt';
    $('#hProject').innerHTML='<span class="ctx-dot" style="background:var(--blue)"></span>الخط الزمني الشامل — '+(clientId?'هذا العميل':'كل المشاريع');
    $('#barClient').style.display='none';hideChrome();
    $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backP">↩ '+(clientId?'ملف العميل':'المحفظة')+'</button><span style="margin-inline-start:auto">رؤية شاملة لكل المشاريع النشطة. اضغط أي مشروع للدخول إليه.</span></div><div id="pgWrap"><div class="skeleton" style="height:50px;margin-bottom:8px"></div><div class="skeleton" style="height:50px;margin-bottom:8px"></div><div class="skeleton" style="height:50px"></div></div>';
    $('#backP').onclick=clientId?(()=>renderClientHome(clientId)):renderPortfolio;
  }
  const mountId=embedded?mount:'pgWrap';
  if(embedded)document.getElementById(mountId).innerHTML='<div class="skeleton" style="height:50px;margin-bottom:8px"></div><div class="skeleton" style="height:50px"></div>';

  // نجلب المشاريع ومهامها، ونحسب CPM لكل مشروع
  let timeline=await fetchPortfolioTimeline();
  if(clientId)timeline=timeline.filter(t=>t.client_id===clientId);
  if(!timeline.length){ document.getElementById(mountId).innerHTML='<div class="empty-cta"><div class="ico">'+I.calendar+'</div><h3>لا مشاريع لعرضها</h3><p>المشاريع التي لها خطط مهام ستظهر هنا في خط زمني موحّد.</p></div>'; return; }
  const pids=timeline.map(t=>t.project_id);
  const {tasks,deps,tracks:allTracks}=await fetchAllProjectsTasks(pids);
  const trkByProj={};(allTracks||[]).forEach(t=>{(trkByProj[t.project_id]=trkByProj[t.project_id]||{})[t.key]={name:t.name,color:t.color};});
  // نجمّع المهام والتبعيات لكل مشروع
  const byProj={};
  timeline.forEach(t=>byProj[t.project_id]={info:t,tasks:[],deps:[]});
  const refById={};
  tasks.forEach(t=>{ refById[t.id]=t.ref; if(byProj[t.project_id])byProj[t.project_id].tasks.push(t); });
  deps.forEach(d=>{ if(byProj[d.project_id])byProj[d.project_id].deps.push(d); });

  // نحسب CPM لكل مشروع → نحصل على البداية/النهاية والمرحلة الحالية
  const projRows=[]; let minD=null,maxD=null;
  for(const pid of pids){
    const pr=byProj[pid]; const info=pr.info;
    // نبني مدخلات المحرّك
    const depMap={};
    pr.deps.forEach(d=>{(depMap[d.task_id]=depMap[d.task_id]||[]).push(refById[d.depends_on_id]);});
    const T=pr.tasks.sort((a,b)=>a.sort_order-b.sort_order).map(t=>({
      id:t.ref,name:t.name,track:t.track,type:t.type,duration:t.duration||0,
      parent:t.parent_id?refById[t.parent_id]:null,
      deps:depMap[t.id]||[],status:t.status
    }));
    // إصلاح ذاتي: مرحلة كل بند = مرجع أعلى سلف حقيقي له في WBS — يُحدِّث t.track في T مباشرة
    const projPhases=pgDerivePhases(T,trkByProj[pid]);
    trkByProj[pid]=projPhases;
    let sched=null;
    try{ sched=scheduleTasks(T,info.start_date); }catch(e){}
    const start=sched?sched.pStart:new Date(info.start_date);
    const end=sched?sched.pEnd:new Date(info.start_date);
    // المرحلة الحالية: أول مهمة غير منجزة
    const cur=T.find(t=>t.status!=='done'&&t.type!=='milestone'&&t.type!=='cont');
    const curPhase=cur?cur.track:(info.current_phase||'—');
    const pct=info.total_tasks>0?Math.round(info.done_tasks/info.total_tasks*100):0;
    projRows.push({pid,clientId:info.client_id,client:info.client_name,name:info.project_name,color:info.color,
      start,end,curPhase,pct,lifecycle:info.lifecycle,trk:trkByProj[pid]||{},
      tasks:info.total_tasks,milestones:info.milestones,sched,T});
    if(!minD||start<minD)minD=start;
    if(!maxD||end>maxD)maxD=end;
  }
  if(!minD)minD=new Date();if(!maxD)maxD=new Date(minD.getTime()+86400000*90);
  // نوسّع الحدود لأسبوع
  minD=new Date(minD.getTime()-86400000*3); maxD=new Date(maxD.getTime()+86400000*3);
  PG_RENDER(projRows,minD,maxD,mountId);
}

function PG_RENDER(rows,minD,maxD,mountId){
  mountId=mountId||'pgWrap';
  const totalDays=Math.max(1,Math.round((maxD-minD)/86400000));
  // أعمدة أسبوعية للمحور
  const weeks=[]; let w=new Date(minD);
  // محاذاة لأقرب أحد
  while(w.getDay()!==0) w.setDate(w.getDate()-1);
  while(w<=maxD){ weeks.push(new Date(w)); w=new Date(w.getTime()+86400000*7); }
  const today=new Date();
  const pct=d=>((d-minD)/86400000/totalDays*100);

  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق'};
  // رأس المحور (أشهر)
  const monthNames=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  let axisHtml='';
  weeks.forEach(wk=>{ axisHtml+=`<div class="pg-week" style="inset-inline-start:${pct(wk)}%">${wk.getDate()}/${wk.getMonth()+1}</div>`; });
  // خط اليوم
  const todayLine=(today>=minD&&today<=maxD)?`<div class="pg-today" style="inset-inline-start:${pct(today)}%" title="اليوم"></div>`:'';

  // صفوف المشاريع
  let rowsHtml='';
  rows.forEach(r=>{
    const left=pct(r.start), width=Math.max(1.5,pct(r.end)-pct(r.start));
    const _tm=r.trk&&r.trk[r.curPhase];const clr=(_tm&&_tm.color)||(TRACKS&&TRACKS[r.curPhase]&&TRACKS[r.curPhase].color)||r.color||'#C8A06B';
    const fmt=d=>`${d.getDate()}/${d.getMonth()+1}`;
    rowsHtml+=`<div class="pg-row" data-open="${r.pid}">
      <div class="pg-label">
        <div class="pg-client"><span class="pg-dot" style="background:${r.color}"></span>${esc(r.client)}</div>
        <div class="pg-pname">${esc(r.name)}</div>
        <div class="pg-meta">${r.tasks} بند · ${r.milestones} معالم · ${LIFE[r.lifecycle]||''}</div>
      </div>
      <div class="pg-track">
        <div class="pg-bar" style="inset-inline-start:${left}%;width:${width}%;background:${clr}">
          <div class="pg-bar-fill" style="width:${r.pct}%"></div>
          <span class="pg-bar-txt">${(_tm&&_tm.name)||PHASE_NAMES[r.curPhase]||''} · ${r.pct}%</span>
        </div>
        <span class="pg-date pg-date-s" style="inset-inline-start:${left}%">${fmt(r.start)}</span>
        <span class="pg-date pg-date-e" style="inset-inline-start:${Math.min(96,pct(r.end))}%">${fmt(r.end)}</span>
      </div>
    </div>`;
  });

  const mountEl=document.getElementById(mountId);
  if(!mountEl)return;
  // مفتاح الشرح: المراحل الحقيقية الظاهرة فعليًا في الصفوف المعروضة — لا قائمة عامة ثابتة
  const legendPhases={};
  rows.forEach(r=>{const tm=r.trk&&r.trk[r.curPhase];if(tm&&!legendPhases[r.curPhase])legendPhases[r.curPhase]=tm;});
  mountEl.innerHTML=`
    <div class="pg-legend">
      ${Object.values(legendPhases).map(v=>`<span class="pg-leg"><i style="background:${v.color}"></i>${esc(v.name)}</span>`).join('')}
      <span class="pg-leg"><i class="pg-leg-today"></i>اليوم</span>
    </div>
    <div class="pg-chart">
      <div class="pg-axis"><div class="pg-axis-label"></div><div class="pg-axis-track">${axisHtml}${todayLine}</div></div>
      <div class="pg-rows">${rowsHtml}</div>
    </div>`;
  // تفاعل: نقرة تدخل المشروع (تُقيَّد بحاوية التثبيت لسلامة التضمين المزدوج المحتمل)
  mountEl.querySelectorAll('[data-open]').forEach(el=>el.onclick=async()=>{
    const pid=el.dataset.open;
    const row=rows.find(x=>x.pid===pid);
    if(!row)return;
    CID=row.clientId; PID=pid;
    await openProject();
  });
}
