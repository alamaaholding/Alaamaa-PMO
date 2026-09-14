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
// ═══ وحدة ESM ═══
// شاشة المحفظة: نقطة الدخول البصرية للمكتب. تُسجَّل في سجلّ الشاشات لا تُنادى
// بالاسم، فلا يعرف عنها أحدٌ شيئًا سوى مفتاحها.

import { deleteJobRole, fetchAutomationSettings, fetchCapacityTree, fetchContractsNeedingReminder, fetchOrgProfile, fetchPortfolio, openDOL, openTrello, renderPortfolioGantt, runSecurityAudit, saveDepartment, saveJobRole, updateAutomationSettings, updateOrgProfile } from '../api.js';
import { hideChrome } from '../chrome.js';
import { $, $$, aggregateClientRows, byId, I, PROJECT_STATUS_DEFS, renderStatusBadge, worstProjectStatus } from '../config.js';
import { esc } from '../format.js';
import { registerScreen, showScreen } from '../screens.js';
import { skeleton } from '../skeleton.js';
import { toast } from '../toast.js';
import { writePortfolioHash } from '../urlstate.js';
import { confirmDialog } from './dialogs.js';
import { addNewClient, newProjectDialog, openClientMenu, openHolidaysManager, openProjectMenu } from './lifecycle.js';
import { getState, savePFilters, setState } from './state.js';

async function openSecurityAudit(){
  byId('taskOverlay').style.display='flex';
  byId('tkTitle').textContent='فحص أمني';
  byId('tkTabs').innerHTML='';
  const body=byId('tkBody');
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
    byId('secRecheck').onclick=openSecurityAudit;
    const fx=byId('secFix');
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
  byId('taskOverlay').style.display='flex';
  byId('tkTitle').textContent='الأقسام والمسمّيات الوظيفية';
  byId('tkTabs').innerHTML='';
  const body=byId('tkBody');
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
  byId('capAddDept').onclick=async()=>{
    const nm=(byId('capNewDept').value||'').trim();
    if(!nm){toast('أدخل اسم القسم','warn');return;}
    try{ await saveDepartment(null,nm);toast('أُضيف القسم','ok');reload(); }
    catch(e){toast(e.message,'err');}
  };
}

