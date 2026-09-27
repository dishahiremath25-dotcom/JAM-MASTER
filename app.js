/* JAM BT MASTER — Supabase-backed practice engine
   Uses the real public.questions / subjects / topics tables.
   The old local sample question array is intentionally removed.
*/

let db = null;
let dbSubjects = [];
let dbTopics = [];
let currentSubjectId = null;
let currentTopicId = null;

let currentQuestionIndex = 0;
let currentQuestions = [];

// ---------------- JAM RUSH ----------------
let rushQuestions=[];
let rushIndex=0;
let rushScore=0;
let rushLives=3;
let rushStreak=0;
let rushBestStreak=0;
let rushCorrectCount=0;
let rushWrongCount=0;
let rushSelectedTopicIds=[];
let rushSelectedTopicNames=[];
let rushCurrentAnswer=null;
let rushAnswerSubmitted=false;


function getData(){
  return JSON.parse(localStorage.getItem("jamBTData") || JSON.stringify({
    solved:0, correct:0, mistakes:[], mocks:[], streak:0, topicStats:{}
  }));
}
function saveData(data){ localStorage.setItem("jamBTData", JSON.stringify(data)); }

function goTo(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const target=document.getElementById(page);
  if(target) target.classList.add("active");
  document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));
  const nav=document.querySelector(`.nav[data-page="${page}"]`);
  if(nav) nav.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
  if(page==="mistakes") renderMistakes();
  if(page==="analytics") renderAnalytics();
  if(page==="rush") renderRushSetup();
}

document.querySelectorAll(".nav").forEach(button=>{
  button.addEventListener("click",()=>goTo(button.dataset.page));
});

function supabaseReady(){
  return typeof supabase !== "undefined" &&
         typeof SUPABASE_URL !== "undefined" &&
         typeof SUPABASE_ANON_KEY !== "undefined" &&
         SUPABASE_URL &&
         SUPABASE_ANON_KEY &&
         !SUPABASE_URL.includes("PASTE_YOUR") &&
         !SUPABASE_ANON_KEY.includes("PASTE_YOUR");
}

function showConnectionMessage(message){
  const toast=document.getElementById("toast");
  if(toast) showToast(message);
}

async function initSupabasePractice(){
  if(!supabaseReady()){
    showToast("Add your Supabase URL and publishable/anon key in supabase-config.js.");
    renderDashboard();
    renderSubjects();
    initializeSubjectSelect();
    updateStats();
    return;
  }

  try{
    const {createClient}=supabase;
    db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

    const {data: subjectsData,error:subjectsError}=await db
      .from("subjects")
      .select("id,code,name")
      .order("name");

    if(subjectsError) throw subjectsError;
    dbSubjects=subjectsData||[];

    const {data: topicsData,error:topicsError}=await db
      .from("topics")
      .select("id,name,subject_id")
      .order("name");

    if(topicsError) throw topicsError;
    dbTopics=topicsData||[];

    await renderDashboard();
    await renderSubjects();
    initializeSubjectSelect();
    updateStats();
  }catch(error){
    console.error(error);
    showToast("Supabase connection failed: " + (error.message||error));
    renderDashboard();
    renderSubjects();
    initializeSubjectSelect();
    updateStats();
  }
}

function subjectByCode(code){
  return dbSubjects.find(s=>String(s.code).toUpperCase()===String(code).toUpperCase());
}
function subjectByName(name){
  return dbSubjects.find(s=>s.name===name);
}

async function getQuestionCount(subjectId){
  if(!db) return 0;
  const {count,error}=await db.from("questions")
    .select("id",{count:"exact",head:true})
    .eq("subject_id",subjectId)
    .eq("is_pyq",false);
  if(error){ console.error(error); return 0; }
  return count||0;
}

async function renderDashboard(){
  const container=document.getElementById("dashboardSubjects");
  if(!container)return;
  container.innerHTML="";
  if(!dbSubjects.length){
    container.innerHTML='<div class="empty-state"><div>🔌</div><h3>Connect Supabase</h3><p>Add your Supabase URL and browser-safe key.</p></div>';
    return;
  }
  for(const s of dbSubjects){
    const icons={BIO:"🧬",BT:"🔬",CHEM:"⚗️",PHY:"⚛️",MATH:"∑"};
    const count=await getQuestionCount(s.id);
    const div=document.createElement("div");
    div.className="subject-row";
    div.onclick=()=>openSubject(s.id);
    div.innerHTML=`
      <div class="subject-row-top">
        <div><span>${icons[s.code]||"📚"}</span><strong>${s.name}</strong></div>
        <small>${count.toLocaleString()} questions</small>
      </div>
      <div class="progress"><div class="progress-bar" style="width:100%"></div></div>`;
    container.appendChild(div);
  }
}

