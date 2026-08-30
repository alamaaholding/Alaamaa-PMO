// ===== app/main.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
// savePFilters انتقلت إلى app/state.js — حيث كانت القراءة المقابلة لها أصلًا.
// SCREEN انتقلت إلى app/state.js — حالة يقرؤها عشرة ملفات، لا حالة ملف واحد.

// ===== الإشعارات (Toast) =====

// toast/toastUndo انتقلتا إلى src/toast.js (الموجة W2) — تصلان عبر globalThis.

// ===== إغلاق موحّد للنوافذ: data-close بدل onclick سطري =====
// سبب النشأة: أربع نوافذ كانت تغلق بـ
//   onclick="document.getElementById('holOverlay').style.display='none'"
// مكتوبًا في الترميز. وله ثمنان: تكرار المنطق نفسه في كل نافذة، و**فرض
// script-src 'unsafe-inline'** على أي CSP مستقبلية — وهي الطبقة الدفاعية
// الثانية الغائبة اليوم (AUDIT §د-١). معالج مفوَّض واحد يغطي كل نافذة حالية
// وقادمة: يكفي أن يحمل زر الإغلاق data-close="<معرّف الطبقة>".
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-close]');
  if (!b) return;
  const ov = document.getElementById(b.dataset.close);
  if (ov) ov.style.display = 'none';
});

// ===== نوافذ الحوار المخصّصة (بديل prompt/confirm المتصفح) =====

// ===== مبدّل سريع للشركاء والمشاريع (طاقم فقط) =====
let QJ_INDEX=[];
async function refreshQJIndex(){
  try{
    const {data}=await fetchPortfolio();
    const byClient={};
    (data||[]).forEach(r=>{
      const c=(byClient[r.client_id]=byClient[r.client_id]||{cid:r.client_id,name:r.client_name,projects:[]});
      if(r.project_id)c.projects.push({id:r.project_id,name:r.project_name});
    });
    QJ_INDEX=Object.values(byClient);
  }catch(e){QJ_INDEX=[];}
}
function qjRender(q){
  const list=$('#qjumpList');if(!list)return;
  q=(q||'').trim();
  if(!q){list.hidden=true;list.innerHTML='';return;}
  const nq=q.toLowerCase();
  const results=[];
  QJ_INDEX.forEach(c=>{
    if(c.name.toLowerCase().includes(nq))results.push({kind:'client',cid:c.cid,label:c.name,sub:(c.projects.length?c.projects.length+' مشروع':'بلا مشاريع')});
    c.projects.forEach(p=>{if(p.name.toLowerCase().includes(nq)||c.name.toLowerCase().includes(nq))
      results.push({kind:'project',cid:c.cid,id:p.id,label:p.name,sub:c.name});});
  });
  const top=results.slice(0,8);
  if(!top.length){list.innerHTML='<div class="qjump-empty">لا نتائج مطابقة</div>';list.hidden=false;return;}
  list.innerHTML=top.map((r,i)=>`<button class="qjump-item" data-qj="${i}" role="option">
    <span class="qji">${r.kind==='project'?'📄':'🏢'}</span><b>${esc(r.label)}</b><span class="qjs">${esc(r.sub)}</span></button>`).join('');
  list.hidden=false;
  $$('#qjumpList [data-qj]').forEach((b,i)=>b.onclick=()=>qjGo(top[i]));
}
// إغلاق لوحة القفز السريع (الجوال) — واستعادة التركيز للزر الذي فتحها
function qjClose(){
  const wrap=$('#qjumpWrap'),list=$('#qjumpList'),input=$('#qjumpInput'),btn=$('#qjumpBtn');
  if(list)list.hidden=true;
  if(input){input.value='';input.blur();}
  if(wrap&&wrap.classList.contains('open')){
    wrap.classList.remove('open');
    if(btn){btn.setAttribute('aria-expanded','false');btn.focus();}
  }
}
async function qjGo(item){
  qjClose();
  if(item.kind==='project'){CID=item.cid;PID=item.id;await openProject();return;}
  await showScreen('clienthome', item.cid);
}
function bindQJump(){
  const wrap=$('#qjumpWrap');if(!wrap||wrap._bound)return;wrap._bound=true;
  wrap.style.display=(ROLE==='pmo'||ROLE==='delivery')?'':'none';
  if(ROLE!=='pmo'&&ROLE!=='delivery')return;
  const input=$('#qjumpInput'),list=$('#qjumpList');
  input.addEventListener('focus',async()=>{if(!QJ_INDEX.length)await refreshQJIndex();qjRender(input.value);});
  input.addEventListener('input',()=>qjRender(input.value));
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){qjClose();}
    else if(e.key==='Enter'){const first=list.querySelector('[data-qj]');if(first)first.click();}
  });
  document.addEventListener('click',e=>{
    if(wrap.classList.contains('open'))return;      // اللوحة كاملة الشاشة: لا «خارجها» تُنقَر
    if(!wrap.contains(e.target)&&e.target!==$('#qjumpBtn'))list.hidden=true;
  });
  // الجوال: الزر يفتح اللوحة نفسها — لا واجهة بحث ثانية
  const qbtn=$('#qjumpBtn');
  if(qbtn){
    qbtn.style.display=(ROLE==='pmo'||ROLE==='delivery')?'':'none';
    qbtn.onclick=async()=>{
      wrap.classList.add('open');
      qbtn.setAttribute('aria-expanded','true');
      if(!QJ_INDEX.length)await refreshQJIndex();
      input.focus();
    };
  }
  const qx=$('#qjumpClose');if(qx)qx.onclick=qjClose;
}

