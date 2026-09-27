/* JAM BT MASTER — Supabase question-bank edition
   Practice questions are loaded from the existing public.questions table.
   No practice questions are hard-coded here.
*/

const SUBJECT_CATALOG = {
  Biology: { code: "BIO", icon: "🧬", description: "Cell biology, genetics, ecology, evolution, microbiology, plant and animal biology.", progress: 0 },
  Biotechnology: { code: "BT", icon: "🔬", description: "Biotechnology, recombinant DNA, bioprocessing, molecular techniques and bioinformatics.", progress: 0 },
  Chemistry: { code: "CHEM", icon: "⚗️", description: "Physical, organic and inorganic chemistry.", progress: 0 },
  Physics: { code: "PHY", icon: "⚛️", description: "Mechanics, electricity, optics, thermodynamics and modern physics.", progress: 0 },
  Mathematics: { code: "MATH", icon: "∑", description: "Algebra, calculus, probability, statistics and related mathematics.", progress: 0 }
};

// Topics created in the question bank that belong to the Biotechnology side of BIO.
const BIOTECH_TOPIC_NAMES = new Set([
  "Biotechnology", "Animal Biotechnology", "Plant Biotechnology", "Bioprocess Engineering",
  "Stem Cell Biotechnology", "Protein Engineering", "Immunotechnology", "Bioinformatics",
  "Genetic Engineering"
]);

let db = null;
let dbSubjectRows = [];
let dbTopicsByDisplaySubject = {};
let currentQuestionIndex = 0;
let currentQuestions = [];
let currentQuestionSession = { subject: null, topic: null };
let currentAnswered = false;
let selectedMSQ = new Set();
let mockQuestions = [];
let mockIndex = 0;
let mockAnswers = {};
let mockTime = 0;
let mockInterval = null;
let allPracticePoolCache = null;

function configReady() {
  return typeof SUPABASE_URL !== "undefined" && typeof SUPABASE_ANON_KEY !== "undefined" &&
    SUPABASE_URL && SUPABASE_ANON_KEY && !String(SUPABASE_URL).includes("PASTE_YOUR") &&
    !String(SUPABASE_ANON_KEY).includes("PASTE_YOUR");
}

function getData() {
  return JSON.parse(localStorage.getItem("jamBTData") || JSON.stringify({
    solved: 0, correct: 0, mistakes: [], mocks: [], streak: 0, topicStats: {}
  }));
}
function saveData(data) { localStorage.setItem("jamBTData", JSON.stringify(data)); }

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

async function initDatabase() {
  if (!configReady()) {
    showToast("Add your Supabase URL and publishable/anon key first.");
    return false;
  }
  try {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await db.from("subjects").select("id,code,name").order("id");
    if (error) throw error;
    dbSubjectRows = data || [];
    await buildTopicCatalog();
    return true;
  } catch (error) {
    console.error("Supabase initialization failed:", error);
    showToast(`Supabase connection failed: ${error.message || error}`);
    return false;
  }
}

async function buildTopicCatalog() {
  dbTopicsByDisplaySubject = { Biology: [], Biotechnology: [], Chemistry: [], Physics: [], Mathematics: [] };
  const byCode = {};
  dbSubjectRows.forEach(row => { byCode[row.code] = row; });

  for (const displayName of Object.keys(SUBJECT_CATALOG)) {
    const subject = byCode[SUBJECT_CATALOG[displayName].code];
    if (!subject) continue;
    const { data, error } = await db.from("topics").select("id,name,subject_id").eq("subject_id", subject.id).order("name");
    if (error) throw error;
    let topics = data || [];

    if (displayName === "Biotechnology") {
      topics = topics.filter(t => BIOTECH_TOPIC_NAMES.has(t.name));
    } else if (displayName === "Biology") {
      topics = topics.filter(t => !BIOTECH_TOPIC_NAMES.has(t.name));
    }
    dbTopicsByDisplaySubject[displayName] = topics;
  }
}

function goTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(page);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav").forEach(n => n.classList.remove("active"));
  const nav = document.querySelector(`.nav[data-page="${page}"]`);
  if (nav) nav.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "mistakes") renderMistakes();
  if (page === "analytics") renderAnalytics();
  if (page === "pyq" && typeof initPYQMocks === "function") setTimeout(initPYQMocks, 0);
}

function renderDashboard() {
  const container = document.getElementById("dashboardSubjects");
  if (!container) return;
  container.innerHTML = "";
  Object.entries(SUBJECT_CATALOG).forEach(([name, info]) => {
    const topicCount = (dbTopicsByDisplaySubject[name] || []).length;
    const div = document.createElement("div");
    div.className = "subject-row";
    div.onclick = () => openSubject(name);
    div.innerHTML = `<div class="subject-row-top"><div><span>${info.icon}</span><strong>${name}</strong></div><small>${topicCount} topics</small></div><div class="progress"><div class="progress-bar" style="width:0%"></div></div>`;
    container.appendChild(div);
  });
  updateStats();
}

function renderSubjects() {
  const grid = document.getElementById("subjectGrid");
  if (!grid) return;
  grid.innerHTML = "";
  Object.entries(SUBJECT_CATALOG).forEach(([name, info]) => {
    const topicCount = (dbTopicsByDisplaySubject[name] || []).length;
    const card = document.createElement("div");
    card.className = "large-subject-card";
    card.onclick = () => openSubject(name);
    card.innerHTML = `<div class="subject-icon-large">${info.icon}</div><h3>${name}</h3><p>${escapeHTML(info.description)}</p><div class="progress"><div class="progress-bar" style="width:0%"></div></div><div style="display:flex;justify-content:space-between;margin-top:7px;font-size:11px;color:#74798b"><span>Live from Supabase</span><span>${topicCount} topics →</span></div>`;
    grid.appendChild(card);
  });
}

function openSubject(subject) {
  goTo("practice");
  const select = document.getElementById("subjectSelect");
  if (select) select.value = subject;
  loadTopics();
}

function initializeSubjectSelect() {
  const select = document.getElementById("subjectSelect");
  if (!select) return;
  select.innerHTML = "";
  Object.keys(SUBJECT_CATALOG).forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    select.appendChild(option);
  });
  loadTopics();
}

function loadTopics() {
  const subject = document.getElementById("subjectSelect")?.value;
  const container = document.getElementById("topicButtons");
  if (!container || !subject) return;
  container.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.className = "topic-button";
  allButton.textContent = "📚 All questions";
  allButton.onclick = () => startTopic(subject, null);
  container.appendChild(allButton);

  (dbTopicsByDisplaySubject[subject] || []).forEach(topic => {
    const button = document.createElement("button");
    button.className = "topic-button";
    button.textContent = topic.name;
    button.onclick = () => startTopic(subject, topic);
    container.appendChild(button);
  });

  if (!(dbTopicsByDisplaySubject[subject] || []).length) {
    container.innerHTML += `<p class="muted" style="margin-top:10px">No topics were returned from Supabase. Check SELECT access on the topics table.</p>`;
  }
}

async function fetchQuestions({ subjectName, topicId = null, limitAll = false } = {}) {
  if (!db) {
    showToast("Supabase is not connected.");
    return [];
  }
  const subjectCode = SUBJECT_CATALOG[subjectName]?.code;
  const subject = dbSubjectRows.find(s => s.code === subjectCode);
  if (!subject) return [];

  const pageSize = 1000;
  let from = 0;
  const collected = [];
  while (true) {
    let query = db.from("questions")
      .select("id,subject_id,topic_id,subtopic_id,question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,source,is_pyq")
      .eq("subject_id", subject.id)
      .eq("is_pyq", false)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (topicId) query = query.eq("topic_id", topicId);
    if (!limitAll && topicId) query = query.limit(pageSize);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    collected.push(...rows);
    if (rows.length < pageSize || !limitAll) break;
    from += pageSize;
  }
  return collected.map(normalizeQuestion);
}