async function renderSubjects(){
  const grid=document.getElementById("subjectGrid");
  if(!grid)return;
  grid.innerHTML="";
  if(!dbSubjects.length){
    grid.innerHTML='<div class="empty-state"><div>🔌</div><h3>Connect Supabase</h3><p>Add your Supabase URL and browser-safe key.</p></div>';
    return;
  }
  const icons={BIO:"🧬",BT:"🔬",CHEM:"⚗️",PHY:"⚛️",MATH:"∑"};
  for(const s of dbSubjects){
    const topics=dbTopics.filter(t=>t.subject_id===s.id);
    const count=await getQuestionCount(s.id);
    const card=document.createElement("div");
    card.className="large-subject-card";
    card.onclick=()=>openSubject(s.id);
    card.innerHTML=`
      <div class="subject-icon-large">${icons[s.code]||"📚"}</div>
      <h3>${s.name}</h3>
      <p>${count.toLocaleString()} practice questions · ${topics.length} topics</p>
      <div class="progress"><div class="progress-bar" style="width:100%"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:7px;font-size:11px;color:#74798b">
        <span>${count.toLocaleString()} questions</span><span>${topics.length} topics →</span>
      </div>`;
    grid.appendChild(card);
  }
}

function openSubject(subjectId){
  goTo("practice");
  const select=document.getElementById("subjectSelect");
  select.value=subjectId;
  currentSubjectId=subjectId;
  loadTopics();
}

function initializeSubjectSelect(){
  const select=document.getElementById("subjectSelect");
  if(!select)return;
  select.innerHTML="";
  if(!dbSubjects.length){
    select.innerHTML='<option value="">Connect Supabase first</option>';
    document.getElementById("topicButtons").innerHTML="";
    return;
  }
  dbSubjects.forEach(s=>{
    const option=document.createElement("option");
    option.value=s.id;
    option.textContent=s.name;
    select.appendChild(option);
  });
  currentSubjectId=select.value;
  loadTopics();
}

async function loadTopics(){
  const select=document.getElementById("subjectSelect");
  const container=document.getElementById("topicButtons");
  if(!select||!container)return;
  currentSubjectId=select.value;
  container.innerHTML="";
  if(!currentSubjectId)return;

  const topics=dbTopics.filter(t=>String(t.subject_id)===String(currentSubjectId));
  if(!topics.length){
    container.innerHTML='<p class="muted" style="margin-top:10px">No topics found for this subject.</p>';
    return;
  }

  for(const topic of topics){
    const button=document.createElement("button");
    button.className="topic-button";
    button.textContent=topic.name;
    button.onclick=()=>startTopic(currentSubjectId,topic.id,topic.name);
    container.appendChild(button);
  }
}

async function startTopic(subjectId,topicId,topicName){
  if(!db){showToast("Connect Supabase first.");return;}
  currentSubjectId=subjectId;
  currentTopicId=topicId;

  const {data,error}=await db.from("questions")
    .select("id,subject_id,topic_id,subtopic_id,question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,source,is_pyq")
    .eq("subject_id",subjectId)
    .eq("topic_id",topicId)
    .eq("is_pyq",false)
    .order("id",{ascending:true});

  if(error){
    console.error(error);
    showToast("Could not load questions: "+error.message);
    return;
  }

  currentQuestions=(data||[]).map(normalizeQuestion);
  if(!currentQuestions.length){
    showToast("No questions found for this topic.");
    return;
  }

  currentQuestionIndex=0;
  document.getElementById("practiceTitle").textContent=topicName;
  const subject=dbSubjects.find(s=>String(s.id)===String(subjectId));
  document.getElementById("practiceSubtitle").textContent=
    `${subject?.name||""} · ${topicName} · ${currentQuestions.length.toLocaleString()} questions`;
  renderQuestion();
}

