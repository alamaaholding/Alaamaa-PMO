// ===== app/contractsign.js — العقود والتوقيع الإلكتروني =====
// مبدأ الأمان: الجداول مغلقة تمامًا عن anon على مستوى RLS؛ كل تفاعل عام يمرّ حصرًا عبر
// دوال SECURITY DEFINER محكومة بالرمز العشوائي في الرابط — لا وصول مباشر للجداول أبدًا.

// ===== لوحة توقيع بسيطة: رسم باللمس/الفأرة + خيار كتابة الاسم بدلًا من الرسم =====
function mountSignaturePad(container){
  container.innerHTML=`
    <div class="sig-tabs">
      <button type="button" class="sig-tab active" data-sigmode="draw">ارسم توقيعك</button>
      <button type="button" class="sig-tab" data-sigmode="type">اكتب اسمك بدل الرسم</button>
    </div>
    <div id="sigDrawWrap"><canvas id="sigCanvas" width="480" height="160"></canvas>
      <button type="button" class="reqbtn" id="sigClear" style="margin-top:6px">مسح</button></div>
    <div id="sigTypeWrap" style="display:none">
      <input id="sigTypeName" placeholder="اكتب اسمك هنا كتوقيع" style="width:100%;font-size:1.4rem;font-family:'Segoe Script',cursive;
        border:1.5px solid var(--line);border-radius:8px;padding:14px;text-align:center">
    </div>`;
  const canvas=container.querySelector('#sigCanvas'),ctx=canvas.getContext('2d');
  ctx.strokeStyle='#1A1A1A';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';
  let drawing=false,hasDrawn=false;
  const pos=e=>{
    const r=canvas.getBoundingClientRect();
    const p=e.touches?e.touches[0]:e;
    return {x:(p.clientX-r.left)*(canvas.width/r.width),y:(p.clientY-r.top)*(canvas.height/r.height)};
  };
  const start=e=>{drawing=true;hasDrawn=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault();};
  const move=e=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault();};
  const end=()=>{drawing=false;};
  canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);
  window.addEventListener('mouseup',end);
  canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});
  canvas.addEventListener('touchend',end);
  container.querySelector('#sigClear').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasDrawn=false;};
  container.querySelectorAll('[data-sigmode]').forEach(b=>b.onclick=()=>{
    container.querySelectorAll('[data-sigmode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const draw=b.dataset.sigmode==='draw';
    container.querySelector('#sigDrawWrap').style.display=draw?'':'none';
    container.querySelector('#sigTypeWrap').style.display=draw?'none':'';
  });
  return {
    getData(){
      const typed=container.querySelector('#sigTypeName').value.trim();
      const typeMode=container.querySelector('#sigTypeWrap').style.display!=='none';
      if(typeMode)return typed?{ok:true,data:null,typed}:{ok:false};
      return hasDrawn?{ok:true,data:canvas.toDataURL('image/png'),typed:null}:{ok:false};
    }
  };
}