function normalizeQuestion(row) {
  const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(v => v !== null && v !== undefined && String(v) !== "");
  return {
    id: row.id,
    subject: displaySubjectFromCode(row.subject_id),
    subject_id: row.subject_id,
    topic_id: row.topic_id,
    subtopic_id: row.subtopic_id,
    topic: topicNameFromId(row.topic_id),
    type: String(row.question_type || "MCQ").toUpperCase(),
    difficulty: row.difficulty || "JAM LEVEL",
    question: row.question_text || "",
    options,
    optionLetters: options.map((_, i) => String.fromCharCode(65 + i)),
    answer: normalizeAnswer(row.correct_answer),
    explanation: row.explanation || "",
    source: row.source || "JAM Practice",
    is_pyq: !!row.is_pyq
  };
}

function displaySubjectFromCode(subjectId) {
  const row = dbSubjectRows.find(s => s.id === subjectId);
  if (!row) return "Biology";
  if (row.code === "PHYS") return "Physics";
  if (row.code === "CHEM") return "Chemistry";
  if (row.code === "MATH") return "Mathematics";
  return currentQuestionSession.subject || "Biology";
}

function topicNameFromId(topicId) {
  for (const topics of Object.values(dbTopicsByDisplaySubject)) {
    const match = topics.find(t => t.id === topicId);
    if (match) return match.name;
  }
  return "";
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim().toUpperCase()).filter(Boolean).sort().join("");
  return String(value ?? "").trim().replace(/[\s,;]+/g, "").toUpperCase();
}

async function startTopic(subject, topic) {
  const title = topic?.name || "All Questions";
  currentQuestionSession = { subject, topic: topic?.name || null };
  document.getElementById("practiceTitle").textContent = title;
  document.getElementById("practiceSubtitle").textContent = topic ? `${subject} · ${topic.name}` : `${subject} · Complete practice bank`;
  document.getElementById("questionText").textContent = "Loading questions from Supabase…";
  document.getElementById("options").innerHTML = "";
  hidePracticeInput();

  try {
    currentQuestions = await fetchQuestions({ subjectName: subject, topicId: topic?.id || null, limitAll: !topic });
    if (!currentQuestions.length) {
      showToast("No practice questions were returned for this selection.");
      document.getElementById("questionText").textContent = "No questions found for this selection.";
      return;
    }
    currentQuestionIndex = 0;
    renderQuestion();
    showToast(`${currentQuestions.length} questions loaded from your question bank.`);
  } catch (error) {
    console.error(error);
    document.getElementById("questionText").textContent = "Could not load the question bank.";
    showToast(`Question bank error: ${error.message || error}`);
  }
}

function hidePracticeInput() {
  const old = document.getElementById("practiceAnswerInput");
  if (old) old.remove();
  const submit = document.getElementById("practiceSubmitBtn");
  if (submit) submit.style.display = "none";
}

function ensurePracticeInput() {
  let input = document.getElementById("practiceAnswerInput");
  if (!input) {
    input = document.createElement("input");
    input.id = "practiceAnswerInput";
    input.className = "text-input";
    input.placeholder = "Enter your numerical answer";
    input.style.marginTop = "12px";
    document.getElementById("options").appendChild(input);
  }
  let submit = document.getElementById("practiceSubmitBtn");
  if (!submit) {
    submit = document.createElement("button");
    submit.id = "practiceSubmitBtn";
    submit.className = "primary-btn";
    submit.textContent = "Submit Answer";
    submit.style.marginTop = "12px";
    submit.onclick = () => submitPracticeAnswer(input.value);
    document.getElementById("options").appendChild(submit);
  }
  submit.style.display = "inline-flex";
  return input;
}

