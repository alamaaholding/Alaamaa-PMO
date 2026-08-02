// ===== app/exportcontract.js — تصدير مستند العقد الكامل: المتن القانوني + ملحق الخطة =====
// المبدأ الحاكم: المستند يُبنى من لقطة (Baseline) محدَّدة — لا من الجدول الحيّ المتغيّر —
// فيبقى صالحًا كمرجع ثابت عند أي مراجعة أو خلاف لاحق. رمز QR يُولَّد محليًا بمكتبة مستضافة
// على نفس نطاقك (qrgen.js) — لا اعتماد على أي CDN خارجي، فلا يتعطّل أبدًا لأسباب شبكية
// أو حجب إعلانات أو جدار حماية مؤسسي.

async function ensureQR(){
  if(window.qrcode)return;
  await loadScript('qrgen.js?v='+BUILD_V);
  if(!window.qrcode)throw new Error('تعذّر تحميل مولّد QR المستضاف ذاتيًا');
}
function generateQRDataURL(text){
  const qr=window.qrcode(0,'M'); // 0 = اكتشاف الحجم تلقائيًا، M = تصحيح خطأ متوسط
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6,8); // حجم الخلية 6px، هامش 8 خلايا
}

async function openContractExport(){
  if(!PROJECT||!PROJECT.baselines||!PROJECT.baselines.length){
    toast('لا توجد لقطة (Baseline) بعد لهذا المشروع — ثبّت أساسًا أولًا','warn');return;
  }
  const r=await dialog({title:'تصدير للعقد',
    fields:[{key:'bl',label:'اللقطة (Baseline) المُصدَّرة',type:'select',value:PROJECT.baselines[PROJECT.baselines.length-1].id,
      options:PROJECT.baselines.slice().reverse().map(b=>({v:b.id,t:b.label+' — '+new Date(b.approved_at).toLocaleDateString('ar')}))}],
    confirmText:'تصدير'});
  if(!r)return;
  await buildContractDoc(r.bl); // بلا عقد بعد — ملحق الخطة وحده (مستند مؤقت قبل إنشاء أي عقد فعلي)
}

