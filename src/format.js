// ===== format.js — تنسيق النصوص والتواريخ والمعرّفات (وحدة ESM) =====
//
// لماذا هذه الوحدة موجودة أصلًا:
//   هذه الدوال كانت مبعثرة بين config.js و views.js لا لسبب معماري بل لأن الملفات
//   نمت حولها. والأثر لم يكن تجميليًا: `esc` عاشت في views.js (٩٨٢ سطرًا)، و
//   app/dialogs.js تحتاجها — فصار أصغر ملف في طبقة التطبيق يعتمد على أكبر ملف
//   عرض، ودورة اعتماد كاملة تُولد من دالة سطر واحد.
//
//   ومثلها `todayISO` في config.js يحتاجها app/state.js في أول سطر من تهيئته.
//
//   المساعدات النقية المدفونة داخل الملفات الكبيرة هي ما يصنع الدورات في المخطط.
//   إخراجها إلى ورقة حقيقية يكسر الدورة عند مصدرها لا عند أعراضها.
//
// القاعدة الحاكمة هنا: **لا شيء في هذه الوحدة يقرأ حالة عامة أو DOM.** مدخل ←
// مخرج. وهذا ما يجعلها ورقة صالحة للاستيراد من أي مكان بلا خوف من ترتيب التحميل.

/** ترميز نص ليُدرَج بأمان داخل HTML — خطّ الدفاع الأول ضد XSS في كل ما نبنيه نصيًا */
export function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/** تاريخ → «يوم/شهر» للعرض المختصر في الجداول والجانت */
export const fmt=d=>{const x=new Date(d);return('0'+x.getDate()).slice(-2)+'/'+('0'+(x.getMonth()+1)).slice(-2);};

/** تاريخ → ISO محلّي (YYYY-MM-DD) — محلّي لا UTC، فالإزاحة تُزحلق اليوم */
export const fmtY=d=>{const x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);};

/** تاريخ اليوم بصيغة ISO المحلية */
export function todayISO(){return fmtY(new Date());}

// ===== توليد معرّف نظيف (Slug) من اسم عربي — تقريب صوتي، يُعرض دائمًا كحقل قابل للتعديل =====
// لا يوجد تحويل آلي عربي↔لاتيني دقيق ١٠٠٪ (الحروف المتحركة القصيرة لا تُكتب عربيًا أصلًا)،
// فهذا تقريب معقول يُراجعه المستخدم ويُعدِّله يدويًا قبل الاعتماد — هذا قرار مقصود لا نقص.
//
// AR_TRANSLIT و transliterateArabic **لا تُصدَّران**: لا يستدعيهما أحد خارج هذا
// الملف، وكونهما كانتا عامّتين كان حادثًا معماريًا لا حاجة. هذا هو المكسب الملموس
// من كل تحويل — النطاق العام ينقص باسمين، وسطح ما يمكن أن يتصادم ينقص معه.
const AR_TRANSLIT={
  'أ':'a','إ':'i','آ':'a','ا':'a','ء':'','ئ':'e','ؤ':'o',
  'ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh',
  'ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh',
  'ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n',
  'ه':'h','و':'w','ي':'y','ة':'a','ى':'a',
  ' ':'-','_':'-','-':'-'
};

function transliterateArabic(s){
  return (s||'').split('').map(ch=>ch in AR_TRANSLIT?AR_TRANSLIT[ch]:(/[a-zA-Z0-9]/.test(ch)?ch:'')).join('');
}

export function slugify(name){
  return transliterateArabic(String(name||'').trim().toLowerCase())
    .replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'client';
}

/** معرّف فريد: يتحقق مقابل القائمة الحالية (CLIENTS)، ويضيف لاحقة رقمية عند التطابق */
export function uniqueSlug(name,existing){
  const base=slugify(name);
  const taken=new Set((existing||[]).map(c=>c.slug).filter(Boolean));
  if(!taken.has(base))return base;
  let i=2;while(taken.has(base+'-'+i))i++;
  return base+'-'+i;
}
