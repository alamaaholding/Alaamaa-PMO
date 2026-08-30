// ═══════════════════════════════════════════════════════════════════════
//  app/projectactions.js — مُتحكِّم شاشة المشروع (مقسوم من app/main.js)
// ═══════════════════════════════════════════════════════════════════════
//
//  AUDIT §أ-١ يصف app/main.js بأنه ملفٌ يجمع ما لا يجتمع: المصادقة، والتوجيه،
//  وفتح الشاشات، **وأفعال جدول المشروع**. وهذه الأخيرة هي ما انتقل هنا:
//
//      التبويب والتركيز : setView · focusTask · gotoTask
//      البنود           : handleAddTask · handleDeleteTask · editStartDate · openDeps
//      المتطلبات        : openReqs · renderReqs
//      طلبات التعديل    : vCR · bindCR
//      الوصول والطباعة  : openAccess · renderAccessList · printProject
//
//  والقياس هو ما حدّد الحدّ: هذه الخمس عشرة دالة **مغلقة على نفسها** — لا تحتاج
//  من app/main.js إلا ثلاثة متغيّرات حالةٍ للحوارات انتقلت معها، ولا يحتاج منها
//  main.js شيئًا. وكانت تُشكّل عشرًا من ثلاث عشرة حافةً بين views.js و main.js.
//
//  ═══ لماذا لم تتحوّل إلى ESM في الدفعة نفسها ═══
//
//  لأنها **نقلٌ لا تحويل**. الملف يبقى في الدمج النصي بنفس النطاق المشترك، فلا
//  حرفَ سلوكٍ يتغيّر — والقاعدة الحاكمة الثانية تمنع جمع البنية والسلوك في دفعة.
//  والتحويل يأتي مع views.js، إذ بينهما دورة (`render` من هناك، والمعالِجات من
//  هنا) — ودورةٌ في ESM لا تُكسَر بل **تُحوَّل طرفاها معًا**.

