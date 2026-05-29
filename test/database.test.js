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
