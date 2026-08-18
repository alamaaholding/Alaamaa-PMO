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
const ESM_FILES = new Set(['engine.js', 'bundle-entry.js']);
const isESM = f => ESM_FILES.has(f);
// صادرات الوحدات المُحوَّلة التي يجسرها bundle-entry.js إلى globalThis للكود القديم.
const ESM_BRIDGED = Object.fromEntries(
  ['D', 'setHolidays', 'isoLocal', 'isWorkday', 'isHoliday', 'wdBetween',
   'scheduleTasks', 'computeTracking'].map(n => [n, 'readonly']));

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
    ignores: [...ESM_FILES].map(f => `src/${f}`),
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, ...PROJECT_GLOBALS, ...VENDOR_GLOBALS }
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
    files: [...ESM_FILES].map(f => `src/${f}`),
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
      globals: (({ BUILD_V, ...rest }) => ({ ...globals.browser, ...rest, ...ESM_BRIDGED }))(VENDOR_GLOBALS)
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
