// ===== app/workload.js — حِمل العمل عبر المحفظة =====
// يجيب على سؤال يومي حقيقي: هل الفريق محمَّل فوق طاقته في يوم بعينه؟
// المبدأ الحاكم: الجدولة تُحسب هنا بنفس scheduleTasks المستخدَمة في الجانت تمامًا — لا
// بحساب مستقل — فلا تتناقض الأرقام مع ما يراه المستخدم في أي شاشة أخرى.

let WL_DATA=null, WL_WEEKS=8, WL_CAP=(()=>{
  try{return Number(localStorage.getItem('pmo_wl_cap'))||5;}catch(e){return 5;}
})();

function wlDayKey(d){return d.toISOString().slice(0,10);}

// يبني تقويمًا: لكل يوم، البنود النشطة فيه من كل المشاريع
function wlBuildCalendar(projects){
  const cal={};           // 'YYYY-MM-DD' -> [{project,color,task,roleId,...}]
  (projects||[]).forEach(p=>{
    const tasks=(p.tasks||[]).map(t=>({
      id:t.id,name:t.name,type:t.type,duration:t.duration,lag:t.lag,
      fixed:t.fixed,track:t.track,status:t.status,progress:t.progress,
      role_id:t.role_id||null,
      deps:Array.isArray(t.deps)?t.deps:[]
    }));
    if(!tasks.length||!p.start_date)return;
    let S;
    try{ S=scheduleTasks(tasks,p.start_date); }catch(e){ return; }
    tasks.forEach(t=>{
      // الحزم تجميعية والبنود المستمرة بلا نافذة تنفيذ محدَّدة — تُستثنى من عدّ الحمل
      if(t.type==='package'||t.type==='cont')return;
      if(t.status==='done')return;
      const r=S.R[t.id]; if(!r||!r.ES||!r.EF)return;
      const from=new Date(r.ES), to=new Date(r.EF);
      for(let d=new Date(from); d<=to; d.setDate(d.getDate()+1)){
        if(!isWorkday(d))continue;           // عطلات الأسبوع والرسمية لا تُحمَّل
        const k=wlDayKey(d);
        (cal[k]=cal[k]||[]).push({
          project:p.project_name,client:p.client_name,color:p.color||'#C8A06B',
          task:t.id,name:t.name,critical:!!(r.critical),status:t.status,
          roleId:t.role_id||null
        });
      }
    });
  });
  return cal;
}


// ===== ضغط المسمّيات =====
// يحسب لكل مسمّى في كل يوم: كم بندًا نشطًا عليه مقابل طاقته (عدد الشاغلين × حمل الفرد).
// هذا ما يحوّل السؤال من «من مشغول؟» إلى «أي مسمّى يحتاج توظيفًا؟».
function wlRolePressure(cal,roles){
  const byRole={};   // roleId -> {days:{k:count}, peak, overDays, capacity, ...}
  (roles||[]).forEach(r=>{byRole[r.id]={role:r,days:{},peak:0,overDays:0,worstDay:null,worstN:0};});
  const unassigned={days:{},count:0};
  Object.entries(cal).forEach(([k,items])=>{
    const per={};
    items.forEach(x=>{
      if(!x.roleId){unassigned.days[k]=(unassigned.days[k]||0)+1;unassigned.count++;return;}
      per[x.roleId]=(per[x.roleId]||0)+1;
    });
    Object.entries(per).forEach(([rid,n])=>{
      const b=byRole[rid]; if(!b)return;
      b.days[k]=n;
      if(n>b.peak){b.peak=n;}
      if(n>b.worstN){b.worstN=n;b.worstDay=k;}
      if(n>(b.role.capacity||0))b.overDays++;
    });
  });
  // الموارد المقترحة: نحتاج ceil(الذروة / حمل الفرد) شاغلًا لتغطية أسوأ يوم
  Object.values(byRole).forEach(b=>{
    const lpp=b.role.load_per_person||2;
    b.neededHeadcount=Math.ceil(b.peak/lpp);
    b.gap=Math.max(0,b.neededHeadcount-(b.role.headcount||0));
    b.util=b.role.capacity?Math.round(100*b.peak/b.role.capacity):0;
  });
  return {byRole,unassigned};
}

function wlTone(n){
  if(n===0)return 'z0';
  if(n<=Math.ceil(WL_CAP*0.5))return 'z1';
  if(n<=WL_CAP)return 'z2';
  if(n<=WL_CAP+2)return 'z3';
  return 'z4';
}

async function renderWorkload(){
  SCREEN='workload';
  $('#hProject').textContent='حِمل العمل';
  $('#barClient').style.display='none';hideChrome();
  try{history.replaceState(null,'','#/workload');}catch(e){}
  $('#host').innerHTML=`
    <div class="hintbar"><button class="reqbtn" id="wlBack">↩ المحفظة</button>
      <span class="ms-auto">توزيع البنود النشطة على الأيام عبر كل المشاريع — لضبط الحمل قبل أن يقع التعارض.</span></div>
    <div id="wlBody">${skeleton('cards',1)}</div>`;
  $('#wlBack').onclick=renderPortfolio;
  try{ WL_DATA=await fetchPortfolioWorkload(); }
  catch(e){ $('#wlBody').innerHTML='<p class="pempty">تعذّر التحميل: '+esc(e.message)+'</p>'; return; }
  renderWorkloadBody();
}

