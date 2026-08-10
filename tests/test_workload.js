// اختبار: خريطة حِمل العمل عبر المحفظة — الحساب والعرض والتنبيه.
// مبدأ حاكم: الجدولة تُحسب بنفس scheduleTasks المستخدَمة في الجانت، فلا تتناقض الأرقام.
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
 from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
 auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
const P=[
 {project_id:'p1',project_name:'مشروع أ',client_name:'س',color:'#111',start_date:'2026-08-03',
  tasks:[{id:'A1',name:'ب1',type:'task',duration:5,lag:0,fixed:null,track:'1',status:'inprogress',progress:0,deps:[]},
         {id:'A2',name:'ب2',type:'task',duration:5,lag:0,fixed:null,track:'1',status:'notstarted',progress:0,deps:[]},
         {id:'A3',name:'مكتمل',type:'task',duration:5,lag:0,fixed:null,track:'1',status:'done',progress:100,deps:[]},
         {id:'AC',name:'مستمر',type:'cont',duration:5,lag:0,fixed:null,track:'1',status:'inprogress',progress:0,deps:[]},
         {id:'AP',name:'حزمة',type:'package',duration:0,lag:0,fixed:null,track:'1',status:'notstarted',progress:0,deps:[]}]},
 {project_id:'p2',project_name:'مشروع ب',client_name:'ث',color:'#222',start_date:'2026-08-03',
  tasks:[{id:'B1',name:'ب1',type:'task',duration:5,lag:0,fixed:null,track:'1',status:'notstarted',progress:0,deps:[]},
         {id:'B2',name:'ب2',type:'task',duration:5,lag:0,fixed:null,track:'1',status:'notstarted',progress:0,deps:[]}]}
];
const cal=wlBuildCalendar(P);
const keys=Object.keys(cal).sort();
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x===undefined?'':String(x)]);
t('التقويم يُبنى من عدة مشاريع معًا',keys.length>0,keys.length+' يوم');
t('البنود المتزامنة تُجمَع عبر المشاريع',cal[keys[0]].length===4,cal[keys[0]].length);
t('يميّز عدد المشاريع المتقاطعة في اليوم',[...new Set(cal[keys[0]].map(x=>x.project))].length===2);
t('المكتمل لا يُحمَّل (لا يستهلك طاقة)',!Object.values(cal).some(a=>a.some(x=>x.task==='A3')));
t('الحزم التجميعية لا تُحمَّل',!Object.values(cal).some(a=>a.some(x=>x.task==='AP')));
t('البنود المستمرة لا تُحمَّل (بلا نافذة محدَّدة)',!Object.values(cal).some(a=>a.some(x=>x.task==='AC')));
t('العطلات لا تُحمَّل',keys.every(k=>isWorkday(new Date(k))));
t('كل بند يحمل مشروعه ولونه للتمييز',cal[keys[0]].every(x=>x.project&&x.color));
// عتبات التلوين
t('يوم فارغ بلا لون حِمل',wlTone(0)==='z0');
t('الحمل ضمن الطاقة أخضر',wlTone(WL_CAP)==='z2');
t('تجاوز الطاقة ينتقل للتحذير',wlTone(WL_CAP+1)==='z3');
t('التجاوز الكبير أحمر',wlTone(WL_CAP+5)==='z4');
`);
setTimeout(()=>{
 const src=fs.readFileSync('src/app/workload.js','utf8');
 const api=fs.readFileSync('src/api.js','utf8');
 const extra=[
  ['الجدولة بنفس خوارزمية الجانت لا حساب مستقل',src.includes('scheduleTasks(tasks,p.start_date)')],
  ['الطاقة اليومية قابلة للضبط وتُحفَظ',src.includes("localStorage.setItem('pmo_wl_cap'")],
  ['تنبيه بالأيام التي تتجاوز الطاقة',src.includes('يومًا يتجاوز الطاقة')],
  ['التنبيه يذكر عدد المشاريع المتقاطعة',src.includes('بند من ${projs.length} مشروع')],
  ['تفاصيل اليوم مجمَّعة بالمشروع',src.includes('const byProject={}')],
  ['تمييز البنود الحرجة في التفاصيل',src.includes("x.critical?'crit':''")],
  ['دالة الجلب معرَّفة',/async function fetchPortfolioWorkload/.test(api)],
  ['اليوم الحالي مميَّز في التقويم',src.includes("isToday?'today':''")],
  ['خلايا الأيام موصوفة لقارئات الشاشة',src.includes('aria-label="${d.toLocaleDateString')]
 ];
 let ok=0,fail=0;
 [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
  if(c){ok++;console.log('  ✓ '+n+(x?' → '+x:''));}else{fail++;console.log('  ✗ '+n);}});
 console.log('\nنجح '+ok+' · فشل '+fail);
 process.exit(fail?1:0);
},400);
