// ===== لوحة البند =====
// كل ما يخص بندًا واحدًا في مكان واحد: تفاصيل · تبعيات · متطلبات · نقاش · سجل.
// تعالج شكوى «التبويبات غير مترابطة»: بدل التنقل بين أربعة تبويبات لتكوين صورة عن بند،
// تُفتح اللوحة من صف البند مباشرة.

let TK_TASK=null,TK_VIEW='info',TK_THREAD=null,TK_LOADING=false,TK_PREVFOCUS=null;

const TK_TABS=[
  {k:'info',t:'تفاصيل'},
  {k:'deps',t:'تبعيات'},
  {k:'reqs',t:'متطلبات'},
  {k:'talk',t:'نقاش'},
  {k:'log', t:'سجل'}
];

async function openTaskPanel(refId,view){
  TK_TASK=PROJECT.tasks.find(t=>t.id===refId);
  if(!TK_TASK){toast('البند غير موجود','warn');return;}
  TK_VIEW=view||'info';TK_THREAD=null;
  $('#tkTitle').textContent=TK_TASK.id+' — '+TK_TASK.name;
  TK_PREVFOCUS=document.activeElement;
  $('#taskOverlay').style.display='flex';
  renderTaskPanel();
  const ft=document.querySelector('#tkTabs .tktab.active')||$('#tkClose');
  if(ft)setTimeout(()=>ft.focus(),40);
  loadTaskPanelThread();
}
function closeTaskPanel(){
  $('#taskOverlay').style.display='none';
  TK_TASK=null;TK_THREAD=null;
  if(TK_PREVFOCUS&&TK_PREVFOCUS.focus)try{TK_PREVFOCUS.focus();}catch(e){}
  TK_PREVFOCUS=null;
}
async function loadTaskPanelThread(){
  if(!TK_TASK||!TK_TASK._dbId)return;
  TK_LOADING=true;
  try{ TK_THREAD=await loadTaskThread(PROJECT._dbId,TK_TASK._dbId); }
  catch(e){ TK_THREAD={comments:[],audit:[],error:e.message}; }
  TK_LOADING=false;
  if(TK_TASK)renderTaskPanel();
}

function tkCount(k){
  if(!TK_TASK)return 0;
  if(k==='deps')return (TK_TASK.depsX||[]).length;
  if(k==='reqs')return (TK_TASK.requirements||[]).length;
  if(k==='talk')return TK_THREAD?TK_THREAD.comments.length:0;
  return 0;
}

function renderTaskPanel(){
  if(!TK_TASK)return;
  $('#tkTabs').innerHTML=TK_TABS.map(x=>{
    const n=tkCount(x.k);
    return `<button class="tktab ${x.k===TK_VIEW?'active':''}" role="tab" id="tk-tab-${x.k}" aria-controls="tkBody" aria-selected="${x.k===TK_VIEW}" tabindex="${x.k===TK_VIEW?0:-1}" data-tk="${x.k}">${x.t}${n?`<span class="tkn">${n}</span>`:''}</button>`;
  }).join('');
  const tb=$('#tkBody');tb.setAttribute('role','tabpanel');tb.setAttribute('aria-labelledby','tk-tab-'+TK_VIEW);
  $$('#tkTabs .tktab').forEach(b=>b.onclick=()=>{TK_VIEW=b.dataset.tk;renderTaskPanel();});
  // أسهم لوحة المفاتيح (RTL: اليسار = التالي) + Home/End
  $('#tkTabs').onkeydown=e=>{
    const ks=TK_TABS.map(x=>x.k);const i=ks.indexOf(TK_VIEW);let j=null;
    if(e.key==='ArrowLeft')j=(i+1)%ks.length;
    else if(e.key==='ArrowRight')j=(i-1+ks.length)%ks.length;
    else if(e.key==='Home')j=0;else if(e.key==='End')j=ks.length-1;
    if(j===null)return;
    e.preventDefault();TK_VIEW=ks[j];renderTaskPanel();
    const nb=document.querySelector('#tkTabs .tktab[data-tk="'+ks[j]+'"]');if(nb)nb.focus();
  };

  const H={info:tkInfo,deps:tkDeps,reqs:tkReqs,talk:tkTalk,log:tkLog};
  $('#tkBody').innerHTML=(H[TK_VIEW]||tkInfo)();
  bindTaskPanel();
}

