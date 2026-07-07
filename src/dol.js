// dol.js — DOL Console: طبقة القرار الحاكمة (مستقلّة فوق المشاريع)
// تُحمّل بعد app.js. تستخدم: $, esc, toast, dialog, CLIENTS, ROLE, و api functions.

const DEC_TYPE={strategic_gate:'بوابة استراتيجية',tactical_gate:'بوابة تكتيكية',operational:'قرار تشغيلي'};
const DEC_TCLR={strategic_gate:'var(--crit)',tactical_gate:'#B07A1E',operational:'var(--blue)'};
const DEC_STATUS={proposed:'مقترح',approved:'معتمد',rejected:'مرفوض',executed:'منفّذ'};
const DIM_AR={budget:'الميزانية',time:'الزمن',scope:'النطاق',channel:'القنوات',messaging:'الرسائل'};
const ENF_AR={hard:'صارم',soft:'مرن',advisory:'إرشادي'};
let DOL_DECISIONS=[], DOL_LINKS=[];

async function openDOL(){
  SCREEN='dol';
  $('#hProject').innerHTML='<span class="ctx-dot" style="background:var(--crit)"></span>طبقة تشغيل القرار — DOL Console';
  $('#barClient').style.display='none';hideChrome();
  $('#backPortfolio').style.display='';
  $('#host').innerHTML='<div id="dolWrap"><div class="skeleton" style="height:60px;margin-bottom:8px"></div><div class="skeleton" style="height:120px"></div></div>';
  await loadDOL();
  renderDOL();
}
async function loadDOL(){
  DOL_DECISIONS=await fetchDecisions();
  DOL_LINKS=await fetchDecisionProjects();
}
function projName(pid){const dp=DOL_LINKS.filter(l=>l.decision_id===pid);if(!dp.length)return'';const names=dp.map(l=>{const c=CLIENTS.find(x=>{return false;});return l.project_id;});return dp.length+' مشروع';}

function renderDOL(){
  const gates=DOL_DECISIONS.filter(d=>d.decision_type!=='operational');
  const ops=DOL_DECISIONS.filter(d=>d.decision_type==='operational');
  const opsByGate={};ops.forEach(o=>{(opsByGate[o.parent_gate_id]=opsByGate[o.parent_gate_id]||[]).push(o);});

  const toolbar=`<div class="lockbar" style="border-inline-start-color:var(--crit)">
    <span>الحوكمة:</span>
    ${ROLE==='pmo'?'<button class="reqbtn" id="dolAddGate" style="background:var(--crit);border-color:var(--crit);color:#fff">+ بوابة قرار</button>':''}
    <span style="color:var(--muted);font-weight:400;font-size:.78rem">البوابات تضع الحدود · القرارات التشغيلية تعمل داخلها · الانحراف يُقيَّم آليًا.</span>
  </div>`;

  let body='';
  if(!gates.length){
    body='<div class="empty-cta"><div class="ico">'+I.scale+'</div><h3>لا قرارات بعد</h3><p>ابدأ بإنشاء بوابة قرار (استراتيجية أو تكتيكية) تضع الحدود التي تعمل القرارات التشغيلية داخلها.</p></div>';
  }else{
    body=gates.map(g=>{
      const b=g.boundaries||{};
      const bChips=['budget','time','scope','channel','messaging'].filter(k=>b[k]).map(k=>{
        const dim=b[k];const val=dim.max!=null?dim.max:(dim.max_days!=null?dim.max_days+'ي':'');
        return `<span class="dim-chip"><b>${DIM_AR[k]}</b> ${val} <i>${ENF_AR[dim.enforcement]||''}</i></span>`;
      }).join('');
      const children=(opsByGate[g.id]||[]).map(o=>opCard(o)).join('')||'<div class="dol-empty-ops">لا قرارات تشغيلية تحت هذه البوابة بعد.</div>';
      return `<div class="gate-card" style="--gc:${DEC_TCLR[g.decision_type]}">
        <div class="gate-hd">
          <div><span class="dec-type" style="background:${DEC_TCLR[g.decision_type]}">${DEC_TYPE[g.decision_type]}</span>
            <b class="gate-title">${esc(g.title)}</b>
            <span class="crstate ${g.status==='approved'?'approved':g.status==='rejected'?'rejected':'pending'}">${DEC_STATUS[g.status]}</span></div>
          <div class="gate-acts">
            ${ROLE==='pmo'?`<button class="reqbtn" data-addop="${g.id}">+ قرار تشغيلي</button>`:''}
            <button class="reqbtn" data-trace="${g.id}" title="التتبّع" aria-label="التتبع العكسي">${I.link}</button>
            ${ROLE==='pmo'?`<button class="ib" data-deldec="${g.id}" style="color:var(--crit)">${I.trash}</button>`:''}
          </div>
        </div>
        ${g.rationale?`<div class="gate-rationale">${esc(g.rationale)}</div>`:''}
        ${bChips?`<div class="gate-bounds">${bChips}</div>`:'<div class="gate-bounds"><span style="color:var(--muted);font-size:.76rem">بلا حدود منظّمة</span></div>'}
        ${b.text?`<div class="gate-btext">${esc(b.text)}</div>`:''}
        <div class="gate-ops">${children}</div>
      </div>`;
    }).join('');
  }
  $('#dolWrap').innerHTML=toolbar+body;
  bindDOL(opsByGate);
}
function opCard(o){
  const dev=o._devVerdict;
  let badge='';
  if(dev==='block')badge='<span class="dev-badge breach">خرق — محجوب</span>';
  else if(dev==='warning')badge='<span class="dev-badge warning">تحذير</span>';
  else if(dev==='allow')badge='<span class="dev-badge ok">داخل الحدود</span>';
  return `<div class="op-card">
    <span class="dec-type" style="background:${DEC_TCLR.operational};font-size:.66rem">تشغيلي</span>
    <b>${esc(o.title)}</b>
    <span class="crstate ${o.status==='approved'?'approved':o.status==='executed'?'approved':'pending'}" style="font-size:.66rem">${DEC_STATUS[o.status]}</span>
    ${badge}
    ${ROLE==='pmo'?`<button class="ib" data-deldec="${o.id}" style="color:var(--crit);margin-inline-start:auto">${I.trash}</button>`:''}
  </div>`;
}