async function startApp(){
  $('#login').classList.add('hidden');$('#loader').classList.remove('hidden');
  await loadClients();
  $('#app').classList.remove('hidden');$('#loader').classList.add('hidden');
  $('#uName').textContent=USER._name||USER.email;
  $('#roleChip').textContent=ROLE_NAMES[ROLE];
  bindQJump();
  $('#dataDate').value=DATA_DATE;$('#dataDate').onchange=e=>{DATA_DATE=e.target.value;if(SCREEN==='project')render();else showScreen('portfolio');};
  if(!CLIENTS.length){$('#host').innerHTML='<p style="padding:30px;text-align:center;color:var(--muted)">لا توجد مشاريع متاحة لحسابك بعد.</p>';hideChrome();return;}
  // الفلاتر من الرابط قبل أي تصيير: تطبيقها بعده يعني وميضًا يعرض المحفظة
  // كاملة ثم يصفّيها — والمستخدم يرى شاشة لم يطلبها للحظة.
  applyHashFilters();
  // الشريك: دخول مباشر لمشروعه الوحيد. الطاقم: شاشة المحفظة
  if(ROLE==='client'){
    SCREEN='project';CID=CLIENTS[0].id;await loadProject(CID);render();
  }else if(await tryOpenProjectFromHash()){
    // فُتح مشروع مباشرة من رابط عميق (مجلد فرعي أو الصيغة القديمة) — لا شيء إضافي مطلوب
  }else if(/^#\/workload\/?$/.test(location.hash||'')&&(ROLE==='pmo'||ROLE==='delivery')){
    SCREEN='workload';await showScreen('workload');
  }else if(/^#\/contracts\/?$/.test(location.hash||'')&&(ROLE==='pmo'||ROLE==='delivery')){
    SCREEN='contractshub';await showScreen('contractshub');
  }else{
    const cm=/^#\/c\/([^/]+)$/.exec(location.hash||'');
    let rid=cm?resolveClientIdentifier(cm[1]):null;
    if(cm&&!rid){ try{const r=await resolveClientLink(cm[1]);if(r&&r.ok)rid=r.client_id;}catch(e){} }
    if(rid){SCREEN='clienthome';await showScreen('clienthome', rid);}
    else{SCREEN='portfolio';await showScreen('portfolio');}
  }
}

// hideChrome / showChrome انتقلتا إلى src/chrome.js — كانتا تربطان تسعة ملفات بهذا الملف.


// ===== شاشة المحفظة (للطاقم) =====


