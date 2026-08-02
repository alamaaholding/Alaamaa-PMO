// ===== الإعدادات =====
const SUPABASE_URL='https://gxiucsieezkvwztbsrgf.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aXVjc2llZXprdnd6dGJzcmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTI5NzksImV4cCI6MjA5NDg2ODk3OX0.yKw4yQEJM_4wPk1ki5m084OZqqmAA8A07uVeamlIT3M';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
const TRACKS={"0":{name:"التأسيس المضغوط",code:"0",color:"#1A1A1A"},"A":{name:"النمو السريع والمواسم",code:"A",color:"#C8A06B"},"B":{name:"التحليل والتشخيص بالموجات",code:"B",color:"#7A8B6F"},"C":{name:"الاستراتيجية وبناء الأصول",code:"C",color:"#9C6B4A"}};
const STATUS={notstarted:'لم تبدأ',inprogress:'جارية',blocked:'متوقفة',done:'مكتملة'};
const TYPES={task:'مهمة',milestone:'معلم',fixed:'ثابت',cont:'مستمر',package:'حزمة عمل'};
const ROLE_NAMES={pmo:'مكتب إدارة المشاريع',delivery:'الفريق',client:'العميل'};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const fmt=d=>{const x=new Date(d);return('0'+x.getDate()).slice(-2)+'/'+('0'+(x.getMonth()+1)).slice(-2);};
const fmtY=d=>{const x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);};
const D=s=>new Date(s+'T00:00:00');
function todayISO(){return fmtY(new Date());}


// ===== الصلاحيات =====
const PERMS={pmo:{editStruct:true,editProg:true,editReqs:true,approveContract:true,crAction:'approve',views:['dashboard','table','gantt','deliv','timeline','cr','requests','discuss','audit']},
  delivery:{editStruct:true,editProg:true,editReqs:true,approveContract:false,crAction:'request',views:['dashboard','table','gantt','deliv','timeline','cr','requests','discuss','audit']},
  client:{editStruct:false,editProg:false,editReqs:false,approveContract:false,crAction:'request',views:['dashboard','gantt','deliv','cr','requests','discuss']}};
// إجراءات التعديل تخضع أيضًا لمستوى الصلاحية الفعلي على هذا المشروع تحديدًا (myAccessLevelFor) —
// لا الدور العام وحده. كانت myAccessLevelFor محسوبة منذ إنشاء نظام الصلاحيات لكنها لم تُستخدَم
// في أي مكان فعليًا — أي منح «عرض فقط» كان شكليًا بالكامل ولا يمنع أي تعديل حقيقي.
const EDIT_ACTIONS=['editStruct','editProg','editReqs','approveContract'];
function can(p){
  if(!(PERMS[ROLE]&&PERMS[ROLE][p]))return false;
  if(EDIT_ACTIONS.includes(p)&&!IS_OWNER&&(MY_ACCESS||[]).length&&typeof PID!=='undefined'&&PID){
    const dept=(typeof PROJ_DEPTS!=='undefined'&&PROJ_DEPTS)?PROJ_DEPTS[PID]:null;
    if(myAccessLevelFor(PID,dept,CID)==='view')return false;
  }
  return true;
}

// ===== سجل التدقيق: قاموس موحّد (مصدر وحيد لسجل المشروع وسجل المكتب) =====
// المفاتيح مطابقة لأسماء الأفعال التي تكتبها دوال القاعدة (pmo_audit_*) فعليًا.
const AUDIT_ACTIONS={
  // البنود
  status_change:'تغيير الحالة',progress_change:'تحديث التقدّم',duration_change:'تغيير المدة',
  data_correction:'تصحيح بيانات',task_update:'تعديل بند',
  // طلبات تعديل الخطة
  cr_created:'طلب تعديل خطة جديد',cr_pending:'طلب تعديل معلّق',
  cr_approved:'الموافقة على طلب تعديل',cr_rejected:'رفض طلب تعديل',
  cr_create:'طلب تعديل خطة جديد',cr_decision:'قرار على طلب تعديل',
  // المتطلبات
  requirement_add:'إضافة متطلب',requirement_delete:'حذف متطلب',
  // النقاش
  comment_add:'إضافة تعليق',comment_delete:'حذف تعليق',
  comment_resolve:'حلّ تعليق',comment_reopen:'إعادة فتح تعليق',
  // طلبات الخدمة
  client_request_add:'طلب خدمة جديد',client_request_status:'تغيير حالة طلب خدمة',
  // المشاريع والعملاء
  project_create:'إنشاء مشروع',project_delete:'حذف مشروع',
  archive_project:'أرشفة مشروع',restore_project:'استرجاع مشروع',
  request_project_deletion:'طلب حذف مشروع',purge_project:'حذف نهائي لمشروع',
  archive_client:'أرشفة عميل',restore_client:'استرجاع عميل',
  request_deletion:'طلب حذف عميل',purge_client:'حذف نهائي لعميل'
};
const AUDIT_ENTITIES={task:'بند',change_request:'طلب تعديل خطة',requirement:'متطلب',
  comment:'تعليق',client_request:'طلب خدمة',project:'مشروع',client:'عميل'};

