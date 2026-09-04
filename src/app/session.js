// ===== app/session.js — المصادقة وبوابة الدخول (مقسّم من api.js) =====
//
// لماذا خرجت من api.js: لأنها لم تكن يومًا من عمله. هذه الكتلة تقرأ الـhash،
// وتُظهر وتُخفي #loader و#login و#app و#denied، وتربط أزرار الدخول والخروج،
// وتقرّر متى يبدأ التطبيق. لا شيء من ذلك وصولٌ إلى بيانات.
//
// والقياس أظهر الأثر العملي لهذا الخلط بدقّة: api.js تعتمد على ثلاثة ملفات غير
// مُحوَّلة — renderPublicSign و startApp و renderPortfolio — **وثلاثتها داخل
// هذه الكتلة وحدها**. أما بقية الملف (١٠٠٠ سطر) فلا تعتمد إلا على وحدات
// مُحوَّلة بالفعل، وعلى الوحدات الكسولة الست عبر `window.X()` المتعمَّد.
//
// فبإخراج ٣٢ سطرًا تصير api.js — أكبر ملف في المشروع — قابلة للتحويل.
// الفصل الصحيح للمسؤوليات لم يكن ترفًا هنا؛ كان هو المفتاح.
//
// ═══ وحدة ESM ═══
// آخر ملفّين في الدمج النصي تحوّلا معًا. وكانت الدورة بينهما اسمين: هذه تنادي
// `startApp` وتلك تنادي `boot`. فانتقل نداء `boot()` — نقطة انطلاق التطبيق —
// إلى `bundle-entry.js` حيث موضعه الصحيح، فسقطت الحاجة الثانية وسقطت الدورة.

import { fetchMyStaffAccess } from '../api.js';
import { $, sb } from '../config.js';
import { showScreen } from '../screens.js';
import { renderPublicSign } from './contractsign.js';
import { getState, setState } from './state.js';
import { startApp } from './main.js';
async function loadIdentity(){
  const {data:{user}}=await sb.auth.getUser();setState('USER', user);if(!user)return null;
  const {data:tm}=await sb.from('team_members').select('role,is_active,full_name').eq('id',user.id).maybeSingle();
  if(tm&&tm.is_active){setState('ROLE', (tm.role==='admin')?'pmo':(tm.role==='manager'?'delivery':'client'));getState('USER')._name=tm.full_name||user.email;
    try{const {data:own}=await sb.rpc('pmo_is_owner');setState('IS_OWNER', (own===true));if(getState('IS_OWNER'))setState('ROLE', 'pmo');}catch(e){setState('IS_OWNER', false);}
    if(!getState('IS_OWNER')){try{setState('MY_ACCESS', await fetchMyStaffAccess());}catch(e){setState('MY_ACCESS', []);}}}
  else{
    // شريك: نتحقق من التصريح بالإيميل (دالة pmo_my_client_ids)
    const {data:ids}=await sb.rpc('pmo_my_client_ids');
    if(ids&&ids.length){setState('ROLE', 'client');getState('USER')._name=user.email;}else setState('ROLE', null);
  }
  return getState('ROLE');
}
export async function boot(){
  // رابط التوقيع العام: مسار مستقل تمامًا، لا يمرّ عبر تسجيل الدخول إطلاقًا —
  // الحارس الحقيقي هو الرمز العشوائي في الرابط نفسه، لا الجلسة.
  const signMatch=/^#\/sign\/([a-zA-Z0-9]+)$/.exec(location.hash||'');
  if(signMatch){ $('#loader').classList.add('hidden'); return renderPublicSign(signMatch[1]); }
  const {data:{session}}=await sb.auth.getSession();
  if(session){await loadIdentity();if(getState('ROLE')){return startApp();}else{return showDenied();}}
  showLogin();
}
function showLogin(){$('#login').classList.remove('hidden');$('#app').classList.add('hidden');$('#loader').classList.add('hidden');}
function showDenied(){showLogin();$('#denied').classList.remove('hidden');}
// ═══ حراسة ربط DOM ═══
// هذه الأسطر تنفَّذ الآن داخل قطعة esbuild **في مقدّمة الحزمة**. وعنصرٌ مفقود
// يعني `null.onclick` — استثناءً يُسقط الحزمة كلها لا بقيّة ملفٍ واحد كما كان
// في الدمج النصي. والاختبارات تحقن الحزمة في وثائق بلا هيكل كامل، فالحراسة
// شرطُ بقاء شبكة الأمان لا احتياطًا نظريًا.
{const _el=$('#googleBtn'); if(_el)_el.onclick=async()=>{
  $('#loginErr').style.display='none';
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(error){$('#loginErr').textContent='تعذّر بدء الدخول';$('#loginErr').style.display='block';}
};}
{const _out=async()=>{await sb.auth.signOut();location.reload();};
 const _a=$('#signout'), _b=$('#signoutDenied');
 if(_a)_a.onclick=_out; if(_b)_b.onclick=_out;}
{const _el=$('#backPortfolio'); if(_el)_el.onclick=async()=>{ await showScreen('portfolio'); _el.style.display='none'; };}
