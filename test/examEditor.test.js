import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEditableExam } from '../src/lib/examEditor.js';

test('normalizeEditableExam keeps teacher-edited questions and recalculates points', () => {
  const exam = normalizeEditableExam({
    title: 'Scholarship Entrance Exam',
    questions: [
      {
        id: 'q01',
        section: 'Music & Arts',
        prompt: 'Edited prompt?',
        choices: { a: 'One', b: 'Two', c: 'Three' },
        correctAnswer: 'b',
        points: 2
      }
    ]
  });

  assert.equal(exam.totalPoints, 2);
  assert.equal(exam.questions[0].type, 'multiple-choice');
  assert.equal(exam.questions[0].choices.b, 'Two');
});

test('normalizeEditableExam preserves grade level tags for per-grade question banks', () => {
  const exam = normalizeEditableExam({
    title: 'Scholarship Grade Bank',
    questions: [
      {
        id: 'g7-q01',
        gradeLevel: 'Grade 7',
        section: 'English',
        prompt: 'Edited prompt?',
        choices: { a: 'One', b: 'Two' },
        correctAnswer: 'a'
      }
    ]
  });

  assert.equal(exam.questions[0].gradeLevel, 'Grade 7');
});

test('normalizeEditableExam rejects questions without a matching correct choice', () => {
  assert.throws(
    () => normalizeEditableExam({
      title: 'Scholarship Entrance Exam',
      questions: [
        {
          id: 'q01',
          section: 'Music & Arts',
          prompt: 'Edited prompt?',
          choices: { a: 'One', b: 'Two' },
          correctAnswer: 'c'
        }
      ]
    }),
    /correct answer/i
  );
});
