// ===== app/state.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
// ===== الحالة =====
let USER=null,ROLE=null,IS_OWNER=false,CLIENTS=[],CID=null,PID=null,PROJECT=null,SCHED=null,TRACK=null,DATA_DATE=todayISO(),PX=20,VIEW='dashboard',CRS=[],PFILTER='all',PSEARCH='',PEXPANDED=new Set(),PALERTS=new Set(),PSORT='alerts';
// نظام صلاحيات الفريق: MY_ACCESS=صلاحيات المستخدم الحالي المخصَّصة له (فارغة = لا قيود، كما كان دائمًا)
let MY_ACCESS=[],PROJ_DEPTS={},PROJECT_ACCESS_DENIED=false;
try{const sv=JSON.parse(localStorage.getItem('pmo_pfilters')||'{}');
  if(sv.PFILTER)PFILTER=sv.PFILTER; if(sv.PSORT)PSORT=sv.PSORT; if(Array.isArray(sv.PALERTS))PALERTS=new Set(sv.PALERTS);
}catch(e){}