// ===== المسار العام: بلا تسجيل دخول =====
async function renderPublicSign(token){
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  const root=document.getElementById('publicSign');
  root.classList.remove('hidden');
  root.innerHTML=`<div class="pubsign-wrap"><div class="pubsign-card"><div class="skeleton" style="height:26px;width:60%;margin-bottom:14px"></div>
    <div class="skeleton" style="height:200px"></div></div></div>`;

  let d;
  try{ d=await fetchPublicContract(token); }
  catch(e){ return pubSignError('تعذّر تحميل العقد. تحقّق من الرابط أو حاول لاحقًا.'); }
  if(!d||!d.ok) return pubSignError(
    d&&d.error==='not_found'?'هذا الرابط غير صالح.':
    'تعذّر عرض هذا العقد حاليًا.');

  if(d.archived) return pubSignError('انتهت صلاحية هذا الرابط العام — المشروع مؤرشف الآن. لعرض التفاصيل، سجّل الدخول من داخل المنصة.',true);

  const clientSigned=(d.signatures||[]).some(s=>s.party==='client');
  const alamaaSig=(d.signatures||[]).find(s=>s.party==='alamaa');
  const clientSig=(d.signatures||[]).find(s=>s.party==='client');
  const fullySigned=d.status==='signed';

  const sigRow=(label,s)=>s?`<div class="pubsig-row"><b>${label}</b><span>${esc(s.name)} · ${new Date(s.signed_at).toLocaleString('ar')}</span></div>`
    :`<div class="pubsig-row pubsig-pending"><b>${label}</b><span>بانتظار التوقيع</span></div>`;

  document.getElementById('publicSign').innerHTML=`
    <div class="pubsign-wrap"><div class="pubsign-card">
      <div class="pubsign-brand">علامة <span>· أثر دائم</span></div>
      <h2>${fullySigned?'العقد موقَّع من الطرفين':'توقيع العقد'}</h2>
      <div class="pubsign-meta">
        <div><b>العميل</b><span>${esc(d.client_name)}</span></div>
        <div><b>المشروع</b><span>${esc(d.project_name)}</span></div>
        <div><b>اللقطة المرجعية</b><span>${esc(d.baseline_label)} — ${new Date(d.baseline_date).toLocaleDateString('ar')}</span></div>
      </div>
      <div class="pubsig-status">${sigRow('علامة',alamaaSig)}${sigRow('العميل',clientSig)}</div>
      <details class="pubsign-fulltext" ${clientSigned?'':'open'}>
        <summary>${clientSigned?'عرض نص العقد الكامل':'📄 اقرأ نص العقد كاملًا قبل التوقيع'}</summary>
        ${renderMergedContractHTML(mergeContract({
          clientName:d.client_name,clientCr:d.client_cr,clientAddress:d.client_address,
          clientRepName:d.client_rep_name,clientRepTitle:d.client_rep_title,
          includesAdSpend:d.includes_ad_spend,effectiveDate:d.effective_date,contractValue:d.contract_value,latePaymentCap:d.late_payment_cap
        }))}
      </details>
      ${fullySigned?`
        <p class="pubsign-note">✅ عقد ساري ومكتمل التوقيع من الطرفين — هذه النسخة للاطّلاع فقط ولا يمكن التعديل عليها.</p>
        <div class="pubsign-progress">
          <div><b>نسبة إنجاز المشروع حتى الآن</b><span>${d.progress_pct}%</span></div>
          <div class="trk-bar"><div class="trk-bar-fill" style="width:${d.progress_pct}%;background:var(--ok)"></div></div>
        </div>
        <button class="hbtn" id="pubGoLogin" style="background:var(--gold);border-color:var(--gold);width:100%;margin-top:16px">
          لرؤية تفاصيل سير العمل الكاملة — سجّل الدخول
        </button>`
      :(clientSigned?`<p class="pubsign-note">وقّعتَ بالفعل — بانتظار توقيع علامة لإكمال العقد.</p>`:`
        <div class="sa-section" style="margin-top:18px;text-align:right">
          <h4 style="margin-bottom:10px">التوقيع</h4>
          <input id="pubName" placeholder="الاسم الكامل *" style="width:100%;margin-bottom:8px;border:1.5px solid var(--line);border-radius:8px;padding:10px">
          <input id="pubEmail" type="email" placeholder="البريد الإلكتروني (اختياري)" style="width:100%;margin-bottom:12px;border:1.5px solid var(--line);border-radius:8px;padding:10px">
          <div id="pubSigPad"></div>
          <button class="hbtn" id="pubSignBtn" style="background:var(--gold);border-color:var(--gold);width:100%;margin-top:14px">أوافق وأوقّع</button>
          <p class="pubsign-legal">بالضغط على «أوافق وأوقّع»، أنت تقرّ بموافقتك على محتوى هذا العقد كما هو معروض أعلاه.
            سيُسجَّل اسمك ووقت التوقيع كتوثيق لهذه الموافقة.</p>
        </div>`)}
    </div></div>`;

  const golf=document.getElementById('pubGoLogin');if(golf)golf.onclick=()=>{location.hash='';location.reload();};
  const pad=document.getElementById('pubSigPad');
  if(pad){
    const sig=mountSignaturePad(pad);
    document.getElementById('pubSignBtn').onclick=async()=>{
      const name=document.getElementById('pubName').value.trim();
      const email=document.getElementById('pubEmail').value.trim();
      if(!name){toast('الاسم مطلوب','warn');return;}
      const s=sig.getData();
      if(!s.ok){toast('يرجى التوقيع (رسمًا أو كتابة الاسم) قبل المتابعة','warn');return;}
      const btn=document.getElementById('pubSignBtn');btn.disabled=true;btn.textContent='جارٍ الحفظ...';
      try{
        const r=await signContractPublic(token,name,email,s.data||('نصي: '+s.typed));
        if(r&&r.ok){toast('تم توثيق توقيعك بنجاح','ok');renderPublicSign(token);}
        else{
          const msgs={already_signed:'تم توقيع هذا العقد من قبل العميل بالفعل.',archived:'انتهت صلاحية هذا الرابط.',void:'أُلغي هذا العقد.',name_required:'الاسم مطلوب.'};
          toast(msgs[r&&r.error]||'تعذّر التوقيع','err');btn.disabled=false;btn.textContent='أوافق وأوقّع';
        }
      }catch(e){toast('تعذّر التوقيع: '+e.message,'err');btn.disabled=false;btn.textContent='أوافق وأوقّع';}
    };
  }
}
function pubSignError(msg,withLogin){
  document.getElementById('publicSign').innerHTML=`<div class="pubsign-wrap"><div class="pubsign-card" style="text-align:center">
    <div class="pubsign-brand">علامة <span>· أثر دائم</span></div>
    <p style="margin-top:20px;font-size:1.05rem">${esc(msg)}</p>
    ${withLogin?`<button class="hbtn" id="pubErrLogin" style="background:var(--gold);border-color:var(--gold);margin-top:16px">تسجيل الدخول</button>`:''}
  </div></div>`;
  const b=document.getElementById('pubErrLogin');if(b)b.onclick=()=>{location.hash='';location.reload();};
}

