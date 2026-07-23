const BUILD_V='4e72e889';
/* ===== config.js ===== */
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
function can(p){return PERMS[ROLE]&&PERMS[ROLE][p];}

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

// ===== تجميع إحصاءات عميل من صفوف pmo_portfolio() — مصدر حقيقة واحد =====
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


/* ===== engine.js ===== */
// تقويم العمل: الجمعة/السبت + العطلات الرسمية (تُحمَّل من القاعدة)
let HOLIDAYS=new Set();
function setHolidays(list){HOLIDAYS=new Set((list||[]).map(h=>typeof h==='string'?h:h.hdate));}
function isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isWorkday(d){const g=d.getDay();return g!==5&&g!==6&&!HOLIDAYS.has(isoLocal(d));}
// عدّاد أيام العمل بين تاريخين (شامل الطرفين)
function wdBetween(a,b){let c=0,d=new Date(a);const e=new Date(b);
  while(d<=e){if(isWorkday(d))c++;d=new Date(d.getTime()+86400000);}return c;}
// ===== محرك CPM (مختبَر) =====
function scheduleTasks(tasks,projectStartStr){
  const isWD=isWorkday;const clone=d=>new Date(d.getTime());
  const ensureWD=d=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const nextWD=d=>{d=clone(d);d.setDate(d.getDate()+1);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const prevWD=d=>{d=clone(d);d.setDate(d.getDate()-1);while(!isWD(d))d.setDate(d.getDate()-1);return d;};
  const addWD=(d,n)=>{d=ensureWD(d);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const subWD=(d,n)=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()-1);let c=0;while(c<n){d.setDate(d.getDate()-1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=clone(a),e=clone(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=clone(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const _pkgSet=new Set(tasks.filter(t=>t.type==='package').map(t=>t.id));
  const _leafs=tasks.filter(t=>t.type!=='package');
  const map={};_leafs.forEach(t=>map[t.id]=t);
  const indeg={},adj={};_leafs.forEach(t=>{indeg[t.id]=0;adj[t.id]=[];});
  _leafs.forEach(t=>(t.deps||[]).forEach(d=>{if(map[d]){adj[d].push(t.id);indeg[t.id]++;}}));
  const q=_leafs.filter(t=>indeg[t.id]===0).map(t=>t.id),order=[];
  while(q.length){const id=q.shift();order.push(id);adj[id].forEach(n=>{if(--indeg[n]===0)q.push(n);});}
  const hasCycle=order.length!==_leafs.length;const seq=hasCycle?_leafs.map(t=>t.id):order;
  const start=new Date(projectStartStr+'T00:00:00');const R={},warnings=[];
  seq.forEach(id=>{const t=map[id];const deps=(t.deps||[]).filter(d=>map[d]);let ES;
    if(t.type==='fixed'&&t.fixedDate){ES=ensureWD(new Date(t.fixedDate+'T00:00:00'));}
    else if(t.type==='milestone'){let mx=null;deps.forEach(d=>{const ef=R[d]?R[d].EF:start;if(mx===null||ef>mx)mx=ef;});ES=ensureWD(mx||start);}
    else if(deps.length===0)ES=addWD(start,t.lag||0);
    else{
      const zero=(t.duration||0)<=0;
      const durW=t.type==='milestone'?0:Math.max(zero?0:1,t.duration||1);
      const lagAdd=(base,L)=>L>=0?addWD(base,L):subWD(base,-L);
      const dx=(t.depsX&&t.depsX.length)?t.depsX:deps.map(d=>({ref:d,type:'FS',lag:0}));
      let cand=null;
      dx.forEach(x=>{if(!R[x.ref])return;const rp=R[x.ref];let c;
        if(x.type==='SS')c=lagAdd(ensureWD(rp.ES),x.lag||0);
        else if(x.type==='FF'){const fe=lagAdd(ensureWD(rp.EF),x.lag||0);c=durW>0?subWD(fe,durW-1):ensureWD(fe);}
        else c=zero?lagAdd(ensureWD(rp.EF),x.lag||0):lagAdd(nextWD(rp.EF),x.lag||0); // FS
        if(cand===null||c>cand)cand=c;});
      ES=ensureWD(cand||start);
      if(t.lag)ES=addWD(ES,t.lag); // إزاحة البند العامة (توافق قديم)
    }
    const dur=t.type==='milestone'?0:(t.type==='cont'?null:((t.duration||0)<=0?0:Math.max(1,t.duration)));let EF;
    if(t.type==='milestone'||t.type==='cont'||dur===0)EF=clone(ES);else EF=addWD(ES,dur-1);
    R[id]={ES,EF,dur};});
  let pEnd=start;_leafs.forEach(t=>{if(t.type!=='cont'&&R[t.id].EF>pEnd)pEnd=R[t.id].EF;});
  _leafs.forEach(t=>{if(t.type==='cont')R[t.id].EF=clone(pEnd);});
  seq.slice().reverse().forEach(id=>{const t=map[id];
    // كل الروابط التي هذا البند سابق فيها (مع نوعها وإزاحتها) — لا مجرد deps خام
    const succEdges=[];
    _leafs.forEach(s=>{const dx=(s.depsX&&s.depsX.length)?s.depsX:(s.deps||[]).map(d=>({ref:d,type:'FS',lag:0}));
      dx.forEach(x=>{if(x.ref===id)succEdges.push({s,type:x.type||'FS',lag:x.lag||0});});});
    const invLag=(d,L)=>L>=0?subWD(d,L):addWD(d,-L); // عكس lagAdd المستخدم في المرور الأمامي
    let LF;
    if(succEdges.length===0)LF=clone(pEnd);
    else{
      let mn=null;
      succEdges.forEach(({s,type,lag})=>{
        const rs=R[s.id];let cand;
        if(type==='SS'){
          // القيد الحقيقي على بداية السابق لا نهايته — نحوّله لمكافئ «نهاية» بإضافة مدة t نفسه
          const lsCand=invLag(rs.LS,lag);
          const durT=t.type==='milestone'?0:Math.max(1,t.duration||1);
          cand=addWD(lsCand,durT-1);
        }else if(type==='FF'){
          cand=invLag(rs.LF,lag); // نهاية بنهاية — بلا فجوة يوم عمل
        }else{
          // FS: العكس الدقيق لِـ nextWD/ensureWD في المرور الأمامي —
          // فجوة يوم عمل واحدة تُطرح فقط إن كان اللاحق ذا مدة حقيقية (لا معلمًا/صفريًا)
          const gapped=invLag(rs.LS,lag);
          const succDur=(s.type==='milestone'||s.type==='cont')?0:(s.duration||0);
          cand=succDur>0?prevWD(gapped):gapped;
        }
        if(mn===null||cand<mn)mn=cand;
      });
      LF=clone(mn);
    }
    const dur=R[id].dur;let LS;if(t.type==='milestone')LS=clone(LF);else if(t.type==='cont')LS=clone(R[id].ES);else LS=subWD(LF,Math.max(1,dur)-1);
    R[id].LF=LF;R[id].LS=LS;let slack=wdB(R[id].ES,LS);if(t.type==='fixed')slack=0;R[id].slack=slack;R[id].critical=(t.type!=='cont')&&slack<=0;});
  // اشتقاق حزم العمل: البداية=أبكر ابن، النهاية=أقصى ابن، حرجة إن كان ابن حرجًا
  const _kids={};tasks.forEach(t=>{if(t.parent)( _kids[t.parent]=_kids[t.parent]||[] ).push(t.id);});
  let _pending=tasks.filter(t=>t.type==='package');let _g=0;
  while(_pending.length&&_g++<8){
    const _rest=[];
    _pending.forEach(p=>{
      const all=_kids[p.id]||[];
      const ready=all.filter(id=>R[id]);
      if(all.length&&ready.length===all.length){
        let es=null,ef=null,crit=false,slk=null;
        ready.forEach(id=>{const r=R[id];
          if(es===null||r.ES<es)es=r.ES;if(ef===null||r.EF>ef)ef=r.EF;
          if(r.critical)crit=true;if(slk===null||r.slack<slk)slk=r.slack;});
        R[p.id]={ES:clone(es),EF:clone(ef),dur:wdB(es,ef)+1,LS:clone(es),LF:clone(ef),
          slack:slk==null?0:slk,critical:crit,pkg:true};
      }else if(all.length){_rest.push(p);}
      else{R[p.id]={ES:clone(start),EF:clone(start),dur:0,LS:clone(start),LF:clone(start),slack:0,critical:false,pkg:true,empty:true};}
    });
    _pending=_rest;
  }
  if(hasCycle)warnings.push('تحذير: توجد تبعية دائرية — الجدولة غير دقيقة.');
  return {R,pStart:start,pEnd,hasCycle,warnings,totalWD:wdB(start,pEnd)+1};
}
// ===== المتابعة =====
function computeTracking(tasks,S,ddStr){
  const isWD=isWorkday;
  const addWD=(d,n)=>{d=new Date(d.getTime());while(!isWD(d))d.setDate(d.getDate()+1);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=new Date(a),e=new Date(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=new Date(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const dd=D(ddStr),T={};
  const _leafs=tasks.filter(t=>t.type!=='package');
  _leafs.forEach(t=>{const r=S.R[t.id];let blocked=false,co=false,ao=false;
    (t.requirements||[]).forEach(req=>{let st;
      if(req.received){st='received';if(req.requested){const due=addWD(D(req.requested),req.sla||0);if(D(req.received)>due)st='latejust';}}
      else if(req.requested){const due=addWD(D(req.requested),req.sla||0);if(dd>due){st='overdue';req._late=wdB(due,dd);}else st='pending';}
      else st='notrequested';req._state=st;
      const unmet=(st!=='received'&&st!=='latejust');if(req.blocking&&unmet)blocked=true;
      if(st==='overdue'&&req.blocking){if(req.owner==='client')co=true;else ao=true;}});
    let delay=null;if(t.status!=='done'){if(co)delay='client';else if(ao)delay='alamah';
      else if(!blocked&&r){if(t.status==='notstarted'&&dd>r.ES)delay='alamah';else if(t.status==='inprogress'&&dd>r.EF)delay='alamah';}}
    let eff=t.status;if(blocked&&t.status!=='done')eff='blocked';
    else if(t.status==='notstarted'&&r&&dd>=r.ES)eff='inprogress'; // بدء تلقائي عند حلول الموعد
    // التقدّم التلقائي: أيام العمل المنقضية من مدة البند (سقف 90% حتى الإنجاز اليدوي)
    let auto=0;
    if(t.status==='done')auto=100;
    else if(t.type!=='milestone'&&t.type!=='cont'&&r&&dd>r.ES){
      const tot=Math.max(1,wdB(r.ES,r.EF));
      auto=Math.min(90,Math.round(wdB(r.ES,(dd<r.EF?dd:r.EF))/tot*100));
      if(auto<0)auto=0;
    }
    const disp=t.status==='done'?100:Math.max(auto,t.progress||0);
    T[t.id]={blocked,delay,effStatus:eff,autoPct:auto,dispPct:disp};});
  // اشتقاق حالة/تقدّم الحزم من أبنائها (موزونًا بالمدد)
  const _kids={};tasks.forEach(t=>{if(t.parent)(_kids[t.parent]=_kids[t.parent]||[]).push(t);});
  let _pend=tasks.filter(t=>t.type==='package');let _g=0;
  while(_pend.length&&_g++<8){
    const _rest=[];
    _pend.forEach(p=>{
      const ch=_kids[p.id]||[];
      if(ch.length&&ch.every(c=>T[c.id])){
        let ws=0,acc=0,blocked=false,anyStart=false,allDone=true,dl=null;
        ch.forEach(c=>{const k=T[c.id];const w=Math.max(1,(S.R[c.id]&&S.R[c.id].dur)||c.duration||1);
          ws+=w;acc+=(k.dispPct||0)*w;
          if(k.blocked)blocked=true;
          if(k.effStatus==='inprogress'||k.effStatus==='done')anyStart=true;
          if(k.effStatus!=='done')allDone=false;
          if(k.delay==='client')dl='client';else if(k.delay&&dl!=='client')dl=k.delay;});
        const pct=ws?Math.round(acc/ws):0;
        const eff=allDone?'done':(blocked?'blocked':(anyStart?'inprogress':'notstarted'));
        T[p.id]={blocked,delay:dl,effStatus:eff,autoPct:pct,dispPct:pct,pkg:true};
      }else if(ch.length){_rest.push(p);}
      else{T[p.id]={blocked:false,delay:null,effStatus:'notstarted',autoPct:0,dispPct:0,pkg:true};}
    });
    _pend=_rest;
  }
  return T;
}


/* ===== api.js ===== */
// ===== المصادقة =====
async function loadIdentity(){
  const {data:{user}}=await sb.auth.getUser();USER=user;if(!user)return null;
  const {data:tm}=await sb.from('team_members').select('role,is_active,full_name').eq('id',user.id).maybeSingle();
  if(tm&&tm.is_active){ROLE=(tm.role==='admin')?'pmo':(tm.role==='manager'?'delivery':'client');USER._name=tm.full_name||user.email;
    try{const {data:own}=await sb.rpc('pmo_is_owner');IS_OWNER=(own===true);if(IS_OWNER)ROLE='pmo';}catch(e){IS_OWNER=false;}
    if(!IS_OWNER){try{MY_ACCESS=await fetchMyStaffAccess();}catch(e){MY_ACCESS=[];}}}
  else{
    // عميل: نتحقق من التصريح بالإيميل (دالة pmo_my_client_ids)
    const {data:ids}=await sb.rpc('pmo_my_client_ids');
    if(ids&&ids.length){ROLE='client';USER._name=user.email;}else ROLE=null;
  }
  return ROLE;
}
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(session){await loadIdentity();if(ROLE){return startApp();}else{return showDenied();}}
  showLogin();
}
function showLogin(){$('#login').classList.remove('hidden');$('#app').classList.add('hidden');$('#loader').classList.add('hidden');}
function showDenied(){showLogin();$('#denied').classList.remove('hidden');}
$('#googleBtn').onclick=async()=>{
  $('#loginErr').style.display='none';
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(error){$('#loginErr').textContent='تعذّر بدء الدخول';$('#loginErr').style.display='block';}
};
$('#signout').onclick=$('#signoutDenied').onclick=async()=>{await sb.auth.signOut();location.reload();};
$('#backPortfolio').onclick=async()=>{ await renderPortfolio(); $('#backPortfolio').style.display='none'; };


// ===== تحميل المشروع =====
async function loadClients(){
  const {data}=await sb.from('pmo_clients').select('*').order('created_at');
  CLIENTS=data||[];
  // فلترة وفق نطاق الصلاحية — فقط إن كان لهذا الموظف تخصيص فعلي (وإلا لا تغيير إطلاقًا)
  if(!IS_OWNER&&MY_ACCESS.length&&!hasCompanyScope()){
    const {data:projs}=await sb.from('pmo_projects').select('id,client_id,department');
    (projs||[]).forEach(p=>{PROJ_DEPTS[p.id]=p.department;});
    const okClientIds=new Set((projs||[]).filter(p=>canSeeProject(p.id,p.department,p.client_id)).map(p=>p.client_id));
    CLIENTS=CLIENTS.filter(c=>okClientIds.has(c.id));
  }
}
const PROJECT_CACHE={}; // تخزين مؤقت للمشاريع المحمّلة (يُبطل عند الكتابة)
async function loadProject(clientId, projectId){
  CID=clientId;
  let q=sb.from('pmo_projects').select('*').eq('client_id',clientId);
  if(projectId) q=q.eq('id',projectId);
  else q=q.eq('lifecycle_state','active').order('start_date').limit(1);
  const {data:projects}=await q;
  if(!projects||!projects.length){PROJECT=null;return;}
  // حارس دفاعي: حتى لو وصل رابط مباشر لمشروع خارج نطاق صلاحيته المخصَّصة، لا يُفتح
  if(!IS_OWNER&&MY_ACCESS.length&&!canSeeProject(projects[0].id,projects[0].department,projects[0].client_id)){
    PROJECT=null;PROJECT_ACCESS_DENIED=true;return;
  }
  PROJECT_ACCESS_DENIED=false;
  const p=projects[0];
  // tasks/deps/baseline/CRs تعتمد على project_id فقط → نطلبها بالتوازي
  const [tasksR,depsR,blR,crR,holR]=await Promise.all([
    sb.from('pmo_tasks').select('id,ref,wbs,name,track,type,duration,lag,fixed_date,owner,deliverable,status,progress,sort_order,parent_id').eq('project_id',p.id).order('sort_order'),
    sb.from('pmo_dependencies').select('id,task_id,depends_on_id,dep_type,lag').eq('project_id',p.id),
    sb.from('pmo_baselines').select('id,label,snapshot,approved_at').eq('project_id',p.id).order('approved_at',{ascending:true}),
    sb.from('pmo_change_requests').select('*').eq('project_id',p.id).order('created_at',{ascending:false}),
    sb.from('pmo_holidays').select('hdate,name').order('hdate')
  ]);
  const tasks=tasksR.data||[],deps=depsR.data||[],bl=blR.data||[];
  setHolidays(holR?holR.data:[]);
  window.HOLIDAY_NAMES={};(holR&&holR.data||[]).forEach(h=>{window.HOLIDAY_NAMES[h.hdate]=h.name;});
  CRS=crR.data||[];
  const ids=tasks.map(t=>t.id);let reqs=[];
  if(ids.length){const r=await sb.from('pmo_requirements').select('*').in('task_id',ids);reqs=r.data||[];}
  const refById={};tasks.forEach(t=>refById[t.id]=t.ref);
  const depMap={},depMapX={};
  deps.forEach(d=>{const rf=refById[d.depends_on_id];
    (depMap[d.task_id]=depMap[d.task_id]||[]).push(rf);
    (depMapX[d.task_id]=depMapX[d.task_id]||[]).push({_id:d.id,ref:rf,type:d.dep_type||'FS',lag:d.lag||0});});
  const reqMap={};reqs.forEach(r=>{(reqMap[r.task_id]=reqMap[r.task_id]||[]).push({_id:r.id,desc:r.description,owner:r.owner,sla:r.sla_days,blocking:r.blocking,requested:r.requested_at||'',received:r.received_at||''});});
  PROJECT={_dbId:p.id,name:p.name,start:p.start_date,status:p.status,lifecycle:p.lifecycle,contractValue:p.contract_value,
    baseline:(bl&&bl.length)?{snapshot:bl[bl.length-1].snapshot}:null,
    baselines:bl||[],
    tasks:(()=>{const _refOf={};tasks.forEach(x=>{_refOf[x.id]=x.ref;});
      return tasks.map(t=>({id:t.ref,_dbId:t.id,parent:t.parent_id?(_refOf[t.parent_id]||null):null,_sortOrder:t.sort_order,wbs:t.wbs,name:t.name,track:t.track,type:t.type,duration:t.duration,lag:t.lag,fixedDate:t.fixed_date||undefined,owner:t.owner,deliverable:t.deliverable,status:t.status,progress:t.progress,deps:depMap[t.id]||[],depsX:depMapX[t.id]||[],requirements:reqMap[t.id]||[]}));})()};
  PROJECT.tracks=(await sb.from('pmo_project_tracks').select('*').eq('project_id',p.id).order('sort')).data||[];
  // إصلاح ذاتي: مرحلة كل بند = مرجع أعلى سلف له في WBS الفعلي (عبر parent_id الحقيقي)،
  // لا القيمة المخزّنة في عمود track التي قد تكون انحرفت عن الهرمية الحقيقية (استيراد سابق قبل هذا الإصلاح،
  // تعديل يدوي، إلخ). هذا يصحّح فورًا أي مشروع قديم بلا أي هجرة بيانات.
  {const byRef={};PROJECT.tasks.forEach(t=>{byRef[t.id]=t;});
   PROJECT.tasks.forEach(t=>{t.track=taskTopAncestor(t,byRef);});}
  // شارات التبويبات: عدّ خفيف لا يجلب صفوفًا
  PROJECT.counts={cr:CRS.filter(x=>x.status==='pending').length,discuss:0,requests:0};
  try{Object.assign(PROJECT.counts,await fetchProjectCounts(p.id));}catch(e){}
}
function compute(){SCHED=scheduleTasks(PROJECT.tasks,PROJECT.start);TRACK=computeTracking(PROJECT.tasks,SCHED,DATA_DATE);}

// ===== التكامل: العملاء المحتملون (submissions) =====
// نجلب النماذج التي لم تُحوّل بعد لمشاريع (ليست مصدرًا لأي pmo_clients)
async function loadLeads(){
  const [subsR,clientsR]=await Promise.all([
    sb.from('submissions').select('id,company_name,contact_name,contact_email,contact_phone,status,submitted_at').order('submitted_at',{ascending:false}),
    sb.from('pmo_clients').select('submission_id')
  ]);
  const converted=new Set((clientsR.data||[]).map(c=>c.submission_id).filter(Boolean));
  return (subsR.data||[]).map(s=>({...s,_converted:converted.has(s.id)}));
}
async function convertLead(submissionId, projectName){
  const {data,error}=await sb.rpc('pmo_create_proposal',{p_submission_id:submissionId,p_project_name:projectName});
  if(error) throw error;
  return data;
}
async function loadAudit(projectId){
  const {data}=await sb.from('pmo_audit_log').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(60);
  return data||[];
}

// ===== تحرير الخطة (PMO) =====
async function addTask(projectId, fields){
  // sort_order = آخر ترتيب + 1
  const maxSort=Math.max(0,...PROJECT.tasks.map(t=>t._sortOrder||0));
  const row={project_id:projectId,ref:fields.ref,name:fields.name||'بند جديد',track:fields.track||'0',
    type:fields.type||'task',duration:fields.duration||1,sort_order:maxSort+1};
  if(fields.parent_id)row.parent_id=fields.parent_id;
  const {data,error}=await sb.from('pmo_tasks').insert(row).select().single();
  if(error) throw error;
  return data;
}
async function deleteTask(taskDbId){
  // التبعيات تُحذف تلقائيًا (cascade) أو نحذفها صراحة
  await sb.from('pmo_dependencies').delete().or(`task_id.eq.${taskDbId},depends_on_id.eq.${taskDbId}`);
  const {error}=await sb.from('pmo_tasks').delete().eq('id',taskDbId);
  if(error) throw error;
}
async function setDependencies(projectId, taskDbId, links){
  // links: [{db, type, lag}] أو مصفوفة dbIds (توافق خلفي)
  await sb.from('pmo_dependencies').delete().eq('task_id',taskDbId);
  const norm=(links||[]).map(l=>typeof l==='object'?l:{db:l,type:'FS',lag:0});
  if(norm.length){
    const rows=norm.map(l=>({project_id:projectId,task_id:taskDbId,depends_on_id:l.db,dep_type:l.type||'FS',lag:l.lag||0}));
    const {error}=await sb.from('pmo_dependencies').insert(rows);
    if(error) throw error;
  }
}

// ===== الاستيراد الجماعي (Excel) =====
// يمسح كل مهام/تبعيات المشروع (للاستبدال) — يُستخدم بحذر
async function clearProjectPlan(projectId){
  const {data:ts}=await sb.from('pmo_tasks').select('id').eq('project_id',projectId);
  const ids=(ts||[]).map(t=>t.id);
  if(ids.length){
    await sb.from('pmo_dependencies').delete().eq('project_id',projectId);
    await sb.from('pmo_tasks').delete().eq('project_id',projectId);
  }
}
// إدخال مهام دفعة واحدة؛ يُرجع خريطة ref → id
async function bulkInsertTasks(projectId, tasks){
  tasks.forEach((t,i)=>{t._ord=i+1;});
  const mk=t=>{const r={project_id:projectId,ref:t.ref,name:t.name||t.ref,
    track:t.track||'0',type:t.type||'task',duration:t.duration||0,
    deliverable:t.deliverable||null,owner:t.owner||null,sort_order:t._ord};
    return r;};
  const map={};
  let level=tasks.filter(t=>!t.parent), rest=tasks.filter(t=>t.parent), guard=0;
  while(level.length&&guard++<8){
    const rows=level.map(t=>{const r=mk(t);if(t.parent&&map[t.parent])r.parent_id=map[t.parent];return r;});
    const {data,error}=await sb.from('pmo_tasks').insert(rows).select('id,ref');
    if(error) throw error;
    (data||[]).forEach(r=>{map[r.ref]=r.id;});
    level=rest.filter(t=>map[t.parent]); rest=rest.filter(t=>!map[t.parent]);
  }
  if(rest.length){ // آباء مفقودون من الملف — تُدرج كمستوى أعلى بأمان
    const rows=rest.map(mk);
    const {data,error}=await sb.from('pmo_tasks').insert(rows).select('id,ref');
    if(error) throw error;(data||[]).forEach(r=>{map[r.ref]=r.id;});
  }
  return map;
}
// إدخال تبعيات دفعة واحدة (تأخذ خريطة ref→id)
async function bulkInsertDeps(projectId, depPairs, refToId){
  const rows=[];
  depPairs.forEach(([taskRef,depRef])=>{
    if(refToId[taskRef]&&refToId[depRef]) rows.push({project_id:projectId,task_id:refToId[taskRef],depends_on_id:refToId[depRef]});
  });
  if(rows.length){const {error}=await sb.from('pmo_dependencies').insert(rows);if(error) throw error;}
  return rows.length;
}
// مهام المشروع الحالية (للدمج)
async function fetchProjectTaskRefs(projectId){
  const {data}=await sb.from('pmo_tasks').select('id,ref').eq('project_id',projectId);
  return data||[];
}

// ===== عدّادات التبويبات (شارات) — استعلامات عدّ فقط بلا جلب صفوف =====
async function fetchProjectCounts(projectId){
  const [dis,req]=await Promise.all([
    sb.from('pmo_comments').select('id',{count:'exact',head:true}).eq('project_id',projectId).eq('resolved',false),
    sb.from('pmo_client_requests').select('id',{count:'exact',head:true}).eq('project_id',projectId).in('status',['new','in_progress'])
  ]);
  return {discuss:dis.count||0,requests:req.count||0};
}
// يُعاد حسابها بعد أي إجراء يغيّرها (تعليق، حلّ، طلب خدمة، قرار على طلب تعديل)
async function refreshProjectCounts(){
  if(!PROJECT||!PROJECT._dbId)return;
  try{
    const c=await fetchProjectCounts(PROJECT._dbId);
    PROJECT.counts=Object.assign({},PROJECT.counts,c,{cr:(CRS||[]).filter(x=>x.status==='pending').length});
  }catch(e){/* الشارات تحسينية — لا توقف الواجهة */}
}

// ===== النقاش (تعليقات/أسئلة/مقترحات) =====
async function loadComments(projectId){
  const {data}=await sb.from('pmo_comments').select('*').eq('project_id',projectId).order('created_at');
  return data||[];
}
async function addComment(projectId, kind, body, parentId, taskId){
  const row={project_id:projectId,kind,body,parent_id:parentId||null,task_id:taskId||null,
    author_id:USER.id,author_email:USER._name||USER.email,author_role:ROLE};
  const {error}=await sb.from('pmo_comments').insert(row);
  if(error) throw error;
}
// نقاش بند بعينه + سجله — لطبقة «لوحة البند»
async function loadTaskThread(projectId, taskDbId){
  const [cm,au]=await Promise.all([
    sb.from('pmo_comments').select('*').eq('project_id',projectId).eq('task_id',taskDbId).order('created_at'),
    sb.from('pmo_audit_log').select('*').eq('entity','task').eq('entity_id',taskDbId).order('created_at',{ascending:false}).limit(40)
  ]);
  return {comments:cm.data||[],audit:au.data||[]};
}
async function resolveComment(commentId, resolved){
  await sb.from('pmo_comments').update({resolved}).eq('id',commentId);
}
async function deleteComment(commentId){
  const {error}=await sb.from('pmo_comments').delete().eq('id',commentId);
  if(error) throw error;
}

// ===== طلبات العميل الموجّهة للأقسام (المرحلة 3) =====
async function loadClientRequests(projectId){
  const {data}=await sb.from('pmo_client_requests').select('*').eq('project_id',projectId).order('created_at',{ascending:false});
  return data||[];
}
async function addClientRequest(projectId, title, body, department, priority){
  const row={project_id:projectId,title,body:body||null,department,priority:priority||'normal',
    created_by:USER.id,created_role:ROLE};
  const {error}=await sb.from('pmo_client_requests').insert(row);
  if(error) throw error;
}
async function updateClientRequest(id, patch){
  patch.updated_at=new Date().toISOString();
  const {error}=await sb.from('pmo_client_requests').update(patch).eq('id',id);
  if(error) throw error;
}
async function deleteClientRequest(id){
  const {error}=await sb.from('pmo_client_requests').delete().eq('id',id);
  if(error) throw error;
}

// ===== دوال بيانات معزولة (كانت متناثرة في app/views) =====
// المحفظة
async function fetchPortfolio(){ return await sb.rpc('pmo_portfolio'); }
// وصول العميل
async function fetchClientAccess(clientId){ return await sb.from('pmo_client_access').select('*').eq('client_id',clientId).order('created_at'); }
async function addClientAccess(clientId,email){ return await sb.from('pmo_client_access').insert({client_id:clientId,email}); }
async function removeClientAccess(id){ return await sb.from('pmo_client_access').delete().eq('id',id); }
// اعتماد العقد
async function rpcApproveContract(projectId,value,snapshot){ return await sb.rpc('pmo_approve_contract',{p_project_id:projectId,p_contract_value:value,p_snapshot:snapshot}); }
// طلبات التغيير
async function fetchCRs(projectId){ return (await sb.from('pmo_change_requests').select('*').eq('project_id',projectId).order('created_at',{ascending:false})).data||[]; }
async function insertCR(row){ return await sb.from('pmo_change_requests').insert(row); }
async function decideCR(id,patch){ return await sb.from('pmo_change_requests').update(patch).eq('id',id); }
// البنود
async function updateTaskFields(taskDbId,patch){ return await sb.from('pmo_tasks').update(patch).eq('id',taskDbId); }
// المتطلبات
async function updateRequirement(id,patch){ return await sb.from('pmo_requirements').update(patch).eq('id',id); }
async function deleteRequirement(id){ return await sb.from('pmo_requirements').delete().eq('id',id); }
async function insertRequirement(row){ return await sb.from('pmo_requirements').insert(row).select().single(); }

// ===== طبقة القرار (DOL) — دوال البيانات =====
async function fetchDecisions(){ return (await sb.from('pmo_v2_decisions').select('*').order('created_at')).data||[]; }
async function fetchDecisionProjects(){ return (await sb.from('pmo_v2_decision_projects').select('*')).data||[]; }
async function insertDecision(row){ return await sb.from('pmo_v2_decisions').insert(row).select().single(); }
async function updateDecision(id,patch){ return await sb.from('pmo_v2_decisions').update(patch).eq('id',id); }
async function deleteDecision(id){ return await sb.from('pmo_v2_decisions').delete().eq('id',id); }
async function linkDecisionProject(decisionId,projectId){ return await sb.from('pmo_v2_decision_projects').insert({decision_id:decisionId,project_id:projectId}); }
async function evaluateDecision(gateId,values){ return await sb.rpc('pmo_v2_evaluate_decision',{p_gate_id:gateId,p_values:values}); }
async function fetchDeviations(decisionId){ return (await sb.from('pmo_v2_deviations').select('*').eq('decision_id',decisionId)).data||[]; }
async function insertDeviation(row){ return await sb.from('pmo_v2_deviations').insert(row); }
async function fetchDecisionLinks(decisionId){ return (await sb.from('pmo_v2_decision_links').select('*').eq('decision_id',decisionId)).data||[]; }
async function insertDecisionLink(row){ return await sb.from('pmo_v2_decision_links').insert(row); }

// ===== دورة حياة العميل + المالك + سجل التدقيق (المرحلة 1) =====
async function rpcArchiveClient(clientId){ return await sb.rpc('pmo_archive_client',{p_client:clientId}); }
async function rpcRestoreClient(clientId){ return await sb.rpc('pmo_restore_client',{p_client:clientId}); }
async function rpcRequestDeletion(clientId){ return await sb.rpc('pmo_request_deletion',{p_client:clientId}); }
async function rpcPurgeClient(clientId){ return await sb.rpc('pmo_purge_client',{p_client:clientId}); }
async function checkIsOwner(){ const {data}=await sb.rpc('pmo_is_owner'); return data===true; }
// عملاء حسب الحالة (نشط/مؤرشف/بانتظار حذف)
async function fetchClientsByState(state){ return (await sb.from('pmo_clients').select('*').eq('lifecycle_state',state).order('name')).data||[]; }
// سجل التدقيق على مستوى المكتب (كل المشاريع) أو لمشروع
async function fetchAuditLog(limit, projectId){
  let q=sb.from('pmo_audit_log').select('*').order('created_at',{ascending:false}).limit(limit||100);
  if(projectId) q=q.eq('project_id',projectId);
  return (await q).data||[];
}

// ===== جانت المحفظة (المرحلة 4) =====
// ملخّص زمني لكل المشاريع
async function fetchPortfolioTimeline(){ return (await sb.rpc('pmo_portfolio_timeline')).data||[]; }
// مهام خفيفة لكل المشاريع المعطاة (لحساب CPM في الواجهة)
async function fetchAllProjectsTasks(projectIds){
  if(!projectIds.length) return {tasks:[],deps:[],tracks:[]};
  const [tasksR,depsR,tracksR]=await Promise.all([
    sb.from('pmo_tasks').select('id,ref,name,track,type,duration,status,sort_order,project_id,parent_id').in('project_id',projectIds),
    sb.from('pmo_dependencies').select('task_id,depends_on_id,project_id').in('project_id',projectIds),
    sb.from('pmo_project_tracks').select('project_id,key,name,color').in('project_id',projectIds)
  ]);
  return {tasks:tasksR.data||[],deps:depsR.data||[],tracks:tracksR.data||[]};
}

// ===== تعديل تاريخ بدء المشروع (المصدر الوحيد للحقيقة) =====
async function updateProjectStart(projectId, newDate){
  const {error}=await sb.from('pmo_projects').update({start_date:newDate}).eq('id',projectId);
  if(error) throw error;
}

// ===== إدارة العملاء والمشاريع من الواجهة (سدّ فجوات الرحلة) =====
async function updateClientInfo(id, patch){
  const {error}=await sb.from('pmo_clients').update(patch).eq('id',id);
  if(error) throw error;
}
async function insertClient(name, color){
  const slug='c-'+Date.now().toString(36);
  const {data,error}=await sb.from('pmo_clients')
    .insert({name,color:color||'#C8A06B',slug,lifecycle_state:'active'}).select().single();
  if(error) throw error; return data;
}
async function insertProjectForClient(clientId, name, startDate){
  const {data,error}=await sb.from('pmo_projects')
    .insert({client_id:clientId,name,start_date:startDate,status:'draft',lifecycle:'proposal'})
    .select().single();
  if(error) throw error; return data;
}

// ===== دورة حياة المشروع + المراحل الديناميكية =====
async function rpcArchiveProject(id){return await sb.rpc('pmo_archive_project',{p_project:id});}
async function rpcRestoreProject(id){return await sb.rpc('pmo_restore_project',{p_project:id});}
async function rpcRequestProjectDeletion(id){return await sb.rpc('pmo_request_project_deletion',{p_project:id});}
async function rpcPurgeProject(id){return await sb.rpc('pmo_purge_project',{p_project:id});}
async function renameProject(id,name){const{error}=await sb.from('pmo_projects').update({name}).eq('id',id);if(error)throw error;}
async function fetchArchivedProjects(){
  const{data}=await sb.from('pmo_projects').select('id,name,lifecycle_state,deletion_scheduled_at,client_id')
    .neq('lifecycle_state','active');return data||[];}
async function fetchTracks(projectId){const{data}=await sb.from('pmo_project_tracks').select('*').eq('project_id',projectId).order('sort');return data||[];}
async function addTrack(projectId,key,name,color,sort){const{error}=await sb.from('pmo_project_tracks').insert({project_id:projectId,key,name,color,sort});if(error)throw error;}
async function updateTrack(id,patch){const{error}=await sb.from('pmo_project_tracks').update(patch).eq('id',id);if(error)throw error;}
async function deleteTrack(id){const{error}=await sb.from('pmo_project_tracks').delete().eq('id',id);if(error)throw error;}
async function reorderTracks(rows){
  // rows: [{id,sort}, ...] — تحديثات مستقلة فلا حاجة لدالة قاعدة خاصة
  for(const r of rows){const{error}=await sb.from('pmo_project_tracks').update({sort:r.sort}).eq('id',r.id);if(error)throw error;}
}
// استيراد Excel: مراحل مكتشفة من WBS تُدرج أو تُحدَّث بمفتاحها — لا تُكرَّر عبر استيرادات متتالية.
// mode='replace': يحذف المراحل غير الواردة في الملف الجديد (استبدال كامل حقيقي).
// mode='merge': يبقي كل مرحلة موجودة غير مذكورة، ويحدّث تقاطع المفاتيح فقط.
async function upsertProjectTracks(projectId, phases, mode){
  const existing=await fetchTracks(projectId);
  const byKey={};existing.forEach(t=>{byKey[t.key]=t;});
  let base=existing.length;
  for(const ph of phases){
    const cur=byKey[ph.key];
    if(cur){ await updateTrack(cur.id,{name:ph.name}); } // اللون اليدوي المضبوط سابقًا لا يُستبدل صامتًا
    else{ await addTrack(projectId, ph.key, ph.name, ph.color, ++base); }
  }
  if(mode==='replace'){
    const incoming=new Set(phases.map(p=>p.key));
    for(const t of existing){ if(!incoming.has(t.key)) await deleteTrack(t.id); }
  }
}

// ===== التحميل الكسول للوحدات الثقيلة (أداء) =====
const _lazy={};
function loadScript(src){
  return _lazy[src]||(_lazy[src]=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=src;
    s.onload=()=>res();s.onerror=()=>{delete _lazy[src];rej(new Error('load fail: '+src));};
    document.head.appendChild(s);
  }));
}
async function ensureXLSX(){
  if(window.XLSX)return;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
}
// مغلّفات: تُحمّل الوحدة عند أول استخدام فقط ثم تنفّذ
async function openDOL(){
  try{await loadScript('dol.js?v='+BUILD_V);await window.dolOpen();}
  catch(e){toast('تعذّر تحميل طبقة القرار — تحقق من الاتصال','err');}
}
async function openImporter(){
  const l=$('#loader');
  try{
    if(l)l.classList.remove('hidden');
    await Promise.all([loadScript('importer.js?v='+BUILD_V),ensureXLSX()]);
    if(l)l.classList.add('hidden');
    window.importerOpen();
  }catch(e){if(l)l.classList.add('hidden');toast('تعذّر تحميل أداة الاستيراد — تحقق من الاتصال','err');}
}
async function renderPortfolioGantt(clientId,mountId){
  try{await loadScript('pgantt.js?v='+BUILD_V);await window.pganttOpen(clientId,mountId);}
  catch(e){toast('تعذّر تحميل الخط الزمني الشامل','err');}
}

// ===== التعافي: لقطات الخطة والاسترجاع =====
function _planPayload(){
  return {tasks:PROJECT.tasks.map(t=>({ref:t.id,name:t.name,track:t.track,type:t.type,
    duration:t.duration||0,deliverable:t.deliverable||null,owner:t.owner||null,
    status:t.status,progress:t.progress||0,parent:t.parent||null,deps:(t.deps||[]).slice(),
    requirements:(t.requirements||[]).map(q=>({description:q.desc,owner:q.owner,sla_days:q.sla,
      blocking:q.blocking,requested_at:q.requested||null,received_at:q.received||null}))}))};
}
async function savePlanSnapshot(projectId,reason){
  const {error}=await sb.from('pmo_plan_snapshots')
    .insert({project_id:projectId,reason,payload:_planPayload(),created_by:USER?USER.id:null});
  if(error)throw error;
  const {data}=await sb.from('pmo_plan_snapshots').select('id').eq('project_id',projectId)
    .order('created_at',{ascending:false});
  const extra=(data||[]).slice(5).map(r=>r.id);
  if(extra.length)await sb.from('pmo_plan_snapshots').delete().in('id',extra);
}
async function fetchLatestSnapshot(projectId){
  const {data}=await sb.from('pmo_plan_snapshots').select('*').eq('project_id',projectId)
    .order('created_at',{ascending:false}).limit(1);
  return (data&&data[0])||null;
}
async function restorePlanSnapshot(projectId,snap){
  await clearProjectPlan(projectId);
  const tasks=(snap.payload&&snap.payload.tasks)||[];
  const map=await bulkInsertTasks(projectId,tasks.map(t=>({ref:t.ref,name:t.name,track:t.track,
    type:t.type,duration:t.duration,deliverable:t.deliverable,owner:t.owner,parent:t.parent})));
  for(const t of tasks){
    if((t.status&&t.status!=='notstarted')||t.progress){
      await sb.from('pmo_tasks').update({status:t.status||'notstarted',progress:t.progress||0}).eq('id',map[t.ref]);
    }
  }
  const pairs=[];tasks.forEach(t=>(t.deps||[]).forEach(d=>pairs.push([t.ref,d])));
  await bulkInsertDeps(projectId,pairs,map);
  const reqRows=[];tasks.forEach(t=>(t.requirements||[]).forEach(q=>{
    if(map[t.ref])reqRows.push({task_id:map[t.ref],description:q.description,owner:q.owner,
      sla_days:q.sla_days,blocking:q.blocking,requested_at:q.requested_at,received_at:q.received_at});}));
  if(reqRows.length)await sb.from('pmo_requirements').insert(reqRows);
}

// ===== خط التسليمات =====
async function fetchDeliveries(projectId){
  const {data}=await sb.from('pmo_deliveries').select('*').eq('project_id',projectId).order('event_date');
  return data||[];
}
async function fetchAllDeliveries(){
  const {data}=await sb.from('pmo_deliveries').select('*').order('event_date');
  return data||[];
}
async function addDelivery(row){
  const r={...row,created_by:USER?USER.id:null};
  const {data,error}=await sb.from('pmo_deliveries').insert(r).select().single();
  if(error)throw error;return data;
}
async function updateDelivery(id,patch){const {error}=await sb.from('pmo_deliveries').update(patch).eq('id',id);if(error)throw error;}
async function deleteDelivery(id){const {error}=await sb.from('pmo_deliveries').delete().eq('id',id);if(error)throw error;}
// مغلّفات كسولة
async function openTimeline(hostId,projectId){
  try{await loadScript('timeline.js?v='+BUILD_V);await window.timelineRender(hostId,projectId);}
  catch(e){const h=document.getElementById(hostId);if(h)h.innerHTML='<p class="pempty">تعذّر تحميل خط التسليمات</p>';}
}
async function openTimelinePortfolio(hostId){
  try{await loadScript('timeline.js?v='+BUILD_V);await window.timelinePortfolio(hostId);}
  catch(e){const h=document.getElementById(hostId);if(h)h.innerHTML='<p class="pempty">تعذّر التحميل</p>';}
}

// ===== حفظ أساس جديد (v2, v3...) من الجدولة الحالية =====
async function saveNewBaseline(projectId){
  const snap={};PROJECT.tasks.forEach(t=>{const r=SCHED.R[t.id];if(r&&t.type!=='cont')snap[t.id]={ES:isoLocal(r.ES),EF:isoLocal(r.EF)};});
  const n=(PROJECT.baselines||[]).length+1;
  const {data,error}=await sb.from('pmo_baselines')
    .insert({project_id:projectId,snapshot:snap,start_date:PROJECT.start,approved_by:USER?USER.id:null,label:'الأساس '+n})
    .select('id,label,snapshot,approved_at').single();
  if(error)throw error;
  PROJECT.baselines=(PROJECT.baselines||[]).concat([data]);
  return data;
}
// ===== العطلات =====
async function fetchHolidays(){const {data}=await sb.from('pmo_holidays').select('*').order('hdate');return data||[];}
async function addHolidayRow(hdate,name){const {error}=await sb.from('pmo_holidays').insert({hdate,name});if(error)throw error;}
async function delHolidayRow(id){const {error}=await sb.from('pmo_holidays').delete().eq('id',id);if(error)throw error;}
// ===== الفريق والإسناد (داخلي — لا يراه العميل) =====
async function fetchTeamMembers(){const {data}=await sb.from('team_members').select('id,full_name,email,role').eq('is_active',true).order('full_name');return data||[];}

// ===== صلاحيات الفريق (شركة/قسم/مشروع × عرض/تعديل) — مالك النظام فقط يديرها =====
const DEPTS={marketing:'علامة ماركتنج',tech:'علامة تقني',consulting:'علامة استشارات'};
async function fetchAllStaffAccess(){
  const {data,error}=await sb.from('pmo_staff_access').select('*').order('granted_at',{ascending:false});
  if(error)throw error;return data||[];
}
async function grantStaffAccess(memberId,scopeType,scopeValue,level){
  const {error}=await sb.from('pmo_staff_access').upsert(
    {member_id:memberId,scope_type:scopeType,scope_value:scopeValue,access_level:level,granted_by:USER.id},
    {onConflict:'member_id,scope_type,scope_value'});
  if(error)throw error;
}
async function revokeStaffAccess(id){const {error}=await sb.from('pmo_staff_access').delete().eq('id',id);if(error)throw error;}
// صلاحيات المستخدم الحالي نفسه — تُحمَّل عند الدخول لتصفية المحفظة لغير المالك
async function fetchMyStaffAccess(){
  if(!USER||!USER.id)return [];
  const {data}=await sb.from('pmo_staff_access').select('*').eq('member_id',USER.id);
  return data||[];
}
async function setProjectDepartment(projectId,dept){const {error}=await sb.from('pmo_projects').update({department:dept||null}).eq('id',projectId);if(error)throw error;}
async function addTeamMember(email,fullName,role){
  const {data,error}=await sb.rpc('pmo_add_team_member',{p_email:email,p_full_name:fullName,p_role:role});
  if(error)throw error;
  return data;
}
async function fetchProjectStaff(projectId){const {data}=await sb.from('pmo_project_staff').select('member_id').eq('project_id',projectId);return (data||[]).map(r=>r.member_id);}
async function saveProjectStaff(projectId,memberIds){
  await sb.from('pmo_project_staff').delete().eq('project_id',projectId);
  if(memberIds.length){
    const rows=memberIds.map(m=>({project_id:projectId,member_id:m}));
    const {error}=await sb.from('pmo_project_staff').insert(rows);if(error)throw error;
  }
}

// ===== تكامل Trello (كسول) =====
async function openTrello(mode){
  try{await loadScript('trello.js?v='+BUILD_V);await window.trelloMenu(mode);}
  catch(e){toast('تعذّر تحميل وحدة Trello','err');}
}


/* ===== views.js ===== */
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
  const C=(PROJECT&&PROJECT.counts)||{};
  // شارة العدّ: تُعرض فقط حين يوجد ما ينتظر — لا أصفار تشوّش
  const badge=v=>{const n=C[v]||0;return n?`<span class="tabn" aria-label="${n} بانتظار المتابعة">${n}</span>`:'';};
  $('#tabs').setAttribute('role','tablist');
  $('#tabs').innerHTML=views.map(v=>`<button class="tab ${v===VIEW?'active':''} ${VIEW_TONE[v]?'tab-'+VIEW_TONE[v]:''}" role="tab" id="tab-${v}" aria-controls="host" aria-selected="${v===VIEW}" tabindex="${v===VIEW?0:-1}" data-v="${v}">${VIEW_ICONS[v]||''}<span>${VIEW_LABELS[v]}</span>${badge(v)}</button>`).join('');
  const _hp=$('#host');if(_hp){_hp.setAttribute('role','tabpanel');_hp.setAttribute('aria-labelledby','tab-'+VIEW);}
  $$('#tabs .tab').forEach(b=>b.onclick=()=>setView(b.dataset.v));
  // تنقّل الأسهم وفق WAI-ARIA (بمراعاة RTL: اليسار = التالي) + Home/End
  $('#tabs').onkeydown=e=>{
    const i=views.indexOf(VIEW);let j=null;
    if(e.key==='ArrowLeft')j=(i+1)%views.length;
    else if(e.key==='ArrowRight')j=(i-1+views.length)%views.length;
    else if(e.key==='Home')j=0;else if(e.key==='End')j=views.length-1;
    if(j===null)return;
    e.preventDefault();setView(views[j]);
    const nb=document.querySelector('#tabs .tab[data-v="'+views[j]+'"]');if(nb)nb.focus();
  };
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
  if(VIEW==='dashboard'){host.innerHTML=(ROLE==='client')?vClientDash():vDashboard();
    $$('#host [data-tkopen]').forEach(b=>b.onclick=()=>openTaskPanel(b.dataset.tkopen));}
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
    $$('#host .glbl[data-tkopen]').forEach(el=>{
      el.onclick=()=>openTaskPanel(el.dataset.tkopen);
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTaskPanel(el.dataset.tkopen);}};});
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
  const alerts=[];creqs.filter(x=>x.r._state==='overdue').forEach(x=>alerts.push(['client','متطلب متأخر من العميل: '+x.r.desc+' ('+x.t.id+')'+(x.r._late?' +'+x.r._late+'ي':''),x.t.id]));
  tasks.filter(t=>T[t.id].delay==='alamah').forEach(t=>alerts.push(['alamah','تأخير على فريق علامة: '+t.id+' — '+t.name,t.id]));
  tasks.filter(t=>T[t.id].blocked).forEach(t=>alerts.push(['blocked','بند متوقف: '+t.id+' — '+t.name,t.id]));
  const tl=t=>`<li><button class="tlink" data-tkopen="${esc(t.id)}"><span class="tgw" style="--tc:${trackMeta(t.track).color}">${esc(t.id)}</span> ${esc(t.name)} <em>${fmt(S.R[t.id].ES)}–${fmt(S.R[t.id].EF)}</em> <span class="ministat s-${T[t.id].effStatus}">${STATUS[T[t.id].effStatus]}</span></button></li>`;
  const card=(l,v,c)=>`<div class="dcard ${c||''}"><b>${v}</b><span>${l}</span></div>`;
  let h=`<div class="dgrid">${card('نسبة الإنجاز',pct+'%','ok')}${card('مكتملة',done)}${card('جارية',inprog,'blue')}${card('متبقية',total-done)}${card('متوقفة',blocked,'crit')}${card('متطلبات مطلوبة',creqs.length,'warn')}</div>
  <div class="dprog"><div class="dprog-fill" style="width:${pct}%"></div></div>
  <div class="dcols">
    <div class="dbox"><h4>مهام اليوم (${today.length})</h4><ul class="tlist">${today.length?today.map(tl).join(''):'<li class="empty">لا مهام مجدولة لليوم.</li>'}</ul></div>
    <div class="dbox"><h4>مهام هذا الأسبوع (${week.length})</h4><ul class="tlist">${week.length?week.map(tl).join(''):'<li class="empty">لا مهام هذا الأسبوع.</li>'}</ul></div>
  </div>
  <div class="dcols">
    <div class="dbox"><h4>المتطلبات المطلوبة من العميل (${creqs.length})</h4><ul class="tlist">${creqs.length?creqs.map(x=>`<li><button class="tlink" data-tkopen="${esc(x.t.id)}"><span class="ministat s-${x.r._state==='overdue'?'blocked':'notstarted'}">${x.r._state==='overdue'?'متأخر':'بانتظار'}</span> ${esc(x.r.desc)} <em>SLA ${x.r.sla}ي · ${esc(x.t.id)}</em></button></li>`).join(''):'<li class="empty">لا متطلبات معلّقة.</li>'}</ul></div>
    <div class="dbox"><h4>المعالم القادمة</h4><ul class="tlist">${miles.length?miles.map(m=>`<li><button class="tlink" data-tkopen="${esc(m.t.id)}"><span class="md">◆</span> ${esc(m.t.name.replace('معلم: ',''))} <em>${fmt(m.ef)}</em></button></li>`).join(''):'<li class="empty">—</li>'}</ul></div>
  </div>
  <div class="dbox alerts"><h4>التنبيهات (${alerts.length})</h4><ul class="tlist">${alerts.length?alerts.map(a=>`<li class="alert a-${a[0]}">${a[2]?`<button class="tlink" data-tkopen="${esc(a[2])}">⚠ ${esc(a[1])}</button>`:('⚠ '+esc(a[1]))}</li>`).join(''):'<li class="empty">لا تنبيهات.</li>'}</ul></div>`;
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
      <td><button class="idcell idbtn" data-tkopen="${esc(t.id)}" title="فتح لوحة البند" style="--tc:${tc}">${esc(t.id)}${r.critical?'<span class="critdot"></span>':''}</button></td>
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
        <button class="reqbtn" data-tkopen="${esc(t.id)}">⛶ لوحة البند</button>
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
  $$('#host [data-tkopen]').forEach(b=>b.onclick=()=>openTaskPanel(b.dataset.tkopen));
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
    const slackTip=t.type==='milestone'?'':(r.critical?' | حرج — لا فائض زمني'
      :(r.slack!=null&&r.slack>0?` | فائض ${r.slack} يوم عمل قبل أن يؤثّر على تاريخ التسليم`:''));
    const tip=`${esc(t.name)} — ${fmt(r.ES)}–${fmt(r.EF)} | ${STATUS[k.effStatus]}${overdue?` | متأخر ${lateDays} يوم عمل`:''}${slackTip}`;
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
    rows+=`<div class="grow" data-grow="${esc(t.id)}"><div class="glbl ${t.parent?'gchild':''}" role="button" tabindex="0" data-tkopen="${esc(t.id)}" aria-label="لوحة البند ${esc(t.id)} — ${esc(t.name)}"><span class="sdot ${k.effStatus}"></span><span class="gw" style="--tc:${tc}">${esc(t.wbs||t.id)}</span>${esc(t.name)}</div><div class="glane">${lane}</div></div>`;});
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
  const bars={};const rowOrder={};let _ri=0;
  canvas.querySelectorAll('[data-gid]').forEach(b=>{bars[b.dataset.gid]=b;if(!(b.dataset.gid in rowOrder))rowOrder[b.dataset.gid]=_ri++;});
  const cr=canvas.getBoundingClientRect();
  let paths='';
  // قاعدة احترافية ثابتة في كل أدوات الجدولة: حزمة العمل بار تجميعي مشتق من أبنائها —
  // رسم سهم تبعية عليها مضلِّل دائمًا. مؤكَّد ببياناتك الفعلية (25% من الروابط كانت تكرارًا).
  const pkgSet=new Set(PROJECT.tasks.filter(t=>t.type==='package').map(t=>t.id));
  const links=[];
  PROJECT.tasks.forEach(t=>{
    if(pkgSet.has(t.id))return;
    ((t.depsX&&t.depsX.length)?t.depsX:(t.deps||[])).forEach(d=>{
      const ref=d.ref||d;
      if(pkgSet.has(ref))return;
      const A=bars[ref],B=bars[t.id];if(!A||!B)return;
      links.push({ref,to:t.id,type:d.type||'FS',A,B});
    });
  });
  // ترتيب الصفوف الرأسي لكل رابط — نستخدمه لتحديد تداخل «فترته» الرأسية مع روابط أخرى
  links.forEach(l=>{const ra=(rowOrder[l.ref]||0),rb=(rowOrder[l.to]||0);l._lo=Math.min(ra,rb);l._hi=Math.max(ra,rb);});
  // تلوين فترات (Interval Graph Coloring): روابط تتقاطع رأسيًا تأخذ ممرات (Lanes) مختلفة؛
  // روابط لا تتقاطع تتشارك نفس الممر — فتبقى قريبة من الأشرطة حين لا تزاحم، وتتفرّق فقط
  // حين تتزامن فعلًا. هذا يستبدل التفريق بمسافة مسقوفة كانت تُصادم الروابط بعيدة المدى ببعضها.
  links.sort((a,b)=>a._lo-b._lo||(b._hi-b._lo)-(a._hi-a._lo));
  const laneEnd=[];
  links.forEach(l=>{
    let lane=laneEnd.findIndex(end=>end<l._lo);
    if(lane===-1){lane=laneEnd.length;laneEnd.push(l._hi);}else{laneEnd[lane]=l._hi;}
    l._lane=lane;
  });
  links.forEach(({ref,to,type:dtype,A,B,_lane})=>{
    const ra=A.getBoundingClientRect(),rb=B.getBoundingClientRect();
    const x1=(dtype==='SS'?ra.right:ra.left)-cr.left, y1=ra.top-cr.top+ra.height/2;
    const x2=(dtype==='FF'?rb.left:rb.right)-cr.left, y2=rb.top-cr.top+rb.height/2;
    const crit=A.classList.contains('crit')&&B.classList.contains('crit');
    const bend=Math.min(x1,x2)-9-_lane*7;
    paths+=`<path d="M ${x1} ${y1} L ${bend} ${y1} L ${bend} ${y2} L ${x2-1} ${y2}" class="glink ${crit?'crit':''} lt-${dtype}" marker-end="url(#${crit?'garrc':'garr'})" data-lfrom="${esc(ref)}" data-lto="${esc(to)}"/>`;
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
    else if(a.action==='client_request_status'&&nv){const R=REQ_STATUS_AR||{};detail=`${R[(ov||{}).status]||(ov&&ov.status)||'—'} ← ${R[nv.status]||nv.status||'—'}`;}
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
    // تعليق مرتبط ببند: يظهر هنا أيضًا مع إشارة وانتقال — لا يختفي في لوحة البند
    const tk=c.task_id?PROJECT.tasks.find(t=>t._dbId===c.task_id):null;
    const tkChip=tk?`<button class="lnk" data-gotask="${esc(tk.id)}" style="font-size:.7rem">↗ على البند ${esc(tk.id)}</button>`:'';
    return `<div class="crcard" style="${isReply?'margin-inline-start:28px;border-inline-start:3px solid var(--line)':''}">
      <div class="crhd">
        <span><span class="crstate" style="background:color-mix(in srgb,${KCLR[c.kind]} 14%,#fff);color:${KCLR[c.kind]};font-size:.7rem">${KIND[c.kind]}</span>
          <b style="font-size:.82rem;margin-inline-start:6px">${esc(c.author_email||'—')}</b>
          <span style="font-size:.7rem;color:var(--muted)">· ${ROLE_AR[c.author_role]||''}</span></span>
        <span style="display:flex;gap:8px;align-items:center">${resBadge}<small style="color:var(--muted)">${when}</small></span>
      </div>
      <div class="crbody">${esc(c.body)}${tkChip?'<br>'+tkChip:''}</div>
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
  document.querySelectorAll('[data-gotask]').forEach(b=>b.onclick=()=>gotoTask(b.dataset.gotask));
  const send=document.getElementById('dcSend');
  if(send)send.onclick=async()=>{
    const body=document.getElementById('dcBody').value.trim();if(!body){toast('اكتب رسالة','warn');return;}
    try{ await addComment(PROJECT._dbId, document.getElementById('dcKind').value, body, null); toast('أُرسلت','ok'); await refreshProjectCounts(); render(); }
    catch(e){ toast('تعذّر الإرسال: '+e.message,'err'); }
  };
  document.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{
    const box=document.getElementById('replyBox-'+b.dataset.reply);
    if(box.innerHTML){box.innerHTML='';return;}
    box.innerHTML=`<div style="display:flex;gap:6px;margin-top:8px"><input id="rin-${b.dataset.reply}" placeholder="ردك..." style="flex:1;border:1.5px solid var(--line);border-radius:7px;padding:7px;font-family:inherit;font-size:.82rem"><button class="reqbtn" data-sendreply="${b.dataset.reply}" style="background:var(--gold);border-color:var(--gold);color:#fff">رد</button></div>`;
    box.querySelector('[data-sendreply]').onclick=async()=>{
      const v=document.getElementById('rin-'+b.dataset.reply).value.trim();if(!v){return;}
      try{ await addComment(PROJECT._dbId,'comment',v,b.dataset.reply); toast('أُرسل الرد','ok'); await refreshProjectCounts(); render(); }
      catch(e){ toast('تعذّر: '+e.message,'err'); }
    };
  });
  document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{
    try{ await resolveComment(b.dataset.resolve, b.dataset.cur!=='1'); await refreshProjectCounts(); render(); }
    catch(e){ toast('تعذّر: '+e.message,'err'); }
  });
  document.querySelectorAll('[data-delc]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف التعليق','حذف هذا التعليق؟ لا يمكن التراجع.',true))return;
    try{ await deleteComment(b.dataset.delc); toast('حُذف','ok'); await refreshProjectCounts(); render(); }
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
    try{ await addClientRequest(PROJECT._dbId,title,body,dept,prio); toast('أُرسل الطلب','ok'); await refreshProjectCounts(); render(); }
    catch(e){ toast('تعذّر الإرسال: '+e.message,'err'); }
  };
  document.querySelectorAll('[data-setstatus]').forEach(b=>b.onclick=async()=>{
    try{ await updateClientRequest(b.dataset.setstatus,{status:b.dataset.s}); await refreshProjectCounts(); render(); }
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


/* ===== taskpanel.js ===== */
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


/* ===== state.js ===== */
// ===== app/state.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
// ===== الحالة =====
let USER=null,ROLE=null,IS_OWNER=false,CLIENTS=[],CID=null,PID=null,PROJECT=null,SCHED=null,TRACK=null,DATA_DATE=todayISO(),PX=20,VIEW='dashboard',CRS=[],PFILTER='all',PSEARCH='',PEXPANDED=new Set(),PALERTS=new Set(),PSORT='alerts';
// نظام صلاحيات الفريق: MY_ACCESS=صلاحيات المستخدم الحالي المخصَّصة له (فارغة = لا قيود، كما كان دائمًا)
let MY_ACCESS=[],PROJ_DEPTS={},PROJECT_ACCESS_DENIED=false;
try{const sv=JSON.parse(localStorage.getItem('pmo_pfilters')||'{}');
  if(sv.PFILTER)PFILTER=sv.PFILTER; if(sv.PSORT)PSORT=sv.PSORT; if(Array.isArray(sv.PALERTS))PALERTS=new Set(sv.PALERTS);
}catch(e){}


/* ===== dialogs.js ===== */
// ===== app/dialogs.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
function dialog(opts){ // {title, message, fields:[{key,label,value,type,placeholder,options}], confirmText, danger}
  return new Promise(resolve=>{
    const ov=document.getElementById('dlgOverlay');
    const fieldsHtml=(opts.fields||[]).map(f=>{
      if(f.type==='select'){
        return `<label class="dlg-l">${esc(f.label)}<select class="dlg-i" data-k="${f.key}">${f.options.map(o=>`<option value="${o.v}" ${o.v===f.value?'selected':''}>${esc(o.t)}</option>`).join('')}</select></label>`;
      }
      if(f.type==='textarea'){
        return `<label class="dlg-l">${esc(f.label)}<textarea class="dlg-i" data-k="${f.key}" placeholder="${esc(f.placeholder||'')}">${esc(f.value||'')}</textarea></label>`;
      }
      return `<label class="dlg-l">${esc(f.label)}<input class="dlg-i" data-k="${f.key}" type="${f.type||'text'}" value="${esc(f.value||'')}" placeholder="${esc(f.placeholder||'')}"></label>`;
    }).join('');
    document.getElementById('dlgBox').innerHTML=`
      <div class="rqhd"><h3 style="font-size:1.02rem" id="dlgTitle">${esc(opts.title||'')}</h3><button id="dlgX" aria-label="إغلاق" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer">✕</button></div>
      <div style="padding:18px">
        ${opts.message?`<p style="font-size:.86rem;color:var(--muted);margin-bottom:14px;line-height:1.7;white-space:pre-line">${esc(opts.message)}</p>`:''}
        ${fieldsHtml}
        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-start">
          <button class="hbtn" id="dlgOk" style="background:${opts.danger?'var(--crit)':'var(--gold)'};border-color:${opts.danger?'var(--crit)':'var(--gold)'};padding:9px 20px">${esc(opts.confirmText||'تأكيد')}</button>
          <button class="hbtn" id="dlgCancel" style="background:#fff;color:var(--ink);border-color:var(--line);padding:9px 20px">إلغاء</button>
        </div>
      </div>`;
    const box=document.getElementById('dlgBox');
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','dlgTitle');
    ov.style.display='flex';
    const prevFocus=document.activeElement;
    const first=document.querySelector('#dlgBox .dlg-i')||document.getElementById('dlgOk');if(first)setTimeout(()=>first.focus(),50);
    const close=val=>{ov.style.display='none';document.removeEventListener('keydown',keyH,true);if(prevFocus&&prevFocus.focus)prevFocus.focus();resolve(val);};
    const collect=()=>{ if(!opts.fields||!opts.fields.length)return true; const o={}; document.querySelectorAll('#dlgBox .dlg-i').forEach(i=>o[i.dataset.k]=i.value.trim()); return o; };
    // لوحة المفاتيح: Escape يغلق، Tab محبوس داخل الحوار
    const keyH=e=>{
      if(e.key==='Escape'){e.preventDefault();close(null);return;}
      if(e.key==='Tab'){
        const f=[...box.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled);
        if(!f.length)return;
        const i=f.indexOf(document.activeElement);
        if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus();}
        else if(!e.shiftKey&&(i===f.length-1)){e.preventDefault();f[0].focus();}
      }
    };
    document.addEventListener('keydown',keyH,true);
    document.getElementById('dlgOk').onclick=()=>close(collect());
    document.getElementById('dlgCancel').onclick=()=>close(null);
    document.getElementById('dlgX').onclick=()=>close(null);
    ov.onclick=e=>{if(e.target.id==='dlgOverlay')close(null);};
    document.querySelectorAll('#dlgBox .dlg-i').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'&&i.tagName!=='TEXTAREA'){e.preventDefault();close(collect());}}));
  });
}

async function confirmDialog(title,message,danger){
  const r=await dialog({title,message,confirmText:danger?'حذف':'تأكيد',danger});
  return r!==null;
}


// ===== بدء التطبيق =====


/* ===== lifecycle.js ===== */
// ===== app/lifecycle.js — جزء من طبقة التطبيق (مقسّم من app.js) =====

// منفّذ موحّد لإجراءات دورة الحياة (أرشفة/حذف/استرجاع/حذف نهائي).
// كان النمط نفسه مكررًا 12 مرة: تأكيد → استدعاء RPC → قراءة data.ok → toast → تحديث.
// التوحيد يضمن أيضًا التقاط الأخطاء الشبكية التي كانت تمرّ صامتة في النسخ السابقة.
async function runLifecycleAction(o){
  if(o.title&&!await confirmDialog(o.title,o.message,!!o.danger))return false;
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

async function openProjectMenu(projectId, projectName){
  const r=await dialog({title:'إجراءات المشروع: '+(projectName||''),
    fields:[{key:'action',label:'الإجراء',type:'select',value:'rename',options:[
      {v:'rename',t:'إعادة تسمية المشروع'},
      {v:'restore_snap',t:'استرجاع نسخة أمان (ما قبل آخر استبدال)'},
      {v:'assign',t:'إسناد الفريق للمشروع'},
      {v:'trello',t:'لوحة Trello (تنفيذ الفريق)'},
      {v:'newbl',t:'حفظ أساس جديد (Baseline v'+(((PROJECT&&PROJECT.baselines)||[]).length+1)+')'},
      {v:'exportContract',t:'📄 تصدير للعقد (PDF)'},
      {v:'archive',t:'أرشفة المشروع'},
      {v:'delete',t:'طلب حذف المشروع (مهلة 30 يومًا)'}
    ]}],confirmText:'متابعة'});
  if(!r)return;
  if(r.action==='exportContract'){
    if(!PROJECT||PROJECT._dbId!==projectId){toast('افتح المشروع أولًا','warn');return;}
    return openContractExport();
  }
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
    await runLifecycleAction({
      title:'أرشفة المشروع',
      message:'أرشفة «'+(projectName||'')+'»؟ يختفي من المحفظة والخط الزمني، ويُسترجع من المؤرشفة.',
      rpc:()=>rpcArchiveProject(projectId),
      successMsg:'أُرشف المشروع',
      onSuccess:()=>{SCREEN='portfolio';renderPortfolio();}
    });
  }else if(r.action==='delete'){
    await runLifecycleAction({
      title:'طلب حذف المشروع',
      message:'سيبدأ عدّاد 30 يومًا لحذف «'+(projectName||'')+'» وكل بنوده. قابل للاسترجاع طوال المهلة، والحذف النهائي لمالك النظام.',
      danger:true,
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
      <button class="hbtn" id="trkSave" style="background:var(--gold);border-color:var(--gold)">حفظ التعديلات</button>
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
  if(!await confirmDialog('حذف مرحلة',msg,n>0))return;
  try{
    await deleteTrack(id);
    PROJECT.tracks=await fetchTracks(PROJECT._dbId);
    toast('حُذفت المرحلة','ok');
    renderTrkPanel();
    if(SCREEN==='project')render();
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
      danger:true,
      rpc:()=>rpcRequestDeletion(clientId),
      successMsg:'بدأت مهلة الحذف (30 يومًا)',successTone:'warn',failMsg:'تعذّر الطلب',
      onSuccess:()=>{CLIENTS=CLIENTS.filter(x=>x.id!==clientId);renderPortfolio();}
    });
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
  list.querySelectorAll('[data-prestore]').forEach(b=>b.onclick=()=>runLifecycleAction({
    rpc:()=>rpcRestoreProject(b.dataset.prestore),
    successMsg:'استُرجع المشروع',onSuccess:renderArchived}));
  list.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'طلب حذف مشروع',message:'بدء مهلة 30 يومًا لحذف هذا المشروع وكل بنوده؟',danger:true,
    rpc:()=>rpcRequestProjectDeletion(b.dataset.pdel),
    successMsg:'بدأت المهلة',successTone:'warn',onSuccess:renderArchived}));
  list.querySelectorAll('[data-ppurge]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'حذف نهائي',message:'حذف نهائي لا رجعة فيه للمشروع وكل بنوده. متأكد؟',danger:true,
    rpc:()=>rpcPurgeProject(b.dataset.ppurge),
    successMsg:'حُذف نهائيًا',failMsg:'تعذّر — تحقق من المهلة والصلاحية',onSuccess:renderArchived}));
  list.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>runLifecycleAction({
    rpc:()=>rpcRestoreClient(b.dataset.restore),
    successMsg:'تم الاسترجاع',
    onSuccess:async()=>{CLIENTS=await fetchClientsByState('active');renderArchived();}}));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'طلب حذف',message:'بدء مهلة 30 يومًا لحذف هذا العميل؟',danger:true,
    rpc:()=>rpcRequestDeletion(b.dataset.del),
    successMsg:'بدأت مهلة الحذف',successTone:'warn',onSuccess:renderArchived}));
  list.querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>runLifecycleAction({
    title:'حذف نهائي',message:'تحذير: حذف نهائي لا رجعة فيه لكل بيانات العميل ومشاريعه. متأكد؟',danger:true,
    rpc:()=>rpcPurgeClient(b.dataset.purge),
    successMsg:'تم الحذف النهائي',failMsg:'تعذّر — تحقق من المهلة والصلاحية',onSuccess:renderArchived}));
}

// ===== سجل التدقيق على مستوى المكتب =====
// القاموس موحّد في config.js (AUDIT_ACTIONS) ويشترك فيه سجل المكتب وسجل المشروع.

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


/* ===== portfolio.js ===== */
// ===== app/portfolio.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
async function renderPortfolio(){
  SCREEN='portfolio';
  $('#hProject').textContent='محفظة المشاريع';
  $('#barClient').style.display='none';hideChrome();
  const isStaff=(ROLE==='pmo'||ROLE==='delivery');
  // هيكل skeleton فوري (تجربة أسرع بصريًا)
  const skel=CLIENTS.map(()=>'<div class="pcard"><div class="skeleton" style="height:22px;width:55%;margin-bottom:14px"></div><div class="skeleton" style="height:8px;margin-bottom:12px"></div><div class="skeleton" style="height:36px"></div></div>').join('');
  const toolItems=[];
  if(isStaff){
    toolItems.push({id:'showPGantt',t:'الخط الزمني الشامل',i:'📅'});
    toolItems.push({id:'showTimeline',t:'خط التسليمات الشامل',i:'📦'});
    toolItems.push({id:'showDOL',t:'طبقة القرار (DOL)',i:'⚖'});
    toolItems.push({id:'showAudit',t:'سجل المكتب',i:'📋'});
  }
  if(ROLE==='pmo'){
    toolItems.push({id:'showHolidays',t:'العطلات الرسمية',i:'🗓'});
    toolItems.push({id:'showArchived',t:'المؤرشفة',i:'🗄'});
    toolItems.push({id:'showLeads',t:'العملاء المحتملون',i:'👥'});
  }
  if(IS_OWNER){toolItems.push({id:'showTrelloSet',t:'إعدادات Trello',i:'🔗'});
    toolItems.push({id:'showStaffAccess',t:'صلاحيات الفريق',i:'🔐'});}
  const toolsMenu=toolItems.length?`<div class="tools-wrap">
    <button class="hbtn tools-btn" id="toolsBtn" aria-expanded="false" aria-haspopup="true">⚙ أدوات المكتب <span class="tools-caret">▾</span></button>
    <div class="tools-pop" id="toolsPop" role="menu">${toolItems.map(t=>`<button role="menuitem" id="${t.id}"><span class="ti">${t.i}</span>${t.t}</button>`).join('')}</div>
  </div>`:'';
  const primaryBtn=(ROLE==='pmo')?'<button class="hbtn primary-cta" id="addClientBtn">+ عميل جديد</button>':'';
  const toolbar=isStaff?`<div class="portfolio-tools">${primaryBtn}${toolsMenu}</div>`:'';
  $('#host').innerHTML='<div class="hintbar">اختر عميلًا لعرض لوحة مشروعه الكاملة.'+toolbar+'</div><div class="pgrid" id="pgrid">'+skel+'</div>';
  if(ROLE==='pmo'){const lb=$('#showLeads');if(lb)lb.onclick=renderLeads;
    const ac=$('#addClientBtn');if(ac)ac.onclick=addNewClient;}
  {const db=$('#showDOL');if(db)db.onclick=openDOL;}
  {const ab=$('#showAudit');if(ab)ab.onclick=renderAuditLog;}
  {const tb=$('#showTimeline');if(tb)tb.onclick=renderPortfolioTimeline;}
  {const hb=$('#showHolidays');if(hb)hb.onclick=openHolidaysManager;}
  {const arb=$('#showArchived');if(arb)arb.onclick=renderArchived;}
  {const pg=$('#showPGantt');if(pg)pg.onclick=()=>renderPortfolioGantt();}
  {const ts=$('#showTrelloSet');if(ts)ts.onclick=()=>openTrello('settings');}
  {const sa=$('#showStaffAccess');if(sa)sa.onclick=renderStaffAccess;}
  {const tb=$('#toolsBtn'),pop=$('#toolsPop');
    if(tb&&pop){
      const close=()=>{pop.classList.remove('open');tb.setAttribute('aria-expanded','false');};
      tb.onclick=(e)=>{e.stopPropagation();const o=pop.classList.toggle('open');tb.setAttribute('aria-expanded',o?'true':'false');};
      pop.querySelectorAll('button').forEach(b=>b.addEventListener('click',close));
      document.addEventListener('click',close);
      tb.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    }}
  // استعلام واحد لكل الملخّصات (صف لكل مشروع)
  const {data:rows,error}=await fetchPortfolio();
  const grid=$('#pgrid');grid.innerHTML='';
  if(error){grid.innerHTML='<p class="pempty">تعذّر تحميل المحفظة.</p>';return;}
  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق',lost:'ملغى'};
  let projects=(rows||[]).filter(r=>r.project_id);
  const noProjRows=(rows||[]).filter(r=>!r.project_id);

  // تجميع حسب الشركة أولًا (الشركة هي وحدة العرض)
  const groups={}; 
  projects.forEach(r=>{ (groups[r.client_id]=groups[r.client_id]||[]).push(r); });
  let companies=Object.keys(groups).map(cid=>aggregateClientRows(cid,groups[cid]));
  // العملاء بلا مشاريع: بطاقة دعوة لإضافة أول مشروع
  noProjRows.forEach(r=>{
    companies.push(aggregateClientRows(r.client_id,null,{name:r.client_name,color:r.color||'#C8A06B'}));
  });

  // عدّادات الفلاتر (على مستوى الشركات)
  const counts={all:companies.length,
    active:companies.filter(x=>x.isActive).length,
    draft:companies.filter(x=>x.isDraft).length,
    blocked:companies.filter(x=>x.blocked>0).length,
    reqs:companies.filter(x=>x.reqs>0).length,
    comments:companies.filter(x=>x.comments>0).length};
  const fbtn=(k,lbl)=>`<button class="pfilter ${PFILTER===k?'active':''}" data-filter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const abtn=(k,lbl,cls)=>`<button class="pfilter chip-${cls} ${PALERTS.has(k)?'active':''}" data-alertfilter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const searchBox=`<input id="pSearch" class="psearch" placeholder="🔍 بحث باسم الشركة أو المشروع…" value="${esc(PSEARCH)}">`;
  const sortSel=`<select id="pSort" class="psort" aria-label="ترتيب">
    <option value="alerts" ${PSORT==='alerts'?'selected':''}>ترتيب: التنبيهات أولًا</option>
    <option value="name" ${PSORT==='name'?'selected':''}>ترتيب: الاسم</option>
    <option value="progress" ${PSORT==='progress'?'selected':''}>ترتيب: الأعلى تقدّمًا</option>
    <option value="projects" ${PSORT==='projects'?'selected':''}>ترتيب: عدد المشاريع</option>
  </select>`;
  const filterBar=`<div class="pfilters-wrap">
    <div class="pfilters">
      <span class="pfacet-lbl">الحالة:</span>${fbtn('all','الكل')}${fbtn('active','نشطة')}${fbtn('draft','مسوّدة')}
      <span class="pfacet-lbl">تنبيهات:</span>${abtn('blocked','متوقفة','red')}${abtn('reqs','متطلبات','amber')}${abtn('comments','نقاش','blue')}
      ${sortSel}${searchBox}
    </div>
  </div>`;

  // تطبيق الفلاتر (تُدمج: حالة + تنبيهات متعددة + بحث)
  let shown=companies.filter(x=>{
    if(PFILTER==='active'&&!x.isActive)return false;
    if(PFILTER==='draft'&&!x.isDraft)return false;
    if(PALERTS.has('blocked')&&!(x.blocked>0))return false;
    if(PALERTS.has('reqs')&&!(x.reqs>0))return false;
    if(PALERTS.has('comments')&&!(x.comments>0))return false;
    if(PSEARCH){
      const q=PSEARCH.trim();
      const inName=x.c.name.includes(q);
      const inProj=x.list.some(r=>(r.project_name||'').includes(q));
      if(!inName&&!inProj)return false;
    }
    return true;
  });
  // الترتيب حسب اختيار المستخدم
  const sorters={
    alerts:(a,b)=>(b.hasAlerts-a.hasAlerts)||(b.list.length-a.list.length),
    name:(a,b)=>a.c.name.localeCompare(b.c.name,'ar'),
    progress:(a,b)=>b.pct-a.pct,
    projects:(a,b)=>b.list.length-a.list.length
  };
  shown.sort(sorters[PSORT]||sorters.alerts);

  // شرائح الفلاتر النشطة (قابلة للإزالة)
  const activeChips=[];
  if(PFILTER!=='all')activeChips.push({k:'status',label:(PFILTER==='active'?'نشطة':'مسوّدة')});
  if(PALERTS.has('blocked'))activeChips.push({k:'alert:blocked',label:'متوقفة'});
  if(PALERTS.has('reqs'))activeChips.push({k:'alert:reqs',label:'متطلبات'});
  if(PALERTS.has('comments'))activeChips.push({k:'alert:comments',label:'نقاش'});
  if(PSEARCH)activeChips.push({k:'search',label:'بحث: '+PSEARCH});
  const chipsBar=activeChips.length?`<div class="pchips"><span class="pchips-lbl">مُفعّل:</span>${activeChips.map(c=>`<span class="pchip">${esc(c.label)}<button data-rmchip="${c.k}" aria-label="إزالة الفلتر">✕</button></span>`).join('')}<button class="pchips-clear" id="pClearAll">مسح الكل</button></div>`:'';

  $('#host').querySelector('.hintbar').insertAdjacentHTML('afterend',filterBar+chipsBar);
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{PFILTER=b.dataset.filter;savePFilters();renderPortfolio();});
  document.querySelectorAll('[data-alertfilter]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.alertfilter; if(PALERTS.has(k))PALERTS.delete(k);else PALERTS.add(k);
    savePFilters();renderPortfolio();});
  const pSortEl=$('#pSort'); if(pSortEl)pSortEl.onchange=()=>{PSORT=pSortEl.value;savePFilters();renderPortfolio();};
  document.querySelectorAll('[data-rmchip]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.rmchip;
    if(k==='status')PFILTER='all'; else if(k==='search')PSEARCH=''; else if(k.startsWith('alert:'))PALERTS.delete(k.split(':')[1]);
    savePFilters();renderPortfolio();});
  const pClearBtn=$('#pClearAll'); if(pClearBtn)pClearBtn.onclick=()=>{PFILTER='all';PSEARCH='';PALERTS.clear();savePFilters();renderPortfolio();};
  const sIn=$('#pSearch');
  if(sIn){ sIn.oninput=()=>{PSEARCH=sIn.value; clearTimeout(sIn._t); sIn._t=setTimeout(renderPortfolio,300);};
    // إبقاء التركيز بعد إعادة العرض
    if(PSEARCH){ setTimeout(()=>{const el=$('#pSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0); } }

  if(!shown.length){grid.innerHTML='<div class="empty-cta"><div class="ico">🔍</div><h3>لا نتائج مطابقة</h3><p>جرّب تعديل الفلاتر أو مسحها.</p><button class="hbtn" id="pEmptyClear" style="background:var(--gold);border-color:var(--gold)">مسح الفلاتر</button></div>';
    const pec=$('#pEmptyClear');if(pec)pec.onclick=()=>{PFILTER='all';PSEARCH='';PALERTS.clear();savePFilters();renderPortfolio();};
    return;}
  grid.className='pcompany-grid';

  // صف مشروع مدمج (داخل التوسيع)
  const projRow=(r)=>{
    const hasplan=r.total_tasks>0;
    const pct=hasplan?Math.round(r.done_tasks/r.total_tasks*100):0;
    const alerts=[];
    if(r.blocked_tasks>0)alerts.push(`<span class="palert red">${r.blocked_tasks}</span>`);
    if(r.pending_client_reqs>0)alerts.push(`<span class="palert amber">${r.pending_client_reqs}</span>`);
    if(r.open_comments>0)alerts.push(`<span class="palert blue">${r.open_comments}</span>`);
    return `<div class="proj-row" data-openproj="${r.project_id}" data-cid="${r.client_id}" role="button" tabindex="0">
      <div class="proj-row-main">
        <span class="proj-row-name">${esc(r.project_name||'مشروع')}</span>
        <span class="plife">${LIFE[r.lifecycle]||'—'}</span>
        ${alerts.length?`<span class="proj-row-alerts">${alerts.join('')}</span>`:''}
      </div>
      ${hasplan?`<div class="proj-row-prog"><div class="pbar mini"><div class="pbar-fill" style="width:${pct}%"></div></div><span class="proj-row-pct">${pct}%</span></div>`:'<span class="proj-row-empty">بلا خطة</span>'}
      ${ROLE==='pmo'?`<button class="pcard-menu" data-pmenu="${r.project_id}" data-pname="${esc(r.project_name||'')}" aria-label="إجراءات المشروع">${I.dots}</button>`:''}
      <span class="proj-row-go">←</span>
    </div>`;
  };

  const withProj=shown.filter(x=>!x.noProjects), empty=shown.filter(x=>x.noProjects);
  const renderCard=x=>{
    const alertBadges=[];
    if(x.blocked>0)alertBadges.push(`<span class="palert red">${x.blocked} متوقف</span>`);
    if(x.reqs>0)alertBadges.push(`<span class="palert amber">${x.reqs} متطلب</span>`);
    if(x.comments>0)alertBadges.push(`<span class="palert blue">${x.comments} نقاش</span>`);
    const actBtn=(ROLE==='pmo')?`<button class="pcard-menu" data-cmenu="${x.cid}" title="إجراءات" aria-label="إجراءات العميل">${I.dots}</button>`:'';
    const card=document.createElement('div');
    card.className='pcompany'+(x.hasAlerts?' has-alerts':'');
    card.style.cssText=`--cc:${x.c.color}`;
    card.innerHTML=`
      <div class="pcompany-hd" data-toggle="${x.cid}" role="button" tabindex="0">
        <div class="pcv-top">
          <span class="pdot" style="background:${x.c.color}"></span>
          <h3>${esc(x.c.name)}</h3>
          ${actBtn}
        </div>
        <span class="pcompany-sub">${x.noProjects?'لا مشاريع بعد — انقر لإضافة أول مشروع':(x.list.length>1?x.list.length+' مشاريع':esc(x.list[0].project_name||'مشروع واحد'))+' · '+x.tot+' بند'}</span>
        ${x.noProjects?'':`<div class="pcompany-pct"><div class="pbar mini" role="progressbar" aria-valuenow="${x.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة الإنجاز"><div class="pbar-fill" style="width:${x.pct}%"></div></div><b>${x.pct}%</b></div>`}
        ${alertBadges.length?`<div class="palerts">${alertBadges.join('')}</div>`:''}
      </div>
    `;
    grid.appendChild(card);
  };
  withProj.forEach(renderCard);
  // قسم مطوي للعملاء بلا مشاريع (لا يزاحم النشط)
  if(empty.length){
    const sec=document.createElement('div');sec.className='empty-sec';
    const open=PEXPANDED.has('__empty');
    sec.innerHTML=`<button class="empty-sec-hd" data-emptytoggle="1" aria-expanded="${open}">
        <span class="es-chev">${open?'▴':'▾'}</span> عملاء بلا مشاريع <span class="es-n">${empty.length}</span>
        <span class="es-hint">جاهزون لإضافة أول مشروع</span></button>
      <div class="empty-sec-body" style="display:${open?'flex':'none'}">
        ${empty.map(x=>`<button class="ecard" data-newproj="${x.cid}" style="--cc:${x.c.color}">
          <span class="edot"></span><b>${esc(x.c.name)}</b><span class="eadd">+ أول مشروع</span></button>`).join('')}
      </div>`;
    grid.appendChild(sec);
    const hd=sec.querySelector('[data-emptytoggle]');
    hd.onclick=()=>{PEXPANDED.has('__empty')?PEXPANDED.delete('__empty'):PEXPANDED.add('__empty');renderPortfolio();};
    sec.querySelectorAll('[data-newproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.newproj);});
  }

  // التفاعل: ترويسة الشركة — تفتح صفحة العميل الموحّدة دائمًا (لوحة قيادة + مشاريعه + خططه + فريقه)
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=async(e)=>{
    if(e.target.closest('[data-cmenu]'))return;
    const cid=el.dataset.toggle;
    await renderClientHome(cid);
  });
  // نقرة على مشروع داخل التوسيع
  document.querySelectorAll('[data-openproj]').forEach(el=>el.onclick=async(e)=>{
    e.stopPropagation();
    CID=el.dataset.cid; PID=el.dataset.openproj; await openProject();
  });
  document.querySelectorAll('[data-cmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openClientMenu(b.dataset.cmenu);});
  document.querySelectorAll('[data-pmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openProjectMenu(b.dataset.pmenu,b.dataset.pname);});
  document.querySelectorAll('[data-addproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.addproj);});
}


/* ===== staffaccess.js ===== */
// ===== app/staffaccess.js — شاشة صلاحيات الفريق (مالك النظام فقط) =====
// ثلاثة نطاقات: شركة كاملة · قسم (يطابق أذرع علامة الثلاث) · مشروع واحد.
// مستويان: عرض · تعديل. مالك النظام فقط يمنح/يسحب — لا أحد آخر.

let SA_MEMBERS=[],SA_GRANTS=[],SA_PROJECTS=[],SA_OWNER_EMAILS=[];

async function fetchOwnerEmails(){const {data}=await sb.from('pmo_owners').select('email');return (data||[]).map(x=>x.email.toLowerCase());}

async function renderStaffAccess(){
  if(!IS_OWNER){toast('هذه الشاشة لمالك النظام فقط','err');return;}
  SCREEN='staffaccess';$('#hProject').textContent='صلاحيات الفريق';hideChrome();
  $('#host').innerHTML=`<div class="hintbar"><button class="reqbtn" id="backSA">↩ المحفظة</button>
    <span style="margin-inline-start:auto">🔐 <b>صلاحيات الفريق:</b> من يرى/يعدّل ماذا — على مستوى الشركة، القسم، أو مشروع واحد.
    موظف بلا أي صلاحية مخصَّصة هنا يبقى كما كان دائمًا (يرى كل شيء).</span></div>
    <div id="saBody"><div class="skeleton" style="height:120px;margin-bottom:10px"></div><div class="skeleton" style="height:200px"></div></div>`;
  $('#backSA').onclick=renderPortfolio;
  try{
    [SA_MEMBERS,SA_GRANTS,SA_PROJECTS,SA_OWNER_EMAILS]=await Promise.all([
      fetchTeamMembers(),
      fetchAllStaffAccess(),
      sb.from('pmo_projects').select('id,name,department,client_id').then(r=>r.data||[]),
      fetchOwnerEmails()
    ]);
    const clientsById={};(CLIENTS||[]).forEach(c=>{clientsById[c.id]=c.name;});
    SA_PROJECTS.forEach(p=>{p._client=clientsById[p.client_id]||'';});
  }catch(e){$('#saBody').innerHTML='<p class="pempty">تعذّر التحميل: '+esc(e.message)+'</p>';return;}
  renderSABody();
}

function saScopeLabel(g){
  if(g.scope_type==='company')return 'الشركة كاملة';
  if(g.scope_type==='department')return DEPTS[g.scope_value]||g.scope_value;
  if(g.scope_type==='client'){const c=CLIENTS.find(x=>x.id===g.scope_value);return c?('كل مشاريع: '+c.name):'عميل محذوف';}
  const p=SA_PROJECTS.find(x=>x.id===g.scope_value);
  return p?(p._client+' — '+p.name):'مشروع محذوف';
}

function renderSABody(){
  const grantsByMember={};SA_GRANTS.forEach(g=>{(grantsByMember[g.member_id]=grantsByMember[g.member_id]||[]).push(g);});
  const memberRows=SA_MEMBERS.map(m=>{
    const grants=grantsByMember[m.id]||[];
    const owner=SA_OWNER_EMAILS.includes((m.email||'').toLowerCase());
    const chips=grants.map(g=>`<span class="sa-chip sa-${g.access_level}">${esc(saScopeLabel(g))} · ${g.access_level==='edit'?'تعديل':'عرض'}
      <button data-sarevoke="${g.id}" aria-label="سحب الصلاحية" title="سحب">✕</button></span>`).join('');
    return `<div class="sa-row">
      <div class="sa-who"><b>${esc(m.full_name||m.email)}</b><span>${esc(m.email)}</span></div>
      <div class="sa-grants">${owner?'<span class="sa-chip sa-owner">مالك النظام — صلاحية كاملة دائمًا</span>':(chips||'<span class="sa-empty">لا صلاحية مخصَّصة — يرى كل شيء (افتراضي)</span>')}</div>
    </div>`;
  }).join('');

  const memberOpts=SA_MEMBERS.map(m=>`<option value="${m.id}">${esc(m.full_name||m.email)}</option>`).join('');
  const deptOpts=Object.keys(DEPTS).map(k=>`<option value="${k}">${esc(DEPTS[k])}</option>`).join('');
  const clientOpts=(CLIENTS||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const projOpts=SA_PROJECTS.map(p=>`<option value="${p.id}">${esc(p._client)} — ${esc(p.name)}</option>`).join('');

  const deptTable=SA_PROJECTS.map(p=>`<tr><td>${esc(p._client)}</td><td>${esc(p.name)}</td>
    <td><select data-setdept="${p.id}">
      <option value="">— بلا قسم —</option>
      ${Object.keys(DEPTS).map(k=>`<option value="${k}" ${p.department===k?'selected':''}>${esc(DEPTS[k])}</option>`).join('')}
    </select></td></tr>`).join('');

  $('#saBody').innerHTML=`
    <div class="sa-section">
      <h4>إضافة عضو فريق <span class="sa-hint">يشترط أن يكون قد سجّل دخوله مرة واحدة على الأقل عبر Google على المنصة — عندها فقط يمكن ربط بريده. اطلب منه تسجيل الدخول أولًا ثم أعد المحاولة هنا.</span></h4>
      <div class="sa-form">
        <input id="saNewEmail" type="email" placeholder="البريد الإلكتروني" style="flex:1;min-width:200px;border:1.5px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit">
        <input id="saNewName" placeholder="الاسم (اختياري)" style="border:1.5px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit">
        <select id="saNewRole"><option value="manager">فريق (manager)</option><option value="admin">إدارة كاملة (admin)</option></select>
        <button class="hbtn" id="saAddMember" style="background:var(--ok);border-color:var(--ok)">إضافة</button>
      </div>
    </div>
    <div class="sa-section">
      <h4>منح صلاحية جديدة</h4>
      <div class="sa-form">
        <select id="saMember">${memberOpts}</select>
        <select id="saScopeType">
          <option value="company">الشركة كاملة</option>
          <option value="department">قسم بعينه</option>
          <option value="client">عميل بعينه (كل مشاريعه)</option>
          <option value="project">مشروع بعينه</option>
        </select>
        <select id="saScopeValue" style="display:none">${deptOpts}</select>
        <select id="saScopeClient" style="display:none">${clientOpts}</select>
        <select id="saScopeProject" style="display:none">${projOpts}</select>
        <select id="saLevel"><option value="view">عرض فقط</option><option value="edit">عرض وتعديل</option></select>
        <button class="hbtn" id="saGrant" style="background:var(--gold);border-color:var(--gold)">منح</button>
      </div>
    </div>
    <div class="sa-section">
      <h4>الصلاحيات الحالية</h4>
      <div class="sa-list">${memberRows}</div>
    </div>
    <div class="sa-section">
      <h4>قسم كل مشروع <span class="sa-hint">(لازم لعمل صلاحية «قسم» — بلا قسم، المشروع لا يظهر لأي صلاحية قسمية)</span></h4>
      <table class="tktbl"><thead><tr><th>العميل</th><th>المشروع</th><th>القسم</th></tr></thead><tbody>${deptTable}</tbody></table>
    </div>`;

  const stEl=$('#saScopeType'),svEl=$('#saScopeValue'),spEl=$('#saScopeProject'),scEl=$('#saScopeClient');
  stEl.onchange=()=>{
    svEl.style.display=(stEl.value==='department')?'':'none';
    scEl.style.display=(stEl.value==='client')?'':'none';
    spEl.style.display=(stEl.value==='project')?'':'none';
  };
  const amb=$('#saAddMember');
  if(amb)amb.onclick=async()=>{
    const email=($('#saNewEmail').value||'').trim();
    const name=($('#saNewName').value||'').trim();
    const role=$('#saNewRole').value;
    if(!email){toast('أدخل البريد الإلكتروني','warn');return;}
    amb.disabled=true;
    try{
      const r=await addTeamMember(email,name,role);
      if(r&&r.ok){
        toast(r.updated?'تحديث بيانات عضو موجود':'أُضيف العضو بنجاح','ok');
        $('#saNewEmail').value='';$('#saNewName').value='';
        SA_MEMBERS=await fetchTeamMembers();renderSABody();
      }else if(r&&r.reason==='no_signin'){
        toast('هذا البريد لم يسجّل الدخول على المنصة بعد — اطلب منه الدخول مرة واحدة ثم أعد المحاولة','warn');
      }else toast('تعذّرت الإضافة','err');
    }catch(e){toast('تعذّرت الإضافة: '+e.message,'err');}
    amb.disabled=false;
  };
  $('#saGrant').onclick=async()=>{
    const memberId=$('#saMember').value,scopeType=stEl.value,level=$('#saLevel').value;
    const scopeValue=scopeType==='company'?null:
      (scopeType==='department'?svEl.value:(scopeType==='client'?scEl.value:spEl.value));
    try{
      await grantStaffAccess(memberId,scopeType,scopeValue,level);
      SA_GRANTS=await fetchAllStaffAccess();
      toast('مُنحت الصلاحية','ok');renderSABody();
    }catch(e){toast('تعذّر المنح: '+e.message,'err');}
  };
  $$('#saBody [data-sarevoke]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('سحب صلاحية','سحب هذه الصلاحية؟ سيفقد الموظف الوصول المرتبط بها فورًا.',false))return;
    try{await revokeStaffAccess(b.dataset.sarevoke);SA_GRANTS=await fetchAllStaffAccess();toast('سُحبت الصلاحية','ok');renderSABody();}
    catch(e){toast('تعذّر السحب: '+e.message,'err');}
  });
  $$('#saBody [data-setdept]').forEach(sel=>sel.onchange=async()=>{
    try{await setProjectDepartment(sel.dataset.setdept,sel.value||null);
      const p=SA_PROJECTS.find(x=>x.id===sel.dataset.setdept);if(p)p.department=sel.value||null;
      toast('حُدِّث القسم','ok');
    }catch(e){toast('تعذّر التحديث: '+e.message,'err');}
  });
}

window.renderStaffAccess=renderStaffAccess;


/* ===== clienthome.js ===== */
// ===== app/clienthome.js — صفحة عميل موحّدة =====
// تحلّ محلّ التوسّع المباشر داخل شبكة المحفظة: نقرة على أي عميل تفتح هنا.
// مصدر البيانات: نفس fetchPortfolio() المستخدم في شبكة المحفظة، ونفس aggregateClientRows()
// المستخدمة هناك — لا حساب مكرّر، ولا احتمال انحراف بين الصفحتين.

let SA_MEMBERS_CACHE=null;
async function ensureMembersCache(){if(!SA_MEMBERS_CACHE)SA_MEMBERS_CACHE=await fetchTeamMembers();return SA_MEMBERS_CACHE;}

async function renderClientHome(clientId){
  const c=CLIENTS.find(x=>x.id===clientId);
  if(!c){toast('عميل غير موجود','err');await renderPortfolio();return;}
  SCREEN='clienthome';CID=clientId;PID=null;
  $('#hProject').textContent=c.name;
  $('#barClient').style.display='none';hideChrome();
  writeClientHash(clientId);
  $('#host').innerHTML=`
    <div class="hintbar"><button class="reqbtn" id="chBack">↩ المحفظة</button>
      <button class="reqbtn" id="chMenu" style="margin-inline-start:8px">⋮ إجراءات العميل</button>
      <span style="margin-inline-start:auto">ملف العميل الكامل: لوحة قيادة مجمَّعة، كل مشاريعه، خططه، وفريقه — في مكان واحد.</span></div>
    <div id="chBody"><div class="skeleton" style="height:90px;margin-bottom:10px"></div>
      <div class="skeleton" style="height:160px;margin-bottom:10px"></div>
      <div class="skeleton" style="height:220px"></div></div>`;
  $('#chBack').onclick=renderPortfolio;
  $('#chMenu').onclick=()=>openClientMenu(clientId);

  let stats,access=[];
  try{
    const {data:rows,error}=await fetchPortfolio();
    if(error)throw error;
    const list=(rows||[]).filter(r=>r.client_id===clientId&&r.project_id);
    stats=aggregateClientRows(clientId,list,c);
  }catch(e){$('#chBody').innerHTML='<p class="pempty">تعذّر تحميل مشاريع العميل: '+esc(e.message||String(e))+'</p>';return;}
  // فشل جلب الصلاحيات (مثلًا صلاحيات غير كافية لعرض فريق آخرين) لا يجب أن يمنع عرض المشاريع نفسها
  try{
    await ensureMembersCache();
    access=(await fetchAllStaffAccess()).filter(a=>
      (a.scope_type==='client'&&a.scope_value===clientId)||
      (a.scope_type==='project'&&stats.list.some(l=>l.project_id===a.scope_value)));
  }catch(e){access=[];}
  renderCHBody(stats,access);
  // الجانت المجمَّع لهذا العميل — نفس أداة «الخط الزمني الشامل»، بنطاق مُقيَّد فقط
  if(stats.list.length)renderPortfolioGantt(clientId,'chGanttWrap');
}

function writeClientHash(clientId){
  const h='#/c/'+clientId;
  if(location.hash===h)return;
  try{history.replaceState(null,'',h);}catch(e){location.hash=h;}
}

function renderCHBody(stats,access){
  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق',lost:'ملغى'};
  const kpi=(n,v,cls)=>`<div class="ch-kpi ${cls||''}"><b>${v}</b><span>${n}</span></div>`;
  const kpis=`<div class="ch-kpis">
    ${kpi('مشاريع',stats.list.length)}
    ${kpi('نسبة الإنجاز',stats.pct+'%')}
    ${kpi('بنود متوقفة',stats.blocked,stats.blocked?'ch-warn':'')}
    ${kpi('متطلبات بانتظار العميل',stats.reqs,stats.reqs?'ch-warn':'')}
    ${kpi('نقاش مفتوح',stats.comments)}
  </div>`;

  const projCards=stats.noProjects?
    `<div class="empty-cta"><div class="ico">${I.folder||'📁'}</div><h3>لا مشاريع بعد</h3><p>ابدأ أول مشروع لهذا العميل.</p>
      <button class="hbtn" id="chNewProj" style="background:var(--gold);border-color:var(--gold)">+ مشروع جديد</button></div>`
    :stats.list.map(r=>{
      const pct=r.total_tasks>0?Math.round(r.done_tasks/r.total_tasks*100):0;
      return `<button class="ch-pcard" data-openp="${r.project_id}">
        <div class="ch-pname">${esc(r.project_name)}</div>
        <div class="ch-pmeta"><span class="pill" style="background:var(--soft-2);color:var(--muted)">${LIFE[r.lifecycle]||r.lifecycle||''}</span>
          ${r.blocked_tasks>0?'<span class="pill" style="background:var(--crit-bg);color:var(--crit)">'+r.blocked_tasks+' متوقف</span>':''}</div>
        <div class="trk-bar" style="margin-top:8px"><div class="trk-bar-fill" style="width:${pct}%;background:var(--ok)"></div></div>
        <div class="ch-ppct">${pct}% · ${r.total_tasks} بند</div>
      </button>`;
    }).join('');

  const memberOpts=(SA_MEMBERS_CACHE||[]).map(m=>`<option value="${m.id}">${esc(m.full_name||m.email)}</option>`).join('');
  const projOpts=stats.list.map(r=>`<option value="${r.project_id}">${esc(r.project_name)}</option>`).join('');
  const accessRows=access.map(a=>{
    const m=(SA_MEMBERS_CACHE||[]).find(x=>x.id===a.member_id);
    const scopeLbl=a.scope_type==='client'?'كل مشاريع هذا العميل':
      (stats.list.find(r=>r.project_id===a.scope_value)||{}).project_name||'مشروع';
    return `<span class="sa-chip sa-${a.access_level}">${esc(m?(m.full_name||m.email):'—')} — ${esc(scopeLbl)} · ${a.access_level==='edit'?'تعديل':'عرض'}
      <button data-chrevoke="${a.id}" aria-label="سحب" title="سحب">✕</button></span>`;
  }).join('')||'<span class="sa-empty">لا أحد لديه صلاحية مخصَّصة لهذا العميل تحديدًا</span>';

  $('#chBody').innerHTML=`
    <div class="sa-section">${kpis}</div>
    <div class="sa-section">
      <h4>مشاريع ${esc(stats.c.name)} <span class="sa-hint">(${stats.list.length})</span></h4>
      <div class="ch-pgrid">${projCards}</div>
    </div>
    <div class="sa-section">
      <h4>خططه — الخط الزمني المجمَّع
        <span class="sa-hint">لعرض كل عملاء المحفظة معًا بدل عميل واحد، استخدم «الخط الزمني الشامل» من أدوات المكتب</span></h4>
      <div id="chGanttWrap">${stats.noProjects?'<p class="empty">لا خطط بعد.</p>':''}</div>
    </div>
    <div class="sa-section">
      <h4>فريق هذا العميل <span class="sa-hint">دعوة عضو موجود بالفعل — على مستوى العميل كاملًا أو مشروع واحد بعينه</span></h4>
      <div class="sa-form" style="margin-bottom:14px">
        <select id="chMember">${memberOpts}</select>
        <select id="chScope"><option value="client">كل مشاريع هذا العميل</option>${projOpts?'<option value="project">مشروع بعينه:</option>':''}</select>
        <select id="chProj" style="display:none">${projOpts}</select>
        <select id="chLevel"><option value="view">عرض فقط</option><option value="edit">عرض وتعديل</option></select>
        <button class="hbtn" id="chGrant" style="background:var(--gold);border-color:var(--gold)">منح</button>
      </div>
      <div class="sa-grants">${accessRows}</div>
    </div>`;

  $$('#chBody [data-openp]').forEach(b=>b.onclick=async()=>{CID=stats.cid;PID=b.dataset.openp;await openProject();});
  const nb=$('#chNewProj');if(nb)nb.onclick=()=>newProjectDialog(stats.cid);
  const scopeSel=$('#chScope'),projSel=$('#chProj');
  if(scopeSel)scopeSel.onchange=()=>{projSel.style.display=(scopeSel.value==='project')?'':'none';};
  const gb=$('#chGrant');
  if(gb)gb.onclick=async()=>{
    const memberId=$('#chMember').value,scopeType=scopeSel.value,level=$('#chLevel').value;
    const scopeValue=scopeType==='client'?stats.cid:projSel.value;
    try{
      await grantStaffAccess(memberId,scopeType,scopeValue,level);
      toast('مُنحت الصلاحية','ok');
      const newAccess=(await fetchAllStaffAccess()).filter(a=>
        (a.scope_type==='client'&&a.scope_value===stats.cid)||
        (a.scope_type==='project'&&stats.list.some(l=>l.project_id===a.scope_value)));
      renderCHBody(stats,newAccess);
    }catch(e){toast('تعذّر المنح: '+e.message,'err');}
  };
  $$('#chBody [data-chrevoke]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('سحب صلاحية','سحب هذه الصلاحية؟',false))return;
    try{
      await revokeStaffAccess(b.dataset.chrevoke);toast('سُحبت الصلاحية','ok');
      const newAccess=(await fetchAllStaffAccess()).filter(a=>
        (a.scope_type==='client'&&a.scope_value===stats.cid)||
        (a.scope_type==='project'&&stats.list.some(l=>l.project_id===a.scope_value)));
      renderCHBody(stats,newAccess);
    }catch(e){toast('تعذّر السحب: '+e.message,'err');}
  });
}

window.renderClientHome=renderClientHome;


/* ===== exportcontract.js ===== */
// ===== app/exportcontract.js — تصدير الخطة المعتمدة كمستند احترافي =====
// المبدأ الحاكم: المستند يُبنى من لقطة (Baseline) محدَّدة — لا من الجدول الحيّ المتغيّر —
// فيبقى صالحًا كمرجع ثابت عند أي مراجعة أو خلاف لاحق، بصرف النظر عن أي تعديل يطرأ على
// الخطة بعد تاريخ الاعتماد. التواريخ والمدد من اللقطة نفسها؛ الأسماء والهرمية من الخطة
// الحالية (أي إعادة تسمية لاحقة تمرّ عبر طلب تعديل موثَّق في سجل المشروع أصلًا).

async function openContractExport(){
  if(!PROJECT||!PROJECT.baselines||!PROJECT.baselines.length){
    toast('لا توجد لقطة (Baseline) بعد لهذا المشروع — ثبّت أساسًا أولًا','warn');return;
  }
  const opts=PROJECT.baselines.slice().reverse().map(b=>
    `<option value="${b.id}">${esc(b.label)} — ${new Date(b.approved_at).toLocaleDateString('ar')}</option>`).join('');
  const r=await dialog({title:'تصدير للعقد',
    fields:[{key:'bl',label:'اللقطة (Baseline) المُصدَّرة',type:'select',value:PROJECT.baselines[PROJECT.baselines.length-1].id,
      options:PROJECT.baselines.slice().reverse().map(b=>({v:b.id,t:b.label+' — '+new Date(b.approved_at).toLocaleDateString('ar')}))}],
    confirmText:'تصدير'});
  if(!r)return;
  buildContractDoc(r.bl);
}

function buildContractDoc(baselineId){
  const bl=(PROJECT.baselines||[]).find(b=>b.id===baselineId);
  if(!bl){toast('لقطة غير موجودة','err');return;}
  const snap=bl.snapshot||{};
  const phases=projTrackList();
  const byPhase={};phases.forEach(p=>{byPhase[p.key]=[];});
  PROJECT.tasks.forEach(t=>{
    if(t.type==='package')return;
    const row=snap[t.id]||{};
    (byPhase[t.track]=byPhase[t.track]||[]).push({
      id:t.id,name:t.name,type:t.type,
      duration:row.duration!=null?row.duration:t.duration,
      ES:row.ES?fmt(new Date(row.ES)):'—', EF:row.EF?fmt(new Date(row.EF)):'—'
    });
  });
  const today=new Date().toLocaleDateString('ar',{year:'numeric',month:'long',day:'numeric'});
  const blDate=new Date(bl.approved_at).toLocaleDateString('ar',{year:'numeric',month:'long',day:'numeric'});
  const clientName=(CLIENTS.find(c=>c.id===CID)||{}).name||'';

  const phasePages=phases.filter(p=>(byPhase[p.key]||[]).length).map(p=>{
    const rows=byPhase[p.key].map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${TYPES[x.type]||x.type}</td>
      <td>${x.type==='milestone'?'—':x.duration+' يوم'}</td><td>${x.ES}</td><td>${x.EF}</td></tr>`).join('');
    return `<section class="cx-page">
      <div class="cx-phase-hd" style="--pc:${p.color}"><span></span>${esc(p.name)}</div>
      <table class="cx-table"><thead><tr><th>المعرّف</th><th>الاسم</th><th>النوع</th><th>المدة</th><th>البداية</th><th>النهاية</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </section>`;
  }).join('');

  const doc=document.getElementById('contractPrint');
  doc.innerHTML=`
    <section class="cx-cover">
      <div class="cx-cover-brand">علامة <span>· أثر دائم</span></div>
      <h1>الخطة المعتمدة</h1>
      <div class="cx-cover-meta">
        <div><b>العميل</b><span>${esc(clientName)}</span></div>
        <div><b>المشروع</b><span>${esc(PROJECT.name)}</span></div>
        <div><b>اللقطة المرجعية</b><span>${esc(bl.label)}</span></div>
        <div><b>تاريخ الاعتماد</b><span>${blDate}</span></div>
      </div>
      <p class="cx-cover-note">هذا المستند لقطة ثابتة من الخطة بتاريخ اعتمادها أعلاه — لا يعكس أي تعديل لاحق.
        أُصدر آليًا من منصة حوكمة المشاريع بتاريخ ${today}.</p>
    </section>
    ${phasePages}
    <div class="cx-footer">علامة · أثر دائم — مستند مُولَّد آليًا من منصة حوكمة المشاريع · ${esc(bl.label)}</div>
  `;
  document.body.classList.add('printing-contract');
  setTimeout(()=>{
    window.print();
    const restore=()=>{document.body.classList.remove('printing-contract');window.removeEventListener('afterprint',restore);};
    window.addEventListener('afterprint',restore);
  },80);
}

