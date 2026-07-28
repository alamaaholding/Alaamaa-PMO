// ===== app/contractshub.js — إدارة العقود الشاملة (من المحفظة) =====
// مصدر البيانات: pmo_all_contracts_view — يحترم pmo_can_see_project_staff لكل عقد على حدة،
// فلا يظهر إلا ما يملك المستخدم صلاحية رؤيته أصلًا، تمامًا كبقية شاشات المحفظة.

let CH_CONTRACTS=[],CH_FILTER={status:'all',q:''};

async function renderContractsHub(){
  SCREEN='contractshub';
  $('#hProject').textContent='إدارة العقود';
  $('#barClient').style.display='none';hideChrome();
  try{history.replaceState(null,'','#/contracts');}catch(e){}
  $('#host').innerHTML=`
    <div class="hintbar"><button class="reqbtn" id="chubBack">↩ المحفظة</button>
      <span style="margin-inline-start:auto">كل عقود المحفظة في مكان واحد — إنشاء، تعديل قبل التوقيع، توقيع، تصدير، وإلغاء.</span></div>
    <div id="chubBody"><div class="skeleton" style="height:60px;margin-bottom:10px"></div>
      <div class="skeleton" style="height:300px"></div></div>`;
  $('#chubBack').onclick=renderPortfolio;

  try{
    CH_CONTRACTS=await fetchAllContracts();
  }catch(e){
    $('#chubBody').innerHTML='<p class="pempty">تعذّر تحميل العقود: '+esc(e.message)+'</p>';return;
  }
  renderContractsHubBody();
}

function renderContractsHubBody(){
  const STL={draft:'مسودة',pending_alamaa:'بانتظار توقيع علامة',pending_client:'بانتظار توقيع العميل',signed:'موقَّع بالكامل ✅',void:'ملغى'};
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
    const anySigned=!!(al||cl);
    const link=location.origin+location.pathname+'#/sign/'+c.token;
    return `<div class="chub-row">
      <div class="chub-row-main">
        <div class="chub-row-hd">
          <b>${esc(c.client_name)}</b><span class="chub-sep">·</span>${esc(c.project_name)}
          <span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${STL[c.status]||c.status}</span>
        </div>
        <div class="sa-hint">${esc(c.baseline_label)} · ${c.includes_ad_spend?'يشمل إنفاقًا إعلانيًا':'بلا إنفاق إعلاني'}${c.contract_value?' · '+Number(c.contract_value).toLocaleString('ar')+' ر.س':''}
          · علامة: ${al?esc(al.name):'—'} · العميل: ${cl?esc(cl.name):'—'}</div>
      </div>
      <div class="chub-row-actions">
        <button class="reqbtn" data-chubcopy="${link}">نسخ الرابط</button>
        <button class="reqbtn" data-chubview="${c.id}">عرض النص</button>
        ${!anySigned&&c.status!=='void'?`<button class="reqbtn" data-chubedit="${c.id}">✏️ تعديل</button>`:''}
        ${c.status!=='signed'&&c.status!=='void'?`<button class="reqbtn" data-chubvoid="${c.id}" style="color:var(--crit)">🗑 إلغاء</button>`:''}
      </div>
      <div id="chubDetail-${c.id}" style="display:none;grid-column:1/-1;margin-top:10px"></div>
    </div>`;
  }).join('')||'<p class="empty">لا عقود تطابق هذا الفلتر.</p>';

  $('#chubBody').innerHTML=`
    <div class="sa-section">
      <div class="chub-filters">
        <input id="chubSearch" placeholder="🔍 ابحث باسم العميل أو المشروع..." value="${esc(CH_FILTER.q)}" style="flex:1;min-width:200px">
        <div class="chub-status-pills">
          ${['all','pending_alamaa','pending_client','signed','void'].map(s=>
            `<button class="chub-pill ${CH_FILTER.status===s?'active':''}" data-chubstatus="${s}">${s==='all'?'الكل':STL[s]} <span>${counts[s]||0}</span></button>`).join('')}
        </div>
        <button class="hbtn" id="chubNew" style="background:var(--gold);border-color:var(--gold)">+ عقد جديد</button>
      </div>
    </div>
    <div class="sa-section">${rows}</div>
    <div id="chubNewArea"></div>
  `;

  $('#chubSearch').oninput=e=>{CH_FILTER.q=e.target.value;renderContractsHubBody();};
  $$('#chubBody [data-chubstatus]').forEach(b=>b.onclick=()=>{CH_FILTER.status=b.dataset.chubstatus;renderContractsHubBody();});
  $('#chubNew').onclick=openNewContractFromHub;

  $$('#chubBody [data-chubcopy]').forEach(b=>b.onclick=async()=>{
    try{await navigator.clipboard.writeText(b.dataset.chubcopy);toast('نُسخ الرابط','ok');}
    catch(e){toast('انسخ الرابط يدويًا','warn');}
  });
  $$('#chubBody [data-chubview]').forEach(b=>b.onclick=async()=>{
    const c=CH_CONTRACTS.find(x=>x.id===b.dataset.chubview);
    const box=document.getElementById('chubDetail-'+c.id);
    const show=box.style.display==='none';
    box.style.display=show?'':'none';
    if(!show)return;
    const mergeData={
      clientName:c.client_name,clientCr:c.client_cr,clientAddress:c.client_address,clientRepName:c.client_rep_name,
      clientRepTitle:c.client_rep_title,clientEmail:c.client_contact_email,clientPhone:c.client_contact_phone,
      includesAdSpend:c.includes_ad_spend,effectiveDate:c.effective_date,contractValue:c.contract_value,
      latePaymentCap:c.late_payment_cap,specialTerms:c.special_terms
    };
    let badge='';
    if(c.document_hash){
      try{
        const nowHash=await computeContractHash(mergeData);
        badge=nowHash===c.document_hash?'<div class="ctr-integrity ok">✅ النص مطابق تمامًا لما وُقِّع عليه</div>'
          :'<div class="ctr-integrity warn">⚠ النص يختلف عمّا كان وقت الإنشاء</div>';
      }catch(e){}
    }
    box.innerHTML=badge+renderMergedContractHTML(mergeContract(mergeData));
  });
  $$('#chubBody [data-chubvoid]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('إلغاء العقد','سيصبح هذا العقد ملغى ولا يمكن توقيعه بعد الآن.',true))return;
    try{
      const r=await voidContract(b.dataset.chubvoid);
      if(r&&r.ok){toast('أُلغي العقد','ok');CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();}
      else toast('تعذّر الإلغاء','err');
    }catch(e){toast('تعذّر الإلغاء: '+e.message,'err');}
  });
  $$('#chubBody [data-chubedit]').forEach(b=>b.onclick=()=>openEditContract(b.dataset.chubedit));
}