function normalizeQuestion(q){
  const options=[];
  ["option_a","option_b","option_c","option_d"].forEach(k=>{
    if(q[k]!==null && q[k]!==undefined && String(q[k]).trim()!=="") options.push(q[k]);
  });
  return {
    ...q,
    subject:dbSubjects.find(s=>String(s.id)===String(q.subject_id))?.name||"Biology",
    topic:dbTopics.find(t=>String(t.id)===String(q.topic_id))?.name||"",
    type:(q.question_type||"MCQ").toUpperCase(),
    question:q.question_text||"",
    options,
    answer:q.correct_answer||"",
    explanation:q.explanation||""
  };
}

function normalizeAnswer(v){
  if(Array.isArray(v))return v.join("").replace(/[\s,;]+/g,"").toUpperCase();
  return String(v??"").trim().replace(/[\s,;]+/g,"").toUpperCase();
}

function renderQuestion(){
  const q=currentQuestions[currentQuestionIndex];
  if(!q)return;

  document.getElementById("questionSubject").textContent=q.subject.toUpperCase();
  document.getElementById("questionType").textContent=q.type;
  document.getElementById("questionDifficulty").textContent=q.difficulty||"JAM LEVEL";
  document.getElementById("questionCount").textContent=
    `Question ${currentQuestionIndex+1} of ${currentQuestions.length}`;
  document.getElementById("questionText").textContent=q.question;

  const options=document.getElementById("options");
  options.innerHTML="";
  document.getElementById("answerMessage").textContent="";
  document.getElementById("explanation").style.display="none";

  if(q.type==="NAT"){
    const input=document.createElement("input");
    input.id="practiceNatAnswer";
    input.className="pyq-nat-input";
    input.type="text";
    input.inputMode="decimal";
    input.placeholder="Enter numerical answer";
    options.appendChild(input);
    const button=document.createElement("button");
    button.className="primary-btn";
    button.style.marginTop="12px";
    button.textContent="Check Answer";
    button.onclick=()=>answerQuestion(input.value);
    options.appendChild(button);
    return;
  }

  q.options.forEach((option,index)=>{
    const div=document.createElement("div");
    div.className="option";
    div.textContent=`${String.fromCharCode(65+index)}. ${option}`;
    div.onclick=()=>answerQuestion(String.fromCharCode(65+index));
    options.appendChild(div);
  });
}

function natMatches(user,key){
  const u=Number(user), k=Number(key);
  if(Number.isFinite(u)&&Number.isFinite(k))return Math.abs(u-k)<1e-9;
  return normalizeAnswer(user)===normalizeAnswer(key);
}

function answerQuestion(selected){
  const q=currentQuestions[currentQuestionIndex];
  const optionElements=document.querySelectorAll("#options .option");
  optionElements.forEach(el=>el.style.pointerEvents="none");

  const data=getData();
  data.solved++;

  let correct=false;
  if(q.type==="NAT") correct=natMatches(selected,q.answer);
  else if(q.type==="MSQ"){
    correct=normalizeAnswer(selected)===normalizeAnswer(q.answer);
  }else{
    correct=normalizeAnswer(selected)===normalizeAnswer(q.answer);
  }

  if(correct){
    data.correct++;
    if(q.type!=="NAT"){
      const idx=String(q.answer).trim().charCodeAt(0)-65;
      if(optionElements[idx])optionElements[idx].classList.add("correct");
    }
    document.getElementById("answerMessage").textContent="Correct";
    document.getElementById("answerMessage").style.color="var(--moss)";
  }else{
    if(q.type!=="NAT"){
      const selectedLetters=Array.isArray(selected)?selected:[selected];
      selectedLetters.forEach(letter=>{
        const idx=String(letter).charCodeAt(0)-65;
        if(optionElements[idx])optionElements[idx].classList.add("wrong");
      });
      if(q.type==="MCQ"){
        const idx=String(q.answer).trim().charCodeAt(0)-65;
        if(optionElements[idx])optionElements[idx].classList.add("correct");
      }
    }
    document.getElementById("answerMessage").textContent="Not quite — see the explanation below";
    document.getElementById("answerMessage").style.color="var(--clay)";
    addMistake(q);
  }

  document.getElementById("explanationText").textContent=q.explanation||"No explanation stored.";
  document.getElementById("explanation").style.display="block";

  if(!data.topicStats[q.topic])data.topicStats[q.topic]={attempted:0,correct:0};
  data.topicStats[q.topic].attempted++;
  if(correct)data.topicStats[q.topic].correct++;
  saveData(data);
  updateStats();
}

