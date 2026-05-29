const state = {
  exam: null,
  session: null,
  current: 0,
  answers: {},
  timings: {},
  student: {},
  timerId: null,
  questionStartedAt: Date.now(),
  warnings: 0,
  submitting: false,
  teacherExam: null
};

const $ = (id) => document.getElementById(id);
const modes = document.querySelectorAll('.mode-button');

function api(path, options = {}) {
  return fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? 'Request failed');
    return payload;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function safeRichHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function recordQuestionTime() {
  if (!state.exam) return;
  const question = state.exam.questions[state.current];
  if (!question) return;
  const elapsed = Math.max(0, Math.round((Date.now() - state.questionStartedAt) / 1000));
  state.timings[question.id] = (state.timings[question.id] ?? 0) + elapsed;
  state.questionStartedAt = Date.now();
}

function switchMode(mode) {
  modes.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  $('studentView').classList.toggle('active', mode === 'student');
  $('teacherView').classList.toggle('active', mode === 'teacher');
}

function answeredCount() {
  return state.exam.questions.filter((question) => String(state.answers[question.id] ?? '').trim()).length;
}

function updateProgress() {
  const count = answeredCount();
  const total = state.exam.questions.length;
  $('progressText').textContent = `${count} of ${total} answered`;
  $('progressBar').style.width = `${Math.round((count / total) * 100)}%`;
  document.querySelectorAll('.question-dots button').forEach((button, index) => {
    const question = state.exam.questions[index];
    button.classList.toggle('answered', Boolean(String(state.answers[question.id] ?? '').trim()));
    button.classList.toggle('current', index === state.current);
  });
}

function renderQuestionDots() {
  $('questionDots').innerHTML = state.exam.questions.map((question, index) => (
    `<button type="button" data-index="${index}" aria-label="Question ${index + 1}">${index + 1}</button>`
  )).join('');
  $('questionDots').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    recordQuestionTime();
    state.current = Number(button.dataset.index);
    renderQuestion();
  });
}

function renderQuestion() {
  state.questionStartedAt = Date.now();
  const question = state.exam.questions[state.current];
  const answer = state.answers[question.id] ?? '';
  const isLast = state.current === state.exam.questions.length - 1;
  const normalizedChoices = normalizeChoices(question);
  const choices = normalizedChoices ? normalizedChoices.map(({ key, label }) => `
    <button class="choice-option ${answer === key ? 'selected' : ''}" type="button" data-answer="${key}">
      <span class="choice-key">${escapeHtml(key)}</span>
      <span>${safeRichHtml(label)}</span>
    </button>
  `).join('') : question.type === 'true-false' ? `
    <div class="choice-list">
      <button class="choice-option ${answer === 'true' ? 'selected' : ''}" type="button" data-answer="true">
        <span class="choice-key">T</span><span>True</span>
      </button>
      <button class="choice-option ${answer === 'false' ? 'selected' : ''}" type="button" data-answer="false">
        <span class="choice-key">F</span><span>False</span>
      </button>
    </div>
  ` : `
    <label class="text-answer">
      Answer
      <input id="textAnswer" value="${escapeHtml(answer)}" autocomplete="off">
    </label>
  `;
  const attachments = renderAttachments(question.attachments ?? []);

  $('questionCard').innerHTML = `
    <div class="question-meta">
      <span>${escapeHtml(question.section)}</span>
      <span>Question ${state.current + 1} of ${state.exam.questions.length}</span>
    </div>
    <div class="prompt">${question.promptHtml ? safeRichHtml(question.promptHtml) : escapeHtml(question.prompt)}</div>
    ${attachments}
    <div class="${normalizedChoices || question.type === 'true-false' ? 'choice-list' : ''}">${choices}</div>
    <div class="question-actions">
      <button class="ghost" id="prevQuestion" type="button" ${state.current === 0 ? 'disabled' : ''}>Previous</button>
      <button class="primary" id="nextQuestion" type="button">${isLast ? 'Submit Exam' : 'Next'}</button>
    </div>
  `;

  $('questionCard').querySelectorAll('.choice-option').forEach((button) => {
    button.addEventListener('click', () => {
      recordQuestionTime();
      state.answers[question.id] = button.dataset.answer;
      renderQuestion();
    });
  });

  const textAnswer = $('textAnswer');
  if (textAnswer) {
    textAnswer.addEventListener('input', () => {
      state.answers[question.id] = textAnswer.value;
      updateProgress();
    });
    textAnswer.focus();
  }

  $('prevQuestion').addEventListener('click', () => {
    if (state.current > 0) {
      recordQuestionTime();
      state.current -= 1;
      renderQuestion();
    }
  });
  $('nextQuestion').addEventListener('click', () => {
    if (isLast) submitExam();
    else {
      recordQuestionTime();
      state.current += 1;
      renderQuestion();
    }
  });

  updateProgress();
}

