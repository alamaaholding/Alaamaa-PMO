// ===== app/lifecycle.js — جزء من طبقة التطبيق (مقسّم من app.js) =====

// منفّذ موحّد لإجراءات دورة الحياة (أرشفة/حذف/استرجاع/حذف نهائي).
// كان النمط نفسه مكررًا 12 مرة: تأكيد → استدعاء RPC → قراءة data.ok → toast → تحديث.
// التوحيد يضمن أيضًا التقاط الأخطاء الشبكية التي كانت تمرّ صامتة في النسخ السابقة.
async function runLifecycleAction(o){
  if(o.title&&!await confirmDialog(o.title,o.message,!!o.danger,o.confirmText))return false;
  let data;
  try{ ({data}=await o.rpc()); }
  catch(e){ toast('تعذّر الاتصال: '+(e&&e.message?e.message:'خطأ غير معروف'),'err'); return false; }
  if(data&&data.ok){
    toast(o.successMsg,o.successTone||'ok');
    if(o.onSuccess)await o.onSuccess();
    return true;
  }
  toast((data&&data.error)||o.failMsg||'تعذّر تنفيذ الإجراء','err');
  return false;
}

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

// قائمة إجراءات المشروع (PMO فقط) — مُصنَّفة بفئات واضحة: أساسية، حوكمة وعقود، فريق وتنفيذ،
// ومنطقة خطر مميَّزة بصريًا لا تختلط بصريًا بالإجراءات الروتينية.
// تنسيق احترافي: اليوم + التاريخ + الوقت — لا رقم مجرَّد
function fmtSyncTime(iso){
  if(!iso)return null;
  return new Date(iso).toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+
    ' — الساعة '+new Date(iso).toLocaleTimeString('ar-SA',{hour:'numeric',minute:'2-digit'});
}
function projectMenuGroups(projectId,freshTrelloSync,freshLifecycleState){
  const blN=((PROJECT&&PROJECT.baselines)||[]).length+1;
  const syncVal=freshTrelloSync!==undefined?freshTrelloSync:
    (PROJECT&&PROJECT._dbId===projectId?PROJECT.trelloLastSync:null);
  const syncTxt=syncVal?'آخر سحب فعلي: '+fmtSyncTime(syncVal):'⚠ لم يُسحَب أي تحديث من Trello بعد إطلاقًا';
  const lifecycleState=freshLifecycleState!==undefined?freshLifecycleState:
    (PROJECT&&PROJECT._dbId===projectId?(PROJECT.lifecycleState||'active'):'active');
  const isPaused=lifecycleState==='paused';
  return [
    {title:'إدارة أساسية',items:[
      {v:'rename',t:'إعادة تسمية المشروع',icon:'✏️'},
      {v:'editSlug',t:'تعديل الرابط الدائم',icon:'🔗'},
      isPaused
        ?{v:'resume',t:'استئناف المشروع',icon:'▶️'}
        :{v:'pause',t:'إيقاف مؤقت',icon:'⏸'}
    ]},
    {title:'الحوكمة والعقود',items:[
      {v:'newbl',t:'حفظ أساس جديد (Baseline v'+blN+')',icon:'📌'},
      {v:'exportContract',t:'تصدير للعقد (PDF)',icon:'📄'},
      {v:'contracts',t:'العقود والتوقيع الإلكتروني',icon:'✍️'},
      {v:'restore_snap',t:'استرجاع نسخة أمان',icon:'⏮'}
    ]},
    {title:'الفريق والتنفيذ',items:[
      {v:'assign',t:'إسناد الفريق للمشروع',icon:'👥'},
      {v:'trello',t:'لوحة Trello (تنفيذ الفريق)',icon:'🗂',sub:syncTxt}
    ]},
    {title:'منطقة خطر',danger:true,items:[
      {v:'archive',t:'أرشفة المشروع',icon:'🗄'},
      {v:'delete',t:'طلب حذف المشروع (مهلة 30 يومًا)',icon:'🗑'}
    ]}
  ];
}
async function openProjectMenu(projectId, projectName){
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='إجراءات المشروع: '+(projectName||'');
  document.getElementById('tkTabs').innerHTML='';
  document.getElementById('tkBody').innerHTML=skeleton('cards',1);
  // جلب مباشر وحصري من القاعدة — الحقيقة الوحيدة المعتمَدة لهذه القيمة تحديدًا، بلا أي
  // اعتماد على حالة محفوظة في ذاكرة المتصفح مهما كان مصدرها أو مدى حداثتها المفترضة.
  let freshTrelloSync=undefined,freshLifecycleState=undefined;
  try{
    const {data}=await sb.from('pmo_projects').select('trello_last_synced_at,lifecycle_state').eq('id',projectId).maybeSingle();
    freshTrelloSync=data?data.trello_last_synced_at:null;
    freshLifecycleState=data?(data.lifecycle_state||'active'):'active';
  }catch(e){freshTrelloSync=null;freshLifecycleState='active';}
  const groups=projectMenuGroups(projectId,freshTrelloSync,freshLifecycleState);
  document.getElementById('tkBody').innerHTML=groups.map(g=>`
    <div class="pmenu-group${g.danger?' pmenu-danger':''}">
      <h4>${esc(g.title)}</h4>
      <div class="pmenu-grid">
        ${g.items.map(it=>`<button class="pmenu-item${it.sub?' pmenu-item-sub':''}" data-pmaction="${it.v}">
          <span class="pmenu-icon">${it.icon}</span>
          <span class="pmenu-txt"><span class="pmenu-title">${esc(it.t)}</span>${it.sub?`<span class="pmenu-subtitle">${esc(it.sub)}</span>`:''}</span>
        </button>`).join('')}
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-pmaction]').forEach(b=>b.onclick=()=>runProjectMenuAction(b.dataset.pmaction,projectId,projectName));
}
async function runProjectMenuAction(action,projectId,projectName){
  if(action==='exportContract'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا','warn');return;}
    return openContractExport();
  }
  if(action==='contracts'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا','warn');return;}
    return openContractPanel();
  }
  if(action==='rename'){
    const e=await dialog({title:'إعادة التسمية',fields:[{key:'name',label:'الاسم الجديد',value:projectName||''}],confirmText:'حفظ'});
    if(!e||!e.name)return;
    try{await renameProject(projectId,e.name);
      if(PROJECT&&PROJECT._dbId===projectId){PROJECT.name=e.name;render();}
      toast('أُعيدت التسمية','ok');if(SCREEN==='portfolio')renderPortfolio();
    }catch(err){toast('تعذّر: '+err.message,'err');}
  }else if(action==='editSlug'){
    const cur=(PROJECT&&PROJECT._dbId===projectId)?(PROJECT.slug||''):await fetchProjectSlug(projectId);
    const e=await dialog({title:'الرابط الدائم للمشروع',
      fields:[{key:'slug',label:'المعرّف (حروف لاتينية وأرقام وشرطات)',value:cur}],confirmText:'حفظ'});
    if(!e||!e.slug)return;
    try{
      const clean=await updateProjectSlug(projectId,e.slug);
      if(PROJECT&&PROJECT._dbId===projectId){PROJECT.slug=clean;writeHash();}
      toast('حُفظ الرابط: '+clean,'ok');
    }catch(err){toast(err.message,'err');}
  }else if(action==='trello'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا','warn');return;}
    openTrello();
  }else if(action==='assign'){
    openAssignPanel(projectId,projectName);
  }else if(action==='newbl'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا لحفظ أساس من جدولته الحالية','warn');return;}
    if(!await confirmDialog('حفظ أساس جديد','سيُحفظ الوضع المجدول الحالي كأساس مرجعي جديد (v'+(((PROJECT.baselines)||[]).length+1)+') للمقارنة في الجانت. يُستخدم عادة بعد اعتماد طلب تعديل خطة.',false))return;
    try{const b=await saveNewBaseline(projectId);toast('حُفظ '+b.label,'ok');render();}
    catch(e){toast('تعذّر: '+e.message,'err');}
  }else if(action==='restore_snap'){
    // حوكمة: لا استرجاع فوق خطة مثبّتة
    const {data:pst}=await sb.from('pmo_projects').select('status').eq('id',projectId).single();
    if(pst&&pst.status==='baselined'){toast('الخطة مثبّتة — الاسترجاع يتطلب طلب تعديل خطة معتمدًا','warn');return;}
    const snap=await fetchLatestSnapshot(projectId);
    if(!snap){toast('لا توجد لقطات أمان محفوظة لهذا المشروع بعد','warn');return;}
    const when=(snap.created_at||'').slice(0,16).replace('T',' ');
    if(!await confirmDialog('استرجاع نسخة أمان',
      'سيُستبدل الوضع الحالي للخطة كاملًا بنسخة:\n'+when+' — '+(snap.reason||'لقطة')+'\n\nسيُحفظ الوضع الحالي كلقطة أيضًا قبل الاسترجاع.',true,'استرجاع'))return;
    try{
      if(PROJECT&&PROJECT._dbId===projectId&&PROJECT.tasks.length)
        await savePlanSnapshot(projectId,'الوضع قبل استرجاع لقطة سابقة');
      await restorePlanSnapshot(projectId,snap);
      toast('استُرجعت الخطة من نسخة الأمان','ok');
      if(PROJECT&&PROJECT._dbId===projectId){await loadProject(CID,PID);render();}
    }catch(e){toast('تعذّر الاسترجاع: '+e.message,'err');}
  }else if(action==='pause'){
    const r=await dialog({title:'إيقاف مؤقت',
      message:'سيتوقف هذا المشروع تحديدًا مؤقتًا — بياناته وبنوده تبقى كما هي كاملة، ولا يتأثر أي مشروع آخر لنفس الشريك. يمكن استئنافه في أي وقت.',
      fields:[{key:'reason',label:'السبب (اختياري)',value:''}],confirmText:'إيقاف مؤقت'});
    if(!r)return;
    try{
      const {data}=await rpcPauseProject(projectId,r.reason);
      if(data&&data.ok){
        toast('أُوقف المشروع مؤقتًا','ok');
        if(PROJECT&&PROJECT._dbId===projectId){PROJECT.lifecycleState='paused';render();}
        if(SCREEN==='portfolio')renderPortfolio();
      }else toast((data&&data.error)||'تعذّر الإيقاف','err');
    }catch(e){toast('تعذّر الإيقاف: '+e.message,'err');}
  }else if(action==='resume'){
    if(!await confirmDialog('استئناف المشروع','استئناف «'+(projectName||'')+'»؟ يعود نشطًا فورًا كما كان.',false))return;
    try{
      const {data}=await rpcResumeProject(projectId);
      if(data&&data.ok){
        toast('استُؤنف المشروع','ok');
        if(PROJECT&&PROJECT._dbId===projectId){PROJECT.lifecycleState='active';render();}
        if(SCREEN==='portfolio')renderPortfolio();
      }else toast((data&&data.error)||'تعذّر الاستئناف','err');
    }catch(e){toast('تعذّر الاستئناف: '+e.message,'err');}
  }else if(action==='archive'){
    await runLifecycleAction({
      title:'أرشفة المشروع',
      message:'أرشفة «'+(projectName||'')+'»؟ يختفي من المحفظة والخط الزمني، ويُسترجع من المؤرشفة.',
      rpc:()=>rpcArchiveProject(projectId),
      successMsg:'أُرشف المشروع',
      onSuccess:()=>{SCREEN='portfolio';renderPortfolio();}
    });
  }else if(action==='delete'){
    await runLifecycleAction({
      title:'طلب حذف المشروع',
      message:'سيبدأ عدّاد 30 يومًا لحذف «'+(projectName||'')+'» وكل بنوده. قابل للاسترجاع طوال المهلة، والحذف النهائي لمالك النظام.',
      danger:true,confirmText:'حذف',
      rpc:()=>rpcRequestProjectDeletion(projectId),
      successMsg:'بدأت مهلة حذف المشروع (30 يومًا)',successTone:'warn',
      onSuccess:()=>{SCREEN='portfolio';renderPortfolio();}
    });
  }
}

// مدير المراحل: لوحة تعديل مباشر (اسم + لون في مكانهما)

function openTracksManager(){
  if(!PROJECT)return;
  $('#trkOverlay').style.display='flex';
  renderTrkPanel();
}

function renderTrkPanel(){
  const list=(PROJECT.tracks||[]).slice().sort((a,b)=>a.sort-b.sort);
  // نبني على نفس مصدر الحقيقة المستخدم في الفلترة والجانت — projTrackList()، لا PROJECT.tracks وحده،
  // فما تراه هنا مطابق حرفيًا لما تراه في الجدول والجانت وشريط الفلاتر.
  const live=projTrackList();
  const doneCountOf=k=>{
    const items=(PROJECT.tasks||[]).filter(t=>t.track===k&&t.type!=='package');
    const n=items.length,done=items.filter(t=>(TRACK&&TRACK[t.id]&&TRACK[t.id].effStatus)==='done').length;
    return {n,done,pct:n?Math.round(done/n*100):0};
  };
  $('#trkBody').innerHTML=`
    <p class="trk-hint">تُنشأ المراحل تلقائيًا عند استيراد خطة من Excel وفق ترقيم WBS الفعلي — هذه القائمة
      مطابقة دائمًا لما تراه في الجدول والجانت وشريط الفلاتر، ولا تحتاج ضبطًا منفصلًا لكل مشروع.
      عدّل الاسم أو اللون هنا فقط للتخصيص، ثم اضغط «حفظ».</p>
    <div id="trkList" class="trk-cards">
    ${live.map((x,i)=>{
      const raw=list.find(t=>t.key===x.key);
      const st=doneCountOf(x.key);
      return `<div class="trk-card" data-tid="${raw?raw.id:''}" data-key="${esc(x.key)}" style="--pc:${x.color}">
      <div class="trk-order">
        <button class="trk-ord" data-up="${raw?raw.id:''}" ${(!raw||i===0)?'disabled':''} aria-label="تحريك لأعلى">▲</button>
        <button class="trk-ord" data-down="${raw?raw.id:''}" ${(!raw||i===live.length-1)?'disabled':''} aria-label="تحريك لأسفل">▼</button>
      </div>
      <input type="color" class="trk-color" value="${x.color}" aria-label="لون المرحلة ${esc(x.name)}">
      <div class="trk-main">
        <div class="trk-toprow">
          <span class="trk-key" title="مرجع WBS">${esc(x.key)}</span>
          <input class="trk-name" value="${esc(x.name)}" aria-label="اسم المرحلة" ${raw?'':'disabled title="مرحلة مشتقة تلقائيًا — أضفها للسجل بالحفظ أدناه"'}>
          ${raw?`<button class="trk-del" data-del="${raw.id}" data-n="${st.n}" aria-label="حذف مرحلة ${esc(x.name)}" title="حذف">✕</button>`:''}
        </div>
        <div class="trk-meta">
          <span class="trk-n">${st.n} بند</span>
          <div class="trk-bar" role="progressbar" aria-valuenow="${st.pct}" aria-valuemin="0" aria-valuemax="100" title="${st.pct}% مكتمل">
            <div class="trk-bar-fill" style="width:${st.pct}%"></div>
          </div>
          <span class="trk-pct">${st.pct}%</span>
        </div>
      </div>
    </div>`;}).join('')}
    </div>
    <div class="trk-card trk-new">
      <div class="trk-order"></div>
      <input type="color" class="trk-color" id="trkNewColor" value="#C8A06B" aria-label="لون المرحلة الجديدة">
      <div class="trk-main">
        <div class="trk-toprow">
          <input class="trk-key-in" id="trkNewKey" placeholder="رمز" maxlength="4" aria-label="رمز المرحلة الجديدة">
          <input class="trk-name" id="trkNewName" placeholder="+ اسم مرحلة جديدة (لتخصيص مرحلة لا تُدار تلقائيًا)" aria-label="اسم المرحلة الجديدة">
        </div>
      </div>
    </div>
    <div class="imp-actions">
      <button class="hbtn gold" id="trkSave">حفظ التعديلات</button>
      <button class="hbtn ghost" id="trkClose">إغلاق</button>
    </div>`;
  $('#trkClose').onclick=()=>{$('#trkOverlay').style.display='none';};
  $('#trkSave').onclick=saveTracks;
  $$('#trkBody [data-up]').forEach(b=>b.dataset.up&&(b.onclick=()=>moveTrack(b.dataset.up,-1)));
  $$('#trkBody [data-down]').forEach(b=>b.dataset.down&&(b.onclick=()=>moveTrack(b.dataset.down,1)));
  $$('#trkBody [data-del]').forEach(b=>b.onclick=()=>deleteTrackRow(b.dataset.del,parseInt(b.dataset.n,10)));
}

async function moveTrack(id,dir){
  const list=(PROJECT.tracks||[]).slice().sort((a,b)=>a.sort-b.sort);
  const i=list.findIndex(t=>t.id===id),j=i+dir;
  if(i<0||j<0||j>=list.length)return;
  const a=list[i],b=list[j];
  try{
    await reorderTracks([{id:a.id,sort:b.sort},{id:b.id,sort:a.sort}]);
    PROJECT.tracks=await fetchTracks(PROJECT._dbId);
    renderTrkPanel();
  }catch(e){toast('تعذّر الترتيب: '+e.message,'err');}
}
async function deleteTrackRow(id,n){
  const t=(PROJECT.tracks||[]).find(x=>x.id===id);if(!t)return;
  const msg=n>0
    ? `المرحلة «${t.name}» فيها ${n} بندًا. حذفها لا يحذف البنود، لكنها ستُعرض بلا مرحلة معروفة حتى تُنقل. هل تريد المتابعة؟`
    : `حذف المرحلة «${t.name}»؟`;
  if(!await confirmDialog('حذف مرحلة',msg,n>0,'حذف'))return;
  const snap={key:t.key,name:t.name,color:t.color,sort:t.sort};
  try{
    await undoable({
      label:'حُذفت المرحلة «'+t.name+'»',
      remove:()=>deleteTrack(id),
      refresh:async()=>{
        PROJECT.tracks=await fetchTracks(PROJECT._dbId);
        renderTrkPanel();
        if(SCREEN==='project')render();
      },
      restore:()=>addTrack(PROJECT._dbId,snap.key,snap.name,snap.color,snap.sort),
      doneMsg:'استُعيدت المرحلة'
    });
  }catch(e){toast('تعذّر الحذف: '+e.message,'err');}
}

async function saveTracks(){
  const list=PROJECT.tracks||[];let changed=0;
  const btn=$('#trkSave');if(btn)btn.disabled=true;
  try{
    for(const card of document.querySelectorAll('#trkBody .trk-card[data-key]')){
      const tid=card.dataset.tid,key=card.dataset.key;
      const colorInput=card.querySelector('.trk-color');
      const color=colorInput.value;
      if(tid){
        // مرحلة لها سجل تخصيص بالفعل — تحديث الاسم واللون إن تغيّرا
        const t=list.find(x=>x.id===tid);if(!t)continue;
        const name=card.querySelector('.trk-name').value.trim();
        if(name&&(name!==t.name||color!==t.color)){await updateTrack(t.id,{name,color});changed++;}
      }else if(key&&color.toLowerCase()!==(colorInput.defaultValue||'').toLowerCase()){
        // مرحلة مشتقة تلقائيًا من WBS بلا سجل تخصيص — إنشاء سجل عند أول تخصيص للون
        const name=card.querySelector('.trk-name').value.trim()||key;
        await addTrack(PROJECT._dbId,key,name,color,(PROJECT.tracks||[]).length+1);changed++;
      }
    }
    const nk=($('#trkNewKey').value||'').trim();
    const nn=($('#trkNewName').value||'').trim();
    if(nk&&nn){await addTrack(PROJECT._dbId,nk,nn,$('#trkNewColor').value,list.length);changed++;}
    else if(nn&&!nk){toast('أدخل رمزًا للمرحلة الجديدة (حرف أو رقم)','warn');if(btn)btn.disabled=false;return;}
    PROJECT.tracks=await fetchTracks(PROJECT._dbId);
    toast(changed?('حُفظت المراحل ('+changed+' تغيير)'):'لا تغييرات','ok');
    $('#trkOverlay').style.display='none';render();
  }catch(e){toast('تعذّر الحفظ (الرمز مكرر؟): '+e.message,'err');if(btn)btn.disabled=false;}
}

// إنشاء شريك جديد مباشرة (سدّ فجوة الرحلة الأولى)

async function addNewClient(){
  const r=await dialog({title:'شريك جديد',
    message:'يُنشأ الشريك نشطًا. يمكنك بعدها إضافة مشروعه الأول من قائمة ⋮ على بطاقته.',
    fields:[
      {key:'name',label:'اسم الشريك / الشركة',placeholder:'مثل: شركة الأفق'},
      {key:'color',label:'لون الشريك (للتمييز البصري)',type:'color',value:'#C8A06B'}
    ],confirmText:'إنشاء الشريك'});
  if(!r||!r.name)return;
  try{
    await insertClient(r.name,r.color);
    await loadClients();
    toast('أُنشئ الشريك «'+r.name+'» — أضف مشروعه الأول من ⋮','ok');
    renderPortfolio();
  }catch(err){toast('تعذّر الإنشاء: '+err.message,'err');}
}


async function openClientMenu(clientId){
  const c=CLIENTS.find(x=>x.id===clientId); if(!c)return;
  const r=await dialog({title:'إجراءات: '+c.name,
    fields:[{key:'action',label:'الإجراء',type:'select',value:'edit',options:[
      {v:'edit',t:'تعديل بيانات الشريك (الاسم واللون)'},
      {v:'newproject',t:'+ مشروع جديد لهذا الشريك'},
      {v:'access',t:'إدارة وصول الشريك (البريد)'},
      {v:'archive',t:'أرشفة الشريك'},
      {v:'delete',t:'طلب حذف (مهلة 30 يومًا)'}
    ]}],confirmText:'متابعة'});
  if(!r)return;
  if(r.action==='edit'){
    const e=await dialog({title:'تعديل بيانات: '+c.name,
      fields:[
        {key:'name',label:'اسم الشريك',value:c.name},
        {key:'color',label:'لون الشريك',type:'color',value:c.color||'#C8A06B'}
      ],confirmText:'حفظ التعديلات'});
    if(!e||!e.name)return;
    try{
      await updateClientInfo(clientId,{name:e.name,color:e.color});
      c.name=e.name;c.color=e.color;
      toast('حُدّثت بيانات الشريك','ok');renderPortfolio();
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
  }else if(r.action==='archive'){
    await runLifecycleAction({
      title:'تأكيد الأرشفة',
      message:'أرشفة «'+c.name+'»؟ سيُخفى من المحفظة النشطة ويمكن استرجاعه لاحقًا.',
      rpc:()=>rpcArchiveClient(clientId),
      successMsg:'تمت الأرشفة',failMsg:'تعذّرت الأرشفة',
      onSuccess:()=>{CLIENTS=CLIENTS.filter(x=>x.id!==clientId);renderPortfolio();}
    });
  }else if(r.action==='delete'){
    await runLifecycleAction({
      title:'تأكيد طلب الحذف',
      message:'طلب حذف «'+c.name+'»؟\n\nسيبدأ عدّاد 30 يومًا. يبقى قابلًا للاسترجاع طوال المهلة. الحذف النهائي يتطلب مالك النظام بعد انقضائها.',
      danger:true,confirmText:'حذف',
      rpc:()=>rpcRequestDeletion(clientId),
      successMsg:'بدأت مهلة الحذف (30 يومًا)',successTone:'warn',failMsg:'تعذّر الطلب',
      onSuccess:()=>{CLIENTS=CLIENTS.filter(x=>x.id!==clientId);renderPortfolio();}
    });
  }
}


async function renderArchived(){
  SCREEN='archived';$('#hProject').textContent='الشركاء المؤرشفون';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backP">↩ المحفظة</button><span style="margin-inline-start:auto">الشركاء المؤرشفون والمجدولون للحذف. الاسترجاع متاح طوال مهلة الـ30 يومًا.</span></div><div id="archList">'+skeleton('list',2)+'</div>';
  $('#backP').onclick=renderPortfolio;
  const isOwner=await checkIsOwner();
  const arch=await fetchClientsByState('archived');
  const pend=await fetchClientsByState('pending_deletion');
  const aprojs=await fetchArchivedProjects();
  const list=$('#archList');
  if(!arch.length&&!pend.length&&!aprojs.length){list.innerHTML='<div class="empty-cta"><div class="ico">'+I.archive+'</div><h3>لا عناصر مؤرشفة</h3><p>الشركاء والمشاريع المؤرشفة أو المجدولة للحذف تظهر هنا.</p></div>';return;}
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
  list.querySelectorAll('[data-prestore]').forEach(b=>b.onclick=()=>runLifecycleAction({
    rpc:()=>rpcRestoreProject(b.dataset.prestore),
    successMsg:'استُرجع المشروع',onSuccess:renderArchived}));
  list.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'طلب حذف مشروع',message:'بدء مهلة 30 يومًا لحذف هذا المشروع وكل بنوده؟',danger:true,confirmText:'حذف',
    rpc:()=>rpcRequestProjectDeletion(b.dataset.pdel),
    successMsg:'بدأت المهلة',successTone:'warn',onSuccess:renderArchived}));
  list.querySelectorAll('[data-ppurge]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'حذف نهائي',message:'حذف نهائي لا رجعة فيه للمشروع وكل بنوده. متأكد؟',danger:true,confirmText:'حذف نهائي',
    rpc:()=>rpcPurgeProject(b.dataset.ppurge),
    successMsg:'حُذف نهائيًا',failMsg:'تعذّر — تحقق من المهلة والصلاحية',onSuccess:renderArchived}));
  list.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>runLifecycleAction({
    rpc:()=>rpcRestoreClient(b.dataset.restore),
    successMsg:'تم الاسترجاع',
    onSuccess:async()=>{CLIENTS=await fetchClientsByState('active');renderArchived();}}));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'طلب حذف',message:'بدء مهلة 30 يومًا لحذف هذا الشريك؟',danger:true,confirmText:'حذف',
    rpc:()=>rpcRequestDeletion(b.dataset.del),
    successMsg:'بدأت مهلة الحذف',successTone:'warn',onSuccess:renderArchived}));
  list.querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'حذف نهائي',message:'تحذير: حذف نهائي لا رجعة فيه لكل بيانات الشريك ومشاريعه. متأكد؟',danger:true,confirmText:'حذف نهائي',
    rpc:()=>rpcPurgeClient(b.dataset.purge),
    successMsg:'تم الحذف النهائي',failMsg:'تعذّر — تحقق من المهلة والصلاحية',onSuccess:renderArchived}));
}

// ===== سجل التدقيق على مستوى المكتب =====
// القاموس موحّد في config.js (AUDIT_ACTIONS) ويشترك فيه سجل المكتب وسجل المشروع.

// ===== إسناد الفريق (داخلي — لا يظهر للشريك بأي شكل) =====
async function openAssignPanel(projectId,projectName){
  $('#assignOverlay').style.display='flex';
  $('#assignTitle').textContent='إسناد الفريق: '+(projectName||'');
  const body=$('#assignBody');body.innerHTML=skeleton('cards',1);
  try{
    const [members,assigned]=await Promise.all([fetchTeamMembers(),fetchProjectStaff(projectId)]);
    const aset=new Set(assigned);
    const roleAr={admin:'إدارة المشاريع',manager:'فريق'};
    body.innerHTML=`
      <p class="trk-hint">أعضاء الطاقم المسندون يرون هذا المشروع في محفظتهم وخط تسليماته. المالك وإدارة المشاريع يرون الكل دائمًا. <b>الشريك لا يرى الإسناد إطلاقًا.</b></p>
      ${members.map(u=>`<label class="assign-row"><input type="checkbox" data-assign="${u.id}" ${aset.has(u.id)?'checked':''}>
        <b>${esc(u.full_name||u.email)}</b><span class="assign-role">${roleAr[u.role]||u.role}</span></label>`).join('')||'<p class="pempty">لا أعضاء طاقم نشطين بعد.</p>'}
      <div class="imp-actions">
        <button class="hbtn gold" id="assignSave">حفظ الإسناد</button>
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
  const body=$('#holBody');body.innerHTML=skeleton('cards',1);
  const paint=async()=>{
    const rows=await fetchHolidays();
    body.innerHTML=`
      <p class="trk-hint">العطلات الرسمية (فوق الجمعة/السبت) — تُستثنى من كل الجدولة والمدد والتأخيرات. حدّثها عند إعلان التواريخ الرسمية.</p>
      ${rows.map(h=>`<div class="hol-row"><b>${esc(h.name)}</b><span>${h.hdate}</span><button class="ib" data-holdel="${h.id}" aria-label="حذف" style="color:var(--crit)">🗑</button></div>`).join('')||'<p class="pempty">لا عطلات مسجلة.</p>'}
      <div class="hol-row new">
        <input id="holName" placeholder="اسم العطلة" class="trk-name">
        <input id="holDate" type="date" class="trk-name" style="max-width:160px">
        <button class="hbtn ok" id="holAdd">+ إضافة</button>
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