function nextQuestion(){
  if(!currentQuestions.length){showToast("Select a topic first.");return;}
  currentQuestionIndex++;
  if(currentQuestionIndex>=currentQuestions.length)currentQuestionIndex=0;
  renderQuestion();
}

function addMistake(q){
  const data=getData();
  if(!data.mistakes.some(m=>String(m.id)===String(q.id))){
    data.mistakes.push(q);
    saveData(data);
  }
}

function addCurrentToMistakes(){
  const q=currentQuestions[currentQuestionIndex];
  if(!q)return;
  addMistake(q);
  renderMistakes();
  showToast("Added to your Mistake Bank.");
}

function renderMistakes(){
  const data=getData();
  document.getElementById("mistakeCount").textContent=data.mistakes.length;
  document.getElementById("revisionCount").textContent=data.mistakes.length;
  const container=document.getElementById("mistakeList");
  if(!data.mistakes.length){
    container.innerHTML=`<div class="empty-state"><div>🎉</div><h3>No mistakes yet</h3><p>Your mistakes will automatically appear here when you get questions wrong.</p></div>`;
    return;
  }
  container.innerHTML=`<div class="panel-heading"><div><h3>Questions to revise</h3><p>Turn your mistakes into marks.</p></div></div>`;
  data.mistakes.forEach(q=>{
    const item=document.createElement("div");
    item.className="mistake-item";
    item.innerHTML=`<strong>${escapeHTML(q.question||q.question_text||"")}</strong><small>${escapeHTML(q.subject||"")} · ${escapeHTML(q.topic||"")}</small>`;
    container.appendChild(item);
  });
}

function practiceMistakes(){
  const data=getData();
  if(!data.mistakes.length){showToast("Your Mistake Bank is empty.");return;}
  currentQuestions=[...data.mistakes];
  currentQuestionIndex=0;
  goTo("practice");
  renderQuestion();
}

