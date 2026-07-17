// ===== خط التسليمات (وحدة كسولة) — أداة داخلية للطاقم =====
// يعتمد على العام: sb, PROJECT, USER, dialog, confirmDialog, toast, esc, fmt, D,
//                  DELIV_SRC, DELIV_KIND, DELIV_STATUS, fetch/add/update/deleteDelivery

const _TLMN=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
let _TL_SRCFILTER=new Set();      // فلتر المصادر (فارغ = الكل)
let _TL_CTX=null;                 // سياق العرض الحالي (لإعادة الرسم)

function _tlToday(){const d=new Date();d.setHours(0,0,0,0);return d;}
function _tlLate(r,today){return r.status==='awaiting'&&r.expected_reply&&today>new Date(r.expected_reply+'T00:00:00');}
function _tlLateDays(r,today){
  if(!_tlLate(r,today))return 0;
  // أيام عمل بين المتوقّع واليوم (جمعة/سبت عطلة) — اتساقًا مع بقية المنصة
  return (typeof wdBetween==='function')?Math.max(1,wdBetween(new Date(r.expected_reply+'T00:00:00'),today)-1)
    :Math.max(1,Math.round((today-new Date(r.expected_reply+'T00:00:00'))/86400000));
}

// ===== نقطة الدخول: مشروع واحد =====
async function timelineRender(hostId,projectId){
  const host=document.getElementById(hostId);if(!host)return;
  let rows;try{rows=await fetchDeliveries(projectId);}catch(e){host.innerHTML='<p class="pempty">تعذّر تحميل خط التسليمات</p>';return;}
  _TL_CTX={mode:'project',projectId,hostId,rows,projMap:null};
  _tlPaint();
}
// ===== نقطة الدخول: كل المشاريع (المحفظة) =====
async function timelinePortfolio(hostId){
  const host=document.getElementById(hostId);if(!host)return;
  let rows,projMap={};
  try{
    rows=await fetchAllDeliveries();
    const {data:pj}=await sb.from('pmo_projects').select('id,name');
    (pj||[]).forEach(p=>projMap[p.id]=p.name);
  }catch(e){host.innerHTML='<p class="pempty">تعذّر التحميل</p>';return;}
  _TL_CTX={mode:'portfolio',hostId,rows,projMap};
  _tlPaint();
}

function _tlPaint(){
  const ctx=_TL_CTX;if(!ctx)return;
  const host=document.getElementById(ctx.hostId);if(!host)return;
  host.innerHTML=_tlHtml(ctx);
  _tlBind(host,ctx);
}

