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
    await renderPortfolio();
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
  await renderPortfolio();
  const btn=document.getElementById('showOrgProfile');
  t('زر الأداة موصول بمعالج فعلي لا زر ميت',!!(btn&&typeof btn.onclick==='function'));

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;clearInterval(wait);
  const pf=fs.readFileSync('src/app/portfolio.js','utf8');
  const extra=[
    ['بوابة الواجهة تطابق سياسة القاعدة (مالك أو مدير)',
      pf.includes("if(IS_OWNER||ROLE==='pmo'){toolItems.push({g:'إعدادات',id:'showCapacity'")],
    ['openOrgProfile معرَّفة',/async function openOrgProfile/.test(pf)],
  ];
  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\nنجح '+ok+' · فشل '+fail);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);
