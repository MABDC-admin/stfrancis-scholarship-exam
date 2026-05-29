import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresExamStore } from '../src/db.js';

function createFakePool({ exam }) {
  const poolQueries = [];
  const clientQueries = [];
  const client = {
    async query(sql, params = []) {
      clientQueries.push({ sql, params });
      if (/INSERT INTO stfrancis_submissions/.test(sql)) return { rows: [{ id: 7 }], rowCount: 1 };
      if (/INSERT INTO stfrancis_examinees/.test(sql)) return { rows: [{ id: 9 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };
  const pool = {
    poolQueries,
    clientQueries,
    async query(sql, params = []) {
      poolQueries.push({ sql, params });
      if (/SELECT payload FROM stfrancis_exams/.test(sql)) return { rows: [{ payload: exam }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return client;
    }
  };
  return pool;
}

test('postgres store syncs normalized question bank when saving an exam', async () => {
  const exam = {
    title: 'Scholarship Bank',
    totalPoints: 1,
    questions: [
      { id: 'g7-q01', gradeLevel: 'Grade 7', type: 'multiple-choice', prompt: 'Pick', choices: { a: 'No', b: 'Yes' }, correctAnswer: 'b', points: 1 }
    ]
  };
  const pool = createFakePool({ exam });
  const store = await createPostgresExamStore({ pool });

  await store.saveExam(exam);

  assert.ok(pool.clientQueries.some((query) => query.sql === 'BEGIN'));
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_exams/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_question_bank/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => query.sql === 'COMMIT'));
});

test('postgres store records normalized examinee and answer rows when saving a submission', async () => {
  const exam = {
    title: 'Scholarship Bank',
    totalPoints: 1,
    questions: [
      { id: 'g8-q01', gradeLevel: 'Grade 8', type: 'multiple-choice', prompt: 'Pick', choices: { a: 'No', b: 'Yes' }, correctAnswer: 'b', points: 1 }
    ]
  };
  const pool = createFakePool({ exam });
  const store = await createPostgresExamStore({ pool });

  const saved = await store.saveSubmission({
    studentName: 'Ben Cruz',
    studentEmail: 'ben@example.com',
    section: 'Grade 8',
    answers: { 'g8-q01': 'b' },
    timings: { 'g8-q01': 10 },
    startedAt: '2026-05-29T11:00:00.000Z'
  });

  assert.equal(saved.id, 7);
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_submissions/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_examinees/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_exam_sessions/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_submission_answers/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => query.sql === 'COMMIT'));
});

test('postgres store can resync normalized question bank from the current exam', async () => {
  const exam = {
    title: 'Scholarship Bank',
    totalPoints: 1,
    questions: [
      { id: 'g9-q01', gradeLevel: 'Grade 9', type: 'multiple-choice', prompt: 'Pick', choices: { a: 'No', b: 'Yes' }, correctAnswer: 'b', points: 1 }
    ]
  };
  const pool = createFakePool({ exam });
  const store = await createPostgresExamStore({ pool });

  await store.syncProductionData();

  assert.ok(pool.clientQueries.some((query) => query.sql === 'BEGIN'));
  assert.ok(pool.clientQueries.some((query) => /INSERT INTO stfrancis_question_bank/.test(query.sql)));
  assert.ok(pool.clientQueries.some((query) => query.sql === 'COMMIT'));
});

test('postgres store clears normalized result tables when clearing submissions', async () => {
  const pool = createFakePool({ exam: null });
  const store = await createPostgresExamStore({ pool });

  await store.clearSubmissions();

  const sql = pool.clientQueries.map((query) => query.sql).join('\n');
  assert.match(sql, /DELETE FROM stfrancis_submission_answers/);
  assert.match(sql, /DELETE FROM stfrancis_exam_sessions/);
  assert.match(sql, /DELETE FROM stfrancis_examinees/);
  assert.match(sql, /DELETE FROM stfrancis_submissions/);
  assert.doesNotMatch(sql, /stfrancis_question_bank/);
});