// ===== الروابط العميقة =====
// الشكل الجديد: #/c/{شريك}/{مشروع}/{تبويب}[/t/{بند}] — مجلد فرعي داخل مجلد الشريك.
// الصيغة القديمة #/p/{معرّف المشروع}/{تبويب}[/t/{بند}] تبقى مدعومة للأبد للتوافق مع أي رابط سبق مشاركته.
// انتقلت طبقة الرابط كاملةً إلى src/urlstate.js: writeHash · writePortfolioHash ·
// parseHash · applyHashFilters — ومعها _hashLock الذي تشترك فيه. كانت المرمِّزات
// هناك ومُستعمِلوها هنا، أي أن الطبقة الواحدة كانت مقسومة بين ملفّين.
// و`_focusRef` صار FOCUS_REF في app/state.js — جزءٌ من الرابط لا خاصٌّ بالملف.
// المحفظة نفسها «مجلد جذري» له رابط نظيف خاص به — لا يبقى الرابط عالقًا على آخر مشروع
// أو شريك كان مفتوحًا قبلها، وهذا بالضبط ما يجعل التنقّل يعكس ما يُعرَض فعليًا دائمًا.

// تطبيق الرابط عند الفتح أو عند تغيّره يدويًا — يطابق المشروع المُحمَّل حاليًا بمعرّفه
// النظيف أو الخام معًا (لا يفتح مشروعًا جديدًا؛ ذلك عمل tryOpenProjectFromHash عند الإقلاع)
function applyHash(){
  const h=parseHash();if(!h)return false;
  if(!PROJECT||!PROJECT._dbId)return false;
  const client=(CLIENTS||[]).find(x=>x.id===CID);
  const cOk=!h.clientRef||CID===h.clientRef||(client&&client.slug===h.clientRef);
  const pOk=PROJECT._dbId===h.projectRef||PROJECT.slug===h.projectRef;
  if(cOk&&pOk&&PERMS[ROLE]&&PERMS[ROLE].views.indexOf(h.view)>-1){
    VIEW=h.view;FOCUS_REF=h.ref||null;
    render();
    if(FOCUS_REF)focusTask(FOCUS_REF);
    return true;
  }
  return false;
}
// فتح مشروع طازج مباشرة من رابط عميق (بلا أي مشروع محمَّل مسبقًا) — يحلّ المعرّفين عبر
// الخادم أولًا (نظيفَين أو خامَين أو مزيجًا)، ثم يفتح المشروع ويطبّق التبويب/البند المطلوبَين.
async function tryOpenProjectFromHash(){
  const h=parseHash();if(!h)return false;
  try{
    const r=await resolveProjectLink(h.clientRef,h.projectRef);
    if(!r||!r.ok)return false;
    CID=r.client_id;PID=r.project_id;
    SCREEN='project';
    await loadProject(CID,PID);
    if(PROJECT_ACCESS_DENIED||!PROJECT)return false;
    $('#barClient').style.display='';showChrome();
    if(PERMS[ROLE]&&PERMS[ROLE].views.indexOf(h.view)>-1){VIEW=h.view;FOCUS_REF=h.ref||null;}
    render();writeHash();
    if(FOCUS_REF)focusTask(FOCUS_REF);
    return true;
  }catch(e){return false;}
}
window.addEventListener('hashchange',async()=>{
  if(isHashLocked())return;
  if(typeof SCREEN!=='undefined'&&SCREEN==='project'&&applyHash())return;
  if(await tryOpenProjectFromHash())return;
  if(/^#\/workload\/?$/.test(location.hash||'')){
    if(ROLE==='pmo'||ROLE==='delivery')showScreen('workload');
    return;
  }
  if(/^#\/contracts\/?$/.test(location.hash||'')){
    if(ROLE==='pmo'||ROLE==='delivery')showScreen('contractshub');
    return;
  }
  if(/^#\/?$/.test(location.hash||'')){
    if(ROLE==='pmo'||ROLE==='delivery')showScreen('portfolio');
    return;
  }
  const cm=/^#\/c\/([^/]+)$/.exec(location.hash||'');
  let rid=cm?resolveClientIdentifier(cm[1]):null;
  if(cm&&!rid){ try{const r=await resolveClientLink(cm[1]);if(r&&r.ok)rid=r.client_id;}catch(e){} }
  if(rid&&(ROLE==='pmo'||ROLE==='delivery'))showScreen('clienthome', rid);
});

