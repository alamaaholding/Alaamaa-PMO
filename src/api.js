// ===== api.js — الوصول إلى البيانات =====
// المصادقة وبوابة الدخول انتقلتا إلى app/session.js (الموجة W2): لم تكونا من
// عمل هذا الملف، وكانتا وحدهما ما يربطه بالملفات غير المُحوَّلة.

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
    sb.from('pmo_tasks').select('id,ref,wbs,name,track,type,duration,lag,fixed_date,owner,deliverable,status,progress,sort_order,parent_id,job_role_id').eq('project_id',p.id).order('sort_order'),
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
  PROJECT={_dbId:p.id,name:p.name,slug:p.slug,start:p.start_date,status:p.status,lifecycle:p.lifecycle,contractValue:p.contract_value,
    lifecycleState:p.lifecycle_state||'active',
    trelloLastSync:p.trello_last_synced_at,
    baseline:(bl&&bl.length)?{snapshot:bl[bl.length-1].snapshot}:null,
    baselines:bl||[],
    tasks:(()=>{const _refOf={};tasks.forEach(x=>{_refOf[x.id]=x.ref;});
      return tasks.map(t=>({id:t.ref,_dbId:t.id,parent:t.parent_id?(_refOf[t.parent_id]||null):null,_sortOrder:t.sort_order,wbs:t.wbs,name:t.name,track:t.track,type:t.type,duration:t.duration,lag:t.lag,fixedDate:t.fixed_date||undefined,owner:t.owner,deliverable:t.deliverable,roleId:t.job_role_id||null,status:t.status,progress:t.progress,deps:depMap[t.id]||[],depsX:depMapX[t.id]||[],requirements:reqMap[t.id]||[]}));})()};
  PROJECT.tracks=(await sb.from('pmo_project_tracks').select('*').eq('project_id',p.id).order('sort')).data||[];
  // إصلاح ذاتي: مرحلة كل بند = مرجع أعلى سلف له في WBS الفعلي (عبر parent_id الحقيقي)،
  // لا القيمة المخزّنة في عمود track التي قد تكون انحرفت عن الهرمية الحقيقية (استيراد سابق قبل هذا الإصلاح،
  // تعديل يدوي، إلخ). هذا يصحّح فورًا أي مشروع قديم بلا أي هجرة بيانات.
  {const byRef={};PROJECT.tasks.forEach(t=>{byRef[t.id]=t;});
   PROJECT.tasks.forEach(t=>{t.track=taskTopAncestor(t,byRef);});}
  // شارات التبويبات: عدّ خفيف لا يجلب صفوفًا
  PROJECT.counts={cr:CRS.filter(x=>x.status==='pending').length,discuss:0,requests:0};
  try{Object.assign(PROJECT.counts,await fetchProjectCounts(p.id));}catch(e){}
  // المسمّيات لازمة لعمود الإسناد في الجدول — تُجلب مرة وتُخزَّن
  try{await fetchRolesFlat();}catch(e){}
}
function compute(){SCHED=scheduleTasks(PROJECT.tasks,PROJECT.start);TRACK=computeTracking(PROJECT.tasks,SCHED,DATA_DATE);}

// ===== التكامل: الشركاء المحتملون (submissions) =====
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

// ===== طلبات الشريك الموجّهة للأقسام (المرحلة 3) =====
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
// وصول الشريك
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
async function deleteDecision(id){ return await sb.from('pmo_v2_decisions').delete().eq('id',id); }
async function evaluateDecision(gateId,values){ return await sb.rpc('pmo_v2_evaluate_decision',{p_gate_id:gateId,p_values:values}); }
async function insertDeviation(row){ return await sb.from('pmo_v2_deviations').insert(row); }
async function fetchDecisionLinks(decisionId){ return (await sb.from('pmo_v2_decision_links').select('*').eq('decision_id',decisionId)).data||[]; }
async function insertDecisionLink(row){ return await sb.from('pmo_v2_decision_links').insert(row); }

