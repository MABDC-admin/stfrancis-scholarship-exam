import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStudentSubmission } from '../src/lib/validation.js';

const exam = {
  questions: [
    { id: 'q01', type: 'multiple-choice' },
    { id: 'q02', type: 'multiple-choice' }
  ]
};

test('validateStudentSubmission accepts a named Grade 7 to Grade 10 applicant with known answers', () => {
  const result = validateStudentSubmission({
    studentName: 'Ana Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 7',
    answers: { q01: 'a', q02: 'b' }
  }, exam);

  assert.equal(result.ok, true);
});

test('validateStudentSubmission rejects invalid grade levels and unknown answer ids', () => {
  const result = validateStudentSubmission({
    studentName: 'Ana Cruz',
    section: 'Grade 4',
    answers: { q01: 'a', injected: 'b' }
  }, exam);

  assert.equal(result.ok, false);
  assert.match(result.error, /grade level/i);
});

test('validateStudentSubmission only accepts answers from the selected grade question set', () => {
  const gradeExam = {
    questions: [
      { id: 'g7-q01', gradeLevel: 'Grade 7', type: 'multiple-choice' },
      { id: 'g8-q01', gradeLevel: 'Grade 8', type: 'multiple-choice' }
    ]
  };

  const result = validateStudentSubmission({
    studentName: 'Ana Cruz',
    section: 'Grade 7',
    answers: { 'g8-q01': 'a' }
  }, gradeExam);

  assert.equal(result.ok, false);
  assert.match(result.error, /unknown questions/i);
});
