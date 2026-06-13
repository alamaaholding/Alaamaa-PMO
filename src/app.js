// ===== الحالة =====
let USER=null,ROLE=null,CLIENTS=[],CID=null,PROJECT=null,SCHED=null,TRACK=null,DATA_DATE=todayISO(),PX=20,VIEW='dashboard',CRS=[];
let SCREEN='portfolio'; // portfolio | project — للطاقم؛ العميل دائمًا project

// ===== الإشعارات (Toast) =====
function toast(msg, kind){ // kind: ok | err | warn | (افتراضي)
  const wrap=document.getElementById('toastWrap'); if(!wrap)return;
  const t=document.createElement('div'); t.className='toast'+(kind?' '+kind:'');
  const icon=kind==='ok'?'✓':kind==='err'?'✕':kind==='warn'?'⚠':'•';
  t.innerHTML='<span>'+icon+'</span><span>'+msg+'</span>';
  wrap.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300);},3200);
}


// ===== بدء التطبيق =====
async function startApp(){
  $('#login').classList.add('hidden');$('#loader').classList.remove('hidden');
  await loadClients();
  $('#app').classList.remove('hidden');$('#loader').classList.add('hidden');
  $('#uName').textContent=USER._name||USER.email;
  $('#roleChip').textContent=ROLE_NAMES[ROLE];
  $('#dataDate').value=DATA_DATE;$('#dataDate').onchange=e=>{DATA_DATE=e.target.value;if(SCREEN==='project')render();else renderPortfolio();};
  if(!CLIENTS.length){$('#host').innerHTML='<p style="padding:30px;text-align:center;color:var(--muted)">لا توجد مشاريع متاحة لحسابك بعد.</p>';hideChrome();return;}
  // العميل: دخول مباشر لمشروعه الوحيد. الطاقم: شاشة المحفظة
  if(ROLE==='client'){
    SCREEN='project';CID=CLIENTS[0].id;await loadProject(CID);render();
  }else{
    SCREEN='portfolio';await renderPortfolio();
  }
}
function hideChrome(){ $('#barClient').style.display='none'; $('#kpisRow').style.display='none'; $('#tabs').style.display='none'; $('#lifeBadge').style.display='none'; }
function showChrome(){ $('#kpisRow').style.display=''; $('#tabs').style.display=''; $('#lifeBadge').style.display=''; }


// ===== شاشة المحفظة (للطاقم) =====
async function loadSummary(clientId){ return null; /* لم تعد مستخدمة — استُبدلت بـpmo_portfolio */ }
async function renderPortfolio(){
  SCREEN='portfolio';
  $('#hProject').textContent='محفظة المشاريع';
  $('#barClient').style.display='none';hideChrome();
  const leadsBtn=(ROLE==='pmo')?'<button class="reqbtn" id="showLeads" style="margin-inline-start:auto">العملاء المحتملون ↗</button>':'';
  // هيكل skeleton فوري (تجربة أسرع بصريًا)
  const skel=CLIENTS.map(()=>'<div class="pcard"><div class="skeleton" style="height:22px;width:55%;margin-bottom:14px"></div><div class="skeleton" style="height:8px;margin-bottom:12px"></div><div class="skeleton" style="height:36px"></div></div>').join('');
  $('#host').innerHTML='<div class="hintbar">اختر عميلًا لعرض لوحة مشروعه الكاملة.'+leadsBtn+'</div><div class="pgrid" id="pgrid">'+skel+'</div>';
  if(ROLE==='pmo'){const lb=$('#showLeads');if(lb)lb.onclick=renderLeads;}
  // استعلام واحد لكل الملخّصات (بدل 12 متسلسلًا)
  const {data:rows,error}=await sb.rpc('pmo_portfolio');
  const grid=$('#pgrid');grid.innerHTML='';
  if(error){grid.innerHTML='<p class="pempty">تعذّر تحميل المحفظة.</p>';return;}
  const byClient={};(rows||[]).forEach(r=>{byClient[r.client_id]=r;});
  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق',lost:'ملغى'};
  for(const c of CLIENTS){
    const r=byClient[c.id];let body,meta;
    if(r && r.total_tasks>0){
      const pct=r.total_tasks?Math.round(r.done_tasks/r.total_tasks*100):0;
      meta=`<div class="pcard-meta"><span>${r.total_tasks} بند</span><span>${r.milestones} معالم</span></div>`;
      body=`<div class="pbar"><div class="pbar-fill" style="width:${pct}%"></div></div>
        <div class="pstats"><span><b>${pct}%</b>إنجاز</span><span><b>${r.done_tasks}</b>منجز</span><span class="${r.blocked_tasks>0?'red':''}"><b>${r.blocked_tasks}</b>متوقف</span><span class="${r.pending_client_reqs>0?'red':''}"><b>${r.pending_client_reqs}</b>متطلب</span></div>`;
    }else{
      meta=`<div class="pcard-meta"><span>لا خطة بعد</span></div>`;
      body=`<div class="pempty">مشروع فارغ — جاهز لبناء الخطة</div>`;
    }
    const life=r?(LIFE[r.lifecycle]||'—'):'—';
    const card=document.createElement('div');card.className='pcard';card.style.cssText=`--cc:${c.color}`;
    card.innerHTML=`<div class="pcard-top"><span class="pdot" style="background:${c.color}"></span><h3>${c.name}</h3><span class="plife">${life}</span></div>${meta}${body}`;
    card.onclick=async()=>{CID=c.id;await openProject();};
    grid.appendChild(card);
  }
}
async function openProject(){
  $('#loader').classList.remove('hidden');
  await loadProject(CID);
  $('#loader').classList.add('hidden');
  SCREEN='project';$('#barClient').style.display='';showChrome();
  render();
}

