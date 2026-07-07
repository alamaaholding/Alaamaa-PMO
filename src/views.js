// ===== العرض =====
const VIEW_LABELS={dashboard:'لوحة القيادة',table:'الجدول (MS Project)',gantt:'مخطط جانت',deliv:'المخرجات والمعالم',cr:'طلبات التغيير',requests:'طلبات العميل',discuss:'النقاش',audit:'سجل التدقيق'};
function render(){
  if(!PROJECT){$('#host').innerHTML='<p style="padding:30px;text-align:center;color:var(--muted)">لا يوجد مشروع لهذا العميل.</p>';return;}
  $('#backPortfolio').style.display=(ROLE!=='client')?'':'none';
  $('#manageAccess').style.display=(ROLE==='pmo')?'':'none';
  const pmb=$('#projMenuBtn');if(pmb)pmb.style.display=(ROLE==='pmo')?'':'none';
  $('#approveContract').style.display=(ROLE==='pmo'&&PROJECT.status!=='baselined')?'':'none';
  $('#roleHint').textContent=(typeof IS_OWNER!=='undefined'&&IS_OWNER)?'مالك المنصة — سلطة كاملة':(can('editStruct')?'لديك صلاحية تعديل الخطة':(can('editProg')?'يمكنك تحديث الحالة والتقدم':'عرض فقط'));
  compute();
  const _c=CLIENTS.find(x=>x.id===CID);
  $('#hProject').innerHTML=(_c?`<span class="ctx-dot" style="background:${_c.color}"></span>`:'')+esc(PROJECT.name);
  const lifeMap={proposal:['مقترح — قيد النقاش','proposal'],negotiation:['قيد التفاوض','proposal'],approved:['معتمد','active'],active:['نشط','active'],closed:['مغلق',''],lost:['ملغى','']};
  const lm=lifeMap[PROJECT.lifecycle]||['—',''];$('#lifeBadge').textContent=lm[0];$('#lifeBadge').className='lifebadge '+lm[1];
  const tasks=PROJECT.tasks;
  $('#kEnd').textContent=fmt(SCHED.pEnd)+'/'+new Date(SCHED.pEnd).getFullYear();
  $('#kDur').textContent=SCHED.totalWD;
  // تاريخ البدء (قابل للتعديل فقط للـPMO وقبل التثبيت)
  const sd=PROJECT.start?new Date(PROJECT.start):SCHED.pStart;
  $('#kStart').textContent=fmt(sd)+'/'+sd.getFullYear();
  const canEditStart=(ROLE==='pmo'&&PROJECT.status!=='baselined');
  const esBtn=$('#editStart');
  if(esBtn){ esBtn.style.display=canEditStart?'':'none'; esBtn.onclick=canEditStart?editStartDate:null; }
  $('#kCrit').textContent=tasks.filter(t=>SCHED.R[t.id].critical).length;
  $('#kBlk').textContent=tasks.filter(t=>TRACK[t.id].blocked).length;
  $('#kCl').textContent=tasks.filter(t=>TRACK[t.id].delay==='client').length;
  $('#kAl').textContent=tasks.filter(t=>TRACK[t.id].delay==='alamah').length;
  const w=$('#warnBox');const blk=tasks.filter(t=>TRACK[t.id].blocked);const arr=SCHED.warnings.slice();
  if(blk.length)arr.push('بنود متوقفة بانتظار متطلبات: '+blk.map(t=>t.id).join('، '));
  if(arr.length){w.classList.add('show');w.innerHTML=arr.map(x=>'⚠ '+x).join('<br>');}else w.classList.remove('show');
  const views=PERMS[ROLE].views;if(!views.includes(VIEW))VIEW=views[0];
  $('#tabs').setAttribute('role','tablist');
  $('#tabs').innerHTML=views.map(v=>`<button class="tab ${v===VIEW?'active':''}" role="tab" aria-selected="${v===VIEW}" data-v="${v}">${VIEW_LABELS[v]}</button>`).join('');
  $$('#tabs .tab').forEach(b=>b.onclick=()=>{VIEW=b.dataset.v;render();});
  const host=$('#host');
  // حالة فارغة: مشروع بلا بنود — دعوة فعل واضحة (لا تبويبات فارغة)
  if(!PROJECT.tasks.length && VIEW!=='discuss' && VIEW!=='requests'){
    const canBuild=can('editStruct');
    host.innerHTML=`<div class="empty-cta"><div class="ico">${I.clipboard}</div><h3>لا توجد خطة بعد لهذا المشروع</h3>
      <p>${canBuild?'ابدأ ببناء خطة المشروع بإضافة أول بند، ثم عرّف المسارات والتبعيات.':'لم تُبنَ خطة هذا المشروع بعد. سيظهر المحتوى فور إعدادها من فريق إدارة المشاريع.'}</p>
      ${canBuild?'<button id="emptyAdd">+ إضافة أول بند</button>':''}</div>`;
    const ea=$('#emptyAdd');if(ea)ea.onclick=()=>{VIEW='table';handleAddTask();};
    return;
  }
  if(VIEW==='dashboard')host.innerHTML=(ROLE==='client')?vClientDash():vDashboard();
  else if(VIEW==='table'){host.innerHTML='<div class="hintbar">تحديث الحالة والتقدّم يُحفظ مباشرة في القاعدة. المسار الحرج مظلّل.</div>'+vTable();bindTable();}
  else if(VIEW==='gantt'){host.innerHTML=gToolbar()+vGantt();$('#zin').onclick=()=>{PX=Math.min(40,PX+4);render();};$('#zout').onclick=()=>{PX=Math.max(10,PX-4);render();};}
  else if(VIEW==='deliv')host.innerHTML=vDeliv();
  else if(VIEW==='cr'){host.innerHTML=vCR();bindCR();}
  else if(VIEW==='discuss'){
    host.innerHTML='<div id="discussWrap"><div class="skeleton" style="height:80px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    loadComments(PROJECT._dbId).then(rows=>{const el=document.getElementById('discussWrap');if(el){el.innerHTML=vDiscuss(rows);bindDiscuss();}});
  }
  else if(VIEW==='requests'){
    host.innerHTML='<div id="reqWrap"><div class="skeleton" style="height:80px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    loadClientRequests(PROJECT._dbId).then(rows=>{const el=document.getElementById('reqWrap');if(el){el.innerHTML=vRequests(rows);bindRequests();}});
  }
  else if(VIEW==='audit'){
    host.innerHTML='<div class="hintbar">آخر 60 تغييرًا مسجّلًا تلقائيًا (الحالة، التقدّم، المدة، طلبات التغيير).</div><div id="auditList"><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px"></div></div>';
    loadAudit(PROJECT._dbId).then(rows=>{const el=document.getElementById('auditList');if(el)el.innerHTML=vAudit(rows);});
  }
}

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function vDashboard(){
  const tasks=PROJECT.tasks.filter(t=>t.type!=='cont'),S=SCHED,T=TRACK,dd=D(DATA_DATE);
  const total=tasks.filter(t=>t.type!=='milestone').length;
  const done=tasks.filter(t=>t.status==='done'&&t.type!=='milestone').length;
  const inprog=tasks.filter(t=>T[t.id].effStatus==='inprogress').length;
  const blocked=tasks.filter(t=>T[t.id].blocked).length;const pct=total?Math.round(done/total*100):0;
  const today=tasks.filter(t=>t.type!=='milestone'&&D(fmtY(S.R[t.id].ES))<=dd&&dd<=D(fmtY(S.R[t.id].EF)));
  const wkEnd=new Date(dd.getTime()+7*86400000);
  const week=tasks.filter(t=>t.type!=='milestone'&&D(fmtY(S.R[t.id].ES))<=wkEnd&&D(fmtY(S.R[t.id].EF))>=dd);
  const creqs=[];PROJECT.tasks.forEach(t=>(t.requirements||[]).forEach(r=>{if(r.owner==='client'&&r._state!=='received'&&r._state!=='latejust')creqs.push({t,r});}));
  const miles=PROJECT.tasks.filter(t=>t.type==='milestone').map(t=>({t,ef:S.R[t.id].EF})).filter(m=>D(fmtY(m.ef))>=dd).sort((a,b)=>a.ef-b.ef).slice(0,5);
  const alerts=[];creqs.filter(x=>x.r._state==='overdue').forEach(x=>alerts.push(['client','متطلب متأخر من العميل: '+x.r.desc+' ('+x.t.id+')'+(x.r._late?' +'+x.r._late+'ي':'')]));
  tasks.filter(t=>T[t.id].delay==='alamah').forEach(t=>alerts.push(['alamah','تأخير على فريق علامة: '+t.id+' — '+t.name]));
  tasks.filter(t=>T[t.id].blocked).forEach(t=>alerts.push(['blocked','بند متوقف: '+t.id+' — '+t.name]));
  const tl=t=>`<li><span class="tgw" style="--tc:${trackMeta(t.track).color}">${esc(t.id)}</span> ${esc(t.name)} <em>${fmt(S.R[t.id].ES)}–${fmt(S.R[t.id].EF)}</em> <span class="ministat s-${T[t.id].effStatus}">${STATUS[T[t.id].effStatus]}</span></li>`;
  const card=(l,v,c)=>`<div class="dcard ${c||''}"><b>${v}</b><span>${l}</span></div>`;
  let h=`<div class="dgrid">${card('نسبة الإنجاز',pct+'%','ok')}${card('مكتملة',done)}${card('جارية',inprog,'blue')}${card('متبقية',total-done)}${card('متوقفة',blocked,'crit')}${card('متطلبات مطلوبة',creqs.length,'warn')}</div>
  <div class="dprog"><div class="dprog-fill" style="width:${pct}%"></div></div>
  <div class="dcols">
    <div class="dbox"><h4>مهام اليوم (${today.length})</h4><ul class="tlist">${today.length?today.map(tl).join(''):'<li class="empty">لا مهام مجدولة لليوم.</li>'}</ul></div>
    <div class="dbox"><h4>مهام هذا الأسبوع (${week.length})</h4><ul class="tlist">${week.length?week.map(tl).join(''):'<li class="empty">لا مهام هذا الأسبوع.</li>'}</ul></div>
  </div>
  <div class="dcols">
    <div class="dbox"><h4>المتطلبات المطلوبة من العميل (${creqs.length})</h4><ul class="tlist">${creqs.length?creqs.map(x=>`<li><span class="ministat s-${x.r._state==='overdue'?'blocked':'notstarted'}">${x.r._state==='overdue'?'متأخر':'بانتظار'}</span> ${esc(x.r.desc)} <em>SLA ${x.r.sla}ي · ${esc(x.t.id)}</em></li>`).join(''):'<li class="empty">لا متطلبات معلّقة.</li>'}</ul></div>
    <div class="dbox"><h4>المعالم القادمة</h4><ul class="tlist">${miles.length?miles.map(m=>`<li><span class="md">◆</span> ${esc(m.t.name.replace('معلم: ',''))} <em>${fmt(m.ef)}</em></li>`).join(''):'<li class="empty">—</li>'}</ul></div>
  </div>
  <div class="dbox alerts"><h4>التنبيهات (${alerts.length})</h4><ul class="tlist">${alerts.length?alerts.map(a=>`<li class="alert a-${a[0]}">⚠ ${esc(a[1])}</li>`).join(''):'<li class="empty">لا تنبيهات.</li>'}</ul></div>`;
  return h;
}

