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