// ===== نطاق صلاحيات الفريق =====
// المبدأ: لا تغيير في سلوك أي موظف قائم إطلاقًا حتى يمنحه مالك النظام صلاحية محددة صراحة.
// موظف بلا أي سجل في MY_ACCESS = يرى كل شيء كما كان دائمًا (سلوك ما قبل هذا النظام).
function hasCompanyScope(){return IS_OWNER||MY_ACCESS.some(a=>a.scope_type==='company');}
function myDeptScopes(){return new Set(MY_ACCESS.filter(a=>a.scope_type==='department').map(a=>a.scope_value));}
function myClientScopes(){return new Set(MY_ACCESS.filter(a=>a.scope_type==='client').map(a=>a.scope_value));}
function myProjectScopes(){return new Set(MY_ACCESS.filter(a=>a.scope_type==='project').map(a=>a.scope_value));}
// هل يُسمح لي برؤية مشروع بعينه (بمعرّفه وقسمه وعميله)؟
function canSeeProject(projectId,dept,clientId){
  if(IS_OWNER||hasCompanyScope())return true;
  if(!MY_ACCESS.length)return true; // لا تخصيص = لا قيود (توافق خلفي)
  if(myProjectScopes().has(projectId))return true;
  if(clientId&&myClientScopes().has(clientId))return true;
  if(dept&&myDeptScopes().has(dept))return true;
  return false;
}
// أعلى مستوى صلاحية ممنوح لي على مشروع بعينه: 'edit'|'view'|null (null فقط إن كان مقيّدًا ولا يراه أصلًا)
function myAccessLevelFor(projectId,dept,clientId){
  if(IS_OWNER)return 'edit';
  if(!MY_ACCESS.length)return 'edit'; // لا تخصيص = صلاحية كاملة كما كانت دائمًا
  const rows=MY_ACCESS.filter(a=>
    a.scope_type==='company'||
    (a.scope_type==='project'&&a.scope_value===projectId)||
    (a.scope_type==='client'&&clientId&&a.scope_value===clientId)||
    (a.scope_type==='department'&&dept&&a.scope_value===dept));
  if(!rows.length)return null;
  return rows.some(r=>r.access_level==='edit')?'edit':'view';
}
// هل يُسمح لي برؤية عميل كامل (له أي مشروع أراه، أو نطاق عميل/شركة مباشر)؟
function canSeeClient(clientId,clientProjects){
  if(IS_OWNER||hasCompanyScope())return true;
  if(!MY_ACCESS.length)return true;
  if(myClientScopes().has(clientId))return true;
  return (clientProjects||[]).some(p=>canSeeProject(p.id,p.department,clientId));
}

