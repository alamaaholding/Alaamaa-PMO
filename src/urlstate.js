// ═══════════════════════════════════════════════════════════════════════
//  urlstate.js — الفلاتر تنتقل من الذاكرة إلى الرابط (وحدة ESM · W5)
// ═══════════════════════════════════════════════════════════════════════
//
//  AUDIT §ج-٤: الرابط يحمل **أين** أنت (شريك · مشروع · تبويب · بند) ولا يحمل
//  **ماذا ترى**. فمن يصفّي المحفظة على «متوقفة + طلبات معلّقة» ثم يرسل الرابط
//  لزميله، يفتح الزميل شاشة مختلفة تمامًا — ولا شيء ينبّه أيًّا منهما.
//
//  والأثر أوضح في الاجتماعات: «انظر إلى هذه» تعني إعادة بناء التصفية يدويًا
//  عند الطرف الآخر، أو إرسال لقطة شاشة لا يمكن التفاعل معها.
//
//  ═══ ثلاث قواعد شكّلت الترميز ═══
//
//  ١) **الافتراضي لا يُكتب.** عرضٌ بلا تصفية يعطي رابطًا نظيفًا كما كان تمامًا.
//     لو كُتبت القيم الافتراضية لصار كل رابط في المنصّة مذيَّلًا بضجيج، ولانتهى
//     الأمر بأن يتجنّب الناس نسخه.
//
//  ٢) **الرابط يفوز على localStorage.** التفضيل المحفوظ يبقى افتراضًا حين لا
//     يقول الرابط شيئًا؛ فإن قال، فهو نيّة صريحة من المُرسِل. والعكس يعني أن
//     رابطًا مشتركًا يُعرَض بتفضيلات المُستقبِل — وهو بالضبط العطل الذي نعالجه.
//
//  ٣) **ما لا يُفهَم يُتجاهَل بصمت.** رابط قديم أو مبتور أو بمفتاح غير معروف
//     يفتح العرض الافتراضي، ولا يُسقط الصفحة ولا يُظهر خطأً. الرابط مدخلٌ من
//     الخارج، ومعاملته كأنه دائمًا سليم مصدرُ أعطال.
//
//  الترميز مضغوط عمدًا (`ph` لا `phases`): الروابط تُنسخ في محادثات وتُقتطع في
//  بعض العملاء، وكل حرف يُوفَّر يؤخّر ذلك.

/** يحوّل Set أو مصفوفة إلى نص مفصول بفواصل، مرتَّبًا كي يكون الرابط مستقرًّا. */
const listOut = v => [...(v || [])].filter(Boolean).sort().join(',');
const listIn = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

/**
 * تصفية المحفظة → نص استعلام.
 * المفاتيح: f=الحالة · s=الترتيب · al=التنبيهات · q=البحث
 */
export function encodePortfolio({ filter, sort, alerts, search } = {}) {
  const p = [];
  if (filter && filter !== 'all') p.push('f=' + encodeURIComponent(filter));
  if (sort && sort !== 'alerts') p.push('s=' + encodeURIComponent(sort));
  const al = listOut(alerts);
  if (al) p.push('al=' + encodeURIComponent(al));
  const q = (search || '').trim();
  if (q) p.push('q=' + encodeURIComponent(q));
  return p.join('&');
}

export function decodePortfolio(qs) {
  const o = parseQuery(qs);
  const out = {};
  if (o.f) out.filter = o.f;
  if (o.s) out.sort = o.s;
  if (o.al) out.alerts = listIn(o.al);
  if (o.q) out.search = o.q;
  return out;
}

/**
 * تصفية جدول البنود → نص استعلام.
 * المفاتيح: ph=المراحل · st=الحالات · sm=الذكية · q=البحث
 */
export function encodeTable({ phases, statuses, smart, q } = {}) {
  const p = [];
  const ph = listOut(phases); if (ph) p.push('ph=' + encodeURIComponent(ph));
  const st = listOut(statuses); if (st) p.push('st=' + encodeURIComponent(st));
  const sm = listOut(smart); if (sm) p.push('sm=' + encodeURIComponent(sm));
  const s = (q || '').trim(); if (s) p.push('q=' + encodeURIComponent(s));
  return p.join('&');
}

export function decodeTable(qs) {
  const o = parseQuery(qs);
  const out = {};
  if (o.ph) out.phases = listIn(o.ph);
  if (o.st) out.statuses = listIn(o.st);
  if (o.sm) out.smart = listIn(o.sm);
  if (o.q) out.q = o.q;
  return out;
}

/**
 * تحليل نص استعلام. مبنيّ يدويًا لا بـURLSearchParams لسببين: النصّ يأتي من
 * جزء الـhash لا من موضع الاستعلام الحقيقي، وقد يصل مبتورًا من نسخٍ ناقص —
 * ومفتاح بلا قيمة أو قيمة بلا مفتاح يُتجاهَل بدل أن يُنتج مدخلًا وهميًّا.
 */
function parseQuery(qs) {
  const out = {};
  for (const part of String(qs || '').replace(/^[?&]+/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i <= 0) continue;                       // بلا مفتاح أو بلا '=' → يُتجاهَل
    const k = part.slice(0, i), v = part.slice(i + 1);
    if (!v) continue;
    try { out[k] = decodeURIComponent(v.replace(/\+/g, ' ')); }
    catch (e) { /* ترميز تالف — يُتجاهَل بصمت (القاعدة ٣) */ }
  }
  return out;
}

/** يفصل الـhash إلى مسار ونص استعلام: '#/a/b?x=1' → {path:'#/a/b', query:'x=1'} */
export function splitHash(hash) {
  const h = String(hash || '');
  const i = h.indexOf('?');
  return i === -1 ? { path: h, query: '' } : { path: h.slice(0, i), query: h.slice(i + 1) };
}

