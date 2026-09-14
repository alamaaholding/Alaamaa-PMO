// ===== app/contractsign.js — العقود والتوقيع الإلكتروني =====
// مبدأ الأمان: الجداول مغلقة تمامًا عن anon على مستوى RLS؛ كل تفاعل عام يمرّ حصرًا عبر
// دوال SECURITY DEFINER محكومة بالرمز العشوائي في الرابط — لا وصول مباشر للجداول أبدًا.

// ===== لوحة توقيع بسيطة: رسم باللمس/الفأرة + خيار كتابة الاسم بدلًا من الرسم =====//
// ═══ وحدة ESM (الموجة W2) ═══
// تبعيتها الأخيرة كانت `buildContractDoc` — تحوّلت في الدفعة قبل السابقة،
// و`renderContractsHub` صارت `showScreen('contractshub')`. فبلغت الصفر.

import { computeContractHash, fetchContractsForProject, fetchPublicContract, fetchUnlinkedClientContracts, linkContractToProject, requestSigningOTP, signContractAsStaff, signContractPublic, unlinkContractFromProject, voidContract } from '../api.js';
import { esc } from '../format.js';
import { showScreen } from '../screens.js';
import { skeleton } from '../skeleton.js';
import { toast } from '../toast.js';
import { mergeContract, renderCustomContractHTML, renderMergedContractHTML } from './contracttemplate.js';
import { confirmDialog } from './dialogs.js';
import { buildContractDoc } from './exportcontract.js';
import { getState } from './state.js';
import { $$, byId } from '../config.js';
export function mountSignaturePad(container){
  container.innerHTML=`
    <div class="sig-tabs">
      <button type="button" class="sig-tab active" data-sigmode="draw">ارسم توقيعك</button>
      <button type="button" class="sig-tab" data-sigmode="type">اكتب اسمك بدل الرسم</button>
    </div>
    <div id="sigDrawWrap"><canvas id="sigCanvas" width="480" height="160"></canvas>
      <button type="button" class="reqbtn mt-6" id="sigClear">مسح</button></div>
    <div id="sigTypeWrap" class="is-hidden">
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
    container.querySelector('#sigDrawWrap').classList.toggle('is-hidden',!draw);
    container.querySelector('#sigTypeWrap').classList.toggle('is-hidden',draw);
  });
  return {
    getData(){
      const typed=container.querySelector('#sigTypeName').value.trim();
      const typeMode=!container.querySelector('#sigTypeWrap').classList.contains('is-hidden');
      if(typeMode)return typed?{ok:true,data:null,typed}:{ok:false};
      return hasDrawn?{ok:true,data:canvas.toDataURL('image/png'),typed:null}:{ok:false};
    }
  };
}

// ===== المسار العام: بلا تسجيل دخول =====
export async function renderPublicSign(token){
  byId('login').classList.add('hidden');
  byId('app').classList.add('hidden');
  const root=byId('publicSign');
  root.classList.remove('hidden');
  root.innerHTML=`<div class="pubsign-wrap"><div class="pubsign-card">${skeleton('panel',1)}
    ${skeleton('cards',1)}</div></div>`;

  let d;
  try{ d=await fetchPublicContract(token); }
  catch(e){ return pubSignError('تعذّر تحميل العقد. تحقّق من الرابط أو حاول لاحقًا.'); }
  // بوابةُ العرض العام: خمسة أسبابٍ للمنع، ولكلٍّ منها رسالته. القرار في دالته.
  const gate=publicSignGate(d);
  if(gate) return pubSignError(gate.message,gate.signIn);

  const clientSigned=(d.signatures||[]).some(s=>s.party==='client');
  const alamaaSig=(d.signatures||[]).find(s=>s.party==='alamaa');
  const clientSig=(d.signatures||[]).find(s=>s.party==='client');
  const fullySigned=d.status==='signed';
  const isCustom=d.contract_type==='custom';

  const mergeData={
    clientName:d.client_name,clientCr:d.client_cr,clientVat:d.client_vat,org:d.org||{},clientAddress:d.client_address,
    clientRepName:d.client_rep_name,clientRepTitle:d.client_rep_title,
    includesAdSpend:d.includes_ad_spend,effectiveDate:d.effective_date,contractValue:d.contract_value,latePaymentCap:d.late_payment_cap,
    specialTerms:d.special_terms
  };
  const customData={title:d.custom_title,body:d.custom_body,clientName:d.client_name,clientCr:d.client_cr,clientVat:d.client_vat,org:d.org||{},
    clientAddress:d.client_address,clientRepName:d.client_rep_name,clientRepTitle:d.client_rep_title};
  // النص المختوم أولًا دائمًا — هو ما التزم به الطرفان فعليًا. لا يُعاد توليده من القالب
  // مهما عُدِّل لاحقًا، فما يراه الشريك ويوقّع عليه هو ما خُتم بالضبط.
  const contractHtml=d.sealed_body
    ? (d.sealed_body.kind==='custom'
        ? renderCustomContractHTML(d.sealed_body)
        : renderMergedContractHTML(d.sealed_body))
    : (isCustom?renderCustomContractHTML(customData):renderMergedContractHTML(mergeContract(mergeData)));
  let integrityBadge='';
  if(d.document_hash&&!isCustom){
    try{
      const nowHash=await computeContractHash(mergeData);
      integrityBadge=nowHash===d.document_hash?'':'<div class="ctr-integrity warn">⚠ تنبيه: النص أدناه يختلف عمّا كان وقت إنشاء هذا العقد — تواصل مع علامة قبل التوقيع.</div>';
    }catch(e){}
  }

  byId('publicSign').innerHTML=publicSignHTML(d,{contractHtml,integrityBadge,
    alamaaSig,clientSig,clientSigned,fullySigned});
  bindPublicSign(token);
}
/**
 * ترميزُ صفحة التوقيع العامّة — **الشاشة الوحيدة خارج تسجيل الدخول**.
 *
 * وثلاثةُ فروقٍ فيها تُقرأ من الحالة لا من الصلاحية، لأن قارئها بلا حساب:
 *
 *   موقَّعٌ بالكامل ⇦ اطّلاعٌ ونسبةُ إنجاز، بلا حقول
 *   وقّع الشريك    ⇦ انتظارُ علامة، والنصُّ **مطويّ** (قرأه فعلًا)
 *   لم يوقّع       ⇦ النصُّ **مفتوح** بالضرورة، ثم حقولُ التوقيع
 *
 * والطيُّ ليس زينة: من لم يوقّع بعد يجب أن يرى النصّ مفتوحًا أمامه.
 */
export function publicSignHTML(d,{contractHtml,integrityBadge,alamaaSig,clientSig,clientSigned,fullySigned}){
  const sigRow=(label,s)=>s?`<div class="pubsig-row"><b>${label}</b><span>${esc(s.name)} · ${new Date(s.signed_at).toLocaleString('ar')}</span></div>`
    :`<div class="pubsig-row pubsig-pending"><b>${label}</b><span>بانتظار التوقيع</span></div>`;
  return `
    <div class="pubsign-wrap"><div class="pubsign-card">
      <div class="pubsign-brand">علامة <span>· أثر دائم</span></div>
      <h2>${fullySigned?'العقد موقَّع من الطرفين':'توقيع العقد'}</h2>
      <div class="pubsign-meta">
        <div><b>الشريك</b><span>${esc(d.client_name)}</span></div>
        ${d.project_name?`<div><b>المشروع</b><span>${esc(d.project_name)}</span></div>`:''}
        ${d.baseline_label?`<div><b>اللقطة المرجعية</b><span>${esc(d.baseline_label)} — ${new Date(d.baseline_date).toLocaleDateString('ar')}</span></div>`:''}
      </div>
      <div class="pubsig-status">${sigRow('علامة',alamaaSig)}${sigRow('الشريك',clientSig)}</div>
      ${integrityBadge}
      ${(d.attachments&&d.attachments.length)?`
      <div class="pubsign-attach">
        <b>📎 ملاحق مرفقة بهذا العقد</b>
        ${d.attachments.map(a=>`<div class="chd-att-row"><span>📄 ${esc(a.label)}</span>${
          a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener" class="reqbtn">فتح</a>`:''}</div>`).join('')}
      </div>`:''}
      <details class="pubsign-fulltext" ${clientSigned?'':'open'}>
        <summary>${clientSigned?'عرض نص العقد الكامل':'📄 اقرأ نص العقد كاملًا قبل التوقيع'}</summary>
        ${contractHtml}
      </details>
      ${fullySigned?`
        <p class="pubsign-note">✅ عقد ساري ومكتمل التوقيع من الطرفين — هذه النسخة للاطّلاع فقط ولا يمكن التعديل عليها.</p>
        <div class="pubsign-progress">
          <div><b>نسبة إنجاز المشروع حتى الآن</b><span>${d.progress_pct}%</span></div>
          <div class="trk-bar"><div class="trk-bar-fill ok-fill" style="--pct:${d.progress_pct}%"></div></div>
        </div>
        <button class="hbtn pubsign-cta" id="pubGoLogin">
          لرؤية تفاصيل سير العمل الكاملة — سجّل الدخول
        </button>`
      :(clientSigned?`<p class="pubsign-note">وقّعتَ بالفعل — بانتظار توقيع علامة لإكمال العقد.</p>`:`
        <div class="sa-section pubsign-signbox">
          <h4 class="mb-10">التوقيع</h4>
          <input id="pubName" placeholder="الاسم الكامل *" class="pubsign-input gap-sm">
          <input id="pubEmail" type="email" placeholder="البريد الإلكتروني (اختياري)" class="pubsign-input gap-md">
          ${d.client_contact_email?`
          <div class="pub-otp">
            <b>🔐 تحقق من هويتك</b>
            <p class="sa-hint pub-otp-hint">سيصلك رمز من ست خانات على بريد جهة الاتصال المسجَّلة لدينا. لا يُرسَل لأي بريد آخر.</p>
            <div class="row-8 fx-wrap">
              <button class="reqbtn" id="pubOtpSend">إرسال رمز التحقق</button>
              <input id="pubOtp" inputmode="numeric" maxlength="6" placeholder="------" dir="ltr"
                style="flex:1;min-width:120px;border:1.5px solid var(--line);border-radius:8px;padding:10px;
                       font-family:monospace;font-size:1.1rem;letter-spacing:6px;text-align:center">
            </div>
            <div id="pubOtpMsg"></div>
          </div>`:''}
          <div id="pubSigPad"></div>
          <button class="hbtn pubsign-cta tight" id="pubSignBtn">أوافق وأوقّع</button>
          <p class="pubsign-legal">بالضغط على «أوافق وأوقّع»، أنت تقرّ بموافقتك على محتوى هذا العقد كما هو معروض أعلاه.
            سيُسجَّل اسمك ووقت التوقيع كتوثيق لهذه الموافقة.</p>
        </div>`)}
    </div></div>`;
}

/**
 * رسالةُ فشل التوقيع — لكل رمزٍ رسالتُه، **ولا رمزَ يمرّ بلا رسالة**.
 *
 * وقارئُ هذه الصفحة بلا حساب ولا سجلّ ولا أحدٍ يسأله: الرسالة هي كلُّ ما بين
 * يديه. فرمزٌ مجهول يُترجَم إلى «تعذّر التوقيع» لا إلى فراغ.
 *
 * و`otp_wrong` وحده يحمل عددًا: المحاولاتُ الباقية. وغيابُه لا يُنتج
 * «بقيت undefined محاولات».
 */
export function signFailureMessage(r){
  const msgs={already_signed:'تم توقيع هذا العقد من قبل الشريك بالفعل.',
    archived:'انتهت صلاحية هذا الرابط.',void:'أُلغي هذا العقد.',name_required:'الاسم مطلوب.',
    not_sealed:'العقد غير جاهز للتوقيع بعد — تواصل مع علامة.',
    otp_required:'أرسل رمز التحقق لبريدك ثم أدخله قبل التوقيع.',
    otp_expired:'انتهت صلاحية الرمز — اطلب رمزًا جديدًا.',
    otp_locked:'تجاوزت عدد المحاولات — اطلب رمزًا جديدًا.',
    otp_wrong:'الرمز غير صحيح'+(r&&r.left!=null?` — بقيت ${r.left} محاولات`:'')+'.'};
  return msgs[r&&r.error]||'تعذّر التوقيع';
}

/** ربطُ حقول الصفحة: رمزُ التحقق، ولوحةُ التوقيع، والإرسال. */
function bindPublicSign(token){
  const golf=byId('pubGoLogin');if(golf)golf.onclick=()=>{location.hash='';location.reload();};
  {const ob=byId('pubOtpSend');
   if(ob)ob.onclick=async()=>{
     const msg=byId('pubOtpMsg');
     ob.disabled=true;const t0=ob.textContent;ob.textContent='جارٍ الإرسال...';
     try{
       const r=await requestSigningOTP(token);
       msg.innerHTML='<div class="ctr-integrity ok otp-msg">✅ أُرسل الرمز إلى '+esc(r.masked||'بريدك المسجَّل')+' — صالح لعشر دقائق</div>';
       let left=45;ob.textContent='إعادة الإرسال ('+left+')';
       const tick=setInterval(()=>{left--;if(left<=0){clearInterval(tick);ob.disabled=false;ob.textContent=t0;}
         else ob.textContent='إعادة الإرسال ('+left+')';},1000);
     }catch(e){
       msg.innerHTML='<div class="ctr-integrity warn otp-msg">⚠ '+esc(e.message)+'</div>';
       ob.disabled=false;ob.textContent=t0;
     }
   };}
  const pad=byId('pubSigPad');
  if(pad){
    const sig=mountSignaturePad(pad);
    byId('pubSignBtn').onclick=async()=>{
      const name=byId('pubName').value.trim();
      const email=byId('pubEmail').value.trim();
      if(!name){toast('الاسم مطلوب','warn');return;}
      const s=sig.getData();
      if(!s.ok){toast('يرجى التوقيع (رسمًا أو كتابة الاسم) قبل المتابعة','warn');return;}
      const btn=byId('pubSignBtn');btn.disabled=true;btn.textContent='جارٍ الحفظ...';
      try{
        const otpEl=byId('pubOtp');
        const r=await signContractPublic(token,name,email,s.data||('نصي: '+s.typed),otpEl?otpEl.value.trim():null);
        if(r&&r.ok){toast('تم توثيق توقيعك بنجاح','ok');renderPublicSign(token);}
        else{
          toast(signFailureMessage(r),'err');btn.disabled=false;btn.textContent='أوافق وأوقّع';
        }
      }catch(e){toast('تعذّر التوقيع: '+e.message,'err');btn.disabled=false;btn.textContent='أوافق وأوقّع';}
    };
  }
}

function pubSignError(msg,withLogin){
  byId('publicSign').innerHTML=`<div class="pubsign-wrap"><div class="pubsign-card pubsign-err">
    <div class="pubsign-brand">علامة <span>· أثر دائم</span></div>
    <p class="pubsign-lead">${esc(msg)}</p>
    ${withLogin?`<button class="hbtn ct-err-login" id="pubErrLogin">تسجيل الدخول</button>`:''}
  </div></div>`;
  const b=byId('pubErrLogin');if(b)b.onclick=()=>{location.hash='';location.reload();};
}

// ===== لوحة التحكم الداخلية: من داخل المشروع (موظف) — تُعاد استخدام نافذة taskOverlay =====
export async function openContractPanel(){
  if(!getState('PROJECT')){toast('افتح المشروع أولًا','warn');return;}
  if(!getState('PROJECT').baselines||!getState('PROJECT').baselines.length){toast('لا توجد لقطة (Baseline) بعد — ثبّت أساسًا أولًا','warn');return;}
  byId('taskOverlay').style.display='flex';
  byId('tkTitle').textContent='عقود المشروع والتوقيع';
  byId('tkTabs').innerHTML='';
  byId('tkBody').innerHTML=skeleton('cards',1);
  await refreshContractPanel();
}
async function refreshContractPanel(){
  let list;
  try{ list=await fetchContractsForProject(getState('PROJECT')._dbId); }
  catch(e){ byId('tkBody').innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>'; return; }
  const clientC=getState('CLIENTS').find(x=>x.id===getState('CID'))||{};
  const rows=list.map(c=>projectContractRowHTML(c,{
    clientName:clientC.name,clientEmail:clientC.contact_email,projectName:getState('PROJECT').name,
  })).join('')||'<p class="empty">لا عقود بعد.</p>';

  byId('tkBody').innerHTML=`
    <div class="sa-section mb-14">
      <h4>عقود هذا المشروع <span class="sa-hint">العقد كيان مستقل في محفظة العقود — اربط عقدًا قائمًا بدل إنشاء واحد جديد في كل مرة</span></h4>
      <div class="row-8 fx-wrap">
        <button class="hbtn gold" id="ctLinkExisting">🔗 ربط عقد قائم بهذا المشروع</button>
        <button class="reqbtn" id="ctGoHub">+ إنشاء عقد جديد (إدارة العقود)</button>
      </div>
      <div id="ctLinkPicker" class="is-hidden stack-gap-lg"></div>
    </div>
    ${rows}
    <div id="ctSignArea"></div>`;

  bindProjectContracts(list,clientC);
}


/** حالاتُ العقد بالعربية — مصدرٌ واحد لصفّ المشروع. */
const STL={draft:'مسودة',pending_alamaa:'بانتظار توقيع علامة',pending_client:'بانتظار توقيع الشريك',signed:'موقَّع بالكامل ✅',void:'ملغى'};

/**
 * صفُّ عقدٍ مرتبطٍ بمشروع.
 *
 * وأزرارُه ليست ثابتة: **«توقيع علامة» يظهر ما لم توقّع علامة بعد**،
 * و**«إلغاء العقد» يختفي عن الموقَّع والملغى** — فالموقَّع مرجعٌ قانونيّ ساري.
 * وبقيّةُ الأزرار تظهر دائمًا لأنها لا تُغيّر حالة.
 *
 * وسياقُ الشريك والمشروع يُمرَّر ولا يُقرأ من الحالة العامّة: البانيةُ تُختبَر
 * بلا شاشةٍ ولا حالة.
 */
export function projectContractRowHTML(c,{clientName,clientEmail,projectName}){

  const al=c.signatures.find(s=>s.party==='alamaa'),cl=c.signatures.find(s=>s.party==='client');
  const link=location.origin+location.pathname+'#/sign/'+c.token;
  const mailHref=signInviteMailto(clientEmail||'',projectName,link);
  return `<div class="ct-row">
    <div class="ct-row-hd">
      <b>${esc(c.baseline_label)}</b><span class="crstate ${c.status==='signed'?'approved':(c.status==='void'?'rejected':'pending')}">${STL[c.status]||c.status}</span>
    </div>
    <div class="sa-hint ct-row-sub">علامة: ${al?esc(al.name)+' — '+new Date(al.signed_at).toLocaleDateString('ar'):'لم توقّع بعد'}
      · الشريك: ${cl?esc(cl.name)+' — '+new Date(cl.signed_at).toLocaleDateString('ar'):'لم يوقّع بعد'}
      · ${c.includes_ad_spend?'يشمل إنفاقًا إعلانيًا':'بلا إنفاق إعلاني'}${c.contract_value?' · '+Number(c.contract_value).toLocaleString('ar')+' ر.س':''}</div>
    <div class="ctr-link-badge">🔒 الرابط والرمز أدناه خاصّان بـ<b>${esc(clientName||'هذا الشريك')}</b> حصرًا — لتوقيع هذا العقد تحديدًا، لا يصلح لغيره</div>
    <div class="ct-row-acts">
      <input readonly value="${link}" class="ct-link-field">
      <button class="reqbtn" data-copylink="${link}">نسخ الرابط</button>
      <a class="reqbtn ct-mail-btn" href="${mailHref}">📧 إرسال بالبريد</a>
      <button class="reqbtn" data-exportqr="${c.id}">📄 تصدير PDF بـ QR (العقد كاملًا + الخطة)</button>
      <button class="reqbtn" data-viewtext="${c.id}">عرض نص العقد الكامل</button>
      ${!al?`<button class="reqbtn ok" data-signalamaa="${c.id}">توقيع علامة الآن</button>`:''}
      ${(c.status!=='signed'&&c.status!=='void')?`<button class="reqbtn" data-voidcontract="${c.id}" class="reqbtn ct-void-btn">🗑 إلغاء العقد</button>`:''}
      <button class="reqbtn" data-unlink="${c.id}">🔓 فك الارتباط بهذا المشروع</button>
    </div>
    <div id="ctText-${c.id}" class="is-hidden stack-gap"></div>
  </div>`;
}

/**
 * مُنتقي العقود غير المرتبطة.
 *
 * و`has_client` فارقٌ يُقال صراحةً: عقدٌ **بلا شريك** أصلًا (🆓) غيرُ عقدٍ
 * لشريكٍ لم يُربَط بمشروع. وبينهما فرقٌ في ما يحدث عند الربط.
 */
export function unlinkedContractsHTML(list){
  return (list||[]).map(u=>`
    <div class="ct-pick-row">
      <div><span class="chub-num">${esc(u.contract_number||'—')}</span> <b>${esc(u.contract_name||u.custom_title||'عقد بلا اسم')}</b>
        <span class="sa-hint">${u.contract_value?' · '+Number(u.contract_value).toLocaleString('ar')+' ر.س':''}${u.internal_approved?' · ✅ معتمد':' · ⏳ بانتظار الاعتماد'}${u.has_client?'':' · 🆓 عقد مستقل بلا شريك'}</span></div>
      <button class="reqbtn" data-linkbl="${u.id}">ربط بهذا المشروع</button>
    </div>`).join('');
}

/** ربطُ أزرار عقود المشروع — نسخٌ وتصديرٌ وتوقيعٌ وإلغاءٌ وفكُّ ارتباط. */
function bindProjectContracts(list,clientC){
  byId('ctGoHub').onclick=()=>showScreen('contractshub');
  byId('ctLinkExisting').onclick=async()=>{
    const picker=byId('ctLinkPicker');
    const show=picker.classList.contains('is-hidden');
    picker.classList.toggle('is-hidden',!show);
    if(!show)return;
    picker.innerHTML=skeleton('list',1);
    let unlinked;
    try{ unlinked=await fetchUnlinkedClientContracts(getState('CID')); }
    catch(e){ picker.innerHTML='<p class="empty">تعذّر التحميل: '+esc(e.message)+'</p>'; return; }
    if(!unlinked.length){
      picker.innerHTML='<p class="sa-hint">لا عقود غير مرتبطة لهذا الشريك حاليًا. أنشئ عقدًا جديدًا بنطاق «الشريك كاملًا» من إدارة العقود، ثم اربطه هنا لاحقًا.</p>';
      return;
    }
    picker.innerHTML=unlinkedContractsHTML(unlinked);
    $$('[data-linkbl]').forEach(b=>b.onclick=async()=>{
      const blSel=getState('PROJECT').baselines[getState('PROJECT').baselines.length-1];
      if(!blSel){toast('لا توجد لقطة (Baseline) لهذا المشروع','warn');return;}
      try{
        const r=await linkContractToProject(b.dataset.linkbl,getState('PROJECT')._dbId,blSel.id);
        if(r&&r.ok){toast('رُبط العقد بهذا المشروع','ok');await refreshContractPanel();}
        else toast((r&&r.error)||'تعذّر الربط','err');
      }catch(e){toast('تعذّر الربط: '+e.message,'err');}
    });
  };
  $$('[data-viewtext]').forEach(b=>b.onclick=async()=>{
    const c=list.find(x=>x.id===b.dataset.viewtext);
    const box=byId('ctText-'+c.id);
    const show=box.classList.contains('is-hidden');
    box.classList.toggle('is-hidden',!show);
    if(!show)return;
    const mergeData={
      clientName:clientC.name,clientCr:c.client_cr,clientAddress:c.client_address,clientRepName:c.client_rep_name,
      clientRepTitle:c.client_rep_title,clientEmail:c.client_contact_email,clientPhone:c.client_contact_phone,
      includesAdSpend:c.includes_ad_spend,effectiveDate:c.effective_date,contractValue:c.contract_value,latePaymentCap:c.late_payment_cap
    };
    let integrityBadge='';
    if(c.document_hash){
      try{
        const nowHash=await computeContractHash(mergeData);
        integrityBadge=nowHash===c.document_hash
          ?'<div class="ctr-integrity ok">✅ النص مطابق تمامًا لما وُقِّع عليه — لم يتغيّر إطلاقًا منذ الإنشاء</div>'
          :'<div class="ctr-integrity warn">⚠ النص المعروض يختلف عمّا كان وقت الإنشاء (على الأرجح تحديث لاحق في نظام القالب) — راجع مع الإدارة قبل الاعتماد عليه كمرجع نهائي</div>';
      }catch(e){}
    }
    box.innerHTML=integrityBadge+renderMergedContractHTML(mergeContract(mergeData));
  });
  $$('[data-voidcontract]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('إلغاء العقد','سيصبح هذا العقد ملغى ولا يمكن توقيعه بعد الآن. لا يمكن التراجع عن هذا الإجراء.',true,'إلغاء العقد'))return;
    try{
      const r=await voidContract(b.dataset.voidcontract);
      if(r&&r.ok){toast('أُلغي العقد','ok');await refreshContractPanel();}
      else toast(r&&r.error==='already_signed'?'لا يمكن إلغاء عقد موقَّع بالكامل':'تعذّر الإلغاء','err');
    }catch(e){toast('تعذّر الإلغاء: '+e.message,'err');}
  });

  $$('[data-unlink]').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('فك الارتباط','سيبقى العقد موجودًا في محفظة العقود، لكنه لن يظهر هنا كمرتبط بهذا المشروع بعد الآن. يمكن ربطه بمشروع آخر لاحقًا.',false,'فك الارتباط'))return;
    try{
      const r=await unlinkContractFromProject(b.dataset.unlink);
      if(r&&r.ok){toast('فُكّ الارتباط — العقد لا يزال في محفظة العقود','ok');await refreshContractPanel();}
      else toast((r&&r.error)||'تعذّر فك الارتباط','err');
    }catch(e){toast('تعذّر فك الارتباط: '+e.message,'err');}
  });
  $$('[data-copylink]').forEach(b=>b.onclick=async()=>{
    try{await navigator.clipboard.writeText(b.dataset.copylink);toast('نُسخ الرابط','ok');}
    catch(e){toast('انسخ الرابط يدويًا من الحقل','warn');}
  });
  $$('[data-exportqr]').forEach(b=>b.onclick=async()=>{
    const c=list.find(x=>x.id===b.dataset.exportqr);
    if(!c){toast('العقد غير موجود','err');return;}
    b.disabled=true;const old=b.textContent;b.textContent='جارٍ التحضير...';
    try{ await buildContractDoc(c.baseline_id,c); }
    catch(e){ toast('تعذّر التصدير: '+e.message,'err'); }
    b.disabled=false;b.textContent=old;
  });
  $$('[data-signalamaa]').forEach(b=>b.onclick=()=>{
    const cid=b.dataset.signalamaa;
    const area=byId('ctSignArea');
    area.innerHTML='<div class="sa-section"><h4>توقيع علامة</h4><input id="ctStaffName" placeholder="اسمك الكامل" class="ct-staff-name"><div id="ctStaffPad"></div><button class="hbtn ct-staff-sign" id="ctStaffSign">توقيع وتأكيد</button></div>';
    const sig=mountSignaturePad(byId('ctStaffPad'));
    byId('ctStaffSign').onclick=async()=>{
      const name=byId('ctStaffName').value.trim();
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


/**
 * بوابةُ صفحة التوقيع العامة — ما يراه الشريك قبل أن يرى العقد.
 *
 * هذه **الشاشة الوحيدة خارج تسجيل الدخول**، وحارسها الرمز العشوائي في الرابط.
 * فرسائلها ليست تفاصيل واجهة: من يفتح رابطًا منتهيًا يجب أن يعرف أن عليه طلب
 * رابطٍ جديد، ومن يفتح عقدًا لم يُعتمَد بعد يجب ألّا يظنّه ضائعًا.
 *
 * وترتيب البوابات مقصود: انتهاء الصلاحية يسبق «غير صالح» — فرابطٌ منتهٍ يُرَدّ
 * برسالته الخاصّة لا برسالة الرابط الخاطئ، وهما تجربتان مختلفتان تمامًا.
 *
 * @returns {null|{message:string,signIn?:boolean}} `null` يعني: اعرِض العقد.
 */
export function publicSignGate(d){
  if(d&&d.error==='link_expired')
    return {message:'انتهت صلاحية هذا الرابط. تواصل مع علامة لإرسال رابط جديد — سيصلك خلال دقائق.'};
  if(!d||!d.ok)
    return {message:d&&d.error==='not_found'?'هذا الرابط غير صالح.':'تعذّر عرض هذا العقد حاليًا.'};
  // المؤرشف وحده يُعرَض معه مدخل تسجيل الدخول: البيانات موجودة لكنها لم تعد عامّة.
  if(d.archived)
    return {message:'انتهت صلاحية هذا الرابط العام — المشروع مؤرشف الآن. لعرض التفاصيل، سجّل الدخول من داخل المنصة.',signIn:true};
  if(!d.internal_approved)
    return {message:'هذا العقد قيد المراجعة الداخلية من فريق علامة ولم يُعتمَد بعد للإرسال — يُرجى المحاولة لاحقًا أو التواصل مع من أرسل لك هذا الرابط.'};
  return null;
}


/**
 * رابط `mailto:` لدعوة الشريك إلى التوقيع — بانٍ خالص.
 *
 * ونصُّه **يخرج من المنصّة إلى بريد شريك**، فهو أوضح ما فيه أثرًا: يَعِد بأن
 * الرابط خاصٌّ به حصرًا، وبأنه لا يحتاج حسابًا. وكان مبثوثًا داخل حلقة تصيير.
 *
 * والترميز مرّتان بالضرورة: مرةً لكل حقلٍ (الموضوع والمتن) لأن `mailto` يفصل
 * حقولها بـ`&`، ومرةً للبريد نفسه. وسطرٌ جديدٌ غير مُرمَّز يقطع المتن عند أول
 * فاصلة — وهو عطلٌ لا يظهر إلا في بريد المستلم.
 */
export function signInviteMailto(toEmail,projectName,link){
  const subject=encodeURIComponent('عقد '+projectName+' — علامة');
  const body=encodeURIComponent(
    `تحية طيبة،\n\nنرفق رابط خاص بكم حصرًا لتوقيع عقد مشروع «${projectName}» إلكترونيًا (لا يُستخدم لغير هذا الغرض):\n${link}\n\nيمكنكم فتح الرابط والاطّلاع على نص العقد كاملًا ثم التوقيع مباشرة، بلا حاجة لإنشاء حساب.\n\nشكرًا لكم،\nفريق علامة`);
  return `mailto:${encodeURIComponent(toEmail||'')}?subject=${subject}&body=${body}`;
}