// إغلاق لوحة البند: زر، نقر على الخلفية، ومفتاح Esc
(function bindTaskOverlayChrome(){
  const wire=()=>{
    const ov=document.getElementById('taskOverlay');if(!ov)return;
    const cl=document.getElementById('tkClose');if(cl)cl.onclick=closeTaskPanel;
    ov.addEventListener('click',e=>{if(e.target===ov)closeTaskPanel();});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&ov.style.display==='flex')closeTaskPanel();});
    // حبس Tab داخل النافذة العائمة المفتوحة (WAI-ARIA Dialog)
    document.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const open=[...document.querySelectorAll('.rqoverlay')].find(x=>x.style.display==='flex');
      if(!open)return;
      const f=[...open.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
        .filter(el=>!el.disabled&&!el.hasAttribute('hidden')&&el.getAttribute('tabindex')!=='-1');
      if(!f.length)return;
      const first=f[0],last=f[f.length-1],a=document.activeElement;
      if(e.shiftKey&&(a===first||!open.contains(a))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(a===last||!open.contains(a))){e.preventDefault();first.focus();}
    },true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

async function openProject(){
  TFILTER={phases:new Set(),statuses:new Set(),smart:new Set(),q:''};
  $('#loader').classList.remove('hidden');
  await loadProject(CID,PID);
  $('#loader').classList.add('hidden');
  if(PROJECT_ACCESS_DENIED){
    SCREEN='portfolio';toast('لا تملك صلاحية الوصول لهذا المشروع','err');await showScreen('portfolio');return;
  }
  SCREEN='project';$('#barClient').style.display='';showChrome();
  // إن كان الوصول عبر رابط عميق، افتح التبويب/البند المقصود؛ وإلا اعرض الافتراضي
  if(!applyHash()){render();writeHash();}
}

// تعديل تاريخ بدء المشروع — المصدر الوحيد للحقيقة، يعيد حساب كل التواريخ


// ===== دورة حياة الشريك (المرحلة 1) =====
// حوار مشروع جديد (يُستدعى من قائمة الشريك وزر البطاقة)

async function renderPortfolioTimeline(){
  SCREEN='ptimeline';$('#hProject').textContent='خط التسليمات — كل المشاريع';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backPT">↩ المحفظة</button><span class="ms-auto">📦 <b>خط التسليمات:</b> سجل زمني للتبادل بين علامة والشركاء عبر <b>كل المشاريع</b>.</span></div><div id="ptlWrap">'+skeleton('cards',2)+'</div>';
  $('#backPT').onclick=()=>showScreen('portfolio');
  openTimelinePortfolio('ptlWrap');
}
async function renderAuditLog(){
  SCREEN='audit';$('#hProject').textContent='سجل المكتب — كل المشاريع';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backP">↩ المحفظة</button><span class="ms-auto">🗂 <b>سجل المكتب:</b> كل الأفعال الحسّاسة عبر <b>كل المشاريع والشركاء</b> — من فعل، ماذا، ومتى. (سجل مشروع واحد: تبويب «سجل المشروع» داخله)</span></div><div id="auditList">'+skeleton('panel',3)+'</div>';
  $('#backP').onclick=()=>showScreen('portfolio');
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

// ===== شاشة الشركاء المحتملين (PMO) =====

async function renderLeads(){
  // كانت هذه الشاشة وحدها لا تضبط SCREEN ولا تُخفي الإطار — بخلاف شقيقتيها
  // المجاورتين لها أعلاه حرفيًّا. ولم يظهر الأثر لأن لا مستهلك يميّز 'leads' عن
  // 'portfolio' بعدُ، فبقي التناقض مستترًا خلف صدفةٍ لا خلف قرار.
  SCREEN='leads';$('#hProject').textContent='الشركاء المحتملون';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backToPortfolio">↩ المحفظة</button><span class="ms-auto">النماذج الواردة من الموقع — حوّل أيًّا منها إلى مشروع-مقترح.</span></div><div id="leadsList">'+skeleton('list',2)+'</div>';
  $('#backToPortfolio').onclick=()=>showScreen('portfolio');
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
      ${conv?'':`<button class="reqbtn gold" data-convert="${l.id}" data-name="${esc(l.company_name||'')}">تحويل لمشروع</button>`}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-convert]').forEach(b=>b.onclick=async()=>{
    const r=await dialog({title:'تحويل إلى مشروع',message:'سيُنشأ شريك ومشروع في مرحلة «مقترح».',
      fields:[{key:'name',label:'اسم المشروع',value:'مشروع '+(b.dataset.name||'')}],confirmText:'إنشاء'});
    if(!r||!r.name)return;
    b.disabled=true;b.textContent='جارٍ...';
    try{
      await convertLead(b.dataset.convert, r.name);
      await loadClients();
      toast('تم إنشاء شريك ومشروع-مقترح بنجاح','ok');
      renderLeads();
    }catch(e){ toast('تعذّر التحويل: '+e.message,'err'); b.disabled=false;b.textContent='تحويل لمشروع'; }
  });
}


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
  if(await confirmDialog('تصدير للعقد','تصدير هذه اللقطة الآن كمستند PDF مرفق بالعقد؟',false))
    await buildContractDoc(PROJECT.baselines[PROJECT.baselines.length-1].id);
};

