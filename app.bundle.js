const BUILD_V='3b023a20';
/* ===== config.js ===== */
// ===== الإعدادات =====
const SUPABASE_URL='https://gxiucsieezkvwztbsrgf.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aXVjc2llZXprdnd6dGJzcmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTI5NzksImV4cCI6MjA5NDg2ODk3OX0.yKw4yQEJM_4wPk1ki5m084OZqqmAA8A07uVeamlIT3M';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
const TRACKS={"0":{name:"التأسيس المضغوط",code:"0",color:"#1A1A1A"},"A":{name:"النمو السريع والمواسم",code:"A",color:"#C8A06B"},"B":{name:"التحليل والتشخيص بالموجات",code:"B",color:"#7A8B6F"},"C":{name:"الاستراتيجية وبناء الأصول",code:"C",color:"#9C6B4A"}};
const STATUS={notstarted:'لم تبدأ',inprogress:'جارية',blocked:'متوقفة',done:'مكتملة'};
const TYPES={task:'مهمة',milestone:'معلم',fixed:'ثابت',cont:'مستمر'};
const ROLE_NAMES={pmo:'مكتب إدارة المشاريع',delivery:'الفريق',client:'العميل'};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const fmt=d=>{const x=new Date(d);return('0'+x.getDate()).slice(-2)+'/'+('0'+(x.getMonth()+1)).slice(-2);};
const fmtY=d=>{const x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);};
const D=s=>new Date(s+'T00:00:00');
function todayISO(){return fmtY(new Date());}


// ===== الصلاحيات =====
const PERMS={pmo:{editStruct:true,editProg:true,editReqs:true,approveContract:true,crAction:'approve',views:['dashboard','table','gantt','deliv','cr','requests','discuss','audit']},
  delivery:{editStruct:true,editProg:true,editReqs:true,approveContract:false,crAction:'request',views:['dashboard','table','gantt','deliv','cr','requests','discuss','audit']},
  client:{editStruct:false,editProg:false,editReqs:false,approveContract:false,crAction:'request',views:['dashboard','gantt','deliv','cr','requests','discuss']}};
function can(p){return PERMS[ROLE]&&PERMS[ROLE][p];}

// ===== أيقونات SVG موحّدة (خطية، ترث لون النص) =====
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

