const subjects={
Biology:{icon:"🧬",description:"Cell biology, genetics, ecology, evolution and more.",progress:42,topics:["Cell Biology","Genetics","Molecular Biology","Biochemistry","Evolution","Ecology","Plant Biology","Animal Biology","Physiology"]},
Biotechnology:{icon:"🔬",description:"Microbiology, recombinant DNA, techniques and biotechnology.",progress:35,topics:["Microbiology","Molecular Biology","Genetic Engineering","Bioprocess Engineering","Immunology","Plant Biotechnology","Animal Biotechnology","Bioinformatics","Biostatistics"]},
Chemistry:{icon:"⚗️",description:"Physical, organic and inorganic chemistry.",progress:48,topics:["Structure of Atom","Periodic Properties","Chemical Bonding","Thermodynamics","Chemical Equilibrium","Organic Chemistry","Inorganic Chemistry","Electrochemistry","Chemical Kinetics"]},
Physics:{icon:"⚛️",description:"Mechanics, electricity, optics, thermodynamics and modern physics.",progress:31,topics:["Units and Dimensions","Mechanics","Properties of Matter","Thermodynamics","Waves","Electricity","Magnetism","Optics","Modern Physics"]},
Mathematics:{icon:"∑",description:"Algebra, calculus, probability, statistics and more.",progress:27,topics:["Sets and Functions","Algebra","Complex Numbers","Matrices","Differential Calculus","Integral Calculus","Differential Equations","Probability","Statistics"]}
};

const questions=[
{id:1,subject:"Biology",topic:"Cell Biology",type:"MCQ",difficulty:"JAM LEVEL",question:"Which organelle is primarily responsible for ATP production in eukaryotic cells?",options:["Golgi apparatus","Mitochondria","Lysosome","Endoplasmic reticulum"],answer:1,explanation:"Mitochondria are the major sites of oxidative phosphorylation and ATP production in eukaryotic cells."},
{id:2,subject:"Biology",topic:"Genetics",type:"MCQ",difficulty:"JAM LEVEL",question:"A heterozygous individual for a Mendelian trait is represented by:",options:["AA","aa","Aa","AAA"],answer:2,explanation:"A heterozygous individual carries two different alleles, represented as Aa."},
{id:3,subject:"Biotechnology",topic:"Microbiology",type:"MCQ",difficulty:"JAM LEVEL",question:"Which bacterial structure is primarily involved in motility?",options:["Capsule","Flagellum","Ribosome","Plasmid"],answer:1,explanation:"Bacterial flagella provide motility by rotating and propelling the cell."},
{id:4,subject:"Biotechnology",topic:"Molecular Biology",type:"MCQ",difficulty:"JAM LEVEL",question:"Which enzyme synthesizes RNA using a DNA template?",options:["DNA polymerase","RNA polymerase","Ligase","Helicase"],answer:1,explanation:"RNA polymerase catalyses transcription by synthesizing RNA from a DNA template."},
{id:5,subject:"Chemistry",topic:"Structure of Atom",type:"MCQ",difficulty:"JAM LEVEL",question:"Which quantum number determines the shape of an orbital?",options:["Principal quantum number","Azimuthal quantum number","Magnetic quantum number","Spin quantum number"],answer:1,explanation:"The azimuthal quantum number (l) determines the subshell and therefore the shape of the orbital."},
{id:6,subject:"Chemistry",topic:"Chemical Bonding",type:"MCQ",difficulty:"JAM LEVEL",question:"Which bond results from the sharing of electron pairs between atoms?",options:["Ionic bond","Covalent bond","Metallic bond","Hydrogen bond"],answer:1,explanation:"A covalent bond is formed by sharing one or more pairs of electrons between atoms."},
{id:7,subject:"Physics",topic:"Mechanics",type:"MCQ",difficulty:"JAM LEVEL",question:"The SI unit of force is:",options:["Joule","Watt","Newton","Pascal"],answer:2,explanation:"The SI unit of force is the newton (N), equivalent to kg·m/s²."},
{id:8,subject:"Physics",topic:"Modern Physics",type:"MCQ",difficulty:"JAM LEVEL",question:"The energy of a photon is directly proportional to:",options:["Wavelength","Frequency","Mass","Volume"],answer:1,explanation:"Photon energy is given by E = hν, so it is directly proportional to frequency."},
{id:9,subject:"Mathematics",topic:"Probability",type:"MCQ",difficulty:"JAM LEVEL",question:"The probability of an impossible event is:",options:["0","1","1/2","∞"],answer:0,explanation:"An impossible event has probability zero."},
{id:10,subject:"Mathematics",topic:"Complex Numbers",type:"MCQ",difficulty:"JAM LEVEL",question:"The value of i² is:",options:["1","-1","i","0"],answer:1,explanation:"By definition of the imaginary unit, i² = -1."}
];

