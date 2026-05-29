import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createExamStore } from '../src/db.js';

test('exam store persists exams and scored submissions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'exam-store-'));
  const store = await createExamStore({ dbPath: join(dir, 'exam.sqlite') });
  const exam = {
    title: 'MAPEH Sample',
    totalPoints: 2,
    questions: [
      { id: 'q01', type: 'multiple-choice', prompt: 'Pick one', choices: { a: 'Wrong', b: 'Right' }, correctAnswer: 'b', points: 1 },
      { id: 'q02', type: 'matching', prompt: 'Broken toy', correctAnswer: 'Right to Redress', acceptedAnswers: ['redress'], points: 1 }
    ]
  };

  await store.saveExam(exam);
  const savedExam = await store.getExam();
  assert.equal(savedExam.title, 'MAPEH Sample');
  assert.equal(savedExam.questions.length, 2);

  const saved = await store.saveSubmission({
    studentName: 'Ana Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 4',
    answers: { q01: 'b', q02: 'redress' },
    timings: { q01: 11, q02: 14 }
  });

  assert.equal(saved.id, 1);
  assert.equal(saved.studentEmail, 'ana@example.com');
  assert.equal(saved.percentage, 100);
  const submissions = await store.listSubmissions();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].studentName, 'Ana Cruz');
  assert.equal(submissions[0].studentEmail, 'ana@example.com');
  assert.equal(submissions[0].score, 2);
  assert.equal(submissions[0].details[0].timeTakenSeconds, 11);
  assert.equal(submissions[0].details[1].correctAnswer, 'Right to Redress');
});

test('exam store scores submissions against the applicant grade level questions only', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'exam-store-grade-'));
  const store = await createExamStore({ dbPath: join(dir, 'exam.sqlite') });
  const exam = {
    title: 'Scholarship Grade Bank',
    totalPoints: 4,
    questions: [
      { id: 'g7-q01', gradeLevel: 'Grade 7', type: 'multiple-choice', prompt: 'G7 pick', choices: { a: 'Right', b: 'Wrong' }, correctAnswer: 'a', points: 1 },
      { id: 'g7-q02', gradeLevel: 'Grade 7', type: 'multiple-choice', prompt: 'G7 pick 2', choices: { a: 'Wrong', b: 'Right' }, correctAnswer: 'b', points: 1 },
      { id: 'g8-q01', gradeLevel: 'Grade 8', type: 'multiple-choice', prompt: 'G8 pick', choices: { a: 'Right', b: 'Wrong' }, correctAnswer: 'a', points: 1 },
      { id: 'g8-q02', gradeLevel: 'Grade 8', type: 'multiple-choice', prompt: 'G8 pick 2', choices: { a: 'Wrong', b: 'Right' }, correctAnswer: 'b', points: 1 }
    ]
  };

  await store.saveExam(exam);
  const saved = await store.saveSubmission({
    studentName: 'Ben Cruz',
    section: 'Grade 8',
    answers: { 'g8-q01': 'a', 'g8-q02': 'b' },
    timings: { 'g8-q01': 10, 'g8-q02': 12 }
  });

  assert.equal(saved.maxScore, 2);
  assert.equal(saved.score, 2);
  assert.deepEqual(saved.items.map((item) => item.questionId), ['g8-q01', 'g8-q02']);
});

test('clearSubmissions removes results without changing the exam', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'exam-store-clear-results-'));
  const store = await createExamStore({ dbPath: join(dir, 'exam.sqlite') });
  const exam = {
    title: 'Scholarship Grade Bank',
    totalPoints: 1,
    questions: [
      { id: 'g7-q01', gradeLevel: 'Grade 7', type: 'multiple-choice', prompt: 'G7 pick', choices: { a: 'Right', b: 'Wrong' }, correctAnswer: 'a', points: 1 }
    ]
  };

  await store.saveExam(exam);
  await store.saveSubmission({
    studentName: 'Cara Reyes',
    section: 'Grade 7',
    answers: { 'g7-q01': 'a' },
    timings: { 'g7-q01': 9 }
  });

  await store.clearSubmissions();

  assert.equal((await store.listSubmissions()).length, 0);
  assert.deepEqual(await store.getExam(), exam);
});

test('sqlite exam store reports storage health', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'exam-store-health-'));
  const store = await createExamStore({ dbPath: join(dir, 'exam.sqlite') });

  assert.equal(store.storageBackend, 'sqlite');
  assert.deepEqual(await store.healthCheck(), { ok: true, storage: 'sqlite' });
});