function _tlHtml(ctx){
  const rows=ctx.rows||[],today=_tlToday();
  const isProject=ctx.mode==='project';
  const intro=`<div class="hintbar">📦 <b>خط التسليمات:</b> سجل داخلي زمني للتبادل — ما أرسلناه وما ننتظره من العميل أو الأقسام. ${isProject?'':'(كل المشاريع — نظرة شاملة للمكتب)'} أداة داخلية لا تظهر للعميل.</div>`;

  // شريط الأدوات: فلتر المصادر + إضافة (في وضع المشروع فقط)
  const srcChips=Object.keys(DELIV_SRC).map(k=>{
    const on=_TL_SRCFILTER.has(k);
    return `<button class="tfchip tl-srcf ${on?'':''}" data-tlsrc="${k}" aria-pressed="${on}" style="--tc:${DELIV_SRC[k].c}">${esc(DELIV_SRC[k].t)}</button>`;
  }).join('');
  const addBtn=isProject?`<button class="hbtn" id="tlAdd" style="background:var(--gold);border-color:var(--gold);margin-inline-start:auto">+ إضافة حدث</button>`:'';
  const toolbar=`<div class="tl-toolbar"><span class="tfacet-lbl">المصدر:</span>${srcChips}${addBtn}</div>`;

  // تطبيق الفلتر
  let shown=rows;
  if(_TL_SRCFILTER.size)shown=rows.filter(r=>_TL_SRCFILTER.has(r.source));

  if(!shown.length){
    return intro+toolbar+`<div class="empty-cta"><div class="ico">📦</div><h3>لا أحداث بعد</h3><p>${isProject?'أضف أول حدث تسليم أو رد لبناء خط زمني واضح.':'لا تسليمات مسجّلة في أي مشروع بعد.'}</p></div>`;
  }

  // ===== الخط الأفقي ثنائي المسار =====
  const dates=[];shown.forEach(r=>{dates.push(new Date(r.event_date+'T00:00:00'));if(r.expected_reply)dates.push(new Date(r.expected_reply+'T00:00:00'));});
  dates.push(today);
  const oneDay=86400000;
  let minD=new Date(Math.min.apply(null,dates)),maxD=new Date(Math.max.apply(null,dates));
  minD=new Date(minD.getTime()-7*oneDay);maxD=new Date(maxD.getTime()+7*oneDay);
  const days=Math.max(1,Math.round((maxD-minD)/oneDay));
  const PXD=Math.max(7,Math.min(30,Math.floor(1100/days)));
  const W=days*PXD;
  const off=d=>Math.round((new Date(d)-minD)/oneDay);

  // رؤوس الأشهر + خط اليوم
  let months='';let d=new Date(minD.getFullYear(),minD.getMonth(),1);
  while(d<=maxD){const nx=new Date(d.getFullYear(),d.getMonth()+1,1);const se=nx>maxD?maxD:new Date(nx-oneDay);const w=Math.round((se-(d<minD?minD:d))/oneDay)+1;months+=`<div class="tl-mhd" style="right:${off(d<minD?minD:d)*PXD}px;width:${w*PXD}px">${_TLMN[d.getMonth()]} ${d.getFullYear()}</div>`;d=nx;}
  const todayLine=`<div class="tl-today" style="right:${off(today)*PXD}px"><span>اليوم</span></div>`;

  // تعبئة المسارين مع تجنّب التداخل (رصّ مستويات)
  const CARDW=158;
  function lay(list){
    const s=list.slice().sort((a,b)=>new Date(a.event_date)-new Date(b.event_date));
    const ends=[];let out='',maxLvl=0;
    s.forEach(r=>{
      const x=off(r.event_date)*PXD;
      let lvl=0;while(lvl<ends.length&&Math.abs(ends[lvl]-x)<CARDW)lvl++;
      ends[lvl]=x;if(lvl>maxLvl)maxLvl=lvl;
      const src=DELIV_SRC[r.source]||{t:r.source,c:'#888'},kind=DELIV_KIND[r.kind]||{t:r.kind,i:'•'};
      const late=_tlLate(r,today),ld=_tlLateDays(r,today);
      const pj=ctx.mode==='portfolio'?`<span class="tl-proj">${esc((ctx.projMap&&ctx.projMap[r.project_id])||'')}</span>`:'';
      const exp=r.expected_reply?`<span class="tl-exp ${late?'late':''}">${late?('متأخر +'+ld+'ي'):('متوقّع '+fmt(new Date(r.expected_reply+'T00:00:00')))}</span>`:'';
      out+=`<div class="tl-ev" style="right:${x}px;--lvl:${lvl};--c:${src.c}">
        <span class="tl-dot"></span>
        <span class="tl-stem"></span>
        <div class="tl-card ${late?'late':''}" data-ev="${r.id}" role="button" tabindex="0" aria-label="${esc(r.title)} — ${esc(src.t)}، ${esc(kind.t)}، ${DELIV_STATUS[r.status]||r.status}" title="${esc(r.title)} — ${esc(src.t)} · ${esc(kind.t)} · ${DELIV_STATUS[r.status]||r.status}">
          <div class="tl-card-top"><span class="tl-kind">${kind.i}</span><b>${esc(r.title)}</b></div>
          <div class="tl-card-meta"><span class="tl-src" style="background:${src.c}">${esc(src.t)}</span><span class="tl-date">${fmt(new Date(r.event_date+'T00:00:00'))}</span></div>
          ${pj}${exp?('<div>'+exp+'</div>'):''}
        </div>
      </div>`;
    });
    return {out,levels:maxLvl+1};
  }
  const internal=lay(shown.filter(r=>r.source!=='client'));
  const client=lay(shown.filter(r=>r.source==='client'));
  const topH=Math.max(1,internal.levels)*72+24, botH=Math.max(1,client.levels)*72+24;

  const band=`<div class="tl-scroll"><div class="tl-band" style="width:${W}px;--toph:${topH}px;--both:${botH}px">
    <div class="tl-head" style="width:${W}px">${months}</div>
    <div class="tl-top" style="height:${topH}px">${internal.out}</div>
    <div class="tl-axis"><span class="tl-axis-lbl up">▲ منّا (الفريق/الأقسام)</span><span class="tl-axis-lbl dn">▼ من العميل</span>${todayLine}</div>
    <div class="tl-bot" style="height:${botH}px">${client.out}</div>
  </div></div>`;

  // ===== قائمة تفصيلية (المرجع الموثوق + الأفعال) =====
  const listRows=shown.slice().sort((a,b)=>new Date(b.event_date)-new Date(a.event_date)).map(r=>{
    const src=DELIV_SRC[r.source]||{t:r.source,c:'#888'},kind=DELIV_KIND[r.kind]||{t:r.kind,i:'•'};
    const late=_tlLate(r,today),ld=_tlLateDays(r,today);
    const pj=ctx.mode==='portfolio'?`<td>${esc((ctx.projMap&&ctx.projMap[r.project_id])||'')}</td>`:'';
    const ref=r.file_ref?(/^https?:\/\//.test(r.file_ref)?`<a href="${esc(r.file_ref)}" target="_blank" rel="noopener">فتح ↗</a>`:esc(r.file_ref)):'—';
    return `<tr data-ev="${r.id}">
      <td>${fmt(new Date(r.event_date+'T00:00:00'))}</td>
      ${pj}
      <td><span class="tl-src" style="background:${src.c}">${esc(src.t)}</span></td>
      <td>${kind.i} ${esc(kind.t)}</td>
      <td><b>${esc(r.title)}</b>${r.description?`<div class="tl-desc">${esc(r.description)}</div>`:''}</td>
      <td><span class="ministat s-${r.status==='approved'?'done':(r.status==='awaiting'?(late?'blocked':'inprogress'):'notstarted')}">${DELIV_STATUS[r.status]||r.status}</span>${late?`<span class="tl-latebadge">+${ld}ي</span>`:''}</td>
      <td>${ref}</td>
      <td class="tl-acts">
        <button class="ib" data-tledit="${r.id}" aria-label="تعديل">✎</button>
        <button class="ib" data-tldel="${r.id}" aria-label="حذف" style="color:var(--crit)">🗑</button>
      </td>
    </tr>`;
  }).join('');
  const listHead=ctx.mode==='portfolio'
    ? '<tr><th>التاريخ</th><th>المشروع</th><th>المصدر</th><th>النوع</th><th>العنوان</th><th>الحالة</th><th>المرجع</th><th></th></tr>'
    : '<tr><th>التاريخ</th><th>المصدر</th><th>النوع</th><th>العنوان</th><th>الحالة</th><th>المرجع</th><th></th></tr>';
  const list=`<div class="tl-listwrap"><table class="tl-list"><thead>${listHead}</thead><tbody>${listRows}</tbody></table></div>`;

  return intro+toolbar+band+list;
}

// ===== الربط =====
function _tlBind(host,ctx){
  const add=host.querySelector('#tlAdd');
  if(add)add.onclick=()=>_tlDialog(ctx.projectId,null);
  host.querySelectorAll('[data-tlsrc]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.tlsrc;_TL_SRCFILTER.has(k)?_TL_SRCFILTER.delete(k):_TL_SRCFILTER.add(k);_tlPaint();});
  const editById=id=>{const r=(ctx.rows||[]).find(x=>x.id===id);if(r)_tlDialog(r.project_id,r);};
  host.querySelectorAll('[data-tledit]').forEach(b=>b.onclick=()=>editById(b.dataset.tledit));
  host.querySelectorAll('.tl-card[data-ev]').forEach(c=>{
    const open=()=>editById(c.dataset.ev);
    c.onclick=open;
    c.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  });
  host.querySelectorAll('[data-tldel]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف الحدث','حذف هذا الحدث من خط التسليمات؟',true))return;
    try{await deleteDelivery(b.dataset.tldel);toast('حُذف الحدث','ok');await _tlReload();}
    catch(e){toast('تعذّر الحذف','err');}});
}

