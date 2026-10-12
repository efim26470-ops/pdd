(()=>{const $=(s,e=document)=>e.querySelector(s),$$=(s,e=document)=>[...e.querySelectorAll(s)],app=$("#app"),toast=$("#toast");
const store={get(k,d){try{return JSON.parse(localStorage.getItem("pddplus:"+k))??d}catch{return d}},set(k,v){localStorage.setItem("pddplus:"+k,JSON.stringify(v))}};
const st={answers:store.get("answers",[]),mistakes:store.get("mistakes",[]),favorites:store.get("favorites",[]),exam:null,deferred:null};
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function signKind(cat=""){if(cat.includes("Предупреж"))return"warning";if(cat.includes("Запрещ"))return"ban";if(cat.includes("Приоритет"))return"priority";if(cat.includes("Предпис"))return"mandatory";if(cat.includes("Сервис"))return"service";return"info"}
function signVisual(s,extra=""){
  if(!s)return"";
  return `<div class="sign-media ${extra} kind-${signKind(s.cat)}">
    <div class="sign-fallback"><span>${esc(s.id)}</span></div>
    ${s.image?`<img src="${s.image}" alt="${esc(s.name)}" loading="lazy" onload="this.parentElement.classList.add('loaded')" onerror="this.remove()">`:""}
  </div>`
}
function signFromQuestion(q){
  const m=String(q.q||"").match(/(?:знак(?:и)?\s*)(\d+(?:\.\d+){1,2})/i);
  return m?ROAD_SIGNS.find(s=>s.id===m[1])||null:null
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
  return `<div class="car-art ${extra}">
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

function msg(t){toast.textContent=t;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1700)}
function theme(){let x=store.get("theme","auto");document.documentElement.dataset.theme=x;$("#themeBtn").onclick=()=>{x=x==="auto"?"dark":x==="dark"?"light":"auto";document.documentElement.dataset.theme=x;store.set("theme",x);msg(x==="auto"?"Системная тема":x==="dark"?"Тёмная тема":"Светлая тема")}}
function p(){let c=st.answers.filter(x=>x.ok).length;return{pct:st.answers.length?Math.round(c/st.answers.length*100):0}}
function shell(t,l,b){return `<section class="page"><div class="section-head"><div><span class="tag">ПДД+ · Россия · A/B/M</span><h2 style="font-size:clamp(30px,5vw,52px);letter-spacing:-.05em;margin:12px 0 5px">${esc(t)}</h2><p class="lead">${l}</p></div></div>${b}</section>`}
function home(){let z=p();app.innerHTML=`<section class="page"><div class="hero glass"><div class="hero-copy"><span class="tag">A · B · M / offline PWA</span><h1>ПДД<span style="color:var(--accent)">+</span></h1><p class="lead">Тренажёр, дорожные знаки и автомобильный справочник в одном спокойном интерфейсе.</p><div class="actions"><a class="btn btn-primary" href="#trainer">Начать тренировку →</a><a class="btn" href="#cars">Каталог авто</a></div></div><aside class="hero-side glass"><div class="micro">Точность</div><div class="big-num">${z.pct}%</div><div class="progress"><i style="width:${z.pct}%"></i></div><div class="micro">${st.answers.length} ответов · ${st.mistakes.length} ошибок</div></aside></div><div class="section-head"><div><h3>Один хаб</h3><p>Учёба + справочник + автомобили</p></div></div><div class="grid g3"><a class="card glass card-link" href="#trainer"><div class="feature-icon">✓</div><h3>Тренажёр</h3><p class="muted">75 уникальных тренировочных вопросов, темы и работа над ошибками.</p></a><a class="card glass card-link" href="#signs"><div class="feature-icon">◇</div><h3>Знаки</h3><p class="muted">${ROAD_SIGNS.length} позиций с поиском и изображениями из Wikimedia Commons при доступности.</p></a><a class="card glass card-link" href="#cars"><div class="feature-icon">▰</div><h3>Автомобили</h3><p class="muted">${CAR_CATALOG.length} модели, поколения, VAG и ссылки на обзоры.</p></a></div><div class="notice section">Банк вопросов тренировочный, не официальный банк ГИБДД. Без веб-проверки актуальная редакция на октябрь 2026 не подтверждена.</div></section>`}
function trainer(){let topics=[...new Set(PDD_QUESTIONS.map(q=>q.topic))].sort();app.innerHTML=shell("Тренажёр","Экзамен, билеты, темы, ошибки и избранное.",`<div class="grid g3 section"><button class="card glass" onclick="PDD.start()" style="color:inherit;text-align:left;border:1px solid var(--line);cursor:pointer"><div class="feature-icon">20</div><h3>Экзамен</h3><p class="muted">20 случайных вопросов.</p></button><a class="card glass card-link" href="#tickets"><div class="feature-icon">${PDD_QUESTIONS.length}</div><h3>Наборы</h3><p class="muted">Практические наборы без имитации официальных билетов ГИБДД.</p></a><a class="card glass card-link" href="#mistakes"><div class="feature-icon">${st.mistakes.length}</div><h3>Ошибки</h3><p class="muted">Повторить сложные вопросы.</p></a></div><div class="section-head"><div><h3>Темы</h3><p>${topics.length} разделов</p></div></div><div class="list">${topics.map(t=>`<button class="row" onclick='PDD.topic(${JSON.stringify(t)})' style="cursor:pointer"><span><strong>${esc(t)}</strong><small>Тематическая тренировка</small></span><span>→</span></button>`).join("")}</div>`)}
function start(pool=PDD_QUESTIONS,label="Экзамен",limit=20){let qs=[...pool].sort(()=>Math.random()-.5).slice(0,Math.min(limit,pool.length));st.exam={qs,i:0,score:0,label,answered:false};rq()}
function rq(){
  let e=st.exam;if(!e||e.i>=e.qs.length)return result();
  let q=e.qs[e.i],fav=st.favorites.includes(q.id),sg=signFromQuestion(q);
  app.innerHTML=shell(e.label,`${e.i+1} из ${e.qs.length}`,`
  <div class="question-shell section">
    <article class="question glass">
      <div class="qtop"><span class="tag">Тренировка · ${esc(q.topic)}</span><button class="round" onclick="PDD.fav(${q.id})" aria-label="В избранное">${fav?"★":"☆"}</button></div>
      <div class="progress" aria-label="Прогресс"><i style="width:${((e.i+1)/e.qs.length)*100}%"></i></div>
      ${sg?signVisual(sg,"question-sign"):""}
      <h2>${esc(q.q)}</h2>
      <div class="answers">${q.answers.map((a,i)=>`<button class="answer" onclick="PDD.answer(${i})"><span class="answer-index">${i+1}</span><span>${esc(a)}</span></button>`).join("")}</div>
      <div id="explain"></div>
    </article>
    <aside class="card glass side-card">
      <div class="micro">Режим</div><h3>${esc(e.label)}</h3>
      <div class="score-stack"><div><b>${e.score}</b><span>верных</span></div><div><b>${e.i}</b><span>отвечено</span></div></div>
      <div class="notice">Тренировочный, не официальный банк.</div>
    </aside>
  </div>`)
}
function answer(i){let e=st.exam;if(e.answered)return;e.answered=true;let q=e.qs[e.i],ok=i===q.correct;if(ok)e.score++;st.answers.push({id:q.id,ok,ts:Date.now()});store.set("answers",st.answers);if(ok)st.mistakes=st.mistakes.filter(x=>x!==q.id);else if(!st.mistakes.includes(q.id))st.mistakes.push(q.id);store.set("mistakes",st.mistakes);$$(".answer").forEach((b,n)=>{b.disabled=true;if(n===q.correct)b.classList.add("correct");if(n===i&&!ok)b.classList.add("wrong")});$("#explain").innerHTML=`<div class="explain"><b>${ok?"Верно":"Ошибка"}</b><div class="micro" style="font-size:13px;margin-top:7px">${esc(q.explain)}</div><div class="actions"><button class="btn btn-primary" onclick="PDD.next()">Следующий →</button></div></div>`}
function next(){st.exam.i++;st.exam.answered=false;rq()}function result(){let e=st.exam,v=Math.round(e.score/e.qs.length*100);app.innerHTML=shell("Готово",`Результат «${esc(e.label)}».`,`<div class="card glass section"><div class="big-num">${e.score}/${e.qs.length}</div><p class="lead">${v}% правильных</p><div class="progress"><i style="width:${v}%"></i></div><div class="actions"><button class="btn btn-primary" onclick="PDD.start()">Ещё экзамен</button><a class="btn" href="#mistakes">Ошибки</a></div></div>`)}
function tickets(){
      let packs=[]; for(let i=0;i<PDD_QUESTIONS.length;i+=20) packs.push(PDD_QUESTIONS.slice(i,i+20));
      app.innerHTML=shell("Тренировочные наборы","Это не официальные билеты ГИБДД. Наборы собраны из уникального локального банка.",`<div class="grid g4 section">${packs.map((x,i)=>`<button class="card glass" onclick="PDD.pack(${i})" style="color:inherit;border:1px solid var(--line);cursor:pointer"><div class="big-num">${String(i+1).padStart(2,"0")}</div><div class="micro">${x.length} вопросов</div></button>`).join("")}</div><div class="notice section">Для режима официальных билетов нужно импортировать актуальный источник с подтверждёнными правами на использование.</div>`)
    }
function mistakes(){let qs=PDD_QUESTIONS.filter(q=>st.mistakes.includes(q.id));app.innerHTML=shell("Ошибки","После правильного ответа вопрос исчезает из этого списка.",qs.length?`<div class="card glass section"><div class="big-num">${qs.length}</div><p class="muted">к повторению</p><button class="btn btn-primary" onclick="PDD.start(PDD.err(),'Ошибки',20)">Повторить</button></div>`:`<div class="card glass section"><h3>Чисто.</h3><p class="muted">Ошибок пока нет.</p></div>`)}
function stats(){let z=p();app.innerHTML=shell("Прогресс","Хранится локально на устройстве.",`<div class="grid g3 section"><div class="card glass"><div class="big-num">${z.pct}%</div><div class="micro">точность</div></div><div class="card glass"><div class="big-num">${st.answers.length}</div><div class="micro">ответов</div></div><div class="card glass"><div class="big-num">${st.mistakes.length}</div><div class="micro">ошибок</div></div></div><div class="actions"><a class="btn" href="#favorites">Избранное</a><a class="btn" href="#data">Статус данных</a><button class="btn" onclick="PDD.reset()">Сбросить</button></div>`)}
function favorites(){let qs=PDD_QUESTIONS.filter(q=>st.favorites.includes(q.id));app.innerHTML=shell("Избранное","Отмеченные вопросы.",qs.length?`<div class="list">${qs.slice(0,100).map(q=>`<div class="row"><span><strong>${esc(q.q)}</strong><small>${esc(q.topic)}</small></span><button class="round" onclick="PDD.fav(${q.id})">★</button></div>`).join("")}</div>`:`<div class="card glass">Пока пусто.</div>`)}
function signs(){
  let cs=[...new Set(ROAD_SIGNS.map(s=>s.cat))];
  app.innerHTML=shell("Дорожные знаки",`${ROAD_SIGNS.length} позиций.`,`
    <div class="toolbar signs-toolbar">
      <input class="input" id="sq" placeholder="Номер или название" oninput="PDD.fs()">
      <select class="select" id="sc" onchange="PDD.fs()"><option value="">Все категории</option>${cs.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
    </div>
    <div id="sg" class="sign-grid"></div>
    <div class="notice section">Если удалённая иллюстрация Wikimedia недоступна, карточка остаётся аккуратной и показывает номер знака вместо пустого блока.</div>`);
  fs()
}
function fs(){
  let q=($("#sq")?.value||"").toLowerCase(),c=$("#sc")?.value||"";
  let a=ROAD_SIGNS.filter(s=>(!c||s.cat===c)&&(!q||(`${s.id} ${s.name}`).toLowerCase().includes(q)));
  $("#sg").innerHTML=a.map(s=>`<article class="card glass sign-card">${signVisual(s)}<div class="sign-copy"><span class="tag">${esc(s.id)} · ${esc(s.cat)}</span><h3>${esc(s.name)}</h3><p class="micro">${esc(s.meaning)}</p></div></article>`).join("")
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
    <div class="notice section">Неверные случайные фото удалены: до онлайн-верификации модель показывается фирменной локальной иллюстрацией, поэтому карточка больше не приписывает чужую машину конкретной модели.</div>`);
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
function fav(id){st.favorites=st.favorites.includes(id)?st.favorites.filter(x=>x!==id):[...st.favorites,id];store.set("favorites",st.favorites);msg("Избранное обновлено");st.exam?rq():favorites()}
function reset(){if(confirm("Сбросить статистику и ошибки?")){st.answers=[];st.mistakes=[];store.set("answers",[]);store.set("mistakes",[]);stats()}}

function dataStatus(){
  const missingQ=PDD_QUESTIONS.filter(q=>!q.q||!Array.isArray(q.answers)||q.answers.length<2||q.correct<0||q.correct>=q.answers.length).length;
  const missingSigns=ROAD_SIGNS.filter(s=>!s.id||!s.name).length;
  const missingCars=CAR_CATALOG.filter(c=>!c.make||!c.model||!Array.isArray(c.generations)||!c.generations.length).length;
  app.innerHTML=shell("Статус данных","Локальная проверка структуры и честный статус актуальности.",`
  <div class="grid g3 section">
    <div class="card glass"><div class="big-num">${PDD_QUESTIONS.length}</div><div class="micro">уникальных тренировочных вопросов</div></div>
    <div class="card glass"><div class="big-num">${ROAD_SIGNS.length}</div><div class="micro">записей справочника знаков</div></div>
    <div class="card glass"><div class="big-num">${CAR_CATALOG.length}</div><div class="micro">моделей автомобилей</div></div>
  </div>
  <div class="card glass section"><h3>Проверка целостности</h3>
    <p class="muted">Некорректных вопросов: <b>${missingQ}</b><br>Некорректных записей знаков: <b>${missingSigns}</b><br>Некорректных записей авто: <b>${missingCars}</b></p>
  </div>
  <div class="notice section"><b>Онлайн-верификация: не выполнена.</b><br>Сборка ${PDD_META.build} от ${PDD_META.build_date}. Эта версия специально не называет тренировочные данные официальным банком и не помечает автомобильные характеристики как проверенные на 2026 год.</div>`)
}

function route(){let h=location.hash.slice(1)||"home";if(h==="home")home();else if(h==="trainer")trainer();else if(h==="tickets")tickets();else if(h==="mistakes")mistakes();else if(h==="favorites")favorites();else if(h==="stats")stats();else if(h==="signs")signs();else if(h==="cars")cars();else if(h==="data")dataStatus();else if(h.startsWith("car-")){let x=h.split("-");car(+x[1],+(x[2]||0))}else home();window.scrollTo({top:0,behavior:"smooth"})}
window.PDD={start:(a,b,c)=>start(a||PDD_QUESTIONS,b||"Экзамен",c||20),topic:t=>start(PDD_QUESTIONS.filter(q=>q.topic===t),t,20),pack:i=>start(PDD_QUESTIONS.slice(i*20,i*20+20),`Набор ${i+1}`,20),answer,next,fav,fs,fc,car,reset,err:()=>PDD_QUESTIONS.filter(q=>st.mistakes.includes(q.id))};
theme();window.addEventListener("hashchange",route);route();if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();st.deferred=e;let b=$("#installBtn");b.hidden=false;b.onclick=async()=>{st.deferred.prompt();await st.deferred.userChoice;b.hidden=true}})})();