function renderWorkloadBody(){
  const projects=(WL_DATA&&WL_DATA.projects)||[];
  const roles=(WL_DATA&&WL_DATA.roles)||[];
  const cal=wlBuildCalendar(projects);
  const RP=wlRolePressure(cal,roles);
  const strained=Object.values(RP.byRole).filter(b=>b.gap>0)
    .sort((a,b)=>b.gap-a.gap||b.util-a.util);
  const today=new Date(DATA_DATE||todayISO());
  const start=new Date(today); start.setDate(start.getDate()-start.getDay()); // بداية الأسبوع
  const days=[];
  for(let i=0;i<WL_WEEKS*7;i++){const d=new Date(start);d.setDate(d.getDate()+i);days.push(d);}

  const over=days.filter(d=>isWorkday(d)&&(cal[wlDayKey(d)]||[]).length>WL_CAP);
  const peak=days.reduce((m,d)=>Math.max(m,(cal[wlDayKey(d)]||[]).length),0);

  const weeks=[];
  for(let w=0;w<WL_WEEKS;w++)weeks.push(days.slice(w*7,w*7+7));

  $('#wlBody').innerHTML=`
    <div class="sa-section">
      <div class="chub-stats">
        <div class="chub-stat"><b>${peak}</b><span>أعلى حمل في يوم</span></div>
        <div class="chub-stat"><b style="color:${over.length?'var(--crit)':'var(--ok)'}">${over.length}</b><span>يوم فوق الطاقة</span></div>
        <div class="chub-stat"><b>${projects.length}</b><span>مشروع نشط</span></div>
        <div class="chub-stat"><b style="color:${strained.length?'var(--crit)':'var(--ok)'}">${strained.length}</b><span>مسمّى يحتاج موردًا</span></div>
      </div>
      <div class="chub-filters">
        <label style="font-size:.8rem;align-self:center">الطاقة اليومية (بند/يوم)</label>
        <input id="wlCap" type="number" min="1" max="20" value="${WL_CAP}" style="width:80px">
        <select id="wlWeeks" style="min-width:120px">
          ${[4,8,12,16].map(n=>`<option value="${n}" ${WL_WEEKS===n?'selected':''}>${n} أسابيع</option>`).join('')}
        </select>
        <span class="wl-legend ms-auto">
          <i class="z0"></i><i class="z1"></i><i class="z2"></i><i class="z3"></i><i class="z4"></i>
          <span class="sa-hint">من فارغ إلى فوق الطاقة</span>
        </span>
      </div>
    </div>

    ${strained.length?`<div class="chub-expiry-banner">
      <b>👥 ${strained.length} مسمّى وظيفي فوق طاقته</b>
      <p class="sa-hint" style="margin:2px 0 8px">الطاقة = عدد الشاغلين × الحمل المحتمل للفرد. الفجوة تُحسب من أسوأ يوم في المدى المعروض.</p>
      ${strained.slice(0,6).map(b=>`<div class="chd-att-row">
        <span><b>${esc(b.role.department)} · ${esc(b.role.name)}</b>
          <span class="sa-hint"> · ذروة ${b.peak} بند مقابل طاقة ${b.role.capacity}
            (${b.role.headcount} شاغل × ${b.role.load_per_person})
            ${b.worstDay?' · أسوأ يوم '+new Date(b.worstDay).toLocaleDateString('ar',{day:'numeric',month:'short'}):''}</span></span>
        <span class="wl-gap">يلزم +${b.gap} مورد</span>
      </div>`).join('')}
    </div>`:''}

    ${RP.unassigned.count?`<div class="chub-expiry-banner" style="background:var(--soft-2);border-color:var(--line)">
      <b>◻ ${RP.unassigned.count} بند بلا مسمّى مُسنَد</b>
      <p class="sa-hint">هذه البنود لا تُحتسب في ضغط أي مسمّى — أسنِدها من عمود «المسمّى» في جدول المشروع ليكتمل حساب الطاقة.</p>
    </div>`:''}

    <div class="sa-section">
      <h4>ضغط المسمّيات الوظيفية <span class="sa-hint">الذروة مقابل الطاقة في المدى المعروض</span></h4>
      ${roles.length?`<div class="wl-roles">${Object.values(RP.byRole)
        .sort((a,b)=>b.util-a.util)
        .map(b=>`<div class="wl-role">
          <div class="wl-role-hd">
            <b>${esc(b.role.name)}</b>
            <span class="sa-hint">${esc(b.role.department)}</span>
            <span class="wl-role-util ${b.util>100?'over':(b.util>=75?'high':'ok')}">${b.util}%</span>
          </div>
          <div class="wl-bar"><i style="width:${Math.min(100,b.util)}%"></i>
            ${b.util>100?`<u style="width:${Math.min(60,b.util-100)}%"></u>`:''}</div>
          <div class="sa-hint">ذروة ${b.peak} · طاقة ${b.role.capacity} · ${b.role.headcount} شاغل
            ${b.gap>0?` · <b class="txt-crit">يلزم +${b.gap}</b>`:''}</div>
        </div>`).join('')}</div>`
        :emptyState({icon:'👥',title:'لا مسمّيات وظيفية بعد',
           hint:'عرّف الأقسام ومسمّياتها وعدد شاغليها من أدوات المكتب ← الأقسام والمسمّيات، ثم أسنِد البنود إليها.'})}
    </div>

    ${over.length?`<div class="chub-expiry-banner">
      <b>⚠ ${over.length} يومًا يتجاوز الطاقة (${WL_CAP} بند)</b>
      ${over.slice(0,5).map(d=>{
        const items=cal[wlDayKey(d)]||[];
        const projs=[...new Set(items.map(x=>x.project))];
        return `<div class="chd-att-row">
          <span><b>${d.toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'short'})}</b>
            <span class="sa-hint"> · ${items.length} بند من ${projs.length} مشروع: ${esc(projs.slice(0,3).join('، '))}${projs.length>3?'…':''}</span></span>
          <button class="reqbtn" data-wlday="${wlDayKey(d)}">تفاصيل</button>
        </div>`;}).join('')}
      ${over.length>5?`<p class="sa-hint">و${over.length-5} يومًا آخر…</p>`:''}
    </div>`:''}

    <div class="sa-section">
      <div class="wl-grid">
        <div class="wl-head"></div>
        ${['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'].map(d=>`<div class="wl-head">${d}</div>`).join('')}
        ${weeks.map(wk=>`
          <div class="wl-wk">${wk[0].toLocaleDateString('ar',{day:'numeric',month:'short'})}</div>
          ${wk.map(d=>{
            const k=wlDayKey(d),items=cal[k]||[],n=items.length;
            const off=!isWorkday(d), isToday=k===wlDayKey(today);
            const projs=[...new Set(items.map(x=>x.project))].length;
            return `<div class="wl-cell ${off?'off':wlTone(n)} ${isToday?'today':''}"
              ${n&&!off?`data-wlday="${k}" role="button" tabindex="0"`:''}
              aria-label="${d.toLocaleDateString('ar')} — ${off?'عطلة':n+' بند'}"
              title="${d.toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'long'})}${off?' — عطلة':` — ${n} بند من ${projs} مشروع`}">
              <span class="wl-d">${d.getDate()}</span>
              ${(!off&&n)?`<span class="wl-n">${n}</span>`:''}
            </div>`;}).join('')}
        `).join('')}
      </div>
    </div>
    <div id="wlDetail"></div>`;

  $('#wlCap').onchange=e=>{
    WL_CAP=Math.max(1,Math.min(20,Number(e.target.value)||5));
    try{localStorage.setItem('pmo_wl_cap',WL_CAP);}catch(_e){}
    renderWorkloadBody();
  };
  $('#wlWeeks').onchange=e=>{WL_WEEKS=Number(e.target.value)||8;renderWorkloadBody();};
  $$('[data-wlday]').forEach(b=>b.onclick=()=>wlShowDay(b.dataset.wlday,cal));
}

