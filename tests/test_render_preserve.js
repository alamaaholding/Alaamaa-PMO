// ===== اختبار: حفظ موضع المستخدم صار المسار الافتراضي (AUDIT §ج-١) =====
//
// سبب النشأة: preserveFocus حلٌّ ناضج ومُختبَر لمشكلة حقيقية — إعادة البناء تهدم DOM
// فيُصفَّر التمرير ويُفقد تركيز الحقل الذي كان المستخدم يكتب فيه، فتبدو الصفحة وكأنها
// «قفزت» أو أن ما كُتب «تصفّر». لكنه كان مطبَّقًا في **موضعين من 61** استدعاءً لرender().
// أي أن 59 مسارًا ظلّت تُسقط المستخدم من مكانه — وهي فجوة تعميم لا فجوة معرفة.
//
// ما يحرسه هذا الملف: أن العلاج **بنيوي** لا موضعي. لو عاد أحدهم فجعل render() تبني
// مباشرةً بلا غلاف، تسقط التأكيدات فورًا — بدل أن يعود العطل صامتًا عبر 59 مسارًا.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const views  = fs.readFileSync('src/views.js', 'utf8');
const config = fs.readFileSync('src/config.js', 'utf8');

console.log('\n▸ البنية: المسار الافتراضي هو الصحيح');
// صارت `export function render()` بتحويل views.js إلى وحدة — الشكل هو هو.
t('render() غلاف لا يبني بنفسه', /function render\(\)\{\s*preserveFocus\(renderNow\);\s*\}/.test(views));
t('البناء الفعلي انتقل إلى renderNow()', /function renderNow\(\)\{/.test(views));
t('لا تعريف ثانٍ لـrender', (views.match(/^(export )?function render\(\)/gm) || []).length === 1);
t('لا يبقى تغليف يدوي مكرَّر داخل views', !views.includes('preserveFocus(render)'));

// جوهر الإصلاح: كل موضع استدعاء ينال السلوك بلا أن يتذكّره كاتبه.
{
  const sites = (fs.readdirSync('src').filter(f => f.endsWith('.js') && f !== 'qrgen.js').map(f => `src/${f}`)
    .concat(fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => `src/app/${f}`)))
    .reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/\brender\(\)/g) || []).length, 0);
  t(`كل مواضع استدعاء render() (${sites}) تمرّ بالغلاف — لا استثناء`, sites > 50);
}

console.log('\n▸ السلوك: الموضع يُستعاد فعلًا');
{
  const dom = new JSDOM(`<div class="tablewrap" style="height:50px;overflow:auto">
      <div style="height:500px"><input id="f" data-f="name"></div></div>`);
  const w = dom.window, D = w.document;
  global.document = D; global.window = w;
  const src = config.match(/function preserveFocus\(rerenderFn\)\{[\s\S]*?\n\}/)[0];
  const preserveFocus = new Function('document', 'window', src + '; return preserveFocus;')(D, w);

  const wrap = D.querySelector('.tablewrap');
  wrap.scrollTop = 120;
  t('موضع التمرير يُحفَظ ويُستعاد عبر إعادة بناء لا تمسّ الحاوية',
    (preserveFocus(() => {}), wrap.scrollTop === 120), 'صار ' + wrap.scrollTop);

  // إعادة بناء حقيقية: الحقل يُهدَم ويُعاد — التركيز يجب أن يعود إليه
  const host = D.createElement('div');
  host.innerHTML = '<div data-id="A1"><input data-f="name" value="س"></div>';
  D.body.appendChild(host);
  host.querySelector('[data-f="name"]').focus();
  preserveFocus(() => { host.innerHTML = '<div data-id="A1"><input data-f="name" value="س"></div>'; });
  t('التركيز يعود للحقل نفسه بعد هدمه وإعادة بنائه',
    D.activeElement === host.querySelector('[data-f="name"]'));

  // وأنه لا يتشبّث بما لم يعد موجودًا (مسارات التنقّل)
  const gone = D.querySelector('.tablewrap');
  preserveFocus(() => { gone.remove(); });
  t('لا ينهار حين يختفي ما كان يُتابعه (مسار تنقّل)', true);
  delete global.document; delete global.window;
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);