function getRushRecords(){
  return JSON.parse(localStorage.getItem("jamBTRushRecords")||"[]");
}
function saveRushRecord(record){
  const records=getRushRecords();
  records.push(record);
  records.sort((a,b)=>b.score-a.score || b.bestStreak-a.bestStreak);
  localStorage.setItem("jamBTRushRecords",JSON.stringify(records.slice(0,20)));
}
function canonicalRushAnswer(value){
  if(Array.isArray(value)) return value.map(String).map(x=>x.trim().toUpperCase()).filter(Boolean).sort().join("");
  return String(value??"").replace(/[\s,;]+/g,"").toUpperCase().split("").sort().join("");
}
function rushAnswerMatches(user,key,type){
  if(type==="NAT"){
    const u=Number(user),k=Number(key);
    return Number.isFinite(u)&&Number.isFinite(k) ? Math.abs(u-k)<1e-9 : String(user).trim()===String(key).trim();
  }
  return canonicalRushAnswer(user)===canonicalRushAnswer(key);
}
function renderRushSetup(){
  const container=document.getElementById("rushTopics");
  if(!container || !dbTopics.length) return;
  container.innerHTML="";
  const groups={};
  dbSubjects.forEach(s=>groups[s.id]={subject:s,topics:[]});
  dbTopics.forEach(t=>{if(groups[t.subject_id])groups[t.subject_id].topics.push(t);});
  Object.values(groups).forEach(group=>{
    if(!group.topics.length)return;
    const wrap=document.createElement("div");wrap.className="rush-topic-group";
    const title=document.createElement("div");title.className="rush-topic-group-title";
    title.innerHTML=`<strong>${escapeHTML(group.subject.name)}</strong><button type="button" class="rush-mini-btn" onclick="rushToggleSubject('${group.subject.id}')">Toggle</button>`;
    wrap.appendChild(title);
    const grid=document.createElement("div");grid.className="rush-topic-grid";grid.dataset.subjectId=group.subject.id;
    group.topics.forEach(t=>{
      const label=document.createElement("label");label.className="rush-topic-chip";
      label.innerHTML=`<input type="checkbox" class="rush-topic-check" value="${t.id}" data-name="${escapeHTML(t.name)}"><span>${escapeHTML(t.name)}</span>`;
      grid.appendChild(label);
    });
    wrap.appendChild(grid);container.appendChild(wrap);
  });
  document.querySelectorAll(".rush-topic-check").forEach(c=>c.addEventListener("change",updateRushSelection));
  updateRushSelection();
  renderRushRecords();
}
function updateRushSelection(){
  const checks=[...document.querySelectorAll(".rush-topic-check:checked")];
  rushSelectedTopicIds=checks.map(c=>c.value);
  rushSelectedTopicNames=checks.map(c=>c.dataset.name);
  const el=document.getElementById("rushSelectionCount");
  if(el)el.textContent=`${checks.length} topic${checks.length===1?"":"s"} selected`;
}
function rushSelectAll(){
  const checks=[...document.querySelectorAll(".rush-topic-check")];
  const shouldSelect=checks.some(c=>!c.checked);
  checks.forEach(c=>c.checked=shouldSelect);
  updateRushSelection();
}
function rushToggleSubject(subjectId){
  const checks=[...document.querySelectorAll(`.rush-topic-grid[data-subject-id="${subjectId}"] .rush-topic-check`)];
  const shouldSelect=checks.some(c=>!c.checked);
  checks.forEach(c=>c.checked=shouldSelect);
  updateRushSelection();
}
async function fetchRushQuestions(topicIds){
  const out=[];let from=0;const batch=1000;
  while(from<5000){
    const {data,error}=await db.from("questions")
      .select("id,subject_id,topic_id,question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty")
      .eq("is_pyq",false).in("topic_id",topicIds).range(from,from+batch-1);
    if(error)throw error;
    const rows=data||[];out.push(...rows);
    if(rows.length<batch)break;
    from+=batch;
  }
  return out.map(normalizeQuestion).filter(q=>q.question && (q.type==="MCQ"||q.type==="MSQ"||q.type==="NAT"));
}
async function startRush(){
  updateRushSelection();
  if(!db){showToast("Connect Supabase first.");return;}
  if(!rushSelectedTopicIds.length){showToast("Select at least one topic to start the Rush.");return;}
  const button=document.querySelector('#rushSetup .primary-btn');
  if(button){button.disabled=true;button.textContent="LOADING QUESTIONS…";}
  try{
    const pool=await fetchRushQuestions(rushSelectedTopicIds);
    if(!pool.length){showToast("No Rush questions found for the selected topics.");return;}
    rushQuestions=pool.sort(()=>Math.random()-.5);
    rushIndex=0;rushScore=0;rushLives=3;rushStreak=0;rushBestStreak=0;rushCorrectCount=0;rushWrongCount=0;rushCurrentAnswer=null;rushAnswerSubmitted=false;
    document.getElementById("rushSetup").classList.add("hidden");
    document.getElementById("rushResult").classList.add("hidden");
    document.getElementById("rushGame").classList.remove("hidden");
    document.getElementById("rushActiveTopics").innerHTML=rushSelectedTopicNames.map(n=>`<span class="rush-active-topic">${escapeHTML(n)}</span>`).join("");
    renderRushQuestion();
  }catch(error){console.error(error);showToast("Could not load Rush questions: "+(error.message||error));}
  finally{if(button){button.disabled=false;button.textContent="START RUSH →";}}
}
function renderRushQuestion(){
  const q=rushQuestions[rushIndex];if(!q)return;
  rushCurrentAnswer=null;rushAnswerSubmitted=false;
  document.getElementById("rushProgress").textContent=`Question ${rushIndex+1}`;
  document.getElementById("rushQuestionNumber").textContent=`Question ${rushIndex+1} · ${rushQuestions.length} available`;
  document.getElementById("rushSubject").textContent=q.subject.toUpperCase();
  document.getElementById("rushType").textContent=q.type;
  document.getElementById("rushDifficulty").textContent=q.difficulty||"JAM LEVEL";
  document.getElementById("rushQuestion").textContent=q.question;
  document.getElementById("rushScore").textContent=rushScore;
  document.getElementById("rushStreak").textContent=rushStreak;
  renderRushLives();
  document.getElementById("rushFeedback").textContent="";
  document.getElementById("rushFeedback").className="rush-feedback";
  document.getElementById("rushExplanation").classList.add("hidden");
  document.getElementById("rushExplanationText").textContent=q.explanation||"No explanation stored.";
  document.getElementById("rushCheckBtn").classList.remove("hidden");
  document.getElementById("rushNextBtn").classList.add("hidden");
  const options=document.getElementById("rushOptions");options.innerHTML="";
  if(q.type==="NAT"){
    const input=document.createElement("input");input.id="rushNatAnswer";input.className="pyq-nat-input";input.type="text";input.inputMode="decimal";input.placeholder="Enter numerical answer";options.appendChild(input);
    return;
  }
  q.options.forEach((option,index)=>{
    const letter=String.fromCharCode(65+index);const div=document.createElement("div");div.className="option rush-option";div.dataset.letter=letter;div.textContent=`${letter}. ${option}`;
    div.onclick=()=>{
      if(rushAnswerSubmitted)return;
      if(q.type==="MSQ"){
        div.classList.toggle("selected");
        rushCurrentAnswer=[...document.querySelectorAll("#rushOptions .rush-option.selected")].map(x=>x.dataset.letter);
      }else{
        document.querySelectorAll("#rushOptions .rush-option").forEach(x=>x.classList.remove("selected"));div.classList.add("selected");rushCurrentAnswer=letter;
      }
    };options.appendChild(div);
  });
}
function getRushUserAnswer(){
  const q=rushQuestions[rushIndex];
  if(q.type==="NAT")return document.getElementById("rushNatAnswer")?.value.trim()||"";
  if(q.type==="MSQ")return rushCurrentAnswer||[];
  return rushCurrentAnswer||"";
}
function submitRushAnswer(){
  if(rushAnswerSubmitted)return;
  const q=rushQuestions[rushIndex];const user=getRushUserAnswer();
  const empty=q.type==="MSQ"?(Array.isArray(user)&&!user.length):!String(user).trim();
  if(empty){showToast("Choose an answer first.");return;}
  rushAnswerSubmitted=true;
  const correct=rushAnswerMatches(user,q.answer,q.type);
  const feedback=document.getElementById("rushFeedback");
  document.getElementById("rushExplanation").classList.remove("hidden");
  if(correct){
    rushCorrectCount++;
    rushStreak++;rushBestStreak=Math.max(rushBestStreak,rushStreak);
    const gained=10+Math.min(20,(rushStreak-1)*2);rushScore+=gained;
    feedback.textContent=`✓ Correct! +${gained} points`;
    feedback.classList.add("correct");
    document.getElementById("rushStreak").textContent=rushStreak;
    document.getElementById("rushScore").textContent=rushScore;
    markRushCorrectAnswer(q);
  }else{
    rushWrongCount++;
    rushLives--;rushStreak=0;
    feedback.textContent=`✕ Wrong. ${rushLives} ${rushLives===1?"life":"lives"} left.`;
    feedback.classList.add("wrong");
    markRushCorrectAnswer(q);renderRushLives();
  }
  document.getElementById("rushCheckBtn").classList.add("hidden");
  document.getElementById("rushNextBtn").classList.remove("hidden");
  if(rushLives<=0){document.getElementById("rushNextBtn").textContent="SEE RESULT";}
}
function markRushCorrectAnswer(q){
  if(q.type==="NAT")return;
  const correctLetters=String(q.answer).split(/[\s,;]+/).filter(Boolean).map(x=>x.trim().toUpperCase());
  document.querySelectorAll("#rushOptions .rush-option").forEach(el=>{
    if(correctLetters.includes(el.dataset.letter))el.classList.add("correct");
    if(el.classList.contains("selected")&&!correctLetters.includes(el.dataset.letter))el.classList.add("wrong");
  });
}
function renderRushLives(){
  const full="❤️ ".repeat(rushLives).trim();const empty="🖤 ".repeat(3-rushLives).trim();
  document.getElementById("rushLives").textContent=[full,empty].filter(Boolean).join(" ");
}
function nextRushQuestion(){
  if(rushLives<=0){finishRush();return;}
  rushIndex++;
  if(rushIndex>=rushQuestions.length){finishRush();return;}
  renderRushQuestion();
}
function finishRush(){
  const record={date:new Date().toISOString(),score:rushScore,bestStreak:rushBestStreak,topics:rushSelectedTopicNames.length};
  saveRushRecord(record);renderRushRecords();
  document.getElementById("rushGame").classList.add("hidden");document.getElementById("rushResult").classList.remove("hidden");
  document.getElementById("rushFinalScore").textContent=rushScore;
  document.getElementById("rushFinalCorrect").textContent=rushCorrectCount;
  document.getElementById("rushFinalWrong").textContent=rushWrongCount;
  document.getElementById("rushFinalStreak").textContent=rushBestStreak;
  document.getElementById("rushResultTitle").textContent=rushLives<=0?"Three lives used 🔥":"Rush complete 🎉";
  document.getElementById("rushResultMessage").textContent=rushLives<=0?"You reached zero lives. Start again and try to beat your score.":"You cleared the available Rush questions. Try another topic mix.";
}
function quitRush(){
  if(!confirm("Exit this Rush? Your current run will not be saved."))return;
  showRushSetup();
}
function showRushSetup(){
  document.getElementById("rushGame").classList.add("hidden");document.getElementById("rushResult").classList.add("hidden");document.getElementById("rushSetup").classList.remove("hidden");renderRushSetup();
}
function renderRushRecords(){
  const records=getRushRecords();
  const bestScore=records.length?Math.max(...records.map(r=>Number(r.score)||0)):0;
  const bestStreak=records.length?Math.max(...records.map(r=>Number(r.bestStreak)||0)):0;
  document.getElementById("rushBestScore").textContent=bestScore;
  document.getElementById("rushBestStreak").textContent=bestStreak;
  document.getElementById("rushPlayed").textContent=records.length;
  const list=document.getElementById("rushLeaderboard");if(!list)return;
  list.innerHTML=records.length?`<div class="rush-leaderboard-head"><span>Rank</span><span>Score</span><span>Streak</span></div>`+records.slice(0,10).map((r,i)=>`<div class="rush-leaderboard-row"><span>#${i+1}</span><strong>${Number(r.score)||0}</strong><span>${Number(r.bestStreak)||0}</span></div>`).join(""):"<p class=\"muted\">No Rush runs yet. Your best scores will appear here.</p>";
}

