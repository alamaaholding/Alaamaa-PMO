// ===== ESLint — بوابة الجودة الآلية (الموجة W0) =====
//
// لماذا هذا الملف موجود:
//   `node --check` يمسك الصياغة فقط. لا يمسك متغيّرًا غير معرَّف، ولا متغيّرًا ميتًا،
//   ولا تحديثًا غير ذرّي على حالة عامة. وهذه بالضبط أنواع الأخطاء التي يُنتجها نطاق
//   عام فيه 400+ دالة (انظر AUDIT.md §أ-١ و§أ-٤).
//
// التحدّي المعماري:
//   المشروع لا يستخدم وحدات ESM بعد — build.py يدمج ملفات src نصيًا في نطاق واحد
//   مشترك. لذا `no-undef` على ملف مفرد سيبلّغ عن كل اسم مُعرَّف في ملف شقيق.
//   الحل هنا ليس تعطيل القاعدة (فتضيع قيمتها كلها)، بل **استخراج أسماء المستوى
//   الأعلى من كل ملفات المصدر آليًا** وتقديمها كـglobals. النتيجة:
//     • اسم غير موجود في أي ملف  → خطأ (وهذا ما نريد مسكه: الأخطاء المطبعية).
//     • اسم موجود في ملف شقيق    → مقبول (وهذا واقع المعمارية اليوم).
//   وحين تكتمل الموجة W2 (وحدات ESM حقيقية)، يُحذف هذا الاستخراج ويصير `no-undef`
//   دقيقًا لكل ملف على حدة بلا أي تنازل.
//
// الاستخراج آلي عبر espree (محلّل ESLint نفسه) لا بتعبير نمطي — لأن سطرًا مثل
// `let USER=null,ROLE=null,CLIENTS=[],…` في src/app/state.js يعرّف 18 اسمًا دفعة
// واحدة، والتعبير النمطي يخطئ فيه.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import js from '@eslint/js';
import globals from 'globals';
import { parse } from 'espree';

// ===== استخراج أسماء المستوى الأعلى من ملفات المصدر =====
const SRC_DIRS = ['src', 'src/app'];
// qrgen.js مكتبة خارجية مضمَّنة (vendored) — لا تخضع لقواعدنا ولا تُستخرج أسماؤها.
const VENDORED = new Set(['qrgen.js']);

// ═══ حدود الهجرة إلى ESM (الموجة W2) ═══
// القائمة هي **مقياس التقدّم**: كل اسم هنا ملف تحوّل إلى وحدة حقيقية. تنمو مع كل
// دفعة حتى تشمل الجميع، وعندها يُحذف استخراج الـglobals أدناه ويصير no-undef
// دقيقًا لكل ملف على حدة بلا أي تنازل.
const ESM_FILES = new Set(['engine.js', 'format.js', 'config.js', 'toast.js', 'api.js', 'notifications.js', 'undo.js', 'urlstate.js', 'skeleton.js', 'theme.js', 'dialogs.js',
  'contracttemplate.js', 'state.js', 'bundle-entry.js', 'chrome.js', 'exportcontract.js', 'screens.js', 'emptystate.js',
  'staffaccess.js', 'workload.js', 'contractsign.js', 'contractshub.js']);
