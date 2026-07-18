// ===== app/lifecycle.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
async function newProjectDialog(clientId){
  const c=CLIENTS.find(x=>x.id===clientId)||{name:''};
  const p=await dialog({title:'مشروع جديد — '+c.name,
    message:'يُنشأ المشروع كمسوّدة بمراحله الافتراضية الأربع (قابلة للتعديل من إدارة المراحل).',
    fields:[
      {key:'name',label:'اسم المشروع',placeholder:'مثل: حملة الصيف 2026'},
      {key:'date',label:'تاريخ البدء',type:'date',value:todayISO()}
    ],confirmText:'إنشاء المشروع'});
  if(!p||!p.name)return;
  try{
    const proj=await insertProjectForClient(clientId,p.name,p.date||todayISO());
    toast('أُنشئ المشروع — جاهز لبناء الخطة أو الاستيراد','ok');
    CID=clientId;PID=proj.id;await openProject();
  }catch(err){toast('تعذّر الإنشاء: '+err.message,'err');}
}

// قائمة إجراءات المشروع (PMO فقط): تسمية، أرشفة، حذف بمهلة

async function openProjectMenu(projectId, projectName){
  const r=await dialog({title:'إجراءات المشروع: '+(projectName||''),
    fields:[{key:'action',label:'الإجراء',type:'select',value:'rename',options:[
      {v:'rename',t:'إعادة تسمية المشروع'},
      {v:'restore_snap',t:'استرجاع نسخة أمان (ما قبل آخر استبدال)'},
      {v:'assign',t:'إسناد الفريق للمشروع'},
      {v:'trello',t:'لوحة Trello (تنفيذ الفريق)'},
      {v:'newbl',t:'حفظ أساس جديد (Baseline v'+(((PROJECT&&PROJECT.baselines)||[]).length+1)+')'},
      {v:'archive',t:'أرشفة المشروع'},
      {v:'delete',t:'طلب حذف المشروع (مهلة 30 يومًا)'}
    ]}],confirmText:'متابعة'});
  if(!r)return;
  if(r.action==='rename'){
    const e=await dialog({title:'إعادة التسمية',fields:[{key:'name',label:'الاسم الجديد',value:projectName||''}],confirmText:'حفظ'});
    if(!e||!e.name)return;
    try{await renameProject(projectId,e.name);
      if(PROJECT&&PROJECT._dbId===projectId){PROJECT.name=e.name;render();}
      toast('أُعيدت التسمية','ok');if(SCREEN==='portfolio')renderPortfolio();
    }catch(err){toast('تعذّر: '+err.message,'err');}
  }else if(r.action==='trello'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا','warn');return;}
    openTrello();
  }else if(r.action==='assign'){
    openAssignPanel(projectId,projectName);
  }else if(r.action==='newbl'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا لحفظ أساس من جدولته الحالية','warn');return;}
    if(!await confirmDialog('حفظ أساس جديد','سيُحفظ الوضع المجدول الحالي كأساس مرجعي جديد (v'+(((PROJECT.baselines)||[]).length+1)+') للمقارنة في الجانت. يُستخدم عادة بعد اعتماد طلب تعديل خطة.',false))return;
    try{const b=await saveNewBaseline(projectId);toast('حُفظ '+b.label,'ok');render();}
    catch(e){toast('تعذّر: '+e.message,'err');}
  }else if(r.action==='restore_snap'){
    // حوكمة: لا استرجاع فوق خطة مثبّتة
    const {data:pst}=await sb.from('pmo_projects').select('status').eq('id',projectId).single();
    if(pst&&pst.status==='baselined'){toast('الخطة مثبّتة — الاسترجاع يتطلب طلب تعديل خطة معتمدًا','warn');return;}
    const snap=await fetchLatestSnapshot(projectId);
    if(!snap){toast('لا توجد لقطات أمان محفوظة لهذا المشروع بعد','warn');return;}
    const when=(snap.created_at||'').slice(0,16).replace('T',' ');
    if(!await confirmDialog('استرجاع نسخة أمان',
      'سيُستبدل الوضع الحالي للخطة كاملًا بنسخة:\n'+when+' — '+(snap.reason||'لقطة')+'\n\nسيُحفظ الوضع الحالي كلقطة أيضًا قبل الاسترجاع.',true))return;
    try{
      if(PROJECT&&PROJECT._dbId===projectId&&PROJECT.tasks.length)
        await savePlanSnapshot(projectId,'الوضع قبل استرجاع لقطة سابقة');
      await restorePlanSnapshot(projectId,snap);
      toast('استُرجعت الخطة من نسخة الأمان','ok');
      if(PROJECT&&PROJECT._dbId===projectId){await loadProject(CID,PID);render();}
    }catch(e){toast('تعذّر الاسترجاع: '+e.message,'err');}
  }else if(r.action==='archive'){
    if(!await confirmDialog('أرشفة المشروع','أرشفة «'+(projectName||'')+'»؟ يختفي من المحفظة والخط الزمني، ويُسترجع من المؤرشفة.',false))return;
    const {data}=await rpcArchiveProject(projectId);
    if(data&&data.ok){toast('أُرشف المشروع','ok');SCREEN='portfolio';renderPortfolio();}
    else toast((data&&data.error)||'تعذّر','err');
  }else if(r.action==='delete'){
    if(!await confirmDialog('طلب حذف المشروع','سيبدأ عدّاد 30 يومًا لحذف «'+(projectName||'')+'» وكل بنوده. قابل للاسترجاع طوال المهلة، والحذف النهائي لمالك النظام.',true))return;
    const {data}=await rpcRequestProjectDeletion(projectId);
    if(data&&data.ok){toast('بدأت مهلة حذف المشروع (30 يومًا)','warn');SCREEN='portfolio';renderPortfolio();}
    else toast((data&&data.error)||'تعذّر','err');
  }
}