function startPYQ(){
  goTo("pyq");
}

function startMock(){
  goTo("mock");
  prepareMock(10);
}

function prepareMock(number){
  // General mock remains available, but now uses real Supabase questions.
  loadRandomMock(number);
}

async function loadRandomMock(number){
  if(!db){showToast("Connect Supabase first.");return;}
  const {data,error}=await db.from("questions")
    .select("id,subject_id,topic_id,question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty")
    .eq("is_pyq",false)
    .limit(5000);
  if(error){showToast("Could not load mock: "+error.message);return;}
  const pool=(data||[]).map(normalizeQuestion);
  mockQuestions=pool.sort(()=>Math.random()-.5).slice(0,Math.min(number,pool.length));
  mockIndex=0;mockAnswers={};
  mockTime=number===60?3600:number===20?1800:900;
  document.getElementById("mockSetup").classList.add("hidden");
  document.getElementById("mockResult").classList.add("hidden");
  document.getElementById("mockTest").classList.remove("hidden");
  renderMockQuestion();startTimer();
}

let mockQuestions=[],mockIndex=0,mockAnswers={},mockTime=0,mockInterval=null;

function renderMockQuestion(){
  const q=mockQuestions[mockIndex];
  if(!q)return;
  document.getElementById("mockQuestionNumber").textContent=`Question ${mockIndex+1} / ${mockQuestions.length}`;
  document.getElementById("mockSubject").textContent=q.subject.toUpperCase();
  document.getElementById("mockQuestion").textContent=q.question;
  const container=document.getElementById("mockOptions");
  container.innerHTML="";
  q.options.forEach((option,index)=>{
    const div=document.createElement("div");
    div.className="option";
    if(mockAnswers[mockIndex]===String.fromCharCode(65+index))div.classList.add("selected");
    div.textContent=`${String.fromCharCode(65+index)}. ${option}`;
    div.onclick=()=>{mockAnswers[mockIndex]=String.fromCharCode(65+index);renderMockQuestion();};
    container.appendChild(div);
  });
}