// ===== نظام حالة المشروع الموحّد =====
// كل حالة مبنية على بيانات حقيقية قابلة للحساب من pmo_portfolio() مباشرة، عدا حالة واحدة
// («قد يحتاج مراجعة») مُعلَّمة صراحة كتقدير لا حساب جدولة دقيق — ذلك موجود فعليًا وبدقة
// كاملة داخل كل مشروع بمفرده عبر الجانت (شبكة التبعيات الكاملة)، ويكلف كثيرًا حسابه لكل
// مشروع في المحفظة دفعة واحدة. الترتيب أدناه هو ترتيب الأولوية عند التجميع لعدة مشاريع.
const PROJECT_STATUS_DEFS=[
  {key:'blocked',   priority:0,icon:'🔴',label:'متوقف',        color:'var(--crit)',  bg:'var(--crit-bg)'},
  {key:'attention', priority:1,icon:'🟠',label:'يحتاج انتباه',  color:'#B5651D',      bg:'var(--warn-bg)'},
  {key:'paused',    priority:2,icon:'⏸',label:'متوقف مؤقتًا',   color:'var(--muted)', bg:'var(--soft-2)'},
  {key:'at_risk',   priority:3,icon:'🟡',label:'قد يحتاج مراجعة',color:'var(--warn)', bg:'var(--warn-bg)'},
  {key:'not_started',priority:4,icon:'🔵',label:'لم يبدأ التنفيذ',color:'var(--blue)', bg:'var(--blue-bg)'},
  {key:'active',    priority:5,icon:'🟢',label:'نشط وعلى المسار',color:'var(--ok)',   bg:'var(--ok-bg)'},
  {key:'done',      priority:6,icon:'✅',label:'مكتمل',         color:'var(--ok)',    bg:'var(--ok-bg)'}
];
const statusByKey={};PROJECT_STATUS_DEFS.forEach(s=>{statusByKey[s.key]=s;});
function computeProjectStatus(row){
  if(row.lifecycle_state==='paused')return statusByKey.paused;
  const total=Number(row.total_tasks||0),done=Number(row.done_tasks||0),blocked=Number(row.blocked_tasks||0);
  const pending=Number(row.pending_client_reqs||0),discuss=Number(row.open_comments||0);
  if(blocked>0)return statusByKey.blocked;
  if(pending>0||discuss>0)return statusByKey.attention;
  if(total===0||row.lifecycle==='proposal'||row.status==='draft')return statusByKey.not_started;
  if(total>0&&done===total)return statusByKey.done;
  if(row.start_date){
    const days=(Date.now()-new Date(row.start_date).getTime())/86400000;
    const pct=total?done/total:0;
    if(days>30&&pct<0.2)return statusByKey.at_risk;
  }
  return statusByKey.active;
}
// لعميل بعدة مشاريع: الحالة الأسوأ (الأعلى أولوية) بين كل مشاريعه النشطة
function worstProjectStatus(rows){
  if(!rows||!rows.length)return statusByKey.not_started;
  let worst=null;
  rows.forEach(r=>{const s=computeProjectStatus(r);if(!worst||s.priority<worst.priority)worst=s;});
  return worst;
}
function renderStatusBadge(s,extraClass){
  return `<span class="pstatus-badge ${extraClass||''}" style="--sc:${s.color};--sbg:${s.bg}" title="${esc(s.label)}"><i class="pstatus-dot" style="background:${s.color}"></i>${esc(s.label)}</span>`;
}
// تُستخدم من شبكة المحفظة وصفحة العميل المخصَّصة كليهما؛ لا حساب مكرّر في مكانين
// (بالضبط الخلل الذي عالجناه سابقًا في مطابقة المراحل — نفس المبدأ هنا).
function aggregateClientRows(cid,list,fallback){
  const r0=(list&&list[0])||{};
  const c=CLIENTS.find(x=>x.id===cid)||fallback||{name:r0.client_name,color:r0.color||'#C8A06B'};
  if(!list||!list.length)return{cid,c,list:[],tot:0,done:0,blocked:0,reqs:0,comments:0,
    hasAlerts:false,isActive:false,isDraft:true,pct:0,noProjects:true};
  const tot=list.reduce((s,r)=>s+Number(r.total_tasks||0),0);
  const done=list.reduce((s,r)=>s+Number(r.done_tasks||0),0);
  const blocked=list.reduce((s,r)=>s+Number(r.blocked_tasks||0),0);
  const reqs=list.reduce((s,r)=>s+Number(r.pending_client_reqs||0),0);
  const comments=list.reduce((s,r)=>s+Number(r.open_comments||0),0);
  return {cid,c,list,tot,done,blocked,reqs,comments,hasAlerts:blocked>0||reqs>0||comments>0,
    isActive:list.some(r=>r.lifecycle==='active'||r.lifecycle==='approved'),
    isDraft:list.some(r=>r.status==='draft'||r.lifecycle==='proposal'),
    pct:tot>0?Math.round(done/tot*100):0};
}
// ===== الحفاظ على التركيز وموضع التمرير عبر إعادة بناء ناتجة عن تعديل حقل واحد =====
// المشكلة: أي render()/renderReqs() يهدم DOM بأكمله ويعيد بناءه — فيُصفَّر موضع التمرير
// (داخل .tablewrap مثلًا) ويُفقَد تركيز الحقل الذي كان المستخدم يكتب فيه للتو، مما يبدو
// وكأن الصفحة «قفزت» أو أن ما كُتب «تصفّر». هذه الدالة تغلّف أي إعادة بناء كهذه فتُبقي
// المستخدم في مكانه بالضبط.
function preserveFocus(rerenderFn){
  const el=document.activeElement;
  const isField=el&&/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  const row=isField?el.closest('[data-id],[data-i]'):null;
  const f=isField?(el.dataset.f||el.dataset.rf||null):null;
  const rowKey=row?(row.dataset.id!==undefined?'id:'+row.dataset.id:'i:'+row.dataset.i):null;
  const selStart=(isField&&typeof el.selectionStart==='number')?el.selectionStart:null;
  const selEnd=(isField&&typeof el.selectionEnd==='number')?el.selectionEnd:null;
  const scrollers=[...document.querySelectorAll('.tablewrap,#reqTbl')].map(c=>[c,c.scrollTop]);

  rerenderFn();

  if(f&&rowKey){
    const m=/^(id|i):([\s\S]*)$/.exec(rowKey);
    if(m){
      const kind=m[1],val=m[2];
      const esc2=(window.CSS&&CSS.escape)?CSS.escape(val):val;
      const rowSel=kind==='id'?`[data-id="${esc2}"]`:`[data-i="${esc2}"]`;
      const newRow=document.querySelector(rowSel);
      const newEl=newRow&&newRow.querySelector(`[data-f="${f}"],[data-rf="${f}"]`);
      if(newEl){
        newEl.focus({preventScroll:true});
        if(selStart!=null&&newEl.setSelectionRange){
          try{newEl.setSelectionRange(selStart,selEnd);}catch(e){}
        }
      }
    }
  }
  scrollers.forEach(([c,top])=>{if(document.body.contains(c))c.scrollTop=top;});
}