async function openAutomationPanel(){
  byId('taskOverlay').style.display='flex';
  byId('tkTitle').textContent='أتمتة العقود';
  byId('tkTabs').innerHTML='';
  byId('tkBody').innerHTML=skeleton('cards',1);
  let st={};
  try{ st=await fetchAutomationSettings(); }catch(e){
    byId('tkBody').innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>';return; }

  byId('tkBody').innerHTML=`
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
    const box=byId('autoPreview');
    try{
      const q=await fetchContractsNeedingReminder(Number(byId('autoDays').value)||3);
      box.innerHTML=q.length
        ?`<div class="chub-expiry-banner"><b>سيشمل التذكير حاليًا ${q.length} عقدًا:</b>
           ${q.slice(0,5).map(x=>`<div class="sa-hint">· ${esc(x.contract_name||'')} — ${esc(x.client_name||'—')} (مضى ${x.days_since} يومًا)</div>`).join('')}</div>`
        :'<p class="sa-hint">لا عقود مؤهَّلة للتذكير بهذه الإعدادات حاليًا.</p>';
    }catch(e){box.innerHTML='';}
  };
  preview();
  byId('autoDays').onchange=preview;

  byId('autoSave').onclick=async()=>{
    const on=byId('autoRem').checked;
    if(on&&!st.auto_reminders_enabled){
      if(!await confirmDialog('تفعيل الإرسال التلقائي',
        'ستُرسَل رسائل تذكير لشركائك تلقائيًا دون تدخل منك في كل مرة. متأكد؟',false,'تفعيل'))return;
    }
    const btn=byId('autoSave');btn.disabled=true;
    try{
      await updateAutomationSettings({auto_reminders_enabled:on,
        reminder_after_days:Number(byId('autoDays').value)||3,
        max_reminders:Number(byId('autoMax').value)||2});
      toast('حُفظت إعدادات الأتمتة','ok');openAutomationPanel();
    }catch(e){toast(e.message,'err');btn.disabled=false;}
  };
}

async function openOrgProfile(){
  byId('taskOverlay').style.display='flex';
  byId('tkTitle').textContent='الملف التعاقدي لعلامة';
  byId('tkTabs').innerHTML='';
  byId('tkBody').innerHTML=skeleton('cards',1);
  let o={};
  try{ o=await fetchOrgProfile(true); }catch(e){
    byId('tkBody').innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>';return; }
  const miss=['cr_number','vat_number','national_address','rep_name','rep_title','contact_email','contact_phone']
    .filter(k=>!o[k]);
  byId('tkBody').innerHTML=`
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
  byId('orgSave').onclick=async()=>{
    const btn=byId('orgSave');btn.disabled=true;
    try{
      const r=await updateOrgProfile({
        legal_name:byId('orgName').value,
        cr_number:byId('orgCr').value,
        vat_number:byId('orgVat').value,
        national_address:byId('orgAddr').value,
        rep_name:byId('orgRep').value,
        rep_title:byId('orgTitle').value,
        contact_email:byId('orgEmail').value,
        contact_phone:byId('orgPhone').value});
      const n=(r&&r.contracts_refreshed)||0;
      toast(n?`حُفظ الملف — وانعكس على ${n} عقد غير موقَّع`:'حُفظ الملف التعاقدي لعلامة','ok');
      openOrgProfile();
    }catch(e){toast(e.message,'err');btn.disabled=false;}
  };
}

async function openStatusLegend(){
  byId('taskOverlay').style.display='flex';
  byId('tkTitle').textContent='دليل حالات المشاريع';
  byId('tkTabs').innerHTML='';
  byId('tkBody').innerHTML=`
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
  setState('SCREEN', 'portfolio');
  writePortfolioHash();
  $('#hProject').textContent='محفظة المشاريع';
  $('#barClient').style.display='none';hideChrome();
  const isStaff=(getState('ROLE')==='pmo'||getState('ROLE')==='delivery');
  // هيكل skeleton فوري (تجربة أسرع بصريًا)
  const skel=getState('CLIENTS').map(()=>'<div class="pcard">'+skeleton('panel',3)+'</div>').join('');
  // أدواتُ المكتب: القائمة قرارُ صلاحية، وترميزها بانٍ خالص — كلاهما في دالته.
  const toolItems=portfolioTools(getState('ROLE'),getState('IS_OWNER'));
  const toolsMenu=portfolioToolsHTML(toolItems);
  const primaryBtn=(getState('ROLE')==='pmo')?'<button class="hbtn primary-cta" id="addClientBtn">+ شريك جديد</button>':'';
  const legendBtn=isStaff?'<button class="hbtn" id="statusLegendBtn" title="دليل حالات المشاريع">ⓘ دليل الحالات</button>':'';
  const toolbar=isStaff?`<div class="portfolio-tools">${primaryBtn}${legendBtn}${toolsMenu}</div>`:'';
  $('#host').innerHTML='<div class="hintbar">اختر شريكًا لعرض لوحة مشروعه الكاملة.'+toolbar+'</div><div class="pgrid" id="pgrid">'+skel+'</div>';
  // كلُّ بندٍ في القائمة له فعلٌ في الجدول — والحارس يُطابق المجموعتين.
  for(const id in PORTFOLIO_TOOL_ACTIONS){const b=$('#'+id);if(b)b.onclick=PORTFOLIO_TOOL_ACTIONS[id];}
  {const ac=$('#addClientBtn');if(ac)ac.onclick=addNewClient;}
  {const lb=$('#statusLegendBtn');if(lb)lb.onclick=openStatusLegend;}
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

  const view={filter:getState('PFILTER'),alerts:getState('PALERTS'),
    search:getState('PSEARCH'),sort:getState('PSORT')};
  const filterBar=portfolioFilterBarHTML(companies,view);

  // تصفية المحفظة وترتيبها: قرارٌ خالص، وقد يُخفي شركاء — فله دالته.
  const shown=filterPortfolio(companies,view);
  const chipsBar=portfolioChipsHTML(portfolioActiveChips(view));

  $('#host').querySelector('.hintbar').insertAdjacentHTML('afterend',filterBar+chipsBar);
  $$('[data-filter]').forEach(b=>b.onclick=()=>{setState('PFILTER', b.dataset.filter);savePFilters();writePortfolioHash();renderPortfolio();});
  $$('[data-alertfilter]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.alertfilter; if(getState('PALERTS').has(k))getState('PALERTS').delete(k);else getState('PALERTS').add(k);
    savePFilters();writePortfolioHash();renderPortfolio();});
  const pSortEl=$('#pSort'); if(pSortEl)pSortEl.onchange=()=>{setState('PSORT', pSortEl.value);savePFilters();writePortfolioHash();renderPortfolio();};
  $$('[data-rmchip]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.rmchip;
    if(k==='status')setState('PFILTER', 'all'); else if(k==='search')setState('PSEARCH', ''); else if(k.startsWith('alert:'))getState('PALERTS').delete(k.split(':')[1]);
    savePFilters();writePortfolioHash();renderPortfolio();});
  const pClearBtn=$('#pClearAll'); if(pClearBtn)pClearBtn.onclick=()=>{setState('PFILTER', 'all');setState('PSEARCH', '');getState('PALERTS').clear();savePFilters();writePortfolioHash();renderPortfolio();};
  const sIn=$('#pSearch');
  if(sIn){ sIn.oninput=()=>{setState('PSEARCH', sIn.value); clearTimeout(sIn._t); sIn._t=setTimeout(()=>{writePortfolioHash();renderPortfolio();},300);};
    // إبقاء التركيز بعد إعادة العرض
    if(getState('PSEARCH')){ setTimeout(()=>{const el=$('#pSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0); } }

  if(!shown.length){grid.innerHTML='<div class="empty-cta"><div class="ico">🔍</div><h3>لا نتائج مطابقة</h3><p>جرّب تعديل الفلاتر أو مسحها.</p><button class="hbtn gold" id="pEmptyClear">مسح الفلاتر</button></div>';
    const pec=$('#pEmptyClear');if(pec)pec.onclick=()=>{setState('PFILTER', 'all');setState('PSEARCH', '');getState('PALERTS').clear();savePFilters();writePortfolioHash();renderPortfolio();};
    return;}
  grid.className='pcompany-grid';

  const withProj=shown.filter(x=>!x.noProjects), empty=shown.filter(x=>x.noProjects);
  const canManage=(getState('ROLE')==='pmo');
  withProj.forEach(x=>{
    const card=document.createElement('div');
    card.className='pcompany'+(x.hasAlerts?' has-alerts':'');
    card.style.cssText=`--cc:${x.c.color}`;
    card.innerHTML=portfolioCardHTML(x,canManage);
    grid.appendChild(card);
  });
  // قسم مطوي للشركاء بلا مشاريع (لا يزاحم النشط)
  if(empty.length){
    const sec=document.createElement('div');sec.className='empty-sec';
    sec.innerHTML=portfolioEmptySectionHTML(empty,getState('PEXPANDED').has('__empty'));
    grid.appendChild(sec);
    const hd=sec.querySelector('[data-emptytoggle]');
    hd.onclick=()=>{getState('PEXPANDED').has('__empty')?getState('PEXPANDED').delete('__empty'):getState('PEXPANDED').add('__empty');renderPortfolio();};
    sec.querySelectorAll('[data-newproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.newproj);});
  }

  // التفاعل: ترويسة الشركة — تفتح صفحة الشريك الموحّدة دائمًا (لوحة قيادة + مشاريعه + خططه + فريقه)
  $$('[data-toggle]').forEach(el=>el.onclick=async(e)=>{
    if(e.target.closest('[data-cmenu]'))return;
    const cid=el.dataset.toggle;
    await showScreen('clienthome', cid);
  });
  // نقرة على مشروع داخل التوسيع
  $$('[data-openproj]').forEach(el=>el.onclick=async(e)=>{
    e.stopPropagation();
    setState('CID', el.dataset.cid); setState('PID', el.dataset.openproj); await showScreen('project');
  });
  $$('[data-cmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openClientMenu(b.dataset.cmenu);});
  $$('[data-pmenu]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openProjectMenu(b.dataset.pmenu,b.dataset.pname);});
  $$('[data-addproj]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();newProjectDialog(b.dataset.addproj);});
}

// ===== تسجيل الشاشة في السجلّ (src/screens.js) =====
// المفتاح هو ما يناديه بقية التطبيق، فلا ملف شاشةٍ يعرف اسم دالة شاشةٍ أخرى.
registerScreen('portfolio', renderPortfolio);


/**
 * أدوات المكتب المتاحة لدورٍ بعينه — قرارُ صلاحية خالص، ومصدرُ حقيقةٍ واحد له.
 *
 * كان مبثوثًا داخل `renderPortfolio`، فلا يُفحَص إلا بتصيير المحفظة كاملةً
 * بـDOM وشبكة. وهو **بوابةُ صلاحية**: توسيعها خطأً يعرض أداةً على من لا يملكها،
 * وتضييقها خطأً يُخفي أداةً عمّن يملكها — وقد وقع الثاني فعلًا حين حُصر «الملف
 * التعاقدي» بالمالك وحده فاختفى عن مدير المنصّة بعد نقل الملكية.
 *
 * والقاعدة الحاكمة: بوابة الواجهة **لا تكون أضيق من سياسة القاعدة** ولا أوسع.
 */
/**
 * أدواتُ المكتب: ماذا يفعل كلُّ بند.
 *
 * وكان الربط ستةَ عشرَ سطرًا متطابقًا (`{const x=$('#id');if(x)x.onclick=…}`)
 * **منفصلًا** عن قائمة البنود في `portfolioTools`. وانفصالُهما بابُ عطبٍ صامت:
 * بندٌ يُضاف إلى القائمة بلا فعلٍ **يظهر ويُنقر ولا يحدث شيء** — لا خطأ ولا
 * رسالة ولا أثر في السجل. فصار المفتاحُ واحدًا، وعليه حارسٌ يطابق المجموعتين
 * في الاتجاهين: لا بندَ بلا فعل، ولا فعلَ بلا بند.
 */
export const PORTFOLIO_TOOL_ACTIONS = {
  showPGantt:      ()=>renderPortfolioGantt(),
  showTimeline:    ()=>showScreen('ptimeline'),
  showDOL:         openDOL,
  showAudit:       ()=>showScreen('audit'),
  showWorkload:    ()=>showScreen('workload'),
  showContractsHub:()=>showScreen('contractshub'),
  showHolidays:    openHolidaysManager,
  showArchived:    ()=>showScreen('archived'),
  showLeads:       ()=>showScreen('leads'),
  showCapacity:    openCapacityPanel,
  showOrgProfile:  openOrgProfile,
  showAutomation:  openAutomationPanel,
  showSecAudit:    openSecurityAudit,
  showTrelloSet:   ()=>openTrello('settings'),
  showStaffAccess: ()=>showScreen('staffaccess'),
};

/**
 * شريطُ الفلاتر وعدّاداته.
 *
 * والعدّادات **على مستوى الشركات لا المشاريع**: «٣ متوقفة» تعني ثلاثة شركاء
 * لدى كلٍّ منهم توقّفٌ ما، لا ثلاثة مشاريع متوقفة. والفرق يظهر عند شريكٍ له
 * مشروعان متوقفان — يُعدّ مرّةً واحدة، لأن وحدة العرض هي الشركة.
 */
export function portfolioFilterBarHTML(companies,{filter,alerts,sort,search}){
  const list=companies||[], A=alerts||new Set();
  const counts={all:list.length,
    active:list.filter(x=>x.isActive).length,
    draft:list.filter(x=>x.isDraft).length,
    blocked:list.filter(x=>x.blocked>0).length,
    reqs:list.filter(x=>x.reqs>0).length,
    comments:list.filter(x=>x.comments>0).length};
  const fbtn=(k,lbl)=>`<button class="pfilter ${filter===k?'active':''}" data-filter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const abtn=(k,lbl,cls)=>`<button class="pfilter chip-${cls} ${A.has(k)?'active':''}" data-alertfilter="${k}">${lbl} <span class="pfilter-n">${counts[k]}</span></button>`;
  const searchBox=`<input id="pSearch" class="psearch" placeholder="🔍 بحث باسم الشركة أو المشروع…" value="${esc(search||'')}">`;
  const opt=(v,lbl)=>`<option value="${v}" ${sort===v?'selected':''}>ترتيب: ${lbl}</option>`;
  const sortSel=`<select id="pSort" class="psort" aria-label="ترتيب">
    ${opt('alerts','التنبيهات أولًا')}
    ${opt('name','الاسم')}
    ${opt('progress','الأعلى تقدّمًا')}
    ${opt('projects','عدد المشاريع')}
  </select>`;
  return `<div class="pfilters-wrap">
    <div class="pfilters">
      <span class="pfacet-lbl">الحالة:</span>${fbtn('all','الكل')}${fbtn('active','نشطة')}${fbtn('draft','مسوّدة')}
      <span class="pfacet-lbl">تنبيهات:</span>${abtn('blocked','متوقفة','red')}${abtn('reqs','متطلبات','amber')}${abtn('comments','نقاش','blue')}
      ${sortSel}${searchBox}
    </div>
  </div>`;
}

/**
 * الشرائح النشطة — ما يراه المستخدم مُفعَّلًا الآن.
 *
 * ومفتاحُ كلِّ شريحة (`k`) هو **عقدُها مع زرّ الإزالة**: `status` و`search`
 * و`alert:<اسم>`. وتغييرُ حرفٍ فيه يُبقي الشريحة ظاهرةً وزرَّها بلا أثر —
 * فيبقى الفلتر مُفعَّلًا والمستخدم يظنّ أنه أزاله.
 */
export function portfolioActiveChips({filter,alerts,search}){
  const A=alerts||new Set(), chips=[];
  if(filter&&filter!=='all')chips.push({k:'status',label:(filter==='active'?'نشطة':'مسوّدة')});
  [['blocked','متوقفة'],['reqs','متطلبات'],['comments','نقاش']].forEach(([k,label])=>{
    if(A.has(k))chips.push({k:'alert:'+k,label});
  });
  if(search)chips.push({k:'search',label:'بحث: '+search});
  return chips;
}

/** ترميزُ الشرائح — وفراغُها فراغٌ، لا شريطٌ خاوٍ يشغل مكانًا. */
export function portfolioChipsHTML(chips){
  if(!chips||!chips.length)return '';
  return `<div class="pchips"><span class="pchips-lbl">مُفعّل:</span>${
    chips.map(c=>`<span class="pchip">${esc(c.label)}<button data-rmchip="${c.k}" aria-label="إزالة الفلتر">✕</button></span>`).join('')
  }<button class="pchips-clear" id="pClearAll">مسح الكل</button></div>`;
}

/**
 * بطاقةُ الشريك.
 *
 * وسطرُها الفرعيّ ثلاثُ حالاتٍ لا اثنتان: بلا مشاريع ⇦ دعوةٌ لإضافة أوّلها؛
 * ومشروعٌ واحد ⇦ **اسمُه** لا عددُه؛ وأكثر ⇦ العدد. فالشريك ذو المشروع الواحد
 * يُعرَف بمشروعه، ولا يُقال له «١ مشاريع».
 */
export function portfolioCardHTML(x,canManage){
  const badges=[];
  if(x.blocked>0)badges.push(`<span class="palert red">${x.blocked} متوقف</span>`);
  if(x.reqs>0)badges.push(`<span class="palert amber">${x.reqs} متطلب</span>`);
  if(x.comments>0)badges.push(`<span class="palert blue">${x.comments} نقاش</span>`);
  const actBtn=canManage?`<button class="pcard-menu" data-cmenu="${x.cid}" title="إجراءات" aria-label="إجراءات الشريك">${I.dots}</button>`:'';
  const sub=x.noProjects?'لا مشاريع بعد — انقر لإضافة أول مشروع'
    :(x.list.length>1?x.list.length+' مشاريع':esc(x.list[0].project_name||'مشروع واحد'))+' · '+x.tot+' بند';
  return `
      <div class="pcompany-hd" data-toggle="${x.cid}" role="button" tabindex="0">
        <div class="pcv-top">
          <span class="pdot" style="background:${x.c.color}" title="لون تعريفي لهذا الشريك — يُستخدم لتمييزه في «الخط الزمني الشامل» وأي عرض مجمَّع آخر"></span>
          <h3>${esc(x.c.name)}</h3>
          ${actBtn}
        </div>
        <span class="pcompany-sub">${sub}</span>
        ${x.noProjects?'':renderStatusBadge(worstProjectStatus(x.list))}
        ${x.noProjects?'':`<div class="pcompany-pct"><div class="pbar mini" role="progressbar" aria-valuenow="${x.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة الإنجاز"><div class="pbar-fill" style="width:${x.pct}%"></div></div><b>${x.pct}%</b></div>`}
        ${badges.length?`<div class="palerts">${badges.join('')}</div>`:''}
      </div>
    `;
}

/** قسمُ الشركاء بلا مشاريع — مطويٌّ كي لا يزاحم النشط. */
export function portfolioEmptySectionHTML(empty,open){
  const list=empty||[];
  return `<button class="empty-sec-hd" data-emptytoggle="1" aria-expanded="${!!open}">
        <span class="es-chev">${open?'▴':'▾'}</span> شركاء بلا مشاريع <span class="es-n">${list.length}</span>
        <span class="es-hint">جاهزون لإضافة أول مشروع</span></button>
      <div class="empty-sec-body" style="display:${open?'flex':'none'}">
        ${list.map(x=>`<button class="ecard" data-newproj="${x.cid}" style="--cc:${x.c.color}">
          <span class="edot"></span><b>${esc(x.c.name)}</b><span class="eadd">+ أول مشروع</span></button>`).join('')}
      </div>`;
}

export function portfolioTools(role,isOwner){
  const toolItems=[];
  const isStaff=(role==='pmo'||role==='delivery');
  if(isStaff){
    toolItems.push({g:'عروض شاملة',id:'showPGantt',t:'الخط الزمني الشامل',i:'📅'});
    toolItems.push({g:'عروض شاملة',id:'showTimeline',t:'خط التسليمات الشامل',i:'📦'});
    toolItems.push({g:'عروض شاملة',id:'showDOL',t:'طبقة القرار (DOL)',i:'⚖'});
    toolItems.push({g:'إدارة',id:'showAudit',t:'سجل المكتب',i:'📋'});
    toolItems.push({g:'عروض شاملة',id:'showWorkload',t:'حِمل العمل',i:'📊'});
  toolItems.push({g:'إدارة',id:'showContractsHub',t:'إدارة العقود',i:'✍️'});
  }
  if(role==='pmo'){
    toolItems.push({g:'إعدادات',id:'showHolidays',t:'العطلات الرسمية',i:'🗓'});
    toolItems.push({g:'إدارة',id:'showArchived',t:'المؤرشفة',i:'🗄'});
    toolItems.push({g:'إدارة',id:'showLeads',t:'الشركاء المحتملون',i:'👥'});
  }
  // الملف التعاقدي لعلامة: متاح لمالك المنصة ومديرها معًا — مطابقًا لسياسة القاعدة
  // (pmo_update_org_profile تسمح لكليهما). كان محصورًا بالمالك في الواجهة فقط، فاختفى
  // عن مدير المنصة بعد نقل الملكية رغم امتلاكه الصلاحية فعليًا.
  if(isOwner||role==='pmo'){toolItems.push({g:'إعدادات',id:'showCapacity',t:'الأقسام والمسمّيات',i:'👥'});
    toolItems.push({g:'إعدادات',id:'showOrgProfile',t:'الملف التعاقدي لعلامة',i:'🏢'});
    toolItems.push({g:'إعدادات',id:'showAutomation',t:'أتمتة العقود',i:'⚡'});
    toolItems.push({g:'إعدادات',id:'showSecAudit',t:'فحص أمني',i:'🛡'});}
  if(isOwner){toolItems.push({g:'إعدادات',id:'showTrelloSet',t:'إعدادات Trello',i:'🔗'});
    toolItems.push({g:'إعدادات',id:'showStaffAccess',t:'صلاحيات الفريق',i:'🔐'});}
  return toolItems;
}

/** ترميز قائمة الأدوات — مجمَّعةً بعناوين: عروض · إدارة · إعدادات. */
export function portfolioToolsHTML(toolItems){
  if(!toolItems.length)return '';
  return `<div class="tools-wrap">
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
  </div>`;
}


/**
 * تصفية المحفظة وترتيبها — قرارٌ خالص: شركاتٌ ومرشِّح ⇦ شركاتٌ مرتَّبة.
 *
 * وثلاثة مرشِّحات تُدمج لا تتبادل: الحالة (نشطة/مسوّدة) · التنبيهات (متوقفة ·
 * متطلبات · نقاش، وهي **مجموعة** فقد تُختار معًا) · البحث. وخطأٌ في أيٍّ منها
 * **يُخفي شركاء بلا رسالة** — وهو أخطر ما في شاشة المحفظة، لأن غياب شريكٍ لا
 * يُرى؛ يُرى فقط بعدم رؤيته.
 *
 * والبحث يشمل اسم الشركة **واسم أي مشروع لها** — فمن يبحث باسم مشروعٍ يجد
 * شريكه، وهو ما يفعله المستخدم فعلًا.
 *
 * @param {{filter:string,alerts:Set<string>,search:string,sort:string}} o
 */
export function filterPortfolio(companies,{filter,alerts,search,sort}){
  const shown=companies.filter(x=>{
    if(filter==='active'&&!x.isActive)return false;
    if(filter==='draft'&&!x.isDraft)return false;
    if(alerts.has('blocked')&&!(x.blocked>0))return false;
    if(alerts.has('reqs')&&!(x.reqs>0))return false;
    if(alerts.has('comments')&&!(x.comments>0))return false;
    if(search){
      const q=search.trim();
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
  shown.sort(sorters[sort]||sorters.alerts);
  return shown;
}
