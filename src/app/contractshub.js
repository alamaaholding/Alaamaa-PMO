// ===== app/contractshub.js — إدارة العقود الشاملة (من المحفظة) =====
// يدعم نطاقَين (مشروع محدَّد / العميل كاملًا) ونوعَين (قياسي بالقالب الرسمي / مخصَّص بنص حر)،
// مع بوابة اعتماد داخلي صريحة قبل أن يصبح أي عقد قابلًا للإرسال والتوقيع فعليًا.
// مصدر البيانات: pmo_all_contracts_view — يحترم رؤية كل عقد بحسب نطاقه (مشروع أو عميل).

let CH_CONTRACTS=[],CH_FILTER={status:'all',q:''};
const CH_STL={draft:'مسودة',pending_alamaa:'بانتظار توقيع علامة',pending_client:'بانتظار توقيع العميل',signed:'موقَّع بالكامل ✅',void:'ملغى'};

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
          ${!c.internal_approved&&c.status!=='void'&&!(al||cl)?'<span class="chub-type-tag chub-pending-tag">⏳ بانتظار الاعتماد الداخلي</span>':''}
        </div>
        <div class="sa-hint">${c.client_name?'👤 '+esc(c.client_name):'👤 غير مُسنَد لعميل بعد'}${c.project_name?' · 📁 '+esc(c.project_name):' · 📁 غير مرتبط بمشروع'}${c.contract_value?' · '+Number(c.contract_value).toLocaleString('ar')+' ر.س':''}
          · علامة: ${al?esc(al.name):'—'} · العميل: ${cl?esc(cl.name):'—'}</div>
      </div>
      <span class="chub-row-arrow">فتح ←</span>
    </div>`;
  }).join('')||'<p class="empty">لا عقود تطابق هذا الفلتر.</p>';

  $('#chubBody').innerHTML=`
    <div class="sa-section">
      <div class="chub-filters">
        <input id="chubSearch" placeholder="🔍 ابحث باسم العميل أو المشروع..." value="${esc(CH_FILTER.q)}" style="flex:1;min-width:200px">
        <div class="chub-status-pills">
          ${['all','pending_alamaa','pending_client','signed','void'].map(s=>
            `<button class="chub-pill ${CH_FILTER.status===s?'active':''}" data-chubstatus="${s}">${s==='all'?'الكل':CH_STL[s]} <span>${counts[s]||0}</span></button>`).join('')}
        </div>
        <button class="hbtn" id="chubNew" style="background:var(--gold);border-color:var(--gold)">+ عقد جديد</button>
      </div>
    </div>
    <div class="sa-section chub-list">${rows}</div>
  `;

  $('#chubSearch').oninput=e=>{CH_FILTER.q=e.target.value;renderContractsHubBody();};
  $$('#chubBody [data-chubstatus]').forEach(b=>b.onclick=()=>{CH_FILTER.status=b.dataset.chubstatus;renderContractsHubBody();});
  $('#chubNew').onclick=openNewContractPanel;
  $$('#chubBody [data-chubopen]').forEach(b=>b.onclick=()=>openContractDetailPanel(b.dataset.chubopen));
}

function chubReadStandardFields(prefix,client){
  return {
    clientName:client.name,clientCr:client.cr_number,clientAddress:client.national_address_short,
    clientRepName:client.rep_name,clientRepTitle:client.rep_title,clientEmail:client.contact_email,clientPhone:client.contact_phone,
    includesAdSpend:document.getElementById(prefix+'AdSpend').checked,
    effectiveDate:document.getElementById(prefix+'Date').value,
    contractValue:document.getElementById(prefix+'Value').value,
    latePaymentCap:document.getElementById(prefix+'Value').value?Math.round(Number(document.getElementById(prefix+'Value').value)*0.03*100)/100:null,
    specialTerms:document.getElementById(prefix+'Special').value
  };
}
function chubReadCustomFields(prefix,client){
  return {
    title:document.getElementById(prefix+'Title').value,
    body:document.getElementById(prefix+'Body').value,
    clientName:client.name,clientCr:client.cr_number,clientAddress:client.national_address_short,
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

// ===== لوحة تفصيلية موحّدة: تعرض/تعدّل عقدًا قائمًا (قياسيًا أو مخصَّصًا) =====
async function openContractDetailPanel(contractId){
  const c=CH_CONTRACTS.find(x=>x.id===contractId);
  if(!c)return;
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
      ${c.project_id?'<button class="reqbtn" id="chdUnlink">🔓 فك الارتباط بالمشروع</button>':''}
      <button class="reqbtn" id="chdClose" style="margin-inline-start:auto">✕ إغلاق</button>
    </div>

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
          ${!isCustom?'<button class="reqbtn" id="chdExport">📄 تصدير PDF</button>':''}
        </div>
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
          <input id="chdDate" type="date" value="${c.effective_date||''}">
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chdAdSpend" ${c.includes_ad_spend?'checked':''}> يشمل إدارة إنفاق إعلاني</label>
        </div>
        <textarea id="chdSpecial" placeholder="شروط إضافية خاصة بهذا العقد (اختياري)" style="width:100%;min-height:70px;margin-top:10px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px">${esc(c.special_terms||'')}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="hbtn" id="chdSave" style="background:var(--gold);border-color:var(--gold)">📌 حفظ وتثبيت التعديلات</button>
          <button class="reqbtn" id="chdVoid" style="color:var(--crit)">🗑 إلغاء العقد</button>
        </div>`:`
        <input id="chdValue" type="hidden" value="${c.contract_value||''}"><input id="chdDate" type="hidden" value="${c.effective_date||''}">
        <input id="chdAdSpend" type="checkbox" ${c.includes_ad_spend?'checked':''} style="display:none">
        <textarea id="chdSpecial" style="display:none">${esc(c.special_terms||'')}</textarea>
        <p class="sa-hint">🔒 عقد ${anySigned?'وقّع عليه طرف على الأقل':'ملغى'} — لم يعد قابلًا للتعديل. لتغييره، ألغِ هذا العقد وأنشئ عقدًا جديدًا.</p>`}
        `}
        <div id="chdIntegrity"></div>
      </div>
    </div>

    <details class="pubsign-fulltext" open>
      <summary>📄 معاينة نص العقد الكامل (حيّة — تتحدّث فورًا مع أي تعديل)</summary>
      <div id="chdPreview"></div>
    </details>
  </div>`;

  const refreshPreview=async()=>{
    if(isCustom){
      document.getElementById('chdPreview').innerHTML=renderCustomContractHTML(chubReadCustomFields('chd',client));
      return;
    }
    const data=chubReadStandardFields('chd',client);
    document.getElementById('chdPreview').innerHTML=renderMergedContractHTML(mergeContract(data));
    if(c.document_hash){
      try{
        const nowHash=await computeContractHash(data);
        document.getElementById('chdIntegrity').innerHTML=nowHash===c.document_hash
          ?'<div class="ctr-integrity ok">✅ النص مطابق تمامًا لما وُقِّع عليه</div>'
          :'<div class="ctr-integrity warn">⚠ النص يختلف عمّا كان وقت الإنشاء</div>';
      }catch(e){}
    }
  };
  await refreshPreview();
  const watchIds=isCustom?['chdTitle','chdBody']:['chdValue','chdDate','chdAdSpend','chdSpecial'];
  if(editable)watchIds.forEach(id=>{
    document.getElementById(id).addEventListener('input',refreshPreview);
    document.getElementById(id).addEventListener('change',refreshPreview);
  });

  chubRenderQR('chdQrImg',link);

  if(panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('chdClose').onclick=()=>{panel.innerHTML='';};
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
  if(!isCustom){const exportBtn=document.getElementById('chdExport');if(exportBtn)exportBtn.onclick=()=>buildContractDoc(c.baseline_id,c);}
  if(canApprove){
    document.getElementById('chdApprove').onclick=async()=>{
      if(!await confirmDialog('اعتماد داخلي','بعد الاعتماد، يصبح هذا العقد قابلًا للإرسال والتوقيع من الطرفين. متابعة؟',false,'اعتماد'))return;
      try{
        await approveContractInternal(contractId);
        toast('اعتُمد العقد داخليًا — أصبح قابلًا للإرسال والتوقيع','ok');
        CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();openContractDetailPanel(contractId);
      }catch(e){toast(e.message,'err');}
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
// الفصل الحقيقي المطلوب: كل عقد يُنشأ هنا مستقلًا (بنطاق العميل)، بلا أي ربط بمشروع.
// الربط يحدث لاحقًا وحصرًا من داخل ذلك المشروع («🔗 ربط عقد قائم» في تبويب عقوده) —
// لا خيار "مرتبط بمشروع" هنا نهائيًا، تفاديًا لأي التباس حول أين يحدث الربط فعليًا.
async function openNewContractPanel(){
  const {data:allClients}=await sb.from('pmo_clients').select('id,name').order('name');
  const clients=allClients||[];
  const panel=document.getElementById('chubPanel');
  panel.innerHTML=`<div class="chub-detail">
    <div class="chub-detail-hd"><h3>عقد جديد</h3><button class="reqbtn" id="chnClose" style="margin-inline-start:auto">✕ إغلاق</button></div>
    <p class="sa-hint">العقد كيان مستقل في المحفظة: يُنشأ هنا باسمه ورقمه الخاصَّين، بلا ربط بمشروع، والعميل اختياري. الربط بمشروع يحدث لاحقًا من داخل ذلك المشروع ← عقوده ← «🔗 ربط عقد قائم».</p>

    <div class="chub-choice-row">
      <label class="chub-choice"><input type="radio" name="chnType" value="standard" checked> نموذج قياسي (17 بندًا رسميًا)</label>
      <label class="chub-choice"><input type="radio" name="chnType" value="custom"> نص مخصَّص أكتبه بنفسي</label>
    </div>

    <div class="sa-form" style="margin-top:12px;flex-wrap:wrap">
      <input id="chnName" placeholder="اسم العقد *" style="flex:1;min-width:200px;font-weight:700">
      <input id="chnNumber" placeholder="رقم العقد (تلقائي إن تُرك فارغًا)" style="width:220px;font-family:monospace" dir="ltr">
    </div>
    <div class="sa-form" style="margin-top:10px">
      <select id="chnClient"><option value="">العميل (اختياري — يمكن تحديده لاحقًا عند الربط بمشروع)</option>${clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div id="chnRest" style="margin-top:14px">
      <div id="chnStandardFields">
        <div class="sa-form" style="flex-wrap:wrap">
          <input id="chdValue" type="number" placeholder="قيمة العقد (ر.س)">
          <input id="chdDate" type="date" value="${new Date().toISOString().slice(0,10)}">
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chdAdSpend"> يشمل إدارة إنفاق إعلاني</label>
        </div>
        <textarea id="chdSpecial" placeholder="شروط إضافية خاصة بهذا العقد (اختياري)" style="width:100%;min-height:70px;margin-top:10px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px"></textarea>
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

  // العميل اختياري تمامًا: اختياره يُثري المعاينة ببياناته فقط، وغيابه لا يمنع الإنشاء إطلاقًا
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
        customTitle:type==='custom'?document.getElementById('chdTitle').value:null,
        customBody:type==='custom'?document.getElementById('chdBody').value:null,
        includesAdSpend:type==='standard'?document.getElementById('chdAdSpend').checked:false,
        effectiveDate:type==='standard'?document.getElementById('chdDate').value:null,
        contractValue:type==='standard'?document.getElementById('chdValue').value:null,
        specialTerms:type==='standard'?document.getElementById('chdSpecial').value:null
      });
      if(r&&r.ok){
        toast('أُنشئ العقد في المحفظة — اربطه بمشروع لاحقًا عند الحاجة','ok');panel.innerHTML='';
        CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();
        openContractDetailPanel(r.id);
      }else toast('تعذّر الإنشاء','err');
    }catch(e){toast('تعذّر الإنشاء: '+e.message,'err');btn.disabled=false;}
  };
}

window.renderContractsHub=renderContractsHub;
