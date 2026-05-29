import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exam = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));

test('imported PDF question bank contains 30 questions for each scholarship grade level', () => {
  assert.equal(exam.questions.length, 120);
  assert.equal(exam.totalPoints, 120);

  for (const gradeLevel of ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']) {
    const questions = exam.questions.filter((question) => question.gradeLevel === gradeLevel);
    assert.equal(questions.length, 30, `${gradeLevel} should have 30 questions`);
    assert.ok(questions.every((question) => question.type === 'multiple-choice'));
    assert.ok(questions.every((question) => ['a', 'b', 'c', 'd'].includes(question.correctAnswer)));
    assert.ok(questions.every((question) => Object.keys(question.choices).length === 4));
  }
});

test('imported PDF question ids are unique and grade-prefixed', () => {
  const ids = exam.questions.map((question) => question.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const question of exam.questions) {
    assert.match(question.id, /^g(7|8|9|10)-q\d{2}$/);
  }
});
