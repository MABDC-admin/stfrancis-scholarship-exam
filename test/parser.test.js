import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExamText } from '../src/lib/examParser.js';

const sampleText = readFileSync(new URL('./fixtures/mapeh-sample-text.txt', import.meta.url), 'utf8');

test('parseExamText extracts exam title, sections, question types, and choices', () => {
  const exam = parseExamText(sampleText);

  assert.equal(exam.title, '4th Quarter Exam in MAPEH 4');
  assert.equal(exam.questions.length, 7);
  assert.deepEqual(
    exam.questions.map((question) => question.type),
    ['multiple-choice', 'multiple-choice', 'multiple-choice', 'multiple-choice', 'multiple-choice', 'multiple-choice', 'multiple-choice']
  );
  assert.equal(exam.questions[0].section, 'Music & Arts');
  assert.equal(exam.questions[0].choices.c, 'Fiesta');
  assert.equal(exam.questions[2].section, 'P.E & HEALTH');
  assert.equal(exam.questions[3].correctAnswer, 'a');
  assert.equal(exam.questions[3].choices.a, 'Right to Redress');
  assert.equal(exam.questions[4].choices.a, 'Critical thinking');
  assert.equal(exam.questions[4].correctAnswer, 'a');
});

test('parseExamText recovers an unlabelled first choice when Word drops the a marker', () => {
  const exam = parseExamText(`
4th Quarter Exam in MAPEH 4
Music & Arts
An event that is usually staged by a local community.
Day of dead     b. Aurora mass     c. Fiesta
`);

  assert.equal(exam.questions.length, 1);
  assert.equal(exam.questions[0].choices.a, 'Day of dead');
  assert.equal(exam.questions[0].choices.b, 'Aurora mass');
  assert.equal(exam.questions[0].choices.c, 'Fiesta');
});

test('parseExamText splits prompts from glued inline choices', () => {
  const exam = parseExamText(`
4th Quarter Exam in MAPEH 4
Music & Arts
What is a live performance?a. A movie you watch at homeb. A show presented in front of an audience at the same timec. A picture in a book
`);

  assert.equal(exam.questions.length, 1);
  assert.equal(exam.questions[0].prompt, 'What is a live performance?');
  assert.equal(exam.questions[0].choices.a, 'A movie you watch at home');
  assert.equal(exam.questions[0].choices.b, 'A show presented in front of an audience at the same time');
  assert.equal(exam.questions[0].choices.c, 'A picture in a book');
});

test('parseExamText splits choice markers after closing punctuation', () => {
  const exam = parseExamText(`
4th Quarter Exam in MAPEH 4
P.E & HEALTH
What law protects the rights of consumers in the Philippines?a. Labor Code of the Philippinesb. Republic Act 7394 (Consumer Act of the Philippines)c. Civil Code of the Philippines
`);

  assert.equal(exam.questions[0].choices.b, 'Republic Act 7394 (Consumer Act of the Philippines)');
  assert.equal(exam.questions[0].choices.c, 'Civil Code of the Philippines');
});

test('parseExamText converts consumer skills enumeration into multiple choice questions', () => {
  const exam = parseExamText(`
4th Quarter Exam in MAPEH 4
P.E & HEALTH
Enumeration. List down the three skills of a responsible Filipino consumer.
1. 3.
2.
`);

  assert.equal(exam.questions.length, 3);
  assert.ok(exam.questions.every((question) => question.type === 'multiple-choice'));
  assert.equal(exam.questions[0].prompt, 'Which of the following is a skill of a responsible Filipino consumer?');
  assert.equal(exam.questions[0].choices.a, 'Critical thinking');
  assert.equal(exam.questions[0].correctAnswer, 'a');
});
