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
  const c=CLIENTS.find(x=>x.id===clientId);
  const h='#/c/'+((c&&c.slug)||clientId);
  if(location.hash===h)return;
  try{history.replaceState(null,'',h);}catch(e){location.hash=h;}
}
// يحلّ أي معرّف عميل وارد من الرابط (نظيف أو خام) إلى المعرّف الحقيقي — يضمن أن كل رابط
// سبق مشاركته يبقى يعمل للأبد، بصرف النظر عن أي تغيير لاحق في معرّف العميل النظيف.
function resolveClientIdentifier(idOrSlug){
  const c=(CLIENTS||[]).find(x=>x.slug===idOrSlug)||(CLIENTS||[]).find(x=>x.id===idOrSlug);
  return c?c.id:null;
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

  const c=stats.c;
  const missingFields=['cr_number','vat_number','national_address_short','rep_name','rep_title'].filter(k=>!c[k]);

  $('#chBody').innerHTML=`
    <div class="sa-section">${kpis}</div>
    <div class="sa-section">
      <h4>الرابط الدائم <span class="sa-hint">رابط صفحة هذا العميل — يمكنك تخصيصه ليكون واضحًا وسهل المشاركة بدل معرّف طويل</span></h4>
      <div class="sa-form">
        <span style="color:var(--muted);font-size:.82rem;white-space:nowrap">${location.origin}${location.pathname}#/c/</span>
        <input id="cpSlug" value="${esc(c.slug||'')}" placeholder="مثال: sanam" style="flex:1;min-width:140px;font-family:monospace" dir="ltr">
        <button class="hbtn" id="cpSlugSave" style="background:var(--gold);border-color:var(--gold)">حفظ الرابط</button>
      </div>
      <p class="sa-hint" style="margin-top:6px">حروف لاتينية وأرقام وشرطات فقط — يُنظَّف تلقائيًا. الرابط القديم بالمعرّف الخام يبقى يعمل دائمًا حتى بعد التغيير.</p>
    </div>
    <div class="sa-section">
      <h4>الملف التعاقدي <span class="sa-hint">يُستخدم تلقائيًا عند إنشاء أي عقد لهذا العميل — اختياري، لكن يُستحسن إكماله قبل أول عقد</span></h4>
      ${missingFields.length?`<div class="ch-warn-badge">⚠ بيانات غير مكتملة (${missingFields.length} حقول) — يمكنك المتابعة، ويُنصح بإكمالها قبل إرسال أي عقد للعميل</div>`:''}
      <div class="sa-form" style="flex-wrap:wrap">
        <input id="cpCr" placeholder="رقم السجل التجاري" value="${esc(c.cr_number||'')}" style="flex:1;min-width:160px">
        <input id="cpVat" placeholder="الرقم الضريبي (VAT)" value="${esc(c.vat_number||'')}" style="flex:1;min-width:160px">
        <input id="cpAddr" placeholder="العنوان الوطني المختصر" value="${esc(c.national_address_short||'')}" style="flex:1;min-width:180px">
        <input id="cpRepName" placeholder="اسم الممثل المفوَّض" value="${esc(c.rep_name||'')}" style="flex:1;min-width:160px">
        <input id="cpRepTitle" placeholder="صفته" value="${esc(c.rep_title||'')}" style="flex:1;min-width:140px">
        <button class="hbtn" id="cpSave" style="background:var(--gold);border-color:var(--gold)">حفظ الملف</button>
      </div>
    </div>
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

  $('#cpSlugSave').onclick=async()=>{
    const btn=$('#cpSlugSave');btn.disabled=true;
    const raw=$('#cpSlug').value.trim();
    try{
      const clean=raw?await updateClientSlug(stats.cid,raw):null;
      if(!raw){await sb.from('pmo_clients').update({slug:null}).eq('id',stats.cid);}
      c.slug=clean;
      toast(clean?'حُفظ الرابط: '+clean:'أُزيل المعرّف النظيف — سيُستخدَم المعرّف الخام','ok');
      renderCHBody(stats,access);
    }catch(e){toast(e.message,'err');btn.disabled=false;}
  };
  $('#cpSave').onclick=async()=>{
    const btn=$('#cpSave');btn.disabled=true;
    const vals={cr_number:$('#cpCr').value.trim(),vat_number:$('#cpVat').value.trim(),
      national_address_short:$('#cpAddr').value.trim(),rep_name:$('#cpRepName').value.trim(),rep_title:$('#cpRepTitle').value.trim()};
    try{
      await updateClientProfile(stats.cid,vals);
      Object.assign(c,vals);
      toast('حُفظ الملف التعاقدي','ok');renderCHBody(stats,access);
    }catch(e){toast('تعذّر الحفظ: '+e.message,'err');btn.disabled=false;}
  };

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