async function openEditContract(contractId){
  const c=CH_CONTRACTS.find(x=>x.id===contractId);
  if(!c)return;
  const area=document.getElementById('chubNewArea');
  area.innerHTML=`
    <div class="sa-section">
      <h4>تعديل عقد — ${esc(c.client_name)} · ${esc(c.project_name)} <span class="sa-hint">متاح فقط قبل أي توقيع</span></h4>
      <div class="sa-form" style="flex-wrap:wrap">
        <input id="cheValue" type="number" placeholder="قيمة العقد (ر.س)" value="${c.contract_value||''}" style="width:150px">
        <input id="cheDate" type="date" value="${c.effective_date||''}">
        <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="cheAdSpend" ${c.includes_ad_spend?'checked':''}> يشمل إدارة إنفاق إعلاني</label>
      </div>
      <textarea id="cheSpecial" placeholder="شروط إضافية خاصة بهذا العقد (اختياري)" style="width:100%;min-height:80px;margin-top:10px;font-family:inherit;border:1.5px solid var(--line);border-radius:8px;padding:10px">${esc(c.special_terms||'')}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="hbtn" id="cheSave" style="background:var(--gold);border-color:var(--gold)">حفظ التعديلات</button>
        <button class="reqbtn" id="cheCancel">إلغاء</button>
      </div>
    </div>`;
  if(area.scrollIntoView)area.scrollIntoView({behavior:'smooth',block:'center'});
  document.getElementById('cheCancel').onclick=()=>{area.innerHTML='';};
  document.getElementById('cheSave').onclick=async()=>{
    const btn=document.getElementById('cheSave');btn.disabled=true;
    try{
      await updateContract(contractId,{
        includesAdSpend:document.getElementById('cheAdSpend').checked,
        effectiveDate:document.getElementById('cheDate').value,
        contractValue:document.getElementById('cheValue').value,
        specialTerms:document.getElementById('cheSpecial').value
      });
      toast('حُفظت التعديلات','ok');
      area.innerHTML='';
      CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();
    }catch(e){toast(e.message,'err');btn.disabled=false;}
  };
}

