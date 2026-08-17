#!/usr/bin/env node
// ===== مشغّل اختبارات منصة علامة =====
// يبني المشروع أولًا (حتى تُختبر الحزمة المُولَّدة فعليًا لا المصدر وحده)، ثم يشغّل كل
// ملفات tests/*.js ويجمّع النتائج. يخرج برمز فشل إن أخفق أي اختبار — وهذا ما يوقف
// النشر في GitHub Actions.
//
// التشغيل:  npm test    (أو)    node tests/run.js
// الاختبارات تقرأ ملفات المشروع بمسارات نسبية من جذر المستودع، لذا يُثبَّت cwd هنا.

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', OFF = '\x1b[0m';

// ===== ١) البناء أولًا =====
console.log(`${BOLD}▸ بناء المشروع...${OFF}`);
try {
  execSync('python3 build.py', { stdio: 'pipe' });
} catch (e) {
  console.error(`${RED}✗ فشل البناء — لا يمكن تشغيل الاختبارات${OFF}`);
  console.error(String(e.stdout || '') + String(e.stderr || ''));
  process.exit(1);
}

// ===== ٢) فحص صياغي لكل ملفات JS المُولَّدة والمصدرية =====
console.log(`${BOLD}▸ فحص صياغي...${OFF}`);
const jsFiles = [
  'app.bundle.js', 'dol.js', 'importer.js', 'pgantt.js', 'timeline.js', 'trello.js', 'qrgen.js',
  ...fs.readdirSync('src').filter(f => f.endsWith('.js')).map(f => `src/${f}`),
  ...fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => `src/app/${f}`)
].filter(f => fs.existsSync(f));

let syntaxFailed = 0;
for (const f of jsFiles) {
  try { execFileSync('node', ['--check', f], { stdio: 'pipe' }); }
  catch (e) { console.error(`  ${RED}✗ خطأ صياغي: ${f}${OFF}`); syntaxFailed++; }
}
if (syntaxFailed) { console.error(`${RED}✗ ${syntaxFailed} ملفًا به خطأ صياغي${OFF}`); process.exit(1); }
console.log(`  ${GREEN}✓${OFF} ${jsFiles.length} ملفًا سليمًا صياغيًا`);

// ===== ٣) حارس النشر: كل ملف مُولَّد يجب أن يطابق مصدره بعد البناء =====
// يمنع تكرار خطأ حقيقي وقع سابقًا: نُشر src/styles.css ونُسي styles.css الجذري،
// فبقيت أنماط صفحة كاملة غائبة عن الموقع الحي رغم صحة الكود المصدري.
console.log(`${BOLD}▸ حارس تطابق الملفات المُولَّدة...${OFF}`);
const artifactPairs = [['src/styles.css', 'styles.css']];
let mismatched = 0;
for (const [src, out] of artifactPairs) {
  if (!fs.existsSync(src) || !fs.existsSync(out)) continue;
  if (fs.readFileSync(src, 'utf8') !== fs.readFileSync(out, 'utf8')) {
    console.error(`  ${RED}✗ ${out} لا يطابق ${src} — شغّل build.py وانشر كليهما معًا${OFF}`);
    mismatched++;
  }
}
if (mismatched) process.exit(1);
console.log(`  ${GREEN}✓${OFF} الملفات المُولَّدة مطابقة لمصادرها`);

// ===== ٤) حارس الاتّساع: عدد الملفات المصدرية التي لا يستهدفها أي اختبار لا يزيد =====
//
// لماذا هذا الحارس بدل قياس تغطية حقيقي (c8):
//   جُرِّب c8 فعليًا على هذه المجموعة فأعاد `0/0` — لا شيء. السبب بنيوي لا إعدادي:
//   الاختبارات التصييرية تحقن app.bundle.js كنص داخل نافذة jsdom
//   (`script.textContent = …`)، فلا يرى V8 ملفًا على القرص لينسب إليه التغطية.
//   والاختبارات النصية تقرأ المصدر كنص ولا تنفّذه أصلًا. القياس الحقيقي يتطلّب تحميل
//   الكود كوحدات — أي أنه **محجوب بالموجة W2** (وحدات ESM). راجع ROADMAP.md §W7.
//
// ما يقيسه هذا الحارس بدلًا عنه — بصدق وبلا مبالغة:
//   «كم ملفًا مصدريًا لا يستهدفه أي اختبار بالاسم».
//   هذا مؤشّر **استهداف مقصود** لا تنفيذ فعلي — أضعف من التغطية، لكنه حقيقي وقابل
//   للقياس اليوم، ويخدم مباشرةً ما رصده AUDIT.md §هـ-١. السقف ينقص ولا يزيد أبدًا.
console.log(`${BOLD}▸ حارس اتّساع الاختبار...${OFF}`);
const UNTESTED_CAP = 10;  // خط الأساس عند تفعيل الحارس (W0). كل موجة تُنقصه — ولا ترفعه.
const testSources = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
const srcFiles = [
  ...fs.readdirSync('src').filter(f => f.endsWith('.js')).map(f => `src/${f}`),
  ...fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => `src/app/${f}`)
].filter(f => !f.endsWith('qrgen.js'));   // مكتبة خارجية مضمَّنة — ليست كودنا
const untested = srcFiles.filter(f => !testSources.includes(path.basename(f)));
if (untested.length > UNTESTED_CAP) {
  console.error(`  ${RED}✗ ${untested.length} ملفًا بلا اختبار — السقف ${UNTESTED_CAP}. السقف ينقص ولا يزيد.${OFF}`);
  untested.forEach(f => console.error(`     ${f}`));
  process.exit(1);
}
if (untested.length < UNTESTED_CAP) {
  console.log(`  ${GREEN}✓${OFF} ${untested.length} ملفًا بلا اختبار — أقل من السقف (${UNTESTED_CAP}). ${BOLD}أنزِل UNTESTED_CAP إلى ${untested.length}.${OFF}`);
} else {
  console.log(`  ${GREEN}✓${OFF} ${untested.length} ملفًا بلا اختبار — عند السقف تمامًا (${UNTESTED_CAP})`);
}

