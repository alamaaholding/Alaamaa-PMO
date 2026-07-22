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
  const projOpts=SA_PROJECTS.map(p=>`<option value="${p.id}">${esc(p._client)} — ${esc(p.name)}</option>`).join('');

  const deptTable=SA_PROJECTS.map(p=>`<tr><td>${esc(p._client)}</td><td>${esc(p.name)}</td>
    <td><select data-setdept="${p.id}">
      <option value="">— بلا قسم —</option>
      ${Object.keys(DEPTS).map(k=>`<option value="${k}" ${p.department===k?'selected':''}>${esc(DEPTS[k])}</option>`).join('')}
    </select></td></tr>`).join('');

  $('#saBody').innerHTML=`
    <div class="sa-section">
      <h4>منح صلاحية جديدة</h4>
      <div class="sa-form">
        <select id="saMember">${memberOpts}</select>
        <select id="saScopeType">
          <option value="company">الشركة كاملة</option>
          <option value="department">قسم بعينه</option>
          <option value="project">مشروع بعينه</option>
        </select>
        <select id="saScopeValue" style="display:none">${deptOpts}</select>
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

  const stEl=$('#saScopeType'),svEl=$('#saScopeValue'),spEl=$('#saScopeProject');
  stEl.onchange=()=>{
    svEl.style.display=(stEl.value==='department')?'':'none';
    spEl.style.display=(stEl.value==='project')?'':'none';
  };
  $('#saGrant').onclick=async()=>{
    const memberId=$('#saMember').value,scopeType=stEl.value,level=$('#saLevel').value;
    const scopeValue=scopeType==='company'?null:(scopeType==='department'?svEl.value:spEl.value);
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