// مدير المراحل: لوحة تعديل مباشر (اسم + لون في مكانهما)

function openTracksManager(){
  if(!PROJECT)return;
  $('#trkOverlay').style.display='flex';
  renderTrkPanel();
}

function renderTrkPanel(){
  const list=PROJECT.tracks||[];
  $('#trkBody').innerHTML=`
    <p class="trk-hint">عدّل الاسم أو اللون مباشرة ثم اضغط «حفظ». التغييرات تنعكس فورًا على الجدول والجانت وداشبورد العميل.</p>
    ${list.map(t=>`<div class="trk-row" data-tid="${t.id}">
      <input type="color" class="trk-color" value="${t.color}" aria-label="لون المرحلة ${esc(t.name)}">
      <span class="trk-key" title="رمز المرحلة">${esc(t.key)}</span>
      <input class="trk-name" value="${esc(t.name)}" aria-label="اسم المرحلة">
    </div>`).join('')}
    <div class="trk-row trk-new">
      <input type="color" class="trk-color" id="trkNewColor" value="#C8A06B" aria-label="لون المرحلة الجديدة">
      <input class="trk-key-in" id="trkNewKey" placeholder="رمز" maxlength="2" aria-label="رمز المرحلة الجديدة">
      <input class="trk-name" id="trkNewName" placeholder="+ اسم مرحلة جديدة (اختياري)" aria-label="اسم المرحلة الجديدة">
    </div>
    <div class="imp-actions">
      <button class="hbtn" id="trkSave" style="background:var(--gold);border-color:var(--gold)">حفظ التعديلات</button>
      <button class="hbtn ghost" id="trkClose">إغلاق</button>
    </div>`;
  $('#trkClose').onclick=()=>{$('#trkOverlay').style.display='none';};
  $('#trkSave').onclick=saveTracks;
}

async function saveTracks(){
  const list=PROJECT.tracks||[];let changed=0;
  const btn=$('#trkSave');if(btn)btn.disabled=true;
  try{
    for(const row of document.querySelectorAll('#trkBody .trk-row[data-tid]')){
      const t=list.find(x=>x.id===row.dataset.tid);if(!t)continue;
      const name=row.querySelector('.trk-name').value.trim();
      const color=row.querySelector('.trk-color').value;
      if(name&&(name!==t.name||color!==t.color)){await updateTrack(t.id,{name,color});changed++;}
    }
    const nk=($('#trkNewKey').value||'').trim().toUpperCase();
    const nn=($('#trkNewName').value||'').trim();
    if(nk&&nn){await addTrack(PROJECT._dbId,nk,nn,$('#trkNewColor').value,list.length);changed++;}
    else if(nn&&!nk){toast('أدخل رمزًا للمرحلة الجديدة (حرف أو رقم)','warn');if(btn)btn.disabled=false;return;}
    PROJECT.tracks=await fetchTracks(PROJECT._dbId);
    toast(changed?('حُفظت المراحل ('+changed+' تغيير)'):'لا تغييرات','ok');
    $('#trkOverlay').style.display='none';render();
  }catch(e){toast('تعذّر الحفظ (الرمز مكرر؟): '+e.message,'err');if(btn)btn.disabled=false;}
}