// ===== الرابط يفوز على التفضيل المحفوظ =====
// localStorage افتراضٌ حين لا يقول الرابط شيئًا؛ فإن قال، فهي نيّة صريحة من
// المُرسِل. والعكس يعني أن رابطًا مشتركًا يُعرَض بتفضيلات المُستقبِل — وهو
// بالضبط العطل الذي تعالجه هذه الدفعة.
// تبديل التبويب — نقطة الدخول الوحيدة (تحدّث الرابط أيضًا)
function setView(v,ref){
  if(!PERMS[ROLE]||PERMS[ROLE].views.indexOf(v)===-1)return;
  VIEW=v;FOCUS_REF=ref||null;
  render();writeHash();
  if(FOCUS_REF)focusTask(FOCUS_REF);
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

// أنواع طلبات تعديل الخطة — و«وضع التطبيق»: هل يطبّقه النظام آليًا عند الموافقة أم يحتاج تنفيذًا يدويًا؟
const CR_KIND={
  duration:{t:'تغيير المدة',auto:true},
  deps:{t:'تغيير التبعيات',auto:false},
  add:{t:'إضافة بند',auto:false},
  remove:{t:'حذف بند',auto:false},
  other:{t:'أخرى',auto:false}
};

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
    <button class="hbtn gold wide" id="crSubmit">إرسال الطلب</button>
  </div>`:'';
  const list=CRS.length?CRS.map(c=>{
    const t=PROJECT.tasks.find(x=>x.id===c.task_ref);
    const stcls=c.status==='pending'?'pending':c.status==='approved'?'approved':'rejected';
    const sttxt=c.status==='pending'?'معلّق':c.status==='approved'?'موافق عليه':'مرفوض';
    const kd=CR_KIND[c.kind]||{t:c.kind,auto:false};
    // زر الموافقة يقول بصدق ما سيفعله النظام فعلًا
    const apText=kd.auto?'موافقة وتطبيق':'موافقة (تنفيذ يدوي)';
    const actions=(canApprove&&c.status==='pending')?`<div class="cract"><button class="hbtn ok" data-ap="${c.id}">${apText}</button><button class="hbtn" data-rj="${c.id}" style="background:#fff;color:var(--crit);border-color:#e8c4bc">رفض</button></div>`:'';
    // تنبيه تنفيذ معلّق: وافق عليه ولم يُطبَّق آليًا ⇒ الخطة لم تتغيّر بعد
    const awaitingExec=(c.status==='approved'&&!kd.auto&&!c.executed_at);
    const pendingExec=awaitingExec?`<div class="cr-pendexec">⚠ معتمد — الخطة لم تتغيّر تلقائيًا. أدوات بناء الخطة مفتوحة الآن في تبويب «الجدول» لتنفيذه.</div>
      <div class="cr-exec-box">
        <button class="reqbtn ok" data-goplan="1">↗ افتح الجدول لتنفيذه</button>
        <button class="reqbtn" data-execcr="${c.id}">✅ نُفِّذ — علّمه منفَّذًا</button>
      </div>`:'';
    const doneExec=(c.status==='approved'&&c.executed_at)?
      `<div class="cr-mode auto">✅ نُفِّذ في ${new Date(c.executed_at).toLocaleDateString('ar')}${c.baseline_after?' · ثُبِّت أساس جديد بعده':''}</div>`:'';
    const goto=(c.task_ref&&t)?`<button class="lnk" data-gotask="${esc(c.task_ref)}">↗ الذهاب إلى البند في الخطة</button>`:'';
    return `<div class="crcard cr-plan">
      <div class="crhd"><span class="crid">${esc(c.id.slice(0,12))}</span><span class="crstate ${stcls}">${sttxt}</span></div>
      <div class="crbody"><b>البند:</b> ${esc(c.task_ref||'—')}${t?' — '+esc(t.name):''} · <b>النوع:</b> ${kd.t}${c.new_value?' · <b>القيمة:</b> '+esc(c.new_value):''}<br><b>المبرر:</b> ${esc(c.reason||'—')}<br><small>${new Date(c.created_at).toLocaleDateString('ar')}</small>${c.decision_note?'<br><small>القرار: '+esc(c.decision_note)+'</small>':''}${goto?'<br>'+goto:''}</div>
      <div class="cr-modewrap">${kd.auto?crAutoNote:crManualNote}</div>${pendingExec}${doneExec}${actions}</div>`;
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
  $$('[data-goplan]').forEach(b=>b.onclick=()=>{VIEW='table';writeHash();render();});
  $$('[data-execcr]').forEach(b=>b.onclick=async()=>{
    // يعرض ما تغيّر فعليًا مقابل آخر خط أساس، ثم يعرض تثبيت أساس جديد يوثّق التغيير
    let d={};
    try{ d=await fetchBaselineDiff(PROJECT._dbId); }catch(e){}
    const nA=(d.added||[]).length,nR=(d.removed||[]).length,nC=(d.changed||[]).length;
    const diffHtml=d.has_baseline?`
      <div class="cr-diff">
        <b>ما تغيّر مقابل ${esc(d.baseline_label||'آخر أساس')}:</b>
        ${nA?`<div class="cr-diff-add">➕ أُضيف ${nA} بند: ${(d.added||[]).slice(0,6).map(x=>esc(x.ref)).join('، ')}${nA>6?'…':''}</div>`:''}
        ${nR?`<div class="cr-diff-rm">➖ حُذف ${nR} بند: ${(d.removed||[]).slice(0,6).map(x=>esc(x)).join('، ')}${nR>6?'…':''}</div>`:''}
        ${nC?`<div class="cr-diff-ch">✏️ تغيّرت مدة ${nC} بند: ${(d.changed||[]).slice(0,6).map(x=>esc(x.ref)+' ('+x.old+'→'+x.new+')').join('، ')}${nC>6?'…':''}</div>`:''}
        ${(!nA&&!nR&&!nC)?'<div class="sa-hint">⚠ لا فرق مرصود عن خط الأساس — تأكد أنك نفّذت التعديل فعلًا في الجدول.</div>':''}
      </div>`:'<p class="sa-hint">لا خط أساس سابق للمقارنة.</p>';

    const ok=await dialog({title:'تأكيد تنفيذ طلب التعديل',
      message:'سيُعلَّم هذا الطلب منفَّذًا، وتُغلق نافذة التعديل البنيوي المؤقتة.',
      html:diffHtml,
      fields:[{key:'bl',label:'تثبيت أساس جديد يوثّق هذا التغيير؟',type:'select',value:'yes',
        options:[{v:'yes',t:'نعم — ثبّت أساسًا جديدًا (الأنسب لحوكمة سليمة)'},
                 {v:'no',t:'لا — أكتفي بتعليمه منفَّذًا الآن'}]}],
      confirmText:'تأكيد'});
    if(!ok)return;
    try{
      let blId=null;
      if(ok.bl==='yes'){
        const nb=await saveNewBaseline(PROJECT._dbId);
        blId=nb&&nb.id?nb.id:null;
      }
      await markCRExecuted(b.dataset.execcr,blId);
      CRS=await fetchCRs(PROJECT._dbId);
      await loadProject(CID,PID);render();
      toast(blId?'عُلِّم منفَّذًا وثُبِّت أساس جديد':'عُلِّم منفَّذًا','ok');
    }catch(e){toast(e.message,'err');}
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
  const OWN={client:'الشريك',alamah:'علامة'};
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
      ${canEdit?`<td><button class="ib txt-crit" data-rdel="${i}" aria-label="حذف هذا المتطلب">✕</button></td>`:''}</tr>`;
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
    compute();preserveFocus(renderReqs);
  }));
  $('#reqTbl').querySelectorAll('[data-rdel]').forEach(b=>b.onclick=async()=>{
    const i=+b.dataset.rdel, r=REQ_TASK.requirements[i];
    // اللقطة في اليد أصلًا — لا حاجة لجلبها.
    const snap={description:r.desc,owner:r.owner,sla_days:r.sla,blocking:r.blocking,
      requested_at:r.requested||null,received_at:r.received||null};
    try{
      await undoable({
        label:'حُذف المتطلب',
        remove:async()=>{ if(r._id)await deleteRequirement(r._id); REQ_TASK.requirements.splice(i,1); },
        refresh:async()=>{ compute(); renderReqs(); },
        restore:async()=>{
          const {data,error}=await insertRequirement(Object.assign({task_id:REQ_TASK._dbId},snap));
          if(error)throw error;
          REQ_TASK.requirements.splice(i,0,{_id:data.id,desc:snap.description,owner:snap.owner,
            sla:snap.sla_days,blocking:snap.blocking,
            requested:snap.requested_at||'',received:snap.received_at||''});
        },
        doneMsg:'استُعيد المتطلب'
      });
    }catch(e){ toast('تعذّر الحذف: '+e.message,'err'); }
  });
}

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
  if(!await confirmDialog('تأكيد الحذف',msg,true,'حذف'))return;
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

