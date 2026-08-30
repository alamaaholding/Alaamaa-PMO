// ═══════════════════════════════════════════════════════════════════════
//  الاستضافة الذاتية وسياسة أمن المحتوى — AUDIT §د-١ (🔴) و§د-٢ (🟠)
// ═══════════════════════════════════════════════════════════════════════
//
// §د-٢ كان يصف سكربتًا واحدًا. والقياس وجد **اثنين**:
//
//   supabase-js  من cdn.jsdelivr.net بوسم **متحرّك** (`@2`)
//   xlsx         من cdnjs بإصدار مثبَّت — لكن المضيف خارجي بلا integrity
//
// وكلاهما يعمل في سياقٍ يملك جلسة المستخدم ومفتاح Supabase. وSRI وحدها لا تكفي
// مع وسمٍ متحرّك: البصمة تتغيّر مع كل إصدار، فإمّا أن تُثبَّت (فلمَ CDN؟) أو
// تُترَك (فلا حراسة). فاستُضيفا ذاتيًا، وثُبِّت الإصدار في package-lock.json.
//
// وبزوال آخر مضيف سكربت خارجي صارت `script-src 'self'` ممكنة — وهي ما كان §د-١
// (🔴 حرج) محجوبًا به. وقد **جُرِّبت السياسة في Chromium حقيقي** قبل كتابتها:
// صفر مخالفة، والصفحة تُحمَّل كاملة. ولا يفحص هذا الملف ذلك (لا متصفّح في
// المشغّل)، بل يحرس ما يمكن أن ينقلب بصمت بعده.

