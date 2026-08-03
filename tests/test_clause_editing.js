const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
window.__R=[];const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
// النموذجان متاحان
t('نموذجان معرَّفان',Object.keys(CONTRACT_TEMPLATES).length===2);
t('النموذج الثاني له تسمية واضحة',CONTRACT_TEMPLATES.alamaa_v2.label.includes('المبسَّط'));

// النموذج الثاني يختلف فعليًا عن الأول
const v1=mergeContract({templateKey:'alamaa_v1',clientName:'س',includesAdSpend:true});
const v2=mergeContract({templateKey:'alamaa_v2',clientName:'س',includesAdSpend:true,adMonthlyBudget:25000});
t('النموذج الثاني: البند ٥ مختصر (يختلف عن الأول)',
  v1.sections.find(s=>s.num==='٥').body!==v2.sections.find(s=>s.num==='٥').body);
t('النموذج الثاني: بند الإنفاق الإعلاني يذكر المبلغ الشهري المحدَّد',
  v2.sections.find(s=>s.num==='٧').body.includes('25,000'));
t('النموذج الثاني: بلا نمط "مشروع محدد النطاق" في التعريفات',
  !v2.sections.find(s=>s.num==='٣').body.includes('مشروع محدد النطاق'));
t('كلا النموذجين يحافظ على ترقيم ٢ إلى ١٦ كاملًا',
  JSON.stringify(v1.sections.map(s=>s.num))===JSON.stringify(v2.sections.map(s=>s.num)));

// حذف بند لا يُزيح الترقيم
const cut=mergeContract({templateKey:'alamaa_v1',clientName:'س',includesAdSpend:false,
  clauseOverrides:{excluded:['٥','١٣'],added:[]}});
t('حذف بندين: كل الأرقام تبقى كما هي بلا إزاحة',
  JSON.stringify(cut.sections.map(s=>s.num))===JSON.stringify(v1.sections.map(s=>s.num)));
t('البند المحذوف يُعلَّم كـ«غير منطبق» بنص واضح',
  cut.sections.find(s=>s.num==='٥').body.includes('حُذف هذا البند باتفاق الطرفين'));
t('البند المحذوف مُعلَّم برمز removed للاستخدام البرمجي',cut.sections.find(s=>s.num==='٥').removed===true);
t('بند غير محذوف يبقى بمتنه الأصلي كاملًا',cut.sections.find(s=>s.num==='٤').body.includes('نطاق العمل حصرًا'));

// إضافة بند
const add=mergeContract({templateKey:'alamaa_v1',clientName:'س',includesAdSpend:false,
  clauseOverrides:{excluded:[],added:[{num:'١٦.٧',title:'بند خاص',body:'نص البند الخاص'}]}});
t('البند المضاف يظهر في نهاية العقد',add.sections[add.sections.length-1].title==='بند خاص');
t('البند المضاف يحمل رقمه ونصه',add.sections[add.sections.length-1].num==='١٦.٧'&&add.sections[add.sections.length-1].body.includes('نص البند الخاص'));
t('إضافة بند لا تمسّ ترقيم البنود الثابتة',
  JSON.stringify(add.sections.slice(0,v1.sections.length).map(s=>s.num))===JSON.stringify(v1.sections.map(s=>s.num)));

// العرض HTML
const h=renderMergedContractHTML(cut);
t('البند المحذوف يظهر في HTML برقمه (لا يختفي)',h.includes('>٥.'));
`);
let ok=0,fail=0;
w.__R.forEach(([n,c,x])=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);