// إنشاء عميل جديد مباشرة (سدّ فجوة الرحلة الأولى)

async function addNewClient(){
  const r=await dialog({title:'عميل جديد',
    message:'يُنشأ العميل نشطًا. يمكنك بعدها إضافة مشروعه الأول من قائمة ⋮ على بطاقته.',
    fields:[
      {key:'name',label:'اسم العميل / الشركة',placeholder:'مثل: شركة الأفق'},
      {key:'color',label:'لون العميل (للتمييز البصري)',type:'color',value:'#C8A06B'}
    ],confirmText:'إنشاء العميل'});
  if(!r||!r.name)return;
  try{
    const c=await insertClient(r.name,r.color);
    await loadClients();
    toast('أُنشئ العميل «'+r.name+'» — أضف مشروعه الأول من ⋮','ok');
    renderPortfolio();
  }catch(err){toast('تعذّر الإنشاء: '+err.message,'err');}
}


async function openClientMenu(clientId){
  const c=CLIENTS.find(x=>x.id===clientId); if(!c)return;
  const r=await dialog({title:'إجراءات: '+c.name,
    fields:[{key:'action',label:'الإجراء',type:'select',value:'edit',options:[
      {v:'edit',t:'تعديل بيانات العميل (الاسم واللون)'},
      {v:'newproject',t:'+ مشروع جديد لهذا العميل'},
      {v:'access',t:'إدارة وصول العميل (البريد)'},
      {v:'archive',t:'أرشفة العميل'},
      {v:'delete',t:'طلب حذف (مهلة 30 يومًا)'}
    ]}],confirmText:'متابعة'});
  if(!r)return;
  if(r.action==='edit'){
    const e=await dialog({title:'تعديل بيانات: '+c.name,
      fields:[
        {key:'name',label:'اسم العميل',value:c.name},
        {key:'color',label:'لون العميل',type:'color',value:c.color||'#C8A06B'}
      ],confirmText:'حفظ التعديلات'});
    if(!e||!e.name)return;
    try{
      await updateClientInfo(clientId,{name:e.name,color:e.color});
      c.name=e.name;c.color=e.color;
      toast('حُدّثت بيانات العميل','ok');renderPortfolio();
    }catch(err){toast('تعذّر التحديث: '+err.message,'err');}
  }else if(r.action==='newproject'){
    const p=await dialog({title:'مشروع جديد — '+c.name,
      message:'يُنشأ المشروع كمسوّدة. تاريخ البدء هو أساس حساب كل التواريخ.',
      fields:[
        {key:'name',label:'اسم المشروع',placeholder:'مثل: حملة الصيف 2026'},
        {key:'date',label:'تاريخ البدء',type:'date',value:todayISO()}
      ],confirmText:'إنشاء المشروع'});
    if(!p||!p.name)return;
    try{
      const proj=await insertProjectForClient(clientId,p.name,p.date||todayISO());
      toast('أُنشئ المشروع — جاهز لبناء الخطة أو الاستيراد','ok');
      CID=clientId;PID=proj.id;await openProject();
    }catch(err){toast('تعذّر الإنشاء: '+err.message,'err');}
  }else if(r.action==='access'){
    CID=clientId;PID=null;await openProject();
    if(typeof openAccess==='function')openAccess();
  }else if(r.action==='trello'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا','warn');return;}
    openTrello();
  }else if(r.action==='assign'){
    openAssignPanel(projectId,projectName);
  }else if(r.action==='newbl'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا لحفظ أساس من جدولته الحالية','warn');return;}
    if(!await confirmDialog('حفظ أساس جديد','سيُحفظ الوضع المجدول الحالي كأساس مرجعي جديد (v'+(((PROJECT.baselines)||[]).length+1)+') للمقارنة في الجانت. يُستخدم عادة بعد اعتماد طلب تعديل خطة.',false))return;
    try{const b=await saveNewBaseline(projectId);toast('حُفظ '+b.label,'ok');render();}
    catch(e){toast('تعذّر: '+e.message,'err');}
  }else if(r.action==='restore_snap'){
    // حوكمة: لا استرجاع فوق خطة مثبّتة
    const {data:pst}=await sb.from('pmo_projects').select('status').eq('id',projectId).single();
    if(pst&&pst.status==='baselined'){toast('الخطة مثبّتة — الاسترجاع يتطلب طلب تعديل خطة معتمدًا','warn');return;}
    const snap=await fetchLatestSnapshot(projectId);
    if(!snap){toast('لا توجد لقطات أمان محفوظة لهذا المشروع بعد','warn');return;}
    const when=(snap.created_at||'').slice(0,16).replace('T',' ');
    if(!await confirmDialog('استرجاع نسخة أمان',
      'سيُستبدل الوضع الحالي للخطة كاملًا بنسخة:\n'+when+' — '+(snap.reason||'لقطة')+'\n\nسيُحفظ الوضع الحالي كلقطة أيضًا قبل الاسترجاع.',true))return;
    try{
      if(PROJECT&&PROJECT._dbId===projectId&&PROJECT.tasks.length)
        await savePlanSnapshot(projectId,'الوضع قبل استرجاع لقطة سابقة');
      await restorePlanSnapshot(projectId,snap);
      toast('استُرجعت الخطة من نسخة الأمان','ok');
      if(PROJECT&&PROJECT._dbId===projectId){await loadProject(CID,PID);render();}
    }catch(e){toast('تعذّر الاسترجاع: '+e.message,'err');}
  }else if(r.action==='archive'){
    if(!await confirmDialog('تأكيد الأرشفة','أرشفة «'+c.name+'»؟ سيُخفى من المحفظة النشطة ويمكن استرجاعه لاحقًا.',false))return;
    const {data}=await rpcArchiveClient(clientId);
    if(data&&data.ok){toast('تمت الأرشفة','ok');CLIENTS=CLIENTS.filter(x=>x.id!==clientId);renderPortfolio();}
    else toast((data&&data.error)||'تعذّرت الأرشفة','err');
  }else if(r.action==='delete'){
    if(!await confirmDialog('تأكيد طلب الحذف','طلب حذف «'+c.name+'»؟\n\nسيبدأ عدّاد 30 يومًا. يبقى قابلًا للاسترجاع طوال المهلة. الحذف النهائي يتطلب مالك النظام بعد انقضائها.',true))return;
    const {data}=await rpcRequestDeletion(clientId);
    if(data&&data.ok){toast('بدأت مهلة الحذف (30 يومًا)','warn');CLIENTS=CLIENTS.filter(x=>x.id!==clientId);renderPortfolio();}
    else toast((data&&data.error)||'تعذّر الطلب','err');
  }
}