function printProject(mode){
  if(mode==='gantt'){
    // الجانت يُصغَّر للطباعة ثم يُستعاد. الاستعادة كانت معلَّقة على afterprint وحده — فإن
    // لم يُطلقه المتصفح يبقى المخطط مصغَّرًا بعد إغلاق الحوار ويبدو أن العرض تعطّل.
    const prevPX=PX; PX=6; render();
    let done=false;
    const restore=()=>{
      if(done)return;done=true;
      PX=prevPX;render();
      window.removeEventListener('afterprint',restore);
      window.removeEventListener('focus',restore);
      clearTimeout(guard);
    };
    window.addEventListener('afterprint',restore);
    window.addEventListener('focus',restore);
    const guard=setTimeout(restore,60000);
    setTimeout(()=>{try{window.print();}catch(e){restore();}},80);
  }else{
    try{window.print();}catch(e){}
  }
}


// ═══ ربط حوارات الشاشة الثلاثة ═══
// وصول الشريك · المتطلبات · التبعيات. كانت هذه التعليمات في app/main.js بينما
// نصفها الآخر (openAccess · openReqs · openDeps ونظيراتها في التصيير) انتقل هنا
// — أي أن حوارًا واحدًا كان **مقسومًا بين ملفّين**. وهو نفس النمط الذي تكرّر في
// طبقة الرابط وفي مفتاح pmo_pfilters: النصف هنا والنصف هناك.
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
const crAutoNote='<span class="cr-mode auto">⚡ يُطبَّق على الجدول تلقائيًا عند الموافقة</span>';
const crManualNote='<span class="cr-mode manual">✋ يتطلب تنفيذًا يدويًا في تبويب «الجدول» بعد الموافقة</span>';
$('#reqAdd').onclick=async()=>{
  const {data,error}=await insertRequirement({task_id:REQ_TASK._dbId,description:'متطلب جديد',owner:'client',sla_days:2,blocking:true});
  if(error){toast('تعذّر الإضافة: '+error.message,'err');return;}
  REQ_TASK.requirements.push({_id:data.id,desc:'متطلب جديد',owner:'client',sla:2,blocking:true,requested:'',received:''});
  compute();renderReqs();
};
$('#reqClose').onclick=()=>{$('#reqOverlay').style.display='none';render();};
$('#reqOverlay').onclick=e=>{if(e.target.id==='reqOverlay'){$('#reqOverlay').style.display='none';render();}};
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
