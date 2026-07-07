// ===== الحالة =====
let USER=null,ROLE=null,CLIENTS=[],CID=null,PID=null,PROJECT=null,SCHED=null,TRACK=null,DATA_DATE=todayISO(),PX=20,VIEW='dashboard',CRS=[],PFILTER='all',PSEARCH='',PEXPANDED=new Set();
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
    alerts:companies.filter(x=>x.hasAlerts).length};
  const fbtn=(k,lbl)=>`<button class="pfilter ${PFILTER===k?'active':''}" data-filter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const searchBox=`<input id="pSearch" class="psearch" placeholder="🔍 بحث باسم الشركة أو المشروع…" value="${esc(PSEARCH)}">`;
  const filterBar=`<div class="pfilters">${fbtn('all','الكل')}${fbtn('active','نشطة')}${fbtn('draft','مسوّدة')}${fbtn('alerts','بها تنبيهات')}${searchBox}</div>`;

  // تطبيق الفلتر والبحث
  let shown=companies.filter(x=>{
    if(PFILTER==='active'&&!x.isActive)return false;
    if(PFILTER==='draft'&&!x.isDraft)return false;
    if(PFILTER==='alerts'&&!x.hasAlerts)return false;
    if(PSEARCH){
      const q=PSEARCH.trim();
      const inName=x.c.name.includes(q);
      const inProj=x.list.some(r=>(r.project_name||'').includes(q));
      if(!inName&&!inProj)return false;
    }
    return true;
  });
  // الترتيب: ذات التنبيهات أولًا، ثم الأكثر مشاريع
  shown.sort((a,b)=>(b.hasAlerts-a.hasAlerts)||(b.list.length-a.list.length));

  $('#host').querySelector('.hintbar').insertAdjacentHTML('afterend',filterBar);
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{PFILTER=b.dataset.filter;renderPortfolio();});
  const sIn=$('#pSearch');
  if(sIn){ sIn.oninput=()=>{PSEARCH=sIn.value; clearTimeout(sIn._t); sIn._t=setTimeout(renderPortfolio,300);};
    // إبقاء التركيز بعد إعادة العرض
    if(PSEARCH){ setTimeout(()=>{const el=$('#pSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0); } }

  if(!shown.length){grid.innerHTML='<p class="pempty">لا شركات مطابقة.</p>';return;}
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
async function openProject(){
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

// مدير المراحل الديناميكية (PMO): تعديل أسماء/ألوان أو إضافة مراحل
async function openTracksManager(){
  if(!PROJECT)return;
  const list=PROJECT.tracks||[];
  const opts=list.map(t=>({v:t.id,t:t.key+' — '+t.name})).concat([{v:'__add',t:'+ إضافة مرحلة جديدة'}]);
  const r=await dialog({title:'إدارة مراحل المشروع',
    message:'المراحل تحدد تجميع البنود وألوانها في الجدول والجانت وداشبورد العميل.',
    fields:[{key:'sel',label:'اختر مرحلة أو أضف',type:'select',value:opts[0].v,options:opts}],confirmText:'متابعة'});
  if(!r)return;
  if(r.sel==='__add'){
    const a=await dialog({title:'مرحلة جديدة',fields:[
      {key:'key',label:'الرمز (حرف/رقم فريد، مثل D)',placeholder:'D'},
      {key:'name',label:'اسم المرحلة',placeholder:'مثل: التحليل بالموجات'},
      {key:'color',label:'اللون',type:'color',value:'#C8A06B'}],confirmText:'إضافة'});
    if(!a||!a.key||!a.name)return;
    try{await addTrack(PROJECT._dbId,a.key.trim().toUpperCase(),a.name,a.color,list.length);
      PROJECT.tracks=await fetchTracks(PROJECT._dbId);toast('أُضيفت المرحلة «'+a.name+'»','ok');render();
    }catch(e){toast('تعذّر (الرمز مكرر؟): '+e.message,'err');}
  }else{
    const t=list.find(x=>x.id===r.sel);if(!t)return;
    const e=await dialog({title:'تعديل المرحلة: '+t.key,fields:[
      {key:'name',label:'الاسم',value:t.name},
      {key:'color',label:'اللون',type:'color',value:t.color}],confirmText:'حفظ'});
    if(!e||!e.name)return;
    try{await updateTrack(t.id,{name:e.name,color:e.color});
      PROJECT.tracks=await fetchTracks(PROJECT._dbId);toast('حُدّثت المرحلة','ok');render();
    }catch(err){toast('تعذّر التحديث','err');}
  }
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
      {key:'track',label:'المسار',type:'select',value:'0',options:Object.keys(TRACKS).map(k=>({v:k,t:TRACKS[k].code+' — '+TRACKS[k].name}))},
      {key:'type',label:'النوع',type:'select',value:'task',options:Object.keys(TYPES).map(k=>({v:k,t:TYPES[k]}))},
      {key:'duration',label:'المدة (أيام عمل)',type:'number',value:'1'}
    ],confirmText:'إضافة'});
  if(!r)return;
  if(!r.ref){toast('المعرّف مطلوب','warn');return;}
  if(PROJECT.tasks.some(t=>t.id===r.ref)){toast('المعرّف مستخدم بالفعل','warn');return;}
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