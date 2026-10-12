(()=>{const $=(s,e=document)=>e.querySelector(s),$$=(s,e=document)=>[...e.querySelectorAll(s)],app=$("#app"),toast=$("#toast");
const store={get(k,d){try{return JSON.parse(localStorage.getItem("pddplus:"+k))??d}catch{return d}},set(k,v){localStorage.setItem("pddplus:"+k,JSON.stringify(v))}};
const synced=store.get("syncedData",null);
const hasCompatibleSync=!!(synced&&synced.schemaVersion===2);
if(hasCompatibleSync){
  if(Array.isArray(synced.questions)&&synced.questions.length)window.PDD_QUESTIONS=synced.questions;
  if(Array.isArray(synced.signs)&&synced.signs.length)window.ROAD_SIGNS=synced.signs;
  if(Array.isArray(synced.cars)&&synced.cars.length)window.CAR_CATALOG=synced.cars;
}
const BANK_KEY=hasCompatibleSync?`sync:${synced.version}`:"pdf:pddmaster-12.1";
const st={answers:store.get("answers:"+BANK_KEY,[]),mistakes:store.get("mistakes:"+BANK_KEY,[]),favorites:store.get("favorites:"+BANK_KEY,[]),exam:null,deferred:null};
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

const MEDIA_API="https://commons.wikimedia.org/w/api.php";
const mediaMem=new Map();
function mediaCacheGet(k){try{return JSON.parse(localStorage.getItem("pddplus:media:"+k)||"null")}catch{return null}}
function mediaCacheSet(k,v){try{localStorage.setItem("pddplus:media:"+k,JSON.stringify(v))}catch{}}
function normToken(v){return String(v||"").toLowerCase().replace(/[_()\-]+/g," ").replace(/\s+/g," ").trim()}
function scoreMedia(page,tokens,kind){
  const title=normToken(page.title),info=page.imageinfo?.[0]||{},mime=String(info.mime||"");
  let score=0;
  tokens.filter(Boolean).forEach(t=>{const n=normToken(t);if(n&&title.includes(n))score+=7});
  if(kind==="sign"){
    if(/svg/.test(mime))score+=8;
    if(/road|traffic|sign|russia|russian|\bru\b/.test(title))score+=5;
  }else{
    if(/jpeg|jpg|webp|png/.test(mime))score+=5;
    if(/logo|emblem|badge|diagram|drawing|icon/.test(title))score-=12;
  }
  if(info.thumbwidth&&info.thumbheight){
    const ratio=info.thumbwidth/info.thumbheight;
    if(kind==="car"&&ratio>1.15)score+=3;
    if(kind==="scene"&&ratio>1.2)score+=2;
  }
  return score
}
async function commonsSearch(query,kind="scene",tokens=[]){
  const key=`${kind}:${query}`;
  if(mediaMem.has(key))return mediaMem.get(key);
  const cached=mediaCacheGet(key);if(cached){mediaMem.set(key,cached);return cached}
  const u=new URL(MEDIA_API);
  u.searchParams.set("action","query");
  u.searchParams.set("generator","search");
  u.searchParams.set("gsrsearch",query);
  u.searchParams.set("gsrnamespace","6");
  u.searchParams.set("gsrlimit","12");
  u.searchParams.set("prop","imageinfo");
  u.searchParams.set("iiprop","url|mime|extmetadata");
  u.searchParams.set("iiurlwidth",kind==="sign"?"700":"1400");
  u.searchParams.set("format","json");
  u.searchParams.set("origin","*");
  try{
    const r=await fetch(u,{cache:"force-cache"});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const j=await r.json(),pages=Object.values(j.query?.pages||{});
    let cand=pages.filter(p=>p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url);
    if(kind==="car")cand=cand.filter(p=>!/svg/.test(String(p.imageinfo?.[0]?.mime||"")));
    cand.sort((a,b)=>scoreMedia(b,tokens,kind)-scoreMedia(a,tokens,kind));
    const p=cand[0];if(!p)return null;
    const i=p.imageinfo[0],meta=i.extmetadata||{};
    const out={
      url:i.thumburl||i.url,
      original:i.url,
      page:i.descriptionurl||("https://commons.wikimedia.org/wiki/"+encodeURIComponent(String(p.title||"").replace(/ /g,"_"))),
      title:p.title||"",
      license:meta.LicenseShortName?.value||"",
      artist:String(meta.Artist?.value||"").replace(/<[^>]*>/g,"").slice(0,120)
    };
    mediaMem.set(key,out);mediaCacheSet(key,out);return out
  }catch(err){return null}
}
function mediaCredit(el,m){
  if(!m?.page)return;
  let c=el.querySelector(".media-credit");
  if(!c){c=document.createElement("a");c.className="media-credit";c.target="_blank";c.rel="noopener";el.appendChild(c)}
  c.href=m.page;c.textContent=m.license?`Wikimedia Commons · ${m.license}`:"Wikimedia Commons ↗"
}
async function hydrateSign(el){
  if(el.dataset.mediaRequested)return;el.dataset.mediaRequested="1";
  const id=el.dataset.signId,name=el.dataset.signName||"",tokens=[id,name,"Russia","road sign"];
  const queries=[
    `"${id}" "${name}" Russia road sign`,
    `Russia road sign ${id}`,
    `Russian traffic sign ${id} ${name}`,
    `${id} ${name} traffic sign`
  ];
  for(const q of queries){
    const m=await commonsSearch(q,"sign",tokens);
    if(m){
      let img=el.querySelector("img.real-media");
      if(!img){img=document.createElement("img");img.className="real-media";img.alt=name;el.appendChild(img)}
      img.src=m.url;img.onload=()=>el.classList.add("real-loaded");mediaCredit(el,m);return
    }
  }
}
async function hydrateCar(el){
  if(el.dataset.mediaRequested)return;el.dataset.mediaRequested="1";
  const make=el.dataset.make||"",model=el.dataset.model||"",gen=el.dataset.generation||"";
  const tokens=[make,model,gen];
  const queries=[
    `${make} ${model} ${gen} automobile`,
    `${make} ${model} ${gen}`,
    `${make} ${model} car`
  ];
  for(const q of queries){
    const m=await commonsSearch(q,"car",tokens);
    if(m){
      let img=el.querySelector("img.real-car-img");
      if(!img){img=document.createElement("img");img.className="real-car-img real-media";img.alt=`${make} ${model} ${gen}`;el.appendChild(img)}
      img.src=m.url;img.onload=()=>el.classList.add("real-loaded");mediaCredit(el,m);return
    }
  }
}
function sceneQuery(topic,q){
  const map={
    "Светофоры":"traffic light road Russia",
    "Пешеходы":"pedestrian crossing road Russia",
    "Железнодорожные переезды":"railway crossing road Russia",
    "Обгон":"car overtaking road",
    "Остановка и стоянка":"car parking road Russia",
    "Перекрёстки":"road intersection Russia traffic",
    "Автомагистраль":"motorway Russia road",
    "Туман":"fog road traffic",
    "Скользкая дорога":"icy slippery road traffic",
    "Мотоциклы":"motorcycle road traffic",
    "Ремни безопасности":"car seat belt driver",
    "Дети":"child car seat",
    "Дождь":"rain road driving",
    "Маневрирование":"car turning intersection",
    "Повороты":"car turning intersection",
    "Перестроение":"lane change traffic",
    "Разворот":"road U-turn traffic",
    "Задний ход":"car reversing parking",
    "Спецтранспорт":"ambulance road traffic",
    "Тоннель":"road tunnel traffic",
    "Велосипедисты":"cyclist road traffic",
    "СИМ":"electric scooter road traffic",
    "Категория M":"moped road traffic",
    "Груз":"secured cargo vehicle",
    "Обзор":"driver visibility road",
    "Скорость":"road speed traffic",
    "Приоритет":"road intersection priority",
    "Начало движения":"car entering road",
    "Дистанция":"cars following distance traffic",
    "Разметка":"road markings traffic",
    "Регулировщик":"traffic police intersection",
    "Неисправности":"car breakdown road",
    "Аварийная сигнализация":"hazard lights car road",
    "Первая помощь":"road accident first aid",
    "Звуковой сигнал":"car horn traffic",
    "Полоса движения":"traffic lane road",
    "Зима":"winter road traffic",
    "ДТП":"road traffic accident",
    "Техническое состояние":"car tyre road",
    "Усталость":"driver fatigue road",
    "Телефон":"driver mobile phone car",
    "Пассажиры":"car passengers seat belt",
    "Боковой интервал":"cars passing cyclist road",
    "Ослепление":"night driving headlights",
    "Аквапланирование":"wet road car",
    "Парковка":"car parking road",
    "Шлагбаум":"railway crossing barrier Russia",
    "Обочина":"road shoulder traffic",
    "Дальний свет":"car headlights night road",
    "Преимущество":"road intersection traffic",
    "Общие положения":"road traffic Russia"
  };
  return map[topic]||`${topic||""} road traffic Russia`
}
async function hydrateScene(el){
  if(el.dataset.mediaRequested)return;el.dataset.mediaRequested="1";
  const topic=el.dataset.topic||"",question=el.dataset.question||"";
  const query=sceneQuery(topic,question),tokens=normToken(query).split(" ").slice(0,5);
  const m=await commonsSearch(query,"scene",tokens);
  if(m){
    let img=el.querySelector("img.real-scene-img");
    if(!img){img=document.createElement("img");img.className="real-scene-img real-media";img.alt="Фото-иллюстрация к теме";el.appendChild(img)}
    img.src=m.url;img.onload=()=>el.classList.add("real-loaded");
    let note=el.querySelector(".photo-illustration-note");
    if(!note){note=document.createElement("span");note.className="photo-illustration-note";note.textContent="Фото-иллюстрация";el.appendChild(note)}
    mediaCredit(el,m)
  }
}
function hydrateMedia(){
  document.querySelectorAll(".sign-media[data-sign-id]").forEach(hydrateSign);
  document.querySelectorAll(".car-art[data-make]").forEach(hydrateCar);
  document.querySelectorAll(".question-media[data-topic]").forEach(hydrateScene);
}

function signKind(cat=""){if(cat.includes("Предупреж"))return"warning";if(cat.includes("Запрещ"))return"ban";if(cat.includes("Приоритет"))return"priority";if(cat.includes("Предпис"))return"mandatory";if(cat.includes("Сервис"))return"service";return"info"}
function signVisual(s,extra=""){
  if(!s)return"";
  return `<figure class="sign-media ${extra} source-sign-media">
    <img class="source-sign-img" src="${s.image}" alt="${esc(s.name)}" loading="lazy" onerror="PDD.mediaError(this)">
    <figcaption>${esc(s.id)} · стр. ${s.sourcePage||"—"}</figcaption>
  </figure>`
}
function signFromQuestion(q){
  const m=String(q.q||"").match(/(?:знак(?:и)?\s*)(\d+(?:\.\d+){1,2})/i);
  return m?ROAD_SIGNS.find(s=>s.id===m[1])||null:null
}

function imgNext(img){
  let arr=[];try{arr=JSON.parse(decodeURIComponent(img.dataset.sources||"%5B%5D"))}catch{}
  let i=(Number(img.dataset.sourceIndex)||0)+1;
  if(i<arr.length){img.dataset.sourceIndex=String(i);img.src=arr[i];return}
  img.remove()
}
function qMedia(q){
  if(q.sourceKind==="uploaded_pdf"){
    if(!q.image)return "";
    return `<figure class="question-media official-ticket-media">
      <img src="${q.image}" alt="Иллюстрация из исходного PDF к билету ${q.ticket}, вопросу ${q.questionNo}" loading="eager" onerror="PDD.mediaError(this)">
      <figcaption>Билет ${q.ticket} · вопрос ${q.questionNo} · изображение из исходного PDF</figcaption>
    </figure>`
  }
  if(q._markingId){
    const m=ROAD_MARKINGS.find(x=>x.id===q._markingId);
    return m?`<figure class="question-media source-reference-media"><img src="${m.image}" alt="Разметка ${esc(m.id)}" onerror="PDD.mediaError(this)"><figcaption>razmetka.pdf · стр. ${m.sourcePage}</figcaption></figure>`:""
  }
  if(q._signId){
    const s=ROAD_SIGNS.find(x=>x.id===q._signId);return s?signVisual(s,"question-sign actual-sign"):""
  }
  return q.image?`<div class="question-media"><img src="${q.image}" alt="Иллюстрация к вопросу"></div>`:""
}
function qNavigator(e){
  return `<div class="qnav">${e.qs.map((_,i)=>`<span class="qnum ${i===e.i?"current":""} ${i<e.i?"done":""}">${i+1}</span>`).join("")}</div>`
}
function buildSignTest(cat=""){
  const visual=ROAD_SIGNS.filter(s=>(!cat||s.cat===cat)&&(s.imageLocal||(s.imageCandidates&&s.imageCandidates.length)));
  const chosen=[...visual].sort(()=>Math.random()-.5).slice(0,Math.min(20,visual.length));
  return chosen.map((s,idx)=>{
    let same=ROAD_SIGNS.filter(x=>(x.cat===s.cat)&&x.id!==s.id);
    let distract=[...same].sort(()=>Math.random()-.5).slice(0,3);
    if(distract.length<3)distract.push(...ROAD_SIGNS.filter(x=>x.id!==s.id&&!distract.includes(x)).sort(()=>Math.random()-.5).slice(0,3-distract.length));
    let answers=[s.name,...distract.map(x=>x.name)].sort(()=>Math.random()-.5);
    return {id:`sign-${s.id}-${idx}`,topic:s.cat,q:"Что означает этот дорожный знак?",answers,correct:answers.indexOf(s.name),explain:`Знак ${s.id} «${s.name}».`,_signId:s.id,imageType:"sign",official:false,type:"sign_name"};
  })
}


function buildMarkingTest(){
  const chosen=[...ROAD_MARKINGS].sort(()=>Math.random()-.5).slice(0,Math.min(20,ROAD_MARKINGS.length));
  return chosen.map((m,idx)=>{
    const others=ROAD_MARKINGS.filter(x=>x.id!==m.id).sort(()=>Math.random()-.5).slice(0,3);
    const answers=[m.id,...others.map(x=>x.id)].sort(()=>Math.random()-.5);
    return {id:`mark-${m.id}-${idx}`,topic:"Дорожная разметка",q:"Какой номер имеет изображённая дорожная разметка?",answers,correct:answers.indexOf(m.id),explain:`Это разметка ${m.id}. ${m.meaning||""}`,_markingId:m.id,official:false,type:"marking"};
  })
}

function carArt(c,g,extra=""){
  const body=String((g&&g.body)||"").toLowerCase();
  const suv=/suv|кроссовер|внедорож/.test(body);
  const hatch=/хэтчбек|лифтбек/.test(body);
  const van=/универсал/.test(body);
  const path=suv
    ? "M52 144 C64 108 88 91 129 86 L165 52 C179 39 199 33 226 33 L367 33 C399 34 423 46 444 69 L477 105 C498 111 512 124 518 144 L518 158 L486 158 C480 129 460 112 430 112 C400 112 380 129 374 158 L186 158 C180 129 160 112 130 112 C100 112 80 129 74 158 L48 158 Z"
    : hatch
    ? "M48 145 C59 113 84 97 124 92 L199 49 C214 40 232 36 254 36 L356 39 C386 41 408 53 427 78 L458 108 C486 113 505 126 511 145 L511 158 L481 158 C475 130 455 113 426 113 C397 113 377 130 371 158 L184 158 C178 130 158 113 129 113 C100 113 80 130 74 158 L47 158 Z"
    : van
    ? "M48 145 C60 111 87 93 132 88 L194 48 C209 39 229 35 254 35 L382 35 C407 37 428 49 445 73 L474 107 C496 113 509 125 515 145 L515 158 L485 158 C479 130 459 113 430 113 C401 113 381 130 375 158 L184 158 C178 130 158 113 129 113 C100 113 80 130 74 158 L47 158 Z"
    : "M48 145 C60 113 87 98 132 92 L210 54 C228 44 250 38 278 38 L362 40 C389 42 411 55 432 79 L460 108 C487 113 505 126 511 145 L511 158 L481 158 C475 130 455 113 426 113 C397 113 377 130 371 158 L184 158 C178 130 158 113 129 113 C100 113 80 130 74 158 L47 158 Z";
  return `<div class="car-art ${extra}" data-make="${esc(c.make)}" data-model="${esc(c.model)}" data-generation="${esc((g&&g.name)||c.generations?.[0]?.name||"")}"><span class="media-status car-media-status">ищем фото…</span>
    <div class="car-art-head"><span>${esc(c.make)}</span><b>${esc(c.model)}</b></div>
    <svg viewBox="0 0 560 210" aria-hidden="true">
      <path class="car-body-shape" d="${path}"></path>
      <circle class="car-wheel" cx="130" cy="158" r="31"></circle>
      <circle class="car-wheel" cx="430" cy="158" r="31"></circle>
      <circle class="car-hub" cx="130" cy="158" r="13"></circle>
      <circle class="car-hub" cx="430" cy="158" r="13"></circle>
      <path class="car-window" d="M199 85 L232 57 C243 49 258 47 277 47 L353 48 C371 49 388 57 402 73 L414 86 Z"></path>
      <path class="car-highlight" d="M78 139 C160 118 330 111 487 134"></path>
    </svg>
    <div class="car-art-foot"><span>${esc((g&&g.name)||c.generations?.[0]?.name||"")}</span><span>${esc((g&&g.years)||c.generations?.[0]?.years||"")}</span></div>
  </div>`
}


function mediaError(img){
  const box=img.closest("figure,.question-media,.marking-media,.source-sign-media,.rule-sign-img");
  const src=img.getAttribute("src")||"";
  img.remove();
  if(box&&!box.querySelector(".asset-error")){
    const d=document.createElement("div");
    d.className="asset-error";
    d.innerHTML=`<b>Изображение не найдено</b><small>${esc(src)}</small>`;
    box.appendChild(d);
  }
}

function msg(t){toast.textContent=t;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1700)}
function theme(){let x=store.get("theme","auto");document.documentElement.dataset.theme=x;$("#themeBtn").onclick=()=>{x=x==="auto"?"dark":x==="dark"?"light":"auto";document.documentElement.dataset.theme=x;store.set("theme",x);msg(x==="auto"?"Системная тема":x==="dark"?"Тёмная тема":"Светлая тема")}}
function p(){let c=st.answers.filter(x=>x.ok).length;return{pct:st.answers.length?Math.round(c/st.answers.length*100):0}}
function shell(t,l,b){return `<section class="page"><div class="section-head"><div><span class="tag">ПДД+ · Россия · A/B/M</span><h2 style="font-size:clamp(30px,5vw,52px);letter-spacing:-.05em;margin:12px 0 5px">${esc(t)}</h2><p class="lead">${l}</p></div></div>${b}</section>`}
function home(){
  let z=p(),source=hasCompatibleSync?`онлайн · ${esc(synced.version)}`:"PDF-источники";
  app.innerHTML=`<section class="page">
  <div class="hero glass"><div class="hero-copy"><span class="tag">A · B · M / PWA / ${source}</span><h1>ПДД<span style="color:var(--accent)">+</span></h1>
  <p class="lead">Билеты, полный текст ПДД, дорожные знаки и разметка собраны из предоставленных PDF и работают локально.</p>
  <div class="actions"><a class="btn btn-primary" href="#tickets">40 билетов →</a><a class="btn" href="#rules">Читать ПДД</a><a class="btn" href="#signs">Знаки</a><a class="btn" href="#markings">Разметка</a></div></div>
  <aside class="hero-side glass"><div class="micro">Точность</div><div class="big-num">${z.pct}%</div><div class="progress"><i style="width:${z.pct}%"></i></div><div class="micro">${st.answers.length} ответов · ${st.mistakes.length} ошибок</div></aside></div>

  <div class="section-head"><div><h3>База ПДД+</h3><p>исходные документы внутри приложения</p></div></div>
  <div class="grid g3">
    <a class="card glass card-link" href="#tickets"><div class="feature-icon">800</div><h3>Экзаменационные билеты</h3><p class="muted">40 × 20 вопросов и 548 исходных иллюстраций.</p></a>
    <a class="card glass card-link" href="#rules"><div class="feature-icon">61</div><h3>Правила ПДД</h3><p class="muted">${PDD_RULES.length} страниц текста с поиском и ссылкой на исходный PDF.</p></a>
    <a class="card glass card-link" href="#signs"><div class="feature-icon">${ROAD_SIGNS.length}</div><h3>Дорожные знаки</h3><p class="muted">${ROAD_SIGNS.length} изображений, извлечённых из znaki.pdf.</p></a>
    <a class="card glass card-link" href="#markings"><div class="feature-icon">${ROAD_MARKINGS.length}</div><h3>Разметка</h3><p class="muted">${ROAD_MARKINGS.length} элементов горизонтальной и вертикальной разметки.</p></a>
    <a class="card glass card-link" href="#trainer"><div class="feature-icon">✓</div><h3>Тренировки</h3><p class="muted">Экзамен, тест дня, марафон, знаки и разметка.</p></a>
    <a class="card glass card-link" href="#data"><div class="feature-icon">PDF</div><h3>Источники</h3><p class="muted">Статус импорта и ссылки на документы.</p></a>
  </div>
  <div class="notice section">Документы «Правила», «Знаки» и «Разметка» помечены в самих PDF как обновлённые 1 марта 2023 года. Сайт воспроизводит предоставленные материалы и не подменяет их более новыми данными.</div>
  </section>`
}
function trainer(){
  app.innerHTML=shell("Тренажёр","Режимы поверх импортированного банка из 800 вопросов.",`
  <div class="grid g4 section">
    <button class="card glass mode-card" onclick="PDD.start()"><div class="feature-icon">20</div><h3>Экзамен</h3><p class="muted">20 случайных вопросов из PDF.</p></button>
    <a class="card glass card-link" href="#tickets"><div class="feature-icon">40</div><h3>Билеты</h3><p class="muted">40 × 20 в исходной нумерации PDF.</p></a>
    <button class="card glass mode-card" onclick="PDD.daily()"><div class="feature-icon">☀</div><h3>Тест дня</h3><p class="muted">20 вопросов, одинаковых в течение дня.</p></button>
    <button class="card glass mode-card" onclick="PDD.marathon()"><div class="feature-icon">∞</div><h3>Марафон</h3><p class="muted">100 вопросов подряд.</p></button>
    <button class="card glass mode-card" onclick="PDD.hard()"><div class="feature-icon">!</div><h3>Сложные</h3><p class="muted">На основе ваших ошибок.</p></button>
    <a class="card glass card-link" href="#mistakes"><div class="feature-icon">${st.mistakes.length}</div><h3>Ошибки</h3><p class="muted">Повтор неверных ответов.</p></a>
    <button class="card glass mode-card" onclick="PDD.signTest()"><div class="feature-icon">◇</div><h3>Тест по знакам</h3><p class="muted">Знаки из предоставленного znaki.pdf.</p></button><button class="card glass mode-card" onclick="PDD.markingTest()"><div class="feature-icon">═</div><h3>Тест по разметке</h3><p class="muted">Изображения из razmetka.pdf.</p></button>
    <a class="card glass card-link" href="#bank"><div class="feature-icon">800</div><h3>Все вопросы</h3><p class="muted">Поиск по полному импортированному банку.</p></a>
  </div>
  <div class="notice section">В режиме билетов вопросы и правильные ответы идут в той же нумерации, что и в предоставленном PDF. Иллюстрации показываются только там, где они есть в исходном файле.</div>`)
}
function start(pool=PDD_QUESTIONS,label="Экзамен",limit=20,shuffle=true){
  let qs=[...pool];if(shuffle)qs.sort(()=>Math.random()-.5);qs=qs.slice(0,Math.min(limit,qs.length));
  st.exam={qs,i:0,score:0,label,answered:false,history:[]};rq()
}
function rq(){
  let e=st.exam;if(!e||e.i>=e.qs.length)return result();
  let q=e.qs[e.i],fav=st.favorites.includes(q.id);
  app.innerHTML=shell(e.label,`${e.i+1} из ${e.qs.length}`,`
  <div class="question-shell section">
    <article class="question glass">
      <div class="qtop"><span class="tag">${q.sourceKind==="uploaded_pdf"?`Билет ${q.ticket} · вопрос ${q.questionNo}`:(q._signId?"Тест по знакам":esc(q.topic))}</span><button class="round" onclick='PDD.fav(${JSON.stringify(q.id)})' aria-label="В избранное">${fav?"★":"☆"}</button></div>
      <div class="progress" aria-label="Прогресс"><i style="width:${((e.i+1)/e.qs.length)*100}%"></i></div>
      ${qMedia(q)}
      <h2>${esc(q.q)}</h2>
      <div class="answers">${q.answers.map((a,i)=>`<button class="answer" onclick="PDD.answer(${i})"><span class="answer-index">${i+1}</span><span>${esc(a)}</span></button>`).join("")}</div>
      <div id="explain"></div>
      <div class="mobile-question-nav">${qNavigator(e)}</div>
    </article>
    <aside class="card glass side-card">
      <div class="micro">Режим</div><h3>${esc(e.label)}</h3>
      <div class="score-stack"><div><b>${e.score}</b><span>верных</span></div><div><b>${e.i}</b><span>отвечено</span></div></div>
      ${qNavigator(e)}
      <div class="notice">${q.sourceKind==="uploaded_pdf"?`Источник: PDF · стр. ${q.sourcePage}${q.image?" · исходное изображение":""}`:"Справочный тренировочный режим."}</div>
    </aside>
  </div>`)
}
function answer(i){
  let e=st.exam;if(e.answered)return;
  e.answered=true;
  let q=e.qs[e.i],ok=i===q.correct;
  if(ok)e.score++;
  e.history[e.i]=ok;
  st.answers.push({id:q.id,ok,ts:Date.now()});
  store.set("answers:"+BANK_KEY,st.answers);
  if(ok)st.mistakes=st.mistakes.filter(x=>x!==q.id);
  else if(!st.mistakes.includes(q.id))st.mistakes.push(q.id);
  store.set("mistakes:"+BANK_KEY,st.mistakes);

  $$(".answer").forEach((b,n)=>{
    b.disabled=true;
    if(n===q.correct)b.classList.add("correct");
    if(n===i&&!ok)b.classList.add("wrong")
  });

  const correctText=q.answers[q.correct];
  const hasPDD=!!(q.explainPDD&&Number(q.explainPDDMatchScore)>=6);
  const pddBlock=hasPDD
    ? `<div class="pdd-explanation">
        <div class="pdd-explanation-head">
          <div><span class="micro">Пояснение по ПДД</span><h4>Почему этот ответ правильный</h4></div>
          <a class="btn pdd-source-btn" href="docs/pravilaPDD.pdf#page=${q.explainPDDPage}" target="_blank" rel="noopener">ПДД · стр. ${q.explainPDDPage} ↗</a>
        </div>
        <blockquote>${esc(q.explainPDD)}</blockquote>
        ${ruleSignCards(q.explainPDD)}
      </div>`
    : `<div class="pdd-explanation pdd-explanation-missing">
        <div class="pdd-explanation-head"><div><span class="micro">Пояснение по ПДД</span><h4>В предоставленном PDF точный фрагмент не найден</h4></div></div>
        <p>Правильный ответ подтверждён таблицей ответов билетов, но я не подставляю случайный пункт ПДД вместо подходящего объяснения.</p>
      </div>`;

  $("#explain").innerHTML=`<div class="explain answer-result">
    <div class="answer-verdict ${ok?"is-correct":"is-wrong"}">
      <b>${ok?"Верно":"Неверно"}</b>
      ${ok?"":`<span>Правильный ответ: <strong>${esc(correctText)}</strong></span>`}
    </div>
    ${pddBlock}
    <div class="actions"><button class="btn btn-primary" onclick="PDD.next()">Следующий →</button></div>
  </div>`
}
function mistakes(){let qs=PDD_QUESTIONS.filter(q=>st.mistakes.includes(q.id));app.innerHTML=shell("Ошибки","После правильного ответа вопрос исчезает из этого списка.",qs.length?`<div class="card glass section"><div class="big-num">${qs.length}</div><p class="muted">к повторению</p><button class="btn btn-primary" onclick="PDD.start(PDD.err(),'Ошибки',20)">Повторить</button></div>`:`<div class="card glass section"><h3>Чисто.</h3><p class="muted">Ошибок пока нет.</p></div>`)}
function stats(){let z=p();app.innerHTML=shell("Прогресс","Хранится локально на устройстве.",`<div class="grid g3 section"><div class="card glass"><div class="big-num">${z.pct}%</div><div class="micro">точность</div></div><div class="card glass"><div class="big-num">${st.answers.length}</div><div class="micro">ответов</div></div><div class="card glass"><div class="big-num">${st.mistakes.length}</div><div class="micro">ошибок</div></div></div><div class="actions"><a class="btn" href="#favorites">Избранное</a><a class="btn" href="#bank">Банк вопросов</a><a class="btn" href="#updates">Обновления</a><a class="btn" href="#data">Статус данных</a><button class="btn" onclick="PDD.reset()">Сбросить</button></div>`)}
function favorites(){let qs=PDD_QUESTIONS.filter(q=>st.favorites.includes(q.id));app.innerHTML=shell("Избранное","Отмеченные вопросы.",qs.length?`<div class="list">${qs.slice(0,100).map(q=>`<div class="row"><span><strong>${esc(q.q)}</strong><small>${esc(q.topic)}</small></span><button class="round" onclick='PDD.fav(${JSON.stringify(q.id)})'>★</button></div>`).join("")}</div>`:`<div class="card glass">Пока пусто.</div>`)}
function signs(){
  let cs=[...new Set(ROAD_SIGNS.map(s=>s.cat))];
  app.innerHTML=shell("Дорожные знаки",`${ROAD_SIGNS.length} изображений и описаний из предоставленного znaki.pdf.`,`
    <div class="toolbar signs-toolbar">
      <input class="input" id="sq" placeholder="Номер, название или описание" oninput="PDD.fs()">
      <select class="select" id="sc" onchange="PDD.fs()"><option value="">Все категории</option>${cs.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
      <button class="btn btn-primary" onclick="PDD.signCat()">Тест по категории</button>
      <a class="btn" href="docs/znaki.pdf" target="_blank">Открыть PDF ↗</a>
    </div>
    <div class="sign-test-strip">${cs.map(c=>`<button class="chip" onclick='PDD.signCat(${JSON.stringify(c)})'>${esc(c)}</button>`).join("")}</div>
    <div id="sg" class="sign-grid section"></div>
    <div class="notice section">Изображения в карточках вырезаны непосредственно из предоставленного znaki.pdf. Для каждой карточки указан номер страницы источника.</div>`);
  fs()
}
function fs(){
  let q=($("#sq")?.value||"").toLowerCase(),c=$("#sc")?.value||"";
  let a=ROAD_SIGNS.filter(s=>(!c||s.cat===c)&&(!q||(`${s.id} ${s.name} ${s.meaning||""}`).toLowerCase().includes(q)));
  $("#sg").innerHTML=a.map(s=>`<article class="card glass sign-card">${signVisual(s)}<div class="sign-copy"><span class="tag">${esc(s.id)} · ${esc(s.cat)}</span><h3>${esc(s.name)}</h3><p class="micro source-meaning">${esc(s.meaning||"")}</p><div class="source-row"><span class="micro">znaki.pdf · стр. ${s.sourcePage}</span><button class="btn sign-test-btn" onclick='PDD.signOne(${JSON.stringify(s.id)})'>Проверить себя</button></div></div></article>`).join("")
}

function markings(){
  const kinds=[...new Set(ROAD_MARKINGS.map(x=>x.kind))];
  app.innerHTML=shell("Дорожная разметка",`${ROAD_MARKINGS.length} элементов из предоставленного razmetka.pdf.`,`
    <div class="toolbar"><input class="input" id="mq" placeholder="Номер или описание" oninput="PDD.fm()"><select class="select" id="mk" onchange="PDD.fm()"><option value="">Вся разметка</option>${kinds.map(k=>`<option>${esc(k)}</option>`).join("")}</select><button class="btn btn-primary" onclick="PDD.markingTest()">Тест по разметке</button><a class="btn" href="docs/razmetka.pdf" target="_blank">Открыть PDF ↗</a></div>
    <div id="mgrid" class="marking-grid section"></div>
    <div class="notice section">Картинки разметки извлечены непосредственно из PDF. Описание в карточках берётся из текста соответствующей страницы источника.</div>`);
  fm()
}
function fm(){
  let q=($("#mq")?.value||"").toLowerCase(),k=$("#mk")?.value||"";
  let a=ROAD_MARKINGS.filter(m=>(!k||m.kind===k)&&(!q||(`${m.id} ${m.meaning}`).toLowerCase().includes(q)));
  $("#mgrid").innerHTML=a.map(m=>`<article class="card glass marking-card"><figure class="marking-media"><img src="${m.image}" alt="${esc(m.name)}" loading="lazy" onerror="PDD.mediaError(this)"><figcaption>№ ${esc(m.id)}</figcaption></figure><div class="marking-copy"><span class="tag">${esc(m.kind)} · ${esc(m.id)}</span><h3>${esc(m.name)}</h3><p class="micro source-meaning">${esc(m.meaning)}</p><span class="micro">razmetka.pdf · стр. ${m.sourcePage}</span></div></article>`).join("")
}
function rules(){
  app.innerHTML=shell("Правила дорожного движения",`${PDD_RULES.length} страниц из предоставленного pravilaPDD.pdf.`,`
    <div class="toolbar"><input class="input" id="rulesQ" placeholder="Поиск по тексту ПДД" oninput="PDD.frules()"><select class="select" id="rulesPage" onchange="PDD.rulePage(this.value)">${PDD_RULES.map(r=>`<option value="${r.page}">Страница ${r.page}</option>`).join("")}</select><a class="btn" href="docs/pravilaPDD.pdf" target="_blank">Открыть исходный PDF ↗</a></div>
    <div id="rulesResults" class="rules-results section"></div>`);
  renderRulePage(1)
}
function extractRuleSignIds(text){
  const found=[];
  const exists=id=>ROAD_SIGNS.some(s=>s.id===id);
  const add=id=>{if(exists(id)&&!found.includes(id))found.push(id)};
  const contexts=[...(String(text||"").matchAll(/(?:знак(?:ами|ах|ом|ов|а|и)?|таблич(?:кой|ками|ка|ки|ках|ек|ке))[\s\S]{0,220}/gi))].map(m=>m[0]);
  contexts.forEach(seg=>{
    for(const m of seg.matchAll(/\b([1-8]\.\d+(?:\.\d+)?)\s*[-–—]\s*([1-8]\.\d+(?:\.\d+)?)\b/g)){
      const a=m[1].split("."),b=m[2].split(".");
      if(a.length===b.length&&a.slice(0,-1).join(".")===b.slice(0,-1).join(".")){
        const x=Number(a[a.length-1]),y=Number(b[b.length-1]);
        if(Number.isInteger(x)&&Number.isInteger(y)&&y>=x&&y-x<=20){
          for(let n=x;n<=y;n++)add([...a.slice(0,-1),String(n)].join("."))
        }
      }
    }
    for(const m of seg.matchAll(/\b[1-8]\.\d+(?:\.\d+)?\b/g))add(m[0])
  });
  return found
}
function ruleSignCards(text){
  const ids=extractRuleSignIds(text);
  if(!ids.length)return "";
  return `<div class="rule-sign-strip">${ids.map(id=>{
    const s=ROAD_SIGNS.find(x=>x.id===id);
    return `<article class="rule-sign-ref">
      <div class="rule-sign-img"><img src="${s.image}" alt="Знак ${esc(s.id)} ${esc(s.name)}" loading="lazy" onerror="PDD.mediaError(this)"></div>
      <div class="rule-sign-copy"><b>Знак ${esc(s.id)}</b><span>${esc(s.name)}</span></div>
    </article>`
  }).join("")}</div>`
}
function ruleHTML(rule){
  const paras=Array.isArray(rule.paragraphs)&&rule.paragraphs.length?rule.paragraphs:String(rule.text||"").split(/\n\n+/).filter(Boolean);
  return paras.map(p=>`<section class="rule-paragraph"><p>${esc(p)}</p>${ruleSignCards(p)}</section>`).join("")
}
function renderRulePage(n){
  n=Number(n)||1;const r=PDD_RULES.find(x=>x.page===n)||PDD_RULES[0];
  const sel=$("#rulesPage");if(sel)sel.value=String(r.page);
  $("#rulesResults").innerHTML=`<article class="card glass rules-page">
    <div class="rules-page-head"><span class="tag">pravilaPDD.pdf · стр. ${r.page}</span><a class="btn" href="docs/pravilaPDD.pdf#page=${r.page}" target="_blank">Оригинал ↗</a></div>
    <div class="rules-text">${ruleHTML(r)}</div>
  </article>`
}
function filterRules(){
  const q=($("#rulesQ")?.value||"").trim().toLowerCase();
  if(!q){renderRulePage(Number($("#rulesPage")?.value||1));return}
  const found=PDD_RULES.filter(r=>r.text.toLowerCase().includes(q)).slice(0,24);
  $("#rulesResults").innerHTML=found.length?`<div class="list">${found.map(r=>{
    const low=r.text.toLowerCase(),i=low.indexOf(q),a=Math.max(0,i-180),b=Math.min(r.text.length,i+q.length+360);
    return `<button class="row rule-result" onclick="PDD.rulePage(${r.page})"><span><strong>Страница ${r.page}</strong><small>${esc(r.text.slice(a,b).replace(/\n/g," "))}</small></span><span>→</span></button>`
  }).join("")}</div>`:`<div class="card glass">Совпадений не найдено.</div>`
}

function cars(){
  let ms=[...new Set(CAR_CATALOG.map(c=>c.make))].sort();
  app.innerHTML=shell("Каталог автомобилей","Поколения, характеристики и быстрые ссылки на обзоры.",`
    <div class="toolbar cars-toolbar">
      <input class="input" id="cq" placeholder="Марка или модель" oninput="PDD.fc()">
      <select class="select" id="cg" onchange="PDD.fc()"><option value="">Все группы</option><option value="VAG">VAG / Volkswagen Group</option></select>
      <select class="select" id="cm" onchange="PDD.fc()"><option value="">Все марки</option>${ms.map(m=>`<option>${esc(m)}</option>`).join("")}</select>
    </div>
    <div id="cgrid" class="car-grid"></div>
    <div class="notice section">Фотографии автомобилей загружаются через Wikimedia Commons по марке, модели и выбранному поколению. Векторный силуэт используется только как резерв, если сеть или подходящее фото недоступны.</div>`);
  fc()
}
function fc(){
  let q=($("#cq")?.value||"").toLowerCase(),g=$("#cg")?.value||"",m=$("#cm")?.value||"";
  let a=CAR_CATALOG.filter(c=>(!g||c.group===g)&&(!m||c.make===m)&&(!q||(`${c.make} ${c.model} ${c.group}`).toLowerCase().includes(q)));
  $("#cgrid").innerHTML=a.map(c=>{let i=CAR_CATALOG.indexOf(c),gen=c.generations[0];return `<article class="card glass car-card" onclick="PDD.car(${i})" style="cursor:pointer">${carArt(c,gen)}<div class="car-body"><div class="car-meta"><span class="logo-pill">${esc(c.group)}</span><span class="micro">${c.generations.length} покол.</span></div><h3>${esc(c.make)} ${esc(c.model)}</h3><p class="micro">${esc(c.generations.map(x=>x.name).join(" · "))}</p></div></article>`}).join("")
}
function car(i,gi=0){
  let c=CAR_CATALOG[i],g=c.generations[gi],q=encodeURIComponent(`${c.make} ${c.model} ${g.name} обзор`),d=encodeURIComponent(`site:drom.ru ${c.make} ${c.model} ${g.name} обзор`),r=encodeURIComponent(`site:drive2.ru ${c.make} ${c.model} ${g.name} обзор`);
  location.hash=`car-${i}-${gi}`;
  app.innerHTML=shell(`${c.make} ${c.model}`,`${g.name} · ${g.years}`,`
    <div class="car-hero section">
      ${carArt(c,g,"car-art-detail")}
      <div class="card glass">
        <span class="tag">${esc(c.group)}</span><h3 style="font-size:34px;margin-top:14px">${esc(g.name)}</h3><p class="muted">${esc(g.body)}</p>
        <div class="gen-tabs">${c.generations.map((x,n)=>`<button class="gen-tab ${n===gi?"active":""}" onclick="PDD.car(${i},${n})">${esc(x.name)}</button>`).join("")}</div>
        <div class="spec-grid section"><div class="spec"><small>Годы</small>${esc(g.years)}</div><div class="spec"><small>Привод</small>${esc(g.drive)}</div><div class="spec"><small>Коробка</small>${esc(g.gearbox)}</div><div class="spec"><small>Двигатели</small>${esc(g.engines)}</div><div class="spec"><small>Мощность</small>${esc(g.power)}</div><div class="spec"><small>Колёсная база</small>${esc(g.wheelbase)}</div><div class="spec"><small>Длина</small>${esc(g.length)}</div></div>
      </div>
    </div>
    <div class="card glass section"><h3>Обзоры в интернете</h3><div class="actions"><a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q}">YouTube ↗</a><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/search?q=${d}">Drom ↗</a><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/search?q=${r}">Drive2 ↗</a></div></div>
    <div class="actions"><a class="btn" href="#cars">← Каталог</a></div>`)
}
function next(){
  let e=st.exam;
  if(!e)return;
  e.i++;
  e.answered=false;
  if(e.i>=e.qs.length)result();
  else rq()
}
function fav(id){st.favorites=st.favorites.includes(id)?st.favorites.filter(x=>x!==id):[...st.favorites,id];store.set("favorites:"+BANK_KEY,st.favorites);msg("Избранное обновлено");st.exam?rq():favorites()}
function reset(){if(confirm("Сбросить статистику и ошибки?")){st.answers=[];st.mistakes=[];store.set("answers:"+BANK_KEY,[]);store.set("mistakes:"+BANK_KEY,[]);stats()}}


function idHash(v){
  let h=2166136261,s=String(v);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0
}
function daily(){
  const d=new Date(),key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const pool=[...PDD_QUESTIONS].sort((a,b)=>idHash(key+"-"+a.id)-idHash(key+"-"+b.id)).slice(0,20);
  start(pool,"Тест дня",20,false)
}
function marathon(){start(PDD_QUESTIONS,"Марафон · 100",Math.min(100,PDD_QUESTIONS.length),true)}
function hard(){
  const m=new Map();
  st.answers.forEach(a=>{let k=String(a.id),x=m.get(k)||{n:0,w:0};x.n++;if(!a.ok)x.w++;m.set(k,x)});
  let ranked=PDD_QUESTIONS.map(q=>({q,x:m.get(String(q.id))||{n:0,w:0}}))
    .filter(z=>z.x.n>0).sort((a,b)=>(b.x.w/b.x.n)-(a.x.w/a.x.n)||b.x.w-a.x.w).map(z=>z.q);
  if(!ranked.length)ranked=[...PDD_QUESTIONS].sort(()=>Math.random()-.5);
  start(ranked,"Сложные вопросы",Math.min(20,ranked.length),false)
}
function signNumbers(){
  let pool=PDD_QUESTIONS.filter(q=>q.type==="sign_number"||q.type==="sign_category");
  if(!pool.length)pool=buildSignTest();
  start(pool,"Знаки · номера и категории",20,true)
}
function signCategory(cat){
  cat=cat||$("#sc")?.value||"";
  let pool=PDD_QUESTIONS.filter(q=>q.type==="sign_name"&&(!cat||q.topic===`Знаки · ${cat}`));
  if(!pool.length)pool=buildSignTest(cat);
  start(pool,cat?`Знаки · ${cat}`:"Тест по всем знакам",20,true)
}
function signOne(id){
  let pool=PDD_QUESTIONS.filter(q=>q._signId===id);
  if(!pool.length){
    const s=ROAD_SIGNS.find(x=>x.id===id);if(!s)return;
    let same=ROAD_SIGNS.filter(x=>x.id!==id).slice(0,3),answers=[s.name,...same.map(x=>x.name)].sort(()=>Math.random()-.5);
    pool=[{id:`one-${id}`,topic:s.cat,q:"Что означает этот дорожный знак?",answers,correct:answers.indexOf(s.name),explain:`Знак ${s.id} «${s.name}».`,_signId:id}]
  }
  start(pool,`Знак ${id}`,Math.min(4,pool.length),false)
}
function bank(){
  app.innerHTML=shell("Банк вопросов",`${PDD_QUESTIONS.length} вопросов. Поиск по тексту, теме и номеру билета.`,`
    <div class="toolbar"><input id="bq" class="input" placeholder="Поиск по вопросу или теме" oninput="PDD.fb()"><select id="bt" class="select" onchange="PDD.fb()"><option value="">Все билеты</option>${[...new Set(PDD_QUESTIONS.map(q=>q.ticket).filter(Boolean))].sort((a,b)=>a-b).map(t=>`<option value="${t}">Билет ${t}</option>`).join("")}</select></div>
    <div id="bankCount" class="micro"></div><div id="bankList" class="list section"></div>`);filterBank()
}
function filterBank(){
  let q=($("#bq")?.value||"").toLowerCase(),t=$("#bt")?.value||"";
  let a=PDD_QUESTIONS.filter(x=>(!t||String(x.ticket)===t)&&(!q||(`${x.q} ${x.topic} ${x.ticket||""}`).toLowerCase().includes(q)));
  $("#bankCount").textContent=`Найдено: ${a.length}`;
  $("#bankList").innerHTML=a.slice(0,120).map(x=>`<button class="row question-row" onclick='PDD.single(${JSON.stringify(x.id)})'><span><strong>${esc(x.q)}</strong><small>Билет ${x.ticket||"—"} · ${esc(x.topic)}</small></span><span>→</span></button>`).join("")+(a.length>120?`<div class="notice">Показаны первые 120 результатов — уточните поиск.</div>`:"")
}
function single(id){let q=PDD_QUESTIONS.find(x=>String(x.id)===String(id));if(q)start([q],"Один вопрос",1,false)}

function validateQuestions(a){return Array.isArray(a)&&a.length>0&&a.every(q=>q&&q.q&&Array.isArray(q.answers)&&q.answers.length>=2&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<q.answers.length)}
function validateSigns(a){return Array.isArray(a)&&a.length>0&&a.every(s=>s&&s.id&&s.name)}
function validateCars(a){return Array.isArray(a)&&a.length>0&&a.every(c=>c&&c.make&&c.model)}
function resolveUpdateUrl(v,base){return new URL(v,base).href}
async function fetchJSON(url){let r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}
async function checkUpdates(auto=false){
  const input=$("#updateUrl");
  const manifestUrl=(input?.value||store.get("updateUrl","./updates/manifest.json")).trim();
  if(!manifestUrl)return;
  if(input)store.set("updateUrl",manifestUrl);
  const status=$("#updateStatus");if(status)status.innerHTML=`<span class="syncing">Проверяю обновления…</span>`;
  try{
    const absolute=new URL(manifestUrl,location.href).href;
    const man=await fetchJSON(absolute);
    if(!man||!man.version)throw new Error("В манифесте нет version");
    const current=store.get("syncedData",null);
    if(current?.version===man.version){if(status)status.innerHTML=`Данные уже актуальны для источника: <b>${esc(man.version)}</b>`;return}
    if(!man.questions&&!man.signs&&!man.cars){if(status)status.innerHTML=`Источник доступен: <b>${esc(man.version)}</b>. Новые наборы данных не указаны.`;return}
    const next={schemaVersion:2,version:man.version,updatedAt:man.updatedAt||new Date().toISOString(),notes:man.notes||"",questions:null,signs:null,cars:null};
    if(man.questions){let x=await fetchJSON(resolveUpdateUrl(man.questions,absolute));if(!validateQuestions(x))throw new Error("Некорректный questions.json");next.questions=x}
    if(man.signs){let x=await fetchJSON(resolveUpdateUrl(man.signs,absolute));if(!validateSigns(x))throw new Error("Некорректный signs.json");next.signs=x}
    if(man.cars){let x=await fetchJSON(resolveUpdateUrl(man.cars,absolute));if(!validateCars(x))throw new Error("Некорректный cars.json");next.cars=x}
    // Preserve previous synced sections if manifest updates only part of the data.
    if(current){if(!next.questions)next.questions=current.questions;if(!next.signs)next.signs=current.signs;if(!next.cars)next.cars=current.cars}
    store.set("syncedData",next);store.set("lastUpdateCheck",Date.now());
    if(auto){location.reload();return}
    if(status)status.innerHTML=`Обновление <b>${esc(man.version)}</b> загружено. Перезагружаю…`;
    setTimeout(()=>location.reload(),700)
  }catch(err){
    if(status)status.innerHTML=`<span class="update-error">Не удалось обновить: ${esc(err.message||err)}</span>`;
    if(!auto)msg("Ошибка обновления")
  }
}
function resetSynced(){
  if(confirm("Вернуться к банку из PDF 12.1?")){localStorage.removeItem("pddplus:syncedData");location.reload()}
}
function updates(){
  const cur=store.get("syncedData",null),url=store.get("updateUrl","./updates/manifest.json");
  app.innerHTML=shell("Онлайн-обновление","Вопросы, знаки и автомобили можно менять без пересборки сайта.",`
  <div class="card glass section update-card">
    <div class="micro">Текущий источник данных</div><h3>${cur?`Синхронизирован · ${esc(cur.version)}`:"PDF-банк 12.1"}</h3>
    <p class="muted">${cur?.updatedAt?`Обновлено: ${esc(cur.updatedAt)}`:"800 вопросов из предоставленного PDF · 548 иллюстраций"}</p>
    <label class="micro" for="updateUrl">URL JSON-манифеста</label>
    <div class="toolbar"><input id="updateUrl" class="input" value="${esc(url)}" placeholder="https://.../manifest.json"><button class="btn btn-primary" onclick="PDD.update()">Обновить сейчас</button></div>
    <div id="updateStatus" class="update-status"></div>
    <div class="actions"><button class="btn" onclick="PDD.resetSynced()">Вернуться к встроенным данным</button><button class="btn" onclick="PDD.resetMediaCache()">Сбросить кэш изображений</button></div>
  </div>
  <div class="grid g3 section">
    <div class="card glass"><div class="feature-icon">1</div><h3>Манифест</h3><p class="muted">version, updatedAt и URL файлов questions/signs/cars.</p></div>
    <div class="card glass"><div class="feature-icon">2</div><h3>Проверка</h3><p class="muted">Формат вопросов и справочников валидируется перед сохранением.</p></div>
    <div class="card glass"><div class="feature-icon">3</div><h3>Без пересборки</h3><p class="muted">Новый JSON сохраняется на устройстве и применяется после перезагрузки.</p></div>
  </div>
  <div class="notice section">GitHub Pages не может сам редактировать репозиторий. «Онлайн-обновление» здесь означает загрузку данных с вашего JSON-источника. Для GitHub удобно разместить manifest.json и наборы данных в отдельном репозитории/CDN с CORS.</div>`)
}


function resetMediaCache(){
  Object.keys(localStorage).filter(k=>k.startsWith("pddplus:media:")).forEach(k=>localStorage.removeItem(k));
  mediaMem.clear();location.reload()
}

function dataStatus(){
  const missingQ=PDD_QUESTIONS.filter(q=>!q.q||!Array.isArray(q.answers)||q.answers.length<2||q.correct<0||q.correct>=q.answers.length).length;
  const pdfQ=PDD_QUESTIONS.filter(q=>q.sourceKind==="uploaded_pdf").length;
  const pdfImages=PDD_QUESTIONS.filter(q=>q.sourceKind==="uploaded_pdf"&&q.image).length;
  const tickets=[...new Set(PDD_QUESTIONS.map(q=>q.ticket).filter(Boolean))];
  app.innerHTML=shell("Источник и целостность","Проверка импортированного банка.",`
  <div class="grid g4 section">
    <div class="card glass"><div class="big-num">${pdfQ}</div><div class="micro">вопросов из PDF</div></div>
    <div class="card glass"><div class="big-num">${tickets.length}</div><div class="micro">билетов</div></div>
    <div class="card glass"><div class="big-num">${pdfImages}</div><div class="micro">извлечённых изображений</div></div>
    <div class="card glass"><div class="big-num">${missingQ}</div><div class="micro">ошибок структуры</div></div>
  </div>
  <div class="card glass section">
    <h3>bileti-pdd-abm-pddmaster.ru-12.1.pdf</h3>
    <p class="muted">Билеты: страницы 4–403. Таблица правильных ответов: страница 404. Изображения извлечены непосредственно из PDF и сохранены локально в приложении.</p>
  </div>
  <div class="notice section">Сборка ${PDD_META.build}. PDF сообщает, что экзаменационные билеты достаточно часто меняются и рекомендует проверять свежую версию. Сайт воспроизводит именно предоставленный файл.</div>`)
}

function route(){let h=location.hash.slice(1)||"home";if(h==="home")home();else if(h==="trainer")trainer();else if(h==="tickets")tickets();else if(h==="mistakes")mistakes();else if(h==="favorites")favorites();else if(h==="stats")stats();else if(h==="signs")signs();else if(h==="markings")markings();else if(h==="rules")rules();else if(h==="cars")cars();else if(h==="bank")bank();else if(h==="updates")updates();else if(h==="data")dataStatus();else if(h.startsWith("car-")){let x=h.split("-");car(+x[1],+(x[2]||0))}else home();window.scrollTo({top:0,behavior:"smooth"})}
window.PDD={mediaError,
  start:(a,b,c,d)=>start(a||PDD_QUESTIONS,b||"Экзамен",c||20,d!==undefined?d:true),
  signTest:()=>start(PDD_QUESTIONS.filter(q=>q.type==="sign_name").length?PDD_QUESTIONS.filter(q=>q.type==="sign_name"):buildSignTest(),"Тест по знакам",20,true),
  signNumbers,daily,marathon,hard,signCat:signCategory,signOne,markingTest:()=>start(buildMarkingTest(),"Тест по разметке",20,true),
  imgNext,topic:t=>start(PDD_QUESTIONS.filter(q=>q.topic===t),t,20,true),
  ticket:t=>start(PDD_QUESTIONS.filter(q=>q.ticket===t),`Билет ${t}`,20,false),
  pack:i=>start(PDD_QUESTIONS.slice(i*20,i*20+20),`Набор ${i+1}`,20,false),
  answer,next,fav,fs,fm,frules:filterRules,rulePage:renderRulePage,fc,fb:filterBank,single,car,reset,
  update:()=>checkUpdates(false),resetSynced,resetMediaCache,
  err:()=>PDD_QUESTIONS.filter(q=>st.mistakes.includes(q.id))
};
document.addEventListener("keydown",e=>{if(st.exam&&!st.exam.answered&&["1","2","3","4"].includes(e.key))answer(Number(e.key)-1)});theme();window.addEventListener("hashchange",route);route();
let mediaTimer=0;new MutationObserver(()=>{clearTimeout(mediaTimer);mediaTimer=setTimeout(hydrateMedia,40)}).observe(app,{childList:true,subtree:true});
setTimeout(hydrateMedia,80);
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
const lastCheck=store.get("lastUpdateCheck",0);if(Date.now()-lastCheck>86400000){store.set("lastUpdateCheck",Date.now());setTimeout(()=>checkUpdates(true),1800)};window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();st.deferred=e;let b=$("#installBtn");b.hidden=false;b.onclick=async()=>{st.deferred.prompt();await st.deferred.userChoice;b.hidden=true}})})();