async function renderArchived(){
  SCREEN='archived';$('#hProject').textContent='العملاء المؤرشفون';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backP">↩ المحفظة</button><span style="margin-inline-start:auto">العملاء المؤرشفون والمجدولون للحذف. الاسترجاع متاح طوال مهلة الـ30 يومًا.</span></div><div id="archList"><div class="skeleton" style="height:60px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
  $('#backP').onclick=renderPortfolio;
  const isOwner=await checkIsOwner();
  const arch=await fetchClientsByState('archived');
  const pend=await fetchClientsByState('pending_deletion');
  const aprojs=await fetchArchivedProjects();
  const list=$('#archList');
  if(!arch.length&&!pend.length&&!aprojs.length){list.innerHTML='<div class="empty-cta"><div class="ico">'+I.archive+'</div><h3>لا عناصر مؤرشفة</h3><p>العملاء والمشاريع المؤرشفة أو المجدولة للحذف تظهر هنا.</p></div>';return;}
  let html='';
  if(pend.length){
    html+='<h4 class="arch-sec">بانتظار الحذف</h4>';
    pend.forEach(c=>{
      const days=Math.max(0,Math.ceil((new Date(c.deletion_scheduled_at)-new Date())/(1000*60*60*24)));
      const purgeBtn=isOwner?`<button class="hbtn" data-purge="${c.id}" style="background:var(--crit);border-color:var(--crit)">حذف نهائي</button>`:`<span class="arch-note">الحذف النهائي بصلاحية المالك</span>`;
      html+=`<div class="arch-row pending"><div><b>${c.name}</b><span class="arch-badge crit">يُحذف خلال ${days} يومًا</span></div><div class="arch-acts"><button class="hbtn ghost" data-restore="${c.id}">استرجاع</button>${purgeBtn}</div></div>`;
    });
  }
  if(arch.length){
    html+='<h4 class="arch-sec">مؤرشفة</h4>';
    arch.forEach(c=>{
      html+=`<div class="arch-row"><div><b>${c.name}</b><span class="arch-badge">مؤرشف</span></div><div class="arch-acts"><button class="hbtn ghost" data-restore="${c.id}">استرجاع</button><button class="hbtn" data-del="${c.id}" style="background:var(--warn);border-color:var(--warn)">طلب حذف</button></div></div>`;
    });
  }
  if(aprojs.length){
    const cname=id=>{const c=CLIENTS.find(x=>x.id===id);return c?c.name:'';};
    const ppend=aprojs.filter(p=>p.lifecycle_state==='pending_deletion');
    const parch=aprojs.filter(p=>p.lifecycle_state==='archived');
    if(ppend.length){
      html+='<h4 class="arch-sec">مشاريع بانتظار الحذف</h4>';
      ppend.forEach(p=>{
        const days=Math.max(0,Math.ceil((new Date(p.deletion_scheduled_at)-new Date())/(1000*60*60*24)));
        const purgeBtn=isOwner?`<button class="hbtn" data-ppurge="${p.id}" style="background:var(--crit);border-color:var(--crit)">حذف نهائي</button>`:`<span class="arch-note">الحذف النهائي بصلاحية المالك</span>`;
        html+=`<div class="arch-row pending"><div><b>${esc(p.name)}</b><span class="arch-badge">${esc(cname(p.client_id))}</span><span class="arch-badge crit">يُحذف خلال ${days} يومًا</span></div><div class="arch-acts"><button class="hbtn ghost" data-prestore="${p.id}">استرجاع</button>${purgeBtn}</div></div>`;
      });
    }
    if(parch.length){
      html+='<h4 class="arch-sec">مشاريع مؤرشفة</h4>';
      parch.forEach(p=>{
        html+=`<div class="arch-row"><div><b>${esc(p.name)}</b><span class="arch-badge">${esc(cname(p.client_id))}</span><span class="arch-badge">مؤرشف</span></div><div class="arch-acts"><button class="hbtn ghost" data-prestore="${p.id}">استرجاع</button><button class="hbtn" data-pdel="${p.id}" style="background:var(--warn);border-color:var(--warn)">طلب حذف</button></div></div>`;
      });
    }
  }
  list.innerHTML=html;
  list.querySelectorAll('[data-prestore]').forEach(b=>b.onclick=async()=>{
    const {data}=await rpcRestoreProject(b.dataset.prestore);
    if(data&&data.ok){toast('استُرجع المشروع','ok');renderArchived();}else toast((data&&data.error)||'تعذّر','err');});
  list.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('طلب حذف مشروع','بدء مهلة 30 يومًا لحذف هذا المشروع وكل بنوده؟',true))return;
    const {data}=await rpcRequestProjectDeletion(b.dataset.pdel);
    if(data&&data.ok){toast('بدأت المهلة','warn');renderArchived();}else toast((data&&data.error)||'تعذّر','err');});
  list.querySelectorAll('[data-ppurge]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف نهائي','حذف نهائي لا رجعة فيه للمشروع وكل بنوده. متأكد؟',true))return;
    const {data}=await rpcPurgeProject(b.dataset.ppurge);
    if(data&&data.ok){toast('حُذف نهائيًا','ok');renderArchived();}else toast((data&&data.error)||'تعذّر — تحقق من المهلة والصلاحية','err');});
  list.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{
    const {data}=await rpcRestoreClient(b.dataset.restore);
    if(data&&data.ok){toast('تم الاسترجاع','ok');const c=await fetchClientsByState('active');CLIENTS=c;renderArchived();}
    else toast((data&&data.error)||'تعذّر','err');});
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('طلب حذف','بدء مهلة 30 يومًا لحذف هذا العميل؟',true))return;
    const {data}=await rpcRequestDeletion(b.dataset.del);
    if(data&&data.ok){toast('بدأت مهلة الحذف','warn');renderArchived();}else toast((data&&data.error)||'تعذّر','err');});
  list.querySelectorAll('[data-purge]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف نهائي','تحذير: حذف نهائي لا رجعة فيه لكل بيانات العميل ومشاريعه. متأكد؟',true))return;
    const {data}=await rpcPurgeClient(b.dataset.purge);
    if(data&&data.ok){toast('تم الحذف النهائي','ok');renderArchived();}else toast((data&&data.error)||'تعذّر — تحقق من المهلة والصلاحية','err');});
}