function bindDOL(opsByGate){
  const ag=$('#dolAddGate');if(ag)ag.onclick=addGate;
  document.querySelectorAll('[data-addop]').forEach(b=>b.onclick=()=>addOperational(b.dataset.addop));
  document.querySelectorAll('[data-deldec]').forEach(b=>b.onclick=()=>delDecision(b.dataset.deldec));
  document.querySelectorAll('[data-trace]').forEach(b=>b.onclick=()=>openTrace(b.dataset.trace));
}

async function addGate(){
  const r=await dialog({title:'بوابة قرار جديدة',
    fields:[
      {key:'type',label:'النوع',type:'select',value:'tactical_gate',options:[{v:'strategic_gate',t:'بوابة استراتيجية'},{v:'tactical_gate',t:'بوابة تكتيكية'}]},
      {key:'title',label:'عنوان البوابة',placeholder:'مثل: اعتماد خطة الربع الأول'},
      {key:'rationale',label:'الأساس الاستراتيجي',type:'textarea',placeholder:'لماذا هذه البوابة وما الذي تحكمه'},
      {key:'budget_max',label:'سقف الميزانية (ر.س) — اختياري',type:'number',placeholder:'80000'},
      {key:'time_days',label:'سقف الزمن (أيام) — اختياري',type:'number',placeholder:'30'},
      {key:'scope_max',label:'سقف النطاق (وحدات) — اختياري',type:'number',placeholder:'5'},
      {key:'btext',label:'تفسير الحدود (نصّي)',type:'textarea',placeholder:'روح الحدود وما لا تلتقطه الأرقام'}
    ],confirmText:'إنشاء البوابة'});
  if(!r||!r.title)return;
  // بناء الحدود المنظّمة بأوضاع الفرض الافتراضية والتحمّل المتغيّر
  const b={};
  if(r.budget_max)b.budget={max:parseFloat(r.budget_max),tolerance:0.05,enforcement:'hard'};
  if(r.time_days)b.time={max_days:parseFloat(r.time_days),tolerance:0.20,enforcement:'soft'};
  if(r.scope_max)b.scope={max:parseFloat(r.scope_max),tolerance:0.05,enforcement:'hard'};
  if(r.btext)b.text=r.btext;
  try{
    await insertDecision({decision_type:r.type,title:r.title,rationale:r.rationale||null,
      boundaries:Object.keys(b).length?b:null,status:'approved',
      decided_by:USER.id,decided_role:ROLE,decided_at:new Date().toISOString(),
      is_critical:r.type==='strategic_gate'});
    toast('أُنشئت البوابة','ok');await loadDOL();renderDOL();
  }catch(e){toast('تعذّر الإنشاء: '+e.message,'err');}
}