function wlShowDay(key,cal){
  const items=cal[key]||[];
  const d=new Date(key);
  const byProject={};
  items.forEach(x=>{(byProject[x.project]=byProject[x.project]||[]).push(x);});
  const box=$('#wlDetail');
  box.innerHTML=`
    <div class="sa-section mt-14">
      <h4>${d.toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
        <span class="sa-hint">${items.length} بند نشط من ${Object.keys(byProject).length} مشروع</span></h4>
      ${items.length>WL_CAP?`<div class="ctr-integrity warn">⚠ يتجاوز الطاقة المحدَّدة (${WL_CAP}) بـ${items.length-WL_CAP} بند — راجع التوزيع أو أعد جدولة ما يمكن تأجيله.</div>`:''}
      ${Object.entries(byProject).map(([proj,list])=>`
        <div class="wl-proj">
          <b style="--pc:${list[0].color}">${esc(proj)}</b>
          <span class="sa-hint">${list.length} بند</span>
          <div class="wl-tasks">${list.map(x=>
            `<span class="wl-task ${x.critical?'crit':''}">${esc(x.task)} — ${esc(x.name)}${x.critical?' ◆':''}</span>`).join('')}</div>
        </div>`).join('')}
      <button class="reqbtn mt-10" id="wlCloseDay">✕ إغلاق</button>
    </div>`;
  if(box.scrollIntoView)box.scrollIntoView({behavior:'smooth',block:'nearest'});
  $('#wlCloseDay').onclick=()=>{box.innerHTML='';};
}

window.renderWorkload=renderWorkload;