async function _tlReload(){
  const ctx=_TL_CTX;if(!ctx)return;
  if(ctx.mode==='project')ctx.rows=await fetchDeliveries(ctx.projectId);
  else ctx.rows=await fetchAllDeliveries();
  _tlPaint();
}

// ===== حوار إضافة/تعديل حدث =====
async function _tlDialog(projectId,existing){
  const isEdit=!!existing;
  const srcOpts=Object.keys(DELIV_SRC).map(k=>({v:k,t:DELIV_SRC[k].t}));
  const kindOpts=Object.keys(DELIV_KIND).map(k=>({v:k,t:DELIV_KIND[k].t}));
  const stOpts=Object.keys(DELIV_STATUS).map(k=>({v:k,t:DELIV_STATUS[k]}));
  const r=await dialog({
    title:isEdit?'تعديل حدث':'حدث جديد في خط التسليمات',
    message:'وثّق التسليم أو الرد بتاريخه ومصدره. «تاريخ الرد المتوقّع» يُحسب منه التأخير تلقائيًا.',
    fields:[
      {key:'event_date',label:'التاريخ',type:'date',value:(existing&&existing.event_date)||todayISO()},
      {key:'source',label:'المصدر',type:'select',value:(existing&&existing.source)||'pmo',options:srcOpts},
      {key:'kind',label:'النوع',type:'select',value:(existing&&existing.kind)||'file',options:kindOpts},
      {key:'title',label:'العنوان',value:(existing&&existing.title)||'',placeholder:'مثل: تسليم الهوية البصرية — النسخة 2'},
      {key:'description',label:'وصف (اختياري)',value:(existing&&existing.description)||''},
      {key:'status',label:'الحالة',type:'select',value:(existing&&existing.status)||'sent',options:stOpts},
      {key:'file_ref',label:'رابط/مرجع الملف (اختياري)',value:(existing&&existing.file_ref)||'',placeholder:'رابط درايف أو مرجع'},
      {key:'expected_reply',label:'تاريخ الرد المتوقّع (اختياري)',type:'date',value:(existing&&existing.expected_reply)||''}
    ],
    confirmText:isEdit?'حفظ':'إضافة'
  });
  if(!r||!r.title){if(r&&!r.title)toast('العنوان مطلوب','warn');return;}
  const row={
    project_id:projectId,event_date:r.event_date||todayISO(),source:r.source,kind:r.kind,
    title:r.title,description:r.description||null,status:r.status,
    file_ref:r.file_ref||null,expected_reply:r.expected_reply||null
  };
  try{
    if(isEdit)await updateDelivery(existing.id,row);
    else await addDelivery(row);
    toast(isEdit?'حُدّث الحدث':'أُضيف الحدث','ok');
    await _tlReload();
  }catch(e){toast('تعذّر الحفظ: '+e.message,'err');}
}

window.timelineRender=timelineRender;
window.timelinePortfolio=timelinePortfolio;