function renderQuestion() {
  const q = currentQuestions[currentQuestionIndex];
  if (!q) return;
  currentAnswered = false;
  selectedMSQ = new Set();
  document.getElementById("questionSubject").textContent = q.subject.toUpperCase();
  document.getElementById("questionType").textContent = q.type;
  document.getElementById("questionDifficulty").textContent = q.difficulty;
  document.getElementById("questionCount").textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
  document.getElementById("questionText").textContent = q.question;
  document.getElementById("options").innerHTML = "";
  document.getElementById("answerMessage").textContent = "";
  document.getElementById("explanation").style.display = "none";
  hidePracticeInput();

  if (q.type === "NAT") {
    ensurePracticeInput();
    return;
  }

  q.options.forEach((option, index) => {
    const div = document.createElement("div");
    div.className = "option";
    div.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
    div.onclick = () => {
      if (currentAnswered) return;
      if (q.type === "MSQ") {
        const letter = String.fromCharCode(65 + index);
        if (selectedMSQ.has(letter)) selectedMSQ.delete(letter); else selectedMSQ.add(letter);
        div.classList.toggle("selected");
        const submit = document.getElementById("practiceSubmitBtn") || createPracticeSubmitButton();
        submit.style.display = "inline-flex";
      } else {
        answerPractice([String.fromCharCode(65 + index)]);
      }
    };
    document.getElementById("options").appendChild(div);
  });

  if (q.type === "MSQ") createPracticeSubmitButton();
}

function createPracticeSubmitButton() {
  let submit = document.getElementById("practiceSubmitBtn");
  if (!submit) {
    submit = document.createElement("button");
    submit.id = "practiceSubmitBtn";
    submit.className = "primary-btn";
    submit.textContent = "Submit Answer";
    submit.style.marginTop = "12px";
    submit.onclick = () => answerPractice([...selectedMSQ]);
    document.getElementById("options").appendChild(submit);
  }
  submit.style.display = "inline-flex";
  return submit;
}

function submitPracticeAnswer(value) { answerPractice([String(value).trim()]); }

function answerPractice(selected) {
  if (currentAnswered) return;
  const q = currentQuestions[currentQuestionIndex];
  if (!q) return;
  const userAnswer = q.type === "MSQ" ? normalizeAnswer(selected) : normalizeAnswer(selected[0]);
  if (!userAnswer) { showToast("Enter/select an answer first."); return; }
  currentAnswered = true;

  const correct = userAnswer === q.answer;
  const data = getData();
  data.solved++;
  if (correct) data.correct++;
  if (!data.topicStats[q.topic]) data.topicStats[q.topic] = { attempted: 0, correct: 0 };
  data.topicStats[q.topic].attempted++;
  if (correct) data.topicStats[q.topic].correct++;

  const optionElements = document.querySelectorAll("#options .option");
  optionElements.forEach(el => el.style.pointerEvents = "none");
  if (q.type !== "NAT") {
    optionElements.forEach((el, index) => {
      const letter = String.fromCharCode(65 + index);
      if (q.answer.includes(letter)) el.classList.add("correct");
      if (normalizeAnswer(selected).includes(letter) && !q.answer.includes(letter)) el.classList.add("wrong");
    });
  }

  const message = document.getElementById("answerMessage");
  message.textContent = correct ? "Correct! ✓" : "Incorrect ✕";
  message.style.color = correct ? "var(--green)" : "var(--red)";
  document.getElementById("explanationText").textContent = q.explanation || "No explanation was stored for this question.";
  document.getElementById("explanation").style.display = "block";
  if (!correct) addMistake({ ...q, userAnswer });
  saveData(data);
  updateStats();
}

function nextQuestion() {
  if (!currentQuestions.length) { showToast("Select a topic first."); return; }
  currentQuestionIndex++;
  if (currentQuestionIndex >= currentQuestions.length) {
    showToast("You reached the end of this question set. Starting again from Question 1.");
    currentQuestionIndex = 0;
  }
  renderQuestion();
}

function addMistake(q) {
  const data = getData();
  const existing = data.mistakes.find(m => m.id === q.id);
  if (existing) {
    existing.wrongCount = (existing.wrongCount || 1) + 1;
    existing.lastWrong = new Date().toISOString();
  } else {
    data.mistakes.push({ ...q, wrongCount: 1, lastWrong: new Date().toISOString() });
  }
  saveData(data);
}

function addCurrentToMistakes() {
  const q = currentQuestions[currentQuestionIndex];
  if (!q) return;
  addMistake(q);
  renderMistakes();
  showToast("Added to your Mistake Bank.");
}