window.openContractExport=openContractExport;


/* ===== main.js ===== */
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

// ===== مبدّل سريع للعملاء والمشاريع (طاقم فقط) =====
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
async function qjGo(item){
  const list=$('#qjumpList'),input=$('#qjumpInput');
  if(list)list.hidden=true;if(input){input.value='';input.blur();}
  if(item.kind==='project'){CID=item.cid;PID=item.id;await openProject();return;}
  await renderClientHome(item.cid);
}
function bindQJump(){
  const wrap=$('#qjumpWrap');if(!wrap||wrap._bound)return;wrap._bound=true;
  wrap.style.display=(ROLE==='pmo'||ROLE==='delivery')?'':'none';
  if(ROLE!=='pmo'&&ROLE!=='delivery')return;
  const input=$('#qjumpInput'),list=$('#qjumpList');
  input.addEventListener('focus',async()=>{if(!QJ_INDEX.length)await refreshQJIndex();qjRender(input.value);});
  input.addEventListener('input',()=>qjRender(input.value));
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){list.hidden=true;input.blur();}
    else if(e.key==='Enter'){const first=list.querySelector('[data-qj]');if(first)first.click();}
  });
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))list.hidden=true;});
}

async function startApp(){
  $('#login').classList.add('hidden');$('#loader').classList.remove('hidden');
  await loadClients();
  $('#app').classList.remove('hidden');$('#loader').classList.add('hidden');
  $('#uName').textContent=USER._name||USER.email;
  $('#roleChip').textContent=ROLE_NAMES[ROLE];
  bindQJump();
  $('#dataDate').value=DATA_DATE;$('#dataDate').onchange=e=>{DATA_DATE=e.target.value;if(SCREEN==='project')render();else renderPortfolio();};
  if(!CLIENTS.length){$('#host').innerHTML='<p style="padding:30px;text-align:center;color:var(--muted)">لا توجد مشاريع متاحة لحسابك بعد.</p>';hideChrome();return;}
  // العميل: دخول مباشر لمشروعه الوحيد. الطاقم: شاشة المحفظة
  if(ROLE==='client'){
    SCREEN='project';CID=CLIENTS[0].id;await loadProject(CID);render();
  }else{
    const cm=/^#\/c\/([^/]+)$/.exec(location.hash||'');
    if(cm&&CLIENTS.some(c=>c.id===cm[1])){SCREEN='clienthome';await renderClientHome(cm[1]);}
    else{SCREEN='portfolio';await renderPortfolio();}
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
  else{
    const cm=/^#\/c\/([^/]+)$/.exec(location.hash||'');
    if(cm&&CLIENTS.some(c=>c.id===cm[1])&&(ROLE==='pmo'||ROLE==='delivery'))renderClientHome(cm[1]);
  }
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
    SCREEN='portfolio';toast('لا تملك صلاحية الوصول لهذا المشروع','err');await renderPortfolio();return;
  }
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
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backPT">↩ المحفظة</button><span style="margin-inline-start:auto">📦 <b>خط التسليمات:</b> سجل زمني للتبادل بين علامة والعملاء عبر <b>كل المشاريع</b>.</span></div><div id="ptlWrap"><div class="skeleton" style="height:120px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
  $('#backPT').onclick=renderPortfolio;
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
  if(await confirmDialog('تصدير للعقد','تصدير هذه اللقطة الآن كمستند PDF مرفق بالعقد؟',false))
    buildContractDoc(PROJECT.baselines[PROJECT.baselines.length-1].id);
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