const isESM = f => ESM_FILES.has(f);
// المسارات الفعلية: بعض الوحدات في src/ وبعضها في src/app/، والقائمة أعلاه بالاسم
// المجرّد كي يستخدمها الاستخراج أدناه (الذي يقرأ الأسماء لا المسارات). الفحص التالي
// يمنع الخطأ الصامت الوحيد الممكن هنا: اسم مكتوب خطأً يسقط من الكتلتين معًا فلا
// يُفحَص الملف بأي منهما.
const ESM_PATHS = SRC_DIRS.flatMap(d => readdirSync(d).filter(isESM).map(f => `${d}/${f}`));
if (ESM_PATHS.length !== ESM_FILES.size) {
  throw new Error(`ESM_FILES يذكر ${ESM_FILES.size} ملفًا ووُجد منها ${ESM_PATHS.length}: ${ESM_PATHS.join(' ')}`);
}
// صادرات الوحدات المُحوَّلة، تصل إلى الكود القديم عبر globalThis (bundle-entry.js).
//
// كانت قائمة يدوية. وقد نمت من ثمانية أسماء إلى أكثر من خمسين في ست دفعات، وكان
// تحويل api.js وحدها سيضيف ١٦٢ اسمًا آخر — أي أن الصيانة اليدوية كانت ستنهار في
// الدفعة التالية لا في دفعة بعيدة. والانهيار صامت بطبيعته: اسم منسيّ يظهر كـ
// no-undef زائف على الحزمة، فيُغري بإسكات القاعدة بدل إصلاح القائمة.
//
// فصارت **مشتقّة من المصدر**: تُقرأ صادرات كل ملف في ESM_FILES آليًا. لا قائمة
// تُحدَّث، ولا انحراف ممكن أصلًا — والملف الذي يتحوّل تدخل صادراته تلقائيًا.
// المصدر هو الجسر نفسه لا تخمينٌ عنه: يُقرأ `Object.assign(globalThis, …)` من
// bundle-entry.js، وتُتبَع كل وحدة مذكورة فيه إلى مسارها، وتُجمع صادراتها.
//
// والفارق ليس شكليًا: `state.js` تُصدّر getState/setState لكنها **لا تُمرَّر إلى
// Object.assign** — حالتها تصل بواصفات لا بنسخ. فاشتقاقٌ من «كل ملفات ESM» كان
// سيعلنهما globals وهما ليسا كذلك، فيسكت no-undef عن نداءٍ يفشل وقت التشغيل.
function collectBridgedExports() {
  const entrySrc = readFileSync('src/bundle-entry.js', 'utf8');
  const entry = parse(entrySrc, { ecmaVersion: 'latest', sourceType: 'module' });

  // أي وحدة استُوردت من أي مسار
  const sourceOf = new Map();
  for (const stmt of entry.body) {
    if (stmt.type !== 'ImportDeclaration') continue;
    for (const spec of stmt.specifiers) {
      if (spec.type === 'ImportNamespaceSpecifier') sourceOf.set(spec.local.name, stmt.source.value);
    }
  }

  // أي منها مرَّ فعلًا في Object.assign(globalThis, …)
  const spread = [], named = [];
  for (const stmt of entry.body) {
    const e = stmt.type === 'ExpressionStatement' ? stmt.expression : null;
    if (!e || e.type !== 'CallExpression') continue;
    const c = e.callee;
    if (c.type !== 'MemberExpression' || c.object.name !== 'Object' || c.property.name !== 'assign') continue;
    if (!e.arguments.length || e.arguments[0].name !== 'globalThis') continue;
    for (const a of e.arguments.slice(1)) {
      if (a.type === 'Identifier') { spread.push(a.name); continue; }
      // والجسر بالاسم: `Object.assign(globalThis, { savePFilters })`. يلزم لأن
      // state.js لا تُمرَّر كفضاء أسماء (حالتها بواصفات)، فتُجسَّر منها دالةٌ واحدة
      // صراحةً. وبدون هذا الفرع يظهر الاسم كـno-undef زائف فيُغري بإسكات القاعدة.
      if (a.type === 'ObjectExpression') {
        for (const prp of a.properties) {
          if (prp.type === 'Property' && prp.key && prp.key.name) named.push(prp.key.name);
        }
      }
    }
  }
  if (!spread.length) throw new Error('تعذّر قراءة Object.assign(globalThis, …) من bundle-entry.js');

  const out = {};
  for (const n of named) out[n] = 'readonly';
  for (const ns of spread) {
    const rel = sourceOf.get(ns);
    if (!rel) throw new Error(`الجسر يمرّر ${ns} ولا استيراد له في bundle-entry.js`);
    const path = join('src', rel.replace(/^\.\//, ''));
    const ast = parse(readFileSync(path, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    for (const stmt of ast.body) {
      if (stmt.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
      const d = stmt.declaration;
      if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') {
        if (d.id) out[d.id.name] = 'readonly';
      } else if (d.type === 'VariableDeclaration') {
        const names = new Set();
        d.declarations.forEach(x => boundNames(x.id, names));
        for (const n of names) out[n] = 'readonly';
      }
    }
  }
  return out;
}
const ESM_BRIDGED = collectBridgedExports();

// ═══ الحالة المشتركة — تصل عبر واصفات على globalThis (bundle-entry.js) ═══
// ليست صادرات تُنسَخ، فلا يراها الاستخراج أعلاه ولا أي تحليل ساكن. وتُعلَن هنا
// **writable** لا readonly لأن الكود القديم يكتب فيها فعلًا (٦٩ موضعًا).
// والقائمة تُقارَن آليًا بمصدرها أدناه: أي مفتاح يُضاف أو يُحذف في state.js بلا
// تحديث هنا يُوقف ESLint برسالة تسمّي الفرق — بدل أن يمرّ كـno-undef زائف، أو
// (وهو الأسوأ) كاسم مقبول بلا أساس.
const STATE_KEYS = ['USER', 'ROLE', 'IS_OWNER', 'CLIENTS', 'CID', 'PID', 'PROJECT',
  'SCHED', 'TRACK', 'DATA_DATE', 'PX', 'VIEW', 'SCREEN', 'TFILTER', 'FOCUS_REF', 'CRS', 'PFILTER', 'PSEARCH',
  'PEXPANDED', 'PALERTS', 'PSORT', 'MY_ACCESS', 'PROJ_DEPTS', 'PROJECT_ACCESS_DENIED'];
{
  const src = readFileSync('src/app/state.js', 'utf8');
  const body = src.slice(src.indexOf('const state = {'), src.indexOf('\n};'));
  const actual = [...body.matchAll(/^ {2}([A-Z_][A-Z0-9_]*):/gm)].map(m => m[1]);
  const diff = [...actual.filter(k => !STATE_KEYS.includes(k)).map(k => '+' + k),
                ...STATE_KEYS.filter(k => !actual.includes(k)).map(k => '-' + k)];
  if (diff.length) {
    throw new Error(`مفاتيح الحالة في eslint.config.mjs لا تطابق src/app/state.js: ${diff.join(' ')}`);
  }
}
const STATE_GLOBALS = Object.fromEntries(STATE_KEYS.map(n => [n, 'writable']));

function boundNames(node, out) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier': out.add(node.name); break;
    case 'ObjectPattern': node.properties.forEach(p => boundNames(p.value || p.argument, out)); break;
    case 'ArrayPattern': node.elements.forEach(e => boundNames(e, out)); break;
    case 'AssignmentPattern': boundNames(node.left, out); break;
    case 'RestElement': boundNames(node.argument, out); break;
    default: break;
  }
}

function collectTopLevelNames() {
  const names = new Set();
  for (const dir of SRC_DIRS) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.js') || VENDORED.has(file)) continue;
      const code = readFileSync(join(dir, file), 'utf8');
      const ast = parse(code, {
        ecmaVersion: 'latest',
        sourceType: isESM(file) ? 'module' : 'script',
        loc: false
      });
      for (const stmt of ast.body) {
        // الوحدات المُحوَّلة: صادراتها تصل للكود القديم عبر globalThis (bundle-entry.js)،
        // فتبقى globals من منظوره حتى يتحوّل بدوره. أما تعريفاتها الداخلية غير المُصدَّرة
        // فلا تُسرَّب — وهذا هو المكسب: كل تحويل يُنقص النطاق العام فعليًا.
        const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
        if (!decl) continue;
        if (stmt.type !== 'ExportNamedDeclaration' && isESM(file)) continue;
        if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
          if (decl.id) names.add(decl.id.name);
        } else if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach(d => boundNames(d.id, names));
        }
      }
    }
  }
  return names;
}