async function addOperational(gateId){
  const gate=DOL_DECISIONS.find(d=>d.id===gateId);
  const r=await dialog({title:'قرار تشغيلي تحت: '+(gate?gate.title:''),
    message:'سيُقيّم آليًا ضد حدود البوابة. الخرق الصارم (الميزانية/النطاق) يُحجب ويتطلب تصعيدًا.',
    fields:[
      {key:'title',label:'عنوان القرار',placeholder:'مثل: حملة فرع الرياض'},
      {key:'budget',label:'الميزانية المطلوبة (ر.س)',type:'number',placeholder:'إن وُجد حد'},
      {key:'time_days',label:'الزمن المطلوب (أيام)',type:'number'},
      {key:'scope_count',label:'عدد الوحدات (نطاق)',type:'number'},
      {key:'rationale',label:'المبرّر',type:'textarea'}
    ],confirmText:'تقييم وإنشاء'});
  if(!r||!r.title)return;
  // تقييم الانحراف أولًا
  const vals={};if(r.budget)vals.budget=parseFloat(r.budget);if(r.time_days)vals.time_days=parseFloat(r.time_days);if(r.scope_count)vals.scope_count=parseFloat(r.scope_count);
  let verdict='allow',evalRes=null;
  try{ const {data}=await evaluateDecision(gateId,vals); evalRes=data; verdict=data?data.verdict:'allow'; }catch(e){}
  // إن كان خرقًا صارمًا → حجب + عرض تصعيد
  if(verdict==='block'){
    const esc2=await confirmDialog('خرق حدّ صارم','هذا القرار يتجاوز حدًّا صارمًا للبوابة (الميزانية/النطاق) فلا يمكن اعتماده مباشرة.\n\nهل تريد تسجيله كـ«مقترح» يتطلب تصعيدًا (طلب توسيع الحد)؟',false);
    if(!esc2)return;
    try{
      const {data:dec}=await insertDecision({decision_type:'operational',parent_gate_id:gateId,title:r.title,
        rationale:r.rationale||null,status:'proposed',decided_by:USER.id,decided_role:ROLE,
        boundaries:{requested:vals}});
      // تسجيل الانحراف
      if(evalRes&&evalRes.dimensions){for(const dm of evalRes.dimensions){if(dm.zone==='breach'){
        await insertDeviation({decision_id:dec.id,gate_id:gateId,deviation_type:'breach',dimension:dm.dimension,
          expected:JSON.stringify(dm.expected),actual:JSON.stringify(dm.actual),resolution:'escalated'});}}}
      toast('سُجّل القرار كمقترح يتطلب تصعيدًا','warn');await loadDOL();renderDOL();
    }catch(e){toast('تعذّر: '+e.message,'err');}
    return;
  }
  // داخل الحدود أو تحذير → اعتماد، مع تسجيل التحذيرات
  try{
    const {data:dec}=await insertDecision({decision_type:'operational',parent_gate_id:gateId,title:r.title,
      rationale:r.rationale||null,status:'approved',decided_by:USER.id,decided_role:ROLE,
      decided_at:new Date().toISOString(),boundaries:{requested:vals}});
    if(evalRes&&evalRes.dimensions){for(const dm of evalRes.dimensions){if(dm.zone==='warning'){
      await insertDeviation({decision_id:dec.id,gate_id:gateId,deviation_type:'warning',dimension:dm.dimension,
        expected:JSON.stringify(dm.expected),actual:JSON.stringify(dm.actual),resolution:'within_tolerance'});}}}
    toast(verdict==='allow'?'اعتُمد القرار (داخل الحدود)':'اعتُمد مع تسجيل تحذير','ok');
    await loadDOL();renderDOL();
  }catch(e){toast('تعذّر: '+e.message,'err');}
}

async function delDecision(id){
  const d=DOL_DECISIONS.find(x=>x.id===id);if(!d)return;
  const isGate=d.decision_type!=='operational';
  const kids=isGate?DOL_DECISIONS.filter(x=>x.parent_gate_id===id).length:0;
  let msg='حذف «'+d.title+'»؟';
  if(kids)msg+='\n\nتنبيه: ستُحذف معها '+kids+' قرار تشغيلي تابع.';
  if(!await confirmDialog('تأكيد الحذف',msg,true))return;
  try{await deleteDecision(id);toast('حُذف','ok');await loadDOL();renderDOL();}
  catch(e){toast('تعذّر الحذف: '+e.message,'err');}
}

async function openTrace(decId){
  const d=DOL_DECISIONS.find(x=>x.id===decId);if(!d)return;
  const links=await fetchDecisionLinks(decId);
  const KIND={insight:'رؤية',diagnosis:'تشخيص',raw_source:'مصدر خام'};
  const chain=links.length?links.map(l=>`<div class="trace-node"><b>${KIND[l.link_kind]}</b>: ${esc(l.ref_label||'')}${l.ref_detail?'<br><small>'+esc(l.ref_detail)+'</small>':''}</div>`).join('<div class="trace-arrow">↓</div>'):'<p class="empty">لا روابط تتبّع بعد.</p>';
  await dialog({title:'التتبّع العكسي: '+d.title,
    message:'سلسلة المعنى: القرار ← الرؤية ← التشخيص'+(d.is_critical?' ← المصدر الخام (بوابة حرجة)':''),
    fields:[
      {key:'kind',label:'إضافة رابط — النوع',type:'select',value:'insight',options:[{v:'insight',t:'رؤية'},{v:'diagnosis',t:'تشخيص'},{v:'raw_source',t:'مصدر خام'}]},
      {key:'label',label:'الوصف',placeholder:'مثل: رؤية فجوة التسعير من B2'}
    ],confirmText:'إضافة رابط'}).then(async r=>{
      if(r&&r.label){try{await insertDecisionLink({decision_id:decId,link_kind:r.kind,ref_label:r.label});toast('أُضيف رابط التتبّع','ok');}catch(e){toast('تعذّر','err');}}
    });
}
