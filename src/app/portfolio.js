// ===== app/portfolio.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
async function renderPortfolio(){
  SCREEN='portfolio';
  $('#hProject').textContent='محفظة المشاريع';
  $('#barClient').style.display='none';hideChrome();
  const isStaff=(ROLE==='pmo'||ROLE==='delivery');
  // هيكل skeleton فوري (تجربة أسرع بصريًا)
  const skel=CLIENTS.map(()=>'<div class="pcard"><div class="skeleton" style="height:22px;width:55%;margin-bottom:14px"></div><div class="skeleton" style="height:8px;margin-bottom:12px"></div><div class="skeleton" style="height:36px"></div></div>').join('');
  const toolItems=[];
  if(isStaff){
    toolItems.push({id:'showPGantt',t:'الخط الزمني الشامل',i:'📅'});
    toolItems.push({id:'showTimeline',t:'خط التسليمات الشامل',i:'📦'});
    toolItems.push({id:'showDOL',t:'طبقة القرار (DOL)',i:'⚖'});
    toolItems.push({id:'showAudit',t:'سجل المكتب',i:'📋'});
  }
  if(ROLE==='pmo'){
    toolItems.push({id:'showHolidays',t:'العطلات الرسمية',i:'🗓'});
    toolItems.push({id:'showArchived',t:'المؤرشفة',i:'🗄'});
    toolItems.push({id:'showLeads',t:'العملاء المحتملون',i:'👥'});
  }
  if(IS_OWNER){toolItems.push({id:'showTrelloSet',t:'إعدادات Trello',i:'🔗'});
    toolItems.push({id:'showStaffAccess',t:'صلاحيات الفريق',i:'🔐'});}
  const toolsMenu=toolItems.length?`<div class="tools-wrap">
    <button class="hbtn tools-btn" id="toolsBtn" aria-expanded="false" aria-haspopup="true">⚙ أدوات المكتب <span class="tools-caret">▾</span></button>
    <div class="tools-pop" id="toolsPop" role="menu">${toolItems.map(t=>`<button role="menuitem" id="${t.id}"><span class="ti">${t.i}</span>${t.t}</button>`).join('')}</div>
  </div>`:'';
  const primaryBtn=(ROLE==='pmo')?'<button class="hbtn primary-cta" id="addClientBtn">+ عميل جديد</button>':'';
  const toolbar=isStaff?`<div class="portfolio-tools">${primaryBtn}${toolsMenu}</div>`:'';
  $('#host').innerHTML='<div class="hintbar">اختر عميلًا لعرض لوحة مشروعه الكاملة.'+toolbar+'</div><div class="pgrid" id="pgrid">'+skel+'</div>';
  if(ROLE==='pmo'){const lb=$('#showLeads');if(lb)lb.onclick=renderLeads;
    const ac=$('#addClientBtn');if(ac)ac.onclick=addNewClient;}
  {const db=$('#showDOL');if(db)db.onclick=openDOL;}
  {const ab=$('#showAudit');if(ab)ab.onclick=renderAuditLog;}
  {const tb=$('#showTimeline');if(tb)tb.onclick=renderPortfolioTimeline;}
  {const hb=$('#showHolidays');if(hb)hb.onclick=openHolidaysManager;}
  {const arb=$('#showArchived');if(arb)arb.onclick=renderArchived;}
  {const pg=$('#showPGantt');if(pg)pg.onclick=()=>renderPortfolioGantt();}
  {const ts=$('#showTrelloSet');if(ts)ts.onclick=()=>openTrello('settings');}
  {const sa=$('#showStaffAccess');if(sa)sa.onclick=renderStaffAccess;}
  {const tb=$('#toolsBtn'),pop=$('#toolsPop');
    if(tb&&pop){
      const close=()=>{pop.classList.remove('open');tb.setAttribute('aria-expanded','false');};
      tb.onclick=(e)=>{e.stopPropagation();const o=pop.classList.toggle('open');tb.setAttribute('aria-expanded',o?'true':'false');};
      pop.querySelectorAll('button').forEach(b=>b.addEventListener('click',close));
      document.addEventListener('click',close);
      tb.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    }}
  // استعلام واحد لكل الملخّصات (صف لكل مشروع)
  const {data:rows,error}=await fetchPortfolio();
  const grid=$('#pgrid');grid.innerHTML='';
  if(error){grid.innerHTML='<p class="pempty">تعذّر تحميل المحفظة.</p>';return;}
  const LIFE={proposal:'مقترح',negotiation:'تفاوض',approved:'معتمد',active:'نشط',closed:'مغلق',lost:'ملغى'};
  let projects=(rows||[]).filter(r=>r.project_id);
  const noProjRows=(rows||[]).filter(r=>!r.project_id);

  // تجميع حسب الشركة أولًا (الشركة هي وحدة العرض)
  const groups={}; 
  projects.forEach(r=>{ (groups[r.client_id]=groups[r.client_id]||[]).push(r); });
  let companies=Object.keys(groups).map(cid=>aggregateClientRows(cid,groups[cid]));
  // العملاء بلا مشاريع: بطاقة دعوة لإضافة أول مشروع
  noProjRows.forEach(r=>{
    companies.push(aggregateClientRows(r.client_id,null,{name:r.client_name,color:r.color||'#C8A06B'}));
  });

  // عدّادات الفلاتر (على مستوى الشركات)
  const counts={all:companies.length,
    active:companies.filter(x=>x.isActive).length,
    draft:companies.filter(x=>x.isDraft).length,
    blocked:companies.filter(x=>x.blocked>0).length,
    reqs:companies.filter(x=>x.reqs>0).length,
    comments:companies.filter(x=>x.comments>0).length};
  const fbtn=(k,lbl)=>`<button class="pfilter ${PFILTER===k?'active':''}" data-filter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const abtn=(k,lbl,cls)=>`<button class="pfilter chip-${cls} ${PALERTS.has(k)?'active':''}" data-alertfilter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const searchBox=`<input id="pSearch" class="psearch" placeholder="🔍 بحث باسم الشركة أو المشروع…" value="${esc(PSEARCH)}">`;
  const sortSel=`<select id="pSort" class="psort" aria-label="ترتيب">
    <option value="alerts" ${PSORT==='alerts'?'selected':''}>ترتيب: التنبيهات أولًا</option>
    <option value="name" ${PSORT==='name'?'selected':''}>ترتيب: الاسم</option>
    <option value="progress" ${PSORT==='progress'?'selected':''}>ترتيب: الأعلى تقدّمًا</option>
    <option value="projects" ${PSORT==='projects'?'selected':''}>ترتيب: عدد المشاريع</option>
  </select>`;
  const filterBar=`<div class="pfilters-wrap">
    <div class="pfilters">
      <span class="pfacet-lbl">الحالة:</span>${fbtn('all','الكل')}${fbtn('active','نشطة')}${fbtn('draft','مسوّدة')}
      <span class="pfacet-lbl">تنبيهات:</span>${abtn('blocked','متوقفة','red')}${abtn('reqs','متطلبات','amber')}${abtn('comments','نقاش','blue')}
      ${sortSel}${searchBox}
    </div>
  </div>`;

  // تطبيق الفلاتر (تُدمج: حالة + تنبيهات متعددة + بحث)
  let shown=companies.filter(x=>{
    if(PFILTER==='active'&&!x.isActive)return false;
    if(PFILTER==='draft'&&!x.isDraft)return false;
    if(PALERTS.has('blocked')&&!(x.blocked>0))return false;
    if(PALERTS.has('reqs')&&!(x.reqs>0))return false;
    if(PALERTS.has('comments')&&!(x.comments>0))return false;
    if(PSEARCH){
      const q=PSEARCH.trim();
      const inName=x.c.name.includes(q);
      const inProj=x.list.some(r=>(r.project_name||'').includes(q));
      if(!inName&&!inProj)return false;
    }
    return true;
  });
  // الترتيب حسب اختيار المستخدم
  const sorters={
    alerts:(a,b)=>(b.hasAlerts-a.hasAlerts)||(b.list.length-a.list.length),
    name:(a,b)=>a.c.name.localeCompare(b.c.name,'ar'),
    progress:(a,b)=>b.pct-a.pct,
    projects:(a,b)=>b.list.length-a.list.length
  };
  shown.sort(sorters[PSORT]||sorters.alerts);

  // شرائح الفلاتر النشطة (قابلة للإزالة)
  const activeChips=[];
  if(PFILTER!=='all')activeChips.push({k:'status',label:(PFILTER==='active'?'نشطة':'مسوّدة')});
  if(PALERTS.has('blocked'))activeChips.push({k:'alert:blocked',label:'متوقفة'});
  if(PALERTS.has('reqs'))activeChips.push({k:'alert:reqs',label:'متطلبات'});
  if(PALERTS.has('comments'))activeChips.push({k:'alert:comments',label:'نقاش'});
  if(PSEARCH)activeChips.push({k:'search',label:'بحث: '+PSEARCH});
  const chipsBar=activeChips.length?`<div class="pchips"><span class="pchips-lbl">مُفعّل:</span>${activeChips.map(c=>`<span class="pchip">${esc(c.label)}<button data-rmchip="${c.k}" aria-label="إزالة الفلتر">✕</button></span>`).join('')}<button class="pchips-clear" id="pClearAll">مسح الكل</button></div>`:'';

  $('#host').querySelector('.hintbar').insertAdjacentHTML('afterend',filterBar+chipsBar);
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{PFILTER=b.dataset.filter;savePFilters();renderPortfolio();});
  document.querySelectorAll('[data-alertfilter]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.alertfilter; if(PALERTS.has(k))PALERTS.delete(k);else PALERTS.add(k);
    savePFilters();renderPortfolio();});
  const pSortEl=$('#pSort'); if(pSortEl)pSortEl.onchange=()=>{PSORT=pSortEl.value;savePFilters();renderPortfolio();};
  document.querySelectorAll('[data-rmchip]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.rmchip;
    if(k==='status')PFILTER='all'; else if(k==='search')PSEARCH=''; else if(k.startsWith('alert:'))PALERTS.delete(k.split(':')[1]);
    savePFilters();renderPortfolio();});
  const pClearBtn=$('#pClearAll'); if(pClearBtn)pClearBtn.onclick=()=>{PFILTER='all';PSEARCH='';PALERTS.clear();savePFilters();renderPortfolio();};
  const sIn=$('#pSearch');
  if(sIn){ sIn.oninput=()=>{PSEARCH=sIn.value; clearTimeout(sIn._t); sIn._t=setTimeout(renderPortfolio,300);};
    // إبقاء التركيز بعد إعادة العرض
    if(PSEARCH){ setTimeout(()=>{const el=$('#pSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0); } }

  if(!shown.length){grid.innerHTML='<div class="empty-cta"><div class="ico">🔍</div><h3>لا نتائج مطابقة</h3><p>جرّب تعديل الفلاتر أو مسحها.</p><button class="hbtn" id="pEmptyClear" style="background:var(--gold);border-color:var(--gold)">مسح الفلاتر</button></div>';
    const pec=$('#pEmptyClear');if(pec)pec.onclick=()=>{PFILTER='all';PSEARCH='';PALERTS.clear();savePFilters();renderPortfolio();};
    return;}
  grid.className='pcompany-grid';

  // صف مشروع مدمج (داخل التوسيع)
  const projRow=(r)=>{
    const hasplan=r.total_tasks>0;
    const pct=hasplan?Math.round(r.done_tasks/r.total_tasks*100):0;
    const alerts=[];
    if(r.blocked_tasks>0)alerts.push(`<span class="palert red">${r.blocked_tasks}</span>`);
    if(r.pending_client_reqs>0)alerts.push(`<span class="palert amber">${r.pending_client_reqs}</span>`);
    if(r.open_comments>0)alerts.push(`<span class="palert blue">${r.open_comments}</span>`);
    return `<div class="proj-row" data-openproj="${r.project_id}" data-cid="${r.client_id}" role="button" tabindex="0">
      <div class="proj-row-main">
        <span class="proj-row-name">${esc(r.project_name||'مشروع')}</span>
        <span class="plife">${LIFE[r.lifecycle]||'—'}</span>
        ${alerts.length?`<span class="proj-row-alerts">${alerts.join('')}</span>`:''}
      </div>
      ${hasplan?`<div class="proj-row-prog"><div class="pbar mini"><div class="pbar-fill" style="width:${pct}%"></div></div><span class="proj-row-pct">${pct}%</span></div>`:'<span class="proj-row-empty">بلا خطة</span>'}
      ${ROLE==='pmo'?`<button class="pcard-menu" data-pmenu="${r.project_id}" data-pname="${esc(r.project_name||'')}" aria-label="إجراءات المشروع">${I.dots}</button>`:''}
      <span class="proj-row-go">←</span>
    </div>`;
  };

  const withProj=shown.filter(x=>!x.noProjects), empty=shown.filter(x=>x.noProjects);
  const renderCard=x=>{
    const alertBadges=[];
    if(x.blocked>0)alertBadges.push(`<span class="palert red">${x.blocked} متوقف</span>`);
    if(x.reqs>0)alertBadges.push(`<span class="palert amber">${x.reqs} متطلب</span>`);
    if(x.comments>0)alertBadges.push(`<span class="palert blue">${x.comments} نقاش</span>`);
    const actBtn=(ROLE==='pmo')?`<button class="pcard-menu" data-cmenu="${x.cid}" title="إجراءات" aria-label="إجراءات العميل">${I.dots}</button>`:'';
    const card=document.createElement('div');
    card.className='pcompany'+(x.hasAlerts?' has-alerts':'');
    card.style.cssText=`--cc:${x.c.color}`;
    card.innerHTML=`
      <div class="pcompany-hd" data-toggle="${x.cid}" role="button" tabindex="0">
        <div class="pcv-top">
          <span class="pdot" style="background:${x.c.color}"></span>
          <h3>${esc(x.c.name)}</h3>
          ${actBtn}
        </div>
        <span class="pcompany-sub">${x.noProjects?'لا مشاريع بعد — انقر لإضافة أول مشروع':(x.list.length>1?x.list.length+' مشاريع':esc(x.list[0].project_name||'مشروع واحد'))+' · '+x.tot+' بند'}</span>
        ${x.noProjects?'':`<div class="pcompany-pct"><div class="pbar mini" role="progressbar" aria-valuenow="${x.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة الإنجاز"><div class="pbar-fill" style="width:${x.pct}%"></div></div><b>${x.pct}%</b></div>`}
        ${alertBadges.length?`<div class="palerts">${alertBadges.join('')}</div>`:''}
      </div>
    `;
    grid.appendChild(card);
  };
  withProj.forEach(renderCard);
  // قسم مطوي للعملاء بلا مشاريع (لا يزاحم النشط)
  if(empty.length){
    const sec=document.createElement('div');sec.className='empty-sec';
    const open=PEXPANDED.has('__empty');
    sec.innerHTML=`<button class="empty-sec-hd" data-emptytoggle="1" aria-expanded="${open}">
        <span class="es-chev">${open?'▴':'▾'}</span> عملاء بلا مشاريع <span class="es-n">${empty.length}</span>
        <span class="es-hint">جاهزون لإضافة أول مشروع</span></button>
      <div class="empty-sec-body" style="display:${open?'flex':'none'}">
        ${empty.map(x=>`<button class="ecard" data-newproj="${x.cid}" style="--cc:${x.c.color}">
          <span class="edot"></span><b>${esc(x.c.name)}</b><span class="eadd">+ أول مشروع</span></button>`).join('')}
      </div>`;
    grid.appendChild(sec);
    const hd=sec.querySelector('[data-emptytoggle]');
    hd.onclick=()=>{PEXPANDED.has('__empty')?PEXPANDED.delete('__empty'):PEXPANDED.add('__empty');renderPortfolio();};
    sec.querySelectorAll('[data-newproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.newproj);});
  }

  // التفاعل: ترويسة الشركة — تفتح صفحة العميل الموحّدة دائمًا (لوحة قيادة + مشاريعه + خططه + فريقه)
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=async(e)=>{
    if(e.target.closest('[data-cmenu]'))return;
    const cid=el.dataset.toggle;
    await renderClientHome(cid);
  });
  // نقرة على مشروع داخل التوسيع
  document.querySelectorAll('[data-openproj]').forEach(el=>el.onclick=async(e)=>{
    e.stopPropagation();
    CID=el.dataset.cid; PID=el.dataset.openproj; await openProject();
  });
  document.querySelectorAll('[data-cmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openClientMenu(b.dataset.cmenu);});
  document.querySelectorAll('[data-pmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openProjectMenu(b.dataset.pmenu,b.dataset.pname);});
  document.querySelectorAll('[data-addproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.addproj);});
}