// ===== دورة حياة الشريك + المالك + سجل التدقيق (المرحلة 1) =====
async function rpcArchiveClient(clientId){ return await sb.rpc('pmo_archive_client',{p_client:clientId}); }
async function rpcRestoreClient(clientId){ return await sb.rpc('pmo_restore_client',{p_client:clientId}); }
async function rpcRequestDeletion(clientId){ return await sb.rpc('pmo_request_deletion',{p_client:clientId}); }
async function rpcPurgeClient(clientId){ return await sb.rpc('pmo_purge_client',{p_client:clientId}); }
async function checkIsOwner(){ const {data}=await sb.rpc('pmo_is_owner'); return data===true; }
// شركاء حسب الحالة (نشط/مؤرشف/بانتظار حذف)
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

// ===== إدارة الشركاء والمشاريع من الواجهة (سدّ فجوات الرحلة) =====
async function updateClientInfo(id, patch){
  const {error}=await sb.from('pmo_clients').update(patch).eq('id',id);
  if(error) throw error;
}
async function insertClient(name, color){
  const slug=uniqueSlug(name, CLIENTS);
  const {data,error}=await sb.from('pmo_clients')
    .insert({name,color:color||'#C8A06B',slug,lifecycle_state:'active'}).select().single();
  if(error) throw error; return data;
}
async function insertProjectForClient(clientId, name, startDate){
  const {data:siblings}=await sb.from('pmo_projects').select('slug').eq('client_id',clientId);
  const slug=uniqueSlug(name, siblings||[]);
  const {data,error}=await sb.from('pmo_projects')
    .insert({client_id:clientId,name,start_date:startDate,status:'draft',lifecycle:'proposal',slug})
    .select().single();
  if(error) throw error; return data;
}

// ===== دورة حياة المشروع + المراحل الديناميكية =====
async function rpcArchiveProject(id){return await sb.rpc('pmo_archive_project',{p_project:id});}
async function rpcRestoreProject(id){return await sb.rpc('pmo_restore_project',{p_project:id});}
async function rpcRequestProjectDeletion(id){return await sb.rpc('pmo_request_project_deletion',{p_project:id});}
async function rpcPauseProject(id,reason){return await sb.rpc('pmo_pause_project',{p_project_id:id,p_reason:reason||null});}
async function rpcResumeProject(id){return await sb.rpc('pmo_resume_project',{p_project_id:id});}
async function rpcPurgeProject(id){return await sb.rpc('pmo_purge_project',{p_project:id});}
async function renameProject(id,name){const{error}=await sb.from('pmo_projects').update({name}).eq('id',id);if(error)throw error;}
async function fetchProjectSlug(id){
  const {data}=await sb.from('pmo_projects').select('slug').eq('id',id).maybeSingle();
  return (data&&data.slug)||'';
}
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
// ===== الفريق والإسناد (داخلي — لا يراه الشريك) =====
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