// ===== توليد معرّف نظيف (Slug) من اسم عربي — تقريب صوتي، يُعرض دائمًا كحقل قابل للتعديل =====
// لا يوجد تحويل آلي عربي↔لاتيني دقيق ١٠٠٪ (الحروف المتحركة القصيرة لا تُكتب عربيًا أصلًا)،
// فهذا تقريب معقول يُراجعه المستخدم ويُعدِّله يدويًا قبل الاعتماد — هذا قرار مقصود لا نقص.
const AR_TRANSLIT={
  'أ':'a','إ':'i','آ':'a','ا':'a','ء':'','ئ':'e','ؤ':'o',
  'ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh',
  'ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh',
  'ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n',
  'ه':'h','و':'w','ي':'y','ة':'a','ى':'a',
  ' ':'-','_':'-','-':'-'
};
function transliterateArabic(s){
  return (s||'').split('').map(ch=>ch in AR_TRANSLIT?AR_TRANSLIT[ch]:(/[a-zA-Z0-9]/.test(ch)?ch:'')).join('');
}
function slugify(name){
  return transliterateArabic(String(name||'').trim().toLowerCase())
    .replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'client';
}
// معرّف فريد: يتحقق مقابل القائمة الحالية (CLIENTS)، ويضيف لاحقة رقمية عند التطابق
function uniqueSlug(name,existing){
  const base=slugify(name);
  const taken=new Set((existing||[]).map(c=>c.slug).filter(Boolean));
  if(!taken.has(base))return base;
  let i=2;while(taken.has(base+'-'+i))i++;
  return base+'-'+i;
}

const I={
 scale:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 21h18M6 7l-3 6h6l-3-6zM18 7l-3 6h6l-3-6zM7 7h10"/></svg>',
 clipboard:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a2 2 0 0 1 6 0M9 10h6M9 14h6M9 18h4"/></svg>',
 archive:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></svg>',
 calendar:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18M7 15h3M14 15h3"/></svg>',
 upload:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7 10l5-5 5 5M4 19h16"/></svg>',
 dots:'<svg class="icn" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
 pencil:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/></svg>',
 trash:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6"/></svg>',
 link:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
 users:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6"/></svg>'
};

// ===== أيقونات التبويبات =====
// ملاحظة تصميمية: «تعديل الخطة» (لوح مستطيل + قلم) و«طلبات الخدمة» (جرس دائري)
// أُعطيا شكلين ظاهريين مختلفين تمامًا — لا لونين فقط — لأنهما أكثر تبويبين يقع فيهما اللبس.
const _sv=p=>'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
const VIEW_ICONS={
  dashboard:_sv('<rect x="3" y="3" width="7.5" height="8" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="3" y="14" width="7.5" height="7" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/>'),
  table:_sv('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 9v11"/>'),
  gantt:_sv('<path d="M4 4v16M8 7h9M6.5 12h11M10 17h7"/>'),
  deliv:_sv('<path d="M5 3v18M5 4h11l-2 3.5L16 11H5"/>'),
  timeline:_sv('<path d="M3 8h13l-3-3M21 16H8l3 3"/>'),
  cr:_sv('<path d="M15.5 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h7M8.5 8h6M8.5 12h3"/><path d="M18.5 13.5l2.5 2.5-4.5 4.5H14v-2.5z"/>'),
  requests:_sv('<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>'),
  discuss:_sv('<path d="M20 14a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M8.5 9h7M8.5 12.5h4"/>'),
  audit:_sv('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V9H8"/><path d="M12 8v4.5l3 1.8"/>')
};
// التابات التي تحتاج تمييزًا لونيًا إضافيًا لتقارب معناها
const VIEW_TONE={cr:'plan',requests:'service'};