const PROJECT_GLOBALS = Object.fromEntries([...collectTopLevelNames()].map(n => [n, 'writable']));

// أطراف خارجية تُحمَّل عبر <script> أو تحميل كسول — ليست في أي ملف مصدر.
const VENDOR_GLOBALS = {
  supabase: 'readonly',   // @supabase/supabase-js عبر CDN
  XLSX: 'readonly',       // SheetJS — يُحمَّل كسولًا عند الاستيراد
  qrcode: 'readonly',     // qrgen.js المضمَّنة
  BUILD_V: 'readonly'     // تحقنها build.py في أول الحزمة
};

// ===== القواعد الحاسمة =====
// المعيار: كل قاعدة هنا تمسك خطأً **لا يمسكه `node --check`** ويظهر عند المستخدم
// وقت التشغيل. القواعد التجميلية مؤجَّلة عمدًا إلى ما بعد W2 (انظر ROADMAP.md).
const CRITICAL_RULES = {
  'no-undef': 'error',
  // `catch(e){}` المتعمَّد نمط قائم ومقصود في الكود (تعذّر الوصول لـlocalStorage مثلًا)
  'no-empty': ['error', { allowEmptyCatch: true }],
  // vars:'local' — يفحص المتغيّرات المحلية داخل الدوال فقط، ويتجاوز تعريفات المستوى
  // الأعلى. السبب معماري: دالة مُعرَّفة في engine.js ومُستخدَمة في views.js تبدو
  // «غير مستخدمة» عند فحص ملفها وحده. الكود الميت على مستوى التطبيق يُمسَك في فحص
  // app.bundle.js أدناه (vars:'all')، حيث النطاق كامل وحقيقي.
  'no-unused-vars': ['error', {
    vars: 'local',
    args: 'none',                 // معاملات غير مستخدمة شائعة في المعالجات — ضجيج بلا قيمة
    varsIgnorePattern: '^_',
    caughtErrors: 'none'          // `catch(e){}` المتعمَّد نمط قائم في الكود
  }],
  // allowProperties — القاعدة تبلّغ عن `obj.prop = x` بعد await كسباق محتمل، وهو في
  // كودنا نمط سليم وشائع (تحديث حقل في PROJECT بعد جلبه، أو نص زر بعد انتهاء عملية).
  // ما يهمّنا حقًا هو إعادة إسناد **متغيّر** بعد await — وهو سباق فعلي في نطاق عام مشترك.
  //
  // 'warn' لا 'error' — قرار مقصود ومؤقّت: البلاغات الباقية كلها نمط تخزين مؤقت واحد
  //   `if(CACHE) return CACHE;  CACHE = await fetch();`
  // (ROLES_CACHE · ORG_PROFILE · SA_MEMBERS_CACHE · CH_CONTRACTS · TRELLO_CREDS).
  // أسوأ أثره اليوم جلب مكرَّر لا فساد بيانات، وإصلاحه الصحيح (تخزين الوعد نفسه لا
  // نتيجته) **تغيير سلوك** — والموجة W0 لا تغيّر سلوكًا بحكم قاعدتها الحاكمة الثانية.
  // موضعه الصحيح W2، حيث تُجمع الحالة العامة في store واحد بدوال وصول صريحة.
  // حتى ذلك الحين: سقف `--max-warnings` في package.json يمنع نموّها ولا يسمح إلا بنقصها.
  'require-atomic-updates': ['warn', { allowProperties: true }],
  'no-async-promise-executor': 'error',
  'no-constant-binary-expression': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-unreachable-loop': 'error',
  'no-unsafe-optional-chaining': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error'
};

