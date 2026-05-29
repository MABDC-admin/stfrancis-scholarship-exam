import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('student exam API can sanitize a grade-specific question set', () => {
  assert.match(serverJs, /examForGrade/);
  assert.match(serverJs, /req\.query\.gradeLevel/);
});

test('student start flow reloads the exam for the selected grade level', () => {
  assert.match(appJs, /async function loadExam\(gradeLevel = ''\)/);
  assert.match(appJs, /gradeLevel \? `\/api\/exam\?gradeLevel=\$\{encodeURIComponent\(gradeLevel\)\}` : '\/api\/exam'/);
  assert.match(appJs, /await loadExam\(state\.student\.section\)/);
});

test('teacher question editor keeps grade level tags when saving edited banks', () => {
  assert.match(appJs, /gradeLevel:\s*original\.gradeLevel/);
});