function renderMistakes() {
  const data = getData();
  document.getElementById("mistakeCount").textContent = data.mistakes.length;
  document.getElementById("revisionCount").textContent = data.mistakes.filter(m => (m.wrongCount || 1) >= 2).length;
  const container = document.getElementById("mistakeList");
  if (!data.mistakes.length) {
    container.innerHTML = `<div class="empty-state"><div>🎉</div><h3>No mistakes yet</h3><p>Your mistakes will automatically appear here when you get questions wrong.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="panel-heading"><div><h3>Questions to revise</h3><p>Your incorrect questions are saved here.</p></div></div>`;
  data.mistakes.forEach(q => {
    const item = document.createElement("div");
    item.className = "mistake-item";
    item.innerHTML = `<strong>${escapeHTML(q.question)}</strong><small>${escapeHTML(q.subject)} · ${escapeHTML(q.topic)} · Wrong ${q.wrongCount || 1} time(s)</small>`;
    container.appendChild(item);
  });
}

function practiceMistakes() {
  const data = getData();
  if (!data.mistakes.length) { showToast("Your Mistake Bank is empty."); return; }
  currentQuestions = [...data.mistakes];
  currentQuestionIndex = 0;
  goTo("practice");
  renderQuestion();
}

// The old PYQ practice button now opens the real timed PYQ page.
function startPYQ() { goTo("pyq"); }

async function getPracticePool() {
  if (allPracticePoolCache?.length) return allPracticePoolCache;
  if (!db) return [];
  try {
    const all = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await db.from("questions")
        .select("id,subject_id,topic_id,subtopic_id,question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,source,is_pyq")
        .eq("is_pyq", false)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      all.push(...rows.map(normalizeQuestion));
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    allPracticePoolCache = all;
    return all;
  } catch (error) {
    console.error(error);
    showToast(`Could not load mock question bank: ${error.message || error}`);
    return [];
  }
}

async function startMock() { goTo("mock"); await prepareMock(10); }

async function prepareMock(number) {
  const pool = await getPracticePool();
  if (!pool.length) { showToast("No practice questions are available from Supabase."); return; }
  mockQuestions = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(number, pool.length));
  mockIndex = 0; mockAnswers = {};
  mockTime = number === 60 ? 3600 : number === 20 ? 1800 : 900;
  document.getElementById("mockSetup").classList.add("hidden");
  document.getElementById("mockResult").classList.add("hidden");
  document.getElementById("mockTest").classList.remove("hidden");
  renderMockQuestion(); startTimer();
}

function renderMockQuestion() {
  const q = mockQuestions[mockIndex]; if (!q) return;
  document.getElementById("mockQuestionNumber").textContent = `Question ${mockIndex + 1} / ${mockQuestions.length}`;
  document.getElementById("mockSubject").textContent = q.subject.toUpperCase();
  document.getElementById("mockQuestion").textContent = q.question;
  const container = document.getElementById("mockOptions"); container.innerHTML = "";
  q.options.forEach((option, index) => {
    const div = document.createElement("div"); div.className = "option";
    if (mockAnswers[mockIndex] === index) div.classList.add("selected");
    div.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
    div.onclick = () => { mockAnswers[mockIndex] = index; renderMockQuestion(); };
    container.appendChild(div);
  });
}
function nextMockQuestion() { if (mockIndex < mockQuestions.length - 1) { mockIndex++; renderMockQuestion(); } else finishMock(); }
function previousMockQuestion() { if (mockIndex > 0) { mockIndex--; renderMockQuestion(); } }
function startTimer() { clearInterval(mockInterval); updateTimer(); mockInterval = setInterval(() => { mockTime--; updateTimer(); if (mockTime <= 0) { clearInterval(mockInterval); finishMock(); } }, 1000); }
function updateTimer() { const minutes = Math.floor(mockTime / 60), seconds = mockTime % 60; document.getElementById("mockTimer").textContent = `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`; }
function finishMock() {
  clearInterval(mockInterval); let correct = 0, wrong = 0;
  mockQuestions.forEach((q, index) => { if (mockAnswers[index] === undefined) return; if (String.fromCharCode(65 + mockAnswers[index]) === q.answer) correct++; else wrong++; });
  const raw = correct - (wrong * .25), score = Math.max(0, Math.round((raw / mockQuestions.length) * 100)), accuracy = correct + wrong === 0 ? 0 : Math.round(correct / (correct + wrong) * 100);
  const data = getData(); data.mocks.push({ date: new Date().toISOString(), score, correct, wrong, accuracy }); saveData(data);
  document.getElementById("mockTest").classList.add("hidden"); document.getElementById("mockResult").classList.remove("hidden");
  document.getElementById("resultScore").textContent = score; document.getElementById("resultCorrect").textContent = correct; document.getElementById("resultWrong").textContent = wrong; document.getElementById("resultAccuracy").textContent = accuracy + "%";
  document.getElementById("resultMessage").textContent = score >= 70 ? "Excellent progress. Keep pushing." : score >= 50 ? "Good foundation. Now target the weak topics." : "Use this result to identify and fix your weak areas.";
  updateStats();
}
function showMockSetup() { document.getElementById("mockResult").classList.add("hidden"); document.getElementById("mockSetup").classList.remove("hidden"); }

