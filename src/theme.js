// ═══════════════════════════════════════════════════════════════════════
//  theme.js — الوضع الفاتح والداكن (وحدة ESM · الموجة W4)
// ═══════════════════════════════════════════════════════════════════════
//
//  AUDIT §ب-٣. وقد كان تشخيصي الأول فيه **خاطئًا**: كتبتُ أن «البنية جاهزة
//  تمامًا» فتبيّن أن ٩١ لونًا صريحًا خارج :root — وهي التي كانت تبقى فاتحة
//  مهما قُلبت الرموز. أُصلح ذلك في الدفعة السابقة (٩١ ← ١٢)، فصار القلب
//  يقع في مكان واحد.
//
//  ═══ ثلاث حالات لا حالتان ═══
//    'light' · 'dark'  →  اختيار صريح يُحفظ ويُوسَم على <html>
//    'auto'            →  يتبع النظام، ولا يوسم شيئًا
//
//  والحالة الثالثة ليست ترفًا: من يفضّل الداكن في نظامه ثم يختار الفاتح هنا
//  يجب أن يُحترَم اختياره. ولهذا كتلة prefers-color-scheme في الورقة محروسة
//  بـ:not([data-theme="light"]) — بدونها يعجز عن ذلك تمامًا.
//
//  ═══ لماذا التطبيق قبل التصيير ═══
//  الوسم يُكتب على <html> في **أول سطر يُنفَّذ** من الحزمة، لا عند ربط الأزرار.
//  تأخيره إلى ما بعد بناء الصفحة يعني ومضة بيضاء يراها كل من يفتح المنصّة في
//  الوضع الداكن — وهي أسوأ ما في تطبيقات الوضع الداكن الرديئة.

const KEY = 'pmo_theme';
const ORDER = ['auto', 'light', 'dark'];
const LABEL = { auto: 'تلقائي (يتبع النظام)', light: 'فاتح', dark: 'داكن' };
const ICON = { auto: '◐', light: '☀', dark: '☾' };

/** القراءة لا تنهار حين يُحظر التخزين (وضع خاص) — ترجع 'auto'. */
export function getTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return ORDER.includes(v) ? v : 'auto';
  } catch (e) { return 'auto'; }
}

/** الوضع الفعلي المعروض الآن — يفكّ 'auto' إلى ما يقوله النظام. */
export function effectiveTheme() {
  const t = getTheme();
  if (t !== 'auto') return t;
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) { return 'light'; }
}

/**
 * تطبيق الوضع على <html>. 'auto' **يزيل** الوسم بدل أن يكتب قيمة — فتعود
 * الكتلة الشرطية في الورقة إلى العمل، ويتبع الوضعُ النظامَ حيًّا بلا إعادة تحميل.
 */
export function applyTheme(theme) {
  const t = ORDER.includes(theme) ? theme : 'auto';
  const el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
  return t;
}

export function setTheme(theme) {
  const t = applyTheme(theme);
  try { localStorage.setItem(KEY, t); } catch (e) {}
  refreshThemeButton();
  return t;
}

/** التالي في الدورة: تلقائي → فاتح → داكن → تلقائي */
export function cycleTheme() {
  return setTheme(ORDER[(ORDER.indexOf(getTheme()) + 1) % ORDER.length]);
}

export function refreshThemeButton() {
  const b = document.getElementById('themeBtn');
  if (!b) return;
  const t = getTheme();
  b.textContent = ICON[t];
  // الاسم يذكر الحالة **والتالي**، فمن يستعمل قارئ شاشة يعرف ماذا سيحدث بالنقر
  // بدل أن يجرّب. والزر دورةٌ لا مفتاح، فـaria-pressed لا يصفه.
  const next = ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];
  b.setAttribute('aria-label', `المظهر: ${LABEL[t]} — انقر للتبديل إلى ${LABEL[next]}`);
  b.setAttribute('title', LABEL[t]);
}

export function bindTheme() {
  const b = document.getElementById('themeBtn');
  if (b) b.onclick = cycleTheme;
  refreshThemeButton();
}

// يُطبَّق فورًا عند تحميل الوحدة — وهي أول ما يُنفَّذ في الحزمة.
applyTheme(getTheme());
