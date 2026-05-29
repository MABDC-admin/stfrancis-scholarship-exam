import test from 'node:test';
import assert from 'node:assert/strict';
import { examForGrade, questionsForGrade } from '../src/lib/gradeExam.js';

const mixedGradeExam = {
  title: 'Scholarship Entrance Exam',
  totalPoints: 4,
  questions: [
    { id: 'g7-q01', gradeLevel: 'Grade 7', points: 1 },
    { id: 'g7-q02', gradeLevel: 'Grade 7', points: 1 },
    { id: 'g8-q01', gradeLevel: 'Grade 8', points: 1 },
    { id: 'g8-q02', gradeLevel: 'Grade 8', points: 2 }
  ]
};

test('questionsForGrade returns only questions assigned to the requested grade level', () => {
  const questions = questionsForGrade(mixedGradeExam, 'Grade 8');

  assert.deepEqual(questions.map((question) => question.id), ['g8-q01', 'g8-q02']);
});

test('examForGrade recalculates total points for the selected grade exam', () => {
  const exam = examForGrade(mixedGradeExam, 'Grade 8');

  assert.equal(exam.gradeLevel, 'Grade 8');
  assert.equal(exam.totalPoints, 3);
  assert.deepEqual(exam.questions.map((question) => question.id), ['g8-q01', 'g8-q02']);
});

test('questionsForGrade keeps legacy single-exam payloads working when no grade tags exist', () => {
  const legacyExam = {
    questions: [
      { id: 'q01', points: 1 },
      { id: 'q02', points: 1 }
    ]
  };

  assert.deepEqual(questionsForGrade(legacyExam, 'Grade 7').map((question) => question.id), ['q01', 'q02']);
});