// ===== سجل التدقيق على مستوى المكتب =====
const AUDIT_LABELS={
  archive_client:'أرشفة عميل',restore_client:'استرجاع عميل',request_deletion:'طلب حذف',purge_client:'حذف نهائي',
  comment_add:'إضافة تعليق',comment_delete:'حذف تعليق',comment_resolve:'حلّ تعليق',comment_reopen:'إعادة فتح تعليق',
  requirement_add:'إضافة متطلب',requirement_delete:'حذف متطلب',
  project_create:'إنشاء مشروع',project_delete:'حذف مشروع',
  task_update:'تعديل مهمة',cr_create:'طلب تغيير',cr_decision:'قرار تغيير'
};

// ===== إسناد الفريق (داخلي — لا يظهر للعميل بأي شكل) =====
async function openAssignPanel(projectId,projectName){
  $('#assignOverlay').style.display='flex';
  $('#assignTitle').textContent='إسناد الفريق: '+(projectName||'');
  const body=$('#assignBody');body.innerHTML='<div class="skeleton" style="height:100px"></div>';
  try{
    const [members,assigned]=await Promise.all([fetchTeamMembers(),fetchProjectStaff(projectId)]);
    const aset=new Set(assigned);
    const roleAr={admin:'إدارة المشاريع',manager:'فريق'};
    body.innerHTML=`
      <p class="trk-hint">أعضاء الطاقم المسندون يرون هذا المشروع في محفظتهم وخط تسليماته. المالك وإدارة المشاريع يرون الكل دائمًا. <b>العميل لا يرى الإسناد إطلاقًا.</b></p>
      ${members.map(u=>`<label class="assign-row"><input type="checkbox" data-assign="${u.id}" ${aset.has(u.id)?'checked':''}>
        <b>${esc(u.full_name||u.email)}</b><span class="assign-role">${roleAr[u.role]||u.role}</span></label>`).join('')||'<p class="pempty">لا أعضاء طاقم نشطين بعد.</p>'}
      <div class="imp-actions">
        <button class="hbtn" id="assignSave" style="background:var(--gold);border-color:var(--gold)">حفظ الإسناد</button>
        <button class="hbtn ghost" id="assignClose">إغلاق</button>
      </div>`;
    $('#assignClose').onclick=()=>{$('#assignOverlay').style.display='none';};
    $('#assignSave').onclick=async()=>{
      const ids=[...document.querySelectorAll('#assignBody [data-assign]:checked')].map(c=>c.dataset.assign);
      try{await saveProjectStaff(projectId,ids);toast('حُفظ الإسناد ('+ids.length+')','ok');$('#assignOverlay').style.display='none';}
      catch(e){toast('تعذّر: '+e.message,'err');}
    };
  }catch(e){body.innerHTML='<p class="pempty">تعذّر التحميل</p>';}
}
// ===== مدير العطلات الرسمية =====
async function openHolidaysManager(){
  $('#holOverlay').style.display='flex';
  const body=$('#holBody');body.innerHTML='<div class="skeleton" style="height:100px"></div>';
  const paint=async()=>{
    const rows=await fetchHolidays();
    body.innerHTML=`
      <p class="trk-hint">العطلات الرسمية (فوق الجمعة/السبت) — تُستثنى من كل الجدولة والمدد والتأخيرات. حدّثها عند إعلان التواريخ الرسمية.</p>
      ${rows.map(h=>`<div class="hol-row"><b>${esc(h.name)}</b><span>${h.hdate}</span><button class="ib" data-holdel="${h.id}" aria-label="حذف" style="color:var(--crit)">🗑</button></div>`).join('')||'<p class="pempty">لا عطلات مسجلة.</p>'}
      <div class="hol-row new">
        <input id="holName" placeholder="اسم العطلة" class="trk-name">
        <input id="holDate" type="date" class="trk-name" style="max-width:160px">
        <button class="hbtn" id="holAdd" style="background:var(--ok);border-color:var(--ok)">+ إضافة</button>
      </div>`;
    body.querySelectorAll('[data-holdel]').forEach(b=>b.onclick=async()=>{
      try{await delHolidayRow(b.dataset.holdel);toast('حُذفت','ok');paint();}catch(e){toast('تعذّر','err');}});
    $('#holAdd').onclick=async()=>{
      const n=$('#holName').value.trim(),d=$('#holDate').value;
      if(!n||!d){toast('الاسم والتاريخ مطلوبان','warn');return;}
      try{await addHolidayRow(d,n);toast('أُضيفت','ok');paint();}catch(e){toast('تعذّر (مكررة؟)','err');}
    };
  };
  paint();
}
