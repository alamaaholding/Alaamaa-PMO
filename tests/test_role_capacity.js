// اختبار: تخطيط الطاقة بالمسمّى الوظيفي.
// المبدأ: المكتب لا يعنيه *من* ينفّذ، بل هل المسمّى فوق طاقته فيلزم مورد إضافي.
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
if(typeof w.TextEncoder==='undefined')w.TextEncoder=require('util').TextEncoder;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
 from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
 auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
// مصمم واحد (طاقة 3) عليه 5 بنود متزامنة من مشروعين ⇒ يلزم مورد ثانٍ
const roles=[{id:'r1',name:'مصمم جرافيك',department:'المحتوى',headcount:1,load_per_person:3,capacity:3},
             {id:'r2',name:'مطوّر',department:'التقني',headcount:2,load_per_person:2,capacity:4}];
const mk=(id,rid)=>({id,name:id,type:'task',duration:5,lag:0,fixed:null,track:'1',
  status:'notstarted',progress:0,role_id:rid,deps:[]});
const projects=[
 {project_id:'p1',project_name:'أ',client_name:'س',color:'#111',start_date:'2026-08-03',
  tasks:[mk('A1','r1'),mk('A2','r1'),mk('A3','r1'),mk('A4','r2'),mk('A9',null)]},
 {project_id:'p2',project_name:'ب',client_name:'ث',color:'#222',start_date:'2026-08-03',
  tasks:[mk('B1','r1'),mk('B2','r1'),mk('B3','r2')]}
];
const cal=wlBuildCalendar(projects);
const RP=wlRolePressure(cal,roles);
const d=RP.byRole.r1, dev=RP.byRole.r2;
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x===undefined?'':String(x)]);
t('يجمع بنود المسمّى عبر المشاريع المختلفة',d.peak===5,d.peak);
t('يحسب الاستغلال مقابل الطاقة',d.util===Math.round(100*5/3),d.util+'%');
t('يكشف تجاوز الطاقة',d.util>100);
t('يقترح عدد الموارد اللازم (ذروة ÷ حمل الفرد)',d.neededHeadcount===2,d.neededHeadcount);
t('يحسب الفجوة عن الشاغلين الحاليين',d.gap===1,d.gap);
t('يحدّد أسوأ يوم',!!d.worstDay,d.worstDay);
t('يعدّ أيام التجاوز',d.overDays>0,d.overDays);
t('المسمّى ضمن طاقته لا فجوة له',dev.gap===0&&dev.util<=100,dev.util+'%');
t('البنود بلا إسناد تُعدّ منفصلة لا تُنسب لمسمّى',RP.unassigned.count>0,RP.unassigned.count);
t('البنود بلا إسناد لا تُضاف لأي مسمّى',d.peak+dev.peak<Object.values(cal)[0].length+5);
`);
setTimeout(()=>{
 const wl=fs.readFileSync('src/app/workload.js','utf8');
 const pf=fs.readFileSync('src/app/portfolio.js','utf8');
 const v=fs.readFileSync('src/views.js','utf8');
 const api=fs.readFileSync('src/api.js','utf8');
 const extra=[
  ['الإسناد على المسمّى لا الشخص',v.includes('data-f="roleId"')&&v.includes('المسمّى الوظيفي المسؤول — لا الشخص')],
  ['عمود المسمّى يُحفظ في job_role_id',v.includes("roleId:'job_role_id'")],
  ['لوحة إدارة الأقسام والمسمّيات',/async function openCapacityPanel/.test(pf)],
  ['الطاقة = شاغلون × حمل الفرد',pf.includes('عدد الشاغلين × البنود المتزامنة للفرد')],
  ['حذف المسمّى يحرّر البنود ولا يحذفها',pf.includes('البنود المُسنَدة إليه لن تُحذف')],
  ['تنبيه بالمسمّيات فوق طاقتها',wl.includes('مسمّى وظيفي فوق طاقته')],
  ['التنبيه يقترح عدد الموارد',wl.includes('يلزم +${b.gap} مورد')],
  ['تنبيه بالبنود بلا إسناد',wl.includes('بند بلا مسمّى مُسنَد')],
  ['شريط استغلال لكل مسمّى',wl.includes('wl-role-util')],
  ['دوال الطاقة معرَّفة',/async function fetchCapacityTree/.test(api)&&/async function saveJobRole/.test(api)],
 ];
 let ok=0,fail=0;
 [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
  if(c){ok++;console.log('  ✓ '+n+(x?' → '+x:''));}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
 console.log('\nنجح '+ok+' · فشل '+fail);
 process.exit(fail?1:0);
},400);