// ---------- تفاصيل ----------
function tkInfo(){
  const t=TK_TASK,r=SCHED.R[t.id],k=(TRACK&&TRACK[t.id])||{};
  const row=(l,v)=>`<tr><th>${l}</th><td>${v}</td></tr>`;
  const meta=trackMeta(t.track);
  return `<table class="tkinfo">
    ${row('الاسم',esc(t.name))}
    ${row('المرحلة',esc(meta.code+' — '+meta.name))}
    ${row('النوع',t.type==='milestone'?'معلم':(t.type==='package'?'حزمة عمل':'بند'))}
    ${row('المدة',t.type==='milestone'?'—':(t.duration+' يوم'))}
    ${row('البداية/النهاية',r?(fmt(r.ES)+' ← '+fmt(r.EF)):'—')}
    ${row('الحالة','<span class="ministat s-'+(k.effStatus||t.status)+'">'+(STATUS[k.effStatus||t.status]||'—')+'</span>')}
    ${row('التقدّم',(t.progress||0)+'%')}
    ${row('المسؤول',esc(t.owner||'—'))}
    ${row('المخرج',esc(t.deliverable||'—'))}
    ${r&&r.critical?row('المسار الحرج','<span class="crstate rejected">على المسار الحرج</span>'):''}
  </table>
  <div class="tkacts">
    <button class="reqbtn" id="tkGo">↗ إظهاره في الخطة</button>
    ${can('editStruct')?'<button class="reqbtn" id="tkEditReqs">إدارة المتطلبات</button>':''}
  </div>`;
}

