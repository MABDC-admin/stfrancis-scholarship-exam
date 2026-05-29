import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExamStore } from './db.js';
import { extractDocxText } from './lib/docxText.js';
import { parseExamText } from './lib/examParser.js';
import { buildDashboardModel, filterAndSortStudents } from './lib/dashboardModel.js';
import { buildHelmetOptions } from './lib/security.js';
import { validateStudentSubmission } from './lib/validation.js';
import {
  createTeacherSessionStore,
  expiredTeacherCookie,
  extractCookieValue,
  teacherCookie,
  TEACHER_COOKIE,
  verifyTeacherPin
} from './lib/teacherAuth.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});
const store = await createExamStore();
const sessions = new Map();
const teacherSessions = createTeacherSessionStore();
const teacherPin = process.env.TEACHER_PIN ?? 'stfrancis2026';
const durationMinutes = Number(process.env.EXAM_DURATION_MINUTES ?? 60);
const publicDir = resolve(fileURLToPath(new URL('../public', import.meta.url)));

function seedExamIfEmpty() {
  if (store.getExam()) return;
  const seedPath = resolve('data/questions.json');
  if (!existsSync(seedPath)) return;
  store.saveExam(JSON.parse(readFileSync(seedPath, 'utf8')));
}

function sanitizeExam(exam) {
  return {
    title: 'Scholarship Entrance Exam',
    sourceTitle: exam.title,
    source: exam.source,
    totalPoints: exam.totalPoints,
    durationMinutes,
    questions: exam.questions.map(({ correctAnswer, acceptedAnswers, ...question }) => question)
  };
}

function requireTeacher(req, res, next) {
  const token = extractCookieValue(req.get('cookie'), TEACHER_COOKIE);
  if (!teacherSessions.has(token)) {
    res.status(401).json({ error: 'Teacher PIN is required.' });
    return;
  }
  next();
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now || session.used) sessions.delete(token);
  }
}

seedExamIfEmpty();

app.use(helmet(buildHelmetOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir, {
  setHeaders(res, path) {
    if (/\.(css|js|html)$/.test(path)) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    }
  }
}));

app.get('/api/exam', (req, res) => {
  const exam = store.getExam();
  if (!exam) {
    res.status(404).json({ error: 'No exam has been imported yet.' });
    return;
  }
  res.json(sanitizeExam(exam));
});

app.post('/api/session', (req, res) => {
  cleanupSessions();
  const token = randomUUID();
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
  sessions.set(token, {
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.getTime(),
    used: false
  });
  res.json({ token, startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString(), durationMinutes });
});

app.post('/api/teacher/login', (req, res) => {
  if (!verifyTeacherPin(req.body?.pin, teacherPin)) {
    res.status(401).json({ error: 'Invalid teacher PIN.' });
    return;
  }
  const token = teacherSessions.create();
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader('Set-Cookie', teacherCookie(token, { secure: isSecure }));
  res.json({ ok: true });
});

app.post('/api/teacher/logout', (req, res) => {
  const token = extractCookieValue(req.get('cookie'), TEACHER_COOKIE);
  teacherSessions.delete(token);
  res.setHeader('Set-Cookie', expiredTeacherCookie());
  res.json({ ok: true });
});

app.post('/api/submissions', (req, res) => {
  const { studentName, studentEmail, section, answers, timings, sessionToken } = req.body ?? {};
  const session = sessions.get(sessionToken);
  const exam = store.getExam();

  if (!studentName || typeof studentName !== 'string') {
    res.status(400).json({ error: 'Student name is required.' });
    return;
  }
  if (!exam) {
    res.status(404).json({ error: 'No exam has been imported yet.' });
    return;
  }
  if (!session || session.used || session.expiresAt < Date.now()) {
    res.status(403).json({ error: 'Exam session is invalid or expired.' });
    return;
  }
  const validation = validateStudentSubmission({ studentName, studentEmail, section, answers }, exam);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  if (store.hasSubmissionForApplicant({ studentName, studentEmail, section })) {
    res.status(409).json({ error: 'This applicant already has a submitted exam.' });
    return;
  }

  session.used = true;
  const submission = store.saveSubmission({
    studentName: studentName.trim().slice(0, 120),
    studentEmail: String(studentEmail ?? '').trim().slice(0, 160),
    section: String(section ?? '').trim().slice(0, 80),
    answers: answers ?? {},
    timings: timings ?? {},
    startedAt: session.startedAt
  });

  res.status(201).json({
    id: submission.id,
    score: submission.score,
    maxScore: submission.maxScore,
    percentage: submission.percentage,
    submittedAt: submission.submittedAt
  });
});

app.get('/api/teacher/exam', requireTeacher, (req, res) => {
  const exam = store.getExam();
  if (!exam) {
    res.status(404).json({ error: 'No exam has been imported yet.' });
    return;
  }
  res.json(exam);
});

app.get('/api/teacher/submissions', requireTeacher, (req, res) => {
  res.json({ submissions: store.listSubmissions() });
});

app.get('/api/teacher/dashboard', requireTeacher, (req, res) => {
  const exam = store.getExam();
  const submissions = store.listSubmissions();
  const expectedStudents = Number(req.query.expectedStudents ?? submissions.length);
  const model = buildDashboardModel({ exam, submissions, expectedStudents });
  model.students = filterAndSortStudents(model.students, {
    search: String(req.query.search ?? ''),
    status: String(req.query.status ?? 'all'),
    sort: String(req.query.sort ?? 'recent')
  });
  res.json(model);
});

app.get('/api/teacher/students/:id/answers', requireTeacher, (req, res) => {
  const submission = store.listSubmissions().find((item) => String(item.id) === String(req.params.id));
  if (!submission) {
    res.status(404).json({ error: 'Student submission was not found.' });
    return;
  }
  res.json({ submission });
});

app.post('/api/teacher/import-docx', requireTeacher, upload.single('docx'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Upload a DOCX file.' });
      return;
    }
    const text = await extractDocxText(req.file.buffer);
    const exam = parseExamText(text);
    store.saveExam(exam, { backup: true });
    store.clearSubmissions();
    res.json({ imported: exam.questions.length, totalPoints: exam.totalPoints, title: exam.title });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong while processing the exam.' });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`St. Francis entrance exam app running at http://localhost:${port}`);
});
