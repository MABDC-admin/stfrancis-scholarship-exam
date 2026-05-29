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
  teacherExam: null,
  selectedTeacherGrade: 'Grade 7',
  selectedExamineeId: '',
  teacherStableScrollY: 0,
  teacherScrollTimer: null,
  teacherPreservingScroll: false,
  testingToolsEnabled: false
};

const $ = (id) => document.getElementById(id);
const modes = document.querySelectorAll('.mode-button');

function normalizedRoutePath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function routeMode() {
  const path = normalizedRoutePath();
  if (path === '/teacher') return 'teacher';
  if (path === '/student') return 'student';
  return 'student';
}

function applyProductionRouteLock() {
  const path = normalizedRoutePath();
  document.body.classList.toggle('route-locked', path === '/student' || path === '/teacher');
}

function isTestingMode() {
  const params = new URLSearchParams(window.location.search);
  return state.testingToolsEnabled && (params.has('testing') || params.has('test'));
}

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
  if (mode === 'teacher') {
    ensureTeacherAccess()
      .then((authenticated) => {
        if (authenticated) return loadDashboard({ refreshQuestions: !state.teacherExam });
        return null;
      })
      .catch((error) => alert(error.message));
  }
}

function showTeacherLogin(message = '') {
  $('teacherLoginPanel').classList.remove('hidden');
  $('teacherShell').classList.add('hidden');
  $('teacherLoginMessage').textContent = message;
  $('teacherAccessCode').focus();
}

function showTeacherShell() {
  $('teacherLoginPanel').classList.add('hidden');
  $('teacherShell').classList.remove('hidden');
  $('teacherLoginMessage').textContent = '';
}

async function ensureTeacherAccess() {
  const session = await api('/api/teacher/session');
  if (session.authenticated) {
    showTeacherShell();
    return true;
  }
  showTeacherLogin();
  return false;
}

async function loginTeacher(event) {
  event.preventDefault();
  const accessCode = $('teacherAccessCode').value;
  try {
    await api('/api/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode })
    });
    $('teacherAccessCode').value = '';
    showTeacherShell();
    await loadDashboard({ refreshQuestions: !state.teacherExam });
  } catch (error) {
    showTeacherLogin(error.message);
  }
}

function answeredCount() {
  return state.exam.questions.filter((question) => String(state.answers[question.id] ?? '').trim()).length;
}

function unansweredQuestions() {
  return state.exam.questions.filter((question) => !String(state.answers[question.id] ?? '').trim());
}

function hideUnansweredModal() {
  $('unansweredModal').classList.add('hidden');
}

function showUnansweredModal(unanswered) {
  $('unansweredCount').textContent = String(unanswered);
  $('unansweredPlural').classList.toggle('hidden', unanswered === 1);
  $('unansweredModal').classList.remove('hidden');
  $('confirmSubmitAnyway').focus();
}

