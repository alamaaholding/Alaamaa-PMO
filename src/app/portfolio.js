// ===== app/portfolio.js — جزء من طبقة التطبيق (مقسّم من app.js) =====

// ===== الملف التعاقدي لعلامة (الطرف الأول في كل عقد) =====
// يُضبط مرة واحدة من أدوات المكتب، ويُستورَد تلقائيًا في كل عقد جديد ويُجمَّد كلقطة داخله،
// فتغييره لاحقًا لا يمسّ العقود الموقَّعة سابقًا.

// ===== أتمتة العقود — مغلقة افتراضيًا =====
// قرار متعمَّد: تفعيلها يعني رسائل تُرسَل لشركائك بلا تدخلك، فلا تُفتح إلا بقرارك الصريح.

// ===== فحص أمني دوري =====
// سببه: Postgres يمنح EXECUTE لـPUBLIC افتراضيًا لكل دالة جديدة، ومحاولة تغيير الصلاحية
// الافتراضية لم تنفذ من اتصالنا. فبدل الاعتماد على منع لا يمكن التحقق من نفاذه، نكشف
// التسرّب متى حدث ونصلحه بضغطة. يفحص أيضًا تعدّد توقيعات الدوال — النمط الذي سبّب سابقًا
// ثغرة تجاوز تحقق الهوية (نسخة قديمة بلا فحص رمز بقيت حيّة).
async function openSecurityAudit(){
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='فحص أمني';
  document.getElementById('tkTabs').innerHTML='';
  const body=document.getElementById('tkBody');
  body.innerHTML=skeleton('cards',1);
  const render=(r)=>{
    body.innerHTML=`
      <div class="${r.clean?'ctr-integrity ok':'chub-expiry-banner'} mb-14">
        ${r.clean?'✅ <b>لا مشاكل مرصودة</b> — لا دوال مكشوفة للمجهولين ولا توقيعات مكرَّرة.'
                 :'⚠ <b>رُصدت مشاكل تحتاج إصلاحًا</b>'}
      </div>
      <div class="sa-section">
        <h4>دوال مكشوفة لغير المسجَّلين <span class="sa-hint">(${r.leaked_count})</span></h4>
        ${r.leaked_count?r.leaked_to_anon.map(x=>`<div class="chd-att-row"><span>⚠ ${esc(x.function)}</span></div>`).join('')
          :'<p class="sa-hint">لا شيء — المسار العام لصفحة التوقيع فقط.</p>'}
      </div>
      <div class="sa-section mt-12">
        <h4>دوال بتوقيعات متعددة <span class="sa-hint">(${r.duplicate_count})</span></h4>
        ${r.duplicate_count?r.duplicate_dupes||r.duplicate_signatures.map(x=>
            `<div class="chd-att-row"><span>⚠ ${esc(x.function)} — ${x.versions} نسخ</span></div>`).join('')
          :'<p class="sa-hint">لا شيء — نسخة واحدة لكل دالة.</p>'}
        ${r.duplicate_count?'<p class="sa-hint mt-6">نسخة قديمة قد تتجاوز حواجز النسخة الجديدة — تحتاج حذفًا يدويًا مدروسًا.</p>':''}
      </div>
      <p class="sa-hint mt-10">آخر فحص: ${new Date(r.checked_at).toLocaleString('ar')}</p>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="reqbtn" id="secRecheck">إعادة الفحص</button>
        ${r.leaked_count?'<button class="hbtn ok" id="secFix">🔧 سحب الإتاحة المتسرّبة</button>':''}
      </div>`;
    document.getElementById('secRecheck').onclick=openSecurityAudit;
    const fx=document.getElementById('secFix');
    if(fx)fx.onclick=async()=>{
      fx.disabled=true;
      try{ const r2=await runSecurityAudit(true); toast('سُحبت الإتاحة عن '+r2.fixed+' دالة','ok'); render(r2); }
      catch(e){toast(e.message,'err');fx.disabled=false;}
    };
  };
  try{ render(await runSecurityAudit(false)); }
  catch(e){ body.innerHTML='<p class="empty">تعذّر الفحص: '+esc(e.message)+'</p>'; }
}