// أعلى سلف في شجرة WBS — هذا هو تعريف «المرحلة» الحقيقي والوحيد.
// لا نثق بعمود track كمصدر حقيقة (قد ينحرف عن الهرمية الفعلية)؛ الهرمية عبر parent
// المبنية من parent_id الفعلي في القاعدة موثوقة دائمًا لأنها قيد مفتاح أجنبي حقيقي.
function taskTopAncestor(t, byRef){
  let cur=t, guard=0;
  while(cur.parent && byRef[cur.parent] && guard++<50){ cur=byRef[cur.parent]; }
  return cur.id;
}

// المراحل الديناميكية: ذاتية الإصلاح دائمًا — تُشتق من مراجع الجذور الفعلية الموجودة
// في المشروع، لا من سجل pmo_project_tracks وحده. إن وُجد تخصيص اسم/لون في السجل يُستخدم؛
// وإلا يُشتق افتراضي من اسم البند الجذر نفسه — فلا تظهر تصفية فارغة أبدًا بسبب انحراف البيانات.
const _TRACK_PALETTE=['#8A8071','#4A6B8A','#A67F4E','#6B8E6B','#8A5E7A','#5E8A8A','#8A6B4A','#4B3F72'];
function projTrackList(){
  if(typeof PROJECT!=='undefined'&&PROJECT&&PROJECT.tasks&&PROJECT.tasks.length){
    const reg={};(PROJECT.tracks||[]).forEach(x=>{reg[x.key]=x;});
    const byRef={};PROJECT.tasks.forEach(t=>{byRef[t.id]=t;});
    const seen=new Set(),out=[];let pi=0;
    PROJECT.tasks.forEach(t=>{
      const k=t.track;if(seen.has(k))return;seen.add(k);
      const custom=reg[k],top=byRef[k];
      out.push({key:k,id:custom&&custom.id,
        name:(custom&&custom.name)||(top&&top.name)||k,
        color:(custom&&custom.color)||_TRACK_PALETTE[pi++%_TRACK_PALETTE.length],
        code:k,sort:custom?custom.sort:(1000+pi)});
    });
    out.sort((a,b)=>a.sort-b.sort);
    if(out.length)return out;
  }
  if(typeof PROJECT!=='undefined'&&PROJECT&&PROJECT.tracks&&PROJECT.tracks.length)
    return PROJECT.tracks.map(t=>({key:t.key,name:t.name,color:t.color,code:t.key,id:t.id,sort:t.sort}));
  return Object.keys(TRACKS).map((k,i)=>({key:k,name:TRACKS[k].name,color:TRACKS[k].color,code:TRACKS[k].code||k,sort:i}));
}
function trackMeta(k){
  const t=projTrackList().find(x=>x.key===k);
  if(t)return t;
  if(TRACKS[k])return{key:k,name:TRACKS[k].name,color:TRACKS[k].color,code:TRACKS[k].code||k};
  return{key:k,name:k,color:'#C8A06B',code:k};
}

// خط التسليمات: المصادر والأنواع والحالات
const DELIV_SRC={
  client:{t:'العميل',c:'#a8442f'},
  pmo:{t:'إدارة المشاريع',c:'#4B3F72'},
  marketing:{t:'التسويق',c:'#B28E67'},
  tech:{t:'التقني',c:'#35608F'},
  consulting:{t:'الاستشارات',c:'#5B8266'}
};
const DELIV_KIND={file:{t:'تسليم ملف',i:'📎'},request:{t:'طلب',i:'📤'},reply:{t:'رد',i:'↩'},approval:{t:'اعتماد',i:'✅'},note:{t:'ملاحظة',i:'📝'}};
const DELIV_STATUS={sent:'مُرسل',awaiting:'بانتظار الرد',received:'مُستلم',approved:'معتمد'};