// المراحل الديناميكية: قائمة مراحل المشروع الحالي (أو الافتراضية)
function projTrackList(){
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


/* ===== engine.js ===== */
// ===== محرك CPM (مختبَر) =====
function scheduleTasks(tasks,projectStartStr){
  const WE=new Set([5,6]);const isWD=d=>!WE.has(d.getDay());const clone=d=>new Date(d.getTime());
  const ensureWD=d=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const nextWD=d=>{d=clone(d);d.setDate(d.getDate()+1);while(!isWD(d))d.setDate(d.getDate()+1);return d;};
  const addWD=(d,n)=>{d=ensureWD(d);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const subWD=(d,n)=>{d=clone(d);while(!isWD(d))d.setDate(d.getDate()-1);let c=0;while(c<n){d.setDate(d.getDate()-1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=clone(a),e=clone(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=clone(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const map={};tasks.forEach(t=>map[t.id]=t);
  const indeg={},adj={};tasks.forEach(t=>{indeg[t.id]=0;adj[t.id]=[];});
  tasks.forEach(t=>(t.deps||[]).forEach(d=>{if(map[d]){adj[d].push(t.id);indeg[t.id]++;}}));
  const q=tasks.filter(t=>indeg[t.id]===0).map(t=>t.id),order=[];
  while(q.length){const id=q.shift();order.push(id);adj[id].forEach(n=>{if(--indeg[n]===0)q.push(n);});}
  const hasCycle=order.length!==tasks.length;const seq=hasCycle?tasks.map(t=>t.id):order;
  const start=new Date(projectStartStr+'T00:00:00');const R={},warnings=[];
  seq.forEach(id=>{const t=map[id];const deps=(t.deps||[]).filter(d=>map[d]);let ES;
    if(t.type==='fixed'&&t.fixedDate){ES=ensureWD(new Date(t.fixedDate+'T00:00:00'));}
    else if(t.type==='milestone'){let mx=null;deps.forEach(d=>{const ef=R[d]?R[d].EF:start;if(mx===null||ef>mx)mx=ef;});ES=ensureWD(mx||start);}
    else if(deps.length===0)ES=addWD(start,t.lag||0);
    else{let mx=null;deps.forEach(d=>{const ef=R[d]?R[d].EF:start;if(mx===null||ef>mx)mx=ef;});
      const zero=(t.duration||0)<=0; // مهمة بمدة 0: تلتصق بنهاية سابقتها ولا تستهلك يومًا
      ES=zero?ensureWD(mx||start):addWD(nextWD(mx),t.lag||0);}
    const dur=t.type==='milestone'?0:(t.type==='cont'?null:((t.duration||0)<=0?0:Math.max(1,t.duration)));let EF;
    if(t.type==='milestone'||t.type==='cont'||dur===0)EF=clone(ES);else EF=addWD(ES,dur-1);
    R[id]={ES,EF,dur};});
  let pEnd=start;tasks.forEach(t=>{if(t.type!=='cont'&&R[t.id].EF>pEnd)pEnd=R[t.id].EF;});
  tasks.forEach(t=>{if(t.type==='cont')R[t.id].EF=clone(pEnd);});
  seq.slice().reverse().forEach(id=>{const t=map[id];const succ=tasks.filter(s=>(s.deps||[]).includes(id));let LF;
    if(succ.length===0)LF=clone(pEnd);else{let mn=null;succ.forEach(s=>{const ls=R[s.id].LS;if(mn===null||ls<mn)mn=ls;});LF=clone(mn);}
    const dur=R[id].dur;let LS;if(t.type==='milestone')LS=clone(LF);else if(t.type==='cont')LS=clone(R[id].ES);else LS=subWD(LF,Math.max(1,dur)-1);
    R[id].LF=LF;R[id].LS=LS;let slack=wdB(R[id].ES,LS);if(t.type==='fixed')slack=0;R[id].slack=slack;R[id].critical=(t.type!=='cont')&&slack<=0;});
  if(hasCycle)warnings.push('تحذير: توجد تبعية دائرية — الجدولة غير دقيقة.');
  return {R,pStart:start,pEnd,hasCycle,warnings,totalWD:wdB(start,pEnd)+1};
}
// ===== المتابعة =====
function computeTracking(tasks,S,ddStr){
  const WE=new Set([5,6]),isWD=d=>!WE.has(d.getDay());
  const addWD=(d,n)=>{d=new Date(d.getTime());while(!isWD(d))d.setDate(d.getDate()+1);let c=0;while(c<n){d.setDate(d.getDate()+1);if(isWD(d))c++;}return d;};
  const wdB=(a,b)=>{let s=new Date(a),e=new Date(b),sg=1;if(e<s){const t=s;s=e;e=t;sg=-1;}let c=0,d=new Date(s);while(d<e){d.setDate(d.getDate()+1);if(isWD(d))c++;}return c*sg;};
  const dd=D(ddStr),T={};
  tasks.forEach(t=>{const r=S.R[t.id];let blocked=false,co=false,ao=false;
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
  return T;
}


/* ===== api.js ===== */
// ===== المصادقة =====
async function loadIdentity(){
  const {data:{user}}=await sb.auth.getUser();USER=user;if(!user)return null;
  const {data:tm}=await sb.from('team_members').select('role,is_active,full_name').eq('id',user.id).maybeSingle();
  if(tm&&tm.is_active){ROLE=(tm.role==='admin')?'pmo':(tm.role==='manager'?'delivery':'client');USER._name=tm.full_name||user.email;
    try{const {data:own}=await sb.rpc('pmo_is_owner');IS_OWNER=(own===true);if(IS_OWNER)ROLE='pmo';}catch(e){IS_OWNER=false;}}
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
async function loadClients(){const {data}=await sb.from('pmo_clients').select('*').order('created_at');CLIENTS=data||[];}
const PROJECT_CACHE={}; // تخزين مؤقت للمشاريع المحمّلة (يُبطل عند الكتابة)
async function loadProject(clientId, projectId){
  CID=clientId;
  let q=sb.from('pmo_projects').select('*').eq('client_id',clientId);
  if(projectId) q=q.eq('id',projectId);
  else q=q.eq('lifecycle_state','active').order('start_date').limit(1);
  const {data:projects}=await q;
  if(!projects||!projects.length){PROJECT=null;return;}
  const p=projects[0];
  // tasks/deps/baseline/CRs تعتمد على project_id فقط → نطلبها بالتوازي
  const [tasksR,depsR,blR,crR]=await Promise.all([
    sb.from('pmo_tasks').select('id,ref,wbs,name,track,type,duration,lag,fixed_date,owner,deliverable,status,progress,sort_order').eq('project_id',p.id).order('sort_order'),
    sb.from('pmo_dependencies').select('task_id,depends_on_id').eq('project_id',p.id),
    sb.from('pmo_baselines').select('snapshot').eq('project_id',p.id).order('approved_at',{ascending:false}).limit(1),
    sb.from('pmo_change_requests').select('*').eq('project_id',p.id).order('created_at',{ascending:false})
  ]);
  const tasks=tasksR.data||[],deps=depsR.data||[],bl=blR.data||[];
  CRS=crR.data||[];
  const ids=tasks.map(t=>t.id);let reqs=[];
  if(ids.length){const r=await sb.from('pmo_requirements').select('*').in('task_id',ids);reqs=r.data||[];}
  const refById={};tasks.forEach(t=>refById[t.id]=t.ref);
  const depMap={};deps.forEach(d=>{(depMap[d.task_id]=depMap[d.task_id]||[]).push(refById[d.depends_on_id]);});
  const reqMap={};reqs.forEach(r=>{(reqMap[r.task_id]=reqMap[r.task_id]||[]).push({_id:r.id,desc:r.description,owner:r.owner,sla:r.sla_days,blocking:r.blocking,requested:r.requested_at||'',received:r.received_at||''});});
  PROJECT={_dbId:p.id,name:p.name,start:p.start_date,status:p.status,lifecycle:p.lifecycle,contractValue:p.contract_value,
    baseline:(bl&&bl.length)?{snapshot:bl[0].snapshot}:null,
    tasks:tasks.map(t=>({id:t.ref,_dbId:t.id,_sortOrder:t.sort_order,wbs:t.wbs,name:t.name,track:t.track,type:t.type,duration:t.duration,lag:t.lag,fixedDate:t.fixed_date||undefined,owner:t.owner,deliverable:t.deliverable,status:t.status,progress:t.progress,deps:depMap[t.id]||[],requirements:reqMap[t.id]||[]}))};
  PROJECT.tracks=(await sb.from('pmo_project_tracks').select('*').eq('project_id',p.id).order('sort')).data||[];
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
async function setDependencies(projectId, taskDbId, dependsOnDbIds){
  // نحذف القديمة ثم نضيف الجديدة
  await sb.from('pmo_dependencies').delete().eq('task_id',taskDbId);
  if(dependsOnDbIds.length){
    const rows=dependsOnDbIds.map(d=>({project_id:projectId,task_id:taskDbId,depends_on_id:d}));
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
  const rows=tasks.map((t,i)=>({project_id:projectId,ref:t.ref,name:t.name||t.ref,
    track:t.track||'0',type:t.type||'task',duration:t.duration||0,
    deliverable:t.deliverable||null,owner:t.owner||null,sort_order:i+1}));
  const {data,error}=await sb.from('pmo_tasks').insert(rows).select('id,ref');
  if(error) throw error;
  const map={};(data||[]).forEach(r=>{map[r.ref]=r.id;});
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

// ===== النقاش (تعليقات/أسئلة/مقترحات) =====
async function loadComments(projectId){
  const {data}=await sb.from('pmo_comments').select('*').eq('project_id',projectId).order('created_at');
  return data||[];
}
async function addComment(projectId, kind, body, parentId){
  const row={project_id:projectId,kind,body,parent_id:parentId||null,
    author_id:USER.id,author_email:USER._name||USER.email,author_role:ROLE};
  const {error}=await sb.from('pmo_comments').insert(row);
  if(error) throw error;
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
  if(!projectIds.length) return {tasks:[],deps:[]};
  const [tasksR,depsR]=await Promise.all([
    sb.from('pmo_tasks').select('id,ref,name,track,type,duration,status,sort_order,project_id').in('project_id',projectIds),
    sb.from('pmo_dependencies').select('task_id,depends_on_id,project_id').in('project_id',projectIds)
  ]);
  return {tasks:tasksR.data||[],deps:depsR.data||[]};
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
async function renderPortfolioGantt(){
  try{await loadScript('pgantt.js?v='+BUILD_V);await window.pganttOpen();}
  catch(e){toast('تعذّر تحميل الخط الزمني الشامل','err');}
}


/* ===== views.js ===== */
// ===== العرض =====
const VIEW_LABELS={dashboard:'لوحة القيادة',table:'الجدول (MS Project)',gantt:'مخطط جانت',deliv:'المخرجات والمعالم',cr:'طلبات التغيير',requests:'طلبات العميل',discuss:'النقاش',audit:'سجل التدقيق'};
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
  $('#tabs').innerHTML=views.map(v=>`<button class="tab ${v===VIEW?'active':''}" role="tab" aria-selected="${v===VIEW}" data-v="${v}">${VIEW_LABELS[v]}</button>`).join('');
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
  else if(VIEW==='gantt'){host.innerHTML=gToolbar()+vGantt();bindProjFilterBar();$('#zin').onclick=()=>{PX=Math.min(40,PX+4);render();};$('#zout').onclick=()=>{PX=Math.max(10,PX-4);render();};
    const pgb=$('#printGanttBtn');if(pgb)pgb.onclick=()=>printProject('gantt');}
  else if(VIEW==='deliv')host.innerHTML=vDeliv();
  else if(VIEW==='cr'){host.innerHTML=vCR();bindCR();}
  else if(VIEW==='discuss'){
    host.innerHTML='<div id="discussWrap"><div class="skeleton" style="height:80px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    loadComments(PROJECT._dbId).then(rows=>{const el=document.getElementById('discussWrap');if(el){el.innerHTML=vDiscuss(rows);bindDiscuss();}});
  }
  else if(VIEW==='requests'){
    host.innerHTML='<div id="reqWrap"><div class="skeleton" style="height:80px;margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div></div>';
    loadClientRequests(PROJECT._dbId).then(rows=>{const el=document.getElementById('reqWrap');if(el){el.innerHTML=vRequests(rows);bindRequests();}});
  }
  else if(VIEW==='audit'){
    host.innerHTML='<div class="hintbar">آخر 60 تغييرًا مسجّلًا تلقائيًا (الحالة، التقدّم، المدة، طلبات التغيير).</div><div id="auditList"><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px"></div></div>';
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
function filteredTasks(){return PROJECT.tasks.filter(taskMatchesFilter);}
function projFilterBar(){
  const total=PROJECT.tasks.length, shown=filteredTasks().length;
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
}

function vTable(){
  const S=SCHED,T=TRACK;const editStruct=can('editStruct')&&PROJECT.status!=='baselined';const editProg=can('editProg');
  const colspan=editStruct?12:11;
  let rows='',last=null;
  PROJECT.tasks.forEach(t=>{
    if(t.track!==last){last=t.track;rows+=`<tr class="grp"><td colspan="${colspan}">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</td></tr>`;}
    const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
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
      <td>${nameCell}</td>
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
  const editHead=editStruct?'<th>تحرير</th>':'';
  const addBar=editStruct?`<div class="lockbar" style="border-inline-start-color:var(--ok)"><span>أداة بناء الخطة:</span><button class="reqbtn" id="addTaskBtn" style="background:var(--ok);border-color:var(--ok);color:#fff">+ إضافة بند</button><button class="reqbtn" id="importXlsxBtn" style="background:var(--blue);border-color:var(--blue);color:#fff">${I.upload} استيراد من Excel</button>${ROLE==='pmo'?'<button class="reqbtn" id="tracksBtn" style="background:var(--ink);border-color:var(--ink);color:#fff">إدارة المراحل</button>':''}<span style="color:var(--muted);font-weight:400;font-size:.78rem">المعرّف فريد (مثل B10). أو استورد خطة كاملة من ملف Excel.</span></div>`:'';
  const printBtn=`<div class="lockbar" style="border-inline-start-color:var(--line)"><button class="hbtn print-btn" id="printTableBtn">🖨 طباعة الجدول</button><span style="color:var(--muted);font-weight:400;font-size:.78rem">تُطبع كل مرحلة في صفحة، والأعمدة مصغّرة للقراءة.</span></div>`;
  return addBar+printBtn+projFilterBar()+`<div class="tablewrap"><table id="tbl"><thead><tr><th>المعرف</th><th>الاسم</th><th>النوع</th><th>مدة</th><th>بداية</th><th>نهاية</th><th>الحالة</th><th>تقدّم</th><th>التأخير</th><th>متطلبات</th><th>المخرج</th>${editHead}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function bindTable(){
  bindProjFilterBar();
  const editStruct=can('editStruct')&&PROJECT.status!=='baselined';
  $$('#tbl tr[data-id]').forEach(tr=>{
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
  const ptb=$('#printTableBtn');if(ptb)ptb.onclick=()=>printProject('table');
}

function gToolbar(){return `<div class="gctrl"><div class="hintbar" style="margin:0">الزمن من اليمين للأقدم · لون النقطة=الحالة · الخط الأزرق=اليوم · الشريط الرفيع=الأساس المعتمد.</div><button class="hbtn print-btn" id="printGanttBtn" style="margin-inline-start:auto">🖨 طباعة الجانت</button><div class="zoom"><button class="zb" id="zout">−</button><button class="zb" id="zin">+</button></div></div>`;}
function vGantt(){
  const S=SCHED,T=TRACK,start=S.pStart,end=S.pEnd,oneDay=86400000,dd=D(DATA_DATE);
  const lo=start<dd?start:dd,hi=end>dd?end:dd,totalDays=Math.round((hi-lo)/oneDay)+3,W=totalDays*PX;
  const off=d=>Math.round((new Date(d)-lo)/oneDay);
  const MN=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  let months='',weeks='',grid='';let d=new Date(lo);
  while(d<=hi){const ms=off(d);const nx=new Date(d.getFullYear(),d.getMonth()+1,1);const se=nx>hi?hi:new Date(nx-oneDay);const days=Math.round((se-d)/oneDay)+1;months+=`<div class="mhead" style="right:${ms*PX}px;width:${days*PX}px">${MN[d.getMonth()]} ${d.getFullYear()}</div>`;d=nx;}
  let wk=new Date(lo),wi=1;while(wk<=hi){weeks+=`<div class="whead" style="right:${off(wk)*PX}px;width:${7*PX}px"><b>أسبوع ${wi}</b><s>${fmt(wk)}</s></div>`;grid+=`<div class="vg" style="right:${off(wk)*PX}px"></div>`;wk=new Date(wk.getTime()+7*oneDay);wi++;}
  const today=`<div class="today" style="right:${off(dd)*PX}px"><span>اليوم ${fmt(dd)}</span></div>`;
  const BL=PROJECT.baseline?PROJECT.baseline.snapshot:null;let rows='',last=null; const _fg=filteredTasks();
  _fg.forEach(t=>{const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color;
    if(t.track!==last){last=t.track;rows+=`<div class="grow grp"><div class="glbl">${trackMeta(t.track).code} — ${esc(trackMeta(t.track).name)}</div><div class="glane"></div></div>`;}
    const o=off(r.ES);const tip=`${esc(t.name)} — ${fmt(r.ES)}–${fmt(r.EF)} | ${STATUS[k.effStatus]}`;
    let lane='';
    if(BL&&BL[t.id]&&t.type!=='milestone'){const bo=off(D(BL[t.id].ES)),bl=Math.max(1,Math.round((D(BL[t.id].EF)-D(BL[t.id].ES))/oneDay)+1);lane+=`<div class="blbar" style="right:${bo*PX}px;width:${bl*PX}px"></div>`;}
    if(t.type==='milestone')lane+=`<div class="gmile ${r.critical?'crit':''}" style="right:${o*PX-7}px" title="${tip}"><span class="md">◆</span><span class="ml">${esc(t.id)}</span></div>`;
    else{const len=Math.max(1,Math.round((new Date(r.EF)-new Date(r.ES))/oneDay)+1),wpx=len*PX;const cls=(t.type==='cont')?'cont':k.effStatus;const prog=t.type==='cont'?0:((k&&k.dispPct)||t.progress||0);
      const fill=(k.effStatus==='inprogress'&&prog>0)?`<div class="fill" style="width:${prog}%"></div>`:'';
      const durTxt=(t.type==='cont')?'مستمر':(t.duration+' ي'+(prog?' · '+prog+'%':''));const inside=wpx>56;
      const durEl=inside?`<div class="gdur inside" style="right:${o*PX+6}px">${durTxt}</div>`:`<div class="gdur" style="right:${(o+len)*PX+4}px">${durTxt}</div>`;
      lane+=`<div class="gbar ${cls} ${r.critical?'crit':''}" style="right:${o*PX}px;width:${wpx}px;background:${tc}" title="${tip}">${fill}</div>${durEl}`;}
    rows+=`<div class="grow"><div class="glbl"><span class="sdot ${k.effStatus}"></span><span class="gw" style="--tc:${tc}">${esc(t.wbs||t.id)}</span>${esc(t.name)}</div><div class="glane">${lane}</div></div>`;});
  return projFilterBar()+`<div class="gantt"><div class="gscroll"><div style="min-width:${280+W}px">
    <div class="thead"><div class="corner"><span>حزمة العمل</span><span class="dir">الأقدم ← الأحدث</span></div><div class="tl" style="width:${W}px">${months}${weeks}</div></div>
    <div style="position:relative"><div style="position:absolute;right:280px;left:0;top:0;bottom:0;pointer-events:none">${grid}${today}</div>${rows}</div></div></div>
    <div class="glegend"><span><span class="di"></span>معلم</span><span><span class="ci"></span>حرج</span>${BL?'<span><i class="blleg"></i>الأساس المعتمد</span>':''}<span><span class="dot" style="background:#cbbfa6"></span>لم تبدأ</span><span><span class="dot" style="background:var(--blue)"></span>جارية</span><span><span class="dot" style="background:var(--crit)"></span>متوقفة</span><span><span class="dot" style="background:var(--ok)"></span>مكتملة</span></div></div>`;
}

function vDeliv(){
  const S=SCHED,T=TRACK;let rows='';
  PROJECT.tasks.forEach(t=>{if(!t.deliverable)return;const r=S.R[t.id],k=T[t.id],tc=trackMeta(t.track).color,isM=t.type==='milestone';
    rows+=`<tr class="${isM?'m':''}"><td style="font-weight:${isM?700:500}">${isM?'◆ ':''}${esc(t.deliverable)}</td><td><span class="idcell" style="--tc:${tc}">${esc(t.id)}</span> ${esc(t.name)}</td><td><span class="pill" style="background:${tc}">${esc(trackMeta(t.track).name)}</span></td><td>${fmt(r.EF)}/${new Date(r.EF).getFullYear()}</td><td><span class="ministat s-${k.effStatus}">${STATUS[k.effStatus]}</span></td></tr>`;});
  return `<div class="dwrap"><table class="dtbl"><thead><tr><th>المخرج</th><th>البند</th><th>المسار</th><th>التسليم المتوقع</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function vAudit(rows){
  if(!rows||!rows.length)return '<p class="empty" style="padding:20px;text-align:center">لا تغييرات مسجّلة بعد.</p>';
  const ACT={status_change:'تغيير الحالة',progress_change:'تحديث التقدّم',duration_change:'تغيير المدة',cr_created:'طلب تغيير جديد',cr_approved:'الموافقة على طلب',cr_rejected:'رفض طلب',cr_pending:'طلب معلّق'};
  const ENT={task:'بند',change_request:'طلب تغيير'};
  // خريطة معرّف البند → اسمه (للعرض المفهوم)
  const taskById={};PROJECT.tasks.forEach(t=>{taskById[t._dbId]=t;});
  const rowsHtml=rows.map(a=>{
    const act=ACT[a.action]||a.action;
    let detail='';
    if(a.action==='status_change'&&a.old_value&&a.new_value){detail=`${STATUS[a.old_value.status]||a.old_value.status} ← ${STATUS[a.new_value.status]||a.new_value.status}`;}
    else if(a.action==='progress_change'&&a.new_value){detail=`${a.old_value?a.old_value.progress:0}% ← ${a.new_value.progress}%`;}
    else if(a.action==='duration_change'&&a.new_value){detail=`${a.old_value?a.old_value.duration:'?'} ← ${a.new_value.duration} يوم`;}
    else if(a.action==='cr_created'&&a.new_value){detail=esc(a.new_value.reason||a.new_value.kind||'');}
    const t=a.entity==='task'?taskById[a.entity_id]:null;
    const target=t?(esc(t.id)+' — '+esc(t.name)):(ENT[a.entity]||a.entity);
    const when=new Date(a.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'});
    return `<tr>
      <td style="white-space:nowrap;font-size:.76rem;color:var(--muted)">${when}</td>
      <td><span class="crstate ${a.action.startsWith('cr_')?(a.action==='cr_approved'?'approved':a.action==='cr_rejected'?'rejected':'pending'):'pending'}" style="font-size:.7rem">${act}</span></td>
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
  return composer+'<div class="crlist">'+cards+'</div>';
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


/* ===== state.js ===== */
// ===== app/state.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
// ===== الحالة =====
let USER=null,ROLE=null,IS_OWNER=false,CLIENTS=[],CID=null,PID=null,PROJECT=null,SCHED=null,TRACK=null,DATA_DATE=todayISO(),PX=20,VIEW='dashboard',CRS=[],PFILTER='all',PSEARCH='',PEXPANDED=new Set(),PALERTS=new Set(),PSORT='alerts';
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


/* ===== portfolio.js ===== */
// ===== app/portfolio.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
async function renderPortfolio(){
  SCREEN='portfolio';
  $('#hProject').textContent='محفظة المشاريع';
  $('#barClient').style.display='none';hideChrome();
  const isStaff=(ROLE==='pmo'||ROLE==='delivery');
  const leadsBtn=(ROLE==='pmo')?'<button class="reqbtn" id="showLeads">'+I.users+' العملاء المحتملون</button>':'';
  const dolBtn=isStaff?'<button class="reqbtn" id="showDOL" style="background:var(--crit);border-color:var(--crit);color:#fff">'+I.scale+' طبقة القرار (DOL)</button>':'';
  const auditBtn=isStaff?'<button class="reqbtn" id="showAudit">'+I.clipboard+' سجل التدقيق</button>':'';
  const pgBtn=isStaff?'<button class="reqbtn" id="showPGantt" style="background:var(--blue);border-color:var(--blue);color:#fff">'+I.calendar+' الخط الزمني الشامل</button>':'';
  const archBtn=(ROLE==='pmo')?'<button class="reqbtn" id="showArchived">'+I.archive+' المؤرشفة</button>':'';
  // هيكل skeleton فوري (تجربة أسرع بصريًا)
  const skel=CLIENTS.map(()=>'<div class="pcard"><div class="skeleton" style="height:22px;width:55%;margin-bottom:14px"></div><div class="skeleton" style="height:8px;margin-bottom:12px"></div><div class="skeleton" style="height:36px"></div></div>').join('');
  const addClientBtn=(ROLE==='pmo')?'<button class="reqbtn" id="addClientBtn" style="background:var(--ok);border-color:var(--ok);color:#fff">+ عميل جديد</button>':'';
  const toolbar=isStaff?`<div class="portfolio-tools">${addClientBtn}${pgBtn}${dolBtn}${auditBtn}${archBtn}${leadsBtn}</div>`:'';
  $('#host').innerHTML='<div class="hintbar">اختر عميلًا لعرض لوحة مشروعه الكاملة.'+toolbar+'</div><div class="pgrid" id="pgrid">'+skel+'</div>';
  if(ROLE==='pmo'){const lb=$('#showLeads');if(lb)lb.onclick=renderLeads;
    const ac=$('#addClientBtn');if(ac)ac.onclick=addNewClient;}
  {const db=$('#showDOL');if(db)db.onclick=openDOL;}
  {const ab=$('#showAudit');if(ab)ab.onclick=renderAuditLog;}
  {const arb=$('#showArchived');if(arb)arb.onclick=renderArchived;}
  {const pg=$('#showPGantt');if(pg)pg.onclick=renderPortfolioGantt;}
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
  let companies=Object.keys(groups).map(cid=>{
    const list=groups[cid]; const r0=list[0];
    const c=CLIENTS.find(x=>x.id===cid)||{name:r0.client_name,color:r0.color||'#C8A06B'};
    // مجاميع الشركة
    const tot=list.reduce((s,r)=>s+Number(r.total_tasks||0),0);
    const done=list.reduce((s,r)=>s+Number(r.done_tasks||0),0);
    const blocked=list.reduce((s,r)=>s+Number(r.blocked_tasks||0),0);
    const reqs=list.reduce((s,r)=>s+Number(r.pending_client_reqs||0),0);
    const comments=list.reduce((s,r)=>s+Number(r.open_comments||0),0);
    const hasAlerts=blocked>0||reqs>0||comments>0;
    const isActive=list.some(r=>r.lifecycle==='active'||r.lifecycle==='approved');
    const isDraft=list.some(r=>r.status==='draft'||r.lifecycle==='proposal');
    return {cid,c,list,tot,done,blocked,reqs,comments,hasAlerts,isActive,isDraft,
      pct:tot>0?Math.round(done/tot*100):0};
  });
  // العملاء بلا مشاريع: بطاقة دعوة لإضافة أول مشروع
  noProjRows.forEach(r=>{
    const c=CLIENTS.find(x=>x.id===r.client_id)||{name:r.client_name,color:r.color||'#C8A06B'};
    companies.push({cid:r.client_id,c,list:[],tot:0,done:0,blocked:0,reqs:0,comments:0,
      hasAlerts:false,isActive:false,isDraft:true,pct:0,noProjects:true});
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

  shown.forEach(x=>{
    const multi=x.list.length>1;
    const expanded=PEXPANDED.has(x.cid);
    const alertBadges=[];
    if(x.blocked>0)alertBadges.push(`<span class="palert red">${x.blocked} متوقف</span>`);
    if(x.reqs>0)alertBadges.push(`<span class="palert amber">${x.reqs} متطلب</span>`);
    if(x.comments>0)alertBadges.push(`<span class="palert blue">${x.comments} نقاش</span>`);
    const actBtn=(ROLE==='pmo')?`<button class="pcard-menu" data-cmenu="${x.cid}" title="إجراءات" aria-label="إجراءات العميل">${I.dots}</button>`:'';
    const card=document.createElement('div');
    card.className='pcompany'+(expanded?' expanded':'')+(x.hasAlerts?' has-alerts':'');
    card.style.cssText=`--cc:${x.c.color}`;
    card.innerHTML=`
      <div class="pcompany-hd" data-toggle="${x.cid}" role="button" tabindex="0" aria-expanded="${expanded}">
        <span class="pdot" style="background:${x.c.color}"></span>
        <div class="pcompany-info">
          <h3>${esc(x.c.name)}</h3>
          <span class="pcompany-sub">${x.noProjects?'لا مشاريع بعد — انقر لإضافة أول مشروع':(multi?x.list.length+' مشاريع':esc(x.list[0].project_name||'مشروع واحد'))+' · '+x.tot+' بند'}</span>
        </div>
        <div class="pcompany-side">
          ${alertBadges.length?`<div class="palerts">${alertBadges.join('')}</div>`:''}
          ${x.noProjects?'':`<div class="pcompany-pct"><b>${x.pct}%</b><div class="pbar mini" role="progressbar" aria-valuenow="${x.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة الإنجاز"><div class="pbar-fill" style="width:${x.pct}%"></div></div></div>`}
          ${x.noProjects?'<span class="pcompany-chev">+</span>':(multi?`<span class="pcompany-chev">${expanded?'▴':'▾'}</span>`:'<span class="pcompany-chev">←</span>')}
          ${actBtn}
        </div>
      </div>
      ${multi?`<div class="pcompany-body" style="display:${expanded?'block':'none'}">${x.list.map(projRow).join('')}${ROLE==='pmo'?`<button class="reqbtn" data-addproj="${x.cid}" style="margin:6px 2px;background:var(--ok);border-color:var(--ok);color:#fff">+ مشروع جديد</button>`:''}</div>`:''}
    `;
    grid.appendChild(card);
  });

  // التفاعل: ترويسة الشركة — توسّع (متعدد) أو تدخل مباشرة (مفرد)
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=async(e)=>{
    if(e.target.closest('[data-cmenu]'))return;
    const cid=el.dataset.toggle;
    const comp=shown.find(x=>x.cid===cid); if(!comp)return;
    if(!comp.list.length){ openClientMenu(cid); return; }
    if(comp.list.length===1){ CID=cid; PID=comp.list[0].project_id; await openProject(); return; }
    if(PEXPANDED.has(cid))PEXPANDED.delete(cid); else PEXPANDED.add(cid);
    renderPortfolio();
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

async function openProject(){
  TFILTER={phases:new Set(),statuses:new Set(),smart:new Set(),q:''};
  $('#loader').classList.remove('hidden');
  await loadProject(CID,PID);
  $('#loader').classList.add('hidden');
  SCREEN='project';$('#barClient').style.display='';showChrome();
  render();
}

// تعديل تاريخ بدء المشروع — المصدر الوحيد للحقيقة، يعيد حساب كل التواريخ

async function editStartDate(){
  if(PROJECT.status==='baselined'){ toast('الخطة مثبّتة — تعديل التاريخ يتطلب طلب تغيير','warn'); return; }
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

async function renderAuditLog(){
  SCREEN='audit';$('#hProject').textContent='سجل التدقيق';hideChrome();
  $('#host').innerHTML='<div class="hintbar"><button class="reqbtn" id="backP">↩ المحفظة</button><span style="margin-inline-start:auto">كل الأفعال الحسّاسة عبر المكتب — من فعل، ماذا، ومتى.</span></div><div id="auditList"><div class="skeleton" style="height:40px;margin-bottom:6px"></div><div class="skeleton" style="height:40px;margin-bottom:6px"></div><div class="skeleton" style="height:40px"></div></div>';
  $('#backP').onclick=renderPortfolio;
  const rows=await fetchAuditLog(150);
  const list=$('#auditList');
  if(!rows.length){list.innerHTML='<div class="empty-cta"><div class="ico">'+I.clipboard+'</div><h3>السجل فارغ</h3><p>الأفعال الحسّاسة (حذف، أرشفة، تعليقات، طلبات) ستظهر هنا.</p></div>';return;}
  const fmt=ts=>{const d=new Date(ts);return d.toLocaleDateString('ar-SA-u-ca-gregory',{year:'numeric',month:'short',day:'numeric'})+' · '+d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});};
  list.innerHTML='<div class="audit-table">'+rows.map(r=>{
    const label=AUDIT_LABELS[r.action]||r.action;
    const detail=(r.new_value&&(r.new_value.name||r.new_value.body||r.new_value.description||r.new_value.title))||(r.old_value&&(r.old_value.name||r.old_value.body||r.old_value.description))||'';
    const isCrit=/purge|delete/.test(r.action);
    return `<div class="audit-row"><span class="audit-act ${isCrit?'crit':''}">${label}</span><span class="audit-ent">${r.entity||''}</span><span class="audit-detail">${detail?esc(String(detail).slice(0,80)):''}</span><span class="audit-time">${fmt(r.created_at)}</span></div>`;
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
    message:'سيتحوّل المشروع إلى «نشط» وتُجمّد الخطة كخط أساس. بعدها أي تعديل على البنية يتطلب طلب تغيير رسمي.',
    fields:[{key:'val',label:'قيمة العقد (ر.س) — اختياري',type:'number',value:'',placeholder:'مثال: 571400'}],
    confirmText:'اعتماد وتثبيت'});
  if(!r)return;
  const val=r.val;
  const snap={};PROJECT.tasks.forEach(t=>{const rr=SCHED.R[t.id];snap[t.id]={duration:t.duration,ES:fmtY(rr.ES),EF:fmtY(rr.EF)};});
  const {error}=await rpcApproveContract(PROJECT._dbId, val?parseFloat(val):null, snap);
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
    const {error}=await insertCR({project_id:PROJECT._dbId,task_ref:$('#crTask').value,kind:$('#crKind').value,new_value:$('#crVal').value,reason});
    if(error){toast('تعذّر الإرسال: '+error.message,'err');return;}
    CRS=await fetchCRs(PROJECT._dbId);
    render();
  };
  $$('[data-ap]').forEach(b=>b.onclick=async()=>{
    const c=CRS.find(x=>x.id===b.dataset.ap);
    // تطبيق آلي لتغيير المدة
    if(c.kind==='duration'&&c.task_ref){const t=PROJECT.tasks.find(x=>x.id===c.task_ref);
      if(t&&t._dbId){const nv=parseInt(c.new_value||t.duration,10);await updateTaskFields(t._dbId,{duration:nv});}}
    await decideCR(c.id,{status:'approved',decision_note:'طُبّق',decided_at:new Date().toISOString()});
    await loadProject(CID);render();
  });
  $$('[data-rj]').forEach(b=>b.onclick=async()=>{
    await decideCR(b.dataset.rj,{status:'rejected',decided_at:new Date().toISOString()});
    CRS=await fetchCRs(PROJECT._dbId);
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
      {key:'duration',label:'المدة (أيام عمل)',type:'number',value:'1'}
    ],confirmText:'إضافة'});
  if(!r)return;
  if(!r.ref){toast('المعرّف مطلوب','warn');return;}
  if(PROJECT.tasks.some(t=>t.id===r.ref)){toast('المعرّف مستخدم بالفعل','warn');return;}
  const _d=parseInt(r.duration||'1',10);
  if(r.type==='task'&&(!_d||_d<1)){toast('مدة المهمة لا تقل عن يوم واحد — للأحداث اللحظية استخدم نوع «معلم»','warn');return;}
  try{
    await addTask(PROJECT._dbId,{ref:r.ref,name:r.name||'بند جديد',track:r.track,type:r.type,duration:parseInt(r.duration||'1',10)});
    await loadProject(CID);
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
  try{
    await deleteTask(t._dbId);
    await loadProject(CID);
    toast('حُذف البند','ok');
    render();
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
  $('#depList').innerHTML=opts.map(t=>`<label style="display:flex;align-items:center;gap:9px;padding:8px 11px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px;cursor:pointer;font-size:.84rem">
    <input type="checkbox" data-dep="${esc(t.id)}" ${current.has(t.id)?'checked':''}>
    <span class="idcell" style="--tc:${TRACKS[t.track].color}">${esc(t.id)}</span> ${esc(t.name)}</label>`).join('')||'<p class="empty">لا بنود متاحة.</p>';
}
$('#depSave').onclick=async()=>{
  const checked=[...document.querySelectorAll('#depList [data-dep]:checked')].map(c=>c.dataset.dep);
  // تحويل المعرّفات (ref) إلى dbIds
  const dbIds=checked.map(ref=>{const t=PROJECT.tasks.find(x=>x.id===ref);return t?t._dbId:null;}).filter(Boolean);
  try{
    await setDependencies(PROJECT._dbId,DEP_TASK._dbId,dbIds);
    await loadProject(CID);
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