function normalizeChoices(question) {
  if (!question.choices) return null;
  if (Array.isArray(question.choices)) {
    return question.choices.map((choice, index) => ({
      key: choice.id ?? String.fromCharCode(97 + index),
      label: choice.labelHtml ?? choice.label ?? choice.text ?? ''
    }));
  }
  return Object.entries(question.choices).map(([key, label]) => ({ key, label }));
}

function renderAttachments(attachments) {
  if (!attachments.length) return '';
  return `<div class="attachments" aria-label="Question attachments">${attachments.map((attachment) => {
    if (attachment.type === 'image') {
      return `<figure><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.alt ?? 'Question attachment')}"></figure>`;
    }
    if (attachment.type === 'audio') {
      return `<audio controls src="${escapeHtml(attachment.url)}"></audio>`;
    }
    if (attachment.type === 'video') {
      return `<video controls src="${escapeHtml(attachment.url)}"></video>`;
    }
    return '';
  }).join('')}</div>`;
}

function startTimer() {
  clearInterval(state.timerId);
  const expiresAt = new Date(state.session.expiresAt).getTime();
  state.timerId = setInterval(() => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    $('timer').textContent = `${minutes}:${seconds}`;
    if (remaining <= 0) {
      state.forceSubmit = true;
      submitExam();
    }
  }, 250);
}

async function loadExam() {
  state.exam = await api('/api/exam');
  $('examTitle').textContent = 'Scholarship Entrance Exam';
}

async function beginExam(event) {
  event.preventDefault();
  state.current = 0;
  state.answers = {};
  state.timings = {};
  state.forceSubmit = false;
  state.submitting = false;
  state.warnings = 0;
  state.student = {
    studentName: $('studentName').value.trim(),
    studentEmail: $('studentEmail').value.trim(),
    section: $('studentSection').value.trim()
  };
  state.session = await api('/api/session', { method: 'POST', body: '{}' });
  $('startPanel').classList.add('hidden');
  $('examPanel').classList.remove('hidden');
  renderQuestionDots();
  renderQuestion();
  startTimer();
}

async function submitExam() {
  if (!state.session || state.submitting) return;
  const unanswered = state.exam.questions.length - answeredCount();
  if (unanswered > 0 && !state.forceSubmit) {
    const shouldSubmit = confirm(`You still have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`);
    if (!shouldSubmit) return;
  }
  recordQuestionTime();
  const session = state.session;
  state.submitting = true;
  document.querySelectorAll('#questionCard button, #sidebarSubmit').forEach((button) => {
    button.disabled = true;
  });

  try {
    const result = await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({
        ...state.student,
        sessionToken: session.token,
        answers: state.answers,
        timings: state.timings
      })
    });
    clearInterval(state.timerId);
    state.session = null;
    $('examPanel').classList.add('hidden');
    $('resultPanel').classList.remove('hidden');
    $('resultPanel').style.setProperty('--score', `${result.percentage}%`);
    $('resultPanel').innerHTML = `
      <p class="eyebrow">Submitted</p>
      <h2>${result.score}/${result.maxScore}</h2>
      <div class="score-ring"><span>${result.percentage}%</span></div>
      <p class="muted">Your teacher can review the item-by-item result in the dashboard.</p>
    `;
  } catch (error) {
    state.submitting = false;
    document.querySelectorAll('#questionCard button, #sidebarSubmit').forEach((button) => {
      button.disabled = false;
    });
    alert(error.message);
  }
}

function showIntegrityWarning() {
  if (!$('examPanel').classList.contains('hidden')) {
    state.warnings += 1;
    $('integrityNotice').classList.remove('hidden');
    $('integrityNotice').textContent = `Focus warning ${state.warnings}: keep the exam window active.`;
  }
}

function answerDisplay(item, value) {
  if (item.choices && item.choices[value]) return `${String(value).toUpperCase()}. ${item.choices[value]}`;
  if (item.choices && Array.isArray(item.choices)) {
    const choice = item.choices.find((candidate) => String(candidate.id) === String(value));
    if (choice) return `${String(value).toUpperCase()}. ${choice.labelHtml ?? choice.label ?? choice.text}`;
  }
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return value || 'No answer';
}

async function loadDashboard({ refreshQuestions = true } = {}) {
  const search = encodeURIComponent($('studentSearch').value.trim());
  const sort = encodeURIComponent($('studentSort').value);
  const dashboard = await api(`/api/teacher/dashboard?search=${search}&sort=${sort}`);
  const { overview, scholarship, tests, students, recentActivity, gradeLevels } = dashboard;

  $('dashboardSummary').innerHTML = [
    ['Students', overview.totalStudents, 'blue'],
    ['Average', `${overview.averageScore}%`, 'teal'],
    ['Completion', `${overview.completionRate}%`, 'green'],
    ['Accepted', `${scholarship.acceptedStudents}/${scholarship.availableSlots}`, 'coral']
  ].map(([label, value, tone]) => `<div class="metric metric-${tone}"><span class="label">${label}</span><strong>${value}</strong></div>`).join('');

  $('scholarshipSummary').innerHTML = `
    <div>
      <p class="eyebrow">Scholarship Program</p>
      <h2>Top ${scholarship.availableSlots} passing applicants accepted</h2>
      <p class="muted">Eligible grade levels: ${scholarship.gradeLevels.join(', ')} · Passing score: ${scholarship.passingScore}% · Qualified: ${scholarship.qualifiedStudents}</p>
    </div>
    <div class="slot-meter" aria-label="${scholarship.acceptedStudents} scholarship slots filled out of ${scholarship.availableSlots}">
      ${Array.from({ length: scholarship.availableSlots }, (_, index) => (
        `<span class="${index < scholarship.acceptedStudents ? 'filled' : ''}">${index + 1}</span>`
      )).join('')}
    </div>
  `;

  $('gradeLevelGrid').innerHTML = (gradeLevels ?? []).map((grade) => `
    <article class="grade-card">
      <div class="grade-card-head">
        <div>
          <span class="label">Grade Level</span>
          <h3>${escapeHtml(grade.name)}</h3>
        </div>
        <strong>${grade.averageScore}%</strong>
      </div>
      <div class="score-bar" style="--score-width:${grade.averageScore}%;--bar-color:${grade.level.color}"><span></span></div>
      <dl>
        <div><dt>Applicants</dt><dd>${grade.totalStudents}</dd></div>
        <div><dt>Qualified</dt><dd>${grade.qualifiedStudents}</dd></div>
        <div><dt>Accepted</dt><dd>${grade.acceptedStudents}</dd></div>
      </dl>
    </article>
  `).join('');

  $('testStatusGrid').innerHTML = tests.map((test) => `
    <article class="test-card">
      <div>
        <span class="status-pill neutral">${escapeHtml(test.status)}</span>
        <h3>${escapeHtml(test.title)}</h3>
      </div>
      <p class="muted">${test.questionCount} questions · ${test.totalPoints} points · ${test.completedStudents} completed</p>
      <div class="score-bar" style="--score-width:${test.averageScore}%;--bar-color:var(--teal)"><span></span></div>
    </article>
  `).join('');

  $('activityFeed').innerHTML = `
    <h3>Recent Activity</h3>
    ${recentActivity.length ? recentActivity.map((activity) => `
      <div class="activity-item">
        <span>${escapeHtml(activity.message)}</span>
        <strong>${activity.percentage}%</strong>
      </div>
    `).join('') : '<p class="muted">No activity yet.</p>'}
  `;

  $('submissionList').innerHTML = students.length ? students.map((submission) => {
    const color = submission.scholarshipStatus === 'accepted' ? 'var(--green)' : submission.level.color;
    const rows = submission.answers.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.promptHtml ? safeRichHtml(item.promptHtml) : escapeHtml(item.prompt)}</td>
        <td>${safeRichHtml(answerDisplay(item, item.studentAnswer))}</td>
        <td>${safeRichHtml(answerDisplay(item, item.correctAnswer))}</td>
        <td>${item.earnedPoints}/${item.maxPoints}</td>
        <td>${item.timeTakenSeconds}s</td>
        <td><span class="status-pill ${item.isCorrect ? 'correct' : 'wrong'}">${item.isCorrect ? 'Correct' : 'Review'}</span></td>
      </tr>
    `).join('');
    return `
      <article class="submission-card">
        <div class="submission-head">
          <div>
            <h3>${escapeHtml(submission.studentName)}</h3>
            <p class="muted">${escapeHtml(submission.studentEmail || 'No email')} · ${escapeHtml(submission.section || 'No section')} · ${new Date(submission.submittedAt).toLocaleString()}</p>
          </div>
          <div>
            <strong>${submission.score}/${submission.maxScore} (${submission.percentage}%)</strong>
            <div class="score-bar" style="--score-width:${submission.percentage}%;--bar-color:${color}"><span></span></div>
            <small>${scholarshipBadgeText(submission)} · ${submission.timeTakenSeconds}s</small>
          </div>
        </div>
        <table class="answer-table">
          <thead><tr><th>#</th><th>Question</th><th>Student</th><th>Correct</th><th>Score</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </article>
    `;
  }).join('') : '<section class="panel result-panel"><h2>No submissions yet</h2></section>';

  if (refreshQuestions) await loadQuestionEditor();
}