// ===== ٥) حارسا نظام التصميم: سقفان يَنقصان ولا يزيدان =====
//
// سبب النشأة: نظام التصميم في styles.css قويّ (756 رمزًا)، لكن نصف القرارات البصرية
// كانت تُتّخذ خارجه — 548 نمطًا سطريًا و176 لونًا مكتوبًا صراحةً داخل الورقة نفسها.
// الأثر المقيس: تغيير --gold وحده كان يغيّر نصف الواجهة ويترك نصفها ذهبيًا.
// وللأنماط السطرية ثمن ثانٍ: تفرض 'unsafe-inline' في أي CSP، فتحجب إصلاحًا أمنيًا.
//
// الترحيل تدريجي بطبيعته (AUDIT §ب-١ · ROADMAP §W4)، فالحارس هو ما يجعله تدريجيًا
// **لا متراجعًا**: يُسمح بالنقصان دائمًا، ويُمنع النموّ دائمًا.
console.log(`${BOLD}▸ حارسا نظام التصميم...${OFF}`);
const INLINE_STYLE_CAP = 372;   // أنماط سطرية **ثابتة** فقط
const RAW_COLOR_CAP    = 91;    // ألوان صريحة خارج :root داخل styles.css

// الأنماط الديناميكية (التي تحمل قيمة محسوبة: عرض شريط، لون مسار) استعمال مشروع
// ولا تُحتسب — لا يمكن التعبير عنها بصنف ثابت أصلًا.
const styleSources = [
  ...fs.readdirSync('src').filter(f => f.endsWith('.js') && f !== 'qrgen.js').map(f => `src/${f}`),
  ...fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => `src/app/${f}`),
  'src/index.html'
];
let inlineStatic = 0;
for (const f of styleSources) {
  const hits = fs.readFileSync(f, 'utf8').match(/style="[^"]*"/g) || [];
  inlineStatic += hits.filter(h => !h.includes('${')).length;
}
// الألوان داخل :root هي التعريف نفسه — تُستثنى؛ والمقصود ما يلتفّ حولها.
const cssBody = fs.readFileSync('src/styles.css', 'utf8').replace(/:root\{[\s\S]*?\n\}/, '');
const rawColors = (cssBody.match(/#[0-9a-fA-F]{3,6}\b/g) || []).length;

let designFailed = 0;
const ratchet = (label, got, cap) => {
  if (got > cap) {
    console.error(`  ${RED}✗ ${label}: ${got} — السقف ${cap}. السقف ينقص ولا يزيد.${OFF}`);
    designFailed++;
  } else if (got < cap) {
    console.log(`  ${GREEN}✓${OFF} ${label}: ${got} (أقل من ${cap}). ${BOLD}أنزِل السقف إلى ${got}.${OFF}`);
  } else {
    console.log(`  ${GREEN}✓${OFF} ${label}: ${got} — عند السقف تمامًا`);
  }
};
ratchet('أنماط سطرية ثابتة', inlineStatic, INLINE_STYLE_CAP);
ratchet('ألوان صريحة خارج :root', rawColors, RAW_COLOR_CAP);
if (designFailed) process.exit(1);

// ===== ٦) تشغيل ملفات الاختبار =====
const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js')).sort();

if (!testFiles.length) { console.error(`${RED}✗ لا ملفات اختبار${OFF}`); process.exit(1); }

console.log(`${BOLD}▸ تشغيل ${testFiles.length} ملف اختبار...${OFF}\n`);

let totalPass = 0, totalFail = 0, failedFiles = [];
for (const f of testFiles) {
  let out = '', code = 0;
  try { out = execFileSync('node', [path.join('tests', f)], { encoding: 'utf8', timeout: 60000 }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); code = e.status || 1; }

  const m = out.match(/نجح (\d+)\s*·\s*فشل (\d+)/);
  const pass = m ? +m[1] : 0, fail = m ? +m[2] : (code ? 1 : 0);
  totalPass += pass; totalFail += fail;

  const name = f.replace(/^test_|\.js$/g, '').padEnd(26);
  if (fail || code) {
    failedFiles.push(f);
    console.log(`  ${RED}✗${OFF} ${name} ${RED}فشل ${fail}${OFF} · نجح ${pass}`);
    out.split('\n').filter(l => l.includes('✗')).slice(0, 5).forEach(l => console.log(`      ${DIM}${l.trim()}${OFF}`));
    if (!m) console.log(`      ${DIM}${out.trim().split('\n').slice(-3).join('\n      ')}${OFF}`);
  } else {
    console.log(`  ${GREEN}✓${OFF} ${name} ${GREEN}${pass}${OFF}`);
  }
}

console.log('\n' + '─'.repeat(46));
if (totalFail || failedFiles.length) {
  console.log(`${RED}${BOLD}فشل: ${totalFail} · نجح: ${totalPass}${OFF}`);
  console.log(`${RED}ملفات بها إخفاق: ${failedFiles.join(', ')}${OFF}`);
  process.exit(1);
}
console.log(`${GREEN}${BOLD}✓ نجح ${totalPass} · صفر فشل${OFF}`);
