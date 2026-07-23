// ===== app/exportcontract.js — تصدير الخطة المعتمدة كمستند احترافي =====
// المبدأ الحاكم: المستند يُبنى من لقطة (Baseline) محدَّدة — لا من الجدول الحيّ المتغيّر —
// فيبقى صالحًا كمرجع ثابت عند أي مراجعة أو خلاف لاحق، بصرف النظر عن أي تعديل يطرأ على
// الخطة بعد تاريخ الاعتماد. التواريخ والمدد من اللقطة نفسها؛ الأسماء والهرمية من الخطة
// الحالية (أي إعادة تسمية لاحقة تمرّ عبر طلب تعديل موثَّق في سجل المشروع أصلًا).

async function openContractExport(){
  if(!PROJECT||!PROJECT.baselines||!PROJECT.baselines.length){
    toast('لا توجد لقطة (Baseline) بعد لهذا المشروع — ثبّت أساسًا أولًا','warn');return;
  }
  const opts=PROJECT.baselines.slice().reverse().map(b=>
    `<option value="${b.id}">${esc(b.label)} — ${new Date(b.approved_at).toLocaleDateString('ar')}</option>`).join('');
  const r=await dialog({title:'تصدير للعقد',
    fields:[{key:'bl',label:'اللقطة (Baseline) المُصدَّرة',type:'select',value:PROJECT.baselines[PROJECT.baselines.length-1].id,
      options:PROJECT.baselines.slice().reverse().map(b=>({v:b.id,t:b.label+' — '+new Date(b.approved_at).toLocaleDateString('ar')}))}],
    confirmText:'تصدير'});
  if(!r)return;
  buildContractDoc(r.bl);
}

function buildContractDoc(baselineId){
  const bl=(PROJECT.baselines||[]).find(b=>b.id===baselineId);
  if(!bl){toast('لقطة غير موجودة','err');return;}
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
  const clientName=(CLIENTS.find(c=>c.id===CID)||{}).name||'';

  const phasePages=phases.filter(p=>(byPhase[p.key]||[]).length).map(p=>{
    const rows=byPhase[p.key].map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${TYPES[x.type]||x.type}</td>
      <td>${x.type==='milestone'?'—':x.duration+' يوم'}</td><td>${x.ES}</td><td>${x.EF}</td></tr>`).join('');
    return `<section class="cx-page">
      <div class="cx-phase-hd" style="--pc:${p.color}"><span></span>${esc(p.name)}</div>
      <table class="cx-table"><thead><tr><th>المعرّف</th><th>الاسم</th><th>النوع</th><th>المدة</th><th>البداية</th><th>النهاية</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </section>`;
  }).join('');

  const doc=document.getElementById('contractPrint');
  doc.innerHTML=`
    <section class="cx-cover">
      <div class="cx-cover-brand">علامة <span>· أثر دائم</span></div>
      <h1>الخطة المعتمدة</h1>
      <div class="cx-cover-meta">
        <div><b>العميل</b><span>${esc(clientName)}</span></div>
        <div><b>المشروع</b><span>${esc(PROJECT.name)}</span></div>
        <div><b>اللقطة المرجعية</b><span>${esc(bl.label)}</span></div>
        <div><b>تاريخ الاعتماد</b><span>${blDate}</span></div>
      </div>
      <p class="cx-cover-note">هذا المستند لقطة ثابتة من الخطة بتاريخ اعتمادها أعلاه — لا يعكس أي تعديل لاحق.
        أُصدر آليًا من منصة حوكمة المشاريع بتاريخ ${today}.</p>
    </section>
    ${phasePages}
    <div class="cx-footer">علامة · أثر دائم — مستند مُولَّد آليًا من منصة حوكمة المشاريع · ${esc(bl.label)}</div>
  `;
  document.body.classList.add('printing-contract');
  setTimeout(()=>{
    window.print();
    const restore=()=>{document.body.classList.remove('printing-contract');window.removeEventListener('afterprint',restore);};
    window.addEventListener('afterprint',restore);
  },80);
}

window.openContractExport=openContractExport;
