/* JAM BT PYQ Mock Engine
   Loads the 2015–2026 PYQ mock tables from Supabase.
*/
let pyqDb = null;
let pyqYears = [];
let pyqCurrent = null;
let pyqIndex = 0;
let pyqAnswers = {};
let pyqRemainingSeconds = 180 * 60;
let pyqTimerInterval = null;

const PYQ_DURATION_SECONDS = 180 * 60;

function pyqConfigReady(){
  return typeof SUPABASE_URL !== "undefined" &&
         typeof SUPABASE_ANON_KEY !== "undefined" &&
         SUPABASE_URL &&
         SUPABASE_ANON_KEY &&
         !SUPABASE_URL.includes("PASTE_YOUR") &&
         !SUPABASE_ANON_KEY.includes("PASTE_YOUR");
}

function pyqSetNotice(message, isError=false){
  const el=document.getElementById("pyqConnectionNotice");
  if(!el) return;
  el.innerHTML=`<strong>${isError?"PYQ connection issue":"PYQ Mock System"}</strong><p class="muted">${message}</p>`;
}

async function initPYQMocks(){
  const grid=document.getElementById("pyqYearMocks");
  if(!grid) return;
  if(!pyqConfigReady()){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;padding:30px 10px">
      <div>🔑</div><h3>One-time Supabase connection needed</h3>
      <p>Open <b>supabase-config.js</b> and paste your Supabase Project URL and browser-safe Publishable/anon key. Then reload this page.</p>
    </div>`;
    return;
  }
  try{
    const {createClient}=supabase;
    pyqDb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const {data,error}=await pyqDb.from("pyq_mocks").select("id,year,title,duration_minutes,total_questions,total_marks").order("year",{ascending:false});
    if(error) throw error;
    pyqYears=data||[];
    renderPYQYearButtons();
    pyqSetNotice(`${pyqYears.length} PYQ papers connected. Select a year to begin.`);
  }catch(error){
    console.error(error);
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;padding:30px 10px"><div>⚠️</div><h3>Could not load PYQ papers</h3><p>${escapePYQ(String(error.message||error))}</p></div>`;
    pyqSetNotice("Check that your Supabase URL/key are correct and that the PYQ tables were created successfully.",true);
  }
}

function escapePYQ(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}

function renderPYQYearButtons(){
  const grid=document.getElementById("pyqYearMocks");
  if(!grid)return;
  if(!pyqYears.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;padding:30px"><div>📜</div><h3>No PYQ papers found</h3><p>The Supabase PYQ tables are empty.</p></div>`;
    return;
  }
  grid.innerHTML="";
  pyqYears.forEach(row=>{
    const card=document.createElement("button");
    card.className="pyq-year-card";
    card.innerHTML=`<strong>${row.year}</strong><span>${row.total_questions} Questions · ${row.total_marks} Marks</span><small>180 min · Start →</small>`;
    card.onclick=()=>startPYQMock(row.year);
    grid.appendChild(card);
  });
}