// contract (اختياري): كائن العقد الكامل من fetchContractsForProject — إن وُجد، يُدمَج متن
// العقد القانوني الكامل (17 بندًا) قبل ملحق الخطة في مستند واحد، مع رمز QR يحيل لتوقيعه.
// contract: كائن العقد الكامل. يعمل الآن مستقلًا تمامًا — لا يتطلب فتح المشروع أولًا،
// ولا وجود لقطة أصلًا. كان يفشل فورًا من محفظة العقود لأنه كان يبحث عن اللقطة داخل
// PROJECT المحمَّل حاليًا فقط (وهو غير محمَّل هناك) فيخرج برسالة "لقطة غير موجودة".
async function buildContractDoc(baselineId,contract,attachments){
  const clientName=(contract&&contract.client_name)||((CLIENTS.find(c=>c.id===CID)||{}).name)||'';

  // اللقطة: من المشروع المحمَّل إن وُجدت، وإلا تُجلَب من القاعدة مباشرة بمعرّفها
  let bl=null;
  if(baselineId){
    bl=(typeof PROJECT!=='undefined'&&PROJECT&&PROJECT.baselines||[]).find(b=>b.id===baselineId)||null;
    if(!bl){
      try{
        const fetched=await fetchBaselineById(baselineId);
        if(fetched&&fetched.id)bl=fetched;
      }catch(e){}
    }
  }

  let qrImg='';
  if(contract&&contract.token){
    try{
      await ensureQR();
      qrImg=generateQRDataURL(location.origin+location.pathname+'#/sign/'+contract.token);
    }catch(e){
      toast('تعذّر توليد رمز QR ('+e.message+') — سيُصدَّر المستند بلا الرمز','warn');
    }
  }

  // متن العقد: مخصَّص أو قياسي، بحسب نوعه الفعلي
  let contractHtml='';
  if(contract){
    if(contract.contract_type==='custom'){
      contractHtml=`<section class="cx-page cx-contract-body">${renderCustomContractHTML({
        title:contract.custom_title||contract.contract_name,body:contract.custom_body,
        clientName,clientCr:contract.client_cr,clientVat:contract.client_vat,clientAddress:contract.client_address,
        clientRepName:contract.client_rep_name,clientRepTitle:contract.client_rep_title,
        clientEmail:contract.client_contact_email,clientPhone:contract.client_contact_phone
      })}</section>`;
    }else{
      contractHtml=`<section class="cx-page cx-contract-body">${renderMergedContractHTML(mergeContract({
        clientName,clientCr:contract.client_cr,clientVat:contract.client_vat,clientAddress:contract.client_address,
        clientRepName:contract.client_rep_name,clientRepTitle:contract.client_rep_title,
        clientEmail:contract.client_contact_email,clientPhone:contract.client_contact_phone,
        includesAdSpend:contract.includes_ad_spend,effectiveDate:contract.effective_date,
        contractValue:contract.contract_value,latePaymentCap:contract.late_payment_cap,
        specialTerms:contract.special_terms
      }))}</section>`;
    }
  }

  // ملحق الخطة — يُدرَج فقط إن توفّرت لقطة فعلية
  let annexHtml='';
  if(bl){
    const snap=bl.snapshot||{};
    const usingLive=(typeof PROJECT!=='undefined'&&PROJECT&&PROJECT.baselines||[]).some(b=>b.id===baselineId);
    const tasks=usingLive?PROJECT.tasks.filter(t=>t.type!=='package').map(t=>({
        id:t.id,name:t.name,type:t.type,duration:t.duration,track:t.track}))
      :(bl.tasks||[]).map(t=>({id:t.ref,name:t.name,type:t.type,duration:t.duration,track:t.track}));
    const phases=usingLive?projTrackList()
      :(bl.tracks||[]).map(tr=>({key:tr.key,name:tr.name,color:tr.color||'#C8A06B'}));
    const byPhase={};phases.forEach(p=>{byPhase[p.key]=[];});
    tasks.forEach(t=>{
      const row=snap[t.id]||{};
      (byPhase[t.track]=byPhase[t.track]||[]).push({
        id:t.id,name:t.name,type:t.type,
        duration:row.duration!=null?row.duration:t.duration,
        ES:row.ES?fmt(new Date(row.ES)):'—', EF:row.EF?fmt(new Date(row.EF)):'—'});
    });
    const phasePages=phases.filter(p=>(byPhase[p.key]||[]).length).map(p=>{
      const rows=byPhase[p.key].map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${TYPES[x.type]||x.type}</td>
        <td>${x.type==='milestone'?'—':(x.duration||0)+' يوم'}</td><td>${x.ES}</td><td>${x.EF}</td></tr>`).join('');
      return `<section class="cx-page">
        <div class="cx-phase-hd" style="--pc:${p.color}"><span></span>${esc(p.name)}</div>
        <table class="cx-table"><thead><tr><th>المعرّف</th><th>الاسم</th><th>النوع</th><th>المدة</th><th>البداية</th><th>النهاية</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </section>`;
    }).join('');
    if(phasePages)annexHtml=`<div class="cx-annex-hd">ملحق (١) — الخطة المعتمدة (${esc(bl.label||'')})</div>${phasePages}`;
  }

  // قائمة المرفقات الأخرى (روابط/مستندات) — تُدرَج كصفحة ملحق مستقلة
  let attachHtml='';
  const links=(attachments||[]).filter(a=>a.kind==='link'&&a.url);
  if(links.length){
    attachHtml=`<div class="cx-annex-hd">ملحق — مستندات مرفقة</div>
      <section class="cx-page"><table class="cx-table"><thead><tr><th>المستند</th><th>الرابط</th></tr></thead><tbody>
      ${links.map(a=>`<tr><td>${esc(a.label)}</td><td style="direction:ltr;font-size:.7rem">${esc(a.url)}</td></tr>`).join('')}
      </tbody></table></section>`;
  }

  const today=new Date().toLocaleDateString('ar',{year:'numeric',month:'long',day:'numeric'});
  const doc=document.getElementById('contractPrint');
  doc.innerHTML=`
    <section class="cx-cover">
      <div class="cx-cover-brand">علامة <span>· أثر دائم</span></div>
      <h1>${contract?esc(contract.contract_name||'عقد تقديم خدمات'):'الخطة المعتمدة'}</h1>
      <div class="cx-cover-meta">
        ${contract&&contract.contract_number?`<div><b>رقم العقد</b><span>${esc(contract.contract_number)}</span></div>`:''}
        <div><b>العميل</b><span>${esc(clientName||'—')}</span></div>
        ${contract&&contract.project_name?`<div><b>المشروع</b><span>${esc(contract.project_name)}</span></div>`:''}
        ${bl?`<div><b>اللقطة المرجعية (ملحق الخطة)</b><span>${esc(bl.label||'')}</span></div>`:''}
      </div>
      <p class="cx-cover-note">${bl
        ?'هذا المستند يضمّ متن العقد الكامل وملحق الخطة المعتمدة معًا كوثيقة واحدة — بُني بتاريخ '+today+'.'
        :'متن العقد الكامل — بُني بتاريخ '+today+'.'}</p>
      ${qrImg?`<div class="cx-qr"><img src="${qrImg}" alt="QR"><span><b>رمز خاص بعقد ${esc(clientName)}</b><br>يحيل حصرًا لصفحة توقيع هذا العقد تحديدًا</span></div>`:''}
    </section>
    ${contractHtml}
    ${annexHtml}
    ${attachHtml}
    <div class="cx-footer">علامة · أثر دائم — مستند مُولَّد آليًا من منصة حوكمة المشاريع${contract&&contract.contract_number?' · '+esc(contract.contract_number):''}</div>
  `;
  document.body.classList.add('printing-contract');
  const qrEl=doc.querySelector('.cx-qr img');
  const imgReady=qrEl?new Promise(res=>{qrEl.complete?res():(qrEl.onload=qrEl.onerror=res);}):Promise.resolve();
  await Promise.race([imgReady,new Promise(res=>setTimeout(res,500))]);
  setTimeout(()=>{
    window.print();
    const restore=()=>{document.body.classList.remove('printing-contract');window.removeEventListener('afterprint',restore);};
    window.addEventListener('afterprint',restore);
  },120);
}

window.openContractExport=openContractExport;
