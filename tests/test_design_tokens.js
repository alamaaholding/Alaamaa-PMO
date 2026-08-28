// ===== اختبار: نظام التصميم يستعيد سلطته (الموجة W4، الجزء الأول) =====
//
// ما يحرسه هذا الملف ثلاثة أمور، كلٌّ منها نشأ من قياس أو من عطل حقيقي:
//
// ١) فصل «سطح الصفحة» عن «نص فوق سطح ملوّن». كلاهما كان `#fff` حرفيًا في 86 موضعًا،
//    فلا يمكن تمييزهما آليًا — وهذا بالضبط ما يجعل الوضع الداكن مستحيلًا: قلبُ الأول
//    مطلوب، وقلبُ الثاني يجعل نص الرأس أبيض على أبيض.
// ٢) اختفاء onclick السطري. ليس تجميلًا: هو ما يفرض script-src 'unsafe-inline'
//    على أي CSP مستقبلية (AUDIT §د-١).
// ٣) عطل تخطيط مؤكَّد تجريبيًا: `#barClient` كان يحمل display:flex سطريًا، والمسار
//    العائد من المحفظة للمشروع يستعيده بـ`style.display=''` — وهي تحذف التصريح كليًا
//    فيسقط الشريط إلى display:block ويفقد تخطيطه المرن **نهائيًا** بعد أول انتقال.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const css = fs.readFileSync('src/styles.css', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');
const root = (css.match(/:root\{[\s\S]*?\n\}/) || [''])[0];
const body = css.replace(/:root\{[\s\S]*?\n\}/, '');

