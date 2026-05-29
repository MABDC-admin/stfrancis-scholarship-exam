import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeSubmission } from '../src/lib/scoring.js';

const questions = [
  {
    id: 'q1',
    type: 'multiple-choice',
    correctAnswer: 'b',
    points: 1
  },
  {
    id: 'q2',
    type: 'matching',
    correctAnswer: 'Right to Redress',
    acceptedAnswers: ['right to redress', 'redress'],
    points: 1
  },
  {
    id: 'q3',
    type: 'enumeration',
    correctAnswer: 'Concert',
    acceptedAnswers: ['concert', 'live concert'],
    points: 1
  }
];

test('gradeSubmission scores choice and text answers with normalization', () => {
  const result = gradeSubmission(questions, {
    q1: 'b',
    q2: 'redress',
    q3: 'Live Concert'
  });

  assert.equal(result.score, 3);
  assert.equal(result.maxScore, 3);
  assert.equal(result.percentage, 100);
  assert.equal(result.items[1].isCorrect, true);
});

test('gradeSubmission marks missing and wrong answers for dashboard review', () => {
  const result = gradeSubmission(questions, {
    q1: 'a',
    q2: '',
    q3: 'dance'
  });

  assert.equal(result.score, 0);
  assert.equal(result.percentage, 0);
  assert.deepEqual(
    result.items.map((item) => item.isCorrect),
    [false, false, false]
  );
});

test('gradeSubmission supports true false, rich text prompts, attachments, and timings', () => {
  const result = gradeSubmission(
    [
      {
        id: 'q4',
        type: 'true-false',
        promptHtml: '<strong>Consumer rights protect buyers.</strong>',
        attachments: [{ id: 'a1', type: 'image', url: '/uploads/label.png', alt: 'Product label' }],
        correctAnswer: true,
        points: 2
      },
      {
        id: 'q5',
        type: 'short-answer',
        promptHtml: 'Name a responsible consumer skill.',
        correctAnswer: 'critical thinking',
        acceptedAnswers: ['Critical Thinking', 'wise buying'],
        points: 3
      }
    ],
    { q4: 'true', q5: 'Wise Buying' },
    { q4: 14, q5: 27 }
  );

  assert.equal(result.score, 5);
  assert.equal(result.maxScore, 5);
  assert.equal(result.items[0].promptHtml, '<strong>Consumer rights protect buyers.</strong>');
  assert.equal(result.items[0].attachments[0].alt, 'Product label');
  assert.equal(result.items[0].timeTakenSeconds, 14);
  assert.equal(result.items[1].timeTakenSeconds, 27);
});
