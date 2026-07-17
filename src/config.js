// ===== الإعدادات =====
const SUPABASE_URL='https://gxiucsieezkvwztbsrgf.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aXVjc2llZXprdnd6dGJzcmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTI5NzksImV4cCI6MjA5NDg2ODk3OX0.yKw4yQEJM_4wPk1ki5m084OZqqmAA8A07uVeamlIT3M';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
const TRACKS={"0":{name:"التأسيس المضغوط",code:"0",color:"#1A1A1A"},"A":{name:"النمو السريع والمواسم",code:"A",color:"#C8A06B"},"B":{name:"التحليل والتشخيص بالموجات",code:"B",color:"#7A8B6F"},"C":{name:"الاستراتيجية وبناء الأصول",code:"C",color:"#9C6B4A"}};
const STATUS={notstarted:'لم تبدأ',inprogress:'جارية',blocked:'متوقفة',done:'مكتملة'};
const TYPES={task:'مهمة',milestone:'معلم',fixed:'ثابت',cont:'مستمر',package:'حزمة عمل'};
const ROLE_NAMES={pmo:'مكتب إدارة المشاريع',delivery:'الفريق',client:'العميل'};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const fmt=d=>{const x=new Date(d);return('0'+x.getDate()).slice(-2)+'/'+('0'+(x.getMonth()+1)).slice(-2);};
const fmtY=d=>{const x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);};
const D=s=>new Date(s+'T00:00:00');
function todayISO(){return fmtY(new Date());}


// ===== الصلاحيات =====
const PERMS={pmo:{editStruct:true,editProg:true,editReqs:true,approveContract:true,crAction:'approve',views:['dashboard','table','gantt','deliv','timeline','cr','requests','discuss','audit']},
  delivery:{editStruct:true,editProg:true,editReqs:true,approveContract:false,crAction:'request',views:['dashboard','table','gantt','deliv','timeline','cr','requests','discuss','audit']},
  client:{editStruct:false,editProg:false,editReqs:false,approveContract:false,crAction:'request',views:['dashboard','gantt','deliv','cr','requests','discuss']}};
function can(p){return PERMS[ROLE]&&PERMS[ROLE][p];}

// ===== أيقونات SVG موحّدة (خطية، ترث لون النص) =====
const I={
 scale:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 21h18M6 7l-3 6h6l-3-6zM18 7l-3 6h6l-3-6zM7 7h10"/></svg>',
 clipboard:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a2 2 0 0 1 6 0M9 10h6M9 14h6M9 18h4"/></svg>',
 archive:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></svg>',
 calendar:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18M7 15h3M14 15h3"/></svg>',
 upload:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7 10l5-5 5 5M4 19h16"/></svg>',
 dots:'<svg class="icn" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
 pencil:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/></svg>',
 trash:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6"/></svg>',
 link:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
 users:'<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6"/></svg>'
};

// المراحل الديناميكية: قائمة مراحل المشروع الحالي (أو الافتراضية)
function projTrackList(){
  if(typeof PROJECT!=='undefined'&&PROJECT&&PROJECT.tracks&&PROJECT.tracks.length)
    return PROJECT.tracks.map(t=>({key:t.key,name:t.name,color:t.color,code:t.key,id:t.id,sort:t.sort}));
  return Object.keys(TRACKS).map((k,i)=>({key:k,name:TRACKS[k].name,color:TRACKS[k].color,code:TRACKS[k].code||k,sort:i}));
}
function trackMeta(k){
  const t=projTrackList().find(x=>x.key===k);
  if(t)return t;
  if(TRACKS[k])return{key:k,name:TRACKS[k].name,color:TRACKS[k].color,code:TRACKS[k].code||k};
  return{key:k,name:k,color:'#C8A06B',code:k};
}

// خط التسليمات: المصادر والأنواع والحالات
const DELIV_SRC={
  client:{t:'العميل',c:'#a8442f'},
  pmo:{t:'إدارة المشاريع',c:'#4B3F72'},
  marketing:{t:'التسويق',c:'#B28E67'},
  tech:{t:'التقني',c:'#35608F'},
  consulting:{t:'الاستشارات',c:'#5B8266'}
};
const DELIV_KIND={file:{t:'تسليم ملف',i:'📎'},request:{t:'طلب',i:'📤'},reply:{t:'رد',i:'↩'},approval:{t:'اعتماد',i:'✅'},note:{t:'ملاحظة',i:'📝'}};
const DELIV_STATUS={sent:'مُرسل',awaiting:'بانتظار الرد',received:'مُستلم',approved:'معتمد'};