// ===== الأقسام والمسمّيات الوظيفية =====
// الطاقة تُشتق من: عدد شاغلي المسمّى × البنود المتزامنة التي يحتملها الفرد. فيصبح ممكنًا
// القول «مصمم الجرافيك فوق طاقته، يلزم مورد ثانٍ» بدل «فلان مشغول».
async function openCapacityPanel(){
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='الأقسام والمسمّيات الوظيفية';
  document.getElementById('tkTabs').innerHTML='';
  const body=document.getElementById('tkBody');
  body.innerHTML=skeleton('cards',1);
  let tree=[];
  try{ tree=await fetchCapacityTree(); }
  catch(e){ body.innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>'; return; }

  const totalCap=tree.reduce((s2,d)=>s2+(d.roles||[]).reduce((a,r)=>a+(r.capacity||0),0),0);
  const totalHeads=tree.reduce((s2,d)=>s2+(d.roles||[]).reduce((a,r)=>a+(r.headcount||0),0),0);

  body.innerHTML=`
    <p class="sa-hint" style="margin-bottom:12px">الإسناد يقع على <b>المسمّى</b> لا الشخص — فالمكتب يعنيه أن المسمّى محمَّل فوق طاقته لا من ينفّذ. الطاقة = عدد الشاغلين × البنود المتزامنة للفرد.</p>
    <div class="chub-stats mb-14">
      <div class="chub-stat"><b>${tree.length}</b><span>قسم</span></div>
      <div class="chub-stat"><b>${tree.reduce((a,d)=>a+(d.roles||[]).length,0)}</b><span>مسمّى</span></div>
      <div class="chub-stat"><b>${totalHeads}</b><span>إجمالي الشاغلين</span></div>
      <div class="chub-stat"><b>${totalCap}</b><span>طاقة متزامنة</span></div>
    </div>
    ${tree.map(d=>`
      <div class="sa-section cap-dept" style="--dc:${esc(d.color||'#C8A06B')}">
        <h4>${esc(d.name)} <span class="sa-hint">${(d.roles||[]).length} مسمّى</span></h4>
        ${(d.roles||[]).map(r=>`
          <div class="cap-role" data-role="${r.id}">
            <input class="cap-name" value="${esc(r.name)}" data-rf="name">
            <label class="sa-hint">شاغلون</label>
            <input class="cap-num" type="number" min="0" max="99" value="${r.headcount}" data-rf="headcount">
            <label class="sa-hint">حمل الفرد</label>
            <input class="cap-num" type="number" min="1" max="10" value="${r.load_per_person}" data-rf="load">
            <span class="cap-total">= ${r.capacity} بند متزامن</span>
            <span class="sa-hint">${r.assigned_tasks} بند مُسنَد</span>
            <button class="reqbtn txt-crit" data-delrole="${r.id}" aria-label="حذف مسمّى ${esc(r.name)}">حذف</button>
          </div>`).join('')||'<p class="sa-hint">لا مسمّيات في هذا القسم بعد.</p>'}
        <div class="sa-form mt-10">
          <input class="cap-newname" placeholder="مسمّى جديد" data-dept="${d.id}">
          <button class="reqbtn" data-addrole="${d.id}">+ إضافة مسمّى</button>
        </div>
      </div>`).join('')}
    <div class="sa-form mt-12">
      <input id="capNewDept" placeholder="قسم جديد">
      <button class="reqbtn" id="capAddDept">+ إضافة قسم</button>
    </div>`;

  const reload=()=>openCapacityPanel();
  body.querySelectorAll('.cap-role').forEach(row=>{
    row.querySelectorAll('[data-rf]').forEach(inp=>inp.onchange=async()=>{
      try{
        await saveJobRole(row.dataset.role,null,
          row.querySelector('[data-rf="name"]').value,
          Number(row.querySelector('[data-rf="headcount"]').value),
          Number(row.querySelector('[data-rf="load"]').value));
        toast('حُفظ','ok');reload();
      }catch(e){toast(e.message,'err');}
    });
  });
  body.querySelectorAll('[data-delrole]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('حذف المسمّى','البنود المُسنَدة إليه لن تُحذف — سيعود إسنادها فارغًا فقط.',true,'حذف'))return;
    try{const r=await deleteJobRole(b.dataset.delrole);
      toast(r.freed_tasks?`حُذف — تحرّر ${r.freed_tasks} بند`:'حُذف','ok');reload();}
    catch(e){toast(e.message,'err');}
  });
  body.querySelectorAll('[data-addrole]').forEach(b=>b.onclick=async()=>{
    const inp=body.querySelector(`.cap-newname[data-dept="${b.dataset.addrole}"]`);
    const nm=(inp.value||'').trim();
    if(!nm){toast('أدخل اسم المسمّى','warn');return;}
    try{ await saveJobRole(null,b.dataset.addrole,nm,1,2);toast('أُضيف','ok');reload(); }
    catch(e){toast(e.message,'err');}
  });
  document.getElementById('capAddDept').onclick=async()=>{
    const nm=(document.getElementById('capNewDept').value||'').trim();
    if(!nm){toast('أدخل اسم القسم','warn');return;}
    try{ await saveDepartment(null,nm);toast('أُضيف القسم','ok');reload(); }
    catch(e){toast(e.message,'err');}
  };
}

