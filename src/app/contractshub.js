// ===== app/contractshub.js — إدارة العقود الشاملة (من المحفظة) =====
// يدعم نطاقَين (مشروع محدَّد / الشريك كاملًا) ونوعَين (قياسي بالقالب الرسمي / مخصَّص بنص حر)،
// مع بوابة اعتماد داخلي صريحة قبل أن يصبح أي عقد قابلًا للإرسال والتوقيع فعليًا.
// مصدر البيانات: pmo_all_contracts_view — يحترم رؤية كل عقد بحسب نطاقه (مشروع أو شريك).

let CH_CONTRACTS=[],CH_FILTER={status:'all',q:''};
const CH_STL={draft:'مسودة',pending_alamaa:'بانتظار توقيع علامة',pending_client:'بانتظار توقيع الشريك',signed:'موقَّع بالكامل ✅',void:'ملغى'};

async function renderContractsHub(){
  SCREEN='contractshub';
  $('#hProject').textContent='إدارة العقود';
  $('#barClient').style.display='none';hideChrome();
  try{history.replaceState(null,'','#/contracts');}catch(e){}
  $('#host').innerHTML=`
    <div class="hintbar"><button class="reqbtn" id="chubBack">↩ المحفظة</button>
      <span style="margin-inline-start:auto">كل عقود المحفظة في مكان واحد — إنشاء (قياسي أو بنص مخصَّص)، اعتماد داخلي، تعديل، توقيع، وإلغاء.</span></div>
    <div id="chubBody"><div class="skeleton" style="height:60px;margin-bottom:10px"></div>
      <div class="skeleton" style="height:300px"></div></div>
    <div id="chubPanel"></div>`;
  $('#chubBack').onclick=renderPortfolio;

  // تسجيل إصدار كل نموذج ببصمة نصه — يُرصد أي تعديل على القالب تلقائيًا بلا خطوة يدوية
  syncTemplateRegistry().catch(()=>{});
  try{
    CH_CONTRACTS=await fetchAllContracts();
  }catch(e){
    $('#chubBody').innerHTML='<p class="pempty">تعذّر تحميل العقود: '+esc(e.message)+'</p>';return;
  }
  renderContractsHubBody();
}