// ===== لوحة التحكم الداخلية: من داخل المشروع (موظف) — تُعاد استخدام نافذة taskOverlay =====
async function openContractPanel(){
  if(!PROJECT){toast('افتح المشروع أولًا','warn');return;}
  if(!PROJECT.baselines||!PROJECT.baselines.length){toast('لا توجد لقطة (Baseline) بعد — ثبّت أساسًا أولًا','warn');return;}
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='عقود المشروع والتوقيع';
  document.getElementById('tkTabs').innerHTML='';
  document.getElementById('tkBody').innerHTML='<div class="skeleton" style="height:120px"></div>';
  await refreshContractPanel();
}
async function refreshContractPanel(){
  let list;
  try{ list=await fetchContractsForProject(PROJECT._dbId); }
  catch(e){ document.getElementById('tkBody').innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>'; return; }
  const STL={draft:'مسودة',pending_alamaa:'بانتظار توقيع علامة',pending_client:'بانتظار توقيع العميل',signed:'موقَّع بالكامل ✅',void:'ملغى'};
  const blOpts=PROJECT.baselines.slice().reverse().map(b=>`<option value="${b.id}">${esc(b.label)} — ${new Date(b.approved_at).toLocaleDateString('ar')}</option>`).join('');
  const rows=list.map(c=>{
    const al=c.signatures.find(s=>s.party==='alamaa'),cl=c.signatures.find(s=>s.party==='client');
    const link=location.origin+location.pathname+'#/sign/'+c.token;
    const cEmail=(CLIENTS.find(x=>x.id===CID)||{}).contact_email||'';
    const subject=encodeURIComponent('عقد '+PROJECT.name+' — علامة');
    const body=encodeURIComponent(
      `تحية طيبة،\n\nنرفق رابط خاص بكم حصرًا لتوقيع عقد مشروع «${PROJECT.name}» إلكترونيًا (لا يُستخدم لغير هذا الغرض):\n${link}\n\nيمكنكم فتح الرابط والاطّلاع على نص العقد كاملًا ثم التوقيع مباشرة، بلا حاجة لإنشاء حساب.\n\nشكرًا لكم،\nفريق علامة`);
    const mailHref=`mailto:${encodeURIComponent(cEmail)}?subject=${subject}&body=${body}`;
    return `<div style="padding:14px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>${esc(c.baseline_label)}</b><span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${STL[c.status]||c.status}</span>
      </div>
      <div class="sa-hint" style="margin:6px 0">علامة: ${al?esc(al.name)+' — '+new Date(al.signed_at).toLocaleDateString('ar'):'لم توقّع بعد'}
        · العميل: ${cl?esc(cl.name)+' — '+new Date(cl.signed_at).toLocaleDateString('ar'):'لم يوقّع بعد'}
        · ${c.includes_ad_spend?'يشمل إنفاقًا إعلانيًا':'بلا إنفاق إعلاني'}${c.contract_value?' · '+Number(c.contract_value).toLocaleString('ar')+' ر.س':''}</div>
      <div class="ctr-link-badge">🔒 الرابط والرمز أدناه خاصّان بـ<b>${esc((CLIENTS.find(x=>x.id===CID)||{}).name||'هذا العميل')}</b> حصرًا — لتوقيع هذا العقد تحديدًا، لا يصلح لغيره</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input readonly value="${link}" style="flex:1;min-width:220px;font-size:.75rem;border:1px solid var(--line);border-radius:7px;padding:6px 8px;background:var(--soft-2)">
        <button class="reqbtn" data-copylink="${link}">نسخ الرابط</button>
        <a class="reqbtn" href="${mailHref}" style="text-decoration:none;display:inline-flex;align-items:center">📧 إرسال بالبريد</a>
        <button class="reqbtn" data-exportqr="${c.id}">📄 تصدير PDF بـ QR (العقد كاملًا + الخطة)</button>
        <button class="reqbtn" data-viewtext="${c.id}">عرض نص العقد الكامل</button>
        ${!al?`<button class="reqbtn" data-signalamaa="${c.id}" style="background:var(--ok);border-color:var(--ok);color:#fff">توقيع علامة الآن</button>`:''}
      </div>
      <div id="ctText-${c.id}" style="display:none;margin-top:10px"></div>
    </div>`;
  }).join('')||'<p class="empty">لا عقود بعد.</p>';

  const clientC=CLIENTS.find(x=>x.id===CID)||{};
  document.getElementById('tkBody').innerHTML=`
    <div class="sa-section" style="margin-bottom:14px">
      <h4>إنشاء عقد جديد</h4>
      <div class="sa-form" style="flex-wrap:wrap">
        <select id="ctNewBl">${blOpts}</select>
        <input id="ctValue" type="number" placeholder="قيمة العقد (ر.س)" value="${PROJECT.contractValue||''}" style="width:150px">
        <input id="ctDate" type="date" title="تاريخ سريان العقد" value="${new Date().toISOString().slice(0,10)}">
        <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="ctAdSpend"> يشمل إدارة إنفاق إعلاني</label>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="reqbtn" id="ctPreview">👁 معاينة نص العقد الكامل</button>
        <button class="hbtn" id="ctCreate" style="background:var(--gold);border-color:var(--gold)">إنشاء العقد</button>
      </div>
      <div id="ctPreviewArea" style="display:none;margin-top:14px"></div>
    </div>
    ${rows}
    <div id="ctSignArea"></div>`;

  const buildPreviewData=()=>({
    clientName:clientC.name,clientCr:clientC.cr_number,clientAddress:clientC.national_address_short,
    clientRepName:clientC.rep_name,clientRepTitle:clientC.rep_title,clientEmail:clientC.contact_email,clientPhone:clientC.contact_phone,
    includesAdSpend:document.getElementById('ctAdSpend').checked,
    effectiveDate:document.getElementById('ctDate').value,
    contractValue:document.getElementById('ctValue').value,
    latePaymentCap:document.getElementById('ctValue').value?Math.round(Number(document.getElementById('ctValue').value)*0.03*100)/100:null
  });
  document.getElementById('ctPreview').onclick=()=>{
    const area=document.getElementById('ctPreviewArea');
    const show=area.style.display==='none';
    area.style.display=show?'':'none';
    if(show)area.innerHTML=renderMergedContractHTML(mergeContract(buildPreviewData()));
  };
  document.getElementById('ctAdSpend').onchange=document.getElementById('ctValue').oninput=document.getElementById('ctDate').onchange=()=>{
    const area=document.getElementById('ctPreviewArea');
    if(area.style.display!=='none')area.innerHTML=renderMergedContractHTML(mergeContract(buildPreviewData()));
  };
  document.querySelectorAll('[data-viewtext]').forEach(b=>b.onclick=()=>{
    const c=list.find(x=>x.id===b.dataset.viewtext);
    const box=document.getElementById('ctText-'+c.id);
    const show=box.style.display==='none';
    box.style.display=show?'':'none';
    if(show)box.innerHTML=renderMergedContractHTML(mergeContract({
      clientName:clientC.name,clientCr:c.client_cr,clientAddress:c.client_address,clientRepName:c.client_rep_name,
      clientRepTitle:c.client_rep_title,clientEmail:c.client_contact_email,clientPhone:c.client_contact_phone,
      includesAdSpend:c.includes_ad_spend,effectiveDate:c.effective_date,contractValue:c.contract_value,latePaymentCap:c.late_payment_cap
    }));
  });

  document.getElementById('ctCreate').onclick=async()=>{
    try{
      const r=await createContract(PROJECT._dbId,document.getElementById('ctNewBl').value,{
        includesAdSpend:document.getElementById('ctAdSpend').checked,
        effectiveDate:document.getElementById('ctDate').value,
        contractValue:document.getElementById('ctValue').value
      });
      if(r&&r.ok){toast('أُنشئ العقد — انسخ الرابط لإرساله للعميل','ok');await refreshContractPanel();}
      else toast('تعذّر الإنشاء','err');
    }catch(e){toast('تعذّر الإنشاء: '+e.message,'err');}
  };
  document.querySelectorAll('[data-copylink]').forEach(b=>b.onclick=async()=>{
    try{await navigator.clipboard.writeText(b.dataset.copylink);toast('نُسخ الرابط','ok');}
    catch(e){toast('انسخ الرابط يدويًا من الحقل','warn');}
  });
  document.querySelectorAll('[data-exportqr]').forEach(b=>b.onclick=async()=>{
    const c=list.find(x=>x.id===b.dataset.exportqr);
    if(!c){toast('العقد غير موجود','err');return;}
    b.disabled=true;const old=b.textContent;b.textContent='جارٍ التحضير...';
    try{ await buildContractDoc(c.baseline_id,c); }
    catch(e){ toast('تعذّر التصدير: '+e.message,'err'); }
    b.disabled=false;b.textContent=old;
  });
  document.querySelectorAll('[data-signalamaa]').forEach(b=>b.onclick=()=>{
    const cid=b.dataset.signalamaa;
    const area=document.getElementById('ctSignArea');
    area.innerHTML='<div class="sa-section"><h4>توقيع علامة</h4><input id="ctStaffName" placeholder="اسمك الكامل" style="width:100%;margin-bottom:10px;border:1.5px solid var(--line);border-radius:8px;padding:9px"><div id="ctStaffPad"></div><button class="hbtn" id="ctStaffSign" style="background:var(--ok);border-color:var(--ok);color:#fff;width:100%;margin-top:12px">توقيع وتأكيد</button></div>';
    const sig=mountSignaturePad(document.getElementById('ctStaffPad'));
    document.getElementById('ctStaffSign').onclick=async()=>{
      const name=document.getElementById('ctStaffName').value.trim();
      if(!name){toast('أدخل اسمك','warn');return;}
      const s=sig.getData();if(!s.ok){toast('وقّع أولًا','warn');return;}
      try{
        const r=await signContractAsStaff(cid,name,s.data||('نصي: '+s.typed));
        if(r&&r.ok){toast('تم التوقيع','ok');await refreshContractPanel();}
        else toast(r&&r.error==='already_signed'?'تم التوقيع مسبقًا':'تعذّر التوقيع','err');
      }catch(e){toast('تعذّر التوقيع: '+e.message,'err');}
    };
  });
}

window.openContractPanel=openContractPanel;
