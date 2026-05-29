import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createExamStore } from '../src/db.js';

test('saveExam can preserve a timestamped backup before replacing an existing exam', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'exam-backup-'));
  const store = await createExamStore({ dbPath: join(dir, 'exam.sqlite') });

  await store.saveExam({ title: 'Old Exam', totalPoints: 1, questions: [] });
  await store.saveExam({ title: 'New Exam', totalPoints: 1, questions: [] }, { backup: true });

  const backups = readdirSync(join(dir, 'backups')).filter((name) => name.endsWith('.sqlite'));
  assert.equal((await store.getExam()).title, 'New Exam');
  assert.equal(backups.length, 1);
});

test('hasSubmissionForApplicant detects duplicate applicant attempts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'exam-duplicate-'));
  const store = await createExamStore({ dbPath: join(dir, 'exam.sqlite') });
  await store.saveExam({
    title: 'Scholarship Exam',
    totalPoints: 1,
    questions: [{ id: 'q01', type: 'multiple-choice', choices: { a: 'Yes' }, correctAnswer: 'a', points: 1 }]
  });

  await store.saveSubmission({
    studentName: 'Ana Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 7',
    answers: { q01: 'a' }
  });

  assert.equal(await store.hasSubmissionForApplicant({
    studentName: ' ana cruz ',
    studentEmail: 'ANA@example.com',
    section: 'Grade 7'
  }), true);
});