async function startPYQMock(year){
  if(!pyqDb){showToast("Connect Supabase first.");return;}
  clearInterval(pyqTimerInterval);
  const meta=pyqYears.find(x=>Number(x.year)===Number(year));
  if(!meta){showToast("PYQ year not found.");return;}
  pyqSetNotice(`Loading ${year} PYQ...`);
  try{
    const {data,error}=await pyqDb.from("pyq_mock_questions")
      .select("id,mock_id,question_number,section,question_type,marks,question_text,option_a,option_b,option_c,option_d,correct_answer")
      .eq("mock_id",meta.id).order("question_number",{ascending:true});
    if(error)throw error;
    if(!data || data.length===0)throw new Error("No questions found for this year.");
    pyqCurrent={...meta,questions:data};
    pyqIndex=0; pyqAnswers={}; pyqRemainingSeconds=Number(meta.duration_minutes||180)*60;
    document.getElementById("pyqSelectionPanel").classList.add("hidden");
    document.getElementById("pyqMockScreen").classList.remove("hidden");
    document.getElementById("pyqMockResult").classList.add("hidden");
    renderPYQQuestion();
    updatePYQTimer();
    pyqTimerInterval=setInterval(()=>{
      pyqRemainingSeconds--;
      updatePYQTimer();
      if(pyqRemainingSeconds<=0){clearInterval(pyqTimerInterval);submitPYQMock(true);}
    },1000);
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(error){
    console.error(error);
    showToast(`Could not load ${year}: ${error.message||error}`);
  }
}

function renderPYQQuestion(){
  const q=pyqCurrent?.questions?.[pyqIndex];
  if(!q)return;
  document.getElementById("pyqMockTitle").textContent=`JAM BT ${pyqCurrent.year} PYQ`;
  document.getElementById("pyqMockProgress").textContent=`Question ${pyqIndex+1} / ${pyqCurrent.questions.length}`;
  document.getElementById("pyqMockSection").textContent=(q.section||"").toUpperCase();
  document.getElementById("pyqMockType").textContent=(q.question_type||"MCQ").toUpperCase();
  document.getElementById("pyqMockMarks").textContent=`${q.marks} MARK${q.marks===1?"":"S"}`;
  document.getElementById("pyqMockQuestionNumber").textContent=`Question ${q.question_number} of ${pyqCurrent.questions.length}`;
  document.getElementById("pyqMockQuestion").textContent=q.question_text||"";
  const options=document.getElementById("pyqMockOptions");
  options.innerHTML="";
  document.getElementById("pyqMockFeedback").textContent="";
  const nat=document.getElementById("pyqMockNatWrap");
  nat.classList.add("hidden");
  const saved=pyqAnswers[q.question_number];
  const type=(q.question_type||"MCQ").toUpperCase();
  if(type==="NAT"){
    nat.classList.remove("hidden");
    document.getElementById("pyqMockNatAnswer").value=saved?.value??"";
  }else{
    ["option_a","option_b","option_c","option_d"].forEach((key,i)=>{
      if(q[key]===null || q[key]===undefined || q[key]==="")return;
      const div=document.createElement("div");
      div.className="option";
      const letter=String.fromCharCode(65+i);
      const selected=Array.isArray(saved?.value)?saved.value.includes(letter):saved?.value===letter;
      if(selected)div.classList.add("selected");
      div.textContent=`${letter}. ${q[key]}`;
      div.onclick=()=>selectPYQOption(letter,type);
      options.appendChild(div);
    });
  }
}

function selectPYQOption(letter,type){
  const q=pyqCurrent.questions[pyqIndex];
  if(type==="MSQ"){
    const current=Array.isArray(pyqAnswers[q.question_number]?.value)?[...pyqAnswers[q.question_number].value]:[];
    const pos=current.indexOf(letter);
    if(pos>=0)current.splice(pos,1);else current.push(letter);
    current.sort();
    pyqAnswers[q.question_number]={value:current};
  }else{
    pyqAnswers[q.question_number]={value:letter};
  }
  renderPYQQuestion();
}

function savePYQNat(){
  const q=pyqCurrent.questions[pyqIndex];
  pyqAnswers[q.question_number]={value:document.getElementById("pyqMockNatAnswer").value.trim()};
}

function pyqPreviousQuestion(){
  if(!pyqCurrent)return;
  if((pyqCurrent.questions[pyqIndex].question_type||"").toUpperCase()==="NAT")savePYQNat();
  if(pyqIndex>0){pyqIndex--;renderPYQQuestion();}
}

function pyqNextQuestion(){
  if(!pyqCurrent)return;
  if((pyqCurrent.questions[pyqIndex].question_type||"").toUpperCase()==="NAT")savePYQNat();
  if(pyqIndex<pyqCurrent.questions.length-1){pyqIndex++;renderPYQQuestion();}else submitPYQMock(false);
}

function updatePYQTimer(){
  const m=Math.floor(pyqRemainingSeconds/60),s=pyqRemainingSeconds%60;
  const el=document.getElementById("pyqMockTimer");
  if(el)el.textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function normalizePYQAnswer(value){
  if(Array.isArray(value))return value.join("").replace(/[\s,;]+/g,"").toUpperCase();
  return String(value??"").trim().replace(/[\s,;]+/g,"").toUpperCase();
}

function natPYQMatches(user,key){
  if(key===null||key===undefined||String(key).trim()==="")return null;
  const u=String(user??"").trim(),k=String(key).trim();
  if(!u)return false;
  const nums=[u,k].map(x=>Number(x));
  if(nums.every(Number.isFinite))return Math.abs(nums[0]-nums[1])<1e-9;
  return normalizePYQAnswer(u)===normalizePYQAnswer(k);
}

function gradePYQ(){
  let correct=0,wrong=0,unanswered=0,unscored=0,score=0;
  pyqCurrent.questions.forEach(q=>{
    const raw=pyqAnswers[q.question_number]?.value;
    const type=(q.question_type||"MCQ").toUpperCase();
    const hasAnswer=type==="NAT"?String(raw??"").trim()!=="":(Array.isArray(raw)?raw.length>0:!!raw);
    if(!hasAnswer){unanswered++;return;}
    const key=q.correct_answer;
    if(key===null||key===undefined||String(key).trim()===""){unscored++;return;}
    let ok=false;
    if(type==="NAT") ok=natPYQMatches(raw,key)===true;
    else ok=normalizePYQAnswer(raw)===normalizePYQAnswer(key);
    if(ok){correct++;score+=Number(q.marks)||0;}
    else{
      wrong++;
      if(type==="MCQ")score-=Number(q.marks)===2?(2/3):(1/3);
    }
  });
  score=Math.max(0,Math.round(score*100)/100);
  return {correct,wrong,unanswered,unscored,score,attempted:correct+wrong+unscored,accuracy:(correct+wrong+unscored)?Math.round(correct/(correct+wrong+unscored)*100):0};
}

function submitPYQMock(autoSubmit=false){
  if(!pyqCurrent)return;
  if((pyqCurrent.questions[pyqIndex].question_type||"").toUpperCase()==="NAT")savePYQNat();
  clearInterval(pyqTimerInterval);
  const result=gradePYQ();
  document.getElementById("pyqMockScreen").classList.add("hidden");
  document.getElementById("pyqMockResult").classList.remove("hidden");
  document.getElementById("pyqResultScore").textContent=result.score;
  document.getElementById("pyqResultCorrect").textContent=result.correct;
  document.getElementById("pyqResultWrong").textContent=result.wrong;
  document.getElementById("pyqResultUnanswered").textContent=result.unanswered;
  document.getElementById("pyqResultAttempted").textContent=result.attempted;
  document.getElementById("pyqResultAccuracy").textContent=result.accuracy+"%";
  document.getElementById("pyqResultUnscored").textContent=result.unscored;
  document.getElementById("pyqResultTitle").textContent=autoSubmit?`${pyqCurrent.year} PYQ — Time Up`:`${pyqCurrent.year} PYQ Completed`;
  document.getElementById("pyqResultMessage").textContent=result.unscored
    ? `${result.unscored} answered question${result.unscored===1?" is":"s are"} not scored because the database has no answer key for ${pyqCurrent.year}.`
    : "Your paper has been scored using the JAM marking rules.";
  window.scrollTo({top:0,behavior:"smooth"});
}

function showPYQYearSelection(){
  clearInterval(pyqTimerInterval);
  document.getElementById("pyqMockResult").classList.add("hidden");
  document.getElementById("pyqMockScreen").classList.add("hidden");
  const panel=document.getElementById("pyqSelectionPanel");
  panel.classList.remove("hidden");
  pyqSetNotice("Choose another year to begin a new 180-minute paper.");
  window.scrollTo({top:0,behavior:"smooth"});
}

document.addEventListener("DOMContentLoaded",()=>{
  setTimeout(initPYQMocks,50);
});
