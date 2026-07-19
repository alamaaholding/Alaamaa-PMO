// ===== app/main.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
function savePFilters(){try{localStorage.setItem('pmo_pfilters',JSON.stringify({PFILTER,PSORT,PALERTS:[...PALERTS]}));}catch(e){}}
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
// توست بزر تراجع (يبقى 8 ثوانٍ)
function toastUndo(msg,onUndo){
  const wrap=document.getElementById('toastWrap'); if(!wrap)return;
  const t=document.createElement('div'); t.className='toast undo';
  t.innerHTML='<span>🗑</span><span>'+msg+'</span><button class="undo-btn">تراجع</button>';
  wrap.appendChild(t);
  const tm=setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300);},8000);
  t.querySelector('.undo-btn').onclick=async()=>{clearTimeout(tm);t.remove();
    try{await onUndo();}catch(e){toast('تعذّر التراجع: '+e.message,'err');}};
}

// ===== نوافذ الحوار المخصّصة (بديل prompt/confirm المتصفح) =====

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

function hideChrome(){ $('#barClient').style.display='none'; $('#kpisRow').style.display='none'; $('#tabs').style.display='none'; $('#lifeBadge').style.display='none'; const e=$('#exportReport');if(e)e.style.display='none'; }

function showChrome(){ $('#kpisRow').style.display=''; $('#tabs').style.display=''; $('#lifeBadge').style.display=''; const e=$('#exportReport');if(e)e.style.display=''; }


// ===== شاشة المحفظة (للطاقم) =====

async function loadSummary(clientId){ return null; /* لم تعد مستخدمة — استُبدلت بـpmo_portfolio */ }

// ===== الروابط العميقة =====
// الشكل: #/p/{projectId}/{view}[/t/{ref}] — يتيح إرسال رابط لبند أو طلب اعتماد مباشرة.
let _hashLock=false,_focusRef=null;
function writeHash(){
  if(typeof SCREEN==='undefined'||SCREEN!=='project'||!PROJECT||!PROJECT._dbId)return;
  const h='#/p/'+PROJECT._dbId+'/'+VIEW+(_focusRef?('/t/'+encodeURIComponent(_focusRef)):'');
  if(location.hash===h)return;
  _hashLock=true;
  try{history.replaceState(null,'',h);}catch(e){location.hash=h;}
  setTimeout(()=>{_hashLock=false;},0);
}
function parseHash(){
  const m=/^#\/p\/([^/]+)\/([a-z]+)(?:\/t\/(.+))?$/.exec(location.hash||'');
  if(!m)return null;
  return {projectId:m[1],view:m[2],ref:m[3]?decodeURIComponent(m[3]):null};
}
// تبديل التبويب — نقطة الدخول الوحيدة (تحدّث الرابط أيضًا)
function setView(v,ref){
  if(!PERMS[ROLE]||PERMS[ROLE].views.indexOf(v)===-1)return;
  VIEW=v;_focusRef=ref||null;
  render();writeHash();
  if(_focusRef)focusTask(_focusRef);
}
// إبراز بند بعينه بعد الانتقال إليه
function focusTask(ref){
  setTimeout(()=>{
    const sel='[data-id="'+(window.CSS&&CSS.escape?CSS.escape(ref):ref)+'"]';
    const el=document.querySelector('#host '+sel)||document.querySelector('#host [data-grow="'+ref+'"]');
    if(!el)return;
    document.querySelectorAll('.row-focus').forEach(x=>x.classList.remove('row-focus'));
    el.classList.add('row-focus');
    if(el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'center'});
  },60);
}
// الانتقال من أي مكان إلى بند داخل الجدول
function gotoTask(ref){
  TFILTER={phases:new Set(),statuses:new Set(),smart:new Set(),q:''};
  setView(can('editStruct')||ROLE!=='client'?'table':'gantt',ref);
}
// تطبيق الرابط عند الفتح أو عند تغيّره يدويًا
function applyHash(){
  const h=parseHash();if(!h)return false;
  if(PROJECT&&PROJECT._dbId===h.projectId&&PERMS[ROLE]&&PERMS[ROLE].views.indexOf(h.view)>-1){
    VIEW=h.view;_focusRef=h.ref||null;
    render();
    if(_focusRef)focusTask(_focusRef);
    return true;
  }
  return false;
}
window.addEventListener('hashchange',()=>{
  if(_hashLock)return;
  if(typeof SCREEN!=='undefined'&&SCREEN==='project')applyHash();
});

// إغلاق لوحة البند: زر، نقر على الخلفية، ومفتاح Esc
(function bindTaskOverlayChrome(){
  const wire=()=>{
    const ov=document.getElementById('taskOverlay');if(!ov)return;
    const cl=document.getElementById('tkClose');if(cl)cl.onclick=closeTaskPanel;
    ov.addEventListener('click',e=>{if(e.target===ov)closeTaskPanel();});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&ov.style.display==='flex')closeTaskPanel();});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

