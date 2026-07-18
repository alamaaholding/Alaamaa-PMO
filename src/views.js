// ===== العرض =====
const VIEW_LABELS={dashboard:'لوحة القيادة',table:'الجدول (MS Project)',gantt:'مخطط جانت',deliv:'المخرجات والمعالم',timeline:'خط التسليمات',cr:'طلبات تعديل الخطة',requests:'طلبات الخدمة',discuss:'النقاش',audit:'سجل المشروع'};
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
  $('#tabs').innerHTML=views.map(v=>`<button class="tab ${v===VIEW?'active':''} ${VIEW_TONE[v]?'tab-'+VIEW_TONE[v]:''}" role="tab" aria-selected="${v===VIEW}" data-v="${v}">${VIEW_ICONS[v]||''}<span>${VIEW_LABELS[v]}</span></button>`).join('');
  $$('#tabs .tab').forEach(b=>b.onclick=()=>{VIEW=b.dataset.v;render();});
  const host=$('#host');
  // حالة فارغة: مشروع بلا بنود — دعوة فعل واضحة (لا تبويبات فارغة)
  if(!PROJECT.tasks.length && VIEW!=='discuss' && VIEW!=='requests'){
    const canBuild=can('editStruct');
    host.innerHTML=`<div class="empty-cta"><div class="ico">${I.clipboard}</div><h3>لا توجد خطة بعد لهذا المشروع</h3>
      <p>${canBuild?'ابدأ ببناء خطة المشروع بإضافة أول بند، ثم عرّف المسارات والتبعيات.':'لم تُبنَ خطة هذا المشروع بعد. سيظهر المحتوى فور إعدادها من فريق إدارة المشاريع.'}</p>
      ${canBuild?`<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px"><button id="emptyImport" class="hbtn" style="background:var(--blue);border-color:var(--blue)">${I.upload} استيراد خطة من Excel</button><button id="emptyAdd" class="hbtn" style="background:var(--ok);border-color:var(--ok)">+ إضافة أول بند</button></div>`:''}</div>`;
    const ea=$('#emptyAdd');if(ea)ea.onclick=()=>{VIEW='table';handleAddTask();};
    const ei=$('#emptyImport');if(ei)ei.onclick=openImporter;
    return;
  }
  if(VIEW==='dashboard')host.innerHTML=(ROLE==='client')?vClientDash():vDashboard();
  else if(VIEW==='table'){host.innerHTML='<div class="hintbar">تحديث الحالة والتقدّم يُحفظ مباشرة في القاعدة. المسار الحرج مظلّل.</div>'+vTable();bindTable();}
  else if(VIEW==='gantt'){host.innerHTML=gToolbar()+vGantt();bindProjFilterBar();$('#zin').onclick=()=>{PX=Math.min(40,PX+4);render();};$('#zout').onclick=()=>{PX=Math.max(2,PX-4);render();};
    const pgb=$('#printGanttBtn');if(pgb)pgb.onclick=()=>printProject('gantt');
    const gt=$('#glToggle');if(gt){gt.classList.toggle('on',GLINKS_ON);gt.onclick=()=>{GLINKS_ON=!GLINKS_ON;try{localStorage.setItem('pmo_glinks',GLINKS_ON?'1':'0');}catch(_e){}render();};}
    const zf=$('#zfit');if(zf)zf.onclick=fitGantt;
    const bs=$('#blSel');if(bs)bs.onchange=()=>{GBASE=bs.value;
      const b=(PROJECT.baselines||[]).find(x=>x.id===GBASE);
      if(b)PROJECT.baseline={snapshot:b.snapshot};render();};
    document.querySelectorAll('[data-scale]').forEach(b=>{const on=b.dataset.scale===GSCALE;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');
      b.onclick=()=>{GSCALE=b.dataset.scale;try{localStorage.setItem('pmo_gscale',GSCALE);}catch(_e){}PX=GSCALE_PX[GSCALE]||16;render();};});
    bindGanttHover();drawGanttLinks();}
  else if(VIEW==='deliv')host.innerHTML=vDeliv();
  else if(VIEW==='timeline'){
    host.innerHTML='<div id="tlWrap"><div class="skeleton" style="height:120px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    openTimeline('tlWrap',PROJECT._dbId);
  }
  else if(VIEW==='cr'){host.innerHTML='<div class="hintbar exp-cr">📐 <b>طلبات تعديل الخطة:</b> تغييرات رسمية على بنود الخطة (مدد، تبعيات، إضافة/حذف). يقدّمها العميل أو الفريق، ويعتمدها مكتب إدارة المشاريع — وتُطبَّق على الجدول بعد الموافقة.</div>'+vCR();bindCR();}
  else if(VIEW==='discuss'){
    host.innerHTML='<div id="discussWrap"><div class="skeleton" style="height:80px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    loadComments(PROJECT._dbId).then(rows=>{const el=document.getElementById('discussWrap');if(el){el.innerHTML=vDiscuss(rows);bindDiscuss();}});
  }
  else if(VIEW==='requests'){
    host.innerHTML='<div id="reqWrap"><div class="skeleton" style="height:80px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    loadClientRequests(PROJECT._dbId).then(rows=>{const el=document.getElementById('reqWrap');if(el){el.innerHTML=vRequests(rows);bindRequests();}});
  }
  else if(VIEW==='audit'){
    host.innerHTML='<div class="hintbar">📋 <b>سجل المشروع:</b> آخر 60 تغييرًا على <b>هذا المشروع فقط</b> (الحالة، التقدّم، المدة، طلبات تعديل الخطة). للسجل الشامل لكل المشاريع والعملاء: «سجل المكتب» من شريط المحفظة.</div><div id="auditList"><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px"></div></div>';
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
  h+=sCurveSVG();
  return h;
}