function renderAnalytics() {
  const data = getData();
  document.getElementById("analyticsQuestions").textContent = data.solved;
  const accuracy = data.solved ? Math.round(data.correct / data.solved * 100) : 0;
  document.getElementById("analyticsAccuracy").textContent = accuracy + "%";
  document.getElementById("analyticsMocks").textContent = data.mocks.length;
  const best = data.mocks.length ? Math.max(...data.mocks.map(m => m.score)) : null;
  document.getElementById("analyticsBest").textContent = best === null ? "—" : best + "/100";
  renderSubjectAnalytics(); renderScoreHistory();
}
function renderSubjectAnalytics() {
  const data = getData(), container = document.getElementById("subjectAnalytics"); container.innerHTML = "";
  Object.keys(SUBJECT_CATALOG).forEach(subject => {
    let attempted = 0, correct = 0;
    Object.entries(data.topicStats).forEach(([topic, stats]) => {
      if ((dbTopicsByDisplaySubject[subject] || []).some(t => t.name === topic)) { attempted += stats.attempted; correct += stats.correct; }
    });
    const percentage = attempted ? Math.round(correct / attempted * 100) : 0;
    const row = document.createElement("div"); row.className = "analytics-row";
    row.innerHTML = `<div class="analytics-row-top"><span>${subject}</span><strong>${percentage}%</strong></div><div class="progress"><div class="progress-bar" style="width:${percentage}%"></div></div>`;
    container.appendChild(row);
  });
}
function renderScoreHistory() {
  const data = getData(), container = document.getElementById("scoreHistory"); container.innerHTML = "";
  if (!data.mocks.length) { container.innerHTML = `<p class="muted">Your mock scores will appear here.</p>`; return; }
  data.mocks.slice(-8).forEach(mock => { const bar = document.createElement("div"); bar.className = "score-bar"; bar.style.height = Math.max(15, mock.score) + "%"; bar.innerHTML = `<span>${mock.score}</span>`; container.appendChild(bar); });
}
function updateStats() {
  const data = getData();
  document.getElementById("questionsSolved").textContent = data.solved;
  document.getElementById("accuracy").textContent = (data.solved ? Math.round(data.correct / data.solved * 100) : 0) + "%";
  document.getElementById("streak").textContent = `${data.streak} days`;
  if (data.mocks.length) {
    const latest = data.mocks[data.mocks.length - 1], best = Math.max(...data.mocks.map(m => m.score));
    document.getElementById("latestMock").textContent = latest.score + "/100";
    document.getElementById("bestMock").textContent = best + "/100";
  }
  document.getElementById("overallProgress").textContent = data.solved ? "Live" : "0%";
}

async function bootJAMApp() {
  document.querySelectorAll(".nav").forEach(button => button.addEventListener("click", () => goTo(button.dataset.page)));
  initializeSubjectSelect();
  const ok = await initDatabase();
  if (ok) {
    initializeSubjectSelect();
    renderDashboard();
    renderSubjects();
    showToast("Your Supabase question bank is connected.");
  } else {
    renderDashboard(); renderSubjects(); updateStats();
  }
}

document.addEventListener("DOMContentLoaded", bootJAMApp);