// ===== شاشة العملاء المحتملين (PMO) =====
async function renderLeads(){
  $('#hProject').textContent='العملاء المحتملون';
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backToPortfolio">↩ المحفظة</button><span style="margin-inline-start:auto">النماذج الواردة من الموقع — حوّل أيًّا منها إلى مشروع-مقترح.</span></div><div id="leadsList"><div class="skeleton" style="height:60px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
  $('#backToPortfolio').onclick=renderPortfolio;
  let leads;
  try{ leads=await loadLeads(); }catch(e){ $('#leadsList').innerHTML='<p class="pempty">تعذّر تحميل النماذج.</p>'; return; }
  const box=$('#leadsList');
  if(!leads.length){box.innerHTML='<p class="pempty">لا توجد نماذج واردة.</p>';return;}
  box.innerHTML=leads.map(l=>{
    const conv=l._converted;
    const date=l.submitted_at?new Date(l.submitted_at).toLocaleDateString('ar'):'';
    return `<div class="crcard" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <b style="font-size:.95rem">${esc(l.company_name||'(بلا اسم شركة)')}</b>
        <div style="font-size:.8rem;color:var(--muted)">${esc(l.contact_name||'')}${l.contact_email?' · '+esc(l.contact_email):''}${date?' · '+date:''}</div>
      </div>
      <span class="crstate ${conv?'approved':'pending'}">${conv?'محوّل لمشروع':(esc(l.status||'جديد'))}</span>
      ${conv?'':`<button class="reqbtn" data-convert="${l.id}" data-name="${esc(l.company_name||'')}" style="background:var(--gold);border-color:var(--gold);color:#fff">تحويل لمشروع</button>`}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-convert]').forEach(b=>b.onclick=async()=>{
    const name=prompt('اسم المشروع:', 'مشروع '+(b.dataset.name||''));
    if(!name)return;
    b.disabled=true;b.textContent='جارٍ...';
    try{
      await convertLead(b.dataset.convert, name);
      await loadClients();
      toast('تم إنشاء عميل ومشروع-مقترح بنجاح','ok');
      renderLeads();
    }catch(e){ toast('تعذّر التحويل: '+e.message,'err'); b.disabled=false;b.textContent='تحويل لمشروع'; }
  });
}


// ===== إدارة وصول العميل (PMO) =====
async function openAccess(){
  const c=CLIENTS.find(x=>x.id===CID);
  $('#accTitle').textContent='إدارة وصول: '+c.name;
  $('#accEmail').value='';
  await renderAccessList();
  $('#accessOverlay').style.display='flex';
}
async function renderAccessList(){
  const {data,error}=await sb.from('pmo_client_access').select('*').eq('client_id',CID).order('created_at');
  const list=$('#accList');
  if(error){list.innerHTML='<p style="color:var(--crit);font-size:.82rem">تعذّر التحميل: '+esc(error.message)+'</p>';return;}
  if(!data||!data.length){list.innerHTML='<p class="empty" style="color:var(--muted);font-style:italic;font-size:.85rem">لا إيميلات مضافة بعد.</p>';return;}
  list.innerHTML=data.map(a=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border:1px solid var(--line);border-radius:9px;margin-bottom:7px">
    <span style="font-size:.86rem">${esc(a.email)}</span>
    <button class="hbtn" data-rm="${a.id}" style="background:#fff;color:var(--crit);border-color:#e8c4bc;padding:4px 10px">إزالة</button></div>`).join('');
  list.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{
    await sb.from('pmo_client_access').delete().eq('id',b.dataset.rm);await renderAccessList();
  });
}
$('#accAdd').onclick=async()=>{
  const email=$('#accEmail').value.trim().toLowerCase();
  if(!email||!email.includes('@')){toast('أدخل إيميلًا صحيحًا','warn');return;}
  const {error}=await sb.from('pmo_client_access').insert({client_id:CID,email});
  if(error){toast(error.message.includes('duplicate')?'هذا الإيميل مُضاف مسبقًا':('تعذّر الإضافة: '+error.message),'err');return;}
  $('#accEmail').value='';await renderAccessList();
};
$('#accClose').onclick=()=>{$('#accessOverlay').style.display='none';};
$('#accessOverlay').onclick=e=>{if(e.target.id==='accessOverlay')$('#accessOverlay').style.display='none';};
$('#manageAccess').onclick=openAccess;

