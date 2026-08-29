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
// تبقى هذه سكربتًا عاديًا في الدمج النصي حتى تتحوّل main.js و portfolio.js
// و contractsign.js — فهي الآن الوحيدة التي تحتاجها.

async function loadIdentity(){
  const {data:{user}}=await sb.auth.getUser();USER=user;if(!user)return null;
  const {data:tm}=await sb.from('team_members').select('role,is_active,full_name').eq('id',user.id).maybeSingle();
  if(tm&&tm.is_active){ROLE=(tm.role==='admin')?'pmo':(tm.role==='manager'?'delivery':'client');USER._name=tm.full_name||user.email;
    try{const {data:own}=await sb.rpc('pmo_is_owner');IS_OWNER=(own===true);if(IS_OWNER)ROLE='pmo';}catch(e){IS_OWNER=false;}
    if(!IS_OWNER){try{MY_ACCESS=await fetchMyStaffAccess();}catch(e){MY_ACCESS=[];}}}
  else{
    // شريك: نتحقق من التصريح بالإيميل (دالة pmo_my_client_ids)
    const {data:ids}=await sb.rpc('pmo_my_client_ids');
    if(ids&&ids.length){ROLE='client';USER._name=user.email;}else ROLE=null;
  }
  return ROLE;
}
async function boot(){
  // رابط التوقيع العام: مسار مستقل تمامًا، لا يمرّ عبر تسجيل الدخول إطلاقًا —
  // الحارس الحقيقي هو الرمز العشوائي في الرابط نفسه، لا الجلسة.
  const signMatch=/^#\/sign\/([a-zA-Z0-9]+)$/.exec(location.hash||'');
  if(signMatch){ $('#loader').classList.add('hidden'); return renderPublicSign(signMatch[1]); }
  const {data:{session}}=await sb.auth.getSession();
  if(session){await loadIdentity();if(ROLE){return startApp();}else{return showDenied();}}
  showLogin();
}
function showLogin(){$('#login').classList.remove('hidden');$('#app').classList.add('hidden');$('#loader').classList.add('hidden');}
function showDenied(){showLogin();$('#denied').classList.remove('hidden');}
$('#googleBtn').onclick=async()=>{
  $('#loginErr').style.display='none';
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(error){$('#loginErr').textContent='تعذّر بدء الدخول';$('#loginErr').style.display='block';}
};
$('#signout').onclick=$('#signoutDenied').onclick=async()=>{await sb.auth.signOut();location.reload();};
$('#backPortfolio').onclick=async()=>{ await showScreen('portfolio'); $('#backPortfolio').style.display='none'; };
