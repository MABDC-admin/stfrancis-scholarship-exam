import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordNormalizedSubmission,
  syncQuestionBankFromExam
} from '../src/lib/productionData.js';

function createRecordingClient(resultQueue = []) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      return resultQueue.shift() ?? { rows: [], rowCount: 0 };
    }
  };
}

test('syncQuestionBankFromExam upserts active grade-level questions', async () => {
  const client = createRecordingClient();
  const exam = {
    source: 'PDF Bank',
    questions: [
      {
        id: 'g7-q01',
        gradeLevel: 'Grade 7',
        type: 'multiple-choice',
        prompt: 'What is 1 + 1?',
        choices: { a: '1', b: '2' },
        correctAnswer: 'b',
        points: 1,
        attachments: []
      },
      {
        id: 'legacy-q01',
        type: 'multiple-choice',
        prompt: 'Legacy',
        choices: { a: 'A' },
        correctAnswer: 'a',
        points: 1
      }
    ]
  };

  await syncQuestionBankFromExam(client, exam);

  assert.match(client.queries[0].sql, /UPDATE stfrancis_question_bank/);
  assert.deepEqual(client.queries[0].params, [['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']]);
  assert.equal(client.queries.length, 2);
  assert.match(client.queries[1].sql, /INSERT INTO stfrancis_question_bank/);
  assert.match(client.queries[1].sql, /ON CONFLICT \(grade_level, question_id\) DO UPDATE/);
  assert.deepEqual(client.queries[1].params, [
    'Grade 7',
    'g7-q01',
    'multiple-choice',
    'What is 1 + 1?',
    JSON.stringify({ a: '1', b: '2' }),
    'b',
    JSON.stringify([]),
    1,
    JSON.stringify([]),
    'PDF Bank'
  ]);
});

test('recordNormalizedSubmission writes examinee, session, and per-question answer rows', async () => {
  const client = createRecordingClient([
    { rows: [{ id: 44 }] },
    { rows: [{ id: 88 }] },
    { rows: [] },
    { rows: [] }
  ]);
  const submittedAt = '2026-05-29T12:00:00.000Z';

  await recordNormalizedSubmission(client, {
    submissionId: 12,
    studentName: 'Ana Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 8',
    startedAt: '2026-05-29T11:45:00.000Z',
    submittedAt,
    grading: {
      items: [
        {
          questionId: 'g8-q01',
          studentAnswer: 'b',
          correctAnswer: 'b',
          isCorrect: true,
          earnedPoints: 1,
          maxPoints: 1,
          timeTakenSeconds: 12
        }
      ]
    }
  });

  assert.match(client.queries[0].sql, /INSERT INTO stfrancis_examinees/);
  assert.deepEqual(client.queries[0].params, ['Ana Cruz', 'ana@example.com', 'Grade 8', 'Grade 8']);
  assert.match(client.queries[1].sql, /INSERT INTO stfrancis_exam_sessions/);
  assert.equal(client.queries[1].params[0], 44);
  assert.match(client.queries[1].params[1], /^[a-f0-9]{64}$/);
  assert.equal(client.queries[1].params[2], 'Grade 8');
  assert.equal(client.queries[1].params[3], 'completed');
  assert.equal(client.queries[1].params[4], '2026-05-29T11:45:00.000Z');
  assert.equal(client.queries[1].params[6], submittedAt);
  assert.match(client.queries[2].sql, /INSERT INTO stfrancis_submission_answers/);
  assert.deepEqual(client.queries[2].params, [12, 'g8-q01', 'b', 'b', true, 1, 1, 12]);
  assert.match(client.queries[3].sql, /INSERT INTO stfrancis_admin_audit_logs/);
  assert.equal(client.queries[3].params[0], 'submission.recorded');
});