// ───────────────────────────────────────────────────────────
console.log('\n▸ الرموز: سطح الصفحة مفصول عن النص فوق سطح ملوّن');
// ───────────────────────────────────────────────────────────
t('الرمز --on-solid معرَّف في :root', root.includes('--on-solid:#fff'));
t('الرمز --paper معرَّف في :root', /--paper:\s*#fff/.test(root));
t('الأسطح تستخدم var(--paper) لا #fff حرفيًا', body.includes('background:var(--paper)'));
t('النص فوق سطح ملوّن يستخدم var(--on-solid)', body.includes('color:var(--on-solid)'));
t('لا يُخلط بين الرمزين: كلٌّ في خاصيته',
  !body.includes('background:var(--on-solid)') && !body.includes('color:var(--paper)'));

// الفصل ليس تجميليًا — هذا هو الاختبار الذي يثبت أنه يخدم الوضع الداكن فعلًا:
// عدد الأسطح المرمَّزة يجب أن يكون معتبرًا، وإلا فالترميز شكلي.
t('الترميز شمل معظم الأسطح لا عيّنة رمزية',
  (body.match(/background:var\(--paper\)/g) || []).length >= 30,
  (body.match(/background:var\(--paper\)/g) || []).length + ' سطحًا فقط');
t('الترميز شمل معظم النصوص فوق الأسطح الملوّنة',
  (body.match(/color:var\(--on-solid\)/g) || []).length >= 40,
  (body.match(/color:var\(--on-solid\)/g) || []).length + ' نصًّا فقط');

// استثناءان واعيان — يُحرسان كي لا يُلغَيا سهوًا لاحقًا
t('الطباعة تحتفظ بالأبيض الحرفي (الورق أبيض دائمًا)', /@media\s+print[\s\S]*?background:#fff/.test(css));
t('خلفية رمز QR تبقى بيضاء حرفيًا (الماسحات تشترطها)', css.includes('.cx-qr img{') && /\.cx-qr img\{[^}]*background:#fff/.test(css));

// ───────────────────────────────────────────────────────────
console.log('\n▸ الأصناف بديلًا عن الأنماط السطرية');
// ───────────────────────────────────────────────────────────
['gold', 'ok', 'blue', 'danger-soft', 'wide', 'pad'].forEach(tone =>
  t(`نغمة الزر .hbtn.${tone} معرَّفة`, css.includes(`.hbtn.${tone}{`)));
t('نغمات الأزرار تستخدم --on-solid لا #fff', /\.hbtn\.gold\{[^}]*color:var\(--on-solid\)/.test(css));
['rq-x', 'rqbody', 'rqnote', 'rqfield', 'rqrow', 'rqscroll'].forEach(c =>
  t(`صنف النافذة .${c} معرَّف`, css.includes(`.${c}{`)));
['w-sm', 'w-md', 'w-lg', 'w-xl'].forEach(w =>
  t(`عرض النافذة .rqmodal.${w} معرَّف`, css.includes(`.rqmodal.${w}{`)));

t('index.html لم يعد يكرّر ترميز زر الإغلاق سطريًا',
  !html.includes('background:none;border:none;color:#fff;font-size:1.3rem'));
t('زر إغلاق النافذة صار صنفًا مشتركًا', (html.match(/class="rq-x"/g) || []).length >= 8);
t('نافذة وصول الشريك تستخدم أصناف النافذة القياسية لا ترميزًا موازيًا',
  html.includes('id="accessOverlay" class="rqoverlay top"') && html.includes('class="rqmodal w-lg"'));

// السقف الحقيقي: ما تبقّى سطريًا في الهيكل هو إظهار/إخفاء تتحكّم فيه JS فقط
{
  const left = (html.match(/style="[^"]*"/g) || []);
  t('لم يبقَ في الهيكل نمط سطري غير display:none', left.every(s => s === 'style="display:none"'),
    left.filter(s => s !== 'style="display:none"').join(' | '));
}

// ───────────────────────────────────────────────────────────
console.log('\n▸ لا onclick سطري — شرط أي CSP بلا unsafe-inline');
// ───────────────────────────────────────────────────────────
t('صفر onclick سطري في الهيكل', !/onclick="/.test(html));
t('الإغلاق صار بسمة data-close', (html.match(/data-close="/g) || []).length >= 4);
t('معالج مفوَّض واحد يخدم كل النوافذ', main.includes("closest('[data-close]')"));

// السلوك نفسه لا وجود السمة فقط: النقر يغلق الطبقة فعلًا.
{
  const dom = new JSDOM('<div id="ov" style="display:flex"><button data-close="ov">✕</button></div>',
    { runScripts: 'dangerously' });
  const w = dom.window;
  const s = w.document.createElement('script');
  s.textContent = main.match(/document\.addEventListener\('click', e => \{[\s\S]*?\}\);/)[0];
  w.document.body.appendChild(s);
  w.document.querySelector('[data-close]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t('النقر على data-close يُخفي الطبقة فعليًا', w.document.getElementById('ov').style.display === 'none');
}

// ───────────────────────────────────────────────────────────
console.log('\n▸ عطل التخطيط: الشريط لا يفقد مرونته بعد أول انتقال');
// ───────────────────────────────────────────────────────────
t('barClient لم يعد يحمل display:flex سطريًا', !/id="barClient"[^>]*style="[^"]*display:flex/.test(html));
t('barClient يحمل الصنف بدلًا عنه', /id="barClient" class="barclient"/.test(html));
t('الصنف .barclient يعرّف التخطيط المرن', /\.barclient\{[^}]*display:flex/.test(css));

// إثبات العطل ومعالجته في آنٍ: التفريغ يرتدّ إلى الورقة النمطية بدل الفراغ.
{
  const dom = new JSDOM(`<style>.barclient{display:flex}</style>
    <div id="a" class="barclient"></div>
    <div id="b" style="display:flex;gap:14px"></div>`);
  const w = dom.window, D = w.document;
  ['a', 'b'].forEach(id => { const e = D.getElementById(id); e.style.display = 'none'; e.style.display = ''; });
  t('بالصنف: الشريط يستعيد display:flex بعد إخفاء/إظهار',
    w.getComputedStyle(D.getElementById('a')).display === 'flex');
  t('بالنمط السطري (السلوك القديم): كان يسقط إلى block — العطل مُثبَت',
    w.getComputedStyle(D.getElementById('b')).display === 'block');
}

// ═══ ترميز الألوان (W4) — الحدّ بين ما يُرمَّز وما لا يُرمَّز ═══
//
// الوضع الداكن يقوم على أن **كل** لون يمرّ برمز: لونٌ واحد صريح يبقى فاتحًا في
// الوضع الداكن ويكسر التباين حوله. فالسقف نزل من ٩١ إلى ١٢.
//
// والاثنا عشر الباقية **ليست بقايا عمل**، بل استثناءات مقصودة تُحرَس كي لا
// تُرمَّز يومًا بحسن نيّة:
{
  const css = require('fs').readFileSync('src/styles.css', 'utf8');
  const root = css.match(/:root\{[\s\S]*?\n\}/)[0];
  // تعريفات الرموز صارت في ثلاث كتل بعد الوضع الداكن (:root · [data-theme] ·
  // prefers-color-scheme)، فالمعيار محتوى الكتلة لا موضعها: كتلةٌ جسمها
  // تعريفاتُ رموز فقط هي تعريف أينما كانت — ويُنزَل في الكتل الأخرى لأنها
  // قد تلفّها (@media يلفّ :root:not(…)).
  const stripTokenBlocks = c => {
    let out = '', i = 0;
    while (i < c.length) {
      const open = c.indexOf('{', i);
      if (open === -1) { out += c.slice(i); break; }
      let d = 0, j = open;
      while (j < c.length) { if (c[j] === '{') d++; else if (c[j] === '}') { d--; if (!d) break; } j++; }
      if (j >= c.length) { out += c.slice(i); break; }
      const inner = c.slice(open + 1, j);
      const bare = inner.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const onlyTokens = bare.length > 0 && bare.split(';').map(x => x.trim()).filter(Boolean)
        .every(dcl => /^--[a-z0-9-]+\s*:/i.test(dcl) || /^color-scheme\s*:/i.test(dcl));
      out += c.slice(i, open) + (onlyTokens ? '{}' : '{' + stripTokenBlocks(inner) + '}');
      i = j + 1;
    }
    return out;
  };
  const body = stripTokenBlocks(css);

  // ١) داخل @media print: الورق أبيض دائمًا مهما كان وضع الشاشة. ترميزها يعني
  //    طباعة صفحة سوداء على من يفتح الوضع الداكن.
  const spans = [];
  for (const m of body.matchAll(/@media print\s*\{/g)) {
    let i = m.index + m[0].length - 1, d = 0, j = i;
    while (j < body.length) {
      if (body[j] === '{') d++;
      else if (body[j] === '}') { d--; if (!d) break; }
      j++;
    }
    spans.push([m.index, j]);
  }
  const inPrint = p => spans.some(([a, b]) => a <= p && p <= b);
  const hexes = [...body.matchAll(/#[0-9a-fA-F]{3,6}\b/g)];
  const screen = hexes.filter(m => !inPrint(m.index));
  const printed = hexes.filter(m => inPrint(m.index));

  t('ألوان الطباعة تبقى حرفية', printed.length > 0);
  // ٢) خلفية رمز QR: يجب أن تبقى بيضاء للماسحات — رمزٌ يقلبها يكسر المسح.
  t('خلفية رمز QR تبقى بيضاء حرفيًا', /\.cx-qr img\{[^}]*background:#fff/.test(body));
  t('ولا لون شاشة آخر خارج الرموز',
    screen.filter(m => !/\.cx-qr img\{[^}]*$/.test(body.slice(Math.max(0, m.index - 140), m.index))).length === 0,
    screen.map(m => m[0]).join(' '));

  // ٣) وكل رمز جديد له قيمة فعلية — رمز فارغ يُصيّر اللون شفافًا بلا خطأ.
  const names = [...root.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)];
  t('كل رمز له قيمة', names.every(m => m[2].trim().length > 0));
  t('الرموز الجديدة موجودة',
    ['--ink-head', '--sand-1', '--ok-tint-2', '--crit-tint-3', '--gold-deep', '--line-doc']
      .every(n => root.includes(n + ':')));
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);
