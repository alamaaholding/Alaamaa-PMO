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
async function buildContractDoc(baselineId,contract){
  const bl=(PROJECT.baselines||[]).find(b=>b.id===baselineId);
  if(!bl){toast('لقطة غير موجودة','err');return;}
  const clientName=(CLIENTS.find(c=>c.id===CID)||{}).name||'';

  let qrImg='';
  if(contract&&contract.token){
    try{
      await ensureQR();
      const url=location.origin+location.pathname+'#/sign/'+contract.token;
      qrImg=generateQRDataURL(url);
    }catch(e){
      toast('تعذّر توليد رمز QR (' + e.message + ') — سيُصدَّر المستند بلا الرمز؛ أعد المحاولة','warn');
    }
  }

  // متن العقد الكامل — فقط إن مُرِّر كائن عقد فعلي (لا عند التصدير المبدئي بلا عقد بعد)
  let contractHtml='';
  if(contract){
    const merged=mergeContract({
      clientName,clientCr:contract.client_cr,clientAddress:contract.client_address,
      clientRepName:contract.client_rep_name,clientRepTitle:contract.client_rep_title,
      clientEmail:contract.client_contact_email,clientPhone:contract.client_contact_phone,
      includesAdSpend:contract.includes_ad_spend,effectiveDate:contract.effective_date,
      contractValue:contract.contract_value,latePaymentCap:contract.late_payment_cap
    });
    contractHtml=`<section class="cx-page cx-contract-body">${renderMergedContractHTML(merged)}</section>`;
  }

  const snap=bl.snapshot||{};
  const phases=projTrackList();
  const byPhase={};phases.forEach(p=>{byPhase[p.key]=[];});
  PROJECT.tasks.forEach(t=>{
    if(t.type==='package')return;
    const row=snap[t.id]||{};
    (byPhase[t.track]=byPhase[t.track]||[]).push({
      id:t.id,name:t.name,type:t.type,
      duration:row.duration!=null?row.duration:t.duration,
      ES:row.ES?fmt(new Date(row.ES)):'—', EF:row.EF?fmt(new Date(row.EF)):'—'
    });
  });
  const today=new Date().toLocaleDateString('ar',{year:'numeric',month:'long',day:'numeric'});
  const blDate=new Date(bl.approved_at).toLocaleDateString('ar',{year:'numeric',month:'long',day:'numeric'});

  const phasePages=phases.filter(p=>(byPhase[p.key]||[]).length).map(p=>{
    const rows=byPhase[p.key].map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${TYPES[x.type]||x.type}</td>
      <td>${x.type==='milestone'?'—':x.duration+' يوم'}</td><td>${x.ES}</td><td>${x.EF}</td></tr>`).join('');
    return `<section class="cx-page">
      <div class="cx-phase-hd" style="--pc:${p.color}"><span></span>${esc(p.name)}</div>
      <table class="cx-table"><thead><tr><th>المعرّف</th><th>الاسم</th><th>النوع</th><th>المدة</th><th>البداية</th><th>النهاية</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </section>`;
  }).join('');
  const annexHd=contract?`<div class="cx-annex-hd">ملحق (١) — الخطة المعتمدة</div>`:'';

  const doc=document.getElementById('contractPrint');
  doc.innerHTML=`
    <section class="cx-cover">
      <div class="cx-cover-brand">علامة <span>· أثر دائم</span></div>
      <h1>${contract?'عقد تقديم خدمات':'الخطة المعتمدة'}</h1>
      <div class="cx-cover-meta">
        <div><b>العميل</b><span>${esc(clientName)}</span></div>
        <div><b>المشروع</b><span>${esc(PROJECT.name)}</span></div>
        <div><b>اللقطة المرجعية (ملحق الخطة)</b><span>${esc(bl.label)}</span></div>
        <div><b>تاريخ الاعتماد</b><span>${blDate}</span></div>
      </div>
      <p class="cx-cover-note">${contract
        ?'هذا المستند يضمّ متن العقد الكامل وملحق الخطة المعتمدة معًا كوثيقة واحدة — بُني بتاريخ '+today+'.'
        :'هذا المستند لقطة ثابتة من الخطة بتاريخ اعتمادها أعلاه — لا يعكس أي تعديل لاحق. أُصدر آليًا بتاريخ '+today+'.'}</p>
      ${qrImg?`<div class="cx-qr"><img src="${qrImg}" alt="QR"><span><b>رمز خاص بعقد ${esc(clientName)}</b><br>يحيل حصرًا لصفحة توقيع هذا العقد تحديدًا — لا يُستخدم لغير هذا الغرض</span></div>`:''}
    </section>
    ${contractHtml}
    ${annexHd}
    ${phasePages}
    <div class="cx-footer">علامة · أثر دائم — مستند مُولَّد آليًا من منصة حوكمة المشاريع · ${esc(bl.label)}</div>
  `;
  document.body.classList.add('printing-contract');
  const qrEl=doc.querySelector('.cx-qr img');
  const imgReady=qrEl?new Promise(res=>{qrEl.complete?res():(qrEl.onload=qrEl.onerror=res);}):Promise.resolve();
  const safetyTimeout=new Promise(res=>setTimeout(res,500)); // لا ننتظر أبدًا إلى ما لا نهاية
  await Promise.race([imgReady,safetyTimeout]);
  setTimeout(()=>{
    window.print();
    const restore=()=>{document.body.classList.remove('printing-contract');window.removeEventListener('afterprint',restore);};
    window.addEventListener('afterprint',restore);
  },120);
}

window.openContractExport=openContractExport;