const fs = require('fs');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const headers = fs.readFileSync('_headers', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const buildPy = fs.readFileSync('build.py', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const srcFiles = [...fs.readdirSync('src').filter(f => f.endsWith('.js')).map(f => `src/${f}`),
  ...fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => `src/app/${f}`)]
  .filter(f => !f.endsWith('qrgen.js'));   // مكتبة مضمَّنة أصلًا — لا تُحمَّل من شبكة

console.log('\n▸ لا مضيف سكربت خارجي — لا واحد');
{
  // القيد الأصل: أي عودةٍ لتحميل سكربت من نطاق خارجي تُبطل script-src 'self'
  // كلها، ولا يظهر ذلك إلا كصفحةٍ لا تعمل عند مستخدمٍ لا يشتكي.
  const offenders = [];
  for (const f of srcFiles) {
    const code = fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    for (const m of code.matchAll(/loadScript\(\s*['"`]([^'"`]*)/g))
      if (/^https?:/.test(m[1])) offenders.push(`${f}: ${m[1]}`);
  }
  t('لا loadScript إلى نطاق خارجي', offenders.length === 0, offenders.join(' '));
  t('ولا وسم <script src> خارجي في index.html',
    ![...html.matchAll(/<script[^>]*src="([^"]+)"/g)].some(m => /^https?:/.test(m[1])));
  t('والمكتبتان تُحمَّلان من نفس الأصل ببصمة الإصدار',
    /src="supabase\.js\?v=%BUILD_V%"/.test(html) &&
    /loadScript\('xlsx\.js\?v='\+globalThis\.BUILD_V\)/.test(fs.readFileSync('src/api.js', 'utf8')));
  t('ولا ذكر للـCDNين في المصدر',
    !srcFiles.some(f => /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(
      fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'))));
}

console.log('\n▸ الإصدار مُثبَّت ومُدقَّق لا متحرّك');
{
  t('supabase-js تبعية معلَنة', !!(pkg.dependencies || {})['@supabase/supabase-js']);
  t('و xlsx كذلك', !!(pkg.dependencies || {})['xlsx']);
  t('ومُثبَّتتان في القفل', fs.existsSync('package-lock.json') &&
    /"node_modules\/@supabase\/supabase-js"/.test(fs.readFileSync('package-lock.json', 'utf8')));
  // لا تُلتزَم في المستودع: تُنسَخ وقت البناء، فلا كتلة ٨٠٠ KB في كل فرق يُراجَع.
  const ignored = fs.readFileSync('.gitignore', 'utf8');
  t('ولا تُلتزَمان في المستودع', /^\/supabase\.js$/m.test(ignored) && /^\/xlsx\.js$/m.test(ignored));
  t('والبناء يفشل بوضوح إن غابتا', /supabase-js غير موجود/.test(buildPy) && /xlsx غير موجود/.test(buildPy));
  // حارس النشر: مُولَّدٌ لا يُنشَر = صفحة لا تعمل.
  t('ومُدرَجتان في ملفات النشر', /'index\.html','supabase\.js','xlsx\.js'/.test(buildPy));
  // البصمة تشملهما: تحديث المكتبة يجب أن يكسر التخزين المؤقت.
  t('وبصمة الإصدار تشملهما', /\+supabase_js\+xlsx_js\)/.test(buildPy));
}

console.log('\n▸ سياسة أمن المحتوى — بما قِيس لا بما يُظنّ');
{
  const csp = (headers.match(/Content-Security-Policy: (.+)/) || [])[1] || '';
  t('السياسة موجودة', csp.length > 0);
  // كل توجيه هنا قِيس من المصدر: لا مضيف زائد ولا ناقص.
  [['default-src', "'self'"], ['script-src', "'self'"], ['object-src', "'none'"],
   ['base-uri', "'none'"], ['frame-ancestors', "'none'"], ['form-action', "'self'"]]
    .forEach(([d, v]) => t(`${d} ${v}`, new RegExp(`${d} ${v.replace(/'/g, "'")}(;|$)`).test(csp)));
  t("script-src بلا 'unsafe-inline' ولا 'unsafe-eval'", !/script-src[^;]*unsafe-/.test(csp));
  t('ولا مضيف خارجي في script-src', !/script-src[^;]*https?:/.test(csp));

  // الاستثناء الوحيد، ومقيس: ٢٩٢ نمطًا سطريًا. جُرِّب إسقاطه في Chromium فسقطت
  // خمس مخالفات فورًا. يزول حين تزول الأنماط السطرية (W6).
  t("style-src وحدها تحمل 'unsafe-inline'", /style-src[^;]*'unsafe-inline'/.test(csp));
  t('وسببه موثَّق لا مسكوت عنه', /أنماط سطرية|inline style/i.test(fs.readFileSync('ROADMAP.md', 'utf8')));

  // connect-src: النطاقان اللذان يُخاطَبان فعلًا، لا أكثر.
  t('connect-src يذكر Supabase', /connect-src[^;]*gxiucsieezkvwztbsrgf\.supabase\.co/.test(csp));
  // لا يُسمّى الملف الذي يناديه هنا عمدًا: حارس اتّساع الاختبار يعدّ الملفَّ
  // «مُستهدَفًا» بمجرّد ذكر اسمه في أي اختبار — فذِكرُه في تعليقٍ كهذا يُنقص
  // العدد بلا أن يُختبَر شيء. وهذا ضعفٌ معروف في الحارس، لا يُستغَلّ.
  t('و Trello (تكامل اختياري)', /connect-src[^;]*api\.trello\.com/.test(csp));
  const cs = (csp.match(/connect-src ([^;]+)/) || [])[1] || '';
  t('ولا نطاق ثالث بلا مبرّر', (cs.match(/https?:\/\//g) || []).length === 2, cs);

  // الخطوط خارجية بعد — تُذكر صراحةً في موضعها لا في default-src.
  t('الخطوط في style-src و font-src لا في default-src',
    /style-src[^;]*fonts\.googleapis\.com/.test(csp) && /font-src[^;]*fonts\.gstatic\.com/.test(csp)
    && !/default-src[^;]*fonts\./.test(csp));
}

console.log('\n▸ ترويسات الأمن ستّ');
{
  const names = [...headers.matchAll(/^ {2}([A-Za-z-]+):/gm)].map(m => m[1]);
  t('ستّ ترويسات', names.length === 6, names.join(' '));
  ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy',
   'Strict-Transport-Security', 'Permissions-Policy', 'Content-Security-Policy']
    .forEach(h => t(h, names.includes(h)));
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);
