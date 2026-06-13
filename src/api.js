// ===== المصادقة =====
async function loadIdentity(){
  const {data:{user}}=await sb.auth.getUser();USER=user;if(!user)return null;
  const {data:tm}=await sb.from('team_members').select('role,is_active,full_name').eq('id',user.id).maybeSingle();
  if(tm&&tm.is_active){ROLE=(tm.role==='admin')?'pmo':(tm.role==='manager'?'delivery':'client');USER._name=tm.full_name||user.email;}
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
async function loadProject(clientId, force){
  CID=clientId;
  const {data:projects}=await sb.from('pmo_projects').select('*').eq('client_id',clientId).limit(1);
  if(!projects||!projects.length){PROJECT=null;return;}
  const p=projects[0];
  // tasks/deps/baseline/CRs تعتمد على project_id فقط → نطلبها بالتوازي
  const [tasksR,depsR,blR,crR]=await Promise.all([
    sb.from('pmo_tasks').select('id,ref,wbs,name,track,type,duration,lag,fixed_date,owner,deliverable,status,progress').eq('project_id',p.id).order('sort_order'),
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
    tasks:tasks.map(t=>({id:t.ref,_dbId:t.id,wbs:t.wbs,name:t.name,track:t.track,type:t.type,duration:t.duration,lag:t.lag,fixedDate:t.fixed_date||undefined,owner:t.owner,deliverable:t.deliverable,status:t.status,progress:t.progress,deps:depMap[t.id]||[],requirements:reqMap[t.id]||[]}))};
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
