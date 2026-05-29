import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('student exam includes a hidden testing-only fill answers button', () => {
  assert.match(indexHtml, /id="fillTestAnswers"/);
  assert.match(indexHtml, /Fill Answers/);
  assert.match(indexHtml, /testing-only/);
  assert.match(indexHtml, /hidden/);
});

test('fill answers control is only revealed by testing query parameters', () => {
  assert.match(appJs, /function isTestingMode\(\)/);
  assert.match(appJs, /URLSearchParams\(window\.location\.search\)/);
  assert.match(appJs, /\.has\('testing'\)/);
  assert.match(appJs, /\.has\('test'\)/);
});

test('fill answers helper fills every unanswered question with a valid available choice', () => {
  assert.match(appJs, /function fillTestAnswers\(\)/);
  assert.match(appJs, /state\.exam\.questions\.forEach/);
  assert.match(appJs, /firstTestingAnswerFor\(question\)/);
  assert.match(appJs, /state\.answers\[question\.id\]/);
  assert.match(appJs, /updateProgress\(\)/);
});

test('testing-only button has distinct styling', () => {
  assert.match(stylesCss, /\.testing-only/);
});