let currentQuestionIndex=0,currentQuestions=[...questions],mockQuestions=[],mockIndex=0,mockAnswers={},mockTime=0,mockInterval=null;

function getData(){return JSON.parse(localStorage.getItem("jamBTData")||JSON.stringify({solved:0,correct:0,mistakes:[],mocks:[],streak:0,topicStats:{}}))}
function saveData(data){localStorage.setItem("jamBTData",JSON.stringify(data))}
function goTo(page){
document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
const target=document.getElementById(page);if(target)target.classList.add("active");
document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));
const nav=document.querySelector(`.nav[data-page="${page}"]`);if(nav)nav.classList.add("active");
window.scrollTo({top:0,behavior:"smooth"});
if(page==="mistakes")renderMistakes();
if(page==="analytics")renderAnalytics();
}
document.querySelectorAll(".nav").forEach(button=>button.addEventListener("click",()=>goTo(button.dataset.page)));

function renderDashboard(){
const container=document.getElementById("dashboardSubjects");container.innerHTML="";
Object.entries(subjects).forEach(([name,data])=>{
const div=document.createElement("div");div.className="subject-row";div.onclick=()=>openSubject(name);
div.innerHTML=`<div class="subject-row-top"><div><span>${data.icon}</span><strong>${name}</strong></div><small>${data.progress}%</small></div><div class="progress"><div class="progress-bar" style="width:${data.progress}%"></div></div>`;
container.appendChild(div);
});updateStats();
}
function renderSubjects(){
const grid=document.getElementById("subjectGrid");grid.innerHTML="";
Object.entries(subjects).forEach(([name,data])=>{
const card=document.createElement("div");card.className="large-subject-card";card.onclick=()=>openSubject(name);
card.innerHTML=`<div class="subject-icon-large">${data.icon}</div><h3>${name}</h3><p>${data.description}</p><div class="progress"><div class="progress-bar" style="width:${data.progress}%"></div></div><div style="display:flex;justify-content:space-between;margin-top:7px;font-size:11px;color:#74798b"><span>${data.progress}% complete</span><span>${data.topics.length} topics →</span></div>`;
grid.appendChild(card);
});
}
function openSubject(subject){goTo("practice");document.getElementById("subjectSelect").value=subject;loadTopics()}
function initializeSubjectSelect(){const select=document.getElementById("subjectSelect");select.innerHTML="";Object.keys(subjects).forEach(subject=>{const option=document.createElement("option");option.value=subject;option.textContent=subject;select.appendChild(option)});loadTopics()}
function loadTopics(){
const subject=document.getElementById("subjectSelect").value,container=document.getElementById("topicButtons");container.innerHTML="";
subjects[subject].topics.forEach(topic=>{const button=document.createElement("button");button.className="topic-button";button.textContent=topic;button.onclick=()=>startTopic(subject,topic);container.appendChild(button)});
}
function startTopic(subject,topic){
currentQuestions=questions.filter(q=>q.subject===subject&&q.topic===topic);
if(!currentQuestions.length)currentQuestions=questions.filter(q=>q.subject===subject);
if(!currentQuestions.length){showToast("Question bank for this topic is coming next.");return}
currentQuestionIndex=0;document.getElementById("practiceTitle").textContent=topic;document.getElementById("practiceSubtitle").textContent=`${subject} · ${topic}`;renderQuestion();
}
function renderQuestion(){
const q=currentQuestions[currentQuestionIndex];if(!q)return;
document.getElementById("questionSubject").textContent=q.subject.toUpperCase();
document.getElementById("questionType").textContent=q.type;document.getElementById("questionDifficulty").textContent=q.difficulty;
document.getElementById("questionCount").textContent=`Question ${currentQuestionIndex+1} of ${currentQuestions.length}`;
document.getElementById("questionText").textContent=q.question;
const options=document.getElementById("options");options.innerHTML="";
document.getElementById("answerMessage").textContent="";document.getElementById("explanation").style.display="none";
q.options.forEach((option,index)=>{const div=document.createElement("div");div.className="option";div.textContent=`${String.fromCharCode(65+index)}. ${option}`;div.onclick=()=>answerQuestion(index);options.appendChild(div)});
}
function answerQuestion(selected){
const q=currentQuestions[currentQuestionIndex],optionElements=document.querySelectorAll("#options .option");optionElements.forEach(el=>el.style.pointerEvents="none");
const data=getData();data.solved++;const correct=selected===q.answer;
if(correct){data.correct++;optionElements[selected].classList.add("correct");document.getElementById("answerMessage").textContent="Correct! ✓";document.getElementById("answerMessage").style.color="var(--green)"}
else{optionElements[selected].classList.add("wrong");optionElements[q.answer].classList.add("correct");document.getElementById("answerMessage").textContent="Incorrect ✕";document.getElementById("answerMessage").style.color="var(--red)";addMistake(q)}
document.getElementById("explanationText").textContent=q.explanation;document.getElementById("explanation").style.display="block";
if(!data.topicStats[q.topic])data.topicStats[q.topic]={attempted:0,correct:0};data.topicStats[q.topic].attempted++;if(correct)data.topicStats[q.topic].correct++;
saveData(data);updateStats();
}
function nextQuestion(){if(!currentQuestions.length){showToast("Select a topic first.");return}currentQuestionIndex++;if(currentQuestionIndex>=currentQuestions.length)currentQuestionIndex=0;renderQuestion()}
function addMistake(q){const data=getData();if(!data.mistakes.some(m=>m.id===q.id)){data.mistakes.push(q);saveData(data)}}
function addCurrentToMistakes(){const q=currentQuestions[currentQuestionIndex];if(!q)return;addMistake(q);renderMistakes();showToast("Added to your Mistake Bank.")}
function renderMistakes(){
const data=getData();document.getElementById("mistakeCount").textContent=data.mistakes.length;document.getElementById("revisionCount").textContent=data.mistakes.length;
const container=document.getElementById("mistakeList");
if(!data.mistakes.length){container.innerHTML=`<div class="empty-state"><div>🎉</div><h3>No mistakes yet</h3><p>Your mistakes will automatically appear here when you get questions wrong.</p></div>`;return}
container.innerHTML=`<div class="panel-heading"><div><h3>Questions to revise</h3><p>Turn your mistakes into marks.</p></div></div>`;
data.mistakes.forEach(q=>{const item=document.createElement("div");item.className="mistake-item";item.innerHTML=`<strong>${q.question}</strong><small>${q.subject} · ${q.topic}</small>`;container.appendChild(item)});
}
function practiceMistakes(){const data=getData();if(!data.mistakes.length){showToast("Your Mistake Bank is empty.");return}currentQuestions=[...data.mistakes];currentQuestionIndex=0;goTo("practice");renderQuestion()}
function startPYQ(){currentQuestions=[...questions];currentQuestionIndex=0;goTo("practice");document.getElementById("practiceTitle").textContent="JAM PYQ Practice";document.getElementById("practiceSubtitle").textContent="Previous-year question mode";renderQuestion()}
function startMock(){goTo("mock");prepareMock(10)}
function prepareMock(number){
mockQuestions=[...questions].sort(()=>Math.random()-.5).slice(0,Math.min(number,questions.length));mockIndex=0;mockAnswers={};mockTime=number===60?3600:number===20?1800:900;
document.getElementById("mockSetup").classList.add("hidden");document.getElementById("mockResult").classList.add("hidden");document.getElementById("mockTest").classList.remove("hidden");renderMockQuestion();startTimer();
}
function renderMockQuestion(){
const q=mockQuestions[mockIndex];document.getElementById("mockQuestionNumber").textContent=`Question ${mockIndex+1} / ${mockQuestions.length}`;document.getElementById("mockSubject").textContent=q.subject.toUpperCase();document.getElementById("mockQuestion").textContent=q.question;
const container=document.getElementById("mockOptions");container.innerHTML="";
q.options.forEach((option,index)=>{const div=document.createElement("div");div.className="option";if(mockAnswers[mockIndex]===index)div.classList.add("selected");div.textContent=`${String.fromCharCode(65+index)}. ${option}`;div.onclick=()=>{mockAnswers[mockIndex]=index;renderMockQuestion()};container.appendChild(div)});
}
function nextMockQuestion(){if(mockIndex<mockQuestions.length-1){mockIndex++;renderMockQuestion()}else finishMock()}
function previousMockQuestion(){if(mockIndex>0){mockIndex--;renderMockQuestion()}}
function startTimer(){clearInterval(mockInterval);updateTimer();mockInterval=setInterval(()=>{mockTime--;updateTimer();if(mockTime<=0){clearInterval(mockInterval);finishMock()}},1000)}
function updateTimer(){const minutes=Math.floor(mockTime/60),seconds=mockTime%60;document.getElementById("mockTimer").textContent=`${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`}
function finishMock(){
clearInterval(mockInterval);let correct=0,wrong=0;
mockQuestions.forEach((q,index)=>{if(mockAnswers[index]===undefined)return;if(mockAnswers[index]===q.answer)correct++;else wrong++});
const raw=correct-(wrong*.25),score=Math.max(0,Math.round((raw/mockQuestions.length)*100)),accuracy=correct+wrong===0?0:Math.round(correct/(correct+wrong)*100);
const data=getData();data.mocks.push({date:new Date().toISOString(),score,correct,wrong,accuracy});saveData(data);
document.getElementById("mockTest").classList.add("hidden");document.getElementById("mockResult").classList.remove("hidden");
document.getElementById("resultScore").textContent=score;document.getElementById("resultCorrect").textContent=correct;document.getElementById("resultWrong").textContent=wrong;document.getElementById("resultAccuracy").textContent=accuracy+"%";
document.getElementById("resultMessage").textContent=score>=70?"Excellent progress. Keep pushing.":score>=50?"Good foundation. Now target the weak topics.":"Use this result to identify and fix your weak areas.";updateStats();
}
function showMockSetup(){document.getElementById("mockResult").classList.add("hidden");document.getElementById("mockSetup").classList.remove("hidden")}
function renderAnalytics(){
const data=getData();document.getElementById("analyticsQuestions").textContent=data.solved;const accuracy=data.solved?Math.round(data.correct/data.solved*100):0;document.getElementById("analyticsAccuracy").textContent=accuracy+"%";document.getElementById("analyticsMocks").textContent=data.mocks.length;
const best=data.mocks.length?Math.max(...data.mocks.map(m=>m.score)):null;document.getElementById("analyticsBest").textContent=best===null?"—":best+"/100";renderSubjectAnalytics();renderScoreHistory();
}
function renderSubjectAnalytics(){
const data=getData(),container=document.getElementById("subjectAnalytics");container.innerHTML="";
Object.keys(subjects).forEach(subject=>{let attempted=0,correct=0;Object.entries(data.topicStats).forEach(([topic,stats])=>{if(subjects[subject].topics.includes(topic)){attempted+=stats.attempted;correct+=stats.correct}});const percentage=attempted?Math.round(correct/attempted*100):0;const row=document.createElement("div");row.className="analytics-row";row.innerHTML=`<div class="analytics-row-top"><span>${subject}</span><strong>${percentage}%</strong></div><div class="progress"><div class="progress-bar" style="width:${percentage}%"></div></div>`;container.appendChild(row)});
}
function renderScoreHistory(){
const data=getData(),container=document.getElementById("scoreHistory");container.innerHTML="";
if(!data.mocks.length){container.innerHTML=`<p class="muted">Your mock scores will appear here.</p>`;return}
data.mocks.slice(-8).forEach(mock=>{const bar=document.createElement("div");bar.className="score-bar";bar.style.height=Math.max(15,mock.score)+"%";bar.innerHTML=`<span>${mock.score}</span>`;container.appendChild(bar)});
}
function updateStats(){
const data=getData();document.getElementById("questionsSolved").textContent=data.solved;const accuracy=data.solved?Math.round(data.correct/data.solved*100):0;document.getElementById("accuracy").textContent=accuracy+"%";document.getElementById("streak").textContent=`${data.streak} days`;
if(data.mocks.length){const latest=data.mocks[data.mocks.length-1],best=Math.max(...data.mocks.map(m=>m.score));document.getElementById("latestMock").textContent=latest.score+"/100";document.getElementById("bestMock").textContent=best+"/100"}
const totalTopics=Object.values(subjects).reduce((sum,s)=>sum+s.topics.length,0),avg=Object.values(subjects).reduce((sum,s)=>sum+s.progress,0)/Object.keys(subjects).length,progress=Math.round(totalTopics*(avg/100)/totalTopics*100);document.getElementById("overallProgress").textContent=progress+"%";
}
function showToast(message){const toast=document.getElementById("toast");toast.textContent=message;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2500)}
renderDashboard();renderSubjects();initializeSubjectSelect();updateStats();