// ===== العقود والتوقيع الإلكتروني =====
async function sha256Hex(str){
  if(!window.crypto||!window.crypto.subtle)return null; // بيئة لا تدعم Web Crypto — تحسيني لا حرج
  try{
    // window.crypto صراحةً لا crypto العام: الحارس أعلاه يفحص window.crypto، وفي بعض
    // البيئات لا يشير المعرّف العام لنفس الكائن — فيمرّ الفحص ثم يفشل الاستدعاء صامتًا
    // وتعود التجزئة null، أي تعطيل صامت لكل آلية إثبات عدم التلاعب.
    const buf=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){return null;}
}
// يحسب نفس التجزئة من بيانات عقد معيَّن — يُستخدَم عند الإنشاء وعند التحقّق لاحقًا
// التجزئة تُحسب من النص المدموج النهائي — الذي يعكس أصلًا النموذج المختار وتعديلات البنود
// وبيانات الطرفين كلها. فأي تغيير في أيٍّ منها يغيّرها حتمًا (كانت تتجاهل النموذج والبنود
// لأن mergeContract لم تكن تتلقاهما أصلًا).
async function computeContractHash(mergeData){
  const merged=mergeContract(mergeData);
  return sha256Hex(JSON.stringify(merged));
}
// بناء بيانات الدمج من صفّ عقد كامل — مصدر واحد يضمن تطابق التجزئة أينما حُسبت
function contractMergeData(c){
  return {
    clientName:c.client_name,clientCr:c.client_cr,clientVat:c.client_vat,clientAddress:c.client_address,
    clientRepName:c.client_rep_name,clientRepTitle:c.client_rep_title,
    clientEmail:c.client_contact_email,clientPhone:c.client_contact_phone,
    org:c.org||{},
    includesAdSpend:c.includes_ad_spend,effectiveDate:c.effective_date,
    contractValue:c.contract_value,latePaymentCap:c.late_payment_cap,specialTerms:c.special_terms,
    templateKey:c.template_key,clauseOverrides:c.clause_overrides
  };
}
// (١) ختم النص المدموج في القاعدة — بعده يُعرَض منه لا من القالب، فلا يتغيّر نص عقد موقَّع
// أبدًا مهما عُدِّل القالب لاحقًا.
async function sealContract(c){
  const isCustom=c.contract_type==='custom';
  const body=isCustom
    ? {kind:'custom',title:c.custom_title,body:c.custom_body,org:c.org||{},
       clientName:c.client_name,clientCr:c.client_cr,clientVat:c.client_vat,clientAddress:c.client_address,
       clientRepName:c.client_rep_name,clientRepTitle:c.client_rep_title,
       clientEmail:c.client_contact_email,clientPhone:c.client_contact_phone}
    : Object.assign({kind:'standard'},mergeContract(contractMergeData(c)));
  const hash=await sha256Hex(JSON.stringify(body));
  const {data,error}=await sb.rpc('pmo_seal_contract',{p_contract_id:c.id,p_body:body,p_hash:hash});
  if(error)throw error;
  return data||{};
}
// إنشاء شامل: يدعم نطاقَي مشروع/شريك كامل، ونوعَي قياسي/مخصَّص بنص حر — دالة واحدة لكل الحالات
async function createContractV2(opts){
  opts=opts||{};
  const client=opts.clientRow||{};
  let hash;
  if(opts.contractType==='custom'){
    hash=await sha256Hex(JSON.stringify({title:opts.customTitle,body:opts.customBody,client:client.name}));
  }else{
    hash=await computeContractHash({
      clientName:client.name,clientCr:client.cr_number,clientAddress:client.national_address_short,
      clientRepName:client.rep_name,clientRepTitle:client.rep_title,clientEmail:client.contact_email,clientPhone:client.contact_phone,
      includesAdSpend:!!opts.includesAdSpend,effectiveDate:opts.effectiveDate,
      contractValue:opts.contractValue!=null?Number(opts.contractValue):null,
      latePaymentCap:opts.contractValue?Math.round(Number(opts.contractValue)*0.03*100)/100:null,
      specialTerms:opts.specialTerms
    });
  }
  const {data,error}=await sb.rpc('pmo_create_contract_v2',{
    p_scope_type:opts.scopeType, p_project_id:opts.projectId||null, p_baseline_id:opts.baselineId||null,
    p_client_id:opts.clientId||null, p_contract_type:opts.contractType,
    p_custom_title:opts.customTitle||null, p_custom_body:opts.customBody||null,
    p_includes_ad_spend:!!opts.includesAdSpend, p_effective_date:opts.effectiveDate||null,
    p_contract_value:opts.contractValue!=null?Number(opts.contractValue):null, p_document_hash:hash,
    p_contract_name:opts.contractName||null, p_contract_number:opts.contractNumber||null,
    p_template_key:opts.templateKey||'alamaa_v1'
  });
  if(error)throw error;return data;
}
async function duplicateContract(contractId,newName){
  const {data,error}=await sb.rpc('pmo_duplicate_contract',{p_contract_id:contractId,p_new_name:newName||null});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر التكرار');
  return data;
}
// ===== إرسال العقد بالبريد عبر دالة الحافة (المفتاح يبقى سرًّا على الخادم) =====
async function sendContractEmail(contract,toEmail,kind){
  const signUrl=location.origin+location.pathname+'#/sign/'+contract.token;
  const {data:{session}}=await sb.auth.getSession();
  if(!session)throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
  const url=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/send-contract-email';
  let out;
  try{
    const res=await fetch(url,{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({to:toEmail,contractName:contract.contract_name,
        contractNumber:contract.contract_number,clientName:contract.client_name,signUrl,kind:kind||'invite'})});
    out=await res.json();
  }catch(e){ out={ok:false,error:'network',message:e.message}; }
  // يُسجَّل النجاح والفشل كلاهما — سجل الإرسال يجب أن يعكس الحقيقة لا النجاح فقط
  try{ await sb.rpc('pmo_log_contract_send',{p_contract_id:contract.id,p_to_email:toEmail,
    p_kind:kind||'invite',p_status:out&&out.ok?'sent':'failed',
    p_error:out&&out.ok?null:(out.message||out.error||''),
    p_resend_id:(out&&out.id)||null}); }catch(e){}
  if(!out||!out.ok){
    throw new Error(out&&out.error==='missing_key'
      ?'لم يُضبط مفتاح Resend بعد في إعدادات دالة الإرسال — راجع الإعداد أولًا'
      :(out&&out.message)||'تعذّر الإرسال');
  }
  return out;
}
// فحص جاهزية الإرسال: يؤكد نشر الدالة ووجود السرَّين، دون إرسال أي بريد فعلي
async function checkEmailReady(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
  const res=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/send-contract-email',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
    body:JSON.stringify({selfTest:true})});
  const out=await res.json();
  if(!out||!out.ok){
    throw new Error(out&&out.error==='missing_key'?'الدالة منشورة لكن مفتاح RESEND_API_KEY غير مضبوط'
      :(out&&out.message)||'الدالة غير منشورة أو غير متاحة');
  }
  return out;
}
async function markCRExecuted(crId,baselineId){
  const {data,error}=await sb.rpc('pmo_mark_cr_executed',{p_cr_id:crId,p_baseline_id:baselineId||null});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر التعليم');
  return data;
}
async function fetchBaselineDiff(projectId){
  const {data,error}=await sb.rpc('pmo_baseline_diff',{p_project_id:projectId});
  if(error)throw error;return data||{};
}
// تُبقي بيانات الطرفين حيّة ما دام العقد بلا توقيع، وتُجمَّد نهائيًا بعد أول توقيع
async function refreshContractParties(contractId){
  const {data,error}=await sb.rpc('pmo_refresh_contract_parties',{p_contract_id:contractId});
  if(error)throw error;return data||{};
}
async function refreshClientContracts(clientId){
  const {data,error}=await sb.rpc('pmo_refresh_client_contracts',{p_client_id:clientId});
  if(error)throw error;return data||{};
}
// سجل تدقيق عقد بعينه — من فعل ماذا ومتى
// شهادة التوقيع: حزمة الأدلة كاملة — الأطراف، النص المختوم، التواقيع بأدلتها، والسجل
async function fetchSignatureCertificate(contractId){
  const {data,error}=await sb.rpc('pmo_signature_certificate',{p_contract_id:contractId});
  if(error)throw error;
  if(!data||!data.ok)throw new Error((data&&data.error)||'تعذّر توليد الشهادة');
  return data;
}
async function fetchEvidenceIssues(){
  const {data,error}=await sb.rpc('pmo_contracts_evidence_issues');
  if(error)throw error;return data||[];
}
// إعدادات الأتمتة — مغلقة افتراضيًا ولا تُفتح إلا بقرار صريح
// فحص أمني: يكشف الدوال المتسرّبة للمجهولين والتوقيعات المكرَّرة، ويصلحها عند الطلب
async function runSecurityAudit(fix){
  const {data,error}=await sb.rpc('pmo_security_audit',{p_fix:!!fix});
  if(error)throw error;return data||{};
}
// نقل بند بين الحزم/المراحل — بالسحب والإفلات أو من القائمة
async function moveTask(taskId,newParentId,newTrack,newSort){
  const {data,error}=await sb.rpc('pmo_move_task',
    {p_task_id:taskId,p_new_parent:newParentId||null,p_new_track:newTrack||null,p_new_sort:newSort==null?null:newSort});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error==='baselined_locked'
    ?'الخطة مثبَّتة — التعديل البنيوي يحتاج طلب تغيير معتمَدًا أولًا':(data.error||'تعذّر النقل'));
  return data;
}
// حلّ حزمة مع بقاء بنودها
async function dissolvePackage(pkgId,moveToId){
  const {data,error}=await sb.rpc('pmo_dissolve_package',{p_package_id:pkgId,p_move_to:moveToId||null});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error==='baselined_locked'
    ?'الخطة مثبَّتة — التعديل البنيوي يحتاج طلب تغيير معتمَدًا أولًا':(data.error||'تعذّر الحلّ'));
  return data;
}
// حِمل العمل عبر المحفظة — يُرجع المدخلات الخام، والجدولة تُحسب في المتصفح بنفس
// خوارزمية الجانت فلا تتناقض الأرقام مع ما يراه المستخدم
// ===== الطاقة بالمسمّى الوظيفي =====
let ROLES_CACHE=null;
async function fetchCapacityTree(){
  const {data,error}=await sb.rpc('pmo_capacity_tree');
  if(error)throw error;return data||[];
}
async function fetchRolesFlat(force){
  if(ROLES_CACHE&&!force)return ROLES_CACHE;
  const {data,error}=await sb.rpc('pmo_roles_flat');
  if(error)throw error;ROLES_CACHE=data||[];return ROLES_CACHE;
}
async function saveDepartment(id,name,color){
  const {data,error}=await sb.rpc('pmo_upsert_department',{p_id:id||null,p_name:name,p_color:color||null});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر الحفظ');
  ROLES_CACHE=null;return data;
}
async function saveJobRole(id,deptId,name,headcount,load){
  const {data,error}=await sb.rpc('pmo_upsert_job_role',
    {p_id:id||null,p_department:deptId||null,p_name:name,p_headcount:headcount,p_load:load});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر الحفظ');
  ROLES_CACHE=null;return data;
}
async function deleteJobRole(id){
  const {data,error}=await sb.rpc('pmo_delete_job_role',{p_id:id});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر الحذف');
  ROLES_CACHE=null;return data;
}
async function fetchPortfolioWorkload(){
  const {data,error}=await sb.rpc('pmo_portfolio_workload');
  if(error)throw error;return data||[];
}
async function fetchAutomationSettings(){
  const {data,error}=await sb.rpc('pmo_get_automation_settings');
  if(error)throw error;return data||{};
}
async function updateAutomationSettings(fields){
  const {data,error}=await sb.rpc('pmo_update_automation_settings',{p:fields});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر الحفظ');
  return data;
}
// تسجيل إصدار النموذج ببصمة نصه الفعلي — يُرصد أي تعديل على القالب تلقائيًا
async function registerTemplateVersion(key,label,notes){
  const tpl=(CONTRACT_TEMPLATES[key]||{}).tpl;
  if(!tpl)return null;
  const hash=await sha256Hex(JSON.stringify({intro:tpl.intro,sections:tpl.sections,signatures:tpl.signatures}));
  const {data,error}=await sb.rpc('pmo_register_template_version',
    {p_key:key,p_label:label,p_body_hash:hash,p_notes:notes||null});
  if(error)throw error;return data;
}
async function syncTemplateRegistry(){
  const out=[];
  for(const k of Object.keys(CONTRACT_TEMPLATES||{})){
    try{ const r=await registerTemplateVersion(k,CONTRACT_TEMPLATES[k].label); if(r)out.push({key:k,...r}); }
    catch(e){}
  }
  return out;
}
async function fetchContractAudit(contractId){
  const {data,error}=await sb.from('pmo_audit_log')
    .select('action,new_value,created_at,user_id')
    .eq('entity','contract').eq('entity_id',contractId)
    .order('created_at',{ascending:false}).limit(40);
  if(error)throw error;return data||[];
}
async function fetchContractFunnel(contractId){
  const {data,error}=await sb.rpc('pmo_contract_funnel',{p_contract_id:contractId});
  if(error)throw error;return data||{};
}
// حفظ بريد الشريك في ملفه مرة واحدة — يُستورَد تلقائيًا في كل عقد لاحق فلا يُعاد إدخاله
async function saveClientEmail(clientId,email){
  if(!clientId||!email)return;
  const {error}=await sb.from('pmo_clients').update({contact_email:email}).eq('id',clientId);
  if(error)throw error;
}
async function fetchExpiringContracts(){
  const {data,error}=await sb.rpc('pmo_expiring_contracts');
  if(error)throw error;return data||[];
}
// ===== الملف التعاقدي لعلامة (الطرف الأول) — يُستورَد تلقائيًا في كل عقد =====
let ORG_PROFILE=null;
async function fetchOrgProfile(force){
  if(ORG_PROFILE&&!force)return ORG_PROFILE;
  const {data,error}=await sb.rpc('pmo_get_org_profile');
  if(error)throw error;
  ORG_PROFILE=data||{};return ORG_PROFILE;
}
async function updateOrgProfile(fields){
  const {data,error}=await sb.rpc('pmo_update_org_profile',{p:fields});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error||'تعذّر الحفظ');
  ORG_PROFILE=null;
  return data;
}
async function fetchContractAttachments(contractId){
  const {data,error}=await sb.rpc('pmo_contract_attachments_list',{p_contract_id:contractId});
  if(error)throw error;return data||[];
}
async function addContractAttachment(contractId,label,url,kind,baselineId,fileInfo){
  const {data,error}=await sb.rpc('pmo_add_contract_attachment',
    {p_contract_id:contractId,p_label:label,p_url:url||null,p_kind:kind||'link',p_baseline_id:baselineId||null,
     p_storage_path:(fileInfo&&fileInfo.path)||null,p_file_size:(fileInfo&&fileInfo.size)||null,
     p_mime_type:(fileInfo&&fileInfo.mime)||null,p_content_hash:(fileInfo&&fileInfo.hash)||null});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error==='signed'?'لا يمكن تعديل مرفقات عقد وقّع عليه طرف':'تعذّر الإضافة');
  return data;
}
async function deleteContractAttachment(id){
  const {data,error}=await sb.rpc('pmo_delete_contract_attachment',{p_id:id});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error==='signed'?'لا يمكن تعديل مرفقات عقد موقَّع':'تعذّر الحذف');
  return data;
}
async function fetchBaselineById(baselineId){
  const {data,error}=await sb.rpc('pmo_baseline_by_id',{p_baseline_id:baselineId});
  if(error)throw error;return data;
}
async function assignContractToClient(contractId,clientId){
  const {data,error}=await sb.rpc('pmo_assign_contract_to_client',{p_contract_id:contractId,p_client_id:clientId});
  if(error)throw error;
  if(!data.ok)throw new Error(
    data.error==='duplicate'?'لهذا الشريك نسخة سارية من هذا العقد بالفعل':
    data.error||'تعذّر الإسناد');
  return data;
}
async function fetchContractInstances(contractId){
  const {data,error}=await sb.rpc('pmo_contract_instances',{p_contract_id:contractId});
  if(error)throw error;return data||[];
}
async function approveContractInternal(contractId,overrideReason,ackValueMismatch){
  const {data,error}=await sb.rpc('pmo_approve_contract_internal',
    {p_contract_id:contractId,p_override_reason:overrideReason||null,
     p_ack_value_mismatch:!!ackValueMismatch});
  if(error)throw error;
  if(!data.ok){const e=new Error(data.message||data.error||'تعذّر الاعتماد');
    e.code=data.error;e.info=data;throw e;}
  return data;
}
async function voidContract(contractId){
  const {data,error}=await sb.rpc('pmo_void_contract',{p_contract_id:contractId});
  if(error)throw error;return data;
}
async function fetchAllContracts(includeArchived){
  const {data,error}=await sb.rpc('pmo_all_contracts_view',{p_include_archived:!!includeArchived});
  if(error){
    if(/غير مصرّح/.test(error.message||''))throw new Error('انتهت جلستك أو لا تملك صلاحية عرض العقود — سجّل الدخول مجددًا');
    throw error;
  }
  return data||[];
}
// (٧) ملحق تعديل على عقد موقَّع — يحفظ العلاقة بالأصل بدل الإلغاء وإنشاء عقد منفصل
async function createAmendment(contractId,reason){
  const {data,error}=await sb.rpc('pmo_create_amendment',{p_contract_id:contractId,p_reason:reason||null});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error==='not_signed'
    ?'الملحق لا يُنشأ إلا على عقد موقَّع — العقد غير الموقَّع يُعدَّل مباشرة':(data.error||'تعذّر الإنشاء'));
  return data;
}
// (١٠) أرشفة/استرجاع — الموقَّع لا يُؤرشف لأنه مرجع قانوني ساري
async function archiveContract(contractId,restore){
  const {data,error}=await sb.rpc('pmo_archive_contract',{p_contract_id:contractId,p_restore:!!restore});
  if(error)throw error;
  if(!data.ok)throw new Error(data.error==='signed_cannot_archive'
    ?'العقد الموقَّع مرجع قانوني ساري — لا يُؤرشف':(data.error||'تعذّر التنفيذ'));
  return data;
}
// (٩) عقود مُرسَلة ولم تُوقَّع منذ مدة — تستحق تذكيرًا
async function fetchContractsNeedingReminder(days){
  const {data,error}=await sb.rpc('pmo_contracts_needing_reminder',{p_days:days||3});
  if(error)throw error;return data||[];
}
// (٨) تعارض القيمة المالية بين المشروع وعقده الموقَّع
async function updateContract(contractId,opts){
  opts=opts||{};
  const {data,error}=await sb.rpc('pmo_update_contract',{
    p_contract_id:contractId,
    p_includes_ad_spend:!!opts.includesAdSpend,
    p_effective_date:opts.effectiveDate||null,
    p_contract_value:opts.contractValue!=null?Number(opts.contractValue):null,
    p_special_terms:opts.specialTerms||null,
    p_custom_title:opts.customTitle||null,
    p_custom_body:opts.customBody||null,
    p_contract_name:opts.contractName||null,
    p_contract_number:opts.contractNumber||null,
    p_template_key:opts.templateKey||null,
    p_clause_overrides:opts.clauseOverrides||null,
    p_duration_months:opts.durationMonths?Number(opts.durationMonths):null,
    p_end_date:opts.endDate||null,
    p_auto_renew:opts.autoRenew!=null?!!opts.autoRenew:null
  });
  if(error)throw error;
  if(!data.ok)throw new Error(
    data.error==='signed'?'لا يمكن تعديل عقد وقّع عليه أي طرف بالفعل — أنشئ عقدًا جديدًا بدلًا من ذلك':
    data.error==='صلاحية غير كافية'?'لا تملك صلاحية تعديل كافية لهذا المشروع':'تعذّر التعديل');
  return data;
}
async function updateClientProfile(clientId,fields){
  const patch={};
  ['cr_number','vat_number','national_address_short','rep_name','rep_title','contact_email','contact_phone']
    .forEach(k=>{if(k in fields)patch[k]=fields[k]||null;});
  const {error}=await sb.from('pmo_clients').update(patch).eq('id',clientId);
  if(error)throw error;
  // ينعكس فورًا على كل عقود هذا الشريك غير الموقَّعة — الموقَّعة تبقى كما وُقِّعت
  try{ await refreshClientContracts(clientId); }catch(e){}
}
// تحديث المعرّف النظيف (Slug) — يُنظِّف الصيغة تلقائيًا؛ التفرّد مضمون بقيد فريد في القاعدة
// تحديث المعرّف النظيف (Slug) — يُنظِّف الصيغة تلقائيًا؛ التحديث ذرّي ويسجّل المعرّف
// القديم في سجلّ التاريخ أولًا، فلا يبقى أي رابط سبق مشاركته يتيمًا بعد تغيير المعرّف.
async function updateClientSlug(clientId,newSlug){
  const clean=(newSlug&&newSlug.trim())?slugify(newSlug):null;
  const {data,error}=await sb.rpc('pmo_update_client_slug',{p_client_id:clientId,p_new_slug:clean});
  if(error)throw error;
  if(!data.ok)throw new Error(
    data.error==='taken'?'هذا المعرّف مُستخدَم لشريك آخر — جرّب صيغة مختلفة':
    data.error==='صلاحية غير كافية'?'لا تملك صلاحية تعديل كافية لهذا الشريك':'تعذّر الحفظ');
  return data.slug;
}
async function updateProjectSlug(projectId,newSlug){
  const clean=(newSlug&&newSlug.trim())?slugify(newSlug):null;
  const {data,error}=await sb.rpc('pmo_update_project_slug',{p_project_id:projectId,p_new_slug:clean});
  if(error)throw error;
  if(!data.ok)throw new Error(
    data.error==='taken'?'هذا المعرّف مُستخدَم لمشروع آخر لنفس الشريك — جرّب صيغة مختلفة':
    data.error==='صلاحية غير كافية'?'لا تملك صلاحية تعديل كافية لهذا المشروع':'تعذّر الحفظ');
  return data.slug;
}
async function resolveClientLink(ref){
  const {data,error}=await sb.rpc('pmo_resolve_client_link',{p_ref:ref});
  if(error)throw error;return data;
}
// يحلّ رابطًا عميقًا لمشروع (بصيغته النظيفة أو الخامة، أو مزيجًا) لمعرّفَيه الحقيقيَّين —
// يُستخدَم فقط عند فتح رابط طازج بلا مشروع مُحمَّل مسبقًا في الذاكرة.
async function resolveProjectLink(clientRef,projectRef){
  const {data,error}=await sb.rpc('pmo_resolve_project_link',{p_client_ref:clientRef,p_project_ref:projectRef});
  if(error)throw error;return data;
}
async function fetchContractsForProject(projectId){
  const {data,error}=await sb.rpc('pmo_contract_staff_view',{p_project_id:projectId});
  if(error)throw error;return data||[];
}
async function linkContractToProject(contractId,projectId,baselineId){
  const {data,error}=await sb.rpc('pmo_link_contract_to_project',{p_contract_id:contractId,p_project_id:projectId,p_baseline_id:baselineId});
  if(error)throw error;return data;
}
async function unlinkContractFromProject(contractId){
  const {data,error}=await sb.rpc('pmo_unlink_contract_from_project',{p_contract_id:contractId});
  if(error)throw error;return data;
}
async function fetchUnlinkedClientContracts(clientId){
  const {data,error}=await sb.rpc('pmo_unlinked_client_contracts',{p_client_id:clientId});
  if(error)throw error;return data||[];
}
async function signContractAsStaff(contractId,name,signatureData){
  const {data,error}=await sb.rpc('pmo_sign_contract_staff',{p_contract_id:contractId,p_name:name,p_signature_data:signatureData});
  if(error)throw error;return data;
}
// الوصول العام (بلا جلسة) — نفس شريك sb، الحارس الحقيقي هو الرمز نفسه داخل الدالة
async function fetchPublicContract(token){
  const {data,error}=await sb.rpc('pmo_contract_public_view',{p_token:token});
  if(error)throw error;return data;
}
async function signContractPublic(token,name,email,signatureData,otp){
  const {data,error}=await sb.rpc('pmo_sign_contract_public',
    {p_token:token,p_name:name,p_email:email,p_signature_data:signatureData,p_otp:otp||null});
  if(error)throw error;return data;
}
// (٤) طلب رمز تحقق — يُرسَل حصرًا للبريد المسجَّل في ملف الشريك، لا لبريد يكتبه الزائر
async function requestSigningOTP(token){
  const res=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/send-signing-otp',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  const out=await res.json();
  if(!out||!out.ok)throw new Error(out&&out.message?out.message:'تعذّر إرسال رمز التحقق');
  return out;
}
// (٦) رفع مرفق فعلي إلى مساحة تخزين خاصة — لا رابط خارجي قد ينكسر بعد التوقيع
async function uploadContractFile(contractId,file){
  const safe=file.name.replace(/[^\w.-]+/g,'_').slice(-80);
  const path=contractId+'/'+Date.now()+'_'+safe;
  const {error}=await sb.storage.from('contract-files').upload(path,file,{upsert:false});
  if(error)throw new Error('تعذّر الرفع: '+error.message);
  // بصمة المحتوى: تجعل استبدال الملف بعد التوقيع قابلًا للكشف — الملحق جزء من العقد
  let hash=null;
  try{
    const buf=await file.arrayBuffer();
    hash=await sha256Hex(String.fromCharCode(...new Uint8Array(buf).slice(0,0)))||null;
    if(window.crypto&&window.crypto.subtle){
      const d=await crypto.subtle.digest('SHA-256',buf);
      hash=[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){}
  return {path,size:file.size,mime:file.type||null,hash};
}
async function contractFileURL(path){
  const {data,error}=await sb.storage.from('contract-files').createSignedUrl(path,300);
  if(error)throw new Error('تعذّر فتح الملف: '+error.message);
  return data.signedUrl;
}
async function deleteContractFile(path){
  try{ await sb.storage.from('contract-files').remove([path]); }catch(e){}
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