// ===== اعتماد العقد + تثبيت الأساس =====
$('#approveContract').onclick=async()=>{
  const val=prompt('قيمة العقد (ر.س) — اتركه فارغًا إن لم تتوفر:','571400');
  if(val===null)return;
  if(!confirm('اعتماد الخطة كخط أساس؟ بعدها أي تعديل على البنية يتطلب طلب تغيير.'))return;
  // بناء snapshot من الجدولة الحالية
  const snap={};PROJECT.tasks.forEach(t=>{const r=SCHED.R[t.id];snap[t.id]={duration:t.duration,ES:fmtY(r.ES),EF:fmtY(r.EF)};});
  const {error}=await sb.rpc('pmo_approve_contract',{p_project_id:PROJECT._dbId,p_contract_value:val?parseFloat(val):null,p_snapshot:snap});
  if(error){toast('تعذّر الاعتماد: '+error.message,'err');return;}
  await loadProject(CID);render();
  toast('تم اعتماد العقد وتثبيت خط الأساس · المشروع الآن نشط','ok');
};

// ===== تبويب طلبات التغيير =====
function vCR(){
  const canApprove=PERMS[ROLE].crAction==='approve';
  const canRequest=!!PERMS[ROLE].crAction;
  const taskOpts=PROJECT.tasks.filter(t=>t.type!=='milestone').map(t=>`<option value="${esc(t.id)}">${esc(t.id)} — ${esc(t.name)}</option>`).join('');
  const form=canRequest?`<div class="crform">
    <h4>رفع طلب تغيير</h4>
    <select id="crTask">${taskOpts}</select>
    <select id="crKind"><option value="duration">تغيير المدة</option><option value="deps">تغيير التبعيات</option><option value="add">إضافة بند</option><option value="remove">حذف بند</option><option value="other">أخرى</option></select>
    <input id="crVal" placeholder="القيمة المقترحة (مثل: 12)">
    <textarea id="crReason" placeholder="المبرر..."></textarea>
    <button class="hbtn" id="crSubmit" style="background:var(--gold);border-color:var(--gold);width:100%">إرسال الطلب</button>
  </div>`:'';
  const list=CRS.length?CRS.map(c=>{
    const t=PROJECT.tasks.find(x=>x.id===c.task_ref);
    const stcls=c.status==='pending'?'pending':c.status==='approved'?'approved':'rejected';
    const sttxt=c.status==='pending'?'معلّق':c.status==='approved'?'موافق عليه':'مرفوض';
    const KIND={duration:'تغيير المدة',deps:'تغيير التبعيات',add:'إضافة بند',remove:'حذف بند',other:'أخرى'};
    const actions=(canApprove&&c.status==='pending')?`<div class="cract"><button class="hbtn" data-ap="${c.id}" style="background:var(--ok);border-color:var(--ok)">موافقة وتطبيق</button><button class="hbtn" data-rj="${c.id}" style="background:#fff;color:var(--crit);border-color:#e8c4bc">رفض</button></div>`:'';
    return `<div class="crcard">
      <div class="crhd"><span class="crid">${esc(c.id.slice(0,12))}</span><span class="crstate ${stcls}">${sttxt}</span></div>
      <div class="crbody"><b>البند:</b> ${esc(c.task_ref||'—')}${t?' — '+esc(t.name):''} · <b>النوع:</b> ${KIND[c.kind]||c.kind}${c.new_value?' · <b>القيمة:</b> '+esc(c.new_value):''}<br><b>المبرر:</b> ${esc(c.reason||'—')}<br><small>${new Date(c.created_at).toLocaleDateString('ar')}</small>${c.decision_note?'<br><small>القرار: '+esc(c.decision_note)+'</small>':''}</div>${actions}</div>`;
  }).join(''):'<p class="empty" style="color:var(--muted);font-style:italic">لا طلبات تغيير.</p>';
  return `<div class="crwrap">${form}<div class="crlist">${list}</div></div>`;
}
function bindCR(){
  const sub=$('#crSubmit');
  if(sub)sub.onclick=async()=>{
    const reason=$('#crReason').value.trim();if(!reason){toast('اكتب المبرر','warn');return;}
    const {error}=await sb.from('pmo_change_requests').insert({project_id:PROJECT._dbId,task_ref:$('#crTask').value,kind:$('#crKind').value,new_value:$('#crVal').value,reason});
    if(error){toast('تعذّر الإرسال: '+error.message,'err');return;}
    CRS=(await sb.from('pmo_change_requests').select('*').eq('project_id',PROJECT._dbId).order('created_at',{ascending:false})).data||[];
    render();
  };
  $$('[data-ap]').forEach(b=>b.onclick=async()=>{
    const c=CRS.find(x=>x.id===b.dataset.ap);
    // تطبيق آلي لتغيير المدة
    if(c.kind==='duration'&&c.task_ref){const t=PROJECT.tasks.find(x=>x.id===c.task_ref);
      if(t&&t._dbId){const nv=parseInt(c.new_value||t.duration,10);await sb.from('pmo_tasks').update({duration:nv}).eq('id',t._dbId);}}
    await sb.from('pmo_change_requests').update({status:'approved',decision_note:'طُبّق',decided_at:new Date().toISOString()}).eq('id',c.id);
    await loadProject(CID);render();
  });
  $$('[data-rj]').forEach(b=>b.onclick=async()=>{
    await sb.from('pmo_change_requests').update({status:'rejected',decided_at:new Date().toISOString()}).eq('id',b.dataset.rj);
    CRS=(await sb.from('pmo_change_requests').select('*').eq('project_id',PROJECT._dbId).order('created_at',{ascending:false})).data||[];
    render();
  });
}