// ===== فلترة الجدول والجانت (مدمجة، تُطبَّق على الاثنين معًا) =====
let TFILTER={phases:new Set(),statuses:new Set(),smart:new Set(),q:''};
function taskMatchesFilter(t){
  const k=TRACK&&TRACK[t.id];
  if(TFILTER.phases.size&&!TFILTER.phases.has(t.track))return false;
  if(TFILTER.statuses.size&&!TFILTER.statuses.has(k?k.effStatus:t.status))return false;
  if(TFILTER.smart.has('critical')&&!(SCHED.R[t.id]&&SCHED.R[t.id].critical))return false;
  if(TFILTER.smart.has('late')&&!(k&&(k.delay||k.effStatus==='blocked')&&t.status!=='done'))return false;
  if(TFILTER.smart.has('client')&&!(k&&k.delay==='client'))return false;
  if(TFILTER.q){const q=TFILTER.q.trim();
    if(!(t.name||'').includes(q)&&!(t.id||'').includes(q))return false;}
  return true;
}
function filteredTasks(){return PROJECT.tasks.filter(t=>t.type!=='package'&&taskMatchesFilter(t));}
// ===== هرمية WBS: ترتيب شجري + طيّ الحزم =====
let PKG_COLLAPSED=new Set();
function orderedTasks(){
  const byP={};PROJECT.tasks.forEach(t=>{const p=t.parent||'';(byP[p]=byP[p]||[]).push(t);});
  Object.values(byP).forEach(a=>a.sort((x,y)=>(x._sortOrder||0)-(y._sortOrder||0)));
  const out=[];const walk=t=>{out.push(t);(byP[t.id]||[]).forEach(walk);};
  (byP['']||[]).forEach(walk);return out;
}
function visibleTasks(){
  const ord=orderedTasks();
  const fA=TFILTER.phases.size||TFILTER.statuses.size||TFILTER.smart.size||TFILTER.q.trim();
  if(fA){
    const keep=new Set();
    ord.forEach(t=>{if(t.type!=='package'&&taskMatchesFilter(t))keep.add(t.id);});
    ord.forEach(t=>{if(keep.has(t.id)){let p=t.parent;
      while(p&&!keep.has(p)){keep.add(p);const pp=PROJECT.tasks.find(x=>x.id===p);p=pp?pp.parent:null;}}});
    return ord.filter(t=>keep.has(t.id));
  }
  return ord.filter(t=>{let p=t.parent;
    while(p){if(PKG_COLLAPSED.has(p))return false;const pp=PROJECT.tasks.find(x=>x.id===p);p=pp?pp.parent:null;}
    return true;});
}
function projFilterBar(){
  const _lv=PROJECT.tasks.filter(t=>t.type!=='package');
  const total=_lv.length, shown=filteredTasks().length;
  const phaseChips=projTrackList().map(x=>`<button class="tfchip" data-tf-phase="${x.key}" style="--tc:${x.color}" aria-pressed="${TFILTER.phases.has(x.key)}">${esc(x.name)}</button>`).join('');
  const stAr={notstarted:'لم تبدأ',inprogress:'جارية',blocked:'متوقفة',done:'مكتملة'};
  const statusChips=Object.keys(stAr).map(k=>`<button class="tfchip st-${k}" data-tf-status="${k}" aria-pressed="${TFILTER.statuses.has(k)}">${stAr[k]}</button>`).join('');
  const smartChips=[['critical','حرجة فقط'],['late','متأخرة'],['client','بانتظار العميل']]
    .map(([k,l])=>`<button class="tfchip smart" data-tf-smart="${k}" aria-pressed="${TFILTER.smart.has(k)}">${l}</button>`).join('');
  const anyActive=TFILTER.phases.size||TFILTER.statuses.size||TFILTER.smart.size||TFILTER.q;
  return `<div class="tfilter-bar">
    <div class="tfilter-row"><span class="tfacet-lbl">المرحلة:</span>${phaseChips}</div>
    <div class="tfilter-row"><span class="tfacet-lbl">الحالة:</span>${statusChips}<span class="tfacet-lbl">مرشّحات:</span>${smartChips}
      <input id="tfSearch" class="psearch tfsearch" placeholder="🔍 بحث بالاسم/المعرّف…" value="${esc(TFILTER.q)}">
      ${anyActive?'<button class="pchips-clear" id="tfClear">مسح الفلاتر</button>':''}
    </div>
    <div class="tfilter-count">يعرض <b>${shown}</b> من <b>${total}</b> بندًا</div>
  </div>`;
}
function bindProjFilterBar(){
  document.querySelectorAll('[data-tf-phase]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.tfPhase; TFILTER.phases.has(k)?TFILTER.phases.delete(k):TFILTER.phases.add(k); render();});
  document.querySelectorAll('[data-tf-status]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.tfStatus; TFILTER.statuses.has(k)?TFILTER.statuses.delete(k):TFILTER.statuses.add(k); render();});
  document.querySelectorAll('[data-tf-smart]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.tfSmart; TFILTER.smart.has(k)?TFILTER.smart.delete(k):TFILTER.smart.add(k); render();});
  const tfs=document.getElementById('tfSearch');
  if(tfs){tfs.oninput=()=>{TFILTER.q=tfs.value;clearTimeout(tfs._t);tfs._t=setTimeout(render,300);};
    if(TFILTER.q){setTimeout(()=>{tfs.focus();tfs.setSelectionRange(tfs.value.length,tfs.value.length);},0);}}
  const tfc=document.getElementById('tfClear');
  if(tfc)tfc.onclick=()=>{TFILTER={phases:new Set(),statuses:new Set(),smart:new Set(),q:''};render();};
  document.querySelectorAll('[data-pkgtoggle]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();
    const id=b.dataset.pkgtoggle;PKG_COLLAPSED.has(id)?PKG_COLLAPSED.delete(id):PKG_COLLAPSED.add(id);render();});
}

function vTable(){
  const S=SCHED,T=TRACK;const editStruct=can('editStruct')&&PROJECT.status!=='baselined';const editProg=can('editProg');
  const colspan=editStruct?12:11;
  let rows='',last=null;
  visibleTasks().forEach(t=>{
    if(t.track!==last){last=t.track;rows+=`<tr class="grp"><td colspan="${colspan}"><span class="grp-t">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</span>${ROLE==='pmo'?`<button class="grp-edit" data-grpedit="${esc(t.track)}" aria-label="تعديل المرحلة مباشرة" title="تعديل المرحلة">${I.pencil}</button>`:''}</td></tr>`;}
    const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
    // صف حزمة عمل: تجميعي مشتق، بطيّ/فتح
    if(t.type==='package'){
      const collapsed=PKG_COLLAPSED.has(t.id);
      const kidsN=PROJECT.tasks.filter(x=>x.parent===t.id).length;
      const pdelay=k&&k.delay==='client'?'<span class="delay client">العميل</span>':(k&&k.delay==='alamah'?'<span class="delay alamah">علامة</span>':'<span class="delay none">—</span>');
      rows+=`<tr data-id="${esc(t.id)}" class="row-pkg ${r&&r.critical?'crit':''}">
        <td><button class="pkg-tg" data-pkgtoggle="${esc(t.id)}" aria-expanded="${!collapsed}" aria-label="${collapsed?'فتح':'طي'} الحزمة">${collapsed?'◂':'▾'}</button><span class="idcell" style="--tc:${tc}">${esc(t.id)}</span></td>
        <td class="pkg-name">${esc(t.name)} <span class="pkg-n">${kidsN} بند</span></td>
        <td>حزمة عمل</td>
        <td><span class="dt">${r?r.dur:0}</span></td>
        <td><span class="dt s">${r?fmt(r.ES):'—'}</span></td>
        <td><span class="dt">${r?fmt(r.EF):'—'}</span></td>
        <td><span class="ministat s-${k?k.effStatus:'notstarted'}">${STATUS[k?k.effStatus:'notstarted']}</span></td>
        <td><span class="pkg-pct">${k?k.dispPct:0}%</span></td>
        <td>${pdelay}</td>
        <td>—</td>
        <td style="font-size:.74rem;color:var(--muted)">تجميعي — يُشتق من أبنائه</td>
        ${editStruct?`<td><button class="ib" data-del="${esc(t.id)}" title="حذف الحزمة (يصعد أبناؤها للمستوى الأعلى)" aria-label="حذف الحزمة" style="color:var(--crit)">${I.trash}</button></td>`:''}
      </tr>`;
      return;
    }
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
      <td class="${t.parent?'child-cell':''}">${t.parent?'<span class="tree-ind" aria-hidden="true">└</span>':''}${nameCell}</td>
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
  const MOBILE=(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(max-width:700px)').matches);
  const editHead=editStruct?'<th>تحرير</th>':'';
  const addBar=editStruct?`<div class="lockbar" style="border-inline-start-color:var(--ok)"><span>أداة بناء الخطة:</span><button class="reqbtn" id="addTaskBtn" style="background:var(--ok);border-color:var(--ok);color:#fff">+ إضافة بند</button><button class="reqbtn" id="importXlsxBtn" style="background:var(--blue);border-color:var(--blue);color:#fff">${I.upload} استيراد من Excel</button>${ROLE==='pmo'?'<button class="reqbtn" id="tracksBtn" style="background:var(--ink);border-color:var(--ink);color:#fff">إدارة المراحل</button>':''}<span style="color:var(--muted);font-weight:400;font-size:.78rem">المعرّف فريد (مثل B10). أو استورد خطة كاملة من ملف Excel.</span></div>`:'';
  const printBtn=`<div class="lockbar" style="border-inline-start-color:var(--line)"><button class="hbtn print-btn" id="printTableBtn">🖨 طباعة الجدول</button><span style="color:var(--muted);font-weight:400;font-size:.78rem">تُطبع كل مرحلة في صفحة، والأعمدة مصغّرة للقراءة.</span></div>`;
  if(MOBILE)return addBar+projFilterBar()+vCards(editStruct,editProg);
  return addBar+printBtn+projFilterBar()+`<div class="tablewrap"><table id="tbl"><thead><tr><th>المعرف</th><th>الاسم</th><th>النوع</th><th>مدة</th><th>بداية</th><th>نهاية</th><th>الحالة</th><th>تقدّم</th><th>التأخير</th><th>متطلبات</th><th>المخرج</th>${editHead}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
// عرض البطاقات للجوّال: نفس البيانات والفلاتر والربط، بلا تمرير أفقي
function vCards(editStruct,editProg){
  const S=SCHED,T=TRACK;let out='',last=null;
  visibleTasks().forEach(t=>{
    const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
    if(t.track!==last){last=t.track;
      out+=`<div class="tc-grp"><span class="grp-t">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</span>${ROLE==='pmo'?`<button class="grp-edit" data-grpedit="${esc(t.track)}" aria-label="تعديل المرحلة">${I.pencil}</button>`:''}</div>`;}
    if(t.type==='package'){
      const collapsed=PKG_COLLAPSED.has(t.id);
      const kidsN=PROJECT.tasks.filter(x=>x.parent===t.id).length;
      out+=`<div class="tcard pkg ${r&&r.critical?'crit':''}" data-id="${esc(t.id)}">
        <div class="tc-top">
          <button class="pkg-tg" data-pkgtoggle="${esc(t.id)}" aria-expanded="${!collapsed}">${collapsed?'◂':'▾'}</button>
          <span class="idcell" style="--tc:${tc}">${esc(t.id)}</span>
          <span class="tc-name"><b>${esc(t.name)}</b></span>
          <span class="pkg-pct">${k?k.dispPct:0}%</span>
        </div>
        <div class="tc-meta"><span>${r?fmt(r.ES):'—'} ← ${r?fmt(r.EF):'—'}</span><span>${kidsN} بند</span><span class="ministat s-${k?k.effStatus:'notstarted'}">${STATUS[k?k.effStatus:'notstarted']}</span></div>
        <div class="pbar mini"><div class="pbar-fill" style="width:${k?k.dispPct:0}%"></div></div>
      </div>`;
      return;
    }
    const sopt=Object.keys(STATUS).map(x=>`<option value="${x}" ${x===t.status?'selected':''}>${STATUS[x]}</option>`).join('');
    const pct=(k&&k.dispPct)||t.progress||0;
    const reqs=(t.requirements||[]);const bad=reqs.filter(x=>x._state==='overdue').length;
    const badges=[];
    if(r&&r.critical)badges.push('<span class="tc-b crit">حرج</span>');
    if(k&&k.delay==='client')badges.push('<span class="tc-b cl">بانتظار العميل</span>');
    else if(k&&k.delay==='alamah')badges.push('<span class="tc-b al">تأخير علامة</span>');
    if(t.type==='milestone')badges.push('<span class="tc-b ms">◆ معلم</span>');
    out+=`<div class="tcard ${r&&r.critical?'crit':''} ${t.parent?'child':''}" data-id="${esc(t.id)}">
      <div class="tc-top">
        <span class="idcell" style="--tc:${tc}">${esc(t.id)}</span>
        <span class="tc-name">${esc(t.name)}</span>
      </div>
      ${badges.length?`<div class="tc-badges">${badges.join('')}</div>`:''}
      <div class="tc-meta"><span>${fmt(r.ES)} ← ${fmt(r.EF)}</span><span>${t.type==='cont'?'مستمر':(t.duration||0)+' ي'}</span></div>
      ${t.type!=='milestone'?`<div class="tc-prog"><div class="pbar mini"><div class="pbar-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`:''}
      <div class="tc-acts">
        <select class="st st-${k.effStatus}" data-f="status" ${editProg?'':'disabled'}>${sopt}</select>
        <button class="reqbtn" data-reqs="${esc(t.id)}">${reqs.length?(bad?bad+'⚠ متطلبات':reqs.length+' متطلبات'):'متطلبات'}</button>
        ${editStruct?`<button class="reqbtn" data-deps="${esc(t.id)}" aria-label="التبعيات">${I.link} ${(t.deps||[]).length||''}</button><button class="ib" data-del="${esc(t.id)}" aria-label="حذف" style="color:var(--crit)">${I.trash}</button>`:''}
      </div>
    </div>`;
  });
  const _lv2=PROJECT.tasks.filter(t=>t.type!=='package');
  if(!out)out='<p class="pempty">لا بنود مطابقة.</p>';
  return `<div id="tbl" class="cardwrap">${out}</div>`;
}
function bindTable(){
  bindProjFilterBar();
  const editStruct=can('editStruct')&&PROJECT.status!=='baselined';
  $$('#tbl [data-id]').forEach(tr=>{
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
  $$('#tbl [data-pkgtoggle]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();
    const id=b.dataset.pkgtoggle;PKG_COLLAPSED.has(id)?PKG_COLLAPSED.delete(id):PKG_COLLAPSED.add(id);render();});
  $$('#tbl [data-grpedit]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();inlineTrackEdit(b.dataset.grpedit,b.closest('td')||b.closest('.tc-grp'));});
  const ptb=$('#printTableBtn');if(ptb)ptb.onclick=()=>printProject('table');
}
// تعديل المرحلة مباشرة من عنوانها في الجدول (اسم + لون، حفظ فوري)
function inlineTrackEdit(key,td){
  const tr=(PROJECT.tracks||[]).find(x=>x.key===key);
  if(!tr){if(typeof openTracksManager==='function')openTracksManager();return;}
  td.innerHTML=`<span class="grp-inline">
    <input type="color" class="gie-c" value="${tr.color}" aria-label="لون المرحلة">
    <input class="gie-n" value="${esc(tr.name)}" aria-label="اسم المرحلة">
    <button class="reqbtn gie-s" style="background:var(--gold);border-color:var(--gold);color:#fff">حفظ</button>
    <button class="reqbtn gie-x" style="background:#fff;color:var(--ink)">إلغاء</button></span>`;
  td.querySelector('.gie-x').onclick=()=>render();
  td.querySelector('.gie-s').onclick=async()=>{
    const name=td.querySelector('.gie-n').value.trim();
    const color=td.querySelector('.gie-c').value;
    if(!name){toast('الاسم مطلوب','warn');return;}
    try{await updateTrack(tr.id,{name,color});
      PROJECT.tracks=await fetchTracks(PROJECT._dbId);
      toast('حُدّثت المرحلة','ok');render();
    }catch(err){toast('تعذّر التحديث','err');}};
  const n=td.querySelector('.gie-n');n.focus();n.setSelectionRange(n.value.length,n.value.length);
  n.onkeydown=(e)=>{if(e.key==='Enter')td.querySelector('.gie-s').click();if(e.key==='Escape')render();};
}

function gToolbar(){return `<div class="gctrl"><div class="hintbar" style="margin:0">الزمن من اليمين للأقدم · لون النقطة=الحالة · الخط الأزرق=اليوم · الشريط الرفيع=الأساس المعتمد.</div>${(PROJECT.baselines&&PROJECT.baselines.length)?`<select id="blSel" class="pfsort" aria-label="اختيار الأساس" style="font-size:.72rem">${PROJECT.baselines.map((b,i)=>`<option value="${b.id}" ${(!GBASE&&i===PROJECT.baselines.length-1)||GBASE===b.id?'selected':''}>${esc(b.label||("الأساس "+(i+1)))}</option>`).join('')}</select>`:''}<div class="gscale" role="group" aria-label="مقياس الزمن" style="margin-inline-start:auto"><button class="gsc" data-scale="day">يوم</button><button class="gsc" data-scale="week">أسبوع</button><button class="gsc" data-scale="month">شهر</button><button class="gsc" data-scale="quarter">ربع</button></div><button class="hbtn print-btn" id="printGanttBtn">🖨 طباعة الجانت</button><div class="zoom"><button class="zb" id="glToggle" title="إظهار/إخفاء روابط التبعية" aria-label="روابط التبعية">⇄</button><button class="zb" id="zfit" title="ملاءمة العرض للشاشة" aria-label="ملاءمة العرض">⤢</button><button class="zb" id="zout">−</button><button class="zb" id="zin">+</button></div></div>`;}
// ===== مقياس الزمن متعدد المستويات (يوم/أسبوع/شهر/ربع) =====
let GSCALE='week';try{const _gs=localStorage.getItem('pmo_gscale');if(_gs)GSCALE=_gs;}catch(_e){}
const GSCALE_PX={day:30,week:16,month:6,quarter:3};
const _MNAR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function ganttScaleHeader(lo,hi,off,px,scale,fmt){
  const oneDay=86400000;let top='',bot='',grid='',wkends='';
  const T=(x,w,t)=>`<div class="mhead" style="right:${x}px;width:${w}px">${t}</div>`;
  if(scale==='day'){
    let d=new Date(lo);
    while(d<=hi){const nx=new Date(d.getFullYear(),d.getMonth()+1,1);const se=nx>hi?hi:new Date(nx-oneDay);const days=Math.round((se-d)/oneDay)+1;top+=T(off(d)*px,days*px,_MNAR[d.getMonth()]+' '+d.getFullYear());d=nx;}
    let dd=new Date(lo);
    while(dd<=hi){const g=dd.getDay(),iso=isoLocal(dd),hol=(typeof HOLIDAYS!=='undefined'&&HOLIDAYS.has(iso)),we=(g===5||g===6)||hol;
      if(hol)wkends+=`<div class="wkend hol" style="right:${off(dd)*px}px;width:${px}px" title="${(window.HOLIDAY_NAMES&&window.HOLIDAY_NAMES[iso])||'عطلة'}"></div>`;
      bot+=`<div class="dhead${we?' we':''}${hol?' hd':''}" title="${hol?((window.HOLIDAY_NAMES&&window.HOLIDAY_NAMES[iso])||'عطلة'):''}" style="right:${off(dd)*px}px;width:${px}px">${dd.getDate()}</div>`;if(dd.getDay()===0)grid+=`<div class="vg" style="right:${off(dd)*px}px"></div>`;if(we)wkends+=`<div class="wkend" style="right:${off(dd)*px}px;width:${px}px"></div>`;dd=new Date(dd.getTime()+oneDay);}
  }else if(scale==='month'){
    let q=new Date(lo.getFullYear(),Math.floor(lo.getMonth()/3)*3,1);
    while(q<=hi){const qs=q<lo?lo:q;const nq=new Date(q.getFullYear(),q.getMonth()+3,1);const qe=nq>hi?hi:new Date(nq-oneDay);const w=Math.round((qe-qs)/oneDay)+1;top+=T(off(qs)*px,w*px,'الربع '+(Math.floor(q.getMonth()/3)+1)+' — '+q.getFullYear());q=nq;}
    let m=new Date(lo.getFullYear(),lo.getMonth(),1);
    while(m<=hi){const ms=m<lo?lo:m;const nm=new Date(m.getFullYear(),m.getMonth()+1,1);const me=nm>hi?hi:new Date(nm-oneDay);const w=Math.round((me-ms)/oneDay)+1;bot+=`<div class="whead" style="right:${off(ms)*px}px;width:${w*px}px"><b>${_MNAR[m.getMonth()]}</b></div>`;grid+=`<div class="vg" style="right:${off(ms)*px}px"></div>`;m=nm;}
  }else if(scale==='quarter'){
    let y=new Date(lo.getFullYear(),0,1);
    while(y<=hi){const ys=y<lo?lo:y;const ny=new Date(y.getFullYear()+1,0,1);const ye=ny>hi?hi:new Date(ny-oneDay);const w=Math.round((ye-ys)/oneDay)+1;top+=T(off(ys)*px,w*px,''+y.getFullYear());y=ny;}
    let q=new Date(lo.getFullYear(),Math.floor(lo.getMonth()/3)*3,1);
    while(q<=hi){const qs=q<lo?lo:q;const nq=new Date(q.getFullYear(),q.getMonth()+3,1);const qe=nq>hi?hi:new Date(nq-oneDay);const w=Math.round((qe-qs)/oneDay)+1;bot+=`<div class="whead" style="right:${off(qs)*px}px;width:${w*px}px"><b>ربع ${Math.floor(q.getMonth()/3)+1}</b></div>`;grid+=`<div class="vg" style="right:${off(qs)*px}px"></div>`;q=nq;}
  }else{ // week (افتراضي)
    let d=new Date(lo);
    while(d<=hi){const nx=new Date(d.getFullYear(),d.getMonth()+1,1);const se=nx>hi?hi:new Date(nx-oneDay);const days=Math.round((se-d)/oneDay)+1;top+=T(off(d)*px,days*px,_MNAR[d.getMonth()]+' '+d.getFullYear());d=nx;}
    let wk=new Date(lo),wi=1;
    while(wk<=hi){bot+=`<div class="whead" style="right:${off(wk)*px}px;width:${7*px}px"><b>أسبوع ${wi}</b><s>${fmt(wk)}</s></div>`;grid+=`<div class="vg" style="right:${off(wk)*px}px"></div>`;wk=new Date(wk.getTime()+7*oneDay);wi++;}
    let wd=new Date(lo);
    while(wd<=hi){const g=wd.getDay(),iso=isoLocal(wd);
      if(typeof HOLIDAYS!=='undefined'&&HOLIDAYS.has(iso)){wkends+=`<div class="wkend hol" style="right:${off(wd)*px}px;width:${px}px" title="${(window.HOLIDAY_NAMES&&window.HOLIDAY_NAMES[iso])||'عطلة'}"></div>`;wd=new Date(wd.getTime()+oneDay);continue;}
      if(g===5){wkends+=`<div class="wkend" style="right:${off(wd)*px}px;width:${2*px}px"></div>`;wd=new Date(wd.getTime()+2*oneDay);continue;}
      if(g===6){wkends+=`<div class="wkend" style="right:${off(wd)*px}px;width:${px}px"></div>`;}wd=new Date(wd.getTime()+oneDay);}
  }
  return {top,bot,grid,wkends};
}
function vGantt(){
  const S=SCHED,T=TRACK,start=S.pStart,end=S.pEnd,oneDay=86400000,dd=D(DATA_DATE);
  const lo=start<dd?start:dd,hi=end>dd?end:dd,totalDays=Math.round((hi-lo)/oneDay)+3,W=totalDays*PX;
  const off=d=>Math.round((new Date(d)-lo)/oneDay);
  const HD=ganttScaleHeader(lo,hi,off,PX,GSCALE,fmt);
  const today=`<div class="today" style="right:${off(dd)*PX}px"><span>اليوم ${fmt(dd)}</span></div>`;
  const BL=PROJECT.baseline?PROJECT.baseline.snapshot:null;let rows='',last=null; const _fg=visibleTasks();
  _fg.forEach(t=>{const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
    if(t.track!==last){last=t.track;rows+=`<div class="grow grp"><div class="glbl">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</div><div class="glane"></div></div>`;}
    const o=off(r.ES);
    const overdue=(t.status!=='done'&&t.type!=='cont'&&t.type!=='package'&&r&&dd>r.EF);
    const lateDays=overdue?Math.max(1,wdBetween(r.EF,dd)-1):0;
    const who=(k&&k.delay==='client')?'client':'alamah';
    const tip=`${esc(t.name)} — ${fmt(r.ES)}–${fmt(r.EF)} | ${STATUS[k.effStatus]}${overdue?` | متأخر ${lateDays} يوم عمل`:''}`;
    let lane='';
    if(BL&&BL[t.id]&&t.type!=='milestone'){const bo=off(D(BL[t.id].ES)),bl=Math.max(1,Math.round((D(BL[t.id].EF)-D(BL[t.id].ES))/oneDay)+1);lane+=`<div class="blbar" style="right:${bo*PX}px;width:${bl*PX}px"></div>`;}
    if(t.type==='package'){
      const len=Math.max(1,Math.round((new Date(r.EF)-new Date(r.ES))/oneDay)+1),wpx=len*PX;
      lane+=`<div class="gpkg ${r.critical?'crit':''}" data-gid="${esc(t.id)}" style="right:${o*PX}px;width:${wpx}px;--pc:${tc}" title="${tip}"></div>`;
      rows+=`<div class="grow row-gpkg" data-grow="${esc(t.id)}"><div class="glbl"><button class="pkg-tg" data-pkgtoggle="${esc(t.id)}" aria-expanded="${!PKG_COLLAPSED.has(t.id)}">${PKG_COLLAPSED.has(t.id)?'◂':'▾'}</button><span class="gw" style="--tc:${tc}">${esc(t.id)}</span><b>${esc(t.name)}</b></div><div class="glane">${lane}</div></div>`;
      return;
    }
    if(t.type==='milestone')lane+=`<div class="gmile ${r.critical?'crit':''} ${overdue?'late':''}" data-gid="${esc(t.id)}" style="right:${o*PX-7}px" title="${tip}"><span class="md">◆</span><span class="ml">${esc(t.id)}</span>${overdue?`<span class="ml lt">+${lateDays}ي</span>`:''}</div>`;
    else{const len=Math.max(1,Math.round((new Date(r.EF)-new Date(r.ES))/oneDay)+1),wpx=len*PX;const cls=(t.type==='cont')?'cont':k.effStatus;const prog=t.type==='cont'?0:((k&&k.dispPct)||t.progress||0);
      const fill=(k.effStatus==='inprogress'&&prog>0)?`<div class="fill" style="width:${prog}%"></div>`:'';
      const durTxt=(t.type==='cont')?'مستمر':(t.duration+' ي'+(prog?' · '+prog+'%':''));const inside=wpx>56;
      const durEl=inside?`<div class="gdur inside" style="right:${o*PX+6}px">${durTxt}</div>`:(overdue?'':`<div class="gdur" style="right:${(o+len)*PX+4}px">${durTxt}</div>`);
      let tail='';
      if(overdue){
        const to=o+len,tl=Math.max(1,off(dd)-to);
        tail=`<div class="gtail ${who}" style="right:${to*PX}px;width:${tl*PX}px" title="امتداد التأخير حتى اليوم"></div><div class="glate ${who}" style="right:${(to+tl)*PX+5}px">${who==='client'?'بانتظار العميل':'متأخر'} +${lateDays}ي</div>`;
      }
      lane+=`<div class="gbar ${cls} ${r.critical?'crit':''} ${overdue?'late late-'+who:''}" data-gid="${esc(t.id)}" style="right:${o*PX}px;width:${wpx}px;background:${tc}" title="${tip}">${fill}</div>${tail}${durEl}`;}
    rows+=`<div class="grow" data-grow="${esc(t.id)}"><div class="glbl ${t.parent?'gchild':''}"><span class="sdot ${k.effStatus}"></span><span class="gw" style="--tc:${tc}">${esc(t.wbs||t.id)}</span>${esc(t.name)}</div><div class="glane">${lane}</div></div>`;});
  return projFilterBar()+baselineDeviation(BL)+`<div class="gantt"><div class="gscroll"><div style="min-width:${280+W}px">
    <div class="thead"><div class="corner"><span>حزمة العمل</span><span class="dir">الأقدم ← الأحدث</span></div><div class="tl" style="width:${W}px">${HD.top}${HD.bot}</div></div>
    <div id="gcanvas" style="position:relative"><div style="position:absolute;right:280px;left:0;top:0;bottom:0;pointer-events:none">${HD.wkends}${HD.grid}${today}</div>${rows}</div></div></div>
    <div class="glegend"><span><span class="di"></span>معلم</span><span><span class="ci"></span>حرج</span>${BL?'<span><i class="blleg"></i>الأساس المعتمد</span>':''}<span><span class="dot" style="background:#cbbfa6"></span>لم تبدأ</span><span><span class="dot" style="background:var(--blue)"></span>جارية</span><span><span class="dot" style="background:var(--crit)"></span>متوقفة</span><span><span class="dot" style="background:var(--ok)"></span>مكتملة ✓</span><span><i class="tleg cl"></i>تأخير بانتظار العميل</span><span><i class="tleg al"></i>تأخير علامة</span><span><i class="wkleg"></i>عطلة الأسبوع</span><span><i class="lkleg">⟵</i>رابط تبعية</span></div></div>`;
}

// ===== منحنى S: المخطط تراكميًا من CPM + نقطة المكتسب الحالية =====
function sCurveSVG(){
  const leafs=PROJECT.tasks.filter(t=>t.type!=='package'&&t.type!=='cont'&&SCHED.R[t.id]);
  if(!leafs.length)return '';
  const lo=SCHED.pStart,hi=SCHED.pEnd,oneDay=86400000;
  const days=Math.max(2,Math.round((hi-lo)/oneDay)+1);
  const daily=new Array(days).fill(0);let total=0;
  leafs.forEach(t=>{const r=SCHED.R[t.id];const w=Math.max(1,r.dur||1);total+=w;
    const span=Math.max(1,wdBetween(r.ES,r.EF));const per=w/span;
    let d=new Date(r.ES);
    while(d<=r.EF){if(isWorkday(d)){const i=Math.round((d-lo)/oneDay);if(i>=0&&i<days)daily[i]+=per;}d=new Date(d.getTime()+oneDay);}});
  let acc=0;const pts=[];
  for(let i=0;i<days;i++){acc+=daily[i];pts.push(Math.min(100,acc/Math.max(1,total)*100));}
  let ews=0,ea=0;leafs.forEach(t=>{const k=TRACK[t.id];const w=Math.max(1,SCHED.R[t.id].dur||1);ews+=w;ea+=((k&&k.dispPct)||0)*w;});
  const earned=ews?ea/ews:0;
  const dd=D(DATA_DATE);const ti=Math.max(0,Math.min(days-1,Math.round((dd-lo)/oneDay)));
  const plannedNow=pts[ti]||0;
  const W=640,H=175,PL=40,PB=24;
  const X=i=>PL+((days-1-i)/(days-1))*(W-PL-10);
  const Y=p=>10+(100-p)/100*(H-PB-10);
  const line=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p).toFixed(1)).join(' ');
  const grid=[0,25,50,75,100].map(g=>`<line x1="${PL}" x2="${W-10}" y1="${Y(g)}" y2="${Y(g)}" class="sc-grid"/><text x="${PL-6}" y="${Y(g)+3}" class="sc-lbl">${g}%</text>`).join('');
  const varAbs=Math.round(earned-plannedNow);
  return `<div class="card scurve"><div class="ch">منحنى S — المخطط مقابل المكتسب
      <span class="sc-var ${varAbs>=0?'ok':'bad'}">${varAbs>=0?'+':''}${varAbs}% عن المخطط</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="منحنى التقدم المخطط والمكتسب">
      ${grid}
      <path d="${line}" class="sc-plan"/>
      <line x1="${X(ti)}" x2="${X(ti)}" y1="10" y2="${H-PB}" class="sc-today"/>
      <circle cx="${X(ti)}" cy="${Y(plannedNow)}" r="4" class="sc-pdot"/>
      <circle cx="${X(ti)}" cy="${Y(earned)}" r="5.5" class="sc-edot"/>
      <text x="${X(ti)+8}" y="${Y(earned)-9}" class="sc-elbl">مكتسب ${Math.round(earned)}%</text>
    </svg>
    <div class="sc-leg"><span><i class="sc-i plan"></i>المخطط (تراكمي CPM)</span><span><i class="sc-i earn"></i>المكتسب بتاريخ الحالة</span><span class="sc-note">القراءة التاريخية للمكتسب تتعمّق مع الاستخدام</span></div>
  </div>`;
}
let GBASE=null; // الأساس المختار للعرض
function baselineDeviation(BL){
  if(!BL)return '';
  let slipped=0,net=0;
  PROJECT.tasks.forEach(t=>{const b=BL[t.id],r=SCHED.R[t.id];
    if(!b||!r||t.type==='cont'||t.type==='package')return;
    const dv=wdBetween(new Date(b.EF+'T00:00:00'),r.EF)-1;
    if(dv>0){slipped++;net+=dv;}else if(dv<0)net+=dv;});
  if(!slipped&&net===0)return '<div class="bl-dev ok">✓ مطابق للأساس المختار — لا انحراف</div>';
  return `<div class="bl-dev ${net>0?'bad':'ok'}">الانحراف عن الأساس: <b>${slipped}</b> بندًا منزلقًا · صافي <b>${net>0?'+':''}${net}</b> يوم عمل</div>`;
}
// ===== أسهم التبعيات (SVG كوعية بأسهم — معيار MS Project) =====
let GLINKS_ON=true;try{GLINKS_ON=(localStorage.getItem('pmo_glinks')!=='0');}catch(_e){}
function drawGanttLinks(){
  const canvas=document.getElementById('gcanvas');if(!canvas)return;
  const old=document.getElementById('glinks');if(old)old.remove();
  if(!GLINKS_ON)return;
  const bars={};
  canvas.querySelectorAll('[data-gid]').forEach(b=>{bars[b.dataset.gid]=b;});
  const cr=canvas.getBoundingClientRect();
  let paths='';
  PROJECT.tasks.forEach(t=>{
    ((t.depsX&&t.depsX.length)?t.depsX:(t.deps||[])).forEach(d=>{
      const A=bars[d.ref||d],B=bars[t.id];if(!A||!B)return;
      const dtype=(d.type||'FS');
      const ra=A.getBoundingClientRect(),rb=B.getBoundingClientRect();
      // مراسي حسب النوع: FS نهاية←بداية · SS بداية←بداية · FF نهاية←نهاية
      const x1=(dtype==='SS'?ra.right:ra.left)-cr.left, y1=ra.top-cr.top+ra.height/2;
      const x2=(dtype==='FF'?rb.left:rb.right)-cr.left, y2=rb.top-cr.top+rb.height/2;
      const crit=A.classList.contains('crit')&&B.classList.contains('crit');
      const bend=Math.min(x1,x2)-9;
      paths+=`<path d="M ${x1} ${y1} L ${bend} ${y1} L ${bend} ${y2} L ${x2-1} ${y2}" class="glink ${crit?'crit':''} lt-${dtype}" marker-end="url(#${crit?'garrc':'garr'})" data-lfrom="${esc(d.ref||d)}" data-lto="${esc(t.id)}"/>`;
    });
  });
  if(!paths)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.id='glinks';svg.setAttribute('aria-hidden','true');
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:visible';
  svg.innerHTML=`<defs>
    <marker id="garr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#a08d68"/></marker>
    <marker id="garrc" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#a8442f"/></marker>
  </defs>`+paths;
  canvas.appendChild(svg);
}
// ملاءمة المقياس لعرض الشاشة (Fit-to-width)
function fitGantt(){
  const sc=document.querySelector('.gscroll');if(!sc||!SCHED)return;
  const dd=D(DATA_DATE);
  const lo=SCHED.pStart<dd?SCHED.pStart:dd, hi=SCHED.pEnd>dd?SCHED.pEnd:dd;
  const days=Math.round((hi-lo)/86400000)+3;
  PX=Math.max(4,Math.min(40,Math.floor((sc.clientWidth-300)/Math.max(1,days))));
  render();
}
// تحويم على شريط: يبقي سلسلته (تبعيات + معتمدون عليه + حزمته) ويخفت الباقي
function bindGanttHover(){
  const cont=document.querySelector('.gantt');if(!cont||cont._hoverBound)return;cont._hoverBound=true;
  const chain=id=>{
    const t=PROJECT.tasks.find(x=>x.id===id);const s=new Set([id]);if(!t)return s;
    (t.deps||[]).forEach(d=>s.add(d));
    PROJECT.tasks.forEach(x=>{if((x.deps||[]).includes(id))s.add(x.id);});
    if(t.parent)s.add(t.parent);
    if(t.type==='package')PROJECT.tasks.forEach(x=>{if(x.parent===id)s.add(x.id);});
    return s;};
  cont.addEventListener('mouseover',e=>{
    const b=e.target.closest('[data-gid]');if(!b)return;
    const s=chain(b.dataset.gid);
    cont.querySelectorAll('.grow[data-grow]').forEach(rw=>rw.classList.toggle('gdim',!s.has(rw.dataset.grow)));
    cont.querySelectorAll('.glink').forEach(p=>p.classList.toggle('gdimL',!(s.has(p.dataset.lfrom)&&s.has(p.dataset.lto))));});
  cont.addEventListener('mouseout',e=>{
    if(e.target.closest&&e.target.closest('[data-gid]'))
      {cont.querySelectorAll('.grow.gdim').forEach(rw=>rw.classList.remove('gdim'));
       cont.querySelectorAll('.glink.gdimL').forEach(p=>p.classList.remove('gdimL'));}});
}
function vDeliv(){
  const S=SCHED,T=TRACK;let rows='';
  PROJECT.tasks.forEach(t=>{if(!t.deliverable)return;const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color,isM=t.type==='milestone';
    rows+=`<tr class="${isM?'m':''}"><td style="font-weight:${isM?700:500}">${isM?'◆ ':''}${esc(t.deliverable)}</td><td><span class="idcell" style="--tc:${tc}">${esc(t.id)}</span> ${esc(t.name)}</td><td><span class="pill" style="background:${tc}">${esc(trackMeta(t.track).name)}</span></td><td>${fmt(r.EF)}/${new Date(r.EF).getFullYear()}</td><td><span class="ministat s-${k.effStatus}">${STATUS[k.effStatus]}</span></td></tr>`;});
  return `<div class="dwrap"><table class="dtbl"><thead><tr><th>المخرج</th><th>البند</th><th>المسار</th><th>التسليم المتوقع</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// نغمة الحدث في السجل: أخضر للاعتماد/الاسترجاع، أحمر للحذف/الرفض، محايد لغيرها
function auditTone(action){
  if(/purge|_delete$|^request_deletion|^request_project_deletion|cr_rejected/.test(action))return 'rejected';
  if(/cr_approved|^restore_|comment_resolve/.test(action))return 'approved';
  return 'pending';
}
function vAudit(rows){
  if(!rows||!rows.length)return '<p class="empty" style="padding:20px;text-align:center">لا تغييرات مسجّلة بعد.</p>';
  // القاموس موحّد مع سجل المكتب (AUDIT_ACTIONS في config.js) — لا تعريف محلي مكرّر
  const ACT=AUDIT_ACTIONS,ENT=AUDIT_ENTITIES;
  // خريطة معرّف البند → اسمه (للعرض المفهوم)
  const taskById={};PROJECT.tasks.forEach(t=>{taskById[t._dbId]=t;});
  const rowsHtml=rows.map(a=>{
    const act=ACT[a.action]||a.action;
    const nv=a.new_value||null,ov=a.old_value||null;
    let detail='';
    if(a.action==='status_change'&&ov&&nv){detail=`${STATUS[ov.status]||ov.status} ← ${STATUS[nv.status]||nv.status}`;}
    else if(a.action==='progress_change'&&nv){detail=`${ov?ov.progress:0}% ← ${nv.progress}%`;}
    else if(a.action==='duration_change'&&nv){detail=`${ov?ov.duration:'?'} ← ${nv.duration} يوم`;}
    else if(a.action==='client_request_status'&&nv){detail=`${(ov&&ov.status)||'—'} ← ${nv.status||'—'}`;}
    else{
      // احتياطي عام: أول حقل نصّي ذي معنى من القيمة الجديدة ثم القديمة
      const pick=o=>o&&(o.reason||o.description||o.title||o.body||o.name||o.kind||o.task_ref||null);
      const v=pick(nv)||pick(ov)||'';
      if(v)detail=esc(String(v).slice(0,90));
    }
    const t=a.entity==='task'?taskById[a.entity_id]:null;
    const target=t?(esc(t.id)+' — '+esc(t.name)):(ENT[a.entity]||a.entity||'—');
    const when=new Date(a.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    return `<tr>
      <td style="white-space:nowrap;font-size:.76rem;color:var(--muted)">${when}</td>
      <td><span class="crstate ${auditTone(a.action)}" style="font-size:.7rem">${act}</span></td>
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
  const explainer='<div class="hintbar exp-rq">🛎 <b>طلبات الخدمة:</b> احتياجات تشغيلية تُوجَّه لقسم مختص (تسويق، تقني، استراتيجية…) — مثل تصميم أو محتوى أو دعم. <b>لا تعدّل الخطة</b>؛ لتعديل الخطة استخدم «طلبات تعديل الخطة».</div>';
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
  return explainer+composer+'<div class="crlist">'+cards+'</div>';
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