// ===== تبويب طلبات التغيير =====


// ===== أداة بناء الخطة (PMO) =====


// ===== تصدير تقرير الحالة (PDF عبر طباعة المتصفح) =====

function buildReport(){
  const c=CLIENTS.find(x=>x.id===CID);
  const tasks=PROJECT.tasks.filter(t=>t.type!=='cont');
  const real=tasks.filter(t=>t.type!=='milestone');
  const done=real.filter(t=>t.status==='done').length;
  const pct=real.length?Math.round(done/real.length*100):0;
  const crit=tasks.filter(t=>SCHED.R[t.id].critical).length;
  const blocked=tasks.filter(t=>TRACK[t.id].blocked).length;
  const dd=D(DATA_DATE);
  const miles=PROJECT.tasks.filter(t=>t.type==='milestone').map(t=>({t,ef:SCHED.R[t.id].EF})).sort((a,b)=>a.ef-b.ef);
  const delayed=tasks.filter(t=>TRACK[t.id].delay).map(t=>({t,d:TRACK[t.id].delay}));
  const pendingReqs=[];PROJECT.tasks.forEach(t=>(t.requirements||[]).forEach(r=>{if(r.owner==='client'&&r._state!=='received'&&r._state!=='latejust')pendingReqs.push({t,r});}));
  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق',lost:'ملغى'};
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
  ${delayed.length?`<h2>البنود المتأخرة (${delayed.length})</h2><table>${delayed.map(x=>`<tr><td>${esc(x.t.id)} — ${esc(x.t.name)}</td><td class="del-${x.d}" style="text-align:left;font-weight:700">${x.d==='client'?'بانتظار الشريك':'على فريق علامة'}</td></tr>`).join('')}</table>`:''}
  ${pendingReqs.length?`<h2>متطلبات معلّقة من الشريك (${pendingReqs.length})</h2><table>${pendingReqs.map(x=>`<tr><td>${esc(x.r.desc)}</td><td style="text-align:left"><span class="badge">${esc(x.t.id)} · SLA ${x.r.sla}ي</span></td></tr>`).join('')}</table>`:''}
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
// مركز الإشعارات يُربط عند التحميل لا بعد الدخول: الأخطاء التي تقع أثناء
// المصادقة نفسها هي أولى ما يستحق أن يبقى له أثر. والجرس داخل #app المخفي
// حتى الدخول، فلا يظهر قبل أوانه.
bindNotificationCenter();
bindTheme();
boot();
// طباعة احترافية: الجدول (كل مرحلة صفحة) أو الجانت (مصغّر ليطابق الصفحة، بلا تداخل)


// ===== تسجيل الشاشة في السجلّ (src/screens.js) =====
// المفتاح هو ما يناديه بقية التطبيق، فلا ملف شاشةٍ يعرف اسم دالة شاشةٍ أخرى.
registerScreen('project', openProject);
registerScreen('ptimeline', renderPortfolioTimeline);
registerScreen('audit', renderAuditLog);
registerScreen('leads', renderLeads);