/** يركّب المسار مع الاستعلام — ويُسقط '?' كليًا حين لا استعلام (القاعدة ١). */
export function joinHash(path, query) {
  return query ? path + '?' + query : path;
}


// ═══════════════════════════════════════════════════════════════════════
//  طبقة الرابط: القراءة والكتابة الفعليتان
// ═══════════════════════════════════════════════════════════════════════
//
//  كانت المرمِّزات أعلاه هنا ومُستعمِلوها في app/main.js — أي أن **طبقةً واحدة
//  كانت مقسومة بين ملفّين**، وكان ذلك يربط views.js و lifecycle.js و portfolio.js
//  بملف التطبيق الأكبر من أجل `writeHash` و`writePortfolioHash` لا غير.
//
//  وما جعل النقل ممكنًا نقلُ حالتين إلى المتجر قبله: `TFILTER` (كانت رابطة سائبة
//  في views.js) و`FOCUS_REF` (كانت `_focusRef` في main.js). فبعدهما لم يبقَ لهذه
//  الدوال الأربع مُدخَلٌ خارج المتجر والمرمِّزات.

import { getState, setState } from './app/state.js';

// ═══ قفل الكتابة ═══
// كل كتابة للرابط تُطلق hashchange. والمُعالِج يُعيد التصيير، فتُنتج كتابةٌ
// برمجية تصييرًا لم يطلبه أحد — وربما حلقةً. فيُرفَع القفل بعد دورة حدث واحدة:
// المهلة صفر تكفي لأن hashchange يصل في نفس الدورة التي تليها.
let hashLock = false;
/** هل الكتابة الجارية برمجية؟ يقرؤها مُعالِج hashchange ليتجاهل نفسه. */
export function isHashLocked() { return hashLock; }

function writeLocked(h) {
  if (location.hash === h) return;
  hashLock = true;
  try { history.replaceState(null, '', h); } catch (e) { location.hash = h; }
  setTimeout(() => { hashLock = false; }, 0);
}

export function writePortfolioHash(){
  const h=joinHash('#/',encodePortfolio({
    filter:getState('PFILTER'),sort:getState('PSORT'),alerts:getState('PALERTS'),search:getState('PSEARCH')}));
  writeLocked(h);
}

// كاتبةٌ ثالثة كانت خارج القفل: عاشت في app/clienthome.js بنسخةٍ يدوية من
// `history.replaceState` لا تمسّ `hashLock`. فكانت كل نقلةٍ إلى صفحة شريك تُطلق
// hashchange يراه المُعالِج كتنقّلٍ من المستخدم فيُعيد التصيير — وهو بالضبط
// العطل الذي وُضع القفل لأجله. فانتقلت إلى جوار أختيها وصارت تكتب بـwriteLocked.
export function writeClientHash(clientId){
  const c=(getState('CLIENTS')||[]).find(x=>x.id===clientId);
  writeLocked('#/c/'+((c&&c.slug)||clientId));
}

export function writeHash(){
  // سقطت حراسة `typeof SCREEN==='undefined'`: كانت من زمن النطاق المشترك حيث
  // الترتيب النصّي هو كل شيء. و getState تُرجع قيمةً دائمًا لمفتاح معروف.
  if(getState('SCREEN')!=='project'||!getState('PROJECT')||!getState('PROJECT')._dbId)return;
  const client=(getState('CLIENTS')||[]).find(x=>x.id===getState('CID'));
  const cRef=(client&&client.slug)||getState('CID');
  const pRef=getState('PROJECT').slug||getState('PROJECT')._dbId;
  const base='#/c/'+cRef+'/'+pRef+'/'+getState('VIEW')+(getState('FOCUS_REF')?('/t/'+encodeURIComponent(getState('FOCUS_REF'))):'');
  // تصفية الجدول تخصّ تبويب الجدول وحده — حملُها في تبويب آخر ضجيج بلا معنى.
  const h=joinHash(base,getState('VIEW')==='table'?encodeTable(getState('TFILTER')):'');
  writeLocked(h);
}

export function parseHash(){
  // الاستعلام يُفصل أولًا: المسار يحدّد **أين**، والاستعلام يحدّد **ماذا يُرى**،
  // ولا يجوز أن يُفسد أحدهما تحليل الآخر.
  const {path}=splitHash(location.hash||'');
  let m=/^#\/c\/([^/]+)\/([^/]+)\/([a-z]+)(?:\/t\/(.+))?$/.exec(path);
  if(m)return {clientRef:m[1],projectRef:m[2],view:m[3],ref:m[4]?decodeURIComponent(m[4]):null};
  m=/^#\/p\/([^/]+)\/([a-z]+)(?:\/t\/(.+))?$/.exec(path); // صيغة قديمة — للتوافق فقط
  if(m)return {clientRef:null,projectRef:m[1],view:m[2],ref:m[3]?decodeURIComponent(m[3]):null};
  return null;
}

export function applyHashFilters(){
  const {path,query}=splitHash(location.hash||'');
  if(!query)return false;
  if(/^#\/?$/.test(path)){
    const f=decodePortfolio(query);
    if(f.filter)setState('PFILTER', f.filter);
    if(f.sort)setState('PSORT', f.sort);
    if(f.alerts)setState('PALERTS', new Set(f.alerts));
    if(f.search!==undefined)setState('PSEARCH', f.search);
    return true;
  }
  const f=decodeTable(query);
  if(!Object.keys(f).length)return false;
  setState('TFILTER', {phases:new Set(f.phases||[]),statuses:new Set(f.statuses||[]),
                       smart:new Set(f.smart||[]),q:f.q||''});
  return true;
}
