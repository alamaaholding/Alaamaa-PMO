// اختبار: بوابات الصلاحية في الواجهة يجب ألا تكون أضيق من سياسات قاعدة البيانات.
// خلفية الخطأ الذي يعالجه: أداة «الملف التعاقدي لعلامة» كانت محصورة بـIS_OWNER في الواجهة،
// بينما سياسة القاعدة (pmo_update_org_profile) تسمح للمالك ولمدير المنصة معًا. فبعد نقل
// ملكية المنصة لحساب آخر، اختفت الأداة تمامًا عن مدير المنصة رغم امتلاكه الصلاحية فعليًا.
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({
  rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
    eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));

run(`
window.__R=[];const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};CLIENTS=[];

(async()=>{
  const toolsOf=async(role,owner)=>{
    ROLE=role;IS_OWNER=owner;
    // عبر سجلّ الشاشات لا بالاسم: renderPortfolio صارت داخل وحدة ESM فلم تعد
    // على النطاق العام. والمسار هنا هو مسار التطبيق الحقيقي، لا بديلًا عنه.
    await showScreen('portfolio');
    return [...document.querySelectorAll('#toolsPop button')].map(b=>b.id);
  };

  // ===== مدير المنصة (pmo) بلا صفة مالك — الحالة التي كسرت فعليًا بعد نقل الملكية =====
  const pmoTools=await toolsOf('pmo',false);
  t('مدير المنصة يرى «الملف التعاقدي لعلامة» رغم أنه ليس مالكًا',
    pmoTools.includes('showOrgProfile'),pmoTools.join(','));

  // ===== المالك يراها أيضًا =====
  const ownerTools=await toolsOf('pmo',true);
  t('المالك يرى الأداة كذلك',ownerTools.includes('showOrgProfile'));

  // ===== أدوات المالك الحصرية تبقى حصرية (لا نوسّع أكثر مما تسمح به القاعدة) =====
  t('إعدادات Trello تبقى للمالك حصرًا (سياسة الكتابة في القاعدة للمالك وحده)',
    !pmoTools.includes('showTrelloSet')&&ownerTools.includes('showTrelloSet'));
  t('صلاحيات الفريق تبقى للمالك حصرًا',
    !pmoTools.includes('showStaffAccess')&&ownerTools.includes('showStaffAccess'));

  // ===== دور التنفيذ (delivery) لا يرى أدوات الإدارة =====
  const delTools=await toolsOf('delivery',false);
  t('دور التنفيذ لا يرى الملف التعاقدي لعلامة',!delTools.includes('showOrgProfile'));

  // ===== الأداة موصولة بمعالجها فعليًا (لا زر ميت) =====
  ROLE='pmo';IS_OWNER=false;
  await showScreen('portfolio');
  const btn=document.getElementById('showOrgProfile');
  t('زر الأداة موصول بمعالج فعلي لا زر ميت',!!(btn&&typeof btn.onclick==='function'));

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;clearInterval(wait);
  const pf=fs.readFileSync('src/app/portfolio.js','utf8');
  // ═══ المصفوفة الكاملة — على الدالة الخالصة مباشرةً ═══
  // كان هنا تأكيدٌ **نصّيّ** يبحث عن شرط الصلاحية بإملائه في المصدر. وهو يُثبت أن
  // السطر مكتوب لا أن البوابة تعمل: تغييرُ `||` إلى `&&` يُبقي النصّ مطابقًا في
  // معظم صيغه. وقد خرج القرار إلى `portfolioTools(role,isOwner)` (W3) فصار
  // يُستجوَب بالحالات لا بالنصّ.
  const T=(role,owner)=>w.portfolioTools(role,owner).map(x=>x.id);
  const OWNER=T('pmo',true), PMO=T('pmo',false), DEL=T('delivery',false), CLI=T('client',false);
  const has=(a,id)=>a.includes(id);
  const extra=[
    // القاعدة التي كُسرت فعلًا: الملف التعاقدي لمدير المنصّة كما للمالك.
    ['الملف التعاقدي: للمالك وللمدير معًا', has(OWNER,'showOrgProfile')&&has(PMO,'showOrgProfile')],
    ['ولا يراه دور التنفيذ', !has(DEL,'showOrgProfile')],
    ['وكذلك الأقسام والأتمتة والفحص الأمني',
      ['showCapacity','showAutomation','showSecAudit'].every(id=>has(OWNER,id)&&has(PMO,id)&&!has(DEL,id))],
    // وأدوات المالك الحصرية تبقى حصرية — لا نوسّع أكثر ممّا تسمح به القاعدة.
    ['Trello وصلاحيات الفريق للمالك حصرًا',
      ['showTrelloSet','showStaffAccess'].every(id=>has(OWNER,id)&&!has(PMO,id)&&!has(DEL,id))],
    ['وأدوات pmo الإدارية لا يراها التنفيذ',
      ['showHolidays','showArchived','showLeads'].every(id=>has(PMO,id)&&!has(DEL,id))],
    // والعروض الشاملة للطاقم كلّه.
    ['العروض الشاملة للطاقم كلّه',
      ['showPGantt','showTimeline','showDOL','showWorkload','showContractsHub']
        .every(id=>has(PMO,id)&&has(DEL,id))],
    // الشريك لا يرى أداةً واحدة — وهذا أخطر صفٍّ في المصفوفة.
    ['الشريك لا يرى أداةً واحدة', CLI.length===0, CLI.join(',')],
    // ولا معرّف مكرَّر: تكراره يُنتج زرّين بنفس id فيربط أحدهما ويموت الآخر.
    ['ولا معرّف مكرَّر في أي دور',
      [OWNER,PMO,DEL].every(a=>new Set(a).size===a.length)],
    // وكل أداة في مجموعةٍ معروفة، وإلا سقطت من الترميز صامتةً.
    ['وكل أداة ضمن مجموعةٍ معروفة',
      w.portfolioTools('pmo',true).every(x=>['عروض شاملة','إدارة','إعدادات'].includes(x.g))],
    ['openOrgProfile معرَّفة',/async function openOrgProfile/.test(pf)],
  ];
  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\nنجح '+ok+' · فشل '+fail);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);