async function loadQuestionEditor() {
  const exam = await api('/api/teacher/exam');
  state.teacherExam = exam;
  $('questionEditorList').innerHTML = exam.questions.map((question, index) => {
    const choices = normalizeChoices(question) ?? [];
    return `
      <article class="editable-question" data-question-index="${index}">
        <div class="editable-question-head">
          <strong>Question ${index + 1}</strong>
          <label>
            Points
            <input class="edit-points" type="number" min="1" step="1" value="${escapeHtml(question.points ?? 1)}">
          </label>
        </div>
        <label>
          Section
          <input class="edit-section" value="${escapeHtml(question.section ?? '')}">
        </label>
        <label>
          Question
          <textarea class="edit-prompt" rows="3">${escapeHtml(question.prompt ?? '')}</textarea>
        </label>
        <div class="choice-editor-grid">
          ${choices.map(({ key, label }) => `
            <label>
              Choice ${escapeHtml(key.toUpperCase())}
              <input class="edit-choice" data-choice-key="${escapeHtml(key)}" value="${escapeHtml(label)}">
            </label>
          `).join('')}
        </div>
        <label>
          Correct answer
          <select class="edit-correct">
            ${choices.map(({ key }) => `
              <option value="${escapeHtml(key)}" ${String(question.correctAnswer) === String(key) ? 'selected' : ''}>${escapeHtml(key.toUpperCase())}</option>
            `).join('')}
          </select>
        </label>
      </article>
    `;
  }).join('');
}