async function openNewContractFromHub(){
  const rows=(await fetchPortfolio()).data||[];
  const clients=[...new Map(rows.filter(r=>r.project_id).map(r=>[r.client_id,r.client_name])).entries()];
  const area=document.getElementById('chubNewArea');
  area.innerHTML=`
    <div class="sa-section">
      <h4>عقد جديد</h4>
      <div class="sa-form">
        <select id="chnClient"><option value="">اختر العميل...</option>${clients.map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('')}</select>
        <select id="chnProject" disabled><option>اختر العميل أولًا</option></select>
      </div>
      <div id="chnRest" style="display:none;margin-top:12px">
        <div class="sa-form" style="flex-wrap:wrap">
          <select id="chnBl"></select>
          <input id="chnValue" type="number" placeholder="قيمة العقد (ر.س)">
          <input id="chnDate" type="date" value="${new Date().toISOString().slice(0,10)}">
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="chnAdSpend"> يشمل إدارة إنفاق إعلاني</label>
        </div>
        <button class="hbtn" id="chnCreate" style="background:var(--gold);border-color:var(--gold);margin-top:10px">إنشاء العقد</button>
      </div>
      <button class="reqbtn" id="chnCancel" style="margin-top:10px">إلغاء</button>
    </div>`;
  if(area.scrollIntoView)area.scrollIntoView({behavior:'smooth',block:'center'});
  document.getElementById('chnCancel').onclick=()=>{area.innerHTML='';};

  document.getElementById('chnClient').onchange=async(e)=>{
    const cid=e.target.value;
    const projSel=document.getElementById('chnProject');
    if(!cid){projSel.disabled=true;projSel.innerHTML='<option>اختر العميل أولًا</option>';document.getElementById('chnRest').style.display='none';return;}
    const projs=rows.filter(r=>r.client_id===cid&&r.project_id);
    projSel.disabled=false;
    projSel.innerHTML=projs.map(p=>`<option value="${p.project_id}">${esc(p.project_name)}</option>`).join('')||'<option value="">لا مشاريع لهذا العميل</option>';
    document.getElementById('chnRest').style.display=projs.length?'':'none';
  };
  document.getElementById('chnCreate').onclick=async()=>{
    const cid=document.getElementById('chnClient').value,pid=document.getElementById('chnProject').value;
    if(!cid||!pid){toast('اختر العميل والمشروع','warn');return;}
    const {data:bls}=await sb.from('pmo_baselines').select('id,label,approved_at').eq('project_id',pid).order('approved_at',{ascending:false});
    if(!bls||!bls.length){toast('لا توجد لقطة (Baseline) لهذا المشروع بعد — افتحه وثبّت أساسًا أولًا','warn');return;}
    const blSel=document.getElementById('chnBl');
    if(!blSel.options.length){
      blSel.innerHTML=bls.map(b=>`<option value="${b.id}">${esc(b.label)} — ${new Date(b.approved_at).toLocaleDateString('ar')}</option>`).join('');
      toast('اختر اللقطة ثم اضغط إنشاء مرة أخرى','warn');return;
    }
    const btn=document.getElementById('chnCreate');btn.disabled=true;
    const prevCID=CID; CID=cid;
    try{
      const r=await createContract(pid,blSel.value,{
        includesAdSpend:document.getElementById('chnAdSpend').checked,
        effectiveDate:document.getElementById('chnDate').value,
        contractValue:document.getElementById('chnValue').value
      });
      if(r&&r.ok){
        toast('أُنشئ العقد بنجاح','ok');area.innerHTML='';
        CH_CONTRACTS=await fetchAllContracts();renderContractsHubBody();
      }else toast('تعذّر الإنشاء','err');
    }catch(e){toast('تعذّر الإنشاء: '+e.message,'err');btn.disabled=false;}
    CID=prevCID;
  };
}

window.renderContractsHub=renderContractsHub;