async function openProject(){
  TFILTER={phases:new Set(),statuses:new Set(),smart:new Set(),q:''};
  $('#loader').classList.remove('hidden');
  await loadProject(CID,PID);
  $('#loader').classList.add('hidden');
  SCREEN='project';$('#barClient').style.display='';showChrome();
  // إن كان الوصول عبر رابط عميق، افتح التبويب/البند المقصود؛ وإلا اعرض الافتراضي
  if(!applyHash()){render();writeHash();}
}

// تعديل تاريخ بدء المشروع — المصدر الوحيد للحقيقة، يعيد حساب كل التواريخ

async function editStartDate(){
  if(PROJECT.status==='baselined'){ toast('الخطة مثبّتة — تعديل التاريخ يتطلب طلب تعديل خطة معتمدًا','warn'); return; }
  const cur=PROJECT.start||'';
  const r=await dialog({title:'تعديل تاريخ بدء المشروع',
    message:'هذا التاريخ هو الأساس الذي تُحسب منه كل تواريخ المهام تلقائيًا (CPM). تغييره يعيد جدولة المشروع بالكامل.',
    fields:[{key:'date',label:'تاريخ البدء',type:'date',value:cur}],confirmText:'تحديث وإعادة الجدولة'});
  if(!r||!r.date)return;
  try{
    await updateProjectStart(PROJECT._dbId, r.date);
    PROJECT.start=r.date;
    toast('حُدّث تاريخ البدء — أُعيد حساب الجدول','ok');
    await loadProject(CID,PID); render();
  }catch(e){ toast('تعذّر التحديث: '+e.message,'err'); }
}

// ===== دورة حياة العميل (المرحلة 1) =====
// حوار مشروع جديد (يُستدعى من قائمة العميل وزر البطاقة)