async function saveQuestionReview(event) {
  event.preventDefault();
  if (!state.teacherExam) {
    alert('Load the dashboard before saving question changes.');
    return;
  }
  const shouldSave = confirm('Save question changes? Existing submissions will be cleared so scores stay accurate.');
  if (!shouldSave) return;

  const questions = [...document.querySelectorAll('.editable-question')].map((card) => {
    const original = state.teacherExam.questions[Number(card.dataset.questionIndex)] ?? {};
    const choices = Object.fromEntries([...card.querySelectorAll('.edit-choice')].map((input) => [
      input.dataset.choiceKey,
      input.value.trim()
    ]));
    return {
      id: original.id,
      section: card.querySelector('.edit-section').value.trim(),
      prompt: card.querySelector('.edit-prompt').value.trim(),
      choices,
      correctAnswer: card.querySelector('.edit-correct').value,
      points: Number(card.querySelector('.edit-points').value || 1)
    };
  });

  const result = await api('/api/teacher/exam', {
    method: 'PUT',
    body: JSON.stringify({
      exam: {
        title: state.teacherExam.title,
        source: 'Teacher edited exam',
        questions
      }
    })
  });
  await loadExam();
  await loadDashboard();
  alert(`Saved ${result.questions} questions.`);
}

function scholarshipBadgeText(student) {
  if (student.scholarshipStatus === 'accepted') return `Accepted · Rank ${student.scholarshipRank}`;
  if (student.scholarshipStatus === 'waitlisted') return `Passed · Waitlisted rank ${student.scholarshipRank}`;
  return 'Below 75% passing score';
}

async function importDocx() {
  const file = $('docxUpload').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('docx', file);
  const response = await fetch('/api/teacher/import-docx', {
    method: 'POST',
    credentials: 'same-origin',
    body: form
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Import failed');
  await loadExam();
  await loadDashboard();
  alert(`Imported ${payload.imported} questions.`);
}

modes.forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.mode)));
$('startForm').addEventListener('submit', beginExam);
$('sidebarSubmit').addEventListener('click', () => submitExam().catch((error) => alert(error.message)));
$('loadDashboard').addEventListener('click', () => loadDashboard().catch((error) => alert(error.message)));
$('studentSearch').addEventListener('input', () => loadDashboard({ refreshQuestions: false }).catch(() => {}));
$('studentSort').addEventListener('change', () => loadDashboard({ refreshQuestions: false }).catch(() => {}));
$('docxUpload').addEventListener('change', () => importDocx().catch((error) => alert(error.message)));
$('questionReviewForm').addEventListener('submit', (event) => saveQuestionReview(event).catch((error) => alert(error.message)));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) showIntegrityWarning();
});
document.addEventListener('contextmenu', (event) => {
  if (!$('examPanel').classList.contains('hidden')) event.preventDefault();
});
document.addEventListener('copy', (event) => {
  if (!$('examPanel').classList.contains('hidden')) event.preventDefault();
});

loadExam().catch((error) => {
  $('startPanel').innerHTML = `<h2>Exam unavailable</h2><p class="muted">${escapeHtml(error.message)}</p>`;
});