function vTable(){
  const S=SCHED,T=TRACK;const editStruct=can('editStruct')&&PROJECT.status!=='baselined';const editProg=can('editProg');
  const colspan=editStruct?12:11;
  let rows='',last=null;
  PROJECT.tasks.forEach(t=>{
    if(t.track!==last){last=t.track;rows+=`<tr class="grp"><td colspan="${colspan}">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</td></tr>`;}
    const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
    const sopt=Object.keys(STATUS).map(x=>`<option value="${x}" ${x===t.status?'selected':''}>${STATUS[x]}</option>`).join('');
    const durDis=(t.type==='milestone'||t.type==='cont'||!editStruct)?'disabled':'';
    const delay=k.delay==='client'?'<span class="delay client">العميل</span>':k.delay==='alamah'?'<span class="delay alamah">علامة</span>':'<span class="delay none">—</span>';
    const reqs=(t.requirements||[]);const bad=reqs.filter(x=>x._state==='overdue').length;
    // الاسم: قابل للتعديل بنيويًا
    const nameCell=`<input class="cell iname" data-f="name" value="${esc(t.name)}" ${editStruct?'':'disabled'}>`;
    // النوع: قائمة عند التحرير، نص خلافه
    const typeCell=editStruct
      ? `<select class="cell" data-f="type">${Object.keys(TYPES).map(x=>`<option value="${x}" ${x===t.type?'selected':''}>${TYPES[x]}</option>`).join('')}</select>`
      : TYPES[t.type];
    const depCount=(t.deps||[]).length;
    const editCol=editStruct?`<td style="white-space:nowrap"><button class="reqbtn" data-deps="${esc(t.id)}" title="التبعيات" aria-label="تحرير التبعيات">${I.link} ${depCount||''}</button> <button class="ib" data-del="${esc(t.id)}" title="حذف" aria-label="حذف البند" style="color:var(--crit)">${I.trash}</button></td>`:'';
    rows+=`<tr data-id="${esc(t.id)}" class="${r.critical?'crit':''}">
      <td><span class="idcell" style="--tc:${tc}">${esc(t.id)}${r.critical?'<span class="critdot"></span>':''}</span></td>
      <td>${nameCell}</td>
      <td>${typeCell}</td>
      <td><input class="cell inum" type="number" min="0" data-f="duration" value="${t.duration||0}" ${durDis}></td>
      <td><span class="dt s">${fmt(r.ES)}</span></td>
      <td><span class="dt">${fmt(r.EF)}</span></td>
      <td><select class="st st-${k.effStatus}" data-f="status" ${editProg?'':'disabled'}>${sopt}</select></td>
      <td><input class="cell iprog" type="number" min="0" max="100" data-f="progress" value="${(k&&k.dispPct)||t.progress||0}" ${editProg&&t.type!=='milestone'?'':'disabled'}></td>
      <td>${delay}</td>
      <td><button class="reqbtn" data-reqs="${esc(t.id)}">${reqs.length?(bad?bad+'⚠':reqs.length):'—'}</button></td>
      <td style="font-size:.74rem;color:var(--tC);text-align:right">${esc(t.deliverable||'—')}</td>
      ${editCol}
    </tr>`;
  });
  const editHead=editStruct?'<th>تحرير</th>':'';
  const addBar=editStruct?`<div class="lockbar" style="border-inline-start-color:var(--ok)"><span>أداة بناء الخطة:</span><button class="reqbtn" id="addTaskBtn" style="background:var(--ok);border-color:var(--ok);color:#fff">+ إضافة بند</button><button class="reqbtn" id="importXlsxBtn" style="background:var(--blue);border-color:var(--blue);color:#fff">${I.upload} استيراد من Excel</button>${ROLE==='pmo'?'<button class="reqbtn" id="tracksBtn" style="background:var(--ink);border-color:var(--ink);color:#fff">إدارة المراحل</button>':''}<span style="color:var(--muted);font-weight:400;font-size:.78rem">المعرّف فريد (مثل B10). أو استورد خطة كاملة من ملف Excel.</span></div>`:'';
  return addBar+`<div class="tablewrap"><table id="tbl"><thead><tr><th>المعرف</th><th>الاسم</th><th>النوع</th><th>مدة</th><th>بداية</th><th>نهاية</th><th>الحالة</th><th>تقدّم</th><th>التأخير</th><th>متطلبات</th><th>المخرج</th>${editHead}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function bindTable(){
  const editStruct=can('editStruct')&&PROJECT.status!=='baselined';
  $$('#tbl tr[data-id]').forEach(tr=>{
    const id=tr.dataset.id,t=PROJECT.tasks.find(x=>x.id===id);
    tr.querySelectorAll('[data-f]').forEach(inp=>{
      inp.addEventListener('change',async()=>{
        const f=inp.dataset.f;
        let val=inp.value;if(f==='duration'||f==='progress')val=parseInt(val||'0',10);
        t[f]=val;
        const map={duration:'duration',progress:'progress',status:'status',name:'name',type:'type'};
        if(map[f]&&t._dbId){const patch={};patch[map[f]]=val;
          const {error}=await updateTaskFields(t._dbId,patch);
          if(error){toast('تعذّر الحفظ: '+error.message,'err');return;}}
        render();
      });
    });
  });
  $$('#tbl [data-reqs]').forEach(b=>b.onclick=()=>openReqs(b.dataset.reqs));
  if(editStruct){
    $$('#tbl [data-del]').forEach(b=>b.onclick=()=>handleDeleteTask(b.dataset.del));
    $$('#tbl [data-deps]').forEach(b=>b.onclick=()=>openDeps(b.dataset.deps));
    const ab=$('#addTaskBtn');if(ab)ab.onclick=handleAddTask;
    const tb=$('#tracksBtn');if(tb)tb.onclick=openTracksManager;
    const ib=$('#importXlsxBtn');if(ib)ib.onclick=openImporter;
  }
}

function gToolbar(){return `<div class="gctrl"><div class="hintbar" style="margin:0">الزمن من اليمين للأقدم · لون النقطة=الحالة · الخط الأزرق=اليوم · الشريط الرفيع=الأساس المعتمد.</div><span style="margin-inline-start:auto"></span><div class="zoom"><button class="zb" id="zout">−</button><button class="zb" id="zin">+</button></div></div>`;}
function vGantt(){
  const S=SCHED,T=TRACK,start=S.pStart,end=S.pEnd,oneDay=86400000,dd=D(DATA_DATE);
  const lo=start<dd?start:dd,hi=end>dd?end:dd,totalDays=Math.round((hi-lo)/oneDay)+3,W=totalDays*PX;
  const off=d=>Math.round((new Date(d)-lo)/oneDay);
  const MN=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  let months='',weeks='',grid='';let d=new Date(lo);
  while(d<=hi){const ms=off(d);const nx=new Date(d.getFullYear(),d.getMonth()+1,1);const se=nx>hi?hi:new Date(nx-oneDay);const days=Math.round((se-d)/oneDay)+1;months+=`<div class="mhead" style="right:${ms*PX}px;width:${days*PX}px">${MN[d.getMonth()]} ${d.getFullYear()}</div>`;d=nx;}
  let wk=new Date(lo),wi=1;while(wk<=hi){weeks+=`<div class="whead" style="right:${off(wk)*PX}px;width:${7*PX}px"><b>أسبوع ${wi}</b><s>${fmt(wk)}</s></div>`;grid+=`<div class="vg" style="right:${off(wk)*PX}px"></div>`;wk=new Date(wk.getTime()+7*oneDay);wi++;}
  const today=`<div class="today" style="right:${off(dd)*PX}px"><span>اليوم ${fmt(dd)}</span></div>`;
  const BL=PROJECT.baseline?PROJECT.baseline.snapshot:null;let rows='',last=null;
  PROJECT.tasks.forEach(t=>{const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
    if(t.track!==last){last=t.track;rows+=`<div class="grow grp"><div class="glbl">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</div><div class="glane"></div></div>`;}
    const o=off(r.ES);const tip=`${esc(t.name)} — ${fmt(r.ES)}–${fmt(r.EF)} | ${STATUS[k.effStatus]}`;
    let lane='';
    if(BL&&BL[t.id]&&t.type!=='milestone'){const bo=off(D(BL[t.id].ES)),bl=Math.max(1,Math.round((D(BL[t.id].EF)-D(BL[t.id].ES))/oneDay)+1);lane+=`<div class="blbar" style="right:${bo*PX}px;width:${bl*PX}px"></div>`;}
    if(t.type==='milestone')lane+=`<div class="gmile ${r.critical?'crit':''}" style="right:${o*PX-7}px" title="${tip}"><span class="md">◆</span><span class="ml">${esc(t.id)}</span></div>`;
    else{const len=Math.max(1,Math.round((new Date(r.EF)-new Date(r.ES))/oneDay)+1),wpx=len*PX;const cls=(t.type==='cont')?'cont':k.effStatus;const prog=t.type==='cont'?0:((k&&k.dispPct)||t.progress||0);
      const fill=(k.effStatus==='inprogress'&&prog>0)?`<div class="fill" style="width:${prog}%"></div>`:'';
      const durTxt=(t.type==='cont')?'مستمر':(t.duration+' ي'+(prog?' · '+prog+'%':''));const inside=wpx>56;
      const durEl=inside?`<div class="gdur inside" style="right:${o*PX+6}px">${durTxt}</div>`:`<div class="gdur" style="right:${(o+len)*PX+4}px">${durTxt}</div>`;
      lane+=`<div class="gbar ${cls} ${r.critical?'crit':''}" style="right:${o*PX}px;width:${wpx}px;background:${tc}" title="${tip}">${fill}</div>${durEl}`;}
    rows+=`<div class="grow"><div class="glbl"><span class="sdot ${k.effStatus}"></span><span class="gw" style="--tc:${tc}">${esc(t.wbs||t.id)}</span>${esc(t.name)}</div><div class="glane">${lane}</div></div>`;});
  return `<div class="gantt"><div class="gscroll"><div style="min-width:${280+W}px">
    <div class="thead"><div class="corner"><span>حزمة العمل</span><span class="dir">الأقدم ← الأحدث</span></div><div class="tl" style="width:${W}px">${months}${weeks}</div></div>
    <div style="position:relative"><div style="position:absolute;right:280px;left:0;top:0;bottom:0;pointer-events:none">${grid}${today}</div>${rows}</div></div></div>
    <div class="glegend"><span><span class="di"></span>معلم</span><span><span class="ci"></span>حرج</span>${BL?'<span><i class="blleg"></i>الأساس المعتمد</span>':''}<span><span class="dot" style="background:#cbbfa6"></span>لم تبدأ</span><span><span class="dot" style="background:var(--blue)"></span>جارية</span><span><span class="dot" style="background:var(--crit)"></span>متوقفة</span><span><span class="dot" style="background:var(--ok)"></span>مكتملة</span></div></div>`;
}

function vDeliv(){
  const S=SCHED,T=TRACK;let rows='';
  PROJECT.tasks.forEach(t=>{if(!t.deliverable)return;const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color,isM=t.type==='milestone';
    rows+=`<tr class="${isM?'m':''}"><td style="font-weight:${isM?700:500}">${isM?'◆ ':''}${esc(t.deliverable)}</td><td><span class="idcell" style="--tc:${tc}">${esc(t.id)}</span> ${esc(t.name)}</td><td><span class="pill" style="background:${tc}">${esc(trackMeta(t.track).name)}</span></td><td>${fmt(r.EF)}/${new Date(r.EF).getFullYear()}</td><td><span class="ministat s-${k.effStatus}">${STATUS[k.effStatus]}</span></td></tr>`;});
  return `<div class="dwrap"><table class="dtbl"><thead><tr><th>المخرج</th><th>البند</th><th>المسار</th><th>التسليم المتوقع</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function vAudit(rows){
  if(!rows||!rows.length)return '<p class="empty" style="padding:20px;text-align:center">لا تغييرات مسجّلة بعد.</p>';
  const ACT={status_change:'تغيير الحالة',progress_change:'تحديث التقدّم',duration_change:'تغيير المدة',cr_created:'طلب تغيير جديد',cr_approved:'الموافقة على طلب',cr_rejected:'رفض طلب',cr_pending:'طلب معلّق'};
  const ENT={task:'بند',change_request:'طلب تغيير'};
  // خريطة معرّف البند → اسمه (للعرض المفهوم)
  const taskById={};PROJECT.tasks.forEach(t=>{taskById[t._dbId]=t;});
  const rowsHtml=rows.map(a=>{
    const act=ACT[a.action]||a.action;
    let detail='';
    if(a.action==='status_change'&&a.old_value&&a.new_value){detail=`${STATUS[a.old_value.status]||a.old_value.status} ← ${STATUS[a.new_value.status]||a.new_value.status}`;}
    else if(a.action==='progress_change'&&a.new_value){detail=`${a.old_value?a.old_value.progress:0}% ← ${a.new_value.progress}%`;}
    else if(a.action==='duration_change'&&a.new_value){detail=`${a.old_value?a.old_value.duration:'?'} ← ${a.new_value.duration} يوم`;}
    else if(a.action==='cr_created'&&a.new_value){detail=esc(a.new_value.reason||a.new_value.kind||'');}
    const t=a.entity==='task'?taskById[a.entity_id]:null;
    const target=t?(esc(t.id)+' — '+esc(t.name)):(ENT[a.entity]||a.entity);
    const when=new Date(a.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    return `<tr>
      <td style="white-space:nowrap;font-size:.76rem;color:var(--muted)">${when}</td>
      <td><span class="crstate ${a.action.startsWith('cr_')?(a.action==='cr_approved'?'approved':a.action==='cr_rejected'?'rejected':'pending'):'pending'}" style="font-size:.7rem">${act}</span></td>
      <td>${target}</td>
      <td style="font-size:.8rem;color:#4a4233">${detail}</td>
    </tr>`;
  }).join('');
  return `<div class="dwrap"><table class="dtbl"><thead><tr><th>الوقت</th><th>الإجراء</th><th>العنصر</th><th>التغيير</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function vDiscuss(rows){
  const KIND={comment:'تعليق',question:'سؤال',suggestion:'مقترح'};
  const KCLR={comment:'var(--blue)',question:'var(--warn)',suggestion:'var(--gold-dark)'};
  const ROLE_AR={pmo:'إدارة المشاريع',delivery:'الفريق',client:'العميل'};
  // الجذور (بلا أب) ثم ردودها
  const roots=rows.filter(r=>!r.parent_id);
  const childrenOf=id=>rows.filter(r=>r.parent_id===id);
  const canResolve=can('editStruct')||ROLE==='pmo';
  const bubble=(c,isReply)=>{
    const when=new Date(c.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    const resBtn=(!isReply&&c.kind!=='comment'&&ROLE==='pmo')?`<button class="reqbtn" data-resolve="${c.id}" data-cur="${c.resolved?1:0}" style="font-size:.7rem">${c.resolved?'إعادة فتح':'تعليم محلول'}</button>`:'';
    const resBadge=(c.kind!=='comment'&&c.resolved)?'<span class="crstate approved" style="font-size:.68rem">محلول</span>':'';
    return `<div class="crcard" style="${isReply?'margin-inline-start:28px;border-inline-start:3px solid var(--line)':''}">
      <div class="crhd">
        <span><span class="crstate" style="background:color-mix(in srgb,${KCLR[c.kind]} 14%,#fff);color:${KCLR[c.kind]};font-size:.7rem">${KIND[c.kind]}</span>
          <b style="font-size:.82rem;margin-inline-start:6px">${esc(c.author_email||'—')}</b>
          <span style="font-size:.7rem;color:var(--muted)">· ${ROLE_AR[c.author_role]||''}</span></span>
        <span style="display:flex;gap:8px;align-items:center">${resBadge}<small style="color:var(--muted)">${when}</small></span>
      </div>
      <div class="crbody">${esc(c.body)}</div>
      <div class="cract">${resBtn}<button class="reqbtn" data-reply="${c.id}" style="font-size:.72rem">رد</button>${(ROLE==='pmo'||c.author_id===USER.id)?`<button class="reqbtn" data-delc="${c.id}" aria-label="حذف التعليق" style="font-size:.72rem;color:var(--crit)">حذف</button>`:''}</div>
      <div id="replyBox-${c.id}"></div>
    </div>`;
  };
  let thread=roots.map(c=>bubble(c,false)+childrenOf(c.id).map(ch=>bubble(ch,true)).join('')).join('');
  if(!roots.length)thread='<p class="empty" style="padding:14px">لا نقاش بعد — ابدأ بأول تعليق أو سؤال.</p>';
  const composer=`<div class="crform" style="position:static;margin-bottom:16px">
    <h4>إضافة للنقاش</h4>
    <select id="dcKind"><option value="comment">تعليق</option><option value="question">سؤال</option><option value="suggestion">مقترح</option></select>
    <textarea id="dcBody" placeholder="اكتب رسالتك..."></textarea>
    <button class="hbtn" id="dcSend" style="background:var(--gold);border-color:var(--gold);width:100%">إرسال</button>
  </div>`;
  return composer+'<div class="crlist">'+thread+'</div>';
}
function bindDiscuss(){
  const send=document.getElementById('dcSend');
  if(send)send.onclick=async()=>{
    const body=document.getElementById('dcBody').value.trim();if(!body){toast('اكتب رسالة','warn');return;}
    try{ await addComment(PROJECT._dbId, document.getElementById('dcKind').value, body, null); toast('أُرسلت','ok'); render(); }
    catch(e){ toast('تعذّر الإرسال: '+e.message,'err'); }
  };
  document.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{
    const box=document.getElementById('replyBox-'+b.dataset.reply);
    if(box.innerHTML){box.innerHTML='';return;}
    box.innerHTML=`<div style="display:flex;gap:6px;margin-top:8px"><input id="rin-${b.dataset.reply}" placeholder="ردك..." style="flex:1;border:1.5px solid var(--line);border-radius:7px;padding:7px;font-family:inherit;font-size:.82rem"><button class="reqbtn" data-sendreply="${b.dataset.reply}" style="background:var(--gold);border-color:var(--gold);color:#fff">رد</button></div>`;
    box.querySelector('[data-sendreply]').onclick=async()=>{
      const v=document.getElementById('rin-'+b.dataset.reply).value.trim();if(!v){return;}
      try{ await addComment(PROJECT._dbId,'comment',v,b.dataset.reply); toast('أُرسل الرد','ok'); render(); }
      catch(e){ toast('تعذّر: '+e.message,'err'); }
    };
  });
  document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{
    try{ await resolveComment(b.dataset.resolve, b.dataset.cur!=='1'); render(); }
    catch(e){ toast('تعذّر: '+e.message,'err'); }
  });
  document.querySelectorAll('[data-delc]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف التعليق','حذف هذا التعليق؟ لا يمكن التراجع.',true))return;
    try{ await deleteComment(b.dataset.delc); toast('حُذف','ok'); render(); }
    catch(e){ toast('تعذّر: '+e.message,'err'); }
  });
}

// ===== طلبات العميل الموجّهة للأقسام (المرحلة 3) =====
const DEPT_AR={marketing:'التسويق',tech:'التقني',strategy:'الاستراتيجية',consulting:'الاستشارات',other:'أخرى'};
const REQ_STATUS_AR={new:'جديد',in_progress:'قيد المعالجة',done:'منجز',declined:'مرفوض'};
const REQ_STATUS_CLR={new:'var(--blue)',in_progress:'var(--warn)',done:'var(--ok)',declined:'var(--muted)'};
const PRIO_AR={low:'منخفضة',normal:'عادية',high:'عالية',urgent:'عاجلة'};
const PRIO_CLR={low:'var(--muted)',normal:'var(--ink-soft)',high:'var(--warn)',urgent:'var(--crit)'};
function vRequests(rows){
  const isStaff=(ROLE==='pmo'||ROLE==='delivery');
  const ROLE_AR={pmo:'إدارة المشاريع',delivery:'الفريق',client:'العميل'};
  // نموذج تقديم طلب
  const composer=`<div class="crform" style="position:static;margin-bottom:16px">
    <h4>${ROLE==='client'?'تقديم طلب جديد':'تسجيل طلب نيابة عن العميل'}</h4>
    <input id="rqTitle" placeholder="عنوان الطلب (مثل: تصميم إعلان لعرض رمضان)" style="width:100%;border:1.5px solid var(--line);border-radius:7px;padding:9px;font-family:inherit;margin-bottom:8px">
    <textarea id="rqBody" placeholder="تفاصيل الطلب..." style="margin-bottom:8px"></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <select id="rqDept"><option value="marketing">التسويق</option><option value="tech">التقني</option><option value="strategy">الاستراتيجية</option><option value="consulting">الاستشارات</option><option value="other">أخرى</option></select>
      <select id="rqPrio"><option value="normal">أولوية عادية</option><option value="low">منخفضة</option><option value="high">عالية</option><option value="urgent">عاجلة</option></select>
    </div>
    <button class="hbtn" id="rqSend" style="background:var(--gold);border-color:var(--gold);width:100%">إرسال الطلب</button>
  </div>`;
  if(!rows.length) return composer+'<p class="empty" style="padding:14px">لا طلبات بعد.</p>';
  const cards=rows.map(r=>{
    const when=new Date(r.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    // أزرار إدارة الحالة (للطاقم فقط)
    const statusBtns=isStaff?`<div class="rq-statusbtns">${Object.keys(REQ_STATUS_AR).map(s=>`<button class="rq-sbtn ${r.status===s?'active':''}" data-setstatus="${r.id}" data-s="${s}" style="--sc:${REQ_STATUS_CLR[s]}">${REQ_STATUS_AR[s]}</button>`).join('')}</div>`:'';
    const assignBtn=isStaff?`<button class="reqbtn" data-assign="${r.id}" data-cur="${esc(r.assigned_to||'')}" style="font-size:.72rem">${r.assigned_to?'إعادة الإسناد':'إسناد'}</button>`:'';
    const delBtn=(ROLE==='pmo'||r.created_by===USER.id)?`<button class="reqbtn" data-delreq="${r.id}" style="font-size:.72rem;color:var(--crit)">حذف</button>`:'';
    return `<div class="crcard rq-card" style="border-inline-start:3px solid ${REQ_STATUS_CLR[r.status]}">
      <div class="crhd">
        <span><b style="font-size:.9rem">${esc(r.title)}</b>
          <span class="rq-badge" style="background:color-mix(in srgb,${REQ_STATUS_CLR[r.status]} 14%,#fff);color:${REQ_STATUS_CLR[r.status]}">${REQ_STATUS_AR[r.status]}</span></span>
        <span style="font-size:.7rem;color:${PRIO_CLR[r.priority]};font-weight:700">${PRIO_AR[r.priority]}</span>
      </div>
      <div class="rq-tags">
        <span class="rq-tag">القسم: ${DEPT_AR[r.department]}</span>
        ${r.assigned_to?`<span class="rq-tag">مُسند إلى: ${esc(r.assigned_to)}</span>`:''}
        <span class="rq-tag muted">${ROLE_AR[r.created_role]||''} · ${when}</span>
      </div>
      ${r.body?`<div class="crbody">${esc(r.body)}</div>`:''}
      ${r.resolution?`<div class="rq-resolution">الرد: ${esc(r.resolution)}</div>`:''}
      ${statusBtns}
      <div class="cract">${assignBtn}${delBtn}</div>
    </div>`;
  }).join('');
  return composer+'<div class="crlist">'+cards+'</div>';
}
function bindRequests(){
  const send=document.getElementById('rqSend');
  if(send)send.onclick=async()=>{
    const title=document.getElementById('rqTitle').value.trim();
    if(!title){toast('اكتب عنوان الطلب','warn');return;}
    const body=document.getElementById('rqBody').value.trim();
    const dept=document.getElementById('rqDept').value;
    const prio=document.getElementById('rqPrio').value;
    try{ await addClientRequest(PROJECT._dbId,title,body,dept,prio); toast('أُرسل الطلب','ok'); render(); }
    catch(e){ toast('تعذّر الإرسال: '+e.message,'err'); }
  };
  document.querySelectorAll('[data-setstatus]').forEach(b=>b.onclick=async()=>{
    try{ await updateClientRequest(b.dataset.setstatus,{status:b.dataset.s}); render(); }
    catch(e){ toast('تعذّر: '+e.message,'err'); }
  });
  document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=async()=>{
    const r=await dialog({title:'إسناد الطلب',fields:[{key:'who',label:'إلى مَن (شخص/فريق)',value:b.dataset.cur,placeholder:'مثل: الفريق التقني'}],confirmText:'إسناد'});
    if(r&&r.who){try{ await updateClientRequest(b.dataset.assign,{assigned_to:r.who}); toast('تم الإسناد','ok'); render(); }catch(e){toast('تعذّر','err');}}
  });
  document.querySelectorAll('[data-delreq]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف الطلب','حذف هذا الطلب نهائيًا؟',true))return;
    try{ await deleteClientRequest(b.dataset.delreq); toast('حُذف','ok'); render(); }
    catch(e){ toast('تعذّر: '+e.message,'err'); }
  });
}

// ===== داشبورد العميل: أين نحن الآن، المتأخر، المعالم القادمة =====
const CD_PHASES=[['0','التأسيس'],['B','الذكاء والرؤى'],['C','الاستراتيجية'],['A','التنفيذ']];
function vClientDash(){
  const tasks=PROJECT.tasks, dd=new Date(DATA_DATE);
  const real=tasks.filter(t=>t.type!=='milestone'&&t.type!=='cont');
  const done=real.filter(t=>t.status==='done').length;
  const _wsum=real.reduce((a,t)=>a+Math.max(1,t.duration||1),0);
  const pct=_wsum?Math.round(real.reduce((a,t)=>a+((TRACK&&TRACK[t.id]&&TRACK[t.id].dispPct)||0)*Math.max(1,t.duration||1),0)/_wsum):0;
  const fmt=d=>d?`${d.getDate()}/${d.getMonth()+1}`:'—';

  // 1) تدفّق المراحل: منجزة / جارية (أول ناقصة) / قادمة
  let currentFound=false;
  const flow=projTrackList().map(x=>[x.key,x.name]).filter(([k])=>real.some(t=>t.track===k)).map(([k,name])=>{
    const pt=real.filter(t=>t.track===k);
    const allDone=pt.every(t=>t.status==='done');
    let state='upcoming';
    if(allDone)state='done';
    else if(!currentFound){state='current';currentFound=true;}
    const clr=trackMeta(k).color;
    const pdone=pt.filter(t=>t.status==='done').length;
    return `<div class="cd-phase ${state}" style="--pc:${clr}">
      <div class="cd-phase-dot">${state==='done'?'✓':(state==='current'?'●':'')}</div>
      <div class="cd-phase-name">${name}</div>
      <div class="cd-phase-sub">${state==='done'?'مكتملة':(state==='current'?`جارية · ${pdone}/${pt.length}`:'قادمة')}</div>
    </div>`;
  }).join('<div class="cd-flow-arrow">←</div>');

  // 2) المتأخر
  const OWNER_AR={client:'بانتظاركم',alamah:'لدى علامة'};
  const late=real.filter(t=>{
    const tr=TRACK&&TRACK[t.id];
    return tr&&(tr.delay||tr.effStatus==='blocked')&&t.status!=='done';
  }).map(t=>{
    const tr=TRACK[t.id];const r=SCHED.R[t.id];
    const who=tr.delay?OWNER_AR[tr.delay]:'متوقفة';
    const cls=tr.delay==='client'?'cl':'al';
    return `<div class="cd-late-row"><span class="cd-late-name">${esc(t.name)}</span><span class="cd-late-who ${cls}">${who}</span><span class="cd-late-date">كان مخططًا: ${fmt(r&&r.EF)}</span></div>`;
  }).join('');

  // 3) المعالم القادمة (أقرب 3)
  const upMs=tasks.filter(t=>t.type==='milestone').map(t=>({t,ef:SCHED.R[t.id]&&SCHED.R[t.id].EF}))
    .filter(x=>x.ef&&x.ef>=dd&&x.t.status!=='done').sort((a,b)=>a.ef-b.ef).slice(0,3);
  const msHtml=upMs.length?upMs.map(x=>{
    const days=Math.ceil((x.ef-dd)/86400000);
    return `<div class="cd-ms"><span class="cd-ms-d">◆</span><div><b>${esc(x.t.name)}</b><span class="cd-ms-date">${fmt(x.ef)} · بعد ${days} يومًا</span></div></div>`;
  }).join(''):'<p class="empty">لا معالم قادمة.</p>';

  return `<div class="cdash">
    <div class="cd-hero">
      <div class="cd-hero-right">
        <h3>أين نحن الآن</h3>
        <div class="cd-flow">${flow}</div>
      </div>
      <div class="cd-prog">
        <div class="cd-prog-num">${pct}<small>%</small></div>
        <div class="cd-prog-lbl">نسبة الإنجاز</div>
        <div class="pbar"><div class="pbar-fill" style="width:${pct}%"></div></div>
        <div class="cd-prog-sub">${done} من ${real.length} بندًا</div>
      </div>
    </div>
    <div class="cd-grid">
      <div class="cd-card">
        <h4>${late?'بنود متأخرة تحتاج انتباهًا':'حالة المسار'}</h4>
        ${late||'<div class="cd-ontrack">✓ المشروع على المسار — لا تأخير حاليًا</div>'}
      </div>
      <div class="cd-card">
        <h4>المعالم القادمة</h4>
        ${msHtml}
      </div>
    </div>
  </div>`;
}