function reviewUnansweredQuestions() {
  const firstUnanswered = unansweredQuestions()[0];
  hideUnansweredModal();
  if (!firstUnanswered) return;
  const index = state.exam.questions.findIndex((question) => question.id === firstUnanswered.id);
  if (index >= 0) {
    recordQuestionTime();
    state.current = index;
    renderQuestion();
  }
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

function firstTestingAnswerFor(question) {
  const choices = normalizeChoices(question);
  if (choices?.length) return choices[0].key;
  if (question.type === 'true-false') return 'true';
  return 'Testing answer';
}

async function correctTestingAnswersById() {
  const teacherExam = await api('/api/teacher/exam');
  return new Map((teacherExam.questions ?? [])
    .filter((question) => String(question.correctAnswer ?? '').trim())
    .map((question) => [question.id, question.correctAnswer]));
}

function testingAnswerFor(question, answerKeyByQuestionId) {
  const correctAnswer = answerKeyByQuestionId.get(question.id);
  return String(correctAnswer ?? '').trim() ? correctAnswer : firstTestingAnswerFor(question);
}

async function fillTestAnswers() {
  if (!state.exam) return;
  const answerKeyByQuestionId = await correctTestingAnswersById();
  state.exam.questions.forEach((question) => {
    state.answers[question.id] = testingAnswerFor(question, answerKeyByQuestionId);
    state.timings[question.id] = Math.max(1, Number(state.timings[question.id] ?? 1));
  });
  updateProgress();
  renderQuestion();
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

async function loadExam(gradeLevel = '') {
  const path = gradeLevel ? `/api/exam?gradeLevel=${encodeURIComponent(gradeLevel)}` : '/api/exam';
  state.exam = await api(path);
  $('examTitle').textContent = 'Scholarship Entrance Exam';
}

async function loadClientConfig() {
  const config = await api('/api/config');
  state.testingToolsEnabled = Boolean(config.testingToolsEnabled);
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
  await loadExam(state.student.section);
  state.session = await api('/api/session', { method: 'POST', body: '{}' });
  $('startPanel').classList.add('hidden');
  $('examPanel').classList.remove('hidden');
  $('fillTestAnswers').classList.toggle('hidden', !isTestingMode());
  renderQuestionDots();
  renderQuestion();
  startTimer();
}

async function submitExam({ skipUnansweredCheck = false } = {}) {
  if (!state.session || state.submitting) return;
  const unanswered = state.exam.questions.length - answeredCount();
  if (unanswered > 0 && !state.forceSubmit && !skipUnansweredCheck) {
    showUnansweredModal(unanswered);
    return;
  }
  hideUnansweredModal();
  recordQuestionTime();
  const session = state.session;
  state.submitting = true;
  document.querySelectorAll('#questionCard button, #sidebarSubmit, #fillTestAnswers').forEach((button) => {
    button.disabled = true;
  });

  try {
    await api('/api/submissions', {
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
    $('resultPanel').innerHTML = `
      <p class="eyebrow">Submitted</p>
      <h2>Exam submitted</h2>
      <p class="muted">Your answers were received. Scholarship results will be reviewed by the school.</p>
    `;
  } catch (error) {
    state.submitting = false;
    document.querySelectorAll('#questionCard button, #sidebarSubmit, #fillTestAnswers').forEach((button) => {
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

function preserveTeacherScroll(left, top) {
  state.teacherPreservingScroll = true;
  [0, 60, 180, 420, 900, 1500].forEach((delay) => {
    setTimeout(() => {
      window.scrollTo(left, top);
      if (delay === 1500) state.teacherPreservingScroll = false;
    }, delay);
  });
}

function showTeacherModule(module) {
  const showQuestionReview = module === 'questionReview';
  $('gradeWorkspaceContent').classList.toggle('hidden', showQuestionReview);
  $('questionReview').classList.toggle('hidden', !showQuestionReview);
  document.querySelectorAll('.teacher-tool-nav [data-teacher-tool]').forEach((item) => {
    item.classList.toggle('active', item.dataset.teacherTool === module);
  });
  if (showQuestionReview) {
    loadQuestionEditor().catch((error) => alert(error.message));
  }
}

function focusTeacherGrade(gradeLevel) {
  const previousScrollY = state.teacherStableScrollY || window.scrollY;
  const previousScrollX = window.scrollX;
  showTeacherModule('workspace');
  state.selectedTeacherGrade = gradeLevel;
  state.selectedExamineeId = '';
  $('workspaceGradeSelect').value = gradeLevel;
  document.querySelectorAll('.grade-module-nav [data-grade]').forEach((item) => {
    item.classList.toggle('active', item.dataset.grade === gradeLevel);
  });
  loadDashboard({ refreshQuestions: false })
    .then(() => preserveTeacherScroll(previousScrollX, previousScrollY))
    .catch((error) => alert(error.message));
}

function populateExamineeSelect(students) {
  const select = $('examineeSelect');
  const current = state.selectedExamineeId;
  select.disabled = !students.length;
  select.innerHTML = `
    <option value="">${students.length ? 'Select examinee' : 'No examinees yet'}</option>
    ${students.map((student) => `
      <option value="${escapeHtml(student.id)}">
        ${escapeHtml(student.studentName)} #${escapeHtml(student.id)} (${student.percentage}%)
      </option>
    `).join('')}
  `;
  if (students.some((student) => String(student.id) === String(current))) {
    select.value = current;
  } else {
    state.selectedExamineeId = '';
    select.value = '';
  }
}

function progressLabel(student) {
  if (!student) return 'Not-started';
  if (student.status === 'completed') return 'Completed';
  if (student.status === 'in-progress') return 'In-progress';
  return 'Not-started';
}

function renderSelectedExaminee(students) {
  const student = students.find((item) => String(item.id) === String(state.selectedExamineeId));
  if (!student) {
    $('examineeDetail').innerHTML = `
      <div class="detail-empty">
        <p class="eyebrow">Examinee Review</p>
        <h2>${students.length ? 'Choose an examinee' : 'No examinees in this workspace yet'}</h2>
        <p class="muted">${students.length ? 'Select a student from the examinee dropdown to view the complete submission, answer table, score breakdown, and session metadata.' : 'Submitted exams for this grade will appear here after applicants finish.'}</p>
      </div>
    `;
    return;
  }

  const color = student.scholarshipStatus === 'accepted' ? 'var(--green)' : student.level.color;
  const completedAt = student.submittedAt ? new Date(student.submittedAt).toLocaleString() : 'Not completed';
  const rows = student.answers.map((item, index) => `
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

  $('examineeDetail').innerHTML = `
    <div class="detail-heading">
      <div>
        <p class="eyebrow">Selected Examinee</p>
        <h2>${escapeHtml(student.studentName)}</h2>
        <p class="muted">${escapeHtml(student.studentEmail || 'No email')} | ${escapeHtml(student.section || 'No grade')}</p>
      </div>
      <div class="detail-score-card" style="--bar-color:${color};--score-width:${student.percentage}%">
        <span class="label">Score Breakdown</span>
        <strong>${student.score}/${student.maxScore}</strong>
        <p>${student.percentage}% | ${escapeHtml(student.level.label)}</p>
        <div class="score-bar"><span></span></div>
      </div>
    </div>
    <dl class="detail-metadata">
      <div><dt>Student ID</dt><dd>#${escapeHtml(student.id)}</dd></div>
      <div><dt>Progress Status</dt><dd>${progressLabel(student)}</dd></div>
      <div><dt>Completed At</dt><dd>${escapeHtml(completedAt)}</dd></div>
      <div><dt>Total Time</dt><dd>${student.timeTakenSeconds}s</dd></div>
      <div><dt>Scholarship Status</dt><dd>${escapeHtml(scholarshipBadgeText(student))}</dd></div>
    </dl>
    <div class="question-response-section">
      <h3>Question Responses</h3>
      <table class="answer-table">
        <thead><tr><th>#</th><th>Question</th><th>Response</th><th>Correct Answer</th><th>Score</th><th>Time</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadDashboard({ refreshQuestions = true } = {}) {
  const search = encodeURIComponent($('studentSearch')?.value.trim() ?? '');
  const sort = encodeURIComponent($('studentSort')?.value ?? 'recent');
  const dashboard = await api(`/api/teacher/dashboard?gradeLevel=${encodeURIComponent(state.selectedTeacherGrade)}&search=${search}&sort=${sort}`);
  renderWorkspaceDashboard(dashboard);

  if (refreshQuestions) await loadQuestionEditor();
}

function renderWorkspaceDashboard(dashboard) {
  const { workspace, overview, scholarship, tests, students, recentActivity, gradeLevels } = dashboard;
  $('workspaceGradeSelect').value = workspace.gradeLevel;
  document.querySelectorAll('.grade-module-nav [data-grade]').forEach((item) => {
    item.classList.toggle('active', item.dataset.grade === workspace.gradeLevel);
  });
  populateExamineeSelect(students);
  renderSelectedExaminee(students);

  $('dashboardSummary').innerHTML = [
    [`${workspace.gradeLevel} Applicants`, overview.totalStudents, 'blue'],
    ['Average', `${overview.averageScore}%`, 'teal'],
    ['Completion', `${overview.completionRate}%`, 'green'],
    ['Accepted', `${scholarship.acceptedStudents}/${scholarship.availableSlots}`, 'coral']
  ].map(([label, value, tone]) => `<div class="metric metric-${tone}"><span class="label">${label}</span><strong>${value}</strong></div>`).join('');

  $('scholarshipSummary').innerHTML = `
    <div>
      <p class="eyebrow">Grade Workspace</p>
      <h2>${escapeHtml(workspace.gradeLevel)} Scholarship Dashboard</h2>
      <p class="muted">This workspace shows only ${escapeHtml(workspace.gradeLevel)} applicants, results, activity, and scholarship slots.</p>
      <p class="muted">Available slots: ${scholarship.availableSlots} | Passing score: ${scholarship.passingScore}% | Qualified: ${scholarship.qualifiedStudents}</p>
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
        <div><dt>Accepted</dt><dd>${grade.acceptedStudents}/${grade.availableSlots}</dd></div>
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
      gradeLevel: original.gradeLevel,
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
  if (student.scholarshipStatus === 'accepted') return `Accepted · ${student.section} rank ${student.scholarshipRank}`;
  if (student.scholarshipStatus === 'waitlisted') return `Passed · ${student.section} waitlist rank ${student.scholarshipRank}`;
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

async function deleteAllResults() {
  const confirmed = confirm('Delete all submissions and results? This does not delete the exam or question bank.');
  if (!confirmed) return;
  const result = await api('/api/teacher/submissions', { method: 'DELETE' });
  state.selectedExamineeId = '';
  await loadDashboard({ refreshQuestions: false });
  alert(`Deleted ${result.deleted} submissions/results. The exam was not changed.`);
}

modes.forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.mode)));
document.querySelectorAll('.grade-module-nav [data-grade]').forEach((link) => {
  link.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  link.addEventListener('click', (event) => {
    event.preventDefault();
    focusTeacherGrade(link.dataset.grade);
  });
});
document.querySelectorAll('.teacher-tool-nav [data-teacher-tool]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    showTeacherModule(button.dataset.teacherTool);
  });
});
$('startForm').addEventListener('submit', beginExam);
$('teacherLoginForm').addEventListener('submit', loginTeacher);
$('fillTestAnswers').addEventListener('click', () => fillTestAnswers().catch((error) => alert(error.message)));
$('sidebarSubmit').addEventListener('click', () => submitExam().catch((error) => alert(error.message)));
$('closeUnansweredModal').addEventListener('click', hideUnansweredModal);
$('reviewUnansweredQuestions').addEventListener('click', reviewUnansweredQuestions);
$('confirmSubmitAnyway').addEventListener('click', () => submitExam({ skipUnansweredCheck: true }).catch((error) => alert(error.message)));
$('unansweredModal').addEventListener('click', (event) => {
  if (event.target === $('unansweredModal')) hideUnansweredModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('unansweredModal').classList.contains('hidden')) hideUnansweredModal();
});
$('workspaceGradeSelect').addEventListener('change', () => {
  focusTeacherGrade($('workspaceGradeSelect').value);
});
$('examineeSelect').addEventListener('change', () => {
  state.selectedExamineeId = $('examineeSelect').value;
  loadDashboard({ refreshQuestions: false }).catch((error) => alert(error.message));
});
$('deleteAllResults').addEventListener('click', () => deleteAllResults().catch((error) => alert(error.message)));
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
document.addEventListener('scroll', () => {
  clearTimeout(state.teacherScrollTimer);
  state.teacherScrollTimer = setTimeout(() => {
    if ($('teacherView').classList.contains('active') && !state.teacherPreservingScroll) {
      state.teacherStableScrollY = window.scrollY;
    }
  }, 120);
}, { passive: true });
setInterval(() => {
  if ($('teacherView').classList.contains('active') && !state.teacherPreservingScroll) {
    state.teacherStableScrollY = window.scrollY;
  }
}, 300);

applyProductionRouteLock();

loadClientConfig()
  .catch(() => {
    state.testingToolsEnabled = false;
  })
  .finally(() => {
    switchMode(routeMode());
    loadExam().catch((error) => {
      $('startPanel').innerHTML = `<h2>Exam unavailable</h2><p class="muted">${escapeHtml(error.message)}</p>`;
    });
  });