// ===== نافذة المتطلبات =====
let REQ_TASK=null;
async function openReqs(refId){
  REQ_TASK=PROJECT.tasks.find(t=>t.id===refId);if(!REQ_TASK)return;
  $('#reqTitle').textContent='متطلبات: '+REQ_TASK.name;
  renderReqs();
  $('#reqOverlay').style.display='flex';
}
function renderReqs(){
  const canEdit=PERMS[ROLE].editReqs;
  const reqs=REQ_TASK.requirements||[];
  const ST={received:'مُستلم',pending:'بانتظار',overdue:'متأخر',notrequested:'لم يُطلب',latejust:'مُستلم متأخرًا'};
  const OWN={client:'العميل',alamah:'علامة'};
  const dis=canEdit?'':'disabled';
  let rows=reqs.map((r,i)=>{
    const ow=Object.keys(OWN).map(k=>`<option value="${k}" ${k===r.owner?'selected':''}>${OWN[k]}</option>`).join('');
    const extra=(r._state==='overdue'&&r._late)?(' +'+r._late+'ي'):'';
    return `<tr data-i="${i}">
      <td><input class="rq" data-rf="desc" value="${esc(r.desc)}" ${dis} style="min-width:140px;text-align:right"></td>
      <td><select class="rq" data-rf="owner" ${dis}>${ow}</select></td>
      <td><input class="rq" type="number" min="0" data-rf="sla" value="${r.sla||0}" ${dis} style="width:46px"></td>
      <td><input class="rq" type="date" data-rf="requested" value="${r.requested||''}" ${dis} style="width:120px"></td>
      <td><input class="rq" type="date" data-rf="received" value="${r.received||''}" ${dis} style="width:120px"></td>
      <td style="text-align:center"><input class="rq" type="checkbox" data-rf="blocking" ${r.blocking?'checked':''} ${dis}></td>
      <td><span class="rstate ${r._state||'notrequested'}">${ST[r._state]||'—'}${extra}</span></td>
      ${canEdit?`<td><button class="ib" data-rdel="${i}" style="color:var(--crit)">✕</button></td>`:''}</tr>`;
  }).join('');
  $('#reqTbl').innerHTML=`<thead><tr><th>المتطلب</th><th>الجهة</th><th>SLA</th><th>الطلب</th><th>الاستلام</th><th>حاجز</th><th>الحالة</th>${canEdit?'<th></th>':''}</tr></thead><tbody>${rows||'<tr><td colspan="8" style="color:var(--muted);padding:12px">لا متطلبات.</td></tr>'}</tbody>`;
  $('#reqAdd').style.display=canEdit?'':'none';
  if(!canEdit)return;
  $('#reqTbl').querySelectorAll('[data-rf]').forEach(inp=>inp.addEventListener('change',async()=>{
    const i=+inp.closest('tr').dataset.i,f=inp.dataset.rf,r=REQ_TASK.requirements[i];
    let val=(f==='blocking')?inp.checked:(f==='sla'?parseInt(inp.value||'0',10):inp.value);
    r[f]=val;
    const map={desc:'description',owner:'owner',sla:'sla_days',requested:'requested_at',received:'received_at',blocking:'blocking'};
    const patch={};patch[map[f]]=(val===''?null:val);
    if(r._id){const {error}=await sb.from('pmo_requirements').update(patch).eq('id',r._id);if(error){toast('تعذّر الحفظ: '+error.message,'err');return;}}
    compute();renderReqs();
  }));
  $('#reqTbl').querySelectorAll('[data-rdel]').forEach(b=>b.onclick=async()=>{
    const r=REQ_TASK.requirements[+b.dataset.rdel];
    if(r._id)await sb.from('pmo_requirements').delete().eq('id',r._id);
    REQ_TASK.requirements.splice(+b.dataset.rdel,1);compute();renderReqs();
  });
}
$('#reqAdd').onclick=async()=>{
  const {data,error}=await sb.from('pmo_requirements').insert({task_id:REQ_TASK._dbId,description:'متطلب جديد',owner:'client',sla_days:2,blocking:true}).select().single();
  if(error){toast('تعذّر الإضافة: '+error.message,'err');return;}
  REQ_TASK.requirements.push({_id:data.id,desc:'متطلب جديد',owner:'client',sla:2,blocking:true,requested:'',received:''});
  compute();renderReqs();
};
$('#reqClose').onclick=()=>{$('#reqOverlay').style.display='none';render();};
$('#reqOverlay').onclick=e=>{if(e.target.id==='reqOverlay'){$('#reqOverlay').style.display='none';render();}};

// انطلاق
boot();