function renderContractsHubBody(){
  const counts={all:CH_CONTRACTS.length};
  ['pending_alamaa','pending_client','signed','void'].forEach(s=>{counts[s]=CH_CONTRACTS.filter(c=>c.status===s).length;});

  const q=CH_FILTER.q.trim().toLowerCase();
  const filtered=CH_CONTRACTS.filter(c=>{
    if(CH_FILTER.status!=='all'&&c.status!==CH_FILTER.status)return false;
    if(q){
      const hay=[c.contract_name,c.contract_number,c.client_name,c.project_name].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });

  const rows=filtered.map(c=>{
    const al=c.signatures.find(s=>s.party==='alamaa'),cl=c.signatures.find(s=>s.party==='client');
    return `<div class="chub-row" data-chubopen="${c.id}" role="button" tabindex="0">
      <div class="chub-row-main">
        <div class="chub-row-hd">
          <span class="chub-num">${esc(c.contract_number||'—')}</span>
          <b>${esc(c.contract_name||'عقد بلا اسم')}</b>
          <span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${CH_STL[c.status]||c.status}</span>
          <span class="chub-type-tag">${c.contract_type==='custom'?'📝 نص مخصَّص':'📋 قياسي'}</span>
          ${!c.client_id&&!c.source_contract_id?`<span class="chub-type-tag chub-tpl-tag">📄 أصل${c.instance_count>0?' · '+c.instance_count+' نسخة':''}</span>`:''}
          ${c.source_contract_id?`<span class="chub-type-tag chub-copy-tag">📎 نسخة من: ${esc(c.source_name||'أصل')}</span>`:''}
          ${c.amends_contract_id?`<span class="chub-type-tag" style="background:var(--blue-bg);color:var(--blue)">📝 ملحق (${c.amendment_no}) على ${esc(c.amends_number||'')}</span>`:''}
          ${c.amendment_count>0?`<span class="chub-type-tag" style="background:var(--blue-bg);color:var(--blue)">${c.amendment_count} ملحق تعديل</span>`:''}
          ${!c.internal_approved&&c.status!=='void'&&!(al||cl)?'<span class="chub-type-tag chub-pending-tag">⏳ بانتظار الاعتماد الداخلي</span>':''}
        </div>
        <div class="sa-hint">${c.client_name?'👤 '+esc(c.client_name):'👤 غير مُسنَد لشريك بعد'}${c.project_name?' · 📁 '+esc(c.project_name):' · 📁 غير مرتبط بمشروع'}${c.contract_value?' · '+Number(c.contract_value).toLocaleString('ar')+' ر.س':''}
          · علامة: ${al?esc(al.name):'—'} · الشريك: ${cl?esc(cl.name):'—'}</div>
      </div>
      <span class="chub-row-arrow">فتح ←</span>
    </div>`;
  }).join('')||'<p class="empty">لا عقود تطابق هذا الفلتر.</p>';

  $('#chubBody').innerHTML=`
    <div class="sa-section">
      <div class="chub-filters">
        <input id="chubSearch" placeholder="🔍 ابحث باسم الشريك أو المشروع..." value="${esc(CH_FILTER.q)}" style="flex:1;min-width:200px">
        <div class="chub-status-pills">
          ${['all','pending_alamaa','pending_client','signed','void'].map(s=>
            `<button class="chub-pill ${CH_FILTER.status===s?'active':''}" data-chubstatus="${s}">${s==='all'?'الكل':CH_STL[s]} <span>${counts[s]||0}</span></button>`).join('')}
        </div>
        <button class="hbtn" id="chubNew" style="background:var(--gold);border-color:var(--gold)">+ عقد جديد</button>
      </div>
    </div>
    <div id="chubExpiring"></div>
    <div class="sa-section chub-list">${rows}</div>
  `;

  // تنبيهات انتهاء/تجديد العقود السارية
  (async()=>{
    const box=document.getElementById('chubExpiring');
    if(!box)return;
    let exp=[],rem=[];
    try{exp=await fetchExpiringContracts();}catch(e){}
    try{rem=await fetchContractsNeedingReminder(3);}catch(e){}
    if(rem.length){
      box.innerHTML=`<div class="chub-expiry-banner" style="background:var(--blue-bg);border-color:var(--blue)">
        <b style="color:var(--blue)">🔔 عقود مُرسَلة ولم تُوقَّع بعد (${rem.length})</b>
        ${rem.map(x=>`<div class="chd-att-row">
          <span><span class="chub-num">${esc(x.contract_number||'—')}</span> <b>${esc(x.contract_name||'')}</b>
            <span class="sa-hint"> · ${esc(x.client_name||'—')} · مضى ${x.days_since} يومًا على آخر إرسال (${x.sends} مرة)</span></span>
          <button class="reqbtn" data-chubopen="${x.id}">فتح ←</button></div>`).join('')}
      </div>`;
      box.querySelectorAll('[data-chubopen]').forEach(b=>b.onclick=()=>openContractDetailPanel(b.dataset.chubopen));
    }
    if(!exp.length)return;
    const prev=box.innerHTML;
    box.innerHTML=prev+`<div class="chub-expiry-banner">
      <b>⏳ عقود تحتاج انتباهك (${exp.length})</b>
      ${exp.map(x=>`<div class="chd-att-row">
        <span><span class="chub-num">${esc(x.contract_number||'—')}</span> <b>${esc(x.contract_name||'')}</b>
          <span class="sa-hint"> · ${esc(x.client_name||'—')} · ${
            x.expired?'<span style="color:var(--crit);font-weight:700">انتهى في '+new Date(x.end_date).toLocaleDateString('ar')+'</span>'
            :'يتبقّى '+x.days_left+' يومًا (ينتهي '+new Date(x.end_date).toLocaleDateString('ar')+')'}${
            x.auto_renew?' · 🔄 تجديد تلقائي':''}</span></span>
        <button class="reqbtn" data-chubopen="${x.id}">فتح ←</button>
      </div>`).join('')}
    </div>`;
    box.querySelectorAll('[data-chubopen]').forEach(b=>b.onclick=()=>openContractDetailPanel(b.dataset.chubopen));
  })();

  $('#chubSearch').oninput=e=>{CH_FILTER.q=e.target.value;renderContractsHubBody();};
  $$('#chubBody [data-chubstatus]').forEach(b=>b.onclick=()=>{CH_FILTER.status=b.dataset.chubstatus;renderContractsHubBody();});
  $('#chubNew').onclick=openNewContractPanel;
  $$('#chubBody [data-chubopen]').forEach(b=>b.onclick=()=>openContractDetailPanel(b.dataset.chubopen));
}

let CHD_OVERRIDES={excluded:[],added:[]};
let CHD_ORG=null;
let CHD_TEMPLATE='alamaa_v1';
function chubReadStandardFields(prefix,client){
  return {
    templateKey:CHD_TEMPLATE, clauseOverrides:CHD_OVERRIDES,
    clientName:client.name,clientCr:client.cr_number,clientVat:client.vat_number,org:CHD_ORG||ORG_PROFILE||{},clientAddress:client.national_address_short,
    clientRepName:client.rep_name,clientRepTitle:client.rep_title,clientEmail:client.contact_email,clientPhone:client.contact_phone,
    includesAdSpend:document.getElementById(prefix+'AdSpend').checked,
    effectiveDate:document.getElementById(prefix+'Date').value,
    contractValue:document.getElementById(prefix+'Value').value,
    latePaymentCap:document.getElementById(prefix+'Value').value?Math.round(Number(document.getElementById(prefix+'Value').value)*0.03*100)/100:null,
    specialTerms:document.getElementById(prefix+'Special').value,
    durationMonths:(document.getElementById(prefix+'Duration')||{}).value||null,
    endDate:(document.getElementById(prefix+'End')||{}).value||null,
    autoRenew:!!((document.getElementById(prefix+'Renew')||{}).checked)
  };
}
function chubReadCustomFields(prefix,client){
  return {
    title:document.getElementById(prefix+'Title').value,
    body:document.getElementById(prefix+'Body').value,
    clientName:client.name,clientCr:client.cr_number,clientVat:client.vat_number,org:CHD_ORG||ORG_PROFILE||{},clientAddress:client.national_address_short,
    clientRepName:client.rep_name,clientRepTitle:client.rep_title,clientEmail:client.contact_email,clientPhone:client.contact_phone
  };
}
async function chubRenderQR(elId,link){
  try{
    await ensureQR();
    document.getElementById(elId).innerHTML=`<img src="${generateQRDataURL(link)}" alt="QR" style="width:150px;height:150px">`;
  }catch(e){
    document.getElementById(elId).innerHTML='<span class="sa-hint">⚠ تعذّر توليد المعاينة: '+esc(e.message)+'</span>';
  }
}


// ===== محرر بنود العقد — مشترك بين لوحتي الإنشاء والتعديل =====
// الاستبعاد لا يُزيح ترقيمًا أبدًا (البند يبقى برقمه بنص "غير منطبق")، والتحرير المباشر
// يستبدل نص البند لهذا العقد وحده دون المساس بالنموذج الأصلي المشترك بين كل العقود.
function chubRenderClauseEditor(boxId,onChange){
  const box=document.getElementById(boxId);
  if(!box)return;
  const tpl=(CONTRACT_TEMPLATES[CHD_TEMPLATE]||CONTRACT_TEMPLATES.alamaa_v1).tpl;
  if(!CHD_OVERRIDES.edited)CHD_OVERRIDES.edited={};
  box.innerHTML=`
    <p class="sa-hint" style="margin-bottom:8px">إلغاء تحديد بند يجعله «غير منطبق» — <b>يبقى برقمه</b> ولا تُزاح أرقام بقية البنود (حفاظًا على سلامة الإحالات بينها). زر «تحرير» يتيح تعديل نص البند لهذا العقد وحده.</p>
    <div class="chd-clause-grid">
      ${tpl.sections.map(sec=>{
        const off=CHD_OVERRIDES.excluded.includes(sec.num);
        const ed=CHD_OVERRIDES.edited[sec.num];
        return `<div class="chd-clause ${off?'chd-clause-off':''}">
          <input type="checkbox" data-clause="${sec.num}" ${off?'':'checked'}>
          <span style="flex:1">${esc(sec.num)}. ${esc((ed&&ed.title)||sec.title)}${ed?' <span class="chub-type-tag">محرَّر</span>':''}</span>
          <button class="reqbtn" data-editclause="${sec.num}" style="padding:2px 8px;font-size:.7rem">تحرير</button>
        </div>`;}).join('')}
    </div>
    <div id="${boxId}-edit"></div>
    ${CHD_OVERRIDES.added.length?`<div style="margin-top:12px"><b style="font-size:.85rem">بنود مضافة:</b>
      ${CHD_OVERRIDES.added.map((a,i)=>`<div class="chd-att-row"><span>${esc(a.num||'')} ${esc(a.title)}</span>
        <button class="reqbtn" data-delclause="${i}" style="color:var(--crit)">حذف</button></div>`).join('')}</div>`:''}
    <div class="sa-form" style="margin-top:12px;flex-wrap:wrap">
      <input id="${boxId}-nnum" placeholder="الرقم (مثال: ١٦.٧)" style="width:130px">
      <input id="${boxId}-ntitle" placeholder="عنوان البند الجديد" style="flex:1;min-width:160px">
      <button class="reqbtn" id="${boxId}-nadd">إضافة بند</button>
    </div>
    <textarea id="${boxId}-nbody" placeholder="نص البند الجديد..." style="width:100%;min-height:60px;margin-top:8px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px"></textarea>`;

  box.querySelectorAll('[data-clause]').forEach(cb=>cb.onchange=()=>{
    const num=cb.dataset.clause;
    if(cb.checked)CHD_OVERRIDES.excluded=CHD_OVERRIDES.excluded.filter(x=>x!==num);
    else if(!CHD_OVERRIDES.excluded.includes(num))CHD_OVERRIDES.excluded.push(num);
    chubRenderClauseEditor(boxId,onChange);if(onChange)onChange();
  });
  box.querySelectorAll('[data-editclause]').forEach(b=>b.onclick=()=>{
    const num=b.dataset.editclause;
    const sec=tpl.sections.find(x=>x.num===num);
    const ed=CHD_OVERRIDES.edited[num]||{};
    const area=document.getElementById(boxId+'-edit');
    area.innerHTML=`<div class="sa-section" style="margin-top:10px;background:var(--soft-2)">
      <h4>تحرير البند ${esc(num)}</h4>
      <input id="${boxId}-etitle" value="${esc(ed.title||sec.title)}" style="width:100%;margin-bottom:8px;font-weight:700;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px">
      <textarea id="${boxId}-ebody" style="width:100%;min-height:180px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px;line-height:1.7">${esc(ed.body!=null?ed.body:(sec.body||''))}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="hbtn" id="${boxId}-esave" style="background:var(--gold);border-color:var(--gold)">تطبيق على هذا العقد</button>
        ${CHD_OVERRIDES.edited[num]?`<button class="reqbtn" id="${boxId}-ereset">استعادة نص النموذج الأصلي</button>`:''}
        <button class="reqbtn" id="${boxId}-ecancel">إلغاء</button>
      </div></div>`;
    if(area.scrollIntoView)area.scrollIntoView({behavior:'smooth',block:'center'});
    document.getElementById(boxId+'-ecancel').onclick=()=>{area.innerHTML='';};
    document.getElementById(boxId+'-esave').onclick=()=>{
      CHD_OVERRIDES.edited[num]={title:document.getElementById(boxId+'-etitle').value,
        body:document.getElementById(boxId+'-ebody').value};
      area.innerHTML='';chubRenderClauseEditor(boxId,onChange);if(onChange)onChange();
      toast('طُبِّق التعديل على هذا العقد — النموذج الأصلي لم يتغيّر','ok');
    };
    const rs=document.getElementById(boxId+'-ereset');
    if(rs)rs.onclick=()=>{delete CHD_OVERRIDES.edited[num];area.innerHTML='';
      chubRenderClauseEditor(boxId,onChange);if(onChange)onChange();};
  });
  box.querySelectorAll('[data-delclause]').forEach(b=>b.onclick=()=>{
    CHD_OVERRIDES.added.splice(Number(b.dataset.delclause),1);
    chubRenderClauseEditor(boxId,onChange);if(onChange)onChange();
  });
  document.getElementById(boxId+'-nadd').onclick=()=>{
    const title=document.getElementById(boxId+'-ntitle').value.trim();
    if(!title){toast('أدخل عنوان البند','warn');return;}
    CHD_OVERRIDES.added.push({num:document.getElementById(boxId+'-nnum').value.trim()||null,
      title,body:document.getElementById(boxId+'-nbody').value});
    chubRenderClauseEditor(boxId,onChange);if(onChange)onChange();
  };
}

// ===== لوحة تفصيلية موحّدة: تعرض/تعدّل عقدًا قائمًا (قياسيًا أو مخصَّصًا) =====
async function openContractDetailPanel(contractId){
  let c=CH_CONTRACTS.find(x=>x.id===contractId);
  if(!c)return;
  // العقد غير الموقَّع: بيانات الطرفين تُنعَش من الملفات الحيّة قبل العرض، فأي تعديل على
  // ملف علامة أو ملف الشريك ينعكس فورًا. الموقَّع مجمَّد ولا يُمسّ إطلاقًا.
  const _anySig=(c.signatures||[]).length>0;
  // عقد بلا ختم: يُختَم الآن — يشمل العقود المُنشأة قبل إضافة الختم، فلا يبقى عقد
  // معتمَد غير قابل للتوقيع (التوقيع صار يشترط وجود نص مختوم).
  if(!c.sealed_body&&c.status!=='void'){
    try{
      await sealContract(c);
      const fresh=await fetchAllContracts();
      const found=(fresh||[]).find(x=>x.id===contractId);
      if(found){CH_CONTRACTS=fresh;c=found;}
    }catch(e){}
  }
  if(!_anySig&&c.status!=='void'){
    try{
      const r=await refreshContractParties(contractId);
      if(r&&r.refreshed){
        const fresh=await fetchAllContracts();
        const found=(fresh||[]).find(x=>x.id===contractId);
        if(found){CH_CONTRACTS=fresh;c=found;}
      }
    }catch(e){}
  }
  const al=c.signatures.find(s=>s.party==='alamaa'),cl=c.signatures.find(s=>s.party==='client');
  const anySigned=!!(al||cl);
  const editable=!anySigned&&c.status!=='void';
  const canApprove=(IS_OWNER||ROLE==='pmo')&&!c.internal_approved&&!anySigned&&c.status!=='void';
  const link=location.origin+location.pathname+'#/sign/'+c.token;
  const client={name:c.client_name,cr_number:c.client_cr,national_address_short:c.client_address,
    rep_name:c.client_rep_name,rep_title:c.client_rep_title,contact_email:c.client_contact_email,contact_phone:c.client_contact_phone};
  const isCustom=c.contract_type==='custom';

  const panel=document.getElementById('chubPanel');
  panel.innerHTML=`<div class="chub-detail">
    <div class="chub-detail-hd">
      <h3>${esc(c.contract_name||'عقد بلا اسم')} <span class="chub-num">${esc(c.contract_number||'—')}</span></h3>
      <span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${CH_STL[c.status]||c.status}</span>
      ${(!c.client_id&&!c.source_contract_id)?'<button class="hbtn" id="chdAssign" style="background:var(--gold);border-color:var(--gold)">👥 إسناد لشريك (إنشاء نسخة)</button>':''}
      <button class="reqbtn" id="chdDuplicate">📑 تكرار العقد</button>
      ${anySigned?'<button class="reqbtn" id="chdCert">🎖 شهادة التوقيع</button>':''}
      ${anySigned?'<button class="reqbtn" id="chdAmend">📝 ملحق تعديل</button>':''}
      ${(!anySigned&&!c.archived_at)?'<button class="reqbtn" id="chdArchive">🗄 أرشفة</button>':''}
      ${c.archived_at?'<button class="reqbtn" id="chdUnarchive">↩ استرجاع من الأرشيف</button>':''}
      ${c.project_id?'<button class="reqbtn" id="chdUnlink">🔓 فك الارتباط بالمشروع</button>':''}
      <button class="reqbtn" id="chdClose" style="margin-inline-start:auto">✕ إغلاق</button>
    </div>

    ${(!c.client_id&&!c.source_contract_id)?`
    <div class="chub-tpl-banner">
      <div><b>📄 هذا عقد أصل (قالب)</b><br><span class="sa-hint">إسناده لشريك يُنشئ <b>نسخة مستقلة تمامًا</b> خاصة به — بمعرّف ورقم ورابط توقيع خاص — والأصل يبقى هنا كما هو بلا أي تعديل. يمكن إسناده لعدد غير محدود من الشركاء بلا أي تداخل بينهم.</span></div>
    </div>
    <div id="chdInstances"></div>`:''}
    ${c.parties_frozen
      ?`<div class="ctr-integrity ok">🔒 بيانات الطرفين مجمَّدة كما وُقِّع عليها — تعديل ملف علامة أو الشريك لاحقًا لا يمسّ هذا العقد.</div>`
      :`<div class="chub-live-parties">🔄 بيانات الطرفين <b>حيّة</b> — تعكس أحدث ما في ملف علامة وملف الشريك، وتُجمَّد تلقائيًا لحظة أول توقيع.</div>`}
    ${anySigned
      ? `<div class="ctr-integrity ok">🔒 بيانات الطرفين مُجمَّدة كما وُقِّع عليها — أي تعديل لاحق على ملف علامة أو ملف الشريك لا يمسّ هذا العقد.</div>`
      : (c.status!=='void'
        ? `<div class="ctr-integrity" style="background:var(--blue-bg);color:var(--blue)">🔄 بيانات الطرفين حيّة — تُحدَّث تلقائيًا من الملف التعاقدي لعلامة وملف الشريك، وتُجمَّد نهائيًا عند أول توقيع.</div>`
        : '')}
    ${c.approval_override_reason?`<div class="ctr-integrity warn">⚠ اعتماد ذاتي موثَّق (المُعِدّ هو المعتمِد) — المبرّر: ${esc(c.approval_override_reason)}</div>`:''}
    ${c.source_contract_id?`<div class="ctr-integrity ok">📎 هذه نسخة خاصة بـ<b>${esc(c.client_name||'—')}</b> من الأصل «${esc(c.source_name||'')}» — تعديلها لا يمسّ الأصل ولا نسخ الشركاء الآخرين إطلاقًا.</div>`:''}

    ${(c.internal_approved&&c.status!=='void'&&!al)?`
    <div class="chub-sign-banner">
      <div><b>✍️ بانتظار توقيع علامة</b><br><span class="sa-hint">وقّع بصفتك ممثل علامة، ثم أرسل الرابط للشريك لتوقيعه.</span></div>
      <button class="hbtn" id="chdSignNow" style="background:var(--ok);border-color:var(--ok);color:#fff">✍️ توقيع علامة الآن</button>
    </div>
    <div id="chdSignArea"></div>`:''}
    ${(al&&!cl&&c.status!=='void')?`<div class="ctr-integrity ok">✍️ وقّعت علامة (${esc(al.name)}) — بانتظار توقيع الشريك عبر الرابط أدناه.</div>`:''}

    ${(!c.internal_approved&&c.status!=='void'&&!anySigned)?`
    <div class="chub-approval-banner ${canApprove?'':'chub-approval-locked'}">
      <div><b>⏳ بانتظار الاعتماد الداخلي</b><br><span class="sa-hint">لا يمكن إرسال هذا العقد أو توقيعه من أي طرف قبل اعتماده داخليًا أولًا.</span></div>
      ${canApprove?'<button class="hbtn" id="chdApprove" style="background:var(--ok);border-color:var(--ok);color:#fff">✅ اعتماد داخلي الآن</button>':'<span class="sa-hint">بصلاحية مالك/مدير المنصة</span>'}
    </div>`:(c.internal_approved||anySigned)?`<div class="ctr-integrity ok">✅ معتمد داخليًا — قابل للإرسال والتوقيع</div>`:''}

    <div class="chub-detail-grid">
      <div class="chub-qr-box">
        <div id="chdQrImg" class="chub-qr-loading">⏳ يُولَّد رمز QR...</div>
        <p class="sa-hint">رمز خاص بعقد ${esc(c.client_name)} — يحيل حصرًا لصفحة توقيع هذا العقد</p>
        <input readonly value="${link}" style="width:100%;font-size:.72rem;border:1px solid var(--line);border-radius:7px;padding:6px 8px;background:var(--soft-2);margin-top:6px">
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="reqbtn" data-chdcopy="${link}">نسخ الرابط</button>
          <button class="reqbtn" id="chdExport">📄 تصدير PDF (بالملاحق)</button>
        </div>
        ${(c.internal_approved&&c.status!=='void')?`
        <div class="chd-send-box">
          <div id="chdFunnel"><p class="sa-hint">جارٍ تحميل حالة الإرسال...</p></div>
        <div id="chdLinkState"></div>
          ${!cl?`
          <input id="chdSendTo" type="email" placeholder="بريد الشريك" value="${esc(c.client_contact_email||'')}" dir="ltr" style="width:100%;margin:8px 0 6px">
          ${!c.client_contact_email&&c.client_id?'<label class="sa-hint" style="display:flex;gap:5px;align-items:center;margin-bottom:6px"><input type="checkbox" id="chdSaveEmail" checked> احفظه في ملف الشريك (فلا يُعاد إدخاله)</label>':''}
          <button class="hbtn" id="chdSendBtn" style="background:var(--gold);border-color:var(--gold);width:100%">
            ${c.send_count>0?'🔔 إرسال تذكير':'📧 إرسال للشريك'}</button>`:''}
          <button class="reqbtn" id="chdMailCheck" style="width:100%;margin-top:6px;font-size:.72rem">🔍 فحص جاهزية الإرسال</button>
          <div id="chdMailStatus"></div>
        </div>`:''}
      </div>

      <div class="chub-fields-box">
        ${editable?`
        <div class="sa-form" style="flex-wrap:wrap;margin-bottom:12px">
          <input id="chdName" placeholder="اسم العقد" value="${esc(c.contract_name||'')}" style="flex:1;min-width:180px;font-weight:700">
          <input id="chdNumber" placeholder="رقم العقد" value="${esc(c.contract_number||'')}" style="width:150px;font-family:monospace" dir="ltr">
        </div>`:`
        <input id="chdName" type="hidden" value="${esc(c.contract_name||'')}">
        <input id="chdNumber" type="hidden" value="${esc(c.contract_number||'')}">`}
        ${isCustom?`
          ${editable?`
          <input id="chdTitle" placeholder="عنوان العقد" value="${esc(c.custom_title||'')}" style="width:100%;margin-bottom:10px;font-weight:700;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px">
          <textarea id="chdBody" placeholder="نص العقد الكامل..." style="width:100%;min-height:220px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px;line-height:1.7">${esc(c.custom_body||'')}</textarea>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="hbtn" id="chdSave" style="background:var(--gold);border-color:var(--gold)">📌 حفظ وتثبيت التعديلات</button>
            <button class="reqbtn" id="chdVoid" style="color:var(--crit)">🗑 إلغاء العقد</button>
          </div>`:`
          <input id="chdTitle" type="hidden" value="${esc(c.custom_title||'')}">
          <textarea id="chdBody" style="display:none">${esc(c.custom_body||'')}</textarea>
          <p class="sa-hint">🔒 عقد ${anySigned?'وقّع عليه طرف على الأقل':'ملغى'} — لم يعد قابلًا للتعديل. لتغييره، ألغِ هذا العقد وأنشئ عقدًا جديدًا.</p>`}
        `:`
        ${editable?`
        <div class="sa-form" style="flex-wrap:wrap">
          <input id="chdValue" type="number" placeholder="قيمة العقد (ر.س)" value="${c.contract_value||''}" style="width:150px">
          <input id="chdDate" type="date" title="تاريخ السريان" value="${c.effective_date||''}">
          <input id="chdDuration" type="number" min="1" placeholder="المدة (أشهر)" value="${c.duration_months||''}" style="width:130px">
          <input id="chdEnd" type="date" title="تاريخ الانتهاء" value="${c.end_date||''}">
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chdRenew" ${c.auto_renew?'checked':''}> تجديد تلقائي</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chdAdSpend" ${c.includes_ad_spend?'checked':''}> يشمل إدارة إنفاق إعلاني</label>
        </div>
        <textarea id="chdSpecial" placeholder="شروط إضافية خاصة بهذا العقد (اختياري)" style="width:100%;min-height:70px;margin-top:10px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px">${esc(c.special_terms||'')}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="hbtn" id="chdSave" style="background:var(--gold);border-color:var(--gold)">📌 حفظ وتثبيت التعديلات</button>
          <button class="reqbtn" id="chdVoid" style="color:var(--crit)">🗑 إلغاء العقد</button>
        </div>`:`
        <input id="chdValue" type="hidden" value="${c.contract_value||''}"><input id="chdDate" type="hidden" value="${c.effective_date||''}">
        <input id="chdDuration" type="hidden" value="${c.duration_months||''}"><input id="chdEnd" type="hidden" value="${c.end_date||''}">
        <input id="chdRenew" type="checkbox" ${c.auto_renew?'checked':''} style="display:none">
        <input id="chdAdSpend" type="checkbox" ${c.includes_ad_spend?'checked':''} style="display:none">
        <textarea id="chdSpecial" style="display:none">${esc(c.special_terms||'')}</textarea>
        <p class="sa-hint">🔒 عقد ${anySigned?'وقّع عليه طرف على الأقل':'ملغى'} — لم يعد قابلًا للتعديل. لتغييره، ألغِ هذا العقد وأنشئ عقدًا جديدًا.</p>`}
        `}
        <div id="chdIntegrity"></div>
      </div>
    </div>

    ${(!isCustom&&editable)?`
    <div class="sa-section" style="margin-top:14px">
      <h4>📋 نموذج العقد وبنوده <span class="sa-hint">اختر النموذج، واستبعد أو أضف بنودًا لهذا العقد تحديدًا</span></h4>
      <div class="sa-form" style="margin-bottom:12px">
        <select id="chdTemplate">${Object.values(CONTRACT_TEMPLATES).map(t=>
          `<option value="${t.key}" ${(c.template_key||'alamaa_v1')===t.key?'selected':''}>${esc(t.label)}</option>`).join('')}</select>
      </div>
      <div id="chdClauses"></div>
    </div>`:''}
    <div class="sa-section" style="margin-top:14px">
      <h4>📜 سجل العقد <span class="sa-hint">كل إجراء موثَّق: من فعله ومتى</span></h4>
      <div id="chdAudit"><div class="skeleton" style="height:40px"></div></div>
    </div>
    <div class="sa-section" style="margin-top:14px">
      <h4>📎 الملاحق والمرفقات <span class="sa-hint">تظهر للشريك في صفحة التوقيع، وتُدرَج في تصدير PDF</span></h4>
      <div id="chdAttachments"><div class="skeleton" style="height:40px"></div></div>
    </div>

    <details class="pubsign-fulltext" open>
      <summary>📄 معاينة نص العقد الكامل (حيّة — تتحدّث فورًا مع أي تعديل)</summary>
      <div id="chdPreview"></div>
    </details>
  </div>`;

  // ===== نموذج العقد ومحرر البنود =====
  CHD_ORG=c.org||null;
  CHD_TEMPLATE=c.template_key||'alamaa_v1';
  CHD_OVERRIDES=Object.assign({excluded:[],added:[]},c.clause_overrides||{});
  if(!Array.isArray(CHD_OVERRIDES.excluded))CHD_OVERRIDES.excluded=[];
  if(!Array.isArray(CHD_OVERRIDES.added))CHD_OVERRIDES.added=[];

  const renderClauses=()=>chubRenderClauseEditor('chdClauses',refreshPreview);
  const _unusedClauses=()=>{
    const box=document.getElementById('chdClauses');
    if(!box)return;
    const tpl=(CONTRACT_TEMPLATES[CHD_TEMPLATE]||CONTRACT_TEMPLATES.alamaa_v1).tpl;
    box.innerHTML=`
      <p class="sa-hint" style="margin-bottom:8px">إلغاء تحديد بند يجعله «غير منطبق» في هذا العقد — <b>يبقى برقمه</b> ولا تُزاح أرقام بقية البنود، حفاظًا على سلامة الإحالات بينها.</p>
      <div class="chd-clause-grid">
        ${tpl.sections.map(sec=>`
          <label class="chd-clause ${CHD_OVERRIDES.excluded.includes(sec.num)?'chd-clause-off':''}">
            <input type="checkbox" data-clause="${sec.num}" ${CHD_OVERRIDES.excluded.includes(sec.num)?'':'checked'}>
            <span>${esc(sec.num)}. ${esc(sec.title)}</span>
          </label>`).join('')}
      </div>
      ${CHD_OVERRIDES.added.length?`<div style="margin-top:12px"><b style="font-size:.85rem">بنود مضافة:</b>
        ${CHD_OVERRIDES.added.map((a,i)=>`<div class="chd-att-row"><span>${esc(a.num||'')} ${esc(a.title)}</span>
          <button class="reqbtn" data-delclause="${i}" style="color:var(--crit)">حذف</button></div>`).join('')}</div>`:''}
      <div class="sa-form" style="margin-top:12px;flex-wrap:wrap">
        <input id="chdNewClauseNum" placeholder="الرقم (مثال: ١٦.٧)" style="width:130px">
        <input id="chdNewClauseTitle" placeholder="عنوان البند الجديد" style="flex:1;min-width:160px">
        <button class="reqbtn" id="chdAddClause">إضافة بند</button>
      </div>
      <textarea id="chdNewClauseBody" placeholder="نص البند الجديد..." style="width:100%;min-height:60px;margin-top:8px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px"></textarea>`;

    box.querySelectorAll('[data-clause]').forEach(cb=>cb.onchange=()=>{
      const num=cb.dataset.clause;
      if(cb.checked)CHD_OVERRIDES.excluded=CHD_OVERRIDES.excluded.filter(x=>x!==num);
      else if(!CHD_OVERRIDES.excluded.includes(num))CHD_OVERRIDES.excluded.push(num);
      renderClauses();refreshPreview();
    });
    box.querySelectorAll('[data-delclause]').forEach(b=>b.onclick=()=>{
      CHD_OVERRIDES.added.splice(Number(b.dataset.delclause),1);renderClauses();refreshPreview();
    });
    document.getElementById('chdAddClause').onclick=()=>{
      const title=document.getElementById('chdNewClauseTitle').value.trim();
      if(!title){toast('أدخل عنوان البند','warn');return;}
      CHD_OVERRIDES.added.push({
        num:document.getElementById('chdNewClauseNum').value.trim()||null,
        title,body:document.getElementById('chdNewClauseBody').value});
      renderClauses();refreshPreview();
    };
  };
  {const ts=document.getElementById('chdTemplate');
   if(ts)ts.onchange=()=>{CHD_TEMPLATE=ts.value;CHD_OVERRIDES.excluded=[];renderClauses();refreshPreview();};}

  // ===== سجل تدقيق العقد =====
  (async()=>{
    const box=document.getElementById('chdAudit');
    if(!box)return;
    let rows=[];
    try{ rows=await fetchContractAudit(contractId); }
    catch(e){ box.innerHTML='<p class="sa-hint">تعذّر تحميل السجل</p>'; return; }
    if(!rows.length){ box.innerHTML='<p class="sa-hint">لا إجراءات مسجَّلة بعد.</p>'; return; }
    const who=id=>{const m=(SA_MEMBERS_CACHE||[]).find(x=>x.id===id);return m?(m.full_name||m.email):'—';};
    const detail=v=>{
      if(!v)return '';
      const parts=[];
      Object.keys(v).forEach(k=>{
        if(k==='number')return;
        const x=v[k];
        if(x&&typeof x==='object'&&('من' in x))parts.push(k+': '+(x['من']==null?'—':x['من'])+' ← '+(x['إلى']==null?'—':x['إلى']));
        else parts.push(k+': '+x);
      });
      return parts.join(' · ');
    };
    box.innerHTML=rows.map(r=>`
      <div class="chd-att-row">
        <span><b>${esc(AUDIT_ACTIONS[r.action]||r.action)}</b>
          ${r.new_value?`<span class="sa-hint"> · ${esc(detail(r.new_value))}</span>`:''}</span>
        <span class="sa-hint" style="white-space:nowrap">${esc(who(r.user_id))} · ${
          new Date(r.created_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'})}</span>
      </div>`).join('');
  })();

  // ===== المرفقات =====
  const renderAttachments=async()=>{
    const box=document.getElementById('chdAttachments');
    if(!box)return;
    let atts=[];
    try{ atts=await fetchContractAttachments(contractId); }
    catch(e){ box.innerHTML='<p class="sa-hint">تعذّر التحميل: '+esc(e.message)+'</p>'; return; }
    const planAtt=c.baseline_id?`<div class="chd-att-row"><span>📋 <b>ملحق (١) — الخطة المعتمدة</b>
        <span class="sa-hint">${esc(c.baseline_label||'')} · يُدرَج تلقائيًا في تصدير PDF</span></span>
        <span class="chub-type-tag">تلقائي</span></div>`:'';
    box.innerHTML=planAtt+(atts.length?atts.map(a=>`
      <div class="chd-att-row">
        <span>${a.kind==='file'?'📎':'🔗'} <b>${esc(a.label)}</b>
          ${a.file_size?`<span class="sa-hint"> · ${(a.file_size/1024).toFixed(0)} ك.ب</span>`:''}
          ${a.storage_path?` <button class="reqbtn" data-openfile="${esc(a.storage_path)}" style="padding:2px 8px;font-size:.7rem">فتح الملف</button>`
            :(a.url?` <a href="${esc(a.url)}" target="_blank" rel="noopener" class="sa-hint" style="text-decoration:underline">فتح الرابط</a>`:'')}</span>
        ${editable?`<button class="reqbtn" data-delatt="${a.id}" data-delpath="${esc(a.storage_path||'')}" style="color:var(--crit)">حذف</button>`:''}
      </div>`).join(''):(planAtt?'':'<p class="sa-hint">لا مرفقات إضافية بعد.</p>'))
      +(editable?`
      <div class="sa-form" style="margin-top:12px;flex-wrap:wrap">
        <input id="chdAttLabel" placeholder="اسم المستند (مثال: كشف الأسعار)" style="flex:1;min-width:160px">
        <input id="chdAttFile" type="file" style="flex:1;min-width:180px;font-size:.78rem">
        <button class="reqbtn" id="chdAttUpload" style="background:var(--ok);border-color:var(--ok);color:#fff">⬆ رفع الملف</button>
      </div>
      <p class="sa-hint" style="margin-top:6px">الملف يُحفَظ في مساحة علامة الخاصة ويُقفَل مع العقد عند التوقيع — لا ينكسر ولا يتغيّر بعده. الحد 25 م.ب.</p>
      <details style="margin-top:8px"><summary class="sa-hint" style="cursor:pointer">أو أضف رابطًا خارجيًا بدل الرفع</summary>
        <div class="sa-form" style="margin-top:8px;flex-wrap:wrap">
          <input id="chdAttUrl" placeholder="https://..." style="flex:1;min-width:200px" dir="ltr">
          <button class="reqbtn" id="chdAttAdd">إضافة رابط</button>
        </div>
        <p class="sa-hint" style="margin-top:4px">⚠ الرابط الخارجي قد ينكسر أو يتغيّر بعد التوقيع — الرفع أأمن.</p>
      </details>`
      :'<p class="sa-hint" style="margin-top:8px">🔒 لا يمكن تعديل مرفقات عقد وقّع عليه طرف.</p>');

    if(editable){
      document.getElementById('chdAttAdd').onclick=async()=>{
        const label=document.getElementById('chdAttLabel').value.trim();
        const url=document.getElementById('chdAttUrl').value.trim();
        if(!label){toast('أدخل اسم المستند','warn');return;}
        try{ await addContractAttachment(contractId,label,url,'link',null); toast('أُضيف المرفق','ok'); await renderAttachments(); }
        catch(e){toast(e.message,'err');}
      };
      document.getElementById('chdAttUpload').onclick=async()=>{
        const label=document.getElementById('chdAttLabel').value.trim();
        const fEl=document.getElementById('chdAttFile');
        const file=fEl.files&&fEl.files[0];
        if(!file){toast('اختر ملفًا أولًا','warn');return;}
        if(file.size>25*1024*1024){toast('الملف أكبر من 25 م.ب','warn');return;}
        const btn=document.getElementById('chdAttUpload');btn.disabled=true;const t0=btn.textContent;
        btn.textContent='جارٍ الرفع...';
        try{
          const info=await uploadContractFile(contractId,file);
          await addContractAttachment(contractId,label||file.name,null,'file',null,info);
          toast('رُفع المرفق','ok');fEl.value='';document.getElementById('chdAttLabel').value='';
          await renderAttachments();
        }catch(e){toast(e.message,'err');}
        btn.disabled=false;btn.textContent=t0;
      };
      document.querySelectorAll('[data-delatt]').forEach(b=>b.onclick=async()=>{
        try{
          await deleteContractAttachment(b.dataset.delatt);
          // الملف المرفوع يُحذف من التخزين أيضًا فلا تتراكم ملفات يتيمة
          if(b.dataset.delpath)await deleteContractFile(b.dataset.delpath);
          toast('حُذف المرفق','ok'); await renderAttachments();
        }catch(e){toast(e.message,'err');}
      });
      document.querySelectorAll('[data-openfile]').forEach(b=>b.onclick=async()=>{
        try{ window.open(await contractFileURL(b.dataset.openfile),'_blank','noopener'); }
        catch(e){toast(e.message,'err');}
      });
    }
  };
  renderAttachments();

  const refreshPreview=async()=>{
    // عقد مختوم وموقَّع: يُعرَض نصه المختوم حرفيًا لا المُعاد توليده
    if(c.sealed_body&&anySigned){
      document.getElementById('chdPreview').innerHTML=
        (c.sealed_body.kind==='custom'?renderCustomContractHTML(c.sealed_body):renderMergedContractHTML(c.sealed_body));
      document.getElementById('chdIntegrity').innerHTML=
        '<div class="ctr-integrity ok">🔒 نص مختوم في '+new Date(c.sealed_at).toLocaleDateString('ar')+' — هذا ما وُقِّع عليه حرفيًا</div>';
      return;
    }
    if(isCustom){
      document.getElementById('chdPreview').innerHTML=renderCustomContractHTML(chubReadCustomFields('chd',client));
      return;
    }
    const data=chubReadStandardFields('chd',client);
    document.getElementById('chdPreview').innerHTML=renderMergedContractHTML(mergeContract(data));
    if(c.document_hash){
      try{
        const nowHash=await computeContractHash(data);
        document.getElementById('chdIntegrity').innerHTML=(nowHash===c.document_hash||nowHash===c.sealed_hash)
          ?'<div class="ctr-integrity ok">✅ النص مطابق تمامًا لما وُقِّع عليه</div>'
          :'<div class="ctr-integrity warn">⚠ النص يختلف عمّا كان وقت الإنشاء</div>';
      }catch(e){}
    }
  };
  await refreshPreview();
  renderClauses();
  const watchIds=isCustom?['chdTitle','chdBody']:['chdValue','chdDate','chdAdSpend','chdSpecial'];
  if(editable)watchIds.forEach(id=>{
    document.getElementById(id).addEventListener('input',refreshPreview);
    document.getElementById(id).addEventListener('change',refreshPreview);
  });

  chubRenderQR('chdQrImg',link);

  if(panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('chdClose').onclick=()=>{panel.innerHTML='';};
  {const mc=document.getElementById('chdMailCheck');
   if(mc)mc.onclick=async()=>{
     const box=document.getElementById('chdMailStatus');
     box.innerHTML='<p class="sa-hint" style="margin-top:6px">جارٍ الفحص...</p>';
     try{
       const r=await checkEmailReady();
       box.innerHTML='<div class="ctr-integrity ok" style="margin-top:6px;font-size:.75rem">✅ جاهز للإرسال · المرسِل: '+esc(r.from||'—')
         +(r.webhookConfigured?'<br>✅ تتبّع الوصول والفتح مفعَّل':'<br>ℹ️ تتبّع الوصول والفتح غير مفعَّل (يحتاج ضبط WEBHOOK_SECRET وربطه في Resend)')+'</div>';
     }catch(e){
       box.innerHTML='<div class="ctr-integrity warn" style="margin-top:6px;font-size:.75rem">⚠ '+esc(e.message)+'</div>';
     }
   };}
  {const sendBtn=document.getElementById('chdSendBtn');
   if(sendBtn)sendBtn.onclick=async()=>{
     const to=document.getElementById('chdSendTo').value.trim();
     if(!to||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)){toast('أدخل بريدًا صحيحًا','warn');return;}
     sendBtn.disabled=true;const old=sendBtn.textContent;sendBtn.textContent='جارٍ الإرسال...';
     try{
       await sendContractEmail(c,to,c.send_count>0?'reminder':'invite');
       // حفظ البريد في ملف الشريك مرة واحدة — لا يُعاد إدخاله في أي عقد لاحق
       const saveBox=document.getElementById('chdSaveEmail');
       if(saveBox&&saveBox.checked&&c.client_id){
         try{ await saveClientEmail(c.client_id,to); }catch(e){}
       }
       toast('أُرسل العقد إلى '+to,'ok');
       CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(contractId);
     }catch(e){toast(e.message,'err');sendBtn.disabled=false;sendBtn.textContent=old;}
   };}

  // ===== مسار الرسالة: أُرسلت ← وصلت ← فُتحت ← نُقر ← وُقِّع =====
  (async()=>{
    const box=document.getElementById('chdFunnel');
    if(!box)return;
    let f={};
    try{ f=await fetchContractFunnel(contractId); }
    catch(e){ box.innerHTML='<p class="sa-hint">تعذّر تحميل حالة الإرسال</p>'; return; }

    if(!f.has_send){
      box.innerHTML='<p class="sa-hint">📭 لم يُرسل هذا العقد للشريك بعد.</p>';
      return;
    }
    const fmt=d=>d?new Date(d).toLocaleString('ar',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):null;
    // الخطوة تُعدّ محقَّقة إن تحقّقت هي أو أي خطوة بعدها (البريد قد يصل بلا إشعار فتح مثلًا)
    const steps=[
      {k:'أُرسلت',      at:f.sent_at,      icon:'📤'},
      {k:'وصلت',        at:f.delivered_at, icon:'📬'},
      {k:'فُتحت',       at:f.opened_at,    icon:'👁'},
      {k:'نُقر الرابط', at:f.clicked_at,   icon:'🖱'},
      {k:'وُقِّع',       at:f.signed_at,    icon:'✍️'}
    ];
    const lastDone=steps.reduce((acc,s,i)=>s.at?i:acc,-1);
    // حالة صلاحية الرابط — تظهر للمستخدم بدل أن يكتشفها من شكوى الشريك
    const ls=document.getElementById('chdLinkState');
    if(ls&&f.sent_at&&!f.signed_at){
      const days=Number(c.link_valid_days||30);
      const exp=new Date(new Date(f.sent_at).getTime()+days*86400000);
      const left=Math.ceil((exp-Date.now())/86400000);
      ls.innerHTML=left>0
        ?`<p class="sa-hint" style="margin-top:6px">🔗 الرابط صالح ${left} يومًا (حتى ${exp.toLocaleDateString('ar')}) — أي تذكير يجدّد المدة</p>`
        :`<div class="ctr-integrity warn" style="margin-top:6px;font-size:.75rem">⚠ انتهت صلاحية الرابط — أرسل تذكيرًا ليعمل مجددًا</div>`;
    }
    box.innerHTML=`
      <div class="chd-funnel">
        ${f.bounced_at?`<div class="ctr-integrity warn" style="font-size:.74rem;margin-bottom:8px">
          ⚠ ارتدّت الرسالة${f.bounce_reason?' — '+esc(f.bounce_reason):''} — تحقّق من صحة البريد</div>`:''}
        ${steps.map((s,i)=>{
          const done=!!s.at, current=(i===lastDone+1&&!done);
          return `<div class="chd-step ${done?'done':(current?'next':'pending')}">
            <span class="chd-step-icon">${done?s.icon:'○'}</span>
            <span class="chd-step-label">${s.k}</span>
            <span class="chd-step-time">${done?fmt(s.at):(current?'بانتظاره':'—')}</span>
          </div>`;}).join('')}
      </div>
      <p class="sa-hint" style="margin-top:6px">
        📧 ${esc(f.to_email||'')} · ${f.total_sends} إرسال${f.failed_sends?` · ${f.failed_sends} فاشل`:''}
        ${!f.tracking_active&&f.sent_at?'<br>ℹ️ تتبّع الوصول والفتح يتطلب ربط Webhook في Resend':''}
      </p>`;
  })();
  {const ct=document.getElementById('chdCert');
   if(ct)ct.onclick=async()=>{
     let cert;
     try{ cert=await fetchSignatureCertificate(contractId); }catch(e){toast(e.message,'err');return;}
     const f=d=>d?new Date(d).toLocaleString('ar',{dateStyle:'full',timeStyle:'short'}):'—';
     const org=cert.parties.org||{},pt=cert.parties.partner||{};
     const rows=(label,val)=>`<tr><th>${esc(label)}</th><td>${esc(val==null?'—':String(val))}</td></tr>`;
     document.getElementById('contractPrint').innerHTML=`
       <section class="cx-cover">
         <div class="cx-cover-brand">علامة <span>· أثر دائم</span></div>
         <h1>شهادة توقيع إلكتروني</h1>
         <div class="cx-cover-meta">
           <div><b>العقد</b><span>${esc(cert.contract.name||'—')}</span></div>
           <div><b>رقم العقد</b><span>${esc(cert.contract.number||'—')}</span></div>
         </div>
         <p class="cx-cover-note">وثيقة أدلة مُولَّدة في ${f(cert.generated_at)}</p>
       </section>
       <section class="cx-page">
         <div class="cx-annex-hd">أولًا — الأطراف</div>
         <table class="cx-table"><tbody>
           ${rows('الطرف الأول',org.legal_name||'علامة')}${rows('السجل التجاري',org.cr_number)}
           ${rows('الرقم الضريبي',org.vat_number)}${rows('الممثل',org.rep_name)}
           ${rows('الطرف الثاني',pt.name)}${rows('السجل التجاري',pt.cr)}
           ${rows('الرقم الضريبي',pt.vat)}${rows('الممثل',pt.rep)}
         </tbody></table>

         <div class="cx-annex-hd">ثانيًا — المستند الموقَّع</div>
         <table class="cx-table"><tbody>
           ${rows('وقت ختم النص',f(cert.document.sealed_at))}
           ${rows('بصمة النص (SHA-256)',cert.document.sealed_hash||'—')}
           ${rows('النموذج المستخدَم',(cert.document.template||'')+(cert.document.template_version?' · إصدار '+cert.document.template_version:''))}
           ${rows('قيمة العقد',cert.contract.value!=null?Number(cert.contract.value).toLocaleString('ar')+' ر.س':'—')}
           ${rows('تاريخ السريان',cert.contract.effective_date)}
         </tbody></table>

         <div class="cx-annex-hd">ثالثًا — حوكمة الاعتماد</div>
         <table class="cx-table"><tbody>
           ${rows('أعدّ العقد',(cert.governance||{}).created_by)}
           ${rows('اعتمده داخليًا',(cert.governance||{}).approved_by)}
           ${rows('وقت الاعتماد',f((cert.governance||{}).approved_at))}
           ${rows('فصل الأدوار',(cert.governance||{}).self_approved?'اعتماد ذاتي — المُعِدّ هو المعتمِد':'✔ مُعِدّ ومعتمِد مختلفان')}
           ${(cert.governance||{}).override_reason?rows('مبرّر الاعتماد الذاتي',cert.governance.override_reason):''}
         </tbody></table>

         ${(cert.attachments||[]).length?`<div class="cx-annex-hd">الملاحق وبصماتها</div>
         <table class="cx-table"><thead><tr><th>الملحق</th><th>النوع</th><th>بصمة المحتوى</th></tr></thead><tbody>
           ${cert.attachments.map(a=>`<tr><td>${esc(a.label)}</td><td>${a.kind==='file'?'ملف مرفوع':'رابط'}</td>
             <td style="font-size:.6rem;direction:ltr">${esc(a.hash||'—')}</td></tr>`).join('')}
         </tbody></table>`:''}

         <div class="cx-annex-hd">رابعًا — التواقيع وأدلتها</div>
         ${(cert.signatures||[]).map(sg=>`
           <table class="cx-table" style="margin-bottom:14px"><tbody>
             ${rows('الطرف',sg.party==='alamaa'?'علامة':'الشريك')}
             ${rows('الموقِّع',sg.name)}${rows('البريد',sg.email)}
             ${rows('وقت التوقيع',f(sg.signed_at))}
             ${rows('عنوان الشبكة',sg.ip)}
             ${rows('تحقق الهوية',sg.identity_verified?('نعم — '+(sg.verified_via||'')):'لا')}
             ${rows('وقت التحقق',f(sg.verified_at))}
             ${rows('بصمة النص وقت التوقيع',sg.hash_at_signing||'—')}
             ${rows('مطابقة النص الحالي',sg.signed_current_text?'✔ مطابق — لم يتغيّر منذ التوقيع':'✘ غير مطابق — راجع فورًا')}
             ${rows('إقرار القبول',sg.consent)}
           </tbody></table>`).join('')}

         <div class="cx-annex-hd">خامسًا — سجل الإجراءات</div>
         <table class="cx-table"><thead><tr><th>الإجراء</th><th>المنفِّذ</th><th>الوقت</th></tr></thead><tbody>
           ${(cert.audit||[]).map(a=>`<tr><td>${esc(AUDIT_ACTIONS[a.action]||a.action)}</td>
             <td>${esc(a.by||'—')}</td><td>${f(a.at)}</td></tr>`).join('')||'<tr><td colspan="3">—</td></tr>'}
         </tbody></table>
       </section>
       <div class="cx-footer">علامة · شهادة أدلة توقيع — ${esc(cert.contract.number||'')}</div>`;
     document.body.classList.add('printing-contract');
     setTimeout(()=>{window.print();
       const restore=()=>{document.body.classList.remove('printing-contract');window.removeEventListener('afterprint',restore);};
       window.addEventListener('afterprint',restore);},120);
   };}
  {const am=document.getElementById('chdAmend');
   if(am)am.onclick=async()=>{
     const r=await dialog({title:'ملحق تعديل',
       message:'يُنشأ ملحق مرقَّم مرتبط بهذا العقد، ينسخ بنوده ومرفقاته للتعديل — والعقد الأصلي يبقى ساريًا كما وُقِّع.',
       fields:[{key:'reason',label:'موضوع التعديل',type:'textarea',placeholder:'ما الذي يعدّله هذا الملحق؟'}],
       confirmText:'إنشاء الملحق'});
     if(!r)return;
     try{
       const d=await createAmendment(contractId,r.reason);
       toast('أُنشئ الملحق '+d.number,'ok');
       CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(d.id);
     }catch(e){toast(e.message,'err');}
   };}
  {const ar=document.getElementById('chdArchive');
   if(ar)ar.onclick=async()=>{
     if(!await confirmDialog('أرشفة العقد','يختفي من القائمة الرئيسية ويبقى قابلًا للاسترجاع.',false,'أرشفة'))return;
     try{ await archiveContract(contractId,false);toast('أُرشف العقد','ok');
       CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();panel.innerHTML='';
     }catch(e){toast(e.message,'err');}
   };}
  {const ua=document.getElementById('chdUnarchive');
   if(ua)ua.onclick=async()=>{
     try{ await archiveContract(contractId,true);toast('استُرجع العقد','ok');
       CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(contractId);
     }catch(e){toast(e.message,'err');}
   };}
  {const sb2=document.getElementById('chdSignNow');
   if(sb2)sb2.onclick=()=>{
     const area=document.getElementById('chdSignArea');
     area.innerHTML=`<div class="sa-section" style="background:var(--soft-2)">
       <h4>توقيع علامة على «${esc(c.contract_name||'')}»</h4>
       <input id="chdSignName" placeholder="اسم الموقِّع عن علامة" style="width:100%;margin-bottom:10px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px">
       <div id="chdSignPad"></div>
       <div style="display:flex;gap:8px;margin-top:10px">
         <button class="hbtn" id="chdSignConfirm" style="background:var(--ok);border-color:var(--ok);color:#fff">اعتماد التوقيع</button>
         <button class="reqbtn" id="chdSignCancel">إلغاء</button>
       </div></div>`;
     const pad=mountSignaturePad(document.getElementById('chdSignPad'));
     if(area.scrollIntoView)area.scrollIntoView({behavior:'smooth',block:'center'});
     document.getElementById('chdSignCancel').onclick=()=>{area.innerHTML='';};
     document.getElementById('chdSignConfirm').onclick=async()=>{
       const name=document.getElementById('chdSignName').value.trim();
       if(!name){toast('أدخل اسم الموقِّع','warn');return;}
       const sig=pad.getData();
       if(!sig.ok){toast('ارسم توقيعك أو اكتب اسمك في لوحة التوقيع','warn');return;}
       const btn=document.getElementById('chdSignConfirm');btn.disabled=true;
       try{
         const r=await signContractAsStaff(contractId,name,sig.data||('نصي: '+sig.typed));
         if(r&&r.ok){
           toast('وُقِّع العقد من علامة — أرسل الرابط للشريك الآن','ok');
           CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(contractId);
         }else toast((r&&r.error==='not_approved')?'العقد غير معتمَد داخليًا بعد':'تعذّر التوقيع','err');
       }catch(e){toast('تعذّر التوقيع: '+e.message,'err');btn.disabled=false;}
     };
   };}
  // الأصل: عرض نسخه الحالية + إتاحة إسناده لشريك جديد (نسخة مستقلة)
  if(!c.client_id&&!c.source_contract_id){
    (async()=>{
      const box=document.getElementById('chdInstances');
      if(!box)return;
      let insts=[];
      try{ insts=await fetchContractInstances(contractId); }catch(e){}
      const {data:allCl}=await sb.from('pmo_clients').select('id,name').order('name');
      const taken=new Set(insts.filter(i=>i.status!=='void').map(i=>i.client_name));
      box.innerHTML=`
        <div class="sa-section" style="margin-bottom:14px">
          <h4>النسخ المُنشأة من هذا الأصل <span class="sa-hint">(${insts.length})</span></h4>
          ${insts.length?insts.map(i=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft)">
              <div><span class="chub-num">${esc(i.contract_number||'—')}</span> <b>${esc(i.client_name||'—')}</b>
                <span class="sa-hint"> · ${CH_STL[i.status]||i.status}${i.project_name?' · 📁 '+esc(i.project_name):''}${i.internal_approved?' · ✅ معتمد':' · ⏳ بانتظار الاعتماد'}</span></div>
              <button class="reqbtn" data-openinst="${i.id}">فتح ←</button>
            </div>`).join(''):'<p class="sa-hint">لا نسخ بعد — أسنِد هذا الأصل لشريك لإنشاء أول نسخة.</p>'}
          <div class="sa-form" style="margin-top:12px">
            <select id="chdAssignClient"><option value="">اختر الشريك لإنشاء نسخة له...</option>${
              (allCl||[]).filter(x=>!taken.has(x.name)).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
            <button class="reqbtn" id="chdAssignGo">إنشاء نسخة</button>
          </div>
        </div>`;
      document.querySelectorAll('[data-openinst]').forEach(b=>b.onclick=()=>openContractDetailPanel(b.dataset.openinst));
      const go=async()=>{
        const cid=document.getElementById('chdAssignClient').value;
        if(!cid){toast('اختر الشريك','warn');return;}
        try{
          const r=await assignContractToClient(contractId,cid);
          toast('أُنشئت نسخة خاصة بالشريك ('+r.number+') — الأصل بقي كما هو','ok');
          CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();
          openContractDetailPanel(r.id);
        }catch(e){toast(e.message,'err');}
      };
      document.getElementById('chdAssignGo').onclick=go;
      const topBtn=document.getElementById('chdAssign');
      if(topBtn)topBtn.onclick=()=>{const sel=document.getElementById('chdAssignClient');if(sel&&sel.scrollIntoView)sel.scrollIntoView({behavior:'smooth',block:'center'});};
    })();
  }
  if(c.project_id){
    document.getElementById('chdUnlink').onclick=async()=>{
      if(!await confirmDialog('فك الارتباط','سيبقى العقد موجودًا في محفظة العقود، لكنه لن يظهر بعد الآن كمرتبط بهذا المشروع.',false,'فك الارتباط'))return;
      try{
        const r=await unlinkContractFromProject(contractId);
        if(r&&r.ok){toast('فُكّ الارتباط','ok');CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();panel.innerHTML='';}
        else toast((r&&r.error)||'تعذّر فك الارتباط','err');
      }catch(e){toast('تعذّر فك الارتباط: '+e.message,'err');}
    };
  }
  document.querySelectorAll('[data-chdcopy]').forEach(b=>b.onclick=async()=>{
    try{await navigator.clipboard.writeText(b.dataset.chdcopy);toast('نُسخ الرابط','ok');}
    catch(e){toast('انسخ الرابط يدويًا','warn');}
  });
  {const exportBtn=document.getElementById('chdExport');
   if(exportBtn)exportBtn.onclick=async()=>{
     exportBtn.disabled=true;const old=exportBtn.textContent;exportBtn.textContent='جارٍ التحضير...';
     try{
       let atts=[];try{atts=await fetchContractAttachments(contractId);}catch(e){}
       await buildContractDoc(c.baseline_id,c,atts);
     }catch(e){toast('تعذّر التصدير: '+e.message,'err');}
     exportBtn.disabled=false;exportBtn.textContent=old;
   };}
  document.getElementById('chdDuplicate').onclick=async()=>{
    const r=await dialog({title:'تكرار العقد',
      message:'ستُنشأ نسخة جديدة مستقلة بكل بيانات هذا العقد ومرفقاته، بلا شريك ولا مشروع — قابلة للتعديل والإسناد كأصل جديد.',
      fields:[{key:'name',label:'اسم النسخة الجديدة',value:(c.contract_name||'')+' (نسخة)'}],confirmText:'تكرار'});
    if(!r)return;
    try{
      const d=await duplicateContract(contractId,r.name);
      toast('تم التكرار ('+d.number+')','ok');
      CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(d.id);
    }catch(e){toast(e.message,'err');}
  };
  if(canApprove){
    document.getElementById('chdApprove').onclick=async()=>{
      if(!await confirmDialog('اعتماد داخلي','بعد الاعتماد، يصبح هذا العقد قابلًا للإرسال والتوقيع من الطرفين. متابعة؟',false,'اعتماد'))return;
      const finish=async()=>{
        {const fr=(await fetchAllContracts()).find(x=>x.id===contractId);
         if(fr){try{await sealContract(fr);}catch(e){}}}
        toast('اعتُمد العقد داخليًا وخُتم نصه — أصبح قابلًا للإرسال والتوقيع','ok');
        CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(contractId);
      };
      try{
        await approveContractInternal(contractId);
        await finish();
      }catch(e){
        // فصل الأدوار: المُعِدّ لا يعتمد عمله إلا بمبرّر موثَّق يظهر في الشهادة والسجل
        if(e.code==='value_mismatch'){
          const pv=Number(e.info.project_value||0).toLocaleString('ar');
          const cv=Number(e.info.contract_value||0).toLocaleString('ar');
          if(!await confirmDialog('تعارض في القيمة المالية',
            `قيمة العقد ${cv} ر.س تخالف القيمة المعتمَدة للمشروع ${pv} ر.س.\n\nراجعها قبل الاعتماد، أو أقرّ بالفرق للمتابعة.`,
            true,'أقرّ بالفرق وأعتمد'))return;
          try{ await approveContractInternal(contractId,null,true); await finish(); }
          catch(e3){
            if(e3.code==='self_approval'){
              const r2=await dialog({title:'أنت مُعِدّ هذا العقد',
                message:'مبدأ «أربع عيون» يقضي بأن يعتمده مخوَّل آخر. إن تعذّر، اذكر مبرّرًا موثَّقًا.',
                fields:[{key:'reason',label:'مبرّر الاعتماد الذاتي',type:'textarea'}],confirmText:'اعتماد'});
              if(!r2||!r2.reason||!r2.reason.trim()){toast('المبرّر إلزامي','warn');return;}
              try{ await approveContractInternal(contractId,r2.reason,true); await finish(); }
              catch(e4){toast(e4.message,'err');}
            }else toast(e3.message,'err');
          }
          return;
        }
        if(e.code==='self_approval'){
          const r=await dialog({title:'أنت مُعِدّ هذا العقد',
            message:'مبدأ «أربع عيون» يقضي بأن يعتمده مخوَّل آخر. إن تعذّر ذلك، اذكر مبرّرًا — سيُوثَّق في شهادة التوقيع وسجل العقد.',
            fields:[{key:'reason',label:'مبرّر الاعتماد الذاتي',type:'textarea',placeholder:'لماذا يتعذّر اعتماد شخص آخر؟'}],
            confirmText:'اعتماد مع توثيق المبرّر'});
          if(!r)return;
          if(!r.reason||!r.reason.trim()){toast('المبرّر إلزامي','warn');return;}
          try{ await approveContractInternal(contractId,r.reason); await finish(); }
          catch(e2){toast(e2.message,'err');}
        }else toast(e.message,'err');
      }
    };
  }
  if(editable){
    document.getElementById('chdSave').onclick=async()=>{
      const btn=document.getElementById('chdSave');btn.disabled=true;
      const nameNum={contractName:document.getElementById('chdName').value,contractNumber:document.getElementById('chdNumber').value};
      try{
        if(isCustom){
          await updateContract(contractId,Object.assign({customTitle:document.getElementById('chdTitle').value,customBody:document.getElementById('chdBody').value},nameNum));
        }else{
          await updateContract(contractId,Object.assign(chubReadStandardFields('chd',client),nameNum));
        }
        CH_CONTRACTS=await fetchAllContracts();
        const fresh=CH_CONTRACTS.find(x=>x.id===contractId);
        if(fresh){try{await sealContract(fresh);}catch(e){}}
        toast('حُفظت التعديلات وثُبِّتت','ok');
        CH_CONTRACTS=await fetchAllContracts();
        renderContractsHubBody();
        openContractDetailPanel(contractId);
      }catch(e){toast(e.message,'err');btn.disabled=false;}
    };
    document.getElementById('chdVoid').onclick=async()=>{
      if(!await confirmDialog('إلغاء العقد','سيصبح هذا العقد ملغى ولا يمكن توقيعه بعد الآن.',true,'إلغاء العقد'))return;
      try{
        const r=await voidContract(contractId);
        if(r&&r.ok){toast('أُلغي العقد','ok');panel.innerHTML='';CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();}
        else toast('تعذّر الإلغاء','err');
      }catch(e){toast('تعذّر الإلغاء: '+e.message,'err');}
    };
  }
}

// ===== لوحة إنشاء عقد جديد: مستقل تمامًا — لا خيار مشروع هنا إطلاقًا =====
// الفصل الحقيقي المطلوب: كل عقد يُنشأ هنا مستقلًا (بنطاق الشريك)، بلا أي ربط بمشروع.
// الربط يحدث لاحقًا وحصرًا من داخل ذلك المشروع («🔗 ربط عقد قائم» في تبويب عقوده) —
// لا خيار "مرتبط بمشروع" هنا نهائيًا، تفاديًا لأي التباس حول أين يحدث الربط فعليًا.
async function openNewContractPanel(){
  const {data:allClients}=await sb.from('pmo_clients').select('id,name').order('name');
  const clients=allClients||[];
  const panel=document.getElementById('chubPanel');
  panel.innerHTML=`<div class="chub-detail">
    <div class="chub-detail-hd"><h3>عقد جديد</h3><button class="reqbtn" id="chnClose" style="margin-inline-start:auto">✕ إغلاق</button></div>
    <p class="sa-hint">العقد كيان مستقل في المحفظة: يُنشأ هنا باسمه ورقمه الخاصَّين، بلا ربط بمشروع، والشريك اختياري. الربط بمشروع يحدث لاحقًا من داخل ذلك المشروع ← عقوده ← «🔗 ربط عقد قائم».</p>

    <div class="chub-choice-row">
      <label class="chub-choice"><input type="radio" name="chnType" value="standard" checked> نموذج قياسي (17 بندًا رسميًا)</label>
      <label class="chub-choice"><input type="radio" name="chnType" value="custom"> نص مخصَّص أكتبه بنفسي</label>
    </div>

    <div class="sa-form" style="margin-top:12px;flex-wrap:wrap">
      <input id="chnName" placeholder="اسم العقد *" style="flex:1;min-width:200px;font-weight:700">
      <input id="chnNumber" placeholder="رقم العقد (تلقائي إن تُرك فارغًا)" style="width:220px;font-family:monospace" dir="ltr">
    </div>
    <div class="sa-form" style="margin-top:10px">
      <select id="chnClient"><option value="">الشريك (اختياري — يمكن تحديده لاحقًا عند الربط بمشروع)</option>${clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div id="chnRest" style="margin-top:14px">
      <div id="chnStandardFields">
        <div class="sa-form" style="flex-wrap:wrap;margin-bottom:10px">
          <label style="font-size:.85rem;font-weight:700;align-self:center">نموذج العقد:</label>
          <select id="chnTemplate" style="flex:1;min-width:240px">${Object.values(CONTRACT_TEMPLATES).map(t=>
            `<option value="${t.key}">${esc(t.label)}</option>`).join('')}</select>
        </div>
        <div class="sa-form" style="flex-wrap:wrap">
          <input id="chdValue" type="number" placeholder="قيمة العقد (ر.س)">
          <input id="chdDate" type="date" value="${new Date().toISOString().slice(0,10)}">
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chdAdSpend"> يشمل إدارة إنفاق إعلاني</label>
        </div>
        <textarea id="chdSpecial" placeholder="شروط إضافية خاصة بهذا العقد (اختياري)" style="width:100%;min-height:70px;margin-top:10px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px"></textarea>
        <div class="sa-section" style="margin-top:14px;background:var(--soft-2)">
          <h4>📋 بنود العقد <span class="sa-hint">استبعد بندًا، أو حرّر نصه، أو أضف بندًا — لهذا العقد وحده</span></h4>
          <div id="chnClauses"></div>
        </div>
      </div>
      <div id="chnCustomFields" style="display:none">
        <input id="chdTitle" placeholder="عنوان العقد" style="width:100%;margin-bottom:10px;font-weight:700;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px">
        <textarea id="chdBody" placeholder="اكتب نص العقد الكامل هنا..." style="width:100%;min-height:220px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px;line-height:1.7"></textarea>
      </div>
      <button class="hbtn" id="chnCreate" style="background:var(--gold);border-color:var(--gold);margin-top:10px">إنشاء العقد</button>
      <p class="sa-hint" style="margin-top:6px">سينشأ بحالة «بانتظار الاعتماد الداخلي» — لن يصبح قابلًا للإرسال أو التوقيع قبل اعتماده.</p>
      <details class="pubsign-fulltext" open style="margin-top:14px">
        <summary>📄 معاينة نص العقد الكامل (حيّة — بمحتوى ونص هذا العقد تحديدًا)</summary>
        <div id="chnPreview"></div>
      </details>
    </div>
  </div>`;
  if(panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('chnClose').onclick=()=>{panel.innerHTML='';};

  let currentClient={};
  CHD_TEMPLATE='alamaa_v1';
  CHD_ORG=null;
  CHD_OVERRIDES={excluded:[],added:[],edited:{}};
  const typeOf=()=>document.querySelector('input[name="chnType"]:checked').value;
  const refreshPreview=()=>{
    document.getElementById('chnPreview').innerHTML=typeOf()==='custom'
      ?renderCustomContractHTML(chubReadCustomFields('chd',currentClient))
      :renderMergedContractHTML(mergeContract(chubReadStandardFields('chd',currentClient)));
  };
  const applyTypeVisibility=()=>{
    const isCustom=typeOf()==='custom';
    document.getElementById('chnStandardFields').style.display=isCustom?'none':'';
    document.getElementById('chnCustomFields').style.display=isCustom?'':'none';
    refreshPreview();
  };
  document.querySelectorAll('input[name="chnType"]').forEach(r=>r.onchange=applyTypeVisibility);
  {const ts=document.getElementById('chnTemplate');
   if(ts)ts.onchange=()=>{CHD_TEMPLATE=ts.value;CHD_OVERRIDES.excluded=[];CHD_OVERRIDES.edited={};
     chubRenderClauseEditor('chnClauses',refreshPreview);refreshPreview();};}
  chubRenderClauseEditor('chnClauses',refreshPreview);

  // الشريك اختياري تمامًا: اختياره يُثري المعاينة ببياناته فقط، وغيابه لا يمنع الإنشاء إطلاقًا
  document.getElementById('chnClient').onchange=async(e)=>{
    const cid=e.target.value;
    if(!cid){currentClient={};refreshPreview();return;}
    const {data:clientRow}=await sb.from('pmo_clients').select('*').eq('id',cid).maybeSingle();
    currentClient=clientRow||{};
    refreshPreview();
  };
  ['chdValue','chdDate','chdAdSpend','chdSpecial','chdTitle','chdBody'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('input',refreshPreview);
    el.addEventListener('change',refreshPreview);
  });
  refreshPreview();

  document.getElementById('chnCreate').onclick=async()=>{
    const cid=document.getElementById('chnClient').value||null;
    const type=typeOf();
    const name=document.getElementById('chnName').value.trim();
    if(!name){toast('أدخل اسم العقد','warn');return;}
    if(type==='custom'&&!document.getElementById('chdBody').value.trim()){toast('اكتب نص العقد أولًا','warn');return;}
    const btn=document.getElementById('chnCreate');btn.disabled=true;
    try{
      const r=await createContractV2({
        scopeType:'client',projectId:null,baselineId:null,clientId:cid,clientRow:currentClient,
        contractType:type,
        contractName:name,contractNumber:document.getElementById('chnNumber').value.trim()||null,
        templateKey:CHD_TEMPLATE,
        customTitle:type==='custom'?document.getElementById('chdTitle').value:null,
        customBody:type==='custom'?document.getElementById('chdBody').value:null,
        includesAdSpend:type==='standard'?document.getElementById('chdAdSpend').checked:false,
        effectiveDate:type==='standard'?document.getElementById('chdDate').value:null,
        contractValue:type==='standard'?document.getElementById('chdValue').value:null,
        specialTerms:type==='standard'?document.getElementById('chdSpecial').value:null
      });
      if(r&&r.ok){
        // تعديلات البنود تُحفَظ فور الإنشاء (دالة الإنشاء لا تحملها) — فلا تُفقد إطلاقًا
        const hasOv=(CHD_OVERRIDES.excluded||[]).length||(CHD_OVERRIDES.added||[]).length
          ||Object.keys(CHD_OVERRIDES.edited||{}).length;
        if(hasOv&&type==='standard'){
          try{ await updateContract(r.id,{
            includesAdSpend:document.getElementById('chdAdSpend').checked,
            effectiveDate:document.getElementById('chdDate').value,
            contractValue:document.getElementById('chdValue').value,
            specialTerms:document.getElementById('chdSpecial').value,
            templateKey:CHD_TEMPLATE, clauseOverrides:CHD_OVERRIDES}); }catch(e){}
        }
        toast('أُنشئ العقد في المحفظة — اربطه بمشروع لاحقًا عند الحاجة','ok');panel.innerHTML='';
        CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();
        openContractDetailPanel(r.id);
      }else toast('تعذّر الإنشاء','err');
    }catch(e){toast('تعذّر الإنشاء: '+e.message,'err');btn.disabled=false;}
  };
}

window.renderContractsHub=renderContractsHub;
