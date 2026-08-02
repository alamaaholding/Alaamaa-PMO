// ===== app/contractshub.js — إدارة العقود الشاملة (من المحفظة) =====
// مصدر البيانات: pmo_all_contracts_view — يحترم pmo_can_see_project_staff لكل عقد على حدة،
// فلا يظهر إلا ما يملك المستخدم صلاحية رؤيته أصلًا، تمامًا كبقية شاشات المحفظة.

let CH_CONTRACTS=[],CH_FILTER={status:'all',q:''};
const CH_STL={draft:'مسودة',pending_alamaa:'بانتظار توقيع علامة',pending_client:'بانتظار توقيع العميل',signed:'موقَّع بالكامل ✅',void:'ملغى'};

async function renderContractsHub(){
  SCREEN='contractshub';
  $('#hProject').textContent='إدارة العقود';
  $('#barClient').style.display='none';hideChrome();
  try{history.replaceState(null,'','#/contracts');}catch(e){}
  $('#host').innerHTML=`
    <div class="hintbar"><button class="reqbtn" id="chubBack">↩ المحفظة</button>
      <span style="margin-inline-start:auto">كل عقود المحفظة في مكان واحد — إنشاء، تعديل قبل التوقيع، توقيع، تصدير، وإلغاء.</span></div>
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
    if(q&&!(c.client_name.toLowerCase().includes(q)||c.project_name.toLowerCase().includes(q)))return false;
    return true;
  });

  const rows=filtered.map(c=>{
    const al=c.signatures.find(s=>s.party==='alamaa'),cl=c.signatures.find(s=>s.party==='client');
    return `<button class="chub-row" data-chubopen="${c.id}">
      <div class="chub-row-main">
        <div class="chub-row-hd">
          <b>${esc(c.client_name)}</b><span class="chub-sep">·</span>${esc(c.project_name)}
          <span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${CH_STL[c.status]||c.status}</span>
        </div>
        <div class="sa-hint">${esc(c.baseline_label)} · ${c.includes_ad_spend?'يشمل إنفاقًا إعلانيًا':'بلا إنفاق إعلاني'}${c.contract_value?' · '+Number(c.contract_value).toLocaleString('ar')+' ر.س':''}
          · علامة: ${al?esc(al.name):'—'} · العميل: ${cl?esc(cl.name):'—'}</div>
      </div>
      <span class="chub-row-arrow">فتح ←</span>
    </button>`;
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

// يبني بيانات الدمج من قيم الحقول الحالية في النموذج — مصدر واحد للمعاينة الحيّة والحفظ معًا
function chubReadFields(prefix,client){
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

// ===== لوحة تفصيلية موحّدة: تعرض/تعدّل عقدًا قائمًا =====
async function openContractDetailPanel(contractId){
  const c=CH_CONTRACTS.find(x=>x.id===contractId);
  if(!c)return;
  const al=c.signatures.find(s=>s.party==='alamaa'),cl=c.signatures.find(s=>s.party==='client');
  const anySigned=!!(al||cl);
  const editable=!anySigned&&c.status!=='void';
  const link=location.origin+location.pathname+'#/sign/'+c.token;
  const client={name:c.client_name,cr_number:c.client_cr,national_address_short:c.client_address,
    rep_name:c.client_rep_name,rep_title:c.client_rep_title,contact_email:c.client_contact_email,contact_phone:c.client_contact_phone};

  const panel=document.getElementById('chubPanel');
  panel.innerHTML=`<div class="chub-detail">
    <div class="chub-detail-hd">
      <h3>${esc(c.client_name)} · ${esc(c.project_name)}</h3>
      <span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${CH_STL[c.status]||c.status}</span>
      <button class="reqbtn" id="chdClose" style="margin-inline-start:auto">✕ إغلاق</button>
    </div>

    <div class="chub-detail-grid">
      <div class="chub-qr-box">
        <div id="chdQrImg" class="chub-qr-loading">⏳ يُولَّد رمز QR...</div>
        <p class="sa-hint">رمز خاص بعقد ${esc(c.client_name)} — يحيل حصرًا لصفحة توقيع هذا العقد</p>
        <input readonly value="${link}" style="width:100%;font-size:.72rem;border:1px solid var(--line);border-radius:7px;padding:6px 8px;background:var(--soft-2);margin-top:6px">
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="reqbtn" data-chdcopy="${link}">نسخ الرابط</button>
          <button class="reqbtn" id="chdExport">📄 تصدير PDF</button>
        </div>
      </div>

      <div class="chub-fields-box">
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
        <div id="chdIntegrity"></div>
      </div>
    </div>

    <details class="pubsign-fulltext" open>
      <summary>📄 معاينة نص العقد الكامل (حيّة — تتحدّث فورًا مع أي تعديل)</summary>
      <div id="chdPreview"></div>
    </details>
  </div>`;

  const refreshPreview=async()=>{
    const data=chubReadFields('chd',client);
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
  if(editable)['chdValue','chdDate','chdAdSpend','chdSpecial'].forEach(id=>{
    document.getElementById(id).addEventListener('input',refreshPreview);
    document.getElementById(id).addEventListener('change',refreshPreview);
  });

  // QR فوري — إثبات وجوده وصحة وجهته مباشرة أمام عينك، لا فقط عبر تصدير منفصل
  (async()=>{
    try{
      await ensureQR();
      const qrImg=generateQRDataURL(link);
      document.getElementById('chdQrImg').innerHTML=`<img src="${qrImg}" alt="QR" style="width:150px;height:150px">`;
    }catch(e){
      document.getElementById('chdQrImg').innerHTML='<span class="sa-hint">⚠ تعذّر توليد المعاينة: '+esc(e.message)+'</span>';
    }
  })();

  if(!panel.scrollIntoView){}else panel.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('chdClose').onclick=()=>{panel.innerHTML='';};
  document.getElementById('chdExport').onclick=()=>buildContractDoc(c.baseline_id,c);
  document.querySelectorAll('[data-chdcopy]').forEach(b=>b.onclick=async()=>{
    try{await navigator.clipboard.writeText(b.dataset.chdcopy);toast('نُسخ الرابط','ok');}
    catch(e){toast('انسخ الرابط يدويًا','warn');}
  });
  if(editable){
    document.getElementById('chdSave').onclick=async()=>{
      const btn=document.getElementById('chdSave');btn.disabled=true;
      try{
        await updateContract(contractId,chubReadFields('chd',client));
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

// ===== لوحة إنشاء عقد جديد — نفس تجربة المعاينة الحيّة والQR الفوري بمجرد اختيار المشروع =====
async function openNewContractPanel(){
  const rows=(await fetchPortfolio()).data||[];
  const clients=[...new Map(rows.filter(r=>r.project_id).map(r=>[r.client_id,r.client_name])).entries()];
  const panel=document.getElementById('chubPanel');
  panel.innerHTML=`<div class="chub-detail">
    <div class="chub-detail-hd"><h3>عقد جديد</h3><button class="reqbtn" id="chnClose" style="margin-inline-start:auto">✕ إغلاق</button></div>
    <div class="sa-form">
      <select id="chnClient"><option value="">اختر العميل...</option>${clients.map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('')}</select>
      <select id="chnProject" disabled><option>اختر العميل أولًا</option></select>
      <select id="chnBl" disabled><option>اختر المشروع أولًا</option></select>
    </div>
    <div id="chnRest" style="display:none;margin-top:14px">
      <div class="sa-form" style="flex-wrap:wrap">
        <input id="chdValue" type="number" placeholder="قيمة العقد (ر.س)">
        <input id="chdDate" type="date" value="${new Date().toISOString().slice(0,10)}">
        <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chdAdSpend"> يشمل إدارة إنفاق إعلاني</label>
      </div>
      <textarea id="chdSpecial" placeholder="شروط إضافية خاصة بهذا العقد (اختياري)" style="width:100%;min-height:70px;margin-top:10px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px"></textarea>
      <button class="hbtn" id="chnCreate" style="background:var(--gold);border-color:var(--gold);margin-top:10px">إنشاء العقد</button>
      <details class="pubsign-fulltext" open style="margin-top:14px">
        <summary>📄 معاينة نص العقد الكامل (حيّة — بمحتوى ونص هذا العقد تحديدًا)</summary>
        <div id="chnPreview"></div>
      </details>
    </div>
  </div>`;
  if(panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('chnClose').onclick=()=>{panel.innerHTML='';};

  let currentClient={};
  const refreshPreview=()=>{
    document.getElementById('chnPreview').innerHTML=renderMergedContractHTML(mergeContract(chubReadFields('chd',currentClient)));
  };

  document.getElementById('chnClient').onchange=async(e)=>{
    const cid=e.target.value;
    const projSel=document.getElementById('chnProject');
    const {data:clientRow}=await sb.from('pmo_clients').select('*').eq('id',cid).maybeSingle();
    currentClient=clientRow||{};
    if(!cid){projSel.disabled=true;projSel.innerHTML='<option>اختر العميل أولًا</option>';document.getElementById('chnRest').style.display='none';return;}
    const projs=rows.filter(r=>r.client_id===cid&&r.project_id);
    projSel.disabled=false;
    projSel.innerHTML='<option value="">اختر المشروع...</option>'+(projs.map(p=>`<option value="${p.project_id}">${esc(p.project_name)}</option>`).join('')||'');
    document.getElementById('chnRest').style.display='none';
  };
  document.getElementById('chnProject').onchange=async(e)=>{
    const pid=e.target.value;
    const blSel=document.getElementById('chnBl');
    if(!pid){blSel.disabled=true;document.getElementById('chnRest').style.display='none';return;}
    const {data:bls}=await sb.from('pmo_baselines').select('id,label,approved_at').eq('project_id',pid).order('approved_at',{ascending:false});
    if(!bls||!bls.length){toast('لا توجد لقطة (Baseline) لهذا المشروع بعد — افتحه وثبّت أساسًا أولًا','warn');document.getElementById('chnRest').style.display='none';return;}
    blSel.disabled=false;
    blSel.innerHTML=bls.map(b=>`<option value="${b.id}">${esc(b.label)} — ${new Date(b.approved_at).toLocaleDateString('ar')}</option>`).join('');
    document.getElementById('chnRest').style.display='';
    refreshPreview();
    ['chdValue','chdDate','chdAdSpend','chdSpecial'].forEach(id=>{
      document.getElementById(id).addEventListener('input',refreshPreview);
      document.getElementById(id).addEventListener('change',refreshPreview);
    });
  };
  document.getElementById('chnCreate').onclick=async()=>{
    const cid=document.getElementById('chnClient').value,pid=document.getElementById('chnProject').value,blId=document.getElementById('chnBl').value;
    if(!cid||!pid||!blId){toast('أكمل اختيار العميل والمشروع واللقطة','warn');return;}
    const btn=document.getElementById('chnCreate');btn.disabled=true;
    const prevCID=CID; CID=cid;
    try{
      const r=await createContract(pid,blId,{
        includesAdSpend:document.getElementById('chdAdSpend').checked,
        effectiveDate:document.getElementById('chdDate').value,
        contractValue:document.getElementById('chdValue').value
      });
      if(r&&r.ok){
        // الشروط الإضافية تُحفَظ عبر تعديل فوري بعد الإنشاء (الإنشاء نفسه لا يحمل هذا الحقل)
        const special=document.getElementById('chdSpecial').value;
        if(special&&special.trim())await updateContract(r.id,{
          includesAdSpend:document.getElementById('chdAdSpend').checked,
          effectiveDate:document.getElementById('chdDate').value,
          contractValue:document.getElementById('chdValue').value,
          specialTerms:special
        });
        toast('أُنشئ العقد بنجاح','ok');panel.innerHTML='';
        CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();
        openContractDetailPanel(r.id);
      }else toast('تعذّر الإنشاء','err');
    }catch(e){toast('تعذّر الإنشاء: '+e.message,'err');btn.disabled=false;}
    CID=prevCID;
  };
}

window.renderContractsHub=renderContractsHub;
