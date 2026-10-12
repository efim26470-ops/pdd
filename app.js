(() => {
const $ = (s,el=document)=>el.querySelector(s);
const app=$("#app"), toast=$("#toast");
const store={
  get(k,d){try{return JSON.parse(localStorage.getItem("pddplus:"+k))??d}catch{return d}},
  set(k,v){localStorage.setItem("pddplus:"+k,JSON.stringify(v))}
};
const state={favorites:store.get("favorites",[]),mistakes:store.get("mistakes",[]),answers:store.get("answers",[]),exam:null,deferredPrompt:null};

function showToast(t){toast.textContent=t;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1800)}
function progress(){
  const total=PDD_QUESTIONS.length, answered=new Set(state.answers.map(x=>x.id)).size;
  const correct=state.answers.filter(x=>x.ok).length;
  return {total,answered,correct,percent:answered?Math.round(correct/state.answers.length*100):0}
}
function shell(title,lead,content){return `<section class="page"><div class="section"><span class="eyebrow">ПДД+ · Россия · A/B/M</span><h2 style="margin:14px 0 6px">${title}</h2><p class="lead">${lead}</p></div>${content}</section>`}
function renderHome(){
 const p=progress();
 app.innerHTML=`<section class="page"><div class="hero glass">
   <div><span class="eyebrow">Учись · проверяй · запоминай</span><h1>ПДД<span class="accent">+</span></h1>
   <p class="lead">Тренажёр ПДД России, дорожные знаки и автомобильный справочник в одном быстром PWA. Работает офлайн и хранит прогресс на устройстве.</p>
   <div class="actions"><a class="btn btn-primary" href="#trainer">Начать тренировку</a><a class="btn btn-secondary" href="#cars">Открыть каталог авто</a></div></div>
   <div class="hero-card glass"><div class="muted">Точность ответов</div><div class="hero-stat">${p.percent}%</div><div class="progressbar"><i style="width:${p.percent}%"></i></div><p class="note" style="margin-top:12px">Отвечено: ${p.answered} · Верно: ${p.correct}</p></div>
 </div>
 <div class="grid grid-3 section">
   <a class="card glass card-link" href="#trainer"><span class="pill">Экзамен</span><h3 style="margin-top:14px">20 вопросов</h3><p class="muted">Случайная подборка, разбор ошибок и локальная статистика.</p></a>
   <a class="card glass card-link" href="#signs"><span class="pill">Справочник</span><h3 style="margin-top:14px">Дорожные знаки</h3><p class="muted">Поиск по номеру, названию и категории.</p></a>
   <a class="card glass card-link" href="#cars"><span class="pill">Авто</span><h3 style="margin-top:14px">Марки и модели</h3><p class="muted">Поколения, моторы, приводы, коробки и размеры.</p></a>
 </div>
 <div class="grid grid-4 section">
  <a class="card glass card-link" href="#tickets"><div class="kpi">4</div><div class="muted">демо-билета</div></a>
  <a class="card glass card-link" href="#mistakes"><div class="kpi">${state.mistakes.length}</div><div class="muted">ошибок</div></a>
  <a class="card glass card-link" href="#favorites"><div class="kpi">${state.favorites.length}</div><div class="muted">избранных</div></a>
  <a class="card glass card-link" href="#stats"><div class="kpi">${p.percent}%</div><div class="muted">точность</div></a>
 </div>
 <div class="card glass section"><strong>Важно о контенте</strong><p class="note" style="margin:8px 0 0">В архив включена рабочая демо-база вопросов и часть справочника. Архитектура готова для подключения полного официального банка билетов, полного набора знаков и большой автомобильной базы через файлы в папке data без изменения интерфейса.</p></div>
 </section>`;
}
function trainerMenu(){
 const topics=[...new Set(PDD_QUESTIONS.map(q=>q.topic))];
 app.innerHTML=shell("Тренажёр ПДД","Выберите режим. Прогресс, ошибки и избранное сохраняются локально.",`
 <div class="grid grid-3 section">
  <button class="card glass" onclick="PDD.startExam()" style="color:inherit;text-align:left;border:1px solid var(--border);cursor:pointer"><span class="pill">Главный режим</span><h3 style="margin-top:14px">Экзамен · 20 вопросов</h3><p class="muted">Перемешанная подборка по категориям A/B/M.</p></button>
  <a href="#tickets" class="card glass card-link"><span class="pill">По билетам</span><h3 style="margin-top:14px">Билеты</h3><p class="muted">Тренировка по номеру билета.</p></a>
  <a href="#mistakes" class="card glass card-link"><span class="pill">Повторение</span><h3 style="margin-top:14px">Работа над ошибками</h3><p class="muted">${state.mistakes.length} вопросов ждут повторения.</p></a>
 </div>
 <div class="section"><h3>Темы</h3><div class="list">${topics.map(t=>`<button class="row" onclick="PDD.startTopic('${t.replaceAll("'","\\'")}')" style="color:inherit;border:1px solid rgba(255,255,255,.08);cursor:pointer;text-align:left"><span><strong>${t}</strong><small>Тематическая тренировка</small></span><span>→</span></button>`).join("")}</div></div>`);
}
function startExam(pool=PDD_QUESTIONS, label="Экзамен"){
 const qs=[...pool].sort(()=>Math.random()-.5).slice(0,Math.min(20,pool.length));
 state.exam={qs,i:0,score:0,label,answered:false};renderQuestion();
}
function renderQuestion(){
 const e=state.exam;if(!e||e.i>=e.qs.length)return renderResult();
 const q=e.qs[e.i], fav=state.favorites.includes(q.id);
 app.innerHTML=shell(e.label,`${e.i+1} из ${e.qs.length}`,`
 <div class="question glass section">
  <div class="meta-line"><span>Билет ${q.ticket} · ${q.topic}</span><button class="icon-btn" onclick="PDD.favorite(${q.id})">${fav?"★":"☆"}</button></div>
  <div class="progressbar"><i style="width:${(e.i/e.qs.length)*100}%"></i></div>
  <h3 class="question-title" style="margin-top:22px">${q.q}</h3>
  <div class="answers">${q.answers.map((a,i)=>`<button class="answer" data-i="${i}" onclick="PDD.answer(${i})">${i+1}. ${a}</button>`).join("")}</div>
  <div id="explain"></div>
 </div>`);
}
function answer(i){
 const e=state.exam;if(e.answered)return;e.answered=true;
 const q=e.qs[e.i], ok=i===q.correct;if(ok)e.score++;
 state.answers.push({id:q.id,ok,ts:Date.now()});store.set("answers",state.answers);
 if(!ok&&!state.mistakes.includes(q.id)){state.mistakes.push(q.id);store.set("mistakes",state.mistakes)}
 if(ok&&state.mistakes.includes(q.id)){state.mistakes=state.mistakes.filter(x=>x!==q.id);store.set("mistakes",state.mistakes)}
 document.querySelectorAll(".answer").forEach((b,idx)=>{b.disabled=true;if(idx===q.correct)b.classList.add("correct");if(idx===i&&!ok)b.classList.add("wrong")});
 $("#explain").innerHTML=`<div class="explain"><strong>${ok?"Верно":"Ошибка"}</strong><br>${q.explain}<div class="actions"><button class="btn btn-primary" onclick="PDD.next()">Далее</button></div></div>`;
}
function next(){state.exam.i++;state.exam.answered=false;renderQuestion()}
function renderResult(){const e=state.exam;const pct=Math.round(e.score/e.qs.length*100);app.innerHTML=shell("Результат",`Тренировка завершена.`,`
<div class="card glass section"><div class="kpi">${e.score}/${e.qs.length}</div><p class="lead">Правильных ответов · ${pct}%</p><div class="progressbar"><i style="width:${pct}%"></i></div><div class="actions"><button class="btn btn-primary" onclick="PDD.startExam()">Ещё экзамен</button><a class="btn btn-secondary" href="#mistakes">Разобрать ошибки</a></div></div>`)}
function renderTickets(){
 const tickets=[...new Set(PDD_QUESTIONS.map(q=>q.ticket))];
 app.innerHTML=shell("Билеты","Выберите билет и пройдите все доступные вопросы.",`<div class="grid grid-4 section">${tickets.map(t=>`<button class="card glass" onclick="PDD.startTicket(${t})" style="color:inherit;border:1px solid var(--border);cursor:pointer"><div class="kpi">${t}</div><div class="muted">${PDD_QUESTIONS.filter(q=>q.ticket===t).length} вопросов</div></button>`).join("")}</div>`)
}
function renderMistakes(){
 const qs=PDD_QUESTIONS.filter(q=>state.mistakes.includes(q.id));
 app.innerHTML=shell("Работа над ошибками","Здесь остаются вопросы, на которые вы отвечали неверно.",qs.length?`<div class="card glass section"><div class="kpi">${qs.length}</div><p class="muted">вопросов для повторения</p><button class="btn btn-primary" onclick="PDD.startExam(PDD.getMistakes(),'Ошибки')">Начать повторение</button></div>`:`<div class="glass card empty section">Ошибок пока нет. Отличный знак.</div>`)
}
function renderFavorites(){
 const qs=PDD_QUESTIONS.filter(q=>state.favorites.includes(q.id));
 app.innerHTML=shell("Избранное","Сохранённые вопросы для быстрого повторения.",qs.length?`<div class="list section">${qs.map(q=>`<div class="row"><span><strong>${q.q}</strong><small>${q.topic}</small></span><button class="icon-btn" onclick="PDD.favorite(${q.id})">★</button></div>`).join("")}</div>`:`<div class="glass card empty section">Добавляйте вопросы звездочкой во время тренировки.</div>`)
}
function renderStats(){
 const p=progress(); const recent=state.answers.slice(-50); const wrong=recent.filter(x=>!x.ok).length;
 app.innerHTML=shell("Статистика","Ваш прогресс хранится только на этом устройстве.",`
 <div class="grid grid-3 section">
  <div class="card glass"><div class="kpi">${p.percent}%</div><div class="muted">общая точность</div></div>
  <div class="card glass"><div class="kpi">${state.answers.length}</div><div class="muted">всего ответов</div></div>
  <div class="card glass"><div class="kpi">${state.mistakes.length}</div><div class="muted">активных ошибок</div></div>
 </div>
 <div class="card glass section"><h3>Последние 50 ответов</h3><div class="progressbar"><i style="width:${recent.length?Math.round((recent.length-wrong)/recent.length*100):0}%"></i></div><p class="note" style="margin-top:12px">Верно: ${recent.length-wrong} · Ошибок: ${wrong}</p><div class="actions"><button class="btn btn-secondary" onclick="PDD.resetStats()">Сбросить статистику</button></div></div>`)
}
function renderSigns(){
 app.innerHTML=shell("Дорожные знаки","Поиск по номеру, названию и категории.",`
 <div class="toolbar"><input id="signSearch" class="input" placeholder="Например: Главная дорога или 2.1" oninput="PDD.filterSigns()"><select id="signCat" class="select" onchange="PDD.filterSigns()"><option value="">Все категории</option>${[...new Set(ROAD_SIGNS.map(s=>s.cat))].map(c=>`<option>${c}</option>`).join("")}</select></div><div id="signGrid" class="sign-grid section"></div>`);
 filterSigns();
}
function filterSigns(){
 const q=($("#signSearch")?.value||"").toLowerCase(), c=$("#signCat")?.value||"";
 const arr=ROAD_SIGNS.filter(s=>(!c||s.cat===c)&&(!q||(`${s.id} ${s.name} ${s.meaning}`).toLowerCase().includes(q)));
 $("#signGrid").innerHTML=arr.map(s=>`<article class="sign-card card glass"><div class="sign-icon">${s.symbol}</div><span class="pill">${s.id} · ${s.cat}</span><h3 style="margin:12px 0 8px">${s.name}</h3><p class="muted">${s.meaning}</p></article>`).join("")||`<div class="glass card empty">Ничего не найдено.</div>`;
}
function renderCars(){
 const makes=[...new Set(CAR_CATALOG.map(c=>c.make))].sort();
 app.innerHTML=shell("Каталог автомобилей","Марки, модели, поколения, моторы и основные технические характеристики.",`
 <div class="toolbar"><input id="carSearch" class="input" placeholder="Марка или модель" oninput="PDD.filterCars()"><select id="carMake" class="select" onchange="PDD.filterCars()"><option value="">Все марки</option>${makes.map(m=>`<option>${m}</option>`).join("")}</select></div><div id="carGrid" class="car-grid section"></div>`);
 filterCars();
}
function filterCars(){
 const q=($("#carSearch")?.value||"").toLowerCase(), m=$("#carMake")?.value||"";
 const arr=CAR_CATALOG.filter(c=>(!m||c.make===m)&&(!q||(`${c.make} ${c.model} ${c.generation}`).toLowerCase().includes(q)));
 $("#carGrid").innerHTML=arr.map((c,i)=>`<article class="car-card card glass" onclick="PDD.carDetail(${CAR_CATALOG.indexOf(c)})"><span class="pill">${c.body} · ${c.years}</span><h3 style="font-size:24px;margin:14px 0 6px">${c.make} ${c.model}</h3><p class="muted">${c.generation}</p><div class="divider"></div><div class="specs"><div class="spec"><small>Мощность</small>${c.power}</div><div class="spec"><small>Привод</small>${c.drive}</div></div></article>`).join("")||`<div class="glass card empty">Ничего не найдено.</div>`;
}
function carDetail(i){
 const c=CAR_CATALOG[i]; location.hash=`car-${i}`;
 app.innerHTML=shell(`${c.make} ${c.model}`,`${c.generation} · ${c.years} · ${c.body}`,`
 <div class="card glass section"><div class="grid grid-3">
 <div class="spec"><small>Двигатели</small>${c.engines.join("<br>")}</div><div class="spec"><small>Мощность</small>${c.power}</div><div class="spec"><small>Коробка</small>${c.transmission}</div>
 <div class="spec"><small>Привод</small>${c.drive}</div><div class="spec"><small>Колёсная база</small>${c.wheelbase}</div><div class="spec"><small>Габариты</small>${c.length} × ${c.width} × ${c.height}</div></div>
 <div class="divider"></div><h3>Комплектации</h3><div class="toolbar">${c.trims.map(t=>`<span class="pill">${t}</span>`).join("")}</div></div><div class="actions"><a class="btn btn-secondary" href="#cars">← Назад к каталогу</a></div>`);
}
function favorite(id){state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];store.set("favorites",state.favorites);showToast("Избранное обновлено"); if(state.exam)renderQuestion(); else renderFavorites()}
function resetStats(){if(confirm("Сбросить статистику и список ошибок?")){state.answers=[];state.mistakes=[];store.set("answers",[]);store.set("mistakes",[]);renderStats()}}
function route(){
 const h=location.hash.slice(1)||"home";
 if(h==="home")renderHome(); else if(h==="trainer")trainerMenu(); else if(h==="tickets")renderTickets(); else if(h==="mistakes")renderMistakes(); else if(h==="favorites")renderFavorites(); else if(h==="stats")renderStats(); else if(h==="signs")renderSigns(); else if(h==="cars")renderCars(); else if(h.startsWith("car-"))carDetail(Number(h.split("-")[1])); else renderHome();
 window.scrollTo({top:0,behavior:"smooth"});
}
window.PDD={
 startExam:(pool,label)=>startExam(pool||PDD_QUESTIONS,label||"Экзамен"),
 startTopic:t=>startExam(PDD_QUESTIONS.filter(q=>q.topic===t),t),
 startTicket:t=>startExam(PDD_QUESTIONS.filter(q=>q.ticket===t),`Билет ${t}`),
 answer,next,favorite,filterSigns,filterCars,carDetail,resetStats,
 getMistakes:()=>PDD_QUESTIONS.filter(q=>state.mistakes.includes(q.id))
};
window.addEventListener("hashchange",route); route();

if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredPrompt=e;const b=$("#installBtn");b.hidden=false;b.onclick=async()=>{state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;b.hidden=true}});
})();