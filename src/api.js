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
    tasks:(()=>{const _refOf={};tasks.forEach(x=>{_refOf[x.id]=x.ref;});
      return tasks.map(t=>({id:t.ref,_dbId:t.id,parent:t.parent_id?(_refOf[t.parent_id]||null):null,_sortOrder:t.sort_order,wbs:t.wbs,name:t.name,track:t.track,type:t.type,duration:t.duration,lag:t.lag,fixedDate:t.fixed_date||undefined,owner:t.owner,deliverable:t.deliverable,status:t.status,progress:t.progress,deps:depMap[t.id]||[],requirements:reqMap[t.id]||[]}));})()};
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