async function renderPortfolioTimeline(){
  SCREEN='ptimeline';$('#hProject').textContent='خط التسليمات — كل المشاريع';hideChrome();
  $('#host').innerHTML='<div id="ptlWrap"><div class="skeleton" style="height:120px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
  openTimelinePortfolio('ptlWrap');
}
async function renderAuditLog(){
  SCREEN='audit';$('#hProject').textContent='سجل المكتب — كل المشاريع';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backP">↩ المحفظة</button><span style="margin-inline-start:auto">🗂 <b>سجل المكتب:</b> كل الأفعال الحسّاسة عبر <b>كل المشاريع والعملاء</b> — من فعل، ماذا، ومتى. (سجل مشروع واحد: تبويب «سجل المشروع» داخله)</span></div><div id="auditList"><div class="skeleton" style="height:40px;margin-bottom:6px"></div><div class="skeleton" style="height:40px;margin-bottom:6px"></div><div class="skeleton" style="height:40px"></div></div>';
  $('#backP').onclick=renderPortfolio;
  const rows=await fetchAuditLog(150);
  const list=$('#auditList');
  if(!rows.length){list.innerHTML='<div class="empty-cta"><div class="ico">'+I.clipboard+'</div><h3>السجل فارغ</h3><p>الأفعال الحسّاسة (حذف، أرشفة، تعليقات، طلبات) ستظهر هنا.</p></div>';return;}
  const fmt=ts=>{const d=new Date(ts);return d.toLocaleDateString('ar-SA-u-ca-gregory',{year:'numeric',month:'short',day:'numeric'})+' · '+d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});};
  list.innerHTML='<div class="audit-table">'+rows.map(r=>{
    const label=AUDIT_ACTIONS[r.action]||r.action;
    const detail=(r.new_value&&(r.new_value.name||r.new_value.body||r.new_value.description||r.new_value.title))||(r.old_value&&(r.old_value.name||r.old_value.body||r.old_value.description))||'';
    const isCrit=/purge|delete/.test(r.action);
    return `<div class="audit-row"><span class="audit-act ${isCrit?'crit':''}">${label}</span><span class="audit-ent">${AUDIT_ENTITIES[r.entity]||r.entity||''}</span><span class="audit-detail">${detail?esc(String(detail).slice(0,80)):''}</span><span class="audit-time">${fmt(r.created_at)}</span></div>`;
  }).join('')+'</div>';
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
    const r=await dialog({title:'تحويل إلى مشروع',message:'سيُنشأ عميل ومشروع في مرحلة «مقترح».',
      fields:[{key:'name',label:'اسم المشروع',value:'مشروع '+(b.dataset.name||'')}],confirmText:'إنشاء'});
    if(!r||!r.name)return;
    b.disabled=true;b.textContent='جارٍ...';
    try{
      await convertLead(b.dataset.convert, r.name);
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
  const {data,error}=await fetchClientAccess(CID);
  const list=$('#accList');
  if(error){list.innerHTML='<p style="color:var(--crit);font-size:.82rem">تعذّر التحميل: '+esc(error.message)+'</p>';return;}
  if(!data||!data.length){list.innerHTML='<p class="empty" style="color:var(--muted);font-style:italic;font-size:.85rem">لا إيميلات مضافة بعد.</p>';return;}
  list.innerHTML=data.map(a=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border:1px solid var(--line);border-radius:9px;margin-bottom:7px">
    <span style="font-size:.86rem">${esc(a.email)}</span>
    <button class="hbtn" data-rm="${a.id}" style="background:#fff;color:var(--crit);border-color:#e8c4bc;padding:4px 10px">إزالة</button></div>`).join('');
  list.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{
    await removeClientAccess(b.dataset.rm);await renderAccessList();
  });
}
$('#accAdd').onclick=async()=>{
  const email=$('#accEmail').value.trim().toLowerCase();
  if(!email||!email.includes('@')){toast('أدخل إيميلًا صحيحًا','warn');return;}
  const {error}=await addClientAccess(CID,email);
  if(error){toast(error.message.includes('duplicate')?'هذا الإيميل مُضاف مسبقًا':('تعذّر الإضافة: '+error.message),'err');return;}
  $('#accEmail').value='';await renderAccessList();
};
$('#accClose').onclick=()=>{$('#accessOverlay').style.display='none';};
$('#accessOverlay').onclick=e=>{if(e.target.id==='accessOverlay')$('#accessOverlay').style.display='none';};
$('#manageAccess').onclick=openAccess;
const _pmb=$('#projMenuBtn');if(_pmb)_pmb.onclick=()=>{if(PROJECT)openProjectMenu(PROJECT._dbId,PROJECT.name);};

// ===== اعتماد العقد + تثبيت الأساس =====
$('#approveContract').onclick=async()=>{
  const r=await dialog({title:'اعتماد العقد وتثبيت الأساس',
    message:'سيتحوّل المشروع إلى «نشط» وتُجمّد الخطة كخط أساس. بعدها أي تعديل على البنية يتطلب طلب تعديل خطة رسميًا (من تبويب طلبات تعديل الخطة).',
    fields:[{key:'val',label:'قيمة العقد (ر.س) — اختياري',type:'number',value:'',placeholder:'مثال: 571400'}],
    confirmText:'اعتماد وتثبيت'});
  if(!r)return;
  const val=r.val;
  const snap={};PROJECT.tasks.forEach(t=>{const rr=SCHED.R[t.id];snap[t.id]={duration:t.duration,ES:fmtY(rr.ES),EF:fmtY(rr.EF)};});
  const {error}=await rpcApproveContract(PROJECT._dbId, val?parseFloat(val):null, snap);
  if(error){toast('تعذّر الاعتماد: '+error.message,'err');return;}
  await loadProject(CID,PID);render();
  toast('تم اعتماد العقد وتثبيت خط الأساس · المشروع الآن نشط','ok');
};

// ===== تبويب طلبات التغيير =====

// أنواع طلبات تعديل الخطة — و«وضع التطبيق»: هل يطبّقه النظام آليًا عند الموافقة أم يحتاج تنفيذًا يدويًا؟
const CR_KIND={
  duration:{t:'تغيير المدة',auto:true},
  deps:{t:'تغيير التبعيات',auto:false},
  add:{t:'إضافة بند',auto:false},
  remove:{t:'حذف بند',auto:false},
  other:{t:'أخرى',auto:false}
};
const crAutoNote='<span class="cr-mode auto">⚡ يُطبَّق على الجدول تلقائيًا عند الموافقة</span>';
const crManualNote='<span class="cr-mode manual">✋ يتطلب تنفيذًا يدويًا في تبويب «الجدول» بعد الموافقة</span>';
function vCR(){
  const canApprove=PERMS[ROLE].crAction==='approve';
  const canRequest=!!PERMS[ROLE].crAction;
  const taskOpts=PROJECT.tasks.filter(t=>t.type!=='milestone').map(t=>`<option value="${esc(t.id)}">${esc(t.id)} — ${esc(t.name)}</option>`).join('');
  const kindOpts=Object.keys(CR_KIND).map(k=>`<option value="${k}">${CR_KIND[k].t}</option>`).join('');
  const form=canRequest?`<div class="crform">
    <h4>رفع طلب تعديل على الخطة</h4>
    <select id="crTask">${taskOpts}</select>
    <select id="crKind">${kindOpts}</select>
    <div id="crModeHint" class="cr-modehint">${crAutoNote}</div>
    <input id="crVal" placeholder="القيمة المقترحة (مثل: 12)">
    <textarea id="crReason" placeholder="المبرر..."></textarea>
    <button class="hbtn" id="crSubmit" style="background:var(--gold);border-color:var(--gold);width:100%">إرسال الطلب</button>
  </div>`:'';
  const list=CRS.length?CRS.map(c=>{
    const t=PROJECT.tasks.find(x=>x.id===c.task_ref);
    const stcls=c.status==='pending'?'pending':c.status==='approved'?'approved':'rejected';
    const sttxt=c.status==='pending'?'معلّق':c.status==='approved'?'موافق عليه':'مرفوض';
    const kd=CR_KIND[c.kind]||{t:c.kind,auto:false};
    // زر الموافقة يقول بصدق ما سيفعله النظام فعلًا
    const apText=kd.auto?'موافقة وتطبيق':'موافقة (تنفيذ يدوي)';
    const actions=(canApprove&&c.status==='pending')?`<div class="cract"><button class="hbtn" data-ap="${c.id}" style="background:var(--ok);border-color:var(--ok)">${apText}</button><button class="hbtn" data-rj="${c.id}" style="background:#fff;color:var(--crit);border-color:#e8c4bc">رفض</button></div>`:'';
    // تنبيه تنفيذ معلّق: وافق عليه ولم يُطبَّق آليًا ⇒ الخطة لم تتغيّر بعد
    const pendingExec=(c.status==='approved'&&!kd.auto)?'<div class="cr-pendexec">⚠ معتمد — لكن الخطة لم تتغيّر تلقائيًا. نفّذ التعديل يدويًا في تبويب «الجدول».</div>':'';
    const goto=(c.task_ref&&t)?`<button class="lnk" data-gotask="${esc(c.task_ref)}">↗ الذهاب إلى البند في الخطة</button>`:'';
    return `<div class="crcard cr-plan">
      <div class="crhd"><span class="crid">${esc(c.id.slice(0,12))}</span><span class="crstate ${stcls}">${sttxt}</span></div>
      <div class="crbody"><b>البند:</b> ${esc(c.task_ref||'—')}${t?' — '+esc(t.name):''} · <b>النوع:</b> ${kd.t}${c.new_value?' · <b>القيمة:</b> '+esc(c.new_value):''}<br><b>المبرر:</b> ${esc(c.reason||'—')}<br><small>${new Date(c.created_at).toLocaleDateString('ar')}</small>${c.decision_note?'<br><small>القرار: '+esc(c.decision_note)+'</small>':''}${goto?'<br>'+goto:''}</div>
      <div class="cr-modewrap">${kd.auto?crAutoNote:crManualNote}</div>${pendingExec}${actions}</div>`;
  }).join(''):'<p class="empty" style="color:var(--muted);font-style:italic">لا طلبات تغيير.</p>';
  return `<div class="crwrap">${form}<div class="crlist">${list}</div></div>`;
}

function bindCR(){
  $$('[data-gotask]').forEach(b=>b.onclick=()=>gotoTask(b.dataset.gotask));
  // تلميح حيّ: يوضّح قبل الإرسال هل سيُطبَّق الطلب آليًا أم يدويًا
  const kindSel=$('#crKind'),modeHint=$('#crModeHint');
  if(kindSel&&modeHint){
    const paint=()=>{const kd=CR_KIND[kindSel.value]||{auto:false};modeHint.innerHTML=kd.auto?crAutoNote:crManualNote;};
    kindSel.onchange=paint;paint();
  }
  const sub=$('#crSubmit');
  if(sub)sub.onclick=async()=>{
    const reason=$('#crReason').value.trim();if(!reason){toast('اكتب المبرر','warn');return;}
    const {error}=await insertCR({project_id:PROJECT._dbId,task_ref:$('#crTask').value,kind:$('#crKind').value,new_value:$('#crVal').value,reason});
    if(error){toast('تعذّر الإرسال: '+error.message,'err');return;}
    CRS=await fetchCRs(PROJECT._dbId);
    await refreshProjectCounts();
    render();
  };
  $$('[data-ap]').forEach(b=>b.onclick=async()=>{
    const c=CRS.find(x=>x.id===b.dataset.ap);
    const kd=CR_KIND[c.kind]||{t:c.kind,auto:false};
    let applied=false;
    // تطبيق آلي لتغيير المدة فقط — بقية الأنواع تحتاج تنفيذًا يدويًا
    if(kd.auto&&c.kind==='duration'&&c.task_ref){
      const t=PROJECT.tasks.find(x=>x.id===c.task_ref);
      const nv=parseInt(c.new_value,10);
      if(t&&t._dbId&&!isNaN(nv)){await updateTaskFields(t._dbId,{duration:nv});applied=true;}
    }
    // ملاحظة القرار تسجّل ما حدث فعلًا — لا «طُبّق» في كل الحالات
    const note=applied?'معتمد وطُبّق آليًا على الجدول'
      :(kd.auto?'معتمد — تعذّر التطبيق الآلي (قيمة غير صالحة)، يتطلب تنفيذًا يدويًا'
               :'معتمد — يتطلب تنفيذًا يدويًا في الجدول');
    await decideCR(c.id,{status:'approved',decision_note:note,decided_at:new Date().toISOString()});
    await loadProject(CID,PID);render();
    toast(applied?'اعتُمد الطلب وطُبّق على الجدول':'اعتُمد الطلب — نفّذ التعديل يدويًا في تبويب «الجدول»',applied?'ok':'warn');
  });
  $$('[data-rj]').forEach(b=>b.onclick=async()=>{
    await decideCR(b.dataset.rj,{status:'rejected',decided_at:new Date().toISOString()});
    CRS=await fetchCRs(PROJECT._dbId);
    await refreshProjectCounts();
    render();
  });
}

// ===== نافذة المتطلبات =====
let REQ_TASK=null;

async function openReqs(refId){
  REQ_TASK=PROJECT.tasks.find(t=>t.id===refId);if(!REQ_TASK)return;
  $('#reqTitle').textContent='متطلبات البند: '+REQ_TASK.name;
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
    if(r._id){const {error}=await updateRequirement(r._id,patch);if(error){toast('تعذّر الحفظ: '+error.message,'err');return;}}
    compute();renderReqs();
  }));
  $('#reqTbl').querySelectorAll('[data-rdel]').forEach(b=>b.onclick=async()=>{
    const r=REQ_TASK.requirements[+b.dataset.rdel];
    if(r._id)await deleteRequirement(r._id);
    REQ_TASK.requirements.splice(+b.dataset.rdel,1);compute();renderReqs();
  });
}
$('#reqAdd').onclick=async()=>{
  const {data,error}=await insertRequirement({task_id:REQ_TASK._dbId,description:'متطلب جديد',owner:'client',sla_days:2,blocking:true});
  if(error){toast('تعذّر الإضافة: '+error.message,'err');return;}
  REQ_TASK.requirements.push({_id:data.id,desc:'متطلب جديد',owner:'client',sla:2,blocking:true,requested:'',received:''});
  compute();renderReqs();
};
$('#reqClose').onclick=()=>{$('#reqOverlay').style.display='none';render();};
$('#reqOverlay').onclick=e=>{if(e.target.id==='reqOverlay'){$('#reqOverlay').style.display='none';render();}};

// ===== أداة بناء الخطة (PMO) =====

async function handleAddTask(){
  const r=await dialog({title:'إضافة بند جديد',
    fields:[
      {key:'ref',label:'المعرّف (فريد، مثل B10)',placeholder:'B10'},
      {key:'name',label:'اسم البند',value:'بند جديد'},
      {key:'track',label:'المسار',type:'select',value:'0',options:projTrackList().map(x=>({v:x.key,t:(x.code||x.key)+' — '+x.name}))},
      {key:'type',label:'النوع',type:'select',value:'task',options:Object.keys(TYPES).map(k=>({v:k,t:TYPES[k]}))},
      {key:'duration',label:'المدة (أيام عمل)',type:'number',value:'1'},
      {key:'parent',label:'ضمن حزمة (اختياري)',type:'select',value:'',
        options:[{v:'',t:'— بدون حزمة —'}].concat(PROJECT.tasks.filter(t=>t.type==='package').map(p=>({v:p.id,t:p.id+' — '+p.name})))}
    ],confirmText:'إضافة'});
  if(!r)return;
  if(!r.ref){toast('المعرّف مطلوب','warn');return;}
  if(PROJECT.tasks.some(t=>t.id===r.ref)){toast('المعرّف مستخدم بالفعل','warn');return;}
  const _d=parseInt(r.duration||'1',10);
  if(r.type==='task'&&(!_d||_d<1)){toast('مدة المهمة لا تقل عن يوم واحد — للأحداث اللحظية استخدم نوع «معلم»','warn');return;}
  if(r.type==='package'&&r.parent){toast('حزمة العمل لا تكون داخل حزمة أخرى (مستويان: حزمة ← مهام)','warn');return;}
  let _parentDb=null;
  if(r.parent){const pk=PROJECT.tasks.find(t=>t.id===r.parent&&t.type==='package');
    if(!pk){toast('الحزمة المحددة غير موجودة','warn');return;}
    r.track=pk.track; _parentDb=pk._dbId;}
  try{
    await addTask(PROJECT._dbId,{ref:r.ref,name:r.name||'بند جديد',track:r.track,type:r.type,duration:r.type==='package'?0:parseInt(r.duration||'1',10),parent_id:_parentDb});
    await loadProject(CID,PID);
    toast('أُضيف البند بنجاح','ok');
    render();
  }catch(e){toast('تعذّر الإضافة: '+(e.message.includes('duplicate')?'المعرّف مستخدم':e.message),'err');}
}

async function handleDeleteTask(refId){
  const t=PROJECT.tasks.find(x=>x.id===refId);if(!t)return;
  const dependents=PROJECT.tasks.filter(x=>(x.deps||[]).includes(refId)).map(x=>x.id);
  let msg='حذف البند «'+t.name+'» ('+refId+')؟';
  if(dependents.length)msg+='\n\nتنبيه: تعتمد عليه البنود: '+dependents.join('، ')+' — ستُزال هذه الروابط.';
  if(!await confirmDialog('تأكيد الحذف',msg,true))return;
  // لقطة كاملة للتراجع: الحقول + الروابط بالاتجاهين + المتطلبات
  const snap={ref:t.id,name:t.name,track:t.track,type:t.type,duration:t.duration||0,
    deliverable:t.deliverable||null,owner:t.owner||null,status:t.status,progress:t.progress||0,
    parent:t.parent||null,deps:(t.deps||[]).slice(),dependents:dependents.slice(),
    sort:t._sortOrder||999,
    requirements:(t.requirements||[]).map(q=>({description:q.desc,owner:q.owner,sla_days:q.sla,
      blocking:q.blocking,requested_at:q.requested||null,received_at:q.received||null}))};
  try{
    await deleteTask(t._dbId);
    await loadProject(CID,PID);
    render();
    toastUndo('حُذف «'+snap.ref+' — '+snap.name+'»',async()=>{
      const parentDb=snap.parent?((PROJECT.tasks.find(x=>x.id===snap.parent)||{})._dbId||null):null;
      const row={project_id:PROJECT._dbId,ref:snap.ref,name:snap.name,track:snap.track,type:snap.type,
        duration:snap.duration,deliverable:snap.deliverable,owner:snap.owner,
        status:snap.status,progress:snap.progress,sort_order:snap.sort};
      if(parentDb)row.parent_id=parentDb;
      const {data,error}=await sb.from('pmo_tasks').insert(row).select().single();
      if(error)throw error;
      const refDb={};PROJECT.tasks.forEach(x=>refDb[x.id]=x._dbId);refDb[snap.ref]=data.id;
      const depRows=[];
      snap.deps.forEach(d=>{if(refDb[d])depRows.push({project_id:PROJECT._dbId,task_id:data.id,depends_on_id:refDb[d]});});
      snap.dependents.forEach(d=>{if(refDb[d])depRows.push({project_id:PROJECT._dbId,task_id:refDb[d],depends_on_id:data.id});});
      if(depRows.length)await sb.from('pmo_dependencies').insert(depRows);
      if(snap.requirements.length)
        await sb.from('pmo_requirements').insert(snap.requirements.map(q=>Object.assign({task_id:data.id},q)));
      await loadProject(CID,PID);render();
      toast('استُعيد البند بكامل روابطه ومتطلباته','ok');
    });
  }catch(e){toast('تعذّر الحذف: '+e.message,'err');}
}
let DEP_TASK=null;

function openDeps(refId){
  DEP_TASK=PROJECT.tasks.find(t=>t.id===refId);if(!DEP_TASK)return;
  $('#depTitle').textContent='تبعيات: '+DEP_TASK.name+' ('+DEP_TASK.id+')';
  renderDeps();
  $('#depOverlay').style.display='flex';
}

function renderDeps(){
  const current=new Set(DEP_TASK.deps||[]);
  // البنود المتاحة كاعتماد = كل البنود عدا نفسه (ومنع الدوائر المباشرة: لا نعرض من يعتمد عليه)
  const dependents=new Set();
  // إيجاد كل من يعتمد على DEP_TASK (مباشرة أو غير مباشرة) لمنع الدورات
  function collectDependents(ref){PROJECT.tasks.forEach(t=>{if((t.deps||[]).includes(ref)&&!dependents.has(t.id)){dependents.add(t.id);collectDependents(t.id);}});}
  collectDependents(DEP_TASK.id);
  const opts=PROJECT.tasks.filter(t=>t.id!==DEP_TASK.id&&!dependents.has(t.id));
  const xmap={};(DEP_TASK.depsX||[]).forEach(x=>{xmap[x.ref]=x;});
  $('#depList').innerHTML=opts.map(t=>{const on=current.has(t.id),x=xmap[t.id]||{type:'FS',lag:0};
    return `<div class="dep-row" style="display:flex;align-items:center;gap:9px;padding:8px 11px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px;font-size:.84rem">
    <input type="checkbox" data-dep="${esc(t.id)}" ${on?'checked':''} id="dp_${esc(t.id)}">
    <label for="dp_${esc(t.id)}" style="cursor:pointer;flex:1;display:flex;align-items:center;gap:8px"><span class="idcell" style="--tc:${trackMeta(t.track).color}">${esc(t.id)}</span> ${esc(t.name)}</label>
    <select data-deptype="${esc(t.id)}" class="dep-type" aria-label="نوع التبعية" ${on?'':'disabled'}>
      <option value="FS" ${x.type==='FS'?'selected':''}>بعد انتهاء (FS)</option>
      <option value="SS" ${x.type==='SS'?'selected':''}>مع بداية (SS)</option>
      <option value="FF" ${x.type==='FF'?'selected':''}>مع نهاية (FF)</option>
    </select>
    <input type="number" data-deplag="${esc(t.id)}" class="dep-lag" value="${x.lag||0}" title="إزاحة بأيام العمل (سالبة=تداخل)" aria-label="الإزاحة" ${on?'':'disabled'}>
  </div>`;}).join('')||'<p class="empty">لا بنود متاحة.</p>';
  document.querySelectorAll('#depList [data-dep]').forEach(cb=>cb.onchange=()=>{
    const r=cb.dataset.dep;
    const s=document.querySelector(`[data-deptype="${r}"]`),l=document.querySelector(`[data-deplag="${r}"]`);
    if(s)s.disabled=!cb.checked;if(l)l.disabled=!cb.checked;});
}
$('#depSave').onclick=async()=>{
  const links=[...document.querySelectorAll('#depList [data-dep]:checked')].map(c=>{
    const ref=c.dataset.dep;const t=PROJECT.tasks.find(x=>x.id===ref);if(!t)return null;
    const s=document.querySelector(`[data-deptype="${ref}"]`),l=document.querySelector(`[data-deplag="${ref}"]`);
    return {db:t._dbId,type:(s&&s.value)||'FS',lag:parseInt((l&&l.value)||'0',10)||0};
  }).filter(Boolean);
  const dbIds=links;
  try{
    await setDependencies(PROJECT._dbId,DEP_TASK._dbId,dbIds);
    await loadProject(CID,PID);
    $('#depOverlay').style.display='none';
    toast('حُدّثت التبعيات','ok');
    render();
  }catch(e){toast('تعذّر الحفظ: '+e.message,'err');}
};
$('#depClose').onclick=()=>{$('#depOverlay').style.display='none';};
$('#depOverlay').onclick=e=>{if(e.target.id==='depOverlay')$('#depOverlay').style.display='none';};

// ===== تصدير تقرير الحالة (PDF عبر طباعة المتصفح) =====

function buildReport(){
  const c=CLIENTS.find(x=>x.id===CID);
  const tasks=PROJECT.tasks.filter(t=>t.type!=='cont');
  const real=tasks.filter(t=>t.type!=='milestone');
  const done=real.filter(t=>t.status==='done').length;
  const pct=real.length?Math.round(done/real.length*100):0;
  const crit=tasks.filter(t=>SCHED.R[t.id].critical).length;
  const blocked=tasks.filter(t=>TRACK[t.id].blocked).length;
  const clientDelay=tasks.filter(t=>TRACK[t.id].delay==='client').length;
  const alamahDelay=tasks.filter(t=>TRACK[t.id].delay==='alamah').length;
  const dd=D(DATA_DATE);
  const miles=PROJECT.tasks.filter(t=>t.type==='milestone').map(t=>({t,ef:SCHED.R[t.id].EF})).sort((a,b)=>a.ef-b.ef);
  const delayed=tasks.filter(t=>TRACK[t.id].delay).map(t=>({t,d:TRACK[t.id].delay}));
  const pendingReqs=[];PROJECT.tasks.forEach(t=>(t.requirements||[]).forEach(r=>{if(r.owner==='client'&&r._state!=='received'&&r._state!=='latejust')pendingReqs.push({t,r});}));
  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق',lost:'ملغى'};
  const row=(a,b)=>`<tr><td>${a}</td><td style="font-weight:700">${b}</td></tr>`;
  const reportHtml=`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير حالة — ${esc(c?c.name:'')}</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'IBM Plex Sans Arabic',sans-serif;color:#1A1A1A;line-height:1.6;padding:32px;max-width:800px;margin:0 auto}
  .rhd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C8A06B;padding-bottom:16px;margin-bottom:24px}
  .rhd .eb{color:#a9824f;font-weight:700;font-size:.8rem;letter-spacing:.05em}
  .rhd h1{font-size:1.5rem;margin-top:4px}
  .rhd .meta{text-align:left;font-size:.8rem;color:#7d6e54}
  .cdot{display:inline-block;width:12px;height:12px;border-radius:50%;background:${c?c.color:'#C8A06B'};margin-inline-end:6px;vertical-align:middle}
  h2{font-size:1.05rem;color:#a9824f;margin:24px 0 10px;padding-bottom:5px;border-bottom:1px solid #E9DEC9}
  table{width:100%;border-collapse:collapse;font-size:.88rem}
  td{padding:7px 10px;border-bottom:1px solid #F0E8D8}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
  .kpi{background:#FAF7F2;border:1px solid #E9DEC9;border-radius:10px;padding:14px;text-align:center}
  .kpi b{display:block;font-size:1.6rem;color:#a9824f}.kpi.crit b{color:#a8442f}.kpi.ok b{color:#2E7D32}
  .kpi span{font-size:.72rem;color:#7d6e54}
  .badge{font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;background:#F4ECDC}
  .del-client{color:#a8442f}.del-alamah{color:#35608F}
  .foot{margin-top:32px;padding-top:14px;border-top:1px solid #E9DEC9;font-size:.74rem;color:#7d6e54;text-align:center}
  @media print{body{padding:0}@page{margin:1.5cm}}
  </style></head><body>
  <div class="rhd">
    <div><div class="eb">علامة · أثر دائم</div><h1><span class="cdot"></span>${esc(c?c.name:'')} — تقرير حالة المشروع</h1></div>
    <div class="meta">التاريخ: ${new Date().toLocaleDateString('ar')}<br>تاريخ الحالة: ${fmt(dd)}/${dd.getFullYear()}<br>المرحلة: ${LIFE[PROJECT.lifecycle]||'—'}</div>
  </div>
  <div class="kpis">
    <div class="kpi ok"><b>${pct}%</b><span>نسبة الإنجاز</span></div>
    <div class="kpi"><b>${fmt(SCHED.pEnd)}/${new Date(SCHED.pEnd).getFullYear()}</b><span>الانتهاء المتوقع</span></div>
    <div class="kpi"><b>${SCHED.totalWD}</b><span>أيام العمل</span></div>
    <div class="kpi"><b>${done}/${real.length}</b><span>المنجز/الإجمالي</span></div>
    <div class="kpi crit"><b>${blocked}</b><span>بنود متوقفة</span></div>
    <div class="kpi crit"><b>${crit}</b><span>على المسار الحرج</span></div>
  </div>
  <h2>المعالم</h2>
  <table>${miles.map(m=>`<tr><td>◆ ${esc(m.t.name.replace('معلم: ',''))}</td><td style="text-align:left;font-weight:700">${fmt(m.ef)}/${new Date(m.ef).getFullYear()}</td></tr>`).join('')||'<tr><td>لا معالم</td></tr>'}</table>
  ${delayed.length?`<h2>البنود المتأخرة (${delayed.length})</h2><table>${delayed.map(x=>`<tr><td>${esc(x.t.id)} — ${esc(x.t.name)}</td><td class="del-${x.d}" style="text-align:left;font-weight:700">${x.d==='client'?'بانتظار العميل':'على فريق علامة'}</td></tr>`).join('')}</table>`:''}
  ${pendingReqs.length?`<h2>متطلبات معلّقة من العميل (${pendingReqs.length})</h2><table>${pendingReqs.map(x=>`<tr><td>${esc(x.r.desc)}</td><td style="text-align:left"><span class="badge">${esc(x.t.id)} · SLA ${x.r.sla}ي</span></td></tr>`).join('')}</table>`:''}
  <div class="foot">علامة · منصّة حوكمة المشاريع — تقرير مُولّد آليًا · ${PROJECT.name}</div>
  </body></html>`;
  const w=window.open('','_blank');
  if(!w){toast('فعّل النوافذ المنبثقة لتصدير التقرير','warn');return;}
  w.document.write(reportHtml);w.document.close();
  setTimeout(()=>{w.focus();w.print();},600);
}
$('#exportReport').onclick=()=>{ if(SCREEN!=='project'||!PROJECT||!PROJECT.tasks.length){toast('افتح مشروعًا له خطة أولًا','warn');return;} buildReport(); };

// دعم لوحة المفاتيح: Enter/Space يفعّلان العناصر ذات role=button (بطاقات، صفوف)
document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.getAttribute&&e.target.getAttribute('role')==='button'&&e.target.tagName!=='BUTTON'){
    e.preventDefault(); e.target.click();
  }
});

// إعادة العرض عند تبدّل عرض الشاشة (جوال ↔ سطح مكتب)
if(typeof window!=='undefined'&&window.matchMedia){
  const _mq=window.matchMedia('(max-width:700px)');
  const _onMQ=()=>{if(typeof SCREEN!=='undefined'&&SCREEN==='project'&&VIEW==='table')render();};
  if(_mq.addEventListener)_mq.addEventListener('change',_onMQ);
  else if(_mq.addListener)_mq.addListener(_onMQ);
}
// انطلاق
boot();
// طباعة احترافية: الجدول (كل مرحلة صفحة) أو الجانت (مصغّر ليطابق الصفحة، بلا تداخل)

function printProject(mode){
  if(mode==='gantt'){
    const prevPX=PX; PX=6; render();
    setTimeout(()=>{
      window.print();
      const restore=()=>{PX=prevPX;render();window.removeEventListener('afterprint',restore);};
      window.addEventListener('afterprint',restore);
    },80);
  }else{
    window.print();
  }
}