async function openAutomationPanel(){
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='أتمتة العقود';
  document.getElementById('tkTabs').innerHTML='';
  document.getElementById('tkBody').innerHTML=skeleton('cards',1);
  let st={};
  try{ st=await fetchAutomationSettings(); }catch(e){
    document.getElementById('tkBody').innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>';return; }

  document.getElementById('tkBody').innerHTML=`
    <div class="${st.auto_reminders_enabled?'ctr-integrity ok':'chub-tpl-banner'} mb-14">
      ${st.auto_reminders_enabled
        ?'⚡ <b>التذكير التلقائي مُفعَّل</b> — تُرسَل رسائل لشركائك تلقائيًا وفق الإعدادات أدناه.'
        :'🔕 <b>التذكير التلقائي معطَّل</b> — لا تُرسَل أي رسالة تلقائيًا. التذكير يدوي من لوحة كل عقد.'}
    </div>
    <div class="sa-form fx-wrap">
      <label class="chub-choice"><input type="checkbox" id="autoRem" ${st.auto_reminders_enabled?'checked':''}>
        تفعيل التذكير التلقائي للعقود غير الموقَّعة</label>
    </div>
    <div class="sa-form" style="flex-wrap:wrap;margin-top:10px">
      <label class="fs-85 self-center">يُذكَّر بعد</label>
      <input id="autoDays" type="number" min="1" max="30" value="${st.reminder_after_days||3}" style="width:90px">
      <label class="fs-85 self-center">أيام · بحد أقصى</label>
      <input id="autoMax" type="number" min="1" max="5" value="${st.max_reminders||2}" style="width:90px">
      <label class="fs-85 self-center">تذكيرات لكل عقد</label>
    </div>
    <p class="sa-hint mt-10">الحدّ الأقصى يمنع إزعاج الشريك — بعد استنفاده يتوقف التذكير التلقائي ويبقى اليدوي متاحًا.</p>
    <div id="autoPreview" class="mt-14"></div>
    <button class="hbtn" id="autoSave" style="background:var(--gold);border-color:var(--gold);margin-top:12px">حفظ الإعدادات</button>`;

  const preview=async()=>{
    const box=document.getElementById('autoPreview');
    try{
      const q=await fetchContractsNeedingReminder(Number(document.getElementById('autoDays').value)||3);
      box.innerHTML=q.length
        ?`<div class="chub-expiry-banner"><b>سيشمل التذكير حاليًا ${q.length} عقدًا:</b>
           ${q.slice(0,5).map(x=>`<div class="sa-hint">· ${esc(x.contract_name||'')} — ${esc(x.client_name||'—')} (مضى ${x.days_since} يومًا)</div>`).join('')}</div>`
        :'<p class="sa-hint">لا عقود مؤهَّلة للتذكير بهذه الإعدادات حاليًا.</p>';
    }catch(e){box.innerHTML='';}
  };
  preview();
  document.getElementById('autoDays').onchange=preview;

  document.getElementById('autoSave').onclick=async()=>{
    const on=document.getElementById('autoRem').checked;
    if(on&&!st.auto_reminders_enabled){
      if(!await confirmDialog('تفعيل الإرسال التلقائي',
        'ستُرسَل رسائل تذكير لشركائك تلقائيًا دون تدخل منك في كل مرة. متأكد؟',false,'تفعيل'))return;
    }
    const btn=document.getElementById('autoSave');btn.disabled=true;
    try{
      await updateAutomationSettings({auto_reminders_enabled:on,
        reminder_after_days:Number(document.getElementById('autoDays').value)||3,
        max_reminders:Number(document.getElementById('autoMax').value)||2});
      toast('حُفظت إعدادات الأتمتة','ok');openAutomationPanel();
    }catch(e){toast(e.message,'err');btn.disabled=false;}
  };
}

async function openOrgProfile(){
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='الملف التعاقدي لعلامة';
  document.getElementById('tkTabs').innerHTML='';
  document.getElementById('tkBody').innerHTML=skeleton('cards',1);
  let o={};
  try{ o=await fetchOrgProfile(true); }catch(e){
    document.getElementById('tkBody').innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>';return; }
  const miss=['cr_number','vat_number','national_address','rep_name','rep_title','contact_email','contact_phone']
    .filter(k=>!o[k]);
  document.getElementById('tkBody').innerHTML=`
    <p class="sa-hint mb-14">بيانات علامة بصفتها <b>الطرف الأول</b> في كل عقد — تُستورَد تلقائيًا عند إنشاء أي عقد جديد، وتُجمَّد داخله كلقطة فلا يتأثر أي عقد موقَّع سابقًا بأي تعديل هنا لاحقًا.</p>
    ${miss.length?`<div class="ch-warn-badge">⚠ بيانات غير مكتملة (${miss.length} حقول) — ستظهر كـ«—» في جدول أطراف العقد</div>`:''}
    <div class="sa-form fx-wrap">
      <input id="orgName" placeholder="الاسم النظامي" value="${esc(o.legal_name||'علامة')}" style="flex:1;min-width:180px;font-weight:700">
      <input id="orgCr" placeholder="رقم السجل التجاري" value="${esc(o.cr_number||'')}" class="grow-150">
      <input id="orgVat" placeholder="الرقم الضريبي (VAT)" value="${esc(o.vat_number||'')}" class="grow-150">
      <input id="orgAddr" placeholder="العنوان الوطني" value="${esc(o.national_address||'')}" style="flex:1;min-width:170px">
      <input id="orgRep" placeholder="اسم الممثل المفوَّض" value="${esc(o.rep_name||'')}" class="grow-160">
      <input id="orgTitle" placeholder="صفته" value="${esc(o.rep_title||'')}" style="flex:1;min-width:130px">
      <input id="orgEmail" placeholder="البريد الرسمي" value="${esc(o.contact_email||'')}" style="flex:1;min-width:170px" dir="ltr">
      <input id="orgPhone" placeholder="رقم الجوال" value="${esc(o.contact_phone||'')}" style="flex:1;min-width:140px" dir="ltr">
      <button class="hbtn gold" id="orgSave">حفظ الملف</button>
    </div>`;
  document.getElementById('orgSave').onclick=async()=>{
    const btn=document.getElementById('orgSave');btn.disabled=true;
    try{
      const r=await updateOrgProfile({
        legal_name:document.getElementById('orgName').value,
        cr_number:document.getElementById('orgCr').value,
        vat_number:document.getElementById('orgVat').value,
        national_address:document.getElementById('orgAddr').value,
        rep_name:document.getElementById('orgRep').value,
        rep_title:document.getElementById('orgTitle').value,
        contact_email:document.getElementById('orgEmail').value,
        contact_phone:document.getElementById('orgPhone').value});
      const n=(r&&r.contracts_refreshed)||0;
      toast(n?`حُفظ الملف — وانعكس على ${n} عقد غير موقَّع`:'حُفظ الملف التعاقدي لعلامة','ok');
      openOrgProfile();
    }catch(e){toast(e.message,'err');btn.disabled=false;}
  };
}

async function openStatusLegend(){
  document.getElementById('taskOverlay').style.display='flex';
  document.getElementById('tkTitle').textContent='دليل حالات المشاريع';
  document.getElementById('tkTabs').innerHTML='';
  document.getElementById('tkBody').innerHTML=`
    <p class="sa-hint" style="margin-bottom:16px">كل مشروع أو شريك في المحفظة يحمل شارة حالة واحدة توضّح وضعه الحالي بلمحة — هذا شرح كل شارة:</p>
    ${PROJECT_STATUS_DEFS.map(s=>`
      <div class="legend-row">
        ${renderStatusBadge(s)}
        <span class="legend-desc">${esc(legendDescOf(s.key))}</span>
      </div>`).join('')}
    <p class="sa-hint" style="margin-top:16px">للشريك الذي لديه أكثر من مشروع، تُعرض شارة <b>أسوأ حالة</b> بين كل مشاريعه — فمشروع واحد متوقف يكفي لتظهر الشارة الحمراء على بطاقة الشريك كاملة، حتى لو كانت بقية مشاريعه سليمة.</p>`;
}
function legendDescOf(key){
  return {
    paused:'أُوقف مؤقتًا يدويًا من فريق علامة — بياناته سليمة كاملة، ويُستأنف في أي وقت.',
    blocked:'يحوي بندًا واحدًا متوقفًا على الأقل — يحتاج تدخلًا لفكّ العائق.',
    attention:'لديه متطلب معلَّق من الشريك، أو نقاش مفتوح لم يُحسَم بعد.',
    at_risk:'تقدير لا حساب دقيق: مضى أكثر من 30 يومًا منذ البدء والإنجاز أقل من 20٪ — يستحق مراجعة سريعة. (الحساب الدقيق للتأخير الفعلي متاح داخل كل مشروع عبر الجانت).',
    not_started:'لا بنود بعد، أو المشروع لا يزال في مرحلة الاقتراح/المسودة.',
    active:'يعمل عليه الفريق حاليًا بلا أي من الإشارات أعلاه.',
    done:'أُنجزت كل بنوده — 100٪.'
  }[key]||'';
}
async function renderPortfolio(){
  SCREEN='portfolio';
  writePortfolioHash();
  $('#hProject').textContent='محفظة المشاريع';
  $('#barClient').style.display='none';hideChrome();
  const isStaff=(ROLE==='pmo'||ROLE==='delivery');
  // هيكل skeleton فوري (تجربة أسرع بصريًا)
  const skel=CLIENTS.map(()=>'<div class="pcard">'+skeleton('panel',3)+'</div>').join('');
  const toolItems=[];
  if(isStaff){
    toolItems.push({g:'عروض شاملة',id:'showPGantt',t:'الخط الزمني الشامل',i:'📅'});
    toolItems.push({g:'عروض شاملة',id:'showTimeline',t:'خط التسليمات الشامل',i:'📦'});
    toolItems.push({g:'عروض شاملة',id:'showDOL',t:'طبقة القرار (DOL)',i:'⚖'});
    toolItems.push({g:'إدارة',id:'showAudit',t:'سجل المكتب',i:'📋'});
    toolItems.push({g:'عروض شاملة',id:'showWorkload',t:'حِمل العمل',i:'📊'});
  toolItems.push({g:'إدارة',id:'showContractsHub',t:'إدارة العقود',i:'✍️'});
  }
  if(ROLE==='pmo'){
    toolItems.push({g:'إعدادات',id:'showHolidays',t:'العطلات الرسمية',i:'🗓'});
    toolItems.push({g:'إدارة',id:'showArchived',t:'المؤرشفة',i:'🗄'});
    toolItems.push({g:'إدارة',id:'showLeads',t:'الشركاء المحتملون',i:'👥'});
  }
  // الملف التعاقدي لعلامة: متاح لمالك المنصة ومديرها معًا — مطابقًا لسياسة القاعدة
  // (pmo_update_org_profile تسمح لكليهما). كان محصورًا بالمالك في الواجهة فقط، فاختفى
  // عن مدير المنصة بعد نقل الملكية رغم امتلاكه الصلاحية فعليًا.
  if(IS_OWNER||ROLE==='pmo'){toolItems.push({g:'إعدادات',id:'showCapacity',t:'الأقسام والمسمّيات',i:'👥'});
    toolItems.push({g:'إعدادات',id:'showOrgProfile',t:'الملف التعاقدي لعلامة',i:'🏢'});
    toolItems.push({g:'إعدادات',id:'showAutomation',t:'أتمتة العقود',i:'⚡'});
    toolItems.push({g:'إعدادات',id:'showSecAudit',t:'فحص أمني',i:'🛡'});}
  if(IS_OWNER){toolItems.push({g:'إعدادات',id:'showTrelloSet',t:'إعدادات Trello',i:'🔗'});
    toolItems.push({g:'إعدادات',id:'showStaffAccess',t:'صلاحيات الفريق',i:'🔐'});}
  const toolsMenu=toolItems.length?`<div class="tools-wrap">
    <button class="hbtn tools-btn" id="toolsBtn" aria-expanded="false" aria-haspopup="true">⚙ أدوات المكتب <span class="tools-caret">▾</span></button>
    <div class="tools-pop" id="toolsPop" role="menu">${
      // تجميع بعناوين: القائمة المسطّحة من 14 بندًا كانت تخلط العروض بالإدارة بالإعدادات
      ['عروض شاملة','إدارة','إعدادات'].map(g=>{
        const items=toolItems.filter(t=>(t.g||'إدارة')===g);
        if(!items.length)return '';
        return `<div class="tools-grp" role="group" aria-label="${g}"><span class="tools-grp-h">${g}</span>`
          +items.map(t=>`<button role="menuitem" id="${t.id}"><span class="ti" aria-hidden="true">${t.i}</span>${t.t}</button>`).join('')
          +`</div>`;
      }).join('')}</div>
  </div>`:'';
  const primaryBtn=(ROLE==='pmo')?'<button class="hbtn primary-cta" id="addClientBtn">+ شريك جديد</button>':'';
  const legendBtn=isStaff?'<button class="hbtn" id="statusLegendBtn" title="دليل حالات المشاريع">ⓘ دليل الحالات</button>':'';
  const toolbar=isStaff?`<div class="portfolio-tools">${primaryBtn}${legendBtn}${toolsMenu}</div>`:'';
  $('#host').innerHTML='<div class="hintbar">اختر شريكًا لعرض لوحة مشروعه الكاملة.'+toolbar+'</div><div class="pgrid" id="pgrid">'+skel+'</div>';
  if(ROLE==='pmo'){const lb=$('#showLeads');if(lb)lb.onclick=()=>showScreen('leads');
    const ac=$('#addClientBtn');if(ac)ac.onclick=addNewClient;}
  {const db=$('#showDOL');if(db)db.onclick=openDOL;}
  {const ab=$('#showAudit');if(ab)ab.onclick=()=>showScreen('audit');}
  {const cb=$('#showContractsHub');if(cb)cb.onclick=()=>showScreen('contractshub');}
  {const lb=$('#statusLegendBtn');if(lb)lb.onclick=openStatusLegend;}
  {const op=$('#showOrgProfile');if(op)op.onclick=openOrgProfile;}
  {const wl=$('#showWorkload');if(wl)wl.onclick=()=>showScreen('workload');}
  {const cp=$('#showCapacity');if(cp)cp.onclick=openCapacityPanel;}
  {const au=$('#showAutomation');if(au)au.onclick=openAutomationPanel;}
  {const sa2=$('#showSecAudit');if(sa2)sa2.onclick=openSecurityAudit;}
  {const tb=$('#showTimeline');if(tb)tb.onclick=()=>showScreen('ptimeline');}
  {const hb=$('#showHolidays');if(hb)hb.onclick=openHolidaysManager;}
  {const arb=$('#showArchived');if(arb)arb.onclick=()=>showScreen('archived');}
  {const pg=$('#showPGantt');if(pg)pg.onclick=()=>renderPortfolioGantt();}
  {const ts=$('#showTrelloSet');if(ts)ts.onclick=()=>openTrello('settings');}
  {const sa=$('#showStaffAccess');if(sa)sa.onclick=()=>showScreen('staffaccess');}
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
  let projects=(rows||[]).filter(r=>r.project_id);
  const noProjRows=(rows||[]).filter(r=>!r.project_id);

  // تجميع حسب الشركة أولًا (الشركة هي وحدة العرض)
  const groups={}; 
  projects.forEach(r=>{ (groups[r.client_id]=groups[r.client_id]||[]).push(r); });
  let companies=Object.keys(groups).map(cid=>aggregateClientRows(cid,groups[cid]));
  // الشركاء بلا مشاريع: بطاقة دعوة لإضافة أول مشروع
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
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{PFILTER=b.dataset.filter;savePFilters();writePortfolioHash();renderPortfolio();});
  document.querySelectorAll('[data-alertfilter]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.alertfilter; if(PALERTS.has(k))PALERTS.delete(k);else PALERTS.add(k);
    savePFilters();writePortfolioHash();renderPortfolio();});
  const pSortEl=$('#pSort'); if(pSortEl)pSortEl.onchange=()=>{PSORT=pSortEl.value;savePFilters();writePortfolioHash();renderPortfolio();};
  document.querySelectorAll('[data-rmchip]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.rmchip;
    if(k==='status')PFILTER='all'; else if(k==='search')PSEARCH=''; else if(k.startsWith('alert:'))PALERTS.delete(k.split(':')[1]);
    savePFilters();writePortfolioHash();renderPortfolio();});
  const pClearBtn=$('#pClearAll'); if(pClearBtn)pClearBtn.onclick=()=>{PFILTER='all';PSEARCH='';PALERTS.clear();savePFilters();writePortfolioHash();renderPortfolio();};
  const sIn=$('#pSearch');
  if(sIn){ sIn.oninput=()=>{PSEARCH=sIn.value; clearTimeout(sIn._t); sIn._t=setTimeout(()=>{writePortfolioHash();renderPortfolio();},300);};
    // إبقاء التركيز بعد إعادة العرض
    if(PSEARCH){ setTimeout(()=>{const el=$('#pSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0); } }

  if(!shown.length){grid.innerHTML='<div class="empty-cta"><div class="ico">🔍</div><h3>لا نتائج مطابقة</h3><p>جرّب تعديل الفلاتر أو مسحها.</p><button class="hbtn gold" id="pEmptyClear">مسح الفلاتر</button></div>';
    const pec=$('#pEmptyClear');if(pec)pec.onclick=()=>{PFILTER='all';PSEARCH='';PALERTS.clear();savePFilters();writePortfolioHash();renderPortfolio();};
    return;}
  grid.className='pcompany-grid';

  const withProj=shown.filter(x=>!x.noProjects), empty=shown.filter(x=>x.noProjects);
  const renderCard=x=>{
    const alertBadges=[];
    if(x.blocked>0)alertBadges.push(`<span class="palert red">${x.blocked} متوقف</span>`);
    if(x.reqs>0)alertBadges.push(`<span class="palert amber">${x.reqs} متطلب</span>`);
    if(x.comments>0)alertBadges.push(`<span class="palert blue">${x.comments} نقاش</span>`);
    const actBtn=(ROLE==='pmo')?`<button class="pcard-menu" data-cmenu="${x.cid}" title="إجراءات" aria-label="إجراءات الشريك">${I.dots}</button>`:'';
    const card=document.createElement('div');
    card.className='pcompany'+(x.hasAlerts?' has-alerts':'');
    card.style.cssText=`--cc:${x.c.color}`;
    card.innerHTML=`
      <div class="pcompany-hd" data-toggle="${x.cid}" role="button" tabindex="0">
        <div class="pcv-top">
          <span class="pdot" style="background:${x.c.color}" title="لون تعريفي لهذا الشريك — يُستخدم لتمييزه في «الخط الزمني الشامل» وأي عرض مجمَّع آخر"></span>
          <h3>${esc(x.c.name)}</h3>
          ${actBtn}
        </div>
        <span class="pcompany-sub">${x.noProjects?'لا مشاريع بعد — انقر لإضافة أول مشروع':(x.list.length>1?x.list.length+' مشاريع':esc(x.list[0].project_name||'مشروع واحد'))+' · '+x.tot+' بند'}</span>
        ${x.noProjects?'':renderStatusBadge(worstProjectStatus(x.list))}
        ${x.noProjects?'':`<div class="pcompany-pct"><div class="pbar mini" role="progressbar" aria-valuenow="${x.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة الإنجاز"><div class="pbar-fill" style="width:${x.pct}%"></div></div><b>${x.pct}%</b></div>`}
        ${alertBadges.length?`<div class="palerts">${alertBadges.join('')}</div>`:''}
      </div>
    `;
    grid.appendChild(card);
  };
  withProj.forEach(renderCard);
  // قسم مطوي للشركاء بلا مشاريع (لا يزاحم النشط)
  if(empty.length){
    const sec=document.createElement('div');sec.className='empty-sec';
    const open=PEXPANDED.has('__empty');
    sec.innerHTML=`<button class="empty-sec-hd" data-emptytoggle="1" aria-expanded="${open}">
        <span class="es-chev">${open?'▴':'▾'}</span> شركاء بلا مشاريع <span class="es-n">${empty.length}</span>
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

  // التفاعل: ترويسة الشركة — تفتح صفحة الشريك الموحّدة دائمًا (لوحة قيادة + مشاريعه + خططه + فريقه)
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=async(e)=>{
    if(e.target.closest('[data-cmenu]'))return;
    const cid=el.dataset.toggle;
    await showScreen('clienthome', cid);
  });
  // نقرة على مشروع داخل التوسيع
  document.querySelectorAll('[data-openproj]').forEach(el=>el.onclick=async(e)=>{
    e.stopPropagation();
    CID=el.dataset.cid; PID=el.dataset.openproj; await showScreen('project');
  });
  document.querySelectorAll('[data-cmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openClientMenu(b.dataset.cmenu);});
  document.querySelectorAll('[data-pmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openProjectMenu(b.dataset.pmenu,b.dataset.pname);});
  document.querySelectorAll('[data-addproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.addproj);});
}

// ===== تسجيل الشاشة في السجلّ (src/screens.js) =====
// المفتاح هو ما يناديه بقية التطبيق، فلا ملف شاشةٍ يعرف اسم دالة شاشةٍ أخرى.
registerScreen('portfolio', renderPortfolio);
