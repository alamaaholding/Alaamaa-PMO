// ═══════════════════════════════════════════════════════════════════════
//  src/taskpanel.js — لوحة البند · و`.hidden` ليست بديلًا عن display:none
// ═══════════════════════════════════════════════════════════════════════
//
// AUDIT §هـ-١: التغطية لا توازي المخاطر. وهذا الملف كان **بلا اختبار واحد**،
// وهو داخل دورة التبعية الأخيرة في W2 — أي أنه سيُحوَّل قريبًا بلا شبكة أمان.
// فيُختبَر **قبل** التحويل لا بعده: القاعدة الحاكمة الثالثة.
//
// وفيه أيضًا حارسٌ لعطلٍ كِدتُ أُحدثه في هذه الدفعة نفسها (أدناه).

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const bundle = fs.readFileSync('app.bundle.js', 'utf8');
const shell = fs.readFileSync('index.html', 'utf8')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(shell, { runScripts: 'dangerously', url: 'https://pmo.alaamaa.com/' });
const w = dom.window;
w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
const sc = w.document.createElement('script');
sc.textContent = bundle;
w.document.body.appendChild(sc);

w.eval(`
  toast=()=>{}; ROLE='pmo'; SCREEN='project';
  PROJECT={_dbId:'p1',name:'مشروع',tasks:[
    {id:'A1',_dbId:'d1',name:'بند أول',type:'task',duration:5,track:'1',status:'inprogress',
     depsX:[{ref:'A0',type:'FS',lag:0}],requirements:[{desc:'مستند',owner:'client',sla:2,_state:'pending'}]},
    {id:'A2',_dbId:'d2',name:'بند ثانٍ',type:'task',duration:3,track:'1',status:'notstarted',depsX:[],requirements:[]}
  ]};
  SCHED={R:{A1:{ES:new Date(),EF:new Date(),critical:true},A2:{ES:new Date(),EF:new Date(),critical:false}}};
  TRACK={A1:{},A2:{}};
`);

console.log('\n▸ الفتح والإغلاق');
{
  w.eval("openTaskPanel('A1');");
  eq('اللوحة تُفتح', w.document.getElementById('taskOverlay').style.display, 'flex');
  t('والعنوان يحمل معرّف البند واسمه',
    /A1 — بند أول/.test(w.document.getElementById('tkTitle').textContent));
  t('والتبويبات الخمسة تُصيَّر',
    w.document.querySelectorAll('#tkTabs .tktab').length === 5,
    w.document.querySelectorAll('#tkTabs .tktab').length + ' تبويبًا');

  // بندٌ غير موجود لا يفتح لوحةً فارغة — يُنبَّه ويُترَك ما هو مفتوح.
  w.eval("closeTaskPanel(); openTaskPanel('لا-يوجد');");
  eq('بند غير موجود لا يفتح اللوحة', w.document.getElementById('taskOverlay').style.display, 'none');
}

console.log('\n▸ العدّادات تعكس البيانات لا أرقامًا ثابتة');
{
  w.eval("openTaskPanel('A1');");
  eq('عدّاد التبعيات', w.eval("tkCount('deps')"), 1);
  eq('عدّاد المتطلبات', w.eval("tkCount('reqs')"), 1);
  eq('عدّاد النقاش قبل التحميل صفر', w.eval("tkCount('talk')"), 0);
  w.eval("openTaskPanel('A2');");
  eq('وبندٌ بلا تبعيات يعطي صفرًا', w.eval("tkCount('deps')"), 0);
}

console.log('\n▸ إعادة التركيز — قدرة إتاحةٍ تُفقَد بصمت');
{
  // اللوحة نافذة عائمة: عند إغلاقها يجب أن يعود التركيز إلى ما فُتحت منه، وإلا
  // ضاع موضع مستخدم لوحة المفاتيح في جدولٍ من مئات الصفوف.
  w.eval(`
    const b=document.createElement('button'); b.id='__opener';
    document.body.appendChild(b); b.focus();
    openTaskPanel('A1');
  `);
  w.eval("closeTaskPanel();");
  eq('التركيز يعود إلى العنصر الذي فُتحت منه', w.document.activeElement.id, '__opener');
  eq('واللوحة تُخفى', w.document.getElementById('taskOverlay').style.display, 'none');
}

console.log('\n▸ `.hidden` ليست بديلًا عن style="display:none"');
{
  // هذا حارسٌ لعطلٍ كِدتُ أُحدثه: `.hidden{display:none!important}` **أقوى** من
  // النمط السطري. فأي عنصر يُظهَر لاحقًا بـ`el.style.display=''` يبقى مخفيًّا
  // — بلا خطأ واحد، والـHTML صحيح والاختبارات خضراء.
  //
  // وستّة من أحد عشر موضعًا كانت ستنكسر: ثلاثة في staffaccess وواحد في
  // clienthome (تُلتقَط في متغيّرات ثم تُبدَّل)، و chnCustomFields، و sigTypeWrap
  // الذي **يُقرأ** display منه لتحديد وضع التوقيع.
  eq('.hidden تحمل !important فعلًا', /\.hidden\{display:none!important\}/.test(fs.readFileSync('src/styles.css', 'utf8')), true);

  const offenders = [];
  for (const d of ['src', 'src/app']) for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.js') || f === 'qrgen.js') continue;
    const s = fs.readFileSync(`${d}/${f}`, 'utf8');
    // كل عنصر يحمل class="hidden" وله id
    for (const m of s.matchAll(/<[a-z]+[^>]*\bid="([^"]+)"[^>]*class="[^"]*\bhidden\b[^"]*"[^>]*>/g)) {
      const id = m[1];
      // هل يُكتَب display عليه لاحقًا — مباشرةً أو عبر متغيّر مُلتقَط؟
      const direct = new RegExp(`getElementById\\('${id}'\\)\\.style\\.display|#${id}'\\)\\.style\\.display`).test(s);
      const capt = [...s.matchAll(new RegExp(`(\\w+)\\s*=\\s*\\$\\('#${id}'\\)`, 'g'))]
        .some(c => new RegExp(`(?<![\\w.$])${c[1]}\\.style\\.display`).test(s));
      if (direct || capt) offenders.push(`${f}:#${id}`);
    }
  }
  t('لا عنصر hidden يُظهَر لاحقًا بـstyle.display', offenders.length === 0, offenders.join(' '));

  // والخمسة الباقية مخفيّة دائمًا بحكم دورها: حقول تُقرأ بـ.value/.checked،
  // ومُدخَل ملفٍّ يُنقَر برمجيًّا. تُثبَّت كي لا ينمو العدد بلا فحص.
  // تُقرأ المصادر لا الحزمة: `impFile` يسكن **وحدة كسولة** خارج app.bundle.js
  // أصلًا، فالفحص على الحزمة كان سيفوّته بلا سبب ظاهر. (ولا يُسمّى ملفها هنا:
  // حارس اتّساع الاختبار يعدّ الملفَّ مُستهدَفًا بمجرّد ذكر اسمه، وهو ضعفٌ
  // معروف فيه لا يُستغَلّ.)
  const allSrc = ['src', 'src/app'].flatMap(d => fs.readdirSync(d)
    .filter(f => f.endsWith('.js') && f !== 'qrgen.js').map(f => fs.readFileSync(`${d}/${f}`, 'utf8'))).join('\n');
  const hidden = [...allSrc.matchAll(/id="([\w]+)"[^>]*class="[^"]*\bhidden\b/g)].map(m => m[1]);
  t('وعددها خمسة كما قِيس', new Set(hidden).size === 5, [...new Set(hidden)].join(' '));
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);