// ---------- تبعيات ----------
function tkDeps(){
  const d=TK_TASK.depsX||[];
  const TY={FS:'ينتهي ← يبدأ',SS:'يبدآن معًا',FF:'ينتهيان معًا'};
  if(!d.length)return '<p class="empty">لا تبعيات — هذا البند يبدأ بلا انتظار بند آخر.</p>';
  const rows=d.map(x=>{
    const p=PROJECT.tasks.find(t=>t.id===x.ref);
    return `<tr><td><b>${esc(x.ref)}</b></td><td>${esc(p?p.name:'—')}</td>
      <td>${TY[x.type]||x.type}</td><td>${x.lag?(x.lag+' يوم'):'—'}</td>
      <td><button class="lnk" data-tkgo="${esc(x.ref)}">فتح</button></td></tr>`;
  }).join('');
  return `<p class="tkhint">البنود التي يجب أن تسبق هذا البند.</p>
    <table class="tktbl"><thead><tr><th>المرجع</th><th>البند</th><th>النوع</th><th>فاصل</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- متطلبات ----------
function tkReqs(){
  const q=TK_TASK.requirements||[];
  if(!q.length)return '<p class="empty">لا متطلبات مسجّلة لهذا البند.</p>';
  // الحالة محسوبة في المحرك (computeTracking) — لا نعيد حساب SLA هنا
  const ST={received:['approved','مُستلم'],latejust:['pending','مُستلم متأخرًا'],
            overdue:['rejected','متأخر'],pending:['pending','بانتظار']};
  const rows=q.map(x=>{
    const s=ST[x._state]||['pending','بانتظار'];
    const lateTxt=(x._state==='overdue'&&x._late)?(' +'+x._late):'';
    return `<tr><td>${esc(x.desc)}</td><td>${esc(x.owner||'—')}</td>
      <td>${x.blocking?'<span class="crstate rejected" style="font-size:.68rem">حاجز</span>':'—'}</td>
      <td><span class="crstate ${s[0]}" style="font-size:.68rem">${s[1]}${lateTxt}</span></td></tr>`;
  }).join('');
  return `<p class="tkhint">مدخلات يحتاجها تنفيذ هذا البند. المتطلب «الحاجز» غير المُستلم يوقف البند.</p>
    <table class="tktbl"><thead><tr><th>المتطلب</th><th>المسؤول</th><th>حاجز</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- نقاش البند ----------
function tkTalk(){
  if(TK_LOADING||!TK_THREAD)return '<p class="empty">جارٍ التحميل…</p>';
  if(TK_THREAD.error)return '<p class="empty">تعذّر تحميل النقاش: '+esc(TK_THREAD.error)+'</p>';
  const KIND={comment:'تعليق',question:'سؤال',suggestion:'مقترح'};
  const ROLE_AR={pmo:'إدارة المشاريع',delivery:'الفريق',client:'العميل'};
  const list=TK_THREAD.comments.map(c=>{
    const when=new Date(c.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    return `<div class="tkmsg">
      <div class="tkmsg-hd"><b>${esc(c.author_email||'—')}</b>
        <span>${ROLE_AR[c.author_role]||''} · ${KIND[c.kind]||c.kind} · ${when}</span></div>
      <div>${esc(c.body)}</div></div>`;
  }).join('');
  return `<p class="tkhint">نقاش مرتبط بهذا البند تحديدًا — ويظهر أيضًا في تبويب «النقاش» العام.</p>
    ${list||'<p class="empty">لا نقاش على هذا البند بعد.</p>'}
    <div class="crform" style="position:static;margin-top:14px">
      <select id="tkKind"><option value="comment">تعليق</option><option value="question">سؤال</option><option value="suggestion">مقترح</option></select>
      <textarea id="tkBodyIn" placeholder="اكتب رسالتك حول هذا البند..."></textarea>
      <button class="hbtn" id="tkSend" style="background:var(--gold);border-color:var(--gold);width:100%">إرسال</button>
    </div>`;
}

// ---------- سجل البند ----------
function tkLog(){
  if(TK_LOADING||!TK_THREAD)return '<p class="empty">جارٍ التحميل…</p>';
  const rows=TK_THREAD.audit;
  if(!rows.length)return '<p class="empty">لا تغييرات مسجّلة على هذا البند.</p>';
  const body=rows.map(a=>{
    const when=new Date(a.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    const ov=a.old_value,nv=a.new_value;
    let d='';
    if(a.action==='status_change'&&ov&&nv)d=(STATUS[ov.status]||ov.status)+' ← '+(STATUS[nv.status]||nv.status);
    else if(a.action==='progress_change'&&nv)d=(ov?ov.progress:0)+'% ← '+nv.progress+'%';
    else if(a.action==='duration_change'&&nv)d=(ov?ov.duration:'?')+' ← '+nv.duration+' يوم';
    return `<tr><td><small>${when}</small></td>
      <td><span class="crstate ${auditTone(a.action)}" style="font-size:.68rem">${AUDIT_ACTIONS[a.action]||a.action}</span></td>
      <td>${esc(d)}</td></tr>`;
  }).join('');
  return `<p class="tkhint">آخر ${rows.length} تغييرًا على هذا البند.</p>
    <table class="tktbl"><thead><tr><th>الوقت</th><th>الإجراء</th><th>التغيير</th></tr></thead><tbody>${body}</tbody></table>`;
}

function bindTaskPanel(){
  const go=$('#tkGo');
  if(go)go.onclick=()=>{const r=TK_TASK.id;closeTaskPanel();gotoTask(r);};
  const er=$('#tkEditReqs');
  if(er)er.onclick=()=>{const r=TK_TASK.id;closeTaskPanel();openReqs(r);};
  $$('[data-tkgo]').forEach(b=>b.onclick=()=>openTaskPanel(b.dataset.tkgo,'info'));
  const send=$('#tkSend');
  if(send)send.onclick=async()=>{
    const body=$('#tkBodyIn').value.trim();
    if(!body){toast('اكتب رسالة','warn');return;}
    try{
      await addComment(PROJECT._dbId,$('#tkKind').value,body,null,TK_TASK._dbId);
      toast('أُرسلت','ok');
      await loadTaskPanelThread();
      await refreshProjectCounts();
      if(typeof render==='function'&&SCREEN==='project')render();
    }catch(e){ toast('تعذّر الإرسال: '+e.message,'err'); }
  };
}

window.openTaskPanel=openTaskPanel;