export default [
  {
    ignores: [
      'node_modules/**',
      // ملفات مُولَّدة — تُفحص عبر app.bundle.js وحدها (الحزمة هي النطاق الحقيقي)
      'dol.js', 'importer.js', 'pgantt.js', 'timeline.js', 'trello.js',
      'qrgen.js', 'src/qrgen.js',   // مكتبة خارجية مضمَّنة
      'coverage/**'
    ]
  },

  // ===== ملفات المصدر =====
  {
    files: ['src/**/*.js'],
    ignores: ESM_PATHS,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, ...PROJECT_GLOBALS, ...VENDOR_GLOBALS, ...STATE_GLOBALS }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...CRITICAL_RULES,
      // أثر جانبي لازم لحيلة الـglobals أعلاه: الملف الذي *يُعرِّف* الاسم يراه مُعرَّفًا
      // مسبقًا كـglobal فيبلّغ عن إعادة تعريف وهمية. القاعدة تبقى مفعَّلة حيث تكون
      // ذات معنى حقيقي — على app.bundle.js أدناه، حيث النطاق واحد فعلًا فيمسك
      // التعريف المزدوج الحقيقي عبر الملفات.
      'no-redeclare': 'off'
    }
  },

  // ===== الوحدات المُحوَّلة إلى ESM =====
  // هنا `no-undef` دقيق **بلا حيلة**: نطاق الوحدة مغلق، وكل اسم خارجي يجب أن يُستورَد
  // صراحةً. هذا هو المكسب الحقيقي من W2، وهذه الكتلة تنمو حتى تبتلع الكتلة أعلاها.
  {
    files: ESM_PATHS,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: { ...js.configs.recommended.rules, ...CRITICAL_RULES }
  },

  // ===== الحزمة المُولَّدة — النطاق الحقيقي وقت التشغيل =====
  // هنا وحدها يكون `no-undef` و`no-redeclare` دقيقين بلا تنازل: كل ملفات النواة في
  // نطاق واحد فعلًا، تمامًا كما يراها المتصفح. أي بلاغ هنا خطأ حقيقي سيقع عند المستخدم:
  // اسم غير معرَّف، أو تعريف مزدوج لنفس الاسم من ملفين مختلفين.
  {
    files: ['app.bundle.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      // BUILD_V ليست global هنا — build.py تُصرّح بها في أول الحزمة نفسها.
      // وصادرات وحدات ESM تصل إلى النطاق عبر `Object.assign(globalThis, …)` وقت
      // التشغيل — وهو ما لا يراه التحليل الساكن. تُعلَن هنا صراحةً، والقائمة **تتقلّص**
      // مع كل ملف يتحوّل ويستورد بدل أن يقرأ من globalThis، حتى تختفي مع اكتمال W2.
      // eslint-disable-next-line no-unused-vars
      globals: (({ BUILD_V, ...rest }) => ({ ...globals.browser, ...rest, ...ESM_BRIDGED, ...STATE_GLOBALS }))(VENDOR_GLOBALS)
    },
    rules: { ...js.configs.recommended.rules, ...CRITICAL_RULES }
  },

  // ===== الاختبارات =====
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: { ...js.configs.recommended.rules, ...CRITICAL_RULES }
  },

  // ===== إعداد ESLint نفسه =====
  {
    files: ['eslint.config.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { ...js.configs.recommended.rules }
  }
];
