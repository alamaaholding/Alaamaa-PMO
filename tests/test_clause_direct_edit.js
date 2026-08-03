// اختبار: التحرير المباشر لنص البنود، ووجود منتقي النموذج ومحرر البنود في لوحة الإنشاء
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
toast=()=>{};

// ===== التحرير المباشر لنص بند =====
const base=mergeContract({templateKey:'alamaa_v1',clientName:'س',includesAdSpend:false});
const origB4=base.sections.find(s=>s.num==='٤').body;
const edited=mergeContract({templateKey:'alamaa_v1',clientName:'س',includesAdSpend:false,
  clauseOverrides:{excluded:[],added:[],edited:{'٤':{title:'نطاق العمل المعدَّل',body:'نص جديد كليًا لهذا العقد'}}}});
const s4=edited.sections.find(s=>s.num==='٤');
t('نص البند المحرَّر يحل محل نص النموذج',s4.body==='نص جديد كليًا لهذا العقد'&&s4.body!==origB4);
t('عنوان البند المحرَّر يُطبَّق أيضًا',s4.title==='نطاق العمل المعدَّل');
t('البند المحرَّر مُعلَّم برمز edited',s4.edited===true);
t('البنود الأخرى لم تتأثر بتحرير بند واحد',
  edited.sections.find(s=>s.num==='٥').body===base.sections.find(s=>s.num==='٥').body);
t('الترقيم لم يتغيّر إطلاقًا بعد التحرير',
  JSON.stringify(edited.sections.map(s=>s.num))===JSON.stringify(base.sections.map(s=>s.num)));

// التحرير يعمل مع النموذج الثاني أيضًا
const ed2=mergeContract({templateKey:'alamaa_v2',clientName:'س',includesAdSpend:false,
  clauseOverrides:{edited:{'٩':{body:'التزامات معدَّلة'}}}});
t('التحرير المباشر يعمل مع النموذج الثاني أيضًا',
  ed2.sections.find(s=>s.num==='٩').body==='التزامات معدَّلة');

// التحرير + الاستبعاد معًا بلا تعارض
const both=mergeContract({templateKey:'alamaa_v1',clientName:'س',includesAdSpend:false,
  clauseOverrides:{excluded:['١٣'],edited:{'٤':{body:'محرَّر'}},added:[{num:'١٦.٩',title:'إضافي',body:'ن'}]}});
t('الاستبعاد والتحرير والإضافة معًا يعملون بلا تعارض',
  both.sections.find(s=>s.num==='١٣').removed===true &&
  both.sections.find(s=>s.num==='٤').body==='محرَّر' &&
  both.sections[both.sections.length-1].title==='إضافي');
`);
setTimeout(()=>{
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const extra=[
    ['منتقي النموذج موجود في لوحة الإنشاء',hub.includes('id="chnTemplate"')],
    ['محرر البنود موجود في لوحة الإنشاء',hub.includes('id="chnClauses"')&&hub.includes("chubRenderClauseEditor('chnClauses'")],
    ['محرر البنود دالة عامة مشتركة بين الإنشاء والتعديل',hub.includes('function chubRenderClauseEditor(boxId,onChange)')],
    ['زر تحرير نص كل بند موجود',hub.includes('data-editclause=')],
    ['إمكانية استعادة نص النموذج الأصلي للبند المحرَّر',hub.includes('استعادة نص النموذج الأصلي')],
    ['تعديلات البنود تُحفَظ فور الإنشاء (لا تُفقد)',hub.includes('تعديلات البنود تُحفَظ فور الإنشاء')],
    ['الإنشاء يمرّر النموذج المختار',hub.includes('templateKey:CHD_TEMPLATE,')],
  ];
  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\nنجح '+ok+' · فشل '+fail);
  process.exit(fail?1:0);
},100);