function nextMockQuestion(){
  if(mockIndex<mockQuestions.length-1){mockIndex++;renderMockQuestion();}
  else finishMock();
}
function previousMockQuestion(){if(mockIndex>0){mockIndex--;renderMockQuestion();}}
function startTimer(){
  clearInterval(mockInterval);updateTimer();
  mockInterval=setInterval(()=>{
    mockTime--;updateTimer();
    if(mockTime<=0){clearInterval(mockInterval);finishMock();}
  },1000);
}
function updateTimer(){
  const minutes=Math.floor(mockTime/60),seconds=mockTime%60;
  document.getElementById("mockTimer").textContent=`${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}
function finishMock(){
  clearInterval(mockInterval);
  let correct=0,wrong=0;
  mockQuestions.forEach((q,index)=>{
    if(mockAnswers[index]===undefined)return;
    if(normalizeAnswer(mockAnswers[index])===normalizeAnswer(q.answer))correct++;else wrong++;
  });
  const raw=correct-(wrong*.25);
  const score=Math.max(0,Math.round((raw/mockQuestions.length)*100));
  const accuracy=correct+wrong===0?0:Math.round(correct/(correct+wrong)*100);
  const data=getData();
  data.mocks.push({date:new Date().toISOString(),score,correct,wrong,accuracy});
  saveData(data);
  document.getElementById("mockTest").classList.add("hidden");
  document.getElementById("mockResult").classList.remove("hidden");
  document.getElementById("resultScore").textContent=score;
  document.getElementById("resultCorrect").textContent=correct;
  document.getElementById("resultWrong").textContent=wrong;
  document.getElementById("resultAccuracy").textContent=accuracy+"%";
  document.getElementById("resultMessage").textContent=score>=70?"Excellent progress. Keep pushing.":score>=50?"Good foundation. Now target the weak topics.":"Use this result to identify and fix your weak areas.";
  updateStats();
}
function showMockSetup(){
  document.getElementById("mockResult").classList.add("hidden");
  document.getElementById("mockSetup").classList.remove("hidden");
}

function renderAnalytics(){
  const data=getData();
  document.getElementById("analyticsQuestions").textContent=data.solved;
  const accuracy=data.solved?Math.round(data.correct/data.solved*100):0;
  document.getElementById("analyticsAccuracy").textContent=accuracy+"%";
  document.getElementById("analyticsMocks").textContent=data.mocks.length;
  const best=data.mocks.length?Math.max(...data.mocks.map(m=>m.score)):null;
  document.getElementById("analyticsBest").textContent=best===null?"—":best+"/100";
  renderSubjectAnalytics();
  renderScoreHistory();
}

function renderSubjectAnalytics(){
  const data=getData(),container=document.getElementById("subjectAnalytics");
  if(!container)return;
  container.innerHTML="";
  dbSubjects.forEach(subject=>{
    let attempted=0,correct=0;
    dbTopics.filter(t=>t.subject_id===subject.id).forEach(t=>{
      const stats=data.topicStats[t.name];
      if(stats){attempted+=stats.attempted;correct+=stats.correct;}
    });
    const percentage=attempted?Math.round(correct/attempted*100):0;
    const row=document.createElement("div");
    row.className="analytics-row";
    row.innerHTML=`<div class="analytics-row-top"><span>${escapeHTML(subject.name)}</span><strong>${percentage}%</strong></div><div class="progress"><div class="progress-bar" style="width:${percentage}%"></div></div>`;
    container.appendChild(row);
  });
}

function renderScoreHistory(){
  const data=getData(),container=document.getElementById("scoreHistory");
  container.innerHTML="";
  if(!data.mocks.length){container.innerHTML=`<p class="muted">Your mock scores will appear here.</p>`;return;}
  data.mocks.slice(-8).forEach(mock=>{
    const bar=document.createElement("div");
    bar.className="score-bar";
    bar.style.height=Math.max(15,mock.score)+"%";
    bar.innerHTML=`<span>${mock.score}</span>`;
    container.appendChild(bar);
  });
}

function updateStats(){
  const data=getData();
  document.getElementById("questionsSolved").textContent=data.solved;
  const accuracy=data.solved?Math.round(data.correct/data.solved*100):0;
  document.getElementById("accuracy").textContent=accuracy+"%";
  document.getElementById("streak").textContent=`${data.streak} days`;
  if(data.mocks.length){
    const latest=data.mocks[data.mocks.length-1],best=Math.max(...data.mocks.map(m=>m.score));
    document.getElementById("latestMock").textContent=latest.score+"/100";
    document.getElementById("bestMock").textContent=best+"/100";
  }
  document.getElementById("overallProgress").textContent="—";
}

function escapeHTML(value){
  return String(value??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}
function showToast(message){
  const toast=document.getElementById("toast");
  if(!toast)return;
  toast.textContent=message;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),3000);
}

document.addEventListener("DOMContentLoaded",initSupabasePractice);
